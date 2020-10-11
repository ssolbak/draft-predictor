'use strict';

const _ = require('lodash');

exports.format = (player, done) => {

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

    return done();

};