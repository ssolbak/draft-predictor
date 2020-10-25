"use strict";

const _ = require('lodash');
const fs = require('fs');
const constants = require('./constants');

exports.pad = (num, digits) => {
    return num.toString().padStart(digits, "0");
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

exports.getText = (node) => {
    if(node.children && node.children.length === 1) {
        return this.getText(node.children[0]);
    } else {
        return (node.data && node.data.trim()) || '';
    }
};

exports.getRegexVal = (player, key, pattern, text, done) => {

    let matches = pattern.exec(text);

    if(!matches || matches.length < 2) {
        return done('could not determine ' + key);
    }

    let val = matches[1] && matches[1].trim();
    // console.log(key, val);
    player[key] = val;

    return done(null, val);
};

exports.year_key = (start, end) => {
    return `${start}-${end}`;
};

exports.aggregate_by_draft_year = (player, done) => {

    let currentYear = player.draft_year - 2;

    const keys = ['draft-1', 'draft', 'draft1', 'draft2', 'draft3', 'draft4', 'draft5'];
    const supported_leagues = _.keys(constants.leagues);

    for(let i = 0; i < keys.length; i++) {

        let key = keys[i];
        let year = currentYear + '-' + (currentYear + 1).toString().substring(2);
        let stats = _.filter(player.stats, (x) => {
            return x.year_key === year && !!~supported_leagues.indexOf(x.team_league.toUpperCase());
        });

        if(stats && stats.length) {
            player[key] = stats;
        } else {
            player[key] = [];
        }

        currentYear++;
    }

    return done();
};
