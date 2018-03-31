import { db } from './db'
import { util } from './util';
import { config } from './config';
import { lang } from './translator';
import { playerFx } from './playerFx';
import { exportFx } from './exportFx';
import { displayGen } from './displayGen';

export const rankCalc = function() {

   // requires db{}, util{}, exp{}
   var rank = {};

   rank.point_issues = [];

   rank.pointCalc = pointCalc;
   function pointCalc(selected_date) {
      if (selected_date) {
         displayGen.showProcessing('Calculating Ranking Points ...');
         rank.calcAllPlayerPoints(undefined, new Date(selected_date).getTime()).then(d=>displayGen.closeModal());
      }
   }

   rank.rankCalc = rankCalc;
   function rankCalc(selected_date) {
      selected_date = typeof selected_date == 'string' ? new Date(selected_date) : selected_date;
      var week = rank.getWeek(selected_date.getTime()); 
      var year = selected_date.getFullYear();

      function dpp(evt) {
         var elem = util.getParent(evt.target, 'player_rank');
         var puid = elem.getAttribute('puid');
         playerFx.displayPlayerProfile({ puid }).then(()=>{}, ()=>{});
      }

      displayGen.showProcessing('Calculating Current Rank List ...');
      rank.calculateRankLists(week, year).then(categories => { 

         var rankings = { week, year, categories };
         displayGen.closeModal(); 

         if (Object.keys(categories).length) {
            var container = displayGen.rankLists(categories, week, year);

            util.addEventToClass('print', pdfList, container.container.element)
            util.addEventToClass('category_csv', exportCategorySpreadsheet, container.container.element)
            util.addEventToClass('spreadsheet', exportCategoriesSpreadsheet, container.container.element)
            util.addEventToClass('icon_json', exportJSON, container.container.element)

            Array.from(container.container.element.querySelectorAll('.player_rank')).forEach(elem => elem.addEventListener('click', dpp));

            rank.addRankHistories(categories, selected_date).then(() => { 
               let data = { hash: `${year}${week}rankings`, date: new Date(selected_date).getTime(), type: 'rankings', year, week, valid: true };
               db.addCalcDate(data);
            }, (err) => console.log(err));
         } else {
            displayGen.showModal(`<h2>${lang.tr('phrases.nopointcalcs')}</h2>`);
         }

         function pdfList(ev) {
            var category = ev.target.getAttribute('category');
            var gender = ev.target.getAttribute('gender');
            rank.rankListPDF({ category, gender, list: rankings.categories[category][gender], week, year, date: selected_date });
         }
         function exportCategoriesSpreadsheet(ev) {
            console.log('export spreadsheeet containing all categories');
         }
         function exportCategorySpreadsheet(ev) {
            var category = ev.target.getAttribute('category');
            var gender = ev.target.getAttribute('gender');
            var ranklist = {
               week,
               year,
               category,
               gender,
               list: rankings.categories[category][gender]
            };
            exportFx.rankListCSV(ranklist);
         }
         function exportJSON() { exportFx.downloadRankings(rankings); }
      });
   }

   function fullName(player) { return `${player.last_name.toUpperCase()}, ${util.normalizeName(player.first_name, false)}`; }
   function calcPoints({ match, points_table, category, event_rank, round_name }) {
      category = config.legacyCategory(category || (match.event && match.event.category), true);
      event_rank = event_rank || (match.event && match.event.rank);

      // this handles legacy situation...  TODO: cleanup / standardize
      let match_round = round_name || match.round_name || match.round;

      // draw_positions is total # of draw positions
      let qualifying = match_round && match_round.indexOf('Q') >= 0 && match_round != 'QF' && match_round.indexOf('RR') < 0;
      let round = qualifying ? `${match.draw_positions}${match_round}` : match_round;

      if (points_table && points_table.categories[category] && points_table.categories[category][match.format]) {
         let points_mapping = points_table.categories[category][match.format].mapping;
         let mapping = points_table.mappings[points_mapping];
         let multiplier = points_table.categories[category][match.format].multiplier;
         let points_row = (mapping && mapping[round]) ?  mapping[round] : undefined;
         let points = points_row && points_row[event_rank] ? points_row[event_rank] * multiplier : 0;
         if (match.score && match.score.toLowerCase().indexOf('abandoned') >= 0) { return 0; }
         return points;
      }
      
      return 0;
   }

   function pointData(match, player, name, points) {
      let category = match.event ? match.event.category : match.tournament ? match.tournament.category : '';
      return { 
         name,
         points, 
         id: player.id,
         date: new Date(match.date).getTime(),
         muid: match.muid, 
         puid: player.puid,
         round_name: match.round_name,
         calculated_round_name: match.calculated_round_name,
         gender: player.sex,
         format: match.format,
         rank: match.event ? match.event.rank : match.tournament ? match.tournament.rank : '',
         tuid: match.tournament.tuid,
         category,
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
      if (!config.validPointsTable(points_table)) return;
      matches.forEach(match => {
         if (points_date) { match.date = points_date.getTime(); }
         let ranking_attributes = points_table.rankings[match.event.rank];
         if (!ranking_attributes) return;
         let first_round_points = ranking_attributes.first_round_points && util.string2boolean(ranking_attributes.first_round_points[match.event.draw_type]);

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
            'R128': 'R256',
            'R256': 'R512',
            'R512': 'R1024',
         }; 
         let consolation_rounds = ['C1', 'C2', 'C4', 'C8', 'C16', 'C16', 'C32', 'C32', 'C64', 'C64', 'C128', 'C128']; 
         let round_index = ['F', 'SF', 'QF', 'R12', 'R16', 'R24', 'R32', 'R48', 'R64', 'R96', 'R128'].indexOf(match.round_name);

         // insure that any true/false options are boolean not strings
         util.boolAttrs(points_table.options);

         if (!match.consolation) {
            let calculated_round_names = points_table.options && points_table.options.calculated_round_names;
            let round_name = calculated_round_names ? match.calculated_round_name || match.round_name : match.round_name;
            awardPoints(match, match.winner, round_name);

            if (first_round_points) {
               let losing_round_name = losing_rounds[round_name];
               awardPoints(match, 1 - match.winner, losing_round_name);
            }
         } else {
            let winner_round = consolation_rounds[round_index]; 
            let loser_round = consolation_rounds[round_index + 1]; 

            let round_name = winner_round;
            awardPoints(match, match.winner, round_name);

            if (first_round_points) {
               let round_name = loser_round;
               awardPoints(match, 1 - match.winner, round_name);
            }
         }

      });

      function awardPoints(match, team_index, round_name) {
         let points = calcPoints({ match, points_table, round_name });
         match.team_players[team_index].forEach(pindex => {
            let player = match.players[pindex];
            let name = fullName(player);
            let pp = player_points[match.format];
            if (match.score && match.score.trim() == 'W.O.') {
               let wow = config.env().points.walkover_wins;
               if (Array.isArray(wow) && wow.indexOf(match.round) < 0) return;
            }
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

      matches.forEach(match => {
         if (date) { match.date = date.getTime(); }
         match.tournament.rank = determineRank(match, rankings);

         if (!match.consolation) {
            let points = calcPoints({ match, points_table, category, event_rank: match.tournament.rank });
            match.teams[match.winner].forEach(pindex => {
               if (typeof pindex == 'object') console.log('match.teams objects not indices');
               let player = typeof pindex == 'object' ? pindex : match.players[pindex];
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
            players.forEach(player => { categories = processPlayer(player, week, year, categories); });
            Object.keys(categories).forEach(category => {
               if (categories[category].M) categories[category].M.sort((a, b) => b.points.total - a.points.total);
               if (categories[category].W) categories[category].W.sort((a, b) => b.points.total - a.points.total);
            });
            resolve(categories);
         });
      });
   }

   rank.processPlayer = processPlayer;
   function processPlayer(player, week, year, categories={}) {
      let born = player.birth ? new Date(player.birth).getFullYear() : undefined;
      if (player.points && player.points[year] && player.points[year][week]) {
         let category_points = player.points[year][week];
         Object.keys(category_points).forEach(category => {
            if (!categories[category]) categories[category] = { M: [], W: [] };
            if (player.sex) {
               let details = { 
                  born,
                  id: player.id,
                  ioc: player.ioc,
                  puid: player.puid, 
                  club: player.club,
                  category: rank.eligibleCategories({ birth_year: born, calc_year: year }).base_category,
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
      return categories;
   }

   rank.addRankHistories = (categories, ranking_date) => {
      return new Promise((resolve, reject) => {
         let rankings = {};
         Object.keys(categories).forEach(category => {

            Object.keys(categories[category]).forEach(gender => {

               let last_points;
               let last_ranking;
               categories[category][gender].forEach((player, i) => {

                  let eligible_categories = rank.eligibleCategories({ birth_year: player.born, calc_date: ranking_date }).categories;
                  let ranking_category = config.legacyCategory(category, true);

                  if (util.isMember(eligible_categories, ranking_category) && player.points.total) {
                     if (!rankings[player.puid]) rankings[player.puid] = {};

                     let ranking = (!last_points || +player.points.total < last_points) ? i + 1 : last_ranking;
                     last_ranking = ranking;
                     last_points = +player.points.total;

                     rankings[player.puid][ranking_category] = ranking;

                  } else {
                     console.log(eligible_categories, category);
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
      rank.point_issues = [];
      return new Promise((resolve, reject) => {
         let subtractWeek = (date) => { let now = new Date(date); return now.setDate(now.getDate() - 7); }
         let addWeek = (date) => { let now = new Date(date); return now.setDate(now.getDate() + 7); }
         if (!end_date) end_date = addWeek(new Date().getTime());
         if (!start_date) start_date = subtractWeek(end_date);

         let dates = [].concat(...d3.timeWeeks(start_date, end_date), start_date, end_date).map(date => new Date(date).getTime());
         let addCalcs = () => addCalcDates(dates, 'points').then(finish, reject);

         // only calculate for players with point events in the year prior to the start date
         let start_date_year = new Date(start_date).getFullYear();
         let points_date = new Date(new Date(start_date).setFullYear(start_date_year - 1)).getTime();
         db.pointsAfter(points_date).then(cP, reject);

         function cP(points) {
            let puids = util.unique(points.map(p => p.puid));
            let data = puids.map(puid => { return { puid, start_date, end_date, } });
            if (data.length) {
               performTask(rank.calculatePlayerRankingPoints, data, false).then(addCalcs, reject);
            } else {
               finish();
            }
         }

         function finish() {
            if (rank.point_issues.length) {
               alert("Point Issues");
               console.log(rank.point_issues);
            }
            resolve();
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
               let birth_year = new Date(item.birth).getFullYear();
               let invalid_categories = rank.eligibleCategories({ birth_year, calc_year: year }).ineligible;
               invalid_categories.forEach(category => delete row.categories[category]);
               item.points[year][row.week] = row.categories;
            });
      });
   }

   // params = {puid, ranking_points}
   function addPointsHistory(params) { return db.modify('players', 'puid', params.puid, modifyPlayerRankingPoints, params); }

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

   rank.addAcceptedRanking = ({tuid, category, rankings}) => {
      let params = {tuid, category, rankings};
      db.modify('tournaments', 'tuid', tuid, modifyTournamentRanking, params);
   }

   rank.calculatePlayerRankingPoints = ({puid, start_date, end_date = new Date().getTime()}) => {
      let range = (start, end) => Array.from({length: (end - start)}, (v, k) => k + start);
      let addWeek = (date) => { let now = new Date(date); return now.setDate(now.getDate() + 7); }

      return new Promise((resolve, reject) => {
         db.findPlayer(puid).then(player => db.findPlayerPoints(puid).then(points => calcRankingPoints(player, points)));

         function calcRankingPoints(player, points) {
            if (!player) { return reject(); }
            let start_year = new Date(start_date).getFullYear();
            let start_week = rank.getWeek(new Date(start_date));
            let end_year = new Date(end_date).getFullYear();
            let end_week = rank.getWeek(end_date);
            let date = getDateByWeek(start_week, start_year).getTime();

            let date_array = [];
            while (date < end_date) {
               date_array.push(date);
               date = addWeek(date);
            }

            let ranking_points = date_array.map(date => rank.calcPlayerDate(player, points, date)).filter(week => Object.keys(week.categories).length);
            addPointsHistory({puid, ranking_points}).then(resolve(ranking_points), reject);
         }
      });
   }

   rank.calcPlayerDate = (player, points, ranking_date) => {
      let cpts = rank.calculateRankingPoints(player, points, ranking_date);

      let rpts = {};
      let born = player.birth ? new Date(player.birth).getFullYear() : undefined;
      let { categories, base_category } = rank.eligibleCategories({ birth_year: born, calc_date: ranking_date });

      Object.keys(cpts).map(ctgy => {
         let category = config.legacyCategory(ctgy, true);
         let point_events = cpts[category] || [];

         point_events.forEach(pe => { if (isNaN(pe.points)) rank.point_issues.push(pe); });

         let reduce = (point_events) => point_events.map(p => util.numeric(p.points)).reduce((a, b) => a + b, 0);
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
         if (util.isMember(categories, category) && total > 0) rpts[category] = { total, singles, doubles, singles_up, doubles_up, team };
      });

      return {
         week: rank.getWeek(ranking_date),
         year: new Date(ranking_date).getFullYear(),
         categories: rpts,
      }
   }

   rank.calculateRankingPoints = (player, points, ranking_date) => {
      // TODO: tournament_type specification is HR specific.  Should be 'Team';
      function team(pts) { return pts.filter(f=>f.tournament_type == 'MO'); }
      function singles(pts) { return pts.filter(f=>f.format == 'singles' && f.tournament_type != 'MO'); }
      function doubles(pts) { return pts.filter(f=>f.format != 'singles' && f.tournament_type != 'MO'); }
      function expireDate(date) { return date - (365 * 24 * 60 * 60 * 1000); }
      function pDate(p) { return new Date(util.formatDate(p)).getTime(); }

      ranking_date = pDate(ranking_date);
      let birth_year = player.birth ? new Date(player.birth).getFullYear() : undefined;
      let eligible_categories = rank.eligibleCategories({ birth_year, calc_date: ranking_date }).categories;

      let valid = points.filter(p => pDate(p.date) > expireDate(ranking_date) && pDate(p.date) <= pDate(ranking_date));

      // separate points into singles and doubles
      let sglDblTeam = (pts) => { return { singles: singles(pts), doubles: doubles(pts), team: team(pts) }};

      // order points from greatest to least
      let bigPoints = (pts) => pts.sort((a, b) => (b.points || 0) - a.points);

      // filter points by category then organize by format and sort point values
      let categoryFilter = (pts, category) => sglDblTeam(bigPoints(pts.filter(f=>f.category == config.legacyCategory(category)))); 

      // create an object given keys, and array of points, and a function
      let oMap = (keys, arr, fx) => Object.assign(...keys.map(k => ({ [k]: fx(arr, k) })));

      let cpts = {};
      let categories = util.uunique([].concat(...valid.map(v=>v.category), ...eligible_categories))
         .map(c=>config.legacyCategory(c, true));

      let points_table = config.pointsTable({calc_date: ranking_date});

      if (categories.length) {
         let category_points = oMap(categories, valid, categoryFilter);
         let ranking_points = Object.assign({}, ...categories.map(category => ({ [category]: calcCategory(category) })));

         Object.keys(ranking_points).forEach(category => {
            let cpoints = [].concat(...ranking_points[category].singles, ...ranking_points[category].doubles, ...ranking_points[category].team);
            // let category = config.legacyCategory(ctgy, true);
            cpts[category] = cpoints;
         });

         function calcCategory(category) {
            let category_table = points_table.categories[category];
            if (!category_table || !category_table.ranking || Object.keys(category_table.ranking).length == 0) {
               return { singles: [], doubles: [], team: [] };
            }

            function formatPoints(format) {
               let points = [];
               if (!category_table.ranking[format]) return points
               Object.keys(category_table.ranking[format].lists).forEach(c => {
                  let limit = category_table.ranking[format].lists[c];
                  let cpts = category_points[c];
                  if (cpts && cpts[format]) points = points.concat(...cpts[format].slice(0, limit));
               });
               return points;
            }

            let singles = formatPoints('singles');
            let doubles = formatPoints('doubles');
            let singles_max = category_table.ranking.singles.events;
            let doubles_max = category_table.ranking.doubles.events;
            singles = bigPoints(singles).slice(0, singles_max);
            doubles = bigPoints(doubles).slice(0, doubles_max);

            // team points only count for the category in which they were earned
            let team = category_points[category].team;

            return { singles, doubles, team };
         }
      }

      return cpts;
   }

   rank.exportRankLists = ({ week, year, categories }) => {
      return new Promise( (resolve, reject) => {
         generateRankListExports({ week, year, categories })
            .then(exportFx.downloadRankLists, reject)
            .then(resolve, reject);
      });
   }

   function getName(obj) {
      return new Promise((resolve, reject) => {
         exportFx.getName()
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

   rank.rankListPDF = ({ category, gender, list, week, year, date }) => {
      exportFx.getLogo().then(logo => getName({logo})).then(getClubs).then(obj => {
         exportPDFRankList({ category, gender, list, clubs: obj.clubs, logo: obj.logo, name: obj.name, week, year, date });
      });
   }

   function exportPDFRankList({ category, gender, list, clubs, logo, name, week, year, date }) {
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
            { text: `${lang.tr('rl')} ${category} ${gender} ${year} week: ${week}`, style: 'centerText', },
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
      // exportFx.savePDF(docDefinition, filename);
      exportFx.openPDF(docDefinition, filename);
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

   rank.getWeek = (date, dowOffset=2) => {
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
      let year_end = new Date(`${parseInt(year) + 1}-01-01`);
      var ageDifMs = year_end - new Date(birthday).getTime();
      var ageDate = new Date(ageDifMs);
      return Math.abs(ageDate.getUTCFullYear() - 1970);
   }

   rank.eligibleCategories = ({birthday, birth_year, calc_date, calc_year}) => {
      if (birthday && util.validDate(birthday)) birth_year = new Date(birthday).getFullYear();
      if (calc_date && util.validDate(calc_date)) calc_year = new Date(calc_date).getFullYear();
      if (!birth_year || birth_year.toString().length != 4) return { categories: [] };
      if (!calc_year) calc_year = new Date().getFullYear();
      if (!calc_date) calc_date = new Date(calc_year, 1, 1);
      let age = yearEndAge(calc_year, new Date(birth_year, 1, 1).getTime());
      let eligibility = config.eligibleCategories({age, calc_date});
      Object.assign(eligibility, { age });
      return eligibility;
   };

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
               fx(params).then(delayNext, err => handleError(err, params));
            }
         }

         function handleError(err, params) { 
            if (!dev.per) dev.perr = [];
            dev.perr.push(params);
            console.log('params:', params);
            delayNext();
         }
         function delayNext(result) { 
            if (bulkResults && result) results.push(result);
            nextItem();
         }
      });
   }

   /*
   rank.calcTournamentPoints = (tournament, callback) => {
      db.findTournamentMatches(tournament.tuid).then(processMatches, util.logError);
      function processMatches(matches) {
         players = tournament.players || tournaments.matchPlayers(matches);
         var tournament_date = tournament && (tournament.points_date || tournament.end);
         var points_date = tournament_date ? new Date(tournament_date) : new Date();

         checkAllPlayerPUIDs(tournament.players).then(proceed, util.logError);

         function proceed() {
            var puid_fix = Object.assign({}, ...tournament.players.map(p=>({[p.id]: p.puid})));

            // remove any calculated points or rankings
            matches.forEach(match => match.players.forEach(scrubPlayer));

            var points_table = config.pointsTable({ calc_date: points_date });

            var match_data = { matches: matches, points_table, points_date };
            var points = rank.calcMatchesPoints(match_data);
            savePoints({ tournament, points, finishFx: callback });

            function scrubPlayer(p) {
               p.puid = puid_fix[p.id];
               return playerFx.cleanPlayer(p);
            }
         }

         function checkAllPlayerPUIDs(players) {
            return new Promise((resolve, reject) => Promise.all(players.map(checkPlayerPUID)).then(resolve, util.logError));
         }

         function checkPlayerPUID(plyr) {
            return new Promise((resolve, reject) => {
               db.findPlayerById(plyr.id).then(checkPlayer, ()=>resolve(plyr));
               function checkPlayer(p) {
                  if (p) plyr.puid = p.puid;
                  resolve(plyr);
               }
            });
         }

         // copied from tournaments object
         function savePoints({ tournament, points, gender, finishFx }) {
            db.deleteTournamentPoints(tournament.tuid, gender).then(saveAll, (err) => console.log(err));

            function saveAll() {
               let finish = (result) => { if (typeof finishFx == 'function') finishFx(result); }
               let singles_points = Object.keys(points.singles).map(player => points.singles[player]);
               let doubles_points = Object.keys(points.doubles).map(player => points.doubles[player]);
               let all_points = [].concat(...singles_points, ...doubles_points);

               // total points adds all points for all players
               let total_points = all_points.length ? all_points.map(p => p.points).reduce((a, b) => +a + (+b || 0)) : 0;

               // if anyone earned points, save point_events then finishFx (if any)
               if (total_points) {
                  Promise.all(all_points.map(checkPlayerPUID)).then(addAllPoints, util.logError);

                  function addAllPoints(ap) {
                     let addPointEvents = (point_events) => util.performTask(db.addPointEvent, point_events, false);
                     let valid_points = all_points.filter(p => p.points != undefined && p.puid);
                     addPointEvents(valid_points).then(finish);
                  }

               } else {
                  finish();
               }
            }
         }
      }
   }
   */


   return rank;
}();
