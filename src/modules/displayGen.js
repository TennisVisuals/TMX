import { util } from './util';
import { dd } from './dropdown';
import { drawFx } from './drawFx';
import { jsTabs } from './jsTabs';
import { lang } from './translator';
import { staging } from './staging';
import { fetchFx } from './fetchFx';
import { playerFx } from './playerFx';
import { exportFx } from './exportFx';
import { displayFx } from './displayFx';
import { searchBox } from './searchBox';
import { timeSeries } from './timeSeries';
import { ladderChart } from './ladderChart';
import { contextMenu } from './contextMenu';
import { tournamentFx } from './tournamentFx';
import { floatingEntry } from './floatingEntry';

export const displayGen = function() {

   let gen = {
      modal: 0,
      info: 'info',  // future true/false option setting
      infoleft: 'infoleft',  // future true/false option setting
      dragdrop: false,
      onreset: undefined,
      content: undefined,
      arrowFx: undefined,
      escapeFx: undefined,
   };

   let env = {
      calstart: undefined,
      calend: undefined
   }

   // BUSY fx ---------------------------------------------------------
   let busy = {
      count: 0,
      callbacks: {},
   }

   gen.fx = {
      env: () => { console.log('environment request'); return {}; },
      settings: () => console.log('settings'),
      setMap: () => console.log('set map'),
      pointsTable: () => console.log('points table'),
      orgCategoryOptions: () => console.log('org category options'),
   }

   gen.busy = {};
   gen.busy.message = (text, callback) => {
      busy.count += 1;
      if (callback) busy.callbacks[busy.count] = callback;
      gen.showProcessing(text);
      return busy.count;
   }

   gen.busy.done = (id) => {
      if (id && busy.callbacks[id]) {
         busy.callbacks[id]();
         delete busy.callbacks[id];
      }
      if (busy.count) busy.count -= 1;
      if (!busy.count) gen.closeModal();
   }
   // END BUSY fx ---------------------------------------------------------

   let dfx = drawFx();

   document.addEventListener('keydown', evt => { 
      // capture key up/left/down/right events and pass to subscribed function
      if (evt.key.indexOf('Arrow') == 0 && typeof gen.arrowFx == 'function') gen.arrowFx(evt.key); 
      if (evt.key.indexOf('Escape') == 0 && typeof gen.escapeFx == 'function') gen.escapeFx(); 
      if ((evt.keyCode == 13 || evt.keyCode == 9) && gen.disable_keypress) {
         evt.preventDefault();
         evt.stopPropagation();
      }
      if (gen.content == 'calendar' && !gen.modal && evt.keyCode == '112' && env.calstart) document.getElementById(env.calstart).focus();
      if (gen.content == 'calendar' && !gen.modal && evt.keyCode == '113' && env.calend) document.getElementById(env.calend).focus();
   });

   document.addEventListener('keyup', evt => { 
      if ((evt.keyCode == 13 || evt.keyCode == 9) && gen.disable_keypress) {
         evt.preventDefault();
         evt.stopPropagation();
      }
   });

   document.addEventListener('mouseover', evt => {
      if (evt.target.classList.contains('ctxclk')) evt.target.classList.add('context_click');
   });

   document.addEventListener('mouseout', evt => {
      if (evt.target.classList.contains('ctxclk')) evt.target.classList.remove('context_click');
   });

   let surface_icons = {
      'C': 'surface_clay',
      'R': 'surface_carpet',
      'H': 'surface_hard',
      'G': 'surface_grass',
   }

   let inout_icons = {
      'i': 'inout_indoors',
      'o': 'inout_outdoors',
   }

   gen.reset = () => {
      gen.modal = 0;
      gen.content = undefined;
      if (typeof gen.onreset == 'function') gen.onreset();
      if (document.body.scrollIntoView) document.body.scrollIntoView();
   }

   let fullName = (p) => `${p.last_name.toUpperCase()}, ${util.normalizeName(p.first_name, false)}`;

   function matchSort(matches) {
      let rounds = ['RRF', 'RR3', 'RR2', 'RR1', 'RR', 'Q5', 'Q4', 'Q3', 'Q2', 'Q1', 'Q', 'R128', 'R64', 'R32', 'R24', 'R16', 'R12', 'QF', 'SF', 'F'];
      return matches.sort((a, b) => rounds.indexOf(a.round) - rounds.indexOf(b.round));
   }

   // sort scheduled matches by round / court
   function scheduledSort(scheduled) {
      let ordered_scheduled = [];

      let dates = scheduleAttributeValues(scheduled, 'day').sort();
      // extra util.unique required here because of leagacy situation where rounds were both ints and strings
      let rounds = util.unique(scheduleAttributeValues(scheduled, 'oop_round').map(r=>parseInt(r))).sort((a, b) => a - b);
      let courts = scheduleAttributeValues(scheduled, 'court').sort();

      dates.forEach(date => {
         let date_matches = scheduled.filter(m=>m.schedule.day == date);
         rounds.forEach(round => {
            let round_matches = date_matches.filter(m=>m.schedule.oop_round == round);
            courts.forEach(court => {
               round_matches.filter(m=>m.schedule.court == court).forEach(match => ordered_scheduled.push(match));
            });
         });
      });

      return ordered_scheduled;

      function scheduleAttributeValues(matches, attr) {
         return matches.reduce((p, c) => p.indexOf(c.schedule[attr]) >= 0 ? p : [].concat(c.schedule[attr], ...p), []);
      }
   }

   let measureTextWidth = (txt, font) => {
      let element = document.createElement('canvas');
      let context = element.getContext("2d");
      context.font = font;
      return context.measureText(txt).width;
   }

   let setWidth = (inputElement, padding = 0) => {
      let style = window.getComputedStyle(inputElement, null);
      let text = inputElement.value || inputElement.placeholder;
      let width = measureTextWidth(text, style.font);
      inputElement.style.width = (width + +padding) + 'px';
   }

   let resizeInput = (elem, padding = 2) => elem.style.width = elem.value.length + padding + "ch";

   let classObj = (classes) => Object.assign({}, ...Object.keys(classes).map(cls => { return { [cls]: classes[cls] } }));

   let displayContent = (html, content) => {
      gen.content = content;
      document.getElementById('content').innerHTML = html;
   }

   let selectDisplay = (html, content) => {
      if (!gen.modal && (!gen.content || gen.content == 'splash' || gen.inExisting(content))) {
         // conditions where content should replace existing
         displayContent(html, content);
         return 'content';
      } else {
         // otherwise show new content in modal
         if (!gen.modal) {
            gen.showModal(html);
            return 'modal';
         } else {
            gen.showEdit(html);
            return 'edit';
         }
      }
   }

   gen.svgModal = ({ x, y, options, callback }) => {
      if (!options || !options.length) { return cleanUp(); }
      let opts = options.map(o => (typeof o == 'object' && o.label) ? o.label : o);

      let root = d3.select('body');
      let svg = root.append('svg')
         .attr('id', 'svgmodal')
         .attr('width', window.innerWidth)
         .attr('height', window.innerHeight)

      let menu = contextMenu().selector(svg.node()).events({ 'cleanup': cleanUp });
      menu
         .items(...opts)
         .events({ 'item': { 'click': (d, i) => returnSelection(options[i], i) } });

      setTimeout(function() { menu(x, y); }, 300);

      document.body.style.overflow  = 'hidden';
      gen.escapeFx = () => cleanUp();

      function returnSelection(d, i) {
         if (typeof callback == 'function') callback(d, i);
      }
      function cleanUp() { 
         gen.escapeFx = undefined;
         document.body.style.overflow  = null;
         svg.remove(); 
      }
   }

   gen.initModals = () => {
      let emodal = document.createElement('div');
      emodal.id = 'edit';
      emodal.classList = 'editmodal';
      emodal.style.cssText = 'display: none;';
      emodal.innerHTML = `
        <div id="close-edit" class="closeicon closeeditmodal"></div>
        <div class="modal-content">
           <div id="edittext" class="modaltext noselect"> </div>
        </div>
     `;
      window.document.body.insertBefore(emodal, window.document.body.firstChild);
      let modal = document.createElement('div');
      modal.id = 'modal';
      modal.classList = 'modal';
      modal.style.cssText = 'display: none;';
      modal.innerHTML = `
        <div id="close-modal" class="closeicon closemodal"></div>
        <div class="modal-content">
           <div id="modaltext" class="modaltext noselect"> </div>
        </div>
     `;
      window.document.body.insertBefore(modal, window.document.body.firstChild);
      let pmodal = document.createElement('div');
      pmodal.id = 'processing';
      pmodal.classList = 'modal';
      pmodal.style.cssText = 'display: none;';
      pmodal.innerHTML = `
        <div class="modaloffset flexcenter">
           <div class="modalcontent flexcenter">
              <div id="processingtext" class="noselect"> </div>
           </div>
        </div>
     `;
      window.document.body.insertBefore(pmodal, window.document.body.firstChild);
      let cmodal = document.createElement('div');
      cmodal.id = 'configmodal';
      cmodal.classList = 'modal';
      cmodal.style.cssText = 'display: none;';
      cmodal.innerHTML = `
         <div class="modaloffset flexcenter">
           <div class="modalcontent flexcenter">
              <div id="configtext" class="noselect"> </div>
           </div>
        </div>
     `;
      window.document.body.insertBefore(cmodal, window.document.body.firstChild);

      setTimeout(function() { util.addEventToClass('closeeditmodal', () => gen.closeModal('edit')); }, 300);
      setTimeout(function() { util.addEventToClass('closemodal', () => gen.closeModal()); }, 300); 
   }

   gen.closeModal = (which) => {
      searchBox.active = {};
      if (which) {
         document.getElementById(which).style.display = "none"; 
         gen.modal -= 1;
      } else {
         Array.from(document.querySelectorAll('.modal')).forEach(modal => modal.style.display = "none");
         gen.modal = 0;
      }
      if (!gen.modal) document.body.style.overflow  = null;
      gen.escapeFx = undefined;
      gen.disable_keypress = false;
   }

   gen.inExisting = (content) => {
      if (!content) return false;
      // coerce both content and gen.content into arrays
      if (!Array.isArray(content)) content = [content];
      let existing_content = Array.isArray(gen.content) ? gen.content : [gen.content];
      // determine whether there is any overlap between content and existing_content
      return content.map(c => existing_content.indexOf(c) >= 0).filter(f=>f).indexOf(true) >= 0;
   }

   gen.downloadTemplate = () => {
      if (searchBox.element) searchBox.element.blur();
      let ids = { 
         download: displayFx.uuid(), 
         cancel: displayFx.uuid(), 
      }

      document.body.style.overflow  = 'hidden';
      document.getElementById('processing').style.display = "flex";
      let html = `
         <div style='margin-left: 1em; margin-right; 1em;'>
            <h2 style='margin: 1em;'>${lang.tr('phrases.downloadtemplate')}</h2>
            <div style='margin: 1em;'>${lang.tr('phrases.add2database')}</div>
            <div class="flexcenter" style='margin-bottom: 2em;'>
               <button id='${ids.cancel}' class='btn btn-small dismiss'>${lang.tr('actions.cancel')}</button>
               <a href='./assets/CourtHiveImportTemplate.xlsx' download>
                  <button id='${ids.download}' class='btn btn-small accept' style='margin-left: 1em;'>${lang.tr('dl')}</button>
               </a>
            </div>
         </div>
      `;
      document.getElementById('processingtext').innerHTML = html;
      let id_obj = displayFx.idObj(ids);
      id_obj.cancel.element.addEventListener('click', () => gen.closeModal());
      id_obj.download.element.addEventListener('click', () => gen.closeModal());
   }

   gen.showProcessing = (html) => {
      if (searchBox.element) searchBox.element.blur();
      document.body.style.overflow  = 'hidden';
      document.getElementById('processingtext').innerHTML = html;
      document.getElementById('processing').style.display = "flex";
   }

   gen.okCancelMessage = (text, okAction, cancelAction) => {
      let message = `<h2>${text}</h2>`;
      gen.actionMessage({ message, actionFx: okAction, action: lang.tr('actions.ok'), cancelAction });
   }

   gen.actionMessage = ({ message_ids, message, actionFx, action, cancel, cancelAction }) => {
      if (searchBox.element) searchBox.element.blur();
      if (!cancel) cancel = lang.tr('actions.cancel');
      let ids = { cancel: displayFx.uuid(), }
      if (action) ids.ok = displayFx.uuid();
      if (message_ids) Object.assign(ids, message_ids);

      document.body.style.overflow  = 'hidden';
      document.getElementById('processing').style.display = "flex";
      let ok_button = action ? `<button id='${ids.ok}' class='btn btn-medium edit-submit' style='margin-left: 1em;'>${action}</button>` : '';
      let html = `
         <div style='margin: 1em'>${message}</div>
         <div class="flexcenter" style='margin-bottom: 2em;'>
            <button id='${ids.cancel}' class='btn btn-medium dismiss' style='display: none'>${cancel}</button>
            ${ok_button}
         </div>
      `;
      document.getElementById('processingtext').innerHTML = html;
      let id_obj = displayFx.idObj(ids);
      if (id_obj.ok) id_obj.ok.element.addEventListener('click', actionFx);
      id_obj.cancel.element.addEventListener('click', cancelAction);
      if (typeof cancelAction == 'function') id_obj.cancel.element.style.display = 'inline';
      gen.modal += 1;
      return id_obj;
   }

   gen.homeContextMessage = (refreshAction, okAction, messages, displayTournament) => {
      if (searchBox.element) searchBox.element.blur();
      let ids = { 
         ok: displayFx.uuid(), 
         refresh: displayFx.uuid(), 
      }

      document.body.style.overflow  = 'hidden';
      document.getElementById('processing').style.display = "flex";
      let update = fetchFx.update ? `<h3>${fetchFx.update}</h3>` : '';
      let refresh = update ? `<button id='${ids.refresh}' class='btn btn-medium dismiss'>${lang.tr('actions.refresh')}</button>` : '';
      let message_list = messages && messages.length ? messages.map(formatMessage) : [];
      let message_html = message_list.map(m=>m.html).join('');
      let html = `
         <h2 style='margin: 1em;'>${lang.tr('version')}: ${gen.fx.env().version}</h2>
         ${update}
         ${message_html}
         <div class="flexcenter" style='margin-bottom: 2em;'>
            ${refresh}
            <button id='${ids.ok}' class='btn btn-medium edit-submit' style='margin-left: 1em;'>${lang.tr('actions.ok')}</button>
         </div>
      `;
      document.getElementById('processingtext').innerHTML = html;
      if (messages.length) {
         messages.forEach((message, i) => {
            let dT = () => {
               displayTournament({ tuid: message.tuid });
               gen.closeModal();
            }
            if (message.inDB) document.getElementById(message_list[i].msguid).addEventListener('click', dT);
         });
      }
      let id_obj = displayFx.idObj(ids);
      id_obj.ok.element.addEventListener('click', okAction);
      if (update) id_obj.refresh.element.addEventListener('click', refreshAction);

      function formatMessage(msg) {
         let msguid = displayFx.uuid();
         let color = msg.warning ? '#EF8C7E' : msg.authorized || msg.success ? '#D1FBA7' : '#FEF8A7';
         let pointer = msg.inDB ? 'cursor: pointer;' : '';
         let html = `
            <div id='${msguid}' style='margin: 1em; padding: 1px; background-color: ${color}; ${pointer}'>
               ${lang.tr(msg.title)}: ${msg.notice}
            </div>
         `;
         return { html, msguid }
      }
   }

   gen.popUpMessage = (text, callback) => {
      if (searchBox.element) searchBox.element.blur();
      let ids = { ok: displayFx.uuid(), }
      document.body.style.overflow  = 'hidden';
      document.getElementById('processing').style.display = "flex";
      let html = `
         <h2 style='margin: 1em;'>${text}</h2>
         <div class="flexcenter" style='margin-bottom: 2em;'>
            <button id='${ids.ok}' class='btn btn-medium dismiss'>${lang.tr('actions.ok')}</button>
         </div>
      `;
      document.getElementById('processingtext').innerHTML = html;
      let id_obj = displayFx.idObj(ids);
      gen.disable_keypress = true;
      id_obj.ok.element.addEventListener('click', dismissPopUp);
      function dismissPopUp() { 
         gen.disable_keypress = false;
         document.body.style.overflow  = null;
         document.getElementById('processing').style.display = "none";
         if (typeof callback == 'function') callback();
      }
   }

   gen.showConfigModal = (html, overflow='auto') => {
      if (searchBox.element) searchBox.element.blur();
      document.body.style.overflow  = 'hidden';
      document.getElementById('configtext').innerHTML = html;
      let modal = document.getElementById('configmodal');
      modal.style.display = "flex";
      let content = modal.querySelector('.modalcontent');
      content.style.overflow = overflow;
      gen.modal += 1;
   }

   gen.showModal = (html, close = true) => {
      if (searchBox.element) searchBox.element.blur();
      document.body.style.overflow  = 'hidden';
      let modaltext = document.getElementById('modaltext');
      modaltext.innerHTML = html;
      document.getElementById('close-modal').style.display = close ? 'inline' : 'none';
      document.getElementById('modal').style.display = "flex";
      if (modaltext.scrollIntoView) modaltext.scrollIntoView();
      gen.modal += 1;
   }

   gen.showEdit = (html, close = true) => {
      if (searchBox.element) searchBox.element.blur();
      document.body.style.overflow  = 'hidden';
      document.getElementById('edittext').innerHTML = html;
      document.getElementById('close-edit').style.display = close ? 'inline' : 'none';
      document.getElementById('edit').style.display = "flex";
      gen.modal += 1;
   }

   function displayDate(timestamp) {
      let date = new Date(timestamp);
      return [util.zeroPad(date.getMonth() + 1), util.zeroPad(date.getDate())].join('&#8209;');
      // return [date.getFullYear(), util.zeroPad(date.getMonth() + 1), util.zeroPad(date.getDate())].join('-');
      // return [util.zeroPad(date.getDate()), util.zeroPad(date.getMonth() + 1), date.getFullYear()].join('&nbsp;');
   }
   function displayFullDate(timestamp) {
      let date = new Date(timestamp);
      return [date.getFullYear(), util.zeroPad(date.getMonth() + 1), util.zeroPad(date.getDate())].join('&#8209;');
   }
   function displayYear(timestamp) {
      let date = new Date(timestamp);
      return date.getFullYear();
   }

   function insertAfter(newNode, referenceNode) {
      referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
   }

   gen.markAssigned = (e) => {
      e.classed('action_done', true);
      e.select('.action_type').classed('status_todo', false).classed('status_done', true).text(lang.tr('kwn'));
      e.select('.action_player').text(util.normalizeName([searchBox.active.player.first_name, searchBox.active.player.last_name].join(' '), false));
      e.select('.action_year').text(new Date(searchBox.active.player.birth).getFullYear());
      let undo = ` <button type="button" class='btn undo'>${lang.tr('und')}</button> `;
      e.select('.action_action').html(undo);
   }

   gen.moveToTop = (elem) => {
      let e = d3.select(elem);
      let parent_element = elem.parentNode;
      parent_element.insertBefore(e.remove().node(), parent_element.firstChild);
   }

   gen.moveToBottom = (elem) => {
      let e = d3.select(elem);
      d3.select(elem.parentNode).append(function() { return e.remove().node(); });
   }

   gen.undoButton = (e) => {
      e.classed('action_done', true);
      e.select('.action_type').classed('status_todo', false).classed('status_done', true).text(lang.tr('igd'));
      let undo = ` <button type="button" class='btn undo'>${lang.tr('und')}</button> `;
      e.select('.action_action').html(undo);
   }

   gen.ignoreButton = (e, action) => {
      // TODO: clean up action.status; should be some component of load. ?
      let type = (action.status == 'unknown') ? lang.tr('unk') : lang.tr('dup');

      e.classed('action_done', false);
      e.select('.action_type').classed('status_todo', true).classed('status_done', false).text(type);
      let ignore = ` <button type="button" class='btn ignore'>${lang.tr('igd')}</button> `;
      e.select('.action_action').html(ignore);
      e.select('.action_player').html('');
      e.select('.action_year').html('');
   }

   gen.identifyPlayers = (tournament_name, outstanding) => {
      let ids = {
         actions: displayFx.uuid(),
         active_player: displayFx.uuid(),
         action_message: displayFx.uuid(),
      }
      // TODO: make a "tab" where all the completed players can be seen... and edited
      let html = `
         <div class='tournament_name flexcenter'>${tournament_name}</div>
         <div class='flexcenter' style="width: 100%">
            <div class='action_message flexcol flexcenter'>
               <div id='${ids.active_player}' class='active_player flexcenter flexrow' style='display: none'></div>
               <div id="${ids.action_message}" class='flexcenter'>
                  <div class='flexcol'>
                     <div style="font-weight: bold">${lang.tr('phrases.action')}</div>
                     <div>${lang.tr('phrases.search')}</div>
                  </div>
               </div>
            </div>
         </div>
         <div class='action_header flexrow'>
            <div class='action_type'>${lang.tr('stt')}</div>
            <div class='action_name'>${lang.tr('nm')}</div>
            <div class='action_club'>${lang.tr('clb')}</div>
            <div class='action_club'>${lang.tr('ioc')}</div>
            <div class='action_player'>${lang.tr('ply')}</div>
            <div class='action_year flexcenter'>${lang.tr('yr')}</div>
            <div class='action_action flexjustifyend' style='padding-right: 1em'>${lang.tr('act')}</div>
         </div>
         <div id='${ids.actions}' class='action_frame'>
      `;
      html += outstanding.map((action, i) => actionRow(action, i)).join('');
      html += '</div>';
      displayContent(html, 'identify');
      let id_obj = displayFx.idObj(ids);
      gen.identify_container = id_obj;
      return id_obj;
   }

   function actionRow(action, index) {
      let player_name;
      let data = action.player;
      let odd = index % 2;
      let type = (action.status == 'unknown') ? lang.tr('unk') : lang.tr('dup');
      player_name = `${data.first_name} ${data.last_name}`;
      let html = `
         <div class='action_edit section_row detail flexrow ${odd ? 'row_odd' : ''}' action_index='${index}'>
            <div class='action_type status_todo'>${type}</div>
            <div class='action_name'>${util.normalizeName(player_name, false)}</div>
            <div class='action_club'>${data.club || ''}</div>
            <div class='action_club'>${data.ioc || (data.club ? 'CRO' : '')}</div>
            <div class='action_player'>&nbsp;</div>
            <div class='action_year flexcenter'>&nbsp;</div>
            <div class='action_action flexjustifyend'>
               <button type="button" class='btn ignore'>${lang.tr('igr')}</button>
            </div>
         </div>`;
      return html;
   }

   gen.activePlayer = (p, club) => {
      let birthday;
      let name = util.normalizeName(p.first_name + ' ' + p.last_name, false);

      if (p.birth) {
         birthday = displayYear(p.birth);
      } else {
         birthday = lang.tr('unk');
      }
      let html = `
         <div class='flexcol' style='width: 100%'>
            <div class='plabel flexcenter'>${lang.tr('nm')}:</div><div class='pvalue flexcenter'><div style="text-align: left">${name}</div></div>
         </div>
         <div class='flexcol' style='width: 100%'>
            <div class='plabel flexcenter'>${lang.tr('id')}:</div><div class='pvalue flexcenter'>${p.puid}</div>
         </div>
         <div class='flexcol' style='width: 100%'>
            <div class='plabel flexcenter'>${lang.tr('clb')}:</div><div class='pvalue flexcenter'>${club.code || 'Unknown'}</div>
         </div>
         <div class='flexcol' style='width: 100%'>
            <div class='plabel flexcenter'>${lang.tr('bd')}:</div><div class='pvalue flexcenter'>${birthday}</div>
         </div>
      `;

      gen.identify_container.active_player.element.innerHTML = html;
      gen.identify_container.active_player.element.style.display = 'flex';
      gen.identify_container.action_message.element.innerHTML = `
         <div class="flexrow">
            <div>${lang.tr('phrases.assign')}&nbsp;</div>
            <button type="button" class='btn dismiss'>${lang.tr('dss')}</button>
         </div>
      `;
   }

   gen.submitEdits = () => {
      gen.identify_container.active_player.element.innerHTML = '';
      gen.identify_container.active_player.element.style.display = 'none';
      gen.identify_container.action_message.element.innerHTML = `
         <div class="flexrow flexcenter">
            <button type="button" class='btn btn-large accept'>${lang.tr('apt')}</button>
            <div>${lang.tr('phrases.accept')}</div>
         </div>
      `;
   }

   gen.clearActivePlayer = () => {
      let ap = gen.identify_container.active_player.element;
      if (ap) {
         ap.innerHTML = '';
         ap.style.display = 'none';
         gen.identify_container.action_message.element.innerHTML = `
            <div class='flexcol'>
               <div style="font-weight: bold">${lang.tr('phrases.action')}</div>
               <div>${lang.tr('phrases.search')}</div>
            </div>
         `;
      }
   }

   // TODO: this is currently not used...
   gen.playerApproveActions = () => {
      let ids = {
         cancel: displayFx.uuid(),
         promote: displayFx.uuid(),
         demote: displayFx.uuid(),
      }
      // TODO: lang.tr Approve/Remove
      let html = `
         <div class="assignment-actions flexcenter">
            <button id='${ids.cancel}' class='btn btn-medium dismiss'>${lang.tr('ccl')}</button>
            <button id='${ids.promote}' class='btn btn-medium accept' style='margin-left: 1em; display: none'>Approve</button>
            <button id='${ids.demote}' class='btn btn-medium undo' style='margin-left: 1em; display: none'>Remove</button>
         </div>
      `;

      gen.showConfigModal(html);
      let id_obj = displayFx.idObj(ids);
      return id_obj;
   }

   gen.playerAssignmentActions = (container) => {
      let ids = {
         add: displayFx.uuid(),
         cancel: displayFx.uuid(),
         signin: displayFx.uuid(),
         signout: displayFx.uuid(),
         new_player: displayFx.uuid(),
      }
      let html = `
         <div class="assignment-actions flexcenter">
            <button id='${ids.new_player}' class='btn btn-medium accept' style='display: none'>${lang.tr('signin.create_new_player')}</button>
            <button id='${ids.cancel}' class='btn btn-medium dismiss' style='margin-left: 1em;'>${lang.tr('ccl')}</button>
            <button id='${ids.add}' class='btn btn-medium accept' style='margin-left: 1em; display: none'>${lang.tr('add')}</button>
            <button id='${ids.signin}' class='btn btn-medium accept' style='margin-left: 1em; display: none'>${lang.tr('sgi')}</button>
            <button id='${ids.signout}' class='btn btn-medium undo' style='margin-left: 1em; display: none'>${lang.tr('sgo')}</button>
         </div>
      `;
      container.actions.element.innerHTML = html;
      let id_obj = displayFx.idObj(ids);
      return id_obj;
   }

   gen.playerPoints = (point_events, title, expire_date) => {
      let html = `
         <div class='section_row flexrow section_header'>
            <div class='ptrny'><b>${lang.tr('trn')}</b></div>
            <div class='pround'><b>${lang.tr('rnd')}</b></div>
            <div class='pdate'><b>${lang.tr('dt')}</b></div>
            <div class='pformat'><b>${lang.tr('fmt')}</b></div>
            <div class='pcat'><b>${lang.tr('cat')}</b></div>
            <div class='prank'><b>${lang.tr('trnk')}</b></div>
            <div class='points'><b>${lang.tr('pts')}</b></div>
         </div>`;
      point_events.forEach((points, i) => html += playerPointRow(points, i % 2, expire_date));
      html += playerPointsTotal(point_events);
      return html;
   }

   function playerPointsTotal(point_events) {
      let total = point_events.length ? point_events.map(p => p.points).reduce((a, b) => +a + +(b || 0)) : 0;
      let html = `
         <div class="pdivider"></div>
         <div class='section_row flexrow header'>
            <div class='psummary'><b>Total</b></div>
            <div class='ptotal'><b>${total}</b></div>
         </div>`;
      return html;
   }

   function playerPointRow(points, odd, expire_date) {
      if (!points.points) return '';
      let date = new Date(points.date);
      let expired = expire_date && date.getTime() <= expire_date ? 'expired' : '';
      let even = odd ? 'row_even' : '';
      let formatted_date = [util.zeroPad(date.getMonth() + 1), util.zeroPad(date.getDate()), date.getFullYear()].join('/');
      let round = points.round;
      let format = `formats.${points.format}`;
      let html = `
         <div class='point_click section_row detail flexrow ${even} ${expired}' muid='${points.muid}' tuid='${points.tuid}'>
            <div class='ptrny'>${points.tournament_name}</div>
            <div class='pround'>${round}</div>
            <div class='pdate'>${formatted_date}</div>
            <div class='pformat'>${lang.tr(format)}</div>
            <div class='pcat'>${staging.legacyCategory(points.category, true)}</div>
            <div class='prank'>${points.rank}</div>
            <div class='points'>${points.points}</div>
         </div>`;
      return html;
   }

   gen.displayTournamentMatches = ({ tournament, container, pending_matches=[], completed_matches=[], filters=[] }) => {
      let html = ``;

      if (filters.indexOf('M') >= 0) {
         completed_matches = completed_matches.filter(f=>f.gender != 'M');
         pending_matches = pending_matches.filter(f=>f.gender != 'M');
      }
      if (filters.indexOf('W') >= 0) {
         completed_matches = completed_matches.filter(f=>f.gender != 'W');
         pending_matches = pending_matches.filter(f=>f.gender != 'W');
      }

      if (pending_matches.length) {
         let scheduled = scheduledSort(pending_matches.filter(m=>m.schedule && m.schedule.court));
         let unscheduled = matchSort(pending_matches.filter(m=>!m.schedule || !m.schedule.court));

         if (unscheduled.length) {
            html += matchBlock({ title: lang.tr('draws.unscheduled'), tournament, matches: unscheduled, type: 'unscheduled' });
         }
         if (scheduled.length) {
            html += matchBlock({ title: lang.tr('draws.scheduled'), tournament, matches: scheduled, type: 'scheduled' });
         }
      }

      let rr = (m) => m.round_name && m.round_name.indexOf('RR') >= 0 && m.round_name.indexOf('Q') < 0;
      let qual = (m) => m.round_name && m.round_name.indexOf('Q') >= 0 && m.round_name.indexOf('QF') < 0;
      let singles = matchSort(completed_matches.filter(m => m.format == 'singles')).reverse();
      let doubles = matchSort(completed_matches.filter(m => m.format == 'doubles')).reverse();
      let roundrobin = singles.filter(m => rr(m));
      let qualifying = singles.filter(m => qual(m));
      if (roundrobin.length || qualifying.length) singles = singles.filter(m => !rr(m) && !qual(m));

      if (completed_matches.length) {
         html += `<div class='flexcenter match_block_title'>${lang.tr('draws.completed')}</div>`;
         let completed_ordered = [].concat(...singles, ...qualifying, ...roundrobin, ...doubles);
         html += matchBlock({ matches: completed_ordered, tournament, type: 'completed' });
      }

      /*
      if (singles.length) html += matchBlock({ matches: singles, type: 'completed' });
      if (doubles.length) html += matchBlock({ matches: doubles, type: 'completed' });
      if (qualifying.length) html += matchBlock({ matches: qualifying, type: 'completed' });
      if (roundrobin.length) html += matchBlock({ matches: roundrobin, type: 'completed' });
      */

      /*
      if (singles.length) html += matchBlock({ title: lang.tr('sgl'), matches: singles, type: 'completed' });
      if (doubles.length) html += matchBlock({ title: lang.tr('dbl'), matches: doubles, type: 'completed' });
      if (qualifying.length) html += matchBlock({ title: lang.tr('qal'), matches: qualifying, type: 'completed' });
      if (roundrobin.length) html += matchBlock({ title: lang.tr('rrb'), matches: roundrobin, type: 'completed' });
      */

      container.matches.element.innerHTML = html;
      container.matches.element.style.display = 'flex';
   }
   
   let courtSort = (a, b) => {
       let textA = !a['court'] ? undefined : a['court'].toUpperCase();
       let textB = !b['court'] ? undefined : b['court'].toUpperCase();
       return (!textA || textA < textB) ? -1 : (textA > textB) ? 1 : 0;
   }
   
   function alphaSort(obj, attr) {
      obj.sort((a, b) => {
          let textA = !a[attr] ? undefined : a[attr].toUpperCase();
          let textB = !b[attr] ? undefined : b[attr].toUpperCase();
          return (!textA || textA < textB) ? -1 : (textA > textB) ? 1 : 0;
      });
   }
   
   function timestringSort(obj, attr) {
      obj.sort((a, b) => {
          let timeA = !a[attr] ? undefined : +a[attr].split(':').join('');
          let timeB = !b[attr] ? undefined : +b[attr].split(':').join('');
          return !timeA ? -1 : timeA - timeB;
      });
   }

   gen.showSelectedPlayers = (players, filters=[], category=11, rows=3) => {
      var gender = filters.indexOf('M') >= 0 ? 'Boys' : 'Girls';
      var html = `<div class='flexcenter' style='margin-bottom: 1em;'>U${category} ${gender}</div>`;
      var width = Math.round(100/rows);
      if (filters.indexOf('M') >= 0) players = players.filter(f=>f.sex == 'M');
      if (filters.indexOf('W') >= 0) players = players.filter(f=>f.sex == 'W');
      var flag_root = gen.fx.env().assets.flags;
      var plz_groups = [];
      var plz_group = [];
      var count = 0;
      while (players.length) {
         if (count + 1 > rows) {
            plz_groups.push(plz_group);
            plz_group = [];
            count = 0;
         }
         plz_group.push(players.shift());
         count += 1;
      }
      if (plz_group.length) plz_groups.push(plz_group);
      html += `<div class='flexcol flexjustifystart' style='width: 100%;'>${plz_groups.map(playerGroup).join('')}</div>`;
      gen.showModal(html);

      function playerGroup(plz) { return `<div class='flexrow' style='margin-bottom: 2px; width: 100%; height: 1em;'>${plz.map(playerBlock).join('')}</div>`; }
      function playerBlock(p) {
         var player_ioc = p.ioc ? (p.ioc.trim().match(/\D+/g) || [])[0] : '';
         var ioc = player_ioc ? `(<u>${player_ioc.toUpperCase()}</u>)` : '';
         var flag = `<div class='flexcenter' style='margin-right: .3em'><img onerror="this.style.visibility='hidden'" width='16px' height='10px' src="${flag_root}${player_ioc}.png"></div>`.trim();
         var first_name = util.normalizeName(p.first_name, false);
         var last_name = p.last_name ? util.normalizeName(p.last_name, false) : '';
         var full_name = `${first_name} ${last_name}`.trim();
         return `<div style='width: ${width}%;' class='flexjustifystart'>${flag}${full_name}</div>`;
      }
   }
   
   function formatTeams({tournament, match, which, puid, potentials=true}) {
      var flags = gen.fx.env().draws.tree_draw.flags.display;
      var flag_root = gen.fx.env().assets.flags;

      function playerBlock(pindex, side) {
         var p = match.players[pindex];
         if (!p.puid && potentials) return potentialBlock(p, side);
         var player_ioc = p.ioc ? (p.ioc.trim().match(/\D+/g) || [])[0] : '';
         var ioc = player_ioc ? `(<u>${player_ioc.toUpperCase()}</u>)` : '';
         var flag =  !flags ? ioc : `<img onerror="this.style.visibility='hidden'" width="15px" src="${flag_root}${player_ioc}.png">`;
         var penalty = !tournament ? undefined : matchPenalties(tournament.players, p.puid, match.muid);
         var penalty_icon = !penalty ? '' : `<img height="10px" src="./icons/penalty.png">`;
         var assoc = p.club_code ? `(${p.club_code})` : p.ioc && player_ioc != undefined ? flag : '';
         var left = side == 'right' ? `${assoc} ` : `${penalty_icon}`;
         var right = side == 'left' ? ` ${assoc}` : `${penalty_icon}`;
         var first_name = util.normalizeName(p.first_name, false);
         var last_name = p.last_name ? util.normalizeName(p.last_name, false).toUpperCase() : '';
         var seed = p.seed ? ` [${p.seed}]` : '';
         return `<div puid='${p.puid}' class='${side}_team ctxclk player_click cell_player'>${left}${first_name} ${last_name}${seed}${right}</div>`;
      }

      function potentialBlock(p, side) {
         var player_ioc = p.ioc ? (p.ioc.trim().match(/\D+/g) || [])[0] : '';
         var ioc = player_ioc ? `{${player_ioc.toUpperCase()}}` : '';
         var flag =  !flags ? ioc : `<img onerror="this.style.visibility='hidden'" width="15px" src="${flag_root}${player_ioc}.png">`;
         var assoc = p.club_code ? `(${p.club_code})` : p.ioc && player_ioc != undefined ? flag : '';
         var left = side == 'right' ? `${assoc} ` : '';
         var right = side == 'left' ? ` ${assoc}` : '';
         var last_name = p.last_name ? util.normalizeName(p.last_name, false).toUpperCase() : p.qualifier ? 'Qualifier' : '';
         var seed = p.seed ? ` [${p.seed}]` : '';
         return `<div puid='${p.puid}' class='ctxclk player_click cell_player potential'>${left}${last_name}${seed}${right}</div>`;
      }

      function unknownBlock(pindex, side) {
         if (!match.potentials) return '';
         var index = match.potentials[pindex] ? pindex : 0;
         var potentials = match.potentials[index];
         if (!potentials || potentials.filter(f=>f).length == 0) return unknown();
         var blocks = potentials
            .map(p=>stack(!p ? [unknown()] : p.map(b=>potentialBlock(b, side))))
            .join(`<div class='potential_separator flexcenter'><span>${lang.tr('or')}</span></div>`);
         return `<div class='potential_${side}'>${blocks}</div>`;

         function stack(potential_team) { return `<div class='flexcol'>${potential_team.join('')}</div>`; }
         function unknown() { return `<div class='potential'>Unknown</div>`; }
      }

      var player_position = puid ? match.outcome.winning_puids.indexOf(puid) >= 0 ? 'left' : 'right' : '';
      var pleft = puid && player_position == 'left' ? ' player' : '';
      var pright = puid && player_position == 'right' ? ' player' : '';
      var complete = match.winner != undefined;

      var left_position = 0;
      var right_position = 1;
      var left_outcome = (!complete || puid) ? '' : match.winner_index == 0 ? ' winner' : ' loser';
      var right_outcome = (!complete || puid) ? '' : match.winner_index == 1 ? ' winner' : ' loser';

      var lp = match.team_players[left_position];
      var rp = match.team_players[right_position];

      var left_team = lp ? lp.map(p=>playerBlock(p, 'left')).join('') : unknownBlock(0, 'left');
      var right_team = rp ? rp.map(p=>playerBlock(p, 'right')).join('') : unknownBlock(1, 'right');

      var left_html = `<div class='left_team${left_outcome}${pleft}'>${left_team}</div>`;
      var right_html = `<div class='right_team${right_outcome}${pright}'>${right_team}</div>`;
      var html = `
         <div class='team left_team${complete ? " winner" : ""}'>${left_team}</div>
         <div>&nbsp;-&nbsp;</div>
         <div class='team right_team${complete ? " loser" : ""}'>${right_team}</div>
      `;

      return which == 'left' ? left_html : which == 'right' ? right_html : html;
   }

   function matchBlock({ tournament, headers=true, title, divider, matches, type, puid }) {
      function matchTime(match) {
         if (match.schedule && match.schedule.day) return displayDate(new Date(match.schedule.day));
         if (match.date) return displayDate(match.date);
         return '';

         function duration(start, end) {
            var seconds = getSeconds(end) - getSeconds(start);
            if (seconds <= 0) seconds = getSeconds(end, 12) - getSeconds(start);
            if (seconds <= 0) seconds = getSeconds(end, 12) - getSeconds(start, -12);
            var hours = Math.floor(seconds / (60 * 60));
            var minutes = Math.floor(seconds - (hours * 60 * 60)) / 60;
            return `${util.zeroPad(hours)}:${util.zeroPad(minutes)}`;
         }
         function getSeconds(hm, mod=0) {
            var a = hm.split(':');
            var getNum = (x) => x && !isNaN(x) ? +x : 0;
            var hours = getNum(a[0]) + mod;
            var minutes = getNum(a[1]);
            return hours * 60 * 60 + minutes * 60;
         }
      }

      function matchDuration(match) {
         if (match.schedule && match.schedule.start && match.schedule.end) {
            let d = duration(match.schedule.start, match.schedule.end);
            return `<b>${d}</b>`;
         }
         return '';

         function duration(start, end) {
            var seconds = getSeconds(end) - getSeconds(start);
            if (seconds <= 0) seconds = getSeconds(end, 12) - getSeconds(start);
            if (seconds <= 0) seconds = getSeconds(end, 12) - getSeconds(start, -12);
            var hours = Math.floor(seconds / (60 * 60));
            var minutes = Math.floor(seconds - (hours * 60 * 60)) / 60;
            return `${util.zeroPad(hours)}:${util.zeroPad(minutes)}`;
         }
         function getSeconds(hm, mod=0) {
            var a = hm.split(':');
            var getNum = (x) => x && !isNaN(x) ? +x : 0;
            var hours = getNum(a[0]) + mod;
            var minutes = getNum(a[1]);
            return hours * 60 * 60 + minutes * 60;
         }
      }

      function tournamentData(match) {
         return (!match.tournament || !match.tournament.name) ? '' : `<div class='tournament_click' tuid='${match.tournament.tuid}'>${match.tournament.name}</div>`;
      }

      function matchStatus(match) {
         let start_time = match.schedule && match.schedule.start ? `${lang.tr('draws.starttime')}: ${match.schedule.start}` : '';
         return match.status || start_time;
      }

      function fT({match, which, puid}) { return formatTeams({tournament, match, which, puid, potentials: false}); }
      function matchFinish(match) { return match.schedule && match.schedule.end ? match.schedule.end : ''; }
      function courtData(match) { return (match.schedule && match.schedule.court) || ''; }

      function fillSpace(match) {
         if (match.score && match.winner == undefined) return match.score.replace(/\-/g, '&#8209;');
         return '&nbsp;';
      }

      function matchScore(match) {
         let scr = match.score;
         if (match.winner_index == 1) scr = dfx.reverseScore(scr);
         return (scr && scr.replace(/\-/g, '&#8209;')) || match.score;
      }

      let round_icon = `
         <div class='${gen.info}' label='${lang.tr("rnd")}'>
            <div class='match_block_icon drawsize_header'></div>
         </div>`;
      let duration_icon = `
         <div class='${gen.info}' label='${lang.tr("duration")}'>
            <div class='match_block_icon duration_header'></div>
         </div>`;
      let time_icon = `
         <div class='${gen.info}' label='${lang.tr("draws.endtime")}'>
            <div class='match_block_icon time_header'></div>
         </div>`;
      let cal_icon = `
         <div class='${gen.info}' label='${lang.tr("dt")}'>
            <div class='match_block_icon cal_header'></div>
         </div>`;
      let status_icon = `
         <div class='${gen.info}' label='Status'>
            <div class='match_block_icon status_header'></div>
         </div>`;
      let score_icon = `
         <div class='${gen.info} flexcenter' label='${lang.tr("scr")}'>
            <img src="./icons/scoreboard.png" style='width: 30px;'>
         </div>`;
      let court_icon = `
         <div class='flexcenter ${gen.info}' style='width: 100%' label='${lang.tr("crt") || "Court"}'>
            <div class='match_block_icon surface_header'></div>
         </div>`;

      let round = { header: round_icon, cell: 'flexcenter flexjustifystart padright', column: 'round', fx: (m) => m.round_name || m.round || '' };
      let trny = { header: '', cell: 'flexcenter flexjustifystart padright trim15', column: 'tournament', fx: tournamentData };
      let time = { header: cal_icon || '${lang.tr("time")}', cell: 'flexcenter padaround', column: 'time', fx: matchTime };
      let players = { header: `${lang.tr('pyr')} [${lang.tr('prnk').toLowerCase()}]`, cell: 'matchrow ctxclk', column: 'teamcolumn', fx: match => fT({match}) };
      let score = { header: score_icon, cell: 'flexcenter padright matchscore', column: '', fx: matchScore };
      let duration = { header: duration_icon, cell: 'flexcenter duration padaround', column: '', fx: matchDuration };
      let finish = { header: time_icon, cell: 'flexcenter duration padaround', column: '', fx: matchFinish };
      let court = { header: court_icon, cell: 'flexcenter padaround', column: 'court', fx: courtData };
      let statuz = { header: status_icon || 'Status', cell: 'flexcenter flexjustifystart padaround', column: 'status', fx: matchStatus };

      let teamleft = { header: '', cell: 'matchrow', column: 'teamcolumn', fx: match => fT({ match, which: 'left', puid }) };
      let teamright = { header: '', cell: 'matchrow', column: 'teamcolumn', fx: match => fT({ match, which: 'right', puid }) };
      let spacer = { header: '', cell: 'flexcenter', column: '', fx: () => '&nbsp;-&nbsp;' };
      let filler = { header: '', cell: 'flexcenter', column: 'filler', fx: fillSpace };

      let directives = [];
      if (type == 'completed') {
         directives = [ round, time, finish, teamleft, spacer, teamright, filler, score ];
         if (window.innerWidth > 700) {
            directives.push(duration);
            // directives.push(court);
         }
      } else if (type == 'scheduled') {
         directives = [ round, time, court, teamleft, spacer, teamright, filler, statuz ];
      } else if (type == 'unscheduled') {
         directives = [ round, teamleft, spacer, teamright, filler, statuz ];
      } else if (type == 'historical') {
         directives = [ time, teamleft, spacer, teamright, filler];
         if (window.innerWidth > 1000) {
            directives.push(round);
            directives.push(trny);
         }
         directives.push(score);
      }

      let columns = directives.map(d => {
         let header_row = headers ? `<div class='${d.cell} header'>${d.header}</div>` : '';
         let match_rows = matches.map(match => {
            let euid = !match.event ? '' : ` euid='${match.event.euid}'`;
            let style = 'border-bottom: 1px solid #E8E9EF;';
            return `<div class='cell_${match.format} ${d.cell}' style='${style}' muid='${match.muid}'${euid}>${d.fx(match)}</div>`
         });
         let rows = [].concat(header_row, ...match_rows);
         return `<div class='column ${d.column}'>${rows.join('')}</div>`;
      }).join('');

      let title_display = title ? `<div class='match_block_title'>${title}</div>` : '';
      let section_divider = divider ? `<div class='match_block_divider'>${divider}</div>` : '';
      return  `${title_display}<div class='match_block'>${columns}</div>`;
   }

   gen.playerProfile = (display) => {
      let ids = {
         info: displayFx.uuid(),
         season: displayFx.uuid(),
         actions: displayFx.uuid(),
         matches: displayFx.uuid(),
         rankings: displayFx.uuid(),
         rankchart: displayFx.uuid(),
         rankingsdate: displayFx.uuid(),
         container: displayFx.uuid(),
      }

      let html = `
         <div id=${ids.container} class='playerprofile'>
            <div class='player_section'>
               <div id=${ids.info}></div>
            </div>
            <div class='player_section'>
               <div id=${ids.actions}></div>
            </div>
            <div class='player_section'>
               <div id=${ids.season}></div>
            </div>
            <div class='player_section'>
               <div id=${ids.rankchart}></div>
            </div>
            <div class='player_rankings' style='display: none'>
               <h2>${lang.tr('rlp')}</h2>
               <div class='flexcenter'><input id=${ids.rankingsdate} style='height: 1.5em; margin-left: 2em;' class='rankingsdate'></div>
            </div>
            <div class='player_section' id=${ids.rankings}></div>
            <div class='player_section' id=${ids.matches}> </div>
         </div>`;

      if (display && typeof display == 'function') {
         display(html);
      } else {
         selectDisplay(html, 'player');
      }
      let id_obj = displayFx.idObj(ids);
      return id_obj;
   }

   gen.submitKey = () => {
      let ids = {
         key: displayFx.uuid(),
         submitnewkey: displayFx.uuid(),
      };
      let html = `
         <div style='min-height: 150px'>
         <h2>${lang.tr('phrases.submitkey')}</h2>
         <div class='flexcenter flexcol'>
            <input id='${ids.key}' value='' style='text-align: center; width: 25em; margin-bottom: 1em;'>
            <button id="${ids.submitnewkey}" class="btn btn-medium edit-submit" alt="${lang.tr('sbt')}">${lang.tr('sbt')}</button> 
         </div>
         </div>
      `;
      return { ids, html }
   }

   gen.existingKeys = () => {
      let ids = {
         keys: displayFx.uuid(),
         select: displayFx.uuid()
      };
      let html = `
         <div style='min-height: 150px'>
         <h2>${lang.tr('phrases.selectkey')}</h2>
         <div class='flexcenter flexrow' style='width: 100%; margin-bottom: 1em;'> <div id='${ids.keys}'></div> </div>
         <button id="${ids.select}" class="btn btn-medium edit-submit" alt="${lang.tr('sbt')}">${lang.tr('sbt')}</button> 
         </div>
      `;
      return { ids, html }
   }

   gen.keyActions = (keys=[]) => {
      let ids = {
         container: displayFx.uuid(),
         cancel: displayFx.uuid(),
      }

      let submit = gen.submitKey();
      let existing = gen.existingKeys();

      let tabdata = [ { tab: lang.tr('add'), content: submit.html } ];
      if (keys.length) tabdata.push({ tab: lang.tr('existing'), content: existing.html });
      let tabs = jsTabs.generate(tabdata);

      let cancel = `
         <div id='${ids.cancel}' class='link ${gen.info}' style='margin-left: 1em;'>
            <img src='./icons/xmark.png' class='club_link'>
         </div>`;

      let html = `
         <div id='${ids.container}' class='flexcol' style='width: 100%;'>
            <div class='settings_info'>
               <h2>${lang.tr('keys')}</h2>
               <div class='flexrow'>${cancel}</div>
            </div>
            <div>${tabs}</div>
         </div>
      `;
      
      gen.showModal(html, false);

      Object.assign(ids, submit.ids, existing.ids);
      let id_obj = displayFx.idObj(ids);

      jsTabs.load(id_obj.container.element);
      if (id_obj.cancel.element) id_obj.cancel.element.addEventListener('click', () => gen.closeModal());

      if (keys.length) {
         let options = keys.map(k=>({key: k.description, value: k.keyid}));
         dd.attachDropDown({ id: ids.keys, options });
         id_obj.keys.ddlb = new dd.DropDown({ element: id_obj.keys.element });
         id_obj.keys.ddlb.setValue(keys[0].keyid, 'white');
      }

      return { container: id_obj };
   }

   gen.tabbedModal = ({ tabs, tabdata, title, save=true }) => {
      let ids = {
         save: displayFx.uuid(),
         tabs: displayFx.uuid(),
         cancel: displayFx.uuid(),
         container: displayFx.uuid(),
      }

      let jtabs = jsTabs.generate(tabdata);

      let cancel = `
         <div id='${ids.cancel}' class='link' style='margin-left: 1em;'>
            <img src='./icons/xmark.png' class='club_link'>
         </div>`;
      let done = save ? `
         <div id='${ids.save}' class='link ${gen.info}' label='${lang.tr("apt")}' style='margin-left: 1em;'>
            <img src='./icons/finished.png' class='club_link'>
         </div>` : '';

      let html = `
         <div id='${ids.container}' class='flexcol' style='width: 100%;'>
            <div class='settings_info'>
               <h2>${title}</h2>
               <div class='flexrow'>${done}${cancel}</div>
            </div>
            <div>${jtabs}</div>
         </div>
      `;

      gen.escapeModal();
      gen.showModal(html, false);

      Object.assign(ids, ...Object.keys(tabs).filter(t=>tabs[t]).map(t=>tabs[t].ids));
      let id_obj = displayFx.idObj(ids);
      jsTabs.load(id_obj.container.element);

      return { container: id_obj };
   }

   gen.displayImage = (fx, image_url, display_id) => {
      exportFx[fx]().then(display);

      function display(image) {
         document.getElementById(display_id).innerHTML = "<img width='200px' src='" + image + "' />";
      }
   }

   gen.orgSettings = (settings) => {
      let ids = {};
      let ddlb = [];
      let html = `
         <div class='flexcenter flexcol'>
            <div>
               <div>Logos:</div>
               <div class='settings_images'>
                  <div class='edit_org_image'>
                     <input id="org_logo" type="file" style='display: none;' />
                     <label class='flexcenter' for='org_logo'><img class='settings_icon' src='./icons/upload.png'></label>
                     <div class='settings_image' id='org_logo_display'></div>
                  </div>
                  <div class='edit_org_image'>
                     <input id="org_name" type="file" style='display: none;' />
                     <label class='flexcenter' for='org_name'><img class='settings_icon' src='./icons/upload.png'></label>
                     <div class='settings_image' id='org_name_display'></div>
                  </div>
               </div>
            </div>
         </div>

      `;
      return { ids, html, ddlb }
   }

   // Create categories
   // Each category consists of minimum age, maximum age and gender
   gen.categorySettings = () => {
      let ids = {};
      let ddlb = [];
      let html = ``;
      return { ids, html, ddlb }
   }

   gen.pointsSettings = () => {
      let ids = {};
      let ddlb = [];
      let html = ``;
      return { ids, html, ddlb }
   }

   gen.eventsSettings = () => {
      let ids = {};
      let ddlb = [];
      let html = ``;
      return { ids, html, ddlb }
   }

   gen.drawSettings = () => {
      let separation = gen.fx.env().draws.settings.separation ? '' : 'disabled';
      let ids = {
         auto_byes: displayFx.uuid(),
         compressed_draw_formats: displayFx.uuid(),
         fixed_bye_order: displayFx.uuid(),
         separate_by_ioc: displayFx.uuid(),
         separate_by_club: displayFx.uuid(),
         ll_all_rounds: displayFx.uuid(),
         qualconsolation: displayFx.uuid(),
         consolationalts: displayFx.uuid(),
         consolationseeds: displayFx.uuid(),
         display_flags: displayFx.uuid(),
         match_date: displayFx.uuid(),
         court_detail: displayFx.uuid(),
         after_matches: displayFx.uuid(),
      };
      let ddlb = [];
      let html = `
         <div style='min-height: 150px'>
         <h2>&nbsp;</h2>
         <div class='flexcenter' style='width: 100%;'>
             <div class='attribute_box' style='border: 1px solid gray; padding: .5em;'>
                <div class='tournament_attr'>
                    <label class='calabel'>${lang.tr('settings.compresseddraws')}:</label>
                    <input type='checkbox' id="${ids.compressed_draw_formats}">
                </div>
                <div class='tournament_attr'>
                    <label class='calabel'>${lang.tr('settings.automatedbyes')}:</label>
                    <input type='checkbox' id="${ids.auto_byes}">
                </div>
                <div class='tournament_attr'>
                    <label class='calabel'>${lang.tr('settings.fixedbyes')}:</label>
                    <input type='checkbox' id="${ids.fixed_bye_order}">
                </div>
                <div class='tournament_attr'>
                    <label class='calabel'>${lang.tr('settings.separate_by_ioc')}:</label>
                    <input type='checkbox' id="${ids.separate_by_ioc}" ${separation}>
                </div>
                <div class='tournament_attr'>
                    <label class='calabel'>${lang.tr('settings.separate_by_club')}:</label>
                    <input type='checkbox' id="${ids.separate_by_club}" ${separation}>
                </div>
             </div>
             <div class='attribute_box' style='border: 1px solid gray; padding: .5em;'>
                <div class='tournament_attr'>
                    <label class='calabel'>${lang.tr('settings.llallrounds')}:</label>
                    <input type='checkbox' id="${ids.ll_all_rounds}">
                </div>
                <div class='tournament_attr'>
                    <label class='calabel'>${lang.tr('settings.qualconsolation')}:</label>
                    <input type='checkbox' id="${ids.qualconsolation}">
                </div>
                <div class='tournament_attr'>
                    <label class='calabel'>${lang.tr('settings.consolationalts')}:</label>
                    <input type='checkbox' id="${ids.consolationalts}">
                </div>
                <div class='tournament_attr'>
                    <label class='calabel'>${lang.tr('settings.consolationseeds')}:</label>
                    <input type='checkbox' id="${ids.consolationseeds}">
                </div>
             </div>
             <div class='attribute_box' style='border: 1px solid gray; padding: .5em;'>
                <div class='tournament_attr'>
                    <label class='calabel'>${lang.tr('settings.countryflags')}:</label>
                    <input type='checkbox' id="${ids.display_flags}">
                </div>
                <div class='tournament_attr'>
                    <label class='calabel'>${lang.tr('settings.courtdetail')}:</label>
                    <input type='checkbox' id="${ids.court_detail}">
                </div>
                <div class='tournament_attr'>
                    <label class='calabel'>${lang.tr('settings.matchesbefore')}:</label>
                    <input type='checkbox' id="${ids.after_matches}">
                </div>
                <div class='tournament_attr'>
                    <label class='calabel'>${lang.tr('settings.matchdates')}:</label>
                    <input type='checkbox' id="${ids.match_date}">
                </div>
             </div>
         </div>

         </div>
      `;
      return { ids, html, ddlb }
   }

   gen.generalSettings = () => {
      let ids = {
         first_day: displayFx.uuid(),
         documentation: displayFx.uuid()
      };
      let ddlb = [];
      let html = `
         <div style='min-height: 150px'>
         <h2>&nbsp;</h2>
         <div class='flexcenter' style='width: 100%;'>
             <div class='attribute_box' style='border: 1px solid gray; padding: .5em;'>
                <div class='tournament_attr'>
                    <label class='calabel'>${lang.tr('settings.firstday')}</label>
                    <input type='checkbox' id="${ids.first_day}">
                </div>
                <div class='tournament_attr'>
                    <label class='calabel'>${lang.tr('settings.documentation')}</label>
                    <input type='checkbox' id="${ids.documentation}">
                </div>
             </div>
         </div>

         </div>
      `;
      return { ids, html, ddlb }
   }

   gen.scheduleSettings = () => {
      let ids = {
         scores_in_draw_order: displayFx.uuid(),
         completed_matches_in_search: displayFx.uuid(),
      };
      let ddlb = [];
      let html = `
         <div style='min-height: 150px'>
         <h2>&nbsp;</h2>
         <div class='flexcenter' style='width: 100%;'>
             <div class='attribute_box' style='border: 1px solid gray; padding: .5em;'>
                <div class='tournament_attr'>
                    <label class='calabel'>${lang.tr('settings.draworderscores')}</label>
                    <input type='checkbox' id="${ids.scores_in_draw_order}">
                </div>
                <div class='tournament_attr'>
                    <label class='calabel'>${lang.tr('settings.schedulecompleted')}</label>
                    <input type='checkbox' id="${ids.completed_matches_in_search}">
                </div>
             </div>
         </div>

         </div>
      `;
      return { ids, html, ddlb }
   }

   gen.searchSettings = () => {
      let ids = {
         lastfirst: displayFx.uuid(),
         diacritics: displayFx.uuid(),
      };
      let ddlb = [];
      let html = `
         <div style='min-height: 150px'>
         <h2>&nbsp;</h2>
         <div class='flexcenter' style='width: 100%;'>
             <div class='attribute_box' style='border: 1px solid gray; padding: .5em;'>
                <div class='tournament_attr'>
                    <label class='calabel'>${lang.tr('settings.lastfirst')}</label>
                    <input type='checkbox' id="${ids.lastfirst}">
                </div>
                <div class='tournament_attr'>
                    <label class='calabel'>${lang.tr('settings.diacritics')}</label>
                    <input type='checkbox' id="${ids.diacritics}">
                </div>
             </div>
         </div>

         </div>
      `;
      return { ids, html, ddlb }
   }

   gen.publishingSettings = () => {
      let ids = {
         require_confirmation: displayFx.uuid(),
         publish_on_score_entry: displayFx.uuid(),
         publish_draw_creation: displayFx.uuid(),
      };
      let ddlb = [];
      let html = `
         <div style='min-height: 150px'>
         <h2>&nbsp;</h2>
         <div class='flexcenter' style='width: 100%;'>
             <div class='attribute_box' style='border: 1px solid gray; padding: .5em;'>
                <div class='tournament_attr'>
                    <label class='calabel'>${lang.tr('settings.requireconfirm')}</label>
                    <input type='checkbox' id="${ids.require_confirmation}">
                </div>
                <div class='tournament_attr'>
                    <label class='calabel'>${lang.tr('settings.publishonscore')}</label>
                    <input type='checkbox' id="${ids.publish_on_score_entry}">
                </div>
                <div class='tournament_attr'>
                    <label class='calabel'>${lang.tr('settings.publishdrawcreation')}</label>
                    <input type='checkbox' id="${ids.publish_draw_creation}">
                </div>
             </div>
         </div>

         </div>
      `;
      return { ids, html, ddlb }
   }

   gen.printingSettings = () => {
      let ids = {
         save_pdfs: displayFx.uuid(),
      };
      let ddlb = [];
      let html = `
         <div style='min-height: 150px'>
         <h2>&nbsp;</h2>
         <div class='flexcenter' style='width: 100%;'>
             <div class='attribute_box' style='border: 1px solid gray; padding: .5em;'>
                <div class='tournament_attr'>
                    <label class='calabel'>${lang.tr('settings.savepdfs')}</label>
                    <input type='checkbox' id="${ids.save_pdfs}">
                </div>
             </div>
         </div>

         </div>
      `;
      return { ids, html, ddlb }
   }

   gen.externalRequestSettings = (settings) => {
      let category_keys = gen.fx.settings.categories.externalRequest;
      
      // filter out keys that are not currently implemented
      let keys = settings.map(s=>s.key).filter(k=>category_keys.indexOf(k)>=0);

      // add any keys that are not pressent in the database
      category_keys.forEach(key => { 
         if (keys.indexOf(key) < 0) {
            settings.push({ key }); 
            keys.push(key); 
         }
      });

      let ids = {};
      keys.forEach(k=>ids[k] = displayFx.uuid());
      keys.forEach(k=>ids[`${k}_ddlb`] = displayFx.uuid());

      let ddlb = [];
      let settings_keys = keys.map(key => `<div class='setting'>${key}:</div>`).join('');
      let settings_values = settings.map(s => {
         if (keys.indexOf(s.key) < 0) return '';
         let ddlb_id = ids[`${s.key}_ddlb`];
         ddlb.push({ key: s.key, value: s.type });
         return `<div class='flexjustifystart settingvalue'>
                   <input id='${ids[s.key]}' value='${s.url || ''}'>
                   <div id='${ddlb_id}' class='flexjustifystart settingddlb'> </div>
                 </div>`
      }).join('');

      let html = `
               <div class='settingsrow'>
                  <div class='flexcol settings'> ${settings_keys} </div>
                  <div class='flexcol settings_values'> ${settings_values} </div>
               </div>
      `;

      return { ids, html, ddlb };
   }

   gen.exportRange = ({ label, id_names }) => {
      let ids = Object.assign({}, ...Object.keys(id_names).map(id => ({ [id_names[id]]: displayFx.uuid() })));
      let ddlb = [];

      let html = `
         <div style='min-height: 150px'>
            <h2>&nbsp;</h2>
            <div class='flexcenter' style='width: 100%;'>
                <div class='attribute_row' style='border: 1px solid gray; padding: .5em;'>
                   <div class='tournament_attr'>
                       <div style='font-weight: bold; margin-right: 1em;'>${label || ''}</div>
                       <div class='flexrow'>
                          <div class='calendar_date' style='font-weight: bold'>
                             <div class='calabel'>${lang.tr('frm')}:</div>
                             <input tabindex='-1' class='calinput' id='${ids[id_names["start"]]}'>
                          </div>
                       </div>
                       <div class='flexrow'>
                          <div class='calendar_date' style='font-weight: bold'>
                             <div class='calabel'>${lang.tr('to')}:</div>
                             <input tabindex='-1' class='calinput' id='${ids[id_names["end"]]}'>
                          </div>
                       </div>
                       <button id='${ids[id_names["export"]]}' class='btn btn-small edit-submit' alt='${lang.tr("phrases.export")}'>${lang.tr("sbt")}</button> 
                   </div>
                </div>
            </div>
         </div>
      `;
      return { ids, html, ddlb }
   }

   gen.createNewTournament = (title, tournament = {}) => {
      let ids = {
         form: displayFx.uuid(),
         name: displayFx.uuid(),
         tournament_type: displayFx.uuid(),
         association: displayFx.uuid(),
         organization: displayFx.uuid(),
         category: displayFx.uuid(),
         rank: displayFx.uuid(),
         start: displayFx.uuid(),
         inout: displayFx.uuid(),
         surface: displayFx.uuid(),
         end: displayFx.uuid(),
         judge: displayFx.uuid(),
         draws: displayFx.uuid(),

         cancel: displayFx.uuid(),
         save: displayFx.uuid(),
      }

      let start = !tournament.start ? '' : util.formatDate(tournament.start);
      let end =   !tournament.end   ? '' : util.formatDate(tournament.end); 
      let header = !title ? '' : `<h2>${title}</h2>`;

      let inout = lang.tr('inout').split(' ').join('&nbsp;');
      let html = `
         <div class='add_tournament' style='margin: 2em; width: auto'>
            ${header}
            <div id='${ids.form}' class='add_tournament_form'>
               <div class='rowcol'>
                  <div class='flexcol tournamentattrs'>
                     <div class='tournamentattr tournament_types' style='display: none'>${lang.tr('tournaments.type')}:</div>
                     <div class='tournamentattr'>${lang.tr('nm')}:</div>
                     <div class='tournamentattr'>${lang.tr('cat')}:</div>
                     <div class='tournamentattr'>${lang.tr('asn')}:</div>
                     <div class='tournamentattr'>${lang.tr('signin.organization')}:</div>
                     <div class='tournamentattr'>${lang.tr('start')}:</div>
                     <div class='tournamentattr'>${lang.tr('end')}:</div>
                     <div class='tournamentattr'>${inout}:</div>
                     <div class='tournamentattr'>${lang.tr('ref')}:</div>
                     <div class='tournamentattr'>${lang.tr('drz')}:</div>
                  </div>
                  <div class='flexcol tournamentattrvalues'>
                     <div class='flexrow tournamentattrddlb tournament_types' style='display: none'>
                        <div id='${ids.tournament_type}' class='flexjustifystart'> </div>
                     </div>
                     <div class='flexjustifystart playerattrvalue'>
                        <input id='${ids.name}' value='${tournament.name || ''}'>
                     </div>
                     <div class='flexrow tournamentattrddlb'>
                        <div id='${ids.category}' class='flexjustifystart'> </div>
                        <div id='${ids.rank}' class='flexjustifystart rankddlb' style='margin-left: 1em;'> </div>
                     </div>
                     <div class='flexjustifystart playerattrvalue'>
                        <input id='${ids.association}' value='${tournament.association || ''}' placeholder="${lang.tr('tournaments.natlassoc')}">
                     </div>
                     <div class='flexjustifystart playerattrvalue'>
                        <input id='${ids.organization}' value='${tournament.organization || ''}' placeholder="${lang.tr('tournaments.tennisclub')}">
                     </div>
                     <div class='flexjustifystart playerattrvalue'>
                        <input id='${ids.start}' value='${start}' placeholder='YYYY-MM-DD'>
                     </div>
                     <div class='flexjustifystart playerattrvalue'>
                        <input id='${ids.end}' value='${end}' placeholder='YYYY-MM-DD'>
                     </div>
                     <div class='flexrow tournamentattrddlb'>
                        <div id='${ids.inout}' class='flexjustifystart'> </div>
                        <div id='${ids.surface}' class='flexjustifystart' style='margin-left: 1em;'> </div>
                     </div>
                     <div class='flexjustifystart playerattrvalue'>
                        <input id='${ids.judge}' value='${tournament.judge || ''}'>
                     </div>
                     <div class='flexjustifystart playerattrvalue'>
                        <input id='${ids.draws}' value='${tournament.draws || ''}' placeholder='32/32/8'>
                     </div>
                  </div>
               </div>
               <div class='edit_actions'>
                  <button id="${ids.cancel}" class="btn btn-medium edit-cancel" alt="${lang.tr('actions.cancel')}">${lang.tr('ccl')}</button> 
                  <button id="${ids.save}" class="btn btn-medium edit-submit" alt="${lang.tr('sbt')}">${lang.tr('sbt')}</button> 
               </div>
            </div>
         </div>
      `;

      gen.showConfigModal(html);
      /*
      let options = gen.fx.orgCategoryOptions({calc_date: new Date()});
      dd.attachDropDown({ id: ids.category, options });
      dd.attachDropDown({ id: ids.rank, label: `${lang.tr('trnk')}:`, options: getRanks(tournament) });
      */

      let container = displayFx.idObj(ids);

      container.name.element.style.background = tournament.name ? 'white' : 'yellow';
      container.start.element.style.background = util.validDate(tournament.start) ? 'white' : 'yellow';
      container.end.element.style.background = util.validDate(tournament.end) ? 'white' : 'yellow';

      return { container };
   }

   gen.createNewPlayer = (p) => {
      let ids = {
         ioc: displayFx.uuid(),
         save: displayFx.uuid(),
         club: displayFx.uuid(),
         city: displayFx.uuid(),
         form: displayFx.uuid(),
         email: displayFx.uuid(),
         birth: displayFx.uuid(),
         phone: displayFx.uuid(),
         gender: displayFx.uuid(),
         cancel: displayFx.uuid(),
         birthdate: displayFx.uuid(),
         last_name: displayFx.uuid(),
         first_name: displayFx.uuid(),
         entry_form: displayFx.uuid(),
      }

      let html = `
         <div class='add_player' style='margin: 2em'>
            <div id='${ids.form}' class='add_player_form'>
               <div class='flexrow'>
                  <div class='flexcol playerattrs'>
                     <div class='playerattr'>${lang.tr('lnm')}:</div>
                     <div class='playerattr'>${lang.tr('fnm')}:</div>
                     <div class='playerattr'>${lang.tr('gdr')}:</div>
                     <div class='playerattr'>${lang.tr('bd')}:</div>
                     <div class='playerattr'>${lang.tr('cnt')}:</div>
                     <div class='playerattr'>${lang.tr('cty')}:</div>
                     <div class='playerattr'>${lang.tr('clb')}:</div>
                     <div class='playerattr'>${lang.tr('phn')}:</div>
                     <div class='playerattr'>${lang.tr('email')}:</div>
                  </div>
                  <div id='${ids.entry_form}' class='flexcol'>
                     <div class='flexjustifystart playerattrvalue'>
                        <input id='${ids.last_name}' value='${p.last_name || ''}'>
                     </div>
                     <div class='flexjustifystart playerattrvalue'>
                        <input id='${ids.first_name}' value='${p.first_name || ''}'>
                     </div>
                     <div id='${ids.gender}' class='flexjustifystart genderddlb'> </div>
                     <div class='flexjustifystart playerattrvalue'>
                        <input id='${ids.birth}' value='${p.birth || ''}' placeholder='YYYY-MM-DD'>
                     </div>
                     <div class='flexjustifystart playerattrvalue'>
                        <input id='${ids.ioc}' value='${p.ioc || ''}'>
                     </div>
                     <div class='flexjustifystart playerattrvalue'>
                        <input id='${ids.city}' value='${p.city || ''}'>
                     </div>
                     <div class='flexjustifystart playerattrvalue'>
                        <input id='${ids.club}' value='${p.club_name || ''}'>
                     </div>
                     <div class='flexjustifystart playerattrvalue'>
                        <input id='${ids.phone}' value='${p.phone || ''}'>
                     </div>
                     <div class='flexjustifystart playerattrvalue'>
                        <input id='${ids.email}' value='${p.email || ''}'>
                     </div>
                  </div>
               </div>
               <div class='edit_actions'>
                  <button id="${ids.cancel}" class="btn btn-medium edit-cancel" alt="${lang.tr('actions.cancel')}">${lang.tr('ccl')}</button> 
                  <button id="${ids.save}" class="btn btn-medium edit-submit" alt="${lang.tr('sbt')}">${lang.tr('sbt')}</button> 
               </div>
            </div>
         </div>
      `;
      gen.showConfigModal(html, 'visible');
      let id_obj = displayFx.idObj(ids);
      dd.attachDropDown({ id: ids.gender, options: getGenders() });
      return id_obj;
   }

   gen.editPlayer = (p, allowed={}) => {
      let ids = {
         ioc: displayFx.uuid(),
         save: displayFx.uuid(),
         form: displayFx.uuid(),
         cancel: displayFx.uuid(),
         birth: displayFx.uuid(),
         gender: displayFx.uuid(),
         last_name: displayFx.uuid(),
         first_name: displayFx.uuid(),
         entry_form: displayFx.uuid(),
      }

      let gender = allowed.gender ? 'inline' : 'none';
      let birth = allowed.birth ? 'inline' : 'none';

      let html = `
         <div class='add_player' style='margin: 2em'>
            <div id='${ids.form}' class='add_player_form'>
               <div class='flexrow'>
                  <div class='flexcol playerattrs'>
                     <div class='playerattr'>${lang.tr('lnm')}:</div>
                     <div class='playerattr'>${lang.tr('fnm')}:</div>
                     <div class='playerattr' style='display: ${birth}'>${lang.tr('bd')}:</div>
                     <div class='playerattr' style='display: ${gender}'>${lang.tr('gdr')}:</div>
                     <div class='playerattr'>${lang.tr('cnt')}:</div>
                  </div>
                  <div id='${ids.entry_form}' class='flexcol'>
                     <div class='flexjustifystart playerattrvalue'>
                        <input id='${ids.last_name}' value='${p.last_name || ''}'>
                     </div>
                     <div class='flexjustifystart playerattrvalue'>
                        <input id='${ids.first_name}' value='${p.first_name || ''}'>
                     </div>
                     <div class='flexjustifystart playerattrvalue' style='display: ${birth}'>
                        <input id='${ids.birth}' value=''>
                     </div>
                     <div id='${ids.gender}' class='flexjustifystart genderddlb' style='display: ${gender}'> </div>
                     <div class='flexjustifystart playerattrvalue'>
                        <input id='${ids.ioc}' value=''>
                     </div>
                  </div>
               </div>
               <div class='edit_actions'>
                  <button id="${ids.cancel}" class="btn btn-medium edit-cancel" alt="${lang.tr('actions.cancel')}">${lang.tr('ccl')}</button> 
                  <button id="${ids.save}" class="btn btn-medium edit-submit" alt="${lang.tr('sbt')}">${lang.tr('sbt')}</button> 
               </div>
            </div>
         </div>
      `;
      gen.showConfigModal(html, 'visible');
      let id_obj = displayFx.idObj(ids);
      if (allowed.gender) dd.attachDropDown({ id: ids.gender, options: getGenders() });
      return id_obj;
   }

   gen.playerInfo = (p, club) => {
      var medical = playerFx.medical(p);
      var registration = playerFx.registration(p);

      var name = util.normalizeName([p.first_name, p.last_name].join(' '), false);
      var clubdata = !club.name ? '' :
         `<div class='flexrow pdata_container'><div class='pdata_label'>${lang.tr('clb')}:</div><div class='pdata_value'>${club.name}</div></div>`;
      var clubcode = !club.code ? '' :
         `<div class='flexrow pdata_container'><div class='pdata_label'>${lang.tr('clb')}:</div><div class='pdata_value'>${club.code}</div></div>`;
      var school = !p.school ? '' :
         `<div class='flexrow pdata_container'><div class='pdata_label'>${lang.tr('scl')}:</div><div class='pdata_value'>${p.school}</div></div>`;
      var cropin = !p.cropin ? '' :
         `<div class='flexrow pdata_container'><div class='pdata_label'>CROPIN:</div><div class='pdata_value'>${p.cropin || ''}</div></div>`;
      var birth = !p.birth ? '' :
         `<div class='flexrow pdata_container'><div class='pdata_label'>${lang.tr('bd')}:</div><div class='pdata_value'>${displayYear(p.birth)}</div></div>`;
      var city = !p.city ? '' :
         `<div class='flexrow pdata_container'><div class='pdata_label'>${lang.tr('cty')}:</div><div class='pdata_value'>${p.city}</div></div>`;
      var country = !p.ioc ? '' :
         `<div class='flexrow pdata_container'><div class='pdata_label'>${lang.tr('cnt')}:</div><div class='pdata_value'>${p.ioc}</div></div>`;

      var rtp = p.right_to_play_until ? displayFullDate(p.right_to_play_until) : '';
      var expired_medical = medical != false || !rtp ? '' :
         `<div class='flexrow pdata_container'>
            <div class='pdata_label'>${lang.tr('signin.medical')}:</div>
            <div class='pdata_value' style='color: red'>${rtp}</div>
         </div>`;


      var expired_registration = registration != false ? '' :
         `<div class='flexrow pdata_container'>
            <div class='pdata_label'>${lang.tr('signin.registration')}:</div>
            <div class='pdata_value' style='color: red'>${displayFullDate(p.registered_until)}</div>
         </div>`;

      var detail_1 = !cropin && !clubdata && !clubcode && !school ? '' : `
         <div class='pdetail' style="width: 100%">
            ${cropin} ${clubdata} ${clubcode} ${school}
         </div>
      `;

      var html = `
         <div class='player_data'>
            <h2 style='margin-left: 1em; margin-right: 1em;'>${name}</h2>

            <div class='player_details'>
               ${detail_1}
               <div class='pdetail' style="height: 100%">
                  ${birth} ${expired_medical} ${expired_registration} ${city} ${country}
               </div>
            </div>

            <div class='flexcol' style='width: 50%'>
               <div></div>
               <div></div>
               <div></div>
            </div>
         </div>
      `;
      return html;
   }

   gen.tabbedPlayerRankings = (tabdata, container) => {
      if (!tabdata.length) {
         container.rankings.element.innerHTML = `<h2 class="flexcenter">${lang.tr('phrases.norankingdata')}</h2>`;
         return;
      }
      let html = ` <div>${jsTabs.generate(tabdata)}</div> `;
      container.rankings.element.innerHTML = html;
      jsTabs.load(container.rankings.element);
   }

   gen.tabbedPlayerMatches = (puid, singles, doubles, container) => {
      if (!singles.length && !doubles.length) {
         container.matches.element.innerHTML = `<h2 class="flexcenter">${lang.tr('phrases.nomatches')}</h2>`;
         return;
      }
      let tabdata = [];
      if (singles.length) tabdata.push({ tab: lang.tr('sgl'), content: matchBlock({ matches: singles, type: 'historical', puid }) });
      if (singles.length) tabdata.push({ tab: lang.tr('dbl'), content: matchBlock({ matches: doubles, type: 'historical', puid }) });

      if (singles.length) tabdata.push({ tab: lang.tr('h2h'), content: gen.playerHead2Head(singles, puid) });
      let tabs = jsTabs.generate(tabdata);
      let html = `
         <h2>${lang.tr('emts')}</h2>
         <div>${tabs}</div>
      `;
      container.matches.element.innerHTML = html;
      jsTabs.load(container.matches.element);
   }

   gen.playerHead2Head = (singles, puid) => {
      // TODO
      return 'Big TODO!';
   }

   gen.tournamentPenalties = (tournament, penalties, saveFx) => {
      let ids = {
         penalties: displayFx.uuid(),
         ok: displayFx.uuid(),
      }
      let penalty_list = penalties.map((pe, i) => {
         let event_info = `${pe.round || ''}`;
         if (pe.event) event_info += ` ${pe.event || ''}`;
         if (event_info) event_info = `${event_info}:&nbsp;`;
         let phtml = `
            <div class='flexrow'>
               <div class='flexcenter' style='color: blue; margin-right: 1em;'>${pe.player.full_name} </div>
               <div class='flexrow flexjustifyright'>
                  <div class='flexcenter'>${event_info}<span style='color: red;'>${pe.penalty.label}</span></div>
                  <div penalty_index='${i}' class='player_penalty action_icon_small trash'></div>
               </div>
            </div>
         `;
         return phtml;
      }).join('');
      let html = `
         <div id='${ids.penalties}' class='flexcol' style='margin-left: 1em; margin-right: 1em; margin-bottom: 1em;'>
            <div class='settings_info flexcenter'> <h2 style='width: 100%;'>${lang.tr('ptz')}</h2> </div>
            <div> <div class='flexcol'>${penalty_list}</div> </div>
            <div class="flexcenter" style='margin: 1em;'>
               <button id='${ids.ok}' class='btn btn-medium edit-submit' style='margin-left: 1em;'>${lang.tr('actions.ok')}</button>
            </div>
         </div>
         `;
      gen.escapeModal();
      gen.showConfigModal(html);
      let id_obj = displayFx.idObj(ids);
      id_obj.ok.element.addEventListener('click', () => gen.closeModal());
      util.addEventToClass('player_penalty', removePenalty, id_obj.penalties.element);
      function removePenalty(evt) {
         let element = util.getParent(evt.target, 'player_penalty');
         let penalty_index = element.getAttribute('penalty_index');
         let penalty = penalties[penalty_index];
         let player = tournament.players.reduce((p, c) => c.id == penalty.player.id ? c : p, {});
         player.penalties.splice(penalty.ppi, 1);
         penalties.splice(penalty_index, 1);
         if (typeof saveFx == 'function') saveFx();
         if (penalties.length) { gen.tournamentPenalties(tournament, penalties, saveFx); } else { gen.closeModal(); }
      }
   }

   gen.playerPenalties = (p, saveFx) => {
      let ids = {
         penalties: displayFx.uuid(),
         ok: displayFx.uuid(),
      }

      gen.escapeModal();
      let penalties = p.penalties.map((pe, i) => {
         let event_info = `${pe.round || ''}`;
         if (pe.event) event_info += ` ${pe.event || ''}`;
         if (event_info) event_info = `${event_info}:&nbsp;`;
         let phtml = `
            <div class='flexrow'>
               <div class='flexcenter'>${event_info}<span style='color: red;'>${pe.penalty.label}</span></div>
               <div penalty_index='${i}' class='player_penalty action_icon_small trash'></div>
            </div>
         `;
         return phtml;
      }).join('');
      let html = `
         <div id='${ids.penalties}' class='flexcol' style='margin-left: 1em; margin-right: 1em; margin-bottom: 1em;'>
            <div class='settings_info'>
               <h2>${lang.tr('ptz')}: ${p.first_name} ${p.last_name}</h2>
            </div>
            <div>
               <div class='flexcol'>${penalties}</div>
            </div>
            <div class="flexcenter" style='margin: 1em;'>
               <button id='${ids.ok}' class='btn btn-medium edit-submit' style='margin-left: 1em;'>${lang.tr('actions.ok')}</button>
            </div>
         </div>
         `;
      gen.showConfigModal(html);
      let id_obj = displayFx.idObj(ids);
      id_obj.ok.element.addEventListener('click', () => gen.closeModal());
      util.addEventToClass('player_penalty', removePenalty, id_obj.penalties.element);
      function removePenalty(evt) {
         let element = util.getParent(evt.target, 'player_penalty');
         let penalty_index = element.getAttribute('penalty_index');
         p.penalties.splice(penalty_index, 1);
         if (typeof saveFx == 'function') saveFx();
         if (p.penalties.length) { gen.playerPenalties(p, saveFx); } else { gen.closeModal(); }
      }
   }

   gen.displayTournamentPlayers = ({ container, tournament, players, filters=[], ratings_type, edit }) => {
      if (!players) {
         container.players.element.innerHTML = '';
         return;
      }
      d3.select('#YT' + container.container.id).style('display', 'flex');

      if (!players.length) {
         if (container.players.element) container.players.element.style.display = 'none';
         return;
      }

      if (filters.indexOf('M') >= 0) players = players.filter(f=>f.sex != 'M');
      if (filters.indexOf('W') >= 0) players = players.filter(f=>f.sex != 'W');

      let display = { clubs: false, countries: false, schools: false, years: false };
      players.forEach(p => {
         if (p.club_code || p.club_name) display.clubs = true;
         if (p.ioc) display.countries = true;
         if (p.school) display.schools = true;
         if (p.birth) display.years = true;
      });

      let wd = (p) => (p.withdrawn == true || p.withdrawn == 'Y') && !p.signed_in;
      let not_signed_in = players.filter(p => !wd(p) && !p.signed_in && playerFx.medical(p, tournament));
      let signed_in = players.filter(p => !wd(p) && p.signed_in);
      let not_withdrawn = players.filter(p => !wd(p));
      let withdrawn = players.filter(wd);
      let medical_issues = !edit ? [] : players.filter(p => !playerFx.medical(p, tournament) && !wd(p) && !p.signed_in);

      let additional_attributes = [];
      let cropin = players.reduce((p, c) => c && c.cropin ? true : p, false);
      if (cropin) additional_attributes.push({ header: 'CROPIN', value: 'cropin' });

      let j = 0;
      let html = '';
      let display_order = {}
      let rowHTML = (p, i, gender) => {
         html += tpRow(tournament, p, i + 1, j, gender, display, additional_attributes, ratings_type);
         display_order[p.puid] = j;
         j+=1;
      }
      let genSection = (notice, arr) => {
         let m = arr.filter(f=>f.sex == 'M');
         let w = arr.filter(f=>f.sex == 'W');
         let u = arr.filter(f=>['M', 'W'].indexOf(f.sex) < 0);

         html += `<div class='signin-section'>${lang.tr(notice)}</div>`;
         html += tpHeader({ display, additional_attributes, ratings_type });

         m.forEach((p, i) => rowHTML(p, i, 'M'));
         if (m.length) html += `<div class='signin-row'></div>`;
         w.forEach((p, i) => rowHTML(p, i, 'W'));
         if (w.length) html += `<div class='signin-row'></div>`;
         u.forEach((p, i) => rowHTML(p, i, ''));
      }

      if (!edit) genSection('signin.registered', not_withdrawn);
      if (edit && not_signed_in.length) genSection('signin.notsignedin', not_signed_in);
      if (edit && signed_in.length) genSection('signin.signedin', signed_in);
      if (medical_issues.length) genSection('signin.medical_issues', medical_issues);
      if (withdrawn.length) genSection('signin.withdrawn', withdrawn);

      container.players.element.innerHTML = html;
      container.players.element.style.display = 'flex';

      return display_order;
   }

   // TODO: make additional rows configurable; CROPIN should be configuration option
   function tpHeader({ display, additional_attributes, ratings_type }) {
      let additional = !additional_attributes ? '' :
         additional_attributes.map(attr => `<div class='registered_attr flexcenter'><b>${attr.header}</b></div>`);
      let years = display.years ? `<div class='registered_attr flexcenter'><b>${lang.tr('yr')}</b></div>` : '';
      let clubs = display.clubs ? `<div class='registered_attr flexcenter'><b>${lang.tr('clb')}</b></div>` : '';
      let countries = display.countries ? `<div class='registered_attr flexcenter'><b>${lang.tr('cnt')}</b></div>` : '';
      let schools = display.schools ? `<div class='registered_attr flexcenter'><b>${lang.tr('scl')}</b></div>` : '';
      let rating = ratings_type ? `<div class='registered_attr flexcenter rankbyrating'><b>${lang.tr('rtg')}</b></div>` : '';
      let html = `
         <div class='signin-row flexrow signin-header'>
            <div class='registered_count flexjustifystart'><b>#</b></div>
            <div class='registered_player flexjustifystart'><b>${lang.tr('ply')}</b></div>
            ${additional}${rating}
            <div class='registered_attr flexcenter'><b>${lang.tr('prnk')}</b></div>
            ${years} ${clubs} ${countries} ${schools}
            <div class='registered_attr flexcenter'><b>${lang.tr('gdr')}</b></div>
         </div>
      `;

      return html;
   }

   // TODO: make additional rows configurable; CROPIN should be configuration option
   function tpRow(tournament, p, i, j, gender, display, additional_attributes, ratings_type) {
      let ioc = p.ioc && p.ioc.length == 3 ? p.ioc.toUpperCase() : '';
      if (ioc == '' && p.foreign == 'Y') ioc = 'INO';

      let birth = p.birth ? new Date(p.birth).getFullYear() : '';
      let birthyear = !isNaN(birth) ? birth : '----';

      let font_color = !gender ? 'black' : gender == 'W' ? '#840076' : '#00368c'; 
      let medical_icon = !playerFx.medical(p, tournament) ? `&nbsp;<div class='medical_icon'></div>` : '';
      let penalty_icon = p.penalties && p.penalties.length ? `&nbsp;<div class='penalty_icon'></div>` : '';
      let font_weight = penalty_icon ? 'bold' : 'normal';
      let style = `style='color: ${font_color}; font-weight: ${font_weight}'`;

      let ranking = util.numeric(p.category_ranking) || '';
      if (p.int && p.int > 0) ranking = `{${ranking}}`;

      let additional = !additional_attributes ? '' :
         additional_attributes.map(attr => `<div class='registered_attr flexcenter'>${p[attr.value] || ''}</div>`);

      let club = p.club_code || p.club_name || '';
      let club_gradient = `registered_club_${!gender ? 'u' : gender == 'W' ? 'w' : 'm'}`;
      let club_class = p.club_code || !club ? 'registered_attr flexcenter' : `registered_club ${club_gradient}`;
      let gender_abbr = p.sex ? lang.tr(p.sex == 'M' ? 'genders.male_abbr' : 'genders.female_abbr') : 'X';

      let school = p.school || '';
      let school_gradient = `registered_club_${!gender ? 'u' : gender == 'W' ? 'w' : 'm'}`;
      let school_class = `registered_club ${club_gradient}`;

      let years = display.years ? `<div class='registered_attr flexcenter'>${birthyear}</div>` : '';
      let clubs = display.clubs ? `<div class='${club_class}'>${club}</div>` : '';
      let countries = display.countries ? `<div class='registered_attr flexcenter'>${ioc}</div>` : '';
      let schools = display.schools ? `<div class='${school_class}'>${school}</div>` : '';

      let player_rating = !ratings_type || !p.ratings ? '' :
         (p.ratings[ratings_type] && p.ratings[ratings_type].singles && p.ratings[ratings_type].singles.value) || '';
      if (player_rating == 0) player_rating = '';
      let html = `
         <div puid='${p.puid}' index='${i}' class='player_click signin-row flexrow detail' ${style}>
            <div class='registered_count flexjustifystart'>${i || ''}</div>
            <div class='registered_player flexjustifystart'>${p.full_name}${penalty_icon}${medical_icon}</div>
            ${additional}
            <div class='registered_attr rankrow' style='display: ${ratings_type ? "flex" : "none"}'>
               <span class='flexcenter ratingvalue'>${player_rating}</span>
               <span class='flexjustifyend ratingentry' style='display: none;'>
                  <input ratingentry='${p.id}' order='${j}' class='manualrating' value='${player_rating}'>
               </span>
            </div>
            <div class='registered_attr rankrow'>
               <span class='flexcenter rankvalue'>${ranking}</span>
               <span class='flexjustifyend rankentry' style='display: none;'>
                  <input rankentry='${p.id}' order='${j}' class='manualrank' value='${ranking}'>
               </span>
               <span class='flexjustifyend ranksub' style='display: none;'>
                  <input rankentry='${p.id}' puid='${p.puid}' order='${j}' class='subrank' value='${p.subrank || ''}' style='opacity: 0;'>
               </span>
            </div>
            ${years} ${clubs} ${countries} ${schools}
            <div class='registered_attr flexcenter'>${p.sex || 'X'}</div>
         </div>`;
      return html;
   }

   gen.displayPlayerPoints = (container, points) => {
      if (!points) {
         container.points.element.innerHTML = lang.tr('phrases.pointcalc');
         return;
      }
      let sk = Object.keys(points.singles);
      let dk = Object.keys(points.doubles);
      let players = [].concat(...sk, ...dk).filter((item, i, s) => s.lastIndexOf(item) == i).sort();

      let rows = players.map(p => {
         let singles = points.singles[p] ? parseInt(points.singles[p].points || 0) : 0;
         let doubles = points.doubles[p] ? parseInt(points.doubles[p].points || 0) : 0;
         let total = singles + doubles;
         let id = points.singles[p] ? points.singles[p].id : points.doubles[p].id;
         let name = `${p}`;
         let puid = points.singles[p] ? points.singles[p].puid : points.doubles[p].puid;
         return { name, total, singles, doubles, puid };
      }).filter(f=>f.total).sort((a, b) => b.total - a.total);

      let html = '';

      rows.forEach(row => html += pointRow(row));
      container.points.element.innerHTML = html;
      container.points.element.style.display = 'flex';
   }

   function pointRow(p) {
      if (!p.total) return '';
      let html = `
         <div puid='${p.puid}' class='point_row flexrow detail'>
            <div class='player_name flexjustifystart'>${p.name}</div>
            <div class='flexcenter col total'>${p.total}</div>
            <div class='flexcenter col'>${p.singles}</div>
            <div class='flexcenter col'>${p.doubles}</div>
         </div>`;
      return html;
   }

   gen.identifyPlayer = (p) => {
      let ids = {
         save: displayFx.uuid(),
         cancel: displayFx.uuid(),
      }
      let html = `
         <h2>${lang.tr('edt')}</h2>
         <div class='pdata flexcol flexcenter'>
            <div class='pdata_row'>
               <div class='pdata_label'>${lang.tr('fnm')}:</div><div class="data_value">${util.normalizeName(p.first_name, false)}</div>
            </div>
            <div class='pdata_row'>
               <div class='pdata_label'>${lang.tr('lnm')}:</div><div class="data_value">${util.normalizeName(p.last_name, false)}</div>
            </div>
            <div class='pdata_row'>
               <div class='pdata_label'>${lang.tr('clb')}:</div><div class="data_value">${p.club || ''}</div>
            </div>
            <div class='pdata_row'>
               <div class='pdata_label'>${lang.tr('cnt')}:</div><div class="data_value">${p.ioc || 'CRO'}</div>
            </div>
         </div>
         <div class='edit_actions'>
            <button id="${ids.save}" class="btn btn-large edit-submit" alt="${lang.tr('sbt')}">${lang.tr('sbt')}</button> 
            <button id="${ids.cancel}" class="btn btn-large edit-cancel" alt="${lang.tr('actions.cancel')}">${lang.tr('ccl')}</button> 
         </div>`;

      gen.showEdit(html, false);
      return displayFx.idObj(ids);
   }

   gen.legacyTournamentTab = (elem, tournament) => {
      let ids = {
         start_date: displayFx.uuid(),
         end_date: displayFx.uuid(),
         sgl_rank: displayFx.uuid(),
         w_sgl_rank: displayFx.uuid(),
         dbl_rank: displayFx.uuid(),
         w_dbl_rank: displayFx.uuid(),
         category: displayFx.uuid(),
         w_category: displayFx.uuid(),
      }
      let html = `
         <div class='flexcenter' style='width: 100%'>
            <div class='point_info'> 
               <div class='attribute_box'>
                  <div class='tournament_attr' style='font-weight: bold'>
                     <div class='calabel'>${lang.tr('start')}:</div>
                     <input tabindex='-1' class='calinput' id='${ids.start_date}'>
                  </div>
                  <div class='tournament_attr' style='font-weight: bold'>
                     <div class='calabel'>${lang.tr('end')}:</div>
                     <input tabindex='-1' class='calinput' id='${ids.end_date}'>
                  </div>
               </div>
               <div class='flexcol'>
                  <div class='point_info_row' style="width: 100%"><div id='${ids.sgl_rank}'></div><div id='${ids.w_sgl_rank}'></div></div>
                  <div class='point_info_row' style="width: 100%"><div id='${ids.dbl_rank}'></div><div id='${ids.w_dbl_rank}'></div></div>
                  <div class='point_info_row' style="width: 100%"><div id='${ids.category}'></div><div id='${ids.w_category}'></div></div>
               </div>
            </div>
         </div>
      `;

      if (elem) {
         elem.innerHTML = html;

         dd.attachDropDown({ id: ids.sgl_rank, label: `${lang.tr('ddlb.singles')}&nbsp;`, options: getRanks(tournament) });
         dd.attachDropDown({ id: ids.dbl_rank, label: `${lang.tr('ddlb.doubles')}&nbsp;`, options: getRanks(tournament) });
         dd.attachDropDown({ id: ids.category, label: `${lang.tr('ddlb.category')}&nbsp;`, options: getCategories(tournament) });

         dd.attachDropDown({ id: ids.w_sgl_rank, options: getRanks(tournament) });
         dd.attachDropDown({ id: ids.w_dbl_rank, options: getRanks(tournament) });
         dd.attachDropDown({ id: ids.w_category, options: getCategories(tournament) });
      }

      let container = elem ? displayFx.idObj(ids) : undefined;

      return { ids, html, container };
   }

   gen.delegated = (container, bool) => {
      if (bool) {
         container.delegate.element.style.display = 'inline';
         container.edit.element.style.display = 'none';
      }
      let icon = `mobile${bool ? '_active' : ''}`;
      container.delegate.element.innerHTML = `<img src='./icons/${icon}.png' style='height: 1.5em;'>`;
   }
   
   gen.tournamentContainer = ({ tournament, tabCallback }) => {
      let ids = {
         name: displayFx.uuid(),
         notes: displayFx.uuid(),
         edit: displayFx.uuid(),
         finish: displayFx.uuid(),
         draws: displayFx.uuid(),
         points: displayFx.uuid(),
         matches: displayFx.uuid(),
         dual: displayFx.uuid(),
         event_tab: displayFx.uuid(),
         events: displayFx.uuid(),
         select_draw: displayFx.uuid(),
         compass: displayFx.uuid(),
         compass_direction: displayFx.uuid(),
         events_actions: displayFx.uuid(),
         event_details: displayFx.uuid(),
         event_display_name: displayFx.uuid(),
         event_edit_name: displayFx.uuid(),
         detail_fields: displayFx.uuid(),
         draw_config: displayFx.uuid(),
         detail_players: displayFx.uuid(),
         courts: displayFx.uuid(),
         schedule: displayFx.uuid(),
         scheduling: displayFx.uuid(),
         unscheduled: displayFx.uuid(),
         players: displayFx.uuid(),
         schedule_day: displayFx.uuid(),
         schedule_tab: displayFx.uuid(),
         event_filter: displayFx.uuid(),
         round_filter: displayFx.uuid(),
         location_filter: displayFx.uuid(),
         autoschedule: displayFx.uuid(),
         schedulelimit: displayFx.uuid(),
         clearschedule: displayFx.uuid(),
         container: displayFx.uuid(),
         category_filter: displayFx.uuid(),
         tournament: displayFx.uuid(),
         publish_draw: displayFx.uuid(),
         publish_state: displayFx.uuid(),
         player_reps: displayFx.uuid(),
         player_reps_state: displayFx.uuid(),
         recycle: displayFx.uuid(),
         start_date: displayFx.uuid(),
         end_date: displayFx.uuid(),
         organizers: displayFx.uuid(),
         organization: displayFx.uuid(),
         judge: displayFx.uuid(),
         display_id: displayFx.uuid(),
         locations: displayFx.uuid(),
         locations_actions: displayFx.uuid(),
         location: displayFx.uuid(),
         location_details: displayFx.uuid(),
         location_attributes: displayFx.uuid(),
         location_courts: displayFx.uuid(),
         points_valid: displayFx.uuid(),
         push2cloud: displayFx.uuid(),
         push2cloud_state: displayFx.uuid(),
         pub_link: displayFx.uuid(),
         delegate: displayFx.uuid(),
         localdownload: displayFx.uuid(),
         localdownload_state: displayFx.uuid(),
         export_points: displayFx.uuid(),
         export_matches: displayFx.uuid(),
         authorize: displayFx.uuid(),
         cloudfetch: displayFx.uuid(),
         penalty_report: displayFx.uuid(),
         edit_notes: displayFx.uuid(),
         notes_container: displayFx.uuid(),
         notes_display: displayFx.uuid(),
         notes_entry: displayFx.uuid(),
         pubTrnyInfo: displayFx.uuid(),
         pubStateTrnyInfo: displayFx.uuid(),
         tournament_attrs: displayFx.uuid(),
         teams: displayFx.uuid(),
         teams_actions: displayFx.uuid(),
         team_details: displayFx.uuid(),
         team_display_name: displayFx.uuid(),
         team_edit_name: displayFx.uuid(),
         team_attributes: displayFx.uuid(),
      }

      let classes = {
         filter_m: displayFx.uuid(), // men
         filter_w: displayFx.uuid(), // women
         filter_s: displayFx.uuid(), // singles
         filter_d: displayFx.uuid(), // doubles
         auto_draw: displayFx.uuid(),
         gem_seeding: displayFx.uuid(),
         ratings_filter: displayFx.uuid(),
         print_draw: displayFx.uuid(),
         print_sign_in: displayFx.uuid(),
         ranking_order: displayFx.uuid(),
         print_draw_order: displayFx.uuid(),
         refresh_registrations: displayFx.uuid(),
         print_schedule: displayFx.uuid(),
         schedule_matches: displayFx.uuid(),
         publish_schedule: displayFx.uuid(),
         schedule_details: displayFx.uuid(),
      }

      let tournament_tab = `
         <div id='${ids.tournament}' class='flexcol flexcenter' style='min-height: 10em;'>
            <div class='tournament_options'>
               <div class='options_left'>
                  <div id='${ids.penalty_report}' class='${gen.info}' label='${lang.tr("ptz")}' style='display: none'> <div class='penalty action_icon'></div> </div>
                  <div id='${ids.edit_notes}' class='${gen.info}' label='${lang.tr("notes")}' style='display: none'> <div class='tnotes action_icon'></div> </div>
               </div>
               <div class='options_center'>
               </div>
               <div class='options_right'>
                  <div id='${ids.push2cloud}' class='${gen.info}' label='${lang.tr("phrases.send")}' style='display: none;'>
                     <div id='${ids.push2cloud_state}' class='push2cloud action_icon'></div>
                  </div>
                  <div id='${ids.localdownload}' class='${gen.info}' label='${lang.tr("phrases.export")}' style='display: none;'>
                     <div id='${ids.localdownload_state}' class='download action_icon'></div>
                  </div>
                  <div id='${ids.pubTrnyInfo}' class='${gen.info}' label='${lang.tr("draws.publish")}' style='display: none'>
                     <div id='${ids.pubStateTrnyInfo}' style='margin-left: 1em;' class='unpublished action_icon'></div>
                  </div>
               </div>
            </div>

            <div id='${ids.tournament_attrs}' class='tournament_attrs'>
                <div class='attribute_box' style='border: 1px solid gray; padding: .5em;'>
                   <div class='tournament_attr'>
                       <label class='calabel'>${lang.tr('start')}:</label>
                       <input class='calinput' id="${ids.start_date}" disabled>
                   </div>
                   <div class='tournament_attr'>
                       <label class='calabel'>${lang.tr('end')}:</label>
                       <input class='calinput' id="${ids.end_date}" disabled>
                   </div>
                </div>

                <div class='attribute_box' style='border: 1px solid gray; padding: .5em;'>
                   <div class='tournament_attr'>
                       <label class='attr_label'>${lang.tr('signin.organization')}:</label>
                       <input class='attr_input' id="${ids.organization}" disabled>
                   </div>
                   <div class='tournament_attr'>
                       <label class='attr_label'>${lang.tr('draws.organizers')}:</label>
                       <input class='attr_input' id="${ids.organizers}" disabled>
                   </div>
                </div>

                <div class='attribute_box' style='border: 1px solid gray; padding: .5em;'>
                   <div class='tournament_attr'>
                       <label class='attr_label'>${lang.tr('signin.place')}:</label>
                       <input class='attr_input' id="${ids.location}" disabled>
                   </div>
         <!--
                   <div class='tournament_attr'>
                       <label class='attr_label'>${lang.tr('signin.id')}:</label>
                       <input class='attr_input' id="${ids.display_id}" disabled>
                   </div>
         -->
                   <div class='tournament_attr'>
                       <label class='attr_label'>${lang.tr('signin.judge')}:</label>
                       <input class='attr_input' id="${ids.judge}" disabled>
                   </div>
                </div>
            </div>

            <div id='${ids.notes_entry}' class='tournament_notes' style='display: none'>
               <div id='${ids.notes}' class='tournament_notes_entry'></div>
            </div>
            <div id='${ids.notes_container}' class='tournament_notes ql-container ql-snow' style='display: none'>
               <div id='${ids.notes_display}' class='tournament_notes ql-editor'></div>
            </div>

         </div>
         <div class='flexjustifyend' style='margin-top: 4px; margin-right: 2px;'>
            <div class='doclink' url='tmx_tournament_information'><div class='tiny_docs_icon' style='display: none'></div></div>
         </div>
      `;

      let points_tab = `
         <div>
            <div class='filter_row'>
               <div class='category_filter'>
                  <div class='calendar_date' style='font-weight: bold'>
                     <div class='calabel'>${lang.tr('phrases.pointsvalidfrom')}:</div>
                     <input tabindex='-1' class='calinput' id='${ids.points_valid}' disabled>
                  </div>
               </div>
               <div class='filters'>
                  <div class='${classes.filter_m}'><div class='filter_m action_icon filter_m_selected'></div></div>
                  <div class='${classes.filter_w}'><div class='filter_w action_icon filter_w_selected'></div></div>
                  <div class=''><div class='action_icon'></div></div>
                  <div id='${ids.export_points}'><div class='action_icon'></div></div>
                  <div class=''><div class='action_icon'></div></div>
               </div>
            </div>

            <div class='player_points'>
               <div class='point_row flexrow header'>
                  <div class='player_name flexjustifystart'><b>${lang.tr('nm')}</b></div>
                  <div class='flexcenter col'><b>${lang.tr('tot')}</b></div>
                  <div class='flexcenter col'><b>${lang.tr('sgl')}</b></div>
                  <div class='flexcenter col'><b>${lang.tr('dbl')}</b></div>
               </div>
               <div id='${ids.points}' class='player_points'></div>
            </div>

         </div>
      `;

      let add = ` <button type="button" class='btn add'>${lang.tr('actions.add_event')}</button> `;
      let del = ` <button type="button" class='btn del' style='display: none'>${lang.tr('actions.delete_event')}</button> `;
      let save = ` <button type="button" class='btn save' style='display: none'>${lang.tr('actions.save_event')}</button> `;
      let done = ` <button type="button" class='btn done' style='display: none'>${lang.tr('actions.done')}</button> `;
      let cancel = ` <button type="button" class='btn cancel' style='display: none'>${lang.tr('actions.cancel')}</button> `;
      let events_tab = `
         <div class='events'>
            <div class='event_list'>
               <div id='${ids.events_actions}' class='events_actions flexrow' style="display: none;"> ${add} </div>
               <div id='${ids.events}' class='event_rows'> </div>
            </div>
            <div id='${ids.event_details}' class='event_details' style='display: none'>
               <div class='detail_header'>
                  <div id='${ids.event_display_name}' class='event_name flexcenter'>${lang.tr('events.newevent')}</div>
                  <input id='${ids.event_edit_name}' style='display: none; width: 50%; height: 1.5em; font-size: larger;'> 
                  <div class='flexrow'>
                     <div class='${classes.auto_draw} info' style='display: none;' label='${lang.tr("adr")}'><div class='automation_icon automated_draw_pause'></div></div>
                     <div class='${classes.gem_seeding} info' style='display: inline;' label='${lang.tr("draws.gemseeding")}'><div class='gem_icon gem_inactive'></div></div>
                     <div class='${classes.ratings_filter} info' style='display: inline;' label='${lang.tr("draws.playerfilter")}'><div class='filter_icon filter_inactive'></div></div>
                     <!--
                     <div class='${classes.print_draw_order} info' label='${lang.tr("mdo")}' style='display: none'><div class='print action_icon'></div></div>
                     -->
                  </div>
                  <div>${del}${done}${save}${cancel}</div>
               </div>
               <div class='detail_body'>
                  <div class='detail_config'>
                     <div id='${ids.detail_fields}' class='detail_fields'></div>
                     <div id='${ids.draw_config}' class='detail_column'></div>
                  </div>
                  <div class='detail_selections'>
                     <div id='${ids.detail_players}' class='detail_players'> </div>
                  </div>
               </div>
            </div>
         </div>
         <div class='flexjustifyend' style='margin-top: 4px; margin-right: 2px;'>
            <div class='doclink' url='tmx_events_management'><div class='tiny_docs_icon' style='display: none'></div></div>
         </div>
      `;

      let add_team = ` <button type="button" class='btn add'>${lang.tr('actions.add_team')}</button> `;
      let del_team = ` <button type="button" class='btn del' style='display: none'>${lang.tr('actions.delete_team')}</button> `;
      let save_team = ` <button type="button" class='btn save' style='display: none'>${lang.tr('actions.save_team')}</button> `;
      let teams_tab = `
         <div class='teams_tab'>
            <div class='team_list'>
               <div id='${ids.teams_actions}' class='teams_actions flexrow' style="display: none;"> ${add_team} </div>
               <div id='${ids.teams}' class='team_rows'></div>
            </div>
            <div id='${ids.team_details}' class='team_details' style='display: none'>
               <div class='detail_header'>
                  <div id='${ids.team_display_name}' class='team_display_name flexcenter'>${lang.tr('teams.newteam')}</div>
                  <input id='${ids.team_edit_name}' style='display: none; width: 50%; height: 1.5em; font-size: larger;'> 
                  <div class='flexrow'></div>
                  <div>${del_team}${done}${save_team}${cancel}</div>
               </div>
               <div id='${ids.team_attributes}' class='detail_body'>
               </div>
            </div>
         </div>
      `;

      let add_location = ` <button type="button" class='btn add'>${lang.tr('actions.add_location')}</button> `;
      let delete_location = ` <button type="button" class='btn del' style='display: none'>${lang.tr('actions.delete_location')}</button> `;
      let save_location = ` <button type="button" class='btn save' style='display: none'>${lang.tr('actions.save_location')}</button> `;

      let courts_tab = `
         <div class='events'>
            <div class='event_list'>
               <div id='${ids.locations_actions}' class='events_actions flexrow' style="display: none;"> ${add_location} </div>
               <div id='${ids.locations}' class='event_rows' style='display: none'> </div>
            </div>
            <div id='${ids.location_details}' class='event_details' style='display: none'>

               <div class='detail_header'>
                  <div class='event_name flexcenter'>${lang.tr('locations.newlocation')}</div>
                  <div class='flexrow location_detail_actions'>
                  </div>
                  <div>${delete_location}${done}${save_location}${cancel}</div>
               </div>
               <div class='detail_body'>
                  <div id='${ids.location_attributes}' class='location_attributes'> </div>
                  <div id='${ids.location_courts}' class='location_courts'>
                  </div>
               </div>
            </div>
         </div>
         <div class='flexjustifyend' style='margin-top: 4px; margin-right: 2px;'>
            <div class='doclink' url='tmx_tournament_courts'><div class='tiny_docs_icon' style='display: none'></div></div>
         </div>
      `;


      let schedule_tab = `
         <div id='${ids.schedule_tab}' class='schedule_tab'>
            <div class='schedule_options'>
               <div class='options_left'>
                  <div id='${ids.schedule_day}'></div>
               </div>
               <div class='options_right'>
                  <div class='${classes.schedule_matches} ${gen.infoleft}' label='${lang.tr("phrases.schedulematches")}' style='display: none;'>
                     <div class='matches_header_inactive action_icon'></div>
                  </div>
                  <div class='${classes.schedule_details} ${gen.info}' label='${lang.tr("schedule.timing")}' style='display: none; margin-left: 1em;'>
                     <div class='time_header_inactive action_icon'></div>
                  </div>
                  <div class='${classes.print_schedule} ${gen.info}' label='${lang.tr("print.schedule")}'style='display: none;'>
                     <div class='print action_icon'></div>
                  </div>
                  <div class='${classes.publish_schedule} ${gen.info}' label='${lang.tr("draws.publish")}' style='display: none;'>
                     <div style='margin-left: 1em;' class='schedule_publish_state unpublished action_icon'></div>
                  </div>
               </div>
            </div>
            <div id='${ids.scheduling}' class='dropremove flexcenter flexcol schedule_unscheduled' style='display: none' ondragover="event.preventDefault();">
               <div class='schedule_options' style='width: 100%'>
                  <div class='options_left'>
                     <div id='${ids.event_filter}'></div>
                     <div id='${ids.round_filter}'></div>
                  </div>
                  <div class='options_center'>
                     <div id='${ids.autoschedule}' class='autofill'>${lang.tr('schedule.autoschedule')}</div>
                     <div id='${ids.schedulelimit}' class='autofill' style='margin-left: 1em; display: none'>${lang.tr('schedule.limit')}</div>
                  </div>
                  <div class='options_right'>
                     <div id='${ids.clearschedule}' class='autofill'>${lang.tr('schedule.clearschedule')}</div>
                  </div>
               </div>
               <div id='${ids.unscheduled}' class='unscheduled_matches'></div>
            </div>
            <div class='schedule_options' style='display: none'>
               <div class='options_left'>
                  <div id='${ids.location_filter}'></div>
               </div>
            </div>
            <div id='${ids.schedule}' class='schedule_sheet'> </div>
         </div>
      `;

      let matches_tab = `
         <div>
            <div class='filters'>
               <div class='${classes.filter_m}'><div class='filter_m action_icon filter_m_selected'></div></div>
               <div class='${classes.filter_w}'><div class='filter_w action_icon filter_w_selected'></div></div>
               <div class=''><div class='action_icon'></div></div>
               <div id='${ids.export_matches}'><div class='action_icon'></div></div>
               <div class=''><div class='action_icon'></div></div>
            </div>
            <div id='${ids.matches}' class='tournament_match flexcol flexcenter'> </div>
         </div>
         <div class='flexjustifyend' style='margin-top: 4px; margin-right: 2px;'>
            <div class='doclink' url='tmx_tournament_matches'><div class='tiny_docs_icon' style='display: none'></div></div>
         </div>
      `;

      let draws_tab = `
         <div class='draws'>
            <div class='draw_options'>
               <div class='options_left'>
                  <div class='select_draw' id='${ids.select_draw}'></div>
                  <div class='select_draw' id='${ids.compass_direction}'></div>
               </div>
               <div class='options_right'>
                  <div id='${ids.compass}' class='${gen.infoleft}' label='${lang.tr("draws.compass")}'style='display: none'>
                     <div class='compass action_icon' style='margin-right: 1em;'></div>
                  </div>
                  <div id='${ids.recycle}' class='${gen.infoleft}' label='${lang.tr("draws.clear")}'style='display: none'><div class='cleardraw action_icon'></div></div>
                  <div id='${ids.player_reps}' class='${gen.infoleft}' label='${lang.tr("draws.playerreps")}' style='display: none'>
                     <div id='${ids.player_reps_state}' style='margin-left: 1em;' class='reps_incomplete action_icon'></div>
                  </div>
                  <div class='${classes.print_draw}' style='display: none'><div class='print action_icon'></div></div>
                  <div id='${ids.publish_draw}' class='${gen.info}' label='${lang.tr("draws.publish")}' style='display: none'>
                     <div id='${ids.publish_state}' style='margin-left: 1em;' class='unpublished action_icon'></div>
                  </div>
               </div>
            </div>
            <div id='${ids.draws}' class='tournament_match flexcol flexcenter drawdraw'> </div>
         </div>
         <div class='flexjustifyend' style='margin-top: 4px; margin-right: 2px;'>
            <div class='doclink' url='tmx_tournament_draws'><div class='tiny_docs_icon' style='display: none'></div></div>
         </div>
      `;

      let modify_info = tournament.players && tournament.players.length ? `${gen.infoleft}` : '';
      let players_tab = `
         <div>
            <div class='filter_row'>
               <div class='category_filter'>
                  <div class='flexcenter entry_field' id='${ids.category_filter}'></div>
                  <div class='${classes.print_sign_in} ${gen.infoleft}' label='${lang.tr("print.signin")}'style='display: none'>
                     <div class='print action_icon'></div>
                  </div>
               </div>
               <div class='filters'>
                  <div class='${classes.filter_m}'><div class='filter_m action_icon filter_m_selected'></div></div>
                  <div class='${classes.filter_w}'><div class='filter_w action_icon filter_w_selected'></div></div>
                  <div class=''><div class='action_icon'></div></div>
                  <div class='${classes.ranking_order} ${modify_info}' label='${lang.tr("signin.modifyrankings")}'>
                     <div class='action_icon ranking_order ranking_order_inactive'></div>
                  </div>
                  <div class='${classes.refresh_registrations}' label='${lang.tr("refresh.general")}'>
                     <div class='action_icon refresh_registrations'></div>
                  </div>
               </div>
            </div>

            <div id='${ids.players}' class='registered_players flexcol flexcenter'> </div>

         </div>
         <div class='flexjustifyend' style='margin-top: 4px; margin-right: 2px;'>
            <div class='doclink' url='tmx_tournament_players'><div class='tiny_docs_icon' style='display: none'></div></div>
         </div>
      `;

      let event_tab = ` <div id='${ids.event_tab}' class='flexcol flexcenter'> </div> `;
      let dual_tab = ` <div id='${ids.dual}' class='flexcol flexcenter'> </div> `;

      let tabdata = [
         { ref: 'tournament', tab: lang.tr('trn'), content: tournament_tab, id: `TT${ids.container}` },
         { ref: 'courts',     tab: lang.tr('crt'), content: courts_tab, id: `CT${ids.container}`, display: 'none' },
         { ref: 'players',    tab: lang.tr('pyr'), content: players_tab, id: `YT${ids.container}`, display: 'none' },
         { ref: 'teams',      tab: lang.tr('tmz'), content: teams_tab, id: `TM${ids.container}`, display: 'none' },
         { ref: 'event',      tab: lang.tr('ent'), content: event_tab, id: `EN${ids.container}`, display: 'none' },
         { ref: 'events',     tab: lang.tr('evt'), content: events_tab, id: `ET${ids.container}`, display: 'none' },
         { ref: 'draws',      tab: lang.tr('drz'), content: draws_tab, id: `DT${ids.container}`, display: 'none' },
         { ref: 'dual',       tab: lang.tr('dlm'), content: dual_tab, id: `DL${ids.container}`, display: 'none' },
         { ref: 'schedule',   tab: lang.tr('sch'), content: schedule_tab, id: `ST${ids.container}`, display: 'none' },
         { ref: 'matches',    tab: lang.tr('mts'), content: matches_tab, id: `MT${ids.container}`, display: 'none' },
         { ref: 'points',     tab: lang.tr('pts'), content: points_tab, id: `PT${ids.container}`, display: 'none' },

      ];
      let tabs = jsTabs.generate(tabdata);
      let tab_refs = Object.assign({}, ...tabdata.map((t, i)=>({[t.ref]: i})));

      let authorize_button = `
         <div id='${ids.authorize}' class='link ${gen.infoleft}' label='${lang.tr("tournaments.key")}' style='display: none'>
            <img src='./icons/keys.png' class='club_link'>
         </div>
      `;
      let cloudfetch_button = `
         <div id='${ids.cloudfetch}' class='contextAction link ${gen.infoleft}' label='${lang.tr("tournaments.fetch")}' style='display: none;' contextaction='requestTournamentEvents'>
            <img src='./icons/cloudfetch.png' class='club_link'>
         </div>
      `;
      let pubLink_button = `
         <div id='${ids.pub_link}' class='${gen.info}' label='${lang.tr("phrases.weblink")}' style='margin-left: .2em; display: none;'>
            <img src='./icons/link.png' class='club_link'>
          </div>
      `;
      let delegation = gen.fx.env().delegation ? '' : 'visibility: hidden';
      let delegate_button = `
         <div id='${ids.delegate}' style='margin-left: .2em; display: none; ${delegation}'>
            <img src='./icons/mobile.png' style='height: 1.5em;'>
          </div>
      `;
      let edit_button = `
         <div id='${ids.edit}' class='link ${gen.infoleft}' label='${lang.tr("tournaments.edit")}' style='display: none'>
            <img src='./icons/edit.png' class='club_link'>
         </div>
         `;
      let finish_button = `
         <div id='${ids.finish}' class='link ${gen.infoleft}' label='${lang.tr("tournaments.done")}' style='display: none'>
            <img src='./icons/finished.png' class='club_link'>
         </div>`;
      let html = `
         <div id='${ids.container}' class='tournament_container'>
            <div class='tournament_info'> 
               <div id='${ids.name}'><h2>${tournament.name}</h2></div>
               <div class='flexrow'>${authorize_button}${cloudfetch_button}${pubLink_button}${delegate_button}</div>
               ${edit_button}${finish_button}
            </div>
            ${tabs}
         </div>
      `;

      let display_context = selectDisplay(html, ['identify', 'tournament']);

      let id_obj = displayFx.idObj(ids);
      let displayTab = jsTabs.load(id_obj.container.element, tabCallback);

      let class_obj = classObj(classes);

      return { container: id_obj, classes: class_obj, displayTab, display_context, tab_refs };
   }

   gen.showLocations = ({ element, locations }) => {
      let html = `
      `;
   }

   gen.scheduleTeams = ({ element, pending_upcoming }) => {
      let scheduled = pending_upcoming.filter(m=>m.schedule && m.schedule.court);
      let unscheduled = pending_upcoming.filter(m=>!m.schedule || !m.schedule.court);
      let html = unscheduled.map((match, i) => unscheduledTeam(match, i+1 == pending_upcoming.length)).join('');
      element.innerHTML = html;
   }

   function unscheduledTeam(match, last) {
      let team_id = displayFx.uuid();
      let style = last ? '' : 'border-bottom: 1px solid #E8E9EF;';
      let droptarget = `ondragover="event.preventDefault();"`;
      let draggable = `draggable="true"`;

      let content = `
         <div class='event_name'>${match.event.name}</div>
         <div class='event_round'>${match.round_name}</div>
         <div class='left_team'>${formatTeams({match, which: 'left'})}</div>
         <div>&nbsp;-&nbsp;</div>
         <div class='right_team'>${formatTeams({match, which: 'right'})}</div>
      `;

      let html = `
         <div id='${team_id}' muid='${match.muid}' class='flexrow unscheduled_match dragUnscheduled' ${draggable} ${droptarget} style='${style}'>
            ${content}
         </div>
      `;
      return html;
   }

   gen.roundRobinResults = (results) => {
      let notInfinity = (value) => value == 'Infinity' ? '' : value;
      let html = `
         <table>
            <tr><th></th><th>Won</th><th>Lost</th><th>Ratio</th></tr>
            <tr>
               <td>${lang.tr('emts')}</td>
               <td style='color: lightyellow' align='center'>${results.matches_won}</td>
               <td style='color: lightyellow' align='center'>${results.matches_lost}</td>
               <td style='color: lightyellow' align='center'>${notInfinity(results.matches_ratio)}</td>
            </tr>
            <tr>
               <td>${lang.tr('ests')}</td>
               <td style='color: lightyellow' align='center'>${results.sets_won}</td>
               <td style='color: lightyellow' align='center'>${results.sets_lost}</td>
               <td style='color: lightyellow' align='center'>${notInfinity(results.sets_ratio)}</td>
            </tr>
            <tr>
               <td>${lang.tr('egms')}</td>
               <td style='color: lightyellow' align='center'>${results.games_won}</td>
               <td style='color: lightyellow' align='center'>${results.games_lost}</td>
               <td style='color: lightyellow' align='center'>${notInfinity(results.games_ratio)}</td>
            </tr>
            <tr>
               <td>${lang.tr('epts')}</td>
               <td style='color: lightyellow' align='center'>${results.points_won}</td>
               <td style='color: lightyellow' align='center'>${results.points_lost}</td>
               <td style='color: lightyellow' align='center'>${notInfinity(results.points_ratio)}</td>
            </tr>
         </table>
      `;
      return html;
   }

   gen.floatingModal = ({ label, mouse, coords, content }) => {
      let su_ids = { floating_modal: displayFx.uuid(), }

      let floating = d3.select('body')
         .append('div')
         .attr('class', 'modal')
         .attr('id', su_ids.floating_modal);

      let srcn = mouse ? d3.mouse(document.body) : coords ? [coords.x, coords.y] : [window.innerWidth / 2, 200];
      let { ids, html } = floatingModalDisplay(label, content);
      let entry = floatingEntry().selector('#' + su_ids.floating_modal)
      entry(srcn[0], srcn[1] - window.scrollY, html);

      Object.assign(ids, su_ids);
      let id_obj = displayFx.idObj(ids);

      id_obj.floating_modal.element.addEventListener('click', () => { gen.closeModal(); floating.remove(); });
      gen.escapeModal(() => { floating.remove() });

      return id_obj;
   }

   function floatingModalDisplay(label, content) {
      let ids = {};
      let html = `
         <div class="player-entry noselect">
            <div class="player-position">${label}</div>
            <div class="player-position">${content}</div> </div>
         </div>
      `;
      return { ids, html };
   }

   gen.entryModal = (label, mouse, coords) => {
      let su_ids = { entry_modal: displayFx.uuid(), }

      d3.select('body')
         .append('div')
         .attr('class', 'modal')
         .attr('id', su_ids.entry_modal);

      let srcn = mouse ? d3.mouse(document.body) : coords ? [coords.x, coords.y] : [window.innerWidth / 2, 200];
      let { ids, html } = entryModalEntryField(label);
      let entry = floatingEntry().selector('#' + su_ids.entry_modal)
      entry(srcn[0], srcn[1] - window.scrollY, html);

      Object.assign(ids, su_ids);
      let id_obj = displayFx.idObj(ids);
      id_obj.search_field.element.focus();
      return id_obj;
   }

   function entryModalEntryField(label) {
      let ids = { search_field: displayFx.uuid(), }
      let html = `
         <div class="player-entry noselect">
            <div class="player-position">${lang.tr(label)}</div>
            <div class="player-position"> <div class="player-search flexrow"><input id="${ids.search_field}"> </div> </div>
         </div>
      `;
      return { ids, html };
   }

   gen.swapPlayerPosition = ({ container, bracket, position }) => {
      let mp_ids = {
         entry_field: displayFx.uuid(),
      }

      let entry_field = d3.select('body')
         .append('div')
         .attr('class', 'modal')
         .attr('id', mp_ids.entry_field);

      let coords = d3.mouse(document.body);
      let { ids, html } = generateSwapEntry({ position });
      let entry = floatingEntry().selector('#' + mp_ids.entry_field)
      entry(coords[0], coords[1] - window.scrollY, html);

      Object.assign(ids, mp_ids);
      let id_obj = displayFx.idObj(ids);
      return id_obj;
   }

   function generateSwapEntry({ position }) {
      let ids = {
         new_position: displayFx.uuid(),
      }
      let html = `
         <div class="player-entry noselect">
            <div class="player-position">${lang.tr('drp')}: ${position || ''}</div>
            <div class="player-position"> <div class="player-index">${lang.tr('new')} ${lang.tr('pos')}: <input id="${ids.new_position}"> </div> </div>
         </div>
      `;
      return { ids, html };
   }

   gen.ratingsFilterValues = ({ ratings_filter }) => {
      let mp_ids = {
         entry_modal: displayFx.uuid(),
      }

      document.body.style.overflow  = 'hidden';
      let entry_modal = d3.select('body')
         .append('div')
         .attr('class', 'modal')
         .attr('id', mp_ids.entry_modal);

      let { ids, html } = generateRatingsEntry({ ratings_filter });
      let entry = floatingEntry().selector('#' + mp_ids.entry_modal);

      entry(0, 0, html);
      entry.center();
      entry_modal.on('click', () => {
         d3.event.stopPropagation();
         entry_modal.remove();
         gen.closeModal();
      });

      Object.assign(ids, mp_ids);
      let id_obj = displayFx.idObj(ids);
      gen.escapeModal(() => { entry_modal.remove() });
      return id_obj;
   }

   function generateRatingsEntry({ ratings_filter }) {
      let ids = {
         low: displayFx.uuid(),
         high: displayFx.uuid(),
         clear: displayFx.uuid(),
         submit: displayFx.uuid(),
      }
      let html = `
         <div class="rating_range_entry noselect">
            <div class="rating_field">
               <div class="rating_range">${lang.tr('frm')}: <input id='${ids.low}' value='${(ratings_filter && ratings_filter.flow) || ""}'> </div>
               <div class="rating_range">${lang.tr('to')}: <input id='${ids.high}' value='${(ratings_filter && ratings_filter.high) || ""}'> </div>
            </div>
            <div class="rating_field">
               <button id='${ids.clear}' class='btn btn-small ratings-clear' style='margin-right: 1em;'>${lang.tr('clr')}</button>
               <button id='${ids.submit}' class='btn btn-small ratings-submit'>${lang.tr('sbt')}</button>
            </div>
         </div>
      `;
      return { ids, html };
   }

   gen.manualPlayerPosition = ({ container, position }) => {
      let mp_ids = {
         entry_field: displayFx.uuid(),
      }

      document.body.style.overflow  = 'hidden';
      let entry_field = d3.select('body')
         .append('div')
         .attr('class', 'modal')
         .attr('id', mp_ids.entry_field);

      let coords = d3.mouse(document.body);
      let { ids, html } = generateEntryField({ position });
      let entry = floatingEntry().selector('#' + mp_ids.entry_field)
      entry(coords[0], coords[1] - window.scrollY, html);

      Object.assign(ids, mp_ids);
      let id_obj = displayFx.idObj(ids);
      return id_obj;
   }

   function generateEntryField({ position }) {
      let ids = {
         player_index: displayFx.uuid(),
         player_search: displayFx.uuid(),
      }
      let html = `
         <div class="player-entry noselect">
            <div class="player-position">${lang.tr('drp')}: ${position || ''}</div>
            <div class="player-position"> <div class="player-index">${lang.tr('ord')}: <input id="${ids.player_index}"> </div> </div>
            <div class="player-position"> <div class="player-search flexrow">${lang.tr('ply')}:&nbsp;<input id="${ids.player_search}"> </div> </div>
         </div>
      `;
      return { ids, html };
   }

   gen.homeIconState = (value) => {
      let class_name = 'icon15 homeicon';
      if (value == 'update') class_name += '_update';
      if (value == 'messages') class_name += '_messages';
      if (value == 'authorized') class_name += '_authorized';
      if (value == 'notfound' || value == 'warning') class_name += '_notfound';
      document.getElementById('homeicon').className = class_name;
   }

   gen.drawBroadcastState = (elem, evt) => {
      let publish_state = !evt ? 'unpublished' 
         : evt.up_to_date ? 'publisheduptodate'
         : evt.published && evt.up_to_date == false ? 'publishedoutofdate'
         : evt.published ? 'published'
         : 'unpublished';
      elem.className = `${publish_state} action_icon`;
   }

   gen.pubStateTrnyInfo = (elem, value) => {
      let publish_state = value == undefined ? 'unpublished' : value == false ? 'publishedoutofdate' : 'publisheduptodate';
      elem.className = `${publish_state} action_icon`;
   }

   gen.tournamentPublishState = (elem, value) => {
      let publish_state = value == undefined ? 'push2cloud' : value == false ? 'push2cloud_outofdate' : 'push2cloud_updated';
      elem.className = `${publish_state} action_icon`;
   }

   gen.localSaveState = (elem, value) => {
      let save_state = value == undefined ? 'download' : value == false ? 'download_outofdate' : 'download_updated';
      elem.className = `${save_state} action_icon`;
   }

   gen.drawRepState = (elem, evt) => {
      if (!evt) return;
      let r = evt.player_representatives;
      let rep_count = r ? r.filter(f=>f).length : 0;
      let player_reps_state = rep_count > 0 ? 'reps_complete' : 'reps_incomplete';
      elem.className = `${player_reps_state} action_icon`;
   }

   gen.scheduleDetailsState = (elem, schedule) => {
      let detail_state = schedule && schedule.umpirenotes ? 'time_header' : 'time_header_inactive';
      elem.className = `${detail_state} action_icon`;
   }

   gen.locationList = (container, locations, highlight_listitem) => {
      let display = locations && locations.length;
      let html = !display ? '' : `
         <div class='event_row events_header'>
            <div class='cell location_abbr'>${lang.tr('locations.abbreviation')}</div>
            <div class='cell location_name'>${lang.tr('locations.name')}</div>
            <div class='cell location_address'>${lang.tr('locations.address')}</div>
            <div class='cell event_data icon ${gen.info} flexcenter' label='${lang.tr("locations.courts")}'><div class='event_icon surface_header'></div></div>
         </div>
      `;
      if (display) html += locations.map((l, i) => locationRow(l, i, highlight_listitem)).join('');
      d3.select(container.locations.element).style('display', display ? 'flex' : 'none').html(html);
      d3.select('#CT' + container.container.id).style('display', 'flex');
   }

   function locationRow(l, i, highlight_listitem) {
      let highlight = highlight_listitem != undefined && highlight_listitem == i ? ' highlight_listitem' : '';

      let html = `
         <div class='location event_row${highlight}' index='${i}'>
            <div class='location_abbr'>${l.abbreviation || ''}</div>
            <div class='location_name'>${l.name}</div>
            <div class='location_address'>${l.address}</div>
            <div class='event_data'>${l.courts || 0}</div>
         </div>
      `;

      return html;
   }

   gen.teamList = (container, teams, highlighted) => {
      let display = teams && teams.length;
      let html = !display ? '' : `
         <div class='team_row team_header'>
            <div class='cell tname'>${lang.tr('teams.name')}</div>
            <div class='cell team_data icon ${gen.info} flexcenter' label='${lang.tr("teams.members")}'><div class='event_icon opponents_header'></div></div>
            <div class='cell team_data icon ${gen.info} flexcenter' label='${lang.tr("teams.matches")}'><div class='event_icon matches_header'></div></div>
            <div class='cell team_data icon ${gen.info} flexcenter' label='${lang.tr("teams.winloss")}'><div class='event_icon winloss_header'></div></div>
         </div>
      `;
      if (display) html += teams.map((team, i) => teamRow(team, i, highlighted)).join('');
      d3.select(container.teams.element).style('display', display ? 'flex' : 'none').html(html);
      d3.select('#TM' + container.container.id).style('display', 'flex');
   }

   function teamRow(team, i, highlighted) {
      let highlight = highlighted != undefined && highlighted == team.uuid ? ' highlight_listitem' : '';
      let html = `
         <div class='teamrow teamid team_row ${highlight}' index='${i}' uuid='${team.uuid}'>
            <div class='teamrow tname'>${team.name}</div>
            <div class='teamrow team_data flexcenter'>${team.members}</div>
            <div class='teamrow team_data flexcenter'>${team.total_matches || 0}</div>
            <div class='teamrow team_data flexcenter'>${team.winloss}</div>
         </div>
      `;

      return html;
   }
   gen.eventList = (container, events, highlight_euid) => {
      let display = events && events.length;
      let html = !display ? '' : `
         <div class='event_row events_header'>
            <div class='cell event_category icon ${gen.info} flexjustifystart' label='${lang.tr("cat")}'><div class='event_icon category_header'></div></div>
            <div class='cell event_name'>${lang.tr('events.name')}</div>
            <div class='cell event_draw_type'>${lang.tr('events.draw_type')}</div>
            <div class='cell event_data icon ${gen.info} flexcenter' label='${lang.tr("events.draw_size")}'><div class='event_icon drawsize_header'></div></div>
            <div class='cell event_data icon ${gen.info} flexcenter' label='${lang.tr("events.opponents")}'><div class='event_icon opponents_header'></div></div>
            <div class='cell event_data icon ${gen.info} flexcenter' label='${lang.tr("emts")}'><div class='event_icon matches_header'></div></div>
            <div class='cell event_data icon ${gen.info} flexcenter' label='${lang.tr("sch")}'><div class='event_icon time_header'></div></div>
            <div class='cell event_data icon ${gen.info} flexcenter' label='${lang.tr("events.rank")}'><div class='event_icon rank_header'></div></div>
            <div class='cell event_data icon ${gen.info} flexcenter' label='${lang.tr("inout")}'><div class='event_icon inout_header'></div></div>
            <div class='cell event_data icon ${gen.info} flexcenter' label='${lang.tr("events.surface")}'><div class='event_icon surface_header'></div></div>
            <div class='cell event_data icon ${gen.info} flexcenter' label='${lang.tr("events.created")}'><div class='event_icon complete_header'></div></div>
            <div class='cell event_data icon ${gen.info} flexcenter' label='${lang.tr("draws.published")}'><div class='event_icon published_header'></div></div>
         </div>
      `;
      if (display) html += events.map((e, i) => eventRow(e, i, highlight_euid)).join('');
      d3.select(container.events.element).style('display', display ? 'flex' : 'none').html(html);
      d3.select('#ET' + container.container.id).style('display', 'flex');
   }

   function eventRow(e, i, highlight_euid) {
      let highlight = highlight_euid != undefined && highlight_euid == e.euid ? ' highlight_listitem' : '';
      let warning = e.warning ? ' listitem_warning' : '';
      let created = e.active ? 'blue' : e.draw_created ? 'green' : 'black';
      let created_state = e.active ? 'drawactive' : e.draw_created ? 'drawcreated' : 'notcreated';
      let background = ` style='color: ${created}'`;

      let publish_state = e.up_to_date ? 'publisheduptodate' : e.published && e.up_to_date == false ? 'publishedoutofdate' : e.published ? 'published' : 'unpublished';
      let published = {
         'unpublished': lang.tr('draws.unpublished'),
         'publisheduptodate': lang.tr('draws.publisheduptodate'),
         'publishedoutofdate': lang.tr('draws.publishedoutofdate'),
         'published': lang.tr('draws.published'),
      }
      let publish_label = published[publish_state];

      let created_labels = {
         'drawactive': lang.tr('phrases.drawactive'),
         'drawcreated': lang.tr('phrases.drawcreated'),
         'notcreated': lang.tr('phrases.notcreated'),
      }
      let created_label = created_labels[created_state];

      let html = `
         <div class='event event_row${highlight}${warning}' index='${i}' euid='${e.euid}'>
            <div class='event_category'>${e.custom_category || e.category}</div>
            <div class='event_name'>${e.name}</div>
            <div class='event_draw_type'>${e.draw_type_name}</div>
            <div class='event_data flexcenter'>${e.draw_size}</div>
            <div class='event_data flexcenter'>${e.opponents}</div>
            <div class='event_data flexcenter'>${e.total_matches || 0}</div>
            <div class='event_data flexcenter'>${e.scheduled || 0}</div>
            <div class='event_data flexcenter'>${e.rank}</div>
            <div class='event_data flexcenter'><div class='event_icon ${inout_icons[e.inout]}'></div></div>
            <div class='event_data flexcenter'><div class='event_icon ${surface_icons[e.surface[0]]}'></div></div>
            <div class='event_data flexcenter ${gen.info}' label='${created_label}'><div class='event_icon ${created_state}'></div></div>
            <div class='event_data flexcenter ${gen.info} pubstate' label='${publish_label}'><div class='event_icon ${publish_state}'></div></div>
         </div>
      `;

      return html;
   }

   gen.hideTeamDetails = (container) => {
      d3.select(container.team_details.element).style('display', 'none');
      Array.from(container.teams.element.querySelectorAll('.highlight_listitem'))
         .forEach(elem => elem.classList.remove('highlight_listitem'));
   }

   gen.hideEventDetails = (container) => {
      d3.select(container.event_details.element).style('display', 'none');
      Array.from(container.events.element.querySelectorAll('.highlight_listitem'))
         .forEach(elem => elem.classList.remove('highlight_listitem'));
   }

   gen.hideLocationDetails = (container) => {
      d3.select(container.location_details.element).style('display', 'none');
      Array.from(container.locations.element.querySelectorAll('.highlight_listitem'))
         .forEach(elem => elem.classList.remove('highlight_listitem'));
   }

   gen.displayLocationAttributes = (container, l, edit) => {
      let ids = {
         abbreviation: displayFx.uuid(),
         name: displayFx.uuid(),
         address: displayFx.uuid(),
         courts: displayFx.uuid(),
         identifiers: displayFx.uuid(),
      };
      let html = `
         <div class='attribute_groups'>
            <div>
               <div class='location_attribute'>
                  <div class='loclabel'>${lang.tr('locations.abbreviation')}:</div>
                  <input id='${ids.abbreviation}' class='locvalue_short'> 
               </div>
               <div class='location_attribute'>
                  <div class='loclabel'>${lang.tr('locations.name')}:</div>
                  <input id='${ids.name}' class='locvalue_long'> 
               </div>
               <div class='location_attribute'>
                  <div class='loclabel'>${lang.tr('locations.address')}:</div>
                  <input id='${ids.address}' class='locvalue_long'> 
               </div>
               <div class='location_attribute'>
                  <div class='loclabel'>${lang.tr('locations.courts')}:</div>
                  <input id='${ids.courts}' class='location_courts'>
               </div>
               <div class='location_attribute'>
                  <div class='loclabel'>${lang.tr('locations.identifiers')}:</div>
                  <input id='${ids.identifiers}' placeholder='1, 2, 3, 4' class='locvalue_short'>
               </div>
            </div>
         </div>
      `;
      d3.select(container.location_attributes.element).html(html);
      return displayFx.idObj(ids);
   }

   gen.displayEventDetails = ({ tournament, container, e, genders, inout, surfaces, formats, draw_types, edit }) => {
      let ids = {
         eligible: displayFx.uuid(),
         gender: displayFx.uuid(),
         category: displayFx.uuid(),
         rank: displayFx.uuid(),
         format: displayFx.uuid(),
         scoring: displayFx.uuid(),
         surface: displayFx.uuid(),
         inout: displayFx.uuid(),
         draw_type: displayFx.uuid(),
         approved_count: displayFx.uuid(),
         eligible_count: displayFx.uuid(),
      }
      let detail_fields = `
            <div class='column'>
               <div class='entry_label' style='text-align: right'>${lang.tr('gdr')}</div>
               <div class='entry_label' style='text-align: right'>${lang.tr('cat')}</div>
               <div class='entry_label' style='text-align: right'>${lang.tr('events.rank')}</div>
               <div class='entry_label' style='text-align: right'>${lang.tr('fmt')}</div>
               <div class='entry_label' style='text-align: right'>${lang.tr('scoring')}</div>
               <div class='entry_label' style='text-align: right'>${lang.tr('events.surface')}</div>
               <div class='entry_label' style='text-align: right'>${lang.tr('inout')}</div>
               <div class='entry_label' style='text-align: right'>${lang.tr('dtp')}</div>
            </div>
            <div class='column'>
               <div class='entry_field' id='${ids.gender}'></div>
               <div class='entry_field' id='${ids.category}'></div>
               <div class='entry_field' id='${ids.rank}'></div>
               <div class='entry_field' id='${ids.format}'></div>
               <div class='entry_field dd'>
                  <div class='label'></div>
                  <div class='options' style='border: 1px solid #000'>
                     <div class='scoringformat' id='${ids.scoring}'></div>
                  </div>
               </div>
               <div class='entry_field' id='${ids.surface}'></div>
               <div class='entry_field' id='${ids.inout}'></div>
               <div class='entry_field' id='${ids.draw_type}'></div>
            </div>
      `;
      d3.select(container.detail_fields.element).html(detail_fields);

      let removeall = !edit ? '' : `<div class='removeall ${gen.infoleft}' label='${lang.tr("tournaments.removeall")}'>-</div>`;
      let addall = !edit ? '' : `<div class='addall ${gen.infoleft}' label='${lang.tr("tournaments.addall")}'>+</div>`;
      let promoteall = !edit ? '' : `<div class='promoteall ${gen.infoleft}' label='${lang.tr("tournaments.addall")}'>+</div>`;
      let approved_count = e && e.approved && e.approved.length ? `(${e.approved.length})` : '';
      let eligible_count = '';

      let detail_players = `
         <div class='flexrow divider approved'>
            <div>${lang.tr('events.approved')} <span id='${ids.approved_count}'>${approved_count}</span></div>
            ${removeall}
         </div>
         <div grouping='approved' class='approved_players player_container'></div>

         <div class='flexrow divider event_teams' style='display: none'>
            <div>${lang.tr('events.teams')}</div>
            ${promoteall}
         </div>
         <div grouping='team' class='team_players player_container'></div>

         <div class='flexrow divider eligible'>
            <div id='${ids.eligible}' class='ctxclk'>${lang.tr('events.eligible')} <span id='${ids.eligible_count}'></span></div>
            ${addall}
         </div>
         <div grouping='eligible' class='eligible_players player_container'></div>
      `;
      d3.select(container.detail_players.element).html(detail_players);

      gen.setEventName(container, e);

      dd.attachDropDown({ id: ids.gender,  options: genders });
      dd.attachDropDown({ id: ids.format,  options: formats });
      dd.attachDropDown({ id: ids.category,  options: getCategories(tournament) });
      dd.attachDropDown({ id: ids.draw_type,  options: draw_types });
      dd.attachDropDown({ id: ids.rank,  options: getRanks(tournament) });
      dd.attachDropDown({ id: ids.surface,  options: surfaces });
      dd.attachDropDown({ id: ids.inout,  options: inout });
      return displayFx.idObj(ids);
   }

   gen.configTreeDraw = ({ container, e, structure_options, feed_options, skip_options, sequential_options }) => {
      let ids = {
         roundlimit: displayFx.uuid(),
         structure: displayFx.uuid(),
         qualifiers: displayFx.uuid(),
         qualification: displayFx.uuid(),
         consolation: displayFx.uuid(),
         elimination: displayFx.uuid(),
         skiprounds: displayFx.uuid(),
         feedrounds: displayFx.uuid(),
         sequential: displayFx.uuid(),
      }

      let config = `
         <div class='detail_fields'>
            <div class='column'>
               <div class='entry_label roundlimit' style='display: none;'>${lang.tr('draws.roundlimit')}</div>
               <div class='entry_label'>${lang.tr('draws.structure')}</div>
               <div class='entry_label feedconfig' style='display: none;'>${lang.tr('draws.skiprounds')}</div>
               <div class='entry_label feedconfig' style='display: none;'>${lang.tr('draws.feedrounds')}</div>
               <div class='entry_label feedconfig' style='display: none;'>${lang.tr('draws.sequential')}</div>
               <div class='entry_label qualifiers' style='display: none;'>${lang.tr('qualifiers')}</div>
            </div>
            <div class='column'>
               <div class='entry_field roundlimit' id='${ids.roundlimit}' style='display: none;'></div>
               <div class='entry_field' id='${ids.structure}'></div>
               <div class='entry_field feedconfig' style='display: none;' id='${ids.skiprounds}'></div>
               <div class='entry_field feedconfig' style='display: none;' id='${ids.feedrounds}'></div>
               <div class='entry_field feedconfig' style='display: none;' id='${ids.sequential}'></div>
               <div class='entry_field qualifiers' style='display: none;' id='${ids.qualifiers}'></div>
            </div>
         </div>
         <div class='linked_draw qualification' style='display: none'>
            <div class='link_label'>${lang.tr('draws.qualification')} ${lang.tr('drw')}</div>
            <div class='link_field' id='${ids.qualification}'></div>
         </div>
         <div class='linked_draw consolation' style='display: none'>
            <div class='link_label'>${lang.tr('draws.consolation')} ${lang.tr('drw')}</div>
            <div class='link_field' id='${ids.consolation}'></div>
         </div>
         <div class='linked_draw elimination' style='display: none'>
            <div class='link_label'>${lang.tr('draws.elimination')} ${lang.tr('drw')}</div>
            <div class='link_field' id='${ids.elimination}'></div>
         </div>
      `;
      d3.select(container.draw_config.element).html(config);

      dd.attachDropDown({ id: ids.roundlimit, display: 'none' });
      dd.attachDropDown({ id: ids.qualifiers, display: 'none' });
      dd.attachDropDown({ id: ids.structure, options: structure_options });
      dd.attachDropDown({ id: ids.skiprounds, display: 'none', options: skip_options });
      dd.attachDropDown({ id: ids.feedrounds, display: 'none', options: feed_options });
      dd.attachDropDown({ id: ids.sequential, display: 'none', options: sequential_options });
      dd.attachDropDown({ id: ids.qualification, options: [{ key: lang.tr('none'), value: ''}] });
      dd.attachDropDown({ id: ids.consolation, options: [{ key: lang.tr('none'), value: ''}] });
      dd.attachDropDown({ id: ids.elimination, options: [{ key: lang.tr('none'), value: ''}] });
      dd.attachDropDown({ id: ids.matchformat, options: [{ key: lang.tr('none'), value: ''}] });
      return displayFx.idObj(ids);
   }

   gen.configRoundRobinDraw = (container, e, options, size_options) => {
      let ids = {
         brackets: displayFx.uuid(),
         bracket_size: displayFx.uuid(),
         elimination: displayFx.uuid(),
         qualifiers: displayFx.uuid(),
      }
      let config = `
         <div class='detail_fields'>
            <div class='column'>
               <div class='entry_label' style='text-align: right'>${lang.tr('draws.brackets')}</div>
               <div class='entry_label' style='text-align: right'>${lang.tr('draws.bracketsize')}</div>
               <div class='entry_label qualifiers' style='text-align: right; display: none;'>${lang.tr('qualifiers')}</div>
            </div>
            <div class='column'>
               <div class='entry_field' id='${ids.brackets}'></div>
               <div class='entry_field' id='${ids.bracket_size}'></div>
               <div class='entry_field qualifiers' style='display: none;' id='${ids.qualifiers}'></div>
            </div>
         </div>
         <div class='linked_draw elimination' style='display: none'>
            <div class='link_label'>${lang.tr('draws.elimination')} ${lang.tr('drw')}</div>
            <div class='link_field' id='${ids.elimination}'></div>
         </div>
      `;
      d3.select(container.draw_config.element).html(config);
      dd.attachDropDown({ id: ids.brackets,  options });
      dd.attachDropDown({ id: ids.bracket_size, options: size_options });
      dd.attachDropDown({ id: ids.qualifiers, options: [{ key: '1', value: '1'}] });
      dd.attachDropDown({ id: ids.elimination, options: [{ key: lang.tr('none'), value: ''}] });
      return displayFx.idObj(ids);
   }

   gen.configQualificationDraw = ({ container, e, structure_options, feed_options, skip_options, sequential_options, qualcounts }) => {
      let ids = {
         structure: displayFx.uuid(),
         qualifiers: displayFx.uuid(),
         elimination: displayFx.uuid(),
      }
      let config = `
         <div class='detail_fields'>
            <div class='column'>
               <div class='entry_label'>${lang.tr('draws.structure')}</div>
               <div class='entry_label' style='text-align: right'>${lang.tr('qualifiers')}</div>
            </div>
            <div class='column'>
               <div class='entry_field' id='${ids.structure}'></div>
               <div class='entry_field' id='${ids.qualifiers}'></div>
            </div>
         </div>
         <div class='linked_draw elimination' style='display: none'>
            <div class='link_label'>${lang.tr('draws.maindraw')}</div>
            <div class='link_field' id='${ids.elimination}'></div>
         </div>
      `;
      d3.select(container.draw_config.element).html(config);

      dd.attachDropDown({ id: ids.structure, options: structure_options });
      dd.attachDropDown({ id: ids.qualifiers,  options: qualcounts });
      dd.attachDropDown({ id: ids.elimination, options: [{ key: lang.tr('none'), value: ''}] });
      return displayFx.idObj(ids);
   }

   gen.setEventName = (container, e) => {
      let { type, name } = tournamentFx.genEventName(e);
      let event_details = d3.select(container.event_details.element);
      let full_name = `${e.custom_category ? e.custom_category + ' ' : ''}${e.name}&nbsp;<span class='event_type'>${type}</span>`;
      event_details.select('.event_name').html(full_name);
   }

   gen.displayEventPlayers = ({ container, approved, teams, eligible, ratings }) => {
      genGrouping(approved, 'approved');
      genGrouping(teams, 'team');
      genGrouping(eligible, 'eligible');

      container.approved_count.element.innerHTML = approved && approved.length ? `(${approved.length})` : '';
      container.eligible_count.element.innerHTML = eligible && eligible.length ? `(${eligible.length})` : '';

      function genGrouping(players, group_class) {
         let html = players.map(row => teamBox(row)).join('');
         let elem = d3.select(container.event_details.element).select(`.${group_class}_players`);
         elem.html(html);
      }

      function teamBox(team) {
         let border = team.players ? ' border' : '';
         let border_padding = team.players ? ' border_padding' : '';
         let team_click = team.players ? ' team_click' : '';
         let subrank = team.subrank ? `/${team.subrank}` : '';
         let dblsrank = team.players && team.combined_dbls_rank && team.combined_dbls_rank < 9999 ? `${team.combined_dbls_rank}/` : '';
         let rank = team.rank < 9999 ? `(${dblsrank}${team.rank}${subrank})` : '';

         let format = team.players ? 'doubles' : 'singles';
         let rating_type = ratings && ratings.type;
         let rating = team.ratings &&
            team.ratings[rating_type] &&
            team.ratings[rating_type][format] &&
            team.ratings[rating_type][format] ?
            `&nbsp;{${team.ratings[rating_type][format].value}}` : '';

         let combined_ranking = team.players && team.rank ? `<div class="border_padding"><i>${rank}</i></div>` : '';
         let team_seed = team.players && team.seed ? `<div class="border_padding"><b>[${team.seed}]</b></div>` : '';
         let wildcard = team.players && team.wildcard ? `<div class="border_padding"><b>[WC]</b></div>` : '';

         let background = team.duplicates ? ` style='background: lightyellow;'` : '';
         let duplicate = team.duplicates ? ` duplicates="${team.duplicates}"` : '';
         let style = !wildcard ? '' : `style='color: green'`;

         // this is a stub for the future to drag/drop teams to approve
         let dragdrop = gen.dragdrop && team.players ? ` draggable="true" ondragstart="drag(event, this)"` : '';

         let team_rank = team.rank < 9999 ? ` team_rank='${team.rank}'` : '';
         let team_id = team.players ? ` team_id='${team.players.map(p=>p.id).sort().join("|")}' ` : '';
         let html = `<div ${style} ${team_rank} ${team_id} ${duplicate} class='team_box${border}${team_click}'${background}>
                        <div class='flexcol${border_padding}'${dragdrop}>`;
         html += team.players ? team.players.map(p => playerRow(p)).join('') : playerRow(team, true);
         html += `      </div>
                        ${wildcard || team_seed} ${combined_ranking || rating}
                     </div>`;
         return html;
      }

      function playerRow(p, click) {
         let player_click = click ? 'player_click ' : '';
         let html = `
            <div puid='${p.puid}' uid='${p.id}' class='${player_click}flexrow detail'>
               <div class='ctxclk event_player_name flexjustifystart'>${p.full_name}</div>
            </div>`;
         return html;
      }
   }

   gen.clubList = (clubs) => {
      let ids = {
         add: displayFx.uuid(),
         container: displayFx.uuid(),
         players: displayFx.uuid(),
         download: displayFx.uuid(),
         rank: displayFx.uuid(),
      }
            // <div id='${ids.players}' class='club_action'><div class='club_players'></div></div>
            // <div id='${ids.rank}' class='club_action'><div class='club_player_ranks'></div></div>
      let html = `<div id='${ids.container}' class='club_container'>

         <!-- 
         <div class='club_actions'>
            <div id='${ids.add}' class='club_action'><div class='club_add_club'></div></div>
            <div id='${ids.download}' class='club_action'><div class='club_download'></div></div>
         </div>
         -->

         <div class='club_row club_header'>
            <span class='code'>Code</span>
            <div class='link'><img src='./icons/link_white.png' class='club_link'></div>
            <div class='name'>Club</div>
            <div class='courts'>Courts</div>
            <div class='city'>City</div>
            <div class='phone'>Phone</div>
            <div class='email'>Email</div>
         </div>
      `;
      html += clubs.map(clubRow).filter(f=>f).join('');
      html += '</div>';

      gen.reset();
      selectDisplay(html, 'clubs');

      return displayFx.idObj(ids);
   }

   function clubRow(club) {
      let website = club.website ? `<a href="http://${club.website}" target="_blank"><img src='./icons/link.png' class='club_link'></a>` : '';
      let phone = club.phone ? club.phone.replace(/\)(\d)/g, ') $1').replace(/(\d)\(/g, '$1 (') : club.phone;
      let courts = !club.courts ? '' : Object.keys(club.courts).map(k=>club.courts[k].trim()).join('/');
      return `
         <div cuid='${club.id}' class='club_row club_click'>
            <span class='code'>${club.code}</span>
            <div class='link'>${website}</div>
            <div class='name'>${club.name}</div>
            <div class='courts'>${courts}</div>
            <div class='city'>${club.city}</div>
            <div class='phone'>${phone}</div>
            <div class='email'>${club.email}</div>
         </div>`;
   }

   gen.calendarContainer = () => {
      let ids = {
         container:  displayFx.uuid(),
         start:      displayFx.uuid(),
         end:        displayFx.uuid(),
         category:   displayFx.uuid(),
         add:        displayFx.uuid(),
         rows:       displayFx.uuid(),
      }

      env.calstart = ids.start;
      env.calend = ids.end;

      let html = `
         <div id='${ids.container}' class='calendar_container'>
            <div class='calendar_selection'>
               <div class='flexrow'>
                  <div class='calendar_date' style='font-weight: bold'>
                     <div class='calabel'>${lang.tr('frm')}:</div>
                     <input tabindex='-1' class='calinput' id='${ids.start}'>
                  </div>
               </div>
               <div class='flexrow'>
                  <div class='calendar_date' style='font-weight: bold'>
                     <div class='calabel'>${lang.tr('to')}:</div>
                     <input tabindex='-1' class='calinput' id='${ids.end}'>
                  </div>
               </div>
               <div id='${ids.category}'></div>
               <div id='${ids.add}' class='add_tournament_action infoleft' label='${lang.tr("tournaments.add")}'><div class='calendar_add_tournament'></div></div>
            </div>

            <div id='${ids.rows}' class='flexcol' style='width: auto;'></div>
            </div>
      `;

      gen.reset();
      selectDisplay(html, 'calendar');
      dd.attachDropDown({ id: ids.category, label: lang.tr('ddlb.category'), options: [{ value: '', key: '-' }] });

      return displayFx.idObj(ids);
   }

   gen.calendarRows = (element, tournaments) => {
      let html = `
         <div class='calendar_row calendar_header'>
            <span class='dates'>${lang.tr('dt')}</span>
            <div class='name'>${lang.tr('trn')}</div>
            <div class='category icon ${gen.info} flexcenter' label='${lang.tr("cat")}'><span class='event_icon category_header_white'></span></div>
            <div class='rank'>${lang.tr('trnk')}</div>
            <!-- <div class='actual'>${lang.tr('act')}</div> -->
            <!-- <div class='draws'>${lang.tr('drz')}</div> -->
         </div>
      `;
      html += tournaments.map(calendarRow).filter(f=>f).join('');
      element.innerHTML = html;
   }

   function calendarRow(tournament) {
      let categories = staging.legacyCategory(tournament.category, true);
      if (tournament.categories && tournament.categories.length) categories = tournament.categories.map(c=>`<span>${c}</span>`).join('');
      let background = new Date().getTime() > tournament.end ? 'calendar_past' : 'calendar_future';
      let received = tournament.received ? 'tournament_received' : '';
      let actual_rankings = '';
      if (tournament.accepted) {
         let rankDiff = (rank) => `<span class='${rank != tournament.rank ? "diff" : ""}'>${rank}</span>`;
         actual_rankings = Object.keys(tournament.accepted).map(key => {
            let singles = rankDiff(tournament.accepted[key].sgl_rank);
            let doubles = rankDiff(tournament.accepted[key].dbl_rank);
            return `<span style='white-space: nowrap'>${key}: [S-${singles}, D-${doubles}]</span>`;
         }).join('<span>&nbsp;</span>');
      }

      return `
         <div tuid='${tournament.tuid}' class='calendar_click calendar_row calendar_highlight ${background} ${received}'>
            <span class='dates' style='overflow: hidden'> ${displayDate(tournament.start)}&nbsp;/ ${displayDate(tournament.end)} </span>
            <div class='name ctxclk'>${tournament.name}</div>
            <div class='category flexcol'>${categories || ''}</div>
            <div class='rank'>${tournament.rank || ''}</div>
            <!-- <div class='actual'>${actual_rankings}</div> -->
            <!-- <div class='draws'>${tournament.draws || ''}</div> -->
         </div>
      `;
   }

   gen.splashScreen = (components, settings_tabs) => {
      let ids = { 
         org: displayFx.uuid(),
         clubs: displayFx.uuid(),
         players: displayFx.uuid(),
         settings: displayFx.uuid(),
         tournaments: displayFx.uuid(),
         documentation: displayFx.uuid(),
         importexport: displayFx.uuid(),
         keys: displayFx.uuid(),
      }


      let settings_tabs_count = Object.keys(settings_tabs).map(k=>settings_tabs[k]).reduce((p, c) => p || c);
      let settings = action(components.settings && settings_tabs_count, ids.settings, lang.tr('set'), 'splash_settings');
      let players_actions = components.players && Object.keys(components.players).map(k=>components.players[k]).reduce((p, c) => p || c, false);
      let players = action(players_actions, ids.players, lang.tr('pyr'), 'splash_players');
      let clubs = action(components.clubs, ids.clubs, lang.tr('clb'), 'splash_clubs');
      let tournaments = action(components.tournaments, ids.tournaments, lang.tr('trn'), 'splash_tournament');
      let importexport = action(components.importexport, ids.importexport, lang.tr('importexport'), 'splash_importexport');
      let documentation = action(components.documentation, ids.documentation, lang.tr('documentation'), 'splash_documentation');
      let keys = action(components.keys, ids.keys, lang.tr('keys'), 'splash_keys');

      let html = `
         <div class='splash_screen'>
            <div class='splash_org flexcenter' id='${ids.org}'></div>
            <div class='actions container'>${players}${clubs}${tournaments}${settings}${documentation}${importexport}${keys}</div>
         </div>
      `;

      displayContent(html, 'splash');
      return displayFx.idObj(ids);

      function action(setting, id, label, icon) {
         let bool = (typeof setting != 'object') ? setting : Object.keys(setting).reduce((p, c) => setting[c] || p, undefined);
         if (!bool) return '';
         return `<div id='${id}' class='${gen.info} action' label="${label}"><div class='splash_icon ${icon}'></div></div>`;
      }
   }

   gen.addTeamOptions = () => {
      if (searchBox.element) searchBox.element.blur();
      let ids = {
         teamsearch: displayFx.uuid(),
         createnew: displayFx.uuid(),
         submitkey: displayFx.uuid(),
         cancel: displayFx.uuid()
      }
      let html = `
         <div class='flexcol' style='margin-left: 1em; margin-right: 1em;'>
            <h2>${lang.tr('actions.add_team')}</h2>
            <div class='flexrow' style='width: 100%;'>
               <input id='${ids.teamsearch}' class='teamsearch' style='width: 100%' placeholder='${lang.tr("teams.nameorkey")}'>
            </div>
            <div class='flexcenter' style='margin-bottom: 2em;'>
               <button id='${ids.createnew}' class='btn btn-small edit-submit' style='margin-right: 2em'>${lang.tr('teams.createnew')}</button>
               <button id='${ids.submitkey}' class='btn btn-small edit-submit' style='margin-right: 2em'>${lang.tr('teams.submitkey')}</button>
               <button id='${ids.cancel}' class='btn btn-small edit-cancel'>${lang.tr('actions.cancel')}</button>
            </div>
         </div>
      `;
      document.body.style.overflow  = 'hidden';
      document.getElementById('processing').style.display = "flex";
      document.getElementById('processingtext').innerHTML = html;
      displayGen.escapeModal();
      let id_obj = displayFx.idObj(ids);
      if (id_obj.cancel) id_obj.cancel.element.addEventListener('click', () => gen.closeModal());
      return id_obj;
   }

   gen.displayTeamDetails = (container, team) => {
      // ddlb to select club, country, college, school
      let ids = {
         abbreviation: displayFx.uuid(),
         club: displayFx.uuid(),
         school: displayFx.uuid(),
         ioc: displayFx.uuid(),
         coach: displayFx.uuid(),
         players: displayFx.uuid(),
      };
      let html = `
         <div class='attributes'>
            <div style='display: grid'>
               <div class='teamattr'>${lang.tr('teams.abbreviation')}:</div>
               <div class='teamattr'>${lang.tr('teams.club')}:</div>
               <div class='teamattr'>${lang.tr('teams.school')}:</div>
               <div class='teamattr'>${lang.tr('teams.ioc')}:</div>
               <div class='teamattr'>${lang.tr('teams.coaches')}:</div>
            </div>
            <div style='display: grid' >
               <input class='team_attr_edit' id='${ids.abbreviation}'> 
               <input class='team_attr_edit' id='${ids.club}'> 
               <input class='team_attr_edit' id='${ids.school}'> 
               <input class='team_attr_edit' id='${ids.ioc}'> 
               <input class='team_attr_edit' id='${ids.coach}'> 
            </div>
         </div>
         <div id='${ids.players}' class='team_players'>
         </div>
      `;
      
      d3.select(container.team_attributes.element).html(html);
      return displayFx.idObj(ids);
   }

   gen.displayTeamPlayers = (elem, players=[]) => {
      let html = `
         <div class='team_player team_header'>
            <div class='flexrow'>
               <div class='rankrow manualorder'>#</div>
               <div>${lang.tr('pyr')}</div>
            </div>
            <div class='event_icon opponents_header'></div>
         </div>
      `;
      let display_order = {};
      html += players.map((player, i) => {
         let font_color = !player.sex ? 'black' : player.sex == 'W' ? '#840076' : '#00368c'; 
         let style = `style='color: ${font_color};'`;
         let phtml = `
            <div class='team_player' ${style}>
               <div class='flexrow'>
                  <input puid='${player.puid}' order='${i}' class='rankrow manualorder' value='${player.order || ""}'>
                  <div>${player.last_name.toUpperCase()}, ${player.first_name} </div>
               </div>
               <div style='padding-right: 2px;'>${player.sex}</div>
            </div>
         `;
         display_order[p.puid] = i;
         return phtml;
      }).join('');
      elem.innerHTML = html;
   }

   gen.importPlayers = () => {
      let ids = { 
         dropzone: displayFx.uuid()
      }
      let message = `<div id='${ids.dropzone}' class='dropzone flexcenter container'>
         <div class='flexcol'>
            <div class='actions'>
               <div class='action ${gen.info}' label='${lang.tr("phrases.importdata")}'><label for='file'><div class='splash_icon splash_upload'></div></label></div>
            </div>
            <div class='flexcenter' style='width: 100%;'><div style='width: 80%;'>${lang.tr('phrases.draganddrop')}</div></div>
         </div>
         <input type="file" name="files[]" id="file" class="dropzone__file" data-multiple-caption="{count} files selected" multiple style='display: none' />
         </div>
      `;

      let cancelAction = () => gen.closeModal();
      return gen.actionMessage({ message_ids: ids, message, cancelAction });
   }

   gen.importExport = () => {
      let ids = { 
         template: displayFx.uuid(),
         download: displayFx.uuid(),
      }
      let html = `<div class='dropzone flexcenter container'>
         <div class='flexcol'>
            <div class='actions'>
               <div class='action ${gen.info}' label='${lang.tr("phrases.importdata")}'><label for='file'><div class='splash_icon splash_upload'></div></label></div>
               <div id='${ids.template}' class='action ${gen.info}' label='${lang.tr("phrases.importtemplate")}'> <div class='splash_icon icon_spreadsheet'></div> </div>
               <div id='${ids.download}' class='action ${gen.info}' label='${lang.tr("phrases.exportdata")}'><div class='splash_icon splash_download'></div></div>
            </div>
            <div class='flexcenter' style='width: 100%;'>${lang.tr('phrases.draganddrop')}</div>
         </div>
         <input type="file" name="files[]" id="file" class="dropzone__file" data-multiple-caption="{count} files selected" multiple style='display: none' />
      `;

      html += '</div>';
      gen.reset();
      selectDisplay(html, 'importexport');

      return displayFx.idObj(ids);
   }

   gen.teamActions = () => {
      let ids = { 
         add: displayFx.uuid(),
         pointCalc: displayFx.uuid(),
         rankCalc: displayFx.uuid(),
      }
      let html = `
         </div>
      `;

      html += '</div>';
      gen.reset();
      selectDisplay(html, 'teams');

      return displayFx.idObj(ids);
   }

   gen.playersActions = () => {
      let ids = { 
         add: displayFx.uuid(),
         teams: displayFx.uuid(),
         pointCalc: displayFx.uuid(),
         rankCalc: displayFx.uuid(),
      }
      let html = `<div class='flexcenter container'>

         <div class='actions'>
            <div id='${ids.add}' class='${gen.info} action' label='${lang.tr("actions.manage_players")}' style='display: none'>
               <div class='player_view_players'></div>
            </div>
            <div id='${ids.teams}' class='${gen.info} action' label='${lang.tr("actions.manage_teams")}' style='display: none'>
               <div class='player_teams'></div>
            </div>
            <div id='${ids.pointCalc}' class='${gen.info} action' label='${lang.tr("phrases.calculateranking")}' style='display: none'>
               <div class='player_calc_points'></div>
            </div>
            <div id='${ids.rankCalc}' class='${gen.info} action' label='${lang.tr("phrases.generateranklist")}' style='display: none'>
               <div class='player_calc_ranks'></div>
            </div>
         </div>
      `;

      html += '</div>';
      gen.reset();
      selectDisplay(html, 'rankings');

      return displayFx.idObj(ids);
   }

   gen.drawPDFmodal = () => {
      let ids = {
         drawsheet: displayFx.uuid(),
         signinsheet: displayFx.uuid(),
      }
      let html = `
         <div class='flexccol'>
            <div class='flexcol' style='width: 100%'>
               <div class='flexcenter' style='margin: .5em;'><h2>${lang.tr('print.draw')}</h2></div>
            </div>
            <div class='config_actions'>
               <div id='${ids.drawsheet}' class='btn btn-large config_submit'>${lang.tr('drw')}</div>
               <div id='${ids.signinsheet}' class='btn btn-large config_submit'>LL ${lang.tr('print.signin')}</div>
            </div>
         </div>
      `;
      gen.showConfigModal(html);

      return displayFx.idObj(ids);
   }

   gen.signInSheetFormat = () => {
      let ids = {
         singles: displayFx.uuid(),
         doubles: displayFx.uuid(),
      }
      let html = `
         <div class='flexccol'>
            <div class='flexcol' style='width: 100%'>
               <div class='flexcenter' style='margin: .5em;'><h2>${lang.tr('print.signin')}</h2></div>
            </div>
            <div class='config_actions'>
               <div id='${ids.singles}' class='btn btn-large config_submit'>${lang.tr('sgl')}</div>
               <div id='${ids.doubles}' class='btn btn-large config_submit'>${lang.tr('dbl')}</div>
            </div>
         </div>
      `;
      gen.showConfigModal(html);

      return displayFx.idObj(ids);
   }

   gen.twoChoices = ({ text, option1, option2 }) => {
      let ids = {
         option1: displayFx.uuid(),
         option2: displayFx.uuid(),
      }
      let html = `
         <div class='flexccol'>
            <div class='flexcol' style='width: 100%'>
               <div class='flexcenter' style='margin: .5em;'><h2>${text}</h2></div>
            </div>
            <div class='config_actions'>
               <div id='${ids.option1}' class='btn btn-large config_submit'>${option1}</div>
               <div id='${ids.option2}' class='btn btn-large config_submit'>${option2}</div>
            </div>
         </div>
      `;
      gen.showConfigModal(html);

      return displayFx.idObj(ids);
   }

   gen.autoScheduleConfig = () => {
      let ids = {
         order: displayFx.uuid(),
         round: displayFx.uuid(),
      }
      let html = `
         <div class='flexccol'>
            <div class='flexcol' style='width: 100%'>
               <div class='flexcenter' style='margin: .5em;'><h2>${lang.tr('phrases.schedulepriority')}</h2></div>
            </div>
            <div class='config_actions'>
               <div id='${ids.order}' class='btn btn-large config_submit'>${lang.tr('ord')}</div>
               <div id='${ids.round}' class='btn btn-large config_submit'>${lang.tr('rnd')}</div>
            </div>
         </div>
      `;
      gen.showConfigModal(html);

      return displayFx.idObj(ids);
   }

   gen.dateConfig = () => {
      let ids = {
         cancel: displayFx.uuid(),
         submit: displayFx.uuid(),
         datepicker: displayFx.uuid(),
         picked: displayFx.uuid(),
      }
      let html = `
         <div class='flexccol'>
            <div id='${ids.datepicker}' style='margin: 1em;'></div>
            <div class='flexcenter'><input id='${ids.picked}' style='display: none;' class='rankingsdate'></div>
            <div class='config_actions'>
               <div id='${ids.cancel}' class='btn btn-small config_cancel'>${lang.tr('actions.cancel')}</div>
               <div id='${ids.submit}' class='btn btn-small config_submit'>${lang.tr('sbt')}</div>
            </div>
         </div>
      `;
      gen.showConfigModal(html);

      return displayFx.idObj(ids);
   }

   gen.rankLists = (categories, week, year) => {
      let ids = {
         container: displayFx.uuid(),
      }
      let rank_info = `
         <div class='flexrow flexcenter'>
            <div style='height: 100%'><div class='icon30'></div></div>
            <div style='height: 100%'><div class='icon30'></div></div>
            <div class='rank_info flexcenter'>${lang.tr('phrases.ranklists')} ${year} ${lang.tr('week')} ${week}</div>
            <div style='height: 100%'><div class='spreadsheet icon_spreadsheet icon30'></div></div>
            <div style='height: 100%'><div class='icon_json icon30'></div></div>
         </div>
      `;
      let tabdata = tabRankLists(categories, week, year);
      let tabs = jsTabs.generate(tabdata);
      let html = `
         <div id='${ids.container}' class='rank_container'>
            ${rank_info}${tabs}
         </div>
      `;
      selectDisplay(html, 'ranklists');
      let id_obj = displayFx.idObj(ids);
      jsTabs.load(id_obj.container.element);
      return id_obj;
   }

   function tabRankLists(categories, week, year) {
      let category_keys = Object.keys(categories).sort();
      let tabs = category_keys.map((category, i) => {
         let tab = category;
         let content = categoryRankList(category, categories[category], i);
         return { tab, content }
      });
      return tabs;
   }

   function categoryRankList(category, lists, i) {
      let gender_lists = Object.keys(lists).map(gender => rankList(category, gender, lists[gender]));
      let rank_lists = gender_lists.map(list => `<div class='rank_column'>${list}</div>`).join('');
      return `<div class='rank_columns'>${rank_lists}</div>`;
   }

   function rankList(category, gender, list) {
      // using the id this is possible: document.getElementById('GC12W').scrollIntoView()
      let html = `
         <div id='GC${category}${gender}' class='rank_column_heading flexrow flexcenter'>
            ${lang.tr(gender == 'M' ? 'genders.male' : gender == 'W' ? 'genders.female' : 'genders.mixed')}
            <div><div class='print action_icon_small ${gen.infoleft}' label='${lang.tr("print.ranklist")}' category='${category}' gender='${gender}'></div></div>
            <div><div class='category_csv icon_csv action_icon_small ${gen.info}' label='CSV' category='${category}' gender='${gender}'></div></div>
         </div>
      `;
      html += `
         <div class='rank_row rank_header'>
            <div class='rank'>${lang.tr('prnk')}</div>
            <div class='points'>${lang.tr('pts')}</div>
            <div class='year'>${lang.tr('yr')}</div>
            <div class='name'>${lang.tr('nm')}</div>
            <div class='category'>${lang.tr('cta')}</div>
         </div>
      `;
      let last_points;
      let last_ranking;
      list = list.filter(row => row.points.total);
      html += list.map((row, i) => {
         let ranking = (!last_points || +row.points.total < last_points) ? i + 1 : last_ranking;
         last_ranking = ranking;
         last_points = +row.points.total;

         return rankListRow(row, ranking);
      }).join('');
      return html;
   }

   function rankListRow(row, ranking) {
      let diff = '';
      let rdiff = row.priorrank ? (row.priorrank - ranking) : undefined;
      if (rdiff) {
         let cc = rdiff > 0 ? 'plus' : rdiff < 0 ? 'minus' : '';
         diff = `&nbsp;<span class='${cc}'>(${rdiff})</span>`;
      }
      let html = `
         <div puid='${row.puid}' class='rank_row player_rank'>
            <div class='rank'>${ranking}${diff}</div>
            <div class='points'>${row.points.total}</div>
            <div class='year'>${row.born}</div>
            <div class='name'>${row.name}</div>
            <div class='category'>${row.category}</div>
         </div>
      `;
      return html;
   }

   gen.displayPlayerRankChart = (container, data) => {
      if (!data) return;
      let sr = timeSeries().selector('#' + container.rankchart.id);
      sr.options({ margins: { left: 10, right: 10 }});
      sr.height(200).options({ invert: true });
      sr.data(data);
      sr();

      container.container.element.querySelector(".player_rankings").style.display = 'flex';
   }

   gen.playerSeason = (container, data, season_events) => {
      let playerSeason = ladderChart();
      playerSeason.colors({
         "H":        "#235dba",
         "C":        "#db3e3e",
         "G":        "#3ADF00",
         "R":        "#00FFFF",
         "unknown":  "#db3e3e",
      });
      playerSeason.options({
         plot: {
            shape: {
               dateKey:        'date',
               rungKey:        'rung',
               colorKey:       'surface',
               sizeKey:        'rank',
               shapeSizeBase:  3000,

               typeKey:        'category',
               typeRange:      ["triangle", "square", "pentagon", "circle", "star"],
               typeDomain:     ["12", "14", "16", "18", "S"]
            },
            content: {
              rows: ["R128","R64","R32","R16","QF","SF","F","W"]
            }
         }
      });
      playerSeason.events(season_events);
      d3.select(container.season.element).call(playerSeason);
      playerSeason.data(data).update();
   }

   gen.googleMap = (opts) => {
      let mapCanvas = document.getElementById(opts.id);
      let mapOptions = {
          center: new google.maps.LatLng(opts.lat, opts.long),
          zoom: 18,
          mapTypeId: google.maps.MapTypeId.HYBRID,
      };

      // are these necessary for 'click' to get lat/lng?
      // https://www.aspsnippets.com/Articles/Get-Latitude-and-Longitude-Location-Coordinates-using-Google-Maps-OnClick-event.aspx
      let infoWindow = new google.maps.InfoWindow();
      let latlngbounds = new google.maps.LatLngBounds();

      let map = new google.maps.Map(mapCanvas, mapOptions);
      gen.fx.setMap(map);

      // retrieve lat/lng from click event
      google.maps.event.addListener(gen.fx.env().locations.map, 'click', function (e) {
          alert("Latitude: " + e.latLng.lat() + "\r\nLongitude: " + e.latLng.lng());
      });

      // alternate way of doing it...
      // https://stackoverflow.com/questions/7905733/google-maps-api-3-get-coordinates-from-right-click
      // also has example of using infoWindow
      /*
      google.maps.event.addListener(gen.fx.env().locations.map, "rightclick", function(e) {
          let lat = e.latLng.lat();
          let lng = e.latLng.lng();
          alert("Lat=" + lat + "; Lng=" + lng);
      });
      */

      // add marker
      // https://developers.google.com/maps/documentation/javascript/examples/event-simple
      /*
      let marker = new google.maps.Marker({
          position: myLatlng,
          map: gen.fx.env().locations.map,
          title: 'Click to zoom'
      });

      map.addListener('center_changed', function() {
         // 3 seconds after the center of the map has changed, pan back to the marker
         window.setTimeout(function() {
            map.panTo(marker.getPosition());
         }, 3000);
      });

      marker.addListener('click', function() {
         map.setZoom(8);
         map.setCenter(marker.getPosition());
      });
      */

      // other interesting examples: how to overlay circle/polygon
      // https://stackoverflow.com/questions/19087352/capture-coordinates-in-google-map-on-user-click
   }

   gen.scheduleDetails = () => {
      let ids = {
         cancel: displayFx.uuid(),
         submit: displayFx.uuid(),
         umpirenotes: displayFx.uuid(),
         notice: displayFx.uuid(),
      }
      let html = `
         <div class='flexccol' style='width: 100%'>
            <h2>${lang.tr('phrases.oop_system')}</h2>
            <div class='flexcol reps' style='width: 100%'>
               <span>${lang.tr('schedule.notice')}</span>
               <textarea id='${ids.notice}' class='umpire_notes' wrap='soft' maxlength='180'></textarea>
            </div>
            <div class='flexcol reps' style='width: 100%'>
               <span>${lang.tr('schedule.umpirenotes')}</span>
               <textarea id='${ids.umpirenotes}' class='umpire_notes' wrap='soft' maxlength='180'></textarea>
            </div>
            <div class='config_actions'>
               <div id='${ids.cancel}' class='btn btn-large config_cancel'>${lang.tr('actions.cancel')}</div>
               <div id='${ids.submit}' class='btn btn-large config_submit'>${lang.tr('sbt')}</div>
            </div>
         </div>
      `;
      gen.showConfigModal(html);

      return displayFx.idObj(ids);
   }

   gen.selectNewPlayerIdentity = (player_data) => {
      let ids = {
         cancel: displayFx.uuid(),
         search: displayFx.uuid(),
      }
      let html = `
         <div class='flexccol' style='width: 100%'>
            <div class='flexcol reps' style='width: 100%'>
               <div class='flexcenter rtitle'>${lang.tr('idp')}</div>
               <div class='flexcenter'>${player_data.first_name} ${player_data.last_name}</div>
               <input id="${ids.search}" class="rinput" placeholder="${lang.tr('nm')}">
            </div>
            <div class='config_actions'>
               <div id='${ids.cancel}' class='btn btn-small config_cancel'>${lang.tr('actions.cancel')}</div>
            </div>
         </div>
      `;
      gen.showConfigModal(html, 'visible');

      return displayFx.idObj(ids);
   }

   gen.changePlayerIdentity = (clicked_player, new_player_data, confirmFx) => {
      if (typeof confirmFx != 'function') { confirmFx = () => console.log('player identity confirmFx error'); }
      let message = `
         <div style='display: grid; grid-template-columns: 200px 200px;'>
            <div style='display: grid'>
               <div style='font-weight: bold; text-decoration: underline;'>${lang.tr('existing')}</div>
               <div>${clicked_player.first_name}</div>
               <div>${clicked_player.last_name}</div>
               <div>${clicked_player.ioc || ''}</div>
               <div>${lang.tr('gdr')}: ${clicked_player.sex}</div>
               <div>${clicked_player.birth}</div>
            </div>
            <div style='display: grid'>
               <div style='font-weight: bold; text-decoration: underline;'>${lang.tr('new')}</div>
               <div>${new_player_data.first_name}</div>
               <div>${new_player_data.last_name}</div>
               <div>${new_player_data.ioc || ''}</div>
               <div>${lang.tr('gdr')}: ${new_player_data.sex}</div>
               <div>${new_player_data.birth}</div>
            </div>
         </div>
      `;
      gen.actionMessage({ message, actionFx: confirmFx, action: lang.tr('actions.ok'), cancelAction: () => gen.closeModal() });
   }

   gen.playerRepresentatives = () => {
      let ids = {
         cancel: displayFx.uuid(),
         submit: displayFx.uuid(),
         player_rep1: displayFx.uuid(),
         player_rep2: displayFx.uuid(),
      }
      let html = `
         <div class='flexccol' style='width: 100%'>
            <div class='flexcol reps' style='width: 100%'>
               <div class='flexcenter rtitle'>${lang.tr('draws.playerreps')}</div>
               <input id="${ids.player_rep1}" class='rinput' placeholder='${lang.tr("draws.playerrep")}'>
               <input id="${ids.player_rep2}" class='rinput' placeholder='${lang.tr("draws.playerrep")}'>
            </div>
            <div class='config_actions'>
               <div id='${ids.cancel}' class='btn btn-small config_cancel'>${lang.tr('actions.cancel')}</div>
               <div id='${ids.submit}' class='btn btn-small config_submit'>${lang.tr('sbt')}</div>
            </div>
         </div>
      `;
      gen.showConfigModal(html, 'visible');

      return displayFx.idObj(ids);
   }

   gen.umpirePicker = ({ tournament, callback }) => {

      let root = d3.select('body');
      root.select('#umpirepicker').remove();
      let backplane = root.append('div')
         .attr('id', 'umpirepicker')
         .attr('class', 'modal')

      let entry = floatingEntry().selector('#umpirepicker');

      let x = window.innerWidth * .4;
      let y = window.innerHeight * .4;
      entry(x, y, pickerHTML({ tournament }));

      backplane.select('.floating-entry').on('click', () => { d3.event.stopPropagation(); });
      backplane.on('click', returnValue);

      setTimeout(function() { document.body.style.overflow = 'hidden'; }, 200);

      function returnValue() { 
         if (typeof callback == 'function') callback(time.value);
         document.body.style.overflow  = null;
         backplane.remove(); 
      }
      function pickerHTML({ tournament }) {
         let umpires = tournament.umpires || [];
         let umpire_list = umpires.map(h=>`<li class='hour'>${util.zeroPad(h)}</li>`).join('');
         let html = `
               <span class="time-picker">
                  <input class="display-time" type="text" readonly="readonly" placeholder='HH:mm'>
                  <span class="clear-btn" style="display: flex;">×</span>
                  <div class="dropdown" style="display: flex;">
                     <div class="select-list">
                        <ul class="hours">
                           <li class="hint">HH</li>
                           ${hour_list}
                        </ul>
                        <ul class="minutes">
                           <li class="hint">mm</li> 
                           ${minute_list}
                        </ul>
                     </div>
                  </div>
               </span>
         `;
         return html;
      }
   }

   gen.timePicker = ({ value, time_string, hour_range, minute_increment, minutes, callback }) => {
      let hour = 0;
      let minute = 0;

      let root = d3.select('body');
      root.select('#timepicker').remove();
      let backplane = root.append('div')
         .attr('id', 'timepicker')
         .attr('class', 'modal')

      let entry = floatingEntry().selector('#timepicker');

      let x = window.innerWidth * .4;
      let y = window.innerHeight * .2;
      entry(x, y, pickerHTML({ hour_range, minute_increment, minutes }));
      let time = backplane.node().querySelector('.display-time');
      if (value) time.value = value;

      backplane.select('.floating-entry').on('click', () => { d3.event.stopPropagation(); });
      backplane.select('.clear-btn').on('click', () => { time.value = ""; });

      backplane.on('click', returnValue);
      time.addEventListener('keyup', evt => {
         var semis = 0;
         evt.target.value = evt.target.value.split('').filter(v=> {
            if (v == ':') semis += 1;
            return !isNaN(v) || ( v == ':' && semis == 1)
         }).join('');
         if (evt.which == 13) returnValue();
      });

      util.addEventToClass('hour', setHour);
      util.addEventToClass('minute', setMinute);

      if (time_string) {
         let time_parts = time_string.split(':');
         hour = time_parts[0];
         minute = time_parts[1];
         setTime();
      }

      setTimeout(function() { document.body.style.overflow = 'hidden'; }, 200);

      function setHour(ev) {
         hour = ev.target.innerText;
         setTime();
      }
      function setMinute(ev) {
         minute = ev.target.innerText;
         setTime();
      }
      function setTime() { time.value = `${parseInt(hour)}:${util.zeroPad(minute)}`; }
      function returnValue() { 
         if (typeof callback == 'function') callback(time.value);
         document.body.style.overflow  = null;
         backplane.remove(); 
      }
      function pickerHTML({ hour, minute, hour_range = {}, minute_increment, minutes } = {}) {
         let hour_list = util.range(hour_range.start || 0, (hour_range.end || 23) + 1)
            .map(h=>`<li class='hour'>${util.zeroPad(h)}</li>`).join('');
         let minute_end = Math.abs(60 / (minute_increment || 1));
         minutes = minutes || util.range(0, minute_end).map((m, i)=>i*(minute_increment || 1));
         let minute_list = minutes
            .map(m=>`<li class='minute'>${util.zeroPad(m)}</li>`).join('');
         let html = `
               <span class="time-picker">
                  <input class="display-time" type="text" placeholder='HH:mm'>
                  <span class="clear-btn" style="display: flex;">×</span>
                  <div class="dropdown" style="display: flex;">
                     <div class="select-list">
                        <ul class="hours">
                           <li class="hint">HH</li>
                           ${hour_list}
                        </ul>
                        <ul class="minutes">
                           <li class="hint">mm</li> 
                           ${minute_list}
                        </ul>
                     </div>
                  </div>
               </span>
         `;
         return html;
      }
   }

   gen.displayClub = (club, tabdata = []) => {
      let ids = {
         container: displayFx.uuid(),
         map: displayFx.uuid(),
         tabs: displayFx.uuid(),
         name: displayFx.uuid(),
         code: displayFx.uuid(),
         edit: displayFx.uuid(),
         players: displayFx.uuid(),
         ranks: displayFx.uuid(),
      }
      let gps = club.lat && club.long && navigator.onLine;

      let webaddress = !club.website ? '' : club.website;
      if (webaddress && webaddress.substring(0, 4) != 'http') webaddress = `http://${webaddress}`;
      let website = !webaddress ? '' : `
         <a href='${webaddress}' target='_blank'>
            <div class='link'><img src='./icons/link.png' class='club_link'></div>
         </a>
      `;
      let info = `
         <div class='clubinfo'>
            <div class='header'>
               <div class='nameblock'>
                  <span class='inputwrapper'>
                     <input id="${ids.name}" class='clubname' spellcheck="false" tabindex="1" onfocus="this.setSelectionRange(0, this.value.length)" autocomplete="off">
                  </span>
                  [
                  <span class='inputwrapper'>
                     <input id="${ids.code}" class='clubcode' spellcheck="false" tabindex="1" onfocus="this.setSelectionRange(0, this.value.length)" autocomplete="off">
                  </span>
                  ]
                  <div style='margin-left: 1em;'>${website}</div>
               </div>
               <div class='nameblock'>
                  <div id='${ids.players}' class='listlink'><img src='./icons/players.png' class='club_link'></div>
                  <div id='${ids.ranks}' class='listlink'><img src='./icons/rank.png' class='club_link'></div>
               </div>
               <div>
                  <div id='${ids.edit}' class='link'><img src='./icons/edit.png' class='club_link'></div>
               <div>
            </div>
         </div>
      `;

      let html = `
         <div id='${ids.container}' style='width: 100%'>
            <div class='flexrow' style='align-items: stretch; align-content: stretch; height: 100%;'>
               ${info}
            </div>
            <div id='${ids.tabs}'></div>
         </div>
     `;
      selectDisplay(html, 'club');
      let id_obj = displayFx.idObj(ids);

      id_obj.name.element.value = club.name;
      setWidth(id_obj.name.element, 2);
      id_obj.name.element.disabled=true;
      id_obj.code.element.value = club.code;
      setWidth(id_obj.code.element, 2);
      id_obj.code.element.disabled=true;

      id_obj.name.element.addEventListener("keyup", function(e) {  setWidth(e.target, 5); });
      id_obj.code.element.addEventListener("keyup", function(e) {  setWidth(e.target, 5); });

      if (gps) {
         let map_style = 'width: 100%; height: 100%; min-width: 350px; min-height: 350px;';
         tabdata.unshift({ tab: 'Map', content: `<div id='${ids.map}' style='${map_style}'></div>` });
      }

      // these can be passed as arguments
      tabdata.push({ tab: 'Players', content: `<div>Table of players in club</div>` });
      tabdata.push({ tab: 'Rankings', content: `<div>Table of Ranked club players</div>` });

      if (tabdata) {
         id_obj.tabs.element.innerHTML = jsTabs.generate(tabdata);
         jsTabs.load(id_obj.tabs.element);
      }

      if (gps) {
         if (gen.fx.env().locations.map_provider == 'google') {
            let opts = {
               id: id_obj.map.id,
               lat: +club.lat,
               long: +club.long,
            }
            gen.googleMap(opts);
         } 

         if (gen.fx.env().locations.map_provider == 'leaflet') {
            // some ideas: https://leanpub.com/leaflet-tips-and-tricks/read

            let mapLink = '<a href="http://openstreetmap.org">OpenStreetMap</a>';
            let layer = L.tileLayer(
               'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                  attribution: '&copy; ' + mapLink + ' Contributors',
                  maxZoom: 18,
               });
            let Esri_WorldImagery = L.tileLayer('http://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
               attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
            });
            // let map = L.map(id_obj.map.id).setView([+club.lat, +club.long], 16).addLayer(layer); // street map
            let map = L.map(id_obj.map.id).setView([+club.lat, +club.long], 16).addLayer(Esri_WorldImagery); // satellite imagery
            gen.fx.setMap(ap);

            let marker = L.marker([+club.lat, +club.long]).addTo(gen.fx.env().locations.map);

            // gen.fx.env().locations.map.on('click', function(e) { alert(e.latlng.lat); });
            // http://leafletjs.com/reference.html#events
            map.on('click', function(e) { alert(e.latlng); });

            // alternate: 
            // http://plnkr.co/edit/9vm81YsQxnkAFs35N8Jo?p=preview
            map.on("contextmenu", function (event) {
              console.log("Coordinates: " + event.latlng.toString());
              L.marker(event.latlng).addTo(gen.fx.env().locations.map);
            });
         }
      }

      return id_obj;
   }

   gen.toggleInput = toggleInput;
   function toggleInput(elem) {
      let padding = elem.disabled ? 5 : 2;
      setWidth(elem, padding);
      elem.disabled = !elem.disabled;
   }

   gen.escapeModal = escapeModal;
   function escapeModal(callback, which) {
      setTimeout(function() {
         gen.escapeFx = () => {
            gen.closeModal(which);
            gen.escapeFx = undefined;
            if (typeof callback == 'function') callback();
         }
      }, 300);
   }

   function getRanks(tournament) {
      let tournament_date = tournament && (tournament.points_date || tournament.end);
      let calc_date = tournament_date ? new Date(tournament_date) : new Date();
      let points_table = gen.fx.pointsTable({calc_date});
      let rankings = [{key: '-', value: ''}];
      return !points_table.rankings ? rankings : rankings.concat(...Object.keys(points_table.rankings).map(r => ({ key: r, value: r })));
   }

   function getCategories(tournament) {
      let tournament_date = tournament && (tournament.points_date || tournament.end);
      let calc_date = tournament_date ? new Date(tournament_date) : new Date();
      let points_table = gen.fx.pointsTable({calc_date});
      let categories = [{key: '-', value: ''}];
      return !points_table.categories ? categories : categories
         .concat(...Object.keys(points_table.categories)
         .map(r => ({ key: r, value: r })));
         // .map(r => ({ key: staging.legacyCategory(r, true), value: r })));
   }

   function getGenders() {
      return [
         {key: `${lang.tr("genders.male")}`, value: 'M'},
         {key: `${lang.tr("genders.female")}`, value: 'W'},
      ];

   }

   gen.dateSelector = ({ date, date_element, dateFx, container }) => {
      if (!date_element) return;

      date = new Date(date || new Date());
      var datePicker = new Pikaday({
         field: date_element,
         defaultDate: date,
         setDefaultDate: true,
         i18n: lang.obj('i18n'),
         firstDay: gen.fx.env().calendar.first_day,
         onSelect: function() { 
            let this_date = this.getDate();
            date = new Date(util.dateUTC(this_date));
            this.setStartRange(new Date(date));
            if (dateFx && typeof dateFx == 'function') dateFx(date);
         },
         bound: false,
         container,
      });
      datePicker.setStartRange(new Date(date));

      return datePicker;
   }

   gen.dateRange = ({ start, start_element, startFx, end, end_element, endFx }) => {
      if (!start_element || !end_element) return;

      start = new Date(start || new Date());
      end = new Date(end || new Date());

      var startPicker = new Pikaday({
         field: start_element,
         defaultDate: start,
         setDefaultDate: true,
         i18n: lang.obj('i18n'),
         firstDay: gen.fx.env().calendar.first_day,
         onSelect: function() { 
            let this_date = this.getDate();
            start = new Date(util.dateUTC(this_date));
            updateStartDate();
            if (end < start) {
               endPicker.gotoYear(start.getFullYear());
               endPicker.gotoMonth(start.getMonth());
            }
         },
      });
      startPicker.setStartRange(new Date(start));
      if (end) startPicker.setEndRange(new Date(end));

      var endPicker = new Pikaday({
         field: end_element,
         i18n: lang.obj('i18n'),
         firstDay: gen.fx.env().calendar.first_day,
         defaultDate: end,
         setDefaultDate: true,
         onSelect: function() {
            let this_date = this.getDate();
            end = new Date(util.dateUTC(this_date));
            updateEndDate();
            if (end < start) {
               startPicker.gotoYear(end.getFullYear());
               startPicker.gotoMonth(end.getMonth());
            }
         },
      });
      endPicker.setStartRange(new Date(start));
      endPicker.setMinDate(new Date(start));
      if (end) endPicker.setEndRange(new Date(end));

      function updateStartDate() {
         startPicker.setStartRange(new Date(start));
         endPicker.setStartRange(new Date(start));
         endPicker.setMinDate(new Date(start));
         if (startFx && typeof startFx == 'function') startFx(start);
      };
      function updateEndDate() {
         startPicker.setEndRange(new Date(end));
         startPicker.setMaxDate(new Date(end));
         endPicker.setEndRange(new Date(end));
         if (endFx && typeof endFx == 'function') endFx(end);
      };
   }

   function matchPenalties(players, puid, muid) {
      let penalty_players = !players ? [] : players.filter(p=>p.penalties && p.penalties.length);
      let match_penalties = penalty_players.filter(p=>p.penalties.filter(f=>f.muid == muid).length);
      return match_penalties.filter(p=>p.puid == puid).length;
   }

   return gen;
 
}();
