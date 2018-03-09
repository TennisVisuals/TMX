export function rrDraw() {

   var o = {
      id: 'rrDraw',
      selector: undefined,

      width: undefined,
      min_width: 1000,
      ref_width_selector: 'body',
      ref_width_factor: .9,

      height: undefined,
      min_height: 200,

      brackets: {
         size: 4,
      },

      player_cells: {
         color: 'white',
         highlight_color: 'lightgray',
      },

      score_cells: {
         color: 'white',
         highlight_color: 'lightblue',
      },

      margins: {
         top: 6,
         left: 10,
         right: 10,
         bottom: 0,
      },

      names: {
         first_initial: false,
         length_divisor: 9,
         max_font_size: 14,
         min_font_size: 10,
      },

      scores: {
         max_font_size: 14,
         min_font_size: 10,
      },

      bracket: {
         positions: 4,
         initial_position: 1,
      },

      sizeToFit: false,
   }

   var root;
   var dfx = drawFx();

   var bracket_charts = [];
   var data = { brackets: [] };

   var events = {
      'score':    { 'click': null, 'mouseover': highlightCell, 'mouseout': unHighlightCells, 'contextmenu': null },
      'player':   { 'click': null, 'mouseover': null, 'mouseout': unHighlightPlayer, 'contextmenu': null },
      'info':     { 'click': null, 'mouseover': null, 'mouseout': null, 'contextmenu': null },
      'order':    { 'click': null, 'mouseover': null, 'mouseout': null, 'contextmenu': null },
      'result':   { 'click': null, 'mouseover': null, 'mouseout': null, 'contextmenu': null },
      'sizing':   { 'width': null, },  // optional functions for sizeToFit
   };

   function chart(opts) {
      root = d3.select(o.selector || 'body');

      let ref_width = document.querySelector(o.ref_width_selector) ? +d3.select(o.ref_width_selector).style('width').match(/\d+/)[0] * o.ref_width_factor : undefined;
      let draw_width = o.width || Math.max(ref_width || 0, o.min_width);

      if (!data.brackets || !data.brackets.length) return;
      let seed_limit = data.brackets.length * 2;

      let html = data.brackets.map((bracket, i) => `<div id='${o.id}_${i}'></div>`).join('');
      root.html(html);

      data.brackets.forEach((bracket, i) => {

         bracket_charts[i] = roundRobin()
            .bracketIndex(i)
            .events(events)
            .selector(`#${o.id}_${i}`)
            .options({ 
               sizeToFit: o.sizeToFit, 
               width: draw_width, 
               height: o.height || o.min_height,

               names: o.names,
               scores: o.scores,
               margins: o.margins,
               bracket: o.bracket,
            })
            .bracketPositions(bracket.size || o.brackets.size)
            .seedLimit(seed_limit)
            .addPlayers(bracket.players)
            .addMatches(bracket.matches)
            .addByes(bracket.byes)
            .addScores();
      });

      // call each bracket object to generate view
      data.brackets.forEach((bracket, i) => bracket_charts[i]());
   }

   chart.events = function(obj) {
      if (!arguments.length) return events;
      keyWalk(obj, events);
      return chart;
   }

   chart.updateBracket = function(bracket_index, reset) {
      if (reset) bracket_charts[bracket_index].reset();

      bracket_charts[bracket_index]
         .addPlayers(data.brackets[bracket_index].players)
         .addMatches(data.brackets[bracket_index].matches)
         .addByes(data.brackets[bracket_index].byes)
         .addScores();

      bracket_charts[bracket_index]();
      return chart;
   }

   chart.brackets = function() {
      return bracket_charts;
   }

   chart.options = function(values) {
      if (!arguments.length) return o;
      keyWalk(values, o);
      return chart;
   }

   chart.bracketSize = function(value) {
      if (!arguments.length) { return o.brackets.size; }
      o.brackets.size = value;
      return chart;
   }

   chart.data = function(value) {
      if (!arguments.length) { return data; }
      data = value;
      return chart;
   }

   chart.matches = function() { 
      return dfx.drawInfo(data); 
   }

   chart.selector = function (value) {
      if (!arguments.length) { return o.selector; }
      o.selector = value;
      return chart;
   };

   chart.info = function() {
      if (!data || !Object.keys(data).length) return {};
      return dfx.drawInfo(data);
   }

   chart.unHighlightCells = unHighlightCells;
   function unHighlightCells() {
      Array.from(root.node().querySelectorAll('.rr_score')).forEach(e=>e.style.fill = o.score_cells.color)
   }

   chart.highlightCell = highlightCell;
   function highlightCell(d) {
      if (!d) return;
      if (!d.players || d.players.indexOf(undefined) >= 0) return;
      let cell_selector = `.rr${d.bracket}_${d.attr}_${d.row}_${d.mc}`;
      let cell = root.node().querySelector(cell_selector);
      if (cell) cell.style.fill = o.score_cells.highlight_color;
   }

   chart.highlightPlayer = highlightPlayer;
   function highlightPlayer(bracket, row, highlight=true) {
      let cell_selector = `.rr${bracket}_player_${row}`;
      let cell = root.node().querySelector(cell_selector);
      if (cell) cell.style.fill = highlight ? o.player_cells.highlight_color : o.player_cells.color;
   }

   chart.unHighlightPlayer = unHighlightPlayer;
   function unHighlightPlayer() {
      Array.from(root.node().querySelectorAll('.rr_player')).forEach(e=>e.style.fill = o.player_cells.color)
   }

   function keyWalk(valuesObject, optionsObject) {
      if (!valuesObject || !optionsObject) return;
      var vKeys = Object.keys(valuesObject);
      var oKeys = Object.keys(optionsObject);
      for (var k=0; k < vKeys.length; k++) {
          if (oKeys.indexOf(vKeys[k]) >= 0) {
              var oo = optionsObject[vKeys[k]];
              var vo = valuesObject[vKeys[k]];
              if (oo && typeof oo == 'object' && typeof vo !== 'function' && oo.constructor !== Array) {
                  keyWalk(valuesObject[vKeys[k]], optionsObject[vKeys[k]]);
              } else {
                  optionsObject[vKeys[k]] = valuesObject[vKeys[k]];
              }
          }
      }
   }

   return chart;
}

