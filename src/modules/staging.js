import { db } from './db';
import { env } from './env';
import { util } from './util';
import { coms } from './coms';
import { config } from './config';
import { fetchFx } from './fetchFx';
import { lang } from './translator';
import { idiomFx } from './idiomFx';
import { importFx } from './importFx';
import { stringFx } from './stringFx';
import { settingsFx } from './settingsFx';
import { calendarFx } from './calendarFx';
import { displayGen } from './displayGen';
import { scoreBoard } from './scoreBoard';
import { tournamentDisplay } from './tournamentDisplay';

export const staging = function() {

   let fx = {};

   fx.init = () => {
      coms.fx.processDirective = processDirective;
      coms.fx.receiveTournament = receiveTournament;
      coms.fx.receiveTournaments = receiveTournaments;
      coms.fx.receiveTournamentRecord = receiveTournamentRecord;
      coms.fx.tmxMessage = tmxMessage;
      coms.fx.receiveTournamentEvents = receiveTournamentEvents;
   };

   fx.legacy_categories = { 'S': '20' };
   fx.legacyCategory = (category, reverse) => {
      let legacy = reverse ?  Object.keys(fx.legacy_categories).map(key => ({ [fx.legacy_categories[key]]: key })) : fx.legacy_categories;
      if (legacy[category]) category = legacy[category];
      return category;
   };

   function resetDB() {
      return new Promise(resolve => {
         let reload = () => {
            displayGen.closeModal();
            window.location.replace(window.location.pathname);
         };
         let okAction = () => {
            db.resetDB(reload);
            resolve();
         };
         let cancelAction = () => {
            util.clearHistory(); 
            displayGen.closeModal(); 
            resolve();
         };
         let message = `<div style='margin: 1em;'><h2>${lang.tr('warn')}:</h2><p>${lang.tr('phrases.reset')}</div>`;
         displayGen.okCancelMessage(message, okAction, cancelAction);
      });
   }

   function processDirective(data) {
      let json_data = util.attemptJSONparse(data);

      if (json_data && json_data.directive) {
         if (json_data.directive == 'settings') {
            settingsFx.receiveSettings(json_data);
         }
         if (json_data.directive == 'new version') {
            let msg = json_data.notice || '';
            fetchFx.update = true;
            config.pushMessage({ title: 'newversion', notice: msg });
            displayGen.homeIconState('update');
         }
         if (json_data.directive == 'team data') {
            console.log('team data received;', json_data);
            util.addDev({json_data});
         }
         if (json_data.directive == 'load data' && json_data.content) { importFx.loadJSON(json_data.content); }
         if (json_data.directive == 'reset db' && json_data.content) { resetDB(); }
         if (json_data.directive == 'clear settings' && json_data.content) { db.db.settings.toCollection().delete(); }
         if (json_data.directive == 'add idiom' && json_data.content) {
            lang.define(json_data.content);
            db.addIdiom(json_data.content).then(setIdiom, error => console.log('error:', error));
         }
      }
      function setIdiom() {
         idiomFx.idiomSelectorOptions(json_data.content.ioc);
         idiomFx.changeIdiom(json_data.content.ioc);
      }
   }

   fx.receiveTournamentRecord = receiveTournamentRecord;

   // incoming data is already properly formatted object for passing on to receiveTournament()
   function receiveTournamentRecord(data) { receiveTournament(data); }

   function receiveTournament({ record, authorized }) {
      let published_tournament = CircularJSON.parse(record);

      let auth_message = authorized ? `<span style='color: green'>${lang.tr('tournaments.auth')}</span>` : lang.tr('tournaments.noauth');
      let publishtime = !published_tournament.pushed2cloud ? '' :
         `<p><b>${lang.tr('tournaments.publishtime')}:</b><br>${new Date(published_tournament.pushed2cloud)}</p>`;
      let message = `
         <h2 class='title is-4'>${lang.tr('tournaments.received')}</h2>
         <h4 class='subtitle is-5'>${published_tournament.name}</h4>
         <h5 class='title is-5'>${auth_message}</h5>
         ${publishtime}
         <h4 class='title is-4' style='margin-top: 1em;'><b>${lang.tr('tournaments.replacelocal')}</b></h4>
      `;

      let cancelAction = () => displayGen.closeModal();
      displayGen.actionMessage({ message, actionFx: saveReceivedTournament, action: lang.tr('replace'), cancelAction });

      function saveReceivedTournament() {
         displayGen.closeModal();
         published_tournament.received = new Date().getTime();
         db.addTournament(published_tournament).then(displayTournament, util.logError);
      }
      function displayTournament() { tournamentDisplay.displayTournament({tuid: published_tournament.tuid}); }
   }

   function receiveTournaments(tournaments) {
      let new_trnys = tournaments && tournaments.map(t=>util.attemptJSONparse(t)).filter(f=>f);
      if (new_trnys) Promise.all(new_trnys.map(mergeTournament)).then(checkDisplay, util.logError);

      function mergeTournament(trny) {
         return new Promise((resolve, reject) => {
            db.findTournament(trny.tuid).then(mergeExisting, util.logError);
            function mergeExisting(existing) {
               if (!existing) {
                  db.addTournament(trny).then(resolve, reject);
               } else {
                  resolve();
               }
            }
         });
      }

      function checkDisplay() { if (displayGen.content == 'calendar') calendarFx.displayCalendar(); }
   }

   function tmxMessage(msg) {
      if (msg.authorized && msg.tuid) {
         config.authMessage(msg);
      } else {
         msg.notice = msg.notice || msg.tournament;
         if (msg.notice) config.addMessage(msg);
      }
   }

   fx.endBroadcast = () => { env.publishing.broadcast = false; };
   fx.broadcasting = () => {
      if (env.publishing.broadcast && coms.connected()) return true;
      // if (env.publishing.broadcast && !coms.connected() && navigator.onLine) { coms.connectSocket(); }
      if (env.publishing.broadcast && !coms.connected) { coms.connectSocket(); }
      return false;
   };

   fx.broadcastScore = (match) => {
      // format match_message the way the old tournaments client requires
      var coords = config.geoposition().coords || {};
      var sparts = scoreBoard.convertStringScore({ string_score: match.score, winner_index: match.winner });
      var sets = !sparts ? {} : sparts.map(s=> {
         // TODO: supertiebreak is a hack until courthive.com/tournaments is updated
         if (s[0].supertiebreak) return { games: [s[0].supertiebreak, s[1].supertiebreak] };

         let score = { games: [s[0].games, s[1].games]};
         // courthive.com/tournaments expects tiebreak attribute only when tiebreak occurred
         if (s[0].tiebreak || s[1].tiebreak) score.tiebreak = [s[0].tiebreak, s[1].tiebreak];
         return score;
      });

      if (match.winner != undefined && sparts.length == 1 && sparts.outcome == 'Walkover') {
         sets[0].games[match.winner] = sparts.outcome;
         sets[0].games[1 - match.winner] = '';
      }

      var score = {
         components: { sets },
         points: ''
      };

      let playerName = (player) => 
            ({ 
               lname: stringFx.normalizeName(player.last_name, false),
               fname: stringFx.normalizeName(player.first_name, false),
               name: stringFx.normalizeName(`${player.first_name} ${player.last_name}`, false),
               ioc: player.ioc
            });

      let teams = match.team_players.map(team => team.map(i => playerName(match.players[i])));

      var match_message = {
         match: {
            muid: match.muid,
            date: match.date
         },
         tournament: {
            name: match.tournament.name,
            tuid: match.tournament.tuid,
            category: match.tournament.category,
            // TODO: clear this up... scheduled matches and completed matches are different
            round: match.round_name || match.round
         }, 
         status: match.winner != undefined ? 'Finished' : 'Scheduled',
         players: match.players.map(playerName),
         teams,
         score, 
         point: {},
         serving: -1, 
         complete: match.complete, 
         winner: match.winner_index != undefined ? match.winner_index : match.winner, 
         edit: false,
         geoposition: {
            latitude: coords.latitude,
            longitude: coords.longitude
         },
         undo: false
      };

      return match_message;
   };

   function receiveTournamentEvents(data) {
      let updated = false;
      let tuid = data.tuid;
      if (!data.events || !data.events.length) {
         let action = lang.tr('actions.ok');
         let message = ` <h2 class='title is-4'>${lang.tr('phrases.notfound')}</h2> `;
         displayGen.escapeModal();
         displayGen.actionMessage({ message, actionFx: () => displayGen.closeModal(), action });
         return;
      }
      let events = data.events && data.events.map(e => CircularJSON.parse(e));
      let received_euids = events && events.map(e=>e.event.euid);
      let received = events && Object.assign({}, ...events.map(e=>({[e.event.euid]: e})));
      if (events) db.findTournament(tuid).then(trny => confirmMerge(trny), util.logError);

      function confirmMerge(trny) {

         let action = lang.tr('merge');
         let message = ` <h2 class="title is-3">${lang.tr('events.received')}</h2> `;

         displayGen.escapeModal();
         displayGen.actionMessage({ message, actionFx, action, cancelAction: () => displayGen.closeModal() });

         function actionFx() {
            if (!trny.events) trny.events = [];
            let existing_euids = trny.events.map(e=>e.euid);
            let new_euids = received_euids.filter(e=>existing_euids.indexOf(e)<0);
            util.addDev({events});
            trny.events.forEach(e => {
               if (received[e.euid]) {
                  Object.assign(e, received[e.euid].event);
                  e.draw = received[e.euid].draw;
                  updated = true;
               }
            });
            new_euids.forEach(euid => {
               let evnt = received[euid].event;
               evnt.draw = received[euid].draw;
               trny.events.push(evnt);
               updated = true;
            });

            // if events were added update status for local download icon...
            if (updated && trny.saved_locally) trny.saved_locally = false;

            db.addTournament(trny).then(() => tournamentDisplay.displayTournament({ tuid, editing: true }), util.logError);
            displayGen.closeModal();
         }
      }
   }

   return fx;
}();
