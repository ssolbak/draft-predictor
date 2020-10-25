"use strict";

const _ = require("lodash");
const async = require("async");
const fs = require("fs");
const path = require("path");
const constants = require("../common/constants");
const utils = require("../common/utils");

const EpDownloader = require('../downloaders/ep_downloader');
const ep = new EpDownloader();

module.exports = (years, options, done) => {

    if(typeof options === 'function') {
        done = options;
        options = {};
    }

    let state = { players: []};
    //options.force = true;

    async.series([
        (cb) => {
            if(options.skip_leagues) return cb();
            ep.downloadLeagues({
                years,
                leagues : _.keys(constants.leagues)
            }, options, cb)
        },
        (cb) => {
            async.eachSeries(years, (year, cb) => {
                ep.download_draft(year, (err, players) => {
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
            ep.download(state.players, cb);
        }
    ], done);

};

