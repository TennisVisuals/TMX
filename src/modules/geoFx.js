import { coms } from './coms';
import { util } from './util';
import { lang } from './translator';
import { displayGen } from './displayGen';
// import { modalViews } from './modalViews';

export const geoFx = function() {
   let fx = {};

   fx.getLatLng = ({ successFx }) => {
      displayGen.enterLink('', lang.tr('phrases.entergooglemapsurl'), processLink);
      function processLink(link) {
         displayGen.closeModal();
         if (!link) { return; }
         let parts = link.split('/');
         let ll = parts.reduce((p, c) => c && c[0] == '@' ? c : p, undefined);
         let lparts = ll && ll.split(',');
         let latitude = lparts && lparts[0].slice(1);
         let longitude = lparts && lparts[1];

         if (latitude && longitude) {
            if (successFx && typeof successFx == 'function') successFx({ latitude, longitude});
         } else {
            invalidURL('invalidgooglemapsurl');
         }
      }
   };

   fx.getUserPosition = ({ successFx }) => {
      let message = lang.tr('phrases.usecurrentlocation');
      displayGen.okCancelMessage(message, getPosition, ()=>displayGen.closeModal());

      function getPosition() {
         displayGen.closeModal();
         var options = { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 };

         if (navigator && navigator.permissions && navigator.permissions.query) {
            navigator.permissions.query({
                 name: 'geolocation'
             }).then(function(result) {
                 if (result.state == 'granted') {
                    navigator.geolocation.getCurrentPosition(success, coms.notShared, options);
                 } else if (result.state == 'prompt') {
                    navigator.geolocation.getCurrentPosition(success, coms.notShared, options);
                 } else if (result.state == 'denied') {
                    geolocationDenied();
                 }
                 result.onchange = function() { if (result.state == 'granted') navigator.geolocation.getCurrentPosition(success, coms.notShared, options); };
             }, util.logError);
         } else if (navigator && navigator.geolocation && navigator.geolocation.getCurrentPosition) {
             navigator.geolocation.getCurrentPosition(success, coms.notShared, options);
         }

         function success(pos) {
            coms.locationShared(pos);
            if (successFx && typeof successFx == 'function') successFx({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
         }
      }
   };

   function invalidURL(phrase='invalidsheeturl') {
      let message = lang.tr(`phrases.${phrase}`);
      displayGen.popUpMessage(`<div>${message}</div>`);
   }

   function geolocationDenied() {
      let message = `
         <div>${lang.tr('phrases.geolocationdenied')}</div>
         <p>${lang.tr('phrases.unblockgeo')}</p>
      `;
      displayGen.popUpMessage(message);
   }

   return fx;
}();
