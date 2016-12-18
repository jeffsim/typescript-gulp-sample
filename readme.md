

**This readme is very much a work in progress!**

# What is this?

- My evolving effort to create a reasonable build system for my own projects which supports:
  - Typescript
  - Gulp-based builds
  - Bundling library output into a single js file using namespaces (not external modules)
  - Proper ordering of files (e.g. baseclasses before derived classes) in the build
  - Ambient typings working throughout while editing
  - Generation of d.ts files for not-built-in plugins and an all-up bundled d.ts for everthing bundled
  - File- and Project-level incremental compilation
  - How to get one gulpfile to work with multiple projects and multiple tsconfigs
  - debug and minified builds
  - Sourcemap-based debugging
  - Including 3PP library and d.ts (jquery)
  - Wallaby-based test runner
- The overall project; Duality
  - Editor + Plugins + Tests + Samples
- The project in this repo is NOT intended to be 'real' - it contains a few source files and projects to test and prove out the build system.  I'll eventually link to the real project that this will support (called 'duality') once that's in shareable shape.
- The main thing I&#39;m trying to properly support with this is Typescript, because (1) I really like it, and (2) it can be a PITA to get a full dev environment set up for a complex project with proper ambient typings, no &quot;duplicate symbol&quot; warnings, etc.
- This started simple, but has added more functionality and more abstraction over time.
- This document: me documenting how I tackled each aspect.  There are likely better ways to do parts of this; if so, I&#39;d love to know about it!

# To run it

  - npm install (in the project root folder)
  - load the project in vs code and drop some breakpoints in to ensure that source maps are working as you expect, build, and F5.
  - To see the test runner work, just load tests.html.

# VS Code

  - Because I&#39;m ex-Microsoft, and anything with &quot;VS&quot; in it gets my love.  Besides which, it&#39;s good!
  - I assume most of this works fairly well in other quasi-IDEs like Atom, but I haven&#39;t tried it yet.  I&#39;ll get to it eventually; but if that (or something else) is your environment of choice and you get it to work, then I&#39;d love to add that in!
  - Note: I&#39;m likely going to conflate the precise roles of Typescript and VS Code in this document; the lines between them blur at times for me (e.g. around tasks and tsconfig).  I&#39;ll fix any incorrect assumptions over time.

# Using gulp and tasks

  - Gulpfile.js and vs code tasks
  - Why not gulpfile.ts?  you can actually do this (links), and the appeal of proper classes here is hard to say no to; but the extra compile step makes me itchy, and I want to wait until everything else is rock-stable before introducing that.
  - Why one file? You can break it apart (links), but I haven&#39;t tackled that yet.

# Project system

  - ProjectGroups and Projects
    - My approach to making code more contained and manageable.
    - One gulpfile compiles all of them
  - Two types of projects: apps and libs
    - This build env handles two different types of projects; applications and libraries
    - Libs: minimized, transpiled files placed in dist, d.ts files gen'ed
      - Examples: Editor, Plugins
    - Apps: standalone, not minimized, transpiled files placed next to sources, no d.ts file gen'ed
      - Examples: Samples, Tests
  - Fields (include from comments)
    - Editor, Plugins, Tests, and Samples are all defined using a common project format so that they can be handled generically.  All projects must have at minimum: name:string, path:string, and files:string[]
    - editor, plugins, tests, and samples are all examples of ProjectGroups.  Here's the structure of ProjectGroup:
      -  *name*:string                 Name of the project group; output in the task header during build process.
      -  *isLibrary*:bool              If true, then output is a library; otherwise it's an app.  editor and plugins are libraries and tests and samples are apps.  See buildAppProject and buildLibProject for differences.
      -  *tsConfigFile*:?string        The projects in a ProjectGroup can either (a) use a common tsconfig.json file, or (b) use a tsconfig file per project.  If (a), then set this to the location of that file.
      -  *filesToPrecopyToAllProjects*?:fileCopy[]  Optional list of files that should be precopied to all projects within the ProjectGroup fileCopy structure = {src:string, dest: string}.  src is relative to root; dest is relative to each project's path.
      -  *filesToPrecopyOnce*?:fileCopy[]  Optional list of files that should be precopied once before projects are compiled. Example usage: all tests reference the same duality*.d.ts, so copy it once into the tests/typings folder.  NOTE: paths are relative to root.
      -  *commonFiles*?:string[]       Optional list of files that should be including in compilation of all projects in the ProjectGroup.  e.g. All Tests include tests/typings/*.d.ts.
      -  *projects*:Project[]          List of Projects within the ProjectGroup.
    - Structure of Project object:
      -  *name*: string                Name of the Project
      -  *path*: string                Path of the Project relative to root
      -  *files*: string[]             List of files to compile; relative to project path.  If unspecified, defaults to '["**/*.ts"]', which == all TS files in the project folder.
    - NOTE: each ProjectGroup can also define its own additional properties; e.g. the editor ProjectGroup includes version
