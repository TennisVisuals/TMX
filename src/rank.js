!function() {

   // TODO: This needs to be in settings
   var rank = {
      plus2: true, // add best 2 from 1 category above
      plus4: true, // add best 2 from 2 categories above
      plus6: true, // add best 2 from 2 categories above
      minus2: true, // add all from category below
      minus4: false, // add all from 2 categories below
   };

   // requires db{}, util{}, exp{}

   function unique(arr) { return arr.filter((item, i, s) => s.lastIndexOf(item) == i); }
   function fullName(player) { return `${player.last_name.toUpperCase()}, ${util.normalizeName(player.first_name, false)}`; }

   function calcPoints(match, points_table, category, event_rank) {
      category = category || (match.event && match.event.category);
      event_rank = event_rank || (match.event && match.event.rank);

      // TODO: remove this hack...
      if (env.org == 'HTS') {
         let legacy = {
            '12': 'U12',
            '14': 'U14',
            '16': 'U16',
            '18': 'U18',
            '20': 'S',
         }
         if (legacy[category]) category = legacy[category];
      }

      // deal with legacy situation...
      let match_round = match.round_name || match.round;

      // draw_positions is total # of draw positions
      let qualifying = match_round.indexOf('Q') >= 0 && match_round != 'QF' && match_round.indexOf('RR') < 0;
      let round = qualifying ? `${match.draw_positions}${match_round}` : match_round;

      if (points_table && points_table.categories[category] && points_table.categories[category][match.format]) {
         let points_mapping = points_table.categories[category][match.format].mapping;
         let mapping = points_table.mappings[points_mapping];
         let multiplier = points_table.categories[category][match.format].multiplier;
         let points_row = (mapping && mapping[round]) ?  mapping[round] : undefined;
         let points = points_row && points_row[event_rank] ? points_row[event_rank] * multiplier : 0;
         if (match.score.toLowerCase().indexOf('abandoned') >= 0) { return 0; }
         return points;
      }
      
      return 0;
   }

   function pointData(match, player, name, points) {
      return { 
         name,
         points, 
         id: player.id,
         date: new Date(match.date).getTime(),
         muid: match.muid, 
         puid: player.puid,
         round: match.round,
         gender: player.sex,
         format: match.format,
         rank: match.event ? match.event.rank : match.tournament ? match.tournament.rank : '',
         tuid: match.tournament.tuid,
         category: match.event ? match.event.category : match.tournament ? match.tournament.category : '',
         tournament_name: match.tournament.name,
         event_name: match.event ? match.event.name : undefined,
         euid: match.event ? match.event.euid : undefined,
      };
   }

   rank.determineGender = (match) => {
      let genders = match.players.map(p => p.sex).filter(f=>f).filter((item, i, s) => s.lastIndexOf(item) == i);
      return !genders.length ? '' : genders.length > 1 ? 'X' : genders[0];
   }

   rank.calcMatchesPoints = ({ matches, points_table, points_date }) => {
      let player_points = { singles: {}, doubles: {} };
      matches.forEach(match => {
         if (points_date) { match.date = points_date.getTime(); }
         let ranking_attributes = points_table.rankings[match.event.rank];
         let first_round_points =  ranking_attributes.first_round_points && ranking_attributes.first_round_points[match.event.draw_type];

         let losing_rounds = {
            'F': 'SF',
            'SF': 'QF',
            'QF': 'R16',
            'R12': 'R16',
            'R16': 'R32',
            'R24': 'R32',
            'R32': 'R64',
            'R48': 'R64',
            'R64': 'R128',
            'R96': 'R128',
            'R128': 'R256'
         }; 
         let consolation_rounds = ['C1', 'C2', 'C4', 'C8', 'C16', 'C16', 'C32', 'C32', 'C64', 'C64', 'C128', 'C128']; 
         let round_index = ['F', 'SF', 'QF', 'R12', 'R16', 'R24', 'R32', 'R48', 'R64', 'R96', 'R128'].indexOf(match.round_name);

         if (!match.consolation) {
            awardPoints(match, match.winner);

            if (first_round_points) {
               match.round_name = losing_rounds[match.round_name];
               awardPoints(match, 1 - match.winner);
            }
         } else {
            let winner_round = consolation_rounds[round_index]; 
            let loser_round = consolation_rounds[round_index + 1]; 

            match.round_name = winner_round;
            awardPoints(match, match.winner);

            if (first_round_points) {
               match.round_name = loser_round;
               awardPoints(match, 1 - match.winner);
            }
         }

      });

      function awardPoints(match, team_index) {
         let points = calcPoints(match, points_table);
         match.team_players[team_index].forEach(pindex => {
            let player = match.players[pindex];
            let name = fullName(player);
            let pp = player_points[match.format];
            if (!pp[name] || points > pp[name].points) { pp[name] = pointData(match, player, name, points); }
         });
      }

      return player_points;
   }

   // used for matches which are imported from spreadsheets
   rank.bulkPlayerPoints = ({matches, category, rankings, date, points_table}) => {
      let player_points = { singles: {}, doubles: {} };

      let determineRank = (match, rankings) => {
         let gender = rank.determineGender(match);
         rankings = rankings[gender] || rankings;
         return match.format == 'doubles' ? rankings.dbl_rank : rankings.sgl_rank;
      }

      // calculates points for winner of match
      // TODO: in order to calculate points for loser of match there needs to
      // be a function which returns the round prior to the match round...
      // a loser could be assigned points for losing ONLY IF they already had
      // points for a prior round... or if it is determined that the match is
      // not the FIRST ROUND of the tournament

      matches.forEach(match => {
         if (date) { match.date = date.getTime(); }
         if (category) match.tournament.category = +category;

         match.tournament.rank = determineRank(match, rankings);

         if (!match.consolation) {
            let points = calcPoints(match, points_table, category, match.tournament.rank);
            match.teams[match.winner].forEach(pindex => {
               let player = match.players[pindex];
               let name = fullName(player);
               let pp = player_points[match.format];
               if (!pp[name] || points > pp[name].points) { pp[name] = pointData(match, player, name, points); }
            });
         }
      });

      return player_points;
   }

   // http://www.atpworldtour.com/en/rankings/singles?rankDate=2017-07-03&rankRange=1-600&countryCode=CRO
   // http://www.wtatennis.com/rankings // Then a drop down list box...

   rank.calculateRankLists = (week, year) => {

      // TODO:
      // Keep a list of tournaments added and tournaments whose ranking has been
      // modified since the last calculation of Player Points
      // When calculateRankLists is run, check that there are no tournaments in
      // the range from a year before the target week to the target week

      return new Promise((resolve, reject) => {
         if (!week) week = rank.getWeek(new Date());
         if (!year) year = new Date().getFullYear();

         db.findAllPlayers().then(players => {
            let categories = {};
            players.forEach(player => {
               let born = player.birth ? new Date(player.birth).getFullYear() : undefined;
               if (player.points && player.points[year] && player.points[year][week]) {
                  let category_points = player.points[year][week];
                  Object.keys(category_points).forEach(category => {
                     if (!categories[category]) categories[category] = { M: [], W: [] };
                     if (player.sex) {
                        let details ={ 
                           born,
                           id: player.id,
                           ioc: player.ioc,
                           puid: player.puid, 
                           club: player.club,
                           category: rank.baseCategory(born, year),
                           points: player.points[year][week][category],
                           name: `${player.last_name}, ${player.first_name}`,
                        };
                        if (player.rankings && player.rankings[year]) {
                           let priorweeks = Object.keys(player.rankings[year]).filter(f => f < week);
                           if (priorweeks.length) {
                              let priorweek = Math.max(...priorweeks);
                              let priorrank = player.rankings[year][priorweek][category];
                              if (priorrank) details.priorrank = priorrank;
                           }
                        }
                        categories[category][player.sex].push(details); 
                     }
                  });
               }
            });
            Object.keys(categories).forEach(category => {
               if (categories[category].M) categories[category].M.sort((a, b) => b.points.total - a.points.total);
               if (categories[category].W) categories[category].W.sort((a, b) => b.points.total - a.points.total);
            });
            resolve(categories);
         });
      });
   }

   rank.addRankHistories = (categories, ranking_date) => {
      return new Promise((resolve, reject) => {
         let rankings = {};
         Object.keys(categories).forEach(category => {
            Object.keys(categories[category]).forEach(gender => {

               let last_points;
               let last_ranking;
               categories[category][gender].forEach((player, i) => {
                  let eligible_categories = calculatePlayerCategories({ birth_year: player.born, calc_date: ranking_date });
                  let numeric_category = parseInt(category.match(/\d+/)[0]);
                  if (eligible_categories.indexOf(numeric_category) >= 0 && player.points.total) {
                     if (!rankings[player.puid]) rankings[player.puid] = {};

                     let ranking = (!last_points || +player.points.total < last_points) ? i + 1 : last_ranking;
                     last_ranking = ranking;
                     last_points = +player.points.total;

                     // rankings[player.puid][category] = i + 1;
                     rankings[player.puid][category] = ranking;

                  }
               });

            });
         });

         let year = ranking_date.getFullYear();
         let week = rank.getWeek(ranking_date.getTime()); 

         let data = Object.keys(rankings).map(puid => { return { puid, week, year, rankings: rankings[puid] } });

         if (data.length) {
            performTask(addRankHistory, data, false).then(resolve, (err) => { console.log(err); reject(err); } );
         } else {
            reject('no ranking data');
         }
      });
   }

   // calculates total points in each category for all weeks from start_date until end_date
   // point totals represent all points for the year preceding each ranking week
   rank.calcAllPlayerPoints = (start_date, end_date = new Date().getTime()) => {
      return new Promise((resolve, reject) => {
         let subtractWeek = (date) => { let now = new Date(date); return now.setDate(now.getDate() - 7); }
         let addWeek = (date) => { let now = new Date(date); return now.setDate(now.getDate() + 7); }
         if (!end_date) end_date = addWeek(new Date().getTime());
         if (!start_date) start_date = subtractWeek(end_date);

         let dates = [].concat(...d3.timeWeeks(start_date, end_date), start_date, end_date).map(date => new Date(date).getTime());
         let addCalcs = () => addCalcDates(dates, 'points').then(resolve, reject);

         // only calculate for players with point events in the year prior to the start date
         let start_date_year = new Date(start_date).getFullYear();
         let points_date = new Date(new Date(start_date).setFullYear(start_date_year - 1)).getTime();
         db.pointsAfter(points_date).then(cP, reject);

         function cP(points) {
            let puids = unique(points.map(p => p.puid));
            let data = puids.map(puid => { return { puid, start_date, end_date, } });
            if (data.length) {
               performTask(rank.calculatePlayerRankingPoints, data, false).then(addCalcs, reject);
            } else {
               resolve();
            }
         }
      });
   }

   function addCalcDates(dates, type) {
      return new Promise((resolve, reject) => {
         let hasharray = [];
         let data = [];

         dates.forEach(date => { 
            let week = rank.getWeek(date);
            let year = new Date(date).getFullYear();
            let hash = `${year}${week}${type}`;
            if (hasharray.indexOf(hash) < 0) {
               hasharray.push(hash);
               data.push({ hash, date, type, year, week, valid: true });
            }
         });

         performTask(db.addCalcDate, data, false).then(resolve, reject);
      });
   }

   function invalidCategories(categories, year, birth) {
      return Object.keys(categories).filter(category => !rank.validCategory(category, year, birth));
   }

   // intended to be passed as a parameter into db.modify
   // 'item' in this context refers to 'player'
   function modifyPlayerRankHistory ({ item, week, year, rankings }) {
      if (!item.rankings) item.rankings = {};
      if (!item.rankings[year]) item.rankings[year] = {};
      item.rankings[year][week] = rankings;
   }

   // params = {puid, week, year, rankings}
   function addRankHistory(params) { return db.modify('players', 'puid', params.puid, modifyPlayerRankHistory, params); }

   // intended to be passed as a parameter into db.modify
   // 'item' in this context refers to 'player'
   function modifyPlayerRankingPoints ({ item, ranking_points }) {
      if (!item.points) item.points = {};
      let years = ranking_points.map(t=>t.year).filter((item, i, s) => s.lastIndexOf(item) == i);
      years.forEach(year => {
         if (!item.points[year]) item.points[year] = {};
         ranking_points
            .filter(row => row.year == year)
            .forEach(row => {
               let invalid_categories = invalidCategories(row.categories, year, item.birth);
               invalid_categories.forEach(category => delete row.categories[category]);
               item.points[year][row.week] = row.categories;
            });
      });
   }

   // params = {puid, ranking_points}
   function addPointsHistory(params) { return db.modify('players', 'puid', params.puid, modifyPlayerRankingPoints, params); }

   // to delete all points and rankings records:
   // db.db.players.toCollection().modify(player => delete player.points);
   // db.db.players.toCollection().modify(player => delete player.rankings);

   // intended to be passed as a parameter into db.modify
   // 'item' in this context refers to 'tournament'
   function modifyTournamentRanking({ item, category, rankings }) {
      if (rankings.M) modifyRank('M');
      if (rankings.W) modifyRank('W');
      if (!rankings.M && !rankings.W) {
         rankings.M = {
            category: rankings.category,
            sgl_rank: rankings.sgl_rank,
            dbl_rank: rankings.dbl_rank
         }
         modifyRank('M');
      }

      function modifyRank(gender) {
         if (!item.accepted) item.accepted = {};
         item.accepted[gender] = Object.assign({}, { category }, rankings[gender]);
      }
   }

   // params = {tuid, category, rankings}
   rank.addAcceptedRanking = (params) => {
      dev.params = params;
      db.modify('tournaments', 'tuid', params.tuid, modifyTournamentRanking, params);
   }

   rank.calculatePlayerRankingPoints = ({puid, start_date, end_date = new Date().getTime()}) => {
      let range = (start, end) => Array.from({length: (end - start)}, (v, k) => k + start);
      let addWeek = (date) => { let now = new Date(date); return now.setDate(now.getDate() + 7); }

      return new Promise((resolve, reject) => {

         db.findPlayer(puid).then(player => db.findPlayerPoints(puid).then(points => calcRankingPoints(player, points)));

         function calcRankingPoints(player, points) {
            if (!player) {
               console.log('no match for PUID:', puid);
               return reject();
            }
            let start_year = new Date(start_date).getFullYear();
            let start_week = rank.getWeek(start_date);
            let end_year = new Date(end_date).getFullYear();
            let end_week = rank.getWeek(end_date);
            let date = getDateByWeek(start_week, start_year).getTime();

            let date_array = [];
            while (date < end_date) {
               date_array.push(date);
               date = addWeek(date);
            }

            let ranking_points = date_array.map(date => calcDate(player, points, date)).filter(week => Object.keys(week.categories).length);
            addPointsHistory({puid, ranking_points}).then(resolve(ranking_points), reject);
         }

         function calcDate(player, points, ranking_date) {
            let cpts = rank.calculateRankingPoints(player, points, ranking_date);

            let rpts = {};
            let born = player.birth ? new Date(player.birth).getFullYear() : undefined;
            let base = rank.baseCategory(born, new Date(ranking_date).getFullYear());
            Object.keys(cpts).map(category => {
               let point_events = cpts[category];

               let reduce = (point_events) => point_events.map(p => +p.points).reduce((a, b) => a + b, 0);

               let team_events = point_events.filter(e=>e.tournament_type == 'MO');
               let singles_events = point_events.filter(e=>e.format == 'singles' && e.tournament_type != 'MO');
               let singles_events_up = singles_events.filter(e=>e.category > category);
               let doubles_events = point_events.filter(e=>e.format == 'doubles' && e.tournament_type != 'MO');
               let doubles_events_up = doubles_events.filter(e=>e.category > category);

               let team = team_events.length ? reduce(team_events) : 0;
               let singles = singles_events.length ? reduce(singles_events) : 0;
               let singles_up = singles_events_up.length ? reduce(singles_events_up) : 0;
               let doubles = doubles_events.length ? reduce(doubles_events) : 0;
               let doubles_up = doubles_events_up.length ? reduce(doubles_events_up) : 0;

               let total = point_events.length ? reduce(point_events) : 0;

               // 'U' necessary because 20 was not showing up when added to object!!
               if (category >= base && total > 0) rpts[`U${category}`] = { total, singles, doubles, singles_up, doubles_up, team };
            });

            return {
               week: rank.getWeek(ranking_date),
               year: new Date(ranking_date).getFullYear(),
               categories: rpts,
            }
         }
      });
   }

   rank.calculatePlayerCategories = calculatePlayerCategories;
   function calculatePlayerCategories({birth_year, calc_date, calc_year}) {
      if (!calc_date && !calc_year) return [];
      let categories = [12, 14, 16, 18, 20];
      calc_year = calc_year || new Date(calc_date).getFullYear();
      let player_age = calc_year - birth_year;
      return categories
         .filter(category => (category == 20 && player_age >= 20) || (category >= player_age && category <= player_age + 5));
   }

   rank.calculateRankingPoints = (player, points, ranking_date) => {

      // TODO: tournament_type specification is HR specific.  Should be 'Team';
      let team = (pts) => pts.filter(f=>f.tournament_type == 'MO');
      let singles = (pts) => pts.filter(f=>f.format == 'singles' && f.tournament_type != 'MO');
      let doubles = (pts) => pts.filter(f=>f.format != 'singles' && f.tournament_type != 'MO');
      let expireDate = (date) => date - (365 * 24 * 60 * 60 * 1000);

      let player_year = player.birth ? new Date(player.birth).getFullYear() : undefined;
      let eligible_categories = calculatePlayerCategories({ birth_year: player_year, calc_date: ranking_date });
      let pDate = (p) => new Date(p).getTime();
      let valid = points.filter(p => pDate(p.date) > expireDate(ranking_date) && pDate(p.date) <= ranking_date);

      // separate points into singles and doubles
      let sglDblTeam = (pts) => { return { singles: singles(pts), doubles: doubles(pts), team: team(pts) }};

      // order points from greatest to least
      let bigPoints = (pts) => pts.sort((a, b) => (b.points || 0) - a.points);

      // filter points by category then organize by format and sort point values
      let categoryFilter = (pts, category) => sglDblTeam(bigPoints(pts.filter(f=>f.category == category))); 

      // create an object given keys, and array of points, and a function
      let oMap = (keys, arr, fx) => Object.assign(...keys.map(k => ({ [k]: fx(arr, k) })));

      let cpts = {};
      let categories = unique([].concat(...valid.map(v=>+v.category), ...eligible_categories));

      // add older categories for which player is eligible
      // do it this way so that younger categories for which there are no points
      // are not added...
      let max_category = Math.max(...categories);
      eligible_categories.forEach(category => { if (category > max_category) categories.push(category) });

      if (categories.length) {
         let category_points = oMap(categories, valid, categoryFilter);
         let ranking_points = Object.assign(...categories.map(category => ({ [category]: calcCategory(category) })));

         Object.keys(ranking_points).forEach(category => {
            let cpoints = [].concat(...ranking_points[category].singles, ...ranking_points[category].doubles, ...ranking_points[category].team);
            cpts[category] = cpoints;
         });

         function calcCategory(category) {

            let usingles = [];
            let udoubles = [];

            // first take the two highest from category above
            if (rank.plus2 && category_points[+category + 2]) {
               usingles = category_points[+category + 2].singles.slice(0, 2);
               udoubles = category_points[+category + 2].doubles.slice(0, 2);
            }

            // also take the two highest from two categories above
            if (rank.plus4 && category_points[+category + 4]) {
               usingles = [].concat(...usingles, category_points[+category + 4].singles.slice(0, 2));
               udoubles = [].concat(...udoubles, category_points[+category + 4].doubles.slice(0, 2));
            }

            // limit to two highest from higher categories
            usingles = bigPoints(usingles).slice(0,2);
            udoubles = bigPoints(udoubles).slice(0,2);

            // add all category points
            // team points only count for the category in which they were earned
            let team = category_points[category].team;

            let singles = [].concat(...usingles, category_points[category].singles);
            let doubles = [].concat(...udoubles, category_points[category].doubles);

            // add all points from category BELOW
            if (rank.minus2 && category_points[+category - 2]) {
               singles = [].concat(...singles, category_points[+category - 2].singles);
               doubles = [].concat(...doubles, category_points[+category - 2].doubles);
            }

            // add all points from 2 categories BELOW
            if (rank.minus4 && category_points[+category - 4]) {
               singles = [].concat(...singles, category_points[+category - 4].singles);
               doubles = [].concat(...doubles, category_points[+category - 4].doubles);
            }

            // take top 6 singles and top 4 doubles
            singles = bigPoints(singles).slice(0, +category == 20 ? 10 : 6);
            doubles = bigPoints(doubles).slice(0, +category == 20 ? 10 : 4);

            return { singles, doubles, team };
         }
      }

      return cpts;
   }

   rank.exportRankLists = ({ week, year, categories }) => {
      return new Promise( (resolve, reject) => {
         generateRankListExports({ week, year, categories })
            .then(exp.downloadRankLists, reject)
            .then(resolve, reject);
      });
   }

   function getName(obj) {
      return new Promise((resolve, reject) => {
         exp.getName()
            .then(name => resolve(Object.assign(obj, { name })), resolve(Object.assign(obj, { name: obj.logo })));
      });
   }

   function getClubs(obj) {
      return new Promise((resolve, reject) => {
         db.findAllClubs().then(rows => {
            let clubs = Object.assign({}, ...rows.map(club => ({ [club.id]: club })));
            resolve(Object.assign(obj, { clubs }));
         }, reject);
      });
   }

   rank.rankListPDF = ({ category, gender, list }) => {
      exp.getLogo().then(logo => getName({logo})).then(getClubs).then(obj => {
         exportPDFRankList(category, gender, list, obj.clubs, obj.logo, obj.name);
      });
   }

   function exportPDFRankList(category, gender, list, clubs, logo, name) {
      let header = [ 
         { text: '#', style: 'tableHeader' }, 
         { text: lang.tr('ply'), style: 'tableHeader' }, 
         { text: lang.tr('byr'), style: 'tableHeader' }, 
         { text: lang.tr('cta'), style: 'tableHeader' }, 
         { text: lang.tr('clb'), style: 'tableHeader' }, 
         { text: 'UK', style: 'tableHeader' }, 
         { text: 'POUK', style: 'tableHeader' }, 
         { text: 'PKUK', style: 'tableHeader' }, 
         { text: 'PK', style: 'tableHeader' }, 
         { text: 'PKST', style: 'tableHeader' }, 
         { text: 'PAUK', style: 'tableHeader' }, 
         { text: 'PA', style: 'tableHeader' }, 
         { text: 'PAST', style: 'tableHeader' }, 
         { text: 'M', style: 'tableHeader' }, 
      ];

      let last_points;
      let last_ranking;
      let rows = list.filter(f=>f.points.total).map((row, i) => {
         if (!row.name) return;

         let ranking = (!last_points || +row.points.total < last_points) ? i + 1 : last_ranking;
         last_ranking = ranking;
         last_points = +row.points.total;

         let diff = '';
         let rdiff = row.priorrank ? (row.priorrank - i - 1) : undefined;
         if (rdiff) diff = ` (${rdiff})`;
         ranking = ranking + diff;
         let color = rdiff > 0 ? 'green' : rdiff < 0 ? 'red' : 'black';

         // TODO: fix this.  need to add style to diff (green/red)
         // and make it so that ranking and diff are on same line
         // this below puts them in a column...
         // ranking = [ { text: ranking }, {text: diff } ];

         return [
            { text: ranking, color: color },
            row.name, 
            row.born || '', 
            row.category, 
            clubs[row.club] ? clubs[row.club].name : '',
            row.points.total, 
            +row.points.singles + +row.points.doubles,
            row.points.singles,
            +row.points.singles - +row.points.singles_up,
            row.points.singles_up,
            row.points.doubles,
            +row.points.doubles - +row.points.doubles_up,
            row.points.doubles_up,
            row.points.team,
         ]


      }).filter(f=>f);
      let body = [].concat([header], rows);

      var docDefinition = {
         pageSize: 'A4',
         pageOrientation: 'landscape',

         content: [
            { text: `${lang.tr('rl')} ${category} ${gender}`, style: 'centerText', },
            {
               alignment: 'center',
               columns: [
                  {
                     image: logo || '',
                     width: 350,
                  },
                  { text: ' ', width: '*' },
                  { 
                     image: name || '',
                     width: 350,
                  },
               ]
            },
            {
               fontSize: 10,
               table: {
                  headerRows: 1,
                  widths: [ 'auto', '*', 'auto', 'auto', '*', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto' ],
                  body,
               },
               layout: {
                  fillColor : function (i, node) { return (i % 2 === 0) ?  '#EAEDED' : null; },

                  hLineWidth: function (i, node) { return (i === 0) ? 2 : 0; },
                  hLineColor: function (i, node) { return (i === 0) ? 'black' : 'gray'; },

                  vLineWidth: function (i, node) { return 0; },
                  vLineColor: function (i, node) { return 'gray'; },
               },
            }
         ],

         styles: {
            centerText: {
               fontSize: 22,
               bold: true,
               alignment: 'center',
            },
            tableHeader: {
               fontSize: 12,
               color: 'white',
               bold: true,
               background: 'black',
               fillColor: 'black',
            },
            defaultStyle: {
               columnGap: 20,
            }
         }
      };

      let filename = `${category}-${gender}.pdf`;
      // exp.savePDF(docDefinition, filename);
      exp.openPDF(docDefinition, filename);
   }

   function generateRankListExports({ week, year, categories }) {
      return new Promise( (resolve, reject) => {
         let lists = [];

         db.findAllClubs().then(exportLists); 

         function exportLists(clubs) {
            let clubByKey = Object.assign({}, ...clubs.map(club => { return { [club.id]: club }}));

            Object.keys(categories).forEach(category => {
               exportList(category, 'M', categories[category].M);
               exportList(category, 'W', categories[category].W);
            });

            resolve(lists);

            function exportList(category, gender, players) {
               let list = players.map((player, i) => {
                  return {
                     spol: gender,
                     sezona: year,
                     plasman: i + 1,
                     igracID: player.id,
                     first: player.name.split(',').reverse()[0].trim(),
                     last: player.name.split(',')[0].trim(),
                     born_year: player.born,
                     kategorija: player.category,
                     klub: player.club && clubByKey[player.club] ? clubByKey[player.club].code : '',
                     klub_long: player.club && clubByKey[player.club] ? clubByKey[player.club].name : '',
                     UK: player.points.total,
                     POUK: +player.points.singles + +player.points.doubles,
                     PKUK: +player.points.singles,
                     PK: +player.points.singles - +player.points.singles_up,
                     PKST: +player.points.singles_up,
                     PAUK: +player.points.doubles,
                     PA: +player.points.doubles - +player.points.doubles_up,
                     PAST: +player.points.doubles_up,
                     M: +player.points.team,
                     catID: player.id + '-' + player.category,
                  }
               });
               lists.push({ category, gender, week, year, list });
            }
         }
      });
   }

   rank.getWeek = (date, dowOffset) => {
      date = new Date(+date);
      dowOffset = typeof(dowOffset) == 'int' ? dowOffset : 0;
      var newYear = new Date(date.getFullYear(),0,1);
      var day = newYear.getDay() - dowOffset;
      day = (day >= 0 ? day : day + 7);
      var daynum = Math.floor((date.getTime() - newYear.getTime() - (date.getTimezoneOffset()-newYear.getTimezoneOffset())*60000)/86400000) + 1;

      var weeknum;

      //if the year starts before the middle of a week
      if (day < 4) {
         weeknum = Math.floor((daynum+day-1)/7) + 1;
         if (weeknum > 52) {
            nYear = new Date(date.getFullYear() + 1,0,1);
            nday = nYear.getDay() - dowOffset;
            nday = nday >= 0 ? nday : nday + 7;
            weeknum = nday < 4 ? 1 : 53;
         }
      } else {
         weeknum = Math.floor((daynum+day-1)/7);
      }
      return weeknum;
   };

   rank.getDateByWeek = getDateByWeek;
   function getDateByWeek(week, year) {
      let d = new Date(year, 0, 1);
      let dayNum = d.getDay();
      let requiredDate = --week * 7;
      if (((dayNum!=0) || dayNum > 4)) requiredDate += 7;
      d.setDate(1 - d.getDay() + ++requiredDate );
      return d;
   }

   rank.lastRankingDate = lastRankingDate;
   function lastRankingDate() {
      let today = new Date();
      let year = today.getFullYear();
      let month = today.getMonth();
      let first_monday = firstMonday(month, year);
      if (first_monday > today) first_monday = firstMonday(month - 1, year);
      return first_monday;
   }

   function firstMonday (month, year){
       var d = new Date(year, month, 1, 0, 0, 0, 0);
       var day = 0;
       if (d.getDay() == 0) {
          day = 2;
          d = d.setDate(day);
          d = new Date(d);
       } else if (d.getDay() != 1) {
          day = 9-(d.getDay());
          d = d.setDate(day);
          d = new Date(d);
       }
       return d;
    }

   function yearEndAge(year, birthday) {
      let year_end = new Date(`${year + 1}-01-01`);
      var ageDifMs = year_end - new Date(birthday).getTime();
      var ageDate = new Date(ageDifMs);
      return Math.abs(ageDate.getUTCFullYear() - 1970);
   }

   rank.validCategory = (category, year, birth) => {
      let age = yearEndAge(year, birth);
      if (age > 16 && category == 20) return true;
      if (age > category) return false;
      if (age < category - 4) return false;
      return true;
   }

   rank.baseCategory = (born, year = new Date().getFullYear()) => {
      let age = yearEndAge(year, new Date(born, 1, 1).getTime());
      let categories = [18, 16, 14, 12, 10];
      let category = 20;
      categories.forEach(c => { if (age <= c) category = c});
      return category;
   }

   function performTask(fx, data, bulkResults = true) {
      return new Promise(function(resolve, reject) {
         let results = [];
         if (!data.length) return reject();
         nextItem();

         function nextItem() {
            if (!data.length) return resolve(results);
            let params = data.pop();
            if (!params) {
               nextItem();
            } else {
               fx(params).then(delayNext, handleError);
            }
         }

         function handleError(err) { 
            delayNext(); 
         }
         function delayNext(result) { 
            if (bulkResults && result) results.push(result);
            nextItem();
         }
      });
   }

   if (typeof define === "function" && define.amd) define(rank); else if (typeof module === "object" && module.exports) module.exports = rank;
   this.rank = rank;
 
}();

/*

   // HOW TO TEST FOR DUPLICATE POINTS

   db.findAllPlayers().then(p=>players=p);
   db.findAllPoints().then(p => points = p);

   // players with all their points
   pp = players.map(player => { return { player, points: points.filter(p=>p.id == player.id) }});

   // players who actually have points
   pwp = pp.filter(p=>p.points.length > 1);

   let moreThanOne = (tpoints) => {
     let singles = tpoints.filter(p => p.format == 'singles');
     let doubles = tpoints.filter(p => p.format == 'doubles');
     if (singles.length > 1 || doubles.length > 1) return true;
   }

   // players with multiple tournament points in same category
   pwmtp = pwp.map(pwp => {
      let tpoints = {};
      pwp.points.forEach(point => {
         if (!tpoints[point.tuid]) tpoints[point.tuid] = [];
         tpoints[point.tuid].push(point);
      });
      let mult = Object.keys(tpoints).map(key => moreThanOne(tpoints[key])).reduce((a, b) => a && (b || true));
      if (mult) {
         pwp.tpoints = tpoints;
         return pwp;
      }
   }).filter(f=>f);

   // points to be removed...

   muids = [
      "CRO-BAB50852-HTS153-singles-KV2",
      "HTS423belvanovićDJA2marincelSLV3RRQ2",
      "CRO-GOL11387-HTS153-singles-KV2",
      "CRO-KEŠ68790-HTS153-singles-KV1",
      "CRO-LOZ38833-HTS153-singles-KV2",
      "CRO-MAR48578-HTS153-singles-KV1",
      "CRO-PRE13229-HTS175-singles-KV3",
      "CRO-PUH18643-HTS172-singles-KV1",
      "CRO-REZ31324-HTS153-singles-KV3",
      "CRO-RIH68249-HTS153-singles-KV3",
      "CRO-SIT33815-HTS272-doubles-17.-32.",
      "CRO-SOL83583-HTS153-singles-KV3",
      "CRO-STE43903-HTS153-singles-KV2",
      "CRO-SUD96075-HTS153-singles-KV3",
      "CRO-SVJ15789-HTS153-singles-KV1",
      "CRO-VER28764-HTS153-singles-KV2",
      "HTS409lekoBAL5žufićBAL5culmanovaLJD6čupićRBC6QF",
   ];

   let delp = (muid) => db.db.points.where('muid').equals(muid).delete().then(c => console.log( "Deleted " + c));

*/
