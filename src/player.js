// TODO: change the name of this function; too often confusted with player objects
// TODO: window resize event resize player ladderChart and ranking chart

let player = function() {

   let fx = {
      actions: {},
      overrides: {},
      action: undefined,
      override: undefined,
      displayFx: undefined,
   };
         
   function catchTab(evt) { if (evt.which == 9) { evt.preventDefault(); } }

   /* points expire after one year */
   let expireDate = (date) => date - (365 * 24 * 60 * 60 * 1000);
   let singles = (pts) => pts.filter(f=>f.format == 'singles');
   let doubles = (pts) => pts.filter(f=>f.format != 'singles');

   // displays the active.player overview rather than the full player profile
   fx.playerAssignment = () => {
      db.findPlayer(searchBox.active.player.puid).then(player => {
         searchBox.active.player = player;
         db.findClub(player.club + '').then(club => { tournaments.setActivePlayer(player, club || {}); });
      });
   }

   fx.displayPlayerProfile = displayPlayerProfile;
   function displayPlayerProfile({ puid, ranking_date=new Date(), fallback }) {
      return new Promise((resolve, reject) => {
         var container;

         db.findPlayer(puid).then(player => {
            searchBox.active.player = player;

            if (player) {

               // club and points are not important
               if (fx.override) { return resolve(fx.override(player)); }

               db.findClub(player.club + '').then(club => {
                  container = gen.playerProfile(fx.displayFx);
                  container.info.element.innerHTML = gen.playerInfo(player, club || {});

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
                        firstDay: config.env().calendar.first_day,
                        onSelect: function() { 
                           ranking_date = this.getDate();
                           displayPoints(player, club, points, ranking_date);
                        },
                     });

                     let ranking_time_series = player.rankings ? processTimeSeries(player.rankings, 'rankings') : undefined;
                     gen.displayPlayerRankChart(container, ranking_time_series);
                     db.findPlayerMatches(puid).then((matches) => displayMatches(matches), console.log);

                     displayPoints(player, club, points, ranking_date);
                  }
               });
            } else {
               if (fallback && fx.action && typeof fx.actions[fx.action] == 'function') {
                  container = gen.playerProfile(fx.displayFx);
                  container.info.element.innerHTML = gen.playerInfo(fallback, {});
                  return resolve(fx.actions[fx.action](container, fallback));
               }
               if (fallback && fx.override) { return resolve(fx.override(fallback)); }
               console.log('player not found. PUID:', puid);
               reject({ error: 'Player Not Found' });
            }
         });

         function displayPoints(player, club, points, ranking_date=new Date()) {
            let cpts = rank.calculateRankingPoints(player, points, ranking_date);
            let birth_year = new Date(player.birth).getFullYear();
            let eligible_categories = rank.eligibleCategories({ birth_year, calc_date: ranking_date }).categories;

            let tabdata = [];
            Object.keys(cpts).forEach(category => {
               if (util.isMember(eligible_categories, category) && cpts[category].length) {
                  let tab = category;
                  let content = gen.playerPoints(cpts[category], lang.tr('rlp') + tab);
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
               let content = gen.playerPoints(p, lang.tr('arp'), expire_date);
               tabdata.push({ tab: lang.tr('arp'), content });
            }

            gen.tabbedPlayerRankings(tabdata, container);

            let dt = (evt) => tournaments.displayTournament({tuid: util.getParent(evt.target, 'point_click').getAttribute('tuid')});
            Array.from(container.rankings.element.querySelectorAll('.point_click')).forEach(elem => elem.addEventListener('click', dt));

         }

         function displayMatches(matches) {
            matches.forEach(match => match.outcome = matchOutcome(match, puid));
            let singles = matches.filter(m => m.format == 'singles');
            let doubles = matches.filter(m => m.format == 'doubles');

            singles.sort((a, b) => (b.date || 0) - a.date);
            doubles.sort((a, b) => (b.date || 0) - a.date);

            gen.tabbedPlayerMatches(puid, singles, doubles, container);

            // attach function to display player profile when clicked
            util.addEventToClass('player_click', player.playerClicked, container.matches.element);

            let tournamentClick = (evt) => tournaments.displayTournament({tuid: evt.target.getAttribute('tuid')});
            util.addEventToClass('tournament_click', tournamentClick, container.matches.element);

            if (singles.length) {
               singles.forEach(match => matchOutcome(match, puid));
               let final_rounds = finalRounds(singles);
               if (final_rounds && final_rounds.length) {
                  let data = {
                     key: '',
                     year: '',
                     values: final_rounds,
                  }
                  let season_events = { 'item': { 'click': d => tournaments.displayTournament({tuid: d.tournament.tuid}) }};
                  let playerSeason = gen.playerSeason(container, data, season_events);
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
         player.displayPlayerProfile({ puid }).then(()=>{}, ()=>{});
      } else {
         // TODO: for doubles clicking on an id can invoke function which fetches
         // all player matches for one of the team puids, then filter by the other puid
         // then gen.showDoublesMatches() to display all matches that team has played...
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
      gen.showEdit(html);
   }

   fx.matchOutcome = matchOutcome;
   function matchOutcome(match, puid) {
      let player_won = null;
      let winning_puids = [];
      let winning_team;
      let losing_team;
      let losing_puids = [];

      // TODO: this is a patch for matches from database
      // .teams needs to be updated to .team_players
      if (!match.team_players) match.team_players = match.teams;

      if (match.winner != undefined) {
         winning_team = match.team_players[match.winner].map(pindex => {
            let player =  match.players[pindex];
            winning_puids.push(player.puid);
            if (player.puid == puid) player_won = true;
            return `${player.full_name}${player.rank ? ' [' + player.rank + ']' : ''}`;
         }).join('; ');

         losing_team = match.team_players[1 - match.winner].map(pindex => {
            let player =  match.players[pindex];
            if (!player) return 'Undefined';
            losing_puids.push(player.puid);
            if (player.puid == puid) player_won = false;
            return `${player.full_name}${player.rank ? ' [' + player.rank + ']' : ''}`;
         }).join('; ');
      }

      return { player_won, winning_team, losing_team, winning_puids, losing_puids };
   }

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

   fx.replacePlayer = (match, old_player, new_player) => {
      match.puids = match.puids.map(puid => (puid != old_player.puid) ? puid : new_player.puid);
      match.players = match.players.map(player => (player.puid != old_player.puid) ? player : fx.cleanPlayer(new_player));
      return match;
   }

   fx.playerProfileLadderPNG = (filename = 'ladder.png') => exp.saveSVGasPNG('.itemCalendar', filename);

   fx.playerProfilePDF = () => {
      let svg = d3.select('.itemCalendar');
      if (!svg.node()) return;

      let svgString = exp.getSVGString(svg.node());

      exp.svgString2DataURL(svgString).then(generate);

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
         exp.savePDF(docDefinition, filename);
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
            category: config.legacyCategory((match.event && match.event.category) || match.tournament.category, true),
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
            let datum = { date: rank.getDateByWeek(week, year), };
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
   fx.medical = (player) => player && player.right_to_play_until ? new Date(player.right_to_play_until) > new Date() : true;

   fx.createNewPlayer = createNewPlayer;
   function createNewPlayer({player_data={}, category, callback, date=new Date()} = {}) {
      let player = {
         first_name: player_data.first_name,
         last_name: player_data.last_name,
         sex: player_data.sex || 'M',
      }

      let points_table = config.pointsTable({calc_date: date});
      let categories = points_table && points_table.categories;
      category = category ? config.legacyCategory(category) : 0;
      let ages = category && categories && categories[category] ? categories[category].ages : { from: 6, to: 100 };
      let year = new Date().getFullYear();
      let min_year = year - parseInt(ages.from);
      let max_year = year - parseInt(ages.to);
      let daterange = { start: `${max_year}-01-01`, end: `${min_year}-12-31` };

      let player_container = gen.createNewPlayer(player);
      player_container.last_name.element.style.background = player.last_name ? 'white' : 'yellow';
      player_container.first_name.element.style.background = player.first_name ? 'white' : 'yellow';
      player_container.ioc.element.style.background = player.ioc ? 'white' : 'yellow';
      player_container.birth.element.style.background = util.validDate(player.birth, daterange) ? 'white' : 'yellow';

      // try to make a reasonable start year
      let start_year = year - max_year < 17 ? max_year : min_year - 10;

      let start_date = new Date(start_year, 11, 31);
      let birthdayPicker = new Pikaday({
         field: player_container.birth.element,
         i18n: lang.obj('i18n'),
         defaultDate: start_date,
         minDate: new Date(max_year, 0, 1),
         maxDate: new Date(min_year, 11, 31),
         firstDay: config.env().calendar.first_day,
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
      player_container.gender.ddlb.selectionBackground();
      if (player.sex) player_container.gender.ddlb.setValue(player.sex);

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
         let valid_date = util.validDate(player.birth, daterange);
         if (!valid_date || !player.first_name || !player.last_name || !player.ioc) return;
         player.full_name = `${player.last_name.toUpperCase()}, ${util.normalizeName(player.first_name, false)}`;
         if (!player.club && player_container.club.element.value) player.club_name = player_container.club.element.value;

         if (typeof callback == 'function') callback(player); 
         gen.closeModal();
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
      player_container.cancel.element.addEventListener('click', () => gen.closeModal());
      player_container.cancel.element.addEventListener('keydown', handleCancelKeyEvent);
      player_container.cancel.element.addEventListener('keyup', (evt) => { if (evt.which == 13) gen.closeModal(); });
      player_container.save.element.addEventListener('click', saveNewPlayer);
      player_container.save.element.addEventListener('keydown', handleSaveKeyDown, false);
      player_container.save.element.addEventListener('keyup', handleSaveKeyUp, false);
   }

   return fx;

}();
