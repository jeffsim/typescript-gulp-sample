setTimeout(function () {

  console.log("i am test app 2");
  // Create one of the controls from Duality
  var v = new Duality.Label();
  v.test()

  // Create another
  new Duality.Editor();

  // Test that jQuery is working & ambient typings are present
  $("body").html("I am test app 2");

  // Test local plugin
  var v2 = new PluginTJS.Test();
  v2.test();

  // Call the javascript function
  testMe();

}, 1000);
