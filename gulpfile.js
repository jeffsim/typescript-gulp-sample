"use strict";

var concat = require("gulp-concat"),
    del = require("del"),
    dtsGenerator = require("dts-generator"),
    eventStream = require("event-stream"),
    fs = require("fs"),
    glob = require("glob"),
    gulp = require("gulp"),
    gulpIf = require("gulp-if"),
    rename = require("gulp-rename"),
    sourcemaps = require("gulp-sourcemaps"),
    through = require('through2'),
    tsc = require("gulp-typescript"),
    uglify = require("gulp-uglify");

// Load build support files
var bu = require("./gulpBuild/buildUtils"),
    buildSettings = require("./gulpBuild/buildSettings"),
    bundleUtil = require("./gulpBuild/buildBundleUtils");

// DONE:
// * Added simpleAggregateBundle samples
//
// TODO NEXT:
//
// TODO LATER:
// * Update readme.
// * Remove 'buildConfig, buildProjectGroup' from finishInitializingProjects args



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
var buildConfig = require("./moreExampleBuildEnvs/simpleAggregateBundle/buildConfig");

// Finish initializing the build configuration by populating default ProjectGroup and Project values.
bundleUtil.finishInitializingProjects(buildConfig, buildProjectGroup, createAggregateBundle);


// Used to store global info
var globals = {};


// ====================================================================================================================
// ======= PROJECT BUILD FUNCTIONS ====================================================================================

// For a single given project, build it, then minify it, and then generate a d.ts file for it (as needed)
function buildAndMinifyProject(project) {
    // Check for incremental build and nothing changed; if that's the case, then emit "no build needed" and skip it
    // Returns a stream object that can be returned directly.
    var skipStream = checkCanSkipBuildProject(project);
    if (skipStream)
        return skipStream;

    // Build the Project; then in parallel minify it and build d.ts file (as needed).
    return bu.runSeries([
        // First, build the project.  This transpiles .ts files into .js files and copies result to
        // folder specified in the project's buildConfig.
        () => buildProject(project),

        // Once the project has been built, we can in-parallel minify the built .js files and also
        // build d.ts files (as determined by the project's buildConfig)
        () => bu.runParallel([
            () => minifyProject(project),
            () => buildDefinitionFile(project)
        ])
    ]);
}

// Build a single project. Details:
//  TS files are transpiled into JS files
//  JS files are output to 'project.buildRootFolder'
//  Bundled file created if project.bundleFiles == true.
//      bundle name = project.[debug|min]BundleFilename
//      Bundle output to project.outputFolder
function buildProject(project) {
    var taskTracker = new TaskTracker("buildProject", project);
    var projectFolderName = bu.joinPath(project.path, "/");
    var ts = tsc.createProject(project.projectGroup.tsConfigFile || bu.joinPath(projectFolderName, "tsconfig.json"));

    // Create list of files to compile.  Combination of common files in the project group AND files in the project
    var filesToCompile = project.files.slice();
    if (project.projectGroup.commonFiles)
        for (var commonFile of project.projectGroup.commonFiles)
            filesToCompile.push(commonFile);

    if (project.extraFilesToBundle)
        for (var file of project.extraFilesToBundle) {
            // debugstart
            if (buildSettings.debug) {
                if (file.indexOf(".js") != -1 && !ts.options.allowJs)
                    throw Error("Including .js files via project.extraFilesToBundle requires that allowJs be set in the project's tsconfig.json");
            }
            // debugend
            filesToCompile.push(bu.joinPath(project.path, file));
        }

    // TODO (CLEANUP): is the base:"." necessary, or is that the default value already?
    return gulp.src(filesToCompile, { base: "." })

        // Initialize sourcemap generation
        .pipe(sourcemaps.init())

        // Do the actual transpilation from Typescript to Javascript.
        .pipe(ts())

        // We always bundle output for simplicity's sake, so combine all of the resultant javascript into a single file
        .pipe(concat(project.debugBundleFilename))

        // Write sourcemaps into the folder set by the following gulp.dest call
        .pipe(sourcemaps.write(".", { includeContent: false, sourceRoot: "/" }))

        // Copy built project output into project.buildFolder and, if outputFolder is specified, to project.outputFolder
        .pipe(gulp.dest(project.buildFolder))
        .pipe(gulp.dest(project.outputFolder))

        // Output end of task
        .on("end", () => taskTracker.end());
}

