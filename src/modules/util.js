export const util = function() {
   let util = {};

   var ad_errors = 0;
   util.addDev = function(variable) {
      try { Object.keys(variable).forEach(key => dev[key] = variable[key]); }
      catch(err) { if (!ad_errors) { console.log('production environment'); ad_errors += 1; } }
   };

   util.clearHistory = () => { history.pushState('', document.title, window.location.pathname); };

   util.parseInt = (value) => {
      let result = parseInt(value);
      return isNaN(result) ? undefined : result;
   };

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
   };

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
   };
   util.arrayMap = (array) => new Map([...new Set(array)].map( x => [x, array.filter(y => y === x).length]));

   util.arrayCount = (array) => array.reduce((r,k) => { r[k] = ++r[k] || 1; return r; },{});
   util.occurrences = (val, arr) => arr.reduce((r,val) => { r[val] = 1+r[val] || 1; return r; },{})[val] || 0;
   util.intanceCount = (values) => values.reduce((a, c)=>{a[c]++?0:a[c]=1;return a; },{});

   util.indices = (val, arr) => arr.reduce((a, e, i) => { if (e === val) a.push(i); return a; }, []);
   util.randomPop = (array) => array.length ? array.splice(Math.floor(Math.random()*array.length), 1)[0] : undefined;

   util.hashReduce = (arr) => {
      return arr.reduce((l, c) => {
         let hash = c.sort().join('|');
         if (l.indexOf(hash) < 0) l.push(hash);
         return l;
      }, []).map(r=>r.split('|'));
   };

   util.missingNumbers = (a, l=true) => Array.from(Array(Math.max(...a)).keys()).map((n, i) => a.indexOf(i) < 0  && (!l || i > Math.min(...a)) ? i : null).filter(f=>f);
   util.range = (start, end) => Array.from({length: (end - start)}, (v, k) => k + start);
   util.numArr = (count) => [...Array(count)].map((_, i) => i);
   util.intersection = (a, b) => a.filter(n => b.indexOf(n) !== -1).filter((e, i, c) => c.indexOf(e) === i);
   util.chunkArray = (arr, chunksize) => {
      return arr.reduce((all,one,i) => {
         const ch = Math.floor(i/chunksize); 
         all[ch] = [].concat((all[ch]||[]),one); 
         return all;
      }, []);
   };

   util.passFail = (array, conditionFx) => {
      let result = { pass: [], fail: [] };
      array.forEach(item => result[conditionFx(item) ? 'pass' : 'fail'].push(item));
      return result;
   };

   util.log2 = (val) => Math.log(val) / Math.LN2;
   util.nearestPow2 = (val) => Math.pow(2, Math.round( Math.log(val) / Math.log(2)));

   util.catchTab = (evt) => { if (evt.which == 9) { evt.preventDefault(); } };
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
   };

   util.logError = (err) => console.log(err);

   return util;
}();
