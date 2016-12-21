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


// ====================================================================================================================
// Load the build configuration.  This defines the ProjectGroups and Projects which will be built, and also defines
// the primary 'buildAll' function (which needs to happen in the buildConfig file to allow it to define build order).
//
// ** buildConfig.js is the only file that you should have to modify for your projects! **
//
var buildConfig = require("./buildConfig");

// Include build utilities
var bu = require("./buildUtils");

// TODO: Update joinPath to use join-path-js.  Use it on line 245 & others.
// RELATED: I'm passing ("src", ["**\*.ts"]) instead of ("src", "**\.ts"). works, but needs to change if I want to use gulp-join-js
// TODO: I suspect I can use through2.obj() in places where I just need a stream to pass back?
// TODO: Make gulpfile watch itself.  https://codepen.io/ScavaJripter/post/how-to-watch-the-same-gulpfile-js-with-gulp
// TODO: bundle iscurrently required, and currently only supports 1.  need to generalize this.
// TODO: Outputting '/// reference' in duality.d.ts.

// Used to store global info
var globals = {};


// ====================================================================================================================
// ======= LIBRARY BUILD FUNCTIONS ====================================================================================

// For a single given library project, build it, then minify it, and then generate a d.ts file for it
function buildLibProject(project, projectGroup) {
    // Check for incremental build and nothing changed; if that's the case, then emit "no build needed" and skip it
    // Returns a stream object that can be returned directly.
    var skipStream = checkCanSkipBuildProject(project);
    if (skipStream)
        return skipStream;

    // Build the library; then in parallel minify it and build d.ts file.
    return bu.runSeries([
        () => buildLib(project, projectGroup),
        () => bu.runParallel([
            () => minifyLib(project),
            () => buildLibDefinitionFile(project)
        ])
    ]);
}

// Build a single library project
//      Transpiles TS into JS and flattens JS into single "*-debug.js" file.
//      Is included in the bundled output file if includeInBundle == true
//      Places flattened transpiled JS file in /dist folder
function buildLib(project, projectGroup) {
    var taskTracker = new TaskTracker("buildLib", project);
    var projectFolderName = bu.joinPath(project.path, "/");

    // Create list of files to compile.  Combination of common files in the project group AND files in the project
    var filesToCompile = [];
    if (projectGroup.commonFiles)
        for (var projectFile of projectGroup.commonFiles)
            filesToCompile.push(projectFile);

    // Rebase passed-in file names so that they are within the project folder
    var files = project.files || ["**/*.ts"];
    for (var projectFile of files)
        filesToCompile.push(projectFolderName + projectFile);
    var ts = tsc.createProject(bu.joinPath(project.path, "tsconfig.json"));

    // Start things up, passing in the files to compile.
    return gulp.src(filesToCompile, { base: "." })

        // Initialize sourcemap generation
        .pipe(sourcemaps.init())

        // Do the actual transpilation from Typescript to Javascript.
        .pipe(ts())

        // Combine all of the resultant javascript into a single file called <project.name>-debug.js
        .pipe(concat(project.name + "-debug.js"))

        // Write sourcemaps into the folder(s) set by the following gulp.dest calls
        .pipe(sourcemaps.write(".", { includeContent: false, sourceRoot: "/" }))

        // If the project isn't built-in, then it's distributable; copy minified version into dist/<project.path>
        .pipe(gulpIf(!project.includeInBundle, gulp.dest("dist/" + project.path)))

        // Copy built output into /bld/<project.path>
        .pipe(gulp.dest("bld/" + project.path))

        // Output end of task
        .on("end", () => taskTracker.end())
}

// Minifies a single Library project. Uses the library project's already-built "*-debug.js" as single source file
// Generates a single "*-min.js" output file.  Minifies it and places output in /dist
function minifyLib(project) {
    var taskTracker = new TaskTracker("minifyLib", project);

    // Start things up, passing in the previously built <project.name>-debug.js file in the bld folder
    return gulp.src(["bld/" + project.path + "/" + project.name + "-debug.js"], { base: "bld/" + project.path })

        // Initialize Sourcemap generation, telling it to load existing sourcemap (from the already-built *-debug.js)
        .pipe(sourcemaps.init({ loadMaps: true }))

        // We took in <project.name>-debug.js as source; rename output to <project-name>-min.js
        .pipe(rename(project.name + "-min.js"))

        // Minify the project
        .pipe(uglify())

        // Write sourcemaps into the folder(s) set by the following gulp.dest calls
        .pipe(sourcemaps.write(".", {
            includeContent: false, sourceRoot: "/",

            // The sourceRoot and sources' paths from the source files are getting flattened; vscode's chrome debugger
            // plugin doesn't like that, so forcibly remove the source root (a slash).
            mapSources: (path) => path.substr(1)
        }))

        // If the project isn't built-in, then it's distributable; copy minified version into dist/<project.path>
        .pipe(gulpIf(!project.includeInBundle, gulp.dest("dist/" + project.path)))

        // Copy built output into /bld/<project.path>
        .pipe(gulp.dest("bld/" + project.path))

        // Output end of task
        .on("end", () => taskTracker.end())
}

