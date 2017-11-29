// TODO
// *. should be able to RETIRE or INTERRUPT with partial tiebreak score
// 1. editing a score with two complete sets but no winner should activate DDLB on new set
// 2. action buttons (interrupted & etc.) should be inactive when tiebreak boxes are being used

let scoreBoard = function() {

   let fx = {};

   // match format configuration
   let o = {
      max_sets: 3,
      sets_to_win: 2,
      games_for_set: 6,
      tiebreak_to: 7,
      supertiebreak_to: 10,
      auto_score: true,
      final_set_supertiebreak: false,
   }

   fx.options = (values) => {
      if (!values) return o;
      util.keyWalk(values, o);
   }

   fx.setMatchScore = setMatchScore;
   function setMatchScore({ round, container, teams, existing_scores, score_format={}, callback }) {

      let f = Object.assign({}, o, score_format);

      // scoped variables need to be defined before configuration
      let set_number;
      let supertiebreak;
      let ddlb_lock = false;
      let set_scores = existing_scores || [];
      let action_drawer = false;

      let flags = true;
      let sobj = gen.scoreBoard({ container, teams, flags });
      if (round) sobj.round.element.innerHTML = round;
      let scoreboard = d3.select(sobj.scoreboard.element);
      scoreboard.on('click', removeScoreBoard);

      let displayActions = (bool) => {
         let visible = bool ? true : false;
         action_drawer = visible;
         gen.toggleVisible({ elem: sobj.actions.element, type: 'edit', height: 50, visible });
         sobj.scoring.element.style.display = action_drawer ? 'none' : 'inline';
         sobj.edit_scoring.element.style.display = action_drawer ? 'none' : 'inline';
      }

      // disable scrolling on background
      document.body.style.overflow  = 'hidden';

      configureScoreSelectors();
      configureOutcomeSelectors();
      configureTiebreakEntry();
      configureActionButtons();

      // check whether there is a winner from existing score
      // irregular winners are not considered when editing existing score because
      // it is impossible to determine from string score which player retired or defaulted.
      let winner = determineWinner();
      set_number = winner != undefined ? set_scores.length : Math.max(0, set_scores.length - 1);

      if (existing_scores && existing_scores.length) {
         let last_set = set_scores.length ? set_scores[set_scores.length - 1] : undefined;
         if (set_scores.interrupted) {
            sobj.p1action.ddlb.setValue(' ');
            sobj.p2action.ddlb.setValue('interrupted');
            sobj.p1action.ddlb.lock();
            sobj.p2action.ddlb.lock();
            displayActions(true);
            if (scoreGoal(last_set[0].games, last_set[1].games)) {
               set_number += 1;
            }
         }
      }

      // now populate with any existing score
      setScoreDisplay({ selected_set: set_number });

      // SUPPORTING FUNCTIONS
      function removeScoreBoard(outcome) {
         if (outcome) {
            outcome.teams = teams;
            outcome.set_scores = set_scores;
            outcome.score_format = f;
         }
         scoreboard.remove();
         if (typeof callback == 'function') callback(outcome);
         document.body.style.overflow = null;
      }

      function configureActionButtons() {
         sobj.accept.element.addEventListener('click', acceptScores , false);
         sobj.clear.element.addEventListener('click', clearScores , false);
         sobj.scoring.element.addEventListener('click', configureScoring , false);

         function acceptScores() {
            let { score, position, positions, complete, winner } = getScore();

            if (score) {
               if (position) removeScoreBoard({ score, position, positions, complete, winner });
            } else {
               removeScoreBoard();
            }
         }

         function clearScores() {
            set_scores = [];
            set_number = 0;
            resetTiebreak();
            unlockScoreboard();
            sobj.p2action.ddlb.setValue('');
            sobj.p1action.ddlb.setValue('');
            displayActions(false);
            setScoreDisplay({ selected_set: set_number });
         }

         function configureScoring() {
            if (action_drawer) return;
            let visible = sobj.scoring.element.innerHTML == '-' ? true : false;
            sobj.scoring.element.innerHTML = visible ? '&#x25A2;' : '-';
            gen.toggleVisible({ elem: sobj.edit_scoring.element, type: 'edit', height: 50, visible });
         }
      }
      
      function configureScoreSelectors() {
         let options = [ { key: '-', value: '' }, ];
         util.range(0, f.games_for_set + 2).forEach(n => options.push({ key: n, value: n }));

         let scoreChange1 = (value) => scoreChange(0, value);
         let scoreChange2 = (value) => scoreChange(1, value);
         dd.attachDropDown({ id: sobj.p1selector.id, options, border: false });
         dd.attachDropDown({ id: sobj.p2selector.id, options, border: false });
         sobj.p1selector.ddlb = new dd.DropDown({ element: sobj.p1selector.element, onChange: scoreChange1, id: sobj.p1selector.id });
         sobj.p2selector.ddlb = new dd.DropDown({ element: sobj.p2selector.element, onChange: scoreChange2, id: sobj.p2selector.id });
         sobj.p1selector.ddlb.selectionBackground();
         sobj.p2selector.ddlb.selectionBackground();
      }

      function configureOutcomeSelectors() {
         let actions = [
            { key: '-', value: '' },
            { key: 'RET.', value: 'retired' },
            { key: 'W.O.', value: 'walkover' },
            { key: 'DEF.', value: 'defaulted' },
            { key: 'INT.', value: 'interrupted' },
            { key: `<div class='link'><img src='./icons/completed.png' class='club_link'></div>`, value: 'winner' },
         ];
         let outcomeChange1 = (value) => outcomeChange(0, value);
         let outcomeChange2 = (value) => outcomeChange(1, value);
         dd.attachDropDown({ id: sobj.p1action.id, options: actions, border: false });
         dd.attachDropDown({ id: sobj.p2action.id, options: actions, border: false });
         sobj.p1action.ddlb = new dd.DropDown({ element: sobj.p1action.element, onChange: outcomeChange1, id: sobj.p1action.id });
         sobj.p2action.ddlb = new dd.DropDown({ element: sobj.p2action.element, onChange: outcomeChange2, id: sobj.p2action.id });
         sobj.p1action.ddlb.setStyle('selection_value', '#2f2f2f');
         sobj.p2action.ddlb.setStyle('selection_value', '#2f2f2f');
         sobj.p1action.ddlb.setStyle('selection_novalue', '#2f2f2f');
         sobj.p2action.ddlb.setStyle('selection_novalue', '#2f2f2f');
         sobj.p1action.ddlb.selectionBackground();
         sobj.p2action.ddlb.selectionBackground();
      }

      function configureTiebreakEntry() {
         let tiebreakEntry1 = (event) => tiebreakEntry(event, 0);
         let tiebreakEntry2 = (event) => tiebreakEntry(event, 1);
         sobj.p1tiebreak.element.addEventListener('keyup', tiebreakEntry1 , false);
         sobj.p2tiebreak.element.addEventListener('keyup', tiebreakEntry2 , false);
      }

      function tiebreakEntry(event, which) {
         let t1 = +sobj.p1tiebreak.element.value;
         let t2 = +sobj.p2tiebreak.element.value;

         if (event.which == 13) {
            if (t1 != '' || t2 != '') {
               if (supertiebreak) {
                  superTiebreakSet(true);
               } else {
                  normalSetTiebreak(true);
               }
            }
         }

         let value = sobj[which ? 'p2tiebreak' : 'p1tiebreak'].element.value.match(/-?\d+\.?\d*/);

         // don't allow numbers with more than 2 digits
         let numeric = value && !isNaN(value[0]) ? parseInt(value[0].toString().slice(-2)) : undefined;
         let tbgoal = supertiebreak ? f.supertiebreak_to : f.tiebreak_to;
         let complement = numeric == undefined ? '' : numeric + 2 < tbgoal ? tbgoal : numeric + 2;

         sobj[which ? 'p2tiebreak' : 'p1tiebreak'].element.value = numeric != undefined ? numeric : '';

         // if irregularWinner then don't set complement
         if (!irregularWinner()) sobj[which ? 'p1tiebreak' : 'p2tiebreak'].element.value = complement;

         // sobj[which ? 'p1tiebreak' : 'p2tiebreak'].element.value = complement;

         function normalSetTiebreak(submit) {
            let total_sets = set_scores.length;
            let which_set = total_sets > set_number ? total_sets - 1 : set_number - 1;
            set_scores[which_set][0][t1 < t2 ? 'tiebreak' : 'spacer'] = t1 < t2 ? t1 : t2;
            set_scores[which_set][1][t2 < t1 ? 'tiebreak' : 'spacer'] = t2 < t1 ? t2 : t1;
            if (submit) finish();
         }

         function superTiebreakSet(submit) {
            if (t1 < f.supertiebreak_to && t2 < f.supertiebreak_to) return;
            let set = [{ supertiebreak: t1 }, { supertiebreak: t2 }];
            let which_set = set_scores.length;

            if (which_set > 1 && set_scores[which_set - 1][0].supertiebreak != undefined) {
               // if the last set was a supertiebreak, replace previous supertiebreak
               set_scores[which_set - 1] = set;
            } else {
               // otherwise add supertiebreak score
               set_scores.push(set);
            }
            if (submit) finish();
         }

         function finish() {
            resetTiebreak();
            if (determineWinner() != undefined) displayActions(true);
            setScoreDisplay({ selected_set: set_number });
         }
      }

      function scoreGoal(s1, s2) {
         let score_diff = Math.abs(s1 - s2);
         // any valid winning score that does not indicate a tiebreak
         return score_diff >= 2 && (s1 >= f.games_for_set || s2 >= f.games_for_set);
      }

      function tbScore(s1, s2) {
         return (s1 == f.games_for_set + 1 && s2 == f.games_for_set) || (s1 == f.games_for_set && s2 == f.games_for_set + 1);
      }

      function scoreChange(which, value) {
         if (interrupted()) resetActions();
         let tiebreak = false;
         resetTiebreak();

         // if a final set score is being modified
         // for instance to change to an interrupted score...
         // only possible to change the final set...
         if (declaredWinner()) {
            set_number = set_scores.length - 1;
            sobj.p1action.ddlb.setValue('');
            sobj.p2action.ddlb.setValue('');
            unlockScoreboard();
         }

         let p1 = sobj.p1selector.ddlb.getValue();
         let p2 = sobj.p2selector.ddlb.getValue();

         if (f.auto_score) {
            if (which == 0 && p2 == '') {
               p2 = getComplement(value);
               sobj.p2selector.ddlb.setValue(p2);
            } else if (which == 1 && p1 == '') {
               p1 = getComplement(value);
               sobj.p1selector.ddlb.setValue(p1);
            } else {
               // if both values are set to f.games_for_set + 1 for normal set,
               // ... one needs to be f.games_for_set
               if (p1 == f.games_for_set + 1 && p2 == f.games_for_set + 1) replaceValue(f.games_for_set);

               // if one value is set to f.games_for_set + 1 for normal set,
               // ... the other needs to be f.games_for_set - 1 or f.games_for_set
               if (p1 == f.games_for_set + 1 && p2 < f.games_for_set - 1) replaceValue(f.games_for_set);
               if (p2 == f.games_for_set + 1 && p1 < f.games_for_set - 1) replaceValue(f.games_for_set);
            }
         }

         set_scores[set_number] = [{ games: p1 }, { games: p2 }];

         if (!scoreGoal(p1, p2) && !tbScore(p1, p2)) {
            set_scores = set_scores.slice(0, set_number + 1);
            determineWinner();
            setScoreDisplay({ selected_set: set_number });
         } else {
            if (tbScore(p1, p2)) tiebreak = true;
            determineWinner();
            nextSet(p1, p2, tiebreak);
         }

         function replaceValue(new_value) {
            if (which) { 
               p1 = new_value;
               sobj.p1selector.ddlb.setValue(p1);
            } else { 
               p2 = new_value;
               sobj.p2selector.ddlb.setValue(p2);
            } 
         }

         function getComplement(value) {
            if (value == '') return;
            if (value == f.games_for_set || value == f.games_for_set + 1) tiebreak = true;
            if (value == f.games_for_set - 1 || value == f.games_for_set) return f.games_for_set + 1;
            return f.games_for_set;
         }
      }

      function nextSet(p1, p2, tiebreak) {
         if (tiebreak) {
            sobj.p1tiebreak.element.style.display='inline';
            sobj.p2tiebreak.element.style.display='inline';
            sobj[p1 > p2 ? 'p1tiebreak' : 'p2tiebreak'].element.disabled = true;
            sobj[p1 > p2 ? 'p2tiebreak' : 'p1tiebreak'].element.disabled = false;
            sobj[p1 > p2 ? 'p2tiebreak' : 'p1tiebreak'].element.focus();
         }
         // check that both values are numeric
         let numbers = (p1 !== '' && p2 !== '');

         // check if there is a winner
         let no_winner = determineWinner() == undefined && irregularWinner() == undefined;

         // only advance to the next set if match and prior set meets all criteria
         if (numbers && no_winner && set_number + 1 < f.max_sets) set_number += 1;

         setScoreDisplay({ selected_set: set_number, tiebreak });
      }

      function declaredWinner() {
         let s1 = sobj.p1action.ddlb.getValue();
         let s2 = sobj.p2action.ddlb.getValue();
         return (s1 == 'winner' || s2 == 'winner') ? true : false;
      }

      function irregularWinner() {
         let s1 = sobj.p1action.ddlb.getValue();
         let s2 = sobj.p2action.ddlb.getValue();

         if (['retired', 'defaulted', 'walkover'].indexOf(s1) >= 0) return 0;
         if (['retired', 'defaulted', 'walkover'].indexOf(s2) >= 0) return 1;
         return undefined;
      }

      function interrupted() {
         let s1 = sobj.p1action.ddlb.getValue();
         let s2 = sobj.p2action.ddlb.getValue();

         if (['interrupted'].indexOf(s1) >= 0) return true;
         if (['interrupted'].indexOf(s2) >= 0) return true;
         return false;
      }

      function resetActions() {
         sobj.p1action.ddlb.setValue('');
         sobj.p2action.ddlb.setValue('');
         sobj.p1action.ddlb.unlock();
         sobj.p2action.ddlb.unlock();
      }

      function setsWon() {
         if (!set_scores.length) return [0, 0];
         let totals = set_scores.map(s => {
            let g0 = isNaN(s[0].games) ? s[0].games : +s[0].games;
            let g1 = isNaN(s[1].games) ? s[1].games : +s[1].games;
            if (g0 !== undefined && g1 !== undefined && g0 !== '' && g1 !== '') {
               // if .games attribute present, then normal set
               // if tiebreak score, check that there is a tiebreak value
               if (tbScore(g0, g1) && !s[0].tiebreak && !s[1].tiebreak) return [0, 0];

               // if minimum score difference not met (or games_for_set exceeded) there is no winner
               if (g0 == f.games_for_set && g0 == g1 + 1) return [0, 0];
               if (g1 == f.games_for_set && g1 == g0 + 1) return [0, 0];

               // otherwise set winner determined by greater score at least games_for_set
               if (g0 > g1 && g0 >= f.games_for_set) return [1, 0];
               if (g1 > g0 && g1 >= f.games_for_set) return [0, 1];
            } else if (s[0].supertiebreak != undefined && s[1].supertiebreak != undefined) {
               if (s[0].supertiebreak > s[1].supertiebreak + 1 && s[0].supertiebreak >= f.supertiebreak_to) return [1, 0];
               if (s[1].supertiebreak > s[0].supertiebreak + 1 && s[1].supertiebreak >= f.supertiebreak_to) return [0, 1];
            }
            return [0, 0];
         })
         let sets_won = totals.reduce((a, b) => [a[0] + b[0], a[1] + b[1]]);
         return sets_won;
      }

      function determineWinner() {
         if (!set_scores.length) return undefined;

         let sets_won = setsWon();
         // if an equivalent # of sets have been won, no winner
         if (sets_won[0] == sets_won[1] && !interrupted() && irregularWinner() == undefined) {
            displayActions(false);
            return;
         }

         let max_sets_won = Math.max(...sets_won);
         let needed_to_win = Math.max(f.sets_to_win, Math.floor(set_scores.length / 2) + 1);

         // if # of sets won is less than or equal to half the number of sets, then no winner;
         if (max_sets_won < needed_to_win) return;

         let winner = sets_won[0] >= needed_to_win ? 0 : sets_won[1] >= needed_to_win ? 1 : undefined;
         if (winner == undefined && !interrupted() && irregularWinner() == undefined) {
            displayActions(false);
            return;
         }

         if (sobj.p1tiebreak.element.style.display != 'inline') displayActions(true);
         sobj[winner == 0 ? 'p1action' : 'p2action'].ddlb.setValue('winner');
         sobj[winner == 1 ? 'p1action' : 'p2action'].ddlb.setValue(' ');
         sobj[winner == 1 ? 'p1action' : 'p2action'].ddlb.lock();

         // insure entire score is displayed
         set_number = set_scores.length;

         return winner;
      }

      function existingSuperTiebreak(selected_set) {
         let total_sets = set_scores.length;
         let last_set = selected_set == set_scores.length - 1;
         let existing_supertiebreak = last_set && total_sets && set_scores[total_sets - 1][0].supertiebreak != undefined;
         return existing_supertiebreak ? set_scores[total_sets - 1] : false;
      }

      function setIsSuperTiebreak(selected_set) {
         if (!f.final_set_supertiebreak) return false;

         let winner = determineWinner();
         if (winner != undefined && existingSuperTiebreak(selected_set)) return true;

         let sets_won = setsWon();
         let tied_sets = sets_won[0] == sets_won[1] && sets_won[0] + 1 == f.sets_to_win;
         if (tied_sets && selected_set == set_scores.length) return true;
      }

      function gameEdit(selected_set, tiebreak) {
         if (tiebreak) return false;
         if (ddlb_lock) return false;
         if (set_scores.length == 0) return true;

         let winner = determineWinner() != undefined || irregularWinner() != undefined;
         if (winner && selected_set == set_scores.length) return false;
         return true;
      }

      function setScoreDisplay({ selected_set, tiebreak }) {

         supertiebreak = setIsSuperTiebreak(selected_set);

         let game_edit = gameEdit(selected_set, tiebreak || supertiebreak);

         // insure that the value is numeric
         if (!game_edit && !supertiebreak) selected_set = set_scores.length;
         set_number = Math.min(f.max_sets - 1, +selected_set);

         if (game_edit) resetTiebreak();

         if (supertiebreak) {
            sobj.p1tiebreak.element.style.display='inline';
            sobj.p2tiebreak.element.style.display='inline';
            sobj.p1tiebreak.element.disabled = false;
            sobj.p2tiebreak.element.disabled = false;

            sobj.p1action.ddlb.setValue('');
            sobj.p2action.ddlb.setValue('');
            displayActions(false);

            let existing_supertiebreak = existingSuperTiebreak(selected_set);
            if (existing_supertiebreak) {
               sobj.p1tiebreak.element.value = existing_supertiebreak[0].supertiebreak;
               sobj.p2tiebreak.element.value = existing_supertiebreak[1].supertiebreak;
            }
         }

         let this_set = set_scores[selected_set];
         let before = set_scores.slice(0, +selected_set);
         let after = set_scores.slice(+selected_set + 1);

         let p1scores = before.map((s, i) => gen.setScore({ setnum: i, score: s[0] })).join('');
         let p2scores = before.map((s, i) => gen.setScore({ setnum: i, score: s[1] })).join('');
         sobj.p1scores.element.innerHTML = p1scores;
         sobj.p2scores.element.innerHTML = p2scores;

         // .games value must be coerced into a string
         sobj.p1selector.ddlb.setValue(this_set ? this_set[0].games + '' : '');
         sobj.p2selector.ddlb.setValue(this_set ? this_set[1].games + '' : '');

         sobj.p1selector.element.style=`display: ${game_edit && !ddlb_lock ? 'flex' : 'none'}`;
         sobj.p2selector.element.style=`display: ${game_edit && !ddlb_lock ? 'flex' : 'none'}`;

         p1scores = after.map((s, i) => gen.setScore({ setnum: +selected_set + 1 + i, score: s[0] })).join('');
         p2scores = after.map((s, i) => gen.setScore({ setnum: +selected_set + 1 + i, score: s[1] })).join('');
         sobj.p1scores_e.element.innerHTML = p1scores;
         sobj.p2scores_e.element.innerHTML = p2scores;

         let ss = (evt) => setClick(util.getParent(evt.target, 'set_number').getAttribute('setnum'));
         util.addEventToClass('set_number', ss, sobj.scoreboard.element)
      }

      function setClick(set) {
         // if there has been a declared winner then only the last set can be modified
         let winner = declaredWinner();
         if (winner) set = set_scores.length - 1;
         setScoreDisplay({ selected_set: set });
      }

      function getScore() {
         let s1 = sobj.p1action.ddlb.getValue();
         let s2 = sobj.p2action.ddlb.getValue();

         let winner_index = s1 == 'winner' ? 0 : s2 == 'winner' ? 1 : undefined;
         let complete = winner_index != undefined ? true : false;

         let winner = winner_index || 0;
         let loser = 1 - winner;

         let score = set_scores.map(s => {
            if (s[winner].supertiebreak) { return `${s[winner].supertiebreak}-${s[loser].supertiebreak}`; }
            let t1 = s[winner].tiebreak != undefined ? `(${s[winner].tiebreak})` : '';
            let t2 = s[loser].tiebreak != undefined ? `(${s[loser].tiebreak})` : '';
            return `${s[winner].games}${t1}-${s[loser].games}${t2}`;
         }).join(' ');

         let position = teams[winner][0].draw_position;
         let positions = teams.map(team => team[0].draw_position);

         if (s1 == 'retired' || s2 == 'retired') score += ' RET.';
         if (s1 == 'walkover' || s2 == 'walkover') score += ' W.O.';
         if (s1 == 'defaulted' || s2 == 'defaulted') score += ' DEF.';
         if (s1 == 'abandoned' || s2 == 'abandoned') {
            complete = false;
            score += ' Abandonded';
         }
         if (s1 == 'interrupted' || s2 == 'interrupted') {
            complete = false;
            score += ' INT.';
         }

         return { score, position, positions, complete, winner: winner_index }
      }

      function unlockScoreboard() {
         ddlb_lock = false;
         sobj.p1selector.ddlb.unlock();
         sobj.p2selector.ddlb.unlock();
         sobj.p1action.ddlb.unlock();
         sobj.p2action.ddlb.unlock();
      }

      function resetTiebreak() {
         sobj.p1tiebreak.element.value='';
         sobj.p2tiebreak.element.value='';
         sobj.p1tiebreak.element.style.display='none';
         sobj.p2tiebreak.element.style.display='none';
      }

      function outcomeChange(which, value) {
         let p1 = sobj.p1action.ddlb.getValue();
         let p2 = sobj.p2action.ddlb.getValue();
         let winner = determineWinner();
         let irregular_winner = irregularWinner();
         let other = which ? p1 : p2;

         if (value == '') {
            // unselecting winner clears the scoreboard
            if (winner != undefined) {
               set_scores = [];
               set_number = 0;
               sobj[which ? 'p2action' : 'p1action'].ddlb.setValue('');
            }
            sobj[which ? 'p1action' : 'p2action'].ddlb.setValue('');
            displayActions(false);
            unlockScoreboard();

            let sets = set_scores.length;
            if (sets) {
               let ls = set_scores[sets - 1];
               if (!tbScore(ls[0].games, ls[1].games) && !scoreGoal(ls[0].games, ls[1].games)) {
                  set_number = sets - 1;
               }
            }

            setScoreDisplay({ selected_set: set_number });
         } else if (value == 'interrupted') {
            sobj[which ? 'p1action' : 'p2action'].ddlb.setValue(' ');
            ddlb_lock = true;
            setScoreDisplay({ selected_set: set_number });
            sobj.p1selector.ddlb.lock();
            sobj.p2selector.ddlb.lock();
            displayActions(true);
         } else if (value == 'winner' && other == 'winner') {
            if (winner == undefined) {
               sobj[which ? 'p1action' : 'p2action'].ddlb.setValue('retired');
            }
            setScoreDisplay({ selected_set: set_number });
            displayActions(true);
         } else if (value == 'retired' || value == 'walkover' || value == 'defaulted') {
            displayActions(true);
            if (winner != undefined) {
               // score-based winner, so disallow setting opponent as ret, def, w.o.
               sobj[winner ? 'p2action' : 'p1action'].ddlb.setValue('winner');
               sobj[winner ? 'p1action' : 'p2action'].ddlb.setValue(' ');
               sobj[winner ? 'p2action' : 'p1action'].ddlb.unlock();
               sobj[winner ? 'p1action' : 'p2action'].ddlb.lock();
            } else {

               // if tiebreak enable both entry fields
               sobj.p1tiebreak.element.disabled=false;
               sobj.p2tiebreak.element.disabled=false;

               sobj[which ? 'p1action' : 'p2action'].ddlb.setValue('winner');
               sobj[which ? 'p1action' : 'p2action'].ddlb.unlock();
               sobj[which ? 'p2action' : 'p1action'].ddlb.lock();

               ddlb_lock = true;
               sobj.p1selector.ddlb.lock();
               sobj.p2selector.ddlb.lock();

               if (value == 'retired' || value == 'defaulted') {
                  if (winner != undefined) sobj[which ? 'p2action' : 'p1action'].ddlb.setValue(' '); 
                  set_number = set_scores.length;
               }
               if (value == 'retired' && !set_scores.length) sobj[which ? 'p2action' : 'p1action'].ddlb.setValue('walkover');
               if (value == 'walkover') {
                  set_scores = [];
                  set_number = 0;
               }
               setScoreDisplay({ selected_set: set_number });
            }
         } else if (value == 'winner') {
            if (winner == undefined) {
               sobj[which ? 'p1action' : 'p2action'].ddlb.setValue(set_scores.length ? 'retired' : 'walkover');
            } else {
               sobj[which ? 'p1action' : 'p2action'].ddlb.setValue(' ');
            }
            sobj[which ? 'p1action' : 'p2action'].ddlb.lock();

            ddlb_lock = true;
            sobj.p1selector.ddlb.lock();
            sobj.p2selector.ddlb.lock();
            setScoreDisplay({ selected_set: set_number });
         }
      }
   }

   fx.convertStringScore = convertStringScore;
   function convertStringScore({ string_score, winner_index, split=' ', score_format={} }) {
      if (!string_score) return [];

      let f = Object.assign({}, o, score_format);
      string_score = winner_index ? reverseScore(string_score) : string_score;

      let outcome = null;
      let ss = /(\d+)/;
      let sst = /(\d+)\((\d+)\)/;

      let sets = string_score.split(split).map(set => {

         // uglifier doesn't work if variable is undefined
         let tbscore = null;;
         let scores = set.split('-')
            .map(m => {

               let score;
               if (sst.test(m)) {
                  score = { games: +sst.exec(m)[1], tiebreak: +sst.exec(m)[2] }
               } else if (ss.test(m)) {
                  score = { games: +ss.exec(m)[1] }
               } else {
                  outcome = m;
               }
               tbscore = tbscore !== null ? tbscore : (score && score.tiebreak ? score.tiebreak : null);
               return score || undefined;

            });

         // filter out undefined scores
         scores = scores.filter(f=>f);

         // add spacer for score without tiebreak score
         if (tbscore !== null) {
            scores.forEach(s => { if (!s.tiebreak) s.spacer = tbscore; });
         }

         return scores;
      });
     
      // filter out sets without two scores
      sets = sets.filter(scores => scores && scores.length == 2);

      // determine if set is supertiebreak
      sets.forEach(s => {
         if (s[0].games >= f.supertiebreak_to || s[1].games >= f.supertiebreak_to) { 
            s[0].supertiebreak = s[0].games; 
            s[1].supertiebreak = s[1].games;
            delete s[0].games;
            delete s[1].games;
         } 
      })

      if (outcome) {
         if (outcome == 'INT.') sets.interrupted = true;

         if (!sets.length) return sets;

         // passing additional detail from string parse...
         if (winner_index != undefined) {
            // outcomes are attributed to loser...
            sets[sets.length - 1][1 - winner_index].outcome = outcome;
            // and set as attribute on set
            sets[sets.length - 1].outcome = outcome;
            sets.outome = outcome;
         }
      }

      return sets;
   }

   function reverseScore(score, split=' ') {
      if (!score) return;
      let ss = /(\d+)/;
      let sst = /(\d+)\((\d+)\)/;
      // TODO: strip off any characters at the end that are not a set score
      // if split is ' ' then it will be last of array, otherwise it will be at
      // the end of the the last element, split by ' '
      return score.split(split).map(set_score => {
         let scores = set_score
            .split('-')
            .map(s => sst.test(s) ? { games: sst.exec(s)[1], tiebreak: sst.exec(s)[2] } : ss.test(s) ? { games: ss.exec(s)[1] } : undefined)
            .reverse()
            .map(s => {
               // ignore anything that was not recognized
               if (!s) return;
               let tiebreak = s.tiebreak ? `(${s.tiebreak})` : '';
               return `${s.games}${tiebreak}`;
            })
            // filter out anything that was not recognized
            .filter(f=>f)
            .join('-');

         return scores;
      }).join(split);
   }

   return fx;

}();
