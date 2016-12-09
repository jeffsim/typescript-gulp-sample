"use strict";

var changedInPlace = require("gulp-changed-in-place"),
    concat = require("gulp-concat"),
    del = require("del"),
    dtsGenerator = require("dts-generator"),
    eventStream = require("event-stream"),
    gulp = require("gulp"),
    gulpIf = require("gulp-if"),
    rename = require("gulp-rename"),
    sourcemaps = require("gulp-sourcemaps"),
    through = require('through2'),
    tsc = require("gulp-typescript"),
    uglify = require("gulp-uglify");


var settings = {
    // Dump extra output during the build process
    verboseOutput: true,

    // true if we should do an incremental (oh so fast) build.  rebuild all sets this to false
    incrementalBuild: true,
};


// ====================================================================================================================
// ======= PROJECTS ===================================================================================================
// Editor, Plugins, Tests, and Samples are all defined using a common project format so that they can be handled
// generically.  All projects must have at minimum: name:string, path:string, and files:string[]

// editor, plugins, tests, and samples are all examples of ProjectGroups.  Here's the defn of ProjectGroup:
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
//  commonFiles?:string[]       Optional list of files that should be including in compilation of projects
//  projects:Project[]          List of projects within the ProjectGroup.  Structure of Project:
//      name: string            Name of the project
//      path: string            Path of the project relative to root
//      files: string[]         List of files to compile; relative to project path.
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
        files: [
            "controls/Visual.ts", "controls/Label.ts", "controls/TextBox.ts",
            "Editor.ts",
            "typings/*.d.ts",
        ]
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
    commonFiles: ["dist/typings/editor.d.ts"],
    projects: [{
        name: "debugDuality",
        path: "plugins/duality/debugDualityPlugin",
        files: ["plugin.ts"],
        isBuiltIn: true,
    }, {
        name: "debugDuality2",
        path: "plugins/duality/debugPlugin2",
        files: ["plugin2.ts"],
        isBuiltIn: true,
    }, {
        name: "threejs",
        path: "plugins/threeJS",
        files: ["pluginTJS.ts"],
        isBuiltIn: false,
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
        files: ["test1.spec.ts"],
    }, {
        name: "test2",
        path: "tests/test2",
        files: ["test2.spec.ts"]
    }]
};

// Defines all of the samples that are built
var samples = {
    name: "Samples",
    isLibrary: false,
    // All projects in this group have these files copied into their sample folders.  Built files typically go here.
    filesToPrecopyToAllProjects: [{ src: "dist/typings/" + dualityTypingFileName, dest: "typings" }],
    commonFiles: ["dist/typings/" + dualityTypingFileName],
    projects: [{
        name: "testApp",
        path: "samples/testApp",
        files: ["testApp.ts"],
    }, {
        name: "testApp2",
        path: "samples/testApp2",
        files: ["testApp2.ts", "testApp2plugin/testPlugin.ts", "typings/threejs.d.ts", "typings/jquery.d.ts"],
        filesToPrecopy: [
            // This test uses the threeJS plugin that we build, so copy the .js into ./lib and the d.ts into ./typings
            { src: "dist/typings/threejs.d.ts", dest: "typings" },
            { src: "dist/plugins/threeJS/*", dest: "lib" }]
    }]
};


// ====================================================================================================================
// ======= LIBRARY BUILD FUNCTIONS ====================================================================================

// Build a collection of library projects
// Wait until all of the libraries have been built before emitting done.  note: can run in parallel
function buildLibProjects(projectGroup) {
    var buildActions = [];
    for (var project of projectGroup.projects)
        buildActions.push(buildLibProject(project, projectGroup));
    return eventStream.merge(buildActions);
}

// For a single given library project, build it, then minify it, and then generate a d.ts file for it
function buildLibProject(project, projectGroup) {

    // First build the library; then in parallel minify it and build d.ts file.
    return runSeries([
        () => buildLib(project, projectGroup),
        () => eventStream.merge([
            minifyLib(project),
            buildLibDefinitionFile(project)
        ])
    ]);
}

