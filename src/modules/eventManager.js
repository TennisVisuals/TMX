export const eventManager = function() {

   let touchTimer;
   let em = {
      elapsed: 100000,
      held: undefined,
      touched: undefined,
      hold_time: 800,
      holdAction: undefined,
      holdActions: {}
   };
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
   em.trigger = (cls, evnt, target, mouse) => registeredFunctions[evnt][cls].fx(target, mouse);
   em.list = () => console.log(registeredFunctions);

   var tapHandler = ('ontouchstart' in document.documentElement ? 'touchstart' : 'click');
   document.addEventListener(tapHandler, evt => processEvnt(evt, 'tap'));

   var last_tap = 0;
   function processEvnt(evt, evnt) {
      var mouse = { x: evt.clientX, y: evt.clientY }
      let class_list = Array.from(evt.target.classList);
      let cls_matches = class_list.length && keys[evnt] ? intersection(class_list, keys[evnt]) : [];
      if (cls_matches.length) {
         let this_tap = new Date().getTime();
         em.elapsed = this_tap - last_tap;
         last_tap = this_tap;
         cls_matches.forEach(cls => callFunction(cls, evt.target, evnt, mouse));
      }
   }

   function callFunction(cls, target, evnt, mouse) { registeredFunctions[evnt][cls].fx(target, mouse) }

   document.addEventListener('touchstart', function(event) {
      em.touched = event.target;
      em.coords = [event.touches[0].clientX, event.touches[0].clientY];
      if (em.touched) { touchTimer = setTimeout(function(){ holdAction(); }, em.hold_time); }
   }, false);
   document.addEventListener('touchend', function(event) { touchleave(); }, false);
   document.addEventListener('touchmove', function(event) { if (em.touched !== event.target) touchleave(); }, false);
   function touchleave() { clearTimeout(touchTimer) }
   function holdAction() { if (typeof em.holdAction == 'function') { em.held = em.touched; em.holdAction(em.held, em.coords); } }

   (function(){
      var isTouch = false; //var to indicate current input type (is touch versus no touch) 
      var isTouchTimer; 
      var curRootClass = ''; //var indicating current document root class ("can-touch" or "")
        
      function addtouchclass(e) {
         // console.log('adding touch class');
         clearTimeout(isTouchTimer)
         isTouch = true;
         if (curRootClass != 'can-touch') { //add "can-touch' class if it's not already present
            curRootClass = 'can-touch'
            document.documentElement.classList.add(curRootClass)
         }
         isTouchTimer = setTimeout(function(){isTouch = false}, 500) //maintain "istouch" state for 500ms so removetouchclass doesn't get fired immediately following a touch event
      }
        
      function removetouchclass(e) {
         // console.log('removing touch class');
         if (!isTouch && curRootClass == 'can-touch') { //remove 'can-touch' class if not triggered by a touch event and class is present
            isTouch = false;
            curRootClass = '';
            document.documentElement.classList.remove('can-touch');
         }
      }
        
      document.addEventListener('touchstart', addtouchclass, false); //this event only gets called when input type is touch
      document.addEventListener('mouseover', removetouchclass, false); //this event gets called when input type is everything from touch to mouse/ trackpad
   })();

   return em;

}();
