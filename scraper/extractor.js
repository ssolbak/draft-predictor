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

        const add_player = (id, key) => {
            context.players[id.toString()] = {
                id: id,
                key: key,
                file_name: path.join(__dirname, base_dir, `${id}___${key}.txt`)
            };
        };

        _.each(fs.readdirSync(path.join(__dirname, base_dir)), (file) => {

            let item = file.replace('.txt', '');
            let items = _.compact(item.split('___'));

            if(items.length !== 2) {
                console.log("COULD NOT MATCH", file);
            }

            add_player(items[0], items[1]);
        });

        // add_player(6146, 'sidney-crosby');
        // add_player(77237, 'nikita-kucherov');
        // add_player(8792, 'jonathan-toews');
        // add_player(4407, 'mario-kempe');
        // add_player(9200, 'sasha-pokulok');

        //todo J20 SuperElite, USHS-Prep

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

    // there will be some players with no csv info (drafted before 2005, issues)
    let player_data = _.compact(_.map(context.players, 'csv_info'));
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


