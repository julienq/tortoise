var sss = require("./sss");
var rl = require("readline").createInterface(process.stdin, process.stdout);
rl.setPrompt("? ");
rl.on("line", function(line) {
  try {
    var tokens = sss.tokenize(line);
    while (tokens.length > 0) {
      var exp = sss.parse(tokens);
      process.stdout.write("\u001b[36mreturn $0;\u001b[0m\n"
        .fmt(sss.to_js(exp, "env")));
      var v = sss.compile(exp)(sss.env, sss.set, sss.symbols);
      if (v !== undefined) {
        process.stdout.write(sss.to_sexp(v) + "\n");
      }
    }
  } catch (err) {
    process.stdout.write("Error: $0\n".fmt(err));
  }
  rl.prompt();
});
rl.on("close", function () {
  process.stdout.write("\n");
  process.exit(0);
});
rl.prompt();
