var buildConfig = {
    projectGroups: {
        // Define the build config for the example library which will be referenced by the example app below.
        testLibrary: {
            projects: {
                testLibrary: {
                    path: "moreExampleBuildEnvs/simpleLibraryAndApp/testLibrary",
                    generateTyping: true
                }
            }
        }
    }
};

// Add the example app, which uses the above library
buildConfig.projectGroups.testApp = {
    projects: {
        testApp: {
            path: "moreExampleBuildEnvs/simpleLibraryAndApp/testApp",
            // Declare testLibrary as a dependent project so that testLibrary's d.ts and .js files will be copied
            dependsOn: [buildConfig.projectGroups.testLibrary.projects.testLibrary],
        }
    }
}

module.exports = buildConfig;
