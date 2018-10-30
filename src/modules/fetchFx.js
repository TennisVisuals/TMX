import { db } from './db';
import { env } from './env'
import { util } from './util';
import { UUID } from './UUID';
//import { config } from './config';
import { lang } from './translator';
import { importFx } from './importFx';
import { calendarFx } from './calendarFx';
import { displayGen } from './displayGen';
import { tournamentFx } from './tournamentFx';
import { tournamentDisplay } from './tournamentDisplay';

export const fetchFx = function() {
   let fx = {
      update: undefined,  // determines when updated version is available
   }
   let bearer_token = 'c611a05e-019e-4594-9578-e7a602125112';

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
         let parseable = attemptJSONparse(json_data);
         json_data = (parseable && parseable.data) || json_data;
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
            let request_object = {
               url: url,
               headers: {
                  "Authorization": "Bearer " + bearer_token, 
                  "Accept": "application/json"
               }
            };
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
         try { fetchJSON(url).then(success, failure); }
         catch (err) { failure(err); }

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

            displayGen.enterLink(undefined, lang.tr('tournaments.id'), processID);
            function processID(id) {
               displayGen.closeModal();
               if (id) fetchFx(id, fetchHTML).then(completeFetch, ()=>displayGen.popUpMessage(lang.tr('phrases.notfound')));
            }
         } else {
            console.log('no fx');
         }
      });

      function completeFetch(fetched) {
         // let ouid = config.env().org && config.env().org.ouid;
         let ouid = env.org && env.org.ouid;
         if (!fetched.ouid) fetched.ouid = ouid;

         // just to be sure... such filtering should be done in injected fx
         let players = fetched.players.filter(p=>p);
         delete fetched.players;

         addTournamentPlayers(players).then(addTournament, util.logError);

         function addTournament(players) {
            fetched.players = players; // players have been merged with existing data

            if (merge_with_tuid) {
               db.findTournament(merge_with_tuid).then(existing => mergeTournaments(existing, fetched), util.logError);
            } else {
               db.addTournament(fetched).then(calendarFx.displayCalendar);
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
                        player.first_name = util.normalizeName(player.first_name, false);
                        player.last_name = util.normalizeName(player.last_name, false);

                        resolve(player);
                     } else {
                        player.puid = player.puid || UUID.generate();

                        let new_player = Object.assign({}, player);
                        delete new_player.registration_time;
                        delete new_player.name;
                        delete new_player.withdrawn;
                        delete new_player.alternate;
                        delete new_player.category_ranking;
                        delete new_player.category_dbls;

                        player.first_name = util.normalizeName(player.first_name, false);
                        player.last_name = util.normalizeName(player.last_name, false);

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
         existing.players = mergePlayers(existing.players, fetched.players);
         db.addTournament(existing).then(() => {
            calendarFx.createNewTournament({ tournament_data: existing, title: lang.tr('actions.edit_tournament'), callback: modifyTournament })
         });
      }

      function mergePlayers(existing, fetched) {
         let existing_puids = existing.map(e=>e.puid);
         fetched = fetched.filter(f=>existing_puids.indexOf(f.puid)<0);
         return existing.concat(...fetched);
      }
   }

   function fetchPlayerDates() {
      return new Promise((resolve, reject) => {
         db.findSetting('fetchPlayerDates').then(fetchNew, reject);

         function fetchNew(fetchobj) {
            if (!fetchobj) {
               return reject('No Parameters. ' +  lang.tr('phrases.notconfigured'));
            }

            let request_object = {
               [fetchobj.type]: fetchobj.url,
               headers: {
                  "Authorization": "Bearer " + bearer_token, 
                  "Accept": "application/json"
               }
            };
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

         function checkSettings(fetchobj) {
            if (!fetchobj) return reject({ error: lang.tr('phrases.notconfigured') });
            fetchobj.url = checkURL(fetchobj.url);
            db.findAllClubs().then(clbz => fetchNew(clbz, fetchobj));
         }

         function fetchNew(clbz, fetchobj) {
            let cids = clbz.map(c=>+c.id);
            let max_id = Math.max(0, ...clbz.map(c=>!isNaN(+c.id) ? +c.id : 0));

            // 'fetchNewClubs'
            // let request_object = {
            //     [fetchobj.type]: fetchobj.url + max_id
            //      headers: {
            //         "Authorization": "Bearer " + bearer_token, 
            //         "Accept": "application/json"
            //      }
            // };

            let request_object = {
               [fetchobj.type]: fetchobj.url,
               headers: {
                  "Authorization": "Bearer " + bearer_token, 
                  "Accept": "application/json"
               }
            };
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

         function checkSettings(fetchobj) {
            if (!fetchobj) { return reject({ error: lang.tr('phrases.notconfigured') }); }
            fetchobj.url = checkURL(fetchobj.url);
            util.boolAttrs(fetchobj);
            db.findAllTournaments().then(trnys => fetchNew(trnys, fetchobj));
         }

         function fetchNew(trnys, fetchobj) {
            // for tournaments to be updated automatically they must have an .sid attribute equal to env.org.abbr
            // let tids = trnys.filter(t=>t.sid && t.sid == config.env().org.abbr).map(t=>t.tuid.replace(t.sid, ''));
            let tids = trnys.filter(t=>t.sid && t.sid == env.org.abbr).map(t=>t.tuid.replace(t.sid, ''));
            let max_id = fetchobj.max_id != false ? ((!merge && Math.max(...tids, 0)) || 0) : '';

            let request_object = {
               [fetchobj.type]: fetchobj.url + max_id,
               headers: {
                  "Authorization": "Bearer " + bearer_token, 
                  "Accept": "application/json"
               }
            };
            let request = JSON.stringify(request_object);
            function responseHandler(result) {
               if (result.json) {
                  normalizeTournaments(result.json, fetchobj);
               } else {
                  return reject(result.err || 'Error');
               }
            }
            ajax('/api/match/request', request, 'POST', responseHandler);
         }

         function normalizeTournaments(trnys, fetchobj) {
            let parser = fetchobj.parser && fetchobj.parser.fx && util.createFx(fetchobj.parser.fx);
            // let ouid = config.env().org && config.env().org.ouid;
            let ouid = env.org && env.org.ouid;
            if (Array.isArray(trnys)) {
               let tt = trnys.map(t => {
                  let trny = Object.assign({}, t);
                  if (parser) {
                     let pt = parser(t);
                     Object.assign(trny, pt);
                  }
                  trny.start = util.validDate(trny.start) ? new Date(trny.start).getTime() : trny.start;
                  trny.end = util.validDate(trny.end) ? new Date(trny.end).getTime() : (trny.start || trny.end);
                  if (!trny.ouid) trny.ouid = ouid;

                  // TODO: This needs to be a configured SID (Site ID?) and not env.org (HTS)
                  trny.tuid = `${env.org.abbr}${t.tuid || t.id}`;
                  return trny;
               });
               resolve(tt);
            } else {
               resolve([]);
            }
         }

      });
   }

   function extractSheetID(url) {
      let parts = url.split('/');
      if ((parts.indexOf('docs.google.com') < 0 || parts.indexOf('spreadsheets') < 0)) return undefined;
      return parts.reduce((p, c) => (!p || c.length > p.length) ? c : p, undefined);
   }

   fx.fetchNewPlayers = fetchNewPlayers;
   function fetchNewPlayers() {
      return new Promise((resolve, reject) => {
         db.findAllSettings().then(checkSettings, reject);

         function checkSettings(settings=[]) {
            let fetch_new_players = settings.reduce((p, c) => c.key == 'fetchNewPlayers' ? c : p, undefined);
            let sync_players = settings.reduce((p, c) => c.key == 'syncPlayers' ? c : p, undefined);

            if (fetch_new_players && fetch_new_players.url) {
               fetch_new_players.url = checkURL(fetch_new_players.url);
               db.findAllPlayers().then(plyrz => fetchNew(plyrz, fetch_new_players));
            } else if (sync_players && sync_players.url) {
               sync_players.url = checkURL(sync_players.url);
               let sheet_id = extractSheetID(sync_players.url);
               if (sheet_id) {
                  fx.fetchGoogleSheet(sheet_id).then(updatePlayerDB, displayGen.invalidURLorNotShared);
               } else {
                  return reject({ error: lang.tr('phrases.invalidsheeturl') });
               }
            } else {
               return reject({ error: lang.tr('phrases.notconfigured') });
            }
         }

         function updatePlayerDB(incoming_players) {
            displayGen.closeModal();

            if (!incoming_players || !incoming_players.length) return finish();
            let incoming_puids = incoming_players.map(p=>p.puid);
            db.findAllPlayers().then(plyrz => update(plyrz));

            function update(plyrz) {
               let existing_puids = plyrz.map(p=>p.puid);
               let existing_puid_map = Object.assign({}, ...plyrz.map(p => ({ [p.puid]: p })));
               let new_puids = incoming_puids.filter(i=>existing_puids.indexOf(i) < 0);
               let modify_puids = incoming_puids.filter(i=>existing_puids.indexOf(i) >= 0);

               // first add all the new players to the update
               let update_players = incoming_players.filter(p=>new_puids.indexOf(p.puid) >= 0);

               // for each incoming player that exists, add along with existing data
               incoming_players.forEach(p => {
                  if (existing_puids.indexOf(p.puid) >= 0) {
                     update_players.push(Object.assign(existing_puid_map[p.puid], p));
                  }
               });

               db.db.players.toCollection().delete().then(updateAction, finish);
               function updateAction() { util.performTask(db.addPlayer, incoming_players, false).then(finish, finish); }
            }
            function finish() {
               displayGen.closeModal();
               resolve();
            }

         }

         function fetchNew(plyrz, fetchobj) {
            // maximum player record determined by numeric ids; others excluded
            let max_id = Math.max(0, ...plyrz.map(p=>!isNaN(+p.id) ? +p.id : 0));
            let increment_url = fetchobj.increment == 'false' ? false : true;
            let request_url = fetchobj.url;
            if (increment_url) request_url += max_id;
            let request_object = {
               [fetchobj.type]: request_url,
               headers: {
                  "Authorization": "Bearer " + bearer_token, 
                  "Accept": "application/json"
               }
            };
            let request = JSON.stringify(request_object);
            function responseHandler(result) {
               if (result.json) {
                  let players = result.json.filter(p=>p.first_name && p.last_name);
                  normalizePlayers(players, fetchobj);

                  if (max_id) updatePlayerDates();
               } else {
                  return reject(result.err || 'Error');
               }
            }
            ajax('/api/match/request', request, 'POST', responseHandler);
         }

         // TODO: PUID generation should occur on the remote server, not in this script!
         // nameHash should be elminated...
         function normalizePlayers(players, fetchobj) {
            let parser = fetchobj.parser && fetchobj.parser.fx && util.createFx(fetchobj.parser.fx);

            players.forEach(player => {
               let rtp_date = new Date(player.right_to_play_until);
               player.right_to_play_until = (rtp_date != 'Invalid Date') ? rtp_date.getTime() : undefined;
               let ru_date = new Date(player.registered_until);
               player.registered_until = (ru_date != 'Invalid Date') ? ru_date.getTime() : undefined;
               let birth_date = new Date(player.birth);
               player.birth = (birth_date != 'Invalid Date') ? birth_date.getTime() : undefined;
               let name = (player.first_name + player.last_name).trim();
               player.hash = util.nameHash(name);
               let foreign = player.foreign != 'N';
               player.ioc = player.ioc || (!player.ioc && !foreign ? 'CRO' : undefined);
               // player.represents_ioc = player.represents_ioc != 'N';
               player.residence_permit = player.residence_permit != 'N';
               player.last_name = util.normalizeName(player.last_name, false).trim();
               player.first_name = util.normalizeName(player.first_name, false).trim();
               player.puid = player.puid || `${player.foreign == 'Y' ? 'INO' : 'CRO'}-${player.cropin}`;
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
            if (fx.errors) displayGen.popUpMessage(message);
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

         function checkSettings(fetchobj) {
            if (!fetchobj || !fetchobj.url) return reject({ error: lang.tr('phrases.notconfigured') });
            fetchobj.url = checkURL(fetchobj.url);
            fetchList(fetchobj);
         }

         function fetchList(fetchobj) {
            // Legacy to avoid call when no list is available
            // if (config.env().org.abbr == 'HTS' && category == '10') return reject();
            if (env.org.abbr == 'HTS' && category == '10') return reject();
            
            let request_object = {
               [fetchobj.type]: fetchobj.url + category,
               headers: {
                  "Authorization": "Bearer " + bearer_token, 
                  "Accept": "application/json"
               }
            };
            let request = JSON.stringify(request_object);
            function responseHandler(data) {
               if (data && data.json && Array.isArray(data.json)) {
                  let player_rankings = Object.assign({}, ...data.json.map(r => { return { [r.id]: r }}));
                  let rankings = { category, players: player_rankings, date: new Date().getTime() };
                  db.addCategoryRankings(rankings).then(() => resolve({ valid: true, rankings }), err => reject({ error: err }));
               } else if (data && data.json && data.json.players && typeof data.json.players == 'object') {
                  let rankings = { category, players: data.json.players, date: new Date().getTime() };
                  db.addCategoryRankings(rankings).then(() => resolve({ valid: true, rankings }), err => reject({ error: err }));
               } else {
                  return reject({ error: 'Error' });
               }
            }
            ajax('/api/match/request', request, 'POST', responseHandler);
         }
      });
   }

   fx.fetchGoogleSheet = (sheet_id) => {
      return new Promise((resolve, reject) => {
         if (!sheet_id) return reject('No Sheet ID');
         let request_object = {
            sheet_id,
            headers: {
               "Authorization": "Bearer " + bearer_token, 
               "Accept": "application/json"
            }
         };
         let request = JSON.stringify(request_object);
         function responseHandler(data) {
            if (data.result && data.result.rows && data.result.rows.length) {
               let sheet_type = importFx.identifySheetType(data.result.rows);
               if (sheet_type == 'players') {
                  let players = importFx.processSheetPlayers(data.result.rows);
                  players.forEach(player => player.full_name = tournamentFx.fullName(player, false));
                  if (players.length == 0) console.log('No Players found... suggestions for sheet format/must be on first sheet');
                  resolve(players);
               } else {
                  console.log('unknown sheet type');
                  reject(data);
               }
            } else {
               reject(data);
            }
            resolve([]);
         }
         ajax('/api/registrations/sheet', request, 'POST', responseHandler);
      });
   }

   fx.fetchRegisteredPlayers = fetchRegisteredPlayers;
   function fetchRegisteredPlayers(tuid, category) {
      return new Promise((resolve, reject) => {
         if (!tuid) return reject('No Tournament ID');

         db.findSetting('fetchRegisteredPlayers').then(checkSettings, reject);

         function okAction() {
            displayGen.closeModal();
            return resolve();
         }

         function loadAction() {
            displayGen.closeModal();
            let id_obj = displayGen.dropZone();
            let callback = (players) => {
               if (players && !players.length) return displayGen.popUpMessage('Players not found: Check Headers/Tab Names.');
               players.forEach(player => { player.full_name = `${player.last_name.toUpperCase()}, ${util.normalizeName(player.first_name, false)}`; });
               resolve(players);
            }
            importFx.loadPlayersDragAndDrop(id_obj.dropzone.element, ()=>{}, callback);
         }

         function promptLoadPlayers() {
            let message = `<h2>${lang.tr('phrases.locallycreated')}</h2><h3><i>${lang.tr('phrases.noremote')}</i></h3>`;
            displayGen.actionMessage({ message, actionFx: okAction, action: lang.tr('actions.ok'), cancel: lang.tr('phrases.loadplayers'), cancelAction: loadAction });
         }

         function checkSettings(fetchobj) {
            if (!fetchobj || !navigator.onLine) return promptLoadPlayers();

            let uuid = tuid;
            let preprocessor = fetchobj.preprocessor && fetchobj.preprocessor.fx && util.createFx(fetchobj.preprocessor.fx);
            if (fetchobj.scrapers) {
               return selectScraper(fetchobj);
            } else if (preprocessor) {
               uuid = preprocessor(uuid);
            } else if (tuid.indexOf('HTS') == 0) {
               console.log('remove reference to HTS when preprocessor present in HTS Keys');
               uuid = tuid.slice(3);
            }

            fetchobj.url = checkURL(fetchobj.url);
            remoteRequest(fetchobj, uuid);
         }

         function selectScraper(fetchobj) {
            let keys = Object.keys(fetchobj.scrapers);
            if (keys.length > 1) {
               let message = `<h2>${lang.tr('phrases.playerimport')}</h2>`;
               displayGen.buttonSelect({
                  message,
                  buttons: keys,
                  actionFx: goScrape,
                  cancelAction: () => displayGen.closeModal(),
                  alt: lang.tr('phrases.loadplayers'),
                  altAction: loadAction
               });
            } else {
               goScrape(keys[0]);
            }
            function goScrape(key) {
               let scraper = fetchobj.scrapers[key];
               scrape(scraper);
            }
         }

         function scrape(scraper) {
            let parser = scraper.fx && util.createFx(scraper.fx);
            // let ioc_codes = config.env().ioc_codes;
            let ioc_codes = env.ioc_codes;
            let ioc_map = Object.assign({}, ...ioc_codes.map(c=>({[c.name.toUpperCase()]: c.ioc})))
            ioc_map['USA'] = ioc_map['UNITED STATES'];
            ioc_map['UNITED KINGDOM'] = ioc_map['GREAT BRITAIN'];

            let id = displayGen.busy.message(`<p>${lang.tr("refresh.players")}</p>`);
            fetchHTML(scraper.url).then(doc => {
               displayGen.busy.done(id);
               let players = (parser && parser(doc)) || [];
               players.forEach(player => {
                  player.full_name = `${player.last_name.toUpperCase()}, ${util.normalizeName(player.first_name, false)}`;
                  if (!player.id) player.id = UUID.new();
                  if (!player.puid) player.puid = player.id;
                  if (!player.ioc && player.country) player.ioc = ioc_map[player.country.toUpperCase()];
               })
               resolve(players);
            }, (err) => console.log('err:', err));
         }

         function remoteRequest(fetchobj, uuid) {
            let request_object = {
               [fetchobj.type]: fetchobj.url + uuid,
               headers: {
                  "Authorization": "Bearer " + bearer_token, 
                  "Accept": "application/json"
               }
            };
            let request = JSON.stringify(request_object);

            function responseHandler(result) {
               if (result.json) {
                  processJSON(result.json);
               } else {
                  return promptLoadPlayers();
               }
               function processJSON(json) {
                  if (!json) return;
                  let players = json.filter(p=>p.last_name);
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
               }
            }
            ajax('/api/match/request', request, 'POST', responseHandler);
         }

         function updateLocal(dbplayers, players) {

            // update players with info from database
            // TODO: this should not be necessary in the future... remote server should *always* give proper PUID
            players.forEach((player, i) => {
               if (dbplayers[i]) {
                  player.puid = player.puid || dbplayers[i].puid;
                  player.ioc = player.ioc || dbplayers[i].ioc;
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

   function checkURL(url) {
      return (url && url.indexOf('http') == 0) ? url : `${window.location.origin}/${url}`;
   }

   return fx;
}();
