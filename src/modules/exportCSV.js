import { env } from './env';
import { exportFx } from './exportFx';

export const exportCSV = function() {
   let fx = {};

   /*
   // MatchID,
   // Side1Player1ID,
   // Side1Player2ID,
   // Side2Player1ID,
   // Side2Player2ID,
   // MatchWinner,
   // SurfaceType,
   // Score,
      
   ScoreSet1Side1,
   ScoreSet1Side2,
   ScoreSet1WinningTieBreak,
   ScoreSet1LosingTieBreak,
   ScoreSet2Side1,
   ScoreSet2Side2,
   ScoreSet2WinningTieBreak,
   ScoreSet2LosingTieBreak,
   ScoreSet3Side1,
   ScoreSet3Side2,
   ScoreSet3WinningTieBreak,
   ScoreSet3LosingTieBreak,
   ScoreSet4Side1,
   ScoreSet4Side2,
   ScoreSet4WinningTieBreak,
   ScoreSet4LosingTieBreak,
   ScoreSet5Side1,
   ScoreSet5Side2,
   ScoreSet5WinningTieBreak,
   ScoreSet5LosingTieBreak,

   // MatchType,
   // TournamentID,
   // TournamentName,
   // MatchStartDate,
   // MatchEndDate,
   // TournamentStartDate,
   // TournamentEndDate,
   // AgeCategoryCode,
   // IndoorFlag,
   // Grade,
   // MatchFormat
   */

   function matchDate(match, which) {
      if (!match.schedule) return '';
      if (which && match.schedule[which]) return new Date(match.schedule[which]).toISOString();
      return match.schedule.day || '';
   }

   function setScores(scores=[]) {
      let result = {};
      let five_sets = scores.concat([[], [], [], [], []]).slice(0, 5);
      five_sets.forEach((set, i) => {
         let s1 = getGames(set, 0); 
         let s2 = getGames(set, 1); 
         result[`ScoreSet${i+1}Side1`] = s1 || (s2 ? 0 : ''); 
         result[`ScoreSet${i+1}Side2`] = s2 || (s1 ? 0 : ''); 
         result[`ScoreSet${i+1}LosingTiebreak`] = getTiebreak(set, 0) || getTiebreak(set, 1); 
         let p1 = getSuperTiebreak(set, 0);
         let p2 = getSuperTiebreak(set, 1);
         if (p1 || p1) {
            let winning = Math.max(p1, p2);
            let losing = Math.min(p1, p2);
            result[`ScoreSet${i+1}WinningTiebreak`] = winning;
            result[`ScoreSet${i+1}LosingTiebreak`] = losing || 0;
         }
      });

      return result;

      function getGames(arr, i) { return Array.isArray(arr) && arr[i] && arr[i].games || ''; }
      function getTiebreak(arr, i) { return Array.isArray(arr) && arr[i] && arr[i].tiebreak || ''; }
      function getSuperTiebreak(arr, i) { return Array.isArray(arr) && arr[i] && arr[i].supertiebreak || ''; }
   }

   fx.ITFmatchRecord = ({ match, tournament }) => {
      if (match.winner_index == undefined) { return console.log('match:', match); }
      let match_type = match.players.length > 2 ? 'D' : 'S';

      let p1 = match.players[match.team_players[0][0]];
      let p2 = match.players[match.team_players[0][1]];
      let p3 = match.players[match.team_players[1][0]];
      let p4 = match.players[match.team_players[1][1]];

      let match_record = {
         "MatchID": match.muid,

         "Side1Player1ID"     : p1 && p1.puid || '',
         "Side1Player2ID"     : p2 && p2.puid || '',
         "Side2Player1ID"     : p3 && p3.puid || '',
         "Side2Player2ID"     : p4 && p4.puid || '',

         "MatchWinner"        : +match.winner_index + 1,
         "SurfaceType"        : match.event.surface || '',
         "Score"              : match.score,

         "MatchType"          : match_type,
         "TournamentID"       : match.tournament.tuid,
         "TournamentName"     : match.tournament.name,

         "MatchStartDate"     : matchDate(match, 'start'),
         "MatchEndDate"       : matchDate(match, 'end'),

         "TournamentStartDate": match.tournament.start && new Date(match.tournament.start).toISOString() || '',
         "TournamentEndDate"  : match.tournament.end && new Date(match.tournament.end).toISOString() || '',

         "AgeCategoryCode"    : match.event.category,
         "IndoorFlag"         : tournament.inout == 'i' ? 'true' : '',
         "Grade"              : match.tournament.rank || '',
         "MatchFormat"        : '' 
      };

      let set_scores = setScores(match.set_scores);

      Object.assign(match_record, set_scores);

      return match_record;
   };

   fx.downloadITFmatches = (tournament, matches) => {
      let profile = env.org.abbr || 'Unknown';
      let match_records = fx.ITFmatchRecords({ matches, tournament });
      let csv = exportFx.json2csv(match_records);
      exportFx.downloadText(`ITF-${profile}-${tournament.tuid}.csv`, csv);
   };

   fx.ITFmatchRecords = ({ matches, tournament }) => { return matches.map(match => fx.ITFmatchRecord({ match, tournament })).filter(r=>r); };
   return fx;
}();

