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

   let selectTab = ({ root, no, callback, baseclass }) => {
      //update the tab's link
      let ss = Array.from(root.querySelectorAll(`.${baseclass} .tabs > span.selected`));
      ss.forEach(s=>s.classList.remove("selected"));
      let s = root.querySelector(`.${baseclass} .tabs > span:nth-of-type(${no - 1})`)
      if (s) s.classList.add("selected");

      //update the tab (div)
      let st = Array.from(root.querySelectorAll(`.${baseclass} .tab.selected`));
      st.forEach(s=>s.classList.remove("selected"));
      let t = root.querySelector(`.${baseclass} .tab:nth-of-type(${no})`);
      if (t) t.classList.add("selected");
      let reference = t ? t.getAttribute('reference') : '';

      // untested
      if (o.scrollIntoView && document.body.scrollIntoView) document.body.scrollIntoView();

      if (callback && typeof callback == 'function') callback(no - 2, reference);
   }

   jsTabs.load = (el, callback, baseclass='jstabs') => {
      let root = el || document;
      let es = root.querySelectorAll(`.${baseclass} .tabs > span`);
      for (let i = 0; i < es.length; i++) {
          (function (el,idx) {
              let st = () => selectTab({ root, no: idx + 1, baseclass, callback });
              el.addEventListener('click', st);
          })(es[i],i+1);
      }
      let displayTab = (tab=0) => selectTab({ root, no: tab + 2, baseclass });

      // by default display the first tab
      displayTab();

      return displayTab;
   } 

   jsTabs.generate = ({ tabs, shadow=true, baseclass='jstabs' }) => {
      let html = `<div class="${baseclass} ${shadow ? 'shadow' : ''}"><div class='hscroll'><div class="tabs">`;
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
