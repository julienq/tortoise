(function () {
  "use strict";

  function req(m) {
    return typeof require === "function" && require(m) || window[m];
  }

  var assert = req("assert");
  var m = req("minimalisp");

  describe("String.fmt(...)", function () {
    it("replaces patterns $<n> in the string with the arguments", function () {
      assert.strictEqual("foo = 1", "foo = $0".fmt(1));
      assert.strictEqual("foo = 1, bar = 2",
        "foo = $0, bar = $1".fmt(1, 2));
      assert.strictEqual("bar = 2", "bar = $1".fmt(1, 2, 3));
    });
    it("outputs an empty string for null, undefined or missing values",
      function () {
        assert.strictEqual("foo = ", "foo = $0".fmt());
        assert.strictEqual("foo = ", "foo = $0".fmt(undefined));
        assert.strictEqual("foo = ", "foo = $0".fmt(null));
      });
  });

  describe("minimalisp.tokenize(string)", function () {
    it("tokenizes an input string", function () {
      assert.deepEqual(m.tokenize("(+ 1 2)"), ["(", "+", "1", "2", ")"]);
    });
  });

}());
