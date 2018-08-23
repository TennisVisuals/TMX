import { config } from './modules/config';
import { playerFx } from './modules/playerFx';
import { tournamentDisplay } from './modules/tournamentDisplay';

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

function start() {
   playerFx.displayTournament = tournamentDisplay.displayTournament;
   config.init();
}
