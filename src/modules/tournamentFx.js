import { util } from './util';
import { UUID } from './UUID';
import { lang } from './translator';
import { displayFx } from './displayFx';

export function tournamentFx({tournament={}, org, opts}={}) {

   let fx = {};
   let dfx = drawFx();

   fx.findEventByID = (id) => {
      if (!tournament || !tournament.events || tournament.events.length < 1) return;
      // return tournament.events.reduce((p, c) => c.euid == id ? c : p, undefined);
      let matching_events = tournament.events.filter(f=>f.euid == id);
      return matching_events.length ? matching_events[0] : undefined;
   }

   fx.scoreRoundRobin = (e, existing_scores, outcome) => {
      if (!outcome) return;

      var qlink = e.draw_type == 'R' && findEventByID(e.links['E']);
      var qlinkinfo = qlink && qlink.draw && dfx.drawInfo(qlink.draw);
      var puids = outcome.teams.map(t=>t[0].puid);
      var findMatch = (e, n) => (util.intersection(n.match.puids, puids).length == 2) ? n : e;

      var match_event = eventMatches(e, tournament).reduce(findMatch, undefined);

      var previous_winner = match_event.match.winner ? match_event.match.winner.map(m=>m.id) : undefined;
      var current_winner = outcome.winner != undefined ? outcome.teams[outcome.winner].map(m=>m.id) : undefined;
      var qualifier_changed = !previous_winner ? undefined : util.intersection(previous_winner, current_winner).length == 0;

      var draw_previously_complete = dfx.drawInfo(e.draw).complete;
      var bracket = e.draw.brackets[match_event.match.bracket];
      var bracket_complete = dfx.bracketComplete(bracket);
      var outcome_change = qualifier_changed || (previous_winner && !current_winner);

      if (qlink && bracket_complete && outcome_change) {
         if (allBracketsComplete(e) && qlink.active) return displayFx.popUpMessage(lang.tr('phrases.cannotchangewinner'));

         let remove_players = removeQualifiedRRplayers(displayed_draw_event, bracket);
         if (!remove_players) return displayFx.popUpMessage(lang.tr('phrases.cannotchangewinner'));
      }

      if (match_event) {
         let match = match_event.match;
         match.score = outcome.score;
         if (outcome.score) match.status = '';
         match.winner_index = outcome.winner;
         match.score_format = outcome.score_format;

         match.muid = match.muid || UUID.new();
         match.winner = [match.players[outcome.winner]];
         match.loser = [match.players[1 - outcome.winner]];
         match.date = match.date || new Date().getTime();

         match.teams = outcome.teams;

         match.tournament = {
            name: tournament.name,
            tuid: tournament.tuid,
            org: config.env().org,
            category: tournament.category,
            round: match.round_name || match.round
         };

         e.up_to_date = false;
         if (coms.broadcasting()) {
            if (config.env().livescore) {
               e.up_to_date = true;
               coms.broadcastScore(match);
            }
            if (config.env().publishing.publish_on_score_entry) broadcastEvent(tournament, displayed_draw_event);
         }
         if (!coms.broadcasting() || !config.env().publishing.publish_on_score_entry) updateScheduleStatus({ muid: match.muid });
         displayFx.drawBroadcastState(container.publish_state.element, displayed_draw_event);

      } else {
         console.log('something went wrong', outcome);
      }

      dfx.tallyBracketResults({ bracket });
      if (outcome.complete && dfx.bracketComplete(bracket)) determineRRqualifiers(e);

      e.active = true;
      // enableDrawActions();
      // saveTournament(tournament);
      return true;
   }

   fx.generateSchedule = () => {
      if (!tournament.schedule) tournament.schedule = {};

      var date_range = util.dateRange(tournament.start, tournament.end);
      var date_options = date_range.map(d => ({ key: localizeDate(d), value: util.formatDate(d) }));

      var scheduled = scheduledMatches().scheduled;
      // if (!scheduled.length) return unPublishOOP();

      // check whether there are published events
      var published_events = tournament.events.reduce((p, c) => c.published || p, false);
      if (!published_events) {
         scheduled
            .reduce((p, c) => util.isMember(p, c.event.euid) ? p : p.concat(c.event.euid), [])
            .forEach(euid => {
               let evt = findEventByID(euid);
               broadcastEvent(tournament, evt)
               displayFx.drawBroadcastState(container.publish_state.element, evt);
            });
      }

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
         // schedulePublishState();

         let tournamentOOP = {
            title: lang.tr('phrases.oop_system'),
            umpirenotes: tournament.schedule.umpirenotes,
            days_matches,
            published: {
               published: lang.tr('phrases.schedulepublished'),
               datestring: localizeDate(new Date(tournament.schedule.published), {
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
               org: tournament.org || org,
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

   fx.scheduledMatches = scheduledMatches;
   function scheduledMatches() {
      let { completed_matches, pending_matches, upcoming_matches } = tournamentEventMatches({ tournament, source: true });
      let all_matches = completed_matches.concat(...pending_matches, ...upcoming_matches);
      let scheduled = all_matches.filter(m=>m.schedule && m.schedule.day);
      let days = util.unique(scheduled.map(m=>m.schedule.day));
      return { scheduled, days };
   }

   // Returns NEW objects; modifications don't change originals
   // if 'source' is true, then source object is included...
   function tournamentEventMatches({ tournament, source }) {
      if (!tournament.events) return { completed_matches: [], pending_matches: [], upcoming_matches: [], total_matches: 0 };

      var completed_matches = [];
      var pending_matches = [];
      var upcoming_matches = [];

      function drawTypeSort(draw_type) { return ['R', 'Q'].indexOf(draw_type) >= 0 ? 0 : 1; }
      var ordered_events = tournament.events.sort((a, b) => drawTypeSort(a.draw_type) - drawTypeSort(b.draw_type));

      ordered_events.forEach(e => {
         let { complete, incomplete, upcoming } = eventMatchStorageObjects(tournament, e, source);

         completed_matches = completed_matches.concat(...complete);
         pending_matches = pending_matches.concat(...incomplete);
         upcoming_matches = upcoming_matches.concat(...upcoming);
      });

      let total_matches = completed_matches.length + pending_matches.length;

      return { completed_matches, pending_matches, upcoming_matches, total_matches }
   }

   function eventMatchStorageObjects(tournament, evt, source) {
      if (!evt.draw) return { complete: [], incomplete: [], upcoming: [] };

      let event_matches = eventMatches(evt, tournament);

      // for Round Robin Draw to be considered qualification it needs to be linked to an Elimination Draw
      let draw_format = evt.draw.brackets ? 'round_robin' : 'tree';
      if (draw_format == 'round_robin' && (!evt.links || !evt.links['E'])) {
         event_matches.forEach(match => match.round_name = match.round_name.replace('Q', ''));
      }

      let complete = event_matches
         .filter(f => f.match.winner && f.match.loser)
         .map(m => matchStorageObject(tournament, evt, m, source))
         .filter(f=>f);

      complete.forEach(match => match.outcome = matchOutcome(match));

      let incomplete = event_matches.filter(f => !f.match.winner && !f.match.loser)
         .map(m=>matchStorageObject(tournament, evt, m, source));

      let upcoming = upcomingEventMatches(evt, tournament).map(m=>matchStorageObject(tournament, evt, m, source));

      return { complete, incomplete, upcoming }
   }

   function upcomingEventMatches(e, tournament) {
      if (!e.draw) return [];
      let matches = dfx.upcomingMatches(e.draw, roundNames(e));
      return checkScheduledMatches(e, tournament, matches);
   }

   function eventMatches(e, tournament) {
      if (!e.draw) return [];
      let matches = dfx.matches(e.draw, roundNames(e));
      return checkScheduledMatches(e, tournament, matches);
   }

   function roundNames(e) {
      if (['E', 'C'].indexOf(e.draw_type) >= 0) return ['F', 'SF', 'QF', 'R16', 'R32', 'R64', 'R96', 'R128'];
      if (['Q'].indexOf(e.draw_type) >= 0) return ['Q', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5'];
      if (['P'].indexOf(e.draw_type) >= 0) return ['PO3'];
      return [];
   }

   function checkScheduledMatches(e, tournament, matches) {
      // in case there are matches without...
      addMUIDs(e);

      let court_names = {};
      if (!tournament.locations) tournament.locations = [];
      tournament.locations.map(l=>l.luid).forEach(luid => courtData(tournament, luid).forEach(ct => court_names[ctuuid(ct)] = ct.name));

      matches.forEach(match => {
         let schedule = match.match && match.match.schedule;
         if (schedule) {
            schedule.court = court_names[ctuuid(schedule)];
            if (schedule && schedule.oop_round && schedule.luid) {
               let court_matches = matches
                  .filter(m => m.match.schedule && ctuuid(m.match.schedule) == ctuuid(schedule))
                  .filter(m => m.match.schedule.oop_round < schedule.oop_round && m.match.winner == undefined);
               schedule.after = court_matches.length;
            }
         }
      });

      return matches;
   }

   function courtData(tournament, luid) {
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

   function ctuuid(schedule) { return schedule ? `${schedule.luid}|${schedule.index}` : ''; }

   function addMUIDs(e) {
      if (!e.draw) return;

      if (e.draw.brackets) {
         e.draw.brackets.forEach(bracket => bracket.matches.forEach(match => {
            if (!match.muid) match.muid = UUID.new();
         }));
      } else {
         dfx.drawInfo(e.draw).nodes.forEach(node => { 
            if (node.children && !dfx.byeTeams(node)) {
               if (!node.data.match) node.data.match = {};
               if (!node.data.match.muid) node.data.match.muid = UUID.new();
            }
         });
      }
   }

   function localizeDate(date, date_localization) {
      let default_localization = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
      return date.toLocaleDateString(lang.tr('datelocalization'), date_localization || default_localization);
   }

   function matchStorageObject(tournament, e, match, source) {
      if (!match.match) return;

      let players = [];
      let team_players;

      if (match.match.winner && match.match.winner[0]) {
         players = [].concat(...match.teams[0], ...match.teams[1]);
         team_players = [
            match.teams[0].map((p, i) => i),
            match.teams[1].map((p, i) => match.teams[0].length + i)
         ];
      } else if (match.teams) {
         players = [].concat(...match.teams);
         team_players = match.teams.map((t, i) => t.map((m, j) => (i*t.length) + j));
      }

      let obj = {
         consolation: e.draw_type == 'C', 
         draw_positions: e.draw_size,
         date: match.match.date,
         schedule: match.match.schedule,
         format: e.format == 'S' ? 'singles' : 'doubles',
         gender: e.gender,
         muid: match.match.muid,
         players,
         puids: players.map(p=>p.puid),

         // TODO: should be => teams: team_players,
         // see dynamicDraws => function recreateDrawFromMatches => round_matches.forEach
         teams: match.teams,
         team_players,

         dependent: match.dependent,
         dependencies: match.dependencies,

         // potential opponents for upcoming matches
         potentials: match.potentials,

         // TODO: clear up confusion here...
         round: match.round_name,
         round_name: match.round_name,

         score: match.match.score,
         status: match.match.status,
         tournament: {
            name: tournament.name,
            tuid: tournament.tuid,
            sid: tournament.sid,
            org: tournament.org || org,
            start: tournament.start,
            end: tournament.end,
            rank: tournament.rank,
         },
         'event': {
            name: e.name,
            category: e.category,
            draw_type: e.draw_type,
            rank: e.rank,
            surface: e.surface,
            euid: e.euid,
         },
         umpire: match.match.umpire,
         winner: match.match.winner_index,
         winner_index: match.match.winner_index,
      }

      if (source) obj.source = match.match;
      return obj;
   } 

   fx.matchOutcome = matchOutcome;
   function matchOutcome(match, puid) {
      let player_won = null;
      let winning_puids = [];
      let winning_team;
      let losing_team;
      let losing_puids = [];

      // TODO: this is a patch for matches from database
      // .teams needs to be updated to .team_players
      if (!match.team_players) match.team_players = match.teams;

      if (match.winner != undefined) {
         winning_team = match.team_players[match.winner].map(pindex => {
            let player =  match.players[pindex];
            winning_puids.push(player.puid);
            if (player.puid == puid) player_won = true;
            return `${player.full_name}${player.rank ? ' [' + player.rank + ']' : ''}`;
         }).join('; ');

         losing_team = match.team_players[1 - match.winner].map(pindex => {
            let player =  match.players[pindex];
            if (!player) return 'Undefined';
            losing_puids.push(player.puid);
            if (player.puid == puid) player_won = false;
            return `${player.full_name}${player.rank ? ' [' + player.rank + ']' : ''}`;
         }).join('; ');
      }

      return { player_won, winning_team, losing_team, winning_puids, losing_puids };
   }

   return fx;
}

