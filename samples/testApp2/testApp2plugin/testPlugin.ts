// TODO: This is giving a 'duplicate identifier' error because of the following perfect storm:
//  * I've specified 'allowJs:true' in the project's tsconfig.json.  This is so that 'testJS.js' gets included in the 
//    testApp2-debug.js bundle.
//  * When allowJs is specified, js files appear to be included in ambient typing searches.
//  * project.buildRootFolder is set to '.' for this project because testApp2 is demonstrating a 'standalone' project;
//    as a result, testApp2-debug.js is copied into this folder.
//  * So TS/VSC is seeing MyPlugin defined both here and in the testApp2-debug.js file in this folder, and triggering
//    the 'duplicate identifier' error.
//
// To workaround this:
//  * Option 1: Set allowJs:false in your tsconfig.  Only works if you don't need to bundle preexisting .js files
//  * Option 2: Change project.buildRootFolder to some other folder (e.g. /dist).  Only works if the project isn't
//    intended to be completely standalone.
//  * Option 3: PR and fix this before I do! :)
//
// To actually fix this:
//  * I need to *not* include 'extraFilesToBundle' in filesToCompile, and instead concat them.  Then, tsconfig.json
//    can set allowJs:false, the project can include .js files in the bundle, and the error won't fire.

namespace MyPlugin {
    export class PluginTJS {
        test() {
            console.log("testApp2PluginTest");
        }
    }
}