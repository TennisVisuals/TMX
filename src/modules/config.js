import { db } from './db';
import { env } from './env';
import { util } from './util';
import { coms } from './coms';
import { domFx } from './domFx';
import { dateFx } from './dateFx';
import { menuFx } from './menuFx';
import { idiomFx } from './idiomFx';
import { tmxTour } from './tmxTour';
import { fetchFx } from './fetchFx';
import { lang } from './translator';
import { staging } from './staging';
import { stringFx } from './stringFx';
import { playerFx } from './playerFx';
import { importFx } from './importFx';
import { searchBox } from './searchBox';
import { options as o } from './options';
import { settingsFx } from './settingsFx';
import { modalViews } from './modalViews';
import { displayGen } from './displayGen';
import { calendarFx } from './calendarFx';
import { splashScreen } from './splashScreen';
import { eventManager } from './eventManager';
import { tournamentDisplay } from './tournamentDisplay';

export const config = function() {

   // to disable context menu on the page
   document.oncontextmenu = () => false;
   window.addEventListener('contextmenu', (e) => { e.preventDefault(); }, false);

   // eslint-disable-next-line no-unused-vars
   window.onerror = (msg, url, lineNo, columnNo, error) => {
      let eventError = { error_message: msg, url, stack: { lineNo, columnNo, error } };
      coms.emitTmx({ eventError });
      let tmx = (location.pathname.indexOf('tmx+') >= 0) ? '/tmx' : '/tmx-';
      fx.addMessage({
         title: 'warn',
         notice: `Error Detected: Development has been notified!<p><a href='${tmx}'>Try CourtHive.com/tmx-</a>`
      });
      displayGen.homeIconState('update');
   };

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
     util.clearHistory();
   })();

   function checkQueryString() {
      return new Promise((resolve) => {
         if (queryString.actionKey) { coms.sendKey(queryString.actionKey); }
         resolve();
      });
   }
   // END queryString

   eventManager.holdAction = (target, coords) => {
      let click_context = domFx.getParent(target, 'contextAction');
      let action = click_context && click_context.getAttribute('contextaction');
      if (eventManager.holdActions[action]) eventManager.holdActions[action](target, coords);
   };

   eventManager
      .register('tiny_tour_icon', 'tap', contextTour)
      .register('tiny_docs_icon', 'tap', contextDocs)
      .register('hints_icon', 'tap', contextHints)

      .register('selectKey', 'tap', selectKey);

   function contextDocs(target) {
      let click_context = domFx.getParent(target, 'doclink');
      let url = click_context.getAttribute('url');
      if (url) window.open(`/docs/${env.ioc}/${url}.html`, '_blank');
   }

   function contextTour(target) {
      let click_context = domFx.getParent(target, 'tourlink');
      let context = click_context.getAttribute('context');
      if (context) tmxTour.tournamentTours(context);
   }

   function contextHints(target) {
      let click_context = domFx.getParent(target, 'hintslink');
      let context = click_context.getAttribute('context');
      if (context) tmxTour.tournamentHints(context);
   }

   function selectKey(target) {
      modalViews.closeModal();
      let keyid = target.getAttribute('keyid');
      if (!navigator.onLine && location.hostname != 'localhost') return displayGen.popUpMessage(lang.tr('phrases.noconnection')); 
      if (keyid) coms.sendKey(keyid);
   }

   fx.addMessage = (msg) => {
      let msgHash = (m) => Object.keys(m).map(key => m[key]).join('');
      let message_hash = msgHash(msg);
      let exists = env.messages.reduce((p, c) => msgHash(c) ==  message_hash ? true : p, false);
      if (!exists) env.messages.push(msg);
      displayGen.homeIconState(msg.state || 'messages');
   };

   fx.authMessage = (msg) => {
      db.findTournament(msg.tuid).then(pushMessage, err => console.log(err));

      function pushMessage(tournament) {
         eventManager.call('tournamentAuthorization', 'tap', tournament);

         if (tournament) {
            // if tournament exists in local database, use that version
            // TODO: perhaps offer to replace it with the one that arrived if msg.tournament
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
   };

   function initSearch() {
      searchBox.element_id = 'searchinput';
      searchBox.meta_element_id = 'searchmeta';
      searchBox.count_element_id = 'searchcount';
      searchBox.search_select_id = 'search_select';
      searchBox.category_element_id = 'searchcategory';
      searchBox.default_category = 'tournaments';
      searchBox.setSearchCategory();

      searchBox.resetFx.push(playerFx.resetPlayerAction);

      searchBox.metaClick = {
         // players() { splashScreen.displayPlayers(); },
         // clubs() { splashScreen.displayClubs(); },
         tournaments() { calendarFx.displayCalendar(); }
      };

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
         splashScreen.displayClub();
      };

      searchBox.populateSearch = {};
      searchBox.populateSearch.tournaments = function() {
         db.findAllTournaments().then(arr => {
            searchBox.searchCount(arr.length);
            searchBox.searchCategory('search_tournament_total');

            searchBox.typeAhead.list = !arr.length ? [] : arr.map(tournament => { 
               let category = tournament.category == 'S' ? 'S' : `${tournament.category}`;
               let start_date = dateFx.formatDate(new Date(tournament.start));
               let label = stringFx.normalizeName(`${category} ${tournament.name} [${start_date}]`);
               return { value: tournament.tuid, label };
            });
         });
      };

      searchBox.populateSearch.players = function({ filtered } = {}) {
         var filter_values = filtered ? searchBox.typeAhead._list.map(l=>l.value) : undefined;

         playerFx.optionsAllPlayers({ filter_values }).then(setSearchList, util.logError);

         function setSearchList(arr) { 
            searchBox.searchCount(arr.length);
            searchBox.searchCategory('search_players_total');
            searchBox.typeAhead.list = arr;
         }
      };

      if (o.components.club_search) searchBox.populateSearch.clubs = function() {
         db.findAllClubs().then(arr => {
            searchBox.searchCount(arr.length);
            searchBox.searchCategory('search_clubs_total');
            searchBox.typeAhead.list = !arr.length ? [] : arr.map(club => ({ value: club.id, label: `${club.name} [${club.city}]` }));
         });
      };

      searchBox.contextMenu = (ev) => {
         if (searchBox.category == 'players') {
            let options = [lang.tr('search.firstlast'), lang.tr('search.lastfirst')];
            displayGen.svgModal({ x: ev.clientX, y: ev.clientY, options, callback: doSomething });

         }
         function doSomething(choice, index) {
            if (index == 0) {
               env.searchbox.lastfirst = false;
            } else if (index == 1) {
               env.searchbox.lastfirst = true;
            }
            searchBox.populateSearch.players({filtered: true});
         }
      };
   }

   function initDB() {
      coms.catchAsync(db.initDB)().then(checkQueryString, dbUpgrade).then(settingsFx.envSettings, util.logError).then(DBReady);
      function dbUpgrade() { displayGen.showConfigModal('<h2>Database Upgraded</h2><div style="margin: 1em;">Please refresh your cache or load tmx+</div>'); }

      function DBReady() {
         coms.connectAction();
         persistStorage();

         idiomFx.idiomSelector().then(idiomsReady);
         importFx.loadCache();
         if (env.auto_update.players) { updatePlayers(); }

         function idiomsReady() {
            splashScreen.show();
            searchBox.init();
            displayGen.onreset = splashScreen.show;
         }
      }
   }

   fx.geoposition = () => { return env.locations.geoposition; };

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
            env.storage = persistent ? true : 'user agent control';
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

   /*
   function enableNotifications() {
      // TODO: future, once server and service workers implemented...
      // Notification.requestPermission(granted => { env.notifications = granted; });
   }
   */

   function checkURL() {
      if (location.pathname.indexOf('tmx+') >= 0) {
         env.messages.push({ title: 'warn', notice: "Pre-release version of TMX" });
         displayGen.homeIconState('update');
      }
   }

   function supportedDevice() {
      let mobile = env.device.isMobile || env.device.isIDevice;
      let allowed = location.hostname == 'localhost' || queryString.mobile === 'xmt' || env.device.isIpad || (window.innerWidth > 700 && window.innerHeight > 700);
      let supported_device = mobile && !allowed ? false : true;
      return supported_device;
   }

   fx.init = () => {
      checkURL();
      d3.json('./assets/ioc_codes.json', data => { env.ioc_codes = data; });

      menuFx.init();
      modalViews.init();
      displayGen.initModals();

      if (!supportedDevice()) { return displayGen.showModal(`${env.version}<h2>Mobile Support Soon!</h2>${window.location.host}`); }

      initSearch();
      staging.init();
      coms.connectSocket();
      idiomFx.init();
      initDB();

      importFx.reset();

      handleUnhandled();

      document.getElementById('go_home').addEventListener('click', () => {
         let messages = env.messages && env.messages.length;

         tmxTour.clear();
         env.date_pickers.forEach(d=>d.destroy());

         if (messages) {
            eventManager.call('displayMessages', 'tap');
         } else {
            let state = displayGen.homeIcon();
            if (state == 'home') {
               splashScreen.show();
               searchBox.searchSelect('tournaments');
               displayGen.homeIcon('menu');
            } else {
               menuFx.display();
            }
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
      };
      let setOrientation = () => { env.orientation = (window.innerHeight > window.innerWidth) ? 'portrait' : 'landscape'; };
      window.addEventListener("orientationchange", function() { setOrientation(); }, false);
      window.addEventListener("resize", function() { setOrientation(); checkVisible(); }, false);
      setOrientation();

      if (env.locations.map_provider == 'google') fetchFx.loadGoogleMaps();

      env.version_check = new Date().getTime();
      console.log('version:', env.version);
   };

   function updatePlayers() {
      if (!navigator.onLine) return;
      let updateSearch = () => setTimeout(function() { searchBox.updateSearch(); }, 1000);
      let id = displayGen.busy.message(`<p>${lang.tr('refresh.players')}...</p>`, updateSearch);
      let done = () => displayGen.busy.done(id);
      let addNew = (players) => importFx.processPlayers(players).then(done, done);
      let notConfigured = (err) => { done(); displayGen.popUpMessage((err && err.error) || lang.tr('phrases.notconfigured')); };
      fetchFx.fetchNewPlayers().then(addNew, notConfigured);
   }

   fx.updateTournaments = updateTournaments;
   function updateTournaments({ merge }={}) {
      if (!navigator.onLine) return;
      let id = displayGen.busy.message(`<p>${lang.tr('refresh.calendar')}...</p>`, searchBox.updateSearch);
      let done = () => {
         displayGen.busy.done(id);
         if (displayGen.content == 'calendar') calendarFx.displayCalendar();
      };
      let addNew = (trnys) => util.performTask(db.addTournament, trnys, false).then(done, done);
      let mergeTournaments = (trnys) => util.performTask(mergeTournament, trnys, false).then(done, done);
      let checkServer = (err) => {
         let message = `${(err && err.error) || ''}<p>Retrieve from CourtHive Server?`;
         displayGen.okCancelMessage(message, fetchServerTournaments, () => displayGen.closeModal());
         function fetchServerTournaments() {
            displayGen.closeModal();
            coms.emitTmx({ getOrgTournaments: { ouid: env.org.ouid, authorized: true }});
         }
      };

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
      let notConfigured = (err) => { done(); displayGen.popUpMessage((err && err.error) || lang.tr('phrases.notconfigured')); };
      fetchFx.fetchNewClubs().then(addNew, notConfigured);
   }

   function refreshAction() {
      if (searchBox.category == 'players') {
         let message = `${lang.tr('tournaments.renewlist')}<p><i style='color: red;'>(${lang.tr('phrases.deletereplace')})</i>`;
         displayGen.okCancelMessage(message, renewList, () => displayGen.closeModal());

      } 
      if (searchBox.category == 'tournaments') {
         let message = `${lang.tr('tournaments.renewlist')}`;
         displayGen.okCancelMessage(message, mergeList, () => displayGen.closeModal());
      }

      function mergeList() { updateTournaments({ merge: true }); }
      function renewList() { db.db.players.toCollection().delete().then(updateAction, () => displayGen.closeModal()); }
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

   fx.pushMessage = (msg) => { env.messages.push(msg); };

   // TODO: theme.js
   /*
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
   };
   */

   return fx;

}();
