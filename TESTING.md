# Testing and evaluation

## Summary

- **Automated:** 28 browser tests pass in Chromium (Playwright, headless, Linux). Run them with `cd tests && npm install && npx playwright install chromium && npm test`.
- **Reviews:** three evaluation passes, each followed by fixes:
  1. my own visual and behavioral review,
  2. an independent usability walkthrough role-playing a first-time attendee who has never written HTML,
  3. an independent security and reliability review that tried to break the sandbox.
- **Not verified:** Firefox, Safari, iOS and Android devices, the real Gemini interface, and the live GitHub Pages deployment. See the end of this file.

## Automated tests (`tests/run-tests.mjs`)

The suite starts a plain static file server for the repository, as GitHub Pages does, and drives Chromium.

| # | Scenario | What is checked | Result |
| --- | --- | --- | --- |
| 1 | First visit | The empty-state instruction is shown. There's no preview frame yet. Copy, Clear, Run and Full screen stay disabled until there is code. No console errors. | Pass |
| 2 | Paste a full document (real Ctrl+V) | The preview runs. Button clicks, slider `input` events, `setInterval`, `requestAnimationFrame`, CSS animation, SVG geometry, canvas pixels, form submit handlers, embedded CSS, and the `localStorage` stand-in all work. Standards mode is kept, and the helper removes its own `<script>`. | Pass |
| 3 | Repeated edits | Fast typing causes **one** restart after the pause, not one per keystroke. Several versions appear in turn. With "Update as I type" off, nothing restarts until **Run**. Ctrl+Enter runs. | Pass |
| 4 | Isolation | The preview can't read `parent.document`, `top.document` or `parent.localStorage`, and cookies throw. Its origin is `null`. Its storage is an empty stand-in that can't see the playground's saved code. `top.location`, `<a target=_top>` and `<form target=_top>` don't navigate the playground. The sandbox has no `allow-same-origin`, `allow-top-navigation`, `allow-popups-to-escape-sandbox` or `allow-downloads`. Forged messages show as text: an `<img onerror>` payload is shown literally and never runs. Messages for another run are ignored, and malformed message shapes don't throw. | Pass |
| 5 | Refresh | Code returns after reload and runs, with a "Welcome back" message. Reloading right after typing (before the autosave delay) still keeps the last keystroke. A normal reload never triggers safe mode. | Pass |
| 6 | Download | The file is named `my-creation.html`, and its bytes are identical to the editor. Opened via `file://`, it runs and is interactive, with the emoji intact. A no-charset file with accents/emoji gets a BOM and displays correctly. An empty editor gives a friendly message. | Pass |
| 7 | Malformed HTML/JS | Unclosed tags plus a JavaScript syntax error render what they can, and the error is reported. A runtime error shows the **correct line number**. **Show line** selects that line. **Copy for Gemini** produces a ready-to-send request. Promise rejections, failed external scripts and endless error loops don't affect the parent, which stays fully usable. | Pass |
| 7b | Endless loop | The loop really does freeze the parent in this Chromium build. After closing the tab, the next visit opens **paused**, with the code still there and "Update as I type" off. The visit after that is normal. | Pass |
| 7c | `?safe` | Opens paused, and **Run it now** works. | Pass |
| 7d | Late freeze / second tab | A freeze 4.5 s after the creation starts is still caught. A second healthy tab opens normally, with no false "stopped responding" message. | Pass |
| 7e | Two tabs | When tab B saves newer work, tab A stops autosaving and asks which version to keep. Tab A doesn't overwrite B. | Pass |
| 7f | Hostile/odd input | 40 comments without a doctype, 60k blank lines, 120k unclosed tags, 40k unclosed comments and 40k unclosed `<meta` each take under 1.5 s from paste to run. Download stays quick. | Pass |
| 8 | Long file (20,009 lines, ~1 MB) | Rendered in a few seconds. The line count is correct. An error on line 20,006 is reported with the right number, and **Show line** scrolls there. Typing stays responsive. | Pass |
| 8b | 11 MB of code | Autosave fails gracefully: it shows "Too big to save here" and leaves no stale copy to be restored later. The preview still works. | Pass |
| 8c | Narrow screens (320, 390, 768 px) | Tabs replace side-by-side panes. There's no horizontal page scroll. Pasting switches to the Preview tab automatically. | Pass |
| 8d | Paste button on phone | At 390 px width, **Paste what I copied** switches to the Preview tab and runs the code. | Pass |
| 9 | Clear / Sample / keyboard | Clear and Sample ask first. Cancel and Esc keep the code. **Cancel** is focused by default. **Download my code first** works from the dialog. **Undo** restores. The divider moves by arrow keys and mouse drag and remembers its position. Keyboard focus rings are visible. Ctrl+S explains saving. Wrap on/off, Full screen on/off, and Help (opens at a section, closes with Esc) all work. | Pass |
| 9b | Focus grabbing | A creation that calls `.focus()` on start doesn't steal keystrokes from the editor. Without the guard this test fails (checked by disabling it). | Pass |
| 9c | Paste helper | Gemini's chat text and ``` fences are removed automatically on paste, and Undo restores exactly what was pasted. React code gets a request to copy, and the preview explains it can't run. Cut-off answers and partial copies get hints. Normal documents get no hint. | Pass |
| 9f | Pasting a new version | A complete page pasted into the middle of old code **replaces** it (with Undo) instead of mixing two documents. A small snippet still inserts at the cursor. | Pass |
| 9d | Storage blocked | Shows "Not saved on this device". Everything else works. | Pass |
| 9e | Paste button | Reads the clipboard, replaces the code, and offers Undo. | Pass |
| 9g | Paste without clipboard permission | The Paste button shows a plain-language message to use Ctrl/⌘+V (or tap-and-hold on a phone). The editor stays unchanged. | Pass |
| 9h | Preview `localStorage` | Data survives a full page reload and **Restart** (including a creation that saves 150 times per run), stays separate from the playground's own storage keys, and **Clear preview data** resets it. | Pass |
| 9i | Blocked downloads | A programmatic in-preview download shows a bold banner above the preview frame before the toast, plus a toast pointing people to **Download**. | Pass |
| 9j | Gemini chat prose | Pasting chat prose (no HTML) shows the Canvas-specific hint; CSS-only paste keeps the generic non-HTML message. | Pass |
| 9k | iOS paste hint | With an iPhone user agent, hints appear near **Paste** and in Help. | Pass |
| 10 | Static hosting | Works from a plain static server **and** straight from disk (`file://`). No server logic is used. | Pass |