// Minifies a single Project.  Details:
//  Uses the Project's already-built files as source files
//  Generates "*-min.js" output files
function minifyProject(project) {
    var taskTracker = new TaskTracker("minifyProject", project);

    // Minify all the built bundle js files in the built folder
    return gulp.src([bu.joinPath(project.buildFolder, project.debugBundleFilename)], { base: project.buildFolder })

        // Initialize Sourcemap generation, telling it to load existing sourcemap (from the already-built *-debug.js file(s))
        .pipe(sourcemaps.init({ loadMaps: true }))

        // Strip //debugstart and //debugend and everything in between from -min builds.
        .pipe(bu.stripDebugStartEnd())

        // Rename output to project.minBundleFilename
        .pipe(rename(project.minBundleFilename))

        // Minify the project
        .pipe(uglify())

        // Write sourcemaps into the folder(s) set by the following gulp.dest call
        .pipe(sourcemaps.write(".", {
            includeContent: false, sourceRoot: "/",

            // The sourceRoot and sources' paths from the source files are getting flattened; vscode's chrome debugger
            // plugin doesn't like that, so forcibly remove the source root (a slash).
            mapSources: (path) => path.substr(1)
        }))

        // Copy built project output into project.buildFolder and, if outputFolder is specified, to project.outputFolder
        .pipe(gulp.dest(project.buildFolder))
        .pipe(gulp.dest(project.outputFolder))

        // Output end of task
        .on("end", () => taskTracker.end())
}

// Generates .d.ts definition file for a single project
function buildDefinitionFile(project) {

    // Only generate d.ts files if so desired
    if (!project.generateTyping)
        return bu.getCompletedStream();

    var taskTracker = new TaskTracker("buildLibDefinitionFile", project);

    var outputFile = bu.joinPath(project.buildFolder + "/typings", project.typingBundleFilename);
    var stream = through();
    dtsGenerator.default({
        name: project.name,
        project: project.path,
        rootDir: "./",
        exclude: ["./**/*.d.ts"],
        out: outputFile
    }).then(() => {
        stream.resume().end();
        taskTracker.end();
    });
    return stream;
}


// ====================================================================================================================
// ======= BUILD BUNDLE ===============================================================================================

function createAggregateBundle(bundle) {

    outputTaskHeader("Build Bundle");

    // If none of the files that we're going to bundle have changed then don't build bundle.
    // Returns a stream object that can be returned directly.
    var skipStream = checkCanSkipBuildBundle(bundle);
    if (skipStream)
        return skipStream;

    var stream = through();
    // First build the "bundle-debug.js" file
    // once bundle-debug.js is built, we can in parallel built bundle-min.js from it AND bundle.d.ts.
    buildAggregateBundledJS(bundle).on("end", () => {
        bu.runParallel([
            () => minifyAggregateBundledJS(bundle),
            () => buildAggregateBundledDTS(bundle)
        ]).on("end", () => stream.resume().end());
    });
    return stream;
}

function buildAggregateBundledJS(bundle) {
    var sourceFiles = [];
    for (var projectGroup in buildConfig.projectGroups)
        for (var projectId in buildConfig.projectGroups[projectGroup].projects) {
            var project = buildConfig.projectGroups[projectGroup].projects[projectId];
            if (project.aggregateBundle == bundle)
                sourceFiles.push(bu.joinPath(project.buildFolder, project.debugBundleFilename));
        }
    return buildAggregateBundle(bundle, sourceFiles, false, "Build bundled JS", bundle.outputFolder);
}

function buildProjectGroupBundle(projectGroup) {
    var taskTracker = new TaskTracker("buildProjectGroupBundle (" + projectGroup.name + ")");
    if (!projectGroup.bundleProjectsTogether) {
        // project group not bundled together, so nothing to do here
        return bu.getCompletedStream();
    }

    // Create list of source files for bundle.js; it's the list of bundle files built for the projects in the project group
    var sourceFiles = [];
    for (var projectId in projectGroup.projects) {
        var project = projectGroup.projects[projectId];
        sourceFiles.push(project.buildFolder + "/" + project.debugBundleFilename);
    }

    return bu.runSeries([
        () => buildAggregateBundle(projectGroup.bundleProjectsTogether, sourceFiles, false, "Build project group bundle (" +
            projectGroup.name + ")", projectGroup.bundleProjectsTogether.outputFolder),
        () => buildAggregateBundle(projectGroup.bundleProjectsTogether, sourceFiles, true, "Build project group bundle (" +
            projectGroup.name + ")", projectGroup.bundleProjectsTogether.outputFolder),
        () => {
            if (!projectGroup.bundleProjectsTogether.generateTyping)
                return bu.getCompletedStream();

            // Create list of typing files we'll bundle
            var typingFiles = [];
            for (var projectId in projectGroup.projects) {
                var project = projectGroup.projects[projectId];
                if (project.generateTyping)
                    typingFiles.push(project.buildFolder + "/typings/" + project.typingBundleFilename);
            }

            return gulp.src(typingFiles)
                .pipe(concat(projectGroup.bundleProjectsTogether.typingFilename))
                .pipe(gulp.dest(bu.joinPath(".", buildSettings.distPath, "typings")))
                .on("end", () => taskTracker.end());
        }
    ]);
}

