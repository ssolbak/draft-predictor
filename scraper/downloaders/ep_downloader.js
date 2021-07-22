'use strict';


const _ = require('lodash');
const async = require('async');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const constants = require('../common/constants');
const utils = require('../common/utils');
const FileDownloader = require('../common/file_downloader');

const downloader = new FileDownloader({
    host: 'www.eliteprospects.com',
    scrape_delay_in_seconds: 5,
    bot_delay_in_seconds: 300
});

const BASE_FOLDER = constants.sources.ep.base_folder;

const get_text = (node) => {
    if(node.children && node.children.length === 1) {
        return get_text(node.children[0]);
    } else {
        return node.data;
    }
};

class EpDownloader {

    download_draft(year, done) {

        console.log("href downloading draft", year);

        let url = `https://www.eliteprospects.com/draft/nhl-entry-draft/${year}`;
        downloader.download(url, { folder: `../${BASE_FOLDER}/drafts`, name: `${year}.txt` }, (err, download) => {

            if(err) return done(err);

            console.log("\nhref downloading players for draft year", year);

            let players = [];
            let content = download.content;

            let is_v2 = /<td class="team-logo">[\s]*<a[^>]*><img[^>]*><\/a>[\s]*<\/td>/g.test(content);

            // the 2nd version has and extra team-logo column
            let version1 = /td class="overall sorted">([^<]*)<\/td>[\s]*<td class="team">[\s]*<a href="https:\/\/www.eliteprospects.com\/team\/([0-9]+)\/([^\/]+)">([^<]*)<\/a>[\s]*<\/td>[\s]*<td class="player">[\s]*<i>[\s]*<img[^>]*>[\s]*<\/i>[\s]*<span[^>]*>[\s]*<a href="https:\/\/www.eliteprospects.com\/player\/([0-9]+)\/([^\/]+)">([^<]*)<\/a>/g;
            let version2 = /td class="overall sorted">([^<]*)<\/td>[\s]*<td class="team-logo">[\s]*<a[^>]*><img[^>]*><\/a>[\s]*<\/td>[\s]*<td class="team">[\s]*<a href="https:\/\/www.eliteprospects.com\/team\/([0-9]+)\/([^\/]+)">([^<]*)<\/a>[\s]*<\/td>[\s]*<td class="player">[\s]*<i>[\s]*<img[^>]*>[\s]*<\/i>[\s]*<span[^>]*>[\s]*<a href="https:\/\/www.eliteprospects.com\/player\/([0-9]+)\/([^\/]+)">([^<]*)<\/a>/g;

            let re = is_v2 ? version2 : version1;

            let matches;
            while(matches = re.exec(content)) {

                if(!matches || matches.length < 8) {
                    return done(`Incomplete draft match in year ${year} ${matches}`);
                }

                let player = {
                    overall : parseInt(matches[1].trim().replace("#","")),
                    team_id : parseInt(matches[2]),
                    team_slug : matches[3].trim(),
                    team_name : matches[4].trim(),
                    player_id : parseInt(matches[5]),
                    player_slug : matches[6].trim(),
                    player_name : matches[7].trim(),
                    draft_date : new Date(year, 5, 25)
                };

                player.position = player.player_name[player.player_name.length-2];
                player.player_name = player.player_name.substr(0, player.player_name.length-4);

                player.url = `https://www.eliteprospects.com/player/${player.player_id}/${player.player_slug}`;
                // console.log(JSON.stringify(player));
                players.push(player);
            }

            players = _.uniqBy(players, "player_id");

            setTimeout(() => done(null, players), 1);

        });

    }

