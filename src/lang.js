!function() {

   let lang = {};
   let idioms = {};
   let selected_ioc = 'gbr';

   lang.define = ({ ioc, idiom }) => { idioms[ioc] = idiom; }

   lang.set = (new_ioc) => {
      if (!new_ioc) return selected_ioc;
      if (!idioms[new_ioc]) return;
      updateDefault(new_ioc);
      if (idioms[new_ioc] && idioms[new_ioc].locale) d3.timeFormatDefaultLocale(idioms[new_ioc].locale);
      return true;
   }

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
   }

   lang.obj = (what) => {
      if (!what) return "";
      if (idioms[selected_ioc] && idioms[selected_ioc][what]) return idioms[selected_ioc][what];
      if (idioms.default[what]) return idioms.default[what];
      return {};
   }

   idioms.default = {
      dl:      'Download',
      or:      'or',
      arp:     'All Ranking Points',
      act:     'Actual',
      rlp:     'Points - Ranking Lists',
      trn:     'Tournament',
      rnd:     'Round',
      dt:      'Date',
      fmt:     'Format',
      cat:     'Category',
      cta:     'Cat.',
      rnk:     'Rank',
      rl:      'Rank List',
      ply:     'Player',
      pyr:     'Players',
      add:     'Add',
      sgi:     'Sign-In',
      sgo:     'Sign-Out',
      scr:     'Score',
      pts:     'Points',
      mts:     'Matches',
      mtc:     'Match',
      drw:     'Draw',
      drz:     'Draws',
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
      qal:     'Qualifying',
      rrb:     'Round Robin',
      snr:     'Senior',
      unk:     'Unknown',
      dup:     'Duplicate',
      stt:     'Status',
      ord:     'Order',
      clb:     'Club',
      cty:     'City',
      cnt:     'Country',
      kwn:     'Known',
      ioc:     'IOC',
      act:     'Action',
      agd:     'Assigned',
      igr:     'Ignore',
      igd:     'Ignored',
      edt:     'Edit Player',
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
      ref:     'Referee',
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

      set: 'Settings',
      version: 'Version',
      newversion: 'New Version Available',
      importexport: 'Import / Export',

      i18n: {
          previousMonth : 'Previous Month',
          nextMonth     : 'Next Month',
          months        : ['January','February','March','April','May','June','July','August','September','October','November','December'],
          weekdays      : ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],
          weekdaysShort : ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
      },

      settings: {
         organization: 'Organization',
         general: 'General',
         categories: 'Categories',
         points: 'Points',
         draws: 'Draws',
         data: 'Data',
         publishing: 'Publishing',
         compresseddraws: 'Compressed Draw Formats',
         countryflags: 'Country Flags Displayed',
         requireconfirm: 'Require Confirmation',
         publishonscore: 'Publish when score entered',
         matchesbefore: 'Matches Before Count',
         automatedbyes: 'Automatic Bye Placement',
         courtdetail: 'Court Details',
         firstday: 'Week Starts Monday',
      },

      search: {
         players: 'Search Players',
         tournaments: 'Search Tournaments',
         clubs: 'Search Clubs',
         approve: 'Approve Players',
         lastfirst: 'LAST First',
         firstlast: 'First Last',
      },

      formats: {
         singles: 'Singles',
         doubles: 'Doubles',
         team: 'Team',
      },

      draws: {
         feedin: 'Feed-in',
         standard: 'Standard',
         structure: 'Structure',
         brackets: 'Brackets',
         bracketsize: 'Bracket Size',
         roundrobin: 'Round Robin',
         elimination: 'Elimination',
         consolation: 'Consolation',
         qualification: 'Qualification',
         remove: 'Remove',
         changestatus: 'Change Status',
         penalty: 'Assess Penalty',
         umpire: 'Select Referee',
         matchumpire: 'Match Referee',
         matchtime: 'Match Time',
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
         unpublishall: 'Unpublish All Events',
      },

      print: {
         schedule: 'Schedule',
         draw: 'Print',
         signin: 'Sign-In Sheet',
         ranklist: 'Rank List',
      },

      tournaments: {
         new: 'New Tournament',
         add: 'Add Tournament',
         id: 'Tournament ID',
         edit: 'Edit',
         done: 'Finish',
         removeall: 'Remove All',
         addall: 'Add All',
         key: 'Authorize',
         noauth: 'Not Authorized',
         unofficial: 'Unofficial',
         auth: 'Authorized',
         fetch: 'Download',
         renewlist: 'Renew List',
         natlassoc: 'National Association',
         tennisclub: 'Tennis Club',
         received: 'Received Tournament Record',
         publishtime: 'Publish Time',
         replacelocal: 'Replace Local Copy?',
      },

      ddlb: {
         singles:  'Singles Tournament Rank:',
         doubles:  'Doubles Tournament Rank:',
         category: 'Tournament Category:',
         draws:    'Select Event:',
      },

      phrases: {
         action: 'Players requiring some action...',
         search: 'Use the search field above to find players, or click player to edit',
         assign: 'Assign this profile by clicking a player below, or ...',
         accept: 'Accept all players',
         trnyz:  'Loading Tournaments ...',
         badfile: 'File Not Recognized',
         invalid: 'Invalid file type',
         fileerror: 'Error reading file',
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
         norankingdata: 'No Ranking Data',
         oop_system: 'Order of Play',
         schedulepublished: 'Publishing Time:',
         timestamp: 'Date/Time: ',
         rankedplayers: 'Ranked Players',
         judgesignature: 'Signature of Head Umpire:',
         nopointcalcs: 'No Point Calculations for given date',
         nomatches: 'No Matches',
         downloadtemplate: 'Download Import Template',
         add2database: 'Add Players, Tournaments, Rankings to Database',
         noconnection: 'No Connection',
         schedulepriority: 'Match Scheduling Priority',
         send: 'Send',
         export: 'Export',
         pointsvalidfrom: 'Points Valid From',
         linkcopied: 'Link Copied to Clipboard',
         submitkey: 'Submit Key',
         selectkey: 'Select Key',
         deletereplace: 'Delete / Replace',
         weblink: 'Web Link',
         nomatches: 'No Matches',
         updatedioc: 'Update Language File',
         revokeauth: 'Revoke Authorization?',
         clearalldays: 'Clear All Days?',
      },

      events: {
         name: 'Name',
         newevent: 'New Event',
         opponents: 'Opponents',
         teams: 'Teams',
         draw_type: 'Draw Type',
         draw_size: 'Draw Size',
         created: 'Created',
         category: 'Category',
         rank: 'Rank',
         surface: 'Surface',
         approveteam: 'Approve',
         approved: 'Approved',
         eligible: 'Eligible',
         ineligible: 'Ineligible',
         unavailable: 'Unavailable',
         wildcard: 'Wildcard'
      },

      locations: {
         newlocation: 'New Location',
         abbreviation: 'Abbr.',
         name: 'Name',
         address: 'Address',
         courts: 'Courts',
         identifiers: 'Court IDs',
      },

      genders: {
         male: 'Male',
         female: 'Female',
         mixed: 'Mixed',
      },

      surfaces: {
         clay: 'Clay',
         hard: 'Hard',
         grass: 'Grass',
         carpet: 'Carpet',
      },

      actions: {
         ok: 'OK',
         add_event: 'Add Event',
         save_event: 'Save Event',
         done: 'Done',
         cancel: 'Cancel',
         refresh: 'Refresh',
         delete_event: 'Delete Event',
         add_player: 'Add Player',
         add_location: 'Add Location',
         save_location: 'Save Location',
         delete_location: 'Delete Location',
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
      },

      schedule: {
         allevents: 'All Events',
         allrounds: 'All Rounds',
         allcourts: 'All Courts',
         autoschedule: 'Auto Schedule',
         clearschedule: 'Clear Schedule',
         orderofplay: 'ORDER OF PLAY',
         matchestime: 'Matches => Time', 
         notbefore: 'Not Before',
         followedby: 'Followed By',
         afterrest: 'After Rest',
         tba: 'TBA',
         nextavailable: 'Next Available',
         oncourt: 'On Court',
         warmingup: 'Warming Up',
         suspended: 'Suspended',
         raindelay: 'Rain Delay',
         clear: 'Clear',
         publish: 'Publish Schedule',
         unpublish: 'Unpublish Schedule',
         timing: 'Timing',
      },
      
      refresh: {
         general: 'Refresh',
         registered: 'Updating Registered Players...',
         players: 'Updating Players...',
         calendar: 'Updating Calendar...',
         clubs: 'Updating Clubs...',
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
      },

      // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toLocaleDateString
      datelocalization: 'en-EN',
   }

   if (typeof define === "function" && define.amd) define(lang); else if (typeof module === "object" && module.exports) module.exports = lang;
   this.lang = lang;
 
}();
