export const db = function() {
   var db = {};

   var ad_errors = 0;
   db.addDev = function(variable) {
      try { Object.keys(variable).forEach(key => dev[key] = variable[key]); }
      catch(err) { if (!ad_errors) { console.log('production environment'); ad_errors += 1; } }
   }

   db.initDB = () => {
      return new Promise ((resolve, reject) => {
         db.db = new Dexie("CourtHiveTournaments", {autoOpen: false});
         db.db.version(1).stores({ 
            aliases: "&alias",
            ignored: "[hash+ioc]",
            clubs: "&id, &code",
            calculations: "&hash, date, type",
            matches: "&muid, *puids, format, date, tournament.category, tournament.tuid",
            points: "[puid+tuid+format+round], puid, tuid, muid, date",
            tournaments: "&tuid, name, start, end, category, cuid",
            players: "&puid, hash, cuid, &id, [last_name+first_name], last_name, birthdate",
            rankings: "category",
            settings: "key",
         });
         db.db.version(2).stores({ 
            aliases: "&alias",
            ignored: "[hash+ioc]",
            clubs: "&id, &code",
            calculations: "&hash, date, type",
            matches: "&muid, *puids, format, date, tournament.category, tournament.tuid",
            points: "[puid+tuid+format+round], puid, tuid, muid, date",
            tournaments: "&tuid, name, start, end, category, cuid",
            players: "&puid, hash, cuid, &id, [last_name+first_name], last_name, birthdate",
            rankings: "category",
            settings: "key",
            idioms: "ioc",
         });
         /*
         db.db.version(3).stores({ 
            // remove aliases & ignored code
            // aliases: "&alias",
            // ignored: "[hash+ioc]",

            clubs: "&id, code",
            calculations: "&hash, date, type",
            matches: "&muid, *puids, format, date, tournament.category, tournament.tuid",

            // also chandge addPointEvent()
            points: "[puid+euid+format+round], puid, tuid, euid, muid, date",

            tournaments: "&tuid, name, start, end, category, cuid",
            players: "&puid, cuid, &id, [last_name+first_name], last_name, birth",    // remove hash
            teams: "&tmuid, name",

            rankings: "category",
            settings: "key",
            idioms: "ioc",
            themes: "&theme",
         });
         */
         db.db.open().then(resolve, reject);
      });
   }

   db.resetDB = (callback) => {
      db.db.close();
      Dexie.delete('CourtHiveTournaments').then(callback, () => alert('Failed to Reset Database'));
   }

   db.findAll = (table) => new Promise((resolve, reject) => db.db[table].toArray(resolve, reject).catch(reject));
   db.findAllClubs = () => db.findAll('clubs');
   db.findAllPlayers = () => db.findAll('players');
   db.findAllAliases = () => db.findAll('aliases');
   db.findAllIgnored = () => db.findAll('ignored');
   db.findAllTournaments = () => db.findAll('tournaments');
   db.findAllCalculations = () => db.findAll('calculations');
   db.findAllRankings = () => db.findAll('rankings');
   db.findAllSettings = () => db.findAll('settings');
   db.findAllIdioms = () => db.findAll('idioms');

   db.findAllMatches = () => db.findAll('matches');
   db.findAllPoints = () => db.findAll('points');

   db.findWhere = (tbl, attr, val) => new Promise ((resolve, reject) => db.db[tbl].where(attr).equals(val).toArray(resolve, reject).catch(reject));
   db.findTournamentMatches = (tuid) => db.findWhere('matches', 'tournament.tuid', tuid);
   db.findTournamentPoints = (tuid) => db.findWhere('points', 'tuid', tuid);
   db.findPlayerPoints = (puid) => db.findWhere('points', 'puid', puid);
   db.findPlayerMatches = (puid) => db.findWhere('matches', 'puids', puid);
   db.findPlayersWhere = (attr, val) => db.findWhere('players', attr, val);
   db.findClubPlayers = (cuid) => db.findWhere('players', 'cuid', cuid);
   db.findRankings = (category) => db.findUnique('rankings', 'category', category);
   db.findPointsRange = (start, end) => db.db.points.where('date').between(start, end).toArray();
   db.findMatchesRange = (start, end) => db.db.matches.where('date').between(start, end).toArray();

   // TODO: update the database version to index player dates properly!
   // db.findPlayersRange = (start, end) => db.db.players.where('birth').between(start, end).toArray();

   db.pointsAfter = (date) => new Promise ((resolve, reject) => db.db.points.where('date').aboveOrEqual(date).toArray(resolve, reject).catch(reject));

   db.deleteMatch = (muid) => {
      return new Promise((resolve, reject) => db.db.matches.where('muid').equals(muid).delete().then(() => db.deleteMatchPoints(muid), reject));
   }
   db.deleteMatchPoints = (muid) => db.db.points.where('muid').equals(muid).delete();

   db.deleteEventMatches = (tuid, euid) => new Promise ((resolve, reject) => db.db.matches.where('tournament.tuid').equals(tuid).modify((match, ref) => {
      if (euid && match.event && euid == match.event.euid) return delete ref.value;
   }).then(resolve, reject));
   db.deleteEventPoints = (tuid, euid) => new Promise ((resolve, reject) => db.db.points.where('tuid').equals(tuid).modify((point, ref) => {
      if (euid && point.euid && euid == point.euid) return delete ref.value;
   }).then(resolve, reject));

   db.deleteTournament = (tuid) => {
      return new Promise((resolve, reject) => {
         db.db.tournaments.where('tuid').equals(tuid).delete().then(deleteTournamentMatches, reject);
         function deleteTournamentMatches() { db.deleteTournamentMatches(tuid).then(deleteTournamentPoints, reject); }
         function deleteTournamentPoints() { db.deleteTournamentPoints(tuid).then(resolve, reject); }
      });
   }
   // Sometimes necessary to delete only specific gender (when loading gendered spreadsheet)
   db.deleteTournamentMatches = (tuid, gender, format) => new Promise ((resolve, reject) => db.db.matches.where('tournament.tuid').equals(tuid).modify((match, ref) => {
      if (!gender && !format) return delete ref.value;
      if (gender && match.gender == gender && format && match.format == format) return delete ref.value;
      if (!gender && format && format == match.format) return delete ref.value;
      if (!format && gender && gender == match.gender) return delete ref.value;
   }).then(resolve, reject));
   db.deleteTournamentPoints = (tuid, gender, format) => new Promise ((resolve, reject) => db.db.points.where('tuid').equals(tuid).modify((point, ref) => {
      if (!gender && !format) return delete ref.value;
      if (gender && point.gender == gender && format && point.format == format) return delete ref.value;
      if (!gender && format && format == point.format) return delete ref.value;
      if (!format && gender && gender == point.gender) return delete ref.value;
   }).then(resolve, reject));
   db.deleteAllPlayerRankings = () => db.db.players.toCollection().modify(player => delete player.rankings);
   db.deleteAllPlayerPoints = () => db.db.players.toCollection().modify(player => delete player.points);

   db.calcCleanup = () => {
      return new Promise((resolve, reject) => {
         console.log('deleteing rankings');
         db.deleteAllPlayerRankings().then(deleteRankings, logError);
         function deleteRankings() { console.log('deleting points'); db.deleteAllPlayerPoints().then(deleteCalcs, logError) }
         function deleteCalcs() { console.log('deleting calcs'); db.db.calculations.toCollection().delete().then(() => console.log('complete'), logError); }
         function logError(err) { console.log('error:', err); reject(); }
      });
   }

   // database cleanup
   db.deleteAllTournamentMatches = () => db.db.tournaments.toCollection().modify(tournament => delete tournament.matches).then(() => console.log('done'));
   db.deleteAllTournamentPlayers = () => db.db.tournaments.toCollection().modify(tournament => delete tournament.players).then(() => console.log('done'));
   db.deleteAllTournamentEvents = () => db.db.tournaments.toCollection().modify(tournament => delete tournament.events).then(() => console.log('done'));

   db.deleteSetting = (key) => db.db.settings.where('key').equals(key).delete();

   // dangerous!
   db.deleteAllTournamentAttr = (attr) => db.db.tournaments.toCollection().modify(tournament => delete tournament[attr]).then(() => console.log('done'));

   db.findUnique = (tbl, attr, val) => new Promise ((resolve, reject) => db.findWhere(tbl, attr, val).then(d => resolve(d && d.length ? d[0] : undefined), reject));
   db.findSetting = (key) => db.findUnique('settings', 'key', key);
   db.findIdiom = (ioc) => db.findUnique('idioms', 'ioc', ioc);
   db.findPlayer = (puid) => db.findUnique('players', 'puid', puid);
   db.findPlayerById = (id) => db.findUnique('players', 'id', id);
   db.findClub = (cuid) => db.findUnique('clubs', 'id', cuid);
   db.findTournament = (tuid) => db.findUnique('tournaments', 'tuid', tuid);
   db.findTournamentByOldID = (old_id) => db.findUnique('tournaments', 'old_id', old_id);
   db.findTournamentsBetween = (start, end) => new Promise ((resolve, reject) => db.db.tournaments.where('end').between(start, end).toArray(resolve, reject));

   db.addItem = (tbl, item) => new Promise ((resolve, reject) => db.db[tbl].add(item).then(resolve, reject).catch((err) => { alert('try again:', err); reject(err); }));
   db.addAlias = (alias) => db.addItem('aliases', alias);
   db.addIgnore = (ignore) => db.addItem('ignored', ignore);

   db.modifyOrAddUnique = (tbl, attr, val, item) => new Promise ((resolve, reject) => {
      db.db[tbl].where(attr).equals(val)
         .modify(data => Object.assign(data, item))
         .then((result) => {
            if (result) {
               return resolve('exists');
            } else {
               db.addItem(tbl, item).then(resolve, reject);
            }
         }, (err) => { console.log(err); reject(err) });
   });

   db.addMatch = (match) => db.modifyOrAddUnique('matches', 'muid', match.muid, match);
   db.addPlayer = (player) => db.modifyOrAddUnique('players', 'puid', player.puid, player);
   db.addClub = (club) => db.modifyOrAddUnique('clubs', 'id', club.id, club);
   db.addIdiom = (idiom) => db.modifyOrAddUnique('idioms', 'ioc', idiom.ioc, idiom);
   db.addTournament = (tournament) => db.modifyOrAddUnique('tournaments', 'tuid', tournament.tuid, tournament);
   db.addCalcDate = (calculation) => db.modifyOrAddUnique('calculations', 'hash', calculation.hash, calculation);
   db.addPointEvent = (point_event) => {
      point_event.round = point_event.round_name;
      return db.modifyOrAddUnique('points', '[puid+tuid+format+round]', [point_event.puid, point_event.tuid, point_event.format, point_event.round], point_event);
      // when database table definition changes:
      // return db.modifyOrAddUnique('points', '[puid+euid]', [point_event.puid, point_event.tuid, point_event.format, point_event.round], point_event);
   }
   db.addCategoryRankings = (rankings) => db.modifyOrAddUnique('rankings', 'category', rankings.category, rankings);
   db.addSetting = (setting) => db.replaceOrAddUnique('settings', 'key', setting.key, setting);

   db.replaceOrAddUnique = (tbl, attr, val, item) => new Promise ((resolve, reject) => {
      db.db[tbl].where(attr).equals(val).delete()
         .then(() => { db.addItem(tbl, item).then(resolve, reject) }, (err) => { console.log(err); reject(err) });
   });

   db.modify = (tbl, attr, val, fx, params) => new Promise((resolve, reject) => {
      db.db[tbl].where(attr).equals(val)
         .modify(item => {
            Object.assign(params, { item });
            fx(params);
         })
         .then(resolve, err => console.log('error:', err));
   });

   return db;
 
}();

/*
   // examples 

   // delete all matches without a tuid
   db.db.players.toCollection().modify((match, ref) => { if (!match.tournament.tuid) delete ref.value });

*/
