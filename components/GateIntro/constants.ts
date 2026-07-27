/* -----------------------------------------------------------------------
   GateIntro — tunables
   ─────────────────────────────────────────────────────────────────────
   The cinematic entry, as a chain of dissolves between near-identical
   frames — so nothing ever reads as a cut:

     Video 1  the feather forms on the closed gate            (idle loop)
        │  hover ── crossfade (same gate, feather completes)
     Video 2  the full peacock shimmers on the closed gate    (awakened loop)
        │  dwell 2.5s ── crossfade (V3 frame 0 == this gate)
     Video 3  the doors open and the camera flies to the temple
        │  freeze last frame ── dissolve to the identical still
     Hero     the webpage, already sitting on that final frame

   Every source here is 1280×720. The three seams work because consecutive
   assets share a frame: V1's last frame ≈ V2's frames ≈ V3's first frame
   (the full-peacock closed gate), and V3's last frame == HERO_STILL.
   ----------------------------------------------------------------------- */

/** Idle: the feather forming on the closed gate. Loops as the resting state. */
export const VIDEO_IDLE = "/videos/video1.mp4";
/** Awakened: the full peacock feather. Crossfaded in while the gate is hovered. */
export const VIDEO_CHARGED = "/videos/video2.mp4";
/** The flight: the doors open and the camera flies through to the temple. */
export const VIDEO_OPEN = "/videos/video3.mp4";

/** Poster for the idle loop — Video 1's frame 0. Paints instantly (even before
 *  JS/decoding) so the very first frame the visitor sees is already the gate. */
export const IDLE_POSTER = "/images/gate-idle.png";
/** Poster for the flight — Video 3's frame 0 (the full-peacock gate). If V3 is
 *  ever revealed a hair before it decodes, this identical frame covers the gap. */
export const OPEN_POSTER = "/images/gate.png";

/** The temple — Video 3's *last* frame, reused as the hero background so the
 *  end of the flight and the webpage are the same image. Replace this file
 *  with a higher-resolution still of that exact frame; nothing else changes. */
export const HERO_STILL = "/images/heroimage.jpg";

/* ---- Crossfade timings ---------------------------------------------- */

/** Idle → awakened (V1 → V2) the moment the door is hovered. A gentle reveal. */
export const CHARGE_FADE_MS = 520;
/** Awakened → flight (V2 → V3). Short — the frames are near-identical, so this
 *  only needs to cover the shimmer difference. */
export const FLIGHT_FADE_MS = 460;
/** Frozen last frame → the (identical) hero still. 250–400ms reads as a
 *  settle, not a cut. */
export const HANDOFF_FADE_MS = 340;

/** Crossfade that hides the idle loop's seam. Video 1 is a one-way "forming"
 *  clip, so a hard loop would snap the full peacock back to a bare quill; we
 *  dissolve a second copy over the reset instead. See LoopVideo. */
export const IDLE_LOOP_FADE_MS = 800;

/** Shared easing for the video crossfades — expo-out: commits fast, settles
 *  soft, so no seam is perceptible. */
export const FADE_EASE = [0.16, 1, 0.3, 1] as const;

/* ---- Hover → open ---------------------------------------------------- */

/** How long the awakened feather (V2) is shown before the doors open (V3)
 *  begins. Hovering the door triggers the whole sequence at once — this is the
 *  "…and right after, Video 3" beat. Lower = snappier; raise to linger on the
 *  awakening. */
export const AWAKEN_HOLD_MS = 1200;

/** The interactive zone: a centred region over the gate's doors (fractions of
 *  the stage). Hovering the outer stone frame does nothing, so simply moving
 *  the cursor onto the page can never trigger the sequence — it has to be
 *  aimed at the doors. */
export const GATE_HITBOX = {
  cx: 0.5,
  cy: 0.5,
  w: 0.56,
  h: 0.82,
} as const;

/** Focal point of the invitation glow (fraction of the stage). Sits on the
 *  peacock feather at the centre of the closed doors. */
export const GATE_FOCUS = { x: 0.5, y: 0.46 } as const;

/* ---- Colour parity --------------------------------------------------- */

/** Colour-parity nudge applied to the *video* layers only. Browsers decode
 *  video (YUV → RGB) on a slightly different path than a PNG, which can show
 *  as a faint gamma/saturation step at the final dissolve. Tune this against
 *  the hero still until the fade is invisible; `"none"` is the identity. */
export const VIDEO_GRADE = "none";

/* ---- Shared framing -------------------------------------------------- */

/** The one framing every video layer AND the hero base image share. Identical
 *  object-fit / object-position / sizing is what makes the dissolves seamless
 *  across every viewport aspect ratio (they all crop the same way). */
export const STILL_CLASS =
  "absolute inset-0 h-full w-full object-cover object-center";
