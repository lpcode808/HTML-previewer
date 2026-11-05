# AGENTS.md — HTML-previewer

Start here for any agent session (Claude Code, Codex, Cursor, cloud or desktop).

## What this is

**HTML Playground**: a static web page for workshops. People paste the HTML that Gemini (or any AI
chat) gives them, and it runs next to the code. No account, no install, no server. The audience is
beginners, mostly students on school laptops and phones, so every message on the page is plain
language.

Live at **https://lpcode808.github.io/HTML-previewer/**.

## Rules that matter most

1. **This repo is public.** No student work, student names, school or class details, or teaching
   notes. Examples are the owner's own apps or ones you make. Class planning and evidence live in
   the private `lpcode808/INTERNAL-Steam26-dev` repo.
2. **`main` is live.** GitHub Pages deploys `main` from the root folder, so every push to `main`
   publishes within a minute or two. Work on a branch and merge to `main` only when the owner asks.
3. **No build step, no dependencies.** Plain HTML, CSS and vanilla JavaScript. Everything must also
   work straight from disk (`file://`), so link to `index.html`, not `./`.
4. **Phones and dark mode both count.** Check the phone layout (about 375px wide) and both color
   schemes for anything visible.

## Map

| Path | What it is |
| --- | --- |
| `index.html`, `styles.css`, `app.js` | The playground (the landing page) |
| `prompts.html` | Prompt kit, linked quietly from the footer. **The only copy of the prompt text**: edit prompts here |
| `tinker/` | Experimental knob layer. Read [`tinker/README.md`](tinker/README.md) first |
| `tinker/template.html` | The tinker page's source |
| `tinker/index.html` | **Generated** (football example). Don't hand-edit; run `python3 tinker/build.py` |
| `tests/run-tests.mjs` | Browser tests for the playground |
| `FACILITATOR.md`, `TESTING.md` | Workshop guide; what was tested and what wasn't |

## Tests

Run the tests before pushing any change to the playground files:

```sh
cd tests && npm install && npm test
```

In a Claude Code cloud session, don't install Playwright (that version can't find the
preinstalled browser). Link the preinstalled copy instead:

```sh
mkdir -p tests/node_modules
ln -sfn /opt/node-tools/node_modules/playwright tests/node_modules/playwright
ln -sfn /opt/node-tools/node_modules/playwright-core tests/node_modules/playwright-core
node tests/run-tests.mjs
```

`node_modules/` and `tests/output/` are gitignored. Pages that aren't covered by the tests
(`prompts.html`, `tinker/`) still get a quick check in a headless browser before pushing.

## Open threads (as of 2026-11-05)

- Neither prompt in `prompts.html` has been run on a real model yet. That's the next test.
- The football example has a real bug that makes a good check: "GOAL" never shows, because the
  `ctx.restore()` after "START" resets the fill color. Does a model's learning guide notice it?
- The learning guide may end up as one more output of the owner's existing explainer pipeline
  rather than a separate tool. Not decided.

## On exit

- If behavior changed, update `README.md` (and `TESTING.md` or `tinker/README.md` where relevant).
- Update **Open threads** above when one closes or a new one opens. Keep it short.
- Session notes about class go in `INTERNAL-Steam26-dev/HANDOFF.md` if that repo is attached,
  never here.
