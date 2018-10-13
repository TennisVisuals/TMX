import { db } from './db'
import { env } from './env'
import { sharedFx } from './sharedFx';
import { lang } from './translator';
import { displayGen } from './displayGen';

let funcs = {
   tmxMessage: () => console.log('tmxMessage'),
   receiveEvent: () => console.log('receiveEvent'),
   processDirective: () => console.log('process directive'),
   receiveIdiomList: () => console.log('receive Idiom List'),
   receiveTournament: () => console.log('receive Tournament'),
   receiveTournaments: () => console.log('receive Tournaments.'),
   receiveTournamentEvents: () => console.log('receive Tournament Events'),
   receiveTournamentRecord: () => console.log('receive Tournament Record'),
}

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

   mod.setFx = (func, fx) => { funcs[func] = fx; }

   mod.fx = funcs;

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

   mod.notShared = (err) => {
      mod.emitTmx({ 
         event: 'Connection',
         notice: `lat/lng: Geolocation Not Shared`,
         latitude: '0.00',
         longitude: '0.00',
         version: env.version
      });
   }

   mod.connectAction = () => {
      let options = { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 };

      if (navigator && navigator.permissions && navigator.permissions.query) {
         navigator
            .permissions.query({ name: 'geolocation' })
            .then(function(result) {
               if (result.state == 'granted' && window.navigator.onLine) {
                  navigator.geolocation.getCurrentPosition(mod.locationShared, mod.notShared, options);
               } else {
                  mod.emitTmx({ notice: 'Connection', client: 'tmx', version: env.version });
               }
             }, (err) => console.log('error:', err));
      }
   }

   mod.locationShared = (pos) => {
      env.locations.geoposition = pos;
      mod.emitTmx({ 
         event: 'Geoposition',
         notice: `lat/lng: ${pos.coords.latitude}, ${pos.coords.longitude}`,
         latitude: pos.coords.latitude,
         longitude: pos.coords.longitude,
         version: env.version
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
         oi.socket.on('tmx tournament events', mod.fx.receiveTournamentEvents);
         oi.socket.on('tmx_event', e => mod.fx.receiveEvent(e, true));
         oi.socket.on('noauth_event', e => mod.fx.receiveEvent(e, false));
         oi.socket.on('idioms available', mod.fx.receiveIdiomList);
         oi.socket.on('auth_org_trnys', t => mod.fx.receiveTournaments(t, true));
         oi.socket.on('noauth_org_trnys', mod.fx.receiveTournaments);

         oi.socket.on('match score', data => sharedFx.receiveScore(data));
         oi.socket.on('crowd score', data => console.log('crowd score:', data));
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

   mod.joinTournament = (tuid, authorized) => connected ?  oi.socket.emit('join tournament', tuid) : false;
   mod.leaveTournament = (tuid, authorized) => connected ?  oi.socket.emit('leave tournament', tuid) : false;

   function tmxError(err) {
      let error = err.phrase ? lang.tr(`phrases.${err.phrase}`) : err.error;
      if (err.error) {
         let message = `${lang.tr('phrases.servererror')}<p>${error}`;
         let container = displayGen.popUpMessage(`<div style='margin-left: 2em; margin-right: 2em;'>${message}</div>`);
      }
   }

   function tmxDelegation(msg) {
      if (msg && msg.keyset != undefined && coms.delegated && typeof coms.delegated == 'function') coms.delegated(msg);
      if (msg && msg.revoked != undefined && coms.revoked && typeof coms.revoked == 'function') coms.revoked(msg);
   }

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
         let getTrnyEvents = { tuid };
         mod.emitTmx({getTrnyEvents});

         // oi.socket.emit('tmx trny evts', { tuid, authorized: true });
      } else {
         let message = `Offline: must be connected to internet`;
         let container = displayGen.popUpMessage(`<div style='margin-left: 2em; margin-right: 2em;'>${message}</div>`);
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
         let container = displayGen.popUpMessage(`<div style='margin-left: 2em; margin-right: 2em;'>${message}</div>`);
      }
   }

   mod.emitTmx = (data) => {
      Object.assign(data, { timestamp: new Date().getTime(), uuuid: env.uuuid });
      if (connected) {
         oi.socket.emit('tmx', data);
      } else {
         queue.push({ header: 'tmx', data });
      }
   }

   return mod;

}();
