const _ = require("lodash");
const async = require("async");
const download_data = require('./download_data');

const start_year = 2005;
const end_year = 2015;

let years = [];
for(var i=start_year; i <= end_year; i++){
    years.push(i);
}

console.log("YEARS", years);

async.series([
    (cb) => {
        download_data(years, cb);
    }
], (err) => {

    if(err) {
        console.log("ERROR:", err);
        return process.exit(1);
    }

    console.log("Done");
    return process.exit(0);

});