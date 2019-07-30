"use strict";

exports.pad = (num, digits) => {
    return num.toString().padStart(digits, "0");
};

exports.getTeamFileFor = (team_id, team_name) => {

    let team_key = team_name.toLowerCase()
        .replace(/ /g, "_")
        .replace(/[,.']+/g,"");

    return `${team_id}___${team_key}.txt`;

};