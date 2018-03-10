import { db } from './modules/db';
import { theme } from './modules/theme';
import { playerFx } from './modules/playerFx';
import { tournamentDisplay } from './modules/tournamentDisplay';

import { config } from './modules/config';

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
   db.addDev({theme});

   playerFx.displayTournament = tournamentDisplay.displayTournament;

   config.init();
}

/* TODO:
 *
 * 1. config.env() data must be added to tournament record when sent to mobilref
 *
 */
