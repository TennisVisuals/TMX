import { db } from './db'
import { env } from './env'
import { UUID } from './UUID';
import { util } from './util';
import { coms } from './coms';
import { dd } from './dropdown';
import { tmxTour } from './tmxTour';
import { fetchFx } from './fetchFx';
import { lang } from './translator';
import { staging } from './staging';
import { pointsFx } from './pointsFx';
import { playerFx } from './playerFx';
import { exportFx } from './exportFx';
import { rankCalc } from './rankCalc';
import { importFx } from './importFx';
import { searchBox } from './searchBox';
import { displayGen } from './displayGen';
import { calendarFx } from './calendarFx';
import { scheduleFx } from './scheduleFx';
import { tournamentFx } from './tournamentFx';
import { eventManager } from './eventManager';
import { tournamentDisplay } from './tournamentDisplay';

export const config = function() {

   window.onerror = function (msg, url, lineNo, columnNo, error) {
     console.log('error:', message);
     return false;
   }
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
     util.clearHistory();
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

   eventManager.holdAction = (target, coords) => {
      let click_context = util.getParent(target, 'contextAction');
      let action = click_context && click_context.getAttribute('contextaction');
      if (eventManager.holdActions[action]) eventManager.holdActions[action](target, coords);
   }

   eventManager.register('tiny_docs_icon', 'tap', contextDocs);

   function contextDocs(target) {
      let click_context = util.getParent(target, 'doclink');
      let url = click_context.getAttribute('url');
      if (url) window.open(`/docs/${env.ioc}/${url}.html`, '_blank');
   }

   eventManager.register('tiny_tour_icon', 'tap', contextTour);

   function contextTour(target) {
      let click_context = util.getParent(target, 'tourlink');
      let context = click_context.getAttribute('context');
      if (context) tmxTour.tournamentTours(context);
   }

   eventManager.register('hints_icon', 'tap', contextHints);

   function contextHints(target) {
      let click_context = util.getParent(target, 'hintslink');
      let context = click_context.getAttribute('context');
      if (context) tmxTour.tournamentHints(context);
   }

   function displayMessages() {
      displayGen.escapeModal();
      displayGen.homeContextMessage(refreshApp, closeModal, env.messages, tournamentDisplay.displayTournament)
      env.messages = [];
      displayGen.homeIconState();
   }

   function closeModal() { displayGen.escapeFx = undefined; displayGen.closeModal(); }

   function refreshApp() {
      location.pathname = "/tmx/";
      delete fetchFx.update;
   }

   fx.addMessage = (msg) => {
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

   var device = {
      isStandalone: 'standalone' in window.navigator && window.navigator.standalone,
      isIDevice: (/iphone|ipod|ipad/i).test(window.navigator.userAgent),
      isIpad: (/iPad/i).test(window.navigator.userAgent),
      isWindows: (/indows/i).test(window.navigator.userAgent),
      isMobile: /Mobi/.test(navigator.userAgent),
   }

   // not visible/accesible outside of this module
   var o = {
      components: {
         players: { add: true, manage: false, teams: false, leagues: false, calcs: false, ranklist: false },
         tournaments: true,
         clubs: false,
         tournament_search: true,
         club_search: true,
         settings: true,
         documentation: true,
         importexport: !device.isMobile && !device.isIpad,
         datastorage: false,
         keys: true
      },
      settings_tabs: {
         org: true,
         printing: true,
         general: true,
         search: true,
         data: false,
         draws: true,
         publishing: true,
         schedule: true,
      },
      export_tabs: {
         players: false,
         matches: false,
         points: false
      },
      data_tabs: {
         sheets: true,
         server: false,
      }
   }

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
         env.ioc = ioc;
         splash();
      } else {
         if (ioc && ioc.length == '3') coms.sendKey(`${ioc}.idiom`);
      }
   }

   fx.idiomSelectorOptions = idiomSelectorOptions;
   function idiomSelectorOptions(ioc) {
      let ioc_codes = env.ioc_codes || [];
      let ioc_idioms = Object.assign({}, ...ioc_codes.map(d => ({ [d.ioc]: d.name })));
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
   }

   function idiomSelector() {
      return new Promise((resolve, reject) => {
         function setupIdioms(params) {
            env.ioc = params ? params.ioc : 'gbr';
            idiomSelectorOptions(env.ioc);

            // if there is no default setting, make it visible
            if (!params) {
               env.first_time_user = true;
               document.getElementById('idiomatic').style.opacity = 1;
               // save this as default so that flag is "subtle" for next visit
               changeIdiom('gbr');
            } else if (!lang.set(env.ioc)) {
               coms.sendKey(`${env.ioc}.idiom`);
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
         newSettings();
         function newSettings() { Promise.all(settings.map(s=>db.addSetting(s))).then(resolve, reject) }
      });
   }

   function editSettings() {
      db.findAllSettings().then(displaySettings, util.logError);

      function displaySettings(settings) {
         let external_request_settings = settings.filter(s=>s.category == 'externalRequest');

         let v = o.settings_tabs;
         let tabs = {
            general: v.general ? displayGen.generalSettings() : undefined,
            org: v.org ? displayGen.orgSettings() : undefined,
            printing: v.printing ? displayGen.printingSettings() : undefined,
            categories: v.categories ? displayGen.categorySettings() : undefined,
            points: v.points ? displayGen.pointsSettings() : undefined,
            search: v.search ? displayGen.searchSettings() : undefined,
            draws: v.draws ? displayGen.drawSettings() : undefined,
            publishing: v.publishing ? displayGen.publishingSettings() : undefined,
            schedule: v.schedule ? displayGen.scheduleSettings() : undefined,
            data: v.data ? displayGen.externalRequestSettings(external_request_settings) : undefined
         }

         let tabdata = [];
         if (tabs.org && tabs.org.html) tabdata.push({ tab: lang.tr('settings.organization'), content: tabs.org.html });
         if (tabs.general && tabs.general.html) tabdata.push({ tab: lang.tr('settings.general'), content: tabs.general.html });
         if (tabs.search && tabs.search.html) tabdata.push({ tab: lang.tr('settings.search'), content: tabs.search.html });
         if (tabs.categories && tabs.categories.html) tabdata.push({ tab: lang.tr('settings.categories'), content: tabs.categories.html });
         if (tabs.points && tabs.points.html) tabdata.push({ tab: lang.tr('settings.points'), content: tabs.points.html });
         if (tabs.draws && tabs.draws.html) tabdata.push({ tab: lang.tr('settings.draws'), content: tabs.draws.html });
         if (tabs.publishing && tabs.publishing.html) tabdata.push({ tab: lang.tr('settings.publishing'), content: tabs.publishing.html });
         if (tabs.printing && tabs.printing.html) tabdata.push({ tab: lang.tr('settings.printing'), content: tabs.printing.html });
         if (tabs.schedule && tabs.schedule.html) tabdata.push({ tab: lang.tr('sch'), content: tabs.schedule.html });
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

            container.ll_all_rounds.element.addEventListener('click', llAllRounds);
            container.ll_all_rounds.element.checked = util.string2boolean(env.drawFx.ll_all_rounds);
            function llAllRounds(evt) { env.drawFx.ll_all_rounds = container.ll_all_rounds.element.checked; }

            container.consolationalts.element.addEventListener('click', consolationAlts);
            container.consolationalts.element.checked = util.string2boolean(env.drawFx.consolation_alternates);
            function consolationAlts(evt) { env.drawFx.consolation_alternates = container.consolationalts.element.checked; }

            container.qualconsolation.element.addEventListener('click', qualConsolation);
            container.qualconsolation.element.checked = util.string2boolean(env.drawFx.consolation_from_qualifying);
            function qualConsolation(evt) { env.drawFx.consolation_from_qualifying = container.qualconsolation.element.checked; }

            container.consolationseeds.element.addEventListener('click', consolationSeeding);
            container.consolationseeds.element.checked = util.string2boolean(env.drawFx.consolation_seeding);
            function consolationSeeding(evt) { env.drawFx.consolation_seeding = container.consolationseeds.element.checked; }

            container.restrictseeds.element.addEventListener('click', restrictSeeds);
            container.restrictseeds.element.checked = util.string2boolean(env.draws.tree_draw.seeds.restrict_placement);
            function restrictSeeds(evt) { env.draws.tree_draw.seeds.restrict_placement = container.restrictseeds.element.checked; }

            // Separate By

            container.separate_by_ioc.element.addEventListener('click', separateIOCs);
            container.separate_by_ioc.element.checked = util.string2boolean(env.drawFx.separation.ioc);
            function separateIOCs(evt) {
               if (container.separate_by_ioc.element.checked) {
                  container.separate_by_club.element.checked = false;
                  container.separate_by_school.element.checked = false;
               }
               setSeparateBy();
            }

            container.separate_by_club.element.addEventListener('click', separateClubs);
            container.separate_by_club.element.checked = util.string2boolean(env.drawFx.separation.club_code);
            function separateClubs(evt) {
               if (container.separate_by_club.element.checked) {
                  container.separate_by_ioc.element.checked = false;
                  container.separate_by_school.element.checked = false;
               }
               setSeparateBy();
            }

            container.separate_by_school.element.addEventListener('click', separateSchools);
            container.separate_by_school.element.checked = util.string2boolean(env.drawFx.separation.school);
            function separateSchools(evt) {
               if (container.separate_by_school.element.checked) {
                  container.separate_by_ioc.element.checked = false;
                  container.separate_by_club.element.checked = false;
               }
               setSeparateBy();
            }

            function setSeparateBy() {
               env.drawFx.separation.ioc = container.separate_by_ioc.element.checked;
               env.drawFx.separation.school = container.separate_by_school.element.checked;
               env.drawFx.separation.club_code = container.separate_by_club.element.checked;
            }

            // END separate by

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

            container.match_time.element.addEventListener('click', displayMatchTime);
            container.match_time.element.checked = util.string2boolean(env.draws.tree_draw.schedule.times);
            function displayMatchTime(evt) { env.draws.tree_draw.schedule.times = container.match_time.element.checked; }

            container.match_date.element.addEventListener('click', displayMatchDates);
            container.match_date.element.checked = util.string2boolean(env.draws.tree_draw.schedule.dates);
            function displayMatchDates(evt) { env.draws.tree_draw.schedule.dates = container.match_date.element.checked; }
         }

         if (v.search) {
            container.lastfirst.element.addEventListener('click', searchMode);
            container.lastfirst.element.checked = util.string2boolean(env.searchbox.lastfirst);
            function searchMode(evt) {
               env.searchbox.lastfirst = container.lastfirst.element.checked;
               searchBox.populateSearch.players();
            }

            container.diacritics.element.addEventListener('click', supportDiacritics);
            container.diacritics.element.checked = util.string2boolean(env.searchbox.diacritics);
            function supportDiacritics(evt) {
               env.searchbox.diacritics = container.diacritics.element.checked;
               searchBox.populateSearch.players();
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

            container.publish_draw_creation.element.addEventListener('click', publishDrawCreation);
            container.publish_draw_creation.element.checked = util.string2boolean(env.publishing.publish_draw_creation);
            function publishDrawCreation(evt) { env.publishing.publish_draw_creation = container.publish_draw_creation.element.checked; }
         }

         if (v.printing) {
            container.save_pdfs.element.addEventListener('click', savePDFs);
            container.save_pdfs.element.checked = env.printing.save_pdfs;
            function savePDFs(evt) { env.printing.save_pdfs = container.save_pdfs.element.checked ? 1 : 0; }
         }

         if (v.general) {
            container.first_day.element.addEventListener('click', firstDay);
            container.first_day.element.checked = env.calendar.first_day;
            function firstDay(evt) { env.calendar.first_day = container.first_day.element.checked ? 1 : 0; }

            container.documentation.element.addEventListener('click', showDocs);
            container.documentation.element.checked = env.documentation;
            function showDocs(evt) { env.documentation = container.documentation.element.checked ? 1 : 0; }
         }

         if (v.schedule) {
            container.scores_in_draw_order.element.addEventListener('click', scoresInDrawOrder);
            container.scores_in_draw_order.element.checked = env.schedule.scores_in_draw_order;
            function scoresInDrawOrder(evt) { env.schedule.scores_in_draw_order = container.scores_in_draw_order.element.checked ? true : false; }

            container.completed_matches_in_search.element.addEventListener('click', scheduleCompleted);
            container.completed_matches_in_search.element.checked = env.schedule.completed_matches_in_search;
            function scheduleCompleted(evt) { env.schedule.completed_matches_in_search = container.completed_matches_in_search.element.checked ? true : false; }
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

            settings.push({ key: 'searchSettings', settings: env.searchbox });
            settings.push({ key: 'publishingSettings', settings: env.publishing });
            settings.push({ key: 'printingSettings', settings: env.printing });
            settings.push({ key: 'drawSettings', settings: env.draws });
            settings.push({ key: 'scheduleSettings', settings: env.schedule });
            settings.push({ key: 'drawFx', settings: env.drawFx });
            settings.push({ key: 'envSettings', settings: { documentation: env.documentation, calendar: { first_day: env.calendar.first_day }} });

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
         ds.destroy();
      }
   }

   fx.search = () => {
      searchBox.element_id = 'searchinput';
      searchBox.meta_element_id = 'searchmeta';
      searchBox.count_element_id = 'searchcount';
      searchBox.search_select_id = 'search_select';
      searchBox.category_element_id = 'searchcategory';
      searchBox.default_category = 'players';
      searchBox.setSearchCategory();

      searchBox.resetFx.push(playerFx.resetPlayerAction);

      searchBox.metaClick = {
         tournaments() { calendarFx.displayCalendar(); },
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
      searchBox.populateSearch.players = function({ filtered } = {}) {
         var filter_values = filtered ? searchBox.typeAhead._list.map(l=>l.value) : undefined;

         playerFx.optionsAllPlayers({ filter_values }).then(setSearchList, util.logError);

         function setSearchList(arr) { 
            searchBox.searchCount(arr.length);
            searchBox.searchCategory('search_players_total');
            searchBox.typeAhead.list = arr;
         }
      };

      searchBox.contextMenu = (ev) => {
         if (searchBox.category == 'players') {
            let options = [lang.tr('search.firstlast'), lang.tr('search.lastfirst')];
            displayGen.svgModal({ x: ev.clientX, y: ev.clientY, options, callback: doSomething });

            function doSomething(choice, index) {
               if (index == 0) {
                  env.searchbox.lastfirst = false;
               } else if (index == 1) {
                  env.searchbox.lastfirst = true;
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
      coms.catcyAsync(db.initDB)().then(checkQueryString, dbUpgrade).then(envSettings).then(DBReady);
      function dbUpgrade() { displayGen.showConfigModal('<h2>Database Upgraded</h2><div style="margin: 1em;">Please refresh your cache or load tmx+</div>'); }

      function DBReady() {
         coms.connectAction();
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
      tournamentDisplay.settingsLoaded();
      tournamentFx.settingsLoaded();
      // pointsFx.settingsLoaded(env);
   }

   fx.receiveSettings = receiveSettings;
   function receiveSettings(data) {
      db.findSetting('keys').then(updateKey, updateKey);
      function updateKey(setting={key: 'keys', keys:[]}) {
         setting.keys = setting.keys.filter(k=>k.keyid != data.keyid);
         if (data.keyid && data.description) {
            setting.keys.push({ keyid: data.keyid, description: data.description });
            db.addSetting(setting).then(update, update);
         } else if (!Array.isArray(data.content)) {
            util.boolAttrs(data.content);
            util.keyWalk(data.content, env);
         }
      }
      function update() { updateSettings(data.content).then(()=>envSettings().then(settingsReceived, util.logError), util.logError); }
      function settingsReceived() { settingsLoaded(); setIdiom(); }
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
            }

            let org = getKey('orgData');
            if (org) { Object.keys(env.org).forEach(key => { if (org[key]) env.org[key] = org[key]; }); }

            let pt = getKey('pointsTable');
            if (pt) env.points.points_table = pt.table;

            let misc = getKey('envSettings');
            if (misc && misc.settings) {
               util.boolAttrs(misc.settings);
               util.keyWalk(misc.settings, env);
            }

            let points = getKey('pointsSettings');
            if (points && points.settings) {
               util.boolAttrs(points.settings);
               util.fxAttrs(points.settings);
               Object.assign(env.points, points.settings);
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

            let search = getKey('searchSettings');
            if (search && search.settings) {
               util.boolAttrs(search.settings);
               util.keyWalk(search.settings, env.searchbox);
            }

            let publishing = getKey('publishingSettings');
            if (publishing && publishing.settings) {
               util.boolAttrs(publishing.settings);
               util.keyWalk(publishing.settings, env.publishing);
            }

            let printing = getKey('printingSettings');
            if (printing && printing.settings) {
               util.boolAttrs(printing.settings);
               util.keyWalk(printing.settings, env.printing);
            }

            let schedule = getKey('scheduleSettings');
            if (schedule && schedule.settings) {
               util.boolAttrs(schedule.settings);
               util.keyWalk(schedule.settings, env.schedule);
            }

            let scoreboard = getKey('scoreboardDefaults');
            if (scoreboard && scoreboard.defaults) {
               if (scoreboard.defaults.settings) {
                  util.boolAttrs(scoreboard.defaults.settings);
                  util.keyWalk(scoreboard.defaults.settings, env.scoreboard.settings);
               }
               if (scoreboard.defaults.options) {
                  util.keyWalk(scoreboard.defaults.options, env.scoreboard.options);
               }
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

            let uuuid = getKey('userUUID');
            if (!uuuid || !uuuid.value) {
               env.first_time_user = true;
               env.uuuid = UUID.generate();
               db.addSetting({ key: 'userUUID', value: env.uuuid });
               coms.emitTmx({ notice: 'New TMX Client', version: env.version });
            } else {
               env.uuuid = uuuid.value;
            }

            settingsLoaded();

            // turn off info labels...
            // if no info displayGen.info = '';

            /*
            externalRequests().forEach(ex => {
               if (ex.parser && ex.parser.fx) {
                  env.parsers[ex.key] = util.createFx(ex.parser.fx);
               }
            });
            */

            resolve();

            // function externalRequests() { return settings.filter(s => s.category && s.category == 'externalRequest'); }
            function getKey(key) { return settings.reduce((p, c) => c.key == key ? c : p, undefined); }
         }
      });
   }

   fx.geoposition = () => { return env.locations.geoposition; }

   function handleUnhandled() {
      window.onunhandledrejection = (event) => {
         event.preventDefault();
         let reason = event.reason;
         let message = reason && (reason.stack || reason);
         if (message && message.indexOf('blocked') > 0) {
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
         navigator.storage.estimate().then(s => {
            s.remaining = s.quota - s.usage;
            if (s.usage > s.quota) {
               coms.emitTmx({ 
                  event: 'Storage',
                  notice: `Storage (Quota: ${s.quota}, Usage: ${s.usage}, Remaining: ${s.remaining})`
               });
            }
         });
         navigator.storage.persist().then(persistent => {
            env.storage = persistent ? true : 'user agent control'
            if (persistent !== true) {
               coms.emitTmx({ event: 'Persistence', notice: `Persistence: ${env.storage}`, version: env.version, persistent });
            }
            if (env.storage != true ) {
               fx.addMessage({
                  title: 'warn',
                  notice: lang.tr('phrases.nopersist'),
                  warning: true
               });
            }
         }, notSupported);
      } else {
         env.messages.push({ title: 'warn', notice: lang.tr('phrases.nopersist'), warning: true });
         displayGen.homeIconState('warning');
         notSupported();
      }

      function notSupported(err) {
         if (err) console.log('Persistence error:', err);
         coms.emitTmx({ 
            event: 'Persistence',
            notice: `Persistence Not Supported`,
            version: env.version,
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

   fx.init = () => {
      console.log('version:', env.version);

      displayGen.initModals();
      let supported_device = true;
      if (device.isIpad || (window.innerWidth > 700 && window.innerHeight > 700)) {
         supported_device = true;
      } else if (device.isMobile || device.isIDevice) {
         supported_device = false;
      }

      if (!supported_device) {
         displayGen.showModal(`${env.version}<h2>Mobile Support Soon!</h2>${window.location.host}`, false);
         return;
      }
      env.isMobile = device.isIDevice || device.isMobile;
      d3.json('./assets/ioc_codes.json', data => { env.ioc_codes = data; });

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

      document.getElementById('go_home').addEventListener('click', () => {
         tmxTour.clear();
         env.date_pickers.forEach(d=>d.destroy());
         let state = displayGen.homeIcon();
         if (state == 'home') {
            splash();
            displayGen.homeIcon('menu');
         } else {
            let menu = displayGen.mainMenu();
            menu.version.element.addEventListener('click', displayVersion)
            menu.messages.element.addEventListener('click', evt => {
               evt.stopPropagation();
               displayMessages();
            })
            menu.release.element.addEventListener('click', displayReleaseNotes);
            menu.support.element.addEventListener('click', displayGen.support);
            if (env.messages && env.messages.length) { menu.messages.element.style.display = 'inline'; }
            menu.tour.element.addEventListener('click', evt => {
               displayGen.closeModal();
               tmxTour.splashTour();
            });
         }
      });
      
      function displayVersion(evt) {
         evt.stopPropagation();
         let message =`<h2 style='margin: 1em;'>${lang.tr('version')}: ${env.version}</h2>`;
         displayGen.popUpMessage(message);
      }

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

      if (env.locations.map_provider == 'google') fetchFx.loadGoogleMaps();

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
      let updateSearch = () => setTimeout(function() { searchBox.updateSearch(); }, 1000);
      let id = displayGen.busy.message(`<p>${lang.tr('refresh.players')}...</p>`, updateSearch);
      let done = () => displayGen.busy.done(id);
      let addNew = (players) => importFx.processPlayers(players).then(done, done);
      let notConfigured = (err) => { done(); displayGen.popUpMessage((err && err.error) || lang.tr('phrases.notconfigured')); }
      fetchFx.fetchNewPlayers().then(addNew, notConfigured);
   }

   fx.updateTournaments = updateTournaments;
   function updateTournaments({ merge }={}) {
      if (!navigator.onLine) return;
      let id = displayGen.busy.message(`<p>${lang.tr('refresh.calendar')}...</p>`, searchBox.updateSearch);
      let done = () => {
         displayGen.busy.done(id);
         if (displayGen.content == 'calendar') calendarFx.displayCalendar();
      }
      let addNew = (trnys) => util.performTask(db.addTournament, trnys, false).then(done, done);
      let mergeTournaments = (trnys) => util.performTask(mergeTournament, trnys, false).then(done, done);
      let notConfigured = (err) => { done(); displayGen.popUpMessage((err && err.error) || lang.tr('phrases.notconfigured')); }
      let checkServer = (err) => {
         let message = `${(err && err.error) || ''}<p>Retrieve from CourtHive Server?`;
         displayGen.okCancelMessage(message, fetchServerTournaments, () => displayGen.closeModal());
         function fetchServerTournaments() {
            displayGen.closeModal();
            coms.emitTmx({ getOrgTournaments: { ouid: env.org.ouid, authorized: true }});
         }
      }

      fetchFx.fetchNewTournaments(merge).then(processTournaments, checkServer);

      function processTournaments(trnys) {
         if (merge) {
            mergeTournaments(trnys);
         } else {
            addNew(trnys);
         }
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
      fetchFx.fetchNewClubs().then(addNew, notConfigured);
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

      splashEvent(container, 'tournaments', () => {  showHome(calendarFx.displayCalendar); });
      splashEvent(container, 'players', () => {  showHome(displayPlayers); });
      splashEvent(container, 'clubs', () => {  showHome(displayClubs); });
      splashEvent(container, 'settings', editSettings);
      splashEvent(container, 'documentation', () => window.open(`/docs/${env.ioc}`, '_blank'));
      splashEvent(container, 'importexport', () => {  showHome(displayImportExport); });
      splashEvent(container, 'datastorage', dataStorage);
      splashEvent(container, 'keys', displayKeyActions);

      tmxTour.splashContainer(container);
      if (env.first_time_user) {
         env.first_time_user = false;
         displayGen.okCancelMessage('Welcome!  Take the TMX Tour?', takeTour, () => displayGen.closeModal());
         function takeTour() { displayGen.closeModal(); tmxTour.splashTour(); }
      }

      if (env.org && env.org.name) { container.org.element.innerHTML = env.org.name; }

      // Revert behavior of search box to normal
      searchBox.normalFunction();

      if (!env.version_check || env.version_check + 86400000 < new Date().getTime()) {
         coms.emitTmx({ version: env.version });
         env.version_check = new Date().getTime();
      }

      function splashEvent(container, child, fx) {
         if (container[child].element) container[child].element.addEventListener('click', fx);
      }

      function showHome(fx) {
         displayGen.homeIcon('home');
         if (typeof fx == 'function') fx();
      }
   }

   function displayKeyActions() {
      db.findSetting('keys').then(setting => {
         let actions = displayGen.keyActions(setting && setting.keys); 

         // submit new key
         actions.container.key.element.addEventListener('keyup', keyStroke);
         actions.container.submitnewkey.element.addEventListener('click', submitNewKey);
         function keyStroke(evt) { if (evt.which == 13) submitNewKey(); }
         function submitNewKey() {
            let value = actions.container.key.element.value;
            if (value && value.trim()) coms.sendKey(value.trim());
            displayGen.closeModal();
         }

         // submit existing key
         if (actions.container.select.element) actions.container.select.element.addEventListener('click', submitKey);
         function submitKey(value) {
            let selection = actions.container.keys.ddlb.getValue();
            if (!navigator.onLine && location.hostname != 'localhost') return displayGen.popUpMessage(lang.tr('phrases.noconnection')); 
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

   function dataStorage() {
      db.findAllSettings().then(displayDataStorage);

      function displayDataStorage(settings) {
         let sheet_data_storage = settings.filter(s=>s.category == 'sheetDataStorage');

         let tabs = {
            sheets: displayGen.sheetDataStorage(sheet_data_storage),
            server: displayGen.serverDataStorage()
         }

         if (!Object.keys(tabs).length) return displayGen.popUpMessage('Data Storage options disabled'); 

         let tabdata = [];
         if (o.data_tabs.sheets) tabdata.push({ tab: lang.tr('settings.sheetdata'), content: tabs.sheets.html });
         if (o.data_tabs.server) tabdata.push({ tab: 'Server Data', content: tabs.server.html });

         let { container } = displayGen.tabbedModal({ tabs, tabdata, title: lang.tr('settings.data') });

         if (container.save.element) container.save.element.addEventListener('click', saveSettings);
         if (container.cancel.element) container.cancel.element.addEventListener('click', revertSettings);

         if (container.server_players.element) container.server_players.element.addEventListener('click', exportFx.sendPlayers2Server);
         if (container.server_clubs.element) container.server_clubs.element.addEventListener('click', exportFx.sendClubs2Server);

         function revertSettings() {
            envSettings();
            displayGen.closeModal();
         }

         function saveSettings() {
            let settings = [];

            if (o.data_tabs.sheets) {
               sheet_data_storage.forEach(item => {
                  let setting = {
                     key: item.key,
                     url: container[item.key].element.value,
                     category: 'sheetDataStorage',
                  }
                  settings.push(setting);
               });
            }

            updateSettings(settings).then(settingsLoaded, err => console.log('update settings failed:', err));
            displayGen.closeModal();
         }
      }
   }

   function exportData() {
      var tabs = {};
      if (o.export_tabs.players) tabs.players = displayGen.exportRange({ label: lang.tr('bd'), id_names: { start: 'py_start', end: 'py_end', export: 'py_export' }});
      if (o.export_tabs.points) tabs.points = displayGen.exportRange({ id_names: { start: 'pt_start', end: 'pt_end', export: 'pt_export' }});
      if (o.export_tabs.matches) tabs.matches = displayGen.exportRange({ id_names: { start: 'mt_start', end: 'mt_end', export: 'mt_export' }});

      if (!Object.keys(tabs).length) return displayGen.popUpMessage('Export options disabled'); 

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

            if (env.points.export_format && env.org.abbr) {
               let text = `${lang.tr('phrases.export')}: ${lang.tr('pts')}`;
               let choices = displayGen.twoChoices({ text, option1: 'JSON', option2: env.points.export_format.name || env.org.abbr });
               choices.option1.element.addEventListener('click', () => {
                  exportFx.downloadArray('points.json', pts);
                  displayGen.closeModal('configmodal');
               });
               choices.option2.element.addEventListener('click', () => {
                  pointsFx.downloadFormattedPoints({ org_abbr: env.org.abbr, points }).then(util.logError, util.logError);
                  displayGen.closeModal('configmodal');
               });
            } else {
               exportFx.downloadArray('points.json', pts);
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
            if (!env.exports.utr) {
               displayGen.popUpMessage('UTR Match Export disabled'); 
            } else {
               let match_records = exportFx.matchRecords(matches);
               let csv = exportFx.json2csv(match_records);
               exportFx.downloadText('UTR-Matches.csv', csv);
            }
         }
      }
   }

   function displayTeams() {
      let actions = displayGen.teamActions(); 
      console.log('display teams');
   }

   function viewPlayers() {
      console.log('view players');
   }

   function addPlayer() {
      playerFx.createNewPlayer({ callback: addNewPlayer });
      function addNewPlayer(player) {
         player.id = UUID.new();
         player.puid = player.id;
         db.addPlayer(player).then(updateSearch, util.logError);
      }
      function updateSearch() { searchBox.populateSearch.players(); }
   }

   function displayPlayers() {
      let actions = displayGen.playersActions(); 

      if (o.components.players && o.components.players.add) {
         actions.add.element.style.display = 'flex';
         actions.add.element.addEventListener('click', () => addPlayer());
      }

      if (o.components.players && o.components.players.manage) {
         actions.manage.element.style.display = 'flex';
         actions.manage.element.addEventListener('click', () => viewPlayers());
      }

      if (o.components.players && o.components.players.teams) {
         actions.teams.element.style.display = 'flex';
         actions.teams.element.addEventListener('click', () => displayTeams());
      }

      if (o.components.players && o.components.players.calcs) {
         actions.pointCalc.element.style.display = 'flex';
         actions.pointCalc.element.addEventListener('click', () => configureCalc('points'));
      }

      if (o.components.players && o.components.players.ranklist) {
         actions.rankCalc.element.style.display = 'flex';
         actions.rankCalc.element.addEventListener('click', () => configureCalc('rankings'));
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

   fx.pushMessage = (msg) => { env.messages.push(msg); }

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

   function displayReleaseNotes(evt) {
      evt.stopPropagation();
      displayGen.closeModal();
      let message =`
         <h2 style='margin: 1em;'>Release Notes</h2>
         <div class='releasenotes'>
            <h3 class='flexjustifystart'>Version: 1.4.0.0.0</h3>
            <div class='flexjustifystart'>"Competitive Match Index" Charts added to Matches Tab</div>

            <h3 class='flexjustifystart'>Version: 1.3.17.28.25</h3>
            <div class='flexjustifystart'>Ability to print player list and publish list online</div>
            <div class='flexjustifystart'>Ability to include tournament-specific social media links</div>
            <div class='flexjustifystart'>Enhanced support for mobile devices</div>
            <div class='flexjustifystart'>Fixes for global timezone support</div>

            <h3 class='flexjustifystart'>Version: 1.3.0.0.0</h3>
            <div class='flexjustifystart'>"Guided Tours" - integrated context-sensitive documentation & hints</div>
            <div class='flexjustifystart'>Support for Consolation Feed-In draws</div>

            <h3 class='flexjustifystart'>Version: 1.2.21.45.38</h3>
            <div class='flexjustifystart'>PDF Printing of Dual Match Events</div>
            <div class='flexjustifystart'>Livescoring results received from delegated matches</div>
            <div class='flexjustifystart'>6 character Authorization and Delegation keys</div>

            <h3 class='flexjustifystart'>Version: 1.2.10.30.26</h3>
            <div class='flexjustifystart'>Setting to toggle seed placement restrictions</div>
            <div class='flexjustifystart'>Support for Doubles in Round Robin, Compass and Staggered Entry Draws</div>

            <h3 class='flexjustifystart'>Version: 1.2.2.5.1</h3>
            <div class='flexjustifystart'>Ability to delegate match tracking to CourtHive/Mobile.</div>

            <h3 class='flexjustifystart'>Version: 1.2.0.0.0</h3>
            <div class='flexjustifystart'>Home Menu and Release Notes added.</div>
            <div class='flexjustifystart'>Support for Tablet Devices (minimum screen dimention 700px)</div>
            <div class='flexjustifystart'>TMX now checks authorization status for each tournament and with each publishing event.</div>
            <div class='flexjustifystart'>In Edit Mode authorization status is displayed as a small set of keys.</div>
            <div class='flexjustifystart'>In the Events Tab, single clicks are swapped with Context Clicks to improve useability on Tablets.</div>
            <div class='flexjustifystart'>When approving players, Shift-click, Control-click or Right-click is now used for fast approval.</div>
            <div class='flexjustifystart'>It is no longer necessary to Save new events and new teams.</div>
            <div class='flexjustifystart'>Authorization Keys are now displayed for administrators on Tablets.</div>
         <div>
      `;
      displayGen.showModal(message);
   }

   return fx;

}();
