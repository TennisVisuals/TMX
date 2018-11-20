import { db } from './db';
import { env } from './env';
import { util } from './util';
import { coms } from './coms';
import { UUID } from './UUID';
import { dd } from './dropdown';
import { lang } from './translator';
import { idiomFx } from './idiomFx';
import { stringFx } from './stringFx';
import { exportFx } from './exportFx';
import { displayFx } from './displayFx';
import { options as o } from './options';
import { displayGen } from './displayGen';
import { fxRegister } from './fxRegister';
import { modalViews } from './modalViews';
import { eventManager } from './eventManager';

export const settingsFx = function() {
   let fx = {};

   let container = {};
   let loadFunctions = {};
   let ids = { schedule_rows: displayFx.uuid() };

   fx.register = (name, fx) => {
      if (name && typeof name == 'string' && typeof fx == 'function') { loadFunctions[name] = fx; }
   };

   function getModalWindow() { return document.getElementById('modalwindow'); }

   fx.settingsLoaded = settingsLoaded;
   function settingsLoaded() { Object.keys(loadFunctions).forEach(name=>loadFunctions[name]()); }

   eventManager
      .register('submitSettings', 'tap', submitSettings);

   function submitSettings() {
      modalViews.closeModal();
      let modalwindow = getModalWindow();
      let checkboxes = Array.from(modalwindow.querySelectorAll('input'));
      let new_state = Object.assign({}, ...checkboxes.map(checkbox => ({ [checkbox.getAttribute('attr')]: checkbox.checked })));

      // draws
      env.drawFx.compressed_draw_formats = new_state.compresseddraws;
      env.drawFx.auto_byes = new_state.automatedbyes;
      env.drawFx.fixed_bye_order = new_state.fixedbyes;
      env.drawFx.separation.ioc = new_state.separate_by_ioc;
      env.drawFx.separation.school = new_state.separate_by_club;
      env.drawFx.separation.club_code = new_state.separate_by_school;
      env.drawFx.ll_all_rounds = new_state.llallrounds;
      env.drawFx.consolation_from_qualifying = new_state.qualconsolation;
      env.drawFx.consolation_alternates = new_state.consolationalts;
      env.drawFx.consolation_seeding = new_state.consolationseeds;
      env.draws.tree_draw.seeds.restrict_placement = new_state.restrictseedplacement;
      env.draws.tree_draw.flags.display = new_state.countryflags;
      env.draws.tree_draw.schedule.times = new_state.matchtimes;
      env.draws.tree_draw.schedule.dates = new_state.matchdates;
      env.draws.tree_draw.schedule.courts = new_state.courtdetail;
      env.draws.tree_draw.schedule.after = new_state.matchesbefore;

      // publishing
      env.publishing.require_confirmation = new_state.requireconfirm;
      env.publishing.publish_on_score_entry = new_state.publishonscore;
      env.publishing.publish_draw_creation = new_state.publishdrawcreation;

      // schedule
      env.schedule.time24 = new_state.time24;
      env.schedule.scores_in_draw_order = new_state.draworderscores;
      env.schedule.completed_matches_in_search = new_state.schedulecompleted;

      // general
      env.documentation.links = new_state.documentation;
      env.documentation.hoverhelp = new_state.hoverhelp;
      env.printing.save_pdfs = new_state.savepdfs;
      env.calendar.first_day = new_state.first_day;
      env.searchbox.lastfirst = new_state.lastfirst;
      env.searchbox.diacritics = new_state.diacritics;
      if (container.schedule_rows && container.schedule_rows.ddlb) {
         env.schedule.max_matches_per_court = util.parseInt(container.schedule_rows.ddlb.getValue()) || 16;
      }
      saveSettings();
   }

   function saveSettings() {
      let settings = [];

      /*
      if (v.org) {
         settings.push(getImage('orgLogo', 'org_logo_display'));
         settings.push(getImage('orgName', 'org_name_display'));
      }
      */

      settings.push({ key: 'searchSettings', settings: env.searchbox });
      settings.push({ key: 'publishingSettings', settings: env.publishing });
      settings.push({ key: 'printingSettings', settings: env.printing });
      settings.push({ key: 'drawSettings', settings: env.draws });
      settings.push({ key: 'scheduleSettings', settings: env.schedule });
      settings.push({ key: 'drawFx', settings: env.drawFx });
      settings.push({ 
         key: 'envSettings',
         settings: {
            documentation: env.documentation,
            calendar: { first_day: env.calendar.first_day }
         } 
      });

      updateSettings(settings).then(settingsLoaded, err => console.log('update settings failed:', err));
   }

   function settingsState(settings_tabs) {
      let current_state = {
         // draws
         compresseddraws: env.drawFx.compressed_draw_formats,
         automatedbyes: env.drawFx.auto_byes,
         fixedbyes: env.drawFx.fixed_bye_order,
         separate_by_ioc: env.drawFx.separation.ioc,
         separate_by_club: env.drawFx.separation.school,
         separate_by_school: env.drawFx.separation.club_code,
         llallrounds: env.drawFx.ll_all_rounds,
         qualconsolation: env.drawFx.consolation_from_qualifying,
         consolationalts: env.drawFx.consolation_alternates,
         consolationseeds: env.drawFx.consolation_seeding,
         restrictseedplacement: env.draws.tree_draw.seeds.restrict_placement,
         countryflags: env.draws.tree_draw.flags.display,
         matchtimes: env.draws.tree_draw.schedule.times,
         matchdates: env.draws.tree_draw.schedule.dates,
         courtdetail: env.draws.tree_draw.schedule.courts,
         matchesbefore: env.draws.tree_draw.schedule.after,

         // publishing
         requireconfirm: env.publishing.require_confirmation,
         publishonscore: env.publishing.publish_on_score_entry,
         publishdrawcreation: env.publishing.publish_draw_creation,

         // schedule
         time24: env.schedule.time24,
         draworderscores: env.schedule.scores_in_draw_order,
         schedulecompleted: env.schedule.completed_matches_in_search,

         // general
         documentation: env.documentation.links,
         hoverhelp: env.documentation.hoverhelp,
         savepdfs: env.printing.save_pdfs,
         first_day: env.calendar.first_day,
         lastfirst: env.searchbox.lastfirst,
         diacritics: env.searchbox.diacritics 
      };
      Object.keys(current_state).forEach(k=>current_state[k] = stringFx.string2boolean(current_state[k]));

      let modalwindow = getModalWindow();
      let checkboxes = Array.from(modalwindow.querySelectorAll('input'));
      checkboxes.forEach(checkbox => {
         let attr = checkbox.getAttribute('attr');
         if (current_state[attr]) checkbox.checked = true;
      });

      if (settings_tabs.schedule) {
         // max_matches_per_court can be customized by keys
         let schedule_options = [16, 20, 24, 28, 32];
         let schedule_rows = env.schedule.max_matches_per_court;
         if (schedule_options.indexOf(schedule_rows) < 0) schedule_options.push(schedule_rows);
         schedule_options.sort();

         let options = schedule_options.map(c=> ({ key: c, value: c }));
         dd.attachDropDown({ id: container.schedule_rows.id, options });
         container.schedule_rows.ddlb = new dd.DropDown({ element: container.schedule_rows.element });
         container.schedule_rows.ddlb.setValue(schedule_rows, 'white');
      }
   }

   fx.settingsDialogue = (settings_tabs={general: true}) => {
      let tabs = ['general', 'draws', 'publishing', 'schedule'].filter(t=>settings_tabs[t]);
      let panel_tabs = tabs.map(panelTab).join('');
      let checkBox = (item) => selectItem(item);
      let radioButton = (item, name) => selectItem(item, 'radio', name);
      let separate = settings_tabs.draws && ['separate_by_ioc', 'separate_by_club', 'separate_by_school'].map(item=>radioButton(item, 'separate')).join('') || '';
      let draws1 = settings_tabs.draws && ['compresseddraws', 'automatedbyes', 'fixedbyes'].map(checkBox).join('') || '';
      let draws2 = settings_tabs.draws && ['llallrounds', 'qualconsolation', 'consolationalts', 'consolationseeds', 'restrictseedplacement'].map(checkBox).join('') || '';
      let draws3 = settings_tabs.draws && ['countryflags', 'matchtimes', 'matchdates', 'courtdetail', 'matchesbefore'].map(checkBox).join('') || '';
      let publishing1 = settings_tabs.publishing && ['requireconfirm', 'publishonscore'].map(item=>radioButton(item, 'publish')).join('') || '';
      let publishing2 = settings_tabs.publishing && ['publishdrawcreation'].map(checkBox).join('') || '';
      let schedule = settings_tabs.schedule && ['time24', 'draworderscores', 'schedulecompleted'].map(checkBox).join('') || '';
      let divider = `<label class="panel-block has-background-light"></label>`;

      let html = `
         <nav class="panel">
            <p class="panel-heading"> ${lang.tr('set')} </p>
            <p class="panel-tabs" style="flex-wrap: wrap; max-width: 30em;"> ${panel_tabs} </p>
            <div class="modalpeer general">
               ${checkBox('documentation')}
               <label class="panel-block"> <input type="checkbox" attr="hoverhelp"><b>${lang.tr('settings.help')}</b>: ${lang.tr('settings.hoverhelp')}</input> </label>
               <label class="panel-block"> <input type="checkbox" attr="savepdfs"><b>${lang.tr('settings.printing')}</b>: ${lang.tr('settings.savepdfs')}</input> </label>
               <label class="panel-block"> <input type="checkbox" attr="first_day"><b>${lang.tr('settings.calendar')}</b>: ${lang.tr('settings.firstday')}</input> </label>
               <label class="panel-block"> <input type="checkbox" attr="lastfirst"><b>${lang.tr('settings.search')}</b>: ${lang.tr('settings.lastfirst')}</input> </label>
               <label class="panel-block"> <input type="checkbox" attr="diacritics"><b>${lang.tr('settings.search')}</b>: ${lang.tr('settings.diacritics')}</input> </label>
           </div>
           <div class="modalpeer draws" style="display: none">
              ${draws1} ${divider} ${separate} ${divider} ${draws2} ${divider} ${draws3}
           </div>
           <div class="modalpeer publishing" style="display: none">
              ${publishing1} ${publishing2}
           </div>
           <div class="modalpeer schedule" style="display: none">
               <label class="panel-block">
                  <div id='${ids.schedule_rows}' class='settingddlb'> </div>
                  <span style='margin-left: 1em;'>Schedule Rows</span>
               </label>
               ${schedule}
           </div>
           <div class="panel-block button-row">
             <button class="button is-warning is-outlined closeModal"> ${lang.tr('ccl')} </button>
             <button class="button is-success is-outlined submitSettings"> ${lang.tr('sbt')} </button>
           </div>
         </nav>
      `;
      modalViews.modalWindow({ html, backgroundClose: false, x: false });
      Object.assign(container, displayFx.idObj(ids));
      settingsState(settings_tabs);

      function panelTab(tab) {
         let tab_text = lang.tr(`settings.${tab}`);
         let is_active = tab == 'general' ? 'is-active' : '';
         return `<a modalpeer="${tab}" class="modalPeer ${is_active}">${tab_text}</a>`;
      }
      function selectItem(item, type="checkbox", name="") {
         let box_text = lang.tr(`settings.${item}`);
         return `<label class="panel-block"> <input type="${type}" name="${name}" attr="${item}">${box_text}</input> </label>`;
      }
   };

   fx.dataStorage = () => {
      db.findAllSettings().then(displayDataStorage);

      function displayDataStorage(settings) {
         let sheet_data_storage = settings.filter(s=>s.category == 'sheetDataStorage');

         let tabs = {
            sheets: displayGen.sheetDataStorage(sheet_data_storage),
            server: displayGen.serverDataStorage()
         };

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
                     category: 'sheetDataStorage'
                  };
                  settings.push(setting);
               });
            }

            settingsFx.updateSettings(settings).then(settingsFx.settingsLoaded, err => console.log('update settings failed:', err));
            displayGen.closeModal();
         }
      }
   };

   fx.envSettings = envSettings;
   function envSettings() {
      return new Promise((resolve, reject) => {
         db.findAllSettings().then(setEnv, reject);

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

            settingsFx.settingsLoaded();

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
      function update() { settingsFx.updateSettings(data.content).then(()=>settingsFx.envSettings().then(settingsReceived, util.logError), util.logError); }
      function settingsReceived() {
         settingsFx.settingsLoaded(); setIdiom();
      }
      function setIdiom() { db.findSetting('defaultIdiom').then(checkIdiom, util.logError); }
      function checkIdiom(idiom) {
         if (lang.set() != idiom.ioc) { idiomFx.changeIdiom(idiom.ioc); }
         if (displayGen.content == 'splash') fxRegister.invoke('showSplash');
      }
   }

   fx.updateSettings = updateSettings;
   function updateSettings(settings) {
      return new Promise((resolve, reject) => {
         if (!settings) resolve();
         Promise.all(settings.map(s=>db.addSetting(s))).then(resolve, reject);
      });
   }

   /*
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

   function getImage(settings_key, image_id) {
      let elem = document.getElementById(image_id);
      let url = elem.querySelector('img').getAttribute('src');
      let setting = {
         key: settings_key,
         category: 'image',
         image: url
      };
      return setting;
   }
   */

   return fx;
}();

