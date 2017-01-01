var buildConfig = {
    projectGroups: {
        // Define the build config for the example library which will be referenced by the example app below.
        testLibrary: {
            projects: {
                testLibrary: {
                    path: "moreExampleBuildEnvs/externalModuleReferenceBundle/testLibrary",
                    // generateTyping: true
                }
            }
        }
    }
};

module.exports = buildConfig;
