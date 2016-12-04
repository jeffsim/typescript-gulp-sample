# Gulp example for Typescript

This Typescript project was created as a part of another coding project (as-yet-unpublished); this is my attempt to stand up a development environment that supports the following:

* Typescript
* Gulp-based builds
* Proper ordering of files (e.g. baseclasses before derived classes) in the build
* Ambient typings working throughout while editing
* Generation of a bundled d.ts file for your project
* How to get one gulpfile to work with multiple projects and multiple tsconfigs
* Bundling library output into a single js file
* VS Code environment (likely works in Atom and other IDEs/editors as well, possibly with some tweaks)
* debug and minified builds
* Sourcemap-based debugging
* Incremental compilation (so fast!)
* Including 3PP library and d.ts (jquery)
* Wallaby-based test runner

# folder structure
My other coding project is an in-app editor for javascript apps; as such, this test environment has the following folder structure (note: none of it is intended to be functional; it's just to test out the environment):

* ./editor: The primary Editor project 
* ./plugins: combination of built-in (linked into the bundled file) and extra plugin libraries
* ./tests: contains test scripts that are run using ./tests.html and wallaby
* ./samples: contains a variety of samples which are intended toeventually demosntrate the editor and plugins

# To run it
* npm install (in the root)
* load  in vs code and drop some breakpoints in to ensure that source maps are working as you expect, build, and F5.  
* To see the test runner work, just load tests.html.

# other
If breakpoints are appearing in odd places, ensure you've got the latest Typescript; they fixed some related bugs in 2.0.10.

Even if this project itself isn't particularly useful to folks, hopefully there are a few nuggets in there which may help people trying to figure out how to get gulp, typescript, and sourcemaps working together.

If you see something wrong or suboptimal, let me know! Happy to fix it.

jeffsim@live.com