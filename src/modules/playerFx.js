import { db } from './db'
import { util } from './util';
import { dd } from './dropdown';
import { staging } from './staging';
import { matchFx } from './matchFx';
import { lang } from './translator';
import { rankCalc } from './rankCalc';
import { exportFx } from './exportFx';
import { searchBox } from './searchBox';
import { displayGen } from './displayGen';

export const playerFx = function() {

   let fx = {
      actions: {},
      overrides: {},
      action: undefined,
      override: undefined,
      displayFx: undefined,
      displayTournament: () => console.log('display tournament'),
   };

   fx.fx = {
      env: () => { console.log('environment request'); return {}; },
      pointsTable: () => console.log('points table'),
   }

   fx.resetPlayerAction = () => {
      fx.action = undefined;
      fx.notInDB = undefined;
      fx.override = undefined;
      fx.displayFx = undefined;
   }

   function catchTab(evt) { if (evt.which == 9) { evt.preventDefault(); } }

   /* points expire after one year */
   let expireDate = (date) => date - (365 * 24 * 60 * 60 * 1000);
   let singles = (pts) => pts.filter(f=>f.format == 'singles');
   let doubles = (pts) => pts.filter(f=>f.format != 'singles');

   // displays the active.player overview rather than the full player profile
   fx.playerAssignment = () => {
      db.findPlayer(searchBox.active.player.puid).then(player => {
         searchBox.active.player = player;
         db.findClub(player.club + '').then(club => { setActivePlayer(player, club || {}); });
      });
   }

   fx.clearEntry = (teams = []) => teams.forEach(team => team.forEach(player => player.entry = undefined));

   function setActivePlayer(player, club) {
      displayGen.activePlayer(player, club);
      Array.from(displayGen.identify_container.action_message.element.querySelectorAll('button.dismiss'))
         .forEach(elem => elem.addEventListener('click', displayGen.clearActivePlayer));
   }

   fx.eligibleForCategory = ({ calc_date, category, player }) => {
      if (!calc_date) return false;
      if (!category) return true;
      let points_table = fx.fx.pointsTable({calc_date});
      let categories = points_table && points_table.categories;
      if (!categories) return true;
      if (!categories[category]) return false;
      let ages = categories[category].ages;
      let ratings = categories[category].ratings;
      if (!ages && !ratings) return true;

      if (ages) {
         let year = calc_date.getFullYear();
         let min_year = year - parseInt(ages.from);
         let max_year = year - parseInt(ages.to);
         let birth_year = new Date(player.birth).getFullYear();
         if (birth_year <= min_year && birth_year >= max_year) return true;
      } else if (ratings) {
         return true;
      }
      return false;
   }

   fx.displayPlayerProfile = displayPlayerProfile;
   function displayPlayerProfile({ puid, ranking_date=new Date(), fallback }) {
      return new Promise((resolve, reject) => {
         var container;

         db.findPlayer(puid).then(player => {
            searchBox.active.player = player;

            if (player) {
               // club and points are not important
               if (fx.override) { return resolve(fx.override({ player })); }

               db.findClub(player.club + '').then(club => {
                  container = displayGen.playerProfile(fx.displayFx);
                  container.info.element.innerHTML = displayGen.playerInfo(player, club || {});

                  if (club && club.code) player.club_code = club.code;
                  if (fx.action && typeof fx.actions[fx.action] == 'function') return resolve(fx.actions[fx.action](container, player));

                  // otherwise default to displaying player points
                  db.findPlayerPoints(puid).then(preparePoints, err => console.log(err));

                  function preparePoints(points) {
                     var rankingDate = new Pikaday({
                        field: container.rankingsdate.element,
                        defaultDate: ranking_date,
                        setDefaultDate: true,
                        i18n: lang.obj('i18n'),
                        firstDay: fx.fx.env().calendar.first_day,
                        onSelect: function() { 
                           ranking_date = this.getDate();
                           displayPoints(player, club, points, ranking_date);
                        },
                     });

                     let ranking_time_series = player.rankings ? processTimeSeries(player.rankings, 'rankings') : undefined;
                     displayGen.displayPlayerRankChart(container, ranking_time_series);
                     db.findPlayerMatches(puid).then((matches) => displayMatches(matches), console.log);

                     displayPoints(player, club, points, ranking_date);
                  }
               });
            } else {
               if (fallback && fx.action && typeof fx.actions[fx.action] == 'function') {
                  container = displayGen.playerProfile(fx.displayFx);
                  container.info.element.innerHTML = displayGen.playerInfo(fallback, {});
                  return resolve(fx.actions[fx.action](container, fallback));
               }
               if (fx.override && fallback) { return resolve(fx.override({ player: fallback })); }
               if (fx.override && fx.notInDB) { return resolve(fx.override({ puid, notInDB: true })); }
               console.log('player not found. PUID:', puid);
               reject({ error: 'Player Not Found' });
            }
         });

         function displayPoints(player, club, points, ranking_date=new Date()) {
            let cpts = rankCalc.calculateRankingPoints(player, points, ranking_date);
            let birth_year = new Date(player.birth).getFullYear();
            let eligible_categories = rankCalc.eligibleCategories({ birth_year, calc_date: ranking_date }).categories;

            let tabdata = [];
            Object.keys(cpts).forEach(category => {
               if (util.isMember(eligible_categories, category) && cpts[category].length) {
                  let tab = category;
                  let content = displayGen.playerPoints(cpts[category], lang.tr('rlp') + tab);
                  tabdata.push({ tab, content });
               }
            });

            let expire_date = expireDate(Date.now());
            let expired = points.filter(p=>new Date(p.date).getTime() <= expire_date)
            let valid = points.filter(p=>new Date(p.date).getTime() > expire_date)
            let lifoDate = (pts) => pts.sort((a, b) => (b.date || 0) - a.date);
            let orderPoints = (pts) => [].concat(...lifoDate(singles(pts)), ...lifoDate(doubles(pts)));

            let p = [].concat(...orderPoints(valid), ...orderPoints(expired));
            if (p.length) {
               let content = displayGen.playerPoints(p, lang.tr('arp'), expire_date);
               tabdata.push({ tab: lang.tr('arp'), content });
            }

            displayGen.tabbedPlayerRankings(tabdata, container);

            let dt = (evt) => fx.displayTournament({tuid: util.getParent(evt.target, 'point_click').getAttribute('tuid')});
            Array.from(container.rankings.element.querySelectorAll('.point_click')).forEach(elem => elem.addEventListener('click', dt));

         }

         function displayMatches(matches) {
            matches.forEach(match => match.outcome = matchFx.matchOutcome(match, puid));
            let singles = matches.filter(m => m.format == 'singles');
            let doubles = matches.filter(m => m.format == 'doubles');

            singles.sort((a, b) => (b.date || 0) - a.date);
            doubles.sort((a, b) => (b.date || 0) - a.date);

            displayGen.tabbedPlayerMatches(puid, singles, doubles, container);

            // attach function to display player profile when clicked
            util.addEventToClass('player_click', fx.playerClicked, container.matches.element);

            let tournamentClick = (evt) => fx.displayTournament({tuid: evt.target.getAttribute('tuid')});
            util.addEventToClass('tournament_click', tournamentClick, container.matches.element);

            if (singles.length) {
               singles.forEach(match => matchFx.matchOutcome(match, puid));
               let final_rounds = finalRounds(singles);
               if (final_rounds && final_rounds.length) {
                  let data = {
                     key: '',
                     year: '',
                     values: final_rounds,
                  }
                  let season_events = { 'item': { 'click': d => fx.displayTournament({tuid: d.tournament.tuid}) }};
                  let playerSeason = displayGen.playerSeason(container, data, season_events);
               }
            }
         }
      });
   }

   fx.playerClicked = (evt) => {
      let elem = util.getParent(evt.target, 'player_click');
      let puid = elem.getAttribute('puid');
      let puid2 = elem.getAttribute('puid2');
      if (!puid2) {
         fx.displayPlayerProfile({ puid }).then(()=>{}, ()=>{});
      } else {
         // TODO: for doubles clicking on an id can invoke function which fetches
         // all player matches for one of the team puids, then filter by the other puid
         // then displayGen.showDoublesMatches() to display all matches that team has played...
         console.log('doubles match');
      }
   }

   // TEMPORARY
   function showMatch(elem, what = 'match') {

      let e = d3.select(elem);
      let muid = e.attr('muid');
      let tuid = e.attr('tuid');
      let html = `
         <h2>${what}</h2>
         <p style='text-align: left'><b>MUID:</b> ${muid}</p>
         <p style='text-align: left'><b>TUID:</b> ${tuid}</p>
      `;
      displayGen.showEdit(html);
   }

   // TODO: NOT USED??
   fx.scheduledMatchDetails = scheduledMatchDetails;
   function scheduledMatchDetails(match) {
      let genders = [];
      let teams = match.teams.map(team => {
         if (!team) console.log(match);
         return team.map(player => {
            genders.push(player.sex);
            return `${player.full_name}${player.rank ? ' [' + player.rank + ']' : ''}`;
         }).join('; ');
      });
      let team_puids = match.teams.map(team => team.map(player => player.puid));
      genders = util.unique(genders);

      return { teams, team_puids, genders };
   }

   // cleanPlayer removes all calculated Points and calculated Rankings
   fx.cleanPlayer = (player) => Object.assign({}, ...Object.keys(player).filter(key => ['points', 'rankings'].indexOf(key) < 0).map(key => { return { [key]: player[key] }}));

   fx.dualCopy = (d) => {
      if (!d) return {};
      let dual = {
         abbr: d.abbr,
         name: d.name,
         coach: d.coach,
         ioc: d.ioc,
         id: d.id,
         players: Object.assign({}, ...Object.keys(d.players).map(k=>d.players[k]))
      };
      return dual;
   }

   fx.findDualTeam = (id) => {
   }

   fx.playerCopy = (p) => {
      if (!p) return {};
      let player = {
         id: p.id,
         sex: p.sex,
         ioc: p.ioc,
         int: p.int,
         puid: p.puid,
         seed: p.seed,
         rank: p.rank,
         ratings: p.ratings,
         rankings: p.rankings,
         club_code: p.club_code,
         full_name: p.full_name,
         last_name: p.last_name,
         first_name: p.first_name,
         draw_position: p.draw_position,
         category_dbls: p.category_dbls,
         category_ranking: p.category_ranking,
         modified_ranking: p.modified_ranking,
      }
      return player;
   }

   fx.replacePlayer = (match, old_player, new_player) => {
      match.puids = match.puids.map(puid => (puid != old_player.puid) ? puid : new_player.puid);
      match.players = match.players.map(player => (player.puid != old_player.puid) ? player : fx.cleanPlayer(new_player));
      return match;
   }

   fx.playerProfileLadderPNG = (filename = 'ladder.png') => exportFx.saveSVGasPNG({ selector: '.itemCalendar', filename });

   // TODO: not used?
   // perhaps an example to extract ladder adn export as pdf?
   fx.playerProfilePDF = () => {
      let svg = d3.select('.itemCalendar');
      if (!svg.node()) return;

      let svgString = exportFx.getSVGString(svg.node());

      exportFx.svgString2DataURL({ svg_string }).then(generate);

      function generate(image) {

         var docDefinition = {
            pageSize: 'A4',
            pageOrientation: 'landscape',

            content: [
               {
                  image,
                  width: 700,
                  alignment: 'center',
               },
            ],

         };

         let filename = `playerProfile.pdf`;
         exportFx.savePDF(docDefinition, filename);
      }
   }

   function finalRounds(matches) {
      let chart_matches = normalizeRounds(matches.filter(m=>!m.consolation));
      let rounds = ['W', 'F', 'SF', 'QF', 'R16', 'R32', 'R64', 'R128'];
      let tournaments = {};
      chart_matches.forEach(match => {
         let tuid = match.tournament.tuid;
         let round = match.outcome.player_won ? rounds[rounds.indexOf(match.round) - 1] : match.round;
         let rung = rounds.indexOf(round) + 1;
         if (!round || rung <= 0) return;
         rung = 8 - rung;
         let value = {
            category: staging.legacyCategory((match.event && match.event.category) || match.tournament.category, true),
            date: new Date(match.date),
            round,
            rung,
            surface: match.event && match.event.surface || "unknown",
            tournament: match.tournament,
         }
         if (!tournaments[tuid] || rung > tournaments[tuid].rung) tournaments[tuid] = value;
      });

      return Object.keys(tournaments).map(key => tournaments[key]);
   }

   function normalizeRounds(matches) {
      let map = { 'R12': 'R16', 'R24': 'R32', 'R48': 'R64', 'R96': 'R128' }
      return matches.map(match => {
         match.round = map[match.round] || match.round;
         return match;
      });
   }

   function processTimeSeries(obj, type='points') {
      let i = 0;
      let data = [];
      let columns = ['date'];
      Object.keys(obj).forEach(year => { 
         Object.keys(obj[year]).forEach(week => {
            let datum = { date: rankCalc.getDateByWeek(week, year), };
            Object.keys(obj[year][week]).forEach(key => { if (columns.indexOf(key) < 0) columns.push(key); });
            if (type == 'points') {
               Object.keys(obj[year][week]).forEach(key => datum[key] = obj[year][week][key].total);
            } else {
               Object.keys(obj[year][week]).forEach(key => datum[key] = obj[year][week][key]);
            }
            data.push(datum);
         }); 
      });
      data.columns = columns;
      return data;
   }

   fx.registration = (player) => player && player.registered_until ? new Date(player.registered_until) > new Date() : true;
   fx.medical = (player, tournament) => {
      var validity_date = tournament && tournament.start ? new Date(tournament.start) : new Date();
      var medical_until = player && player.right_to_play_until ? new Date(player.right_to_play_until) : validity_date;
      return medical_until >= validity_date;
   }

   fx.createNewPlayer = createNewPlayer;
   function createNewPlayer({player_data={}, category, callback, date=new Date()} = {}) {
      let player = {
         first_name: player_data.first_name,
         last_name: player_data.last_name,
         sex: player_data.sex || 'M',
      }

      let points_table = fx.fx.pointsTable({calc_date: date});
      let categories = points_table && points_table.categories;
      category = category ? staging.legacyCategory(category) : 0;
      let ages = category && categories && categories[category] && categories[category].ages ? categories[category].ages : { from: 6, to: 100 };
      let year = new Date().getFullYear();
      let min_year = year - ((ages && parseInt(ages.from)) || 0);
      let max_year = year - ((ages && parseInt(ages.to)) || 0);
      let daterange = { start: `${max_year}-01-01`, end: `${min_year}-12-31` };

      let player_container = displayGen.createNewPlayer(player);
      player_container.last_name.element.style.background = player.last_name ? 'white' : 'yellow';
      player_container.first_name.element.style.background = player.first_name ? 'white' : 'yellow';
      player_container.ioc.element.style.background = player.ioc ? 'white' : 'yellow';
      player_container.birth.element.style.background = !ages || util.validDate(player.birth, daterange) ? 'white' : 'yellow';

      // try to make a reasonable start year
      let start_year = year - max_year < 17 ? max_year : min_year - 10;

      let start_date = new Date(start_year, 11, 31);
      let birthdayPicker = new Pikaday({
         field: player_container.birth.element,
         i18n: lang.obj('i18n'),
         defaultDate: start_date,
         minDate: new Date(max_year, 0, 1),
         maxDate: new Date(min_year, 11, 31),
         firstDay: fx.fx.env().calendar.first_day,
         onSelect: function() { validateBirth(player_container.birth.element); },
      });
      let field_order = [ 'last_name', 'first_name', 'birth', 'ioc', 'city', 'club', 'phone', 'email', 'cancel', 'save' ];

      player_container.last_name.element.focus();
      let nextFieldFocus = (field) => {
         let next_field = field_order.indexOf(field) + 1;
         if (next_field == field_order.length) next_field = 0;
         player_container[field_order[next_field]].element.focus(); 
      }
      let setGender = (value) => player.sex = value;
      player_container.gender.ddlb = new dd.DropDown({ element: player_container.gender.element, onChange: setGender });
      player_container.gender.ddlb.selectionBackground('white');
      if (player.sex) player_container.gender.ddlb.setValue(player.sex, 'white');

      // IOC Awesomplete
      d3.json('./assets/ioc_codes.json', data => {
         let list = data.map(d => ({ label: d.name, value: d.ioc }));
         player_container.ioc.typeAhead = new Awesomplete(player_container.ioc.element, { list });

         let selection_flag = false;
         let selectComplete = (c) => { 
            selection_flag = true; 
            player.ioc = c.text.value; 
            player_container.ioc.element.value = c.text.label;
            player_container.ioc.element.style.background = player.ioc ? 'white' : 'yellow';
         }
         player_container.ioc.element.addEventListener("awesomplete-selectcomplete", selectComplete, false);
         player_container.ioc.element.addEventListener('keydown', catchTab , false);
         player_container.ioc.element.addEventListener('keyup', catchTab , false);
         player_container.ioc.element.addEventListener("keyup", function(evt) { 
            // auto select first item on 'Enter' *only* if selectcomplete hasn't been triggered
            if ((evt.which == 13 || evt.which == 9) && !selection_flag) {
               if (player_container.ioc.typeAhead.suggestions && player_container.ioc.typeAhead.suggestions.length) {
                  player_container.ioc.typeAhead.next();
                  player_container.ioc.typeAhead.select(0);
               } else {
                  player_container.ioc.element.value = '';
                  player_container.ioc.element.style.background = 'yellow';
               }
               nextFieldFocus(evt.shiftKey ? 'first_name' : 'ioc');
            }
            selection_flag = false;
         });
      });

      // Club Awesomplete
      db.findAllClubs().then(clubs => {
         let list = clubs.map(club => ({ label: club.name, value: club }));
         player_container.club.typeAhead = new Awesomplete(player_container.club.element, { list });

         let selection_flag = false;
         let selectComplete = (c) => { 
            selection_flag = true; 
            player.club = c.text.value.id; 
            player.club_code = c.text.value.code; 
            player_container.club.element.value = c.text.label;
         }
         player_container.club.element.addEventListener("awesomplete-selectcomplete", selectComplete, false);
         player_container.club.element.addEventListener('keydown', catchTab , false);
         player_container.club.element.addEventListener('keyup', catchTab , false);
         player_container.club.element.addEventListener("keyup", function(evt) { 
            // auto select first item on 'Enter' *only* if selectcomplete hasn't been triggered
            if ((evt.which == 13 || evt.which == 9) && !selection_flag) {
               if (player_container.club.typeAhead.suggestions && player_container.club.typeAhead.suggestions.length) {
                  player_container.club.typeAhead.next();
                  player_container.club.typeAhead.select(0);
               } else {
                  player.club_name = player_container.club.element.value;
               }
               nextFieldFocus(evt.shiftKey ? 'ioc' : 'club');
            }
            selection_flag = false;
         });
      });

      let defineAttr = (attr, evt, required, elem) => {
         player[attr] = elem ? elem.value : evt? evt.target.value : undefined;
         if (required) player_container[attr].element.style.background = player[attr] ? 'white' : 'yellow';
         if ((!evt || evt.which == 13 || evt.which == 9) && (!required || (required && player[attr]))) return nextFieldFocus(attr);
      }

      let saveNewPlayer = () => { 
         let valid_date = !ages || util.validDate(player.birth, daterange);
         if (!valid_date || !player.first_name || !player.last_name || !player.ioc) return;
         player.full_name = `${player.last_name.toUpperCase()}, ${util.normalizeName(player.first_name, false)}`;
         if (!player.club && player_container.club.element.value) player.club_name = player_container.club.element.value;

         if (typeof callback == 'function') callback(player); 
         displayGen.closeModal();
      }

      let handleSaveKeyDown = (evt) => {
         evt.preventDefault();
         if (evt.which == 9) nextFieldFocus(evt.shiftKey ? 'email' : 'save'); 
      }

      let handleSaveKeyUp = (evt) => {
         catchTab(evt); 
         if (evt.which == 13) saveNewPlayer();
      }

      let handleCancelKeyEvent = (evt) => {
         evt.preventDefault()
         if (evt.which == 9) nextFieldFocus(evt.shiftKey ? 'phone' : 'cancel');
      }

      function birthKeyUp(evt) { validateBirth(evt.target, evt); }

      function validateBirth(elem, evt) {
         let datestring = elem.value;
         let valid_date = util.validDate(datestring, daterange);
         elem.style.background = valid_date ? 'white' : 'yellow';
         if (valid_date) return defineAttr('birth', evt, true, elem);
      }

      player_container.last_name.element.addEventListener('keydown', (evt) => { if (evt.shiftKey && evt.which == 9) nextFieldFocus('email'); });
      player_container.last_name.element.addEventListener('keyup', (evt) => defineAttr('last_name', evt, true));
      player_container.first_name.element.addEventListener('keyup', (evt) => defineAttr('first_name', evt, true));
      player_container.city.element.addEventListener('keydown', catchTab);
      player_container.city.element.addEventListener('keyup', (evt) => defineAttr('city', evt));
      player_container.birth.element.addEventListener('keyup', birthKeyUp);
      player_container.phone.element.addEventListener('keyup', (evt) => defineAttr('phone', evt));
      player_container.email.element.addEventListener('keyup', (evt) => defineAttr('email', evt));
      player_container.cancel.element.addEventListener('click', () => displayGen.closeModal());
      player_container.cancel.element.addEventListener('keydown', handleCancelKeyEvent);
      player_container.cancel.element.addEventListener('keyup', (evt) => { if (evt.which == 13) displayGen.closeModal(); });
      player_container.save.element.addEventListener('click', saveNewPlayer);
      player_container.save.element.addEventListener('keydown', handleSaveKeyDown, false);
      player_container.save.element.addEventListener('keyup', handleSaveKeyUp, false);
   }

   fx.editPlayer = editPlayer;
   function editPlayer({player_data={}, category, callback, date=new Date()} = {}) {
      let allowed = fx.fx.env().editing.players;
      let player = {
         first_name: player_data.first_name,
         last_name: player_data.last_name,
         birth: player_data.birth,
         ioc: player_data.ioc,
         sex: player_data.sex || 'M'
      }

      let points_table = fx.fx.pointsTable({calc_date: date});
      let categories = points_table && points_table.categories;
      category = category ? staging.legacyCategory(category) : 0;
      let ages = category && categories && categories[category] && categories[category].ages ? categories[category].ages : { from: 6, to: 100 };
      let year = new Date().getFullYear();
      let min_year = year - ((ages && parseInt(ages.from)) || 0);
      let max_year = year - ((ages && parseInt(ages.to)) || 0);
      let daterange = { start: `${max_year}-01-01`, end: `${min_year}-12-31` };

      let player_container = displayGen.editPlayer(player, allowed);
      player_container.last_name.element.style.background = player.last_name ? 'white' : 'yellow';
      player_container.first_name.element.style.background = player.first_name ? 'white' : 'yellow';
      player_container.ioc.element.style.background = player.ioc ? 'white' : 'yellow';
      player_container.birth.element.style.background = player.birth ? 'white' : 'yellow';

      // try to make a reasonable start year
      let start_year = year - max_year < 17 ? max_year : min_year - 10;
      let start_date = player.birth ? new Date(player.birth) : new Date(start_year, 11, 31);

      let birthdayPicker = new Pikaday({
         field: player_container.birth.element,
         i18n: lang.obj('i18n'),
         defaultDate: start_date,
         setDefaultDate: true,
         minDate: new Date(max_year, 0, 1),
         maxDate: new Date(min_year, 11, 31),
         firstDay: fx.fx.env().calendar.first_day,
         onSelect: function() { validateBirth(player_container.birth.element); },
      });
      let field_order = [ 'last_name', 'first_name', 'ioc' ];

      if (allowed.gender) {
         let setGender = (value) => player.sex = value;
         player_container.gender.ddlb = new dd.DropDown({ element: player_container.gender.element, onChange: setGender });
         player_container.gender.ddlb.selectionBackground('white');
         if (player.sex) player_container.gender.ddlb.setValue(player.sex, 'white');
      }

      player_container.last_name.element.focus();
      let nextFieldFocus = (field) => {
         let next_field = field_order.indexOf(field) + 1;
         if (next_field == field_order.length) next_field = 0;
         player_container[field_order[next_field]].element.focus(); 
      }

      // IOC Awesomplete
      d3.json('./assets/ioc_codes.json', data => {
         let list = data.map(d => ({ label: d.name, value: d.ioc }));
         player_container.ioc.typeAhead = new Awesomplete(player_container.ioc.element, { list });
         player_container.ioc.element.value = data.reduce((p, c) => p || (c.ioc == player.ioc ? c.name : ''), undefined) || '';

         let selection_flag = false;
         let selectComplete = (c) => { 
            selection_flag = true; 
            player.ioc = c.text.value; 
            player_container.ioc.element.value = c.text.label;
            player_container.ioc.element.style.background = player.ioc ? 'white' : 'yellow';
         }
         player_container.ioc.element.addEventListener("awesomplete-selectcomplete", selectComplete, false);
         player_container.ioc.element.addEventListener('keydown', catchTab , false);
         player_container.ioc.element.addEventListener('keyup', catchTab , false);
         player_container.ioc.element.addEventListener("keyup", function(evt) { 
            // auto select first item on 'Enter' *only* if selectcomplete hasn't been triggered
            if ((evt.which == 13 || evt.which == 9) && !selection_flag) {
               if (player_container.ioc.typeAhead.suggestions && player_container.ioc.typeAhead.suggestions.length) {
                  player_container.ioc.typeAhead.next();
                  player_container.ioc.typeAhead.select(0);
               } else {
                  player_container.ioc.element.value = '';
                  player_container.ioc.element.style.background = 'yellow';
               }
               nextFieldFocus(evt.shiftKey ? 'first_name' : 'ioc');
            }
            selection_flag = false;
         });
      });

      let defineAttr = (attr, evt, required, elem) => {
         player[attr] = elem ? elem.value : evt? evt.target.value : undefined;
         if (required) player_container[attr].element.style.background = player[attr] ? 'white' : 'yellow';
         if ((!evt || evt.which == 13 || evt.which == 9) && (!required || (required && player[attr]))) return nextFieldFocus(attr);
      }

      let saveEditedPlayer = () => { 
         if (!player.first_name || !player.last_name || !player.ioc) return;
         player.full_name = `${player.last_name.toUpperCase()}, ${util.normalizeName(player.first_name, false)}`;

         if (typeof callback == 'function') callback(player); 
         displayGen.closeModal();
      }

      let handleSaveKeyDown = (evt) => {
         evt.preventDefault();
         if (evt.which == 9) nextFieldFocus(evt.shiftKey ? 'email' : 'save'); 
      }

      let handleSaveKeyUp = (evt) => {
         catchTab(evt); 
         if (evt.which == 13) saveEditedPlayer();
      }

      let handleCancelKeyEvent = (evt) => {
         evt.preventDefault()
         if (evt.which == 9) nextFieldFocus(evt.shiftKey ? 'phone' : 'cancel');
      }

      function birthKeyUp(evt) { validateBirth(evt.target, evt); }

      function validateBirth(elem, evt) {
         let datestring = elem.value;
         let valid_date = util.validDate(datestring, daterange);
         elem.style.background = valid_date ? 'white' : 'yellow';
         if (valid_date) return defineAttr('birth', evt, true, elem);
      }

      player_container.last_name.element.addEventListener('keydown', (evt) => { if (evt.shiftKey && evt.which == 9) nextFieldFocus('email'); });
      player_container.last_name.element.addEventListener('keyup', (evt) => defineAttr('last_name', evt, true));
      player_container.first_name.element.addEventListener('keyup', (evt) => defineAttr('first_name', evt, true));
      player_container.cancel.element.addEventListener('click', () => displayGen.closeModal());
      player_container.cancel.element.addEventListener('keydown', handleCancelKeyEvent);
      player_container.cancel.element.addEventListener('keyup', (evt) => { if (evt.which == 13) displayGen.closeModal(); });
      player_container.birth.element.addEventListener('keyup', birthKeyUp);
      player_container.save.element.addEventListener('click', saveEditedPlayer);
      player_container.save.element.addEventListener('keydown', handleSaveKeyDown, false);
      player_container.save.element.addEventListener('keyup', handleSaveKeyUp, false);
   }

   return fx;

}();
