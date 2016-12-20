# **This readme is very much a work in progress!**

# Table of Contents
* [What is this?](#what-is-this)
* [VS Code](#vs-code)
* [How to test the build environment](#how-to-test-the-build-environment)
* [From the top: Using gulp and tasks](#from-the-top-using-gulp-and-tasks)
* [buildConfig.js](#buildconfigjs)
* [The Project System](#the-project-system)
* [Folders](#folders)
* [Managing and moving files between projects at build time](#managing-and-moving-files-between-projects-at-build-time)
* [Bundling](#bundling)
* [Build Settings](#build-settings)
* [Debug and minified builds](#debug-and-minified-builds)
* [Incremental Builds](#incremental-builds)
* [Ordering files for Typescript build](#ordering-files-for-typescript-build)
* [Typings](#typings)
* [Tasks, runSeries and runParallel](#tasks-runseries-and-runparallel)
* [tsconfig.json](#tsconfigjson)
* [taskTracker](#tasktracker)
* [Sourcemap-based debugging](#sourcemap-based-debugging)
* [Debugging the gulpfile](#debugging-the-gulpfile)
* [Running tests](#running-tests)
* [Lessons learned while doing this](#lessons-learned-while-doing-this)

# What is this?
This is my evolving effort to create a gulp-based dev environment for my Typescript projects which supports:
- debug and minified builds
- Sourcemap-based debugging
- File- and Project-level incremental compilation
- Bundling library output into a single js file using namespaces (not external modules)
- Proper ordering of files (e.g. base classes before derived classes) in the build
- Ambient typings working throughout while editing
- Generation of d.ts files for not-built-in plugins and an all-up bundled d.ts for everthing bundled
- How to get one gulpfile to work with multiple projects and multiple tsconfigs
- Including 3PP library and d.ts (jquery)
- Wallaby-based test runner

The information in this document will likely be sparse and, admittedly, at times assumed; it's what I've deduced after
banging my head against this particular wall for a while...  Caveat emptor!

### Current Status
**Working!**  Everything functions as expected.  That said, here are the items at the top of my todo list:
* Don't copy built-in-plugin d.ts files in dist/typings
* Update joinPath to use join-path-js.  Use it on line 245 & others.
  * Related: I'm passing ("src", ["\*\*\\\*.ts"]) instead of ("src", "\*\*\\.ts")
* I suspect I can use through2.obj() in places where I just need a stream to pass back
* Make gulpfile watch itself.  https://codepen.io/ScavaJripter/post/how-to-watch-the-same-gulpfile-js-with-gulp
* When creating the list of files to compile, include all files in project.parentGroup.filesToPrecopyOnce (in their dest folder).  Once that's in place, remove all references to 'commonFiles'

### The project which spawned this one: Duality

My other (*very* early) project, called 'Duality', is an attempt to bring a Unity-like
experience to non-Unity (and even non-game) web apps.  As that Typescript project has gotten bigger and bigger, it was getting unwieldy
to manage; builds taking upwards of 30 seconds, ambient typings not always working, debugging occasionally not working, etc.
So I spawned off this separate effort to create an optimal (for my purposes) environment.

#### Why this project is structured as it is:
The Duality environment consists of the following components:
- Editor
  - This is the 'meat' of the project and includes everything needed to get a basic Unity-like experience in a webgl app
  - Apps can include it by including a single bundled "duality.js" file
- Plugins
  - Additional functionality can be included via plugins; e.g. I have a plugin that exposes inspectors for editor
objects, allowing debugging of the editor itself.  This is not something most apps would need, so it's available via a
separate plugin.
  - Plugins can be either built-in (included in the duality.js bundle), or included separately into an app
- Tests
  - Wallaby-based tests that vet out Editor functionality.
- Samples
  - Sample standalone apps that include and demonstrate editor functionality.
The interesting thing about using Duality as the basis for this build environment is that Duality's structure forces a number of different build types; some components are bundled
while others arent; some are minimized and some aren't; some have d.ts files generated and some don't; etc.
The '[Project System](#the-project-system)' section in this document covers some of these differences.

Side note: The project in this repo is not intended to be 'real' - it contains a few source files and projects to test and prove out the build system.

Sneak peak of the Duality project (Duality is the stuff around the cool water demo, which is itself found [here](http://madebyevan.com/webgl-water)):

<div style="text-align:center"><a href="http://getduality.com/websiteImages/dualitypreview.png"><img src="http://getduality.com/websiteImages/dualitypreview.png" alt="Duality Preview" width="400"/></a></div>

# VS Code
This project is currently built for VS Code only, because that's the environment that I use.

I assume most of this mostly works in other quasi-IDEs like Atom, but I haven't tried it yet.  I'll get to it eventually; but if that (or something else) is your environment of choice and you get it to work, then I'd love to add that in!

Note: I'm likely going to conflate the precise roles of Typescript and VS Code in this document; the lines between them blur at times for me (e.g. around tasks and tsconfig) and I haven't tried to suss out details.  I'll fix any incorrect assumptions over time.

# How to use the build environment
1. Get VS Code set up with the chrome debugging extension
2. Setup a local web server (I personally prefer [Fenix](http://fenixwebserver.com/))
    - Note: the port that launch.json uses is 1024; either use that one in Fenix when setting up the server, or pick a different number and update launch.json with that value. e.g.:
<br/>
<div style="text-align:center"><img src="http://getduality.com/websiteImages/fenixsetup.png" alt="Duality Preview" width="300"/></a></div>
  
3. npm install to get dependencies
<br/>
<div style="text-align:center"><img src="http://getduality.com/websiteImages/npminstall.png" alt="Installing via NPM"/></a></div>

4. Drop some breakpoints in to ensure that source maps are working as you expect, build, and F5.
5. To see the test runner work, just load tests.html after building.

# From the top: Using gulp, gulpfile.js, and tasks
While using the built-in tsc build system works well for relatively simple projects, I prefer gulp for anything more complex.
I assume grunt works just as well, but gulp is the one I've opted for here.

#### gulp and tasks.json

To build with gulp, you need a tasks.json file which tells VS Code what to do when you start a build.
There plenty of resources out there on how to get it set up, but here's a snippet from this project's tasks.json file.
You can see the command ('gulp') as well as the task ('build-all') which will get run.

```
{
    "version": "0.1.0",
    "isShellCommand": true,
    "command": "gulp",
    "tasks": [
        {
            "taskName": "build-all",
            "args": [],
            "isBuildCommand": true,
            "isWatching": false,
            "problemMatcher": [
                "$tsc"
            ]
    }]
}
```
* Resource: [Gulp documentation](https://github.com/gulpjs/gulp/blob/master/docs/README.md)
* Resource: [Tasks in VS Code](https://code.visualstudio.com/Docs/editor/tasks)

#### Tasks

When the build task is started, Gulp will automatically look for a file called 'gulpfile.js' in your root folder and run the 
named task ('build-all') from that file.

Typically a Task is defined in the gulpfile something like this:

```
gulp.task("build-all", function () {
    // Do stuff...
    console.log("test");
});
```

The flow goes like this:

1. User triggers a build in VS Code (e.g. presses shift+Command+B or shift+control+B, depending on your OS)
2. VS Code looks in tasks.json and finds the default task to run; in the above case, it's "build-all"
3. VS Code loads gulpfile.js and interprets it (note: could be cached for all I know), which registers task callbacks; in this case, for "build-all"
4. VS Code calls the function associated with the "build-all" string in the code immediately above
5. 'test' gets written to the console.

You can also run specific tasks other than the default with shift+command/control+p, run task, \<task name>

You can run a sequence of tasks from within the gulpfile itself with the well-named plugin, "run-sequence".  It looks something like this:

```
runSequence("clean", "build", "minify");
```

That said, see the section [Tasks, runSeries and runParallel](#tasks-runseries-and-runparallel) for why I pretty quickly jump out of the tasks-based world here and into functions.

* Resource: [Tasks overview on VS Code site](https://code.visualstudio.com/Docs/editor/tasks).
* Resource: [Tasks schema on VS Code site](https://code.visualstudio.com/docs/editor/tasks_appendix)
* Resource: [Why you shouldn't even ask 'can I pass parameters to a task using run-sequence?'](https://github.com/OverZealous/run-sequence/issues/68)

#### Gulpfile.ts

*TODO: Why not gulpfile.ts?  you can actually do this, and the appeal of proper classes here is hard to say no to; but the extra compile step makes me itchy, and I want to wait until everything else is rock-stable before introducing that.*

* Resource: [gulpfile.ts npm plugin](https://www.npmjs.com/package/gulpfile.ts)
* Resource: [creating a gulpfile using typescript](https://medium.com/@pleerock/create-a-gulpfile-and-write-gulp-tasks-using-typescript-f08edebcac57)

#### Just one 800 line file?  Really?  No desire to, say, split that up into rational components?

*TODO: You can break gulpfile.js apart, but I haven't tackled that yet.*

* Resource: [Splitting a gulpfile into multiple files](http://macr.ae/article/splitting-gulpfile-multiple-files.html)

# buildConfig.js

This file sits in the root of your build environment, alongside gulpfile.js.  It's loaded at the start of the build process,
and defines everything about building your project.  **This should be the only file that you have to change**.

See the buildConfig.js in this repo for an example of how it's used.  Here are the high level concepts:

```
var buildConfig = {
    bundle: {
        // information about the final bundled output.
        // note: currently required, and currently only supports 1.  need to generalize this.
    },
    projectGroups: {
        project1: {
            // project definition
        },
        project2: {
            // project definition
        },
        etc...
    },

    settings: {
        // Contains settings which direct the build process.
    },

    buildAll: function(...) {
        // Function that orders the actual build.  
        // TODO: Funky having it here, but I haven't generalized ordering yet, and don't want specifics of
        // project ordering to appear in the otherwise app-agnostic gulpfile.js
    }
}
```

Aspects of the above are discussed throughout the rest of this document.

# The Project System

The project system in this build environment supports a variety of self-contained projects as well as dependencies between them.

## ProjectGroups and Projects
ProjectGroups and Projects are the core top-level containers for the build system.
They are custom concepts created in this gulpfile; gulp has no built-in concept of projects.
One gulpfile compiles all of the Projects in all of the ProjectGroups.

### ProjectGroups
A ProjectGroup is a collection of Projects. A ProjectGroup contains information that pertains to all Projects in the group;
e.g. whether or not they are libraries, common files used by all of them, etc.  editor, plugins, tests, and samples are all examples of ProjectGroups.

Here's the structure of ProjectGroup:

| Field | Type | Description |
| --- | --- | --- |
| *name* | string | Name of the project group; output in the task header during build process |
| *isLibrary* | bool | If true, then output is a library; otherwise it's an app.  editor and plugins are libraries and tests and samples are apps.  See buildAppProject and buildLibProject for differences |
| *tsConfigFile* | string (optional) | The projects in a ProjectGroup can either (a) use a common tsconfig.json file, or (b) use a tsconfig file per project.  If (a), then set this to the location of that file |
| *filesToPrecopyToAllProjects* | fileCopy[] \(optional) | List of files that should be precopied to all projects within the ProjectGroup fileCopy structure = {src:string, dest: string}.  src is relative to root; dest is relative to each project's path |
| *filesToPrecopyOnce* | fileCopy[] \(optional) | List of files that should be precopied once before projects are compiled. Example usage: all tests reference the same duality*.d.ts, so copy it once into the tests/typings folder.  NOTE: paths are relative to root |
| *commonFiles* | string[] \(optional) | List of files that should be including in compilation of all projects in the ProjectGroup.  e.g. All Tests include tests/typings/*.d.ts |
| *projects* | Project[] | List of Projects within the ProjectGroup |

And here is an example of a ProjectGroup, including Projects within it:

```
var plugins = {
    name: "Plugins",
    isLibrary: true,
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
```

### Projects
Projects are the 'meat' of the system.  They come in two varieties; application projects and library projects.  Each project
is self-contained (but can contain dependencies on other previously-built projects).

Structure of Project object:

| Field | Type | Description |
| --- | --- | --- |
| *name* | string | Name of the Project
| *path* | string | Path of the Project relative to root
| *files* | string[] | List of files to compile; relative to project path.  If unspecified, defaults to '["**/*.ts"]', which == all TS files in the project folder.

#### Library Projects
Library Projects are projects that are intended to be used by apps.  Details:
- A Library Project's source files are transpiled into a single bundled output file which is dropped into /dist
- Both debug and minimized files are output (*-debug.js, *-min.js)
- Generates definition (*.ts) files and copies them into /dist/typings

This build environment includes the following ProjectGroups with Library Projects in them:
- Editor project: Generates editor-debug.js, editor-min.js, and editor.d.ts
- Plugins project: For each plugin, generates [pluginname]-debug.js, [pluginname]-min.js, and [pluginname].d.ts

#### Applications Projects
Application Projects are standalone apps which leverage the Library Projects. Details:

- Applications' source files are transpiled and not bundled; placed next to source files
  - Intent is to mirror what apps that use Duality will normally do.
- Only outputs debug .js files for now; no minimized ones (I will revisit that; easy to add.  Just wanted to test ability to differentiate).
- No definition file is generated

'Samples' and 'Tests' both contain examples of Application Projects.

# Folders
These are the folders that exist or are created by this build environment.

  - /bld
    - This is where built files for libraries are put.  Built files for apps end up alongside the apps' sourcecode
  - /dist
    - This is where final deliverables for the bundle, non-built-in plugins, and all built typings are placed
  - /editor
    - This is the main project.  It's a library.
  - /plugins
    - Contains a collection of 'built-in' and 'non-built-in' libraries
    - Built-in plugins are automatically included in the final bundle.  These are plugins that I expect every project will use, so they're "built in" to the bundle.  These could also go in the Editor project, but I've separated them for cleanliness's sake
    - Non-built in plugins are plugins that I will provide, but not every project will use them, so they aren't included in the bundle.  An app that uses one of these plugins would include the files output into /dist/plugins/<plugin-name>
  - /samples
    - Contains a collection of sample applications which include and use Duality.
    - Each sample has an index.html that can be directly loaded (but your webroot needs to be at the root of this repo's files)
  - /tests
    - Contains a collection of tests that demonstrate how to use wallaby to verify functionality of Duality and the plugins.
    - Contains a single tests.html file that can be directly loaded (but your webroot needs to be at the root of this repo's files)

# Managing and moving files between projects at build time

Projects are inherently self-contained; they define the files within them as well as metadata about the project.  However, there
are two instances in which Projects reach outside their path to acquire or place files:

#### Output Library code to /bld and /dist
Application Projects place compiled code alongside the source code to help them be more standalone.  Library Projects, however,
are not intended to be standalone; they're intended to be included in Applications.  As such, Library Projects build their source
into the /bld folder, and then place their final distributable files into the /dist folder.

/bld holds temporary files which aren't useful outside of debugging/understanding the build process.

/dist holds the final files that are intended to be used by applications.

#### Precopying files
ProjectGroups support copying previously built files into Projects.  This is useful for something like editor.d.ts, which all plugins need to use.
It needs to be copied after it gets built in an earlier part of the build process.

Note that, while we could just include editor.d.ts using the 'commonFiles' field described in a moment, it wouldn't get copied into the plugins' folders, and you therefore
wouldn't have ambient typings when editing the plugins.

There are two ways to copy files, both via  fields specified in a ProjectGroup:
- **filesToPrecopyToAllProjects**	- Optional list of files that should be precopied to all projects within the ProjectGroup.  Example usage, from the plugins ProjectGroup:
  ```
  filesToPrecopyToAllProjects: [{ src: "dist/typings/editor.d.ts", dest: "typings" }]
  ```
- **filesToPrecopyOnce** - Optional list of files that should be precopied once before projects are compiled.  Example usage, from the tests ProjectGroup:
  ```
  filesToPrecopyOnce: [{ src: "dist/typings/" + bundle.typingFilename, dest: "tests/typings" }]
  ```

##### Referencing common files
In addition to copying files into all Projects, you can also inject references to them in the ProjectGroup using the ProjectGroup's optional '**commonFiles**' field.  What this specifically
does is: adds the file to the Project's list of files to compile, but doesn't actually copy the file into the Project's folder.
This is useful when all Projects in a ProjectGroup reference the same file, and that file doesn't need to be present
in the Projects' folders.

Here's an example from the tests ProjectGroup,

```
commonFiles: ["tests/typings/*.d.ts"],
```

##### When to use which?
* Do you have a file that needs to be present in all folders for both (a) compilation and (b) ambient typings?
  - Do you have a separate tsconfig for each Project in the ProjectGroup?
    - YES: Use ProjectGroup.filesToPrecopyToAllProjects
    - NO: Use ProjectGroup.filesToPrecopyOnce
    - Why, you ask? You need to do this due to how ambient typings seem to work; my assumption based on experimentation -
     Ambient typings are resolved within the folder that has the tsconfig.json and all subfolders, but no parent folders.
      - The Samples ProjectGroup is an example of per-project tsconfig.json files (so it would ProjectGroup.filesToPrecopyToAllProjects for any d.ts files)
      - The Tests ProjectGroup  is an example of using a single shared tsconfig.json file between all projects (so it would ProjectGroup.filesToPrecopyOnce for any d.ts files)
* Do you have a file that needs to be present for compilation by all Projects in a ProjectGroup, but *isn't* in the Projects' folders?
  * Use ProjectGroup.commonFiles
  * ***TODO: THIS IS ONLY TEMPORARILY NECESSARY***.  When creating the list of files to compile, I should include all files in project.parentGroup.filesToPrecopyOnce (in their dest folder).
    * It's in the todo list at top of this file.

# Bundling
This build environment creates a bundle which includes all projects identified as libraries with includeInBundle = true.  This bundle
is the penultimate output of the whole process, containing the editor and all built-in plugins.  It is sufficient by itself, although
the build environment also outputs non-built-in libraries for optional inclusion by apps.

The final bundle is placed in /dist.

## The bundle object
This provides details about the bundled file that will be generated.  Here's what it looks like:

```
// Bundle definition
var bundle = {
    baseName: "duality",
    version: "0.0.1",
    modifiedBundleCache: {}
};
```

bundle.baseName and bundle.version are used to generate the final output filenames; e.g. with the above, we will get:

* duality-0.0.1-debug.js
* duality-0.0.1-min.js
* duality-0.0.1-d.ts

Ordering of files within the bundle is critical, and covered [here](#ordering-files-for-typescript-build).

## Internal Namespaces vs External modules

***TODO: The following is my unvetted assumption on how things work based on what I've seen***

When breaking your project apart into multiple files, you have two approaches to bundling and referencing functionality within other files:

1. Use Modules (nee 'external modules') and 'import'

    * I didn't do this as I want a single bundled file and single network call. I assume there's a magical way to start with this approach and have the build process do the bundle
  (an amorphous blob of phrases like 'webpack', 'browserify', and others comes to mind), but I didn't track that one down.
  Besides: coming out of .net, it's hard to say no to namespaces.  Yes, I'm weak.

2. Use Namespaces (nee 'internal modules') and '/// references'
    * This is the model I adopted here, for reasons.
    * See the section below on [Ordering files for typescript build](#ordering-files-for-typescript-build) for details.
    * I believe that this is the point where I had to add 'outFile:' to editor's tsconfig.json file.

Reference: [Names and Modules on Typescript site](https://www.typescriptlang.org/docs/handbook/namespaces-and-modules.html)

### Other notes

***TODO: Typescript's --out option.  Didn't work for me; remember why.***

# Build Settings
The following settings are defined in buildConfig.js:
    
```
buildConfig.settings = {
    // Dump extra output during the build process
    verboseOutput: true,

    // If true, then don't parallelize tasks.  Not something you would usually set; mostly just useful if you
    // are having build issues and want cleaner output.
    forceSerializedTasks: false,

    // Set to true to enable project-level incremental builds.  File-level incremental builds are handled by a
    // persistent 'watch' task, as TSC needs all files to compile properly.  Using gulp.watch maintains some state to
    // reduce compilation time (about 10% in this sample on this machine.  I suspect a 'real' project with more files
    // to compile would see more improvement).
    incrementalBuild: true,

    // By default, an incremental build would rebuild if *any* file in a project changes, including d.ts files.
    // However, I think that you can skip recompilation of a project if only d.ts files have changed.  This field
    // manages that.  If you're seeing weird incremental build behavior then try setting this to true, and let me know
    recompiledOnDTSChanges: false
};
```

# Debug and minified builds
***TODO: This section***
  
# Incremental Builds
***TODO: This section***

  - What not to do: gulp-changed-in-place
    - This is what I naively started with.
    - Works great in lot of situations; but not a typescript one
    - Reason: typescript compiler needs all .ts files, not just changed ones
  - What to do: two things:
    - Using gulp.watch for file-level modification checking
      - How it works: always-running task keeps state between builds, allowing it to maintain some info between runs.  What info? It's magic!
      - What you get: file-level checks.  ~15% perf improvement in this sample, likely more in 'real' projects (the claim is 50% reduction in compile time)
    - Using project-level modification checking
      - Only applies if your project is like this one and has multiple contained projects; dependencies between them okay
      - If it does apply, then you can see _massive_ compilation improvements here.  My duality project has about 200 .ts files in it, and being able to iteratively develop a sample without having to recompile the editor, plugins, and tests everytime is ridiculously nice (e.g. cuts a 30 second build time down to < 1 second!)
      - How it works
        - Maintains project-level modifiedFilesCache and tracks last modified times
          - Of note: using gulp.src().dest() works for copying a file, *but* it updates the last modified time in the process, which breaks how project-level incremental builds work.  Gulp-preserve-time to the rescue!
        - Building and bundling
          - Basically the same as Project building and bundling, except there's no project to track bundle, so the bundle's cache is instead tracked in bundle.modifiedCache.
  - Other options:
    - IsolatedModules.  Why not here?  Include links from comment
  - Settings
    - incrementalBuild
    - recompiledOnDTSChanges

# Ordering files for typescript build

Imagine that you have the following files:

```
// Creature.ts
class Creature {
    constructor() {
      console.log("Creature (base class)");
    }
}
```
... and:
```
// Animal.ts
class Animal extends Creature {
    constructor() {
      console.log("Animal (derived class)");
    }
}
```
... and let's say you transpile and bundle those into a file called "bundle.js" using something like this:
```
  gulp.src(["**\*.ts"])
    .pipe(ts())
    .pipe(concat("bundle.js"))
    .pipe(dest(".")
```

Everything works until you run it and get the following:

*(todo: include error)*

Take a look at the output:

*(todo: include bundle.js)*

\<Assumption!>

The problem is that the derived class (Animal) is getting defined before the base class (Creature)
has beeen defined, and when it tries to complete the definition of Animal by calling super on the (at-the-time-nonexistent) Creature
class, it can't. 

\</Assumption!>

*TODO: Double-check that the above is exactly what's happening.  I believe it to be the case, but something keeps making*
*me wonder why they couldn't make the completion of the definition more late-binding, after the classes have been declared but not defined.*

So, either way: when compiling Typescript, you need to order your classes so that base classes come first.  You have a couple of
options here:

#### Option 1: Specify the order in build.

e.g. Instead of:

```
gulp.src(["**\*.ts"])
```
... use:
```
gulp.src(["Creature.ts", "Animal.ts])
```
This works, but in an eye-roll-y sort of way; and in a way that only becomes uglier the more files (and dependencies)
that you add.  It also moves management of the dependency out of the dependent file (the derived class) and into the
build system, which just sounds wonky when you say it out loud.

#### Option 2: Use external modules and use 'requires'

Perfectly reasonable approach, but one that I haven't dug into here since I'm not using external modules.  Note that this
suffers from some of the same challenges as option 3 (having to be explicit about id'ing dependencies in the code)

#### Option 3: Use /// \<reference path="..."/>

Similar to 'requires' with external modules, you can explicitly define the dependency in the source file and the compiler
takes care of the ordering for you.

*TODO: Is it accurate to say "this is the namespace (internal module) equivalent to external modules' "requires"? Or*
*does this also apply to external modules?*

So in the Animal.ts/Creature.ts example above, all you'd do is change Animal.ts as following:

```
/// <reference path="Visual.ts"/>
class Animal extends Creature {
    constructor() {
      console.log("Animal (derived class)");
    }
}
```
Now when you compile, it works.
This option (as with option 2) requires more upfront and ongoing effort to expressly communicate the dependencies to the
compiler.

For this project, I started with option 1 first, but as the number of files got larger and larger I felt grosser and
grosser about managing this large list of files.  I then moved onto option 3 and haven't looked back.  That said: the
management of the dependencies through the 'reference' tags still makes me uncomfortable, because if you miss one you 
might not catch the issue until much later when some other build change changes the order of compilation and suddenly
that dependency isn't present...

# Typings
***TODO: This section***

  - Ambient typings
    - Tsconfig.json folder-level
  - Generating definition files (.d.ts)
    - Goal: \*.d.ts files get generated for every library and the bundle
    - What not to do: use built-in typescript/vscode
      - todo: recap why this didn't work.
    - What to do
  - Using 3PP libraries &amp; typings
    - Don't have details on this yet.  I've stumbled my way into adding jquery to the project as a test and it works; but the recent (?) move to 'typings' has left a lot of dated info out there on how best to do this.  I need to dig more into this.

# Tasks, runSeries and runParallel
***TODO: This section***

  - &quot;I want to pass parameters to my task rather than have do-thing-project1, do-thing-project2, do-thing-project3&quot;
    - Yeah, I did too.  Short version: no.  &lt;link&gt;
    - Alternative: write top-level tasks that quickly drop into functions.
    - You lose some debug output.  taskTracker to the rescue! &lt;link&gt;
  - Running a collection of tasks in series; e.g.: build, then minify
    - Approaches: stream-series
    - Why write my own?  To learn!
    - &lt;what's interesting about it?&gt;
    - &lt;what probably doesn't work?&gt;
  - Running a collection of tasks in parallel; e.g. build samples 1, 2, and 3
    - Approaches: eventStream.merge.  works perfectly fine.
    - Why write my own?  To allow me to at-run-time opt to force serialization of all tasks
  - Promises and Streams

# tsconfig.json
***TODO: This section***

  - Different approaches; one top level, one per projectgroup (eg the tests projectgroup does this),
   one per project (e.g. the samples projectgroup does this).
  - Why I did it this way: two reasons:
    1. Different projects may have different tsconfig needs; e.g. the editor project defines outFile, while the other projects don't
    2. I want to make the samples projects more standalone.
  - How to specify: &lt;setting in project/projectgroup defn&gt;
  - See note in ambient typings section about how tsconfig.json impacts them.

# taskTracker
Simple way to output task start and end times using gulp's formatting.  Useful since I jump
out of tasks and into functions pretty quickly in this project because parameters are nice (DRY, you know?)

Using it is easy: Include the following before a task

```
    var taskTracker = new TaskTracker("precopyRequiredFiles");
```

and this after it:

```
taskTracker.end()
```

I typically call taskTracker.end() in a gulp call using the 'end' stream event, like this:

```
var taskTracker = new TaskTracker("doing the compile thing");
return gulp.src(filesToCompile)
           .pipe(ts())
           .pipe(gulp.dest(".")
           .on("end", () => taskTracker.end());

```

which gives me output like this:

```
[07:48:47] Starting doing the compile thing
[07:48:48] Finished doing the compile thing after 0.15 s
```

# Sourcemap-based debugging
***TODO: This section***

  - Okay, so after all of the above, we finally get to the whole point of this thing: debugging
  - How sourcemaps work.
    - Sources, sourceRoot, and the joy of relative and absolute paths.
    - Annoyances with folders
    - The bane of the grey debugging circle
    - How to debug sourcemaps
      - edit them directly!
    - The house of cards that is getting sourcemaps set up with multiple folders.
      - Combo of: Tsconfig's outfile (&quot;willgetrenamedanways.js&quot;)
        - Sourcemaps not found without this.  Need to remember why…
      - Gulp.src's &quot;base&quot; field
      - Proper basing of files
      - And the coup de grace: removing the front slash from minified builds.

# Debugging the gulpfile
Here's how to debug the build environment itself; add the following to launch.json's configurations group, and then select
the 'node gulp.js' option from VS Code's debug dropdown, drop a breakpoint into gulpfile.js, and build.
```
{
    "name":"node gulp.js ...",
    "request": "launch",
    "type":"node",
    "program":"${workspaceRoot}/node_modules/gulp/bin/gulp.js",
    "stopOnEntry":false,
    "args":["build-all"],
    "cwd":"${workspaceRoot}",
    "runtimeExecutable": null,
    "env":{}
}
```
Note that you'll can specify the build task to run via the 'args' field

# Running tests
***TODO: This section***

  - Wallaby
  - Tests.html
  - Typings; jasmine.  Shared copy of duality

# Lessons learned while doing this
Things that I discovered or worked out as I was creating this project.

Note: all are as of time of writing.  Thx to internet reality, likely out of date by the time you read this.  Hello future reader!

#### problemMatchers don't work with output window
* Q: Why isn't tsc problem matcher working?
* A: Because pattern matchers don't (yet) apply to output window, which only works with absolute paths
* SEE: [https://github.com/Microsoft/vscode/issues/6217](https://github.com/Microsoft/vscode/issues/6217)

#### Chrome's massively annoying "Restore pages?" dialog
Does Chrome complain every time you stop and restart debugging with a dialog about not shutting down correctly?
<br/>
<div style="text-align:center"><img src="http://getduality.com/websiteImages/hateThisDialog.png" alt="God I hate this dialog"/></a><br/>
<i>God I hate this dialog</i></center></div>

To fix this, Add this to your build configuration in launch.json:
```
"runtimeArgs": [
    "--disable-session-crashed-bubble",
    "--disable-infobars"
]
```

#### How do I call a function when gulp is done?
Want to call a function when gulp finishes it's thing?  Listen for 'end' and call your function; e.g. add this to the end of the list of pipes:

```
  .on("end", () => taskTracker.end());
```

#### Want to compile faster?

Add skipLibCheck:true to tsconfig.json (all of them).  This skips type-checking of d.ts files.

Reference: [Typescript 2.1 what's new](https://github.com/Microsoft/TypeScript/wiki/What's-new-in-TypeScript#new---skiplibcheck)

#### Why not just use "declaration:true" in tsconfig.json to get d.ts files?

It doesn't work with allowJS: true.  I want that for some reason...
TODO: remember why.

#### Want to filter to just changed files?
See the section above on incremental builds for why you don't.  But if you *do*, then:

Option 1: Use [gulp-changed-in-place](https://github.com/alexgorbatchev/gulp-changed-in-place)
* Pro: Does what it says it does
* Con: Uses expensive hashes instead of checking modification time.  On the plus side, that's probably a safer way to go in some edge cases.

Option 2: Check out the commented-out filterToChangedFiles function in this project's gulpfile.js.
* Pro: Uses faster timestamp comparison.
* Con: Not tested against scenarios like deleted files.

#### Want to see what files are in the current stream?
See the commented-out outputFilesInStream function in this project's gulpfile.js.  It can be used like this:

```
return gulp.src(filesToCompile)
           .pipe(ts())
           .pipe(outputFilesInStream())
           .pipe(gulp.dest(".");
```