// Takes the pre-built bundle-debug.js file and bundle/minify it into bundle-min.js
function minifyAggregateBundledJS(bundle) {
    var debugSourceFilename = bu.joinPath(bundle.outputFolder, bundle.debugFilename);
    return buildAggregateBundle(bundle, [debugSourceFilename], true, "Minify bundled JS", bundle.outputFolder);
}

// This is passed in one or more already built files (with corresponding sourcemaps); it bundles them into just
// one file and minifies if so requested.
function buildAggregateBundle(bundle, sourceFiles, minify, taskName, destFolder) {
    var taskTracker = new TaskTracker(taskName);
    return gulp.src(sourceFiles)
        .pipe(sourcemaps.init({ loadMaps: true }))
        .pipe(gulpIf(!minify, concat(bundle.debugFilename)))
        .pipe(gulpIf(minify, rename(bundle.minFilename)))
        .pipe(gulpIf(minify, uglify()))
        .pipe(sourcemaps.write(".", {
            includeContent: false, sourceRoot: "/",

            // The sourceRoot and sources' paths from the source files are getting flattened; I need to maintain them
            // separately, so forcibly remove the source root (a slash).
            mapSources: (path) => path.substr(1)
        }))
        .pipe(gulp.dest(destFolder))
        .on("end", () => taskTracker.end());
}

// Combines already-built d.ts files that should be included in the passed-in bundle
function buildAggregateBundledDTS(bundle) {
    // If bundle doesn't have a typing file name defined, then don't build one.
    if (!bundle.typingFilename)
        return bu.getCompletedStream();

    var taskTracker = new TaskTracker("Build bundled DTS");
    var files = [];
    for (var projectGroup in buildConfig.projectGroups)
        for (var projectId in buildConfig.projectGroups[projectGroup].projects) {
            var project = buildConfig.projectGroups[projectGroup].projects[projectId];
            if (project.aggregateBundle == bundle)
                files.push(bu.joinPath(project.buildFolder + "/typings", project.name + ".d.ts"));
        }
    return gulp.src(files)
        .pipe(concat(bundle.typingFilename))
        .pipe(gulp.dest(bu.joinPath(".", buildSettings.distPath, "typings")))
        .on("end", () => taskTracker.end());
}


// ====================================================================================================================
// ======= CLEAN ======================================================================================================

function clean() {
    var taskTracker = new TaskTracker("clean");

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
                filesToDelete.push(bu.joinPath(project.path + "/typings", project.typingBundleFilename));
            }
        }
    }

    // Perform the actual deletion
    return del(filesToDelete).then(() => taskTracker.end());
}

// ====================================================================================================================
// ======= UTILTIES ===================================================================================================

// Copies any previously built files into the ProjectGroup's Projects.
function precopyRequiredFiles(projectGroup) {
    var taskTracker = new TaskTracker("precopyRequiredFiles");

    var buildActions = [];
    // Copy files that should be copied one time before a projectgroup is built; e.g. tests/typings/bundle.d.ts is
    // used by all tests and needs to be copied from dist first.
    if (projectGroup.filesToPrecopyOnce)
        for (var fileToCopy of projectGroup.filesToPrecopyOnce) {
            let file = fileToCopy; // closure
            buildActions.push(() => bu.copyFile(file.src, file.dest));
        }
    for (var projectId in projectGroup.projects) {
        var project = projectGroup.projects[projectId];

        // Copy files that should be copied to every project in the entire project group
        if (projectGroup.filesToPrecopyToAllProjects)
            for (var fileToCopy of projectGroup.filesToPrecopyToAllProjects) {
                let file = fileToCopy, p = project; // closure
                buildActions.push(() => bu.copyFile(file.src, bu.joinPath(p.path, file.dest)));
            }

        // Copy any files that this project needs
        if (project.filesToPrecopy)
            for (var fileToCopy of project.filesToPrecopy) {
                let file = fileToCopy, p = project; // closure
                buildActions.push(() => bu.copyFile(file.src, bu.joinPath(p.path, file.dest)));
            }

        // Copy any dependent projects
        if (project.dependsOn)
            for (var dependentProject of project.dependsOn) {
                var libSrc = bu.joinPath(dependentProject.buildFolder, "**/*.js")
                var libDest = bu.joinPath(project.path, "lib");
                var typingSrc = bu.joinPath(dependentProject.buildFolder, "typings/*.d.ts")
                var typingDest = bu.joinPath(project.path, "typings");
                buildActions.push(() => bu.copyFile(libSrc, libDest));
                buildActions.push(() => bu.copyFile(typingSrc, typingDest));
            }
    }
    return bu.runParallel(buildActions).on("end", () => taskTracker.end());
}

