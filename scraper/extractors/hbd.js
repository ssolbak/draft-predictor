"use strict";

const _ = require("lodash");
const async = require("async");
const fs = require('fs');
const path = require('path');
const team_stats = require('../team_stats/team_stats');
const utils = require('../common/utils');

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
        //         file_name : path.join(__dirname, '/_raw_data/players') + file
        //     };
        //
        // });

        context.players['73288'] = {
            id: 73288,
            key: 'sidney_crosby',
            file_name: path.join(__dirname, '/_raw_data/players', '73288___sidney_crosby.txt')
        };

        return cb();

    }, (cb) => {

        let players = _.values(context.players);
        async.eachSeries(players, (player, cb) => {

            console.log(player.key);
            fs.readFile(player.file_name, "utf-8", (err, contents) => {

                if (err) return cb(err);

                if (!!~contents.indexOf("404 Not Found")) {
                    return cb("===================404 file found. Re-downloading...");
                }

                if (!!~contents.indexOf("Please complete this test to move on")) {
                    return cb("===================Bot detection. Please wait...");
                }

                player.stats = [];
                let shortout = cb;

                async.waterfall(
                    [
                        (cb) => {
                            utils.getRegexVal(player, 'name', /<h1 itemprop="name" class="title">([^<]+)<\/h1>/, contents, (err) =>{
                                if (err) {
                                    console.log(err);
                                    return shortout();// player doesnt matter
                                }
                                return cb();
                            });
                        },
                        (cb) => {
                            utils.getRegexVal(player, 'draft_year', /<a href="\/ihdb\/draft\/nhl([0-9]+)e.html"/, contents, (err) => {

                                if (err) {
                                    // hack, fix this
                                    console.error(err, "defaulting to 2017-18");
                                    player.draft_year = "2017-18";
                                }

                                return cb();
                            });
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
                            team_stats.get_team_goals_per_game(player, cb);
                        },
                        (cb) => {
                            team_stats.aggregate_by_draft_year(player, cb);
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