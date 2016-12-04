// NOTE: This timeout is necessary; otherwise VS Code won't hit the breakpoint unless you refresh the page after loading it
setTimeout(() => {
    var v = new Duality.Label();
    v.test()
    console.log("i duality debug plugin");
}, 300);

namespace PluginDualityDebug {
    export class Test {
        test() {
            console.log("duality debug plugin");
        }
    }
}