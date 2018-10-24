import { util } from './util';
import { lang } from './translator';

let guide = introJs();

let cobjs = {};
let containers = {};

let verbiage = `
      CourtHive/TMX is a Tournament Manager.  Although it runs in your browser, it is not a website; TMX is an application that is cached locally on your computer or table.  This means that TMX can be used offline at facilities that have no or poor internet access; there is no network latency when performing actions.
`;

export const tmxTour = function() {

   let fx = {};

   fx.guide = guide;

   fx.clear = () => {
      let hints = document.querySelector('.introjs-hints');
      if (hints) hints.remove();
   }
   fx.hintsActive = () => {
      let active = Array.from(document.querySelectorAll('.introjs-hint'))
         .map(h=>h.classList.contains('introjs-hidehint'))
         .reduce((p, c) => !c || p, false);
      return active;
   }
   fx.active = () => document.querySelector('.introjs-overlay');
   fx.splashContainer = (container) => { containers.splash = container; }

   fx.calendarContainer = (container) => { containers.calendar = container; }
   fx.tournamentContainer = (container, classes) => {
      containers.tournament = container;
      cobjs.tournament = classes;
   }

   fx.tournamentTours = (context) => {
      document.body.scrollIntoView();

      if (context == 'calendar') return calendarTour();
      if (context == 'tournament_tab') return tournamentTabTour();
      if (context == 'events_tab') return eventsTabTour();
      if (context == 'draws_tab') return drawsTabTour();
      if (context == 'schedule_tab') return scheduleTabTour();
      if (context == 'players_tab') return playersTabTour();
      if (context == 'matches_tab') return matchesTabTour();
      if (context == 'points_tab') return pointsTabTour();

      // TODO
      if (context == 'courts_tab') return courtsTabTour();
      if (context == 'teams_tab') return teamsTabTour();
   }
   fx.tournamentHints = (context) => {
      if (fx.hintsActive()) {
         fx.clear();
      } else {
         if (context == 'events_tab') return eventsTabHints();
         if (context == 'players_tab') return playersTabHints();
      }
   }

   fx.splashHints = () => {
   }

   fx.splashTour = () => {
      if (!containers.splash) return;

      let splashObj = (obj, intro, position='bottom') => ({ element: containers.splash[obj].element, disableInteraction: true, intro, position });

      let steps = [];

      let elements = [
         { element: undefined, intro: `<b>TMX Tours</b><p class='tour_icon'></p>This icon will appear a the bottom of the page when a context-sensitive tour is available.<p>Note: You can press enter to move to the next tour item or use the arrow keys to navigate` },
         { element: document.querySelector('.searchbox'), intro: 'The Search Box is context sensitive<p>When adding players to an event it can also be used to sign them in<p>Players can be approved for events directly from the search box<p>Players can be added to teams from the search box' },
         { element: document.querySelector('#search_select'), intro: 'Click the Magnifying Glass to change search mode to players, tournaments, or clubs<p>Note: some features may be disabled depending on your configuration' },
         { element: document.querySelector('#searchextra'), intro: 'Search Mode indicator and database item count<p>Hovering or clicking this icon displays refresh options' },
      ]

      let components = [
         { step: 'players', intro: '<b>Players</b><p>Manually add players, Calculate Player Points, Generate Rank Lists<p>Note: some features may be disabled depending on your configuration' },
         { step: 'clubs', intro: '<b>Clubs</b><p>Manage Clubs' },
         { step: 'tournaments', intro: '<b>Tournaments</b><p>Create Tournaments and manage a Calendar of Tournaments' },
         { step: 'settings', intro: '<b>Settings:</b><p>Customize TMX to suit your needs' },
         { step: 'documentation', intro: '<b>View Documentation</b> <p>Context sensitive documentation is also available when you see this icon at the bottom of the page' },
         { step: 'importexport', intro: '<b>Import/Export</b><p>Drag/Drop Tournament Records and XLSX files to populate the local database' },
         { step: 'keys', intro: '<b>Configuration Keys</b><p>Organization keys include logos and preferences<p>Authorization Keys enable official publishing<p>Delegation Keys enable live scoring' },
      ];

      elements.forEach(obj => steps.push(introObj(obj.element, obj.intro)));
      components.forEach(component => { if (sElement(component.step)) steps.push(splashObj(component.step, component.intro)); });

      steps.push({
         intro: `<b>Hints</b><p>Context Sensitive Hints are also available when you see the Hint Icon at the bottom of the page <div class='dotdot'></div>`,
      });

      guide.setOptions({ steps });
      guide.start();
   }

   return fx;

}();

