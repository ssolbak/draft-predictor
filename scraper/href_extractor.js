'use strict';

const _ = require('lodash');
const async = require('async');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const stringify = require('csv-stringify');

const constants = require('./constants');
const team_stats = require('./team_stats');

let context = { players: {} };

const formatters = {
    numeric: (x) => parseInt(x),
    text: (x) => x,
    year_start: (x) => parseInt(x.substr(0, 4)),
    year_end: (x) => parseInt(x.substr(0, 4))+1,
    team_name : (x) => {
        const teams = {
            ana : 'Anaheim Ducks',
            ari : 'Arizona Coyotes',
            bos: 'Boston Bruins',
            buf: 'Buffalo Sabres',
            cbj: 'Columbus Blue Jackets',
            cgy: 'Calgary Flames',
            chi: 'Chicago Blackhawks',
            col: 'Colorado Avalanche',
            cal: 'Calgary Flames',
            dal: 'Dallas Stars',
            det: 'Detroit Red Wings',
            edm: 'Edmonton Oilers',
            fla: 'Florida Panthers',
            lak : 'Los Angeles Kings',
            min : 'Minnesota Wild',
            mon : 'Montreal Canadians',
            njd : 'New Jersey Devils',
            nsh : 'Nashville Predators',
            nyi : 'New York Islanders',
            nyr : 'New York Rangers',
            ott : 'Ottawa Senators',
            phi : 'Philadelphia Flyers',
            phx : 'Arizona Coyotes',
            pit : 'Pittsburgh Penguins',
            sjs : 'San Jose Sharks',
            stl : 'St Louis Blues',
            van : 'Vancouver Canucks',
            veg : 'Vegas Golden Knights',
            wpg : 'Winnipeg Jets',
            wsh : 'Washington Capitals',
        };
        return teams[x.toLowerCase()];
    }
};

const get_text = (node) => {
    if(node.children && node.children.length === 1) {
        return get_text(node.children[0]);
    } else {
        return node.data;
    }
};

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

        // context.players['mcdavco01'] = {
        //     id: 'mcdavco01',
        //     key: 'mcdavco01',
        //     file_name: path.join(__dirname, '/_href_raw/players', 'mcdavco01.txt')
        // };

        context.players['crosbsi01'] = {
            id: 'crosbsi01',
            key: 'crosbsi01',
            file_name: path.join(__dirname, '/_href_raw/players', 'crosbsi01.txt')
        };

        return cb();

    }, (cb) => {

        let players = _.values(context.players);
        async.eachSeries(players, (player, cb) => {

            console.log(player.file_name);
            fs.readFile(player.file_name, 'utf-8', (err, contents) => {

                if(err) return cb(err);

                if(!!~contents.indexOf('404 Not Found')) {
                    return cb('===================404 file found. Re-downloading...');
                }

                if(!!~contents.indexOf('Please complete this test to move on')) {
                    return cb('===================Bot detection. Please wait...');
                }

                player.stats = [];

                const $ = cheerio.load(contents);

                async.waterfall(
                    [
                        (cb) => {
                            console.log('Get Player Name');
                            getRegexVal(player, 'name', /<h1 itemprop="name">[\s]*<span>([^<]+)<\/span>[\s]*<\/h1>/, contents, cb);
                        },
                        (cb) => {
                            console.log('Get Player Position');
                            getRegexVal(player, 'position', /<strong>Position<\/strong>: ([A-Z]*)&nbsp;/, contents, cb);
                        },
                        (cb) => {
                            console.log('Get Birthdate');
                            getRegexVal(player, 'birthdate', /<span itemprop="birthDate" id="necro-birth" data-birth="([0-9]{4}-[0-9]{2}-[0-9]{2})">/, contents, cb);
                        },
                        (cb) => {
                            console.log('Get draft info');

                            let pattern = /<strong>Draft<\/strong>: <a href="\/teams\/([A-Z]{2,3})\/draft\.html">[^<]*<\/a>\, ([0-9]{1,2})[a-z]{2} round \(([0-9]{1,3})[a-z]{2}\&nbsp;overall\)\, <a href="\/draft\/NHL_([0-9]{4})_entry.html">/g;

                            let matches = pattern.exec(contents);

                            if(!matches || matches.length < 5) return cb('could not determine draft info for ' + player.key);

                            player.is_defence = !!~['d','ld','rd'].indexOf(player.position.toLowerCase());
                            player.url = `https://www.hockey-reference.com/players/${player.key[0]}/${player.key}.html`;
                            player.draft_team = matches[1].toLowerCase();
                            player.draft_round = parseInt(matches[2]);
                            player.draft_overall = parseInt(matches[3]);
                            player.draft_year = parseInt(matches[4]);

                            console.log(JSON.stringify(player, null, 2));
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

                            // console.log('nhl stats', JSON.stringify(player.stats, null, 2));

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
                            console.log('get_team_goals_per_game');
                            team_stats.get_team_goals_per_game(player, (err) => {
                                return cb(err);
                            });
                        },
                        (cb) => {
                            console.log('calculate_by_draft_year');
                            team_stats.calculate_by_draft_year(player, (err) => {
                                console.log(JSON.stringify(player, null, 2));
                                return cb(err);
                            });
                        },
                        (cb) => {
                            console.log('calculate_impact');
                            let nhl_stats = _.filter(player.stats, x => x.team_league === 'NHL' && x.games_played > 50);
                            let sorted = _.sortBy(nhl_stats, x => x.points/x.games_played).reverse();
                            let best_3_years = _.take(sorted, 3);
                            player.ppg_impact = _.meanBy(best_3_years, x => x.points/x.games_played);
                            console.log('ppg_impact', player.ppg_impact);
                            console.log(JSON.stringify(player, null, 2));
                            return cb();
                        }
                    ],
                    function(err) {
                        return cb(err, player);
                    });
            });

        }, cb);

    }], (err) => {

    if(err) {
        console.log('ERROR:', err);
        return process.exit(1);
    }

    //todo write to csv
    // stringify([player], (err, txt) => {
    //     if(err) return cb(err);
    //     console.log(txt);
    //     return cb('asdfasdfasd');
    // });

    console.log('Done');
    return process.exit(0);

});

function getRegexVal(player, key, pattern, text, done) {

    let matches = pattern.exec(text);

    if(!matches || matches.length < 2) return done('could not determine ' + key);

    console.log(key, matches[1]);
    player[key] = matches[1];

    return done(null);
}
