export const floatingEntry = function() {

   let o = {
      selector: undefined,
      centerY: true,
   }

   let floater;
   let events = { 
      'click': undefined,
      'cleanup': undefined,
   };

   function entry(x, y, html) {
      let root = d3.select(o.selector || 'body');

      root.selectAll(".floating-entry").remove();

      floater = root.append('div')
         .attr('class', 'floating-entry')
         .style('position','absolute')
         .style('top', y + 'px')
         .style('left', x + 'px')
         .html(html)

         .on('click', d => { 
            d3.event.preventDefault(); d3.event.stopPropagation(); 
            if (events.click && typeof events.click == 'function') events.click();
         });


      var dims = floater.node().getBoundingClientRect();
      if (o.centerY) y = y - dims.height / 2;
      if (x + dims.width > window.innerWidth) x = window.innerWidth - dims.width;
      if (y + dims.height > window.innerHeight) y = window.innerHeight - dims.height;

      floater
         .style('top', y + 'px')
         .style('left', x + 'px')
   }

   entry.destroy = function() { d3.select(o.selector || 'body').selectAll(".floating-entry").remove(); }
   
   entry.items = function(e) {
      if (!arguments.length) return items;
      for (i in arguments) items.push(arguments[i]);
      return entry;
   }

   entry.selector = function (value) {
      if (!arguments.length) { return o.selector; }
      o.selector = value;
      return entry;
   };

   entry.options = function(values) {
      if (!arguments.length) return o;
      keyWalk(values, o);
      return entry;
   }

   entry.events = function(functions) {
      if (!arguments.length) return events;
      keyWalk(functions, events);
      return entry;
   }

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

   return entry;
}
