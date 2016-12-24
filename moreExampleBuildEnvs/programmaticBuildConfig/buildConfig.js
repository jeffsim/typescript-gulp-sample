var bu = require("BuildConfiguration");

// Create the build configuration
var buildConfig = new BuildConfiguration();

// Add test library.
var testLibrary = buildConfig.addProject({
    name: "testLibrary",
    path: "moreExampleBuildEnvs/programmaticBuildConfig/testLibrary",
    generateTyping: true
});

// Add test app.  set dependency on test library
buildConfig.addProject({
    name: "testApp",
    path: "moreExampleBuildEnvs/programmaticBuildConfig/testApp",
    dependsOn: [testLibrary],
});

module.exports = buildConfig;
