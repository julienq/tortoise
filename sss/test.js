(function () {
  "use strict";

  function req(m) {
    return typeof require === "function" && require(m) || window[m];
  }

  function ev(string) {
    return sss.compile(sss.read(sss.tokenize(string)))(sss.env, sss.set,
      sss.symbols);
    /*var f = sss.compile(sss.read(sss.tokenize(string)));
    var v = f(sss.env, sss.set, sss.symbols);
    if (v !== undefined) {
      return sss.to_sexp(v);
    }*/
  }

  var assert = req("assert");
  var sss = req("sss");

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

  describe("sss.tokenize(string)", function () {
    it("returns an array of tokens for an input string", function () {
      assert.deepEqual([], sss.tokenize(""));
      assert.deepEqual(["(", "+", 1, 2, ")"], sss.tokenize("(+ 1 2)"));
      assert.deepEqual(["(", "+", 1, 2, ")"], sss.tokenize("   ( + 1 2   )  "));
    });
  });

  describe("Tests from lispy.py should pass!", function () {
    [
      ["(quote (testing 1 (2.0) -3.14e159))",
        [sss.get_symbol("testing"), 1, [2], -3.14e+159]],
      ["(+ 2 2)", 4],
      ["(+ (* 2 100) (* 1 10))", 210],
      ["(if (> 6 5) (+ 1 1) (+ 2 2))", 2],
      ["(if (< 6 5) (+ 1 1) (+ 2 2))", 4],
      ["(define x 3)"],
      ["x", 3],
      ["(+ x x)", 6],
      ["((lambda (x) (+ x x)) 5)", 10],
      ["(define twice (lambda (x) (* 2 x)))"],
      ["(twice 5)", 10],
      ["(define compose (lambda (f g) (lambda (x) (f (g x)))))"],
      ["((compose list twice) 5)", [10]],
      ["(define repeat (lambda (f) (compose f f)))"],
      ["((repeat twice) 5)", 20],
      ["((repeat (repeat twice)) 5)", 80],
      ["(define fact (lambda (n) (if (<= n 1) 1 (* n (fact (- n 1))))))"],
      ["(fact 3)", 6],
      ["(fact 50)",
        30414093201713378043612608166064768844377641568960512000000000000],
      ["(define abs (lambda (n) ((if (> n 0) + -) 0 n)))"],
      ["(list (abs -3) (abs 0) (abs 3))", [3, 0, 3]],
      ["define combine (lambda (f) (lambda (x y) (if (null? x) (quote ()) (f (list (car x) (car y)) ((combine f) (cdr x) (cdr y)))))))"],
      // TODO cons
      ["(define zip (combine cons))"],
      //["(zip (list 1 2 3 4) (list 5 6 7 8))", [[1, 5,], [2, 6], [3, 7] [4, 8]]],
    ].forEach(function(pair) {
      it("$0 => $1" .fmt(pair[0],
          pair[1] === undefined ? "#nil" : sss.to_sexp(pair[1])),
        function () {
          return assert.deepEqual(pair[1], ev(pair[0]));
        });
    });
  });

}());
