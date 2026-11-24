'use strict';
try {
  if (localStorage.getItem('caravan-theme') === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
} catch (e) {}
