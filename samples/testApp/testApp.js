// NOTE: This timeout is necessary; otherwise VS Code won't hit the breakpoint unless you refresh the page after loading it
setTimeout(function () {
    var v = new Duality.Label();
    v.test();
    console.log(4);
    console.log(5);
    new Duality.TextBox();
    new Duality.Editor();
}, 300);

//# sourceMappingURL=testApp.js.map
