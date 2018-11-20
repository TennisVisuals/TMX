export const options = {
   components: {
      players: { add: true, manage: false, teams: false, leagues: false, calcs: false, ranklist: false },
      tournaments: true,
      clubs: false,
      tournament_search: true,
      club_search: true,
      settings: true,
      documentation: true,
      datastorage: false,
      keys: true
   },
   settings_tabs: {
      org: true,
      printing: true,
      general: true,
      search: true,
      data: false,
      draws: true,
      publishing: true,
      schedule: true
   },
   export_tabs: {
      players: false,
      matches: false,
      points: false
   },
   data_tabs: {
      sheets: true,
      server: false
   }
};

