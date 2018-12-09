export const sharedFx = function() {

   let fx = {
      receiveScore: () => console.log('Scores Received'),
      receiveMatches: () => console.log('Matches Received'),
      connectionEvent: () => console.log('Connection Event')
   };

   return fx;

}();
