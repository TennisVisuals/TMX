import { util } from './util';

export const courtFx = function() {
   let fx = {};

   fx.courtData = (tournament, luid) => {
      let courts = [];
      tournament.locations.forEach(l => {
         let identifiers = l.identifiers ? l.identifiers.split(',').join(' ').split(' ').filter(f=>f) : [];
         if (!luid || luid == l.luid) { 
            util.range(1, +l.courts + 1).forEach(index => {
               let identifier = identifiers[index - 1] || index;
               let court = { 
                  luid: l.luid,
                  name: `${l.abbreviation} ${identifier}`,
                  availability: [1,2,3,4,5,6,7,8,9,10],
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
