// NOTE: This timeout is necessary; otherwise VS Code won't hit the breakpoint unless you refresh the page after loading it
setTimeout(() => {
    var v = new Duality.Label();
    v.test()
    console.log("i threeJS plugin");
}, 300);

namespace PluginTJS {
    export class Test {
        test() {
            console.log("test");
        }
    }
}