import { db } from './db';
import { dateFx } from './dateFx';
import { exportFx } from './exportFx';
import { rankCalc } from './rankCalc';

export const hts = function() {

   let hts = {};

   hts.downloadHTSformattedPoints = ({ tuid, calc_date, points=[], group_size = 1000 }) => {
      return new Promise( (resolve, reject) => {

         if (!points.length) return reject();
         formatPoints(points);

         function formatPoints(points) {
            // filter out points that don't have HTS tuid or where p.id is non-numeric
            points = points.filter(p=>p.points && p.tuid.indexOf('HTS') == 0 && !isNaN(p.id));
            convertPointsToHTS(points, calc_date).then(exportPoints);
         }

         function exportPoints(points) {
            let cursor = 0;
            while (cursor < points.length) {
               let csv = exportFx.json2csv(points.slice(cursor, cursor + group_size)) + '\n';
               let tuid_string = tuid ? `_${tuid}` : '';
               exportFx.downloadText(`hts_format_points${tuid_string} DMY.csv`, csv);
               cursor += group_size;
            }
         }
      });

      function convertPointsToHTS(points, calc_date) {
         if (!calc_date) calc_date = new Date();
         return new Promise( (resolve, reject) => {

            db.findAllPlayers().then(generate, reject);

            function generate(players) {
               var players_by_puid = Object.assign({}, ...players.map(p => ({ [p.puid]: p }) ));
               let hts_points = points.map(point => {

                  let player = players_by_puid[point.puid];
                  let format = point.format == 'singles' ? 'S' : 'D';
                  let tournament_type = point.tournament_type || 'TU';
                  let kategorija_turnira = point.category;

                  let born = player ? new Date(player.birth).getFullYear() : '0000';
                  let eligible_categories = rankCalc.eligibleCategories({ birth_year: born, calc_date });
                  let kategorija_igraca = eligible_categories.base_category;

                  let plasman = convertRound(point.round) || point.placement;

                  return {
                     plasman, si_do: format, rang: point.rank, igracID: point.id, kategorija_turnira, kategorija_igraca,
                     spol: point.gender, tip: tournament_type, datum_obracuna: dateFx.formatDate(point.date, '/', 'DMY'),
                     kalendarID: point.tuid.match(/\d+/g)[0], sezona: new Date(point.date).getFullYear(), UK: point.points,
                     POUK: tournament_type != 'MO' && format == 'S' ? point.points : 0,
                     PKUK: tournament_type != 'MO' && format == 'S' ? point.points : 0,
                     PK:   tournament_type == 'MO' || format == 'D' ? 0 : kategorija_turnira == kategorija_igraca ? point.points : 0,
                     PKST: tournament_type == 'MO' || format == 'D' ? 0 : kategorija_turnira != kategorija_igraca ? point.points : 0,
                     PAUK: tournament_type != 'MO' && format == 'D' ? point.points : 0,
                     PA:   tournament_type == 'MO' || format == 'S' ? 0 : kategorija_turnira == kategorija_igraca ? point.points : 0,
                     PAST: tournament_type == 'MO' || format == 'S' ? 0 : kategorija_turnira != kategorija_igraca ? point.points : 0,
                     M: tournament_type == 'MO' ? point.points : 0
                  };
               });

               resolve(hts_points);
            }

            function convertRound(round) {
               let plasman = {
                  'F': '1', 'SF': '2', 'QF': 'Polufinale', 'R12': 'Četvrtfinale', 'R16': 'Četvrtfinale', 'R24': '9.-16.',
                  'R32': '9.-16.', 'R48': '17.-32.', 'R64': '17.-32.', 'R96': '33.-64.', 'R128': '33.-64.',
                  'Q': 'KV', 'Q1': 'KV1', 'Q2': 'KV2', 
                  'RRQ1': 'KV', 'RRQ2': 'KV1', 'RRQ3': 'KV2', 'RRQ4': 'KV3',
                  'RRF': '1', 'RR1': '2', 'RR2': 'KV1', 'RR3': 'KV2', 'RR4': 'KV3'
               };
               return plasman[round];
            }
         });
      }
   };

   return hts;
}();
