"use strict";

const _ = require("lodash");
const fs = require("fs");
const path = require("path");
const http = require("http");
const constants = require('./constants');
const utils = require('./utils');

// const SCRAPE_DELAY_IN_SECONDS = 5;
// const BOT_DELAY_IN_SECONDS = 10;
const SCRAPE_DELAY_IN_SECONDS = 240; // 4 min
const BOT_DELAY_IN_SECONDS = 600;

let request_count = 1;

exports.getTeamDataForStat = (stat, url, done) => {

    let fileName = utils.getTeamFileFor(stat.team_id, stat.team_name);
    let filePath = path.join(__dirname, constants.BASE_FOLDER, "teams", stat.team_league.toLowerCase(), stat.year, fileName);

    let options = {
        folder: `${constants.BASE_FOLDER}/${stat.team_league.toLowerCase()}/${stat.year}`,
        name: fileName,
        url: url
    };

    if (fs.existsSync(filePath)) {
        return this.readFile(filePath, options, done);
    } else {
        this.downloadFile(url, options, done);
    }
};

exports.downloadFile = (url, options, done) => {

    let filePath = path.join(__dirname, options.folder, options.name);

    if (!options.force && fs.existsSync(filePath)) {
        console.log("file name", filePath, "exists, loading");
        return this.readFile(filePath, _.extend({url}, options), done);
    } else {

        console.log(request_count++, "downloading", url, "to file", filePath);
        const request_options = {
            host: "www.hockeydb.com",
            port: 80,
            path: url,
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3',
                'Accept-Language': 'en-US,en;q=0.9',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/75.0.3770.100 Safari/537.36',
                'Referer': 'https://www.google.com/'
            }
        };

        let content = "";

        let req = http.request(request_options, (res) => {
            res.setEncoding("utf8");
            res.on("data", (chunk) => content += chunk);

            res.on("end", () => {
                fs.writeFile(filePath, content, (err) => {

                    if (err) return cb(err);

                    if (!!~content.indexOf("404 Not Found")) {
                        return done("404 file found at url " + url);
                    }

                    if (!!~content.indexOf("Please complete this test to move on")) {
                        options.retry_count = options.retry_count || 0;
                        options.retry_count++;
                        console.log(`Bot detection page ${options.retry_count} on url ${url}`);
                        console.log("waiting.....");
                        setTimeout(() => {
                            return this.downloadFile(url, options, done);
                        }, (BOT_DELAY_IN_SECONDS * Math.pow(2, options.retry_count) * 1000));
                        return;
                    }

                    //wait a few seconds to reduce chance of being bot detected...
                    setTimeout(() => {
                        done(err, {file_name: filePath, content: content});
                    }, SCRAPE_DELAY_IN_SECONDS * 1000);

                });
            });
        });

        req.end();
    }

};

exports.readFile = (filePath, options, done) => {
    fs.readFile(filePath, "utf-8", (err, contents) => {
        if (err) return done(err);
        if (!!~contents.indexOf("404 Not Found")) {
            console.log("===================404 file found. Re-downloading...");
            return this.downloadFile(options.url, _.extend({force: true}, options), done);
        }
        if (!!~contents.indexOf("Please complete this test to move on")) {
            console.log("===================Bot detection. Please wait...");
            return this.downloadFile(options.url, _.extend({force: true}, options), done);
        }
        return done(err, {file_name: filePath, content: contents});
    });
};