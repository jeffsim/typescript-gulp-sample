class TestApp {
    constructor() {
        console.log("simple testApp");

        // DEBUGSTART
        // This is included to test buildUtils.stripDebugStartEnd
        console.log("DEBUG TEST 1");
        console.log("DEBUG TEST 2");
        // DEBUGEND

        console.log("test mid");

        // debugStart
        // stress-test the regexp in stripDebugStartEnd: ~!@#$%^&*()_`.$
        console.log("DEBUG TEST 3");
        // DEBUGEND

        console.log("test end");
    }
}