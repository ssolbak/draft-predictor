"use strict";

const _ = require("lodash");
const async = require("async");
const fs = require("fs");
const path = require("path");
const constants = require("./constants");
const web_util = require("./web_util");
const utils = require("./utils");

module.exports = (years, done) => {

    async.series([
        (cb) => download_drafts_and_players(years, cb),
        (cb) => {

            let start = years[0];
            years.unshift(start-1);
            years.unshift(start-2);
            years.unshift(start-3);
            years.unshift(start-4);

            download_leagues(years, cb)
        }
    ], done);

};

const download_drafts_and_players = (years, done) => {

    console.log("downloading drafts");

    async.eachSeries(years, (year, cb) => {

        let url = `http://www.hockeydb.com/ihdb/draft/nhl${year}e.html`;
        web_util.downloadFile(url, {folder : `${constants.BASE_FOLDER}/drafts`, name: `${year}.txt`}, (err, download) => {

            if(err) return cb(err);

            console.log("\ndownloading players for draft year", year);

            let players = [];
            let content = download.content;

            //for some dumb reason I cant use RegEx constructor... need to figure out why later...
            let matches;
            while (matches = /<a target="players" href="(\/ihdb\/stats\/pdisplay.php\?pid=([0-9]+))">([^<]+)<\/a>/g.exec(content)) {

                if (!matches || matches.length < 3) {
                    return done(`Incomplete match in year ${year} ${matches}`);
                }

                let url = `http://hockeydb.com${matches[1]}`;
                let player_id = matches[2];
                let player_name = matches[3];
                let player_key = player_name.toLowerCase()
                    .replace(/ /g, "_")
                    .replace(/[,.']+/g,"");

                console.log("adding player", player_id, player_name);
                players.push({url, player_id, player_name, player_key});

                content = content.substring(content.indexOf(matches[0]) + matches[0].length);
            }

            players = _.uniqBy(players, "player_id");

            console.log(players.length, "number of players");
            if(players.length === 0){
                return done(`${year} could not find any players in the draft!!`);
            }

            async.eachSeries(players, (player, cb) => {
                web_util.downloadFile(player.url, {folder : `${constants.BASE_FOLDER}/players`, name: `${player.player_id}___${player.player_key}.txt`}, cb);
            }, done);

        });

    }, done);

};

const download_leagues = (years, done) => {

    console.log("==========================");
    console.log("downloading leagues");
    console.log("==========================");

    async.eachSeries(_.keys(constants.leagues), (league, cb) => {

        let league_key = league.toLowerCase();
        console.log("\ndownloading", league);

        let league_folder = `${constants.BASE_FOLDER}/teams/${league_key}`;
        if(!fs.existsSync(path.join(__dirname, league_folder))){
            fs.mkdirSync(path.join(__dirname, league_folder));
        }

        if(!constants.leagues[league].hockey_db_id){
            return cb(`Missing hockey_db_id for league ${league}`);
        }

        let url = `http://www.hockeydb.com/ihdb/stats/leagues/${constants.leagues[league].hockey_db_id}.html`;
        web_util.downloadFile(url, {folder : league_folder, name: `_info.txt`}, (err, download) => {

            if(err) return cb(err);

            let url_map = get_league_info_from(league, years, download.content);

            async.eachSeries(years, (year, cb) => {

                let league_year_folder = `${constants.BASE_FOLDER}/teams/${league_key}/${year}`;
                if(!fs.existsSync(path.join(__dirname, league_year_folder))) {
                    fs.mkdirSync(path.join(__dirname, league_year_folder));
                }

                web_util.downloadFile(url_map[year], {folder : league_year_folder, name: `_standings.txt`}, (err, download) => {

                    if(err) return cb(err);

                    download_team_info_for(league_year_folder, year, download.content, cb);

                });

            }, cb);

        });

    }, done);

};

const get_league_info_from = (league, years, content) => {

    let url_map = {};

    console.log("\nGetting all league standings");
    _.each(years, (year) => {

        console.log(`league ${league} year ${year}`);
        let pattern = `<a href="(\/ihdb\/stats\/leagues\/seasons\/[^.]+.html)">(${year}-${utils.pad(year - 1999, 2)})<\/a>`;
        let re = new RegExp(pattern, "g");

        let matches = re.exec(content);

        if (!matches || matches.length < 1) {
            console.log(`Cannot find league standings for league ${league} year ${year}`);
            return process.exit(1);
        }

        console.log(`url ${matches[1]}`);
        url_map[year] = `http://hockeydb.com/${matches[1]}`;
    });

    return url_map;

};

const download_team_info_for = (league_year_folder, year, content, done) => {

    if(!year) {
        return done(`${league_year_folder} year is missing ${year}`);
    }

    let pattern = `<a href="(teams/([0-9]+)${year+1}.html)">([^<]+)</a>`;

    console.log(`Getting team info for ${league_year_folder}. Pattern is ${pattern}`);

    let re = new RegExp(pattern, "g");

    let teams = [];

    let matches;
    while (matches = re.exec(content)) {

        if (!matches || matches.length < 4) {
            return done(`Cannot find teams in league standings for ${league_year_folder}`);
        }

        let url = `http://hockeydb.com/ihdb/stats/leagues/seasons/${matches[1]}`;
        let team_id = matches[2];
        let team_name = matches[3];

        teams.push({url, team_id, team_name, file_name});
    }

    console.log(teams.length, "number of teams");
    if(teams.length === 0){
        return done(`${league_year_folder} could not find any teams!!`);
    }

    async.eachSeries(teams, (team, cb) => {
        let file_name = utils.getTeamFileFor(team.team_id, team.team_name);
        web_util.downloadFile(team.url, {folder : league_year_folder, name: file_name }, cb);
    }, done);

};