// Generates .d.ts definition file for a single Library project
// NOTE: 'declaration:true' in tsconfig.json doesn't support flattening into a single d.ts file, so using this instead.
// Ideally would use the built-in version, but can't yet.  See: https://github.com/Microsoft/TypeScript/issues/2568
function buildLibDefinitionFile(project) {
    var stream = through();
    var outputFile = (project.includeInBundle ? "bld" : "dist") + "/typings/" + project.name + ".d.ts"
    var taskTracker = new TaskTracker("buildLibDefinitionFile", project);
    dtsGenerator.default({
        name: project.name,
        project: project.path,
        rootDir: "./",
        exclude: ["./**/*.d.ts"],
        out: outputFile
    }).then(() => {
        taskTracker.end();
        stream.resume().end();
    });
    return stream;
}


// ====================================================================================================================
// ======= BUILD BUNDLE ===============================================================================================

function createBundle() {

    outputTaskHeader("Build Bundle");

    // If none of the files that we're going to bundle have changed then don't build bundle.
    // Returns a stream object that can be returned directly.
    var skipStream = checkCanSkipBuildBundle();
    if (skipStream)
        return skipStream;

    var stream = through();
    // First build the "bundle-debug.js" file
    // once bundle-debug.js is built, we can in parallel built bundle-min.js from it AND bundle.d.ts.
    buildBundledJS().on("end", () => {
        bu.runParallel([
            () => minifyBundledJS(),
            () => buildBundledDTS()])
            .on("end", () => stream.resume().end());
    });
    return stream;
}

function buildBundledJS() {
    // Add all projects with 'includeInBundle'
    var sourceFiles = [];
    for (var projectGroup in buildConfig.projectGroups)
        for (var project of buildConfig.projectGroups[projectGroup].projects)
            if (project.includeInBundle)
                sourceFiles.push("bld/" + project.path + "/" + project.name + "-debug.js");

    return buildBundle(sourceFiles, false, "Build bundled JS");
}

// Takes the pre-built bundle-debug.js file and bundle/minify it into bundle-min.js
function minifyBundledJS() {
    return buildBundle(["dist/" + buildConfig.bundle.debugFilename], true, "Minify bundled JS");
}

// This is passed in one or more already built files (with corresponding sourcemaps); it bundles them into just
// one file and minifies if so requested.
function buildBundle(sourceFiles, minify, taskName) {
    var taskTracker = new TaskTracker(taskName);
    return gulp.src(sourceFiles)
        .pipe(sourcemaps.init({ loadMaps: true }))
        .pipe(gulpIf(!minify, concat(buildConfig.bundle.debugFilename)))
        .pipe(gulpIf(minify, rename(buildConfig.bundle.minFilename)))
        .pipe(gulpIf(minify, uglify()))
        .pipe(sourcemaps.write(".", {
            includeContent: false, sourceRoot: "/",

            // The sourceRoot and sources' paths from the source files are getting flattened; I need to maintain them
            // separately, so forcibly remove the source root (a slash).
            mapSources: (path) => path.substr(1)
        }))
        .pipe(gulp.dest("dist"))
        .on("end", () => taskTracker.end());
}

// Combines already-built d.ts files that should be included in the bundle
function buildBundledDTS() {
    var taskTracker = new TaskTracker("Build bundled DTS");
    var files = [];
    for (var projectGroup in buildConfig.projectGroups)
        for (var project of buildConfig.projectGroups[projectGroup].projects)
            if (project.includeInBundle)
                files.push(bu.joinPath("bld/typings", project.name + ".d.ts"));

    return gulp.src(files)
        .pipe(concat(buildConfig.bundle.typingFilename))
        .pipe(gulp.dest("dist/typings"))
        .on("end", () => taskTracker.end());
}


// ====================================================================================================================
// ======= APP BUILD FUNCTIONS ========================================================================================

