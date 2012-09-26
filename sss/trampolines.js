(function () {
  "use strict";

  // Use a trampoline to call a function; we expect a thunk to be returned
  // through the get_thunk() function below. Return nothing to step off the
  // trampoline (e.g., to wait for an event before continuing.)
  Function.prototype.trampoline = function () {
    var c = [this, arguments];
    var esc = arguments[0];
    while (c && c[0] !== esc) {
      c = c[0].apply(this, c[1]);
    }
    if (c) {
      return esc.apply(this, c[1]);
    }
  };

  // Return a thunk suitable for the trampoline function above.
  Function.prototype.get_thunk = function () {
    return [this, arguments];
  };

  // Example use:

  // ; Not tail-recursive:
  // (define (count-to n) (if (= n 0) 0 (+ 1 (count-to (- n 1))))) =>
  // (define count-to (lambda (n) (if (= n 0) 0 (+ 1 (count-to (- n 1)))))) =>
  function count_to(n, k) {
    return n === 0 ? k.get_thunk(0) : count_to.get_thunk(n - 1, function (n) {
      return k.get_thunk(1 + n);
    });
  }
  count_to.trampoline(100000, function (n) { console.log(n); });

  function eq(x, y, k) { return k.get_thunk(x === y); }
  function plus(x, y, k) { return k.get_thunk(x + y); }
  function minus(x, y, k) { return k.get_thunk(x - y); }
  function out(r) { console.log(r); }

  // (+ 1 2)
  console.log("(+ 1 2)");
  (function (k) {
    return plus.get_thunk(1, 2, k);
  }).trampoline(out);

  // Function application
  // evaluate arguments left to right
  // if an argument is itself a function application it creates a new
  // continuation; otherwise we can use its value as is

  // (f x y z)
  // (function (k) {
  //   return f.get_thunk(x, y, z, k)
  // }).trampoline(out);
  //
  // (f (g x))
  // (function (k) {
  //   return g.get_thunk(x, function (r1) {
  //     return f.get_thunk(r0, k);
  //   }, k);
  // }).trampoline(out);
  //
  // (f (g x) (h y))
  // (function (k) {
  //   return g.get_thunk(x, function (r1) {
  //     return h.get_thunk(y, function (r2) {
  //       return f.get_thunk(r1, r2, k);
  //     });
  //   });
  // }).trampoline(out);
  //
  // ((f x) y)
  // (function (k) {
  //   return f.get_thunk(x, function (r0) {
  //     return r0.get_thunk(y);
  //   });
  // }).trampoline(out);
  //
  // ((f x) (g y))
  // (function (k) {
  //   return f.get_thunk(x, function (r0) {
  //     return g.get_thunk(y, function (r1) {
  //       return r0.get_thunk(r1);
  //     });
  //   });
  // }).trampoline(out);

  // (= 3 (+ 1 2))
  console.log("(= 3 (+ 1 2))");
  (function (k) {
    return plus.get_thunk(1, 2, function (r1) {
      return eq.get_thunk(3, r1, k);
    });
  }).trampoline(out);

  // (= (+ 1 2) (- 9 6))
  console.log("(= (+ 1 2) (- 9 6))");
  (function (k) {
    return plus.get_thunk(1, 2, function (r0) {
      return minus.get_thunk(9, 6, function (r1) {
        return eq.get_thunk(r0, r1, k);
      });
    });
  }).trampoline(out);


  function count_to_tr(n, k) {
    return eq.get_thunk(n, 0, function (r) {
      if (r) {
        return k.get_thunk(0);
      }
      return minus.get_thunk(n, 1, function (r) {
        return count_to_tr.get_thunk(r, function (r) {
          return plus.get_thunk(1, r, k);
        });
      });
    });
  }

  count_to_tr.trampoline(100000, function (r) { console.log(r); });

  // (define x (count-to 10))
  (function () {
    return count_to_tr.get_thunk(10, function (r) {
      global.x = r;
    })
  }.trampoline(function (r) { console.log(r); }));

  console.log("x = " + x);

  // (set! x 1111)
  (function () {
    return (function (r) {
      global.x = r;
    }.get_thunk(1111));
  }.trampoline(function (r) { console.log(r); }));

  console.log("x = " + x);

  // ; tail-recursive
  // (define (count-to n acc) (if (= n 0) acc (count-to (- n 1) (+ acc 1)))) =>
  function count_to_(n, acc, k) {
    return n === 0 ? k.get_thunk(acc) : count_to_.get_thunk(n - 1, acc + 1, k);
  };
  count_to_.trampoline(100000, 0, function (n) { console.log(n); });

  process.exit();


  // Explode:
  // (let ((x y z) vector) (+ (square x) (square y) (square z)))

  // Some aynchronicity: seq/par like let -> bindings, then action with the
  // bindings
  // seq executes all the actions/bindings in order
  // par executes all the actions/bindings concurrently
  // handle errors with call/cc?
  // (let/par
  //   ((load "img1")
  // (let/seq
  //   (((xhr "http://foo") req_foo)
  //    ((xhr "http://bar") req_bar))
  //   (f req_foo req_bar))
}());