function playersTabHints() {
   if (!containers.tournament) return;

   let classObj = (element, hint, position='top-middle') => ({ element, hint, hintPosition: position });
   let componentObj = (obj, hint, position='top-middle') => ({ element: containers.tournament[obj].element, hint, hintPosition: position });

   let hints = [];

   let context_actions = [
      { class: 'tournamentPlayers', hint: 'Click column header to add tournament players to local database', position: 'top-left' },
      { class: 'playerRanking', hint: 'Click column header to view Doubles rankings' },
      { class: 'rankbyrating', hint: 'Click column header to rank players by their rating' },
   ]

   if (tElement('players')) {
      let players = containers.tournament.players.element;

      context_actions.forEach(action => {
         let element = players.querySelector(`.${action.class}`);
         if (element) hints.push(hintObj(element, action.hint, action.position));
      });
   }

   guide.setOptions({ hints });
   guide.addHints();
   guide.showHints();
}

function eventsTabHints() {
   if (!containers.tournament) return;

   let componentObj = (obj, hint, position='top-middle') => ({ element: containers.tournament[obj].element, hint, hintPosition: position });

   let hints = [];

   let components = [
      { obj: 'eligible', hint: 'Right Clicking on the eligible section header allows Lucky Losers to be approved (when there are losers in a linked qualification draw)' },
      { obj: 'event_display_name', hint: 'Click to customize event name' },
   ]

   components.forEach(component => { if (tElement(component.obj)) hints.push(componentObj(component.obj, component.hint)); });

   let config_actions = [
      { class: 'structure', hint: '<b>Structure</b><p>Main Draw Elimination events may have a "Standard" draw structure or a "Staggered Entry" structure whereby higher ranked or rated players "Feed In" to the draw at later rounds', position: 'top-left' },
      { class: 'roundlimit', hint: `<b>Round Limit</b><p>Complete the draw after a specified number of rounds<p>In "Level Based Play" events there may be events which do not complete because of time limitations`, position: 'top-left' },
      { class: 'skiprounds', hint: '<b>Skip Rounds</b><p>The number of rounds to play normally before players begin to "Feed In" to the draw', position: 'top-left' },
      { class: 'feedrounds', hint: '<b>Feed Rounds</b><p>The number of rounds which will allow players to "Feed In" to the draw', position: 'top-left' },
      { class: 'sequential', hint: '<b>Sequential Rounds</b><p><i>Not currently implemented</i>', position: 'top-left' },
      { class: 'qualifiers', hint: '<b>Qualifiers</b><p>Define the number of qualifiers who will be approved for the main draw', position: 'top-left' },
      { class: 'qualification', hint: '<b>Set Link</b><p>Define a linked qualification event<p>Quailifying players will automatically be approved for this event', position: 'top-middle' },
      { class: 'consolation', hint: '<b>Set Link</b><p>Define a linked consolation event<p>Players who lose in this event will automatically be eligible for consolation<p>In <b>Settings</b> it is possible to allow players from all rounds of an elimination event to become eligible for consolation', position: 'top-middle' },
      { class: 'elimination', hint: '<b>Set Link</b><p>Define the elimination event<p>Players from the elimination event will automatically appear as Eligible', position: 'top-middle' },
      { class: 'brackets', hint: '<b>Brackets</b><p>The number of brackets to allow for this event', position: 'top-left' },
      { class: 'bracket_size', hint: '<b>Bracket Size</b><p>The maximum number of players per bracket<p>Some brackets may have a single BYE', position: 'top-left' },
   ];

   let details = [
      { class: 'edrawtype', hint: '<b>Draw Type</b><p>Define event type as Elimination, Qualification, Round Robin, Consolation, Compass, or Playoff<p>Available options depend on what other events are possible to link; for instance, it is not possible to create a Consolation or Playoff event without an existing Elimination or Qualification event', position: 'top-left' },
   ]

   let opponents = [
      { class: 'event_teams', hint: '<b>Doubles Teams</b><p>Teams are constructed by selecting eligible players IN ORDER', position: 'top-middle' },
   ];

   if (tElement('draw_config')) {
      let draw_config = containers.tournament.draw_config.element;
      config_actions.forEach(action => {
         let element = draw_config.querySelector(`.${action.class}`);
         if (element && element.style.display != 'none') hints.push(hintObj(element, action.hint, action.position));
      });
   }

   if (tElement('detail_fields')) {
      let detail_fields = containers.tournament.detail_fields.element;
      details.forEach(action => {
         let element = detail_fields.querySelector(`.${action.class}`);
         if (element && element.style.display != 'none') hints.push(hintObj(element, action.hint, action.position));
      });
   }

   if (tElement('detail_opponents')) {
      let detail_opponents = containers.tournament.detail_opponents.element;
      opponents.forEach(action => {
         let element = detail_opponents.querySelector(`.${action.class}`);
         if (element && element.style.display != 'none') hints.push(hintObj(element, action.hint, action.position));
      });
   }

   guide.setOptions({ hints });
   guide.addHints();
   guide.showHints();
}

