import { db } from './db';

export const lang = function() {

   let lang = {};
   let idioms = {};
   let selected_ioc = 'gbr';

   lang.define = ({ ioc, idiom }) => { idioms[ioc] = idiom; };

   lang.set = (new_ioc) => {
      if (!new_ioc) return selected_ioc;
      if (!idioms[new_ioc]) return;
      updateDefault(new_ioc);
      if (idioms[new_ioc] && idioms[new_ioc].locale) d3.timeFormatDefaultLocale(idioms[new_ioc].locale);
      return true;
   };

   function updateDefault(ioc='gbr') {
      selected_ioc = ioc;
      var idiom = {
         "key": "defaultIdiom",
         "class": "userInterface",
         "ioc": ioc
      };
      db.addSetting(idiom);
   }

   lang.options = () => Object.keys(idioms);

   function translate(what) {
      if (!what) return '';
      let obj = idioms[selected_ioc];
      let children = what.split('.');
      while (children.length) {
         let child = children.shift();
         obj = obj && obj[child] || '';
      }
      return obj;
   }

   // fall back to English if not found in idiom
   lang.tr = (what) => {
      if (!what) return '';
      if (translate(what)) return translate(what);
      let obj = idioms.default;
      let children = what.split('.');
      while (children.length) {
         let child = children.shift();
         obj = obj && obj[child] || '';
      }
      return obj;
   };

   lang.obj = (what) => {
      if (!what) return "";
      if (idioms[selected_ioc] && idioms[selected_ioc][what]) return idioms[selected_ioc][what];
      if (idioms.default[what]) return idioms.default[what];
      return {};
   };

   idioms.default = {
      admin:    'Administrator',
      revoke:   'Revoke',
      tour:     'Tour',
      noresults: 'No Results',
      delete:  'Delete',
      continue:'Do you wish to continue?',
      notes:   'Notes',
      social:  'Social Media',
      stats:   'Statistics',
      merge:   'Merge',
      week:    'Week',
      warn:    'WARNING',
      ptz:     'Penalties',
      replace: 'Replace',
      dl:      'Download',
      or:      'or',
      arp:     'All Ranking Points',
      rlp:     'Points - Ranking Lists',
      trn:     'Tournament',
      rnd:     'Round',
      dt:      'Date',
      fmt:     'Format',
      cat:     'Category',
      cta:     'Cat.',
      tmz:     'Teams',
      dlm:     'Dual Matches',
      rnk:     'Rank',
      rnkz:    'Rankings',
      rtg:     'Rating',
      rtz:     'Ratings',
      prnk:    'Rank',           // player rank
      trnk:    'Rank',           // tournament rank
      rl:      'Rank List',
      opnt:    'Opponent',
      ply:     'Player',
      pyr:     'Players',
      add:     'Add',
      sgi:     'Sign-In',
      sgo:     'Sign-Out',
      scr:     'Score',
      pts:     'Points',
      mts:     'Matches',
      emts:    'Matches',
      ests:    'Sets',
      egms:    'Games',
      epts:    'Points',
      mtc:     'Match',
      drw:     'Draw',
      drz:     'Draws',
      ent:     'Event',
      evt:     'Events',
      sch:     'Schedule',
      crt:     'Courts',
      id:      'ID',
      nm:      'Name',
      fnm:     'First Name',
      lnm:     'Last Name',
      bd:      'Birthday',
      yr:      'Year',
      byr:     'Year',
      tot:     'Total',
      sgl:     'Singles',
      dbl:     'Doubles',
      pyo:     'Playoff',
      snr:     'Senior',
      unk:     'Unknown',
      dup:     'Duplicate',
      stt:     'Status',
      ord:     'Order',
      clb:     'Club',
      scl:     'School',
      cty:     'City',
      cnt:     'Country',
      kwn:     'Known',
      ioc:     'IOC',
      act:     'Action',
      agd:     'Assigned',
      igr:     'Ignore',
      igd:     'Ignored',
      edt:     'Edit Player',
      idp:     'Identify Player',
      dlp:     'Delete Player',
      sbt:     'Submit',
      ccl:     'Cancel',
      clr:     'Clear',
      und:     'Undo',
      apt:     'Accept',
      dss:     'Dismiss',
      frm:     'From',
      to:      'To',
      h2h:     'Head-to-Head',
      reg:     'Registered',
      gdr:     'Gender',
      dtp:     'Draw Type',
      drp:     'Draw Position',
      adr:     'Automated Draw',
      mdo:     'Draw Order',
      phn:     'Phone',
      email:   'Email',
      asn:     'Association',
      start:   'Start',
      end:     'End',
      dates:   'Dates',
      ref:     'Referee',

      // this elment is duplicated/overloaded, but it works...
      scoring: 'Scoring',

      time:    'Time',
      duration:'Duration',
      qualifier: 'Qualifier',
      qualifiers: 'Qualifiers',
      none:    'None',
      keys:    'Keys',
      pos:     'Position',
      new:     'New',
      inout:   'In/Out',
      indoors: 'Indoors',
      outdoors:'Outdoors',
      existing: 'Existing',
      success: 'Success',
      loading: 'Loading',

      set: 'Settings',
      version: 'Version',
      messages: 'Messages',
      support: 'Support',
      datastorage: 'Data Storage',
      releasenotes: 'Release Notes',
      documentation: 'Documentation',
      importexport: 'Import / Export',
      newversion: 'New Version Available',

      i18n: {
          previousMonth : 'Previous Month',
          nextMonth     : 'Next Month',
          months        : ['January','February','March','April','May','June','July','August','September','October','November','December'],
          weekdays      : ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],
          weekdaysShort : ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
      },

      settings: {
         help: 'Help',
         schedule: 'Schedule',
         calendar: 'Calendar',
         search: 'Search',
         documentation: 'Documentation Links',
         hoverhelp: 'Hover Hints',
         diacritics: 'Diacritics',
         lastfirst: 'Last name, First name',
         organization: 'Organization',
         general: 'General',
         categories: 'Categories',
         points: 'Points',
         draws: 'Draws',
         data: 'Data',
         sheetdata: 'Sheet Data',
         publishing: 'Publishing',
         printing: 'Printing',
         savepdfs: 'Save PDFs',
         compresseddraws: 'Compressed Draw Formats',
         countryflags: 'Country Flags Displayed',
         requireconfirm: 'Require Confirmation',
         publishonscore: 'Publish when score entered',
         publishdrawcreation: 'Publish as draw created',
         matchesbefore: 'Matches Before Count',
         automatedbyes: 'Automatic Bye Placement',
         llallrounds: 'LL from All Qualifying Rounds',
         rrh2hpriority: 'RR Head-to-Head priority',
         qualconsolation: 'Qualifying Consolation',
         consolationalts: 'Consolation Alternates',
         consolationseeds: 'Consolation Seeding',
         restrictseedplacement: 'Restrict Seed Placement',
         separate_by_ioc: 'Auto Separate Players by Country',
         separate_by_club: 'Auto Separate Players by Club',
         separate_by_school: 'Auto Separate Players by School',
         fixedbyes: 'Fixed Bye Order',
         courtdetail: 'Court Details',
         matchtimes: 'Match Times',
         matchdates: 'Match Dates',
         firstday: 'Week Starts Monday',
         time24: '24 Hour Clock',
         draworderscores: 'Scores in Draw Order',
         schedulecompleted: 'Schedule Completed Matches'
      },

      round_names: {
         F: 'Final',
         SF: 'Semifinal',
         QF: 'Quarterfinal'
      },

      search: {
         players: 'Search Players',
         tournaments: 'Search Tournaments',
         clubs: 'Search Clubs',
         approve: 'Approve Player',
         add2team: 'Add Team Player',
         lastfirst: 'LAST First',
         firstlast: 'First Last'
      },

      formats: {
         singles: 'Singles',
         doubles: 'Doubles',
         team: 'Team'
      },

      scoring_format: {
         bestof: 'Best of',
         tbat: 'TB at',
         finalset: 'Final Set',
         setsto: 'Sets to',
         tbto: 'TB to',
         superto: 'To'
      },

      // eslint-disable-next-line no-dupe-keys
      scoring: {
         retire: 'Retire',
         default: 'Default',
         walkover: 'Walkover',
         supertiebreak: 'Supertiebreak',
         normal: 'Normal'
      },

      draws: {
         gemseeding: 'GEM Seeding',
         playerfilter: 'Ratings Filter',
         compass: 'Compass',
         north: 'North',
         south: 'South',
         east: 'East',
         west: 'West',
         northeast: 'Northeast',
         northwest: 'Northwest',
         southeast: 'Southeast',
         southwest: 'Southwest',
         feedin: 'Feed-in',
         staggered: 'Staggered',
         standard: 'Standard',
         roundlimit: 'Round Limit',
         structure: 'Structure',
         skiprounds: 'Skip Rounds',
         feedrounds: 'Feed Rounds',
         sequential: 'Sequential',
         brackets: 'Brackets',
         bracketsize: 'Bracket Size',
         roundrobin: 'Round Robin',
         elimination: 'Elimination',
         dualmatches: 'Dual Matches',
         consolation: 'Consolation',
         qualification: 'Qualification',
         preround: 'Pre-Round',
         incidentals: 'Incidentals',
         remove: 'Remove',
         changestatus: 'Change Status',
         penalty: 'Assess Penalty',
         umpire: 'Select Referee',
         matchumpire: 'Match Referee',
         matchtime: 'Match Time',
         starttime: 'Start Time',
         endtime: 'Finish Time',
         resttime: 'Rest Time',
         duration: 'Duration',
         timeheader: 'Time Heading',
         maindraw: 'Main Draw',
         unscheduled: 'Unscheduled Matches',
         scheduled: 'Scheduled Matches',
         completed: 'Completed',
         unpublished: 'Unpublished',
         publisheduptodate: 'Up to Date',
         publishedoutofdate: 'Out of Date',
         published: 'Published',
         publish: 'Publish',
         publishQ: 'Publish Draw?',
         organizers: 'Organizers',
         playerrep: 'Representative',
         playerreps: 'Representatives',
         substitutes: 'Substitutes (LL/Alts)',
         allindraw: 'all in draw',
         lastdirectaccept: 'Last Direct Acceptance',
         clear: 'Clear Draw',
         swap: 'Swap Position',
         alternate: 'Alternate',
         luckyloser: 'Lucky Loser',
         first: 'First',
         last: 'Last',
         seedrange: 'Seeds',
         playerrange: 'All Players',
         unpublish: 'Unpublish Draw',
         unpublishall: 'Unpublish All Events'
      },

      print: {
         schedule: 'Schedule',
         draw: 'Print',
         signin: 'Sign-In Sheet',
         ranklist: 'Rank List',
         playerlist: 'Player List'
      },

      teams: {
         name: 'Name',
         share: 'Share Team',
         rankings: 'Team Rankings',
         members: 'Members',
         matches: 'Matches',
         winloss: 'Won/Lost',
         newteam: 'New Team',
         createnew: 'Create New',
         submitkey: 'Submit Key',
         nameorkey: 'Team Name or Import Key',
         club: 'Club',
         coaches: 'Coaches',
         school: 'School',
         ioc: 'Country',
         abbreviation: 'Abbreviation'
      },

      tournament: {
         organizer_email: 'Organizer Email',
         organizer_phone: 'Organizer Phone',
         judge_email: 'Referee Email',
         judge_phone: 'Referee Phone',
         sponsor: 'Sponsor(s)',
         logo: 'Tournament Logo',
         images: 'Tournament Images'
      },

      tournaments: {
         type: 'Type',
         standard: 'Standard',
         dualmatches: 'Dual Matches',
         register: 'Register',
         registration: 'Registration Link',
         team: 'Team Tournament',
         new: 'New Tournament',
         add: 'Add Tournament',
         id: 'Tournament ID',
         loadbyid: 'Load by ID',
         edit: 'Edit',
         close: 'Close',
         done: 'Finish',
         import: 'Import Record',
         removeall: 'Remove All',
         addall: 'Add All',
         key: 'Authorization',
         noauth: 'Not Authorized',
         unofficial: 'Unofficial',
         auth: 'Authorized',
         fetch: 'Download',
         fetchtournament: 'Download Tournament Record',
         mergeevents: 'Merge Events from server',
         renewlist: 'Renew List',
         natlassoc: 'National Association',
         tennisclub: 'Tennis Club',
         received: 'Received Tournament Record',
         publishtime: 'Publish Time',
         replacelocal: 'Replace Local Copy?',
         unpublish: 'Unpublish Tournament?'
      },

      ddlb: {
         singles:  'Singles Tournament Rank:',
         doubles:  'Doubles Tournament Rank:',
         category: 'Tournament Category:',
         draws:    'Select Event:',
         direction: 'Select Draw:'
      },

      phrases: {
         mainmenu: 'Main Menu',
         sheetdataurls: 'Enter Google Sheet URLs for Synchronizing Data',
         playerimport: 'Player Import',
         entersheeturl: 'Enter Sheet URL',
         entergooglemapsurl: 'Enter Google Maps Link',
         invalidurl: 'Invalid URL(s)',
         invalidsheeturl: 'Invalid Sheet URL',
         invalidgooglemapsurl: 'Invalid Google Maps Link',
         geolocationdenied: 'Geolocation has been denied',
         unblockgeo: 'Unblock in browser settings',
         usecurrentlocation: 'Use your current position?',
         updatelatlng: 'Update Latitude/Longitude?',
         cleardraw: 'Existing Draw will be cleared!',
         clearselection: 'Clear Selection',
         selectplayer: 'Select Player',
         matches2clear: 'Matches to be cleared from the schedule',
         changeapproved: 'Changing Approved will reset the draw and clear the schedule.',
         qualincomplete: 'Qualifying Draw is Incomplete',
         delegate: 'Delegate',
         delegate2mobile: 'Delegate to Mobile',
         revokedelegation: 'Revoke Delegation',
         delegationrevoked: 'Delegation has been revoked',
         qrcode: 'QR Code',
         scanQRcode: 'Scan QR Code with Mobile',
         ranklists: 'Rank Lists for',
         reset: 'Database will be reset',
         action: 'Players requiring some action...',
         search: 'Use the search field above to find players, or click player to edit',
         assign: 'Assign this profile by clicking a player below, or ...',
         accept: 'Accept all players',
         trnyz:  'Loading Tournaments ...',
         loadplayers:  'Load Players',
         badfile: 'File Not Recognized',
         invalid: 'Invalid file type',
         fileerror: 'Error reading file',
         servererror: 'Error Message from Server',
         notfound: 'Not Found',
         pointcalc: 'Point calculation requires tournament category and rank',
         drawcreated: 'Draw Created',
         drawactive: 'Active Draw',
         notcreated: 'Not Created',
         importdata: 'Import Data',
         exportdata: 'Export Data',
         importtemplate: 'Import Template',
         draganddrop: 'Drag and Drop files into this zone',
         schedulematches: 'Schedule Matches',
         notconfigured: 'Not Configured',
         cannotsignout: 'Cannot Sign Out',
         cannotchangerank: 'Cannot Change Rank',
         cannotchangewinner: 'Cannot Change Winner',
         matchmustbecomplete: 'Match Must Be Complete!',
         approvedplayer: 'Player Approved for an Event',
         locallycreated: 'Locally Created Tournament',
         noremote: 'No Remote Registrations to Update',
         calculateranking: 'Calculate Ranking Points',
         generateranklist: 'Generate Rank List',
         generatekey: 'Generate Key',
         norankingdata: 'No Ranking Data',
         oop_system: 'Order of Play',
         schedulepublished: 'Publishing Time:',
         timestamp: 'Date/Time: ',
         rankedplayers: 'Ranked Players',
         judgesignature: 'Signature of Head Umpire:',
         nopointcalcs: 'No Point Calculations for given date',
         downloadtemplate: 'Download Import Template',
         add2database: 'Add Players, Tournaments, Rankings to Database',
         noconnection: 'No Connection',
         schedulepriority: 'Match Scheduling Priority',
         send: 'Send',
         export: 'Export',
         pointsvalidfrom: 'Points Valid From',
         linkcopied: 'Link Copied to Clipboard',
         keycopied: 'Key Copied to Clipboard',
         submitkey: 'Enter New Key',
         selectkey: 'Select Key',
         deletereplace: 'Delete / Replace',
         weblink: 'Web Link',
         nomatches: 'No Matches',
         updatedioc: 'Update Language File',
         revokeauth: 'Revoke Authorization?',
         clearalldays: 'Clear All Days?',
         cantdelqual: 'Cannot Delete: Qualified Player Active in Main Draw',
         cantrefresh: 'Offline: Cannot Refresh',
         blocked:'Pop-Up Windows are blocked by your browser',
         enablepopups: 'Please enable Pop-Ups for PDF printing',
         nopersist: 'Data Persistence not guaranteed'
      },

      events: {
         name: 'Name',
         newevent: 'New Event',
         teamevent: 'Team Event',
         opponents: 'Opponents',
         teams: 'Teams',
         draw_type: 'Draw Type',
         draw_size: 'Draw Size',
         created: 'Created',
         category: 'Category',
         rank: 'Rank',
         surface: 'Surface',
         approveteam: 'Approve',
         destroyteam: 'Destroy',
         approved: 'Approved',
         eligible: 'Eligible',
         ineligible: 'Ineligible',
         unavailable: 'Unavailable',
         wildcard: 'Wildcard',
         received: 'Received Event(s)',
         toggle: 'Toggle Publish State?'
      },

      locations: {
         newlocation: 'New Location',
         abbreviation: 'Abbr.',
         name: 'Name',
         address: 'Address',
         courts: 'Courts',
         identifiers: 'Court IDs'
      },

      genders: {
         male: 'Male',
         male_abbr: 'M',
         female: 'Female',
         female_abbr: 'W',
         mixed: 'Mixed'
      },

      surfaces: {
         clay: 'Clay',
         hard: 'Hard',
         grass: 'Grass',
         carpet: 'Carpet'
      },

      actions: {
         ok: 'OK',
         add_event: 'Add Event',
         save_event: 'Save Event',
         save_team: 'Save Team',
         save_location: 'Save Location',
         done: 'Done',
         cancel: 'Cancel',
         refresh: 'Refresh',
         delete_event: 'Delete Event',
         delete_team: 'Delete Team',
         add_player: 'Add Player',
         add_team: 'Add Team',
         publish: 'Publish',
         unpublish: 'Unpublish',
         manage_players: 'Manage Players',
         manage_teams: 'Manage Teams',
         add_location: 'Add Location',
         delete_location: 'Delete Location',
         delete_tournament: 'Delete Tournament',
         edit_tournament: 'Edit Tournament'
      },

      requests: {
         syncClubs: 'Synchronize Clubs',
         syncTournaments: 'Synchronize Tournaments',
         syncPlayers: 'Synchronize Players'
      },

      signin: {
         tournament_date: 'Start Date',
         organization: 'Organization',
         place: 'Location',
         id: 'Tournament ID',
         rank: 'Tournament Rank',
         judge: 'Head Umpire',
         doc_name: 'SIGN-IN SHEET',
         doc_subname: ' ',
         signature: 'Signature',
         registered: 'Registered Players',
         notsignedin: 'Not Signed In',
         signedin: 'Signed In',
         withdrawn: 'Withdrawn',
         medical: 'Medical',
         registration: 'Registration',
         medical_issues: 'Medical Expired',
         create_new_player: 'Create New',
         modifyrankings: 'Modify Rankings',
         reglink: 'Set Link'
      },

      schedule: {
         column: 'Column',
         rows: 'Schedule Rows',
         startrow: 'Start Row',
         allevents: 'All Events',
         allrounds: 'All Rounds',
         allcourts: 'All Courts',
         alldual: 'All Dual Matches',
         autoschedule: 'Auto Schedule',
         limit: 'Limit',
         clearschedule: 'Clear Schedule',
         orderofplay: 'ORDER OF PLAY',
         matchestime: 'Matches => Time', 
         notbefore: 'Not Before',
         nb: 'NB',
         followedby: 'Followed By',
         afterrest: 'After Rest',
         tba: 'TBA',
         nextavailable: 'Next Available',
         called: 'Called',
         oncourt: 'On Court',
         warmingup: 'Warming Up',
         suspended: 'Suspended',
         raindelay: 'Rain Delay',
         clear: 'Clear',
         publish: 'Publish Schedule',
         unpublish: 'Unpublish Schedule',
         timing: 'Timing',
         vs: 'vs.',
         umpirenotes: 'Umpire Notes (PDF Footer)',
         notice: 'Schedule Notice (PDF Header)',
         opponentname: 'Opponent Name',
         scheduled: 'Scheduled'
      },
      
      refresh: {
         general: 'Refresh',
         roster: 'Updating Team Roster...',
         registered: 'Updating Registered Players...',
         players: 'Updating Players...',
         calendar: 'Updating Calendar...',
         clubs: 'Updating Clubs...'
      },

      penalties: {
         fail2signout: 'Failed to Sign Out',
         illegalcoaching: 'Illegal Coaching',
         ballabuse: 'Ball Abuse',
         racquetabuse: 'Racquet Abuse',
         equipmentabuse: 'Equipment Abuse',
         cursing: 'Swearing',
         rudegestures: 'Rude Gestures',
         foullanguage: 'Foul Language',
         timeviolation: 'Time Violation',
         latearrival: 'Late Arrival',
         unsporting: 'Unsporting Behavior'
      },

      // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toLocaleDateString
      datelocalization: 'en-EN'
   };

   return lang;

}();
