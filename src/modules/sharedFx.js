export const sharedFx = function() {

   let fx = {
      receiveScore: (data) => console.log('rs:', data)
   };

   return fx;

}();
