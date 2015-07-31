
## node-local-dns

A small DNS server paired with a RESTful interface for registering new A
records.  Designed for virtualized networking environments with no local name
resolution services (e.g: Docker containers running over
[Ubuntu Fan](https://wiki.ubuntu.com/FanNetworking)).

```bash
npm install -g opadron/node-local-dns
local-dns --help
```

### Example

```bash
local-dns            \
    --http 0.0.0.0   \ # These are the defaults, but you should bind to the
    --dns 0.0.0.0    \ # target network in production.
    --http-port 8080 \
    --dns-port 5353  \
    --db dns.db      \ # save A records to disk (default is to store in memory)
    --parent 8.8.8.8   # try to resolve missing names using google's DNS
```

```
DNS server listening on 0.0.0.0 : 5353
DNS server listening on 0.0.0.0 : 5353
HTTP server listening on 0.0.0.0 : 8080
```

In another terminal...

```bash
dig "@<TARGET NETWORK IP>" -p 5353 "$( hostname )"
```

no resolution at first...

```
...
;; Got answer:
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 43863
;; flags: qr rd; QUERY: 1, ANSWER: 0, AUTHORITY: 0, ADDITIONAL: 0
;; WARNING: recursion requested but not available

;; QUESTION SECTION:
;<HOSTNAME>.        IN  A
...
```

Register your hostname and try again.

```bash
curl -X POST "<TARGET NETWORK IP>:8080/$( hostname )"
dig "@<TARGET NETWORK IP>" -p 5353 "$( hostname )"
```

This time, the name resolves.

```
...
;; ANSWER SECTION:
<HOSTNAME>.     600 IN  A   <TARGET NETWORK IP>
...
```

Reverse lookups work, too.

```bash
dig "@<TARGET NETWORK IP>" -p 5353 -x "<TARGET NETWORK IP>"
```

```
...
;; ANSWER SECTION:
<TARGET NETWORK IP>.in-addr.arpa.   600 IN  PTR <HOSTNAME>.
...
```

There are no checks to ensure that posted A records actually point to hosts that
are real (or benign).

```bash
curl -X POST "<TARGET NETWORK IP>:8080/imposter/<IP TO MALICOUS HOST>"
dig "@<TARGET NETWORK IP>" -p 5353 imposter
```

```
...
;; ANSWER SECTION:
imposter.     600 IN  A   <IP TO MALICOUS HOST>
...
```

If an attacker POSTS before your legitimate host does, you're going to have a
bad time.

**Don't bind the HTTP server to an interface facing the outside world!**.  This
is a *local* DNS server meant to provide *local* name resolution services.

