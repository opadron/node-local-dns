#! /usr/bin/env node

"use strict";

(function() {


var argparse = require("argparse");
var parser = new argparse.ArgumentParser({
    version: "0.0.1",
    addHelp: true,
    description: "start up a local DNS service"
});

parser.addArgument(["--dns", "--dns-addr"],
                   { help: "address to which the DNS service should bind",
                     defaultValue: "0.0.0.0" });

parser.addArgument(["--dns-port"],
                   { help: "port on which the DNS service should listen",
                     type: Number,
                     defaultValue: 53 });

parser.addArgument(["--http", "--http-addr"],
                   { help: "address to which the HTTP service should bind",
                     defaultValue: "0.0.0.0" });

parser.addArgument(["--http-port"],
                   { help: "port on which the HTTP service should listen",
                     type: Number,
                     defaultValue: 80 });

parser.addArgument(["--parent"],
                   { help: "address of the parent DNS server that non-local" +
                           " requests should be forwarded to"});

parser.addArgument(["--db"],
                   { help: "nedb path where all records are to be stored"});

var args = parser.parseArgs();

var LocalDNS = require("local-dns");
var localDNSServer = new LocalDNS(args);

localDNSServer.serve({
    dns:  [args.dns_port, args.dns],
    http: [args.http_port, args.http]
});


})();

