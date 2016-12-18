

**This readme is very much a work in progress!**

# What is this?

- My evolving effort to create a reasonable build system for my own projects which supports:
  - Typescript
  - Gulp-based builds
  - Bundling library output into a single js file using namespaces (not external modules)
  - Proper ordering of files (e.g. baseclasses before derived classes) in the build
  - Ambient typings working throughout while editing
  - Generation of a bundled d.ts file for your project
  - How to get one gulpfile to work with multiple projects and multiple tsconfigs
  - VS Code environment
  - debug and minified builds
  - Sourcemap-based debugging
  - Incremental compilation (so fast!)
  - Including 3PP library and d.ts (jquery)
  - Wallaby-based test runner
- The overall project; Duality
  - Editor + Plugins + Tests + Samples
- The main thing I&#39;m trying to properly support with this is Typescript, because (1) I really like it, and (2) it can be a PITA to get a full dev environment set up for a complex project with proper ambient typings, no &quot;duplicate symbol&quot; warnings, etc.
- This started simple, but has added more functionality and more abstraction over time.
- This document: me documenting how I tackled each aspect.  There are likely better ways to do parts of this; if so, I&#39;d love to know about it!

# To run it

-
  - npm install (in the root)
  - load  in vs code and drop some breakpoints in to ensure that source maps are working as you expect, build, and F5.
  - To see the test runner work, just load tests.html.

# VS Code

-
  - Because I&#39;m ex-Microsoft, and anything with &quot;VS&quot; in it gets my love.  Besides which, it&#39;s good!
  - I assume most of this works fairly well in other quasi-IDEs like Atom, but I haven&#39;t tried it yet.  I&#39;ll get to it eventually; but if that (or something else) is your environment of choice and you get it to work, then I&#39;d love to add that in!
  - Note: I&#39;m likely going to conflate the precise roles of Typescript and VS Code in this document; the lines between them blur at times for me.  I&#39;ll fix any incorrect assumptions over time.

# Using gulp and tasks

-
  - Gulpfile.js and vs code tasks
  - Why not gulpfile.ts?  you can actually do this (links), and the appeal of proper classes here is hard to say no to; but the extra compile step makes me itchy, and I want to wait until everything else is rock-stable before introducing that.
  - Why one file? You can break it apart (links), but I haven&#39;t tackled that yet.

# Project system

-
  - Projectgroups and projects
    - My approach to localizing code
    - One gulpfile compiles all of them
  - Two types of projects: apps and libs
    - Libs: minimized, transpiled files placed in dist, d.ts files gen&#39;ed
    - Apps: standalone, not minimized, transpiled files placed next to sources, no d.ts file gen&#39;ed
  - Fields (include from comments)

# Folders

-
  - /bld
  - /dist
  - /editor
    - libs
  - /plugins
    - Libs
  - /samples
    - apps
  - /tests
    - Apps

# Managing and moving files between projects at build time.

-
  - Building – files can be built into /dist or into source folder
  - Files can be precopied at projectgroup or project level
  - Files can be included without being copied (commonfiles).  Avoids.. duplication?

# Bundling

-
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

-
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

-
  - Base and derived; \*.ts not sufficient to guarantee order
  - Option 1: specify order in build. Works, but in an eye-roll-y sort of way
  - Option 2: external modules and requires.  Not here since not using external modules
  - Option 3: /// reference.  Works, but bit of upfront and ongoing &quot;ugh, right&quot; effort.
  - Went with option 1 first, then opted for 3, because reasons.

# Typings

-
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

-
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
    - Why write my own?  To learn!
    - &lt;what&#39;s interesting about it?&gt;
    - &lt;what probably doesn&#39;t work?&gt;
  - Promises and Streams

# Tsconfig

-
  - Different approaches; one top level, one per projectgroup (tests), one per project (sample)
  - Why I did it this way:  a test, really.  I assumed at some level that I&#39;ll eventually run into a project that needed different tsconfig settings, so I built support for it.
  - How to specify: &lt;setting in project/projectgroup defn&gt;
  - See note in ambient typings section about how tsconfig.json impacts them.

# taskTracker

# Sourcemap-based debugging

-
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

-
  - Gulp task to debug gulpfile.js

# Running tests

-
  - Wallaby
  - Tests.html
  - Typings; jasmine.  Shared copy of duality

# Lessons learned/what if I see &quot;error: X&quot;

-
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

