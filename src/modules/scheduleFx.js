import { env } from './env'
import { util } from './util';
import { drawFx } from './drawFx';
import { lang } from './translator';
import { matchFx } from './matchFx';
import { displayFx } from './displayFx';
import { calendarFx } from './calendarFx';
import { tournamentFx } from './tournamentFx';

export const scheduleFx = function() {

   let fx = {};
   let mfx = matchFx;
   let dfx = drawFx();

   fx.fx = {};

   fx.generateSchedule = (tournament, date_filter) => {
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

      if (!days_matches.length) return;

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
            courts[key].matches = courts[key].matches
               .sort((a, b) => a.schedule.oop_round > b.schedule.oop_round)
               .map(matchScheduleObject);
         });
         return courts;
      }

      function matchScheduleObject(match) {
         let mso = {
            event: match.event,
            format: match.format,
            gender: match.gender,
            muid: match.muid,
            players: match.players,
            puids: match.puids,
            teams: match.teams,
            team_players: match.team_players,
            round_name: match.round_name,
            potentials: match.potentials,
            schedule: match.schedule,
            score: match.score,
            status: match.status,
            umpire: match.umpire,
            winner_index: match.winner_index
         }
         return mso;
      }

      function getOOP() {
         let tournamentOOP = {
            title: lang.tr('phrases.oop_system'),
            notice: tournament.schedule.notice,
            // options: fx.fx.env && fx.fx.env().schedule,
            options: env.schedule,
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

   fx.schedulingIssues = (matches) => {
      let puid_analysis = {};
      let issues = {
         conflicts: [],
         warnings: []
      };

      matches.forEach(match => {
         let potential_puids = !match.potentials || !match.potentials.length
            ? []
            : [].concat(...match.potentials.map(p=>[].concat(...(!p ? [] : p.map(t=>!t ? [] : t.map(p=>p.puid))) )));
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

   fx.scheduleGrid = ({ element, schedule_day, scheduled, courts=[], oop_rounds=[], editable, options }) => {
      function ctuuid(schedule) { return schedule ? `${schedule.luid}|${schedule.index}` : ''; }
      courts = [].concat(...courts, Array(Math.max(0, 10 - courts.length)).fill(''));
      function activeScheduled(match, court) { return match.schedule.day == schedule_day && ctuuid(match.schedule) == ctuuid(court); }
      function inActiveScheduled(match, court) {
         return match.schedule.day == schedule_day && ctuuid(match.schedule) == ctuuid(court);
      }
      let columns = courts.map(court => {
         let header = `<div class='court_header'>${court.name || ''}</div>`;
         // let court_matches = scheduled.filter(m => m.schedule && ctuuid(m.schedule) == ctuuid(court));
         let court_matches = scheduled.filter(m => activeScheduled(m, court));
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

      // let displaydocs = editable && fx.fx.env().documentation ? 'flex' : 'none';
      let displaydocs = editable && env.documentation ? 'flex' : 'none';
      let html = `
         <div class='schedule_scroll_container'>
            <div class='schedule_grid'>
               <div class='schedule_slots'>
                  <div class='oop_round_header'>
                     <div class='doclink' url='tmx_tournament_schedule'><div class='tiny_docs_icon' style='display: ${displaydocs}'></div></div>
                  </div>
                  ${oop_round}
               </div>
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
      let abandoned = match.score && (match.score.indexOf('Cancelled') == 0 || match.score.indexOf('INC') >= 0);
      let conflict = match.scheduling == 'conflict';
      let timepressure = match.scheduling == 'timepressure';
      let statuscolor = conflict ? 'conflict' : abandoned ? 'abandoned' : timepressure ? 'warning' : inprogress ? 'inprogress' : complete ? 'complete' : 'neutral';
      let droptarget = court ? `ondragover="event.preventDefault();"` : '';
      let dragdrop = ' dragdrop';
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
      let divider = lang.tr('schedule.vs');

      let first_team = complete && winner_index == 0 ? `<b>${teams[0]}</b>` : (teams[0] || unknownBlock(0));
      let second_team = complete && winner_index == 1 ? `<b>${teams[1]}</b>` : (teams[1] || unknownBlock(1));
      let format = lang.tr(`formats.${match.format || ''}`);

      let score = match.score || '';
      // let reverse_scores = (options && !options.scores_in_draw_order) || (fx.fx.env && fx.fx.env().schedule && !fx.fx.env().schedule.scores_in_draw_order);
      let reverse_scores = (options && !options.scores_in_draw_order) || (env.schedule && !env.schedule.scores_in_draw_order);
      if (score && winner_index && reverse_scores) score = dfx.reverseScore(score);

      let match_status = match.status ? `<div class='match_status'>${match.status}</div>` : '&nbsp;';
      let category = (match.event && match.event.category) || '';
      let displayed_score = score ? `<div class='match_score${complete ? ' complete' : ''}'>${score}</div>` : match_status;
      let status_message = (match.status && match.score && !match.umpire) ? match.status : '';
      let umpire = match.umpire ? `<div class='match_umpire'>${match.umpire}</div>` : status_message;
      let heading = match.schedule.heading ? `${match.schedule.heading} ` : '';
      let time_icon = match.schedule.start || match.schedule.end ?
         `${match.schedule.start || ''}&nbsp;<div class='time_header tiny_icon'></div>&nbsp;${match.schedule.end || ''}`: '';
      let time_prefix = match.schedule.time_prefix ? `${match.schedule.time_prefix} ` : '';
      let header = time_icon || `${heading}${time_prefix}${match.schedule.time || '&nbsp;'}`;
      let font_sizes = ['1em', '1em'];
      let round_name = match.round_name || '';
      let category_row = `
         <div class='catround'>
            <div class='category'>${match.gender || ''} ${category}</div>
            <div class='format'>${format}</div>
            <div class='round'>${round_name}</div>
         </div>
      `;
      if (match.event && match.event.custom_category) category_row = `
         <div class='catround'>
            <div class='category'>${match.event.custom_category}</div>
            <div class='round'>${round_name}</div>
         </div>
      `;
      if (match.consolation) round_name = `C-${round_name}`;
      let html = `
         <div class='header flexrow'>${header}</div> 
         ${category_row}
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
            return team
               .map(t => !match.players[t] ? lang.tr('opnt') : match.players[t].last_name.toUpperCase())
               .join('/');
         }
      }

      function potentialBlock(p) {
         let last_name = p.last_name ? util.normalizeName(p.last_name, false).toUpperCase() : p.qualifier ? lang.tr('qualifier') : lang.tr('unk');
         return `<div puid='${p.puid}' class='player_click cell_player potential'>${last_name}</div>`;
      }

      function unknownBlock(pindex) {
         if (!match.potentials) return '';
         let index = match.potentials[pindex] ? pindex : 0;
         let potentials = match.potentials[index];
         if (!potentials || potentials.filter(f=>f).length < 2) return unknown();
         let blocks = potentials
            .map(p=>stack(!p ? [unknown()] : p.map(potentialBlock)))
            .join(`<div class='potential_separator flexcenter'><span>${lang.tr('or')}</span></div>`);
         return `<div class='flexrow'>${blocks}</div>`;

         function stack(potential_team) { return `<div class='flexcol'>${potential_team.join('')}</div>`; }
         function unknown() { return `<div class='potential'>${lang.tr('unk')}</div>`; }
      }
   }

   fx.opponentSearch = () => `<input class='opponentsearch' style='width: 100%; display: none' placeholder='${lang.tr("schedule.opponentname")}...'>`;

   fx.emptyOOPround = (editable) => {
      if (!editable) return '';
      let html = `
         <div class='scheduled_teams findmatch' style='width: 100%;'>
            ${fx.opponentSearch()}
         </div>
      `;
      return html;
   }

   fx.sortedUnscheduled = sortedUnscheduled;
   function sortedUnscheduled(tournament, unscheduled_matches, order_priority) {
      let priority = ['F', 'SF', 'QF', 'R16', 'R32', 'R64', 'R96', 'R128', 'RR', 'Q', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5'];
      if (!order_priority) { unscheduled_matches.sort((a, b) => priority.indexOf(b.round_name) - priority.indexOf(a.round_name)); }

      // create an array of match muids;
      var group_muids = unscheduled_matches.map(m=>m.muid);

      // create ordered list of group matches for each event
      // based on round robin oop or tree draw positions
      var euids = util.unique(unscheduled_matches.map(m=>m.event.euid));
      var ordered_muids = Object.assign({}, ...euids.map(id => {
         let evnt = tournamentFx.findEventByID(tournament, id);
         let match_order = null;
         if (evnt.draw_type == 'R') {
            // compute order of play for round robin
            let rrr = dfx.roundRobinRounds(evnt.draw);
            // transform into ordered list of muids
            match_order = [].concat(...rrr.map(roundMatchupMUIDs));
            function roundMatchupMUIDs(rrround) { return [].concat(...rrround.map(m=>m.matchups.map(u=>u.muid))); }
         } else {
            // get an ordered list of muids based on draw positions
            if (evnt.draw.compass) {
               let directions = ['east', 'west', 'north', 'south', 'northeast', 'northwest', 'southeast', 'southwest'];
               match_order = [].concat(...directions.filter(d=>evnt.draw[d]).map(d=>dfx.treeDrawMatchOrder(evnt.draw[d])));
            } else {
               match_order = dfx.treeDrawMatchOrder(evnt.draw);
            }
         }

         // filter out any matches that have been scheduled
         match_order = match_order.filter(m=>group_muids.indexOf(m) >= 0);
         return { [id]: match_order }; 
      }));

      // create an object indexed by muid of unscheduled matches
      var muid_lookup = Object.assign({}, ...unscheduled_matches.map(m=>({[m.muid]: m})));

      // When prioritizing draw order w/o regard for round, exclude round_name
      // create a hash of unscheduled matches which have been sorted/grouped by round_name
      var unscheduled_hash = unscheduled_matches.map(m=>`${m.event.euid}|${!order_priority ? m.round_name : ''}`);

      var match_groups = util.unique(unscheduled_hash);
      if (order_priority) { match_groups.sort((a, b)=> drawTypeSort(a) - drawTypeSort(b)); }

      function drawTypeSort(match_group) {
         let euid = match_group.split('|')[0];
         let draw_type = tournamentFx.findEventByID(tournament, euid).draw_type;
         return ['R', 'Q'].indexOf(draw_type) >= 0 ? 0 : 1;
      }

      var ordered_matches = [].concat(...match_groups.map(match_group => {
         // find the start of each group, and the number of members
         let indices = util.indices(match_group, unscheduled_hash);

         // get an array of all muids in this group
         let group_muids = indices.map(i=>unscheduled_matches[i].muid);
         let [group_euid, round_name] = match_group.split('|');

         // use the group muids to filter the ordered_muids
         let ordered_group = ordered_muids[group_euid]
            .filter(muid => group_muids.indexOf(muid) >= 0)
            .map(muid => muid_lookup[muid]);

         // return an ordered group
         return ordered_group;
      }));

      var om_muids = ordered_matches.map(o=>o.muid);
      var upcoming_unscheduled = group_muids.filter(m=>om_muids.indexOf(m) < 0);

      // upcoming unscheduled *should* be sorted by round name and not scheduled by order
      var uu_matches = upcoming_unscheduled.map(muid => muid_lookup[muid]);
      uu_matches.sort((a, b) => priority.indexOf(b.round_name) - priority.indexOf(a.round_name));

      var to_be_scheduled = ordered_matches.concat(...uu_matches);

      return to_be_scheduled;
   }

   return fx;
}();

