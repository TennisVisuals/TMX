export const transformFx = function() {

   let fx = {};

   fx.parseURLs = (text) => {
      let supported = {
         'youtu.be': 'youtube', 
         'youtube.com': 'youtube', 
         'facebook.com': 'facebook',
         'instagram.com': 'instagram',
         'twitter.com': 'twitter',
         'linkedin.com': 'linkedin'
      };
      let supported_urls = Object.keys(supported);
      let urls = text.split('\n');
      let images = [];
      let social = Object.assign({}, ...urls.map(url => {
         let found = supported_urls.reduce((p, c) => url.toLowerCase().indexOf(c) >=0 ? c : p, undefined);
         if (found) {
            return { [supported[found]]: url };
         } else {
            if (isImage(url) && url.indexOf('http') == 0) { images.push(url); }
         }
      }).filter(f=>f));

      return { images, social };
   };

   function isImage(url) { return url && ['jpeg', 'jpg', 'png'].indexOf(url.split('.').reverse()[0]) >= 0; }

   return fx;

}();

