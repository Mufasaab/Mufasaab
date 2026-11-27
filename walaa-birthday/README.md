# Walaa's birthday garden

A small static website that moves from night to Fajr to morning:

**Gift** → **Title** → **Memory garden** → **Our story** (slideshow) → **Dua at Fajr** → **Her name in gold + the letter** → back to the garden, where a hidden golden seed waits.

There is no build step and nothing to install. Everything you need to change is in **`config.js`**.

```
walaa-birthday/
├── index.html     page structure          (no need to edit)
├── style.css      all styling             (no need to edit)
├── script.js      all behaviour           (no need to edit)
├── stars.js       real star catalog       (no need to edit)
├── config.js      ALL texts, captions, media paths, dua, letter  <- edit this
└── media/         your photos, videos, the olive-tree certificate, optional music
```

---

## 1. Add your photos and videos

1. Put your files in the `media/` folder.
   - Photos: `.jpg`, `.jpeg`, `.png`, `.webp` (iPhone `.heic` only works in Safari, so export as JPG).
   - Videos: `.mp4` works everywhere. `.mov` from an iPhone usually works too, but `.mp4` is safest.
2. The easiest way is to **name your files like the placeholders** (`01.jpg`, `02.jpg`, `03.jpg`, `04.mp4`, ...)
   and overwrite them. Any names work, as long as `config.js` matches.
3. Recommended sizes (so it loads fast on a phone): photos about 1600–2000 px on the long side and under 1 MB;
   videos 1080p or 720p, under 20 MB, ideally under 20 seconds.
4. Put a photo or scan of the real olive-tree certificate in `media/` (e.g. `media/olive-certificate.jpg`) and set `oliveCertificate` in `config.js` to that path.
5. Delete placeholder files you no longer use.

## 2. Edit `config.js`

Open `config.js` in any text editor. Every field may be left empty (`""` or `[]`); that part is then skipped quietly.

### Memories
One line per photo or video, **in the order of the story**:

```js
{ day: "15 Nov", place: "Oceanogràfic", src: "media/03.jpg", caption: "Your words here", flower: "jasmine" },
```

| field     | meaning |
|-----------|---------|
| `day`     | shown on the card. With **more than 10 memories**, all memories with the same `day` share one seed and open as a swipeable gallery. |
| `place`   | shown next to the day |
| `src`     | path to the file, e.g. `media/03.jpg` or `media/04.mp4` (photo vs. video is detected from the extension) |
| `caption` | the sentence under the photo |
| `flower`  | optional: `orange-blossom`, `rose`, `jasmine`, `tulip`, `lavender` |
| `poster`  | optional, videos only: an image shown before the video starts |

From 3 to 40 memories, photos and videos mixed. If a file is missing, that memory is skipped gracefully.

### The new fields

| setting            | what it does |
|--------------------|--------------|
| `birthdaySong`     | `"musicbox"` plays Happy Birthday as a soft music box, made live in the browser (no file needed). Or a file path like `"media/birthday.mp3"` (fades in over 2 s). Or `""` for none. |
| `herArabic`        | her name drawn in gold before the letter (`"وَلاء"`). |
| `metAt`, `metPlace`| the live counter in the garden: "Since our first hug at Castellón airport: X days · X hours · X minutes". Keep the format `2026-11-13T12:15:00+01:00`. |
| `oliveCertificate` | the image shown when she taps the olive tree. |
| `surprise`         | the words inside the hidden golden flower that appears after she has read the letter. |
| `dua`              | the dua screen, one entry at a time: `ar` (Arabic), `en` (meaning), `src` (source, may be empty). There is never any music under it. |
| `letter`, `signature` | the letter paragraphs (each `"..."` is one paragraph; Arabic works) and the closing line. |
| `music`            | optional soft music for the story slideshow only, e.g. `"media/music.mp3"`. |
| `photoSeconds`, `maxVideoSeconds`, `unlockAfter` | slideshow timing, and how many flowers bloom before "Our story, from the beginning" appears. |
| `text: {...}`      | every small line on the site ("Tap to open your gift, habibti", "Enter the garden", "Ameen", …). |

> When you edit the Arabic, paste it as a whole. Don't retype or "fix" the diacritics.

## 3. How the sound works (iPhone and Android)