export function roundRobin() {
   var o = {
      selector: undefined,
      bracket_index: undefined,

      cleanup: true,      // first remove all svg from root
      sizeToFit: true,
      width: undefined,
      height: undefined,
      minWidth: undefined,
      maxWidth: undefined,
      minHeight: 200,
      maxHeight: 200,
      minPlayerHeight: 20,

      cells: {
         bye: '#fcf4ed',
         invalid: 'gray',
      },

      margins: {
         top: 6,
         left: 10,
         right: 10,
         bottom: 0,
      },

      names: {
         first_initial: false,
         length_divisor: 9,
         max_font_size: 14,
         min_font_size: 10,
      },

      seeds: {
         limit: undefined,
      },

      scores: {
         max_font_size: 14,
         min_font_size: 10,
      },

      bracket: {
         positions: 4,
         initial_position: 1,
      },
   }

   var dfx = drawFx();

   var byes = [];
   var puids = [];
   var scores = [];
   var players = [];
   var matches = [];

   var events = {
      'score':    { 'click': null, 'mouseover': null, 'mouseout': null, 'contextmenu': null },
      'player':   { 'click': null, 'mouseover': null, 'mouseout': null, 'contextmenu': null },
      'info':     { 'click': null, 'mouseover': null, 'mouseout': null, 'contextmenu': null },
      'order':    { 'click': null, 'mouseover': null, 'mouseout': null, 'contextmenu': null },
      'result':   { 'click': null, 'mouseover': null, 'mouseout': null, 'contextmenu': null },
      'sizing' :  { 'width': null, },  // optional functions for sizeToFit
   };

   var intersection = (a, b) => a.filter(n => b.indexOf(n) !== -1).filter((e, i, c) => c.indexOf(e) === i);

   function chart(opts) {

      // insure that all score cells are defined
      for (let i=0; i<o.bracket.positions; i++) { if (!scores[i]) scores[i] = []; }
      dfx.tallyBracketResults({ players, matches });

      var root = d3.select(o.selector || 'body');
      if (o.cleanup) root.selectAll("svg").remove();

      // calculate dimensions
      if (o.sizeToFit || (opts && opts.sizeToFit)) {
         var dims = root.node().getBoundingClientRect();
         o.width = events.sizing.width ? events.sizing.width(root) : Math.max(dims.width, o.minWidth || 0);
         o.height = Math.max(dims.height, o.minHeight || 0);
      } else {
         o.width = o.width || Math.max(window.innerWidth, o.minWidth || 0);
         o.height = o.height || Math.max(window.innerHeight, o.minHeight || 0);
      }


      let playerHeight = o.height / o.bracket.positions + 1;
      if (playerHeight < o.minPlayerHeight) {
         playerHeight = o.minPlayerHeight;
         o.height = o.bracket.positions * o.minPlayerHeight;
      }

      let draw_width = o.width - o.margins.left - o.margins.right;
      let draw_height = o.height - o.margins.top - o.margins.bottom;

      let seed_limit = o.seeds.limit || dfx.seedLimit(players.length);

      // supporting functions
      let cellFill = (d) => {
         if (d.attr == 'order' && d.row && players[d.row - 1] && players[d.row - 1][d.attr]) {
            let player = players[d.row - 1];
            if (d.attr == 'order' && player.sub_order == 0) return 'lightyellow';
         }
         if (!d.row && d.column < 3) return 'none';
         if (d.mc != undefined && d.row == d.mc) return o.cells.invalid;
         if (d.attr == 'score' && d.players.filter(p=>p).length < 2) return o.cells.bye;
         return 'white';
      }
      let cellStroke = (d) => (d.row || d.column > 2) ? 'black' : 'none';
      let labelX = (d) => d.row && d.attr == 'player' ? d.x + 5 : d.x + d.width / 2;
      let labelY = (d) => {
         if (d.row) return d.y + d.height / 2;
         return d.y + d.height / 1.6;  // because row 0 is smaller...
      }
      let textAnchor = (d) => d.row && d.attr == 'player' ? 'start' : 'middle';
      let textColor = (d) => d.row && d.attr == 'player' ? 'black' : 'black';
      let textWeight = (d) => {
         let weight = 'normal';
         if (d.row && d.attr == 'order') weight = 'bold'; 
         if (d.row && d.attr == 'player' && d.seed && d.seed <= seed_limit) weight = 'bold';
         if (d.row && d.attr == 'player' && d.player && d.player.seed && d.player.seed <= seed_limit) weight = 'bold';
         if (d.row && d.attr == 'seed') weight = 'bold';
         return weight;
      }
      let playerName = (player) => {
         let length_threshold = 20;
         let first_initial = player.first_name ? `, ${player.first_name[0]}` : '';
         let first_name = player.first_name ? `, ${player.first_name}` : '';
         let first_first_name = player.first_name && player.first_name.split(' ').length > 1 ? `, ${player.first_name.split(' ')[0]}` : first_name;
         let last_name = player.last_name ? player.last_name : '';
         let last_first_i = `${last_name}${first_initial}`;
         let text = `${last_name}${first_name}`;
         if (text.length > length_threshold) text = `${last_name}${first_first_name}`;
         if (o.names.first_initial || text.length > length_threshold) text = last_first_i;

         return text;
      }
      let cellColor = (d) => {
         if (d.row && d.attr == 'score' && d.row != d.mc) {
            let sc = scores[d.row - 1][d.mc - 1];
            let num = sc ? sc.match(/\d+/g) : undefined;
            if (sc && !num) {
               let color = d.match.loser[0].draw_position == d.row ? 'red' : 'black';
            }
         }
         return 'black';
      }
      let cellText = (d) => {
         var player = d.row ? players[d.row - 1] : undefined;
         if (!d.row && d.attr == 'order') return '#';
         if (!d.row && d.attr == 'result') return '+/-';
         if (d.row == 0 && d.column < 6 || d.mc != undefined && d.row == d.mc) return '';

         if (d.row && d.attr == 'player' && d.bye) return 'BYE';

         // fill in last name for match column headers
         if (!d.row && d.attr == 'player') return d.player ? d.player.last_name.toUpperCase() || '' : '';
         if (d.row && d.attr == 'player') return d.player ? playerName(d.player) || '' : '';

         if (d.row && d.attr == 'seed' && players[d.row - 1] && players[d.row - 1].seed) {
            // don't display seed position for unranked players
            if (!players[d.row - 1].rank) return '';
            return (players[d.row - 1].seed <= seed_limit) ? players[d.row - 1].seed : '';
         }

         if (d.row && player && player[d.attr]) {
            if (d.attr == 'order' && player.sub_order) return `${player[d.attr]}-${player.sub_order}`;
            if (d.attr == 'club_code') return player.club_code;
            if (d.attr == 'result') return player.result || '0/0';

            if (d.attr == 'rank') {
               let value = player['rank'];
               let rank = value && !isNaN(value) ? parseInt(value.toString().slice(-4)) : undefined;
               if (rank && player.int && player.int > 0) rank = `{${player.int}}`;
               return rank || '';
            }
            return player[d.attr];
         }

         if (d.row && player && d.attr == 'club_code' && !player.club_code) {
            if (player.ioc) return player.ioc;
         }

         if (d.row && d.attr == 'score' && d.row != d.mc) {
            let sc = scores[d.row - 1][d.mc - 1];
            let num = sc ? sc.match(/\d+/g) : undefined;
            if (sc && !num) {
               let indicator = d.match.loser[0].draw_position == d.row ? '-' : '+';
               sc += ` (${indicator})`;
            }
            return sc;
         }
         return '';
      }

      // cellClass generates a unique selector
      let cellClass = (d) => {
         let column = d.column > 2 ? `_${d.column - 2}` : '';
         let base_class = `rr${o.bracket_index != undefined ? o.bracket_index : ''}_${d.attr}`;
         let specific_class = `${base_class}_${d.row}${column}`;

         // don't return additional clases for player cells when row < 1
         if (d.attr == 'player' && !d.row) return 'cell';

         if (d.attr == 'score' && d.players && d.players.filter(p=>p).length < 2) return 'cell bye_cell';

         // don't return additional classes for score cells when same player
         return (d.attr == 'score' && d.row == d.column - 2) ? 'cell' : `cell rr_${d.attr} ${base_class} ${specific_class}`;
      }

      let handleContextClick = (d) => {
         d3.event.preventDefault();
         if (events[d.attr] && typeof events[d.attr].contextmenu == 'function') events[d.attr].contextmenu(d);
      }

      let clickEvent = (d) => events[d.attr] && typeof events[d.attr].click == 'function' ? events[d.attr].click(d) : undefined;
      let mouseOver = (d) => events[d.attr] && typeof events[d.attr].mouseover == 'function' ? events[d.attr].mouseover(d) : undefined;
      let mouseOut = (d) => events[d.attr] && typeof events[d.attr].mouseout == 'function' ? events[d.attr].mouseout(d) : undefined;

      // construct round robin bracket
      let grid = cellGrid(draw_width, draw_height);
      let labels = textGrid(draw_width, draw_height);

      let svg = root.append("svg")
         .attr("width", draw_width + o.margins.left + o.margins.right)
         .attr("height", draw_height + o.margins.top + o.margins.bottom)
        .append("g")
         .attr("transform", "translate(" + (+o.margins.left) + "," + o.margins.top + ")");

      var cellrows = svg.selectAll(".cellrow")
         .data(grid)
        .enter().append("g")
         .attr("class", "cellrow");
         
      cellrows.selectAll(".cell")
         .data(d => d)
        .enter().append("rect")
         .attr("class", cellClass)
         .attr("x", d => d.x)
         .attr("y", d => d.y)
         .attr("width", d => d.width)
         .attr("height", d => d.height)

         .attr("attr", d => d.attr)
         .attr("row", d => d.row)
         .attr("column", d => d.column)

         .attr("opacity", 1)
         .style("fill", cellFill)
         .style("stroke", cellStroke)
         .on('mouseover', mouseOver)
         .on('mouseout', mouseOut)
         .on('click', clickEvent)
         .on('contextmenu', handleContextClick);

      var textrows = svg.selectAll(".textrow")
         .data(labels)
        .enter().append("g")
         .attr("class", "textrow");
         
      textrows.selectAll(".label")
         .data(d => d)
        .enter().append("text")
         .attr("class", "label")
         .attr("text-anchor", textAnchor)
         .attr("font-weight", textWeight)
         .attr("alignment-baseline", "middle")
         .attr("fill", textColor)
         .attr("x", labelX)
         .attr("y", labelY)
         .text(cellText)
         .style("font-size", textSize)
         .style("fill", cellColor)
         .on('mouseover', mouseOver)
         .on('mouseout', mouseOut)
         .on('click', clickEvent)
         .on('contextmenu', handleContextClick);

      function textSize(d) {
         let ctl = this.getComputedTextLength();
         let size = Math.round(d.width * 13 / ctl); 
         if (size > o.names.max_font_size) size = o.names.max_font_size;
         if (size < o.names.min_font_size) size = o.names.min_font_size;
         return size + "px"; 
      }
   }

   chart.reset = function() {
      byes = [];
      puids = [];
      scores = [];
      players = [];
      matches = [];
      return chart;
   }

   chart.selector = function (value) {
      if (!arguments.length) { return o.selector; }
      o.selector = value;
      return chart;
   };

   chart.bracketIndex = function(value) {
      if (!arguments.length) { return o.bracket_index; }
      o.bracket_index = value;
      return chart;
   }

   chart.width = function (value) {
      if (!arguments.length) { return o.width; }
      o.width = value;
      return chart;
   };

   chart.height = function (value) {
      if (!arguments.length) { return o.height; }
      o.height = value;
      return chart;
   };

   chart.sizeToFit = function (value) {
      if (!arguments.length) { return o.sizeToFit; }
      o.sizeToFit = value;
      return chart;
   };

   chart.options = function(values) {
      if (!arguments.length) return o;
      keyWalk(values, o);
      return chart;
   }

   chart.initialBracketPosition = function(position) {
      if (!arguments.length) return o.bracket.initial_position;
      o.bracket.initial_position = position;
      return chart;
   }

   chart.bracketPositions = function(positions) {
      if (!arguments.length) return o.bracket.positions;
      o.bracket.positions = positions;
      return chart;
   }

   chart.seedLimit = function(seed_limit) {
      if (!arguments.length) return o.seeds.limit;
      o.seeds.limit = seed_limit;
      return chart;
   }

   chart.addScores = function() {
      if (!matches.length) return chart;
      matches.forEach(match => {
         let p1, p2;

         if (match.winner_index != undefined) {
            p1 = puids.indexOf(match.puids[match.winner_index]);
            p2 = puids.indexOf(match.puids[1 - match.winner_index]);
         } else {
            p1 = puids.indexOf(match.puids[0]);
            p2 = puids.indexOf(match.puids[1]);
         }
         chart.addScore(p1, p2, match.score);
      });
      return chart;
   }

   chart.addScore = function(a, b, score) {
      if (!players[a] || !players[b]) return chart;
      if (!scores[a]) scores[a] = [];
      if (!scores[b]) scores[b] = [];
      scores[a][b] = score;
      scores[b][a] = dfx.reverseScore(score);
      return chart;
   }

   chart.addPlayer = function(player) {
      if (typeof player != 'object') return chart;
      if (!player.draw_position) return chart;
      if (player.draw_position < o.bracket.initial_position) return chart;
      if (player.draw_position > o.bracket.initial_position + o.bracket.positions - 1) return chart;
      let player_index = player.draw_position - o.bracket.initial_position;
      players[player_index] = player;
      puids[player_index] = player.puid;
      return chart;
   }

   chart.addPlayers = function(players) {
      if (!arguments.length) return players;
      if (!Array.isArray(players)) return chart;
      players.forEach(player => chart.addPlayer(player));
      return chart;
   }

   chart.addMatch = function(match) {
      if (typeof match != 'object') return chart;
   }

   chart.addMatches = function(match_array) {
      if (!arguments.length) return matches;
      matches = match_array;
      return chart;
   }

   chart.addByes = function(byz) {
      if (!arguments.length) return byes;
      if (Array.isArray(byz)) {
         byes = [];
         byz.forEach(b => { if (b.position) byes[b.position] = true });
      }
      return chart;
   }

   chart.events = function(obj) {
      if (!arguments.length) return events;
      keyWalk(obj, events);
      return chart;
   }

   function keyWalk(valuesObject, optionsObject) {
      if (!valuesObject || !optionsObject) return;
      var vKeys = Object.keys(valuesObject);
      var oKeys = Object.keys(optionsObject);
      for (var k=0; k < vKeys.length; k++) {
          if (oKeys.indexOf(vKeys[k]) >= 0) {
              var oo = optionsObject[vKeys[k]];
              var vo = valuesObject[vKeys[k]];
              if (oo && vo && typeof oo == 'object' && typeof vo !== 'function' && oo.constructor !== Array) {
                  keyWalk(valuesObject[vKeys[k]], optionsObject[vKeys[k]]);
              } else {
                  optionsObject[vKeys[k]] = valuesObject[vKeys[k]];
              }
          }
      }
   }

   function cellGrid(width=800, height=400, xstart=0, y=0) {
      let columns = [{ 'attr': 'info', 'pct': 12 },  { 'attr': 'seed', 'pct': 4 }, { 'attr': 'player', 'pct': 20 }];
      return grid(columns, width, height, xstart, y);
   }

   function textGrid(width=800, height=400, xstart=0, y=0) {
      // TODO: these need to be configurable options; at least the club_code should be configurable as .ioc
      let columns = [
         { 'attr': 'draw_position', 'pct': 4 },  
         { 'attr': 'rank', 'pct': 4 },  
         { 'attr': 'entry', 'pct': 4 },  
         { 'attr': 'seed', 'pct': 4 }, 
         { 'attr': 'player', 'pct': 16 },
         { 'attr': 'club_code', 'pct': 4 }
      ];
      return grid(columns, width, height, xstart, y);
   }

   function grid(columns, width=800, height=400, xstart=0, y=0) {
      let data = [];
      let calc_height = height / (o.bracket.positions + 1);
      let rowHeight = (r) => r ? calc_height : calc_height * .6;
      let cw = (p) => width * p / 100;

      for (let mc=0; mc < o.bracket.positions; mc++) { columns.push({ 'attr': 'score', 'pct': 50 / o.bracket.positions, mc }); }
      columns.push({ 'attr': 'result', 'pct': 7 });
      columns.push({ 'attr': 'order', 'pct': 7 });

      for (let row=0; row <= o.bracket.positions; row++) {
         let x = xstart;
         data.push(columns.map((column, i) => { 
            // attr definition handles special case: 1st row cells = player last names
            let attr = !row && column.attr == 'score' ? 'player' : column.attr;
            let cell = { 
               attr, x, y,
               row, column: i,
               width: cw(column.pct),
               height: rowHeight(row),
               bracket: o.bracket_index,
            }
            if (column.mc != undefined) cell.mc = column.mc + 1;
            if (cell.attr == 'player') cell.player = gridPlayer(cell);
            if (cell.attr == 'player' && !cell.player) checkBye(cell);
            if (cell.attr == 'score' && cell.row - 1 != cell.mc - 1) {
               let mp = matchPlayers(cell);
               let puids = mp.filter(f=>f).map(p=>p.puid);
               cell.match = matches.reduce((p, c) => (intersection(puids, c.puids).length == 2) ? c : p, undefined);
               // this is a redundant, but other functions rely on it (for now)
               cell.players = mp;
            }
            x += cw(column.pct);
            return cell;
         }));
         y += rowHeight(row);
      }
      return data;

      function matchPlayers(cell) { return [cell.row - 1, cell.mc - 1].map(o=>players[o]); }
      function gridPlayer(cell) {
         if (players[cell.row - 1]) return players[cell.row - 1];
         if (cell.mc && players[cell.mc - 1]) return players[cell.mc - 1];
         return '';
      }
      function checkBye(cell) {
         if (byes[cell.row]) cell.bye = true;
      }
   }

   return chart;
}

