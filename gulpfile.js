"use strict";

var concat = require("gulp-concat"),
    del = require("del"),
    dtsGenerator = require("dts-generator"),
    eventStream = require("event-stream"),
    fs = require("fs"),
    glob = require("glob"),
    gulp = require("gulp"),
    gulpIf = require("gulp-if"),
    path = require("path"),
    preservetime = require("gulp-preservetime"),
    rename = require("gulp-rename"),
    sourcemaps = require("gulp-sourcemaps"),
    through = require('through2'),
    tsc = require("gulp-typescript"),
    uglify = require("gulp-uglify");


// Q: Why isn't tsc problem matcher working?
// A: Because pattern matchers don't (yet) apply to output window, which only works with aboslute paths
// SEE: https://github.com/Microsoft/vscode/issues/6217

var settings = {
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

    // By default, an incremental build would rebuild if *any* file changes, including d.ts files.  However, I *think*
    // that you can get away with skipping recompilation of a project if only d.ts files have changed.  This field
    // manages that.  If you're seeing weird incremental build behavior then try setting this to true, and let me know
    recompiledOnDTSChanges: false
};

// Used to store global info
var globals = {};


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
//
// NOTE: each ProjectGroup can also define its own additional properties; e.g. the editor ProjectGroup includes version

// Defines the main editor project group
var editor = {
    name: "Editor",
    version: "0.0.1",
    isLibrary: true,
    projects: [{
        name: "editor",
        path: "editor",
        includeInBundle: true
    }]
}

// Generate file output file names; these include version stamp; e.g. 'duality-0.1.1.debug.js'
var dualityDebugFileName = "duality-" + editor.version + ".debug.js";
var dualityMinFileName = "duality-" + editor.version + ".min.js";
var dualityTypingFileName = "duality-" + editor.version + ".d.ts";

// Defines all of the plugins that are built
var plugins = {
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
};

// Defines all of the tests that are built
var tests = {
    name: "Tests",
    isLibrary: false,
    tsConfigFile: "tests/tsconfig.json",
    commonFiles: ["tests/typings/*.d.ts"],
    filesToPrecopyOnce: [{ src: "dist/typings/" + dualityTypingFileName, dest: "tests/typings" }],
    projects: [{
        name: "test1",
        path: "tests/test1",
    }, {
        name: "test2",
        path: "tests/test2",
    }]
};

// Defines all of the samples that are built
var samples = {
    name: "Samples",
    isLibrary: false,
    // All projects in this group have these files copied into their sample folders.  Built files typically go here.
    filesToPrecopyToAllProjects: [{ src: "dist/typings/" + dualityTypingFileName, dest: "typings" }],
    projects: [{
        name: "testApp",
        path: "samples/testApp",
    }, {
        name: "testApp2",
        path: "samples/testApp2",
        filesToPrecopy: [
            // This test uses the threeJS plugin that we build, so copy the .js into ./lib and the d.ts into ./typings
            { src: "dist/typings/threejs.d.ts", dest: "typings" },
            { src: "dist/plugins/threeJS/*", dest: "lib" }]
    }]
};


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
    return runSeries([
        () => buildLib(project, projectGroup),
        () => runParallel([
            () => minifyLib(project),
            () => buildLibDefinitionFile(project)
        ])
    ]);
}

// Build a single library project
//      Transpiles TS into JS and flattens JS into single "*-debug.js" file.
//      Places flattened transpiled JS file in /dist folder
function buildLib(project, projectGroup) {
    var taskTracker = new TaskTracker("buildLib", project);
    var projectFolderName = joinPath(project.path, "/");

    // Create list of files to compile.  Combination of common files in the project group AND files in the project
    var filesToCompile = [];
    if (projectGroup.commonFiles)
        for (var projectFile of projectGroup.commonFiles)
            filesToCompile.push(projectFile);

    // Rebase passed-in file names so that they are within the project folder
    var files = project.files || ["**/*.ts"];
    for (var projectFile of files)
        filesToCompile.push(projectFolderName + projectFile);
    var ts = tsc.createProject(joinPath(project.path, "tsconfig.json"));

    // Start things up, passing in the files to compile.
    return gulp.src(filesToCompile, { base: "." })

        // See comment before definition of settings.incrementalBuild for reason why this is commented out.
        //.pipe(gulpIf(settings.incrementalBuild, filterToChangedFiles()))
        //.pipe(gulpIf(settings.incrementalBuild, outputFilesInStream("buildLib")))

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

        // See comment before definition of settings.incrementalBuild for reason why this is commented out.
        //.pipe(gulpIf(settings.incrementalBuild, filterToChangedFiles()))
        //.pipe(gulpIf(settings.incrementalBuild, outputFilesInStream("minifyLib")))

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
    var taskTracker = new TaskTracker("buildLibDefinitionFile", project);
    var stream = through();
    dtsGenerator.default({
        name: project.name,
        project: project.path,
        rootDir: "./",
        exclude: ["./**/*.d.ts"],
        out: "dist/typings/" + project.name + '.d.ts'
    }).then(() => {
        taskTracker.end();
        stream.resume().end();
    });
    return stream;
}


