
var buildSettings = {
    // Dump extra output during the build process
    verboseOutput: true,

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
    // NOTE: Don't use something like "/dist" as that'll go to the root of your HDD
    distPath: "./dist",

    // Defines the folder into which temporary built files are placed.  By default == "./bld"
    // NOTE: Don't use something like "/bld" as that'll go to the root of your HDD
    bldPath: "./bld",

    // string to add to the name of generated bundle files.  e.g. "-bundle" would result in something like duality-bundle-debug.js.
    // I'm opting for no suffix.  If you need one (e.g. it generates name conflicts somehow), then change it here
    bundleSuffix: "",
};

module.exports = buildSettings;