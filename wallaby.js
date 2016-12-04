module.exports = function (w) {

  return {
    debug: true,

    env: {
      // use electron so that we can use webgl
      kind: 'electron'
    },

    tests: [
       'tests/**/*.spec.js'
    ]
  };
};