function calendarTour() {
   if (!containers.calendar) return;

   let componentObj = (obj, intro) => ({ element: containers.calendar[obj].element, disableInteraction: true, intro });

   let introduction = [
      { intro: `<b>Tournament Calendar</b><p>View, edit and add tournaments<p>The default view is tournaments for the current month.  If you don't see your tournament, adjust the date range`, },
   ];

   let components = [
      { step: 'start', intro: '<b>Start date</b><p>You can navigate the date picker using arrow keys<p>Quickly select a month or year then click a desired day' },
      { step: 'end', intro: '<b>End date</b><p>You can navigate the date picker using arrow keys<p>Quickly select a month or year then click a desired day' },
      { step: 'category', intro: 'Filter player list by category (Age or Rating)<p>Categories are defined by organization keys' },
      { step: 'add', intro: 'Click to create a new tournament and add it to the calendar' },
   ]
   let header = components.map(component => { if (cVisible(component.step)) return componentObj(component.step, component.intro); }).filter(f=>f);

   let target_classes = [
      { class: 'calendar_highlight', intro: 'Click on a tournament to view it<p>Right click to edit basic tournament details or to delete from the calendar' },
   ]

   let targets = targetClasses('calendar', 'rows', target_classes);

   let steps = introduction.concat(...header, ...targets);

   guide.setOptions({ steps });
   guide.start();
}

function courtsTabTour() {
   if (!containers.tournament) return;

   let componentObj = (obj, intro) => ({ element: containers.tournament[obj].element, disableInteraction: true, intro });

   let steps = [
      { intro: `<b>Courts Tab</b><p>Define locations where tournament matches will be held<p>Specify the number of courts available at each location`, },
   ];

   let classes = [
      { class: 'add', intro: `There must be at least one court location defined in order to schedule matches<p>The <b>Schedule Tab</b> will appear after the first location is defined` },
   ];

   let attr_visible = tElement('location_details');

   let attributes = !attr_visible ? [] : [
      { class: 'locabbr', intro: `The location abbreviation appears at the top of each column in the schedule` },
      { class: 'loccourts', intro: `The number of courts available at a location` },
      { class: 'locids', intro: `By default courts are labeled sequentially:<br> 1, 2, 3, 4, ...<p>Enter any comma or space delimited string to define custom labels` },
      { class: 'locationname', intro: `The location name is used to identify the location in the location list above` },
      { class: 'locaddress', intro: `The location address will be available online to help participants navigate between locations` },
      { class: 'loclatlong', intro: `Location geo coordinates<p> Enter manually or use current location or a google maps link to define<p>Geo location is used both to make directions available to participants and for "geofencing" when crowdsourced scoring is enabled` },
      { class: 'googlemaps', intro: `Enter a Google Maps address (website link) to automatically set a location's geo position` },
      { class: 'geolocation', intro: `Set the geo position for a location to the current location of this computer/tablet` },
   ]

   classes.concat(...attributes).forEach(cobj => {
      let element = tClass({ cls: cobj.class, parent_class: 'courts_tab' });
      if (element) steps.push(introObj(element, cobj.intro, cobj.position));
   });

   let components = [];

   if (attr_visible) components.push({ step: 'location_map', intro: `Map display of current location or currently defined court location<p>Click on the map to define the precise geoposition for a location` });
   if (!attr_visible) components.push({ step: 'locations', intro: 'List of locations available for court scheduling' });
   components.forEach(component => { if (tElement(component.step)) steps.push(componentObj(component.step, component.intro)); });

   guide.setOptions({ steps });
   guide.start();
}

function pointsTabTour() {
   if (!containers.tournament) return;

  let componentObj = (obj, intro) => ({ element: containers.tournament[obj].element, disableInteraction: true, intro });

   let steps = [
      { intro: `<b>Points Tab</b><p>View points awarded for completed matches`, },
   ];

   let class_objs = [
      { class: 'calendar_date', intro: '<b>Point Validity</b><p>Specify a date on which points become valid for rank list calculations' },
      { class: 'filter_m', intro: 'Toggle visibility of points awarded for Male players' },
      { class: 'filter_w', intro: 'Toggle visibility of points awarded for Female players' },
   ]

   class_objs.forEach(cobj => {
      let element = tClass({ cls: cobj.class, parent_class: 'points_tab' });
      if (element) steps.push(introObj(element, cobj.intro, cobj.position));
   });

   let components = [
      { step: 'export_points', intro: '<b>Export Points</b><p>Download points awarded in JSON or CSV format<p>Additional export formats may be added with Configuration Keys' },
   ]
   components.forEach(component => { if (tElement(component.step)) steps.push(componentObj(component.step, component.intro)); });

   guide.setOptions({ steps });
   guide.start();
}

