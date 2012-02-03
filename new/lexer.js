var readline = require("readline");
var flexo = require("flexo");
var logo = require("logo");

var rli = readline.createInterface(process.stdin, process.stdout);
rli.on("close", function() {
    process.stdout.write("\n");
    process.exit(0);
  });

function prompt(p, f)
{
  rli.setPrompt(p);
  rli.once("line", function(line) { f(line); });
  rli.prompt();
}

var lexer = Object.create(logo.lexer).init();

function repl(line)
{
  lexer.tokenize(line + "\n", function(p, tokens) {
      if (tokens) {
        console.log("{0}\t".fmt(lexer.line), tokens.map(function(t) {
            return t.type === "quoted" ? "\033[00;46m{0}\033[00m"
              .fmt(t.value || " ") : "\033[00;47m{0}\033[00m".fmt(t.value);
          }).join(" "), tokens.length);
        prompt("{0} ".fmt(p), repl);
      } else {
        // TODO fix this!
        prompt("{0} ".fmt(p), function(line_) { lexer.tokenize(line_, repl); });
      }
    });
}

prompt("? ", repl);
