export const eventManager = function() {

   let em = { elapsed: 100000 };
   let keys = {};
   let registeredFunctions = {};
   let intersection = (a, b) => a.filter(n => b.indexOf(n) !== -1).filter((e, i, c) => c.indexOf(e) === i);

   em.register = (cls, evnt, fx, delay) => {
      if (typeof fx == 'function') {
         if (!registeredFunctions[evnt]) {
            registeredFunctions[evnt] = {};
            keys[evnt] = [];
         }
         registeredFunctions[evnt][cls] = { fx, delay };
         keys[evnt] = Object.keys(registeredFunctions[evnt]);
      }
      return em;
   }
   em.deRegister = (cls, evnt) => {
      if (registeredFunctions[evnt]) {
         delete registeredFunctions[evnt][cls];
         keys[evnt] = Object.keys(registeredFunctions[evnt]);
      }
      return em;
   }
   em.trigger = (cls, evnt, target) => registeredFunctions[evnt][cls].fx(target);
   em.list = () => console.log(registeredFunctions);

   var tapHandler = ('ontouchstart' in document.documentElement ? 'touchstart' : 'click');
   document.addEventListener(tapHandler, evt => processEvnt(evt, 'tap'));

   var last_tap = 0;
   function processEvnt(evt, evnt) {
      let class_list = Array.from(evt.target.classList);
      let cls_matches = class_list.length && keys[evnt] ? intersection(class_list, keys[evnt]) : [];
      if (cls_matches.length) {
         let this_tap = new Date().getTime();
         em.elapsed = this_tap - last_tap;
         last_tap = this_tap;
         cls_matches.forEach(cls => callFunction(cls, evt.target, evnt));
      }
   }

   function callFunction(cls, target, evnt) { registeredFunctions[evnt][cls].fx(target) }

   return em;

}();
