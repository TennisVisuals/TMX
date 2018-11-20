import { env } from './env';
import { lang } from './translator';
import { tmxTour } from './tmxTour';
import { fetchFx } from './fetchFx';
import { modalViews } from './modalViews';
import { displayGen } from './displayGen';
import { eventManager } from './eventManager';
import { releaseNotes } from './releaseNotes';
import { tournamentDisplay } from './tournamentDisplay';

export const menuFx = function() {
   let fx = {};

   fx.init = () => {
      eventManager
         .register('displayVersion', 'tap', displayVersion)
         .register('displayMessages', 'tap', displayMessages)
         .register('displayTour', 'tap', displayTour)
         .register('displayReleaseNotes', 'tap', displayReleaseNotes)
         .register('displaySupport', 'tap', displayGen.support);
   };

   fx.displayTour = displayTour;
   function displayTour() { modalViews.closeModal(); displayGen.closeModal(); tmxTour.splashTour(); }
   function displayReleaseNotes() { modalViews.modalWindow({ html: releaseNotes }); }
   function displayMessages() {
      modalViews.closeModal();
      displayGen.escapeModal();
      displayGen.homeContextMessage(refreshApp, closeModal, env.messages, tournamentDisplay.displayTournament);
      env.messages = [];
      displayGen.homeIconState();
   }
   function displayVersion() {
      let html =`<div class='section'><h2 class='title is-2'>${lang.tr('version')}: ${env.version}</h2></div>`;
      modalViews.modalWindow({ html });
   }
   function closeModal() { displayGen.escapeFx = undefined; displayGen.closeModal(); }
   function refreshApp() {
      location.pathname = "/tmx/";
      delete fetchFx.update;
   }

   fx.display = () => {
      let messages = env.messages && env.messages.length ? 'flex' : 'none';
      let html = `
         <nav class="panel">
            <p class="panel-heading">
               TMX ${lang.tr('phrases.mainmenu')}
            </p>
            <label class='panel-block displayVersion'>${lang.tr('version')}</label>
            <label class='panel-block displayMessages' style='display: ${messages}'>${lang.tr('messages')}</label>
            <label class='panel-block displayTour'>TMX ${lang.tr('tour')}</label>
            <label class='panel-block displayReleaseNotes'>${lang.tr('releasenotes')}</label>
            <label class='panel-block displaySupport'>${lang.tr('support')}</label>
         </nav>
      `;
      modalViews.modalWindow({ html });
   };

   return fx;
}();

