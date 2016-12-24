var buildConfig = {
    aggregateBundles: {
        // This is an aggregate bundle; projects from multiple projectgroups can be combined into one bundled output
        // file by including them in an aggregate bundle.  Inclusion in an aggregate bundle is specified at the point of
        // project declaration below
        testBundle: {

            // Generate combined d.ts file by combining all generated d.ts files from projects in this aggregate bundle
            generateCombinedTyping: true,

            // output normally goes into buildSettings.distFolder; place in sample folder instead
            outputFolder: "moreExampleBuildEnvs/simpleAggregateBundle",

            // Base name of the bundle.  We're specifying version in this bundle, so output names will be:
            // duality-<version>.[debug|min].js
            name: "testBundle",

            // Version of the bundle.  Gets added to output name
            version: "0.0.2",
        }
    },
};

buildConfig.projectGroups = {
    // Define the build config for the example library which will be referenced by the example app below.
    testLibrary: {
        projects: {
            testLibrary: {
                path: "moreExampleBuildEnvs/simpleAggregateBundle/testLibrary",

                // output normally goes into source folder; to demo alternative, push to /dist
                outputFolder: "dist",

                generateTyping: true,

                // Include the testLibrary in the aggregate bundle
                aggregateBundle: buildConfig.aggregateBundles.testBundle
            }
        }
    }
};

// Add the example app, which uses the above library
buildConfig.projectGroups.testApp = {
    projects: {
        testApp: {
            path: "moreExampleBuildEnvs/simpleAggregateBundle/testApp",

            // output normally goes into source folder; to demo alternative, push to /dist
            outputFolder: "dist",

            // Declare testLibrary as a dependent project so that testLibrary's d.ts and .js files will be copied
            dependsOn: [buildConfig.projectGroups.testLibrary.projects.testLibrary],

            // Include the testApp in the aggregate bundle
            aggregateBundle: buildConfig.aggregateBundles.testBundle
        }
    }
}

module.exports = buildConfig;