- Phones never allow sound before a tap, so the first screen is the gift. Her first tap starts the song, unlocks the videos and (on iPhone) asks for the motion permission used for the gentle tilt parallax.
- The music box keeps playing softly into the garden, then fades out over 4 s. Story music (if set) takes over during the slideshow and dips under videos with sound.
- All music fades out completely **before** the dua screen.
- The round sound button (top right, on every scene) mutes and unmutes everything.
- On iPhone with iOS 17 or newer, the song plays even when the ringer switch is on silent. On older iPhones, the silent switch also mutes the music box, so tell her to switch the ringer on.

## 4. Test on your computer

Open a terminal in the `walaa-birthday` folder and run:

```
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

Hidden shortcuts for testing (add to the address):

- `?scene=gift` `?scene=intro` `?scene=garden` `?scene=story` `?scene=dua` `?scene=letter`
- `?reset=1` forgets the bloomed flowers, the read letter and the golden seed (e.g. `/?reset=1`)

Shortcuts other than `gift` start without sound until the first tap. **Before you send her the link, open it once with `?reset=1` on your own phone if you tested there** (her phone starts fresh anyway).

Story controls: tap right = next, tap left = back, swipe, hold (or space) = pause, arrow keys on a computer, X = back to the garden.

## 5. Put it online for free (Netlify Drop)

1. Go to **https://app.netlify.com/drop**
2. Drag the whole **`walaa-birthday`** folder onto the page.
3. You get a link like `https://something-random-123.netlify.app`. That's the website.
4. Optional: create a free Netlify account to keep it and rename it (Site configuration > Change site name).

To update later: open your site in Netlify > **Deploys**, and drag the folder again. The link stays the same.

## 6. Before sending

- [ ] Open the link on your own phone once and go through every scene, with sound on.
- [ ] Open it once with `?reset=1` afterwards.
- [ ] Send her the link.

---

## Credits

Studied or reused from open-source projects (all permissive licenses). No code was copied wholesale; techniques were rewritten in this site's own style, except the star data, which is reused with its license notice kept in `stars.js`.

| Project | License | Used for |
|---------|---------|----------|
| [ofrohn/d3-celestial](https://github.com/ofrohn/d3-celestial) (Olaf Frohn) | BSD-3-Clause | **Data reused**: star positions, magnitudes, colours and constellation lines in `stars.js` (license notice included in that file). |
| [Tonejs/Tone.js](https://github.com/Tonejs/Tone.js) (Yotam Mann) | MIT | Technique: generated reverb impulse (stereo noise burst, pre-delay, decaying envelope). |
| [pavle-goloskokovic/web-audio-unlock](https://github.com/pavle-goloskokovic/web-audio-unlock) | MIT | Technique: unlocking Web Audio on iOS with `resume()` plus a 1-sample silent buffer inside the first tap. |
| [wagerfield/parallax](https://github.com/wagerfield/parallax) (Matthew Wagerfield) | MIT | Technique: device-orientation parallax with calibration on the first reading and friction easing. |
| [599316527/sakura-canvas](https://github.com/599316527/sakura-canvas) (Kyle He) | MIT | Technique: depth-scaled petals (size/speed/alpha by depth) with two independent rotation phases. |
| [evoluteur/islamic-patterns](https://github.com/evoluteur/islamic-patterns) (Olivier Giulieri) | MIT | Technique: Hankin's "polygons in contact" method, used to generate the faint 8-point-star sky pattern. |
| [maxwellito/vivus](https://github.com/maxwellito/vivus) | MIT | Technique: stroke-dashoffset drawing, used for the gold calligraphy of her name. |
| [Hostlife22/verdant](https://github.com/Hostlife22/verdant) | MIT | Technique: staggered stem → leaf → bloom timing and a gentle settle after growth. |
| [yuktrium/3D-Love-Letter](https://github.com/yuktrium/3D-Love-Letter) | MIT | Technique: switching the flap's z-index in lockstep with its 3D rotation (pure CSS), and a slight tilt as the letter rises. |
| [ramonszo/zuck.js](https://github.com/ramonszo/zuck.js) (Ramon Souza) | MIT | Reviewed for story-player behaviour; confirmed our preload/`playsinline` approach. No code used. |

Fonts from Google Fonts (SIL Open Font License): Cormorant Garamond, Great Vibes, Jost, Dancing Script, Amiri, Aref Ruqaa.
The Happy Birthday melody is in the public domain.
