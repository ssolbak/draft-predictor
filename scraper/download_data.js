"use strict";

const _ = require("lodash");
const async = require("async");
const fs = require("fs");
const path = require("path");
const constants = require("./constants");
const utils = require("./utils");

const HrefDownloader = require('./href_downloader');
const href = new HrefDownloader();

const HbdDownloader = require('./hbd_downloader');
const hbd = new HbdDownloader();

module.exports = (years, options, done) => {

    if(typeof options === 'function') {
        done = options;
        options = {};
    }

    let state = { players: []};

    async.series([
        (cb) => {
            hbd.downloadLeagues({years}, cb)
        },
        (cb) => {
            async.eachSeries(years, (year, cb) => {
                href.download_draft(year, (err, players) => {
                    if(err) return cb(err);
                    if(!(players && players.length)) {
                        return cb(`${year} could not find any players in the draft!!`);
                    }
                    console.log(`${players.length} number of players for ${year}`);
                    state.players = state.players.concat(players);
                    return cb();
                });
            }, (err) => {
                if(err) return cb(err);
                state.players = _.uniqBy(state.players,'player_id');
                return cb();
            })
        },
        (cb) => {
            href.download(state.players, cb);
        }
    ], done);

};

