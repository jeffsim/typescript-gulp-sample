var glob = require("glob"),
    bu = require("./buildUtils"),
    buildSettings = require("./buildSettings");

var bundleUtils = {
    finishInitializingBundles: function (buildConfig) {

        // Generate Aggregate Bundles' output file names; these include version stamp if specified.  We need to do
        // this now as some projects reference the bundle names when copying files
        // TODO: possible to generalize?
        // Example of formatting: 'duality-0.1.1.debug.js'
        for (var bundleName in buildConfig.aggregateBundles)
            buildConfig.aggregateBundles[bundleName] = finishInitializingBundle(buildConfig.aggregateBundles[bundleName]);
    },

    finishInitializingProjects: function (buildConfig, buildProjectGroup) {
        for (var projectGroupId in buildConfig.projectGroups) {
            var projectGroup = buildConfig.projectGroups[projectGroupId];
            if (projectGroup.name === undefined)
                projectGroup.name = projectGroupId;

            if (buildSettings.debug) {
                // If ProjectGroup specified a tsconfig.json file for all projects within it, then verify tsconfig.json file is present
                if (projectGroup.tsConfigFile)
                    bu.assert(bu.fileExists(projectGroup.tsConfigFile), "projectGroup.tsConfigFile not found for ProjectGroup '" + projectGroupId + "'");
            }

            for (var projectId in projectGroup.projects) {
                var project = projectGroup.projects[projectId];

                // Associate the Project with the ProjectGroup
                project.projectGroup = projectGroup;

                if (!project.name)
                    project.name = projectId;

                // All projects must specify a path
                if (!project.path)
                    throw Error(project.name + " must specify project.path");
                
                // if our ProjectGroup specified a projectRootFolder, then prepend it now
                if (projectGroup.projectRootFolder)
                    project.path = bu.joinPath(projectGroup.projectRootFolder, project.path);
                    
                // Pass projectDefaults from the ProjectGroup into the Project IF the Project hasn't overridden them
                if (projectGroup.projectDefaults)
                    for (var projectDefault in projectGroup.projectDefaults)
                        if (project[projectDefault] === undefined)
                            project[projectDefault] = projectGroup.projectDefaults[projectDefault];

                // By default, project files are built into /bld
                if (project.buildRootFolder === undefined)
                    project.buildRootFolder = buildSettings.bldPath;
                
                // Ensure project is rooted in build root folder, not file system root folder
                project.buildRootFolder = bu.joinPath(".", project.buildRootFolder);

                // buildFolder is where files get built into - combination of root folder (e.g. bld/) and project.path (e.g. plugins/plugin1)
                if (project.buildFolder === undefined)
                    project.buildFolder = bu.joinPath(project.buildRootFolder, project.path)

                // By default, project output files are copied into the project's folder
                if (project.outputFolder === undefined)
                    project.outputFolder = project.path;

                // Ensure outputFolder is rooted in build root folder, not file system root folder
                project.outputFolder = bu.joinPath(".", project.outputFolder);

                // By default, project output files are bundled together
                if (project.bundleFiles === undefined)
                    project.bundleFiles = true;

                // By default, projects do not output d.ts files
                if (project.generateTyping === undefined)
                    project.generateTyping = false;

                if (project.debugBundleFilename === undefined)
                    project.debugBundleFilename = project.name + buildSettings.bundleSuffix + "-debug.js"
                if (project.minBundleFilename === undefined)
                    project.minBundleFilename = project.name + buildSettings.bundleSuffix + "-min.js"
                if (project.typingBundleFilename === undefined)
                    project.typingBundleFilename = project.name + buildSettings.bundleSuffix + ".d.ts"

                // project.files - if not specified then default to project.path/**.*.ts
                if (project.files === undefined)
                    project.files = ["**/*.ts"];

                // Rebase passed-in file names so that they are within the project folder
                for (var i = 0; i < project.files.length; i++)
                    project.files[i] = bu.joinPath(project.path, project.files[i]);

                if (buildSettings.debug) {
                    // do various checks to validate the config file

                    // if projectgroup didn't specify a tsconfig.json file for all projects in it, then verify that this project's
                    // tsconfig.json file is in the project root
                    if (!projectGroup.tsConfigFile)
                        bu.assert(bu.fileExists(bu.joinPath(project.path, "tsconfig.json")), "tsconfig.json file not found in Project root('" + project.path + "') for Project '" + projectId + "'");

                    // Verify that there's at least one file to compile.
                    if (!buildSettings.debugSettings.allowEmptyFolders) {
                        var numFiles = 0;
                        project.files.forEach((fileGlob) => numFiles += glob.sync(fileGlob).length);
                        bu.assert(numFiles > 0, "No .ts files found for project '" + projectId + "'.  If this is expected behavior, then set buildSettings.debug.allowEmptyFolders:true");
                    }
                }
            }
        }

        // IF the buildConfig doesn't have a buildAll function defined, then create one now based around dependenies
        if (!buildConfig.buildAll)
            bundleUtils.buildProjectDependencyGraph(buildConfig, buildProjectGroup);

        // Return the config to enable chaining
        return buildConfig;
    },


    // build dependency graph of ProjectGroups within the specified buildConfig. Uses basic depth-first topo sort and
    // compares 'project.dependsOn: object[]' values.
    // NOTE: This function is not heavily tested.  If dependency graph isn't working for you, then skip this by defining
    // your own buildConfig.buildAll() which sets order explicitly; see the main buildConfig in this sample env for example
    buildProjectDependencyGraph: function (buildConfig, buildProjectGroup) {
        var state = { exploring: 1, placed: 2 };
        var buildSlots = [];
        for (var projectGroupId in buildConfig.projectGroups)
            exploreProjectGroup(buildConfig.projectGroups[projectGroupId]);

        function exploreProjectGroup(projectGroup) {
            if (projectGroup.state == state.exploring)
                throw new Error("Circular dependency!");

            if (projectGroup.state != state.placed) {
                projectGroup.state = state.exploring;
                for (var projectId in projectGroup.projects) {
                    let project = projectGroup.projects[projectId];
                    if (project.dependsOn)
                        for (var dependentProject of project.dependsOn)
                            exploreProjectGroup(dependentProject.projectGroup);
                }
                projectGroup.state = state.placed;
                buildSlots.push(() => buildProjectGroup(projectGroup))
            }
        }

        // Create the buildAll function on buildConfig with the proper order here.
        buildConfig.buildAll = function (buildProjectGroup, createBundle) {
            return bu.runSeries(buildSlots);
        }
    }
}

function finishInitializingBundle(bundle, project) {
    if (bundle.initialized)
        return bundle;
        
    // Bundle's base name is either defined, or is == containing project's name (if any)
    var bundleNameVer = bundle.name || project.name;
    if (!bundleNameVer)
        throw Error("Must specify name on either bundle or containing project");

    bundle.project = project;

    // Include version in the name if specified in the bundle
    if (bundle.version)
        bundleNameVer += "-" + bundle.version;

    if (!bundle.outputFolder)
        bundle.outputFolder = buildSettings.distPath;
    // ensure bundle is rooted in the build root; otherwise, could end up in file system root if caller specifies something like "/dist"
    bundle.outputFolder = bu.joinPath(".", bundle.outputFolder);

    // Set the output file names (if not already set in the bundle)
    bundle.debugFilename = bundle.debugFilename || (bundleNameVer + ".debug.js");
    bundle.minFilename = bundle.minFilename || (bundleNameVer + ".min.js");
    bundle.typingFilename = bundle.typingFilename || (bundleNameVer + ".d.ts");

    // Initialize the incremental project build cache which tracks last-changed times
    bundle.modifiedBundleCache = {};

    bundle.initialized = true;
    return bundle;
};

module.exports = bundleUtils;
