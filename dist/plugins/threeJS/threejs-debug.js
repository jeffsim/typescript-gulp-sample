setTimeout(function () {
    var v = new Duality.Label();
    v.test();
    console.log("i threeJS plugin");
}, 300);
var PluginTJS;
(function (PluginTJS) {
    var Test = (function () {
        function Test() {
        }
        Test.prototype.test = function () {
            console.log("test");
        };
        return Test;
    }());
    PluginTJS.Test = Test;
})(PluginTJS || (PluginTJS = {}));

//# sourceMappingURL=threejs-debug.js.map
