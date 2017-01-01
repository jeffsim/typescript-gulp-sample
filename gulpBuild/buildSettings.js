
var buildSettings = {
    // Dump extra output during the build process
    verboseOutput: true,

    // Set this to enable compile-time debug checking; e.g. for unexpected situations like missing tsconfig.json file
    debug: true,
    debugSettings: {
        // By default, if a project has no transpiled files in it then we assume error in path.  You can disable that 
        // error by enabling allowEmptyFolders
        // allowEmptyFolders: true

        // By default, if it's a debug build then we propose disabling debug once the build env is stable for perf
        // reasons.  If you want perma-debug builds, then you can disable that warning by setting this to false.
        warnIfDebugBuild: true,
    },

    // Minified builds can strip debug checks from output js for perf.  To indicate that a block should be stripped,
    // surround it with the following strings.  grep on DEBUGSTART in this project to see an example
    // These strings are case insensitive; e.g. "// deBUGstart" would match.
    debugBlockStartText: "// DEBUGSTART",
    debugBlockEndText: "// DEBUGEND",

    // If true, then don't parallelize tasks.  Not something you would usually set; mostly just useful if you
    // are having build issues and want cleaner output.
    forceSerializedTasks: false,

    // Set to true to enable project-level incremental builds.  File-level incremental builds are handled by a
    // persistent 'watch' task, as TSC needs all files in order to compile properly.  Using gulp.watch maintains some state to
    // reduce compilation time (about 10% in this sample on this machine.  I suspect a 'real' project with more files
    // to compile would see more improvement).
    incrementalBuild: true,

    // By default, an incremental build would rebuild if *any* file in a project changes, including d.ts files.
    // However, you can skip recompilation of a project if *only* dependencies (e.g. d.ts files) have changed.
    // This field manages that; when false, it says to NOT recompile if only dependencies have changed.  If you're
    // seeing weird incremental build behavior then try setting this to true, and let me know
    recompiledOnDTSChanges: false,

    // Defines the folder into which distributable files should be placed.  By default == "./dist"
    distPath: "./dist",

    // Defines the folder into which temporary built files are placed.  By default == "./bld"
    bldPath: "./bld",

    // string to add to the name of generated bundle files.  e.g. "-bundle" would result in something like duality-bundle-debug.js.
    // I'm opting for no suffix.  If you need one (e.g. it generates name conflicts somehow), then change it here
    bundleSuffix: "",
};

module.exports = buildSettings;