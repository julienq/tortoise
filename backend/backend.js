// Run the SPQR server

var server = require("server");

var PORT = 8910;
var IP = "127.0.0.1";
var HELP = false;

// Parse arguments from the command line
function parse_args(args)
{
  var m;
  args.forEach(function(arg) {
      if (m = arg.match(/^port=(\d+)/)) {
        PORT = m[1];
      } else if (m = arg.match(/^ip=(\S*)/)) {
        IP = m[1];
      } else if (arg.match(/^h(elp)?$/i)) {
        HELP = true;
      } else if (m = arg.match(/^documents=(\S+)/)) {
        server.PATHS.documents = m[1];
      } else if (m = arg.match(/^templates=(\S+)/)) {
        server.PATHS.templates = m[1];
      }
    });
}

// Show help info and quit
function show_help(node, name)
{
  console.log("Usage: {0} {1} [ip=<IP address>] [port=<port number>]"
      .fmt(node, name));
  process.exit(0);
}

parse_args(process.argv.slice(2));
if (HELP) show_help(process.argv[0], process.argv[1]);
server.run(IP, PORT, server.make_dispatcher([
    [/^\/favicon\.ico$/, function(req, response) {
        response.log("  ignoring favicon");
        server.serve_error(req, response, 404, "Not found");
      }],
    // Define additional commands here!
  ]));
