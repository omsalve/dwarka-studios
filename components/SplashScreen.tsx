"use client";

/* -----------------------------------------------------------------------
   SplashScreen — two videos, one continuous shot
   ─────────────────────────────────────────────────────────────────────
   Video 1 sits frozen on its first frame until the pointer finds the door
   (the centre column of the viewport), and only advances while the pointer
   stays there:

     idle ──enter──▶ forward ──leave──▶ idle (frozen where it stopped)
                        │  └──re-enter──▶ forward (resumes, never restarts)
                        ▼ (last ~½ second)
                      handoff — committed; leaving no longer does anything

   Leaving the door freezes the shot on the exact frame the pointer left on;
   coming back picks it up from there. The playhead only ever moves forward.

   Just before video 1 runs out, video 2 (already buffered and already
   decoded to its first frame) starts rolling and dissolves in on top.
   Three details make that seam invisible:

     · the handoff starts CROSSFADE_MS *before* video 1's last frame, so the
       dissolve is finished — not starting — when video 1 would have ended;
     · only the TOP layer's opacity animates. Cross-fading both at once
       would let the black stage show through at the 50/50 mark and read as
       a dip in brightness;
     · video 2 is play/pause-primed at mount, so its first frame is already
       on the GPU when the dissolve begins — no decode hitch, no black flash.

   `onEnded` on video 1 is kept purely as a safety net, in case the rAF
   watcher is throttled (background tab) and misses the lead window.
   ----------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDeviceBudget } from "@/lib/deviceTier";
import { VIDEOS, sourcesFor, targetHeight } from "@/lib/mediaManifest";

/** Dissolve length. Also drives the inline `transitionDuration` below. */
const CROSSFADE_MS = 500;
/** How early (seconds) to hand over, so the dissolve lands on the last frame. */
const HANDOFF_LEAD = CROSSFADE_MS / 1000 + 0.05;
/** The hover target: a full-height column down the middle of the viewport. */
const DOOR_WIDTH = 400;

/** "handoff" is terminal: past that point the sequence plays itself out. */
type Phase = "idle" | "forward" | "handoff";

interface Props {
  /** Fired when video 2 reaches its end — hand off to the page beneath. */
  onComplete?: () => void;
  /** Try to play with audio. Falls back to muted if the browser refuses. */
  withSound?: boolean;
}

