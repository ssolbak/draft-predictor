'use strict';

const _ = require('lodash');
const async = require('async');
const fs = require('fs');
const path = require('path');
const constants = require('./constants');

const HbdDownloader = require('./hbd_downloader');
const downloader = new HbdDownloader();

const team_data = {};

const get_hdb_team_data_for = (year_end, league, team_name) => {

    const year = year_end - 1; // should really rename all folders
    const BASE_FOLDER = constants.sources.hdb.base_folder;

    league = league.toLowerCase();

    if(!(_.has(team_data, year) && _.has(team_data, `${year}.${league}`))) {

        if(!_.has(team_data, year)) team_data[year] = {};
        if(!_.has(team_data, `${year}.${league}`)) team_data[year][league] = {};

        let filePath = path.join(__dirname, BASE_FOLDER, "teams", league, year.toString());

        let files = _.map(fs.readdirSync(filePath), (file_name) => {
            if(file_name === '_standings.txt') return null;
            let components = file_name.split('___');
            return {
                team_id: components[0],
                team_name: components[1].replace(".txt", "")
            }
        });

        team_data[year][league] = _.compact(files);
    }

    let files = team_data[year][league];
    let input_words = _.map(team_name.split(' '), (x) => x.toLowerCase());

    let candidates = _.map(files, file => {
        let words = _.map(file.team_name.split('_'), x => x.toLowerCase());
        let matches = _.intersection(words, input_words);
        if(matches.length === 0) return null;
        return { file, matches };
    });

    candidates = _.compact(candidates);

    if(!candidates.length) {
        console.log(`Could not find match for ${year} ${league} ${team_name}`);
        return null;
    }

    let res = null;
    if(candidates.length > 1) {
        let res = _.maxBy(candidates, x => x.matches.length).file;
        console.log(`There are multiple matches for ${year} ${league} ${team_name}. Picked ${res.team_name} - ${JSON.stringify(candidates)}`);
        return { team_name: res.team_name.replace('_', ' '), team_id: res.team_id };
    } else {
        res = candidates[0].file;
    }

    return { team_name: res.team_name.replace('_', ' '), team_id: res.team_id };
};

//this uses hdb data
exports.get_team_goals_per_game = (player, done) => {

    // for now till we have all the data
    let stats = _.filter(player.stats, x => x.year_end <= 2017);

    async.eachSeries(stats, function(stat, cb) {

        if(stat.team_key === 'TOT' || stat.team_key === '2 Teams' || stat.team_key === '3 Teams') return cb();
        if(!stat.team_id) {
            if(!stat.team_name) return done(`get_team_goals_per_game - Missing field: team_name ${JSON.stringify(stat)}`);
            let result = get_hdb_team_data_for(stat.year_end, stat.team_league, stat.team_name);
            if(!result) return cb();
            stat.team_id = result.team_id;
            stat.team_name = result.team_name;
            stat.team_url = `https://www.hockeydb.com/ihdb/stats/leagues/seasons/teams/${stat.team_id}${stat.year_end}.html`;
            // console.log(`${stat.team_name} ${stat.year} mapped to ${stat.team_url}`);
        }

        downloader.getTeamDataForStat(stat, stat.team_url, (err, result) => {

            if(err) {
                console.log('could not download team page for', player.name, stat.team_url);
                return cb(err);
            }

            if(!result) {
                return cb(`could not get team data for page for ${player.name} ${stat.year_key} ${stat.team_url}`);
            }

            let content = result.content;

            let p = /<td[^>]*>Totals<\/td>\s<td><\/td>\s<td>([0-9]+)<\/td>\s<td>([0-9]+)<\/td>\s<td>([0-9]+)<\/td>\s<td>([0-9]+)<\/td>/;
            let match = p.exec(content);
            if(match && match.length === 5) {
                stat.team_goals = parseInt(match[1]);
                stat.team_assists = parseInt(match[2]);
                stat.team_points = parseInt(match[3]);
                stat.team_pims = parseInt(match[4]);
            } else {
                let p2 = /<td[^>]*>Totals<\/td>\s<td>([0-9]+)<\/td>\s<td>([0-9]+)<\/td>\s<td>([0-9]+)<\/td>\s<td>([0-9]+)<\/td>/;
                match = p2.exec(content);
                if(match && match.length === 5) {
                    stat.team_goals = parseInt(match[1]);
                    stat.team_assists = parseInt(match[2]);
                    stat.team_points = parseInt(match[3]);
                    stat.team_pims = parseInt(match[4]);
                } else {
                    // sometimes site doesnt have totals....
                    let playerTeam = /<td[^>]*>([0-9]+)<\/td>\s?<td[^>]*>([0-9]+)<\/td>\s?<td[^>]*>([0-9]+)<\/td>\s?<td[^>]*>([0-9]+)<\/td>\s?<td[^>]*>([0-9]+)<\/td>\s?/g;

                    stat.team_goals = 0;
                    stat.team_assists = 0;
                    stat.team_points = 0;
                    stat.team_pims = 0;

                    let matches;
                    while((matches = playerTeam.exec(content)) !== null) {
                        if(matches && matches.length > 4) {
                            stat.team_goals += parseInt(matches[2]);
                            stat.team_assists += parseInt(matches[3]);
                            stat.team_points += parseInt(matches[4]);
                            stat.team_pims += parseInt(matches[5]);
                        }
                    }

                    if(stat.team_goals === 0) {
                        return done(player.name + ' - could not get team stats from ' + stat.team_url);
                    }
                }
            }

            let league_info = constants.leagues[stat.team_league.toUpperCase()];
            // in 2020 the season was cut short
            if(stat.year_end !== 2020 && league_info && league_info.games_played) {
                stat.team_goals_per_game = stat.team_goals / league_info.games_played;
                stat.ipp = stat.points / (stat.team_goals_per_game * stat.games_played);
            } else {

                let playerTeam = /<td[^>]*>([0-9]+)<\/td>\s?<td[^>]*>([0-9]+)<\/td>\s?<td[^>]*>([0-9]+)<\/td>\s?<td[^>]*>([0-9]+)<\/td>\s?<td[^>]*>([0-9]+)<\/td>\s?/g;

                let maxGP = 0;
                let matches;
                while((matches = playerTeam.exec(content)) !== null) {
                    if(matches && matches.length > 1) {
                        maxGP = Math.max(maxGP, parseInt(matches[1]));
                    }
                }

                if(maxGP > 0) {
                    stat.team_goals_per_game = stat.team_goals / maxGP;
                    stat.ipp = stat.points / (stat.team_goals_per_game * stat.games_played);
                } else {
                    console.log('could not find stats for league', stat.team_league);
                }
            }

            return cb();
        });

    }, function(err) {
        return done(err);
    });
};

exports.aggregate_by_draft_year = (player, done) => {

    let currentYear = player.draft_year - 2;

    let keys = ['draft-1', 'draft', 'draft1', 'draft2', 'draft3', 'draft4', 'draft5'];

    for(let i = 0; i < keys.length; i++) {

        let key = keys[i];
        let year = currentYear + '-' + (currentYear + 1).toString().substring(2);

        let stats = _.filter(player.stats, (x) => x.year_key === year);

        if(stats && stats.length) {
            player[key] = stats;
        } else {
            player[key] = [];
        }

        currentYear++;
    }

    return done();
};
