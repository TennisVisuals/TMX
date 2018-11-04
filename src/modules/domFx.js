export const domFx = function() {
   let fx = {};

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
   }
   fx.eachElementClass = (elem, cls, fx) => {
      if (!elem || !cls || !fx || typeof fx != 'function') return;
      try { Array.from(elem.querySelectorAll(`.${cls}`)).forEach(fx); }
      catch (err) { console.log('eachElementClass error:', err); }
   };

   fx.findUpClass = findUpClass;
   function findUpClass(el, class_name) {
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
   return fx;

}();
