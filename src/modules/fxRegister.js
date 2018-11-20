export const fxRegister = function() {

   let fx = {};
   let registered = {};

   fx.add = (name, fx) => { if (name && typeof name == 'string' && typeof fx == 'function') { registered[name] = fx; } };
   fx.remove = (name) => { if (name && typeof name == 'string') delete registered[name]; };
   fx.invoke = (name, ...args) => { if (Object.keys(registered).indexOf(name) >= 0) registered[name](...args); };

   return fx;

}();
