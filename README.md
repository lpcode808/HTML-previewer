# HTML Playground

**Paste. Play. Take it home.** A zero-setup web page for workshops: participants paste the HTML that Google Gemini (or any AI chat) gives them, and their creation runs right next to the code. There's no account, no install, no server, and nothing gets uploaded.

- Paste a complete HTML document (with its CSS and JavaScript) and it runs immediately.
- The preview updates as you edit (after a short pause), or when you press **Run** (Ctrl/⌘ + Enter).
- **Download** saves the exact code as `my-creation.html`, which opens in any browser.
- Code is autosaved in the browser ("Saved on this device"), so a refresh doesn't lose work.
- Other features: a resizable split, full-screen preview, a sample project, word wrap, and a phone layout with tabs.
- Plain-language help for common mistakes: copied chat text or ``` marks, React code, JavaScript errors (with a **Copy for Gemini** button), and creations that freeze the page.

For running a session, see the [facilitator guide](FACILITATOR.md). For what was tested and what wasn't, see [TESTING.md](TESTING.md).

## Publish it on GitHub Pages (about 2 minutes)

The site is just static files (`index.html`, `styles.css`, `app.js`). There's no build step.

1. On GitHub, open the repository and go to **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
3. Choose the branch with these files (for example `main`) and the folder **/ (root)**, then click **Save**.
4. Wait a minute or two and refresh the page. GitHub shows the address, e.g. `https://<your-user>.github.io/HTML-previewer/`.
5. Open that address and click **Try a sample first** to check it works. Then share the link (a QR code works well on a slide).

To update the site later, push to the same branch. Pages redeploys on its own.

**Offline backup:** download the repository as a ZIP and double-click `index.html`. The playground also works straight from disk.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The page: layout, help text, dialogs |
| `styles.css` | All styling (light/dark, desktop/phone layouts) |
| `app.js` | All behavior. Vanilla JavaScript with no dependencies. The sample project lives at the top. |
| `.nojekyll` | Tells GitHub Pages to serve the files as-is |
| `tests/` | Optional browser tests (not needed to use or deploy the site) |
| `FACILITATOR.md` | One-page guide for running a workshop |
| `TESTING.md` | Test results, review findings, and what's still unverified |

## How the preview works

```
 Parent page (github.io origin)                      Preview (opaque "null" origin)
 ┌────────────────────────────────┐   srcdoc   ┌──────────────────────────────────┐
 │ <textarea> your code           │ ─────────▶ │ <iframe sandbox="allow-scripts   │
 │ autosave → localStorage        │            │   allow-modals allow-forms       │
 │ Download → Blob of exact code  │            │   allow-popups allow-pointer-lock│
 │                                │ ◀───────── │   allow-downloads">              │
 │ shows error text only          │ postMessage│   helper + your code             │
 └────────────────────────────────┘ (data)     └──────────────────────────────────┘
```

- **The parent never runs pasted code.** It is only placed into the `srcdoc` of a fresh `<iframe>` on each run.
- **The sandbox has no `allow-same-origin`.** The preview gets an opaque origin, so it can't read or change the playground page, its saved code, or its storage.
- **The sandbox has no `allow-top-navigation` or `allow-popups-to-escape-sandbox`.** The preview can't replace the playground page, and any pop-up it opens keeps the same restrictions.
- **The `allow` attribute grants only `fullscreen; clipboard-write; autoplay`.** Camera, microphone and location aren't granted.
- **A small helper runs inside the preview only, never in downloads.** It's inserted right after `<!DOCTYPE …>` on the same line, so line numbers and standards mode stay the same. It does two things:
  1. It reports uncaught errors and failed script/stylesheet loads to the parent. The parent accepts a message only from the current iframe's window, with the current run's id, and only ever shows it as plain text. Messages can't trigger any action.
  2. It installs in-memory stand-ins for `localStorage`/`sessionStorage`. A sandboxed page would otherwise throw on access, and many Gemini apps save scores that way.
- **Freeze recovery.** Before each run, a "run pending" marker is saved, and it's cleared 3 seconds after the preview loads (or on a normal page close). If pasted code freezes the tab, the marker survives, and the next visit opens paused with auto-update off. Adding `?safe` to the URL does the same thing.
- **Download** writes the editor text byte-for-byte (UTF-8). The only exception is files with non-ASCII characters but no `<meta charset>`: they get an invisible UTF-8 byte-order mark so they don't show garbled text when opened from disk.
- **There's deliberately no Content-Security-Policy on the parent.** A `srcdoc` iframe inherits its parent's CSP, so a strict policy would break pasted inline scripts and CDN libraries. The parent stays safe another way: it never inserts untrusted text as HTML (only `textContent`).

### Limitations (please read)

- **The preview can still use the network.** Pasted code can load images, fonts, and libraries from other sites, and it can send data to them. Only run code you trust. Without internet access, CDN-based code won't work.
- **Code can still use lots of CPU or memory.** An endless loop can freeze the tab, because in many browsers the preview shares the page's thread. Freeze recovery (above) gets the participant back in, but it can't stop the freeze itself.
- **Saved data inside a creation is temporary in the preview.** `localStorage`/`sessionStorage` work but are forgotten on each restart. Cookies, IndexedDB, camera, microphone, and location aren't available. These usually work normally in the downloaded file.
- **Pop-ups and new-tab links keep the sandbox.** Sites that need sign-in or cookies may not work in them.
- **There are no relative files.** `<img src="cat.png">` can't work, because there's only the one pasted file.
- **Error details from scripts on other sites** show only as "Script error." That's a browser rule.
- **Saved code lives in this browser on this device only**, under keys starting with `html-playground:v1:`. Private windows or blocked storage show "Not saved on this device", and a warning appears before leaving the page. Very large code (over about 5 MB) may be too big to autosave.
- **Every GitHub Pages site under the same account shares one origin**, e.g. all of `https://<user>.github.io/*`. Other Pages projects on that account could read the saved code. For a workshop tool this is usually fine. If not, host it on its own account or a custom domain.
- The textarea turns Windows line endings (CRLF) into LF. This doesn't change how the page works.

## Privacy

There are no analytics, cookies, accounts, external fonts, or third-party scripts in the playground itself. The only network requests come from the participant's own pasted code.

## Running the tests (optional)

```sh
cd tests
npm install        # installs Playwright; run `npx playwright install chromium` if you have no browser
npm test
```

The tests start a small static server for the repository and drive Chromium through each scenario. See [TESTING.md](TESTING.md).
