import { db } from './db';
import { util } from './util';
import { UUID } from './UUID';
import { config } from './config';
import { lang } from './translator';
import { displayGen } from './displayGen';
import { tournamentDisplay } from './tournamentDisplay';

export const messaging = function() {
   let fx = {
      update: undefined,  // used to store received messages
   }

   // AJAX REQUESTS ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

   function ajax(url, request, type, callback) {
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
         callback( json_data ? { json: json_data } : { result }); 
      }
      remote.send(request);
      return true;
   }

   function attemptJSONparse(data) {
      if (!data) return undefined;
      try { return CircularJSON.parse(data); }
      catch(e) { return undefined; }
   }

   function fetchJSON(url) {
      return new Promise((resolve, reject) => {
            let request_object = { url: url };
            let request = JSON.stringify(request_object);

            function responseHandler(result) {
               if (result.json) {
                  resolve(result.json);
               } else {
                  return reject(result);
               }
            }
            ajax('/api/match/request', request, 'POST', responseHandler);
      });
   }

   function fetchHTML(url) {
      return new Promise((resolve, reject) => {
         fetchJSON(url).then(success, failure);

         function success() {}
         function failure(result) {
            if (!result.result.data) return reject(result);
            var parser = new DOMParser();
            var doc = parser.parseFromString(result.result.data, "text/html");
            resolve(doc);
         }
      });
   }

   fx.fetchTournament = fetchTournament;
   function fetchTournament(merge_with_tuid, coords, modifyTournament) {
      db.findSetting('fetchTournament').then(s => {
         if (s) {
            let fetchFx = s.fx ? util.createFx(s.fx) : undefined;
            if (!fetchFx || typeof fetchFx != 'function') return;

            let obj = displayGen.entryModal('tournaments.id', false, coords);
            displayGen.escapeModal();
            let entry_modal = d3.select(obj.entry_modal.element);
            let removeEntryModal = () => {
               entry_modal.remove();
               document.body.style.overflow = null;
               displayGen.escapeFx = undefined;
            }

            obj.search_field.element.addEventListener("keyup", function(e) { 
               if (e.which == 13) {
                  let id = obj.search_field.element.value;
                  if (id) fetchFx(id, fetchHTML).then(completeFetch, (err)=>{ console.log('invalid', id); console.log('error:', err); });
                  removeEntryModal();
               }
            });

            entry_modal.on('click', removeEntryModal);

         } else {
            console.log('no fx');
         }
      });

      function completeFetch(fetched) {
         let ouid = config.env().org && config.env().org.ouid;
         if (!fetched.ouid) fetched.ouid = ouid;

         // just to be sure... such filtering should be done in injected fx
         let players = fetched.players.filter(p=>p);
         delete fetched.players;

         db.addDev({fetched, players});
         addTournamentPlayers(players).then(addTournament, util.logError);

         function addTournament(players) {
            fetched.players = players; // players have been merged with existing data

            if (merge_with_tuid) {
               db.findTournament(merge_with_tuid).then(existing => mergeTournaments(existing, fetched), util.logError);
            } else {
               db.addTournament(fetched).then(tournamentDisplay.displayCalendar);
            }
         }
      }

      function addTournamentPlayers(players) {
         return new Promise((resolve, reject) => {
            Promise.all(players.map(findPlayer)).then(resolve, reject);
            function findPlayer(player) {
               return new Promise((resolve, reject) => {
                  if (!player.id) {
                     return resolve();
                  } else {
                     player.full_name = `${player.last_name.toUpperCase()}, ${util.normalizeName(player.first_name, false)}`;
                     db.findPlayerById(player.id).then(searchResult, util.logError);
                  }

                  function searchResult(existing) {
                     if (existing) {
                        player = Object.assign(player, existing);
                        resolve(player);
                     } else {
                        player.puid = UUID.generate();

                        let new_player = Object.assign({}, player);
                        delete new_player.registration_time;
                        delete new_player.name;
                        delete new_player.withdrawn;
                        delete new_player.alternate;
                        delete new_player.category_ranking;
                        delete new_player.category_dbls;
                        db.addPlayer(new_player);
                        resolve(player);
                     }
                  }
               });
            }
         });
      }

      function mergeTournaments(existing, fetched) {
         existing.start = Math.min(existing.start, fetched.start);
         existing.end = Math.max(existing.end, fetched.end);
         existing.players = existing.players.concat(...fetched.players);
         db.addTournament(existing).then(() => {
            tournamentDisplay.createNewTournament({ tournament_data: existing, title: lang.tr('actions.edit_tournament'), callback: modifyTournament })
         });
      }
   }

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
            ajax('/api/match/request', request, 'POST', responseHandler);
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
            ajax('/api/match/request', request, 'POST', responseHandler);
         }
      });
   }

   fx.fetchNewTournaments = fetchNewTournaments;
   function fetchNewTournaments(merge) {
      return new Promise((resolve, reject) => {
         db.findSetting('fetchNewTournaments').then(checkSettings, reject);

         function checkSettings(params) {
            if (!params) return reject({ error: lang.tr('phrases.notconfigured') });
            db.findAllTournaments().then(trnys => fetchNew(trnys, params));
         }

         function fetchNew(trnys, params) {

            // for tournaments to be updated automatically they must have an .sid attribute equal to config.env().org.abbr
            let tids = trnys.filter(t=>t.sid && t.sid == config.env().org.abbr).map(t=>t.tuid.replace(t.sid, ''));
            let max_id = (!merge && Math.max(...tids, 0)) || 0;

            let request_object = { [params.type]: params.url + max_id };
            let request = JSON.stringify(request_object);
            function responseHandler(result) {
               if (result.json) {
                  normalizeTournaments(result.json);
               } else {
                  return reject(result.err || 'Error');
               }
            }
            ajax('/api/match/request', request, 'POST', responseHandler);
         }

         function normalizeTournaments(trnys) {
            let ouid = config.env().org && config.env().org.ouid;
            trnys.forEach(t => {
               t.start = new Date(t.start).getTime();
               t.end = new Date(t.end).getTime();
               if (!t.ouid) t.ouid = ouid;

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
            let increment_url = params.increment == 'false' ? false : true;
            let request_url = params.url;
            if (increment_url) request_url += max_id;
            // let request_object = { [params.type]: params.url + max_id };
            let request_object = { [params.type]: request_url };
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
            ajax('/api/match/request', request, 'POST', responseHandler);
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
               // player.foreign = player.foreign != 'N';
               player.ioc = player.ioc || (!player.ioc && !player.foreign ? 'CRO' : undefined);
               // player.represents_ioc = player.represents_ioc != 'N';
               player.residence_permit = player.residence_permit != 'N';
               player.last_name = util.normalizeName(player.last_name, false).trim();
               player.first_name = util.normalizeName(player.first_name, false).trim();
               player.puid = player.puid || `${player.foreign ? 'INO' : 'CRO'}-${player.cropin}`;
            });

            resolve(players);
         }
      });

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
   }

   fx.fetchRankLists = fetchRankLists;
   function fetchRankLists(categories) {
      return new Promise((resolve, reject) => {
         Promise.all(categories.map(c=>fetchRankList(c, true))).then(rankObj, rankErr)

         function rankErr(err) {
            let message = `<div style='margin: 1em;'>lang.tr('phrases.notconfigured')</div><div style='margin: 1em;'>Cannot Fetch Rank Lists</div>`;
            if (messaging.errors) displayGen.popUpMessage(message);
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

   function notify(failures) {
      console.log('failure to update rank lists');
      return;
      // shouldn't be trying to update rank lists if there is no URL for updating!!

      /*
      let failed_lists = failures.filter(f=>f).map(f=>f.listname).join(', ');
      // TODO: add to idioms
      let message = `Out-of-date Rank Lists: ${failed_lists}<p>Must be online to update`;
      let container = displayGen.popUpMessage(`<div style='margin-left: 2em; margin-right: 2em;'>${message}</div>`);
      */
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
                     console.log(category, 'is out of date'); 
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
            ajax('/api/match/request', request, 'POST', responseHandler);
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
            displayGen.popUpMessage(`<div>${lang.tr('phrases.locallycreated')}</div><p><i>${lang.tr('phrases.noremote')}</i>`, () => resolve({}));
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
            ajax('/api/match/request', request, 'POST', responseHandler);
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
         }
      });
   }

   fx.fileNotRecognized = () => {
      let message = `File Not Recognized`;
      let container = displayGen.popUpMessage(`<div style='margin-left: 2em; margin-right: 2em;'>${message}</div>`);
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

