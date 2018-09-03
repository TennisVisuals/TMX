import { util } from './util';
import { UUID } from './UUID';
import { drawFx } from './drawFx';
import { courtFx } from './courtFx';

export const matchFx = function() {
   let fx = {}
   let dfx = drawFx();

   // Returns NEW objects; modifications don't change originals
   // if 'source' is true, then source object is included...
   fx.tournamentEventMatches = tournamentEventMatches;
   function tournamentEventMatches({ tournament, source }) {
      if (!tournament.events) return { completed_matches: [], pending_matches: [], upcoming_matches: [], total_matches: 0 };

      let total_matches = 0;
      var completed_matches = [];
      var pending_matches = [];
      var upcoming_matches = [];

      // don't sort tournament.events ... sort map of tournament draw types
      function drawTypeSort(draw_type) { return ['R', 'Q'].indexOf(draw_type) >= 0 ? 0 : 1; }
      var ordered_events = tournament.events
         .map((e, index) => ({ draw_type: e.draw_type, index }))
         .sort((a, b) => drawTypeSort(a.draw_type) - drawTypeSort(b.draw_type));

      ordered_events.forEach(oe => {
         let e = tournament.events[oe.index];
         if (e.draw_type == 'R') dfx.roundRobinRounds(e.draw);
         let { complete, incomplete, upcoming } = eventMatchStorageObjects(tournament, e, source);

         if (e.draw_type == 'R') {
            complete.sort((a, b) => a.round_name && b.round_name && a.round_name.localeCompare(b.round_name));
            incomplete.sort((a, b) => a.round_name && b.round_name && a.round_name.localeCompare(b.round_name));
            upcoming.sort((a, b) => a.round_name && b.round_name && a.round_name.localeCompare(b.round_name));
         }
         completed_matches = completed_matches.concat(...complete);
         pending_matches = pending_matches.concat(...incomplete);
         upcoming_matches = upcoming_matches.concat(...upcoming);
      });

      total_matches = completed_matches.length + pending_matches.length;

      return { completed_matches, pending_matches, upcoming_matches, total_matches }
   }

   function eventMatchStorageObjects(tournament, evt, source) {
      if (!evt.draw) return { complete: [], incomplete: [], upcoming: [] };

      let event_matches = eventMatches(evt, tournament);

      // for Round Robin Draw to be considered qualification it needs to be linked to an Elimination Draw
      let draw_format = evt.draw.brackets ? 'round_robin' : 'tree';
      if (draw_format == 'round_robin' && (!evt.links || !evt.links['E'])) {
         event_matches.forEach(match => { if (match.round_name) match.round_name = match.round_name.replace('Q', '') });
      }

      let complete = event_matches
         .filter(f => f.match && f.match.winner && f.match.loser)
         .map(m => matchStorageObject(tournament, evt, m, source))
         .filter(f=>f);

      complete.forEach(match => match.outcome = matchOutcome(match));

      let incomplete = event_matches.filter(f => f.match && (!f.match.winner && !f.match.loser))
         .map(m=>matchStorageObject(tournament, evt, m, source));

      let upcoming = upcomingEventMatches(evt, tournament).map(m=>matchStorageObject(tournament, evt, m, source)).filter(f=>f) || [];
      db.addDev({upcoming});
      console.log('upcoming:', upcoming);

      return { complete, incomplete, upcoming }
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
      } else {
         players = [];
         team_players = [];
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
         puids: players.filter(p=>p).map(p=>p.puid),

         // TODO: should be => teams: team_players,
         // see dynamicDraws => function recreateDrawFromMatches => round_matches.forEach
         teams: match.teams,
         team_players,

         dependent: match.dependent,
         dependencies: match.dependencies,

         // potential opponents for upcoming matches
         potentials: match.potentials,

         result_order: match.result_order,
         round: match.round || match.match.round,
         round_name: match.round_name || match.match.round_name,
         calculated_round_name: match.calculated_round_name,

         score: match.match.score,
         status: match.match.status,
         tournament: {
            name: tournament.name,
            tuid: tournament.tuid,
            sid: tournament.sid,
            org: tournament.org,
            start: tournament.start,
            end: tournament.end,
            rank: tournament.rank,
         },
         'event': {
            name: e.name,
            rank: e.rank,
            euid: e.euid,
            surface: e.surface,
            category: e.category,
            draw_type: e.draw_type,
            custom_category: e.custom_category,
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

   fx.scheduledMatches = scheduledMatches;
   function scheduledMatches(tournament) {
      let { completed_matches, pending_matches, upcoming_matches } = tournamentEventMatches({ tournament, source: true });
      let all_matches = completed_matches.concat(...pending_matches, ...upcoming_matches);
      let scheduled = all_matches.filter(m=>m.schedule && m.schedule.day);
      let days = util.unique(scheduled.map(m=>m.schedule.day));
      return { scheduled, days };
   }

   fx.upcomingEventMatches = upcomingEventMatches;
   function upcomingEventMatches(e, tournament) {
      if (!e.draw) return [];
      if (fx.isTeam(tournament)) return [];
      let round_names = roundNames(tournament, e);
      let matches = dfx.upcomingMatches(e.draw, round_names.names, round_names.calculated_names);
      return checkScheduledMatches(e, tournament, matches);
   }

   fx.dualMatchMatches = (e, muid) => {
      if (!e.draw) return [];
      if (!e.draw.dual_matches) return [];
      if (!e.draw.dual_matches[muid]) return [];
      return e.draw.dual_matches[muid].matches || [];
   }

   fx.eventMatches = eventMatches;
   function eventMatches(e, tournament) {
      if (!e.draw) { return []; }
      if (fx.isTeam(tournament)) {
         let matches = [];
         Object.keys(e.draw.dual_matches || {}).forEach(key => {
            matches = matches.concat(...e.draw.dual_matches[key].matches || []);
         });
         return matches;
      } else {
         let round_names = roundNames(tournament, e);
         let matches = dfx.matches(e.draw, round_names.names, round_names.calculated_names);
         return checkScheduledMatches(e, tournament, matches);
      }
   }

   // NOTE: This function is duplicated but didn't want to introduce circular
   // dependence with tournamentFx... many of these functions should probably
   // be moved to tournamentFx
   function findEventByID(tournament, id) {
      if (!tournament || !tournament.events || tournament.events.length < 1) return;
      return tournament.events.reduce((p, c) => c.euid == id ? c : p, undefined);
   }

   fx.roundNames = roundNames;
   function roundNames(tournament, e) {
      var names = [];
      var calculated_names = [];
      if (['E', 'C', 'S'].indexOf(e.draw_type) >= 0) {
         if (e.structure == 'feed') {
            names = ['F', 'SF', 'QF'];
            let depth = dfx.drawInfo(e.draw).depth;
            if (depth > 3) {
               let rounds = util.numArr(depth -3).map(d=>`R${d+1}`).reverse();
               names = names.concat(...rounds);
            }
         } else {
            names = ['F', 'SF', 'QF', 'R16', 'R32', 'R64', 'R128', 'R256'];
         }
      }
      if (['Q'].indexOf(e.draw_type) >= 0) {
         names = ['Q', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5'];
         let qlink = findEventByID(tournament, e.links['E']);
         if (qlink && qlink.draw) {
            let info = dfx.drawInfo(qlink.draw);
            if (info) calculated_names = ['F', 'SF', 'QF', 'R16', 'R32', 'R64', 'R128', 'R256', 'R512', 'R1024'].slice(info.depth);
         }
      }
      if (['P'].indexOf(e.draw_type) >= 0) {
         names = ['PO3'];
      }
      return { names, calculated_names };
   }

   fx.checkScheduledMatches = checkScheduledMatches;
   function checkScheduledMatches(e, tournament, matches) {
      // in case there are matches without...
      // TODO: This may no longer be necessary...
      addMUIDs(e);

      let court_names = {};
      let max_matches_per_court = 14; // TODO: this setting is in config.env()
      if (!tournament.locations) tournament.locations = [];
      tournament.locations
         .map(l=>l.luid)
         .forEach(luid => courtFx.courtData(tournament, luid, max_matches_per_court).forEach(ct => court_names[courtFx.ctuuid(ct)] = ct.name));

      matches.forEach(match => {
         let schedule = match.match && match.match.schedule;
         if (schedule) {
            schedule.court = court_names[courtFx.ctuuid(schedule)];
            if (schedule && schedule.oop_round && schedule.luid) {
               let court_matches = matches
                  .filter(m => m.match && m.match.schedule && courtFx.ctuuid(m.match.schedule) == courtFx.ctuuid(schedule))
                  .filter(m => m.match.schedule.oop_round < schedule.oop_round && m.match.winner == undefined);
               schedule.after = court_matches.length;
            }
         }
      });

      return matches || [];
   }

   fx.getLuckyLosers = (tournament, evnt, all_rounds) => {
      let completed_matches = fx.eventMatches(evnt, tournament).filter(m=>m.match.winner);
      if (!all_rounds && evnt.draw_type == 'Q') completed_matches = completed_matches.filter(m=>m.match.round_name == 'Q');
      let all_loser_ids = [].concat(...completed_matches.map(match => match.match.loser.map(team=>team.id)));
      let losing_players = tournament.players.filter(p=>all_loser_ids.indexOf(p.id) >= 0);
      return losing_players;
   }

   fx.addMUIDs = addMUIDs;
   function addMUIDs(e) {
      if (!e.draw) return;
      let current_draw = e.draw.compass ? e.draw[e.draw.compass] : e.draw;
      if (!current_draw) return;
      if (e.draw.compass && !current_draw.matches) current_draw.matches = {};

      if (e.draw.compass) {
         dfx.compassInfo(e.draw).all_matches.forEach(addMUID); 
         dfx.drawInfo(current_draw).nodes.forEach(node => { 
            if (node.data && node.data.match && node.data.match.muid) current_draw.matches[node.data.match.muid] = true;
         });
      } else if (e.draw.brackets) {
         e.draw.brackets.forEach(bracket => bracket.matches.forEach(match => { if (!match.muid) match.muid = UUID.new(); }));
      } else {
         let info = dfx.drawInfo(current_draw);
         if (info && info.nodes) info.nodes.forEach(addMUID);
      }

      function addMUID(node) {
         if (node.children && !dfx.byeNode(node)) {
            if (!node.data.match) node.data.match = {};
            if (!node.data.match.muid) node.data.match.muid = UUID.new();
            if (!node.data.match.euid) node.data.match.euid = e.euid;
         }
      }
   }

   fx.isTeam = (t) => { return ['team', 'dual'].indexOf(t.type) >= 0; }

   return fx;
}();

