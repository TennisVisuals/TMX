let config = function() {

   let fx = {};
   let queryString = {};
   let idiom = {
      "key": "defaultIdiom",
      "class": "userInterface",
      "ioc": "cro"
   };

   let components = {
      players: true,
      tournaments: true,
      clubs: true,
      tournament_search: true,
      club_search: true,
      settings: true,
      importexport: true,
      autodraw: true,
      keys: false,
   }

   fx.settings = {
      categories: {
         externalRequest: [ 'fetchClubs', 'fetchNewPlayers', 'fetchNewTournaments', 'fetchRankList', 'fetchRegisteredPlayers' ],
         userInterface: [ 'defaultIdiom', ],
      },
   };

   let clearHistory = () => history.pushState('', document.title, window.location.pathname);

   (function () {
     let query = window.location.search.substring(1);
     let vars = query.split("&");
     for (let i=0;i<vars.length;i++) {
       let pair = vars[i].split("=");
       if (typeof queryString[pair[0]] === "undefined") {
         queryString[pair[0]] = pair[1];
       } else if (typeof queryString[pair[0]] === "string") {
         var arr = [ queryString[pair[0]], pair[1] ];
         queryString[pair[0]] = arr;
       } else {
         queryString[pair[0]].push(pair[1]);
       }
     } 
     clearHistory();
   })();

   fx.idiomSelector = () => {
      return new Promise((resolve, reject) => {
         let options = lang.options().sort().map(value => { 
            return { key: `<div class=''><img src="./assets/flags/${value.toUpperCase()}.png" class='idiom_flag'></div>`, value }
         });
         dd.attachDropDown({ id: 'idiomatic', options, style: 'background: black' });

         let onChange = (ioc) => { 
            lang.set(ioc);
            idiom.ioc = ioc;
            db.addSetting(idiom);
         }
         let idiom_ddlb = new dd.DropDown({ element: document.getElementById('idiomatic'), onChange });

         idiom_ddlb.setStyle('selection_value', 'black');
         idiom_ddlb.setStyle('selection_novalue', 'black');
         idiom_ddlb.selectionBackground('black');
         idiom_ddlb.setValue('gbr');

         let setIdiom = (params) => {
            // if there is no default setting, make it visible
            if (!params) {
               document.getElementById('idiomatic').style.opacity = 1;
               // save this as default so that flag is "subtle" for next visit
               onChange('gbr');
            }
            let ioc = params ? params.ioc : 'gbr';
            idiom_ddlb.setValue(ioc);
            idiom.ioc = ioc;
            lang.set(ioc);
            resolve();
         }
         db.findSetting('defaultIdiom').then(setIdiom, (error) => console.log('error:', error));
      });
   }

   // http://localhost:8065/devel/ranking/?settingsURL=http://hts.hr/pin/json/settings.json
   // https://courthive.com/tmx/?settingsURL=http://hts.hr/pin/json/settings.json
   function checkQueryString() {
      return new Promise((resolve, reject) => {
         if (queryString.settingsURL) {
            if (queryString.settingsURL.indexOf('http') != 0) return resolve();
            coms.fetchJSON(queryString.settingsURL).then(updateSettings, console.log).then(resolve, console.log);
         } else if (queryString.resetDB) {
            if (!queryString.resetDB.indexOf('true') == 0) return resolve();
            config.resetDB().then(resolve);
         } else if (queryString.actionKey) {
            coms.sendKey(queryString.actionKey);
            resolve();
         } else {
            resolve();
         }
      });
   }

   fx.updateSettings = updateSettings;
   function updateSettings(settings) {
      return new Promise((resolve, reject) => {
         if (!settings) resolve();
         dev.settings = settings;
         Promise.all(settings.map(s=>db.addSetting(s))).then(resolve)
      });
   }

   function editSettings() {
      db.findAllSettings().then(displaySettings);

      function displaySettings(settings) {
         let { container, external_requests } = gen.settings(settings);

         if (container.save.element) container.save.element.addEventListener('click', saveSettings);

         function saveSettings() {
            let settings = [];

            external_requests.ddlb.forEach(item => {
               let setting = {
                  key: item.key,
                  url: container[item.key].element.value,
                  type: item.dropdown.getValue(),
                  category: 'externalRequest',
               }
               settings.push(setting);
            });

            settings.push(getImage('orgLogo', 'org_logo_display'));
            settings.push(getImage('orgName', 'org_name_display'));

            updateSettings(settings);
            gen.closeModal();
         }
      }
   }

   function getImage(settings_key, image_id) {

      let elem = document.getElementById(image_id);
      let url = elem.querySelector('img').getAttribute('src')
      let setting = {
         key: settings_key,
         category: 'image',
         image: url
      }
      return setting;
   }

   function calendarCalcs(calendar, type) {
      db.findAllCalculations().then(calcs => {
         let df = {};
         calcs.filter(c=>c.type == type).forEach(d => util.weekDays(d.date).forEach(date => df[util.formatDate(date)] = d.valid ? .03 : -.03));
         calendar.data(df);
         calendar.fillDays();
      });
   }

   function pointCalc(selected_date) {
      if (selected_date) {
         gen.showProcessing('Calculating Ranking Points ...');
         rank.calcAllPlayerPoints(undefined, new Date(selected_date).getTime()).then(d=>gen.closeModal());
      }
   }

   fx.pointCalc = configurePointCalc;
   function configurePointCalc() {
      let date = new Date();
      let container = gen.pointCalcConfig();
      container.submit.element.addEventListener('click', () => callPointCalc(container));
      container.cancel.element.addEventListener('click', () => gen.closeModal());

      let cal = yearCal()
         .selector(container.datepicker.element)
         .sizeToFit(false)
         .width(800)
         .height(140)
      cal();

      calendarCalcs(cal, 'points');

      function callPointCalc(container) {
         gen.closeModal();
         let selected_date = cal.date() ? new Date(cal.date()) : date;
         selected_date = new Date(cal.date());
         pointCalc(selected_date);
      }
   }

   fx.rankCalc = configureRankCalc;
   function configureRankCalc() {
      let date = new Date();
      let container = gen.rankListConfig();
      container.submit.element.addEventListener('click', () => callRankCalc(container));
      container.cancel.element.addEventListener('click', () => gen.closeModal());

      let cal = yearCal()
         .selector(container.datepicker.element)
         .sizeToFit(false)
         .width(800)
         .height(140)
      cal();

      calendarCalcs(cal, 'rankings');

      function callRankCalc(container) {
         gen.closeModal();
         let selected_date = cal.date() ? new Date(cal.date()) : date;
         rankCalc(selected_date);
      }
   }

   function rankCalc(selected_date) {
      let week = rank.getWeek(selected_date.getTime()); 
      let year = selected_date.getFullYear();

      let dpp = (evt) => player.displayPlayerProfile(util.getParent(evt.target, 'player_rank').getAttribute('puid')).then(()=>{}, ()=>{});

      gen.showProcessing('Calculating Current Rank List ...');
      rank.calculateRankLists(week, year).then(categories => { 

         let rankings = { week, year, categories };
         gen.closeModal(); 

         if (Object.keys(categories).length) {
            let container = gen.rankLists(categories, week, year);

            util.addEventToClass('print', pdfList, container.container.element)
            util.addEventToClass('icon_spreadsheet', exportList, container.container.element)

            Array.from(container.container.element.querySelectorAll('.player_rank')).forEach(elem => elem.addEventListener('click', dpp));

            rank.addRankHistories(categories, selected_date).then(() => { 
               let data = { hash: `${year}${week}rankings`, date: selected_date, type: 'rankings', year, week, valid: true };
               db.addCalcDate(data);
            }, (err) => console.log(err));
         } else {
            // TODO: add to idioms
            gen.showModal(`<h2>${lang.tr('phrases.nopointcalcs')}</h2>`);
         }

         function pdfList(ev) {
            let category = ev.target.getAttribute('category');
            let gender = ev.target.getAttribute('gender');
            rank.rankListPDF({ category, gender, list: rankings.categories[category][gender] });
         }
         function exportList(ev) {
            let category = ev.target.getAttribute('category');
            let gender = ev.target.getAttribute('gender');
            let ranklist = {
               week,
               year,
               category,
               gender,
               list: rankings.categories[category][gender]
            };
            exp.rankListCSV(ranklist);
         }
      });

   }

   fx.search = () => {

      searchBox.element_id = 'searchinput';
      searchBox.meta_element_id = 'searchmeta';
      searchBox.count_element_id = 'searchcount';
      searchBox.category_element_id = 'searchcategory';
      searchBox.default_category = 'players';
      searchBox.setSearchCategory();

      /*
      // Disabling metaClick for rollout to Judges
      searchBox.metaClick = {
         tournaments() { tournaments.displayCalendar(); },
         players() { displayPlayers(); },
         clubs() { displayClubs(); },
      }
      */

      searchBox.searchType = {};
      searchBox.searchType.players = function(puid) {
         searchBox.active.player = { puid };
         if (gen.content == 'identify') {
            player.playerAssignment();
         } else {
            player.displayPlayerProfile(puid).then(()=>{}, ()=>{});
         }
      };
      if (components.tournament_search) searchBox.searchType.tournaments = function(tuid) {
         searchBox.active.tournament = { tuid };
         tournaments.displayTournament();
      };
      if (components.club_search) searchBox.searchType.clubs = function(cuid) {
         searchBox.active.club = { cuid };
         displayClub();
      };

      let searchMode = 'firstlast';
      searchBox.populateSearch = {};
      searchBox.populateSearch.players = function() {
         db.findAllPlayers().then(arr => {
            searchBox.searchCount(arr.length);
            searchBox.searchCategory('search_players_total');

            let firstlast = arr.map(player => { 
               let label = util.normalizeName([player.first_name, player.last_name].join(' '));
               if (player.birth) label += ` [${new Date(player.birth).getFullYear()}]`;
               return { value: player.puid, label, }
            });
            let lastfirst = arr.map(player => { 
               let label = `${util.normalizeName(player.last_name).toUpperCase()} ${util.normalizeName(player.first_name)}`;
               if (player.birth) label += ` [${new Date(player.birth).getFullYear()}]`;
               return { value: player.puid, label, }
            });

            if (searchMode == 'lastfirst') {
               searchBox.typeAhead.list = lastfirst;
            } else {
               searchBox.typeAhead.list = firstlast;
            }

         });
      };

      searchBox.contextMenu = (ev) => {
         if (searchBox.category == 'players') {
            let options = [lang.tr('search.firstlast'), lang.tr('search.lastfirst')];
            gen.svgModal({ x: ev.clientX, y: ev.clientY, options, callback: doSomething });

            function doSomething(choice, index) {
               if (index == 0) {
                  searchMode = 'firstlast';
               } else if (index == 1) {
                  searchMode = 'lastfirst';
               }
               searchBox.populateSearch.players();
            }
         }
      }

      if (components.tournament_search) searchBox.populateSearch.tournaments = function() {
         db.findAllTournaments().then(arr => {
            searchBox.searchCount(arr.length);
            searchBox.searchCategory('search_tournament_total');

            // exclude tournaments which don't have a category, start, or rank
            arr = arr.filter(f=>f.category && f.start && f.rank);
            let zeroPad = (number) => number.toString()[1] ? number : "0" + number;
            searchBox.typeAhead.list = !arr.length ? [] : arr.map(tournament => { 
               let category = tournament.category == 'S' ? 'S' : `U${tournament.category}`;
               let start_date = util.formatDate(new Date(tournament.start));
               let label = util.normalizeName(`${category} ${tournament.name} [${start_date}]`);
               return { value: tournament.tuid, label, }
            });
         });
      };

      if (components.club_search) searchBox.populateSearch.clubs = function() {
         db.findAllClubs().then(arr => {
            searchBox.searchCount(arr.length);
            searchBox.searchCategory('search_clubs_total');
            searchBox.typeAhead.list = !arr.length ? [] : arr.map(club => { 
               return { value: club.id, label: `${club.name} [${club.city}]` } 
            });
         });
      };
   }

   function initDB() {
      localStorage.ranking_version = env.version;
      db.initDB().then(checkQueryString).then(envSettings).then(DBReady);

      function DBReady() {
         config.idiomSelector().then(idiomsReady);
         load.loadCache();
         if (env.auto_update.players) { updatePlayers(); }

         function idiomsReady() {
            splash();
            searchBox.init();
            gen.onreset = splash;
         }
      }
   }

   function envSettings() {
      return new Promise((resolve, reject) => {
         db.findAllSettings().then(setEnv, resolve);

         function setEnv(settings) {

            let app = settings.reduce((p, c) => c.key == 'appComponents' ? c : p, undefined);
            if (app && app.components) {
               Object.keys(app.components).forEach(key => {
                  let bool = util.string2boolean(app.components[key]);
                  if (bool != undefined) components[key] = bool;
               });
            }

            env.autodraw = components.autodraw != undefined ? components.autodraw : true;

            let user = settings.reduce((p, c) => c.key == 'userUUID' ? c : p, undefined);
            if (!user) db.addSetting({ key: 'userUUID', value: UUID.generate() });

            // turn off info labels...
            // if no info gen.info = '';
            resolve();
         }
      });
   }

   fx.resetDB = () => {
      return new Promise((resolve, reject) => {
         let reload = () => window.location.replace(window.location.pathname);
         let okAction = () => db.resetDB(reload);
         let cancelAction = () => {
            clearHistory(); 
            gen.closeModal(); 
            resolve();
         }
         let message = `<div style='margin: 1em;'><h2>WARNING:</h2><p>Database will be reset</div>`;
         let container = gen.okCancelMessage(message, okAction, cancelAction);
      });
   }

   fx.init = () => {
      gen.initModals();
      config.search();

      if (device.isMobile || device.isIDevice) {
         gen.showModal('<h2>Mobile Support Soon!</h2>', false);
         return;
      }

      coms.connectSocket();

      let version = localStorage.ranking_version;
      if (!version || (env.reset_new_versions && version < env.version)) {
         console.log(version);
         // TODO: Is this still necessary?
         // db.resetDB(initDB);
         initDB();
      } else {
         initDB();
      }

      load.reset();

      // to disable context menu on the page
      document.oncontextmenu = () => false;
      window.addEventListener('contextmenu', (e) => { e.preventDefault(); }, false);

      document.getElementById('go_home').addEventListener('click', () => splash());

      function closeModal() { gen.closeModal(); }
      function refreshApp() { location.reload(true); }
      document.getElementById('go_home').addEventListener('contextmenu', () => gen.versionMessage(env.version, refreshApp, closeModal));

      document.getElementById('refresh').addEventListener('click', () => updateAction());

      let checkVisible = () => {
         document.getElementById('searchextra').style.display = window.innerWidth > 500 ? 'flex' : 'none'; 
         document.getElementById('idiomatic').style.display = window.innerWidth > 500 ? 'flex' : 'none'; 
      }
      let setOrientation = () => { env.orientation = (window.innerHeight > window.innerWidth) ? 'portrait' : 'landscape'; }
      window.addEventListener("orientationchange", function() { setOrientation(); }, false);
      window.addEventListener("resize", function() { setOrientation(); checkVisible(); }, false);
      setOrientation();

      if (env.map_provider == 'google') coms.loadGoogleMaps();

      // used to locate known tournaments in vicinity; auto-fill country
      if (env.geolocate && window.navigator.onLine) {
         window.navigator.geolocation.getCurrentPosition(pos => { 
            device.geoposition = pos;
            // if (window.location.hostname == 'localhost') return;
            coms.emitTmx({ 
               event: 'Connection',
               notice: `lat/lng: ${pos.coords.latitude}, ${pos.coords.longitude}`,
               latitude: pos.coords.latitude,
               longitude: pos.coords.longitude,
               version: env.version,
               agent: window.navigator.userAgent,
            });
         });
      } else {
         coms.emitTmx({
            event: 'Connection',
            notice: window.navigator.userAgent,
            version: env.version
         });
      }
   }

   function displayClub(cuid) {
      cuid = cuid || searchBox.active.club.cuid;
      db.findClub(cuid).then(findClubPlayers);

      function findClubPlayers(club) {
         let id_obj = gen.displayClub(club);
         id_obj.edit.element.addEventListener('click', () => toggleInputs(id_obj));
         id_obj.ranks.element.addEventListener('click', () => clubPlayerRanks(club));
         id_obj.players.element.addEventListener('click', () => clubPlayers(club));
      }

      function toggleInputs(id_obj) {
         gen.toggleInput(id_obj.name.element);
         gen.toggleInput(id_obj.code.element);
      }

   }

   // *********************************

   function newPlayer() {
      console.log('adding new player');
   }

   function newClub() {
      console.log('adding new club');
   }

   function clubPlayers() {
      console.log('club players');
   }

   function clubPlayerRanks() {
      console.log('club player ranks');
   }

   // placeholder function to test calendar color fill
   function tournamentFill(calendar, tournaments) {
      let df = {};
      [].concat(...tournaments.map(y => { 
         if (y.start && y.end) return d3.timeDays(y.start, y.end);
      }).filter(f=>f))
      .map(x => util.formatDate(x))
      .forEach(d => { if (!df[d]) df[d] = 0; df[d] += .0; });

      calendar.data(df);
      calendar.fillDays();
   }

   function updatePlayers() {
      if (!navigator.onLine) return;
      let id = busy.message(`<p>${lang.tr('refresh.players')}...</p>`, searchBox.updateSearch);
      let done = () => busy.done(id);
      let addNew = (players) => load.processPlayers(players).then(done, done);
      let notConfigured = (err) => { done(); gen.popUpMessage((err && err.error) || lang.tr('phrases.notconfigured')); }
      coms.fetchNewPlayers().then(addNew, notConfigured);
   }

   function updateTournaments() {
      if (!navigator.onLine) return;
      let id = busy.message(`<p>${lang.tr('refresh.calendar')}...</p>`, searchBox.updateSearch);
      let done = () => {
         busy.done(id);
         if (gen.content == 'calendar') tournaments.displayCalendar();
      }
      let addNew = (trnys) => util.performTask(db.addTournament, trnys, false).then(done, done);
      let notConfigured = () => { done(); gen.popUpMessage((err && err.error) || lang.tr('phrases.notconfigured')); }
      coms.fetchNewTournaments().then(addNew, notConfigured);
   }

   function updateClubs() {
      if (!navigator.onLine) return;
      let id = busy.message(`<p>${lang.tr('refresh.clubs')}...</p>`, searchBox.updateSearch);
      let done = () => busy.done(id);
      let addNew = (clubs) => util.performTask(db.addClub, clubs, false).then(done, done);
      let notConfigured = () => { done(); gen.popUpMessage((err && err.error) || lang.tr('phrases.notconfigured')); }
      coms.fetchNewClubs().then(addNew, notConfigured);
   }

   function updateAction() { 
      if (searchBox.category == 'players') updatePlayers(); 
      if (searchBox.category == 'tournaments') updateTournaments(); 
      if (searchBox.category == 'clubs') updateClubs(); 
   }

   function splash() {
      tournaments.reset();
      let container = gen.splashScreen(components);

      splashEvent(container, 'tournaments', tournaments.displayCalendar);
      splashEvent(container, 'players', displayPlayers);
      splashEvent(container, 'clubs', displayClubs);
      splashEvent(container, 'settings', editSettings);
      splashEvent(container, 'importexport', displayImportExport);
      splashEvent(container, 'keys', displayKeyActions);

      // Revert behavior of search box to normal
      searchBox.normalFunction();

      function splashEvent(container, child, fx) {
         if (container[child].element) container[child].element.addEventListener('click', fx);
      }
   }

   function displayKeyActions() {
      db.findSetting('superUser').then(setting => {
         let actions = gen.keyActions(setting && setting.auth); 
         actions.container.key.element.addEventListener('keyup', keyStroke);
         function keyStroke(evt) {
            if (evt.which == 13) {
               let value = actions.container.key.element.value;
               if (value) coms.sendKey(value);
               gen.closeModal();
            }
         }
      });
   }

   function displayImportExport() {
      let downloadDialogue = () => gen.popUpMessage('Download Database Tables<p><i>Not Implemented</i>');
      let actions = gen.importExport(); 
      actions.download.element.addEventListener('click', downloadDialogue);
      actions.template.element.addEventListener('click', gen.downloadTemplate);
      load.initDragAndDrop(load.reset);
   }

   function displayPlayers() {
      let actions = gen.playerActions(); 
      actions.add.element.addEventListener('click', () => player.createNewPlayer({ callback }));
      actions.pointCalc.element.addEventListener('click', () => config.pointCalc());
      actions.rankCalc.element.addEventListener('click', () => config.rankCalc());

      function callback(player) {
         console.log(player);
         player.puid = `pl${UUID.new()}`;
         player.id = player.puid;
         db.addPlayer(player);
         if (searchBox.category == 'players') {
            searchBox.updateSearch();
         }
      }
   }

   // TODO: create clubs.js
   function displayClubs() {
      let cc = (evt) => displayClub(util.getParent(evt.target, 'club_click').getAttribute('cuid'));

      db.findAllClubs().then(clubList, console.log); 

      function clubList(clubs) {
         let actions = gen.clubList(clubs);
         if (actions.add.element) actions.add.element.addEventListener('click', newClub);
         if (actions.download.element) actions.download.element.addEventListener('click', exp.clubsJSON);

         Array.from(actions.container.element.querySelectorAll('.club_click')).forEach(elem => {
            elem.addEventListener('click', cc);
         });
      }
   }

   // TODO: theme.js
   fx.theme = (which='black') => {
      // TODO: store theme objects theme table in db
      if (which == 'black') {
         document.getElementById('searchentry').style.background = 'black';
         document.getElementById('searchcount').style.color = 'white';
         document.getElementById('homeicon').className = `icon15 homeicon`;
      } else if (which == 'white') {
         document.getElementById('searchentry').style.background = 'white';
         document.getElementById('searchcount').style.color = 'black';
         document.getElementById('homeicon').className = `icon15 homeicon_black`;
      }
   }

   return fx;

}();
