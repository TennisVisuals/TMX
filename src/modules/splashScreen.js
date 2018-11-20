import { db } from './db';
import { env } from './env';
import { UUID } from './UUID';
import { util } from './util';
import { coms } from './coms';
import { domFx } from './domFx';
import { dateFx } from './dateFx';
import { tmxTour } from './tmxTour';
import { lang } from './translator';
import { importFx } from './importFx';
import { exportFx } from './exportFx';
import { playerFx } from './playerFx';
import { rankCalc } from './rankCalc';
import { searchBox } from './searchBox';
import { options as o } from './options';
import { modalViews } from './modalViews';
import { displayGen } from './displayGen';
import { settingsFx } from './settingsFx';
import { fxRegister } from './fxRegister';
import { calendarFx } from './calendarFx';
import { tournamentDisplay } from './tournamentDisplay';

export const splashScreen = function() {

   let fx = {};

   fxRegister.add('showSplash', show);

   fx.show = show;
   function show() {
      tournamentDisplay.reset();
      o.components.importexport = !env.device.isMobile && !env.device.isIpad && !env.device.isTablet;
      let container = displayGen.splashScreen(o.components, o.settings_tabs);

      splashEvent(container, 'tournaments', () => showHome(calendarFx.displayCalendar));
      splashEvent(container, 'players', () => showHome(displayPlayers));
      splashEvent(container, 'clubs', () => showHome(displayClubs));
      splashEvent(container, 'settings', () => settingsFx.settingsDialogue(o.settings_tabs));
      splashEvent(container, 'documentation', () => window.open(`/docs/${env.ioc}`, '_blank'));
      splashEvent(container, 'importexport', () => showHome(displayImportExport));
      splashEvent(container, 'datastorage', settingsFx.dataStorage);
      splashEvent(container, 'keys', displayKeyActions);

      tmxTour.splashContainer(container);
      if (env.first_time_user) {
         courtHiveChallenge();
         coms.sendKey('players');
         env.first_time_user = false;
         displayGen.okCancelMessage('Welcome!  Take the TMX Tour?', displayTour, () => displayGen.closeModal());
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

   function courtHiveChallenge() {
      let trny = {
         "org":{},
         "events":[],
         "metadata": { "format_version":1 },
         "type": "standard",
         "start": dateFx.futureDate(5).getTime(),
         "name": "CourtHive Challenge",
         "category":"All",
         "end": dateFx.futureDate(7).getTime(),
         "log":[],
         "tuid": UUID.generate(),
         "genders":[],
         "media": {
            "social": {}
         },
         "categories": ["All"]
      };
      db.addTournament(trny);
   }

   function displayTour() {
      coms.sendKey('players');
      modalViews.closeModal();
      displayGen.closeModal();
      tmxTour.splashTour();
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

   function displayTeams() {
      // let actions = displayGen.teamActions(); 
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

   function configureCalc(mode) {
      if (!mode || ['points', 'rankings'].indexOf(mode) < 0) return;
      let date = new Date();
      let container = displayGen.dateConfig();

      var ds = displayGen.dateSelector({
         date,
         date_element: container.picked.element,
         container: container.datepicker.element
      });

      displayGen.escapeModal();
      container.submit.element.addEventListener('click', callCalc);
      container.cancel.element.addEventListener('click', () => displayGen.closeModal());

      function callCalc() {
         displayGen.closeModal();
         if (mode == 'rankings') {
            rankCalc.rankCalc(ds.getDate());
         } else {
            rankCalc.pointCalc(ds.getDate());
         }
         ds.destroy();
      }
   }
   fx.displayKeyActions = displayKeyActions;
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
            modalViews.closeModal();
         }
      });
   }

   fx.displayClubs = displayClubs;
   function displayClubs() {
      searchBox.searchSelect('clubs');
      let cc = (evt) => displayClub(domFx.getParent(evt.target, 'club_click').getAttribute('cuid'));

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

   fx.displayPlayers = displayPlayers;
   function displayPlayers() {
      searchBox.searchSelect('players');
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

   fx.displayImportExport = displayImportExport;
   function displayImportExport() {
      let actions = displayGen.importExport(); 
      actions.download.element.addEventListener('click', exportData);
      actions.template.element.addEventListener('click', displayGen.downloadTemplate);
      importFx.initDragAndDrop(importFx.reset);
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
      var dates = { pt_start: start, pt_end: end, py_start: start, py_end: end, mt_start: start, mt_end: end };

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
         /*
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
         */
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

   return fx;

}();