// Build a single library project
//      Transpiles TS into JS and flattens JS into single "*-debug.js" file.
//      Places flattened transpiled JS file in /dist folder
function buildLib(project, projectGroup) {
    var startTime = outputTaskStart("buildLib", project);
    var projectFolderName = joinPath(project.path, "/");

    // Create list of files to compile.  Combination of common files in the project group AND files in the project
    var filesToCompile = [];
    if (projectGroup.commonFiles)
        for (var projectFile of projectGroup.commonFiles)
            filesToCompile.push(projectFile);

    // Rebase passed-in file names so that they are within the project folder
    for (var projectFile of project.files)
        filesToCompile.push(projectFolderName + projectFile);

    var ts = tsc.createProject(joinPath(project.path, "tsconfig.json"));
    return gulp.src(filesToCompile, { base: project.path })
        .pipe(gulpIf(settings.incrementalBuild, changedInPlace()))
        .pipe(sourcemaps.init())
        .pipe(ts())
        .pipe(concat(project.name + "-debug.js"))
        .pipe(sourcemaps.write(".", { includeContent: false, sourceRoot: joinPath("/", project.path) }))
        .pipe(gulp.dest(joinPath("dist", project.path)))
        .pipe(gulp.dest("dist/all"))
        .on("end", () => outputTaskEnd("buildLib", project, startTime));
}

// Minifies a single Library project. Uses the library project's already-built "*-debug.js" as single source file
// Generates a single "*-min.js" output file.  Minifies it and places output in /dist
function minifyLib(project) {
    var startTime = outputTaskStart("minifyLib", project);

    return gulp.src(["dist/all/" + project.name + "-debug.js"])
        .pipe(gulpIf(settings.incrementalBuild, changedInPlace()))
        .pipe(sourcemaps.init({ loadMaps: true }))
        .pipe(rename(project.name + "-min.js"))
        .pipe(uglify())
        .pipe(sourcemaps.write(".", { includeContent: false, sourceRoot: "/" }))
        .pipe(gulp.dest(joinPath("dist", project.path)))
        .pipe(gulp.dest("dist/all"))
        .on("end", () => outputTaskEnd("minifyLib", project, startTime));
}

// Generates .d.ts definition file for a single Library project
// NOTE: 'declaration:true' in tsconfig.json doesn't support flattening into a single d.ts file, so using this instead.
// Ideally would use the built-in version, but can't yet.  See: https://github.com/Microsoft/TypeScript/issues/2568
function buildLibDefinitionFile(project) {
    var startTime = outputTaskStart("buildLibDefinitionFile", project);
    var stream = through();
    dtsGenerator.default({
        name: project.name,
        project: project.path,
        rootDir: "./",
        exclude: ["./**/*.d.ts"],
        out: "dist/typings/" + project.name + '.d.ts'
    }).then(() => {
        outputTaskEnd("buildLibDefinitionFile", project, startTime);
        stream.end();
    });
    return stream;
}


// ====================================================================================================================
// ======= APP BUILD FUNCTIONS ========================================================================================

// Builds a collection of App projects
function buildAppProjects(projectGroup) {
    var buildActions = [];
    for (var project of projectGroup.projects)
        buildActions.push(buildAppProject(project, projectGroup));
    return eventStream.merge(buildActions);
}