// Called at the start of a top-level Task.
function outputTaskHeader(taskName) {
    bu.log("===== " + taskName + " =======================================================");
}

// Outputs task start and end info to console, including task run time.
function TaskTracker(taskName, project) {
    if (buildSettings.verboseOutput) {
        var startTime = new Date();
        var startTimeStr = getTimeString(startTime);
        var outStr = startTimeStr + " Starting " + taskName;
        if (project)
            outStr += " (" + project.name + ")";
        bu.log(outStr);
    }

    return {
        end: function () {
            if (!buildSettings.verboseOutput)
                return;
            var endTime = new Date();
            var delta = (endTime - startTime) / 1000;
            var endTimeStr = getTimeString(endTime);
            if (project)
                bu.log(endTimeStr + " Finished " + taskName + " (" + project.name + ") after " + delta + " s");
            else
                bu.log(endTimeStr + " Finished " + taskName + " after " + delta + " s");
        }
    };
};

function getTimeString(time) {
    return "[" + time.toTimeString().replace(/.*(\d{2}:\d{2}:\d{2}).*/, "$1") + "]";
}


// ====================================================================================================================
// ======= INCREMENTAL BUILD SUPPORT ==================================================================================

// The Typescript compiler requires that all files be included, even those that haven't changed; therefore we can't 
// blindly use something like gulp-changed-in-place, which would just filter out unchanged files.  What we *can* do is:
//
//  1. Maintain an always-running 'watch' task which internally maintains some degree of state about a build and saves
//     some time when rebuilding (~15% in this project, presumably more in others).  This is what the 'watch' task does.
//  2. Maintain a *project-wide* modified state and skip building the entire project if nothing in the project has
//     changed.  That's what checkCanSkipBuildProject does.

// Checks if anything in the project has been modified and the project needs to be rebuilt; if so, returns null
// If the project can be skipped, then returns a stream that can be returned from the caller.
function checkCanSkipBuildProject(project) {

    // Check if incremental builds are enabled
    if (!buildSettings.incrementalBuild)
        return null;

    // If this is first build, then modifiedFilesCache is empty.  In that case, then create the modified file cache for
    // later comparison.  Continue so that we can populate the cache with first run values.
    project.modifiedFilesCache = project.modifiedFilesCache || {};

    // If here, then project has been previously built, and project.modifiedFilesCache contains info.  Compare against
    // current state; if ANY project file has changed, then rebuild.
    var fileHasChanged = false;

    // Generate list of files in the project that we should check
    var filesToCheck = [];
    var globFiles = [];
    project.files.forEach((fileGlob) => globFiles = globFiles.concat(glob.sync(fileGlob)));

    // If project doesn't have any .ts files (e.g. it only has .js) then nothing to compile.
    // Bit tricky here; project *could* have .d.ts files; if it only has those, then don't compile
    var hasFilesToCompile = false;
    for (var file of globFiles)
        if (file.indexOf(".ts") != -1 && file.indexOf(".d.ts") == -1) {
            hasFilesToCompile = true;
            break;
        }

    if (!hasFilesToCompile)
        bu.log(getTimeString(new Date()) + " -- SKIPPING (" + project.name + "): no files to compile");
    else {
        for (var projectFile of globFiles)
            filesToCheck.push(projectFile);
        var fileHasChanged = checkForChangedFile(filesToCheck, project.modifiedFilesCache);

        // If any files have changed then return null, signifying need to recompile Project
        if (fileHasChanged)
            return null;

        // If here, then no files in the project have changed; skip!
        bu.log(getTimeString(new Date()) + " -- SKIPPING (" + project.name + "): no files changed");
    }

    // Create an already-completed stream; caller will pass back up the chain
    return bu.getCompletedStream();
}

