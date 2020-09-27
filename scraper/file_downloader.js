"use strict";

const _ = require("lodash");
const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");
const utils = require("./utils");

let request_count = 1;

class FileDownloader {

    constructor(settings) {

        let defaults = {
            scrape_delay_in_seconds: 1500,
            bot_delay_in_seconds: 1500
        };

        if(!settings.host) throw new Exception("Missing host");

        this.settings = _.extend({}, defaults , settings || {})
    }

    download(url, options, done) {

        let filePath = path.join(__dirname, options.folder, options.name);

        if (!options.force && fs.existsSync(filePath)) {
            console.log("file name", filePath, "exists, loading");
            return utils.readFile(filePath, _.extend({url}, options), done);
        } else {

            console.log(request_count++, "downloading", url, "to file", filePath);

            const proto = !!~url.indexOf('https') ? https : http;

            const request_options = {
                host: this.settings.host,
                port: 443,
                path: url,
                headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.102 Safari/537.36',
                    'Referer': 'https://www.google.com/'
                }
            };

            let content = "";

            let req = proto.request(request_options, (res) => {
                res.setEncoding("utf8");
                res.on("data", (chunk) => content += chunk);
                res.on("error", (err) => {
                    console.log("request error", err);
                    return done(err);
                })

                res.on("end", () => {
                    fs.writeFile(filePath, content, (err) => {

                        if (err) return done(err);

                        if (!!~content.indexOf("404 Not Found")) {
                            return done("404 file found at url " + url);
                        }

                        if (!!~content.indexOf("Please complete this test to move on")) {
                            options.retry_count = options.retry_count || 0;
                            options.retry_count++;
                            console.log(`Bot detection page ${options.retry_count} on url ${url}`);
                            console.log("waiting.....");
                            setTimeout(() => {
                                return this.download(url, options, done);
                            }, (this.settings.bot_delay_in_seconds * 1000));
                        } else {
                            //wait a few seconds to reduce chance of being bot detected...
                            setTimeout(() => {
                                done(err, {file_name: filePath, content: content});
                            }, this.settings.scrape_delay_in_seconds * 1000);
                        }
                    });
                });
            });

            req.end();
        }

    }

}

module.exports = FileDownloader;

// exports.readFile = (filePath, options, done) => {
//     fs.readFile(filePath, "utf-8", (err, contents) => {
//         if (err) return done(err);
//         if (!!~contents.indexOf("404 Not Found")) {
//             console.log("===================404 file found. Re-downloading...");
//             return this.downloadFile(options.url, _.extend({force: true}, options), done);
//         }
//         if (!!~contents.indexOf("Please complete this test to move on")) {
//             console.log("===================Bot detection. Please wait...");
//             return this.downloadFile(options.url, _.extend({force: true}, options), done);
//         }
//         return done(err, {file_name: filePath, content: contents});
//     });
// };
