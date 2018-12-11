import { env } from './env';
import { staging } from './staging';
import { stringFx } from './stringFx';

export const exportCSV = function() {
   let fx = {};

   function download(filename, dataStr) {
     let a = document.createElement('a');
     a.style.display = 'none';
     a.setAttribute('href', dataStr);
     a.setAttribute('download', filename);
     let elem = document.body.appendChild(a);
     elem.click();
     elem.remove();
   }

   fx.downloadText = (filename, text) => {
      let dataStr = 'data:text/plain;charset=utf-8,' + encodeURIComponent(text);
      download(filename, dataStr);
   };

   fx.json2csv = json2csv;
   function json2csv(records, separator = ',') {
      if (!records.length) return false;
      let keys = Object.keys(records[0]);
      let delimiter = (item) => `"${item}"`;
      return keys.join(separator) + '\n' + records.map(record => keys.map(key => delimiter(record[key])).join(separator)).join('\n');
   }

   // ITF Export
   
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
      let csv = fx.json2csv(match_records);
      fx.downloadText(`ITF-${profile}-${tournament.tuid}.csv`, csv);
   };

   fx.ITFmatchRecords = ({ matches, tournament }) => { return matches.map(match => fx.ITFmatchRecord({ match, tournament })).filter(r=>r); };
   // END ITF

   // UTR
   let zeroPad = (number) => number.toString()[1] ? number : "0" + number; 
   let normalID = (id) => stringFx.replaceDiacritics(id).toUpperCase();
   let dateFormatUTR = (timestamp) => { 
      if (!timestamp) return '';
      let date = new Date(timestamp);
      return [zeroPad(date.getMonth() + 1), zeroPad(date.getDate()), date.getFullYear()].join('/');
   };

   fx.UTRmatchRecord = (match, tournament_players) => {
      let getPlayerBirth = (player) => tournament_players.reduce((p, c) => p || (c.id == player.id ? c.birth : false), false) || '';
      let winners = match.team_players[match.winner];
      let losers = match.team_players[1 - match.winner];
      let players = match.players;
      let dbls = winners && winners.length > 1;
      let category = staging.legacyCategory(match.tournament.category) || '';
      let genders = match.players.map(p => p.sex).filter(f=>f).filter((item, i, s) => s.lastIndexOf(item) == i);
      let player_gender = (sex) => ['M', 'B'].indexOf(sex) >= 0 ? 'M' : 'F';
      let draw_gender = !genders.length ? '' : genders.length > 1 ? 'Mixed' : genders[0] == 'M' ? 'Male' : 'Female';
      if (!match.round_name) console.log('no round name:', match);
      let qualifying = match.round_name && match.round_name.indexOf('Q') == 0 && match.round_name.indexOf('QF') < 0;
      let draw_type = match.consolation ? 'Consolation' : qualifying ? 'Qualifying' : 'Main';

      let sanctioning = (env.org && env.org.name) || '';

      let profileID = (profile_url) => {
         let parts = profile_url && typeof profile_url == 'string' && profile_url.split('/');
         return (!parts || parts.indexOf('myutr') < 0 && parts.indexOf('players') < 0) ? '' : parts.reverse()[0];
      };

      if (!winners) {
         console.log('match:', match);
         return;
      }

      let schedule_date = match.schedule && match.schedule.day && new Date(match.schedule.day);
      let match_date = schedule_date && schedule_date <= match.tournament.end ? schedule_date : match.date > match.tournament.end ? match.tournament.end : match.date;

      return {
         "Date": dateFormatUTR(match_date),

         "Winner 1 Name": stringFx.normalizeName(`${players[winners[0]].last_name}, ${players[winners[0]].first_name}`),
         "Winner 1 Third Party ID": normalID(players[winners[0]].cropin || ''),
         "Winner 1 UTR ID": profileID(players[winners[0]].profile),
         "Winner 1 Gender": player_gender(players[winners[0]].sex),
         "Winner 1 DOB": dateFormatUTR(getPlayerBirth(players[winners[0]])),
         "Winner 1 City": stringFx.replaceDiacritics(players[winners[0]].city || ''),
         "Winner 1 State": '',
         "Winner 1 Country": players[winners[0]].ioc || '',
         "Winner 1 College": '',
         "Winner 2 Name": dbls ? stringFx.normalizeName(`${players[winners[1]].last_name}, ${players[winners[1]].first_name}`) : '',
         "Winner 2 Third Party ID": normalID(dbls ? (players[winners[1]].cropin || '') : ''),
         "Winner 2 UTR ID": profileID(players[winners[1]] && players[winners[1]].profile),
         "Winner 2 Gender": dbls ? player_gender(players[winners[1]].sex) : '',
         "Winner 2 DOB": dbls ? dateFormatUTR(getPlayerBirth(players[winners[1]])) : '',
         "Winner 2 City": stringFx.replaceDiacritics(dbls ? (players[winners[0]].city || '') : ''),
         "Winner 2 State": '',
         "Winner 2 Country": dbls ? (players[winners[1]].ioc || '') : '',
         "Winner 2 College": '',

         "Loser 1 Name": stringFx.normalizeName(`${players[losers[0]].last_name}, ${players[losers[0]].first_name}`),
         "Loser 1 Third Party ID": normalID(players[losers[0]].cropin || ''),
         "Loser 1 UTR ID": profileID(players[losers[0]].profile),
         "Loser 1 Gender": player_gender(players[losers[0]].sex),
         "Loser 1 DOB": dateFormatUTR(getPlayerBirth(players[losers[0]])),
         "Loser 1 City": stringFx.replaceDiacritics(players[losers[0]].city || ''),
         "Loser 1 State": '',
         "Loser 1 Country": players[losers[0]].ioc || '',
         "Loser 1 College": '',
         "Loser 2 Name": dbls ? stringFx.normalizeName(`${players[losers[1]].last_name}, ${players[losers[1]].first_name}`) : '',
         "Loser 2 Third Party ID": normalID(dbls ? (players[losers[1]].cropin || '') : ''),
         "Loser 2 UTR ID": profileID(players[losers[1]] && players[losers[1]].profile),
         "Loser 2 Gender": dbls ? player_gender(players[losers[1]].sex) : '',
         "Loser 2 DOB": dbls ? dateFormatUTR(getPlayerBirth(players[losers[1]])) : '',
         "Loser 2 City": stringFx.replaceDiacritics(dbls ? (players[losers[0]].city || '') : ''),
         "Loser 2 State": '',
         "Loser 2 Country": dbls ? (players[losers[1]].ioc || '') : '',
         "Loser 2 College": '',

         "Score": match.score,
         "Id Type": 'UTR',
         "Draw Name": match.tournament.draw || '',
         "Draw Gender": draw_gender,
         "Draw Team Type": stringFx.normalizeName(match.format) || '',
         "Draw Bracket Type": '',
         "Draw Bracket Value": category,
         "Draw Type": draw_type,
         "Tournament Name": match.tournament.name || '',
         "Tournament URL": '',
         "Tournament Start Date": dateFormatUTR(new Date(match.tournament.start).getTime()),
         "Tournament End Date": dateFormatUTR(new Date(match.tournament.end).getTime()),
         "Tournament City": '',
         "Tournament State": '',
         "Tournament Country": '',
         "Tournament Country Code": '',
         "Tournament Host": '',
         "Tournament Location Type": '',
         "Tournament Surface": '',
         "Tournament Event Type": 'Tournament',
         "Tournament Event Category": category == 'Seniors' || category == 'S' ? 'Seniors' : 'Juniors',
         "Tournament Import Source": 'CourtHive',
         "Tournament Sanction Body": sanctioning,
         "Match ID": match.muid,
         "Tournament Event Grade": ''
      };
   };

   fx.downloadUTRmatches = (tournament, matches) => {
      let profile = env.org.abbr || 'Unknown';
      let match_records = fx.UTRmatchRecords({ matches, players: tournament.players });
      let csv = fx.json2csv(match_records);
      fx.downloadText(`UTR-${profile}-${tournament.tuid}-U${tournament.category}.csv`, csv);
   };

   fx.UTRmatchRecords = ({ matches, players }) => {
      return matches.map(m => fx.UTRmatchRecord(m, players)).filter(r=>r);
   };

   // END UTR


   return fx;
}();

