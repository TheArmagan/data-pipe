
const axios = require("axios").default;
const { URL } = require('url');
const http = require('http');

process.env.PORT = process.env.PORT || 3000;

http.createServer(async (req, res) => {
    /** @type {URL} */
    let targetUrl = null;
    try {
        targetUrl = new URL(req.url.slice(1));
        if (!targetUrl.protocol.startsWith("http")) throw "Only HTTP";
    } catch {
        res.writeHead(400, {
            "Access-Control-Allow-Origin": "*",
            "Pragma": "no-cache",
            "Cache-Control": "no-cache"
        });
        return res.status(400).send("Invalid URL!");
    }

    let body = await readBody(req);
    try {
        let response = await axios(targetUrl.href, {
            method: req.method,
            headers: req.headers,
            data: req.method.toLowerCase() != "head" || req.method.toLowerCase() != "get" ? body : null,
            responseType: "stream",
            maxRedirects: 10
        });

        let headers = {
            ...response.headers,
            "Access-Control-Allow-Origin": "*",
            "Pragma": "no-cache",
            "Cache-Control": "no-cache"
        }

        res.writeHead(response.status, response.statusText, headers);
        response.data.pipe(res);
    } catch (err) {
        console.log(err);
        res.writeHead(417).end(`${err}`);
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
