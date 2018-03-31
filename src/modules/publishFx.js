import { coms } from './coms';

export const publishFx = function() {
   let fx = {};

   fx.broadcastEvent = ({ tourny, evt, draw_type_name, options }) => {
      let ebo = eventBroadcastObject(tourny, evt, draw_type_name, options);
      let eventCircular = CircularJSON.stringify(ebo);
      coms.emitTmx({ eventCircular });
   }

   function eventBroadcastObject(tourny, evt, draw_type_name, options) {
      return { 
         tournament: {
            name: tourny.name,
            tuid: tourny.tuid,
            org: tourny.org,
            start: tourny.start,
            end: tourny.end,
            categories: tourny.categories
         },
         event: {
            euid: evt.euid,
            name: evt.name,
            rank: evt.rank,
            inout: evt.inout,
            links: evt.links,
            gender: evt.gender,
            format: evt.format,
            active: evt.active,
            scoring: evt.scoring,
            surface: evt.surface,
            approved: evt.approved,
            category: evt.category,
            automated: evt.automated,
            published: new Date().getTime(),
            wildcards: evt.wildcards,
            draw_size: evt.draw_size,
            draw_type: evt.draw_type,
            draw_type_name,
            qualified: evt.qualified,
            qualifiers: evt.qualifiers,
            score_format: evt.score_format,
            lucky_losers: evt.lucky_losers,
         },
         draw: evt.draw,
         options
      }
   }

   return fx;
}();
