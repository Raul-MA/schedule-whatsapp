'use strict';
// Run with node tests.js; only built-in modules are used.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
vm.runInThisContext(fs.readFileSync('app.js', 'utf8'));

const date = '2026-10-08';
const time = '09:00';
const now = new Date('2026-10-07T12:00:00');
for (const message of ['Hello everyone!', 'Café 👋🏽\nHow are you? A&B + 100% #yes', '你好 مرحبا', 'a'.repeat(9000)]) {
  const recipient = 'Family & friends? + # café 👨‍👩‍👧';
  const url = new URL(buildThingsUrl(recipient, date, time, message));
  assert.equal(url.protocol, 'things:');
  assert.equal(url.pathname, '/add');
  assert.equal(url.searchParams.get('title'), `WhatsApp ${recipient}`);
  assert.equal(url.searchParams.get('when'), `${date}@${time}`);
  assert.equal(url.searchParams.get('reveal'), 'true');
  const notes = url.searchParams.get('notes');
  assert.equal(notes, `https://wa.me/?text=${encodeURIComponent(message)}`);
  const whatsapp = new URL(notes);
  assert.equal(whatsapp.pathname, '/');
  assert.equal(whatsapp.searchParams.get('text'), message);
  assert.equal(draftError({recipient, date, time, message}, now), '');
}
assert.equal(buildThingsUrl('Family Group', date, time, 'Hello everyone!'), 'things:///add?title=WhatsApp%20Family%20Group&when=2026-10-08%4009%3A00&notes=https%3A%2F%2Fwa.me%2F%3Ftext%3DHello%2520everyone!&reveal=true');
const valid = {recipient: 'Friend', date, time, message: 'Hello'};
for (const overrides of [
  {recipient: '  '}, {message: '\n '}, {date: ''}, {time: ''},
  {date: '2026-02-30'}, {time: '25:00'}, {date: '2026-10-06'},
  {message: '👋'.repeat(1000)}, {recipient: 'a'.repeat(4000)},
  {message: '\ud800'}, {date: '2026-10-08', time: '9:00'}
]) assert.notEqual(draftError({...valid, ...overrides}, now), '');
assert.notEqual(draftError(valid, new Date('2026-10-08T09:00:00')), '');

const originalTimezone = process.env.TZ;
for (const timezone of ['UTC', 'America/Los_Angeles', 'Asia/Kolkata', 'Pacific/Auckland']) {
  process.env.TZ = timezone;
  const local = new Date(2026, 9, 8, 0, 5);
  assert.deepEqual(localFields(local), {date: '2026-10-08', time: '00:05'});
  assert.equal(draftError(valid, new Date(2026, 9, 7, 23, 59)), '');
}
process.env.TZ = 'America/New_York';
assert.notEqual(draftError({...valid, date: '2027-03-14', time: '02:30'}, new Date('2027-03-13T12:00:00')), '');
if (originalTimezone === undefined) delete process.env.TZ;
else process.env.TZ = originalTimezone;

