var readline = require("readline");
var sss = require("./sss.js");

var rli = readline.createInterface(process.stdin, process.stdout);

rli.on("close", function () {
    process.stdout.write("\n");
    process.exit(0);
  });

function prompt(p, f) {
  rli.setPrompt(p);
  rli.once("line", function (line) {
    f(line);
  });
  rli.prompt();
}

function repl(line) {
  var v = sss.eval(sss.read(sss.tokenize(line)), sss.global);
  if (v !== undefined) {
    console.log(sss.to_string(v));
  }
  prompt("? ", repl);
}

prompt("? ", repl);
