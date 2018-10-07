import { db } from './db'
import { env } from './env'
import { UUID } from './UUID';
import { util } from './util';
import { coms } from './coms';
import { dd } from './dropdown';
import { fetchFx } from './fetchFx';
import { lang } from './translator';
import { matchFx } from './matchFx';
import { courtFx } from './courtFx';
import { staging } from './staging';
import { tmxTour } from './tmxTour';
import { pointsFx } from './pointsFx';
import { playerFx } from './playerFx';
import { exportFx } from './exportFx';
import { importFx } from './importFx';
import { rankCalc } from './rankCalc';
import { sharedFx } from './sharedFx';
import { publishFx } from './publishFx';
import { displayFx } from './displayFx';
import { searchBox } from './searchBox';
import { displayGen } from './displayGen';
import { calendarFx } from './calendarFx';
import { scheduleFx } from './scheduleFx';
import { scoreBoard } from './scoreBoard';
import { contextMenu } from './contextMenu';
import { tournamentFx } from './tournamentFx';
import { eventManager } from './eventManager';
import { rrDraw, treeDraw, drawFx } from './drawFx';

// TODO: remove use of tournament.sid

export const tournamentDisplay = function() {
   let fx = {};
   let ccTime = 0;         // contextClick time; used to prevent Safari event propagation to click
   let mfx = matchFx;
   let pfx = playerFx;
   let sfx = scheduleFx;
   let tfx = tournamentFx;
   let dfx = drawFx();

   let o = {
      sign_in: { rapid: true, },
      byes_with_byes: false,
      byes_with_unseeded: true,
      focus: { place_player: undefined },
   }

   db.addDev({db});
   db.addDev({dfx});
   db.addDev({util});
   db.addDev({UUID});
   db.addDev({exportFx});

   function acknowledgeBroadcast(ack) { console.log('acknowledgement:', ack); }

   fx.drawOptions = ({draw}) => {
      let type = draw.options().bracket ? 'rr_draw' : 'tree_draw';
      if (env.draws[type]) draw.options(env.draws[type]);
   }

   // fx.settingsLoaded = (env) => {
   fx.settingsLoaded = () => {
      dfx.options(env.drawFx);
      scoreBoard.options(env.scoreboard.options);
      let score_format = tfx.getScoreboardSettings({ format: 'singles' });
      scoreBoard.settings(score_format);
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

   fx.displayTournament = displayTournament;
   function displayTournament({tuid, selected_tab, editing} = {}) {
      displayGen.homeIcon('home');
      tuid = tuid || searchBox.active.tournament && searchBox.active.tournament.tuid;
      db.findTournament(tuid).then(tournament => {
         db.findTournamentMatches(tuid).then(matches => go(tournament, matches), util.logError);
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

      eventManager.holdActions.requestTournamentEvents = () => coms.requestTournamentEvents(tournament.tuid);
      eventManager.holdActions.tournamentPlayers = tournamentPlayers;
      eventManager.holdActions.deleteTeamPlayer = teamPlayerHoldAction;

      db.addDev({tournament});

      // START setup
      let state = {
         edit: editing,
         manual_ranking: false,
         admin: false
      }

      // keep track of displayed components
      let displayed = {
         tournament_event: null,
         draw_event: null,
         schedule_day: null,
         dual_match: null,
         team: null
      }

      // keep track of which tab is open
      let current_tab = null;
      let event_config = null;
      let filters = [];

      // TODO: this is only important here for the legacy DDLB for setting tournament rankings
      //       => it can be removed once the legacy DDLB are removed
      tournamentGenders(tournament, dbmatches);

      let { groups: match_groups, group_draws } = groupMatches(dbmatches);
      let { container, classes, displayTab, display_context, tab_ref } = displayGen.tournamentContainer({ tournament, tabCallback });

      tmxTour.tournamentContainer(container, classes);
      db.addDev({tmxTour});

      let ouid = env.org && env.org.ouid;
      if (ouid && tournament.tuid) {
         var getUserAuth = { tuid: tournament.tuid, };
         coms.requestAcknowledgement({ uuid: tournament.tuid, callback: setUserAuth });
         coms.emitTmx({ getUserAuth });
      }

      // set up to receive delegated scores
      coms.joinTournament(tournament.tuid);
      sharedFx.receiveScore = receiveScore;
      function receiveScore(data) {
         if (data.tournament.tuid != tournament.tuid) {
            console.log('leaving tournament:', data.tournament);
            return coms.leaveTournament(tournament.tuid);
         }
         let target_event = tfx.findEventByID(tournament, data.event.euid);
         if (!target_event) { console.log('event not found!', data); return; }
         let matches = mfx.eventMatches(target_event, tournament);
         let match = matches && matches.reduce((p, c) => c.match.muid == data.match.muid ? c : p, undefined);
         if (!match) { console.log('match not found!', data.match.muid); }
         let scoreboard = data.score.components.sets.map(set => set.games.join('-')).join(' ');
         match.match.delegated_score = scoreboard;
         if (target_event.euid == displayed.draw_event.euid) drawsTab();
         if (displayed.schedule_day && match.match.schedule && match.match.schedule.day == displayed.schedule_day) scheduleTab();
         matchesTab();
      }

      function setUserAuth(result) { displayGen.authState(container.authorize.element, result.authorized || false); }

      container.edit.element.style.display = sameOrg(tournament) && !tournament.delegated ? 'inline' : 'none';
      if (tournament.delegated && sameOrg(tournament)) displayGen.delegated(container, true);

      // create and initialize draw objects
      let rr_draw = rrDraw();
      let tree_draw = treeDraw().dfxOptions(env.drawFx);

      db.addDev({tree_draw});

      draws_context[display_context] = { roundrobin: rr_draw, tree: tree_draw };

      tree_draw.options({ addByes: false, cleanup: true });
      tree_draw.options({ sizeToFit: false, });
      tree_draw.options({ minWidth: 400, minHeight: 100 });
      tree_draw.options({ flags: { path: env.assets.flags }});

      // formerly used to display player profile when clicking in tree draws
      // tree_draw.events({'player1': { 'click': d => playerClick(d, 0) }});
      // tree_draw.events({'player2': { 'click': d => playerClick(d, 1) }});

      tree_draw.options({
         minPlayerHeight: 30,
         details: { club_codes: true, draw_positions: true, player_rankings: true, player_ratings: true, draw_entry: true, seeding: true },
      });

      rr_draw.options({ min_width: 300, details: { games_won_lost: env.draws.rr_draw.details.games_won_lost } });
      // end draw object creation/initialization

      function deleteMatch(muid) {
         dbmatches = dbmatches.filter(m=>m.muid != muid);
         db.deleteMatch(muid);
      }

      editAction();
      tree_draw.selector(container.draws.element);

      util.addEventToClass(classes.auto_draw, toggleAutoDraw);
      util.addEventToClass(classes.gem_seeding, toggleGemSeeding);
      util.addEventToClass(classes.ratings_filter, toggleRatingsFilter);

      attachFilterToggles(classes, updateFilters);
      util.addEventToClass(classes.ranking_order, () => enableManualRankings());
      util.addEventToClass(classes.reg_link, () => editRegistrationLink());
      util.addEventToClass(classes.refresh_registrations, (evt) => {
         if (evt.ctrlKey || evt.shiftKey) return replaceRegisteredPlayers(true);
         updateRegisteredPlayers(true);
      });
      util.addEventToClass(classes.refresh_registrations, () => replaceRegisteredPlayers(true), undefined, 'contextmenu');

      // set up printing events
      util.addEventToClass(classes.print_sign_in, printSignInList);
      util.addEventToClass(classes.print_draw, printDraw);
      util.addEventToClass(classes.print_draw, () => console.log('context menu print'), document, 'contextmenu');

      util.addEventToClass(classes.print_schedule, printSchedule);
      util.addEventToClass(classes.schedule_matches, scheduleMatches);
      function scheduleMatches() {
         let scheduling_height = '40em';
         let schedule_grid = container.container.element.querySelector('.schedule_sheet');

         let scheduling_active = schedulingActive();
         schedule_grid.style.maxHeight = scheduling_active ? '' : scheduling_height;
         container.scheduling.element.style.display = scheduling_active ? 'none' : 'flex';

         if (scheduling_active) {
            // scheduling was active when the button was clicked
            // find and remove awesomplete in schedule_scroll_container
            let search_field = container.schedule.element.querySelector('.awesomplete');
            let search_box = search_field && util.getParent(search_field, 'schedule_box');
            if (search_box) search_box.innerHTML = scheduleFx.opponentSearch();
         }

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
         if (displayed.schedule_day && tournament.schedule.notes && tournament.schedule.notes[displayed.schedule_day]) {
            existing_notes = tournament.schedule.notes[displayed.schedule_day];
         }
         if (displayed.schedule_day && tournament.schedule.notices && tournament.schedule.notices[displayed.schedule_day]) {
            existing_notice = tournament.schedule.notices[displayed.schedule_day];
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
            if (displayed.schedule_day) {
               tournament.schedule.notices[displayed.schedule_day] = modal.notice.element.value;
               tournament.schedule.notes[displayed.schedule_day] = modal.umpirenotes.element.value;
            }

            if (tournament.schedule.umpirenotes != existing_notes) tournament.schedule.up_to_date = false;
            let elem = container.schedule_tab.element.querySelector('.' + classes.schedule_details).querySelector('div');
            displayGen.scheduleDetailsState(elem, tournament.schedule);
            schedulePublishState();
            saveTournament(tournament);
            displayGen.closeModal();
         }
      }

      util.addEventToClass(classes.publish_schedule, (evt) => {
         if (evt.ctrlKey || evt.shiftKey) return unPublishSchedule();
         publishSchedule();
      });
      util.addEventToClass(classes.publish_schedule, unPublishSchedule, undefined, 'contextmenu');
      function unPublishSchedule() {
         if (!state.edit || !tournament.schedule || !tournament.schedule.published) return;
         displayGen.okCancelMessage(lang.tr('schedule.unpublish'), () => unPublishOOP(tournament), () => displayGen.closeModal());
      }

      function unPublishOOP(tournament) {
         let org = env.org;
         let ouid = org && org.ouid;
         if (!ouid || !tournament.tuid) return;

         coms.emitTmx({ deleteOOP: { tuid: tournament.tuid, ouid } });
         displayGen.closeModal();

         coms.requestAcknowledgement({ uuid: `oop:${tournament.tuid}`, callback: changePublishState });

         function changePublishState(result) {
            if (!tournament.schedule) tournament.schedule = {};
            tournament.schedule.published = false
            tournament.schedule.up_to_date = false;
            saveTournament(tournament);
            schedulePublishState();
            scheduleActions();
            displayGen.authState(container.authorize.element, result.authorized || false);
         }
      }

      /**
       * @param   {boolean}   update_time    whether or not to update the schedule publish time
       */
      function publishSchedule(update_time=true) {
         if (env.publishing.require_confirmation) {
            displayGen.okCancelMessage(lang.tr('draws.publish') + '?', pubSched, () => displayGen.closeModal());
         } else {
            pubSched();
         }

         function pubSched() {
            var schedule = sfx.generateSchedule(tournament);

            if (schedule) {
               let updatePublishState = (result) => {
                  tournament.schedule.published = update_time ? new Date().getTime() : (tournament.schedule.published || new Date().getTime());
                  tournament.schedule.up_to_date = true;
                  schedulePublishState();
                  saveTournament(tournament);
                  displayGen.authState(container.authorize.element, result.authorized || false);
               }
               coms.requestAcknowledgement({ uuid: tournament.tuid, callback: updatePublishState });
               coms.emitTmx({ tournamentOOP: schedule });
               displayGen.closeModal();

               // check whether there are published events
               // forced publishing of all out-of-date events every time schedule published...
               var published_events = tournament.events.reduce((p, c) => c.published || p, false);
               if (published_events) {
                  var scheduled = mfx.scheduledMatches(tournament).scheduled;
                  scheduled
                     .reduce((p, c) => util.isMember(p, c.event.euid) ? p : p.concat(c.event.euid), [])
                     .forEach(euid => {
                        let evt = tfx.findEventByID(tournament, euid);
                        if (!evt.up_to_date) { broadcastEvent(tournament, evt); }
                        if (evt.euid == displayed.draw_event.euid) {
                           displayGen.drawBroadcastState(container.publish_state.element, evt);
                        }
                     });
               }
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
            tournament.org = env.org;
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
            let ouid = env.org && env.org.ouid;
            let deleteTournamentEvents = { tuid: tournament.tuid, ouid, delete_tournament: true };
            coms.emitTmx({ deleteTournamentEvents })
            displayGen.closeModal();
         }
      }

      function publishTournamentInfo(tournament) {
         tournament.org = env.org;

         function updateInfoPubState(result) {
            displayGen.pubStateTrnyInfo(container.pubStateTrnyInfo.element, tournament.infoPublished);
            displayGen.tournamentPublishState(container.push2cloud_state.element, tournament.pushed2cloud);
            saveTournament(tournament, false);
            displayGen.authState(container.authorize.element, result.authorized || false);
         }
         coms.requestAcknowledgement({ uuid: tournament.tuid, callback: updateInfoPubState });
         tournament.pushed2cloud = new Date().getTime();
         tournament.infoPublished = new Date().getTime();
         var tournamentInfo = {
            event: 'Publish Tournament Info',
            version: env.version,
            tuid: tournament.tuid,
            tournament: CircularJSON.stringify(tournament)
         };
         coms.emitTmx({tournamentInfo});
      }

      function pushTournament2Cloud(tournament) {
         tournament.org = env.org;

         function updatePushState(result) {
            displayGen.tournamentPublishState(container.push2cloud_state.element, tournament.pushed2cloud);
            saveTournament(tournament, false);
         }
         coms.requestAcknowledgement({ uuid: tournament.tuid, callback: updatePushState });
         tournament.pushed2cloud = new Date().getTime();
         coms.emitTmx({
            event: 'Push Tournament',
            version: env.version,
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
      container.pubTrnyInfo.element.addEventListener('click', (evt) => {
         if (evt.ctrlKey || evt.shiftKey) return unpublishTournamentInfo(tournament);
         publishTournamentInfo(tournament);
      });
      container.pubTrnyInfo.element.addEventListener('contextmenu', () => unpublishTournamentInfo(tournament));

      container.localdownload.element.addEventListener('click', () => {
         if (!tournament.org) tournament.org = env.org;

         exportFx.downloadCircularJSON(`${tournament.tuid}.circular.json`, tournament);
         tournament.saved_locally = true;

         displayGen.localSaveState(container.localdownload_state.element, tournament.saved_locally);
         saveTournament(tournament, false);
      });

      container.export_points.element.addEventListener('click', () => {
         if (container.export_points.element.firstChild.classList.contains('download')) {
            db.findTournamentPoints(tournament.tuid).then(exportPoints, util.logError);
         }
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
         // TODO: is this necessary any longer?
         let profile = env.org.abbr || lang.tr('unk');
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
               if (env.exports.utr) {
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

      container.publish_draw.element.addEventListener('contextmenu', unpublishDraw);

      function unpublishDraw() {
         if (!displayed.draw_event || !displayed.draw_event.published) return;
         displayGen.okCancelMessage(lang.tr('draws.unpublish'), upd, () => displayGen.closeModal());

         function upd() {
            unpublishEventDraw(displayed.draw_event);
            displayGen.drawBroadcastState(container.publish_state.element, displayed.draw_event);
            enableTournamentOptions();
            displayGen.closeModal();
         }
      }

      function unpublishEventDraw(evnt) {
         evnt.published = false;
         evnt.up_to_date = false;
         saveTournament(tournament);
         deletePublishedEvent(tournament, evnt);
      }

      container.publish_draw.element.addEventListener('click', (evt) => {
         if (evt.ctrlKey || evt.shiftKey) return unpublishDraw();
         if (env.publishing.require_confirmation) {
            displayGen.okCancelMessage(lang.tr('draws.publishQ'), broadcast, () => displayGen.closeModal());
         } else {
            broadcast();
         }

         function broadcast() {
            broadcastEvent(tournament, displayed.draw_event);
            displayGen.drawBroadcastState(container.publish_state.element, displayed.draw_event);
            displayGen.closeModal();
         }
      });

      container.recycle.element.addEventListener('click', () => {
         displayGen.okCancelMessage(`${lang.tr('draws.clear')}?`, clearDraw, () => displayGen.closeModal());
         function clearDraw() {
            displayGen.closeModal();
            let evt = displayed.draw_event;
            if (evt && evt.draw && evt.draw.compass) {
               evt.draw.compass = 'east';
               container.compass_direction.ddlb.setValue(evt.draw.compass, 'white');
            }

            // remove any entry information attached to players
            pfx.clearEntry(evt && evt.draw && evt.draw.opponents);

            evt.draw_created = false;
            generateDraw(evt, true);
            displayDraw({ evt });
            updateCompassDirections();
            container.dual.element.style.display = 'none';
            displayed.dual_match = null;

            // if (evt.published) evt.up_to_date = false;
            // displayGen.drawBroadcastState(container.publish_state.element, displayed.draw_event);

            tfx.logEventChange(displayed.draw_event, { fx: 'draw cleared' });
            saveTournament(tournament);

            outOfDate(displayed.draw_event, true);
            enableDrawActions();
         }
      });

      container.player_reps.element.addEventListener('click', () => {
         let modal = displayGen.playerRepresentatives();
         modal.submit.element.addEventListener('click', () => submitReps());
         modal.cancel.element.addEventListener('click', () => displayGen.closeModal());
         if (displayed.draw_event) {
            let approved_ids = [].concat(...displayed.draw_event.approved);
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

            if (!displayed.draw_event.player_representatives) displayed.draw_event.player_representatives =[];
            modal.player_rep1.element.value = displayed.draw_event.player_representatives[0] || '';
            modal.player_rep2.element.value = displayed.draw_event.player_representatives[1] || '';
         }
         function submitReps() {
            displayed.draw_event.player_representatives[0] = modal.player_rep1.element.value;
            displayed.draw_event.player_representatives[1] = modal.player_rep2.element.value;
            displayGen.drawRepState(container.player_reps_state.element, displayed.draw_event);
            saveTournament(tournament);
            displayGen.closeModal();
         }
      });

      container.clearschedule.element.addEventListener('click', (evt) => {
         if (evt.ctrlKey || evt.shiftKey) return resetSchedule();
         clearScheduleDay();
      });
      container.clearschedule.element.addEventListener('contextmenu', resetSchedule);
      container.autoschedule.element.addEventListener('click', autoScheduleFirstAvailable);
      container.autoschedule.element.addEventListener('contextmenu', autoScheduleAtRound);
      // container.schedulelimit.element.addEventListener('click', limitAutoSchedule);
      container.events_add.element.addEventListener('click', newTournamentEvent);
      container.locations_actions.element.addEventListener('click', newLocation);
      container.add_team.element.addEventListener('click', addTeam);

      function cMenu({ selector, coords, options, clickAction }) {
         let font_size = options.length < 7 ? 18 : 16;
         if (options.length) {

            let x, y;
            if (Array.isArray(coords)) {
               x = coords[0];
               y = coords[1];
            } else {
               x = coords.selector_x || 0;
               y = coords.selector_y || 0;
            }

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
               // cmenu(coords[0], coords[1]);
               cmenu(x, y);
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
         let selected_day = scheduled.filter(s=>s.winner == undefined && s.schedule.day == displayed.schedule_day);

         let euid = container.event_filter.ddlb.getValue();
         let round_filter = container.round_filter.ddlb.getValue();

         let to_be_cleared = (all ? scheduled : selected_day)
            .filter(m => (!euid || euid == m.event.euid) && (!round_filter || round_filter == m.round_name));

         to_be_cleared.forEach(match => {
            match.schedule = {};
            match.source.schedule = {};
            matchEventOutOfDate(match);
         });
         scheduleTab();
         scheduleActions({ changed: true });
         saveTournament(tournament);
      }

      // returns true/false depending on whether a match is currently scheduled
      // for displayed.schedule_day or whether it had a interrupted schedule for displayed day
      function scheduledFilter(match) {
         if (!match || !match.schedule) return false;
         let scheduled = match.schedule.day == displayed.schedule_day;
         if (match.schedule.interrupted && match.schedule.interrupted.length) {
            scheduled = match.schedule.interrupted.reduce((p, c) => p || c.day == displayed.schedule_day, scheduled);
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

      /*
      function limitAutoSchedule() {
         console.log('limit Auto Schedule')
         // TODO: Only show the button when the selected event is a Round Robin
         // TODO: change the button to show the limit that has been set
      }
      */

      function autoScheduleAtRound(evt) {
         let at_row = 1;
         autoSchedule(evt, at_row);
      }

      function autoScheduleFirstAvailable(evt) {
         if (evt.ctrlKey || evt.shiftKey) return autoScheduleAtRound(evt);
         autoSchedule(evt);
      }

      function autoSchedule(evt) {
         let order_priority = false;

         let luids = tournament.locations.map(l=>l.luid);
         let luid = luids.length == 1 ? luids[0] : container.location_filter.ddlb.getValue();
         let max_matches_per_court = env.schedule.max_matches_per_court;
         let courts = courtFx.courtData(tournament, luid, max_matches_per_court);

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
            displayGen.escapeModal();
            let config = displayGen.autoScheduleConfig();
            config.order.element.addEventListener('click', () => { order_priority = true; displayGen.closeModal(); doIt(getRound()); });
            config.round.element.addEventListener('click', () => { displayGen.closeModal(); doIt(getRound()); });
            let oop_rows = util.unique(available_oop);
            let range = util.range(Math.min(...oop_rows), Math.max(...oop_rows) + 1);
            let options = range.map(c => ({ key: c, value: c }));
            config.at_row.ddlb.setOptions(options);
            config.at_row.ddlb.setValue(options[0].value, 'white');
            function getRound() { return config.at_row.ddlb.getValue(); }
         } else {
            doIt();
         }

         function doIt(at_row=1) {
            available_cells = available_cells.filter(cell => cell.oop_round >= at_row);

            let to_be_scheduled = scheduleFx.sortedUnscheduled(tournament, filtered_unscheduled, order_priority);

            // now assign oop cells to matches
            to_be_scheduled.forEach(match => {
               let available = available_cells.pop();
               if (available) {
                  let schedule = { 
                     day: displayed.schedule_day,
                     oop_round: available.oop_round,
                     court: available.court,
                     luid: available.luid,
                     index: available.index
                  }
                  match.schedule = schedule;
                  match.source.schedule = Object.assign({}, match.schedule);
                  matchEventOutOfDate(match);
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
      
      var supported_types = env.draws.types;
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
      teamsTab();
      eventsTab();
      courtsTab();
      scheduleTab();
      filteredTabs();
      
      // if (!tMatches() || tournament.events) { updateRegisteredPlayers(); }

      searchBox.noSuggestions = noSuggestions;
      // END setup.  

      // SUPPORTING FUNCTIONS

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

      function addTournamentPlayer(opponent_container, new_player) {
         if (!tournament.players) tournament.players = [];
         let existing = tournament.players.filter(p=>p.id == new_player.id);
         let assignment = displayGen.playerAssignmentActions(opponent_container);

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
            let e = tfx.findEventByID(tournament, displayed.euid);
            if (e) eventPlayers(e);
            eventsTab();
         }

         let addNew = (evt) => {
            searchBox.typeAhead.suggestions = [];

            new_player.signed_in = false;
            if (!new_player.rankings) new_player.rankings = {};
            new_player.full_name = tfx.fullName(new_player, false);

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
            let category_filter = container.category_filter.ddlb ? container.category_filter.ddlb.getValue() : tournament.category;
            pfx.createNewPlayer({ player_data: new_player, category: category_filter, callback: addNewTournamentPlayer });
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

      pfx.actions.addTournamentPlayer = addTournamentPlayer;

      function pushNewPlayer(new_player) {
         if (!tournament.players) tournament.players = [];

         let added = tfx.addPlayers(tournament, [new_player]);
         if (added) saveTournament(tournament);
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
         if (pfx.action == 'addTournamentPlayer' && value) {
            searchBox.element.value = '';
            let name = value.split(' ');
            let new_player = {
               sex: 'M',
               first_name: firstCap(name[0]),
               last_name: firstCap(name.slice(1).join(' ')),
            }
            let category_filter = container.category_filter.ddlb ? container.category_filter.ddlb.getValue() : tournament.category;
            pfx.createNewPlayer({ player_data: new_player, category: category_filter, callback: addNewTournamentPlayer, date: tournament.start });
         }
      }

      function enableAddPlayer() {
         let category_filter = container.category_filter.ddlb ? container.category_filter.ddlb.getValue() : tournament.category;

         let tournament_date = tournament && (tournament.points_date || tournament.end);
         let calc_date = tournament_date ? new Date(tournament_date) : new Date();

         let points_table = rankCalc.pointsTable({calc_date});
         let categories = points_table && points_table.categories;
         let ages = categories && categories[category_filter] && categories[category_filter].ages;
         let ratings = categories && categories[category_filter] && categories[category_filter].ratings;

         let year = calc_date.getFullYear();
         let min_year = ages && (year - parseInt(ages.from));
         let max_year = ages && (year - parseInt(ages.to));

         pfx.action = 'addTournamentPlayer';
         pfx.displayGen = displayGen.showConfigModal;
         pfx.notInDB = true;
         pfx.override = ({ player, puid, notInDB }) => {
            if (!player && notInDB && puid) player = tournament.players.reduce((p, c) => c.puid == puid ? c : p, undefined);
            if (player) {
               let container = displayGen.playerProfile(pfx.displayFx);
               container.info.element.innerHTML = displayGen.playerInfo(player, {});
               addTournamentPlayer(container, player);
            }
         };

         searchBox.category = 'players';
         searchBox.category_switching = false;
         searchBox.setSearchCategory(lang.tr("actions.add_player"));

         db.findAllPlayers().then(arr => {
            let puids = arr.map(p=>p.puid);
            if (tournament.players) {
               tournament.players.forEach(p => {
                  if (puids.indexOf(p.puid)<0) {
                     let added_player = Object.assign({}, p);
                     // added_player.registerd = true;
                     arr.push(added_player);
                  }
               });
            }
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
            if (ratings) {
               // TODO: if the category has a ratings range and the player
               // doesn't have a rating don't add them...
               // but if the player is on the sign in list... add them??
               return true;
            }
         }
      }

      function disablePlayerOverrides(current_tab, next_tab) {
         if (current_tab == 'events' && next_tab != 'events') {
            delete pfx.override;
            delete pfx.notInDB;
            if (next_tab != 'players') resetSearch();
         } else if (current_tab == 'players' && next_tab != 'players') {
            pfx.action = undefined;
            pfx.displayGen = undefined;
            resetSearch();
         }

         function resetSearch() {
            searchBox.category_switching = true;
            searchBox.setSearchCategory();
         }
      }

      function tabCallback(tab_number, reference) {
         tmxTour.clear();

         disablePlayerOverrides(current_tab, reference);

         if (reference == 'players') { playersTab(); }

         if (current_tab != 'draws' && reference == 'draws') {
            displayGen.drawBroadcastState(container.publish_state.element, displayed.draw_event);

            // resize the draw when tab is clicked so that names size properly
            tree_draw();
            rr_draw();
         }

         if (reference == 'draws') {
            hideOpponentSelections();
            displayGen.drawBroadcastState(container.publish_state.element, displayed.draw_event);

            if (displayed.draw_event && !displayed.draw_event.draw_created) { 
               container.dual.element.style.display = 'none';
               displayed.dual_match = null;
            }
         }

         // matchesTab() checks for new matches and updates pointsTab();
         if (reference == 'matches' || reference == 'points') matchesTab();
         if (reference == 'tournament') penaltyReportIcon();
         if (reference == 'schedule') {
            displayGen.arrowFx = (key) => {
               if (tmxTour.active()) return;
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

         if (reference == 'teams') {
            let details_active = container.team_details.element.style.display != 'none';
            if (details_active && state.edit) enableAddTeamPlayer();
            if (details_active && displayed.team) displayTeam({ team: displayed.team });
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

      function ratingsFilterActive() {
         let elem = document.querySelector('.' + classes.ratings_filter);
         if (!elem) return;
         return Array.from(elem.firstChild.classList).indexOf('filter_active') >= 0 ? true : false;
      }

      function toggleAutoDraw(auto) {
         let e = tfx.findEventByID(tournament, displayed.euid);
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
            displayGen.okCancelMessage(`${lang.tr('warn')}: ${lang.tr('phrases.cleardraw')}`, clickChange, () => displayGen.closeModal());
         } else {
            clickChange();
         }

         function clickChange() {
            togglePlayPause();

            if (e) {
               e.regenerate = 'auto draw';
               e.draw_created = false;
               e.automated = autoDrawSetting();
               eventList(true);
            }

            displayGen.closeModal();
         }
      }

      function toggleRatingsFilter(active) {
         let e = tfx.findEventByID(tournament, displayed.euid);
         if (e) {
            let filter_active = ratingsFilterActive();
            let toggleFilterActive = () => {
               // toggle the two possible options
               let elem = document.querySelector('.' + classes.ratings_filter);
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
            setFilter();

            let new_rating = Object.assign({}, (e && e.ratings_filter) || {});

            function setFilter() {
               let id_obj = displayGen.ratingsFilterValues({ ratings_filter: e.ratings_filter });
               let entry_modal = d3.select(id_obj.entry_modal.element);
               id_obj.low.element.value = (e.ratings_filter && e.ratings_filter.low) || '';
               id_obj.high.element.value = (e.ratings_filter && e.ratings_filter.high) || '';
               id_obj.low.element.addEventListener("keyup", e => getValidValue(e, 'low'));
               id_obj.high.element.addEventListener("keyup", e => getValidValue(e, 'high'));
               id_obj.clear.element.addEventListener("click", clearRatingsRange);
               id_obj.submit.element.addEventListener("click", setRatingsRange);
               id_obj.low.element.focus();

               function clearRatingsRange() {
                  delete e.ratings_filter;
                  saveTournament(tournament);
                  displayEvent({e});
                  removeRatingsModal();
               }

               function setRatingsRange() {
                  if (new_rating.low || new_rating.high) {
                     e.ratings_filter = new_rating;
                     saveTournament(tournament);
                  }
                  displayEvent({e});
                  removeRatingsModal();
               }

               function removeRatingsModal() {
                  entry_modal.remove();
                  document.body.style.overflow = null;
                  displayGen.escapeFx = undefined;
               }

               function getValidValue(e, attr) {
                  if (e.which == 13) {
                     if (attr == 'low') id_obj.high.element.focus();
                     if (attr == 'high') setRatingsRange();
                  }
                  let value = id_obj[attr].element.value;
                  let floatval = parseFloat(value);
                  new_rating[attr] = !isNaN(floatval) ? floatval : '';
               }
            }
         }
      }

      function toggleGemSeeding(active) {
         let e = tfx.findEventByID(tournament, displayed.euid);
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

      function schedulingActive() { return container.scheduling.element.style.display != 'none'; }

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

         let ouid = env.org && env.org.ouid;
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

         /*
         // only do this if the tab stays on the teams tab... currently swithing to tournament tab
         if (current_tab == 'teams') {
            let details_active = container.team_details.element.style.display != 'none';
            if (details_active && state.edit) enableAddTeamPlayer();
         }
         */

         if (document.body.scrollIntoView) document.body.scrollIntoView();

         // TODO: insure that env.org.abbr is appropriately set when externalRequest URLs are configured
         let tournament_date = tournament && tournament.start;
         let calc_date = tournament_date ? new Date(tournament_date) : new Date();
         let categories = rankCalc.orgCategories({calc_date});

         // TODO: this shouldn't be done *every* time that edit state is activated
         fetchFx.fetchRankLists(categories).then(maxInternationalRankings, maxInternationalRankings);
      }

      /*
       * int_rankings indicates the maximum number of international rankings
       * for each category... so that an offset may be calculated when actual
       * rankings are independent of international ranking
       *
       * TODO: shouldn't be attached to tournament object...
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
         if (!state.admin) return;
         displayGen.escapeModal();
         displayGen.okCancelMessage(lang.tr('phrases.revokeauth'), revokeAuthorization, () => displayGen.closeModal());
         function revokeAuthorization() {
            let revokeAuthorization = { tuid: tournament.tuid };
            coms.emitTmx({ revokeAuthorization });
            displayGen.closeModal();
            displayGen.authState(container.authorize.element);
         }
      }

      function sendTeam(team) {
         let key_uuid = (+new Date).toString(36).slice(-6).toUpperCase();
         let pushKey = {
            key_uuid,
            content: {
                  "onetime": true,
                  "directive": "sendKey",
                  "key": team.uuid
               }
         }
         let ctext = `<h2>${key_uuid}</h2><h2>${lang.tr('phrases.keycopied')}</h2>`;
         coms.emitTmx({ pushKey });
         displayGen.escapeModal();
         let msg = displayGen.okCancelMessage(ctext, () => displayGen.closeModal());
         copyClick(key_uuid);
      }

      function authorizeUser() {
         if (!state.admin) return;
         let key_uuid = (+new Date).toString(36).slice(-6).toUpperCase();
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

         let ctext = (!env.isMobile) ? `<h2>${key_uuid}</h2><h2>${lang.tr('phrases.keycopied')}</h2>` : `<h2>${lang.tr('tournaments.key')}</h2>${key_uuid}`;

         coms.requestAcknowledgement({ uuid: key_uuid, callback: displayKey });
         // TODO: server won't accept pushKey unless user uuuid in superuser cache on server
         coms.emitTmx({ pushKey });
         copyClick(key_uuid);

         function displayKey(ack) {
            displayGen.escapeModal();
            displayGen.actionMessage({ message: ctext, actionFx: () => displayGen.closeModal(), action: lang.tr('actions.ok'), noselect: false });
         }
      }

      function delegateMatch(match, teams, score_format) {
         let evt = tfx.findEventByID(tournament, match.euid);
         let key_uuid = (+new Date).toString(36).slice(-6).toUpperCase();

         let content = {
            event: {
               name: evt.broadcast_name,
               euid: evt.euid,
               inout: evt.inout,
               surface: evt.surface,
               draw_size: evt.draw_size
            },
            tournament: {
               name: tournament.name,
               tuid: tournament.tuid,
               start: tournament.start,
            },
            teams,
            match
         }
         let pushKey = {
            key_uuid,
            content: {
                  "onetime": true,
                  "directive": "mobile",
                  "content": {
                     muid: match.muid,
                     data: CircularJSON.stringify(content) 
                  }
               }
         }

         let ctext = (!env.isMobile) ? `<h2>${key_uuid}</h2><h2>${lang.tr('phrases.keycopied')}</h2>` : `<h2>${lang.tr('tournaments.key')}</h2>${key_uuid}`;

         coms.requestAcknowledgement({ uuid: key_uuid, callback: displayKey });

         coms.emitTmx({ pushKey });
         copyClick(key_uuid);

         function displayKey(ack) {
            displayGen.escapeModal();
            displayGen.actionMessage({
               message: ctext,
               action: lang.tr('actions.ok'),
               actionFx: () => displayGen.closeModal(),
               noselect: false,
               cancel: lang.tr('phrases.qrcode'),
               cancelAction: () => QRdelegation()
            });
         }

         function QRdelegation() {
            displayGen.closeModal();

            let message = `${location.origin}/mobile/?key=${key_uuid}`;
            let ctext = `
               <div><canvas id='qr'></canvas></div>
               <div id='msg' style='display: none;'>${lang.tr('phrases.linkcopied')}</div>
               `;
            let msg = displayGen.okCancelMessage(ctext, () => displayGen.closeModal());
            genQUR(message);
         }
      }

      function editAction() {
         if (!container.edit.element || !container.finish.element) return;
         
         container.edit.element.addEventListener('click', () => { if (!state.edit) activateEdit(); });
         container.finish.element.addEventListener('click', () => { deactivateEdit(); });
         container.cloudfetch.element.addEventListener('contextmenu', () => {
            if (!env.isMobile) coms.requestTournamentEvents(tournament.tuid);
         });
         container.cloudfetch.element.addEventListener('click', (evt) => {
            if (evt.ctrlKey || evt.shiftKey) return coms.requestTournamentEvents(tournament.tuid);
            coms.requestTournament(tournament.tuid);
         });
         container.authorize.element.addEventListener('contextmenu', revokeAuthorization);
         container.authorize.element.addEventListener('click', (evt) => {
            if (evt.ctrlKey || evt.shiftKey) return revokeAuthorization();
            authorizeUser();
         });
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
         let ouid = env.org && env.org.ouid;
         let same_org = sameOrg(tournament);

         container.authorize.element.style.display = ouid && state.edit ? 'inline' : 'none';
         container.edit.element.style.display = state.edit ? 'none' : 'inline';
         container.finish.element.style.display = state.edit ? 'inline' : 'none';
         container.cloudfetch.element.style.display = state.edit && ouid && same_org ? 'inline' : 'none';
         container.export_points.element.firstChild.className = 'action_icon';
         container.export_matches.element.firstChild.className = 'action_icon';
         checkAdminActions();

         container.points_valid.element.disabled = !state.edit;

         document.querySelector('.refresh_registrations').style.opacity = state.edit ? 1 : 0;
         document.querySelector('.' + classes.refresh_registrations).classList[state.edit ? 'add' : 'remove']('info');

         document.querySelector('.reg_link').style.opacity = state.edit ? 1 : 0;
         if (state.edit) {
            db.findSetting('fetchRegisteredPlayers').then(regLinkState, util.logError);
            function regLinkState(setting) {
               document.querySelector('.' + classes.reg_link).style.display = (!setting || !setting.url) ? 'inline' : 'none';
            }
         } else {
            document.querySelector('.' + classes.reg_link).style.display = 'none';
         }

         util.eachElementClass(container.team_details.element, 'team_attr_edit', (el) => el.disabled = !state.edit);
         util.eachElementClass(container.team_details.element, 'manualorder', (el) => {
            el.disabled = true;
            el.style.background = 'white';
         });
         if (container.team_details.element.style.display != 'none') {
            let delbutton = container.team_details.element.querySelector('.btn.del');
            delbutton.style.display = state.edit ? 'inline' : 'none';
         }

         let view_icon = state.edit && env.documentation ? 'flex' : 'none';
         util.eachElementClass(document, 'tiny_docs_icon', (el) => el.style.display=view_icon);
         util.eachElementClass(document, 'tiny_tour_icon', (el) => el.style.display=view_icon);
         util.eachElementClass(document, 'hints_icon', (el) => el.style.display=view_icon);

         signInSheet();
         scheduleActions();
         penaltyReportIcon();
         enableDrawActions();
         enableTournamentOptions();

         container.notes_entry.element.style.display = 'none';
         container.notes_container.element.style.display = 'inline';
         container.tournament_attrs.element.style.display = 'flex';
         fillNotes();

         teamsTab();
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
                  if (util.string2boolean(setting.auth.tournaments)) { enableDownloads(); }
                  if (util.string2boolean(setting.auth.authorize)) { state.admin = true; }
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
         let ouid = env.org && env.org.ouid;

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

         players.forEach(p => {
            p.id = p.id && p.id.trim() ? p.id.trim() : fakeID(p);
            p.puid = p.puid && p.puid.trim() ? p.puid.trim() : p.id;
         });
         let id_map = Object.assign(...players.map(p => ({ [p.puid]: p })));

         // check for overlap with existing players, add any newly retrieved attributes to existing
         tournament.players.forEach(p => { if (id_map[p.puid]) Object.assign(p, id_map[p.id]); });

         // add any new players that don't already exist in tournament
         players.forEach(pushNewPlayer);
         if (save) saveTournament(tournament);

         function fakeID(p) { return [p.first_name, p.last_name, p.ioc].join('').trim(); }
      }

      function printDraw() {
         let current_draw = displayed.draw_event.draw.compass ? displayed.draw_event.draw[displayed.draw_event.draw.compass] : displayed.draw_event.draw;
         var created = drawIsCreated(displayed.draw_event);

         if (created) {
            let qualifying = (displayed.draw_event && util.isMember(['Q', 'R'], displayed.draw_event.draw_type) && current_draw);
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
                  let all_rounds = env.drawFx.ll_all_rounds;
                  let lucky_losers = mfx.getLuckyLosers(tournament, displayed.draw_event, all_rounds);

                  exportFx.orderedPlayersPDF({
                     tournament,
                     players: lucky_losers,
                     event_name: displayed.draw_event.name,
                     doc_name: `${lang.tr('draws.luckyloser')} ${lang.tr('print.signin')}`,
                     extra_pages: false
                  })
                  displayGen.closeModal();
               });
            } else if (data && options) {
               printPDF();
            }

            function printPDF() {
               let dual_teams = displayed.dual_match && getDualTeams(displayed.dual_match);
               let dual_matches = displayed.dual_match && mfx.dualMatchMatches(displayed.draw_event, displayed.dual_match.match.muid);
               try {
                  exportFx.printDrawPDF({
                     data,
                     options,
                     tournament,
                     selected_event,
                     event: displayed.draw_event,
                     dual_teams,
                     dual_matches,
                     dual_match: displayed.dual_match,
                     save: env.printing.save_pdfs
                  });
               }
               catch (err) { util.logError(err); }
            }
         } else {
            printDrawOrder(displayed.draw_event);
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
            day: displayed.schedule_day,
            matches: day_matches,
            save: env.printing.save_pdfs
         });
      }

      function printDrawOrder(evt) {
         evt = evt || tfx.findEventByID(tournament, displayed.euid);

         // if no event or no approved players or category undefined, abort
         if (evt && evt.approved && evt.category) {
            let category = staging.legacyCategory(evt.category);
            let t_players;
            if (evt.format == 'D') {
               let teams = tfx.approvedDoubles({ tournament, e: evt })
                  .map(team => team.players.map(player => Object.assign(player, { seed: team.seed })));;
               return exportFx.doublesSignInPDF({
                  tournament,
                  teams,
                  save: env.printing.save_pdfs,
                  doc_name: `${lang.tr('dbl')} ${lang.tr('print.signin')}`
               });
            } else {
               t_players = tournament.players
                  .filter(player=>evt.approved.indexOf(player.id) >= 0)
                  .filter(player=>player.signed_in);
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
                  save: env.printing.save_pdfs
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
               save: env.printing.save_pdfs,
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
               save: env.printing.save_pdfs,
               doc_name: `${lang.tr('sgl')} ${lang.tr('print.signin')}`
            });
            displayGen.closeModal();
         });
         sisobj.doubles.element.addEventListener('click', () => {
            exportFx.doublesSignInPDF({
               tournament,
               save: env.printing.save_pdfs,
               doc_name: `${lang.tr('dbl')} ${lang.tr('print.signin')}`
            });
            displayGen.closeModal();
         });
      }

      function teamsTab() {
         let visible = (tfx.isTeam(tournament) && (state.edit || (tournament.teams && tournament.teams.length))) || false;
         tabVisible(container, 'TM', visible); 

         teamList();
      }

      function eventsTab() {
         if (!state.edit && (!tournament.events || !tournament.events.length)) {
            // hide events tab if there are no events and not in edit mode
            // also hide events tab if tournament type is not "standard", i.e.
            // if dual matches or a team tournament, which only have one event (at present)
            
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
            // detail_actions.select('.save').style('display', 'none');
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

      function approvedChanged(e, update=false) {
         tmxTour.clear();
         eventName(e);
         if (tfx.isTeam(tournament)) {
            // console.log('approved changed');
         } else {
            approvedByRank(e);
            if (e.draw_type == 'Q' && event_config && event_config.qualifiers) {
               event_config.qualifiers.ddlb.selectionBackground(!e.qualifiers ? 'red' : 'white');
            }
         }
         if (update) { 
            eventOpponents(e);
         }
      }

      function filteredEligible(e, eligible) {
         return !eligible ? [] : eligible.filter(player => {
            let rating = player.ratings && player.ratings[e.ratings.type] && player.ratings[e.ratings.type].singles.value;
            let floatrating = !isNaN(parseFloat(rating)) ? parseFloat(rating) : false;
            let rating_in_range = floatrating && 
               ((!e.ratings_filter.low || floatrating >= e.ratings_filter.low) && (!e.ratings_filter.high || floatrating <= e.ratings_filter.high));
            return rating_in_range;
         });
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
               if (tfx.isTeam(tournament)) {
                  let eligible_teams = tfx.eligibleTeams(tournament, e).teams;
                  e.approved = [].concat(...e.approved, ...eligible_teams.map(t=>t.id));
               } else {
                  let eligible_players = tfx.eligiblePlayers(tournament, e).players;
                  if (e.ratings_filter && e.ratings && e.ratings.type) { eligible_players = filteredEligible(e, eligible_players); }
                  e.approved = [].concat(...e.approved, ...eligible_players.map(p=>p.id));
               }
               outOfDate(e);
               e.regenerate = 'modify: addAll';
               approvedChanged(e, true);
               saveTournament(tournament);
            }
         },
         removeAll: function(e) {
            if (!state.edit || e.active) return;
            warnIfCreated(e).then(doIt, () => { return; });
            function doIt() {
               e.approved = [];
               e.draw_created = false;
               outOfDate(e);
               e.regenerate = 'modify: removeAll';
               e.wildcards = [];
               approvedChanged(e, true);
               saveTournament(tournament);
            }
         },
         removeID: function(e, id) {
            if (!state.edit || e.active) return;
            e.draw_created = false;
            e.approved = e.approved.filter(i=>i!=id);
            if (!e.wildcards) e.wildcards = [];
            e.wildcards = e.wildcards.filter(i=>i!=id);
            e.luckylosers = e.luckylosers.filter(i=>i!=id);
            saveTournament(tournament);
            outOfDate(e);
            e.regenerate = 'modify: removeID';
            approvedChanged(e, true);
         },
      }

      function closeEventDetails() {
         searchBox.normalFunction();
         displayed.euid = undefined;
         displayGen.hideEventDetails(container);
      }

      function closeTeamDetails() {
         displayed.team = null;
         searchBox.normalFunction();
         displayGen.hideTeamDetails(container);
      }

      function closeLocationDetails() {
         searchBox.normalFunction();
         displayGen.hideLocationDetails(container);
      }

      function enableAddTeamPlayer(team) {
         if (!team) {
            let team_uuid = container.team_details.element && container.team_details.element.getAttribute('uuid');
            team = tfx.findTeamByID(tournament, team_uuid);
         }
         if (!tournament.players || !state.edit || !team || searchBox.irregular_search_list == 'enableTeamPlayer') return;

         let all_team_player_puids = !tournament.teams || !tournament.teams.length ? [] :
            [].concat(...tournament.teams.map(t=>t && t.players && Object.keys(t.players))).filter(f=>f);

         db.findAllPlayers().then(arr => {
            let puids = arr.map(p=>p.puid);
            tournament.players.forEach(p=>{ if (puids.indexOf(p.puid) < 0) arr.push(p); });
            let available = arr.filter(notTeamMember);
            if (available.length) {
               // exclude players that are on other teams...
               searchBox.typeAhead.list = available.map(valueLabel);

               searchBox.category = 'players';
               searchBox.category_switching = false;
               searchBox.setSearchCategory(lang.tr('search.add2team'));
               searchBox.irregular_search_list = 'addTeamPlayer';

               pfx.notInDB = true;
               pfx.override = ({ player, puid, notInDB }) => {
                  if (!team.players) team.players = {};
                  if (notInDB && puid) player = tournament.players.reduce((p, c) => c.puid == puid ? c : p, undefined);
                  if (!player) return;
                  if (!player.rankings) player.rankings = {};

                  let rank_category = staging.legacyCategory(tournament.category);
                  fetchFx.fetchRankList(rank_category).then(addRanking, addPlayer);

                  function addRanking(rank_list) {
                     if (!rank_list || !rank_list.rankings || !rank_list.rankings.players) return addPlayer();
                     let player_rankings = rank_list.rankings.players;
                     if (player_rankings[player.id]) {
                        let category_ranking = player_rankings[player.id];
                        if (category_ranking) {
                           player.rankings[rank_category] = +category_ranking.ranking;
                           player.category_ranking = +category_ranking.ranking;
                           player.int = category_ranking.int;
                        }
                     }
                     addPlayer();
                  }

                  function addPlayer() {
                     team.players[player.puid] = { order: 0 };

                     if (!tournament.players) tournament.players = [];
                     all_team_player_puids.push(player.puid);

                     db.findClub(player.club + '').then(club => {
                        if (club && club.code) player.club_code = club.code;
                        finish();
                     });

                     function finish() {
                        let added = tfx.addPlayers(tournament, [player]);
                        if (added) saveTournament(tournament);
                        displayTeam({ team });
                        teamList();
                     }
                  }
               }
            }
         });

         function notTeamMember(player) { return all_team_player_puids.indexOf(player.puid) < 0; }
      }

      function enableApproveTeam(e) {
         if (!e) return;

         let ineligible_teams = tfx.ineligibleTeams(tournament, e).teams;
         let unavailable_teams = tfx.unavailableTeams(tournament, e).teams;
         let eligible = tfx.eligibleTeams(tournament, e, ineligible_teams, unavailable_teams).teams;
         console.log('enable approve eligible teams');
      }

      function enableApprovePlayer(e) {
         if (!e) return;

         // first time we get eligible it is for populating Search Box
         let ineligible_players = tfx.ineligiblePlayers(tournament, e).players;
         let unavailable_players = tfx.unavailablePlayers(tournament, e).players;
         let eligible = tfx.eligiblePlayers(tournament, e, ineligible_players, unavailable_players).players;

         eligible.forEach(p => { if (p.order) p.full_name = `${p.full_name}&nbsp;<span class='player_order'>(${p.order})</span>`; });
         let approved = tfx.approvedPlayers({ tournament, e });

         let searchable_players = [].concat(...eligible, ...approved);

         searchBox.category = 'players';
         searchBox.category_switching = false;
         searchBox.setSearchCategory(lang.tr('search.approve'));

         // populate search box with eligible AND approved
         searchBox.typeAhead.list = searchable_players.map(valueLabel);
         searchBox.irregular_search_list = true;

         pfx.notInDB = true;
         pfx.override = ({ player, puid, notInDB }) => {
            if (!player && notInDB && puid) player = tournament.players.reduce((p, c) => c.puid == puid ? c : p, undefined);
            let ineligible_players = tfx.ineligiblePlayers(tournament, e).players;
            let unavailable_players = tfx.unavailablePlayers(tournament, e).players;

            // second time we get eligible it is to check player status
            let eligible = tfx.eligiblePlayers(tournament, e, ineligible_players, unavailable_players).players;
            eligible.forEach(p => { if (p.order) p.full_name = `${p.full_name}&nbsp;<span class='player_order'>(${p.order})</span>`; });

            let el = eligible.map(e=>e.puid);

            if (eligible.map(e=>e.puid).indexOf(player.puid) >= 0) {
               if (e.format == 'D') {
                  if (!e.teams) e.teams = [];
                  // return the index of any team that only has one player
                  let single = e.teams.map((t, i)=>t.length == 1 ? i : undefined).filter(f=>f!=undefined);

                  if (single.length) {
                     e.teams[single[0]].push(player.id);
                  } else {
                     e.teams.push([player.id]);
                  }
                  approvedChanged(e, true);
               } else {
                  modifyApproved.push(e, player.id);
               }
            } else if (e.approved.indexOf(player.id) >= 0) {
                  modifyApproved.removeID(e, player.id);
            } else {
               if (e.format == 'D') {
                  let approved_team = e.approved.reduce((p, c) => { return (c.indexOf(player.id + '') >= 0) ? c : p; }, undefined);
                  let built_team = e.teams.reduce((p, c) => { return (c.indexOf(player.id + '') >= 0) ? c : p; }, undefined);

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

      util.addEventToClass(classes.team_rankings, () => enableTeamRankings());

      function enableTeamRankings() {
         let team_ranking_order = container.team_details.element.querySelector('.ranking_order');
         let active = team_ranking_order.classList.contains('ranking_order_active');
         team_ranking_order.classList[!active ? 'remove' : 'add'](`ranking_order_inactive`);
         team_ranking_order.classList[!active ? 'add' : 'remove'](`ranking_order_active`);
         util.eachElementClass(container.team_details.element, 'manualorder', (el) => {
            el.disabled = active;
            el.style.background = !active && el.tagName.toLowerCase() == 'input' ? 'lightyellow' : 'white';
            if (el.tagName.toLowerCase() == 'input') { el.classList[active ? 'remove' : 'add'](`bottomborder`); }
         });
         if (active) {
            let team_uuid = container.team_details.element.getAttribute('uuid');
            let team = tfx.findTeamByID(tournament, team_uuid);
            saveTournament(tournament);
            displayTeam({team});
         }
      }

      function teamList({cleanup} = {}) {
         let actions = d3.select(container.teams_actions.element);
         if (state.edit) {
            actions.style('display', 'flex');
            actions.select('.add').style('display', 'inline');
         } else {
            actions.style('display', 'none');
            actions.select('.add').style('display', 'none');
            let detail_actions = d3.select(container.team_details.element);
            detail_actions.select('.del').style('display', 'none');
         }

         if (tournament.teams) {
            if (cleanup) {
               util.eachElementClass(container.teams.element, 'teamid', (i) => i.classList.remove('highlight_listitem'));
               return closeTeamDetails();
            }

            let tm = mfx.tournamentEventMatches({ tournament });
            let all_matches = tm.completed_matches.concat(...tm.pending_matches, ...tm.upcoming_matches);
            if (!tournament.events) tournament.events = [];

            let teams = tournament.teams.map((team, i) => {
               let active_events = tournament.events.filter(evnt=>evnt.approved && evnt.approved.indexOf(team.id)>=0);
               let dual_matches = [].concat(...active_events.map(ae=>ae.draw && dfx.matches(ae.draw)).filter(f=>f));
               let active_duals = dual_matches.filter(m=>m.teams.map(t=>t[0].id).indexOf(team.id)>=0);
               let active_dual_muids = active_duals.map(dm=>dm.match.muid);
               let team_positions = Object.assign({}, ...active_duals.map(ad=>({ [ad.match.muid]: ad.teams.map(t=>t[0].id).indexOf(team.id) })));
               let team_matches = all_matches.filter(m=>active_dual_muids.indexOf(m.dual_match)>=0);

               let matches_won = team_matches.filter(tm=>tm.winner_index != undefined && team_positions[tm.dual_match] == tm.winner_index);
               let matches_lost = team_matches.filter(tm=>tm.winner_index != undefined && team_positions[tm.dual_match] != tm.winner_index);

               let team_meta = {
                  name: team.name,
                  id: team.id,
                  winloss: `${matches_won.length}/${matches_lost.length}`,
                  members: team.players ? Object.keys(team.players).length : 0,
                  total_matches: team_matches.length
               }
               return team_meta;
            });

            let highlighted = container.team_details.element.style.display != 'none' && container.team_details.element.getAttribute('uuid');
            displayGen.teamList(container, teams, highlighted);

            let opacity = (state.edit && teams.length) ? 1 : 0;
            container.team_details.element.querySelector('.ranking_order').style.opacity = opacity;
            container.team_details.element.querySelector('.' + classes.team_rankings).classList[opacity ? 'add' : 'remove']('infoleft');

            function teamDetails(target) {
               let clicked_team = util.getParent(target, 'teamid');
               let class_list = clicked_team.classList;
               if (class_list.contains('highlight_listitem')) {
                  closeTeamDetails();
               } else {
                  util.eachElementClass(container.teams.element, 'teamid', (i) => i.classList.remove('highlight_listitem'));
                  class_list.add('highlight_listitem');
                  let uuid = clicked_team.getAttribute('uuid');
                  let team = tfx.findTeamByID(tournament, uuid);
                  displayTeam({ team });
               }
            }
            eventManager.register('teamrow', 'tap', teamDetails);
         }
      }

      function eachElementClass(elem, cls, fx) {
         if (!elem || !cls || !fx || typeof fx != 'function') return;
         try { Array.from(elem.querySelectorAll(`.${cls}`)).forEach(fx); }
         catch (err) { console.log('eachElementClass error:', err); }
      }

      function eventList(regen_drawstab = false) {
         let events = [];
         let highlight_euid;
         if (tournament.events && tournament.events.length) {
            events = tournament.events.map((e, i) => {
               tfx.setDrawSize(tournament, e);
               if (displayed.euid && displayed.euid == e.euid) highlight_euid = e.euid;
               let info = !e.draw ? {} : e.draw.compass ? dfx.compassInfo(e.draw) : dfx.drawInfo(e.draw);

               let event_matches = mfx.eventMatches(e, tournament);
               let scheduled = event_matches.filter(m=>m.match && m.match.schedule && m.match.schedule.court).length;
               let draw_type_name = tfx.isPreRound({ env, e }) ? lang.tr('draws.preround') : getKey(draw_types, e.draw_type); 
               let matches_per_node = e.matchlimits ? Object.keys(e.matchlimits).map(k=>e.matchlimits[k]).reduce((a, b) => a + b, 0) : 0;
               let total_matches = tfx.isTeam(tournament) ? ((e.draw_size || 0) * matches_per_node) : info.total_matches;

               let opponents = 0;
               if (tournament.teams) {
                  opponents = tournament.teams
                     .filter(team=>e.approved.indexOf(team.id) >= 0)
                     .map(team=>(team.players ? Object.keys(team.players).length : 0)).reduce((a, b) => a + b, 0);
               } else {
                  opponents = e.approved.length + (['E', 'S'].indexOf(e.draw_type) >= 0 ? (e.qualifiers || 0) : 0);
               }

               let event_meta = {
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
                  draw_size: e.draw_size,
                  total_matches,
                  inout: e.inout,
                  surface: e.surface,
                  warning: e.draw_type == 'Q' && e.approved && e.approved.length && !e.qualifiers,
                  draw_type: e.draw_type,
                  draw_type_name,
                  opponents
               };

               return event_meta;
            });
         }

         displayGen.eventList(container, events, highlight_euid);

         function eventDetails(evt) {
            tmxTour.clear();
            let clicked_event = util.getParent(evt.target, 'event');
            let class_list = clicked_event.classList;
            if (class_list.contains('highlight_listitem')) {
               closeEventDetails();
            } else {
                Array.from(container.events.element.querySelectorAll('.highlight_listitem'))
                  .forEach(elem => elem.classList.remove('highlight_listitem'));
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
         util.addEventToClass('published_header', (evt) => { if (evt.ctrlKey || evt.shiftKey) return unpublishAllEvents(); });
         if (regen_drawstab) drawsTab();
         enableTournamentOptions();
      }

      function customEventCategory(evt) {
         let clicked_event = util.getParent(evt.target, 'event');
         let euid = clicked_event.getAttribute('euid');
         let evnt = tfx.findEventByID(tournament, euid);
         if (state.edit) {
            var coords = { x: evt.clientX, y: evt.clientY }
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
               displayGen.setEventName(container, evnt);
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

         if (env.publishing.require_confirmation) {
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

      function addTeam() {
         let added_team = displayGen.addTeamOptions();
         let teamsearch = added_team.teamsearch.element;

         added_team.createnew.element.addEventListener('click', createNew);
         added_team.loadplayers.element.addEventListener('click', loadPlayers);
         added_team.submitkey.element.addEventListener('click', submitTeamKey);

         db.findAllTeams().then(selectionBox, util.logError);

         function selectionBox(teams) {
            let selection_flag = false;
            // let team_list = teams.map(t=>({ value: t.uuid, label: t.name }));
            let team_list = teams.map(t=>({ value: t.id, label: t.name }));
            let type_ahead = new Awesomplete(teamsearch, { list: team_list });
            teamsearch.addEventListener("awesomplete-selectcomplete", function(e) { selection_flag = true; teamSelected(this.value); }, false);
            teamsearch.addEventListener('keydown', catchTab , false);
            teamsearch.addEventListener("keyup", function(e) { 
               // auto select first item on 'Enter' *only* if selectcomplete hasn't been triggered
               if (e.which == 13 && !selection_flag) {
                  if (type_ahead.suggestions && type_ahead.suggestions.length) {
                     type_ahead.next();
                     type_ahead.select(0);
                  } else {
                     createNew();
                  }
               }
               selection_flag = false;
            });
            teamsearch.focus();
         }

         function teamSelected(uuid) {
            displayGen.closeModal();

            if (!uuid) return;
            teamsearch.value = '';
            let team = db.findTeam(uuid);
            displayTeam({ team });
         }

         function submitTeamKey() {
            displayGen.closeModal();
            let key = teamsearch.value;
            if (!key || !key.trim()) return;
            console.log('submitting team key:', key);
            coms.sendKey(key.trim());
         }

         function loadPlayers() {
            displayGen.closeModal();
            let id_obj = displayGen.importPlayers();
            let callback = (players) => {
               displayGen.closeModal();
               if (players && !players.length) return displayGen.popUpMessage('Players not found: Check Headers/Tab Names.');
               players.forEach(player => { player.full_name = `${player.last_name.toUpperCase()}, ${util.normalizeName(player.first_name, false)}`; });
               tfx.addPlayers(tournament, players);
               let puids = players.map(p=>p.puid);
               createNew(puids);
            }
            importFx.loadPlayersDragAndDrop(id_obj.dropzone.element, ()=>{}, callback);
         }

         function createNew(puids) {
            displayGen.closeModal();

            let name = teamsearch.value.trim() || lang.tr('teams.newteam');

            let team = {
               name,
               id: UUID.new(),
               abbr: undefined,
               coach: undefined,
               ioc: undefined,
               players: {}
            }

            team.uuid = team.id;

            if (puids) puids.forEach(puid => team.players[puid] = { order: 0 });

            if (!tournament.teams) tournament.teams = [];
            tournament.teams.push(team);

            let i = tournament.teams.length - 1;
            displayTeam({ team, index: i });
            teamList();
            enableAddTeamPlayer(team);
            saveTournament(tournament);
         }
      }

      function newTournamentEvent() {
         tmxTour.clear();
         let genders_signed_in = tournamentGenders(tournament, dbmatches, (f)=>f.signed_in);

         let gender = '';
         if (genders_signed_in.length == 1) gender = genders_signed_in[0];

         let existing_gendered_singles = !tournament.events ? [] : tournament.events
            .filter(e => e.format == 'S' && ['E', 'S'].indexOf(e.draw_type) >= 0)
            .map(e=>e.gender);

         if (!gender && genders_signed_in.length == 2 && existing_gendered_singles.length == 1) {
            gender = genders_signed_in.filter(g=>existing_gendered_singles.indexOf(g) < 0)[0];
         }

         let scoreboard = env.scoreboard.settings;
         let presets = {
            gender,
            format: 'S',
            draw_type: 'E',
            category: tournament.category || '',
            rank: tournament.rank || '',
            surface: tournament.surface || 'C',
            inout: tournament.inout || '',
            scoring_format: {
               singles: scoreboard.singles,
               doubles: scoreboard.doubles
            }
         };

         if (tfx.isTeam(tournament)) {
            presets = {
               draw_type: 'E',
               format: '',
               category: tournament.category || '',
               rank: tournament.rank || '',
               surface: tournament.surface || '',
               inout: tournament.inout || '',
            }
         }

         let e = eventTemplate(presets);

         toggleAutoDraw(false);
         addTournamentEvent(e);
      }

      function addTournamentEvent(e) {
         if (!tournament.events) tournament.events = [];
         displayed.euid = e.euid;
         e.automated = autoDrawSetting();
         tournament.events.push(e);
         coms.emitTmx({ 
            event: 'Add Event',
            version: env.version,
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
         displayGen.closeModal();
      }

      // when an event is deleted all references to it must also be deleted
      function removeReferences(evt) {
         if (!tournament.events) return;
         tournament.events.forEach(e => { 
            Object.keys(e.links).forEach(key => { 
               if (e.links[key] == evt.euid) {

                  // if an elminiation draw has been deleted that was linked to a RR draw, then RR draw is no longer qualifying draw
                  if (['E', 'S'].indexOf(e.draw_type) >= 0 && e.draw_type == 'R' && e.draw) {
                     dfx.tallyBracketAndModifyPlayers({ matches: e.matches });
                  }

                  delete e.links[key]; 
                  // TODO: is it necessary to regenerate a draw when its linked/ draw is deleted?
                  // IF a qualifying draw is removed then, yes, maybe...
                  // e.regenerate = true;
               }
            }); 
         });
      }

      function enableEventTeams(e) {
         let player_detail = d3.select(container.detail_opponents.element);
         player_detail.select('.event_teams').style('display', e.format == 'D' ? 'flex' : 'none');
         player_detail.select('.team_players').style('display', e.format == 'D' ? 'flex' : 'none');
         player_detail.select('.eligible').select('.addall').style('display', e.format == 'D' ? 'none' : 'flex');
      }

      function autoDrawVisibility(e) {
         let auto_setting = document.querySelector('.' + classes.auto_draw);
         let visibility = e.structure == 'feed' || e.active || !state.edit || !env.draws.autodraw ? 'none' : 'inline';
         if (tfx.isTeam(tournament)) visibility = 'none';
         auto_setting.style.display = visibility;
      }

      function ratingsFilterVisibility(e) {
         let ratings_filter = document.querySelector('.' + classes.ratings_filter);
         let visibility = !e.ratings || e.active || !state.edit ? 'none' : 'inline';
         if (tfx.isTeam(tournament)) visibility = 'none';
         ratings_filter.style.display = visibility;
      }

      function getCategoryRatings(category) {
         let tournament_date = tournament && tournament.start;
         let calc_date = tournament_date ? new Date(tournament_date) : new Date();
         let points_table = rankCalc.pointsTable({calc_date});
         let ctgs = points_table && points_table.categories;
         let ratings = ctgs && ctgs[category] && ctgs[category].ratings;
         return ratings;
      }

      container.team_edit_name.element.addEventListener('keyup', function(k) { 
         if (k.which == 13) {
            container.team_edit_name.element.style.display = 'none';
            let value = container.team_edit_name.element.value;
            if (value) {
               container.team_display_name.element.innerHTML = value;
               let uuid = container.team_details.element.getAttribute('uuid');
               let team = tfx.findTeamByID(tournament, uuid);
               team.name = value;
               saveTournament(tournament);
               teamList();
            }
            container.team_display_name.element.style.display = 'flex';
         }
      });

      container.team_display_name.element.addEventListener('click', editTeamName);

      function editTeamName() {
         if (!state.edit) return;
         container.team_display_name.element.style.display = 'none';
         container.team_edit_name.element.style.display = 'flex';
         container.team_edit_name.element.focus();
      }

      function displayTeam({ team, index } = {}) {
         if (!team) return;
         displayed.team = team;

         // let team_index = tournament.teams && tournament.teams.map(t=>t.uuid).indexOf(team.uuid);
         let team_index = tournament.teams && tournament.teams.map(t=>t.id).indexOf(team.id);
         index = index || (team_index >= 0 ? team_index : undefined);

         let team_details = displayGen.displayTeamDetails(container, team);
         team_details.abbreviation.element.value = team.abbreviation || '';
         team_details.coach.element.value = team.coach || '';
         team_details.school.element.value = team.school || '';
         let ioc_codes = env.ioc_codes || [];
         let ioc_idioms = Object.assign({}, ...ioc_codes.map(d => ({ [d.ioc]: d.name })));
         team_details.ioc.element.value = (team.ioc && ioc_idioms[team.ioc]) || '';

         util.eachElementClass(container.team_details.element, 'team_attr_edit', (el) => el.disabled = !state.edit);

         let field_order = [ 'abbreviation', 'club', 'school', 'ioc', 'coach'];
         let nextFieldFocus = (field) => {
            let next_field = field_order.indexOf(field) + 1;
            if (next_field == field_order.length) next_field = 0;
            team_details[field_order[next_field]].element.focus(); 
         }

         let defineAttr = (attr, evt, required, elem) => {
            team[attr] = elem ? elem.value : evt ? evt.target.value : undefined;
            if ((!evt || evt.which == 13 || evt.which == 9) && (!required || (required && team[attr]))) {
               saveTournament(tournament);
               return nextFieldFocus(attr);
            }
         }

         team_details.abbreviation.element.addEventListener('keydown', catchTab);
         team_details.abbreviation.element.addEventListener('keyup', (evt) => defineAttr('abbreviation', evt));
         team_details.school.element.addEventListener('keydown', catchTab);
         team_details.school.element.addEventListener('keyup', (evt) => defineAttr('school', evt));
         team_details.coach.element.addEventListener('keydown', catchTab);
         team_details.coach.element.addEventListener('keyup', (evt) => defineAttr('coach', evt));

         function orderEntry(evt) {
            let value = evt.target.value;
            function validOrder(value) { return /^\{\d*\}*$/.test(value) ? value : util.numeric(value); }

            evt.target.value = validOrder(value) || '';
            let puid = evt.target.getAttribute('puid');

            if (puid) { team.players[puid].order = evt.target.value; }

            if (!displayGen.disable_keypress && (evt.which == 13 || evt.which == 9)) {
               // now move the cursor to the next player's ranking
               let order = evt.target.getAttribute('order');
               let entry_fields = Array.from(container.team_details.element.querySelectorAll('.manualorder'))
                  .filter(f=>f.tagName.toLowerCase() == 'input');
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
                  entry_fields[0].select();
               }
            }

            // use this in safari??
            function selectAll(elem) { elem.setSelectionRange(0, elem.value.length); }
         }

         // IOC Awesomplete
         let list = ioc_codes.map(d => ({ label: d.name, value: d.ioc }));
         team_details.ioc.typeAhead = new Awesomplete(team_details.ioc.element, { list });

         let selection_flag = false;
         let selectComplete = (c) => { 
            selection_flag = true; 
            team.ioc = c.text.value; 
            team_details.ioc.element.value = c.text.label;
         }
         team_details.ioc.element.addEventListener("awesomplete-selectcomplete", selectComplete, false);
         team_details.ioc.element.addEventListener('keydown', catchTab , false);
         team_details.ioc.element.addEventListener('keyup', catchTab , false);
         team_details.ioc.element.addEventListener("keyup", function(evt) { 
            // auto select first item on 'Enter' *only* if selectcomplete hasn't been triggered
            if ((evt.which == 13 || evt.which == 9) && !selection_flag) {
               if (team_details.ioc.typeAhead.suggestions && team_details.ioc.typeAhead.suggestions.length) {
                  team_details.ioc.typeAhead.next();
                  team_details.ioc.typeAhead.select(0);
               } else {
                  team_details.ioc.element.value = '';
               }
               nextFieldFocus(evt.shiftKey ? 'school' : 'ioc');
            }
            selection_flag = false;
         });

         // Club Awesomplete
         db.findAllClubs().then(clubs => {
            let list = clubs.map(club => ({ label: club.name, value: club }));
            team_details.club.typeAhead = new Awesomplete(team_details.club.element, { list });

            let selection_flag = false;
            let selectComplete = (c) => { 
               selection_flag = true; 
               team.club = c.text.value.id; 
               team.club_code = c.text.value.code; 
               team_details.club.element.value = c.text.label;
            }
            team_details.club.element.addEventListener("awesomplete-selectcomplete", selectComplete, false);
            team_details.club.element.addEventListener('keydown', catchTab , false);
            team_details.club.element.addEventListener('keyup', catchTab , false);
            team_details.club.element.addEventListener("keyup", function(evt) { 
               // auto select first item on 'Enter' *only* if selectcomplete hasn't been triggered
               if ((evt.which == 13 || evt.which == 9) && !selection_flag) {
                  if (team_details.club.typeAhead.suggestions && team_details.club.typeAhead.suggestions.length) {
                     team_details.club.typeAhead.next();
                     team_details.club.typeAhead.select(0);
                  } else {
                     team.club_name = team_details.club.element.value;
                  }
                  nextFieldFocus(evt.shiftKey ? 'abbreviation' : 'club');
               }
               selection_flag = false;
            });
         });

         let players = Object.keys(team.players)
            .map(puid => tournament.players.reduce((p, c) => c.puid == puid ? c : p, undefined))
            .filter(f=>f)
            .sort((a, b) => (team.players[a.puid].order || 1000) - (team.players[b.puid].order || 1000));
         displayGen.displayTeamPlayers({ elem: team_details.players.element, players, team });

         util.addEventToClass('manualorder', orderEntry, container.team_details.element, 'keyup');
         util.addEventToClass('manualorder', catchTab, container.team_details.element, 'keydown');
         util.addEventToClass('team_player', teamPlayerClick, container.team_details.element);
         util.addEventToClass('team_player', teamPlayerContext, container.team_details.element, 'contextmenu');

         container.team_details.element.style.display = 'flex';
         container.team_details.element.setAttribute('uuid', team.id);
         container.team_display_name.element.style.display = 'flex';
         container.team_display_name.element.innerHTML = team.name;
         container.team_edit_name.element.style.display = 'none';
         container.team_edit_name.element.value = team.name;

         let actions = d3.select(container.team_details.element);

         if (state.edit) {
            if (index != undefined) {
               // don't enable add players until team is saved...
               enableAddTeamPlayer(team);
               // actions.select('.save').style('display', 'none');
               actions.select('.cancel').style('display', 'none');
               actions.select('.del').style('display', 'inline')
                  .on('click', () => {
                     displayGen.escapeModal();
                     let message = `${lang.tr('actions.delete_team')}: ${team.name}?`;
                     displayGen.okCancelMessage(message, deleteTeam, () => displayGen.closeModal());
               });
               actions.select('.done').style('display', 'inline')
                  .on('click', () => {
                     closeTeamDetails();
                     saveTournament(tournament);
                  });
            } else {
               actions.select('.del').style('display', 'none');
               actions.select('.done').style('display', 'none');
               /*
               actions.select('.save').style('display', 'inline')
                  .on('click', () => { 
                     if (!tournament.teams) tournament.teams = [];
                     tournament.teams.push(team);

                     let i = tournament.teams.length - 1;
                     displayTeam({ team, index: i });
                     teamList();
                     saveTournament(tournament);
                  });
               */
               actions.select('.cancel')
                  .style('display', 'inline')
                  .on('click', () => { closeTeamDetails(); });
            }
         } else {
            actions.select('.done')
               .style('display', 'inline')
               .on('click', closeTeamDetails);
         }

         function deleteTeam() {
            console.log('delete team... delete players from tournament players??');
            closeTeamDetails();
            displayGen.closeModal();

            // TODO: ?? first check whether team can be deleted
            tournament.teams.splice(index, 1);
            saveTournament(tournament);
            teamList();
         }
      }

      function teamPlayerHoldAction(target) {
         let client = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
         teamPlayerContext({ target, client });
      }
      function teamPlayerClick(evt) { if (evt.ctrlKey || evt.shiftKey) return teamPlayerContext(evt); }
      function teamPlayerContext(evt) {
         if (state.edit) {
            var mouse = { x: evt.clientX, y: evt.clientY }

            let puid = util.getParent(evt.target, 'team_player').getAttribute('puid');
            let clicked_player = tournament.players.reduce((p, c) => { if (c.puid == puid) p = c; return p; }, undefined);

            var options = [];
            if (false) options.push({ label: lang.tr('edt'), key: 'edit' });
            if (false) options.push({ label: lang.tr('idp'), key: 'identify' });
            options.push({ label: lang.tr('dlp'), key: 'delete' });

            if (options.length == 1) {
               selectionMade({ key: options[0].key });
            } else {
               displayGen.svgModal({ x: mouse.x, y: mouse.y, options, callback: selectionMade });
            }

            function selectionMade(choice, index) {
               if (choice.key == 'delete') {
                  if (!clicked_player) return deletePlayer();
                  var caption = `<p>${lang.tr('delete')} ${lang.tr('ply')}:</p> <p>${clicked_player.full_name}</p>`;
                  displayGen.okCancelMessage(caption, deletePlayer, () => displayGen.closeModal());
                  function deletePlayer() {
                     let team_uuid = container.team_details.element && container.team_details.element.getAttribute('uuid');
                     let team = tfx.findTeamByID(tournament, team_uuid);
                     delete team.players[puid];
                     saveTournament(tournament);
                     displayGen.closeModal();
                     displayTeam({ team });
                     teamList();
                  }
               }
            }
         }
      }

      container.event_edit_name.element.addEventListener('keyup', function(k) { 
         if (k.which == 13) {
            container.event_edit_name.element.style.display = 'none';
            let value = container.event_edit_name.element.value;
            let euid = container.event_details.element.getAttribute('euid');
            let evt = tfx.findEventByID(tournament, euid);
            if (evt) {
               evt.custom_category = value;
            } else {
               let name = tfx.isTeam(tournament) ? lang.tr('events.teamevent') : lang.tr('events.newevent');
               displayGen.setEventName(container, { name });
            }
            eventName(evt);
            saveTournament(tournament);
            container.event_display_name.element.style.display = 'flex';
         }
      });

      container.event_display_name.element.addEventListener('click', editEventName);

      function editEventName() {
         let euid = container.event_details.element.getAttribute('euid');
         let evt = tfx.findEventByID(tournament, euid);
         if (state.edit && evt) {
            container.event_display_name.element.style.display = 'none';
            container.event_edit_name.element.style.display = 'flex';
            container.event_edit_name.element.focus();
         }
      }

      function displayEvent({ e, index } = {}) {
         e = e || (displayed.euid ? tfx.findEventByID(tournament, displayed.euid) : undefined);
         if (!e) return;

         tmxTour.clear();

         if (!tournament.events) tournament.events = [];
         let event_index = tournament.events.map(m=>m.euid).indexOf(e.euid);
         index = index || (event_index >= 0 ? event_index : undefined);

         e.ratings = getCategoryRatings(e.category);

         let actions = d3.select(container.event_details.element);

         autoDrawVisibility(e);
         ratingsFilterVisibility(e);
         toggleAutoDraw(e.automated);

         // by default hidden
         let gem_seeding = document.querySelector('.' + classes.gem_seeding);
         if (gem_seeding) gem_seeding.style.display = 'none';

         // only toggle it if there is a true/false value
         if (e.gem_seeding != undefined) toggleGemSeeding(e.gem_seeding);
         toggleRatingsFilter(e.ratings_filter ? true : false);

         displayed.euid = e.euid;
         configureEventSelections(e);
         enableEventTeams(e);
         actions.style('display', 'flex');


         container.event_details.element.style.display = 'flex';
         container.event_details.element.setAttribute('euid', e.euid);
         container.event_display_name.element.style.display = 'flex';
         container.event_edit_name.element.style.display = 'none';
         container.event_edit_name.element.value = e.custom_category || '';

         if (state.edit && index != undefined) {
               if (tfx.isTeam(tournament)) {
                  enableApproveTeam(e);
               } else {
                  enableApprovePlayer(e);
               }
               actions.select('.cancel').style('display', 'none');
               actions.select('.del').style('display', 'inline').on('click', promptReallyDelete);
               actions.select('.done').style('display', 'inline').on('click', closeAndSaveEvent);
         } else {
            if (!tfx.isTeam(tournament)) actions.select('.done').style('display', 'inline').on('click', closeEventDetails);
         }

         function promptReallyDelete() {
            displayGen.escapeModal();
            let message = `${lang.tr('actions.delete_event')}: ${e.name}?`;
            displayGen.okCancelMessage(message, deleteTournamentEvent, () => displayGen.closeModal());
         }

         function closeAndSaveEvent() {
            closeEventDetails();
            saveTournament(tournament);
         }

         function deleteTournamentEvent() {
            closeEventDetails();

            if (displayed.draw_event && displayed.draw_event.euid == e.euid) displayed.draw_event = null;

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

         if (tfx.isTeam(tournament)) {
            eventTournamentTeams(e);
         } else {
            eventPlayers(e);
         }
      }

      function getKey(arr, value) {
         let pairs = arr.filter(a=>a.value == value);
         return pairs.length ? pairs[0].key : '';
      }

      function determineLinkedDraw(tournament, e, type, linkChanged) {
         if (!tournament.events || tournament.events.length < 1) return;

         // Doubles TODO: TEMPORARY until linking Doubles Draws works...
         if (e.format == 'D') return;

         var types = {
            'Q': ['Q', 'R'],
            'E': ['E', 'S'],
            'C': ['C'],
            'F': ['F'],
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

            if (e.draw_type == 'R' && e.draw && ['E', 'S'].indexOf(linked_event.draw_type) >= 0) {
               dfx.tallyBracketAndModifyPlayers({ matches: e.matches, qualifying: true });
            }

            if (linked_event && linked_event.draw_type == 'R') {
               console.log('must change RR round names for qualifying... ??');
            }

            let link = linked_event ? linked_event.draw_type : linkType(type);
            e.links[link] = value;

            // remove any previous links
            if (previous_link) {
               let previous_linked_event = tfx.findEventByID(tournament, previous_link);
               previous_linked_event.links[e.draw_type] = undefined;
               if (previous_linked_event.draw_type == 'R' && previous_linked_event.draw) {
                  dfx.tallyBracketAndModifyPlayers({ matches: e.matches, qualifying: false });
               }
               if (['R', 'Q'].indexOf(previous_linked_event.draw_type) >= 0) {
                  let edraw = e.draw && e.draw.compass ? e.draw.east : e.draw;
                  if (edraw) {
                     let draw_info = dfx.drawInfo(edraw);
                     draw_info.nodes.forEach(node => {
                        if (node.data && node.data.team) {
                           node.data.team.forEach(player => { if (player.entry == 'Q') player.entry = ''; });
                        }
                     });
                  }
                  if (['E', 'S'].indexOf(e.draw_type) >= 0) { e.regenerate = 'previousLink'; }
               } else if (['E', 'S'].indexOf(previous_linked_event.draw_type) >= 0) {
                  if (['R', 'Q'].indexOf(e.draw_type) >= 0) previous_linked_event.regenerate = 'previousLink';
               }
            }

            // link in the opposite direction as well...
            if (linked_event) {
               linked_event.links[e.draw_type] = e.euid;
               if (linked_event.draw_type == 'R') {
                  e.regenerate = 'link to qualifying';
                  tfx.determineRRqualifiers(tournament, linked_event);
               }
               if (linked_event.draw_type == 'Q') {
                  e.regenerate = 'link to qualifying';
                  checkForQualifiedTeams(linked_event);
               }
               if (['C', 'R', 'Q'].indexOf(linked_event.draw_type) >= 0) {
                  linked_event.rank = e.rank;
                  container.rank.ddlb.unlock();
               } else {
                  e.rank = linked_event.rank;
                  container.rank.ddlb.setValue(e.rank, 'white');
                  container.rank.ddlb.lock();
               }

               if (!e.approved) e.approved = [];

               let qualified;
               if (e.format == 'D') {
                  let dq = linked_event.qualified ? linked_event.qualified.map(teamHash) : [];
                  console.log('dq:', dq);
               } else {
                  qualified = linked_event.qualified ? linked_event.qualified.map(teamHash) : [];
               }

               if (e.draw_type != 'C') e.approved = [].concat(...e.approved, ...qualified);
            } else {
               e.qualifiers = 0;
               container.rank.ddlb.unlock();
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
         let qbs = env.drawFx.qualifying_bracket_seeding;
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
         var bracket_sizes = env.draws.rr_draw.brackets;
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

      function setRRqualifierRange(e) {
         if (!e) return;
         let min_qualifiers = (e.approved && e.approved.length ? 1 : 0) * e.brackets;
         let max_qualifiers = min_qualifiers * 3;
         let range = util.range(min_qualifiers, max_qualifiers + 1);
         let options = range.map(c => ({ key: c, value: c }));
         event_config.qualifiers.ddlb.setOptions(options);
         if (e.qualifiers > max_qualifiers) e.qualifiers = max_qualifiers;
         if (['Q', 'R'].indexOf(e.draw_type) >= 0) {
            event_config.qualifiers.ddlb.setValue(e.qualifiers);
            event_config.qualifiers.ddlb.selectionBackground(!e.qualifiers ? 'red' : 'white');
         } else if (['E', 'S'].indexOf(e.draw_type) >= 0 && e.links && e.links['R']) {
            let linked = tfx.findEventByID(tournament, e.links['R']);
            if (linked) event_config.qualifiers.ddlb.setValue(linked.qualifiers);
         }
      }

      function configDrawType(e) {
         function linkChanged() {
            console.log('link changed...');
            return eventPlayers(e);
         }
         var supported_structures = env.draws.structures;

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
            e.regenerate = 'structure change';
            drawsTab();
            saveTournament(tournament);
         }

         function removeStructure() {
            delete e.structure;
            delete e.feed_rounds;
            delete e.skip_rounds;
            delete e.sequential;
         }

         function toggleStructureConfig() {
            if (e.structure != 'feed') removeStructure();
            let disp = e.structure == 'feed' ? 'flex' : 'none';
            Array.from(container.draw_config.element.querySelectorAll('.feedconfig'))
               .forEach(o=>o.style.display = disp);
         }

         function setFeedRounds(value) {
            e.feed_rounds = value;
            e.regenerate = 'feed rounds';
            drawsTab();
            saveTournament(tournament);
         }

         function setSkipRounds(value) {
            e.skip_rounds = value;
            e.regenerate = 'skip rounds';
            drawsTab();
            saveTournament(tournament);
         }

         function setRoundLimit(value) {
            e.max_round = value ? value : undefined;
            if (e.draw) {
               e.draw.max_round = e.max_round;
               tree_draw.data(e.draw)();
            }
         }

         function roundLimitOptions(e) {
            let round_limit_options = [{ key: lang.tr('none'), value: ''}];
            if (!e.draw) return round_limit_options;
            let info = dfx.drawInfo(e.draw);
            let max_rounds = info.depth - 1;
            let min_rounds = (util.powerOfTwo(e.draw_size)) ? 1 : 2;
            let range = util.range(min_rounds, max_rounds + 1);
            return range.map(v => ({ key: v, value: v }));
         }

         function setQualifiers(value) {
            if (['Q', 'R'].indexOf(e.draw_type) >= 0) {
               e.qualifiers = +value;

               let linked = tfx.findEventByID(tournament, e.links['E']);
               if (linked) {
                  // remove any qualified players from linked draw approved
                  let qual_hash = !e.qualified ? [] : e.qualified.map(teamHash);
                  linked.approved = linked.approved.filter(a=>qual_hash.indexOf(a) < 0);
                  linked.regenerate = 'linkChanged number qualifiers';
               }

               e.qualified = [];
               // only need to regenerate if it is a tree structure qualification
               if (e.draw_type == 'Q') e.regenerate = 'linkChanged';
               if (e.draw_type == 'R' && linked) tfx.determineRRqualifiers(tournament, e);

               setTimeout(function() { event_config.qualifiers.ddlb.selectionBackground(!e.qualifiers ? 'red' : 'white'); }, 300);

            } else if (['E', 'S'].indexOf(e.draw_type) >= 0) {
               let link_types = Object.keys(e.links);
               let linkedRR = tfx.findEventByID(tournament, e.links['R']);
               if (linkedRR) {
                  linkedRR.qualifiers = +value;
                  // remove any qualified players from elimination draw
                  let qual_hash = !linkedRR.qualified ? [] : linkedRR.qualified.map(teamHash);
                  e.approved = e.approved.filter(a=>qual_hash.indexOf(a) < 0);
                  e.regenerate = 'linkChanged number qualifiers';
                  tfx.determineRRqualifiers(tournament, linkedRR);
               }
               displayEvent({e});
            }

            eventName(e);
            drawsTab();
            saveTournament(tournament);
         }

         function setQualificationConfig() {
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

            event_config.qualifiers.ddlb = new dd.DropDown({ element: event_config.qualifiers.element, onChange: setQualifiers });
            event_config.qualifiers.ddlb.setValue(e.qualifiers || 0, 'white');

            if (env.draws.tree_draw.round_limits) {
               Array.from(container.draw_config.element.querySelectorAll('.roundlimit')).forEach(o=>o.style.display = 'flex');
               event_config.roundlimit.ddlb = new dd.DropDown({ element: event_config.roundlimit.element, onChange: setRoundLimit });
               event_config.roundlimit.ddlb.setValue(e.max_round || '-', 'white');
               // let round_limit_options = [{ key: lang.tr('none'), value: ''}, { key: 1, value: 1 }, { key: 2, value: 2 }, { key: 3, value: 3 }];
               let round_limit_options = roundLimitOptions(e);
               event_config.roundlimit.ddlb.setOptions(round_limit_options);
            }

            if (e.feed_rounds == undefined) e.feed_rounds = 0;
            event_config.feedrounds.ddlb = new dd.DropDown({ element: event_config.feedrounds.element, onChange: setFeedRounds });
            event_config.feedrounds.ddlb.setValue(e.feed_rounds, 'white');
            event_config.skiprounds.ddlb = new dd.DropDown({ element: event_config.skiprounds.element, onChange: setSkipRounds });
            event_config.skiprounds.ddlb.setValue(e.skip_rounds || 0, 'white');
            event_config.sequential.ddlb = new dd.DropDown({ element: event_config.sequential.element, onChange: setSkipRounds });
            event_config.sequential.ddlb.setValue(e.sequential || 1, 'white');

            // special override for elimination draws
            let linkValue = () => {
               displayQualifiers();
               linkChanged();
            }

            determineLinkedDraw(tournament, e, 'Q', linkValue);
            if (env.drawFx.consolation_from_elimination) determineLinkedDraw(tournament, e, 'C', linkChanged);

            function displayQualifiers() {
               let display = e.links && e.links['R'] ? 'flex' : 'none';
               let cfg = d3.select(container.draw_config.element);
               cfg.selectAll('.qualifiers').style('display', display);
               let linkedRR = tfx.findEventByID(tournament, e.links['R']);
               setRRqualifierRange(linkedRR);
               eventList(true);
            }

            if (e.links && e.links['R']) displayQualifiers();
         }

         function setPlayoffConfig() {
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

            // let round_limit_options = [{ key: '-', value: ''}, { key: 1, value: 1 }, { key: 2, value: 2 }, { key: 3, value: 3 }];
            let round_limit_options = roundLimitOptions(e);
            event_config.roundlimit.ddlb.setOptions(round_limit_options);

            event_config.structure.ddlb = new dd.DropDown({ element: event_config.structure.element, onChange: setStructure });
            event_config.structure.ddlb.setValue(e.structure || 'standard', 'white');

            if (e.feed_rounds == undefined) e.feed_rounds = 0;
            event_config.feedrounds.ddlb = new dd.DropDown({ element: event_config.feedrounds.element, onChange: setFeedRounds });
            event_config.feedrounds.ddlb.setValue(e.feed_rounds, 'white');
            event_config.skiprounds.ddlb = new dd.DropDown({ element: event_config.skiprounds.element, onChange: setSkipRounds });
            event_config.skiprounds.ddlb.setValue(e.skip_rounds || 0, 'white');

            delete e.sequential;

            if (env.drawFx.consolation_from_elimination) determineLinkedDraw(tournament, e, 'E', linkChanged);
            if (env.drawFx.consolation_from_qualifying) determineLinkedDraw(tournament, e, 'Q', linkChanged);
         }

         function setRoundRobinConfig() {
            let { options, size_options } = roundRobinDrawBracketOptions(e);

            event_config = displayGen.configRoundRobinDraw(container, e, options, size_options);
            event_config.qualifiers.ddlb = new dd.DropDown({ element: event_config.qualifiers.element, onChange: setQualifiers });
            event_config.qualifiers.ddlb.setValue(e.qualifiers || e.brackets, 'white');
            e.qualifiers = e.qualifiers || e.brackets;
            event_config.qualifiers.ddlb.selectionBackground(!e.qualifiers ? 'red' : 'white');

            let setBracketSize = (value) => {
               warnIfCreated(e).then(doIt, cancelAction);
               function cancelAction() { event_config.bracket_size.ddlb.setValue(e.bracket_size, 'white'); }
               function doIt() {
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

                  setRRqualifierRange(e);
                  e.regenerate = 'bracketSize';
                  eventList(true);
               }
            }

            let setBrackets = (value) => {
               warnIfCreated(e).then(doIt, cancelAction);
               function cancelAction() { event_config.brackets.ddlb.setValue(e.brackets, 'white'); }
               function doIt() {
                  e.brackets = value;
                  e.qualifiers = e.brackets;
                  setRRqualifierRange(e);
                  e.regenerate = 'setBrackets';
                  eventList(true);
               }
            }

            event_config.brackets.ddlb = new dd.DropDown({ element: event_config.brackets.element, onChange: setBrackets });
            event_config.brackets.ddlb.setValue(e.brackets, 'white');

            event_config.bracket_size.ddlb = new dd.DropDown({ element: event_config.bracket_size.element, onChange: setBracketSize });
            event_config.bracket_size.ddlb.setValue(e.bracket_size, 'white');

            let displayQualifiers = (bool) => {
               let display = bool ? 'flex' : 'none';
               let cfg = d3.select(container.draw_config.element);
               cfg.selectAll('.qualifiers').style('display', display);
               setRRqualifierRange(e);
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
            'S': () => setEliminationConfig(),
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

      // TODO: break this out into tmxMaps.js and hide all fx specific to google or leaflet
      function locationMap({ element_id, coords, zoom }) {
         zoom = (zoom == undefined) ? 16 : zoom;
         if (coords.latitude != undefined && coords.longitude != undefined) {
            container.location_map.element.style.display = 'inline';
            return gpsLocation(coords.latitude, coords.longitude, zoom);
         } else {
            return {};
         }

         function gpsLocation(lat, lng, zoom) {
            let view = 'satellite';
            let layer = L.tileLayer(env.leaflet[view].tileLayer, { attribution: env.leaflet[view].attribution, maxZoom: env.leaflet[view].maxZoom });
            let map = L.map(element_id).setView([+lat, +lng], zoom).addLayer(layer);
            let marker = L.marker([+lat, +lng]).addTo(map);
           
            // necessary to make the map fill the parent element
            setTimeout(function() { map.invalidateSize(); }, 300);

            return { map, marker };
         }
      }

      function configureLocationAttributes(l) {
         let disabled = !state.edit
         let attributes = displayGen.displayLocationAttributes(container, l, state.edit);

         let zoom = 16;
         let coords = { latitude: l.latitude, longitude: l.longitude };
         if (env.locations.geoposition && (!coords.latitude || !coords.longitude)) coords = env.locations.geopostion.coords;
         if (!coords.latitude && !coords.longitude) {
            zoom = 2;
            coords = { latitude: 0, longitude: 0 };
         }
         let { map, marker } = locationMap({ element_id: attributes.map.id, coords, zoom });

         let field_order = [ 'abbreviation', 'courts', 'identifiers', 'latitude', 'longitude', 'name', 'address' ];
         let constraints = { 'abbreviation': { length: 3}, 'name': { length: 4 }, 'address': { length: 5 }, 'courts': { number: true }, 'latitude': { float: true }, 'longitude': { float: true } };
         field_order.forEach(field => {
            attributes[field].element.addEventListener('keydown', catchTab, false);
            attributes[field].element.value = l[field] || '';
            attributes[field].element.disabled = disabled;
            attributes[field].element.style.border = disabled ? 'none' : '';
            attributes[field].element.addEventListener('keyup', (evt) => defineAttr(field, evt, constraints[field]));
            defineAttr(field, undefined, constraints[field], attributes[field].element);
         });

         setTimeout(function() { attributes.abbreviation.element.focus(); }, 50);

         if (map && state.edit) {
            map.on('click', function(e) {
               let lat = (e.latlng.lat);
               let lng = (e.latlng.lng);
               let newLatLng = new L.LatLng(lat, lng);
               marker.setLatLng(newLatLng);
               let message = 'Update Latitude/Longitude?';
               displayGen.okCancelMessage(message, () => setLatLng(lat, lng), ()=>displayGen.closeModal());
            });

            map.on("contextmenu", function (event) {
              console.log("Coordinates: " + event.latlng.toString());
              // L.marker(event.latlng).addTo(map);
            });
         }

         function setLatLng(lat, lng) {
            l.latitude = lat;
            l.longitude = lng;
            attributes.latitude.element.value = lat;
            attributes.longitude.element.value = lng;
            map.setView(new L.LatLng(+l.latitude, +l.longitude), 16);
            saveTournament(tournament);
            displayGen.closeModal();
         }

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
            if (evt && evt.which == 13 && map && ['latitude', 'longitude'].indexOf(attr) >= 0) {
               map.setView(new L.LatLng(+l.latitude, +l.longitude), 16);
            }
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
                  if (required.float) {
                     if (value.length && value.split('').reverse()[0] == '.') {
                        valid = false;
                     } else if (!isNaN(value)) {
                        element.value = value;
                        l[attr] = element.value;
                        valid = true;
                     }
                  }
               }
               attributes[attr].element.style.background = valid ? 'white' : 'yellow';
            }
            let increment = (evt && evt.which == 9 && evt.shiftKey) ? -1 : 1;
            if (evt && (evt.which == 13 || evt.which == 9)) nextFieldFocus(attr, increment);
         }
      }

      function consolationWildcards(evt, e) {
         if (!env.drawFx.consolation_wildcards) return;
         let linked = Object.keys(e.links)[0];
         let linked_event = linked && tfx.findEventByID(tournament, e.links[linked]);
         let filter_group = linked_event ? linked_event.approved : e.approved;
         let wcteams = tournament.players.filter(p=>filter_group.indexOf(p.id)<0).map(p=>[p]);
         let teams = pfx.optionNames(wcteams, 'WC');
         let clickAction = (d, i) => {
            let wcteam = wcteams[i].map(player => Object.assign({}, player))[0];
            if (!e.wildcards) e.wildcards = [];
            e.wildcards.push(wcteam.id);
            modifyApproved.push(e, wcteam.id);
            saveTournament(tournament);
            outOfDate(e);
         }
         displayGen.svgModal({ x: evt.clientX, y: evt.clientY, options: teams, callback: clickAction });
      }

      function eligibleOptions(evt, e) {
         if (!e || !e.draw) return;
         if (e.draw_type == 'C') return consolationWildcards(evt, e);
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

         let teams = pfx.optionNames(losers, 'LL');
         let clickAction = (d, i) => {
            let loser = losers[i].map(player => Object.assign({}, player))[0];
            if (!e.luckylosers) e.luckylosers = [];
            e.luckylosers.push(loser.id);
            modifyApproved.push(e, loser.id);
            saveTournament(tournament);
            outOfDate(e);
         }
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
         if (e) {
            if (tfx.isTeam(tournament)) {
               e.name = lang.tr('events.teamevent');
               e.broadcast_name = `${e.custom_category || e.category || ''} ${lang.tr('events.teamevent')}`;
            } else {
               e.name = `${getKey(genders, e.gender)} ${getKey(formats, e.format)}`;
               e.broadcast_name = `${e.custom_category || e.category || ''} ${getKey(genders, e.gender)} ${getKey(formats, e.format)}`;
            }
            displayGen.setEventName(container, e);
            eventList();
         }
      }

      function configureEventSelections(e) {
         try {
            if (tournament.type == 'dual') {
               configureDualEventSelections(e);
            } else {
               configureStandardEventSelections(e);
            }
         }
         catch (err) {
            tfx.logEventError(e, err, 'configureEventSelections');
            displayGen.okCancelMessage('Event is corrupted', () => displayGen.closeModal());
         }
      }

      // modify dual matches instances to match e.matchorder
      function orderDualMatchesDraw(e) {
         Object.keys((e.draw && e.draw.dual_matches) || {}).forEach(muid => orderDualMatch(e, muid));
      }

      // modify dual match instance to match e.matchorder
      function orderDualMatch(e, muid) {
         if (e.draw && !e.active) {
            if (!e.draw.dual_matches) e.draw.dual_matches = {};
            if (!e.draw.dual_matches[muid]) e.draw.dual_matches[muid] = { matches: [] };
            let omatches = e.matchorder.length;
            // currently the matches are replaced with every change in order
            let matches = [];
            let counters = { singles: 0, doubles: 0 };
            let round_name = e.draw.dual_matches[muid].round_name || '';
            util.numArr(omatches).forEach((a, i) => {
               let order = i;
               let match = Object.assign({}, e.matchorder[order]);
               counters[match.format] += 1;
               match.sequence = counters[match.format];
               match.round_name = round_name;
               match.match = {
                  muid: UUID.new(),
                  euid: e.euid,
                  round_name: round_name,
               }
               matches.push(match);
            });
            e.draw.dual_matches[muid].matches = matches;
         }
      }

      function configureDualEventSelections(e) {
         if (!e.matchlimits) e.matchlimits = { singles: 6, doubles: 3 };
         if (!e.matchorder) {
            e.matchorder = [
               { format: 'singles', value: 1 },
               { format: 'singles', value: 1 },
               { format: 'singles', value: 1 },
               { format: 'singles', value: 1 },
               { format: 'singles', value: 1 },
               { format: 'singles', value: 1 },
               { format: 'doubles', value: 1 },
               { format: 'doubles', value: 1 },
               { format: 'doubles', value: 1 },
            ];
         }

         let details = displayGen.displayDualMatchConfig({
            tournament,
            container,
            e,
            matchorder: e.matchorder,
            inout,
            surfaces,
            formats,
            draw_types: availableDrawTypes(e),
            edit: state.edit
         });

         updateDualMatchDetails();

         details.category.ddlb = new dd.DropDown({ element: details.category.element, onChange: filterCategory, locked: true });
         details.category.ddlb.selectionBackground('white');
         if (e.category || tournament.category) {
            let ctgy = e.category || tournament.category;
            details.category.ddlb.setValue(ctgy, 'white');
         }

         details.rank.ddlb = new dd.DropDown({ element: details.rank.element, onChange: setRank, locked: true });
         if (e.rank) {
            details.rank.ddlb.setValue(e.rank, 'white');
         } else {
            details.rank.ddlb.selectionBackground('white');
         }

         details.surface.ddlb = new dd.DropDown({ element: details.surface.element, onChange: setSurface, locked: true });
         let preset = e.surface || tournament.surface || 'C';
         details.surface.ddlb.setValue(preset.toUpperCase()[0], 'white');

         details.inout.ddlb = new dd.DropDown({ element: details.inout.element, onChange: setInOut, locked: true });
         details.inout.ddlb.setValue(e.inout || tournament.inout || '', 'white');

         details.singles_limit.element.addEventListener('click', () => changeLimit('singles'));
         details.doubles_limit.element.addEventListener('click', () => changeLimit('doubles'));

         let singles_limit = details.singles_limit.element.querySelector('.matchlimit');
         let doubles_limit = details.doubles_limit.element.querySelector('.matchlimit');
         singles_limit.addEventListener('keydown', catchTab);
         doubles_limit.addEventListener('keydown', catchTab);
         singles_limit.addEventListener('keyup', (evt) => editLimit(evt, 'singles'));
         doubles_limit.addEventListener('keyup', (evt) => editLimit(evt, 'doubles'));
         singles_limit.addEventListener('focusout', (evt) => endEditLimit(evt, 'singles'));
         doubles_limit.addEventListener('focusout', (evt) => endEditLimit(evt, 'doubles'));

         displayFormatLimit('singles', e.matchlimits);
         displayFormatLimit('doubles', e.matchlimits);

         details.singles_scoring.element.addEventListener('click', () => changeScoring('singles'));
         details.doubles_scoring.element.addEventListener('click', () => changeScoring('doubles'));

         displayFormatScoring('singles', e.scoring_format);
         displayFormatScoring('doubles', e.scoring_format);

         function displayFormatLimit(format, matchlimits) {
            let limit = (matchlimits && matchlimits[format]) || 0;
            let entry_field = details[`${format}_limit`].element.querySelector('.matchlimit');
            if (entry_field) entry_field.value = limit;
         }

         function changeLimit(format) {
            if (state.edit && !e.active) {
               let entry_field = details[`${format}_limit`].element.querySelector('.matchlimit');
               entry_field.disabled = false;
               entry_field.focus();
               entry_field.select();
            }
         }

         function endEditLimit(evt, format) {
            let entry_field = details[`${format}_limit`].element.querySelector('.matchlimit');
            entry_field.disabled = true;
            e.score_goal = tfx.getDualEventScoreGoal(evt);
            matchLimits(format, entry_field.value || 0); 
            clearSelection();
         }

         function editLimit(evt, format) {
            let edit_field = evt.target;
            if (isNaN(edit_field.value)) return edit_field.value = 0;
            if (evt.which == 13) {
               edit_field.value = parseInt(edit_field.value || 0);
               endEditLimit(evt, format);
            }
         }

         function displayFormatScoring(format, scoring_format) {
            let sf = scoring_format && scoring_format[format];
            let stb = sf && sf.final_set_supertiebreak ? '/S' : '';
            let scoring = sf ? `${sf.max_sets}/${sf.games_for_set}/${sf.tiebreak_to}T${stb}` : format=='singles' ? '3/6/7T' : '3/6/7T/S';
            details[`${format}_scoring`].element.innerHTML = scoring;
         }

         function changeScoring(format) {
            if (state.edit) {
               if (!e.scoring_format) e.scoring_format = {};
               document.body.style.overflow  = 'hidden';
               let cfg_obj = scoreBoard.scoreBoardConfig();
               let sb_config = d3.select(cfg_obj.config.element);

               let ctgy = e.category || tournament.category;
               let stg = Object.assign({}, tfx.getScoreboardSettings({ category: ctgy, format }), e.scoring_format[format]);
               scoreBoard.configureScoring({ sobj: cfg_obj, stg });
               sb_config.on('click', removeConfigScoring);
               cfg_obj.cancel.element.addEventListener('click', removeConfigScoring)
               cfg_obj.accept.element.addEventListener('click', () => tfx.modifyEventScoring({ cfg_obj, tournament, evt: e, callback: finish, format }))

               function finish() {
                  saveTournament(tournament);
                  removeConfigScoring();
               }

               function removeConfigScoring() {
                  displayFormatScoring(format, e.scoring_format);
                  sb_config.remove();
                  document.body.style.overflow = null;
               }
            }
         }

         function filterCategory(value) {
            if (e.category != value) { e.regenerate = 'filterCategory'; }
            e.category = value;
            e.ratings = getCategoryRatings(e.category);
            eventName(e);
         }

         function setRank(value) {
            e.rank = value; 
            matchesTab();
            eventList(true);
            saveTournament(tournament);
         }

         function setSurface(value) {
            e.surface = value; 
            eventList(true);
            saveTournament(tournament);
         }

         function setInOut(value) {
            e.inout = value; 
            eventList(true);
            saveTournament(tournament);
         }

         function matchLimits(format, value) {
            if (!e.matchlimits) e.matchlimits = {}
            e.matchlimits[format] = parseInt(value);
            modifyMatchOrder(format, parseInt(value));
            orderDualMatchesDraw(e);
            if (displayed.dual_match) {
               displayDualMatches(displayed.dual_match);
               tree_draw.data(e.draw)();
            }
            eventList(true);
            saveTournament(tournament);
         }

         function modifyMatchOrder(format, limit) {
            let counter = 0;
            let matchorder = e.matchorder.filter(m => {
               counter += m.format == format;
               return (m.format == format && counter > limit) ? false : true;
            });
            util.range(1, limit - counter + 1).forEach(n => matchorder.push({ format, value: 1 }));
            e.matchorder = matchorder;
            updateDualMatchDetails();
            eventOpponents(e);
         }

         if (state.edit || !e.active) {
            details.category.ddlb.unlock();
            details.surface.ddlb.unlock();
            details.inout.ddlb.unlock();
            details.rank.ddlb.unlock();
         }

         function updateDualMatchDetails() {
            let dual_match_details = displayGen.displayDualMatchDetails({ container, e, matchorder: e.matchorder, edit: state.edit });
            Object.assign(container, dual_match_details);

            var current_index;
            var dragSrcEl = null;

            function handleDragStart(e) {
              dragSrcEl = this;
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/html', this.outerHTML);
            }
            function handleDragOver(e) {
              if (e.preventDefault) e.preventDefault();
              this.classList.add('over');
              e.dataTransfer.dropEffect = 'move';
              return false;
            }

            function handleDragEnter(e) {
              // this / e.target is the current hover target.
            }

            function handleDragLeave(e) { this.classList.remove('over'); }

            function handleDrop(e) {
               if (e.stopPropagation) { e.stopPropagation(); }

               if (dragSrcEl != this) {
                  this.parentNode.removeChild(dragSrcEl);
                  var dropHTML = e.dataTransfer.getData('text/html');
                  this.insertAdjacentHTML('beforebegin',dropHTML);
                  renameMatchBlocks();
                  regenMatchValues();
               }
               this.classList.remove('over');

               return false;
            }

            function renameMatchBlocks() {
               let matchorder = [];
               let matchblocks = Array.from(container.detail_opponents.element.querySelectorAll('.team_match'));
               let counters = { singles: 0, doubles: 0 };
               matchblocks.forEach((b, i) => {
                  let matchname = b.querySelector('.matchname');
                  let format = matchname.classList.contains('doubles') ? 'doubles' : 'singles';
                  let gender = matchname.classList.contains('M') ? 'M' : matchname.classList.contains('W') ? 'W' : matchname.classList.contains('X') ? 'X' : '';
                  let display_format = format == 'doubles' ? lang.tr('dbl') : lang.tr('sgl');
                  counters[format] += 1;
                  matchname.innerText = `#${counters[format]} ${display_format}`;
                  let matchvalue = b.querySelector('.matchvalue');
                  matchvalue.setAttribute('index', i);
                  matchorder.push({ format, value: matchvalue.value, gender });
               });
               e.matchorder = matchorder;
               saveTournament(tournament);
            }

            function handleDragEnd(e) { this.classList.remove('over'); }

            function addDragDropHandlers(elem) {
              elem.addEventListener('dragstart', handleDragStart, false);
              elem.addEventListener('dragenter', handleDragEnter, false)
              elem.addEventListener('dragover', handleDragOver, false);
              elem.addEventListener('dragleave', handleDragLeave, false);
              elem.addEventListener('drop', handleDrop, false);
              elem.addEventListener('dragend', handleDragEnd, false);
            }

            var tmatches = container.detail_opponents.element.querySelectorAll('.team_match');
            if (!e.active) {
               [].forEach.call(tmatches, addDragDropHandlers);

               util.addEventToClass('matchvalue', matchValue, container.detail_opponents.element, 'keyup');
               util.addEventToClass('matchvalue', catchTab, container.detail_opponents.element, 'keydown');
               util.addEventToClass('team_match', disableAllMatchValue, container.detail_opponents.element, 'focusout');
               util.addEventToClass('team_match', enableMatchValue, container.detail_opponents.element, 'click');
               util.addEventToClass('team_match', cycleGender, container.detail_opponents.element, 'contextmenu');
            }

            function cycleGender(evt) {
               let team_match = util.getParent(evt.target, 'team_match');
               let matchgender = team_match && team_match.querySelector('.matchgender');
               let matchvalue = team_match && team_match.querySelector('.matchvalue');
               let matchname = team_match && team_match.querySelector('.matchname');
               let valuedivs = team_match && team_match.querySelectorAll('.value');
               let index = matchgender && matchgender.getAttribute('index');
               if (matchgender.value == 'M') {
                  matchgender.value = 'W';
               } else if (matchgender.value == 'W') {
                  matchgender.value = 'X';
               } else if (matchgender.value == 'X') {
                  matchgender.value = '';
               } else if (!matchgender.value) {
                  matchgender.value = 'M';
               }
               e.matchorder[index].gender = matchgender.value;
               let background = e.matchorder[index].gender || e.matchorder[index].format;
               matchgender.classList = `matchgender ${background}`;
               matchvalue.classList = `matchvalue ${background}`;
               matchname.classList = `matchname ${background}`;
               Array.from(valuedivs).forEach(div => div.classList = `value ${background}`);
               saveTournament(tournament);
            }

            function enableMatchValue(evt) {
               if (state.edit) {
                  let team_match = util.getParent(evt.target, 'team_match');
                  let matchvalue = team_match && team_match.querySelector('.matchvalue');
                  let index = matchvalue && matchvalue.getAttribute('index');
                  if (matchvalue) {
                     if (current_index == index) cycleGender(evt); 
                     if (matchvalue.disabled) {
                        disableAllMatchValue();
                        matchvalue.disabled = false;
                        matchvalue.focus();
                        matchvalue.select();
                        current_index = index;
                     }
                  }
               }
            }

            function regenMatchValues() {
               let active = document.activeElement;
               updateDualMatchDetails();
               eventOpponents(e);
            }

            function disableAllMatchValue() {
               Array.from(document.querySelectorAll('.matchvalue'))
                  .forEach(elem=>{ elem.disabled=true; elem.classList.remove('white'); elem.value = parseInt(elem.value || 1) });
               clearSelection();
            }

            function matchValue(evt) {
               if (isNaN(evt.target.value)) return evt.target.value = 1;
               if (evt.which == 13 || evt.which == 9) {
                  evt.target.style.background = '';
                  evt.target.disabled = true;
                  let index = evt.target.getAttribute('index');
                  e.matchorder[index].value = parseInt(evt.target.value || 1);
                  evt.target.value = e.matchorder[index].value;
                  saveTournament(tournament);
                  clearSelection();
               }
               evt.target.value = util.numeric(evt.target.value) || '';
               evt.target.setAttribute('value', util.numeric(evt.target.value) || '');
            }
         }
      }

      function configureStandardEventSelections(e) {
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

         // TODO: long press
         container.eligible.element.addEventListener('contextmenu', evt=>eligibleOptions(evt,e));
         container.eligible.element.addEventListener('click', (evt) => { if (evt.ctrlKey || evt.shiftKey) return eligibleOptions(evt, e); });

         util.addEventToClass('addall', addAll, container.detail_opponents.element);
         util.addEventToClass('removeall', removeAll, container.detail_opponents.element);
         util.addEventToClass('promoteall', promoteAll, container.detail_opponents.element);

         let filterGender = (value) => {
            if (e.gender != value) { e.regenerate = 'filterGender'; }
            e.gender = value;
            configDrawType(e);
            eventPlayers(e);
            eventName(e);
            saveTournament(tournament);
         }
         details.gender.ddlb = new dd.DropDown({ element: details.gender.element, onChange: filterGender });
         details.gender.ddlb.setValue(e.gender || '', 'white');

         let filterCategory = (value) => {
            if (e.category != value) { e.regenerate = 'filterCategory'; }
            e.category = value;
            e.ratings = getCategoryRatings(e.category);
            eventPlayers(e);
            eventName(e);
            saveTournament(tournament);
         }
         details.category.ddlb = new dd.DropDown({ element: details.category.element, onChange: filterCategory });
         details.category.ddlb.selectionBackground('white');
         if (e.category || tournament.category) {
            let ctgy = e.category || tournament.category;
            details.category.ddlb.setValue(ctgy, 'white');
         }

         let setFormat = (value) => { 
            // cleanup
            delete e.teams;
            modifyApproved.removeAll(e);

            e.regenerate = 'setFormat';
            e.format = value; 

            let category = e.category || tournament.category;
            let format = e.format == 'D' ? 'doubles' : 'singles';
            e.score_format = tfx.getScoreboardSettings({ format, category });
            e.scoring = scoreBoard.getScoring(e.score_format);
            displayScoring(e.scoring);

            eventName(e);
            configDrawType(e);
            enableEventTeams(e);
            saveTournament(tournament);
            outOfDate(e);
         }

         details.format.ddlb = new dd.DropDown({ element: details.format.element, onChange: setFormat });
         if (e.format || tournament.format) details.format.ddlb.setValue(e.format || tournament.format, 'white');
         details.format.ddlb.setValue(e.format || 'S', 'white');

         // let doubles_rr = getEnv().draws.rr_draw.doubles;
         let doubles_rr = env.draws.rr_draw.doubles;
         if (e.draw_type == 'R' &&  !doubles_rr) details.format.ddlb.lock();

         let setRank = (value) => {
            e.rank = value; 
            matchesTab();
            eventList(true);
            if (['E', 'S'].indexOf(e.draw_type) >= 0 && e.links && Object.keys(e.links).length) {
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
            warnIfCreated(e).then(doIt, () => { return; });
            function doIt() {
               if (e.draw_type != value) { e.regenerate = 'setDrawType'; }
               e.draw_type = value; 

               // clean up any existing links/references
               e.links = {};
               removeReferences(e);

               // there can't be any approved players when switching draw type to consolation
               if (value == 'C') e.approved = [];

               if (value == 'R' && !doubles_rr) {
                  e.format = 'S';
                  details.format.ddlb.setValue('S', 'white');
                  details.format.ddlb.lock();
                  enableEventTeams(e);
               } else {
                  details.format.ddlb.unlock();
               }

               configDrawType(e);
               eventName(e);
               saveTournament(tournament);
            }
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

               let ctgy = e.category || tournament.category;
               let stg = Object.assign({}, tfx.getScoreboardSettings({ category: ctgy, format: e.score_format }), e.score_format);
               scoreBoard.configureScoring({ sobj: cfg_obj, stg });
               sb_config.on('click', removeConfigScoring);
               cfg_obj.cancel.element.addEventListener('click', removeConfigScoring)
               cfg_obj.accept.element.addEventListener('click', () => tfx.modifyEventScoring({ cfg_obj, tournament, evt: e, callback: finish }))

               function finish() {
                  saveTournament(tournament);
                  removeConfigScoring();
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
                  let lock = (state.edit && ['R', 'E', 'S'].indexOf(e.draw_type) >= 0 && key == 'qualifiers') ? false : true;
                  if (event_config[key].ddlb && lock) event_config[key].ddlb.lock(); 
               });
            }
         }
      }

      /**
       * @params {obj}  evt   event object
       *
       * if event has been created confirm that draw will be regenerated if proceeding with player/team changes
       * don't warn if the draw size is 2 because draw size 2 is always automatically generated
       */
      function warnIfCreated(evnt) {
         return new Promise((resolve, reject) => {
            if (evnt.draw_created && (!evnt.approved || evnt.approved.length != 2)) {
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
            e.regenerate = 'modify: promoteTeams';
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
         function approvedHash(team) { return team.sort().join('|'); }
         function notApproved(team) { return approved_hash.indexOf(approvedHash(team)) < 0; }
         function notWC(team) { return !e.wildcards || e.wildcards.indexOf(approvedHash(team)) < 0; }
         function notLL(team) { return !e.luckylosers || e.luckylosers.indexOf(approvedHash(team)) < 0; }
         var not_promoted = e.teams.filter(team => notApproved(team) && notWC(team) && notLL(team));

         var dbls_rankings = tournament.players.reduce((p, c) => c.category_dbls || p, false);
         var teams = not_promoted.map(t=>tfx.teamObj(e, t, idmap)).sort(tfx.combinedRankSort);
         teams.forEach(team => team.rank = team.combined_rank || team.combined_dbls_rank);

         return teams;
      }

      function checkForQualifiedTeams(e) {
         if (e.draw_type != 'Q') return;
         let qualifiers = e.draw && dfx.drawInfo(e.draw).final_round_players;
         let qualified = qualifiers ? qualifiers.filter(f=>f) : [];
         qualified.forEach(team => tfx.qualifyTeam({ tournament, env, e, team }));
      }

      function generateDraw(e, delete_existing) {
         try { drawGeneration(e, delete_existing); }
         catch (err) { tfx.logEventError(e, err, 'drawGeneration'); }
      }

      function drawGeneration(e, delete_existing) {
         var approved_opponents = tfx.approvedOpponents({ tournament, e });

         // delete any existing draw AFTER capturing any player data (entry information)
         if (delete_existing) delete e.draw;

         if (!approved_opponents.length) {
            delete e.draw;
            return;
         }

         var draw_type = e.draw_type == 'R' ? 'rr_draw' : 'tree_draw';

         var seeded_teams = dfx.seededTeams({ teams: approved_opponents });
         var seed_limit = Math.min(Object.keys(seeded_teams).length, dfx.seedLimit(approved_opponents.length));

         if (e.draw_type == 'Q') seed_limit = tfx.qualifierSeedLimit({ env, e }) || seed_limit;

         var num_players = approved_opponents.length;

         tree_draw.options({ draw: { feed_in: e.structure == 'feed' }});
         tree_draw.options({ max_round: undefined, seeds: { limit: seed_limit } });
         tree_draw.options({ flags: { path: env.assets.flags }});

         let qualification = () => {
            let draw_size = dfx.acceptedDrawSizes(num_players, true);
            if (!meetsMinimums(draw_size)) return;

            if ([1, 2, 4, 8, 16, 32, 64].indexOf(e.qualifiers) >= 0) {
               e.draw = dfx.buildDraw({ teams: draw_size });
               e.draw.max_round = util.log2(util.nearestPow2(draw_size)) - util.log2(e.qualifiers);
               e.draw.seeded_teams = seeded_teams;
               if (env.drawFx.qualifying_bracket_seeding) {
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

            let preround = tfx.isPreRound({ env, e: displayed.draw_event });
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

               // let seed_positions = getEnv().draws.tree_draw.seeds.restrict_placement;
               let seed_positions = env.draws.tree_draw.seeds.restrict_placement;

               e.draw_size = dfx.acceptedDrawSizes(num_players);
               if (!meetsMinimums(e.draw_size)) return;
               // build a blank draw 
               // TODO:  why is this == 12 ???!!???
               let structural_byes = e.draw_size == 12 ? dfx.structuralByes(e.draw_size, true) : undefined;
               e.draw = dfx.buildDraw({ teams: e.draw_size, structural_byes });

               if (!e.draw_size) return;

               // has to be defined after draw is built
               e.draw.qualifiers = e.qualifiers || 0;

               e.draw.max_round = e.max_round;
               e.draw.unseeded_placements = [];
               e.draw.opponents = approved_opponents;

               if (!seed_positions) {
                  e.draw.unseeded_teams = tfx.teamSort(e.draw.opponents);
                  testLastSeedPosition(e);
               } else {
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

                  if (e.automated || e.draw_size == 2) {
                     dfx.placeSeedGroups({ draw: e.draw });
                     dfx.distributeByes({ draw: e.draw });
                     dfx.distributeQualifiers({ draw: e.draw });
                     dfx.placeUnseededTeams({ draw: e.draw });
                     dfx.advanceTeamsWithByes({ draw: e.draw });
                     if (e.draw_type == 'Q') checkForQualifiedTeams(e);
                     drawCreated(e);
                     eventList();
                  } else {
                     testLastSeedPosition(e);
                  }
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
            e.draw.east.qualifiers = e.qualifiers || 0;

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

               var consolation_seeding = env.drawFx.consolation_seeding;
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
                  eventList();
               } else {
                  testLastSeedPosition(e);
               }
            }
         }

         function emptyBrackets(num = 1) {
            return util.range(0, num).map(bracket => { return {
               puids:   [],
               teams:   [],
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
            }
         }

         let drawTypes = {
            'Q': () => qualification(),
            'E': () => elimination(),
            'R': () => roundrobin(),
            'C': () => consolation(),
            'P': () => consolation(), // playoff
            'S': () => compass(),
         }

         if (drawTypes[e.draw_type] && !e.active) drawTypes[e.draw_type](); 

         function meetsMinimums(draw_size) {
            var minimums = env.draws[draw_type].minimums;
            var minimum_draw_size = e.draw_type == 'P' ? 2 : tfx.isTeam(tournament) ? minimums.team : e.format == 'D' ? minimums.doubles : minimums.singles;
            let meets_minimum = (draw_size >= minimum_draw_size);
            if (!meets_minimum) delete e.draw;
            return meets_minimum;
         }
      }

      function eventOpponents(e) {
         if (tfx.isTeam(tournament)) {
            eventTournamentTeams(e);
         } else {
            eventPlayers(e);
         }
      }

      function eventTournamentTeams(e) {
         let approved = [];

         let ineligible = tfx.ineligibleTeams(tournament, e);
         let unavailable = tfx.unavailableTeams(tournament, e);
         let eligible = tfx.eligibleTeams(tournament, e, ineligible_teams, unavailable_teams);

         let ineligible_teams = ineligible.teams;
         let unavailable_teams = unavailable.teams;
         let eligible_teams = eligible.teams || [];

         let approved_changed = ineligible.changed || unavailable.changed || eligible.changed;

         if (approved_changed) approvedChanged(e);

         approved = tfx.approvedTournamentTeams({ tournament, e });

         displayGen.displayEventTeams({
            approved,
            container,
            eligible: eligible_teams,
         });


         util.addEventToClass('tt_click', changeGroup, container.event_details.element);

         let addAll = () => modifyApproved.addAll(e);
         let removeAll = () => modifyApproved.removeAll(e);

         util.addEventToClass('addall', addAll, container.detail_opponents.element);
         util.addEventToClass('removeall', removeAll, container.detail_opponents.element);

         function changeGroup(evt) {
            if (!state.edit || e.active) return;
            let grouping = util.getParent(evt.target, 'opponent_container').getAttribute('grouping');
            let elem = util.getParent(evt.target, 'tt_click');
            let uuid = elem.getAttribute('uuid');

            warnIfCreated(e).then(doIt, () => { return; });

            function doIt() {
               if (grouping == 'eligible') modifyApproved.push(e, uuid);
               if (grouping == 'approved') modifyApproved.removeID(e, uuid);
            }
         }

         eventList(true);
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

         if (e.format == 'D') {
            eligible_players.forEach(p => { if (p.order) p.full_name = `${p.full_name}&nbsp;<span class='player_order'>(${p.order})</span>`; });
            teams = teamRankDuplicates(eventTeams(e));
            approved = teamRankDuplicates(tfx.approvedDoubles({ tournament, e }));
         } else {
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

            approved = tfx.approvedPlayers({ tournament, e });

            // Doubles TODO: make this work for doubles...
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
         }

         if (e.format != 'D' && e.links && e.links['R']) {
            let entries = util.unique(approved.map(a=>a.entry)); 
            // if RR qualifying round and either consolation draw or elimination draw is composed entirely of qualifiers, enable Option for GEM seeding
            if (e.draw_type == 'C' || (entries.length == 1 && entries[0] == 'Q')) {
               let gem_seeding = document.querySelector('.' + classes.gem_seeding);
               let display = e.active || !state.edit || !env.draws.gem_seeding ? false : true;
               if (gem_seeding) gem_seeding.style.display = display ? 'inline' : 'none';
            }
         }

         if (e.ratings_filter && e.ratings && e.ratings.type) { eligible_players = filteredEligible(e, eligible_players); }

         displayGen.displayEventPlayers({
            teams,
            approved,
            container,
            ratings: e.ratings,
            eligible: eligible_players,
            ineligible: ineligible_players,
            unavailable: unavailable_players
         });

         function changeGroup(evt) {
            if (!state.edit || e.active) return;
            let grouping = util.getParent(evt.target, 'opponent_container').getAttribute('grouping');
            let elem = util.getParent(evt.target, 'player_click');
            let puid = elem.getAttribute('puid');
            let id = elem.getAttribute('uid');

            if (e.format == 'D') {
               addToTeam();
            } else {
               warnIfCreated(e).then(doIt, () => { return; });
            }

            function doIt() {
               if (e.format == 'D') {
                  // addToTeam();
               } else {
                  if (grouping == 'eligible') modifyApproved.push(e, id);
                  if (grouping == 'approved') modifyApproved.removeID(e, id);
               }
            }

            function addToTeam() {
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
            let grouping = util.getParent(evt.target, 'opponent_container').getAttribute('grouping');
            let elem = util.getParent(evt.target, 'team_click');
            let team_id = elem.getAttribute('team_id');
            if (team_id) { destroyTeam(team_id, grouping); }
         }

         function destroyTeam(team_id, grouping) {
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

         function teamClickMenu(evt) {
            var grouping = util.getParent(evt.target, 'opponent_container').getAttribute('grouping');
            if (!state.edit || e.active) return;
            if (evt.ctrlKey || evt.shiftKey || grouping == 'approved') return removeTeam(evt);
            var elem = util.getParent(evt.target, 'team_click');
            var duplicates = elem.getAttribute('duplicates');
            if (!duplicates && grouping == 'approved') return;

            var team_id = elem.getAttribute('team_id');
            // var clicked_team = (grouping == 'approved') ? reduceTeams(approved, team_id) : reduceTeams(teams, team_id);
            var clicked_team = reduceTeams(teams, team_id);

            // if (!clicked_team) return;

            var options = [];
            if (clicked_team) options.push({ label: lang.tr('events.approveteam'), value: 'approve' });
            options.push({ label: lang.tr('events.destroyteam'), value: 'destroy' });
            if (clicked_team) options.push({ label: lang.tr('events.wildcard'), value: 'wildcard' });
            options.push({ label: lang.tr('actions.cancel'), value: 'cancel'});

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
               } else if (selection.value = 'destroy') {
                  destroyTeam(team_id, grouping);
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

         util.addEventToClass('player_click', playerOptions, container.event_details.element);
         util.addEventToClass('team_click', teamClickMenu, container.event_details.element);
         util.addEventToClass('team_click', removeTeam, container.event_details.element, 'contextmenu');
         util.addEventToClass('player_click', changeGroup, container.event_details.element, 'contextmenu');

         function playerOptions(evt) {
            var grouping = util.getParent(evt.target, 'opponent_container').getAttribute('grouping');
            if (evt.ctrlKey || evt.shiftKey || grouping == 'approved' || e.format == 'D') return changeGroup(evt);
            if (!state.edit || e.active || e.format != 'S') return;

            var options = [
               { label: lang.tr('search.approve'), key: 'approve' },
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
               } else if (c.key == 'approve') {
                  changeGroup(evt);
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
            setRRqualifierRange(e);
         }
         eventList(true);
         tournament.categories = tfx.tournamentCategories(tournament);
      }

      function scheduleTab(specific_day) {
         let display = showSchedule();
         if (display) displaySchedule(specific_day || displayed.schedule_day);
      }

      function teamName(match, team, remove_diacritics) {
         if (team.length == 1) {
            let p = match.players[team[0]];
            if (!p) return '';
            if (!p.last_name || !p.first_name) return p.qualifier ? lang.tr('qualifier') : '';
            let club = p.club_code ? ` (${p.club_code})` : '';
            let full_name = `${util.normalizeName(p.first_name, remove_diacritics)} ${util.normalizeName(p.last_name, remove_diacritics).toUpperCase()}`; 
            return `${full_name}${club}`;
         } else {
            return team
               .map(t => !match.players[t] ? lang.tr('opnt') : util.normalizeName(match.players[t].last_name, remove_diacritics).toUpperCase())
               .join('/');
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
         displayed.schedule_day = util.formatDate(currently_selected_day || closest_day);

         // create a list of all matches which are unscheduled or can be moved
         let search_list = all_matches;
         filterSearchList();

         let courts = courtFx.courtData(tournament);
         let oop_rounds = util.range(1, env.schedule.max_matches_per_court + 1);

         let date_options = date_range.map(d => ({ key: calendarFx.localizeDate(d), value: util.formatDate(d) }));
         dd.attachDropDown({ 
            id: container.schedule_day.id, 
            options: date_options,
            label: '',
         });
         container.schedule_day.ddlb = new dd.DropDown({ element: container.schedule_day.element, id: container.schedule_day.id, onChange: dateChange });
         container.schedule_day.ddlb.setValue(displayed.schedule_day, 'white');

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

         // Round Filter
         // if scheduling upcoming matches need to add them to round filter too...
         let round_names = util.unique(upcoming_matches.concat(...pending_matches).map(m=>m.round_name)).reverse();
         let round_filters = [].concat({ key: lang.tr('schedule.allrounds'), value: '' }, ...round_names.map(round => ({ key: round, value: round })));
         dd.attachDropDown({ 
            id: container.round_filter.id, 
            options: round_filters,
            label: '',
         });
         container.round_filter.ddlb = new dd.DropDown({ element: container.round_filter.element, id: container.round_filter.id, onChange: displayPending });
         container.round_filter.ddlb.selectionBackground('white');

         // Location Filter
         let location_filters = [].concat({ key: lang.tr('schedule.allcourts'), value: '' }, ...tournament.locations.map(l => ({ key: l.name, value: l.luid })));
         dd.attachDropDown({ 
            id: container.location_filter.id, 
            options: location_filters,
            label: '',
         });
         container.location_filter.ddlb = new dd.DropDown({ element: container.location_filter.element, id: container.location_filter.id, onChange: displayCourts });
         container.location_filter.ddlb.selectionBackground('white');

         // Dual Match Filters
         let { dual_match_options, order_options } = dualMatchSelections();
         let dual_matches = [].concat({ key: lang.tr('schedule.alldual'), value: '' }, ...dual_match_options);
         dd.attachDropDown({ 
            id: container.dual_filter.id, 
            options: dual_matches,
            label: '',
         });
         container.dual_filter.ddlb = new dd.DropDown({ element: container.dual_filter.element, id: container.dual_filter.id, onChange: displayPending });
         container.dual_filter.ddlb.selectionBackground('white');

         let order_filters = [].concat({ key: 'Order', value: '' }, ...order_options);
         dd.attachDropDown({ 
            id: container.order_filter.id, 
            options: order_filters,
            label: '',
         });
         container.order_filter.ddlb = new dd.DropDown({ element: container.order_filter.element, id: container.order_filter.id, onChange: displayPending });
         container.order_filter.ddlb.selectionBackground('white');

         function dualMatchSelections() {
            let unscheduled_matches = all_matches
               .filter(m=>m)
               .filter(m=>(!m.schedule || !m.schedule.court) && m.winner == undefined);

            let dual_uuids = util.unique(unscheduled_matches.map(m => m.dual_match));
            let dual_match_contexts = [].concat(
               ...tournament.events
                  .map(v => v.draw && v.draw.dual_matches && Object.keys(v.draw.dual_matches)
                     .filter(dual_muid => dual_uuids.indexOf(dual_muid) >= 0)
                     .map(dual_muid => ({ draw: v.draw, dual_muid }) )
                  )
            ).filter(f=>f);
            let dual_match_options = dual_match_contexts.map(dualMatchOption).filter(f=>f);

            let sequences = util.unique(unscheduled_matches.map(m => m.sequence)).sort();
            let order_options = sequences.map(s => ({ value: s, key: s }));

            return { dual_match_options, order_options }
         }

         function dualMatchOption({ draw, dual_muid }) {
            let dual_match_node = dfx.findDualMatchNode(draw, dual_muid);
            let dual_match = dual_match_node && dual_match_node.data;
            if (!dual_match_node || !dual_match) return;
            let dual_teams = getDualTeams(dual_match);
            return { value: dual_muid, key: dual_teams.map(t=>t.name).join('-') };
         }

         // show or hide option button depending on whether there is more than one option
         let team_tournament = tfx.isTeam(tournament);
         let events_count = tournament.events && tournament.events.length;
         container.event_filter.element.style.display = team_tournament && !events_count ? 'none' : 'flex';
         container.round_filter.element.style.display = team_tournament ? 'none' : 'flex';
         container.dual_filter.element.style.display =  team_tournament ? 'flex' : 'none';
         container.order_filter.element.style.display =  team_tournament ? 'flex' : 'none';
         util.getParent(container.location_filter.element, 'schedule_options').style.display = (tournament.locations.length > 1) ? 'flex' : 'none';

         displayPending(false);
         dateChange(displayed.schedule_day);

         function dateChange(value) {
            displayed.schedule_day = value;
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
            let include_completed = env.schedule.completed_matches_in_search;
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
            let dual_uuid = container.dual_filter.ddlb.getValue();
            let order_filter = container.order_filter.ddlb.getValue();
            
            let euid_filtered = !euid ? pending_upcoming : pending_upcoming.filter(m=>m.event.euid == euid);
            let dual_filtered = !dual_uuid ? euid_filtered : euid_filtered.filter(m=>m.dual_match == dual_uuid);
            let order_filtered = !order_filter ? dual_filtered : dual_filtered.filter(m=>m.sequence == order_filter);

            let round_name = container.round_filter.ddlb.getValue();
            let round_filtered = !round_name ? order_filtered : order_filtered.filter(m=>m.round_name == round_name);

            let unscheduled = round_filtered.filter(m=>!m.schedule || !m.schedule.court)
            let srtd_unscheduled = scheduleFx.sortedUnscheduled(tournament, unscheduled, false);
            displayGen.scheduleTeams({ unscheduled: srtd_unscheduled, element: container.unscheduled.element });

            util.addEventToClass('dragUnscheduled', dragUnscheduled, container.unscheduled.element, 'dragstart');
            if (update_round_names) updateRoundNames(euid_filtered);

            function playerIsBye(pz) { return !pz ? false : pz.reduce((p, c) => c.bye || p, undefined) }
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
               schedule_day: displayed.schedule_day,
               options: env.schedule
            });
            util.addEventToClass('findmatch', showSearch, container.schedule.element, 'click');
            util.addEventToClass('opponentsearch', (e)=>e.stopPropagation(), container.schedule.element, 'click');

            util.addEventToClass('dragdrop', dragStart, container.schedule.element, 'dragstart');
            util.addEventToClass('dragdrop', drop, container.schedule.element, 'drop');

            util.addEventToClass('oop_round', roundContext, container.schedule.element, 'contextmenu');
            util.addEventToClass('oop_round', roundContext, container.schedule.element, 'click');
            util.addEventToClass('schedule_box', gridContext, container.schedule.element, 'contextmenu');
            util.addEventToClass('schedule_box', gridClick, container.schedule.element, 'click');
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
               let sb = scheduleFx.scheduleBox({ match, editable: true, options: env.schedule });
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
            if (!match || !match.schedule || !match.schedule.court || !element) return;

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
            matchEventOutOfDate(match);

            checkConflicts(day_matches);
            saveTournament(tournament);

            ({ completed_matches, pending_matches, upcoming_matches } = mfx.tournamentEventMatches({ tournament, source: true }));
            displayPending();

            scheduleActions({ changed: true });
         }

         // ability to "pull" matches into schedule cells
         function showSearch(evt) {
            if (!schedulingActive()) return;
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
               let target_schedule = { luid, index, court, oop_round, day: displayed.schedule_day };

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
               matchEventOutOfDate(source_match);

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
               target_match.schedule = { luid, index, court, oop_round, day: displayed.schedule_day };
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

            matchEventOutOfDate(source_match);
            matchEventOutOfDate(target_match);

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
            if (!state.edit || !schedulingActive()) return;

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
                           matchEventOutOfDate(match);
                           if (display) updateScheduleBox(match);
                        }
                     });
                  scheduleActions({ changed: true });
                  saveTournament(tournament);
               }
            }
         }

         function identifyMatch({ evt, target }) {
            if (!target) target = util.getParent(evt.target, 'schedule_box');
            let muid = target.getAttribute('muid');
            return { match: muid_key[muid], muid, target };
         }

         // if not a mobile device then event support 'contextmenu'
         function gridContext(evt) {
            if (!state.edit) return;
            let modifier = evt.ctrlKey || evt.shiftKey;
            if (schedulingActive() && modifier) return scoreGridMatch(evt);
            scheduleGridMatch({evt});
         }

         function gridClick(evt) {
            if (!state.edit) return;
            let modifier = evt.ctrlKey || evt.shiftKey;
            if (!schedulingActive() && modifier) return scheduleGridMatch({evt});
            if (schedulingActive() && !modifier) return scheduleGridMatch({evt});
            scoreGridMatch(evt);
         }

         function scheduleGridMatch({ evt, target }) {
            if (!state.edit) return;

            let { match } = identifyMatch({ evt, target });
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

               displayGen.svgModal({ x: evt.clientX, y: evt.clientY, options, callback: modifySchedule });

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
                     displayGen.svgModal({ x: evt.clientX, y: evt.clientY, options: headings, callback: timeHeading });
                  } else if (choice.key == 'changestatus') {
                     let statuses = [
                        { label: lang.tr('schedule.called'),  value: 'called' },
                        { label: lang.tr('schedule.oncourt'),  value: 'oncourt' },
                        { label: lang.tr('schedule.warmingup'),  value: 'warmingup' },
                        { label: lang.tr('schedule.suspended'),  value: 'suspended' },
                        { label: lang.tr('schedule.raindelay'),  value: 'raindelay' },
                        { label: lang.tr('schedule.clear'),  value: 'clear' },
                     ];
                     displayGen.svgModal({ x: evt.clientX, y: evt.clientY, options: statuses, callback: matchStatus });
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
                     displayGen.svgModal({ x: evt.clientX, y: evt.clientY, options: statuses, callback: assessPenalty });
                  } else if (choice.key == 'remove') {
                     if (!target) target = util.getParent(evt.target, 'schedule_box');
                     returnToUnscheduled(match, target);
                     return;
                  }
               }

               function setTime(value) { modifyMatchSchedule([{ attr: 'time', value }]); }
               function setStart(value) { modifyMatchSchedule([{ attr: 'start', value }]); }
               function setEnd(value) { modifyMatchSchedule([{ attr: 'end', value }]); }
               function assessPenalty(penalty, penalty_index, penalty_value) {
                  let players = match.players.map(p=>p.full_name);
                  displayGen.svgModal({ x: evt.clientX, y: evt.clientY, options: players, callback: playerPenalty });
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
                  matchEventOutOfDate(match);
                  if (display) updateScheduleBox(match);
                  saveTournament(tournament);
               }
            }
         }

         function scoreGridMatch(evt) {
            let { match, target } = identifyMatch({ evt });

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
                  if (outcome && outcome.delegate) return delegateMatch(match, outcome.teams, outcome.score_format);
                  if (!outcome) return;

                  // this must happen first as 'e' is modified
                  let result;
                  if (tfx.isTeam(tournament)) {
                     let dual_match_node = dfx.findDualMatchNodeByMatch(e.draw, match.muid);
                     let dual_match = dual_match_node && dual_match_node.data;
                     let dual_teams = getDualTeams(dual_match);
                     result = scoreDualDraw({ tournament, e, dual_match, dual_teams, muid: match.muid, outcome });
                  } else {
                     result = (e.draw_type == 'R') 
                        ? scoreRoundRobin(tournament, e, existing_scores, outcome)
                        : scoreTreeDraw({ tournament, e, muid: match.muid, existing_scores, outcome });
                  }

                  if (result && !result.error) {
                     match.winner_index = outcome.winner;
                     match.score = outcome.score;
                     if (outcome.score) match.status = '';
                     match.score_format = outcome.score_format;
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


                     let delegation = env.scoring.delegation;
                     scoreBoard.setMatchScore({
                        muid,
                        container,
                        delegation,
                        round_name,
                        score_format,
                        existing_scores,
                        teams: match.teams,
                        callback: scoreSubmitted,
                        flags: env.assets.flags,
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
         if (e.euid != displayed.draw_event.euid) return;
         displayGen.drawBroadcastState(container.publish_state.element, e);

         let publishing = env.publishing;
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
               matchEventOutOfDate(match);
            });
            displayGen.closeModal();
         }

         // TODO: update scheduling tab?
      }

      function playersTab({ doubles } = {}) {
         if (state.edit) enableAddPlayer();
         if (!tournament.categories) tournament.categories = [tournament.category];
         toggleManualRank(false);
         state.manual_ranking = undefined;

         // create an array of ids of all players who are selected for any event
         // used to prevent sign-out of approved players
         let playersApproved = () => !tournament.events ? [] : [].concat(...tournament.events.map(e => {
            if (!e.approved) return [];
            return e.teams ? [].concat(...e.teams) : [].concat(...e.approved);
         }));

         let activePlayers = () => {
            let { completed_matches, pending_matches, upcoming_matches } = mfx.tournamentEventMatches({ tournament, source: true });
            let all_matches = [].concat(...completed_matches, ...pending_matches, ...upcoming_matches);
            let player_puids = util.unique([].concat(...all_matches.map(m=>m.players)).map(p=>p.puid));
            return player_puids;
         }
         // TODO: ability to sort by either name or rank

         let category = staging.legacyCategory(tournament.category, true);

         let tournament_date = tournament && (tournament.points_date || tournament.end);
         let calc_date = tournament_date ? new Date(tournament_date) : new Date();
         let categories = rankCalc.orgCategories({ calc_date }).map(r => ({ key: r, value: r }));
         let prior_value = container.category_filter.ddlb ? container.category_filter.ddlb.getValue() : undefined;
         if (categories.map(o=>o.value).indexOf(prior_value) < 0) prior_value = undefined;
         
         dd.attachDropDown({ 
            id: container.category_filter.id, 
            options: categories,
            label: `${lang.tr('cat')}:`, 
         });
         container.category_filter.ddlb = new dd.DropDown({ element: container.category_filter.element, id: container.category_filter.id, onChange: categoryChanged });
         container.category_filter.ddlb.setValue(prior_value || category || '-', 'white');

         // playersTab has a category DDLB... and this should be used for ordering players...
         let current_value = prior_value || tournament.categories[0];
         let t_players = tfx.orderPlayersByRank(tournament.players, current_value)
            .filter(player => pfx.eligibleForCategory({ calc_date, category: current_value, player }));

         let points_table = rankCalc.pointsTable({calc_date});
         let ctgs = points_table && points_table.categories;
         let ratings = ctgs && ctgs[current_value] && ctgs[current_value].ratings;
         let ratings_type = ratings && ratings.type;

         if ((!tournament.players || !tournament.players.length) && !state.edit) {
            d3.select('#YT' + container.container.id).style('display', 'none');
            return;
         }

         let display_order = displayGen.displayTournamentPlayers({ container, tournament, players: t_players, filters, ratings_type, edit: state.edit, doubles });

         function categoryChanged(selected_category) { playersTab(); }

         function deleteTeamTournamentPlayer(puid) {
            if (tournament.teams) {
               tournament.teams.forEach(team => {
                  if (team.players && Object.keys(team.players).indexOf(puid) >= 0) {
                     delete team.players[puid];
                     teamList({cleanup: true});
                  }
               });
            }
         }

         eventManager.holdActions.editTournamentPlayer = tournamentPlayerHoldAction;

         function tournamentPlayerHoldAction(element, mouse) {
            displayGen.popUpMessage(`Tournament Player Hold Action`);
            tournamentPlayerContextOptions(element, mouse);
         }

         function tournamentPlayerContext(evt) {
            // if modifying rankings, disable!
            if (state.manual_ranking || !state.edit) return;
            let element = util.getParent(evt.target, 'player_click');
            var mouse = { x: evt.clientX, y: evt.clientY }
            tournamentPlayerContextOptions(element, mouse);
         }

         function tournamentPlayerContextOptions(element, mouse) {
            let puid = element.getAttribute('puid');
            if (!puid) { console.log('missing puid:', element); return; }

            let clicked_player = tournament.players.reduce((p, c) => { if (c.puid == puid) p = c; return p; }, undefined);
            let approved = playersApproved().indexOf(clicked_player.id) >= 0; 
            let active = tfx.isTeam(tournament) && activePlayers().indexOf(clicked_player.puid) >= 0;
            let identify = env.players.identify;

            var options = [];
            if (!approved && clicked_player.signed_in) options.push({ label: lang.tr('sgo'), key: 'signout' });
            options.push({ label: lang.tr('edt'), key: 'edit' });
            if (identify) options.push({ label: lang.tr('idp'), key: 'identify' });
            if (!approved && !active) options.push({ label: lang.tr('dlp'), key: 'delete' });
            options.push({ label: lang.tr('ccl'), key: 'cancel' });

            if (options.length == 1) {
               selectionMade({ key: options[0].key });
            } else {
               displayGen.svgModal({ x: mouse.x, y: mouse.y, options, callback: selectionMade });
            }

            function selectionMade(choice, index) {
               if (choice.key == 'edit') {
                  let category_filter = container.category_filter.ddlb ? container.category_filter.ddlb.getValue() : tournament.category;
                  pfx.editPlayer({ player_data: clicked_player, category: category_filter, callback: savePlayerEdits });
               } else if (choice.key == 'delete') {
                  var caption = `<p>${lang.tr('delete')} ${lang.tr('ply')}:</p> <p>${clicked_player.full_name}</p>`;
                  displayGen.okCancelMessage(caption, deletePlayer, () => displayGen.closeModal());
                  function deletePlayer() {
                     tournament.players = tournament.players.filter(p=>p.puid != clicked_player.puid);
                     deleteTeamTournamentPlayer(clicked_player.puid);
                     displayGen.closeModal();
                     saveFx();
                  }
               } else if (choice.key == 'identify') {
                  pfx.optionsAllPlayers().then(identifyValidPlayer, util.logError);

                  function identifyValidPlayer(valid_players) {

                     if (!valid_players || !valid_players.length) {
                        return displayGen.popUpMessage(`<div>${lang.tr('pyr')}<p>${lang.tr('phrases.notfound')}</div>`);
                     }

                     var selected_puid;
                     let modal = displayGen.selectNewPlayerIdentity(clicked_player);
                     modal.cancel.element.addEventListener('click', () => displayGen.closeModal());

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
                        if (!new_player_data) return;
                        new_player_data.birth = util.formatDate(new_player_data.birth);
                        new_player_data.full_name = tfx.fullName(new_player_data, false);
                        displayGen.changePlayerIdentity(clicked_player, new_player_data, changePlayerIdentity);
                        function changePlayerIdentity() {
                           displayGen.closeModal();
                           tfx.replaceTournamentPlayer({ tournament, existing_player: clicked_player, new_player_data, replace_all: true });
                           saveFx();
                        }
                     }
                  }
               } else if (choice.key == 'signout') {
                  displayGen.closeModal();
                  signOutTournamentPlayer(clicked_player);
                  playersTab();
                  let e = tfx.findEventByID(tournament, displayed.euid);
                  if (e) eventPlayers(e);
                  eventsTab();
               } else {
                  displayGen.closeModal();
               }
            }

            function savePlayerEdits(p) {
               let new_player_data = Object.assign({}, clicked_player);
               if (p.first_name) new_player_data.first_name = p.first_name;
               if (p.last_name) new_player_data.last_name = p.last_name;
               new_player_data.full_name = tfx.fullName(new_player_data, false);
               if (p.ioc) new_player_data.ioc = p.ioc;
               if (p.birth) new_player_data.birth = p.birth;
               if (p.sex) new_player_data.sex = p.sex;
               new_player_data.school = p.school || '';
               new_player_data.school_abbr = p.school_abbr || '';

               tfx.replaceTournamentPlayer({ tournament, existing_player: clicked_player, new_player_data });
               saveFx();
            }

            function saveFx() { saveTournament(tournament); playersTab(); }
         }

         // now add event to all players to display player profile
         let signInState = (evt) => {
            // if modifying rankings, disable!
            if (state.manual_ranking) return;
            if (evt.ctrlKey || evt.shiftKey) return tournamentPlayerContext(evt);

            let element = util.getParent(evt.target, 'player_click');
            let puid = element.getAttribute('puid');
            if (!puid) {
               console.log('missing puid:', element);
               return;
            }

            let clicked_player = tournament.players.reduce((p, c) => { if (c.puid == puid) p = c; return p; }, undefined);

            if (clicked_player.signed_in) {
               let mouse = { x: evt.clientX, y: evt.clientY }
               return tournamentPlayerContextOptions(element, mouse);
            }

            let medical = pfx.medical(clicked_player, tournament);
            let registration = pfx.registration(clicked_player);
            let approved = playersApproved().indexOf(clicked_player.id) >= 0; 
            let active = tfx.isTeam(tournament) && activePlayers().indexOf(clicked_player.puid) >= 0;
            let penalties = clicked_player.penalties && clicked_player.penalties.length;
            let withdrawn = !clicked_player ? false : clicked_player.withdrawn == 'Y' || clicked_player.withdrawn == true;

            // rapid mode allows sign-in with single click
            if (state.edit && o.sign_in.rapid && !withdrawn && registration) {
               if (clicked_player) {
                  if (clicked_player.signed_in) {
                     if (approved || active) {
                        if (penalties) { return displayGen.playerPenalties(clicked_player, saveFx); } else { return cannotSignOut(); }
                        function saveFx() { saveTournament(tournament); playersTab(); }
                     }
                     // must confirm sign-out
                     return pfx.displayPlayerProfile({ puid }).then(()=>{}, ()=>displayIrregular(clicked_player));
                  } else {
                     if (medical) {
                        clicked_player.signed_in = true;
                        saveTournament(tournament);
                     } else {
                        pfx.displayPlayerProfile({ puid }).then(()=>{}, ()=>displayIrregular(clicked_player));
                     }
                  }
               }
               finish();
            } else {
               pfx.displayPlayerProfile({ puid, fallback: clicked_player }).then(()=>{}, ()=>displayIrregular(clicked_player));
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
               let e = tfx.findEventByID(tournament, displayed.euid);
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

            if (changed_player) {
               let changeable = true;
               // TODO: in the future will need to modify rank for categories if there are multiple categories in one tournament
               if (attribute == 'rank') { 
                  if (changeable) {
                     if (value.indexOf('{') == 0) {
                        if (/^\{\d+\}$/.test(value)) {
                           let v = util.numeric((/^\{(\d+)\}$/.exec(value) || [])[1]);
                           if (doubles) {
                           } else {
                              changed_player.modified_ranking = v;
                              changed_player.int = v;
                           }
                        } else if (/^\{\}$/.test(value)) {
                           if (doubles) {
                           } else {
                              delete changed_player.modified_ranking;
                              delete changed_player.int;
                           }
                           evt.target.value = '';
                        }
                     } else {
                        if (doubles) {
                           changed_player.category_dbls = isNaN(value) || value == 0 ? undefined : +value; 
                        } else {
                           changed_player.modified_ranking = isNaN(value) || value == 0 ? undefined : +value; 
                           changed_player.category_ranking = isNaN(value) || value == 0 ? undefined : +value; 
                           checkDuplicateRankings({ display_order, subrank: !doubles });
                        }
                     }
                  } else {
                     if (doubles) {
                        evt.target.value = validRanking(changed_player.category_dbls) || '';
                     } else {
                        evt.target.value = validRanking(changed_player.modified_ranking || changed_player.category_ranking) || '';
                     }
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

         let playerRanking = () => {
            if (!state.edit || !tournament.players || !tournament.players.length) return;
            playersTab({doubles: !doubles});
         }

         util.addEventToClass('manualrank', catchTab, container.players.element, 'keydown');
         util.addEventToClass('manualrating', catchTab, container.players.element, 'keydown');
         util.addEventToClass('subrank', catchTab, container.players.element, 'keydown');

         util.addEventToClass('tournamentPlayers', tournamentPlayers, container.players.element);
         util.addEventToClass('tournamentPlayers', tournamentPlayers, container.players.element, 'contextmenu');

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
         eventManager.holdActions.rankByRating = rankByRating;

         util.addEventToClass('playerRanking', playerRanking, container.players.element);
         util.addEventToClass('playerRanking', playerRanking, container.players.element, 'contextmenu');
         eventManager.holdActions.playerRanking = playerRanking;

         checkDuplicateRankings({ display_order, subrank: !doubles });
         signInSheet();
      }

      function tournamentPlayersClick(evt) {
         if (evt.ctrlKey || evt.shiftKey) return tournamentPlayers();
      }

      function tournamentPlayers() {
         if (state.edit && tournament.players && tournament.players.length) {
            let message = 'Add Tournament Players to Database?';
            displayGen.okCancelMessage(message, addPlayers, () => displayGen.closeModal());
            function addPlayers() {
               tournament.players.forEach(p => db.addPlayer(p).then(()=>{}, util.logError));
               displayGen.closeModal();
            }
         }
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

      function checkDuplicateRankings({ display_order, subrank }) {
         if (state.edit && tournament.players) {
            let displayed_players = displayedPlayers();
            let signed_in = displayed_players.filter(p=>p.signed_in);

            // separate male & female
            let m = signed_in.filter(f=>f.sex == 'M');
            let w = signed_in.filter(f=>f.sex == 'W');

            let male_duplicates = tfx.rankDuplicates(m);
            let all_duplicates = tfx.rankDuplicates(w, male_duplicates);
            if (all_duplicates.length) enableSubRankEntry(subrank, all_duplicates);
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
         if (tfx.isTeam(tournament)) return;

         var tournament_date = tournament && (tournament.points_date || tournament.end);
         var points_date = tournament_date ? new Date(tournament_date) : new Date();
         if (!mz || !mz.length) return;

         checkAllPlayerPUIDs(tournament.players).then(proceed, util.logError);

         function proceed() {
            // remove any calculated points or rankings
            mz.forEach(match => match.players.forEach(scrubPlayer));

            var points_table = rankCalc.pointsTable({ calc_date: points_date });

            var match_data = { matches: mz, points_table, points_date };
            var points = rankCalc.calcMatchesPoints(match_data);

            if (sameOrg(tournament)) saveMatchesAndPoints({ tournament, matches: mz, points });
            displayTournamentPoints(container, tournament, points, filters);

            function scrubPlayer(p) { return pfx.cleanPlayer(p); }
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
         if (e.draw) {
            mfx.addMUIDs(e);
            let round_names = mfx.roundNames(tournament, e);
            let pending = dfx.matches(e.draw, round_names.names, round_names.calculated_names);
            let upcoming = dfx.upcomingMatches(e.draw, round_names.names, round_names.calculated_names);
            if (tfx.isTeam(tournament)) {
               let matches = [].concat(...pending, ...upcoming);
               pending.forEach(m => m.match.score = '0-0');
               e.draw.dual_matches = Object.assign({}, ...matches.map(m => ({[m.match.muid]: { round_name: m.match.round_name, matches: [] }})));
               orderDualMatchesDraw(e);
            }
         }

         // add round_name to matches
         mfx.eventMatches(e, tournament);
         pushTournament2Cloud(tournament);
         saveTournament(tournament);
      }

      function buildDirectionDraw(e, current_direction, direction_1st, direction_2nd, direction_3rd) {
         if (!current_direction || !e.draw || !e.draw[current_direction]) return {};

         let loss_count = env.draws.compass_draw.direction_by_loss;

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
            // TODO: is this relevent any longer?
            // if matches array part of tournament object, matches have been imported
            dbmatches.forEach(match => match.outcome = mfx.matchOutcome(match));
            displayGen.displayTournamentMatches({ tournament, container, completed_matches: dbmatches, filters });
            calcPlayerPoints({ tournament, matches: dbmatches, container, filters });
         } else {
            displayGen.displayTournamentMatches({ tournament, container, pending_matches, completed_matches, filters });
            tournamentPoints(tournament, completed_matches);
         }

         // attach function to display player profile when clicked
         util.addEventToClass('player_click', pfx.playerClicked, container.matches.element);
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

               if (outcome && outcome.delegate) return delegateMatch(match.match, outcome.teams, outcome.score_format);

               // this must happen first as 'e' is modified
               if (tfx.isTeam(tournament)) {
                  let dual_match_node = dfx.findDualMatchNodeByMatch(e.draw, match.match.muid);
                  let dual_match = dual_match_node && dual_match_node.data;
                  let dual_teams = getDualTeams(dual_match);
                  scoreDualDraw({ tournament, e, dual_match, dual_teams, muid: match.match.muid, outcome });
               } else {
                  if (e.draw_type == 'R') {
                     scoreRoundRobin(tournament, e, existing_scores, outcome);
                  } else {
                     scoreTreeDraw({ tournament, e, muid: match.match.muid, existing_scores, outcome });
                  }
               }
               matchesTab();
            }

            if (match && match.teams) {
               let muid = match.match.muid;
               let round_name = match.round_name || '';

               let score_format = match.score_format || e.score_format || {};
               if (!score_format.final_set_supertiebreak) score_format.final_set_supertiebreak = e.format == 'D' ? true : false;

               let delegation = env.scoring.delegation;
               scoreBoard.setMatchScore({
                  muid,
                  container,
                  delegation,
                  round_name,
                  score_format,
                  existing_scores,
                  teams: match.teams,
                  callback: scoreSubmitted,
                  flags: env.assets.flags,
               });
            }
         }

         function scoreClick(evt) {
            if (!state.edit) return;
            let muid = evt.target.getAttribute('muid');
            let euid = evt.target.getAttribute('euid');
            if (!muid || !euid) return;
            let e = tfx.findEventByID(tournament, euid);
            let match = mfx.eventMatches(e, tournament).reduce((p, c) => p = (c.match.muid == muid) ? c : p, undefined);
            enterMatchScore(e, match);
         }
         function playerInMatchContext(evt) {
            let puid = evt.target.getAttribute('puid');
            let row = util.getParent(evt.target, 'matchrow');
            let muid = row.getAttribute('muid');
            let euid = row.getAttribute('euid');
            matchClick(evt, muid, euid, puid);
         }

         function matchClick(evt, muid, euid, puid) {
            if (!state.edit) return;
            if (evt.ctrlKey || evt.shiftKey) return scoreClick(evt);
            muid = muid || evt.target.getAttribute('muid');
            euid = euid || evt.target.getAttribute('euid');
            if (!muid || !euid) return;
            let mouse = {
               x: evt.clientX,
               y: evt.clientY
            }
            let e = tfx.findEventByID(tournament, euid);
            let match = mfx.eventMatches(e, tournament).reduce((p, c) => p = (c.match.muid == muid) ? c : p, undefined);
            if (state.edit && match.match) matchesTabMenu(e, mouse, match, puid);
         }

         util.addEventToClass('cell_singles', matchClick, container.matches.element);
         util.addEventToClass('cell_doubles', matchClick, container.matches.element);
         util.addEventToClass('cell_singles', scoreClick, container.matches.element, 'contextmenu');
         util.addEventToClass('cell_doubles', scoreClick, container.matches.element, 'contextmenu');

         function matchesTabMenu(e, mouse, match, puid) {
            let complete = match && match.match && match.match.winner != undefined;
            let options = [
               { label: lang.tr('draws.starttime'), key: 'starttime' },
               { label: lang.tr('draws.endtime'), key: 'endtime' },
            ];
            if (!complete) { options.push({ label: lang.tr('draws.changestatus'), key: 'changestatus' }); }
            if (puid) options.push({ label: lang.tr('draws.penalty'), key: 'penalty' });
            options.push({ label: lang.tr('scr'), key: 'score' });

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
                  let time_string = match.match.schedule && (match.match.schedule.start || match.match.schedule.time);
                  displayGen.timePicker({ value: time_string, hour_range: { start: 8 }, minute_increment: 5, callback: setStart })
               } else if (choice.key == 'endtime') {
                  let time_string = match.match.schedule && match.match.schedule.end;
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
               } else if (choice.key == 'score') {
                 enterMatchScore(e, match); 
               }
            }

            function setStart(value) { modifyMatchSchedule([{ attr: 'start', value }]); }
            function setEnd(value) { modifyMatchSchedule([{ attr: 'end', value }]); }
            function modifyMatchSchedule(pairs, display=true) {
               if (!match.match.schedule) match.match.schedule = {};
               pairs.forEach(pair => {
                  match.match.schedule[pair.attr] = pair.value
                  if (match.match.source) match.match.source.schedule[pair.attr] = pair.value;
               });
               matchEventOutOfDate(match.match);
               if (display) updateScheduleBox(match.match);
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
                     muid: match.match.muid,
                     round: match.match.round_name,
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
               match.match.status = choice.value == 'clear' ? '' : choice.label;
               if (match.match.source) match.match.source.status = match.match.status;
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

         let draw_object = (evt.draw_type == 'R') ? rr_draw : tree_draw;
         let options = draw_object.options();
         let draw_type_name = tfx.genEventName(evt, tfx.isPreRound({ env, e: evt })).type;

         tourny.org = tourny.org || env.org;
         let updateBroadcastStatus = (result) => {
            evt.up_to_date = true;
            evt.published = evt.published || new Date().getTime();
            if (displayed.draw_event && evt.euid == displayed.draw_event.euid) {
               displayGen.drawBroadcastState(container.publish_state.element, displayed.draw_event);
            }
            saveTournament(tourny);
            enableTournamentOptions();
            displayGen.authState(container.authorize.element, result.authorized || false);
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
         try { displayDrawType({ evt }); }
         catch (err) { tfx.logEventError(evt, err, 'displayDrawType'); }
      }

      function displayDrawType({ evt }) {
         if (!evt.draw) return;
         if (displayed.draw_event) displayGen.drawRepState(container.player_reps_state.element, displayed.draw_event);

         tree_draw.options({ draw: { feed_in: evt.structure == 'feed' }});

         if (evt.draw.compass) {
            if (evt.draw[evt.draw.compass] && evt.draw[evt.draw.compass].children && evt.draw[evt.draw.compass].children.length) {
               tree_draw.data(evt.draw[evt.draw.compass]);
               if (tree_draw.info().doubles) tree_draw.options({ names: { seed_number: false }});

               // TODO: this is temporary while exploring other options
               let seeding = evt.draw[evt.draw.compass].opponents ? evt.gem_seeding || tfx.rankedTeams(evt.draw[evt.draw.compass].opponents) : true;

               let approved_opponents = tfx.approvedOpponents({ tournament, e: evt });
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

            let approved_opponents = tfx.approvedOpponents({ tournament, e: evt });
            let seed_limit = dfx.seedLimit(approved_opponents.length);
            if (evt.draw_type == 'Q') seed_limit = (evt.qualifiers * 2) || seed_limit;

            fx.drawOptions({ draw: tree_draw });
            tree_draw.options({ names: { seed_number: seeding }, details: { seeding }});
            tree_draw.options({ seeds: { limit: seed_limit } });

            tree_draw(); 
         } else if (evt.draw.brackets && evt.draw.brackets.length) {
            var bracket_sizes = env.draws.rr_draw.brackets;
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
         let created = drawIsCreated(displayed.draw_event);
         let approved = displayed.draw_event && displayed.draw_event.approved;
         let visible = created && approved;
         let ouid = env.org && env.org.ouid;

         let current_draw = !displayed.draw_event ? undefined : 
            displayed.draw_event.draw && displayed.draw_event.draw.compass ? displayed.draw_event.draw[displayed.draw_event.draw.compass] :
            displayed.draw_event.draw;
         let direction = current_draw && current_draw.direction;
         let compass = direction && ['east', 'west', 'north', 'south', 'northeast', 'northwest', 'southeast', 'southwest'].indexOf(direction) >= 0;

         // if created by no approved players then it must be created from dbmatches
         let active = created && !visible ? true : displayed.draw_event ? displayed.draw_event.active : false;
         let svg = container.draws.element.querySelector('svg');

         let pdf_function = sameOrg(tournament) && (visible || state.edit);
         document.querySelector('.' + classes.print_draw).style.display = pdf_function && svg ? 'inline' : 'none';

         // let draw_creation = env.publishing.publish_draw_creation;
         // container.publish_draw.element.style.display = (draw_creation || (visible && svg)) && ouid && state.edit ? 'inline' : 'none';
         container.publish_draw.element.style.display = ouid && state.edit ? 'inline' : 'none';
         container.player_reps.element.style.display = approved && svg && state.edit ? 'inline' : 'none';
         container.recycle.element.style.display = !active && svg && state.edit ? 'inline' : 'none';
         container.compass.element.style.display = compass ? 'inline' : 'none';
      }

      function testLastSeedPosition(e) {
         var settings = env.drawFx;
         if (displayed.draw_event && displayed.draw_event.structure == 'feed') return;
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

      function removeQualifiedTeam(e, team_ids, qlink, qlinkinfo) {
         let removed = tfx.removeQualifiedTeam(tournament, e, team_ids, qlink, qlinkinfo);

         if (removed.linkchanges) {
            approvedChanged(removed.qlink);
            if (env.publishing.publish_on_score_entry) broadcastEvent(tournament, removed.qlink);
            if (removed.qlink.euid == displayed.draw_event.euid) {
               displayGen.drawBroadcastState(container.publish_state.element, removed.qlink);
            }
         }
      }

      function removeDirectionalPlayer(e, target_draw, losing_team_ids, linked_info) {
         let removed = tfx.removeDirectionalPlayer(tournament, e, target_draw, losing_team_ids, linked_info);
      }

      function scoreDualDraw({ tournament, e, dual_match, dual_teams, muid, outcome }) {
         let result = tfx.scoreDualMatchDraw({ tournament, e, dual_match, dual_teams, muid, outcome });
         if (displayed.dual_match && dual_match.match.muid == displayed.dual_match.match.muid) {
            displayDualMatches(dual_match);
            tree_draw.data(e.draw)();
         }
         return processResult(tournament, e, result);
      }

      function displayDualMatches(dual_match, dual_teams) {
         if (!dual_teams) dual_teams = getDualTeams(dual_match);
         let dual = container.dual.element;
         dual.style.display = 'flex';
         let e = tfx.findEventByID(tournament, dual_match.match.euid);
         let score = tfx.calcDualMatchesScore(e, dual_match).score;
         displayOrderedMatches(e, dual_match, dual_teams);

         dual.querySelector('.dual_team.team1').innerHTML = dual_teams[0].name;
         dual.querySelector('.dual_team.team2').innerHTML = dual_teams[1].name;
         dual.querySelector('.team_score_box.team1').innerHTML = score[0];
         dual.querySelector('.team_score_box.team2').innerHTML = score[1];
         dual.querySelector('.team_divider').innerHTML = lang.tr('schedule.vs');

         eventManager.register('dual_team', 'tap', dualTeamClick);

         function dualTeamClick(elem, mouse) {
            let team_index = elem.getAttribute('team_index');
            let options = [lang.tr('scoring.retire'), lang.tr('scoring.walkover'), lang.tr('scoring.default')];
            displayGen.svgModal({ x: mouse.x, y: mouse.y, options, callback: clickAction });

            function clickAction(d, i) {
               let draw_position = dual_teams[1-i].draw_position;
               if (i == 0) {
                  dual_match.score = dual_match.score ? `${dual_match.score} RET.` : '0-0 W.O.';
                  dfx.advancePosition({ node: e.draw, position: draw_position });
               } else if (i == 1) {
                  dual_match.score = '0-0 W.O.';
                  dfx.advancePosition({ node: e.draw, position: draw_position });
               } else if (i == 2) {
                  dual_match.score = '0-0 DEF.';
                  dfx.advancePosition({ node: e.draw, position: draw_position });
               }
               displayDualMatches(dual_match, dual_teams);
               tree_draw.data(e.draw)();
            }
         }
      }

      function hideOpponentSelections() {
         if (!container.dual.element) return;
         Array.from(container.dual.element.querySelectorAll('select'))
            .forEach(s => s.style.display = 'none');
         Array.from(container.dual.element.querySelectorAll('input'))
            .forEach(s => s.style.display = 'inline');
      }

      function displayOrderedMatches(e, dual_match, dual_teams) {
         if (!e) return;
         let elem = container.dual.element.querySelector('.ordered_dual_matches');
         let matches = mfx.dualMatchMatches(e, dual_match.match.muid);
         displayGen.orderedDualMatches({ element: elem, matches });

         // events for entering scores and selecting opponents
         util.addEventToClass('dual_match', dualMatchClick);
         util.addEventToClass('dual_match_team_name', dualMatchOpponent);

         // capture CHANGE event for all DDLB
         util.addEventToClass('dual_select', (evt) => evt.stopPropagation());
         util.addEventToClass('dual_select', opponentSelected, document, 'change');

         // clicking anywhere else on the page hides active DDLB
         container.dual.element.addEventListener('click', hideOpponentSelections);

         function dualMatchOpponent(evt) {
            if (state.edit) {
               evt.stopPropagation();
               let dm_elem = util.getParent(evt.target, 'dual_match');
               let match_muid = dm_elem.getAttribute('muid');
               let match = matches.reduce((p, c) => c.match.muid == match_muid ? c : p, undefined);
               if (match.match.score) return dualMatchClick(evt);
               let team_name = util.getParent(evt.target, 'dual_match_team_name');
               let team_index = team_name.getAttribute('team');
               let inputs = Array.from(team_name.querySelectorAll('input'));
               hideOpponentSelections();

               if (evt.target.localName == 'input') {
                  let opponent_select = evt.target.nextElementSibling;
                  evt.target.style.display = 'none';
                  opponent_select.style.display = 'inline';
                  let opponent = evt.target.getAttribute('opponent');

                  let dual_team = dual_teams[team_index];

                  let players = Object.keys(dual_team.players)
                     .map(puid => tfx.findTournamentPlayer({tournament, puid}))
                     .filter(p=>p && p.signed_in);

                  let selected;
                  let existing_opponent;
                  if (match.teams && match.teams[team_index]) {
                     existing_opponent = match.teams[team_index][1 - opponent];
                     let player = match.teams[team_index][opponent];
                     selected = player && player.puid;
                  }

                  let gendered_players = players
                     .filter(p => match.gender ? p.sex == match.gender : true)
                     .filter(p => !existing_opponent || p.puid != existing_opponent.puid);

                  let options = [{ puid: '', text: `- ${lang.tr('phrases.selectplayer')}`}].concat(...gendered_players.map(p=>({ puid: p.puid, text: p.full_name })));
                  setOpponentOptions(opponent_select, options, selected);
               }
            }
         }

         function opponentSelected(evt) {
            let elem = evt.target;
            let dm_elem = util.getParent(elem, 'dual_match');
            let match_muid = dm_elem && dm_elem.getAttribute('muid');
            let match = matches.reduce((p, c) => c.match.muid == match_muid ? c : p, undefined);

            let team_name = util.getParent(elem, 'dual_match_team_name');
            let team_index = team_name && team_name.getAttribute('team');
            let opponent = elem.getAttribute('opponent');

            let selection = elem.options[elem.selectedIndex];
            let puid = selection.getAttribute('puid');

            let opponent_input = evt.target.previousElementSibling;
            opponent_input.style.display = 'inline';

            if (!match.teams) match.teams = [];
            if (!match.teams[team_index]) match.teams[team_index] = [];
            if (puid) {
               let player = tfx.findTournamentPlayer({tournament, puid});
               match.teams[team_index][opponent] = player;
               opponent_input.value = selection.text;
            } else {
               match.teams[team_index][opponent] = undefined;
               opponent_input.value = '';
            }

            // if there are no matches remove empty teams;
            if ([].concat(...match.teams.map(f=>f.filter(f=>f))).length == 0) {
               delete match.teams;
               delete match.match.schedule;
            }

            matchesTab();
            saveTournament(tournament);
            hideOpponentSelections();
         }

         function setOpponentOptions(dropDown, options, selected) {
            if (selected) options[0] = { puid: '', text: `- ${lang.tr('phrases.clearselection')}`};
            dropDown.innerHTML = options.map(o => {
               let is_selected = selected == o.puid ? 'selected' : '';
               return `<option puid='${o.puid}' ${is_selected}>${o.text}</option>`
            }).join('');
         }  

         function dualMatchClick(evt) {
            hideOpponentSelections();
            evt.stopPropagation();
            let dm_elem = util.getParent(evt.target, 'dual_match');
            let match_muid = dm_elem.getAttribute('muid');
            let match = matches.reduce((p, c) => c.match.muid == match_muid ? c : p, undefined);
            let teams = match.teams && [].concat(...match.teams.map(t=>[].concat(...t))).filter(f=>f);
            let all_players = teams && ((match.format == 'doubles' && teams.length == 4) || (match.format == 'singles' && teams.length == 2));
            if (state.edit && all_players) {

               let scoreboard = env.scoreboard.settings;
               let scoring_format = (e.scoring_format && e.scoring_format[match.format]) || scoreboard[match.format];
               let score_format = match.score_format || scoring_format || {};
               if (!score_format.final_set_supertiebreak) score_format.final_set_supertiebreak = e.format == 'D' ? true : false;

               let existing_scores = match.match.score ? 
                  scoreBoard.convertStringScore({
                     string_score: match.match.score,
                     score_format: match.match.score_format || {},
                     winner_index: match.match.winner_index
                  }) : undefined;

               let delegation = env.scoring.delegation;
               scoreBoard.setMatchScore({
                  delegation,
                  muid: match_muid,
                  teams: match.teams,
                  existing_scores,
                  container,
                  score_format,
                  round_name: match.round_name,
                  callback: scoreSubmitted,
                  flags: env.assets.flags,
               });

               function scoreSubmitted(outcome) {
                  if (outcome && outcome.delegate) return delegateMatch(match, outcome.teams, outcome.score_format);
                  if (outcome) { scoreDualDraw({ tournament, e, dual_match, dual_teams, muid: match.match.muid, outcome }); }
               }
            }
         }
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
         let result = tfx.safeScoreRoundRobin(tournament, e, existing_scores, outcome);
         return processResult(tournament, e, result);
      }

      function processResult(tournament, e, result) {
         if (!result) {
            console.log('no result!');
            result = {};
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
            afterScoreUpdate(tournament, e, result.muid);
         }

         // if event is complete, send tournament to cloud
         if (dfx.drawInfo(e.draw).complete) pushTournament2Cloud(tournament);
         return result;
      }

      function updateAfterDelete(e) {
         e.up_to_date = false;
         let completed_matches = mfx.eventMatches(e, tournament).filter(m=>m.match && m.match.winner);
         if (!completed_matches.length) e.active = false;
         afterScoreUpdate(tournament, e);
      }

      function afterScoreUpdate(tournament, e, muid) {
         e.up_to_date = false;
         if (staging.broadcasting()) {
            if (env.publishing.livescore) { console.log('live score?'); }
            if (env.publishing.publish_on_score_entry) broadcastEvent(tournament, e);
         }
         if (!staging.broadcasting() || !env.publishing.publish_on_score_entry) {
            if (muid) {
               updateScheduleStatus({ muid });
            } else {
               updateScheduleStatus({ euid: e.euid });
            }
         }
         if (e.euid == displayed.draw_event.euid) {
            displayGen.drawBroadcastState(container.publish_state.element, e);
         }

         enableDrawActions();
         saveTournament(tournament);
      }

      // Doubles TODO: assign sub_order to both team players
      function rrTeamOrder(d) {
         if (!state.edit) return;
         let bracket = displayed.draw_event.draw.brackets[d.bracket];
         let team = bracket.teams.reduce((p, c) => c[0].draw_position == d.row ? c : p, undefined);
         let tied = bracket.teams.filter(t=>t[0].qorder == team[0].qorder);
         if (tied.length > 1) {
            let draw_id = `rrDraw_${d.bracket}`;
            let selector = d3.select(`#${container.draws.id} #${draw_id} svg`).node();
            let coords = d3.mouse(selector);
            let options = tied.map((p, i) => `${lang.tr('ord')}: ${i+1}`);
            let clickAction = (c, i) => {
               // first insure that no other team has the same sub_order
               bracket.teams.filter(t=>t[0].qorder == team[0].qorder).forEach(t => { if (t[0].sub_order == i + 1) t[0].sub_order = 0 });

               // assign sub_order to selected team
               team[0].sub_order = i + 1;

               // update data
               rr_draw.data(displayed.draw_event.draw);
               // update one bracket without regenerating all brackets!
               rr_draw.updateBracket(d.bracket);

               displayed.draw_event.up_to_date = false;
               if (staging.broadcasting() && env.publishing.publish_on_score_entry) broadcastEvent(tournament, displayed.draw_event);
               displayGen.drawBroadcastState(container.publish_state.element, displayed.draw_event);
               saveTournament(tournament);
            }
            cMenu({ selector, coords, options, clickAction })
         }
      }

      // for generating draws when there are events which have been created by CourtHive Tournaments
      function genEventDraw(value) {
         let draw_width = +d3.select('#main').style('width').match(/\d+/)[0] * .9;
         let e = tournament.events[value];
         displayed.draw_event = e;

         eventManager.holdActions.positionHoldAction = positionHoldAction;

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
               'click': captureContextPopUp,
               'contextmenu': contextPopUp,
            },
            'player2': {
               'click': captureContextPopUp,
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
            'qorder': {
               'click': rrTeamOrder,
               'contextmenu': rrTeamOrder,
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
               displayed.dual_match = null;
               container.dual.element.style.display = 'none';
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
         if (displayed.draw_event && e.euid == displayed.draw_event.euid) {
            displayGen.drawBroadcastState(container.publish_state.element, e);
         }

         if (tfx.isTeam(tournament) && e.draw && e.draw.opponents && e.draw.opponents.length == 2) { teamTournamentScore({ data: e.draw }); }

         eventList();
         return;

         // SUPPORTING FUNCTIONS...
         function RRplayerStats(d) {
            if (state.edit) {
               let player = displayed.draw_event.draw.brackets[d.bracket].players.reduce((p, c) => c.draw_position == d.row ? c : p, undefined);
               let content = displayGen.roundRobinResults(player.results);
               displayGen.floatingModal({ label: `${player.first_name} ${player.last_name}`, mouse: true, content });
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
            let current_draw = displayed.draw_event.draw.compass ? displayed.draw_event.draw[displayed.draw_event.draw.compass] : displayed.draw_event.draw;
            let linked = tfx.findEventByID(tournament, e.links['Q']) || tfx.findEventByID(tournament, e.links['R']);
            if (linked && linked.qualified && team) {
               let qualifier_ids = linked.qualified.map(teamHash);
               if (qualifier_ids.indexOf(team[0].id) >= 0) { team[0].entry = 'Q'; }
            }
            dfx.assignPosition({ node: current_draw, position, team, bye, qualifier });

            let team_ids = !team ? [] : team.map(t=>t.id);
            tfx.logEventChange(displayed.draw_event, { fx: 'position assigned', d: { position, bye, qualifier, team: team_ids } });
         }

         function rrScoreEntry(d) {
            if (d3.event.ctrlKey || d3.event.shiftKey) return rrScoreAction(d);

            // time since contextClick; used to prevent Safari event propagation
            let scct = new Date().getTime() - ccTime;
            if (scct < 400) return;

            d3.event.preventDefault();
            if (!state.edit || !d.teams || d.teams.filter(f=>f).length < 2) return;
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

               if (outcome && outcome.delegate) return delegateMatch(d.match, outcome.teams, outcome.score_format);

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

               let teams = d.match.teams;
               let muid = d.match.muid;
               let evnt = displayed.draw_event;
               let score_format = d.match.score_format || evnt.score_format || {};
               if (!score_format.final_set_supertiebreak) score_format.final_set_supertiebreak = e.format == 'D' ? true : false;

               let delegation = env.scoring.delegation;
               scoreBoard.setMatchScore({
                  muid,
                  teams,
                  container,
                  delegation,
                  score_format,
                  round_name: d.match.round_name || 'RR',
                  existing_scores,
                  callback: scoreSubmitted,
                  flags: env.assets.flags,
               });
            } else {
               console.log('missing match data');
               util.logError({ error: 'missing match data', click: d });
            }
         }

         function rrScoreAction(d) {
            if (state.edit) {
               ccTime = new Date().getTime();
               var bracket = displayed.draw_event.draw.brackets[d.bracket];
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
            }

            function removeOption(d) {
               let result = tfx.removeQualifiedRRplayers(tournament, displayed.draw_event, bracket);
               if (result.remove_players) {
                  // update schedule to reflect match score removal
                  if (d.match.muid) updateScheduleStatus({ muid: d.match.muid });
                  if (result.linkchanges) approvedChanged(result.qlink);

                  // clean up match node
                  tfx.pruneMatch(d.match);
                  deleteMatch(d.match.muid);
                  updateAfterDelete(displayed.draw_event);

                  // update one bracket without regenerating all brackets!
                  rr_draw.updateBracket(d.bracket);
                  matchesTab();
               } else {
                  displayGen.okCancelMessage(lang.tr('phrases.cantdelqual'), () => displayGen.closeModal());
               }

               tfx.logEventChange(displayed.draw_event, { fx: 'match score removed', d: { muid: d.match.muid } });
            }
         }

         function rrPositionClick(d) {
            if (state.edit) {
               var draw_id = `rrDraw_${d.bracket}`;
               var selector = d3.select(`#${container.draws.id} #${draw_id} svg`).node();
               let coords = getCoords(d, selector);
               if (d3.event.ctrlKey || d3.event.shiftKey) {
                  return rrContextPopUp(d, coords);
               }
               if (d.team && d.team.length && d.team[0].puid) {
                  return rrContextPopUp(d, coords);
               } else if (state.edit && d.mc == undefined) {
                  let info = rr_draw.info();
                  if (info.open_seed_positions && info.open_seed_positions.length) {
                     let valid_placements = info.open_seed_positions.map(osp => `${osp.bracket}|${osp.position}`);
                     let clicked_position = `${d.bracket}|${d.row}`;
                     if (valid_placements.indexOf(clicked_position) >= 0) placeRRDrawPlayer(d, coords);
                  } else {
                     if (!d.bye) placeRRDrawPlayer(d, coords);
                  }
               }
            }
         }

         function compassClick(d) {
            console.log('displayed event:', displayed.draw_event);
         }

         function positionClick(d) {
            let node = d3.select(this);
            highlightCell(node);
            d3.event.preventDefault();

            if (state.edit) {
               let coords = getCoords(d, container.draws.element);

               if (d3.event.ctrlKey || d3.event.shiftKey) {
                  contextPopUp(d, coords);
               } else {
                  treePositionClick(d, coords);
               }
            } else if (tfx.isTeam(tournament)) {
               teamTournamentScore(d);
            }
         }

         function captureContextPopUp(d) {
            if (state.edit) {
               let coords = getCoords(d, container.draws.element);

               if (d3.event.ctrlKey || d3.event.shiftKey) {
                  contextPopUp(d, coords);
               } else if (tfx.isTeam(tournament)) {
                  teamTournamentScore(d);
               } else {
                  contextPopUp(d, coords);
               }
            }
         }

         function treePositionClick(d, coords) {
            if (!d.height && !d.data.bye && !d.data.team) { return placeTreeDrawPlayer(d, coords); }
            if (tfx.isTeam(tournament)) return teamTournamentScore(d);

            // don't go any further if the draw is incomplete...
            if (displayed.draw_event && dfx.drawInfo(displayed.draw_event.draw).unassigned.length) { return; }

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

               if (outcome && outcome.delegate) return delegateMatch(d.data.match, outcome.teams, outcome.score_format);

               // this must happen first as 'e' is modified
               scoreTreeDraw({ tournament, e, muid: d.data.match.muid, existing_scores, outcome });

               tree_draw.unHighlightCells();
               tree_draw.data(e.draw)();
               matchesTab();
            }

            let round_name = (d.data.match && d.data.match.round_name) || '';

            if (team_match) {
               let muid = d.data.match.muid;
               let evnt = displayed.draw_event;
               let score_format = (d.data.match && d.data.match.score_format) || evnt.score_format || {};
               if (!score_format.final_set_supertiebreak) score_format.final_set_supertiebreak = e.format == 'D' ? true : false;

               let delegation = env.scoring.delegation;
               let submission = {
                  muid,
                  container,
                  round_name,
                  delegation,
                  score_format,
                  existing_scores,
                  teams: team_match,
                  callback: scoreSubmitted,
                  flags: env.assets.flags,
               };
               scoreBoard.setMatchScore(submission);
            }
         }

         function teamTournamentScore(d) {
            let dual_match = d && d.data;
            displayed.dual_match = dual_match;
            let dual_teams = getDualTeams(dual_match);
            if (dual_teams && dual_teams.length && dual_teams.length == 2) { displayDualMatches(dual_match, dual_teams); }
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
            let teams = pfx.optionNames(remaining.map(r=>current_draw.seeded_teams[r]).filter(f=>f));
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
            tfx.logEventChange(displayed.draw_event, { fx: 'assign seed', d: { pos: position, team: team.map(p=>p.id) } });

            let { remaining, positions, teams } = getSeedTeams(seed_group);
            if (remaining.length == 1 && displayed.draw_event.draw_type != 'Q') {
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

         function placeRRDrawPlayer(d, coords) {
            let placement = { bracket: d.bracket, position: d.row };
            let info = rr_draw.info();
            if (info.unfilled_positions.length) {
               let pobj = displayGen.manualPlayerPosition({ container, position: d.row });
               rrPlacePlayer(placement, pobj, info, d, coords);
               displayGen.escapeModal();
            }
         }

         function rrPlacePlayer(placement, pobj, info, d, coords) {
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
            pobj.player_pick.element.addEventListener('click', () => { removeEntryField(); rrContextPopUp(d, coords); } , false);

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
               return placeRRteam(team, placement, info);
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
                     return placeRRteam(team, placement, info);
                  }

                  function invalidEntry() { pobj.player_index.element.value = ''; }
               }

               pobj.player_index.element.value = util.numeric(value) || '';
            }
         }

         function placeTreeDrawPlayer(d, coords) {
            let current_draw = e.draw.compass ? e.draw[e.draw.compass] : e.draw;
            let position = d.data.dp;
            let info = tree_draw.info();

            let seed_group = dfx.nextSeedGroup({ draw: current_draw });
            if (seed_group && seed_group.positions.indexOf(position) < 0) return;
            if (!current_draw.unseeded_placements || !current_draw.unseeded_teams) return;

            let placements = current_draw.unseeded_placements ? current_draw.unseeded_placements.map(p=>p.id) : [];
            var unplaced_teams = current_draw.unseeded_teams ? current_draw.unseeded_teams.filter(team => placements.indexOf(team[0].id) < 0) : [];

            if (seed_group) {
               // Doubles TODO: support doubles teams;
               let seed_group_ids = e.approved.filter((a, i) => seed_group.range.indexOf(i + 1) >= 0);
               unplaced_teams = tournament.players.filter(p=>seed_group_ids.indexOf(p.id) >= 0).map(p=>[p]);
            }

            if (e.format == 'D') {
               // get an Object/array of teams in rank order
               let approved_teams = tfx.approvedDoubles({ tournament, e });
               let approved_hash = Object.keys(approved_teams).map(k=>teamHash(approved_teams[k].players));
               // use hash of ordered teams to add order to unplaced
               unplaced_teams.forEach(team => team.order = approved_hash.indexOf(teamHash(team)) + 1);
            } else {
               unplaced_teams.forEach(team => team.order = team.order || e.approved.indexOf(team[0].id) + 1);
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
            pobj.player_pick.element.addEventListener('click', () => { removeEntryField(); contextPopUp(d, coords); } , false);

            let selection_flag = false;
            let opponentLabel = (opponent) => util.normalizeName(opponent.name || [opponent.first_name, opponent.last_name].join(' '));
            let list = unplaced_teams.map(team => { 
               let label = opponentLabel(team[0]);
               if (e.format == 'D') label += `/${opponentLabel(team[1])}`;
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

         function rrContextPopUp(d, coords) {
            if (state.edit) {
               var draw_id = `rrDraw_${d.bracket}`;
               var selector = d3.select(`#${container.draws.id} #${draw_id} svg`).node();
               coords = coords && typeof coords == 'object' ? coords : getCoords(d, selector);

               var draw = displayed.draw_event.draw;
               var info = dfx.drawInfo(draw);
               rrContextActions(d, draw, info, coords);
            }
         }

         function getCoords(d, selector) {
            let bod = d3.select('body').node();
            let evt = (d3.event);
            var mouse = selector ? d3.mouse(selector) : [0, 0];
            return { selector_x: mouse[0], selector_y: mouse[1], screen_x: evt.clientX, screen_y: evt.clientY }
         }

         function rrContextActions(d, draw, info, coords) {
            if (!draw.unseeded_placements) draw.unseeded_placements = [];

            function hashFx(h) { return [h.bracket, h.position].join('|'); }
            var u_hash = info.unplaced_seeds.length ? info.open_seed_positions.map(hashFx) : info.unfilled_positions.map(hashFx);

            var placements = draw.unseeded_placements ? draw.unseeded_placements.map(p=>p.team[0].id) : [];
            var unplaced = info.unplaced_seeds.length ? info.unplaced_seeds : draw.unseeded_teams.filter(team => placements.indexOf(team[0].id) < 0);
            var unplaced_teams = tfx.teamSort(unplaced);

            // must be a unique selector in case there are other SVGs
            var draw_id = `rrDraw_${d.bracket}`;
            var selector = d3.select(`#${container.draws.id} #${draw_id} svg`).node();
            // var coords = d3.mouse(selector);

            var placement = { bracket: d.bracket, position: d.row };
            var position_unfilled = u_hash.indexOf(hashFx(placement)) >= 0;

            if (position_unfilled) {
               placeTeam(unplaced_teams, placement, info);
            } else if (d.team && placement.position) {
               // placement.position restricts removal to cells with full name because removing from row 0 causes errors...
               assignedRRoptions(placement, d, draw);
            }

            function placeTeam(unplaced_teams, placement, info) {
               // SORT PICK LIST
               unplaced_teams.sort((a, b) => a[0].draw_order - b[0].draw_order);

               let options = pfx.optionNames(unplaced_teams);
               let clickAction = (d, i) => {
                  let team = unplaced_teams[i];
                  placeRRteam(team, placement, info);
               }

               // let bod = d3.select('body').node();
               // let evt = (d3.event);
               // displayGen.svgModal({ x: evt.clientX, y: evt.clientY, options, callback: clickAction });
               displayGen.svgModal({ x: coords.screen_x, y: coords.screen_y, options, callback: clickAction });
            }

            function assignedRRoptions(placement, cell, draw) {
               let info = dfx.drawInfo(draw);
               let bracket = draw.brackets[placement.bracket];
               let filled = info.unfilled_positions.length == 0;
               let options = [];

               let team_matches = bracket.matches.filter(m=>m.teams.map(puidHash).indexOf(puidHash(cell.team))>=0 && m.score);

               let alternates;
               if (displayed.draw_event.format == 'D') {
                  let approved = [].concat(...displayed.draw_event.approved);
                  let unapproved_teams = displayed.draw_event.teams.filter(t=>util.intersection(approved, t).length == 0)
                  alternates = unapproved_teams.map(team=>tournament.players.filter(p=>team.indexOf(p.id) >= 0));
               } else {
                  // alternates = tfx.eligiblePlayers(tournament, displayed.draw_event).players.map(p=>[p]);
                  let eligible = tfx.eligiblePlayers(tournament, displayed.draw_event).players;
                  if (e.ratings_filter && e.ratings && e.ratings.type) { eligible = filteredEligible(e, eligible); }
                  alternates = eligible.map(p=>[p]);
               }

               if (!team_matches.length) {
                  options.push({ option: lang.tr('draws.remove'), key: 'remove' });
                  if (filled && !displayed.draw_event.active) {
                     if (alternates.length) options.push({ option: lang.tr('draws.alternate'), key: 'alternate' });
                  }
                  options.push({ option: lang.tr('actions.cancel'), key: 'cancel' });
               }
               let unseeded_position = draw.unseeded_placements.reduce((p, c) => c.team && puidHash(c.team) == puidHash(cell.team) ? true : p, undefined);
               let clickAction = (d, i) => {
                  if (d.key == 'remove') {
                     bracket.players = bracket.players.filter(player => player.id != cell.team[0].id);

                     bracket.teams = bracket.teams.filter(team => puidHash(team) != puidHash(cell.team || []));

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

                     tfx.logEventChange(displayed.draw_event, { fx: 'team removed', d: { placement, team: [puidHash(cell.team)] } });

                     saveTournament(tournament);
                     outOfDate(e, true);
                  }
                  if (d.key == 'alternate') {
                     return rrAlternates({ selector, info, placement, unseeded_position, coords, draw, options: alternates, entry: 'A' });
                  }
               }
               cMenu({ selector, coords: [coords.selector_x, coords.selector_y], options, clickAction })
            }
         }

         function rrAlternates({ selector, info, placement, unseeded_position, coords, draw, options, entry }) {
            let teams = pfx.optionNames(options);
            let clickAction = (d, i) => {
               let new_team = options[i];
               let bracket = draw.brackets[placement.bracket];

               let old_team = bracket.teams.reduce((p, c) => c[0].draw_position == placement.position ? c : p, undefined);

               new_team.forEach(player => {
                  if (entry) player.entry = entry;
                  player.draw_position = placement.position;
                  delete player.seed;
               });

               draw.opponents = draw.opponents.filter(o => puidHash(o) != puidHash(old_team));

               bracket.players = bracket.players.filter(p=>p.draw_position != placement.position);
               bracket.teams = bracket.teams.filter(t=>t[0].draw_position != placement.position);

               // perform operation for both unseeded and seeded as removing alternates who have replaced seeds changes status
               draw.unseeded_placements = draw.unseeded_placements
                  .filter(f=>!(f.position.bracket == placement.bracket && f.position.position == placement.position));
               Object.keys(draw.seeded_teams).forEach(key => {
                  if (puidHash(draw.seeded_teams[key]) == puidHash(old_team)) draw.seeded_teams[key] = new_team;
               });

               if (unseeded_position) {
                  draw.unseeded_teams = draw.unseeded_teams.filter(team => puidHash(team) != puidHash(old_team));
                  draw.unseeded_teams.push(new_team);
               }

               bracket.teams.push(new_team);
               draw.opponents.push(new_team);
               draw.unseeded_placements.push({ team: new_team, position: placement });

               swapApproved(displayed.draw_event, old_team, new_team, placement.position);

               dfx.matches(draw);
               rr_draw.data(draw);
               rr_draw.updateBracket(placement.bracket, true);
               saveTournament(tournament);
               outOfDate(e, true);
            }
            displayGen.svgModal({ x: coords.screen_x, y: coords.screen_y, options: teams, callback: clickAction });
         }

         function placeRRteam(team, placement, info) {
            dfx.pushBracketTeam({ draw: e.draw, team, bracket_index: placement.bracket, position: placement.position });

            if (info.unplaced_seeds.length) {
               info.unfinished_seed_placements[0].placements.push({ position: placement, seed: team[0].seed });
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
            tfx.logEventChange(displayed.draw_event, { fx: 'position assigned', d: { placement, team: team.map(t=>t.id) } });
            saveTournament(tournament);
            outOfDate(e, true);
         }

         function positionHoldAction(hold_element, coords) {
            let elem = d3.select(hold_element);
            let elem_data = elem && elem.data();
            let selector = tree_draw.selector();
            let offsetTop = selector.offsetTop;
            let offsetLeft = selector.offsetLeft;
            let d = elem_data && elem_data[0];
            if (d) {
               let crds = [coords[0] - offsetLeft, coords[1] - offsetTop];
               contextPopUp(d, crds);
            }
         }

         // this function needs to be in scope of createTournamentContainer()
         // so that it can have access to container.draws.element
         function contextPopUp(d, coords) {
            coords = coords && typeof coords == 'object' ? coords : getCoords(d, container.draws.element);

            if (!state.edit) {
               return;
            } else if (!displayed.draw_event.active) {
               try { drawNotActiveContextClick(d, coords); }
               catch (err) { tfx.logEventError(e, err, 'drawNotActiveContextClick'); }
            } else {
               if (!tfx.isTeam(tournament)) {
                  try { drawActiveContextClick(d, coords); }
                  catch (err) { tfx.logEventError(e, err, 'drawActiveContextClick'); }
               }
            }
         }

         function swapApproved(evt, remove, add, position) {
            let remove_ids = remove ? remove.map(p=>p.id) : [];
            let add_ids = add ? add.map(p=>p.id) : [];
            if (add_ids.length == 2) {
               evt.approved = evt.approved.filter(a=>util.intersection(a, remove_ids).length != 2);
               evt.approved.push(add.map(p=>p.id));
            } else {
               evt.approved = evt.approved.filter(a=>a!=remove_ids[0]);
               evt.approved.push(add[0].id);
            }
            tfx.logEventChange(displayed.draw_event, { fx: 'player replaced', d: { position, removed: remove_ids, added: add_ids } });
         }

         // select either lucky losers or alternates
         function luckyAlternates({ info, position, node, coords, draw, options, entry, bye_advanced, callback }) {
            let teams = pfx.optionNames(options);
            let clickAction = (d, i) => {
               let team = options[i].map(o => tfx.isTeam(tournament) ? pfx.dualCopy(o) : pfx.playerCopy(o));
               team.forEach(player => {
                  player.draw_position = position;
                  delete player.seed;
               });
               let nodes = info.nodes.filter(f=>f.data.dp == position);
               nodes.forEach(node => node.data.team = team);

               let remove = draw.opponents.reduce((p, o) => o[0].draw_position == position ? o : p, undefined);
               draw.opponents = draw.opponents.filter(o=>o[0].draw_position != position);
               draw.opponents.push(team);
               swapApproved(displayed.draw_event, remove, team, position);
               if (entry) team.forEach(player => player.entry = entry);

               // if new team entry is LL then add to luckylosers id array
               if (entry == 'LL') { displayed.draw_event.luckylosers.push(team[0].id); }

               // removed player should not appear in lucky losers
               displayed.draw_event.luckylosers = displayed.draw_event.luckylosers.filter(l=>l != remove[0].id);

               if (bye_advanced) {
                  delete node.data.bye;
                  let advnode = info.nodes.reduce((p, c) => c.height == 1 && c.data && c.data.dp==bye_advanced ? c : p);
                  if (advnode && advnode.data) {
                     delete advnode.data.team;
                     delete advnode.data.dp;
                  }
               }

               if (typeof callback == 'function') callback();
               tree_draw.data(draw)();
               saveTournament(tournament);
               outOfDate(displayed.draw_event, true);
            }
            displayGen.svgModal({ x: coords.screen_x, y: coords.screen_y, options: teams, callback: clickAction });
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
            let teams = pfx.optionNames([node.data.team]);
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

            let approved = [].concat(...displayed.draw_event.approved);
            let unapproved_teams = !info.doubles ? [] : displayed.draw_event.teams.filter(t=>util.intersection(approved, t).length == 0)
            let doubles_alternates = unapproved_teams.map(team=>tournament.players.filter(p=>team.indexOf(p.id) >= 0));

            let alternates;
            if (info.doubles) {
               alternates = doubles_alternates;
            } else if (tfx.isTeam(tournament)) {
               alternates = tfx.eligibleTeams(tournament, displayed.draw_event).teams.map(t=>[t]);
            } else {
               // alternates = tfx.eligiblePlayers(tournament, displayed.draw_event).players.map(p=>[p]);
               let eligible = tfx.eligiblePlayers(tournament, displayed.draw_event).players;
               if (e.ratings_filter && e.ratings && e.ratings.type) { eligible = filteredEligible(e, eligible); }
               alternates = eligible.map(p=>[p]);
            }

            let competitors = [].concat(...draw.opponents.map(team=>team.map(p=>p.id)));
            let linkedQ = tfx.findEventByID(tournament, displayed.draw_event.links['Q']) || tfx.findEventByID(tournament, displayed.draw_event.links['R']);
            let linked_info = linkedQ && linkedQ.draw ? dfx.drawInfo(linkedQ.draw) : undefined;

            // losers from linked draw excluding losers who have already been substituted
            let losers = linkedLosers(linked_info).filter(l=>util.intersection(l.map(p=>p.id), competitors).length == 0);

            let finished_options = [];
            if (!displayed.draw_event.active && !position_active && swap_positions.length) finished_options.push({ option: lang.tr('draws.swap'), key: 'swap' });
            if (!position_active && alternates.length) finished_options.push({ option: lang.tr('draws.alternate'), key: 'alt' });
            if (!position_active && losers.length) finished_options.push({ option: lang.tr('draws.luckyloser'), key: 'lucky' });
            finished_options.push({ option: lang.tr('ccl'), key: 'cancel' });

            if (!unfinished && !finished_options.length) return;

            let options = unfinished ? unfinished_options : finished_options;
            let clickAction = (d, i) => {
               if (unfinished) {
                  tfx.logEventChange(displayed.draw_event, { fx: 'player removed', d: { position, team: node.data.team.map(t=>t.id) } });

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
                  outOfDate(displayed.draw_event, true);
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

                                    tfx.logEventChange(displayed.draw_event, { fx: 'swap', d: [ position, new_position ] });
                                    dfx.advanceTeamsWithByes({ draw });
                                    tree_draw.data(draw)();
                                    saveTournament(tournament);

                                    outOfDate(displayed.draw_event, true);
                                 }

                                 removeEntryField();
                              }
                           }
                        }

                     } else if (d.key == 'alt') {
                        return luckyAlternates({ info, position, node, coords, draw, options: alternates, entry: 'A' });
                     } else if (d.key == 'lucky') {
                        return luckyAlternates({ info, position, node, coords, draw, options: losers, entry: 'LL' });
                     }
                  }
               }
            }
            cMenu({ selector, coords: [coords.selector_x, coords.selector_y], options, clickAction })
         }

         function drawActiveContextClick(d, coords) {
            let current_draw = e.draw.compass ? e.draw[e.draw.compass] : e.draw;
            var position = d.data.dp;

            var info = dfx.drawInfo(current_draw);

            // TODO: are consolation draws considered??
            var linked = tfx.findEventByID(tournament, e.links['E']) || tfx.findEventByID(tournament, e.links['S']);
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

            if (d.data.bye) {
               let paired_positions = info.nodes.filter(f=>f.height == 1 && f.children).map(m=>[].concat(...m.children.map(c=>c.data.dp)));
               let bye_positions = info.byes.map(b=>b.data.dp);
               let paired_with_bye = paired_positions.filter(p=>util.intersection(p, bye_positions).length);
               let position_paired_with_bye = paired_with_bye.filter(p=>p.indexOf(position) >= 0).length > 0;

               let advanced_positions = info.match_nodes.filter(n=>n.data.match && n.data.match.players);
               let active_player_positions = [].concat(...advanced_positions.map(n=>n.data.match.players.map(p=>p.draw_position)));

               let approved = [].concat(...displayed.draw_event.approved);
               let unapproved_teams = !info.doubles ? [] : displayed.draw_event.teams.filter(t=>util.intersection(approved, t).length == 0)
               let doubles_alternates = unapproved_teams.map(team=>tournament.players.filter(p=>team.indexOf(p.id) >= 0));

               let losers;
               let alternates;

               if (info.doubles) {
                  alternates = doubles_alternates;
               } else if (tfx.isTeam(tournament)) {
                  alternates = tfx.eligibleTeams(tournament, displayed.draw_event).teams.map(t=>[t]);
               } else {
                  let eligible = tfx.eligiblePlayers(tournament, displayed.draw_event).players;
                  if (e.ratings_filter && e.ratings && e.ratings.type) { eligible = filteredEligible(e, eligible); }
                  alternates = eligible.map(p=>[p]);

                  let competitors = [].concat(...current_draw.opponents.map(team=>team.map(p=>p.id)));
                  let linkedQ = tfx.findEventByID(tournament, displayed.draw_event.links['Q']) || tfx.findEventByID(tournament, displayed.draw_event.links['R']);
                  let linked_info = linkedQ && linkedQ.draw ? dfx.drawInfo(linkedQ.draw) : undefined;

                  // losers from linked draw excluding losers who have already been substituted
                  losers = linkedLosers(linked_info).filter(l=>util.intersection(l.map(p=>p.id), competitors).length == 0);
               }

               let bye_advanced = paired_with_bye.reduce((p, c) => c.indexOf(position)>=0 ? c : p, []).filter(p=>p!=position)[0];

               let possible_to_replace = active_player_positions.indexOf(bye_advanced) < 0;
               if (possible_to_replace) {
                  let options = [{ option: lang.tr('draws.alternate'), key: 'alt' }];
                  if (losers) { options.push({ option: lang.tr('draws.luckyloser'), key: 'lucky' }); }
                  let clickAction = (k, i) => {
                     if (k.key == 'alt') {
                        let callback = () => mfx.eventMatches(e, tournament);
                        luckyAlternates({ info, position, node: d, coords, draw: current_draw, options: alternates, entry: 'A', bye_advanced, callback });
                     } else if (k.key == 'lucky') {
                        let callback = () => mfx.eventMatches(e, tournament);
                        luckyAlternates({ info, position, node: d, coords, draw: current_draw, options: losers, entry: 'LL', bye_advanced, callback });
                     }
                  }
                  cMenu({ selector, coords: [coords.selector_x, coords.selector_y], options, clickAction })
               }
            } else if (match_score && possible_to_remove && !active_in_linked) {
               let options = [`${lang.tr('draws.remove')}: ${lang.tr('mtc')}`];

               // if deleting a match, delete all references in node
               let clickAction = (c, i) => {
                  if (qualified && d.data.team) {
                     let team_ids = d.data.team.map(m=>m.id);
                     removeQualifiedTeam(e, team_ids, linked, linked_info);
                  }

                  if (e.draw.compass && target_draw && d.data.match && d.data.match.loser) {
                     let losing_team_ids = d.data.match.loser.map(m=>m.id);
                     removeDirectionalPlayer(e, target_draw, losing_team_ids, linked_info);
                  }

                  tfx.logEventChange(displayed.draw_event, { fx: 'match removed', d: { teams: d.data.match.teams.map(team=>team.map(t=>t.id)) } });

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
            } else if (d.height == 0 && d.data.qualifier && !displayed.draw_event.active) {
               assignedQBOptions({ selector, position, node: d, coords, draw: current_draw, qualifier: true });
            } else if (d.height == 0 && d.data.bye && !displayed.draw_event.active) {
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

               // all draw positions which have a first-round opponent (no structural bye);
               let paired_positions = info.nodes.filter(f=>f.height == 1 && f.children).map(m=>[].concat(...m.children.map(c=>c.data.dp)));
               let bye_positions = info.byes.map(b=>b.data.dp);
               let paired_with_bye = paired_positions.filter(p=>util.intersection(p, bye_positions).length);
               let position_paired_with_bye = paired_with_bye.filter(p=>p.indexOf(position) >= 0).length > 0;

               let advanced_positions = info.match_nodes.filter(n=>n.data.match && n.data.match.players);
               let active_player_positions = [].concat(...advanced_positions.map(n=>n.data.match.players.map(p=>p.draw_position)));

               let approved = [].concat(...displayed.draw_event.approved);
               let unapproved_teams = !info.doubles ? [] : displayed.draw_event.teams.filter(t=>util.intersection(approved, t).length == 0)
               let doubles_alternates = unapproved_teams.map(team=>tournament.players.filter(p=>team.indexOf(p.id) >= 0));

               let losers;
               let alternates;
               if (info.doubles) {
                  alternates = doubles_alternates;
               } else if (tfx.isTeam(tournament)) {
                  alternates = tfx.eligibleTeams(tournament, e).teams.map(t=>[t]);
               } else {
                  let eligible = tfx.eligiblePlayers(tournament, e).players;
                  if (e.ratings_filter && e.ratings && e.ratings.type) { eligible = filteredEligible(e, eligible); }
                  alternates = eligible.map(p=>[p]);

                  let competitors = [].concat(...current_draw.opponents.map(team=>team.map(p=>p.id)));
                  let linkedQ = tfx.findEventByID(tournament, displayed.draw_event.links['Q']) || tfx.findEventByID(tournament, displayed.draw_event.links['R']);
                  let linked_info = linkedQ && linkedQ.draw ? dfx.drawInfo(linkedQ.draw) : undefined;

                  // losers from linked draw excluding losers who have already been substituted
                  losers = linkedLosers(linked_info).filter(l=>util.intersection(l.map(p=>p.id), competitors).length == 0);
               }

               if (alternates && alternates.length && what == 'BYE') {
                  finished_options.push({ option: lang.tr('draws.alternate'), key: 'alt' });
               }

               if (losers && losers.length && what == 'BYE') {
                  finished_options.push({ option: lang.tr('draws.luckyloser'), key: 'lucky' });
               }

               let clickAction = (d, i) => {
                  if (unfinished) {
                     node.data.bye = false;
                     node.data.qualifier = false;
                     delete node.data.team;
                  } else {
                     let bye_advanced = paired_with_bye.reduce((p, c) => c.indexOf(position)>=0 ? c : p, []).filter(p=>p!=position)[0];
                     if (d.key == 'alt' && what == 'BYE') {
                        let callback = () => mfx.eventMatches(e, tournament);
                        luckyAlternates({ info, position, node, coords, draw, options: alternates, entry: 'A', bye_advanced, callback });
                     } else if (d.key == 'lucky' && what == 'BYE') {
                        let callback = () => mfx.eventMatches(e, tournament);
                        luckyAlternates({ info, position, node, coords, draw, options: losers, entry: 'LL', bye_advanced, callback });
                     }
                  }
                  tree_draw();
                  saveTournament(tournament);
                  outOfDate(displayed.draw_event, true);
               }

               if (unfinished || finished_options.length) {
                  let options = unfinished ? unfinished_options : finished_options;
                  cMenu({ selector, coords: [coords.selector_x, coords.selector_y], options, clickAction })
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
                  cMenu({ selector, coords: [coords.selector_x, coords.selector_y], options: teams, clickAction })
               }
            }

            function assignUnseededPosition({ selector, position, draw, coords }) {
               let info = dfx.drawInfo(draw);
               let player_count = (draw.opponents ? draw.opponents.length : 0) + (draw.qualifiers || 0);
               let byes = info.draw_positions.length - (player_count + info.byes.length);
               let bye_positions = info.byes.map(b=>b.data.dp);
               let structural_bye_positions = info.structural_byes.map(b=>b.data.dp);

               let linked_q = tfx.findEventByID(tournament, displayed.draw_event.links['Q']) || tfx.findEventByID(tournament, displayed.draw_event.links['R']);
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

               let teams = pfx.optionNames(unplaced_teams);
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
               cMenu({ selector, coords: [coords.selector_x, coords.selector_y], options: teams, clickAction })
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
               cMenu({ selector, coords: [coords.selector_x, coords.selector_y], options, clickAction })
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

         let sb = scheduleFx.scheduleBox({ match, editable: true, options: env.schedule });
         if (schedule_box) {
            schedule_box.innerHTML = sb.innerHTML;
            scheduleFx.scaleTeams(schedule_box);
            schedule_box.style.background = sb.background;

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
            firstDay: env.calendar.first_day,
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
         env.date_pickers.push(pointsDatePicker);
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
            // unscheduleStrandedMatches();
            saveTournament(tournament);
         }
         function updateEndDate() {
            tournament.end = util.dateUTC(end);
            startPicker.setEndRange(end);
            startPicker.setMaxDate(end);
            endPicker.setEndRange(end);
            // unscheduleStrandedMatches();
            saveTournament(tournament);
         }
         function unscheduleStrandedMatches({ proposed_start, proposed_end }) {
            return new Promise((resolve, reject) => {
               // let date_range = util.dateRange(tournament.start, tournament.end).map(d=>util.formatDate(d));
               let date_range = util.dateRange(proposed_start, proposed_end).map(d=>util.formatDate(d));
               let { scheduled } = mfx.scheduledMatches(tournament);
               let stranded = scheduled.filter(s=>date_range.indexOf(s.schedule.day) < 0);

               if (!stranded.length) {
                  resolve();
               } else {
                  let message = `${lang.tr('phrases.matches2clear')}: ${stranded.length}`;
                  displayGen.okCancelMessage(message, unscheduleStranded, () => { displayGen.closeModal(); return reject(); });
               }

               function unscheduleStranded() {
                  stranded.forEach(match => {
                     match.schedule = {};
                     match.source.schedule = {};
                     matchEventOutOfDate(match);
                  });
                  resolve();
               }
            });
         }
         var startPicker = new Pikaday({
            field: container.start_date.element,
            defaultDate: start,
            setDefaultDate: true,
            i18n: lang.obj('i18n'),
            firstDay: env.calendar.first_day,
            onSelect: function() {
               let proposed_start = this.getDate();
               let proposed_end = tournament.end;
               let cancel = () => this.setDate(util.formatDate(tournament.start));
               unscheduleStrandedMatches({ proposed_start, proposed_end }).then(doIt, cancel);
               function doIt() {
                  start = proposed_start;
                  updateStartDate();
                  nextFieldFocus('start_date');
               }
            },
         })
         env.date_pickers.push(startPicker);
         var endPicker = new Pikaday({
            field: container.end_date.element,
            defaultDate: end,
            setDefaultDate: true,
            i18n: lang.obj('i18n'),
            firstDay: env.calendar.first_day,
            onSelect: function() {
               let proposed_start = tournament.start;
               let proposed_end = this.getDate();
               let cancel = () => this.setDate(util.formatDate(tournament.end));
               unscheduleStrandedMatches({ proposed_start, proposed_end }).then(doIt, cancel);
               function doIt() {
                  end = proposed_end;
                  updateEndDate();
                  nextFieldFocus('end_date');
               }
            },
         });
         env.date_pickers.push(endPicker);

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
               if (displayed.euid && displayed.euid == e.euid) selection = i;
               let edt = tfx.genEventName(e, tfx.isPreRound({ env, e })).type || '';
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
            displayed.draw_event.draw.compass = direction;
            if (generate) genEventDraw(container.select_draw.ddlb.getValue());
         }

         function eventChange(value) {
            if (event_draws) {
               genEventDraw(value);
               container.compass_direction.element.style.display = (displayed.draw_event.draw && displayed.draw_event.draw.compass) ? 'flex' : 'none';
               if (displayed.draw_event && displayed.draw_event.draw && displayed.draw_event.draw.compass) compassChange(displayed.draw_event.draw.compass, false);
               container.dual.element.style.display = 'none';
               displayed.dual_match = null;
            } else if (group_draws.length) {
               genGroupDraw(value);
            }
         }
      }

      function updateCompassDirections() {
         if (!displayed.draw_event || !displayed.draw_event.draw) return;
         let directions = ['east', 'west', 'north', 'south', 'northeast', 'northwest', 'southeast', 'southwest'];
         let compass_options = directions
            .filter(d => displayed.draw_event.draw[d])
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

      function editRegistrationLink() {
         displayGen.enterSheetLink(tournament.reg_link, processLink);
         function processLink(link) {
            displayGen.closeModal();
            if (!link) {
               delete tournament.reg_link;
               return;
            }
            let parts = link.split('/');
            if (parts.indexOf('docs.google.com') < 0 || parts.indexOf('spreadsheets') < 0) return invalidURL();
            let reg_link = parts.reduce((p, c) => (!p || c.length > p.length) ? c : p, undefined);
            if (reg_link.length < 40) return invalidURL();
            tournament.reg_link = reg_link;
            saveTournament(tournament);
         }

         function invalidURL() { displayGen.popUpMessage(`<div>${lang.tr('phrases.invalidsheeturl')}</div>`); }
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

      function replaceRegisteredPlayers(show_notice) {
         if (!state.edit) return;
         let message = `${lang.tr('tournaments.renewlist')}<p><i style='color: red;'>(${lang.tr('phrases.deletereplace')})</i>`;
         displayGen.okCancelMessage(message, renewList, () => displayGen.closeModal());

         function renewList() {
            tournament.players = [];
            playersTab();
            saveTournament(tournament);
            updateRegisteredPlayers(show_notice);
         }
      }

      function getDualTeams(dual_match) {
         let dual_teams = dual_match && dual_match.children && dual_match.children.map(c=>c && c.team && pfx.dualCopy(c.team[0])).filter(f=>f);
         dual_teams.forEach(dt => {
            dt.full_name = dt.name;
            let team = tfx.findTeamByID(tournament, dt.id);
            dt.players = Object.assign({}, ...Object.keys(team.players).map(k => ({ [k]: team.players[k] }) ));
         });
         return dual_teams;
      }

      function updateRegisteredPlayers(show_notice) {
         if (!state.edit) return;
         let id = show_notice ? displayGen.busy.message(`<p>${lang.tr("refresh.registered")}</p>`) : undefined;
         let done = (registered) => {
            displayGen.busy.done(id, true);
            if (registered && registered.length) addRegistered(registered);
         }
         let notConfigured = (err) => { displayGen.busy.done(id); displayGen.popUpMessage((err && err.error) || lang.tr('phrases.notconfigured')); }
         if (tournament.reg_link) {
            fetchFx.fetchGoogleSheet(tournament.reg_link).then(done, invalidURLorNotShared);
         } else {
            fetchFx.fetchRegisteredPlayers(tournament.tuid, tournament.category).then(done, notConfigured);
         }

         function invalidURLorNotShared(data) {
            displayGen.busy.done(id, true);
            let message = `
               <div class='flexcol'>
                  <div>${lang.tr('phrases.invalidsheeturl')}</div>
                  <div>${lang.tr('or')}</div>
                  <div>Sheet needs to be shared with CourtHive Server</div>
               </div>
            `;
            displayGen.popUpMessage();
         }
      }

      function matchEventOutOfDate(match) {
         if (match.event && match.muid) {
            let euid = match.event.euid;
            let evt = tfx.findEventByID(tournament, euid);
            if (evt) evt.up_to_date = false;
         }
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

   function eventTemplate(presets) {
      let score_format = tfx.getScoreboardSettings({ format: 'singles' });
      let scoring = scoreBoard.getScoring(score_format);

      let template = {
         log: [],
         links: {},
         format: 'S',
         approved: [],
         wildcards: [],
         luckylosers: [],
         draw_size: '',
         euid: displayFx.uuid(),
         automated: false,
         draw_created: false,
         name: lang.tr('events.newevent'),
         category: '',
         rank: '',
         surface: '',
         inout: '',
         scoring,
         score_format,
         scoring
      };

      return Object.assign(template, presets);
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
      mz.forEach(match => match.players.forEach(p => p=pfx.cleanPlayer(p)));

      let dbl_matches = mz.filter(f=>f.format == 'doubles').length;

      // retrieve options from container
      let rankings = mz.length ? tournamentOpts(undefined, container) : {};
      let category = rankings.category;

      if (!rankings.category || !points_date) {
         // calling with no points clear Point Display
         displayGen.displayPlayerPoints(container);
         return;
      }

      let points_table = rankCalc.pointsTable({ calc_date: points_date });

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
      let points_table = rankCalc.pointsTable({calc_date});
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
         let pp = (evt) => pfx.displayPlayerProfile({ puid: util.getParent(evt.target, 'point_row').getAttribute('puid') }).then(()=>{}, ()=>{});
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

   // used when importing tournaments from spreadsheets... (?)
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
         var points_table = rankCalc.pointsTable({ calc_date: points_date });

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

   function sameOrg(tournament) {
      let ouid = env.org && env.org.ouid;
      // return !tournament.ouid || (tournament.ouid && tournament.ouid == ouid);
      return (!tournament.org || !tournament.org.ouid) || (tournament.org.ouid && tournament.org.ouid == ouid);
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
            firstDay: env.calendar.first_day,
            onSelect: function() {
               start = this.getDate();
               updateStartDate();
               calcPlayerPoints({ date: this.getDate(), tournament, container });
            },
         });
         env.date_pickers.push(startPicker);

         let endPicker = new Pikaday({
            field: container.end_date.element,
            i18n: lang.obj('i18n'),
            defaultDate: end,
            setDefaultDate: true,
            firstDay: env.calendar.first_day,
            onSelect: function() {
               end = this.getDate();
               updateEndDate();
               calcPlayerPoints({ date: this.getDate(), tournament, container });
            },
         });
         env.date_pickers.push(endPicker);

         updateStartDate();
         updateEndDate();
      }
   }

   function drawIsCreated(evt) {
      if (!evt || !evt.draw) return false;
      let current_draw = evt.draw.compass ? evt.draw[evt.draw.compass] : evt.draw;
      let info = dfx.drawInfo(current_draw);
      let created = (info.unassigned && !info.unassigned.length) || info.positions_filled;
      return created ? new Date().getTime() : undefined;
   }

   function clearSelection() { if (window.getSelection) window.getSelection().removeAllRanges(); }
   function puidHash(team) { return team.map(p=>p && p.puid).sort().join('|'); }
   function teamHash(team) { return team.map(p=>p && p.id).join('|'); }

   return fx;
}();
