import { Diacritics } from './Diacritics';
import { cleanScore } from './cleanScore';

export const util = function() {
   let util = {};

   util.get = R.prop('tasks');

   util.clearHistory = () => { history.pushState('', document.title, window.location.pathname); }

   util.HHMMSS = (s, format) => {
      var sec_num = parseInt(s, 10); // don't forget the second param
      var hours   = Math.floor(sec_num / 3600);
      var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
      var seconds = sec_num - (hours * 3600) - (minutes * 60);

      let display_seconds = !format || (format && format.display_seconds);
      let pad_hours = !format || (format && format.pad_hours);
      if (hours   < 10 && pad_hours) {hours   = "0"+hours;}
      if (minutes < 10) {minutes = "0"+minutes;}
      if (seconds < 10) {seconds = "0"+seconds;}
      return display_seconds ? hours+':'+minutes+':'+seconds : hours+':'+minutes;
   }

   util.replaceDiacritics = (text) => Diacritics.replace(text);
   util.nameHash = (name) => util.replaceDiacritics(name.replace(/[-_,.\ ]+/g, "")).toLowerCase();

   util.parseInt = (value) => {
      let result = parseInt(value);
      return isNaN(result) ? undefined : result;
   }

   util.normalizeScore = (score) => {
      let clean_score = cleanScore.normalize(score);
      if (clean_score) return clean_score.join(' ');
      alert(`Score can't be normalized: ${score}`);
      return score;
   }

   util.string2boolean = (string) => {
      if (typeof string == 'boolean') return string;
      if (string === 'true') return true;
      if (string === 'false') return false;
   }

   util.weekDays = (date) => {
      let dates = [0, 1, 2, 3, 4, 5, 6].map(i => dayOfWeek(date, i));
      return dates;

      function dayOfWeek(date, index) {
        let d = new Date(date);
        let day = d.getDay();
        let diff = index - day;
        return new Date(d.setDate(d.getDate() + diff));
      }
            
   }

   util.ymd2date = ymd2date;
   function ymd2date(ymd) {
      let parts = ymd.split('-');
      if (!parts || parts.length != 3) return new Date(ymd);
      if (isNaN(parseInt(parts[1]))) return new Date(ymd);
      return new Date(parts[0], parseInt(parts[1]) - 1, parts[2]);
   }

   util.formatDate = formatDate;
   function formatDate(date, separator = '-', format='YMD') {
      if (!date) return '';
      if (!isNaN(date)) date = util.offsetTime(date);

      let d = new Date(date);
      let month = '' + (d.getMonth() + 1);
      let day = '' + d.getDate();
      let year = d.getFullYear();

      if (month.length < 2) month = '0' + month;
      if (day.length < 2) day = '0' + day;

      if (format == 'DMY') return [day, month, year].join(separator);
      if (format == 'MDY') return [month, day, year].join(separator);
      if (format == 'YDM') return [year, day, month].join(separator);
      if (format == 'DYM') return [day, year, month].join(separator);
      if (format == 'MYD') return [month, year, day].join(separator);
      return [year, month, day].join(separator);
   }

   util.performTask = (fx, data, bulkResults = true) => {
      return new Promise(function(resolve, reject) {
         let results = [];
         if (!data.length) return reject();
         nextItem();

         function nextItem() {
            if (!data.length) return resolve(results);
            let params = data.pop();
            if (!params) {
               nextItem();
            } else {
               fx(params).then(delayNext, handleError);
            }
         }

         function handleError(result) { delayNext(result); }
         function delayNext(result) { 
            if (bulkResults) results.push(result);
            nextItem();
         }
      });
   }

   util.normalizeName = (name, noaccents = true) => {
      if (!name) { return ''; }
      var particles = ['del', 'de', 'di', 'du', 'van', 'von', 'ten']; 
      if (noaccents) name = util.replaceDiacritics(name.trim());
      name = name.replace(/\s+/g,' ').trim();
      var nNames = name.split(' ').map(m => m.toLowerCase());

      var nName = nNames.map(function(m, i) { 
         if (i == 0 || i == nNames.length - 1 || particles.indexOf(m.toLowerCase()) < 0) m = m ? m[0].toUpperCase() + m.slice(1) : '';
         return m; 
      }).join(' ');

      return supportApostrophe(nName);

      function supportApostrophe(name) {
         var s_name = name.split(' ');
         var mod_name = s_name.map(n => {
            if (n.length > 2 && n[1] == "'") {
               n = replaceAt(n, 2, n[2].toUpperCase());
               if (n[0] == 'D') { n = replaceAt(n, 0, 'd'); }
            }
            return n;
         });
         return mod_name.join(' ');
      }

      function replaceAt(s, n, t) { return s.substring(0, n) + t + s.substring(n + 1); }
   }

   util.keyWalk = keyWalk;
   function keyWalk(valuesObject, optionsObject) {
      if (!valuesObject || !optionsObject) return;
      var vKeys = Object.keys(valuesObject);
      var oKeys = Object.keys(optionsObject);
      for (var k=0; k < vKeys.length; k++) {
          if (oKeys.indexOf(vKeys[k]) >= 0) {
              var oo = optionsObject[vKeys[k]];
              var vo = valuesObject[vKeys[k]];
              if (oo && typeof oo == 'object' && typeof vo !== 'function' && oo.constructor !== Array) {
                  keyWalk(valuesObject[vKeys[k]], optionsObject[vKeys[k]]);
              } else {
                  optionsObject[vKeys[k]] = valuesObject[vKeys[k]];
              }
          }
      }
   }

   util.boolAttrs = boolAttrs;
   function boolAttrs(optionsObject) {
      if (!optionsObject) return;
      var oKeys = Object.keys(optionsObject);
      for (var k=0; k < oKeys.length; k++) {
        var oo = optionsObject[oKeys[k]];
        if (oo && typeof oo == 'object' && typeof oo != 'function' && oo.constructor !== Array) {
            boolAttrs(optionsObject[oKeys[k]]);
        } else {
            if (oo && oo.toString().toLowerCase() === 'true') {
               optionsObject[oKeys[k]] = true;
            } else if (oo != undefined && oo.toString().toLowerCase() === 'false') {
               optionsObject[oKeys[k]] = false;
            } else if (!isNaN(oo)) {
               optionsObject[oKeys[k]] = parseInt(oo);
            }
        }
      }
   }

   util.fxAttrs = fxAttrs;
   function fxAttrs(optionsObject) {
      if (!optionsObject) return;
      var oKeys = Object.keys(optionsObject);
      for (var k=0; k < oKeys.length; k++) {
        var oo = optionsObject[oKeys[k]];
        if (typeof oo == 'object') {
            fxAttrs(optionsObject[oKeys[k]]);
        } else {
            if (oKeys[k] == 'fx' && typeof oo == 'string') {
               try { optionsObject.fx = createFx(optionsObject.fx); }
               catch (err) { util.logError(err); }
            }
        }
      }
   }

   // DOM
   util.getParent = (elem, class_name) => Array.from(elem.classList).indexOf(class_name) >= 0 ? elem : findUpClass(elem, class_name);
   util.eachElementClass = (elem, cls, fx) => {
         if (!elem || !cls || !fx || typeof fx != 'function') return;
         try { Array.from(elem.querySelectorAll(`.${cls}`)).forEach(fx); }
         catch (err) { console.log('eachElementClass error:', err); }
      }

   /*
   util.selectParent = (elem, class_name) => {
      let container = util.getParent(elem, class_name);
      return d3.select(container);
   }
   */

   util.findUpClass = findUpClass;
   function findUpClass(el, class_name) {
      while (el.parentNode) {
         el = el.parentNode;
         if (el.classList && Array.from(el.classList).indexOf(class_name) >= 0) return el;
      }
      return null;
   }

   util.getChildrenByClassName = getChildrenByClassName;
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

   util.addEventToClass = (cls, fx, node = document, e = 'click') => {
      Array.from(node.querySelectorAll('.' + cls)).forEach(elem => elem.addEventListener(e, fx)); 
   }

   // Miscellaneous Functions
   util.zeroPad = (number) => number.toString()[1] ? number : "0" + number;
   util.numeric = (value) => value && !isNaN(value) ? parseInt(value.toString().trim()) : 0;
   util.numericFloat = (value) => value && !isNaN(value) ? parseFloat(value.toString().trim()) : 0;
   util.containsNumber = (value) => /\d/.test(value);
   util.isMember = (list, m) => list.reduce((p, c) => c == m || p, false);
   util.unique = (arr) => arr.filter((item, i, s) => s.lastIndexOf(item) == i);
   util.uunique = (arr) => Object.keys(Object.assign({}, ...arr.map(a=>({[a]:true}))));
   util.subSort = (arr, i, n, sortFx) => [].concat(...arr.slice(0, i), ...arr.slice(i, i + n).sort(sortFx), ...arr.slice(i + n, arr.length));
   util.inPlaceSubSort = (arr, i, n, sortFx) => {
      let newarray = [].concat(...arr.slice(0, i), ...arr.slice(i, i + n).sort(sortFx), ...arr.slice(i + n, arr.length));
      arr.length = 0;
      arr.push.apply(arr, newarray);
      return arr;
   }
   util.arrayMap = (array) => new Map([...new Set(array)].map( x => [x, array.filter(y => y === x).length]));
   util.arrayCount = (array) => array.reduce((r,k) => { r[k] = ++r[k] || 1; return r},{});
   util.occurrences = (val, arr) => arr.reduce((r,val) => { r[val] = 1+r[val] || 1; return r},{})[val] || 0;
   util.intanceCount = (values) => values.reduce((a, c)=>{a[c]++?0:a[c]=1;return a},{});
   util.indices = (val, arr) => arr.reduce((a, e, i) => { if (e === val) a.push(i); return a; }, []) 
   util.randomPop = (array) => array.length ? array.splice(Math.floor(Math.random()*array.length), 1)[0] : undefined;

   util.hashReduce = (arr) => {
      return arr.reduce((l, c) => {
         let hash = c.sort().join('|');
         if (l.indexOf(hash) < 0) l.push(hash);
         return l;
      }, []).map(r=>r.split('|'));
   }

   // util.missingNumbers = (a) => Array.from(Array(Math.max(...a)).keys()).map((n, i) => a.indexOf(i) < 0? i : null).filter(f=>f);
   util.missingNumbers = (a, l=true) => Array.from(Array(Math.max(...a)).keys()).map((n, i) => a.indexOf(i) < 0  && (!l || i > Math.min(...a)) ? i : null).filter(f=>f);
   util.range = (start, end) => Array.from({length: (end - start)}, (v, k) => k + start);
   util.numArr = (count) => [...Array(count)].map((_, i) => i);
   util.intersection = (a, b) => a.filter(n => b.indexOf(n) !== -1).filter((e, i, c) => c.indexOf(e) === i);
   util.chunkArray = (arr, chunksize) => {
      return arr.reduce((all,one,i) => {
         const ch = Math.floor(i/chunksize); 
         all[ch] = [].concat((all[ch]||[]),one); 
         return all
      }, [])
   }

   util.passFail = (array, conditionFx) => {
      let result = { pass: [], fail: [] };
      array.forEach(item => result[conditionFx(item) ? 'pass' : 'fail'].push(item));
      return result;
   }

   util.swapElements = (obj1, obj2) => {
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
   }
   util.moveNode = (destination_id, source_id) => {
      let source = document.getElementById(source_id);
      let target = source.parentNode.removeChild(source);
      let destination = document.getElementById(destination_id);
      destination.innerHTML = '';
      destination.append(target);
   }
   util.log2 = (val) => Math.log(val) / Math.LN2;
   util.nearestPow2 = (val) => Math.pow(2, Math.round( Math.log(val) / Math.log(2)));

   util.offsetDate = (date) => {
      var targetTime = date ? new Date(date) : new Date();
      var tzDifference = targetTime.getTimezoneOffset();
      return new Date(targetTime.getTime() + tzDifference * 60 * 1000);
   }

   util.offsetTime = (date) => util.offsetDate(date).getTime();

   util.validDate = (datestring, range) => {
      if (!datestring) return false;
      let dateparts = formatDate(datestring).split('-');
      if (isNaN(dateparts.join(''))) return false;
      if (dateparts.length != 3) return false;
      if (dateparts[0].length != 4) return false;
      if (+dateparts[1] > 12 || +dateparts[1] < 1) return false;
      if (+dateparts[2] > 31 || +dateparts[2] < 1) return false;
      if (range && range.start) { if (util.offsetDate(datestring) < util.offsetDate(range.start)) return false; }
      if (range && range.end) { if (util.offsetDate(datestring) > util.offsetDate(range.end)) return false; }
      return true;
   }

   util.isDate = (dateArg) => {
      if (typeof dateArg == 'boolean') return false;
      var t = (dateArg instanceof Date) ? dateArg : !isNaN(dateArg) ? new Date(dateArg) : false;
      return t && !isNaN(t.valueOf());
   }

   function isValidDateRange(minDate, maxDate) {
      return (util.offsetDate(minDate) <= util.offsetDate(maxDate));
   }

   util.timeUTC = (date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());

   util.dateRange = (startDt, endDt) => {
       var error = ((util.isDate(endDt)) && (util.isDate(startDt)) && isValidDateRange(startDt, endDt)) ? false : true;
       var between = [];
       if (error) {
          console.log('error occured!!!... Please Enter Valid Dates');
       } else {
           var currentDate = util.offsetDate(startDt);
           var end = util.offsetDate(endDt);
           while (currentDate <= end) {
              // must be a *new* Date otherwise it is an array of the same object
              between.push(new Date(currentDate));
              currentDate.setDate(currentDate.getDate() + 1);
           }
       }
       return between;
   }

   util.sameDay = (d1, d2) => {
     return d1.getFullYear() === d2.getFullYear() &&
       d1.getMonth() === d2.getMonth() &&
       d1.getDate() === d2.getDate();
   }

   util.catchTab = (evt) => { if (evt.which == 9) { evt.preventDefault(); } }
   util.isOverflowing = (el) => { return el.scrollWidth > el.clientWidth; }
   util.scaleFont = (el) => {
      let counter = 0;
      while (util.isOverflowing(el) && counter < 20) {
         let font_size = el.style.fontSize;
         let size = font_size.match(/[\.\d]+/)[0];
         let units = font_size.match(/[A-Za-z]+/)[0];
         el.style.fontSize = `${size - .1}${units}`;
      }
   }

   util.createFx = createFx;
   function createFx(str) {
      var startBody = str.indexOf('{') + 1;
      var endBody = str.lastIndexOf('}');
      var startArgs = str.indexOf('(') + 1;
      var endArgs = str.indexOf(')');
      return new Function(str.substring(startArgs, endArgs), str.substring(startBody, endBody));
   }

   util.powerOfTwo = (n) => {
      if (isNaN(n)) return false; 
      return n && (n & (n - 1)) === 0;
   }

   // https://gist.github.com/cms/369133
   util.getStyle = (el, styleProp) => {
     var value, defaultView = (el.ownerDocument || document).defaultView;
     if (defaultView && defaultView.getComputedStyle) {
       styleProp = styleProp.replace(/([A-Z])/g, "-$1").toLowerCase();
       return defaultView.getComputedStyle(el, null).getPropertyValue(styleProp);
     }
   }

   util.logError = (err) => console.log(err);

   return util;
}();
