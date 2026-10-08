'use strict';

function buildThingsUrl(recipient, date, time, message) {
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
  return `things:///add?title=${encodeURIComponent(`WhatsApp ${recipient}`)}&when=${encodeURIComponent(`${date}@${time}`)}&notes=${encodeURIComponent(whatsappUrl)}&reveal=true`;
}

function localFields(date) {
  const pad = value => String(value).padStart(2, '0');
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`
  };
}

function draftError(draft, now = new Date()) {
  if (!draft.recipient.trim() || !draft.message.trim() || !draft.date || !draft.time) return 'Complete all three fields to create your reminder.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date) || !/^\d{2}:\d{2}$/.test(draft.time)) return 'Choose a valid date and time.';
  const selected = new Date(`${draft.date}T${draft.time}:00`);
  const fields = localFields(selected);
  if (!Number.isFinite(selected.getTime()) || fields.date !== draft.date || fields.time !== draft.time) return 'Choose a valid local date and time.';
  if (selected <= now) return 'Choose a time in the future.';
  if (`WhatsApp ${draft.recipient}`.length > 4000) return 'Use a shorter recipient name.';
  // Things limits notes to 10,000 characters, including the encoded WhatsApp URL.
  try {
    if (`https://wa.me/?text=${encodeURIComponent(draft.message)}`.length > 10000) return 'This message is too long for a Things link. Please shorten it.';
    encodeURIComponent(draft.recipient);
  } catch {
    return 'Your text contains an unsupported character. Please edit it and try again.';
  }
  return '';
}

if (typeof document !== 'undefined') {
  const form = document.querySelector('#composer');
  const inputs = Object.fromEntries(['recipient', 'date', 'time', 'message'].map(name => [name, document.getElementById(name)]));
  const create = document.querySelector('#create');
  const copy = document.querySelector('#copy');
  const status = document.querySelector('#status');
  const validation = document.querySelector('#validation');
  const storageKey = 'whatsapp-later-draft';
  const readDraft = () => Object.fromEntries(Object.entries(inputs).map(([name, input]) => [name, input.value]));
  const defaultTime = localFields(new Date(Math.ceil((Date.now() + 60 * 60 * 1000) / 60000) * 60000));
  inputs.date.value = defaultTime.date;
  inputs.time.value = defaultTime.time;
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved && typeof saved === 'object') {
      for (const [name, input] of Object.entries(inputs)) {
        if (typeof saved[name] === 'string') input.value = saved[name];
      }
    }
  } catch { /* The composer also works when storage is unavailable. */ }

  function refresh() {
    const draft = readDraft();
    const error = draftError(draft);
    inputs.date.min = localFields(new Date()).date;
    const earliest = localFields(new Date(Math.ceil((Date.now() + 1) / 60000) * 60000));
    inputs.time.min = draft.date === earliest.date ? earliest.time : '';
    create.disabled = copy.disabled = Boolean(error);
    validation.textContent = error && draft.recipient.trim() && draft.message.trim() ? error : '';
    return !error;
  }

  form.addEventListener('input', () => {
    status.textContent = '';
    document.querySelector('#manual-copy').hidden = true;
    refresh();
    try { localStorage.setItem(storageKey, JSON.stringify(readDraft())); } catch { /* Keep working without persistence. */ }
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!refresh() || !form.reportValidity()) return;
    const { recipient, date, time, message } = readDraft();
    status.textContent = 'Opening Things… If it doesn’t open, use Copy link.';
    window.location.href = buildThingsUrl(recipient, date, time, message);
  });
  copy.addEventListener('click', async () => {
    if (!refresh()) return;
    const { recipient, date, time, message } = readDraft();
    const url = buildThingsUrl(recipient, date, time, message);
    try {
      await navigator.clipboard.writeText(url);
      status.textContent = 'Things link copied.';
    } catch {
      const link = document.querySelector('#link');
      document.querySelector('#manual-copy').hidden = false;
      link.value = url;
      link.focus();
      link.select();
      status.textContent = 'Touch and hold the selected link to copy it.';
    }
  });
  window.addEventListener('pageshow', refresh);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  setInterval(refresh, 15000);
  refresh();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
}
