'use strict';

const _ = require('lodash');
const async = require('async');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const constants = require('../common/constants');
const formatters = require('../common/formatters');
const utils = require('../common/utils');
const team_stats = require('../team_stats/ep');
const csv_formatter = require('./csv_formatter');

const MS_IN_A_DAY = 1000 * 60 * 60 * 24;

exports.get_player_info = (player, done) => {

    fs.readFile(player.file_name, 'utf-8', (err, contents) => {

        if(err) return done(err);

        if(!!~contents.indexOf('404 Not Found')) {
            return done('===================404 file found. Re-downloading...');
        }

        if(!!~contents.indexOf('Please complete this test to move on')) {
            return done('===================Bot detection. Please wait...');
        }

        player.stats = [];
        player.url = `https://www.eliteprospects.com/player/${player.id}/${player.key}`;
        console.log(player.url);

        const $ = cheerio.load(contents);
        let shortout = done;

        async.series(
            [
                (cb) => {

                    //if a person has dual citizenship, there will be 2 flags
                    let matches = /<div class="ep-entity-header__name">([\s]*<img[^>]*>)?[\s]*<img[^>]*>([^<]*)<\/div>/.exec(contents);

                    if(!matches || matches.length < 2) {
                        console.log('could not determine name at ', player.url);
                        return shortout();// player doesnt matter
                    }

                    let val = matches[matches.length-1].trim();
                    player.name = val;
                    return cb();
                },
                (cb) => {
                    utils.getRegexVal(player, 'positions', /<div[^>]*>[\s]*Position[\s]*<\/div>[\s]*<div[^>]*>([^<]*)<\/div>/, contents, (err, positions) => {
                        if(err) return cb(err);
                        player.positions = positions.indexOf('/') ? positions.split('/') : [positions];
                        return cb();
                    });
                },
                (cb) => {
                    utils.getRegexVal(player, 'birthdate', /<div[^>]*>[\s]*Date of Birth[\s]*<\/div>[\s]*<div[^>]*>[\s]*<a[^>]*>([^<]*)<\/a>[\s]*<\/div>/, contents, (err) => {
                        if(err) {
                            // this player wont matter, swallow exception
                            console.log(err);
                            player.birthdate = new Date(0);
                            return cb();
                        }
                        let monthStr = player.birthdate.substr(0,3);
                        let year = parseInt(player.birthdate.substr(10,4));
                        let month = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dev'].indexOf(monthStr);
                        let day = parseInt(player.birthdate.substr(5,2));
                        player.birthdate = new Date(year, month, day);
                        return cb();
                    });
                },
                (cb) => {

                    let matches = /<div[^>]*>[\s]*Height[\s]*<\/div>[\s]*<div[^>]*>[\s]*([0-9])&#039;([0-9]{1,2})&quot; \/ ([0-9]{3}) cm[\s]*<\/div>/g.exec(contents);

                    if(!matches || matches.length < 4) {
                        console.log('could not determine height for ' + player.key);
                        return cb();
                    }

                    player.height_ft = parseInt(matches[1]);
                    player.height_inches = parseInt(matches[2]);
                    player.height_cm = parseInt(matches[3]);

                    return cb();
                },
                (cb) => {

                    let matches = /<div[^>]*>[\s]*Weight[\s]*<\/div>[\s]*<div[^>]*>[\s]*([0-9]{3}) lbs \/ ([0-9]{2,3}) kg[\s]*<\/div>/g.exec(contents);

                    if(!matches || matches.length < 3) {
                        console.log('could not determine weight for ' + player.key);
                        return cb();
                    }

                    player.weight_lbs = parseInt(matches[1]);
                    player.weight_kg = parseInt(matches[2]);

                    return cb();
                },
                (cb) => {

                    let pattern = /<div[^>]*>[\s]*Drafted[\s]*<\/div>[\s]*<div[^>]*>[\s]*<a[^>]*>[\s]*([0-9]{4}) round ([0-9]) #([0-9]{1,3}) overall by ([^<]*)<\/a>[\s]*<\/div>/g;

                    let matches = pattern.exec(contents);

                    if(!matches || matches.length < 5) return cb('could not determine draft info for ' + player.key);

                    player.is_defence = _.intersection(['D', 'LD', 'RD'], player.positions).length > 0;
                    player.draft_year = parseInt(matches[1]);
                    if(player.draft_year < 2005) {
                        return shortout();
                    }
                    player.draft_round = parseInt(matches[2]);
                    player.draft_overall = parseInt(matches[3]);
                    player.draft_team = matches[4].trim(); //todo map to team?
                    player.draft_date = new Date(player.draft_year, 6, 1);
                    player.draft_age_in_days = Math.round((player.draft_date - player.birthdate)/(MS_IN_A_DAY));
                    if(player.draft_year && player.birthdate.getTime() === 0) {
                        // this player didnt make it, give them a bday to no mess with other data
                        player.birthdate = new Date(player.draft_year-18, 2, 1);
                        player.draft_is_overage = false;
                    } else {
                        player.draft_is_overage = player.draft_age_in_days > (18*365*MS_IN_A_DAY);
                    }

                    // console.log(JSON.stringify(player, null, 2));
                    return cb();

                },
                (cb) => {

                    // console.log(JSON.stringify(player, null, 2));
                    // console.log('\ngetting nhl stats');
                    const player_stats_schema = {
                        year_key: { index: 0, formatter: formatters.text },
                        // year_start: { index: 0, formatter: formatters.year_start },
                        // year_end: { index: 0, formatter: formatters.year_end },
                        team_key: { index: 1, formatter: _.noop },
                        team_league: { index: 2, formatter: formatters.text },
                        games_played: { index: 3, formatter: formatters.numeric },
                        goals: { index: 4, formatter: formatters.numeric },
                        assists: { index: 5, formatter: formatters.numeric },
                        points: { index: 6, formatter: formatters.numeric }
                    };

                    let $player_stats = $('#league-stats table.player-stats');
                    let $seasons = $player_stats.find('tbody tr');

                    let last_season = '';

                    _.each($seasons, (x) => {
                        let stat = {};
                        let children = _.filter(x.children, x => x.type === 'tag');
                        _.each(_.keys(player_stats_schema), field => {
                            let col = player_stats_schema[field];
                            if(field === 'team_key') {
                                let td = children[col.index];
                                let anchor = $(td).find('span a')[0];
                                if(!anchor) {
                                    //return cb(`Could not find team url for ${player.name} on season ${stat.year_key}`);
                                    //"Did not play"
                                    return;
                                }
                                stat.team_url = anchor.attribs.href;
                                let matches = /https:\/\/www.eliteprospects.com\/team\/([0-9]*)\/([^\/]*)\/([0-9]{4}-[0-9]{4})/i.exec(stat.team_url);
                                if(!matches || matches.length < 3) {
                                    return cb(`Could not extract team info from ${stat.team_url}`);
                                }
                                stat.team_id = parseInt(matches[1]);
                                stat.team_key = matches[2].trim();
                                stat.team_name = utils.getText(anchor);
                            } else if(field === 'team_league') {
                                let td = children[col.index];
                                let anchor = _.find(td.children, x => x.type === 'tag');
                                let val = utils.getText(anchor);
                                stat[field] = col.formatter(val);
                            } else if(field === 'year_key') {
                                let val = utils.getText(children[col.index]);
                                if(val.length === 0) {
                                    val = last_season;
                                } else {
                                    last_season = val;
                                }
                                stat[field] = col.formatter(val);
                                stat.year_start = formatters.year_start(val);
                                stat.year_end = formatters.year_end(val);
                            } else {
                                let val = utils.getText(children[col.index]);
                                stat[field] = col.formatter(val);
                            }
                        });
                        stat.points_adjusted = stat.points;
                        if(stat.year_key === '2020-2021') return;
                        if(!stat.year_key) {
                            console.log(`Invalid stats (missing year key) for ${player.name}`);
                            return;
                        }
                        if(!stat.games_played) {
                            // If a player is on a roster but doesnt play (ie on LTIR) this happens (its ok)
                            console.log(`Info: Invalid stats (no games played) for ${player.name} ${stat.year_key}`);
                            return;
                        }
                        player.stats.push(stat);
                    });

                    let leagues = _.map(_.keys(constants.leagues), x => x.toLowerCase());
                    player.stats = _.filter(player.stats, x => {
                        return !!~leagues.indexOf(x.team_league.toLowerCase()) && x.year_start >= 2003 && x.year_start < 2020;
                    });
                    // console.log('other stats', JSON.stringify(player.stats.filter(x => x.team_league !== 'NHL'), null, 2));
                    return cb();

                },
                (cb) => {
                    team_stats.get_team_goals_per_game(player, (err) => {
                        return cb(err);
                    });
                },
                (cb) => {
                    utils.aggregate_by_draft_year(player, (err) => {
                        return cb(err);
                    });
                },
                (cb) => {
                    let nhl_stats = _.filter(player.stats, x => x.team_league === 'NHL' && x.games_played > 50);
                    let sorted = _.sortBy(nhl_stats, x => x.points / x.games_played).reverse();
                    let best_3_years = _.take(sorted, 3);

                    if(best_3_years.length < 2) {
                        player.ppg_impact = player.draft_year >= 2014 ? -1 : 0;
                    } else {
                        player.ppg_impact = _.meanBy(best_3_years, x => x.points / x.games_played);
                    }
                    return cb();
                },
                (cb) => {
                    csv_formatter.format(player, (err) => {
                        console.log('draft-team_league', player['draft-team_league']);
                        return cb(err);
                    });
                }
            ],
            function(err) {
                if(err) {
                    console.log(`Error on player ${player.key} ${player.url} ${player.file_name}`);
                    console.log(`Details: ${err}`);
                }
                return done(err, player);
            });
    });
}
