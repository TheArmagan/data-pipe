require("tls").DEFAULT_ECDH_CURVE = "auto";
const axios = require("axios").default;
const { URL } = require('url');
const http = require('http');

process.env.PORT = process.env.PORT || 3000;

http.createServer(async (req, res) => {
    /** @type {URL} */
    let targetUrl = null;
    try {
        targetUrl = new URL(req.url.slice(1));
        if (!targetUrl.href.startsWith("http")) throw "Only HTTP";
    } catch {
        res.writeHead(400, {
            "access-control-allow-origin": "*",
            "pragma": "no-cache",
            "cache-control": "no-cache"
        });
        res.writeHead(400);
        res.write("Invalid URL!");
        return res.end();
    }

    let body = await readBody(req);
    try {
        let response = await axios(targetUrl.href, {
            method: req.method || "GET",
            headers: req.headers,
            data: !req.method || req.method.toLowerCase() == "head" || req.method.toLowerCase() == "get" ? undefined : body,
            responseType: "stream",
            maxRedirects: 100
        });

        let headers = {
            ...Object.fromEntries(Object.entries(response.headers).map(i => [i[0].toLowerCase(), i[1]])),
            "access-control-allow-origin": "*",
            "pragma": "no-cache",
            "cache-control": "no-cache"
        }

        res.writeHead(response.status, headers);
        response.data.pipe(res);
    } catch (err) {
        console.log(err);
        res.writeHead(400, {
            "content-type": "text/plain"
        });
        res.write(`${err}`);
        res.end();
    }
}).listen(process.env.PORT, () => {
    console.log(`Listining port ${process.env.PORT}!`);
});

function readBody(req) {
    return new Promise((resolve, reject) => {
        if (req.method.toLowerCase() != "head" || req.method.toLowerCase() != "get") {
            let body = null;
            let onChunk = function(chunk) {
                if (!chunk) {
                    body = chunk;
                } else {
                    body += chunk;
                }
            }
            req.on('data', onChunk);
            req.once('end', function() {
                req.off("data", onChunk);
                resolve(body);
            });
        } else {
            resolve(null);
        }
    })
}
