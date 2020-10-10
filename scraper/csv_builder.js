'use strict';

const _ = require('lodash');
const async = require('async');
const fs = require('fs');
const path = require('path');
const stringify = require('csv-stringify');

const constants = require('./common/constants');
const href_extractor = require('./extractors/href');

let context = { players: {} };

async.series([
    (cb) => {

        let context = { players: {} };

        context.players = {};

        const add_player = (key) => {
            context.players[key] = {
                id: key,
                key: key,
                file_name: path.join(__dirname, constants.sources.href.base_folder, 'players', `${key}.txt`)
            };
        };

        // let files = fs.readdirSync(path.join(__dirname, constants.sources.href.base_folder, 'players'));
        // _.each(files, (file) => {
        //     add_player(file.substr(0, file.length - 4));
        // });

        add_player('kucheni01');
        // add_player('mcdavco01');
        // add_player('bearet01');

        return cb();

    }, (cb) => {

        let players = _.values(context.players);
        async.eachSeries(players, (player, cb) => {

            href_extractor.get_player_info(player, (err) => {
                if(err) {
                    console.log('error processing player', player.id, player.name);
                }
                return cb(err);
            })

        }, cb);

    }], (err) => {

    if(err) {
        console.log('ERROR:', err);
        return process.exit(1);
    }

    let player_data = _.map(context.players, 'csv_info');
    let csv_options = {
        header: true,
        headers: _.keys(player_data[0])
    };

    stringify(player_data, csv_options, (err, txt) => {
        if(err) {
            console.log('CSV ERROR:', err);
            return process.exit(1);
        }
        fs.writeFileSync(path.join(__dirname, '/_data/players.csv'), txt);
        console.log('Done');
        return process.exit(0);
    });

});