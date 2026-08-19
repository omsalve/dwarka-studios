import { OpeningSequence } from "@/components/OpeningSequence";

// Isolated preview for building/tuning the opening sequence. Flip DEBUG_HITBOX
// in components/OpeningSequence/constants.ts to position the feather box.
export default function OpeningPreviewPage() {
  // No `onUnlock` here, so there is nowhere to skip *to* — the exit would be
  // a dead control on a page whose whole purpose is watching the sequence.
  return <OpeningSequence skippable={false} />;
}
