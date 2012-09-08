var sss = require("./sss");
var rl = require("readline").createInterface(process.stdin, process.stdout);
rl.setPrompt("? ");
rl.on("line", function(line) {
  try {
    var tokens = sss.tokenize(line);
    while (tokens.length > 0) {
      var x = sss.parse(tokens);
      process.stdout.write("\u001b[36mreturn $0;\u001b[0m\n"
        .fmt(sss.to_js(x, Object.create(sss.vars))));
      var v = sss.compile(x)(sss.symbols);
      if (v !== undefined) {
        process.stdout.write(sss.to_sexp(v) + "\n");
      }
    }
  } catch (err) {
    var e = err.toString().replace(/\b_[0-9a-z]+\b/g, function (p) {
      return sss.vars.unvar(p) || p;
    });
    process.stdout.write("Error: $0\n".fmt(e));
  }
  rl.prompt();
});
rl.on("close", function () {
  process.stdout.write("\n");
  process.exit(0);
});
rl.prompt();
