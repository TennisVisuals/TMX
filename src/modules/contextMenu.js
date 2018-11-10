export const contextMenu = function() {

   let o = {
      selector: undefined, // selector *must* be an <svg> element

      height: undefined,
      width: undefined,
      margin: 0.1,
      rescale: false,
      font: {
         size: 16
      },
      colors: {
         default: 'white',
         hover: 'lightgray',
         text: 'steelblue'
      },
      thresholds: {
         items_per_column: 6
      }
   };

   let events = {
      'item': { 'mouseover': null, 'mouseout': null, 'click': null },
      'cleanup': null
   };

   let items = [];
    
   function menu(x, y) {
      let root = d3.select(o.selector || 'body');
      d3.selectAll(".context-menu").remove();

      scaleItems(root);

      let root_width = +root.attr('width');
      let root_height = +root.attr('height');

      let horizontal_space = root_width - o.width - x;
      let vertical_space = root_height - o.height;
      let columns = Math.floor(horizontal_space / o.width);

      let calc_height = Math.min(window.innerHeight, root_height);
      let attempt_two_columns = items.length > o.thresholds.items_per_column;
      let space_for_two_columns = (root_width - (2 & o.width) - x) > 0;

      if (vertical_space > window.innerHeight && attempt_two_columns && space_for_two_columns) { columns = 2; }

      let rows_per_column = Math.floor(calc_height / o.height);
      if (attempt_two_columns && rows_per_column > items.length / columns) rows_per_column = Math.ceil(items.length / columns);
      let possible_players = (columns + 1) * rows_per_column;
      // let total_possible_columns = Math.floor(root_width / o.width);
      // let total_possible_players = total_possible_columns * rows_per_column;

      if (possible_players < items.length) {
         let necessary_columns = Math.round(items.length / rows_per_column);
         x = root_width - (necessary_columns * o.width);
         if (x < 0) { x = 0; }
      }

      // reposition pop up to stay within the SVG
      let column_items = Math.min(rows_per_column, items.length);
      if (root_width && x + o.width > root_width) x = root_width - o.width;
      if (root_height && (y + (column_items * o.height) > root_height)) { y = root_height - (column_items * o.height); }
      if (y < 0) y = 0;

      let cmenu = root
         .append('g').attr('class', 'context-menu')
         .selectAll('cmenu')
        .data(items);
        
      cmenu.enter()
         .append('g').attr('class', 'menu-entry')
         .style('cursor', 'pointer')
         .on('mouseover', function() {
            d3.select(this).select('rect').style('fill', o.colors.hover);
         })
         .on('mouseout', function() {
            d3.select(this).select('rect')
               .style('fill', o.colors.default)
               .style('stroke', 'white')
               .style('stroke-width', '1px');
         })
         .on('click', events.item.click);

      cmenu.exit().remove();

      let itemX = (d, i) => x + Math.floor(i/rows_per_column) * o.width;
      let itemY = (d, i) => y + ((i%rows_per_column) * o.height);

      root.selectAll('.menu-entry')
         .append('rect')
         .attr('x', itemX)
         .attr('y', itemY)
          
         .attr('width', o.width)
         .attr('height', o.height)
         .style('fill', o.colors.default)
         .style('stroke', 'white')
         .style('stroke-width', '1px');
       
      root.selectAll('.menu-entry')
         .append('text')
         .text(d => typeof d == 'object' ? d.option : d)
         .attr('x', itemX)
         .attr('y', itemY)
         .attr('dy', o.height - o.margin / 2)
         .attr('dx', o.margin)
         .style('fill', o.colors.text) 
         .style('font-size', o.font.size);

      d3.select('body').on('click', () => {
         root.select('.context-menu').remove();
         if (events.cleanup && typeof events.cleanup == 'function') events.cleanup();
      });

   }
   
   menu.items = (values=[]) => {
      if (!values.length) return items;
      items = values;
      o.rescale = true;
      return menu;
   };

   menu.selector = (value) => {
      if (!value) { return o.selector; }
      o.selector = value;
      return menu;
   };

   menu.options = (values) => {
      if (!values || typeof values !== 'object') return o;
      keyWalk(values, o);
      return menu;
   };

   menu.events = (functions) => {
      if (!functions || typeof functions !== 'object') return events;
      keyWalk(functions, events);
      return menu;
   };

   menu.cleanUp =() => d3.selectAll('.context-menu').remove();

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

   // Automatically set width, height, and margin;
   function scaleItems(root) {
      if (!o.rescale) return;
      let z = [];

      root
         .selectAll('.cmenu')
        .data(items).enter()
         .append('text')
         .text(d => typeof d == 'object' ? d.option : d)
         .style('fill', 'steelblue') 
         .style('font-size', o.font.size)
         .attr('x', -1000)
         .attr('y', -1000)
         .attr('class',function() {
           z.push(d3.select(this).node().getBoundingClientRect());
           return 'cmenu';
         });

      o.width = d3.max(z.map(function(x){ return x.width; }));
      o.margin = o.margin * o.width;
      o.width =  o.width + 2 * o.margin;
      o.height = d3.max(z.map(function(x){ return x.height + o.margin / 2; }));

      // cleanup
      d3.selectAll('.cmenu').remove();
      o.rescale = false;
   }

   return menu;
};