// Builds a single App project
//      Places transpiled JS files alongside source TS files
//      Doesn't flatten transpiled JS files into single js file.
//      Doesn't build minified versions
//      Doesn't output Typings
function buildAppProject(project, projectGroup) {

    var startTime = outputTaskStart("buildAppProject", project);

    // Create folder paths and ensure slashes are in the expected places
    var projectFolderName = joinPath(project.path, "/");
    var rootPath = joinPath("/", projectFolderName);

    // Tests all use the same tsconfig; samples project each have own tsconfig file
    var ts = tsc.createProject(projectGroup.tsConfigFile || joinPath(projectFolderName, "tsconfig.json"));

    // Create list of files to compile.  Combination of common files in the project group AND files in the project
    var filesToCompile = [];
    if (projectGroup.commonFiles)
        for (var projectFile of projectGroup.commonFiles)
            filesToCompile.push(projectFile);

    // Rebase passed-in file names so that they are within the project folder
    for (var projectFile of project.files)
        filesToCompile.push(projectFolderName + projectFile);

    // Transpile the project's Typescript into Javascript
    return gulp.src(filesToCompile, { base: project.path })
        .pipe(gulpIf(settings.incrementalBuild, changedInPlace()))
        .pipe(sourcemaps.init())
        .pipe(ts())
        .pipe(sourcemaps.write(".", { includeContent: false, sourceRoot: rootPath }))
        .pipe(gulp.dest(projectFolderName))
        .on("end", () => outputTaskEnd("buildAppProject", project, startTime));
}


// ====================================================================================================================
// ======= BUILD BUNDLED EDITOR AND BUILT-IN PLUGINS ==================================================================

function bundleEditorAndPlugins() {
    var stream = through();
    // First build the bundled "duality*.js" file
    // once duality*.js is built, we can in parallel built duality*.min.js from it AND duality.d.ts.
    buildBundledJS().on("end", () => {
        eventStream.merge(minifyBundledJS(), buildBundledDTS()).on("end", () => stream.resume().end());
    });
    return stream;
}

function buildBundledJS() {
    // Start by adding duality editor to list of files to concat; then add all built-in plugins to list of files
    var sourceFiles = ["dist/all/editor-debug.js"];
    for (var plugin of plugins.projects)
        if (plugin.isBuiltIn)
            sourceFiles.push("dist/all/" + plugin.name + "-debug.js");

    return buildBundle(sourceFiles, false);
}

// Take the pre-built duality*-debug.js file and bundle/minify it into duality*-min.js
function minifyBundledJS() {
    return buildBundle(["dist/" + dualityDebugFileName], true);
}

// This is passed in one or more already built files (with corresponding sourcemaps); it bundles them into just
// one file and minifies if so requested.
function buildBundle(sourceFiles, minify) {
    var options = minify ? {base:"/"} : {};

    return gulp.src(sourceFiles, options)
        .pipe(gulpIf(settings.incrementalBuild, changedInPlace()))
        .pipe(sourcemaps.init({ loadMaps: true }))
        .pipe(gulpIf(minify, uglify()))
        .pipe(gulpIf(!minify, concat(dualityDebugFileName)))
        .pipe(gulpIf(minify, rename(minify ? dualityMinFileName : dualityDebugFileName)))
        .pipe(sourcemaps.write(".", { includeContent: false, sourceRoot: "/" }))
        .pipe(gulp.dest("dist"));
}

// Combines already-built editor.d.ts & built-in plugin d.ts files
function buildBundledDTS() {
    var files = [joinPath("dist/typings", editor.name + ".d.ts")];
    for (var plugin of plugins.projects)
        if (plugin.isBuiltIn)
            files.push(joinPath("dist/typings", plugin.name + ".d.ts"));
    return gulp.src(files)
        .pipe(concat(dualityTypingFileName))
        .pipe(gulp.dest("dist/typings"));
}


// ====================================================================================================================
// ======= CLEAN ======================================================================================================

