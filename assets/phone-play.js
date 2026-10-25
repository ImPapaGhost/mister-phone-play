(() => {
  'use strict';
  const storageKey = 'mister-control-remote-brightness';
  let controller = null;
  const clamp = value => Math.min(180, Math.max(100, Number(value) || 100));
  let brightness = 100;
  try { brightness = clamp(localStorage.getItem(storageKey)); } catch {}
  function applyBrightness() {
    if (!controller) return;
    controller.style.setProperty('--remote-picture-filter', 'url("#mc-picture-brightness")');
    for (const channel of controller.querySelectorAll('.mc-picture-channel')) channel.setAttribute('exponent', String(100 / brightness));
    const output = controller.querySelector('.mc-brightness-value');
    const range = controller.querySelector('.mc-brightness-range');
    if (output) output.textContent = `${brightness}%`;
    if (range) range.value = String(brightness);
    try { localStorage.setItem(storageKey, String(brightness)); } catch {}
  }
  function attach(gp) {
    controller = gp;
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
    svg.style.position = 'absolute'; svg.style.pointerEvents = 'none';
    const defs = document.createElementNS(svgNS, 'defs');
    const filter = document.createElementNS(svgNS, 'filter');
    filter.id = 'mc-picture-brightness';
    filter.setAttribute('color-interpolation-filters', 'sRGB');
    const transfer = document.createElementNS(svgNS, 'feComponentTransfer');
    for (const color of ['R', 'G', 'B']) {
      const channel = document.createElementNS(svgNS, 'feFunc' + color);
      channel.classList.add('mc-picture-channel');
      channel.setAttribute('type', 'gamma'); channel.setAttribute('amplitude', '1');
      channel.setAttribute('exponent', '1'); channel.setAttribute('offset', '0');
      transfer.append(channel);
    }
    filter.append(transfer); defs.append(filter); svg.append(defs); gp.append(svg);
    const tools = document.createElement('div');
    tools.className = 'mc-view-tools';
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'mc-view-toggle';
    toggle.textContent = 'View';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', 'mc-view-panel');
    const panel = document.createElement('div');
    panel.id = 'mc-view-panel';
    panel.className = 'mc-view-panel';
    panel.hidden = true;
    const label = document.createElement('label');
    label.htmlFor = 'mc-brightness-range';
    label.textContent = 'Picture brightness';
    const value = document.createElement('output');
    value.className = 'mc-brightness-value';
    value.setAttribute('for', 'mc-brightness-range');
    const range = document.createElement('input');
    range.id = 'mc-brightness-range';
    range.className = 'mc-brightness-range';
    range.type = 'range'; range.min = '100'; range.max = '180'; range.step = '5';
    const reset = document.createElement('button');
    reset.type = 'button'; reset.className = 'mc-brightness-reset'; reset.textContent = 'Reset brightness';
    const done = document.createElement('button');
    done.type = 'button'; done.className = 'mc-view-done'; done.textContent = 'Done';
    const row = document.createElement('div');
    row.className = 'mc-view-actions'; row.append(reset, done);
    panel.append(label, value, range, row); tools.append(toggle, panel); gp.append(tools);
    const show = open => { panel.hidden = !open; toggle.setAttribute('aria-expanded', String(open)); };
    toggle.addEventListener('click', () => show(panel.hidden));
    done.addEventListener('click', () => { show(false); toggle.focus(); });
    reset.addEventListener('click', () => { brightness = 100; applyBrightness(); });
    range.addEventListener('input', () => { brightness = clamp(range.value); applyBrightness(); });
    applyBrightness();
  }
  function sync() {
    const gp = document.querySelector('.gp');
    if (gp && gp !== controller) attach(gp);
    if (!gp && controller) {
      controller = null;
    }
  }
  new MutationObserver(sync).observe(document.documentElement, { childList: true, subtree: true });
  sync();
})();