# Folders

  - /bld
    - This is where built files for libraries are put.  Built files for apps end up alongside the apps' sourcecode
  - /dist
    - This is where final deliverables for the bundle, non-built-in plugins, and all built typings are placed
    - TODO: currently putting built-in-plugin d.ts files here; no need.
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

# Managing and moving files between projects at build time.

  - Building – files can be built into /dist or into source folder
  - Files can be precopied at projectgroup or project level
  - Files can be included without being copied (commonfiles).  Avoids.. duplication?

# Bundling

  - Options:
    - Typescript&#39;s --out option.  Todo: why did I lean away from this one?
    - external modules and requires: didn&#39;t do this as I want a single bundled file and single network call.  I assume there&#39;s a magical way to start with this approach and have the build process do the bundle (an amorphous blob of phrases like webpack (todo: and others) comes to mind), but I didn&#39;t track that one down.  Besides: coming out of .net, it&#39;s hard to say no to namespaces.
    - internal modules (namespaces) and /// references.
  - Builds one bundle with main project (editor) and all built-in plugins
  - Every library project with &#39;includeInBundle:true&#39; is included in the bundle.
  - Editor version
  - Files output; duality-0.0.1-debug.js, duality-0.0.1-min.js, duality-0.0.1.d.ts.
  - See section on ordering files below.

# Debug and minified builds

# Incremental Builds

  - What not to do: gulp-changed-in-place
    - This is what I naively started with.
    - Works great in lot of situations; but not a typescript one
    - Reason: typescript compiler needs all .ts files, not just changed ones
  - What to do: two things:
    - Using gulp.watch for file-level modification checking
      - How it works: always-running task keeps state between builds, allowing it to maintain some info between runs.  What info? It&#39;s magic!
      - What you get: file-level checks.  ~15% in this sample, likely more in &#39;real&#39; projects (the claim is 50% reduction in compile time)
    - Using project-level modification checking
      - Only applies if your project is like this one and has multiple contained projects; dependencies between them okay
      - If it does apply, then you can see _massive_ compilation improvements here.  My duality project has about 200 .ts files in it, and being able to iteratively develop a sample without having to recompile the editor, plugins, and tests everytime is ridiculously nice.
      - How it works
        - Maintains project-level modifiedFilesCache and tracks last modified times
          - Note: need to change gulp.src.dest (fileCopy) to preserve modified time.  Gulp-preserve-time to the rescue!
          - Before building a project
        - Building and bundling
          - Basically the same, but no project to track bundle, so tracks in globals.modifiedBundleCache.  Yeah, I should project-ify the bundling; noted.
  - What else you can do:
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

The problem is that the derived class (Animal) is getting defined before the base class (Creature)
has beeen defined, and when it tries to complete the definition of Animal by calling super on the (at-the-time-nonexistent) Creature
class, it can't. 

*TODO: Double-check that the above is exactly what's happening.  I believe it to be the case, but something keeps making*
*me wonder why they couldn't make the completion of the definition more late-binding, after the file has been loaded.*

So: when compiling Typescript, you need to order your classes so that base classes come first.  You have a couple of
options here:

