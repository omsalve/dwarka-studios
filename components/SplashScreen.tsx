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
import { SkipIntroButton } from "@/components/SkipIntroButton";
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
  /** Offer the "Skip intro" exit. Off for previews that exist to be watched. */
  skippable?: boolean;
}

export function SplashScreen({ onComplete, withSound = false, skippable = true }: Props) {
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
  /* null until the device has actually been measured — which means the
     server and the hydrating client both render a <video> with a poster and
     NO <source> children at all.

     That is the whole trick, and both halves of it matter:

     · Hydration. The rung cannot be derived from `window` during render,
       because the server has no window and React would then hydrate markup
       that disagrees with what the server sent. Deriving it from
       `budget.measured` instead keeps the first client render byte-identical
       to the server's; the real rung arrives on the commit straight after,
       which is a normal update rather than a mismatch.

     · Wasted bytes. A <video> runs its resource selection once, when it is
       attached with sources. If the server emitted a 1080 ladder, a phone
       would begin pulling the 1080 file during hydration and only then be
       told to use 720. Emitting no sources server-side means nothing is
       fetched until the right rung is known — and the poster paints in the
       meantime, which is a better first frame than an empty black element
       anyway. */
  const rung = useMemo(() => {
    if (!budget.measured) return null;
    return targetHeight({
      tier: budget.tier,
      frugalNetwork: budget.frugalNetwork,
      viewportHeight: window.innerHeight,
      dpr: window.devicePixelRatio || 1,
    });
  }, [budget.measured, budget.tier, budget.frugalNetwork]);

  const sourcesOne = useMemo(
    () => (rung === null ? [] : sourcesFor(VIDEOS.splashOne, rung)),
    [rung]
  );
  const sourcesTwo = useMemo(
    () => (rung === null ? [] : sourcesFor(VIDEOS.splashTwo, rung)),
    [rung]
  );

  /* The rung is keyed onto both elements below, and that is load-bearing:
     adding <source> children to a video that has already been attached does
     not restart resource selection. Changing the key gives React a brand new
     element instead, created with its sources already in place.

     The two keys have to be distinct from each other — they are siblings, and
     sharing a key silently lets React confuse one video for the other. */
  const rungKey = rung ?? "pending";

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
  // Latches so a second Escape (or a click landing during the caller's fade)
  // is inert. Mirrored into state because it also unmounts the button.
  const skippedRef = useRef(false);
  const [skipped, setSkipped] = useState(false);
  // Latched on the first advance; only the invitation copy reads it.
  const [started, setStarted] = useState(false);

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
    setStarted(true);
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
    if (phaseRef.current === "handoff" || skippedRef.current) return;
    enter("handoff");

    const two = twoRef.current;
    if (two) {
      two.currentTime = 0;
      void two.play().catch(() => {});
    }
  }, [enter]);

  /* --- Skipping ---------------------------------------------------------
     `onComplete` is the only door out of this component, so a skip leaves
     through the same one a natural finish does — the caller fades the overlay
     either way. Two things happen on the way through:

       · both videos are paused. Left rolling they keep decoding behind the
         caller's fade, which on a weak GPU is exactly the cost the visitor
         just asked to stop paying;
       · nothing about the *picture* changes. The frame the shot was sitting
         on is the frame it fades out on. Forcing the handoff here instead
         would dissolve to a video 2 that may never have been armed — a cut
         to black underneath the fade.

     `skippedRef` then blocks the handoff for good, so neither the rAF tail
     watcher nor a late `onEnded` can restart the sequence mid-fade. */
  const skip = useCallback(() => {
    if (skippedRef.current) return;
    skippedRef.current = true;
    setSkipped(true);
    committedRef.current = true;
    oneRef.current?.pause();
    twoRef.current?.pause();
    onComplete?.();
  }, [onComplete]);

  /* --- Watch video 1's tail ------------------------------------------
     rAF rather than `timeupdate`, which only fires ~4x/sec and would make
     the handoff point wobble by up to 250ms. */
  useEffect(() => {
    if (phase !== "forward") return;
    let frame = 0;

    const tick = () => {
      const one = oneRef.current;
      // A skip freezes the playhead, so the tail condition below would never
      // come true and this would spin until the overlay unmounts.
      if (!one || skippedRef.current || phaseRef.current !== "forward") return;
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
          key={`one-${rungKey}`}
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
        key={`two-${rungKey}`}
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

      {/* The invitation. The only instruction in the intro, and the shot does
          not advance until it is followed, so it is built to be found rather
          than to stay out of the way.

          The scrim is the load-bearing part. The frame underneath is carved
          wood at full contrast — warm, busy, and roughly the same value as
          parchment — so no weight or colour alone survives it. A gradient
          floor calms the bottom third, which lets the line stay light and
          spaced instead of turning into a chip of UI, and incidentally gives
          the skip button the same footing.

          Full-width and outside the door: the ground has to span the frame,
          not a 400px column. Below the door in z, above nothing that matters
          — it never takes the pointer. Fades out for good on the first
          advance; re-showing it every time the pointer slips off the door
          would blink at anyone still deciding, and by then they plainly know
          where the feather is. */}
      {!handedOff && (
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-x-0 bottom-0 z-[5] flex justify-center transition-opacity duration-500 ${
            started ? "opacity-0" : "opacity-100"
          }`}
        >
          <div className="absolute inset-x-0 bottom-0 h-[30vh] bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

          {/* Sits higher on a phone: the skip pill is bottom-right, which on a
              narrow viewport is close enough to the centred line to read as
              one crowded row. */}
          <div className="splash-invite relative mb-[15vh] sm:mb-[12vh]">
            {/* Champagne bloom behind the words. Now that it sits on the
                scrim rather than on lit wood, screen-blending reads as light
                in the frame instead of washing out against it. */}
            <span
              className="splash-invite-bloom absolute left-1/2 top-1/2 h-[320%] w-[160%] mix-blend-screen"
              style={{
                transform: "translate(-50%, -50%)",
                background:
                  "radial-gradient(closest-side, rgba(255,246,222,0.5), rgba(226,190,120,0.18) 45%, transparent 74%)",
                filter: "blur(12px)",
              }}
            />

            {/* Hairline above the copy — a beat of deliberate framing, so the
                line reads as part of the shot and not as chrome. */}
            <span className="relative mx-auto mb-5 block h-px w-24 bg-gradient-to-r from-transparent via-[rgba(232,199,133,0.75)] to-transparent" />

            <span
              className="relative block whitespace-nowrap text-center font-serif text-[clamp(0.9rem,2.9vw,1.15rem)] uppercase text-parchment"
              style={{
                letterSpacing: "0.42em",
                // Trailing letter-space would otherwise push the line left of
                // true centre by half a space.
                textIndent: "0.42em",
                textShadow:
                  "0 0 32px rgba(255,236,190,0.55), 0 2px 26px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.55)",
              }}
            >
              <span className="pointer-coarse:hidden">Hover on the feather</span>
              <span className="hidden pointer-coarse:inline">Tap on the feather</span>
            </span>
          </div>
        </div>
      )}

      {/* The exit. Above the door in z, so it stays reachable on a narrow
          viewport where the door spans the full width. */}
      {skippable && !skipped && <SkipIntroButton onSkip={skip} />}

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
        />
      )}
    </div>
  );
}
