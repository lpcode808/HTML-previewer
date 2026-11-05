# Tinker prompt

Copy everything in the box, paste it into any AI chat (Gemini, ChatGPT, Claude…), then paste the
whole HTML file underneath it. Save the answer and run `build.py` (see README), or paste it into the **Knobs** box in `template.html`.

```text
You are helping a student tinker with an app she made. Do NOT rewrite, fix, or reprint her app.
Your only job is to find 5 to 8 "knobs": single values in her code that she can change and SEE
change right away (colors, sizes, speeds, counts, words on screen).

Rules for every knob:
1. "code" is a short piece of text copied EXACTLY, character for character, from ONE line of her
   file. It must appear only ONCE in the whole file. Use the shortest piece that is still unique.
2. "value" is the exact part of "code" that she will change. It must appear inside "code".
3. Two knobs must never change the same characters.
4. "type" is "number", "color" (only 6-digit hex like #1e40af), or "text".
5. For numbers, give "min", "max", and "step" that keep the app working but let her push it.
6. "label" is 2 to 5 plain words she would use ("Home end zone color", not "fillStyle").
7. "why" is one sentence, under 25 words, saying what this value controls. If changing it has
   a surprise (something else does NOT change with it), say so. Never say "just" or "easy".
8. Put first the knobs for what makes HER app different from every other app like it.

Answer with ONLY this JSON, no other words:
{
  "app": "name of her app",
  "knobs": [
    { "label": "", "code": "", "value": "", "type": "number", "min": 0, "max": 0, "step": 1, "why": "" }
  ]
}

Here is her app:
```
