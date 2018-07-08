import { util } from './util';
import { UUID } from './UUID';
import { dd } from './dropdown';
import { theme } from './theme';
import { lang } from './translator';
import { displayFx } from './displayFx';
import { eventManager } from './eventManager';
import { floatingEntry } from './floatingEntry';

export const scoreBoard = function() {
   let fx = {};

   let setClicks = {};

   eventManager.register('setClick', 'tap', setClick) ;

   function setClick(elem) {
      let set_number_element = util.getParent(elem, 'set_number');
      if (!set_number_element) return;
      let set = set_number_element.getAttribute('setnum');
      let muid = util.getParent(elem, 'muid').getAttribute('muid');
      if (setClicks[muid] && typeof setClicks[muid] == 'function') setClicks[muid](set);
   }

   let stb_divider = '/';

   let settings = {
      max_sets: 3,
      sets_to_win: 2,
      games_for_set: 6,
      tiebreaks_at: 6,
      tiebreak_to: 7,
      supertiebreak_to: 10,
      auto_score: true,
      final_set_tiebreak: true,
      final_set_supertiebreak: false,
   }

   fx.settings = (values) => {
      if (!values) return settings;
      util.keyWalk(values, settings);
   }

   let options = {
      bestof: [1, 3, 5],
      setsto: [4, 6, 8],
      tiebreaksto: [7, 12],
      supertiebreakto: [7, 10, 21]
   }

   fx.options = (values) => {
      if (!values) return options;
      util.keyWalk(values, options);
   }

   fx.setMatchScore = ({
      sobj,
      muid,
      flags,
      lock,
      grouped,
      round_name,
      teams,
      existing_scores,
      score_format={},
      scoring_config={},
      match,
      callback,
      auto_score=true
   }) => {

      let floating = !sobj;
      settings.auto_score = auto_score;
      let sf = Object.assign({}, settings, score_format, { auto_score });

      // scoped variables need to be defined before configuration
      var set_number;
      var supertiebreak;
      var longset;
      var ddlb_lock;
      var set_scores;
      var action_drawer;

      if (floating) sobj = fx.floatingScoreBoard({ muid, teams, flags });
      if (round_name) sobj.round_name.element.innerHTML = round_name;
      sobj.details.element.innerHTML = matchStatus(match);
      sobj.scoring.element.style.display = lock ? 'none' : 'inline';
      sobj.favorite.element.style.display = lock ? 'inline' : 'none';

      if (muid) {
         setClicks[muid] = (set) => {
            if (lock) return;
            if (set_scores.length - set > 1) {
               set_scores = set_scores.slice(0, set_scores.length - 1);
               set = set_scores.length - 1;
               resetActions();
            }
            setScoreDisplay({ selected_set: set });
            displayActions(true);
            removeWinner();
         }
      }

      let displayActions = (bool) => {
         let visible = bool && !lock ? true : false;
         action_drawer = visible;
         displayFx.toggleVisible({ elem: sobj.actions.element, type: 'edit', height: 50, visible });
         sobj.scoring.element.style.display = action_drawer || lock ? 'none' : 'inline';
         sobj.edit_scoring.element.style.display = action_drawer ? 'none' : 'inline';
      }

      configureScoring({ sobj, stg: sf, changeFx: clearScores });
      configureOutcomeSelectors();
      configureActionButtons();
      configureTiebreakEntry();
      initialState();

      // SUPPORTING FUNCTIONS
      function initialState() {
         set_scores = existing_scores || [];
         action_drawer = false;
         ddlb_lock = false;

         removeWinner();
         configureScoreSelectors();

         let winner = determineWinner(grouped ? false : true);
         set_number = winner != undefined ? set_scores.length : Math.max(0, set_scores.length - 1);

         if (existing_scores && (existing_scores.length || existing_scores.walkover || existing_scores.default)) {
            let last_set = set_scores.length ? set_scores[set_scores.length - 1] : undefined;
            if (set_scores.interrupted) {
               sobj.p1action.ddlb.setValue(' ');
               sobj.p2action.ddlb.setValue('interrupted');
               sobj.p1action.ddlb.lock();
               sobj.p2action.ddlb.lock();
               displayActions(true);
               if (scoreGoal(last_set[0].games, last_set[1].games)) { set_number += 1; }
            } else if (set_scores.live) {
               sobj.p1action.ddlb.setValue(' ');
               sobj.p2action.ddlb.setValue('live');
               sobj.p1action.ddlb.lock();
               sobj.p2action.ddlb.lock();
               displayActions(true);
               if (scoreGoal(last_set[0].games, last_set[1].games)) { set_number += 1; }
               sf.auto_score = false;
            } else if (set_scores.retired) {
               let retired = existing_scores.winner_index != undefined ? 1 - existing_scores.winner_index : undefined;
               sobj.p1action.ddlb.setValue(retired == 0 ? 'retired' : 'winner');
               sobj.p2action.ddlb.setValue(retired == 1 ? 'retired' : 'winner');
               sobj.p1action.ddlb.lock();
               sobj.p2action.ddlb.lock();
               displayActions(false);
               setWinner(1 - retired);
            } else if (set_scores.default) {
               let defaulted = existing_scores.winner_index != undefined ? 1 - existing_scores.winner_index : undefined;
               sobj.p1action.ddlb.setValue(defaulted == 0 ? 'defaulted' : 'winner');
               sobj.p2action.ddlb.setValue(defaulted == 1 ? 'defaulted' : 'winner');
               sobj.p1action.ddlb.lock();
               sobj.p2action.ddlb.lock();
               displayActions(false);
               setWinner(1 - defaulted);
            } else if (set_scores.walkover) {
               let walkedover = existing_scores.winner_index != undefined ? 1 - existing_scores.winner_index : undefined;
               sobj.p1action.ddlb.setValue(walkedover == 0 ? 'walkover' : 'winner');
               sobj.p2action.ddlb.setValue(walkedover == 1 ? 'walkover' : 'winner');
               sobj.p1action.ddlb.lock();
               sobj.p2action.ddlb.lock();
               displayActions(true);
               setWinner(1 - walkedover);
            } else {
               displayActions(false);
            }
         } else {
            sobj.p1action.ddlb.setValue(' ');
            sobj.p2action.ddlb.setValue(' ');
         }

         // now populate with any existing score
         if (set_scores.retired || set_scores.default || set_scores.walkover) { set_number = undefined; }
         setScoreDisplay({ selected_set: set_number, actions: !grouped });
      }

      function removeWinner() {
         let elements = Array.from(sobj.root.element.querySelectorAll(`.victor`));
         elements.forEach(el => el.classList.remove('victor'));
         if (!lock) resetActions();
      }

      function setWinner(index) {
         let elements = Array.from(sobj.root.element.querySelectorAll(`.opponent${index}`));
         elements.forEach(el => el.classList.add('victor'));
         let checkmarks = Array.from(sobj.root.element.querySelectorAll(`.opponent${index} .hasvalue`));
         checkmarks.forEach(el => el.classList.add('victor'));
      }

      function clearScores() {
         removeWinner();
         set_scores = [];
         set_number = 0;
         resetTiebreak();
         unlockScoreboard();
         configureScoreSelectors();
         setScoreDisplay({ selected_set: set_number });
         sobj.p2action.ddlb.setValue(' ');
         sobj.p1action.ddlb.setValue(' ');
         sf.auto_score = settings.auto_score;
         // if (floating) { displayActions(true); }
      }

      function scoringComplete(outcome) {
         if (outcome) {
            outcome.teams = teams;
            outcome.set_scores = set_scores;
            outcome.score_format = sf;
         }
         if (typeof callback == 'function') { callback(outcome); }
         if (floating) {
            document.body.style.overflow = null;
            d3.select(sobj.scoreboard.element).remove();
         } else {
            displayActions(false);
         }
      }

      function configureActionButtons() {
         sobj.cancel.element.addEventListener('click', floating ? () => scoringComplete() : initialState , false);
         sobj.accept.element.addEventListener('click', acceptScores , false);
         sobj.clear.element.addEventListener('click', clearScores , false);
         sobj.scoring.element.addEventListener('click', toggleScoring , false);

         function acceptScores() {
            determineWinner();
            scoringComplete(getScore());
         }
         function toggleScoring() {
            if (lock) return;
            if (action_drawer) return;
            let visible = sobj.scoring.element.innerHTML == '-' ? true : false;

            // hide overflow before toggle transition starts
            if (!visible) sobj.edit_scoring.element.style.overflow = 'hidden';

            // set toggle icon
            sobj.scoring.element.innerHTML = visible ? '&#x25A2;' : '-';

            let duration = 800;
            displayFx.toggleVisible({ elem: sobj.edit_scoring.element, type: 'edit', height: 100, visible, duration });
            if (visible) {
               // make overflow visible after toggle transition has completed
               setTimeout(function() { sobj.edit_scoring.element.style.overflow = 'visible'; }, duration);
            }
         }
      }

      function configureScoreSelectors() {
         let options = [ { key: '-', value: '' }, ];
         let upper_range = (sf.games_for_set == sf.tiebreaks_at) ? sf.games_for_set + 2 : sf.games_for_set + 1;
         util.range(0, upper_range).forEach(n => options.push({ key: n, value: n }));

         let scoreChange1 = (value) => scoreChange(0, value);
         let scoreChange2 = (value) => scoreChange(1, value);
         dd.attachDropDown({ id: sobj.p1selector.id, options, border: false });
         dd.attachDropDown({ id: sobj.p2selector.id, options, border: false });
         sobj.p1selector.ddlb = new dd.DropDown({ element: sobj.p1selector.element, onChange: scoreChange1, id: sobj.p1selector.id, value_attribute: false });
         sobj.p2selector.ddlb = new dd.DropDown({ element: sobj.p2selector.element, onChange: scoreChange2, id: sobj.p2selector.id, value_attribute: false });
         if (lock) {
            sobj.p1selector.ddlb.lock();
            sobj.p2selector.ddlb.lock();
         }
         sobj.p1selector.ddlb.selectionBackground();
         sobj.p2selector.ddlb.selectionBackground();
      }

      function configureOutcomeSelectors() {
         let actions = [
            { key: ' ', value: '' },
            { key: '-', value: ' ' },
            { key: 'RET.', value: 'retired' },
            { key: 'W.O.', value: 'walkover' },
            { key: 'DEF.', value: 'defaulted' },
            { key: 'INT.', value: 'interrupted' },
            { key: 'LIVE', value: 'live' },
            { key: `<div class='link'><img src='./icons/completed.png' class='completed_icon'></div>`, value: 'winner' },
         ];
         let outcomeChange1 = (value) => outcomeChange(0, value);
         let outcomeChange2 = (value) => outcomeChange(1, value);
         dd.attachDropDown({ id: sobj.p1action.id, options: actions, border: false, floatleft: true });
         dd.attachDropDown({ id: sobj.p2action.id, options: actions, border: false, floatleft: true });
         sobj.p1action.ddlb = new dd.DropDown({ element: sobj.p1action.element, onChange: outcomeChange1, id: sobj.p1action.id });
         sobj.p2action.ddlb = new dd.DropDown({ element: sobj.p2action.element, onChange: outcomeChange2, id: sobj.p2action.id });
         if (lock) {
            sobj.p1action.ddlb.lock();
            sobj.p2action.ddlb.lock();
         }
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

         let tbgoal = supertiebreak ? sf.supertiebreak_to : sf.tiebreak_to;
         // let tbgoal = supertiebreak ? sf.supertiebreak_to : longset ? true : sf.tiebreak_to;
         let complement = numeric == undefined ? '' : numeric + 2 < tbgoal ? tbgoal : numeric + 2;

         sobj[which ? 'p2tiebreak' : 'p1tiebreak'].element.value = numeric != undefined ? numeric : '';

         // if irregularWinner then don't set complement
         if (!irregularWinner()) sobj[which ? 'p1tiebreak' : 'p2tiebreak'].element.value = complement;

         function normalSetTiebreak(submit) {
            let total_sets = set_scores.length;
            let which_set = total_sets > set_number ? total_sets - 1 : set_number - 1;
            set_scores[which_set][0][t1 < t2 ? 'tiebreak' : 'spacer'] = t1 < t2 ? t1 : t2;
            set_scores[which_set][1][t2 < t1 ? 'tiebreak' : 'spacer'] = t2 < t1 ? t2 : t1;
            if (submit) finish();
         }

         function superTiebreakSet(submit) {
            if (t1 < sf.supertiebreak_to && t2 < sf.supertiebreak_to) return;
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
         let long_set = !sf.final_set_supertiebreak && !sf.final_set_tiebreak;
         if (long_set) {
            console.log('Long Set!');
            return score_diff >= 2;
         }
         // any valid winning score that does not indicate a tiebreak
         return score_diff >= 2 && (s1 >= sf.tiebreaks_at || s2 >= sf.tiebreaks_at);
      }

      function tbScore(s1, s2) {
         return (s1 == sf.tiebreaks_at + 1 && s2 == sf.tiebreaks_at) || (s1 == sf.tiebreaks_at && s2 == sf.tiebreaks_at + 1);
      }

      function scoreChange(which, value) {
         if (value == '') {
            sobj.p1selector.ddlb.setValue('');
            sobj.p2selector.ddlb.setValue('');
            set_scores[set_number] = [{ games: 0 }, { games: 0 }];
            return;
         }
         if (interrupted()) resetActions();
         let tiebreak = false;
         resetTiebreak();

         // if a final set score is being modified
         // for instance to change to an interrupted score...
         // only possible to change the final set...
         if (declaredWinner()) {
            set_number = set_scores.length - 1;
            sobj.p1action.ddlb.setValue(' ');
            sobj.p2action.ddlb.setValue(' ');
            unlockScoreboard();
         }

         let p1 = sobj.p1selector.ddlb.getValue();
         let p2 = sobj.p2selector.ddlb.getValue();

         if (sf.auto_score) {
            if (which == 0 && p2 == '') {
               p2 = getComplement(value);
               sobj.p2selector.ddlb.setValue(p2);
            } else if (which == 1 && p1 == '') {
               p1 = getComplement(value);
               sobj.p1selector.ddlb.setValue(p1);
            } else {
               if (p1 == sf.tiebreaks_at + 1 && p2 == sf.tiebreaks_at + 1) replaceValue(sf.tiebreaks_at);
               if (p1 == sf.tiebreaks_at + 1 && p2 < sf.tiebreaks_at - 1) { replaceValue(sf.tiebreaks_at); }
               if (p2 == sf.tiebreaks_at + 1 && p1 < sf.tiebreaks_at - 1) { replaceValue(sf.tiebreaks_at); }
            }
         } else {
            if (which == 0 && !p2) {
               p2 = 0;
               sobj.p2selector.ddlb.setValue(p2);
            } else if (which == 1 && !p1) {
               p1 = 0;
               sobj.p1selector.ddlb.setValue(p1);
            } 
         }

         set_scores[set_number] = [{ games: p1 }, { games: p2 }];

         if (!scoreGoal(p1, p2) && !tbScore(p1, p2)) {
            set_scores = set_scores.slice(0, set_number + 1);
            let w = determineWinner();
            setScoreDisplay({ selected_set: set_number });
            // if (!w) displayActions(false);
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
            if (value == '') return '';
            if (value == sf.tiebreaks_at || value == sf.tiebreaks_at + 1) tiebreak = true;
            if (value == sf.tiebreaks_at - 1 || value == sf.tiebreaks_at) return parseInt(sf.tiebreaks_at || 0) + 1;
            if (value < sf.tiebreaks_at) return sf.games_for_set;
            return sf.tiebreaks_at;
         }
      }

      function nextSet(p1, p2, tiebreak) {
         if (tiebreak && !lock) {
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
         if (numbers && no_winner && set_number + 1 < sf.max_sets) set_number += 1;

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

      function live() {
         let s1 = sobj.p1action.ddlb.getValue();
         let s2 = sobj.p2action.ddlb.getValue();

         if (['live'].indexOf(s1) >= 0) return true;
         if (['live'].indexOf(s2) >= 0) return true;
         return false;
      }

      function resetActions() {
         if (!live()) {
            sobj.p1action.ddlb.setValue(' ');
            sobj.p2action.ddlb.setValue(' ');
         }
         sobj.p1action.ddlb.unlock();
         sobj.p2action.ddlb.unlock();
      }

      function setsWon() {
         if (!set_scores.length) return [0, 0];
         let totals = set_scores.map(sc => {
            let g0 = isNaN(sc[0].games) ? sc[0].games : +sc[0].games;
            let g1 = isNaN(sc[1].games) ? sc[1].games : +sc[1].games;
            if (g0 !== undefined && g1 !== undefined && g0 !== '' && g1 !== '') {
               // if .games attribute present, then normal set
               // if tiebreak score, check that there is a tiebreak value
               if (tbScore(g0, g1) && sc[0].tiebreak == undefined && sc[1].tiebreak == undefined) return [0, 0];

               // if minimum score difference not met (or games_for_set exceeded) there is no winner
               if (sf.games_for_set == sf.tiebreaks_at) {
                  if (g0 == sf.games_for_set && g0 == g1 + 1) return [0, 0];
                  if (g1 == sf.games_for_set && g1 == g0 + 1) return [0, 0];
               } else {
                  if (g0 == sf.games_for_set && g0 == g1 + 1) return [1, 0];
                  if (g1 == sf.games_for_set && g1 == g0 + 1) return [0, 1];
               }

               // otherwise set winner determined by greater score at least games_for_set
               if (g0 > g1 && g0 >= sf.games_for_set) return [1, 0];
               if (g1 > g0 && g1 >= sf.games_for_set) return [0, 1];
            } else if (sc[0].supertiebreak != undefined && sc[1].supertiebreak != undefined) {
               if (sc[0].supertiebreak > sc[1].supertiebreak + 1 && sc[0].supertiebreak >= sf.supertiebreak_to) return [1, 0];
               if (sc[1].supertiebreak > sc[0].supertiebreak + 1 && sc[1].supertiebreak >= sf.supertiebreak_to) return [0, 1];
            }
            return [0, 0];
         })
         let sets_won = totals.reduce((a, b) => [a[0] + b[0], a[1] + b[1]]);
         return sets_won;
      }

      function determineWinner(actions=true) {
         if (!set_scores.length) return undefined;

         let sets_won = setsWon();
         // if an equivalent # of sets have been won, no winner
         if (sets_won[0] == sets_won[1] && !live() && !interrupted() && irregularWinner() == undefined) {
            // displayActions(false);
            return;
         }

         let max_sets_won = Math.max(...sets_won);
         let needed_to_win = Math.max(sf.sets_to_win, Math.floor(set_scores.length / 2) + 1);

         // if # of sets won is less than or equal to half the number of sets, then no winner;
         if (max_sets_won < needed_to_win) return;

         let winner = sets_won[0] >= needed_to_win ? 0 : sets_won[1] >= needed_to_win ? 1 : undefined;
         if (winner == undefined && !live() && !interrupted() && irregularWinner() == undefined) {
            // displayActions(false);
            return;
         }

         if (sobj.p1tiebreak.element.style.display != 'inline' && actions) displayActions(true);
         sobj[winner == 0 ? 'p1action' : 'p2action'].ddlb.setValue('winner');
         sobj[winner == 1 ? 'p1action' : 'p2action'].ddlb.setValue('');
         sobj[winner == 1 ? 'p1action' : 'p2action'].ddlb.lock();

         setWinner(winner);

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

      function setIsSuperTiebreak(selected_set, actions) {
         if (!sf.final_set_supertiebreak) return false;

         let winner = determineWinner(actions);
         if (winner != undefined && existingSuperTiebreak(selected_set)) return true;
         return isFinalSet(selected_set, actions);
      }

      function setIsLongSet(selected_set, actions) {
         if (sf.final_set_supertiebreak || sf.final_set_tiebreak) return false;
         return isFinalSet(selected_set, actions);
      }

      function isFinalSet(selected_set, actions) {
         let sets_won = setsWon();
         let tied_sets = sets_won[0] == sets_won[1] && sets_won[0] + 1 == sf.sets_to_win;
         if (tied_sets && selected_set == set_scores.length) return true;
      }

      function gameEdit(selected_set, tiebreak, actions) {
         if (tiebreak) return false;
         if (ddlb_lock) return false;
         if (selected_set == undefined) return false;
         if (set_scores.length == 0) return true;

         let winner = determineWinner(actions) != undefined || irregularWinner() != undefined;
         if (winner && (selected_set == undefined || selected_set == set_scores.length)) return false;
         return true;
      }

      function setScoreDisplay({ selected_set, tiebreak, actions }) {
         supertiebreak = setIsSuperTiebreak(selected_set, actions);

         let game_edit = gameEdit(selected_set, tiebreak || supertiebreak, actions);

         // insure that the value is numeric
         if (!game_edit && !supertiebreak) selected_set = set_scores.length;
         set_number = Math.min(sf.max_sets - 1, +selected_set);

         if (game_edit) resetTiebreak();

         if (supertiebreak && !lock) {
            sobj.p1tiebreak.element.style.display='inline';
            sobj.p2tiebreak.element.style.display='inline';
            sobj.p1tiebreak.element.disabled = false;
            sobj.p2tiebreak.element.disabled = false;

            sobj.p1action.ddlb.setValue(' ');
            sobj.p2action.ddlb.setValue(' ');
            // displayActions(false);

            let existing_supertiebreak = existingSuperTiebreak(selected_set);
            if (existing_supertiebreak) {
               sobj.p1tiebreak.element.value = existing_supertiebreak[0].supertiebreak;
               sobj.p2tiebreak.element.value = existing_supertiebreak[1].supertiebreak;
            }
         }

         let this_set = set_scores[selected_set];
         // before is all sets before current entry, or all sets if scoreboard locked
         let before = lock ? set_scores : set_scores.slice(0, +selected_set);
         let after = set_scores.slice(+selected_set + 1);

         if (lock && !set_scores.length) { before = [[{games: 0}, {games: 0}]]; }

         let p1scores = before.map((s, i) => setScore({ setnum: i, score: s[0] })).join('');
         let p2scores = before.map((s, i) => setScore({ setnum: i, score: s[1] })).join('');
         sobj.p1scores.element.innerHTML = p1scores;
         sobj.p2scores.element.innerHTML = p2scores;

         // .games value must be coerced into a string
         sobj.p1selector.ddlb.setValue(this_set ? this_set[0].games + '' : '');
         sobj.p2selector.ddlb.setValue(this_set ? this_set[1].games + '' : '');
         // selectors won't be shown if scoreboard is loacked or ddlb is locked or editing tiebreak (!game_edit)
         sobj.p1selector.element.style.display = (game_edit && !ddlb_lock && !lock) ? 'flex' : 'none';
         sobj.p2selector.element.style.display = (game_edit && !ddlb_lock && !lock) ? 'flex' : 'none';

         p1scores = after.map((s, i) => setScore({ setnum: +selected_set + 1 + i, score: s[0] })).join('');
         p2scores = after.map((s, i) => setScore({ setnum: +selected_set + 1 + i, score: s[1] })).join('');
         sobj.p1scores_e.element.innerHTML = p1scores;
         sobj.p2scores_e.element.innerHTML = p2scores;
      }

      function getScore() {
         let s1 = sobj.p1action.ddlb.getValue();
         let s2 = sobj.p2action.ddlb.getValue();

         let winner_index = s1 == 'winner' ? 0 : s2 == 'winner' ? 1 : undefined;
         let complete = winner_index != undefined ? true : false;

         let winner = winner_index || 0;
         let loser = 1 - winner;

         let score = set_scores.map(s => {
            if (s[winner].supertiebreak) { return `${s[winner].supertiebreak}${stb_divider}${s[loser].supertiebreak}`; }
            let t1 = s[winner].tiebreak;
            let t2 = s[loser].tiebreak;
            // TODO: copy how reverseScore works in case of unfinished tiebreak
            let tiebreak = t1 != undefined || t2 != undefined ? `(${[t1, t2].filter(f=>f >= 0).join('-')})` : '';
            return `${s[winner].games}-${s[loser].games}${tiebreak}`;
         }).join(' ');

         let position = teams[winner][0].draw_position;
         let positions = teams.map(team => team[0].draw_position);

         if (s1 == 'retired' || s2 == 'retired') score += ' RET.';
         if (s1 == 'walkover' || s2 == 'walkover') score = 'W.O.';
         if (s1 == 'defaulted' || s2 == 'defaulted') score += ' DEF.';
         if (s1 == 'abandoned' || s2 == 'abandoned') {
            complete = false;
            score += ' Abandonded';
         }
         if (s1 == 'interrupted' || s2 == 'interrupted') {
            complete = false;
            score += ' INT.';
         }
         if (s1 == 'live' || s2 == 'live') {
            complete = false;
            score += ' LIVE';
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

         sf.auto_score = settings.auto_score;
         if (value == '') {
            // unselecting winner clears the scoreboard
            if (winner != undefined) {
               set_scores = [];
               set_number = 0;
               sobj[which ? 'p2action' : 'p1action'].ddlb.setValue(' ');
            }
            sobj[which ? 'p1action' : 'p2action'].ddlb.setValue(' ');
            // displayActions(false);
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
            setScoreDisplay({ selected_set: set_number });
         } else if (value == 'live') {
            sf.auto_score = false;
            sobj[which ? 'p1action' : 'p2action'].ddlb.setValue(' ');
            setScoreDisplay({ selected_set: set_number });
            // ddlb_lock = true;
            // sobj.p1selector.ddlb.lock();
            // sobj.p2selector.ddlb.lock();
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

               // ddlb_lock = true;
               // sobj.p1selector.ddlb.lock();
               // sobj.p2selector.ddlb.lock();

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

      let sf = Object.assign({}, settings, score_format);
      string_score = winner_index ? reverseScore(string_score) : string_score;

      let outcome = null;
      let ss = /(\d+)/;
      let sst = /(\d+)\((\d+)\)/;

      let sets = string_score.split(split).filter(f=>f).map(set => {

         if (set.indexOf('/') > 0) {
            // look for supertiebreak scores using #/# format
            let scores = set.split('/').map(m => (ss.exec(m)) ? { games: +ss.exec(m)[1] } : undefined).filter(f=>f);
            if (scores.length == 2) return scores;
         }

         // uglifier doesn't work if variable is undefined
         let tbscore = null;;
         let scores = set.split('-')
            .map(m => {
               let score;
               if (sst.test(m)) {
                  tbscore = +sst.exec(m)[2];
                  score = { games: +sst.exec(m)[1] }
               } else if (ss.test(m)) {
                  score = { games: +ss.exec(m)[1] }
               } else {
                  outcome = m;
               }
               return score || undefined;
            });

         // filter out undefined scores
         scores = scores.filter(f=>f);

         // add spacer for score without tiebreak score
         if (tbscore !== null) {
            let min_games = Math.min(...scores.map(s=>s.games));
            scores.forEach(s => { if (sf.games == min_games) { sf.tiebreak = tbscore } else { sf.spacer = tbscore; } });
         }

         return scores;
      });
     
      // filter out sets without two scores
      sets = sets.filter(scores => scores && scores.length == 2);

      // determine if set is supertiebreak
      sets.forEach(st => {
         if (st[0].games >= sf.supertiebreak_to || st[1].games >= sf.supertiebreak_to) { 
            st[0].supertiebreak = st[0].games; 
            st[1].supertiebreak = st[1].games;
            delete st[0].games;
            delete st[1].games;
         } 
      })

      if (winner_index != undefined) { sets.winner_index = winner_index; }

      if (outcome) {
         if (outcome == 'INT.') sets.interrupted = true;
         if (outcome == 'LIVE') sets.live = true;
         if (outcome == 'RET.') sets.retired = true;
         if (outcome == 'DEF.') sets.default = true;
         if (outcome == 'W.O.') sets.walkover = true;

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

   fx.configureScoring = configureScoring;
   function configureScoring({ sobj, stg, changeFx }) {
      util.boolAttrs(stg);
      dd.attachDropDown({ 
         id: sobj.bestof.id, 
         options: numericOptions(options.bestof)
      });
      sobj.bestof.ddlb = new dd.DropDown({ element: sobj.bestof.element, id: sobj.bestof.id, onChange: setBestOf });
      sobj.bestof.ddlb.selectionBackground();
      sobj.bestof.ddlb.setValue(stg.max_sets, 'white');

      dd.attachDropDown({ 
         id: sobj.setsto.id, 
         options: numericOptions(options.setsto)
      });
      sobj.setsto.ddlb = new dd.DropDown({ element: sobj.setsto.element, id: sobj.setsto.id, onChange: setsTo });
      sobj.setsto.ddlb.selectionBackground();
      sobj.setsto.ddlb.setValue(stg.games_for_set, 'white');

      let gfs = stg.games_for_set;
      let tbat_options = [
         {key: `${gfs-1}-${gfs-1}`, value: gfs - 1},
         {key: `${gfs}-${gfs}`, value: gfs},
      ];

      dd.attachDropDown({ 
         id: sobj.tiebreaksat.id, 
         options: tbat_options,
      });
      sobj.tiebreaksat.ddlb = new dd.DropDown({ element: sobj.tiebreaksat.element, id: sobj.tiebreaksat.id, onChange: setTiebreakAt });
      sobj.tiebreaksat.ddlb.selectionBackground();
      sobj.tiebreaksat.ddlb.setValue(stg.tiebreaks_at && stg.tiebreaks_at < gfs ? stg.tiebreaks_at : gfs, 'white');

      dd.attachDropDown({ 
         id: sobj.tiebreaksto.id, 
         options: numericOptions(options.tiebreaksto)
      });
      sobj.tiebreaksto.ddlb = new dd.DropDown({ element: sobj.tiebreaksto.element, id: sobj.tiebreaksto.id });
      sobj.tiebreaksto.ddlb.selectionBackground();
      sobj.tiebreaksto.ddlb.setValue(stg.tiebreak_to, 'white');

      dd.attachDropDown({ 
         id: sobj.finalset.id, 
         options: [
            {key: 'Normal', value: 'N'},
            {key: 'Supertiebreak', value: 'S'},
            // {key: 'Long', value: 'L'},
         ],
      });
      sobj.finalset.ddlb = new dd.DropDown({ element: sobj.finalset.element, id: sobj.finalset.id, onChange: finalSet });
      sobj.finalset.ddlb.selectionBackground();
      sobj.finalset.ddlb.setValue(stg.final_set_supertiebreak ? 'S' : stg.final_set_tiebreak ? 'N' : 'L', 'white');

      dd.attachDropDown({ 
         id: sobj.supertiebreakto.id, 
         options: numericOptions(options.supertiebreakto)
      });
      sobj.supertiebreakto.ddlb = new dd.DropDown({ element: sobj.supertiebreakto.element, id: sobj.supertiebreakto.id, onChange: superTiebreakTo });
      sobj.supertiebreakto.ddlb.selectionBackground();
      sobj.supertiebreakto.ddlb.setValue(stg.supertiebreak_to, 'white');
      sobj.supertiebreakto.element.style.opacity = stg.final_set_supertiebreak ? 1 : 0;
      sobj.stb2.element.style.opacity = stg.final_set_supertiebreak ? 1 : 0;

      function numericOptions(arr) {
         if (!arr || !Array.isArray(arr)) return {};
         return arr.map(a=>({key:a, value: a}));
      }

      function setBestOf(value) {
         stg.max_sets = parseInt(value);
         stg.sets_to_win = Math.ceil(value/2);
         if (typeof changeFx == 'function') changeFx();
      }

      function setsTo(value) {
         stg.games_for_set = parseInt(value);
         stg.tiebreaks_at = parseInt(value);
         let tbat_options = [
            {key: `${value-1}-${value-1}`, value: value - 1},
            {key: `${value}-${value}`, value: value},
         ];
         sobj.tiebreaksat.ddlb.setOptions(tbat_options);
         sobj.tiebreaksat.ddlb.setValue(value, 'white');
         if (typeof changeFx == 'function') changeFx();
      }

      function setTiebreakAt(value) {
         stg.tiebreaks_at = parseInt(value);
         if (typeof changeFx == 'function') changeFx();
      }

      function finalSet(value) {
         stg.final_set_supertiebreak = value == 'S' ? true : false;
         stg.final_set_tiebreak = value == 'N' ? true : false;
         sobj.supertiebreakto.element.style.opacity = stg.final_set_supertiebreak ? 1 : 0;
         sobj.stb2.element.style.opacity = stg.final_set_supertiebreak ? 1 : 0;
         if (typeof changeFx == 'function') changeFx();
      }

      function superTiebreakTo(value) {
         stg.supertiebreak_to = parseInt(value);
         if (typeof changeFx == 'function') changeFx();
      }
   }

   fx.scoreBoards = ({ matches, elmnt, flags }) => {
      var all_ids = {};
      var sbz = d3.select(elmnt).selectAll('.match')
         .data(matches);

      sbz.enter()
         .append('div')
         .attr('class', 'match')
        .merge(sbz)
         .html(matchHTML)

      sbz.exit()
         .remove();

      function matchHTML(d) {
         let { ids, html } = generateScoreBoard({
            flags,
            teams: d.teams,
            match: d.match,
            muid: d.match.muid,
            round_name: d.match.round_name
         });
         all_ids[d.match.muid] = ids;
         ids.scoreboard = d.match.muid;
         return html;
      }

      let id_obj = Object.assign({}, ...Object.keys(all_ids).map(key => ({ [key]: displayFx.idObj(all_ids[key]) })));
      return id_obj;
   }

   fx.floatingScoreBoard = ({ muid, teams, flags }) => {
      let sb_ids = { scoreboard: displayFx.uuid(), }

      let scoreboard = d3.select('body')
         .append('div')
         .attr('class', 'modal')
         .attr('id', sb_ids.scoreboard);

      let { ids, html } = generateScoreBoard({ muid, teams, flags });

      let entry = floatingEntry()
         .selector('#' + sb_ids.scoreboard)
         .events( {'click': () => {
            setClick(d3.event.target);
            let elems = document.querySelectorAll('li.dd_state');
            Array.from(elems).forEach(elem => { elem.classList.remove("active"); })
         }});

      entry(window.innerWidth * .3, window.innerHeight * .4, html);

      scoreboard.on('click', () => d3.select(`#${sb_ids.scoreboard}`).remove());

      Object.assign(ids, sb_ids);
      let id_obj = displayFx.idObj(ids);
      return id_obj;
   }

   fx.scoreBoardConfig = () => {
      let cfg_ids = { 
         config: displayFx.uuid(),
         cancel: displayFx.uuid(),
         accept: displayFx.uuid(),
      }

      let config = d3.select('body')
         .append('div')
         .attr('class', 'modal')
         .attr('id', cfg_ids.config);

      let { ids, html } = scoreBoardConfig();

      let entry = floatingEntry()
         .selector('#' + cfg_ids.config)
         .events( {'click': () => {
            let elems = document.querySelectorAll('li.dd_state');
            Array.from(elems).forEach(elem => { elem.classList.remove("active"); })
         }});

      html = `
         <div class='scoreboard noselect flexcenter' style='background: #000; min-width: 320px; height: 180px;'>
            ${html}
            <div class="accept-config scoreboard-action">
               <div class="edit flexcol">
                  <div class="frame">
                     <div class="scoreboard-actions">
                        <button id='${cfg_ids.cancel}' class='btn dismiss'>${lang.tr('actions.cancel')}</button>
                        <button id='${cfg_ids.accept}' class='btn accept'>${lang.tr('apt')}</button>
                     </div>
                  </div>
               </div>
            </div>
         </div>
      `;

      entry(window.innerWidth * .3, window.innerHeight * .4, html);

      let target = config.select('.scoreboard-config');
      target
         .style('display', 'flex')
         .style('height', '100px')
         .style('overflow', 'visible')
         .style('width', '100%')
         .style('padding', '.2em');
      target.select('.edit')
         .style('display', 'flex')
         .style('width', '100%');

      target = config.select('.accept-config');
      target
         .style('display', 'flex')
         .style('height', '50px')
         .style('overflow', 'visible')
         .style('width', '100%')
         .style('padding', '.2em');
      target.select('.edit')
         .style('display', 'flex')
         .style('width', '100%');

      Object.assign(ids, cfg_ids);
      let id_obj = displayFx.idObj(ids);
      return id_obj;
   }
   return fx;
}();

function scoreboardTeam({ team, index=0, flags }) {
   if (!team[index]) return '';
   let first_name = team[index].first_name;
   let last_name = team[index].last_name;
   if (team[index].seed) last_name += ` [${team[index].seed}]`;
   let ioc = team[index].ioc && team[index].ioc.length == 3 ? team[index].ioc.toUpperCase() : 'spacer';
   let ioc_flag = flags ? `<img onerror="this.style.visibility='hidden'" width="25px" src="${flags}/${ioc}.png">` : '';

   let html = `
      <div class="team_player">
         <span class="pad">${ioc_flag}</span>
         <span class="pad">${first_name}</span>
         <span class="last-name pad">${last_name}</span>
         <span class="pad"></span>
      </div>
   `;
   return html;
}

function setScore({ setnum, score={games:0} }) {
   let tiebreak = score.tiebreak != undefined ? score.tiebreak : score.spacer != undefined ? score.spacer : '';
   let setscore = score.supertiebreak != undefined ? score.supertiebreak : score.games;
   let html = `
      <div class="set score set_number setClick" setnum="${setnum != undefined ? setnum : ''}">
         <div class="setscore setClick">${setscore}</div>
         <div class="tbscore" ${score.spacer !== undefined ? 'style="opacity: 0"' : ''}>${tiebreak}</div>
      </div>
   `;
   return html;
}

function scoreBoardConfig() {
   let ids = {
      edit_scoring: UUID.idGen(),
      bestof: UUID.idGen(),
      setsto: UUID.idGen(),
      tiebreaksat: UUID.idGen(),
      tiebreaksto: UUID.idGen(),
      finalset: UUID.idGen(),
      supertiebreakto: UUID.idGen(),
      stb2: UUID.idGen(),
   }
   let html = `
         <div id='${ids.edit_scoring}' class="scoreboard-config scoreboard-action">
            <div class="edit configure sb_flexrow">
               <div class='flexcol' style='width: 25%'>
                  <div style='text-align: right'>${lang.tr('scoring_format.bestof')}</div>
                  <div style='text-align: right'>${lang.tr('scoring_format.tbat')}</div>
                  <div style='text-align: right'>${lang.tr('scoring_format.finalset')}</div>
               </div>
               <div class='flexcol' style='width: 25%'>
                  <div id="${ids.bestof}" class="score-selector"></div>
                  <div id="${ids.tiebreaksat}" class="score-selector"></div>
                  <div id="${ids.finalset}" class="score-selector"></div>
               </div>
               <div class='flexcol' style='width: 25%'>
                  <div style='text-align: right'>${lang.tr('scoring_format.setsto')}</div>
                  <div style='text-align: right'>${lang.tr('scoring_format.tbto')}</div>
                  <div id='${ids.stb2}' style='text-align: right'>${lang.tr('scoring_format.superto')}</div>
               </div>
               <div class='flexcol' style='width: 25%'>
                  <div id="${ids.setsto}" class="score-selector"></div>
                  <div id="${ids.tiebreaksto}" class="score-selector"></div>
                  <div id="${ids.supertiebreakto}" class="score-selector"></div>
               </div>

            </div>
         </div>
   `;

   return { ids, html }
}

function generateScoreBoard({ muid, teams, flags, round_name, match }) {
   let ids = {
      root: muid ? `u_${muid}` : UUID.idGen(),
      actions: UUID.idGen(),
      favorite: UUID.idGen(),
      scoring: UUID.idGen(),
      clear: UUID.idGen(),
      cancel: UUID.idGen(),
      accept: UUID.idGen(),
      p1action: UUID.idGen(),
      p2action: UUID.idGen(),
      p1scores: UUID.idGen(),
      p2scores: UUID.idGen(),
      round_name: UUID.idGen(),
      p1scores_e: UUID.idGen(),
      p2scores_e: UUID.idGen(),
      p1selector: UUID.idGen(),
      p2selector: UUID.idGen(),
      p1tiebreak: UUID.idGen(),
      p2tiebreak: UUID.idGen(),
      details: UUID.idGen(),
   }

   let config = scoreBoardConfig();
   Object.assign(ids, config.ids);

   let html = `
      <div id="${ids.root}" class="scoreboard noselect muid ${ids.root}" muid='${muid}'>
         <div class='scorebox'>
            <div class='info'>
               <span class="info-text">
                  <span class="round_name" id='${ids.round_name}'>${round_name || ''}</span>
               </span>
               <div id='${ids.favorite}' class='fav favoriteMatch' style='display: none'></div>
               <div id='${ids.scoring}' class='options' style='display: none'>-</div>
            </div>
            <div class='sbox'>
               <div class='sbcol flexgrow'> 
                  <div class="opponent opponent0">
                     <div class="opponent-name">
                        <div class="name-detail">
                           ${scoreboardTeam({ team: teams[0], index: 0, flags })}
                           ${scoreboardTeam({ team: teams[0], index: 1, flags })}
                        </div>
                     </div>
                  </div>
            
                  <div class="opponent opponent1">
                     <div class="opponent-name">
                        <div class="name-detail">
                           ${scoreboardTeam({ team: teams[1], index: 0, flags })}
                           ${scoreboardTeam({ team: teams[1], index: 1, flags })}
                        </div>
                     </div>
                  </div>
               </div>

               <div class='sbcol'> 
                  <div class="opponent opponent0">
                     <div id="${ids.p1scores}" class="opponent-scores"></div>
                     <div id="${ids.p1selector}" class="score-selector"></div>
                     <div class="score-selector tbinput"> <input id="${ids.p1tiebreak}"> </div>
                     <div id="${ids.p1scores_e}" class="opponent-scores"></div>
                  </div>
            
                  <div class="opponent opponent1">
                     <div id="${ids.p2scores}" class="opponent-scores"></div>
                     <div id="${ids.p2selector}" class="score-selector"></div>
                     <div class="score-selector tbinput"> <input id="${ids.p2tiebreak}"> </div>
                     <div id="${ids.p2scores_e}" class="opponent-scores"></div>
                  </div>
               </div>

               <div class='sbcol'>
                  <div class="opponent opponent0">
                     <div id="${ids.p1action}" class="score-action"></div>
                  </div>
                  <div class="opponent opponent1">
                     <div id="${ids.p2action}" class="score-action"></div>
                  </div>
               </div>

               <div class='sbcol'>
                  <div class="opponent opponent0">&nbsp;</div>
                  <div class="opponent opponent1">&nbsp;</div>
               </div>

            </div>
            <div class="info">
               <span class="info-text">
                  <span id="${ids.details}" class="court">${matchStatus(match)}</span>
               </span>
            </div>
         </div>

         ${config.html}

         <div id='${ids.actions}' class="scoreboard-action">
            <div class="edit flexcol">
               <div class="frame">
                  <div class="scoreboard-actions">
                     <button id='${ids.cancel}' class='btn dismiss'>${lang.tr('actions.cancel')}</button>
                     <button id='${ids.clear}' class='btn dismiss'>${lang.tr('clr')}</button>
                     <button id='${ids.accept}' class='btn accept'>${lang.tr('apt')}</button>
                  </div>
               </div>
            </div>
         </div>

      </div>
   `;

   return { ids, html };
}

function matchStatus(match) {
   if (!match) return '';
   if (match.status) return status;
   if (!match.schedule) return '';

   let today = new Date();
   let mday = new Date(match.schedule.day);
   let match_is_today = mday.getDay() == today.getDay() && mday.getMonth() == today.getMonth() && mday.getYear() == today.getYear();

   let duration = matchDuration(match.schedule);
   if (duration) return `Duration ${duration}`;

   let time = `${match.schedule.time_prefix || ''}${match.schedule.time || ''}`;
   let notice = `${match.schedule.court || ''}${time ? ' / ' + time : ''}`;

   return (match.winner_index == undefined) ? notice : '';
}

function matchDuration(schedule) {
   if (!schedule.start || !schedule.end) return '';

   let seconds = timeSeconds(schedule.end) - timeSeconds(schedule.start);
   return util.HHMMSS(seconds, { pad_hours: false, display_seconds: false });
}

function timeSeconds(time) {
   let split = time.split(':');
   return (split[0] * 60 * 60) + (split[1] * 60);
}
