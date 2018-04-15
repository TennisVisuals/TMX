import { util } from './util';
import { drawFx } from './drawFx';
import { lang } from './translator';
import { matchFx } from './matchFx';
import { displayFx } from './displayFx';
import { calendarFx } from './calendarFx';

export const scheduleFx = function() {

   let fx = {};
   let mfx = matchFx;
   let dfx = drawFx();

   fx.fx = {
      env: () => console.log('environment fx'),
   }

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
         console.log('tournamentOOP:', tournamentOOP)
         return tournamentOOP;
      }
   }

   fx.schedulingIssues = (matches) => {
      let puid_analysis = {};
      let issues = {
         conflicts: [],
         warnings: []
      };

      matches.forEach(match => {
         let potential_puids = !match.potentials ? [] : [].concat(...match.potentials.map(p=>[].concat(...p.map(t=>t.map(p=>p.puid)))));
         let puids = match.puids.concat(potential_puids).filter(f=>f);
         puids.forEach(puid => {
            if (!puid_analysis[puid]) puid_analysis[puid] = { matches: [] };
            puid_analysis[puid].matches.push({ muid: match.muid, schedule: match.schedule });
         });
      });

      Object.keys(puid_analysis).forEach(puid => {
         let analysis = puid_analysis[puid];
         let rounds = analysis.matches.map(m=>m.schedule.oop_round).sort();
         analysis.rounds = rounds;
         let gaps = rounds.slice(0, -1).map((r, i) => rounds[i+1] ? { gap: rounds[i+1] - r, round: rounds[i+1] } : undefined).filter(f=>f);
         let conflicts = gaps.filter(gap => gap.gap == 0);
         let warnings = gaps.filter(gap => gap.gap == 1);
         if (conflicts.length) {
            analysis.conflicts = conflicts.map(gap => findMUIDs(gap.round));
            issues.conflicts = issues.conflicts.concat(...analysis.conflicts);
         }
         if (warnings.length) {
            analysis.warnings = warnings.map(gap => findMUIDs(gap.round));
            issues.warnings = issues.warnings.concat(...analysis.warnings);
         }

         function findMUIDs(round) { return analysis.matches.filter(m=>m.schedule.oop_round == round).map(m=>m.muid); }
      });

      return issues;
   }

   fx.colorCell = (elem, muid, cls) => {
      let cell = Array.from(elem.querySelectorAll('.schedule_box')).reduce((p, c) => c.getAttribute('muid') == muid ? c : p, undefined);
      if (cell) {
         let class_root = cell.className.split(' ').slice(0, -1).join(' ');
         cell.className = `${class_root} ${cls}`;
      }
   }

   fx.scheduleGrid = ({ element, scheduled, courts=[], oop_rounds=[], editable, options }) => {
      function ctuuid(schedule) { return schedule ? `${schedule.luid}|${schedule.index}` : ''; }
      courts = [].concat(...courts, Array(Math.max(0, 10 - courts.length)).fill(''));
      let columns = courts.map(court => {
         let header = `<div class='court_header'>${court.name || ''}</div>`;
         let court_matches = scheduled.filter(m => m.schedule && ctuuid(m.schedule) == ctuuid(court));
         let court_times = [];
         court_matches.forEach(match => {
            if (match.schedule && match.schedule.oop_round) { court_times[match.schedule.oop_round] = match; }
         });
         let boxes = oop_rounds.map(oop_round => {
            if (court_times[oop_round]) {
               return fx.scheduleBox({
                  match: court_times[oop_round],
                  luid: court.luid,
                  index: court.index,
                  court: court.name,
                  oop_round,
                  editable,
                  options
               });
            } else {
               return fx.scheduleBox({
                  luid: court.luid,
                  index: court.index,
                  court: court.name,
                  oop_round,
                  editable,
                  options
               });
            }
         });
         let boxes_html = boxes.map(b=>b.html).join('');
         return `<div class='court_schedule'> ${header}${boxes_html} </div> `;
      });

      let oop_round = oop_rounds.map(slot => {
         let html = `
            <div class='oop_round' oop_round='${slot}'>
               ${slot}
            </div>
         `;
         return html;
      }).join('');

      let html = `
         <div class='schedule_scroll_contaienr'>
            <div class='schedule_grid'>
               <div class='schedule_slots'><div class='oop_round_header'></div>${oop_round}</div>
               <div class='tournament_schedule'> ${columns.join('')}</div>
            </div>
         </div>
         `;

      element.innerHTML = html;
      fx.scaleTeams(element);
   }

   fx.scaleTeams = (container) => {
      let scheduled_teams = container.querySelectorAll('.scheduled_team');
      Array.from(scheduled_teams).forEach(el => util.scaleFont(el));
   }

   fx.scheduleBox = ({ match={}, luid, index, court, oop_round, editable, options } = {}) => {
      let ids = { scorebox: displayFx.uuid(), }
      let empty = !Object.keys(match).length;
      let offgrid = empty && !court;
      let complete = match.winner_index != undefined;
      let inprogress = match.status == 'inprogress' || (match.score && match.winner_index == undefined);
      let conflict = match.scheduling == 'conflict';
      let timepressure = match.scheduling == 'timepressure';
      let statuscolor = conflict ? 'conflict' : timepressure ? 'warning' : inprogress ? 'inprogress' : complete ? 'complete' : 'neutral';
      let droptarget = `ondragover="event.preventDefault();"`;
      let dragdrop = ' dragdrop';
      // let draggable = editable && !complete && !offgrid && !empty ? ` draggable="true"` : '';
      let draggable = editable && !offgrid && !empty ? ` draggable="true"` : '';
      let content = offgrid ? '' : !empty ? scheduledMatchHTML(match, options) : fx.emptyOOPround(editable);

      if (Object.keys(match).length && match.schedule) {
         if (!luid && match.schedule.luid) luid = match.schedule.luid;
         if (!index && match.schedule.index) index = match.schedule.index;
         if (!court && match.schedule.court) court = match.schedule.court;
         if (!oop_round && match.schedule.oop_round) oop_round = match.schedule.oop_round;
      }

      let html = `
         <div id='${ids.scorebox}' 
            muid='${match.muid || ''}' 
            luid='${luid}'
            index='${index}'
            court='${court}' 
            oop_round='${oop_round}' 
            class='sb schedule_box${dragdrop} ${statuscolor}' 
            ${draggable}${droptarget}> ${content}
         </div>
      `;
      return { ids, html, innerHTML: content };
   }

   function scheduledMatchHTML(match, options={}) {
      let winner_index = match.winner_index;
      let complete = winner_index != undefined;

      let teams = !match.team_players ? [] : match.team_players.map(teamName);
      let divider = 'vs.';

      let first_team = complete && winner_index == 0 ? `<b>${teams[0]}</b>` : (teams[0] || unknownBlock(0));
      let second_team = complete && winner_index == 1 ? `<b>${teams[1]}</b>` : (teams[1] || unknownBlock(1));
      let format = lang.tr(`formats.${match.format || ''}`);

      let score = match.score || '';
      if (score && winner_index && fx.fx.env().schedule.scores_in_draw_order) score = dfx.reverseScore(score);

      let match_status = match.status ? `<div class='match_status'>${match.status}</div>` : '&nbsp;';
      let category = match.event ? match.event.category : '';
      let displayed_score = score ? `<div class='match_score${complete ? ' complete' : ''}'>${score}</div>` : match_status;
      let status_message = (match.status && match.score && !match.umpire) ? match.status : '';
      let umpire = match.umpire ? `<div class='match_umpire'>${match.umpire}</div>` : status_message;
      let heading = match.schedule.heading ? `${match.schedule.heading} ` : '';
      let time_icon = match.schedule.start || match.schedule.end ?
         `${match.schedule.start || ''}&nbsp;<div class='time_header tiny_icon'></div>&nbsp;${match.schedule.end || ''}`: '';
      let time_prefix = match.schedule.time_prefix ? `${match.schedule.time_prefix} ` : '';
      let header = time_icon || `${heading}${time_prefix}${match.schedule.time || ''}`;
      let font_sizes = ['1em', '1em'];
      let html = `
         <div class='header flexrow'>${header}</div> 
         <div class='catround'>
            <div class='category'>${match.gender || ''} ${category}</div>
            <div class='format'>${format}</div>
            <div class='round'>${match.round_name || ''}</div>
         </div>
         <div class='scheduled_teams'>
            <div class='scheduled_team' style='font-size: ${font_sizes[0]}'>${first_team || ''}</div>
            <div class='divider'>${first_team || second_team ? divider : ''}</div>
            <div class='scheduled_team' style='font-size: ${font_sizes[1]}'>${second_team || ''}</div>
            ${displayed_score}${umpire}
         </div>
      `;
      return html;

      function teamName(team) {
         if (team.length == 1) {
            var p = match.players[team[0]];
            if (!p.puid) return potentialBlock(p);
            var club = options.clubs && p.club_code ? ` (${p.club_code})` : '';
            var ioc = options.ioc_codes && p.ioc ? ` {${p.ioc}}` : '';
            return `${p.full_name}${club || ioc}`;
         } else {
            return team.map(p=>match.players[p].last_name.toUpperCase()).join('/');
         }
      }

      function potentialBlock(p) {
         let last_name = p.last_name ? util.normalizeName(p.last_name, false).toUpperCase() : p.qualifier ? lang.tr('qualifier') : '';
         return `<div puid='${p.puid}' class='player_click cell_player potential'>${last_name}</div>`;
      }

      function unknownBlock(pindex) {
         if (!match.potentials) return '';
         let index = match.potentials[pindex] ? pindex : 0;
         let potentials = match.potentials[index];
         let blocks = potentials.map(p=>stack(p.map(potentialBlock))).join(`<div class='potential_separator flexcenter'><span>${lang.tr('or')}</span></div>`);
         return `<div class='flexrow'>${blocks}</div>`;

         function stack(potential_team) { return `<div class='flexcol'>${potential_team.join('')}</div>`; }
      }
   }

   fx.opponentSearch = () => `<input class='opponentsearch' style='width: 100%; display: none' placeholder='Opponent Name...'>`;

   fx.emptyOOPround = (editable) => {
      if (!editable) return '';
      let html = `
         <div class='scheduled_teams findmatch' style='width: 100%;'>
            ${fx.opponentSearch()}
         </div>
      `;
      return html;
   }

   return fx;
}();

