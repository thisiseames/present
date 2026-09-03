# Present

*Now is the only place you've ever been.*

One short piece of writing at a time, on not living in yesterday and tomorrow. A
notification every hour from 7am to midnight; the notification is the whole piece.
Open the app and you see the current one. The earlier ones are gone.

No account, no database, no server. A static page on GitHub Pages, plus one
scheduled GitHub Action that sends the notifications.

---

## How it works

- **`pieces.js`** — the writing, one string per entry. Add more by appending.
- **`selection.js`** — the current piece is a pure function of the clock. A seeded
  shuffle walks the pool one hour at a time and reshuffles each time it completes a
  full pass, so nothing repeats within a cycle. At 80 pieces a cycle is ~5 days;
  it stretches on its own as you add more.
- **`sw.js`** — service worker: caches the shell for offline, shows the push.
- **`scripts/notify.mjs`** — run hourly by `.github/workflows/notify.yml`. Works
  out the current piece and pushes it to every device in `subscriptions.json`.
  Records the last slot in `state.json` so it never double-sends (those commits
  also keep the scheduled Action from going dormant).

## Deploy

```
npm install
npm run deploy
```

`deploy` creates the GitHub repo, pushes, encrypts and sets the three push
secrets, turns on Pages, and prints the live URL. It needs a GitHub token with
`repo` + `workflow` scope — from `GITHUB_TOKEN`, `./.github-token.local`, or
`../eames-ig-queue/.github-token.local`.

VAPID keys are already generated (`.vapid.local.json`, gitignored; public half is
in `config.js`). To roll new ones: `npm run vapid`, update both places.

## Add a device (once per device)

1. Open the site on the device, tap **Turn on notifications**, allow.
2. It shows one line of JSON. Copy it.
3. Edit `subscriptions.json`, paste the line inside the `[]`, commit, push.

That device now gets the hourly piece.

## Local check

```
npm install
npm run icons
npm run dev                 # serves at http://localhost:4173
npm run notify -- --force   # sends one now (needs VAPID_* in your env)
```

## Changing things

- **Schedule / timezone** — `SLOT_HOURS` and `TZ` in `selection.js`.
- **The writing** — `pieces.js`.
- **Anything shipped to the browser changed** — bump `CACHE` in `sw.js`.
