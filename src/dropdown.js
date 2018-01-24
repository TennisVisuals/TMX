!function() {

   let dd = {};

   function findUpClass(elem, class_name) {
      let depth = 1;
      if (Array.from(elem.classList).indexOf(class_name) >= 0) return { elem, depth };
      while (elem.parentNode) {
         elem = elem.parentNode;
         if (elem.classList && Array.from(elem.classList).indexOf(class_name) >= 0) return { elem, depth };
         depth += 1;
      }
      return { elem: null, depth: 0 };
   }

   dd.DropDown = DropDown;
   function DropDown({ element, onChange, css_class, style, id, locked }) {
      this.id = id;
      this.val = '';
      this.el = element;
      this.style = style || [];
      this.locked = locked;
      this.class = css_class;
      this.list = this.el.querySelector(".dd_state");
      this.opts = this.list ? this.list.querySelectorAll('li') : [];
      this.label = this.el.querySelector("div:first-of-type");
      this.options = this.el.querySelector(".options");
      this.selection = this.list ? this.list.querySelector("span:first-of-type") : undefined;
      if (typeof onChange == 'function') this.onChange = onChange;
      this.initEvents();
   }

   function addClick(obj) {
      if (!obj.el.ddclick) {
         obj.el.ddclick = true;
         obj.el.addEventListener("click", e => {
            if (obj.locked) return;

            // determine click position relative to ddlb elements
            let { elem: dd_state, depth: dd_state_depth } = findUpClass(e.target, 'dd_state');
            let { elem: option, depth: option_depth } = findUpClass(e.target, 'dd_option');

            let actv = dd_state && Array.from(dd_state.classList).indexOf('active') >= 0;

            dd.closeAllDropDowns(obj.class);

            // active ddlb if option not found or dd_state found before option
            if (dd_state && (!option_depth || dd_state_depth < option_depth)) dd_state.classList[actv ? 'remove' : 'add']("active")

            // prevent the click from propagating to the document
            e.stopPropagation();
         });
      }
   }

   function addOptClicks(obj) {
      Array.from(obj.opts).forEach((opt, i) => {
         opt.addEventListener("click", e => {
            obj.list.classList.remove("active");
            let key = opt.querySelector("span:first-of-type");
            let value = key.getAttribute("value");
            obj.selection.innerHTML = key.innerHTML;
            let changed = obj.val != value;
            obj.val = value;
            if (changed && obj.onChange) {
               obj.onChange(value);
               obj.selectionBackground();
               obj.labelColor();
            }
         });
      });
   }

   function optionHTML(option, style) {
      return `<li class='dd_option' title='${option.name || option.value}'><span value="${option.value}" style="${style}">${option.key}</span></li>`;
   }

   DropDown.prototype = {
       initEvents() {
           let obj = this;
           obj.el.style.display = 'flex';
           addClick(obj);
           addOptClicks(obj);
       },
       getStyle(attr, value) { if (this.style) return this.style[attr]; },
       setStyle(attr, value) { if (attr && value) this.style[attr] = value; },
       getValue() { return this.val; },
       setId(id) { this.id = id; },
       getId() { return this.id; },
       lock() { this.locked = true },
       unlock() { this.locked = false },
       setOptions(options, style='') {
          if (!Array.isArray(options) || !options.length || !this.list) return;
          let list = this.list.querySelector('ul');
          if (!list) return;
          list.innerHTML = options.map(option=>optionHTML(option, style)).join('');
          this.options = options; 
          this.opts = this.list.querySelectorAll('li');
          addOptClicks(this);
          return this;
       },
       getOptions() { 
          return Array.from(this.opts).map(o => {
             let e = o.querySelector('span:first-of-type');
             return { key: e.innerHTML, value: e.getAttribute('value') }
          }); 
       },
       setValue(value) { 
          let options = Array.from(this.opts).filter(o => o.querySelector('span:first-of-type').getAttribute('value') == value);
          let html = (options.length) ? options[0].querySelector('span').innerHTML : value;
          this.val = value;
          if (this.selection) {
             this.selection.innerHTML = html;
             this.selectionBackground();
             this.labelColor();
          }
       },
       selectionBackground(color) { 
          if (!this.selection) return;
          this.selection.style.background = this.val != undefined ? (color || this.getStyle('selection_value') || '#FFF') : (this.getStyle('selection_novalue') || '#FFF'); 
       },
       labelColor() { 
          this.label.style.color = this.val != undefined ? (this.getStyle('label_value') || '#000') : (this.getStyle('label_novalue') || '#f00'); 
       },
       borderColor(color = '#000') {
          this.options.style.border = `1px solid ${color}`;
       },
   }

   let dropDownHTML = (label, options = [], selected, border=true, style) => {
      let selected_option = selected != undefined && options[selected] ? options[selected].key : '';
      let options_style = border ? "style='border: 1px solid #000;'" : "";
      let options_html = options.map(option => optionHTML(option, style)).join('');
      let html = `
         <div class='label'>${label}</div>
         <div class='options' ${options_style}>
            <ul>
               <li class='dd_state'>
                  <span class='active'>${selected_option}</span>
                  <div>
                     <ul>
                     ${options_html}
                     </ul>
                  </div>
               </li>
            </ul>
         </div>`;
      return html;
   }

   dd.attachDropDown = ({id, label = '', options, selected = 0, css_class, border, style}) => {
      let element = document.getElementById(id);
      // elements will not be visible until new DropDown()
      element.style.display = 'none';
      element.classList.add(css_class || "dd");
      element.innerHTML = dropDownHTML(label, options, selected, border, style);
   }

   dd.closeAllDropDowns = (css_class) => {
      let elems = document.querySelectorAll('li.dd_state.active');
      Array.from(elems).forEach(elem => { elem.classList.remove('active'); })
   }

   document.addEventListener("click", () => dd.closeAllDropDowns());

   if (typeof define === "function" && define.amd) define(dd); else if (typeof module === "object" && module.exports) module.exports = dd;
   this.dd = dd;
 
}();
