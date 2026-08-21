/* Import discipline matters more than usual on this route: every "use client"
   module named here lands in the landing page's client bundle whether or not
   it is rendered. Six section components (AICore, BeforeAfter, MissionVision,
   WhatSetsUsApart, WhoWeAre, WhyDwarka) were imported and never used, and
   IntroProvider was pulled through the GateIntro barrel, which dragged the
   entire superseded three-video gate intro along with it. Both are fixed
   below: nothing is imported here that the page does not render, and the
   provider comes straight from the module that defines it. */
import { FORGE_FLOOR, FORGE_GROUND } from "@/lib/forge";
import { ABOUT } from "@/lib/heroBridge";
import { Footer } from "@/components/Footer";
import { IntroProvider } from "@/components/GateIntro/IntroContext";
import { HashLanding } from "@/components/HashLanding";
import { HeroLightBridge } from "@/components/HeroLightBridge";
import { IntroAutoScroll } from "@/components/IntroAutoScroll";
import { InkTransition } from "@/components/InkTransition";
import { Nav } from "@/components/Nav";
import { ScrollProgress } from "@/components/ScrollProgress";
import { SplashIntro } from "@/components/SplashIntro";
import { DeferredForge } from "@/components/scenes/DeferredForge";
import { About } from "@/components/sections/About";
import { FoundersNote } from "@/components/sections/FoundersNote";
import { Hero } from "@/components/sections/Hero";
import { ServicesStack } from "@/components/sections/ServicesStack";

/* -----------------------------------------------------------------------
   Landing order and the seams between its sections
   ─────────────────────────────────────────────────────────────────────

     Hero            dark valley, temple at golden hour
       ↓  the light bridge: the dive ignites, holds over the seam, clears
     About           the gilded threshold — the manifesto, lit word by word
       ↓  ink wash flooding parchment upward
     Founder's Note  the 3D diary on warm paper
       ↓  a quiet gilded seam (both sides are already bg-warm)
     Services        the pinned four-card deck
       ↓  ink wash flooding antique gold upward
     Before & After  the forge — the page's closing set piece
       ↓  the gold field lightening back to paper
     Footer

   The colour arc is deliberate and every seam is a dissolve between two
   *identical* colours rather than a cut between two different ones: dark →
   gold → parchment → parchment → gold-dark. The first two transitions are
   keyed to absolute page depth (exact, and safe because both containers
   above them are fixed-height); the last is anchored to the forge's own
   container, because the two variable-height sections above it make an
   absolute depth unknowable. See lib/heroBridge.ts and InkTransition.
   ----------------------------------------------------------------------- */

/** Hero container height, in vh. The Hero pins for the first 100vh of it and
 *  the About panel takes the viewport at the end — which is BRIDGE.holdEnd. */
const HERO_VH = 200;
/** About container height, in vh. Pins for its first 100vh (the reveal), then
 *  scrolls away under the ink. */
const ABOUT_VH = 200;
/** Forge container height, in vh: 100vh of pinned dwell with the scene, since
 *  it is interactive (the orbs open a panel), then it releases to the footer. */
const FORGE_VH = 200;
/** The strip that carries the forge's floor back up to paper — see below. */
const FORGE_EXIT_VH = 18;
/** Where the nav's "Approach" anchor sits inside the forge container, in vh.
 *  Not its top: the ink flooding into the forge is still fully opaque there
 *  (the transition below only begins thinning at 1.35 container-approaches,
 *  and the container's top *is* 1.0), so an anchor on the container itself
 *  would drop the visitor onto a flat gold field. Anything past 0.35 clears
 *  the veil; this is comfortably past it and still well inside the 100vh
 *  pin, so the scene is settled and filling the viewport on arrival. */
const FORGE_ANCHOR_VH = 50;
/** Where the nav's "About" anchor sits inside the About container, in vh.
 *  Not its top either, and for the same reason as the forge's: at the top of
 *  this container the light bridge is still holding solid over the seam
 *  (BRIDGE.holdEnd is 2.0, exactly here, and it does not finish clearing
 *  until 2.3), so the manifesto is behind an unbroken gold wash. The reveal's
 *  own first frame is the honest target — derived from ABOUT.wordsStart, in
 *  absolute page depth, minus the hero container above it — so the anchor
 *  cannot drift if that timeline is ever retimed. */
const ABOUT_ANCHOR_VH = ABOUT.wordsStart * 100 - HERO_VH;

