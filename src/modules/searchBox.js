import { tmxTour } from './tmxTour';
import { lang } from './translator';

export const searchBox = function() {

   let selection_flag = false;

   let searchBox = {
      active: {}, // keeps track of most recent search
      category: 0,
      default_category: undefined,
      propagate_empty: false,    // pass on enter when empty field
      category_switching: true,
      irregular_search_list: false,

      element_id: undefined,
      search_select_id: undefined,
      meta_element_id: undefined,
      count_element_id: undefined,
      category_element_id: undefined,

      element: undefined,
      meta_element: undefined,
      count_element: undefined,
      category_element: undefined,
      search_select_element: undefined,

      // stub for function to invoke when no suggestions
      noSuggestions: undefined,

      // stub for function to invoke for control/right-click
      contextMenu: undefined,

      metaClick: {}
   };

   searchBox.resetFx = [];
   searchBox.reset = () => {
      searchBox.active = {};
      searchBox.resetFx.forEach(f => { if (typeof f == 'function') f(); });
   };
   searchBox.cleanUp = () => tmxTour.clear();
   searchBox.setSearchCategory = (notice) => {
      if (!searchBox.element) return;
      let searchtype = `search.${searchBox.category}`;
      let placeholder = notice || lang.tr(searchtype) || 'Search';
      searchBox.element.setAttribute('placeholder', placeholder);
   };
   searchBox.normalFunction = ({ stateFunction=searchBox.setSearchCategory } = {}) => {
      searchBox.resetFx.forEach(f => { if (typeof f == 'function') f(); });

      searchBox.category_switching = true;
      if (searchBox.irregular_search_list) {
         searchBox.updateSearch();
         searchBox.irregular_search_list = false; 
      }
      stateFunction();
   };
   searchBox.focus = () => { if (searchBox.element) searchBox.element.focus(); };
   searchBox.searchCount = (num) => { if (searchBox.count_element) searchBox.count_element.innerHTML = num; };
   searchBox.searchCategory = (class_name) => { if (searchBox.category_element) searchBox.category_element.className = `icon15 ${class_name}`; };
   searchBox.updateSearch = (category) => { 
      if (!searchBox.populateSearch) return;
      category = category || searchBox.category || searchBox.default_category; 
      if (searchBox.populateSearch[category] && typeof searchBox.populateSearch[category] == 'function') searchBox.populateSearch[category](); 
   };
   searchBox.nextSearchCategory = (next) => {
      if (!searchBox.category_switching) return;
      if (!searchBox.populateSearch) return;

      searchBox.reset();
      let categories = Object.keys(searchBox.populateSearch);

      if (next) {
         searchBox.category = (categories.indexOf(next) < 0) ? searchBox.default_category : next;
      } else {
         let next_index = categories.indexOf(searchBox.category) + 1;
         if (next_index + 1 > categories.length) next_index = 0;
         searchBox.category = categories[next_index];
      }

      searchBox.setSearchCategory();
      searchBox.updateSearch();
   };

   let catchTab = (event) => { if (event.which == 9) { event.preventDefault(); event.stopPropagation(); } };
   searchBox.init = () => {
      if (!searchBox.element_id) return;
      searchBox.element = document.getElementById(searchBox.element_id);
      if (!searchBox.element) return;

      if (searchBox.count_element_id) searchBox.count_element = document.getElementById(searchBox.count_element_id);
      if (searchBox.category_element_id) searchBox.category_element = document.getElementById(searchBox.category_element_id);
      if (searchBox.meta_element_id) searchBox.meta_element = document.getElementById(searchBox.meta_element_id);
      if (searchBox.search_select_id) searchBox.search_select_element = document.getElementById(searchBox.search_select_id);

      searchBox.typeAhead = new Awesomplete(searchBox.element, { list: [], maxItems: 20, minChars: 3 });
      searchBox.element.addEventListener("awesomplete-selectcomplete", selectionComplete, false);
      searchBox.element.addEventListener('keydown', catchTab , false);
      searchBox.element.addEventListener("keyup", function(e) { 
         e.stopPropagation();
         // auto select first item on 'Enter' *only* if selectcomplete hasn't been triggered
         if (e.target.value && e.which == 13 && !selection_flag) {
            if (searchBox.typeAhead.suggestions && searchBox.typeAhead.suggestions.length) {
               searchBox.typeAhead.next();
               searchBox.typeAhead.select(0);
            } else {
               if (typeof searchBox.noSuggestions == 'function') searchBox.noSuggestions(searchBox.element.value);
            }
         }
         selection_flag = false;
      });
      searchBox.element.addEventListener('contextmenu', function(e) {
         if (typeof searchBox.contextMenu == 'function') searchBox.contextMenu(e);
      });

      searchBox.nextSearchCategory();

      if (searchBox.meta_element) searchBox.meta_element.addEventListener('click', () => clickMeta());
      if (searchBox.search_select_element) searchBox.search_select_element.addEventListener('click', () => searchBox.searchSelect());
      searchBox.focus();
   };

   function selectionComplete(e) {
      if (searchBox.cleanUp && typeof searchBox.cleanUp == 'function') searchBox.cleanUp();
      selection_flag = true;
      searchBox.search(e.target.value);
      searchBox.typeAhead.suggestions = [];
      e.target.value = null;
   }

   function clickMeta() {
      if (!searchBox.category) return;
      if (!searchBox.metaClick[searchBox.category]) return;

      let stateFunction = searchBox.metaClick[searchBox.category];
      searchBox.normalFunction({ stateFunction });
   }

   searchBox.search = (uuid) => {
      if (!searchBox.propagate_empty && !uuid) return;
      searchBox.element.value = '';
      let category = searchBox.category || searchBox.default_category; 
      if (!category) return;
      if (!searchBox.searchType || !searchBox.searchType[category] || typeof searchBox.searchType[category] != 'function') return;
      searchBox.searchType[category](uuid);
   };

   searchBox.searchSelect = (category) => {
      searchBox.nextSearchCategory(category);
      searchBox.focus();
   };

   return searchBox;
    
}();
