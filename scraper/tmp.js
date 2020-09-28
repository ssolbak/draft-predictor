const _ = require("lodash");
const async = require("async");
const download_data = require('./download_data');

async.series([
    (cb) => {
        download_data([2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015], { skip_leagues : true }, cb);
    }
], (err) => {

    if (err) {
        console.log("ERROR:", err);
        return process.exit(1);
    }

    console.log("Done");
    return process.exit(0);

});