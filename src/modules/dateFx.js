export const dateFx = function() {
   let fx = {};

   // scoreboard
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
   };

   // unused
   fx.weekDays = (date) => {
      let dates = [0, 1, 2, 3, 4, 5, 6].map(i => dayOfWeek(date, i));
      return dates;

      function dayOfWeek(date, index) {
        let d = new Date(date);
        let day = d.getDay();
        let diff = index - day;
        return new Date(d.setDate(d.getDate() + diff));
      }
   };

   // exportFx
   fx.ymd2date = ymd2date;
   function ymd2date(ymd) {
      let parts = ymd.split('-');
      if (!parts || parts.length != 3) return new Date(ymd);
      if (isNaN(parseInt(parts[1]))) return new Date(ymd);
      return new Date(parts[0], parseInt(parts[1]) - 1, parts[2]);
   }

   // ** used frequently
   fx.formatDate = formatDate;
   function formatDate(date, separator = '-', format='YMD') {
      if (!date) return '';
      if (!isNaN(date)) date = fx.offsetTime(date);

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

   fx.offsetDate = (date) => {
      var targetTime = date ? new Date(date) : new Date();
      var tzDifference = targetTime.getTimezoneOffset();
      return new Date(targetTime.getTime() + tzDifference * 60 * 1000);
   };

   fx.offsetTime = (date) => fx.offsetDate(date).getTime();

   fx.validDate = (datestring, range) => {
      if (!datestring) return false;
      let dateparts = formatDate(datestring).split('-');
      if (isNaN(dateparts.join(''))) return false;
      if (dateparts.length != 3) return false;
      if (dateparts[0].length != 4) return false;
      if (+dateparts[1] > 12 || +dateparts[1] < 1) return false;
      if (+dateparts[2] > 31 || +dateparts[2] < 1) return false;
      if (range && range.start) { if (fx.offsetDate(datestring) < fx.offsetDate(range.start)) return false; }
      if (range && range.end) { if (fx.offsetDate(datestring) > fx.offsetDate(range.end)) return false; }
      return true;
   };

   fx.isDate = (dateArg) => {
      if (typeof dateArg == 'boolean') return false;
      var t = (dateArg instanceof Date) ? dateArg : !isNaN(dateArg) ? new Date(dateArg) : false;
      return t && !isNaN(t.valueOf());
   };

   function isValidDateRange(minDate, maxDate) {
      return (fx.offsetDate(minDate) <= fx.offsetDate(maxDate));
   }

   fx.timeUTC = (date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());

   fx.dateRange = (startDt, endDt) => {
      let error = ((fx.isDate(endDt)) && (fx.isDate(startDt)) && isValidDateRange(startDt, endDt)) ? false : true;
      let between = [];
      let iterations = 0;
      let keep_looping = true;

      if (error) {
          console.log('error occured!!!... Please Enter Valid Dates');
      } else {
          var currentDate = fx.offsetDate(startDt);
          var end = fx.offsetDate(endDt);
          while (currentDate <= end && keep_looping) {
             iterations += 1;
             if (iterations > 300) {
                console.log('excessive while loop');
                keep_looping = false;
             }
             // must be a *new* Date otherwise it is an array of the same object
             between.push(new Date(currentDate));
             currentDate.setDate(currentDate.getDate() + 1);
          }
      }
      return between;
   };

   // unused
   fx.sameDay = (d1, d2) => {
     return d1.getFullYear() === d2.getFullYear() &&
       d1.getMonth() === d2.getMonth() &&
       d1.getDate() === d2.getDate();
   };

   return fx;

}();

