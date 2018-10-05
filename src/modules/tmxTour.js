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

   fx.hideHints = () => { guide.hideHints(); }

   fx.splashContainer = (container) => { containers.splash = container; }
   fx.tournamentContainer = (container, classes) => {
      containers.tournament = container;
      cobjs.tournament = classes;
   }
   fx.calendarContainer = (container) => { containers.calendar = container; }

   fx.tournamentTours = (context) => {
      if (context == 'tournament_tab') return tournamentTabTour();
      if (context == 'events_tab') return eventsTabTour();
      if (context == 'players_tab') return playersTabTour();
      if (context == 'calendar') return calendarTour();
   }
   fx.tournamentHints = (context) => {
      if (context == 'events_tab') return eventsTabHints();
      if (context == 'players_tab') return playersTabHints();
   }

   fx.splashHints = () => {
   }

   fx.splashTour = () => {
      if (!containers.splash) return;

      let componentObj = (obj, intro, position='bottom') => ({ element: containers.splash[obj].element, disableInteraction: true, intro, position });

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
      components.forEach(component => { if (sElement(component.step)) steps.push(componentObj(component.step, component.intro)); });

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
   let header = components.map(component => { if (cElement(component.step)) return componentObj(component.step, component.intro); }).filter(f=>f);

   let target_classes = [
      { class: 'calendar_highlight', intro: 'Click on a tournament to view it<p>Right click to edit basic tournament details or to delete from the calendar' },
   ]

   let targets = targetClasses('calendar', 'rows', target_classes);

   let steps = introduction.concat(...header, ...targets);

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
      { class: 'print_sign_in', intro: 'Print Singles or Doubles Sign-In Sheets' },
      { class: 'filter_m', intro: 'Toggle visibility of Male players.<p>Also determines which players are printed on Sign-In Sheets' },
      { class: 'filter_w', intro: 'Toggle visibility of Female players.<p>Also determines which players are printed on Sign-In Sheets' },
      { class: 'ranking_order', intro: 'Toggle ability to modify player Rankings' },
      { class: 'refresh_registrations', intro: `Import players or synchronize player list with remote registration systems<p>Right click for 'Delete/Replace'` },
      { class: 'reg_link', intro: 'Link player list with a Google Sheet (which can then be synchronized)' },
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

   let componentObj = (obj, intro) => ({ element: containers.tournament[obj].element, disableInteraction: true, intro });

   let events_tab = [ { intro: `<b>Events Tab</b><p>Create and manage tournament events<p>The draws tab will appear after you create your first event`, }, ];
   let event_details = [ { intro: `<b>Event Details</b><p>Configure events and approve players`, }, ];

   let components = [ { step: 'events_add', intro: 'Before you can do anything you must add an event' }, ]
   let basic = components.map(component => (tElement(component.step)) ? componentObj(component.step, component.intro) : undefined).filter(f=>f);

   let sections = [
      { step: 'detail_fields', intro: 'Filter eligible players, configure event format, scoring format, and draw type' },
      { step: 'draw_config', intro: 'Configure draw structure and link events<p>Events can only be linked when they have the same Gender, Category and Format' },
   ]
   let section_info = sections.map(section => (tElement(section.step)) ? componentObj(section.step, section.intro) : undefined).filter(f=>f);

   let events_classes = [
      {
         class: 'events_header',
         intro: 'Dashboard view event details including draw size, number of players, number of matches, scheduled matches, and whether a draw has been generated / published'
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
      { class: 'del', intro: 'Delete Event' },
      { class: 'done', intro: 'Close event details<p>You can also click on events in the event list to toggle the detail view' },
   ]
   let event_detail_fields = [
      { class: 'egender', intro: 'Filter eligible players by gender' },
      { class: 'ecategory', intro: 'Filter eligible players by category' },
   ]
   let event_opponents = [
      { class: 'approved', intro: 'Players who are approved and will be included in the draw<p>Click to remove players' },
      { class: 'event_teams', intro: 'Click on eligible players to build teams.<p>Click on teams to either approve or destroy (send players back to eligible)' },
      { class: 'eligible', intro: 'Players who are eligible to play the event<p>Click on players to approve or nominate as a wildcard<p>Quickly approve players by holding the Shift key while clicking' },
      { class: 'removeall', intro: 'Click to remove all approved players and return them to eligible status' },
      { class: 'addall', intro: 'Click to promote all players/teams to approved status' },
   ]

   let event_list = targetClasses('tournament', 'events', events_classes);
   let details = targetClasses('tournament', 'event_details', event_details_classes);
   let actions = targetClasses('tournament', 'event_details', event_details_actions);
   let detailfields = targetClasses('tournament', 'detail_fields', event_detail_fields);
   let players = targetClasses('tournament', 'event_details', event_opponents);

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
      steps = event_details.concat(...details, ...detail_icons, ...actions, ...section_info, ...players);
   } else {
      steps = events_tab.concat(...basic, ...event_list);
   }

   let elements = [];
   elements.forEach(obj => steps.push(introObj(obj.element, obj.intro)));

   guide.setOptions({ steps });
   guide.start();

}

