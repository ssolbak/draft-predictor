'use strict';

/*

sudo yum install git -y

git config --global core.editor "nano"
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.34.0/install.sh | bash
. ~/.nvm/nvm.sh
nvm install 10.19.0
git clone https://github.com/ssolbak/draft-predictor.git
cd draft-predictor/scraper
npm install
node app.js > ~/scraper-log.txt &

players only for a year
node scraper.js -y 2007 > ~/scraper-log.txt &

 */

const _ = require("lodash");
const async = require("async");

const argv = require('yargs')
    .usage('Usage: $0 [options]')
    .hide('version')
    .option('scraper', {alias: 's', type: 'text', default: 'ep', describe: 'site to scrape'})
    .option('year', {alias: 'y', type: 'number', describe: 'year to run for'})
    .help()
    .argv;

const start_year = 2003;
const end_year = 2020;
const import_options = { skip_leagues: false };

let years = [];
if (argv.year) {
    years = [argv.year];
} else {
    for (var i = start_year; i <= end_year; i++) {
        years.push(i);
    }
}

console.log("years", years);
console.log("options", JSON.stringify(import_options, null, 2));

process.on('uncaughtException', (err) => {
   console.log("Error:", err);
   setTimeout(() => {
       return process.exit(1);
   }, 10);
});

async.series([
    (cb) => {
        require('./scrapers/' + argv.scraper)(years, import_options, cb);
    }
], (err) => {
    if (err) {
        console.log("ERROR:", err);
        return process.exit(1);
    }
    console.log("Done");
    return process.exit(0);
});
