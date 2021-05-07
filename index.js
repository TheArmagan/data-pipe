if (process.env.NODE_ENV != "production") require("dotenv").config();
const KAO_VERSION = "2.1.1"; // Do Not Change

// Options
const USER_NOTE = process.env.USER_NOTE || "User note is not set.";
const MAX_CONTENT_LENGTH = parseInt(process.env.MAX_CONTENT_LENGTH) || 2000000; // 2MB
const MAX_HEADER_AMOUNT = parseInt(process.env.MAX_HEADER_AMOUNT) || 100;
const SEND_REAL_IP_ON_HEADERS = typeof process.env.SEND_REAL_IP_ON_HEADERS != "undefined" ? parseBool(process.env.SEND_REAL_IP_ON_HEADERS) : true;
const LOG_REQUESTS = typeof process.env.LOG_REQUESTS != "undefined" ? parseBool(process.env.LOG_REQUESTS) : false;

let express = require("express");
let got = require("got").default;
let fs = require("fs");
let clc = require("cli-color");
let convertStream = require("convert-stream");

let app = express();

process.env.PORT = process.env.PORT || 3000;
app.set("trust proxy", true);
app.set("x-powered-by", false);

app.get("/&SETTINGS",(req, res)=>{res.send({KAO_VERSION, USER_NOTE, MAX_CONTENT_LENGTH, MAX_HEADER_AMOUNT, SEND_REAL_IP_ON_HEADERS, LOG_REQUESTS})});
app.get("/&LICENSE", (req, res)=> {fs.createReadStream("./LICENSE").pipe(res)});

// Safety middleware
let mainMiddleware = (req, res, next)=>{

    if (req.url == "/favicon.ico") return res.status(404).send({error: "Not Found"});
    if (req.rawHeaders.length / 2 > MAX_HEADER_AMOUNT) return res.status(400).send({error: "Too Many Headers"});
    if (req.method.toLowerCase() != "get" && parseInt(req.headers["content-length"]) > MAX_CONTENT_LENGTH) return res.destroy(); /** res.destroy() to prevent memory leaks */

    if (LOG_REQUESTS) {
        let logMsg = "\n";
        logMsg += "Method: "+clc.greenBright(req.method)+"\n";
        logMsg += "IP Address: "+clc.cyanBright(req.ip)+"\n";
        logMsg += "URL: "+clc.yellowBright(req.url)+"\n";
        logMsg += "Headers: "+clc.blackBright(Object.entries(req.headers).map(i=>`${i[0]}:${i[1]}`).join(" | "));
        if (req.method.toLowerCase() != "get") logMsg += "\n"+"Body Size: "+clc.redBright(Math.round(parseInt(req.headers["content-length"])/1000)+"kb")+"\n";
    
        console.log(logMsg);
    }

    next();
}

app.all("/*", mainMiddleware, async (req, res)=>{
    let url = req.url.slice(1);

    try {
        url = new URL(url);
        if (!url.href.startsWith("http")) return res.status(400).send({error: "Only http/https supported!"});
    } catch (e) {
        fs.createReadStream("./index.html").pipe(res);
        return;
    }


    let _headers = Object.keys(req.headers).filter(i=>i.startsWith("dp")).reduce((all, current)=>{
        all[current.slice(3)] = req.headers[current];
        return all;
    },{});

    if (SEND_REAL_IP_ON_HEADERS) _headers["dp-original-ip"] = req.ip;
    _headers["user-agent"] = _headers["user-agent"] || `KaoDataPipe/${KAO_VERSION}`;

    res.setHeader("access-control-allow-origin", "*");
    res.setHeader("access-control-allow-headers", "*");
    res.setHeader("access-control-allow-methods", "*");
    res.setHeader("access-control-allow-credentials", "true");
    res.setHeader("access-control-max-age", "900");

    let gotOpts = {
        method: req.method,
        headers: _headers,
        isStream: true,
        responseType: "buffer",
        throwHttpErrors: false
    };
    
    if (req.method.toLowerCase() != "get") { 
        gotOpts.body = await convertStream.toBuffer(req);
    }
    
    let stream = await got(url, gotOpts);
    if (req.method.toLowerCase() != "get") { 
        stream.once("end",()=>{gotOpts.body.fill(0)}); /* Clear data from memory */
        stream.once("close",()=>{gotOpts.body.fill(0)}); /* Clear data from memory */
        stream.once("error",()=>{gotOpts.body.fill(0)}); /* Clear data from memory */
    }
    stream.pipe(res);
    return ;
});

function parseBool(t="") {
    let result = false;
    switch (t.toLowerCase()) {
        case "0":
        case "false":
        case "no":
            result = false;
            break
        case "1":
        case "true":
        case "yes":
            result = true;
            break
    }
    return result;
}

app.listen(process.env.PORT, ()=>{
    console.log(clc.cyanBright(`Listining port ${process.env.PORT}!\nKAO_VERSION: ${KAO_VERSION}`));
})