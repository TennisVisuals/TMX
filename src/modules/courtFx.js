import { util } from './util';

export const courtFx = function() {
   let fx = {};

   fx.courtData = (tournament, luid, max_matches_per_court=14) => {
      let courts = [];
      tournament.locations.forEach(l => {
         let identifiers = l.identifiers ? l.identifiers.split(',').join(' ').split(' ').filter(f=>f) : [];
         if (!luid || luid == l.luid) { 
            util.range(1, +l.courts + 1).forEach(index => {
               let identifier = identifiers[index - 1] || index;
               let court = { 
                  luid: l.luid,
                  name: `${l.abbreviation} ${identifier}`,
                  availability: util.range(1, max_matches_per_court + 1),
                  index
               };
               courts.push(court);
            });
         }
      });
      return courts;
   }

   fx.ctuuid = (schedule) => { return schedule ? `${schedule.luid}|${schedule.index}` : ''; }

   return fx;

}();