function matchesTabTour() {
   if (!containers.tournament) return;

  let componentObj = (obj, intro) => ({ element: containers.tournament[obj].element, disableInteraction: true, intro });

   let steps = [
      { intro: `<b>Matches Tab</b><p>View completed matches; score and change the status of scheduled and unscheduled matches`, },
   ];

   let class_objs = [
      { class: 'filter_m', intro: 'Toggle visibility of matches played by Male players' },
      { class: 'filter_w', intro: 'Toggle visibility of matches played by Female players' },
   ]

   class_objs.forEach(cobj => {
      let element = tClass({ cls: cobj.class, parent_class: 'matches_tab' });
      if (element) steps.push(introObj(element, cobj.intro, cobj.position));
   });

   let components = [
      { step: 'export_matches', intro: '<b>Export Matches</b><p>Download match records in JSON or CSV format<p>Configuration keys are capable of adding additional download formats' },
   ]
   components.forEach(component => { if (tElement(component.step)) steps.push(componentObj(component.step, component.intro)); });

   let column_headers = [
      { class: 'match_block', intro: '<b>Match Actions</b><p>Click on an individual match row to set Start Time, Finish Time, Match Status, or enter a Score' },
      { class: 'drawsize_header', intro: '<b>Match Round</b><p>Round of a draw in which match occurred' },
      { class: 'status_header', intro: '<b>Match Status</b><p>Whether a match has been called to court, is in progress, or play has been suspended' },
      { class: 'cal_header', intro: '<b>Match Date</b><p>' },
      { class: 'surface_header', intro: '<b>Match Surface</b><p>' },
      { class: 'time_header', intro: '<b>Completion Time</b><p>' },
      { class: 'score_header', intro: '<b>Match Score</b><p>' },
      { class: 'duration_header', intro: '<b>Match Duration</b><p>If start times and finish times have been entered for a match then a match duration is calculated' },
   ]

   if (tElement('matches')) {
      let matches = containers.tournament.matches.element;

      column_headers.forEach(action => {
         let element = matches.querySelector(`.${action.class}`);
         if (element) steps.push(introObj(element, action.intro));
      });
   }

   guide.setOptions({ steps });
   guide.start();
}

function teamsTabTour() {
   if (!containers.tournament) return;

   let componentObj = (obj, intro) => ({ element: containers.tournament[obj].element, disableInteraction: true, intro });

   let overview = [
      { intro: `<b>Teams Tab</b><p>Create and manage teams`, },
   ];

   let adding_players = [
      { intro: `<b>Teams Tab</b><p>Add players to the currently selected team using the multi-function search box at the top of the screen`, },
   ];

   let components = [ { step: 'add_team', intro: 'The first step is to add a team!' }, ]
   let basic = components.map(component => (tVisible(component.step)) ? componentObj(component.step, component.intro) : undefined).filter(f=>f);

   let teams_classes = [
      {
         class: 'team_header',
         intro: '<b>Teams List</b><p>Dashboard view of team details including number of players, number of matches, and matches won/lost'
      },
   ]

   let team_details_classes = [
      { class: 'team_display_name', intro: 'Click to customize team name' },
   ]
   let team_details_actions = [
      { class: 'del', intro: '<b>Delete Team</b><p>Delete the currently selected team' },
      { class: 'done', intro: '<b>Done</b><p>Close team details<p>You can also click on teams in the team list to toggle the detail view' },
   ]
   let teams_list = targetClasses('tournament', 'teams', teams_classes);
   let details = targetClasses('tournament', 'team_details', team_details_classes);
   let actions = targetClasses('tournament', 'team_details', team_details_actions);

   let detail_classes = [
      { class: 'team_rankings', intro: '<b>Team Rankings</b><p>Toggle edit fields to determine player order within teams' },
      { class: 'roster_link', intro: '<b>Roster Link</b><p>Define a Google Sheet URL (web link) to synchronize team players' },
      { class: 'share_team', intro: '<b>Share Team</b><p>Generate a key which will allow the team to be accessed from other instances of CourtHive/TMX' },
   ]

   let detail_actions = detail_classes.map(cobj => {
      let element = tClass({ cls: cobj.class, element_name: 'team_details' });
      if (element) return introObj(element, cobj.intro, cobj.position);
   }).filter(f=>f);

   let players_classes = [
      { class: 'team_players_header', intro: '<b>Team Players</b><p>Right click on a player to delete from the team' }
   ]

   let players_items = [];
   if (tElement('team_details')) {
      let team_details = containers.tournament.team_details.element;

      players_items = players_classes.map(item => {
         let element = team_details.querySelector(`.${item.class}`);
         if (element) return introObj(element, item.intro);
      }).filter(f=>f);
   }

   let steps = [];
   if (details.length) {
      steps = adding_players.concat(...details, ...actions, ...detail_actions, ...players_items);
   } else {
      steps = overview.concat(...basic, ...teams_list);
   }

   guide.setOptions({ steps });
   guide.start();
}

