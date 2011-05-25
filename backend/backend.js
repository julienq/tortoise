// Run the SPQR server

var server = require("server");

var PORT = 8910;
var PORT_REDIS = 0;
var IP = "";
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
      } else if (m = arg.match(/^redis=(\d+)/)) {
        PORT_REDIS = m[1];
      }
    });
}

// Show help info and quit
function show_help(node, name)
{
  console.log("\nUsage: {0} {1} [options]\n\nOptions:".fmt(node, name));
  console.log("  help:                 show this help message");
  console.log("  ip=<ip address>:      IP address to listen to");
  console.log("  port=<port numver>:   port number for the server");
  console.log("  documents=<apps dir>: path to the documents directory");
  console.log("  templates=<apps dir>: path to the templates directory");
  console.log("  redis=<port number>:  port number for the Redis server\n");
  process.exit(0);
}

// Run the server with or without a Redis socket
function run_server(redis_socket)
{
  server.run(IP, PORT, server.make_dispatcher([
      [/^\/favicon\.ico$/, function(req, response) {
          response.log("  ignoring favicon");
          server.serve_error(req, response, 404, "Not found");
        }],
      // Define additional commands here!
    ]));
}

parse_args(process.argv.slice(2));
if (HELP) show_help.apply(null, process.argv);
if (PORT_REDIS) {
  require("redis").connect(PORT_REDIS, IP, run_server);
} else {
  run_server();
}