function clean() {
    var startTime = outputTaskStart("clean");
    return del([
        // Delete dist
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
    ]).then(() => outputTaskEnd("clean", null, startTime));
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

// Joins two paths together, removing multiple slashes (e.g. path/to//file)
function joinPath(path, file) {
    return (path + '/' + file).replace(/\/{2,}/, '/');
}

// Copies a file from the source location to the dest location
function copyFile(src, dest) {
    return gulp.src(src).pipe(gulp.dest(dest));
}

// Projects may require built files like duality-debug-plugin-XYZ.d.ts to be precopied
// duality.d.ts is automatically copied for all projects (except editor), but others need to be manually specified here.
// precopyFullDuality - if true, duality.d.ts is precopied; if false, editor.d.ts is precopied.  this is because plugins
//      need editor.d.ts, not full duality.d.ts (which includes plugins) 
function precopyRequiredFiles(projectGroup) {
    var startTime = outputTaskStart("precopyRequiredFiles");

    var buildActions = [];
    // Copy files that should be copied one time before a projectgroup is built; e.g. tests/typings/duality.d.ts is
    // used by all tests and needs to be copied from dist first.
    if (projectGroup.filesToPrecopyOnce)
        for (var fileToCopy of projectGroup.filesToPrecopyOnce)
            buildActions.push(copyFile(fileToCopy.src, fileToCopy.dest));

    for (var project of projectGroup.projects) {
        // Copy files that should be copied to every project in the entire project group
        if (projectGroup.filesToPrecopyToAllProjects)
            for (var fileToCopy of projectGroup.filesToPrecopyToAllProjects)
                buildActions.push(copyFile(fileToCopy.src, joinPath(project.path, fileToCopy.dest)));

        // Copy any files that this project needs
        if (project.filesToPrecopy)
            for (var fileToCopy of project.filesToPrecopy)
                buildActions.push(copyFile(fileToCopy.src, joinPath(project.path, fileToCopy.dest)));
    }
    var stream = eventStream.merge(buildActions);
    stream.on("end", () => outputTaskEnd("precopyRequiredFiles", null, startTime));
    return stream;
}

// Called at the start of a top-level Task.
function outputTaskHeader(taskName) {
    if (settings.verboseOutput)
        console.log("===== " + taskName + " =======================================================");
}

// Called at the start of a subtask function.  Outputs to console; mimics gulp's task start/end formatting
function outputTaskStart(name, project) {
    if (!settings.verboseOutput)
        return;
    var startTime = new Date();
    var time = startTime.toTimeString().replace(/.*(\d{2}:\d{2}:\d{2}).*/, "$1");
    if (project)
        console.log("[" + time + "] Starting " + name + " (" + project.name + ")");
    else
        console.log("[" + time + "] Starting " + name);
    return startTime;
}

// Called at the end of a subtask function.  Outputs to console; mimics gulp's task start/end formatting
function outputTaskEnd(name, project, time) {
    if (!settings.verboseOutput)
        return;
    var delta = (new Date() - time) / 1000;
    time = time.toTimeString().replace(/.*(\d{2}:\d{2}:\d{2}).*/, "$1");
    if (project)
        console.log("[" + time + "] Finished " + name + " (" + project.name + ") after " + delta + " s");
    else
        console.log("[" + time + "] Finished " + name + " after " + delta + " s");
}


// ====================================================================================================================
// ======= ROOT TASKS =================================================================================================

// Builds a project group (e.g. editor, plugins, samples, or tests)
function buildProjectGroup(projectGroup) {
    outputTaskHeader("Build " + projectGroup.name);
    return runSeries([
        () => precopyRequiredFiles(projectGroup),
        () => projectGroup.isLibrary ? buildLibProjects(projectGroup) : buildAppProjects(projectGroup)
    ]);
}

// Main build function; builds editor, plugins, tests, and samples; also bundles editor and plugins into duality*.js
function buildDuality() {
    return runSeries([
        // editor, plugins, and bundle must be built in order
        () => buildProjectGroup(editor),
        () => buildProjectGroup(plugins),
        () => bundleEditorAndPlugins(),
        // side note: tests and samples could be built in parallel (so: use () => eventStream.merge([...])) - but
        // perf diff isn't noticable, and it messes up my pretty, pretty output.  So: if you have a lot of tests and
        // samples (... and typescript is actually doing multi-proc transpilation) then consider parallelizing these.
        () => buildProjectGroup(tests),
        () => buildProjectGroup(samples)
    ]);
}

// Does a complete rebuild
gulp.task("rebuild-all-duality", function () {
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
    return buildDuality();
});