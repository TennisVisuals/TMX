import { Diacritics } from './Diacritics';
import { cleanScore } from './cleanScore';

export const util = function() {
   let fx = {};

   fx.clearHistory = () => { history.pushState('', document.title, window.location.pathname); }

   fx.HHMMSS = (s, format) => {
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

   fx.replaceDiacritics = (text) => Diacritics.replace(text);
   fx.nameHash = (name) => fx.replaceDiacritics(name.replace(/[-_,.\ ]+/g, "")).toLowerCase();

   fx.parseInt = (value) => {
      let result = parseInt(value);
      return isNaN(result) ? undefined : result;
   }

   fx.normalizeScore = (score) => {
      let clean_score = cleanScore.normalize(score);
      if (clean_score) return clean_score.join(' ');
      alert(`Score can't be normalized: ${score}`);
      return score;
   }

   fx.string2boolean = (string) => {
      if (typeof string == 'boolean') return string;
      if (string === 'true') return true;
      if (string === 'false') return false;
   }

   fx.weekDays = (date) => {
      let dates = [0, 1, 2, 3, 4, 5, 6].map(i => dayOfWeek(date, i));
      return dates;

      function dayOfWeek(date, index) {
        let d = new Date(date);
        let day = d.getDay();
        let diff = index - day;
        return new Date(d.setDate(d.getDate() + diff));
      }
            
   }

   fx.formatDate = (date, separator = '-') => {
      if (!date) return '';

      let d = new Date(date),
         month = '' + (d.getMonth() + 1),
         day = '' + d.getDate(),
         year = d.getFullYear();

      if (month.length < 2) month = '0' + month;
      if (day.length < 2) day = '0' + day;

      return [year, month, day].join(separator);
   }

   fx.performTask = (fx, data, bulkResults = true) => {
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

   fx.normalizeName = (name, noaccents = true) => {
      if (!name) { return ''; }
      var particles = ['del', 'de', 'di', 'du', 'van', 'von', 'ten']; 
      if (noaccents) name = fx.replaceDiacritics(name.trim());
      name = name.replace(/\s+/g,' ').trim();
      var nNames = name.split(' ').map(m => m.toLowerCase());

      var nName = nNames.map(function(m, i) { 
         if (i == 0 || i == nNames.length - 1 || particles.indexOf(m.toLowerCase()) < 0) m = m[0].toUpperCase() + m.slice(1); 
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

   fx.keyWalk = keyWalk;
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

   fx.boolAttrs = boolAttrs;
   function boolAttrs(optionsObject) {
      if (!optionsObject) return;
      var oKeys = Object.keys(optionsObject);
      for (var k=0; k < oKeys.length; k++) {
        var oo = optionsObject[oKeys[k]];
        if (typeof oo == 'object' && typeof vo !== 'function' && oo.constructor !== Array) {
            boolAttrs(optionsObject[oKeys[k]]);
        } else {
            if (oo === 'true' || oo == true) {
               optionsObject[oKeys[k]] = true;
            } else if (oo === 'false' || oo == false) {
               optionsObject[oKeys[k]] = false;
            } else if (!isNaN(oo)) {
               optionsObject[oKeys[k]] = parseInt(oo);
            }
        }
      }
   }

   // DOM
   fx.getParent = (elem, class_name) => Array.from(elem.classList).indexOf(class_name) >= 0 ? elem : findUpClass(elem, class_name);

   /*
   fx.selectParent = (elem, class_name) => {
      let container = fx.getParent(elem, class_name);
      return d3.select(container);
   }
   */

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

   fx.addEventToClass = (cls, fx, node = document, e = 'click') => {
      Array.from(node.querySelectorAll('.' + cls)).forEach(elem => elem.addEventListener(e, fx)); 
   }

   // Miscellaneous Functions
   fx.zeroPad = (number) => number.toString()[1] ? number : "0" + number;
   fx.numeric = (value) => value && !isNaN(value) ? parseInt(value.toString().trim()) : 0;
   fx.containsNumber = (value) => /\d/.test(value);
   fx.isMember = (list, m) => list.reduce((p, c) => c == m || p, false);
   fx.unique = (arr) => arr.filter((item, i, s) => s.lastIndexOf(item) == i);
   fx.uunique = (arr) => Object.keys(Object.assign({}, ...arr.map(a=>({[a]:true}))));
   fx.subSort = (arr, i, n, sortFx) => [].concat(...arr.slice(0, i), ...arr.slice(i, i + n).sort(sortFx), ...arr.slice(i + n, arr.length));
   fx.inPlaceSubSort = (arr, i, n, sortFx) => {
      let newarray = [].concat(...arr.slice(0, i), ...arr.slice(i, i + n).sort(sortFx), ...arr.slice(i + n, arr.length));
      arr.length = 0;
      arr.push.apply(arr, newarray);
      return arr;
   }
   fx.arrayMap = (array) => new Map([...new Set(array)].map( x => [x, array.filter(y => y === x).length]));
   fx.arrayCount = (array) => array.reduce((r,k) => { r[k] = ++r[k] || 1; return r},{});
   fx.occurrences = (val, arr) => arr.reduce((r,val) => { r[val] = 1+r[val] || 1; return r},{})[val] || 0;
   fx.intanceCount = (values) => values.reduce((a, c)=>{a[c]++?0:a[c]=1;return a},{});
   fx.indices = (val, arr) => arr.reduce((a, e, i) => { if (e === val) a.push(i); return a; }, []) 
   fx.randomPop = (array) => array.length ? array.splice(Math.floor(Math.random()*array.length), 1)[0] : undefined;

   fx.hashReduce = (arr) => {
      return arr.reduce((l, c) => {
         let hash = c.sort().join('|');
         if (l.indexOf(hash) < 0) l.push(hash);
         return l;
      }, []).map(r=>r.split('|'));
   }

   // fx.missingNumbers = (a) => Array.from(Array(Math.max(...a)).keys()).map((n, i) => a.indexOf(i) < 0? i : null).filter(f=>f);
   fx.missingNumbers = (a, l=true) => Array.from(Array(Math.max(...a)).keys()).map((n, i) => a.indexOf(i) < 0  && (!l || i > Math.min(...a)) ? i : null).filter(f=>f);
   fx.range = (start, end) => Array.from({length: (end - start)}, (v, k) => k + start);
   fx.numArr = (count) => [...Array(count)].map((_, i) => i);
   fx.intersection = (a, b) => a.filter(n => b.indexOf(n) !== -1).filter((e, i, c) => c.indexOf(e) === i);

   fx.passFail = (array, conditionFx) => {
      let result = { pass: [], fail: [] };
      array.forEach(item => result[conditionFx(item) ? 'pass' : 'fail'].push(item));
      return result;
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
   }
   fx.moveNode = (destination_id, source_id) => {
      let source = document.getElementById(source_id);
      let target = source.parentNode.removeChild(source);
      let destination = document.getElementById(destination_id);
      destination.innerHTML = '';
      destination.append(target);
   }
   fx.log2 = (val) => Math.log(val) / Math.LN2;
   fx.nearestPow2 = (val) => Math.pow(2, Math.round( Math.log(val) / Math.log(2)));

   fx.validDate = (datestring, range) => {
      if (!datestring) return false;
      let dateparts = fx.formatDate(datestring).split('-');
      if (isNaN(dateparts.join(''))) return false;
      if (dateparts.length != 3) return false;
      if (dateparts[0].length != 4) return false;
      if (+dateparts[1] > 12 || +dateparts[1] < 1) return false;
      if (+dateparts[2] > 31 || +dateparts[2] < 1) return false;
      if (range && range.start) { if (new Date(datestring) < new Date(range.start)) return false; }
      if (range && range.end) { if (new Date(datestring) > new Date(range.end)) return false; }
      return true;
   }

   fx.isDate = (dateArg) => {
      if (typeof dateArg == 'boolean') return false;
      var t = (dateArg instanceof Date) ? dateArg : !isNaN(dateArg) ? new Date(dateArg) : false;
      return t && !isNaN(t.valueOf());
   }

   function isValidDateRange(minDate, maxDate) {
      return (new Date(minDate) <= new Date(maxDate));
   }

   fx.dateUTC = (date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());

   fx.dateRange = (startDt, endDt) => {
       var error = ((fx.isDate(endDt)) && (fx.isDate(startDt)) && isValidDateRange(startDt, endDt)) ? false : true;
       var between = [];
       if (error) {
          console.log('error occured!!!... Please Enter Valid Dates');
       } else {
           var currentDate = new Date(startDt);
           var end = new Date(endDt);
           while (currentDate <= end) {
               between.push(new Date(currentDate));
               currentDate.setDate(currentDate.getDate() + 1);
           }
       }
       return between;
   }

   fx.sameDay = (d1, d2) => {
     return d1.getFullYear() === d2.getFullYear() &&
       d1.getMonth() === d2.getMonth() &&
       d1.getDate() === d2.getDate();
   }

   fx.isOverflowing = (el) => { return el.scrollWidth > el.clientWidth; }
   fx.scaleFont = (el) => {
      let counter = 0;
      while (fx.isOverflowing(el) && counter < 20) {
         let font_size = el.style.fontSize;
         let size = font_size.match(/[\.\d]+/)[0];
         let units = font_size.match(/[A-Za-z]+/)[0];
         el.style.fontSize = `${size - .1}${units}`;
      }
   }

   fx.createFx = (str) => {
      var startBody = str.indexOf('{') + 1;
      var endBody = str.lastIndexOf('}');
      var startArgs = str.indexOf('(') + 1;
      var endArgs = str.indexOf(')');
      return new Function(str.substring(startArgs, endArgs), str.substring(startBody, endBody));
   }

   fx.logError = (err) => console.log(err);

   return fx;
}();