export function treeDraw() {
   let o = {
      selector: undefined,

      cleanup: true,      // first remove all svg from root
      sizeToFit: false,
      width: undefined,
      height: undefined,
      minWidth: undefined,
      minHeight: 100,
      minPlayerHeight: 30,
      maxPlayerHeight: 40,

      addByes: true,
      invert_first: false,
      invert_threshold: 140,

      draw: {
         feed_in: false,
      },

      seeds: {
         limit: undefined,
      },

      max_round: undefined,

      text: {
         bye: 'BYE',
         qualifier: 'Qualifier',
      },

      edit_fields: {
         display: true,
         color: 'gray',
         highlight_color: 'blue',
         opacity: .2,
      },

      schedule: {
         after: true,
         courts: true
      },

      flags: {
         display: false,
         threshold: 140,
         path: undefined,
      },

      lines: {
         stroke_width: 1,
      },

      margins: {
         top: 6,
         left: 10,
         right: 10,
         bottom: 0,
      },

      details: {
         draw_positions: false,
         player_rankings: false,
         club_codes: false,
         draw_entry: false,
         seeding: false,
      },

      detail_attr: {
         font_size: 10,
         seeding_font_size: 12,
      },

      detail_offsets: {
         base: 20,
         width: 20,
      },

      players: {
         offset_left: 3,
         offset_singles: -5,
         offset_score: 2,
         offset_doubles: -20,
         min_height: 20,
         max_height: 40,
      },

      clubs: {
         length_divisor: 3,
         threshold: 140,
      },

      names: {
         length_divisor: 9,
         max_font_size: 14,
         min_font_size: 10,
         seed_number: true,
         bold_seeds: true,
         first_initial: false,
      },

      scores: {
         max_font_size: 14,
         min_font_size: 10,
      },

      umpires: {
         display: true,
         offset: 15,
         color: '#777777',
      }
   }

   let datascan = {
      draw_positions: true,
      player_rankings: true,
      club_codes: true,
      draw_entry: true,
      seeding: true,
   }

   let dfx = drawFx();

   var root;
   let draw = {};
   let data = {};

   let events = {
      'position': { 'mouseover': highlightCell, 'mouseout': unHighlightCell, 'click': null, 'contextmenu': null },
      'player1' : { 'mouseover': highlightCell, 'mouseout': unHighlightCell, 'click': null, 'contextmenu': null },
      'player2' : { 'mouseover': highlightCell, 'mouseout': unHighlightCell, 'click': null, 'contextmenu': null },
      'p1club'  : { 'mouseover': highlightCell, 'mouseout': unHighlightCell, 'click': null, 'contextmenu': null },
      'p2club'  : { 'mouseover': highlightCell, 'mouseout': unHighlightCell, 'click': null, 'contextmenu': null },
      'score'   : { 'mouseover': null, 'mouseout': null, 'click': null, 'contextmenu': null },
      'umpire'   : { 'mouseover': null, 'mouseout': null, 'click': null, 'contextmenu': null },
      'sizing'  : { 'width': null, },  // optional functions for sizeToFit
   };

   function chart(opts) {

      root = d3.select(o.selector || 'body');

      if (!data || !Object.keys(data).length) {
         if (o.cleanup) root.selectAll("svg").remove();
         return;
      }

      // scan data to see if columns necessary
      var opponents = [].concat(...dfx.drawInfo(data).nodes.filter(n=>n.data.team).map(n=>n.data.team)).filter(f=>f);
      if (opponents && opponents.length) {
         datascan.draw_entry = opponents.reduce((p, c) => c.entry || p, undefined);
         datascan.seeding = opponents.reduce((p, c) => c.seed || p, undefined);
         datascan.player_rankings = opponents.reduce((p, c) => c.rank || p, undefined);
      }

      let left_column_offset = Object.keys(o.details).filter(f=>o.details[f] && datascan[f]).length * o.detail_offsets.width;
      if (left_column_offset) left_column_offset += o.detail_offsets.base;

      let seeding = o.details.seeding && datascan.seeding ? o.detail_offsets.width : 0;
      let club_codes = o.details.club_codes ? o.detail_offsets.width * 1 : 0;

      if (o.sizeToFit || (opts && opts.sizeToFit)) {
         var dims = root.node().getBoundingClientRect();
         o.width = events.sizing.width ? events.sizing.width(root) : Math.max(dims.width, o.minWidth || 0);
         o.height = Math.max(dims.height, o.minHeight || 0);
      } else {
         o.width = o.width || Math.max(window.innerWidth, o.minWidth || 0);
         o.height = o.height || Math.max(window.innerHeight, o.minHeight || 0);
      }

      if (o.addByes) dfx.addByes(data);
      let draw_hierarchy = d3.hierarchy(data);

      let info = dfx.drawInfo(data);
      let depth = info.depth;
      let doubles = info.doubles;
      let draw_positions = info.draw_positions;
      let max_draw_position = Math.max(...draw_positions);
      let total_players = draw_positions.length - info.byes.length;

      let playerHeight = o.height / draw_positions.length;
      let minPlayerHeight = (info.doubles ? 2 : 1) * o.minPlayerHeight;
      let maxPlayerHeight = (info.doubles ? 2 : 1) * o.maxPlayerHeight;
      if (playerHeight < minPlayerHeight) {
         o.height = draw_positions.length * minPlayerHeight;
         playerHeight = minPlayerHeight;
      } else if (playerHeight > maxPlayerHeight) {
         o.height = draw_positions.length * maxPlayerHeight;
         playerHeight = maxPlayerHeight;
      }

      let top_margin = Math.max(o.margins.top, doubles ? Math.abs(o.players.offset_doubles) : Math.abs(o.players.offset_singles));
      let draw_height = o.height - top_margin - o.margins.bottom;

      let draw_width;
      let round_width;
      let invert_first;

      let calcRoundWidth = () => {
         draw_width = o.width - o.margins.left - o.margins.right - left_column_offset;
         round_width = (draw_width / (depth + 1));
         invert_first = depth > 1 && !o.draw.feed_in && (o.invert_first || round_width < o.invert_threshold) ? true : false;
         if (invert_first) round_width = (draw_width / depth);
      }

      calcRoundWidth();
      if (round_width < o.clubs.threshold) {
         club_codes = 0;
         left_column_offset -= o.detail_offsets.width;
         calcRoundWidth();
      }
      let flags = round_width < o.flags.threshold ? false : o.flags.display && o.flags.path;

      // TODO: why is this divided by 12 and 1.5?
      let imagesize = Math.min(round_width / 12, playerHeight / 1.5);
      if (imagesize > 20) imagesize = 20;

      let length_threshold = round_width / o.names.length_divisor;

      let tree = o.draw.feed_in ? d3.tree() : d3.cluster();

      tree
          .separation((a, b) => a.parent === b.parent ? 1 : 1)
          .size([draw_height, draw_width - (invert_first ? 0 : round_width)]);

      let nodes = tree(draw_hierarchy).descendants();

      /* reverse so that final on the right hand side */
      nodes.forEach(n => n.y = draw_width + round_width - n.y);
    
      let links = nodes[0].links();

      if (invert_first) links[0].source.y = links[0].source.y - (2 * round_width);

      let elbow = (d, i) => {
         let targety = d.target.y;
         let ydiff = d.source.y - d.target.y;

         // horizontal offset
         let ho = seeding + (!o.draw.feed_in && ydiff - round_width > 1 ? round_width * 2 : round_width);

         if (ydiff - round_width > 1) targety = targety + round_width;

         if (d.target.depth == depth || (!o.draw.feed_in && d.target.depth < depth && !d.target.data.match)) ho = ho + left_column_offset - seeding;
         let eulerian = (n,r=0) => { for (i=n, r=n?1:0; i>1; i--) { r+=Math.pow(2, i)-1; } return r; }
         if (o.draw.feed_in && !d.target.children && d.source.depth < depth - 2) {
            let multiplier = eulerian((depth - d.source.depth) / 2 - 1);
            d.target.x = d.target.x + multiplier * (d.target.x - d.source.x);
         }

         return `M${d.source.y},${d.source.x}H${targety}V${d.target.x}${d.target.children ? "" : "h-" + ho}`;
      }

      // temporarily used for figuring out feed-in draw layout
      let pathColor = (d, i) => o.draw.feed_in && !d.target.children && d.source.depth < depth - 2 ? 'black' : 'black';

      if (o.cleanup) root.selectAll("svg").remove();

      let svg = root.append("svg")
          .style("shape-rendering", "crispEdges")
          .attr("width", draw_width + o.margins.left + o.margins.right + left_column_offset)
          .attr("height", draw_height + top_margin + o.margins.bottom)
        .append("g")
          .attr("transform", "translate(" + (left_column_offset + +o.margins.left - (invert_first ? 0 : round_width)) + "," + top_margin + ")");

      let link = svg.selectAll(".link")
          .data(links)
        .enter().append("path")
          .attr("class", "link")
          .attr("opacity", drawVisibility)
          .style("stroke", pathColor)
          .style("stroke-width", o.lines.stroke_width + "px")
          .style("shape-rendering", "geometricPrecision")
          .attr("d", elbow);

      let node = svg.selectAll(".node")
          .data(nodes)
        .enter().append("g")
          .attr("class", "node")
          .attr("transform", function(d) { return "translate(" + d.y + "," + d.x + ")"; });

      if (flags) {
         node.append('image')
             .attr('xlink:href', d => flagRef(d, 0))
             .attr('x', playerBaseX)
             .attr("y", -1 * imagesize + o.players.offset_singles / 2)
             .attr('height', imagesize + 'px')
             .attr('width', imagesize + 'px')

         node.append('image')
             .attr('xlink:href', d => flagRef(d, 1))
             .attr('x', playerBaseX)
             .attr("y", -1 * imagesize + o.players.offset_doubles)
             .attr('height', imagesize + 'px')
             .attr('width', imagesize + 'px')
      }

      if (o.edit_fields.display) {
         node.append('rect')
             .attr("class", "edit_field")
             .attr("x", playerBaseX)
             .attr("y", -1 * playerHeight/(doubles ? 1.5 : 1.5))
             .attr("width", editWidth)
             .attr("height", playerHeight/(doubles ? 1.5 : 1.5))
             .attr("opacity", editVisible)
             .attr("fill", o.edit_fields.color)
             .attr("dp", drawPosition)
             .on('click', events.position.click)
             .on('mouseover', events.position.mouseover)
             .on('mouseout', events.position.mouseout)
             .on('contextmenu', handleContextClick);

         function editWidth(d) {
            let width = round_width - o.players.offset_left;
            if (!d.height) width += club_codes;
            return width > 0 ? width : 0;
         }
      }

      function handleContextClick(d) {
         d3.event.preventDefault();

         let node = d3.select(this);
         // unhighlight any other previously clicked cells, if no action was taken
         chart.unHighlightCells();
         // highlight the cell that has been clicked
         d3.select(node.node().parentNode).select('rect').attr('fill', 'blue');

         if (typeof events.position.contextmenu == 'function') events.position.contextmenu(d);
      }

      let d3Line = d3.line()
         .x(d => invert_first ? d.x : d.x + round_width - seeding - club_codes)
         .y(d => d.y);

      function lineX(x) { return invert_first ? x - seeding - club_codes : x; }
      function lineY(y) { return y; }

      if (left_column_offset) {
         let lines = [{
             p: [{x: lineX(0), y: lineY(0)}, {x: lineX(0), y: lineY(draw_height)}], w: o.lines.stroke_width, c: 'black'
         }];
         if (seeding) {
            let line = {
               p: [{x: lineX(seeding), y: lineY(0)}, {x: lineX(seeding), y: lineY(draw_height)}], 
               w: o.lines.stroke_width, c: 'black'
            };
            lines.push(line);
         }

         svg.selectAll('.line')
            .data(lines)
           .enter().append('path')
            .attr('d', d => d3Line(d.p))
            .attr('stroke-width', d => d.w)
            .attr('stroke', d => d.c)
            .style("shape-rendering", "crispEdges");
      }

      if (o.details.draw_positions) {
         node.append("text")
            .attr("text-anchor", "middle")
            .attr("x", dpX)
            .attr("y", o.players.offset_singles)
            .html(dpText)
            .style("fill", "#000")
            .style("shape-rendering", "geometricPrecision")
            .style("font-size", o.detail_attr.font_size + 'px');
      }

      if (o.details.player_rankings && datascan.player_rankings) {
         node.append("text")
            .attr("text-anchor", "middle")
            .attr("x", prX)
            .attr("y", o.players.offset_singles)
            .html(d => prText(d, 0))
            .style("fill", "#000")
            .style("shape-rendering", "geometricPrecision")
            .style("font-size", o.detail_attr.font_size + 'px');

         node.append("text")
            .attr("text-anchor", "middle")
            .attr("x", prX)
            .attr("y", o.players.offset_singles + o.players.offset_doubles)
            .html(d => prText(d, 1))
            .style("fill", "#000")
            .style("shape-rendering", "geometricPrecision")
            .style("font-size", o.detail_attr.font_size + 'px');
      }

      if (o.details.draw_entry && datascan.draw_entry) {
         node.append("text")
            .attr("text-anchor", "middle")
            .attr("x", deX)
            .attr("y", o.players.offset_singles)
            .html(deText)
            .style("fill", "#000")
            .style("shape-rendering", "geometricPrecision")
            .style("font-size", o.detail_attr.font_size + 'px');
      }

      if (o.details.seeding && datascan.seeding) {
         node.append("text")
            .attr("text-anchor", "middle")
            .attr("x", seedX)
            .attr("y", o.players.offset_singles)
            .html(seedText)
            .style("font-weight", playerBold)
            .style("fill", "#000")
            .style("shape-rendering", "geometricPrecision")
            .style("font-size", o.detail_attr.seeding_font_size + 'px');
      }

      node.append("text")
          .attr("class", "name")
          .attr("text-anchor", "start")
          .attr("x", textX)
          .attr("y", o.players.offset_singles)
          .html(d => playerName(d, 0))
          .style("font-weight", playerBold)
          .style("fill", "#000")
          .style("shape-rendering", "geometricPrecision")
          .style("font-size", nameSize)
          .on('click', events.player1.click)
          .on('mouseover', events.player1.mouseover)
          .on('mouseout', events.player1.mouseout)
          .on('contextmenu', events.player1.contextmenu);

      node.append("text")
          .attr("class", "dbls")
          .attr("text-anchor", "start")
          .attr("x", textX)
          .attr("y", o.players.offset_singles + o.players.offset_doubles)
          .html(d => playerName(d, 1))
          .style("font-weight", playerBold)
          .style("fill", "#000")
          .style("shape-rendering", "geometricPrecision")
          .style("font-size", nameSize)
          .on('click', events.player2.click)
          .on('mouseover', events.player2.mouseover)
          .on('mouseout', events.player2.mouseout)
          .on('contextmenu', events.player2.contextmenu);

      if (club_codes && o.details.club_codes) {
         node.append("text")
             .attr("class", "name")
             .attr("text-anchor", "start")
             .attr("x", ccX)
             .attr("y", o.players.offset_singles)
             .html(d => clubCode(d, 0))
             .style("font-weight", playerBold)
             .style("fill", "#000")
             .style("shape-rendering", "geometricPrecision")
             .style("font-size", ccSize)
             .on('click', events.p1club.click)

         node.append("text")
             .attr("class", "dbls")
             .attr("text-anchor", "start")
             .attr("x", ccX)
             .attr("y", o.players.offset_singles + o.players.offset_doubles)
             .html(d => clubCode(d, 1))
             .style("font-weight", playerBold)
             .style("fill", "#000")
             .style("shape-rendering", "geometricPrecision")
             .style("font-size", ccSize)
             .on('click', events.p2club.click)

      }

      node.append("text")
          .attr("x", playerBaseX)
          .attr("y", o.players.offset_score)
          .attr("text-anchor", "start")
          .attr("dy", ".71em")
          .text(matchDetail)
          .style("fill", "#000")
          .style("shape-rendering", "geometricPrecision")
          .style("font-size", scoreSize)
          .on('click', events.score.click)
          .on('mouseover', events.score.mouseover)
          .on('mouseout', events.score.mouseout)
          .on('contextmenu', events.score.contextmenu);

      if (o.umpires.display) {
         node.append("text")
             .attr("x", playerBaseX)
             .attr("y", o.umpires.offset)
             .attr("text-anchor", "start")
             .attr("dy", ".71em")
             .text(umpireDetail)
             .style("fill", o.umpires.color)
             .style("stroke", o.umpires.color)
             .style("shape-rendering", "geometricPrecision")
             .style("font-size", scoreSize)
             .style("font-style", 'italic')
             .on('click', events.umpire.click)
             .on('mouseover', events.umpire.mouseover)
             .on('mouseout', events.umpire.mouseout)
             .on('contextmenu', events.umpire.contextmenu);
      }

      function matchDetail(d) {
         if (!d.data.match) return;
         if (d.data.match.score) return d.data.match.score;
         if (d.data.match.schedule) {
            let schedule = d.data.match.schedule;

            let time_string = [schedule.time_prefix || '', schedule.time || ''].join(' ');
            let schedule_after = o.schedule.after && schedule.after ? `~${schedule.after}` : '';
            let court_info = !o.schedule.courts ? '' : [schedule.heading || '', schedule.court || '', schedule_after].join(' ');
            return [time_string || '', court_info || ''].join(' ');
         }
      }

      function umpireDetail(d) {
         if (!d.data.match) return;
         if (d.data.match.umpire) return d.data.match.umpire.toUpperCase();
      }

      function nameSize(d) {
         let ctl = this.getComputedTextLength();
         let size = Math.round(round_width * o.names.length_divisor / ctl); 
         if (size > o.names.max_font_size) size = o.names.max_font_size;
         if (size < o.names.min_font_size) size = o.names.min_font_size;
         return size + "px"; 
      }

      function ccSize(d) {
         // club_code size
         let ctl = this.getComputedTextLength();
         let size = Math.round(round_width * o.clubs.length_divisor / ctl); 
         if (size > o.names.max_font_size) size = o.names.max_font_size;
         if (size < o.names.min_font_size) size = o.names.min_font_size;
         return size + "px"; 
      }

      function scoreSize(d) {
         let ctl = this.getComputedTextLength();
         let size = Math.round(round_width * 10 / ctl); 
         if (size > o.scores.max_font_size) size = o.scores.max_font_size;
         return size + "px"; 
      }

      function baseX(d, i) {
         let x = (-1 * round_width);
         // XXX: x + round_width evaluates to 0... 
         // but useful if defintion of x changes as in playerBaseX()
         return (i == 0 && invert_first) ? x + round_width : x;
      }

      function playerBaseX(d, i) {
         let base = (-1 * round_width) + o.players.offset_left;
         let x = (i == 0 && invert_first) ? base + round_width : base;
         return d.height ? x : x - club_codes;
      }

      function dpX(d, i) {
         let x = baseX(d, i) - left_column_offset + o.detail_offsets.width;
         return x;
      }

      function prX(d, i) {
         let x = baseX(d) - o.detail_offsets.base - seeding - club_codes;
         if (o.details.draw_entry && datascan.draw_entry) x -= o.detail_offsets.width;
         return x;
      }

      function seedX(d, i) {
         let x = baseX(d, i) - (seeding / 2) - club_codes;
         return x;
      }

      function deX(d, i) {
         let x = baseX(d, i) - o.detail_offsets.base - seeding - club_codes / 2;
         return x;
      }

      function prText(d, team) {
         if (!d.data.team) return '';
         // reverse order if doubles...
         if (d.data.team.length == 2) team = 1 - team;
         let player = d.data.team[team];
         if (!player || (o.draw.feed_in && d.depth < depth)) return '';
         let rank = player.rank && !isNaN(player.rank) ? parseInt(player.rank.toString().slice(-4)) : '';
         if (rank && player.int && player.int > 0) rank = `{${player.int}}`;
         return d.height || !rank ? '' : rank;
      }

      function seedText(d, i) {
         if (!d.data.team) return '';
         let player = d.data.team[0];
         if (!player || (o.draw.feed_in && d.depth < depth)) return '';
         return d.height ? '' : player.seed || '';
      }

      function deText(d, i) {
         if (!d.data.team) return '';
         let player = d.data.team[0];
         if (!player || (o.draw.feed_in && d.depth < depth)) return '';
         return d.height ? '' : player.entry ? player.entry : player.qualifier ? 'Q' : '';
      }

      function dpText(d, i) {
         if (!d.data) return '';

         if (d.data.team && d.data.team.length) {
            let player = d.data.team[0];
            if (!player || (o.draw.feed_in && d.depth < depth)) return '';
            if (!d.height && player.draw_position) return player.draw_position;
         }

         if (o.draw.feed_in && d.depth < depth) return '';
         return (!d.height && d.data.dp) ? d.data.dp : '';
      }

      function ccX(d, i) {
         let x = playerBaseX(d, i) + round_width - club_codes;
         return x;
      }

      function textX(d, i) {
         let x = playerBaseX(d, i);
         if (flags && d.data.team) x += imagesize + 2;
         return x;
      }

      function flagRef(d, which) { 
         if (d.data.team && d.data.team.length == 2) which = 1 - which;
         if (!d.data.team || !d.data.team[which] || !d.data.team[which].ioc || d.data.team[which].ioc.length != 3) return '';
         return `${o.flags.path}${d.data.team[which].ioc.toUpperCase()}.png`;
      }

      function playerBold(d) {
         if (!d.data.team || !o.names.bold_seeds) return 'normal';
         let player = d.data.team[0];
         if (!player) return 'normal';
         let seed = (player.seed && player.seed > 0 && player.seed <= (o.seeds.limit || dfx.seedLimit(total_players)));
         return seed ? 'bold' : 'normal';
      }

      function clubCode(d, which=0) {
         if (d.height || !d.data.team || !d.data.team[which]) return '';
         if (!d.data.team[which].club_code || d.data.team[which].club_code.length > 3) return '';
         // reverse the display order of players if doubles
         if (d.data.team.length == 2) which = 1 - which;
         return d.data.team[which].club_code;
      }

      function playerName(d, team=0) {
         if (!d.data.team) {

            // don't return info into team=1 position
            if (team || !d.data.match) return '';

            if (d.data.match.venue) return d.data.match.venue;
            if (d.data.match.score && d.data.match.complete == false) return 'Incomplete';

            return '';
         }

         // reverse the display order of players if doubles
         if (d.data.team.length == 2) team = 1 - team;

         let player = d.data.team[team];
         if (!player) return '';
         if (player.bye) return o.text.bye;
         if (player.qualifier && !player.last_name) return o.text.qualifier;

         let seeded_player = player.seed && player.seed <= (o.seeds.limit || dfx.seedLimit(total_players)); 
         let seed = (seeded_player && o.names.seed_number && !team) ? ` [${player.seed}]` : '';

         let first_initial = player.first_name ? `, ${player.first_name[0]}` : '';
         let first_name = player.first_name ? `, ${player.first_name}` : '';
         let first_first_name = player.first_name && player.first_name.split(' ').length > 1 ? `, ${player.first_name.split(' ')[0]}` : first_name;
         let last_name = player.last_name ? player.last_name : '';
         let last_first_i = `${last_name}${first_initial}${seed}`;
         let text = `${last_name}${first_name}${seed}`;
         if (text.length > length_threshold) text = `${last_name}${first_first_name}${seed}`;
         if (o.names.first_initial || text.length > length_threshold) text = last_first_i;

         return text;
      }
   }

   function drawVisibility(d) {
      return (o.max_round && d.target.height + 1 > o.max_round) ? 0 : 1;
   }

   function editVisible(d) {
      if (o.max_round && d.height > o.max_round) return 0;
      if (!d.height && !d.data.bye && !d.data.qualifier && !d.data.team) {
         let next_seed_group = dfx.nextSeedGroup({ draw: data });
         if (next_seed_group) {
            return (next_seed_group.positions && next_seed_group.positions.indexOf(d.data.dp) >= 0) ? o.edit_fields.opacity : 0;
         } else {
            return o.edit_fields.opacity;
         }
      }
      let info = dfx.drawInfo(data);
      return !info.unassigned.length && !d.data.team && dfx.teamMatch(d) ? o.edit_fields.opacity : 0;
   }

   function drawPosition(d) { return d.data.dp || '' }

   function highlightCell(d) {
      if (d.data.dp && d.data.team) { root.selectAll("[dp='" + d.data.dp + "']").attr('fill', o.edit_fields.highlight_color).attr('opacity', '.2'); }
   }

   function unHighlightCell(d) {
      if (d.data.dp && d.data.team) { root.selectAll("[dp='" + d.data.dp + "']").attr('fill', o.edit_fields.color).attr('opacity', editVisible(d)); }
   }

   chart.unHighlightCells = function() {
      root.selectAll(".edit_field").attr('fill', o.edit_fields.color);
   }

   chart.selector = function(value) {
      if (!arguments.length) { return o.selector; }
      o.selector = value;
      return chart;
   };

   chart.width = function(value) {
      if (!arguments.length) { return o.width; }
      o.width = value;
      return chart;
   };

   chart.height = function(value) {
      if (!arguments.length) { return o.height; }
      o.height = value;
      return chart;
   };

   chart.sizeToFit = function(value) {
      if (!arguments.length) { return o.sizeToFit; }
      o.sizeToFit = value;
      return chart;
   };

   chart.options = function(values) {
      if (!arguments.length) return o;
      keyWalk(values, o);
      return chart;
   }

   chart.dfxOptions = function(opts) {
      if (!arguments.length) return dfx.options();
      dfx.options(opts);
      return chart;
   }

   chart.events = function(functions) {
      if (!arguments.length) return events;
      keyWalk(functions, events);
      return chart;
   }

   chart.info = function() {
      if (!data || !Object.keys(data).length) return {};
      return dfx.drawInfo(data);
   }

   chart.nextSeedGroup = function() { return dfx.nextSeedGroup({ draw: data }); }
   chart.distributeByes = function() { return dfx.distributeByes({ draw: data }); }
   chart.distributeQualifiers = function() { return dfx.distributeQualifiers({ draw: data }); }

   chart.assignPosition = function(position, team = [{}], bye, qualifier) {
      if (!data || !Object.keys(data).length) return false;
      return dfx.assignPosition({ node: data, position, team, bye, qualifier });
   }

   chart.advancePosition = function({ position, score }) {
      if (!data || !Object.keys(data).length) return false;;
      return dfx.advancePosition({ node: data, position, score });
   }

   chart.modifyPositionScore = function({ position, score, complete }) {
      if (!data || !Object.keys(data).length) return false;;
      return dfx.modifyPositionScore({ node: data, position, score, complete });
   }

   chart.schedulePosition = function({ position, schedule, venue }) {
      if (!data || !Object.keys(data).length) return false;;
      return dfx.schedulePosition({ node: data, position, schedule, venue });
   }

   chart.matches = function(round_names) {
      return dfx.matches(data, round_names);
   }

   function keyWalk(valuesObject, optionsObject) {
      if (!valuesObject || !optionsObject) return;
      var vKeys = Object.keys(valuesObject);
      var oKeys = Object.keys(optionsObject);
      for (var k=0; k < vKeys.length; k++) {
          if (oKeys.indexOf(vKeys[k]) >= 0) {
              var oo = optionsObject[vKeys[k]];
              var vo = valuesObject[vKeys[k]];
              if (oo && typeof oo == 'object' && typeof vo !== 'function' && oo.constructor !== Array) {
                  keyWalk(valuesObject[vKeys[k]], optionsObject[vKeys[k]]);
              } else {
                  optionsObject[vKeys[k]] = valuesObject[vKeys[k]];
              }
          }
      }
   }

   chart.data = function(value) {
      if (!arguments.length) { return data; }
      data = value;
      o.max_round = data.max_round;
      return chart;
   }

   chart.placeSeedGroup = function(group_index) {
      return dfx.placeSeedGroup({ draw: data, group_index });
   }

   chart.unplacedSeedGroups = function() {
      return dfx.unplacedSeedGroups({ draw: data });
   }

   chart.advanceTeamsWithByes = function() {
      return dfx.advanceTeamsWithByes({ draw: data });
   }

   // works for 8 players without modification
   // TODO: add draw.dbl_elimination flag
   // and logic to handle rendering...
   chart.doubleElimination = function(teams) {
      o.draw.feed_in = true;
      data = dfx.doubleElimination(teams);
      chart();
   }

   chart.feedInDraw = function({ teams, feed_limit, offset }) {
      o.draw.feed_in = true;
      data = dfx.feedInDraw({ teams, feed_limit, offset });
      chart();
   }

   return chart;
}

