# WhatsApp Later

A small, dependency-free iPhone PWA. Write a message, pick a local reminder time, and open Things 3 to create a to-do. Things reminds you; you open the WhatsApp link, choose the chat or group, and press Send yourself.

## Deploy to GitHub Pages

1. Push these files to a GitHub repository.
2. In **Settings → Pages**, choose **Deploy from a branch**, your branch (usually `main`), and **/ (root)**. Save.
3. Open the resulting HTTPS Pages URL in iPhone Safari. All asset paths support repository subdirectories. There is no install or build step.

For a local preview, run `python3 -m http.server 8000` and open `http://localhost:8000`. Service workers need HTTPS or localhost. A phone opening a computer's HTTP LAN address can preview the form but cannot install the offline worker.

## Add to iPhone Home Screen

In Safari, open the deployed app, tap **Share → Add to Home Screen**, and confirm. Open it online once so the app shell can be cached. Thereafter the form and link generation work offline. Things and WhatsApp must already be installed; sending still needs connectivity.

## Use

Enter a person or group name, select a future date and time, and write your message. Tap **Create in Things →**. Enable Things URLs if Things asks on first use. The task title is `WhatsApp {name}`; its notes contain the recipient-free `https://wa.me/?text=…` link. The name labels your reminder only. No contact information or phone number is used.

The local time is passed directly as `YYYY-MM-DD@HH:mm`, never converted to UTC. See the [official Things URL documentation](https://culturedcode.com/things/support/articles/2803573/) for `add`, reminders, `reveal`, and parameter limits. Creating a new task requires no authorization token.

If Things does not open, use **Copy link**. If clipboard access is unavailable, the link appears in a selectable field for manual copying. Opening an app URL cannot confirm task creation; check the new task in Things. Avoid repeated taps that could create duplicates.

The draft stays in this browser's localStorage, including after switching apps. Storage failures do not prevent composing. Safari and the Home Screen app may have separate storage. A saved time that has passed remains visible and must be changed. Long messages are preserved, but creation is disabled when the encoded WhatsApp URL exceeds Things' 10,000-character notes limit; recipient titles are limited to 4,000 characters. Times skipped by daylight saving changes are rejected; ambiguous fall-back times follow the device's local interpretation.

## Verification

Run `node --check app.js`, `node --check sw.js`, and `node tests.js`. Tests use only Node's built-in modules, with no packages or build step. They check nested encoding, Unicode, line breaks, punctuation, long text, invalid/past dates, daylight saving gaps, and local formatting in multiple timezones.

Real iPhone checks (not verified by automated tests):

- In Safari and Home Screen mode, open Things and confirm title, local date, reminder time, revealed task, and exact notes URL. Enable Things URLs on first use. Allow Things notifications and confirm the timed reminder arrives.
- Open the notes link with WhatsApp installed. Confirm recipient selection supports both people and groups, preserves the message including emojis and newlines, and requires a manual Send. Recipient-free link behavior can vary with platform and WhatsApp version.
- Try Things missing or URL handling disabled; check Copy link and manual copy fallback. No successful-creation message should appear.
- Check narrow iPhones, keyboard scrolling, native pickers, safe areas, light/dark mode, and larger text.
- Save a draft, switch to Things, return, close/reopen, and verify it remains. Advance past the selected time and confirm creation is disabled.
- After the first online visit, reopen in airplane mode and construct/copy a link. WhatsApp sending is not an offline feature.
- For an app update, bump `CACHE` in `sw.js` whenever shell files change. Reopen online, then close all app/Safari tabs within its scope and reopen so the waiting worker activates. Updates replace the entire cached shell together.

No notifications, automatic sending, analytics, external assets, APIs, backend, or dependencies are used.
