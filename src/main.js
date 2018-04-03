import { db } from './modules/db';
import { UUID } from './modules/UUID';
import { util } from './modules/util';
import { theme } from './modules/theme';
import { exportFx } from './modules/exportFx';
import { scheduleFx } from './modules/scheduleFx';
import { matchObject } from './modules/matchObject';
import { eventManager } from './modules/eventManager';
import { tournamentDisplay } from './modules/tournamentDisplay';

import { config } from './modules/config';
import { playerFx } from './modules/playerFx';

if (window.attachEvent) {
   window.attachEvent('onload', start);
} else {
   if (window.onload) {
      var curronload = window.onload;
      var newonload = function(evt) {
         curronload(evt);
         start(evt);
      };
      window.onload = newonload;
   } else {
      window.onload = start;
   }
}

var elements = {
   header:           document.getElementById('header'),
   header_actions:   document.getElementById('header_actions'),
   main:             document.getElementById('main'),
   home:             document.getElementById('go_home'),
   content:          document.getElementById('content'),
   refresh:          document.getElementById('refresh'),
   idiomatic:        document.getElementById('idiomatic'),
   searchmeta:       document.getElementById('searchmeta'),
   searchentry:      document.getElementById('searchentry'),
   searchinput:      document.getElementById('searchinput'),
   searchextra:      document.getElementById('searchextra'),
   searchcount:      document.getElementById('searchcount'),
   search_select:    document.getElementById('search_select'),
   searchcategory:   document.getElementById('searchcategory'),
}

function start() {
   db.addDev({db});
   db.addDev({util});
   db.addDev({UUID});
   db.addDev({theme});
   db.addDev({config});
   db.addDev({exportFx});
   db.addDev({scheduleFx});
   db.addDev({matchObject});
   db.addDev({eventManager});

   playerFx.displayTournament = tournamentDisplay.displayTournament;

   config.init();
}

/* TODO:
 *
 * 1. config.env() data must be added to tournament record when sent to mobilref
 *
 */
