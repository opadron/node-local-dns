
"use strict";

module.exports = (function() {


function LocalDNS(args) {
    var dbPath = args.db;
    var parentDNS = args.parent;
    var domain = args.domain || "";

    var http = require("http");

    var nativeDNS = require("native-dns");
    var nativeDNSComposer = require("native-dns-composer");
    var Promise = require("bluebird");
    var nedb = require("./promisified-nedb");
    var express = require("express");

    var self = this;

    this.domain = domain;
    this.udpDNSServer = nativeDNS.createServer();
    this.tcpDNSServer = nativeDNS.createTCPServer();

    this.registryPath = dbPath;
    var datastoreArgs = {autoload: true};
    if(this.registryPath) {datastoreArgs.filename = this.registryPath;}
    this.registry = new nedb(datastoreArgs);

    function insertRecord(ip, name) {
        return (self.registry.findAsync({ ip:ip, name:name })

        .then(function(list) { return (list.length <= 0); })

        .then(function(doInsert) {
            var result = true;
            if(doInsert) {
                console.log("received new A record:", name, "->", ip);
                result = self.registry.insertAsync({ ip:ip, name:name });
            }

            return result;
        }));
    }


    var indexPromise = Promise.all([
        this.registry.ensureIndexAsync({fieldName: "ip"}),
        this.registry.ensureIndexAsync({fieldName: "name"})
    ]);

    this.parentDNS = parentDNS;

    var onRequest = function onRequest(req, res) {
        var requestPromise = (Promise.map(req.question, function(question) {
            var name = question.name;
            var type = question.type;

            var lookupPromise = Promise.resolve(false);

            if(type === nativeDNS.consts.NAME_TO_QTYPE.A) {
                lookupPromise = (self.registry.findAsync({name:name})

                .map(function(answer) {
                    return nativeDNS.A({
                        name: name, address: answer.ip, ttl: 600});
                })

                .map(function(aRecord) {
                    res.answer.push(aRecord);
                    return true;
                })

                .then(function(list) {
                    return (list.length > 0);
                }));

            } else if(type === nativeDNS.consts.NAME_TO_QTYPE.PTR) {
                var ip = name.split(".").slice(0, 4).reverse().join(".");
                lookupPromise = (self.registry.findAsync({ip:ip})

                .map(function(answer) {
                    return nativeDNS.PTR({
                        name: name, data: answer.name, ttl: 600});
                })

                .map(function(ptrRecord) {
                    res.answer.push(ptrRecord);
                    return true;
                })

                .then(function(list) {
                    return (list.length > 0);
                }));
            }

            lookupPromise = lookupPromise.then(function(questionAnswered) {
                var result = true;
                if(!questionAnswered && parentDNS) {
                    result = (new Promise(function(rs, rj) {
                        (nativeDNSComposer(name)
                        .at(parentDNS)
                        .type(type)
                        .on("err", rj)
                        .query(function(parentRes) {
                            rs(parentRes.answer);
                        }));
                    })

                    .map(function(answer) {
                        res.answer.push(answer);
                    })

                    .then(function() { return true; }));
                }

                return result;
            });

            return lookupPromise;
        })

        .all());

        (Promise.all([indexPromise, requestPromise])
        .then(function() { res.send(); })
        .catch(function(err) {
            console.error("Something went wrong");
            console.error(err);
            console.error(err.stack);
        }));
    };

    var onError = function onError(err, buff, req, res) {
        console.log(err.stack);
    };

    var onListening = function onListening() {
        console.log("DNS server listening on",
                    this.address().address, ":", this.address().port);
    };

    var onSocketError = function onSocketError(err, socket) {
        console.log(err);
    };

    var onClose = function onClose() {
        console.log("server closed", this.address());
    };

    [this.udpDNSServer, this.tcpDNSServer].map(function(server) {
        server.on("request", onRequest);
        server.on("error", onError);
        server.on("listening", onListening);
        server.on("socketError", onSocketError);
        server.on("close", onClose);
    });

    this.app = express();
    this.app.enable('trust proxy');
    this.app.set('trust proxy', function() { return true; });

    this.app.post('/:name/:ip', function(req, res) {
        (insertRecord(req.params.ip, req.params.name)
        .catch(function(err) { res.status(500); })
        .then(function() { res.send(); }));
    });

    this.app.post('/:name', function(req, res) {
        (Promise.map(req.ips.concat([req.ip]), function(ip) {
            return insertRecord(ip, req.params.name);
        })
        .catch(function(err) { res.status(500); })
        .then(function() { res.send(); }));
    });

    this.httpServer = http.createServer(this.app);
    this.httpServer.on("listening", function(address, port) {
        console.log("HTTP server listening on",
                    this.address().address, ":", this.address().port);
    });
}

LocalDNS.prototype.serve = function serve(args) {
    args = args || {};
    args.dns = args.dns || [53];
    args.http = args.http || [80];

    if(!Array.isArray(args.dns)) { args.dns = [args.dns]; }
    if(!Array.isArray(args.http)) { args.http = [args.http]; }

    var result = this.udpDNSServer.serve.apply(this.udpDNSServer, args.dns);
    this.tcpDNSServer.serve.apply(this.tcpDNSServer, args.dns);
    this.httpServer.listen.apply(this.httpServer, args.http)

    return result;
};

LocalDNS.prototype.close = function close() {
    var result = this.dnsServer.close.apply(this.dnsServer, arguments);
    /* this.httpServer.close(...); */

    return result;
};


return LocalDNS; })();

