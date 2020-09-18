'use strict';

const BASE_FOLDER = "_href_raw";

const _ = require('lodash');
const async = require('async');
const FileDownloader = require('./file_downloader');
const downloader = new FileDownloader({
    host: 'www.hockey-reference.com',
    scrape_delay_in_seconds: 2,
    bot_delay_in_seconds: 2
});

class HbdDownloader {

    download_draft(year, done) {

        console.log("href downloading draft", year);

        let url = `https://www.hockey-reference.com/draft/NHL_${year}_entry.html`;
        downloader.download(url, { folder: `${BASE_FOLDER}/drafts`, name: `${year}.txt` }, (err, download) => {

            if(err) return cb(err);

            console.log("\nhref downloading players for draft year", year);

            let players = [];
            let content = download.content;

            //for some dumb reason I cant use RegEx constructor... need to figure out why later...
            let matches;
            while(matches = /data-stat="player"[\s]*>([^<]*)<a href="(\/players\/[a-z]\/[a-z0-9]+)\.html"\>([^<]+)<\/a>/g.exec(content)) {

                if(!matches || matches.length < 3) {
                    return done(`Incomplete match in year ${year} ${matches}`);
                }

                let url = `https://www.hockey-reference.com${matches[2]}.html`;
                let player_id = matches[2].replace("/players", "").substr(3);
                let player_name = matches[3];
                let player_key = matches[2].replace("/players", "").substr(1);

                console.log("adding player", player_id, player_name, player_key);
                players.push({ url, player_id, player_name, player_key, year });

                content = content.substring(content.indexOf(matches[0]) + matches[0].length);
            }

            players = _.uniqBy(players, "player_id");

            setTimeout(() => done(null, players), 1);

        });

    }

    download(players, done) {

        console.log(`href downloading ${players.length} players`);
        async.eachSeries(players, (player, cb) => {

            let options = {
                folder: `${BASE_FOLDER}/players`,
                name: `${player.player_id}.txt`
            };

            downloader.download(player.url, options, (err) => {
                if(err) {
                    console.log("Error downloading player", player, err);
                    return cb(err);
                }
                return cb();
            });

        }, done);

    }

}

module.exports = HbdDownloader;