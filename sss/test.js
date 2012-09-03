(function () {
  "use strict";

  function req(m) {
    return typeof require === "function" && require(m) || window[m];
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

  function test_pair(pair) {
    it("$0 => $1" .fmt(pair[0],
        pair[1] === undefined ? "#undefined" : sss.to_sexp(pair[1])),
      function () {
        return assert.deepEqual(pair[1], sss.eval(pair[0]));
      });
  }

  describe("Some basic tests", function () {
    [ ["(list)", []],
      ["(list 1 2 3 4)", [1, 2, 3, 4]],
      ["'(1 2 3 4)", [1, 2, 3, 4]],
      ["(define f (lambda (x) (begin (define g (lambda (x) (* x 2))) (g (+ x 1)))))"],
      ["(f 2)", 6],
      ["(define fgh (lambda (x) (begin (define g (lambda (x) (* x 2))) (define h (lambda (x) (* x x))) (h (g (+ x 1))))))"],
      ["(fgh 2)", 36],
    ].forEach(test_pair);
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
      ["(define combine (lambda (f) (lambda (x y) (if (null? x) (quote ()) (f (list (car x) (car y)) ((combine f) (cdr x) (cdr y)))))))"],
      ["(define zip (combine cons))"],
      ["(zip (list 1 2 3 4) (list 5 6 7 8))", [[1, 5], [2, 6], [3, 7], [4, 8]]],
      ["(define riff-shuffle (lambda (deck) (begin (define take (lambda (n seq) (if (<= n 0) (quote ()) (cons (car seq) (take (- n 1) (cdr seq)))))) (define drop (lambda (n seq) (if (<= n 0) seq (drop (- n 1) (cdr seq))))) (define mid (lambda (seq) (/ (length seq) 2))) ((combine append) (take (mid deck) deck) (drop (mid deck) deck)))))"],
      ["(riff-shuffle (list 1 2 3 4 5 6 7 8))", [1, 5, 2, 6, 3, 7, 4, 8]],
      ["((repeat riff-shuffle) (list 1 2 3 4 5 6 7 8))",
        [1, 3, 5, 7, 2, 4, 6, 8]],
      ["(riff-shuffle (riff-shuffle (riff-shuffle (list 1 2 3 4 5 6 7 8))))",
        [1, 2, 3, 4, 5, 6, 7, 8]],
      ["(define (twice x) (* 2 x))"],
      ["(twice 2)", 4],
      // (twice 2 2) =raises=> TypeError expected (x), given (2 2),
      ["(define lyst (lambda items items))"],
      ["(lyst 1 2 3 (+ 2 2))", [1, 2, 3, 4]],
      // TODO if without else
      // ["(if 1 2)", 2],
      // ["(if (= 3 4) 2)"],
      // TODO define functions
      // ["(define ((account bal) amt) (set! bal (+ bal amt)) bal)"],
      // [ "(define a1 (account 100))"],
      // ["(a1 0)", 100],
      // ["(a1 10)", 110],
      // ["(a1 10)", 120],
      // ["(define (newton guess function derivative epsilon) (define guess2 (- guess (/ (function guess) (derivative guess)))) (if (< (abs (- guess guess2)) epsilon) guess2 (newton guess2 function derivative epsilon)))"],
      // ["(define (square-root a) (newton 1 (lambda (x) (- (* x x) a)) (lambda (x) (* 2 x)) 1e-8))"],
    ].forEach(test_pair);
  });

}());