// ====================================================================================================================
// ======= BUILD BUNDLED EDITOR AND BUILT-IN PLUGINS ==================================================================

function bundleEditorAndPlugins() {

    outputTaskHeader("Build Bundle");

    // If none of the files that we're going to bundle have changed then don't build bundle.
    // Returns a stream object that can be returned directly.
    var skipStream = checkCanSkipBuildBundle();
    if (skipStream)
        return skipStream;

    var stream = through();
    // First build the bundled "duality*.js" file
    // once duality*.js is built, we can in parallel built duality*.min.js from it AND duality.d.ts.
    buildBundledJS().on("end", () => {
        runParallel([
            () => minifyBundledJS(),
            () => buildBundledDTS()])
            .on("end", () => stream.resume().end());
    });
    return stream;
}

function buildBundledJS() {
    // Start by adding duality editor to list of files to concat; then add all built-in plugins to list of files
    var sourceFiles = ["bld/editor/editor-debug.js"];
    for (var plugin of plugins.projects)
        if (plugin.includeInBundle)
            sourceFiles.push("bld/" + plugin.path + "/" + plugin.name + "-debug.js");

    return buildBundle(sourceFiles, false, "Build bundled JS");
}

// Takes the pre-built duality*-debug.js file and bundle/minify it into duality*-min.js
function minifyBundledJS() {
    return buildBundle(["dist/" + dualityDebugFileName], true, "Minify bundled JS");
}

// This is passed in one or more already built files (with corresponding sourcemaps); it bundles them into just
// one file and minifies if so requested.
function buildBundle(sourceFiles, minify, taskName) {
    var taskTracker = new TaskTracker(taskName);
    return gulp.src(sourceFiles)
        .pipe(sourcemaps.init({ loadMaps: true }))
        .pipe(gulpIf(!minify, concat(dualityDebugFileName)))
        .pipe(gulpIf(minify, rename(dualityMinFileName)))
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

// Combines already-built editor.d.ts & built-in plugin d.ts files
function buildBundledDTS() {
    var taskTracker = new TaskTracker("Build bundled DTS");
    var files = [joinPath("dist/typings", editor.name + ".d.ts")];
    for (var plugin of plugins.projects)
        if (plugin.includeInBundle)
            files.push(joinPath("dist/typings", plugin.name + ".d.ts"));
    return gulp.src(files)
        .pipe(concat(dualityTypingFileName))
        .pipe(gulp.dest("dist/typings"))
        .on("end", () => taskTracker.end());
}


// ====================================================================================================================
// ======= APP BUILD FUNCTIONS ========================================================================================

// Builds a single App project
//      Places transpiled JS files alongside source TS files
//      Doesn't flatten transpiled JS files into single js file.
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
    var projectFolderName = joinPath(project.path, "/");
    var rootPath = joinPath("/", projectFolderName);

    // Tests all use the same tsconfig; samples project each have own tsconfig file
    var ts = tsc.createProject(projectGroup.tsConfigFile || joinPath(projectFolderName, "tsconfig.json"));

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

        // See comment before definition of settings.incrementalBuild for reason why this is commented out.
        //.pipe(gulpIf(settings.incrementalBuild, filterToChangedFiles()))
        //.pipe(gulpIf(settings.incrementalBuild, outputFilesInStream("minifyLib")))

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
    return del([
        // Delete dist and bld
        "bld",
        "dist",

        // Delete all sourcemaps, everywhere
        "./**/*.js.map",

        // Cleanup tests folder
        "./tests/typings/duality*.d.ts",
        "./tests/**/*.js",

        // Cleanup plugins folder
        "./plugins/**/typings",
        "./plugins/**/*.js",

        // Cleanup samples folder
        // note: leave samples' *.js and /typings, as the sample may have some that shouldn't be deleted
        "./samples/**/typings/duality*.d.ts"
    ]).then(() => taskTracker.end());
}

// ====================================================================================================================
// ======= UTILTIES ===================================================================================================

