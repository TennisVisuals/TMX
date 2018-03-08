let analysis = function() {
   
   fx = {};

   fx.monthReport = (after, before = new Date()) => {
      let after_time = new Date(after).getTime();
      let before_time = new Date(before).getTime();
      return new Promise((resolve, reject) => {
         let unchanged = [];
         let changed = [];

         db.db.tournaments.where('end').between(after_time, before_time).toArray(tournaments => {
            tournaments.forEach(t => {
               let rank = parseInt(t.rank);
               let M = !t.accepted ? '' : !t.accepted.M ? '' : `M: ${t.accepted.M.sgl_rank || rank}/${t.accepted.M.dbl_rank || rank}`;
               let W = !t.accepted ? '' : !t.accepted.W ? '' : `W: ${t.accepted.W.sgl_rank || rank}/${t.accepted.W.dbl_rank || rank}`;
               let accepted = M && W ? `${M} ${W}\r\n\r\n` : '';
               if (t.accepted &&
                  parseInt(t.accepted.M.sgl_rank) == rank && 
                  (!t.accepted.M.dbl_rank || parseInt(t.accepted.M.dbl_rank) == rank) && 
                  (!t.accepted.W || !t.accepted.W.dbl_rank || parseInt(t.accepted.W.dbl_rank) == rank) &&
                  (!t.accepted.W || !t.accepted.W.sgl_rank || parseInt(t.accepted.W.sgl_rank) == rank)) {
                     accepted = '';
                  }

               let report = [ t.name, `Date: ${util.formatDate(new Date(t.start))}`, `Category: ${t.category}`, `Scheduled Rank: ${rank}`, accepted ];
               let rankings = report.join('\r\n');

               if (accepted) changed.push(rankings);
               if (!accepted) unchanged.push(rankings);
            });

            let result = `CHANGED:\r\n${changed.join('')}UNCHANGED:\r\n${unchanged.join('\r\n')}`;

            console.log(result);
            resolve(result);
         });
      });
   }

   return fx;

}();