function scheduleTabTour() {
   if (!containers.tournament) return;

   let componentObj = (obj, intro) => ({ element: containers.tournament[obj].element, disableInteraction: true, intro });

   let steps = [
      { intro: `<b>Schedule Tab</b><p>In addition to scheduling matches you can add an umpire, change match status and score matches`, },
   ];

   let components = [ { step: 'schedule_day', intro: '<b>Schedule Day</b><p>Select the day of the tournament to view/edit' }, ];
   components.forEach(component => { if (tElement(component.step)) steps.push(componentObj(component.step, component.intro)); });

   let class_objs = [
      { class: 'schedule_matches', intro: `<b>Schedule Matches</b><p>Toggle Scheduling Mode<p>When activated a list of unscheduled matches is visible and matches can be dragged and dropped into schedule cells` },
      { class: 'schedule_details', intro: `<b>Schedule Details</b><p>Enter Notices (such as weather updates) and Umpire Notes regarding the order of play<p>These details will appear on PDFs as well as CourtHive.com/Live` },
      { class: 'print_schedule', intro: `<b>Generate PDF</b><p>A PDF is generated for the currently selected day of the tournament` },
      { class: 'publish_schedule', intro: `<b>Publish Schedule</b><p>Schedules are instantly available online at CourtHive.com/Live<p>White: Unpublished<br>Blue: Published<br>Yellow: Out of Date` },
   ]

   class_objs.forEach(cobj => {
      let element = tClass({ cls: cobj.class, parent_class: 'schedule_tab' });
      if (element) steps.push(introObj(element, cobj.intro, cobj.position));
   });

   if (tElement('scheduling')) {
      let scheduling = [
         { step: 'event_filter', intro: '<b>Event Filter</b><p>Matches to be scheduled can be filterd by the event in which they occur' },
         { step: 'round_filter', intro: `<b>Round Filter</b><p>Matches to be scheduled can be filtered by the round in which they occur` },
         { step: 'dual_filter', intro: '<b>Dual Matches Filter</b><p>Dual Matches can be filtered by the Teams which are competing' },
         { step: 'order_filter', intro: `<b>Order Filter</b><p>Round Robin matches can be filtered by the order in which they are played` },
         { step: 'autoschedule', intro: `<b>Auto Schedule</b><p>Automatically fills available schedule cells starting with a defined row` },
         { step: 'clearschedule', intro: `<b>Clear Schedule</b><p>Remove scheduled matches<p>Filters can used to clear specific matches` },
         { step: 'unscheduled', intro: `<b>Unscheduled Matches</b><p>Matches can be dragged and dropped into schedule cells<p>Clicking on schedule cells presents a search box which allows matches to be 'pulled' into a cell by typing player names` },
      ]
   scheduling.forEach(component => { if (tElement(component.step)) steps.push(componentObj(component.step, component.intro)); });
   }

   if (tElement('schedule')) {
      let schedule = containers.tournament.schedule.element;

      let byclass = [
         { class: 'oop_round', intro: 'Click in this column to set schedule details for an entire row<p>Schedule details include match times, status, and chair umpire' },
         { class: 'schedule_box', intro: 'When in scheduling mode click on an empty cell to search for matches by player names<p>Clicking on a scheduled match will either launch the scoring dialogue, or allow setting schedule details for a single match, depending on whether Scheduling Mode is active or not<p>Right clicking (or holding the shift key) changes the behavior of clicking on a match (instead of toggling Scheduling Mode)' },
      ]

      byclass.forEach(action => {
         let element = schedule.querySelector(`.${action.class}`);
         if (element) steps.push(introObj(element, action.intro));
      });
   }

   guide.setOptions({ steps });
   guide.start();
}

function drawsTabTour() {
   if (!containers.tournament) return;

   let teams = tElement('teams');

   let componentObj = (obj, intro) => ({ element: containers.tournament[obj].element, disableInteraction: true, intro });

   let steps = [
      { intro: `<b>Draws Tab</b><p>View draws, place players/teams, add scores, print PDFs`, },
   ];

   let components = [
      { step: 'select_draw', intro: '<b>Select Draw</b><p>Drop Down menu to select the draw to view / edit' },
      { step: 'compass_direction', intro: '<b>Compass Direction</b><p>Drop Down menu to view draws for each compass direction' },
      { step: 'recycle', intro: `<b>Regenerate Draw</b><p>Only visible when no scores have yet been entered` },
      { step: 'player_reps', intro: '<b>Player Representatives</b><p>Dialogue to enter names of players who witnessed the draw creation' },
      { step: 'publish_draw', intro: `<b>Publish Draw</b><p>Click to publish to CourtHive.com/Live<p>White: Unpublished<br>Blue: Published<br>Yellow: Out of Date` },
   ]
   components.forEach(component => { if (tElement(component.step)) steps.push(componentObj(component.step, component.intro)); });

   let player_classes = [
      { class: 'print_draw', intro: `<b>Generate PDF</b><p>Context sensitive PDFs<p>Generates printable PDF of the current draw<p>Generates "Player Order" If players/teams have not all been placed<p>Player Order is used to determine player draw positions when drawing numbers randomly` },
   ]

   let team_classes = [
      { class: 'print_draw', intro: `<b>Generate PDF</b><p>Context sensitive PDFs<p>Generates printable PDF of the current draw<p>Generates table of Dual Matches If a team match node has been selected (dual matches are visible)` },
   ]

   let class_objs = teams ? team_classes : player_classes;

   class_objs.forEach(cobj => {
      let element = tClass({ cls: cobj.class, parent_class: 'draws' });
      if (element) steps.push(introObj(element, cobj.intro, cobj.position));
   });

   guide.setOptions({ steps });
   guide.start();
}