// Builds a single App project
//      Places transpiled JS files alongside source TS files
//      Not included in the bundled output file
//      Doesn't build minified versions
//      Doesn't output Typings
function buildAppProject(project, projectGroup) {
    // Check for incremental build and nothing changed; if that's the case, then emit "no build needed" and skip it
    // Returns a stream object that can be returned directly.
    var skipStream = checkCanSkipBuildProject(project);
    if (skipStream)
        return skipStream;

    var taskTracker = new TaskTracker("buildAppProject", project);

    // Create folder paths and ensure slashes are in the expected places
    var projectFolderName = bu.joinPath(project.path, "/");
    var rootPath = bu.joinPath("/", projectFolderName);

    // Tests all use the same tsconfig; samples project each have own tsconfig file
    var ts = tsc.createProject(projectGroup.tsConfigFile || bu.joinPath(projectFolderName, "tsconfig.json"));

    // Create list of files to compile.  Combination of common files in the project group AND files in the project
    var filesToCompile = [];
    if (projectGroup.commonFiles) {
        for (var projectFile of projectGroup.commonFiles)
            filesToCompile.push(projectFile);
    }
    // Rebase passed-in file names so that they are within the project folder
    var files = project.files || ["**/*.ts"];
    for (var projectFile of files)
        filesToCompile.push(projectFolderName + projectFile);

    // Transpile the project's Typescript into Javascript
    return gulp.src(filesToCompile, { base: project.path })
        .pipe(sourcemaps.init())
        .pipe(ts())
        .pipe(sourcemaps.write(".", { includeContent: false, sourceRoot: rootPath }))
        .pipe(gulp.dest(projectFolderName))
        .on("end", () => taskTracker.end());
}


// ====================================================================================================================
// ======= CLEAN ======================================================================================================

