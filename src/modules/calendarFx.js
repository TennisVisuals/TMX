import { db } from './db';
import { env } from './env';
import { UUID } from './UUID';
import { util } from './util';
import { coms } from './coms';
import { dd } from './dropdown';
import { domFx } from './domFx';
import { dateFx } from './dateFx';
import { fetchFx } from './fetchFx';
import { staging } from './staging';
import { lang } from './translator';
import { tmxTour } from './tmxTour';
import { importFx } from './importFx';
import { rankCalc } from './rankCalc';
import { searchBox } from './searchBox';
import { displayGen } from './displayGen';
import { modalViews } from './modalViews';
import { tournamentFx } from './tournamentFx';
import { eventManager } from './eventManager';
import { tournamentDisplay } from './tournamentDisplay';

export const calendarFx = function() {
   let fx = {};

   fx.setCalendar = (obj) => Object.keys(obj).forEach(key => { if (Object.keys(env.calendar).indexOf(key) >= 0) env.calendar[key] = obj[key]; });

   fx.localizeDate = (date, date_localization) => {
      let default_localization = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
      return date.toLocaleDateString(lang.tr('datelocalization'), date_localization || default_localization);
   };
   
   fx.displayCalendar = displayCalendar;
   function displayCalendar() {
      searchBox.focus();
      searchBox.nextSearchCategory('tournaments');
      let category = env.calendar.category;

      let start = dateFx.offsetDate(env.calendar.start);
      let end = env.calendar.end ? dateFx.offsetDate(env.calendar.end) : new Date(new Date(start).setMonth(new Date(start).getMonth()+6));

      let calendar_container = displayGen.calendarContainer();
      tmxTour.calendarContainer(calendar_container);

      function updateStartDate() {
         // use timeUTC so that the date doesn't drift by repeated use of offsetDate
         fx.setCalendar({start: new Date(dateFx.timeUTC(start)) });
         startPicker.setStartRange(start);
         endPicker.setStartRange(start);
         endPicker.setMinDate(start);
      }
      function updateEndDate() {
         // use timeUTC so that the date doesn't drift by repeated use of offsetDate
         fx.setCalendar({end: new Date(dateFx.timeUTC(end)) });
         startPicker.setEndRange(end);
         startPicker.setMaxDate(end);
         endPicker.setEndRange(end);
      }

      var startPicker = new Pikaday({
         field: calendar_container.start.element,
         i18n: lang.obj('i18n'),
         defaultDate: start,
         toString(date) { return dateFx.formatDate(dateFx.timeUTC(date)); },
         setDefaultDate: true,
         firstDay: env.calendar.first_day,
         onSelect: function() {
            start = this.getDate();
            updateStartDate();
            generateCalendar({ start, end, category });
         }
      });
      env.date_pickers.push(startPicker);

      var endPicker = new Pikaday({
         field: calendar_container.end.element,
         i18n: lang.obj('i18n'),
         minDate: start,
         defaultDate: end,
         toString(date) { return dateFx.formatDate(dateFx.timeUTC(date)); },
         setDefaultDate: true,
         firstDay: env.calendar.first_day,
         onSelect: function() {
            end = this.getDate();
            updateEndDate();
            generateCalendar({ start, end, category });
         }
      });
      env.date_pickers.push(endPicker);

      updateStartDate();
      updateEndDate();

      let genCal = (value) => {
         category = value;
         fx.setCalendar({category});
         generateCalendar({ start, end, category });
      };
      calendar_container.category.ddlb = new dd.DropDown({ element: calendar_container.category.element, onChange: genCal });
      calendar_container.category.ddlb.selectionBackground('white');
      category = staging.legacyCategory(category, true);

      eventManager
         .register('newTournament', 'tap', newTournament)
         .register('fetchTournamentByID', 'tap', fetchTournamentByID)
         .register('importTournamentRecord', 'tap', importTournamentRecord);

      function newTournament() {
         modalViews.closeModal();
         createNewTournament({ title: lang.tr('tournaments.new'), callback: modifyTournament });
      }

      function fetchTournamentByID() {
         modalViews.closeModal();
         fetchFx.fetchTournament();
      }

      function importTournamentRecord() {
         modalViews.closeModal();
         importFx.importTournamentRecord().then(done, util.logError);
         function done() { fx.displayCalendar(); }
      }

      calendar_container.add.element.addEventListener('click', () => { displayGen.newTournamentMenu(); });
      calendar_container.add.element.addEventListener('contextmenu', () => fetchFx.fetchTournament());

      function modifyTournament(tournament) {
         if (!tournament || !Object.keys(tournament).length) return;

         tournament.log = [];
         if (!tournament.tuid) tournament.tuid = UUID.new();

         tournament.end = dateFx.timeUTC(new Date(tournament.end));
         tournament.start = dateFx.timeUTC(new Date(tournament.start));

         function refresh() { generateCalendar({start, end, category}); }
         db.addTournament(tournament).then(refresh, console.log);
      }

      generateCalendar({ start, end, category });

      function generateCalendar({ start, end, category }) {

         // increment end by one day so that "between" function in db.js
         // captures tournaments that end on the selected end date...
         let milli_start = start.getTime();
         let milli_end = end.getTime() + 86400000;

         db.findTournamentsBetween(milli_start, milli_end).then(displayTournyCal, util.logError);

         function displayTournyCal(tournaments) {
            var categories = util.unique(tournaments.map(t => t.category)).sort();
            var options = [{ key: '-', value: '' }].concat(...categories.map(c => ({ key: staging.legacyCategory(c, true), value: c })));
            calendar_container.category.ddlb.setOptions(options);
            calendar_container.category.ddlb.setValue(category || '', 'white');

            function filterCategory(cat) { return cat == staging.legacyCategory(category) || cat == staging.legacyCategory(category, true); }
            if (category) tournaments = tournaments.filter(t => filterCategory(t.category));
            tournaments = tournaments.filter(t => t.end <= end);

            displayGen.calendarRows(calendar_container.rows.element, tournaments);

            function dt(evt) {
               if (evt.ctrlKey || evt.shiftKey) return tournamentContextOptions(evt);
               let tuid = domFx.getParent(evt.target, 'calendar_click').getAttribute('tuid');
               return tournamentDisplay.displayTournament({tuid});
            }
            function tournamentContextOptions(evt) {
               var mouse = { x: evt.clientX, y: evt.clientY };
               var tuid = domFx.getParent(evt.target, 'calendar_click').getAttribute('tuid');
               db.findTournament(tuid).then(checkOptions, util.logError);
               function checkOptions(tournament_data) { db.findSetting('fetchTournament').then(fetch => options(fetch, tournament_data)); }

               function options(fetch, tournament_data) {
                  var options = [];
                  options.push({ label: lang.tr('delete'), key: 'delete' });
                  if (tournamentFx.sameOrg(tournament_data)) {
                     options.push({ label: lang.tr('tournaments.edit'), key: 'edit' });
                     if (fetch) options.push({ label: lang.tr('merge'), key: 'merge' });
                  }

                  if (options.length) {
                     displayGen.svgModal({ x: mouse.x, y: mouse.y, options, callback: selectionMade });
                  } else {
                     tournamentDisplay.displayTournament({ tuid });
                  }

                  function selectionMade(choice) {
                     if (choice.key == 'edit') {
                        return createNewTournament({ tournament_data, title: lang.tr('actions.edit_tournament'), callback: modifyTournament });
                     } else if (choice.key == 'delete') {
                        let unpublishAck = () => db.deleteTournament(tuid).then(done, util.logError);
                        let done = () => {
                           fx.displayCalendar();
                           searchBox.searchSelect('tournaments');
                        };
                        let deleteTournament = () => {
                           displayGen.closeModal();
                           coms.requestAcknowledgement({ uuid: tuid, callback: unpublishAck });
                           unpublishTournament(tuid);
                        };

                        var caption = `<p>${lang.tr('actions.delete_tournament')}:</p> <p>${tournament_data.name}</p>`;
                        displayGen.okCancelMessage(caption, deleteTournament, () => displayGen.closeModal());

                     } else if (choice.key == 'merge') {
                        fetchFx.fetchTournament(tuid, mouse, modifyTournament);
                     }
                  }

                  function unpublishTournament(tuid) {
                     let org = env.org;
                     let ouid = (org && org.ouid) || (tournament_data && tournament_data.org && tournament_data.org.ouid);

                     let deleteTournamentEvents = { tuid, ouid, delete_tournament: true };
                     coms.emitTmx({ deleteTournamentEvents });
                     if (tournament_data.events) {
                        tournament_data.events.forEach(evt => {
                           evt.published = false;
                           evt.up_to_date = false;
                        });
                     }
                     coms.emitTmx({ deleteOOP: { tuid, ouid }});
                  }
               }
            }
            Array.from(calendar_container.container.element.querySelectorAll('.calclk')).forEach(elem => {
               elem.addEventListener('click', dt);
               elem.addEventListener('contextmenu', tournamentContextOptions);
            });
            Array.from(calendar_container.container.element.querySelectorAll('.calctx')).forEach(elem => {
               elem.addEventListener('click', tournamentContextOptions);
               elem.addEventListener('contextmenu', tournamentContextOptions);
            });
         }
      }
   }

   fx.createNewTournament = createNewTournament;
   function createNewTournament({ title, tournament_data, callback }) {
      displayGen.escapeModal();

      let format_version = env.metadata && env.metadata.exchange_formats && env.metadata.exchange_formats.tournaments;

      var trny = Object.assign({}, tournament_data);

      if (!trny.org) trny.org = env.org;
      if (!trny.events) trny.events = [];
      if (!trny.publishing) trny.publishing = {};
      if (!trny.metadata) trny.metadata = { format_version };

      var { container } = displayGen.createNewTournament(title, trny);

      var field_order = [ 'name', 'association', 'organization', 'start', 'none', 'judge', 'draws', 'cancel', 'save' ];

      function nextFieldFocus(field) {
         let this_field = field_order.indexOf(field);
         let next_field = this_field >= 0 ? this_field + 1 : 0;
         if (next_field == field_order.length) next_field = 0;
         let next_obj = container[field_order[next_field]];
         if (next_obj) next_obj.element.focus(); 
         if (field_order[next_field] == 'none') container.judge.element.focus();
      }

      function setTournamentType(value) {
         if ((trny.events && trny.events.length) || (trny.teams && trny.teams.length)) {
            container.tournament_type.ddlb.setValue(trny.type || '', 'white');
            return displayGen.popUpMessage('Cannot change type after events/teams created.');
         } else {
            trny.type = value;
         }
      }

      if (env.tournaments && Object.keys(env.tournaments).reduce((p, c) => p || c)) {
         Array.from(container.form.element.querySelectorAll('.tournament_types')).forEach(elmnt => elmnt.style.display = 'flex');
      }
      var tournament_type_options = [{ key: lang.tr('tournaments.standard'), value: 'standard' }];
      if (env.tournaments.dual) tournament_type_options.push({ key: lang.tr('tournaments.dual'), value: 'dual' });
      if (env.tournaments.team) tournament_type_options.push({ key: lang.tr('tournaments.team'), value: 'team' });

      dd.attachDropDown({ id: container.tournament_type.id, options: tournament_type_options });
      container.tournament_type.ddlb = new dd.DropDown({ element: container.tournament_type.element, onChange: setTournamentType });

      if (!trny.type) trny.type = 'standard';
      container.tournament_type.ddlb.setValue(trny.type || '', 'white');

      function setCategory(value) {
         container.category.ddlb.selectionBackground(value ? 'white' : 'yellow');
         trny.category = value;
      }

      dd.attachDropDown({ id: container.category.id, options: rankCalc.orgCategoryOptions() });
      dd.attachDropDown({ id: container.rank.id, label: `${lang.tr('trnk')}:`, options: rankCalc.orgRankingOptions() });

      container.category.ddlb = new dd.DropDown({ element: container.category.element, onChange: setCategory });
      container.category.ddlb.selectionBackground('yellow');
      if (tournament_data && tournament_data.category) container.category.ddlb.setValue(tournament_data.category, 'white');

      function setRank(value) {
         if (value && tournament_data && tournament_data.events && tournament_data.events.length) {
            tournament_data.events.forEach(e=>{ if (!e.rank) e.rank = value; });
         }
         trny.rank = value;
      }
      container.rank.ddlb = new dd.DropDown({ element: container.rank.element, onChange: setRank });
      container.rank.ddlb.selectionBackground('white');
      if (tournament_data && tournament_data.rank) container.rank.ddlb.setValue(tournament_data.rank, 'white');

      var inout_options = [{key: '-', value: ''}, {key: lang.tr('indoors'), value: 'i'}, {key: lang.tr('outdoors'), value: 'o'}];
      dd.attachDropDown({ id: container.inout.id, options: inout_options });
      container.inout.ddlb = new dd.DropDown({ element: container.inout.element, onChange: (value) => { trny.inout = value; } });
      container.inout.ddlb.setValue(tournament_data && tournament_data.inout || '', 'white');

      var surface_options = [
         { key: '-', value: ''},
         { key: lang.tr('surfaces.clay'), value: 'C'},
         { key: lang.tr('surfaces.hard'), value: 'H'},
         { key: lang.tr('surfaces.grass'), value: 'G'},
         { key: lang.tr('surfaces.carpet'), value: 'R'}
      ];
      dd.attachDropDown({ id: container.surface.id, label: `${lang.tr('events.surface')}:`, options: surface_options, floatleft: true });
      container.surface.ddlb = new dd.DropDown({ element: container.surface.element, onChange: (value) => { trny.surface = value; } });
      container.surface.ddlb.setValue(tournament_data && tournament_data.surface || '', 'white');

      let defineAttr = (attr, evt, required, element) => {
         let valid = true;
         if (evt) element = evt.target;
         let value = element.value.trim();
         trny[attr] = value;
         if (required) {
            valid = false;
            if (typeof required != 'object') {
               valid = value;
            } else {
               if (value && required.length && value.length >= required.length) valid = true;
            }
            container[attr].element.style.background = valid ? 'white' : 'yellow';
         }
         if ((!evt || evt.which == 13 || evt.which == 9) && (!required || (required && valid))) {
            nextFieldFocus(attr);
         }
      };

      let saveTrny = () => { 
         let valid_start = !trny.start ? false : typeof trny.start == 'string' ? dateFx.validDate(trny.start) : true;
         let valid_end   = !trny.end   ? false : typeof trny.end   == 'string' ? dateFx.validDate(trny.end) : true;
         if (!valid_start || !valid_end || !trny.name || !trny.category) return;
         if (trny.type == 'standard') { trny.teams = undefined; }
         if (typeof callback == 'function') callback(trny); 
         displayGen.closeModal();
      };

      let handleSaveKeyDown = (evt) => {
         evt.preventDefault();
         if (evt.which == 9) nextFieldFocus(evt.shiftKey ? 'email' : 'save'); 
      };

      let handleSaveKeyUp = (evt) => {
         util.catchTab(evt); 
         if (evt.which == 13) saveTrny();
      };

      let handleCancelKeyEvent = (evt) => {
         evt.preventDefault();
         if (evt.which == 9) nextFieldFocus(evt.shiftKey ? 'phone' : 'cancel');
      };

      let validateDate = (evt, attr, element) => {
         if (evt) element = evt.target;
         if (element) {
            let datestring = element.value;
            let valid_date = dateFx.validDate(datestring);
            if (valid_date) {
               defineAttr(attr, evt, true, element);
            } else {
               trny[attr] = undefined;
            }
            element.style.background = valid_date ? 'white' : 'yellow';
         }

         container.start.element.style.background = dateFx.validDate(container.start.element.value) ? 'white' : 'yellow';
         container.end.element.style.background = dateFx.validDate(container.end.element.value) ? 'white' : 'yellow';
      };

      let start = dateFx.offsetDate(trny.start);
      let end = dateFx.offsetDate(trny.end);

      var startPicker = new Pikaday({
         field: container.start.element,
         defaultDate: start,
         setDefaultDate: true,
         toString(date) { return dateFx.formatDate(dateFx.timeUTC(date)); },
         i18n: lang.obj('i18n'),
         firstDay: env.calendar.first_day,
         onSelect: function() { 
            start = this.getDate();
            updateStartDate();
            validateDate(undefined, 'start', container.start.element);
            if (end < start) {
               endPicker.gotoYear(start.getFullYear());
               endPicker.gotoMonth(start.getMonth());
            }
         }
      });
      env.date_pickers.push(startPicker);
      startPicker.setStartRange(start);
      if (end) startPicker.setEndRange(end);

      var endPicker = new Pikaday({
         field: container.end.element,
         i18n: lang.obj('i18n'),
         firstDay: env.calendar.first_day,
         toString(date) { return dateFx.formatDate(dateFx.timeUTC(date)); },
         onSelect: function() {
            end = this.getDate();
            updateEndDate();
            updateCategoriesAndRankings();
            validateDate(undefined, 'end', container.end.element);
            if (end < start) {
               startPicker.gotoYear(end.getFullYear());
               startPicker.gotoMonth(end.getMonth());
            }
         }
      });
      env.date_pickers.push(endPicker);
      endPicker.setStartRange(start);
      endPicker.setMinDate(start);
      if (end) endPicker.setEndRange(end);

      container.name.element.addEventListener('keydown', util.catchTab, false);
      container.association.element.addEventListener('keydown', util.catchTab, false);
      container.organization.element.addEventListener('keydown', util.catchTab, false);
      container.judge.element.addEventListener('keydown', util.catchTab, false);
      container.draws.element.addEventListener('keydown', util.catchTab, false);

      container.name.element.addEventListener('keyup', (evt) => defineAttr('name', evt, { length: 2 }));
      container.start.element.addEventListener('keyup', (evt) => validateDate(evt, 'start'));
      container.end.element.addEventListener('keyup', (evt) => validateDate(evt, 'end'));

      container.association.element.addEventListener('keyup', (evt) => defineAttr('association', evt));
      container.organization.element.addEventListener('keyup', (evt) => defineAttr('organization', evt));
      container.judge.element.addEventListener('keyup', (evt) => defineAttr('judge', evt));
      container.draws.element.addEventListener('keyup', (evt) => defineAttr('draws', evt));

      container.cancel.element.addEventListener('click', () => displayGen.closeModal());
      container.cancel.element.addEventListener('keydown', handleCancelKeyEvent);
      container.cancel.element.addEventListener('keyup', (evt) => { if (evt.which == 13) displayGen.closeModal(); });
      container.save.element.addEventListener('click', saveTrny);
      container.save.element.addEventListener('keydown', handleSaveKeyDown, false);
      container.save.element.addEventListener('keyup', handleSaveKeyUp, false);

      function updateStartDate() {
         trny.start = dateFx.timeUTC(start);
         startPicker.setStartRange(start);
         endPicker.setStartRange(start);
         endPicker.setMinDate(start);
      }
      function updateEndDate() {
         trny.end = dateFx.timeUTC(end);
         startPicker.setEndRange(end);
         startPicker.setMaxDate(end);
         endPicker.setEndRange(end);
      }
      function updateCategoriesAndRankings() {
         console.log('categories and rankings may change when tournament dates change');
      }

      // set the start range and initial date
      startPicker.setDate(start);
      updateStartDate();

      // timeout necessary because startPicker.setDate()
      setTimeout(function() { container.name.element.focus(); }, 50);
   }

   return fx;
}();
