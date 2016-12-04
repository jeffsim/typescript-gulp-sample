 declare var testMe;
//$(document).ready(() => {
  setTimeout(function() {
//cument.addEventListener("DOMContentLoaded", function(event) {  
    var v = new Duality.Label();
    v.test()
    console.log("i am test app 2");
    console.log(5);
    new Duality.TextBox();
    new Duality.Editor();
    $("body").html("I am test app 2");
    var v2 = new PluginTJS.Test();
    v2.test();
 //   testMe();
}, 1000);
