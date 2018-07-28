import { db } from './db'
import { UUID } from './UUID';
import { util } from './util';
import { coms } from './coms';
import { dd } from './dropdown';
import { fetchFx } from './fetchFx';
import { lang } from './translator';
import { matchFx } from './matchFx';
import { courtFx } from './courtFx';
import { staging } from './staging';
import { pointsFx } from './pointsFx';
import { playerFx } from './playerFx';
import { exportFx } from './exportFx';
import { importFx } from './importFx';
import { rankCalc } from './rankCalc';
import { publishFx } from './publishFx';
import { displayFx } from './displayFx';
import { searchBox } from './searchBox';
import { displayGen } from './displayGen';
import { calendarFx } from './calendarFx';
import { scheduleFx } from './scheduleFx';
import { scoreBoard } from './scoreBoard';
import { contextMenu } from './contextMenu';
import { tournamentFx } from './tournamentFx';
import { rrDraw, treeDraw, drawFx } from './drawFx';

// TODO: remove use of tournament.sid

export const tournamentDisplay = function() {
   let fx = {};
   let ccTime = 0;         // contextClick time; used to prevent Safari event propagation to click
   let mfx = matchFx;
   let sfx = scheduleFx;
   let tfx = tournamentFx;

   let o = {
      sign_in: { rapid: true, },
      byes_with_byes: true,
      byes_with_unseeded: true,
      focus: { place_player: undefined },
   }

   fx.fx = {
      env: () => { console.log('environment request'); return {}; },
      pointsTable: () => console.log('points table'),
      setCalendar: () => console.log('set calendar'),
      orgCategoryOptions: () => console.log('org category options'),
      orgCategories: () => console.log('org categories'),
      orgRankingOptions: () => console.log('org ranking options'),
   }

   function acknowledgeBroadcast(ack) {
      console.log('acknowledgement:', ack);
   }

   fx.drawOptions = ({draw}) => {
      let type = draw.options().bracket ? 'rr_draw' : 'tree_draw';
      if (fx.fx.env().draws[type]) draw.options(fx.fx.env().draws[type]);
   }

   let dfx = drawFx();
   db.addDev({dfx});
   fx.settingsLoaded = (env) => {
      dfx.options(env.drawFx);
      scoreBoard.options(env.scoreboard.options);
      scoreBoard.settings(env.scoreboard.settings);
   }

   fx.options = (values) => {
      if (!values) return o;
      util.keyWalk(values, o);
   }

   // manage draw objects and resize events
   let draws_context = {};
   fx.reset = () => { draws_context = {}; }

   function catchTab(evt) { if (evt.which == 9) { evt.preventDefault(); } }

   function resizeDraw(draw_object) {
      let draw = draw_object.draw;
      if (!draw || !draw.selector()) return;

      if (draw_object.type == 'tree') {
         if (draw.data() && Object.keys(draw.data()).length) {
            let draw_width = +d3.select('#main').style('width').match(/\d+/)[0] * .9;
            let draw_node = d3.select(draw.selector()).node();
            if (draw_node) {
               draw.options({ width: draw_width })();
            }
         }
      } else if (draw_object.type == 'roundrobin') {
         let brackets = draw.data().brackets;
         if (brackets && brackets.length) draw();
      }
   }

   function resizeDraws(context) {
      resizeDraw({ draw: draws_context[context].tree, type: 'tree' });
      resizeDraw({ draw: draws_context[context].roundrobin, type: 'roundrobin' });
   }

   (function() {
       var throttle = function(type, name, obj) {
           obj = obj || window;
           var running = false;
           var func = function() {
               if (running) { return; }
               running = true;
                requestAnimationFrame(function() {
                   obj.dispatchEvent(new CustomEvent(name));
                   running = false;
               });
           };
           obj.addEventListener(type, func);
       };

       /* init - you can init any event */
       throttle("resize", "optimizedResize");
   })();

   window.addEventListener("optimizedResize", function() { Object.keys(draws_context).forEach(resizeDraws); }, false);

   // END SCOPING TODO

   let unique = (arr) => arr.filter((item, i, s) => s.lastIndexOf(item) == i);
   let teamHash = (team) => team.map(p=>p.id).join('|');

   fx.displayCalendar = displayCalendar;
   function displayCalendar() {
      let category = fx.fx.env().calendar.category;
      let month_start = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();

      let start = fx.fx.env().calendar.start || util.dateUTC(new Date());
      let end = fx.fx.env().calendar.end || new Date(start).setMonth(new Date(start).getMonth()+1);

      let calendar_container = displayGen.calendarContainer();

      function updateStartDate() {
         fx.fx.setCalendar({start});
         startPicker.setStartRange(new Date(start));
         endPicker.setStartRange(new Date(start));
         endPicker.setMinDate(new Date(start));
      };
      function updateEndDate() {
         fx.fx.setCalendar({end});
         startPicker.setEndRange(new Date(end));
         startPicker.setMaxDate(new Date(end));
         endPicker.setEndRange(new Date(end));
      };

      var startPicker = new Pikaday({
         field: calendar_container.start.element,
         i18n: lang.obj('i18n'),
         defaultDate: new Date(start),
         setDefaultDate: true,
         firstDay: fx.fx.env().calendar.first_day,
         onSelect: function() {
            start = this.getDate().getTime();
            updateStartDate();
            generateCalendar({ start, end, category });
         },
      });

      var endPicker = new Pikaday({
         field: calendar_container.end.element,
         i18n: lang.obj('i18n'),
         minDate: new Date(start),
         defaultDate: new Date(end),
         setDefaultDate: true,
         firstDay: fx.fx.env().calendar.first_day,
         onSelect: function() {
            end = this.getDate().getTime();
            updateEndDate();
            generateCalendar({ start, end, category });
         },
      });

      updateStartDate();
      updateEndDate();

      let genCal = (value) => {
         category = value;
         fx.fx.setCalendar({category});
         generateCalendar({ start, end, category });
      }
      calendar_container.category.ddlb = new dd.DropDown({ element: calendar_container.category.element, onChange: genCal });
      calendar_container.category.ddlb.selectionBackground('white');
      category = staging.legacyCategory(category);

      calendar_container.add.element.addEventListener('click', () => {
         createNewTournament({ title: lang.tr('tournaments.new'), callback: modifyTournament })
      });

      calendar_container.add.element.addEventListener('contextmenu', () => fetchFx.fetchTournament());

      function modifyTournament(tournament) {
         if (!tournament || !Object.keys(tournament).length) return;

         tournament.log = [];
         if (!tournament.tuid) tournament.tuid = UUID.new();
         tournament.end = new Date(tournament.end).getTime();
         tournament.start = new Date(tournament.start).getTime();

         function refresh() { generateCalendar({start, end, category}); }
         db.addTournament(tournament).then(refresh, console.log);
      }

      generateCalendar({ start, end, category });

      function generateCalendar({ start, end, category }) {
         // increment end by one day so that "between" function in db.js
         // captures tournaments that end on the selected end date...
         end += 86400000;

         db.findTournamentsBetween(start, end).then(displayTournyCal, util.logError);

         function displayTournyCal(tournaments) {
            var categories = util.unique(tournaments.map(t => t.category)).sort();
            var options = [{ key: '-', value: '' }].concat(...categories.map(c => ({ key: staging.legacyCategory(c, true), value: c })));
            calendar_container.category.ddlb.setOptions(options);
            calendar_container.category.ddlb.setValue(category || '', 'white');

            function filterCategory(cat) { return cat == staging.legacyCategory(category) || cat == staging.legacyCategory(category, true); }
            if (category) tournaments = tournaments.filter(t => filterCategory(t.category));
            tournaments = tournaments.filter(t => t.end <= end);

            displayGen.calendarRows(calendar_container.rows.element, tournaments);

            function dt(evt) { return displayTournament({tuid: util.getParent(evt.target, 'calendar_click').getAttribute('tuid')}); }
            function tournamentContextOptions(evt) {
               var mouse = { x: evt.clientX, y: evt.clientY }
               var tuid = util.getParent(evt.target, 'calendar_click').getAttribute('tuid');
               db.findTournament(tuid).then(checkOptions, util.logError);
               function checkOptions(tournament_data) { db.findSetting('fetchTournament').then(fetch => options(fetch, tournament_data)); }

               function options(fetch, tournament_data) {
                  var options = [];
                  options.push({ label: lang.tr('tournaments.edit'), key: 'edit' });
                  options.push({ label: lang.tr('delete'), key: 'delete' });
                  if (fetch) options.push({ label: lang.tr('merge'), key: 'merge' });
                  displayGen.svgModal({ x: mouse.x, y: mouse.y, options, callback: selectionMade });

                  function selectionMade(choice, index) {
                     if (choice.key == 'edit') {
                        return createNewTournament({ tournament_data, title: lang.tr('actions.edit_tournament'), callback: modifyTournament })
                     } else if (choice.key == 'delete') {
                        var caption = `<p>${lang.tr('actions.delete_tournament')}:</p> <p>${tournament_data.name}</p>`;
                        displayGen.okCancelMessage(caption, deleteTournament, () => displayGen.closeModal());
                        function deleteTournament() {
                           unpublishTournament(tuid);
                           db.deleteTournament(tuid).then(() => fx.displayCalendar(), util.logError);
                           displayGen.closeModal();
                        }
                     } else if (choice.key == 'merge') {
                        fetchFx.fetchTournament(tuid, mouse, modifyTournament);
                     }
                  }

                  function unpublishTournament(tuid) {
                     let org = fx.fx.env().org;
                     let ouid = (org && org.ouid) || (tournament_data && tournament_data.org && tournament_data.org.ouid);
                     if (!ouid) return;

                     let deleteTournamentEvents = { tuid, ouid, delete_tournament: true };
                     coms.emitTmx({ deleteTournamentEvents })
                     displayGen.closeModal();
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
            Array.from(calendar_container.container.element.querySelectorAll('.calendar_click')).forEach(elem => {
               elem.addEventListener('click', dt);
               elem.addEventListener('contextmenu', tournamentContextOptions);
            });
         }
      }
   }

   fx.displayTournament = displayTournament;
   function displayTournament({tuid, selected_tab, editing} = {}) {
      tuid = tuid || searchBox.active.tournament && searchBox.active.tournament.tuid;
      db.findTournament(tuid).then(tournament => {
         db.findTournamentMatches(tuid).then(matches => go(tournament, matches));
      });

      function go(tournament, dbmatches) {
         if (!tournament) return;
         if (displayGen.inExisting(['identify', 'tournament'])) importFx.reset();
         let rankings = {
            sgl_rank: tournament.rank,
            dbl_rank: tournament.rank,
         }
         if (tournament.accepted) Object.assign(rankings, tournament.accepted);
         displayGen.escapeModal();
         createTournamentContainer({tournament, dbmatches, selected_tab, display_points: true, editing});
      }
   }

   function getTournamentOptions(tournament) {
      var category = staging.legacyCategory(tournament.category);

      var opts = tournament.rank_opts || { category, sgl_rank: tournament.rank, dbl_rank: tournament.rank };

      if (tournament.accepted) {
         if (tournament.accepted.M) {
            opts.category = staging.legacyCategory(tournament.accepted.M.category);
            opts.sgl_rank = tournament.accepted.M.sgl_rank;
            opts.dbl_rank = tournament.accepted.M.dbl_rank;
            opts.M = tournament.accepted.M;
         }
         if (tournament.accepted.W) {
            opts.w_category = staging.legacyCategory(tournament.accepted.W.category);
            opts.w_sgl_rank = tournament.accepted.W.sgl_rank;
            opts.w_dbl_rank = tournament.accepted.W.dbl_rank;
            opts.W = tournament.accepted.W;
         }
      }

      return opts;
   }

   function tournamentOpts(opts = {}, container) {
      let numberValue = (val) => !val || isNaN(val) ? 0 : parseInt(val);

      let ddlb = util.intersection(Object.keys(container), ['category', 'dbl_rank', 'sgl_rank']).length == 3;
      if (!ddlb) {
         console.log('missing ddlb');
         return opts;
      }

      if (Object.keys(opts).length) {
         container.category.ddlb.setValue(opts.category, 'white');
         container.dbl_rank.ddlb.setValue(opts.dbl_rank, 'white');
         container.sgl_rank.ddlb.setValue(opts.sgl_rank, 'white');

         if (opts.W) {
            if (container.w_category.ddlb && opts.W.category) container.w_category.ddlb.setValue(opts.W.category, 'white');
            if (container.w_category.ddlb && opts.W.sgl_rank) container.w_sgl_rank.ddlb.setValue(opts.W.sgl_rank, 'white');
            if (container.w_category.ddlb && opts.W.dbl_rank) container.w_dbl_rank.ddlb.setValue(opts.W.dbl_rank, 'white');
         }
      } else {
         opts = {
            category: container.category.ddlb.getValue(),
            dbl_rank: container.dbl_rank.ddlb.getValue(),
            sgl_rank: container.sgl_rank.ddlb.getValue(),
         }

         // if both genders are present
         if (container.w_category.ddlb) opts['W'] = { category: container.w_category.ddlb.getValue() };
         if (container.w_dbl_rank.ddlb) opts['W'].dbl_rank = container.w_dbl_rank.ddlb.getValue();
         if (container.w_sgl_rank.ddlb) opts['W'].sgl_rank = container.w_sgl_rank.ddlb.getValue();
         if (opts.W) opts.M = { category: opts.category, sgl_rank: opts.sgl_rank, dbl_rank: opts.dbl_rank }
      }
      return opts;
   }

   function createTournamentContainer({tournament, dbmatches, selected_tab, display_points = false, editing}) {

      // START setup
      let state = {
         // edit: false,
         edit: editing,
         manual_ranking: false,
      }

      // keep track of which event and draw are active
      let displayed_event = null;
      let displayed_draw_event = null;
      let displayed_schedule_day = null;

      // keep track of which tab is open
      let current_tab = null;
      let event_config = null;
      let filters = [];

      // TODO: this is only important here for the legacy DDLB for setting tournament rankings
      //       => it can be removed once the legacy DDLB are removed
      tournamentGenders(tournament, dbmatches);

      let { groups: match_groups, group_draws } = groupMatches(dbmatches);
      let { container, classes, displayTab, display_context, tab_ref } = displayGen.tournamentContainer({ tournament, tabCallback });

      db.addDev({tournament});

      container.edit.element.style.display = sameOrg(tournament) && !tournament.delegated ? 'inline' : 'none';
      if (tournament.delegated && sameOrg(tournament)) displayGen.delegated(container, true);

      // create and initialize draw objects
      let rr_draw = rrDraw();
      let tree_draw = treeDraw().dfxOptions(fx.fx.env().drawFx);

      draws_context[display_context] = { roundrobin: rr_draw, tree: tree_draw };

      tree_draw.options({ addByes: false, cleanup: true });
      tree_draw.options({ sizeToFit: false, });
      tree_draw.options({ minWidth: 400, minHeight: 100 });
      tree_draw.options({ flags: { path: fx.fx.env().assets.flags }});
      tree_draw.events({'player1': { 'click': d => playerClick(d, 0) }});
      tree_draw.events({'player2': { 'click': d => playerClick(d, 1) }});

      tree_draw.options({
         minPlayerHeight: 30,
         details: { club_codes: true, draw_positions: true, player_rankings: true, player_ratings: true, draw_entry: true, seeding: true },
      });

      rr_draw.options({ min_width: 300 });
      // end draw object creation/initialization

      function deleteMatch(muid) {
         dbmatches = dbmatches.filter(m=>m.muid != muid);
         db.deleteMatch(muid);
      }

      editAction();
      tree_draw.selector(container.draws.element);

      util.addEventToClass(classes.auto_draw, toggleAutoDraw);
      util.addEventToClass(classes.gem_seeding, toggleGemSeeding);
      util.addEventToClass(classes.player_filter, togglePlayerFilter);

      attachFilterToggles(classes, updateFilters);
      util.addEventToClass(classes.ranking_order, () => enableManualRankings());
      util.addEventToClass(classes.refresh_registrations, () => updateRegisteredPlayers(true, true));
      util.addEventToClass(classes.refresh_registrations, () => replaceRegisteredPlayers(true, true), undefined, 'contextmenu');

      // set up printing events
      util.addEventToClass(classes.print_sign_in, printSignInList);
      util.addEventToClass(classes.print_draw, printDraw);
      util.addEventToClass(classes.print_draw, () => console.log('context menu print'), document, 'contextmenu');

      util.addEventToClass(classes.print_schedule, printSchedule);
      util.addEventToClass(classes.schedule_matches, scheduleMatches);
      function scheduleMatches() {
         let scheduling_height = '40em';
         let schedule_grid = container.container.element.querySelector('.schedule_sheet');
         let scheduling_active = schedule_grid.style.maxHeight == scheduling_height;

         schedule_grid.style.maxHeight = scheduling_active ? '' : scheduling_height;
         container.scheduling.element.style.display = scheduling_active ? 'none' : 'flex';

         let schedule_matches = document.querySelector(`.${classes.schedule_matches}`);
         schedule_matches.querySelector('div').classList.toggle('matches_header_inactive');
         schedule_matches.querySelector('div').classList.toggle('matches_header');
      }

      util.addEventToClass(classes.schedule_details, scheduleDetails);
      function scheduleDetails() {
         displayGen.escapeModal();
         var modal = displayGen.scheduleDetails();
         modal.submit.element.addEventListener('click', () => submitDetails());
         modal.cancel.element.addEventListener('click', () => displayGen.closeModal());

         var existing_notes = tournament.schedule && tournament.schedule.umpirenotes || '';
         var existing_notice = tournament.schedule && tournament.schedule.notice || '';
         if (displayed_schedule_day && tournament.schedule.notes && tournament.schedule.notes[displayed_schedule_day]) {
            existing_notes = tournament.schedule.notes[displayed_schedule_day];
         }
         if (displayed_schedule_day && tournament.schedule.notices && tournament.schedule.notices[displayed_schedule_day]) {
            existing_notice = tournament.schedule.notices[displayed_schedule_day];
         }

         modal.notice.element.value = existing_notice;
         modal.umpirenotes.element.value = existing_notes;
         modal.umpirenotes.element.focus();

         modal.umpirenotes.element.addEventListener('keydown', catchTab , false);

         function submitDetails() {
            if (!tournament.schedule) tournament.schedule = {};

            tournament.schedule.umpirenotes = modal.umpirenotes.element.value;

            if (!tournament.schedule.notices) tournament.schedule.notices = {};
            if (!tournament.schedule.notes) tournament.schedule.notes = {};
            if (displayed_schedule_day) {
               tournament.schedule.notices[displayed_schedule_day] = modal.notice.element.value;
               tournament.schedule.notes[displayed_schedule_day] = modal.umpirenotes.element.value;
            }

            if (tournament.schedule.umpirenotes != existing_notes) tournament.schedule.up_to_date = false;
            let elem = container.schedule_tab.element.querySelector('.' + classes.schedule_details).querySelector('div');
            displayGen.scheduleDetailsState(elem, tournament.schedule);
            schedulePublishState();
            saveTournament(tournament);
            displayGen.closeModal();
         }
      }

      util.addEventToClass(classes.publish_schedule, unPublishSchedule, undefined, 'contextmenu');
      function unPublishSchedule() {
         if (!state.edit || !tournament.schedule || !tournament.schedule.published) return;
         displayGen.okCancelMessage(lang.tr('schedule.unpublish'), () => unPublishOOP(tournament), () => displayGen.closeModal());
      }

      function unPublishOOP(tournament) {
         let org = fx.fx.env().org;
         let ouid = org && org.ouid;
         if (!ouid || !tournament.tuid) return;

         coms.emitTmx({ deleteOOP: { tuid: tournament.tuid, ouid } });
         displayGen.closeModal();

         coms.requestAcknowledgement({ uuid: `oop:${tournament.tuid}`, callback: changePublishState });

         function changePublishState() {
            if (!tournament.schedule) tournament.schedule = {};
            tournament.schedule.published = false
            tournament.schedule.up_to_date = false;
            saveTournament(tournament);
            schedulePublishState();
            scheduleActions();
         }
      }

      util.addEventToClass(classes.publish_schedule, publishSchedule);
      /**
       * @param   {boolean}   update_time    whether or not to update the schedule publish time
       */
      function publishSchedule(update_time=true) {
         if (fx.fx.env().publishing.require_confirmation) {
            displayGen.okCancelMessage(lang.tr('draws.publish') + '?', pubSched, () => displayGen.closeModal());
         } else {
            pubSched();
         }

         function pubSched() {
            var schedule = sfx.generateSchedule(tournament);

            if (schedule) {
               let updatePublishState = () => {
                  tournament.schedule.published = update_time ? new Date().getTime() : (tournament.schedule.published || new Date().getTime());
                  tournament.schedule.up_to_date = true;
                  schedulePublishState();
                  saveTournament(tournament);
               }
               coms.requestAcknowledgement({ uuid: tournament.tuid, callback: updatePublishState });
               coms.emitTmx({ tournamentOOP: schedule });
               displayGen.closeModal();

               // check whether there are published events
               // forced publishing of all events every time schedule published...
               /*
               var published_events = tournament.events.reduce((p, c) => c.published || p, false);
               if (published_events) {
                  var scheduled = mfx.scheduledMatches(tournament).scheduled;
                  scheduled
                     .reduce((p, c) => util.isMember(p, c.event.euid) ? p : p.concat(c.event.euid), [])
                     .forEach(euid => {
                        let evt = tfx.findEventByID(tournament, euid);
                        broadcastEvent(tournament, evt)
                        if (evt.euid == displayed_draw_event.euid) {
                           displayGen.drawBroadcastState(container.publish_state.element, evt);
                        }
                     });
               }
               */
            } else {
               return unPublishOOP(tournament);
            }
         }
      }

      container.penalty_report.element.addEventListener('click', () => {
         var penalties = [].concat(...penaltyPlayers().map(playerPenalties));
         if (penalties) displayGen.tournamentPenalties(tournament, penalties, saveFx);
         function saveFx() {
            penaltyReportIcon();
            saveTournament(tournament);
         }
         function playerPenalties(p) { return p.penalties.map((pe, ppi)=>Object.assign({}, pe, { ppi, player: { full_name: p.full_name, puid: p.puid, id: p.id }})); }
      });

      container.delegate.element.addEventListener('click', () => {
         if (!window.navigator.onLine && location.hostname != 'localhost') {
            return displayGen.okCancelMessage(lang.tr('phrases.noconnection'), ()=>displayGen.closeModal('processing'));
         }
         displayGen.escapeModal(undefined, 'processing');
         if (tournament.delegated) {
            displayGen.okCancelMessage(lang.tr('phrases.revokedelegation'), revoke, () => displayGen.closeModal('processing'));
         } else {
            displayGen.okCancelMessage(lang.tr('phrases.delegate2mobile'), delegate, () => displayGen.closeModal('processing'));
         }

         function revoke() {
            coms.revoked = (result) => {
               if (!result.revoked) {
                  displayGen.okCancelMessage(lang.tr('tournaments.noauth'), cleanUp);
               }
               coms.revoked = undefined;
            }
            let revokeDelegation = { 
               key_uuid: tournament.delegated,
               "tuid": tournament.tuid
            }
            coms.emitTmx({ revokeDelegation });
            tournament.delegated = false;
            activateEdit();
            displayGen.closeModal('processing');
            finish();
         }

         function cleanUp() {
            document.body.style.overflow  = null;
            displayGen.closeModal('processing')
         }

         function finish() {
            displayGen.delegated(container, tournament.delegated);
            saveTournament(tournament);
         }

         function delegate() {
            let key_uuid = UUID.generate();

            // set function in coms as 'callback'
            coms.delegated = (result) => {
               if (!result.keyset) {
                  let msg = displayGen.okCancelMessage(lang.tr('tournaments.noauth'), () => displayGen.closeModal('processing'));
               } else {
                  tournament.delegated = key_uuid;
                  deactivateEdit();

                  let devel = location.pathname.indexOf('devel') >= 0;
                  let plusplus = location.pathname.indexOf('++') >= 0;
                  let message = `${location.origin}${devel ? '/devel' : ''}/Ref${plusplus ? '++' : ''}/?actionKey=${key_uuid}`;
                  console.log(message);
                  finish();

                  displayGen.escapeFx = undefined;
                  let ctext = `
                     <p id='msg'>${lang.tr('phrases.scanQRcode')}</p>
                     <canvas id='qr'></canvas>
                     `;
                  let msg = displayGen.okCancelMessage(ctext, cleanUp);
                  genQUR(message);
               }
               coms.delegated = undefined;
            };

            tournament.pushed2cloud = new Date().getTime();
            tournament.org = fx.fx.env().org;
            let delegationKey = {
               key_uuid,
               content: {
                     "onetime": true,
                     "directive": "delegate",
                     "content": {
                        "tuid": tournament.tuid,
                        "tournament": CircularJSON.stringify(tournament)
                     }
                  }
            }
            coms.emitTmx({ delegationKey });
         }
      });

      container.pub_link.element.addEventListener('click', () => {
         // let message = `${location.origin}/Live/?ouid=${tournament.org.ouid}&tuid=${tournament.tuid}`;
         let message = `${location.origin}/Live/${tournament.org.abbr}`;
         let ctext = `
            <div class='flexcenter flexrow' style='width: 100%; margin-top: .5em; margin-bottom: .5em;'>
               <div class='pdf action_icon' style='display: none'></div>
               <a id='dl' download='tournamenturl'><div class='png action_icon'></div></a>
               <div id='cb' class='clipboard action_icon'></div>
            </div>
            <div><canvas id='qr'></canvas></div>
            <div id='msg' style='display: none;'>${lang.tr('phrases.linkcopied')}</div>
            `;
         let msg = displayGen.okCancelMessage(ctext, () => displayGen.closeModal());
         genQUR(message);

         document.getElementById('cb').addEventListener('click', function() {
            copyClick(message);
            document.getElementById('msg').style.display = 'inline'
         });

         document.getElementById('dl').addEventListener('click', function() {
            downloadCanvas(this, 'qr', 'tournament_url.png');
            function downloadCanvas(link, canvasId, filename) {
                link.href = document.getElementById(canvasId).toDataURL();
                link.download = filename;
            }
         }, false);

      });

      function genQUR(message) {
         var qr = new QRious({
            element: document.getElementById('qr'),
            level: 'H',
            size: 200,
            value: message
         });
      }

      function unpublishTournamentInfo(tournament) {
         displayGen.okCancelMessage(lang.tr('tournaments.unpublish'), unPublishTournament, () => displayGen.closeModal());

         function unPublishTournament() {
            function updateInfoPubState(result) {
               tournament.infoPublished = undefined;
               displayGen.pubStateTrnyInfo(container.pubStateTrnyInfo.element, tournament.infoPublished);
               displayGen.drawBroadcastState(container.publish_state.element);
               if (tournament.events) {
                  tournament.events.forEach(evt => {
                     evt.published = false;
                     evt.up_to_date = false;
                  });
               }
               if (tournament.schedule) {
                  tournament.schedule.published = false;
                  tournament.schedule.up_to_date = false;
                  schedulePublishState();
               }
               enableTournamentOptions();
               saveTournament(tournament, false);
            }
            coms.requestAcknowledgement({ uuid: tournament.tuid, callback: updateInfoPubState });
            let ouid = fx.fx.env().org && fx.fx.env().org.ouid;
            let deleteTournamentEvents = { tuid: tournament.tuid, ouid, delete_tournament: true };
            coms.emitTmx({ deleteTournamentEvents })
            displayGen.closeModal();
         }
      }

      function publishTournamentInfo(tournament) {
         tournament.org = fx.fx.env().org;

         function updateInfoPubState(result) {
            displayGen.pubStateTrnyInfo(container.pubStateTrnyInfo.element, tournament.infoPublished);
            displayGen.tournamentPublishState(container.push2cloud_state.element, tournament.pushed2cloud);
            saveTournament(tournament, false);
         }
         coms.requestAcknowledgement({ uuid: tournament.tuid, callback: updateInfoPubState });
         tournament.pushed2cloud = new Date().getTime();
         tournament.infoPublished = new Date().getTime();
         var tournamentInfo = {
            event: 'Publish Tournament Info',
            version: fx.fx.env().version,
            tuid: tournament.tuid,
            tournament: CircularJSON.stringify(tournament)
         };
         coms.emitTmx({tournamentInfo});
      }

      function pushTournament2Cloud(tournament) {
         tournament.org = fx.fx.env().org;

         function updatePushState(result) {
            displayGen.tournamentPublishState(container.push2cloud_state.element, tournament.pushed2cloud);
            saveTournament(tournament, false);
         }
         coms.requestAcknowledgement({ uuid: tournament.tuid, callback: updatePushState });
         tournament.pushed2cloud = new Date().getTime();
         coms.emitTmx({
            event: 'Push Tournament',
            version: fx.fx.env().version,
            tuid: tournament.tuid,
            tournament: CircularJSON.stringify(tournament)
         });
      }

      displayGen.pubStateTrnyInfo(container.pubStateTrnyInfo.element, tournament.infoPublished);
      displayGen.tournamentPublishState(container.push2cloud_state.element, tournament.pushed2cloud);
      displayGen.localSaveState(container.localdownload_state.element, tournament.saved_locally);

      function replaceNewLines(str) {
         return str
                  .split('>')
                  .map(s =>  s.replace(/^\n/, ''))
                  .join('>')
                  .replace(/\n/g, "<br />");
      }

      container.notes_display.element.innerHTML = tournament.notes || '';
      container.notes_container.element.style.display = tournament.notes ? 'inline' : 'none';

      var quill = new Quill(`#${container.notes.id}`, {
        modules: {
          toolbar: [
            [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
            [{ 'font': [] }],
            ['bold', 'italic'],
            [{ 'color': [] }, { 'background': [] }],
            [{ list: 'ordered' }, { list: 'bullet' }],
            [{ 'align': [] }],

            ['blockquote', 'code-block'],
            ['clean'] 
          ]
        },
        placeholder: 'Tournament Notes...',
        theme: 'snow'
      });

      container.notes.element.querySelector('.ql-editor').innerHTML = tournament.notes || '';

      container.edit_notes.element.addEventListener('click', () => {
         let visible = container.notes_entry.element.style.display == 'inline';
         container.notes_entry.element.style.display = visible ? 'none' : 'inline';
         container.notes_container.element.style.display = visible ? 'inline' : 'none';
         container.tournament_attrs.element.style.display = visible ? 'flex' : 'none';
         if (visible) saveTournament(tournament);
         fillNotes();
      });
      container.notes.element.addEventListener('keyup', () => {
         // strip html of unwanted content
         tournament.notes = sanitizeHtml(container.notes.element.innerHTML, {
           allowedTags: [
              'font', 'b', 'i', 'em', 'strong', 'ol', 'li', 'blockquote',
              'h1', 'h2', 'h3', 'p', 'br', 'center', 'div', 'span', 'pre',
//              'table', 'tbody', 'tr', 'td', 'th', 'thead'
           ],
           allowedAttributes: false
         });
         fillNotes();
      });

      function fillNotes() {
         let editor = container.notes.element.querySelector('.ql-editor');
         tournament.notes = editor && editor.innerText.trim() ? editor.innerHTML : '';
         container.notes_display.element.innerHTML = tournament.notes;
         if (!tournament.notes) container.notes_container.element.style.display = 'none';
      }

      container.push2cloud.element.addEventListener('click', () => { if (!tournament.pushed2cloud) pushTournament2Cloud(tournament); });
      container.pubTrnyInfo.element.addEventListener('click', () => publishTournamentInfo(tournament));
      container.pubTrnyInfo.element.addEventListener('contextmenu', () => unpublishTournamentInfo(tournament));

      container.localdownload.element.addEventListener('click', () => {
         let ouid = fx.fx.env().org && fx.fx.env().org.ouid;
         if (!tournament.ouid) tournament.ouid = ouid;

         exportFx.downloadCircularJSON(`${tournament.tuid}.circular.json`, tournament);
         tournament.saved_locally = true;

         displayGen.localSaveState(container.localdownload_state.element, tournament.saved_locally);
         saveTournament(tournament, false);
      });

      container.export_points.element.addEventListener('click', () => {
         if (container.export_points.element.firstChild.classList.contains('download')) {
            db.findTournamentPoints(tournament.tuid).then(exportPoints, util.logError);
         }
         let env = fx.fx.env();
         function exportPoints(points) {
            if (env.points.export_format && env.org.abbr) {
               let text = `${lang.tr('phrases.export')}: ${lang.tr('pts')}`;
               let choices = displayGen.twoChoices({ text, option1: 'JSON', option2: env.points.export_format.name || env.org.abbr });
               displayGen.escapeModal();
               choices.option1.element.addEventListener('click', () => {
                  exportFx.downloadJSON(`${env.org.abbr}-${tournament.tuid}-points.json`, points);
                  displayGen.closeModal();
               });
               choices.option2.element.addEventListener('click', () => {
                  pointsFx.downloadFormattedPoints({ org_abbr: env.org.abbr, points, tuid: tournament.tuid }).then(util.logError, util.logError);
                  displayGen.closeModal();
               });
            } else {
               exportFx.downloadJSON(`${tournament.tuid}-points.json`, points);
            }
         }
      });

      container.export_matches.element.addEventListener('click', () => {
         if (container.export_matches.element.firstChild.classList.contains('download')) {
            let { completed_matches, pending_matches, upcoming_matches } = mfx.tournamentEventMatches({ tournament });
            exportMatches(completed_matches);
         }
         let profile = fx.fx.env().org.abbr || 'Unknown';
         function exportMatches(matches) {
            let text = `${lang.tr('phrases.export')}: ${lang.tr('mts')}`;
            let choices = displayGen.twoChoices({ text, option1: 'JSON', option2: 'UTR' });
            displayGen.escapeModal();
            choices.option1.element.addEventListener('click', () => {
               exportFx.downloadJSON(`${profile}-${tournament.tuid}-matches.json`, matches);
               displayGen.closeModal();
            });
            choices.option2.element.addEventListener('click', () => {
               displayGen.closeModal();
               if (fx.fx.env().exports.utr) {
                  downloadUTRmatches(tournament, matches);
               } else {
                  displayGen.popUpMessage('Not authorized to export UTR');
               }
            });
         }
         function downloadUTRmatches(tournament, matches) {
            let match_records = exportFx.UTRmatchRecords({ matches, players: tournament.players });
            let csv = exportFx.json2csv(match_records);
            exportFx.downloadText(`UTR-${profile}-${tournament.tuid}-U${tournament.category}.csv`, csv);
         }
      });

      container.publish_draw.element.addEventListener('contextmenu', () => {
         if (!displayed_draw_event || !displayed_draw_event.published) return;
         displayGen.okCancelMessage(lang.tr('draws.unpublish'), unpublishDraw, () => displayGen.closeModal());

         function unpublishDraw() {
            unpublishEventDraw(displayed_draw_event);
            displayGen.drawBroadcastState(container.publish_state.element, displayed_draw_event);
            enableTournamentOptions();
            displayGen.closeModal();
         }
      });

      function unpublishEventDraw(evt) {
         evt.published = false;
         evt.up_to_date = false;
         saveTournament(tournament);
         deletePublishedEvent(tournament, evt);
      }

      container.publish_draw.element.addEventListener('click', () => {
         if (fx.fx.env().publishing.require_confirmation) {
            displayGen.okCancelMessage(lang.tr('draws.publishQ'), broadcast, () => displayGen.closeModal());
         } else {
            broadcast();
         }

         function broadcast() {
            broadcastEvent(tournament, displayed_draw_event);
            displayGen.drawBroadcastState(container.publish_state.element, displayed_draw_event);
            displayGen.closeModal();
         }
      });

      container.recycle.element.addEventListener('click', () => {
         displayGen.okCancelMessage(`${lang.tr('draws.clear')}?`, clearDraw, () => displayGen.closeModal());
         function clearDraw() {
            displayGen.closeModal();
            let evt = displayed_draw_event;
            if (evt && evt.draw && evt.draw.compass) {
               evt.draw.compass = 'east';
               container.compass_direction.ddlb.setValue(evt.draw.compass, 'white');
            }

            // remove any entry information attached to players
            playerFx.clearEntry(evt && evt.draw && evt.draw.opponents);

            evt.draw_created = false;
            generateDraw(evt, true);
            displayDraw({ evt });
            updateCompassDirections();

            // if (evt.published) evt.up_to_date = false;
            // displayGen.drawBroadcastState(container.publish_state.element, displayed_draw_event);

            tfx.logEventChange(displayed_draw_event, { fx: 'draw cleared' });
            saveTournament(tournament);

            outOfDate(displayed_draw_event, true);

            enableDrawActions();
         }
      });

      container.player_reps.element.addEventListener('click', () => {
         let modal = displayGen.playerRepresentatives();
         modal.submit.element.addEventListener('click', () => submitReps());
         modal.cancel.element.addEventListener('click', () => displayGen.closeModal());
         if (displayed_draw_event) {
            let approved_ids = [].concat(...displayed_draw_event.approved);
            let valid_reps = tournament.players
               .filter(p=>approved_ids.indexOf(p.id) >= 0)
               .map(p=>{
                  let player = util.normalizeName(`${p.first_name} ${p.last_name}`);
                  return { value: player, label: player }
               });
            let rep1 = new Awesomplete(modal.player_rep1.element, { list: valid_reps });
            let rep2 = new Awesomplete(modal.player_rep2.element, { list: valid_reps });

            let rep1_selection_flag = false;
            modal.player_rep1.element.addEventListener("awesomplete-selectcomplete", function(e) { rep1_selection_flag = true; }, false);
            modal.player_rep1.element.addEventListener('keydown', catchTab , false);
            modal.player_rep1.element.addEventListener("keyup", function(e) { 
               // auto select first item on 'Enter' *only* if selectcomplete hasn't been triggered
               if (e.which == 13 && !rep1_selection_flag) {
                  if (rep1.suggestions && rep1.suggestions.length) {
                     rep1.next();
                     rep1.select(0);
                     modal.player_rep2.element.focus();
                  }
               }
               rep1_selection_flag = false;
            });
            modal.player_rep1.element.focus();

            let rep2_selection_flag = false;
            modal.player_rep2.element.addEventListener("awesomplete-selectcomplete", function(e) { rep2_selection_flag = true; }, false);
            modal.player_rep2.element.addEventListener('keydown', catchTab , false);
            modal.player_rep2.element.addEventListener("keyup", function(e) { 
               // auto select first item on 'Enter' *only* if selectcomplete hasn't been triggered
               if (e.which == 13 && !rep2_selection_flag) {
                  if (rep2.suggestions && rep2.suggestions.length) {
                     rep2.next();
                     rep2.select(0);
                  }
               }
               rep2_selection_flag = false;
            });

            if (!displayed_draw_event.player_representatives) displayed_draw_event.player_representatives =[];
            modal.player_rep1.element.value = displayed_draw_event.player_representatives[0] || '';
            modal.player_rep2.element.value = displayed_draw_event.player_representatives[1] || '';
         }
         function submitReps() {
            displayed_draw_event.player_representatives[0] = modal.player_rep1.element.value;
            displayed_draw_event.player_representatives[1] = modal.player_rep2.element.value;
            displayGen.drawRepState(container.player_reps_state.element, displayed_draw_event);
            saveTournament(tournament);
            displayGen.closeModal();
         }
      });

      container.clearschedule.element.addEventListener('click', clearScheduleDay);
      container.clearschedule.element.addEventListener('contextmenu', resetSchedule);
      container.autoschedule.element.addEventListener('click', autoSchedule);
      container.schedulelimit.element.addEventListener('click', limitAutoSchedule);
      container.events_actions.element.addEventListener('click', newTournamentEvent);
      container.locations_actions.element.addEventListener('click', newLocation);

      function cMenu({ selector, coords, options, clickAction }) {
         let font_size = options.length < 7 ? 18 : 16;
         if (options.length) {
            let cmenu = contextMenu()
               .options({ colors: { default: '#BCFDFB' }, font: { size: font_size }})
               .selector(selector)
               .items(...options)
               .events({ 
                  'item': { 'click': clickAction },
                  'cleanup': cleanUp,
               });

            // avoid delayed click propagation
            setTimeout(function() { setup(); }, 200);

            function setup() {
               cmenu(coords[0], coords[1]);
               // this is not the same as displayGen.escapeModal() !!!!
               displayGen.escapeFx = () => { cmenu.cleanUp(); displayGen.escapeFx = undefined; };
            }

            function cleanUp() {
               tree_draw.unHighlightCells();
               displayGen.escapeFx = undefined;
            }
         }
      }

      function resetSchedule() {
         displayGen.escapeModal();
         displayGen.okCancelMessage(lang.tr('phrases.clearalldays'), reset, () => displayGen.closeModal());
         function reset() {
            clearScheduleDay({all: true});
            displayGen.closeModal();
         }
      }

      function clearScheduleDay({ all } = {}) {
         let { scheduled } = mfx.scheduledMatches(tournament);
         let incomplete = scheduled.filter(s=>s.winner == undefined && s.schedule.day == displayed_schedule_day);

         let to_be_cleared = all ? scheduled : incomplete;

         to_be_cleared.forEach(match => {
            match.schedule = {};
            match.source.schedule = {};
         });
         scheduleTab();
         scheduleActions({ changed: true });
         saveTournament(tournament);
      }

      // returns true/false depending on whether a match is currently scheduled
      // for displayed_schedule_day or whether it had a interrupted schedule for displayed day
      function scheduledFilter(match) {
         if (!match || !match.schedule) return false;
         let scheduled = match.schedule.day == displayed_schedule_day;
         if (match.schedule.interrupted && match.schedule.interrupted.length) {
            scheduled = match.schedule.interrupted.reduce((p, c) => p || c.day == displayed_schedule_day, scheduled);
         }
         return scheduled;
      }

      function scheduledHashes(match) {
         let hashes = [];
         if (!match || !match.schedule) return hashes;
         hashes.push(scheduleHash(match.schedule));
         if (match.schedule.interrupted && match.schedule.interrupted.length) return hashes.concat(...match.schedule.interrupted.map(scheduleHash));
         return hashes;
         function scheduleHash(schedule) { return `${schedule.oop_round}|${schedule.luid}|${schedule.index}`; }
      }

      function limitAutoSchedule() {
         // TODO: Only show the button when the selected event is a Round Robin
         // TODO: change the button to show the limit that has been set
      }

      function autoSchedule(ev) {
         let order_priority = false;

         let luids = tournament.locations.map(l=>l.luid);
         let luid = luids.length == 1 ? luids[0] : container.location_filter.ddlb.getValue();
         let courts = courtFx.courtData(tournament, luid);

         let court_names = {};
         courts.forEach(ct => court_names[courtFx.ctuuid(ct)] = ct.name);

         let { completed_matches, pending_matches, upcoming_matches } = mfx.tournamentEventMatches({ tournament, source: true });
         let pending_by_format = pending_matches.sort((a, b) => a.format == 'singles' ? 0 : 1);

         let upcoming_by_format = upcoming_matches.sort((a, b) => a.format == 'singles' ? 0 : 1);
         let all_matches = [].concat(...pending_by_format, ...upcoming_by_format, completed_matches);
         let scheduled_cells = [].concat(...all_matches.filter(scheduledFilter).map(scheduledHashes));

         let available_cells = [].concat(...courts.map(c => c.availability.map(a => `${a}|${c.luid}|${c.index}`)))
            .filter(cell => scheduled_cells.indexOf(cell) < 0)
            .map(c => {
               let [ or, luid, index ] = c.split('|');
               let court = court_names[`${luid}|${index}`];
               return { oop_round: parseInt(or), court, luid, index };
            })
            // sort in reverse order since popping available removes from tail
            .sort((a, b) => b.oop_round - a.oop_round);

         // subsort courts by column order so filled left to right
         // let court_uuids = courts.map(c=>`${c.luid}|${c.index}`);
         let court_uuids = courts.map(courtFx.ctuuid);
         function cindex(cell) { return court_uuids.indexOf(courtFx.ctuuid(cell)); }
         function sortCourts(a, b) { return cindex(b) - cindex(a); }

         let available_oop = available_cells.map(c => c.oop_round);
         util.unique(available_oop).forEach(oop_round => {
            let indices = util.indices(oop_round, available_oop);
            let start = Math.min(...indices);
            let count = indices.length;
            util.inPlaceSubSort(available_cells, start, count, sortCourts);
         });
               
         let euid = container.event_filter.ddlb.getValue();
         let round_filter = container.round_filter.ddlb.getValue();

         let unscheduled_matches = all_matches
            .filter(m=>m)
            .filter(m=>(!m.schedule || !m.schedule.court) && m.winner == undefined);

         // only schedule matches that match the round and event filters
         let filtered_unscheduled = unscheduled_matches
            .filter(m => (!euid || euid == m.event.euid) && (!round_filter || round_filter == m.round_name));

         let match_round_names = util.unique(filtered_unscheduled.map(m=>m.round_name));
         if (match_round_names.length > 1) {
            let config = displayGen.autoScheduleConfig();
            config.order.element.addEventListener('click', () => { order_priority = true; displayGen.closeModal(); doIt(); });
            config.round.element.addEventListener('click', () => { displayGen.closeModal(); doIt(); });
         } else {
            doIt();
         }

         function doIt() {
            console.log('option to auto-schedule upcoming matches');

            let to_be_scheduled = scheduleFx.sortedUnscheduled(tournament, filtered_unscheduled, order_priority);

            // now assign oop cells to matches
            to_be_scheduled.forEach(match => {
               let available = available_cells.pop();
               if (available) {
                  let schedule = { 
                     day: displayed_schedule_day,
                     oop_round: available.oop_round,
                     court: available.court,
                     luid: available.luid,
                     index: available.index
                  }
                  match.schedule = schedule;
                  match.source.schedule = Object.assign({}, match.schedule);
               }
            })

            let day_matches = all_matches.filter(scheduledFilter);
            checkConflicts(day_matches);

            scheduleActions({ changed: true });
            saveTournament(tournament);
            scheduleTab();
         }
      }

      function checkConflicts(day_matches) {
         if (!day_matches || !day_matches.length) return;
         let issues = scheduleFx.schedulingIssues(day_matches);
         let status_map = Object.assign(...day_matches.map(match=>({ [match.muid]: matchStatus(match) })));

         issues.warnings.forEach(muid => { if (status_map[muid] != 'complete' && status_map[muid] != 'inprogress') status_map[muid] = 'warning' });
         issues.conflicts.forEach(muid => { if (status_map[muid] != 'complete' && status_map[muid] != 'inprogress') status_map[muid] = 'conflict' });

         Object.keys(status_map).forEach(muid => scheduleFx.colorCell(container.schedule.element, muid, status_map[muid]));

         function matchStatus(match) {
            let complete = match.winner_index != undefined;
            let inprogress = match.status == 'inprogress' || (match.score && match.winner_index == undefined);
            let abandoned = match.score && (match.score.indexOf('Cancelled') == 0 || match.score.indexOf('INC') >= 0);
            return complete ? 'complete' : abandoned ? 'abandoned' : inprogress ? 'inprogress' : 'neutral';
         }
      }

      var genders = [
         { key: lang.tr('genders.mixed'), value: ''},
         { key: lang.tr('genders.male'), value: 'M'},
         { key: lang.tr('genders.female'), value: 'W'},
      ];
      
      var inout = [
         { key: '-', value: '' },
         { key: lang.tr('indoors'), value: 'i' },
         { key: lang.tr('outdoors'), value: 'o' }
      ]
      var surfaces = [
         { key: lang.tr('surfaces.clay'), value: 'C'},
         { key: lang.tr('surfaces.hard'), value: 'H'},
         { key: lang.tr('surfaces.grass'), value: 'G'},
         { key: lang.tr('surfaces.carpet'), value: 'R'},
      ];
      
      var formats = [
         { key: lang.tr('formats.singles'), value: 'S'},
         { key: lang.tr('formats.doubles'), value: 'D'},
      ];
      
      var supported_types = fx.fx.env().draws.types;
      var draw_types = [];
      if (supported_types.elimination) draw_types.push({ key: lang.tr('draws.elimination'), value: 'E'});
      if (supported_types.qualification) draw_types.push({ key: lang.tr('draws.qualification'), value: 'Q'});
      if (supported_types.roundrobin) draw_types.push({ key: lang.tr('draws.roundrobin'), value: 'R'});
      if (supported_types.consolation) draw_types.push({ key: lang.tr('draws.consolation'), value: 'C'});
      if (supported_types.compass) draw_types.push({ key: lang.tr('draws.compass'), value: 'S'});
      if (supported_types.playoff) draw_types.push({ key: lang.tr('pyo'), value: 'P'});

      // NOTE: this was done to build up a player list from parsed matches...
      // if there are any matches, add match players first
      // this must be invoked before tabs created...
      // mergePlayers(matchPlayers(dbmatches), false);

      tournamentTab();
      drawsTab();
      eventsTab();
      courtsTab();
      scheduleTab();
      filteredTabs();
      
      if (!tMatches() || tournament.events) {
         let remote_request = fx.fx.env().auto_update.registered_players;
         updateRegisteredPlayers(remote_request);
      }

      searchBox.noSuggestions = noSuggestions;
      // END setup.  

      // SUPPORTING FUNCTIONS
      function playerClick(d, n) {
         if (!controlIntercept()) {
            if (d.player && d.player.puid) {
               playerFx.displayPlayerProfile({ puid: d.player.puid }).then(()=>{}, ()=>{});
            } else if (d.data && d.data.team && d.data.team.length && d.data.team[n] && d.data.team[n].puid) {
               playerFx.displayPlayerProfile({ puid: d.data.team[n].puid }).then(()=>{}, ()=>{});
            }
         }
      }
      
      function controlIntercept() { return d3.event.ctrlKey || d3.event.shiftKey }

      function signOutTournamentPlayer(player) {
         player.signed_in = false;
         saveTournament(tournament);
         if (!tournament.events) return;
         tournament.events.forEach(ev => {
            // don't modify events which are already active;
            if (ev.active) return;

            ev.approved = ev.approved.filter(a => {
               if (Array.isArray(a)) {
                  a = a.filter(p => p.id != player.id);
                  if (!a.length) return false;
               } else {
                  if (a.id == player.id) return false;
               }
               return true;
            });

         });
      }

      function addTournamentPlayer(player_container, new_player) {
         if (!tournament.players) tournament.players = [];
         let existing = tournament.players.filter(p=>p.id == new_player.id);
         let assignment = displayGen.playerAssignmentActions(player_container);

         let plyr = tournament.players.reduce((a, b) => a = (b.puid == new_player.puid) ? b : a, undefined);

         assignment.new_player.element.style.display = plyr && plyr.signed_in ? 'none' : 'inline';
         assignment.add.element.style.display = existing.length ? 'none' : 'inline';
         assignment.signin.element.style.display = existing.length && !existing[0].signed_in ? 'inline' : 'none';
         assignment.signout.element.style.display = existing.length && existing[0].signed_in ? 'inline' : 'none';

         let cleanUp = () => {
            displayGen.closeModal();

            // TODO: any draws which have been created need to be re-validated
            // a newly signed-in player can invlidate seeding; any player
            // withdrawn invalidates draws which contain that player...

            playersTab();
            let e = tfx.findEventByID(tournament, displayed_event);
            if (e) eventPlayers(e);
            eventsTab();
         }

         let addNew = (evt) => {
            searchBox.typeAhead.suggestions = [];

            new_player.signed_in = false;
            if (!new_player.rankings) new_player.rankings = {};
            new_player.full_name = `${new_player.last_name.toUpperCase()}, ${util.normalizeName(new_player.first_name, false)}`;

            let rank_category = staging.legacyCategory(tournament.category);
            fetchFx.fetchRankList(rank_category).then(addRanking, addPlayer);

            function addRanking(rank_list) {
               if (!rank_list || !rank_list.rankings || !rank_list.rankings.players) return addPlayer();
               let player_rankings = rank_list.rankings.players;
               if (player_rankings[new_player.id]) {
                  let category_ranking = player_rankings[new_player.id];
                  if (category_ranking) {
                     let category = staging.legacyCategory(tournament.category, true);
                     new_player.rankings[category] = +category_ranking.ranking;
                     new_player.category_ranking = +category_ranking.ranking;
                     new_player.int = category_ranking.int;
                  }
               }
               addPlayer();
            }

            function addPlayer() {
               pushNewPlayer(new_player);
               cleanUp();
            }
         }

         let signIn = () => {
            existing[0].signed_in = true;
            saveTournament(tournament);
            cleanUp();
         }

         searchBox.element.blur();
         assignment.add.element.addEventListener('click', addNew);
         assignment.new_player.element.addEventListener('click', () => {
            playerFx.createNewPlayer({ player_data: new_player, category: tournament.category, callback: addNewTournamentPlayer });
         });
         assignment.cancel.element.addEventListener('click', () => displayGen.closeModal());
         assignment.signin.element.addEventListener('click', signIn);
         assignment.signout.element.addEventListener('click', () => { 
            signOutTournamentPlayer(existing[0]);
            cleanUp();
         });

         // have to modify behavior to avoid keyup initiating second event in searchBox
         assignment.signin.element.addEventListener('keydown', evt => evt.preventDefault());
         assignment.signin.element.addEventListener('keyup', evt => { if (evt.which == 13) signIn(); });
         assignment.add.element.addEventListener('keydown', evt => evt.preventDefault());
         assignment.add.element.addEventListener('keyup', evt => { if (evt.which == 13) addNew(); });

         let give_focus = !existing.length ? 'add' : existing.length && !existing[0].signed_in ? 'signin' : '';
         if (give_focus) assignment[give_focus].element.focus();
      }

      playerFx.actions.addTournamentPlayer = addTournamentPlayer;

      function pushNewPlayer(new_player) {
         if (!tournament.players) tournament.players = [];

         // avoid double clicks adding same player twice!
         if (tournament.players.map(p=>p.puid).indexOf(new_player.puid) < 0 && tournament.players.map(p=>p.id).indexOf(new_player.id) < 0) {
            tournament.players.push(new_player);
            saveTournament(tournament);
         }
      }

      function addNewTournamentPlayer(player) {
         player.puid = `pl${UUID.new()}`;
         player.id = player.puid;

         let new_player = Object.assign({}, player);
         // delete unnecessary attributes...
         delete new_player.signed_in;

         // after adding to database, re-enable Add Player to update searchBox
         db.addPlayer(new_player).then(enableAddPlayer, console.log);

         player.signed_in = true;
         pushNewPlayer(player);
         playersTab();
      }

      function noSuggestions(value) {
         let firstCap = (value) => !value ? '' : `${value[0].toUpperCase()}${value.substring(1)}`;
         if (playerFx.action == 'addTournamentPlayer' && value) {
            searchBox.element.value = '';
            let name = value.split(' ');
            let new_player = {
               sex: 'M',
               first_name: firstCap(name[0]),
               last_name: firstCap(name.slice(1).join(' ')),
            }
            playerFx.createNewPlayer({ player_data: new_player, category: tournament.category, callback: addNewTournamentPlayer, date: tournament.start });
         }
      }

      function enableAddPlayer() {
         let category_filter = container.category_filter.ddlb ? container.category_filter.ddlb.getValue() : tournament.category;

         let tournament_date = tournament && (tournament.points_date || tournament.end);
         let calc_date = tournament_date ? new Date(tournament_date) : new Date();

         let points_table = fx.fx.pointsTable({calc_date});
         let categories = points_table && points_table.categories;
         let ages = categories && categories[category_filter] && categories[category_filter].ages;
         let ratings = categories && categories[category_filter] && categories[category_filter].ratings;

         let year = calc_date.getFullYear();
         let min_year = ages && (year - parseInt(ages.from));
         let max_year = ages && (year - parseInt(ages.to));

         playerFx.action = 'addTournamentPlayer';
         playerFx.displayGen = displayGen.showConfigModal;

         searchBox.category = 'players';
         searchBox.category_switching = false;
         searchBox.setSearchCategory(lang.tr("actions.add_player"));

         db.findAllPlayers().then(arr => {
            if (arr.length) {
               searchBox.typeAhead.list = arr.filter(categoryFilter).map(valueLabel);
               searchBox.irregular_search_list = true;
            }
         });

         function categoryFilter(player) {
            if (!ages && !ratings) return true;
            if (ages) {
               let birth_year = player.birth && new Date(player.birth).getFullYear();
               if (birth_year <= min_year && birth_year >= max_year) return true;
            }
         }
      }

      function disablePlayerOverrides(current_tab, next_tab) {
         if (current_tab == 'events' && next_tab != 'events') {
            delete playerFx.override;
            if (next_tab != 'players') resetSearch();
         } else if (current_tab == 'players' && next_tab != 'players') {
            playerFx.action = undefined;
            playerFx.displayGen = undefined;
            resetSearch();
         }

         function resetSearch() {
            searchBox.category_switching = true;
            searchBox.setSearchCategory();
         }
      }

      function tabCallback(tab_number, reference) {
         disablePlayerOverrides(current_tab, reference);

         if (reference == 'players') { playersTab(); }

         if (current_tab != 'draws' && reference == 'draws') {
            displayGen.drawBroadcastState(container.publish_state.element, displayed_draw_event);

            // resize the draw when tab is clicked so that names size properly
            tree_draw();
            rr_draw();
         }

         if (reference == 'draws') {
            displayGen.drawBroadcastState(container.publish_state.element, displayed_draw_event);
         }

         // matchesTab() checks for new matches and updates pointsTab();
         if (reference == 'matches' || reference == 'points') matchesTab();
         if (reference == 'tournament') penaltyReportIcon();
         if (reference == 'schedule') {
            displayGen.arrowFx = (key) => {
               let scroll_width = container.schedule.element.querySelector('.court_schedule').scrollWidth;
               if (key == 'ArrowRight') {
                  container.schedule.element.querySelector('.tournament_schedule').scrollLeft += scroll_width;
               } else if (key == 'ArrowLeft') {
                  container.schedule.element.querySelector('.tournament_schedule').scrollLeft -= scroll_width;
               }
            }
            scheduleTab();
         } else {
            displayGen.arrowFx = undefined;
         }

         if (reference == 'events') {
            displayEvent();
            eventList();
         }

         current_tab = reference || tab_number;
      }

      // boolean whether there are existing matches
      function tMatches() {
         if (dbmatches && dbmatches.length) return dbmatches.length;
         if (!tournament.events) return false;

         let { total_matches } = mfx.tournamentEventMatches({ tournament });
         return total_matches;
      }

      function autoDrawSetting() {
         let elem = document.querySelector('.' + classes.auto_draw);
         if (!elem) return;
         return Array.from(elem.firstChild.classList).indexOf('automated_draw_play') >= 0 ? true : false;
      }

      function gemSeedingSetting() {
         let elem = document.querySelector('.' + classes.gem_seeding);
         if (!elem) return;
         return Array.from(elem.firstChild.classList).indexOf('gem_active') >= 0 ? true : false;
      }

      function playerFilterActive() {
         let elem = document.querySelector('.' + classes.player_filter);
         if (!elem) return;
         return Array.from(elem.firstChild.classList).indexOf('filter_active') >= 0 ? true : false;
      }

      function toggleAutoDraw(auto) {
         let e = tfx.findEventByID(tournament, displayed_event);
         let automated = autoDrawSetting();
         let togglePlayPause = () => {
            // toggle the two possible options
            let elem = document.querySelector('.' + classes.auto_draw);
            elem.firstChild.classList.toggle('automated_draw_pause');
            elem.firstChild.classList.toggle('automated_draw_play');
            saveTournament(tournament);
         }

         if ((auto == true && automated) || (auto == false && !automated)) return;

         // if not true/false it is a MouseEvent, so needs to be explicit
         if (auto == true || auto == false) {
            // toggle to defined state
            togglePlayPause();
            return;
         }

         if (!state.edit || (e && e.active)) return;

         // handle mouse click event
         if (e && e.draw_created) {
            displayGen.okCancelMessage('WARNING: Existing Draw will be cleared!', clickChange, () => displayGen.closeModal());
         } else {
            clickChange();
         }

         function clickChange() {
            togglePlayPause();

            if (e) {
               e.regenerate = 'auto draw';
               e.draw_created = false;
               eventBackground(e);
               e.automated = autoDrawSetting();
               eventList(true);
            }

            displayGen.closeModal();
         }
      }

      function togglePlayerFilter(active) {
         let e = tfx.findEventByID(tournament, displayed_event);
         let filter_active = playerFilterActive();
         let toggleFilterActive = () => {
            // toggle the two possible options
            let elem = document.querySelector('.' + classes.player_filter);
            elem.firstChild.classList.toggle('filter_inactive');
            elem.firstChild.classList.toggle('filter_active');
            saveTournament(tournament);
         }

         if ((active == true && filter_active) || (active == false && !filter_active)) return;

         // if not true/false it may be MouseEvent, so needs to be explicit
         if (active == true || active == false) {
            toggleFilterActive();
            return;
         }

         if (!state.edit || (e && e.active)) return;

         toggleFilterActive();

         if (e) {
            if (e.player_filter) {
               delete e.player_filter
            } else {
               console.log('define filter');
            }
         }
      }

      function toggleGemSeeding(active) {
         let e = tfx.findEventByID(tournament, displayed_event);
         let seeding_active = gemSeedingSetting();
         let toggleGemActive = () => {
            // toggle the two possible options
            let elem = document.querySelector('.' + classes.gem_seeding);
            elem.firstChild.classList.toggle('gem_inactive');
            elem.firstChild.classList.toggle('gem_active');
            saveTournament(tournament);
         }

         if ((active == true && seeding_active) || (active == false && !seeding_active)) return;

         // if not true/false it may be MouseEvent, so needs to be explicit
         if (active == true || active == false) {
            toggleGemActive();
            return;
         }

         if (!state.edit || (e && e.active)) return;

         toggleGemActive();

         if (e) {
            e.gem_seeding = !e.gem_seeding;
            e.regenerate = 'gem seeding';
            e.draw_created = false;
            eventBackground(e);
            eventList(true);
         }
      }

      function filteredTabs() {
         playersTab();
         matchesTab();
      }

      function updateFilters(toggle) {
         let i = filters.indexOf(toggle);
         if (i >= 0) {
            filters.splice(i, 1);
         } else {
            filters.push(toggle);
         }

         let m = filters.indexOf('M');
         let w = filters.indexOf('W');

         if (toggle == 'M') {
            toggleClass(classes.filter_m, 'M');
            if (w >= 0) {
               filters.splice(w, 1);
               toggleClass(classes.filter_w, 'W');
            }
         }
         if (toggle == 'W') {
            toggleClass(classes.filter_w, 'W');
            if (m >= 0) {
               filters.splice(m, 1);
               toggleClass(classes.filter_m, 'M');
            }
         }

         filteredTabs();
      }

      // determine whether to display option to print sign-in sheet
      // in this case withdrawn players are not considered "printable"
      function signInSheet() {
         let not_withdrawn = tournament.players && tournament.players.filter(p=>p.withdrawn != 'Y' && p.withdrawn != true);
         let display = state.edit && not_withdrawn && not_withdrawn.length;
         document.querySelector('.' + classes.print_sign_in).style.display = display ? 'inline' : 'none';
      }

      function scheduleActions({ changed=false } = {}) {
         let display = state.edit ? true : false;
         container.schedule_tab.element.querySelector('.' + classes.print_schedule).style.display = display ? 'inline' : 'none';
         container.schedule_tab.element.querySelector('.' + classes.schedule_matches).style.display = display ? 'inline' : 'none';
         container.schedule_tab.element.querySelector('.' + classes.schedule_details).style.display = display ? 'inline' : 'none';

         if (!tournament.schedule) tournament.schedule = {};
         if (changed) {
            tournament.schedule.up_to_date = false;
            saveTournament(tournament);
         }
         schedulePublishState();

         let elem = container.schedule_tab.element.querySelector('.' + classes.schedule_details).querySelector('div');
         displayGen.scheduleDetailsState(elem, tournament.schedule);

         let ouid = fx.fx.env().org && fx.fx.env().org.ouid;
         let display_publish_icon = display && ouid;
         container.schedule_tab.element.querySelector('.' + classes.publish_schedule).style.display = display_publish_icon ? 'inline' : 'none';
      }

      function activateEdit() {
         state.edit = true;
         displayGen.escapeFx = undefined;

         // for editing insure tournament is not in modal
         util.moveNode('content', container.container.id);
         displayGen.content = 'tournament';
         displayGen.closeModal();

         if (display_context != 'content') {
            delete draws_context[display_context];
            display_context = 'content';
            draws_context[display_context] = { roundrobin: rr_draw, tree: tree_draw };
         }

         setEditState();

         if (current_tab == 'schedule') scheduleTab();
         if (current_tab == 'players') {
            displayedPlayers();
            enableAddPlayer();
         }

         if (document.body.scrollIntoView) document.body.scrollIntoView();

         // TODO: insure that fx.fx.env().org.abbr is appropriately set when externalRequest URLs are configured
         let tournament_date = tournament && tournament.start;
         let calc_date = tournament_date ? new Date(tournament_date) : new Date();
         let categories = fx.fx.orgCategories({calc_date});
         fetchFx.fetchRankLists(categories).then(maxInternationalRankings, maxInternationalRankings);
      }

      /*
       * int_rankings indicates the maximum number of international rankings
       * for each category... so that an offset may be calculated when actual
       * rankings are independent of international ranking
       */
      function maxInternationalRankings() {
         if (!tournament.int_rankings) tournament.int_rankings = {};
         db.findAllRankings().then(rankings => rankings.forEach(ranking => {
            let int_rankings = Object.keys(ranking.players).map(p=>ranking.players[p].int).filter(util.parseInt).filter(f=>f);
            tournament.int_rankings[ranking.category] = int_rankings.length ? Math.max(...int_rankings) : 0;
         }));
      }

      function deactivateEdit() {
         state.edit = false;
         document.querySelector('.ranking_order').style.opacity = 0;
         saveTournament(tournament);
         setEditState();
      }

      // authorization to publish tournament
      function revokeAuthorization() {
         displayGen.escapeModal();
         displayGen.okCancelMessage(lang.tr('phrases.revokeauth'), revokeAuthorization, () => displayGen.closeModal());
         function revokeAuthorization() {
            let revokeAuthorization = { tuid: tournament.tuid };
            coms.emitTmx({ revokeAuthorization });
            displayGen.closeModal();
         }
      }

      function authorizeUser() {
         let key_uuid = UUID.generate();
         tournament.pushed2cloud = new Date().getTime();
         let pushKey = {
            key_uuid,
            content: {
                  "onetime": true,
                  "directive": "authorize",
                  "content": {
                     "tuid": tournament.tuid,
                     "tournament": CircularJSON.stringify(tournament)
                  }
               }
         }
         let ctext = lang.tr('phrases.keycopied');

         // TODO: server won't accept pushKey unless user uuuid in superuser cache on server
         coms.emitTmx({ pushKey });
         displayGen.escapeModal();
         let msg = displayGen.okCancelMessage(ctext, () => displayGen.closeModal());
         copyClick(key_uuid);
      }

      function editAction() {
         if (!container.edit.element || !container.finish.element) return;
         
         container.edit.element.addEventListener('click', () => { if (!state.edit) activateEdit(); });
         container.finish.element.addEventListener('click', () => { deactivateEdit(); });
         container.cloudfetch.element.addEventListener('contextmenu', () => { coms.requestTournamentEvents(tournament.tuid); });
         container.cloudfetch.element.addEventListener('click', () => { coms.requestTournament(tournament.tuid); });
         container.authorize.element.addEventListener('contextmenu', revokeAuthorization);
         container.authorize.element.addEventListener('click', authorizeUser);
      }

      function copyClick(message) {
         let c = document.createElement('input');
         c.style.opacity = 0;
         c.setAttribute('id', 'c2c');
         c.setAttribute('type', 'text');
         c.setAttribute('value', message);
         let inp = document.body.appendChild(c);

         let b = document.createElement('button');
         b.style.display = 'none';
         b.setAttribute('data-copytarget', '#c2c');
         b.addEventListener('click', elementCopy, true);
         let elem = document.body.appendChild(b);
         elem.click();
         elem.remove();
         inp.remove();
      }

      function elementCopy(e) {
         let t = e.target;
         let c = t.dataset.copytarget;
         let inp = (c ? document.querySelector(c) : null);

         if (inp && inp.select) {
            inp.select();

            try {
               document.execCommand('copy');
               inp.blur();
            }
            catch (err) { alert('please press Ctrl/Cmd+C to copy'); }
         }
      }

      function setEditState() {
         let ouid = fx.fx.env().org && fx.fx.env().org.ouid;
         let same_org = sameOrg(tournament);

         container.authorize.element.style.display = 'none';
         container.edit.element.style.display = state.edit ? 'none' : 'inline';
         container.finish.element.style.display = state.edit ? 'inline' : 'none';
         container.cloudfetch.element.style.display = state.edit && ouid && same_org ? 'inline' : 'none';
         container.export_points.element.firstChild.className = 'action_icon';
         container.export_matches.element.firstChild.className = 'action_icon';
         checkAdminActions();

         container.points_valid.element.disabled = !state.edit;

         document.querySelector('.refresh_registrations').style.opacity = state.edit ? 1 : 0;
         document.querySelector('.' + classes.refresh_registrations).classList[state.edit ? 'add' : 'remove']('info');

         signInSheet();
         scheduleActions();
         penaltyReportIcon();
         enableDrawActions();
         enableTournamentOptions();

         // any change of edit state hides notes entry
         // container.notes.element.style.display = 'none';

         eventsTab();
         courtsTab();
         playersTab();
         closeEventDetails();
         closeLocationDetails();
      }

      function checkAdminActions() {
         if (state.edit) {
            db.findSetting('superUser').then(setting => {
               if (setting && setting.auth) {
                  if (util.string2boolean(setting.auth.tournaments)) {
                     container.authorize.element.style.display = 'inline';
                     enableDownloads();
                  }
                  if (util.string2boolean(setting.auth.authorize)) container.authorize.element.style.display = 'inline';
               }
            });

            function enableDownloads() {
               container.export_points.element.firstChild.className = 'download action_icon';
               container.export_matches.element.firstChild.className = 'download action_icon';
            }
         }
      }

      function enableTournamentOptions() {
         let bool = state.edit;
         let same_org = sameOrg(tournament);
         let ouid = fx.fx.env().org && fx.fx.env().org.ouid;

         [ 'start_date', 'end_date', 'organization', 'organizers', 'location', 'judge' ].forEach(field=>container[field].element.disabled = !bool);
         let publications = !tournament.events || !tournament.events.length ? false : tournament.events.reduce((p, c) => c.published || p, false);
         let delegation = publications && tournament.events && tournament.events.length && tournament.events.reduce((p, c) => p || c.draw_created || c.active, false);
         container.delegate.element.style.display = (bool || tournament.delegated) && delegation && same_org ? 'inline' : 'none';
         container.pub_link.element.style.display = bool && publications ? 'inline' : 'none';
         container.edit_notes.element.style.display = bool && same_org ? 'inline' : 'none';
         container.push2cloud.element.style.display = ouid && bool && same_org ? 'inline' : 'none';
         container.pubTrnyInfo.element.style.display = bool && same_org && ouid ? 'inline' : 'none';
         container.localdownload.element.style.display = bool && same_org ? 'inline' : 'none';
      }

      function addRegistered(registered_players) {
         mergePlayers(registered_players);
         playersTab();
      }

      function mergePlayers(players, save=true) {
         if (!players || !players.length) return;
         if (!tournament.players) tournament.players = [];

         let id_map = Object.assign(...players.map(p => ({ [p.id]: p })));
         let existing_ids = tournament.players.map(p=>p.id);

         // check for overlap with existing players, add any newly retrieved attributes to existing
         tournament.players.forEach(p => { if (id_map[p.id]) Object.assign(p, id_map[p.id]); });

         // add any new players that don't already exist in tournament
         players.forEach(pushNewPlayer);
         if (save) saveTournament(tournament);
      }

      function printDraw() {
         let current_draw = displayed_draw_event.draw.compass ? displayed_draw_event.draw[displayed_draw_event.draw.compass] : displayed_draw_event.draw;
         var created = drawIsCreated(displayed_draw_event);

         if (created) {
            let qualifying = (displayed_draw_event && util.isMember(['Q', 'R'], displayed_draw_event.draw_type) && current_draw);
            let lucky_losers = qualifying ? dfx.drawInfo(current_draw).complete : undefined;

            let tree = Object.keys(tree_draw.data()).length;
            let rr = rr_draw && rr_draw.data().brackets && rr_draw.data().brackets.length;
            var data = tree ? tree_draw.data() : rr ? rr_draw.data() : undefined;
            var options = tree ? tree_draw.options() : rr ? rr_draw.options() : undefined;
            var selected_event = container.select_draw.ddlb ? container.select_draw.ddlb.getValue() : undefined;

            if (lucky_losers && state.edit) {
               let actions = displayGen.drawPDFmodal();
               displayGen.escapeModal();
               actions.drawsheet.element.addEventListener('click', () => {
                  if (data && options) printPDF();
                  displayGen.closeModal();
               });
               actions.signinsheet.element.addEventListener('click', () => {
                  let all_rounds = fx.fx.env().drawFx.ll_all_rounds;
                  let lucky_losers = mfx.getLuckyLosers(tournament, displayed_draw_event, all_rounds);

                  exportFx.orderedPlayersPDF({
                     tournament,
                     players: lucky_losers,
                     event_name: displayed_draw_event.name,
                     doc_name: `${lang.tr('draws.luckyloser')} ${lang.tr('print.signin')}`,
                     extra_pages: false
                  })
                  displayGen.closeModal();
               });
            } else if (data && options) {
               printPDF();
            }

            function printPDF() {
               exportFx.printDrawPDF({
                  data,
                  options,
                  tournament,
                  selected_event,
                  event: displayed_draw_event,
                  save: fx.fx.env().printing.save_pdfs
               });
            }
         } else {
            printDrawOrder(displayed_draw_event);
         }
      }

      function printSchedule() {
         let { completed_matches, pending_matches, upcoming_matches } = mfx.tournamentEventMatches({ tournament, source: true });
         let all_matches = completed_matches.concat(...pending_matches, ...upcoming_matches);

         // determine if there is a location filter
         let luids = tournament.locations.map(l=>l.luid);
         let luid = luids.length == 1 ? luids[0] : container.location_filter.ddlb.getValue();

         let courts = courtFx.courtData(tournament, luid);
         let day_matches = all_matches.filter(scheduledFilter);

         let scheduled_courts = util.unique(day_matches.map(m=>`${m.schedule.luid}|${m.schedule.index}`));
         let filtered_courts = courts.filter(c=>scheduled_courts.indexOf(`${c.luid}|${c.index}`) >= 0);

         exportFx.printSchedulePDF({
            courts: filtered_courts,
            tournament,
            day: displayed_schedule_day,
            matches: day_matches,
            save: fx.fx.env().printing.save_pdfs
         });
      }

      function printDrawOrder(evt) {
         evt = evt || tfx.findEventByID(tournament, displayed_event);

         // if no event or no approved players or category undefined, abort
         if (evt && evt.approved && evt.category) {
            let category = staging.legacyCategory(evt.category);
            let t_players;
            if (evt.format == 'S') {
               t_players = tournament.players
                  .filter(player=>evt.approved.indexOf(player.id) >= 0)
                  .filter(player=>player.signed_in);
            } else {
               let teams = tfx.approvedTeams({ tournament, e: evt })
                  .map(team => team.players.map(player => Object.assign(player, { seed: team.seed })));;
               return exportFx.doublesSignInPDF({
                  tournament,
                  teams,
                  save: fx.fx.env().printing.save_pdfs,
                  doc_name: `${lang.tr('dbl')} ${lang.tr('print.signin')}`
               });
            }

            if (t_players && t_players.length) {
               t_players = tfx.orderPlayersByRank(t_players, category);

               // configured for listing players by Position in draw "Draw Order"
               exportFx.orderedPlayersPDF({
                  tournament,
                  players: t_players,
                  event_name: evt.name,
                  doc_name: lang.tr('mdo'),
                  extra_pages: false,
                  save: fx.fx.env().printing.save_pdfs
               });
            }
         }
      }

      function printSignInList() {
         if (!tournament.players || !tournament.players.length) return;
         let t_players = tournament.players
            .filter(player=>filters.indexOf(player.sex) < 0)
            .filter(player=>(player.withdrawn == 'N' || !player.withdrawn) && !player.signed_in);

         if (!t_players.length) {
            // if there are no players who have not signed in, print a blank doubles sign-in sheet
            exportFx.doublesSignInPDF({
               tournament,
               save: fx.fx.env().printing.save_pdfs,
               doc_name: `${lang.tr('dbl')} ${lang.tr('print.signin')}`
            });
            return;
         }

         let sisobj = displayGen.signInSheetFormat();
         displayGen.escapeModal();
         sisobj.singles.element.addEventListener('click', () => {
            t_players = tfx.orderPlayersByRank(t_players, tournament.category);
            // default configuration is ordered Sign-In List
            exportFx.orderedPlayersPDF({
               tournament,
               players: t_players,
               save: fx.fx.env().printing.save_pdfs,
               doc_name: `${lang.tr('sgl')} ${lang.tr('print.signin')}`
            });
            displayGen.closeModal();
         });
         sisobj.doubles.element.addEventListener('click', () => {
            exportFx.doublesSignInPDF({
               tournament,
               save: fx.fx.env().printing.save_pdfs,
               doc_name: `${lang.tr('dbl')} ${lang.tr('print.signin')}`
            });
            displayGen.closeModal();
         });
      }

      function eventsTab() {
         if (!state.edit && (!tournament.events || !tournament.events.length)) {
            // hide events tab if there are no events and not in edit mode
            tabVisible(container, 'ET', false);
            // revert to the first tab (in this case tournament overview);
            displayTab(0);
            return;
         }

         let actions = d3.select(container.events_actions.element);
         if (state.edit) {
            actions.style('display', 'flex');
            actions.select('.add').style('display', 'inline');
         } else {
            actions.style('display', 'none');
            actions.select('.add').style('display', 'none');
            let detail_actions = d3.select(container.event_details.element);
            detail_actions.select('.save').style('display', 'none');
            detail_actions.select('.del').style('display', 'none');
         }

         eventList(false);
      }

      function approvedByRank(e) {
         // assumes that tournament.players is already sorted by rank
         if (e.format == 'S') {
            if (!e.wildcards) e.wildcards = [];
            if (!e.luckylosers) e.luckylosers = [];
            function isApproved(p) { return e.approved.indexOf(p.id) >= 0; }
            function isWildcard(p) { return e.wildcards.indexOf(p.id) >= 0; }
            function isLuckyLoser(p) { return e.luckylosers.indexOf(p.id) >= 0; }
            e.approved = !tournament.players ? [] : tournament.players.filter(p=>isApproved(p) || isWildcard(p) || isLuckyLoser(p)).map(p=>p.id);
         }
      }

      function approvedChanged(e, update_players=false) {
         eventName(e);
         approvedByRank(e);
         eventBackground(e);
         if (update_players) { eventPlayers(e); }
         if (e.draw_type == 'Q' && event_config && event_config.qualifiers) {
            event_config.qualifiers.ddlb.selectionBackground(!e.qualifiers ? 'red' : 'white');
         }
      }

      var modifyApproved = {
         push: function(e, id) {
            if (!state.edit || e.active) return;
            e.approved.push(id);
            e.draw_created = false;
            saveTournament(tournament);
            outOfDate(e);
            e.regenerate = 'modify: push';
            approvedChanged(e, true);
         },
         pushTeam: function(e, team) {
            if (!state.edit || e.active) return;
            e.approved.push(team.map(p=>p.id));
            e.draw_created = false;
            saveTournament(tournament);
            outOfDate(e);
            e.regenerate = 'modify: pushTeam';
            approvedChanged(e, true);
         },
         addAll: function(e) {
            if (!state.edit || e.active) return;
            warnIfCreated(e).then(doIt, () => { return; });
            function doIt() {
               e.approved = [].concat(...e.approved, ...tfx.eligiblePlayers(tournament, e).players.map(p=>p.id));
               saveTournament(tournament);
               outOfDate(e);
               e.regenerate = 'modify: addAll';
               approvedChanged(e, true);
            }
         },
         removeAll: function(e) {
            if (!state.edit || e.active) return;
            e.approved = [];
            e.draw_created = false;
            saveTournament(tournament);
            outOfDate(e);
            e.regenerate = 'modify: removeAll';
            e.wildcards = [];
            approvedChanged(e, true);
         },
         removeID: function(e, id) {
            if (!state.edit || e.active) return;
            e.draw_created = false;
            if (e.format == 'S') {
               e.approved = e.approved.filter(i=>i!=id);
               if (!e.wildcards) e.wildcards = [];
               e.wildcards = e.wildcards.filter(i=>i!=id);
               e.luckylosers = e.luckylosers.filter(i=>i!=id);
            }
            saveTournament(tournament);
            outOfDate(e);
            e.regenerate = 'modify: removeID';
            approvedChanged(e, true);
         },
      }

      function closeEventDetails() {
         searchBox.normalFunction();
         displayed_event = undefined;
         displayGen.hideEventDetails(container);
      }

      function closeLocationDetails() {
         searchBox.normalFunction();
         displayGen.hideLocationDetails(container);
      }

      function enableApprovePlayer(e) {
         if (!e) return;

         // first time we get eligible it is for populating Search Box
         let ineligible_players = tfx.ineligiblePlayers(tournament, e).players;
         let unavailable_players = tfx.unavailablePlayers(tournament, e).players;
         let eligible = tfx.eligiblePlayers(tournament, e, ineligible_players, unavailable_players).players;

         eligible.forEach(p => { if (p.order) p.full_name = `${p.full_name}&nbsp;<span class='player_order'>(${p.order})</span>`; });
         let approved = tfx.approvedPlayers({ tournament, env: fx.fx.env(), e });

         let searchable_players = [].concat(...eligible, ...approved);

         searchBox.category = 'players';
         searchBox.category_switching = false;
         searchBox.setSearchCategory(lang.tr('search.approve'));

         // populate search box with eligible AND approved
         searchBox.typeAhead.list = searchable_players.map(valueLabel);
         searchBox.irregular_search_list = true;

         playerFx.override = (plyr) => {
            let ineligible_players = tfx.ineligiblePlayers(tournament, e).players;
            let unavailable_players = tfx.unavailablePlayers(tournament, e).players;

            // second time we get eligible it is to check player status
            let eligible = tfx.eligiblePlayers(tournament, e, ineligible_players, unavailable_players).players;
            eligible.forEach(p => { if (p.order) p.full_name = `${p.full_name}&nbsp;<span class='player_order'>(${p.order})</span>`; });

            let el = eligible.map(e=>e.puid);

            if (eligible.map(e=>e.puid).indexOf(plyr.puid) >= 0) {
               if (e.format == 'S') {
                  modifyApproved.push(e, plyr.id);
               } else {
                  if (!e.teams) e.teams = [];
                  // return the index of any team that only has one player
                  let single = e.teams.map((t, i)=>t.length == 1 ? i : undefined).filter(f=>f!=undefined);

                  if (single.length) {
                     e.teams[single[0]].push(plyr.id);
                  } else {
                     e.teams.push([plyr.id]);
                  }
                  approvedChanged(e, true);
               }
            } else if (e.approved.indexOf(plyr.id) >= 0) {
                  modifyApproved.removeID(e, plyr.id);
            } else {
               if (e.format == 'D') {
                  let approved_team = e.approved.reduce((p, c) => { return (c.indexOf(plyr.id + '') >= 0) ? c : p; }, undefined);
                  let built_team = e.teams.reduce((p, c) => { return (c.indexOf(plyr.id + '') >= 0) ? c : p; }, undefined);

                  if (built_team && !approved_team) {
                     e.teams = e.teams.filter(team => util.intersection(built_team, team).length != 2);
                     approvedChanged(e, true);
                  } else if (approved_team) {
                     e.approved = e.approved.filter(team => util.intersection(built_team, team).length != 2);
                     approvedChanged(e, true);
                  }
               }
            }
         }
      }

      function eventList(regen_drawstab = false) {
         let events = [];
         let highlight_euid;
         if (tournament.events && tournament.events.length) {
            events = tournament.events.map((e, i) => {
               tfx.setDrawSize(tournament, e);
               if (displayed_event && displayed_event == e.euid) highlight_euid = e.euid;
               let info = !e.draw ? {} : e.draw.compass ? dfx.compassInfo(e.draw) : dfx.drawInfo(e.draw);

               let event_matches = mfx.eventMatches(e, tournament);
               let scheduled = event_matches.filter(m=>m.match && m.match.schedule && m.match.schedule.court).length;

               let draw_type_name = tfx.isPreRound({ env: fx.fx.env(), e }) ? lang.tr('draws.preround') : getKey(draw_types, e.draw_type); 

               return {
                  scheduled,
                  euid: e.euid,
                  name: e.name,
                  rank: e.rank,
                  active: e.active,
                  custom_category: e.custom_category,
                  category: e.category,
                  published: e.published,
                  up_to_date: e.up_to_date,
                  draw_created: drawIsCreated(e),
                  draw_size: e.draw_size || '0',  
                  // display_gender: getKey(genders, e.gender),
                  // display_format: getKey(formats, e.format),
                  total_matches: info.total_matches,
                  inout: e.inout,
                  surface: e.surface,
                  warning: e.draw_type == 'Q' && e.approved && e.approved.length && !e.qualifiers,
                  draw_type: e.draw_type,
                  draw_type_name,
                  opponents: e.approved.length + (e.draw_type == 'E' ? (e.qualifiers || 0) : 0),
               };
            });
         }

         displayGen.eventList(container, events, highlight_euid);
         function eventDetails(evt) {
            let clicked_event = util.getParent(evt.target, 'event');
            let class_list = clicked_event.classList;
            if (class_list.contains('highlight_listitem')) {
               closeEventDetails();
            } else {
               class_list.add('highlight_listitem');
               let euid = clicked_event.getAttribute('euid');
               let e = tfx.findEventByID(tournament, euid);
               displayEvent({e});
            }
         }
         // attach action to display event_details when clicking each event
         util.addEventToClass('event', eventDetails, container.events.element);
         util.addEventToClass('event', customEventCategory, container.events.element, 'contextmenu');
         util.addEventToClass('pubstate', eventPubState, container.events.element);
         util.addEventToClass('published_header', unpublishAllEvents, document, 'contextmenu');
         if (regen_drawstab) drawsTab();
         enableTournamentOptions();
      }

      function customEventCategory(evt) {
         let clicked_event = util.getParent(evt.target, 'event');
         let euid = clicked_event.getAttribute('euid');
         let evnt = tfx.findEventByID(tournament, euid);
         if (state.edit) {
            var coords = { x: evt.clientX, y: evt.clientY }
            // let coords = d3.mouse(selector);
            let cec_name_obj = displayGen.entryModal('nm', false, coords);
            displayGen.escapeModal();

            let entry_modal = d3.select(cec_name_obj.entry_modal.element);

            let removeEntryModal = () => {
               entry_modal.remove();
               document.body.style.overflow = null;
               displayGen.escapeFx = undefined;
            }

            entry_modal.on('click', removeEntryModal);
            cec_name_obj.search_field.element.value = evnt.custom_category || '';
            cec_name_obj.search_field.element.addEventListener("keyup", function(e) { 
               if (e.which == 13) {
                  submitCustomName(cec_name_obj.search_field.element.value);
                  removeEntryModal();
               }
            });

            function submitCustomName(name) {
               evnt.custom_category = name;
               evnt.broadcast_name = `${evnt.custom_category || evnt.category || ''} ${getKey(genders, evnt.gender)} ${getKey(formats, evnt.format)}`;
               saveTournament(tournament);
               eventList(true);
            }
         }
      }

      function eventPubState(evt, action) {
         if (!state.edit) return;
         evt.stopPropagation();
         let clicked_event = util.getParent(evt.target, 'event');
         let index = clicked_event.getAttribute('index');
         let event_data = tournament.events[index];

         if (fx.fx.env().publishing.require_confirmation) {
            displayGen.okCancelMessage(lang.tr('events.toggle'), pubAction, () => displayGen.closeModal());
         } else {
            pubAction();
         }

         function pubAction() {
            displayGen.closeModal();
            if (event_data.up_to_date) {
               unpublishEventDraw(event_data);
               eventList();
            } else {
               broadcastEvent(tournament, event_data, eventList);
            }
         }
      }

      function unpublishAllEvents() {
         if (!state.edit) return;
         displayGen.okCancelMessage(lang.tr('draws.unpublishall'), unPublishAll, () => displayGen.closeModal());
         displayGen.escapeModal();

         function unPublishAll() {
            let deleteTournamentEvents = { tuid: tournament.tuid, ouid: tournament.org.ouid };
            coms.emitTmx({ deleteTournamentEvents })
            displayGen.closeModal();
            tournament.events.forEach(evt => {
               evt.published = false;
               evt.up_to_date = false;
            });
            displayGen.drawBroadcastState(container.publish_state.element);
            unPublishOOP(tournament);
            eventList();
         }
      }

      function newTournamentEvent() {
         let genders_signed_in = tournamentGenders(tournament, dbmatches, (f)=>f.signed_in);

         let gender = '';
         if (genders_signed_in.length == 1) gender = genders_signed_in[0];

         let existing_gendered_singles = !tournament.events ? [] : tournament.events
            .filter(e => e.format == 'S' && e.draw_type == 'E')
            .map(e=>e.gender);

         if (!gender && genders_signed_in.length == 2 && existing_gendered_singles.length == 1) {
            gender = genders_signed_in.filter(g=>existing_gendered_singles.indexOf(g) < 0)[0];
         }

         let score_format = fx.fx.env().scoreboard.settings;
         let stb = score_format.final_set_supertiebreak ? '/S' : '';
         let scoring = `${score_format.max_sets}/${score_format.games_for_set}/${score_format.tiebreak_to}T${stb}`;

         let e = {
            gender,
            log: [],
            links: {},
            format: 'S',
            approved: [],
            wildcards: [],
            luckylosers: [],
            draw_size: '',
            draw_type: 'E',
            euid: displayFx.uuid(),
            scoring: '3/6/7T',
            automated: false,
            draw_created: false,
            category: tournament.category || '',
            rank: tournament.rank || '',
            surface: tournament.surface || 'C',
            inout: tournament.inout || '',
            score_format,
            scoring
         };
         displayEvent({e});
      }

      // when an event is deleted all references to it must also be deleted
      function removeReferences(evt) {
         if (!tournament.events) return;
         tournament.events.forEach(e => { 
            Object.keys(e.links).forEach(key => { 
               if (e.links[key] == evt.euid) {

                  // if an elminiation draw has been deleted that was linked to a RR draw, then RR draw is no longer qualifying draw
                  if (evt.draw_type == 'E' && e.draw_type == 'R' && e.draw) {
                     dfx.tallyBracketResults({ players: e.draw.opponents, matches: e.matches, qualifying: false });
                  }

                  delete e.links[key]; 
                  // TODO: is it necessary to regenerate a draw when its linked/ draw is deleted?
                  // e.regenerate = true;
               }
            }); 
         });
      }

      function enableEventTeams(e) {
         let player_detail = d3.select(container.detail_players.element);
         player_detail.select('.event_teams').style('display', e.format == 'D' ? 'flex' : 'none');
         player_detail.select('.team_players').style('display', e.format == 'D' ? 'flex' : 'none');
         player_detail.select('.eligible').select('.addall').style('display', e.format == 'S' ? 'flex' : 'none');
      }

      function eventBackground(e, background='white') {
         e = e || tfx.findEventByID(tournament, displayed_event);
         if (e.euid != displayed_event) return;
         if (!e) return;
         if (drawIsCreated(e)) background = '#EFFBF2';
         if (e.active) background = '#EFF5FB';
         if (tournament.events.map(v=>v.euid).indexOf(e.euid) < 0) background = 'lightyellow';
         container.event_details.element.querySelector('.detail_body').style.background = background;
      }

      function locationBackground(l, background='white') {
         if (!l) return;
         if (tournament.locations.map(v=>v.luid).indexOf(l.luid) < 0) background = 'lightyellow';
         container.location_details.element.querySelector('.detail_body').style.background = background;
      }

      function autoDrawVisibility(e) {
         let auto_setting = document.querySelector('.' + classes.auto_draw);
         auto_setting.style.display = e.structure == 'feed' || e.active || !state.edit || !fx.fx.env().draws.autodraw ? 'none' : 'inline';
      }

      function playerFilterVisibility(e) {
         let player_filter = document.querySelector('.' + classes.player_filter);
         let display = !e.ratings || e.active || !state.edit ? 'none' : 'inline';
         player_filter.style.display = display;
      }

      function getCategoryRatings(category) {
         let tournament_date = tournament && tournament.start;
         let calc_date = tournament_date ? new Date(tournament_date) : new Date();
         let points_table = fx.fx.pointsTable({calc_date});
         let ctgs = points_table && points_table.categories;
         let ratings = ctgs && ctgs[category] && ctgs[category].ratings;
         return ratings;
      }

      function displayEvent({ e, index } = {}) {
         e = e || (displayed_event ? tfx.findEventByID(tournament, displayed_event) : undefined);
         if (!e) return;

         if (!tournament.events) tournament.events = [];
         let event_index = tournament.events.map(m=>m.euid).indexOf(e.euid);
         index = index || (event_index >= 0 ? event_index : undefined);

         e.ratings = getCategoryRatings(e.category);

         let actions = d3.select(container.event_details.element);

         autoDrawVisibility(e);
         playerFilterVisibility(e);
         eventBackground(e);
         toggleAutoDraw(e.automated);

         // by default hidden
         let gem_seeding = document.querySelector('.' + classes.gem_seeding);
         if (gem_seeding) gem_seeding.style.display = 'none';
         // only toggle it if there is a true/false value
         if (e.gem_seeding != undefined) toggleGemSeeding(e.gem_seeding);
         if (e.player_filter != undefined) toggleGemSeeding(e.player_filter);

         displayed_event = e.euid;
         configureEventSelections(e);
         enableEventTeams(e);
         actions.style('display', 'flex');

         if (state.edit) {
            if (index != undefined) {

               enableApprovePlayer(e);

               actions.select('.save').style('display', 'none');
               actions.select('.cancel').style('display', 'none');
               actions.select('.del').style('display', 'inline')
                  .on('click', () => {
                     displayGen.escapeModal();
                     let message = `${lang.tr('actions.delete_event')}: ${e.name}?`;
                     displayGen.okCancelMessage(message, deleteTournamentEvent, () => displayGen.closeModal());
               });
               actions.select('.done').style('display', 'inline')
                  .on('click', () => {
                     closeEventDetails();
                     saveTournament(tournament);
                  });
            } else {
               actions.select('.del').style('display', 'none');
               actions.select('.done').style('display', 'none');
               actions.select('.save').style('display', 'inline')
                  .on('click', () => { 
                     if (!tournament.events) tournament.events = [];
                     displayed_event = e.euid;
                     e.automated = autoDrawSetting();
                     tournament.events.push(e);
                     coms.emitTmx({ 
                        event: 'Add Event',
                        version: fx.fx.env().version,
                        notice: `${tournament.name} => ${e.name} ${e.draw_type} ${e.automated ? 'Auto' : 'Manual'}` 
                     });

                     if (!tournament.log) tournament.log = [];
                     tournament.log.push({
                        created: { name: e.name, draw_type: e.draw_type, automated: e.automated },
                        timestamp: new Date().getTime()
                     });

                     let i = tournament.events.length - 1;
                     displayEvent({ e, index: i });
                     eventList();
                     tournament.categories = tfx.tournamentCategories(tournament);
                     saveTournament(tournament);
                  });
               actions.select('.cancel')
                  .style('display', 'inline')
                  .on('click', () => {
                     closeEventDetails();
                     removeReferences(e);
                  });
            }
         } else {
            actions.select('.done')
               .style('display', 'inline')
               .on('click', closeEventDetails);
         }

         function deleteTournamentEvent() {
            closeEventDetails();

            if (displayed_draw_event && displayed_draw_event.euid == e.euid) displayed_draw_event = null;

            // filter out matches from deleted event
            if (dbmatches) {
               dbmatches = dbmatches.filter(m=>m.event && m.event.euid != e.euid);
               ({ groups: match_groups, group_draws } = groupMatches(dbmatches));
            }

            // Delete any published events or matches
            deletePublishedEvent(tournament, e);

            tournament.events.splice(index, 1);
            removeReferences(e);

            // must occur *after* tournament events spliced
            updateScheduleStatus({ euid: e.euid });

            // hide any options no longer applicable
            enableTournamentOptions();

            // update events tab immediately
            eventsTab();

            if (!tournament.log) tournament.log = [];
            tournament.log.push({
               deleted: { name: e.name, draw_type: e.draw_type, log: e.log },
               timestamp: new Date().getTime()
            });

            // delete any event matches in database
            db.deleteEventMatches(tournament.tuid, e.euid)
               .then(() => db.deleteEventPoints(tournament.tuid, e.euid), util.logError)
               .then(reGen, util.logError);

            function reGen() {
               drawsTab();
               scheduleTab();
               matchesTab();
               pointsTab(tournament, container, filters);
            }

            tournament.categories = tfx.tournamentCategories(tournament);
            saveTournament(tournament);
            displayGen.closeModal();
         }

         eventPlayers(e);
      }

      function getKey(arr, value) {
         let pairs = arr.filter(a=>a.value == value);
         return pairs.length ? pairs[0].key : '';
      }

      function determineLinkedDraw(tournament, e, type, linkChanged) {
         if (!tournament.events || tournament.events.length < 1) return;

         var types = {
            'Q': ['Q', 'R'],
            'E': ['E'],
            'C': ['C'],
            'F': ['F'],
            'S': ['S'],
            'P': ['P'],
            'R': ['Q'],
         }

         let linkType = (type) => types[type].filter(t=>e.links[t]);

         let draw_types = {
            'Q': 'qualification',
            'R': 'qualification',
            'C': 'consolation',
            'E': 'elimination',
            'S': 'compass',
            'P': 'playoff',
         }

         let modifiers = { 'R': ' RR', }

         let events = tournament.events
            .filter(f => types[type].indexOf(f.draw_type) >= 0)
            .filter(f => f.gender == e.gender && f.format == e.format && f.category == e.category)
            .filter(f => existingLink(f) || !hasLinkType(f, e.draw_type))
            .map(m => ({ key: `${m.custom_category || m.category} ${m.name}${modifiers[m.draw_type] || ''}`, value: m.euid }));
         let options = [].concat({ key: 'None', value: '' }, ...events);
         if (!events.length) return false;

         function existingLink(f) {
            return Object.keys(f.links).map(k=>f.links[k]).indexOf(e.euid) >= 0;
         }
         function hasLinkType(v, typ) {
            let kys = ((v.links && Object.keys(v.links)) || []).filter(k=>v.links[k]);
            return types[typ] && util.intersection(kys, types[typ]).length > 0;
         }

         let setLink = (value) => {
            let previous_link = e.links[linkType(type)];
            let linked_event = tfx.findEventByID(tournament, value);

            if (linked_event.draw_type == 'R' && linked_event.draw) {
               dfx.tallyBracketResults({ players: linked_event.draw.opponents, matches: linked_event.matches, qualifying: true });
            }

            if (e.draw_type == 'R' && e.draw && linked_event.draw_type == 'E') {
               dfx.tallyBracketResults({ players: e.draw.opponents, matches: e.matches, qualifying: true });
            }

            let link = linked_event ? linked_event.draw_type : linkType(type);
            e.links[link] = value;

            // link in the opposite direction as well...
            if (linked_event) {
               linked_event.links[e.draw_type] = e.euid;
               if (linked_event.draw_type == 'E' && e.draw_type != 'C') { linked_event.regenerate = 'setLink'; }
               if (linked_event.draw_type == 'R') { tfx.determineRRqualifiers(tournament, linked_event); }
               if (linked_event.draw_type == 'Q') { checkForQualifiedTeams(linked_event); }
               if (['C', 'R', 'Q'].indexOf(linked_event.draw_type) >= 0) {
                  linked_event.rank = e.rank;
                  container.rank.ddlb.unlock();
               } else {
                  e.rank = linked_event.rank;
                  container.rank.ddlb.setValue(e.rank, 'white');
                  container.rank.ddlb.lock();
               }

               if (!e.approved) e.approved = [];
               let qualified = linked_event.qualified ? linked_event.qualified.map(teamHash) : [];
               if (e.draw_type != 'C') e.approved = [].concat(...e.approved, ...qualified);
            } else {
               container.rank.ddlb.unlock();
            }

            // remove any previous links
            if (previous_link) {
               let previous_linked_event = tfx.findEventByID(tournament, previous_link);
               previous_linked_event.links[e.draw_type] = undefined;
               previous_linked_event.regenerate = 'previousLink';
               if (previous_linked_event.draw_type == 'R' && previous_linked_event.draw) {
                  dfx.tallyBracketResults({ players: previous_linked_event.draw.opponents, matches: previous_linked_draw.matches, qualifying: false });
               }
            }

            saveTournament(tournament);
            if (linkChanged && typeof linkChanged == 'function') linkChanged(value);
            eventList(true);
         }

         let etype = draw_types[type];
         d3.select(container.draw_config.element).select('.' + etype).style('display', 'flex');
         event_config[etype].ddlb = new dd.DropDown({ element: event_config[etype].element, onChange: setLink });
         event_config[etype].ddlb.setOptions(options);
         event_config[etype].ddlb.setValue(e.links[linkType(type)] || '', 'white');

         return Object.keys(e.links).indexOf(type) >= 0;
      }

      function qualifyingDrawSizeOptions(e) {
         let approved_count = e.approved && e.approved.length ? Math.max(e.approved.length, 1) : 1;
         // for round robin draws its possible to qualify all players
         // for normal qualification pre-rounds its possible to approved_count-1
         // range function returns 0 through upper_range-1
         let upper_range = e.draw_type == 'R' ? approved_count + 1: Math.min(16, approved_count);
         let range = util.range(0, upper_range);
         let qbs = fx.fx.env().drawFx.qualifying_bracket_seeding;
         if (!qbs) range = range.filter(v => v == util.nearestPow2(v));
         let max_qualifiers = Math.max(...range);
         let options = range.map(c => ({ key: c, value: c }));
         return { max_qualifiers, options }
      }

      function validBracketSize(opponents, size) {
         if (opponents == size) return true;
         if (opponents < size) return (size - opponents) == 1;
         let min_brackets = Math.ceil(opponents/size);
         let positions_with_max_byes = min_brackets * (size - 1);
         return positions_with_max_byes <= opponents;
      }

      function roundRobinDrawBracketOptions(e) {
         let opponents = e.approved.length;
         var bracket_sizes = fx.fx.env().draws.rr_draw.brackets;
         let lower_range = bracket_sizes.min_bracket_size;
         let upper_range = Math.min(bracket_sizes.max_bracket_size, opponents);

         e.bracket_size = (e.bracket_size && validBracketSize(opponents, e.bracket_size)) ? e.bracket_size : (bracket_sizes.default_bracket_size || lower_range);

         let size_range = util.range(lower_range, upper_range + 1).filter(v=>validBracketSize(opponents, v));
         let size_options = size_range.map(c => ({ key: c, value: c }));

         let min_brackets = Math.ceil(opponents / e.bracket_size);
         let max_brackets = Math.floor(opponents / (e.bracket_size - 1));

         let range = util.range(min_brackets, max_brackets + 1);
         let options = range.map(c => ({ key: c, value: c }));

         if (e.brackets && (e.brackets < min_brackets || e.brackets > max_brackets)) e.brackets = min_brackets;

         e.brackets = e.brackets || min_brackets;

         let below_player_threshold = opponents < lower_range;
         let below_maximum = e.bracket_size < upper_range;

         // don't allow more byes than brackets
         let byes = (e.brackets * e.bracket_size) - opponents;

         if (byes > e.brackets) {
            if (e.bracket_size > lower_range && e.brackets * (e.bracket_size - 1) >= opponents) {
               // decrease the bracket size
               e.bracket_size -= 1;
            } else if (e.brackets > 1 && ((e.brackets - 1) * e.bracket_size) >= opponents) {
               // decrease the # of brackets, if that leaves enough room for all opponents
               e.brackets -= 1;
            } else if (e.bracket_size < upper_range && ((e.bracket_size + 1) * (e.brackets - 1) >= opponents))  {
               // increase bracket_size while decreasing # brackets
               e.brackets -= 1;
               e.bracket_size += 1;
            }
         }

         return { options, size_options }
      }

      function setRRQualifiers(e) {
         let min_qualifiers = (e.approved && e.approved.length ? 1 : 0) * e.brackets;
         let max_qualifiers = min_qualifiers * 3;
         let range = util.range(min_qualifiers, max_qualifiers + 1);
         let options = range.map(c => ({ key: c, value: c }));
         event_config.qualifiers.ddlb.setOptions(options);
         if (e.qualifiers > max_qualifiers) e.qualifiers = max_qualifiers;
         event_config.qualifiers.ddlb.setValue(e.qualifiers);
         event_config.qualifiers.ddlb.selectionBackground(!e.qualifiers ? 'red' : 'white');
      }

      function configDrawType(e) {
         function linkChanged() { return eventPlayers(e); }
         var supported_structures = fx.fx.env().draws.structures;

         var skip_options = [0, 1, 2, 3].map(v=>({ key: v, value: v}));
         var feed_options = [0, 1, 2, 3, 4].map(v=>({ key: v, value: v}));
         var sequential_options = [1, 2, 3, 4].map(v=>({ key: v, value: v}));

         // future: sequential feed-in at same round
         var seql_options = [1, 2, 3, 4].map(v=>({ key: v, value: v}));

         function setStructure(value) {
            e.structure = value;
            toggleStructureConfig();
            eventList(true);
            autoDrawVisibility(e);
         }

         function toggleStructureConfig() {
            let disp = e.structure == 'feed' ? 'flex' : 'none';
            Array.from(container.draw_config.element.querySelectorAll('.feedconfig'))
               .forEach(o=>o.style.display = disp);
         }

         function setFeedRounds(value) {
            e.feed_rounds = value;
         }

         function setSkipRounds(value) {
            e.skip_rounds = value;
         }

         function setRoundLimit(value) {
            e.max_round = value ? value : undefined;
         }

         function setQualifiers(value) {
            e.qualifiers = +value;
            eventName(e);

            let linked = tfx.findEventByID(tournament, e.links['E']);
            if (linked) {
               // remove any qualified players from linked draw approved
               let qual_hash = !e.qualified ? [] : e.qualified.map(teamHash);
               linked.approved = linked.approved.filter(a=>qual_hash.indexOf(a) < 0);
               linked.regenerate = 'linkChanged linked';
            }

            e.qualified = [];
            e.regenerate = 'linkChanged';

            if (e.draw_type == 'R' && linked) tfx.determineRRqualifiers(tournament, e);
            saveTournament(tournament);

            setTimeout(function() { event_config.qualifiers.ddlb.selectionBackground(!e.qualifiers ? 'red' : 'white'); }, 300);
            drawsTab();
         }

         function removeStructure() {
            delete e.structure;
            delete e.feed_rounds;
            delete e.skip_rounds;
            delete e.sequential;
         }

         function setQualificationConfig() {
            if (e.structure == 'feed') removeStructure();
            let structure_options = [{ key: lang.tr('draws.standard'), value: 'standard' }];

            let { max_qualifiers, options } = qualifyingDrawSizeOptions(e);
            event_config = displayGen.configQualificationDraw({ container, e, structure_options, skip_options, feed_options, sequential_options, qualcounts: options });
            event_config.qualifiers.ddlb = new dd.DropDown({ element: event_config.qualifiers.element, onChange: setQualifiers });
            event_config.qualifiers.ddlb.setValue(Math.min(e.qualifiers || 0, max_qualifiers) || 0);
            event_config.qualifiers.ddlb.selectionBackground(!e.qualifiers ? 'red' : 'white');
            event_config.structure.ddlb = new dd.DropDown({ element: event_config.structure.element, onChange: setStructure });
            event_config.structure.ddlb.setValue(e.structure || 'standard', 'white');

            determineLinkedDraw(tournament, e, 'E', linkChanged);
         }

         function setEliminationConfig() {
            var structure_options = [{ key: lang.tr('draws.standard'), value: 'standard' }, ];
            if (supported_structures.feedin.elimination) structure_options.push({ key: lang.tr('draws.staggered'), value: 'feed'});
            if (e.structure == 'feed' && !supported_structures.feedin.elimination) delete e.structure;

            event_config = displayGen.configTreeDraw({ container, e, structure_options, skip_options, feed_options, sequential_options });
            event_config.structure.ddlb = new dd.DropDown({ element: event_config.structure.element, onChange: setStructure });
            event_config.structure.ddlb.setValue(e.structure || 'standard', 'white');

            if (e.feed_rounds == undefined) e.feed_rounds = 0;
            event_config.feedrounds.ddlb = new dd.DropDown({ element: event_config.feedrounds.element, onChange: setFeedRounds });
            event_config.feedrounds.ddlb.setValue(e.feed_rounds, 'white');
            event_config.skiprounds.ddlb = new dd.DropDown({ element: event_config.skiprounds.element, onChange: setSkipRounds });
            event_config.skiprounds.ddlb.setValue(e.skip_rounds || 0, 'white');
            event_config.sequential.ddlb = new dd.DropDown({ element: event_config.sequential.element, onChange: setSkipRounds });
            event_config.sequential.ddlb.setValue(e.sequential || 1, 'white');

            determineLinkedDraw(tournament, e, 'Q', linkChanged);
            if (fx.fx.env().drawFx.consolation_from_elimination) determineLinkedDraw(tournament, e, 'C', linkChanged);
         }

         function setPlayoffConfig() {
            if (e.structure == 'feed') removeStructure();
            let structures = [{ key: lang.tr('draws.standard'), value: 'standard' }];

            event_config = displayGen.configTreeDraw({ container, e, structure_options: structures });
            event_config.structure.ddlb = new dd.DropDown({ element: event_config.structure.element, onChange: setStructure });
            event_config.structure.ddlb.setValue(e.structure || 'standard', 'white');

            determineLinkedDraw(tournament, e, 'E', linkChanged);
         }

         function setConsolationConfig() {
            var structure_options = [{ key: lang.tr('draws.standard'), value: 'standard' }, ];
            if (supported_structures.feedin.consolation) structure_options.push({ key: lang.tr('draws.feedin'), value: 'feed'});
            if (e.structure == 'feed' && !supported_structures.feedin.consolation) delete e.structure;

            event_config = displayGen.configTreeDraw({ container, e, structure_options });

            Array.from(container.draw_config.element.querySelectorAll('.roundlimit')).forEach(o=>o.style.display = 'flex');
            event_config.roundlimit.ddlb = new dd.DropDown({ element: event_config.roundlimit.element, onChange: setRoundLimit });
            event_config.roundlimit.ddlb.setValue(e.max_round || '-', 'white');

            let round_limit_options = [{ key: '-', value: ''}, { key: 1, value: 1 }, { key: 2, value: 2 }, { key: 3, value: 3 }];
            event_config.roundlimit.ddlb.setOptions(round_limit_options);

            event_config.structure.ddlb = new dd.DropDown({ element: event_config.structure.element, onChange: setStructure });
            event_config.structure.ddlb.setValue(e.structure || 'standard', 'white');

            if (e.feed_rounds == undefined) e.feed_rounds = 0;
            event_config.feedrounds.ddlb = new dd.DropDown({ element: event_config.feedrounds.element, onChange: setFeedRounds });
            event_config.feedrounds.ddlb.setValue(e.feed_rounds, 'white');
            event_config.skiprounds.ddlb = new dd.DropDown({ element: event_config.skiprounds.element, onChange: setSkipRounds });
            event_config.skiprounds.ddlb.setValue(e.skip_rounds || 0, 'white');

            delete e.sequential;

            if (fx.fx.env().drawFx.consolation_from_elimination) determineLinkedDraw(tournament, e, 'E', linkChanged);
            if (fx.fx.env().drawFx.consolation_from_qualifying) determineLinkedDraw(tournament, e, 'Q', linkChanged);
         }

         function setRoundRobinConfig() {
            if (e.structure == 'feed') removeStructure();
            let { options, size_options } = roundRobinDrawBracketOptions(e);

            event_config = displayGen.configRoundRobinDraw(container, e, options, size_options);
            event_config.qualifiers.ddlb = new dd.DropDown({ element: event_config.qualifiers.element, onChange: setQualifiers });
            event_config.qualifiers.ddlb.setValue(e.qualifiers || e.brackets, 'white');
            e.qualifiers = e.qualifiers || e.brackets;
            event_config.qualifiers.ddlb.selectionBackground(!e.qualifiers ? 'red' : 'white');

            let setBracketSize = (value) => {
               e.bracket_size = +value;
          
               let opponents = e.approved.length;
               let min_brackets = Math.ceil(opponents / e.bracket_size);
               let max_brackets = Math.floor(opponents / (e.bracket_size - 1));
               let range = util.range(min_brackets, max_brackets + 1);
               let options = range.map(c => ({ key: c, value: c }));
               event_config.brackets.ddlb.setOptions(options);

               e.brackets = Math.ceil(e.approved.length / e.bracket_size);

               event_config.brackets.ddlb.setValue(e.brackets, 'white');

               e.qualifiers = e.brackets;

               setRRQualifiers(e);
               e.regenerate = 'bracketSize';
               eventList(true);
            }

            let setBrackets = (value) => {
               e.brackets = value;
               e.qualifiers = e.brackets;
               setRRQualifiers(e);
               e.regenerate = 'setBrackets';
               eventList(true);
            }

            event_config.brackets.ddlb = new dd.DropDown({ element: event_config.brackets.element, onChange: setBrackets });
            event_config.brackets.ddlb.setValue(e.brackets, 'white');

            event_config.bracket_size.ddlb = new dd.DropDown({ element: event_config.bracket_size.element, onChange: setBracketSize });
            event_config.bracket_size.ddlb.setValue(e.bracket_size, 'white');

            let displayQualifiers = (bool) => {
               let display = bool ? 'flex' : 'none';
               let cfg = d3.select(container.draw_config.element);
               cfg.selectAll('.qualifiers').style('display', display);
               setRRQualifiers(e);
               eventList(true);
            }
            let linkValue = (value) => {
               displayQualifiers(value);
               linkChanged();
            }
            let linked = determineLinkedDraw(tournament, e, 'E', linkValue);
            displayQualifiers(linked);
         }

         var drawTypes = {
            'R': () => setRoundRobinConfig(),
            'E': () => setEliminationConfig(),
            'C': () => setConsolationConfig(),
            'Q': () => setQualificationConfig(),
            'P': () => setPlayoffConfig(),
         }

         if (drawTypes[e.draw_type]) drawTypes[e.draw_type]();
         tfx.setDrawSize(tournament, e);
         setAvailableDrawTypes(e);
         toggleStructureConfig();

         // certain draw types, such as Consolation, will have no event players until linked draws have begun play
         eventPlayers(e);
      }

      function configureLocationAttributes(l) {
         let disabled = !state.edit
         let attributes = displayGen.displayLocationAttributes(container, l, state.edit);

         let field_order = [ 'abbreviation', 'name', 'address', 'courts', 'identifiers' ];
         let constraints = { 'abbreviation': { length: 3 }, 'name': { length: 5 }, 'address': { length: 5 }, 'courts': { number: true } };
         field_order.forEach(field => {
            attributes[field].element.addEventListener('keydown', catchTab, false);
            attributes[field].element.value = l[field] || '';
            attributes[field].element.disabled = disabled;
            attributes[field].element.style.border = disabled ? 'none' : '';
            attributes[field].element.addEventListener('keyup', (evt) => defineAttr(field, evt, constraints[field]));
            defineAttr(field, undefined, constraints[field], attributes[field].element);
         });

         setTimeout(function() { attributes.abbreviation.element.focus(); }, 50);

         function nextFieldFocus(field, increment=1, delay=50) {
            let next_field = field_order.indexOf(field) + increment;
            if (next_field == field_order.length) next_field = 0;
            if (next_field < 0) next_field = field_order.length - 1;
            setTimeout(function() { attributes[field_order[next_field]].element.focus(); }, delay);
            saveTournament(tournament);
         }

         function defineAttr(attr, evt, required, element) {
            if (evt) element = evt.target;
            if (!evt && !element) return;
            let value = element.value.trim();
            l[attr] = value;
            if (required) {
               let valid = false;
               if (typeof required != 'object') {
                  valid = value;
               } else if (value) {
                  if (required.length && value.length >= required.length) valid = true;
                  if (required.number && isNaN(value)) element.value = 0;
                  if (required.number && !isNaN(value)) {
                     element.value = parseInt(value);
                     l[attr] = element.value;
                     valid = true;
                  }
               }
               attributes[attr].element.style.background = valid ? 'white' : 'yellow';
            }
            let increment = (evt && evt.which == 9 && evt.shiftKey) ? -1 : 1;
            if (evt && (evt.which == 13 || evt.which == 9)) nextFieldFocus(attr, increment);
         }
      }

      function luckyLosersOption(evt,e) {
         if (!e || !e.draw || e.draw_type == 'C') return;
         let competitors = [].concat(...e.draw.opponents.map(team=>team.map(p=>p.id)));
         let linkedQ = tfx.findEventByID(tournament, e.links['Q']) || tfx.findEventByID(tournament, e.links['R']);
         let linked_info = linkedQ && linkedQ.draw ? dfx.drawInfo(linkedQ.draw) : undefined;

         if (!linked_info) return;

         let losing_teams = [];

         if (linked_info.draw_type == 'tree' && linked_info.match_nodes) {
            losing_teams = linked_info.match_nodes.filter(n=>n.data.match && n.data.match.loser).map(n=>n.data.match.loser);
         } else {
            if (!linked_info.complete) {
               displayGen.okCancelMessage(lang.tr('phrases.qualincomplete'), () => displayGen.closeModal());
               return;
            }
            let qualified_ids = linkedQ.qualified.map(q=>q[0].id);
            let all_losses = linked_info.matches.filter(m=>m.loser).map(n=>n.loser).filter(l=>qualified_ids.indexOf(l[0].id)<0);
            let lids = util.unique(all_losses.map(l=>l[0].id));
            losing_teams = linkedQ.draw.opponents.filter(o=>lids.indexOf(o[0].id)>=0);
         }

         // losers from linked draw excluding losers who have already been substituted
         let losers = tfx.teamSort(losing_teams).filter(l=>util.intersection(l.map(p=>p.id), competitors).length == 0);

         // if the qualifying event *also* has a linked consolation event, exclude any players who have been approved for that event
         let consolation = tfx.findEventByID(tournament, linkedQ.links['C']);
         if (consolation) losers = losers.filter(l=>util.intersection(l.map(p=>p.id), consolation.approved).length == 0);
         if (!losers.length) return;

         // if qualification draw is round-robin, sort losers by GEM score
         if (e.links['R']) losers.sort((a, b) => ((b[0].results && b[0].results.ratio_hash) || 0) - ((a[0].results && a[0].results.ratio_hash) || 0) );

         let teams = optionNames(losers, true);
         let clickAction = (d, i) => {
            let loser = losers[i].map(player => Object.assign({}, player))[0];
            if (!e.luckylosers) e.luckylosers = [];
            e.luckylosers.push(loser.id);
            modifyApproved.push(e, loser.id);
            saveTournament(tournament);
            outOfDate(e);
         }
         let bod = d3.select('body').node();
         displayGen.svgModal({ x: evt.clientX, y: evt.clientY, options: teams, callback: clickAction });
      }

      function availableDrawTypes(e) {
         let filtered_event_types = tournament.events
            .filter(evt => evt.euid != e.euid && evt.category == e.category && evt.gender == e.gender)
            .map(evt => evt.draw_type);
         if (filtered_event_types.indexOf('E') >= 0) return draw_types;
         return draw_types.filter(dt=>['C', 'P'].indexOf(dt.value) < 0);
      }

      function setAvailableDrawTypes(e) {
         let available = availableDrawTypes(e);
         container.draw_type.ddlb.setOptions(available);
         let current_value = container.draw_type.ddlb.getValue();
         if (available.map(a=>a.value).indexOf(current_value) < 0) { container.draw_type.ddlb.setValue('E', 'white'); }
      }

      function eventName(e) {
         e.name = `${getKey(genders, e.gender)} ${getKey(formats, e.format)}`;
         e.broadcast_name = `${e.custom_category || e.category || ''} ${getKey(genders, e.gender)} ${getKey(formats, e.format)}`;
         displayGen.setEventName(container, e);
         eventList();
      }

      function configureEventSelections(e) {
         eventName(e);

         let details = displayGen.displayEventDetails({
            tournament,
            container,
            e,
            genders,
            inout,
            surfaces,
            formats,
            draw_types: availableDrawTypes(e),
            edit: state.edit
         });

         Object.assign(container, details);

         let addAll = () => modifyApproved.addAll(e);
         let removeAll = () => modifyApproved.removeAll(e);
         let promoteAll = () => promoteTeams(e);

         container.eligible.element.addEventListener('contextmenu', evt=>luckyLosersOption(evt,e));

         util.addEventToClass('addall', addAll, container.detail_players.element);
         util.addEventToClass('removeall', removeAll, container.detail_players.element);
         util.addEventToClass('promoteall', promoteAll, container.detail_players.element);

         let filterGender = (value) => {
            if (e.gender != value) { e.regenerate = 'filterGender'; }
            e.gender = value;
            configDrawType(e);
            eventPlayers(e);
            eventName(e);
         }
         details.gender.ddlb = new dd.DropDown({ element: details.gender.element, onChange: filterGender });
         details.gender.ddlb.setValue(e.gender || '', 'white');

         let filterCategory = (value) => {
            if (e.category != value) { e.regenerate = 'filterCategory'; }
            e.category = value;
            e.ratings = getCategoryRatings(e.category);
            eventPlayers(e);
            eventName(e);
         }
         details.category.ddlb = new dd.DropDown({ element: details.category.element, onChange: filterCategory });
         details.category.ddlb.selectionBackground('white');
         if (e.category || tournament.category) {
            let ctgy = e.category || tournament.category;
            details.category.ddlb.setValue(ctgy, 'white');
            // if (tournament.category) details.category.ddlb.lock();
         }

         let setFormat = (value) => { 
            // cleanup
            delete e.teams;
            modifyApproved.removeAll(e);

            e.regenerate = 'setFormat';
            e.format = value; 

            if (e.format == 'D') {
               e.scoring = e.scoring || '3/6/7T/S'
               displayScoring(e.scoring);
            } else {
               e.scoring = e.scoring || '3/6/7T';
               displayScoring(e.scoring);
            }

            eventName(e);
            configDrawType(e);
            enableEventTeams(e);
            saveTournament(tournament);
            outOfDate(e);
         }

         details.format.ddlb = new dd.DropDown({ element: details.format.element, onChange: setFormat });
         if (e.format || tournament.format) details.format.ddlb.setValue(e.format || tournament.format, 'white');
         details.format.ddlb.setValue(e.format || 'S', 'white');

         let setRank = (value) => { 
            e.rank = value; 
            matchesTab();
            eventList(true);
            if (e.draw_type == 'E' && e.links && Object.keys(e.links).length) {
               Object.keys(e.links).forEach(key => {
                  let linked_event = tfx.findEventByID(tournament, e.links[key]);
                  linked_event.rank = e.rank;
               });
            }
            saveTournament(tournament);
         }
         details.rank.ddlb = new dd.DropDown({ element: details.rank.element, onChange: setRank });
         if (tournament.rank && !e.rank) e.rank = tournament.rank;
         if (e.rank) {
            details.rank.ddlb.setValue(e.rank, 'white');
         } else {
            details.rank.ddlb.selectionBackground('white');
         }

         let existing_links = e.links && Object.keys(e.links).map(k=>e.links[k]).reduce((p, c) => c || p, undefined);
         if (existing_links && e.draw_type != 'E') {
            details.rank.ddlb.lock();
         } else {
            details.rank.ddlb.unlock();
         }

         let setSurface = (value) => { 
            e.surface = value; 
            eventList(true);
            saveTournament(tournament);
         }
         details.surface.ddlb = new dd.DropDown({ element: details.surface.element, onChange: setSurface });
         // preset handles situation where surface is a full name rather than a single character
         let preset = e.surface || tournament.surface || 'C';
         details.surface.ddlb.setValue(preset.toUpperCase()[0], 'white');

         let setInOut = (value) => { 
            e.inout = value; 
            eventList(true);
            saveTournament(tournament);
         }
         details.inout.ddlb = new dd.DropDown({ element: details.inout.element, onChange: setInOut });
         details.inout.ddlb.setValue(e.inout || tournament.inout || '', 'white');

         let setDrawType = (value) => { 
            if (e.draw_type != value) { e.regenerate = 'setDrawType'; }
            e.draw_type = value; 

            // clean up any existing links/references
            e.links = {};
            removeReferences(e);

            // there can't be any approved players when switching draw type to consolation
            if (value == 'C') e.approved = [];

            if (value == 'E') {
               details.format.ddlb.unlock();
            } else {
               e.format = 'S';
               details.format.ddlb.setValue('S', 'white');
               details.format.ddlb.lock();
               enableEventTeams(e);
            }

            configDrawType(e);
            eventName(e);
            saveTournament(tournament);
         }
         details.draw_type.ddlb = new dd.DropDown({ element: details.draw_type.element, onChange: setDrawType });
         details.draw_type.ddlb.setValue(e.draw_type || 'E', 'white');
         configDrawType(e);

         let displayScoring = (scoring_format) => details.scoring.element.innerHTML = scoring_format;
         let changeScoring = () => {
            if (state.edit) {
               document.body.style.overflow  = 'hidden';
               let cfg_obj = scoreBoard.scoreBoardConfig();
               let sb_config = d3.select(cfg_obj.config.element);

               let stg = Object.assign({}, e.score_format, fx.fx.env().scoreboard.settings);
               scoreBoard.configureScoring({ sobj: cfg_obj, stg });
               sb_config.on('click', removeConfigScoring);
               cfg_obj.cancel.element.addEventListener('click', removeConfigScoring)
               cfg_obj.accept.element.addEventListener('click', modifyEventScoring)

               function modifyEventScoring() {
                  let max_sets = parseInt(cfg_obj.bestof.ddlb.getValue());
                  let sets_to_win = Math.ceil(max_sets/2);
                  let sf = {
                     max_sets,
                     sets_to_win,
                     games_for_set: parseInt(cfg_obj.setsto.ddlb.getValue()),
                     tiebreaks_at: parseInt(cfg_obj.tiebreaksat.ddlb.getValue()),
                     tiebreak_to: parseInt(cfg_obj.tiebreaksto.ddlb.getValue()),
                     supertiebreak_to: parseInt(cfg_obj.supertiebreakto.ddlb.getValue()),
                     final_set_supertiebreak: cfg_obj.finalset.ddlb.getValue() == 'N' ? false : true,
                  }
                  e.score_format = sf;
                  modifyUnscoredMatches(sf);
                  let stb = sf.final_set_supertiebreak ? '/S' : '';
                  e.scoring = `${sf.max_sets}/${sf.games_for_set}/${sf.tiebreak_to}T${stb}`;
                  removeConfigScoring();
                  saveTournament(tournament);
               }

               function modifyUnscoredMatches(sf) {
                  let info = e.draw && dfx.drawInfo(e.draw);
                  if (info && info.match_nodes) {
                     // update scoring format for unfinished matches
                     info.match_nodes.forEach(node => modify(node.data.match));
                  } else if (info && info.matches) {
                     // update scoring format for unfinished RR matches
                     info.matches.forEach(modify);
                  }
                  function modify(match) { if (!match.winner) { match.score_format = sf; } }
               }

               function removeConfigScoring() {
                  displayScoring(e.scoring);
                  sb_config.remove();
                  document.body.style.overflow = null;
               }
            }
         }

         details.scoring.element.addEventListener('click', changeScoring);
         displayScoring(e.scoring || '3/6/7T');

         // TODO: perhaps it is better to create the DDLBs in locked state
         // and then UNLOCK the ones that should be unlocked?
         if (!state.edit || e.active) {
            details.gender.ddlb.lock();
            details.category.ddlb.lock();
            details.format.ddlb.lock();
            if (!state.edit) details.surface.ddlb.lock();
            if (!state.edit) details.inout.ddlb.lock();
            if (!state.edit) details.rank.ddlb.lock();
            details.draw_type.ddlb.lock();
            if (event_config) {
               Object.keys(event_config).forEach(key => { 
                  let lock = (e.draw_type == 'R' && key == 'qualifiers') ? false : true;
                  if (event_config[key].ddlb && lock) event_config[key].ddlb.lock(); 
               });
            }
         }
      }

      /**
       * @params {obj}  evt   event object
       *
       * if event has been created confirm that draw will be regenerated if proceeding with player/team changes
       */
      function warnIfCreated(evnt) {
         return new Promise((resolve, reject) => {
            if (evnt.draw_created) {
               let message = `
                  <b style='color: red'>${lang.tr('warn')}:</b>
                  <p>
                  ${lang.tr('phrases.changeapproved')}
                  </p>
                  ${lang.tr('continue')}
               `;
               displayGen.okCancelMessage(message, doIt, cancelAction);
            } else {
               doIt();
            }
            function doIt() {
               displayGen.closeModal();
               resolve();
            }
            function cancelAction() {
               displayGen.closeModal();
               reject();
            }
         });
      }

      function promoteTeams(e) {
         if (!state.edit || e.active) return;
         warnIfCreated(e).then(doIt, () => { return; });
         function doIt() {
            let approved_hash = e.approved.map(a=>a.join('|'));
            let not_promoted = e.teams.filter(team => approved_hash.indexOf(team.join('|')) < 0).filter(team => team.length == 2);
            e.approved = [].concat(e.approved, not_promoted);
            saveTournament(tournament);
            approvedChanged(e, true);
         }
      }

      function eventTeams(e) {
         if (!e.teams || !e.teams.length) return [];

         var idm = tfx.idMap(tournament, e);
         var idmap = idm.idmap;
         if (idm.changed) approvedChanged(e);

         var approved_hash = e.approved.map(a=>a.sort().join('|'));
         function teamHash(team) { return team.sort().join('|'); }
         function notApproved(team) { return approved_hash.indexOf(teamHash(team)) < 0; }
         function notWC(team) { return !e.wildcards || e.wildcards.indexOf(teamHash(team)) < 0; }
         function notLL(team) { return !e.luckylosers || e.luckylosers.indexOf(teamHash(team)) < 0; }
         var not_promoted = e.teams.filter(team => notApproved(team) && notWC(team) && notLL(team));

         var dbls_rankings = tournament.players.reduce((p, c) => c.category_dbls || p, false);
         var teams = not_promoted.map(t=>tfx.teamObj(e, t, idmap)).sort(tfx.combinedRankSort);
         teams.forEach(team => team.rank = team.combined_rank || team.combined_dbls_rank);

         return teams;
      }

      function checkForQualifiedTeams(e) {
         if (e.draw_type != 'Q') return;
         let qualifiers = dfx.drawInfo(e.draw).final_round_players;
         let qualified = qualifiers ? qualifiers.filter(f=>f) : [];
         qualified.forEach(team => tfx.qualifyTeam({ tournament, env: fx.fx.env(), e, team }));
      }

      function generateDraw(e, delete_existing) {
         try { drawGeneration(e, delete_existing); }
         catch (err) { tfx.logEventError(e, err, 'drawGeneration'); }
      }

      function drawGeneration(e, delete_existing) {
         var approved_opponents = tfx.approvedOpponents({ tournament, env: fx.fx.env(), e });

         // delete any existing draw AFTER capturing any player data (entry information)
         if (delete_existing) delete e.draw;

         if (!approved_opponents.length) {
            delete e.draw;
            return;
         }

         var draw_type = e.draw_type == 'R' ? 'rr_draw' : 'tree_draw';

         var seeded_teams = dfx.seededTeams({ teams: approved_opponents });
         var seed_limit = Math.min(Object.keys(seeded_teams).length, dfx.seedLimit(approved_opponents.length));

         if (e.draw_type == 'Q') seed_limit = tfx.qualifierSeedLimit({ env: fx.fx.env(), e }) || seed_limit;

         var num_players = approved_opponents.length;

         tree_draw.options({ draw: { feed_in: e.structure == 'feed' }});
         tree_draw.options({ max_round: undefined, seeds: { limit: seed_limit } });
         tree_draw.options({ flags: { path: fx.fx.env().assets.flags }});

         let qualification = () => {
            let draw_size = dfx.acceptedDrawSizes(num_players, true);
            if (!meetsMinimums(draw_size)) return;

            if ([1, 2, 4, 8, 16, 32, 64].indexOf(e.qualifiers) >= 0) {
               e.draw = dfx.buildDraw({ teams: draw_size });
               e.draw.max_round = util.log2(util.nearestPow2(draw_size)) - util.log2(e.qualifiers);
               e.draw.seeded_teams = seeded_teams;
               if (fx.fx.env().drawFx.qualifying_bracket_seeding) {
                  e.draw.seed_placements = dfx.qualifyingBracketSeeding({ draw: e.draw, num_players: draw_size, qualifiers: e.qualifiers, seed_limit });
               } else {
                  e.draw.seed_placements = dfx.validSeedPlacements({ num_players, random_sort: true, seed_limit, qualifying_draw: true });
               }

            } else {
               e.draw = dfx.buildQualDraw(num_players, e.qualifiers || 1);

               if (e.approved.length / 2 == e.qualifiers) draw_size = e.approved.length;

               e.draw.seeded_teams = [];
               if (e.qualifiers > 2 && e.draw_type == 'Q') {
                  e.draw.seeded_teams = seeded_teams;
                  e.draw.seed_placements = dfx.qualifyingBracketSeeding({ draw: e.draw, num_players, qualifiers: e.qualifiers, seed_limit });
               } else {
                  approved_opponents.forEach(o => { delete o[0].seed });
               }
            }

            e.draw.unseeded_placements = [];
            e.draw.opponents = approved_opponents;
            e.draw.unseeded_teams = tfx.teamSort(e.draw.opponents.filter(f=>!f[0].seed));

            // place first seed for each qualifying section
            let count = Math.max(2, e.qualifiers);
            count = Math.min(count, seed_limit);

            let preround = tfx.isPreRound({ env: fx.fx.env(), e: displayed_draw_event });
            if (!preround) dfx.placeSeedGroups({ draw: e.draw, count });

            if (e.automated) {
               if (e.draw.max_round && e.draw.max_round == 1) {
                  // if pre-round, distribute byes FIRST
                  dfx.distributeByes({ draw: e.draw });
                  dfx.placeSeedGroups({ draw: e.draw });
               } else {
                  dfx.placeSeedGroups({ draw: e.draw });
                  dfx.distributeByes({ draw: e.draw });
               }
               dfx.placeUnseededTeams({ draw: e.draw });
               dfx.advanceTeamsWithByes({ draw: e.draw });
               if (e.draw_type == 'Q') checkForQualifiedTeams(e);

               drawCreated(e);
               eventBackground(e);
               eventList();
            } else {
               // only test for bye/qualifier if not a pre-round
               if (!preround) testLastSeedPosition(e);
            }
         }

         let elimination = () => {
            let num_players = approved_opponents.length + e.qualifiers;

            if (e.structure == 'feed') {
               e.draw_size = dfx.feedDrawSize({ num_players, skip_rounds: e.skip_rounds, feed_rounds: e.feed_rounds });
               if (!meetsMinimums(e.draw_size)) return;

               e.draw = dfx.feedInDraw({ teams: e.draw_size, skip_rounds: e.skip_rounds, feed_rounds: e.feed_rounds });
               if (!e.draw) return;

               e.draw.unseeded_placements = [];
               e.draw.opponents = approved_opponents;
               // e.draw.unseeded_teams = tfx.teamSort(e.draw.opponents.filter(f=>!f[0].seed));
               e.draw.unseeded_teams = tfx.teamSort(e.draw.opponents);

               /*
               e.draw.seeded_teams = dfx.seededTeams({ teams: e.draw.opponents });
               e.draw.seed_placements = dfx.validSeedPlacements({ num_players, random_sort: true, seed_limit });

               let seeding = e.gem_seeding || tfx.rankedTeams(approved_opponents);
               if (!seeding) {
                  e.draw.seeded_teams = [];
                  delete e.draw.seed_placements;
               }

               // always place first two seeded groups (2 x 1) => place first two seeds
               dfx.placeSeedGroups({ draw: e.draw, count: 2 });
               */

            } else {

               e.draw_size = dfx.acceptedDrawSizes(num_players);
               if (!meetsMinimums(e.draw_size)) return;
               // build a blank draw 
               // TODO:  why is this == 12 ???!!???
               let structural_byes = e.draw_size == 12 ? dfx.structuralByes(e.draw_size, true) : undefined;
               e.draw = dfx.buildDraw({ teams: e.draw_size, structural_byes });

               if (!e.draw_size) return;

               // has to be defined after draw is built
               e.draw.qualifiers = e.qualifiers || 0;

               e.draw.unseeded_placements = [];
               e.draw.opponents = approved_opponents;
               e.draw.seed_placements = dfx.validSeedPlacements({ num_players, random_sort: true, seed_limit });

               e.draw.seeded_teams = dfx.seededTeams({ teams: e.draw.opponents });
               e.draw.unseeded_teams = tfx.teamSort(e.draw.opponents.filter(f=>!f[0].seed));

               let seeding = e.gem_seeding || tfx.rankedTeams(approved_opponents);
               if (!seeding) {
                  e.draw.seeded_teams = [];
                  delete e.draw.seed_placements;
               }

               // always place first two seeded groups (2 x 1) => place first two seeds
               dfx.placeSeedGroups({ draw: e.draw, count: 2 });

               if (e.automated) {
                  dfx.placeSeedGroups({ draw: e.draw });
                  dfx.distributeByes({ draw: e.draw });
                  dfx.distributeQualifiers({ draw: e.draw });
                  dfx.placeUnseededTeams({ draw: e.draw });
                  dfx.advanceTeamsWithByes({ draw: e.draw });
                  if (e.draw_type == 'Q') checkForQualifiedTeams(e);
                  drawCreated(e);
                  eventBackground(e);
                  eventList();
               } else {
                  testLastSeedPosition(e);
               }
            }
         }

         let compass = () => {
            let num_players = approved_opponents.length + e.qualifiers;
            e.draw_size = dfx.acceptedDrawSizes(num_players);
            if (!e.draw_size || !meetsMinimums(e.draw_size)) return;

            e.draw = {
               compass: 'east',
               east: undefined,
               west: undefined,
               north: undefined,
               south: undefined,
               northeast: undefined,
               northwest: undefined,
               southeast: undefined,
               southwest: undefined,
            }

            let structural_byes = e.draw_size == 12 ? dfx.structuralByes(e.draw_size, true) : undefined;
            e.draw.east = dfx.buildDraw({ teams: e.draw_size, structural_byes, direction: 'east' });

            // has to be defined after draw is built
            e.draw.qualifiers = e.qualifiers || 0;

            e.draw.east.unseeded_placements = [];
            e.draw.east.opponents = approved_opponents;
            e.draw.east.seed_placements = dfx.validSeedPlacements({ num_players, random_sort: true, seed_limit });

            e.draw.east.seeded_teams = dfx.seededTeams({ teams: e.draw.east.opponents });
            e.draw.east.unseeded_teams = tfx.teamSort(e.draw.east.opponents.filter(f=>!f[0].seed));

            let seeding = e.gem_seeding || tfx.rankedTeams(approved_opponents);
            if (!seeding) {
               e.draw.east.seeded_teams = [];
               delete e.draw.east.seed_placements;
            }

            // always place first two seeded groups (2 x 1) => place first two seeds
            dfx.placeSeedGroups({ draw: e.draw.east, count: 2 });

            if (e.automated) {
               dfx.placeSeedGroups({ draw: e.draw.east });
               dfx.distributeByes({ draw: e.draw.east });
               dfx.distributeQualifiers({ draw: e.draw.east });
               dfx.placeUnseededTeams({ draw: e.draw.east });
               dfx.advanceTeamsWithByes({ draw: e.draw.east });
               if (e.draw_type == 'Q') checkForQualifiedTeams(e);
               drawCreated(e);
               eventBackground(e);
               eventList();
            } else {
               testLastSeedPosition(e);
            }

            let info = dfx.drawInfo(e.draw.east);
         }

         let consolation = () => {
            if (e.structure == 'feed') {
               e.draw_size = dfx.feedDrawSize({ num_players, skip_rounds: e.skip_rounds, feed_rounds: e.feed_rounds });
               if (!meetsMinimums(e.draw_size)) return;

               e.draw = dfx.feedInDraw({ teams: e.draw_size, skip_rounds: e.skip_rounds, feed_rounds: e.feed_rounds });
               if (!e.draw_size) return;

               e.draw.opponents = approved_opponents;

               e.draw.unseeded_placements = [];
               e.draw.unseeded_teams = tfx.teamSort(e.draw.opponents.filter(f=>!f[0].seed));

               /*
               e.draw.seeded_teams = dfx.seededTeams({ teams: e.draw.opponents });
               let seeding = e.gem_seeding || tfx.rankedTeams(approved_opponents);
               if (!seeding) {
                  e.draw.seeded_teams = [];
                  delete e.draw.seed_placements;
               }
               let seed_placements = dfx.validSeedPlacements({ num_players, random_sort: true, seed_limit });
               e.draw.seed_placements = seed_placements;
               dfx.placeSeedGroups({ draw: e.draw, count: 2 });
               */

            } else {
               e.draw_size = dfx.acceptedDrawSizes(num_players);
               if (!meetsMinimums(e.draw_size)) return;

               e.draw = dfx.buildDraw({ teams: e.draw_size });

               e.draw.max_round = e.max_round;
               e.draw.unseeded_placements = [];
               e.draw.opponents = approved_opponents;
               e.draw.seed_placements = dfx.validSeedPlacements({ num_players, random_sort: true, seed_limit });

               e.draw.seeded_teams = dfx.seededTeams({ teams: e.draw.opponents });
               e.draw.unseeded_teams = tfx.teamSort(e.draw.opponents.filter(f=>!f[0].seed));

               var consolation_seeding = fx.fx.env().drawFx.consolation_seeding;
               let seeding = consolation_seeding && (e.gem_seeding || tfx.rankedTeams(approved_opponents));
               if (!seeding) {
                  e.draw.seeded_teams = [];
                  delete e.draw.seed_placements;
               }
               // always place first two seeded groups (2 x 1) => place first two seeds
               dfx.placeSeedGroups({ draw: e.draw, count: 2 });

               if (e.automated) {
                  dfx.placeSeedGroups({ draw: e.draw });
                  dfx.distributeByes({ draw: e.draw });
                  dfx.distributeQualifiers({ draw: e.draw });
                  dfx.placeUnseededTeams({ draw: e.draw });
                  dfx.advanceTeamsWithByes({ draw: e.draw });
                  drawCreated(e);
                  eventBackground(e);
                  eventList();
               } else {
                  testLastSeedPosition(e);
               }
            }
         }

         function emptyBrackets(num = 1) {
            return util.range(0, num).map(bracket => { return {
               puids:   [],
               players: [],
               matches: [],
            }});
         }

         let roundrobin = () => {
            let brackets = emptyBrackets(e.brackets || 1);
            let bracket_size = e.bracket_size;

            e.draw = { 
               brackets,
               bracket_size,
            };
            e.draw.opponents = approved_opponents;
            e.draw.seeded_teams = dfx.seededTeams({ teams: e.draw.opponents });
            e.draw.unseeded_teams = tfx.teamSort(e.draw.opponents.filter(f=>!f[0].seed));

            e.draw.seed_placements = dfx.roundrobinSeedPlacements({ draw: e.draw, bracket_size });
            dfx.placeSeedGroups({ draw: e.draw, count: e.brackets });

            dfx.rrByeDistribution({ draw: e.draw });
            
            if (e.automated) {
               dfx.placeSeedGroup({ draw: e.draw, group_index: e.brackets });
               dfx.rrUnseededPlacements({ draw: e.draw });
               drawCreated(e);
               eventBackground(e);
            }
         }

         let drawTypes = {
            'Q': () => qualification(),
            'E': () => elimination(),
            'R': () => roundrobin(),
            'C': () => consolation(),
            'P': () => consolation(), // playoff
            'S': () => compass(), // playoff
         }

         if (drawTypes[e.draw_type] && !e.active) drawTypes[e.draw_type](); 

         function meetsMinimums(draw_size) {
            var minimums = fx.fx.env().draws[draw_type].minimums;
            var minimum_draw_size = e.draw_type == 'P' ? 2 : e.format == 'S' ? minimums.singles : minimums.doubles;
            let meets_minimum = (draw_size >= minimum_draw_size);
            if (!meets_minimum) delete e.draw;
            return meets_minimum;
         }
      }

      function eventPlayers(e) {
         // insure that tournament players sorted by rank
         tournament.players = tfx.orderPlayersByRank(tournament.players, e.category);

         let teams = [];
         let approved = [];

         let ineligible = tfx.ineligiblePlayers(tournament, e);
         let ineligible_players = ineligible.players;

         let unavailable = tfx.unavailablePlayers(tournament, e);
         let unavailable_players = unavailable.players;

         let eligible = tfx.eligiblePlayers(tournament, e, ineligible_players, unavailable_players);
         let eligible_players = eligible.players || [];

         let approved_changed = ineligible.changed || unavailable.changed || eligible.changed;
         if (approved_changed) approvedChanged(e);

         let linkedQ = tfx.findEventByID(tournament, e.links['Q']) || tfx.findEventByID(tournament, e.links['R']);
         let qualifier_ids = linkedQ && linkedQ.qualified ? linkedQ.qualified.map(teamHash) : [];
         let qualifier_data = linkedQ && linkedQ.qualified ? Object.assign({}, ...linkedQ.qualified.map(q=>({[teamHash(q)]: q[0]}))) : {};

         // TODO: make this configurable
         let alternate_ids = (e.draw_type == 'C') ? eligible_players.filter(el => el.alternate).filter(f=>f).map(el=>el.id) : [];

         if (e.format == 'S') {
            eligible_players.forEach(p => { 
               if (qualifier_ids.indexOf(p.id) >= 0) {
                  p.full_name = `<div style='color: green'>${p.full_name}&nbsp;<span class='player_seed'>[Q]</span></div>`; 
               } else if (alternate_ids.indexOf(p.id) >= 0) {
                  let profile = p.exit_profile;
                  let color = profile.exit_round == Math.min(...profile.winner.event_rounds) ? 'green' : '#BB7C3A';
                  p.full_name = `<div style='color: ${color}'>${p.full_name}&nbsp;<span class='player_seed'>[A]</span></div>`; 
               } else {
                  if (p.order) p.full_name = `${p.full_name}&nbsp;<span class='player_order'>(${p.order})</span>`; 
               }
            });

            approved = tfx.approvedPlayers({ tournament, env: fx.fx.env(), e });

            // TODO: make this work for doubles...
            approved.forEach(p => { 
               if (qualifier_ids.length && qualifier_ids.indexOf(p.id) >= 0) {
                  let order = qualifier_data[p.id] && qualifier_data[p.id].order;
                  p.full_name = `<div style='color: green'>${p.full_name}&nbsp;<span class='player_seed'>[Q${order || ''}]</span></div>`; 
               } else if (e.wildcards && e.wildcards.indexOf(p.id) >= 0) {
                  p.full_name = `<div style='color: green'>${p.full_name}&nbsp;<span class='player_seed'>[WC]</span></div>`; 
               } else if (e.luckylosers && e.luckylosers.indexOf(p.id) >= 0) {
                  p.full_name = `<div style='color: green'>${p.full_name}&nbsp;<span class='player_seed'>[LL]</span></div>`; 
               } else if (p.seed && p.seed < 2000) {
                  p.full_name = `${p.full_name}&nbsp;<span class='player_seed'>[${p.seed}]</span>`; 
               }
            });

            tfx.playerSort(approved);
            tfx.playerSort(ineligible_players);
            tfx.playerSort(unavailable_players);
         } else {
            eligible_players.forEach(p => { if (p.order) p.full_name = `${p.full_name}&nbsp;<span class='player_order'>(${p.order})</span>`; });
            teams = teamRankDuplicates(eventTeams(e));
            approved = teamRankDuplicates(tfx.approvedTeams({ tournament, e }));
         }

         if (e.format == 'S' && e.links && e.links['R']) {
            let entries = util.unique(approved.map(a=>a.entry)); 
            // if RR qualifying round and either consolation draw or elimination draw is composed entirely of qualifiers, enable Option for GEM seeding
            if (e.draw_type == 'C' || (entries.length == 1 && entries[0] == 'Q')) {
               let gem_seeding = document.querySelector('.' + classes.gem_seeding);
               let display = e.active || !state.edit || !fx.fx.env().draws.gem_seeding ? false : true;
               if (gem_seeding) gem_seeding.style.display = display ? 'inline' : 'none';
            }
         }

         displayGen.displayEventPlayers({ container, approved, teams, eligible: eligible_players, ineligible: ineligible_players, unavailable: unavailable_players });

         function changeGroup(evt) {
            if (!state.edit || e.active) return;
            let grouping = util.getParent(evt.target, 'player_container').getAttribute('grouping');
            let elem = util.getParent(evt.target, 'player_click');
            let puid = elem.getAttribute('puid');
            let id = elem.getAttribute('uid');

            warnIfCreated(e).then(doIt, () => { return; });

            function doIt() {
               if (e.format == 'S') {
                  if (grouping == 'eligible') modifyApproved.push(e, id);
                  if (grouping == 'approved') modifyApproved.removeID(e, id);
               } else {
                  if (!e.teams) e.teams = [];
                  // return the index of any team that only has one player
                  let single = e.teams.map((t, i)=>t.length == 1 ? i : undefined).filter(f=>f!=undefined);

                  if (single.length) {
                     e.teams[single[0]].push(id);
                  } else {
                     e.teams.push([id]);
                  }
                  approvedChanged(e, true);
                  saveTournament(tournament);
                  outOfDate(e);
               }
            }
         }

         function teamRankDuplicates(groups) {
            let all_ranks = groups.map(team=>team.combined_rank);
            let duplicates = util.unique(all_ranks).filter(ranking => util.indices(ranking, all_ranks).length > 1);
            let rank_duplicates = Object.assign({}, ...duplicates.map(dup => ({ [dup]: groups.filter(t=>t.combined_rank == dup) }) ));

            // add the number of duplicates for this combined ranking
            groups.forEach(team => team.duplicates = rank_duplicates[team.combined_rank] ? rank_duplicates[team.combined_rank].length : false);
            return groups;
         }

         function removeTeam(evt) {
            if (!state.edit || e.active) return;
            let grouping = util.getParent(evt.target, 'player_container').getAttribute('grouping');
            let elem = util.getParent(evt.target, 'team_click');
            let team_id = elem.getAttribute('team_id');
            if (team_id) {
               if (grouping == 'approved') {
                  warnIfCreated(e).then(doIt, () => { return; });
                  function doIt() {
                     e.approved = e.approved.filter(team => util.intersection(team_id.split('|'), team).length == 0);
                     e.regenerate = 'removeTeam';
                     finish();
                  }
               } else {
                  e.teams = e.teams.filter(team => util.intersection(team_id.split('|'), team).length == 0)
                  finish();
               }

               function finish() {
                  e.wildcards = e.wildcards.filter(team => util.intersection(team_id.split('|'), team).length == 0)
                  e.luckylosers = e.luckylosers.filter(team => util.intersection(team_id.split('|'), team).length == 0)
                  approvedChanged(e, true);
                  saveTournament(tournament);
               }
            }
         }

         function teamContextClick(evt) {
            var grouping = util.getParent(evt.target, 'player_container').getAttribute('grouping');
            if (!state.edit || e.active) return;
            var elem = util.getParent(evt.target, 'team_click');
            var duplicates = elem.getAttribute('duplicates');
            if (!duplicates && grouping == 'approved') return;

            var team_id = elem.getAttribute('team_id');
            var clicked_team = (grouping == 'approved') ? reduceTeams(approved, team_id) : reduceTeams(teams, team_id);
            if (!clicked_team) return;

            var team_options = [
               { label: lang.tr('events.approveteam'), value: 'approve' },
               { label: lang.tr('events.wildcard'), value: 'wildcard' },
               { label: lang.tr('actions.cancel'), value: 'cancel'}
            ];
            var options = (grouping == 'approved') ? [] : team_options;
            if (duplicates) options.push({ label: 'Subrank', value: 'subrank' });

            displayGen.svgModal({ x: evt.clientX, y: evt.clientY, options, callback: teamAction });

            function teamAction(selection, i) {
               if (selection.value == 'cancel') {
                  return;
               } else if (selection.value == 'wildcard') {
                  warnIfCreated(e).then(doIt, () => { return; });
                  function doIt() {
                     assignWildcard(clicked_team);
                     finish();
                  }
               } else if (selection.value == 'subrank') {
                  let remove = [{ label: `${lang.tr('draws.remove')}: Subrank`, value: 'remove' }];
                  let options = remove.concat(...util.range(0, duplicates).map(d => ({ label: `Subrank: ${d + 1}`, value: d + 1 })));
                  displayGen.svgModal({ x: evt.clientX, y: evt.clientY, options, callback: addSubrank });
               } else if (selection.value == 'approve') {
                  warnIfCreated(e).then(doIt, () => { return; });
                  function doIt() {
                     modifyApproved.pushTeam(e, clicked_team.players);
                     finish();
                  }
               }

               function finish() {
                  saveTournament(tournament);
                  outOfDate(e);
               }
            }

            function addSubrank(selection, i) {
               if (!e.doubles_subrank) e.doubles_subrank = {};
               e.doubles_subrank[team_id] = i;
               approvedChanged(e, true);
            }

            function assignWildcard(team) {
               if (!e.wildcards) e.wildcards = [];
               e.wildcards.push(team_id);
               modifyApproved.pushTeam(e, team.players);
            }

            function reduceTeams(teams, team_id) {
               return teams.reduce((p, c) => util.intersection(team_id.split('|'), c.players.map(p=>p.id)).length == 2 ? c : p, undefined);
            }
         }

         util.addEventToClass('player_click', changeGroup, container.event_details.element);
         util.addEventToClass('team_click', removeTeam, container.event_details.element);
         util.addEventToClass('team_click', teamContextClick, container.event_details.element, 'contextmenu');
         util.addEventToClass('player_click', playerOptions, container.event_details.element, 'contextmenu');

         function playerOptions(evt) {
            var grouping = util.getParent(evt.target, 'player_container').getAttribute('grouping');
            if (!state.edit || e.active || grouping == 'approved' || e.format != 'S') return;

            var options = [
               { label: lang.tr('events.wildcard'), key: 'wc' },
               { label: lang.tr('ccl'), key: 'ccl' },
            ];
            function pOpts(c, i) {
               if (c.key == 'wc') {
                  warnIfCreated(e).then(doIt, () => { return; });
                  function doIt() {
                     let elem = util.getParent(evt.target, 'player_click');
                     let puid = elem.getAttribute('puid');
                     let id = elem.getAttribute('uid');
                     let plyr = tournament.players.reduce((p, c) => c.id == id ? c : p, undefined);
                     if (plyr && grouping == 'eligible') assignWildcard(plyr, true);
                  }
               }
            }
            displayGen.svgModal({ x: evt.clientX, y: evt.clientY, options, callback: pOpts });
         }

         function assignWildcard(plyr, wildcard) {
            if (!e.wildcards) e.wildcards = [];
            if (wildcard == undefined) toggle();
            if (wildcard == false) remove();
            if (wildcard == true) add();

            function toggle() { if (e.wildcards.indexOf(plyr.id) >= 0) { remove(); } else { add(); } }
            function remove() { e.wildcards = e.wildcards.filter(w=>w!=plyr.id); }
            function add() {
               if (e.wildcards.indexOf(plyr.id) < 0) {
                  e.wildcards.push(plyr.id);
                  modifyApproved.push(e, plyr.id);
               }
            }
         }

         // if there is a qualifiers selection option, change based on approved players
         if (e.draw_type == 'Q') {
            if (event_config.qualifiers && event_config.qualifiers.ddlb) {
               let {max_qualifiers, options } = qualifyingDrawSizeOptions(e);
               if (e.qualifiers > max_qualifiers) e.qualifiers = max_qualifiers;
               event_config.qualifiers.ddlb.setOptions(options);
               event_config.qualifiers.ddlb.setValue(Math.min(e.qualifiers || 0, max_qualifiers) || 0, 'white');
               event_config.qualifiers.ddlb.selectionBackground(!e.qualifiers ? 'red' : 'white');
            }
         }
         if (e.draw_type == 'R') {
            let {options, size_options } = roundRobinDrawBracketOptions(e);
            if (event_config.brackets && event_config.brackets.ddlb) {
               event_config.brackets.ddlb.setOptions(options);
               event_config.brackets.ddlb.setValue(e.brackets, 'white');

               event_config.bracket_size.ddlb.setOptions(size_options);
               event_config.bracket_size.ddlb.setValue(e.bracket_size, 'white');
            }
            setRRQualifiers(e);
         }
         eventList(true);
         tournament.categories = tfx.tournamentCategories(tournament);
      }

      function scheduleTab(specific_day) {
         let display = showSchedule();
         if (display) displaySchedule(specific_day || displayed_schedule_day);
      }

      function teamName(match, team, remove_diacritics) {
         if (team.length == 1) {
            let p = match.players[team[0]];
            if (!p.last_name || !p.first_name) return p.qualifier ? lang.tr('qualifier') : '';
            let club = p.club_code ? ` (${p.club_code})` : '';
            let full_name = `${util.normalizeName(p.first_name, remove_diacritics)} ${util.normalizeName(p.last_name, remove_diacritics).toUpperCase()}`; 
            return `${full_name}${club}`;
         } else {
            return team.map(p => util.normalizeName(match.players[p].last_name, remove_diacritics).toUpperCase()).join('/');
         }
      }

      function updateScheduleStatus(obj) {
         if (!tournament.events.length) return unPublishOOP(tournament);

         var scheduled = mfx.scheduledMatches(tournament).scheduled;
         if (obj.muid) {
            var scheduled_muids = scheduled.map(m=>m.muid);
            if (scheduled_muids.indexOf(obj.muid) >= 0) update();
         }
         if (obj.euid) {
            var scheduled_euids = scheduled.map(m=>m.event.euid);
            if (scheduled_euids.indexOf(obj.euid) >= 0) update();
         }

         function update() {
            if (!tournament.schedule) tournament.schedule = {};
            tournament.schedule.up_to_date = false;
            schedulePublishState();
         }
      }

      function schedulePublishState() {
         let published = tournament.schedule && tournament.schedule.published;
         let published_state = published ? (tournament.schedule.up_to_date ? 'publisheduptodate' : 'publishedoutofdate') : 'unpublished';
         let publish_class_name = `schedule_publish_state ${published_state} action_icon`;
         let publish_schedule = container.schedule_tab.element.querySelector(`.${classes.publish_schedule}`);
         publish_schedule.querySelector('div').className = publish_class_name;
      }

      function displaySchedule(currently_selected_day) {
         var { completed_matches, pending_matches, upcoming_matches } = mfx.tournamentEventMatches({ tournament, source: true });

         let img = new Image();
         img.src = "./icons/dragmatch.png";

         schedulePublishState();

         // TODO: consider the possibility that tournament dates may not include all dates within a range
         let date_range = util.dateRange(tournament.start, tournament.end);
         if (currently_selected_day && date_range.indexOf(new Date(currently_selected_day)) < 0) currently_selected_day = undefined;
         let formatted_date_range = date_range.map(m => new Date(util.formatDate(m)).getTime());

         let all_matches = completed_matches.concat(...pending_matches, ...upcoming_matches);
         let muid_key = Object.assign({}, ...all_matches.map(m=>({ [m.muid]: m })));
         let day_matches = all_matches;

         let ms = new Date(util.formatDate(new Date())).getTime();
         let closest_schedule_ms = formatted_date_range
            .reduce((p, c) => Math.abs(ms - c) <= Math.abs(ms - p) ? c : p, 0);
         let closest_match_day = all_matches
            .filter(m=>m.schedule && m.schedule.day)
            .map((m, i) => ({ i, ms: new Date(util.formatDate(m.schedule.day)).getTime() }))
            .reduce((p, c) => !isNaN(c.ms) && Math.abs(ms - c.ms) <= Math.abs(ms - p.ms) ? c : p, { i: 0, ms: 0 });

         let closest_day = formatted_date_range.indexOf(closest_match_day.ms) >= 0 ? new Date(closest_match_day.ms) : new Date(closest_schedule_ms);
         displayed_schedule_day = util.formatDate(currently_selected_day || closest_day);

         // create a list of all matches which are unscheduled or can be moved
         let search_list = all_matches;
         filterSearchList();

         let courts = courtFx.courtData(tournament);
         let oop_rounds = util.range(1, fx.fx.env().schedule.max_matches_per_court + 1);

         let date_options = date_range.map(d => ({ key: calendarFx.localizeDate(d), value: util.formatDate(d) }));
         dd.attachDropDown({ 
            id: container.schedule_day.id, 
            options: date_options,
            label: '',
         });
         container.schedule_day.ddlb = new dd.DropDown({ element: container.schedule_day.element, id: container.schedule_day.id, onChange: dateChange });
         container.schedule_day.ddlb.setValue(displayed_schedule_day, 'white');

         function eventOption(evt) {
            let type = evt.draw_type == 'E' ? '' : evt.draw_type == 'C' ? ` ${lang.tr('draws.consolation')}` : evt.draw_type == 'R' ? ' RR' : ' Q';
            let category = evt.custom_category ? `${evt.custom_category} ` : evt.category ? `${evt.category} ` : '';
            return { key: `${category}${evt.name}${type}`, value: evt.euid }
         }
         let event_filters = [].concat({ key: lang.tr('schedule.allevents'), value: '' }, ...tournament.events.map(eventOption));
         dd.attachDropDown({ 
            id: container.event_filter.id, 
            options: event_filters,
            label: '',
         });
         container.event_filter.ddlb = new dd.DropDown({ element: container.event_filter.element, id: container.event_filter.id, onChange: displayPending });
         container.event_filter.ddlb.selectionBackground('white');

         let location_filters = [].concat({ key: lang.tr('schedule.allcourts'), value: '' }, ...tournament.locations.map(l => ({ key: l.name, value: l.luid })));
         dd.attachDropDown({ 
            id: container.location_filter.id, 
            options: location_filters,
            label: '',
         });
         container.location_filter.ddlb = new dd.DropDown({ element: container.location_filter.element, id: container.location_filter.id, onChange: displayCourts });
         container.location_filter.ddlb.selectionBackground('white');

         // show or hide option button depending on whether there is more than one option
         util.getParent(container.location_filter.element, 'schedule_options').style.display = (tournament.locations.length > 1) ? 'flex' : 'none';

         // ROUND NAMES
         // if scheduling upcoming matches need to add them to round filter too...
         let round_names = util.unique(pending_matches.map(m=>m.round_name));
         let round_filters = [].concat({ key: lang.tr('schedule.allrounds'), value: '' }, ...round_names.map(round => ({ key: round, value: round })));
         dd.attachDropDown({ 
            id: container.round_filter.id, 
            options: round_filters,
            label: '',
         });
         container.round_filter.ddlb = new dd.DropDown({ element: container.round_filter.element, id: container.round_filter.id, onChange: displayPending });
         container.round_filter.ddlb.selectionBackground('white');

         displayPending(false);
         dateChange(displayed_schedule_day);

         function dateChange(value) {
            displayed_schedule_day = value;
            filterDayMatches();
            displayScheduleGrid(tournament, container);
         }

         function filterDayMatches() {
            ({ completed_matches, pending_matches, upcoming_matches } = mfx.tournamentEventMatches({ tournament, source: true }));
            all_matches = completed_matches.concat(...pending_matches, ...upcoming_matches).filter(m=>m);
            muid_key = Object.assign({}, ...all_matches.map(m=>({ [m.muid]: m })));
            day_matches = all_matches.filter(scheduledFilter);
            checkConflicts(day_matches);
         }

         function filterSearchList() {
            let include_completed = fx.fx.env().schedule.completed_matches_in_search;
            search_list = all_matches
               .filter(match => match.winner == undefined || include_completed)
               .map(match => ({ value: match.muid, label: match.team_players.map(team=>teamName(match, team, true)).join(' v. ') }) );
         }

         function displayCourts() {
            let luid = container.location_filter.ddlb.getValue();
            courts = courtFx.courtData(tournament, luid);
            filterDayMatches();
            displayScheduleGrid(tournament, container);
         }

         function updateRoundNames(euid_filtered) {
            let round_names = util.unique(euid_filtered.map(m=>m.round_name));
            let round_filters = [].concat({ key: lang.tr('schedule.allrounds'), value: '' }, ...round_names.map(round => ({ key: round, value: round })));
            container.round_filter.ddlb.setOptions(round_filters);
         }

         function displayPending(update_round_names=true) {
            let pending_by_format = pending_matches.sort((a, b) => a.format == 'singles' ? 0 : 1);
            let upcoming_by_format = upcoming_matches.sort((a, b) => a.format == 'singles' ? 0 : 1);

            let pending_upcoming = pending_by_format.concat(...upcoming_by_format).filter(f=>f);

            let euid = container.event_filter.ddlb.getValue();
            container.schedulelimit.element.style.display = euid ? 'flex' : 'none';
            
            let euid_filtered = !euid ? pending_upcoming : pending_upcoming.filter(m=>m.event.euid == euid);
            let round_name = container.round_filter.ddlb.getValue();

            let round_filtered = !round_name ? euid_filtered : euid_filtered.filter(m=>m.round_name == round_name);
            let srtd = scheduleFx.sortedUnscheduled(tournament, round_filtered, false);

            displayGen.scheduleTeams({ 
               pending_upcoming: srtd,
               element: container.unscheduled.element,
            });
            util.addEventToClass('dragUnscheduled', dragUnscheduled, container.unscheduled.element, 'dragstart');
            if (update_round_names) updateRoundNames(euid_filtered);
         }

         // TODO: tournament parameter is not used... perhaps it should be used
         // to generate the day_matches instead of day_matches having a larger scope
         function displayScheduleGrid(tournament, container) {
            scheduleFx.scheduleGrid({
               courts,
               oop_rounds,
               editable: state.edit,
               scheduled: day_matches,
               element: container.schedule.element,
               schedule_day: displayed_schedule_day,
               options: fx.fx.env().schedule
            });
            util.addEventToClass('findmatch', showSearch, container.schedule.element, 'click');
            util.addEventToClass('opponentsearch', (e)=>e.stopPropagation(), container.schedule.element, 'click');

            util.addEventToClass('dragdrop', dragStart, container.schedule.element, 'dragstart');
            util.addEventToClass('dragdrop', drop, container.schedule.element, 'drop');

            util.addEventToClass('oop_round', roundContext, container.schedule.element, 'contextmenu');
            util.addEventToClass('schedule_box', gridContext, container.schedule.element, 'contextmenu');
            util.addEventToClass('schedule_box', selectMatch, container.schedule.element, 'click');
            scheduleActions();
            checkConflicts(day_matches);
         }

         util.addEventToClass('dropremove', dropRemove, document, 'drop');

         function populateGridCell(target, muid, match) {
            // set muid attribute so that match can be found when clicked upon
            // and draggable attribute so that match can be dragged
            if (muid) {
               target.setAttribute('muid', muid);
               target.setAttribute('draggable', 'true');
               let sb = scheduleFx.scheduleBox({ match, editable: true, options: fx.fx.env().schedule });
               target.innerHTML = sb.innerHTML;
               target.style.background = sb.background;
               scheduleFx.scaleTeams(target);
            } else {
               target.setAttribute('muid', '');
               target.setAttribute('draggable', 'false');
               target.innerHTML = scheduleFx.emptyOOPround(true);
               util.addEventToClass('findmatch', showSearch, target, 'click');
               util.addEventToClass('opponentsearch', (e)=>e.stopPropagation(), target, 'click');
            }
         }

         function removeFromUnscheduled(muid) {
            let unscheduled_matches = Array.from(container.unscheduled.element.querySelectorAll('.unscheduled_match'));
            if (!unscheduled_matches.length) return;
            let scheduled_match = unscheduled_matches.reduce((m, c) => c.getAttribute('muid') == muid ? c : m);
            scheduled_match.parentNode.removeChild(scheduled_match);
            pending_matches = pending_matches.filter(m=>m.muid != muid);
            scheduleActions({ changed: true });
         }

         function returnToUnscheduled(match, element) {
            if (!match || !match.schedule || !match.schedule.court) return;

            element.setAttribute('muid', '');
            element.setAttribute('draggable', 'false');
            element.setAttribute('court', match.schedule.court);
            element.setAttribute('oop_round', match.schedule.oop_round);
            element.style.background = 'white';

            element.innerHTML = scheduleFx.emptyOOPround(true);
            util.addEventToClass('findmatch', showSearch, element, 'click');
            util.addEventToClass('opponentsearch', (e)=>e.stopPropagation(), element, 'click');

            match.status = '';
            match.source.schedule = '';
            match.schedule = {};
            match.source.schedule = {};

            checkConflicts(day_matches);
            saveTournament(tournament);

            ({ completed_matches, pending_matches, upcoming_matches } = mfx.tournamentEventMatches({ tournament, source: true }));
            displayPending();

            scheduleActions({ changed: true });
         }

         // ability to "pull" matches into schedule cells
         function showSearch(evt) {
            let opponent_search = evt.target.querySelector('.opponentsearch'); 
            if (!opponent_search) return;

            let display_state = opponent_search.style.display;
            Array.from(container.schedule.element.querySelectorAll('.opponentsearch')).forEach(o=>o.style.display = 'none');
            opponent_search.style.display = (display_state == 'inline') ? 'none' : 'inline';

            // if display_state == 'none' then state is now 'inline'
            if (display_state == 'none') {
               let selection_flag = false;
               let type_ahead = new Awesomplete(opponent_search, { list: search_list });
               let matchSelected = (muid) => {
                  if (!muid) return;
                  opponent_search.value = '';
                  let match_to_schedule = muid_key[muid];
                  let interrupted = (match_to_schedule.score && match_to_schedule.score.indexOf('INT') >= 0);
                  if (interrupted) {
                     console.log('INTERRUPTED');
                  }
                  scheduleMatch(muid, interrupted);
               }
               opponent_search.addEventListener("awesomplete-selectcomplete", function(e) { selection_flag = true; matchSelected(this.value); }, false);
               opponent_search.addEventListener('keydown', catchTab , false);
               opponent_search.addEventListener("keyup", function(e) { 
                  // auto select first item on 'Enter' *only* if selectcomplete hasn't been triggered
                  if (e.which == 13 && !selection_flag) {
                     if (type_ahead.suggestions && type_ahead.suggestions.length) {
                        type_ahead.next();
                        type_ahead.select(0);
                     }
                  }
                  selection_flag = false;
               });
               opponent_search.focus();
            } else {
               evt.target.innerHTML = scheduleFx.opponentSearch();
            }

            function scheduleMatch(source_muid, interrupted) {
               let target = util.getParent(evt.target, 'schedule_box');
               let luid = target.getAttribute('luid');
               let index = target.getAttribute('index');
               let court = target.getAttribute('court');
               let oop_round = parseInt(target.getAttribute('oop_round'));
               let source_match = muid_key[source_muid];

               if (!source_match.schedule) source_match.schedule = {};
               if (!source_match.source.schedule) source_match.source.schedule = {};

               // SETTING to prevent moving completed matches???
               // if (source_match.winner != undefined) return;

               let source_schedule = source_match.schedule && source_match.schedule.court ? Object.assign({}, source_match.schedule) : {};
               let target_schedule = { luid, index, court, oop_round, day: displayed_schedule_day };

               let previously_scheduled = Object.keys(source_schedule).length;
               if (!previously_scheduled || target_schedule.day != source_match.schedule.day) {
                  // if the source is unscheuled or scheduled on a **different** day
                  if (interrupted) {
                     if (!source_match.schedule.interrupted) source_match.schedule.interrupted = []
                     if (!source_match.source.schedule.interrupted) source_match.source.schedule.interrupted = []
                     let duplicate = Object.assign({}, ...Object.keys(source_match.schedule).filter(k=>k!='interrupted').map(k=>({ [k]: source_match.schedule[k] })));
                     console.log('prev:', previously_scheduled, 'dup:', duplicate);
                     source_match.schedule.interrupted.push(duplicate);
                  }
                  Object.assign(source_match.schedule, target_schedule);
                  Object.assign(source_match.source.schedule, target_schedule);

                  populateGridCell(target, source_muid, source_match);

                  if (!previously_scheduled) removeFromUnscheduled(source_muid);

               } else {
                  // if source is match scheduled for the **same day**, swap with target
                  // find the .schedule_box with source muid
                  let source = Array.from(document.querySelectorAll('.schedule_box')).reduce((s, el) => {
                     let el_muid = el.getAttribute('muid');
                     if (el_muid == source_muid) s = el;
                     return s;
                  });

                  let findmatch = target.querySelector('.findmatch'); 
                  findmatch.innerHTML = scheduleFx.opponentSearch();

                  source_match.schedule = Object.assign({}, target_schedule);
                  source_match.source.schedule = Object.assign({}, target_schedule);

                  target.setAttribute('court', source_schedule.court);
                  target.setAttribute('oop_round', source_schedule.oop_round);
                  source.setAttribute('court', target_schedule.court);
                  source.setAttribute('oop_round', target_schedule.oop_round);

                  util.swapElements(source, target);

                  // refresh HTML of source to remove time/time_prefix
                  populateGridCell(source, source_muid, source_match);
               }

               checkConflicts(day_matches);

               tournament.schedule.up_to_date = false;
               schedulePublishState();
               saveTournament(tournament);
               filterDayMatches();
            }
         }

         function dragUnscheduled(ev) {
            let target = util.getParent(ev.target, 'dragUnscheduled');
            var id = target.id;
            ev.dataTransfer.setData("itemid", id);
            ev.dataTransfer.setData("itemtype", 'unscheduled');
            ev.dataTransfer.effectAllowed = "move";
            ev.dataTransfer.setDragImage(img, 10, 10);
         }

         function dragStart(ev) {
            var id = ev.target.id;
            ev.dataTransfer.setData("itemid", id);
            ev.dataTransfer.effectAllowed = "move";
         }

         function dropRemove(ev) {
            ev.preventDefault();
            ev.stopPropagation();
            let itemtype = ev.dataTransfer.getData("itemtype");
            if (itemtype == 'unscheduled') return;
            let itemid = ev.dataTransfer.getData("itemid");

            let source = document.getElementById(itemid);
            let source_muid = source.getAttribute('muid');
            let source_match = muid_key[source_muid];

            returnToUnscheduled(source_match, source);
            saveTournament(tournament);
         }

         function drop(ev) {
            ev.preventDefault();
            let itemtype = ev.dataTransfer.getData("itemtype");
            let itemid = ev.dataTransfer.getData("itemid");

            let source = document.getElementById(itemid);
            let source_class = source.className;
            let source_muid = source.getAttribute('muid');

            let target = ev.currentTarget;
            let target_class = target.className;
            let target_muid = target.getAttribute('muid');

            let source_match = muid_key[source_muid];
            let source_schedule = Object.assign({}, source_match.schedule);

            let target_match = target_muid ? muid_key[target_muid] : { source: {} };

            // if (target_match.winner != undefined) return;

            if (target_muid == '') {
               let luid = target.getAttribute('luid');
               let index = target.getAttribute('index');
               let court = target.getAttribute('court');
               let oop_round = parseInt(target.getAttribute('oop_round'));
               target_match.schedule = { luid, index, court, oop_round, day: displayed_schedule_day };
            }

            if (itemtype != 'unscheduled') {
               // this section for swapping places between two scheduled matches
               // only re-assign source if it is NOT an unscheduled match
               source_match.schedule = Object.assign({}, target_match.schedule);
               source_match.source.schedule = Object.assign({}, target_match.schedule);
               target_match.schedule = Object.assign({}, source_schedule);
               target_match.source.schedule = Object.assign({}, source_schedule);

               target.setAttribute('court', source_match.schedule.court);
               target.setAttribute('oop_round', source_match.schedule.oop_round);
               source.setAttribute('court', target_match.schedule.court);
               source.setAttribute('oop_round', target_match.schedule.oop_round);

               source.className = target_class;
               target.className = source_class;

               populateGridCell(target, source_muid, source_match);
               populateGridCell(source, target_muid, target_match);

            } else {
               if (target_muid == '') {
                  // only allow match to be dropped if an empty space
                  source_match.schedule = Object.assign({}, target_match.schedule);
                  source_match.source.schedule = Object.assign({}, target_match.schedule);

                  populateGridCell(target, source_muid, source_match);
                  removeFromUnscheduled(source_muid);
               }
            }

            checkConflicts(day_matches);

            tournament.schedule.up_to_date = false;
            schedulePublishState();
            saveTournament(tournament);
         }

         function identifyRound(ev) {
            let target = util.getParent(ev.target, 'oop_round');
            let oop_round = parseInt(target.getAttribute('oop_round'));
            return { oop_round };
         }

         function roundContext(ev) {
            if (!state.edit) return;

            let { oop_round } = identifyRound(ev);
            if (oop_round) {
               let options = [
                  { label: lang.tr('schedule.matchestime'), key: 'matchestime' },
                  { label: lang.tr('schedule.notbefore'), key: 'notbefore' },
                  { label: lang.tr('schedule.followedby'), key: 'followedby' },
                  { label: lang.tr('schedule.afterrest'), key: 'afterrest' },
                  { label: lang.tr('schedule.tba'), key: 'tba' },
                  { label: lang.tr('schedule.nextavailable'), key: 'next' },
                  { label: lang.tr('schedule.clear'), key: 'clear' },
               ];
               displayGen.svgModal({ x: ev.clientX, y: ev.clientY, options, callback: modifySchedules });

               function modifySchedules(choice, index) {
                  if (choice.key == 'matchestime') {
                     filterDayMatches(); // TODO: why does this need to be here?
                     // displayGen.timePicker({ hour_range: { start: 8 }, minutes: [0, 30], callback: setTime })
                     displayGen.timePicker({ hour_range: { start: 8 }, minute_increment: 5, callback: setTime })
                  } else if (choice.key == 'notbefore') {
                     modifyMatchSchedule([{ attr: 'time_prefix', value: `${lang.tr('schedule.nb')} ` }]);
                  } else if (choice.key == 'followedby') {
                     let pairs = [
                        { attr: 'time_prefix', value: '' },
                        { attr: 'time', value: '' },
                        { attr: 'heading', value: lang.tr('schedule.followedby') },
                     ];
                     modifyMatchSchedule(pairs);
                  } else if (choice.key == 'afterrest') {
                     let pairs = [
                        { attr: 'time_prefix', value: lang.tr('schedule.afterrest') },
                        { attr: 'time', value: '' },
                        { attr: 'heading', value: '' },
                     ];
                     modifyMatchSchedule(pairs);
                  } else if (choice.key == 'tba') {
                     let pairs = [
                        { attr: 'time_prefix', value: lang.tr('schedule.tba') },
                        { attr: 'time', value: '' },
                     ];
                     modifyMatchSchedule(pairs);
                  } else if (choice.key == 'next') {
                     let pairs = [
                        { attr: 'time_prefix', value: '' },
                        { attr: 'time', value: '' },
                        { attr: 'heading', value: lang.tr('schedule.nextavailable') },
                     ];
                     modifyMatchSchedule(pairs);
                  } else if (choice.key == 'clear') {
                     let pairs = [
                        { attr: 'time_prefix', value: '' },
                        { attr: 'time', value: '' },
                        { attr: 'heading', value: '' },
                     ];
                     modifyMatchSchedule(pairs);
                  }
               }

               function setTime(time) { modifyMatchSchedule([{ attr: 'time', value: time }]); }
               function modifyMatchSchedule(pairs, display=true) {
                  day_matches
                     .filter(m=>m.schedule.oop_round == oop_round)
                     .forEach(match => {
                        let complete = match.winner != undefined;
                        if (!complete) {
                           pairs.forEach(pair => {
                              match.schedule[pair.attr] = pair.value;
                              if (match.source) match.source.schedule[pair.attr] = pair.value;
                           });
                           if (display) updateScheduleBox(match);
                        }
                     });
                  scheduleActions({ changed: true });
                  saveTournament(tournament);
               }
            }
         }

         function identifyMatch(ev) {
            let target = util.getParent(ev.target, 'schedule_box');
            let muid = target.getAttribute('muid');
            return { match: muid_key[muid], muid, target };
         }

         function gridContext(ev) {
            if (!state.edit) return;

            let { match, target } = identifyMatch(ev);
            let complete = match && match.winner != undefined;
            if (match) {
               let options = [];
               if (!complete) {
                  options = [
                     { label: lang.tr('draws.matchtime'), key: 'matchtime' },
                     { label: lang.tr('draws.timeheader'), key: 'timeheader' },
                     { label: lang.tr('draws.changestatus'), key: 'changestatus' },
                  ];
               }

               let times = [
                  { label: lang.tr('draws.starttime'), key: 'starttime' },
                  { label: lang.tr('draws.endtime'), key: 'endtime' },
               ];
               if (!match.potentials || !match.potentials.length) options = options.concat(...times);

               let opts = [
                  { label: lang.tr('draws.umpire'), key: 'umpire' },
                  { label: lang.tr('draws.penalty'), key: 'penalty' },
                  { label: lang.tr('draws.remove'), key: 'remove' },
               ];
               options = options.concat(...opts);

               displayGen.svgModal({ x: ev.clientX, y: ev.clientY, options, callback: modifySchedule });

               function modifySchedule(choice, index) {
                  if (choice.key == 'matchtime') {
                     let time_string = match.schedule && match.schedule.time;
                     displayGen.timePicker({ value: time_string, hour_range: { start: 8 }, minute_increment: 5, callback: setTime })
                  } else if (choice.key == 'starttime') {
                     let time_string = match.schedule && (match.schedule.start || match.schedule.time);
                     displayGen.timePicker({ value: time_string, hour_range: { start: 8 }, minute_increment: 5, callback: setStart })
                  } else if (choice.key == 'endtime') {
                     let time_string = match.schedule && match.schedule.end;
                     displayGen.timePicker({ value: time_string, hour_range: { start: 8 }, minute_increment: 5, callback: setEnd })
                  } else if (choice.key == 'timeheader') {
                     let headings = [
                        lang.tr('schedule.notbefore'),
                        lang.tr('schedule.followedby'),
                        lang.tr('schedule.afterrest'),
                        lang.tr('schedule.tba'),
                        lang.tr('schedule.nextavailable'),
                        lang.tr('schedule.clear'),
                     ];
                     displayGen.svgModal({ x: ev.clientX, y: ev.clientY, options: headings, callback: timeHeading });
                  } else if (choice.key == 'changestatus') {
                     let statuses = [
                        { label: lang.tr('schedule.called'),  value: 'called' },
                        { label: lang.tr('schedule.oncourt'),  value: 'oncourt' },
                        { label: lang.tr('schedule.warmingup'),  value: 'warmingup' },
                        { label: lang.tr('schedule.suspended'),  value: 'suspended' },
                        { label: lang.tr('schedule.raindelay'),  value: 'raindelay' },
                        { label: lang.tr('schedule.clear'),  value: 'clear' },
                     ];
                     displayGen.svgModal({ x: ev.clientX, y: ev.clientY, options: statuses, callback: matchStatus });
                  } else if (choice.key == 'umpire') {
                     addUmpire(match, 'schedule');
                     return;
                  } else if (choice.key == 'penalty') {
                     let statuses = [
                        { label: lang.tr('penalties.illegalcoaching'), value: 'illegalcoaching' },
                        { label: lang.tr('penalties.unsporting'), value: 'unsporting' },
                        { label: lang.tr('penalties.ballabuse'), value: 'ballabuse' },
                        { label: lang.tr('penalties.racquetabuse'), value: 'racquetabuse' },
                        { label: lang.tr('penalties.equipmentabuse'), value: 'equipmentabuse' },
                        { label: lang.tr('penalties.cursing'), value: 'cursing' },
                        { label: lang.tr('penalties.rudegestures'), value: 'rudegestures' },
                        { label: lang.tr('penalties.foullanguage'), value: 'foullanguage' },
                        { label: lang.tr('penalties.timeviolation'), value: 'timeviolation' },
                        { label: lang.tr('penalties.latearrival'), value: 'latearrival' },
                        { label: lang.tr('penalties.fail2signout'), value: 'fail2signout' },
                     ];
                     displayGen.svgModal({ x: ev.clientX, y: ev.clientY, options: statuses, callback: assessPenalty });
                  } else if (choice.key == 'remove') {
                     returnToUnscheduled(match, target);
                     return;
                  }
               }

               function setTime(value) { modifyMatchSchedule([{ attr: 'time', value }]); }
               function setStart(value) { modifyMatchSchedule([{ attr: 'start', value }]); }
               function setEnd(value) { modifyMatchSchedule([{ attr: 'end', value }]); }
               function assessPenalty(penalty, penalty_index, penalty_value) {
                  let players = match.players.map(p=>p.full_name);
                  displayGen.svgModal({ x: ev.clientX, y: ev.clientY, options: players, callback: playerPenalty });
                  function playerPenalty(player, index, value) {
                     let puid = match.players[index].puid;
                     let tournament_player = tournament.players.reduce((p, s) => s.puid == puid ? s : p);
                     if (!tournament_player.penalties) tournament_player.penalties = [];
                     displayGen.escapeModal();
                     let penalty_code = `penalties.${penalty.value}`;
                     let message = `
                        ${lang.tr('draws.penalty')}: ${lang.tr(penalty_code)}
                        <p style='color: red'>${tournament_player.first_name} ${tournament_player.last_name}</p>
                     `;
                     displayGen.okCancelMessage(message, savePenalty, () => displayGen.closeModal());
                     function savePenalty() {
                        let penalty_event = {
                           penalty,
                           muid: match.muid,
                           round: match.round_name,
                           event: match.event.name,
                           tuid: tournament.tuid,
                           time: new Date().getTime()
                        }
                        tournament_player.penalties.push(penalty_event);
                        saveTournament(tournament);
                        displayGen.closeModal();
                     }
                  }
               }
               function matchStatus(choice, index) {
                  match.status = choice.value == 'clear' ? '' : choice.label;
                  match.source.status = match.status;
                  updateScheduleBox(match);
               }
               function timeHeading(selection, index) {
                  if (index == 0) {
                     modifyMatchSchedule([{ attr: 'time_prefix', value: `${lang.tr('schedule.nb')} ` }]);
                  } else if (index == 1) {
                     let pairs = [
                        { attr: 'time_prefix', value: lang.tr('schedule.followedby') },
                        { attr: 'time', value: '' },
                        { attr: 'heading', value: '' },
                     ];
                     modifyMatchSchedule(pairs);
                  } else if (index == 2) {
                     let pairs = [
                        { attr: 'time_prefix', value: lang.tr('schedule.afterrest') },
                        { attr: 'time', value: '' },
                        { attr: 'heading', value: '' },
                     ];
                     modifyMatchSchedule(pairs);
                  } else if (index == 3) {
                     let pairs = [
                        { attr: 'time_prefix', value: lang.tr('schedule.tba') },
                        { attr: 'time', value: '' },
                     ];
                     modifyMatchSchedule(pairs);
                  } else if (index == 4) {
                     let pairs = [
                        { attr: 'time_prefix', value: '' },
                        { attr: 'time', value: '' },
                        { attr: 'heading', value: lang.tr('schedule.nextavailable') },
                     ];
                     modifyMatchSchedule(pairs);
                  } else if (index == 5) {
                     let pairs = [
                        { attr: 'time_prefix', value: '' },
                        { attr: 'heading', value: '' },
                     ];
                     modifyMatchSchedule(pairs);
                  }
               }
               function modifyMatchSchedule(pairs, display=true) {
                  pairs.forEach(pair => {
                     match.schedule[pair.attr] = pair.value
                     if (match.source) match.source.schedule[pair.attr] = pair.value;
                  });
                  if (display) updateScheduleBox(match);
                  saveTournament(tournament);
               }
            }
         }
         function selectMatch(ev) {
            let { match, target } = identifyMatch(ev);

            if (state.edit && match) {
               let e = tfx.findEventByID(tournament, match.event.euid);

               let existing_scores = match.score ? 
                  scoreBoard.convertStringScore({
                     string_score: match.score,
                     score_format: match.score_format || {},
                     winner_index: match.source.winner_index
                  }) : undefined;

               let scoreSubmitted = (outcome) => {
                  displayGen.escapeFx = undefined;
                  if (!outcome) return;

                  // this must happen first as 'e' is modified
                  let result = (e.draw_type == 'R') 
                     ? scoreRoundRobin(tournament, e, existing_scores, outcome)
                     : scoreTreeDraw({ tournament, e, muid: match.muid, existing_scores, outcome });

                  if (result && !result.error) {

                     // is this duplication?
                     match.winner_index = outcome.winner;
                     match.score = outcome.score;
                     if (outcome.score) match.status = '';
                     match.score_format = outcome.score_format;
                     // end duplication q.

                     updateScheduleBox(match);

                     // now update matches to show new matches resulting from completion
                     filterDayMatches();

                     let dependent = match.dependent ? day_matches.reduce((p, c) => c.muid == match.dependent ? c : p, undefined) : undefined;
                     updateScheduleBox(dependent);

                     displayPending();
                     filterSearchList();

                     outOfDate(e);
                  }
               }

               if (match && match.teams) {
                  if (match.teams.length != 2 || unQualified(match.teams)) {
                     console.log('not two teams');
                  } else {
                     let muid = match.muid;
                     let round_name = match.round_name || '';
                     let score_format = match.score_format || e.score_format || {};
                     if (!score_format.final_set_supertiebreak) score_format.final_set_supertiebreak = e.format == 'D' ? true : false;


                     scoreBoard.setMatchScore({
                        muid,
                        container,
                        round_name,
                        score_format,
                        existing_scores,
                        teams: match.teams,
                        callback: scoreSubmitted,
                        flags: fx.fx.env().assets.flags,
                     });
                  }
               }

               function unQualified(teams) { return teams.reduce((p, c) => !c[0].puid || p, false); }
            }
         }
      }

      function outOfDate(e, draw_creation) {
         if (!e || !e.published) return;
         e.up_to_date = false;
         if (e.euid != displayed_draw_event.euid) return;
         displayGen.drawBroadcastState(container.publish_state.element, e);

         let publishing = fx.fx.env().publishing;
         let broadcast = (publishing.publish_on_score_entry && e.active) || (draw_creation && publishing.publish_draw_creation);

         if (broadcast) {
            broadcastEvent(tournament, e);
            if (tournament.schedule.published) publishSchedule(false);
         }
      }

      function courtsTab() {
         if (!state.edit && (!tournament.locations || !tournament.locations.length)) {
            // hide events tab if there are no events and not in edit mode
            tabVisible(container, 'CT', false);
            // revert to the first tab (in this case tournament overview);
            displayTab(0);
            return;
         }
         tabVisible(container, 'CT', true);

         locationList();

         let actions = d3.select(container.locations_actions.element);
         if (state.edit) {
            actions.style('display', 'flex');
            actions.select('.add').style('display', 'inline');
         } else {
            actions.style('display', 'none');
            actions.select('.add').style('display', 'none');
            let detail_actions = d3.select(container.location_details.element);
            detail_actions.select('.save').style('display', 'none');
            detail_actions.select('.del').style('display', 'none');
         }

      }

      function locationList(displayed_location) {
         let locations = tournament.locations || [];

         let highlight_listitem;
         locations.forEach((l, i) => { if (l.luid == displayed_location) highlight_listitem = i; });

         displayGen.locationList(container, locations, highlight_listitem);

         let locationDetails = (evt) => {
            let clicked_location = util.getParent(evt.target, 'location');
            let class_list = clicked_location.classList;
            if (class_list.contains('highlight_listitem')) {
               closeLocationDetails();
               locationList();
            } else {
               Array.from(container.locations.element.querySelectorAll('.highlight_listitem'))
                  .forEach(elem => elem.classList.remove('highlight_listitem'));
               class_list.add('highlight_listitem');
               let index = clicked_location.getAttribute('index');
               displayLocation({ location: tournament.locations[index], index });
            }
         }
         // attach action to display location_details when clicking each location
         util.addEventToClass('location', locationDetails, container.locations.element);

         scheduleTab();
      }

      function newLocation() {
         let l = {
            name: '',
            courts: 0,
            address: '',
            luid: UUID.new(),
         };
         displayLocation({ location: l });
      }
      
      function displayLocation({ location: l, index }) {
         if (!tournament.locations) tournament.locations = [];
         let location_index = tournament.locations.map(m=>m.luid).indexOf(l.luid);
         index = index || (location_index >= 0 ? location_index : undefined);

         let actions = d3.select(container.location_details.element);
         actions.select('.event_name').html(l.name);

         locationBackground(l);
         configureLocationAttributes(l);

         actions.style('display', 'flex');

         if (state.edit) {
            if (index != undefined) {
               actions.select('.save').style('display', 'none');
               actions.select('.cancel').style('display', 'none');
               actions.select('.del').style('display', 'inline')
                  .on('click', () => { 
                     displayGen.escapeModal();
                     let message = `${lang.tr('actions.delete_location')}: ${l.name}?`;
                     displayGen.okCancelMessage(message, deleteLocation, () => displayGen.closeModal());
                  });
               actions.select('.done').style('display', 'inline')
                  .on('click', () => {
                     closeLocationDetails();
                     locationList();
                     saveTournament(tournament);
                  });
            } else {
               actions.select('.del').style('display', 'none');
               actions.select('.done').style('display', 'none');
               actions.select('.save')
                  .style('display', 'inline')
                  .on('click', () => { 
                     if (!tournament.locations) tournament.locations = [];
                     if (!l.abbreviation || !l.name || !l.address) return;

                     tournament.locations.push(l);
                     let i = tournament.locations.length - 1;
                     displayLocation({ location: l, index: i });

                     locationList(l.luid);
                     closeLocationDetails();
                     saveTournament(tournament);
                  });
               actions.select('.cancel')
                  .style('display', 'inline')
                  .on('click', closeLocationDetails);
            }
         } else {
            actions.select('.done')
               .style('display', 'inline')
               .on('click', closeLocationDetails);
         }

         function deleteLocation() {
            closeLocationDetails();
            tournament.locations.splice(index, 1);
            locationList();
            saveTournament(tournament);

            let { pending_matches } = mfx.tournamentEventMatches({ tournament, source: true });
            pending_matches.forEach(match => {
               if (match.schedule && match.schedule.luid == l.luid) {
                  match.schedule = {};
                  match.source.schedule = {};
               }
            });
            displayGen.closeModal();
         }

         // TODO: update scheduling tab?
      }

      function playersTab() {
         if (state.edit) enableAddPlayer();
         if (!tournament.categories) tournament.categories = [tournament.category];

         // create an array of ids of all players who are selected for any event
         // used to prevent sign-out of approved players
         let players_approved = () => !tournament.events ? [] : [].concat(...tournament.events.map(e => {
            if (!e.approved) return [];
            return e.teams ? [].concat(...e.teams) : [].concat(...e.approved);
         }));

         // TODO: ability to sort by either name or rank

         let category = staging.legacyCategory(tournament.category, true);

         let tournament_date = tournament && (tournament.points_date || tournament.end);
         let calc_date = tournament_date ? new Date(tournament_date) : new Date();
         let categories = fx.fx.orgCategories({ calc_date }).map(r => ({ key: r, value: r }));
         let prior_value = container.category_filter.ddlb ? container.category_filter.ddlb.getValue() : undefined;
         if (categories.map(o=>o.value).indexOf(prior_value) < 0) prior_value = undefined;
         
         dd.attachDropDown({ 
            id: container.category_filter.id, 
            options: categories,
            label: `${lang.tr('cat')}:`, 
         });
         container.category_filter.ddlb = new dd.DropDown({ element: container.category_filter.element, id: container.category_filter.id, onChange: categoryChanged });
         container.category_filter.ddlb.setValue(prior_value || category, 'white');

         // playersTab has a category DDLB... and this should be used for ordering players...
         let current_value = prior_value || tournament.categories[0];
         let t_players = tfx.orderPlayersByRank(tournament.players, current_value)
            .filter(player => playerFx.eligibleForCategory({ calc_date, category: current_value, player }));

         let points_table = fx.fx.pointsTable({calc_date});
         let ctgs = points_table && points_table.categories;
         let ratings = ctgs && ctgs[current_value] && ctgs[current_value].ratings;
         let ratings_type = ratings && ratings.type;

         if (!t_players.length && !state.edit) {
            d3.select('#YT' + container.container.id).style('display', 'none');
            return;
         }

         let display_order = displayGen.displayTournamentPlayers({ container, tournament, players: t_players, filters, ratings_type, edit: state.edit });

         function categoryChanged(selected_category) { playersTab(); }

         function tournamentPlayerContext(evt) {
            // if modifying rankings, disable!
            if (state.manual_ranking || !state.edit) return;
            let element = util.getParent(evt.target, 'player_click');

            let puid = element.getAttribute('puid');
            if (!puid) { console.log('missing puid:', element); return; }

            let clicked_player = tournament.players.reduce((p, c) => { if (c.puid == puid) p = c; return p; }, undefined);
            let approved = players_approved().indexOf(clicked_player.id) >= 0; 
            let identify = fx.fx.env().players.identify;

            var mouse = { x: evt.clientX, y: evt.clientY }
            var options = [];
            options.push({ label: lang.tr('edt'), key: 'edit' });
            if (identify) options.push({ label: lang.tr('idp'), key: 'identify' });
            if (!approved) options.push({ label: lang.tr('dlp'), key: 'delete' });

            if (options.length == 1) {
               selectionMade({ key: options[0].key });
            } else {
               displayGen.svgModal({ x: mouse.x, y: mouse.y, options, callback: selectionMade });
            }

            function selectionMade(choice, index) {
               if (choice.key == 'edit') {
                  playerFx.editPlayer({ player_data: clicked_player, callback: savePlayerEdits });
               } else if (choice.key == 'delete') {
                  var caption = `<p>${lang.tr('delete')} ${lang.tr('ply')}:</p> <p>${clicked_player.full_name}</p>`;
                  displayGen.okCancelMessage(caption, deletePlayer, () => displayGen.closeModal());
                  function deletePlayer() {
                     tournament.players = tournament.players.filter(p=>p.puid != clicked_player.puid);
                     displayGen.closeModal();
                     saveFx();
                  }
               } else if (choice.key == 'identify') {
                  var selected_puid;
                  let modal = displayGen.selectNewPlayerIdentity(clicked_player);
                  modal.cancel.element.addEventListener('click', () => displayGen.closeModal());
                  let valid_players = searchBox.typeAhead._list;
                  let available = new Awesomplete(modal.search.element, { list: valid_players });

                  let selection_flag = false;
                  modal.search.element.addEventListener("awesomplete-selectcomplete", function(e) { selection_flag = true; setValue(); }, false);
                  modal.search.element.addEventListener('keydown', catchTab , false);
                  modal.search.element.addEventListener("keyup", function(e) { 
                     // auto select first item on 'Enter' *only* if selectcomplete hasn't been triggered
                     if (e.which == 13 && !selection_flag) {
                        if (available.suggestions && available.suggestions.length && modal.search.element.value) {
                           available.next();
                           available.select(0);
                           setValue();
                        }
                     }
                     selection_flag = false;
                  });
                  modal.search.element.focus();

                  function setValue() {
                     selected_puid = modal.search.element.value;
                     if (selected_puid) { db.findPlayer(selected_puid).then(confirmIdentity, util.logError); }
                     displayGen.closeModal();
                  }
                  function confirmIdentity(new_player_data) {
                     new_player_data.birth = util.formatDate(new_player_data.birth);
                     new_player_data.full_name = `${new_player_data.last_name.toUpperCase()}, ${util.normalizeName(new_player_data.first_name, false)}`;
                     displayGen.changePlayerIdentity(clicked_player, new_player_data, changePlayerIdentity);
                     function changePlayerIdentity() {
                        displayGen.closeModal();
                        tfx.replaceTournamentPlayer({ tournament, existing_player: clicked_player, new_player_data, replace_all: true });
                        saveFx();
                     }
                  }
               }
            }

            function savePlayerEdits(p) {
               let new_player_data = Object.assign({}, clicked_player);
               if (p.first_name) new_player_data.first_name = p.first_name;
               if (p.last_name) new_player_data.last_name = p.last_name;
               new_player_data.full_name = `${new_player_data.last_name.toUpperCase()}, ${util.normalizeName(new_player_data.first_name, false)}`;
               if (p.ioc) new_player_data.ioc = p.ioc;
               if (p.birth) new_player_data.birth = p.birth;
               if (p.sex) new_player_data.sex = p.sex;

               tfx.replaceTournamentPlayer({ tournament, existing_player: clicked_player, new_player_data });
               saveFx();
            }

            function saveFx() { saveTournament(tournament); playersTab(); }
         }

         // now add event to all players to display player profile
         let signInState = (evt) => {
            // if modifying rankings, disable!
            if (state.manual_ranking) return;

            let element = util.getParent(evt.target, 'player_click');
            let puid = element.getAttribute('puid');
            if (!puid) {
               console.log('missing puid:', element);
               return;
            }

            let clicked_player = tournament.players.reduce((p, c) => { if (c.puid == puid) p = c; return p; }, undefined);

            let medical = playerFx.medical(clicked_player);
            let registration = playerFx.registration(clicked_player);
            let approved = players_approved().indexOf(clicked_player.id) >= 0; 
            let penalties = clicked_player.penalties && clicked_player.penalties.length;
            let withdrawn = !clicked_player ? false : clicked_player.withdrawn == 'Y' || clicked_player.withdrawn == true;

            // rapid mode allows sign-in with single click
            if (state.edit && o.sign_in.rapid && !withdrawn && registration) {
               if (clicked_player) {
                  if (clicked_player.signed_in) {
                     if (approved) {
                        if (penalties) { return displayGen.playerPenalties(clicked_player, saveFx); } else { return cannotSignOut(); }
                        function saveFx() { saveTournament(tournament); playersTab(); }
                     }
                     // must confirm sign-out
                     return playerFx.displayPlayerProfile({ puid }).then(()=>{}, ()=>displayIrregular(clicked_player));
                  } else {
                     if (medical) {
                        clicked_player.signed_in = true;
                        saveTournament(tournament);
                     } else {
                        playerFx.displayPlayerProfile({ puid }).then(()=>{}, ()=>displayIrregular(clicked_player));
                     }
                  }
               }
               finish();
            } else {
               playerFx.displayPlayerProfile({ puid, fallback: clicked_player }).then(()=>{}, ()=>displayIrregular(clicked_player));
            }

            // disallow sign-out of a player who is approved for any event
            function cannotSignOut() { displayGen.popUpMessage(`<div>${lang.tr('phrases.cannotsignout')}<p>${lang.tr('phrases.approvedplayer')}</div>`); }

            function displayIrregular(player, result) {
               if (state.edit) {
                  player.signed_in = false;
                  saveTournament(tournament);
               } else {
                  // TODO: display this player
                  console.log('player:', player);
               }
               finish();
            }

            function finish() {
               let e = tfx.findEventByID(tournament, displayed_event);
               if (e) eventPlayers(e);
               playersTab();
               eventsTab();
            }

         }

         let playerByPUID = (puid) => tournament.players.reduce((p, c) => { if (c.puid == puid) { p = c }; return p; }, undefined)
         let stopPropagation = (evt) => { 
            evt.stopPropagation(); 
            evt.target.select();

            // or to place cursor at the end
            // let el = evt.target;
            // el.selectionStart = el.selectionEnd = el.value.length;
         }

         let entryKey = (evt, cls, attribute) => {
            let value = evt.target.value;
            function validRanking(value) { return /^\{\d*\}*$/.test(value) ? value : util.numeric(value); }
            function validRating(value) {return /^[-+]?\d+(\.\d+)?$/.test(value) ? value : value; }

            evt.target.value = cls && cls.indexOf('rating') >= 0 ? validRating(value) || '' : validRanking(value) || '';

            let element = util.getParent(evt.target, 'player_click');
            let puid = element.getAttribute('puid');
            let changed_player = playerByPUID(puid);

            // TODO: changed_value needs to be attribute sensitive
            // let changed_value = evt.target.value != validRanking(changed_player.category_ranking) && evt.target.value != validRanking(changed_player.modified_ranking);

            if (changed_player) {
               let changeable = true;
               /*
               let changeable = players_approved().indexOf(changed_player.id) >= 0 ? false : true;
               if (!changeable && changed_value) {
                  let message = `<div>${lang.tr('phrases.cannotchangerank')}<p>${lang.tr('phrases.approvedplayer')}</div>`;
                  displayGen.escapeModal();
                  displayGen.popUpMessage(message);
               }
               */
               // TODO: in the future will need to modify rank for categories if there are multiple categories in one tournament
               if (attribute == 'rank') { 
                  if (changeable) {
                     if (value.indexOf('{') == 0) {
                        if (/^\{\d+\}$/.test(value)) {
                           let v = util.numeric((/^\{(\d+)\}$/.exec(value) || [])[1]);
                           changed_player.modified_ranking = v;
                           changed_player.int = v;
                        } else if (/^\{\}$/.test(value)) {
                           delete changed_player.modified_ranking;
                           delete changed_player.int;
                        }
                     } else {
                        changed_player.modified_ranking = isNaN(value) || value == 0 ? undefined : +value; 
                        changed_player.category_ranking = isNaN(value) || value == 0 ? undefined : +value; 
                        checkDuplicateRankings(display_order);
                     }
                  } else {
                     evt.target.value = validRanking(changed_player.modified_ranking || changed_player.category_ranking) || '';
                  }
               } else if (attribute == 'rating') {
                  if (changeable) {
                     if (!changed_player.ratings) changed_player.ratings = {};
                     if (!changed_player.ratings[ratings_type]) changed_player.ratings[ratings_type] = { singles: { status: '', value: '' }, doubles: { status: '', value: '' }};
                     changed_player.ratings[ratings_type].singles.value = value;
                  } else {
                     // evt.target.value = validRating(changed_player.ratings[ratings_type].singles.value) || '';
                  }
               } else {
                  if (changeable) {
                     changed_player.subrank = isNaN(value) ? undefined : +value;
                  } else {
                     evt.target.value = changed_player.subrank || '';
                  }
               }
            }

            if (!displayGen.disable_keypress && (evt.which == 13 || evt.which == 9)) {
               // now move the cursor to the next player's ranking
               let order = evt.target.getAttribute('order');
               let entry_fields = Array.from(container.players.element.querySelectorAll(cls));
               let next = entry_fields
                  .filter(f => {
                     let o = f.getAttribute('order');
                     return (o && (+o == +order + 1));
                  });
               if (next.length) {
                  next[0].focus();
                  next[0].select();
               } else if (entry_fields.length) {
                  entry_fields[0].focus();
               }
            }

         }

         let rankEntryKey = (evt) => entryKey(evt, '.manualrank', 'rank');
         let ratingEntryKey = (evt) => entryKey(evt, '.manualrating', 'rating');
         let subRankKey = (evt) => entryKey(evt, '.subrank', 'subrank');

         let rankByRating = () => {
            if (!state.edit || !tournament.players || !tournament.players.length) return;
            let message = `Rank Players by Rating?`;
            displayGen.okCancelMessage(message, rankEm, () => displayGen.closeModal());

            function rankEm() {
               displayGen.closeModal();
               tournament.players.forEach(p => { delete p.rank; delete p.modified_ranking; delete p.category_ranking; });
               let rated_players = tournament.players
                  .filter(p=>p.ratings && p.ratings[ratings_type] && p.ratings[ratings_type].singles && parseFloat(p.ratings[ratings_type].singles.value));
               rated_players
                  .sort((a, b) => parseFloat(b.ratings[ratings_type].singles.value) - parseFloat(a.ratings[ratings_type].singles.value))
                  .forEach((p, i) => p.modified_ranking = i+1);
               saveTournament(tournament);
               playersTab();
            }
         }

         util.addEventToClass('manualrank', catchTab, container.players.element, 'keydown');
         util.addEventToClass('manualrating', catchTab, container.players.element, 'keydown');
         util.addEventToClass('subrank', catchTab, container.players.element, 'keydown');

         util.addEventToClass('player_click', signInState, container.players.element);
         util.addEventToClass('player_click', tournamentPlayerContext, container.players.element, 'contextmenu');
         util.addEventToClass('ranksub', stopPropagation, container.players.element);
         util.addEventToClass('rankentry', stopPropagation, container.players.element);
         util.addEventToClass('ratingentry', stopPropagation, container.players.element);
         util.addEventToClass('manualrank', rankEntryKey, container.players.element, 'keyup');
         util.addEventToClass('manualrating', ratingEntryKey, container.players.element, 'keyup');
         util.addEventToClass('subrank', subRankKey, container.players.element, 'keyup');
         util.addEventToClass('rankbyrating', rankByRating, container.players.element);
         util.addEventToClass('rankbyrating', rankByRating, container.players.element, 'contextmenu');
         checkDuplicateRankings(display_order);
         signInSheet();
      }

      function displayedPlayers() {
         let displayed_players = tournament.players || [];
         if (filters.indexOf('M') >= 0) displayed_players = displayed_players.filter(f=>f.sex != 'M');
         if (filters.indexOf('W') >= 0) displayed_players = displayed_players.filter(f=>f.sex != 'W');
         let opacity = (state.edit && displayed_players.length) ? 1 : 0;
         document.querySelector('.ranking_order').style.opacity = opacity;
         document.querySelector('.' + classes.ranking_order).classList[opacity ? 'add' : 'remove']('infoleft');
         return displayed_players;
      }

      function checkDuplicateRankings(display_order) {
         if (state.edit && tournament.players) {
            let displayed_players = displayedPlayers();
            let signed_in = displayed_players.filter(p=>p.signed_in);

            // separate male & female
            let m = signed_in.filter(f=>f.sex == 'M');
            let w = signed_in.filter(f=>f.sex == 'W');

            let male_duplicates = tfx.rankDuplicates(m);
            let all_duplicates = tfx.rankDuplicates(w, male_duplicates);
            if (all_duplicates.length) enableSubRankEntry(true, all_duplicates);
         }
      }

      function enableSubRankEntry(visible, puids) {
         Array.from(document.querySelectorAll('.ranksub')).forEach(e=>e.style.display = visible ? '' : 'none');
         Array.from(document.querySelectorAll('.subrank'))
            .forEach(el => {
               let puid = el.getAttribute('puid');
               let enabled = (visible && puids.indexOf(puid) >= 0);
               el.style.opacity = enabled ? 1 : 0
               el.disabled = !enabled;
            });
      }

      function tournamentPoints(tournament, mz) {
         var tournament_date = tournament && (tournament.points_date || tournament.end);
         var points_date = tournament_date ? new Date(tournament_date) : new Date();
         if (!mz || !mz.length) return;

         checkAllPlayerPUIDs(tournament.players).then(proceed, util.logError);

         function proceed() {
            // remove any calculated points or rankings
            mz.forEach(match => match.players.forEach(scrubPlayer));

            var points_table = fx.fx.pointsTable({ calc_date: points_date });

            var match_data = { matches: mz, points_table, points_date };
            var points = rankCalc.calcMatchesPoints(match_data);

            if (sameOrg(tournament)) saveMatchesAndPoints({ tournament, matches: mz, points });
            displayTournamentPoints(container, tournament, points, filters);

            function scrubPlayer(p) { return playerFx.cleanPlayer(p); }
         }
      }

      function drawCreated(e) {
         // when a draw is created, matches should be accesible
         e.draw_created = new Date().getTime();
         enableDrawActions();
         tabVisible(container, 'MT');
         showSchedule();

         if (e.draw && e.draw.compass) {
            buildDirectionDraw(e, 'east', 'west', 'north', 'northeast');
            buildDirectionDraw(e, 'west', 'south', 'southwest')
            buildDirectionDraw(e, 'south', 'southeast')
            buildDirectionDraw(e, 'north', 'northwest')
            updateCompassDirections();
         }

         // add round_name to matches
         mfx.eventMatches(e, tournament);
         saveTournament(tournament);
      }

      function buildDirectionDraw(e, current_direction, direction_1st, direction_2nd, direction_3rd) {
         if (!current_direction || !e.draw || !e.draw[current_direction]) return {};

         let loss_count = fx.fx.env && fx.fx.env().draws.compass_draw.direction_by_loss;

         let draw_info = dfx.drawInfo(e.draw[current_direction]); 
         let byes = draw_info.bye_nodes; 
         let structural_byes = draw_info.structural_byes;
         let all_matches = draw_info.all_matches; 

         let round_1st = all_matches.filter(m=>m.height == 1 && !dfx.byeNode(m));
         let round_2nd = all_matches.filter(m=>m.height == 2);
         let round_3rd = all_matches.filter(m=>m.height == 3);
         let round_4th = all_matches.filter(m=>m.height == 4);

         let offset_losses = all_matches.filter(m=>m.height == 2).length - round_1st.length;
         if (offset_losses < 0) offset_losses = 0;

         let loss_1st = all_matches.filter(m=>m.height == 1).length - offset_losses;
         let loss_2nd = all_matches.filter(m=>m.height == 2).length;
         let loss_3rd = all_matches.filter(m=>m.height == 3).length;

         let players_1st = loss_count ? loss_1st : round_1st.length;
         let players_2nd = loss_count ? loss_2nd : round_2nd.length;
         let players_3rd = loss_count ? loss_3rd : round_3rd.length;

         let direction_1st_size = direction_1st && players_1st > 1 && dfx.acceptedDrawSizes(players_1st);
         let direction_2nd_size = direction_2nd && players_2nd > 1 && dfx.acceptedDrawSizes(players_2nd);
         let direction_3rd_size = direction_3rd && players_3rd > 1 && dfx.acceptedDrawSizes(players_3rd);

         if (direction_1st && direction_1st_size) {
            e.draw[direction_1st] = dfx.buildDraw({ teams: direction_1st_size, direction: direction_1st });
            dfx.distributeByes({ draw: e.draw[direction_1st], num_players: players_1st });
            e.draw[direction_1st].unseeded_teams = [];
            e.draw[direction_1st].opponents = [];
         }
         if (direction_2nd && direction_2nd_size) {
            e.draw[direction_2nd] = dfx.buildDraw({ teams: direction_2nd_size, direction: direction_2nd });
            e.draw[direction_2nd].unseeded_teams = [];
            e.draw[direction_2nd].opponents = [];
         }
         if (direction_3rd && direction_3rd_size) {
            e.draw[direction_3rd] = dfx.buildDraw({ teams: direction_3rd_size, direction: direction_3rd });
            e.draw[direction_3rd].unseeded_teams = [];
            e.draw[direction_2nd].opponents = [];
         }
      }

      function showSchedule() {
         let no_events = !tournament.events || !tournament.events.length;
         let only_matches = group_draws && group_draws.length && no_events;
         let visible = !tournamentCourts() || only_matches || no_events ? false : true;
         tabVisible(container, 'ST', visible);
         return visible;
      }

      function tournamentCourts() {
         if (!tournament.locations || !tournament.locations.length) return 0;
         return tournament.locations.map(l=>l.courts).reduce((p, c) => +p + +c, 0);
      }

      function matchesTab() {
         let t_matches = tMatches();
         tabVisible(container, 'MT', t_matches);

         showSchedule();
         if (!t_matches) return;

         pointsTab(tournament, container, filters);

         let { completed_matches, pending_matches, upcoming_matches } = mfx.tournamentEventMatches({ tournament });

         if (!completed_matches.length && dbmatches && dbmatches.length) {
            // if matches array part of tournament object, matches have been imported
            dbmatches.forEach(match => match.outcome = mfx.matchOutcome(match));
            displayGen.displayTournamentMatches({ tournament, container, completed_matches: dbmatches, filters });
            calcPlayerPoints({ tournament, matches: dbmatches, container, filters });
         } else {
            displayGen.displayTournamentMatches({ tournament, container, pending_matches, completed_matches, filters });
            tournamentPoints(tournament, completed_matches);
         }

         // attach function to display player profile when clicked
         util.addEventToClass('player_click', playerFx.playerClicked, container.matches.element);
         util.addEventToClass('player_click', playerInMatchContext, container.matches.element, 'contextmenu');

         function enterMatchScore(e, match) {
            let existing_scores = match && match.match && match.match.score ? 
               scoreBoard.convertStringScore({
                  string_score: match.match.score,
                  score_format: match.match.score_format || {},
                  winner_index: match.match.winner_index
               }) : undefined;

            let scoreSubmitted = (outcome) => {
               displayGen.escapeFx = undefined;
               // this must happen first as 'e' is modified
               if (e.draw_type == 'R') {
                  scoreRoundRobin(tournament, e, existing_scores, outcome);
               } else {
                  scoreTreeDraw({ tournament, e, muid: match.match.muid, existing_scores, outcome });
               }
               matchesTab();
            }

            if (match && match.teams) {
               let muid = match.match.muid;
               let round_name = match.round_name || '';

               let score_format = match.score_format || e.score_format || {};
               if (!score_format.final_set_supertiebreak) score_format.final_set_supertiebreak = e.format == 'D' ? true : false;

               scoreBoard.setMatchScore({
                  muid,
                  container,
                  round_name,
                  score_format,
                  existing_scores,
                  teams: match.teams,
                  callback: scoreSubmitted,
                  flags: fx.fx.env().assets.flags,
               });
            }
         }

         function matchClicked(evt) {
            let muid = evt.target.getAttribute('muid');
            let euid = evt.target.getAttribute('euid');
            if (!muid || !euid) return;
            let e = tfx.findEventByID(tournament, euid);
            let match = mfx.eventMatches(e, tournament).reduce((p, c) => p = (c.match.muid == muid) ? c : p, undefined);
            if (state.edit && match.match.winner == undefined) {
               if (match.match.schedule && match.match.schedule.court) {
                  enterMatchScore(e, match);
               } else {
                  // displayGen.popUpMessage('schedule match');
               }
            }
         }
         util.addEventToClass('cell_singles', matchClicked, container.matches.element);
         util.addEventToClass('cell_doubles', matchClicked, container.matches.element);

         function playerInMatchContext(evt) {
            let puid = evt.target.getAttribute('puid');
            let row = util.getParent(evt.target, 'matchrow');
            let muid = row.getAttribute('muid');
            let euid = row.getAttribute('euid');
            matchContext(evt, muid, euid, puid);
         }

         function matchContext(evt, muid, euid, puid) {
            if (!state.edit) return;
            muid = muid || evt.target.getAttribute('muid');
            euid = euid || evt.target.getAttribute('euid');
            if (!muid || !euid) return;
            let mouse = {
               x: evt.clientX,
               y: evt.clientY
            }
            let e = tfx.findEventByID(tournament, euid);
            let match = mfx.eventMatches(e, tournament).reduce((p, c) => p = (c.match.muid == muid) ? c : p, undefined);
            if (state.edit && match.match && match.match.schedule && match.match.schedule.court) {
               matchesTabContext(e, mouse, match.match, puid);
            }
         }
         util.addEventToClass('cell_singles', matchContext, container.matches.element, 'contextmenu');
         util.addEventToClass('cell_doubles', matchContext, container.matches.element, 'contextmenu');

         function matchesTabContext(e, mouse, match, puid) {
            let complete = match && match.winner != undefined;
            let options = [
               { label: lang.tr('draws.starttime'), key: 'starttime' },
               { label: lang.tr('draws.endtime'), key: 'endtime' },
            ];
            if (!complete) { options.push({ label: lang.tr('draws.changestatus'), key: 'changestatus' }); }
            if (puid) options.push({ label: lang.tr('draws.penalty'), key: 'penalty' });

            displayGen.svgModal({ x: mouse.x, y: mouse.y, options, callback: modifySchedule });

            function modifySchedule(choice, index) {
               if (choice.key == 'changestatus') {
                  let statuses = [
                     { label: lang.tr('schedule.called'),  value: 'called' },
                     { label: lang.tr('schedule.oncourt'),  value: 'oncourt' },
                     { label: lang.tr('schedule.warmingup'),  value: 'warmingup' },
                     { label: lang.tr('schedule.suspended'),  value: 'suspended' },
                     { label: lang.tr('schedule.raindelay'),  value: 'raindelay' },
                     { label: lang.tr('schedule.clear'),  value: 'clear' },
                  ];
                  displayGen.svgModal({ x: mouse.x, y: mouse.y, options: statuses, callback: matchStatus });
               } else if (choice.key == 'starttime') {
                  let time_string = match.schedule && (match.schedule.start || match.schedule.time);
                  displayGen.timePicker({ value: time_string, hour_range: { start: 8 }, minute_increment: 5, callback: setStart })
               } else if (choice.key == 'endtime') {
                  let time_string = match.schedule && match.schedule.end;
                  displayGen.timePicker({ value: time_string, hour_range: { start: 8 }, minute_increment: 5, callback: setEnd })
               } else if (choice.key == 'penalty') {
                  let statuses = [
                     { label: lang.tr('penalties.illegalcoaching'), value: 'illegalcoaching' },
                     { label: lang.tr('penalties.unsporting'), value: 'unsporting' },
                     { label: lang.tr('penalties.ballabuse'), value: 'ballabuse' },
                     { label: lang.tr('penalties.racquetabuse'), value: 'racquetabuse' },
                     { label: lang.tr('penalties.equipmentabuse'), value: 'equipmentabuse' },
                     { label: lang.tr('penalties.cursing'), value: 'cursing' },
                     { label: lang.tr('penalties.rudegestures'), value: 'rudegestures' },
                     { label: lang.tr('penalties.foullanguage'), value: 'foullanguage' },
                     { label: lang.tr('penalties.timeviolation'), value: 'timeviolation' },
                     { label: lang.tr('penalties.latearrival'), value: 'latearrival' },
                     { label: lang.tr('penalties.fail2signout'), value: 'fail2signout' },
                  ];
                  displayGen.svgModal({ x: mouse.x, y: mouse.y, options: statuses, callback: assessPenalty });
               }
            }

            function setStart(value) { modifyMatchSchedule([{ attr: 'start', value }]); }
            function setEnd(value) { modifyMatchSchedule([{ attr: 'end', value }]); }
            function modifyMatchSchedule(pairs, display=true) {
               pairs.forEach(pair => {
                  match.schedule[pair.attr] = pair.value
                  if (match.source) match.source.schedule[pair.attr] = pair.value;
               });
               if (display) updateScheduleBox(match);
               saveTournament(tournament);
               matchesTab();
            }
            function assessPenalty(penalty, penalty_index, penalty_value) {
               let tournament_player = tournament.players.reduce((p, s) => s.puid == puid ? s : p);
               if (!tournament_player.penalties) tournament_player.penalties = [];
               displayGen.escapeModal();
               let penalty_code = `penalties.${penalty.value}`;
               let message = `
                  ${lang.tr('draws.penalty')}: ${lang.tr(penalty_code)}
                  <p style='color: red'>${tournament_player.first_name} ${tournament_player.last_name}</p>
               `;
               displayGen.okCancelMessage(message, savePenalty, () => displayGen.closeModal());
               function savePenalty() {
                  let penalty_event = {
                     penalty,
                     muid: match.muid,
                     round: match.round_name,
                     event: e.name,
                     tuid: tournament.tuid,
                     time: new Date().getTime()
                  }
                  tournament_player.penalties.push(penalty_event);
                  saveTournament(tournament);
                  matchesTab();
                  displayGen.closeModal();
               }
            }

            function matchStatus(choice, index) {
               match.status = choice.value == 'clear' ? '' : choice.label;
               if (match.source) match.source.status = match.status;
               saveTournament(tournament);
               matchesTab();
            }
         }
      }

      function deletePublishedEvent(tourny, evt) {
         let ouid = tourny.org && tourny.org.ouid;
         let event_matches = !evt.draw ? [] : dfx.matches(evt.draw).filter(m=>m.match && m.match.muid).map(m=>({ muid: m.match.muid, tuid: tourny.tuid }));; 
         let deleteRequest = { ouid, euid: evt.euid, tuid: tourny.tuid, matches: event_matches };
         if (!deleteRequest || !deleteRequest.euid) return;
         coms.emitTmx({deleteRequest});
      }

      function broadcastEvent(tourny, evt, callback) {
         if (!evt) return;
         let env = fx.fx.env();

         let draw_object = (evt.draw_type == 'R') ? rr_draw : tree_draw;
         let options = draw_object.options();
         let draw_type_name = tfx.genEventName(evt, tfx.isPreRound({ env, e: evt })).type;

         tourny.org = tourny.org || env.org;
         let updateBroadcastStatus = () => {
            evt.up_to_date = true;
            evt.published = evt.published || new Date().getTime();
            if (displayed_draw_event && evt.euid == displayed_draw_event.euid) {
               displayGen.drawBroadcastState(container.publish_state.element, displayed_draw_event);
            }
            saveTournament(tourny);
            enableTournamentOptions();
            if (callback && typeof callback == 'function') callback();
         }
         coms.requestAcknowledgement({ uuid: evt.euid, callback: updateBroadcastStatus });
         mfx.eventMatches(evt, tournament);
         publishFx.broadcastEvent({ tourny, evt, draw_type_name, options });

         saveTournament(tourny);
      }

      function pointsTab(tournament, container, filters=[]) {
         db.findTournamentPoints(tournament.tuid).then(points => {
            if (points.length) {
               let player_points = { singles: {}, doubles: {} };
               points.forEach(point => {
                  let format = point.format;
                  let existing = player_points[format][point.name];
                  if (existing && existing.points > point.points) return;
                  player_points[format][point.name] = point;
               });
               displayTournamentPoints(container, tournament, player_points, filters);
            } else {
               pointsTabVisible(container, tournament, false);
            }
         });
      }

      function displayDraw({ evt }) { 
         if (!evt.draw) return;
         if (displayed_draw_event) displayGen.drawRepState(container.player_reps_state.element, displayed_draw_event);

         tree_draw.options({ draw: { feed_in: evt.structure == 'feed' }});

         if (evt.draw.compass) {
            if (evt.draw[evt.draw.compass] && evt.draw[evt.draw.compass].children && evt.draw[evt.draw.compass].children.length) {
               tree_draw.data(evt.draw[evt.draw.compass]);
               if (tree_draw.info().doubles) tree_draw.options({ names: { seed_number: false }});

               // TODO: this is temporary while exploring other options
               let seeding = evt.draw[evt.draw.compass].opponents ? evt.gem_seeding || tfx.rankedTeams(evt.draw[evt.draw.compass].opponents) : true;

               let approved_opponents = tfx.approvedOpponents({ tournament, env: fx.fx.env(), e: evt });
               let seed_limit = dfx.seedLimit(approved_opponents.length);

               fx.drawOptions({ draw: tree_draw });
               tree_draw.options({ names: { seed_number: seeding }, details: { seeding }});
               tree_draw.options({ seeds: { limit: seed_limit } });
               tree_draw.options({ compass: { display: true } });

               tree_draw(); 
            }
         } else if (evt.draw.children && evt.draw.children.length) { 
            tree_draw.data(evt.draw);
            if (tree_draw.info().doubles) tree_draw.options({ names: { seed_number: false }});

            // TODO: this is temporary while exploring other options
            let seeding = evt.draw.opponents ? evt.gem_seeding || tfx.rankedTeams(evt.draw.opponents) : true;

            let approved_opponents = tfx.approvedOpponents({ tournament, env: fx.fx.env(), e: evt });
            let seed_limit = dfx.seedLimit(approved_opponents.length);
            if (evt.draw_type == 'Q') seed_limit = (evt.qualifiers * 2) || seed_limit;

            fx.drawOptions({ draw: tree_draw });
            tree_draw.options({ names: { seed_number: seeding }, details: { seeding }});
            tree_draw.options({ seeds: { limit: seed_limit } });

            tree_draw(); 
         } else if (evt.draw.brackets && evt.draw.brackets.length) {
            var bracket_sizes = fx.fx.env().draws.rr_draw.brackets;
            rr_draw
               .data(evt.draw)
               .options({ qualifying: evt.links && Object.keys(evt.links).indexOf('E') >= 0 })
               .selector(container.draws.element)
               .bracketSize(evt.draw.bracket_size || bracket_sizes.default_bracket_size);

            fx.drawOptions({ draw: rr_draw });
            rr_draw();
         }
      };
     
      function enableDrawActions() {
         let created = drawIsCreated(displayed_draw_event);
         let approved = displayed_draw_event && displayed_draw_event.approved;
         let visible = created && approved;
         let ouid = fx.fx.env().org && fx.fx.env().org.ouid;

         let current_draw = !displayed_draw_event ? undefined : 
            displayed_draw_event.draw && displayed_draw_event.draw.compass ? displayed_draw_event.draw[displayed_draw_event.draw.compass] :
            displayed_draw_event.draw;
         let direction = current_draw && current_draw.direction;
         let compass = direction && ['east', 'west', 'north', 'south', 'northeast', 'northwest', 'southeast', 'southwest'].indexOf(direction) >= 0;

         // if created by no approved players then it must be created from dbmatches
         let active = created && !visible ? true : displayed_draw_event ? displayed_draw_event.active : false;
         let svg = container.draws.element.querySelector('svg');

         let pdf_function = visible || state.edit;
         document.querySelector('.' + classes.print_draw).style.display = pdf_function && svg ? 'inline' : 'none';

         // let draw_creation = fx.fx.env().publishing.publish_draw_creation;
         // container.publish_draw.element.style.display = (draw_creation || (visible && svg)) && ouid && state.edit ? 'inline' : 'none';
         container.publish_draw.element.style.display = ouid && state.edit ? 'inline' : 'none';
         container.player_reps.element.style.display = approved && svg && state.edit ? 'inline' : 'none';
         container.recycle.element.style.display = !active && svg && state.edit ? 'inline' : 'none';
         container.compass.element.style.display = compass ? 'inline' : 'none';
      }

      function testLastSeedPosition(e) {
         var settings = fx.fx.env().drawFx;
         if (displayed_draw_event && displayed_draw_event.structure == 'feed') return;
         // after all seeded positions have been placed, distribute byes
         if (!e && !tree_draw.nextSeedGroup()) {
            // context is working with a tree_draw
            if (settings.auto_byes) tree_draw.distributeByes();
            if (settings.auto_qualifiers) tree_draw.distributeQualifiers();
         } else if (e && !dfx.nextSeedGroup({ draw: e.draw })) {
            // context is interacting directly with draw
            if (settings.auto_byes) dfx.distributeByes({ draw: e.draw });
            if (settings.auto_qualifiers) dfx.distributeQualifiers({ draw: e.draw });
         }
      }

      function removeQualifiedPlayer(e, team_ids, qlink, qlinkinfo) {
         let removed = tfx.removeQualifiedPlayer(tournament, e, team_ids, qlink, qlinkinfo);

         if (removed.linkchanges) {
            approvedChanged(removed.qlink);
            if (fx.fx.env().publishing.publish_on_score_entry) broadcastEvent(tournament, removed.qlink);
            if (removed.qlink.euid == displayed_draw_event.euid) {
               displayGen.drawBroadcastState(container.publish_state.element, removed.qlink);
            }
         }
      }

      function removeDirectionalPlayer(e, target_draw, losing_team_ids, linked_info) {
         let removed = tfx.removeDirectionalPlayer(tournament, e, target_draw, losing_team_ids, linked_info);
      }

      function scoreTreeDraw({ tournament, e, muid, existing_scores, outcome }) {
         let result = processResult(tournament, e, tfx.safeScoreTreeDraw({ tournament, e, muid, existing_scores, outcome }));
         if (result && result.approved_changed) {
            approvedChanged(result.approved_changed);
            tfx.setDrawSize(tournament, result.approved_changed);
         }
         return result;
      }

      function scoreRoundRobin(tournament, e, existing_scores, outcome) {
         let result = processResult(tournament, e, tfx.safeScoreRoundRobin(tournament, e, existing_scores, outcome));
         return result;
      }

      function processResult(tournament, e, result) {
         if (!result) {
            console.log('no result!');
         }

         if (result.error) {
            displayGen.popUpMessage(lang.tr(result.error));
            return result;
         }
         if (result.devmessage) {
            displayGen.popUpMessage(devmessage);
            return result;
         }
         if (result.exit) return result;

         if (result.linkchanges) approvedChanged(result.qlink);

         if (result.deleted_muid) {
            db.deleteMatch(result.deleted_muid);
            updateAfterDelete(e);
         } else {
            afterScoreUpdate(e, result.muid);
         }

         // if event is complete, send tournament to cloud
         if (dfx.drawInfo(e.draw).complete) pushTournament2Cloud(tournament);
         return result;
      }

      function updateAfterDelete(e) {
         e.up_to_date = false;
         let completed_matches = mfx.eventMatches(e, tournament).filter(m=>m.match && m.match.winner);
         if (!completed_matches.length) e.active = false;
         afterScoreUpdate(e);
      }

      function afterScoreUpdate(e, muid) {
         e.up_to_date = false;
         if (staging.broadcasting()) {
            if (fx.fx.env().publishing.livescore) { console.log('live score?'); }
            if (fx.fx.env().publishing.publish_on_score_entry) broadcastEvent(tournament, e);
         }
         if (!staging.broadcasting() || !fx.fx.env().publishing.publish_on_score_entry) {
            if (muid) {
               updateScheduleStatus({ muid });
            } else {
               updateScheduleStatus({ euid: e.euid });
            }
         }
         if (e.euid == displayed_draw_event.euid) {
            displayGen.drawBroadcastState(container.publish_state.element, e);
         }

         enableDrawActions();
         saveTournament(tournament);
      }

      function rrPlayerOrder(d) {
         let bracket = displayed_draw_event.draw.brackets[d.bracket];
         let player = bracket.players.reduce((p, c) => c.draw_position == d.row ? c : p, undefined);
         let tied = bracket.players.filter(p=>p.order == player.order);
         if (tied.length > 1) {
            let draw_id = `rrDraw_${d.bracket}`;
            let selector = d3.select(`#${container.draws.id} #${draw_id} svg`).node();
            let coords = d3.mouse(selector);
            let options = tied.map((p, i) => `${lang.tr('ord')}: ${i+1}`);
            let clickAction = (c, i) => {
               // first insure that no other player has the same sub_order
               bracket.players.filter(p=>p.order == player.order).forEach(p=>{ if (p.sub_order == i + 1) p.sub_order = 0 });

               // assign sub_order to selected player
               player.sub_order = i + 1;

               // update data
               rr_draw.data(displayed_draw_event.draw);
               // update one bracket without regenerating all brackets!
               rr_draw.updateBracket(d.bracket);

               displayed_draw_event.up_to_date = false;
               if (staging.broadcasting() && fx.fx.env().publishing.publish_on_score_entry) broadcastEvent(tournament, displayed_draw_event);
               displayGen.drawBroadcastState(container.publish_state.element, displayed_draw_event);
               saveTournament(tournament);
            }
            cMenu({ selector, coords, options, clickAction })
         }
      }

      // for generating draws when there are events which have been created by CourtHive Tournaments
      function genEventDraw(value) {
         let draw_width = +d3.select('#main').style('width').match(/\d+/)[0] * .9;
         let e = tournament.events[value];
         displayed_draw_event = e;

         tree_draw.options({ width: draw_width });
         tree_draw.events({
            'position': { 
               'contextmenu': contextPopUp,
               'click': positionClick,
            },
            'compass': {
               'click': compassClick,
            },
            'player1': {
               'contextmenu': contextPopUp,
            },
            'player2': {
               'contextmenu': contextPopUp,
            },
            'score': { 
               'click': positionClick, 
               'contextmenu': (d) => {
                  // TODO: contextMenu instead of straight to addUmpire
                  addUmpire(d.data.match, 'treedraw');
               },
            },
            'umpire': { 
               'click': (d) => { addUmpire(d.data.match, 'treedraw'); },
               'contextmenu': (d) => { addUmpire(d.data.match, 'treedraw'); },
            },
         });

         // insure no other draw is displayed
         tree_draw.data({})();

         rr_draw.events({
            'player': { 
               'click': rrPositionClick,
               'contextmenu': rrContextPopUp,
               'mouseover': rrMouseoverPlayer,
            },
            'score': { 
               'click': rrScoreEntry,
               'mouseover': rrMouseoverScore,
               'contextmenu': rrScoreAction,
            },
            'order': {
               'contextmenu': rrPlayerOrder,
            },
            'result': {
               'click': RRplayerStats,
            },
            'draw_position': {
               'click': RRgroupName,
               'contextmenu': RRgroupName,
            }
         });

         rr_draw.data({})();

         tfx.setDrawSize(tournament, e);
         if (state.edit && (!e.draw || e.regenerate)) {
            generateDraw(e);
            if (e.regenerate) {
               console.log('Regenerated => ', e.regenerate);
               delete e.regenerate;
            }
         }

         if (!e.approved || e.approved.length < 2 || (e.draw_type == 'R' && e.approved.length < 3)) {
            e.draw_created = false;
            delete e.draw;
         } else {
            displayDraw({ evt: e });
         }
         enableDrawActions();
         if (displayed_draw_event && e.euid == displayed_draw_event.euid) {
            displayGen.drawBroadcastState(container.publish_state.element, e);
         }

         eventList();
         return;

         // SUPPORTING FUNCTIONS...
         function RRplayerStats(d) {
            if (state.edit) {
               let player = displayed_draw_event.draw.brackets[d.bracket].players.reduce((p, c) => c.draw_position == d.row ? c : p, undefined);
               let content = displayGen.roundRobinResults(player.results);
               displayGen.floatingModal({ label: `${player.first_name} ${player.last_name}`, mouse: true, content });
               displayGen.escapeModal();
            }
         }

         function RRgroupName(d) {
            if (state.edit && !d.row && !d.column) {
               let bracket = e.draw.brackets[d.bracket];

               let rr_name_obj = displayGen.entryModal('nm', true);
               displayGen.escapeModal();

               let entry_modal = d3.select(rr_name_obj.entry_modal.element);

               let removeEntryModal = () => {
                  entry_modal.remove();
                  document.body.style.overflow = null;
                  displayGen.escapeFx = undefined;
               }

               entry_modal.on('click', removeEntryModal);
               rr_name_obj.search_field.element.addEventListener("keyup", function(e) { 
                  if (e.which == 13) {
                     submitRRname(rr_name_obj.search_field.element.value);
                     removeEntryModal();
                  }
               });

               function submitRRname(name) {
                  bracket.name = name;
                  rr_draw.data(e.draw);
                  rr_draw.updateBracket(d.bracket);
                  saveTournament(tournament);
               }
            }
         }

         function assignPosition(position, team, bye, qualifier) {
            let current_draw = displayed_draw_event.draw.compass ? displayed_draw_event.draw[displayed_draw_event.draw.compass] : displayed_draw_event.draw;
            let linked = tfx.findEventByID(tournament, e.links['Q']) || tfx.findEventByID(tournament, e.links['R']);
            if (linked && linked.qualified && team) {
               let qualifier_ids = linked.qualified.map(teamHash);
               if (qualifier_ids.indexOf(team[0].id) >= 0) { team[0].entry = 'Q'; }
            }
            dfx.assignPosition({ node: current_draw, position, team, bye, qualifier });

            let team_ids = !team ? [] : team.map(t=>t.id);
            tfx.logEventChange(displayed_draw_event, { fx: 'position assigned', d: { position, bye, qualifier, team: team_ids } });
         }

         function rrScoreEntry(d) {
            // time since contextClick; used to prevent Safari event propagation
            let scct = new Date().getTime() - ccTime;
            if (scct < 400) return;

            d3.event.preventDefault();
            if (!state.edit || !d.players || d.players.filter(f=>f).length < 2) return;
            if (rr_draw.info().unfilled_positions.length) return;

            rr_draw.unHighlightCells();
            rr_draw.highlightCell(d);

            let existing_scores = (d.match && d.match.score) ? 
               scoreBoard.convertStringScore({
                  string_score: d.match.score,
                  score_format: d.match.score_format || {},
                  winner_index: d.match.winner_index
               }) : undefined;

            let scoreSubmitted = (outcome) => {
               displayGen.escapeFx = undefined;
               rr_draw.unHighlightCells();

               // this must happen first as 'e' is modified
               scoreRoundRobin(tournament, e, existing_scores, outcome);
               // update data
               rr_draw.data(e.draw);
               // update one bracket without regenerating all brackets!
               rr_draw.updateBracket(d.bracket);

               // TODO: perhaps it is only necessary to recalculate points...
               matchesTab();
            }

            if (d.match && d.match.players) {
               let teams = d.match.players.map(p=>[p]);

               let muid = d.match.muid;
               let evnt = displayed_draw_event;
               let score_format = d.match.score_format || evnt.score_format || {};
               if (!score_format.final_set_supertiebreak) score_format.final_set_supertiebreak = e.format == 'D' ? true : false;

               scoreBoard.setMatchScore({
                  muid,
                  teams,
                  container,
                  score_format,
                  round_name: d.match.round_name || 'RR',
                  existing_scores,
                  callback: scoreSubmitted,
                  flags: fx.fx.env().assets.flags,
               });
            } else {
               console.log('missing match data');
               util.logError({ error: 'missing match data', click: d });
            }
         }

         function rrScoreAction(d) {
            ccTime = new Date().getTime();
            var bracket = displayed_draw_event.draw.brackets[d.bracket];
            var complete = dfx.bracketComplete(bracket);

            // must be a unique selector in case there are other SVGs
            var draw_id = `rrDraw_${d.bracket}`;
            var selector = d3.select(`#${container.draws.id} #${draw_id} svg`).node();
            var coords = d3.mouse(selector);
            var options = [lang.tr('draws.remove'), lang.tr('actions.cancel')];

            if (d.match && d.match.score) {
               function clickAction(c, i) { if (i == 0) removeOption(d); }
               cMenu({ selector, coords, options, clickAction })
            }

            function removeOption(d) {
               let result = tfx.removeQualifiedRRplayers(tournament, displayed_draw_event, bracket);
               if (result.remove_players) {
                  // update schedule to reflect match score removal
                  if (d.match.muid) updateScheduleStatus({ muid: d.match.muid });
                  if (result.linkchanges) approvedChanged(result.qlink);

                  // clean up match node
                  tfx.pruneMatch(d.match);
                  deleteMatch(d.match.muid);
                  updateAfterDelete(displayed_draw_event);

                  // update one bracket without regenerating all brackets!
                  rr_draw.updateBracket(d.bracket);
                  matchesTab();
               } else {
                  displayGen.okCancelMessage(lang.tr('phrases.cantdelqual'), () => displayGen.closeModal());
               }

               tfx.logEventChange(displayed_draw_event, { fx: 'match score removed', d: { muid: d.match.muid } });
            }
         }

         function rrPositionClick(d) {
            if (state.edit) {
               if (d3.event.ctrlKey || d3.event.shiftKey) return rrContextPopUp(d);
               if (d.player && d.player.puid) {
                  playerFx.displayPlayerProfile({ puid: d.player.puid }).then(()=>{}, ()=>{});
               } else if (state.edit && d.mc == undefined) {
                  let info = rr_draw.info();
                  if (info.open_seed_positions && info.open_seed_positions.length) {
                     let valid_placements = info.open_seed_positions.map(osp => `${osp.bracket}|${osp.position}`);
                     let clicked_position = `${d.bracket}|${d.row}`;
                     if (valid_placements.indexOf(clicked_position) >= 0) placeRRDrawPlayer(d);
                  } else {
                     if (!d.bye) placeRRDrawPlayer(d);
                  }
               }
            }
         }

         function compassClick(d) {
            console.log('displayed event:', displayed_draw_event);
         }

         function positionClick(d) {
            let node = d3.select(this);
            highlightCell(node);
            d3.event.preventDefault();

            if (state.edit) {
               if (d3.event.ctrlKey || d3.event.shiftKey) {
                  contextPopUp(d);
               } else {
                  treePositionClick(d);
               }
            }
         }

         function treePositionClick(d) {
            if (!d.height && !d.data.bye && !d.data.team) { return placeTreeDrawPlayer(d); }

            // don't go any further if the draw is incomplete...
            if (displayed_draw_event && dfx.drawInfo(displayed_draw_event.draw).unassigned.length) { return; }

            let existing_scores;
            let team_match = dfx.teamMatch(d);
            if (d.data.match && d.data.match.score) {
               existing_scores = scoreBoard.convertStringScore({
                  string_score: d.data.match.score,
                  score_format: d.data.match.score_format || {},
                  winner_index: d.data.match.winner_index,
                  set_scores:   d.data.match.set_scores
               });
            }

            let scoreSubmitted = (outcome) => {
               displayGen.escapeFx = undefined;
               // this must happen first as 'e' is modified
               scoreTreeDraw({ tournament, e, muid: d.data.match.muid, existing_scores, outcome });

               tree_draw.unHighlightCells();
               tree_draw.data(e.draw)();
               matchesTab();
            }

            let round_name = (d.data.match && d.data.match.round_name) || '';
            if (team_match) {

               let muid = d.data.match.muid;
               let evnt = displayed_draw_event;
               let score_format = (d.data.match && d.data.match.score_format) || evnt.score_format || {};
               if (!score_format.final_set_supertiebreak) score_format.final_set_supertiebreak = e.format == 'D' ? true : false;

               scoreBoard.setMatchScore({
                  muid,
                  container,
                  round_name,
                  score_format,
                  existing_scores,
                  teams: team_match,
                  callback: scoreSubmitted,
                  flags: fx.fx.env().assets.flags,
               });
            }
         }

         function highlightCell(node) {
            // unhighlight any other previously clicked cells, if no action was taken
            tree_draw.unHighlightCells();

            // highlight the cell that has been clicked
            d3.select(node.node().parentNode).select('rect').attr('fill', 'blue');
         }

         function getSeedTeams(seed_group) {
            let current_draw = e.draw.compass ? e.draw[e.draw.compass] : e.draw;
            let placements = seed_group.placements.map(p=>p.seed);
            let positioned = seed_group.placements.map(p=>p.position);
            let positions = seed_group.positions.filter(p=>positioned.indexOf(p)<0);
            let remaining = seed_group.range.filter(r=>placements.indexOf(r) < 0);
            let teams = optionNames(remaining.map(r=>current_draw.seeded_teams[r]).filter(f=>f));
            return { remaining, positions, teams };
         }

         function assignSeedPosition(seed_group, team, position) {
            assignPosition(position, team);
            seed_group.placements.push({ seed: team[0].seed, position });
         }

         function seedAssignment(draw, seed_group, position, value) {
            let index = seed_group.range.indexOf(value);
            let team = draw.seeded_teams[seed_group.range[index]];

            assignSeedPosition(seed_group, team, position);
            tfx.logEventChange(displayed_draw_event, { fx: 'assign seed', d: { pos: position, team: team.map(p=>p.id) } });

            let { remaining, positions, teams } = getSeedTeams(seed_group);
            if (remaining.length == 1 && displayed_draw_event.draw_type != 'Q') {
               let index = seed_group.range.indexOf(remaining[0]);
               let team = draw.seeded_teams[seed_group.range[index]];
               if (team) {
                  assignSeedPosition(seed_group, team, positions[0]);
               } else {
                  seed_group.range.splice(index, 1);
                  let placements = seed_group.placements.map(p=>p.position);
                  seed_group.positions = seed_group.positions.filter(p=>placements.indexOf(p) >= 0);
               }
            }
            testLastSeedPosition();
         }

         function placeRRDrawPlayer(d) {
            let placement = { bracket: d.bracket, position: d.row };
            let info = rr_draw.info();
            if (info.unfilled_positions.length) {
               let pobj = displayGen.manualPlayerPosition({ container, position: d.row });
               rrPlacePlayer(placement, pobj, info);
               displayGen.escapeModal();
            }
         }

         function rrPlacePlayer(placement, pobj, info) {
            if (!e.draw.unseeded_placements) e.draw.unseeded_placements = [];

            let u_hash = [];
            let unplaced_teams = [];
            let hashFx = (h) => [h.bracket, h.position].join('|');

            if (info.unplaced_seeds.length) {
               u_hash = info.open_seed_positions.map(hashFx);
               unplaced_teams = info.unplaced_seeds;
            } else {
               u_hash = info.unfilled_positions.map(hashFx);
               let placements = e.draw.unseeded_placements ? [].concat(...e.draw.unseeded_placements.map(p=>p.team.map(m=>m.id))) : [];
               unplaced_teams = e.draw.unseeded_teams.filter(team => placements.indexOf(team[0].id) < 0);
            }

            unplaced_teams.forEach(team => team.order = team.order || e.approved.indexOf(team[0].id) + 1);

            let position_unfilled = u_hash.indexOf(hashFx(placement)) >= 0;

            if (!position_unfilled) return;

            function removeEntryField() {
               d3.select(pobj.entry_field.element).remove();
               rr_draw.unHighlightCells();
               document.body.style.overflow = null;
               displayGen.escapeFx = undefined;
            }

            pobj.entry_field.element.addEventListener('click', removeEntryField);
            pobj.player_index.element.addEventListener('keyup', playerIndex , false);

            let selection_flag = false;
            let list = unplaced_teams.map(team => { 
               let player = team[0];
               let label = `${util.normalizeName([player.first_name, player.last_name].join(' '))}`;
               return { value: player.puid, label, }
            });
            pobj.typeAhead = new Awesomplete(pobj.player_search.element, { list });
            let selectPlayer = (uuid) => {
               if (!uuid) return;
               pobj.player_search.element.value = '';
               let team = unplaced_teams.filter(u=>u[0].puid == uuid)[0];

               removeEntryField();
               o.focus.place_player = 'player_search';
               return placeRRplayer(team, placement, info);
            }
            pobj.player_search.element
               .addEventListener("awesomplete-selectcomplete", function(e) { selection_flag = true; selectPlayer(this.value); }, false);
            pobj.player_search.element.addEventListener('keydown', catchTab , false);
            pobj.player_search.element.addEventListener("keyup", function(e) { 
               // auto select first item on 'Enter' *only* if selectcomplete hasn't been triggered
               if (e.which == 13 && !selection_flag) {
                  if (pobj.typeAhead.suggestions && pobj.typeAhead.suggestions.length) {
                     pobj.typeAhead.next();
                     pobj.typeAhead.select(0);
                  }
               }
               selection_flag = false;
            });

            if (o.focus.place_player == 'player_search') {
               pobj.player_search.element.focus()
            } else {
               pobj.player_index.element.focus();
            }

            // disable scrolling on background
            document.body.style.overflow  = 'hidden';

            // SUPPORTING FUNCTIONS
            function playerIndex(evt) {
               let value = pobj.player_index.element.value.match(/-?\d+\.?\d*/);
               if (evt.which == 13) {
                  let player_index = value ? +value[0] : undefined;
                  if (player_index) {
                     if (unplaced_teams.map(u=>u.order).indexOf(player_index) < 0) return invalidEntry();

                     let team = unplaced_teams.filter(u=>u.order == player_index)[0];
                     removeEntryField();
                     o.focus.place_player = 'player_index';
                     return placeRRplayer(team, placement, info);
                  }

                  function invalidEntry() { pobj.player_index.element.value = ''; }
               }

               pobj.player_index.element.value = util.numeric(value) || '';
            }
         }

         function placeTreeDrawPlayer(d) {
            let current_draw = e.draw.compass ? e.draw[e.draw.compass] : e.draw;
            let position = d.data.dp;
            let info = tree_draw.info();

            let seed_group = dfx.nextSeedGroup({ draw: current_draw });
            if (seed_group && seed_group.positions.indexOf(position) < 0) return;
            if (!current_draw.unseeded_placements || !current_draw.unseeded_teams) return;

            let placements = current_draw.unseeded_placements ? current_draw.unseeded_placements.map(p=>p.id) : [];
            var unplaced_teams = current_draw.unseeded_teams ? current_draw.unseeded_teams.filter(team => placements.indexOf(team[0].id) < 0) : [];

            /*
            if (!seed_group && info.draw_positions.length > current_draw.opponents.length + info.byes.length + info.qualifiers.length) {
               let coords = d3.mouse(container.draws.element);
               return contextPopUp(d, coords);
            }
            */

            if (seed_group) {
               // TODO: support doubles teams;
               let seed_group_ids = e.approved.filter((a, i) => seed_group.range.indexOf(i + 1) >= 0);
               unplaced_teams = tournament.players.filter(p=>seed_group_ids.indexOf(p.id) >= 0).map(p=>[p]);
            }

            if (e.format == 'S') {
               unplaced_teams.forEach(team => team.order = team.order || e.approved.indexOf(team[0].id) + 1);
            } else {
               // get an Object/array of teams in rank order
               let approved_teams = tfx.approvedTeams({ tournament, e });
               let approved_hash = Object.keys(approved_teams).map(k=>teamHash(approved_teams[k].players));
               // use hash of ordered teams to add order to unplaced
               unplaced_teams.forEach(team => team.order = approved_hash.indexOf(teamHash(team)) + 1);
            }

            var pobj = displayGen.manualPlayerPosition({ container, position });
            displayGen.escapeModal();

            var entry_field = d3.select(pobj.entry_field.element);
            function removeEntryField() {
               entry_field.remove();
               tree_draw.unHighlightCells();
               document.body.style.overflow = null;
               displayGen.escapeFx = undefined;
            }

            entry_field.on('click', removeEntryField);
            pobj.player_index.element.addEventListener('keyup', playerIndex , false);

            let selection_flag = false;
            let playerLabel = (player) => util.normalizeName([player.first_name, player.last_name].join(' '));
            let list = unplaced_teams.map(team => { 
               let label = playerLabel(team[0]);
               if (e.format == 'D') label += `/${playerLabel(team[1])}`;
               return { value: team[0].puid, label, }
            });
            pobj.typeAhead = new Awesomplete(pobj.player_search.element, { list });
            function selectPlayer(uuid) {
               if (!uuid) return;
               pobj.player_search.element.value = '';
               let team = unplaced_teams.filter(u=>u[0].puid == uuid)[0];
               let player_index = team.order;
               submitPlayer(player_index);
               o.focus.place_player = 'player_search';
               removeEntryField();
            }
            pobj.player_search.element
               .addEventListener("awesomplete-selectcomplete", function(e) { selection_flag = true; selectPlayer(this.value); }, false);
            pobj.player_search.element.addEventListener('keydown', catchTab , false);
            pobj.player_search.element.addEventListener("keyup", function(e) { 
               // auto select first item on 'Enter' *only* if selectcomplete hasn't been triggered
               if (e.which == 13 && !selection_flag) {
                  if (pobj.typeAhead.suggestions && pobj.typeAhead.suggestions.length) {
                     pobj.typeAhead.next();
                     pobj.typeAhead.select(0);
                  }
               }
               selection_flag = false;
            });

            if (o.focus.place_player == 'player_search') {
               pobj.player_search.element.focus()
            } else {
               pobj.player_index.element.focus();
            }

            // disable scrolling on background
            document.body.style.overflow  = 'hidden';

            // SUPPORTING FUNCTIONS
            function invalidEntry() { pobj.player_index.element.value = ''; }

            function submitPlayer(player_index) {
               if (seed_group) {
                  let placements = seed_group.placements.map(p=>p.seed);
                  let remaining_range = seed_group.range.filter(r=>placements.indexOf(r) < 0);
                  if (remaining_range.indexOf(player_index) < 0) return invalidEntry();
                  seedAssignment(current_draw, seed_group, position, player_index);
               } else {
                  if (unplaced_teams.map(u=>u.order).indexOf(player_index) < 0) return invalidEntry();
                  let team = unplaced_teams.filter(u=>u.order == player_index)[0];
                  assignPosition(position, team);
                  current_draw.unseeded_placements.push({ id: team[0].id, position });

                  // TODO: this block of code is duplicated
                  let info = tree_draw.info();
                  if (info.unassigned.length == 1) {
                     let unassigned_position = info.unassigned[0].data.dp;
                     let placements = current_draw.unseeded_placements.map(p=>p.id);
                     let ut = current_draw.unseeded_teams.filter(team => placements.indexOf(team[0].id) < 0);
                     let team = ut[0];
                     if (team) {
                        assignPosition(unassigned_position, team);
                        current_draw.unseeded_placements.push({ id: team[0].id, position: unassigned_position });
                        tree_draw.advanceTeamsWithByes();
                        if (e.draw_type == 'Q') checkForQualifiedTeams(e);
                        drawCreated(e);
                     }
                  }

               }

               tree_draw();
               if (e.draw.compass) {
                  e.draw[e.draw.compass] = tree_draw.data();
               } else {
                  e.draw = tree_draw.data();
               }
               removeEntryField();
               saveTournament(tournament);
               outOfDate(e, true);
            }

            function playerIndex(evt) {
               var value = pobj.player_index.element.value.match(/-?\d+\.?\d*/);
               if (evt.which == 13) {
                  let player_index = value ? +value[0] : undefined;
                  if (player_index) submitPlayer(player_index);
                  o.focus.place_player = 'player_index';
                  return;
               }

               pobj.player_index.element.value = util.numeric(value) || '';
            }
         }

         function rrMouseoverScore(d) {
            if (state.edit) {
               let info = dfx.drawInfo(e.draw);
               if (info.unfilled_positions.length) return;
               rr_draw.highlightCell(d);
            }
         }

         function rrMouseoverPlayer(d) {
            if (state.edit) {
               var info = rr_draw.info();
               if (info.open_seed_positions && info.open_seed_positions.length) {
                  // info.open_seed_positions.filter(o=>o.bracket == d.bracket && o.position == d.row).forEach(e=>rr_draw.highlightPlayer(e.bracket, e.position));
                  info.open_seed_positions.forEach(e=>rr_draw.highlightPlayer(e.bracket, e.position));
               } else if (info.unfilled_positions && info.unfilled_positions.length) {
                  // info.unfilled_positions.filter(o=>o.bracket == d.bracket && o.position == d.row).forEach(e=>rr_draw.highlightPlayer(e.bracket, e.position));
                  info.unfilled_positions.forEach(e=>rr_draw.highlightPlayer(e.bracket, e.position));
               }
            }
         }

         function rrContextPopUp(d) {
            if (state.edit) {
               var draw = displayed_draw_event.draw;
               var info = dfx.drawInfo(draw);
               rrContextActions(d, draw, info);
            }
         }

         function rrContextActions(d, draw, info) {
            if (!draw.unseeded_placements) draw.unseeded_placements = [];

            function hashFx(h) { return [h.bracket, h.position].join('|'); }
            var u_hash = info.unplaced_seeds.length ? info.open_seed_positions.map(hashFx) : info.unfilled_positions.map(hashFx);

            var placements = draw.unseeded_placements ? draw.unseeded_placements.map(p=>p.team[0].id) : [];
            var unplaced = info.unplaced_seeds.length ? info.unplaced_seeds : draw.unseeded_teams.filter(team => placements.indexOf(team[0].id) < 0);
            var unplaced_teams = tfx.teamSort(unplaced);

            // must be a unique selector in case there are other SVGs
            var draw_id = `rrDraw_${d.bracket}`;
            var selector = d3.select(`#${container.draws.id} #${draw_id} svg`).node();
            var coords = d3.mouse(selector);

            var placement = { bracket: d.bracket, position: d.row };
            var position_unfilled = u_hash.indexOf(hashFx(placement)) >= 0;

            if (position_unfilled) {
               placeTeam(coords, unplaced_teams, placement, info);
            } else if (d.player && placement.position) {
               // placement.position restricts removal to cells with full name because removing from row 0 causes errors...
               assignedRRoptions(coords, placement, d, draw);
            }

            function placeTeam(coords, unplaced_teams, placement, info) {

               // SORT PICK LIST
               unplaced_teams.sort((a, b) => a[0].draw_order - b[0].draw_order);

               let options = optionNames(unplaced_teams);
               let clickAction = (d, i) => {
                  let team = unplaced_teams[i];
                  placeRRplayer(team, placement, info);
               }

               let bod = d3.select('body').node();
               let evt = (d3.event);
               displayGen.svgModal({ x: evt.clientX, y: evt.clientY, options, callback: clickAction });
            }

            function assignedRRoptions(coords, placement, cell, draw) {
               let info = dfx.drawInfo(draw);
               let bracket = draw.brackets[placement.bracket];
               let filled = info.unfilled_positions.length == 0;
               let options = [];
               let player_matches = bracket.matches.filter(m=>m.puids.indexOf(cell.player.puid)>=0 && m.score);
               if (!player_matches.length) {
                  options.push({ option: lang.tr('draws.remove'), key: 'remove' });
                  if (filled && !displayed_draw_event.active) {
                     let alternates = tfx.eligiblePlayers(tournament, displayed_draw_event).players.map(p=>[p]);
                     if (alternates.length) options.push({ option: lang.tr('draws.alternate'), key: 'alternate' });
                  }
                  options.push({ option: lang.tr('actions.cancel'), key: 'cancel' });
               }
               // TODO: normalize => automated draws add c.team[n] to unseeded_placements whereas manual draws add c.id
               let unseeded_position = draw.unseeded_placements.reduce((p, c) => c.id == cell.player.id || (c.team && c.team[0].id == cell.player.id) ? true : p, undefined);
               let clickAction = (d, i) => {
                  if (d.key == 'remove') {
                     bracket.players = bracket.players.filter(player => player.id != cell.player.id);

                     // perform operation for both unseeded and seeded as removing alternates who have replaced seeds changes status
                     draw.unseeded_placements = draw.unseeded_placements
                        .filter(f=>!(f.position.bracket == placement.bracket && f.position.position == placement.position));
                     draw.seed_placements.forEach(seed_group => {
                        seed_group.placements = seed_group.placements
                           .filter(sgp => !(sgp.position.bracket == placement.bracket && sgp.position.position == placement.position));
                     });

                     dfx.matches(draw);
                     rr_draw.data(draw);
                     rr_draw.updateBracket(placement.bracket, true);

                     tfx.logEventChange(displayed_draw_event, { fx: 'player removed', d: { placement, team: [cell.player.id] } });

                     saveTournament(tournament);
                     outOfDate(e, true);
                  }
                  if (d.key == 'alternate') {
                     let alternates = tfx.eligiblePlayers(tournament, displayed_draw_event).players.map(p=>[p]);
                     return rrAlternates({ selector, info, placement, unseeded_position, coords, draw, options: alternates, entry: 'A' });
                  }
               }
               cMenu({ selector, coords, options, clickAction })
            }
         }

         function rrAlternates({ selector, info, placement, unseeded_position, coords, draw, options, entry }) {
            let teams = optionNames(options);
            let clickAction = (d, i) => {
               let new_team = options[i];
               let bracket = draw.brackets[placement.bracket];
               let old_player = bracket.players.reduce((p, c) => c.draw_position == placement.position ? c : p, undefined);

               new_team.forEach(player => {
                  player.draw_position = placement.position;
                  delete player.seed;
               });

               // now remove old player from bracket and draw
               draw.opponents = draw.opponents.filter(o=>o[0].id != old_player.id);
               bracket.players = bracket.players.filter(p=>p.draw_position != placement.position);

               // perform operation for both unseeded and seeded as removing alternates who have replaced seeds changes status
               draw.unseeded_placements = draw.unseeded_placements
                  .filter(f=>!(f.position.bracket == placement.bracket && f.position.position == placement.position));
               Object.keys(draw.seeded_teams).forEach(key => {
                  if (draw.seeded_teams[key][0].id == old_player.id) draw.seeded_teams[key] = new_team;
               });

               if (unseeded_position) {
                  draw.unseeded_teams = draw.unseeded_teams.filter(team => team[0].id != old_player.id);
                  draw.unseeded_teams.push(new_team);
               }

               // and add new player to bracket and draw
               bracket.players.push(new_team[0]);
               draw.opponents.push(new_team);
               draw.unseeded_placements.push({ team: new_team, position: placement });

               swapApproved(displayed_draw_event, [old_player], new_team, placement.position);
               if (entry) new_team.forEach(player => player.entry = entry);
               dfx.matches(draw);
               rr_draw.data(draw);
               rr_draw.updateBracket(placement.bracket, true);
               saveTournament(tournament);
               outOfDate(e, true);
            }
            cMenu({ selector, coords, options: teams, clickAction })
         }

         function placeRRplayer(team, placement, info) {
            let player = team[0];
            player.draw_position = placement.position;
            e.draw.brackets[placement.bracket].players.push(player);

            if (info.unplaced_seeds.length) {
               info.unfinished_seed_placements[0].placements.push({ position: placement, seed: player.seed });
            } else {
               e.draw.unseeded_placements.push({ team, position: placement });
            }

            // update data
            rr_draw.data(e.draw);
            // update one bracket without regenerating all brackets!
            rr_draw.updateBracket(placement.bracket);

            // test to see if draw is complete
            // TODO: replace with info.positions_filled
            let all_unseeded_placed = (e.draw.unseeded_placements.length && e.draw.unseeded_placements.length == e.draw.unseeded_teams.length);
            if (all_unseeded_placed) {
               drawCreated(e);
               dfx.matches(e.draw);
               rr_draw.data(e.draw);
               rr_draw();
            }
            tfx.logEventChange(displayed_draw_event, { fx: 'position assigned', d: { placement, team: team.map(t=>t.id) } });
            saveTournament(tournament);
            outOfDate(e, true);
         }

         // this function needs to be in scope of createTournamentContainer()
         // so that it can have access to container.draws.element
         function contextPopUp(d, coords) {
            coords = Array.isArray(coords) ? coords : d3.mouse(container.draws.element);

            if (!state.edit) {
               return;
            } else if (!displayed_draw_event.active) {
               try { drawNotActiveContextClick(d, coords); }
               catch (err) { tfx.logEventError(e, err, 'drawNotActiveContextClick'); }
            } else {
               try { drawActiveContextClick(d, coords); }
               catch (err) { tfx.logEventError(e, err, 'drawActiveContextClick'); }
            }
         }

         function swapApproved(evt, remove, add, position) {
            if (!remove) return console.log('Missing player data', evt, remove, add);
            let ids = remove.map(p=>p.id);
            if (ids.length == 2) {
               evt.approved = evt.approved.filter(a=>util.intersection(a, ids).length != 2);
               evt.approved.push(add.map(p=>p.id));
            } else {
               evt.approved = evt.approved.filter(a=>a!=ids[0]);
               evt.approved.push(add[0].id);
            }
            tfx.logEventChange(displayed_draw_event, { fx: 'player replaced', d: { position, removed: ids, added: add.map(a=>a.id) } });
         }

         // select either lucky losers or alternates
         function luckyAlternates({ selector, info, position, node, coords, draw, options, entry }) {
            let teams = optionNames(options);
            let clickAction = (d, i) => {
               let team = options[i].map(player => Object.assign({}, player));
               team.forEach(player => {
                  player.draw_position = position;
                  delete player.seed;
               });
               let nodes = info.nodes.filter(f=>f.data.dp == position);
               nodes.forEach(node => node.data.team = team);

               let remove = draw.opponents.reduce((p, o) => o[0].draw_position == position ? o : p, undefined);
               draw.opponents = draw.opponents.filter(o=>o[0].draw_position != position);
               draw.opponents.push(team);
               swapApproved(displayed_draw_event, remove, team, position);
               if (entry) team.forEach(player => player.entry = entry);

               tree_draw.data(draw)();
               saveTournament(tournament);
               outOfDate(displayed_draw_event, true);
            }
            let bod = d3.select('body').node();
            let evt = (d3.event);
            displayGen.svgModal({ x: evt.clientX, y: evt.clientY, options: teams, callback: clickAction });
         }

         function findSeedGroup(draw, seed) {
            return draw.seed_placements.reduce((p, s) => s.range.indexOf(seed) >= 0 ? s : p, undefined);
         }

         function findDrawOpponent(info, draw, position) {
            let bye = info.byes.reduce((p, s) => s.data.dp == position ? s : p, undefined);
            let qualifier = info.qualifiers.reduce((p, s) => s.data.dp == position ? s : p, undefined);
            let opponent = draw.opponents.reduce((p, s) => s[0].draw_position == position ? s : p, undefined);
            if (bye) return { bye }
            if (qualifier) return { qualifier }
            if (opponent) return { opponent }
         }

         function linkedLosers(linked_info) {
            if (!linked_info) return [];
            if (linked_info.draw_type == 'tree') {
               return tfx.teamSort(linked_info.match_nodes.filter(n=>n.data.match && n.data.match.loser).map(n=>n.data.match.loser));
            } else if (linked_info.draw_type == 'roundrobin') {
               return [];
               // LUCKY LOSERS FOR RR DRAWS... ONLY AFTER ALL BRACKETS COMPLETE?
               /*
               // THIS WAS THE WRONG FUNCTION...
               let pexists = (p, c) => p.map(l=>l.map(z=>z.id).sort().join('|')).indexOf(c.map(y=>y.id).sort().join('|')) >= 0;
               let addC = (p, c) => { p.push(c); return p; }
               let losers = linked_info.matches.filter(m=>m.loser).map(m=>m.loser).reduce((p, c) => pexists(p, c) ? p : addC(p, c), []);
               return tfx.teamSort(losers);
               */
            }
            return [];
         }

         function assignedPlayerOptions({ selector, position, node, coords, info, draw, seed }) {
            let unfinished = info.unassigned.length; // this should be e.active ?
            if (seed && seed < 3 && unfinished) {
               displayGen.popUpMessage('Cannot Remove 1st/2nd Seed');
               return;
            }
            let teams = optionNames([node.data.team]);
            let unfinished_options = teams.map(t => `${lang.tr('draws.remove')}: ` + t);

            let bye_positions = info.byes.map(b=>b.data.dp);
            let qualifier_positions = info.qualifiers.map(b=>b.data.dp);
            let structural_bye_positions = info.structural_byes.map(b=>b.data.dp);

            // all draw positions which have a first-round opponent (no structural bye);
            let paired_positions = info.nodes.filter(f=>f.height == 1 && f.children).map(m=>[].concat(...m.children.map(c=>c.data.dp)));
            let paired_with_bye = paired_positions.filter(p=>util.intersection(p, bye_positions).length);
            let position_paired_with_bye = paired_with_bye.filter(p=>p.indexOf(position) >= 0).length > 0;

            let advanced_positions = info.match_nodes.filter(n=>n.data.match && n.data.match.players);
            let active_player_positions = [].concat(...advanced_positions.map(n=>n.data.match.players.map(p=>p.draw_position)));

            // BYES which are paired with active_player_positions are considered active positions
            let bye_paired_active = paired_with_bye.filter(p=>util.intersection(p, active_player_positions).length); 

            let actpp = [].concat(...active_player_positions, ...bye_paired_active);
            let swap_positions = info.draw_positions.filter(p => actpp.indexOf(p) < 0 && p != position);

            // if position is a seed position or a structural bye position or is paired with bye, exclude bye_positions from swap positions
            if (seed || structural_bye_positions.indexOf(position) >= 0 || position_paired_with_bye) {
               swap_positions = swap_positions.filter(p=>bye_positions.indexOf(p) < 0 && qualifier_positions.indexOf(p) < 0);
            }

            let active_positions = info.draw_positions.filter(p => actpp.indexOf(p) >= 0);
            let position_active = active_positions.indexOf(position) >= 0;

            let approved = [].concat(...displayed_draw_event.approved);
            let unapproved_teams = !info.doubles ? [] : displayed_draw_event.teams.filter(t=>util.intersection(approved, t).length == 0)
            let doubles_alternates = unapproved_teams.map(team=>tournament.players.filter(p=>team.indexOf(p.id) >= 0));
            let alternates = info.doubles ? doubles_alternates : tfx.eligiblePlayers(tournament, displayed_draw_event).players.map(p=>[p]);

            let competitors = [].concat(...draw.opponents.map(team=>team.map(p=>p.id)));
            let linkedQ = tfx.findEventByID(tournament, displayed_draw_event.links['Q']) || tfx.findEventByID(tournament, displayed_draw_event.links['R']);
            let linked_info = linkedQ && linkedQ.draw ? dfx.drawInfo(linkedQ.draw) : undefined;

            // losers from linked draw excluding losers who have already been substituted
            let losers = linkedLosers(linked_info).filter(l=>util.intersection(l.map(p=>p.id), competitors).length == 0);

            let finished_options = [];
            if (!displayed_draw_event.active && !position_active && swap_positions.length) finished_options.push({ option: lang.tr('draws.swap'), key: 'swap' });
            if (!position_active && alternates.length) finished_options.push({ option: lang.tr('draws.alternate'), key: 'alt' });
            if (!position_active && losers.length) finished_options.push({ option: lang.tr('draws.luckyloser'), key: 'lucky' });

            if (!unfinished && !finished_options.length) return;

            let options = unfinished ? unfinished_options : finished_options;
            let clickAction = (d, i) => {
               if (unfinished) {
                  tfx.logEventChange(displayed_draw_event, { fx: 'player removed', d: { position, team: node.data.team.map(t=>t.id) } });

                  if (seed) {
                     delete node.data.team;
                     let seed_group = findSeedGroup(draw, seed);
                     if (seed_group) seed_group.placements = seed_group.placements.filter(p=>p.seed != seed);
                  } else {
                     delete node.data.team;
                     draw.unseeded_placements = draw.unseeded_placements.filter(f=>f.position != position);
                  }
                  tree_draw();
                  saveTournament(tournament);
                  outOfDate(displayed_draw_event, true);
               } else {
                  if (d.key) {
                     if (d.key == 'swap') {
                        let swap = displayGen.swapPlayerPosition({ container, position });

                        displayGen.escapeModal();
                        function removeEntryField() {
                           d3.select(swap.entry_field.element).remove();
                           document.body.style.overflow = null;
                           displayGen.escapeFx = undefined;
                        }

                        swap.entry_field.element.addEventListener('click', removeEntryField);
                        swap.new_position.element.addEventListener('keyup', playerIndex , false);
                        swap.new_position.element.focus();

                        function playerIndex(evt) {
                           let value = swap.new_position.element.value.match(/-?\d+\.?\d*/);
                           let numeric = util.numeric(value);
                           let valid = swap_positions.indexOf(numeric) >= 0;
                           swap.new_position.element.value = numeric || '';
                           swap.new_position.element.style.background = (valid || !numeric) ? '#FFFFFF' : '#FC9891';
                           if (evt.which == 13 && valid) {
                              let new_position = value ? +value[0] : undefined;
                              if (new_position) {
                                 // let advanced_by_bye = info.match_nodes.filter(m=>!dfx.teamMatch(m));
                                 let advanced_by_bye = info.bye_nodes;
                                 advanced_by_bye.forEach(p => {
                                    if (active_positions.indexOf(p.data.dp) < 0) {
                                       p.data.team = undefined;
                                       p.data.dp = undefined;
                                    }
                                 });

                                 let p1_nodes = info.nodes.filter(f=>f.data.dp == position);
                                 let p1 = findDrawOpponent(info, draw, position);
                                 let p2_nodes = info.nodes.filter(f=>f.data.dp == new_position);
                                 let p2 = findDrawOpponent(info, draw, new_position);

                                 if (p2_nodes.length && p2) {
                                    // collect seeding information
                                    let p1_seeding = p1.opponent ? p1.opponent[0].seed : undefined;
                                    let p2_seeding = p2.opponent ? p2.opponent[0].seed : undefined;
                                    let remove_seeding = (p1_seeding && !p2_seeding) || (p2_seeding && !p1_seeding);

                                    if (p1.opponent) {
                                       p1.opponent.forEach(player => {
                                          player.draw_position = new_position;
                                          if (remove_seeding) delete player.seed;
                                       });
                                    } else if (p1.bye) {
                                       p1.bye.data.bye = true;
                                       p1.bye.data.dp = new_position;
                                    } else if (p1.qualifier) {
                                       p1.qualifier.data.qualifier = true;
                                       p1.qualifier.data.dp = new_position;
                                    }
                                    if (p2.opponent) {
                                       p2.opponent.forEach(player => {
                                          player.draw_position = position;
                                          if (remove_seeding) delete player.seed;
                                       });
                                    } else if (p2.bye) {
                                       p2.bye.data.bye = true;
                                       p2.bye.data.dp = position;
                                    } else if (p2.qualifier) {
                                       p2.qualifier.data.qualifier = true;
                                       p2.qualifier.data.dp = new_position;
                                    }

                                    p1_nodes.forEach(node => {
                                       node.data.dp = position;
                                       if (p2.opponent) {
                                          node.data.bye = undefined;
                                          node.data.qualifier = undefined;
                                          node.data.team = p2.opponent;
                                       } else if (p2.bye) {
                                          node.data.bye = true;
                                          node.data.team = [{ draw_position: position, bye: 1 }];
                                       } else if (p2.qualifier) {
                                          node.data.qualifier = true;
                                          node.data.team = [{ draw_position: position, qualifier: true }];
                                       }
                                    });
                                    p2_nodes.forEach(node => {
                                       node.data.dp = new_position;
                                       if (p1.opponent) {
                                          node.data.bye = undefined;
                                          node.data.qualifier = undefined;
                                          node.data.team = p1.opponent;
                                       } else if (p1.bye) {
                                          node.data.bye = true;
                                          node.data.team = [{ draw_position: new_position, bye: 1 }];
                                       } else if (p1.qualifier) {
                                          node.data.qualifier = true;
                                          node.data.team = [{ draw_position: position, qualifier: true }];
                                       }
                                    });

                                    tfx.logEventChange(displayed_draw_event, { fx: 'swap', d: [ position, new_position ] });
                                    dfx.advanceTeamsWithByes({ draw });
                                    tree_draw.data(draw)();
                                    saveTournament(tournament);

                                    outOfDate(displayed_draw_event, true);
                                 }

                                 removeEntryField();
                              }
                           }
                        }

                     } else if (d.key == 'alt') {
                        return luckyAlternates({ selector, info, position, node, coords, draw, options: alternates, entry: 'A' });
                     } else if (d.key == 'lucky') {
                        return luckyAlternates({ selector, info, position, node, coords, draw, options: losers, entry: 'LL' });
                     }
                  }
               }
            }
            cMenu({ selector, coords, options, clickAction })
         }

         function drawActiveContextClick(d, coords) {
            let current_draw = e.draw.compass ? e.draw[e.draw.compass] : e.draw;
            var position = d.data.dp;

            var info = dfx.drawInfo(current_draw);
            var linked = tfx.findEventByID(tournament, e.links['E']);
            var linked_info = null;
            var target_draw = null;

            var selector = d3.select('#' + container.draws.id + ' svg').node();
            var finalist_dp = info.final_round.map(m=>m.data.dp);
            var qualifier_index = finalist_dp.indexOf(position);
            var qualified = qualifier_index >= 0;

            var match_score = d.data.match && d.data.match.score;
            var qualification = ['Q', 'R'].indexOf(e.draw_type) >= 0;
            var active_in_linked = null;

            if (e.draw.compass && d.data.match && d.data.match.loser) {
               // check whether match loser is active in linked direction
               let target_direction = tfx.getTargetDirection(current_draw.direction, d.data.match.round);
               target_draw = target_direction && e.draw[target_direction];
               if (target_draw) {
                  linked_info = dfx.drawInfo(target_draw);
                  let losing_team_ids = d.data.match.loser.map(m=>m.id);
                  let advanced_positions = linked_info.match_nodes.filter(n=>n.data.match && n.data.match.players);
                  let active_player_positions = [].concat(...advanced_positions.map(n=>n.data.match.players.map(p=>p.draw_position)));
                  let position_in_linked = [].concat(...linked_info.nodes
                     .filter(node => node.data.team && util.intersection(node.data.team.map(t=>t.id), losing_team_ids).length)
                     .map(node => node.data.dp));
                  active_in_linked = util.intersection(active_player_positions, position_in_linked).length;
               }
            }

            if (qualification && match_score && qualified && linked && linked.draw && d.data.team) {
               linked_info = dfx.drawInfo(linked.draw);
               let team_ids = d.data.team.map(m=>m.id);
               let advanced_positions = linked_info.match_nodes.filter(n=>n.data.match && n.data.match.players);
               let active_player_positions = [].concat(...advanced_positions.map(n=>n.data.match.players.map(p=>p.draw_position)));
               let position_in_linked = [].concat(...linked_info.nodes
                  .filter(node => node.data.team && util.intersection(node.data.team.map(t=>t.id), team_ids).length)
                  .map(node => node.data.dp));
               active_in_linked = util.intersection(active_player_positions, position_in_linked).length;
            }

            var possible_to_remove = (!d.parent || !d.parent.data || !d.parent.data.team);
            // or, alternatively:
            // var possible_to_remove = d.data.ancestor && (!d.data.ancestor || !d.data.ancestor.team);

            if (d.data.bye) {
               console.log('check whether possible to replace BYE');
            } else if (match_score && possible_to_remove && !active_in_linked) {
               let options = [`${lang.tr('draws.remove')}: ${lang.tr('mtc')}`];

               // if deleting a match, delete all references in node
               let clickAction = (c, i) => {
                  if (qualified && d.data.team) {
                     let team_ids = d.data.team.map(m=>m.id);
                     removeQualifiedPlayer(e, team_ids, linked, linked_info);
                  }

                  if (e.draw.compass && target_draw && d.data.match && d.data.match.loser) {
                     let losing_team_ids = d.data.match.loser.map(m=>m.id);
                     removeDirectionalPlayer(e, target_draw, losing_team_ids, linked_info);
                  }

                  tfx.logEventChange(displayed_draw_event, { fx: 'match removed', d: { teams: d.data.match.teams.map(team=>team.map(t=>t.id)) } });

                  let deleted_match_muid = d.data.match.muid;
                  if (deleted_match_muid) updateScheduleStatus({ muid: deleted_match_muid });

                  delete d.data.dp;
                  delete d.data.team;
                  delete d.data.round_name;
                  delete d.data.result_order;
                  delete d.data.match.teams;
                  delete d.data.match.entry;
                  delete d.data.match.players;

                  // prune attributes common to tree/RR
                  tfx.pruneMatch(d.data.match);
                  deleteMatch(d.data.match.muid);
                  updateAfterDelete(e);

                  tree_draw();
                  matchesTab();
               }
               cMenu({ selector, coords, options, clickAction })
            } else if (!d.height && !d.data.bye && !d.data.qualifier && d.data.team) {
               let info = dfx.drawInfo(current_draw);
               assignedPlayerOptions({ selector, position, node: d, coords, info, draw: current_draw, seed: d.data.team[0].seed });
            }
         }

         function drawNotActiveContextClick(d, coords) {
            let current_draw = e.draw.compass ? e.draw[e.draw.compass] : e.draw;
            let position = d.data.dp;

            // must be a unique selector in case there are other SVGs
            let selector = d3.select('#' + container.draws.id + ' svg').node();

            if (!d.height && d.data && d.data.dp && !d.data.team) {
               // position is vacant, decide appropriate action
               let seed_group = dfx.nextSeedGroup({ draw: current_draw });
               if (seed_group) {
                  assignSeededPosition({ selector, position, draw: current_draw, seed_group, coords });
               } else {
                  if (o.byes_with_unseeded) {
                     assignUnseededPosition({ selector, position, draw: current_draw, coords });
                  } else {
                     // section assigns byes then qualifiers before unseeded positions
                     let info = dfx.drawInfo(current_draw);
                     let byesAndQs = info.draw_positions.length > current_draw.opponents.length + info.byes.length + info.qualifiers.length;
                     if (byesAndQs) {
                        let player_count = (current_draw.opponents ? current_draw.opponents.length : 0) + (current_draw.qualifiers || 0);
                        let bye = info.draw_positions.length > player_count + info.byes.length;
                        assignByeOrQualifier({ selector, position, bye, coords });
                     } else {
                        assignUnseededPosition({ selector, position, draw: current_draw, coords });
                     }
                  }
               }
            } else if (d.height == 0 && d.data.qualifier && !displayed_draw_event.active) {
               assignedQBOptions({ selector, position, node: d, coords, draw: current_draw, qualifier: true });
            } else if (d.height == 0 && d.data.bye && !displayed_draw_event.active) {
               assignedQBOptions({ selector, position, node: d, coords, draw: current_draw, bye: true });
            } else if (!d.data.bye && !d.data.qualifier && d.data.team) {
               let info = dfx.drawInfo(current_draw);
               assignedPlayerOptions({ selector, position, node: d, coords, info, draw: current_draw, seed: d.data.team[0].seed });
            } else {
               console.log('what to do?');
            }

            function assignedQBOptions({ selector, position, node, coords, draw, qualifier, bye }) {
               let info = dfx.drawInfo(draw);
               let unfinished = info.unassigned.length;
               let what = qualifier ? 'Qualifier' : 'BYE';
               let unfinished_options = [`${lang.tr('draws.remove')}: ${what}`];
               let finished_options = [];
               let options = unfinished ? unfinished_options : finished_options;

               // 1. check whether there are any alternate players
               // 2. check that the player advanced by BYE isn't in any scored matches
               let alternates = true;
               if (alternates) {
                  finished_options = ['Alternate'];
               }

               let clickAction = (d, i) => {
                  if (unfinished) {
                     node.data.bye = false;
                     node.data.qualifier = false;
                     delete node.data.team;
                  } else {
                     if (i == 0) {
                        console.log('select alternate');
                     }
                  }

                  saveTournament(tournament);
                  tree_draw();
               }

               if (unfinished || finished_options.length) {
                  cMenu({ selector, coords, options, clickAction })
               }
            }

            function assignSeededPosition({ selector, position, draw, seed_group, coords }) {
               if (seed_group.positions.indexOf(position) >= 0) {
                  let { remaining: range, teams } = getSeedTeams(seed_group);
                  let clickAction = (d, i) => {
                     seedAssignment(draw, seed_group, position, range[i]);

                     tree_draw();
                     if (e.draw.compass) {
                        e.draw[e.draw.compass] = tree_draw.data();
                     } else {
                        e.draw = tree_draw.data();
                     }
                     // e.draw = tree_draw.data();
                     saveTournament(tournament);

                     outOfDate(e, true);
                  }
                  cMenu({ selector, coords, options: teams, clickAction })
               }
            }

            function assignUnseededPosition({ selector, position, draw, coords }) {
               let info = dfx.drawInfo(draw);
               let player_count = (draw.opponents ? draw.opponents.length : 0) + (draw.qualifiers || 0);
               let byes = info.draw_positions.length - (player_count + info.byes.length);
               let bye_positions = info.byes.map(b=>b.data.dp);
               let structural_bye_positions = info.structural_byes.map(b=>b.data.dp);

               let linked_q = tfx.findEventByID(tournament, displayed_draw_event.links['Q']) || tfx.findEventByID(tournament, displayed_draw_event.links['R']);
               let qualifiers = linked_q ? linked_q.qualifiers - (linked_q.qualified.length + info.qualifiers.length) : 0;

               if (!draw.unseeded_placements) return;

               let placements = draw.unseeded_placements.map(p=>p.id);
               var unplaced = draw.unseeded_teams
                  .filter(team => placements.indexOf(team[0].id) < 0)

               // teamSort also insures all players have full names... ???
               var unplaced_teams = tfx.teamSort(unplaced);

               // SORT PICK LIST by Draw Order
               unplaced_teams = unplaced_teams.sort((a, b) => a[0].draw_order - b[0].draw_order);

               // originally sorted by team names

               // all draw positions which have a first-round opponent (no structural bye);
               let feed_positions = info.nodes.filter(f=>f.data.feed).map(n=>n.data.dp);
               let paired_positions = info.nodes.filter(f=>f.height == 1 && f.children).map(m=>[].concat(...m.children.map(c=>c.data.dp)));
               let paired_with_bye = paired_positions.filter(p=>util.intersection(p, bye_positions).length);
               let position_paired_with_bye = paired_with_bye.filter(p=>p.indexOf(position) >= 0).length > 0;
               let byes_allowed = (o.byes_with_byes && feed_positions.indexOf(position) < 0) || (!position_paired_with_bye && structural_bye_positions.indexOf(position) < 0);

               let teams = optionNames(unplaced_teams);
               if (byes && byes_allowed) { teams.unshift(`Bye {${byes}}`); }
               if (!byes && qualifiers) teams.unshift(`Qualifier {${qualifiers}}`);
               let clickAction = (d, i) => {
                  if (!byes && qualifiers && i == 0) {
                     assignPosition(position, undefined, false, true);
                  } else if (byes && byes_allowed && i == 0) {
                     assignPosition(position, undefined, true, false);
                  } else {
                     let index = ((byes && byes_allowed) || qualifiers) ? i - 1 : i;
                     let team = unplaced_teams[(byes && byes_allowed) || qualifiers ? i - 1 : i];
                     assignPosition(position, team);
                     draw.unseeded_placements.push({ id: team[0].id, position });
                  }

                  // TODO: this block of code is duplicated
                  let info = tree_draw.info();
                  if (info.unassigned.length == 1 && !info.byes.length) {
                     let unassigned_position = info.unassigned[0].data.dp;
                     let placements = draw.unseeded_placements.map(p=>p.id);
                     let ut = draw.unseeded_teams.filter(team => placements.indexOf(team[0].id) < 0);
                     let team = ut[0];
                     if (team) {
                        assignPosition(unassigned_position, team);
                        draw.unseeded_placements.push({ id: team[0].id, position: unassigned_position });
                        tree_draw.advanceTeamsWithByes();
                        if (e.draw_type == 'Q') checkForQualifiedTeams(e);
                        drawCreated(e);
                     }
                  } else if (!info.unassigned.length) {
                     tree_draw.advanceTeamsWithByes();
                     if (e.draw_type == 'Q') checkForQualifiedTeams(e);
                     drawCreated(e);
                  }
                  tree_draw();
                  if (e.draw.compass) {
                     e.draw[e.draw.compass] = tree_draw.data();
                  } else {
                     e.draw = tree_draw.data();
                  }
                  saveTournament(tournament);
                  outOfDate(e, true);
               }
               cMenu({ selector, coords, options: teams, clickAction })
            }

            function assignByeOrQualifier({ selector, position, bye, coords }) {
               let options = bye ? ['BYE'] : ['Qualifier'];
               let clickAction = (d, i) => {
                  assignPosition(position, undefined, bye, !bye);
                  let info = tree_draw.info();
                  if (!info.unassigned.length) {
                     if (e.draw_type == 'Q') checkForQualifiedTeams(e);
                     drawCreated(e);
                  }
                  tree_draw();
                  // e.draw = tree_draw.data();
                  if (e.draw.compass) {
                     e.draw[e.draw.compass] = tree_draw.data();
                  } else {
                     e.draw = tree_draw.data();
                  }
                  saveTournament(tournament);
                  outOfDate(e, true);
               }
               cMenu({ selector, coords, options, clickAction })
            }

         }
      }

      function updateScheduleBox(match) {
         if (!match) return;
         let schedule_box = Array.from(document.querySelectorAll('.schedule_box'))
            .reduce((s, el) => {
               let el_muid = el.getAttribute('muid');
               if (el_muid == match.muid) s = el;
               return s;
            });

         let sb = scheduleFx.scheduleBox({ match, editable: true, options: fx.fx.env().schedule });
         if (schedule_box) {
            schedule_box.innerHTML = sb.innerHTML;
            scheduleFx.scaleTeams(schedule_box);
            schedule_box.style.background = sb.background;

            // let draggable = match.winner_index != undefined ? 'false' : 'true';
            schedule_box.setAttribute('draggable', true);

            schedule_box.setAttribute('muid', match.muid);
            scheduleActions({ changed: true });
            saveTournament(tournament);
         }
      }

      function addUmpire(match, context) {
         if (!match || !match.schedule || !match.schedule.court) return;

         let uobj = displayGen.entryModal('draws.matchumpire', true);
         displayGen.escapeModal();

         let entry_modal = d3.select(uobj.entry_modal.element);
         let removeEntryModal = () => {
            entry_modal.remove();
            document.body.style.overflow = null;
            displayGen.escapeFx = undefined;
         }

         entry_modal.on('click', removeEntryModal);
         uobj.search_field.element.value = match.umpire || '';

         let selection_flag = false;
         let umpires = tournament.umpires || [];
         let list = umpires.map(umpire =>({ value: umpire, label: umpire }));
         uobj.typeAhead = new Awesomplete(uobj.search_field.element, { list });
         let selectUmpire = (umpire) => {
            submitUmpire(umpire);
            removeEntryModal();
         }
         uobj.search_field.element
            .addEventListener("awesomplete-selectcomplete", function(e) { selection_flag = true; selectUmpire(this.value); }, false);
         uobj.search_field.element.addEventListener('keydown', catchTab , false);
         uobj.search_field.element.addEventListener("keyup", function(e) { 
            // auto select first item on 'Enter' *only* if selectcomplete hasn't been triggered
            if (e.which == 13 && !selection_flag) {
               let value = uobj.search_field.element.value;
               if (uobj.typeAhead.suggestions && uobj.typeAhead.suggestions.length && value.length) {
                  uobj.typeAhead.next();
                  uobj.typeAhead.select(0);
               } else {
                  submitUmpire(value);
                  removeEntryModal();
               }
            }
            selection_flag = false;
         });

         // disable scrolling on background
         document.body.style.overflow  = 'hidden';
         uobj.search_field.element.focus();

         function submitUmpire(umpire) {
            if (umpire) {
               if (!tournament.umpires) {
                  tournament.umpires = [umpire];
               } else {
                  if (tournament.umpires.indexOf(umpire) < 0) tournament.umpires.push(umpire);
               }
            }
            if (match.source) match.source.umpire = umpire;
            match.umpire = umpire;

            if (context == 'schedule') {
               updateScheduleBox(match);
            } else if (context == 'treedraw') {
               tree_draw(); 
            }
         }

      }

      // for generating draws when there are only arrays of matches
      // TODO: generate an actual event and attach to tournament...
      function genGroupDraw(value) {
         let draw_width = +d3.select('#main').style('width').match(/\d+/)[0] * .9;
         tree_draw.options({ width: draw_width });

         // insure no other draw is displayed
         tree_draw.data({})();
         rr_draw.data({});

         if (['msm', 'wsm', 'md', 'wd'].indexOf(value) >= 0) {
            let evt = { draw: generateDrawTree(match_groups[value]), draw_type: 'E' };
            displayDraw({ evt });
         } else if (['msq', 'wsq'].indexOf(value) >= 0) {
            let tree = generateDrawTree(match_groups[value], 'Q');
            let evt = { draw: tree, draw_type: 'Q' };
            displayDraw({ evt });
         } else if (['msrr', 'wsrr'].indexOf(value) >= 0) {
            let brackets = generateDrawBrackets(match_groups[value]);
            rr_draw.selector(container.draws.element);
            rr_draw.data({ brackets });
            rr_draw();
         }
         enableDrawActions();
      }

      function penaltyReportIcon() {
         let visible = state.edit && penaltyPlayers().length ? true : false;
         container.penalty_report.element.style.display = visible ? 'inline' : 'none';
      }

      function tournamentTab() {
         let { days } = mfx.scheduledMatches(tournament);
         if ((dbmatches && dbmatches.length) && (!tournament.events || !tournament.events.length)) {
            legacyTournamentOptions();
         } else {
            tournamentOptions(days);
         }

         let tournament_date = tournament && (tournament.points_date || tournament.end);
         let points_date = tournament_date ? new Date(tournament_date) : new Date();
         let pointsDatePicker = new Pikaday({
            field: container.points_valid.element,
            i18n: lang.obj('i18n'),
            defaultDate: points_date,
            setDefaultDate: true,
            firstDay: fx.fx.env().calendar.first_day,
            onSelect: function() {
               points_date = this.getDate();
               tournament.points_date = points_date.getTime();
               saveTournament(tournament);

               // regenerate points with new date
               if (tournament.events && tournament.events.length) {
                  let { completed_matches } = mfx.tournamentEventMatches({ tournament });
                  tournamentPoints(tournament, completed_matches);
               } else {
                  calcPlayerPoints({ date: points_date, tournament, matches: dbmatches, container, filters });
               }
            },
         });
         pointsDatePicker.setMinDate(tournament.start);
         penaltyReportIcon();
      }

      function penaltyPlayers() {
         if (!tournament.players || !tournament.players.length) return [];
         return tournament.players.filter(p=>p.penalties && p.penalties.length);
      }

      function legacyTournamentOptions() {
         let legacy = displayGen.legacyTournamentTab(container.tournament.element, tournament);
         Object.assign(container, legacy.container);
         legacyTournament(tournament, container);
      }

      function tournamentOptions(days) {
         if (!tournament.display_id) {
            if (!tournament.tuid) tournament.tuid = UUID.new();
            if (tournament.tuid.length < 15) tournament.display_id = tournament.tuid;
         }

         let field_order = [ 'start_date', 'end_date', 'organization', 'organizers', 'location', 'judge' ];

         function nextFieldFocus(field, delay=50) {
            let next_field = field_order.indexOf(field) + 1;
            if (next_field == field_order.length) next_field = 0;
            setTimeout(function() { container[field_order[next_field]].element.focus(); }, delay);
            saveTournament(tournament);
         }

         function defineAttr(attr, evt, required, element) {
            if (evt) element = evt.target;
            let value = element.value.trim();
            tournament[attr] = value;
            if (!evt || evt.which == 13 || evt.which == 9) nextFieldFocus(attr);
         }

         ['organization', 'organizers', 'location', 'judge'].forEach(field => {
            container[field].element.addEventListener('keydown', catchTab, false);
            container[field].element.addEventListener('keyup', (evt) => defineAttr(field, evt));
            container[field].element.value = tournament[field] || '';
         });

         let day_times = days.map(d=>new Date(d).getTime());
         let max_start = Math.min(...day_times);
         let min_end = Math.max(...day_times);

         let start = new Date(tournament.start);
         let end = new Date(tournament.end);
         if (start > new Date(max_start)) {
            tournament.start = max_start;
            start = new Date(max_start);
         }

         function updateStartDate() {
            tournament.start = util.dateUTC(start);
            startPicker.setStartRange(start);
            if (tournament.end < tournament.start) {
               tournament.end = tournament.start;
               endPicker.setDate(new Date(tournament.end));
            }
            endPicker.setStartRange(start);
            endPicker.setMinDate(start);
            unscheduleStrandedMatches();
            saveTournament(tournament);
         }
         function updateEndDate() {
            tournament.end = util.dateUTC(end);
            startPicker.setEndRange(end);
            startPicker.setMaxDate(end);
            endPicker.setEndRange(end);
            unscheduleStrandedMatches();
            saveTournament(tournament);
         }
         function unscheduleStrandedMatches() {
            let date_range = util.dateRange(tournament.start, tournament.end);
            let { scheduled } = mfx.scheduledMatches(tournament);
            let stranded = scheduled.filter(s=>date_range.indexOf(new Date(s.schedule.day)) < 0);

            stranded.forEach(match => {
               match.schedule = {};
               match.source.schedule = {};
            });
         }
         var startPicker = new Pikaday({
            field: container.start_date.element,
            defaultDate: start,
            setDefaultDate: true,
            i18n: lang.obj('i18n'),
            firstDay: fx.fx.env().calendar.first_day,
            onSelect: function() {
               start = this.getDate();
               updateStartDate();
               nextFieldFocus('start_date');
            },
         })
         var endPicker = new Pikaday({
            field: container.end_date.element,
            defaultDate: end,
            setDefaultDate: true,
            i18n: lang.obj('i18n'),
            firstDay: fx.fx.env().calendar.first_day,
            onSelect: function() {
               end = this.getDate();
               updateEndDate();
               nextFieldFocus('end_date');
            },
         });

         container.start_date.element.addEventListener('keydown', catchTab, false);
         container.end_date.element.addEventListener('keydown', catchTab, false);

         container.start_date.element.addEventListener('keyup', (evt) => nextFieldFocus('start_date'));
         container.end_date.element.addEventListener('keyup', (evt) => nextFieldFocus('end_date'));
      }

      function drawsTab() {
         let existing_draws = false;
         let event_draws = tournament.events && tournament.events.length && tournament.events.map(e => e.draw).length;
         if ((group_draws && group_draws.length) || event_draws) existing_draws = true;
         tabVisible(container, 'DT', existing_draws);
         if (!existing_draws) return;

         let selected_event = container.select_draw.ddlb ? container.select_draw.ddlb.getValue() : undefined;

         let selection = 0;
         let draw_options;

         if (event_draws) {
            draw_options = tournament.events.map((e, i) => { 
               if (displayed_event && displayed_event == e.euid) selection = i;
               let edt = tfx.genEventName(e, tfx.isPreRound({ env: fx.fx.env(), e })).type || '';
               return { key: `${e.custom_category ? e.custom_category + ' ' : e.category ? e.category + ' ' : ''}${e.name} ${edt}`, value: i }
            });
         } else if (group_draws.length) {
            draw_options = group_draws;
            enableDrawActions();
         }

         dd.attachDropDown({ 
            options: draw_options,
            id: container.select_draw.id, 
            label: lang.tr('ddlb.draws'), 
         });
         container.select_draw.ddlb = new dd.DropDown({ element: container.select_draw.element, onChange: eventChange, id: container.select_draw.id });

         if (event_draws) {
            container.select_draw.ddlb.setValue(selection, 'white');
         } else if (group_draws.length) {
            container.select_draw.ddlb.setValue(selected_event || group_draws[0].value, 'white');
         }

         dd.attachDropDown({ 
            id: container.compass_direction.id, 
            label: lang.tr('ddlb.direction'), 
         });
         container.compass_direction.ddlb = new dd.DropDown({ element: container.compass_direction.element, onChange: compassChange, id: container.compass_direction.id });
         container.compass_direction.element.style.display = 'none';

         if (event_draws) {
            eventChange(draw_options[selection].value);
         } else {
            eventChange(group_draws[selection].value);
         }

         function compassChange(direction, generate=true) {
            updateCompassDirections();
            container.compass_direction.ddlb.setValue(direction, 'white');
            displayed_draw_event.draw.compass = direction;
            if (generate) genEventDraw(container.select_draw.ddlb.getValue());
         }

         function eventChange(value) {
            if (event_draws) {
               genEventDraw(value);
               container.compass_direction.element.style.display = (displayed_draw_event.draw && displayed_draw_event.draw.compass) ? 'flex' : 'none';
               if (displayed_draw_event && displayed_draw_event.draw && displayed_draw_event.draw.compass) compassChange(displayed_draw_event.draw.compass, false);
            } else if (group_draws.length) {
               genGroupDraw(value);
            }
         }
      }

      function updateCompassDirections() {
         if (!displayed_draw_event || !displayed_draw_event.draw) return;
         let directions = ['east', 'west', 'north', 'south', 'northeast', 'northwest', 'southeast', 'southwest'];
         let compass_options = directions
            .filter(d => displayed_draw_event.draw[d])
            .map(d => ({ key: lang.tr(`draws.${d}`), value: d}));
         container.compass_direction.ddlb.setOptions(compass_options);
      }

      function enableRankEntry(visible) {
         Array.from(document.querySelectorAll('.rankentry')).forEach(e=>e.style.display = visible ? '' : 'none');
         Array.from(document.querySelectorAll('.rankvalue')).forEach(e=>e.style.display = visible ? 'none' : '');

         Array.from(document.querySelectorAll('.ratingentry')).forEach(e=>e.style.display = visible ? '' : 'none');
         Array.from(document.querySelectorAll('.ratingvalue')).forEach(e=>e.style.display = visible ? 'none' : '');

         if (!visible) playersTab();
      }

      function enableManualRankings(enabled) {
         if (!state.edit || !displayedPlayers().length) return;
         if (enabled != undefined) {
            state.manual_ranking = enabled;
         } else {
            state.manual_ranking = !state.manual_ranking;
            saveTournament(tournament);
         }
         enableRankEntry(state.manual_ranking);
         toggleManualRank(state.manual_ranking);

      }

      function toggleManualRank(active) {
         let elem = document.querySelector('.ranking_order');
         elem.classList[active ? 'remove' : 'add'](`ranking_order_inactive`);
         elem.classList[active ? 'add' : 'remove'](`ranking_order_active`);
      }

      function replaceRegisteredPlayers(remote_request, show_notice) {
         if (!state.edit) return;
         let message = `${lang.tr('tournaments.renewlist')}<p><i style='color: red;'>(${lang.tr('phrases.deletereplace')})</i>`;
         displayGen.okCancelMessage(message, renewList, () => displayGen.closeModal());

         function renewList() {
            tournament.players = [];
            playersTab();
            saveTournament(tournament);
            updateRegisteredPlayers(remote_request, show_notice);
         }
      }

      function updateRegisteredPlayers(remote_request, show_notice) {
         if (!state.edit) return;
         let id = show_notice ? displayGen.busy.message(`<p>${lang.tr("refresh.registered")}</p>`) : undefined;
         let done = (registered) => {
            addRegistered(registered);
            displayGen.busy.done(id);
         }
         let notConfigured = (err) => { displayGen.busy.done(id); displayGen.popUpMessage((err && err.error) || lang.tr('phrases.notconfigured')); }
         fetchFx.fetchRegisteredPlayers(tournament.tuid, tournament.category, remote_request).then(done, notConfigured);
      }

      function saveTournament(tournament, changed=true) {
         if (changed) {
            if (tournament.saved_locally) tournament.saved_locally = false;
            if (tournament.pushed2cloud) tournament.pushed2cloud = false;
            if (tournament.infoPublished) tournament.infoPublished = false;
            displayGen.localSaveState(container.localdownload_state.element, tournament.saved_locally);
            displayGen.tournamentPublishState(container.push2cloud_state.element, tournament.pushed2cloud);
            displayGen.pubStateTrnyInfo(container.pubStateTrnyInfo.element, tournament.infoPublished);
         }
         tournament.saved = new Date().getTime();
         db.addTournament(tournament);
      }

      // if (selected_tab && tab_ref[selected_tab] != undefined) displayTab(rab_ref[selected_tab]);

      if (editing) activateEdit();

      return { tournament, container };
   }

   function valueLabel(player) {
      let label = util.normalizeName([player.first_name, player.last_name].join(' '));
      if (player.birth) label += ` [${new Date(player.birth).getFullYear()}]`;
      return { value: player.puid, label, }
   }

   fx.processLoadedTournament = processLoadedTournament;
   function processLoadedTournament() {

      if (!importFx.loaded.tournament) return fetchFx.fileNotRecognized();

      if (importFx.loaded.outstanding && importFx.loaded.outstanding.length) {
         console.log('Cannot Process Tournament with Outstanding Actions');
         return;
      }

      if (importFx.loaded.meta && importFx.loaded.meta.filecategory && importFx.loaded.meta.filecategory != importFx.loaded.meta.category) importFx.loaded.meta.category = '';

      let trny = {
         sid: importFx.loaded.tournament.sid,
         tuid: importFx.loaded.meta.tuid,
         start: importFx.loaded.start,
         end: importFx.loaded.meta.date || importFx.loaded.date,
         name: importFx.loaded.meta.name,
         category: importFx.loaded.tournament.category,
      }

      if (importFx.loaded.accepted) {
         trny.accepted = {};
         if (importFx.loaded.accepted.M) trny.accepted.M = importFx.loaded.accepted.M;
         if (importFx.loaded.accepted.W) trny.accepted.W = importFx.loaded.accepted.W;
      }

      if (importFx.loaded.results) {
         let ranks = importFx.loaded.results.ranks;
         trny.rank_opts = {
            category: importFx.loaded.meta.category,
            sgl_rank: ranks.singles != undefined ? ranks.singles : importFx.loaded.meta.rank,
            dbl_rank: ranks.doubles != undefined ? ranks.doubles : importFx.loaded.meta.rank,
         }
      }

      let {tournament, container} = createTournamentContainer({ tournament: trny, dbmatches: importFx.loaded.matches });
      calcPlayerPoints({ date: tournament.end, tournament, matches: importFx.loaded.matches, container });
   }

   // invoked whenever there is a form change
   // only paramater is date because that is what is passed by calendar object
   function calcPlayerPoints({ date, tournament, matches, container, filters=[] }) {

      let tournament_date = tournament && (tournament.points_date || date || tournament.end);
      let points_date = tournament_date ? new Date(tournament_date) : new Date();
      let tuid = tournament.tuid;

      // legacy... if match doesn't include round_name, add it
      if (matches && matches.length) matches.forEach(match => { if (!match.round_name) match.round_name = match.round; });

      let mz = matches ? matches.slice() : [];

      // remove any calculated points or rankings
      mz.forEach(match => match.players.forEach(p => p=playerFx.cleanPlayer(p)));

      let dbl_matches = mz.filter(f=>f.format == 'doubles').length;

      // retrieve options from container
      let rankings = mz.length ? tournamentOpts(undefined, container) : {};
      let category = rankings.category;

      if (!rankings.category || !points_date) {
         // calling with no points clear Point Display
         displayGen.displayPlayerPoints(container);
         return;
      }

      let points_table = fx.fx.pointsTable({ calc_date: points_date });

      // if there are no gendered ranking settings, 
      // all matches modified with same ranking settings
      let match_data = { matches: mz, category, rankings, date: points_date, points_table };
      let points = rankCalc.bulkPlayerPoints(match_data);

      // DISPLAY
      displayTournamentPoints(container, tournament, points, filters);

      let gender = tournament.genders && tournament.genders.length == 1 ? tournament.genders[0] : undefined;
      let finishFx = () => addAcceptedRankings(container, tournament, matches, category);
      saveMatchesAndPoints({ tournament, matches: mz, points, gender, finishFx });
   }

   function addAcceptedRankings(container, tournament, matches, category) {
      let tuid = tournament.tuid;
      let rankings = matches.length ? tournamentOpts(undefined, container) : {};
      if (tuid) rankCalc.addAcceptedRanking({tuid, category, rankings});
   }

   function saveMatchesAndPoints({ tournament, matches, points={}, gender, finishFx }) {
      db.deleteTournamentPoints(tournament.tuid, gender).then(saveAll, (err) => console.log(err));

      function saveAll() {
         let finish = (result) => { if (typeof finishFx == 'function') finishFx(result); }
         let addMatches = (matches) => util.performTask(db.addMatch, matches, false);
         let singles_points = points.singles ? Object.keys(points.singles).map(player => points.singles[player]) : [];
         let doubles_points = points.doubles ? Object.keys(points.doubles).map(player => points.doubles[player]) : [];
         let all_points = [].concat(...singles_points, ...doubles_points);

         // total points adds all points for all players
         let total_points = all_points.length ? all_points.map(p => p.points).reduce((a, b) => +a + (+b || 0)) : 0;

         // if anyone earned points, save matches, point_events then display
         if (total_points) {
            Promise.all(all_points.map(checkPlayerPUID)).then(addAllPoints, util.logError);

            function addAllPoints(ap) {
               let addPointEvents = (point_events) => util.performTask(db.addPointEvent, point_events, false);
               let valid_points = all_points.filter(p => p.points != undefined && p.puid);
               addPointEvents(valid_points).then(() => addMatches(matches)).then(finish);
            }

         } else {
            addMatches(matches).then(finish);
         }
      }
   }

   function checkAllPlayerPUIDs(players) {
      return new Promise((resolve, reject) => Promise.all(players.map(checkPlayerPUID)).then(resolve, util.logError));
   }

   function checkPlayerPUID(plyr) {
      return new Promise((resolve, reject) => {
         db.findPlayerById(plyr.id).then(checkPlayer, ()=>resolve(plyr));
         function checkPlayer(p) {
            if (p) plyr.puid = p.puid;
            resolve(plyr);
         }
      });
   }

   function pointsTabVisible(container, tournament, visible=true) {
      let tournament_date = tournament && (tournament.points_date || tournament.end);
      let calc_date = tournament_date ? new Date(tournament_date) : new Date();
      let points_table = fx.fx.pointsTable({calc_date});
      let display = (visible && points_table && points_table.mappings) || false;
      tabVisible(container, 'PT', display);
   }

   function tabVisible(container, tab, visible=true) {
      d3.select(`#${tab}` + container.container.id).style('display', visible ? 'flex' : 'none');
   }

   function displayTournamentPoints(container, tournament, points={}, filters) {
      if (!points.singles && !points.doubles) return;
      let totalPoints = (point_events) => Object.keys(point_events).map(k=>util.numeric(point_events[k].points)).reduce((a, b) => a + b, 0);
      let filterPointsByGender = (obj) => {
         if (!obj) return {};

         // keep if gender is not in the filters
         let filtered = Object.keys(obj).filter(k => filters.indexOf(obj[k].gender) < 0);
         // recreate objects
         let mapped = filtered.map(m => { return { [obj[m].name]: obj[m] }});

         return Object.assign({}, ...mapped);
      }

      let filtered_points = {
         singles: filterPointsByGender(points.singles),
         doubles: filterPointsByGender(points.doubles),
      }

      let pts = (points.singles && totalPoints(points.singles)) || (points.doubles && totalPoints(points.doubles));
      pointsTabVisible(container, tournament, pts);

      if (pts) {
         displayGen.displayPlayerPoints(container, filtered_points);
         let pp = (evt) => playerFx.displayPlayerProfile({ puid: util.getParent(evt.target, 'point_row').getAttribute('puid') }).then(()=>{}, ()=>{});
         util.addEventToClass('point_row', pp, container.points.element)
      }
   }

   function attachFilterToggles(classes, filterFx = console.log) {
      util.addEventToClass(classes.filter_m, () => filterFx('M'));
      util.addEventToClass(classes.filter_w, () => filterFx('W'));
      util.addEventToClass(classes.filter_s, () => filterFx('S'));
      util.addEventToClass(classes.filter_d, () => filterFx('D'));
   }

   function toggleClass(cls, gender, node = document) {
      gender = gender.toLowerCase();
      Array.from(node.querySelectorAll('.' + cls)).forEach(elem => {
         let class_list = Array.from(elem.firstChild.classList);
         if (class_list.indexOf(`filter_${gender}`) >= 0) {
            elem.firstChild.classList.toggle(`filter_${gender}_selected`);
            elem.firstChild.classList.toggle(`filter_${gender}_gray`);
         }
      }); 
   }

   fx.ignorePlayer = ignorePlayer;
   function ignorePlayer(row) {
      let e = d3.select(row);
      let index = e.attr('action_index');
      let action = importFx.loaded.outstanding[index];
      let original = { original: action.player };

      importFx.loaded.decisions[index] = Object.assign({}, action, { action: 'ignored' }, original, { status: 'completed' });

      displayGen.undoButton(e);
      e.select('.undo').on('click', () => { d3.event.stopPropagation(); undoAction(row); });
      displayGen.moveToBottom(row);

      submitEdits();
   }

   function submitEdits() {
      searchBox.focus();
      if (importFx.loaded.outstanding.length != Object.keys(importFx.loaded.decisions).length) return false;
      searchBox.active = {};
      displayGen.submitEdits();

      Array.from(displayGen.identify_container.action_message.element.querySelectorAll('button.accept'))
         .forEach(elem => elem.addEventListener('click', acceptEdits));

      function acceptEdits() {
         if (importFx.loaded.outstanding.length != Object.keys(importFx.loaded.decisions).length) return false;

         let actions = Object.keys(importFx.loaded.decisions).map(k => {
            let decision = importFx.loaded.decisions[k];
            if (decision.action == 'aliased') {
               importFx.addAlias({ alias: decision.original.hash, hash: decision.player.hash });
            }
            if (decision.action == 'ignored' && decision.player.ioc) {
               importFx.addIgnore({ hash: decision.original.hash, ioc: decision.player.ioc });
            }
            return decision;
         });

         importFx.loaded.outstanding = [];
         actions = actions.concat(...importFx.loaded.completed);

         let players = importFx.updatePlayers(actions);
         if (!players) processLoadedTournament();
      }
   }

   function undoAction(row) {
      let e = d3.select(row);
      let index = e.attr('action_index');
      let action = importFx.loaded.outstanding[index];
      // let type = (action.status == 'unknown') ? lang.tr('unk') : lang.tr('dup');

      displayGen.ignoreButton(e, action);
      // displayGen.ignoreButton(e);
      e.select('.ignore').on('click', () => { d3.event.stopPropagation(); ignorePlayer(row); });

      delete importFx.loaded.decisions[index];
      clearActivePlayer();
      displayGen.moveToTop(row);
   }

   fx.identifyPlayer = identifyPlayer;
   function identifyPlayer(elem) {
      let e = d3.select(elem);
      let index = e.attr('action_index');
      let action = importFx.loaded.outstanding[index];
      let original = { original: action.player };
      let player = action.player;

      if (searchBox.active.player && searchBox.active.player.puid) {
         let player = { player: searchBox.active.player };

         if (action.status == 'unknown') {
            importFx.loaded.decisions[index] = Object.assign({}, { action: 'aliased' }, original, player, { status: 'completed' });
         } else if (action.status == 'duplicate') {
            importFx.loaded.decisions[index] = Object.assign({}, { action: 'identified' }, original, player, { status: 'completed' });
         }

         displayGen.markAssigned(e);
         let row = util.getParent(elem, 'section_row');
         e.select('.undo').on('click', () => { d3.event.stopPropagation(); undoAction(elem); });
         displayGen.moveToBottom(elem);
         clearActivePlayer();
         submitEdits();

         return;
      }

      let container = displayGen.identifyPlayer(player);
      container.save.element.addEventListener('click', () => { displayGen.closeModal('edit'); });
      container.cancel.element.addEventListener('click', () => { displayGen.closeModal('edit'); });
   }

   function clearActivePlayer() {
      searchBox.active = {};
      displayGen.clearActivePlayer();
      searchBox.focus();
   }

   fx.calcYear = (year) => {
      db.findAllTournaments().then(tz => {
         let ty = tz.filter(t=>new Date(t.start).getFullYear() == year);
         console.log(ty.length);
         fx.calcTournaments(ty).then(() => console.log('done'));
      });
   }
   function calcTournament(t) { return calcTournamentPoints({tournament: t}); }
   fx.calcTournaments = (tournaments) => util.performTask(calcTournament, tournaments, false);

   fx.calcTournamentPoints = calcTournamentPoints;
   function calcTournamentPoints({ tournament }) {
      return new Promise( (resolve, reject) => {
         var tournament_date = tournament && (tournament.points_date || tournament.end);
         var points_date = tournament_date ? new Date(tournament_date) : new Date();
         var points_table = fx.fx.pointsTable({ calc_date: points_date });

         var rankings = {
            category: undefined,
            sgl_rank: undefined,
            dbl_rank: undefined,
         }

         if (tournament.accepted) {
            if (tournament.accepted.M) {
               rankings.category = tournament.accepted.M.category;
               rankings.sgl_rank = tournament.accepted.M.sgl_rank;
               rankings.dbl_rank = tournament.accepted.M.dbl_rank;
               rankings.M = tournament.accepted.M;
            }
            if (tournament.accepted.W) {
               rankings.w_category = tournament.accepted.W.category;
               rankings.w_sgl_rank = tournament.accepted.W.sgl_rank;
               rankings.w_dbl_rank = tournament.accepted.W.dbl_rank;
               rankings.W = tournament.accepted.W;
            }
            db.deleteTournamentPoints(tournament.tuid).then(fetchMatches, (err) => console.log(err));
         } else if (tournament.category == '10') {
            console.log('U10...');
            resolve();
         } else {
            console.log('no accepted rankings... points not calculated', tournament);
            resolve();
         }

         var addPointEvents = (point_events) => util.performTask(db.addPointEvent, point_events, false);

         function fetchMatches() {
            db.db.matches.where('tournament.tuid').equals(tournament.tuid).toArray(calcPoints); 
         }

         function calcPoints(matches) {
            var match_data = { matches, category: rankings.category, rankings, date: points_date, points_table };
            var points = rankCalc.bulkPlayerPoints(match_data);

            var singles_points = Object.keys(points.singles).map(player => points.singles[player]);
            var doubles_points = Object.keys(points.doubles).map(player => points.doubles[player]);
            var all_points = [].concat(...singles_points, ...doubles_points);

            var valid_points = all_points.filter(p => p.points != undefined && p.puid);
            addPointEvents(valid_points).then(resolve({tournament, point_events: valid_points.length}), reject);
         }
      });
   }

   // used exclusively when draws are generated from existing matches
   function generateDrawBrackets(matches) {
      var brackets = dfx.findBrackets(matches);

      brackets.forEach(bracket => {
         let draw_positions = bracket.players.map(p => p.draw_position);
         let missing = util.missingNumbers(draw_positions, false);

         if (missing.length) {
            // insert empty players in unfilled draw_positions
            // start at the end of the missing array and splice
            missing.reverse().forEach(m => bracket.players.splice(m - 1, 0, {}));
         }
      });

      // Sort Brackets by SEED of 1st draw position
      brackets.sort((a, b) => (a.players ? a.players[0].seed || 0 : 0) - (b.players ? b.players[0].seed || 0 : 0));
      return brackets;
   }

   // used exclusively when draws are generated from existing matches
   function generateDrawTree(rows, draw_type) {
      if (!rows.length) return;

      // TODO: dbmatches and therefore match_groups is not updated when events deleted...
      // console.log(rows, draw_type);

      // exclude pre-round matches
      rows = rows.filter(f=>!f.preround);
      let tree = dfx.recreateDrawFromMatches(rows, draw_type);

      // TODO: generate separate draw for pre-round matches?

      return tree;
   }

   function groupMatches(matches) {
      let groups = {}
      if (!matches) return groups;

      groups.ms = matches.filter(match => match.format == 'singles' && match.gender == 'M' && match.consolation == false);
      groups.msq = groups.ms.filter(match => match.round_name && match.round_name.indexOf('Q') == 0 && match.round_name.indexOf('QF') != 0);
      groups.msm = groups.ms.filter(match => match.round_name && match.round_name.indexOf('RR') < 0 && (match.round_name.indexOf('QF') == 0 || match.round_name.indexOf('Q') < 0));
      groups.msrr = groups.ms.filter(match => match.round_name && match.round_name.indexOf('RR') == 0);

      groups.md = matches.filter(match => match.format == 'doubles' && match.gender == 'M' && match.consolation == false);

      groups.ws = matches.filter(match => match.format == 'singles' && match.gender == 'W' && match.consolation == false);
      groups.wsq = groups.ws.filter(match => match.round_name && match.round_name.indexOf('Q') == 0 && match.round_name.indexOf('QF') != 0);
      groups.wsm = groups.ws.filter(match => match.round_name && match.round_name.indexOf('RR') < 0 && (match.round_name.indexOf('QF') == 0 || match.round_name.indexOf('Q') < 0));
      groups.wsrr = groups.ws.filter(match => match.round_name && match.round_name.indexOf('RR') == 0);

      groups.wd = matches.filter(match => match.format == 'doubles' && match.gender == 'W' && match.consolation == false);

      let group_draws = [];
      if (groups.msm.length) group_draws.push( {key: `${lang.tr('genders.male')} ${lang.tr('formats.singles')}`, value: 'msm'} );
      if (groups.wsm.length) group_draws.push( {key: `${lang.tr('genders.female')} ${lang.tr('formats.singles')}`, value: 'wsm'} );
      if (groups.md.length) group_draws.push( {key: `${lang.tr('genders.male')} ${lang.tr('formats.doubles')}`, value: 'md'} );
      if (groups.wd.length) group_draws.push( {key: `${lang.tr('genders.female')} ${lang.tr('formats.doubles')}`, value: 'wd'} );
      if (groups.msq.length) group_draws.push( {key: `${lang.tr('genders.male')} ${lang.tr('draws.qualification')}`, value: 'msq'} );
      if (groups.wsq.length) group_draws.push( {key: `${lang.tr('genders.female')} ${lang.tr('draws.qualification')}`, value: 'wsq'} );
      if (groups.msrr.length) group_draws.push( {key: `${lang.tr('genders.male')} ${lang.tr('draws.roundrobin')}`, value: 'msrr'} );
      if (groups.wsrr.length) group_draws.push( {key: `${lang.tr('genders.female')} ${lang.tr('draws.roundrobin')}`, value: 'wsrr'} );

      // if there are no main draw matches then RR matches were main draw...
      if (groups.wsrr.length && !groups.wsm.length) { groups.wsrr.forEach(match => match.round_name = match.round_name.replace('Q', '')); }
      if (groups.msrr.length && !groups.msm.length) { groups.msrr.forEach(match => match.round_name = match.round_name.replace('Q', '')); }

      return { groups, group_draws };
   }

   function tournamentGenders(tournament, dbmatches, filterFx=()=>true) {
      let match_genders = !dbmatches ? [] : dbmatches
         .map(match => {
            match.gender = match.gender || rankCalc.determineGender(match);
            return match.gender;
         })
         .filter(f=>f)
         .filter((item, i, s) => s.lastIndexOf(item) == i);
      let player_genders = !tournament.players ? [] : tournament.players
         .filter(filterFx)
         .map(player => player.sex)
         .filter(f=>f)
         .filter((item, i, s) => s.lastIndexOf(item) == i);

      let genders = util.unique([].concat(...match_genders, ...player_genders));
      tournament.genders = genders;
      return genders;
   }

   function addMatchDraw(matches) {
      // TODO: .round needs to be replaced with .round_name
      matches.forEach(match => { 
         if (!match.gender) match.gender = rankCalc.determineGender(match); 
         if (match.consolation) match.draw = 'C';
         if (match.round && match.round.indexOf('Q') == 0 && match.round.indexOf('QF') < 0) match.draw = 'Q';

         // TODO: RR is not always Q... if there is only one bracket...
         if (match.round && match.round.indexOf('RR') == 0) match.draw = 'Q';
      });
   }

   // takes a list of matches creates a list of players and events they played/are playing
   fx.matchPlayers = matchPlayers;
   function matchPlayers(matches) {
      if (!matches) return [];
      addMatchDraw(matches);

      let players = [].concat(...matches.map(match => {
         let gender = rankCalc.determineGender(match);
         // add player sex if doesn't exist already
         match.players.forEach(player => player.sex = player.sex || gender);
         return match.players;
      }));

      // make a list of all events in which a player is participating
      let player_events = {};
      matches.forEach(match => {
         match.puids.forEach(puid => { 
            if (!player_events[puid]) player_events[puid] = []; 
            let format = match.format == 'doubles' ? 'd' : 's';
            player_events[puid].push(`${format}_${match.draw || 'M'}`);
         })
      });

      let hashes = [];
      let uplayers = players
         .map(player => {
            let hash = `${player.hash}${player.puid}`;
            if (hashes.indexOf(hash) < 0) {
               hashes.push(hash);
               return player;
            }
         })
         .filter(f=>f)
         .sort((a, b) => {
            let a1 = util.replaceDiacritics(a.full_name);
            let b1 = util.replaceDiacritics(b.full_name);
            return a1 < b1 ? -1 : a1 > b1 ? 1 : 0
         });

      uplayers.forEach(player => {
         // add player events to player objects
         if (player_events[player.puid]) player.events = unique(player_events[player.puid]).join(', ');
      });

      return uplayers;
   }

   fx.createNewTournament = createNewTournament;
   function createNewTournament({ title, tournament_data, callback }) {
      displayGen.escapeModal();

      let env = fx.fx.env();
      let ouid = env.org && env.org.ouid;
      let format_version = env.metadata && env.metadata.exchange_formats && env.metadata.exchange_formats.tournaments;

      var trny = Object.assign({}, tournament_data);
      if (!trny.ouid) trny.ouid = ouid;
      if (!trny.metadata) trny.metadata = { format_version };

      var { container } = displayGen.createNewTournament(title, trny);

      var field_order = [ 'name', 'association', 'organization', 'start', 'end', 'judge', 'draws', 'cancel', 'save' ];

      function nextFieldFocus(field) {
         let next_field = field_order.indexOf(field) + 1;
         if (next_field == field_order.length) next_field = 0;
         container[field_order[next_field]].element.focus(); 
      }

      function setCategory(value) {
         // setTimeout(function() { container.category.ddlb.selectionBackground(value ? 'white' : 'yellow'); }, 200);
         container.category.ddlb.selectionBackground(value ? 'white' : 'yellow');
         trny.category = value;
      }

      dd.attachDropDown({ id: container.category.id, options: fx.fx.orgCategoryOptions() });
      dd.attachDropDown({ id: container.rank.id, label: `${lang.tr('trnk')}:`, options: fx.fx.orgRankingOptions() });

      container.category.ddlb = new dd.DropDown({ element: container.category.element, onChange: setCategory });
      container.category.ddlb.selectionBackground('yellow');
      if (tournament_data && tournament_data.category) container.category.ddlb.setValue(tournament_data.category, 'white');

      function setRank(value) {
         if (value && tournament_data && tournament_data.events && tournament_data.events.length) {
            tournament_data.events.forEach(e=>{ if (!e.rank) e.rank = value; });
         } else {
            // tournament rank is no longer required so no need to notify with yellow
            // setTimeout(function() { container.rank.ddlb.selectionBackground('yellow'); }, 200);
         }
         trny.rank = value;
      }
      container.rank.ddlb = new dd.DropDown({ element: container.rank.element, onChange: setRank });
      container.rank.ddlb.selectionBackground('white');
      if (tournament_data && tournament_data.rank) container.rank.ddlb.setValue(tournament_data.rank, 'white');

      var inout_options = [{key: '-', value: ''}, {key: lang.tr('indoors'), value: 'i'}, {key: lang.tr('outdoors'), value: 'o'}]
      dd.attachDropDown({ id: container.inout.id, options: inout_options });
      container.inout.ddlb = new dd.DropDown({ element: container.inout.element, onChange: (value) => { trny.inout = value } });
      container.inout.ddlb.setValue(tournament_data && tournament_data.inout || '', 'white');

      var surface_options = [
         { key: '-', value: ''},
         { key: lang.tr('surfaces.clay'), value: 'C'},
         { key: lang.tr('surfaces.hard'), value: 'H'},
         { key: lang.tr('surfaces.grass'), value: 'G'},
         { key: lang.tr('surfaces.carpet'), value: 'R'},
      ];
      dd.attachDropDown({ id: container.surface.id, label: `${lang.tr('events.surface')}:`, options: surface_options, floatleft: true });
      container.surface.ddlb = new dd.DropDown({ element: container.surface.element, onChange: (value) => { trny.surface = value } });
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
         if ((!evt || evt.which == 13 || evt.which == 9) && (!required || (required && valid))) nextFieldFocus(attr);
      }

      let saveTrny = () => { 
         let valid_start = !trny.start ? false : typeof trny.start == 'string' ? util.validDate(trny.start) : true;
         let valid_end   = !trny.end   ? false : typeof trny.end   == 'string' ? util.validDate(trny.end) : true;
         if (!valid_start || !valid_end || !trny.name || !validRange() || !trny.category) return;

         if (typeof callback == 'function') callback(trny); 
         displayGen.closeModal();
      }

      let handleSaveKeyDown = (evt) => {
         evt.preventDefault();
         if (evt.which == 9) nextFieldFocus(evt.shiftKey ? 'email' : 'save'); 
      }

      let handleSaveKeyUp = (evt) => {
         catchTab(evt); 
         if (evt.which == 13) saveTrny();
      }

      let handleCancelKeyEvent = (evt) => {
         evt.preventDefault()
         if (evt.which == 9) nextFieldFocus(evt.shiftKey ? 'phone' : 'cancel');
      }

      function validRange() {
         if (!trny.start || !trny.end) return true;
       
         let sdate = new Date(trny.start);
         let edate = new Date(trny.end);
         let days = Math.round((edate-sdate)/(1000*60*60*24));
         let valid = (days >= 0 && days < 15);
         container.start.element.style.background = valid ? 'white' : 'yellow';
         container.end.element.style.background = valid ? 'white' : 'yellow';
         return valid;
      }

      let validateDate = (evt, attr, element) => {
         if (evt) element = evt.target;
         if (element) {
            let datestring = element.value;
            let valid_date = util.validDate(datestring);
            if (valid_date) {
               defineAttr(attr, evt, true, element);
            } else {
               trny[attr] = undefined;
            }
            element.style.background = valid_date && validRange() ? 'white' : 'yellow';
         }

         container.start.element.style.background = util.validDate(container.start.element.value) ? 'white' : 'yellow';
         container.end.element.style.background = util.validDate(container.end.element.value) ? 'white' : 'yellow';
      }

      let start = trny.start || util.dateUTC(new Date());
      let end = trny.end || null;

      var startPicker = new Pikaday({
         field: container.start.element,
         defaultDate: start,
         setDefaultDate: true,
         i18n: lang.obj('i18n'),
         firstDay: fx.fx.env().calendar.first_day,
         onSelect: function() { 
            let this_date = this.getDate();
            start = new Date(util.dateUTC(this_date));
            updateStartDate();
            validateDate(undefined, 'start', container.start.element);
            if (end < start) {
               endPicker.gotoYear(start.getFullYear());
               endPicker.gotoMonth(start.getMonth());
            }
         },
      });
      startPicker.setStartRange(new Date(start));
      if (end) startPicker.setEndRange(new Date(end));

      var endPicker = new Pikaday({
         field: container.end.element,
         i18n: lang.obj('i18n'),
         firstDay: fx.fx.env().calendar.first_day,
         onSelect: function() {
            let this_date = this.getDate();
            end = new Date(util.dateUTC(this_date));
            updateEndDate();
            updateCategoriesAndRankings();
            validateDate(undefined, 'end', container.end.element);
            if (end < start) {
               startPicker.gotoYear(end.getFullYear());
               startPicker.gotoMonth(end.getMonth());
            }
         },
      });
      endPicker.setStartRange(new Date(start));
      endPicker.setMinDate(new Date(start));
      if (end) endPicker.setEndRange(new Date(end));

      container.name.element.addEventListener('keydown', catchTab, false);
      container.association.element.addEventListener('keydown', catchTab, false);
      container.organization.element.addEventListener('keydown', catchTab, false);
      container.judge.element.addEventListener('keydown', catchTab, false);
      container.draws.element.addEventListener('keydown', catchTab, false);

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
         trny.start = start;
         startPicker.setStartRange(new Date(start));
         endPicker.setStartRange(new Date(start));
         endPicker.setMinDate(new Date(start));
      };
      function updateEndDate() {
         trny.end = end;
         startPicker.setEndRange(new Date(end));
         startPicker.setMaxDate(new Date(end));
         endPicker.setEndRange(new Date(end));
      };
      function updateCategoriesAndRankings() {
         console.log('categories and rankings may change when tournament dates change');
      }

      // set the start range and initial date
      startPicker.setDate(start);
      updateStartDate();

      // timeout necessary because startPicker.setDate()
      setTimeout(function() { container.name.element.focus(); }, 50);
   }

   function sameOrg(tournament) {
      let ouid = fx.fx.env().org && fx.fx.env().org.ouid;
      return !tournament.ouid || (tournament.ouid && tournament.ouid == ouid);
   }

   function legacyTournament(tournament, container) {

      configureDDLBs(tournament, container);
      configureDateSelectors(tournament, container);

      function configureDDLBs(tournament, container) {
         let cpp = (value) => { calcPlayerPoints({ tournament, container }); }
         container.category.ddlb = new dd.DropDown({ element: container.category.element, onChange: cpp });
         container.dbl_rank.ddlb = new dd.DropDown({ element: container.dbl_rank.element, onChange: cpp });
         container.sgl_rank.ddlb = new dd.DropDown({ element: container.sgl_rank.element, onChange: cpp });

         if (tournament.genders.length > 1 || tournament.genders.indexOf('W') >= 0) {
            container.w_category.ddlb = new dd.DropDown({ element: container.w_category.element, onChange: cpp });
            container.w_dbl_rank.ddlb = new dd.DropDown({ element: container.w_dbl_rank.element, onChange: cpp });
            container.w_sgl_rank.ddlb = new dd.DropDown({ element: container.w_sgl_rank.element, onChange: cpp });
         }

         // set ddlb options
         let opts = getTournamentOptions(tournament);
         tournamentOpts(opts, container);
      }

      function configureDateSelectors(tournament, container) {
         let start = new Date(tournament.start);
         let end = new Date(tournament.end);

         function updateStartDate() {
            tournament.start = start.getTime();
            startPicker.setStartRange(new Date(start));
            endPicker.setStartRange(new Date(start));
            endPicker.setMinDate(new Date(start));
         };
         function updateEndDate() {
            tournament.end = end.getTime();
            startPicker.setEndRange(new Date(end));
            startPicker.setMaxDate(new Date(end));
            endPicker.setEndRange(new Date(end));
         };

         let startPicker = new Pikaday({
            field: container.start_date.element,
            i18n: lang.obj('i18n'),
            defaultDate: start,
            setDefaultDate: true,
            firstDay: fx.fx.env().calendar.first_day,
            onSelect: function() {
               start = this.getDate();
               updateStartDate();
               calcPlayerPoints({ date: this.getDate(), tournament, container });
            },
         });

         let endPicker = new Pikaday({
            field: container.end_date.element,
            i18n: lang.obj('i18n'),
            defaultDate: end,
            setDefaultDate: true,
            firstDay: fx.fx.env().calendar.first_day,
            onSelect: function() {
               end = this.getDate();
               updateEndDate();
               calcPlayerPoints({ date: this.getDate(), tournament, container });
            },
         });

         updateStartDate();
         updateEndDate();
      }
   }

   function optionNames(teams, luckyloser=false) {
      let lastName = (player) => player.last_name.toUpperCase();
      return teams.map(team => {
         let seed = team[0].seed && !luckyloser ? ` [${team[0].seed}]` : '';

         // draw_order is order in ranked list of event players
         let draw_order = seed ? '' : team[0].draw_order && !luckyloser ? ` (${team[0].draw_order})` : '';

         let lucky = luckyloser ? ' [LL]' : '';
         if (team.length == 1) {
            let first_name = util.normalizeName(team[0].first_name, false);
            return `${lastName(team[0])}, ${first_name}${seed}${draw_order}${lucky}`
         }
         return `${lastName(team[0])}/${lastName(team[1])}${seed}${lucky}`
         
      });
   }

   function drawIsCreated(evt) {
      if (!evt || !evt.draw) return false;
      let current_draw = evt.draw.compass ? evt.draw[evt.draw.compass] : evt.draw;
      let info = dfx.drawInfo(current_draw);
      let created = (info.unassigned && !info.unassigned.length) || info.positions_filled;
      return created ? new Date().getTime() : undefined;
   }

   return fx;
}();