1 - Specify the order in build.

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
build system, which just sounds wonky.

2 - Use external modules and use 'requires'

Perfectly reasonable approach, but one that I haven't dug into here since I'm not using external modules.  Note that this
suffers from some of the same challenges as option 3 (having to be explicit about id'ing dependencies in the code)

3 - Use /// \<reference path="..."/>

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

  - Ambient typings
    - Tsconfig.json folder-level
  - Generating definition files (.d.ts)
    - Goal: \*.d.ts files get generated for every library and the bundle
    - What not to do: use built-in typescript/vscode
      - Why?
    - What to do
  - Using 3PP libraries &amp; typings
    - Don&#39;t have details on this yet.  I&#39;ve stumbled my way into adding jquery to the project as a test and it works; but the recent (?) move to &#39;typings&#39; has left a lot of dated info out there on how best to do this.  I need to dig more into this.

# Tasks, runSeries and runParallel

  - &quot;I want to pass parameters to my task rather than have do-thing-project1, do-thing-project2, do-thing-project3&quot;
    - Yeah, I did too.  Short version: no.  &lt;link&gt;
    - Alternative: write top-level tasks that quickly drop into functions.
    - You lose some debug output.  taskTracker to the rescue! &lt;link&gt;
  - Running a collection of tasks in series; e.g.: build, then minify
    - Approaches: stream-series
    - Why write my own?  To learn!
    - &lt;what&#39;s interesting about it?&gt;
    - &lt;what probably doesn&#39;t work?&gt;
  - Running a collection of tasks in parallel; e.g. build samples 1, 2, and 3
    - Approaches: eventStream.merge.  works perfectly fine.
    - Why write my own?  To allow me to at-run-time opt to force serialization of all tasks
  - Promises and Streams

# Tsconfig

  - Different approaches; one top level, one per projectgroup (tests), one per project (sample)
  - Why I did it this way:  a test, really.  I assumed at some level that I&#39;ll eventually run into a project that needed different tsconfig settings, so I built support for it.
  - How to specify: &lt;setting in project/projectgroup defn&gt;
  - See note in ambient typings section about how tsconfig.json impacts them.

# taskTracker

# Sourcemap-based debugging

  - Okay, so after all of the above, we finally get to the whole point of this thing: debugging
  - How sourcemaps work.
    - Sources, sourceRoot
    - Annoyances with folders
    - The bane of the grey debugging circle
    - How to debug sourcemaps
    - The house of cards that is getting sourcemaps set up with multiple folders.
      - Combo of: Tsconfig&#39;s outfile (&quot;willgetrenamedanways.js&quot;)
        - Sourcemaps not found without this.  Need to remember why…
      - Gulp.src&#39;s &quot;base&quot; field
      - Proper basing of files
      - And the coup de grace: removing the front slash from minified builds.

# Debugging the gulpfile

  - Gulp task to debug gulpfile.js

# Running tests

  - Wallaby
  - Tests.html
  - Typings; jasmine.  Shared copy of duality

# Lessons learned/what if I see &quot;error: X&quot;

  - Note: all are as of time of writing.  Thx to internet reality, likely out of date by the time you read this.  Hello future reader!
  - problemMatchers don&#39;t work with output window
  - debugging with chrome
    - &quot;--disable-session-crashed-bubble&quot;,
    - &quot;--disable-infobars&quot;
  - How to know if a stream ended?
    - .on(&quot;end&quot;, () =&gt; taskTracker.end());
  - Gulp.src &amp; base
  - Faster compiles
    - Tcsonfig: skipLibCheck
  - Why not just use tsconfig&#39;s &quot;declaration:true&quot;?
    - Doesn&#39;t work with allowJS: true.  I want that for some reason…
  - Filtering to changed files
    - Implemented my own &quot;gulp-changed-in-place&quot; which uses timestamps instead of hashes for speed.  Can be found in the commented-out filterToChangedFiles function.
  - Outputing files in stream
    - See outputFilesInStream

