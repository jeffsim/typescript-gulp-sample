"use strict";

// Load NPM modules
var del = require("del"),
    gulp = require("gulp"),
    gulpWatch = require("gulp-watch");

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
// var buildConfig = require("./buildConfig");

// Comment out the above and use the following buildConfigs instead to play with other buildConfigs
// NOTE: Building these does not result in executable apps (e.g. no index.html); they instead show build process.
// var buildConfig = require("./moreExampleBuildEnvs/simpleApp/buildConfig");
// var buildConfig = require("./moreExampleBuildEnvs/simpleLibraryAndApp/buildConfig");
// var buildConfig = require("./moreExampleBuildEnvs/programmaticBuildConfig/buildConfig");
// var buildConfig = require("./moreExampleBuildEnvs/simpleAggregateBundle/buildConfig");
var buildConfig = require("./moreExampleBuildEnvs/externalModuleReferenceBundle/buildConfig");

// TODO: Create example build configuration that uses external modules and 'import' instead of '/// <ref...'
// var buildConfig = require("./moreExampleBuildEnvs/externalModuleImportBundle/buildConfig");

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

            // If a project dependsOn another, then we copied its js and d.ts files over (to ./lib and ./typing) - remove them
            if (project.dependsOn) {
                project.dependsOn.forEach((dependency) => {
                    // Get the list of files that were copied over from the dependent project into this project's ./lib
                    // folder and add them.  Include "*" to get .js.map as well
                    filesToDelete.push(bu.joinPath(project.path, "lib", dependency.debugBundleFilename + "*"));
                    filesToDelete.push(bu.joinPath(project.path, "lib", dependency.minBundleFilename + "*"));

                    // Add the dependent project's dts file (if any)
                    if (dependency.generateTyping)
                        filesToDelete.push(bu.joinPath(project.path, "typings", dependency.typingBundleFilename));
                });
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
    globals.isBuilding = true;
    if (bu.forceSerializedTasks)
        bu.log("== Forcing serialized tasks ==");

    // Don't do an incremental build
    bu.incrementalBuild = false;

    // Clean and then build.
    return bu.runSeries([
        () => clean(),
        () => buildAll()
    ]).on("end", () => onBuildCompleted());
});

// Builds everything (w/o cleaning first)
gulp.task("build-all", () => buildAll());

function buildAll() {
    // Initialize the build process; clear previous errors, etc
    bu.initialize();

    globals.isBuilding = true;
    if (globals.isFirstBuild) {
        bu.log("== First build; complete build will be performed ==");
        globals.isFirstBuild = false;
    }

    if (bu.forceSerializedTasks)
        bu.log("== Forcing serialized tasks ==");

    // Do an incremental build at the project-level
    bu.incrementalBuild = true;

    return bu.buildAll(buildConfig).on("end", () => onBuildCompleted());
}

// Called when build-all or rebuild-all are finished; checks if any files changed during build and triggers
// a new build-all if so.
function onBuildCompleted() {
    globals.isBuilding = false;
    if (bu.buildCancelled)
        console.log(bu.getTimeString(new Date()) + " Build cancelled");
    else if (bu.numCompileErrors > 0) {
        console.log(bu.getTimeString(new Date()) + " Build completed, but with " + bu.numCompileErrors + " errors");
        console.log(bu.errorList);
    }
    if (globals.rebuildWhenDoneBuilding) {
        globals.rebuildWhenDoneBuilding = false;
        console.log(" ");
        console.log("----- Restarting build-all due to filechange during build");
        console.log(" ");
        return buildAll();
    }
}

// Watches; also enables incremental builds.
gulp.task('watch', function () {
    // Since this is always running, limit output to errors
    // buildSettings.verboseOutput = false;

    // Because we don't maintain information about files between Task runs, our modifiedCache is always empty
    // at the start, and thus we'll rebuild everything.  Track that it's the first build so that we can output it.
    globals.isFirstBuild = true;

    // Watch for changes to .ts files; when they occur, run the 'build-all' task
    // NOTE: Using gulp-watch instead of gulp.watch, as I'm not getting an 'end' event from the latter.  I could be using it wrong...
    gulpWatch([
        "**/*.ts",
        "!**/*.d.ts",
        "!dist",
        "!bld"
    ], () => {
        // If this is the filechange that triggers the build, then start the build
        if (!globals.isBuilding)
            return buildAll();

        // If we've already previously triggered the need to rebuild during current build, then don't re-output that we'll rebuild
        if (globals.rebuildWhenDoneBuilding)
            return;

        // trigger a rebuild when done building
        console.log("- File changed while building; will restart build again when done.  Will attempt to cancel the rest of the current build...");
        globals.rebuildWhenDoneBuilding = true;

        // Try to cancel the current build.  It won't stop the current 'low-level' task, but can stop subsequent project builds...
        bu.buildCancelled = true;
    });

    // If build settings change then reload them
    gulp.watch(["gulpBuild/buildSettings.js"], ["load-build-settings"]);
});

gulp.task('load-build-settings', function () {
    // Reload our buildSettings.
    buildSettings = bu.requireUncached("./buildSettings");

    // Also update the version cached in buildUtils
    bu.updateBuildSettings(buildSettings);
});
