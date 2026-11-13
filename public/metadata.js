(() => {
  const button = document.getElementById('metadata-open');
  const dialog = document.getElementById('metadata-dialog');
  const close = document.getElementById('metadata-close');
  const home = document.getElementById('rumah');
  const guide = document.getElementById('home-guide');
  let closingTimer;
  if (!button || !dialog || !home) return;
  const homeVisible = () => (!location.hash || location.hash.toLowerCase() === '#rumah') && !home.hidden;
  const guideVisible = () => { const r = guide?.getBoundingClientRect(); return r && r.top < innerHeight * .8 && r.bottom > 0; };
  const dismiss = (restore = true) => {
    clearTimeout(closingTimer);
    if (dialog.open) {
      dialog.classList.add('is-closing');
      closingTimer = setTimeout(() => {
        if (dialog.open) dialog.close();
        dialog.classList.remove('is-closing');
        if (restore && !button.hidden) button.focus({preventScroll:true});
      }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220);
    }
    button.setAttribute('aria-expanded', 'false');
    if (!dialog.open && restore && !button.hidden) button.focus({preventScroll:true});
  };
  const position = () => {
    if (button.hidden) return;
    const tutor = document.getElementById('deku-fab');
    button.style.left = ''; button.style.right = '18px';
    button.style.bottom = '140px';
    if (tutor) {
      const a = button.getBoundingClientRect(), b = tutor.getBoundingClientRect();
      if (a.left < b.right + 12 && a.right > b.left - 12 && a.top < b.bottom + 12 && a.bottom > b.top - 12) {
        button.style.bottom = `${Math.max(140, innerHeight - b.top + 24)}px`;
      }
    }
  };
  const sync = () => {
    button.hidden = !homeVisible() || guideVisible();
    if (button.hidden) dismiss(false);
    position();
  };
  button.addEventListener('click', () => {
    if (button.hidden || !homeVisible()) return;
    clearTimeout(closingTimer); dialog.classList.remove('is-closing'); dialog.showModal(); button.setAttribute('aria-expanded', 'true'); close.focus();
  });
  close.addEventListener('click', () => dismiss());
  dialog.addEventListener('cancel', event => { event.preventDefault(); dismiss(); });
  dialog.addEventListener('click', event => { if (event.target === dialog) {const r=dialog.getBoundingClientRect(); if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom) dismiss();} });
  dialog.addEventListener('close', () => button.setAttribute('aria-expanded','false'));
  window.addEventListener('hashchange', sync);
  window.addEventListener('scroll', sync, {passive:true});
  window.addEventListener('resize', sync);
  new MutationObserver(sync).observe(home,{attributes:true,attributeFilter:['hidden']});
  const tutor = document.getElementById('deku-fab');
  if (tutor) new MutationObserver(position).observe(tutor,{attributes:true,attributeFilter:['style']});
  sync();
})();
