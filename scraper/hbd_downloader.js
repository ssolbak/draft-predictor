'use strict';

const BASE_FOLDER = "_hbd_raw";

const _ = require('lodash');
const async = require('async');
const fs = require('fs');
const path = require('path');
const constants = require('./constants');
const utils = require('./utils');
const FileDownloader = require('./file_downloader');
const downloader = new FileDownloader({
    host: 'www.hockeydb.com',
    scrape_delay_in_seconds: 1500,
    bot_delay_in_seconds: 1500
});

class HbdDownloader {

    download_draft(year, done) {

        console.log("hbd downloading draft", year);

        let url = `http://www.hockeydb.com/ihdb/draft/nhl${year}e.html`;
        downloader.download(url, { folder: `${BASE_FOLDER}/drafts`, name: `${year}.txt` }, (err, download) => {

            if(err) return cb(err);

            console.log("\ndownloading players for draft year", year);

            let players = [];
            let content = download.content;

            //for some dumb reason I cant use RegEx constructor... need to figure out why later...
            let matches;
            while(matches = /<a target="players" href="(\/ihdb\/stats\/pdisplay.php\?pid=([0-9]+))">([^<]+)<\/a>/g.exec(content)) {

                if(!matches || matches.length < 3) {
                    return done(`Incomplete match in year ${year} ${matches}`);
                }

                let url = `http://hockeydb.com${matches[1]}`;
                let player_id = matches[2];
                let player_name = matches[3];
                let player_key = player_name.toLowerCase().replace(/ /g, "_").replace(/[,.']+/g, "");

                console.log("adding player", player_id, player_name);
                players.push({ url, player_id, player_name, player_key, year });

                content = content.substring(content.indexOf(matches[0]) + matches[0].length);
            }

            players = _.uniqBy(players, "player_id");

            setTimeout(() => done(null, players), 1);

        });

    }

    download(players, done) {

        console.log(`hbd downloading ${players.length} players`);
        async.eachSeries(players, (player, cb) => {

            let options = {
                folder: `${BASE_FOLDER}/players`,
                name: `${player.player_id}___${player.player_key}.txt`
            };

            downloader.download(player.url, options, (err) => {
                if(err) {
                    console.log("Error downloading player", player, err);
                    return cb(err);
                }
                return cb();
            });

        }, done);

    }

    getTeamInfo({ year, league_year_folder, content }, done) {

        if(!year) {
            return done(`${league_year_folder} year is missing ${year}`);
        }

        let pattern = `<a href="(teams/([0-9]+)${year + 1}.html)">([^<]+)</a>`;

        console.log(`Getting team info for ${league_year_folder}. Pattern is ${pattern}`);

        let re = new RegExp(pattern, "g");

        let teams = [];

        let matches;
        while(matches = re.exec(content)) {

            if(!matches || matches.length < 4) {
                return done(`Cannot find teams in league standings for ${league_year_folder}`);
            }

            let url = `https://hockeydb.com/ihdb/stats/leagues/seasons/${matches[1]}`;
            let team_id = matches[2];
            let team_name = matches[3];

            teams.push({ url, team_id, team_name });
        }

        console.log(teams.length, "number of teams");
        if(teams.length === 0) {
            return done(`${league_year_folder} could not find any teams!!`);
        }

        async.eachSeries(teams, (team, cb) => {
            let file_name = utils.getTeamFileFor(team.team_id, team.team_name);
            downloader.download(team.url, { folder: league_year_folder, name: file_name }, cb);
        }, done);
    }

    downloadLeagues({ years }, done) {

        console.log("==========================");
        console.log("downloading leagues");
        console.log("==========================");

        async.eachSeries(_.keys(constants.leagues), (league, cb) => {

            let league_key = league.toLowerCase();
            console.log("\ndownloading", league);

            let league_folder = `${BASE_FOLDER}/teams/${league_key}`;
            if(!fs.existsSync(path.join(__dirname, league_folder))) {
                fs.mkdirSync(path.join(__dirname, league_folder));
            }

            if(!constants.leagues[league].hockey_db_id) {
                return cb(`Missing hockey_db_id for league ${league}`);
            }

            let url = `https://www.hockeydb.com/ihdb/stats/leagues/${constants.leagues[league].hockey_db_id}.html`;
            downloader.download(url, { folder: league_folder, name: `_info.txt` }, (err, download) => {

                if(err) return cb(err);

                let url_map = this.getLeagueInfo({ league, years, content: download.content });

                async.eachSeries(years, (year, cb) => {

                    //ie no nhl season in 2004-05
                    if(!_.has(url_map, year)) return cb();

                    let league_year_folder = `${BASE_FOLDER}/teams/${league_key}/${year}`;
                    if(!fs.existsSync(path.join(__dirname, league_year_folder))) {
                        fs.mkdirSync(path.join(__dirname, league_year_folder));
                    }

                    downloader.download(url_map[year], {
                        folder: league_year_folder,
                        name: `_standings.txt`
                    }, (err, download) => {

                        if(err) return cb(err);

                        this.getTeamInfo({ league_year_folder, year, content: download.content }, (err) => {
                            if(err) {
                                console.log("error getting team info", league_year_folder, year, err);
                                return cb();
                            }
                            return cb();
                        });

                    });

                }, cb);

            });

        }, done);

    }

    getLeagueInfo({ league, years, content }) {

        let url_map = {};

        console.log("\nGetting all league standings");
        _.each(years, (year) => {

            console.log(`league ${league} year ${year}`);
            let pattern = `<a href="(\/ihdb\/stats\/leagues\/seasons\/[^.]+.html)">(${year}-${utils.pad(year - 1999, 2)})<\/a>`;
            let re = new RegExp(pattern, "g");

            let matches = re.exec(content);

            if(!matches || matches.length < 1) {

                //no nhl season in 2004-05
                if(league === 'NHL' && year === 2004) return;

                console.log(`Cannot find league standings for league ${league} year ${year}`);
                return process.exit(1);
            }

            console.log(`url ${matches[1]}`);
            url_map[year] = `https://hockeydb.com/${matches[1]}`;
        });

        return url_map;

    }

}

module.exports = HbdDownloader;