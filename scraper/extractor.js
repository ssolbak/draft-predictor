"use strict";

const _ = require("lodash");
const async = require("async");
const fs = require('fs');
const path = require('path');
const utils = require('./utils');
const web_util = require('./web_util');

let context = {players: {}};

async.series([
    (cb) => {

        // let files = fs.readdirSync(path.join(__dirname, '/_raw_data/players'));

        // _.each(files, (file) => {
        //
        //     let match = /([0-9]+)___([^/.]+).txt/g.exec(file);
        //
        //     if(!(match && match.length === 3)){
        //         console.log("COULD NOT MATCH", file, match && match.length);
        //     }
        //
        //     context.players[match[1]] = {
        //         id: parseInt(match[1]),
        //         key: match[2],
        //         file_name : path.join(__dirname, '/_href_raw/players') + file
        //     };
        //
        // });

        context.players['mcdavco01'] = {
            id: 'mcdavco01',
            key: 'mcdavco01',
            file_name: path.join(__dirname, '/_href_raw/players', 'mcdavco01.txt')
        };

        return cb();

    }, (cb) => {

        let players = _.values(context.players);
        async.eachSeries(players, (player, cb) => {

            console.log(player.file_name);
            fs.readFile(player.file_name, "utf-8", (err, contents) => {

                if (err) return cb(err);

                if (!!~contents.indexOf("404 Not Found")) {
                    return cb("===================404 file found. Re-downloading...");
                }

                if (!!~contents.indexOf("Please complete this test to move on")) {
                    return cb("===================Bot detection. Please wait...");
                }

                player.stats = [];

                // <h1 itemprop="name">
                //     <span>Connor McDavid</span>
                // </h1>

                async.waterfall(
                    [
                        (cb) => {
                            console.log("Get Player Name");
                            getRegexVal(player, 'name', /<h1 itemprop="name">[\s]*<span>([^<]+)<\/span>[\s]*<\/h1>/, contents, cb);
                        },
                        (cb) => {
                            console.log("Get Player Position");
                            getRegexVal(player, 'position', /<strong>Position<\/strong>: ([A-Z]*)&nbsp;/, contents, cb);
                        },
                        (cb) => {
                            console.log("Get Birthdate");
                            getRegexVal(player, 'birthdate', /<span itemprop="birthDate" id="necro-birth" data-birth="(1997-01-13)">/, contents, cb);
                        },
                        (cb) => {
                            console.log("Get draft info");

                            let pattern = /<strong>Draft<\/strong>: <a href="\/teams\/([A-Z]{2,3})\/draft\.html">[^<]*<\/a>\, ([0-9]{1,2})[a-z]{2} round \(([0-9]{1,3})[a-z]{2}\&nbsp;overall\)\, <a href="\/draft\/NHL_([0-9]{4})_entry.html">/g

                            let matches = pattern.exec(contents);

                            if (!matches || matches.length < 5) return done("could not determine draft info for " + player.key);

                            player.draft_team = matches[1].toLowerCase();
                            player.draft_round = parseInt(matches[2]);
                            player.draft_overall = parseInt(matches[3]);
                            player.draft_year = parseInt(matches[4]);

                            return cb("asdfasdfa");
                        },
                        (cb) => {

                            let statsPattern = /<td[^>]*>([0-9]{4}-[0-9]+)<\/td>\s.*<a href="([^"]*)">([^<]+)<\/a><\/td>\s<td[^>]*>([^<]*)<\/td>\s<td[^>]*>([0-9]*)<\/td>\s<td>([0-9]*)<\/td>\s<td>([0-9]*)<\/td>\s/g;

                            let matches;
                            while ((matches = statsPattern.exec(contents)) !== null) {

                                if (!matches || matches.length < 8) {
                                    return cb("could not get player stats");
                                }

                                console.log("Get player stats", matches[1]);

                                let stat = {
                                    year_key: matches[1],
                                    year: matches[1].substring(0, 4),
                                    team_url: matches[2],
                                    team_name: matches[3],
                                    team_league: matches[4],
                                    games_played: parseInt(matches[5]),
                                    goals: parseInt(matches[6]),
                                    assists: parseInt(matches[7]),
                                    points: parseInt(matches[6]) + parseInt(matches[7])
                                };

                                let match = /\/ihdb\/stats\/leagues\/seasons\/teams\/([0-9]+).html/.exec(stat.team_url);

                                if (!match || match.length < 2) {
                                    return cb("could not get key for team season: " + JSON.stringify(stat));
                                }

                                let key = match[1];
                                let team_id = key.substring(0, key.length - 4); // should have a bunch of leading zeros
                                stat.team_id = parseInt(team_id);
                                player.stats.push(stat);
                            }

                            return cb();
                        },
                        (cb) => {
                            console.log("getTeamGGG");
                            getTeamGGG(player, cb);
                        },
                        (cb) => {
                            console.log("calculateIPPInfo");
                            calculateIPPInfo(player, cb);
                        }
                    ],
                    function (err) {
                        JSON.stringify(player);
                        return cb(err, player);
                    });

            });

        }, cb);

    }], (err) => {

    if (err) {
        console.log("ERROR:", err);
        return process.exit(1);
    }

    //todo write to csv

    console.log("Done");
    return process.exit(0);

});

