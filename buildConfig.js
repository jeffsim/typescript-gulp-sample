var bu = require("./buildUtils");

var buildConfig = {
    // Bundle definition.
    // NOTE: A build configuration can only have one bundle (for now).
    // TODO: Generalize definition of bundles and allow none or multiple.  replace "includeInBundle:true" with
    //       "includeInBundle:<bundleName>"
    bundle: {
        baseName: "duality",
        version: "0.0.1",

        // For the first build, bundle.modifiedBundleCache is empty.  This will force a build of all files the first time
        // a build is run; but that's unavoidable as we have no idea if the files have changed...
        modifiedBundleCache: {}
    }
}

// Generate file output file names; these include version stamp; e.g. 'duality-0.1.1.debug.js'
var bundleNameVer = buildConfig.bundle.baseName + "-" + buildConfig.bundle.version;
buildConfig.bundle.debugFilename = bundleNameVer + ".debug.js";
buildConfig.bundle.minFilename = bundleNameVer + ".min.js";
buildConfig.bundle.typingFilename = bundleNameVer + ".d.ts";

// ====================================================================================================================
// ======= PROJECTS ===================================================================================================
// Editor, Plugins, Tests, and Samples are all defined using a common project format so that they can be handled
// generically.  All projects must have at minimum: name:string, path:string, and files:string[]

// editor, plugins, tests, and samples are all examples of ProjectGroups.  Here's the structure of ProjectGroup:
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

buildConfig.projectGroups = {
    // Defines the main editor project group
    editor: {
        name: "Editor",
        isLibrary: true,
        projects: [{
            name: "editor",
            path: "editor",
            includeInBundle: true
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
            includeInBundle: true,
        }, {
            name: "debugDuality2",
            path: "plugins/duality/debugPlugin2",
            includeInBundle: true,
        }, {
            name: "threejs",
            path: "plugins/threeJS",
            includeInBundle: false,
        }]
    },

    // Defines all of the tests that are built
    tests: {
        name: "Tests",
        isLibrary: false,
        tsConfigFile: "tests/tsconfig.json",
        commonFiles: ["tests/typings/*.d.ts"],
        filesToPrecopyOnce: [{ src: "dist/typings/" + buildConfig.bundle.typingFilename, dest: "tests/typings" }],
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
        filesToPrecopyToAllProjects: [{ src: "dist/typings/" + buildConfig.bundle.typingFilename, dest: "typings" }],
        projects: [{
            name: "testApp",
            path: "samples/testApp",
            filesToClean: ["testApp.js"]
        }, {
            name: "testApp2",
            path: "samples/testApp2",
            filesToPrecopy: [
                // This test uses the threeJS plugin that we build, so copy the .js into ./lib and the d.ts into ./typings
                { src: "dist/typings/threejs.d.ts", dest: "typings" },
                { src: "dist/plugins/threeJS/*", dest: "lib" }],
            filesToClean: ["testApp2.js"]
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
        () => createBundle(),

        // tests and samples can be built in parallel
        () => bu.runParallel([
            () => buildProjectGroup(buildConfig.projectGroups.tests),
            () => buildProjectGroup(buildConfig.projectGroups.samples)
        ])
    ]);
}

// Export the config
module.exports = buildConfig;