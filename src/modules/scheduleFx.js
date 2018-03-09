import { util } from './util';
import { lang } from './translator';
import { matchFx } from './matchFx';
import { calendarFx } from './calendarFx';

export const scheduleFx = function() {

   let fx = {};
   let mfx = matchFx;

   fx.generateSchedule = (tournament) => {
      if (!tournament.schedule) tournament.schedule = {};

      var date_range = util.dateRange(tournament.start, tournament.end);
      var date_options = date_range.map(d => ({ key: calendarFx.localizeDate(d), value: util.formatDate(d) }));

      var scheduled = mfx.scheduledMatches(tournament).scheduled;
      if (!scheduled.length) return;

      var days_matches = date_options.map(date => {
         let courts = courtMatches(scheduled.filter(m => m.schedule.day == date.value));
         return {
            date: date.value,
            datestring: date.key,
            courts
         }
      }).filter(d => Object.keys(d.courts).length);

      return getOOP();

      function courtMatches(mz) {
         let courts = {};
         mz.forEach(m => {
            let hash = `${m.schedule.luid}|${m.schedule.index}`;
            if (courts[hash]) {
               courts[hash].matches.push(m);
            } else {
               courts[hash] = { name: m.schedule.court, matches: [m] };
            }
         });
         Object.keys(courts).forEach(key => {
            courts[key].matches = courts[key].matches.sort((a, b) => a.schedule.oop_round > b.schedule.oop_round);
         });
         return courts;
      }

      function getOOP() {
         tournament.schedule.published = new Date().getTime();
         tournament.schedule.up_to_date = true;

         let tournamentOOP = {
            title: lang.tr('phrases.oop_system'),
            umpirenotes: tournament.schedule.umpirenotes,
            days_matches,
            published: {
               published: lang.tr('phrases.schedulepublished'),
               datestring: calendarFx.localizeDate(new Date(tournament.schedule.published), {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  hour12: false,
                  minute: '2-digit'
               })
            },
            tournament: {
               tuid: tournament.tuid,
               name: tournament.name,
               organization: tournament.organization,
               start: tournament.start,
               end: tournament.start,
               org: tournament.org,
            },
            lang: {
               singles: lang.tr('formats.singles'),
               doubles: lang.tr('formats.doubles'),
               or: lang.tr('or')
            }
         }
         return tournamentOOP;
      }
   }

   return fx;
}();

