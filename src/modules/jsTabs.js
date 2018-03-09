// TODO: on resize how to manage tab text size and wrapping of tabs to more than a single line?

export const jsTabs = function() {

   // TODO: rewrite this so that it is a factory such that 'events' can be
   // defined as in the D3 Components...

   let jsTabs = {};

   let tab_array;

   // TODO: future configuration options
   let o = {
      scrollIntoView: false,
   }

   /*
   function indexOfElem(elem){
       let  i = 0;
       let desiredNodeType = elem.nodeType;
       while((elem=elem.previousSibling)!=null) {if(elem.nodeType===desiredNodeType)i++;}
       return i;
   }
   */

   let selectTab = (root, no, callback) => {
      //update the tab's link
      let e = root.querySelector(".jstabs .tabs > span.selected");
      if (e) e.classList.remove("selected");
      e = root.querySelector(".jstabs .tabs > span:nth-of-type(" + (no - 1) + ")")
      if (e) e.classList.add("selected");

      //update the tab (div)
      e = root.querySelector(".jstabs .tab.selected");
      if (e) e.classList.remove("selected");
      e = root.querySelector(".jstabs .tab:nth-of-type(" + no + ")");
      if (e) e.classList.add("selected");
      let reference = e ? e.getAttribute('reference') : '';

      // untested
      if (o.scrollIntoView && document.body.scrollIntoView) document.body.scrollIntoView();

      if (callback && typeof callback == 'function') callback(no - 2, reference);
   }

   jsTabs.load = (el, callback) => {
      let root = el || document;
      let es = root.querySelectorAll(".jstabs .tabs > span");
      for (let i = 0; i < es.length; i++) {
          (function (el,idx) {
              let st = () => selectTab(root, idx + 1, callback);
              el.addEventListener('click', st);
          })(es[i],i+1);
      }
      let displayTab = (tab=0) => selectTab(root, tab + 2);

      // by default display the first tab
      displayTab();

      return displayTab;
   } 

   jsTabs.generate = (tabs) => {
      let html = `<div class="jstabs"><div class='hscroll'><div class="tabs">`;
      html += tabs.map(o => {
         let id = o.id ? ` id="${o.id}"` : '';
         let display = o.display || 'inline';
         return `<span${id} style="display: ${display}">${o.tab}</span>`
      }).join('');
      html += `</div></div>`;
      html += tabs.map(o => {
         let reference = o.ref ? ` reference='${o.ref}'` : '';
         return `<div class="tab"${reference}>${o.content}</div>`;
      }).join('');
      html += `</div>`;
      return html;
   }

   return jsTabs;
}();
