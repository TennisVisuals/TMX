import { db } from './db';
import { env } from './env';
import { util } from './util';
import { coms } from './coms';
import { dd } from './dropdown';
import { domFx } from './domFx';
import { lang } from './translator';
import { displayGen } from './displayGen';
import { fxRegister } from './fxRegister';
import { splashScreen } from './splashScreen';

export const idiomFx = function() {

   let fx = {};

   fx.available_idioms = [];

   fx.init = () => {
      dd.attachDropDown({ id: 'idiomatic' });
      fx.idiom_ddlb = new dd.DropDown({ element: document.getElementById('idiomatic'), onChange: changeIdiom, max: 15, maxFx: idiomLimit });
      fx.idiom_ddlb.selectionBackground('black');
      fxRegister.add('receiveIdiomList', idiomFx.receiveIdiomList);
   };

   function idiomLimit(opts) {
      var ioc_opts = opts.map(o=>`<div class='flag_opt' ioc='${o.value}' title='${o.title}'>${o.key}</div>`).join('');
      let html = `<div class='flag_wrap'>${ioc_opts}</div>`;
      displayGen.showProcessing(html);
      displayGen.escapeModal();
      domFx.addEventToClass('flag_opt', selectIOC);
      function selectIOC(evt) {
         let elem = domFx.findUpClass(evt.target, 'flag_opt');
         let ioc = elem.getAttribute('ioc');
         changeIdiom(ioc);
         displayGen.closeModal();
      }
   }

   fx.changeIdiom = changeIdiom;
   function changeIdiom(ioc) {
      if (lang.set(ioc)) {
         fx.idiom_ddlb.setValue(ioc, 'black');
         env.ioc = ioc;
         splashScreen.show();
      } else {
         if (ioc && ioc.length == '3') coms.sendKey(`${ioc}.idiom`);
      }
   }

   fx.idiomSelectorOptions = idiomSelectorOptions;
   function idiomSelectorOptions(ioc) {
      let ioc_codes = env.ioc_codes || [];
      let ioc_idioms = Object.assign({}, ...ioc_codes.map(d => ({ [d.ioc]: d.name })));
      let idioms = Object.keys(fx.available_idioms);
      if (!idioms.length) idioms = lang.options();
      let options = idioms
         .sort()
         .map(value => {
            let ioc_value = value.length == 3 ? value : 'gbr';
            let img_src = `${env.assets.flags}${ioc_value.toUpperCase()}.png`;
            return { key: `<div class=''><img src="${img_src}" class='idiom_flag'></div>`, value, title: ioc_idioms[value.toUpperCase()] };
         })
         .filter(f=>f.title);
      fx.idiom_ddlb.setOptions(options);
      fx.idiom_ddlb.setValue(ioc, 'black');
   }

   fx.idiomSelector = idiomSelector;
   function idiomSelector() {
      return new Promise((resolve, reject) => {
         function setupIdioms(params) {
            env.ioc = params ? params.ioc : 'gbr';
            idiomSelectorOptions(env.ioc);

            // if there is no default setting, make it visible
            if (!params) {
               env.first_time_user = true;
               document.getElementById('idiomatic').style.opacity = 1;
               // save this as default so that flag is "subtle" for next visit
               changeIdiom('gbr');
            } else if (!lang.set(env.ioc)) {
               coms.sendKey(`${env.ioc}.idiom`);
            }

            resolve();
         }

         db.findAllIdioms().then(prepareIdioms, err => { util.logError(err); reject(); });

         function prepareIdioms(idioms) {
            idioms.forEach(lang.define);
            db.findSetting('defaultIdiom').then(setupIdioms, util.logError);
         }
      });
   }

   fx.receiveIdiomList = receiveIdiomList;
   function receiveIdiomList(data) {
      fx.available_idioms = Object.assign({}, ...data.map(util.attemptJSONparse).filter(f=>f).map(i=>({[i.ioc]: i})));

      // set timeout to give first-time initialization a chance to load default language file
      setTimeout(function() { db.findSetting('defaultIdiom').then(findIdiom, (error) => console.log('error:', error)); }, 2000);

      function findIdiom(idiom={}) { db.findIdiom(idiom.ioc).then(checkIdiom, error=>console.log('error:', error)); }
      function checkIdiom(idiom={ ioc: 'gbr', name: 'English' }) {
         fx.idiomSelectorOptions(idiom.ioc);
         let a = fx.available_idioms[idiom.ioc];
         if (a && a.updated != idiom.updated) {
            displayGen.escapeModal();
            let message = `${lang.tr('phrases.updatedioc')}: ${idiom.name || idiom.ioc}?`;
            displayGen.okCancelMessage(message, updateLanguageFile, () => displayGen.closeModal());
         }
         function updateLanguageFile() {
            coms.sendKey(`${idiom.ioc}.idiom`);
            displayGen.closeModal();
         }
      }
   }

   return fx;

}();