function playersTabTour() {
   if (!containers.tournament) return;

   let componentObj = (obj, intro) => ({ element: containers.tournament[obj].element, disableInteraction: true, intro });

   let steps = [
      { intro: `<b>Players Tab</b><p>Add players, edit player details, sign players in; synchronize with various registration systems and databases.`, },
   ];

   let components = [
      { step: 'category_filter', intro: 'Filter player list by category (Age or Rating)<p>Categories are defined by organization keys' },
   ]
   components.forEach(component => { if (tElement(component.step)) steps.push(componentObj(component.step, component.intro)); });

   let class_objs = [
      { class: 'ranking_order', intro: 'Toggle ability to modify player Rankings' },
      { class: 'refresh_registrations', intro: `Import players or synchronize player list with remote registration systems<p>Right click for 'Delete/Replace'` },
      { class: 'reg_link', intro: 'Link player list with a Google Sheet (which can then be synchronized)' },
      { class: 'filter_m', intro: 'Toggle visibility of Male players.<p>Also determines which players are printed on Sign-In Sheets' },
      { class: 'filter_w', intro: 'Toggle visibility of Female players.<p>Also determines which players are printed on Sign-In Sheets' },
      { class: 'print_sign_in', intro: 'Print Singles or Doubles Sign-In Sheets' },
      { class: 'publish_players', intro: 'Publish Player List online' },
   ]

   class_objs.forEach(cobj => {
      let element = tClass({ cls: cobj.class, parent_class: 'players_tab' });
      if (element) steps.push(introObj(element, cobj.intro, cobj.position));
   });

   let context_actions = [
      { class: 'tournamentPlayers', intro: 'Click column header to add tournament players to local database<p>Players are signed-in by clicking<p>Players can also be signed-in or added using the search box (top)<p>Click signed-in players to edit player details, delete, or sign-out' },
      { class: 'rankbyrating', intro: 'Click column header to rank players by their rating' },
      { class: 'playerRanking', intro: 'Click column header to view Doubles rankings' },
   ]

   if (tElement('players')) {
      let players = containers.tournament.players.element;

      context_actions.forEach(action => {
         let element = players.querySelector(`.${action.class}`);
         if (element) steps.push(introObj(element, action.intro));
      });
   }

   guide.setOptions({ steps });
   guide.start();
}

