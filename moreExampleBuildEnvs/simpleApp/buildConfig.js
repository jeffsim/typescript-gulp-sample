var BuildConfiguration = require("../../gulpBuild/BuildConfiguration");

// Create the build configuration
var buildConfig = new BuildConfiguration();
buildConfig.addProject({
    name: "simpleApp",
    path: "moreExampleBuildEnvs/simpleApp",
});

module.exports = buildConfig;
