import { db } from './db'
import { hts } from './hts';
import { UUID } from './UUID';
import { util } from './util';
import { coms } from './coms';
import { dd } from './dropdown';
import { lang } from './translator';
import { staging } from './staging';
import { rankCalc } from './rankCalc';
import { importFx } from './importFx';
import { messaging } from './messaging';
import { searchBox } from './searchBox';

// remove these dependencies by moving fx elsewhere!!
import { playerFx } from './playerFx';
import { displayGen } from './displayGen';
import { tournamentFx } from './tournamentFx';
import { tournamentDisplay } from './tournamentDisplay';

export const config = function() {

   // module container
   var fx = {};

   // server sends list during version check
   fx.available_idioms = [];

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
      // version is Major.minor.added.changed.fixed
      version: '0.9.90.125.59',
      version_check: undefined,
      searchMode: 'firstlast',
      org: {
         name: undefined,
         abbr: undefined,
         ouid: undefined
      },
      assets: {
         flags: '/media/flags/',
         ioc_codes: './assets/ioc_codes',
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
         category: undefined,
         first_day: 0
      },
      points: { walkover_wins: ['F'] },
      drawFx: {
         auto_byes: true,
         auto_qualifiers: false,
         fixed_bye_order: false,
         consolation_seeding: false,
         compressed_draw_formats: true,
         qualifying_bracket_seeding: true,
         consolation_from_elimination: true,
         consolation_from_qualifying: false,
         seed_limits: [ [0, 0], [4, 2], [11, 4], [21, 8], [41, 16], [97, 32] ],
         "seedPositions": {
            "1" : [["1", "0"]],
            "2" : [["0", "1"]],
            "3" : [["1", ".250"], [0, ".750"]],
            "5" : [["0", ".250"], [0, ".500"], [1, ".500"], [1, ".750"]],
            "9" : [["1", ".125"], [0, ".375"], [1, ".625"], [0, ".875"]],
            "13": [["0", ".125"], [1, ".375"], [0, ".625"], [1, ".875"]],
            "17": [["1", ".0625"], [0, ".1875"], [1, ".3125"], [0, ".4325"], [1, ".5625"], [0, ".6875"], [1, ".8125"], [0, ".9375"] ],
            "25": [["0", ".0625"], [1, ".1875"], [0, ".3125"], [1, ".4325"], [0, ".5625"], [1, ".6875"], [0, ".8125"], [1, ".9375"] ]
         }
      },
      draws: {
         tree_draw: {
            flags: { display: true },
            schedule: {
               courts: true,
               after: true
            },
            minimums: {
               singles: 2,
               doubles: 2
            }
         },
         rr_draw: {
            minimums: {
               singles: 3,
               doubles: 3
            }
         },
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
         require_confirmation: false,
         publish_on_score_entry: true,
      },
      delegation: false,
      messages: [],
      storage: undefined,
      notifications: undefined,
   }

   // don't want accessor to be able to modify original
   fx.env = () => JSON.parse(JSON.stringify(env));

   fx.setCalendar = (obj) => Object.keys(obj).forEach(key => { if (Object.keys(env.calendar).indexOf(key) >= 0) env.calendar[key] = obj[key]; });
   fx.setMap = (map) => env.map = map;
   fx.addMessage = (msg) => {
      msg.notice = msg.notice || msg.tournament;
      let msgHash = (m) => Object.keys(m).map(key => m[key]).join('');
      let message_hash = msgHash(msg);
      let exists = env.messages.reduce((p, c) => msgHash(c) ==  message_hash ? true : p, false);
      if (!exists) env.messages.push(msg);
      displayGen.homeIconState(msg.state || 'messages');
   }

   fx.authMessage = (msg) => {
      db.findTournament(msg.tuid).then(pushMessage, err => console.log(err));

      function pushMessage(tournament) {
         if (tournament) {
            tournamentExists(tournament);
         } else if (msg.tournament) {
            let tournament = CircularJSON.parse(msg.tournament);
            db.addTournament(tournament).then(() => tournamentExists(tournament), noTournament);
         } else {
            noTournament();
         }

         function tournamentExists(tournament) {
            msg.inDB = true;
            msg.notice = `${tournament.name}`;
            env.messages.push(msg);
            displayGen.homeIconState('authorized');
         }

         function noTournament() {
            msg.notice = "Not Found in Calendar";
            env.messages.push(msg);
            displayGen.homeIconState('notfound');
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
         general: true,
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

   // This probably needs to be implemented differently...
   fx.settings = {
      categories: {
         externalRequest: [ 'fetchClubs', 'fetchNewPlayers', 'fetchNewTournaments', 'fetchRankList', 'fetchRegisteredPlayers' ],
         userInterface: [ 'defaultIdiom', ],
      },
   };

   function clearHistory() { history.pushState('', document.title, window.location.pathname); }

   function idiomLimit(opts) {
      var ioc_opts = opts.map(o=>`<div class='flag_opt' ioc='${o.value}' title='${o.title}'>${o.key}</div>`).join('');
      let html = `<div class='flag_wrap'>${ioc_opts}</div>`;
      displayGen.showProcessing(html);
      displayGen.escapeModal();
      util.addEventToClass('flag_opt', selectIOC);
      function selectIOC(evt) {
         let elem = util.findUpClass(evt.target, 'flag_opt');
         let ioc = elem.getAttribute('ioc');
         changeIdiom(ioc);
         displayGen.closeModal();
      }
   }

   dd.attachDropDown({ id: 'idiomatic', });
   fx.idiom_ddlb = new dd.DropDown({ element: document.getElementById('idiomatic'), onChange: changeIdiom, max: 15, maxFx: idiomLimit });
   fx.idiom_ddlb.selectionBackground('black');

   fx.changeIdiom = changeIdiom;
   function changeIdiom(ioc) {
      if (lang.set(ioc)) {
         fx.idiom_ddlb.setValue(ioc, 'black');
         // fx.idiom_ddlb.selectionBackground('black');
         splash();
      } else {
         if (ioc && ioc.length == '3') coms.sendKey(`${ioc}.idiom`);
      }
   }

   fx.idiomSelectorOptions = idiomSelectorOptions;
   function idiomSelectorOptions(ioc) {
      d3.json('./assets/ioc_codes.json', data => {
         let ioc_idioms = Object.assign({}, ...data.map(d => ({ [d.ioc]: d.name })));

         let idioms = Object.keys(fx.available_idioms);
         if (!idioms.length) idioms = lang.options();
         let options = idioms
            .sort()
            .map(value => {
               let ioc_value = value.length == 3 ? value : 'gbr';
               let img_src = `${env.assets.flags}${ioc_value.toUpperCase()}.png`;
               return { key: `<div class=''><img src="${img_src}" class='idiom_flag'></div>`, value, title: ioc_idioms[value.toUpperCase()] }
            })
            .filter(f=>f.title);
         fx.idiom_ddlb.setOptions(options)
         fx.idiom_ddlb.setValue(ioc, 'black');
         // fx.idiom_ddlb.selectionBackground('black')
      });
   }

   function idiomSelector() {
      return new Promise((resolve, reject) => {
         function setupIdioms(params) {
            let ioc = params ? params.ioc : 'gbr';
            idiomSelectorOptions(ioc);

            // if there is no default setting, make it visible
            if (!params) {
               document.getElementById('idiomatic').style.opacity = 1;
               // save this as default so that flag is "subtle" for next visit
               changeIdiom('gbr');
            } else if (!lang.set(ioc)) {
               coms.sendKey(`${ioc}.idiom`);
            }

            resolve();
         }

         db.findAllIdioms().then(prepareIdioms, util.logError);

         function prepareIdioms(idioms) {
            idioms.forEach(lang.define);
            db.findSetting('defaultIdiom').then(setupIdioms, util.logError);
         }
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
            general: v.general ? displayGen.generalSettings() : undefined,
            org: v.org ? displayGen.orgSettings() : undefined,
            categories: v.categories ? displayGen.categorySettings() : undefined,
            points: v.points ? displayGen.pointsSettings() : undefined,
            draws: v.draws ? displayGen.drawSettings() : undefined,
            publishing: v.publishing ? displayGen.publishingSettings() : undefined,
            data: v.data ? displayGen.externalRequestSettings(external_request_settings) : undefined
         }

         let tabdata = [];
         if (tabs.org && tabs.org.html) tabdata.push({ tab: lang.tr('settings.organization'), content: tabs.org.html });
         if (tabs.general && tabs.general.html) tabdata.push({ tab: lang.tr('settings.general'), content: tabs.general.html });
         if (tabs.categories && tabs.categories.html) tabdata.push({ tab: lang.tr('settings.categories'), content: tabs.categories.html });
         if (tabs.points && tabs.points.html) tabdata.push({ tab: lang.tr('settings.points'), content: tabs.points.html });
         if (tabs.draws && tabs.draws.html) tabdata.push({ tab: lang.tr('settings.draws'), content: tabs.draws.html });
         if (tabs.publishing && tabs.publishing.html) tabdata.push({ tab: lang.tr('settings.publishing'), content: tabs.publishing.html });
         if (tabs.data && tabs.data.html) tabdata.push({ tab: lang.tr('settings.data'), content: tabs.data.html });

         let { container } = displayGen.tabbedModal({ tabs, tabdata, title: lang.tr('set') });

         let org_logo = document.getElementById('org_logo');
         if (org_logo) {
            org_logo.addEventListener('change', evt => exportFx.handleFileUpload(evt, 'orgLogo', 'org_logo_display'));
            db.findSetting('orgLogo').then(url => displayGen.displayImage('getLogo', url, 'org_logo_display'), console.log);
         }

         let org_name = document.getElementById('org_name');
         if (org_name) {
            org_name.addEventListener('change', evt => exportFx.handleFileUpload(evt, 'orgName', 'org_name_display'));
            db.findSetting('orgName').then(url => displayGen.displayImage('getName', url, 'org_name_display'), console.log);
         }

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
               ddlb.dropdown.setValue(ddlb.value, 'white');
            });
         }

         if (container.save.element) container.save.element.addEventListener('click', saveSettings);
         if (container.cancel.element) container.cancel.element.addEventListener('click', revertSettings);

         if (v.draws) {
            container.fixed_bye_order.element.addEventListener('click', fixedByeOrder);
            container.fixed_bye_order.element.checked = util.string2boolean(env.drawFx.fixed_bye_order);
            function fixedByeOrder(evt) { env.drawFx.fixed_bye_order = container.fixed_bye_order.element.checked; }

            container.auto_byes.element.addEventListener('click', automatedByes);
            container.auto_byes.element.checked = util.string2boolean(env.drawFx.auto_byes);
            function automatedByes(evt) {
               env.drawFx.auto_byes = container.auto_byes.element.checked;
               container.fixed_bye_order.element.disabled = !env.drawFx.auto_byes;
            }
            container.fixed_bye_order.element.disabled = !env.drawFx.auto_byes;

            container.compressed_draw_formats.element.addEventListener('click', compressedDrawFormats);
            container.compressed_draw_formats.element.checked = util.string2boolean(env.drawFx.compressed_draw_formats);
            function compressedDrawFormats(evt) { env.drawFx.compressed_draw_formats = container.compressed_draw_formats.element.checked; }

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

         if (v.general) {
            container.first_day.element.addEventListener('click', firstDay);
            container.first_day.element.checked = env.calendar.first_day;
            function firstDay(evt) { env.calendar.first_day = container.first_day.element.checked ? 1 : 0; }
         }

         function revertSettings() {
            envSettings();
            displayGen.closeModal();
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
            settings.push({ key: 'envSettings', settings: { calendar: { first_day: env.calendar.first_day }} });

            if (v.org) {
               settings.push(getImage('orgLogo', 'org_logo_display'));
               settings.push(getImage('orgName', 'org_name_display'));
            }

            updateSettings(settings).then(settingsLoaded, err => console.log('update settings failed:', err));
            displayGen.closeModal();
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

   function configureCalc(mode) {
      if (!mode || ['points', 'rankings'].indexOf(mode) < 0) return;
      let date = new Date();
      let container = displayGen.dateConfig();

      var ds = displayGen.dateSelector({
         date: new Date(),
         date_element: container.picked.element,
         container: container.datepicker.element,
      });

      displayGen.escapeModal();
      container.submit.element.addEventListener('click', callCalc);
      container.cancel.element.addEventListener('click', () => displayGen.closeModal());

      function callCalc(container) {
         displayGen.closeModal();
         if (mode == 'rankings') {
            rankCalc.rankCalc(ds.getDate());
         } else {
            rankCalc.pointCalc(ds.getDate());
         }
      }
   }

   fx.search = () => {
      searchBox.element_id = 'searchinput';
      searchBox.meta_element_id = 'searchmeta';
      searchBox.count_element_id = 'searchcount';
      searchBox.category_element_id = 'searchcategory';
      searchBox.default_category = 'players';
      searchBox.setSearchCategory();

      searchBox.metaClick = {
         tournaments() { tournamentDisplay.displayCalendar(); },
         // players() { displayPlayers(); },
         // clubs() { displayClubs(); },
      }

      searchBox.searchType = {};
      searchBox.searchType.players = function(puid) {
         searchBox.active.player = { puid };
         if (displayGen.content == 'identify') {
            playerFx.playerAssignment();
         } else {
            playerFx.displayPlayerProfile({ puid }).then(()=>{}, ()=>{});
         }
      };
      if (o.components.tournament_search) searchBox.searchType.tournaments = function(tuid) {
         searchBox.active.tournament = { tuid };
         tournamentDisplay.displayTournament();
      };
      if (o.components.club_search) searchBox.searchType.clubs = function(cuid) {
         searchBox.active.club = { cuid };
         displayClub();
      };

      searchBox.populateSearch = {};
      searchBox.populateSearch.players = function({filtered} = {}) {
         var filter_values = searchBox.typeAhead._list.map(l=>l.value);
         db.findAllPlayers().then(arr => {
            searchBox.searchCount(arr.length);
            searchBox.searchCategory('search_players_total');

            if (filtered) arr = arr.filter(el => filter_values.indexOf(el.puid) >= 0);

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

            if (env.searchMode == 'lastfirst') {
               searchBox.typeAhead.list = lastfirst;
            } else {
               searchBox.typeAhead.list = firstlast;
            }

         });
      };

      searchBox.contextMenu = (ev) => {
         if (searchBox.category == 'players') {
            let options = [lang.tr('search.firstlast'), lang.tr('search.lastfirst')];
            displayGen.svgModal({ x: ev.clientX, y: ev.clientY, options, callback: doSomething });

            function doSomething(choice, index) {
               if (index == 0) {
                  env.searchMode = 'firstlast';
               } else if (index == 1) {
                  env.searchMode = 'lastfirst';
               }
               searchBox.populateSearch.players({filtered: true});
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
         persistStorage();
         idiomSelector().then(idiomsReady);
         importFx.loadCache();
         if (env.auto_update.players) { updatePlayers(); }

         function idiomsReady() {
            splash();
            searchBox.init();
            displayGen.onreset = splash;
         }
      }
   }

   // once the environment variables have been set notify dependents
   function settingsLoaded() {
      tournamentDisplay.settingsLoaded(env);
      tournamentFx.settingsLoaded(env);
   }

   fx.receiveSettings = receiveSettings;
   function receiveSettings(data) {
      db.findSetting('keys').then(updateKey, updateKey);
      function updateKey(setting={key: 'keys', keys:[]}) {
         setting.keys = setting.keys.filter(k=>k.keyid != data.keyid);
         setting.keys.push({ keyid: data.keyid, description: data.description });
         db.addSetting(setting).then(update, update);
      }
      function update() { updateSettings(data.content).then(()=>envSettings().then(setIdiom, util.logError), util.logError); }
      function setIdiom() { db.findSetting('defaultIdiom').then(checkIdiom, util.logError); }
      function checkIdiom(idiom) {
         if (lang.set() != idiom.ioc) changeIdiom(idiom.ioc);
         displayGen.closeModal();
         splash();
      }
   }

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

            let misc = getKey('envSettings');
            if (misc && misc.settings) {
               util.boolAttrs(misc.settings);
               util.keyWalk(misc.settings, env);
            }

            let draws = getKey('drawSettings');
            if (draws && draws.settings) {
               util.boolAttrs(draws.settings);
               util.keyWalk(draws.settings, env.draws);
            }

            // TODO: all keys need to replace 'treeDraw' with 'drawSettings'
            let td = getKey('treeDraw');
            if (td) {
               util.boolAttrs(td.options);
               env.draws.tree_draw = Object.assign(env.draws.tree_draw, td.options);
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
            // if no info displayGen.info = '';
            resolve();

            function getKey(key) { return settings.reduce((p, c) => c.key == key ? c : p, undefined); }
         }
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
      let points_table = fx.pointsTable({calc_date});
      let categories = [{key: '-', value: ''}].concat(...fx.orgCategories({calc_date}).map(c=>({key: c, value: c})) );
      return categories;
   }

   fx.orgRankingOptions = ({calc_date=new Date()} = {}) => {
      let points_table = fx.pointsTable({calc_date});
      let rankings = points_table.rankings ? Object.keys(points_table.rankings) : [];
      return [{key: '-', value: ''}].concat(...rankings.map(r=>({key: r, value: r})));
   }

   fx.validPointsTable = (table) => { return typeof table == 'object' && Object.keys(table).length; }

   function handleUnhandled() {
      window.onunhandledrejection = (event) => {
         event.preventDefault();
         let reason = event.reason;
         let message = reason && (reason.stack || reason);
         if (message.indexOf('blocked') > 0) {
            displayGen.escapeModal();
            let notice = `<p>${lang.tr('phrases.blocked')}</p><p>${lang.tr('phrases.enablepopups')}</p>`;
            displayGen.okCancelMessage(notice, () => displayGen.closeModal('processing'));
         } else {
            console.warn('Unhandled promise rejection:', (reason && (reason.stack || reason)));
         }
      };
   }

   function persistStorage() {
      if (navigator.storage && navigator.storage.persist) {
         navigator.storage.persist().then(persistent => {
            env.storage = persistent ? true : 'user agent control'
            coms.emitTmx({ 
               event: 'Persistence',
               notice: `Persistence: ${env.storage}`,
               persistent
            });
            if (env.storage != true ) {
               fx.addMessage({
                  title: 'warn',
                  notice: 'Data Persistence Not Guaranteed; save locally or publish to server before closing your browser.',
                  warning: true
               });
            }
         }, notSupported);
      } else {
         env.messages.push({ title: 'warn', notice: 'Data Persistence Not Supported', warning: true });
         displayGen.homeIconState('warning');
         notSupported();
      }

      function notSupported(err) {
         if (err) console.log('Persistence error:', err);
         coms.emitTmx({ 
            event: 'Persistence',
            notice: `Persistence Not Supported`,
            persistent: false
         });
      }
   }

   function enableNotifications() {
      // TODO: future, once server and service workers implemented...
      Notification.requestPermission(granted => {
         env.notifications = granted;
      });
   }

   function configufeDependents() {
      displayGen.fx.env = fx.env;
      displayGen.fx.legacyCategory = fx.legacyCategory;
      displayGen.fx.settings = fx.settings;
      displayGen.fx.setMap = fx.setMap;
      displayGen.fx.pointsTable = fx.pointsTable;
      displayGen.fx.orgCategoryOptions = fx.orgCategoryOptions;

      playerFx.fx.env = fx.env;
      playerFx.fx.legacyCategory = fx.legacyCategory;
      playerFx.fx.pointsTable = fx.pointsTable;

      tournamentDisplay.fx.env = fx.env;
      tournamentDisplay.fx.drawOptions = fx.drawOptions;
      tournamentDisplay.fx.setCalendar = fx.setCalendar;
      tournamentDisplay.fx.legacyCategory = fx.legacyCategory;
      tournamentDisplay.fx.pointsTable = fx.pointsTable;
      tournamentDisplay.fx.orgCategoryOptions = fx.orgCategoryOptions;
      tournamentDisplay.fx.orgCategories = fx.orgCategories;
      tournamentDisplay.fx.orgRankingOptions = fx.orgRankingOptions;

      tournamentFx.fx.env = fx.env;
      tournamentFx.fx.legacyCategory = fx.legacyCategory;

      coms.fx.popUpMessage = displayGen.popUpMessage;
   }

   fx.init = () => {
      displayGen.initModals();
      if (device.isMobile || device.isIDevice) {
         displayGen.showModal('<h2>Mobile Support Soon!</h2>', false);
         return;
      }

      // remove config dependence on displayGen so this can be removed
      configufeDependents();

      console.log('version:', env.version);

      // enableNotifications();

      fx.search();

      staging.init();
      coms.connectSocket();
      initDB();
      importFx.reset();

      // to disable context menu on the page
      document.oncontextmenu = () => false;
      window.addEventListener('contextmenu', (e) => { e.preventDefault(); }, false);

      handleUnhandled();

      function closeModal() { displayGen.escapeFx = undefined; displayGen.closeModal(); }
      function refreshApp() {
         location.pathname = "/tmx/";
         // location.reload(true);
      }
      function displayMessages() {
         displayGen.escapeModal();
         displayGen.homeContextMessage(refreshApp, closeModal, env.messages, tournamentDisplay.displayTournament)
         env.messages = [];
         displayGen.homeIconState();
      }
      document.getElementById('go_home').addEventListener('contextmenu', displayMessages);
      document.getElementById('go_home').addEventListener('click', () => {
         if (env.messages && env.messages.length && env.messages.filter(m=>m.title != 'tournaments.unofficial').length) {
            displayMessages();
         } else {
            splash()
         }
      });

      var refresh_icon = document.getElementById('refresh');
      var searchextra = document.getElementById('searchextra');
      refresh_icon.addEventListener('click', () => updateAction());
      refresh_icon.addEventListener('contextmenu', () => refreshAction());
      searchextra.addEventListener('mouseover', showRefresh);
      searchextra.addEventListener('mouseout', hideRefresh);

      function showRefresh() { refresh_icon.style.opacity = 1; }
      function hideRefresh() { refresh_icon.style.opacity = 0; }

      let checkVisible = () => {
         document.getElementById('searchextra').style.display = window.innerWidth > 500 ? 'flex' : 'none'; 
         document.getElementById('idiomatic').style.display = window.innerWidth > 500 ? 'flex' : 'none'; 
      }
      let setOrientation = () => { env.orientation = (window.innerHeight > window.innerWidth) ? 'portrait' : 'landscape'; }
      window.addEventListener("orientationchange", function() { setOrientation(); }, false);
      window.addEventListener("resize", function() { setOrientation(); checkVisible(); }, false);
      setOrientation();

      if (env.map_provider == 'google') messaging.loadGoogleMaps();

      coms.emitTmx({
         event: 'Connection',
         notice: window.navigator.userAgent,
         client: 'tmxv',
         version: env.version
      });

      // used to locate known tournaments in vicinity; auto-fill country
      if (env.geolocate && window.navigator.onLine) {
         window.navigator.geolocation.getCurrentPosition(pos => { 
            device.geoposition = pos;
            coms.emitTmx({ 
               event: 'Connection',
               notice: `lat/lng: ${pos.coords.latitude}, ${pos.coords.longitude}`,
               latitude: pos.coords.latitude,
               longitude: pos.coords.longitude,
            });
         });
      }
      env.version_check = new Date().getTime();
   }

   function displayClub(cuid) {
      cuid = cuid || searchBox.active.club.cuid;
      db.findClub(cuid).then(findClubPlayers);

      function findClubPlayers(club) {
         let id_obj = displayGen.displayClub(club);
         id_obj.edit.element.addEventListener('click', () => toggleInputs(id_obj));
         id_obj.ranks.element.addEventListener('click', () => clubPlayerRanks(club));
         id_obj.players.element.addEventListener('click', () => clubPlayers(club));
      }

      function toggleInputs(id_obj) {
         displayGen.toggleInput(id_obj.name.element);
         displayGen.toggleInput(id_obj.code.element);
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
      let id = displayGen.busy.message(`<p>${lang.tr('refresh.players')}...</p>`, searchBox.updateSearch);
      let done = () => displayGen.busy.done(id);
      let addNew = (players) => importFx.processPlayers(players).then(done, done);
      let notConfigured = (err) => { done(); displayGen.popUpMessage((err && err.error) || lang.tr('phrases.notconfigured')); }
      messaging.fetchNewPlayers().then(addNew, notConfigured);
   }

   fx.updateTournaments = updateTournaments;
   function updateTournaments({ merge }={}) {
      if (!navigator.onLine) return;
      let id = displayGen.busy.message(`<p>${lang.tr('refresh.calendar')}...</p>`, searchBox.updateSearch);
      let done = () => {
         displayGen.busy.done(id);
         if (displayGen.content == 'calendar') tournamentDisplay.displayCalendar();
      }
      let addNew = (trnys) => util.performTask(db.addTournament, trnys, false).then(done, done);
      let mergeTournaments = (trnys) => util.performTask(mergeTournament, trnys, false).then(done, done);
      let notConfigured = (err) => { done(); displayGen.popUpMessage((err && err.error) || lang.tr('phrases.notconfigured')); }
      if (merge) {
         messaging.fetchNewTournaments(merge).then(mergeTournaments, notConfigured);
      } else {
         messaging.fetchNewTournaments().then(addNew, notConfigured);
      }

      function mergeTournament(trny) {
         return new Promise((resolve, reject) => {
            db.findTournament(trny.tuid).then(mergeExisting, util.logError);
            function mergeExisting(existing) {
               if (!existing) {
                  db.addTournament(trny).then(resolve, reject);
               } else {
                  resolve();
               }
            }
         });
      }
   }

   function updateClubs() {
      if (!navigator.onLine) return;
      let id = displayGen.busy.message(`<p>${lang.tr('refresh.clubs')}...</p>`, searchBox.updateSearch);
      let done = () => displayGen.busy.done(id);
      let addNew = (clubs) => util.performTask(db.addClub, clubs, false).then(done, done);
      let notConfigured = (err) => { done(); displayGen.popUpMessage((err && err.error) || lang.tr('phrases.notconfigured')); }
      messaging.fetchNewClubs().then(addNew, notConfigured);
   }

   function refreshAction() {
      if (searchBox.category == 'players') {
         let message = `${lang.tr('tournaments.renewlist')}<p><i style='color: red;'>(${lang.tr('phrases.deletereplace')})</i>`;
         displayGen.okCancelMessage(message, renewList, () => displayGen.closeModal());

         function renewList() {
            db.db.players.toCollection().delete().then(updateAction, () => displayGen.closeModal());
         }
      }; 
      if (searchBox.category == 'tournaments') {
         let message = `${lang.tr('tournaments.renewlist')}`;
         displayGen.okCancelMessage(message, mergeList, () => displayGen.closeModal());
         function mergeList() { updateTournaments({ merge: true }); }
      }; 
   }

   function updateAction() { 
      if (window.navigator.onLine) {
         if (searchBox.category == 'players') updatePlayers(); 
         if (searchBox.category == 'tournaments') updateTournaments(); 
         if (searchBox.category == 'clubs') updateClubs(); 
      } else {
         displayGen.okCancelMessage(lang.tr('phrases.cantrefresh'), () => displayGen.closeModal());
      }
   }

   function splash() {
      tournamentDisplay.reset();
      let container = displayGen.splashScreen(o.components, o.settings_tabs);

      splashEvent(container, 'tournaments', tournamentDisplay.displayCalendar);
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
      db.findSetting('keys').then(setting => {
         let actions = displayGen.keyActions(setting && setting.keys); 
         actions.container.key.element.addEventListener('keyup', keyStroke);
         function keyStroke(evt) {
            if (evt.which == 13) {
               let value = actions.container.key.element.value;
               if (value) coms.sendKey(value);
               displayGen.closeModal();
            }
         }
         if (actions.container.select.element) {
            actions.container.select.element.addEventListener('click', submitKey);
         }
         function submitKey(value) {
            let selection = actions.container.keys.ddlb.getValue();
            if (selection) coms.sendKey(selection);
         }
      });
   }

   function displayImportExport() {
      let actions = displayGen.importExport(); 
      actions.download.element.addEventListener('click', exportData);
      actions.template.element.addEventListener('click', displayGen.downloadTemplate);
      importFx.initDragAndDrop(importFx.reset);
   }

   function exportData() {
      var tabs = {
//         players: displayGen.exportRange({ label: lang.tr('bd'), id_names: { start: 'py_start', end: 'py_end', export: 'py_export' }}),
         points: displayGen.exportRange({ id_names: { start: 'pt_start', end: 'pt_end', export: 'pt_export' }}),
         matches: displayGen.exportRange({ id_names: { start: 'mt_start', end: 'mt_end', export: 'mt_export' }}),
      }

      var tabdata = [];
      if (tabs.players && tabs.players.html) tabdata.push({ tab: lang.tr('pyr'), content: tabs.players.html });
      if (tabs.points && tabs.points.html) tabdata.push({ tab: lang.tr('pts'), content: tabs.points.html });
      if (tabs.matches && tabs.matches.html) tabdata.push({ tab: lang.tr('emts'), content: tabs.matches.html });

      var { container } = displayGen.tabbedModal({ tabs, tabdata, title: lang.tr('phrases.exportdata'), save: false });

      var start = new Date();
      var end = new Date();
      var dates = { pt_start: start, pt_end: end, py_start: start, py_end: end, mt_start: start, mt_end: end }

      if (container.py_start) displayGen.dateRange({
         start: dates.py_start,
         start_element: container.py_start.element,
         startFx: (date)=>{ dates.py_start = date; },
         end: dates.py_end,
         end_element: container.py_end.element,
         endFx: (date)=>{ dates.py_end = date; }
         });
      displayGen.dateRange({
         start: dates.pt_start,
         start_element: container.pt_start.element,
         startFx: (date)=>{ dates.pt_start = date; },
         end: dates.pt_end,
         end_element: container.pt_end.element,
         endFx: (date)=>{ dates.pt_end = date; }
      });
      displayGen.dateRange({
         start: dates.mt_start,
         start_element: container.mt_start.element,
         startFx: (date)=>{ dates.mt_start = date; },
         end: dates.mt_end,
         end_element: container.mt_end.element,
         endFx: (date)=>{ dates.mt_end = date; }
      });

      if (container.cancel.element) container.cancel.element.addEventListener('click', () => displayGen.closeModal());
      if (container.py_export) container.py_export.element.addEventListener('click', downloadPlayers);
      if (container.pt_export) container.pt_export.element.addEventListener('click', downloadPoints);
      if (container.mt_export) container.mt_export.element.addEventListener('click', downloadMatches);

      function downloadPlayers() {
         // Abandoned for now because database indexes by 'birthdate' instead of 'birth'
         db.findPlayersRange(dates.py_start.getTime(), dates.py_end.getTime()).then(pyz => {
            if (!pyz || !pyz.length) {
               displayGen.okCancelMessage(lang.tr('noresults'), () => displayGen.closeModal('processing'));
               return;
            }
            console.log(pyz);
         });
      }

      function downloadPoints() {
         db.findPointsRange(dates.pt_start.getTime(), dates.pt_end.getTime()).then(pts => {
            if (!pts || !pts.length) {
               displayGen.okCancelMessage(lang.tr('noresults'), () => displayGen.closeModal('processing'));
               return;
            }

            // TODO: check whether there is a configuration setting for organization
            let config_option = (env.org.abbr == 'HTS') ? true : false;
            if (!config_option) {
               exportFx.downloadArray('points.json', pts);
            } else {
               let text = `${lang.tr('phrases.export')}: ${lang.tr('pts')}`;
               let choices = displayGen.twoChoices({ text, option1: 'JSON', option2: 'HTS' });
               choices.option1.element.addEventListener('click', () => {
                  exportFx.downloadArray('points.json', pts);
                  displayGen.closeModal('configmodal');
               });
               choices.option2.element.addEventListener('click', () => {
                  hts.downloadHTSformattedPoints({points: pts});
                  displayGen.closeModal('configmodal');
               });
            }
         });
      }

      // TODO: data cleaning project...
      function downloadMatches() {
         db.findMatchesRange(dates.mt_start.getTime(), dates.mt_end.getTime()).then(mtz => {
            if (!mtz || !mtz.length) {
               displayGen.okCancelMessage(lang.tr('noresults'), () => displayGen.closeModal('processing'));
               return;
            }

            // remove points and rankings
            mtz.forEach(match => match.players.forEach(player => { delete player.points; delete player.rankings; }));

            let text = `${lang.tr('phrases.export')}: ${lang.tr('mts')}`;
            let choices = displayGen.twoChoices({ text, option1: 'JSON', option2: 'UTR' });
            choices.option1.element.addEventListener('click', () => {
               exportFx.downloadArray('matches.json', mtz);
               displayGen.closeModal('configmodal');
            });
            choices.option2.element.addEventListener('click', () => {
               downloadUTRmatches(mtz);
               displayGen.closeModal('configmodal');
            });
         });

         function downloadUTRmatches(matches) {
            let match_records = exportFx.matchRecords(matches);
            let csv = exportFx.json2csv(match_records);
            exportFx.downloadText('UTR-Matches.csv', csv);
         }
      }

   }

   function displayPlayers() {
      let actions = displayGen.playerActions(); 
      if (o.components.players && o.components.players.add) {
         actions.add.element.style.display = 'flex';
         actions.add.element.addEventListener('click', () => playerFx.createNewPlayer({ callback }));
      }

      if (o.components.players && o.components.players.calcs) {
         actions.pointCalc.element.style.display = 'flex';
         actions.pointCalc.element.addEventListener('click', () => configureCalc('points'));
      }

      if (o.components.players && o.components.players.ranklist) {
         actions.rankCalc.element.style.display = 'flex';
         actions.rankCalc.element.addEventListener('click', () => configureCalc('rankings'));
      }

      function callback(player) {
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
         let actions = displayGen.clubList(clubs);
         if (actions.add.element) actions.add.element.addEventListener('click', newClub);
         if (actions.download.element) actions.download.element.addEventListener('click', exportFx.clubsJSON);

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