function tournamentTabTour() {
   if (!containers.tournament) return;

   let componentObj = (obj, intro) => ({ element: containers.tournament[obj].element, disableInteraction: true, intro });

   let start_date = containers.tournament.start_date.element;
   let dates = util.getParent(start_date, 'attribute_box');

   let organization = containers.tournament.organization.element;
   let orginfo = util.getParent(organization, 'attribute_box');

   let trny_location = containers.tournament.location.element;
   let umpirebox = util.getParent(trny_location, 'attribute_box');

   let steps = [
      { intro: `<b>Tournaments Tab</b><p>Add basic tournament details which will appear on PDF headers and online tournament pages<p>Manage copies of the Tournament Record`, },
      {
         element: containers.tournament.edit_notes.element,
         disableInteraction: true,
         intro: '<b>Notes Editor</b><p>Click to toggle the WYSIWYG Notes editor. <p>Notes will appear online when a tournament is published.',
      },
   ];

   let components = [
      { step: 'push2cloud', intro: 'Send a copy of the tournament record to the CourtHive Cloud Server' },
      { step: 'localdownload', intro: 'Save a copy of the tournament record to your computer/tablet' },
      { step: 'pubTrnyInfo', intro: '<b>Publish</b><p>Send Tournament Information to Courthive.com/Live<p>Does not publish events or schedules!' },
      { step: 'authorize', intro: '<b>Authorization</b><p>Unauthorized: <b>Blue</b><p>Authorized: <b>Green</b><p>If you are an Admin you can click to generate authorization keys' },
      { step: 'cloudfetch', intro: '<b>Cloud Fetch</b><p>Download a copy of the tournament record from the CourtHive Cloud Server.<p>Right-click to merge tournament events which have been published.' },
      { step: 'publink', intro: '<b>Tournament Link</b><p>Generate a printable QR Code of the Website Address where the tournament can be viewd on Courthive.com/Live' },
      { step: 'delegate', intro: '<b>Delegate</b><p>Delegate control of the tournament to a mobile device.' },
   ]

   let elements = [
      { element: dates, intro: 'Set tournament start and end dates' },
      { element: orginfo, intro: 'Specify and Organization and Organizers' },
      { element: umpirebox, intro: 'Set the Location and Head Umpire' },
   ];

   components.forEach(component => { if (tElement(component.step)) steps.push(componentObj(component.step, component.intro)); });
   elements.forEach(obj => steps.push(introObj(obj.element, obj.intro)));

   guide.setOptions({ steps });
   guide.start();
}

function cElement(elem) { return validElement('calendar', elem); }
function tElement(elem) { return validElement('tournament', elem); }
function sElement(elem) { return validElement('splash', elem); }
function validElement(obj, elem) {
   return containers[obj][elem] && containers[obj][elem].element && containers[obj][elem].element.style.display != 'none'; 
}
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

