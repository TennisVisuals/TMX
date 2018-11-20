import { env } from './env';
import { util } from './util';
import { dd } from './dropdown';
import { dateFx } from './dateFx';
import { staging } from './staging';
import { lang } from './translator';
import { rankCalc } from './rankCalc';
import { stringFx } from './stringFx';
import { drawFx as dfx } from './drawFx';
import { tournamentDisplay } from './tournamentDisplay';

export const legacyProcess = function() {

   let fx = {};

   fx.groupMatches = groupMatches;
   function groupMatches(matches) {
      let groups = {};
      if (!matches) return groups;

      groups.ms = matches.filter(match => match.format == 'singles' && match.gender == 'M' && match.consolation == false);
      groups.msq = groups.ms.filter(match => match.round_name && match.round_name.indexOf('Q') == 0 && match.round_name.indexOf('QF') != 0);
      groups.msm = groups.ms.filter(match => match.round_name && match.round_name.indexOf('RR') < 0 && (match.round_name.indexOf('QF') == 0 || match.round_name.indexOf('Q') < 0));
      groups.msrr = groups.ms.filter(match => match.round_name && match.round_name.indexOf('RR') == 0);

      groups.md = matches.filter(match => match.format == 'doubles' && match.gender == 'M' && match.consolation == false);

      groups.ws = matches.filter(match => match.format == 'singles' && match.gender == 'W' && match.consolation == false);
      groups.wsq = groups.ws.filter(match => match.round_name && match.round_name.indexOf('Q') == 0 && match.round_name.indexOf('QF') != 0);
      groups.wsm = groups.ws.filter(match => match.round_name && match.round_name.indexOf('RR') < 0 && (match.round_name.indexOf('QF') == 0 || match.round_name.indexOf('Q') < 0));
      groups.wsrr = groups.ws.filter(match => match.round_name && match.round_name.indexOf('RR') == 0);

      groups.wd = matches.filter(match => match.format == 'doubles' && match.gender == 'W' && match.consolation == false);

      let group_draws = [];
      if (groups.msm.length) group_draws.push( {key: `${lang.tr('genders.male')} ${lang.tr('formats.singles')}`, value: 'msm'} );
      if (groups.wsm.length) group_draws.push( {key: `${lang.tr('genders.female')} ${lang.tr('formats.singles')}`, value: 'wsm'} );
      if (groups.md.length) group_draws.push( {key: `${lang.tr('genders.male')} ${lang.tr('formats.doubles')}`, value: 'md'} );
      if (groups.wd.length) group_draws.push( {key: `${lang.tr('genders.female')} ${lang.tr('formats.doubles')}`, value: 'wd'} );
      if (groups.msq.length) group_draws.push( {key: `${lang.tr('genders.male')} ${lang.tr('draws.qualification')}`, value: 'msq'} );
      if (groups.wsq.length) group_draws.push( {key: `${lang.tr('genders.female')} ${lang.tr('draws.qualification')}`, value: 'wsq'} );
      if (groups.msrr.length) group_draws.push( {key: `${lang.tr('genders.male')} ${lang.tr('draws.roundrobin')}`, value: 'msrr'} );
      if (groups.wsrr.length) group_draws.push( {key: `${lang.tr('genders.female')} ${lang.tr('draws.roundrobin')}`, value: 'wsrr'} );

      // if there are no main draw matches then RR matches were main draw...
      if (groups.wsrr.length && !groups.wsm.length) { groups.wsrr.forEach(match => match.round_name = match.round_name.replace('Q', '')); }
      if (groups.msrr.length && !groups.msm.length) { groups.msrr.forEach(match => match.round_name = match.round_name.replace('Q', '')); }

      return { groups, group_draws };
   }

   fx.tournamentGenders = tournamentGenders;
   function tournamentGenders(tournament, dbmatches, filterFx=()=>true) {
      let match_genders = !dbmatches ? [] : dbmatches
         .map(match => {
            match.gender = match.gender || rankCalc.determineGender(match);
            return match.gender;
         })
         .filter(f=>f)
         .filter((item, i, s) => s.lastIndexOf(item) == i);
      let player_genders = !tournament.players ? [] : tournament.players
         .filter(filterFx)
         .map(player => player.sex)
         .filter(f=>f)
         .filter((item, i, s) => s.lastIndexOf(item) == i);

      let genders = util.unique([].concat(...match_genders, ...player_genders));
      tournament.genders = genders;
      return genders;
   }

   // used exclusively when draws are generated from existing matches
   fx.generateDrawTree = generateDrawTree;
   function generateDrawTree(rows, draw_type) {
      if (!rows.length) return;

      // TODO: dbmatches and therefore match_groups is not updated when events deleted...
      // console.log(rows, draw_type);

      // exclude pre-round matches
      rows = rows.filter(f=>!f.preround);
      let tree = dfx.recreateDrawFromMatches(rows, draw_type);

      // TODO: generate separate draw for pre-round matches?

      return tree;
   }

   // used exclusively when draws are generated from existing matches
   fx.generateDrawBrackets = generateDrawBrackets;
   function generateDrawBrackets(matches) {
      var brackets = dfx.findBrackets(matches);

      brackets.forEach(bracket => {
         let draw_positions = bracket.players.map(p => p.draw_position);
         let missing = util.missingNumbers(draw_positions, false);

         if (missing.length) {
            // insert empty players in unfilled draw_positions
            // start at the end of the missing array and splice
            missing.reverse().forEach(m => bracket.players.splice(m - 1, 0, {}));
         }
      });

      // Sort Brackets by SEED of 1st draw position
      brackets.sort((a, b) => (a.players ? a.players[0].seed || 0 : 0) - (b.players ? b.players[0].seed || 0 : 0));
      return brackets;
   }

   // LEGACY... from parsed matches...
   // takes a list of matches creates a list of players and events they played/are playing
   fx.matchPlayers = matchPlayers;
   function matchPlayers(matches) {
      if (!matches) return [];
      addMatchDraw(matches);

      let players = [].concat(...matches.map(match => {
         let gender = rankCalc.determineGender(match);
         // add player sex if doesn't exist already
         match.players.forEach(player => player.sex = player.sex || gender);
         return match.players;
      }));

      // make a list of all events in which a player is participating
      let player_events = {};
      matches.forEach(match => {
         match.puids.forEach(puid => { 
            if (!player_events[puid]) player_events[puid] = []; 
            let format = match.format == 'doubles' ? 'd' : 's';
            player_events[puid].push(`${format}_${match.draw || 'M'}`);
         });
      });

      let hashes = [];
      let uplayers = players
         .map(player => {
            let hash = `${player.hash}${player.puid}`;
            if (hashes.indexOf(hash) < 0) {
               hashes.push(hash);
               return player;
            }
         })
         .filter(f=>f)
         .sort((a, b) => {
            let a1 = stringFx.replaceDiacritics(a.full_name);
            let b1 = stringFx.replaceDiacritics(b.full_name);
            return a1 < b1 ? -1 : a1 > b1 ? 1 : 0;
         });

      uplayers.forEach(player => {
         // add player events to player objects
         if (player_events[player.puid]) player.events = util.unique(player_events[player.puid]).join(', ');
      });

      return uplayers;

      function addMatchDraw(matches) {
         // TODO: .round needs to be replaced with .round_name
         matches.forEach(match => { 
            if (!match.gender) match.gender = rankCalc.determineGender(match); 
            if (match.consolation) match.draw = 'C';
            if (match.round && match.round.indexOf('Q') == 0 && match.round.indexOf('QF') < 0) match.draw = 'Q';

            // TODO: RR is not always Q... if there is only one bracket...
            if (match.round && match.round.indexOf('RR') == 0) match.draw = 'Q';
         });
      }

   }

   // TODO: move to legacyProcessing
   function getTournamentOptions(tournament) {
      var category = staging.legacyCategory(tournament.category);

      var opts = tournament.rank_opts || { category, sgl_rank: tournament.rank, dbl_rank: tournament.rank };

      if (tournament.accepted) {
         if (tournament.accepted.M) {
            opts.category = staging.legacyCategory(tournament.accepted.M.category);
            opts.sgl_rank = tournament.accepted.M.sgl_rank;
            opts.dbl_rank = tournament.accepted.M.dbl_rank;
            opts.M = tournament.accepted.M;
         }
         if (tournament.accepted.W) {
            opts.w_category = staging.legacyCategory(tournament.accepted.W.category);
            opts.w_sgl_rank = tournament.accepted.W.sgl_rank;
            opts.w_dbl_rank = tournament.accepted.W.dbl_rank;
            opts.W = tournament.accepted.W;
         }
      }

      return opts;
   }

   // But perhaps this is unnecessary if tournaments are converted to events...
   fx.legacyTournament = (tournament, container) => {
      configureDDLBs(tournament, container);
      configureDateSelectors(tournament, container);

      function configureDDLBs(tournament, container) {
         let cpp = () => tournamentDisplay.calcPlayerPoints({ tournament, container });
         container.category.ddlb = new dd.DropDown({ element: container.category.element, onChange: cpp });
         container.dbl_rank.ddlb = new dd.DropDown({ element: container.dbl_rank.element, onChange: cpp });
         container.sgl_rank.ddlb = new dd.DropDown({ element: container.sgl_rank.element, onChange: cpp });

         if (tournament.genders.length > 1 || tournament.genders.indexOf('W') >= 0) {
            container.w_category.ddlb = new dd.DropDown({ element: container.w_category.element, onChange: cpp });
            container.w_dbl_rank.ddlb = new dd.DropDown({ element: container.w_dbl_rank.element, onChange: cpp });
            container.w_sgl_rank.ddlb = new dd.DropDown({ element: container.w_sgl_rank.element, onChange: cpp });
         }

         // set ddlb options
         let opts = getTournamentOptions(tournament);
         legacyTournamentOpts(opts, container);
      }

      function configureDateSelectors(tournament, container) {
         let start = new Date(tournament.start);
         let end = new Date(tournament.end);

         function updateStartDate() {
            tournament.start = start.getTime();
            startPicker.setStartRange(new Date(start));
            endPicker.setStartRange(new Date(start));
            endPicker.setMinDate(new Date(start));
         }
         function updateEndDate() {
            tournament.end = end.getTime();
            startPicker.setEndRange(new Date(end));
            startPicker.setMaxDate(new Date(end));
            endPicker.setEndRange(new Date(end));
         }

         let startPicker = new Pikaday({
            field: container.start_date.element,
            i18n: lang.obj('i18n'),
            defaultDate: start,
            setDefaultDate: true,
            firstDay: env.calendar.first_day,
            toString(date) { return dateFx.formatDate(dateFx.timeUTC(date)); },
            onSelect: function() {
               start = this.getDate();
               updateStartDate();
               tournamentDisplay.calcPlayerPoints({ date: this.getDate(), tournament, container });
            }
         });
         env.date_pickers.push(startPicker);

         let endPicker = new Pikaday({
            field: container.end_date.element,
            i18n: lang.obj('i18n'),
            defaultDate: end,
            setDefaultDate: true,
            firstDay: env.calendar.first_day,
            toString(date) { return dateFx.formatDate(dateFx.timeUTC(date)); },
            onSelect: function() {
               end = this.getDate();
               updateEndDate();
               tournamentDisplay.calcPlayerPoints({ date: this.getDate(), tournament, container });
            }
         });
         env.date_pickers.push(endPicker);

         updateStartDate();
         updateEndDate();
      }
   };

   fx.legacyTournamentOpts = legacyTournamentOpts;
   function legacyTournamentOpts(opts = {}, container) {
      let ddlb = util.intersection(Object.keys(container), ['category', 'dbl_rank', 'sgl_rank']).length == 3;
      if (!ddlb) {
         console.log('missing ddlb');
         return opts;
      }

      if (Object.keys(opts).length) {
         container.category.ddlb.setValue(opts.category, 'white');
         container.dbl_rank.ddlb.setValue(opts.dbl_rank, 'white');
         container.sgl_rank.ddlb.setValue(opts.sgl_rank, 'white');

         if (opts.W) {
            if (container.w_category.ddlb && opts.W.category) container.w_category.ddlb.setValue(opts.W.category, 'white');
            if (container.w_category.ddlb && opts.W.sgl_rank) container.w_sgl_rank.ddlb.setValue(opts.W.sgl_rank, 'white');
            if (container.w_category.ddlb && opts.W.dbl_rank) container.w_dbl_rank.ddlb.setValue(opts.W.dbl_rank, 'white');
         }
      } else {
         opts = {
            category: container.category.ddlb.getValue(),
            dbl_rank: container.dbl_rank.ddlb.getValue(),
            sgl_rank: container.sgl_rank.ddlb.getValue()
         };

         // if both genders are present
         if (container.w_category.ddlb) opts['W'] = { category: container.w_category.ddlb.getValue() };
         if (container.w_dbl_rank.ddlb) opts['W'].dbl_rank = container.w_dbl_rank.ddlb.getValue();
         if (container.w_sgl_rank.ddlb) opts['W'].sgl_rank = container.w_sgl_rank.ddlb.getValue();
         if (opts.W) opts.M = { category: opts.category, sgl_rank: opts.sgl_rank, dbl_rank: opts.dbl_rank };
      }
      return opts;
   }

   return fx;

}();

