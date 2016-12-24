
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
buildConfig.addProject({
    name: "testApp",
    path: "moreExampleBuildEnvs/programmaticBuildConfig/testApp",
    dependsOn: [testLibrary],
});

module.exports = buildConfig;