// Runs in order a series of functions which return streams or promises.  Does not call function N until function (N-1)
// has reached the end of its stream; denoted by the stream triggering the "end" event.  Returns a stream.
// NOTE: This is likely a pretty fragile function and doesn't support myriad realities of streams and promises.  Works
//       for this gulpfile's needs, though!
function runSeries(functions) {
    var stream = through();
    var i = 0, toRun = functions.length;
    var run = () => {
        if (i == toRun)
            stream.resume().end();
        else {
            var result = functions[i++]();
            if (result.on)
                result.on("end", run);
            else if (result.then)
                result.then(run);
            else
                console.error("functions passed to runSeries must return a stream or promise");
        }
    };
    run();
    return stream;
}

// Runs a series of functions and returns a stream that is ended when all functions' streams end.
// This is mostly just a pass-through to event-stream; however, I allow the user to force serialized
// task execution here
function runParallel(callbacks) {
    if (settings.forceSerializedTasks) {
        // Run them in series
        return runSeries(callbacks);
    } else {
        // run them in parallel.  This function takes an array of callbacks, but event-stream expects already
        // started streams, so call the callbacks here
        // TODO: runSeries accepts both promises and streams, but eventStream only accepts streams.  convert them here
        var funcs = [];
        for (var func of callbacks)
            funcs.push(func());
        return eventStream.merge(funcs);
    }
}

// Joins two paths together, removing multiple slashes (e.g. path/to//file)
function joinPath(path, file) {
    return (path + '/' + file).replace(/\/{2,}/, '/');
}

