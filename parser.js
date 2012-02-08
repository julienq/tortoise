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

var tokenizer = Object.create(logo.tokenizer).init();
var parser = Object.create(logo.parser).init();

// Add the primitive functions
parser.add_function("SUM", 2);
parser.add_function("FIRST", 1);
// And the primitive commands
parser.add_command("PRINT", 1);

function repl(line)
{
  tokenizer.tokenize(line + "\n", function(p, tokens) {
      if (tokens) {
        console.log("{0}\t{1} (x{2})"
          .fmt(tokenizer.line, tokens.join(" "), tokens.length));
        console.log(parser.parse_tokens(tokens));
      }
      prompt("{0} ".fmt(p), repl);
    });
}

prompt("? ", repl);
