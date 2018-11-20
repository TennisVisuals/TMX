export const domFx = function() {
   let fx = {};

   let noscroll = undefined;
   let allow_in = undefined;
   let noscroll_enabled = undefined;

   fx.enableNoScroll = () => {
      if (noscroll_enabled) return;
      document.body.addEventListener('wheel', evt => {
         if (noscroll) {
            if (!allow_in) {
               evt.preventDefault();
            } else {
               let allowed = fx.findUpClass(evt.target, allow_in);
               if (!allowed) evt.preventDefault();
            }
         }
      });
      noscroll_enabled = true;
   };

   fx.noScroll = (_boolean, allow_class) => {
      noscroll = _boolean;
      allow_in = allow_class;
   };

   fx.addEventToClass = (cls, fx, node = document, e = 'click') => {
      Array.from(node.querySelectorAll('.' + cls)).forEach(elem => elem.addEventListener(e, fx)); 
   };

   fx.moveNode = (destination_id, source_id) => {
      let source = document.getElementById(source_id);
      let target = source.parentNode.removeChild(source);
      let destination = document.getElementById(destination_id);
      destination.innerHTML = '';
      destination.append(target);
   };

   fx.freezeBody = (_boolean) => { document.body.style.overflow = _boolean ? 'hidden' : null; };

   fx.copyClick = (message) => {
      let c = document.createElement('input');
      c.style.opacity = 0;
      c.setAttribute('id', 'c2c');
      c.setAttribute('type', 'text');
      c.setAttribute('value', message);
      let inp = document.body.appendChild(c);

      let b = document.createElement('button');
      b.style.display = 'none';
      b.setAttribute('data-copytarget', '#c2c');
      b.addEventListener('click', elementCopy, true);
      let elem = document.body.appendChild(b);
      elem.click();
      elem.remove();
      inp.remove();
   };

   function elementCopy(e) {
      let t = e.target;
      let c = t.dataset.copytarget;
      let inp = (c ? document.querySelector(c) : null);

      if (inp && inp.select) {
         inp.select();

         try {
            document.execCommand('copy');
            inp.blur();
         }
         catch (err) { alert('please press Ctrl/Cmd+C to copy'); }
      }
   }

   // https://gist.github.com/cms/369133
   fx.getStyle = (el, styleProp) => {
     var defaultView = (el.ownerDocument || document).defaultView;
     if (defaultView && defaultView.getComputedStyle) {
       styleProp = styleProp.replace(/([A-Z])/g, "-$1").toLowerCase();
       return defaultView.getComputedStyle(el, null).getPropertyValue(styleProp);
     }
   };

   function isOverflowing(el) { return el.scrollWidth > el.clientWidth; }
   fx.scaleFont = (el) => {
      let counter = 0;
      while (isOverflowing(el) && counter < 20) {
         let font_size = el.style.fontSize;
         // let size = font_size.match(/[\.\d]+/)[0];
         let size = font_size.match(/[.\d]+/)[0];
         let units = font_size.match(/[A-Za-z]+/)[0];
         el.style.fontSize = `${size - .1}${units}`;
      }
   };

   fx.getParent = (elem, class_name) => Array.from(elem.classList).indexOf(class_name) >= 0 ? elem : findUpClass(elem, class_name);
   fx.selectParent = (elem, class_name) => {
      let container = fx.getParent(elem, class_name);
      return d3.select(container);
   };
   fx.eachElementClass = (elem, cls, fx) => {
      if (!elem || !cls || !fx || typeof fx != 'function') return;
      try { Array.from(elem.querySelectorAll(`.${cls}`)).forEach(fx); }
      catch (err) { console.log('eachElementClass error:', err); }
   };

   fx.findUpClass = findUpClass;
   function findUpClass(el, class_name) {
      if (el.classList && Array.from(el.classList).indexOf(class_name) >= 0) return el;
      while (el.parentNode) {
         el = el.parentNode;
         if (el.classList && Array.from(el.classList).indexOf(class_name) >= 0) return el;
      }
      return null;
   }

   fx.getChildrenByClassName = getChildrenByClassName;
   function getChildrenByClassName(elem, className) {
     var matches  = [];
     function traverse(node) {
         node.childNodes.forEach(function(child) {
            if (child.childNodes.length > 0) { traverse(child); }
            if (child.classList && Array.from(child.classList).indexOf(className) >= 0) { matches.push(child); }
        });
     }
     traverse(elem);
     return matches;
   }

   fx.swapElements = (obj1, obj2) => {
      // save the location of obj2
      var parent2 = obj2.parentNode;
      var next2 = obj2.nextSibling;
      // special case for obj1 is the next sibling of obj2
      if (next2 === obj1) {
         // just put obj1 before obj2
         parent2.insertBefore(obj1, obj2);
      } else {
         // insert obj2 right before obj1
         obj1.parentNode.insertBefore(obj2, obj1);

         // now insert obj1 where obj2 was
         if (next2) {
            // if there was an element after obj2, then insert obj1 right before that
            parent2.insertBefore(obj1, next2);
         } else {
            // otherwise, just append as last child
            parent2.appendChild(obj1);
         }
      }
   };

   fx.insertAfter = (newNode, referenceNode) => referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
   fx.resizeInput = (elem, padding = 2) => elem.style.width = elem.value.length + padding + "ch";

   return fx;

}();
