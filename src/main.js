'use strict';

/* TODO
 * *. go through all matches and assign sex to players if unassigned... also update players
 *    db.findAllMatches().then(d=>matches=d)
 *    unsexed = matches.filter(m=>m.players.map(p=>p.sex).indexOf(undefined) >= 0)
 *    sexed = matches.map(m=>rank.determineGender(m));
 *    u=0; sexed.forEach(s=> { if (!s) u+=1 });
 *
 * *. database table to keep track of changes in tournment ranks or dates, 
 *    which can then be used to determine what area of rank calculations is * affected
 *
 * 1. If Qualifying Draw loaded separately from Main Draw then points need to
 *    be consolidated such that players don't get points from both draws...
 *
 * *. tournaments need to have status = cancelled, loaded, past_due
 *
 * 3. dropZone should be made into components like DropDown
 *
 * 4. Get Court Surface information either from spreadsheets or club info
 *
 * 5. Clubs need real CUIDs instead of just #'s
 *
 */

let dev = { };

// TODO: env.org should be replaced by a setting
// new tournaments created in the local client should not include env.org
let env = {
   org: 'HTS',
   profile: undefined,     // can now be set to 'HTS2018' for new point tables
   version: '0.8.10',
   auto_update: {
      players: false,
      registered_players: false,
   },
   map_provider: undefined, // 'google' or 'leaflet'
   orientation: undefined,
   reset_new_versions: false,
   geolocate: true,
   broadcast: true,
   livescore: false,
   autodraw: true,
   calendar: {},
}

let device = {
   isStandalone: 'standalone' in window.navigator && window.navigator.standalone,
   isIDevice: (/iphone|ipod|ipad/i).test(window.navigator.userAgent),
   isWindows: (/indows/i).test(window.navigator.userAgent),
   isMobile: (typeof window.orientation !== "undefined"),
   geoposition: {},
}

let busy = {
   count: 0,
   callbacks: {},
   message(text, callback) {
      busy.count += 1;
      if (callback) busy.callbacks[busy.count] = callback;
      if (busy.veryBusy) busy.veryBusy(text);
      return busy.count;
   },
   done(id) {
      if (id && busy.callbacks[id]) {
         busy.callbacks[id]();
         delete busy.callbacks[id];
      }
      busy.count -= 1;
      if (!busy.count && busy.notBusy) busy.notBusy();
   },
   veryBusy: gen.showProcessing,
   notBusy: gen.closeModal,
}
