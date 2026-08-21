"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  motion,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import { EASE } from "@/lib/motion";
import { useDeviceBudget } from "@/lib/deviceTier";
import { onScrollFrame } from "@/lib/scrollScheduler";

type Accent = "gold" | "peacock" | "ink" | "spectrum";

type Service = {
  n: string;
  name: string;
  description: string;
  accent: Accent;
  image: string;
};

const SERVICES: Service[] = [
  {
    n: "01",
    name: "Gaming & Simulations",
    description:
      "Living, playable worlds for entertainment and training — every mechanic, frame, and decision engineered to be believed.",
    accent: "gold",
    image: "/images/services/GamingDS.webp",
  },
  {
    n: "02",
    name: "AI Visualization",
    description:
      "Turning ideas and raw data into intelligent, stunning visuals — explorable, production-grade, and fast.",
    accent: "peacock",
    image: "/images/services/AI%20Visualisation.webp",
  },
  {
    n: "03",
    name: "VFX & Animation",
    description:
      "Cinematic effects and storytelling that move audiences, frame by intentional frame.",
    accent: "ink",
    image: "/images/services/VFX.webp",
  },
  {
    n: "04",
    name: "AR · VR · MR · XR",
    description:
      "Immersive experiences across the full spectrum of reality — physical, augmented, and fully virtual.",
    accent: "spectrum",
    image: "/images/services/ARVRMRXR.webp",
  },
];

const ACCENT: Record<
  Accent,
  {
    ring: string;
    line: string;
    label: string;
    numeral: string;
    panel: string;
    glow: string;
    /** Edge-light color that rims the active card — the warm/cool signature. */
    edge: string;
    /** Directional key light washed across the image panel. */
    sheen: string;
  }
> = {
  gold: {
    ring: "border-gold/25",
    line: "bg-gold",
    label: "text-gold-deep",
    numeral: "text-gold/45",
    panel:
      "bg-[linear-gradient(155deg,var(--gold-light)_0%,var(--gold)_58%,var(--gold-deep)_100%)]",
    glow: "rgba(200,162,74,0.34)",
    edge: "rgba(230,205,134,0.55)",
    sheen: "rgba(255,241,204,0.4)",
  },
  peacock: {
    ring: "border-peacock-blue/25",
    line: "bg-peacock-blue",
    label: "text-peacock-blue",
    numeral: "text-peacock-cyan/40",
    panel: "bg-peacock-gradient",
    glow: "rgba(31,182,201,0.34)",
    edge: "rgba(31,182,201,0.5)",
    sheen: "rgba(196,244,250,0.42)",
  },
  ink: {
    ring: "border-ink/12",
    line: "bg-ink",
    label: "text-ink",
    numeral: "text-ink/20",
    panel:
      "bg-[linear-gradient(155deg,#2c2820_0%,#16140f_60%,#050403_100%)]",
    glow: "rgba(60,52,38,0.3)",
    edge: "rgba(230,205,134,0.32)",
    sheen: "rgba(240,224,180,0.28)",
  },
  spectrum: {
    ring: "border-gold/20",
    line: "bg-gold",
    label: "text-gold-deep",
    numeral: "text-gold/35",
    panel:
      "bg-[linear-gradient(145deg,var(--gold-light)_0%,var(--peacock-cyan)_52%,var(--peacock-blue)_100%)]",
    glow: "rgba(120,150,150,0.32)",
    edge: "rgba(160,200,205,0.48)",
    sheen: "rgba(224,240,214,0.4)",
  },
};

