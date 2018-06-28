import { db } from './db'
import { util } from './util'
import { exportFx } from './exportFx';
import { rankCalc } from './rankCalc';
// import { tournamentParser } from './tournamentParser';

export const hts = function() {

   let hts = {};

   hts.downloadHTSformattedPoints = ({ tuid, calc_date, points=[], group_size = 1000 }) => {
      return new Promise( (resolve, reject) => {

         if (!points.length) return reject();
         formatPoints(points);

         function formatPoints(points) {
            // filter out points that don't have HTS tuid or where p.id is non-numeric
            points = points.filter(p=>p.points && p.tuid.indexOf('HTS') == 0 && !isNaN(p.id))
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
               var players_by_puid = Object.assign({}, ...players.map(p => { return { [p.puid]: p } }));
               let hts_points = points.map(point => {

                  let player = players_by_puid[point.puid];
                  let format = point.format == 'singles' ? 'S' : 'D';
                  let tournament_type = point.tournament_type || 'TU'
                  let kategorija_turnira = point.category;

                  let born = player ? new Date(player.birth).getFullYear() : '0000';
                  let eligible_categories = rankCalc.eligibleCategories({ birth_year: born, calc_date });
                  let kategorija_igraca = eligible_categories.base_category;

                  let plasman = convertRound(point.round) || point.placement;

                  return {
                     plasman, si_do: format, rang: point.rank, igracID: point.id, kategorija_turnira, kategorija_igraca,
                     spol: point.gender, tip: tournament_type, datum_obracuna: util.formatDate(point.date, '/', 'DMY'),
                     kalendarID: point.tuid.match(/\d+/g)[0], sezona: new Date(point.date).getFullYear(), UK: point.points,
                     POUK: tournament_type != 'MO' && format == 'S' ? point.points : 0,
                     PKUK: tournament_type != 'MO' && format == 'S' ? point.points : 0,
                     PK:   tournament_type == 'MO' || format == 'D' ? 0 : kategorija_turnira == kategorija_igraca ? point.points : 0,
                     PKST: tournament_type == 'MO' || format == 'D' ? 0 : kategorija_turnira != kategorija_igraca ? point.points : 0,
                     PAUK: tournament_type != 'MO' && format == 'D' ? point.points : 0,
                     PA:   tournament_type == 'MO' || format == 'S' ? 0 : kategorija_turnira == kategorija_igraca ? point.points : 0,
                     PAST: tournament_type == 'MO' || format == 'S' ? 0 : kategorija_turnira != kategorija_igraca ? point.points : 0,
                     M: tournament_type == 'MO' ? point.points : 0,
                  }
               });

               resolve(hts_points);
            }

            function convertRound(round) {
               let plasman = {
                  'F': '1', 'SF': '2', 'QF': 'Polufinale', 'R12': 'Četvrtfinale', 'R16': 'Četvrtfinale', 'R24': '9.-16.',
                  'R32': '9.-16.', 'R48': '17.-32.', 'R64': '17.-32.', 'R96': '33.-64.', 'R128': '33.-64.',
                  'Q': 'KV', 'Q1': 'KV1', 'Q2': 'KV2', 
                  'RRQ1': 'KV', 'RRQ2': 'KV1', 'RRQ3': 'KV2', 'RRQ4': 'KV3',
                  'RRF': '1', 'RR1': '2', 'RR2': 'KV1', 'RR3': 'KV2', 'RR4': 'KV3',
               }
               return plasman[round];
            }
         });
      }
   }

   /*
   tournamentParser.dateProcess.HTS = function(date) {
      if (!date) return;
      let parts = date.split('-').reverse()[0].split('.').filter(f=>f)
         .map(m => {
            let numeric = m.match(/\d+/);
            return numeric && numeric.length ? numeric[0] : numeric;
         });
      if (parts.length == 3) {
         let dt = new Date(+parts[2], --parts[1], +parts[0]);
         return dt.getTime();
      }
      return;
   }

   tournamentParser.profiles.HTS = {
      identification: { includes: ['Pocetna'], sub_includes: ['Si GT'], },
      sheeet_filter: { exclude: ['raspored'] },
      points: 'HTS',
      columns: {
         position: 'A',
         rank:     'B',
         entry:    'C',
         seed:     'D',
         players:  'E',
         club:     'G',
         rounds:   'H',
      },
      rows: { header: 6, },
      gaps: { 
         draw:     { term: 'rang', gap: 0 }, 
         preround: { term: 'rang', gap: 1 },    // TODO: implement capture
      },
      targets: { winner: 'Pobjednik', },
      header_columns: [ { attr: 'rr_result', header: 'Poredak' }, ],
      extraneous: { starts_with: ['gs', 'bez', 'pobjed', 'final'], },
      routines: { add_byes: true, }
   };

   tournamentParser.HTS_tournamentData = (workbook) => {
      if (workbook.SheetNames.indexOf('Pocetna') < 0) {
         let sheet = workbook.Sheets[workbook.SheetNames[0]];
         let keys = Object.keys(sheet);
         return {
            name: keys.indexOf('A1') >= 0 ? sheet.A1.v : undefined,
            draw: keys.indexOf('A2') >= 0 ? sheet.A2.v + '' : undefined,
            category: keys.indexOf('A2') >= 0 ? sheet.A2.v + '' : undefined,
            rang_turnira: keys.indexOf('P5') >= 0 ? sheet.P5.v + '' : undefined,
            datum_turnir: keys.indexOf('A5') >= 0 ? sheet.A5.v + '' : undefined, 
            id_turnira: keys.indexOf('M5') >= 0 ? sheet.M5.v + '' : undefined, 
            mjesto: keys.indexOf('I5') >= 0 ? sheet.I5.v + '' : undefined, 
            organizator: keys.indexOf('E5') >= 0 ? sheet.E5.v + '' : undefined, 
         };
      };
      var details = workbook.Sheets['Pocetna'];
      return {
         name:             tournamentParser.value(details.B7),
         draw:             tournamentParser.value(details.B10),
         category:         tournamentParser.value(details.B10),
         sve_kategorije:   tournamentParser.value(details.C10),
         datum_turnir:     tournamentParser.value(details.B12),
         datu_rang_liste:  tournamentParser.value(details.B14),
         rang_turnira:     tournamentParser.value(details.B16),
         id_turnira:       tournamentParser.value(details.C12),
         organizator:      tournamentParser.value(details.D12),
         mjesto:           tournamentParser.value(details.E12),
         vrhovni_sudac:    tournamentParser.value(details.F12),
         director_turnira: tournamentParser.value(details.E14),
         dezurni_ljiecnik: tournamentParser.value(details.F14),
         singlovi:         workbook.SheetNames.filter(f=>f.indexOf('Si ') == 0),
         dubl:             workbook.SheetNames.filter(f=>f.indexOf('Do ') == 0),
      };
   }
   */

   return hts;
}();
