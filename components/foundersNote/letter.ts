/* -----------------------------------------------------------------------
   The founder's letter — one copy, two presentations
   ─────────────────────────────────────────────────────────────────────
   The letter is rendered two completely different ways: painted onto the
   pages of a 3D book (components/FoundersNoteBook) where the device can
   carry it, and typeset as ordinary DOM text (components/FoundersNoteLetter)
   on phones, where it cannot.

   The words live here rather than in either of them, for two reasons. The
   obvious one is drift — two hand-maintained copies of the same letter will
   eventually disagree, and the one nobody looks at will be the wrong one.

   The less obvious one is bundle weight: FoundersNoteBook pulls in three.js,
   drei and GSAP, so anything that imports it to read a string drags a
   megabyte of WebGL along. This module has no dependencies at all, so the
   phone build can read the letter without ever touching the 3D scene.
   ----------------------------------------------------------------------- */

/** The letter body, as it appears on the book's left page. */
export const FOUNDER_PARAGRAPHS = [
  "Since childhood, I've been deeply passionate about gaming and animation. I've always believed that when we simply see something, we may remember it for a while — but when we truly experience something, we never forget it. That's where this journey began: I wanted to give everyone that kind of unforgettable experience, and to weave into it the history, culture, and heritage of our country.",
  "Dwarka Studios was born from that belief — that the stories and craftsmanship of our heritage deserve to live in the most advanced experiences of the future, and that intelligent technology, used with care, can make that possible faster and better than ever before. We're building a studio where culture and innovation aren't opposites, but partners. This is just the beginning, and I'm glad you're here for it.",
];

export const FOUNDER_NAME = "Srikaran Adapa";
export const FOUNDER_ROLE = "Founder · Dwarka Studios";

/** Handwritten-style scrawl set above the typeset name, in both versions. */
export const SIGNATURE = "Srikaran Adapa";

/** The lockup on the book's right page: kicker, then the two title words. */
export const LETTER_KICKER = "A letter from the";
export const LETTER_TITLE_LEAD = "Founder";
export const LETTER_TITLE_TAIL = "Note";
