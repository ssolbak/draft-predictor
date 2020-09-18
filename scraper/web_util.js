"use strict";

const _ = require("lodash");
const fs = require("fs");
const path = require("path");
const http = require("http");
const constants = require('./constants');
const utils = require('./utils');

// const SCRAPE_DELAY_IN_SECONDS = 5;
// const BOT_DELAY_IN_SECONDS = 10;
const SCRAPE_DELAY_IN_SECONDS = 1500;
const BOT_DELAY_IN_SECONDS = 1500;

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