// Copies any previously built files into the ProjectGroup's Projects.
function precopyRequiredFiles(projectGroup) {
    var taskTracker = new TaskTracker("precopyRequiredFiles");

    var buildActions = [];
    // Copy files that should be copied one time before a projectgroup is built; e.g. tests/typings/duality.d.ts is
    // used by all tests and needs to be copied from dist first.
    if (projectGroup.filesToPrecopyOnce)
        for (var fileToCopy of projectGroup.filesToPrecopyOnce) {
            let file = fileToCopy; // closure
            buildActions.push(() => copyFile(file.src, file.dest));
        }
    for (var project of projectGroup.projects) {
        // Copy files that should be copied to every project in the entire project group
        if (projectGroup.filesToPrecopyToAllProjects)
            for (var fileToCopy of projectGroup.filesToPrecopyToAllProjects) {
                let file = fileToCopy, p = project; // closure
                buildActions.push(() => copyFile(file.src, joinPath(p.path, file.dest)));
            }

        // Copy any files that this project needs
        if (project.filesToPrecopy)
            for (var fileToCopy of project.filesToPrecopy) {
                let file = fileToCopy, p = project; // closure
                buildActions.push(() => copyFile(file.src, joinPath(p.path, file.dest)));
            }
    }
    return runParallel(buildActions).on("end", () => taskTracker.end());
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

/*
Commented out as I can't actually use these for incremental file-level compilation.  Leaving in as I may use them one day...

// Outputs (to console) the list of files in the current stream
function outputFilesInStream(taskName) {
    return through.obj(function (file, enc, callback) {
        if (settings.verboseOutput) {
            // we compile d.ts files, but don't babble about them here.
            if (file.relative.indexOf(".d.ts") == -1)
                console.log("[" + taskName + "]: Dirty source file: " + file.relative);
        }

        this.push(file);
        return callback();
    });
}

// My quick-and-dirty reimplementation of changed-files-in-place which uses timeStamp instead of hash.
var dirtyFileCache = {};
function filterToChangedFiles() {
    return through.obj(function (file, encoding, done) {
        var lastModifiedTime = file.statSync.mtime.valueOf();
        var cachedTime = dirtyFileCache[file.path];
        if (!cachedTime || (cachedTime != lastModifiedTime)) {
            // we've seen the file before and the lastModifiedTime has changed then pass it through; otherwise, drop it
            dirtyFileCache[file.path] = lastModifiedTime;
            this.push(file);
        }
        done();
    });
}*/


// Copies a file from the source location to the dest location
// This only supports copying a (glob of files) into a folder; destPath cannot be a specific filename.
function copyFile(src, destPath) {
    // Incremental builds need to maintain the src's modified time in the dest copy, but gulp.src.dest doesn't do that
    // Automatically.  So: call preservetime.
    // See http://stackoverflow.com/questions/26177805/copy-files-with-gulp-while-preserving-modification-time
    return gulp.src(src)
        .pipe(gulp.dest(destPath))
        .pipe(gulpIf(settings.incrementalBuild, preservetime()));
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
    var globFiles = glob.sync(joinPath(project.path, files));
    for (var projectFile of globFiles)
        filesToCheck.push(projectFile);

    var fileHasChanged = checkForChangedFile(filesToCheck, project.modifiedFilesCache);

    // TODO: I still need to precopy precopied files: scenario 2 -
    //  1. user starts a build; testApp fails because Duality.TextBox doesn't exist in duality.js
    //  2. user adds Duality.TextBox and rebuilds.  Duality.TextBox now exists in duality.js
    //  3. user goes into the testApp project; duality.textbox doesn't resolve as the d.ts wasn't copied
    // SO: This states that the precopy should still run whenever the source changes (which I'm not currently doing)...

    // If any files have changed then return null, signifying need to recompile Project
    if (fileHasChanged)
        return null;

    // If here, then no files in the project have changed; skip!
    if (settings.verboseOutput)
        console.log(getTimeString(new Date()) + " -- SKIPPING (" + project.name + "): no files changed");

    // Create and end a stream; caller will pass this on back up the chain.
    var stream = through();
    stream.resume().end();
    return stream;
}

function checkCanSkipBuildBundle() {

    // Check if incremental builds are enabled
    if (!settings.incrementalBuild)
        return null;

    // If this is first build, then globals.modifiedBundleCache is empty.  In that case, then create the modified
    // file cache for later comparison.  Continue so that we can populate the cache with first run values.
    globals.modifiedBundleCache = globals.modifiedBundleCache || {};

    // If here, then bundle has been previously built, and globals.modifiedBundleCache contains info.  Compare against
    // current state; if ANY file, then rebuild the bundle
    var filesToCheck = ["bld/editor/editor-debug.js"];
    for (var plugin of plugins.projects)
        if (plugin.includeInBundle)
            filesToCheck.push("bld/" + plugin.path + "/" + plugin.name + "-debug.js");

    var fileHasChanged = checkForChangedFile(filesToCheck, globals.modifiedBundleCache);

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
    return runParallel(buildActions);
}

// Builds a project group (e.g. editor, plugins, samples, or tests)
function buildProjectGroup(projectGroup) {
    outputTaskHeader("Build " + projectGroup.name);
    return runSeries([
        () => precopyRequiredFiles(projectGroup),
        () => buildProjects(projectGroup)
    ]);
}

// Main build function; builds editor, plugins, tests, and samples; also bundles editor and plugins into duality*.js
function buildDuality() {
    return runSeries([
        // editor, plugins, and bundle must be built in order
        () => buildProjectGroup(editor),
        () => buildProjectGroup(plugins),
        () => bundleEditorAndPlugins(),
        // side note: tests and samples could be built in parallel (so: use runParallel[...]) - but
        // perf diff isn't noticable here, and it messes up my pretty, pretty output.  So: if you have a lot of tests
        // and samples (... and typescript is actually doing multi-proc transpilation) then consider parallelizing these
        () => buildProjectGroup(tests),
        () => buildProjectGroup(samples)
    ]);
}

// Does a complete rebuild
gulp.task("rebuild-all-duality", function () {
    console.log("");
    if (settings.forceSerializedTasks)
        console.log("== Forcing serialized tasks ==");

    // Don't do an incremental build
    settings.incrementalBuild = false;

    // Clean and then build.
    return runSeries([
        () => clean(),
        () => buildDuality()
    ]);
});

// Builds duality
gulp.task("build-duality", function () {
    if (globals.isFirstBuild) {
        console.log("== First build; complete build will be performed ==");
        globals.isFirstBuild = false;
    }
    
    if (settings.forceSerializedTasks)
        console.log("== Forcing serialized tasks ==");

    // Do an incremental build at the project-level
    settings.incrementalBuild = true;

    return buildDuality();
});

// Watches; also enables incremental builds.  You can just run this task and let it handle things
// It does do a build-on-save which isn't exactly what I wanted to enable here (I'd prefer in this task to just track
// dirty files and pass that list on to build-duality when a build task is started).  Should work as-is though.
// NOTE: settings.incrementalBuild enables project-level incremental builds; it skips entire projects if nothing in
// them has changed
gulp.task('watch', function () {
    // Since this is always running, limit output to errors
    // settings.verboseOutput = false;

    // Because we don't maintain information about files between Task runs, our modifiedCache is always empty
    // at the start, and thus we'll rebuild everything.  Track that it's the first build so that we can output it.
    globals.isFirstBuild = true;

    // Watch for changes to ts files; when they occur, run the 'build-duality' task
    gulp.watch([
        "**/*.ts",
        "!**/*.d.ts",
        "!dist",
        "!bld"
    ], ["build-duality"])
});