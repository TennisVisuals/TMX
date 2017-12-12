// TODO:
// 7. state/displayManager function to handle all end-of-routine display updates
//    -> aggregate state changes into one place where it's easier to track/debug
//    -> insure that points are regenerated after match events, even if display doesn't need to be

let tournaments = function() {

   let fx = {};

   let o = {
      draws: {
         brackets: {
            min_bracket_size: 4,
            max_bracket_size: 5,
         },
      },
      override: {
         auto_byes: false,
         auto_qualifiers: false,
      },
      sign_in: {
         rapid: true,
      },
      save: true,
      byes_with_unseeded: true,
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
            if (draw_node) draw.options({ width: draw_width })();
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

      let category = env.calendar.category;
      let month_start = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();

      let start = env.calendar.start || new Date().getTime();
      let end = env.calendar.end || new Date(start).setMonth(new Date(start).getMonth()+1);

      let calendar_container = gen.calendarContainer();

      function updateStartDate() {
         env.calendar.start = start;
         startPicker.setStartRange(new Date(start));
         endPicker.setStartRange(new Date(start));
         endPicker.setMinDate(new Date(start));
      };
      function updateEndDate() {
         env.calendar.end = end;
         startPicker.setEndRange(new Date(end));
         startPicker.setMaxDate(new Date(end));
         endPicker.setEndRange(new Date(end));
      };

      var startPicker = new Pikaday({
         field: calendar_container.start.element,
         i18n: lang.obj('i18n'),
         defaultDate: new Date(start),
         setDefaultDate: true,
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
         env.calendar.category = category;
         generateCalendar({ start, end, category });
      }
      calendar_container.category.ddlb = new dd.DropDown({ element: calendar_container.category.element, onChange: genCal });
      calendar_container.category.ddlb.selectionBackground();
      if (category) calendar_container.category.ddlb.setValue(category);

      calendar_container.add.element.addEventListener('click', () => createNewTournament({ title: lang.tr('tournaments.new'), callback: saveNewTournament }));

      function saveNewTournament(tournament) {
         if (!tournament || !Object.keys(tournament).length) return;

         if (!tournament.tuid) tournament.tuid = UUID.new();
         tournament.end = new Date(tournament.end).getTime();
         tournament.start = new Date(tournament.start).getTime();

         let refresh = () => generateCalendar({start, end, category});
         db.addTournament(tournament).then(refresh, console.log);
      }

      generateCalendar({ start, end, category });

      function generateCalendar({ start, end, category }) {

         db.findTournamentsBetween(start, end).then(displayTournyCal, console.log);

         function displayTournyCal(tournaments) {

            if (category) tournaments = tournaments.filter(t => t.category == (category == 20 ? 'S' : category));
            tournaments = tournaments.filter(t => t.end <= end);

            gen.calendarRows(calendar_container.rows.element, tournaments);

            let dt = (evt) => displayTournament({tuid: util.getParent(evt.target, 'calendar_click').getAttribute('tuid')});
            Array.from(calendar_container.container.element.querySelectorAll('.calendar_click')).forEach(elem => elem.addEventListener('click', dt));
         }

      }
   }

   fx.displayTournament = displayTournament;
   function displayTournament({tuid} = {}) {
      tuid = tuid || searchBox.active.tournament && searchBox.active.tournament.tuid;
      db.findTournament(tuid).then(tournament => {
         db.findTournamentMatches(tuid).then(matches => go(tournament, matches));
      });

      function go(tournament, matches) {
         if (!tournament) return;
         if (gen.inExisting(['identify', 'tournament'])) load.reset();

         tournament.matches = matches;

         let rankings = {
            sgl_rank: tournament.rank,
            dbl_rank: tournament.rank,
         }
         if (tournament.accepted) Object.assign(rankings, tournament.accepted);
         createTournamentContainer({tournament, display_points: true});
      }
   }

   function getTournamentOptions(tournament) {
      let category = isNaN(tournament.category) ? 20 : +tournament.category;
      let opts = tournament.rank_opts || { category, sgl_rank: tournament.rank, dbl_rank: tournament.rank };

      if (tournament.accepted) {
         if (tournament.accepted.M) {
            opts.category = tournament.accepted.M.category;
            opts.sgl_rank = tournament.accepted.M.sgl_rank;
            opts.dbl_rank = tournament.accepted.M.dbl_rank;
            opts.M = tournament.accepted.M;
         }
         if (tournament.accepted.W) {
            opts.w_category = tournament.accepted.W.category;
            opts.w_sgl_rank = tournament.accepted.W.sgl_rank;
            opts.w_dbl_rank = tournament.accepted.W.dbl_rank;
            opts.W = tournament.accepted.W;
         }
      }

      return opts;
   }

   function tournamentOpts(opts = {}, container) {
      let numberValue = (val) => !val || isNaN(val) ? 0 : parseInt(val);

      if (Object.keys(opts).length) {
         container.category.ddlb.setValue(opts.category);
         container.dbl_rank.ddlb.setValue(opts.dbl_rank);
         container.sgl_rank.ddlb.setValue(opts.sgl_rank);

         if (opts.W) {
            if (container.w_category.ddlb && opts.W.category) container.w_category.ddlb.setValue(opts.W.category);
            if (container.w_category.ddlb && opts.W.sgl_rank) container.w_sgl_rank.ddlb.setValue(opts.W.sgl_rank);
            if (container.w_category.ddlb && opts.W.dbl_rank) container.w_dbl_rank.ddlb.setValue(opts.W.dbl_rank);
         }
      } else {
         opts = {
            // category: numberValue(container.category.ddlb.getValue()),
            // dbl_rank: numberValue(container.dbl_rank.ddlb.getValue()),
            // sgl_rank: numberValue(container.sgl_rank.ddlb.getValue()),
            category: container.category.ddlb.getValue(),
            dbl_rank: container.dbl_rank.ddlb.getValue(),
            sgl_rank: container.sgl_rank.ddlb.getValue(),
         }

         // if both genders are present
         // if (container.w_category.ddlb) opts['W'] = { category: numberValue(container.w_category.ddlb.getValue()) };
         // if (container.w_dbl_rank.ddlb) opts['W'].dbl_rank = numberValue(container.w_dbl_rank.ddlb.getValue());
         // if (container.w_sgl_rank.ddlb) opts['W'].sgl_rank = numberValue(container.w_sgl_rank.ddlb.getValue());
         if (container.w_category.ddlb) opts['W'] = { category: container.w_category.ddlb.getValue() };
         if (container.w_dbl_rank.ddlb) opts['W'].dbl_rank = container.w_dbl_rank.ddlb.getValue();
         if (container.w_sgl_rank.ddlb) opts['W'].sgl_rank = container.w_sgl_rank.ddlb.getValue();
         if (opts.W) opts.M = { category: opts.category, sgl_rank: opts.sgl_rank, dbl_rank: opts.dbl_rank }
      }
      return opts;
   }

   function createTournamentContainer({tournament, display_points = false}) {
      // START setup
      let state = {
         edit: false,
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
      tournamentGenders(tournament);

      let { groups: match_groups, group_draws } = groupMatches(tournament.matches);
      let { container, classes, displayTab, display_context } = gen.tournamentContainer(tournament, tabCallback);

      // TODO: remove this when finished
      dev.tournament = tournament;
      dev.container = container;
      dev.classes = classes;

      // create and initialize draw objects
      let rr_draw = rrDraw();
      let tree_draw = treeDraw();

      draws_context[display_context] = { roundrobin: rr_draw, tree: tree_draw };

      tree_draw.options({ addByes: false, cleanup: true });
      tree_draw.options({ sizeToFit: false, });
      tree_draw.options({ minWidth: 400, minHeight: 100 });
      tree_draw.options({ flags: { display: true, path: './assets/flags/' }});
      tree_draw.events({'player1': { 'click': d => playerClick(d, 0) }});
      tree_draw.events({'player2': { 'click': d => playerClick(d, 1) }});

      tree_draw.options({
         minPlayerHeight: 30,
         details: { club_codes: true, draw_positions: true, player_rankings: true, draw_entry: true, seeding: true },
      });

      rr_draw.options({ min_width: 300 });
      // end draw object creation/initialization

      editAction();
      tree_draw.selector(container.draws.element);

      util.addEventToClass(classes.auto_draw, toggleAutoDraw);

      attachFilterToggles(classes, updateFilters);
      util.addEventToClass(classes.ranking_order, () => enableManualRankings());
      util.addEventToClass(classes.refresh_registrations, () => updateRegisteredPlayers(true, true));

      // combined with printDraw, now context sensitive
      // util.addEventToClass(classes.print_draw_order, printDrawOrder);

      // set up printing events
      util.addEventToClass(classes.print_sign_in, printSignInList);
      util.addEventToClass(classes.print_draw, printDraw);

      util.addEventToClass(classes.print_schedule, printSchedule);

      util.addEventToClass(classes.schedule_matches, scheduleMatches);
      function scheduleMatches() {
         let scheduling_height = '20em';
         let schedule_grid = container.container.element.querySelector('.schedule_sheet');
         let scheduling_active = schedule_grid.style.maxHeight == scheduling_height;

         schedule_grid.style.maxHeight = scheduling_active ? '' : scheduling_height;
         container.scheduling.element.style.display = scheduling_active ? 'none' : 'flex';

         let schedule_matches = document.querySelector(`.${classes.schedule_matches}`);
         schedule_matches.querySelector('div').classList.toggle('matches_header_inactive');
         schedule_matches.querySelector('div').classList.toggle('matches_header');
      }

      gen.tournamentPublishState(container.push2cloud_state.element, tournament.published);
      container.push2cloud.element.addEventListener('click', () => {
         if (!tournament.published) {
            coms.emitTmx({
               event: 'Push Tournament',
               version: env.version,
               tuid: tournament.tuid,
               tournament: CircularJSON.stringify(tournament)
            });
            tournament.published = true;
            gen.tournamentPublishState(container.push2cloud_state.element, tournament.published);
            // can't call saveTournament() here!!
            if (o.save) db.addTournament(tournament);
         }
      });

      gen.localSaveState(container.localdownload_state.element, tournament.saved_locally);
      container.localdownload.element.addEventListener('click', () => {
         if (!tournament.saved_locally) {
            exp.downloadCircularJSON(`${tournament.tuid}.circular.json`, tournament);
            tournament.saved_locally = true;
            gen.localSaveState(container.localdownload_state.element, tournament.saved_locally);
            // can't call saveTournament() here!!
            if (o.save) db.addTournament(tournament);
         }
      });

      container.publish_draw.element.addEventListener('click', () => {
         gen.okCancelMessage(lang.tr('draws.publishQ'), broadcast, () => gen.closeModal());
         function broadcast() {
            broadcastEvent(tournament, displayed_draw_event);
            gen.drawBroadcastState(container.publish_state.element, displayed_draw_event);
            gen.closeModal();
         }
      });

      container.recycle.element.addEventListener('click', () => {
         gen.okCancelMessage(`${lang.tr('draws.clear')}?`, clearDraw, () => gen.closeModal());
         function clearDraw() {
            displayed_draw_event.draw_created = false;
            delete displayed_draw_event.draw;

            generateDraw(displayed_draw_event);
            displayDraw({ evt: displayed_draw_event });

            saveTournament(tournament);

            enableDrawActions();
            gen.closeModal();
         }
      });

      container.player_reps.element.addEventListener('click', () => {
         let modal = gen.playerRepresentatives();
         modal.submit.element.addEventListener('click', () => submitReps());
         modal.cancel.element.addEventListener('click', () => gen.closeModal());
         if (displayed_draw_event) {
            let valid_reps = tournament.players
               .filter(p=>displayed_draw_event.approved.indexOf(p.id) >= 0)
               .map(p=>{
                  let player = util.normalizeName(`${p.first_name} ${p.last_name}`);
                  return { value: player, label: player}
               });
            let rep1 = new Awesomplete(modal.player_rep1.element, { list: valid_reps });
            let rep2 = new Awesomplete(modal.player_rep2.element, { list: valid_reps });

            let rep1_selection_flag = false;
            modal.player_rep1.element.addEventListener("awesomplete-selectcomplete", function(e) {
               rep1_selection_flag = true;
               repSelected(this.value);
            }, false);
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
            modal.player_rep2.element.addEventListener("awesomplete-selectcomplete", function(e) {
               rep2_selection_flag = true;
               repSelected(this.value);
            }, false);
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
         function repSelected(value) {}
         function submitReps() {
            displayed_draw_event.player_representatives[0] = modal.player_rep1.element.value;
            displayed_draw_event.player_representatives[1] = modal.player_rep2.element.value;
            gen.drawRepState(container.player_reps_state.element, displayed_draw_event);
            saveTournament(tournament);
            gen.closeModal();
         }
      });

      container.clearschedule.element.addEventListener('click', clearScheduleDay);
      container.autoschedule.element.addEventListener('click', autoSchedule);
      container.events_actions.element.addEventListener('click', newTournamentEvent);
      container.locations_actions.element.addEventListener('click', newLocation);

      function clearScheduleDay() {
         let { scheduled } = scheduledMatches();
         let incomplete = scheduled.filter(s=>s.winner == undefined && s.schedule.day == displayed_schedule_day);
         incomplete.forEach(match => {
            match.schedule = {};
            match.source.schedule = {};
         });
         scheduleTab();
         saveTournament(tournament);
      }

      function autoSchedule(ev) {

         let order_priority = false;
         let priority = ['F', 'SF', 'QF', 'R16', 'R32', 'R64', 'R96', 'R128', 'RR', 'Q', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5'];

         let luids = tournament.locations.map(l=>l.luid);
         let luid = luids.length == 1 ? luids[0] : container.location_filter.ddlb.getValue();
         let courts = courtData(luid);

         let { completed_matches, pending_matches } = tournamentEventMatches({ tournament, source: true });
         let all_matches = [].concat(...pending_matches, completed_matches);

         let scheduled_cells = all_matches
            .filter(m=>m.schedule && m.schedule.day == displayed_schedule_day)
            .map(m=>`${m.schedule.oop_round}|${m.schedule.court}|${m.schedule.luid}`);

         let available_cells = [].concat(...courts.map(c => c.availability.map(a => `${a}|${c.name}|${c.luid}`)))
            .filter(cell => scheduled_cells.indexOf(cell) < 0)
            .map(c => {
               let [ or, court, luid ] = c.split('|');
               return { oop_round: parseInt(or), court, luid };
            })
            // sort in reverse order since popping available removes from tail
            .sort((a, b) => b.oop_round - a.oop_round);

         // subsort courts by column order so filled left to right
         let court_names = courts.map(c=>c.name);
         function cindex(cell) { return court_names.indexOf(cell.court); }
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
            .filter(m=>(!m.schedule || !m.schedule.court) && !m.score);

         // only schedule matches that match the round and event filters
         let filtered_unscheduled = unscheduled_matches
            .filter(m => (!euid || euid == m.event.euid) && (!round_filter || round_filter == m.round_name));

         let match_rounds = util.unique(filtered_unscheduled.map(m=>m.round_name));
         if (match_rounds.length > 1) {
            let config = gen.autoScheduleConfig();
            config.order.element.addEventListener('click', () => { order_priority = true; gen.closeModal(); doIt(); });
            config.round.element.addEventListener('click', () => { gen.closeModal(); doIt(); });
         } else {
            doIt();
         }

         function doIt() {
            // order_priority gives option to prioritize draw order w/o regard for round
            // if there is not a round filter, sort unscheduled matches by round in draw
            if (!round_filter && !order_priority) { filtered_unscheduled.sort((a, b) => priority.indexOf(b.round_name) - priority.indexOf(a.round_name)); }

            // create an array of unscheduled muids;
            let unscheduled_muids = filtered_unscheduled.map(m=>m.muid);

            // create ordered list of unscheduled matches for each event
            // based on round robin oop or tree draw positions
            let euids = util.unique(filtered_unscheduled.map(m=>m.event.euid));
            let ordered_muids = Object.assign({}, ...euids.map(id => {
               let evnt = findEventByID(id);
               let match_order = null;
               if (evnt.draw_type == 'R') {
                  // compute order of play for round robin
                  let rrr = drawFx.roundRobinRounds(evnt.draw);
                  // transform into ordered list of muids
                  match_order = [].concat(...rrr.map(roundMatchupMUIDs));
                  function roundMatchupMUIDs(rrround) { return [].concat(...rrround.map(m=>m.matchups.map(u=>u.muid))); }
               } else {
                  // get an ordered list of muids based on draw positions
                  match_order = drawFx.treeDrawMatchOrder(evnt.draw);
               }

               // filter out any matches that have been scheduled
               match_order = match_order.filter(m=>unscheduled_muids.indexOf(m) >= 0);
               return { [id]: match_order }; 
            }));

            // create an object indexed by muid of unscheduled matches
            let muid_lookup = Object.assign({}, ...filtered_unscheduled.map(m=>({[m.muid]: m})));

            // When prioritizing draw order w/o regard for round, exclude round_name
            // create a hash of unscheduled matches which have been sorted/grouped by round_name
            let unscheduled_hash = filtered_unscheduled.map(m=>`${m.event.euid}|${!order_priority ? m.round_name : ''}`);

            let ordered_matches = [].concat(...util.unique(unscheduled_hash).map(match_group => {

               // find the start of each group, and the number of members
               let indices = util.indices(match_group, unscheduled_hash);

               // get an array of all muids in this group
               let group_muids = indices.map(i=>filtered_unscheduled[i].muid);
               let [group_euid, round_name] = match_group.split('|');

               // use the group muids to filter the ordered_muids
               let ordered_group = ordered_muids[group_euid]
                  .filter(muid => group_muids.indexOf(muid) >= 0)
                  .map(muid => muid_lookup[muid]);

               // return an ordered group
               return ordered_group;
            }));

            // now assign oop cells to matches
            ordered_matches.forEach(match => {
               let available = available_cells.pop();
               if (available) {
                  let schedule = { 
                     day: displayed_schedule_day,
                     oop_round: available.oop_round,
                     court: available.court,
                     luid: available.luid,
                  }
                  match.schedule = schedule;
                  match.source.schedule = Object.assign({}, match.schedule);
               }
            })

            saveTournament(tournament);
            scheduleTab();
         }
      }

      let genders = [
         {key: lang.tr('genders.mixed'), value: ''},
         {key: lang.tr('genders.male'), value: 'M'},
         {key: lang.tr('genders.female'), value: 'W'},
      ];
      
      let surfaces = [
         {key: lang.tr('surfaces.clay'), value: 'C'},
         {key: lang.tr('surfaces.hard'), value: 'H'},
         {key: lang.tr('surfaces.grass'), value: 'G'},
         {key: lang.tr('surfaces.carpet'), value: 'R'},
      ];
      
      let formats = [
         {key: lang.tr('formats.singles'), value: 'S'},
         {key: lang.tr('formats.doubles'), value: 'D'},
      ];
      
      let draw_types = [
         {key: lang.tr('draws.elimination'), value: 'E'},
         {key: lang.tr('draws.qualification'), value: 'Q'},
         {key: lang.tr('draws.roundrobin'), value: 'R'},
         {key: lang.tr('draws.consolation'), value: 'C'},
      ];

      // if there are any matches, add match players first
      // this must be invoked before tabs created...
      mergePlayers(matchPlayers(tournament.matches));

      tournamentTab();
      drawsTab();
      eventsTab();
      courtsTab();
      scheduleTab();
      filteredTabs();
      
      if (!tMatches() || tournament.events) {
         let remote_request = env.auto_update.registered_players;
         updateRegisteredPlayers(remote_request);
      }

      searchBox.noSuggestions = noSuggestions;
      // END setup.  

      // SUPPORTING FUNCTIONS
      function playerClick(d, n) {
         if (d.player && d.player.puid) {
            player.displayPlayerProfile(d.player.puid).then(()=>{}, ()=>{});
         } else if (d.data && d.data.team && d.data.team.length && d.data.team[n] && d.data.team[n].puid) {
            player.displayPlayerProfile(d.data.team[n].puid).then(()=>{}, ()=>{});
         }
      }
      
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
         let assignment = gen.playerAssignmentActions(player_container);

         let plyr = tournament.players.reduce((a, b) => a = (b.puid == new_player.puid) ? b : a, undefined);

         assignment.new_player.element.style.display = plyr && plyr.signed_in ? 'none' : 'inline';
         assignment.add.element.style.display = existing.length ? 'none' : 'inline';
         assignment.signin.element.style.display = existing.length && !existing[0].signed_in ? 'inline' : 'none';
         assignment.signout.element.style.display = existing.length && existing[0].signed_in ? 'inline' : 'none';

         let cleanUp = () => {
            gen.closeModal();

            // TODO: any draws which have been created need to be re-validated
            // a newly signed-in player can invlidate seeding; any player
            // withdrawn invalidates draws which contain that player...

            playersTab();
            let e = findEventByID(displayed_event);
            if (e) eventPlayers(e);
            eventsTab();
         }

         let addNew = () => {
            new_player.signed_in = true;
            if (!new_player.rankings) new_player.rankings = {};
            new_player.full_name = `${new_player.last_name.toUpperCase()}, ${util.normalizeName(new_player.first_name)}`;
            coms.fetchRankList(tournament.category).then(addRanking, addPlayer);

            function addRanking(rank_list) {
               if (!rank_list || !rank_list.rankings || !rank_list.rankings.players) return addPlayer();
               let player_rankings = rank_list.rankings.players;

               if (player_rankings[new_player.id]) {
                  let category_ranking = player_rankings[new_player.id];
                  if (category_ranking) {

                     let category = isNaN(tournament.category) ? 'S' : tournament.category;
                     new_player.rankings[category] = +category_ranking.ranking;

                     // TODO: standard way to support 'MR' rankings for other countries...
                     if (category_ranking.MR > 0) {
                        if (!new_player.MR) new_player.MR = {};
                        new_player.MR[category] = category_ranking.MR;
                     }
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
            player.createNewPlayer({ player_data: new_player, category: tournament.category, callback: addNewTournamentPlayer });
         });
         assignment.cancel.element.addEventListener('click', () => gen.closeModal());
         assignment.signin.element.addEventListener('click', signIn);
         assignment.signout.element.addEventListener('click', () => { 
            signOutTournamentPlayer(existing[0]);
            cleanUp();
         });

         // have to modify behavior to avoid keyup initiating second event in searchBox
         assignment.signin.element.addEventListener('keydown', (evt) => evt.preventDefault());
         assignment.signin.element.addEventListener('keyup', signIn);
         assignment.add.element.addEventListener('keydown', (evt) => evt.preventDefault());
         assignment.add.element.addEventListener('keyup', addNew);

         let give_focus = !existing.length ? 'add' : existing.length && !existing[0].signed_in ? 'signin' : '';
         if (give_focus) assignment[give_focus].element.focus();
      }

      player.actions.addTournamentPlayer = addTournamentPlayer;

      function pushNewPlayer(new_player) {
         if (!tournament.players) tournament.players = [];

         // avoid double clicks adding same player twice!
         if (tournament.players.map(p=>p.puid).indexOf(new_player.puid) < 0) {
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
         if (player.action == 'addTournamentPlayer' && value) {
            searchBox.element.value = '';
            let name = value.split(' ');
            let new_player = {
               sex: 'M',
               first_name: firstCap(name[0]),
               last_name: firstCap(name.slice(1).join(' ')),
            }
            player.createNewPlayer({ player_data: new_player, category: tournament.category, callback: addNewTournamentPlayer });
         }
      }

      function enableAddPlayer() {
         let year = new Date().getFullYear();

         let category = isNaN(tournament.category) ? 20 : +tournament.category;
         let max_year = year - category;
         let min_year = category == 20 ? max_year + 6 : max_year + 4;

         player.action = 'addTournamentPlayer';
         player.displayFx = gen.showConfigModal;

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
            if (!player.birth && category == 20) return true;
            let birth_year = new Date(player.birth).getFullYear();
            if (category == 20 && birth_year < min_year) return true;
            if (birth_year <= min_year && birth_year >= max_year) return true;
         }
      }

      function disablePlayerOverrides(current_tab, next_tab) {
         if (current_tab == 'events' && next_tab != 'events') {
            delete player.override;
            if (next_tab != 'players') resetSearch();
         } else if (current_tab == 'players' && next_tab != 'players') {
            player.action = undefined;
            player.displayFx = undefined;
            resetSearch();
         }

         function resetSearch() {
            searchBox.category_switching = true;
            searchBox.setSearchCategory();
         }
      }

      function tabCallback(tab_number, reference) {
         disablePlayerOverrides(current_tab, reference);

         // if requested (reference) tab is players and in edit mode, enableAddPlayer()
         if (reference == 'players' && state.edit) enableAddPlayer();

         if (current_tab != 'draws' && reference == 'draws') {
            // resize the draw when tab is clicked so that names size properly
            tree_draw();
            rr_draw();
         }

         // matchesTab() checks for new matches and updates pointsTab();
         if (reference == 'matches') matchesTab();
         if (reference == 'points') matchesTab();

         if (reference == 'schedule') scheduleTab();

         if (reference == 'events') {
            displayEvent();
            eventList();
         }

         current_tab = reference || tab_number;

         // no longer necessary?
         // saveTournament(tournament);
      }

      // boolean whether there are existing matches
      function tMatches() {
         if (tournament.matches && tournament.matches.length) return true;
         if (!tournament.events) return false;

         // TODO: can this be replaced by drawInfo(e.draw).total_matches ??
         let { total_matches } = tournamentEventMatches({ tournament });
         return total_matches;
      }

      function autoDrawSetting() {
         let elem = document.querySelector('.' + classes.auto_draw);
         return Array.from(elem.firstChild.classList).indexOf('automated_draw_play') >= 0 ? true : false;
      }

      function toggleAutoDraw(auto) {
         let e = findEventByID(displayed_event);
         let automated = autoDrawSetting();
         let togglePlayPause = () => {
            // toggle the two possible options
            let elem = document.querySelector('.' + classes.auto_draw);
            elem.firstChild.classList.toggle('automated_draw_pause');
            elem.firstChild.classList.toggle('automated_draw_play');
            saveTournament(tournament);
         }

         if ((auto == true && automated) || (auto == false && !automated)) return;

         // if not true/false it may be MouseEvent, so needs to be explicit
         if (auto == true || auto == false) {
            togglePlayPause();
            return;
         }

         if (!state.edit || (e && e.active)) return;

         togglePlayPause();

         if (e) {
            e.changed = true;
            e.draw_created = false;
            eventBackground(e);
            e.automated = autoDrawSetting();
            eventList(true);
         }
         enableDrawOrderPrinting();
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
         let display = false;
         if (state.edit && tournament.players) {
            let withdrawn = (p) => p.withdrawn == 'Y' || p.withdrawn == true;
            let notSignedIn = (p) => !withdrawn(p) && !p.signed_in;
            if (tournament.players.filter(notSignedIn).length) display = true;
         }
         document.querySelector('.' + classes.print_sign_in).style.display = display ? 'inline' : 'none';
      }

      function scheduleActions() {
         let display = state.edit ? true : false;
         container.container.element.querySelector('.' + classes.print_schedule).style.display = display ? 'inline' : 'none';
         container.container.element.querySelector('.' + classes.schedule_matches).style.display = display ? 'inline' : 'none';
      }

      function editAction() {
         if (!container.edit.element || !container.finish.element) return;
         // container.edit.element.style.opacity = group_draws.length ? 0 : 1;
         // if (group_draws.length) return;
         
         container.edit.element.addEventListener('click', () => {
            if (!state.edit) {
               state.edit = true;

               // for editing insure tournament is not in modal
               util.moveNode('content', container.container.id);
               gen.content = 'tournament';
               gen.closeModal();

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

               // TODO: insure that env.org is appropriately set when externalRequest URLs are configured
               if (tournament.sid == env.org) coms.fetchRankLists().then(()=>{}, ()=>{});

            }
         });
         container.finish.element.addEventListener('click', () => {
            state.edit = false;
            document.querySelector('.ranking_order').style.opacity = 0;
            saveTournament(tournament);
            setEditState();
         });
         container.authorize.element.addEventListener('click', () => {
            let key_uuid = UUID.generate();
            let pushKey = {
               key_uuid,
               "content": {
                  "onetime": true,
                  "directive": "authorize",
                  "content": { "tuid": tournament.tuid }
               }
            }
            let message = `${location.href}?actionKey=${key_uuid}`;
            let btn = UUID.generate();
            let ctext = `Link Copied to Clipboard`;
            coms.emitTmx({ pushKey });
            let msg = gen.okCancelMessage(ctext, () => gen.closeModal(), () => gen.closeModal());
            copyClick();

            function copyClick() {

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

         });
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
         container.edit.element.style.display = state.edit ? 'none' : 'inline';
         container.finish.element.style.display = state.edit ? 'inline' : 'none';
         container.authorize.element.style.display = 'none';
         authorizeTournaments();

         document.querySelector('.refresh_registrations').style.opacity = state.edit ? 1 : 0;
         document.querySelector('.' + classes.refresh_registrations).classList[state.edit ? 'add' : 'remove']('info');

         signInSheet();
         scheduleActions();
         enableDrawActions();
         enableTournamentOptions();

         eventsTab();
         courtsTab();
         playersTab();
         closeEventDetails();
         closeLocationDetails();
      }

      function authorizeTournaments() {
         if (state.edit) {
            db.findSetting('superUser').then(setting => {
               if (setting && setting.auth && util.string2boolean(setting.auth.tournaments)) {
                  container.authorize.element.style.display = 'inline';
               }
            });
         }
      }

      function enableTournamentOptions() {
         let bool = state.edit;
         container.organizer.element.disabled = !bool;
         container.location.element.disabled = !bool;
         container.judge.element.disabled = !bool;
         container.display_id.element.disabled = !bool;
         container.start_date.element.disabled = !bool;
         container.end_date.element.disabled = !bool;
         container.points_valid.element.disabled = !bool;

         container.push2cloud.element.style.display = bool ? 'inline' : 'none';
         container.localdownload.element.style.display = bool ? 'inline' : 'none';
      }

      function addRegistered(registered_players) {
         mergePlayers(registered_players);
         playersTab();
      }

      function mergePlayers(players) {
         if (!players || !players.length) return;

         if (!tournament.players) tournament.players = [];

         let id_map = Object.assign(...players.map(p => ({ [p.id]: p })));
         let existing_ids = tournament.players.map(p=>p.id);

         // check for overlap with existing players, add any newly retrieved attributes to existing
         tournament.players.forEach(p => { if (id_map[p.id]) Object.assign(p, id_map[p.id]); });

         // add any new players that don't already exist in tournament
         players.forEach(pushNewPlayer);
         saveTournament(tournament);
      }

      function printDraw() {
         let created = displayed_draw_event ? displayed_draw_event.draw_created : false;

         if (created) {
            let selected_event = container.select_draw.ddlb ? container.select_draw.ddlb.getValue() : undefined;

            if (Object.keys(tree_draw.data()).length) {
               exp.printDrawPDF(tournament, tree_draw.data(), tree_draw.options(), selected_event, displayed_draw_event);

            } else if (rr_draw) {
               let brackets = rr_draw.data().brackets;
               if (brackets.length) exp.printDrawPDF(tournament, rr_draw.data(), rr_draw.options(), selected_event);
            }
         } else {
            printDrawOrder(displayed_draw_event);
         }
      }

      function printSchedule() {

         let { completed_matches, pending_matches } = tournamentEventMatches({ tournament, source: true });
         let all_matches = [].concat(...pending_matches, completed_matches);
         // let muid_key = Object.assign({}, ...all_matches.map(m=>({ [m.muid]: m })));

         let luids = tournament.locations.map(l=>l.luid);
         let luid = luids.length == 1 ? luids[0] : container.location_filter.ddlb.getValue();
         let courts = courtData(luid);
         let court_names = courts.map(c=>c.name);

         let print_matches = all_matches.filter(f=>f.schedule && f.schedule.day == displayed_schedule_day && court_names.indexOf(f.schedule.court) >= 0);
         
         exp.printSchedulePDF({ tournament, day: displayed_schedule_day, courts, matches: print_matches });
      }

      function printDrawOrder(evt) {
         evt = evt || findEventByID(displayed_event);

         if (!evt) {
            console.log('Event Must Be Saved!');
            return;
         }

         // if an event is not found or there are not approved players, abort
         if (!evt || !evt.approved) return;

         // abort if no category has been defined
         if (!evt.category) return;

         let category = isNaN(evt.category) ? 20 : +evt.category;

         let t_players;
         if (evt.format == 'S') {
            t_players = tournament.players
               .filter(player=>evt.approved.indexOf(player.id) >= 0)
               .filter(player=>player.signed_in);
         } else {
            let teams = approvedTeams(evt).map(team => team.players.map(player => Object.assign(player, { seed: team.seed })));;
            exp.doublesSignInPDF({ tournament, teams });
         }

         // abort if there are no players
         if (!t_players || !t_players.length) return;

         t_players = orderPlayersByRank(t_players, category);
         // configured for listing players by Position in draw "Draw Order"
         exp.orderedPlayersPDF({ tournament, players: t_players, event_name: evt.name, doc_name: lang.tr('mdo'), extra_pages: false })
      }

      function printSignInList() {
         if (!tournament.players || !tournament.players.length) return;
         let t_players = tournament.players
            .filter(player=>filters.indexOf(player.sex) < 0)
            .filter(player=>(player.withdrawn == 'N' || !player.withdrawn) && !player.signed_in);

         if (!t_players.length) {
            // if there are no players who have not signed in, print a blank doubles sign-in sheet
            exp.doublesSignInPDF({ tournament });
            return;
         }

         let sisobj = gen.signInSheetFormat();
         sisobj.singles.element.addEventListener('click', () => {
            t_players = orderPlayersByRank(t_players, tournament.category);
            // default configuration is ordered Sign-In List
            exp.orderedPlayersPDF({ tournament, players: t_players })
            gen.closeModal();
         });
         sisobj.doubles.element.addEventListener('click', () => {
            exp.doublesSignInPDF({ tournament });
            gen.closeModal();
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

      let approvedByRank = (e) => {
         // assumes that tournament.players is already sorted by rank
         if (e.format == 'S') {
            e.approved = !tournament.players ? [] : tournament.players.filter(p=>e.approved.indexOf(p.id) >= 0).map(p=>p.id);
         }
      }

      let approvedChanged = (e, update_players=false) => {
         approvedByRank(e);
         eventBackground(e);
         enableDrawOrderPrinting();
         if (update_players) { eventPlayers(e); }
         if (e.draw_type == 'Q' && event_config.qualifiers) {
            event_config.qualifiers.ddlb.selectionBackground(!e.qualifiers ? 'red' : 'white');
         }
      }

      let modifyApproved = {
         push: function(e, id) {
            if (!state.edit || e.active) return;
            e.approved.push(id);
            e.draw_created = false;
            saveTournament(tournament);
            e.changed = true;
            approvedChanged(e, true);
         },
         filter: function(e, filter_out) {
            e.approved = e.approved.filter(id => filter_out.indexOf(id) < 0);
            approvedChanged(e);
         },
         addAll: function(e) {
            if (!state.edit || e.active) return;
            e.approved = [].concat(...e.approved, ...eligiblePlayers(e).map(p=>p.id));
            saveTournament(tournament);
            e.changed = true;
            approvedChanged(e, true);
         },
         removeAll: function(e) {
            if (!state.edit || e.active) return;
            e.approved = [];
            e.draw_created = false;
            saveTournament(tournament);
            e.changed = true;
            approvedChanged(e, true);
         },
         filterGender: function(e) {
            if (e.format == 'S') {
               e.approved = tournament.players
                  .filter(p=>p.sex == e.gender)
                  .filter(p=>e.approved.indexOf(p.id) >= 0)
                  .map(p=>p.id);
            } else {
               // TODO: remove any teams that have a player of filtered gender
               // from both e.approved and e.teams
            }
            approvedChanged(e);
         },
         removeID: function(e, id) {
            if (!state.edit || e.active) return;
            e.draw_created = false;
            if (e.format == 'S') { e.approved = e.approved.filter(i=>i!=id); }
            saveTournament(tournament);
            e.changed = true;
            approvedChanged(e, true);
         },
      }

      function closeEventDetails() {
         searchBox.normalFunction();
         displayed_event = undefined;
         gen.hideEventDetails(container);
      }

      function closeLocationDetails() {
         searchBox.normalFunction();
         gen.hideLocationDetails(container);
      }

      function enableApprovePlayer(e) {
         if (!e) return;

         // first time we get eligible it is for populating Search Box
         let ineligible = ineligiblePlayers(e);
         let unavailable = unavailablePlayers(e);
         let eligible = eligiblePlayers(e, ineligible, unavailable);
         eligible.forEach(p => { if (p.order) p.full_name = `${p.full_name}&nbsp;<span class='player_order'>(${p.order})</span>`; });
         let approved = approvedPlayers(e);

         let searchable_players = [].concat(...eligible, ...approved);

         searchBox.category = 'players';
         searchBox.category_switching = false;
         searchBox.setSearchCategory(lang.tr('search.approve'));

         // populate search box with eligible AND approved
         searchBox.typeAhead.list = searchable_players.map(valueLabel);
         searchBox.irregular_search_list = true;

         player.override = (plyr) => {

            let ineligible = ineligiblePlayers(e);
            let unavailable = unavailablePlayers(e);

            // second time we get eligible it is to check player status
            let eligible = eligiblePlayers(e, ineligible, unavailable);
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


      function categoryFudge(category) {
         if (isNaN(category)) return category;
         return `U${category}`;
      }

      function eventList(regen_drawstab = false) {
         let events = [];
         let highlight_listitem;
         if (tournament.events && tournament.events.length) {
            events = tournament.events.map((e, i) => {
               setDrawSize(e);
               if (displayed_event && displayed_event == e.euid) highlight_listitem = i;
               let info = !e.draw ? {} : drawFx.drawInfo(e.draw);

               let matches = eventMatches(e);
               let scheduled = matches.filter(m=>m.match.schedule && m.match.schedule.court).length;

               // TODO: draws need to be regenerated here, as necessary
               // for example, when # of qualifiers changes we can't wait for
               // the main draw to be re-displayed before regenerating the draw

               return {
                  scheduled,
                  name: e.name,
                  rank: e.rank,
                  active: e.active,

                  // actual category name should be used...
                  // at present category gets changed from 'S' to 'S', to 20 & etc.
                  category: categoryFudge(e.category),

                  published: e.published,
                  up_to_date: e.up_to_date,
                  draw_created: e.draw_created,
                  draw_size: e.draw_size || '0',  
                  gender: getKey(genders, e.gender),
                  format: getKey(formats, e.format),
                  total_matches: info.total_matches,
                  surface: e.surface,
                  draw_type: getKey(draw_types, e.draw_type),
                  opponents: e.approved.length + (e.draw_type == 'E' ? (e.qualifiers || 0) : 0),
               };
            });
         }

         gen.eventList(container, events, highlight_listitem);
         let eventDetails = (evt) => {
            let clicked_event = util.getParent(evt.target, 'event');
            let class_list = clicked_event.classList;
            if (class_list.contains('highlight_listitem')) {
               closeEventDetails();
            } else {
               class_list.add('highlight_listitem');
               let index = clicked_event.getAttribute('index');
               displayEvent({ e: tournament.events[index], index });
            }
         }
         // attach action to display event_details when clicking each event
         util.addEventToClass('event', eventDetails, container.events.element);
         if (regen_drawstab) drawsTab();

         // TODO: Why was it necessary to generate the matches tab?
         // matchesTab();
      }

      function newTournamentEvent() {
         let genders_signed_in = tournamentGenders(tournament, (f)=>f.signed_in);

         let gender = '';
         if (genders_signed_in.length == 1) gender = genders_signed_in[0];

         let existing_gendered_singles = !tournament.events ? [] : tournament.events
            .filter(e => e.format == 'S' && e.draw_type == 'E')
            .map(e=>e.gender);

         if (!gender && genders_signed_in.length == 2 && existing_gendered_singles.length == 1) {
            gender = genders_signed_in.filter(g=>existing_gendered_singles.indexOf(g) < 0)[0];
         }

         let e = {
            gender,
            links: {},
            format: 'S',
            approved: [],
            draw_size: '',
            draw_type: 'E',
            euid: gen.uuid(),
            scoring: '3/6/7T',
            automated: false,
            draw_created: false,
            category: tournament.category || '',
            rank: tournament.rank || '',
            surface: tournament.surface || 'C'
         };
         displayEvent({e});
      }

      // when an event is deleted all references to it must also be deleted
      function removeReferences(euid) {
         if (!tournament.events) return;
         tournament.events.forEach(e => { 
            Object.keys(e.links).forEach(key => { 
               if (e.links[key] == euid) {
                  delete e.links[key]; 
                  e.changed = true;
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
         e = e || findEventByID(displayed_event);
         if (!e) return;
         if (e.draw_created) background = '#EFFBF2';
         if (e.active) background = '#EFF5FB';
         if (tournament.events.map(v=>v.euid).indexOf(e.euid) < 0) background = 'lightyellow';
         container.event_details.element.querySelector('.detail_body').style.background = background;
      }

      function locationBackground(l, background='white') {
         if (!l) return;
         if (tournament.locations.map(v=>v.luid).indexOf(l.luid) < 0) background = 'lightyellow';
         container.location_details.element.querySelector('.detail_body').style.background = background;
      }

      function displayEvent({ e, index } = {}) {
         e = e || (displayed_event ? findEventByID(displayed_event) : undefined);
         if (!e) return;

         if (!tournament.events) tournament.events = [];
         let event_index = tournament.events.map(m=>m.euid).indexOf(e.euid);
         index = index || (event_index >= 0 ? event_index : undefined);

         let actions = d3.select(container.event_details.element);

         let auto_setting = document.querySelector('.' + classes.auto_draw);
         auto_setting.style.display = e.active || !state.edit || !env.autodraw ? 'none' : 'inline';

         eventBackground(e);
         toggleAutoDraw(e.automated);
         enableDrawOrderPrinting();
         displayed_event = e.euid;
         configureEventSelections(e);
         enableEventTeams(e);
         actions.style('display', 'flex');

         if (state.edit) {
            if (index != undefined) {

               enableApprovePlayer(e);

               actions.select('.save').style('display', 'none');
               actions.select('.cancel').style('display', 'none');
               actions.select('.del')
                  .style('display', 'inline')
                  .on('click', () => { 
                     closeEventDetails();

                     // filter out matches from deleted event
                     tournament.matches = tournament.matches.filter(m=>m.event.euid != e.euid);

                     // Delete any published events or matches
                     deleteEvent(tournament, e);

                     // delete any event matches in database
                     db.deleteEventMatches(tournament.tuid, e.euid)
                        .then(() => db.deleteEventPoints(tournament.tuid, e.euid), err => console.log('Error deleting matches:', err))
                        .then(reGen, err => console.log('Error deleteing points:', err));

                     tournament.events.splice(index, 1);
                     removeReferences(e.euid);
                     db.addTournament(tournament);

                     // need to regenerate to remove non-existent matches
                     function reGen() {
                        let group_matches = groupMatches(tournament.matches);
                        match_groups = group_matches.groups;
                        group_draws = group_matches.group_draws;

                        drawsTab();
                        scheduleTab();
                        eventsTab();
                        matchesTab();
                     }
                  });
               actions.select('.done')
                  .style('display', 'inline')
                  .on('click', () => {
                     closeEventDetails();
                     saveTournament(tournament);
                  });
            } else {
               actions.select('.del').style('display', 'none');
               actions.select('.done').style('display', 'none');
               actions.select('.save')
                  .style('display', 'inline')
                  .on('click', () => { 
                     if (!tournament.events) tournament.events = [];
                     displayed_event = e.euid;
                     e.automated = autoDrawSetting();
                     tournament.events.push(e);
                     coms.emitTmx({ 
                        event: 'Add Event',
                        version: env.version,
                        notice: `${tournament.name} => ${e.name} ${e.draw_type} ${e.automated ? 'Auto' : 'Manual'}` 
                     });
                     let i = tournament.events.length - 1;
                     displayEvent({ e, index: i });
                     eventList();
                     saveTournament(tournament);
                  });
               actions.select('.cancel')
                  .style('display', 'inline')
                  .on('click', () => {
                     closeEventDetails();
                     removeReferences(e.euid);
                  });
            }
         } else {
            actions.select('.done')
               .style('display', 'inline')
               .on('click', closeEventDetails);
         }

         eventPlayers(e);
      }

      function getKey(arr, value) {
         let pairs = arr.filter(a=>a.value == value);
         return pairs.length ? pairs[0].key : '';
      }

      function findEventByID(id) {
         if (!tournament.events || tournament.events.length < 1) return;
         let matching_events = tournament.events.filter(f=>f.euid == id);
         return matching_events.length ? matching_events[0] : undefined;
      }

      function determineLinkedDraw(e, type, linkChanged) {
         if (!tournament.events || tournament.events.length < 1) return;

         let types = {
            'Q': ['Q', 'R'],
            'E': ['E'],
            'C': ['C'],
         }

         let linkType = (types, type) => types[type].filter(t=>e.links[t]);

         let draw_types = {
            'Q': 'qualification',
            'R': 'qualification',
            'C': 'consolation',
            'E': 'elimination',
         }

         let modifiers = { 'R': ' RR', }

         let events = tournament.events
            .filter(f => types[type].indexOf(f.draw_type) >= 0)
            .map(m => ({ key: `${m.name}${modifiers[m.draw_type] || ''}`, value: m.euid }));
         let options = [].concat({ key: 'None', value: '' }, ...events);
         if (!events.length) return false;

         let setLink = (value) => {
            let previous_link = e.links[linkType(types, type)];
            let linked_event = findEventByID(value);

            let link = linked_event ? linked_event.draw_type : linkType(types, type);
            e.links[link] = value;

            // link in the opposite direction as well...
            if (linked_event) {
               linked_event.links[e.draw_type] = e.euid;
               linked_event.changed = true;

               if (linked_event.draw_type == 'R') determineRRqualifiers(linked_event);
               if (linked_event.draw_type == 'Q') checkForQualifiedTeams(linked_event);

               let qualified = linked_event.qualified ? linked_event.qualified.map(teamHash) : [];
               if (!e.approved) e.approved = [];
               e.approved = [].concat(...e.approved, ...qualified);
            }

            // remove any previous links
            if (previous_link) {
               let previous_linked_event = findEventByID(previous_link);
               previous_linked_event.links[e.draw_type] = undefined;
               previous_linked_event.changed = true;
            }

            if (linkChanged && typeof linkChanged == 'function') linkChanged(value);
            eventList(true);
         }

         let etype = draw_types[type];
         d3.select(container.draw_config.element).select('.' + etype).style('display', 'flex');
         event_config[etype].ddlb = new dd.DropDown({ element: event_config[etype].element, onChange: setLink });
         event_config[etype].ddlb.selectionBackground();
         event_config[etype].ddlb.setOptions(options);
         event_config[etype].ddlb.setValue(e.links[linkType(types, type)] || '');

         return Object.keys(e.links).indexOf(type) >= 0;

      }

      function setDrawSize(e) {
         if (e.active) return;
         let drawTypes = {
            E() {
               let qualifiers = 0;
               let players = e.approved && e.approved.length ? e.approved.length : 0;

               // add positions for qualifiers into the draw

               if (e.links['Q']) {
                  // TODO: this code can be cleaned up!
                  let linked = findEventByID(e.links['Q']);
                  if (linked && linked.qualifiers) qualifiers = linked.qualifiers;

                  let qualified = linked && linked.qualified ? linked.qualified.map(teamHash) : [];
                  if (linked && linked.qualifiers) qualifiers = linked.qualifiers - qualified.length;

               }
               if (e.links['R']) {
                  // TODO: this code can be cleaned up!
                  let linked = findEventByID(e.links['R']);
                  if (linked && linked.qualifiers) qualifiers = linked.qualifiers;

                  let qualified = linked && linked.qualified ? linked.qualified.map(teamHash) : [];
                  if (linked && linked.qualifiers) qualifiers = linked.qualifiers - qualified.length;
               }

               let total = players + qualifiers;
               let new_draw_size = total ? drawFx.standardDrawSizes(total) : 0;
               if (new_draw_size != e.draw_size || qualifiers != e.qualifiers) e.changed = true;
               e.draw_size = new_draw_size;
               e.qualifiers = qualifiers;
               if (e.draw) e.draw.qualifiers = qualifiers;

            },
            R() {
               e.draw_size = e.brackets * e.bracket_size;
            },
            Q() {
               e.draw_size = !e.draw ? 0 : drawFx.drawInfo(e.draw).draw_positions.length;
            },
            C() {
               // TODO: unless structure is feed-in, draw_size should be half of the main draw to which it is linked
               let draw_size = Math.max(0, e.approved && e.approved.length ? drawFx.standardDrawSizes(e.approved.length) : 0);
               e.draw_size = draw_size;
            }
         }

         drawTypes[e.draw_type] ? drawTypes[e.draw_type]() : undefined;
      }

      let qualifyingDrawSizeOptions = (e) => {
         let upper_range = e.approved && e.approved.length ? Math.max(e.approved.length, 1) : 1;
         let range = d3.range(0, Math.min(16, upper_range));
         let max_qualifiers = Math.max(...range);
         let options = range.map(c => ({ key: c, value: c }));
         return { max_qualifiers, options }
      }

      let roundRobinDrawBracketOptions = (e) => {

         let opponents = e.approved.length;

         let lower_range = o.draws.brackets.min_bracket_size;
         let upper_range = o.draws.brackets.max_bracket_size;
         e.bracket_size = e.bracket_size || lower_range;
         if (opponents < e.bracket_size && e.bracket_size > lower_range) {
            e.bracket_size -= 1;
            upper_range = lower_range;
         } else if (opponents == upper_range) {
            lower_range = upper_range;
         }

         let size_range = d3.range(lower_range, upper_range + 1);
         let size_options = size_range.map(c => ({ key: c, value: c }));
         e.brackets = Math.ceil(opponents / e.bracket_size);

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

         let min_brackets = opponents ? Math.floor(opponents / upper_range) : 1;
         let max_brackets = opponents ? Math.ceil(opponents / lower_range) : 1;

         let range = d3.range(min_brackets, max_brackets + 1);
         let options = range.map(c => ({ key: c, value: c }));

         return { options, size_options }
      }

      let setRRQualifiers = (e) => {
         let min_qualifiers = (e.approved && e.approved.length ? 1 : 0) * e.brackets;
         let max_qualifiers = min_qualifiers * 2;
         let range = d3.range(min_qualifiers, max_qualifiers + 1);
         let options = range.map(c => ({ key: c, value: c }));
         event_config.qualifiers.ddlb.setOptions(options);
         if (e.qualifiers > max_qualifiers) e.qualifiers = max_qualifiers;
         event_config.qualifiers.ddlb.setValue(e.qualifiers);
      }

      function configDrawType(e) {
         let linkChanged = () => eventPlayers(e);

         let setQualifiers = (value) => {
            e.qualifiers = +value;

            let linked = findEventByID(e.links['E']);
            if (linked) {
               // remove any qualified players from linked draw approved
               let qual_hash = !e.qualified ? [] : e.qualified.map(teamHash);
               linked.approved = linked.approved.filter(a=>qual_hash.indexOf(a) < 0);
               linked.changed = true;
            }

            e.qualified = [];
            e.changed = true;

            if (e.draw_type == 'R' && linked) determineRRqualifiers(e);
            saveTournament(tournament);

            drawsTab();
         }

         let setQualificationConfig = () => {
            let {max_qualifiers, options } = qualifyingDrawSizeOptions(e);
            event_config = gen.configQualificationDraw(container, e, options);
            event_config.qualifiers.ddlb = new dd.DropDown({ element: event_config.qualifiers.element, onChange: setQualifiers });
            event_config.qualifiers.ddlb.selectionBackground();
            event_config.qualifiers.ddlb.setValue(Math.min(e.qualifiers || 0, max_qualifiers) || 0);

            determineLinkedDraw(e, 'E', linkChanged);
         }

         let setEliminationConfig = () => {
            // let options = [{ key: lang.tr('draws.standard'), value: 'standard' }, { key: lang.tr('draws.feedin'), value: 'feed' }];
            let options = [{ key: lang.tr('draws.standard'), value: 'standard' }, ];

            let setStructure = (value) => {
               e.structure = value;
               eventList(true);
            }

            event_config = gen.configTreeDraw(container, e, options);
            event_config.structure.ddlb = new dd.DropDown({ element: event_config.structure.element, onChange: setStructure });
            event_config.structure.ddlb.selectionBackground();
            event_config.structure.ddlb.setValue(e.structure || 'standard');

            determineLinkedDraw(e, 'Q', linkChanged);
            determineLinkedDraw(e, 'C', linkChanged);
         }

         let setConsolationConfig = () => {
            let options = [{ key: lang.tr('draws.standard'), value: 'standard' }, { key: lang.tr('draws.feedin'), value: 'feed' }];

            let setStructure = (value) => {
               e.structure = value;
               eventList(true);
            }

            event_config = gen.configTreeDraw(container, e, options);
            event_config.structure.ddlb = new dd.DropDown({ element: event_config.structure.element, onChange: setStructure });
            event_config.structure.ddlb.selectionBackground();
            event_config.structure.ddlb.setValue(e.structure || 'standard');

            determineLinkedDraw(e, 'E', linkChanged);
         }

         let setRoundRobinConfig = () => {
            let {options, size_options } = roundRobinDrawBracketOptions(e);

            event_config = gen.configRoundRobinDraw(container, e, options, size_options);
            event_config.qualifiers.ddlb = new dd.DropDown({ element: event_config.qualifiers.element, onChange: setQualifiers });
            event_config.qualifiers.ddlb.selectionBackground();
            event_config.qualifiers.ddlb.setValue(e.qualifiers || e.brackets);
            e.qualifiers = e.qualifiers || e.brackets;

            let setBracketSize = (value) => {
               e.bracket_size = +value;
               e.brackets = Math.ceil(e.approved.length / e.bracket_size);
               event_config.brackets.ddlb.setValue(e.brackets);
               setRRQualifiers(e);
               e.changed = true;
               eventList(true);
            }

            event_config.brackets.ddlb = new dd.DropDown({ element: event_config.brackets.element });
            event_config.brackets.ddlb.selectionBackground();
            event_config.brackets.ddlb.setValue(e.brackets);
            event_config.brackets.ddlb.lock();

            event_config.bracket_size.ddlb = new dd.DropDown({ element: event_config.bracket_size.element, onChange: setBracketSize });
            event_config.bracket_size.ddlb.selectionBackground();
            event_config.bracket_size.ddlb.setValue(e.bracket_size);

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
            let linked = determineLinkedDraw(e, 'E', linkValue);
            displayQualifiers(linked);
         }

         let drawTypes = {
            'R': () => setRoundRobinConfig(),
            'E': () => setEliminationConfig(),
            'C': () => setConsolationConfig(),
            'Q': () => setQualificationConfig(),
         }

         if (drawTypes[e.draw_type]) drawTypes[e.draw_type]();
         setDrawSize(e);

         // certain draw types, such as Consolation, will have no event players until linked draws have begun play
         eventPlayers(e);
      }

      function configureLocationAttributes(l) {
         let attributes = gen.displayLocationAttributes(container, l, state.edit);

         attributes.abbreviation.element.addEventListener('keydown', catchTab, false);
         attributes.name.element.addEventListener('keydown', catchTab, false);
         attributes.address.element.addEventListener('keydown', catchTab, false);
         attributes.courts.element.addEventListener('keydown', catchTab, false);
         attributes.identifiers.element.addEventListener('keydown', catchTab, false);

         attributes.abbreviation.element.addEventListener('keyup', (evt) => defineAttr('abbreviation', evt, { length: 3 }));
         attributes.name.element.addEventListener('keyup', (evt) => defineAttr('name', evt, { length: 5 }));
         attributes.address.element.addEventListener('keyup', (evt) => defineAttr('address', evt, { length: 5 }));
         attributes.courts.element.addEventListener('keyup', (evt) => defineAttr('courts', evt, { number: true }));
         attributes.identifiers.element.addEventListener('keyup', (evt) => defineAttr('identifiers', evt));
         setTimeout(function() { attributes.abbreviation.element.focus(); }, 50);

         attributes.abbreviation.element.value = l.abbreviation || '';
         attributes.name.element.value = l.name || '';
         attributes.address.element.value = l.address || '';
         attributes.courts.element.value = l.courts || 0;
         attributes.identifiers.element.value = l.identifiers || '';

         let disabled = !state.edit
         attributes.abbreviation.element.disabled = disabled;
         attributes.name.element.disabled = disabled;
         attributes.address.element.disabled = disabled;
         attributes.courts.element.disabled = disabled;
         attributes.identifiers.element.disabled = disabled;

         attributes.abbreviation.element.style.border = disabled ? 'none' : '';
         attributes.name.element.style.border = disabled ? 'none' : '';
         attributes.address.element.style.border = disabled ? 'none' : '';
         attributes.courts.element.style.border = disabled ? 'none' : '';
         attributes.identifiers.element.style.border = disabled ? 'none' : '';
         
         let field_order = [ 'abbreviation', 'name', 'address', 'courts', 'identifiers' ];

         function nextFieldFocus(field, increment=1, delay=50) {
            let next_field = field_order.indexOf(field) + increment;
            if (next_field == field_order.length) next_field = 0;
            if (next_field < 0) next_field = field_order.length - 1;
            setTimeout(function() { attributes[field_order[next_field]].element.focus(); }, delay);
            saveTournament(tournament);
         }

         function defineAttr(attr, evt, required, element) {
            if (evt) element = evt.target;
            let value = element.value.trim();
            l[attr] = value;
            if (required) {
               valid = false;
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
            let increment = (evt.which == 9 && evt.shiftKey) ? -1 : 1;
            if (!evt || evt.which == 13 || evt.which == 9) nextFieldFocus(attr, increment);
         }
      }

      function configureEventSelections(e) {
         let eventName = () => {
            e.name = `${getKey(genders, e.gender)} ${e.category} ${getKey(formats, e.format)}`;
            gen.setEventName(container, e);
            eventList(true);
         }
         eventName();
        
         let details = gen.displayEventDetails(container, e, genders, surfaces, formats, draw_types, state.edit);

         let addAll = () => modifyApproved.addAll(e);
         let removeAll = () => modifyApproved.removeAll(e);
         let promoteAll = () => promoteTeams(e);

         util.addEventToClass('addall', addAll, container.detail_players.element);
         util.addEventToClass('removeall', removeAll, container.detail_players.element);
         util.addEventToClass('promoteall', promoteAll, container.detail_players.element);

         let filterGender = (value) => {
            if (e.gender != value) e.changed = true;
            e.gender = value;
            eventPlayers(e);
            eventName();
         }
         details.gender.ddlb = new dd.DropDown({ element: details.gender.element, onChange: filterGender });
         details.gender.ddlb.setStyle('label_novalue', 'black');
         details.gender.ddlb.setValue(e.gender || '');

         let filterCategory = (value) => {
            if (e.category != value) e.changed = true;
            e.category = value;
            eventPlayers(e);
            eventName();
         }
         details.category.ddlb = new dd.DropDown({ element: details.category.element, onChange: filterCategory });
         if (e.category || tournament.category) {
            details.category.ddlb.setValue(e.category || tournament.category);
            if (tournament.category) details.category.ddlb.lock();
         }

         let setFormat = (value) => { 
            // cleanup
            delete e.teams;
            modifyApproved.removeAll(e);

            e.changed = true;
            e.format = value; 

            if (e.format == 'D') {
               e.scoring = e.scoring || '3/6/7T/S'
               displayScoring(e.scoring);
            } else {
               e.scoring = e.scoring || '3/6/7T';
               displayScoring(e.scoring);
            }

            eventName();
            enableEventTeams(e);
            saveTournament(tournament);
         }

         details.format.ddlb = new dd.DropDown({ element: details.format.element, onChange: setFormat });
         if (e.format || tournament.format) details.format.ddlb.setValue(e.format || tournament.format);
         details.format.ddlb.setValue(e.format || 'S');

         let setRank = (value) => { 
            e.rank = value; 
            eventList(true);
            saveTournament(tournament);
         }
         details.rank.ddlb = new dd.DropDown({ element: details.rank.element, onChange: setRank });
         if (e.rank || tournament.rank) details.rank.ddlb.setValue(e.rank || tournament.rank);

         let setSurface = (value) => { 
            e.surface = value; 
            eventList(true);
         }
         details.surface.ddlb = new dd.DropDown({ element: details.surface.element, onChange: setSurface });
         details.surface.ddlb.setValue(e.surface || tournament.surface || 'C');

         let setDrawType = (value) => { 
            if (e.draw_type != value) e.changed = true;
            e.draw_type = value; 

            // clean up any existing links/references
            e.links = [];
            removeReferences(e.euid);

            // there can't be any approved players when switching draw type to consolation
            if (value == 'C') e.approved = [];

            if (value == 'E') {
               details.format.ddlb.unlock();
            } else {
               e.format = 'S';
               details.format.ddlb.setValue('S');
               details.format.ddlb.lock();
               enableEventTeams(e);
            }

            configDrawType(e);
            eventName();
            saveTournament(tournament);
         }
         details.draw_type.ddlb = new dd.DropDown({ element: details.draw_type.element, onChange: setDrawType });
         details.draw_type.ddlb.setValue(e.draw_type || 'E');
         configDrawType(e);

         let displayScoring = (score) => details.scoring.element.innerHTML = score;
         let changeScoring = () => {
            if (state.edit && !e.active) {
               document.body.style.overflow  = 'hidden';
               let cfg_obj = gen.scoreBoardConfig();
               let config = d3.select(cfg_obj.config.element);

               let f = scoreBoard.options();
               scoreBoard.configureScoring(cfg_obj, f);
               config.on('click', removeConfigScoring);
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
                  let stb = sf.final_set_supertiebreak ? '/S' : '';
                  e.scoring = `${sf.max_sets}/${sf.games_for_set}/${sf.tiebreak_to}T${stb}`;
                  removeConfigScoring();
               }

               function removeConfigScoring() {
                  displayScoring(e.scoring);
                  config.remove();
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

      fx.orderPlayersByRank = orderPlayersByRank;
      function orderPlayersByRank(players, category) {
         if (!players) return [];
         category = category || (isNaN(tournament.category) ? 20 : tournament.category);

         players.forEach(player => {
            if (player.modified_ranking) {
               player.category_ranking = player.modified_ranking;
            } else if (player.rankings && player.rankings[category]) {
               player.category_ranking = +player.rankings[category];
            } else if (player.rank) {
               player.category_ranking = +player.rank;
            }
         });

         let ranked = players.filter(player => player.category_ranking);
         let unranked = players.filter(player => !player.category_ranking);

         // sort unranked by full_name (last, first)
         playerSort(unranked);

         let mr_players = ranked.filter(player => mrPlayer(player, category));
         let ranked_players = ranked.filter(player => !mrPlayer(player, category));

         // sort ranked players by category ranking, or, if equivalent, subrank
         mr_players.sort((a, b) => (a.category_ranking == b.category_ranking) ? a.subrank - b.subrank : a.category_ranking - b.category_ranking);
         ranked_players.sort((a, b) => (a.category_ranking == b.category_ranking) ? a.subrank - b.subrank : a.category_ranking - b.category_ranking);

         return [].concat(...mr_players, ...ranked_players, ...unranked);

         function mrPlayer(player, category) { return player.MR && player.MR[category]; }
      }

      function ineligiblePlayers(e) {
         // TODO: render ineligible because of health certificate / suspension & etc.
         return e.gender ? tournament.players.filter(f=>f.sex != e.gender) : [];
      }

      function unavailablePlayers(e) {
         // an array of players who are assigned to linked draws
         // let unavailable = [];

         if (e.draw_type  == 'E') {
            // elimination events can't have approved players who are also approved in linked qualifying events
            // though qualifying players *WILL* appear in elimination approved players list
            if (e.links['Q']) {
               let linked = findEventByID(e.links['Q']);
               if (!linked) {
                  delete e.links['Q'];
                  return filterPlayers();
               } 

               let qualified = !linked.qualified ? [] : linked.qualified.map(teamHash);
               let qualifying = !linked.approved ? [] : linked.approved.filter(a=>qualified.indexOf(a) < 0);
               return filterPlayers(qualifying);

            }
            if (e.links['R']) {
               let linked = findEventByID(e.links['R']);
               if (!linked) {
                  delete e.links['R'];
                  return filterPlayers();
               } 
               let qualified = !linked.qualified ? [] : linked.qualified.map(teamHash);
               let qualifying = !linked.approved ? [] : linked.approved.filter(a=>qualified.indexOf(a) < 0);
               return filterPlayers(qualifying);
            }
         } else if (['Q', 'R'].indexOf(e.draw_type) >= 0) {
            // qualifying events can't have approved players who are also approved in linked elimination events
            if (e.links['E']) {
               let linked = findEventByID(e.links['E']);
               if (!linked) {
                  delete e.links['E'];
                  return filterPlayers();
               } 
               let qual_hash = !e.qualified ? [] : e.qualified.map(teamHash);
               linked_approved = !linked.approved ? [] : linked.approved.filter(a=>qual_hash.indexOf(a)<0);
               return filterPlayers(linked_approved);
            }
         }

         return filterPlayers();

         function filterPlayers(filter=[]) {
            if (filter.length) modifyApproved.filter(e, filter);
            return tournament.players.filter(p=>filter.indexOf(p.id) >= 0);
         }
      }

      function eligiblePlayers(e, ineligible_players, unavailable_players) {

         unavailable_players = unavailable_players || unavailablePlayers(e);
         let unavailable_ids = unavailable_players.map(p=>p.id);

         ineligible_players = ineligible_players || ineligiblePlayers(e);
         let ineligible_ids = ineligible_players.map(p=>p.id);

         let available_players = tournament.players
            .filter(p => ineligible_ids.indexOf(p.id) < 0)
            // .filter(p => p.signed_in && p.withdrawn != 'Y')
            .filter(p => p.signed_in)
            .map((p, i) => {
               let c = Object.assign({}, p);
               // if there is no category ranking, don't add order attribute
               if (c.category_ranking) c.order = i + 1;
               return c;
            })
            .filter(p => unavailable_ids.indexOf(p.id) < 0);

         if (e.draw_type == 'C') {
            // if building a consolation draw, available players are those who have lost in a linked main draw event...
            if (!e.links['E']) return [];

            let linked = findEventByID(e.links['E']);

            // find all completed matches from linked elimination draw
            let completed_matches = eventMatches(linked).filter(m=>m.match.winner);
            if (!completed_matches.length) return [];

            let winner_ids = [].concat(...completed_matches.map(match => match.match.winner.map(team=>team.id)));
            let loser_ids = [].concat(...completed_matches.map(match => match.match.loser.map(team=>team.id)));

            // Unless e.structure == 'feed', filter out teams who had a win
            // TODO: add in support for feed-in draws...
            loser_ids = loser_ids.filter(i => winner_ids.indexOf(i) < 0);
            alternate_ids = available_players.filter(i => winner_ids.indexOf(i.id) < 0 && loser_ids.indexOf(i.id) < 0).map(p=>p.id);

            available_players = available_players.filter(p=>loser_ids.indexOf(p.id) >= 0 || alternate_ids.indexOf(p.id) >= 0);
         }

         if (e.gender) modifyApproved.filterGender(e);

         if (e.format == 'S') {
            return available_players.filter(p => e.approved.indexOf(p.id) < 0);
         } else {
            let team_players = e.teams ? [].concat(...e.teams) : [];
            return available_players.filter(p => team_players.indexOf(p.id) < 0);
         }
      }

      function rankedTeams(list) { 
         if (!list || !list.length) return false;
         if (list[0].players) {
            list = [].concat(...list.map(a=>a.players));
         } else {
            list = [].concat(...list);
         }
         let ranked = list.reduce((p, c) => c.category_ranking || p, false); 
         return ranked;
      }

      function approvedPlayers(e) {
         let approved_players = tournament.players
            .filter(p => e.approved.indexOf(p.id) >= 0)
            // make a copy of player objects to avoid changing originals
            .map(p => Object.assign({}, p));

         let seed_limit = drawFx.seedLimit(approved_players.length);

         // Round Robins must have at least one seed per bracket
         if (e.draw_type == 'R') seed_limit = Math.max(seed_limit, e.brackets * 2);
         // Qualifying Draws must have at least one seed per section
         if (e.draw_type == 'Q') seed_limit = Math.max(seed_limit, e.qualifiers);

         let linkedQ = findEventByID(e.links['Q']) || findEventByID(e.links['R']);
         let qualifier_ids = linkedQ && linkedQ.qualified ? linkedQ.qualified.map(teamHash) : [];

         let linkedE = findEventByID(e.links['E']);
         let alternate_ids = (e.draw_type == 'C' && linkedE && linkedE.approved) ?
            approved_players.map(ap => ap.id).filter(i => linkedE.approved.indexOf(i) < 0) : [];

         let seeding = rankedTeams(approved_players);

         approved_players = approved_players
            .map((p, i) => {

               let qualifier = qualifier_ids.indexOf(p.id) >= 0;
               let alternate = alternate_ids.indexOf(p.id) >= 0;
               p.entry = qualifier ? 'Q' : alternate ? 'A' : p.entry;

               // TODO: implement qualifier in approvedTeams?

               p.draw_order = i + 1;
               p.seed = (seeding && i < seed_limit) ? i + 1 : undefined;

               p.rank = p.category_ranking;
               p.last_name = p.last_name.toUpperCase();
               p.first_name = util.normalizeName(p.first_name, false);
               return p;
            });

         return approved_players;
      }

      function promoteTeams(e) {
         if (!state.edit || e.active) return;
         let approved_hash = e.approved.map(a=>a.join('|'));
         let not_promoted = e.teams.filter(team => approved_hash.indexOf(team.join('|')) < 0).filter(team => team.length == 2);
         e.approved = [].concat(e.approved, not_promoted);
         saveTournament(tournament);
         approvedChanged(e, true);
      }

      function teamObj(e, team, idmap) {
         let team_players = team.map(id=>idmap[id]).sort(lastNameSort);
         let team_hash = team_players.map(p=>p.id).sort().join('|');
         let subrank = (e.doubles_subrank && e.doubles_subrank[team_hash]) ? e.doubles_subrank[team_hash] : undefined;
         let combined_rank = team_players.map(t=>t.category_ranking).reduce((a, b) => (+a || 1000) + (+b || 1000));
         return { players: team_players, combined_rank, subrank }

         function lastNameSort(a, b) {
            if (a.last_name < b.last_name) return -1;
            if (b.last_name < a.last_name) return 1;
            return 0;
         }
      }

      function combinedRankSort(a, b) { 
         return (a.combined_rank == b.combined_rank) ?
            (a.subrank || 1000) - (b.subrank || 1000) :
            (a.combined_rank || 1000) - (b.combined_rank || 1000); 
      }

      // create object to find players by id; make a copy of player objects to avoid changing originals
      function idMap(players) { return Object.assign({}, ...players.map(p => { return { [p.id]: Object.assign({}, p) }})); }

      function approvedTeams(e) {
         let idmap = idMap(tournament.players);
         let approved = e.approved ? e.approved.map(t=>teamObj(e, t, idmap)).sort(combinedRankSort) : [];
         let seed_limit = drawFx.seedLimit(approved.length);
         let seeding = rankedTeams(approved);
         approved.forEach((team, i) => { team.seed = (seeding && i + 1 <= seed_limit) ? i + 1 : undefined });
         return approved;
      }

      function eventTeams(e) {
         if (!e.teams || !e.teams.length) return [];
         let idmap = idMap(tournament.players);

         let approved_hash = e.approved.map(a=>a.join('|'));
         let not_promoted = e.teams.filter(team => approved_hash.indexOf(team.join('|')) < 0);

         let teams = not_promoted.map(t=>teamObj(e, t, idmap)).sort(combinedRankSort);
         teams.forEach(team => team.rank = team.combined_rank);
         return teams;
      }

      function emptyBrackets(num = 1) {
         return d3.range(0, num).map(bracket => { return {
            puids:   [],
            players: [],
            matches: [],
         }});
      }

      function teamSort(teams) {
         // alphabetize teams before sorting array of teams ... /
         teams.forEach(team => team.sort((a, b) => a.full_name < b.full_name ? -1 : a.full_name > b.full_name ? 1 : 0));
         return teams.sort((a, b) => (a[0].full_name < b[0].full_name) ? -1 : (a[0].full_name > b[0].full_name) ? 1 : 0);
      }

      function approvedOpponents(e) {
         if (e.format == 'S') { 
            return approvedPlayers(e).map(p=>[p]);
         } else {
            return approvedTeams(e).map(team => team.players.map(player => Object.assign(player, { seed: team.seed })));;
         }
      }

      function checkForQualifiedTeams(e) {
         if (e.draw_type != 'Q') return;
         let qualifiers = drawFx.drawInfo(e.draw).final_round_players;
         let qualified = qualifiers ? qualifiers.filter(f=>f) : [];
         qualified.forEach(team => qualifyTeam(e, team));
      }

      function generateDraw(e) {
         let approved_opponents = approvedOpponents(e);

         if (!approved_opponents.length || approved_opponents.length < 2) return;

         let seed_limit = drawFx.seedLimit(approved_opponents.length);
         let num_players = approved_opponents.length;

         tree_draw.options({ max_round: undefined });
         tree_draw.options({ draw: { feed_in: e.structure == 'feed' }});
         tree_draw.options({ flags: { display: true, path: './assets/flags/' }});

         let qualification = () => {

            let draw_size = drawFx.standardDrawSizes(num_players);
            if ([1, 2, 4, 8, 16, 32, 64].indexOf(e.qualifiers) >= 0 && draw_size == util.nearestPow2(draw_size)) {
               let structural_byes = draw_size == 12 ? drawFx.structuralByes(draw_size, true) : undefined;
               e.draw = drawFx.buildDraw({ teams: draw_size, structural_byes });
               e.draw.max_round = util.log2(util.nearestPow2(draw_size)) - util.log2(e.qualifiers);
               e.draw.seeded_teams = drawFx.seededTeams({ teams: approved_opponents });

               if (e.qualifiers < 2) {
                  e.draw.seed_placements = drawFx.validSeedPlacements({ num_players: draw_size, random_sort: true, seed_limit });
               } else {
                  e.draw.seed_placements = drawFx.qualifyingSeedPlacements({ draw: e.draw, num_players: draw_size, qualifiers: e.qualifiers, seed_limit });
               }

            } else {
               e.draw = drawFx.buildQualDraw(num_players, e.qualifiers || 1);

               // TODO: for abnormal number of qualifiers where should seeds be placed?

               e.draw.seeded_teams = [];
               approved_opponents.forEach(o => { delete o[0].seed });
            }

            e.draw.unseeded_placements = [];
            e.draw.opponents = approved_opponents;
            e.draw.unseeded_teams = teamSort(e.draw.opponents.filter(f=>!f[0].seed));

            let count = Math.max(2, e.qualifiers);

            drawFx.placeSeedGroups({ draw: e.draw, count });

            if (e.automated) {
               drawFx.placeSeedGroups({ draw: e.draw });
               drawFx.distributeByes({ draw: e.draw });
               drawFx.placeUnseededTeams({ draw: e.draw });
               drawFx.advanceTeamsWithByes({ draw: e.draw });
               if (e.draw_type == 'Q') checkForQualifiedTeams(e);

               drawCreated(e);
               eventBackground(e);
               eventList();
            } else {
               testLastSeedPosition(e);
            }
         }

         let elimination = () => {

            let num_players = approved_opponents.length + e.qualifiers;

            // build a blank draw 
            let structural_byes = e.draw_size == 12 ? drawFx.structuralByes(e.draw_size, true) : undefined;
            e.draw = drawFx.buildDraw({ teams: e.draw_size, structural_byes });

            if (!e.draw_size) return;

            // has to be defined after draw is built
            e.draw.qualifiers = e.qualifiers || 0;

            e.draw.unseeded_placements = [];
            e.draw.opponents = approved_opponents;
            e.draw.seed_placements = drawFx.validSeedPlacements({ num_players, random_sort: true, seed_limit });

            e.draw.seeded_teams = drawFx.seededTeams({ teams: e.draw.opponents });
            e.draw.unseeded_teams = teamSort(e.draw.opponents.filter(f=>!f[0].seed));

            let seeding = rankedTeams(approved_opponents);
            if (!seeding) {
               e.draw.seeded_teams = [];
               delete e.draw.seed_placements;
            }

            // always place first two seeded groups (2 x 1) => place first two seeds
            drawFx.placeSeedGroups({ draw: e.draw, count: 2 });

            if (e.automated) {
               drawFx.placeSeedGroups({ draw: e.draw });
               drawFx.distributeByes({ draw: e.draw });
               drawFx.distributeQualifiers({ draw: e.draw });
               drawFx.placeUnseededTeams({ draw: e.draw });
               drawFx.advanceTeamsWithByes({ draw: e.draw });
               if (e.draw_type == 'Q') checkForQualifiedTeams(e);
               drawCreated(e);
               eventBackground(e);
               eventList();
            } else {
               testLastSeedPosition(e);
            }
         }

         let consolation = () => {
            let linked = findEventByID(e.links['M']);

            let consolation_num_players = num_players;
            if (e.structure == 'feed') {
               e.draw = drawFx.feedInDraw({ teams: drawFx.standardDrawSizes(consolation_num_players) });
            } else {
               e.draw = drawFx.buildDraw({ teams: drawFx.standardDrawSizes(consolation_num_players) });
               e.draw.unseeded_placements = [];
               e.draw.opponents = approved_opponents;
               e.draw.seed_placements = drawFx.validSeedPlacements({ num_players, random_sort: true, seed_limit });

               e.draw.seeded_teams = drawFx.seededTeams({ teams: e.draw.opponents });
               e.draw.unseeded_teams = teamSort(e.draw.opponents.filter(f=>!f[0].seed));

               let seeding = rankedTeams(approved_opponents);
               if (!seeding) {
                  e.draw.seeded_teams = [];
                  delete e.draw.seed_placements;
               }
               // always place first two seeded groups (2 x 1) => place first two seeds
               drawFx.placeSeedGroups({ draw: e.draw, count: 2 });

               if (e.automated) {
                  drawFx.placeSeedGroups({ draw: e.draw });
                  drawFx.distributeByes({ draw: e.draw });
                  drawFx.distributeQualifiers({ draw: e.draw });
                  drawFx.placeUnseededTeams({ draw: e.draw });
                  drawFx.advanceTeamsWithByes({ draw: e.draw });
                  drawCreated(e);
                  eventBackground(e);
                  eventList();
               } else {
                  testLastSeedPosition(e);
               }
            }
         }

         let roundrobin = () => {
            let brackets = emptyBrackets(e.brackets || 1);
            let bracket_size = e.bracket_size;

            e.draw = { 
               brackets,
               bracket_size,
            };
            e.draw.opponents = approved_opponents;
            e.draw.seeded_teams = drawFx.seededTeams({ teams: e.draw.opponents });
            e.draw.unseeded_teams = teamSort(e.draw.opponents.filter(f=>!f[0].seed));

            e.draw.seed_placements = drawFx.roundrobinSeedPlacements({ draw: e.draw, bracket_size });
            drawFx.placeSeedGroups({ draw: e.draw, count: e.brackets });

            drawFx.rrByeDistribution({ draw: e.draw });
            
            if (e.automated) {
               drawFx.placeSeedGroup({ draw: e.draw, group_index: e.brackets });
               drawFx.rrUnseededPlacements({ draw: e.draw });
               drawCreated(e);
               eventBackground(e);
            }
         }

         let drawTypes = {
            'Q': () => qualification(),
            'E': () => elimination(),
            'R': () => roundrobin(),
            'C': () => consolation(),
         }

         if (drawTypes[e.draw_type] && !e.active) drawTypes[e.draw_type](); 
      }

      function eventPlayers(e) {
         // insure that tournament players sorted by rank
         tournament.players = orderPlayersByRank(tournament.players, e.category);

         let teams = [];
         let approved = [];
         let ineligible = ineligiblePlayers(e);
         let unavailable = unavailablePlayers(e);
         let eligible = eligiblePlayers(e, ineligible, unavailable);

         let linkedQ = findEventByID(e.links['Q']) || findEventByID(e.links['R']);
         let qualifier_ids = linkedQ && linkedQ.qualified ? linkedQ.qualified.map(teamHash) : [];

         let linkedE = findEventByID(e.links['E']);
         let alternate_ids = (e.draw_type == 'C' && linkedE && linkedE.approved) ?
            eligible.map(el => el.id).filter(i => linkedE.approved.indexOf(i) < 0) : [];

         if (e.format == 'S') {
            eligible.forEach(p => { 
               if (qualifier_ids.indexOf(p.id) >= 0) {
                  p.full_name = `<div style='color: green'>${p.full_name}&nbsp;<span class='player_seed'>[Q]</span></div>`; 
               } else if (alternate_ids.indexOf(p.id) >= 0) {
                  p.full_name = `<div style='color: orange'>${p.full_name}&nbsp;<span class='player_seed'>[A]</span></div>`; 
               } else {
                  if (p.order) p.full_name = `${p.full_name}&nbsp;<span class='player_order'>(${p.order})</span>`; 
               }
            });

            approved = approvedPlayers(e);

            // TODO: make this work for doubles...
            approved.forEach(p => { 
               if (qualifier_ids.length && qualifier_ids.indexOf(p.id) >= 0) {
                  p.full_name = `<div style='color: green'>${p.full_name}&nbsp;<span class='player_seed'>[Q]</span></div>`; 
               } else if (p.seed && p.seed < 2000) {
                  p.full_name = `${p.full_name}&nbsp;<span class='player_seed'>[${p.seed}]</span>`; 
               }
            });

            playerSort(approved);
            playerSort(ineligible);
            playerSort(unavailable);
         } else {
            eligible.forEach(p => { if (p.order) p.full_name = `${p.full_name}&nbsp;<span class='player_order'>(${p.order})</span>`; });
            teams = teamRankDuplicates(eventTeams(e));
            approved = teamRankDuplicates(approvedTeams(e));
         }

         gen.displayEventPlayers({ container, approved, teams, eligible, ineligible, unavailable });

         function changeGroup(evt) {
            if (!state.edit || e.active) return;
            e.changed = true;
            let grouping = util.getParent(evt.target, 'player_container').getAttribute('grouping');

            let elem = util.getParent(evt.target, 'player_click');
            let puid = elem.getAttribute('puid');
            let id = elem.getAttribute('uid');

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
            e.changed = true;
            let grouping = util.getParent(evt.target, 'player_container').getAttribute('grouping');
            let elem = util.getParent(evt.target, 'team_click');
            let team_id = elem.getAttribute('team_id');
            if (team_id) {

               if (grouping == 'approved') {
                  e.approved = e.approved.filter(team => team_id != team.join('|'));
               } else {
                  e.teams = e.teams.filter(team => team_id != team.join('|'));
               }
               approvedChanged(e, true);
               saveTournament(tournament);
            }
         }

         function addSubrank(evt) {
            if (!state.edit || e.active) return;
            let grouping = util.getParent(evt.target, 'player_container').getAttribute('grouping');
            let elem = util.getParent(evt.target, 'team_click');
            let duplicates = elem.getAttribute('duplicates');

            if (duplicates) {
               var team_id = elem.getAttribute('team_id');
               var clicked = (grouping == 'approved') ? reduceTeams(approved, team_id) : reduceTeams(teams, team_id);

               let remove = `${lang.tr('draws.remove')}: Subrank`;
               let options = [].concat(remove, ...util.range(0, duplicates).map(d => `Subrank: ${d + 1}`));
               gen.svgModal({ x: evt.clientX, y: evt.clientY, options, callback: assignSubrank });

               function assignSubrank(selection, i) {
                  if (!e.doubles_subrank) e.doubles_subrank = {};
                  let team_hash = clicked.players.map(p=>p.id).sort().join('|');
                  e.doubles_subrank[team_hash] = i;
                  approvedChanged(e, true);
                  saveTournament(tournament);
               }
            }

            function reduceTeams(teams, team_id) { return teams.reduce((p, c) => team_id == hash(c) ? c : p, undefined); }
            function hash(team) { return team.players.map(p=>p.id).join('|'); }
         }

         util.addEventToClass('player_click', changeGroup, container.event_details.element);
         util.addEventToClass('team_click', removeTeam, container.event_details.element);
         util.addEventToClass('team_click', addSubrank, container.event_details.element, 'contextmenu');

         let cm = (evt) => console.log('context menu:', evt);
         util.addEventToClass('player_click', cm, container.event_details.element, 'contextmenu');

         // if there is a qualifiers selection option, change based on approved players
         if (e.draw_type == 'Q') {
            if (event_config.qualifiers && event_config.qualifiers.ddlb) {
               let {max_qualifiers, options } = qualifyingDrawSizeOptions(e);
               if (e.qualifiers > max_qualifiers) e.qualifiers = max_qualifiers;
               event_config.qualifiers.ddlb.setOptions(options);
               event_config.qualifiers.ddlb.setValue(Math.min(e.qualifiers || 0, max_qualifiers) || 0);
            }
         }
         if (e.draw_type == 'R') {
            let {options, size_options } = roundRobinDrawBracketOptions(e);
            if (event_config.brackets && event_config.brackets.ddlb) {
               event_config.brackets.ddlb.setOptions(options);
               event_config.brackets.ddlb.setValue(e.brackets);

               event_config.bracket_size.ddlb.setOptions(size_options);
               event_config.bracket_size.ddlb.setValue(e.bracket_size);
            }
            setRRQualifiers(e);
         }
         eventList(true);
      }

      fx.scheduledMatches = scheduledMatches;
      function scheduledMatches() {
         let { completed_matches, pending_matches } = tournamentEventMatches({ tournament, source: true });
         let all_matches = [].concat(...pending_matches, completed_matches);
         let scheduled = all_matches.filter(m=>m.schedule && m.schedule.day);
         let days = util.unique(scheduled.map(m=>m.schedule.day));
         return { scheduled, days };
      }

      function scheduleTab() {
         if (!tournamentCourts() || group_draws.length || !tournament.events || !tournament.events.length) {
            tabVisible(container, 'ST', false);
            return;
         }
         tabVisible(container, 'ST', true);
         displaySchedule();
      }

      function teamName(match, team) {
         if (team.length == 1) {
            let p = match.players[team[0]];
            let club = p.club_code ? ` (${p.club_code})` : '';
            let full_name = `${util.normalizeName(p.first_name)} ${util.normalizeName(p.last_name).toUpperCase()}`; 
            return `${full_name}${club}`;
         } else {
            return team.map(p => util.normalizeName(match.players[p].last_name).toUpperCase()).join('/');
         }
      }

      function courtData(luid) {
         let courts = [];
         tournament.locations.forEach(l => {
            let identifiers = l.identifiers ? l.identifiers.split(',').join(' ').split(' ').filter(f=>f) : [];
            if (!luid || luid == l.luid) { 
               util.range(1, +l.courts + 1).forEach(i => {
                  let identifier = identifiers[i - 1] || i;
                  let court = { 
                     luid: l.luid,
                     name: `${l.abbreviation} ${identifier}`,
                     availability: [1,2,3,4,5,6,7,8,9,10],
                  };
                  courts.push(court);
               });
            }
         });
         return courts;
      }

      // separated this function from scheduleTab() because uglify caused errors
      function displaySchedule() {
         var { completed_matches, pending_matches } = tournamentEventMatches({ tournament, source: true });

         let img = new Image();
         img.src = "./icons/dragmatch.png";

         // TODO: consider the possibility that tournament dates may not include all dates within a range
         let date_range = util.dateRange(tournament.start, tournament.end);
         let formatted_date_range = date_range.map(util.formatDate);

         let date_localization = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
         function localizeDate(date) {
            return date.toLocaleDateString(lang.tr('datelocalization'), date_localization);
         }

         let all_matches = [].concat(...pending_matches, completed_matches);
         let muid_key = Object.assign({}, ...all_matches.map(m=>({ [m.muid]: m })));

         // if displayed_schedule_day is null, set to today IF today is part of the tournament range
         let today = util.formatDate(new Date());
         if (!displayed_schedule_day && formatted_date_range.indexOf(today) >= 0) displayed_schedule_day = today; 
         displayed_schedule_day = displayed_schedule_day || util.formatDate(tournament.start);

         let day_matches = all_matches;

         // create a list of all matches which are unscheduled or can be moved
         let search_list = all_matches;
         filterSearchList();

         let courts = courtData();
         let oop_rounds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

         let date_options = date_range.map(d => ({ key: localizeDate(d), value: util.formatDate(d) }));
         dd.attachDropDown({ 
            id: container.schedule_day.id, 
            options: date_options,
            label: '',
         });
         container.schedule_day.ddlb = new dd.DropDown({ element: container.schedule_day.element, id: container.schedule_day.id, onChange: dateChange });
         container.schedule_day.ddlb.selectionBackground();
         container.schedule_day.ddlb.setValue(displayed_schedule_day);

         let event_filters = [].concat({ key: lang.tr('schedule.allevents'), value: '' }, ...tournament.events.map(evt => ({ key: evt.name, value: evt.euid })));
         dd.attachDropDown({ 
            id: container.event_filter.id, 
            options: event_filters,
            label: '',
         });
         container.event_filter.ddlb = new dd.DropDown({ element: container.event_filter.element, id: container.event_filter.id, onChange: displayPending });
         container.event_filter.ddlb.selectionBackground();

         let location_filters = [].concat({ key: lang.tr('schedule.allcourts'), value: '' }, ...tournament.locations.map(l => ({ key: l.name, value: l.luid })));
         dd.attachDropDown({ 
            id: container.location_filter.id, 
            options: location_filters,
            label: '',
         });
         container.location_filter.ddlb = new dd.DropDown({ element: container.location_filter.element, id: container.location_filter.id, onChange: displayCourts });
         container.location_filter.ddlb.selectionBackground();

         // show or hide option button depending on whether there is more than one option
         util.getParent(container.location_filter.element, 'schedule_options').style.display = (tournament.locations.length > 1) ? 'flex' : 'none';

         let rounds = util.unique(pending_matches.map(m=>m.round_name));
         let round_filters = [].concat({ key: lang.tr('schedule.allrounds'), value: '' }, ...rounds.map(round => ({ key: round, value: round })));
         dd.attachDropDown({ 
            id: container.round_filter.id, 
            options: round_filters,
            label: '',
         });
         container.round_filter.ddlb = new dd.DropDown({ element: container.round_filter.element, id: container.round_filter.id, onChange: displayPending });
         container.round_filter.ddlb.selectionBackground();

         displayPending();
         dateChange(displayed_schedule_day);

         function dateChange(value) {
            displayed_schedule_day = value;
            filterDayMatches();
            displayScheduleGrid();
         }

         function filterDayMatches() {
            day_matches = all_matches.filter(f=>f.schedule && f.schedule.day == displayed_schedule_day);
         }

         function filterSearchList() {
            search_list = all_matches
               // finished matches shouldn't be moved
               .filter(match => match.winner == undefined)
               .map(match => ({ value: match.muid, label: match.team_players.map(team=>teamName(match, team)).join(' v. ') }) );
         }

         function displayCourts() {
            let luid = container.location_filter.ddlb.getValue();
            courts = courtData(luid);
            filterDayMatches();
            displayScheduleGrid();
         }

         function displayPending() {
            let euid = container.event_filter.ddlb.getValue();
            let euid_filtered = !euid ? pending_matches : pending_matches.filter(m=>m.event.euid == euid);
            let round = container.round_filter.ddlb.getValue();

            let round_filtered = !round ? euid_filtered : euid_filtered.filter(m=>m.round_name == round);

            gen.scheduleTeams({ 
               pending_matches: round_filtered,
               element: container.unscheduled.element,
            });
            util.addEventToClass('dragUnscheduled', dragUnscheduled, container.unscheduled.element, 'dragstart');
         }

         function displayScheduleGrid() {
            gen.scheduleGrid({
               courts,
               oop_rounds,
               editable: state.edit,
               scheduled: day_matches,
               element: container.schedule.element,
            });
            util.addEventToClass('findmatch', showSearch, container.schedule.element, 'click');
            util.addEventToClass('opponentsearch', (e)=>e.stopPropagation(), container.schedule.element, 'click');

            util.addEventToClass('dragdrop', dragStart, container.schedule.element, 'dragstart');
            util.addEventToClass('dragdrop', drop, container.schedule.element, 'drop');

            util.addEventToClass('schedule_box', gridContext, container.schedule.element, 'contextmenu');
            util.addEventToClass('oop_round', roundContext, container.schedule.element, 'contextmenu');
            util.addEventToClass('schedule_box', selectMatch, container.schedule.element, 'click');
         }

         util.addEventToClass('dropremove', dropRemove, document, 'drop');

         function populateGridCell(target, muid, match) {
            // set muid attribute so that match can be found when clicked upon
            // and draggable attribute so that match can be dragged
            target.setAttribute('muid', muid);
            target.setAttribute('draggable', 'true');
            let sb = gen.scheduleBox({ match, editable: true});
            target.innerHTML = sb.innerHTML;
            target.style.background = sb.background;
         }

         function removeFromUnscheduled(muid) {
            let unscheduled_matches = Array.from(container.unscheduled.element.querySelectorAll('.unscheduled_match'));
            let scheduled_match = unscheduled_matches.reduce((m, c) => c.getAttribute('muid') == muid ? c : m);
            scheduled_match.parentNode.removeChild(scheduled_match);
            pending_matches = pending_matches.filter(m=>m.muid != muid);
         }

         function returnToUnscheduled(match, element) {
            if (!match || !match.schedule || !match.schedule.court) return;

            element.setAttribute('muid', '');
            element.setAttribute('draggable', 'false');
            element.setAttribute('court', match.schedule.court);
            element.setAttribute('oop_round', match.schedule.oop_round);
            element.style.background = 'white';

            element.innerHTML = gen.emptyOOPround(true);
            util.addEventToClass('findmatch', showSearch, element, 'click');
            util.addEventToClass('opponentsearch', (e)=>e.stopPropagation(), element, 'click');

            match.status = '';
            match.source.schedule = '';
            match.schedule = {};
            match.source.schedule = {};
            saveTournament(tournament);

            ({ completed_matches, pending_matches } = tournamentEventMatches({ tournament, source: true }));
            displayPending();
         }

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
                  scheduleMatch(muid);
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
               evt.target.innerHTML = gen.opponentSearch();
            }

            function scheduleMatch(source_muid) {
               let target = util.getParent(evt.target, 'schedule_box');
               let luid = target.getAttribute('luid');
               let court = target.getAttribute('court');
               let oop_round = target.getAttribute('oop_round');
               let source_match = muid_key[source_muid];

               if (source_match.winner != undefined) return;

               let source_schedule = source_match.schedule && source_match.schedule.court ? Object.assign({}, source_match.schedule) : {};
               let target_schedule = { luid, court, oop_round, day: displayed_schedule_day };

               let previously_scheduled = Object.keys(source_schedule).length;
               if (!previously_scheduled || target_schedule.day != source_match.schedule.day) {
                  // if the source is unscheuled or scheduled on a **different** day
                  source_match.schedule = target_schedule;
                  source_match.source.schedule = target_schedule;

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
                  findmatch.innerHTML = gen.opponentSearch();

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

               saveTournament(tournament);

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
         }

         function drop(ev) {
            ev.preventDefault();
            let itemtype = ev.dataTransfer.getData("itemtype");
            let itemid = ev.dataTransfer.getData("itemid");

            let source = document.getElementById(itemid);
            let source_muid = source.getAttribute('muid');

            let target = ev.currentTarget;
            let target_muid = target.getAttribute('muid');

            let source_match = muid_key[source_muid];
            let source_schedule = Object.assign({}, source_match.schedule);

            let target_match = target_muid ? muid_key[target_muid] : { source: {} };

            if (target_match.winner != undefined) return;

            if (target_muid == '') {
               let luid = target.getAttribute('luid');
               let court = target.getAttribute('court');
               let oop_round = target.getAttribute('oop_round');
               target_match.schedule = { luid, court, oop_round, day: displayed_schedule_day };
            }

            if (itemtype != 'unscheduled') {
               // this section for swapping places between two scheduled matches
               
               // only re-assign source if it is NOT an unscheduled match
               source_match.schedule = Object.assign({}, target_match.schedule);
               source_match.source.schedule = Object.assign({}, target_match.schedule);
               target_match.schedule = Object.assign({}, source_schedule);
               target_match.source.schedule = Object.assign({}, source_schedule);

               target.setAttribute('court', target_match.schedule.court);
               target.setAttribute('oop_round', target_match.schedule.oop_round);
               source.setAttribute('court', source_match.schedule.court);
               source.setAttribute('oop_round', source_match.schedule.oop_round);

               // swap storage object and source object -- doesn't swap times in HTML
               // util.swapElements(source, target);

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


            saveTournament(tournament);
         }

         function identifyRound(ev) {
            let target = util.getParent(ev.target, 'oop_round');
            let oop_round = target.getAttribute('oop_round');
            return { oop_round };
         }

         function roundContext(ev) {
            if (!state.edit) return;

            let { oop_round } = identifyRound(ev);
            if (oop_round) {
               let options = [
                  lang.tr('schedule.matchestime'),
                  lang.tr('schedule.notbefore'),
                  lang.tr('schedule.followedby'),
                  lang.tr('schedule.afterrest'),
                  lang.tr('schedule.tba'),
                  lang.tr('schedule.nextavailable'),
                  lang.tr('schedule.clear'),
               ];
               gen.svgModal({ x: ev.clientX, y: ev.clientY, options, callback: modifySchedules });

               function modifySchedules(choice, index) {
                  console.log('OOP round:', oop_round, 'selection was:', choice, index);
                  if (index == 0) {
                     filterDayMatches();
                     // gen.timePicker({ hour_range: { start: 8 }, minutes: [0, 30], callback: setTime })
                     gen.timePicker({ hour_range: { start: 8 }, minute_increment: 5, callback: setTime })
                  } else if (index == 1) {
                     modifyMatchSchedule([{ attr: 'time_prefix', value: 'NB ' }]);
                  } else if (index == 2) {
                     let pairs = [
                        { attr: 'time_prefix', value: '' },
                        { attr: 'time', value: '' },
                        { attr: 'heading', value: 'Followed By' },
                     ];
                     modifyMatchSchedule(pairs);
                  } else if (index == 3) {
                     let pairs = [
                        { attr: 'time_prefix', value: 'After Rest' },
                        { attr: 'time', value: '' },
                        { attr: 'heading', value: '' },
                     ];
                     modifyMatchSchedule(pairs);
                  } else if (index == 4) {
                     let pairs = [
                        { attr: 'time_prefix', value: 'TBA' },
                        { attr: 'time', value: '' },
                     ];
                     modifyMatchSchedule(pairs);
                  } else if (index == 5) {
                     let pairs = [
                        { attr: 'time_prefix', value: '' },
                        { attr: 'time', value: '' },
                        { attr: 'heading', value: 'Next Available' },
                     ];
                     modifyMatchSchedule(pairs);
                  } else if (index == 6) {
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
                           pairs.forEach(pair => match.schedule[pair.attr] = pair.value);
                           if (display) updateScheduleBox(match);
                        }
                     });
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
                     lang.tr('draws.matchtime'),      // 0
                     lang.tr('draws.timeheader'),     // 1
                     lang.tr('draws.changestatus'),   // 2
                     lang.tr('draws.umpire'),         // 3
                     lang.tr('draws.penalty'),        // 4
                     lang.tr('draws.remove')          // 5
                  ];
               } else {
                  return;
               }
               gen.svgModal({ x: ev.clientX, y: ev.clientY, options, callback: modifySchedule });

               function modifySchedule(choice, index) {
                  if (!complete) {
                     if (index == 0) {
                        let time_string = match.schedule && match.schedule.time;
                        // gen.timePicker({ time_string, hour_range: { start: 8 }, minutes: [0, 30], callback: setTime })
                        gen.timePicker({ hour_range: { start: 8 }, minute_increment: 5, callback: setTime })
                     } else if (index == 1) {
                        let headings = [
                           lang.tr('schedule.notbefore'),
                           lang.tr('schedule.followedby'),
                           lang.tr('schedule.afterrest'),
                           lang.tr('schedule.tba'),
                           lang.tr('schedule.nextavailable'),
                           lang.tr('schedule.clear'),
                        ];
                        setTimeout(function() {
                           gen.svgModal({ x: ev.clientX, y: ev.clientY, options: headings, callback: timeHeading });
                        }, 200);
                     } else if (index == 2) {
                        let statuses = [
                           lang.tr('schedule.oncourt'),
                           lang.tr('schedule.warmingup'),
                           lang.tr('schedule.suspended'),
                           lang.tr('schedule.raindelay'),
                           lang.tr('schedule.clear'),
                        ];
                        setTimeout(function() {
                           gen.svgModal({ x: ev.clientX, y: ev.clientY, options: statuses, callback: matchStatus });
                        }, 200);
                     } else if (index == 3) {
                        addUmpire(match, 'schedule');
                        return;
                     } else if (index == 4) {
                        let statuses = [
                           { label: lang.tr('penalties.fail2signout'), value: 'fail2signout' },
                           { label: lang.tr('penalties.illegalcoaching'), value: 'illegalcoaching' },
                           { label: lang.tr('penalties.ballabuse'), value: 'ballabuse' },
                           { label: lang.tr('penalties.racquetabuse'), value: 'racquetabuse' },
                           { label: lang.tr('penalties.equipmentabuse'), value: 'equipmentabuse' },
                           { label: lang.tr('penalties.cursing'), value: 'cursing' },
                           { label: lang.tr('penalties.rudegestures'), value: 'rudegestures' },
                           { label: lang.tr('penalties.foullanguage'), value: 'foullanguage' },
                           { label: lang.tr('penalties.timeviolation'), value: 'timeviolation' },
                           { label: lang.tr('penalties.latearrival'), value: 'latearrival' },
                        ];
                        setTimeout(function() {
                           gen.svgModal({ x: ev.clientX, y: ev.clientY, options: statuses, callback: assessPenalty });
                        }, 200);
                     } else if (index == 5) {
                        returnToUnscheduled(match, target);
                        return;
                     }
                  }
               }

               function setTime(value) {
                  match.schedule.time = value;
                  updateScheduleBox(match);
               }
               function assessPenalty(penalty, penalty_index, penalty_value) {
                  let players = match.players.map(p=>p.full_name);
                  setTimeout(function() {
                     gen.svgModal({ x: ev.clientX, y: ev.clientY, options: players, callback: playerPenalty });
                  }, 200);
                  function playerPenalty(player, index, value) {
                     let puid = match.players[index].puid;
                     let tournament_player = tournament.players.reduce((p, s) => s.puid == puid ? s : p);
                     if (!tournament_player.penalties) tournament_player.penalties = [];
                     tournament_player.penalties.push({ penalty, index: penalty_index, value: penalty_value });
                  }
               }
               function matchStatus(value, index) {
                  match.status = index == 4 ? '' : value;
                  updateScheduleBox(match);
               }
               function timeHeading(selection, index) {
                  if (index == 0) {
                     modifyMatchSchedule([{ attr: 'time_prefix', value: 'NB ' }]);
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

                  function modifyMatchSchedule(pairs, display=true) {
                     pairs.forEach(pair => match.schedule[pair.attr] = pair.value);
                     if (display) updateScheduleBox(match);
                     saveTournament(tournament);
                  }
               }
            }
         }
         function selectMatch(ev) {
            let { match, target } = identifyMatch(ev);
            console.log('selected:', match);

            if (state.edit && match) {
               let e = findEventByID(match.event.euid);

               let existing_scores = match.score ? 
                  scoreBoard.convertStringScore({
                     string_score: match.score,
                     score_format: match.score_format || {},
                     winner_index: match.source.winner_index
                  }) : undefined;

               let scoreSubmitted = (outcome) => {
                  if (!outcome) return;

                  // this must happen first as 'e' is modified
                  if (e.draw_type == 'R') {
                     scoreRoundRobin(e, existing_scores, outcome);
                  } else {
                     scoreTreeDraw(e, existing_scores, outcome);
                  }

                  match.winner = outcome.winner;
                  match.score = outcome.score;
                  if (outcome.score) match.status = '';
                  match.score_format = outcome.score_format;

                  let sb = gen.scheduleBox({ match, editable: true});
                  target.innerHTML = sb.innerHTML;
                  target.style.background = sb.background;
                  target.setAttribute('draggable', 'false');

                  // now update pending matches to show new matches resulting from completion
                  ({ completed_matches, pending_matches } = tournamentEventMatches({ tournament, source: true }));
                  displayPending();

                  // and update all_matches and muid_key to keep other things working
                  all_matches = [].concat(...pending_matches, completed_matches);
                  muid_key = Object.assign({}, ...all_matches.map(m=>({ [m.muid]: m })));
                  filterSearchList();
               }

               if (match && match.teams) {
                  let round = match.round_name || '';
                  let score_format = match.score_format || e.score_format || {};
                  if (!score_format.final_set_supertiebreak) score_format.final_set_supertiebreak = e.format == 'D' ? true : false;
                  scoreBoard.setMatchScore({
                     round,
                     container,
                     score_format,
                     existing_scores,
                     teams: match.teams,
                     callback: scoreSubmitted
                  });
               }
            }
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

         gen.locationList(container, locations, highlight_listitem);

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
         console.log('create new location');
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

         locationBackground(l);
         configureLocationAttributes(l);

         actions.style('display', 'flex');

         if (state.edit) {
            if (index != undefined) {

               actions.select('.save').style('display', 'none');
               actions.select('.cancel').style('display', 'none');
               actions.select('.del')
                  .style('display', 'inline')
                  .on('click', () => { 
                     closeLocationDetails();
                     tournament.locations.splice(index, 1);
                     locationList();
                     db.addTournament(tournament);

                     let { pending_matches } = tournamentEventMatches({ tournament, source: true });
                     pending_matches.forEach(match => {
                        if (match.schedule && match.schedule.luid == l.luid) {
                           match.schedule = {};
                           match.source.schedule = {};
                        }
                     });

                  });
               actions.select('.done')
                  .style('display', 'inline')
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

         // TODO: update scheduling tab?
      }

      function playerSort(players) {
         return players.sort((a, b) => {
            if (!a.full_name) a.full_name = `${a.last_name.toUpperCase()}, ${util.normalizeName(a.first_name)}`;
            if (!b.full_name) b.full_name = `${b.last_name.toUpperCase()}, ${util.normalizeName(b.first_name)}`;
            let a1 = util.replaceDiacritics(a.full_name);
            let b1 = util.replaceDiacritics(b.full_name);
            return a1 < b1 ? -1 : a1 > b1 ? 1 : 0
         });
      }

      function teamSort(teams) {
         return teams.sort((a, b) => {
            if (!a[0].full_name) a.full_name = `${a[0].last_name.toUpperCase()}, ${util.normalizeName(a[0].first_name)}`;
            if (!b[0].full_name) b.full_name = `${b[0].last_name.toUpperCase()}, ${util.normalizeName(b[0].first_name)}`;
            let a1 = util.replaceDiacritics(a[0].full_name);
            let b1 = util.replaceDiacritics(b[0].full_name);
            return a1 < b1 ? -1 : a1 > b1 ? 1 : 0
         });
      }

      function playersTab() {
         if (!tournament.categories) tournament.categories = [tournament.category];

         // create an array of ids of all players who are selected for any event
         let players_approved = () => !tournament.events ? [] : [].concat(...tournament.events.map(e => {
            if (!e.approved) return [];
            return e.teams ? [].concat(...e.teams) : [].concat(...e.approved);
         }));

         // TODO: ability to sort by either name or rank


         // HTS Tournaments only have one category...
         // TODO: in the future this list should be sorted by tournament.categories...
         let category = isNaN(tournament.category) ? '20' : tournament.category;
         let options = [
            {key: 'U10', value: '10'},
            {key: 'U12', value: '12'},
            {key: 'U14', value: '14'},
            {key: 'U16', value: '16'},
            {key: 'U18', value: '18'},
            {key: 'S',   value: '20'},
         ].filter(c=>c.value == category);

         let prior_value = container.category_filter.ddlb ? container.category_filter.ddlb.getValue() : undefined;
         if (options.map(o=>o.value).indexOf(prior_value) < 0) prior_value = undefined;
         
         dd.attachDropDown({ 
            id: container.category_filter.id, 
            options,
            label: `${lang.tr('cat')}:`, 
         });
         container.category_filter.ddlb = new dd.DropDown({ element: container.category_filter.element, id: container.category_filter.id });
         container.category_filter.ddlb.selectionBackground();

         // TODO: temporary; HTS only has one category per tournament...
         // in the future there will need to be a variable to keep track of
         if (tournament.categories && tournament.categories.length) prior_value = tournament.categories[0];
         if (isNaN(prior_value)) prior_value == 20;
         container.category_filter.ddlb.setValue(prior_value || tournament.category);
         container.category_filter.ddlb.lock();

         // playersTab has a category DDLB... and this should be used for ordering players...
         let t_players = orderPlayersByRank(tournament.players, prior_value || tournament.categories[0]);
         // TODO: players should also be filtered by which players are eligible to play in the selected category

         if (!t_players.length && !state.edit) {
            d3.select('#YT' + container.container.id).style('display', 'none');
            return;
         }
         let display_order = gen.displayTournamentPlayers({ container, players: t_players, filters, edit: state.edit });

         // now add event to all players to display player profile
         let signInState = (evt) => {
            // if modifying rankings, disable!
            if (state.manual_ranking) return;

            let element = util.getParent(evt.target, 'player_click');
            let puid = element.getAttribute('puid');
            // let clicked_player = tournament.players.filter(p=>p.puid == puid);
            let clicked_player = tournament.players.reduce((p, c) => { if (c.puid == puid) p = c; return p; }, undefined);

            let withdrawn = clicked_player.withdrawn == 'Y' || clicked_player.withdrawn == true;
            let medical = player.medical(clicked_player);
            let registration = player.registration(clicked_player);

            // rapid mode allows sign-in with single click
            if (state.edit && o.sign_in.rapid && !withdrawn && registration) {
               if (clicked_player) {
                  if (clicked_player.signed_in) {
                     // disallow sign-out of a player who is approved for any event
                     if (players_approved().indexOf(clicked_player.id) >= 0) {
                        let message = `<div>${lang.tr('phrases.cannotsignout')}<p>${lang.tr('phrases.approvedplayer')}</div>`;
                        gen.popUpMessage(message);
                        return;
                     }

                     // must confirm sign-out
                     player.displayPlayerProfile(puid).then(()=>{}, ()=>displayIrregular(clicked_player));
                     return;
                  } else {
                     if (medical) {
                        clicked_player.signed_in = true;
                        saveTournament(tournament);
                     } else {
                        player.displayPlayerProfile(puid).then(() => {}, (result) => displayIrregular(clicked_player));
                     }
                  }
               }
               finish();
            } else {
               player.displayPlayerProfile(puid).then(() => {}, (result) => displayIrregular(clicked_player));
            }

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
               let e = findEventByID(displayed_event);
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
            let numeric = value && !isNaN(value) ? parseInt(value.toString().slice(-3)) : undefined;
            evt.target.value = numeric || '';

               let element = util.getParent(evt.target, 'player_click');
               let puid = element.getAttribute('puid');
               let changed_player = playerByPUID(puid);

               if (changed_player) {
                  let changeable = true;
                  if (players_approved().indexOf(changed_player.id) >= 0) {
                     let message = `<div>${lang.tr('phrases.cannotchangerank')}<p>${lang.tr('phrases.approvedplayer')}</div>`;
                     gen.popUpMessage(message);
                     changeable = false;
                  }
                  // TODO: in the future will need to modify rank for categories if there are multiple categories in one tournament
                  if (attribute == 'rank') { 
                     if (changeable) {
                        changed_player.modified_ranking = isNaN(value) || value == 0 ? undefined : +value; 
                        changed_player.category_ranking = isNaN(value) || value == 0 ? undefined : +value; 
                        checkDuplicateRankings(display_order);
                     } else {
                        evt.target.value = changed_player.modified_ranking || changed_player.category_ranking;
                     }
                  } else {
                     if (changeable) {
                        changed_player.subrank = isNaN(value) ? undefined : +value;
                     } else {
                        evt.target.value = changed_player.subrank || '';
                     }
                  }
               }

            if (evt.which == 13 || evt.which == 9) {
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
         let subRankKey = (evt) => entryKey(evt, '.subrank', 'subrank');

         util.addEventToClass('manualrank', catchTab, container.players.element, 'keydown');
         util.addEventToClass('subrank', catchTab, container.players.element, 'keydown');

         util.addEventToClass('player_click', signInState, container.players.element);
         util.addEventToClass('ranksub', stopPropagation, container.players.element);
         util.addEventToClass('rankentry', stopPropagation, container.players.element);
         util.addEventToClass('manualrank', rankEntryKey, container.players.element, 'keyup');
         util.addEventToClass('subrank', subRankKey, container.players.element, 'keyup');
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
         let displayed_players = displayedPlayers();

         if (!state.edit || !tournament.players) return;

         let signed_in = displayed_players.filter(p=>p.signed_in);

         let m = signed_in.filter(f=>f.sex == 'M');
         let w = signed_in.filter(f=>f.sex == 'W');

         let duplicate_puids = rankDuplicates(m);
         rankDuplicates(w, duplicate_puids);
      }

      function rankDuplicates(players, active_puids=[]) {

         // TODO: this should be EVENT category
         let category = isNaN(tournament.category) ? '20' : tournament.category;

         let non_mr_players = players.filter(p=>!mrPlayer(p, category));
         let all_rankings = non_mr_players.map(p=>p.category_ranking);
         let count = util.arrayCount(all_rankings);
         let duplicates = Object.keys(count).reduce((p, k) => { if (!isNaN(k) && count[k] > 1) p.push(+k); return p; }, []);

         let duplicate_ids = [];
         if (duplicates) {
            duplicate_puids = non_mr_players.filter(p=>duplicates.indexOf(p.category_ranking) >= 0).map(p=>p.puid);
            let puids = [].concat(...active_puids, ...duplicate_puids);
            enableSubRankEntry(true, puids);
         }
         return duplicate_puids;

         function mrPlayer(player, category) { return player.MR && player.MR[category]; }
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

      function tournamentPoints(tournament, matches) {
         console.log('tournament points:', matches);
         let points_date = new Date(tournament.points_date || tournament.end);

         tabVisible(container, 'PT', matches && matches.length);
         if (!matches || !matches.length) return;
         // remove any calculated points or rankings
         matches.forEach(match => match.players.forEach(p => p=player.cleanPlayer(p)));

         // TODO: the profile can be specified in the tournament configuration
         let profile = env.profile || tournamentParser.profiles[env.org];
         let points_table = point_tables[profile.points];

         let match_data = { matches, points_table, points_date };
         let points = rank.calcMatchesPoints(match_data);

         saveMatchesAndPoints({ tournament, matches, points });

         let filterPointsByGender = (obj) => {
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

         displayTournamentPoints(container, filtered_points);
      }

      function drawCreated(e) {
         // when a draw is created, matches should be accesible
         e.draw_created = true;
         enableDrawActions();
         tabVisible(container, 'MT');
           
         let show_schedule = tournamentCourts() && tournament.events && tournament.events.length ? true : false;
         tabVisible(container, 'ST', show_schedule)

         // add round_name to matches
         eventMatches(e);
         saveTournament(tournament);
      }

      function tournamentCourts() {
         if (!tournament.locations || !tournament.locations.length) return 0;
         return tournament.locations.map(l=>l.courts).reduce((p, c) => +p + +c, 0);
      }

      function matchesTab() {
         let t_matches = tMatches();
         tabVisible(container, 'MT', t_matches);
         tabVisible(container, 'PT', t_matches);

         let show_schedule = tournamentCourts() && !group_draws.length && tournament.events && tournament.events.length ? true : false;
         tabVisible(container, 'ST', show_schedule);
         if (!t_matches) return;

         // TODO: why is this here? Points are calculated after this...
         pointsTab(tournament, container, filters);

         let { completed_matches, pending_matches } = tournamentEventMatches({ tournament });
         if (!completed_matches.length && tournament.matches && tournament.matches.length) {
            // if matches array part of tournament object, matches have been imported
            tournament.matches.forEach(match => match.outcome = player.matchOutcome(match));
            gen.displayTournamentMatches({ container, completed_matches: tournament.matches, filters });
         } else {
            gen.displayTournamentMatches({ container, pending_matches, completed_matches, filters });
            tournamentPoints(tournament, completed_matches);
         }

         // attach function to display player profile when clicked
         util.addEventToClass('player_click', player.playerClicked, container.matches.element);

         function enterMatchScore(e, match) {
            let existing_scores = match && match.match && match.match.score ? 
               scoreBoard.convertStringScore({
                  string_score: match.match.score,
                  score_format: match.match.score_format || {},
                  winner_index: match.match.winner_index
               }) : undefined;

            let scoreSubmitted = (outcome) => {
               // this must happen first as 'e' is modified
               if (e.draw_type == 'R') {
                  scoreRoundRobin(e, existing_scores, outcome);
               } else {
                  scoreTreeDraw(e, existing_scores, outcome);
               }
               matchesTab();
            }

            if (match && match.teams) {
               let round = match.round_name || '';

               let score_format = match.score_format || e.score_format || {};
               if (!score_format.final_set_supertiebreak) score_format.final_set_supertiebreak = e.format == 'D' ? true : false;

               scoreBoard.setMatchScore({
                  round,
                  container,
                  score_format,
                  existing_scores,
                  teams: match.teams,
                  callback: scoreSubmitted
               });
            }
         }

         function matchClicked(evt) {
            let muid = evt.target.getAttribute('muid');
            let euid = evt.target.getAttribute('euid');
            if (!muid || !euid) return;
            let e = findEventByID(euid);
            let match = eventMatches(e).reduce((p, c) => p = (c.match.muid == muid) ? c : p, undefined);
            if (state.edit && match.match.winner == undefined) {
               if (match.match.schedule && match.match.schedule.court) {
                  enterMatchScore(e, match);
               } else {
                  // gen.popUpMessage('schedule match');
               }
            }
         }
         util.addEventToClass('cell_singles', matchClicked, container.matches.element);
         util.addEventToClass('cell_doubles', matchClicked, container.matches.element);

         function matchContext(evt) {
            let muid = evt.target.getAttribute('muid');
            let euid = evt.target.getAttribute('euid');
            if (!muid || !euid) return;
            let e = findEventByID(euid);
            let match = eventMatches(e).reduce((p, c) => p = (c.match.muid == muid) ? c : p, undefined);
            if (state.edit && match.match.winner == undefined) {
               gen.popUpMessage('context menu');
            }
         }
         util.addEventToClass('cell_singles', matchContext, container.matches.element, 'contextmenu');
         util.addEventToClass('cell_doubles', matchContext, container.matches.element, 'contextmenu');

      }

      // Returns NEW objects; modifications don't change originals
      // if 'source' is true, then source object is included...
      fx.tem = tournamentEventMatches;
      function tournamentEventMatches({ tournament, source }) {
         if (!tournament.events) return { completed_matches: [], pending_matches: [], total_matches: 0 };

         let completed_matches = [];
         let pending_matches = [];
         tournament.events.forEach(e => {
            let { complete, incomplete } = eventMatchStorageObjects(tournament, e, source);

            completed_matches = [].concat(...completed_matches, ...complete);
            pending_matches = [].concat(...pending_matches, ...incomplete);
         });

         let total_matches = completed_matches.length + pending_matches.length;

         return { completed_matches, pending_matches, total_matches }
      }

      function eventMatchStorageObjects(tournament, evt, source) {
         if (!evt.draw) return { complete: [], incomplete: []};

         let matches = eventMatches(evt);

         // for Round Robin Draw to be considered qualification it needs to be linked to an Elimination Draw
         let draw_format = evt.draw.brackets ? 'round_robin' : 'tree';
         if (draw_format == 'round_robin' && (!evt.links || !evt.links['E'])) {
            matches.forEach(match => match.round_name = match.round_name.replace('Q', ''));
         }

         let complete = matches
            .filter(f => f.match.winner && f.match.loser)
            .map(m => matchStorageObject(tournament, evt, m, source))
            .filter(f=>f);

         complete.forEach(match => match.outcome = player.matchOutcome(match));

         let incomplete = matches.filter(f => !f.match.winner && !f.match.loser)
            .map(m=>matchStorageObject(tournament, evt, m, source));

         return { complete, incomplete }
      }

      function eventBroadcastObject(tourny, evt, draw) {
         let ebo = { 
            tournament: {
               tuid: tourny.tuid,
               name: tourny.name,
               start: tourny.start,
               end: tourny.end,
            },
            event: {
               euid: evt.euid,
               name: evt.name,
               rank: evt.rank,
               gender: evt.gender,
               format: evt.format,
               surface: evt.surface,
               category: evt.category,
               draw_size: evt.draw_size,
               draw_type: evt.draw_type,
            },
         }

         if (draw) {
            ebo.draw = {
               dp: evt.draw.dp,
               team: evt.draw.team,
               match: evt.draw.match,
               children: evt.draw.children,
               max_round: evt.draw.max_round,
               round_name: evt.draw.round_name,
               brackets: evt.draw.brackets,
               bracket_size: evt.draw.bracket_size,
            }
         }

         return ebo;
      }

      function deleteEvent(tourny, evt) {
         let matches = !evt.draw ? [] : drawFx.matches(evt.draw).map(m=>({ muid: m.match.muid, tuid: tourny.tuid }));; 
         let ebo = eventBroadcastObject
         coms.deleteEvent({ euid: evt.euid, tuid: tourny.tuid, matches });
      }

      function broadcastEvent(tourny, evt) {

         let ebo = { 
            tournament: {
               tuid: tourny.tuid,
               name: tourny.name,
               start: tourny.start,
               end: tourny.end,
            },
            event: {
               euid: evt.euid,
               name: evt.name,
               rank: evt.rank,
               gender: evt.gender,
               format: evt.format,
               surface: evt.surface,
               category: evt.category,
               draw_size: evt.draw_size,
               draw_type: evt.draw_type,
            },
            draw: {
               dp: evt.draw.dp,
               team: evt.draw.team,
               match: evt.draw.match,
               children: evt.draw.children,
               max_round: evt.draw.max_round,
               round_name: evt.draw.round_name,
               brackets: evt.draw.brackets,
               bracket_size: evt.draw.bracket_size,
            }
         };

         coms.broadcastEvent(ebo);

         // TODO: why is up_to_date based on complete?
         let { complete, incomplete } = eventMatchStorageObjects(tourny, evt);
         evt.up_to_date = complete.length ? true : undefined;

         evt.published = true;

         saveTournament(tournament);
      }

      function matchStorageObject(tournament, e, match, source) {
         if (!match.match) return;

         let players;
         let team_players;


         if (match.match.winner && match.match.winner[0]) {
            players = [].concat(...match.match.winner, ...match.match.loser);
            team_players = [
               match.match.winner.map((p, i) => i),
               match.match.loser.map((p, i) => match.match.winner.length + i),
            ];
         } else {
            // TODO: lots of confusion with .winner being binary or player/team 
            //       and .winner_index
            //       and .teams not being in order...
            players = [].concat(...match.teams);
            team_players = match.teams.map((t, i) => t.map((m, j) => (i*t.length) + j));
         }

         let obj = {
            consolation: e.draw_type == 'C', 
            draw_positions: e.draw_size,
            date: match.match.date,
            schedule: match.match.schedule,
            format: e.format == 'S' ? 'singles' : 'doubles',
            gender: e.gender,
            muid: match.match.muid,
            players,
            puids: players.map(p=>p.puid),

            // TODO: should be => teams: team_players,
            // see dynamicDraws => function recreateDrawFromMatches => round_matches.forEach
            teams: match.teams,
            team_players,

            // TODO: clear up confusion here...
            round: match.round_name,
            round_name: match.round_name,

            score: match.match.score,
            status: match.match.status,
            tournament: {
               sid: tournament.sid,
               tuid: tournament.tuid,
               category: tournament.category,
               name: tournament.name,
               start: tournament.start,
               end: tournament.end,
               rank: tournament.rank,
            },
            'event': {
               name: e.name,
               category: e.category,
               draw_type: e.draw_type,
               rank: e.rank,
               surface: e.surface,
               euid: e.euid,
            },
            umpire: match.match.umpire,
            winner: match.match.winner ? 0 : undefined,
         }
         if (source) obj.source = match.match;
         return obj;
      }

      function pointsTab(tournament, container, filters=[]) {
         if (tournament.matches) {
            db.findTournamentPoints(tournament.tuid).then(points => {
               if (points.length) {
                  if (filters.indexOf('M') >= 0) points = points.filter(p => p.gender != 'M');
                  if (filters.indexOf('W') >= 0) points = points.filter(p => p.gender != 'W');
                  let player_points = { singles: {}, doubles: {} };
                  points.forEach(point => {
                     let format = point.format;
                     let existing = player_points[format][point.name];
                     if (existing && existing.points > point.points) return;
                     player_points[format][point.name] = point;
                  });
                  displayTournamentPoints(container, player_points);
               }
            });
         }
      }

      function displayDraw({ evt }) { 

         if (!evt.draw) return;
         displayed_draw_event = evt;
         gen.drawRepState(container.player_reps_state.element, displayed_draw_event);

         if (evt.draw.children && evt.draw.children.length) { 
            tree_draw.data(evt.draw);
            if (tree_draw.info().doubles) tree_draw.options({ names: { seed_number: false }});

            // TODO: this is temporary while exploring other options
            let seeding = evt.draw.opponents ? rankedTeams(evt.draw.opponents) : true;

            tree_draw.options({ names: { seed_number: seeding }, details: { seeding }});

            tree_draw(); 
         } else if (evt.draw.brackets && evt.draw.brackets.length) {
            rr_draw
               .data(evt.draw)
               .selector(container.draws.element)
               .bracketSize(evt.draw.bracket_size || o.draws.brackets.min_bracket_size);

            rr_draw();
         }
      };
     
      function enableDrawActions() {
         let visible = displayed_draw_event ? displayed_draw_event.draw_created : false;
         let active = displayed_draw_event ? displayed_draw_event.active : false;
         let svg = container.draws.element.querySelector('svg');
         // document.querySelector('.' + classes.print_draw).style.display = visible && svg ? 'inline' : 'none';
        
         let pdf_function = visible || state.edit;
         document.querySelector('.' + classes.print_draw).style.display = pdf_function && svg ? 'inline' : 'none';

         container.publish_draw.element.style.display = visible && svg && state.edit ? 'inline' : 'none';
         container.player_reps.element.style.display = svg && state.edit ? 'inline' : 'none';
         container.recycle.element.style.display = !active && svg && state.edit ? 'inline' : 'none';
      }

      function enableDrawOrderPrinting() {
         let e = findEventByID(displayed_event);
         let visible = state.edit && e && !e.automated && !e.active && e.approved && e.approved.length;
//         document.querySelector('.' + classes.print_draw_order).style.display = visible ? 'inline' : 'none';
      }

      function testLastSeedPosition(e) {
         // after all seeded positions have been placed, distribute byes
         if (!e && !tree_draw.nextSeedGroup()) {
            // context is working with a data structure
            if (o.override.auto_byes) tree_draw.distributeByes();
            if (o.override.auto_qualifiers) tree_draw.distributeQualifiers();
         } else if (e && !drawFx.nextSeedGroup({ draw: e.draw })) {
            // context is interacting directly with draw
            if (o.override.auto_byes) drawFx.distributeByes({ draw: e.draw });
            if (o.override.auto_qualifiers) drawFx.distributeQualifiers({ draw: e.draw });
         }
      }

      function determineRRqualifiers(e) {
         if (!e.links || !e.links['E']) return;

         e.qualified = [];
         let opponents = e.draw.opponents;
         let info = drawFx.drawInfo(e.draw);

         let elimination_event = findEventByID(e.links['E']);

         // 1st qualifiers from each bracket
         let qualified_teams = opponents.filter(o=> {
            if (o[0].order == 1 && o[0].sub_order == undefined) return true;
            if (o[0].order == 1 && o[0].sub_order == 1) return true;
         });
         // 2nd qualifiers from each bracket
         let qualified_2nd = opponents
            .filter(o=>o[0].order == 2 || (o[0].order == 1 && o[0].sub_order == 2))
            .sort((a, b) => b.category_ranking - a.category_ranking);

         console.log('rr qualifiers:', qualified_teams, qualified_2nd);

         let all_brackets_complete = e.draw.brackets.map(drawFx.bracketComplete).reduce((a, b) => a && b);

         if (all_brackets_complete) {
            while (qualified_teams.length < e.qualifiers && qualified_2nd.length) qualified_teams.push(qualified_2nd.pop());
         }

         qualified_teams.forEach(team => qualifyTeam(e, team));
      }

      function scoreRoundRobin(e, existing_scores, outcome) {
         if (!outcome) return;

         let puids = outcome.teams.map(t=>t[0].puid);
         let findMatch = (e, n) => (util.intersection(n.match.puids, puids).length == 2) ? n : e;
         let match_event = eventMatches(e).reduce(findMatch, undefined);

         if (match_event) {
            let match = match_event.match;
            match.score = outcome.score;
            if (outcome.score) match.status = '';
            match.winner_index = outcome.winner;
            match.score_format = outcome.score_format;

            match.muid = match.muid || UUID.new();
            match.winner = [match.players[outcome.winner]];
            match.loser = [match.players[1 - outcome.winner]];
            match.date = match.date || new Date().getTime();

            match.teams = outcome.teams;

            match.tournament = { name: tournament.name, tuid: tournament.tuid, category: tournament.category, round: match.round_name || match.round };

            // for now, not broadcasting when score is entered
            if (env.livescore && coms.broadcasting()) {
               e.up_to_date = true;
               coms.broadcastScore(match);
            } else {
               e.up_to_date = false;
            }

            gen.drawBroadcastState(container.publish_state.element, displayed_draw_event);

         } else {
            console.log('something went wrong', outcome);
         }

         if (existing_scores) {
            if (outcome.complete) {
               console.log('check whether bracket previously finished with different qualifying order');
            } else {
               console.log('check whether bracket finished and placed winner in main draw');
            }
         }

         let bracket = e.draw.brackets[match_event.match.bracket];
         drawFx.tallyBracketResults({ bracket });

         if (outcome.complete && drawFx.bracketComplete(bracket)) determineRRqualifiers(e);

         e.active = true;
         enableDrawActions();
         saveTournament(tournament);
         return;
      }

      function scoreTreeDraw(e, existing_scores, outcome) {
         if (!outcome) return e;
         // let node = null;

         if (existing_scores) {
            // if updating existing scores, don't advance position
            let node = drawFx.findMatchNodeByTeamPositions(e.draw, outcome.positions);
            let result = drawFx.advanceToNode({
               node,
               score: outcome.score,
               complete: outcome.complete,
               position: outcome.position,
               score_format: outcome.score_format,
            });

            if (!outcome.complete && result && !result.advanced) {
               gen.popUpMessage(lang.tr('phrases.matchmustbecomplete'));
               return; 
            }

            if (outcome.complete && result && !result.advanced) { 
               gen.popUpMessage(lang.tr('phrases.cannotchangewinner'));
               return; 
            }
         } else {
            drawFx.advancePosition({ node: e.draw, position: outcome.position });
         }

         // modifyPositionScore removes winner/loser if match incomplete
         drawFx.modifyPositionScore({ 
            node: e.draw, 
            positions: outcome.positions,
            score: outcome.score, 
            score_format: outcome.score_format,
            complete: outcome.complete, 
            set_scores: outcome.set_scores
         });

         if (e.draw_type == 'Q' && outcome) {
            let info = drawFx.drawInfo(e.draw);
            let finalist_dp = info.final_round.map(m=>m.data.dp);
            let qualifier_index = finalist_dp.indexOf(outcome.position);
            if (outcome.complete && qualifier_index >= 0) {
               if (existing_scores) {
                  console.log('HAS THE WINNER CHANGED?')
                  // TODO: determine whether winner of match has changed
                  // 1. remove previous winner from linked.qualified
                  // 2. remove previous winner from draw (if applicable)
                  // 3. qualify new winner
               } else {
                  qualifyTeam(e, outcome.teams[outcome.winner], qualifier_index + 1);
               }
            }
         }

         if (outcome.complete) {
            let puids = outcome.teams.map(t=>t.map(p=>p.puid).join('|'));
            let findMatch = (e, n) => {
               let tpuids = n.teams.map(t=>t.map(p=>p.puid).join('|'));
               let pint = util.intersection(tpuids, puids);
               return pint.length == 2 ? n : e; 
            }
            let match_event = eventMatches(e).reduce(findMatch, undefined);
            if (match_event) {
               let match = match_event.match;

               match.score = outcome.score;
               if (outcome.score) match.status = '';
               match.winner_index = outcome.winner;

               match.muid = match.muid || UUID.new();
               match.winner = outcome.teams[outcome.winner];
               match.loser = outcome.teams[1 - outcome.winner];
               match.date = match.date || new Date().getTime();

               match.players = [].concat(...outcome.teams);
               match.teams = outcome.teams;

               match.tournament = { name: tournament.name, tuid: tournament.tuid, category: tournament.category, round: match.round_name || match.round };

               // for now, not broadcasting when score is entered
               if (env.livescore && coms.broadcasting()) {
                  e.up_to_date = true;
                  coms.broadcastScore(match);
               } else {
                  e.up_to_date = false;
               }

               gen.drawBroadcastState(container.publish_state.element, displayed_draw_event);

            }
         }

         e.active = true;
         enableDrawActions();
         saveTournament(tournament);
         return e;
      }

      function qualifyTeam(e, team, qualifying_position) {
         if (!e.links || !e.links['E']) return;
         if (!e.qualified) e.qualified = [];

         let team_copy = team.map(player => Object.assign({}, player));

         team_copy[0].entry = 'Q';
         team_copy.forEach(player => delete player.seed);

         let qual_hash = e.qualified.map(teamHash);
         if (qual_hash.indexOf(teamHash(team_copy)) >= 0) return;

         e.qualified.push(team_copy);

         let elimination_event = findEventByID(e.links['E']);
         if (!elimination_event) return;

         elimination_event.approved.push(teamHash(team_copy));

         setDrawSize(elimination_event);
         let info = elimination_event.draw ? drawFx.drawInfo(elimination_event.draw) : undefined;

         if (elimination_event.draw) {
            let approved_opponents = approvedOpponents(elimination_event);
            elimination_event.draw.opponents = approved_opponents;
            elimination_event.draw.unseeded_teams = teamSort(approved_opponents.filter(f=>!f[0].seed));
         }

         let position = null;

         // remove qualifier position from main draw
         if (info && info.qualifiers && info.qualifiers.length) {
            // TODO: use randomPop() function?
            let qp = info.qualifiers.pop();
            position = qp.data.dp;

            delete qp.data.bye;
            delete qp.data.qualifier;
            delete qp.data.team;
         }

         // if the draw is active or if there are no unassigned team
         // then place the team in a qualifier position
         if (elimination_event.draw && (elimination_event.active || !info.unassigned.length)) {
            drawFx.assignPosition({ node: elimination_event.draw, position, team: team_copy });
            elimination_event.draw.unseeded_placements.push({ id: team_copy[0].id, position });
         }
      }

      function rrPlayerOrder(d) {
         let bracket = displayed_draw_event.draw.brackets[d.bracket];
         let player = bracket.players.reduce((p, c) => c.draw_position == d.row ? c : p, undefined);
         let tied = bracket.players.filter(p=>p.order == player.order);
         if (tied.length > 1) {
            let draw_id = `rrDraw_${d.bracket}`;
            let selector = d3.select(`#${container.draws.id} #${draw_id} svg`).node();
            let menu = contextMenu().selector(selector).events({ 'cleanup': () => {} });
            let coords = d3.mouse(selector);
            let options = tied.map((p, i) => `Order: ${i+1}`);

            menu
               .items(...options)
               .events({ 
                  'item': { 
                     'click': (c, i) => {
                        // first insure that no other player has the same sub_order
                        bracket.players.filter(p=>p.order == player.order).forEach(p=>{ if (p.sub_order == i + 1) p.sub_order = 0 });

                        // assign sub_order to selected player
                        player.sub_order = i + 1;

                        // update data
                        rr_draw.data(displayed_draw_event.draw);
                        // update one bracket without regenerating all brackets!
                        rr_draw.updateBracket(d.bracket);

                        saveTournament(tournament);
                     }
                  }
               });

            setTimeout(function() { menu(coords[0], coords[1]); }, 200);
         }
      }

      // for generating draws when there are events which have been created by CourtHive Tournaments
      function genEventDraw(value) {
         let draw_width = +d3.select('#main').style('width').match(/\d+/)[0] * .9;
         let e = tournament.events[value];

         tree_draw.options({ width: draw_width });
         tree_draw.events({
            'position': { 
               'contextmenu': contextPopUp,
               'click': positionClick,
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
            }
         });

         rr_draw.data({})();

         if (!e.draw || e.changed) {
            generateDraw(e);
            e.changed = false;
         }

         if (!e.approved || e.approved.length < 2 || (e.draw_type == 'R' && e.approved.length < 3)) {
            e.draw_created = false;
            delete e.draw;
         } else {
            displayDraw({ evt: e });
         }
         enableDrawActions();
         gen.drawBroadcastState(container.publish_state.element, e);

         eventList();
         return;

         // SUPPORTING FUNCTIONS...

         function assignPosition(position, team, bye, qualifier) {
            let linked = findEventByID(e.links['Q']) || findEventByID(e.links['R']);
            if (linked && linked.qualified && team) {
               let qualifier_ids = linked.qualified.map(teamHash);
               if (qualifier_ids.indexOf(team[0].id) >= 0) { team[0].entry = 'Q'; }
            }
            // tree_draw.assignPosition(position, team, bye, qualifier);
            drawFx.assignPosition({ node: displayed_draw_event.draw, position, team, bye, qualifier });
         }

         function optionNames(teams) {
            let lastName = (player) => player.last_name.toUpperCase();
            return teams.map(team => {
               let seed = team[0].seed ? ` [${team[0].seed}]` : '';
               let draw_order = seed ? '' : team[0].draw_order ? ` (${team[0].draw_order})` : '';
               if (team.length == 1) {
                  let first_name = util.normalizeName(team[0].first_name, false);
                  return `${lastName(team[0])}, ${first_name}${seed}${draw_order}`
               }
               return `${lastName(team[0])}/${lastName(team[1])}${seed}`
               
            });
         }

         function rrScoreEntry(d) {
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
               rr_draw.unHighlightCells();

               // this must happen first as 'e' is modified
               scoreRoundRobin(e, existing_scores, outcome);
               // update data
               rr_draw.data(e.draw);
               // update one bracket without regenerating all brackets!
               rr_draw.updateBracket(d.bracket);

               // TODO: perhaps it is only necessary to recalculate points...
               matchesTab();
            }

            if (d.match && d.match.players) {
               let teams = d.match.players.map(p=>[p]);

               let evnt = displayed_draw_event;
               let score_format = d.match.score_format || evnt.score_format || {};
               if (!score_format.final_set_supertiebreak) score_format.final_set_supertiebreak = e.format == 'D' ? true : false;

               scoreBoard.setMatchScore({
                  teams,
                  container,
                  round: 'RR',
                  score_format,
                  existing_scores,
                  callback: scoreSubmitted
               });
            }
         }

         function rrScoreAction(d) {

            let bracket = displayed_draw_event.draw.brackets[d.bracket];
            let complete = drawFx.bracketComplete(bracket);

            // must be a unique selector in case there are other SVGs
            let draw_id = `rrDraw_${d.bracket}`;
            let selector = d3.select(`#${container.draws.id} #${draw_id} svg`).node();
            let menu = contextMenu().selector(selector).events({ 'cleanup': () => {} });
            let coords = d3.mouse(selector);
            let options = [lang.tr('draws.remove'), lang.tr('actions.cancel')];

            if (!complete && d.match && d.match.score) removeScoreMenu();

            function removeScoreMenu() {
               menu
                  .items(...options)
                  .events({ 
                     'item': { 'click': (c, i) => {

                        if (i == 0) {
                           delete d.match.date;
                           delete d.match.winner;
                           delete d.match.winner_index;
                           delete d.match.loser;
                           delete d.match.score;
                           delete d.match.teams;
                           delete d.match.tournament;

                           // update one bracket without regenerating all brackets!
                           rr_draw.updateBracket(d.bracket);

                           saveTournament(tournament);
                        }

                     }}
                  });

               if (device.isWindows || d3.event.shiftKey) {
                  setTimeout(function() { menu(coords[0], coords[1]); }, 200);
               } else {
                  setTimeout(function() { menu(coords[0], coords[1]); }, 200);
               }
            }
         }

         function rrPositionClick(d) {
            if (!state.edit) return;

            if (d3.event.ctrlKey || d3.event.shiftKey) {
               rrContextPopUp(d);
               return;
            }

            if (d.player && d.player.puid) {
               player.displayPlayerProfile(d.player.puid).then(()=>{}, ()=>{});
            } else if (state.edit && d.mc == undefined) {
               let info = rr_draw.info();
               if (info.open_seed_positions && info.open_seed_positions.length) {
                  let valid_placements = info.open_seed_positions.map(osp => `${osp.bracket}|${osp.position}`);
                  let clicked_position = `${d.bracket}|${d.row}`;
                  if (valid_placements.indexOf(clicked_position) >= 0) placeRRDrawPlayer(d);
               } else {
                  placeRRDrawPlayer(d);
               }
            }
         }

         function positionClick(d) {
            d3.event.preventDefault();
            if (!state.edit) return;
            if (d3.event.ctrlKey || d3.event.shiftKey) {
               contextPopUp(d);
               return;
            }

            let node = d3.select(this);
            highlightCell(node);

            if (!d.height && !d.data.bye && !d.data.team) { return placeTreeDrawPlayer(d); }

            // don't go any further if the draw is incomplete...
            if (displayed_draw_event && drawFx.drawInfo(displayed_draw_event.draw).unassigned.length) return;

            let existing_scores;
            let team_match = drawFx.teamMatch(d);
            if (d.data.match && d.data.match.score) {
               existing_scores = scoreBoard.convertStringScore({
                  string_score: d.data.match.score,
                  score_format: d.data.match.score_format || {},
                  winner_index: d.data.match.winner_index
               });
            }

            let scoreSubmitted = (outcome) => {
               // this must happen first as 'e' is modified
               scoreTreeDraw(e, existing_scores, outcome);

               tree_draw.unHighlightCells();
               tree_draw.data(e.draw)();
               matchesTab();
            }

            let round = (d.data.match && d.data.match.round_name) || '';
            if (team_match) {

               let evnt = displayed_draw_event;
               let score_format = d.data.match.score_format || evnt.score_format || {};
               if (!score_format.final_set_supertiebreak) score_format.final_set_supertiebreak = e.format == 'D' ? true : false;

               scoreBoard.setMatchScore({
                  round,
                  container,
                  score_format,
                  existing_scores,
                  teams: team_match,
                  callback: scoreSubmitted
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
            let placements = seed_group.placements.map(p=>p.seed);
            let positioned = seed_group.placements.map(p=>p.position);
            let positions = seed_group.positions.filter(p=>positioned.indexOf(p)<0);
            let remaining = seed_group.range.filter(r=>placements.indexOf(r) < 0);
            let teams = optionNames(remaining.map(r=>e.draw.seeded_teams[r]));
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

            let { remaining, positions, teams } = getSeedTeams(seed_group);
            if (remaining.length == 1) {
               let index = seed_group.range.indexOf(remaining[0]);
               let team = draw.seeded_teams[seed_group.range[index]];
               assignSeedPosition(seed_group, team, positions[0]);
               testLastSeedPosition();
            }
         }

         function placeRRDrawPlayer(d) {
            let placement = { bracket: d.bracket, position: d.row };
            let pobj = gen.manualPlayerPosition({ container, bracket: d.bracket, position: d.row });
            let info = rr_draw.info();

            if (info.unfilled_positions.length) rrPlacePlayer(placement, pobj, info);
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
               let placements = e.draw.unseeded_placements ? e.draw.unseeded_placements.map(p=>p.id) : [];
               unplaced_teams = e.draw.unseeded_teams.filter(team => placements.indexOf(team[0].id) < 0);
            }

            unplaced_teams.forEach(team => team.order = team.order || e.approved.indexOf(team[0].id) + 1);

            let position_unfilled = u_hash.indexOf(hashFx(placement)) >= 0;

            if (!position_unfilled) return;

            function removeEntryField() {
               d3.select(pobj.entry_field.element).remove();
               rr_draw.unHighlightCells();
               document.body.style.overflow = null;
            }

            pobj.entry_field.element.addEventListener('click', removeEntryField);
            pobj.player_index.element.addEventListener('keyup', playerIndex , false);
            pobj.player_index.element.focus();

            let selection_flag = false;
            let list = unplaced_teams.map(team => { 
               let player = team[0];
               let label = `${util.normalizeName([player.first_name, player.last_name].join(' '))} [${team.order}]`;
               return { value: player.puid, label, }
            });
            pobj.typeAhead = new Awesomplete(pobj.player_search.element, { list });
            let selectPlayer = (uuid) => {
               if (!uuid) return;
               pobj.player_search.element.value = '';
               let team = unplaced_teams.filter(u=>u[0].puid == uuid)[0];

               removeEntryField();
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

            // disable scrolling on background
            document.body.style.overflow  = 'hidden';

            // SUPPORTING FUNCTIONS
            function playerIndex(evt) {
               if (evt.which == 13) {
                  let value = pobj.player_index.element.value.match(/-?\d+\.?\d*/);
                  let player_index = value ? +value[0] : undefined;
                  if (player_index) {
                     if (unplaced_teams.map(u=>u.order).indexOf(player_index) < 0) return invalidEntry();

                     let team = unplaced_teams.filter(u=>u.order == player_index)[0];
                     removeEntryField();
                     return placeRRplayer(team, placement, info);
                  }

                  function invalidEntry() { pobj.player_index.element.value = ''; }
               }

               let value = pobj.player_index.element.value.match(/-?\d+\.?\d*/);
               let numeric = value && !isNaN(value[0]) ? parseInt(value[0].toString().slice(-2)) : undefined;

               pobj.player_index.element.value = numeric || '';
            }
         }

         function placeTreeDrawPlayer(d) {
            let draw = e.draw;
            let position = d.data.dp;
            let info = tree_draw.info();

            let seed_group = drawFx.nextSeedGroup({ draw });
            let placements = draw.unseeded_placements.map(p=>p.id);
            let unplaced_teams = draw.unseeded_teams.filter(team => placements.indexOf(team[0].id) < 0);

            if (!seed_group && info.draw_positions.length > draw.opponents.length + info.byes.length + info.qualifiers.length) {
               let coords = d3.mouse(container.draws.element);
               return contextPopUp(d, coords);
            }

            if (seed_group) {
               // TODO: support doubles teams;
               let seed_group_ids = e.approved.filter((a, i) => seed_group.range.indexOf(i + 1) >= 0);
               unplaced_teams = tournament.players.filter(p=>seed_group_ids.indexOf(p.id) >= 0).map(p=>[p]);
            }

            if (e.format == 'S') {
               unplaced_teams.forEach(team => team.order = team.order || e.approved.indexOf(team[0].id) + 1);
            } else {
               // get an Object/array of teams in rank order
               let approved_teams = approvedTeams(e);
               let approved_hash = Object.keys(approved_teams).map(k=>teamHash(approved_teams[k].players));
               // use hash of ordered teams to add order to unplaced
               unplaced_teams.forEach(team => team.order = approved_hash.indexOf(teamHash(team)) + 1);
            }

            let pobj = gen.manualPlayerPosition({ container, position });
            let entry_field = d3.select(pobj.entry_field.element);
            let removeEntryField = () => {
               entry_field.remove();
               tree_draw.unHighlightCells();
               document.body.style.overflow = null;
            }

            entry_field.on('click', removeEntryField);

            pobj.player_index.element.addEventListener('keyup', playerIndex , false);
            pobj.player_index.element.focus();

            let selection_flag = false;
            let playerLabel = (player) => util.normalizeName([player.first_name, player.last_name].join(' '));
            let list = unplaced_teams.map(team => { 
               let label = playerLabel(team[0]);
               if (e.format == 'D') label += `/${playerLabel(team[1])}`;
               return { value: team[0].puid, label, }
            });
            pobj.typeAhead = new Awesomplete(pobj.player_search.element, { list });
            let selectPlayer = (uuid) => {
               if (!uuid) return;
               pobj.player_search.element.value = '';
               let team = unplaced_teams.filter(u=>u[0].puid == uuid)[0];
               let player_index = team.order;
               submitPlayer(player_index);
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

            // disable scrolling on background
            document.body.style.overflow  = 'hidden';

            // SUPPORTING FUNCTIONS
            function invalidEntry() { pobj.player_index.element.value = ''; }

            function submitPlayer(player_index) {
               if (seed_group) {
                  let placements = seed_group.placements.map(p=>p.seed);
                  let remaining_range = seed_group.range.filter(r=>placements.indexOf(r) < 0);
                  if (remaining_range.indexOf(player_index) < 0) return invalidEntry();
                  seedAssignment(draw, seed_group, position, player_index);
               } else {
                  if (unplaced_teams.map(u=>u.order).indexOf(player_index) < 0) return invalidEntry();
                  let team = unplaced_teams.filter(u=>u.order == player_index)[0];
                  assignPosition(position, team);
                  draw.unseeded_placements.push({ id: team[0].id, position });

                  // TODO: this block of code is duplicated
                  let info = tree_draw.info();
                  if (info.unassigned.length == 1) {
                     let unassigned_position = info.unassigned[0].data.dp;
                     let placements = draw.unseeded_placements.map(p=>p.id);
                     let unplaced_teams = draw.unseeded_teams.filter(team => placements.indexOf(team[0].id) < 0);
                     let team = unplaced_teams[0];
                     assignPosition(unassigned_position, team);
                     draw.unseeded_placements.push({ id: team[0].id, position: unassigned_position });
                     tree_draw.advanceTeamsWithByes();
                     if (e.draw_type == 'Q') checkForQualifiedTeams(e);
                     drawCreated(e);
                  }

               }
               tree_draw();
               e.draw = tree_draw.data();
               removeEntryField();
               saveTournament(tournament);
            }

            function playerIndex(evt) {
               if (evt.which == 13) {
                  let value = pobj.player_index.element.value.match(/-?\d+\.?\d*/);
                  let player_index = value ? +value[0] : undefined;
                  if (player_index) submitPlayer(player_index);
                  return;
               }

               let value = pobj.player_index.element.value.match(/-?\d+\.?\d*/);
               let numeric = value && !isNaN(value[0]) ? parseInt(value[0].toString().slice(-2)) : undefined;

               pobj.player_index.element.value = numeric || '';
            }
         }

         function rrMouseoverScore(d) {
            if (!state.edit) return;
            let info = drawFx.drawInfo(e.draw);
            if (info.unfilled_positions.length) return;
            rr_draw.highlightCell(d);
         }

         function rrMouseoverPlayer(d) {
            if (!state.edit) return;
            let info = rr_draw.info();
            if (info.open_seed_positions && info.open_seed_positions.length) {
               info.open_seed_positions.filter(o=>o.bracket == d.bracket && o.position == d.row).forEach(e=>rr_draw.highlightPlayer(e.bracket, e.position));
            } else if (info.unfilled_positions && info.unfilled_positions.length) {
               info.unfilled_positions.filter(o=>o.bracket == d.bracket && o.position == d.row).forEach(e=>rr_draw.highlightPlayer(e.bracket, e.position));
            }
         }

         function rrContextPopUp(d) {
            if (!state.edit) return;

            let draw = displayed_draw_event.draw;
            let info = drawFx.drawInfo(draw);
            if (!info.unfilled_positions.length) return;
            if (!draw.unseeded_placements) draw.unseeded_placements = [];

            let placement = { bracket: d.bracket, position: d.row };

            function hashFx(h) { return [h.bracket, h.position].join('|'); }
            let u_hash = info.unplaced_seeds.length ? info.open_seed_positions.map(hashFx) : info.unfilled_positions.map(hashFx);

            let placements = draw.unseeded_placements ? draw.unseeded_placements.map(p=>p.id) : [];
            let unplaced = info.unplaced_seeds.length ? info.unplaced_seeds : draw.unseeded_teams.filter(team => placements.indexOf(team[0].id) < 0);
            let unplaced_teams = teamSort(unplaced);

            // must be a unique selector in case there are other SVGs
            let draw_id = `rrDraw_${d.bracket}`;
            let selector = d3.select(`#${container.draws.id} #${draw_id} svg`).node();

            let menu = contextMenu().selector(selector).events({ 'cleanup': () => {} });
            let coords = d3.mouse(selector);

            let position_unfilled = u_hash.indexOf(hashFx(placement)) >= 0;

            if (position_unfilled) {
               placeTeam(menu, coords, unplaced_teams, placement, info);
            } else if (d.player && placement.position) {
               // placement.position restricts removal to cells with full name
               // because removing from row 0 causes errors...
               removeRRteam(menu, coords, placement, d, draw);
            }

            function placeTeam(menu, coords, unplaced_teams, placement, info) {
               let teams = optionNames(unplaced_teams);

               menu
                  .items(...teams)
                  .events({ 
                     'item': { 'click': (d, i) => {
                        let team = unplaced_teams[i];
                        placeRRplayer(team, placement, info);
                     }}
                  });

               if (device.isWindows || d3.event.shiftKey) {
                  setTimeout(function() { menu(coords[0], coords[1]); }, 200);
               } else {
                  setTimeout(function() { menu(coords[0], coords[1]); }, 200);
               }
            }

            function removeRRteam(menu, coords, placement, cell, draw) {

               assignedRRplayerOptions({ placement, cell, coords, draw });

               // options for positions which have already been assigned
               function assignedRRplayerOptions({ placement, cell, coords, draw }) {

                  let info = drawFx.drawInfo(draw);
                  let bracket = draw.brackets[placement.bracket];
                  let options = [lang.tr('draws.remove'), lang.tr('actions.cancel')];

                  // TODO: determine seeded or unseeded position?
                  let unseeded_position = draw.unseeded_placements.reduce((p, c) => c.id == cell.player.id ? true : p, undefined);

                  if (!unseeded_position) return;

                  menu
                     .items(...options)
                     .events({ 
                        'item': { 'click': (d, i) => {

                           if (i == 0) {

                              if (info.unfilled_positions.length) {

                                 if (unseeded_position) {

                                    bracket.players = bracket.players.filter(p=>p.puid != cell.player.puid);
                                    draw.unseeded_placements = draw.unseeded_placements
                                       .filter(f=> {
                                          let equal = f.position.bracket == placement.bracket && f.position.position == placement.position
                                          return !equal;
                                       });

                                    drawFx.matches(draw);
                                    rr_draw.data(draw);
                                    rr_draw.updateBracket(placement.bracket, true);
                                 } else {
                                    console.log('seeded position!');
                                 }


                              } else {
                                 // 1. if there are any byes and players advanced, undo
                                 console.log('complete draw');
                              }

                              saveTournament(tournament);
                           }
                        }}
                     });

                  if (device.isWindows || d3.event.shiftKey) {
                     setTimeout(function() { menu(coords[0], coords[1]); }, 200);
                  } else {
                     setTimeout(function() { menu(coords[0], coords[1]); }, 200);
                  }
               }

            }
         }

         function placeRRplayer(team, placement, info) {
            let player = team[0];
            player.draw_position = placement.position;
            e.draw.brackets[placement.bracket].players.push(player);

            if (info.unplaced_seeds.length) {
               info.unfinished_seed_placements[0].placements.push({ position: placement, seed: player.seed });
            } else {
               e.draw.unseeded_placements.push({ id: player.id, position: placement });
            }

            // update data
            rr_draw.data(e.draw);
            // update one bracket without regenerating all brackets!
            rr_draw.updateBracket(placement.bracket);

            // test to see if draw is complete
            if (e.draw.unseeded_placements.length && e.draw.unseeded_placements.length == e.draw.unseeded_teams.length) {
               drawCreated(e);
               drawFx.matches(e.draw);
               rr_draw.data(e.draw);
               rr_draw();
            }

            saveTournament(tournament);
         }

         // this function needs to be in scope of createTournamentContainer()
         // so that it can have access to container.draws.element
         function contextPopUp(d, coords) {
            coords = Array.isArray(coords) ? coords : d3.mouse(container.draws.element);

            if (!state.edit) {
               console.log('Not in editing state');
            } else if (!displayed_draw_event.active) {
               drawNotActiveContextClick(d, coords);
            } else {
               drawActiveContextClick(d, coords);
            }
         }

         function drawActiveContextClick(d, coords) {
            let draw = e.draw;
            let position = d.data.dp;

            if (d.data.match && d.data.match.score && (!d.parent || !d.parent.data || !d.parent.data.team)) {
               // must be a unique selector in case there are other SVGs
               let selector = d3.select('#' + container.draws.id + ' svg').node();
               let menu = contextMenu().selector(selector).events({ 'cleanup': tree_draw.unHighlightCells });

               let options = [`${lang.tr('draws.remove')}: ${lang.tr('mtc')}`];

               menu
                  .items(...options)
                  .events({ 
                     'item': { 
                        'click': (c, i) => {

                           delete d.data.match;
                           delete d.data.dp;
                           delete d.data.team;
                           delete d.data.round_name;

                           // TODO: check whether removing a final qualifying round

                           saveTournament(tournament);
                           tree_draw();
                           matchesTab();
                        }
                     }
                  });

               if (device.isWindows || d3.event.shiftKey) {
                  setTimeout(function() { menu(coords[0], coords[1]); }, 200);
               } else {
                  setTimeout(function() { menu(coords[0], coords[1]); }, 200);
               }
            }

         }

         function drawNotActiveContextClick(d, coords) {

            let draw = e.draw;
            let position = d.data.dp;

            // must be a unique selector in case there are other SVGs
            let selector = d3.select('#' + container.draws.id + ' svg').node();
            let menu = contextMenu().selector(selector).events({ 'cleanup': tree_draw.unHighlightCells });

            if (!d.height && d.data && d.data.dp && !d.data.team) {
               // position is vacant, decide appropriate action
               let seed_group = drawFx.nextSeedGroup({ draw });
               if (seed_group) {
                  assignSeededPosition({ position, seed_group, coords });
               } else {
                  if (o.byes_with_unseeded) {
                     assignUnseededPosition({ position, coords });
                  } else {
                     // section assigns byes then qualifiers before unseeded positions
                     let info = drawFx.drawInfo(draw);
                     if (info.draw_positions.length > draw.opponents.length + info.byes.length + info.qualifiers.length) {
                        let player_count = (draw.opponents ? draw.opponents.length : 0) + (draw.qualifiers || 0);

                        if (info.draw_positions.length > player_count + info.byes.length) {
                           assignByeOrQualifier({ position, bye: true, coords });
                        } else {
                           assignByeOrQualifier({ position, bye: false, coords });
                        }

                     } else {
                        assignUnseededPosition({ position, coords });
                     }
                  }
               }
            } else if (!d.data.bye && !e.automated && d.data.team) {

               // cannot remove seeded players (yet)
               if (d.data.team[0].seed) {

                  console.log('seeded player');
                  // TODO: discover which seed_group this player is in... if
                  // this player is removed then remove all seed players in
                  // the same group as well as all players in later seed groups
                  // and all unseeded players...
                  return;
               }

               assignedPlayerOptions({ position, node: d, coords, draw });

            } else if (d.height == 0 && d.data.bye && !displayed_draw_event.active) {
               assignedByeOptions({ position, node: d, coords, draw });
            } else if (d.data.team) {
               console.log('alternate or lucky loser?', d);
               let team_match = drawFx.teamMatch(d);
               if (team_match) console.log('team match');
            }

            function assignedByeOptions({ position, node, coords, draw }) {

               let info = drawFx.drawInfo(draw);
               let options = [`${lang.tr('draws.remove')}: BYE`];

               menu
                  .items(...options)
                  .events({ 
                     'item': { 'click': (d, i) => {

                        if (info.unassigned.length) {
                           node.data.bye = false;
                           delete node.data.team;

                        } else {
                           // 1. if there are any byes and players advanced, undo
                           console.log('complete draw');
                        }

                        saveTournament(tournament);
                        tree_draw();
                     }}
                  });

               if (device.isWindows || d3.event.shiftKey) {
                  setTimeout(function() { menu(coords[0], coords[1]); }, 200);
               } else {
                  setTimeout(function() { menu(coords[0], coords[1]); }, 200);
               }
            }

            // options for positions which have already been assigned
            function assignedPlayerOptions({ position, node, coords, draw }) {

               let info = drawFx.drawInfo(draw);
               let teams = optionNames([node.data.team]);
               let options = teams.map(t => `${lang.tr('draws.remove')}: ` + t);

               menu
                  .items(...options)
                  .events({ 
                     'item': { 'click': (d, i) => {

                        if (info.unassigned.length) {
                           delete node.data.team;
                           draw.unseeded_placements = draw.unseeded_placements.filter(f=>f.position != position);
                        } else {
                           // 1. if there are any byes and players advanced, undo
                           console.log('complete draw');
                        }

                        saveTournament(tournament);
                        tree_draw();
                     }}
                  });

               if (device.isWindows || d3.event.shiftKey) {
                  setTimeout(function() { menu(coords[0], coords[1]); }, 200);
               } else {
                  setTimeout(function() { menu(coords[0], coords[1]); }, 200);
               }
            }

            function assignSeededPosition({ position, seed_group, coords }) {

               if (seed_group.positions.indexOf(position) < 0) return;
               let { remaining: range, teams } = getSeedTeams(seed_group);

               menu
                  .items(...teams)
                  .events({ 
                     'item': { 'click': (d, i) => {
                        seedAssignment(draw, seed_group, position, range[i]);
                        saveTournament(tournament);

                        tree_draw();
                        e.draw = tree_draw.data();
                     }}
                  });

               if (device.isWindows || d3.event.shiftKey) {
                  setTimeout(function() { menu(coords[0], coords[1]); }, 200);
               } else {
                  setTimeout(function() { menu(coords[0], coords[1]); }, 200);
               }
            }

            function assignUnseededPosition({ position, coords }) {

               let info = drawFx.drawInfo(draw);
               let player_count = (draw.opponents ? draw.opponents.length : 0) + (draw.qualifiers || 0);
               let byes = info.draw_positions.length - (player_count + info.byes.length);
               let qualifiers = info.draw_positions.length > draw.opponents.length + info.byes.length + info.qualifiers.length;

               let placements = draw.unseeded_placements.map(p=>p.id);
               let unplaced_teams = draw.unseeded_teams.filter(team => placements.indexOf(team[0].id) < 0);
               unplaced_teams = teamSort(unplaced_teams);

               let teams = optionNames(unplaced_teams);
               if (byes) { teams.unshift(`Bye {${byes}}`); }
               if (!byes && qualifiers) teams.unshift('Qualifier');

               menu
                  .items(...teams)
                  .events({ 
                     'item': { 
                        'click': (d, i) => {
                           if (!byes && qualifiers && i == 0) {
                              assignPosition(position, undefined, false, true);
                           } else if (byes && i == 0) {
                              assignPosition(position, undefined, true, false);
                           } else {
                              let team = unplaced_teams[byes ? i - 1 : i];
                              assignPosition(position, team);
                              draw.unseeded_placements.push({ id: team[0].id, position });
                           }

                           // TODO: this block of code is duplicated
                           let info = tree_draw.info();
                           if (info.unassigned.length == 1) {
                              let unassigned_position = info.unassigned[0].data.dp;
                              let placements = draw.unseeded_placements.map(p=>p.id);
                              let unplaced_teams = draw.unseeded_teams.filter(team => placements.indexOf(team[0].id) < 0);
                              let team = unplaced_teams[0];
                              assignPosition(unassigned_position, team);
                              draw.unseeded_placements.push({ id: team[0].id, position: unassigned_position });
                              tree_draw.advanceTeamsWithByes();
                              if (e.draw_type == 'Q') checkForQualifiedTeams(e);
                              drawCreated(e);
                           } else if (!info.unassigned.length) {
                              if (e.draw_type == 'Q') checkForQualifiedTeams(e);
                              drawCreated(e);
                           }

                           saveTournament(tournament);

                           tree_draw();
                           e.draw = tree_draw.data();
                        }
                     }
                  });

               if (device.isWindows || d3.event.shiftKey) {
                  setTimeout(function() { menu(coords[0], coords[1]); }, 200);
               } else {
                  setTimeout(function() { menu(coords[0], coords[1]); }, 200);
               }
            }

            function assignByeOrQualifier({ position, bye, coords }) {

               let choices = bye ? ['BYE'] : ['Qualifier'];

               menu
                  .items(...choices)
                  .events({ 
                     'item': { 'click': (d, i) => {
                        assignPosition(position, undefined, bye, !bye);

                        let info = tree_draw.info();
                        if (!info.unassigned.length) {
                           if (e.draw_type == 'Q') checkForQualifiedTeams(e);
                           drawCreated(e);
                        }
                        saveTournament(tournament);

                        tree_draw();
                        e.draw = tree_draw.data();
                     }}
                  });

               if (device.isWindows || d3.event.shiftKey) {
                  setTimeout(function() { menu(coords[0], coords[1]); }, 200);
               } else {
                  setTimeout(function() { menu(coords[0], coords[1]); }, 200);
               }
            }
         }
      }

      function updateScheduleBox(match) {
         let schedule_box = Array.from(document.querySelectorAll('.schedule_box'))
            .reduce((s, el) => {
               let el_muid = el.getAttribute('muid');
               if (el_muid == match.muid) s = el;
               return s;
            });

         let sb = gen.scheduleBox({ match, editable: true});
         if (schedule_box) {
            schedule_box.innerHTML = sb.innerHTML;
            schedule_box.style.background = sb.background;
            schedule_box.setAttribute('draggable', 'true');
            saveTournament(tournament);
         }
      }

      function addUmpire(match, context) {
         if (!match || !match.schedule || !match.schedule.court) return;

         let uobj = gen.selectUmpire({ container });
         let entry_modal = d3.select(uobj.entry_modal.element);
         let removeEntryModal = () => {
            entry_modal.remove();
            document.body.style.overflow = null;
         }

         entry_modal.on('click', removeEntryModal);
         uobj.umpire_search.element.value = match.umpire || '';

         let selection_flag = false;
         let umpires = tournament.umpires || [];
         let list = umpires.map(umpire =>({ value: umpire, label: umpire }));
         uobj.typeAhead = new Awesomplete(uobj.umpire_search.element, { list });
         let selectUmpire = (umpire) => {
            submitUmpire(umpire);
            removeEntryModal();
         }
         uobj.umpire_search.element
            .addEventListener("awesomplete-selectcomplete", function(e) { selection_flag = true; selectUmpire(this.value); }, false);
         uobj.umpire_search.element.addEventListener('keydown', catchTab , false);
         uobj.umpire_search.element.addEventListener("keyup", function(e) { 
            // auto select first item on 'Enter' *only* if selectcomplete hasn't been triggered
            if (e.which == 13 && !selection_flag) {
               let value = uobj.umpire_search.element.value;
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
         uobj.umpire_search.element.focus();

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
               console.log('update draw');
            }
         }

      }

      // for generating draws when there are only arrays of matches
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

      function tournamentTab() {
         let { days } = scheduledMatches();
         if (tournament.matches.length && (!tournament.events || !tournament.events.length)) {
            legacyTournamentOptions();
         } else {
            tournamentOptions(days);
         }
      }

      function legacyTournamentOptions() {
         let legacy = gen.legacyTournamentTab(container.tournament.element);
         Object.assign(container, legacy.container);
         legacyTournament(tournament, container);
      }

      function tournamentOptions(days) {

         if (!tournament.display_id) {
            if (tournament.tuid.length < 15) tournament.display_id = tournament.tuid;
         }

         let field_order = [ 'start_date', 'end_date', 'organizer', 'location', 'display_id', 'judge' ];

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

         container.organizer.element.addEventListener('keydown', catchTab, false);
         container.location.element.addEventListener('keydown', catchTab, false);
         container.judge.element.addEventListener('keydown', catchTab, false);
         container.display_id.element.addEventListener('keydown', catchTab, false);

         container.organizer.element.addEventListener('keyup', (evt) => defineAttr('organizer', evt));
         container.location.element.addEventListener('keyup', (evt) => defineAttr('location', evt));
         container.judge.element.addEventListener('keyup', (evt) => defineAttr('judge', evt));
         container.display_id.element.addEventListener('keyup', (evt) => defineAttr('display_id', evt));

         container.organizer.element.value = tournament.organizer || '';
         container.location.element.value = tournament.location || '';
         container.judge.element.value = tournament.judge || '';
         container.display_id.element.value = tournament.display_id || '';

         let day_times = days.map(d=>new Date(d).getTime());
         let max_start = Math.min(...day_times);
         let min_end = Math.max(...day_times);

         let start = new Date(tournament.start);
         let end = new Date(tournament.end);

         function updateStartDate() {
            tournament.start = start.getTime();
            startPicker.setStartRange(start);
            endPicker.setStartRange(start);
            endPicker.setMinDate(start);
            saveTournament(tournament);
         };
         function updateEndDate() {
            tournament.end = end.getTime();
            startPicker.setEndRange(end);
            startPicker.setMaxDate(end);
            endPicker.setEndRange(end);
            saveTournament(tournament);
         };
         var startPicker = new Pikaday({
            field: container.start_date.element,
            defaultDate: start,
            setDefaultDate: true,
            i18n: lang.obj('i18n'),
            onSelect: function() {
                let date = this.getDate();
                // can't set start after to earliest scheduled match
                if (util.sameDay(date, new Date(max_start)) || date.getTime() <= max_start) {
                   start = date;
                   updateStartDate();
                } else {
                   this.setDate(start);
                }
                nextFieldFocus('start_date');
            },
         });
         var endPicker = new Pikaday({
            field: container.end_date.element,
            defaultDate: end,
            setDefaultDate: true,
            i18n: lang.obj('i18n'),
            onSelect: function() {
                let date = this.getDate();
                // can't set end prior to latest scheduled match
                if (util.sameDay(date, new Date(min_end)) || date.getTime() >= min_end) {
                   end = date;
                   updateEndDate();
                } else {
                   this.setDate(end);
                }
                nextFieldFocus('end_date');
            },
         });

         let points_date = new Date(tournament.points_date || tournament.end);
         console.log(points_date);
         let pointsDatePicker = new Pikaday({
            field: container.points_valid.element,
            i18n: lang.obj('i18n'),
            defaultDate: points_date,
            setDefaultDate: true,
            onSelect: function() {
               points_date = this.getDate();
               tournament.points_date = points_date.getTime();
               saveTournament(tournament);

               // regenerate points with new date
               let { completed_matches, pending_matches } = tournamentEventMatches({ tournament });
               tournamentPoints(tournament, completed_matches);
            },
         });
         pointsDatePicker.setMinDate(points_date);

         container.start_date.element.addEventListener('keydown', catchTab, false);
         container.end_date.element.addEventListener('keydown', catchTab, false);

         container.start_date.element.addEventListener('keyup', (evt) => nextFieldFocus('start_date'));
         container.end_date.element.addEventListener('keyup', (evt) => nextFieldFocus('end_date'));
      }

      function drawsTab() {
         let existing_draws = false;
         let event_draws = tournament.events && tournament.events.length && tournament.events.map(e => e.draw).length;
         if (group_draws.length || event_draws) existing_draws = true;
         tabVisible(container, 'DT', existing_draws);
         if (!existing_draws) return;

         let selected_event = container.select_draw.ddlb ? container.select_draw.ddlb.getValue() : undefined;

         let selection = 0;
         let draw_options;
         let onChange = () => undefined;

         if (event_draws) {
            let types = {
               'R': lang.tr('draws.roundrobin'),
               'C': lang.tr('draws.consolation'),
               'Q': lang.tr('draws.qualification'),
            }
            draw_options = tournament.events.map((e, i) => { 
               if (displayed_event && displayed_event == e.euid) selection = i;
               return { key: `${e.name} ${types[e.draw_type] || ''}`, value: i }
            });
            onChange = genEventDraw;
         } else if (group_draws.length) {
            draw_options = group_draws;
            onChange = genGroupDraw;
            enableDrawActions();
         }

         dd.attachDropDown({ 
            options: draw_options,
            id: container.select_draw.id, 
            label: lang.tr('ddlb.draws'), 
         });
         container.select_draw.ddlb = new dd.DropDown({ element: container.select_draw.element, onChange: onChange, id: container.select_draw.id });
         container.select_draw.ddlb.selectionBackground();

         if (event_draws) {
            container.select_draw.ddlb.setValue(selection);
         } else if (group_draws.length) {
            container.select_draw.ddlb.setValue(selected_event || group_draws[0].value);
         }

         onChange(draw_options[selection].value);
      }

      function enableRankEntry(visible) {
         Array.from(document.querySelectorAll('.rankentry')).forEach(e=>e.style.display = visible ? '' : 'none');
         Array.from(document.querySelectorAll('.rankvalue')).forEach(e=>e.style.display = visible ? 'none' : '');
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

      function updateRegisteredPlayers(remote_request, show_notice) {
         if (!state.edit) return;
         // TODO: add to idioms
         let id = show_notice ? busy.message(`<p>${lang.tr("refresh.registered")}</p>`) : undefined;
         let done = (registered) => {
            addRegistered(registered);
            busy.done(id);
         }
         let notConfigured = (err) => { busy.done(id); gen.popUpMessage((err && err.error) || lang.tr('phrases.notconfigured')); }
         coms.fetchRegisteredPlayers(tournament.tuid, tournament.category, remote_request).then(done, notConfigured);
      }

      function saveTournament(tournament) {
         if (o.save) db.addTournament(tournament);
         tournament.saved_locally = false;
         tournament.published = false;
         gen.tournamentPublishState(container.push2cloud_state.element, tournament.published);
         gen.localSaveState(container.localdownload_state.element, tournament.saved_locally);
      }

      return { tournament, container };
   }

   function valueLabel(player) {
      let label = util.normalizeName([player.first_name, player.last_name].join(' '));
      if (player.birth) label += ` [${new Date(player.birth).getFullYear()}]`;
      return { value: player.puid, label, }
   }

   fx.processLoadedTournament = processLoadedTournament;
   function processLoadedTournament() {

      if (!load.loaded.tournament) return coms.fileNotRecognized();

      if (load.loaded.outstanding && load.loaded.outstanding.length) {
         console.log('Cannot Process Tournament with Outstanding Actions');
         return;
      }

      if (load.loaded.meta && load.loaded.meta.filecategory && load.loaded.meta.filecategory != load.loaded.meta.category) load.loaded.meta.category = '';

      let trny = {
         sid: load.loaded.tournament.sid,
         tuid: load.loaded.meta.tuid,
         start: load.loaded.start,
         end: load.loaded.meta.date || load.loaded.date,
         name: load.loaded.meta.name,
         matches: load.loaded.matches,
      }

      if (load.loaded.accepted) {
         trny.accepted = {};
         if (load.loaded.accepted.M) trny.accepted.M = load.loaded.accepted.M;
         if (load.loaded.accepted.W) trny.accepted.W = load.loaded.accepted.W;
      }

      if (load.loaded.results) {
         let ranks = load.loaded.results.ranks;
         trny.rank_opts = {
            category: load.loaded.meta.category,
            sgl_rank: ranks.singles != undefined ? ranks.singles : load.loaded.meta.rank,
            dbl_rank: ranks.doubles != undefined ? ranks.doubles : load.loaded.meta.rank,
         }
      }

      let {tournament, container} = createTournamentContainer({tournament: trny});
      calcPlayerPoints({ date: tournament.end, tournament, container });
   }

   // invoked whenever there is a form change
   // only paramater is date because that is what is passed by calendar object
   function calcPlayerPoints({ date, tournament, container }) {

      let points_date = new Date(tournament.points_date || date || tournament.end);
      let tuid = tournament.tuid;
      let matches = tournament.matches.slice();

      // remove any calculated points or rankings
      matches.forEach(match => match.players.forEach(p => p=player.cleanPlayer(p)));

      let dbl_matches = matches.filter(f=>f.format == 'doubles').length;

      // retrieve options from container
      let rankings = tournament.matches.length ? tournamentOpts(undefined, container) : {};
      let category = rankings.category;

      if (!rankings.category || !points_date) {
         // calling with no points clear Point Display
         gen.displayPlayerPoints(container);
         return;
      }

      let profile = env.profile || tournamentParser.profiles[env.org];
      let points_table = point_tables[profile.points];

      // if there are no gendered ranking settings, 
      // all matches modified with same ranking settings
      let match_data = { matches, category, rankings, date: points_date, points_table };

      let points = rank.bulkPlayerPoints(match_data);

      // DISPLAY
      displayTournamentPoints(container, points);

      let gender = tournament.genders && tournament.genders.length == 1 ? tournament.genders[0] : undefined;

      let finishFx = () => addAcceptedRankings(container, tournament, category);
      saveMatchesAndPoints({ tournament, matches, points, gender, finishFx });
   }

   function addAcceptedRankings(container, tournament, category) {
      let tuid = tournament.tuid;
      let rankings = tournament.matches.length ? tournamentOpts(undefined, container) : {};
      if (tuid) rank.addAcceptedRanking({tuid, category, rankings});
   }

   function saveMatchesAndPoints({ tournament, matches, points, gender, finishFx }) {

      console.log('saving matches and points');

      db.deleteTournamentPoints(tournament.tuid, gender).then(saveAll, (err) => console.log(err));

      function saveAll() {
         let finish = (result) => { if (typeof finishFx == 'function') finishFx(result); }
         let addMatches = (matches) => util.performTask(db.addMatch, matches, false);
         let singles_points = Object.keys(points.singles).map(player => points.singles[player]);
         let doubles_points = Object.keys(points.doubles).map(player => points.doubles[player]);
         let all_points = [].concat(...singles_points, ...doubles_points);

         // total points adds all points for all players
         let total_points = all_points.length ? all_points.map(p => p.points).reduce((a, b) => +a + (+b || 0)) : 0;

         // if anyone earned points, save matches, point_events then display
         if (total_points) {
            let addPointEvents = (point_events) => util.performTask(db.addPointEvent, point_events, false);
            let valid_points = all_points.filter(p => p.points != undefined && p.puid);

            addPointEvents(valid_points).then(() => addMatches(matches)).then(finish);
         } else {
            addMatches(matches).then(finish);
         }
      }
   }

   function tabVisible(container, tab, visible=true) {
      d3.select(`#${tab}` + container.container.id).style('display', visible ? 'flex' : 'none');
   }

   function displayTournamentPoints(container, points) {
      tabVisible(container, 'PT', points && points.length);
      gen.displayPlayerPoints(container, points);
      let pp = (evt) => player.displayPlayerProfile(util.getParent(evt.target, 'point_row').getAttribute('puid')).then(()=>{}, ()=>{});
      util.addEventToClass('point_row', pp, container.points.element)
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
      let action = load.loaded.outstanding[index];
      let original = { original: action.player };

      load.loaded.decisions[index] = Object.assign({}, action, { action: 'ignored' }, original, { status: 'completed' });

      gen.undoButton(e);
      e.select('.undo').on('click', () => { d3.event.stopPropagation(); undoAction(row); });
      gen.moveToBottom(row);

      submitEdits();
   }

   function submitEdits() {
      searchBox.focus();
      if (load.loaded.outstanding.length != Object.keys(load.loaded.decisions).length) return false;
      searchBox.active = {};
      gen.submitEdits();

      Array.from(gen.identify_container.action_message.element.querySelectorAll('button.accept'))
         .forEach(elem => elem.addEventListener('click', acceptEdits));

      function acceptEdits() {
         if (load.loaded.outstanding.length != Object.keys(load.loaded.decisions).length) return false;

         let actions = Object.keys(load.loaded.decisions).map(k => {
            let decision = load.loaded.decisions[k];
            if (decision.action == 'aliased') {
               load.addAlias({ alias: decision.original.hash, hash: decision.player.hash });
            }
            if (decision.action == 'ignored' && decision.player.ioc) {
               load.addIgnore({ hash: decision.original.hash, ioc: decision.player.ioc });
            }
            return decision;
         });

         load.loaded.outstanding = [];
         actions = actions.concat(...load.loaded.completed);

         let players = load.updatePlayers(actions);
         if (!players) processLoadedTournament();
      }
   }

   function undoAction(row) {
      let e = d3.select(row);
      let index = e.attr('action_index');
      let action = load.loaded.outstanding[index];
      // let type = (action.status == 'unknown') ? lang.tr('unk') : lang.tr('dup');

      gen.ignoreButton(e, action);
      // gen.ignoreButton(e);
      e.select('.ignore').on('click', () => { d3.event.stopPropagation(); ignorePlayer(row); });

      delete load.loaded.decisions[index];
      clearActivePlayer();
      gen.moveToTop(row);
   }

   fx.identifyPlayer = identifyPlayer;
   function identifyPlayer(elem) {
      let e = d3.select(elem);
      let index = e.attr('action_index');
      let action = load.loaded.outstanding[index];
      let original = { original: action.player };
      let player = action.player;

      if (searchBox.active.player && searchBox.active.player.puid) {
         let player = { player: searchBox.active.player };

         if (action.status == 'unknown') {
            load.loaded.decisions[index] = Object.assign({}, { action: 'aliased' }, original, player, { status: 'completed' });
         } else if (action.status == 'duplicate') {
            load.loaded.decisions[index] = Object.assign({}, { action: 'identified' }, original, player, { status: 'completed' });
         }

         gen.markAssigned(e);
         let row = util.getParent(elem, 'section_row');
         e.select('.undo').on('click', () => { d3.event.stopPropagation(); undoAction(elem); });
         gen.moveToBottom(elem);
         clearActivePlayer();
         submitEdits();

         return;
      }

      let container = gen.identifyPlayer(player);
      container.save.element.addEventListener('click', () => { gen.closeModal('edit'); });
      container.cancel.element.addEventListener('click', () => { gen.closeModal('edit'); });
   }

   fx.setActivePlayer = setActivePlayer;
   function setActivePlayer(player, club) {
      gen.activePlayer(player, club);
      Array.from(gen.identify_container.action_message.element.querySelectorAll('button.dismiss'))
         .forEach(elem => elem.addEventListener('click', clearActivePlayer));
   }

   function clearActivePlayer() {
      searchBox.active = {};
      gen.clearActivePlayer();
      searchBox.focus();
   }

   // TODO: What is this?  Still needed?
   fx.pts = pts;
   function pts() {
      return new Promise( (resolve, reject) => {
         db.db.tournaments.toArray(process);

         function process(tournaments) {
            let data = tournaments.map(tournament => { return { tournament }});
            util.performTask(calcTournamentPoints, data, true).then(finish, reject);
         }

         function finish(results) {
            console.log('finished', results.length, 'tournaments');
         }

      });
   }

   function calcTournamentPoints({ tournament }) {
      return new Promise( (resolve, reject) => {
         db.db.matches.where('tournament.tuid').equals(tournament.tuid).toArray(calcPoints); 

         let points_date = new Date(tournament.points_date || tournament.end);
         let profile = env.profile || tournamentParser.profiles[env.org];
         let points_table = point_tables[profile.points];

         let rankings = {
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
         }

         let addPointEvents = (point_events) => util.performTask(db.addPointEvent, point_events, false);

         function calcPoints(matches) {
            let match_data = { matches, category: rankings.category, rankings, date: points_date, points_table };
            let points = rank.bulkPlayerPoints(match_data);

            let singles_points = Object.keys(points.singles).map(player => points.singles[player]);
            let doubles_points = Object.keys(points.doubles).map(player => points.doubles[player]);
            let all_points = [].concat(...singles_points, ...doubles_points);

            let valid_points = all_points.filter(p => p.points != undefined && p.puid);
            addPointEvents(valid_points).then(resolve({tournament, point_events: valid_points.length}), reject);
         }
      });
   }

   // used exclusively when draws are generated from existing matches
   function generateDrawBrackets(matches) {
      let brackets = drawFx.findBrackets(matches);

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

      // exclude pre-round matches
      rows = rows.filter(f=>!f.preround);
      let tree = drawFx.recreateDrawFromMatches(rows, draw_type);

      // TODO: generate separate draw for pre-round matches?

      return tree;
   }

   function groupMatches(matches) {
      let groups = {}

      groups.ms = matches.filter(match => match.format == 'singles' && match.gender == 'M' && match.consolation == false);
      groups.msq = groups.ms.filter(match => match.round.indexOf('Q') == 0 && match.round.indexOf('QF') != 0);
      groups.msm = groups.ms.filter(match => match.round.indexOf('RR') < 0 && (match.round.indexOf('QF') == 0 || match.round.indexOf('Q') < 0));
      groups.msrr = groups.ms.filter(match => match.round.indexOf('RR') == 0);

      groups.md = matches.filter(match => match.format == 'doubles' && match.gender == 'M' && match.consolation == false);

      groups.ws = matches.filter(match => match.format == 'singles' && match.gender == 'W' && match.consolation == false);
      groups.wsq = groups.ws.filter(match => match.round.indexOf('Q') == 0 && match.round.indexOf('QF') != 0);
      groups.wsm = groups.ws.filter(match => match.round.indexOf('RR') < 0 && (match.round.indexOf('QF') == 0 || match.round.indexOf('Q') < 0));
      groups.wsrr = groups.ws.filter(match => match.round.indexOf('RR') == 0);

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
      if (groups.wsrr.length && !groups.wsm.length) { groups.wsrr.forEach(match => match.round = match.round.replace('Q', '')); }
      if (groups.msrr.length && !groups.msm.length) { groups.msrr.forEach(match => match.round = match.round.replace('Q', '')); }

      return { groups, group_draws };
   }

   function tournamentGenders(tournament, filterFx=()=>true) {
      let match_genders = !tournament.matches ? [] : tournament.matches
         .map(match => {
            match.gender = match.gender || rank.determineGender(match);
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
      matches.forEach(match => { 
         if (!match.gender) match.gender = rank.determineGender(match); 
         if (match.consolation) match.draw = 'C';
         if (match.round.indexOf('Q') == 0 && match.round.indexOf('QF') < 0) match.draw = 'Q';

         // TODO: RR is not always Q... if there is only one bracket...
         if (match.round.indexOf('RR') == 0) match.draw = 'Q';
      });
   }

   // takes a list of matches creates a list of players and events they played/are playing
   function matchPlayers(matches) {
      addMatchDraw(matches);

      let players = [].concat(...matches.map(match => {
         let gender = rank.determineGender(match);
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

      let trny = Object.assign({}, tournament_data);
      let { container } = gen.createNewTournament(title, trny);

      let field_order = [ 'name', 'association', 'organizer', 'start', 'end', 'judge', 'draws', 'cancel', 'save' ];

      let nextFieldFocus = (field) => {
         let next_field = field_order.indexOf(field) + 1;
         if (next_field == field_order.length) next_field = 0;
         container[field_order[next_field]].element.focus(); 
      }

      let setCategory = (value) => {
         if (!value) { setTimeout(function() { container.category.ddlb.selectionBackground('yellow'); }, 200); }
         trny.category = value;
      }
      container.category.ddlb = new dd.DropDown({ element: container.category.element, onChange: setCategory });
      container.category.ddlb.selectionBackground('yellow');

      let setRank = (value) => {
         if (!value) { setTimeout(function() { container.rank.ddlb.selectionBackground('yellow'); }, 200); }
         trny.rank = value;
      }
      container.rank.ddlb = new dd.DropDown({ element: container.rank.element, onChange: setRank });
      container.rank.ddlb.selectionBackground('yellow');

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

      let saveTournament = () => { 
         let valid_start = !trny.start ? false : typeof trny.start == 'string' ? util.validDate(trny.start) : true;
         let valid_end   = !trny.end   ? false : typeof trny.end   == 'string' ? util.validDate(trny.end) : true;
         if (!valid_start || !valid_end || !trny.name || !validRange() || !trny.category || !trny.rank) return;

         if (typeof callback == 'function') callback(trny); 
         gen.closeModal();
      }

      let handleSaveKeyDown = (evt) => {
         evt.preventDefault();
         if (evt.which == 9) nextFieldFocus(evt.shiftKey ? 'email' : 'save'); 
      }

      let handleSaveKeyUp = (evt) => {
         catchTab(evt); 
         if (evt.which == 13) saveTournament();
      }

      let handleCancelKeyEvent = (evt) => {
         evt.preventDefault()
         if (evt.which == 9) nextFieldFocus(evt.shiftKey ? 'phone' : 'cancel');
      }

      let validRange = () => {
         if (!trny.start || !trny.end) return true;
       
         let sdate = new Date(trny.start);
         let edate = new Date(trny.end);
         let days = Math.round((edate-sdate)/(1000*60*60*24));
         return (days >= 0 && days < 15);
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

      let start = new Date().getTime();
      let end = null;

      var startPicker = new Pikaday({
         field: container.start.element,
         defaultDate: start,
         setDefaultDate: true,
         i18n: lang.obj('i18n'),
         onSelect: function() { 
            start = this.getDate();
            updateStartDate();
            validateDate(undefined, 'start', container.start.element);
            if (end < start) {
               endPicker.gotoYear(start.getFullYear());
               endPicker.gotoMonth(start.getMonth());
            }
         },
      });

      var endPicker = new Pikaday({
         field: container.end.element,
         i18n: lang.obj('i18n'),
         onSelect: function() {
            end = this.getDate();
            updateEndDate();
            validateDate(undefined, 'end', container.end.element);
            if (end < start) {
               startPicker.gotoYear(end.getFullYear());
               startPicker.gotoMonth(end.getMonth());
            }
         },
      });

      container.name.element.addEventListener('keydown', catchTab, false);
      container.association.element.addEventListener('keydown', catchTab, false);
      container.organizer.element.addEventListener('keydown', catchTab, false);
      container.judge.element.addEventListener('keydown', catchTab, false);
      container.draws.element.addEventListener('keydown', catchTab, false);

      container.name.element.addEventListener('keyup', (evt) => defineAttr('name', evt, { length: 8 }));
      container.start.element.addEventListener('keyup', (evt) => validateDate(evt, 'start'));
      container.end.element.addEventListener('keyup', (evt) => validateDate(evt, 'end'));

      container.association.element.addEventListener('keyup', (evt) => defineAttr('association', evt));
      container.organizer.element.addEventListener('keyup', (evt) => defineAttr('organizer', evt));
      container.judge.element.addEventListener('keyup', (evt) => defineAttr('judge', evt));
      container.draws.element.addEventListener('keyup', (evt) => defineAttr('draws', evt));

      container.cancel.element.addEventListener('click', () => gen.closeModal());
      container.cancel.element.addEventListener('keydown', handleCancelKeyEvent);
      container.cancel.element.addEventListener('keyup', (evt) => { if (evt.which == 13) gen.closeModal(); });
      container.save.element.addEventListener('click', saveTournament);
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

      // set the start range and initial date
      startPicker.setDate(start);
      updateStartDate();

      // timeout necessary because startPicker.setDate()
      setTimeout(function() { container.name.element.focus(); }, 50);
   }

   fx.eventMatches = eventMatches;
   function eventMatches(e) {
      if (!e.draw) return [];

      let round_names = [];
      if (['E', 'C'].indexOf(e.draw_type) >= 0) round_names = ['F', 'SF', 'QF', 'R16', 'R32', 'R64', 'R96', 'R128'];
      if (['Q'].indexOf(e.draw_type) >= 0) round_names = ['Q', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5'];

      // in case there are matches without...
      addMUIDs(e);

      return drawFx.matches(e.draw, round_names);
   }

   function addMUIDs(e) {
      if (!e.draw) return;

      if (e.draw.brackets) {
         e.draw.brackets.forEach(bracket => bracket.matches.forEach(match => {
            if (!match.muid) match.muid = UUID.new();
         }));
      } else {
         drawFx.drawInfo(e.draw).nodes.forEach(node => { 
            if (drawFx.matchNode(node) && !drawFx.byeTeams(node)) {
               if (!node.data.match) node.data.match = {};
               if (!node.data.match.muid) node.data.match.muid = UUID.new();
            }
         });
      }
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

   fx.monthReport = (after, before = new Date()) => {
      let after_time = new Date(after).getTime();
      let before_time = new Date(before).getTime();
      return new Promise((resolve, reject) => {
         let unchanged = [];
         let changed = [];

         db.db.tournaments.where('end').between(after_time, before_time).toArray(tournaments => {
            tournaments.forEach(t => {
               let rank = parseInt(t.rank);
               let M = !t.accepted ? '' : !t.accepted.M ? '' : `M: ${t.accepted.M.sgl_rank || rank}/${t.accepted.M.dbl_rank || rank}`;
               let W = !t.accepted ? '' : !t.accepted.W ? '' : `W: ${t.accepted.W.sgl_rank || rank}/${t.accepted.W.dbl_rank || rank}`;
               let accepted = M && W ? `${M} ${W}\r\n\r\n` : '';
               if (t.accepted &&
                  parseInt(t.accepted.M.sgl_rank) == rank && 
                  (!t.accepted.M.dbl_rank || parseInt(t.accepted.M.dbl_rank) == rank) && 
                  (!t.accepted.W || !t.accepted.W.dbl_rank || parseInt(t.accepted.W.dbl_rank) == rank) &&
                  (!t.accepted.W || !t.accepted.W.sgl_rank || parseInt(t.accepted.W.sgl_rank) == rank)) {
                     accepted = '';
                  }

               let report = [ t.name, `Date: ${util.formatDate(new Date(t.start))}`, `Category: ${t.category}`, `Scheduled Rank: ${rank}`, accepted ];
               let rankings = report.join('\r\n');

               if (accepted) changed.push(rankings);
               if (!accepted) unchanged.push(rankings);
            });

            let result = `CHANGED:\r\n${changed.join('')}UNCHANGED:\r\n${unchanged.join('\r\n')}`;

            console.log(result);
            resolve(result);
         });
      });
   }

   return fx;

}();