function clean() {
    var taskTracker = new TaskTracker("clean");

    // Create list of files to delete.  Start with files that apply across all apps
    var filesToDelete = [
        // Delete /dist and /bld entirely
        "bld",
        "dist",

        // Delete all sourcemaps, everywhere
        "**/*.js.map",

        // Delete any previously built bundle.d.ts files
        "**/typings/" + buildConfig.bundle.baseName + "*.d.ts"
    ];

    // Only projects know what should be deleted within them.  In a lot of cases, that can be **/*.js (e.g. in tests)
    // but in other cases it can't be - e.g. samples which have js in them.  So: each project has two choices:
    //  define 'filesToClean:string[] to be an array of globs to delete (in addition to the ones in filesToDeletea above)
    //  don't define filesToClean, in which case it defaults to **/*.js,
    for (var projectGroup in buildConfig.projectGroups)
        for (var project of buildConfig.projectGroups[projectGroup].projects) {
            if (project.filesToClean) {
                for (var fileToClean of project.filesToClean)
                    filesToDelete.push(bu.joinPath(project.path, fileToClean))
            } else
                filesToDelete.push(bu.joinPath(project.path, "**/*.js"))
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
    for (var project of projectGroup.projects) {
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
    }
    return bu.runParallel(buildActions).on("end", () => taskTracker.end());
}

// Called at the start of a top-level Task.
function outputTaskHeader(taskName) {
    if (settings.verboseOutput)
        console.log("===== " + taskName + " =======================================================");
}

// Outputs task start and end info to console, including task run time.
function TaskTracker(taskName, project) {
    if (settings.verboseOutput) {
        var startTime = new Date();
        var startTimeStr = getTimeString(startTime);
        var outStr = startTimeStr + " Starting " + taskName;
        if (project)
            outStr += " (" + project.name + ")";
        console.log(outStr);
    }

    return {
        end: function () {
            if (!settings.verboseOutput)
                return;
            var endTime = new Date();
            var delta = (endTime - startTime) / 1000;
            var endTimeStr = getTimeString(endTime);
            if (project)
                console.log(endTimeStr + " Finished " + taskName + " (" + project.name + ") after " + delta + " s");
            else
                console.log(endTimeStr + " Finished " + taskName + " after " + delta + " s");
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
//  2. Maintain a *project-wide* modified state and skip building the entire project if nothing in the project (or its
//     dependencies have changed).  That's what checkCanSkipBuildProject does

// Checks if anything in the project has been modified and the project needs to be rebuilt; if so, returns null
// If the project can be skipped, then returns a stream that can be returned from the caller.
function checkCanSkipBuildProject(project) {

    // Check if incremental builds are enabled
    if (!settings.incrementalBuild)
        return null;

    // If this is first build, then modifiedFilesCache is empty.  In that case, then create the modified file cache for
    // later comparison.  Continue so that we can populate the cache with first run values.
    project.modifiedFilesCache = project.modifiedFilesCache || {};

    // If here, then project has been previously built, and project.modifiedFilesCache contains info.  Compare against
    // current state; if ANY project file has changed, then rebuild.
    var fileHasChanged = false;

    // Generate list of files in the project that we should check
    var files = project.files || ["**/*.ts"];
    var filesToCheck = [];
    var globFiles = glob.sync(bu.joinPath(project.path, files));

    // If project doesn't have any .ts files (e.g. it only has .js) then nothing to compile.
    // Bit tricky here; project *could* have .d.ts files; if it only has those, then don't compile
    var hasFilesToCompile = false;
    for (var file of globFiles)
        if (file.indexOf(".ts") != -1 && file.indexOf(".d.ts") == -1) {
            hasFilesToCompile = true;
            break;
        }

    if (!hasFilesToCompile) {
        console.log(getTimeString(new Date()) + " -- SKIPPING (" + project.name + "): no files to compile");
    } else {
        for (var projectFile of globFiles)
            filesToCheck.push(projectFile);
        var fileHasChanged = checkForChangedFile(filesToCheck, project.modifiedFilesCache);

        // If any files have changed then return null, signifying need to recompile Project
        if (fileHasChanged)
            return null;

        // If here, then no files in the project have changed; skip!
        if (settings.verboseOutput)
            console.log(getTimeString(new Date()) + " -- SKIPPING (" + project.name + "): no files changed");
    }

    // Create and end a stream; caller will pass this on back up the chain.
    var stream = through();
    stream.resume().end();
    return stream;
}

function checkCanSkipBuildBundle() {

    // Check if incremental builds are enabled
    if (!settings.incrementalBuild)
        return null;

    // If here, then bundle has been previously built, and buildConfig.bundle.modifiedBundleCache contains info.  Compare against
    // current state; if ANY file, then rebuild the bundle
    var filesToCheck = [];
    for (var projectGroup in buildConfig.projectGroups) {
        for (var project of buildConfig.projectGroups[projectGroup].projects)
            if (project.includeInBundle)
                filesToCheck.push("bld/" + project.path + "/" + project.name + "-debug.js");
    }
    var fileHasChanged = checkForChangedFile(filesToCheck, buildConfig.bundle.modifiedBundleCache);

    // If any files have changed then return null, signifying need to recreate the bundle
    if (fileHasChanged)
        return null;

    // If here, then no files that we'd bundle have changed; skip!
    if (settings.verboseOutput)
        console.log(getTimeString(new Date()) + " -- SKIPPING BUNDLE: no files changed");

    // Create and end a stream; caller will pass this on back up the chain.
    var stream = through();
    stream.resume().end();
    return stream;
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
            if (!settings.recompiledOnDTSChanges && file.indexOf(".d.ts") > -1)
                continue;

            fileHasChanged = true;
        }
    }
    return fileHasChanged;
}


// ====================================================================================================================
// ======= ROOT TASKS =================================================================================================

// Build a collection of library or App projects
function buildProjects(projectGroup) {
    var buildActions = [];
    var buildFunc = projectGroup.isLibrary ? buildLibProject : buildAppProject;
    for (var project of projectGroup.projects) {
        let p = project; // closure
        buildActions.push(() => buildFunc(p, projectGroup));
    }
    return bu.runParallel(buildActions);
}

// Builds a project group (e.g. editor, plugins, samples, or tests)
function buildProjectGroup(projectGroup) {
    outputTaskHeader("Build " + projectGroup.name);
    return bu.runSeries([
        () => precopyRequiredFiles(projectGroup),
        () => buildProjects(projectGroup)
    ]);
}

// Does a complete rebuild
gulp.task("rebuild-all", function () {
    if (settings.forceSerializedTasks)
        console.log("== Forcing serialized tasks ==");

    // Don't do an incremental build
    settings.incrementalBuild = false;

    // Clean and then build.
    return bu.runSeries([
        () => clean(),

        // TODO (HACK/CLEANUP): don't pass these in ><.
        () => buildConfig.buildAll(buildProjectGroup, createBundle)
    ]);
});

// Builds everything (w/o cleaning first)
gulp.task("build-all", function () {
    if (globals.isFirstBuild) {
        console.log("== First build; complete build will be performed ==");
        globals.isFirstBuild = false;
    }

    if (settings.forceSerializedTasks)
        console.log("== Forcing serialized tasks ==");

    // Do an incremental build at the project-level
    settings.incrementalBuild = true;

    // TODO (HACK/CLEANUP): don't pass these in ><.
    return buildConfig.buildAll(buildProjectGroup, createBundle);
});

// Watches; also enables incremental builds.  You can just run this task and let it handle things
// It does do a build-on-save which isn't exactly what I wanted to enable here (I'd prefer in this task to just track
// dirty files and pass that list on to build-all when a build task is started).  Should work as-is though.
// NOTE: buildConfig.settings.incrementalBuild enables project-level incremental builds; it skips entire projects if nothing in
// them has changed
gulp.task('watch', function () {
    // Since this is always running, limit output to errors
    // settings.verboseOutput = false;

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