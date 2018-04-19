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
         event_matches.forEach(match => { if (match.round_name) match.round_name = match.round_name.replace('Q', '') });
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
         // round: match.round_name,
         round_name: match.round_name,
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
      let round_names = roundNames(tournament, e);
      let matches = dfx.upcomingMatches(e.draw, round_names.names, round_names.calculated_names);
      return checkScheduledMatches(e, tournament, matches);
   }

   fx.eventMatches = eventMatches;
   function eventMatches(e, tournament) {
      if (!e.draw) return [];
      let round_names = roundNames(tournament, e);
      let matches = dfx.matches(e.draw, round_names.names, round_names.calculated_names);
      return checkScheduledMatches(e, tournament, matches);
   }

   // NOTE: This function is duplicated but didn't want to introduce circular
   // dependence with tournamentFx... many of these functions should probably
   // be moved to tournamentFx
   function findEventByID(tournament, id) {
      if (!tournament || !tournament.events || tournament.events.length < 1) return;
      return tournament.events.reduce((p, c) => c.euid == id ? c : p, undefined);
   }

   function roundNames(tournament, e) {
      var names = [];
      var calculated_names = [];
      if (['E', 'C'].indexOf(e.draw_type) >= 0) {
         names = ['F', 'SF', 'QF', 'R16', 'R32', 'R64', 'R128', 'R256'];
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
      addMUIDs(e);

      let court_names = {};
      if (!tournament.locations) tournament.locations = [];
      tournament.locations.map(l=>l.luid).forEach(luid => courtFx.courtData(tournament, luid).forEach(ct => court_names[courtFx.ctuuid(ct)] = ct.name));

      matches.forEach(match => {
         let schedule = match.match && match.match.schedule;
         if (schedule) {
            schedule.court = court_names[courtFx.ctuuid(schedule)];
            if (schedule && schedule.oop_round && schedule.luid) {
               let court_matches = matches
                  .filter(m => m.match.schedule && courtFx.ctuuid(m.match.schedule) == courtFx.ctuuid(schedule))
                  .filter(m => m.match.schedule.oop_round < schedule.oop_round && m.match.winner == undefined);
               schedule.after = court_matches.length;
            }
         }
      });

      return matches;
   }

   function addMUIDs(e) {
      if (!e.draw) return;

      if (e.draw.brackets) {
         e.draw.brackets.forEach(bracket => bracket.matches.forEach(match => {
            if (!match.muid) match.muid = UUID.new();
         }));
      } else {
         dfx.drawInfo(e.draw).nodes.forEach(node => { 
            // if (dfx.matchNode(node) && !dfx.byeTeams(node)) {
            if (node.children && !dfx.byeTeams(node)) {
               if (!node.data.match) node.data.match = {};
               if (!node.data.match.muid) node.data.match.muid = UUID.new();
            }
         });
      }
   }

   return fx;
}();

