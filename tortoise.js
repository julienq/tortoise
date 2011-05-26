// Node REPL for Logo

var fs = require("fs");
var path = require("path");
var rl = require("readline");
var populus = require("populus");
var logo = require("logo");

var LIB = "./library.logo";
var TRACE = false;
var SEED = 0;
var HELP = false;
var PROMPT = { eval: "? ", cont: "~ ", define: "> ", logo: "" };
var MODE = "eval";
var RLI = null;

// Line being read (in case of ~ it will span several calls to eval_line)
var current_line = "";

// Close the session
// TODO if there is input, just discard it; if there is no input, actually quit
function close()
{
  process.stdout.write("\n");
  process.exit();
}

// Quit the REPL
logo.procedures.BYE = function() { process.exit(); };

// Node-specific implementation of print for Logo
logo.print = function(str) { process.stdout.write(str + "\n"); };

// Node-specific implementation of warn for Logo
logo.warn = function(warning)
{
  process.stderr.write("Warning #{0}: {1}\n".fmt(warning.error_code,
        warning.message));
};

// Parse arguments from the command line
function parse_args(args)
{
  var m;
  args.forEach(function(arg) {
      if (m = arg.match(/^t(race)$/)) {
        TRACE = true;
      } else if (m = arg.match(/^lib=(\S*)/)) {
        LIB = m[1];
      } else if (m = arg.match(/^seed=(\d+)/)) {
        var s = parseInt(m[1], 10);
        if (!s.isNaN) SEED = s;
      } else if (arg.match(/^h(elp)?$/i)) {
        HELP = true;
      }
    });
}

// Show help info and quit
function show_help(node, name)
{
  console.log("Usage: {0} {1} [lib=<path to lib>] [seed=<seed>] [trace]"
      .fmt(node, path.basename(name)));
  process.exit(0);
}


logo.prompt = function(prompt, f)
{
  RLI.once("line", f);
  RLI.setPrompt(prompt);
  RLI.prompt();
};

function repl()
{
  for (var p in logo.procedures) logo.procedures[p].primitive = true;
  process.stdin.resume;
  RLI = rl.createInterface(process.stdin, process.stdout);
  RLI.on("close", close);
  (function eval(error, value)
  {
    if (error) {
      if (error.error_code) {
        console.log("Error #{0}: {1}".fmt(error.error_code, error.message));
      } else {
        throw error;
      }
    }
    if (value) console.log(value);
    logo.eval_line(eval);
  })();
}

parse_args(process.argv.slice(2));
if (HELP) show_help.apply(null, process.argv);
if (TRACE) logo.trace = function(msg) { process.stderr.write(msg + "\n"); };
if (SEED) logo.set_seed(SEED);

// Read the library file (split line by line) then start prompting the user for
// commands to execute
if (LIB) {
  fs.readFile(LIB, "utf8", function(error, data) {
      if (error) throw error;
      data.split("\n").forEach(eval_line);
      repl();
    });
} else {
  repl();
}
