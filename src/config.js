var dev = {};

let config = function() {

   // module container
   var fx = {};

   // BEGIN queryString
   var queryString = {};
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

   function checkQueryString() {
      return new Promise((resolve, reject) => {
         if (queryString.actionKey) {
            coms.sendKey(queryString.actionKey);
            resolve();
         } else {
            resolve();
         }
      });
   }
   // END queryString

   var env = {
      version: '0.9.10',
      version_check: undefined,
      org: {
         name: undefined,
         abbr: undefined,
         ouid: undefined
      },
      auto_update: {
         players: false,
         registered_players: false,
      },
      map: undefined,
      map_provider: undefined, // 'google' or 'leaflet'
      orientation: undefined,
      reset_new_versions: false,
      geolocate: true,
      broadcast: true,
      livescore: false,
      autodraw: true,
      calendar: {
         start: undefined,
         end: undefined,
         category: undefined
      },
      drawFx: {
         auto_byes: true,
         auto_qualifiers: false,
         compressed_draw_formats: true,
         consolation_seeding: false
      },
      draws: {
         tree_draw: {
            flags: { display: true },
            schedule: {
               courts: true,
               after: true
            },
         },
         rr_draw: {},
      },
      default_score_format: {
         final_set_supertiebreak: false,
         games_for_set: 6,
         max_sets: 3,
         sets_to_win: 2,
         supertiebreak_to: 10,
         tiebreak_to: 7,
         tiebreaks_at: 6
      },
      publishing: {
         require_confirmation: true,
         publish_on_score_entry: false,
      },
      messages: []
   }

   // don't want accessor to be able to modify original
   fx.env = () => JSON.parse(JSON.stringify(env));

   fx.setCalendar = (obj) => Object.keys(obj).forEach(key => { if (Object.keys(env.calendar).indexOf(key) >= 0) env.calendar[key] = obj[key]; });
   fx.setMap = (map) => env.map = map;
   fx.addMessage = (msg) => {
      let msgHash = (m) => Object.keys(m).map(key => m[key]).join('');
      let message_hash = msgHash(msg);
      let exists = env.messages.reduce((p, c) => msgHash(c) ==  message_hash ? true : p, false);
      if (!exists) env.messages.push(msg);
      gen.homeIconState('messages');
   }

   fx.authMessage = (msg) => {
      db.findTournament(msg.tuid).then(pushMessage, err => console.log(err));

      function pushMessage(tournament) {
         if (tournament) {
            msg.inDB = true;
            msg.tournament = `${tournament.name}`;
            env.messages.push(msg);
            gen.homeIconState('authorized');
         } else {
            msg.tournament = "Not Found in Calendar";
            env.messages.push(msg);
            gen.homeIconState('notfound');
         }
      }
   }

   // not visible/accesible outside of this module
   var o = {
      components: {
         players: { add: true, calcs: false, ranklist: false },
         tournaments: true,
         clubs: false,
         tournament_search: true,
         club_search: true,
         settings: true,
         importexport: true,
         autodraw: true,
         keys: true
      },
      settings_tabs: {
         org: true,
         data: false,
         draws: true,
         publishing: true,
      },
      settings: {
         points_table: {
            validity: [ { from: "1900-01-01", to: "2100-12-31", table: "default" }, ],
            tables : {
               default: {
                  categories: {
                     "U10": { ages: { from:  7, to: 10 }, },
                     "U12": { ages: { from:  9, to: 12 }, },
                     "U14": { ages: { from: 10, to: 14 }, },
                     "U16": { ages: { from: 12, to: 16 }, },
                     "U18": { ages: { from: 13, to: 18 }, },
                     "S":   { ages: { from: 16, to: 100 }, }
                  },
                  rankings: { "1": {}, "2": {}, "3": {}, "4": {}, "5": {}, "6": {}, "7": {}, "8": {} }
               }
            }
         }
      }
   }

   // fx.o = () => JSON.parse(JSON.stringify(o));

   // This probably needs to be implemented differently...
   fx.settings = {
      categories: {
         externalRequest: [ 'fetchClubs', 'fetchNewPlayers', 'fetchNewTournaments', 'fetchRankList', 'fetchRegisteredPlayers' ],
         userInterface: [ 'defaultIdiom', ],
      },
   };

   function clearHistory() { history.pushState('', document.title, window.location.pathname); }

   fx.idiomSelector = () => {
      return new Promise((resolve, reject) => {
         var idiom = {
            "key": "defaultIdiom",
            "class": "userInterface",
            "ioc": "gbr"
         };

         let options = lang.options().sort().map(value => { 
            return { key: `<div class=''><img src="./assets/flags/${value.toUpperCase()}.png" class='idiom_flag'></div>`, value }
         });
         dd.attachDropDown({ id: 'idiomatic', options, style: 'background: black' });

         let onChange = (ioc) => { 
            lang.set(ioc);
            idiom.ioc = ioc;
            db.addSetting(idiom);
            splash();
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

   fx.updateSettings = updateSettings;
   function updateSettings(settings) {
      return new Promise((resolve, reject) => {
         if (!settings) resolve();
         db.db.settings.where('key').equals('superUser').delete().then(newSettings, reject);
         function newSettings() { Promise.all(settings.map(s=>db.addSetting(s))).then(resolve, reject) }
      });
   }

   function editSettings() {
      db.findAllSettings().then(displaySettings);

      function displaySettings(settings) {

         let external_request_settings = settings.filter(s=>s.category == 'externalRequest');

         let v = o.settings_tabs;
         let tabs = {
            org: v.org ? gen.orgSettings() : undefined,
            categories: v.categories ? gen.categorySettings() : undefined,
            points: v.points ? gen.pointsSettings() : undefined,
            draws: v.draws ? gen.drawSettings() : undefined,
            publishing: v.publishing ? gen.publishingSettings() : undefined,
            data: v.data ? gen.externalRequestSettings(external_request_settings) : undefined
         }

         let { container } = gen.settings(tabs);

         if (tabs.data && tabs.data.ddlb) {
            let external_file_options = [
               {key: `UTF-8`, value: 'url'},
               {key: `CP1250`, value: 'win'},
            ];
            tabs.data.ddlb.forEach(ddlb => {
               let ddlbkey = `${ddlb.key}_ddlb`;
               dd.attachDropDown({ id: container[ddlbkey].id, options: external_file_options });
               ddlb.dropdown = new dd.DropDown({ element: container[ddlbkey].element });
               ddlb.dropdown.selectionBackground();
               ddlb.dropdown.setValue(ddlb.value);
            });
         }

         if (container.save.element) container.save.element.addEventListener('click', saveSettings);
         if (container.cancel.element) container.cancel.element.addEventListener('click', revertSettings);

         if (v.draws) {
            container.compressed_draw_formats.element.addEventListener('click', compressedDrawFormats);
            container.compressed_draw_formats.element.checked = util.string2boolean(env.drawFx.compressed_draw_formats);
            function compressedDrawFormats(evt) { env.drawFx.compressed_draw_formats = container.compressed_draw_formats.element.checked; }

            container.auto_byes.element.addEventListener('click', automatedByes);
            container.auto_byes.element.checked = util.string2boolean(env.drawFx.auto_byes);
            function automatedByes(evt) { env.drawFx.auto_byes = container.auto_byes.element.checked; }

            container.display_flags.element.addEventListener('click', displayFlags);
            container.display_flags.element.checked = util.string2boolean(env.draws.tree_draw.flags.display);
            function displayFlags(evt) { env.draws.tree_draw.flags.display = container.display_flags.element.checked; }

            container.after_matches.element.addEventListener('click', afterMatches);
            container.after_matches.element.checked = util.string2boolean(env.draws.tree_draw.schedule.after);
            function afterMatches(evt) {
               env.draws.tree_draw.schedule.after = container.after_matches.element.checked;
               if (env.draws.tree_draw.schedule.after) {
                  container.court_detail.element.checked = true;
                  env.draws.tree_draw.schedule.courts = true;
               }
            }

            container.court_detail.element.addEventListener('click', matchCourts);
            container.court_detail.element.checked = util.string2boolean(env.draws.tree_draw.schedule.courts);
            function matchCourts(evt) {
               env.draws.tree_draw.schedule.courts = container.court_detail.element.checked;
               if (!env.draws.tree_draw.schedule.courts) {
                  env.draws.tree_draw.schedule.after = false;
                  container.after_matches.element.checked = false;
               }
            }
         }

         if (v.publishing) {
            container.require_confirmation.element.addEventListener('click', requireConfirmation);
            container.require_confirmation.element.checked = util.string2boolean(env.publishing.require_confirmation);
            function requireConfirmation(evt) {
               env.publishing.require_confirmation = container.require_confirmation.element.checked;
               if (env.publishing.require_confirmation) {
                  env.publishing.publish_on_score_entry = false;
                  container.publish_on_score_entry.element.checked = false;
               }
            }

            container.publish_on_score_entry.element.addEventListener('click', publishOnScoreEntry);
            container.publish_on_score_entry.element.checked = util.string2boolean(env.publishing.publish_on_score_entry);
            function publishOnScoreEntry(evt) {
               env.publishing.publish_on_score_entry = container.publish_on_score_entry.element.checked;
               if (env.publishing.publish_on_score_entry) {
                  env.publishing.require_confirmation = false;
                  container.require_confirmation.element.checked = false;
               }
            }
         }

         function revertSettings() {
            envSettings();
            gen.closeModal();
         }

         function saveSettings() {
            let settings = [];

            if (tabs.data && tabs.data.ddlb) {
               tabs.data.ddlb.forEach(item => {
                  let setting = {
                     key: item.key,
                     url: container[item.key].element.value,
                     type: item.dropdown.getValue(),
                     category: 'externalRequest',
                  }
                  settings.push(setting);
               });
            }

            settings.push({ key: 'publishingSettings', settings: env.publishing });
            settings.push({ key: 'drawSettings', settings: env.draws });
            settings.push({ key: 'drawFx', settings: env.drawFx });

            if (v.org) {
               settings.push(getImage('orgLogo', 'org_logo_display'));
               settings.push(getImage('orgName', 'org_name_display'));
            }

            updateSettings(settings).then(settingsLoaded, err => console.log('update settings failed:', err));
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
               let data = { hash: `${year}${week}rankings`, date: new Date(selected_date).getTime(), type: 'rankings', year, week, valid: true };
               db.addCalcDate(data);
            }, (err) => console.log(err));
         } else {
            gen.showModal(`<h2>${lang.tr('phrases.nopointcalcs')}</h2>`);
         }

         function pdfList(ev) {
            let category = ev.target.getAttribute('category');
            let gender = ev.target.getAttribute('gender');
            rank.rankListPDF({ category, gender, list: rankings.categories[category][gender], week, year, date: selected_date });
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
      if (o.components.tournament_search) searchBox.searchType.tournaments = function(tuid) {
         searchBox.active.tournament = { tuid };
         tournaments.displayTournament();
      };
      if (o.components.club_search) searchBox.searchType.clubs = function(cuid) {
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

      if (o.components.tournament_search) searchBox.populateSearch.tournaments = function() {
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

      if (o.components.club_search) searchBox.populateSearch.clubs = function() {
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

   // once the environment variables have been set notify dependents
   function settingsLoaded() { tournaments.settingsLoaded(); }

   function envSettings() {
      return new Promise((resolve, reject) => {
         db.findAllSettings().then(setEnv, resolve);

         function setEnv(settings) {

            let app = getKey('appComponents');
            if (app && app.components) {
               util.boolAttrs(app.components);
               util.keyWalk(app.components, o.components);
               env.autodraw = o.components.autodraw != undefined ? o.components.autodraw : true;
            }

            let org = getKey('orgData');
            if (org) { Object.keys(env.org).forEach(key => { if (org[key]) env.org[key] = org[key]; }); }

            let pt = getKey('pointsTable');
            if (pt) o.settings.points_table = pt.table;

            let td = getKey('treeDraw');
            if (td) {
               util.boolAttrs(td.options);
               env.draws.tree_draw = Object.assign(env.draws.tree_draw, td.options);
            }

            let draws = getKey('drawSettings');
            if (draws && draws.settings) {
               util.boolAttrs(draws.settings);
               util.keyWalk(draws.settings, env.draws);
            }

            let settings_tabs = getKey('settingsTabs');
            if (settings_tabs && settings_tabs.settings) {
               util.boolAttrs(settings_tabs.settings);
               util.keyWalk(settings_tabs.settings, o.settings_tabs);
            }

            let publishing = getKey('publishingSettings');
            if (publishing && publishing.settings) {
               util.boolAttrs(publishing.settings);
               util.keyWalk(publishing.settings, env.publishing);
            }

            let default_score_format = getKey('defaultScoreFormat');
            if (default_score_format && default_score_format.settings) {
               util.boolAttrs(default_score_format.settings);
               util.keyWalk(default_score_format.settings, env.default_score_format);
            }

            let draw_fx = getKey('drawFx');
            if (draw_fx && draw_fx.settings) {
               util.boolAttrs(draw_fx.settings);
               util.keyWalk(draw_fx.settings, env.drawFx);
            }

            let rd = getKey('rrDraw');
            if (rd) {
               util.boolAttrs(rd.options);
               env.draws.rr_draw = rd.options;
            }

            o.settings.uuuid = settings.reduce((p, c) => c.key == 'userUUID' ? c : p, undefined);
            if (!o.settings.uuuid) {
               o.settings.uuuid = UUID.generate();
               db.addSetting({ key: 'userUUID', value: o.settings.uuuid });
            }

            settingsLoaded();

            // turn off info labels...
            // if no info gen.info = '';
            resolve();

            function getKey(key) { return settings.reduce((p, c) => c.key == key ? c : p, undefined); }
         }
      });
   }

   fx.drawOptions = ({draw}) => {
      let type = draw.options().bracket ? 'rr_draw' : 'tree_draw';
      if (env.draws[type]) draw.options(env.draws[type]);
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

   var device = {
      isStandalone: 'standalone' in window.navigator && window.navigator.standalone,
      isIDevice: (/iphone|ipod|ipad/i).test(window.navigator.userAgent),
      isWindows: (/indows/i).test(window.navigator.userAgent),
      isMobile: /Mobi/.test(navigator.userAgent),
      geoposition: {},
   }

   fx.geoposition = () => { return device.geoposition; }

   // NOTICE: It may be necessary sometimes to have the point table equal to
   // the tournament start date rather than the tournament end or point calc date
   // for instance, if a tournament straddles the boundary between the valid
   // range of two differnt point tables...
   fx.pointsTable = ({ calc_date }) => {
      let org_tables = o.settings.points_table;

      if (!org_tables || !calc_date || !org_tables.validity) {
         return {};
      } else {
         // necessary to normalize getTime() values
         let calc_date_string = util.formatDate(calc_date);

         let calc_time = new Date(calc_date_string).getTime();
         let valid = org_tables.validity.reduce((p, c) => new Date(c.from).getTime() <= calc_time && new Date(c.to).getTime() >= calc_time ? c : p, undefined);
         return valid ? org_tables.tables[valid.table] : {};
      }
   }

   fx.orgCategories = ({calc_date}) => {
      let points_table = fx.pointsTable({calc_date});
      return fx.validPointsTable(points_table) ? Object.keys(points_table.categories) : [];
   }

   fx.eligibleCategories = ({age, calc_date}) => {
      let points_table = fx.pointsTable({calc_date});
      if (!fx.validPointsTable(points_table)) return [];
      let base_category = null;
      let minimum_age = 100;
      let ineligible = [];
      let categories = Object.keys(points_table.categories)
         .filter(category => {
            let c = points_table.categories[category];
            let from = parseInt(c.ages.from);
            let to = parseInt(c.ages.to);
            let valid = util.range(from, to+1).indexOf(age) >= 0;
            if (!valid) ineligible.push(category);
            if (valid && from < minimum_age) {
               minimum_age = from;
               base_category = category;
            }
            return valid;
         });
      return { categories, base_category, ineligible };
   }

   fx.orgCategoryOptions = ({calc_date=new Date()} = {}) => {
      let points_table = config.pointsTable({calc_date});
      let categories = [{key: '-', value: ''}].concat(...config.orgCategories({calc_date}).map(c=>({key: c, value: c})) );
      return categories;
   }

   fx.orgRankingOptions = ({calc_date=new Date()} = {}) => {
      let points_table = config.pointsTable({calc_date});
      let rankings = points_table.rankings ? Object.keys(points_table.rankings) : [];
      return [{key: '-', value: ''}].concat(...rankings.map(r=>({key: r, value: r})));
   }

   fx.validPointsTable = (table) => { return typeof table == 'object' && Object.keys(table).length; }

   fx.init = () => {
      gen.initModals();
      config.search();

      if (device.isMobile || device.isIDevice) {
         gen.showModal('<h2>Mobile Support Soon!</h2>', false);
         return;
      }

      coms.connectSocket();
      initDB();
      load.reset();

      // to disable context menu on the page
      document.oncontextmenu = () => false;
      window.addEventListener('contextmenu', (e) => { e.preventDefault(); }, false);

      function closeModal() { gen.escapeFx = undefined; gen.closeModal(); }
      function refreshApp() { location.reload(true); }
      function displayMessages() {
         gen.escapeModal();
         gen.homeContextMessage(refreshApp, closeModal, env.messages)
         env.messages = [];
         gen.homeIconState();
      }
      document.getElementById('go_home').addEventListener('contextmenu', displayMessages);
      document.getElementById('go_home').addEventListener('click', () => {
         if (env.messages && env.messages.length) {
            displayMessages();
         } else {
            splash()
         }
      });

      document.getElementById('refresh').addEventListener('click', () => updateAction());
      document.getElementById('refresh').addEventListener('contextmenu', () => refreshAction());

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
      env.version_check = new Date().getTime();
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
      let id = gen.busy.message(`<p>${lang.tr('refresh.players')}...</p>`, searchBox.updateSearch);
      let done = () => gen.busy.done(id);
      let addNew = (players) => load.processPlayers(players).then(done, done);
      let notConfigured = (err) => { done(); gen.popUpMessage((err && err.error) || lang.tr('phrases.notconfigured')); }
      coms.fetchNewPlayers().then(addNew, notConfigured);
   }

   function updateTournaments() {
      if (!navigator.onLine) return;
      let id = gen.busy.message(`<p>${lang.tr('refresh.calendar')}...</p>`, searchBox.updateSearch);
      let done = () => {
         gen.busy.done(id);
         if (gen.content == 'calendar') tournaments.displayCalendar();
      }
      let addNew = (trnys) => util.performTask(db.addTournament, trnys, false).then(done, done);
      let notConfigured = (err) => { done(); gen.popUpMessage((err && err.error) || lang.tr('phrases.notconfigured')); }
      coms.fetchNewTournaments().then(addNew, notConfigured);
   }

   function updateClubs() {
      if (!navigator.onLine) return;
      let id = gen.busy.message(`<p>${lang.tr('refresh.clubs')}...</p>`, searchBox.updateSearch);
      let done = () => gen.busy.done(id);
      let addNew = (clubs) => util.performTask(db.addClub, clubs, false).then(done, done);
      let notConfigured = (err) => { done(); gen.popUpMessage((err && err.error) || lang.tr('phrases.notconfigured')); }
      coms.fetchNewClubs().then(addNew, notConfigured);
   }

   function refreshAction() {
      if (searchBox.category == 'players') {
         let message = `${lang.tr('tournaments.renewlist')}<p><i style='color: red;'>(${lang.tr('phrases.deletereplace')})</i>`;
         gen.okCancelMessage(message, renewList, () => gen.closeModal());

         function renewList() {
            db.db.players.toCollection().delete().then(updateAction, () => gen.closeModal());
         }
      }; 
   }

   function updateAction() { 
      if (searchBox.category == 'players') updatePlayers(); 
      if (searchBox.category == 'tournaments') updateTournaments(); 
      if (searchBox.category == 'clubs') updateClubs(); 
   }

   function splash() {
      tournaments.reset();
      let container = gen.splashScreen(o.components, o.settings_tabs);

      splashEvent(container, 'tournaments', tournaments.displayCalendar);
      splashEvent(container, 'players', displayPlayers);
      splashEvent(container, 'clubs', displayClubs);
      splashEvent(container, 'settings', editSettings);
      splashEvent(container, 'importexport', displayImportExport);
      splashEvent(container, 'keys', displayKeyActions);

      if (env.org && env.org.name) {
         container.org.element.innerHTML = env.org.name;
      }

      // Revert behavior of search box to normal
      searchBox.normalFunction();

      if (!env.version_check || env.version_check + 86400000 < new Date().getTime()) {
         coms.emitTmx({ version: env.version });
         env.version_check = new Date().getTime();
      }

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
      if (o.components.players && o.components.players.add) {
         actions.add.element.style.display = 'flex';
         actions.add.element.addEventListener('click', () => player.createNewPlayer({ callback }));
      }

      if (o.components.players && o.components.players.calcs) {
         actions.pointCalc.element.style.display = 'flex';
         actions.pointCalc.element.addEventListener('click', () => config.pointCalc());
      }

      if (o.components.players && o.components.players.ranklist) {
         actions.rankCalc.element.style.display = 'flex';
         actions.rankCalc.element.addEventListener('click', () => config.rankCalc());
      }

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

   fx.legacyCategory = (category, reverse) => {
      let ctgy = category;
      if (fx.env().org.abbr == 'HTS') {
         let legacy = reverse ?  { '20': 'S', } : { 'S': '20', };

         if (legacy[ctgy]) ctgy = legacy[ctgy];
      }
      return ctgy;
   }

   return fx;

}();
