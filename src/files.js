!function() {
   let exp = {};

   let o = {
      rows_per_page: 34,
      minimum_empty: 8,
   }

   exp.options = (values) => {
      if (!values) return o;
      util.keyWalk(values, o);
   }

   // requires db{}
   // requires exp{}
   // requires util{}
   // requires cleanScore{}

   function download(filename, dataStr) {
     let a = document.createElement('a');
     a.style.display = 'none';
     a.setAttribute('href', dataStr);
     a.setAttribute('download', filename);
     let elem = document.body.appendChild(a);
     elem.click();
     elem.remove();
   }

   exp.downloadJSON = (filename, json) => {
      let dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(json));
      download(filename, dataStr);
   }

   exp.downloadCircularJSON = (filename, json) => {
      let dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(CircularJSON.stringify(json));
      download(filename, dataStr);
   }

   exp.downloadText = (filename, text) => {
      let dataStr = 'data:text/plain;charset=utf-8,' + encodeURIComponent(text);
      download(filename, dataStr);
   }

   exp.downloadURI = (uri, name) => {
     let link = document.createElement("a");
     link.download = name;
     link.href = uri;

     let elem = document.body.appendChild(link);
     elem.click();
     elem.remove();
   }

   exp.SVGasURI = (selector) => {
      return new Promise((resolve, reject) => {
         let svgnode = selector.tagName.toLowerCase() == 'svg' ? selector : selector.querySelector('svg');
         let svg_string = exp.getSVGString(svgnode);
         exp.svgString2DataURL(svg_string).then(resolve, reject);
      });
   }

   exp.saveSVGasPNG = (selector, filename = 'svg.png') => {

      let svgnode = selector.tagName.toLowerCase() == 'svg' ? selector : selector.querySelector('svg');
      let svg_string = exp.getSVGString(svgnode);
      let save = (image) => exp.downloadURI(image, filename);

      exp.svgString2DataURL(svg_string).then(save);
   }

   exp.saveBlob = (blob, fileName) => {
       var url = window.URL.createObjectURL(blob);

       var anchorElem = document.createElement("a");
       anchorElem.style = "display: none";
       anchorElem.href = url;
       anchorElem.download = fileName;

       document.body.appendChild(anchorElem);
       anchorElem.click();

       document.body.removeChild(anchorElem);

       // On Edge, revokeObjectURL should be called only after
       // a.click() has completed, atleast on EdgeHTML 15.15048
       setTimeout(function() {
           window.URL.revokeObjectURL(url);
       }, 1000);
   }

   exp.json2csv = json2csv;
   function json2csv(records, separator = ',') {
      let delimiter = (item, key) => `"${item}"`;

      if (!records.length) return false;
      let keys = Object.keys(records[0]);
      return keys.join(separator) + '\n' + records.map(record => keys.map(key => delimiter(record[key], key)).join(separator)).join('\n');
   }


   let zeroPad = (number) => number.toString()[1] ? number : "0" + number; 
   let normalID = (id) => util.replaceDiacritics(id).toUpperCase();
   let dateFormatUTR = (timestamp) => { 
      let date = new Date(timestamp);
      return [zeroPad(date.getMonth() + 1), zeroPad(date.getDate()), date.getFullYear()].join('/');
   }

   exp.matchRecord = (match) => {
      let winners = match.team_players[match.winner];
      let losers = match.team_players[1 - match.winner];
      let players = match.players;
      let dbls = winners.length > 1;
      let category = match.tournament.category || ''; 
      if (+category == 20) category = 'Senior';
      let genders = match.players.map(p => p.sex).filter(f=>f).filter((item, i, s) => s.lastIndexOf(item) == i);
      let player_gender = () => !genders.length ? '' : genders.length > 1 ? 'Mixed' : genders[0] == 'M' ? 'M' : 'F';
      let draw_gender = !genders.length ? '' : genders.length > 1 ? 'Mixed' : genders[0] == 'M' ? 'Male' : 'Female';
      let qualifying = match.round.indexOf('Q') == 0 && match.round.indexOf('QF') < 0;
      let draw_type = match.consolation ? 'Consolation' : qualifying ? 'Qualifying' : 'Main';

      return {
         "Date": dateFormatUTR(match.date),

         "Winner 1 Name": util.normalizeName(`${players[winners[0]].last_name}, ${players[winners[0]].first_name}`),
         "Winner 1 Third Party ID": normalID(players[winners[0]].cropin || ''),
         "Winner 1 Gender": player_gender(players[winners[0]].sex),
         "Winner 1 DOB": players[winners[0]].birth ? dateFormatUTR(players[winners[0]].birth) : '',
         "Winner 1 City": util.replaceDiacritics(players[winners[0]].city || ''),
         "Winner 1 State": '',
         "Winner 1 Country": players[winners[0]].ioc || '',
         "Winner 1 College": '',
         "Winner 2 Name": dbls ? util.normalizeName(`${players[winners[1]].last_name}, ${players[winners[1]].first_name}`) : '',
         "Winner 2 Third Party ID": normalID(dbls ? (players[winners[1]].cropin || '') : ''),
         "Winner 2 Gender": dbls ? player_gender(players[winners[1]].sex) : '',
         "Winner 2 DOB": dbls ? (players[winners[1]].birth ? dateFormatUTR(players[winners[1]].birth) : '') : '',
         "Winner 2 City": util.replaceDiacritics(dbls ? (players[winners[0]].city || '') : ''),
         "Winner 2 State": '',
         "Winner 2 Country": dbls ? (players[winners[1]].ioc || '') : '',
         "Winner 2 College": '',

         "Loser 1 Name": util.normalizeName(`${players[losers[0]].last_name}, ${players[losers[0]].first_name}`),
         "Loser 1 Third Party ID": normalID(players[losers[0]].cropin || ''),
         "Loser 1 Gender": player_gender(players[losers[0]].sex),
         "Loser 1 DOB": players[losers[0]].birth ? dateFormatUTR(players[losers[0]].birth) : '',
         "Loser 1 City": util.replaceDiacritics(players[losers[0]].city || ''),
         "Loser 1 State": '',
         "Loser 1 Country": players[losers[0]].ioc || '',
         "Loser 1 College": '',
         "Loser 2 Name": dbls ? util.normalizeName(`${players[losers[1]].last_name}, ${players[losers[1]].first_name}`) : '',
         "Loser 2 Third Party ID": normalID(dbls ? (players[losers[1]].cropin || '') : ''),
         "Loser 2 Gender": dbls ? player_gender(players[losers[1]].sex) : '',
         "Loser 2 DOB": dbls ? (players[losers[1]].birth ? dateFormatUTR(players[losers[1]].birth) : '') : '',
         "Loser 2 City": util.replaceDiacritics(dbls ? (players[losers[0]].city || '') : ''),
         "Loser 2 State": '',
         "Loser 2 Country": dbls ? (players[losers[1]].ioc || '') : '',
         "Loser 2 College": '',

         "Score": match.score,
         "Id Type": 'Croatia',
         "Draw Name": match.tournament.draw || '',
         "Draw Gender": draw_gender,
         "Draw Team Type": util.normalizeName(match.format) || '',
         "Draw Bracket Type": 'Age',
         "Draw Bracket Value": category,
         "Draw Type": draw_type,
         "Tournament Name": match.tournament.name || '',
         "Tournament URL": '',
         "Tournament Start Date": dateFormatUTR(new Date(match.tournament.start).getTime()),
         "Tournament End Date": dateFormatUTR(new Date(match.tournament.end).getTime()),
         "Tournament City": '',
         "Tournament State": '',
         "Tournament Country": 'Croatia',
         "Tournament Country Code": 'CRO',
         "Tournament Host": '',
         "Tournament Location Type": '',
         "Tournament Surface": '',
         "Tournament Event Type": 'Tournament',
         "Tournament Event Category": category == 'Seniors' || category == 'S' ? 'Seniors' : 'Juniors',
         "Tournament Import Source": 'Croatian Tennis Association',
         "Tournament Sanction Body": 'Croatian Tennis Association',
      }
   }
   exp.matchRecords = (match_array) => match_array.map(m => exp.matchRecord(m));

   // buik function
   exp.downloadUTR = ({matches, category, year, month, group_size = 700, profile = 'HTS'} = {}) => {
      if (!category || !year) return false;
      let filtered_matches = matches
         // decided to not filter out players who don't have IDs...
         // .filter(m => m.players.length == m.players.filter(p => p.cropin).length)
         .filter(m => {
            let date = new Date(m.date);
            return (category == m.tournament.category) && (year == date.getFullYear()) && (!month || month == date.getMonth() + 1);
         });
      let match_records = exp.matchRecords(filtered_matches);
      let cursor = 0;
      while (cursor < match_records.length) {
         let csv = json2csv(match_records.slice(cursor, cursor + group_size));
         exp.downloadText(`UTR-${profile}${year}-${month ? zeroPad(month) : 'all'}-U${category}.csv`, csv);
         cursor += group_size;
      }
   }

   /************************* Database Table Export **************************/
   let tableJSON = (table) => db.findAll(table).then(arr => { exp.downloadJSON(`${table}.json`, arr) }); 

   exp.settingsJSON = () => tableJSON('settings');
   exp.aliasesJSON = () => tableJSON('aliases');
   exp.ignoredJSON = () => tableJSON('ignored');
   exp.clubsJSON = () => tableJSON('clubs');

   exp.tournamentsJSON = (clean=true) => {
      db.findAll('tournaments').then(arr => {
         if (clean) {
            arr.forEach(a => { delete a.events; delete a.players; delete a.registered; delete a.matches; });
            exp.downloadJSON(`tournaments.json`, arr)
         } else {
            exp.downloadCircularJSON(`tournaments.json`, arr)
         }
      })
   }

   exp.downloadTournamentsWithEvents = () => {
      db.findAll('tournaments').then(arr => {
         arr.filter(a=>a.events && a.events.length)
            .forEach(tournament => exp.downloadCircularJSON(`tournament-${tournament.tuid}.json`, tournament));
      })
   }

   exp.downloadPlayers = (group_size = 200) => {
      db.findAllPlayers().then(players => {
         let cursor = 0;
         while (cursor < players.length) {
            exp.downloadJSON('players.json', players.slice(cursor, cursor + group_size));
            cursor += group_size;
         }
      });
   }

   exp.downloadRankings = (rankings) => {
      if (!rankings) {
         db.findAllRankings().then(rankings => rankings.forEach(download));
      } else {
         db.findAllClubs().then(processCategories, util.logError);

         function processCategories(clubs) {
            var clubsobj = Object.assign({}, ...clubs.map(c=>({[c.id]: c})));
            var cats = rankings.categories;
            Object.keys(cats).forEach(category => {
               let players = [].concat(...convert(cats[category].M, 'M'), ...convert(cats[category].W, 'W'));
               let ranking = {
                  category,
                  date: rank.getDateByWeek(rankings.week, rankings.year).getTime(),
                  players: Object.assign({}, ...players)
               }
               download(ranking);
            });;
            function convert(list, gender) {
               return list.map((m, i) => {
                  m.ranking = i + 1;
                  m.sex = gender;
                  m.club_code = clubsobj[m.club] && clubsobj[m.club].code;
                  m.club_name = clubsobj[m.club] && clubsobj[m.club].name;
                  m.points = m.points && m.points.total || m.points;
                  // add club code and club name
                  return { [m.id]: m }
               })
            }
         }
      }

      function download(ranking) {
         let data = Object.keys(ranking.players).map(k=>ranking.players[k]);
         exp.downloadJSON(`rankings_${ranking.category}`, data);
      }
   }

   exp.downloadMatches = (category, group_size = 600) => {
      if (category && [12, 14, 16, 18, 20].indexOf(category) < 0) return;
      db.findAllMatches().then(matches => {
         let cursor = 0;
         let category_matches = category ? matches.filter(m => m.tournament.category == category) : matches;
         removePointsRankings(category_matches);
         while (cursor < category_matches.length) {
            exp.downloadJSON(`${category ? 'U' : '12-S'}${category || ''}-matches.json`, category_matches.slice(cursor, cursor + group_size));
            cursor += group_size;
         }
      });
   }

   function removePointsRankings(matches) {
      matches.forEach(match => match.players.forEach(player => { delete player.points; delete player.rankings; }));
   }

   exp.downloadPoints = (category, group_size = 700) => {
      if (category && [12, 14, 16, 18, 20].indexOf(category) < 0) return;
      db.findAllPoints().then(points => {
         let cursor = 0;
         let category_points = category ? points.filter(p => p.category == category) : points;
         while (cursor < category_points.length) {
            exp.downloadJSON(`${category || '12-S'}-points.json`, category_points.slice(cursor, cursor + group_size));
            cursor += group_size;
         }
      });
   }

   exp.downloadRankLists = (ranklists) => ranklists.forEach(exp.rankListCSV);

   exp.rankListCSV = (ranklist) => {
      ranklist.list.forEach(player => player.points = player.points.total);
      let csv = json2csv(ranklist.list);
      exp.downloadText(`${ranklist.year}-Week${ranklist.week}-${ranklist.category}-${ranklist.gender}.csv`, csv);
   }

   exp.openPDF = (docDefinition) => {
      pdfMake.createPdf(docDefinition).open();
   }

   exp.savePDF = (docDefinition, filename = 'default.pdf') => {
      const pdfDocGenerator = pdfMake.createPdf(docDefinition);
      pdfDocGenerator.getBase64((data) => {
         let blob = b64toBlob(data, "application/pdf");
         exp.saveBlob(blob, filename);
      });
   }

   exp.printSchedulePDF = ({ tournament, day, courts, matches }) => {
      getLogo().then(logo => schedulePDF(tournament, day, courts, matches, logo));
   }

   function xRow(body, widths) {
      let row = {
         id: 'noBreak',
         table: {
            widths,
            body: [body],
         },
         layout: {
            paddingLeft: function(i, node) { return 0; },
            paddingRight: function(i, node) { return 0; },
            paddingTop: function(i, node) { return 0; },
            paddingBottom: function(i, node) { return 0; },
         }
      }; 
      return row;
   }

   function tableRow(i, cells) {
      let body = [{ stack: [scheduleCell({ oop: i })], width: 30 }].concat(...cells.map((c, i) => scheduleCell(c)));
      let widths = [30].concat(...cells.map(c=>'*'));
      return xRow(body, widths);
   }

   function scheduleHeaderRow(court_names) {
      let body = [{ text: ' ', width: 30 }].concat(...court_names.map(headerCell));
      let widths = [30].concat(...court_names.map(c=>'*'));
      return xRow(body, widths);
   }

   function teamName(match, team) {
      if (team.length == 1) {
         let p = match.players[team[0]];
         let club = p.club_code ? ` (${p.club_code})` : '';
         let full_name = `${util.normalizeName(p.first_name, false)} ${util.normalizeName(p.last_name, false).toUpperCase()}`; 
         return `${full_name}${club}`;
      } else {
         return team.map(p => util.normalizeName(match.players[p].last_name, false).toUpperCase()).join('/');
      }
   }

   function scheduleCell(match, lines=false) {
      var format = lang.tr(`formats.${match.format || ''}`);
      var category = match.event ? match.event.category : '';
      var time_detail = !match.schedule ? "" : `${match.schedule.time_prefix || ''} ${match.schedule.time || ''}`;
      var score = match.score;
      if (score && match.winner == 1) score = drawFx().reverseScore(score);
      var unknowns = [];

      var first_team = match.team_players && match.team_players[0] ? teamName(match, match.team_players[0]) : unknownBlock(match, 0);
      var second_team = match.team_players && match.team_players[1] ? teamName(match, match.team_players[1]) : unknownBlock(match, 1);

      var display = {
         time_detail,
         round: `${match.gender || ''} ${category} ${format} ${match.round_name || ''}`,
         oop: match.oop || '',
         first_team,
         bold1: match.winner != undefined && match.winner == 0 ? true : false,
         color1: playerColor(match, 0),
         italics1: playerItalics(0),
         vs: match.players ? 'vs.' : '',
         second_team,
         bold2: match.winner != undefined && match.winner == 1 ? true : false,
         color2: playerColor(match, 1),
         italics2: playerItalics(1),
         spacer: match.spacer || '',
         scoreline: `${score || ''}`,
         spacer: match.spacer || '',
      }
      var x = ' ';
      var cell = {
         table: {
            widths: ['*'],
            body: [
               [ { text: display.time_detail || x, style: 'centeredText', margin: [0, 0, 0, 0] }, ],
               [ { text: display.round || x, style: 'centeredItalic', margin: [0, 0, 0, 0] }, ],
               [ { text: display.oop || x, style: 'centeredText', margin: [0, 0, 0, 0] }, ],
               [ { text: display.first_team || x, style: 'teamName', margin: [0, 0, 0, 0], bold: display.bold1, color: display.color1, italics: display.italics1 }, ],
               [ { text: display.vs || x, style: 'centeredText', margin: [0, 0, 0, 0] }, ],
               [ { text: display.second_team || x, style: 'teamName', margin: [0, 0, 0, 0], bold: display.bold2, color: display.color2, italics: display.italics2 }, ],
               [ { text: display.spacer || x, style: 'centeredText', margin: [0, 0, 0, 0] }, ],
               [ { text: display.scoreline || x, style: 'centeredText', margin: [0, 0, 0, 0] }, ],
            ]
         },
         layout: {
            paddingLeft: function(i, node) { return 0; },
            paddingRight: function(i, node) { return 0; },
            paddingTop: function(i, node) { return 0; },
            paddingBottom: function(i, node) { return 0; },
            hLineWidth: function (i, node) { return (lines && (i === 0 || i === node.table.body.length)) ? 1 : 0; },
            vLineWidth: function (i, node) { return (lines && (i === 0 || i === node.table.widths.length)) ? 1 : 0; },
         }
      }; 
      return cell;

      function playerItalics(pindex) { return (unknowns.indexOf(pindex) >= 0); }
      function unknownBlock(match, pindex) {
         if (!match.potentials) return '';
         unknowns.push(pindex);
         let index = match.potentials[pindex] ? pindex : 0;
         let potentials = match.potentials[index];
         return potentials.map(p=>p.map(potentialBlock).join('/')).join(` ${lang.tr('or')} `);

         function potentialBlock(p) { return util.normalizeName(p.last_name, false).toUpperCase(); }
      }

      function playerColor(match, index) {
         if (unknowns.indexOf(index) >= 0) return 'gray';
         if (match.winner == undefined) return 'black';
         return (match.winner == index) ? 'green' : 'gray';
      }

   }

   function headerCell(court_name) {
      let cell = {
         table: {
            widths: ['*'],
            body: [ [ { text: court_name || ' ', style: 'centeredTableHeader', margin: [0, 0, 0, 0] }, ], ]
         },
         layout: {
            defaultBorder: false,
            paddingLeft: function(i, node) { return 0; },
            paddingRight: function(i, node) { return 0; },
            paddingTop: function(i, node) { return 0; },
            paddingBottom: function(i, node) { return 0; },
         }
      }; 
      return cell;
   }

   function schedulePDF(tournament, day, courts, matches, logo) {

      let pageOrientation = courts.length < 5 ? 'portrait' : 'landscape';
      let minimum_columns = courts.length < 5 ? 4 : 8;
      let portrait = pageOrientation == 'portrait';
      let minimum_rows = portrait ? 6 : 4;
      let team_font_size = portrait ? 10 : 8;

      let rounds = util.unique(matches.map(m=>parseInt(m.schedule.oop_round)));
      let max_round = Math.max(minimum_rows, ...rounds);
      let row_matches = util.range(1, max_round + 1).map(oop_round => matches.filter(m=>m.schedule.oop_round == oop_round));

      let column_headers = [...Array(Math.max(minimum_columns, courts.length))].map(m=>'');
      courts.forEach((court, i) => column_headers[i] = court.name);

      let rows = row_matches
         .map((row, i) => column_headers.map(court_name => row_matches[i].reduce((p, m) => m.schedule.court == court_name ? m : p, {})));

      let body = [[scheduleHeaderRow(column_headers)]].concat(rows.map((r, i) =>[ tableRow(i + 1, rows[i]) ]));

      let schedule_rows = {
         table: {
            widths: ['*'],
            headerRows: 1,
            body,
         },
         layout: {
            defaultBorder: false,
            paddingLeft: function(i, node) { return 0; },
            paddingRight: function(i, node) { return 0; },
            paddingTop: function(i, node) { return 0; },
            paddingBottom: function(i, node) { return 0; },
         }
      }; 

      let content = [ schedule_rows ];

      var docDefinition = {
         pageSize: 'A4',
         pageOrientation,

         pageMargins: [ 20, 80, 20, 50 ],

         pageBreakBefore: function(currentNode) {
            return currentNode.id == 'noBreak' && currentNode.pageNumbers.length != 1;
         },

         content,

         header: function(page) { 
            if (page == 1) {
               return schedulePageHeader(tournament, day, logo);
            } else {
               return schedulePageHeader(tournament, day, logo);
            }
         },

         footer: schedulePageFooter(tournament),

         styles: {
            docTitle: {
               fontSize: 12,
               bold: true,
            },
            subtitle: {
               fontSize: 10,
               italics: true,
               bold: true,
            },
            docName: {
               alignment: 'center',
               fontSize: 10,
               bold: true,
            },
            tableHeader: {
               fontSize: 9,
            },
            tableData: {
               fontSize: 9,
               bold: true
            },
            teamName: {
               alignment: 'center',
               fontSize: team_font_size,
               bold: true,
            },
            centeredText: {
               alignment: 'center',
               fontSize: 10,
               bold: false,
            },
            centeredItalic: {
               alignment: 'center',
               fontSize: 9,
               bold: false,
               italics: true,
            },
            centeredTableHeader: {
               alignment: 'center',
               fontSize: 9,
               bold: true,
            },
            signatureBox: {
               border: true,
            },
            centeredColumn: {
               alignment: 'center',
               border: true,
            },
            italicCenteredColumn: {
               alignment: 'center',
               border: true,
               bold: true,
               italics: true,
            },
         }
      };

      return exp.openPDF(docDefinition);
   }

   exp.printDrawPDF = (tournament, data, options, selected_event, event) => {
      let info = drawFx().drawInfo(data);
      if (info.draw_type == 'tree') return exp.treeDrawPDF({ tournament, data, options, selected_event, info, event });
      if (info.draw_type == 'roundrobin') return exp.rrDrawPDF({ tournament, data, options, selected_event, info, event });
   }

   exp.treeDrawPDF = ({ tournament, data, options, selected_event, info, event }) => {
      return new Promise((resolve, reject) => {

         d3.selectAll('#hidden').remove();

         d3.select('body')
            .append('div').attr('id', 'hidden')
            .append('div').attr('id', 'offscreen');

         // TODO: set width and height here... and make font_size and other
         // calculations based on the width and height... because width and
         // height determine the size of the PNG generated from the SVG and
         // therefore the size of the PDF and the amount of time it takes to
         // process ...
         // currently done in tournaments.css #offscreen

         let element = document.getElementById('offscreen');

         // create an off-screen draw so that sizing is uninhibited by screen real-estate
         let draw = treeDraw();
         draw.data(data);
         draw.options(options);
         draw.width(3000);

         draw.options({edit_fields: { display: false }, flags: { display: false }});
         if (info.draw_positions.length > 16) draw.options({invert_first: true});

         draw.options({players: { offset_left: 8, offset_singles: -10, offset_doubles: -60, offset_score: 10 }});
         draw.options({names:  { max_font_size: 40, min_font_size: 40 }});
         draw.options({scores: { max_font_size: 40, min_font_size: 40 }});

         if (info.draw_positions.length <= 16) {
            draw.options({names: { length_divisor: 23 }});
            draw.options({names:  { max_font_size: 50, min_font_size: 50 }});
            draw.options({umpires: { offset: 45 }});
            draw.options({detail_offsets: { base: 80, width: 65 }});
            draw.options({lines: { stroke_width: 4 }});
            draw.options({minPlayerHeight: 130});
            draw.options({detail_attr: { font_size: 40 }});
            draw.options({detail_attr: { seeding_font_size: 54 }});
         } else if (info.draw_positions.length <= 24) {
            draw.options({names: { length_divisor: 23 }});
            draw.options({umpires: { offset: 45 }});
            draw.options({detail_offsets: { base: 80, width: 65 }});
            draw.options({lines: { stroke_width: 4 }});
            draw.options({minPlayerHeight: 130});
            draw.options({detail_attr: { font_size: 36 }});
            draw.options({detail_attr: { seeding_font_size: 54 }});
         } else if (info.draw_positions.length <= 32) {
            draw.options({names: { length_divisor: 23 }});
            draw.options({umpires: { offset: 45 }});
            draw.options({detail_offsets: { base: 80, width: 60 }});
            draw.options({lines: { stroke_width: 4 }});
            draw.options({minPlayerHeight: 100 });
            draw.options({detail_attr: { font_size: 30 }});
            draw.options({detail_attr: { seeding_font_size: 45 }});
         } else if (info.draw_positions.length <= 48) {
            draw.options({names: { length_divisor: 23 }});
            draw.options({umpires: { offset: 45 }});
            draw.options({detail_offsets: { base: 80, width: 60 }});
            draw.options({lines: { stroke_width: 4 }});
            draw.options({minPlayerHeight: 70 });
            draw.options({detail_attr: { font_size: 30 }});
            draw.options({detail_attr: { seeding_font_size: 45 }});
         } else if (info.draw_positions.length <= 64) {
            draw.options({names: { length_divisor: 23 }});
            draw.options({umpires: { offset: 45 }});
            draw.options({detail_offsets: { base: 80, width: 60 }});
            draw.options({lines: { stroke_width: 4 }});
            draw.options({minPlayerHeight: 50 });
            draw.options({detail_attr: { font_size: 30 }});
            draw.options({detail_attr: { seeding_font_size: 45 }});
         }

         // render the svg
         draw.selector(element)();

         getLogo().then(showPDF);

         function showPDF(logo) {
            exp.SVGasURI(element).then(image => drawSheet({ tournament, images: [image], logo, selected_event, event, info }), reject).then(cleanUp, cleanUp);;
         }
      });
   }

   function cleanUp() { d3.selectAll('#hidden').remove(); }

   exp.rrDrawPDF = ({ tournament, data, options, selected_event, info, event }) => {
      return new Promise((resolve, reject) => {

         d3.selectAll('#hidden').remove();

         d3.select('body')
            .append('div').attr('id', 'hidden')
            .append('div').attr('id', 'offscreen');

         // TODO: set width and height here... and make font_size and other
         // calculations based on the width and height... because width and
         // height determine the size of the PNG generated from the SVG and
         // therefore the size of the PDF and the amount of time it takes to
         // process ...
         // currently done in tournaments.css #offscreen

         let element = document.getElementById('offscreen');

         // create an off-screen draw so that sizing is uninhibited by screen real-estate
         let draw = rrDraw();
         draw.data(data);
         draw.options(options);
         draw.options({ sizeToFit: false, min_width: 3000, width: 3000, min_height: 600, id: `rr${UUID.new()}` });

         draw.options({names: { length_divisor: 23 }});
         draw.options({names:  { max_font_size: 40, min_font_size: 40 }});
         draw.options({scores: { max_font_size: 40, min_font_size: 40 }});

         draw.selector(element)();

         getLogo().then(showPDF);

         function showPDF(logo) {
            let bracket_svgs = Array.from(element.querySelectorAll('svg'));
            Promise.all(bracket_svgs.map(exp.SVGasURI)).then(images => drawSheet({ tournament, images, logo, selected_event, event, info }), reject).then(cleanUp, cleanUp);
         }

      });
   }

   function drawSheetPageHeader(tournament, logo, type, selected_event, event, info) {
      var evt = event || (tournament.events && tournament.events[selected_event]) || { name: 'Unknown' };

      var event_type = lang.tr('draws.maindraw');
      if (evt.draw_type == 'Q') event_type = lang.tr('draws.qualification');
      if (evt.draw_type == 'R') event_type = lang.tr('draws.roundrobin');
      if (evt.draw_type == 'C') event_type = lang.tr('draws.consolation');

      var tournament_id = tournament.display_id || (tournament.tuid.length < 15 ? tournament.tuid : '');

      // let organizers = tournament.organizers && tournament.organizers != tournament.name ? tournament.organizers : '';
      // var sponsor = tournament.sponsor || organizers ? ` - ${tournament.sponsor || organizers}` : '';
      var sponsor = tournament.sponsor ? ` - ${tournament.sponsor}` : '';
      var tournament_name = `${tournament.name}${sponsor}`;

      var draw_sheet = {
         fontSize: 10,
         table: {
            widths: ['*', '*', '*', '*', '*', 'auto'],
            headerRows: 2,
            body: [
               [
                  { 
                     table: {
                        widths: ['*', '*', '*', '*', '*'],
                        body: [
                           [
                              { text: tournament_name || ' ', colSpan: 5, style: 'docTitle', margin: [0, 0, 0, 0] },
                              {}, {}, {}, {},
                           ],
                           [
                              { text: evt.name, colSpan: 2, style: 'subtitle', margin: [0, 0, 0, 0] },
                              {},
                              { text: event_type, colSpan: 2, alignment: 'center', style: 'docName', margin: [0, 0, 0, 5] },
                              {}, {},
                           ],
                        ]
                     },
                     colSpan: 5, 
                     layout: {
                        defaultBorder: false,
                        paddingLeft: function(i, node) { return 0; },
                        paddingRight: function(i, node) { return 0; },
                        paddingTop: function(i, node) { return 0; },
                        paddingBottom: function(i, node) { return 0; },
                     }
                  }, 
                  {}, {}, {}, {}, 
                  {
                     width: 90,
                     image: logo || '',
                     alignment: 'center',
                  },
               ],
               [
                  { text: lang.tr('signin.tournament_date'), style: 'tableHeader', margin: [0, 0, 5, 0] },
                  { text: lang.tr('signin.organization'), style: 'tableHeader', margin: [0, 0, 5, 0] },
                  { text: lang.tr('signin.place'), style: 'tableHeader', margin: [0, 0, 5, 0] },
                  { text: lang.tr('signin.id'), style: 'tableHeader', margin: [0, 0, 5, 0] },
                  { text: lang.tr('signin.rank'), style: 'tableHeader', margin: [0, 0, 5, 0] },
                  { text: lang.tr('signin.judge'), style: 'tableHeader', alignment: 'right' },
               ],
               [ 
                  { text: util.formatDate(new Date(tournament.start)), style: 'tableData' },
                  { text: tournament.organization || '', style: 'tableData' },
                  { text: tournament.location || '', style: 'tableData' },
                  { text: tournament_id, style: 'tableData' },
                  { text: tournament.rank || '', style: 'tableData' },
                  { text: tournament.judge || '', style: 'tableData', alignment: 'right' },
               ],
               [ {text: ' ', fontSize: 1, colSpan: 6, border: [false, false, false, true]}, {}, {}, {}, {}, {}],
            ]
         },
         layout: {
            defaultBorder: false,
            paddingLeft: function(i, node) { return 0; },
            paddingRight: function(i, node) { return 0; },
            paddingTop: function(i, node) { return 0; },
            paddingBottom: function(i, node) { return 0; },
         }
      }

      return draw_sheet;
   }

   function localizeDate(date, localization) {
      return date.toLocaleDateString(lang.tr('datelocalization'), localization);
   }

   function schedulePageHeader(tournament, day, logo) {

      let tournament_id = tournament.display_id || (tournament.tuid.length < 15 ? tournament.tuid : '');

      let weekday = localizeDate(new Date(day), { weekday: 'long' });
      let numeric_date = localizeDate(new Date(day), { year: 'numeric', month: 'numeric', day: 'numeric' });
      let start_date = localizeDate(new Date(tournament.start), { year: 'numeric', month: 'numeric', day: 'numeric' });

      let organizers = tournament.organizers && tournament.organizers != tournament.name ? tournament.organizers : '';
      var sponsor = tournament.sponsor || organizers ? ` - ${tournament.sponsor || organizers}` : '';
      var tournament_name = `${tournament.name}${sponsor}`;

      let schedule = {
         margin: [ 20, 10, 20, 10 ],
         fontSize: 10,
         table: {
            widths: ['*', '*', '*', '*', '*', 'auto'],
            body: [
               [
                  { 
                     table: {
                        widths: ['*', '*', '*', '*', '*'],
                        body: [
                           [
                              { text: tournament_name || ' ', colSpan: 5, style: 'docTitle', margin: [0, 0, 0, 0] },
                              {}, {}, {}, {},
                           ],
                           [
                              { text: lang.tr('signin.tournament_date'), style: 'tableHeader', margin: [0, 0, 5, 0] },
                              { text: lang.tr('schedule.orderofplay'), colSpan: 2, style: 'docName', margin: [0, 0, 0, 0] },
                              {},
                              { stack: [{ text: weekday }, { text: numeric_date }], rowSpan: 2, style: 'docName', margin: [0, 0, 0, 0], border: [true, true, true, true], },
                              {},
                           ],
                           [
                              { text: start_date, style: 'tableData' },
                              {},
                              {},
                              {},
                              {},
                           ],
                        ]
                     },
                     colSpan: 5, 
                     layout: {
                        defaultBorder: false,
                        paddingLeft: function(i, node) { return 0; },
                        paddingRight: function(i, node) { return 0; },
                        paddingTop: function(i, node) { return 0; },
                        paddingBottom: function(i, node) { return 0; },
                     }
                  }, 
                  {}, {}, {}, {}, 
                  {
                     width: 90,
                     image: logo || '',
                     alignment: 'center',
                  },
               ],
               [
                  { text: lang.tr('signin.id'), style: 'tableHeader', margin: [0, 0, 5, 0] },
                  { text: lang.tr('signin.organization'), style: 'tableHeader', margin: [0, 0, 5, 0] },
                  {}, 
                  {}, 
                  {},
                  { text: lang.tr('signin.judge'), style: 'tableHeader', alignment: 'right', },
               ],
               [ 
                  { text: tournament_id, style: 'tableData' },
                  { text: tournament.organization || '', style: 'tableData' },
                  // { text: tournament.location || '', style: 'tableData' },
                  {},
                  {},
                  {},
                  { text: tournament.judge || '', style: 'tableDatat', alignment: 'right', },
               ],
            ]
         },
         layout: {
            defaultBorder: false,
            paddingLeft: function(i, node) { return 0; },
            paddingRight: function(i, node) { return 0; },
            paddingTop: function(i, node) { return 0; },
            paddingBottom: function(i, node) { return 0; },
         },
         margins: [10, 0, 10, 0],
      }

      return schedule;
   }

   function schedulePageFooter(tournament) {
      let timestamp = localizeDate(new Date(), { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

      let umpirenotes = tournament.schedule && tournament.schedule.umpirenotes;

      let footer = {
         margin: [ 10, 0, 10, 0 ],
         fontSize: 8,
			style: 'tableExample',
			table: {
            widths: ['*', 80, 130],
				body: [ 
               [
                  { text: lang.tr('phrases.oop_system') },
                  { text: lang.tr('phrases.schedulepublished') },
                  { text: lang.tr('phrases.judgesignature') },
               ],
               [
                  { text: umpirenotes || ' ', fontSize: 9, },
                  [ { text: timestamp }, { text: ' ' }, ],
                  { text: ' ' },
               ],
            ]
			},
         layout: {
            defaultBorder: true,
         }
		}
      return footer;
   }

   function getRankedPlayers(evt, info) {
      if (!evt.draw || !evt.draw.opponents) return noevent;

      let blank = { text: ' ' };
      let lda = '';
      let a1 = new Array(6).fill(blank);
      let c3 = new Array(6).fill(blank);
      
      let noevent = { s1: [], s2: [], c1: [], c2: [], smin: '', smax: '', omin: '', omax: '', a1, c3, lda };

      let seeded_players = evt.draw.opponents.filter(o=>o[0].seed);
      let seed_rankings = [].concat(...seeded_players.map(p=>p.map(m=>m.category_ranking)));
      let smin = seed_rankings.length ? Math.min(...seed_rankings) : '';
      let smax = seed_rankings.length ? Math.max(...seed_rankings) : '';

      let players = [].concat(...evt.draw.opponents);
      let alt_ll = players.filter(p=>['A', 'LL'].indexOf(p.entry) >= 0);
      alt_ll.forEach((p, i) => { a1[i] = entryObject(p); c3[i] = { text: i + 1 }; });

      // last direct acceptance
      let da_players = players.filter(p=>['A', 'LL', 'WC'].indexOf(p.entry) < 0);
      let da_player_rankings = [].concat(...da_players.map(p=>p.category_ranking)).sort((a, b) => a - b);
      let dalen = da_player_rankings.length;
      let damax = dalen && !isNaN(da_player_rankings[dalen - 1]) ? da_player_rankings[dalen - 1] : undefined;
      let lda_player = !damax ? undefined : da_players.reduce((p, c) => c.category_ranking == damax ? c : p, undefined);
      lda = (info && info.byes && info.byes.length) || !lda_player ? { text: lang.tr('draws.allindraw') } : rankingObject(lda_player);

      let opponent_rankings = [].concat(...evt.draw.opponents.map(o=>o.map(m=>m.category_ranking))).sort((a, b) => a - b);
      let olen = opponent_rankings.length;
      let omin = olen && !isNaN(opponent_rankings[0]) ? opponent_rankings[0] : "nr";
      let omax = olen && !isNaN(opponent_rankings[olen - 1]) ? opponent_rankings[olen - 1] : "nr";

      if (evt.format == 'S') {
         let seeded = seeded_players.map(p=>rankingObject(p[0]));
         let s1 = seeded.slice(0, 8);
         let s2 = seeded.slice(8, 16);
         let c1 = s1.map((p, i) => ({ text: i+1 }));
         let c2 = s2.map((p, i) => ({ text: i+9 }));
         return { s1, s2, c1, c2, smin, smax, omin, omax, a1, c3, lda }
      } else {
         let s1 = seeded_players.map(p=>rankingObject(p[rp(p)[0]])).slice(0, 8);
         let s2 = seeded_players.map(p=>rankingObject(p[rp(p)[1]])).slice(0, 8);
         let c1 = s1.map((p, i) => ({ text: i+1 }));
         let c2 = [];
         return { s1, s2, c1, c2, smin, smax, omin, omax, a1, c3, lda }
      }

      function rp(players) { return (players[0].category_ranking < players[1].category_ranking) ? [0, 1] : [1, 0]; }
      function rankingObject(p) { return { text: `${p.full_name} [${p.category_ranking}]` }; }
      function entryObject(p) { return { text: `${p.full_name} [${p.entry}]` }; }
   }

   function drawSheet({ tournament={}, images, logo, selected_event, event, info }) {
      let evt = event || (tournament.events && tournament.events[selected_eent]);
      let image = images[0];
      let player_representatives = evt && evt.player_representatives || []; 
      let event_organizers = tournament && tournament.organizers ? [tournament.organizers] : []; 
      let timestamp = localizeDate(new Date(), { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      let page_header = drawSheetPageHeader(tournament, logo, 'draw_sheet', selected_event, event);
      let { s1, s2, c1, c2, smin, smax, omin, omax, a1, c3, lda } = getRankedPlayers(evt, info);

      let date = new Date(tournament.start);
      let year = date.getFullYear();
      let month = date.getMonth();
      let rank_list_date = util.formatDate(`${year}-${month+1}-01`);

      let footer = {
         margin: [ 10, 0, 10, 0 ],
         fontSize: 8,
			style: 'tableExample',
			table: {
            widths: [50, '*', 115, 'auto'],
            body: [
					[
                  { text: lang.tr('rl'), bold: true },
                  {
                     columns: [
                        { width: 10, text: '# ', bold: true },
                        { width: '*', text: lang.tr('phrases.rankedplayers'), bold: true },
                     ],
                  }, 
                  {
                     columns: [
                        { width: 10, text: '# ', bold: true },
                        { width: '*', text: lang.tr('draws.substitutes'), bold: true },
                     ],
                  }, 
                  { text: [ lang.tr('phrases.timestamp'), timestamp ], bold: true },
               ],
					[
						{
                     fontSize: 6,
							stack: [
                        { text: lang.tr('dt') },
                        { text: rank_list_date, bold: true, alignment: 'center' },
                        { text: ' ' },
                        { text: lang.tr('draws.seedrange'), bold: true },
                        {
                           columns: [
                              { width: 35, stack: [ { text: `${lang.tr('draws.first')}:` }, { text: `${lang.tr('draws.last')}:` } ] },
                              { width: 15, stack: [ { text: smin }, { text: smax } ] }
                           ]
                        },
                        { text: ' ' },
                        { text: lang.tr('draws.playerrange'), bold: true },
                        {
                           columns: [
                              { width: 35, stack: [ { text: `${lang.tr('draws.first')}:` }, { text: `${lang.tr('draws.last')}:` } ] },
                              { width: 15, stack: [ { text: omin }, { text: omax } ] }
                           ]
                        },
							]
						},
						{
                     fontSize: 6,
                     columns: [
                        { width: 12, stack: c1, },
                        { width: '*', stack: s1, },
                        { width: 12, stack: c2, },
                        { width: '*', stack: s2, },
                     ]
						},
                  {
                     stack: [
                        {
                           columns: [
                              { width: 12, stack: c3, },
                              { width: '*', stack: a1, },
                           ]
                        },
                        { text: ' ' },
                        { text: lang.tr('draws.organizers'), bold: true, fontSize: 8 },
                        { text: event_organizers[0] || ' ', },
                        { text: event_organizers[1] || ' ', },
                     ]
                  },
                  {
                     stack: [
                        { text: lang.tr('draws.lastdirectaccept'), bold: true, fontSize: 8 },
                        lda,
                        { text: ' ', },
                        { text: lang.tr('draws.playerreps'), bold: true, fontSize: 8 },
                        { text: player_representatives[0] || ' ', },
                        { text: player_representatives[1] || ' ', },
                        { text: ' ', },
                        { text: lang.tr('phrases.judgesignature'), bold: true, fontSize: 8 },
                        { text: ' ', },
                        { text: ' ', },
                     ],
                  }
					],
				]
			},
         layout: {
            defaultBorder: true,
         }
		}

      let body_images = images.map(image => ({ image: image, width: 560, }));
      let content = [page_header, ' '].concat(body_images);

      var docDefinition = {
         pageSize: 'A4',
         pageOrientation: 'portrait',

         pageMargins: [ 10, 20, 10, 120 ],

         footer: footer,

         content,
         styles: {
            docTitle: {
               fontSize: 11,
               bold: true,
            },
            subtitle: {
               fontSize: 10,
               italics: true,
               bold: true,
            },
            docName: {
               fontSize: 10,
               bold: true,
            },
            tableHeader: {
               fontSize: 9,
            },
            tableData: {
               fontSize: 9,
               bold: true,
            },
            centeredTableHeader: {
               alignment: 'center',
               fontSize: 9,
               bold: true,
            },
            signatureBox: {
               border: true,
            },
            centeredColumn: {
               alignment: 'center',
               border: true,
            },
            italicCenteredColumn: {
               alignment: 'center',
               border: true,
               bold: true,
               italics: true,
            },
         }
      };

      return exp.openPDF(docDefinition);
   }

   exp.doublesSignInPDF = ({ tournament, teams, category, gender, event_name, doc_name }) => {
      return new Promise((resolve, reject) => {
         getLogo().then(showPDF);

         function showPDF(logo) {
            doublesSignInSheet({ tournament, teams, category, gender, event_name, logo, doc_name });
         }
         console.log('doubles sign-in sheet');
      });
   }

   exp.orderedPlayersPDF = ({ tournament, players, category, gender, event_name, doc_name, extra_pages }) => {
      return new Promise((resolve, reject) => {

         getLogo().then(showPDF);

         function showPDF(logo) {
            signInSheet({ tournament, players, category, gender, event_name, logo, doc_name, extra_pages });
         }

      });
   }

   exp.getLogo = getLogo;
   function getLogo() {
      return getImage({ key: 'orgLogo', path: './assets/org_logo.png' });
   }

   exp.getName = getName;
   function getName() {
      return getImage({ key: 'orgName', path: './assets/org_logo.png' });
   }

   function getImage({ key, path }) {
      return new Promise((resolve, reject) => {
         db.findSetting(key).then(checkLogo, console.log);
         function checkLogo(logo) {
            if (logo && logo.image && logo.image.indexOf('image') >= 0) {
               return resolve(logo.image);
            } else {
               exp.getDataUri(path).then(resolve, reject);
            }
         }
      });
   }

   function doublesSignInSheet({ tournament={}, teams=[], players=[], category, gender, event_name='', logo, doc_name }) {

      let date = util.formatDate(tournament.start);
      let tournament_id = tournament.display_id || (tournament.tuid.length < 15 ? tournament.tuid : '');

      var sponsor = tournament.sponsor ? ` - ${tournament.sponsor}` : '';
      var tournament_name = `${tournament.name}${sponsor}`;

      let page_header = [
         { 
            border: [ false, false, false, false ],
            colSpan: 9,
            table: {
               widths: ['auto', 'auto', '*', '*', '*', 'auto'],
               headerRows: 2,
               body: [
                  [
                     { 
                        table: {
                           widths: ['*'],
                           body: [
                              [{ text: tournament_name || ' ', style: 'docTitle' }],
                              [{ text: event_name, style: 'subtitle' }],
                           ]
                        },
                        colSpan: 5, 
                        layout: 'noBorders',
                     }, 
                     {}, {}, {}, {}, 
                     {
                        width: 100,
                        image: logo || '',
                        alignment: 'center',
                     },
                  ],
                  [ {text: doc_name || lang.tr('signin.doc_name'), colSpan: 6, style: 'docName', alignment: 'center'}, ],
                  [ {text: lang.tr('signin.doc_subname'), colSpan: 6, style: 'docName', alignment: 'center'}, ],

                  [
                     { text: lang.tr('signin.tournament_date'), style: 'tableHeader' },
                     { text: lang.tr('signin.organization'), style: 'tableHeader' },
                     { text: lang.tr('signin.place'), style: 'tableHeader' },
                     { text: '', style: 'tableHeader' },
                     { text: '', style: 'tableHeader' },
                     { text: lang.tr('signin.judge'), style: 'tableHeader' },
                  ],
                  [ 
                     date, 
                     tournament.organization || ' ', 
                     tournament.location || '',
                     '', 
                     '', 
                     { text: tournament.judge || ' ', margin: [0, 0, 0, 5] },
                  ],
                  [
                     { text: lang.tr('signin.id'), style: 'tableHeader', margin: [0, 0, 5, 0] },
                     { text: lang.tr('signin.rank'), style: 'tableHeader', margin: [0, 0, 5, 0] },
                     { text: '', style: 'tableHeader' },
                     { text: '', style: 'tableHeader' },
                     {colSpan: 2, rowSpan: 2, text: ' ', border: [true, true, true, true] }, 
                     { text: '', style: 'tableHeader' },
                  ],
                  [ 
                     tournament_id, 
                     tournament.rank || ' ',
                     ' ',
                     '',
                     '',
                     ''
                  ],
               ]
            },
            layout: {
               defaultBorder: false,
               paddingLeft: function(i, node) { return 0; },
               paddingRight: function(i, node) { return 0; },
               paddingTop: function(i, node) { return 0; },
               paddingBottom: function(i, node) { return 0; },
            }
         }, {}, {}, {}, {}, {}, {}, {}, {},
      ];

      let dummy = [
         { border: [false, false, false, false], text: ' ' },
         { border: [false, false, false, false], text: ' ' },
         { border: [false, false, false, false], text: ' ' },
         { border: [false, false, false, false], text: ' ' },
         { border: [false, false, false, false], text: ' ' },
         { border: [false, false, false, false], text: ' ' },
         { border: [false, false, false, false], text: ' ' },
         { border: [false, false, false, false], text: ' ' },
         { border: [false, false, false, false], text: ' ' },
      ];
      let header_row = [ 
         { text: '#', style: 'centeredTableHeader' }, 
         { text: lang.tr('lnm'), style: 'tableHeader' }, 
         { text: lang.tr('fnm'), style: 'tableHeader' }, 
         { text: lang.tr('clb'), style: 'centeredTableHeader' }, 
         { text: lang.tr('rnk'), style: 'centeredTableHeader' }, 
         { text: lang.tr('lnm'), style: 'tableHeader' }, 
         { text: lang.tr('fnm'), style: 'tableHeader' }, 
         { text: lang.tr('clb'), style: 'centeredTableHeader' }, 
         { text: lang.tr('rnk'), style: 'centeredTableHeader' }, 
      ];

      let empty = (x) => Array.from({length: x}, () => undefined);
      let empty_rows = o.rows_per_page - (teams.length % o.rows_per_page);
      let rows = teams.concat(...empty(empty_rows));

      rows = rows.map((row, i) => {
         if (row) {
            return [
               { text: i + 1, style: 'centeredColumn' },
               { text: row[0].last_name.toUpperCase().trim() },
               { text: util.normalizeName(row[0].first_name, false) },
               { text: row[0].club_code || row[0].country || " ", style: row[0].club_code ? 'centeredColumn' : 'italicCenteredColumn' },
               // { text: row.rankings && row.rankings[category] ? row.rankings[category] : '', style: 'centeredColumn' },
               { text: row[0].category_ranking || '', style: 'centeredColumn' },
               { text: row[1].last_name.toUpperCase().trim() },
               { text: util.normalizeName(row[1].first_name, false) },
               { text: row[1].club_code || row[1].country || " ", style: row[1].club_code ? 'centeredColumn' : 'italicCenteredColumn' },
               // { text: row.rankings && row.rankings[category] ? row.rankings[category] : '', style: 'centeredColumn' },
               { text: row[1].category_ranking || '', style: 'centeredColumn' },
            ];
         } else {
            return [ 
               { text: i + 1, style: 'centeredColumn' }, 
               " ", " ", " ", " ", " ", " ", " ", " "
            ];
         }
      }).filter(f=>f);

      let player_rows = [].concat([page_header], [dummy], [header_row], rows);
      let table_rows = {
         fontSize: 10,
         table: {
            headerRows: 3,
            widths: [ 'auto', '*', '*', 'auto', 'auto', '*', '*', 'auto', 'auto' ],
            body: player_rows,
         },
      }

      var docDefinition = {
         pageSize: 'A4',
         pageOrientation: 'portrait',

         content: [
            table_rows,
         ],

         styles: {
            docTitle: {
               fontSize: 16,
               bold: true,
            },
            subtitle: {
               fontSize: 12,
               italics: true,
            },
            docName: {
               fontSize: 14,
               bold: true,
            },
            tableHeader: {
               fontSize: 11,
               bold: true,
            },
            centeredTableHeader: {
               alignment: 'center',
               fontSize: 11,
               bold: true,
            },
            signatureBox: {
               border: true,
            },
            centeredColumn: {
               alignment: 'center',
               border: true,
            },
            italicCenteredColumn: {
               alignment: 'center',
               border: true,
               bold: true,
               italics: true,
            },
         }
      };

      let filename = `${event_name} Sign In Sheet.pdf`;
      // exp.savePDF(docDefinition, filename);
      return exp.openPDF(docDefinition);
   }
   function signInSheet({ tournament={}, players, category, gender, event_name='', logo, doc_name, extra_pages=true }) {

      let date = util.formatDate(tournament.start);
      let tournament_id = tournament.display_id || (tournament.tuid.length < 15 ? tournament.tuid : '');

      var sponsor = tournament.sponsor ? ` - ${tournament.sponsor}` : '';
      var tournament_name = `${tournament.name}${sponsor}`;

      let page_header = [
         { 
            border: [ false, false, false, false ],
            colSpan: 8,
            table: {
               widths: ['auto', 'auto', '*', '*', '*', 'auto'],
               headerRows: 2,
               body: [
                  [
                     { 
                        table: {
                           widths: ['*'],
                           body: [
                              [{ text: tournament_name || ' ', style: 'docTitle' }],
                              [{ text: event_name, style: 'subtitle' }],
                           ]
                        },
                        colSpan: 5, 
                        layout: 'noBorders',
                     }, 
                     {}, {}, {}, {}, 
                     {
                        width: 100,
                        image: logo || '',
                        alignment: 'center',
                     },
                  ],
                  [ {text: doc_name || lang.tr('signin.doc_name'), colSpan: 6, style: 'docName', alignment: 'center'}, ],
                  [ {text: lang.tr('signin.doc_subname'), colSpan: 6, style: 'docName', alignment: 'center'}, ],

                  [
                     { text: lang.tr('signin.tournament_date'), style: 'tableHeader' },
                     { text: lang.tr('signin.organization'), style: 'tableHeader' },
                     { text: lang.tr('signin.place'), style: 'tableHeader' },
                     { text: '', style: 'tableHeader' },
                     { text: '', style: 'tableHeader' },
                     { text: lang.tr('signin.judge'), style: 'tableHeader' },
                  ],
                  [ 
                     date, 
                     tournament.organization || ' ', 
                     tournament.location || '',
                     '', 
                     '', 
                     { text: tournament.judge || ' ', margin: [0, 0, 0, 5] },
                  ],
                  [
                     { text: lang.tr('signin.id'), style: 'tableHeader', margin: [0, 0, 5, 0] },
                     { text: lang.tr('signin.rank'), style: 'tableHeader', margin: [0, 0, 5, 0] },
                     { text: '', style: 'tableHeader' },
                     { text: '', style: 'tableHeader' },
                     {colSpan: 2, rowSpan: 2, text: ' ', border: [true, true, true, true] }, 
                     { text: '', style: 'tableHeader' },
                  ],
                  [ 
                     tournament_id, 
                     tournament.rank || ' ',
                     ' ',
                     '',
                     '',
                     ''
                  ],
               ]
            },
            layout: {
               defaultBorder: false,
               paddingLeft: function(i, node) { return 0; },
               paddingRight: function(i, node) { return 0; },
               paddingTop: function(i, node) { return 0; },
               paddingBottom: function(i, node) { return 0; },
            }
         }, {}, {}, {}, {}, {}, {}, {},
      ];

      let dummy = [
         { border: [false, false, false, false], text: ' ' },
         { border: [false, false, false, false], text: ' ' },
         { border: [false, false, false, false], text: ' ' },
         { border: [false, false, false, false], text: ' ' },
         { border: [false, false, false, false], text: ' ' },
         { border: [false, false, false, false], text: ' ' },
         { border: [false, false, false, false], text: ' ' },
         { border: [false, false, false, false], text: ' ' },
      ];
      let header_row = [ 
         { text: '#', style: 'centeredTableHeader' }, 
         { text: lang.tr('lnm'), style: 'tableHeader' }, 
         { text: lang.tr('fnm'), style: 'tableHeader' }, 
         { text: lang.tr('clb'), style: 'centeredTableHeader' }, 
         { text: lang.tr('rnk'), style: 'centeredTableHeader' }, 
         { text: lang.tr('stt'), style: 'centeredTableHeader' }, 
         { text: lang.tr('ord'), style: 'centeredTableHeader' }, 
         { text: lang.tr('signin.signature'), style: 'tableHeader' }, 
      ];

      let gendered_players = gender ? players.filter(f=>f.sex == gender) : players;
      let empty = (x) => Array.from({length: x}, () => undefined);
      let empty_rows = o.rows_per_page - (gendered_players.length % o.rows_per_page);
      if (extra_pages && empty_rows < o.minimum_empty) empty_rows += o.rows_per_page;
      let rows = [].concat(...gendered_players, ...empty(empty_rows));

      rows = rows.map((row, i) => {
         if (row) {
            return [
               { text: i + 1, style: 'centeredColumn' },
               { text: row.last_name.toUpperCase().trim() },
               { text: util.normalizeName(row.first_name, false) },
               { text: row.club_code || row.country || " ", style: row.club_code ? 'centeredColumn' : 'italicCenteredColumn' },
               // { text: row.rankings && row.rankings[category] ? row.rankings[category] : '', style: 'centeredColumn' },
               { text: row.category_ranking || '', style: 'centeredColumn' },
               { text: " ", style: 'centeredColumn' },
               { text: " ", style: 'centeredColumn' },
               { text: " " },
            ];
         } else {
            return [ { text: i + 1, style: 'centeredColumn' }, " ", " ", " ", " ", " ", " ", " "];
         }
      }).filter(f=>f);

      let player_rows = [].concat([page_header], [dummy], [header_row], rows);
      let table_rows = {
         fontSize: 10,
         table: {
            headerRows: 3,
            widths: [ 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', 35, '*' ],
            body: player_rows,
         },
      }

      var docDefinition = {
         pageSize: 'A4',
         pageOrientation: 'portrait',

         content: [
            table_rows,
         ],

         styles: {
            docTitle: {
               fontSize: 16,
               bold: true,
            },
            subtitle: {
               fontSize: 12,
               italics: true,
            },
            docName: {
               fontSize: 14,
               bold: true,
            },
            tableHeader: {
               fontSize: 11,
               bold: true,
            },
            centeredTableHeader: {
               alignment: 'center',
               fontSize: 11,
               bold: true,
            },
            signatureBox: {
               border: true,
            },
            centeredColumn: {
               alignment: 'center',
               border: true,
            },
            italicCenteredColumn: {
               alignment: 'center',
               border: true,
               bold: true,
               italics: true,
            },
         }
      };

      let filename = `${event_name} Sign In Sheet.pdf`;
      // exp.savePDF(docDefinition, filename);
      return exp.openPDF(docDefinition);
   }

   // https://stackoverflow.com/questions/16245767/creating-a-blob-from-a-base64-string-in-javascript
   let b64toBlob = (b64Data, contentType='', sliceSize=512) => {
     let  byteCharacters = atob(b64Data);
     let  byteArrays = [];
     
     for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
       let  slice = byteCharacters.slice(offset, offset + sliceSize);
       
       let  byteNumbers = new Array(slice.length);
       for (let i = 0; i < slice.length; i++) { byteNumbers[i] = slice.charCodeAt(i); }
       
       let byteArray = new Uint8Array(byteNumbers);
       byteArrays.push(byteArray);
     }
     
     return new Blob(byteArrays, {type: contentType});
   }

   exp.getSVGString = getSVGString;
   function getSVGString( svgNode ) {
      svgNode.setAttribute('xlink', 'http://www.w3.org/1999/xlink');
      var cssStyleText = getCSSStyles( svgNode );
      appendCSS( cssStyleText, svgNode );

      var serializer = new XMLSerializer();
      var svgString = serializer.serializeToString(svgNode);
      svgString = svgString.replace(/(\w+)?:?xlink=/g, 'xmlns:xlink='); // Fix root xlink without namespace
      svgString = svgString.replace(/NS\d+:href/g, 'xlink:href'); // Safari NS namespace fix

      return svgString;

      function getCSSStyles( parentElement ) {
         var selectorTextArr = [];

         // Add Parent element Id and Classes to the list
         selectorTextArr.push( '#'+parentElement.id );
         for (var c = 0; c < parentElement.classList.length; c++)
               if ( !contains('.'+parentElement.classList[c], selectorTextArr) )
                  selectorTextArr.push( '.'+parentElement.classList[c] );

         // Add Children element Ids and Classes to the list
         var nodes = parentElement.getElementsByTagName("*");
         for (var i = 0; i < nodes.length; i++) {
            var id = nodes[i].id;
            if ( !contains('#'+id, selectorTextArr) )
               selectorTextArr.push( '#'+id );

            var classes = nodes[i].classList;
            for (var c = 0; c < classes.length; c++)
               if ( !contains('.'+classes[c], selectorTextArr) )
                  selectorTextArr.push( '.'+classes[c] );
         }

         // Extract CSS Rules
         var extractedCSSText = "";
         for (var i = 0; i < document.styleSheets.length; i++) {
            var s = document.styleSheets[i];
            
            try {
                if(!s.cssRules) continue;
            } catch( e ) {
                  if(e.name !== 'SecurityError') throw e; // for Firefox
                  continue;
               }

            var cssRules = s.cssRules;
            for (var r = 0; r < cssRules.length; r++) {
               if ( contains( cssRules[r].selectorText, selectorTextArr ) )
                  extractedCSSText += cssRules[r].cssText;
            }
         }
         

         return extractedCSSText;

         function contains(str,arr) {
            return arr.indexOf( str ) === -1 ? false : true;
         }

      }

      function appendCSS( cssText, element ) {
         var styleElement = document.createElement("style");
         styleElement.setAttribute("type","text/css"); 
         styleElement.innerHTML = cssText;
         var refNode = element.hasChildNodes() ? element.children[0] : null;
         element.insertBefore( styleElement, refNode );
      }
   }

   exp.getDataUri = getDataUri;
   function getDataUri(url) {
      return new Promise( (resolve, reject) => {
          var image = new Image();

          image.onload = function () {
              var canvas = document.createElement('canvas');
              canvas.width = this.naturalWidth; // or 'width' if you want a special/scaled size
              canvas.height = this.naturalHeight; // or 'height' if you want a special/scaled size
              canvas.getContext('2d').drawImage(this, 0, 0);

              resolve(canvas.toDataURL('image/png'));
          };

          image.src = url;
      });
   }

   exp.svgString2DataURL = svgString2DataURL;
   function svgString2DataURL(svgString) {
      return new Promise( (resolve, reject) => {

         var imgsrc = 'data:image/svg+xml;base64,'+ btoa( unescape( encodeURIComponent( svgString ) ) ); // Convert SVG string to data URL

         var image = new Image();
         image.onload = function () {
             var canvas = document.createElement('canvas');
             canvas.width = this.naturalWidth; // or 'width' if you want a special/scaled size
             canvas.height = this.naturalHeight; // or 'height' if you want a special/scaled size
             canvas.getContext('2d').drawImage(this, 0, 0);

             resolve(canvas.toDataURL('image/png'));
         };

         image.src = imgsrc;
      });
   }

   /*************************** Spreadheet Export ****************************/
   exp.saveWorkbook = (filename = 'export.xlsx') => {
      let wbout = XLSX.write(load.loaded.workbook, {bookType:'xlsx', bookSST:true, type: 'binary'});
      let blob = new Blob([s2ab(wbout)],{type:"application/octet-stream"});
      exp.saveBlob(blob, filename);
   }

   function s2ab(s) {
      if(typeof ArrayBuffer !== 'undefined') {
         var buf = new ArrayBuffer(s.length);
         var view = new Uint8Array(buf);
         for (var i=0; i!=s.length; ++i) view[i] = s.charCodeAt(i) & 0xFF;
         return buf;
      } else {
         var buf = new Array(s.length);
         for (var i=0; i!=s.length; ++i) buf[i] = s.charCodeAt(i) & 0xFF;
         return buf;
      }
   }

   exp.handleFileUpload = (evt, settings_key, div_id) => {
      if (!evt.target.files || !evt.target.files.length) return;

      renderImage(evt.target.files[0]);

      function renderImage(file) {
         let size = file.size;
         if (size > 50000) {

         }
         let reader = new FileReader();
         reader.onload = function(event) {
            let url = event.target.result;
            if (file.type.indexOf('image') != 0) {
               gen.popUpMessage('Must be an image file!');
               return;
            }
            imageDimensions(url).then(dimensions => analyzeImage(url, dimensions, size), console.log);
        }
        reader.readAsDataURL(file);
      }

      function analyzeImage(url, dimensions, size) {
         let wh_ratio = dimensions.width / dimensions.height;
         if (wh_ratio < 2.8 || wh_ratio > 3.5) {
            gen.popUpMessage(`<div>Ratio: ${wh_ratio}</div><div>Width / Height Ratio must be between 3 and 3.5</div>`);
            return;
         }
         document.getElementById(div_id).innerHTML = "<img width='200px' src='" + url + "' />";
      }

      function imageDimensions(url){   
         return new Promise((resolve, reject) => {
            let img = new Image();
            img.addEventListener("load", function() {
               resolve({ width: this.naturalWidth, height: this.naturalHeight });
            });
            img.src = url;
         });
      }
   }

   if (typeof define === "function" && define.amd) define(exp); else if (typeof module === "object" && module.exports) module.exports = exp;
   this.exp = exp;
 
}();

/*
 // PDFMAKE EXAMPLES

   docDefinition = {
      pageOrientation: 'portrait',
      content: [
        {text: 'Text on Portrait'},
        {text: 'Text on Landscape', pageOrientation: 'landscape', pageBreak: 'before'},
        {text: 'Text on Landscape 2', pageOrientation: 'portrait', pageBreak: 'after'},
        {text: 'Text on Portrait 2'},
      ]
    }

     pageBreakBefore: function(currentNode, followingNodesOnPage, nodesOnNextPage, previousNodesOnPage) {
        var pageInnerHeight = currentNode.startPosition.pageInnerHeight;
        var top = (currentNode.startPosition.top) ? currentNode.startPosition.top : 0;
        var footerHeight = 30;
        var nodeHeight = 0;
        if (followingNodesOnPage && followingNodesOnPage.length) {
           nodeHeight = followingNodesOnPage[0].startPosition.top - top;
        }

        if (currentNode.headlineLevel === 'footer') return false;

        return (currentNode.image && (top + nodeHeight + footerHeight > pageInnerHeight))
           || (currentNode.headlineLevel === 'longField' && (top + nodeHeight + footerHeight > pageInnerHeight))
           || currentNode.startPosition.verticalRatio >= 0.95;
     }

// https://github.com/bpampuch/pdfmake/releases/tag/0.1.17

var dd = {
  content: [
    {text: '1 Headline', headlineLevel: 1},
    'Some long text of variable length ...',
    {text: '2 Headline', headlineLevel: 1},
    'Some long text of variable length ...',
    {text: '3 Headline', headlineLevel: 1},
    'Some long text of variable length ...',
  ],
  pageBreakBefore: function(currentNode, followingNodesOnPage, nodesOnNextPage, previousNodesOnPage) {
    return currentNode.headlineLevel === 1 && followingNodesOnPage.length === 0;
  }
}

// If pageBreakBefore returns true, a page break will be added before the currentNode. Current node has the following information attached:
{
 id: '<as specified in doc definition>', 
 headlineLevel: '<as specified in doc definition>',
 text: '<as specified in doc definition>', 
 ul: '<as specified in doc definition>', 
 ol: '<as specified in doc definition>', 
 table: '<as specified in doc definition>', 
 image: '<as specified in doc definition>', 
 qr: '<as specified in doc definition>', 
 canvas: '<as specified in doc definition>', 
 columns: '<as specified in doc definition>', 
 style: '<as specified in doc definition>', 
 pageOrientation '<as specified in doc definition>',
 pageNumbers: [2, 3], // The pages this element is visible on (e.g. multi-line text could be on more than one page)
 pages: 6, // the total number of pages of this document
 stack: false, // if this is an element which encapsulates multiple sub-objects
 startPosition: {
   pageNumber: 2, // the page this node starts on
   pageOrientation: 'landscape', // the orientation of this page
   left: 60, // the left position
   right: 60, // the right position
   verticalRatio: 0.2, // the ratio of space used vertically in this document (excluding margins)
   horizontalRatio: 0.0  // the ratio of space used horizontally in this document (excluding margins)
 }
}
*/

/*

   // get all matches
   db.db.matches.toArray(d=>matches=d);

   // exclude Tennis Europe Matches
   nte = matches.filter(m=>!m.tournament.name.match(/- Te$/));

   // exclude matches with score issues
   gs = nte.filter(m=>cleanScore.normalize(m.score))
   gs.forEach(m=>m.score = cleanScore.normalize(m.score).join(' '));

   // bad scores can be fixed by hand
   bs = nte.filter(m=>!cleanScore.normalize(m.score))

   // ended normally
   en = gs.filter(m=>!cleanScore.endedEarly(m.score))
   en.forEach(m=>m.score = cleanScore.normalize(m.score).join(' '));

   // export matches
   em = [].concat(...gs, ...fixed)

   exp.downloadUTR({ matches: em, category: '12', year: '2016' });

*/