    download(players, done) {

        console.log(`ep downloading ${players.length} players`);
        async.eachSeries(players, (player, cb) => {

            let options = {
                folder: `../${BASE_FOLDER}/players`,
                name: `${player.player_id}___${player.player_slug}.txt`
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

    downloadLeagues({ years, leagues }, options, done) {

        console.log("====================================");
        console.log("downloading leagues");
        console.log("====================================");

        async.eachSeries(leagues, (league, cb) => {

            let league_key = league.toLowerCase();

            let league_folder = `../${BASE_FOLDER}/teams/${league_key}`;
            if(!fs.existsSync(path.join(__dirname, league_folder))) {
                fs.mkdirSync(path.join(__dirname, league_folder));
            }

            console.log("downloading league -", league_key);
            let league_info = constants.leagues[league_key.toUpperCase()];

            async.eachSeries(years, (year, cb) => {

                const season_key = `${year}-${year+1}`;
                console.log("Season", season_key);

                if(league_info.end_year) {
                    if(year <= league_info.end_year) {
                        console.log(`No ${league} season in ${season_key} (end year)`);
                        return cb();
                    }
                } else if(league_info.start_year) {
                    if(year < league_info.start_year) {
                        console.log(`No ${league} season in ${season_key} (start year)`);
                        return cb();
                    }
                }

                let league_year_folder = `../${BASE_FOLDER}/teams/${league_key}/${season_key}`;
                if(!fs.existsSync(path.join(__dirname, league_year_folder))) {
                    fs.mkdirSync(path.join(__dirname, league_year_folder));
                }

                let league_url = `https://www.eliteprospects.com/league/${league_key}/${season_key}`;
                console.log(league_url)
                downloader.download(league_url, {
                    force: options.force,
                    folder: league_year_folder,
                    name: `_standings.txt`
                }, (err, download) => {

                    if(err) return cb(err);

                    this._getTeamInfo({ league_year_folder, season_key, year, content: download.content }, (err) => {

                        if(err) {
                            console.log("error getting team info", league_year_folder, year, err);
                            return cb();
                        }

                        return cb();
                    });

                });

            }, cb);


        }, done);

    }

    _getTeamInfo({ season_key, league_year_folder, content }, done) {

        let pattern = `<td class="team">[\\s]*<a href="https:\\/\\/www\\.eliteprospects\\.com\\/team\\/([0-9]+)\\/([^\\/]+)\\/${season_key}">([^<]+)<\\/a>[\\s]*<\\/td>[\\s]*`;

        let stats = ['gp','w','t','l','otw','otl','gf','ga'];
        _.each(stats, stat => {
            pattern += `<td class="${stat}"[^>]*>[\\s]*([^<]+)<\/td>[\\s]*`;
        });

        console.log(`Getting team info for ${league_year_folder}. Pattern is ${pattern}`);

        let re = new RegExp(pattern, "g");
        let teams = [];

        let matches;
        while(matches = re.exec(content)) {

            if(!matches || matches.length < 12) {
                return done(`Cannot find teams in league standings for ${league_year_folder}`);
            }

            let stat = {
                team_id: parseInt(matches[1]),
                team_slug: matches[2],
                team_name: matches[3]
            };

            stat.url = `https://www.eliteprospects.com/team/${stat.team_id}/${stat.team_slug}/${season_key}?tab=stats`;

            _.each(stats, (x, i) => {
                stat[x] = parseInt(matches[4+i])
            });

            teams.push(stat);
        }

        console.log(teams.length, "number of teams");
        if(teams.length === 0) {
            return done(`${league_year_folder} could not find any teams!!`);
        }

        async.eachSeries(teams, (team, cb) => {
            let file_name = constants.sources.ep.get_team_filename(team.team_id, team.team_slug);
            downloader.download(team.url, { folder: league_year_folder, name: file_name }, cb);
        }, done);
    }

    getTeamDataForStat(stat, url, done){

        if(!stat.year_end) return done('getTeamDataForStat: Missing year_end');
        if(!stat.team_id) return done('getTeamDataForStat: Missing team_id');
        if(!stat.team_league) return done('getTeamDataForStat: Missing team_league');

        const fileName = constants.sources.ep.get_team_filename(stat.team_id, stat.team_name);
        const year_key = `${stat.year_start}-${stat.year_end}`;
        const filePath = path.join(__dirname, `../${BASE_FOLDER}/teams`, stat.team_league.toLowerCase(), year_key, fileName);

        let options = {
            folder: `${BASE_FOLDER}/teams/${stat.team_league.toLowerCase()}/${year_key}`,
            name: fileName,
            url: url
        };

        if (fs.existsSync(filePath)) {
            return utils.readFile(filePath, options, done);
        } else {
            console.log('Downloading: could not find file', filePath, stat.team_name);
            return process.exit(1);
            // downloader.download(url, options, (err, result) => {
            //     return done(err, result);
            // });
        }
    };

}

module.exports = EpDownloader;
