"use strict";

// source of nhle is https://twitter.com/HockeyAbstract/status/866477120360402944
module.exports = {
    leagues: {
        'OHL': {
            name: 'OHL',
            games_played: 68,
            hockey_db_id: 167,
            get_nhle_for : (year) => 0.30
        },
        'WHL': {
            name: 'WHL',
            games_played: 72,
            hockey_db_id: 257,
            get_nhle_for : (year) => 0.29
        },
        // 'QMJH': {
        //     name: 'QMJH',
        //     games_played: 68,
        //     hockey_db_id:
        // },
        'QMJHL': {
            name: 'QMJHL',
            games_played: 68,
            hockey_db_id: 197,
            get_nhle_for : (year) => 0.25
        },
        'H-EAST': {
            name: 'H-EAST',
            games_played: 38,
            hockey_db_id: 328,
            get_nhle_for : (year) => 0.38
        },
        'USHL': {
            name: 'USHL',
            games_played: 26,
            hockey_db_id: 251,
            get_nhle_for : (year) => 0.33
        },
        'SweHL': {
            name: 'SweHL',
            games_played: 52,
            hockey_db_id: 239,
            get_nhle_for : (year) => 0.58
        },
        'NHL': {
            name: 'NHL',
            games_played: 22,
            hockey_db_id: 141,
            get_nhle_for : (year) => 1
        },
        'AHL': {
            name: 'AHL',
            games_played: 73.5, // sometimes 73, some 74
            hockey_db_id: 112,
            get_nhle_for : (year) => 0.47
        },
        'MHL': {
            name: 'MHL',
            games_played: 66,
            hockey_db_id: null,
            get_nhle_for : (year) => 0.29 // ESTIMATE
        }
    },
    sources: {
        hdb: {
            base_folder: '_hdb_raw',
            get_team_filename : (team_id, team_name) => {
                let team_key = team_name.toLowerCase()
                                         .replace(/ /g, "_")
                                         .replace(/\//g, "-")
                                         .replace(/[,.']+/g, "");

                return `${team_id}___${team_key}.txt`;
            }
        },
        href: {
            base_folder: '_href_raw'
        },
        ep: {
            base_folder: '_ep_raw',
            get_team_filename : (team_id, team_slug) => {
                return `${team_id}___${team_slug}.txt`;
            }
        }
    }
};

