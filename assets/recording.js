(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else api.install(root);
})(typeof window === 'object' ? window : globalThis, function () {
  'use strict';
  const TYPES = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp8', 'video/webm'];
  const MAX_SECONDS = 300;
  const MAX_BYTES = 64 * 1024 * 1024;
  function selectSource(gp, visible) {
    if (!gp) return null;
    return [...gp.querySelectorAll('.gp-video img.live-img, .gp-video canvas, .gp-video video')].find(visible) || null;
  }

  function createCapture(env) {
    let recorder, stream, timer, started, lastFrame, chunks = [], bytes = 0, ending = false;
    let state = 'idle', reason = '', failure = '';
    const notify = extra => env.update({state, seconds: started != null ? Math.floor((env.now() - started) / 1000) : 0, reason, ...extra});
    const release = () => {
      if (timer !== undefined) env.clearInterval(timer);
      timer = undefined;
      if (stream) stream.getTracks().forEach(track => track.stop());
      stream = null;
    };
    const stop = message => {
      if (state !== 'recording' || ending) return;
      ending = true; reason = message || '';
      if (timer !== undefined) env.clearInterval(timer);
      timer = undefined;
      state = 'stopping'; notify();
      try { recorder.stop(); } catch { release(); state = 'error'; notify({error: 'Recording stopped unexpectedly. Try a new clip.'}); }
    };
    const draw = () => {
      const source = env.source();
      const w = source && (source.naturalWidth || source.videoWidth || source.width);
      const h = source && (source.naturalHeight || source.videoHeight || source.height);
      if (!w || !h || (source.tagName === 'IMG' && !source.complete)) return false;
      const canvas = env.canvas;
      if (state !== 'recording') {
        const scale = Math.min(1, 1280 / w, 720 / h);
        canvas.width = Math.max(2, Math.floor(w * scale / 2) * 2);
        canvas.height = Math.max(2, Math.floor(h * scale / 2) * 2);
      }
      const context = canvas.getContext('2d');
      if (!context) throw new Error('This browser cannot record the picture.');
      const scale = Math.min(canvas.width / w, canvas.height / h);
      context.fillStyle = '#000'; context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(source, (canvas.width - w * scale) / 2, (canvas.height - h * scale) / 2, w * scale, h * scale);
      return true;
    };
    return {
      get state() { return state; },
      start() {
        if (state === 'recording' || state === 'stopping' || state === 'ready') return;
        chunks = []; bytes = 0; reason = ''; failure = ''; ending = false; started = null;
        try {
          if (!env.MediaRecorder || !env.canvas.captureStream) throw new Error('Recording is unavailable in this browser. Try current Safari, Chrome, or Edge.');
          const mimeType = TYPES.find(type => env.MediaRecorder.isTypeSupported(type));
          if (!mimeType) throw new Error('This browser has no supported video recorder.');
          if (!draw()) throw new Error('Wait for the live picture, then tap Record.');
          stream = env.canvas.captureStream(20);
          recorder = new env.MediaRecorder(stream, {mimeType, videoBitsPerSecond: 2500000});
          recorder.ondataavailable = event => {
            if (event.data.size) { chunks.push(event.data); bytes += event.data.size; }
            if (bytes >= MAX_BYTES) stop('Clip reached the 64 MB limit.');
          };
          recorder.onerror = () => { failure = 'The browser interrupted recording.'; stop(failure); };
          recorder.onstop = () => {
            release();
            if (!bytes) { state = 'error'; notify({error: failure || 'No video was recorded. Wait for the picture and try again.'}); return; }
            const type = recorder.mimeType || mimeType;
            const blob = new env.Blob(chunks, {type}); chunks = [];
            state = 'ready'; notify({blob, extension: type.includes('mp4') ? 'mp4' : 'webm'});
          };
          recorder.start(1000); started = env.now(); lastFrame = started; state = 'recording'; notify();
          timer = env.setInterval(() => {
            if (env.now() - started >= MAX_SECONDS * 1000) { stop('Clip reached the five-minute limit.'); return; }
            try {
              if (draw()) lastFrame = env.now();
              else if (env.now() - lastFrame >= 5000) { stop('The live picture closed.'); return; }
              notify();
            } catch { stop('The live picture closed.'); }
          }, 50);
        } catch (error) { release(); chunks = []; state = 'error'; notify({error: error.message}); }
      },
      stop,
      discard() { if (state === 'recording' || state === 'stopping') return; chunks = []; started = null; state = 'idle'; reason = ''; notify(); }
    };
  }

  function install(win) {
    const doc = win.document;
    let gp, button, url, unsaved = false;
    const panel = doc.createElement('aside');
    panel.className = 'mc-record-panel'; panel.hidden = true;
    panel.setAttribute('aria-label', 'Gameplay recording');
    const status = doc.createElement('p'); status.setAttribute('role', 'status');
    const save = doc.createElement('a'); save.textContent = 'Save clip'; save.hidden = true;
    const dismiss = doc.createElement('button'); dismiss.type = 'button'; dismiss.textContent = 'Dismiss';
    panel.append(status, save, dismiss);
    const canvas = doc.createElement('canvas');
    const capture = createCapture({
      canvas, MediaRecorder: win.MediaRecorder, Blob: win.Blob,
      source: () => selectSource(gp, element => win.getComputedStyle(element).display !== 'none' && element.getBoundingClientRect().width > 0),
      now: () => win.performance.now(), setInterval: win.setInterval.bind(win), clearInterval: win.clearInterval.bind(win),
      update(info) {
        const active = info.state === 'recording' || info.state === 'stopping';
        if (button) {
          const minutes = Math.floor(info.seconds / 60), seconds = String(info.seconds % 60).padStart(2, '0');
          button.textContent = info.state === 'recording' ? `Stop ${minutes}:${seconds}` : info.state === 'stopping' ? 'Saving…' : info.state === 'ready' ? 'Clip ready' : 'Record';
          button.classList.toggle('is-recording', active);
          button.disabled = info.state === 'stopping';
          button.setAttribute('aria-label', active ? 'Stop recording' : info.state === 'ready' ? 'Show recorded clip' : 'Record gameplay');
        }
        if (info.blob) {
          url = win.URL.createObjectURL(info.blob); unsaved = true;
          save.href = url;
          save.download = `mister-${new Date().toISOString().replace(/[:.]/g, '-')}.${info.extension}`;
          save.hidden = false; dismiss.textContent = 'Discard';
          status.textContent = [info.reason, 'Clip ready. Silent video, game picture only.'].filter(Boolean).join(' ');
          panel.hidden = false;
        } else if (info.error) { status.textContent = info.error; panel.hidden = false; }
        else if (info.state === 'idle' || active) panel.hidden = true;
      }
    });
    save.addEventListener('click', () => { unsaved = false; dismiss.textContent = 'Close'; });
    dismiss.addEventListener('click', () => {
      if (url) win.URL.revokeObjectURL(url);
      url = null; unsaved = false; save.hidden = true; save.removeAttribute('href');
      dismiss.textContent = 'Dismiss'; capture.discard(); panel.hidden = true;
    });
    function sync() {
      if (!panel.isConnected && doc.body) doc.body.append(panel);
      const next = doc.querySelector('.gp');
      if (next === gp) return;
      if (gp) capture.stop('Controller closed.');
      gp = next; button = null;
      if (!gp) return;
      button = doc.createElement('button'); button.type = 'button'; button.className = 'mc-record-button';
      button.textContent = capture.state === 'ready' ? 'Clip ready' : 'Record';
      button.setAttribute('aria-label', capture.state === 'ready' ? 'Show recorded clip' : 'Record gameplay');
      button.addEventListener('click', () => {
        if (capture.state === 'recording') capture.stop();
        else if (capture.state === 'ready') panel.hidden = false;
        else capture.start();
      });
      gp.append(button);
    }
    doc.addEventListener('visibilitychange', () => { if (doc.hidden) capture.stop('Recording stopped when the app went into the background.'); });
    win.addEventListener('pagehide', () => capture.stop());
    win.addEventListener('beforeunload', event => {
      if (capture.state === 'recording' || capture.state === 'stopping' || unsaved) { event.preventDefault(); event.returnValue = ''; }
    });
    new win.MutationObserver(sync).observe(doc.documentElement, {childList: true, subtree: true});
    sync();
  }
  return {createCapture, selectSource, install};
});
