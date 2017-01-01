# typescript-gulp-sample
This project demonstrates one way to setup a gulp-based development environment for Typescript with the following features:
- Debug and minified builds
- Sourcemap-based debugging
- File- and Project-level incremental compilation
- Bundling output into a single file
- How to work with namespaces (internal modules) and /// reference
- Ensuring proper ordering of files (e.g. base classes before derived classes) in the build
- Automatic generation of typings, and ambient typings while dev'ing
- Wallaby-based test runner

The project-level incremental builds are particularly nice for complex builds and in my experience
can substantially reduce compilation during development.

# Installing and running the example build environment

1. Set up VS Code with the chrome debugging extension
2. Setup a local web server (I personally prefer [Fenix](http://fenixwebserver.com/))
    - Note: the port that the project's launch.json uses is 1024; either use that one in Fenix when setting up the server, or pick a different number and update launch.json with that value. e.g.:
<br/>

<p align="center">
<img src="http://getduality.com/websiteImages/fenixsetup.png" alt="Duality Preview" width="300"/></a>
</p>
  
3. ```npm install``` in the project root to get dependencies
<br/>

<p align="center">
  <img src="http://getduality.com/websiteImages/npminstall.png" alt="Installing via NPM"/></a>
</p>

4. Drop some breakpoints in (e.g. to /editor/controls/label.ts) to ensure that source maps are working as you expect
5. build and F5.
6. To see the test runner work, build and then load tests.html

# Steps to using this build environment in your own projects

This assumes you already have a basic Typescript project set up and running.  

***Important: This build environment has not been deeply tested yet.  Be sure to backup your project first to ensure nothing gets messed up!***

1. Copy tasks.json, gulpfile.js and the gulpBuild folder to your project
2. Create a new file called 'buildConfig.js' and place it in your project's root.
3. Populate buildConfig.js with your build configuration.
    * The buildConfig.js files in the root and in the moreExampleBuildEnvs folder are good starting points.
    * The Wiki links below

# Sample configurations

The following sample configurations are included in this repo, with the hope that at one will be close to your own existing
build environment.  If you'd like to see another, let me know!

| Sample | Demonstrates |
| --- |--- |
| /buildConfig.js | This is the default build configuration for the sample, and it flexes many aspects of the build environment.  It's also the one that my 'Duality' project uses.
| moreExampleBuildEnvs/simpleApp | The simplest example; a single app
| moreExampleBuildEnvs/SimpleLibraryAndApp | Extends the above with another project that builds a separate library
| moreExampleBuildEnvs/SimpleAggregateBundle | Extends the above by bundling the app and library together into a single output file
| moreExampleBuildEnvs/programmaticBuildConfig | Example of how to use the WIP buildconfig APIs rather than defining your build config as a javascript object
| moreExampleBuildEnvs/externalModuleReferenceBundle | Shows how to use external modules and '/// reference...' tags
| moreExampleBuildEnvs/externalModuleImportBundle | Shows how to use external modules and 'import'; combines the library project's exports into a single importable.
| moreExampleBuildEnvs/externalModuleImportBundle2 |  Shows how to use external modules and 'import'; keeps the library project's exports distinct 

The following build configurations are planned for the future, or are checked in in 'WIP' format:

| Sample | Demonstrates |
| --- |--- |
| moreExampleBuildEnvs/externalModuleBundleWithLoader | [WIP] This config will demonstrate how to bundle the module loader in with your code.
| moreExampleBuildEnvs/externalModuleBundleSystemJS | [FUTURE] This config will demonstrate how to work with systemjs modules in this build environment
| moreExampleBuildEnvs/externalModuleBundleCommon | [FUTURE] This config will demonstrate how to work with common modules in this build environment
| moreExampleBuildEnvs/externalModuleBundleAMD | [FUTURE] This config will demonstrate how to work with AMD modules in this build environment
| moreExampleBuildEnvs/externalModuleAsyncLoad | [FUTURE] This whole build env is designed for client-side apps which bundle all output js into a single file.  This sample will demonstrate how to use the environment in 
something more like a node.js environment where you may want to asynchronously load modules.  I believe it'll be as simple as disabling bundling.

# Why this repo exists

My other (*very* early) project, called 'Duality', is an attempt to bring a Unity-like
experience to non-Unity (and even non-game) web apps.  As that Typescript project has gotten bigger and bigger, it was getting unwieldy
to manage; builds taking upwards of 30 seconds, ambient typings not always working, seemingly-arcane 'duplicate definition' errors, debugging occasionally not working, etc.
So I spawned off this separate effort to create an optimal (for my purposes) environment.

Sneak peak of the Duality project (Duality is the stuff around the cool water demo, which is itself found [here](http://madebyevan.com/webgl-water)):

<div style="text-align:center"><a href="http://getduality.com/websiteImages/dualitypreview.png"><img src="http://getduality.com/websiteImages/dualitypreview.png" alt="Duality Preview" width="400"/></a></div>

# More details
You can read more about how this environment works, and general Typescript/gulp tips and tricks I've stumbled across, in this repo's wiki:

About the build environment
* [The Build Environment](https://github.com/jeffsim/typescript-gulp-sample/wiki/The-Build-Environment)
* [Build Settings](https://github.com/jeffsim/typescript-gulp-sample/wiki/Build-Settings)
* [Bundling](https://github.com/jeffsim/typescript-gulp-sample/wiki/Bundling)
* [Debug and minified builds](https://github.com/jeffsim/typescript-gulp-sample/wiki/Debug-and-minified-builds)
* [Incremental Builds](https://github.com/jeffsim/typescript-gulp-sample/wiki/Incremental-Builds)
* [Managing and moving files between projects at build time](https://github.com/jeffsim/typescript-gulp-sample/wiki/Managing-and-moving-files-between-projects-at-build-time)
* [Ordering files for typescript build](https://github.com/jeffsim/typescript-gulp-sample/wiki/Ordering-files-for-typescript-build)
* [Tasks, runSeries and runParallel](https://github.com/jeffsim/typescript-gulp-sample/wiki/Tasks,-runSeries-and-runParallel)
* [taskTracker](https://github.com/jeffsim/typescript-gulp-sample/wiki/taskTracker)
* [tsconfig.json](https://github.com/jeffsim/typescript-gulp-sample/wiki/tsconfig.json)

General Typescript and gulp topics
* [Overview: Typescript with gulp, gulpfile.js, and tasks](https://github.com/jeffsim/typescript-gulp-sample/wiki/Overview:-Typescript-with-gulp,-gulpfile.js,-and-tasks)
* [Tips and tricks; lessons learned](https://github.com/jeffsim/typescript-gulp-sample/wiki/Tips-and-tricks;-lessons-learned)
* [Typings](https://github.com/jeffsim/typescript-gulp-sample/wiki/Typings)

Running code
* [Debugging the gulpfile](https://github.com/jeffsim/typescript-gulp-sample/wiki/Debugging-the-gulpfile)
* [Running tests](https://github.com/jeffsim/typescript-gulp-sample/wiki/Running-tests)
* [Sourcemap based debugging](https://github.com/jeffsim/typescript-gulp-sample/wiki/Sourcemap-based-debugging)
