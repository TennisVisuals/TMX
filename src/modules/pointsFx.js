import { db } from './db'
import { util } from './util'
import { rankCalc } from './rankCalc'
import { exportFx } from './exportFx';

export const pointsFx = function() {

   var exp = {};
   let fx = { settingsLoaded: (env) => { if (typeof env.points.export_format == 'object') exp = env.points.export_format; } };

   fx.downloadFormattedPoints = ({ org_abbr, points=[], tuid, group_size, calc_date=new Date() }) => {
      return new Promise((resolve, reject) => {
         if (!exp) return reject();

         points = points.filter(p => {
            if (!p.points || !p.tuid) return;
            if (exp.filter_tuid && p.tuid.indexOf(exp.filter_tuid) != 0) return;
            if (exp.primary_key && exp.primary_is_numeric && isNaN(p[exp.primary_key])) return;
            return true;
         }).filter(p=>p);
         if (!points.length) { console.log('no points'); return reject(); }

         let merge_players = exp.player_attributes && Object.keys(exp.player_attributes).length;
         if (merge_players) {
            db.findAllPlayers().then(attempt, reject);
         } else {
            attempt()
         }

         function attempt(players) {
            try { generate(players); }
            catch (err) { util.logError(err); }
         }

         function generate(players=[]) {
            players.forEach(player => {
               let born = new Date(player.birth).getFullYear();
               let eligible_categories = rankCalc.eligibleCategories({ birth_year: born, calc_date });
               if (eligible_categories) player.base_category = eligible_categories.base_category;
            });
            let players_by_puid = Object.assign({}, ...players.map(p => { return { [p.puid]: p } }));
            let formatted_points = points.map(point => {
               let formatted_point = {};
               if (exp.point_attributes) Object.assign(formatted_point, ...pointAttributes(point, players_by_puid[point.puid] || {}));
               return formatted_point;
            });

            exportFormattedPoints({ org_abbr, formatted_points, tuid, group_size });

            function pointAttributes(point) {
               let player = players_by_puid[point.puid];
               return exp.point_attributes.map(attr => ({ [attr.name]: attr.fx ? attr.fx(point, player) : '' }));
            }
         }
      });
   }

   function exportFormattedPoints({ org_abbr, formatted_points, tuid, group_size=500 }) {
      let cursor = 0;
      let date_format = exp.date_format ? `_${exp.date_format}` || '' : '';
      while (cursor < formatted_points.length) {
         let csv = exportFx.json2csv(formatted_points.slice(cursor, cursor + group_size)) + '\n';
         let tuid_string = tuid ? `_${tuid}` : '';
         exportFx.downloadText(`${org_abbr}_format_points${tuid_string}${date_format}.csv`, csv);
         cursor += group_size;
      }
   }

   return fx;

}();