export default function Home() {
  return (
    <IntroProvider>
      {/* The two-video splash: video1x holds on its first frame until the
          centre "door" column is hovered, plays through, and dissolves into
          video2x with no seam. When video2x ends the overlay fades and the
          hero underneath comes alive. See components/SplashScreen.
          (Swapped in for <GateIntro /> — restore that import to go back.) */}
      <SplashIntro />
      {/* Hero → About: a luminous "descent into the threshold" bridge — the
          temple's light ignites, holds over the section seam, then clears to
          leave the About panel, which carries the identical gradient as its
          own background. See lib/heroBridge.ts for the shared timeline. */}
      <HeroLightBridge />
      {/* Captures the first scroll gesture at the top and plays the descent as
          a fixed ~3s beat, locking input so it can't be overshot — the page
          comes to rest mid-way through the About reveal. */}
      <IntroAutoScroll />
      {/* Arriving here from another route with a fragment (#about, #services,
          #approach — the nav's own links, from /contact) is a full load, and
          the browser resolves the fragment against a page that is still
          growing. This re-lands it once the layout has settled. */}
      <HashLanding />
      {/* About → Founder's Note. fadeEnd matches the end of the About
          container, so the ink finishes clearing exactly as the note takes
          the viewport. */}
      <InkTransition
        color="#faf7f1" // exact match: FoundersNote's bg-bg-warm
        veilId="about-veil"
        spreadStartVh={2.95}
        spreadEndVh={3.70}
        fadeEndVh={4.00}
      />
      {/* Services → Before & After Dwarka. Anchored to the forge's container
          rather than a page depth, and in "reveal" mode: the veil inside that
          container starts opaque and lets go with the canvas, so the WebGL
          scene can never composite itself over the rising ink on its way up.

          The two out-of-range numbers are both load-bearing, because unlike
          the transitions above this one the incoming section is *moving*:

          · spreadStart is negative so the flood begins a third of a viewport
            before the forge's container reaches the fold. The ink's ease-in
            is slow off the mark, and the forge's top edge rises linearly, so
            a flood that started level with it would be overtaken within
            ~150px and the container's flat top would be visible as a hard
            rule sliding up through the wash. Starting early puts the ink's
            leading edge permanently above that rule.

          · fadeEnd is past 1.0 so the ink only begins thinning *after* the
            forge is pinned and filling the viewport. Fading any earlier
            uncovers the empty tail of the services section above the forge's
            top edge — cream, against gold ink, in the last moment before the
            reveal. The container is 200vh, so the whole fade happens well
            inside the pin. */}
      <InkTransition
        color={FORGE_GROUND} // the section it floods into, exactly
        anchorId="dwarka"
        veilId="dwarka-veil"
        veilMode="reveal"
        spreadStartVh={-0.35}
        spreadEndVh={1.00}
        fadeEndVh={1.35}
      />
      <ScrollProgress />
      <Nav />
      <main className="flex-1">
        <div style={{ position: "relative", height: `${HERO_VH}vh`, background: "var(--ink-deep)" }}>
          <div style={{ position: "sticky", top: 0, height: "100vh", overflow: "hidden" }}>
            <Hero />
          </div>
        </div>

        <div style={{ position: "relative", height: `${ABOUT_VH}vh` }}>
          {/* Nav "About" target — the manifesto ("The past was built by master
              craftsmen…"). A positioned element rather than an id on the
              container or on the panel: the panel is sticky, so its own
              document position depends on which way you arrived from, and the
              container's top is still under the bridge's wash. See
              ABOUT_ANCHOR_VH. */}
          <div
            id="about"
            aria-hidden="true"
            className="pointer-events-none absolute left-0 h-px w-px"
            style={{ top: `${ABOUT_ANCHOR_VH}vh` }}
          />
          <div style={{ position: "sticky", top: 0, height: "100vh", overflow: "hidden" }}>
            <About />
            <div
              id="about-veil"
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: 0,
                // Matches the incoming ink's destination color (not this
                // section's own gilded background) — the veil only ramps in
                // once the ink is already meant to fully cover this section,
                // so it must read as the *next* section's color or the
                // fade-out phase blends translucent parchment over a gold
                // veil into a visible smear.
                background: "#faf7f1",
                opacity: 0,
                zIndex: 30,
                pointerEvents: "none",
              }}
            />
          </div>
        </div>

        <FoundersNote />
        <ServicesStack />

        <div id="dwarka" style={{ position: "relative", height: `${FORGE_VH}vh` }}>
          {/* Nav "Approach" target — Before & After Dwarka. See FORGE_ANCHOR_VH
              for why it is its own element partway down the container rather
              than the container's own id. */}
          <div
            id="approach"
            aria-hidden="true"
            className="pointer-events-none absolute left-0 h-px w-px"
            style={{ top: `${FORGE_ANCHOR_VH}vh` }}
          />
          <div style={{ position: "sticky", top: 0, height: "100vh", overflow: "hidden" }}>
            <DeferredForge />
            <div
              id="dwarka-veil"
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: 0,
                // "reveal" mode: the transition raises this to opaque on
                // mount and thins it away with the canvas, so it must be the
                // forge's own ground colour — the colour the ink is already
                // painting — not the outgoing section's.
                //
                // It ships at 0, not 1. InkTransition bails out entirely
                // under prefers-reduced-motion and never touches the veil, so
                // an opaque default would leave those visitors staring at a
                // flat gold rectangle where the forge should be. Transparent
                // is the correct no-JS / no-motion resting state; the
                // scheduler's priming call sets it before the section is
                // anywhere near the viewport.
                background: FORGE_GROUND,
                opacity: 0,
                zIndex: 30,
                pointerEvents: "none",
              }}
            />
          </div>
        </div>
        {/* Every other seam on this page is a dissolve between two identical
            colours; without this one the page would end on a hard rule
            between the forge's near-black floor and the footer's cream. The
            strip is the scene's own light coming back up — floor, gold field,
            then paper — so the footer is arrived at rather than cut to. It
            carries navbar colours of its own because it is tall enough to win
            the viewport for a moment on the way down. */}
        <div
          aria-hidden="true"
          data-navbar-bg="#96743c"
          data-navbar-fg="var(--parchment)"
          style={{
            height: `${FORGE_EXIT_VH}vh`,
            background: `linear-gradient(180deg, ${FORGE_FLOOR} 0%, #4a3718 24%, #96743c 54%, #dcc9a0 80%, var(--bg-warm) 100%)`,
          }}
        />
      </main>
      <Footer />
    </IntroProvider>
  );
}
