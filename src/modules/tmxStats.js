import { db } from './db'
import { util } from './util';
import { drawFx } from './drawFx';
import { lang } from './translator';
import { matchFx } from './matchFx';
import { barChart } from './barChart';
import { donutChart } from './donutChart';
import { scoreBoard } from './scoreBoard';

export const tmxStats = function() {

   let fx = {};

   let bands = { decisive: 20, routine: 50 };
   let colours = { decisive: "#F48F06", routine: "#0369C3", competitive: "#2BC303", walkover: "#F9E8E5" }
   let categories = { 'd': 'Decisive', 'c': 'Competitive', 'r': 'Routine', 'w': 'Walkover' }
   let add = (a, b) => (a || 0) + (b || 0);

   fx.processMatches = (tournament, container) => {
      let { completed_matches, pending_matches, upcoming_matches, total_matches } = matchFx.tournamentEventMatches({ tournament });
      let match_sets = completed_matches.map(match => {
         let sets = scoreBoard.convertStringScore({ string_score: match.score, score_format: match.score_format || {}, winner_index: match.winner_index });
         let games = sets.reduce((p, c) => { p[0] += c[0].games || 0; p[1] += c[1].games || 0; return p; }, [0, 0]);
         let stb = sets.reduce((p, c) => { p[0] += c[0].supertiebreak || 0; p[1] += c[1].supertiebreak || 0; return p; }, [0, 0]);
         if (stb.reduce(add)) { games[(stb[0] > stb[1]) ? 0 : 1] += 1; }
         return { sets, games, score: match.score };
      });

      let buckets = pctSpread(match_sets).reduce((b, a) => { if (b[a]) { b[a] += 1 } else { b[a] = 1}; return b; }, {});
      let data = Object.keys(buckets).map(key => isNaN(key) ? undefined : { pct: key, value: buckets[key] }).filter(f=>f);

      let sortem = (p, c) => {
         let band = isNaN(c) ? 'w' : c <= bands.decisive ? 'd' : c <= bands.routine ? 'r' : 'c';
         p[band] += 1;
         return p;
      }
      let dd = pctSpread(match_sets).reduce((p, c) => sortem(p, c), { w: 0, d: 0, r: 0, c: 0 }); 
      let total = Object.keys(dd).reduce((a, k) => (dd[k] || 0) + a, 0);
      let dt = Object.keys(dd).map(k => ({ Percentage: dd[k] / total, Category: categories[k] })); 

      setTimeout(function() {
         fx.pctDonut(container, dt, true);
         fx.competitiveMatchIndices(container, data);
      }, 400);
   }

   function gamesPct(match_results) {
      let loser_games = Math.min(...match_results.games);
      let winner_games = Math.max(...match_results.games);
      let total_games = match_results.games.reduce(add);
      let pct = Math.round((loser_games/winner_games) * 100);
      return pct;
   }
   function pctSpread(pcts) { return pcts.map(gamesPct).sort().map(p=>p.toFixed(2)); }

   fx.pctDonut = (container, data, clean) => {
      let chart_div = container.stat_charts.element;
      let root = d3.select(chart_div);

      if (clean) root.selectAll("svg").remove();

      let computed_style = window.getComputedStyle(chart_div);
      let width_value = computed_style.width.match(/\d+/);
      let width = (width_value && width_value.length && width_value[0] * .9) || (window.innerWidth - margin.left - margin.right);

      let donut = donutChart()
         .width(width)
         .height(300)
         .cornerRadius(3) // sets how rounded the corners are on each slice
         .padAngle(0.015) // effectively dictates the gap between slices
         .colour(d3.scaleOrdinal([colours.walkover, colours.decisive, colours.routine, colours.competitive]))
         .variable('Percentage')
         .category('Category');

      root.datum(data).call(donut);
   }

   fx.competitiveMatchIndices = (container, data, clean) => {

      var chart_div = container.stat_charts.element;
      let root = d3.select(chart_div);

      var margin = {top: 20, right: 20, bottom: 20, left: 40};
      let computed_style = window.getComputedStyle(chart_div);
      let width_value = computed_style.width.match(/\d+/);
      let width = (width_value && width_value.length && width_value[0] * .9) || (window.innerWidth - margin.left - margin.right);

      if (clean) root.selectAll("svg").remove();

      let bar = barChart()
         .width(width)
         .height(200)
         .margin(margin)
         .colour(barColor)

      root.datum(data).call(bar);

      function barColor(d) { return (d.pct <= bands.decisive) ? colours.decisive : (d.pct <= bands.routine) ? colours.routine : colours.competitive; }
   }

   return fx;

}();
