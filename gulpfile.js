"use strict";

// Load NPM modules
var del = require("del"),
    gulp = require("gulp");

// Load build support files
var bu = require("./gulpBuild/buildUtils"),
    buildSettings = require("./gulpBuild/buildSettings");

// TODO NEXT:
// * Update readme.


// ************************************************************************************************
// ************************************************************************************************
// **                                                                                            **
// **      buildConfig.js is the only file that you should have to modify for your projects!     **
// **                                                                                            **
// ************************************************************************************************
// ************************************************************************************************

// Load the build configuration.  This defines the ProjectGroups and Projects which will be built
var buildConfig = require("./buildConfig");

// Comment out the above and use the following buildConfigs instead to play with other buildConfigs
// NOTE: Building these does not result in executable apps (e.g. no index.html); they instead show build process.
// var buildConfig = require("./moreExampleBuildEnvs/simpleApp/buildConfig");
// var buildConfig = require("./moreExampleBuildEnvs/simpleLibraryAndApp/buildConfig");
// var buildConfig = require("./moreExampleBuildEnvs/programmaticBuildConfig/buildConfig");
// var buildConfig = require("./moreExampleBuildEnvs/simpleAggregateBundle/buildConfig");

// Finish initializing the build configuration by populating default ProjectGroup and Project values.
bu.finishInitializingProjects(buildConfig);


// Used to store global info
var globals = {};


// ====================================================================================================================
// ======= CLEAN ======================================================================================================

function clean() {
    var taskTracker = new bu.TaskTracker("clean");

    // Create list of files to delete.  Start with files that apply across all apps
    var filesToDelete = [
        // Delete /dist and /bld entirely
        bu.joinPath(".", buildSettings.bldPath),
        bu.joinPath(".", buildSettings.distPath),

        // Delete all sourcemaps, everywhere
        "**/*.js.map",
    ];

    // Delete any previously built bundle.d.ts files that were placed into app folders.  Edge case: If you've changed
    // the list of bundles in buildConfig.aggregateBundles, then this won't clean up the detritus of any removed ones.
    for (var bundle in buildConfig.aggregateBundles)
        filesToDelete.push("**/typings/" + buildConfig.aggregateBundles[bundle].typingFilename);

    // Only projects know what should be deleted within them.  In a lot of cases, that can be **/*.js (e.g. in tests)
    // but in other cases it can't be - e.g. samples which have js in them.  So: each project has two choices:
    //  define 'filesToClean:string[] to be an array of globs to delete (in addition to the ones in filesToDeletea above)
    //  don't define filesToClean, in which case it defaults to **/*.js,
    for (var projectGroupId in buildConfig.projectGroups) {
        var projectGroup = buildConfig.projectGroups[projectGroupId];

        // delete filesToClean in this projectgroup
        if (projectGroup.filesToClean) {
            for (var fileToClean of projectGroup.filesToClean)
                filesToDelete.push(fileToClean)
        }

        // delete filesToClean in this projectgroup's Projects
        for (var projectId in projectGroup.projects) {
            var project = projectGroup.projects[projectId];
            if (project.filesToClean) {
                for (var fileToClean of project.filesToClean)
                    filesToDelete.push(bu.joinPath(project.path, fileToClean));
            } else {
                // delete generated bundle files
                filesToDelete.push(bu.joinPath(project.path, project.debugBundleFilename));
                filesToDelete.push(bu.joinPath(project.path, project.minBundleFilename));
                filesToDelete.push(bu.joinPath(project.path, "typings", project.typingBundleFilename));
            }
        }
    }

    // Perform the actual deletion
    return del(filesToDelete).then(() => taskTracker.end());
}


// ====================================================================================================================
// ======= ROOT TASKS =================================================================================================

// Does a complete rebuild
gulp.task("rebuild-all", function () {
    if (bu.forceSerializedTasks)
        bu.log("== Forcing serialized tasks ==");

    // Don't do an incremental build
    bu.incrementalBuild = false;

    // Clean and then build.
    return bu.runSeries([
        () => clean(),
        () => bu.buildAll(buildConfig)
    ]);
});

// Builds everything (w/o cleaning first)
gulp.task("build-all", function () {
    if (globals.isFirstBuild) {
        bu.log("== First build; complete build will be performed ==");
        globals.isFirstBuild = false;
    }

    if (bu.forceSerializedTasks)
        bu.log("== Forcing serialized tasks ==");

    // Do an incremental build at the project-level
    bu.incrementalBuild = true;

    return bu.buildAll();
});

// Watches; also enables incremental builds.  You can just run this task and let it handle things
// It does do a build-on-save which isn't exactly what I wanted to enable here (I'd prefer in this task to just track
// dirty files and pass that list on to build-all when a build task is started).  Should work as-is though.
// NOTE: buildConfig.settings.incrementalBuild enables project-level incremental builds; it skips entire projects if nothing in
// them has changed
gulp.task('watch', function () {
    // Since this is always running, limit output to errors
    // bu.verboseOutput = false;

    // Because we don't maintain information about files between Task runs, our modifiedCache is always empty
    // at the start, and thus we'll rebuild everything.  Track that it's the first build so that we can output it.
    globals.isFirstBuild = true;

    // Watch for changes to ts files; when they occur, run the 'build-all' task
    gulp.watch([
        "**/*.ts",
        "!**/*.d.ts",
        "!dist",
        "!bld"
    ], ["build-all"])
});