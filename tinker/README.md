# Tinker (experiment)

A layer one step above a student's app: sliders, color pickers and text boxes that each edit **one
value on one real line of her code**, with that line shown and the value highlighted.

The work is split in two:

- **The model does the reasoning.** You (the teacher) paste the **Tinker knobs** prompt from the
  [prompt kit](../prompts.html#tinker) and a student's HTML into whichever model you like. It answers with a short knob list (JSON). It never reprints her
  app, so there's no truncation and no silent rewrite.
- **This page does the dependable part.** It finds each quoted snippet in her file, skips any that
  aren't there exactly once (marked in red, and the app still runs), and rebuilds the preview from
  her original file plus the changed values. **Download my version** saves the edited HTML, and
  **What I changed** gives a line-by-line list.

## Making one to hand out

1. Run the Tinker knobs prompt + her HTML through a model. Save its answer as-is (a sentence before it or code
   fences around it are fine), e.g. `knobs.txt`.
2. Run:

   ```sh
   python3 tinker/build.py path/to/her-app.html knobs.txt
   ```

   It checks every knob against her file first, using the same rules as the page:

   ```
     ok    line  300  Home end zone color
     FAIL           Made-up line  (code not found in the app (mis-copied?))
   8 of 9 knobs match her-app.html
   wrote path/to/her-app-tinker.html
   ```

   Fix or drop any FAIL lines, or keep them (they show red and are skipped). Use `-o` to pick the
   output name and `--strict` to write nothing unless every knob matches.
3. Give her the one `*-tinker.html` file. It works offline, apart from any CDN links in her own app.

`index.html` is the football example, rebuilt with `python3 tinker/build.py` (no arguments).
`template.html` opens empty with a paste box, for trying things by hand.

## Found while testing the football example

The **Words in the goal** knob seems to do nothing, and the original app has the same problem: "GOAL"
never shows up. The `ctx.restore()` after "START" undoes the white color and the font, so "GOAL" is
drawn in the end zone's own blue at the default size. It's a real bug, and it's the kind of question
the knobs are meant to raise ("I changed it and nothing happened. Why?").

## Not tested yet

How well a given model follows the prompt (exact snippets, unique, JSON only). The build report
shows this for each run. The example knob list was written by hand to match the prompt.
