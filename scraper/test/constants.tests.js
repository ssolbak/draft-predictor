'use strict';

const _ = require('lodash');
const should = require('should');
const constants = require('../common/constants');

describe('constants tests', () => {

    describe('ep tests', () => {

        it('should format Miami University', () => {
            let name = constants.sources.ep.get_team_filename('1248','Miami Univ. (Ohio)');
            (name).should.equal('1248___miami-univ-ohio.txt');
        });

        it('should format Luleå HF', () => {
            let name = constants.sources.ep.get_team_filename('7','Luleå HF');
            (name).should.equal('7___lulea-hf.txt');
        });

    });

});
