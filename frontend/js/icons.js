/* ============================================================
   BizLink — line icon sprite. Use: <svg class="ic"><use href="#i-cart"/></svg>
   ============================================================ */
(function () {
  const s = (id, body) => `<symbol id="i-${id}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</symbol>`;
  const sprite = [
    s('home', '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h5v-6h4v6h5V9.5"/>'),
    s('search', '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
    s('orders', '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/><path d="M10 13h6M10 17h6"/>'),
    s('cart', '<path d="M3 4h2.5l2.2 11h10.6l2-8H6.4"/><circle cx="9.5" cy="19.5" r="1.4"/><circle cx="17" cy="19.5" r="1.4"/>'),
    s('user', '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.2 3.6-7 8-7s8 2.8 8 7"/>'),
    s('bell', '<path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15z"/><path d="M10 21h4"/>'),
    s('heart', '<path d="M12 20.5s-8-4.9-8-11A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.5c0 6.1-8 11-8 11z"/>'),
    s('filter', '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>'),
    s('sort', '<path d="M8 4v16M8 20l-3-3M8 20l3-3"/><path d="M16 20V4M16 4l-3 3M16 4l3 3"/>'),
    s('mail', '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m4 7 8 6 8-6"/>'),
    s('phone', '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>'),
    s('pin', '<path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>'),
    s('badge', '<circle cx="12" cy="8.5" r="5"/><path d="m8.5 13 -1.5 8 5-3 5 3-1.5-8"/>'),
    s('calendar', '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
    s('edit', '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>'),
    s('close', '<path d="M6 6l12 12M18 6 6 18"/>'),
    s('check', '<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
    s('box', '<path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9"/>'),
    s('bike', '<circle cx="6" cy="16" r="3.5"/><circle cx="18" cy="16" r="3.5"/><path d="M6 16 9.5 8H13l3 8M9.5 8 8.5 6H6.5M12 12.5h5"/>'),
    s('wallet', '<path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3"/><rect x="3.5" y="7.5" width="17" height="12" rx="2.5"/><path d="M16 13.5h4.5v3H16a1.5 1.5 0 0 1 0-3z"/>'),
    s('plus', '<path d="M12 5v14M5 12h14"/>'),
    s('alert', '<path d="M12 3.5 21.5 20h-19z"/><path d="M12 10v4.5M12 17.5v.01"/>'),
    s('logout', '<path d="M10 4H5v16h5"/><path d="M15 8l4 4-4 4M19 12H9"/>'),
    '<symbol id="i-star" viewBox="0 0 24 24" fill="currentColor"><path d="m12 2.8 2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2 6.3 20.3l1.2-6.4L2.8 9.5l6.4-.8z"/></symbol>'
  ].join('');

  const el = document.createElement('div');
  el.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0">' + sprite + '</svg>';
  (document.body || document.documentElement).insertBefore(el, (document.body || document.documentElement).firstChild);
})();
