import { UUID } from './UUID';

export const displayFx = function() {
   let fx = {};

   // idObj() returns unique element ids and element references so that calling
   // functions can bind events (onclick) and pass ids to other components
   fx.idObj = idObj;
   function idObj(ids) { return Object.assign({}, ...Object.keys(ids).map(id => ({ [id]: { id: ids[id], element: document.getElementById(ids[id]) }} ) )); }

   fx.uuid = () => `ch${UUID.new()}`;

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

   // https://24ways.org/2010/calculating-color-contrast/
   fx.hexContrastYIQ = (hexcolor) => {
      var r = parseInt(hexcolor.substr(1,2),16);
      var g = parseInt(hexcolor.substr(3,2),16);
      var b = parseInt(hexcolor.substr(5,2),16);
      return fx.rgbContrastYIQ({ r, g, b });
   };

   fx.rgbContrastYIQ = ({ r, g, b }) => {
      var yiq = ((r*299)+(g*587)+(b*114))/1000;
      return (yiq >= 128) ? 'black' : 'white';
   };

   fx.parseRGBA = (rgbastring) => {
      if (!rgbastring) return;
      let extract = rgbastring.match(/\((.*?)\)/);
      if (extract && extract.length == 2) {
         let values = extract[1].split(',');
         if (values.length == 3 || values.length == 4) {
            return { r: values[0], g: values[1], b: values[2], a: values[3] };
         }
      } 
   };

   return fx;
 
}();
