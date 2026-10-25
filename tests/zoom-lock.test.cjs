'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const install = require('../assets/zoom-lock.js');

function fixture({meta = true, active = true} = {}) {
  let time = 1000;
  const handlers = new Map();
  const viewport = { value: 'width=device-width, initial-scale=1.0, maximum-scale=5', getAttribute() { return this.value; }, setAttribute(name, value) { if (name === 'content') this.value = value; }, remove() { doc.meta = null; } };
  const doc = {
    meta: meta ? viewport : null, active, documentElement: {},
    head: { append(value) { doc.meta = value; } },
    createElement() { return {...viewport}; },
    querySelector(selector) { return selector === '.gp' ? (this.active ? {} : null) : this.meta; },
    addEventListener(type, handler, options) { handlers.set(type, {handler, options}); },
    removeEventListener(type) { handlers.delete(type); },
    defaultView: { MutationObserver: class { constructor(callback) { doc.sync = callback; } observe() {} disconnect() {} } },
  };
  const stop = install(doc, () => time);
  function target(kind = 'game') {
    const node = {
      clicks: 0, disabled: false,
      getAttribute() { return null; },
      getBoundingClientRect() { return {left: 0, right: 50, top: 0, bottom: 50}; },
      click() { this.clicks++; },
      closest(selector) {
        if (selector === '.gp') return kind === 'outside' ? null : {};
        if (selector === 'button') return kind === 'button' ? this : null;
        return kind === 'button' || kind === 'range' ? this : null;
      },
    };
    return node;
  }
  function fire(type, node, extra = {}) {
    const event = {target: node, cancelable: true, prevented: false, touches: [], changedTouches: [{clientX: 10, clientY: 10}], preventDefault() { this.prevented = true; }, ...extra};
    handlers.get(type)?.handler(event);
    return event;
  }
  return {doc, handlers, viewport, stop, target, fire, advance(ms) { time += ms; }};
}

test('native touches are canceled across gameplay, while pointer input is untouched', () => {
  const f = fixture(), surface = f.target();
  for (const type of ['touchstart','touchmove','touchend','dblclick']) assert.equal(f.fire(type,surface).prevented,true,type);
  for (const type of ['pointerdown','pointerup','pointermove','pointercancel']) assert.equal(f.fire(type,surface).prevented,false,type);
});
test('a single-finger brightness slider remains native, but pinching is canceled', () => {
  const f = fixture(), slider = f.target('range');
  assert.equal(f.fire('touchstart',slider,{touches:[{}]}).prevented,false);
  assert.equal(f.fire('touchmove',slider,{touches:[{},{}]}).prevented,true);
  assert.equal(f.fire('touchend',slider).prevented,false);
});
test('a rapid toolbar tap is delivered once while its native zoom action is canceled', () => {
  const f = fixture(), button = f.target('button');
  assert.equal(f.fire('touchend',button).prevented,false);
  assert.equal(button.clicks,0);
  f.advance(450);
  assert.equal(f.fire('touchend',button).prevented,true);
  assert.equal(button.clicks,1);
});
test('a repeated toolbar touch dragged outside the button does not activate it', () => {
  const f = fixture(), button = f.target('button');
  f.fire('touchend',button); f.advance(100);
  assert.equal(f.fire('touchend',button,{changedTouches:[{clientX:80,clientY:80}]}).prevented,true);
  assert.equal(button.clicks,0);
});
test('multitouch ending on a toolbar does not synthesize a click', () => {
  const f = fixture(), button = f.target('button');
  f.fire('touchend',button); f.advance(100);
  f.fire('touchend',button,{touches:[{}]});
  assert.equal(button.clicks,0);
});
test('the rest of the app keeps native touch behavior', () => {
  const f = fixture({active:false}), outside = f.target('outside');
  for (const type of ['touchstart','touchmove','touchend','dblclick','gesturestart','gesturechange','gestureend']) assert.equal(f.fire(type,outside,{touches:[{},{}]}).prevented,false,type);
  assert.equal(f.fire('wheel',outside,{ctrlKey:true}).prevented,false);
});
test('pinch gestures and zoom shortcuts are blocked only during play', () => {
  const f = fixture(), surface = f.target();
  for (const type of ['gesturestart','gesturechange','gestureend']) assert.equal(f.fire(type,surface).prevented,true,type);
  assert.equal(f.fire('wheel',surface,{ctrlKey:true}).prevented,true);
  assert.equal(f.fire('wheel',surface,{ctrlKey:false}).prevented,false);
  assert.equal(f.fire('keydown',surface,{ctrlKey:true,key:'='}).prevented,true);
  assert.equal(f.fire('keydown',surface,{metaKey:true,key:'-'}).prevented,true);
  assert.equal(f.fire('keydown',surface,{ctrlKey:true,key:'0'}).prevented,false);
});
test('closing the controller restores the exact original viewport', () => {
  const f = fixture();
  assert.equal(f.viewport.value.match(/maximum-scale=/g).length,1);
  assert.ok(f.viewport.value.includes('maximum-scale=1'));
  f.doc.active=false; f.doc.sync();
  assert.equal(f.viewport.value,'width=device-width, initial-scale=1.0, maximum-scale=5');
});
test('a temporary viewport is removed when the page did not have one', () => {
  const f = fixture({meta:false});
  assert.ok(f.doc.meta);
  f.doc.active=false; f.doc.sync();
  assert.equal(f.doc.meta,null);
});
test('cleanup restores the viewport and removes cancellable event listeners', () => {
  const f=fixture();
  for (const {options} of f.handlers.values()) assert.equal(options.passive,false);
  f.stop();
  assert.equal(f.handlers.size,0);
  assert.equal(f.viewport.value,'width=device-width, initial-scale=1.0, maximum-scale=5');
});
