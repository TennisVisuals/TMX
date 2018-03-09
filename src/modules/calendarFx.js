import { lang } from './translator';

export const calendarFx = function() {
   let fx = {};

   fx.localizeDate = (date, date_localization) => {
      let default_localization = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
      return date.toLocaleDateString(lang.tr('datelocalization'), date_localization || default_localization);
   }
   
   return fx;
}();

