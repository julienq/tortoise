var sss = require("./sss");
var rl = require("readline").createInterface(process.stdin, process.stdout);
rl.setPrompt("? ");
rl.on("line", function(line) {
  //try {
    var tokens = sss.tokenize(line);
    while (tokens.length > 0) {
      var f = sss.compile(sss.parse(tokens));
      process.stdout.write("\u001b[36m$0\u001b[0m\n".fmt(f));
      f.trampoline(function (r) {
        if (r !== "undefined") {
          process.stdout.write(sss.to_sexp(r) + "\n");
        } else {
          process.stdout.write("\u001b[31mundefined\u001b[0m\n".fmt(f));
        }
      });
    }
  /*} catch (err) {
    var e = err.toString().replace(/\b_[0-9a-z]+\b/g, function (p) {
      return sss.vars.unvar(p) || p;
    });
    process.stdout.write("Error: $0\n".fmt(e));
  }*/
  rl.prompt();
});
rl.on("close", function () {
  process.stdout.write("\n");
  process.exit(0);
});
rl.prompt();
