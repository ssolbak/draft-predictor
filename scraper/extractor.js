'use strict';

const _ = require("lodash");
const async = require("async");
const fs = require("fs");
const path = require("path");
const stringify = require('csv-stringify');

process.on('uncaughtException', (err) => {
    console.log("Error:", err);
    return process.exit(1);
});

const extractor = require(`./extractors/ep`);
const base_dir = `/_ep_raw/players`;

let context = { players: {} };

async.series([
    (cb) => {
        // let files = fs.readdirSync(path.join(__dirname, base_dir));

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
        //         file_name : path.join(__dirname, '/_raw_data/players') + file
        //     };
        //
        // });

        const add_player = (id, key) => {
            context.players[id.toString()] = {
                id: id,
                key: key,
                file_name: path.join(__dirname, base_dir, `${id}___${key}.txt`)
            };
        };

        add_player(6146, 'sidney-crosby');
        // add_player(77237, 'nikita-kucherov');
        // add_player(8792, 'jonathan-toews');

        return cb();
    },
    (cb) => {

        async.eachSeries(context.players, (player, cb) => {
            extractor.get_player_info(player, (err) => {
                if(err) {
                    console.log(`error on player ${JSON.stringify(player)}`);
                }
                return cb(err);
            });
        }, (err) => {
            return cb(err);
        });

    }
], (err) => {

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

        console.log('writing file', path.join(__dirname, '/_data/players.csv'));
        fs.writeFileSync(path.join(__dirname, '/_data/players.csv'), txt);

        console.log('Done');
        return process.exit(0);

    });

});