const SEGMENT_VH = 92;
// Index i of every array below is the output for DEPTH_DOMAIN[i] — i.e.
// index 2 is the value at depth 1 (first receded stage), not depth 2.
//
// depth -1 = still climbing up onto the deck; 0 = the active face; 1..3 = the
// receded stages tilting back into the stack. The recede values read as a
// physical deck settling: each card tips back on its top edge (rotateX),
// drops elevation (lift/shadow), and drains light (scrim) as it sinks.
const DEPTH_DOMAIN = [-1, 0, 1, 2, 3];
const RECEDE_Y = [118, 0, -24, -44, -60];
const RECEDE_SCALE = [0.93, 1, 0.945, 0.905, 0.875];
const RECEDE_ROTATEX = [-7, 0, 4.5, 7.5, 9.5];
const RECEDE_ROTATEZ = [0, 0, 1.3, 2.1, 2.7];
// 1 for every card that is actually on the deck, and 0 at the back of it.
//
// The 1s: a subtree opacity below 1 forces the browser to render the whole
// card into an offscreen buffer and composite it back, and because these cards
// contain blended children that buffer had to be rebuilt every time the card
// moved. The 3% / 8% of light background that used to bleed through the two
// deepest stages is already being done, more cheaply, by the recede scrim.
//
// The 0: this deck turned out to be *fill-rate* bound, not paint bound. Traced
// on an Intel UHD at 1440x900 the GPU cost was almost perfectly linear in the
// number of cards on screen — about 5.5ms per card per frame over a ~6.6ms
// floor — so one card ran at a clean 60fps and four locked to 30. The fourth
// card is the one that buys the least: by depth 3 it is scaled to 0.875 and
// sitting behind three others, showing a ~25px band at the top. Retiring it
// there keeps three cards in the stack, which is what reads as a deck anyway,
// and hands a third of the deck's per-frame GPU budget back.
const RECEDE_OPACITY = [0, 1, 1, 1, 0];
const RECEDE_GLOW = [0, 1, 0.5, 0.3, 0.18];
const RECEDE_SCRIM = [0, 0, 0.34, 0.5, 0.62];
// Elevation used to drive the shadow hierarchy — the active face floats
// highest, the climbing card is mid-air, the receded cards press into the deck.
const RECEDE_LIFT = [0.6, 1, 0.5, 0.3, 0.16];

// The two ends of that elevation, pre-rasterised. Cross-fading these with
// opacity reproduces the old continuously-interpolated box-shadow closely
// enough that the difference is not perceptible, without ever repainting.
// Values are the old formula evaluated at lift = 0.16 and lift = 1.
const SETTLED_SHADOW =
  "0 1.5px 3px rgba(22,20,15,0.048), 0 14.8px 39.6px -19px rgba(22,20,15,0.191)";
const FLOATING_SHADOW =
  "0 4px 8px rgba(22,20,15,0.09), 0 40px 90px -14px rgba(22,20,15,0.46)";

function useCardDepth(progress: MotionValue<number>, index: number, total: number) {
  const segLen = 1 / total;
  const stops: number[] = [];
  const values: number[] = [];

  if (index === 0) {
    stops.push(0);
    values.push(0);
  } else {
    const enterStart = Math.max(0, index * segLen - segLen * 0.55);
    const enterEnd = index * segLen + segLen * 0.08;
    stops.push(enterStart, enterEnd);
    values.push(-1, 0);
  }

  let stage = 0;
  for (let j = index + 1; j < total; j++) {
    const recedeStart = Math.max(0, j * segLen - segLen * 0.55);
    const recedeEnd = j * segLen + segLen * 0.08;
    stage += 1;
    stops.push(recedeStart, recedeEnd);
    values.push(stage - 1, stage);
  }

  return useTransform(progress, stops, values);
}

