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
  "Since childhood I have been captivated by gaming and animation — by worlds you do not merely watch, but step inside. I have always believed that when we see something we remember it for a while, yet when we truly experience something we never forget it.",
  "That belief is where this journey began. Dwarka Studios exists to give people that unforgettable feeling, and to weave into it the history, culture, and heritage of our country — proof that the craftsmanship of our past belongs inside the most advanced experiences of the future. This is only the beginning, and I am glad you are here for it.",
];

export const FOUNDER_NAME = "Srikaran Adapa";
export const FOUNDER_ROLE = "Founder · Dwarka Studios";

/** Handwritten-style scrawl set above the typeset name, in both versions. */
export const SIGNATURE = "Srikaran Adapa";

/** The lockup on the book's right page: kicker, then the two title words. */
export const LETTER_KICKER = "A letter from the";
export const LETTER_TITLE_LEAD = "Founder";
export const LETTER_TITLE_TAIL = "Note";
