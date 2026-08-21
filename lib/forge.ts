/* -----------------------------------------------------------------------
   Forge colours — shared between the scene and the page that frames it
   ─────────────────────────────────────────────────────────────────────
   Deliberately a plain module rather than exports on DeferredForge, which
   is a "use client" file. A server component that imports a value from a
   client module does not get the value: Next replaces it with a client
   reference, and interpolating one into a template literal throws
   "Attempted to call FORGE_FLOOR() from the server". app/page.tsx is a
   server component and needs both of these, so they live here, where both
   sides can read them as ordinary strings.
   ----------------------------------------------------------------------- */

/** The forge's backdrop colour, and the colour of everything that has to
 *  dissolve into it: the placeholder behind the deferred scene, the ink
 *  wash that floods the section, and that wash's reveal veil. */
export const FORGE_GROUND = "#6a5330";

/** The colour the scene's floor is brought down to at its very bottom edge,
 *  and the colour the page's exit strip starts from.
 *
 *  Without the ramp that enforces it, the bottom row of the scene is
 *  whatever the backdrop shader happened to draw there — which is not the
 *  same on every viewport, because the stage restacks the orbs on a portrait
 *  phone. A strip sampled off the desktop composition showed a visible step
 *  on a phone. Pinning the last band of the scene to a fixed colour makes
 *  the seam below it deterministic instead of composition-dependent, and it
 *  reads as the floor falling into shadow — which is what the scene's own
 *  corner vignette is already doing. */
export const FORGE_FLOOR = "#221503";

/** The floor ramp's own gradient, as CSS. Ends on FORGE_FLOOR by definition. */
export const FORGE_FLOOR_RAMP =
  `linear-gradient(180deg, rgba(34,21,3,0) 0%, rgba(34,21,3,0.55) 58%, ${FORGE_FLOOR} 100%)`;