function checkCanSkipBuildBundle(bundle) {

    // Check if incremental builds are enabled
    if (!buildSettings.incrementalBuild)
        return null;

    // If here, then bundle has been previously built, and bundle.modifiedBundleCache contains info.  Compare against
    // current state; if ANY file has changed, then rebuild the bundle
    var filesToCheck = [];
    for (var projectGroup in buildConfig.projectGroups) {
        for (var projectId in buildConfig.projectGroups[projectGroup].projects) {
            var project = buildConfig.projectGroups[projectGroup].projects[projectId];
            if (project.aggregateBundle == bundle)
                filesToCheck.push(bu.joinPath(buildSettings.bldPath, project.path, project.name + "-debug.js"));
        }
    }
    var fileHasChanged = checkForChangedFile(filesToCheck, bundle.modifiedBundleCache);

    // If any files have changed then return null, signifying need to recreate the bundle
    if (fileHasChanged)
        return null;

    // If here, then no files that we'd bundle have changed; skip!
    bu.log(getTimeString(new Date()) + " -- SKIPPING BUNDLE: no files changed");

    // Create an already-completed stream; caller will pass back up the chain
    return bu.getCompletedStream();
}

function checkForChangedFile(filesToCheck, modifiedCache) {
    var fileHasChanged = false;

    for (var file of filesToCheck) {
        var stat = fs.statSync(file);
        var lastModifiedTime = stat.mtime.valueOf();
        var lastSeenModifiedTime = modifiedCache[file];
        if (lastModifiedTime != lastSeenModifiedTime) {
            // File has changed; track change.  Since we're going to rebuild, continue comparing 
            // file change times and updating the latest
            modifiedCache[file] = lastModifiedTime;

            // if recompiledOnDTSChanges is false, and the file is a d.ts file, then we do not trigger a recompilation.
            if (!buildSettings.recompiledOnDTSChanges && file.indexOf(".d.ts") > -1)
                continue;

            fileHasChanged = true;
        }
    }
    return fileHasChanged;
}

// ====================================================================================================================
// ======= ROOT TASKS =================================================================================================

// Builds a project group (e.g. editor, plugins, samples, or tests)
function buildProjectGroup(projectGroup) {
    outputTaskHeader("Build " + projectGroup.name);
    return bu.runSeries([
        () => precopyRequiredFiles(projectGroup),

        // Build all of the projects in the projectgroup
        () => buildProjects(projectGroup),

        // Then, if the ProjectGroup has specified that all projects within it should be bundled, create that bundle and 
        // copy it to the output folder defined in the projectgroup's buildConfig.
        () => buildProjectGroupBundle(projectGroup)
    ]);
}

// Build a collection of projects
function buildProjects(projectGroup) {
    var buildActions = [];
    for (var projectId in projectGroup.projects) {
        let p = projectGroup.projects[projectId]; // closure
        buildActions.push(() => buildAndMinifyProject(p));
    }
    return bu.runParallel(buildActions);
}

function buildAll(buildProjectGroup, createBundle) {
    // If buildConfig contains a custom buildAll then use it.  Used when a buildConfig does more complex building
    // If no custom buildAll then just build all of the ProjectGroups in order
    if (buildConfig.buildAll)
        return buildConfig.buildAll(buildProjectGroup, createAggregateBundle);
    else
        for (var projectGroup in buildConfig.projectGroups)
            buildProjectGroup(buildConfig.projectGroups[projectGroup]);
}

// Does a complete rebuild
gulp.task("rebuild-all", function () {
    if (buildSettings.forceSerializedTasks)
        bu.log("== Forcing serialized tasks ==");

    // Don't do an incremental build
    buildSettings.incrementalBuild = false;

    // Clean and then build.
    return bu.runSeries([
        () => clean(),

        // TODO (HACK/CLEANUP): don't pass these in ><.
        () => buildAll(buildProjectGroup, createAggregateBundle)
    ]);
});

// Builds everything (w/o cleaning first)
gulp.task("build-all", function () {
    if (globals.isFirstBuild) {
        bu.log("== First build; complete build will be performed ==");
        globals.isFirstBuild = false;
    }

    if (buildSettings.forceSerializedTasks)
        bu.log("== Forcing serialized tasks ==");

    // Do an incremental build at the project-level
    buildSettings.incrementalBuild = true;

    // TODO (HACK/CLEANUP): don't pass these in ><.
    return buildAll(buildProjectGroup, createAggregateBundle);
});

// Watches; also enables incremental builds.  You can just run this task and let it handle things
// It does do a build-on-save which isn't exactly what I wanted to enable here (I'd prefer in this task to just track
// dirty files and pass that list on to build-all when a build task is started).  Should work as-is though.
// NOTE: buildConfig.settings.incrementalBuild enables project-level incremental builds; it skips entire projects if nothing in
// them has changed
gulp.task('watch', function () {
    // Since this is always running, limit output to errors
    // buildSettings.verboseOutput = false;

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