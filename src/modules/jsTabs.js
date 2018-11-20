export const jsTabs = function() {

   // TODO: rewrite this so that it is a factory such that 'events' can be defined as in the D3 Components...

   let jsTabs = {};
   let defaults = {
      baseclass: 'jstabs',
      // container: 'hscroll',
      // listclass: 'jst'
      container: 'tabs is-marginless',
      listclass: 'jhook'
   };

   // TODO: future configuration options
   let o = {
      scrollIntoView: false
   };

   let selectTab = ({ root, no, callback, baseclass, listclass }) => {
      //update the tab's link
      let ss = Array.from(root.querySelectorAll(`.${baseclass} .${listclass} > li.is-active`));
      ss.forEach(s=>s.classList.remove("is-active"));
      let s = root.querySelector(`.${baseclass} .${listclass} > li:nth-of-type(${no - 1})`);
      if (s) s.classList.add("is-active");

      //update the tab (div)
      let st = Array.from(root.querySelectorAll(`.${baseclass} .jstab.is-active`));
      st.forEach(s=>s.classList.remove("is-active"));
      let t = root.querySelector(`.${baseclass} .jstab:nth-of-type(${no})`);
      if (t) t.classList.add("is-active");
      let reference = t ? t.getAttribute('reference') : '';

      // untested
      if (o.scrollIntoView && document.body.scrollIntoView) document.body.scrollIntoView();

      if (callback && typeof callback == 'function') callback(no - 2, reference);
   };

   jsTabs.load = ({ el, callback, baseclass=defaults.baseclass, listclass=defaults.listclass, tab }) => {
      let root = el || document;
      let es = root.querySelectorAll(`.${baseclass} .${listclass} > li`);
      for (let i = 0; i < es.length; i++) {
          (function (el,idx) {
              let st = () => selectTab({ root, no: idx + 1, baseclass, listclass, callback });
              el.addEventListener('click', st);
          })(es[i],i+1);
      }
      let displayTab = (t=0) => selectTab({ root, no: t + 2, baseclass, listclass });

      // by default display the first tab
      displayTab(tab || 0);

      return displayTab;
   };

   // TODO: complete position code to enable tabs to be top or bottom
   jsTabs.generate = ({ tabs, shadow=true, baseclass=defaults.baseclass, position='top', container=defaults.container, listclass=defaults.listclass }) => {
      let tabs_html = `
         <div class="${baseclass} ${shadow ? 'shadow' : ''}" style="width: inherit;">
            <div class='${container}'>
               <ul class='${listclass}'>
      `;
      tabs_html += tabs.map(o => {
         let id = o.id ? ` id="${o.id}"` : '';
         let display = o.display || 'inline';
         return `<li${id} style="display: ${display}"><a>${o.tab}</a></li>`;
      }).join('');
      tabs_html += `</ul></div>`;
      let content_html = tabs.map(o => {
         let reference = o.ref ? ` reference='${o.ref}'` : '';
         return `<div class="jstab"${reference}>${o.content}</div>`;
      }).join('');
      content_html += `</div>`;
      return position == 'top' ? tabs_html + content_html : content_html + tabs_html;
   };

   return jsTabs;
}();
