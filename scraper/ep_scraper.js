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
node app.js -y 2007 > ~/scraper-log.txt &

 */

const _ = require("lodash");
const async = require("async");

const argv = require('yargs')
    .usage('Usage: $0 [options]')
    .hide('version')
    .option('year', {alias: 'y', type: 'number', describe: 'year to run for'})
    .option('all', {alias: 'a', type: 'boolean', default: true, describe: 'all includes the league info'})
    // .check((argv) => {
    //     if (argv.collection || argv.group) return true;
    //     throw(new Error("Must provide one of Collection or Group"));
    // })
    .help()
    .argv;

const start_year = 2005;
const end_year = 2005;

let import_options = { all: argv.all, skip_leagues: true };
let years = [];

if (argv.year) {
    import_options.all = false;
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
        require('./scrapers/ep')(years, import_options, cb);
    }
], (err) => {

    if (err) {
        console.log("ERROR:", err);
        return process.exit(1);
    }

    console.log("Done");
    return process.exit(0);

});