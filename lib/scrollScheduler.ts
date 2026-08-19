"use client";

/* -----------------------------------------------------------------------
   scrollScheduler — one scroll listener, one rAF, one layout read
   ─────────────────────────────────────────────────────────────────────
   Before this module the page ran five independent `window.addEventListener
   ("scroll", …)` handlers. Three of them painted a full-viewport 2D canvas
   *synchronously inside the event*, and a browser can dispatch several
   scroll events per frame — so a single frame could clear-and-fill the whole
   viewport three or four times over and read `scrollY` a dozen times.

   Everything scroll-driven now subscribes here instead. The scheduler:

     · attaches exactly ONE passive scroll listener for the whole page;
     · coalesces every burst of events into a single requestAnimationFrame,
       so work happens at most once per painted frame;
     · reads `window.scrollY` / `innerHeight` ONCE per frame and hands the
       same numbers to every subscriber, which also removes any chance of
       two layers disagreeing about the scroll depth within one frame (the
       forge, the light bridge and the hero all key off `depth`);
     · skips the frame entirely when the scroll position has not actually
       changed and no subscriber asked to be re-run.

   Subscribers must not write to the DOM in a way that forces layout. They
   get pre-read metrics precisely so they never have to measure anything.
   ----------------------------------------------------------------------- */

export interface ScrollFrame {
  /** window.scrollY, read once for the whole frame. */
  y: number;
  /** window.innerHeight, cached between resizes. */
  vh: number;
  /** y / vh — the "viewport-heights scrolled" unit the bridge timeline uses. */
  depth: number;
}

type Subscriber = (frame: ScrollFrame) => void;

const subscribers = new Set<Subscriber>();

let frameHandle = 0;
let listening = false;
let lastY = -1;
let viewportHeight = 0;
let dirty = true;

function readViewport() {
  viewportHeight = window.innerHeight || 1;
  dirty = true;
}

function run() {
  frameHandle = 0;
  const y = window.scrollY;
  if (!dirty && y === lastY) return;
  lastY = y;
  dirty = false;

  const frame: ScrollFrame = { y, vh: viewportHeight, depth: y / viewportHeight };
  for (const subscriber of subscribers) subscriber(frame);
}

function schedule() {
  if (frameHandle) return;
  frameHandle = requestAnimationFrame(run);
}

function onScroll() {
  schedule();
}

function onResize() {
  readViewport();
  schedule();
}

/**
 * Subscribe to rAF-coalesced scroll frames. Returns an unsubscribe function.
 * The callback fires once immediately so a fresh subscriber is never a frame
 * behind the page it just mounted into.
 */
export function onScrollFrame(subscriber: Subscriber): () => void {
  if (typeof window === "undefined") return () => {};

  if (!listening) {
    listening = true;
    readViewport();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
  }

  subscribers.add(subscriber);
  // Immediate priming call, using this frame's already-read metrics.
  const y = window.scrollY;
  subscriber({ y, vh: viewportHeight, depth: y / viewportHeight });

  return () => {
    subscribers.delete(subscriber);
    if (subscribers.size === 0) {
      listening = false;
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      if (frameHandle) cancelAnimationFrame(frameHandle);
      frameHandle = 0;
    }
  };
}

/**
 * Force the next frame to run even if `scrollY` is unchanged — used after a
 * resize or an external change that invalidates what subscribers last painted.
 */
export function invalidateScrollFrame() {
  dirty = true;
  schedule();
}
