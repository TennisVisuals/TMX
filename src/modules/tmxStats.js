import { db } from './db'
import { util } from './util';
import { drawFx } from './drawFx';
import { lang } from './translator';
import { matchFx } from './matchFx';

export const tmxStats = function() {

   let fx = {};

   fx.processMatches = (tournament) => {
      let { completed_matches, pending_matches, upcoming_matches, total_matches } = matchFx.tournamentEventMatches({ tournament });
      console.log('matches:', completed_matches);
   }

   return fx;

}();

