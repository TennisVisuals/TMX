import { util } from './util';

export const theme = function() {
   let fx = {};
   let context = 'home';
   let elements = {};
   let current = 'default';

   let hts = {
      mutedred: '#924058',
      logoblue: '#004c7a',
      logored: '#b41040',
      gray: '#a8acb3',
   }

   let mts = {
      primary: '#0A8936',
      primary_shade: '#0cb045',
      secondary: '#b41040',
   }

   let ddb = {
      // primary: '#9a68f1',
      // primary: '#925cf0',
      primary: '#8042EE',
      primary_text: 'white',
      // secondary: '#8042EE',
      secondary: '#651bea',
      secondary_text: 'white',
      // primary_shade: '#651BEA',
      primary_shade: '#430ea1',
   }

   let themes = {
      default: {
         '--flags': true,
         '--tf-background': 'black',

         // splash
         '--homeicon': 'homewhite',
         '--reficon': 'refwhite',
         '--trnyicon': 'tourneywhite',
         '--primary-text': 'white',
         '--primary-background': 'black',
         '--secondary-text': 'black',
         '--secondary-background': 'white',

         // schedule
         '--schedule-text': 'white',
         '--schedule-background': 'black',
         '--schedule-complete': '#212D64',
         '--schedule-inprogress': '#278523',
         '--schedule-timepressure': '#A15202',
         '--schedule-conflict': '#F5A9A9',
         '--umpirenotes': 'white',

         // scoreboard
         '--sb-panel-background': '#222',
         '--sb-opponent-background': '#2f2f2f',
         '--sb-actions-background': '#2f2f2f',
         '--sb-actions-text': 'white',
         '--sb-info-color': '#aaa',
         '--sb-options': '#333',
         '--sb-options-hover': '#444',
         '--sb-winner-color': '#486149',

         // tournament feed
         '--trny-info': '#222',
         '--trny-info-text': 'white',
         '--unauthorized-trny-info': '#6D6D6D',
         '--unauthorized-trny-info-text': 'white',
         '--event-info': '#2f2f2f',
         '--event-info-text': 'white',
         '--unauthorized-event-info': 'gray',
         '--unauthorized-event-info-text': 'white',
         '--male-event': '#B5BCFD',
         '--female-event': '#FDB5FD',
         '--mixed-event': 'white',

         // dropdown
         '--dd-active': 'gray',
         '--dd-active-color': '#000',
         '--dd-notactive-color': '#FFF',
         '--dd-span-background': '#EBEBEB',
         '--dd-span-hover': '#CECECE',
         '--dd-li-background': '#000',
         '--dd-label-color': '#FFF',
         '--dd-hasvalue': '#2f2f2f',
         '--dd-novalue': '#FFF',
      },
      HTS: {
         '--flags': false,
         '--tf-background': 'white',

         // splash
         '--homeicon': 'homeblack',
         '--reficon': 'refblack',
         '--trnyicon': 'tourneyblack',
         '--primary-text': 'black',
         '--primary-background': '#fcfcfc',
         '--secondary-text': 'black',
         '--secondary-background': 'white',

         // schedule
         '--schedule-text': 'black',
         '--schedule-background': 'white',
         '--schedule-complete': '#83d0ff',
         '--schedule-inprogress': '#99f88d',
         '--schedule-timepressure': '#eff8be',
         '--schedule-conflict': '#f6aebd',
         '--umpirenotes': '#34782E',

         // scoreboard
         '--sb-panel-background': hts.logoblue,
         '--sb-opponent-background': '#0078c0',
         '--sb-actions-background': '#0078c0',
         '--sb-actions-text': 'white',
         '--sb-info-color': '#aaa',
         '--sb-options': '#0066a4',
         '--sb-options-hover': '#0078c0',
         '--sb-winner-color': '#0078c0',

         // tournament feed
         '--trny-info': hts.logoblue,
         '--trny-info-text': 'white',
         '--unauthorized-trny-info': hts.logored,
         '--unauthorized-trny-info-text': 'white',
         '--event-info': '#0078c0',
         '--event-info-text': 'white',
         '--unauthorized-event-info': hts.logored,
         '--unauthorized-event-info-text': 'white',
         '--male-event': 'white',
         '--female-event': 'white',
         '--mixed-event': 'white',

         // dropdown
         '--dd-active': 'gray',
         '--dd-active-color': '#000',
         '--dd-notactive-color': '#FFF',
         '--dd-span-background': '#EBEBEB',
         '--dd-span-hover': '#CECECE',
         '--dd-li-background': '#000',
         '--dd-label-color': '#FFF',
         '--dd-hasvalue': '#0078c0',
         '--dd-novalue': '#FFF',
      },
      'CTS': {
         '--flags': false,
         '--tf-background': 'white',

         // splash
         '--homeicon': 'homeblack',
         '--reficon': 'refblack',
         '--trnyicon': 'tourneyblack',
         '--primary-text': 'black',
         '--primary-background': '#fcfcfc',
         '--secondary-text': 'black',
         '--secondary-background': 'white',

         // schedule
         '--schedule-text': 'black',
         '--schedule-background': 'white',
         '--schedule-complete': '#83d0ff',
         '--schedule-inprogress': '#99f88d',
         '--schedule-timepressure': '#eff8be',
         '--schedule-conflict': '#f6aebd',
         '--umpirenotes': '#34782E',

         // scoreboard
         '--sb-panel-background': '#1A5493',
         '--sb-opponent-background': '#3FC1EC',
         '--sb-actions-background': '#3FC1EC',
         '--sb-actions-text': 'white',
         '--sb-info-color': '#aaa',
         '--sb-options': '#0066a4',
         '--sb-options-hover': '#3FC1EC',
         '--sb-winner-color': '#3FC1EC',

         // tournament feed
         '--trny-info': '#1A5493',
         '--trny-info-text': 'white',
         '--unauthorized-trny-info': '#c1ab40',
         '--unauthorized-trny-info-text': 'white',
         '--event-info': '#3fc1ec',
         '--event-info-text': 'white',
         '--unauthorized-event-info': '#c1ab40',
         '--unauthorized-event-info-text': 'white',
         '--male-event': 'white',
         '--female-event': 'white',
         '--mixed-event': 'white',

         // dropdown
         '--dd-active': 'gray',
         '--dd-active-color': '#000',
         '--dd-notactive-color': '#FFF',
         '--dd-span-background': '#EBEBEB',
         '--dd-span-hover': '#CECECE',
         '--dd-li-background': '#000',
         '--dd-label-color': '#FFF',
         '--dd-hasvalue': '#3FC1EC',
         '--dd-novalue': '#FFF',
      },
      MTS: {
         '--tf-background': 'white',

         // splash
         '--homeicon': 'homeblack',
         '--reficon': 'refblack',
         '--trnyicon': 'tourneyblack',
         '--primary-text': 'black',
         '--primary-background': '#fcfcfc',
         '--secondary-text': 'black',
         '--secondary-background': 'white',

         // schedule
         '--schedule-text': 'black',
         '--schedule-background': 'white',
         '--schedule-complete': '#83d0ff',
         '--schedule-inprogress': '#99f88d',
         '--schedule-timepressure': '#eff8be',
         '--schedule-conflict': '#f6aebd',
         '--umpirenotes': 'white',

         // scoreboard
         '--sb-panel-background': mts.primary,
         '--sb-opponent-background': mts.primary_shade,
         '--sb-actions-background': mts.primary_shade,
         '--sb-actions-text': 'white',
         '--sb-info-color': '#aaa',
         '--sb-options': '#0a963b',
         '--sb-options-hover': mts.primary_shade,
         '--sb-winner-color': mts.primary_shade,

         // tournament feed
         '--trny-info': mts.primary,
         '--trny-info-text': 'white',
         '--unauthorized-trny-info': mts.secondary,
         '--unauthorized-trny-info-text': 'white',
         '--event-info': mts.primary_shade,
         '--event-info-text': 'white',
         '--unauthorized-event-info': mts.secondary,
         '--unauthorized-event-info-text': 'white',
         '--male-event': 'white',
         '--female-event': 'white',
         '--mixed-event': 'white',

         // dropdown
         '--dd-active': 'gray',
         '--dd-active-color': '#000',
         '--dd-notactive-color': '#FFF',
         '--dd-span-background': '#EBEBEB',
         '--dd-span-hover': '#CECECE',
         '--dd-li-background': '#000',
         '--dd-label-color': '#FFF',
         '--dd-hasvalue': mts.primary_shade,
         '--dd-novalue': '#FFF',
      },
      DDB: {
         '--flags': true,
         '--tf-background': 'white',

         // splash
         '--homeicon': 'homewhite',
         '--reficon': 'refwhite',
         '--trnyicon': 'tourneywhite',
         '--primary-text': ddb.primary_text,
         '--primary-background': ddb.primary_shade,
         '--secondary-text': 'black',
         '--secondary-background': 'white',

         // schedule
         '--schedule-text': 'black',
         '--schedule-background': 'white',
         '--schedule-complete': '#83d0ff',
         '--schedule-inprogress': '#99f88d',
         '--schedule-timepressure': '#eff8be',
         '--schedule-conflict': '#f6aebd',
         '--umpirenotes': 'white',

         // scoreboard
         '--sb-panel-background': ddb.primary_shade,
         '--sb-opponent-background': ddb.primary,
         '--sb-actions-background': ddb.primary,
         '--sb-actions-text': 'white',
         '--sb-info-color': '#aaa',
         '--sb-options': ddb.primary_shade,
         '--sb-options-hover': ddb.primary,
         '--sb-winner-color': ddb.primary,

         // tournament feed
         '--trny-info': ddb.primary_shade,
         '--trny-info-text': ddb.primary_text,
         '--unauthorized-trny-info': ddb.primary_shade,
         '--unauthorized-trny-info-text': ddb.primary_text,
         '--event-info': ddb.primary,
         '--event-info-text': ddb.primary_text,
         '--unauthorized-event-info': ddb.primary,
         '--unauthorized-event-info-text': ddb.primary_text,
         '--male-event': 'white',
         '--female-event': 'white',
         '--mixed-event': 'white',

         // dropdown
         '--dd-active': 'gray',
         '--dd-active-color': '#000',
         '--dd-notactive-color': '#FFF',
         '--dd-span-background': '#EBEBEB',
         '--dd-span-hover': '#CECECE',
         '--dd-li-background': '#000',
         '--dd-label-color': '#FFF',
         '--dd-hasvalue': ddb.primary,
         '--dd-novalue': '#FFF',
      },
   }

   fx.current = () => current;
   fx.elements = (el) => { elements = el; return fx; }
   fx.exists = (theme) => Object.keys(themes).indexOf(util.replaceDiacritics(theme)) >= 0;
   fx.getProperty = (property) => themes[current][property];
   fx.setProperty = (property, value, elem=document.body) => {
      elem.style.setProperty(property, value);
      return fx;
   }
   fx.set = (theme) => {
      theme = util.replaceDiacritics(theme);
      if (Object.keys(themes).indexOf(theme) < 0) return;
      Object.keys(themes[theme]).forEach(property => fx.setProperty(property, themes[theme][property]));
      current = theme;
      Object.keys(icons).forEach(fx.setIcon);
      fx.context(context);
      return fx;
   }
   fx.context = (c) => {
      if (!c) return context;
      context = c;
      fx.setIcon('context');
      let background = fx.getProperty(contexts[context].tmx);
      elements['tmx'].style.background = background;
      if (background) document.querySelector('body').style.background = background;
      return fx;
   }

   let icons = {
      'home': { fx: 'homeClick', icon: '--homeicon' },
      'context': { fx: 'contextClick', },
      'logo': { fx: 'logoClick', icon: '--logo' },
   }

   let contexts = {
      'referee': { icon: '--reficon', tmx: '--tf-background' },
      'tournaments': { icon: '--trnyicon', tmx: '--tf-background' },
      'home': { icon: '', tmx: '--secondary-background' },
   }

   fx.setIcon = (icon) => {
      var element = elements[icon] && elements[icon].querySelector('.icon2');
      if (element) {
         var image;
         var clickFx = icons[icon].fx || '';
         if (icons[icon].icon) {
            image = themes[current][icons[icon].icon] || ''; 
         } else {
            image = themes[current][contexts[context].icon] || ''; 
         }
         element.classList = `icon2 ${clickFx} ${image}`;
      }
      return fx;
   }

   return fx;
}();

