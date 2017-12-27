let coms = function() {

   let fx = {
      update: undefined,
      messages: [],
   };

   let oi = {
      socket: undefined,
      connectionOptions:  {
         "force new connection" : true,
         "reconnectionDelay" : 1000,
         "reconnectionAttempts": "Infinity",
         "timeout" : 20000,
      },
   }

   let o = {
      errors: false,
   }

   let queue = [];
   let connected = false;

   function comsConnect() {  
      connected = true;
      if (queue.length) queue.forEach(message => oi.socket.emit(message.header, message.data));
   };
   function comsDisconnect() {  };
   function comsError(err) {  };
   function tmxDirective(data) {
      let json_data = attemptJSONparse(data);
      if (json_data) processDirective(json_data); 
   };
   function processDirective(data) {
      if (data.directive) {
         if (data.directive == 'settings') {
            config.updateSettings(data.content).then(() => { location.reload(true); });
         }
         if (data.directive == 'authorize') {
            let authorize = { content: data.content };
            fx.emitTmx({ authorize });
         }
         if (data.directive == 'new version') {
            gen.homeIconState('update');
            fx.update = data.notice || 'New Version Available';
         }
         if (data.directive == 'load data' && data.content) {
            load.loadJSON(data.content);
         }
      }
   }

   fx.versionNotice = (version) => {
      db.findSetting('superUser').then(setting => {
         if (setting && setting.auth && util.string2boolean(setting.auth.versioning)) {
            coms.emitTmx({ updateVersion: { version, notice: `Version ${version} available` } })
         }
      });
   }

   fx.connectSocket = () => {
      // if (config.env().broadcast && navigator.onLine && !oi.socket) {   
      if (config.env().broadcast && !oi.socket) {   
         oi.socket = io.connect('/match', oi.connectionOptions);
         oi.socket.on('connect', comsConnect);                                 
         oi.socket.on('disconnect', comsDisconnect);
         oi.socket.on('connect_error', comsError);
         oi.socket.on('tmx directive', tmxDirective);
         oi.socket.on('tmx error', tmxError);
         oi.socket.on('tmx message', tmxMessage);
         oi.socket.on('tourny record', receiveTournament);
      }
   } 

   function tmxError(err) {
      if (err.error) {
         let message = `Error Message from Server<p>${err.error}`;
         let container = gen.popUpMessage(`<div style='margin-left: 2em; margin-right: 2em;'>${message}</div>`);
      }
   }

   function tmxMessage(msg) { config.addMessage(msg); }

   function receiveTournament(record) {
      let published_tournament = CircularJSON.parse(record);
      let message = `
         <p>Received Tournament Record</p>
         <p>Publish Time:<br>${new Date(published_tournament.published).toGMTString()}</p>
         <p>Replace Local Copy?</p>
      `;
      let msg = gen.okCancelMessage(message, saveTournament, () => gen.closeModal());
      function saveTournament() {
         db.addTournament(published_tournament);
         tournaments.displayTournament({tuid: published_tournament.tuid});
         gen.closeModal();
      }
   }

   fx.sendKey = (key) => {
      fx.emitTmx({ key });
   }

   fx.endBroadcast = () => { config.env().broadcast = false; }

   fx.broadcasting = () => {
      if (config.env().broadcast && oi.socket) return true;
      // if (config.env().broadcast && !oi.socket && navigator.onLine) { connectSocket(); }
      if (config.env().broadcast && !oi.socket) { connectSocket(); }
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

   fx.broadcastEvent = (ebo) => {
      let eventCircular = CircularJSON.stringify(ebo);
      fx.emitTmx({ eventCircular });
   }

   // todo: convert this to use emitTmx (to take advantage of queue
   fx.deleteEvent = (deleteRequest) => {
      if (!deleteRequest || !deleteRequest.euid) return;
      fx.emitTmx({deleteRequest});
   }

   fx.deleteMatch = (data) => {
      if (!data || !data.muid || !data.tuid) return;
      if (connected) {
         oi.socket.emit('delete match', data);
      } else {
         queue.push({ header: 'delete match', data });
      }
   }

   fx.requestTournament = (tuid) => {
      if (connected) {
         oi.socket.emit('tmx tourny', { tuid, authorized: true });
      } else {
         let message = `Offline: must be connected to internet`;
         let container = gen.popUpMessage(`<div style='margin-left: 2em; margin-right: 2em;'>${message}</div>`);
      }
   }

   fx.emitTmx = (data) => {
      // TODO: keep this in o so db call unnecessary...?
      db.findSetting('userUUID').then(sendTMX);

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

   // AJAX REQUESTS ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

   fx.ajax = (url, request, type, callback) => {
      var type = type || "GET";
      if (['GET', 'POST'].indexOf(type) < 0) return false;
      if (typeof callback != 'function') return false;

      var remote = new XMLHttpRequest();
      remote.onreadystatechange = function() {
         if (remote.readyState == 4 && remote.status == 0) callback({ err: lang.tr('phrases.noconnection') });
      };
      remote.open(type, url, true);
      remote.setRequestHeader("Content-Type", "application/json");
      remote.onload = function() { 

         let result = JSON.parse(remote.responseText);
         let data = result.data ? result.data.split('').filter(f=>f.charCodeAt() > 13).join('') : undefined;
         let json_data = attemptJSONparse(data);
         if (!json_data) console.log('request failed:', request);

         callback({ json: json_data } || result); 
      }
      remote.send(request);
      return true;
   }

   function attemptJSONparse(data) {
      if (!data) return undefined;
      try {
         return JSON.parse(data);
      }

      catch(e) {
         return undefined;
      }
   }

   fx.fetchJSON = (url) => {
      return new Promise((resolve, reject) => {
            let request_object = { url: url };
            let request = JSON.stringify(request_object);

            function responseHandler(result) {
               if (result.json) {
                  resolve(result.json);
               } else {
                  return reject(result.err || 'Error');
               }
            }
            fx.ajax('/api/match/request', request, 'POST', responseHandler);
      });
   }

   function updatePlayerDates() {
      console.log('updating player dates');
      fetchPlayerDates().then(processDates, (err) => console.log(err));

      function processDates(update_object) {
         db.db.players.toCollection().modify(player => {
            if (update_object[player.id]) {
               player.right_to_play_until = new Date(update_object[player.id].rtp).getTime();
               player.registered_until = new Date(update_object[player.id].r).getTime();
            }
         });
      }
   }

   fx.fetchPlayerDates = fetchPlayerDates;
   function fetchPlayerDates() {
      return new Promise((resolve, reject) => {
         db.findSetting('fetchPlayerDates').then(fetchNew, reject);

         function fetchNew(params) {
            if (!params) {
               return reject('No Parameters. ' +  lang.tr('phrases.notconfigured'));
            }

            let request_object = { [params.type]: params.url };
            let request = JSON.stringify(request_object);

            function responseHandler(result) {
               if (result.json) {
                  resolve(result.json);
               } else {
                  return reject(result.err || 'Error');
               }
            }
            fx.ajax('/api/match/request', request, 'POST', responseHandler);
         }
      });
   }

   fx.fetchNewClubs = fetchNewClubs;
   function fetchNewClubs() {
      return new Promise((resolve, reject) => {
         db.findSetting('fetchClubs').then(checkSettings, reject);

         function checkSettings(params) {
            if (!params) return reject({ error: lang.tr('phrases.notconfigured') });
            db.findAllClubs().then(clbz => fetchNew(clbz, params));
         }

         function fetchNew(clbz, params) {
            let cids = clbz.map(c=>+c.id);
            let max_id = Math.max(0, ...clbz.map(c=>!isNaN(+c.id) ? +c.id : 0));

            // 'fetchNewClubs'
            // let request_object = { [params.type]: params.url + max_id };

            let request_object = { [params.type]: params.url };
            let request = JSON.stringify(request_object);

            function responseHandler(result) {
               if (result.json) {
                  let new_clubs = result.json.filter(f=>cids.indexOf(+f.id) < 0);
                  resolve(result.json);
               } else {
                  return reject(result.err || 'Error');
               }
            }
            fx.ajax('/api/match/request', request, 'POST', responseHandler);
         }
      });
   }

   fx.fetchNewTournaments = fetchNewTournaments;
   function fetchNewTournaments() {
      return new Promise((resolve, reject) => {
         db.findSetting('fetchNewTournaments').then(checkSettings, reject);

         function checkSettings(params) {
            if (!params) return reject({ error: lang.tr('phrases.notconfigured') });
            db.findAllTournaments().then(trnys => fetchNew(trnys, params));
         }

         function fetchNew(trnys, params) {

            // for tournaments to be updated automatically they must have an .sid attribute equal to config.env().org.abbr
            let tids = trnys.filter(t=>t.sid && t.sid == config.env().org.abbr).map(t=>t.tuid.replace(t.sid, ''));
            let max_id = Math.max(...tids, 0);

            let request_object = { [params.type]: params.url + max_id };
            let request = JSON.stringify(request_object);
            function responseHandler(result) {
               if (result.json) {
                  normalizeTournaments(result.json);
               } else {
                  return reject(result.err || 'Error');
               }
            }
            fx.ajax('/api/match/request', request, 'POST', responseHandler);
         }

         function normalizeTournaments(trnys) {
            trnys.forEach(t => {
               t.start = new Date(t.start).getTime();
               t.end = new Date(t.end).getTime();

               // TODO: This needs to be a configured SID (Site ID?) and not config.env().org (HTS)
               t.tuid = `${config.env().org.abbr}${t.tuid}`;
            });
            resolve(trnys);
         }

      });
   }

   fx.fetchNewPlayers = fetchNewPlayers;
   function fetchNewPlayers() {
      return new Promise((resolve, reject) => {
         db.findSetting('fetchNewPlayers').then(checkSettings, reject);

         function checkSettings(params) {
            if (!params) return reject({ error: lang.tr('phrases.notconfigured') });
            db.findAllPlayers().then(plyrz => fetchNew(plyrz, params));
         }

         function fetchNew(plyrz, params) {

            // maximum player record determined by numeric ids; others excluded
            let max_id = Math.max(0, ...plyrz.map(p=>!isNaN(+p.id) ? +p.id : 0));
            let request_object = { [params.type]: params.url + max_id };
            let request = JSON.stringify(request_object);
            function responseHandler(result) {
               if (result.json) {
                  let players = result.json.filter(p=>p.first_name && p.last_name);
                  normalizePlayers(players);

                  if (max_id) updatePlayerDates();
               } else {
                  return reject(result.err || 'Error');
               }
            }
            fx.ajax('/api/match/request', request, 'POST', responseHandler);
         }

         function normalizePlayers(players) {
            players.forEach(player => {
               let rtp_date = new Date(player.right_to_play_until);
               player.right_to_play_until = (rtp_date != 'Invalid Date') ? rtp_date.getTime() : undefined;
               let ru_date = new Date(player.registered_until);
               player.registered_until = (ru_date != 'Invalid Date') ? ru_date.getTime() : undefined;
               let birth_date = new Date(player.birth);
               player.birth = (birth_date != 'Invalid Date') ? birth_date.getTime() : undefined;
               let name = (player.first_name + player.last_name).trim();
               player.hash = util.nameHash(name);
               player.foreign = player.foreign != 'N';
               player.ioc = !player.ioc && !player.foreign ? 'CRO' : undefined;
               player.represents_ioc = player.represents_ioc != 'N';
               player.residence_permit = player.residence_permit != 'N';
               player.last_name = util.normalizeName(player.last_name, false).trim();
               player.first_name = util.normalizeName(player.first_name, false).trim();
               player.puid = `${player.foreign ? 'INO' : 'CRO'}-${player.cropin}`;
            });

            resolve(players);
         }

      });
   }

   function notify(failures) {
      console.log('failure to update rank lists');
      return;
      // shouldn't be trying to update rank lists if there is no URL for updating!!

      /*
      let failed_lists = failures.filter(f=>f).map(f=>f.listname).join(', ');
      // TODO: add to idioms
      let message = `Out-of-date Rank Lists: ${failed_lists}<p>Must be online to update`;
      let container = gen.popUpMessage(`<div style='margin-left: 2em; margin-right: 2em;'>${message}</div>`);
      */
   }

   fx.fetchRankLists = fetchRankLists;
   function fetchRankLists(categories) {
      return new Promise((resolve, reject) => {
         Promise.all(categories.map(c=>fetchRankList(c, true))).then(rankObj, rankErr)

         function rankErr(err) {
            let message = `<div style='margin: 1em;'>lang.tr('phrases.notconfigured')</div><div style='margin: 1em;'>Cannot Fetch Rank Lists</div>`;
            if (o.errors) gen.popUpMessage(message);
            reject();
         }

         function rankObj(rankings) {
            let failures = rankings.filter(f=>!f.valid);
            if (failures.length) notify(failures);
            let obj = Object.assign({}, ...rankings.filter(f=>f.valid).map(r => { return { [r.rankings.category]: r }}));
            resolve(obj);
         }
      });
   }

   fx.fetchRankList = fetchRankList;
   function fetchRankList(category, suppress_notice) {
      return new Promise((resolve, reject) => {
         db.findRankings(category).then(checkRankings, err => reject({ error: err }));

         function checkRankings(rankings) {
            let today = new Date();
            let rankings_date = rankings ? new Date(rankings.date) : undefined;
            if (!rankings || today.getMonth() != rankings_date.getMonth() || today.getFullYear() != rankings_date.getFullYear()) {
               if (navigator.onLine) {
                  db.findSetting('fetchRankList').then(checkSettings, reject);
               } else {
                  if (!suppress_notice) { 
                     // TODO: This is supposed to be a notice that rank list is out of date
                     console.log([listname]); 
                  }
                  resolve({ listname: category, valid: false, rankings });
               }
            } else {
               resolve({ valid: true, rankings });
            }
         }

         function checkSettings(params) {
            if (!params || !params.url) return reject({ error: lang.tr('phrases.notconfigured') });
            fetchList(params);
         }

         function fetchList(params) {
            // Legacy to avoid call when no list is available
            if (config.env().org.abbr == 'HTS' && category == '10') return reject();
            
            let request_object = { [params.type]: params.url + category };
            let request = JSON.stringify(request_object);
            function responseHandler(data) {
               if (data && data.json && Array.isArray(data.json)) {
                  let player_rankings = Object.assign({}, ...data.json.map(r => { return { [r.id]: r }}));
                  let rankings = { category, players: player_rankings, date: new Date().getTime() };
                  db.addCategoryRankings(rankings).then(() => resolve({ valid: true, rankings }), err => reject({ error: err }));
               } else {
                  return reject({ error: 'Error' });
               }
            }
            fx.ajax('/api/match/request', request, 'POST', responseHandler);
         }
      });
   }

   fx.fetchRegisteredPlayers = fetchRegisteredPlayers;
   function fetchRegisteredPlayers(tuid, category, remote_request) {
      return new Promise((resolve, reject) => {
         if (!tuid) return reject('No Tournament ID');

         let id = tuid;

         // TODO: remove specific requests to HTS
         if (tuid.indexOf('HTS') == 0) {
            let nums = tuid.match(/\d+/);
            if (!nums.length) return reject('No Tournament ID');
            id = nums[0];
         } else {
            gen.popUpMessage(`<div>${lang.tr('phrases.locallycreated')}</div><p><i>${lang.tr('phrases.noremote')}</i>`, () => resolve({}));
            return;
         }

         if (navigator.onLine && remote_request) {
            db.findSetting('fetchRegisteredPlayers').then(checkSettings, reject);
         } else {
            return localRequest();
         }

         function localRequest() {
            db.findTournament(tuid).then(checkTournament, reject); 

            function checkTournament(tournament) {
               if (tournament.players) {
                  return resolve(tournament.players);
               } else {
                  return resolve([]);
               }
            }
         }

         function checkSettings(params) {
            if (!params) return reject({ error: lang.tr('phrases.notconfigured') });
            remoteRequest(params);
         }

         function remoteRequest(params) {
            let request_object = { [params.type]: params.url + id };
            let request = JSON.stringify(request_object);

            function responseHandler(result) {
               if (result.json) {
                  let players = result.json.filter(p=>p.last_name);
                  players.forEach(player => {
                     player.first_name = player.first_name.trim();
                     player.last_name = player.last_name.trim();
                     player.full_name = `${player.last_name.toUpperCase()}, ${util.normalizeName(player.first_name, false)}`;

                     if (category) {
                        // player.rankings, if present, are used before player.rank
                        if (!player.rankings) player.rankings = {};
                        player.rankings[category] = +player.rank || undefined;
                     }

                     player.rank = +player.rank || undefined;
                  });
                  Promise.all(players.map(player => {
                     if (player.id) {
                        return db.findPlayerById(player.id);
                     } else {
                        console.log('did not find player by id');
                        return {};
                     }
                  })).then(dbplayers => updateLocal(dbplayers, players), reject);
               } else {
                  return reject(result.err || 'Error');
               }
            }
            fx.ajax('/api/match/request', request, 'POST', responseHandler);
         }

         function updateLocal(dbplayers, players) {

            // update players with info from database
            players.forEach((player, i) => {
               if (dbplayers[i]) {
                  player.puid = dbplayers[i].puid;
                  player.ioc = dbplayers[i].ioc;
                  if (!player.ioc && player.country && player.country.length == 3) player.ioc = player.country;
               } else {
                  if (player.country && player.country.length == 3) player.ioc = player.country;
                  if (!player.puid) player.puid = `${player.id}${player.country || ''}${player.birth}`;
               }
            });
            resolve(players);
            // db.db.tournaments.where('tuid').equals(tuid).modify(tournament => tournament.registered = players).then(() => resolve(players), reject);
         }
      });
   }

   fx.fileNotRecognized = () => {
      let message = `File Not Recognized`;
      let container = gen.popUpMessage(`<div style='margin-left: 2em; margin-right: 2em;'>${message}</div>`);
   }

   fx.loadGoogleMaps = loadGoogleMaps;
   function loadGoogleMaps() {
      var GOOGLE_MAP_KEY = "AIzaSyDeS_V8UElYwr-pnj2HZMe-Qt46HyGnjIA";
      var script = document.createElement('script');
      script.type = 'text/javascript';
      script.src = 'https://maps.googleapis.com/maps/api/js?v=3' +
          '&key=' + GOOGLE_MAP_KEY;
      document.body.appendChild(script);
   }

   return fx;

}();
