"use strict";

// source of nhle is https://twitter.com/HockeyAbstract/status/866477120360402944
module.exports = {
    last_season : 2020,
    leagues: {
        'AHL': {
            name: 'AHL',
            games_played: 73.5, // sometimes 73, some 74
            hockey_db_id: 112,
            get_nhle_for : (year) => 0.47
        },
        'CZECH': {
            name: 'Czech',
            games_played: 0,
            hockey_db_id: null,
            get_nhle_for : (year) => 0.47  //estimated from dobber NHLe Calc
        },
        'KHL': {
            name: 'KHL',
            games_played: 68,
            hockey_db_id: null,
            get_nhle_for : (year) => 0.74
        },
        'NCAA': {
            name: 'NCAA',
            games_played: 0, //varies per team
            hockey_db_id: 328,
            get_nhle_for : (year, team_name) => {
                switch(team_name){
                    case 'Michigan State Univ.':
                    case 'Penn State Univ.':
                    case 'Ohio State Univ.':
                    case 'Univ. of Michigan':
                    case 'Univ. of Notre Dame':
                    case 'Michigan State University':
                        return 0.33; // Big10
                    case 'Boston College':
                    case 'UMass (Ameherst)':
                    case 'UMaSS-Lowell':
                    case 'Univ. of Main':
                    case 'Univ. of Connecticut':
                    case 'Boston Univ.':
                    case 'Northeaster Univ.':
                    case 'Providence College':
                    case 'Univ. of New Hampshbire':
                    case 'Merrimack College':
                    case 'Univ. of Vermont':
                        return 0.38; //H-East
                    case 'Cornell Univ.':
                    case 'Clarkson Univ.':
                    case 'Quinnipiac Univ.':
                    case 'RPI (Rensselaer Polytech. Inst.':
                    case 'Harvard Univ.':
                    case 'Dartmouth Univ.':
                    case 'Yale Univ.':
                    case 'Colgate Univ.':
                    case 'Brown Univ.':
                    case 'Union Univ.':
                    case 'Princeton Univ.':
                    case 'St Lawrence Univ.':
                        return 0.23; //ECAC
                    case 'Univ. of North Dakota':
                    case 'Univ. of Minnesota-Duluth':
                    case 'Univ. of Denver':
                    case 'Western Michigan Univ.':
                    case 'St. Cloud State Univ.':
                    case 'Univ. of Nebraska-Omaha':
                    case 'Miami Univ. (Ohio)':
                    case 'Colorado College':
                        return 0.43; //NCHC
                    default:
                        console.log('unhandled ncaa league', team_name);
                        return 0.33;
                }
            }
        },
        'LIIGA' : {
            name: 'LIIGA',
            games_played: 60,
            hockey_db_id: null,
            get_nhle_for : (year) => 0.43
        },
        'MHL': {
            name: 'MHL',
            games_played: 66,
            hockey_db_id: null,
            get_nhle_for : (year) => 0.29 // ESTIMATE
        },
        'NLA': {
            name: 'Swiss NLA',
            games_played: 50,
            hockey_db_id: null,
            get_nhle_for : (year) => 0.43
        },
        'NHL': {
            name: 'NHL',
            games_played: 22,
            hockey_db_id: 141,
            get_nhle_for : (year) => 1
        },
        'OHL': {
            name: 'OHL',
            games_played: 68,
            hockey_db_id: 167,
            get_nhle_for : (year) => 0.30
        },
        'QMJHL': {
            name: 'QMJHL',
            games_played: 68,
            hockey_db_id: 197,
            get_nhle_for : (year) => 0.25
        },
        'RUSSIA': {
            //became KHL in 2008
            name: 'Russia',
            games_played: 0,
            hockey_db_id: null,
            get_nhle_for : (year) => 0.54 // estimated, this league was lower quality than KHL
        },
        // 'SweHL': shl,
        'SHL': {
            name: 'SHL',
            games_played: 52,
            hockey_db_id: 239,
            get_nhle_for: (year) => 0.58
        },
        'USHL': {
            name: 'USHL',
            games_played: 26,
            hockey_db_id: 251,
            get_nhle_for : (year) => 0.33
        },
        'WHL': {
            name: 'WHL',
            games_played: 72,
            hockey_db_id: 257,
            get_nhle_for : (year) => 0.29
        },
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
            get_team_filename : (team_id, team_name) => {
                let team_key = team_name.toLowerCase()
                                         .replace(/ /g, "-")
                                        .replace(/\//g, "-")
                                        .replace(/'/g, "-")
                                        .replace(/å/g, 'a')
                                        .replace(/é/g, 'e')
                                        .replace(/[,.\(\))]+/g, "");
                return `${team_id}___${team_key}.txt`;
            }
        }
    }
};