function eventsTabTour() {
   if (!containers.tournament) return;

   let steps = [];
   let teams = tElement('teams');

   let componentObj = (obj, intro) => ({ element: containers.tournament[obj].element, disableInteraction: true, intro });

   let events_tab = [ { intro: `<b>Events Tab</b><p>Create and manage tournament events<p>The draws tab will appear after you create your first event`, }, ];
   let event_details = teams
      ? [ { intro: `<b>Event Details</b><p>Configure events and approve teams`}, ] 
      : [ { intro: `<b>Event Details</b><p>Configure events and approve players`, }, ];

   let components = [ { step: 'events_add', intro: 'Before you can do anything you must add an event' }, ]
   let basic = components.map(component => (tVisible(component.step)) ? componentObj(component.step, component.intro) : undefined).filter(f=>f);

   let sections = teams
      ? [
         { step: 'detail_fields', intro: 'Configure event details, number of event matches, and scoring formats' },
      ]
      : [
         { step: 'detail_fields', intro: 'Filter eligible players, configure event format, scoring format, and draw type' },
         { step: 'draw_config', intro: 'Configure draw structure and link events<p>Events can only be linked when they have the same Gender, Category and Format' }
      ]


   let section_info = sections.map(section => (tElement(section.step)) ? componentObj(section.step, section.intro) : undefined).filter(f=>f);

   let events_classes = [
      {
         class: 'events_header',
         intro: 'Dashboard view of event details including draw size, number of players, total number of matches, scheduled matches, and whether a draw has been generated / published'
      },
      {
         class: 'publish_status',
         intro: 'Publish/Unpublish status<p>Right click header to unpublish all<p>Click individual levents to toggle publishing'
      },
   ]

   let event_details_classes = [
      { class: 'event_name', intro: 'Click to customize event name' },
   ]
   let event_details_actions = [
      { class: 'del', intro: '<b>Delete Event</b><p>Delete the currently selected event' },
      { class: 'done', intro: '<b>Done</b><p>Close event details<p>You can also click on events in the event list to toggle the detail view' },
   ]

   let event_detail_fields = teams ? [] : [
      { class: 'egender', intro: 'Filter eligible players by gender' },
      { class: 'ecategory', intro: 'Filter eligible players by category' },
   ]

   let event_players = [
      { class: 'approved', intro: '<b>Approved Players/Teams<b><p>Players who are approved and will be included in the draw<p>Click to remove players' },
      { class: 'event_teams', intro: '<b>Doubles Teams</b><p>Click on eligible players to build teams.<p>Click on teams to either approve or destroy (send players back to eligible)' },
      { class: 'eligible', intro: '<b>Eligible Players</b><p>Players who are eligible to play the event<p>Click on players to approve or nominate as a wildcard<p>Quickly approve players by holding the Shift key while clicking' },
      { class: 'removeall', intro: '<b>Remove All</b><p>Click to remove all approved players and return them to eligible status' },
      { class: 'addall', intro: '<b>Add All</b><p>Click to promote all players/teams to approved status' },
   ]

   let event_teams = [
      { class: 'tabs', intro: '<b>Configuration Sections</b><p>Opponents: Approve Teams<p>Profile: Match order and point values<p>Points: How match points are calculated to determine the winner' },
   ]

   let st = [
      { class: 'approved', intro: '<b>Approved Teams</b><p>Teams who are approved and will be included in the draw<p>Click to remove teams' },
      { class: 'eligible', intro: '<b>Eligible Teams</b><p>Teams who are eligible to play the event<p>Click on teams to approve' },
      { class: 'removeall', intro: '<b>Remove All</b><p>Click to remove all approved teams and return them to eligible status' },
      { class: 'addall', intro: '<b>Add All</b><p>Click to promote all teams to approved status' },
      { class: 'match_priority', intro: '<b>Match Priority</b><p>Click to edit match point value<p>Click multiple times to cycle through match gender options' },
   ];

   function inSelectedTab(element) { return util.getParent(element, 'tab').classList.contains('selected'); }
   let subtabs = !teams ? [] : targetClasses('tournament', 'event_details', st).filter(s=>inSelectedTab(s.element));

   let event_opponents = teams ? event_teams : event_players;

   let event_list = targetClasses('tournament', 'events', events_classes);
   let details = targetClasses('tournament', 'event_details', event_details_classes);
   let actions = targetClasses('tournament', 'event_details', event_details_actions);
   let detailfields = targetClasses('tournament', 'detail_fields', event_detail_fields);
   let opponents = targetClasses('tournament', 'event_details', event_opponents);

   let class_objs = [
      { class: 'auto_draw', intro: 'Toggle automate draws' },
      { class: 'gem_seeding', intro: 'Enable GEM seeding<p>Seeds will be determined by the ratio of games, sets, and points won in a Round Robin qualifying event' },
      { class: 'ratings_filter', intro: 'Filter eligible players by a rating range' },
   ]

   let detail_icons = class_objs.map(cobj => {
      let element = tClass({ cls: cobj.class, element_name: 'event_details' });
      if (element) return introObj(element, cobj.intro, cobj.position);
   }).filter(f=>f);

   if (details.length) {
      steps = event_details.concat(...opponents, ...subtabs, ...details, ...detail_icons, ...section_info, ...actions);
   } else {
      steps = events_tab.concat(...basic, ...event_list);
   }

   let elements = [];
   elements.forEach(obj => steps.push(introObj(obj.element, obj.intro)));

   guide.setOptions({ steps });
   guide.start();

}

function editIntro() {
   if (!containers.tournament) return;

   let componentObj = (obj, intro) => ({ element: containers.tournament[obj].element, disableInteraction: true, intro });

   let opening = [
      { intro: `<b>Editing Tournaments</b><p>To edit a tournament click on the 'Pencil' icon in the upper right corner`, },
   ];

   let sections = [
      { step: 'edit', intro: '<b>Edit Mode</b><p>Click to enter tournament editing mode' },
   ]
   let section_info = sections.map(section => (tVisible(section.step)) ? componentObj(section.step, section.intro) : undefined).filter(f=>f);

   let steps = opening.concat(...section_info);

   guide.setOptions({ steps });
   guide.start();
}