Each new reliability test (7d, 7e and 7f) was also run against the code from before its fix, and each one failed there. They are real regression tests.

## Evaluation passes and what changed

### Pass 0: experiments before building

- A sandboxed page throws on `localStorage`. Many Gemini apps save scores that way, so the preview gets an in-memory stand-in. Downloads are left untouched.
- A sandboxed iframe **can** take keyboard focus from the editor: in a quick experiment, keystrokes went into the preview. I added a short focus guard after each automatic restart.
- An endless loop in the preview froze the parent in this Chromium build. I added freeze recovery and `?safe`.
- Inline-script error line numbers are counted from the top of the document. The helper is inserted on the doctype's line, so they stay correct.

### Pass 1: my own review (screenshots at 1366, 1280, 1024, 390 and 320 px; light and dark)

- **Phone layout:** the header and toolbars wrapped into several rows. I shortened labels, hid pane titles behind the tabs, and made the buttons share one row.
- **Contrast:** in dark mode, the primary and Run colors with white text were below 4.5:1. The off-switch track was below 3:1. All are fixed.
- **Small bugs:** a double space in "Copy code" and dialog buttons wrapping. Fixed.
- **Accessibility:** toasts now use a live region that stays rendered, so screen readers announce them.

### Pass 2: usability walkthrough as a first-time attendee

**What worked:** the 30-second path succeeded on the first try. The reviewer also called out the clear headline, one primary button, the exact keystroke shown, instant run on paste, the error-bar tone, "Download my code first", Undo, the take-home help, and the phone tabs.

