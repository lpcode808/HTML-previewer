# HTML Playground

**Paste. Play. Take it home.** A zero-setup web page for workshops: participants paste the HTML that Google Gemini (or any AI chat) gives them, and their creation runs right next to the code. There's no account, no install, no server, and nothing gets uploaded.

- Paste a complete HTML document (with its CSS and JavaScript) and it runs immediately.
- The preview updates as you type (after a short pause). The **Update as I type** switch turns this off, and **Run**/**Restart** (Ctrl/⌘ + Enter) runs it by hand.
- Pasting a complete new version replaces the old code instead of mixing the two, with Undo.
- **Download** saves the exact code as `my-creation.html`, which opens in any browser.
- Code is autosaved in the browser ("Saved on this device"), so a refresh doesn't lose work.
- Other features: a resizable split, full-screen preview, a sample project, word wrap, and a phone layout with tabs.
- Plain-language help for common mistakes:
  - Gemini's chat text copied along with the code is removed automatically.
  - React code, or answers that were cut off, get a ready-made request for Gemini.
  - JavaScript errors get a **Copy for Gemini** button.
  - Creations that freeze the page open paused on the next visit.

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
 │ Download → Blob of exact code  │            │   allow-popups                   │
 │                                │ ◀───────── │   allow-pointer-lock">           │
 │ shows error text only          │ postMessage│   helper + your code             │
 └────────────────────────────────┘ (data)     └──────────────────────────────────┘
```

- **The parent never runs pasted code.** It is only placed into the `srcdoc` of a fresh `<iframe>` on each run.
- **The sandbox has no `allow-same-origin`.** The preview gets an opaque origin, so it can't read or change the playground page, its saved code, or its storage.
- **The sandbox has no `allow-top-navigation` or `allow-popups-to-escape-sandbox`.** The preview can't replace the playground page, and any pop-up it opens keeps the same restrictions.
- **The sandbox has no `allow-downloads`.** Without it, a pasted page could save files to the Downloads folder without a click.
- **The `allow` attribute grants only `fullscreen; clipboard-write; autoplay`.** Camera, microphone and location aren't granted.
- **A small helper runs inside the preview only, never in downloads.** It's inserted right after `<!DOCTYPE …>` on the same line, so line numbers and standards mode stay the same. It does three things:
  1. It reports uncaught errors and failed script/stylesheet loads to the parent. The parent accepts a message only from the current iframe's window, with the current run's id, and only reads string and number fields. It only ever shows the message as plain text. Messages can't trigger any action. The run id isn't a secret; it only filters out messages from earlier runs.
  2. It installs stand-ins for `localStorage`/`sessionStorage`. A sandboxed page would otherwise throw on access. For `localStorage`, the playground copies what your creation saves into its own namespaced storage (keyed by a fingerprint of your code) and puts it back on the next run. `sessionStorage` stays in-memory only. Your creation still cannot read the playground's saved code.
  3. It tells the parent when the creation tries to download a file, so the playground can explain that **Download** at the top is the way to save.
- **Freeze recovery.**
  - While a preview runs, the tab writes a "still alive" note to localStorage every second. Each tab has its own note.
  - A normal close removes the note. If pasted code freezes the tab, the notes stop.
  - On the next visit, a stale note (over 3 s old) means the code froze the page, so the playground opens paused with "Update as I type" off. A fresh note might belong to another working tab, so it waits a moment to see whether that note updates.
  - Hidden tabs, which browsers slow down, don't count.
  - Adding `?safe` to the URL also opens it paused.
- **Two tabs.** If another tab saves different code, this tab stops autosaving and asks which version to keep, instead of silently overwriting it.
- **Download** writes the editor text byte-for-byte (UTF-8).
  - The only addition is for files with non-ASCII characters but no `<meta charset>` near the top: they get an invisible UTF-8 byte-order mark, so they don't show garbled text when opened from disk.
  - The file is served as `application/octet-stream`. That way, even a browser that ignores the `download` attribute won't render it as a page on the playground's origin.
- **All code analysis runs in linear time.** That covers the paste hints, finding the doctype, and the charset check. Odd or hostile input can't make the playground itself freeze, which matters because a freeze here would happen before safe mode could help.
- **There's deliberately no Content-Security-Policy on the parent.** A `srcdoc` iframe inherits its parent's CSP, so a strict policy would break pasted inline scripts and CDN libraries. The parent stays safe another way: it never inserts untrusted text as HTML (only `textContent`).

### Limitations (please read)

- **The preview can still use the network.** Pasted code can load images, fonts, and libraries from other sites, and it can send data to them. Only run code you trust. Without internet access, CDN-based code won't work.
- **Code can still use lots of CPU or memory.** An endless loop can freeze the tab, because in many browsers the preview shares the page's thread. Freeze recovery (above) gets the participant back in, but it can't stop the freeze itself.
- **Saved data in the preview.** `localStorage` inside your creation is remembered on this device for the code you pasted (refresh and **Restart** keep it). It is stored separately from the playground's own saved code; use **Clear preview data** to wipe it. `sessionStorage` still resets when the preview restarts. Cookies, IndexedDB, camera, microphone, location, and file downloads aren't available in the preview. These usually work normally in the downloaded file.
- **In-app download buttons** cannot save files in the preview (the sandbox blocks it). The playground shows a notice; use **Download** at the top for your HTML file.
- **Clipboard and pop-up messages.** A creation can write to the clipboard when clicked (`clipboard-write` is allowed so "Copy" buttons work), and it can show `alert()` dialogs, including endless ones. The Help text tells people never to paste commands from a web page into other programs.
- **Problem messages come from the creation itself.** Pasted code can fake them, so the problem bar is labeled as coming from "your creation".
- **Pages without `<!DOCTYPE html>`.** The preview always uses standards mode, because `srcdoc` documents are never in quirks mode. The downloaded file opens in quirks mode, so its layout can differ slightly. Gemini output nearly always includes the doctype.
- **Pop-ups and new-tab links keep the sandbox.** Sites that need sign-in or cookies may not work in them.
- **There are no relative files.** `<img src="cat.png">` can't work, because there's only the one pasted file.
- **Error details from scripts on other sites** show only as "Script error." That's a browser rule.
- **Saved code lives in this browser on this device only**, under keys like `html-playground:v1:/HTML-previewer/:code`.
  - Private windows or blocked storage show "Not saved on this device", and a warning appears before leaving the page.
  - Very large code (over about 5 MB) is too big to autosave. The old saved copy is removed rather than restored later as if it were current, and leaving the page warns first.
  - Very large files (several MB) also make typing slow, as in any plain text box.
- **Every GitHub Pages site under the same account shares one origin**, e.g. all of `https://<user>.github.io/*`. Every other Pages site on the account, and any third-party script those sites load, can:
  - read or replace the saved code,
  - open and script the playground page directly,
  - and, from a root `<user>.github.io` site, register a service worker that replaces `app.js`.

  So publish the playground from an account or organization whose other Pages sites you trust, or give it a custom domain. Forks on the same account keep separate saved code, because the folder is part of the storage key.
- **GitHub Pages can't send security headers.** Other sites could frame the playground (clickjacking). The impact is low, because everything is local and Clear asks first and can be undone. Keep **Enforce HTTPS** on in the Pages settings.
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
