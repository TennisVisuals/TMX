!function() {

   var elo = { 
      default_rating: 1500,
      nSpread:        400,    // determines the 'spread' of the scale
      kCalc:          k538,   // use calculation defined by FiveThirtyEight.com
      kMultiplier:    kSet    // change to kDefault for value of 1
   };

   // assumes matches are in chronological order
   // tennisabstract matches can be sorted : matches.sort(elo.getSortMethod('+date', '+num'));
   elo.processMatches = function(players, matches) {
      // makes it possible for player object to use other attributes, i.e. uid,
      // where name may be unreliable (misspellings & etc.)
      if (typeof players != 'object' || matches.constructor !== Array) return;

      matches.filter(m=>m.format == 'singles').forEach((match, i) => {

         let w = match.players[match.teams[match.winner][0]];
         let l = match.players[match.teams[1 - match.winner][0]];
         let winner = w.puid || w.hash;
         let loser = l.puid || l.hash;

         if (!players[winner]) players[winner] = { rating: [], matches: 0 };
         if (!players[loser])  players[loser] = { rating: [], matches: 0 };
         players[winner].matches += 1;
         players[loser].matches  += 1;

         match.elo = {
            winner: { before: lastElement(players[winner].rating) },
            loser: { before: lastElement(players[loser].rating) }
         }

         elo.updatePlayers(players, winner, loser, match.date, match.score, match.level, i);

         match.elo.winner.after = lastElement(players[winner].rating);
         match.elo.loser.after = lastElement(players[loser].rating);
      });
   };

   elo.updatePlayers = function(players, winner, loser, match_date, score, level, reference) {
      if (!winner || !loser || !players[winner] || !players[loser]) return;

      // ---- if loser rating > elo.default_rating and winner rating is undefined
      // assign loser rating to winner before calculating new rating...
      var w_rating = lastElement(players[winner].rating);
      var l_rating = lastElement(players[loser].rating);

      if (!w_rating) {
         w_rating = (l_rating && l_rating.value > elo.default_rating) ? l_rating.value : elo.default_rating;
      } else {
         w_rating = w_rating.value;
      }

      l_rating = l_rating ? l_rating.value : elo.default_rating;

      var calc = elo.newRating(w_rating, players[winner].matches, l_rating, players[loser].matches, score, level);

      var w_result = { value: calc.winner, date: match_date, opponent: loser, outcome: 'won' };
      var l_result = { value: calc.loser,  date: match_date, opponent: winner, outcome: 'lost' };

      if (score) {
         w_result.score = score;
         l_result.score = reverseScore(score);
      }

      if (reference != undefined) {
         w_result.ref = reference;
         l_result.ref = reference;
      }

      players[winner].rating.push(w_result);
      players[loser].rating.push(l_result);
   }

   elo.sortedPlayers = function(player_ratings, players) {
      var list = Object.keys(player_ratings).map(key => {
         if (!player_ratings[key].rating.length) return {};
         return { key: key, rating: lastElement(player_ratings[key].rating).value, player: players[key], history: player_ratings[key] };
      });
      list.sort(elo.getSortMethod('+rating'));
      return list;
   }

   reverseScore = function(score) {
      return score.split(',').map(m=>{ var t = m.split('('); var s = t[0].split('-').reverse().join('-'); if (t.length > 1) s = s + '(' + t[1]; return s }).join(',');
   }

   lastElement = function(arr) { 
      if (!arr || !arr.length) return undefined;
      return arr[arr.length - 1]; 
   }

   elo.expect = function(player_rating, opponent_rating) { return 1 / (1 + Math.pow(10, ((opponent_rating - player_rating) / elo.nSpread))); }

   elo.newRating = function(w_rating, w_matches, l_rating, l_matches, score, level) {
      var w_expect = elo.expect(w_rating, l_rating);
      var l_expect = elo.expect(l_rating, w_rating);
      var w_kValue = elo.kCalc(w_matches);
      var l_kValue = elo.kCalc(l_matches);
      var k = elo.kMultiplier(level, score);
      var w_new_rating = w_rating + (k * w_kValue) * (1 - w_expect);
      var l_new_rating = l_rating + (k * l_kValue) * (0 - l_expect);
      return { winner: w_new_rating, loser: l_new_rating };
   }

   // see footnote #3 here:
   // http://fivethirtyeight.com/features/serena-williams-and-the-difference-between-all-time-great-and-greatest-of-all-time/
   function k538(matches) { return 250 / Math.pow(matches + 5, .4); }

   function kDefault() { return 1; }

   // win multipier is scaled by % sets won
   // https://www.stat.berkeley.edu/~aldous/157/Old_Projects/huang.pdf
   // level "G" indicates grand slam and best-of-five sets baseline...
   // TODO: kSet should be explicitly tied to match format, "best-of"
   function kSet(level, score) {
      if (!score) return kDefault();
      return level == "G" ? (3 / score.split(' ').length) : (2 / score.split(' ').length);
   }

   elo.getSortMethod = getSortMethod;
   function getSortMethod(){
      var _args = Array.prototype.slice.call(arguments);
      return function(a, b){
         for(var x in _args){
            var ax = a[_args[x].substring(1)];
            var bx = b[_args[x].substring(1)];
            var cx;

            ax = typeof ax == "string" ? ax.toLowerCase() : ax / 1;
            bx = typeof bx == "string" ? bx.toLowerCase() : bx / 1;

            if (_args[x].substring(0, 1) == "-") { cx = ax; ax = bx; bx = cx; }
            if (ax != bx) { return ax < bx ? -1 : 1; }
         }
      }
   }

   if (typeof define === "function" && define.amd) define(elo); else if (typeof module === "object" && module.exports) module.exports = elo;
   this.elo = elo;
 
}();
