import { db } from './db'
import { util } from './util';
import { coms } from './coms';
import { config } from './config';
import { lang } from './translator';
import { importFx } from './importFx';
import { displayGen } from './displayGen';
import { tournamentDisplay } from './tournamentDisplay';

export const staging = function() {

   var received_events = [];

   let fx = {};

   fx.init = () => {
      coms.fx.processDirective = processDirective;
      coms.fx.receiveTournament = receiveTournament;
      coms.fx.receiveTournamentRecord = receiveTournamentRecord;
      coms.fx.receiveIdiomList = receiveIdiomList;
      coms.fx.tmxMessage = tmxMessage;
      coms.fx.receiveEvent = receiveEvent;
   }

   function resetDB() {
      return new Promise((resolve, reject) => {
         let reload = () => window.location.replace(window.location.pathname);
         let okAction = () => db.resetDB(reload);
         let cancelAction = () => {
            clearHistory(); 
            displayGen.closeModal(); 
            resolve();
         }
         let message = `<div style='margin: 1em;'><h2>${lang.tr('warn')}:</h2><p>${lang.tr('phrases.reset')}</div>`;
         let container = displayGen.okCancelMessage(message, okAction, cancelAction);
      });
   }

   function processDirective(data) {
      let json_data = attemptJSONparse(data);

      if (json_data && json_data.directive) {
         if (json_data.directive == 'settings') {
            config.receiveSettings(json_data);
         }
         if (json_data.directive == 'new version') {
            displayGen.homeIconState('update');
            messaging.update = json_data.notice || lang.tr('newversion');
         }
         if (json_data.directive == 'load data' && json_data.content) { importFx.loadJSON(json_data.content); }
         if (json_data.directive == 'reset db' && json_data.content) { resetDB(); }
         if (json_data.directive == 'clear settings' && json_data.content) { db.db.settings.toCollection().delete(); }
         if (json_data.directive == 'add idiom' && json_data.content) {
            lang.define(json_data.content);
            db.addIdiom(json_data.content).then(setIdiom, error => console.log('error:', error));
            function setIdiom() {
               config.idiomSelectorOptions(json_data.content.ioc);
               config.changeIdiom(json_data.content.ioc);
            }
         }
      }
   }

   fx.receiveTournamentRecord = receiveTournamentRecord;

   // incoming data is already properly formatted object for passing on to receiveTournament()
   function receiveTournamentRecord(data) { receiveTournament(data); }

   function receiveTournament({ record, authorized }) {
      let published_tournament = CircularJSON.parse(record);
      let auth_message = authorized ? `<span style='color: green'>${lang.tr('tournaments.auth')}</span>` : lang.tr('tournaments.noauth');
      let message = `
         <h2>${lang.tr('tournaments.received')}</h2>
         ${published_tournament.name}
         <p><b>${lang.tr('tournaments.publishtime')}:</b><br>${new Date(published_tournament.published).toGMTString()}</p>
         ${auth_message}
         <p><b>${lang.tr('tournaments.replacelocal')}</b></p>
      `;
      let cancelAction = () => displayGen.closeModal();
      let msg = displayGen.actionMessage({ message, actionFx: saveReceivedTournament, action: lang.tr('replace'), cancelAction });
      function saveReceivedTournament() {
         displayGen.closeModal();
         published_tournament.received = new Date().getTime();
         db.addTournament(published_tournament).then(displayTournament, util.logError);
      }
      function displayTournament() { tournamentDisplay.displayTournament({tuid: published_tournament.tuid}); }
   }

   function tmxMessage(msg) {
      if (msg.authorized && msg.tuid) {
         config.authMessage(msg);
      } else {
         config.addMessage(msg);
      }
   }

   // currently duplicated in staging and coms
   function attemptJSONparse(data) {
      if (!data) return undefined;
      try { return CircularJSON.parse(data); }
      catch(e) { return undefined; }
   }

   fx.receiveIdiomList = receiveIdiomList;
   function receiveIdiomList(data) {
      config.available_idioms = Object.assign({}, ...data.map(attemptJSONparse).filter(f=>f).map(i=>({[i.ioc]: i})));

      // set timeout to give first-time initialization a chance to load default language file
      setTimeout(function() { db.findSetting('defaultIdiom').then(findIdiom, (error) => console.log('error:', error)); }, 2000);

      function findIdiom(idiom) { db.findIdiom(idiom.ioc).then(checkIdiom, error=>console.log('error:', error)); }
      function checkIdiom(idiom={ ioc: 'gbr', name: 'English' }) {
         config.idiomSelectorOptions(idiom.ioc);
         let a = config.available_idioms[idiom.ioc];
         if (a && a.updated != idiom.updated) {
            displayGen.escapeModal();
            let message = `${lang.tr('phrases.updatedioc')}: ${idiom.name || idiom.ioc}?`;
            displayGen.okCancelMessage(message, updateLanguageFile, () => displayGen.closeModal());
         }
         function updateLanguageFile() {
            coms.sendKey(`${idiom.ioc}.idiom`);
            displayGen.closeModal();
         }
      }
   }

   fx.endBroadcast = () => { config.env().broadcast = false; }
   fx.broadcasting = () => {
      if (config.env().broadcast && coms.connected()) return true;
      // if (config.env().broadcast && !coms.connected() && navigator.onLine) { connectSocket(); }
      if (config.env().broadcast && !coms.connected) { connectSocket(); }
      return false;
   }

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
         points: '',
      }

      let playerName = (player) => 
            ({ 
               lname: util.normalizeName(player.last_name, false),
               fname: util.normalizeName(player.first_name, false),
               name: util.normalizeName(`${player.first_name} ${player.last_name}`, false),
               ioc: player.ioc,
            });

      let teams = match.team_players.map(team => team.map(i => playerName(match.players[i])));

      var match_message = {
         match: {
            muid: match.muid,
            date: match.date,
         },
         tournament: {
            name: match.tournament.name,
            tuid: match.tournament.tuid,
            category: match.tournament.category,
            // TODO: clear this up... scheduled matches and completed matches are different
            round: match.round_name || match.round,
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
            longitude: coords.longitude,
         },
         undo: false,
      }

      return match_message;
   }

   var receive_modal = false;
   function receiveEvent(e, authorized) {
      let revt = attemptJSONparse(e);
      let existing = received_events.map(r=>r.revt.event.euid);
      if (revt && existing.indexOf(revt.event.euid) < 0) received_events.push({ revt, authorized });
      if (!receive_modal && received_events.length) mergeReceivedEvent();
   }

   function mergeReceivedEvent() {
      receive_modal = true;

      let { revt, authorized } = received_events.pop();
      db.findTournament(revt.tournament.tuid).then(trny => found(trny, authorized), util.logError);

      var draw_types = {
         'E': lang.tr('draws.elimination'),
         'Q': lang.tr('draws.qualification'),
         'R': lang.tr('draws.roundrobin'),
         'C': lang.tr('draws.consolation'),
      };

      function found(trny, authorized) {
         displayGen.escapeModal(() => receive_modal = false);

         let euids = trny.events.map(e=>e.euid);
         let exists = euids.indexOf(revt.event.euid) >= 0;

         let auth_message = authorized ? `<span style='color: green'>${lang.tr('tournaments.auth')}</span>` : lang.tr('tournaments.noauth');
         let message = `
            <h2>Received Event</h2>
            ${revt.event.name} ${draw_types[revt.event.draw_type]}
            <p>
               <b>${lang.tr('tournaments.publishtime')}:</b>
               <br>${isNaN(revt.event.published) ? '' : new Date(revt.event.published).toGMTString()}
            </p>
            ${auth_message}
         `;

         let action = exists ? lang.tr('replace') : lang.tr('add');
         let msg = displayGen.actionMessage({ message, actionFx, action, cancelAction: finish });

         function actionFx() {
            revt.event.draw = revt.draw;
            if (exists) {
               trny.events = trny.events.map(evt => (evt.euid == revt.event.euid) ? revt.event : evt);
            } else {
               trny.events.push(revt.event);
            }
            db.addTournament(trny);
            finish();
         }

         function finish() {
            receive_modal = false;
            if (received_events.length) {
               mergeReceivedEvent();
            } else {
               displayGen.closeModal();
               tournamentDisplay.displayTournament({ tuid: revt.tournament.tuid });
            }
         }
      }
   }

   return fx;
}();
