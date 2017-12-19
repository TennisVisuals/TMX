!function() {

   // ****************************** external files ******************************
   // hts{} required for loading workbooks
   // tournamentParser{} required for parsing workbooks
   // d3{} required for parsing CSV files
   // util{} required for performTask

   let load = {
      loaded: {},
      reset() {
         load.loaded = {
            date: undefined,
            matches: undefined,
            workbook: undefined,
            players: [],
            completed: [],
            outstanding: [],
            decisions: {},
         }
      }
   };

   let reload = () => window.location.replace(window.location.pathname);

   load.reset();
   let displayMessage = (msg) => { console.log(msg); }

   let cache = {};
   load.loadCache = () => {
      cache.aliases = {};
      db.findAllClubs().then(arr => cache.club_codes = arr.map(club => club.code));
      db.findAllAliases().then(arr => arr.forEach(row => cache.aliases[row.alias] = row.hash));
      db.findAllIgnored().then(arr => cache.ignored = arr.map(row => `${row.hash}-IOC-${row.ioc}`));
   }

   let validExtension = (filename) => {
      if (filename.length < 0) return;
      let ext = filename.split('.').reverse()[0].toLowerCase();
      let validExt = ["csv", "xls", "xlsm", "xlsx", "json"];
      let index = validExt.indexOf(ext);
      if (index >= 0) return validExt[index];
   }

   function parseCSV(file_content) {
      let rows = [];
      d3.csvParse(file_content, function(row) { 
         let obj = {};
         Object.keys(row).forEach(key => { if (key.trim()) obj[key.trim()] = row[key].trim(); }); 
         rows.push(obj);
      });
      return rows;
   }

   load.parseFileName = (filename) => {
      let parts = filename.split('_');

      let meta = {
         filename,
         filetype: validExtension(filename),
      };

      let parse_category = parts[0].match(/\d+/) || (parts[0] == 'RS' ? [20] : undefined);
      if (parse_category) meta.filecategory = config.legacyCategory(parse_category[0]);

      if (filename[0] == 'R') {
         let datestring = filename.split('_')[1].match(/\d+/)[0];
         if (datestring.length == 8) {
            let date = [datestring.substring(0, 4), datestring.substring(4, 6), datestring.substring(6,8)].join('-');
            if (date == util.formatDate(date)) meta.filedate = date;
         }
      }

      if (parts.length == 5) {
         // using charCodeAt as safety since Diacritics has sometimes failed
         let gender = util.replaceDiacritics(parts[3]).toUpperCase().charCodeAt(0);
         if ([77].indexOf(gender) >= 0) meta.gender = 'M';
         if ([87, 90].indexOf(gender) >= 0) meta.gender = 'W';

         let fileid = parts[4].match(/\d+/);
         if (fileid && fileid[0].length == 4) meta.old_id = fileid[0];
         if (fileid && fileid[0].length == 3) meta.tuid = 'HTS' + fileid[0];
      }
      return meta;
   }

   function determineDate(value) {
      if (!value) return undefined;
      return isNaN(value) ? new Date(value).getTime() : new Date(+value).getTime();
   }

   load.importPlayerList = (rows, id) => {
      let player_list = [];
      rows.forEach(player => {
         let name = (player.first_name + player.last_name).trim();
         if (name) {
            player.puid = player.puid || UUID.new();

            // no need to assign CROPIN!
            // player.cropin = player.cropin || UUID.new();

            player.hash = util.nameHash(name);
            player.birth = determineDate(player.birth);
            player.first_name = util.normalizeName(player.first_name);
            player.last_name = util.normalizeName(player.last_name);
            player.foreign = player.foreign == 'true' || player.foreign == 'Y';
            player.represents_ioc = player.represents_ioc == 'true' || player.represents_ioc == 'Y';
            player.residence_permit = player.residence_permit == 'true' || player.residence_permit == 'Y';
            player.registered_until = determineDate(player.registered_until);
            player.right_to_play_until = determineDate(player.right_to_play_until);
            player_list.push(player);
         }
      });

      load.processPlayers(player_list).then(done, importFailure);;

      function done() {
         // TODO: calculate timeout based on # of imports
         setTimeout(function() { busy.done(id); }, 3000);
      }
   }

   function importFailure(what) {
      alert('Import Failed');
      console.log('Import Failed');
      console.log(what);
   }

   function importClubsCSV(clubs) {
      let callback = () => searchBox.searchSelect('clubs');
      let id = busy.message('<p>Loading Clubs...</p>', callback);
      clubs.forEach(club => { 
         if (club.courts) {
            let courts = club.courts ? club.courts.split(',') : [0, 0];
            club.courts = { clay: courts[0], hard: courts[1] };
         }
         if (club.email) club.email = club.email.split(',');
         if (club.notes) delete club.notes;
      });;
      util.performTask(db.addClub, clubs, false).then(() => busy.done(id), () => busy.done(id));
   }

   function importClubsJSON(clubs) {
      let callback = () => searchBox.searchSelect('clubs');
      let id = busy.message('<p>Loading Clubs...</p>', callback);
      util.performTask(db.addClub, clubs, false).then(() => busy.done(id), () => busy.done(id));
   }

   function importRankings(rows) {
      return new Promise((resolve, reject) => {
         let id = busy.message('<p>Loading Rankings...</p>');
         let rank_lists = {};
         if (!Array.isArray(rows)) return busy.done(id);

         let categories = util.unique(rows.map(r=>config.legacyCategory(r.category)));

         let category_rankings = categories.map(category => {
            let records = rows.filter(f=>f.category == category);
            let player_rankings = Object.assign({}, ...records.map(r => { return { [r.id]: r }}));
            return { category, players: player_rankings, date: new Date().getTime() };
         });

         console.log('check category rankings:', category_rankings);

         util.performTask(db.addCategoryRankings, category_rankings, false).then(done, done);

         function done(foo) { 
            busy.done(id); 
            return resolve();
         }
      });
   }

   function importTournaments(rows) {
      let callback = () => searchBox.searchSelect('tournaments');
      let id = busy.message('<p>Loading Tournaments...</p>', callback);
      let tournaments = [];
      if (!Array.isArray(rows)) rows = [rows];

      rows.forEach(record => { 
         if (record.tuid) {
            record.start = determineDate(record.start);
            record.end = determineDate(record.end);
            tournaments.push(record);
         } else {
            let tournament = {
               id: record.id,
               sid: record.sid || 'HTS',
               tuid: `${record.sid || 'HTS'}${record.id}`,
               name: util.normalizeName(record.name, false),
               start: determineDate(record.start),
               end: determineDate(record.end),
               draws: record.draws || '',
               rank: record.rank,
               category: config.legacyCategory(record.category),

            };
            console.log(tournament.category);
            if (record.id && tournament.name) tournaments.push(tournament);
         }
      });
      util.performTask(db.addTournament, tournaments, false).then(done, done);

      function done(foo) { 
         setTimeout(function() { busy.done(id); }, 2000);
      }
   }

   load.addNewTournaments = (trnys) => {
      let callback = () => searchBox.searchSelect('tournaments');
      let id = busy.message('<p>Loading Tournaments...</p>');
      console.log(id);
      util.performTask(db.addTournament, trnys, false).then(done, () => busy.done(id));

      function done(foo) {
         console.log('done:', foo);
         busy.done(id);
      }
   }

   load.findTournament = () => {
      return new Promise((resolve, reject) => {
         if (load.loaded.meta.old_id) {
            db.findTournamentByOldID(load.loaded.meta.old_id).then(setTournament, reject);
         } else if (load.loaded.meta.tuid) {
            db.findTournament(load.loaded.meta.tuid).then(setTournament, reject);
         } else {
            if (load.loaded.tournament.name) load.loaded.meta.name = load.loaded.tournament.name;
            return resolve();
         }

         function setTournament(tournament) {
            tournament.category = config.legacyCategory(tournament.category);

            if (Object.keys(tournament).length) {
               load.loaded.tournament.sid = 'HTS';
               load.loaded.meta.tuid = tournament.tuid;

               load.loaded.start = tournament.start;
               load.loaded.end = tournament.end;

               if (tournament.name) load.loaded.meta.name = tournament.name;
               if (tournament.accepted && load.loaded.meta.gender && tournament.accepted[load.loaded.meta.gender]) {

                  let accepted = tournament.accepted[load.loaded.meta.gender];
                  load.loaded.accepted = tournament.accepted;

                  load.loaded.meta.rank = +accepted.sgl_rank || +tournament.rank;
                  load.loaded.meta.dbl_rank = +accepted.dbl_rank;
                  load.loaded.tournament.rank = load.loaded.meta.rank;
                  load.loaded.meta.category = config.legacyCategory(accepted.category);
                  load.loaded.tournament.category = load.loaded.meta.category;
                  load.loaded.results.ranks = { singles: load.loaded.meta.rank, doubles: load.loaded.meta.dbl_rank };

               } else {
                  if (tournament.rank) {
                     load.loaded.meta.rank = +tournament.rank;
                     if (load.loaded.tournament.rank && load.loaded.meta.rank != load.loaded.tournament.rank) {
                        console.log('RANK MISMATCH', load.loaded.tournament.rang_turnira, load.loaded.meta.rank, load.loaded.tournament);
                     }
                     if (!load.loaded.tournament.rank) load.loaded.tournament.rank = +tournament.rank;
                  }
                  if (tournament.category) {
                     load.loaded.meta.category = tournament.category;
                     if (load.loaded.tournament.category && load.loaded.meta.category != load.loaded.tournament.category) {
                        console.log('CATEGORY MISMATCH', load.loaded.tournament.category, load.loaded.meta.category, load.loaded.tournament);
                     }
                     if (!load.loaded.tournament.category) load.loaded.tournament.category = tournament.category;
                  }
               }
               if (tournament.end) {
                  load.loaded.meta.date = tournament.end;
                  if (!load.loaded.date) load.loaded.date = new Date(tournament.end);
               }

               load.loaded.matches.forEach(match => {
                  match.tournament.name = tournament.name;
                  match.tournament.start = tournament.start;
                  match.tournament.end = tournament.end;
                  match.tournament.tuid = tournament.tuid;
                  match.tournament.category = tournament.category;
               });
            }
            return resolve();
         }
      });
   }

   // TODO: processPlayers(), processPlayer() should be part of another module...
   
   load.processPlayers = processPlayers;
   function processPlayers(players) {
      if (!players) players = load.loaded.players;
      return new Promise((resolve, reject) => {
         if (!players.length) { return resolve(); }

         // make a copy of the data first!
         let data = players.map(player => { return { player }});

         util.performTask(processPlayer, data)
            .then(results => {
               let added = results.filter(f => f == 'added').length;
               let unique = results.filter(f => f == 'unique').length;

               let actions_required = results.filter(f => typeof f == 'object')
                  .map(a => (a.status == 'completed') ? { status: a.status, original: a.player, player: a.result[0] } : a);

               let players = updatePlayers(actions_required);

               if (players && players.outstanding && players.outstanding.length) {
                  return reject(players);
               } else {
                  return resolve(added);
               }
            })
      });
   }

   function processPlayer({player, recursion = 0}) {
      return new Promise((resolve, reject) => {
         if (recursion > 1) return reject();
         let attr = player.puid ? { field: "puid", value: player.puid } : { field: "hash", value: player.hash };
         db.findPlayersWhere(attr.field, attr.value).then(result => {
            if (!result.length) {
               // player does not exist, add!
               if (player.puid) {
                  db.addPlayer(player).then(resolve('added'), reject);
               } else {
                  let a_player = antiAlias({player});
                  processPlayer({player: a_player, recursion: recursion + 1})
                     .then(resolve, () => resolve({ status: 'unknown', player: player, })); 
               }
            } else if (result.length == 1) { 
               // player exists and is unique
               if (player.puid) {
                  return resolve('unique'); 
               } else {
                  return resolve({ status: 'completed', player: player, result });
               }
            } else  {
               // player exists and is not unique
               Promise.all(result.map(player => db.findClub(player.club + '')))
                  .then(results => {
                     results.forEach((r, i) => result[i].club = r ? r.code : '');
                     resolve({ status: 'duplicate', player: player, result });
                  });
            }
         });
      });
   }

   function identifyPlayers({ completed, outstanding }) {
      load.loaded.completed = completed;
      load.loaded.outstanding = outstanding;

      let container = gen.identifyPlayers(load.loaded.meta.name, outstanding);
      let actions_element = d3.select(container.actions.element);

      actions_element
         .selectAll('button.ignore')
         .on('click', (d, i, elem) => { 
            d3.event.stopPropagation(); 
            let row = util.getParent(elem[i], 'section_row');
            tournaments.ignorePlayer(row);
         });

      actions_element
         .selectAll('.action_edit')
         .on('click', (d, i, elem) => { 
            d3.event.stopPropagation(); 
            tournaments.identifyPlayer(elem[i]); 
         });

      searchBox.focus();
   }

   // TODO: implement this!
   function validIOC(code) { return true; }
   function validClubCode(code) { return cache.club_codes && cache.club_codes.indexOf(code) >= 0; }

   load.updatePlayers = updatePlayers;
   function updatePlayers(actions) {
      if (!actions || !actions.length) return;

      let completed = actions.filter(action => action.status == 'completed');
      let outstanding = actions.filter(action => action.status != 'completed');

      // filter out players that have been previously ignored
      let ign = outstanding
         .map(action => {
            // if player club is not a valid club code and there is no ioc,
            // assume that club is actually ioc
            if (action.player.club && !validClubCode(action.player.club)) {
               if (!action.player.ioc && validIOC(action.player.club)) action.player.ioc = action.player.club;
               action.player.club = undefined;
            }
            return action;
         })
         .filter(action => cache.ignored.indexOf(`${action.player.hash}-IOC-${action.player.ioc}`) >= 0)
         .map(action => Object.assign(action, { status: 'completed', original: action.player }));

      // deal with duplicates that can easily be ruled out
      let dups = outstanding.filter(action => action.status == 'duplicate')
         .filter(action => {

            // first exclude and players who are too old for the category
            let valid = action.result.filter(result => {
               let eligible_categories = rank.eligibleCategories({ birth_day: result.birth, calc_date: load.loaded.date }).categories;
               return eligible_categories.indexOf(load.loaded.tournament.category) >= 0 
            });
            if (valid.length == 1) {
               action.original = action.player;
               action.player = valid[0];
               action.status = 'completed';
               delete action.result;
               return true;
            }

            // exclude players who are not part of the same club
            let same_club = action.result.map(result => action.player.club == result.club).indexOf(true);
            if (same_club >= 0) {
               action.original = action.player;
               action.player = action.result[same_club];
               action.status = 'completed';
               delete action.result;
               return true;
            }

            return false;
         });

      // filter out any ignored or duplicates which were handled...
      outstanding = outstanding.filter(action => action.status != 'completed');
      // ... and update completed
      completed = completed.concat(...ign, ...dups);
      if (outstanding.length) return { completed, outstanding };

      let hash_map = Object.assign(...completed.map(e => ({ [e.player.hash]: e.player })));

      if (!load.loaded.matches) return;
      load.loaded.matches.forEach(match => {
         // antiAlias hashes for match 
         match = antiAlias({match});
         // then use hash_map to replace hashes with real puids 
         match.puids = match.puids.map(puid => {
            if (!hash_map[puid]) console.log('missing puid for match:', match);
            return hash_map[puid].puid || puid
         });
         // then replace player details with hash_map details 
         match.players.forEach(player => Object.assign(player, hash_map[player.hash]));
      });
   }

   function antiAlias({player, match, pt}) {
      if (player) {
         player.hash = cache.aliases[player.hash] || player.hash;
         return player;
      }
      if (match) {
         // puids are initially hashes - replace any known aliases
         match.puids = match.puids.map(puid => cache.aliases[puid] || puid);
         // match player hash needs to be replaced with any known aliases
         match.players.forEach(player => player.hash = cache.aliases[player.hash] || player.hash);
         return match;
      }
   }

   load.initDragAndDrop = (initFx, callback) => {
      let isAdvancedUpload = function() {
         let div = document.createElement('div');
         return (('draggable' in div) || ('ondragstart' in div && 'ondrop' in div)) && 'FormData' in window && 'FileReader' in window;
      }();

      let forms = document.querySelectorAll('.dropzone');
      Array.from(forms).forEach(form => {
         let input = form.querySelector('input[type="file"]');
         let label = form.querySelector('label');
         let droppedFiles = false;
         let showFiles = (files) => {
            label.textContent = (files.length > 1)
               ? ( input.getAttribute( 'data-multiple-caption' ) || '' ).replace( '{count}', files.length ) 
               : files[ 0 ].name;
         };

         input.addEventListener('change', e => processFile(e.target.files));

         if (isAdvancedUpload) {
            form.classList.add('has-advanced-upload');

            [ 'drag', 'dragstart', 'dragend', 'dragover', 'dragenter', 'dragleave', 'drop' ].forEach( function( event ) {
               form.addEventListener( event, function(e) {
                  e.preventDefault();
                  e.stopPropagation();
               });
            });

            [ 'dragover', 'dragenter' ].forEach(function (event) { form.addEventListener(event, () => form.classList.add('is-dragover')); });
            [ 'dragleave', 'dragend', 'drop' ].forEach( function (event) { form.addEventListener(event, () => form.classList.remove('is-dragover')); });

            form.addEventListener('drop', (e) => {
               droppedFiles = e.dataTransfer.files;
               processFile( droppedFiles );
            });
         }

         // Firefox focus bug fix for file input
         input.addEventListener( 'focus', function() { input.classList.add( 'has-focus' ); });
         input.addEventListener( 'blur', function() { input.classList.remove( 'has-focus' ); });

         let processFile = function(files) {
            if (!isAdvancedUpload || !files || !files.length) return false;
            if (initFx && typeof initFx == 'function') initFx();

            let file = files[0];
            loadFile(file, callback);
         };
      });
   }

   function loadFile(file, callback) {
      load.loaded.meta = load.parseFileName(file.name);

      let reader = new FileReader();
      reader.onload = function(evt) {
         if (evt.target.error) {
            displayMessage(lang.tr('phrases.fileerror'));
            return;
         }

         let file_content = evt.target.result;
         if (!file_content.length) return;

         if (load.loaded.meta.filetype.indexOf('xls') >= 0) {
            loadWorkbook(file_content);
         } else if (load.loaded.meta.filetype == 'csv') {
            loadJSON(CSV2JSON(file_content));
         } else if (load.loaded.meta.filetype.indexOf('json') >= 0) {
            if (file_content.indexOf('"~') >= 0) {
               loadJSON(CircularJSON.parse(file_content));
            } else {
               loadJSON(JSON.parse(file_content));
            }
         }
      };

      if (!load.loaded.meta.filetype) {
         displayMessage(lang.tr('phrases.invalid'));
         return;
      } else {
         if (['csv', 'json'].indexOf(load.loaded.meta.filetype) >= 0) {
            reader.readAsText(file);
         } else {
            reader.readAsBinaryString(file);
         }
      }
   }

   function CSV2JSON(file_content) {
      let rows = [];
      d3.csvParse(file_content, function(row) { 
         let obj = {};
         Object.keys(row).forEach(key => { if (key && key.trim()) obj[key.trim()] = row[key] ? row[key].trim() : ''; }); 
         rows.push(obj);
      });
      return rows;
   }

   function loadJSON(json) {
      if (!Object.keys(json).length && !json.length) return;

      let loadType = {
         draws() { loadDraws(json); },
         aliases() { loadAliases(json); },
         ignored() { loadIgnored(json); },
         matches() { loadMatches(json); },
         clubs() { importClubsJSON(json); },
         settings() { loadSettings(json); },
         points()  { loadPointEvents(json); },
         players()  { loadPlayerList(json); },
         playersCSV()  { loadPlayerList(json); },
         ranklistCSV() { importRankings(json); },
         tournaments() { loadTournaments(json); },
         tournamentsCSV() { importTournaments(json); },
      };

      let data_type = identifyJSON(json);
      if (data_type) {
         loadType[data_type]();
      } else {
         displayMessage(lang.tr('phrases.badfile'));
      }
   }

   function identifyJSON(json) {
      let keys = Object.keys(Array.isArray(json) ? json[0] : json);

      if (keys.length && ['id', 'category', 'ranking', 'points'].filter(k=>keys.indexOf(k) >= 0).length == 4) return 'ranklistCSV';
      if (keys.length && ['website', 'courts'].filter(k=>keys.indexOf(k) >= 0).length == 2) return 'clubs';
      if (keys.length && ['born', 'right_to_play'].filter(k=>keys.indexOf(k) >= 0).length == 2) return 'playersCSV';
      if (keys.length && ['start', 'end', 'draws'].filter(k=>keys.indexOf(k) >= 0).length == 3) return 'tournamentsCSV';

      if (keys.length && ['key', 'category'].filter(k=>keys.indexOf(k) >= 0).length == 2) return 'settings';
      if (keys.length && ['hash', 'alias'].filter(k=>keys.indexOf(k) >= 0).length == 2) return 'aliases';
      if (keys.length && ['sex', 'birth'].filter(k=>keys.indexOf(k) >= 0).length == 2) return 'players';
      if (keys.length && ['hash', 'ioc'].filter(k=>keys.indexOf(k) >= 0).length == 2) return 'ignored';
      if (keys.length && ['muid', 'puids', 'score'].filter(k=>keys.indexOf(k) >= 0).length == 3) return 'matches';
      if (keys.length && ['muid', 'puid', 'points'].filter(k=>keys.indexOf(k) >= 0).length == 3) return 'points';

      if (keys.length && ['start', 'end', 'category'].filter(k=>keys.indexOf(k) >= 0).length == 3) return 'tournaments';
      if (keys.length && ['sid', 'tuid', 'old_id'].filter(k=>keys.indexOf(k) >= 0).length == 3) return 'tournaments';

      if (keys.length && ['titles', 'draws', 'details'].filter(k=>keys.indexOf(k) >= 0).length == 3) return 'draws';
   }

   function loadTask(fx, arr, what = '', callback) {
      if (busy && what) busy.message(`<p>Loading ${what}...</p>`);
      util.performTask(fx, Array.isArray(arr) ? arr : [arr], false).then(finish, finish);

      function finish(results) { 
         if (busy) busy.done();
         if (callback && typeof callback == 'function') callback();
      }
   }

   load.addAlias = ({alias, hash}) => {
      cache.aliases[alias] = hash;
      return db.addAlias({alias, hash});
   }

   load.addIgnore = ({hash, ioc}) => {
      let stored = `${hash}-IOC-${ioc}`;
      cache.ignored.push(stored);
      return db.addIgnore({hash, ioc});
   }

   function addDraw(draw) { console.log(draw); }

   function loadDraws(arr) { loadTask(addDraw, arr, 'Draws'); };
   function loadAliases(arr) { loadTask(load.addAlias, arr, 'Aliases'); };
   function loadIgnored(arr) { loadTask(load.addIgnore, arr, 'Ignored'); };
   function loadSettings(arr) {
      loadTask(db.addSetting, arr, 'Settings', reload);
   }
   function loadTournaments(arr) { loadTask(db.addTournament, arr, 'Tournaments'); };
   function loadPointEvents(arr) { loadTask(db.addPointEvent, arr.filter(e => e.points && e.puid), 'Points'); };

   function loadPlayerList(arr) { 
      let callback = () => searchBox.searchSelect('players');
      let id = busy.message('<p>Loading Players...</p>', callback);
      load.importPlayerList(arr, id); 
   }

   let validMatch = (match) => match.players.length == [].concat(...match.teams).length;
   function loadMatches(match_array) { loadTask(db.addMatch, match_array.filter(m => validMatch(m)), 'Matches'); }

   function loadWorkbook(file_content, callback) {
      var workbook = XLSX.read(file_content, {type: 'binary'});
      load.loaded.workbook = workbook;

      let workbook_type = identifyWorkbook(workbook);

      if (workbook_type == 'tournament') {
         processWorkbook(workbook);
         let process = () => load.processPlayers().then(tournaments.processLoadedTournament, identifyPlayers);
         load.findTournament().then(process, process);
      }

      if (workbook_type == 'courthive_imports') {
         let id = busy.message('<p>Loading...</p>', reload);

         let players = extractPlayers(workbook);
         let tournaments = extractTournaments(workbook);
         let rankings = extractRankings(workbook);

         let addPlayers = () => new Promise((resolve, reject) => util.performTask(db.addPlayer, players, false).then(resolve, resolve));
         let addTournaments = () => new Promise((resolve, reject) => util.performTask(db.addTournament, tournaments, false).then(resolve, resolve));
         let addRankings = () => importRankings(rankings);

         addPlayers().then(addTournaments).then(addRankings).then(()=>busy.done(id));
      }

   }

   function extractPlayers(workbook) {
      if (workbook.SheetNames.indexOf('Players') < 0) return [];
      let headers = [ 
         { attr: 'id', header: 'ID' }, 
         { attr: 'last_name', header: 'Last Name' }, 
         { attr: 'first_name', header: 'First Name' }, 
         { attr: 'city', header: 'City' }, 
         { attr: 'sex', header: 'Gender' }, 
         { attr: 'birth', header: 'Birthdate' }, 
         { attr: 'ioc', header: 'IOC' }, 
         { attr: 'puid', header: 'Unique Identifier' }, 
      ];
      let players = extractWorkbookRows(workbook.Sheets.Players, headers);
      players.forEach(player => {
         player.puid = player.puid || UUID.new();
         player.id = player.id || player.puid;
         player.birth = new Date(player.birth).getTime();
         player.ioc = (player.ioc.match(/\D+/g) || [])[0];
      });
      return players;
   }

   function extractTournaments(workbook) {
      if (workbook.SheetNames.indexOf('Tournaments') < 0) return [];
      let headers = [ 
         { attr: 'id', header: 'ID' }, 
         { attr: 'tuid', header: 'Unique ID' }, 
         { attr: 'sid', header: 'Association' }, 
         { attr: 'name', header: 'Tournament Name' }, 
         { attr: 'start', header: 'Start Date' }, 
         { attr: 'end', header: 'End Date' }, 
         { attr: 'draws', header: 'Draws' }, 
         { attr: 'rank', header: 'Rank' }, 
         { attr: 'category', header: 'Category' }, 
      ]; 
      let tournaments = extractWorkbookRows(workbook.Sheets.Tournaments, headers);

      tournaments.forEach(tournament => {
         tournament.tuid = tournament.tuid || UUID.new();
         tournament.start = new Date(tournament.start).getTime();
         tournament.end = new Date(tournament.end).getTime();
      });
      return tournaments;
   }

   function extractRankings(workbook) {
      if (workbook.SheetNames.indexOf('Rankings') < 0) return [];
      let headers = [ 
         { attr: 'id', header: 'ID' }, 
         { attr: 'category', header: 'Category' }, 
         { attr: 'ranking', header: 'Ranking' }, 
         { attr: 'points', header: 'Points' }, 
         { attr: 'club_code', header: 'Club Code' }, 
         { attr: 'club_name', header: 'Club Name' }, 
         { attr: 'sex', header: 'Gender' }, 
      ]; 
      let rankings = extractWorkbookRows(workbook.Sheets.Rankings, headers);
      // rankings.forEach(ranking => { if (ranking.category == 'S') ranking.category = 's'; });
      rankings.forEach(ranking => { ranking.category == config.legacyCategory(ranking.category); });
      console.log('check ranking categories:', rankings);
      return rankings;
   }

   function extractWorkbookRows(sheet, headers) {
      let cellValue = (cell) => {
         let val = cell ? cell.w : '';
         val = (typeof val == 'string') ? val.trim() : val;
         return val;
      }
      let getCol = (reference) => reference ? reference[0] : undefined;
      let getRow = (reference) => reference && /\d+/.test(reference) ? parseInt(/\d+/.exec(reference)[0]) : undefined;
      let findValueRefs = (search_text, sheet) => Object.keys(sheet).filter(ref => cellValue(sheet[ref]) == search_text);
      let columns = Object.assign({}, ...headers.map(obj => {
         let keys = findValueRefs(obj.header, sheet).filter(r=>getRow(r) == 1);
         let col = keys.length ? getCol(keys[0]) : undefined;
         if (col) return { [obj.attr]: col};
      }).filter(f=>f));

      let rows = util.unique(Object.keys(sheet).filter(f => getRow(f) > 1).map(m=>getRow(m)));
      return rows.map(r => Object.assign({}, ...Object.keys(columns).map(c => ({ [c]: cellValue(sheet[`${columns[c]}${r}`]) }))));
   }

   function identifyWorkbook(workbook) {
      let sheets = workbook.SheetNames;
      if (util.intersection(sheets, ['CourtHive', 'Players']).length == 2) return 'courthive_imports';
      return 'tournament';
   }

   function processWorkbook(workbook) {
      let tournament_rank;
      tournamentParser.setWorkbookProfile({workbook});
      load.loaded.results = tournamentParser.drawResults(workbook, load.loaded.meta.tuid || load.loaded.meta.old_id);
      load.loaded.matches = load.loaded.results.rows;
      if (load.loaded.matches.length) {

         let phash = [];
         let all_players = [];
         [].concat(...load.loaded.matches.map(match=>match.players)).forEach(player => {
            if (phash.indexOf(player.hash) < 0) {
               phash.push(player.hash);
               if (player.club && player.club.indexOf('INO') >= 0) {
                  player.ioc = player.club.replace('INO', '').replace(/[-,\/]+/g, '').trim();
                  player.club = '';
               }
               all_players.push({ 
                  hash: player.hash,
                  first_name: util.normalizeName(player.first_name),
                  last_name: util.normalizeName(player.last_name),
                  club: player.club,
                  ioc: player.ioc,
               });
            }
         });

         load.loaded.date = undefined;
         load.loaded.players = all_players;

         if (tournamentParser.profile == 'HTS') {
            load.loaded.tournament = tournamentParser.HTS_tournamentData(workbook);
            load.loaded.tournament.sid = tournamentParser.profile;

            let date = tournamentParser.dateProcess.HTS(load.loaded.tournament.datum_turnir);
            if (date && !isNaN(date) && date < Date.now()) load.loaded.date = new Date(date);

            load.loaded.meta.name = load.loaded.tournament.name;
            let rank = load.loaded.tournament.rang_turnira ? parseInt(load.loaded.tournament.rang_turnira.match(/\d+/)) : undefined;
            load.loaded.tournament.rank = rank && rank.length ? rank[0] : undefined;
            load.loaded.meta.rank - load.loaded.tournament.rank;

            load.loaded.tournament.category = load.loaded.tournament.category ? load.loaded.tournament.category.match(/\d+/) : undefined;
            load.loaded.tournament.category = load.loaded.tournament.category ? parseInt(load.loaded.tournament.category[0]) : 20;
            load.loaded.tournament.category = config.legacyCategory(load.loaded.tournament.category);
            load.loaded.meta.category = load.loaded.tournament.category;
         } else {
            load.loaded.tournament = { name: workbook.Sheets[workbook.SheetNames[0]].A1.v };
         }
      }
   }

   if (typeof define === "function" && define.amd) define(load); else if (typeof module === "object" && module.exports) module.exports = load;
   this.load = load;
 
}();