function StackCard({
  service,
  index,
  total,
  progress,
}: {
  service: Service;
  index: number;
  total: number;
  progress: MotionValue<number>;
}) {
  const rawDepth = useCardDepth(progress, index, total);
  // Weightier than a snappy UI spring — a touch of mass gives the deck
  // believable momentum as each card settles onto the stack.
  const depth = useSpring(rawDepth, { stiffness: 140, damping: 28, mass: 0.85 });

  const y = useTransform(depth, DEPTH_DOMAIN, RECEDE_Y);
  const scale = useTransform(depth, DEPTH_DOMAIN, RECEDE_SCALE);
  const rotateX = useTransform(depth, DEPTH_DOMAIN, RECEDE_ROTATEX);
  // The alternating lean used to hang a second transform off the first, so
  // every card carried two motion values and two subscriber hops for one
  // number. Baking the sign into the output array does the same thing once.
  const rotateZValues = useMemo(
    () => (index % 2 === 0 ? RECEDE_ROTATEZ.map((v) => -v) : RECEDE_ROTATEZ),
    [index]
  );
  const rotateZ = useTransform(depth, DEPTH_DOMAIN, rotateZValues);
  const opacity = useTransform(depth, DEPTH_DOMAIN, RECEDE_OPACITY);
  // A card that has not climbed onto the deck yet sits at opacity 0 — and for
  // most of this section three of the four are in exactly that state. At
  // opacity 0 they are still laid out, still composited, and still dragged
  // through the stacking context on every frame. `visibility: hidden` takes
  // them out of paint entirely, and unlike `display: none` it keeps their box,
  // so coming back costs no layout.
  const visibility = useTransform(opacity, (v) => (v > 0.01 ? "visible" : "hidden"));
  const glowOpacity = useTransform(depth, DEPTH_DOMAIN, RECEDE_GLOW);
  const glowVisibility = useTransform(glowOpacity, (v) =>
    v > 0.32 ? "visible" : "hidden"
  );
  const scrimOpacity = useTransform(depth, DEPTH_DOMAIN, RECEDE_SCRIM);
  const lift = useTransform(depth, DEPTH_DOMAIN, RECEDE_LIFT);

  // Layered drop shadow driven by elevation: a tight contact shadow plus a
  // wide, soft ambient one that swells as the card floats to the front.
  //
  // This used to be a single motion value writing `box-shadow` inline on every
  // frame. box-shadow is a *paint* property — rewriting it forces the browser
  // to re-rasterise the card and a 90px blur skirt around it, four cards at a
  // time, for the entire length of a spring. It was the most expensive thing
  // on this section by a wide margin.
  //
  // The same elevation now cross-fades two statically-rasterised shadow layers
  // (see SETTLED_SHADOW / FLOATING_SHADOW below). Only `opacity` animates, the
  // layers are painted once, and the whole deck runs on the compositor.
  const floatShadowOpacity = useTransform(lift, [RECEDE_LIFT[4], 1], [0, 1]);
  // Same fill-rate argument as the bloom: this quad is card-sized *plus* a
  // 90px blur skirt, and past the first receded stage it is a barely-there
  // shadow under a card that is already mostly covered. Taken out of the
  // composite rather than blended at an alpha that reads as nothing.
  const floatShadowVisibility = useTransform(floatShadowOpacity, (v) =>
    v > 0.25 ? "visible" : "hidden"
  );

  const accent = ACCENT[service.accent];
  // Touch devices have no hovering pointer to track at all, and on a low-tier
  // device the sheen's full-card gradient repaint is not a good trade.
  const pointerFx = useDeviceBudget().allowPointerFx;

  // --- Restrained pointer-driven light + tilt, only on the active face ---
  // `activeness` is 1 on the front card and 0 once it has left the front, so
  // receded cards silently ignore the pointer without any React state.
  //
  // It used to be `useTransform(depth, …)` — derived continuously from the
  // scroll. That was the quiet expensive one. Because it changed on every
  // frame, so did `tiltX`, `tiltY` and `hoverScale`, so Motion rewrote a
  // second 3D transform on a second promoted layer, per card, for the whole
  // length of the deck — to express the identity transform, since with no
  // pointer on the card `px`, `py` and `hover` are all resting at 0.
  //
  // A pointer can only be on one card at a time, and it cannot be on a card
  // without entering it, so the question "is this the front card?" only has
  // to be answered at that moment. Sampling it on enter leaves the tilt chain
  // completely still while scrolling.
  const activeness = useMotionValue(0);

  const pxRaw = useMotionValue(0);
  const pyRaw = useMotionValue(0);
  const hoverRaw = useMotionValue(0);
  const px = useSpring(pxRaw, { stiffness: 120, damping: 20, mass: 0.5 });
  const py = useSpring(pyRaw, { stiffness: 120, damping: 20, mass: 0.5 });
  const hover = useSpring(hoverRaw, { stiffness: 180, damping: 26 });

  const tiltX = useTransform([py, activeness] as MotionValue[], ([p, a]: number[]) => -p * 3.2 * a);
  const tiltY = useTransform([px, activeness] as MotionValue[], ([p, a]: number[]) => p * 3.6 * a);
  const hoverScale = useTransform(
    [hover, activeness] as MotionValue[],
    ([h, a]: number[]) => 1 + h * a * 0.008
  );
  const light = useTransform(
    [px, py] as MotionValue[],
    ([x, y]: number[]) =>
      `radial-gradient(38% 46% at ${(50 + x * 55).toFixed(1)}% ${(46 + y * 55).toFixed(
        1
      )}%, rgba(255,251,242,0.9), rgba(255,251,242,0) 62%)`
  );
  const lightOpacity = useTransform(
    [hover, activeness] as MotionValue[],
    ([h, a]: number[]) => h * a * 0.5
  );

  // The sheen is `mix-blend-mode: soft-light` across the whole card face. A
  // blended child cannot be composited on its own — it has to be drawn against
  // its backdrop — which pulls the entire card out of the fast path and makes
  // every scroll frame a repaint of the card *and* the blend, four cards deep.
  //
  // It is also invisible unless a pointer is on the card. So it is mounted on
  // enter and unmounted once the leave spring has actually finished fading it,
  // which means the deck scrolls with no blended layer in it at all. Two React
  // renders per hover, none per frame.
  const [sheenMounted, setSheenMounted] = useState(false);
  useEffect(() => {
    if (!pointerFx) return;
    return hover.on("change", (v) => setSheenMounted(v > 0.002));
  }, [hover, pointerFx]);

  // getBoundingClientRect inside a pointermove handler forces a synchronous
  // layout on *every* event — up to ~120 a second on a high-polling mouse.
  // The card's box is measured once on enter and reused for the hover.
  //
  // It does move, though: the whole deck translates, scales and rotates with
  // the scroll. So the measurement is invalidated once per scroll frame and
  // re-taken lazily on the next pointer move — one layout read per frame at
  // worst, instead of one per event.
  const rectRef = useRef<DOMRect | null>(null);
  useEffect(() => {
    if (!pointerFx) return;
    return onScrollFrame(() => {
      rectRef.current = null;
    });
  }, [pointerFx]);

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!pointerFx) return;
    const rect = rectRef.current ?? event.currentTarget.getBoundingClientRect();
    rectRef.current = rect;
    pxRaw.set((event.clientX - rect.left) / rect.width - 0.5);
    pyRaw.set((event.clientY - rect.top) / rect.height - 0.5);
  }
  function handlePointerEnter(event: React.PointerEvent<HTMLDivElement>) {
    if (!pointerFx) return;
    rectRef.current = event.currentTarget.getBoundingClientRect();
    // Sampled once, here — see the note on `activeness`.
    const d = depth.get();
    activeness.set(Math.max(0, 1 - Math.abs(d) / 0.55));
    hoverRaw.set(1);
  }
  function handlePointerLeave() {
    rectRef.current = null;
    hoverRaw.set(0);
    pxRaw.set(0);
    pyRaw.set(0);
  }

  // Everything inside the card, hoisted out so the pointer-tilt wrapper can be
  // dropped entirely on devices that have no pointer to tilt for. That wrapper
  // is not free when it is idle: `activeness` is derived from `depth`, so it
  // changed on every scroll frame and Motion rewrote a second 3D transform per
  // card for a value that was always the identity.
  const body = (
    <>
      {/* Ambient accent bloom — pure radial falloff, no blur filter.
          It is larger than the card it sits behind, so it is one of the widest
          translucent quads in the deck, and the deeper stages spend it on
          almost nothing: by depth 2 the glow is at 0.3 of a colour that is
          itself 0.34 alpha, behind two cards that already cover it. Below the
          threshold it is taken out of the composite entirely rather than
          blended at an alpha nobody can see. */}
      <motion.div
        aria-hidden="true"
        style={{
          opacity: glowOpacity,
          visibility: glowVisibility,
          background: `radial-gradient(58% 62% at 50% 40%, ${accent.glow}, transparent 72%)`,
        }}
        className="absolute -inset-10 -z-10 rounded-[52px]"
      />

      {/* The floating half of the elevation cross-fade. Its resting partner
          used to be a second span pinned behind the card; it is now the card's
          own `box-shadow` (below), because an outer shadow is not clipped by
          the element's own `overflow: hidden` and did not need a layer of its
          own. That is one always-present, card-sized translucent quad with a
          40px blur skirt removed from every card, on every frame. */}
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-[1] rounded-[28px]"
        style={{
          boxShadow: FLOATING_SHADOW,
          opacity: floatShadowOpacity,
          visibility: floatShadowVisibility,
        }}
      />

      <div
        style={{ boxShadow: SETTLED_SHADOW }}
        className={`relative flex flex-col overflow-hidden rounded-[28px] border ${accent.ring} md:h-[68vh] md:min-h-[420px] md:max-h-[560px] md:flex-row`}
      >
        {/* Base surface — a subtly top-lit parchment, giving the card a
            believable material rather than a flat fill. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(168deg,#ffffff_0%,var(--bg)_46%,#f2ece1_100%)]"
        />

        {/* Machined edge: hairline inner highlight around the whole rim, a
            brighter catch along the top, and a soft seated shade at the base. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[25] rounded-[28px] shadow-[inset_0_1px_0_rgba(255,255,255,0.85),inset_0_0_0_1px_rgba(255,255,255,0.35),inset_0_-28px_46px_-32px_rgba(22,20,15,0.28)]"
        />

        {/* Accent edge-light — a faint colored rim that ties the card to its
            discipline without a glowing border. */}
        <span
          aria-hidden="true"
          style={{ boxShadow: `inset 0 0 0 1px ${accent.edge}` }}
          className="pointer-events-none absolute inset-0 z-[26] rounded-[28px] opacity-40"
        />

        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 z-[27] h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.95),transparent)]"
        />

        {/* Cursor-tracked sheen — soft-light so it warms the surface rather
            than washing it out. Fades in only on the active face, and only
            exists in the tree while the pointer is on the card (see
            `sheenMounted`): a blended layer is the one thing in here that
            would keep the card off the compositor while it scrolls. */}
        {sheenMounted && (
          <motion.div
            aria-hidden="true"
            style={{ background: light, opacity: lightOpacity, mixBlendMode: "soft-light" }}
            className="pointer-events-none absolute inset-0 z-[28]"
          />
        )}

        <div className="relative z-10 flex flex-1 flex-col justify-between p-8 sm:p-10 md:p-12">
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute -top-3 right-6 select-none font-display text-[7rem] leading-none sm:-top-4 sm:text-[9rem] ${accent.numeral}`}
          >
            {service.n}
          </span>

          <div className="relative">
            <div className="flex items-center gap-3">
              <span className={`font-display text-sm tracking-[0.15em] ${accent.label}`}>
                {service.n}
              </span>
              <span className="h-px w-8 bg-line" />
              <span className="font-display text-xs tracking-[0.3em] text-ink-soft">
                {String(total).padStart(2, "0")} SERVICES
              </span>
            </div>

            <h3 className="mt-6 max-w-md font-display text-3xl leading-[1.15] text-ink sm:text-4xl">
              {service.name}
            </h3>

            <p className="mt-6 max-w-sm text-base leading-relaxed text-ink-soft sm:text-lg">
              {service.description}
            </p>
          </div>

          <div className="relative mt-10 flex items-center gap-3 md:mt-0">
            <span className={`h-px w-10 ${accent.line}`} />
            <span className="text-xs tracking-[0.2em] text-ink-soft/80">
              DWARKA STUDIOS
            </span>
          </div>
        </div>

        {/* `isolation: isolate` matters more than it looks. The accent tint
            below is `mix-blend-multiply`, and a blend resolves against
            everything beneath it in the nearest isolated stacking context —
            which, without this, was the whole card. That made the entire
            card a single non-composited blend group that had to be redrawn
            on every scroll frame. Isolating here keeps the blend (and the
            redraw) inside the image panel, where its backdrop actually is,
            and the look is identical. */}
        <div
          style={{ isolation: "isolate" }}
          className={`relative z-10 min-h-[220px] flex-1 overflow-hidden md:min-h-0 md:max-w-[38%] ${accent.panel}`}
        >
          <Image
            src={service.image}
            alt={service.name}
            fill
            sizes="(min-width: 768px) 38vw, 100vw"
            className="object-cover"
          />
          {/* Accent tint — lighter than before so the artwork reads through. */}
          <div
            aria-hidden="true"
            className={`absolute inset-0 mix-blend-multiply opacity-40 ${accent.panel}`}
          />
          {/* Directional key light raking across the panel + a grounding
              vignette, for depth and richer material. */}
          <div
            aria-hidden="true"
            style={{
              background: `linear-gradient(118deg, ${accent.sheen} 0%, transparent 42%), linear-gradient(300deg, rgba(0,0,0,0.42) 0%, transparent 46%)`,
            }}
            className="absolute inset-0"
          />
          {/* Seam between text and image — a lit edge that seats the panel. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 hidden w-px bg-[linear-gradient(180deg,transparent,rgba(255,255,255,0.55),transparent)] md:block"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 hidden w-16 shadow-[inset_18px_0_34px_-26px_rgba(0,0,0,0.6)] md:block"
          />
        </div>
      </div>

      {/* Recede scrim — dims the card as it sinks into the deck.
          ─────────────────────────────────────────────────────────────────
          This lives *outside* the card, and that is the single most valuable
          line in this file.

          It used to be the last child inside the card face, which is a
          rounded, `overflow-hidden` box carrying a 3D transform. A compositor
          cannot draw an animating child straight into the root through a
          rounded clip — it has to render the whole clipped subtree into an
          offscreen surface first, apply the clip and the projection, then
          draw that. So one animating opacity in here meant all four cards
          were being re-rendered offscreen every frame instead of being drawn
          as the cached textures they otherwise are. Measured on an Intel UHD
          at 1440x900, the deck ran at a locked 30fps with ~51% of frames
          dropped; one card alone ran at a clean 60.

          As a sibling it covers exactly the same box — the wrapper is sized
          by the card face — and rounds its own corners, so it looks identical
          while staying a plain quad the compositor can just blend. */}
      <motion.div
        aria-hidden="true"
        style={{ opacity: scrimOpacity }}
        className="pointer-events-none absolute inset-0 z-30 rounded-[28px] bg-ink"
      />
    </>
  );

  const card = (
    <motion.div
      style={{
        y,
        scale,
        rotateX,
        rotate: rotateZ,
        opacity,
        visibility,
        zIndex: index,
        transformPerspective: 2400,
        // Promote the card once, up front. The whole deck animation is
        // transform + opacity, so a standing compositor layer is exactly the
        // right shape for it — without the hint Chromium keeps re-rasterising
        // the card at each new scale step, which is what made arriving at a
        // new card hitch.
        willChange: "transform, opacity",
        backfaceVisibility: "hidden",
      }}
      className="absolute inset-0 flex items-center justify-center px-4 sm:px-6"
    >
      {pointerFx ? (
        <motion.div
          onPointerMove={handlePointerMove}
          onPointerEnter={handlePointerEnter}
          onPointerLeave={handlePointerLeave}
          style={{ rotateX: tiltX, rotateY: tiltY, scale: hoverScale, transformPerspective: 1400 }}
          className="relative w-full max-w-[1080px]"
        >
          {body}
        </motion.div>
      ) : (
        <div className="relative w-full max-w-[1080px]">{body}</div>
      )}
    </motion.div>
  );

  if (index === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.96, rotateX: -6 }}
        whileInView={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
        viewport={{ once: true, margin: "-15%" }}
        transition={{ duration: 1, ease: EASE }}
        className="absolute inset-0"
        style={{ zIndex: index, transformPerspective: 2400 }}
      >
        {card}
      </motion.div>
    );
  }

  return card;
}

/** Slim per-scene progress rail beneath the heading — communicates that the
 *  scroll is stepping through discrete scenes, not just translating cards. */
function ProgressTick({
  index,
  total,
  progress,
}: {
  index: number;
  total: number;
  progress: MotionValue<number>;
}) {
  const seg = 1 / total;
  const start = index * seg;
  const end = (index + 1) * seg;
  // Ranges must stay strictly increasing inside [0, 1] for the first/last tick.
  const eps = 0.001;
  const a = Math.max(0, start - 0.02);
  const b = Math.max(a + eps, start);
  const c = Math.max(b + eps, end - 0.01);
  const d = Math.min(1, Math.max(c + eps, end + 0.02));
  // Auto-clamped at the domain ends, so each bar fills only during its scene.
  const fill = useTransform(progress, [start, Math.max(start + eps, end)], [0, 1]);
  const dim = useTransform(progress, [a, b, c, d], [0.35, 1, 1, 0.5]);

  return (
    <motion.span
      style={{ opacity: dim }}
      className="relative h-[3px] w-10 overflow-hidden rounded-full bg-ink/10"
    >
      <motion.span
        style={{ scaleX: fill }}
        className="absolute inset-0 origin-left rounded-full bg-[linear-gradient(90deg,var(--gold-deep),var(--gold),var(--gold-light))]"
      />
    </motion.span>
  );
}

export function ServicesStack() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  return (
    <section
      id="services"
      className="relative bg-bg-warm"
      data-navbar-bg="var(--bg-warm)"
      data-navbar-fg="var(--ink)"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, var(--gold-light), transparent)",
        }}
      />

      {/* Desktop / tablet — pinned depth-stacked deck */}
      <div
        ref={containerRef}
        className="relative hidden md:block"
        style={{ height: `${SEGMENT_VH * SERVICES.length}vh` }}
      >
        <div className="sticky top-0 flex h-screen flex-col overflow-hidden">
          <div className="mx-auto max-w-3xl px-6 pt-16 text-center">
            <p className="font-display text-xs tracking-[0.3em] text-gold">
              SERVICES
            </p>
            <h2 className="mt-4 font-display text-3xl text-ink sm:text-4xl">
              Four disciplines. One studio.
            </h2>
            <div className="mt-7 flex items-center justify-center gap-2.5">
              {SERVICES.map((service, index) => (
                <ProgressTick
                  key={service.n}
                  index={index}
                  total={SERVICES.length}
                  progress={scrollYProgress}
                />
              ))}
            </div>
          </div>

          {/* Perspective stage — gives the receded cards real depth. */}
          <div
            className="relative mt-8 flex-1"
            style={{ perspective: "2400px", perspectiveOrigin: "50% 44%" }}
          >
            {SERVICES.map((service, index) => (
              <StackCard
                key={service.n}
                service={service}
                index={index}
                total={SERVICES.length}
                progress={scrollYProgress}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Mobile — simple reveal list, no scroll-jacking */}
      <div className="px-6 py-20 md:hidden">
        <div className="mx-auto max-w-md text-center">
          <p className="font-display text-xs tracking-[0.3em] text-gold">
            SERVICES
          </p>
          <h2 className="mt-4 font-display text-3xl text-ink">
            Four disciplines. One studio.
          </h2>
        </div>

        <div className="mt-12 flex flex-col gap-6">
          {SERVICES.map((service) => {
            const accent = ACCENT[service.accent];
            return (
              <motion.div
                key={service.n}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-10%" }}
                transition={{ duration: 0.7, ease: EASE }}
                className={`relative overflow-hidden rounded-[24px] border ${accent.ring} bg-[linear-gradient(168deg,#ffffff_0%,var(--bg)_60%,#f2ece1_100%)] shadow-[0_1px_0_rgba(255,255,255,0.8),0_24px_46px_-26px_rgba(22,20,15,0.34)]`}
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 z-20 rounded-[24px] shadow-[inset_0_1px_0_rgba(255,255,255,0.8),inset_0_0_0_1px_rgba(255,255,255,0.3)]"
                />
                <div
                  style={{ isolation: "isolate" }}
                  className={`relative h-36 w-full ${accent.panel}`}
                >
                  <Image
                    src={service.image}
                    alt={service.name}
                    fill
                    sizes="100vw"
                    className="object-cover"
                  />
                  <div
                    aria-hidden="true"
                    className={`absolute inset-0 mix-blend-multiply opacity-40 ${accent.panel}`}
                  />
                  <div
                    aria-hidden="true"
                    style={{
                      background: `linear-gradient(118deg, ${accent.sheen} 0%, transparent 44%), linear-gradient(300deg, rgba(0,0,0,0.4) 0%, transparent 48%)`,
                    }}
                    className="absolute inset-0"
                  />
                </div>
                <div className="relative p-6">
                  <div className="flex items-center gap-3">
                    <span className={`font-display text-sm tracking-[0.15em] ${accent.label}`}>
                      {service.n}
                    </span>
                    <span className="h-px w-8 bg-line" />
                  </div>
                  <h3 className="mt-4 font-display text-2xl text-ink">
                    {service.name}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                    {service.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
