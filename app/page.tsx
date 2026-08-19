/* Import discipline matters more than usual on this route: every "use client"
   module named here lands in the landing page's client bundle whether or not
   it is rendered. Six section components (AICore, BeforeAfter, MissionVision,
   WhatSetsUsApart, WhoWeAre, WhyDwarka) were imported and never used, and
   IntroProvider was pulled through the GateIntro barrel, which dragged the
   entire superseded three-video gate intro along with it. Both are fixed
   below: nothing is imported here that the page does not render, and the
   provider comes straight from the module that defines it. */
import { Footer } from "@/components/Footer";
import { IntroProvider } from "@/components/GateIntro/IntroContext";
import { HeroForgeTransition } from "@/components/HeroForgeTransition";
import { IntroAutoScroll } from "@/components/IntroAutoScroll";
import { InkTransition } from "@/components/InkTransition";
import { Nav } from "@/components/Nav";
import { ScrollProgress } from "@/components/ScrollProgress";
import { SplashIntro } from "@/components/SplashIntro";
import { DeferredForge } from "@/components/scenes/DeferredForge";
import { ClosingBridge } from "@/components/sections/ClosingBridge";
import { FoundersNote } from "@/components/sections/FoundersNote";
import { Hero } from "@/components/sections/Hero";
import { ServicesStack } from "@/components/sections/ServicesStack";

export default function Home() {
  return (
    <IntroProvider>
      {/* The two-video splash: video1x holds on its first frame until the
          centre "door" column is hovered, plays through, and dissolves into
          video2x with no seam. When video2x ends the overlay fades and the
          hero underneath comes alive. See components/SplashScreen.
          (Swapped in for <GateIntro /> — restore that import to go back.) */}
      <SplashIntro />
      {/* Hero → Dwarka: a luminous "descent into the temple" bridge that
          replaces the old ink flood — the temple's light ignites, holds the
          threshold over the section seam, then parts as the forge condenses.
          See lib/heroBridge.ts for the shared timeline it shares with Hero
          and BeforeAfterDwarka. */}
      <HeroForgeTransition />
      {/* Captures the first scroll gesture at the top and plays the descent as
          a fixed ~5.5s beat, locking input so it can't be overshot — the page
          comes to rest settled on the forge. */}
      <IntroAutoScroll />
      <InkTransition
        color="#faf7f1" // exact match: ServicesStack's bg-bg-warm
        veilId="before-after-veil"
        // Starts only after the descent's rest point (restDepth = 2.5·vh), so
        // the forge gets a settle-and-look window before the next transition.
        spreadStartVh={2.75}
        spreadEndVh={3.5}
        fadeEndVh={3.80}
      />
      <ScrollProgress />
      <Nav />
      <main className="flex-1">
        <div style={{ position: "relative", height: "200vh", background: "var(--ink-deep)" }}>
          <div style={{ position: "sticky", top: 0, height: "100vh", overflow: "hidden" }}>
            <Hero />
          </div>
        </div>
        <div style={{ position: "relative", height: "180vh" }}>
          <div style={{ position: "sticky", top: 0, height: "100vh", overflow: "hidden" }}>
            <DeferredForge />
            <div
              id="before-after-veil"
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: 0,
                // Matches the incoming ink's destination color (not this
                // section's own black background) — the veil only ramps in
                // once the ink is already meant to fully cover this section,
                // so it must read as the *next* section's color or the
                // fade-out phase blends translucent white over a black
                // veil into a visible gray smear.
                background: "#faf7f1",
                opacity: 0,
                zIndex: 30,
                pointerEvents: "none",
              }}
            />
          </div>
        </div>

        <ServicesStack />
        <ClosingBridge />
        <FoundersNote />
      </main>
      <Footer />
    </IntroProvider>
  );
}