function getRegexVal(player, key, pattern, text, done) {

    let matches = pattern.exec(text);

    if (!matches || matches.length < 2) return done("could not determine " + key);

    console.log(key, matches[1]);
    player[key] = matches[1];

    return done(null);
}

function getTeamGGG(player, done) {

    async.each(player.stats, function (stat, cb) {

        console.log("getTeamDataForStat");
        web_util.getTeamDataForStat(stat, stat.team_url, (err, content) => {

            if (err) {
                console.log("could not download team page for", player.name, stat.team_url);
                return cb(err);
            }

            if(!content) {
                return cb(`could not get team data for page for ${player.name} ${stat.year_key} ${stat.team_url}`);
            }

            let p = /<td[^>]*>Totals<\/td>\s<td><\/td>\s<td>([0-9]+)<\/td>\s<td>([0-9]+)<\/td>\s<td>([0-9]+)<\/td>\s<td>([0-9]+)<\/td>/;

            let match = p.exec(content);

            if (!match || match.length < 5) {

                // sometimes site doesnt have totals....
                let playerTeam = /<td>([0-9]+)<\/td>\s?<td>([0-9]+)<\/td>\s?<td>([0-9]+)<\/td>\s?<td>([0-9]+)<\/td>\s?<td>([0-9]+)<\/td>\s?/g;

                stat.team_goals = 0;
                stat.team_assists = 0;
                stat.team_points = 0;
                stat.team_pims = 0;

                let matches;
                while ((matches = playerTeam.exec(content)) !== null) {
                    if (matches && matches.length > 4) {
                        stat.team_goals += parseInt(matches[2]);
                        stat.team_assists += parseInt(matches[3]);
                        stat.team_points += parseInt(matches[4]);
                        stat.team_pims += parseInt(matches[5]);
                    }
                }

                if (stat.team_goals === 0) {
                    return done(player.name + " - could not get team stats from " + stat.team_url);
                }

            } else {
                stat.team_goals = parseInt(match[1]);
                stat.team_assists = parseInt(match[2]);
                stat.team_points = parseInt(match[3]);
                stat.team_pims = parseInt(match[4]);
            }

            if (gp[stat.team_league.toUpperCase()]) {
                stat.team_ggg = stat.team_goals / gp[stat.team_league.toUpperCase()];
                stat.ipp = stat.points / (stat.team_ggg * stat.games_played);
            } else {

                let playerTeam = /<td[^>]*>([0-9]+)<\/td>\s?<td[^>]*>([0-9]+)<\/td>\s?<td[^>]*>([0-9]+)<\/td>\s?<td[^>]*>([0-9]+)<\/td>\s?<td[^>]*>([0-9]+)<\/td>\s?/g;

                let maxGP = 0;
                let matches;
                while ((matches = playerTeam.exec(content)) !== null) {
                    if (matches && matches.length > 1) {
                        maxGP = Math.max(maxGP, parseInt(matches[1]));
                    }
                }

                if (maxGP > 0) {
                    stat.team_ggg = stat.team_goals / maxGP;
                    stat.ipp = stat.points / (stat.team_ggg * stat.games_played);
                } else {
                    console.log("could not find stats for league", stat.team_league);
                }
            }

            return cb();
        });

    }, function (err) {
        return done(err);
    });
}

function calculateIPPInfo(player, done) {

    let draftYear = parseInt(player.draft_year.substring(0, 4));

    let currentYear = draftYear - 2;

    let keys = ["draft-1", "draft", "draft1", "draft2", "draft3", "draft4", "draft5"];

    for (let i = 0; i < keys.length; i++) {

        let key = keys[i];
        let year = currentYear + "-" + (currentYear + 1).toString().substring(2);

        let stats = _.filter(player.stats, (x) => x.year_key === year);

        if (stats && stats.length) {
            player[key] = stats
        } else {
            player[key] = []
        }

        currentYear++;
    }

    return done();
}