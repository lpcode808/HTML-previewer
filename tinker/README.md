# Tinker (experiment)

A layer one step above a student's app: sliders, color pickers and text boxes that each edit **one
value on one real line of her code**, with that line shown and the value highlighted.

The work is split in two:

- **The AI does the reasoning.** The student pastes [`PROMPT.md`](PROMPT.md) and her HTML into any AI.
  It answers with a short knob list (JSON). It never reprints her app, so there's no truncation and no
  silent rewrite.
- **This page does the dependable part.** It finds each quoted snippet in her file, refuses any that
  aren't there exactly once (marked in red, and the app still runs), and rebuilds the preview from
  her original file plus the changed values. **Download my version** saves the edited HTML, and
  **What I changed** gives a line-by-line list.

`index.html` opens with the football timer example built in. `template.html` opens empty.
After editing an example, run `python3 tinker/build.py`.

## Found while testing the football example

The **Words in the goal** knob seems to do nothing, and the original app has the same problem: "GOAL"
never shows up. The `ctx.restore()` after "START" undoes the white color and the font, so "GOAL" is
drawn in the end zone's own blue at the default size. It's a real bug, and it's the kind of question
the knobs are meant to raise ("I changed it and nothing happened. Why?").

## Not tested yet

Whether free Gemini follows `PROMPT.md`: copies snippets exactly, keeps each one unique, and returns
only JSON. The example knob list was written by hand to match the prompt.
