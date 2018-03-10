export const displayFx = function() {
   let fx = {};

   // idObj() returns unique element ids and element references so that calling
   // functions can bind events (onclick) and pass ids to other components
   fx.idObj = idObj;
   function idObj(ids) { return Object.assign({}, ...Object.keys(ids).map(id => { return { [id]: { id: ids[id], element: document.getElementById(ids[id]) }} })); }

   fx.toggleVisible = toggleVisible;
   function toggleVisible({ elem, type, duration=800, height=80, visible }) {
      let toggle_div = d3.select(elem);

      transition();

      function transition() {
         let target = toggle_div.select('.' + type);
         let display_state = target.style('display');
         let target_state = display_state == 'none' ? 'flex' : 'none';
         if ((visible == true && display_state == 'none') || (visible == undefined && target_state == 'flex')) {
            target.style('height', '0px');
            target.style('display', target_state).transition().duration(duration).style('height', `${height}px`);
         } else if ((visible == false && display_state == 'flex') || (visible == undefined && target_state == 'none')) {
            target.transition().duration(duration).style('height', '0px').transition().duration(0).style('display', 'none');
         }
      }
   }

   return fx;
 
}();
