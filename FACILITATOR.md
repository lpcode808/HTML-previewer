# Facilitator guide: Gemini → Paste → Preview → Modify → Download

A one-page guide for running a hands-on session with the HTML Playground.

## Before the session (10 minutes)

- **Open the playground link on the venue Wi-Fi** and click **Try a sample first**. Then paste one app you made with Gemini earlier, ideally one that uses an online library, to check that the network allows it.
- **Put the link on a slide as text and as a QR code.** Shorter is better. Consider a link shortener or a custom domain.
- **Check that attendees can reach Gemini** (gemini.google.com) and sign in with a personal Google account. School-managed accounts sometimes have Gemini turned off.
- **Check downloads on managed devices.** School Chromebooks and laptops sometimes block downloads. If they do, attendees can use **Copy code** and paste into an email to themselves instead.
- **Have a backup:** a ZIP of this repository on a USB stick. Double-click `index.html` and the playground runs without internet. Creations that load online libraries still need internet.

## The flow (show it once, live: about 3 minutes)

1. **Gemini: ask.** Describe the app, then add the magic sentence (it's also in the playground's Help, with a copy button):
   > Make it a single HTML file with all of the CSS and JavaScript inside it. Don't use React, Tailwind, or other outside libraries. Give me the complete file in one code block.

   This also makes the downloaded file work without internet.
2. **Copy.** Use the copy button on Gemini's code box. If Gemini opens a side panel (Canvas), switch it to show the code and copy all of it.
3. **Paste.** In the playground, click **Paste what I copied**, or click in the code box and press Ctrl + V (⌘ + V on a Mac). The creation appears on the right.
   - The first time someone clicks **Paste what I copied**, Chrome may ask to "see text and images copied to the clipboard". Tell them to click **Allow**. If they click Block, or the device doesn't allow it, the playground tells them to press Ctrl + V instead, which always works.
   - If they copied Gemini's whole answer, including its chat text, the playground removes the extra text by itself and offers **Undo**.
4. **Preview.** Click and play with it on the right side. **Full screen** is good for showing it to the room.
5. **Modify.** There are two ways:
   - **Change it yourself.** Point out a color or a sentence in the code and change it. The preview updates after a moment.
   - **Ask Gemini.** For example: "Make the buttons bigger and add a score counter. Give me the complete updated file." Copy the new code and paste it into the code box (or click **Paste**). A complete new version replaces the old one by itself, and an **Undo** button appears for a few seconds.
   - **Update as I type** (under the preview) is on by default. Turn it off if the creation keeps restarting while someone edits, and press **Run** when ready.
6. **Download.** Click **Download** to save `my-creation.html` to the Downloads folder. Double-click it to open it in a browser, with no website needed. To share it, send the file. Recipients should download it and open it in a browser, because Google Drive and some email apps show the code instead of running it.

## Starter prompts for educators

- "Make an interactive 5-question multiple-choice quiz about the water cycle for 6th graders. Show a score at the end and let students try again."
- "Make a fraction pizza: a slider picks the number of slices, clicking slices colors them in, and it shows the fraction."
- "Make a random name picker for my class. I can paste a list of names, and a big button spins and picks one."
- "Make a 2-minute timer with big numbers and a calm sound when it ends."
- "Make a vocabulary flashcard game for Spanish colors: click the card to flip it, with arrows to go to the next one."

Add the magic sentence to each one.

## Troubleshooting

| What they see | What to do |
| --- | --- |
| A yellow note saying extra text was copied | Click **Clean it up**. They copied the chat words or the ``` marks along with the code. |
| "This code can't run here" (React) | Click **Copy a request for Gemini**, paste it into Gemini, then paste the new code. |
| A note saying the end of the code is missing | Gemini's answer was cut off (common for long apps). Click **Copy a request for Gemini** to ask for the complete file. |
| A yellow problem bar under the preview | Click **Copy for Gemini**, paste it into Gemini, and paste the fixed code back. **Show line** highlights the line. |
| Blank preview, no message | Only part of the code was copied. Copy again. It should start with `<!DOCTYPE html>` and end with `</html>`. |
| The page froze | Close the tab (or wait for "Page unresponsive" and click **Exit page**), then open the link again. It opens paused, so they can fix the code or ask Gemini, then press **Run**. If that doesn't help, add `?safe` to the end of the address. |
| "Not saved on this device" | They're in a private window, or storage is blocked. Everything works, but they must **Download** before closing. |
| Images or fonts missing | Those load from the internet. Check the Wi-Fi, or ask Gemini to use emoji or drawn shapes instead. |
| A saved high score resets | That's expected in the preview. It's kept in the downloaded file. |
| Camera, microphone, or location doesn't work | Those are blocked in the preview for safety. Try the downloaded file. |

## Talking points about safety (30 seconds)

- Nothing they paste is uploaded. It stays in their browser.
- Their creation runs in a locked box. It can't see the playground or anything saved on their computer.
- It can still reach the internet, like any web page. Only run code from sources they trust.