const manifest = JSON.parse(fs.readFileSync('manifest.webmanifest', 'utf8'));
assert.equal(manifest.display, 'standalone');
for (const icon of manifest.icons) {
  const data = fs.readFileSync(icon.src);
  const [width, height] = icon.sizes.split('x').map(Number);
  assert.equal(data.readUInt32BE(16), width);
  assert.equal(data.readUInt32BE(20), height);
}
for (const match of fs.readFileSync('index.html', 'utf8').matchAll(/(?:src|href)="(\.\/[^"#]+)"/g)) assert.ok(fs.existsSync(match[1]), match[1]);
console.log('Passed: encoding, validation, local time in four zones, DST, manifest, icons, and asset paths.');

// Exercise the worker lifecycle and offline shell routing without a browser.
(async () => {
  const handlers = {};
  const deleted = [];
  let shell;
  let claimed = false;
  let fetched = false;
  const cache = {
    addAll: async paths => { shell = paths; },
    match: async request => ({offline: true, url: request.url})
  };
  const scope = 'https://example.com/repository/';
  vm.runInNewContext(fs.readFileSync('sw.js', 'utf8'), {
    URL,
    self: {
      location: new URL(`${scope}sw.js`),
      registration: {scope},
      clients: {claim: async () => { claimed = true; }},
      addEventListener: (name, handler) => { handlers[name] = handler; }
    },
    caches: {
      open: async () => cache,
      keys: async () => ['whatsapp-later-v1', 'whatsapp-later-v2', 'unrelated'],
      delete: async key => { deleted.push(key); }
    },
    fetch: async () => { fetched = true; throw new Error('Offline'); }
  });
  let pending;
  handlers.install({waitUntil: promise => { pending = promise; }});
  await pending;
  for (const asset of shell) assert.ok(fs.existsSync(asset), asset);
  handlers.activate({waitUntil: promise => { pending = promise; }});
  await pending;
  assert.deepEqual(deleted, ['whatsapp-later-v1']);
  assert.ok(claimed);
  for (const asset of shell) {
    const url = new URL(asset, scope).href;
    handlers.fetch({request: {url, method: 'GET'}, respondWith: promise => { pending = promise; }});
    assert.equal((await pending).url, url);
  }
  assert.equal(fetched, false);
  for (const url of ['https://wa.me/?text=hello', `${scope}unrelated.txt`]) {
    handlers.fetch({request: {url, method: 'GET'}, respondWith: () => assert.fail('Worker intercepted an unrelated request')});
  }
  console.log('Passed: worker install, cache cleanup, offline shell, repository scope, and external-link bypass.');
})().catch(error => { console.error(error); process.exitCode = 1; });

// Verify the handoff uses the draft even though the form is cleared first.
(async () => {
  const elements = Object.fromEntries(['composer', 'recipient', 'date', 'time', 'message', 'create', 'copy', 'status', 'validation', 'manual-copy', 'link'].map(id => [id, {
    value: '', handlers: {}, addEventListener(name, handler) { this.handlers[name] = handler; }
  }]));
  elements.composer.reset = () => {
    for (const name of ['recipient', 'date', 'time', 'message']) elements[name].value = '';
  };
  elements.composer.reportValidity = () => true;
  const draft = {recipient: 'Family & friends', ...localFields(new Date(Date.now() + 86400000)), message: 'Hello 👋\nSee you soon!'};
  let stored = JSON.stringify(draft);
  let copied;
  const window = {location: {}, addEventListener() {}};
  const context = {
    document: {querySelector: selector => elements[selector.slice(1)], getElementById: id => elements[id], addEventListener() {}},
    window,
    localStorage: {getItem: () => stored, setItem: (key, value) => { stored = value; }, removeItem: () => { stored = null; }},
    navigator: {clipboard: {writeText: async value => { copied = value; }}},
    setInterval() {}
  };
  vm.runInNewContext(fs.readFileSync('app.js', 'utf8'), context);
  elements.composer.handlers.submit({preventDefault() {}});
  const expected = buildThingsUrl(draft.recipient, draft.date, draft.time, draft.message);
  assert.equal(window.location.href, expected);
  assert.equal(elements.recipient.value, '');
  assert.equal(elements.message.value, '');
  assert.equal(stored, null);
  assert.ok(new Date(`${elements.date.value}T${elements.time.value}`) > new Date());
  assert.equal(elements.create.disabled, true);
  assert.equal(elements.copy.disabled, false);
  await elements.copy.handlers.click();
  assert.equal(copied, expected);
  elements.recipient.value = 'New draft';
  elements.composer.handlers.input();
  assert.equal(elements.copy.disabled, true);
  assert.equal(JSON.parse(stored).recipient, 'New draft');
  window.location.href = '';
  elements.composer.handlers.submit({preventDefault() {}});
  assert.equal(elements.recipient.value, 'New draft');
  assert.equal(window.location.href, '');
  console.log('Passed: submit clears form/storage, preserves handoff and copy fallback, and keeps invalid drafts.');
})().catch(error => { console.error(error); process.exitCode = 1; });
