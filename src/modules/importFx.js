import { db } from './db'
import { env } from './env'
import { UUID } from './UUID';
import { util } from './util'
import { staging } from './staging'
import { lang } from './translator';
import { rankCalc } from './rankCalc';
import { searchBox } from './searchBox';
import { calendarFx } from './calendarFx';
import { displayGen } from './displayGen';
import { tournamentParser } from './tournamentParser';
import { tournamentDisplay } from './tournamentDisplay';

export const importFx = function() {
   // ****************************** external files ******************************
   // hts{} required for loading workbooks
   // d3{} required for parsing CSV files

   let load = {
      // fx: { env: () => { console.log('environment request'); return {}; }, },
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

   let cache = { ignored: [] };
   load.loadCache = () => {
      cache.aliases = {};
      db.findAllClubs().then(arr => cache.club_codes = arr.map(club => club.code));
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
      if (parse_category) meta.filecategory = staging.legacyCategory(parse_category[0]);

      /*
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
         // if (fileid && fileid[0].length == 3) meta.tuid = 'HTS' + fileid[0];
      }
      */
      return meta;
   }

   function determineDate(value) {
      if (!value) return undefined;
      return isNaN(value) ? new Date(value).getTime() : new Date(+value).getTime();
   }

   function importJotForm(rows, callback) {
      let players = processSheetData(rows);
      if (callback && typeof callback == 'function') callback(players);
      displayGen.busy.done();
   }

   load.processSheetData = processSheetData;
   function processSheetData(rows) {
      let players = [];
      // let ioc_codes = load.fx.env().ioc_codes || [];
      let ioc_codes = env.ioc_codes || [];
      let code_by_country = Object.assign({}, ...ioc_codes.map(c => ({ [compressName(c.name)]: c.ioc })));

      rows.forEach(row => {
         let player = {};
         player.first_name = findAttr(row, ['First Name']);
         player.last_name = findAttr(row, ['Last Name']);

         if (!player.first_name || !player.last_name) return;

         player.school = findAttr(row, ['School']);
         player.profile = findAttr(row, ['Profile', 'UTR Profile', 'UTR Player Profile Link']);

         let parenthetical = /\((.*)\)/;
         if (player.school && player.school.match(parenthetical)) {
            player.school_abbr = player.school.match(parenthetical)[1];
         }

         player.school_abbr = findAttr(row, ['School Abbreviation', 'School Abbr', 'School Code']);

         let submission_id = findAttr(row, ['Submission ID']);
         player.puid = findAttr(row, ['PUID']) || (submission_id ? `GS${submission_id}` : UUID.new());
         player.id = row['ID'] || player.puid;

         let gender = findAttr(row, ['Gender', 'Sex']);
         if (['Male', 'Man', 'M', 'Boy'].indexOf(gender) >= 0) player.sex = 'M';
         if (['Female', 'W', 'Girl', 'Woman'].indexOf(gender) >= 0) player.sex = 'W';

         let country = findAttr(row, ['Country']);
         if (country) { player.ioc = code_by_country[compressName(country)]; }

         let birth = findAttr(row, ['Birth', 'Birthdate', 'Birthday', 'Birth Date', 'Date of Birth']);
         if (birth) {
            let birthdate = new Date(birth);
            player.birth = [birthdate.getFullYear(), birthdate.getMonth() + 1, birthdate.getDate()].join('-');
         }
         players.push(player);
      });

      function compressName(name) { return name.split(' ').join('').toLowerCase(); }

      function findAttr(row, attrs = []) {
         let attributes = attrs.concat(...attrs.map(attr => attr.toLowerCase().split(' ').join('')));
         return attributes.reduce((p, c) => row[c] || p, undefined);
      }

      return players;
   }

   load.importPlayerList = (rows, id) => {
      let player_list = [];
      rows.forEach(player => {
         let name = (player.first_name + player.last_name).trim();
         if (name) {
            player.puid = player.puid || UUID.new();

            player.hash = util.nameHash(name);
            player.birth = determineDate(player.birth);
            player.first_name = util.normalizeName(player.first_name, false);
            player.last_name = util.normalizeName(player.last_name, false);
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
         setTimeout(function() { displayGen.busy.done(id); }, 3000);
      }
   }

   function importFailure(what) {
      alert('Import Failed');
      console.log('Import Failed');
      console.log(what);
   }

   function importClubsCSV(clubs) {
      let callback = () => searchBox.searchSelect('clubs');
      let id = displayGen.busy.message('<p>Loading Clubs...</p>', callback);
      clubs.forEach(club => { 
         if (club.courts) {
            let courts = club.courts ? club.courts.split(',') : [0, 0];
            club.courts = { clay: courts[0], hard: courts[1] };
         }
         if (!club.courts) club.courts = {};
         if (club.clay) {
            club.courts.clay = club.clay;
            delete club.clay;
         }
         if (club.hard) {
            club.courts.hard = club.hard;
            delete club.hard;
         }
         if (club.carpet) {
            club.courts.carpet = club.carpet;
            delete club.carpet;
         }
         if (club.lights) {
            club.courts.lights = club.lights;
            delete club.lights;
         }
         if (club.covered) {
            club.courts.covered = club.covered;
            delete club.covered;
         }

         if (club.email) club.email = club.email.split(',');
         if (club.notes) delete club.notes;
      });
      util.performTask(db.addClub, clubs, false).then(() => displayGen.busy.done(id), () => displayGen.busy.done(id));
   }

   function importClubsJSON(clubs) {
      let callback = () => searchBox.searchSelect('clubs');
      let id = displayGen.busy.message('<p>Loading Clubs...</p>', callback);
      util.performTask(db.addClub, clubs, false).then(() => displayGen.busy.done(id), () => displayGen.busy.done(id));
   }

   function importRankings(rows) {
      return new Promise((resolve, reject) => {
         let id = displayGen.busy.message('<p>Loading Rankings...</p>');
         let rank_lists = {};
         if (!Array.isArray(rows)) return displayGen.busy.done(id);

         let categories = util.unique(rows.map(r=>staging.legacyCategory(r.category)));

         let category_rankings = categories.map(category => {
            let records = rows.filter(f=>f.category == category);
            let player_rankings = Object.assign({}, ...records.map(r => { return { [r.id]: r }}));
            return { category, players: player_rankings, date: new Date().getTime() };
         });

         util.performTask(db.addCategoryRankings, category_rankings, false).then(done, done);

         function done(foo) { 
            displayGen.busy.done(id); 
            return resolve();
         }
      });
   }

   function importTournaments(rows) {
      let callback = () => searchBox.searchSelect('tournaments');
      let id = displayGen.busy.message(`<p>${lang.tr('phrases.trnyz')}</p>`, callback);
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
               category: staging.legacyCategory(record.category),

            };
            console.log(tournament.category);
            if (record.id && tournament.name) tournaments.push(tournament);
         }
      });
      util.performTask(db.addTournament, tournaments, false).then(done, done);

      function done(foo) { 
         setTimeout(function() { displayGen.busy.done(id); }, 2000);
      }
   }

   load.addNewTournaments = (trnys) => {
      let callback = () => searchBox.searchSelect('tournaments');
      let id = displayGen.busy.message(`<p>${lang.tr('trnyz')}</p>`);
      console.log(id);
      util.performTask(db.addTournament, trnys, false).then(done, () => displayGen.busy.done(id));

      function done(foo) {
         console.log('done:', foo);
         displayGen.busy.done(id);
      }
   }

   load.findTournament = () => {
      return new Promise((resolve, reject) => {
         if (load.loaded.tournament && load.loaded.tournament.name) load.loaded.meta.name = load.loaded.tournament.name;

         // TODO: search for Tournament by name rather than requiring TournamentID to be entered
         let obj = displayGen.entryModal('tournaments.id', false, { x: (window.innerWidth / 2) - 100, y: window.innerHeight / 3 });
         displayGen.escapeModal(() => { newTournament().then(resolve, reject); });
         let entry_modal = d3.select(obj.entry_modal.element);
         let removeEntryModal = () => {
            entry_modal.remove();
            document.body.style.overflow = null;
            displayGen.escapeFx = undefined;
         }

         obj.search_field.element.addEventListener("keyup", function(e) { 
            if (e.which == 13) {
               let id = obj.search_field.element.value;
               if (id) {
                  removeEntryModal();
                  db.findTournament(id).then(checkTournament, reject).then(resolve, reject);
               } else {
                  removeEntryModal();
                  calendarFx.createNewTournament({ tournament_data: load.loaded.tournament, title: lang.tr('tournaments.new'), callback: receiveNewTournament })
                  function receiveNewTournament(tournament) {
                     if (tournament) {
                        setTournament(tournament).then(resolve, reject);
                     } else {
                        return reject();
                     }
                  }
               }
            }
         });

         entry_modal.on('click', () => {
            removeEntryModal();
            newTournament().then(resolve, reject);
         });

         function checkTournament(tournament) {
            return new Promise((resolve, reject) => {
               if (tournament) {
                  setTournament(tournament).then(resolve, reject);
               } else {
                  newTournament().then(resolve, reject);
               }
            });
         }

         function newTournament() {
            return new Promise((resolve, reject) => {
               tournamentDisplay.createNewTournament({ tournament_data: load.loaded.tournament, title: lang.tr('tournaments.new'), callback: receiveNewTournament });

               function receiveNewTournament(tournament) {
                  if (tournament) {
                     setTournament(tournament).then(resolve, reject);
                  } else {
                     return reject();
                  }
               }
            });
         }

         function setTournament(tournament) {
            return new Promise((resolve, reject) => {
               if (!tournament) return reject();
               tournament.category = staging.legacyCategory(tournament.category);

               if (!load.loaded.tournament) load.loaded.tournament = {};

               if (Object.keys(tournament).length) {
                  // load.loaded.tournament.sid = 'HTS';
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
                     load.loaded.meta.category = staging.legacyCategory(accepted.category);
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
            });
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

      let container = displayGen.identifyPlayers(load.loaded.meta.name, outstanding);
      let actions_element = d3.select(container.actions.element);

      actions_element
         .selectAll('button.ignore')
         .on('click', (d, i, elem) => { 
            d3.event.stopPropagation(); 
            let row = util.getParent(elem[i], 'section_row');
            tournamentDisplay.ignorePlayer(row);
         });

      actions_element
         .selectAll('.action_edit')
         .on('click', (d, i, elem) => { 
            d3.event.stopPropagation(); 
            tournamentDisplay.identifyPlayer(elem[i]); 
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
               let eligible_categories = rankCalc.eligibleCategories({ birth_day: result.birth, calc_date: load.loaded.date }).categories;
               // return eligible_categories.indexOf(load.loaded.tournament.category) >= 0 
               return util.isMember(eligible_categories, load.loaded.tournament.category);
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

   load.loadPlayersDragAndDrop = (dropzone, initFx, callback) => {
      let isAdvancedUpload = function() {
         let div = document.createElement('div');
         return (('draggable' in div) || ('ondragstart' in div && 'ondrop' in div)) && 'FormData' in window && 'FileReader' in window;
      }();

      let input = dropzone.querySelector('input[type="file"]');
      let label = dropzone.querySelector('label');
      let droppedFiles = false;
      let showFiles = (files) => {
         label.textContent = (files.length > 1)
            ? ( input.getAttribute( 'data-multiple-caption' ) || '' ).replace( '{count}', files.length ) 
            : files[ 0 ].name;
      };

      input.addEventListener('change', e => processFile(e.target.files));

      if (isAdvancedUpload) {
         dropzone.classList.add('has-advanced-upload');

         [ 'drag', 'dragstart', 'dragend', 'dragover', 'dragenter', 'dragleave', 'drop' ].forEach( function( event ) {
            dropzone.addEventListener( event, function(e) {
               e.preventDefault();
               e.stopPropagation();
            });
         });

         [ 'dragover', 'dragenter' ].forEach(function (event) { dropzone.addEventListener(event, () => dropzone.classList.add('is-dragover')); });
         [ 'dragleave', 'dragend', 'drop' ].forEach( function (event) { dropzone.addEventListener(event, () => dropzone.classList.remove('is-dragover')); });

         dropzone.addEventListener('drop', (e) => {
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
         loadPlayerFile(file, callback);
      };
   }

   function loadPlayerFile(file, callback) {
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
            loadWorkbook({ file_content, callback, accepted_types: ['UTR', 'CHi'] });
         } else if (load.loaded.meta.filetype == 'csv') {
            loadJSON({ json: CSV2JSON(file_content), valid: ['jotFormCSV'], callback });
         } else if (load.loaded.meta.filetype.indexOf('json') >= 0) {
            if (file_content.indexOf('"~') >= 0) {
               console.log('loadCircularJSON');
               // loadJSON({ json: CircularJSON.parse(file_content) });
            } else {
               console.log('loadJSON');
               // loadJSON({ json: JSON.parse(file_content) });
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
            loadWorkbook({ file_content });
         } else if (load.loaded.meta.filetype == 'csv') {
            loadJSON({ json: CSV2JSON(file_content) });
         } else if (load.loaded.meta.filetype.indexOf('json') >= 0) {
            if (file_content.indexOf('"~') >= 0) {
               loadJSON({ json: CircularJSON.parse(file_content) });
            } else {
               loadJSON({ json: JSON.parse(file_content) });
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

   load.loadJSON = loadJSON;
   function loadJSON({ json, valid, callback }) {
      if (!Object.keys(json).length && !json.length) return;

      let loadType = {
         draws() { loadDraws(json, callback); },
         matches() { loadMatches(json, callback); },
         clubs() { importClubsJSON(json, callback); },
         settings() { loadSettings(json, callback); },
         points()  { loadPointEvents(json, callback); },
         players()  { loadPlayerList(json, callback); },
         clubsCSV()  { importClubsCSV(json, callback); },
         playersCSV()  { loadPlayerList(json, callback); },
         ranklistCSV() { importRankings(json, callback); },
         tournaments() { loadTournaments(json, callback); },
         tournamentsCSV() { importTournaments(json, callback); },
         jotFormCSV() { importJotForm(json, callback); },
      };

      let data_type = identifyJSON(json);
      if (!data_type || (valid && valid.indexOf(data_type) < 0)) {
         displayMessage(lang.tr('phrases.badfile'));
      } else {
         loadType[data_type](callback);
      }
   }

   function identifyJSON(json) {
      let keys = Object.keys(Array.isArray(json) ? json[0] : json);

      if (keys.length && ['Submission Date', 'Submission ID'].filter(k=>keys.indexOf(k) >= 0).length == 2) return 'jotFormCSV';
      if (keys.length && ['id', 'category', 'ranking', 'points'].filter(k=>keys.indexOf(k) >= 0).length == 4) return 'ranklistCSV';
      if (keys.length && ['website', 'courts'].filter(k=>keys.indexOf(k) >= 0).length == 2) return 'clubs';
      if (keys.length && ['born', 'right_to_play'].filter(k=>keys.indexOf(k) >= 0).length == 2) return 'playersCSV';
      if (keys.length && ['start', 'end', 'draws'].filter(k=>keys.indexOf(k) >= 0).length == 3) return 'tournamentsCSV';
      if (keys.length && ['clay', 'hard', 'carpet'].filter(k=>keys.indexOf(k) >= 0).length == 3) return 'clubsCSV';

      if (keys.length && ['key', 'category'].filter(k=>keys.indexOf(k) >= 0).length == 2) return 'settings';
      if (keys.length && ['sex', 'puid'].filter(k=>keys.indexOf(k) >= 0).length == 2) return 'players';
      if (keys.length && ['muid', 'puids', 'score'].filter(k=>keys.indexOf(k) >= 0).length == 3) return 'matches';
      if (keys.length && ['muid', 'puid', 'points'].filter(k=>keys.indexOf(k) >= 0).length == 3) return 'points';

      if (keys.length && ['start', 'end', 'category'].filter(k=>keys.indexOf(k) >= 0).length == 3) return 'tournaments';
      if (keys.length && ['sid', 'tuid', 'old_id'].filter(k=>keys.indexOf(k) >= 0).length == 3) return 'tournaments';

      if (keys.length && ['titles', 'draws', 'details'].filter(k=>keys.indexOf(k) >= 0).length == 3) return 'draws';
   }

   function loadTask(fx, arr, what = '', callback) {
      if (displayGen.busy && what) displayGen.busy.message(`<p>Loading ${what}...</p>`);
      util.performTask(fx, Array.isArray(arr) ? arr : [arr], false).then(finish, finish);

      function finish(results) { 
         displayGen.busy.done();
         if (callback && typeof callback == 'function') callback();
      }
   }

   load.addAlias = ({alias, hash}) => {
      cache.aliases[alias] = hash;
   }

   load.addIgnore = ({hash, ioc}) => {
      let stored = `${hash}-IOC-${ioc}`;
      cache.ignored.push(stored);
   }

   function addDraw(draw) { console.log(draw); }

   function loadDraws(arr) { loadTask(addDraw, arr, 'Draws'); };
   function loadSettings(arr) {
      loadTask(db.addSetting, arr, 'Settings', reload);
   }
   function loadTournaments(arr) { loadTask(db.addTournament, arr, 'Tournaments'); };
   function loadPointEvents(arr) { loadTask(db.addPointEvent, arr.filter(e => e.points && e.puid), 'Points'); };

   function loadPlayerList(arr) { 
      let callback = () => searchBox.searchSelect('players');
      let id = displayGen.busy.message(`<p>${lang.tr('loading')}...</p>`, callback);
      load.importPlayerList(arr, id); 
   }

   let validMatch = (match) => match.players.length == [].concat(...match.teams).length;
   function loadMatches(match_array) { loadTask(db.addMatch, match_array.filter(m => validMatch(m)), 'Matches'); }

   function loadWorkbook({ file_content, callback, accepted_types }) {
      var workbook = XLSX.read(file_content, {type: 'binary'});
      load.loaded.workbook = workbook;

      let workbook_type = identifyWorkbook(workbook);

      if (accepted_types && accepted_types.indexOf(workbook_type) < 0) {
         return (typeof callback == 'function') ? callback([]) : false;
      }

      if (workbook_type == 'UTR') {
         let players = extractPlayers(workbook);
         // UTR format players don't get added to Player Database...  they can only be added to Tournament Players
         return (typeof callback == 'function') ? callback(players) : true;
      }

      if (workbook_type == 'tournament') {
         processWorkbook(workbook);
         let process = () => load.processPlayers().then(tournamentDisplay.processLoadedTournament, identifyPlayers);
         load.findTournament().then(process, util.logError);
      }

      if (workbook_type == 'CHi') {
         let id = displayGen.busy.message(`<p>${lang.tr('loading')}...</p>`);

         let players = extractPlayers(workbook);
         let tournaments = extractTournaments(workbook);
         let rankings = extractRankings(workbook);
         let clubs = extractClubs(workbook);

         let addPlayers = () => new Promise((resolve, reject) => util.performTask(db.addPlayer, players, false).then(resolve, resolve));
         let addTournaments = () => new Promise((resolve, reject) => util.performTask(db.addTournament, tournaments, false).then(resolve, resolve));
         let addClubs = () => new Promise((resolve, reject) => util.performTask(db.addClub, clubs, false).then(resolve, resolve));
         let addRankings = () => importRankings(rankings);

         if (typeof callback == 'function') {
            displayGen.busy.done(id);
            return callback(players);
         }

         addPlayers().then(addTournaments).then(addRankings).then(addClubs).then(done);
         function done() { displayGen.busy.done(id); reload(); }
      }
   }

   function extractPlayers(workbook) {
      let sheet_name;
      if (workbook.SheetNames.indexOf('Players') >= 0) sheet_name = 'Players';
      if (workbook.SheetNames.indexOf('Registrants') >= 0) sheet_name = 'Registrants';
      if (workbook.SheetNames.indexOf('Matched Players') >= 0) sheet_name = 'Matched Players';
      if (!sheet_name) return [];
      let headers = [ 
         { attr: 'id', header: 'ID' }, 
         { attr: 'last_name', header: 'Last Name' }, 
         { attr: 'last_name', header: 'Last', sheet_name: 'Matched Players' }, 
         { attr: 'first_name', header: 'First Name' }, 
         { attr: 'first_name', header: 'First', sheet_name: 'Matched Players' }, 
         { attr: 'full_name', header: 'Full Name' }, 
         { attr: 'city', header: 'City' }, 
         { attr: 'region', header: 'Region' }, 
         { attr: 'sex', header: 'Gender' }, 
         { attr: 'birth', header: 'Birthdate' }, 
         { attr: 'ioc', header: 'IOC' }, 
         { attr: 'puid', header: 'Unique Identifier' }, 
         { attr: 'club', header: 'Club ID' }, 
         { attr: 'club_name', header: 'Club Name' }, 
         { attr: 'school', header: 'School' }, 
         { attr: 'rating_utr_singles', header: 'Verified SinglesUtr' }, 
         { attr: 'rating_utr_singles', header: 'Rating', sheet_name: 'Matched Players' }, 
         { attr: 'rating_utr_singles_status', header: 'Verified SinglesUtr Status' }, 
         { attr: 'rating_utr_singles_status', header: 'RatingStatus' }, 
         { attr: 'rating_utr_doubles', header: 'Verified DoublesUtr' }, 
         { attr: 'rating_utr_doubles', header: 'DoublesRating', sheet_name: 'Matched Players' }, 
         { attr: 'rating_utr_doubles_status', header: 'Verified DoublesUtr Status' }, 
         { attr: 'rating_utr_doubles_status', header: 'RatingStatusDoubles' }, 
         { attr: 'ioc', header: 'Nationality' }, 
         { attr: 'email', header: 'Email' }, 
         { attr: 'phone', header: 'Phone' }, 
         { attr: 'school', header: 'School' }, 
         { attr: 'school', header: 'College' }, 
         { attr: 'profile', header: 'Profile' }, 
      ].filter(s=>!s.sheet_name || s.sheet_name == sheet_name);
      let players = extractWorkbookRows(workbook.Sheets[sheet_name], headers);
      players.forEach(player => {
         if (player.sex) {
            player.sex = player.sex.toUpperCase();
            if (player.sex == 'F') player.sex = 'W';
            if (['M', 'W'].indexOf(player.sex) < 0) delete player.sex;
         }
         let hackuuid = player.email || player.phone || player.profile;
         if (hackuuid) hackuuid = hackuuid.split('').reverse().join('');
         player.puid = player.puid || hackuuid || UUID.new();
         player.id = player.id || player.puid;
         if (player.birth) player.birth = player.birth.indexOf('-') < 0 ? parseFloat(player.birth) : new Date(player.birth).getTime();
         player.ioc = player.ioc ? (player.ioc.match(/\D+/g) || [])[0] : '';
         processRatings(player);
      });
      return players;
   }
   
   function processRatings(player) {
      let ratings = Object.keys(player).reduce((p, c) => c.indexOf('rating') == 0 || p, false);
      if (ratings) {
         if (!player.ratings) player.ratings = {};
         Object.keys(player).forEach(key => {
            if (key.indexOf('rating') == 0) {
               let attrs = key.split('_');
               let type = attrs && attrs.length >= 2 && attrs[1];
               if (type) {
                  if (!player.ratings[type]) player.ratings[type] = {};
                  let format = attrs && attrs.length >= 3 && attrs[2];
                  if (format && !player.ratings[type][format]) player.ratings[type][format] = {};
                  let status = attrs && attrs.length >= 4 && attrs[3];
                  if (format && status) {
                     if (!player.ratings[type][format].status) player.ratings[type][format].status = player[key];
                  } else if (format) {
                     player.ratings[type][format].value = player[key];
                  } else {
                     player.ratings[type].value = player[key]
                  }
               }
            }
         });
      }
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
         { attr: 'dbls', header: 'Dbls' }, 
      ]; 
      let rankings = extractWorkbookRows(workbook.Sheets.Rankings, headers);
      rankings.forEach(ranking => { ranking.category == staging.legacyCategory(ranking.category); });
      return rankings;
   }

   function extractClubs(workbook) {
      if (workbook.SheetNames.indexOf('Clubs') < 0) return [];
      let headers = [ 
         { attr: 'id', header: 'Club ID' }, 
         { attr: 'name', header: 'Name' }, 
      ]; 
      let clubs = extractWorkbookRows(workbook.Sheets.Clubs, headers);
      return clubs;
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
      if (util.intersection(sheets, ['CourtHive', 'Players']).length == 2) return 'CHi';
      if (util.intersection(sheets, ['Registrants', 'Matched Players']).length == 1) return 'UTR';
      return 'tournament';
   }

   function processWorkbook(workbook) {
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
                  first_name: util.normalizeName(player.first_name, false),
                  last_name: util.normalizeName(player.last_name, false),
                  club: player.club,
                  ioc: player.ioc,
               });
            }
         });

         load.loaded.date = undefined;
         load.loaded.players = all_players;

         /*
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
            load.loaded.tournament.category = staging.legacyCategory(load.loaded.tournament.category);
            load.loaded.meta.category = load.loaded.tournament.category;
         } else {
         */
            load.loaded.tournament = {
               name: workbook.Sheets[workbook.SheetNames[0]].A1.v,
               category: load.loaded.results.categories[0],
            };
         // }
      }
   }

   return load;
 
}();
