'use strict';

module.exports = {
    numeric: (x) => parseInt(x),
    text: (x) => x,
    year_start: (x) => parseInt(x.substr(0, 4)),
    year_end: (x) => parseInt(x.substr(0, 4))+1,
    team_name : (x) => {
        const teams = {
            ana : 'Anaheim Ducks',
            ari : 'Arizona Coyotes',
            atl : 'Atlanta Thrashers', // folded
            bos: 'Boston Bruins',
            buf: 'Buffalo Sabres',
            car: 'Carolina Hurricanes',
            cbj: 'Columbus Blue Jackets',
            cgy: 'Calgary Flames',
            chi: 'Chicago Blackhawks',
            col: 'Colorado Avalanche',
            cal: 'Calgary Flames',
            dal: 'Dallas Stars',
            det: 'Detroit Red Wings',
            edm: 'Edmonton Oilers',
            fla: 'Florida Panthers',
            lak : 'Los Angeles Kings',
            min : 'Minnesota Wild',
            mon : 'Montreal Canadians',
            mtl : 'Montreal Canadians',
            njd : 'New Jersey Devils',
            nsh : 'Nashville Predators',
            nyi : 'New York Islanders',
            nyr : 'New York Rangers',
            ott : 'Ottawa Senators',
            phi : 'Philadelphia Flyers',
            phx : 'Arizona Coyotes',
            pit : 'Pittsburgh Penguins',
            sjs : 'San Jose Sharks',
            stl : 'St Louis Blues',
            tbl : 'Tampa Bay Lightning',
            tor : 'Toronto Maple Leafs',
            van : 'Vancouver Canucks',
            veg : 'Vegas Golden Knights',
            wpg : 'Winnipeg Jets',
            wsh : 'Washington Capitals',
        };
        return teams[x.toLowerCase()];
    }
};