import { Diacritics } from './diacritics';

export const stringFx = function() {

   let fx = {};

   fx.string2boolean = (string) => {
      if (typeof string == 'boolean') return string;
      if (string === 'true') return true;
      if (string === 'false') return false;
   };

   fx.replaceDiacritics = (text) => Diacritics.replace(text);
   fx.nameHash = (name) => fx.replaceDiacritics(name.replace(/[-_,. ]+/g, "")).toLowerCase();

   fx.normalizeName = (name, noaccents = true) => {
      if (!name) { return ''; }
      var particles = ['del', 'de', 'di', 'du', 'van', 'von', 'ten']; 
      if (noaccents) name = fx.replaceDiacritics(name.trim());
      name = name.replace(/\s+/g,' ').trim();
      var nNames = name.split(' ').map(m => m.toLowerCase());

      var nName = nNames.map(function(m, i) { 
         if (i == 0 || i == nNames.length - 1 || particles.indexOf(m.toLowerCase()) < 0) m = m ? m[0].toUpperCase() + m.slice(1) : '';
         return m; 
      }).join(' ');

      return supportApostrophe(nName);

      function supportApostrophe(name) {
         var s_name = name.split(' ');
         var mod_name = s_name.map(n => {
            if (n.length > 2 && n[1] == "'") {
               n = replaceAt(n, 2, n[2].toUpperCase());
               if (n[0] == 'D') { n = replaceAt(n, 0, 'd'); }
            }
            return n;
         });
         return mod_name.join(' ');
      }

      function replaceAt(s, n, t) { return s.substring(0, n) + t + s.substring(n + 1); }
   };

   return fx;

}();
