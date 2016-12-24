var bu = require("../../buildUtils");

var buildConfig = {
    projectGroups: {
        // Build the example library as a standalone entity
        testLibrary: {
            projects: [{
                name: "testLibrary",
                path: "./moreExampleBuildEnvs/simpleLibraryAndApp/testLibrary",
                generateTyping: true
            }]
        }
    }
};

// Add the example app, which uses the above library
buildConfig.projectGroups.testApp = {
    projects: [{
        name: "testApp",
        path: "./moreExampleBuildEnvs/simpleLibraryAndApp/testApp",
        // Declare testLibrary as a dependent project so that testLibrary's d.ts and .js files will be copied
        // TODO: Don't like [0]. move projects to object instead of array?
        dependsOn: [buildConfig.projectGroups.testLibrary.projects[0]],
    }]
}

// buildAll needs to be specified because order of objects in a JS object is not (as of today) gauranteed to be the same.
// TODO: This will go away once I build a dependency tree using project.dependsOn.
buildConfig.buildAll = function (buildProjectGroup, createBundle) {
    return bu.runSeries([
        () => buildProjectGroup(buildConfig.projectGroups.testLibrary),
        () => buildProjectGroup(buildConfig.projectGroups.testApp)
    ]);
}
module.exports = buildConfig;
