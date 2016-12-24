var BuildConfiguration = require("../../gulpBuild/BuildConfiguration");

// Create the build configuration
var buildConfig = new BuildConfiguration();

// Add test library.
var testLibrary = buildConfig.addProject({
    name: "testLibrary",
    path: "moreExampleBuildEnvs/programmaticBuildConfig/testLibrary",
    generateTyping: true
});

// Add test app.  set dependency on test library.  This drives build order & also copies and includes library's js and
// d.ts files in compilation and for ambient typing.
// note that we are not aggregating the bundles (lib and app) together.  For an example of that, see simpleAggregateBundle sample
buildConfig.addProject({
    name: "testApp",
    path: "moreExampleBuildEnvs/programmaticBuildConfig/testApp",
    dependsOn: [testLibrary],
});

module.exports = buildConfig;
