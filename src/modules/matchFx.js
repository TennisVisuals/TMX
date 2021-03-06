import { env } from './env'
import { util } from './util';
import { UUID } from './UUID';
import { drawFx } from './drawFx';
import { courtFx } from './courtFx';
import { scoreBoard } from './scoreBoard';

export const matchFx = function() {
   let fx = {}
   let dfx = drawFx();

   fx.getScoringFormat = ({ e, match, format }) => {
      let scoreboard = env.scoreboard.settings;
      format = format || (match && match.format) || (e.format == 'D' ? 'doubles' : 'singles');
      let score_format = (e.scoring_format && e.scoring_format[format]) || e.score_format || (match && match.score_format) || scoreboard[format];
      if (score_format.final_set_supertiebreak == undefined) score_format.final_set_supertiebreak = format == 'doubles' ? true : false;
      return score_format;
   }

   fx.getExistingScores = ({ match }) => {
      if (!match.score) return undefined;
      let es = scoreBoard.convertStringScore({ string_score: match.score, score_format: match.score_format || {}, winner_index: match.winner_index });
      return es;
   }

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
         .map(m => matchStorageObject({ tournament, e: evt, match: m, source }))
         .filter(f=>f);

      let incomplete = event_matches
         .filter(f => f.match && (!f.match.winner && !f.match.loser))
         .map(m => matchStorageObject({ tournament, e: evt, match: m, source }))
         .filter(m => (m.players && m.players.length) || (m.potentials && m.potentials.length));

      let upcoming = upcomingEventMatches(evt, tournament).map(m=>matchStorageObject({ tournament, e: evt, match: m, source })).filter(f=>f) || [];

      return { complete, incomplete, upcoming }
   }

   function matchStorageObject({ tournament, e, match, source }) {
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
         team_players = match.teams.map((t, i) => !t ? [null] : t.map((m, j) => (i*t.length) + j));
      } else {
         players = [];
         team_players = [];
      }

      let coords;
      let schedule = match.match.schedule;
      if (schedule && schedule.luid && tournament.locations) {
         let loc = tournament.locations.reduce((p, c) => c.luid == schedule.luid ? c : p, undefined);
         if (loc) coords = { latitude: loc.latitude, longitude: loc.longitude }
      }

      let score_format = match.match.score_format || {};

      let obj = {
         consolation: e.draw_type == 'C', 
         draw_positions: e.draw_size,
         date: match.match.date,
         schedule,
         location: coords,
         format: match.format == 'doubles' || e.format == 'D' ? 'doubles' : 'singles',
         gender: e.gender,
         muid: match.match.muid,
         puids: players.filter(p=>p).map(p=>p.puid),


         // TODO: These need object copy
         players,
         teams: match.teams,
         set_scores: match.match.set_scores,

         // TODO: should be => teams: team_players,
         team_players,

         dependent: match.dependent,
         dependencies: match.dependencies,

         // potential opponents for upcoming matches
         potentials: match.potentials,

         result_order: match.result_order,
         round: match.round || match.match.round,
         round_name: match.round_name || match.match.round_name,
         calculated_round_name: match.calculated_round_name,

         // all score related details should be stored in an object...
         score: match.match.score,

         score_format: {
            final_set_supertiebreak: score_format.final_set_supertiebreak,
            final_set_tiebreak: score_format.final_set_tiebreak,
            games_for_set: score_format.games_for_set,
            max_sets: score_format.max_sets,
            sets_to_win: score_format.sets_to_win,
            supertiebreak_to: score_format.supertiebreak_to,
            tiebreak_to: score_format.tiebreak_to,
            tiebreaks_at: score_format.tiebreaks_at,
         },
         delegated_score: match.match.delegated_score,

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
         dual_match: match.dual_match,
         sequence: match.sequence,
         umpire: match.match.umpire,

         // TODO: can this be removed?
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
            let dual_matches = e.draw.dual_matches[key].matches || [];
            dual_matches.forEach(dm => dm.dual_match = key);
            matches = matches.concat(...dual_matches);
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
         e.draw.brackets.forEach(bracket => bracket.matches.forEach(match => {
            if (!match.muid) match.muid = UUID.new();
            match.euid = e.euid;
         }));
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

   // LEGACY... from parsed matches...
   // takes a list of matches creates a list of players and events they played/are playing
   fx.matchPlayers = matchPlayers;
   function matchPlayers(matches) {
      if (!matches) return [];
      addMatchDraw(matches);

      let players = [].concat(...matches.map(match => {
         let gender = rankCalc.determineGender(match);
         // add player sex if doesn't exist already
         match.players.forEach(player => player.sex = player.sex || gender);
         return match.players;
      }));

      // make a list of all events in which a player is participating
      let player_events = {};
      matches.forEach(match => {
         match.puids.forEach(puid => { 
            if (!player_events[puid]) player_events[puid] = []; 
            let format = match.format == 'doubles' ? 'd' : 's';
            player_events[puid].push(`${format}_${match.draw || 'M'}`);
         })
      });

      let hashes = [];
      let uplayers = players
         .map(player => {
            let hash = `${player.hash}${player.puid}`;
            if (hashes.indexOf(hash) < 0) {
               hashes.push(hash);
               return player;
            }
         })
         .filter(f=>f)
         .sort((a, b) => {
            let a1 = util.replaceDiacritics(a.full_name);
            let b1 = util.replaceDiacritics(b.full_name);
            return a1 < b1 ? -1 : a1 > b1 ? 1 : 0
         });

      uplayers.forEach(player => {
         // add player events to player objects
         if (player_events[player.puid]) player.events = unique(player_events[player.puid]).join(', ');
      });

      return uplayers;

      function addMatchDraw(matches) {
         // TODO: .round needs to be replaced with .round_name
         matches.forEach(match => { 
            if (!match.gender) match.gender = rankCalc.determineGender(match); 
            if (match.consolation) match.draw = 'C';
            if (match.round && match.round.indexOf('Q') == 0 && match.round.indexOf('QF') < 0) match.draw = 'Q';

            // TODO: RR is not always Q... if there is only one bracket...
            if (match.round && match.round.indexOf('RR') == 0) match.draw = 'Q';
         });
      }

   }

   fx.isTeam = (t) => { return ['team', 'dual'].indexOf(t.type) >= 0; }

   return fx;
}();

