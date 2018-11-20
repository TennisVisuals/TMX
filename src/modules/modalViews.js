import { domFx } from './domFx';
import { eventManager } from './eventManager';

export const modalViews = function() {

   let fx = {};

   let options = {
      click_delay: 100
   };

   fx.init = () => {
      eventManager
         .register('modalPeer', 'tap', modalPeer)
         .register('closeModal', 'tap', closeModal)
         .register('backgroundClose', 'tap', closeModal);

      domFx.enableNoScroll();
 
      let mw = document.createElement('div');
      mw.id = 'modalwindow';
      mw.classList = 'modal';
      mw.style.height = '100%';
      window.document.body.insertBefore(mw, window.document.body.firstChild);
   };

   function modalPeer(target) {
      let peer_target = target.getAttribute('modalpeer');
      let peer_tabs = Array.from(document.querySelectorAll('.modalPeer'));
      peer_tabs.forEach(peer => peer.classList.remove('is-active'));
      target.classList.add('is-active');
      let modalpeers = Array.from(document.querySelectorAll('.modalpeer'));
      modalpeers.forEach(peer => peer.style.display = peer.classList.contains(peer_target) ? 'inline' : 'none');
   }

   function delay(fx) { setTimeout(fx, options.clickDelay); }

   fx.closeModal = closeModal;
   function closeModal() {
      // delay to prevent click propagation
      delay(doIt);
      domFx.freezeBody(false);
      domFx.noScroll(false, null);
      function doIt() { Array.from(document.querySelectorAll('.modal')).forEach(modal => modal.classList.remove('is-active')); }
   }

   fx.modalWindow = modalWindow;
   function modalWindow({ html, x=true, background=true, backgroundClose=true }) {
      let modal_window = document.getElementById('modalwindow');
      let close_button = `
         <button class="modal-close is-large closeModal" aria-label="close"></button>
      `;
      let modal_background = `
        <div class="modal-background fadeback ${backgroundClose ? 'backgroundClose' : ''}" style="height: 100%"></div>
      `;
      let modal_html = `
         ${background ? modal_background : ''}
         <div id="modalcontent" class="min-modal modal-content">${html}</div>
         ${x ? close_button : ''}
     `;
      modal_window.innerHTML = modal_html;
      if (modal_window) {
         domFx.freezeBody(true);
         domFx.noScroll(true, 'modal-content');
         modal_window.classList.add('is-active');
      }
   }

   fx.minMenu = (html) => {
      modalWindow({ html, x: false });
   };

   fx.clickDelay = function(value) {
      if (!value) return options.click_delay;
      options.click_delay = value;
      return fx;
   };

   return fx;

}();

