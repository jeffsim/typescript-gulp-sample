var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var Duality;
(function (Duality) {
    var Visual = (function () {
        function Visual() {
            console.log(1);
        }
        Visual.prototype.test = function () {
            return "asdf";
        };
        return Visual;
    }());
    Duality.Visual = Visual;
})(Duality || (Duality = {}));
var Duality;
(function (Duality) {
    var Label = (function (_super) {
        __extends(Label, _super);
        function Label() {
            var _this = _super.call(this) || this;
            console.log("label1");
            console.log("label2");
            console.log("label3");
            return _this;
        }
        return Label;
    }(Duality.Visual));
    Duality.Label = Label;
})(Duality || (Duality = {}));



// NOTE: This timeout is necessary; otherwise VS Code won't hit the breakpoint unless you refresh the page after loading it
setTimeout(function () {
    var v = new Duality.Label();
    v.test();
    console.log("i duality debug plugin");
}, 300);
var PluginDualityDebug;
(function (PluginDualityDebug) {
    var Test = (function () {
        function Test() {
        }
        Test.prototype.test = function () {
            console.log("duality debug plugin");
        };
        return Test;
    }());
    PluginDualityDebug.Test = Test;
})(PluginDualityDebug || (PluginDualityDebug = {}));



// NOTE: This timeout is necessary; otherwise VS Code won't hit the breakpoint unless you refresh the page after loading it
setTimeout(function () {
    var v = new Duality.Label();
    v.test();
    console.log("i duality debug plugin 2");
}, 300);
var PluginDualityDebug2;
(function (PluginDualityDebug2) {
    var Test = (function () {
        function Test() {
        }
        Test.prototype.test = function () {
            console.log("duality debug plugin 2");
        };
        return Test;
    }());
    PluginDualityDebug2.Test = Test;
})(PluginDualityDebug2 || (PluginDualityDebug2 = {}));



//# sourceMappingURL=duality-0.0.1.debug.js.map
