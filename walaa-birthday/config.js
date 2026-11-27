/* ==========================================================================
   CONFIG — everything you may want to change lives here.
   You never need to touch index.html, style.css or script.js.
   Any field can be left empty ("" or []): that part is skipped quietly.

   memories: one entry per photo OR video, in the order of the story.
     day      text shown on the card, also used to group seeds when there are
              more than 10 memories (all memories with the same "day" share one seed)
     place    short place name shown next to the day
     src      path to the file inside the media/ folder
              images: .jpg .jpeg .png .webp .gif .avif .heic(Safari only)
              videos: .mp4 .mov .m4v .webm  (detected automatically)
     caption  the sentence shown under the photo
     flower   optional: "orange-blossom" | "rose" | "jasmine" | "tulip" | "lavender"
     type     optional: "image" or "video" if the extension is unusual
     poster   optional: an image shown before a video starts
     date     optional: "2026-11-14T12:41" — the story plays in this order
     highlight optional: true = also a seed in the garden. When at least one
              memory is a highlight, the garden shows ONLY highlights; the
              story always plays ALL memories.
   ========================================================================== */

const CONFIG = {
  title: "HAPPY BIRTHDAY HABIBTI ❤️",
  her: "Walaa",
  herArabic: "وَلاء",          // drawn in gold calligraphy before the letter

  // The gift opening song: "musicbox" = a soft music-box Happy Birthday made in
  // the browser (no file needed), or a file path like "media/birthday.mp3", or "".
  birthdaySong: "musicbox",

  metAt: "2026-11-13T12:15:00+01:00",   // our first hug (live counter in the garden)
  metPlace: "Castellón airport",

  oliveCertificate: "media/olive-certificate.jpg",
  surprise: "See you soon, habibti",

  photoSeconds: 6,        // how long each photo stays in "Our story"
  maxVideoSeconds: 20,    // videos longer than this are faded out early
  music: "",              // e.g. "media/music.mp3" — soft music during the story only
  musicVolume: 0.45,      // 0..1
  unlockAfter: 3,         // flowers to bloom before "Play our story" appears

  // date: when it was taken (the story is sorted by it).
  // highlight: true = also a seed in the garden (h01, h02 ...). The rest (s001 ...) only play in the story.
  memories: [
    // ---- 13 Nov
    { date: "2026-11-13T12:13", day: "13 Nov", place: "On the way to you",  src: "media/s001.mp4", poster: "media/s001-poster.jpg", caption: "Above the clouds, counting the minutes." },
    // ---- 14 Nov
    { date: "2026-11-14T12:41", day: "14 Nov", place: "Ciutat Vella",       src: "media/s002.jpg", caption: "Art on every corner, and you beside me." },
    { date: "2026-11-14T12:48", day: "14 Nov", place: "Plaça de la Mare de Déu", src: "media/s003.mp4", poster: "media/s003-poster.jpg", caption: "The old city, and you beside me." },
    { date: "2026-11-14T12:52", day: "14 Nov", place: "Basílica",           src: "media/s004.jpg", caption: "A quiet moment in the Basílica." },
    { date: "2026-11-14T13:10", day: "14 Nov", place: "Valencia",           src: "media/s005.jpg", caption: "Valencia, mi amor. It said it for us." },
    { date: "2026-11-14T17:31", day: "14 Nov", place: "Valencia",           src: "media/s006.jpg", caption: "That smile." },
    { date: "2026-11-14T21:17", day: "14 Nov", place: "Valencia",           src: "media/s007.jpg", caption: "Tacos, and the best company." },
    // ---- 15 Nov
    { date: "2026-11-15T14:13", day: "15 Nov", place: "Oceanogràfic",       src: "media/s008.jpg", caption: "The day we went under the sea." },
    { date: "2026-11-15T14:16", day: "15 Nov", place: "Oceanogràfic",       src: "media/s009.mp4", poster: "media/s009-poster.jpg", caption: "Walking under the sea with you." },
    { date: "2026-11-15T14:22", day: "15 Nov", place: "Oceanogràfic",       src: "media/s010.mp4", poster: "media/s010-poster.jpg", caption: "Jellyfish glowing like little lanterns." },
    { date: "2026-11-15T14:32", day: "15 Nov", place: "Oceanogràfic",       src: "media/s011.jpg", caption: "You, capturing everything. Me, capturing you." },
    { date: "2026-11-15T14:33", day: "15 Nov", place: "Oceanogràfic",       src: "media/s012.jpg", caption: "Just us, and the biggest smiles." },
    { date: "2026-11-15T14:49", day: "15 Nov", place: "Oceanogràfic",       src: "media/s013.mp4", poster: "media/s013-poster.jpg", caption: "Sharks above us, your hand in mine." },
    { date: "2026-11-15T15:05", day: "15 Nov", place: "Oceanogràfic",       src: "media/s014.mp4", poster: "media/s014-poster.jpg", caption: "The belugas looked happy. So did we." },
    { date: "2026-11-15T15:51", day: "15 Nov", place: "Ciutat de les Arts i les Ciències", src: "media/s015.jpg", caption: "You, against all that blue." },
    { date: "2026-11-15T21:00", day: "15 Nov", place: "Valencia",           src: "media/s016.jpg", caption: "Flowers for you." },
    { date: "2026-11-15T21:01", day: "15 Nov", place: "Valencia",           src: "media/s017.jpg", caption: "Surrounded by people who love you." },
    // ---- 16 Nov
    { date: "2026-11-16T10:06", day: "16 Nov", place: "Bioparc",            src: "media/s018.jpg", caption: "Bioparc, a whole morning of wonder." },
    { date: "2026-11-16T10:19", day: "16 Nov", place: "Bioparc",            src: "media/s019.jpg", caption: "Flamingos in the morning sun." },
    { date: "2026-11-16T10:25", day: "16 Nov", place: "Bioparc",            src: "media/s020.mp4", poster: "media/s020-poster.jpg", caption: "A curious little lemur came to say hello." },
    { date: "2026-11-16T10:53", day: "16 Nov", place: "Bioparc",            src: "media/s021.mp4", poster: "media/s021-poster.jpg", caption: "The gentle giant, taking his time." },
    { date: "2026-11-16T11:04", day: "16 Nov", place: "Bioparc",            src: "media/s022.mp4", poster: "media/s022-poster.jpg", caption: "A hippo dancing underwater." },
    { date: "2026-11-16T11:15", day: "16 Nov", place: "Bioparc",            src: "media/s023.jpg", caption: "A pelican in the sun, in no hurry at all." },
    { date: "2026-11-16T11:23", day: "16 Nov", place: "Bioparc",            src: "media/s024.mp4", poster: "media/s024-poster.jpg", caption: "The meerkats on watch." },
    { date: "2026-11-16T11:38", day: "16 Nov", place: "Bioparc",            src: "media/s025.jpg", caption: "Cuddled up close, just like us." },
    { date: "2026-11-16T11:41", day: "16 Nov", place: "Bioparc",            src: "media/s026.jpg", caption: "Stripes in the afternoon light." },
    { date: "2026-11-16T20:00", day: "16 Nov", place: "Valencia",           src: "media/s027.jpg", caption: "Two shadows, one path." },
    // ---- 17 Nov
    { date: "2026-11-17T17:38", day: "17 Nov", place: "Valencia",           src: "media/s028.jpg", caption: "Mint tea and long talks." },
    { date: "2026-11-17T20:04", day: "17 Nov", place: "Valencia",           src: "media/s029.mp4", poster: "media/s029-poster.jpg", caption: "An evening walk, lights all along the way." },
    // ---- 18 Nov
    { date: "2026-11-18T09:08", day: "18 Nov", place: "Xàtiva",             src: "media/s030.jpg", caption: "The whole town below us." },
    { date: "2026-11-18T09:11", day: "18 Nov", place: "Xàtiva",             src: "media/s031.jpg", caption: "Held in giant hands, above the whole town." },
    { date: "2026-11-18T09:29", day: "18 Nov", place: "Xàtiva",             src: "media/s032.jpg", caption: "Through the old stone arch, a whole new view." },
    { date: "2026-11-18T09:39", day: "18 Nov", place: "Xàtiva",             src: "media/s033.jpg", caption: "A flag for Palestine, far from home." },
    { date: "2026-11-18T10:10", day: "18 Nov", place: "Xàtiva",             src: "media/s034.mp4", poster: "media/s034-poster.jpg", caption: "Out of breath, and still smiling." },
    { date: "2026-11-18T11:27", day: "18 Nov", place: "Xàtiva",             src: "media/s035.jpg", caption: "Golden light inside an old church." },
    { date: "2026-11-18T12:31", day: "18 Nov", place: "Castell de Xàtiva",  src: "media/s036.jpg", caption: "The castle gate, under a perfect blue sky." },
    // ---- 19 Nov
    { date: "2026-11-19T16:44", day: "19 Nov", place: "Home",               src: "media/s037.mp4", poster: "media/s037-poster.jpg", caption: "Cooking together, the simplest kind of happy." },
    { date: "2026-11-19T18:45", day: "19 Nov", place: "Valencia",           src: "media/s038.jpg", caption: "A wall full of little treasures." },
    // ---- 20 Nov
    { date: "2026-11-20T09:25", day: "20 Nov", place: "Valencia",           src: "media/s039.jpg", caption: "One more morning together." },
    { date: "2026-11-20T12:45", day: "20 Nov", place: "Castellón airport",  src: "media/s040.jpg", caption: "The hardest window to look out of." },
    { date: "2026-11-20T13:59", day: "20 Nov", place: "Castellón airport",  src: "media/s041.jpg", caption: "Until next time, habibti." },
    { date: "2026-11-20T16:36", day: "20 Nov", place: "On the way home",    src: "media/s042.mp4", poster: "media/s042-poster.jpg", caption: "Not a goodbye. Just the end of chapter one." }
  ],

  // Shown at the first light of Fajr, one at a time. There is never music under it.
  dua: [
    { ar: "وَمِنْ آيَاتِهِ أَنْ خَلَقَ لَكُم مِّنْ أَنفُسِكُمْ أَزْوَاجًا لِّتَسْكُنُوا إِلَيْهَا وَجَعَلَ بَيْنَكُم مَّوَدَّةً وَرَحْمَةً", en: "Among His signs is that He created for you spouses from among yourselves, so that you find tranquility in them, and He placed between you love and mercy.", src: "Ar-Rum 30:21" },
    { ar: "رَبَّنَا هَبْ لَنَا مِنْ أَزْوَاجِنَا وَذُرِّيَّاتِنَا قُرَّةَ أَعْيُنٍ وَاجْعَلْنَا لِلْمُتَّقِينَ إِمَامًا", en: "Our Lord, grant us from our spouses and our children the coolness of our eyes, and make us an example for the righteous.", src: "Al-Furqan 25:74" },
    { ar: "رَّبِّ زِدْنِي عِلْمًا", en: "My Lord, increase me in knowledge.", src: "Ta-Ha 20:114" },
    { ar: "اللَّهُمَّ إِنِّي أَسْأَلُكَ الْهُدَى وَالتُّقَى وَالْعَفَافَ وَالْغِنَى", en: "O Allah, I ask You for guidance, piety, chastity and contentment.", src: "Sahih Muslim" },
    { ar: "رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ", en: "Our Lord, give us good in this world and good in the Hereafter, and protect us from the punishment of the Fire.", src: "Al-Baqarah 2:201" },
    { ar: "اللَّهُمَّ صَلِّ وَسَلِّمْ عَلَى نَبِيِّنَا مُحَمَّدٍ", en: "O Allah, send blessings and peace upon our Prophet Muhammad.", src: "" }
  ],

  letter: [
    "Dear Walaa, my love, my everything, the barakah of my life,",
    "You are the person I want to wake up to every day. I am the happiest when I am with you, or on the phone with you.",
    "This is the first phase of our journey, and I promise there will be so much more. I keep praying that Allah marries us soon, so that we can start our life together. I promise you that I will take care of you and love you every minute.",
    "You are a barakah in my life. You brought the colours back, and my peace of mind is at its peak.",
    "Walaa, you are an absolutely amazing woman, and I am so proud of you, wallahi.",
    "كل عام وأنتِ بخير يا حبيبتي، وكل عام وأنتِ أجمل ما في حياتي.",
    "Happy birthday, my love."
  ],
  signature: "Forever yours, Mustafa",

  /* Small texts around the site */
  text: {
    giftText: "Tap to open your gift, habibti",
    giftSub: "turn your sound on",
    introSubtitle: "for Walaa",
    enterGarden: "Enter the garden",
    loading: "a little garden is growing",
    gardenTitle: "Our garden of memories",
    gardenHint: "Every flower is a moment with you",
    gardenScrollHint: "swipe to see the whole garden",
    skyNote: "The sky above Valencia, our first night in the same city",
    sinceLabel: "Since our first hug at {place}",
    treeLabel: "Your olive tree",
    certificateTitle: "Planted in your name, growing for you.",
    certificateMeta: "Sadaqah jariyah · your olive tree in Palestine",
    counter: "{n} of {total} memories bloomed",
    playStory: "Our story, from the beginning",
    openLetter: "Open your letter",
    surpriseHint: "Something new is growing for you",
    storyTapForSound: "tap for sound",
    duaTitle: "At the first light of Fajr",
    duaContinue: "continue",
    ameen: "Ameen",
    letterHint: "Tap the seal, and take your time, habibti",
    backToGarden: "Back to the garden",
    watchAgain: "Watch again",
    missingMemory: "This memory is still on its way."
  }
};
