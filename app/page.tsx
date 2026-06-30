import BeforeAfterDwarka from "@/components/BeforeAfterDwarka";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { ScrollProgress } from "@/components/ScrollProgress";
import { AICore } from "@/components/sections/AICore";
import { BeforeAfter } from "@/components/sections/BeforeAfter";
import { ClosingBridge } from "@/components/sections/ClosingBridge";
import { FoundersNote } from "@/components/sections/FoundersNote";
import { Hero } from "@/components/sections/Hero";
import { MissionVision } from "@/components/sections/MissionVision";
import { ServicesStack } from "@/components/sections/ServicesStack";
import { WhatSetsUsApart } from "@/components/sections/WhatSetsUsApart";
import { WhoWeAre } from "@/components/sections/WhoWeAre";
import { WhyDwarka } from "@/components/sections/WhyDwarka";

export default function Home() {
  return (
    <>
      <ScrollProgress />
      <Nav />
      <main className="flex-1">
        <Hero />
        <WhoWeAre />
        <WhyDwarka />
        <MissionVision />
        <WhatSetsUsApart />
        <AICore />
        <ServicesStack />
        <BeforeAfter />
        <BeforeAfterDwarka />
        <ClosingBridge />
        <FoundersNote />
      </main>
      <Footer />
    </>
  );
}