function tournamentTabTour() {
   if (!containers.tournament) return;

   if (tVisible('edit')) return editIntro();
   // if (containers.tournament.edit.element.style.display != 'none') return editIntro();

   let componentObj = (obj, intro) => ({ element: containers.tournament[obj].element, disableInteraction: true, intro });

   let start_date = containers.tournament.start_date.element;
   let dates = util.getParent(start_date, 'attribute_box');

   let organization = containers.tournament.organization.element;
   let orginfo = util.getParent(organization, 'attribute_box');

   let trny_location = containers.tournament.location.element;
   let umpirebox = util.getParent(trny_location, 'attribute_box');

   let tabs = document.querySelector('.tabs');

   let steps = [
      { intro: `<b>Tournaments Tab</b><p>Add basic tournament details which will appear on PDF headers and online tournament pages<p>Manage copies of the Tournament Record`, },
   ];

   let activated = [];
   if (tElement('notes_entry')) activated.push({ step: 'notes_entry', intro: '<b>Notes Editor</b><p>Formatted text which will appear online beneath the tournament header' });
   if (tElement('social_media')) activated.push({ step: 'social_media', intro: '<b>Social Media Links</b><p>Enter web addresses for social media sites such as Facebook, Twitter and Instgram<p>One web address per line' });
   if (tElement('stat_charts')) activated.push({ step: 'stat_charts', intro: '<b>Tournament Charts</b>Visualizations of data derived from tournament data' });

   let components = [
      { step: 'edit_notes', intro: '<b>Notes Editor</b><p>Click to toggle the WYSIWYG Notes editor. <p>Notes will appear online when a tournament is published' },
      { step: 'stats', intro: '<b>Tournament Statistics</b><p>Click to toggle view analysis of tournament players and matches' },
      { step: 'social', intro: '<b>Social Media</b><p>Click to toggle entry field for defining social media links' },
      { step: 'push2cloud', intro: 'Send a copy of the tournament record to the CourtHive Cloud Server' },
      { step: 'localdownload', intro: 'Save a copy of the tournament record to your computer/tablet' },
      { step: 'pubTrnyInfo', intro: '<b>Publish</b><p>Send Tournament Information to Courthive.com/Live<p>Does not publish events or schedules!' },
      { step: 'authorize', intro: '<b>Authorization</b><p>Unauthorized: <b>Blue</b><p>Authorized: <b>Green</b><p>If you are an Admin you can click to generate authorization keys' },
      { step: 'cloudfetch', intro: '<b>Cloud Fetch</b><p>Download a copy of the tournament record from the CourtHive Cloud Server.<p>Right-click to merge tournament events which have been published.' },
      { step: 'pub_link', intro: '<b>Tournament Link</b><p>Generate a printable QR Code of the Website Address where the tournament can be viewd on Courthive.com/Live' },
      { step: 'delegate', intro: '<b>Delegate</b><p>Delegate control of the tournament to a mobile device.' },
   ]

   let elements = [
      { element: tabs, intro: '<b>Section Tabs</b><p>Select various aspects of the tournament to edit/view<p>Additional tabs become visible as information is added to the tournament<p>For instance, courts must be defined before scheduling is possible' },
   ];

   let attr_visible = tElement('tournament_attrs');
   let details = !attr_visible ? [] : [
      { element: dates, intro: 'Set tournament start and end dates' },
      { element: orginfo, intro: 'Specify and Organization and Organizers' },
      { element: umpirebox, intro: 'Set the Location and Head Umpire' },
   ];

   activated.concat(...components).forEach(component => { if (tElement(component.step)) steps.push(componentObj(component.step, component.intro)); });
   elements.concat(...details).forEach(obj => steps.push(introObj(obj.element, obj.intro)));

   guide.setOptions({ steps });
   guide.start();
}

function tVisible(elem) { return visibleElement('tournament', elem); }
function cVisible(elem) { return visibleElement('calendar', elem); }
function tElement(elem) { return validElement('tournament', elem); }
function sElement(elem) { return validElement('splash', elem); }
function visibleElement(obj, elem) { return containers[obj][elem] && containers[obj][elem].element && containers[obj][elem].element.style.display != 'none'; }
function validElement(obj, elem) { return visibleElement(obj, elem) && containers[obj][elem].element.innerHTML; }
function tClass({ cls, element_name, parent_class }) {
   let root = element_name && tElement(element_name) ? containers.tournament[element_name].element : parent_class ? document.querySelector(`.${parent_class}`) : document;
   let element = (cobjs.tournament[cls] && root.querySelector(`.${cobjs.tournament[cls]}`)) || (parent_class  && root.querySelector(`.${cls}`));
   return element && element.style.display != 'none' ? element : undefined;
}
function introObj(element, intro, position) { return { element, disableInteraction: true, intro, position } };
function hintObj(element, hint, position='top-middle') { return { element, hint, hintPosition: position } };

function targetClasses(obj, element_name, targets) {
   let steps = [];
   if (validElement(obj, element_name)) {
      let element = containers[obj][element_name].element;
      targets.forEach(target => {
         let target_element = element.querySelector(`.${target.class}`);
         if (target_element && target_element.style.display != 'none') steps.push(introObj(target_element, target.intro));
      });
   }
   return steps;
}
