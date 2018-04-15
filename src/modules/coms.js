import { db } from './db'
import { lang } from './translator';

export const coms = function() {

   let mod = {};
   var ackRequests = {};

   let oi = {
      socket: undefined,
      connectionOptions:  {
         "force new connection" : true,
         "reconnectionDelay" : 1000,
         "reconnectionAttempts": "Infinity",
         "timeout" : 20000,
      },
   }

   mod.fx = {
      tmxMessage: () => console.log('tmxMessage'),
      receiveEvent: () => console.log('receiveEvent'),
      popUpMessage: () => console.log('pop up message'),
      processDirective: () => console.log('process directive'),
      receiveIdiomList: () => console.log('receive Idiom List'),
      receiveTournament: () => console.log('receive Tournament'),
      receiveTournamentRecord: () => console.log('receive Tournament Record'),
   }

   let queue = [];
   let connected = false;

   mod.connected = () => connected;
   function comsConnect() {
      console.log('connected');
      connected = true;
      while (queue.length) {
         let message = queue.pop();
         oi.socket.emit(message.header, message.data);
      }
   };
   function comsDisconnect() {
      console.log('disconnect');
      connected = false;
   };
   function comsError(err) { };

   mod.versionNotice = (version) => {
      db.findSetting('superUser').then(setting => {
         if (setting && setting.auth && util.string2boolean(setting.auth.versioning)) {
            coms.emitTmx({ updateVersion: { version, client: 'tmx', notice: `Version ${version} available` } });
         }
      });
   }

   mod.connectSocket = () => {
      // if (navigator.onLine && !oi.socket) {   
      if (!oi.socket) {   
         oi.socket = io.connect('/match', oi.connectionOptions);
         oi.socket.on('ack', receiveAcknowledgement);
         oi.socket.on('connect', comsConnect);                                 
         oi.socket.on('disconnect', comsDisconnect);
         oi.socket.on('connect_error', comsError);
         oi.socket.on('tmx directive', mod.fx.processDirective);
         oi.socket.on('tmx error', tmxError);
         oi.socket.on('tmx message', mod.fx.tmxMessage);
         oi.socket.on('tmx delegation', tmxDelegation);
         oi.socket.on('tourny record', record => mod.fx.receiveTournament({ record, authorized: true }));
         oi.socket.on('tournament record', mod.fx.receiveTournamentRecord);
         oi.socket.on('tmx tournament events', receiveTournamentEvents);
         oi.socket.on('tmx_event', e => mod.fx.receiveEvent(e, true));
         oi.socket.on('noauth_event', e => mod.fx.receiveEvent(e, false));
         oi.socket.on('idioms available', mod.fx.receiveIdiomList);
      }
   } 

   function receiveAcknowledgement(msg) {
      if (msg.uuid && ackRequests[msg.uuid]) {
         ackRequests[msg.uuid](msg);
         delete ackRequests[msg.uuid];
      }
   }

   mod.requestAcknowledgement = ({ uuid, callback }) => {
      ackRequests[uuid] = callback;
   }

   function tmxError(err) {
      let error = err.phrase ? lang.tr(`phrases.${err.phrase}`) : err.error;
      if (err.error) {
         let message = `${lang.tr('phrases.servererror')}<p>${error}`;
         let container = mod.fx.popUpMessage(`<div style='margin-left: 2em; margin-right: 2em;'>${message}</div>`);
      }
   }

   function tmxDelegation(msg) {
      if (msg && msg.keyset != undefined && coms.delegated && typeof coms.delegated == 'function') coms.delegated(msg);
      if (msg && msg.revoked != undefined && coms.revoked && typeof coms.revoked == 'function') coms.revoked(msg);
   }

   // TODO: change this so that server collects array of events instead of requesting one by one!
   function receiveTournamentEvents(list) { list.forEach(item => oi.socket.emit(item.authorized ? 'tmx_event' : 'noauth_event', item.euid)); }

   mod.sendKey = (key) => { mod.emitTmx({ key }); }

   mod.deleteMatch = (data) => {
      if (!data || !data.muid || !data.tuid) return;
      if (connected) {
         oi.socket.emit('delete match', data);
      } else {
         queue.push({ header: 'delete match', data });
      }
   }

   mod.requestTournamentEvents = (tuid) => {
      if (connected) {
         console.log('requesting trny evts');
         oi.socket.emit('tmx trny evts', { tuid, authorized: true });
      } else {
         let message = `Offline: must be connected to internet`;
         let container = mod.fx.popUpMessage(`<div style='margin-left: 2em; margin-right: 2em;'>${message}</div>`);
      }
   }

   mod.requestTournament = (tuid) => {
      if (connected) {
         db.findSetting('userUUID').then(sendRequest);
         function sendRequest(uuuid) {
            let data = { tuid, timestamp: new Date().getTime(), uuuid: uuuid ? uuuid.value : undefined };
            oi.socket.emit('tmx tourny', data);
         }
      } else {
         let message = `Offline: must be connected to internet`;
         let container = mod.fx.popUpMessage(`<div style='margin-left: 2em; margin-right: 2em;'>${message}</div>`);
      }
   }

   mod.emitTmx = (data) => {
      // TODO: keep this in o so db call unnecessary...?
      db.findSetting('userUUID').then(sendTMX, err => console.log('error:', err));

      function sendTMX(uuuid) {
         Object.assign(data, { timestamp: new Date().getTime(), uuuid: uuuid ? uuuid.value : undefined });
         if (connected) {
            oi.socket.emit('tmx', data);
         } else {
            // TODO: make this a persistent que in db...
            queue.push({ header: 'tmx', data });
         }
      }
   }

   return mod;

}();
