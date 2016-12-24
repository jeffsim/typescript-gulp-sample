var bu = require("./gulpBuild/buildUtils"),
    bundleUtil = require("./gulpBuild/buildBundleUtils"),
    buildSettings = require("./gulpBuild/buildSettings");



// =============================================================================================================
// NOTE: This is an example of a fairly complex build configuration.
// For simpler examples, look at the buildConfig files in ./moreExampleBuildEnvs.
// You can also build those by commenting/uncommenting the appropriate 'var buildConfig=...' lines near the top of gulpfile.js
// =============================================================================================================



function initialize() {
    var buildConfig = {};

    // Structure of the buildConfig object that we return:
    // var buildConfig = {
    //     aggregateBundles: {
    //        bundle1: {bundleDefn},
    //        bundle2: {bundleDefn},
    //        ...,
    //     projectGroups: {
    //        project1: { projectDefn },
    //        project2: { projectDefn },
    //        ...,
    //     },
    //     buildAll?: function()
    // };

    // =============================================================================================================
    // ======= PROJECTS ============================================================================================
    // Here's the structure of ProjectGroup:
    //
    //  name:string?                Name of the project group; output in the task header during build process.
    //                              If unspecified, then the name of the containing object is used.
    //  tsConfigFile:?string        The projects in a ProjectGroup can either (a) use a common tsconfig.json file, or (b)
    //                              use a tsconfig file per project.  If (a), then set this to the location of that file.
    //  filesToPrecopyToAllProjects?:fileCopy[]  Optional list of files that should be precopied to all projects within the
    //                              ProjectGroup fileCopy structure = {src:string, dest: string}.  src is relative to root;
    //                              dest is relative to each project's path.
    //  filesToPrecopyOnce?:fileCopy[]  Optional list of files that should be precopied once before projects are compiled.
    //                              Example usage: all tests reference the same duality*.d.ts, so copy it once into the
    //                              tests/typings folder.  NOTE: paths are relative to root.
    //  commonFiles?:string[]       Optional list of files that should be including in compilation of all projects in the
    //                              ProjectGroup.  e.g. All Tests include tests/typings/*.d.ts.
    //  bundleProjectsTogether: {}  Tells the build environment to bundle all of the projects in this projectgroup into one file.
    //  projectDefaults: {}         Specifies default values for projects in the projectgroup.  can be any field that can be set on a project
    //                              Values can still be overridden by explicitly specifying in a project.
    //  projects:Project[]          List of Projects within the ProjectGroup.
    //  extraFilesToBundle:string[] List of files to include in the project bundle.  e.g. preexisting js files.
    //                              Note: this requires that allowJs be set to true in the project's tsconfig.json file
    //                              so that tsc passes them through; otherwise they'll get dropped silently
    // projectRootFolder?: string   Optional path to root all projects in.  Avoids redundantly specifying path root in
    //                              project.path.  Note that this field does not apply to paths in other ProjectGroup-
    //                              level fields such as filesToClean or commonFiles; they remain rooted in the buildenv root.
    //  filesToClean?: string[]     List of file (globs) to delete when running clean task. NOTE: path is relative to
    //                              the build env root; unlike filesToClean in projects, where they are relative to project root
    //
    // Structure of Project object:
    //  name: string                Name of the Project.  If unspecified, then the name of the containing object is used
    //  path: string                Path of the Project relative to root
    //  files: string[]             List of files to compile; relative to project path.
    //                              If unspecified, defaults to '["**/*.ts"]', which == all TS files in the project folder.
    //  filesToClean?: string[]     List of file (globs) to delete when running clean task.  If unspecified, defaults to
    //                              '**/*.js' (ie all transpiled files).  If a project doesn't have pre-existing js files
    //                              then the default is normally fine.  Note that these files are in addition to a set
    //                              of always-deleted files (e.g. **/*.map).  See function clean() for details.
    //  buildRootFolder: string     Root of where temporary build files go.  can override to /, /mybld/out, or whatever...
    //  buildFolder: string         Actual folder into which temp. build files go.  Can accept default, override root
    //                              w/ buildRootFolder, or specify explicitly here.
    //  outputFolder: string        Where the resultant bundled .js file is saved. Typical override: "/dist"
    //  generateTyping: boolean     Set to true to generate .d.ts file and save to <project.outputFolder>/typings
    //  [debug|min|typing]BundleFilename: string      Names of output bundle files (if bundled)
    //
    // Structure of bundleProjectsTogether:
    //  outputFolder: string        Where to place the bundled file
    //  [debug|min]Filename: string Name of the bundled files                
    //  generateTyping: false       whether or not go generate a d.ts file for the bundle
    //
    // default values:
    //      project.buildRootFolder: "/bld"             
    //      project.buildFolder: buildRootFolder/project.path  
    //      project.outputFolder: <project.path>        
    //      project.generateTyping: false                
    //      project.debugBundleFilename: <project.name>-bundle-debug.js
    //      project.minBundleFilename: <project.name>-bundle-min.js
    //      project.typingBundleFilename: <project.name>-bundle.d.ts
    //
    //      Built js files are placed in /bld/projectPath                 
    //          OVERRIDE: project.buildRootFolder: string                      
    //      The bundle is output to the source folder                     
    //          OVERRIDE: project.outputFolder: string                         
    //      The bundle is named <project-name>-bundle-[debug|min].js     
    //          OVERRIDE: [debug|min|typing]BundleFilename: string              
    //      d.ts files are not generated by default                      
    //          OVERRIDE: project.generateTyping: true                          
    //
    // =============================================================================================================
    // ======= BUNDLES =============================================================================================
    //
    // A bundle is a file which combines all of the output files into one file that can be included by an app by
    // itself.  This typically is useful for reducing the number of scripts that have to be referenced in an HTML
    // file, and for reducing network load (i.e. loading one file instead of N files).
    //
    //  Built js files are ALWAYS bundled into one file to simplify build process.
    //
    // ==== Project Bundles
    // A Project Bundle is a bundle that is specific to a single Project; e.g. an app that wants to have its
    // output files concat'ed into one so that it only has to reference one file in the HTML.
    // 
    // ==== ProjectGroup bundles
    // It's also possible to define a bundle to be built from all of the projects in a projectgroup.
    // By default, all projects within a ProjectGroup are not bundled together.  You can effect that by settings                                 
    // projectGroup.bundleProjectsTogether (defined above)

    // ==== Aggregate Bundles
    // An Aggregate Bundle is a bundle that combines multiple ProjectGroups' output files into one bundled file. e.g. the
    // 'duality' bundle combines both the 'editor' Project and several 'built-in plugin' projects into a single bundled output.
    // Since Aggregate bundles span multiple projects, they need to be declared in buildConfig.aggregateBundles
    // and then referenced in the Project definitions themselves.
    // 


    // Define the Aggregate bundles.  Project bundles are defined in the actual Project definition itself.
    buildConfig.aggregateBundles = {
        // This is the main bundle for the duality project; it'll include editor and built-in plugins.  Inclusion
        // in an aggregate bundle is specified at the point of project declaration below (e.g. in buildConfig.editor)
        duality: {

            // will be saved to /dist by default, so no need to set outputFolder

            // Generate d.ts file by combining all generated d.ts files from projects in this aggregate bundle
            generateCombinedTyping: true,

            // Base name of the bundle.  We're specifying version in this bundle, so output names will be:
            // duality-<version>.[debug|min].js
            name: "duality",

            // Version of the bundle.  Gets added to output name; e.g. duality-0.0.1.debug.js
            // !!Be Aware!!  If you change this and build, then previously built bundles won't be removed and
            // you'll get 'duplicate definition' errors, because both old and new bundles exist.  To fix, delete the
            // old ones.
            version: "0.0.2",
        }

        // You could add other aggregate bundles here as well...
    }

    // finish initializing aggregate bundles.  need to do before initalizing buildConfig.projectgroups since
    // they may refer to it.
    bundleUtil.finishInitializingBundles(buildConfig);

    // =============================================================================================================
    // ======= PROJECTS ============================================================================================        
    buildConfig.projectGroups = {};

    // Defines the main editor project group
    buildConfig.projectGroups.editor = {

        projects: {
            editor: {
                // Name of the project.  Used in generating filenames.  If unspecified, uses the containing object name.
                name: "editor",

                // Root folder of the project
                path: "editor",

                // Add this project's compiled files to the duality bundle
                aggregateBundle: buildConfig.aggregateBundles.duality,

                // By not specifying files, "**/*.ts" is used by default

                // generate a d.ts file for this project
                generateTyping: true
            }
        }
    };

    // Defines all of the plugins that are built
    buildConfig.projectGroups.plugins = {

        // All projects in this group have these files copied into their sample folders.  Built files from
        // previous projects in this build env typically go here.
        filesToPrecopyToAllProjects: [{
            src: bu.joinPath(".", buildSettings.bldPath, "editor/typings/editor.d.ts"),
            dest: "typings"
        }],

        // project overrides that are applied to all projects in this projectGroup
        projectDefaults: {
            // plugins are used by other projects, so generate d.ts files
            generateTyping: true,

            // Specify the aggregate bundle into which the projects in this ProjectGroup should by-default be included
            // We override this in non-built-in plugins below to not include them in the aggregate bundle.  We can also
            // flip the logic and not specify an aggregate bundle at the projectgroup level but then specify for the
            // built-in plugins.  Either way works; depends on which will be more common (in this case, built-in is
            // more common so we do it at the projectgroup level).
            aggregateBundle: buildConfig.aggregateBundles.duality,

            // plugins are used by other projects, but built-in plugins will get aggregated into the distributed
            // bundle, so no need to output them to /dist.  non-built-in plugins will however need to set this

            // All other project defaults are fine for this projectgroup's Projects
        },

        // Optionally specify the root folder for all projects in this projectgroup.  note that this value doesn't
        // impact other projectgroup-level paths (e.g. in filesToPrecopyOnce, which remains rooted in build env root)
        projectRootFolder: "plugins",

        projects: {
            // all of the built-in projects in this project group are fine with the projectDefaults specified above
            debugDualityPlugin: {
                path: "duality/debugDualityPlugin",
            },
            debugDuality2: {
                path: "duality/debugPlugin2",
            },
            threeJS: {
                path: "threeJS",

                // This isn't a built-in plugin, so override the projectgroup's aggregateBundle value to stop from
                // being included in the 'duality-bundle.js' aggregate bundle.
                aggregateBundle: null,

                // This isn't a built-in plugin, but it is distributable, so output to /dist
                outputFolder: buildSettings.distPath
            }
        }
    };

    // Defines all of the tests that are built
    buildConfig.projectGroups.tests = {

        // All projects in the 'tests' ProjectGroup use the same config file, so specify it here
        tsConfigFile: "tests/tsconfig.json",

        // All projects in this ProjectGroup include in compilation the d.ts files found in /tests/typings
        commonFiles: ["tests/typings/*.d.ts"],

        // All projects in this ProjectGroup use the same duality*.d.ts file, so copy it into /tests/typings
        filesToPrecopyOnce: [{
            src: bu.joinPath(buildSettings.distPath, "typings", buildConfig.aggregateBundles.duality.typingFilename),
            dest: "tests/typings"
        }],

        // we opt to combine all tests into a single bundle so that they can be loaded with minimal network load.
        bundleProjectsTogether: {
            outputFolder: "tests",
            debugFilename: "all-bundled-tests-debug.spec.js",
            minFilename: "all-bundled-tests-min.spec.js",
            // we don't generate typings for tests, so the default value for generateTyping (false) is fine and
            // we don't need to specify typingFilename
        },

        // files to clean at the projectgroup level. NOTE: path is relative to root; unlike filesToClean in projects,
        // where they are relative to project root
        filesToClean: ["tests/all-bundled-tests*.js*"],

        // Optionally specify the root folder for all projects in this projectgroup.  note that this value doesn't
        // impact other projectgroup-level paths (e.g. in filesToPrecopyOnce, which remains rooted in build env root)
        projectRootFolder: "tests",

        projects: {
            test1: {
                path: "test1",
            },
            test2: {
                path: "test2",
            }
        }
    };

    // Defines all of the samples that are built
    buildConfig.projectGroups.samples = {

        // All projects in this group have these files copied into their sample folders.  Built files typically go here.
        filesToPrecopyToAllProjects: [{
            src: bu.joinPath(buildSettings.distPath, "typings", buildConfig.aggregateBundles.duality.typingFilename),
            dest: "typings"
        }],

        // project overrides that are applied to all projects in this projectGroup
        projectDefaults: { 
            // Because I want samples to be more 'standalone', built output goes into the sample folder
            buildRootFolder: "."
        },

        projects: {
            testApp: {
                path: "samples/testApp",
            },
            testApp2: {
                path: "samples/testApp2",

                // This test uses the threeJS plugin that we build, so add a dependsOn reference so that the plugin's
                // built .js and .d.ts files get copied over to this project's folder
                dependsOn: [buildConfig.projectGroups.plugins.projects.threeJS],

                // Add testJS.js to the bundle so that it doesn't have to be explicitly included by index.html
                extraFilesToBundle: ["testJS.js"],

                // This sample has javascript files in it that already exist, so we can't simply clean '**/*.js' - 
                // specify the set of filesToClean.
                filesToClean: ["testApp2*.js", "testApp2plugin/*.js", "lib/threeJS*"],
            }
        }
    }

    // Main build function; builds editor, plugins, tests, and samples; also bundles editor and plugins into duality*.js
    // NOTE: This is here because I want gulpfile.js to be project-indepedent, but build order is specified to the project;
    // e.g. the serialization and parallelization reflected in the following function.  I could create a definition language
    // for ordering, but that feels like overkill.  So: I'm left with this admittedly wonky solution of dropping the
    // build function into the config file.  Problem solved, but not prettily...
    //
    // NOTE: This is only required if you have more complex projects to build.  Otherwise, just don't specify a buildAll
    // function, and gulpfile will simply build all projectgroups using basic dependency checking.
    //
    // And the hackery continues: I'm passing in buildProjectGroup and createBundle because they're defined in the main
    // gulpfile, and I haven't fully split things up.
    buildConfig.buildAll = function (buildProjectGroup, createBundle) {
        return bu.runSeries([
            // editor, plugins, and bundle must be built in order
            () => buildProjectGroup(buildConfig.projectGroups.editor),
            () => buildProjectGroup(buildConfig.projectGroups.plugins),
            () => createBundle(buildConfig.aggregateBundles.duality),

            // Tests and samples can be built in parallel
            () => bu.runParallel([
                () => buildProjectGroup(buildConfig.projectGroups.tests),
                () => buildProjectGroup(buildConfig.projectGroups.samples)
            ])
        ]);
    }

    // Return the constructed build configuration
    return buildConfig;
}

module.exports = initialize();