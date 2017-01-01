var buildConfig = {
    projectGroups: {
        // Define the build config for the example library which will be referenced by the example app below.
        testLibrary: {
            projects: {
                testLibrary: {
                    path: "moreExampleBuildEnvs/externalModuleImportBundleWithLoader/testLibrary",
                    // generateTyping: true
                }
            }
        }
    }
};

// Add the example app, which uses the above library
buildConfig.projectGroups.testApp = {
    projects: {
        testApp: {
            path: "moreExampleBuildEnvs/externalModuleImportBundleWithLoader/testApp",
            // Declare testLibrary as a dependent project so that testLibrary's d.ts and .js files will be copied
            dependsOn: [buildConfig.projectGroups.testLibrary.projects.testLibrary],

            // Bundle in the systemjs loader so that the app's index.html doesn't have to explicitly include it.
            extraFilesToBundle: ["vendor/system.js"],
        }
    }
}

module.exports = buildConfig;
