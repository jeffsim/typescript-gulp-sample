var buildSettings = require("./buildSettings");
var bu = require("./buildUtils");

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

            for (var projectId in projectGroup.projects) {
                var project = projectGroup.projects[projectId];

                if (!project.name)
                    project.name = projectId;

                // All projects must specify a path
                if (!project.path)
                    throw Error(project.name + " must specify project.path");

                // Associate the Project with the ProjectGroup
                project.projectGroup = projectGroup;

                // Pass projectDefaults from the ProjectGroup into the Project IF the Project hasn't overridden them
                if (projectGroup.projectDefaults)
                    for (var projectDefault in projectGroup.projectDefaults)
                        if (project[projectDefault] === undefined)
                            project[projectDefault] = projectGroup.projectDefaults[projectDefault];

                // By default, project files are built into /bld
                if (project.buildRootFolder === undefined)
                    project.buildRootFolder = "bld";

                // buildFolder is where files get built into - combination of root folder (e.g. bld/) and project.path (e.g. plugins/plugin1)
                if (project.buildFolder === undefined)
                    project.buildFolder = bu.joinPath(project.buildRootFolder, project.path)

                // By default, project output files are copied into the project's folder
                if (project.outputFolder === undefined)
                    project.outputFolder = project.path;

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
                // if specified, then rebase to within project.path
                if (project.files === undefined)
                    project.files = ["**/*.ts"];
                // Rebase passed-in file names so that they are within the project folder
                for (var i = 0; i < project.files.length; i++)
                    project.files[i] = bu.joinPath(project.path, project.files[i]);
            }
        }

        // IF the buildConfig doesn't have a buildAll function defined, then create one now based around dependenies
        if (!buildConfig.buildAll)
            bundleUtils.buildProjectDependencyGraph(buildConfig, buildProjectGroup);

        // Return the config to enable chaining
        return buildConfig;
    },


    // build dependency graph of ProjectGroups within the specified buildConfig. Uses basic depth-first topo sort and
    // compares 'project.dependsOn: object[]' values
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
                buildSlots.push(projectGroup)
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

    // Set the output file names (if not already set in the bundle)
    bundle.debugFilename = bundle.debugFilename || (bundleNameVer + ".debug.js");
    bundle.minFilename = bundle.minFilename || (bundleNameVer + ".min.js");
    bundle.typingFilename = bundle.typingFilename || (bundleNameVer + ".d.ts");

    bundle.initialized = true;
    return bundle;
};

module.exports = bundleUtils;
