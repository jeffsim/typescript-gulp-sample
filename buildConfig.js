var bu = require("./buildUtils");

module.exports = {
    initialize: function () {
        var buildConfig = {};

        // =============================================================================================================
        // ======= BUNDLES =============================================================================================
        // A bundle is typically the final output file from a project like jquery or duality; it's a file that concats
        // all of the transpiled javascript files into one file that can be included by an app.
        //
        // To create and use a bundle, simply specify it in the bundles object below, and then reference it using the
        // 'includeInBundle' field in your project.  See examples below.
        //
        // Bundles typically include a version in their name, specified here with the 'version' field below.
        //
        // This build environment outputs two files; one full one and one minified/uglifed one.  They are suffixed with
        // ".debug.js" and ".min.js" respectively.
        //
        // TODO: Support App bundles.  Not strictly necessary, but useful if you want to reduce the number of files fed
        // down across the network.  Once supported, make one of the samples bundled, and add a comment here like this:
        //      Although bundles are typically associated with libraries, nothing stops you from using a bundle to combine
        //      all of the output of an app.  This example build configuration opts not to do that, but to do so, just
        //      create a bundle in buildConfig.bundles, and then reference it in your app's project definition below.
        // 
        buildConfig.bundles = {
            duality: {
                name: "duality",
                version: "0.0.1"
            },
            
            /* TODO: Commented out until I add app bundles
            testAppBundle: {
                name: "testApp",
                version: "0.3"
            }
            */
        }

        // Generate bundled file output file names; these include version stamp; e.g. 'duality-0.1.1.debug.js'
        for (var bundleName in buildConfig.bundles) {
            var bundle = buildConfig.bundles[bundleName];
            var bundleNameVer = bundle.name + "-" + bundle.version;
            bundle.debugFilename = bundleNameVer + ".debug.js";
            bundle.minFilename = bundleNameVer + ".min.js";
            bundle.typingFilename = bundleNameVer + ".d.ts";
        }

        // =============================================================================================================
        // ======= PROJECTS ============================================================================================
        // Here's the structure of ProjectGroup:
        //
        //  name:string                 Name of the project group; output in the task header during build process.
        //  isLibrary:bool              If true, then output is a library; otherwise it's an app.  editor and plugins are
        //                              libraries and tests and samples are apps.  See buildAppProject and buildLibProject for
        //                              differences.
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
        //  projects:Project[]          List of Projects within the ProjectGroup.
        //
        // Structure of Project object:
        //  name: string                Name of the Project
        //  path: string                Path of the Project relative to root
        //  files: string[]             List of files to compile; relative to project path.
        //                              If unspecified, defaults to '["**/*.ts"]', which == all TS files in the project folder.
        //  filesToClean?: string[]     List of file (globs) to delete when running clean task.  If unspecified, defaults to
        //                              '**/*.js' (ie all transpiled files).  If a project doesn't have pre-existing js files
        //                              then the default is normally fine.  Note that these files are in addition to a set
        //                              of always-deleted files (e.g. **/*.map).  See function clean() for details.
        //  includeInBundle:<bundle>    If specified, defines the final output bundle file into which the Project should be
        //                              included.  Only applies to Library projects.
        buildConfig.projectGroups = {
            // Defines the main editor project group
            editor: {
                name: "Editor",
                isLibrary: true,
                projects: [{
                    name: "editor",
                    path: "editor",
                    includeInBundle: buildConfig.bundles.duality
                }]
            },

            // Defines all of the plugins that are built
            plugins: {
                name: "Plugins",
                isLibrary: true,
                // All projects in this group have these files copied into their sample folders.  Built files typically go here.
                filesToPrecopyToAllProjects: [{ src: "dist/typings/editor.d.ts", dest: "typings" }],
                projects: [{
                    name: "debugDualityPlugin",
                    path: "plugins/duality/debugDualityPlugin",
                    includeInBundle: buildConfig.bundles.duality
                }, {
                    name: "debugDuality2",
                    path: "plugins/duality/debugPlugin2",
                    includeInBundle: buildConfig.bundles.duality
                }, {
                    name: "threejs",
                    path: "plugins/threeJS",
                    // NOTE: includeInBundle not specified; this is therefore not a 'built-in' plugin and will be standalone
                }]
            },

            // Defines all of the tests that are built
            tests: {
                name: "Tests",
                isLibrary: false,
                tsConfigFile: "tests/tsconfig.json",
                commonFiles: ["tests/typings/*.d.ts"],
                filesToPrecopyOnce: [{ src: "dist/typings/" + buildConfig.bundles.duality.typingFilename, dest: "tests/typings" }],
                projects: [{
                    name: "test1",
                    path: "tests/test1",
                }, {
                    name: "test2",
                    path: "tests/test2",
                }]
            },

            // Defines all of the samples that are built
            samples: {
                name: "Samples",
                isLibrary: false,
                // All projects in this group have these files copied into their sample folders.  Built files typically go here.
                filesToPrecopyToAllProjects: [{ src: "dist/typings/" + buildConfig.bundles.duality.typingFilename, dest: "typings" }],
                projects: [{
                    name: "testApp",
                    path: "samples/testApp",
                }, {
                    name: "testApp2",
                    path: "samples/testApp2",
                    filesToPrecopy: [
                        // This test uses the threeJS plugin that we build, so copy the .js into ./lib and the d.ts into ./typings
                        { src: "dist/typings/threejs.d.ts", dest: "typings" },
                        { src: "dist/plugins/threeJS/*", dest: "lib" }],

                    // This sample has javascript files in it pre-building, so we can't simply clean '**/*.js' - specify
                    // the set of filesToClean.
                    filesToClean: ["testApp2.js"],

                    // Specify a single bundle file to which this app's output files are concat'ed
                    // TODO: Commented out until I've added app Bundles
                    // includeInBundle: buildConfig.bundles.testAppBundle
                }]
            }
        };

        // NOTE: Settings are dropped into global so that buildUtils can see them.
        global.settings = {
            // Dump extra output during the build process
            verboseOutput: true,

            // If true, then don't parallelize tasks.  Not something you would usually set; mostly just useful if you
            // are having build issues and want cleaner output.
            forceSerializedTasks: false,

            // Set to true to enable project-level incremental builds.  File-level incremental builds are handled by a
            // persistent 'watch' task, as TSC needs all files to compile properly.  Using gulp.watch maintains some state to
            // reduce compilation time (about 10% in this sample on this machine.  I suspect a 'real' project with more files
            // to compile would see more improvement).
            // Another option is to use isolatedModules:true in tsconfig, but that requires external modules which this
            // sample doesn't use.  Leaving these in now though as someday (looks wistfully into the distance) this may work
            // Ref:
            //  https://github.com/ivogabe/gulp-typescript/issues/228
            //  https://github.com/mgechev/angular-seed/wiki/Speeding-the-build-up
            incrementalBuild: true,

            // By default, an incremental build would rebuild if *any* file in a project changes, including d.ts files.
            // However, I think that you can skip recompilation of a project if only d.ts files have changed.  This field
            // manages that.  If you're seeing weird incremental build behavior then try setting this to true, and let me know
            recompiledOnDTSChanges: false
        };

        // Main build function; builds editor, plugins, tests, and samples; also bundles editor and plugins into duality*.js
        // NOTE: This is here because I want gulpfile.js to be project-indepedent, but build order is specified to the project;
        // e.g. the serialization and parallelization reflected in the following function.  I could create a definition language
        // for ordering, but that feels like overkill.  So: I'm left with this admittedly wonky solution of dropping the
        // build function into the config file.  Problem solved, but not prettily...
        //
        // And the hackery continues: I'm passing in buildProjectGroup and createBundle because they're defined in the main
        // gulpfile, and I haven't fully split things up.
        buildConfig.buildAll = function (buildProjectGroup, createBundle) {
            return bu.runSeries([
                // editor, plugins, and bundle must be built in order
                () => buildProjectGroup(buildConfig.projectGroups.editor),
                () => buildProjectGroup(buildConfig.projectGroups.plugins),
                () => createBundle(buildConfig.bundles.duality),

                // tests and samples can be built in parallel
                () => bu.runParallel([
                    () => buildProjectGroup(buildConfig.projectGroups.tests),
                    () => buildProjectGroup(buildConfig.projectGroups.samples)
                ]),

                // TODO: Commented out until I add app bundles
                // TODO: I'd like for this to be specified in the project, not here.
                // () => createBundle(buildConfig.bundles.testAppBundle),
            ]);
        }

        // Return the constructed build configuration
        return buildConfig;
    }
}