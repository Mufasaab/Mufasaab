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

  memories: [
    { day: "13 Nov", place: "Valencia",            src: "media/01.jpg", caption: "The day the distance finally became zero.",                 flower: "orange-blossom" },
    { day: "14 Nov", place: "Ciutat Vella",        src: "media/02.jpg", caption: "Getting lost in old streets, and not minding at all.",       flower: "rose" },
    { day: "15 Nov", place: "Oceanogràfic",        src: "media/03.jpg", caption: "The whole ocean around us, and I only looked at you.",       flower: "jasmine" },
    { day: "16 Nov", place: "Bioparc",             src: "media/04.mp4", caption: "Your laugh. I could listen to it forever.",                  flower: "tulip" },
    { day: "17 Nov", place: "Ciudad de las Ciencias", src: "media/05.jpg", caption: "Science museum, and still the best discovery was you.",   flower: "lavender" },
    { day: "18 Nov", place: "Jardí del Túria",     src: "media/06.jpg", caption: "Walking slowly, so the day would last longer.",              flower: "orange-blossom" },
    { day: "19 Nov", place: "Valencia",            src: "media/07.jpg", caption: "A Mediterranean evening, gold on your face.",                flower: "rose" },
    { day: "20 Nov", place: "Valencia",            src: "media/08.jpg", caption: "Not a goodbye. Just the end of chapter one.",                flower: "jasmine" }
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
    "Habibti,",
    "Today the whole garden blooms for you. Every flower here is a day we lived in Valencia, and every one of them still feels close enough to touch.",
    "You study how living things grow, so you already know the secret: the strongest roots grow slowly, quietly, and they last. That is why your olive tree is in the middle of this garden. It is us.",
    "Thank you for every smile, every walk, and every Fajr you wake me for. I cannot wait for all the seasons still ahead of us, and for the day I call you Dr. Walaa.",
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
    certificateMeta: "Sadaqah jariyah · your olive tree",
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
