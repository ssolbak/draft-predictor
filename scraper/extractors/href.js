'use strict';

const _ = require('lodash');
const async = require('async');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const constants = require('./common/constants');
const formatters = require('./common/formatters');
const team_stats = require('./team_stats');

const MS_IN_A_DAY = 1000 * 60 * 60 * 24;

let context = { players: {} };

const get_text = (node) => {
    if(node.children && node.children.length === 1) {
        return get_text(node.children[0]);
    } else {
        return node.data;
    }
};

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
        player.url = `https://www.hockey-reference.com/players/${player.key[0]}/${player.key}.html`;
        console.log(player.url);

        const $ = cheerio.load(contents);
        let shortout = done;

        async.waterfall(
            [
                (cb) => {
                    getRegexVal(player, 'name', /<h1 itemprop="name">[\s]*<span>([^<]+)<\/span>[\s]*<\/h1>/, contents, (err) => {
                        if (err) {
                            console.log(err);
                            return shortout();// player doesnt matter
                        }
                        return cb();
                    });
                },
                (cb) => {
                    getRegexVal(player, 'position', /<strong>Position<\/strong>: ([A-Z]{1,2})/, contents, (err) => {
                        if (err) {
                            // hack, fix this
                            console.error(err, "defaulting to 2017-18");
                            player.draft_year = "2017-18";
                        }

                        return cb();
                    });
                },
                (cb) => {
                    getRegexVal(player, 'birthdate', /<span itemprop="birthDate" id="necro-birth" data-birth="([0-9]{4}-[0-9]{2}-[0-9]{2})">/, contents, (err) => {
                        if(err) {
                            // this player wont matter, swallow exception
                            player.birthdate = new Date(0);
                            return cb();
                        }
                        let year = parseInt(player.birthdate.substr(0,4));
                        let month = parseInt(player.birthdate.substr(5, 2));
                        let day = parseInt(player.birthdate.substr(8,2));
                        player.birthdate = new Date(year, month-1, day);
                        return cb();
                    });
                },
                (cb) => {

                    let matches = /\(([0-9]{3})cm,&nbsp;([0-9]{2,3}kg)\)/g.exec(contents);

                    if(!matches || matches.length < 3) {
                        console.log('could not determine height/weight for ' + player.key);
                        return cb();
                    }

                    player.height = parseInt(matches[1]);
                    player.weight = parseInt(matches[2]);

                    return cb();

                },
                (cb) => {

                    let pattern = /<strong>Draft<\/strong>: <a href="\/teams\/([A-Z]{2,3})\/draft\.html">[^<]*<\/a>\, ([0-9]{1,2})[a-z]{2} round \(([0-9]{1,3})[a-z]{2}\&nbsp;overall\)\, <a href="\/draft\/NHL_([0-9]{4})_entry.html">/g;

                    let matches = pattern.exec(contents);

                    if(!matches || matches.length < 5) return cb('could not determine draft info for ' + player.key);

                    player.is_defence = !!~['d', 'ld', 'rd'].indexOf(player.position.toLowerCase());
                    player.draft_team = matches[1].toLowerCase();
                    player.draft_round = parseInt(matches[2]);
                    player.draft_overall = parseInt(matches[3]);
                    player.draft_year = parseInt(matches[4]);
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

                    const nhl_stats_schema = {
                        year_key: { index: 0, formatter: formatters.text },
                        year_start: { index: 0, formatter: formatters.year_start },
                        year_end: { index: 0, formatter: formatters.year_end },
                        team_key: { index: 2, formatter: formatters.text },
                        team_name: { index: 2, formatter: formatters.team_name },
                        games_played: { index: 4, formatter: formatters.numeric },
                        goals: { index: 5, formatter: formatters.numeric },
                        assists: { index: 6, formatter: formatters.numeric },
                        points: { index: 7, formatter: formatters.numeric }
                    };

                    let $nhl_stats = $('#stats_basic_plus_nhl');
                    let $seasons = $nhl_stats.find('tbody tr');

                    _.each($seasons, (x) => {
                        let stat = { team_league: 'NHL' };
                        _.each(_.keys(nhl_stats_schema), field => {
                            let col = nhl_stats_schema[field];
                            let val = get_text(x.children[col.index]);
                            stat[field] = col.formatter(val);
                        });
                        stat.points_adjusted = stat.points;
                        player.stats.push(stat);
                    });

                    const other_stats_schema = {
                        year_key: { index: 0, formatter: formatters.text },
                        year_start: { index: 0, formatter: formatters.year_start },
                        year_end: { index: 0, formatter: formatters.year_end },
                        team_key: { index: 2, formatter: formatters.text },
                        team_name: { index: 2, formatter: formatters.text },
                        team_league: { index: 3, formatter: formatters.text },
                        games_played: { index: 4, formatter: formatters.numeric },
                        goals: { index: 5, formatter: formatters.numeric },
                        assists: { index: 6, formatter: formatters.numeric },
                        points: { index: 7, formatter: formatters.numeric }
                    };

                    // this is a hack because I think its invalid HTML and cheerio pukes
                    let start = contents.indexOf('<table class="row_summable sortable stats_table" id="stats_basic_minus_other"');
                    let sub_contents = contents.substr(start);
                    let end = sub_contents.indexOf('</table>');
                    let table_contents = sub_contents.substr(0, end + 8);

                    let $other_stats = cheerio.load(table_contents);
                    let $other_seasons = $other_stats('#stats_basic_minus_other tbody tr');

                    _.each($other_seasons, (x) => {
                        let stat = {};
                        _.each(_.keys(other_stats_schema), field => {
                            let col = other_stats_schema[field];
                            let val = get_text(x.children[col.index]);
                            stat[field] = col.formatter(val);
                        });

                        let league_info = constants.leagues[stat.team_league.toUpperCase()];
                        if(league_info) stat.points_adjusted = stat.points * league_info.get_nhle_for(stat.year_end);

                        player.stats.push(stat);
                    });

                    let leagues = _.map(_.keys(constants.leagues), x => x.toLowerCase());
                    player.stats = _.filter(player.stats, x => !!~leagues.indexOf(x.team_league.toLowerCase()));

                    // console.log('other stats', JSON.stringify(player.stats.filter(x => x.team_league !== 'NHL'), null, 2));
                    return cb();

                },
                (cb) => {
                    team_stats.get_team_goals_per_game(player, (err) => {
                        return cb(err);
                    });
                },
                (cb) => {
                    team_stats.aggregate_by_draft_year(player, (err) => {
                        return cb(err);
                    });
                },
                (cb) => {
                    // console.log('calculate_impact');
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

                    let csv_info = _.extend({}, player, {
                        birthdate : player.birthdate.toISOString().substring(0, 10),
                        is_defence : player.is_defence ? 'True' : 'False',
                        draft_is_overage : player.draft_is_overage ? 'True' : 'False',
                        draft_date : player.draft_date.toISOString().substring(0, 10)
                    });

                    let keys = ['draft-1', 'draft', 'draft1', 'draft2', 'draft3', 'draft4', 'draft5'];
                    _.each(keys, (key, index) => {
                        if(_.has(player, key)) {
                            let stats = null;
                            if(player[key].length > 1) {
                                let all_stats = player[key];
                                let leagues = _.uniq(_.map(all_stats, 'team_league'));
                                let total = {
                                    points_adjusted: 0,
                                    games_played: 0,
                                    points: 0,
                                    goals: 0,
                                    assists: 0,
                                    ipp: 0
                                };
                                let total_gp = _.sum(all_stats, 'games_played');
                                _.each(all_stats, x => {
                                    total.points_adjusted += x.points_adjusted;
                                    total.games_played += x.games_played;
                                    total.points += x.points;
                                    total.goals += x.goals;
                                    total.assists += x.assists;
                                    total.ipp += (x.ipp/total_gp);
                                });
                                stats = _.extend({
                                    year_start: player[key][0].year_start,
                                    year_end: player[key][0].year_end,
                                    team_league: leagues.length > 1 ? 'multi' : leagues[0],
                                    points_adjusted: player[key].points_adjusted,
                                }, total);
                            } else if(player[key].length === 1) {
                                stats = {
                                    year_start: player[key][0].year_start,
                                    year_end: player[key][0].year_end,
                                    team_league: player[key][0].team_league,
                                    points_adjusted: player[key][0].points_adjusted,
                                    games_played: player[key][0].games_played,
                                    points: player[key][0].points,
                                    goals: player[key][0].goals,
                                    assists: player[key][0].assists,
                                    ipp: player[key][0].ipp
                                }
                            } else {
                                stats = {
                                    year_start: player.draft_year - 2 + index,
                                    year_end: player.draft_year - 1 + index,
                                    team_league: 'n/a',
                                    points_adjusted: 0,
                                    games_played: 0,
                                    points: 0,
                                    goals: 0,
                                    assists: 0,
                                    ipp: 0
                                }
                            }

                            _.each(_.keys(stats), field => {
                                csv_info[`${key}-${field}`] = stats[field];
                            });
                        }
                    });

                    delete csv_info.file_name;
                    delete csv_info.id;
                    delete csv_info.key;
                    delete csv_info.stats;
                    delete csv_info.url;
                    _.each(keys, x => delete csv_info[x]);

                    player.csv_info = csv_info;
                    return cb();
                }
            ],
            function(err) {
                if(err) {
                    console.log(`Error on player ${player.key} ${player.url} ${player.file_name}`);
                    console.log(`Details: ${err}`);
                }
                return done(err);
            });
    });
}

function getRegexVal(player, key, pattern, text, done) {

    let matches = pattern.exec(text);

    if(!matches || matches.length < 2) return done('could not determine ' + key);

    // console.log(key, matches[1]);
    player[key] = matches[1];

    return done(null);
}
