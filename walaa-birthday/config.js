/* ==========================================================================
   CONFIG — everything you may want to change lives here.
   You never need to touch index.html, style.css or script.js.

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

  photoSeconds: 6,        // how long each photo stays in "Our story"
  maxVideoSeconds: 20,    // videos longer than this are faded out early
  music: "",              // e.g. "media/music.mp3" — leave "" for no music
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

  letter: [
    "Habibti,",
    "Today the whole garden blooms for you. Every flower here is a day we lived in Valencia, and every one of them still feels close enough to touch.",
    "You study how living things grow, so you already know the secret: the strongest roots grow slowly, quietly, and they last. That is why your olive tree is in the middle of this garden. It is us.",
    "Thank you for every smile, every walk, every look across the table. I cannot wait for all the seasons still ahead of us.",
    "كل عام وأنتِ بخير يا حبيبتي، وكل عام وأنتِ أجمل ما في حياتي.",
    "Happy birthday, my love."
  ],
  signature: "Forever yours, Mustafa",

  /* Small texts around the site */
  text: {
    introSubtitle: "for Walaa",
    tapToEnter: "tap to enter",
    loading: "a little garden is growing",
    gardenTitle: "Our garden of memories",
    gardenHint: "Tap a glowing seed to let a memory bloom",
    gardenScrollHint: "swipe to see the whole garden",
    treeLabel: "Your olive tree",
    treeNote: "An olive tree, planted in your name. Like us, it grows slowly and lives for a very long time.",
    counter: "{n} of {total} memories bloomed",
    playStory: "Play our story",
    openLetter: "Open your letter",
    storyTapForSound: "tap for sound",
    letterHint: "Tap the seal",
    backToGarden: "Back to the garden",
    watchAgain: "Watch again",
    missingMemory: "This memory is still on its way."
  }
};
