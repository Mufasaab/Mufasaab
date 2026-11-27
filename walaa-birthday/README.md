# Walaa's birthday garden

A small static website in four scenes: an intro, a memory garden, "Our story" (a slideshow) and a letter.
There is no build step. Everything you need to change is in **`config.js`**.

```
walaa-birthday/
├── index.html     page structure (no need to edit)
├── style.css      all styling     (no need to edit)
├── script.js      all behaviour   (no need to edit)
├── config.js      ALL texts, captions, media paths  <- edit this
└── media/         your photos, videos and optional music
```

---

## 1. Add your photos and videos

1. Put your files in the `media/` folder.
   - Photos: `.jpg`, `.jpeg`, `.png`, `.webp` (iPhone `.heic` only works in Safari, so export as JPG).
   - Videos: `.mp4` works everywhere. `.mov` from an iPhone usually works too, but `.mp4` is safest.
2. The easiest way is to **name your files like the placeholders** (`01.jpg`, `02.jpg`, `03.jpg`, `04.mp4`, ...)
   and overwrite them. You can also use any names you like, as long as `config.js` matches.
3. Recommended sizes (so it loads fast on a phone):
   - photos: about 1600–2000 px on the long side, under 1 MB each
   - videos: 1080p or 720p, under 20 MB each, ideally under 20 seconds
4. Delete placeholder files you no longer use.

> The site detects photo vs. video from the file extension, so a video is just a line with a `.mp4` path.

## 2. Edit `config.js`

Open `config.js` in any text editor (TextEdit, Notepad, VS Code).

### Memories
One line per photo or video, **in the order of the story**:

```js
{ day: "15 Nov", place: "Oceanogràfic", src: "media/03.jpg", caption: "Your words here", flower: "jasmine" },
```

| field     | meaning |
|-----------|---------|
| `day`     | shown on the card. When you have **more than 10 memories**, all memories with the same `day` share one seed and open as a swipeable gallery. |
| `place`   | shown next to the day |
| `src`     | path to the file, e.g. `media/03.jpg` or `media/04.mp4` |
| `caption` | the sentence under the photo |
| `flower`  | optional: `orange-blossom`, `rose`, `jasmine`, `tulip`, `lavender` |
| `poster`  | optional, videos only: an image shown before the video starts |

- You can have anywhere from 3 to 40 memories, mixing photos and videos. The garden arranges itself.
- Keep the commas between entries, and put quotes `"` around every text.
- Arabic text works everywhere (captions, the letter). Just type it.
- If a file is missing or broken, that memory is skipped quietly. Nothing breaks.

### The letter
`letter` is a list of paragraphs. Each `"..."` becomes one paragraph that fades in:

```js
letter: [
  "Habibti,",
  "First paragraph...",
  "Second paragraph...",
  "كل عام وأنتِ بخير"
],
signature: "Forever yours, Mustafa"
```

### Other settings
| setting           | default | meaning |
|-------------------|---------|---------|
| `title`           | `HAPPY BIRTHDAY HABIBTI ❤️` | the intro title |
| `photoSeconds`    | `6`     | seconds each photo stays in "Our story" |
| `maxVideoSeconds` | `20`    | longer videos fade out after this many seconds |
| `music`           | `""`    | e.g. `"media/music.mp3"` for soft background music in the story (and the letter). Leave empty for none. |
| `musicVolume`     | `0.45`  | 0 to 1 |
| `unlockAfter`     | `3`     | how many flowers must bloom before "Play our story" appears |
| `text: {...}`     |         | every small label on the site ("tap to enter", "Your olive tree", buttons...) |

## 3. Test on your computer

Open a terminal in the `walaa-birthday` folder and run:

```
python3 -m http.server 8000
```

Then open <http://localhost:8000>. (Opening `index.html` by double-click also mostly works, but videos behave better through a server.)

Hidden shortcuts for testing:

- `http://localhost:8000/?scene=garden`  jump to the garden
- `http://localhost:8000/?scene=story`   jump to the slideshow (starts muted, tap for sound)
- `http://localhost:8000/?scene=letter`  jump to the letter
- add `?reset=1` to forget which flowers have bloomed (e.g. `/?reset=1`)

The garden remembers bloomed flowers on her phone. **Before you send her the link, open it once with `?reset=1`
on your own device if you tested there** (her phone starts fresh anyway).

Story controls: tap right = next, tap left = back, swipe left/right, hold (or press space) = pause,
arrow keys on a computer, the X button goes back to the garden.

## 4. Put it online for free (Netlify Drop)

1. Go to **https://app.netlify.com/drop**
2. Drag the whole **`walaa-birthday`** folder onto the page.
3. Wait a few seconds. You get a link like `https://something-random-123.netlify.app`. That's the website.
4. Optional: create a free Netlify account to keep the site permanently and rename it
   (Site configuration > Change site name, e.g. `walaa-birthday.netlify.app`).

To update later (new photos, new captions): in Netlify open your site > **Deploys**, and drag the folder again
onto the deploy area. The link stays the same.

## 5. Before sending

- [ ] Open the link on your own phone once and go through all scenes.
- [ ] Turn off silent mode on the phone if you added music or videos with sound.
- [ ] Send her the link. She should tap "tap to enter"; that first tap allows sound on iPhone.
