"use strict";

const fs = require('fs');

exports.pad = (num, digits) => {
    return num.toString().padStart(digits, "0");
};

// assumes hockeydb
exports.getTeamFileFor = (team_id, team_name) => {

    let team_key = team_name.toLowerCase()
        .replace(/ /g, "_")
        .replace(/\//g, "-")
        .replace(/[,.']+/g,"");

    return `${team_id}___${team_key}.txt`;

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