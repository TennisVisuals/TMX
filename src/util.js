!function() {

   // requires Diacritics (diacritics.js)

   let util = {};

   util.replaceDiacritics = (text) => Diacritics.replace(text);
   util.nameHash = (name) => util.replaceDiacritics(name.replace(/[-_,.\ ]+/g, "")).toLowerCase();

   util.normalizeScore = (score) => {
      let clean_score = cleanScore.normalize(score);
      if (clean_score) return clean_score.join(' ');
      alert(`Score can't be normalized: ${score}`);
      return score;
   }

   util.string2boolean = (string) => {
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

   util.formatDate = (date, separator = '-') => {
      if (!date) return '';

      let d = new Date(date),
         month = '' + (d.getMonth() + 1),
         day = '' + d.getDate(),
         year = d.getFullYear();

      if (month.length < 2) month = '0' + month;
      if (day.length < 2) day = '0' + day;

      return [year, month, day].join(separator);
   }

   util.isDate = (date) => new Date(date) !== "Invalid Date" && !isNaN(new Date(date));

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
      if (!name) { return; }
      var particles = ['del', 'de', 'di', 'du', 'van', 'von', 'ten']; 
      if (noaccents) name = util.replaceDiacritics(name.trim());
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

   util.keyWalk = keyWalk;
   function keyWalk(valuesObject, optionsObject) {
      if (!valuesObject || !optionsObject) return;
      var vKeys = Object.keys(valuesObject);
      var oKeys = Object.keys(optionsObject);
      for (var k=0; k < vKeys.length; k++) {
          if (oKeys.indexOf(vKeys[k]) >= 0) {
              var oo = optionsObject[vKeys[k]];
              var vo = valuesObject[vKeys[k]];
              if (typeof oo == 'object' && typeof vo !== 'function' && oo.constructor !== Array) {
                  keyWalk(valuesObject[vKeys[k]], optionsObject[vKeys[k]]);
              } else {
                  optionsObject[vKeys[k]] = valuesObject[vKeys[k]];
              }
          }
      }
   }

   // DOM
   util.getParent = (elem, class_name) => Array.from(elem.classList).indexOf(class_name) >= 0 ? elem : findUpClass(elem, class_name);

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
   util.unique = (arr) => arr.filter((item, i, s) => s.lastIndexOf(item) == i);
   util.subSort = (arr, i, n, sortFx) => [].concat(...arr.slice(0, i), ...arr.slice(i, i + n).sort(sortFx), ...arr.slice(i + n, arr.length));
   util.inPlacesubSort = (arr, i, n, sortFx) => {
      let newarray = [].concat(...arr.slice(0, i), ...arr.slice(i, i + n).sort(sortFx), ...arr.slice(i + n, arr.length));
      arr.length = 0;
      arr.push.apply(arr, newarray);
      return arr;
   }
   util.arrayMap = (array) => new Map([...new Set(array)].map( x => [x, array.filter(y => y === x).length]));
   util.arrayCount = (array) => array.reduce((r,k) => { r[k] = ++r[k] || 1; return r},{});
   util.occurrences = (val, arr) => arr.reduce((r,val) => { r[val] = 1+r[val] || 1; return r},{})[val] || 0;
   util.indices = (val, arr) => arr.reduce((a, e, i) => { if (e === val) a.push(i); return a; }, []) 

   // util.missingNumbers = (a) => Array.from(Array(Math.max(...a)).keys()).map((n, i) => a.indexOf(i) < 0? i : null).filter(f=>f);
   util.missingNumbers = (a, l=true) => Array.from(Array(Math.max(...a)).keys()).map((n, i) => a.indexOf(i) < 0  && (!l || i > Math.min(...a)) ? i : null).filter(f=>f);
   util.range = (start, end) => Array.from({length: (end - start)}, (v, k) => k + start);
   util.numArr = (count) => [...Array(count)].map((_, i) => i);
   util.intersection = (a, b) => a.filter(n => b.indexOf(n) !== -1).filter((e, i, c) => c.indexOf(e) === i);

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

   util.validDate = (datestring, range) => {
      if (!datestring) return false;
      let dateparts = datestring.split('-');
      if (isNaN(dateparts.join(''))) return false;
      if (dateparts.length != 3) return false;
      if (dateparts[0].length != 4) return false;
      if (+dateparts[1] > 12 || +dateparts[1] < 1) return false;
      if (+dateparts[2] > 31 || +dateparts[2] < 1) return false;
      if (range && range.start) { if (new Date(datestring) < new Date(range.start)) return false; }
      if (range && range.end) { if (new Date(datestring) > new Date(range.end)) return false; }
      return true;
   }

   function isDate(dateArg) {
      var t = (dateArg instanceof Date) ? dateArg : (new Date(dateArg));
      return !isNaN(t.valueOf());
   }

   function isValidDateRange(minDate, maxDate) {
      return (new Date(minDate) <= new Date(maxDate));
   }

   util.dateRange = (startDt, endDt) => {
       var error = ((isDate(endDt)) && (isDate(startDt)) && isValidDateRange(startDt, endDt)) ? false : true;
       var between = [];
       if (error) {
          console.log('error occured!!!... Please Enter Valid Dates');
       } else {
           var currentDate = new Date(startDt),
               end = new Date(endDt);
           while (currentDate <= end) {
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

   if (typeof define === "function" && define.amd) define(util); else if (typeof module === "object" && module.exports) module.exports = util;
   this.util = util;
 
}();
