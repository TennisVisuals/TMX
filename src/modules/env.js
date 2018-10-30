export const env = {

   date_pickers: [],

   first_time_user: false,

   // version is Major.minor.added.changed.fixed
   version: '1.4.1.1.0',
   version_check: undefined,
   reset_new_versions: false,

   ioc: 'gbr',
   orientation: undefined,
   documentation: true,

   org: {
      name: undefined,
      abbr: undefined,
      ouid: undefined,
   },
   // editing: { players: { birth: true, gender: true } },
   assets: {
      flags: '/media/flags/',
      ioc_codes: './assets/ioc_codes',
   },
   auto_update: {
      players: false,
   },
   metadata: {
      exchange_formats: {
         oops: 1.0,
         matches: 1.0,
         tournaments: 1.0,
      }
   },
   exports: {
      utr: false
   },
   uploads: {
      matches: false,
   },
   locations: {
      geolocate: true,
      geoposition: undefined,
      map: undefined,
      map_provider: 'leaflet', // 'google' or 'leaflet'
   },
   leaflet: {
      map: {
         tileLayer: 'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', 
         attribution: '&copy; <a href="http://openstreetmap.org">OpenStreetMap</a> Contributors',
         maxZoom: 18
      },
      satellite: {
         tileLayer: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
         attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
      }
   },
   calendar: {
      start: undefined,
      end: undefined,
      category: undefined,
      first_day: 0
   },
   players: {
      merge: true,
      identify: true,
      require: {
         ioc: false
      },
      editing: {
         birth: true,
         gender: true
      }
   },
   points: {
      walkover_wins: ['QF', 'SF', 'F'],
      points_table: {
         validity: [ { from: "1900-01-01", to: "2100-12-31", table: "default" }, ],
         tables : {
            default: {
               categories: {
                  "All": { ratings: { type:  'utr' }, },
                  "U10": { ages: { from:  7, to: 10 }, },
                  "U12": { ages: { from:  9, to: 12 }, },
                  "U14": { ages: { from: 10, to: 14 }, },
                  "U16": { ages: { from: 12, to: 16 }, },
                  "U18": { ages: { from: 13, to: 18 }, },
                  "Adult":  { ages: { from: 16, to: 40 }, },
                  "Senior":  { ages: { from: 35, to: 100 }, },
               },
               rankings: { "1": {}, "2": {}, "3": {}, "4": {}, "5": {}, "6": {}, "7": {}, "8": {} }
            }
         }
      }
   },
   parsers: {},
   tournaments: {
      dual: true,
      team: false,
      league: false
   },
   drawFx: {
      auto_byes: true,
      ll_all_rounds: false,
      auto_qualifiers: false,
      fixed_bye_order: true,
      consolation_seeding: false,
      consolation_wildcards: false,
      consolation_alternates: false,
      compressed_draw_formats: true,
      qualifying_bracket_seeding: true,
      consolation_from_elimination: true,
      consolation_from_qualifying: false,
      seed_limits: [ [0, 0], [4, 2], [11, 4], [21, 8], [41, 16], [97, 32] ],
      "seedPositions": {
         "1" : [["1", "0"]],
         "2" : [["0", "1"]],
         "3" : [["1", ".250"], ["0", ".750"]],
         "5" : [["0", ".250"], ["0", ".500"], ["1", ".500"], ["1", ".750"]],
         "9" : [["1", ".125"], ["0", ".375"], ["1", ".625"], ["0", ".875"]],
         "13": [["0", ".125"], ["1", ".375"], ["0", ".625"], ["1", ".875"]],
         "17": [["1", ".0625"], ["0", ".1875"], ["1", ".3125"], ["0", ".4375"], ["1", ".5625"], ["0", ".6875"], ["1", ".8125"], ["0", ".9375"] ],
         "25": [["0", ".0625"], ["1", ".1875"], ["0", ".3125"], ["1", ".4375"], ["0", ".5625"], ["1", ".6875"], ["0", ".8125"], ["1", ".9375"] ]
      },
      separation: { ioc: false, club_code: false, school: false }
   },
   scoring: {
      delegation: true
   },
   scoreboard: {
      options: {
         bestof: [1, 3, 5],
         setsto: [4, 6, 8, 9],
         tiebreaksto: [5, 7, 12],
         supertiebreakto: [7, 10, 21]
      },
      settings: {
         categories: {},
         singles: {
            max_sets: 3,
            sets_to_win: 2,
            games_for_set: 6,
            tiebreak_to: 7,
            tiebreaks_at: 6,
            supertiebreak_to: 10,
            final_set_tiebreak: true,
            final_set_supertiebreak: false,
         },
         doubles: {
            max_sets: 3,
            sets_to_win: 2,
            games_for_set: 6,
            tiebreak_to: 7,
            tiebreaks_at: 6,
            supertiebreak_to: 10,
            final_set_tiebreak: false,
            final_set_supertiebreak: true,
         },
      },
   },
   draws: {
      autodraw: true,
      types: {
         elimination: true,
         qualification: true,
         roundrobin: true,
         consolation: true,
         compass: true,
         playoff: true,
      },
      subtypes: {
         qualification: {
            preround: true,
            incidentals: false
         }
      },
      structures: {
         feedin: {
            elimination: true,
            consolation: true
         },
      },
      gem_seeding: false,
      settings: {
         separation: true
      },
      compass_draw: {
         direction_by_loss: false  // whether move by # round or # loss
      },
      tree_draw: {
         seeds: { restrict_placement: true },
         flags: { display: true },
         schedule: {
            times: false,
            dates: false,
            courts: false,
            after: false
         },
         minimums: {
            team: 2,
            singles: 2,
            doubles: 2
         },
         round_limits: false,
      },
      rr_draw: {
         doubles: true,
         minimums: {
            team: 3,
            singles: 3,
            doubles: 3
         },
         details: {
            draw_positions: true,
            player_rankings: true,
            player_ratings: true,
            club_codes: true,
            draw_entry: true,
            seeding: true,
            won_lost: true,
            games_won_lost: false,
            bracket_order: true,
         },
         brackets: {
            min_bracket_size: 3,
            default_bracket_size: 4,
            max_bracket_size: 6,
         },
      },
   },
   printing: {
      save_pdfs: false
   },
   publishing: {
      broadcast: true,
      livescore: false,
      require_confirmation: false,
      publish_on_score_entry: true,
      publish_draw_creation: false,
   },
   schedule: {
      clubs: true,
      ioc_codes: false,
      scores_in_draw_order: true,
      completed_matches_in_search: false,
      max_matches_per_court: 14
   },
   searchbox: {
      lastfirst: false,
      diacritics: false,
   },
   delegation: false,
   messages: [],
   storage: undefined,
   notifications: undefined,
   server: {
      requests: {
         externalRequest: [ 'fetchClubs', 'fetchNewPlayers', 'fetchNewTournaments', 'fetchRankList', 'fetchRegisteredPlayers' ],
         sheetDataStorage: [ 'syncClubs', 'syncPlayers', 'syncTournaments' ],
         userInterface: [ 'defaultIdiom', ],
      },
   }
};