export function SplashScreen({ onComplete, withSound = false }: Props) {
  const oneRef = useRef<HTMLVideoElement>(null);
  const twoRef = useRef<HTMLVideoElement>(null);
  const budget = useDeviceBudget();

  /* --- Which encode this visitor gets ----------------------------------
     Both clips are full-frame background footage with no fine detail or
     text, which is exactly the content where a lower rung is hardest to
     notice and cheapest to ship. The rung is chosen from the panel's real
     resolution and the connection, never from the file that happens to
     exist — see lib/mediaManifest. Until `npm run media` has produced the
     smaller encodes there is only one rung, and this resolves to it. */
  const rung = useMemo(() => {
    if (typeof window === "undefined") return 1080;
    return targetHeight({
      tier: budget.tier,
      frugalNetwork: budget.frugalNetwork,
      viewportHeight: window.innerHeight,
      dpr: window.devicePixelRatio || 1,
    });
  }, [budget.tier, budget.frugalNetwork]);

  const sourcesOne = useMemo(() => sourcesFor(VIDEOS.splashOne, rung), [rung]);
  const sourcesTwo = useMemo(() => sourcesFor(VIDEOS.splashTwo, rung), [rung]);

  /* The rung is keyed onto the elements below, and that is load-bearing.
     A <video> picks its source ONCE, when it is first attached. Swapping its
     <source> children afterwards changes nothing unless load() is called
     again — so without this, the server-rendered 1080 ladder would win on
     every device and the whole adaptive selection would be decorative.

     The server has no window to measure, so it always emits the 1080 rung.
     On a desktop that is also what the client concludes, the key is
     unchanged, and React reuses the element with no interruption. On a phone
     or a throttled connection the key changes on the first client commit —
     before any byte of video has been requested in earnest — and the element
     remounts onto the correct ladder. */

  const [phase, setPhase] = useState<Phase>("idle");
  const [oneRetired, setOneRetired] = useState(false); // video 1 fully covered

  // Phase is read inside rAF and pointer callbacks where state would be
  // stale, so it is mirrored into a ref and the two are written together.
  const phaseRef = useRef<Phase>("idle");
  const enter = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const soundArmedRef = useRef(false);
  // Touch and keyboard have no meaningful "leave", so they commit to playing
  // straight through rather than stranding the video mid-shot.
  const committedRef = useRef(false);

  /* --- Preload video 2, but only once video 1 is safe ------------------
     Both videos wanting the pipe at once is the difference between video 1
     starting immediately and it stalling on frame one — video 2 is the
     larger file and nothing needs it for several seconds. So video 2 ships
     with preload="none" and is armed here, either when video 1 reports it
     can play through or the moment the visitor commits, whichever is first.

     Arming does two things: start buffering, and force the first frame to
     actually decode. `preload="auto"` fetches bytes but guarantees no
     painted frame; a muted play() → pause() → seek(0) round trip does, and
     it is invisible because the layer is still at opacity 0. */
  const armedRef = useRef(false);
  const armSecondVideo = useCallback(() => {
    const two = twoRef.current;
    if (!two || armedRef.current) return;
    armedRef.current = true;

    const prime = () => {
      void two
        .play()
        .then(() => {
          if (phaseRef.current === "handoff") return; // already live; leave it be
          two.pause();
          two.currentTime = 0;
        })
        .catch(() => {
          /* Blocked — play() at handoff time will still decode from the
             buffered data; we just lose the head start. */
        });
    };

    two.preload = "auto";
    two.load();
    if (two.readyState >= 2) prime();
    else two.addEventListener("loadeddata", prime, { once: true });
  }, []);

  /* --- A rung change remounts both elements ---------------------------
     Any priming done on the previous pair does not carry over, so the arming
     latch has to be released with them. */
  useEffect(() => {
    armedRef.current = false;
  }, [rung]);

  /* --- No scrolling behind the splash -------------------------------- */
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  /* --- Video 1: pin the first frame ----------------------------------
     iOS/Safari paints nothing until it has been asked for a position, so
     nudge the playhead a hair off zero once the data lands. */
  const pinFirstFrame = useCallback(() => {
    const one = oneRef.current;
    if (one && phaseRef.current === "idle" && one.currentTime === 0) {
      one.currentTime = 0.001;
    }
  }, []);

  /* --- Pointer on the door → advance ---------------------------------
     Resumes from wherever the playhead currently sits: entering again after
     a pause picks the shot back up, it never restarts it. */
  const resume = useCallback(() => {
    if (phaseRef.current === "handoff") return;
    const one = oneRef.current;
    if (!one) return;

    // Committing means video 2 is needed soon — start it buffering now if
    // video 1 never got far enough to arm it on its own.
    armSecondVideo();

    // Only attempt audio on the very first advance.
    if (withSound && !soundArmedRef.current) {
      soundArmedRef.current = true;
      one.muted = false;
      if (twoRef.current) twoRef.current.muted = false;
    }

    enter("forward");
    void one.play().catch(() => {
      // Unmuted playback needs a real gesture; hover isn't one. Go silent
      // rather than not playing at all.
      one.muted = true;
      if (twoRef.current) twoRef.current.muted = true;
      void one.play().catch(() => {});
    });
  }, [withSound, enter, armSecondVideo]);

  /* --- Pointer off the door → hold on the current frame ---------------
     A plain pause. The playhead stays exactly where it is, so re-entering
     continues the shot rather than jumping. */
  const release = useCallback(() => {
    if (phaseRef.current === "handoff" || committedRef.current) return;
    oneRef.current?.pause();
    enter("idle");
  }, [enter]);

  /* --- The handoff ----------------------------------------------------- */
  const beginHandoff = useCallback(() => {
    if (phaseRef.current === "handoff") return;
    enter("handoff");

    const two = twoRef.current;
    if (two) {
      two.currentTime = 0;
      void two.play().catch(() => {});
    }
  }, [enter]);

  /* --- Watch video 1's tail ------------------------------------------
     rAF rather than `timeupdate`, which only fires ~4x/sec and would make
     the handoff point wobble by up to 250ms. */
  useEffect(() => {
    if (phase !== "forward") return;
    let frame = 0;

    const tick = () => {
      const one = oneRef.current;
      if (!one || phaseRef.current !== "forward") return;
      const { duration, currentTime } = one;
      if (Number.isFinite(duration) && duration - currentTime <= HANDOFF_LEAD) {
        beginHandoff();
        return;
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [phase, beginHandoff]);

  /* --- Once the dissolve is complete, drop video 1 off the stage ------- */
  useEffect(() => {
    if (phase !== "handoff") return;
    const timer = window.setTimeout(() => {
      oneRef.current?.pause();
      setOneRetired(true);
    }, CROSSFADE_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  // Shared attributes — decorative, inert, and buffered up front. `muted` +
  // `playsInline` is what keeps autoplay legal on every mobile browser.
  const shared = {
    muted: true,
    playsInline: true,
    preload: "auto" as const,
    tabIndex: -1,
    disablePictureInPicture: true,
    "aria-hidden": true as const,
    className: "absolute inset-0 h-full w-full object-cover",
  };

  const handedOff = phase === "handoff";

  return (
    // `bg-black` so any frame the decoder hasn't reached reads as a cut to
    // black, never as a white flash.
    <div className="fixed inset-0 z-[100] overflow-hidden bg-black">
      {/* Video 1 — bottom layer. Held at full opacity for the whole dissolve
          so the fade never exposes the stage behind it. */}
      {!oneRetired && (
        <video
          {...shared}
          key={rung}
          ref={oneRef}
          poster={VIDEOS.splashOne.poster}
          onLoadedData={pinFirstFrame}
          onCanPlayThrough={armSecondVideo}
          onEnded={beginHandoff}
        >
          {/* Ordered smallest-adequate-first by the manifest: the browser
              takes the first codec it can decode, so AV1/VP9 browsers get the
              small file and everything else falls through to H.264. */}
          {sourcesOne.map((v) => (
            <source key={v.src} src={v.src} type={v.type} />
          ))}
        </video>
      )}

      {/* Video 2 — top layer. The only thing that animates. */}
      <video
        {...shared}
        key={rung}
        ref={twoRef}
        poster={VIDEOS.splashTwo.poster}
        // Overrides the shared "auto": armed by hand once video 1 is safe.
        preload="none"
        onEnded={onComplete}
        className={`${shared.className} transition-opacity ease-in-out ${
          handedOff ? "opacity-100" : "opacity-0"
        }`}
        style={{ transitionDuration: `${CROSSFADE_MS}ms`, willChange: "opacity" }}
      >
        {sourcesTwo.map((v) => (
          <source key={v.src} src={v.src} type={v.type} />
        ))}
      </video>

      {/* The door. Stays mounted through the whole hover dance — it is what
          detects the pointer leaving — and is dropped once the handoff
          commits, after which nothing the pointer does matters. */}
      {!handedOff && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Hover or press to enter"
          onPointerEnter={(e) => {
            if (e.pointerType !== "touch") resume();
          }}
          onPointerLeave={(e) => {
            if (e.pointerType !== "touch") release();
          }}
          onPointerDown={(e) => {
            // Touch has no hover: a tap commits to the full sequence, since
            // lifting the finger would otherwise freeze it on frame one.
            if (e.pointerType === "touch") {
              committedRef.current = true;
              resume();
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              committedRef.current = true;
              resume();
            }
          }}
          className="absolute inset-y-0 left-1/2 z-10 -translate-x-1/2 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[rgba(255,244,214,0.6)]"
          style={{ width: `min(${DOOR_WIDTH}px, 100vw)`, touchAction: "none" }}
        >
          <span className="pointer-events-none absolute inset-x-0 bottom-16 hidden text-center font-sans text-[0.65rem] uppercase tracking-[0.35em] text-parchment/60 pointer-coarse:block">
            Tap to enter
          </span>
        </div>
      )}
    </div>
  );
}