**Changes:**
- **Blocker fixed:** pasting Gemini's updated version into existing code inserted it at the cursor and produced two documents mashed together. A complete page pasted into existing code now replaces it, with Undo.
- Gemini's chat text and ``` marks are removed **automatically** on paste, with Undo. Before, a hint offered this, but people ignored it, and phones had already switched to the Preview tab where the hint isn't visible.
- React code is no longer run as a wall of text. The preview explains the problem and offers a ready-made request for Gemini.
- New hints for partial copies and for answers that were **cut off** (common with long apps).
- **Fewer programmer-style controls:**
  - "Auto-update" became **Update as I type** and moved under the preview.
  - The run button is a quiet **Restart** while updates are automatic, and a green **Run** only when an action is needed.
  - Buttons that need code are disabled until there is some.
  - The brief requires the Run button, the auto-run toggle and the wrap toggle, so all three stay.
- The prompt tip now also says "Don't use React, Tailwind, or other outside libraries". The result works offline and on weak conference Wi-Fi.
- Help wording now fits phones ("appears next to it (on a phone, tap Preview)").
- **Not changed:** naming downloads after the page `<title>`, because the brief specifies `my-creation.html`.

### Pass 3: security and reliability review

**Confirmed sound, empirically:**
- No HTML injection into the parent.
- The preview's origin is `null`. The parent DOM and storage, cookies, IndexedDB, caches and service workers are all unavailable to it.
- **13 top-navigation vectors** were tried, and all were blocked. A logging server received zero requests.
- Pop-ups inherit the sandbox in every variant, and `opener.top` is unreachable.
- Message source checks hold. Proxies can't be sent, and there's no prototype pollution.
- Download bytes are exact.
- No `Referer` is sent from the preview.

**Fixed:**
- **Medium:** a regex used to find the doctype took exponential time on many comments without a doctype; 30 comments took minutes and froze the playground. It's now a plain scan.
- **Medium:** several analysis regexes were quadratic on odd input and ran on every run, including in safe mode. They are rewritten to be linear, analysis is skipped above 2 MB, and the charset check only looks at the first 1 KB.
- **Medium:** two open tabs silently overwrote each other's saved code. The playground now detects this and asks.
- **Low–medium:** safe mode missed freezes more than 3 s after start, and showed a false banner when a second tab was open. It was replaced with per-tab heartbeats.
- **Low:**
  - When autosave failed for size, an older version was later "restored" as current. It's now removed, and leaving the page warns first.
  - The focus guard could undo a deliberate click if the pointer was already over the preview. It now respects the pointer position.
  - Malformed message fields could throw in the parent. Only string and number fields are read now.
  - The download Blob is now `application/octet-stream`, so a browser that ignores `download` can't render it as a page on the playground's origin.
  - Removed `allow-downloads`: with it, the preview could save files without a click.
  - The storage key now includes the folder, so forks on the same account don't collide.

**Documented as accepted limitations** (README and in-app Help):
- the preview can still use the network;
- the preview can write to the clipboard on click;
- endless `alert()` loops;
- fakeable problem messages;
- the shared `github.io` origin and service-worker risk (host on a trusted account or custom domain);
- no security headers on Pages;
- quirks mode differs between preview and download for pages without a doctype.

## What remains unverified

- **Firefox and Safari** (desktop and iOS), and **Android Chrome**, weren't tested; only Chromium was available. Specific open questions:
  - whether the `localStorage` stand-in installs (it relies on `window.localStorage` being configurable);
  - how the focus-guard timing behaves;
  - whether `navigator.clipboard.readText` prompts;
  - how the `download` attribute behaves on iOS;
  - process isolation of the sandboxed iframe, which decides whether an endless loop freezes the whole tab.
- **Desktop Chrome with a visible window.** The reviewer saw the preview get its own process in "new headless" mode, so loops didn't freeze the parent. Real desktop behavior wasn't observed directly.
- **The clipboard permission prompt** behind **Paste what I copied** can't appear in headless mode. The fallback (focus the box and press Ctrl+V) was tested.
- **The real Gemini interface.** Pastes were simulated with realistic outputs: full documents, chat text with fences, React/JSX, and partial or cut-off code. The exact text Gemini's copy buttons produce today wasn't checked.
- **The live GitHub Pages deployment** hasn't been published from this session. Everything was tested from a local static server and from `file://`, which is how Pages serves it.
- **Screen readers** weren't used. The ARIA roles, labels, live regions and focus order were checked in code and with keyboard-only navigation.
- **School-managed devices** (download or clipboard policies) and slow conference Wi-Fi weren't available.
