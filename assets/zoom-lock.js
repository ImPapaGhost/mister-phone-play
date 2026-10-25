'use strict';
/* Native zoom is locked only while the touch controller is open. */
(function (install) {
  if (typeof module === 'object' && module.exports) module.exports = install;
  else install(document);
})(function installZoomLock(doc, clock = () => performance.now()) {
  const listeners = [];
  const originalMeta = doc.querySelector('meta[name="viewport"]');
  const originalViewport = originalMeta?.getAttribute('content') || '';
  let meta = originalMeta;
  let locked = false;
  let previousTap = -Infinity;
  const playing = () => Boolean(doc.querySelector('.gp'));
  const element = event => event.target?.closest ? event.target : event.target?.parentElement;
  const inside = event => Boolean(element(event)?.closest('.gp'));
  const cancel = event => { if (event.cancelable) event.preventDefault(); };
  const gameplay = event => inside(event) && !element(event).closest('.gp-close, .gp-kb, .mc-view-tools, .gp-video button, input, select, textarea');
  const listen = (type, handler) => {
    const options = { capture: true, passive: false };
    doc.addEventListener(type, handler, options);
    listeners.push([type, handler, options]);
  };
  const sync = () => {
    const active = playing();
    if (active === locked) return;
    locked = active;
    previousTap = -Infinity;
    if (active) {
      if (!meta) {
        meta = doc.createElement('meta'); meta.setAttribute('name', 'viewport'); doc.head.append(meta);
      }
      const parts = (originalViewport || 'width=device-width').split(',').map(part => part.trim())
        .filter(part => part && !/^(initial-scale|minimum-scale|maximum-scale|user-scalable)\s*=/i.test(part));
      meta.setAttribute('content', [...parts, 'initial-scale=1', 'minimum-scale=1', 'maximum-scale=1', 'user-scalable=no'].join(', '));
    } else if (originalMeta) meta.setAttribute('content', originalViewport);
    else { meta?.remove(); meta = null; }
  };
  // The gamepad uses pointerdown/pointerup. Cancel native touch behavior without
  // stopping those events or changing simultaneous D-pad/button input.
  for (const type of ['touchstart', 'touchmove']) {
    listen(type, event => {
      if (gameplay(event) || (inside(event) && event.touches?.length > 1)) cancel(event);
    });
  }
  listen('touchend', event => {
    if (!inside(event)) return;
    const now = clock();
    const rapid = now - previousTap < 600;
    previousTap = now;
    if (gameplay(event)) { cancel(event); return; }
    // Preserve ordinary UI clicks. On a rapid repeat, cancel Safari's native
    // double-tap action and deliver the intended button click once ourselves.
    const button = element(event).closest('button');
    if (!rapid || !button || button.disabled || button.getAttribute('aria-disabled') === 'true' || !event.cancelable) return;
    cancel(event);
    const touch = event.changedTouches?.[0];
    if (!touch || event.changedTouches.length !== 1 || event.touches?.length) return;
    const r = button.getBoundingClientRect();
    if (touch.clientX >= r.left && touch.clientX <= r.right && touch.clientY >= r.top && touch.clientY <= r.bottom) button.click();
  });
  listen('dblclick', event => { if (inside(event)) cancel(event); });
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    listen(type, event => { if (playing()) cancel(event); });
  }
  listen('wheel', event => { if (playing() && event.ctrlKey) cancel(event); });
  listen('keydown', event => {
    if (playing() && (event.ctrlKey || event.metaKey) && ['+', '=', '-', '_'].includes(event.key)) cancel(event);
  });
  const observer = new doc.defaultView.MutationObserver(sync);
  observer.observe(doc.documentElement, { childList: true, subtree: true });
  sync();
  return () => {
    observer.disconnect();
    for (const [type, handler, options] of listeners) doc.removeEventListener(type, handler, options);
    if (originalMeta) originalMeta.setAttribute('content', originalViewport);
    else meta?.remove();
  };
});
