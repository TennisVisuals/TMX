import { util } from './util';
import { UUID } from './UUID';
import { dateFx } from './dateFx';
import { exportCSV } from './exportCSV';
import { matchObject as umo } from './matchObject';

export const sandBox = function() {
   let fx = {};
   let surfaces = ['C', 'H', 'G', 'H', 'C'];
   let categories = ['U12', 'U14', 'U16', 'U18', 'Adult', 'Senior'];

   util.addDev({umo});
   util.addDev({exportCSV});

   fx.shuffle = (a) => {
       for (let i = a.length - 1; i > 0; i--) {
           const j = Math.floor(Math.random() * (i + 1));
           [a[i], a[j]] = [a[j], a[i]];
       }
       return a;
   };

   /*
    * returns a string of length num filled with 0/1 which have been randomly generated given a bias
    */
   fx.pointString = ({ num=300, bias=.5 } = {}) => util.numArr(num).map(()=>fx.biasedBinary(bias)).join('');

   /*
    * returns 0/1 given a bias, where .5 is balanced and less than or greater
    * than .5 tilts the result towards 0 or 1
    */
   fx.biasedBinary = (bias=.5) => Math.random() > bias ? 1 : 0;
  
   /*
    * generates a match result (score) and winner_index (0/1)
    * tolerance is deviation from .5 which is random distribution
    * randomBias generates a bias within the +/- deviation from .5 as defined by tolerance
    */
   fx.matchResult = ({ tolerance=.3 } = {}) => {

      if (tolerance > 1 || tolerance < 0) tolerance = .5;
      let randomBias = (t) => (.5 - t) + ((t * 2) * Math.random());

      let match = umo.Match();

      // randomly decide whether to change bias mid-match
      if (util.randomInt(2)) {
         match.addPoints(fx.pointString({ bias: randomBias(tolerance), num: 100 }));
         match.addPoints(fx.pointString({ bias: randomBias(tolerance), num: 100 }));
      } else {
         match.addPoints(fx.pointString({ bias: randomBias(tolerance), num: 200 }));
      }

      if (match.winner() == undefined) match.addPoints(fx.pointString({bias: randomBias(tolerance), num: 200 }));
      let score = match.scoreboard().split(',').join('');
      let set_scores = match.score().components.sets.map(s => {
         return [
            { games: s.games && s.games[0], tiebreak: s.tiebreak && s.tiebreak[0], supertiebreak: s.supertiebreak && s.supertiebreak[0] },
            { games: s.games && s.games[1], tiebreak: s.tiebreak && s.tiebreak[1], supertiebreak: s.supertiebreak && s.supertiebreak[1] }
         ];
      });

      return { score, set_scores, winner_index: match.winner() };
   };

   fx.randomPlayers = ({ num=128 }={}) => util.numArr(num).map(() => ({ puid: UUID.generate() }));
   fx.randomTournaments = ({ num=200 }={}) => util.numArr(num).map(() => ({ tuid: UUID.generate() }));

   fx.generateMatch = ({ tournament, players, tolerance, format='S' }={}) => {
      if (!players || !Array.isArray(players) || !players.length) return;
      players = players.filter(p=>typeof p == 'object' && p.puid);
      let num = format == 'D' ? 4 : 2;
      if (players.length < num) return;

      let date_range = tournament && tournament.start && tournament.end && dateFx.dateRange(tournament.start, tournament.end).map(d=>d.getTime());
      let match_date = date_range && util.randomPop(date_range);

      let match = {
         muid: UUID.generate(),
         start: match_date,
         end: match_date,
         event: {
            surface: tournament && tournament.surface,
            category: tournament && tournament.category
         },
         tournament: {
            tuid: tournament && tournament.tuid,
            name: tournament && tournament.name,
            inout: tournament && tournament.inout,
            start: tournament && tournament.start,
            end: tournament && tournament.end
         }
      };
      let uuids = [];
      match.players = util.numArr(num).map(() => {
         let uuid;
         let player;
         let error;
         while (uuids.indexOf(uuid) < 0 && !error) {
            player = players[util.randomInt(players.length)];
            uuid = player && player.uuid;
            if (!uuid) error = true;
         }
         return player;
      });
      let indices = Object.keys(match.players).map(k=>+k);
      match.team_players = [indices.slice(0, num/2), indices.slice(num/2)];

      Object.assign(match, fx.matchResult({ tolerance }));
      return match;
   };

   fx.generateTournamentMatches = ({ tournament, players, draw_size=32, format, tolerance }={}) => {
      players = players || fx.randomPlayers(draw_size);
      if (!draw_size || ['string', 'number'].indexOf(typeof draw_size) < 0 || draw_size < 2) return;
      return util.numArr(draw_size - 1).map(() => fx.generateMatch({ tournament, players, tolerance, format }));
   };

   fx.generateCalendar = ({year=new Date().getFullYear(), num_players=500, num_tournaments=200}={}) => {
      let tournaments = fx.randomTournaments({num: num_tournaments});
      let players = fx.randomPlayers({num: num_players});
      tournaments.forEach((t, i) => {
         let start = dateFx.dateFromDay(year, util.randomInt(365) + 1);
         let end = start + util.randomInt(8);
         t.start = dateFx.timeUTC(new Date(start));
         t.end = dateFx.timeUTC(new Date(end));
         t.name = `Random Tournament #${i+1}`;
         t.inout = util.randomInt(2) ? 'i' : 'o';
         t.surface = surfaces[util.randomInt(surfaces.length)];
         t.category = categories[util.randomInt(categories.length)];
      });
      return tournaments.map(tournament => fx.generateTournamentMatches({tournament, players}));
   };

   return fx;
}();
