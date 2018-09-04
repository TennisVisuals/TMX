import { db } from './db';

import { util } from './util';
import { UUID } from './UUID';
import { drawFx } from './drawFx';
import { staging } from './staging';
import { matchFx } from './matchFx';
import { lang } from './translator';
import { playerFx } from './playerFx';

export const tournamentFx = function() {

   let fx = {};
   let mfx = matchFx;
   let dfx = drawFx();

   fx.fx = {
      env: () => console.log('environment fx'),
   }

   fx.settingsLoaded = (env) => { dfx.options(env.drawFx); }

   fx.getScoreboardSettings = ({ format, category }) => {
      let settings = fx.fx.env().scoreboard.settings;
      if (format && category && settings.categories[category] && settings.categories[category][format]) return settings.categories[category][format];
      if (format && settings[format]) return settings[format];
      return settings.singles;
   }

   fx.findEventByID = (tournament, id) => {
      if (!id || !tournament || !tournament.events || tournament.events.length < 1) return;
      return tournament.events.reduce((p, c) => c.euid == id ? c : p, undefined);
   }

   fx.findTeamByID = (tournament, id) => {
      if (!id || !tournament || !tournament.teams || tournament.teams.length < 1) return;
      // return tournament.teams.reduce((p, c) => c.uuid == id ? c : p, undefined);
      return tournament.teams.reduce((p, c) => c.id == id ? c : p, undefined);
   }

   fx.genEventName = (e, pre) => {
      let types = {
         'R': lang.tr('draws.roundrobin'),
         'C': lang.tr('draws.consolation'),
         'Q': lang.tr('draws.qualification'),
         'S': lang.tr('draws.compass'),
         'L': lang.tr('draws.dualmatches'),
         'T': lang.tr('draws.teamtourny'),
         'F': lang.tr('draws.feedin'),
         'P': lang.tr('pyo'),
      }
      let type = pre ? lang.tr('draws.preround'): types[e.draw_type] || lang.tr('draws.maindraw');
      let name = `${e.name}&nbsp;${type}`;
      return { type, name }
   }

   fx.pruneMatch = (match) => {
      delete match.date;
      delete match.winner;
      delete match.winner_index;
      delete match.loser;
      delete match.score;
      delete match.set_scores;
      delete match.teams;
      delete match.complete;
      delete match.round_name;
      delete match.result_order;
      delete match.round;
      delete match.tournament;
   }

   fx.replaceTournamentPlayer = ({ tournament, existing_player, new_player_data, replace_all }) => {
      if (!tournament || !tournament.players) return;
      if (tournament.events && tournament.events.length) tournament.events.forEach(evnt => { replaceEventPlayer(evnt, existing_player, new_player_data); });
      tournament.players.forEach(checkReplacePlayer); // this must occur after all events are updated...
      function checkReplacePlayer(player) {
         if (player.puid == existing_player.puid) {
            if (replace_all) {
               Object.keys(existing_player).forEach(key=> {
                  if (new_player_data[key]) {
                     player[key] = new_player_data[key];
                  } else if (key != 'signed_in') {
                     delete player[key];
                  }
               });
            }
            Object.keys(new_player_data).forEach(key=>player[key]=new_player_data[key]);
         }
      }
   }

   function replaceEventPlayer(evnt, existing_player, new_player_data) {
      if (!evnt.draw) return;
      if (evnt.draw.compass) {
         let directions = ['east', 'west', 'north', 'south', 'northeast', 'northwest', 'southeast', 'southwest'];
         directions.filter(d=>evnt.draw[d]).forEach(d=>dfx.replaceDrawPlayer(evnt.draw[d], existing_player, new_player_data));
      } else {
         dfx.replaceDrawPlayer(evnt.draw, existing_player, new_player_data);
      }

      replaceID(evnt.teams);
      replaceID(evnt.approved);
      replaceID(evnt.wildcards);
      replaceID(evnt.luckylosers);

      function checkReplace(elem) { if (elem == existing_player.id) elem = new_player_data.id; }
      function replaceID(arr) {
         if (!arr) return;
         arr.forEach(elem => { if (Array.isArray(elem)) { elem.forEach(checkReplace); } else { checkReplace(elem); } });
      }
   }

   function playerActiveInLinked(qlinkinfo, plyr) {
      let advanced_positions = qlinkinfo.match_nodes.filter(n=>n.data.match && n.data.match.players);
      let active_player_positions = [].concat(...advanced_positions.map(n=>n.data.match.players.map(p=>p.draw_position)));
      let position_in_linked = [].concat(...qlinkinfo.nodes
         .filter(n => n.data.team && util.intersection(n.data.team.map(t=>t.id), plyr).length)
         .map(n => n.data.dp));
      return util.intersection(active_player_positions, position_in_linked).length;
   }

   function winnerRemoved({ tournament, e, qlink, qlinkinfo, previous_winner, outcome }) {
      if (qlink) {
         qlink.approved = qlink.approved ? qlink.approved.filter(a=>previous_winner.indexOf(a) < 0): [];
         qlink.draw.opponents = qlink.draw.opponents.filter(o=>util.intersection(o.map(m=>m.id), previous_winner).length == 0);
         if (qlinkinfo) {
            qlinkinfo.nodes.forEach(node => {
               if (!node.height && node.data.team && util.intersection(node.data.team.map(t=>t.id), previous_winner).length) {
                  node.data.qualifier = true;
                  node.data.team = node.data.team.map(team => ({ bye: undefined, entry: 'Q', qualifier: true, draw_position: outcome.draw_position }) );
               }
            });
         }
      }

      // must occur after team removed from linked draw approved
      e.qualified = e.qualified ? e.qualified.filter(q=>util.intersection(q.map(m=>m.id), previous_winner).length == 0) : [];
      fx.setDrawSize(tournament, e);

      // must occur after e.qualified is updated
      // approvedChanged(qlink);
      // fx.setDrawSize(tournament, qlink);
      if (qlink) qlink.up_to_date = false;
   }

   function qualifierChanged({ e, outcome, qlink, qlinkinfo, previous_winner, current_winner }) {
      // replace qualifier
      e.qualified = e.qualified.filter(q=>util.intersection(q.map(m=>m.id), previous_winner).length == 0);
      e.qualified.push(outcome.teams[outcome.winner])

      // modify linked draw
      if (qlink) {
         qlink.approved = qlink.approved.filter(a=>previous_winner.indexOf(a) < 0);
         qlink.approved.push(current_winner.join('|'));
         qlink.draw.opponents = qlink.draw.opponents.filter(o=>util.intersection(o.map(m=>m.id), previous_winner).length == 0);
         let new_opponent = outcome.teams[outcome.winner].map(p => Object.assign({}, p, { seed: undefined, entry: 'Q' }));
         qlink.draw.opponents.push(new_opponent);
         if (qlinkinfo) qlinkinfo.nodes.forEach(n => {
            if (!n.height && util.intersection(n.data.team.map(t=>t.id), previous_winner).length) {
               let draw_position = n.data.team[0].draw_position;
               let new_team = new_opponent.map(t => Object.assign({}, t, { draw_position, qualifier: true, entry: 'Q' }));
               n.data.team = new_team;
            }
         });
      }

      fx.logEventChange(e, { fx: 'qualifier changed', d: { team: outcome.teams[outcome.winner].map(t=>t.id) } });
   }

   fx.safeScoreTreeDraw = ({ tournament, e, muid, existing_scores, outcome }) => {
      try { return fx.scoreTreeDraw({ tournament, e, muid, existing_scores, outcome }); }
      catch (err) { 
         console.log('error:', err);
         fx.logEventError(e, err, 'tournamentFx.scoreTreeDraw');
         return {};
      }
   }

   fx.calcDualMatchesScore = (e, dual_match) => {
      let score = [0, 0];
      let match_record = e && e.draw && e.draw.dual_matches && e.draw.dual_matches[dual_match.match.muid];
      match_record && match_record.matches
         .map(m => ({ winner: m.match.winner_index, value: m.value }))
         .filter(f=>f.winner != undefined)
         .forEach(result => score[result.winner] += parseInt(result.value || 1));
      let score_goal = e.score_goal || 5;
      let max_score = Math.max(...score);
      let winner_index = max_score < score_goal ? undefined : (score[0] >= score_goal) ? 0 : 1;
      dual_match.match.score = winner_index ? score.map(s=>s).reverse().join('-') : score.join('-');
      let active_matches = match_record && match_record.matches.reduce((p, c) => c.match.score ? true : p, undefined);
      return { score, active_matches };
   }

   fx.scoreDualMatchDraw = ({ tournament, e, dual_match, dual_teams, muid, outcome }) => {
      var result = { success: true };

      let match = e.draw.dual_matches[dual_match.match.muid].matches.reduce((p, c) => c.match.muid == muid ? c : p, undefined);

      match.match.score = outcome.score
      match.match.score_format = outcome.score_format;
      match.match.winner_index = outcome.winner;
      match.match.winner = outcome.teams[outcome.winner];
      match.match.loser = outcome.teams[1 - outcome.winner];
      match.match.date = match.date || new Date().getTime();

      let { score, active_matches } = fx.calcDualMatchesScore(e, dual_match);
      let score_goal = e.score_goal || 5;

      let max_score = Math.max(...score);
      if (max_score < score_goal && dual_match.match.winner_index != undefined) {
         console.log('if advanced, remove winner');
         // ... as long as there is no advancement beyond this position ...

         delete dual_match.match.winner_index;
         delete dual_match.match.winner;
         delete dual_match.match.loser;
         delete dual_match.match.date;
         delete dual_match.team;
         delete dual_match.dp;
      } else if (max_score >= score_goal) {
         let winner_index = (score[0] >= score_goal) ? 0 : 1;
         let winner = dual_teams[winner_index];
         if (dual_match.match.winner_index != winner_index) {
            dfx.advancePosition({ node: e.draw, position: winner.draw_position });
         }
      }

      e.active = active_matches;

      return result;
   }

   fx.scoreTreeDraw = ({ tournament, e, muid, existing_scores, outcome }) => {
      var result = {};
      if (!outcome) return result;

      let linked_info = null;
      let current_direction;
      let current_draw = e.draw;
      let target_draw = null;
      let active_in_linked = null;
      let compass = e.draw && e.draw.compass;

      let qlink = e.draw_type == 'Q' && fx.findEventByID(tournament, e.links['E']);
      let qlinkinfo = qlink && qlink.draw && dfx.drawInfo(qlink.draw);

      let node = !existing_scores ? null : dfx.findMatchNodeByTeamPositions(current_draw, outcome.positions);
      let previous_winner = node && node.match && node.match.winner ? node.match.winner.map(m=>m.id) : undefined;
      let previous_loser = node && node.match && node.match.loser ? node.match.loser.map(m=>m.id) : undefined;
      let current_winner = outcome.winner != undefined ? outcome.teams[outcome.winner].map(m=>m.id) : undefined;
      let current_loser = outcome.winner != undefined ? outcome.teams[1 - outcome.winner].map(m=>m.id) : undefined;

      if (compass) {
         // current draw should equal the draw within which the muid is found
         current_direction = Object.keys(e.draw).reduce((p, c) => p || (typeof e.draw[c] == 'object' && e.draw[c].matches && e.draw[c].matches[muid] && c), undefined);
         if (current_direction) current_draw = e.draw[current_direction];
         if (node) {
            // check whether player is active in target direction
            current_draw = e.draw[current_direction];
            let target_direction = fx.getTargetDirection(current_draw.direction, node.match.round);
            target_draw = target_direction && e.draw[target_direction];
            if (target_draw && previous_loser) {
               linked_info = dfx.drawInfo(target_draw);
               let advanced_positions = linked_info.match_nodes.filter(n=>n.data.match && n.data.match.players);
               let active_player_positions = [].concat(...advanced_positions.map(n=>n.data.match.players.map(p=>p.draw_position)));
               let position_in_linked = [].concat(...linked_info.nodes
                  .filter(node => node.data && node.data.team && util.intersection(node.data.team.map(t=>t.id), previous_loser).length)
                  .map(node => node.data.dp));
               active_in_linked = util.intersection(active_player_positions, position_in_linked).length;
            }
         }
      } else {
         active_in_linked = qlink && qlinkinfo && previous_winner && playerActiveInLinked(qlinkinfo, previous_winner);
      }

      let winner_changed = !previous_winner || !current_winner ? undefined : util.intersection(previous_winner, current_winner).length == 0;

      if (active_in_linked && (winner_changed || (previous_winner && !current_winner))) {
         return { error: 'phrases.cannotchangewinner' };
      } else if (previous_winner && !current_winner) {
         if (compass) {
            fx.removeDirectionalPlayer(tournament, e, target_draw, previous_loser, linked_info);
         } else {
            winnerRemoved({ tournament, e, qlink, qlinkinfo, previous_winner, outcome });
         }
         if (qlink) result.approved_changed = qlink;
         result.winner_removed = true;
      } else if (winner_changed) {
         if (qlink) qualifierChanged({ e, outcome, qlink, qlinkinfo, previous_winner, current_winner });
         if (compass) fx.removeDirectionalPlayer(tournament, e, target_draw, previous_loser, linked_info);
         result.winner_changed = true;
      }

      if (!existing_scores) {
         // no existing scores so advance position
         dfx.advancePosition({ node: current_draw, position: outcome.position });
      } else if (!outcome.score) {
         var possible_to_remove = (!node.ancestor || !node.ancestor.team);
         if (!possible_to_remove) return { error: 'phrases.cannotchangewinner' };
         result.deleted_muid = node.match.muid;
         fx.pruneMatch(node.match);
         delete node.dp;
      } else {
         let result = dfx.advanceToNode({
            node,
            score: outcome.score,
            complete: outcome.complete,
            position: outcome.position,
            score_format: outcome.score_format,
         });

         if (result && !result.advanced) return { error: 'phrases.cannotchangewinner' };
      }

      let info = dfx.drawInfo(current_draw);
      let finalist_dp = info.final_round.map(m=>m.data.dp);
      let qualifier_index = finalist_dp.indexOf(outcome.position);
      let qualified = e.draw_type == 'Q' && qualifier_index >= 0;

      if (qualified) {
         result.qualified = true;
         fx.qualifyTeam({ tournament, env: fx.fx.env(), e, team: outcome.teams[outcome.winner], qualifying_position: qualifier_index + 1 });
      }

      // modifyPositionScore removes winner/loser if match incomplete
      dfx.modifyPositionScore({ 
         node: current_draw, 
         positions: outcome.positions,
         score: outcome.score, 
         score_format: outcome.score_format,
         complete: outcome.complete, 
         set_scores: outcome.set_scores
      });

      let puids = outcome.teams.map(t=>t.map(p=>p.puid).join('|'));
      let findMatch = (e, n) => {
         let tpuids = n.teams.map(t=>t.map(p=>p.puid).join('|'));
         let pint = util.intersection(tpuids, puids);
         return pint.length == 2 ? n : e; 
      }
      let match_event = mfx.eventMatches(e, tournament).reduce(findMatch, undefined);

      if (!match_event) return { exit: true };

      let match = match_event.match;
      result.muid = match.muid;

      match.score = outcome.score;
      match.status = (outcome.score) ? '' : match.status;
      match.winner_index = outcome.winner;
      match.score_format = outcome.score_format;

      match.muid = match.muid || UUID.idGen();
      match.winner = outcome.teams[outcome.winner];
      match.loser = outcome.teams[1 - outcome.winner];
      match.date = match.date || new Date().getTime();

      match.players = [].concat(...outcome.teams);
      match.teams = outcome.teams;
      match.round = match_event.round;

      match.tournament = {
         name: tournament.name,
         tuid: tournament.tuid,
         org: tournament.org,
         category: tournament.category,
         round_name: match.round_name,
      };

      if (compass && match.loser) directLoser();

      e.active = true;
      return result;

      function directLoser() {
         let target_direction = fx.getTargetDirection(current_direction, match.round);
         let target_draw = target_direction && e.draw[target_direction];
         if (!target_draw) return;

         if (!target_draw.opponents) target_draw.opponents = [];
         if (!target_draw.unseeded_teams) target_draw.unseeded_teams = [];

         let losers = match.loser.map(playerFx.playerCopy);
         if (!existingOpponents(target_draw, losers)) {
            target_draw.opponents.push(losers);
            target_draw.unseeded_teams.push(losers);

            dfx.placeUnseededTeams({ draw: target_draw });
            let unfilled_positions = dfx.drawInfo(target_draw).unassigned.map(u=>u.data.dp);;
            if (!unfilled_positions.length) dfx.advanceTeamsWithByes({ draw: target_draw });
         }
      }
   }

   fx.getTargetDirection = (current_direction, match_round) => {
      let directions = {
         'east': ['west', 'north', 'northeast'],
         'west': ['south', 'southwest'],
         'north': ['northwest'],
         'south': ['southeast'],
      }
      return directions[current_direction] && directions[current_direction][match_round - 1];
   }

   function existingOpponents(target_draw, opponents) {
      let existing_opponents_puids = target_draw.opponents.map(o=>o.map(p=>p.puid));
      let opponent_puids = opponents.map(p=>p.puid);
      return existing_opponents_puids.reduce((p, c) => p || util.intersection(c, opponent_puids).length == opponent_puids.length, false);
   }

   fx.safeScoreRoundRobin = (tournament, e, existing_scores, outcome) => {
      try { return fx.scoreRoundRobin(tournament, e, existing_scores, outcome); }
      catch (err) { fx.logEventError(e, err, 'tournamentFx.scoreRoundRobin'); }
   }

   fx.scoreRoundRobin = (tournament, e, existing_scores, outcome) => {
      var result = {};
      if (!outcome) return result;

      var qlink = e.draw_type == 'R' && fx.findEventByID(tournament, e.links['E']);
      var qlinkinfo = qlink && qlink.draw && dfx.drawInfo(qlink.draw);
      var puids = outcome.teams.map(t=>t[0].puid);
      var findMatch = (e, n) => (util.intersection(n.match.puids, puids).length == 2) ? n : e;
      var match_event = mfx.eventMatches(e, tournament).reduce(findMatch, undefined);
      var winner = match_event.match.winner && match_event.match.winner.filter(f=>f).length;
      var previous_winner = winner ? match_event.match.winner.map(m=>m.id) : undefined;
      var current_winner = outcome.winner != undefined ? outcome.teams[outcome.winner].map(m=>m.id) : undefined;
      var qualifier_changed =
         previous_winner && !current_winner ? true
         : !previous_winner ? undefined
         : util.intersection(previous_winner, current_winner).length == 0;

      var draw_previously_complete = dfx.drawInfo(e.draw).complete;
      var bracket = e.draw.brackets[match_event.match.bracket];
      var bracket_complete = dfx.bracketComplete(bracket);
      var outcome_change = qualifier_changed || (previous_winner && !current_winner);

      if (qlink && bracket_complete && outcome_change) {
         // TODO: perhaps this is not necessary... but the question is whether
         // any 2nd qualifiers have been placed... and undoing it would mean
         // removing all 2nd qualifiers
         if (fx.allBracketsComplete(e) && qlink.active) return { error: 'phrases.cannotchangewinner' };

         let remove_result = fx.removeQualifiedRRplayers(tournament, e, bracket);
         result = Object.assign(result, remove_result);
         if (!result.remove_players) return { error: 'phrases.cannotchangewinner' };
      }

      if (!match_event) {
         console.log('something went wrong', outcome);
         return { exit: true };
      }

      if (!outcome.score) {
         result.deleted_muid = match_event.muid;
         fx.pruneMatch(match_event.match);
         return result;
      }

      let match = match_event.match;
      result.muid = match.muid;

      match.score = outcome.score;
      match.status = (outcome.score) ? '' : match.status;
      match.winner_index = outcome.winner;
      match.score_format = outcome.score_format;

      match.muid = match.muid || UUID.idGen();
      match.winner = [match.players[outcome.winner]];
      match.loser = [match.players[1 - outcome.winner]];
      match.date = match.date || new Date().getTime();

      match.teams = outcome.teams;

      match.tournament = {
         name: tournament.name,
         tuid: tournament.tuid,
         org: tournament.org,
         category: tournament.category,
         round_name: match.round_name,
         round: match_event.round
      };

      dfx.tallyBracketResults({ bracket, reset: true });
      if (outcome.complete && dfx.bracketComplete(bracket)) {
         let q_result = fx.determineRRqualifiers(tournament, e);
         result = Object.assign(result, q_result);
      }

      e.active = true;
      return result;
   }

   // TODO: make qualifying_position selectable (popup)
   fx.qualifyTeam = ({ tournament, env, e, team, qualifying_position }) => {
      if (!e.qualified) e.qualified = [];

      // TODO: this is a hack
      if (!team) return;

      let team_copy = team.map(player => Object.assign({}, player));

      team_copy.forEach(player => {
         player.entry = 'Q';
         delete player.seed
      });

      // RR Events reset e.qualified each time
      let qual_hash = e.qualified.map(teamHash);
      if (qual_hash.indexOf(teamHash(team_copy)) >= 0) return;
      e.qualified.push(team_copy);

      let elimination_event = fx.findEventByID(tournament, e.links['E']) || fx.findEventByID(tournament, e.links['S']);
      if (!elimination_event) return;

      let previously_qualified = elimination_event.approved.indexOf(teamHash(team_copy)) >= 0;
      if (previously_qualified) return;

      elimination_event.approved.push(teamHash(team_copy));
      fx.setDrawSize(tournament, elimination_event);

      let position = null;
      let edraw = elimination_event.draw && elimination_event.draw.compass ? elimination_event.draw.east : elimination_event.draw;
      // remove qualifier position from main draw and get position
      let info = edraw ? dfx.drawInfo(edraw) : undefined;
      if (info && info.qualifiers && info.qualifiers.length) {
         // let qp = info.qualifiers.pop();
         let qp = util.randomPop(info.qualifiers);
         position = qp.data.dp;

         delete qp.data.bye;
         delete qp.data.qualifier;
         delete qp.data.team;
      }

      // if the draw is active or if there are no unassigned teams
      // then place the team in a qualifier position
      if (edraw && (elimination_event.active || !info.unassigned.length)) {
         dfx.assignPosition({ node: edraw, position, team: team_copy, propagate: true });
         edraw.unseeded_placements.push({ id: team_copy[0].id, position });
      }

      if (edraw) {
         let info = edraw ? dfx.drawInfo(edraw) : undefined;
         let approved_opponents = fx.approvedOpponents({ tournament, e: elimination_event });
         approved_opponents.forEach(team=>team.forEach(player=>player.draw_position = info.assigned_positions[player.id]));
         edraw.opponents = approved_opponents;
         edraw.unseeded_teams = fx.teamSort(approved_opponents.filter(f=>!f[0].seed));
      }
   }

   fx.approvedOpponents = ({ tournament, e }) => {
      let env = fx.fx.env();

      let approved = [];
      let entry_data = {};

      // first capture any existing entry data
      if (['E', 'Q'].indexOf(e.draw_type) >= 0 && e.draw && e.draw.opponents) {
         e.draw.opponents.forEach(opponent=>opponent.forEach(plyr=>entry_data[plyr.id] = plyr.entry));
      }

      if (fx.isTeam(tournament)) {
         approved = fx.approvedTournamentTeams({ tournament, e }).map(t=>[t]);
      } else {
         if (e.format == 'D') { 
            approved = fx.approvedDoubles({ tournament, e })
               .map(team => team.players.map(player => Object.assign(player, { seed: team.seed })));;
         } else {
            approved = fx.approvedPlayers({ tournament, e }).map(p=>[p]);
         }
         approved.forEach(opponent => opponent.forEach(plyr => {
            // TODO:  should be unnecessary if players names normalized when added
            // to database or entered via tournament registration...
            plyr.first_name = util.normalizeName(plyr.first_name, false);
            plyr.last_name = util.normalizeName(plyr.last_name, false);
         }));
      }

      // assign any previous entry data to players
      approved.forEach(opponent => opponent.forEach(plyr => { if (entry_data[plyr.id]) plyr.entry = entry_data[plyr.id]; }));

      return approved;
   }

   fx.rankedTeams = (list) => {
      if (!list || !list.length) return false;
      if (list[0].players) {
         list = [].concat(...list.map(a=>a.players));
      } else {
         list = [].concat(...list);
      }
      let ranked = list.reduce((p, c) => c.category_ranking || p, false); 
      return ranked;
   }

   fx.approvedDoubles = ({ tournament, e }) => {
      if (!e.wildcards) e.wildcards = [];
      if (!e.luckylosers) e.luckylosers = [];

      let idm = fx.idMap(tournament, e);
      let idmap = idm.idmap;
      if (!idmap) return [];

      let offset = idm.offset;
      let approved = e.approved ? e.approved.map(t=>fx.teamObj(e, t, idmap, offset)).sort(fx.combinedRankSort) : [];

      let seed_limit = dfx.seedLimit(approved.length);
      let seeding = fx.rankedTeams(approved);
      approved.forEach((team, i) => team.seed = (seeding && i + 1 <= seed_limit) ? i + 1 : undefined);
      approved.forEach(team => {
         team.wildcard = (e.wildcards.indexOf(team.players.map(p=>p.id).sort().join('|')) >= 0) ? true : undefined;
         if (team.wildcard) team.players[0].entry = 'WC';
         team.luckyloser = (e.luckylosers.indexOf(team.players.map(p=>p.id).sort().join('|')) >= 0) ? true : undefined;
         if (team.luckyloser) team.players[0].entry = 'LL';
      });
      return approved;
   }

   /*
    * @param tournament {obj}    tournament object
    * @param e          {obj}    event object
    */
   fx.idMap = (tournament, e) => {
      let offset = 0;
      let players = tournament.players;
      if (!players) return {};
      let idmap = Object.assign({}, ...players.map(p => { return { [p.id]: p }}));

      let teams = e.teams || [];
      let eligible = fx.eligiblePlayers(tournament, e);
      let eligible_players = eligible.players || [];
      if (e.category && tournament.int_rankings && tournament.int_rankings[e.category]) {
         offset = tournament.int_rankings[e.category];
      } else if (teams.length || eligible_players.length) {
         let pids = [].concat(...(e.teams || []), ...eligible_players.map(p=>p.id));
         let possible = players.filter(p=>pids.indexOf(p.id)>=0);
         let int_ranks = possible.map(o=>parseInt(o.int, 0)).filter(i=>parseInt(i || 0)).sort();
         offset = int_ranks.length ? Math.max(...int_ranks) + 1 : 0;
      }

      return { idmap, offset, changed: eligible.changed };
   }

   fx.teamObj = (e, team, idmap, offset=0) => {
      let team_players = team.map(id=>playerFx.playerCopy(idmap[id])).sort(lastNameSort);
      let team_hash = team_players.map(p=>p&&p.id).sort().join('|');
      let subrank = (e.doubles_subrank && e.doubles_subrank[team_hash]) ? e.doubles_subrank[team_hash] : undefined;
      let team_rankings = team_players.map(t => (t.int && parseInt(t.int)) ? parseInt(t.int) : offset + t.category_ranking);
      let combined_rank = team_rankings.reduce((a, b) => (+a || 9999) + (+b || 9999));
      let combined_dbls_rank = team_players.map(t=>t.category_dbls).reduce((a, b) => (+a || 0) + (+b || 0));
      team_players.forEach(p=>{
         p.category_ranking = util.parseInt(p.int) || p.category_ranking;
         p.rank = p.modified_ranking || p.category_ranking;
      });
      return { players: team_players, combined_rank, combined_dbls_rank, subrank }

      function combinedRank(a, b) {
         if (a == undefined && b == undefined) return undefined;
         return (+a || 0) + (+b || 0);
      }

      function lastNameSort(a, b) {
         if (a.last_name < b.last_name) return -1;
         if (b.last_name < a.last_name) return 1;
         return 0;
      }
   }

   fx.approvedTournamentTeams = ({ tournament, e }) => {
      let env = fx.fx.env();
      let approved_teams = (tournament.teams || [])
         .filter(t => e.approved.indexOf(t.id) >= 0)
         .map(teamCopy);
      return approved_teams;
   }

   function teamCopy(team) {
      let team_copy = Object.assign({}, team);
      if (team.players) {
         team_copy.players = Object.assign({}, ...Object.keys(team.players).map(k=>({[k]: team.players[k]})));
      }
      return team_copy;
   }

   fx.findTournamentPlayer = ({ tournament, puid }) => {
      if (!tournament.players) return undefined;
      return tournament.players.reduce((p, c) => c.puid == puid ? c : p, undefined);
   }

   fx.approvedPlayers = ({ tournament, e }) => {
      let env = fx.fx.env();

      let approved_players = (tournament.players || [])
         .filter(p => e.approved.indexOf(p.id) >= 0)
         // make a copy of player objects to avoid changing originals
         .map(playerFx.playerCopy);

      let seed_limit = dfx.seedLimit(approved_players.length);

      // Round Robins must have at least one seed per bracket
      if (e.draw_type == 'R') seed_limit = Math.max(seed_limit, e.brackets * 2);
      if (e.draw_type == 'Q') seed_limit = fx.qualifierSeedLimit({ env, e }) || seed_limit;
      // if (e.draw_type == 'C' && !fx.fx.env().drawFx.consolation_seeding) seed_limit = 0;
      if (e.draw_type == 'C' && !env.drawFx.consolation_seeding) seed_limit = 0;

      let ranked_players = approved_players.filter(a=>a.category_ranking).length;

      if (!e.gem_seeding && ranked_players < seed_limit) seed_limit = ranked_players;

      let linkedQ = fx.findEventByID(tournament, e.links['Q']) || fx.findEventByID(tournament, e.links['R']);
      let qualifier_ids = linkedQ && linkedQ.qualified ? linkedQ.qualified.map(teamHash) : [];
      let qualifying_consolation = linkedQ && e.draw_type == 'C';

      if (qualifying_consolation) approved_players = approved_players.filter(p=>qualifier_ids.indexOf(p.id) < 0);

      let alternate_ids = [];
      /*
      let linkedE = fx.findEventByID(tournament, e.links['E']);
      let alternate_ids = (e.draw_type == 'C' && linkedE && linkedE.approved) ?
         approved_players.map(ap => ap.id).filter(i => linkedE.approved.indexOf(i) < 0) : [];
      */

      let seeding = !fx.isPreRound({ env, e }) && fx.rankedTeams(approved_players);

      approved_players = approved_players
         .map((p, i) => {
            let qualifier = qualifier_ids.indexOf(p.id) >= 0;
            let alternate = alternate_ids.indexOf(p.id) >= 0;
            let wildcard = e.wildcards && e.wildcards.indexOf(p.id) >= 0;
            let luckyloser = e.luckylosers && e.luckylosers.indexOf(p.id) >= 0;
            p.entry = qualifier ? 'Q' : alternate ? 'A' : wildcard ? 'WC' : luckyloser ? 'LL' : p.entry;

            // TODO: implement qualifier in approvedDoubles?

            // draw_order is order in ranked list of event players
            p.draw_order = i + 1;
            p.seed = (seeding && i < seed_limit) ? i + 1 : undefined;

            p.rank = p.modified_ranking || p.category_ranking;
            p.last_name = p.last_name.toUpperCase();
            p.first_name = util.normalizeName(p.first_name, false);
            return p;
         });

      if (e.gem_seeding) {
         let linkedQ = fx.findEventByID(tournament, e.links['Q']) || fx.findEventByID(tournament, e.links['R']);
         if (!linkedQ || !linkedQ.qualified || !linkedQ.draw) return [];
         let qualifier_ids = linkedQ.qualified.map(q=>q[0].id);
         let teams = linkedQ.draw.opponents.filter(t=>e.draw_type == 'C' ? qualifier_ids.indexOf(t[0].id) < 0 : qualifier_ids.indexOf(t[0].id) >= 0);
         let ratios = Object.assign({}, ...teams.map(t=>({ [t[0].puid]: t[0].results && t[0].results.ratio_hash })) );
         approved_players.forEach(o=>o.gem_ratio = ratios[o.puid]);

         approved_players
            .sort((a, b) => (b.gem_ratio || 0) > (a.gem_ratio || 0) ? 1 : (b.gem_ratio || 0) < (a.gem_ratio || 0) ? -1 : 0 )
            .forEach((p, i) => { p.seed = (i < seed_limit) ? i + 1 : undefined; });
      }

      return approved_players;
   }

   fx.modifyEventScoring = ({ cfg_obj, tournament, evt, callback, format }) => {
      let max_sets = parseInt(cfg_obj.bestof.ddlb.getValue());
      let sets_to_win = Math.ceil(max_sets/2);
      let sf = {
         max_sets,
         sets_to_win,
         games_for_set: parseInt(cfg_obj.setsto.ddlb.getValue()),
         tiebreaks_at: parseInt(cfg_obj.tiebreaksat.ddlb.getValue()),
         tiebreak_to: parseInt(cfg_obj.tiebreaksto.ddlb.getValue()),
         supertiebreak_to: parseInt(cfg_obj.supertiebreakto.ddlb.getValue()),
         final_set_supertiebreak: cfg_obj.finalset.ddlb.getValue() == 'N' ? false : true,
      }
      if (format) {
         evt.scoring_format[format] = sf;
      } else {
         evt.score_format = sf;
      }
      modifyUnscoredMatches(sf);
      let stb = sf.final_set_supertiebreak ? '/S' : '';
      evt.scoring = `${sf.max_sets}/${sf.games_for_set}/${sf.tiebreak_to}T${stb}`;
      if (typeof callback == 'function') callback();

      // TODO: once draw contains matches modify unscored depending on format
      function modifyUnscoredMatches(sf) {
         let info = evt.draw && dfx.drawInfo(evt.draw);
         if (info && info.match_nodes) {
            // update scoring format for unfinished matches
            info.match_nodes.forEach(node => modify(node.data.match));
         } else if (info && info.matches) {
            // update scoring format for unfinished RR matches
            info.matches.forEach(modify);
         }
         function modify(match) { if (!match.winner) { match.score_format = sf; } }
      }
   }
   fx.setDrawSize = (tournament, e) => {
      if (e.active) return;
      let drawTypes = {
         E() {
            let qualifiers = 0;
            let players = e.approved && e.approved.length ? e.approved.length : 0;

            // add positions for qualifiers into the draw
            let linked = fx.findEventByID(tournament, e.links['Q']) || fx.findEventByID(tournament, e.links['R']);
            if (linked && linked.qualifiers) qualifiers = linked.qualifiers;
            let qualified = linked && linked.qualified ? linked.qualified.map(teamHash) : [];
            if (linked && linked.qualifiers) qualifiers = linked.qualifiers - qualified.length;

            let total = players + qualifiers;
            let new_draw_size = total ? dfx.acceptedDrawSizes(total) : 0;
            e.draw_size = new_draw_size;
            e.qualifiers = qualifiers;
            if (e.draw) e.draw.qualifiers = qualifiers;
         },
         R() {
            e.draw_size = e.brackets * e.bracket_size;
         },
         Q() {
            e.draw_size = !e.draw ? 0 : dfx.drawInfo(e.draw).draw_positions.length;
         },
         C() {
            // TODO: unless structure is feed-in, draw_size should be half of the main draw to which it is linked
            let draw_size = Math.max(0, e.approved && e.approved.length ? dfx.acceptedDrawSizes(e.approved.length) : 0);
            e.draw_size = draw_size;
         },
         S() {
            let qualifiers = 0;
            let players = e.approved && e.approved.length ? e.approved.length : 0;

            // add positions for qualifiers into the draw
            let linked = fx.findEventByID(tournament, e.links['Q']) || fx.findEventByID(tournament, e.links['R']);
            if (linked && linked.qualifiers) qualifiers = linked.qualifiers;
            let qualified = linked && linked.qualified ? linked.qualified.map(teamHash) : [];
            if (linked && linked.qualifiers) qualifiers = linked.qualifiers - qualified.length;

            if (!e.draw || !e.draw.east) {
               e.draw_size = 0;
            } else {
               let total = players + qualifiers;
               let new_draw_size = total ? dfx.acceptedDrawSizes(total) : 0;
               e.draw_size = new_draw_size;
               e.qualifiers = qualifiers;
               if (e.draw) e.draw.east.qualifiers = qualifiers;
            }
         },
         F() {
            e.draw_size = !e.draw ? 0 : dfx.drawInfo(e.draw).draw_positions.length;
         }
      }

      drawTypes[e.draw_type] ? drawTypes[e.draw_type]() : undefined;
   }

   fx.ineligiblePlayers = (tournament, e) => {
      let tournament_date = tournament && (tournament.points_date || tournament.start);
      let calc_date = tournament_date ? new Date(tournament_date) : new Date();

      let players = tournament.players
         .filter(player => !eligibleGender(e.gender, player) || !playerFx.eligibleForCategory({ calc_date, category: e.category, player }));

      // TODO: render ineligible because of health certificate / suspension & etc.
      return { players };
   }

   function eligibleGender(gender, p) { return !gender || (gender && p.sex == gender); }

   fx.unavailablePlayers = (tournament, e) => {
      if (!e.links) return { players: [] };
      if (['E', 'S'].indexOf(e.draw_type) >= 0) {
         // elimination events can't have approved players who are also approved in linked qualifying events
         // though qualifying players *WILL* appear in elimination approved players list
         if (e.links['Q']) {
            let linked = fx.findEventByID(tournament, e.links['Q']);
            if (!linked) {
               delete e.links['Q'];
               return filterPlayers();
            } 

            let qualified = !linked.qualified ? [] : linked.qualified.map(teamHash);
            let qualifying = !linked.approved ? [] : linked.approved.filter(a=>qualified.indexOf(a) < 0);
            return filterPlayers(qualifying);

         }
         if (e.links['R']) {
            let linked = fx.findEventByID(tournament, e.links['R']);
            if (!linked) {
               delete e.links['R'];
               return filterPlayers();
            } 
            let qualified = !linked.qualified ? [] : linked.qualified.map(teamHash);
            let qualifying = !linked.approved ? [] : linked.approved.filter(a=>qualified.indexOf(a) < 0);
            return filterPlayers(qualifying);
         }
      } else if (['Q', 'R'].indexOf(e.draw_type) >= 0) {
         // qualifying events can't have approved players who are also approved in linked elimination events
         if (e.links['E']) {
            let linked = fx.findEventByID(tournament, e.links['E']);
            if (!linked) {
               delete e.links['E'];
               return filterPlayers();
            } 
            let qual_hash = !e.qualified ? [] : e.qualified.map(teamHash);
            let linked_approved = !linked.approved ? [] : linked.approved.filter(a=>qual_hash.indexOf(a)<0);
            return filterPlayers(linked_approved);
         }
      } else if (e.draw_type == 'C' && (e.links['R'] || e.links['Q'])) {
         // if consolation event follows qualifying... then can't have eligible players who are in main draw event
         let linked = fx.findEventByID(tournament, e.links['R'] || e.links['Q']);
         let main_id = linked.links['E'];
         let main = main_id && fx.findEventByID(tournament, main_id);
         if (main) {
            let main_approved = !main.approved ? [] : main.approved;
            return filterPlayers(main_approved);
         }
      }

      return filterPlayers();

      function filterPlayers(filter=[]) {
         if (filter.length) { e.approved = e.approved.filter(id => filter.indexOf(id) < 0); }
         return { players: tournament.players.filter(p=>filter.indexOf(p.id) >= 0), changed: filter.length };
      }
   }

   fx.eligiblePlayers = (tournament, e, ineligible_players, unavailable_players) => {
      var approved_changed = false;

      if (!unavailable_players) {
         let unavailable = fx.unavailablePlayers(tournament, e);
         unavailable_players = unavailable.players;
      }

      let unavailable_ids = unavailable_players.map(p=>p.id);

      ineligible_players = ineligible_players || fx.ineligiblePlayers(tournament, e).players;
      let ineligible_ids = ineligible_players.map(p=>p.id);

      let available_players = tournament.players
         .filter(p => ineligible_ids.indexOf(p.id) < 0)
         .filter(p => p.signed_in)
         .map((p, i) => {
            let c = Object.assign({}, p);
            // if there is no category ranking, don't add order attribute
            if (c.category_ranking) c.order = i + 1;
            return c;
         })
         .filter(p => unavailable_ids.indexOf(p.id) < 0);

      let completed_matches = e.links && e.links['E'] ?  mfx.eventMatches(fx.findEventByID(tournament, e.links['E']), tournament).filter(m=>m.match.winner) : [];
      if (e.draw_type == 'P' && (!e.links['E'] || !completed_matches.length)) return { players: [] };

      if (e.draw_type == 'P') {
         let ep = exitProfiles(completed_matches);
         // if building a playoff draw, available players are those who have lost in semifinal (for now...)
         available_players = available_players.filter(p => ep[p.id] && ep[p.id].round_name == 'SF');
      }

      if (e.draw_type == 'C') {
         let linkedQ = fx.findEventByID(tournament, e.links['Q']) || fx.findEventByID(tournament, e.links['R']);
         let qualifying_consolation = linkedQ && e.draw_type == 'C';

         if (qualifying_consolation) {
            // if building a consolation draw for a qualifying event, available players are thos who didn't qualify
            let qualifier_ids = linkedQ.qualified.map(q=>q[0].id);
            let available_ids = linkedQ.approved.filter(id=>qualifier_ids.indexOf(id) < 0);
            available_players = available_players.filter(p=>available_ids.indexOf(p.id) >= 0);
         } else {
            if (!e.links['E'] || !completed_matches.length) return { players: [] };

            let winner_ids = [].concat(...completed_matches.map(match => match.match.winner.map(team=>team.id)));
            let all_loser_ids = [].concat(...completed_matches.map(match => match.match.loser.map(team=>team.id)));
            let losing_players = tournament.players.filter(p=>all_loser_ids.indexOf(p.id) >= 0);
            let no_wins_ids = all_loser_ids.filter(i => winner_ids.indexOf(i) < 0);

            let alternate_ids = all_loser_ids.filter(i=>no_wins_ids.indexOf(i) < 0);
            let ep = exitProfiles(completed_matches);
            available_players.forEach(p => {
               if (alternate_ids.indexOf(p.id) >= 0) {
                  p.alternate = true;
                  p.exit_profile = ep[p.id];
               }
            });

            // if building a consolation draw for an elimination event, available players are those who have lost in a linked elimination event...
            let alts = fx.fx.env().drawFx.consolation_alternates;
            available_players = available_players
               .filter(p=>no_wins_ids.indexOf(p.id) >= 0 || (alts && alternate_ids.indexOf(p.id) >= 0));
         }
      }

      let existing_approved = e.approved ? e.approved.map(a=>a).sort().join('/') : [];

      if (e.format != 'D') {
         e.approved = tournament.players
            .filter(p=>!e.gender || p.sex == e.gender)
            .filter(p=>ineligible_ids.indexOf(p.id) < 0)
            .filter(p=>unavailable_ids.indexOf(p.id) < 0)
            .filter(p=>e.approved.indexOf(p.id) >= 0)
            .map(p=>p.id);
      } else {
         // from both e.approved and e.teams
      }

      let new_approved = e.approved ? e.approved.map(a=>a).sort().join('/') : [];
      approved_changed = existing_approved != new_approved;

      if (e.format == 'D') {
         let team_players = e.teams ? [].concat(...e.teams) : [];
         return { players: available_players.filter(p => team_players.indexOf(p.id) < 0), changed: approved_changed }
      } else {
         return { players: available_players.filter(p => e.approved.indexOf(p.id) < 0), changed: approved_changed }
      }
   }

   fx.eligibleTeams = (tournament, e, ineligible_teams, unavailable_teams) => {
      if (!unavailable_teams) {
         let unavailable = fx.unavailableTeams(tournament, e);
         unavailable_teams = unavailable.teams;
      }

      // let unavailable_uuids = unavailable_teams.map(p=>p.uuid);
      let unavailable_uuids = unavailable_teams.map(p=>p.id);

      ineligible_teams = ineligible_teams || fx.ineligibleTeams(tournament, e).teams;
      // let ineligible_uuids = ineligible_teams.map(p=>p.uuid);
      let ineligible_uuids = ineligible_teams.map(p=>p.id);

      let available_teams = tournament.teams
         // .filter(t => ineligible_uuids.indexOf(t.uuid) < 0)
         .filter(t => ineligible_uuids.indexOf(t.id) < 0)
         .map((t, i) => { return Object.assign({}, t); })
         // .filter(t => unavailable_uuids.indexOf(t.uuid) < 0)
         .filter(t => unavailable_uuids.indexOf(t.id) < 0)
         // .filter(t => e.approved.indexOf(t.uuid) < 0);
         .filter(t => e.approved.indexOf(t.id) < 0);

      return { teams: available_teams }
   }

   fx.ineligibleTeams = (tournament, e) => {
      return { teams: [] }
   }

   fx.unavailableTeams = (tournament, e) => {
      return { teams: [] };
   }

   fx.tournamentCategories = (tournament) => {
      if (!tournament.events || !tournament.events.length) return tournament.categories;
      return util.unique(tournament.events.map(e=>e.category));
   }

   function exitProfiles(completed_matches) {
      let event_rounds = {};
      let exit_profiles = {};
      completed_matches.forEach(match => {
         let round = match.round;
         let loser_id = match.match.loser[0].id;
         let winner_id = match.match.winner[0].id;
         if (!event_rounds[loser_id]) event_rounds[loser_id] = []
         if (!event_rounds[winner_id]) event_rounds[winner_id] = [];
         event_rounds[loser_id].push(round);
         event_rounds[winner_id].push(round);

         if (!exit_profiles[loser_id]) exit_profiles[loser_id] = {};
         exit_profiles[loser_id] = {
            muid: match.match.muid,
            exit_round: round,
            round_name: match.match.round_name,
            result_order: match.match.result_order,
            event_rounds: event_rounds[loser_id],
            winner: {
               id: winner_id,
               name: `${match.match.winner[0].first_name} ${match.match.winner[0].last_name}`
            }
         };
      });

      Object.keys(exit_profiles).forEach(ep => {
         let profile = exit_profiles[ep];
         profile.winner.event_rounds = event_rounds[profile.winner.id];
         profile.winner.exit_round = exit_profiles[profile.winner.id] ? exit_profiles[profile.winner.id].exit_round : undefined;
      });

      return exit_profiles;
   }

   fx.orderPlayersByRank = orderPlayersByRank;
   function orderPlayersByRank(players, category) {
      if (players) {
         category = staging.legacyCategory(category);
         players.forEach(player => {
            if (player.modified_ranking) {
               player.category_ranking = +player.modified_ranking;
            } else if (player.rankings && player.rankings[category]) {
               player.category_ranking = +player.rankings[category];
            } else if (player.rank) {
               player.category_ranking = +player.rank;
            }
         });

         let ranked = players.filter(player => player.category_ranking);
         let unranked = players.filter(player => !player.category_ranking);

         // sort unranked by full_name (last, first)
         fx.playerSort(unranked);

         let iranked = ranked.filter(player => internationalRanking(player));
         let ranked_players = ranked.filter(player => !internationalRanking(player));

         // sort ranked players by category ranking, or, if equivalent, subrank
         iranked.sort((a, b) => (a.category_ranking == b.category_ranking) ? a.subrank - b.subrank : a.category_ranking - b.category_ranking);
         ranked_players.sort((a, b) => (a.category_ranking == b.category_ranking) ? a.subrank - b.subrank : a.category_ranking - b.category_ranking);

         return [].concat(...iranked, ...ranked_players, ...unranked);
      } else {
         return [];
      }
   }

   fx.playerSort = (players) => {
      return players.sort((a, b) => {
         let sort_a = `${a.last_name.toUpperCase()}, ${util.normalizeName(a.first_name)}`;
         let sort_b = `${b.last_name.toUpperCase()}, ${util.normalizeName(b.first_name)}`;
         let a1 = util.replaceDiacritics(sort_a);
         let b1 = util.replaceDiacritics(sort_b);
         let result = a1 < b1 ? -1 : a1 > b1 ? 1 : 0
         return result;
      });
   }

   fx.rankDuplicates = (players, active_puids=[]) => {
      let notIranked = players.filter(p=>!internationalRanking(p));
      let all_rankings = notIranked.map(p=>p.category_ranking);
      let count = util.arrayCount(all_rankings);
      let duplicates = Object.keys(count).reduce((p, k) => { if (!isNaN(k) && count[k] > 1) p.push(+k); return p; }, []);

      let duplicate_puids = [];
      if (duplicates) {
         duplicate_puids = notIranked.filter(p=>duplicates.indexOf(p.category_ranking) >= 0).map(p=>p.puid);
         duplicate_puids = duplicate_puids.concat(...active_puids);
      }
      return duplicate_puids;
   }

   fx.qualifierSeedLimit = ({ env, e }) => {
      let limit = env && env.drawFx.qualifying_bracket_seeding ? (e.qualifiers * 2) : 0;
      return Math.min(e.approved.length, limit);
   }

   // TODO: qualifying_bracket_seeding is only here to identify HTS?
   fx.isPreRound = ({ env, e }) => e.draw_type == 'Q' && e.approved && e.approved.length && e.qualifiers == e.draw_size / 2 && env.drawFx.qualifying_bracket_seeding;

   fx.combinedRankSort = (a, b, doubles_rankings) => {
      var subrank_difference = (a.subrank || 1000) - (b.subrank || 1000);
      var combined_singles_difference = pad(a.combined_rank) - pad(b.combined_rank);
      var combined_doubles_difference = pad(b.combined_dbls_rank) - pad(a.combined_dbls_rank);
      return combined_doubles_difference || combined_singles_difference || subrank_difference;

      // if a team has NO ranking (undefined) then give them a ranking of 9999
      function pad(value) { return value == undefined ? 9999 : value; }
   }

   fx.teamSort = (teams) => {
      return teams.sort((a, b) => {
         if (!a[0].full_name) a[0].full_name = fx.fullName(a[0]);
         if (!b[0].full_name) b[0].full_name = fx.fullName(b[0]);
         let a1 = util.replaceDiacritics(a[0].full_name);
         let b1 = util.replaceDiacritics(b[0].full_name);
         return a1 < b1 ? -1 : a1 > b1 ? 1 : 0
      });
   }

   fx.fullName = (o, noaccents=true) => {
      if (o.last_name && o.first_name) return `${o.last_name.toUpperCase()}, ${util.normalizeName(o.first_name, noaccents)}`; 
      return o.name || '';
   }

   // RR Events
   fx.allBracketsComplete = (evt) => evt && evt.draw ? evt.draw.brackets.map(dfx.bracketComplete).reduce((a, b) => a && b) : false;

   function rrQualSort(a, b) {
      if (!b[0].category_ranking && !a[0].category_ranking && b[0].results.ratio_hash && a[0].results.ratio_hash) {
         return b[0].results.ratio_hash - a[0].results.ratio_hash;
      }
      return (b[0].category_ranking || 9999) - (a[0].category_ranking || 9999);
   }

   fx.firstQualifiers = (evt) => {
      if (!evt || !evt.draw) return [];
      let opponents = evt.draw.opponents;
      let ordered_opponents = opponents.filter(o=> {
         if (o[0].order == 1 && !o[0].sub_order) return true;
         if (o[0].order == 1 && o[0].sub_order == 1) return true;
      })
      .sort(rrQualSort);
      return ordered_opponents;
   }

   fx.secondQualifiers = (evt) => {
      if (!evt || !evt.draw) return [];
      let opponents = evt.draw.opponents;
      let ordered_opponents = opponents
         .filter(o=> {
            if (o[0].order == 1 && o[0].sub_order == 2) return true;
            if (o[0].order == 2 && !o[0].sub_order) return true;
            if (o[0].order == 2 && o[0].sub_order == 1) return true;
         })
      .sort(rrQualSort);
      return ordered_opponents;
   }

   fx.thirdQualifiers = (evt) => {
      if (!evt || !evt.draw) return [];
      let opponents = evt.draw.opponents;
      return opponents
         .filter(o => {
               if (o[0].order == 1 && o[0].sub_order == 3) return true;
               if (o[0].order == 2 && o[0].sub_order == 2) return true;
               if (o[0].order == 3 && !o[0].sub_order) return true;
               if (o[0].order == 3 && o[0].sub_order == 1) return true;
         })
      .sort(rrQualSort);
   }

   fx.determineRRqualifiers = (tournament, e) => {
      var event_complete = false;
      // 1st qualifiers from each bracket
      var qualified_teams = fx.firstQualifiers(e);

      if (fx.allBracketsComplete(e)) {
         let other_qualifiers = [].concat(...fx.thirdQualifiers(e), ...fx.secondQualifiers(e));
         while (qualified_teams.length < e.qualifiers && other_qualifiers.length) qualified_teams.push([other_qualifiers.pop()]);

         event_complete = true;
      }

      e.qualified = [];
      qualified_teams.forEach(team => fx.qualifyTeam({ tournament, env: fx.fx.env(), e, team }));

      return { event_complete }
   }

   fx.removeQualifiedRRplayers = (tournament, evt, bracket) => {
      var qualified_ids = evt.qualified ? [].concat(...evt.qualified.map(team=>team.map(p=>p.id))) : [];
      var scope = bracket ? bracket.players : evt.opponents;
      var scoped_qualifiers = scope.filter(p=>qualified_ids.indexOf(p.id)>=0);

      if (fx.allBracketsComplete(evt)) {
         // add all 2nd qualifiers to scope
         let qualified_2nd = [].concat(...fx.secondQualifiers(evt));
         qualified_2nd.forEach(q => { if (scoped_qualifiers.map(m=>m.id).indexOf(q.id) <= 0) scoped_qualifiers.push(q); });
      }

      // if any qualified players are in this bracket, remove them from qualified players
      let qib_ids = scoped_qualifiers.map(p=>p.id);
      evt.qualified = evt.qualified ? evt.qualified.filter(t=>util.intersection(t.map(p=>p.id), qib_ids).length == 0) : [];

      // 2) if any qualified players are in the linked event, remove them
      let qlink = fx.findEventByID(tournament, evt.links['E']);
      let qlinkinfo = qlink && qlink.draw && dfx.drawInfo(qlink.draw);

      let remove_players = fx.possibleToRemoveRRmatch(scoped_qualifiers, qlinkinfo);

      var linkchanges = false;
      if (remove_players) scoped_qualifiers.forEach(qib=>{
         let result = fx.removeQualifiedPlayer(tournament, evt, [qib.id], qlink, qlinkinfo);
         if (result.linkchanges) linkchanges = true;
      });
      return { remove_players, linkchanges, qlink };
   }

   fx.possibleToRemoveRRmatch = (scoped_qualifiers, qlinkinfo) => {
      var active_in_linked = [];
      if (scoped_qualifiers.length && qlinkinfo) {
         let advanced_positions = qlinkinfo.match_nodes.filter(n=>n.data.match && n.data.match.players);
         let active_player_positions = [].concat(...advanced_positions.map(n=>n.data.match.players.map(p=>p.draw_position)));

         active_in_linked = scoped_qualifiers
            .map(qib => {
               let position_in_linked = [].concat(...qlinkinfo.nodes
                  .filter(node => node.data.team && util.intersection(node.data.team.map(t=>t.id), qib.id).length)
                  .map(node => node.data.dp));
               let active = util.intersection(active_player_positions, position_in_linked).length;
               return active ? qib : undefined;
            })
            .filter(f=>f);
      }

      return active_in_linked.length == 0;
   }

   // general event interactions
   
   fx.removeQualifiedPlayer = (tournament, e, team_ids, qlink, qlinkinfo) => {
      fx.logEventChange(e, { fx: 'qualified player removed', d: { team_ids } });

      let player_in_linked = qlink ? util.intersection(qlink.approved, team_ids).length : false;

      if (qlink && player_in_linked) {
         // Remove player from linked draw
         qlink.approved = qlink.approved.filter(a=>team_ids.indexOf(a) < 0);
         qlink.up_to_date = false;

         let qdraw = (qlink.draw && qlink.draw.compass) ? qlink.draw.east : qlink.draw;
         if (qlinkinfo) {
            qdraw.opponents = qdraw.opponents.filter(o=>util.intersection(o.map(m=>m.id), team_ids).length == 0);
            qlinkinfo.nodes.forEach(node => {
               if (node.data.team && util.intersection(node.data.team.map(t=>t.id), team_ids).length) {
                  node.data.qualifier = true;
                  node.data.team = node.data.team.map(team => ({ bye: undefined, entry: 'Q', qualifier: true, draw_position: team.draw_position }) );
               }
            });
         }
      }

      // must occur after team removed from linked draw approved
      e.qualified = !e.qualified ? [] : e.qualified.filter(q=>util.intersection(q.map(m=>m.id), team_ids).length == 0);
      fx.setDrawSize(tournament, e);

      // must occur after e.qualified is updated
      let linkchanges = (qlink && player_in_linked);
      if (linkchanges) fx.setDrawSize(tournament, qlink);

      return { linkchanges, qlink }
   }

   fx.removeDirectionalPlayer = (tournament, e, target_draw, losing_team_ids, linked_info) => {
      if (!target_draw) return {};
      fx.logEventChange(e, { fx: 'directional player removed', d: { losing_team_ids } });
      target_draw.opponents = target_draw.opponents.filter(o=>util.intersection(o.map(m=>m.id), losing_team_ids).length != losing_team_ids.length);
      linked_info.nodes.forEach(node => {
         if (node.data.team && util.intersection(node.data.team.map(t=>t.id), losing_team_ids).length) { delete node.data.team; }
      });
      return {};
   }

   // MISC
   fx.logEventChange = (evt, change) => {
      if (!evt.log) evt.log = [];
      change.timestamp = new Date().getTime();
      evt.log.push(change);
   }

   fx.logEventError = (evt, err, context) => {
      console.log(err);
      if (!evt.error_log) evt.error_log = [];
      let timestamp = new Date().getTime();
      evt.error_log.push({ timestamp, error: err.toString(), stack: err.stack && err.stack.toString(), context });
   }

   fx.isTeam = (t) => { return ['team', 'dual'].indexOf(t.type) >= 0; }
   function internationalRanking(p) { return p.int > 0; }
   function teamHash(team) { return team.map(p=>p.id).join('|'); }

   return fx;
}();