export function drawFx(opts) {
   var fx = {};

   let unique = (arr) => arr.filter((item, i, s) => s.lastIndexOf(item) == i);
   let range = (start, end) => Array.from({length: (end - start)}, (v, k) => k + start);
   let indices = (val, arr) => arr.reduce((a, e, i) => { if (e === val) a.push(i); return a; }, []) 
   let occurrences = (val, arr) => arr.reduce((r,val) => { r[val] = 1+r[val] || 1; return r},{})[val] || 0;
   let intersection = (a, b) => a.filter(n => b.indexOf(n) !== -1).filter((e, i, c) => c.indexOf(e) === i);
   let randomPop = (array) => array.length ? array.splice(Math.floor(Math.random()*array.length), 1)[0] : undefined;
   let subSort = (arr, i, n, sortFx) => [].concat(...arr.slice(0, i), ...arr.slice(i, i + n).sort(sortFx), ...arr.slice(i + n, arr.length));

   var standard_draws = [2, 4, 8, 16, 32, 64, 128, 256];
   var draw_sizes = [2, 4, 8, 12, 16, 24, 32, 48, 64, 96, 128, 224, 256];
   var validDrawSize = (players) => draw_sizes.indexOf(players) >= 0;

   var o = {
      seed_limits: [ [0, 0], [4, 2], [11, 4], [21, 8], [41, 16], [97, 32] ],
      bye_placement: {
         "8": [2, 7, 5],
         "16": [2, 15, 11, 6, 7, 10, 14],
         "32": [2, 31, 23, 10, 15, 18, 26, 7, 6, 27, 19, 14, 11, 22, 30],
         "64": [2, 63, 47, 18, 31, 34, 50, 15, 10, 55, 39, 26, 23,42, 58, 7, 5, 60, 44, 21, 28, 37, 53, 12, 13, 52, 36, 29, 20, 45, 61]
      },
      compressed_draw_formats: true,
      fixed_bye_order: false,
      "seedPositions": {
         "1" : [["1", "0"]],
         "2" : [["0", "1"]],
         "3" : [["1", ".250"], [0, ".750"]],
         "5" : [["0", ".250"], [0, ".500"], [1, ".500"], [1, ".750"]],
         "9" : [["1", ".125"], [0, ".375"], [1, ".625"], [0, ".875"]],
         "13": [["0", ".125"], [1, ".375"], [0, ".625"], [1, ".875"]],
         "17": [["1", ".0625"], [0, ".1875"], [1, ".3125"], [0, ".4325"], [1, ".5625"], [0, ".6875"], [1, ".8125"], [0, ".9375"] ],
         "25": [["0", ".0625"], [1, ".1875"], [0, ".3125"], [1, ".4325"], [0, ".5625"], [1, ".6875"], [0, ".8125"], [1, ".9375"] ]
      }
   }

   if (opts) keyWalk(opts, o);

   fx.options = setOptions;
   function setOptions(options) { keyWalk(options, o); }

   fx.reverseScore = reverseScore;
   function reverseScore(score, split=' ') {
      let irreversible = null;
      if (score) {
         let reversed = score.split(split).map(parseSet).join(split);
         let result = (irreversible) ? `${irreversible} ${reversed}` : reversed;
         return result;
      }

      function parseSet(set) {
         let divider = set.indexOf('/') > 0 ? '/' : '-';
         let set_scores = set.split(divider).map(parseSetScore).reverse().filter(f=>f);
         let set_games = set_scores.map(s=>s.games);
         let tb_scores = set_scores.map(s=>s.tiebreak).filter(f=>f);
         let tiebreak = tb_scores.length == 1 ? `(${tb_scores[0]})` : '';
         let set_score = tb_scores.length < 2 ? set_games.join(divider) : set_games.map((s, i) => `${s}(${tb_scores[i]})`).join(divider);
         return `${set_score}${tiebreak}`;
      }

      function parseSetScore(set) {
         let ss = /(\d+)/;
         let sst = /(\d+)\((\d+)\)/;
         if (sst.test(set)) return { games: sst.exec(set)[1], tiebreak: sst.exec(set)[2] };
         if (ss.test(set)) return { games: ss.exec(set)[1] };
         irreversible = set;
         return undefined;
      }

      function formatSet(set) {
         if (set) {
            let tiebreak = set.tiebreak ? `(${set.tiebreak})` : '';
            return `${set.games}${tiebreak}`;
         }
      }
   }

   fx.acceptedDrawSizes = acceptedDrawSizes;
   function acceptedDrawSizes(num_players) {
      let dsizes = o.compressed_draw_formats ? draw_sizes : standard_draws;
      let i = 0;
      while (dsizes[i] < num_players) i += 1;
      return dsizes[i];
   }

   fx.qualDrawSize = qualDrawSize;
   function qualDrawSize(num_players) {
      let i = 0;
      while (draw_sizes[i] < num_players) i += 1;
      return draw_sizes[i];
   }

   fx.treeDrawMatchOrder = treeDrawMatchOrder;
   function treeDrawMatchOrder(draw) {
      return matches(draw).sort((a, b) => drawPosition(a) - drawPosition(b)).map(m=>m.match.muid);
      function drawPosition(match) { return !match.teams || !match.teams.length ? 1000 : match.teams[0][0].draw_position; }
   }

   fx.bracketMatches = bracketMatches;
   function bracketMatches(draw, bracket_index) {
      if (!draw || !draw.brackets) return [];
      let bracket = draw.brackets[bracket_index];
      let puidHash = (players) => players.map(p=>p.puid).sort().join('-');
      let addUnique = (arr, m) => { if (arr.map(puidHash).indexOf(puidHash(m)) < 0) arr.push(m); return arr; }

      pruneDefunctMatches();
      findMissingMatches();

      return bracket.matches;

      function pruneDefunctMatches() {
         // get an array of all match_ups:
         let match_ups = [].concat(...bracket.players.map(player => playerMatchups(player)).map(player => player.map(o => o.map(p=>p.puid))));
         let existing_match_ups = bracket.matches.map(match => match.players.map(p=>p.puid));
         let defunct = existing_match_ups.filter(emu => !match_ups.reduce((p, c) => intersection(emu, c).length == 2 || p, false));
         bracket.matches = bracket.matches.filter(match => {
            let pair = match.players.map(p=>p.puid);
            let obsolete = defunct.reduce((p, c) => intersection(pair, c).length == 2 || p, false);
            return !obsolete;
         });
      }

      function findMissingMatches() {
         [].concat(...bracket.players.map(playerMissingMatches))
            .reduce(addUnique, [])
            .forEach(addMatch);
      }

      function addMatch(players) {
         let match = {
            players,
            round_name: 'RR',
            bracket: bracket_index,
            puids: players.map(p=>p.puid),
         }
         bracket.matches.push(match);
      }

      function playerMissingMatches(player) {
         let player_matchups = playerMatchups(player);
         let matches_hash = bracket.matches.map(m=>puidHash(m.players));
         let missing = player_matchups.filter(pm => {
            let index = matches_hash.indexOf(puidHash(pm));
            return index < 0;
         });
         return missing;
      }

      function playerMatchups(player) {
         let opponents = bracket.players.filter(p=>p.puid != player.puid);
         return opponents.map(o=>[player, o]);
      }
   }

   fx.roundRobinRounds = roundRobinRounds;
   function roundRobinRounds(draw) {
      if (!draw || !draw.brackets || !draw.brackets.length) return;

      let rounds = [];
      let rrbr = draw.brackets.map(bracketRounds);
      let max_rounds = Math.max(...rrbr.map(r=>r.length));
      for (let r=0; r<max_rounds; r++) { rounds.push(rrbr.map((br, b) => ({ bracket: b, matchups: bracketMatches(b, br[r]) })).filter(f=>f.matchups)); }
      return rounds;

      function bracketMatches(bracket_index, matchups) {
         if (!matchups) return;
         let matches = draw.brackets[bracket_index].matches;
         let matchhashes = matchups.map(m=>m.join('|'));
         return matches.filter(m=>matchhashes.indexOf(m.players.map(p=>p.draw_position).join('|')) >= 0);
      }
   }

   fx.bracketRounds = bracketRounds;
   function bracketRounds(bracket) {
      if (!bracket || !bracket.matches || !bracket.matches.length) return;

      let rounds = [];
      let pairings = bracket.matches.map(m=>m.players.map(p=>p.draw_position)).sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]));
      let draw_positions = bracket.players.map(p=>p.draw_position);
      let excluded_last_round = [];

      while(extractRound()) {};

      function extractRound() {
         if (!pairings || !pairings.length) return;

         let matchups = [];
         if (excluded_last_round.length) {
            let index = pairings.reduce((p, c, i) => p ? p : (intersection(c, excluded_last_round).length) ? i : p, undefined);
            matchups = pairings.splice(index, 1);
         } else {
            matchups = [pairings.shift()];
         }
         while(findMatch()) {};

         function findMatch() {
            let positions = [].concat(...matchups);
            let possible = pairings.filter(pair => !intersection(positions, pair).length);
            if (possible.length) {
               matchups.push(possible[0]);
               pairings = pairings.filter(pair => !(pair[0] == possible[0][0] && pair[1] == possible[0][1]));
            }
            return possible.length;
         }
         rounds.push(matchups);
         let matched = [].concat(...matchups);
         excluded_last_round = draw_positions.filter(f=>matched.indexOf(f) < 0);
         return true;
      }

      return rounds;
   }

   function bracketDrawPositions(draw) {
      return [].concat(...draw.brackets.map((b, i) => d3.range(draw.bracket_size).map((p, j) => ({ bracket: i, position: j+1 }))));
   }

   function rrInfo(draw) {
      let draw_positions = bracketDrawPositions(draw);
      let byes = (draw.brackets.length * draw.bracket_size) - draw.opponents.length;
      let matches = [].concat(...draw.brackets.map(b=>b.matches)); 

      let total = (a, b) => a + b;
      let total_matches = draw.brackets.map((b, i) => range(0, b.players.length).reduce(total, 0)).reduce(total, 0);

      let seed_placements = [].concat(...draw.seed_placements.map(s=>s.placements)).map(p=>p.position);
      let unfinished_seed_placements = draw.seed_placements.filter(s=>s.range.length != s.placements.length);

      let unseeded_placements = draw.unseeded_placements ? draw.unseeded_placements.map(u=>u.position) : [];
      let placements = [].concat(seed_placements, draw.bye_placements || [], unseeded_placements);
      let hashFx = (h) => [h.bracket, h.position].join('|');
      let p_hash = placements.map(hashFx);
      let unfilled_positions = draw_positions.filter(p=>p_hash.indexOf(hashFx(p)) < 0);
      let complete = draw.brackets.map(bracketComplete).reduce((a, b) => a && b);
      let positions_filled = unseeded_placements && unseeded_placements.length && draw.unseeded_placements.length == draw.unseeded_teams.length;

      let unplaced_seeds = [];
      let open_seed_positions = [];
      if (unfinished_seed_placements.length) {
         let placed_seeds = unfinished_seed_placements[0].placements.map(p=>p.seed);
         unplaced_seeds = unfinished_seed_placements[0].range.filter(s => placed_seeds.indexOf(s) < 0).map(r => draw.seeded_teams[r]);
         let p_hash = unfinished_seed_placements[0].placements.map(p=> hashFx(p.position));
         open_seed_positions = unfinished_seed_placements[0].positions.filter(p=>p_hash.indexOf(hashFx(p)) < 0);
      }

      return {
         draw_type: 'roundrobin',
         draw_positions, matches, positions_filled, complete,
         byes, placements, unfilled_positions, total_matches,
         unfinished_seed_placements, unplaced_seeds, open_seed_positions,
      }
   }

   function treeInfo(draw) {
      let calc_tree = d3.tree();
      let draw_hierarchy = d3.hierarchy(draw);
      let nodes = calc_tree(draw_hierarchy).descendants();

      let depth = Math.max(...nodes.map(n => n.depth));
      let byes = nodes.filter(n=>!n.height && n.data.bye);
      let structural_byes = nodes.filter(f=>f.height == 0 && f.depth != depth);

      let match_nodes = nodes.filter(n=>matchNode(n));
      let all_matches = nodes.filter(n=>n.children && n.children.length == 2 && (!draw.max_round || n.height <= draw.max_round));
      var upcoming_match_nodes = all_matches.filter(n=>n.children && (qualifierChild(n) || (!matchNode(n) && upcomingChild(n))));
      let doubles = nodes
         .map(n => n.data.team ? n.data.team.length > 1 : false)
         .reduce((a, b) => a || b);
      let draw_positions = unique(nodes.map(n => n.data.dp)).filter(f=>f);
      let qualifiers = nodes.filter(n=>!n.height && n.data.qualifier);
      let seeds = nodes
         .filter(n=>!n.height && n.data.team && n.data.team[0] && n.data.team[0].seed)
         .sort((a, b) => a.data.team[0].seed - b.data.team[0].seed);
      let final_round = draw.max_round ? nodes.filter(f=>f.height == draw.max_round) : nodes.filter(f=>f.depth == 0);
      let final_round_players = match_nodes
         .filter(m=>draw.max_round ? m.height == draw.max_round : !m.depth)
         .map(m=>m.data.team);
      let unassigned = nodes.filter(n=>!n.height && !n.data.team && !n.data.bye && !n.data.qualifier);

      let assignments = [].concat(...nodes.filter(f=>!f.height && f.data.team && !f.data.qualifier && !f.data.bye).map(node=>node.data.team.map(p=>({ [p.id]: node.data.dp }))));
      let assigned_positions = assignments.length ? Object.assign(...assignments) : {};

      let total_matches = all_matches.length - byes.length;
      let complete = match_nodes.filter(validMatch).map(n=>byeChild(n) || (n.data.match && n.data.match.complete)).reduce((p, c) => c && p, true);

      function byeChild(n) { return n.children.map(c=>c.data.bye).reduce((p, c) => c || p, false); }
      function qualifierChild(n) { return !byeChild(n) && n.children.map(c=>c.data.qualifier).reduce((p, c) => c || p, false); }
      function validMatch(n) { return !draw.max_round || n.height <= draw.max_round; }
      function isStructuralBye(child) { return structural_byes.map(s=>s.data.dp).indexOf(child.data.dp) >= 0; }
      function upcomingChild(n) { return n.children.map(c=>ucmatch(c)).filter(f=>f).length == 2; }
      function ucmatch(c) { return matchNode(c) || ( isStructuralBye(c) && !c.data.children); }

      return {
         draw_type: 'tree', complete,
         draw_positions, assigned_positions, seeds, doubles,
         total_matches, all_matches, match_nodes, upcoming_match_nodes, nodes, depth,
         byes, structural_byes, qualifiers, final_round, final_round_players, unassigned,
      };
   }

   fx.bracketComplete = bracketComplete;
   function bracketComplete(bracket) {
      return bracket.matches && bracket.matches.length && bracket.matches.filter(m=>m.winner).length == bracket.matches.length;
   }

   fx.drawInfo = drawInfo;
   function drawInfo(draw) {
      if (!draw) return;
      if (draw.brackets) return rrInfo(draw);
      if (draw.children) return treeInfo(draw);
   }

   fx.blankDraw = blankDraw;
   function blankDraw(players, offset = 0) {
      if (isNaN(players) || !validDrawSize(players)) return undefined;

      // function dp(x) { return { dp: offset + x }; }
      let dp = (x) => ({ dp: offset + x });
      let positions = Array.from(new Array(players),(val,index)=>index+1);

      return positions.map(dp);
   }

   fx.addByes = addByes;
   function addByes(draw) {
      let info = drawInfo(draw);
      let draw_positions = info.draw_positions;
      let max_draw_position = draw_positions.length ? Math.max(...draw_positions) : 0;
      let missing_draw_positions = max_draw_position ? Array.from(new Array(max_draw_position),(val,index)=>index+1).filter(p=>draw_positions.indexOf(p) < 0) : [];
      let chooseDrawPosition = (dp) => {
         let np = missing_draw_positions.filter(p => Math.abs(dp - p) == 1)[0];
         return np || '';
      }

      walkNode(draw);

      function walkNode(node, descent = 0) {
         if (descent < info.depth && !node.children) {
            let position = node.team && node.team[0].draw_position >= max_draw_position/2 ? 0 : 1;
            addBye(node, position);
         }
         if (node.children) node.children.forEach(child => walkNode(child, descent + 1));
      }

      function addBye(node, position = 1) {
         let team = node.team;
         let bye = { bye: true, team: [{ draw_position: '', bye: true }] };
         let player = { dp: node.dp, id: node.id, team };
         node.children = position ? [player, bye] : [bye, player];
         node.match = { score: '' };
      }
   }

   // return positions of structural byes
   fx.structuralByes = structuralByes;
   function structuralByes(players, bit_flip) {
      let s = sByes(players);
      let cluster_size = players / s;
      let clusters = players / cluster_size;
      let cluster = 1;
      let bye_positions = [];
      while (cluster <= clusters) {
         let odd = cluster % 2;
         if (bit_flip && cluster > 1 && cluster < clusters) odd = 1 - odd;
         if (odd) {
            bye_positions.push((cluster - 1) * cluster_size + 1);
         } else {
            bye_positions.push((cluster) * cluster_size);
         }
         cluster += 1;
      }
      return bye_positions;

      // number of structural byes
      function sByes(players) {
         if (p2(players)) return 0;
         let b=1;
         while (b < players && !p2(players - b)) { b += 1 };
         return b;
      }

      // check for power of 2
      function p2(n) {
         if (isNaN(n)) return false; 
         return n && (n & (n - 1)) === 0;
      }

   }

   fx.dispersion = dispersion;
   function dispersion(num_players, depth) {

      let values = [];
      let p = num_players;
      while (div2(p)) {
         values.push(p);
         p = p / 2;
      }

      let d = 0;
      let positions = [];
      values.forEach(value => {
         if (d == depth) {
            positions.push(value);
            positions.push(num_players - value + 1);
         }
         d += 1;
      });
      positions.sort((a, b) => a - b);
      return positions;

      function div2(n) {
         if (isNaN(n)) return false; 
         return n / 2 == Math.floor(n / 2);
      }

   }

   fx.buildRound = buildRound;
   function buildRound(draw, byes = []) {
      let round = [];
      let pos = 0;
      while (pos < draw.length) {
         if (byes.indexOf(pos + 1) >= 0) {
            let match = draw[pos];
            round.push(match);
            pos += 1;
         } else {
            let match = { children: [ draw[pos], draw[pos + 1]] };
            round.push(match);
            pos += 2;
         }
      }
      return round;
   }

   fx.feedRound = feedRound;
   function feedRound(draw, remaining) {
      let round = [];
      let pos = 0;
      while (pos < draw.length) {
         let opponent = remaining.pop();
         let match = { children: [ draw[pos], opponent] };
         round.push(match);
         pos += 1;
      }
      return { round, remaining };
   }

   // TODO: Total Mess unless treeDraw() is configured properly
   // which means (for now) options({ draw: { feed_in: true }});
   fx.doubleElimination = doubleElimination;
   function doubleElimination(teams) {
      let total_positions = Array.isArray(teams) ? teams.length : teams;
      let main = buildDraw({ teams: total_positions });
      let feed = feedInDraw({ teams: acceptedDrawSizes(total_positions / 2), offset: total_positions });
      let children = [main, feed];
      return { children };
   }

   fx.feedInDraw = feedInDraw;
   function feedInDraw({ teams, skip_rounds = 0, feed_rounds = 10, offset }) {
      let total_positions = Array.isArray(teams) ? teams.length : teams;
      if (total_positions < 3) return;
      let up2 = (x) => Math.pow(2, Math.ceil(Math.log(x)/Math.log(2)));
      let positions = blankDraw(up2(total_positions + 1), offset);

      let remaining = positions.slice(positions.length / 2).reverse();
      let round = buildRound(positions.slice(0, positions.length / 2));

      while (skip_rounds) {
         round = buildRound(round);
         skip_rounds -= 1;
      }

      let fed = 0;
      if (round.length > 1) {
         ({round, remaining} = feedRound(round, remaining));
         fed += 1;
      }

      while (round.length > 1) {
         round = buildRound(round);
         if (round.length > 1 && fed < feed_rounds) {
            if (fed >= skip_rounds) ({round, remaining} = feedRound(round, remaining));
            fed += 1;
         }
      }
      ({round, remaining} = feedRound(round, remaining));
      return round && round.length ? round[0] : round;
   }

   fx.buildDraw = buildDraw;
   function buildDraw({ teams, structural_byes, offset = 0 }) {

      let round;
      if (Array.isArray(teams)) {
         round = teams.map((t, i) => ({ dp: offset + i + 1, team: t }) );
      } else {
         if (isNaN(teams) || !validDrawSize(teams)) return undefined;
         round = blankDraw(teams, offset);
      }

      structural_byes = structural_byes || structuralByes(round.length);

      round = buildRound(round, structural_byes);
      while (round.length > 1) { round = buildRound(round); }
      return round[0];
   }

   fx.buildQualDraw = buildQualDraw;
   function buildQualDraw(num_players, num_qualifiers) {
      let group_size = Math.ceil(num_players/num_qualifiers);
      let section_size = qualDrawSize(group_size);
      let sections = Array.from(new Array(num_qualifiers),(val,i)=>i);
      let children = sections.map((u, i) => buildDraw({teams: section_size, offset: i * section_size}));
      let max_round = d3.hierarchy(children[0]).height;
      return { children, max_round }
   }

   fx.assignPosition = assignPosition;
   function assignPosition({ node, position, team = [{}], bye, qualifier, propagate, assigned }) {
      if (!node || !position) return assigned;
      if (node.dp == position) {
         node.team = team;
         node.team.forEach(player => {
            player.draw_position = position
            player.bye = bye;
            player.qualifier = qualifier;
            player.entry = player.entry ? player.entry : qualifier ? 'Q' : '';
         });
         node.bye = bye;
         node.qualifier = qualifier;
         assigned = true;
         if (!propagate) return assigned
      }
      if (node.children) {
         let result = node.children.map(child => assignPosition({ node: child, position, team, bye, qualifier, propagate, assigned }));
         return result.reduce((a, b) => a || b);
      }
   }

   fx.findPositionNode = findPositionNode;
   function findPositionNode({ node, position, ancestor }) {
      if (node.dp == position) return node;
      if (!node.children) return;

      // if position in node children, get index;
      let cdpi = node.children.map(c => c.dp).indexOf(position);

      if (cdpi >= 0) {
         if (ancestor) node.ancestor = ancestor;
         return node;
      } else {
         return [].concat(...node.children.map(child => findPositionNode({ node: child, position, ancestor: node }))).filter(f=>f)[0];
      }
   }

   fx.advancePosition = advancePosition;
   function advancePosition({ node, position, score, set_scores, score_format }) {
      let position_node = findPositionNode({ node, position });

      // don't advance if position_node already contains player
      if (!position_node || position_node.dp) return;

      return advanceToNode({ node: position_node, position, score, set_scores, score_format });
   }

   fx.advanceToNode = advanceToNode;
   function advanceToNode({ node, position, score, set_scores, complete, score_format }) {
      // cannot advance if no position node
      if (!node) { advanced: false };
      if (!node.match) node.match = {};

      // if there is an existing position assigned to node
      // AND if there is a node ancestor with an assigned position
      // THEN if the attempted assignment is not the same, fail
      if (node.dp && node.ancestor && node.ancestor.dp && node.ancestor.dp == node.dp && position != node.dp) {
         return { advanced: false, error: 'Cannot change match outcome with subsequent match(es)' };
      }

      if (node.dp && node.ancestor && node.ancestor.dp && !complete) {
         return { advanced: false, error: 'Cannot enter an incomplete match score with subsequent matche(es)' };
      }

      // if position in node children, get index;
      let cdpi = node.children.map(c => c.dp).indexOf(position);
      let teams = node.children.map(c => c.team).filter(f=>f);
      let teamIsBye = (team) => team.map(p => p.bye).reduce((a, b) => a && b);

      if (teams.length == 2 && cdpi >= 0) {
         if (teamIsBye(teams[cdpi])) {
            return { advanced: false };
         } else {
            let opponent_is_bye = teamIsBye(teams[1 - cdpi]);
            advance(opponent_is_bye);
            return { advanced: true };
         }
      }

      return { advanced: false };

      function advance(opponent_is_bye) {
         node.children.forEach((child, i) => {
            if (child.dp == position) {
               node.dp = position;
               node.team = child.team;
               if (!opponent_is_bye) {
                  node.match.score = score;
                  node.match.winner_index = i;
                  node.match.winner = child.team;
                  node.match.set_scores = set_scores;
                  node.match.score_format = score_format;
               }
            } else {
               if (!opponent_is_bye) node.match.loser = child.team;
            }
         });
      }
   }

   fx.findMatchNodeByPosition = findMatchNodeByPosition;
   function findMatchNodeByPosition({ node, position }) {
      let position_node = findPositionNode({ node, position });
      if (!position_node) return;

      let target_node;
      if (position_node.dp == position) {
         target_node = position_node;
      } else {
         // if position in node children, get index;
         let cdpi = position_node.children.map(c => c.dp).indexOf(position);
         target_node = position_node.children[cdpi];
      }
      if (!target_node.children) return;

      let teams = target_node.children.map(c => c.team).filter(f=>f);
      let teamIsBye = (team) => team.map(p => p.bye).reduce((a, b) => a && b);
      let byeTeam = teams.map(t => teamIsBye(t)).reduce((a, b) => a && b);

      if (teams.length == 2 && !byeTeam) return target_node;
   }

   fx.modifyPositionScore = modifyPositionScore;
   function modifyPositionScore({ node, positions, score, set_scores, complete, score_format }) {
      let target_node = findMatchNodeByTeamPositions(node, positions);

      if (!target_node) return;
      if (!target_node.match) target_node.match = {};
      target_node.match.score = score;
      target_node.match.set_scores = set_scores;
      target_node.match.score_format = score_format;
      if (complete != undefined) target_node.match.complete = complete;

      // if match is incomplete remove any outdated attributes
      if (!complete) {
         delete target_node.team;
         delete target_node.match.loser;
         delete target_node.match.winner;
         delete target_node.match.winner_index;
      }
   }

   fx.schedulePosition = schedulePosition;
   function schedulePosition({ node, position, schedule, venue }) {
      let target_node = findPositionNode({ node, position });
      if (!target_node.match) target_node.match = {};
      target_node.match.schedule = schedule;
      target_node.match.venue = venue;
   }

   fx.seedLimit = seedLimit;
   function seedLimit(total_players) {
      let limit = 0;
      o.seed_limits.forEach(threshold => { if (total_players >= threshold[0]) limit = threshold[1]; });
      return limit;
   }

   // assumes an array of players sorted by rank
   fx.assignSinglesSeeds = assignSinglesSeeds;
   function assignSinglesSeeds(players, seed_limit) {

      // get power of 2 less than or equal to seed_limit
      // not the most efficient, but good enough for this requirement
      let lp2 = (x) => Math.pow(2, Math.floor(Math.log(x)/Math.log(2)));
      seed_limit = lp2(seed_limit || seedLimit(players.length));

      // TODO: don't assign seed if a player is a qualifier?
      players.forEach((player, i) => { if (i < seed_limit) player.seed = i + 1; });

      return seed_limit;
   }

   fx.roundrobinSeedPlacements = roundrobinSeedPlacements;
   function roundrobinSeedPlacements({ draw, bracket_size }) {
      let placements = [];
      let bracket_count = draw.brackets.length;
      let seeded_team_keys = Object.keys(draw.seeded_teams);
      let auto_placed_seeds = seeded_team_keys.slice(0, bracket_count);
      let random_placed_seeds = seeded_team_keys.slice(bracket_count);

      // Minimum one seed in first position for each bracket
      d3.range(auto_placed_seeds.length).forEach(s => {
         let bracket = draw.brackets[s % bracket_count];
         placements.push({ 
            range: [s + 1], 
            positions: [{ bracket: s % bracket_count, position: 1 }], 
            placements: [] 
         });
      });

      // final position of each bracket is available for other seeds to be placed randomly
      let range = [];
      let positions = [];
      d3.range(bracket_count).forEach(s => {
         let seed_index = auto_placed_seeds.length + s;
         let bracket = draw.brackets[seed_index % bracket_count];

         // the range is restricted by the number of remaining seeds
         if (s < random_placed_seeds.length) range.push(seed_index + 1);
         // but the positiosn are available in each bracket
         positions.push({ bracket: seed_index % bracket_count, position: bracket_size }); 
      });

      // randomize the order
      d3.shuffle(positions);
      placements.push({ range, positions, placements: [] });

      return placements;
   }

   fx.qualifyingBracketSeeding = qualifyingBracketSeeding;
   function qualifyingBracketSeeding({ draw, num_players, qualifiers, seed_limit }) {

      let group_size = Math.ceil(num_players/qualifiers);
      let section_size = qualDrawSize(group_size);
      let sections = Array.from(new Array(qualifiers),(val,i)=>i);

      let placements = [];
      let seeded_team_keys = Object.keys(draw.seeded_teams);

      let auto_placed_seeds = seeded_team_keys.slice(0, qualifiers);
      let random_placed_seeds = seeded_team_keys.slice(qualifiers);

      // Minimum one seed in first position for each section
      d3.range(auto_placed_seeds.length).forEach(s => {
         let position = (s % qualifiers) * section_size + 1;
         placements.push({ 
            range: [s + 1], 
            placements: [], 
            positions: [position] 
         });
      });

      let range = [];
      let positions = [];

      d3.range(random_placed_seeds.length).forEach(s => {
         let seed_index = auto_placed_seeds.length + s;
         range.push(seed_index + 1);
      });

      // with some qualification draws there are more placement options than seeds to be placed
      d3.range(auto_placed_seeds.length).forEach(s => {
         let position = ((s % qualifiers) * section_size) + section_size;
         positions.push(position);
      });

      d3.shuffle(positions);
      placements.push({ range, positions, placements: [] });

      return placements;
   }

   fx.validSeedPlacements = validSeedPlacements;
   function validSeedPlacements({ num_players, random_sort=false, seed_limit }) {

      let i = 1;
      let placements = [];
      let draw_size = acceptedDrawSizes(num_players);
      seed_limit = seed_limit || seedLimit(num_players || draw_size);

      // range of player positions
      let positions = (s, n) => Array.from(new Array(n),(val,i)=>i+s);

      function seedPositions(i, draw_size) { return o.seedPositions[i].map(d => +d[0] + draw_size * d[1]); }

      while (i <= seed_limit) {
         // array of possible placement positions
         let p = seedPositions(i, draw_size);

         // if sort then sort seed groupings
         // if (random_sort) p = p.sort(() => 0.5 - Math.random());
         if (random_sort) d3.shuffle(p);

         placements.push({ range: positions(i, p.length), positions: p, placements: [] }); 
         i += p.length || draw_size;
      }
      return placements;
   }

   /*
      Byes drawn to the top half of the draw shall be positioned on even-numbered lines; byes drawn to the bottom half
      of the draw shall be positioned on odd-numbered lines.

      If group seeding is used and there are fewer byes available than there are players in the group, then a drawing
      is used to determine which seeds within the group get the available byes. 

      TODO: Byes should have a bye-order attribute for this...
      The Referee should note the order in which the remaining byes are placed in the draw in the event that this information is
      needed later for placing an omitted player in the draw

      • First, distribute byes to all the seeds.
      • Second, distribute byes so that the seeded players who receive byes will be playing other players who have
        also received byes. If there are not enough byes so that every seeded player is playing another player who has
        received a bye, then position these byes adjacent to the seeded players starting with the lowest seeded player.
      • Third, distribute a pair of byes in the fourth quarter of
        the draw starting from the bottom up; distribute a pair of byes in the first quarter of the draw starting from
        the top down; distribute a pair of byes in the third quarter of the draw starting from the bottom up; distribute
        a pair of byes in the second quarter of the draw starting from the top down; and repeat the cycle
        (fourth quarter, first quarter, third quarter, and second quarter) until all the byes have been distributed.A
   */

   // distributeByes must occur after seed_positions have been determined
   // EXCEPT for pre-rounds where all ranked players are seeded...
   // seed_positions is an array of positions which has been sorted by seed #'s
   // such that byes are handed out to seeds in order: 1, 2, 3...
   fx.distributeByes = distributeByes;
   function distributeByes({ draw, num_players }) {
      let info = drawInfo(draw);
      let seed_positions = info.seeds.map(m=>m.data.dp);
      let randomBinary = () => Math.floor(Math.random() * 2);

      num_players = num_players || ((draw.opponents ? draw.opponents.length : 0) + (draw.qualifiers || 0));

      // bye_positions is an array of UNDEFINED with length = # of byes
      // constructed by slicing from array number of actual teams/players
      let bye_positions = info.draw_positions.map(m=>undefined).slice(num_players);

      // all draw positions which have a first-round opponent (no structural bye);
      let paired_positions = info.nodes.filter(f=>f.height == 1 && f.children).map(m=>[].concat(...m.children.map(c=>c.data.dp)));

      // first round matches with no seeded position
      let pairs_no_seed = paired_positions.filter(f=>intersection(seed_positions, f).length < 1);

      // first round matches with seeded position
      let pairs_with_seed = paired_positions.filter(f=>intersection(seed_positions, f).length > 0);

      if (!info.structural_byes.length) {
         let draw_size = info.draw_positions.length;
         let bp = o.fixed_bye_order && o.bye_placement;

         if (bp[draw_size] && bp[draw_size].length >= bye_positions.length) {
            bye_positions = bye_positions.map((p, i) => bp[draw_size][i]);
         } else {
            let seed_placements = draw.seed_placements ? [].concat(...draw.seed_placements.map(m=>m.placements)).map(m=>m.position) : [];

            // function isSeed(p) { return seed_placements.indexOf(p) >= 0; }
            // let pws = pairs_with_seed.filter(p=>!isSeed(p[0]) || !isSeed(p[1]));
            // let filtered_pairs = bye_positions.map((b, i) => pws[i]); 

            // if there are structural byes, then no seed should need bye
            // if there are not structural byes, distribute byes to seeds first, by seed order
            // First select pairs that match the seed_positions, which are already in order, with seed groups shuffled
            // if there are more bye_positions than seed_positions, bye_positions remain undefined
            let filtered_pairs = bye_positions.map((b, i) => pairs_with_seed.filter(p=>p.indexOf(seed_positions[i]) >= 0)[0]); 

            bye_positions = [].concat(...filtered_pairs).filter(f=>seed_placements.indexOf(f) < 0);
         }
      } else {
         // find pairs of positions which are adjacent to structural byes
         let adjacent_pairs = info.structural_byes
            .map(sb => sb.parent.children.filter(c=>c.data.children))
            .map(m=>m[0].data.children.map(c=>c.dp));

         let structural_seed_order = info.structural_byes.map(s=>s.data && s.data.team ? s.data.team[0].seed : undefined);
         let adjacent_to_seeds = [];
         structural_seed_order.forEach((o, i) => adjacent_to_seeds[o - 1] = adjacent_pairs[i]);
         adjacent_to_seeds.filter(f=>f);

         let assignment = bye_positions.map((b, i) => adjacent_to_seeds[i] ? adjacent_to_seeds[i][randomBinary()] : undefined); 
         let remaining = assignment.filter(f=>f==undefined).length;

         // keep track of pairs with no seed or bye
         let pairs_no_seed_or_bye = pairs_no_seed.filter(pair => !intersection(pair, assignment).length);
         let flat_pairs = [].concat(...pairs_no_seed_or_bye);

         // redefined undefined bye_positions to either be those asigned to adjacent pairs or pairs_no_seed_or_bye
         bye_positions = assignment.map(b => b || randomPop(pairs_no_seed_or_bye)[Math.floor(Math.random() * 2)]);

         // redefine pairs_no_seed to filter out pairs_no_seed_or_bye
         pairs_no_seed = pairs_no_seed.filter(pair => !intersection(pair, flat_pairs));
      }

      // if any bye positions are still undefined, randomly distribute to unseeded players
      // TODO: randomPop need to be replaced with something that chooses quarters/eights
      let bye_placements = bye_positions.map(b => b || randomPop(pairs_no_seed)[Math.floor(Math.random() * 2)]); 

      bye_placements.forEach((position, i) => {
         // bye is a boolean which also signifies bye order (order in which byes were assigned)
         assignPosition({ node: draw, position, bye: i + 1 });
      });
   
      draw.bye_placements = bye_placements;
      return bye_placements;
   };

   fx.rrByeDistribution = rrByeDistribution;
   function rrByeDistribution({ draw }) {
      let byes = (draw.brackets.length * draw.bracket_size) - draw.opponents.length;

      if (byes > draw.brackets.length) {
         // console.log('ERROR: There should never be more byes than brackets');
         // Should only occur when too few players have been added to generate
         return false;
      }

      draw.bye_placements = d3.range(byes).map((b, i) => {
         draw.brackets[i].byes = [{ position: 2 }];
         return { bracket: i, position: 2 };
      });
   }

   fx.rrUnseededPlacements = rrUnseedPlacements;
   function rrUnseedPlacements({ draw }) {

      let unfilled_positions = fx.drawInfo(draw).unfilled_positions;

      draw.unseeded_placements = draw.unseeded_teams.map(team => {
         let position = randomPop(unfilled_positions);

         let player = team[0];
         player.draw_position = position.position;
         draw.brackets[position.bracket].players.push(player);

         return { team, position };
      });
   }

   fx.distributeQualifiers = distributeQualifiers;
   function distributeQualifiers({ draw, num_qualifiers }) {
      let info = drawInfo(draw);
      let total = info.draw_positions.length;
      let bye_positions = info.byes.map(b=>b.data.dp);
      let unassigned_positions = info.unassigned.map(u=>u.data.dp);
      let randomBinary = () => Math.floor(Math.random() * 2);
      num_qualifiers = num_qualifiers || draw.qualifiers || 0;

      // reverse qualifiers so that popping returns in numerical order
      let qualifiers = d3.range(0, num_qualifiers).map((q, i) => { return [{ entry: 'Q', qualifier: true }] }).reverse();

      let section_size = Math.floor(total/num_qualifiers);
      let sections = d3.range(0, Math.floor(total/section_size));

      // all draw positions which have a first-round opponent (no structural bye);
      let paired_positions = info.nodes.filter(f=>f.height == 1 && f.children).map(m=>[].concat(...m.children.map(c=>c.data.dp)));

      // paired positions which have no byes
      // TODO: don't place qualifiers with BYEs unless there is no alternative
      let pairs_no_byes = paired_positions.filter(f=>intersection(bye_positions, f).length > 0);

      d3.range(0, num_qualifiers).forEach((e, i) => {
         let section = randomPop(sections);
         let dprange = d3.range(section*section_size + 1, section*section_size + section_size + 1);
         let available_positions = intersection(dprange, unassigned_positions);
         let position = randomBinary() ? available_positions.shift() : available_positions.pop();
         if (position) {
            let team = qualifiers.pop();
            assignPosition({ node: draw, position, team, qualifier: true });
         }
      });

      qualifiers.forEach(team => {
         info = drawInfo(draw);
         available_positions = info.unassigned.map(u=>u.data.dp);
         let position = available_positions.pop();
         assignPosition({ node: draw, position, team, qualifier: true });
      });
   }

   fx.seededTeams = seededTeams;
   function seededTeams({teams}) {
      // this is an object that acts like an array... because there is no '0' seed
      return Object.assign({}, ...teams.filter(f=>f[0].seed).sort((a, b) => a[0].seed - b[0].seed).map(t => ({ [t[0].seed]: t }) ));
   }

   fx.placeSeedGroups = placeSeedGroups;
   function placeSeedGroups({ draw, count }) {
      if (!draw.seed_placements || !draw.seeded_teams) return;

      // if no count is specified, place all seed groups
      count = count || draw.seed_placements.length;
      d3.range(0, count).forEach(c=>placeSeedGroup({draw}));
   }

   fx.placeSeedGroup = placeSeedGroup;
   function placeSeedGroup({ draw, group_index }) {
      if (!draw.seed_placements || !draw.seeded_teams) return;
      let seed_group = group_index != undefined ? draw.seed_placements[group_index] : nextSeedGroup({ draw });
      if (!seed_group) return;

      // make a copy so original is not diminshed by pop()
      let positions = seed_group.positions.slice();

      // pre-round draws place byes before remaining seeds... because all ranked players are seedeed
      if (draw.bye_placements) positions = positions.filter(p=>draw.bye_placements.indexOf(p) < 0);

      seed_group.range.forEach(seed => {
         // positions should already be randomized
         let position = positions.pop();
         if (draw.brackets) {
            // procesing a round robin
            let player = draw.seeded_teams[seed][0];
            player.draw_position = position.position;
            draw.brackets[position.bracket].players.push(player);
         } else {
            // processing a tree draw
            assignPosition({ node: draw, position, team: draw.seeded_teams[seed] })
         }
         seed_group.placements.push({ seed, position });
      });
   }

   fx.nextSeedGroup = nextSeedGroup;
   function nextSeedGroup({ draw }) {
      let unplaced = unplacedSeedGroups({ draw });
      return unplaced ? unplaced[0] : undefined;
   }

   fx.unplacedSeedGroups = unplacedSeedGroups;
   function unplacedSeedGroups({ draw }) {
      if (!draw.seed_placements || !Array.isArray(draw.seed_placements)) return;
      return draw.seed_placements.filter(sp => sp.range.length != sp.placements.length);
   }

   fx.placeUnseededTeam = placeUnseededTeam;
   function placeUnseededTeam({ draw }) {
      if (!draw.unseeded_teams) return;

      let unfilled_positions = drawInfo(draw).unassigned.map(u=>u.data.dp);;
      if (!unfilled_positions.length) return;

      let position = unfilled_positions[0];
      let team = randomPop(draw.unseeded_teams);
      assignPosition({ node: draw, position, team });
   }

   fx.placeUnseededTeams = placeUnseededTeams;
   function placeUnseededTeams({ draw }) {
      if (!draw.unseeded_teams) return;
      let unfilled_positions = drawInfo(draw).unassigned.map(u=>u.data.dp);;
      unfilled_positions.forEach(position => {
         let team = randomPop(draw.unseeded_teams);
         assignPosition({ node: draw, position, team });
      });
   }

   function passFail(array, conditionFx) {
      let result = { pass: [], fail: [] };
      array.forEach(item => result[conditionFx(item) ? 'pass' : 'fail'].push(item));
      return result;
   }

   // recreate existing draws from players who have already been assigned draw positions
   fx.recreateDrawFromMatches = recreateDrawFromMatches;
   function recreateDrawFromMatches(matches, draw_type) {
      let format = unique(matches.map(m=>m.format));

      // if there are multiple formats return
      if (format.length != 1) return {};

      let players = [].concat(...matches.map(match => match.players));
      let draw_positions = unique(players.map(p => p.draw_position));
      let seed_limit = seedLimit(draw_positions.length);

      // sometimes all players have a "seeded" position; for most irrelevant/incorrect
      players.forEach(player => { if (player.seed > seed_limit) delete player.seed; });

      // build an empty draw with enough draw positions
      let teams = Math.max(...draw_positions);
      let structural_byes = structuralByes(teams, false);

      // get draw positions of players in first round of draws with structural byes
      let first_round = [].concat(...matches.filter(m=>['R12', 'R24', 'R48', 'R96'].indexOf(m.round) >= 0).map(m=>m.players.map(p => p.draw_position)));

      if (intersection(structural_byes, first_round).length) {
         // if structural_byes contains a position in a first round match set 'bit_flip' true 
         // structural byes must be 1, 4, 9, 12 rather than 1, 6, 7, 12
         structural_byes = structuralByes(teams, true);
      }

      let max_round_offset = 0;
      let tree = buildDraw({ teams, structural_byes });
      if (draw_type == 'Q') {
         if ([12, 24, 48, 96].indexOf(teams) >= 0) {
            // TODO: namespace conflict; round here should really be round_name ??
            let qualifiers = matches.filter(m=>m.round == 'Q');
            let num_players = unique([].concat(...matches.map(match => match.players)).map(p=>p.draw_position)).length;
            tree = fx.buildQualDraw(num_players, qualifiers.length || 1);

            // because this is built as a qualification draw offset is different...
         } else {
            max_round_offset = 1;
         }
      }

      if (format[0] == 'singles') {
         // players are duplicated multiple times in players array, but it doesn't change the outcome
         players.map(p=>[p]).forEach(team => assignPosition({ node: tree, position: team[0].draw_position, team }));
      } else {
         // teams are duplicated multiple times in teams array, but it doesn't change the outcome
         let teams = [].concat(...matches.map(match => match.teams.map(team => team.map(p => match.players[p]))));
         teams.forEach(team => {
            // sometimes the seeding information is in the wrong place...
            if (team[1].seed && !team[0].seed) team[0].seed = team[1].seed;
            assignPosition({ node: tree, position: team[0].draw_position, team })
         });
      }

      let info = drawInfo(tree);
      if (!info.nodes) return;
      info.nodes
         .filter(node => node.depth == info.depth && !node.data.team)
         .forEach(node => {
            node.data.bye = true;
            node.data.team = [{ draw_position: node.dp, bye: true }];
         });

      advanceTeamsWithByes({ draw: tree });

      let iterations = 0;
      let round = matchNodes(tree).filter(n=>teamMatch(n));

      // now iterate through matches to advance players
      // iterations max is 9, which would be a draw of 256
      while (matches.length && iterations < 9) {
         iterations += 1;
         // get a sorted array of the draw positions for each match
         let pairings = round.map(r => r.data.children.map(c => c.team[0].draw_position).sort());

         let conditionFx = (match) => {
            let pair = unique(match.players.map(p=>p.draw_position).sort());
            let i = pairings.filter(p => intersection(pair, p).length == 2);
            return i.length ? true : false;
         }

         let { pass: round_matches, fail: remaining } = passFail(matches, conditionFx);

         round_matches.forEach(match => {

            // TODO: standardize how players stored as indices
            // matches from events include players
            let player = match.teams[match.winner][0];
            // matches from spreadsheets have players as indices
            if (!isNaN(player)) player = match.players[player];

            let draw_position = player.draw_position;
            advancePosition({ node: tree, position: draw_position, score: match.score });
         });

         matches = remaining;
         round = matchNodes(tree).filter(n=>teamMatch(n));
      }

      tree.max_round = Math.max(...fx.matches(tree).map(m=>m.round)) - max_round_offset;
      return tree;
   }

   fx.matchNodes = matchNodes;
   function matchNodes(data) { return drawInfo(data).match_nodes; }

   fx.matchNode = matchNode;
   function matchNode(node) {
      if (!node || !node.data || !node.data.children) return false;
      // TODO: not a match node if position is a qualifier with no id
      // let teams = node.data.children.map(m=>m.team && m.team[0].id ? m.team : undefined).filter(f=>f);
      let teams = node.data.children.map(m=>m.team).filter(f=>f);
      return (teams.length == 2) ? teams : false;
   }

   fx.byeTeams = byeTeams;
   function byeTeams(node) {
      if (!node.data.children) return false;
      let teams = matchNode(node);
      if (!teams) return false;
      let test = node.data.children.map(d=>d.bye).filter(f=>f);
      if (!test.length) return false;
      return test.reduce((a, b) => a && b) ? teams : false;
   }

   fx.teamMatch = teamMatch;
   function teamMatch(node) {
      if (!node.children) return false;
      let teams = matchNode(node);
      if (!teams) return false;
      let test = node.data.children.map(d=>!d.bye && !d.qualifier).filter(f=>f);
      if (test.length < 2) return false;
      return test.reduce((a, b) => a && b) ? teams : false;
   }

   fx.drawPositionsWithBye = drawPositionsWithBye;
   function drawPositionsWithBye(teams) {
      return unique([].concat(...teams.map(node => [].concat(...node.map(team => team.map(player => !player.bye ? player.draw_position : undefined)))))).filter(f=>f);
   }

   fx.advanceTeamsWithByes = advanceTeamsWithByes;
   function advanceTeamsWithByes({ draw }) {
      let info = drawInfo(draw);
      let bye_teams = info.nodes.filter(f=>byeTeams(f)).map(m=>matchNode(m));
      let winner_positions = info.match_nodes.filter(n=>n.data.match && n.data.match.winner).map(n=>n.data.dp);

      // filter out any team positions which have won a match
      let team_positions = drawPositionsWithBye(bye_teams).filter(p=>winner_positions.indexOf(p) < 0);
      team_positions.forEach(p => advancePosition({ node: draw, position: p }))
   }

   fx.findMatchNodeByTeamPositions = findMatchNodeByTeamPositions;
   function findMatchNodeByTeamPositions(draw, positions) {
      let info = drawInfo(draw);
      let nodes = info.match_nodes.filter(f=>fx.teamMatch(f)).filter(match_node => {
         let match_positions = match_node.data.children.map(c => c.team ? c.team[0].draw_position : undefined);
         return intersection(positions, match_positions).length == 2;
      });
      return (nodes.length) ? nodes[0].data : undefined;
   }

   fx.upcomingMatches = upcomingMatches;
   function upcomingMatches(data, round_names=[]) {
      if (!data) return [];
      let info = drawInfo(data);
      if (!info) return [];

      if (info.draw_type == 'tree') {
         let round_offset = data.max_round ? info.depth - data.max_round : 0;
         let matches = info.upcoming_match_nodes
            // filter out matches which occur after final round (qualification)
            .filter(n=>data.max_round ? n.height <= data.max_round : true)
            .map(node => {
               let round_name = round_names.length ? round_names[node.depth - round_offset] : undefined;
               if (round_name) node.data.round_name = round_name;
               if (node.data.match && round_name) node.data.match.round_name = round_name;
               let potentials = node.data.children.filter(c=>!c.team).map(p=>p.children.map(l=>l.team));
               let dependencies = node.data.children.filter(c=>!c.team).map(d=>d.match && d.match.muid);
               let dependent = node.parent && node.parent.data && node.parent.data.match && node.parent.data.match.muid;
               return {
                  round_name: node.data.round_name,
                  source: node,
                  round: node.height,
                  match: node.data.match,
                  teams: node.data.children.map(c => c.team).filter(f=>f),
                  potentials,
                  dependencies,
                  dependent
               }
            });
         return matches;
      }

      return [];
   }

   fx.matches = matches;
   function matches(data, round_names=[]) {
      if (!data) return [];
      let info = drawInfo(data);
      if (!info) return [];

      if (info.draw_type == 'tree') {
         let round_offset = data.max_round ? info.depth - data.max_round : 0;
         let matches = info.match_nodes
            // filter out nodes which don't contain matches
            // filter out matches which occur after final round (qualification)
            .filter(n=>teamMatch(n) && (data.max_round ? n.height <= data.max_round : true))
            .map(node => {
               let round_name = round_names.length ? round_names[node.depth - round_offset] : undefined;
               if (round_name) node.data.round_name = round_name;
               if (node.data.match && round_name) node.data.match.round_name = round_name;
               let dependencies = node.data.children.filter(c=>!c.team).map(d=>d.match.muid);
               let dependent = node.parent && node.parent.data && node.parent.data.match && node.parent.data.match.muid;
               return {
                  round_name: node.data.round_name,
                  source: node,
                  round: node.height,
                  match: node.data.match,
                  teams: node.data.children.map(c => c.team),
                  dependencies,
                  dependent
               }
            });
         return matches;
      }

      if (info.draw_type == 'roundrobin') {
         data.brackets.forEach((b, i) => bracketMatches(data, i));

         let matches = [].concat(...data.brackets.map(bracket => bracket.matches))
            .map(match => {
               return {
                  teams: match.players.map(p=>[p]),
                  round_name: match.round_name,
                  match,
               }
            });
         return matches;
      }

      return [];
   }

   // takes an array of matches, NOT a tree structure
   fx.matchesPlayers = matchesPlayers;
   function matchesPlayers(matches, key='puid') { 
      // TODO: players in matches should always have PUIDs, not use hash in the future...
      let players = Object.assign(...[].concat(...matches.map(m=>m.players)).map(m=>({ [m[key] || m['hash']]: m }) )); 
      Object.keys(players).forEach(key => { if (!players[key].puid) players[key].puid = players[key].hash; });
      return players;
   }

   fx.findBrackets = findBrackets;
   function findBrackets(matches) {

      let players = fx.matchesPlayers(matches);

      let bracket_players = [];
      let bracket_matches = [];
      let bracketSubset = (i) => bracket_players.filter((p, j) => i != j);
      let findBracketOverlap = () => {
         return bracket_players
            .map((p, i) => bracketSubset(i).map((q, k) => intersection(p, q).length ? [i, k] : false).filter(f=>f))
            .filter(f=>f.length);
      }
      let add2Bracket = (match) => {
         let added = false;
         for (let b=0; b<bracket_players.length; b++) {
            if (intersection(bracket_players[b], match.puids).length) {
               bracket_players[b] = unique([].concat(...bracket_players[b], ...match.puids));
               if (!Array.isArray(bracket_matches[b])) bracket_matches[b] = [];
               if (!added) bracket_matches[b] = [].concat(...bracket_matches[b], match);
               added = true;
            }
         }
         if (!added) {
            bracket_players.push(match.puids);
            bracket_matches.push([match]);
         }
      }
      matches.forEach(add2Bracket);
      let overlap = [].concat(...findBracketOverlap());
      while (overlap.length) {
         let first = overlap[0][0];
         let second = overlap[0][1];
         if (second >= first) second += 1;
         bracket_players[first] = unique([].concat(...bracket_players[first], ...bracket_players[second]));
         bracket_matches[first] = [].concat(...bracket_matches[first], ...bracket_matches[second]);
         bracket_players.splice(second, 1);
         bracket_matches.splice(second, 1);
         overlap = [].concat(...findBracketOverlap());
      }
      let brackets = bracket_players.map((puids, i) => { 
         return { 
            // players need to be sorted by player draw position!
            players: puids.map(puid => players[puid]).sort((a, b) => a.draw_position - b.draw_position),
            matches: bracket_matches[i],
            bracket_size: Math.max(...Object.keys(players).map(k => players[k].draw_position)),
         }
      });

      return brackets;
   }

   // UNUSED
   // function replaced by recreateDrawFromMatches()
   // only works for complete draws
   // starts by grouping matches by rounds
   // assumes round with only one match is final round
   function buildDrawfromMatchrows(rows, rounds) {
      rounds = rounds || ['F', 'SF', 'QF', 'R12', 'R16', 'R24', 'R32', 'R48', 'R64', 'R96', 'R128'];

      let tree;
      let draw = {};
      let depth = 0;

      let id = (players) => players.map(p=>p.puid).join('');
      let winners = (match) => match.teams[match.winner].map(p => match.players[p]);
      let losers = (match) => match.teams[1 - match.winner].map(p => match.players[p]);
      let drawPosition = (team) => Math.min(...team.map(player => player.draw_position));

      let matchrounds = rounds.map(round => {
         let matches = rows.filter(match => match.round == round);
         if (matches.length) return { round, matches };
      }).filter(f=>f);

      if (!matchrounds.length) return;

      let final_round = matchrounds[0].matches;
      if (final_round.length == 1) {
         // if final_round is only 1 match, then normal draw
         let match = final_round[0];
         tree = newNode(winners(match));
         findChildren(tree, match);
         distributeMatches(matchrounds, 1, tree.children);
         organizeNode(tree);
         return tree;
      }

      function newNode(team) {
         return { 
            id: id(team),
            dp: drawPosition(team),
            team,
         }
      }

      function organizeNode(node) {
         if (!node || !node.children) return;
         let c = node.children;
         if (c.length == 2) {
            if (c[0].dp > c[1].dp) c.reverse();
            c.forEach(child => organizeNode(child));
         }
      }

      // recursive function which takes index representing round depth
      function distributeMatches(matchrounds, index, children) {
         if (!matchrounds[index]) return;
         let matches = matchrounds[index].matches;
         matches.forEach(match => {
            children.forEach((child, i) => { 
               if (child.id == id(winners(match))) {
                  findChildren(child, match); 
                  distributeMatches(matchrounds, index + 1, child.children);
               }
            });
         });
      }

      function findChildren(branch, match) {
         branch.match = match;
         branch.winners = winners(match);
         branch.children = [
            newNode(winners(match)),
            newNode(losers(match)),
         ];
      }
   }


   // part of an attempt to reconstruct matches and determine which players had byes
   // UNUSED
   function matchLinks(matches) {
      let players = matchesPlayers(matches);
      let keys = Object.keys(players);
      let noWins = (links) => Object.keys(links).filter(l => !links[l].wins.length);
      // let links = Object.assign({}, ...keys.map(key => { return { [key]: { wins: [], losses: [] } }}));
      let links = Object.assign({}, ...keys.map(key => ({ [key]: { wins: [], losses: [] } }) ));
      matches.forEach(match => {
         let w = match.players[match.teams[match.winner][0]];
         let l = match.players[match.teams[1 - match.winner][0]];
         let winner = w.puid || w.hash;
         let loser = l.puid || l.hash;
         links[winner].wins.push(loser);
         links[loser].losses.push(winner);
      });

      let winner = Object.keys(links).filter(k=>links[k].losses.length == 0)[0];
      let first_match_losers = noWins(links);

      return links;
   }

   fx.tallyBracketResults = tallyBracketResults;
   function tallyBracketResults({ players, matches, bracket }) {
      let puids = [];
      let scores = [];
      let plyrz = [];

      if (bracket) {
         matches = bracket.matches;
         players = bracket.players;
      }
      if (!matches) return;

      players.forEach(player => addPlayer(player));

      matches.forEach(match => {
         let p1, p2;

         if (match.winner_index != undefined) {
            p1 = puids.indexOf(match.puids[match.winner_index]);
            p2 = puids.indexOf(match.puids[1 - match.winner_index]);
         } else {
            p1 = puids.indexOf(match.puids[0]);
            p2 = puids.indexOf(match.puids[1]);
         }
         addScore(p1, p2, match.score);
      });

      if (!scores.length) return;

      // tally all matches played/won for each player
      plyrz.forEach((player, p) => {

         // get list of keys of matches played; only for length
         let opponents = !scores[p] ? [] : Object.keys(scores[p]);

         // outcomes array must deal with opponents array which has undefined items
         let outcomes = opponents.reduce((arr, o) => { arr[o] = determineWinner(p, o); return arr; }, []);

         // don't count incomplete matches
         let incomplete = indices(undefined, outcomes);
         let setsWon = (scores, i) => incomplete.indexOf(i) >= 0 ? 0 : countSets(scores)[0];
         let gamesWon = (scores, i) => incomplete.indexOf(i) >= 0 ? 0 : countGames(scores)[0];
         let gamesLost = (scores, i) => incomplete.indexOf(i) >= 0 ? 0 : countGames(scores)[1];
         let pointsWon = (scores, i) => incomplete.indexOf(i) >= 0 ? 0 : countPoints(scores)[1];

         player.results = {
            matches_won: occurrences(0, outcomes),
            matches_lost: occurrences(1, outcomes),
            sets_won: !scores[p] ? [] : scores[p].map(setsWon).reduce((a, b) => +a + +b, 0),
            games_won: !scores[p] ? [] : scores[p].map(gamesWon).reduce((a, b) => +a + +b, 0),
            games_lost: !scores[p] ? [] : scores[p].map(gamesLost).reduce((a, b) => +a + +b, 0),
            points_won: !scores[p] ? [] : scores[p].map(pointsWon).reduce((a, b) => +a + +b, 0),
         }

         let games_ratio = Math.round(player.results.games_won / player.results.games_lost * 1000)/1000;
         if (isNaN(games_ratio)) games_ratio = 0;
         player.results.games_ratio = games_ratio;

         player.result = `${player.results.matches_won}/${player.results.matches_lost}`;
      });

      let order = determineOrder(plyrz);

      if (order) {
         let ro_list = order.map(o=>o.rank_order);
         order.forEach(o => { 
            if (o != undefined && o.rank_order != undefined) {
               plyrz[o.i].order = o.rank_order;
               if (occurrences(o.rank_order, ro_list) > 1 && plyrz[o.i].sub_order == undefined) plyrz[o.i].sub_order = 0;
            } else {
               delete plyrz[o.i].sub_order;
               plyrz[o.i].order = undefined;
            }
         });
      } else {
         plyrz.forEach(player => {
            player.order = undefined;
            delete player.sub_order;
         });
      }

      // create an object mapping puid to order
      let puid_order = plyrz.reduce((o, p) => { o[p.puid] = p.order; return o}, {});

      matches.forEach(match => {
         let order = match.winner_index == undefined ? '' : puid_order[match.puids[match.winner_index]];
         match.round_name = `RRQ${order || ''}`;
      });

      function addScore(a, b, score) {
         if (!plyrz[a] || !plyrz[b]) return;
         if (!scores[a]) scores[a] = [];
         if (!scores[b]) scores[b] = [];
         scores[a][b] = score;
         scores[b][a] = fx.reverseScore(score);
      }

      function addPlayer(player) {
         if (typeof player != 'object') return;
         let player_index = player.draw_position - 1;
         plyrz[player_index] = player;
         puids[player_index] = player.puid;
      }

      function determineWinner(p, o) {
         // first determine if a match winner was declared in match object
         let puids = [plyrz[p].puid, plyrz[o].puid];
         let match = matches.reduce((r, m) => { if (intersection(m.puids, puids).length == 2) r = m; return r; }, undefined);
         if (match.winner_index != undefined) return puids.indexOf(match.puids[match.winner_index]);

         // otherwise determine winner by tally of sets
         let score = scores[p][o];
         if (!score) return;
         let tally = countSets(score);
         if (tally[0] > tally[1]) return 0;
         if (tally[1] > tally[0]) return 1;
         return;
      }

      function countSets(score) {
         let tally = [0, 0];
         let set_scores = score.split(' ');
         set_scores.forEach(set_score => {
            let divider = set_score.indexOf('-') > 0 ? '-' : set_score.indexOf('/') > 0 ? '/' : undefined;
            let scores = (/\d+[\(\)\-\/]*/.test(set_score)) && divider ? set_score.split(divider).map(s => /\d+/.exec(s)[0]) : undefined;
            if (scores) {
               tally[parseInt(scores[0]) > parseInt(scores[1]) ? 0 : 1] += 1
            } else {
               // set score can't be parsed, no winner
               tally = [0, 0];
            }
         });
         return tally;
      }

      function countPoints(score) {
         let tally = [0, 0];
         let set_scores = score.split(' ');
         set_scores.forEach(set_score => {
            let scores = (/\d+\/\d+/.test(set_score)) ? set_score.split('/').map(s=>/\d+/.exec(s)[0]) : [0, 0];
            if (scores) {
               tally[0] += parseInt(scores[0]);
               tally[1] += parseInt(scores[1]);
            }
         });
         return tally;
      }

      function countGames(score) {
         let tally = [0, 0];
         let set_scores = score.split(' ');
         set_scores.forEach(set_score => {
            let scores = (/\d+[\(\)\-\/]*/.test(set_score)) && set_score.indexOf('-') > 0 ? set_score.split('-').map(s => /\d+/.exec(s)[0]) : undefined;
            if (scores) {
               tally[0] += parseInt(scores[0]);
               tally[1] += parseInt(scores[1]);
            }
         });
         return tally;
      }

      function determineOrder(plyrz) {
         let total_players = Object.keys(plyrz).length;

         // order is an array of objects formatted for processing by ties()
         let order = plyrz.reduce((arr, player, i) => { arr.push({ i, results: player.results }); return arr; }, []);
         let complete = order.filter(o => total_players - 1 == o.results.matches_won + o.results.matches_lost);

         // if not all players have completed their matches, no orders are assigned
         if (total_players != complete.length) return;

         complete.forEach(p => p.hash = resultHash(p));
         complete.sort((a, b) => b.hash - a.hash);
         let hash_order = unique(complete.map(c=>c.hash));
         complete.forEach(p => p.hash_order = hash_order.indexOf(p.hash) + 1);

         let rank_order = 0;
         complete.forEach((p, i) => {
            if (p.hash_order != rank_order) rank_order = i + 1;
            p.rank_order = rank_order;
         });

         return complete;

         function resultHash(p) {return p.results.matches_won * Math.pow(10,7) + p.results.games_ratio * Math.pow(10, 6) + p.results.points_won; }
      }
   }

   function keyWalk(valuesObject, optionsObject) {
      if (!valuesObject || !optionsObject) return;
      var vKeys = Object.keys(valuesObject);
      var oKeys = Object.keys(optionsObject);
      for (var k=0; k < vKeys.length; k++) {
          if (oKeys.indexOf(vKeys[k]) >= 0) {
              var oo = optionsObject[vKeys[k]];
              var vo = valuesObject[vKeys[k]];
              if (oo && typeof oo == 'object' && typeof vo !== 'function' && oo.constructor !== Array) {
                  keyWalk(valuesObject[vKeys[k]], optionsObject[vKeys[k]]);
              } else {
                  optionsObject[vKeys[k]] = valuesObject[vKeys[k]];
              }
          }
      }
   }

   // UNUSED
   function arrayOfPlayers(matches) {
      let players = matchesPlayers(matches);
      let keys = Object.keys(players);
      keys.sort((a, b) => players[a].draw_position - players[b].draw_position);
      let draw_positions = Math.max(...matches.map(m => m.draw_positions));
      let number_of_byes = draw_positions - keys.length;

      return keys.map(k => players[k]);
   }

   return fx;
}