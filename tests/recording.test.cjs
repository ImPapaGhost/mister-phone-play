'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {createCapture, selectSource} = require('../assets/recording.js');

test('the hidden decoder canvas is skipped in favor of the visible live image', () => {
  const hidden = {visible:false}, image = {visible:true};
  assert.equal(selectSource({querySelectorAll: () => [hidden,image]}, element => element.visible), image);
  assert.equal(selectSource(null, () => true), null);
});

function fixture({supported = ['video/mp4'], failStart = false, noSource = false} = {}) {
  let now = 100, tick, stopped = 0, recorder, updates = [], source = noSource ? null : {width: 320, height: 240};
  const context = {fillRect() {}, drawImage() {}};
  class Recorder {
    static isTypeSupported(type) { return supported.includes(type); }
    constructor(stream, options) { this.mimeType = options.mimeType; recorder = this; }
    start() { if (failStart) throw new Error('Encoder failed'); }
    stop() { this.ondataavailable({data: new Blob(['video'])}); this.onstop(); }
  }
  const canvas = {captureStream: () => ({getTracks: () => [{stop() { stopped++; }}]}), getContext: () => context};
  const capture = createCapture({canvas, MediaRecorder: Recorder, Blob, source: () => source,
    now: () => now, setInterval(callback) { tick = callback; return 1; }, clearInterval() { tick = null; }, update(info) { updates.push(info); }});
  return {capture, canvas, updates, get recorder() { return recorder; }, get stopped() { return stopped; }, get ticking() { return !!tick; },
    advance(ms) { now += ms; if (tick) tick(); }, loseSource() { source = null; }};
}

test('a stopped clip uses its real MIME type and releases the video track', () => {
  const f = fixture(); f.capture.start(); assert.equal(f.capture.state, 'recording');
  f.advance(2100); assert.equal(f.updates.at(-1).seconds, 2);
  f.capture.stop(); assert.equal(f.capture.state, 'ready');
  assert.equal(f.updates.at(-1).extension, 'mp4'); assert.equal(f.updates.at(-1).blob.size, 5);
  assert.equal(f.stopped, 1); assert.equal(f.ticking, false);
});
test('WebM fallback keeps the correct file extension', () => {
  const f = fixture({supported: ['video/webm;codecs=vp8']}); f.capture.start(); f.capture.stop();
  assert.equal(f.updates.at(-1).extension, 'webm');
});
test('unsupported browsers and missing pictures produce actionable errors', () => {
  for (const options of [{supported: []}, {noSource: true}]) {
    const f = fixture(options); f.capture.start(); assert.equal(f.capture.state, 'error');
    assert.ok(f.updates.at(-1).error); assert.equal(f.ticking, false);
  }
});
test('encoder startup failure releases capture resources', () => {
  const f = fixture({failStart: true}); f.capture.start();
  assert.equal(f.capture.state, 'error'); assert.equal(f.stopped, 1); assert.equal(f.ticking, false);
});
test('closing the source finalizes the clip', () => {
  const f = fixture(); f.capture.start(); f.loseSource(); f.advance(50);
  assert.equal(f.capture.state, 'recording'); f.advance(5000);
  assert.equal(f.capture.state, 'ready'); assert.equal(f.updates.at(-1).reason, 'The live picture closed.');
});
test('duration and memory limits finalize instead of silently dropping a clip', () => {
  const f = fixture(); f.capture.start(); f.advance(300000);
  assert.equal(f.capture.state, 'ready'); assert.match(f.updates.at(-1).reason, /five-minute/);
  f.capture.discard(); f.capture.start();
  f.recorder.ondataavailable({data: new Blob([new Uint8Array(64 * 1024 * 1024)])});
  assert.equal(f.capture.state, 'ready'); assert.match(f.updates.at(-1).reason, /64 MB/);
});
test('a ready clip cannot be overwritten until explicitly discarded', () => {
  const f = fixture(); f.capture.start(); const first = f.recorder; f.capture.start(); assert.equal(f.recorder, first);
  f.capture.stop(); f.capture.start(); assert.equal(f.recorder, first);
  f.capture.discard(); f.capture.start(); assert.notEqual(f.recorder, first);
});
test('resolution is bounded and remains fixed through core changes', () => {
  const f = fixture(); f.capture.start(); const size = [f.canvas.width, f.canvas.height];
  assert.deepEqual(size, [320, 240]); f.advance(50); assert.deepEqual([f.canvas.width, f.canvas.height], size);
  f.capture.stop();
});
