"use client";

/* eslint-disable react-hooks/immutability --
   This scene is an imperative three.js render loop: useFrame mutates the
   book hinge, camera and geometry every frame, which is exactly what React
   Three Fiber is built around. The React Compiler's immutability rule
   assumes ref values are never mutated outside effects, which doesn't hold
   for r3f's per-frame mutation model. */

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, useTexture } from "@react-three/drei";
import { AdaptiveResolution } from "@/components/three/AdaptiveResolution";
import { useDeviceBudget, type DeviceBudget } from "@/lib/deviceTier";
import { useSceneActive } from "@/lib/useVisibility";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import * as THREE from "three";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

/* ----------------------------------------------------------------------- */
/* Book geometry constants                                                 */
/* ----------------------------------------------------------------------- */

const PAGE_W = 1.5; // spine → fore-edge
const PAGE_H = 2.0; // book height
const COVER_T = 0.05;
const BLOCK_T = 0.16;
const SPINE_R = 0.13;

const OPEN_ANGLE_MAX = THREE.MathUtils.degToRad(158);

// All baked canvas textures (cover foil, pages) are drawn at this multiple of
// their original 960x1280 design resolution — higher texel density keeps the
// gold-foil title and letter text crisp when the camera pushes in on open.
//
// This is now a *budget*, not a constant. At 1.6 the five baked textures are
// 1536x2048 each: ~12 megapixels of synchronous 2D canvas painting (paper
// fibre, foxing, foil, laid-out body text) on the main thread at mount, plus
// ~60MB of VRAM. On a mid or low tier that is the single longest task on the
// page, so the density drops with the device — the letter stays legible,
// there are simply fewer texels behind it.
//
// Written exactly once, by applyTextureBudget(), before any texture is baked;
// every builder below reads it synchronously during that same commit.
let TEX_SCALE = 1.6;

function applyTextureBudget(scale: number) {
  TEX_SCALE = scale;
}

const LEATHER_DARK = "#1c130d";
const LEATHER_EDGE = "#150e09";
const GOLD_DEEP = "#a07c2c";
const GOLD = "#c8a24a";
const GOLD_LIGHT = "#e6cd86";
const CREAM = "#f6efdf";
const INK = "#2c2820";

// The left page carries the whole letter now, so it is written as a pair of
// tight editorial paragraphs that breathe on a single page rather than the two
// half-letters the old two-page split used. The fuller original still lives in
// the sr-only block in FoundersNote.tsx for assistive tech / crawlers.
const FOUNDER_PARAGRAPHS = [
  "Since childhood I have been captivated by gaming and animation — by worlds you do not merely watch, but step inside. I have always believed that when we see something we remember it for a while, yet when we truly experience something we never forget it.",
  "That belief is where this journey began. Dwarka Studios exists to give people that unforgettable feeling, and to weave into it the history, culture, and heritage of our country — proof that the craftsmanship of our past belongs inside the most advanced experiences of the future. This is only the beginning, and I am glad you are here for it.",
];

const FOUNDER_NAME = "Srikaran Adapa";
const FOUNDER_ROLE = "Founder · Dwarka Studios";
// Handwritten-style signature scrawl painted above the typeset name.
const SIGNATURE = "Srikaran Adapa";

/* ----------------------------------------------------------------------- */
/* Small math helpers                                                      */
/* ----------------------------------------------------------------------- */

function easeOutCubic(t: number) {
  const c = THREE.MathUtils.clamp(t, 0, 1);
  return 1 - Math.pow(1 - c, 3);
}

function resolveFont(cssVar: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(cssVar)
    .trim();
  return value ? value.split(",")[0].replace(/^["']|["']$/g, "") : fallback;
}

function makeCanvas(w: number, h: number) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  return { canvas, ctx };
}

function hairlineRule(
  ctx: CanvasRenderingContext2D,
  x1: number,
  x2: number,
  y: number,
  color: string,
  lineWidth: number
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
}

// Faint age spots ("foxing"). A few translucent warm blooms are the single
// cheapest cue that reads as "aged printed paper" rather than a flat fill.
function drawFoxing(ctx: CanvasRenderingContext2D, W: number, H: number, count: number) {
  ctx.save();
  for (let i = 0; i < count; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const r = (5 + Math.random() * 18) * TEX_SCALE;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(150,110,60,${(0.04 + Math.random() * 0.05).toFixed(3)})`);
    g.addColorStop(1, "rgba(150,110,60,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Shared paper ground for both inner pages: warm off-white stock, a soft
// top-left sheen (matches the key light in the scene), corner falloff, foxing,
// and a gutter shadow whose side depends on where the spine sits on this page.
function paintPaper(ctx: CanvasRenderingContext2D, W: number, H: number, gutter: "left" | "right") {
  const base = ctx.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, "#f8f2e3");
  base.addColorStop(1, "#efe6d0");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);

  const sheen = ctx.createRadialGradient(W * 0.3, H * 0.16, H * 0.02, W * 0.3, H * 0.16, H * 0.75);
  sheen.addColorStop(0, "rgba(255,255,255,0.45)");
  sheen.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, W, H);

  const vig = ctx.createRadialGradient(W * 0.5, H * 0.5, H * 0.2, W * 0.5, H * 0.5, H * 0.8);
  vig.addColorStop(0, "rgba(120,100,60,0)");
  vig.addColorStop(1, "rgba(120,100,60,0.1)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  drawFoxing(ctx, W, H, 6);

  const gx = gutter === "right" ? ctx.createLinearGradient(W, 0, W * 0.8, 0) : ctx.createLinearGradient(0, 0, W * 0.2, 0);
  gx.addColorStop(0, "rgba(40,30,15,0.26)");
  gx.addColorStop(1, "rgba(40,30,15,0)");
  ctx.fillStyle = gx;
  ctx.fillRect(0, 0, W, H);
}

// Draw one line of words stretched to fill targetWidth (real print justification).
// Short trailing lines fall through as normal left-aligned text via the caller.
function drawJustifiedLine(
  ctx: CanvasRenderingContext2D,
  words: string[],
  x: number,
  y: number,
  targetWidth: number
) {
  if (words.length === 1) {
    ctx.fillText(words[0], x, y);
    return;
  }
  const space = ctx.measureText(" ").width;
  const widths = words.map((w) => ctx.measureText(w).width);
  const wordsW = widths.reduce((a, b) => a + b, 0);
  const gaps = words.length - 1;
  let gap = space + (targetWidth - (wordsW + gaps * space)) / gaps;
  // guard against rivers on very short lines — fall back to a normal single space
  if (gap > space * 2.4 || gap < space * 0.6) gap = space;
  let cx = x;
  words.forEach((w, i) => {
    ctx.fillText(w, cx, y);
    cx += widths[i] + gap;
  });
}

// Auto-fitting editorial body renderer. Picks the largest body size that keeps
// the whole letter on one page, sets a two-line drop cap on the first
// paragraph, justifies interior lines, and adds sub-pixel per-line jitter in
// position and ink density so the block reads as pressed type, not HTML.
function renderEditorialBody(
  ctx: CanvasRenderingContext2D,
  opts: {
    paras: string[];
    family: string;
    capFamily: string;
    x: number;
    top: number;
    bottom: number;
    maxWidth: number;
    ink: string;
  }
) {
  const { paras, family, capFamily, x, top, bottom, maxWidth, ink } = opts;
  const CAP_LINES = 2;

  type Line = { words: string[]; indent: number; justify: boolean; paraStart: boolean };

  function plan(fontPx: number) {
    const lineH = fontPx * 1.62;
    const paraGap = fontPx * 0.75;
    const capFontPx = fontPx * 3;
    ctx.font = `700 ${capFontPx}px ${capFamily}`;
    const capW = ctx.measureText(paras[0].charAt(0)).width;
    const capGap = fontPx * 0.22;

    ctx.font = `400 ${fontPx}px ${family}`;
    const lines: Line[] = [];
    paras.forEach((para, pi) => {
      const raw = pi === 0 ? para.slice(1) : para; // first glyph becomes the drop cap
      const words = raw.split(/\s+/).filter(Boolean);
      let line: string[] = [];
      let idx = 0;
      const widthAt = (i: number) => (pi === 0 && i < CAP_LINES ? maxWidth - capW - capGap : maxWidth);
      const flush = (isLast: boolean) => {
        lines.push({
          words: line,
          indent: pi === 0 && idx < CAP_LINES ? capW + capGap : 0,
          justify: !isLast && line.length > 1,
          paraStart: idx === 0 && pi > 0,
        });
        idx++;
        line = [];
      };
      words.forEach((w) => {
        const test = line.length ? `${line.join(" ")} ${w}` : w;
        if (ctx.measureText(test).width > widthAt(idx) && line.length) {
          flush(false);
          line = [w];
        } else {
          line.push(w);
        }
      });
      if (line.length) flush(true);
    });
    return { lines, lineH, paraGap, capFontPx, fontPx };
  }

  const avail = bottom - top;
  let chosen = plan(34 * TEX_SCALE);
  for (let fontPx = 34 * TEX_SCALE; fontPx >= 22 * TEX_SCALE; fontPx -= TEX_SCALE) {
    const p = plan(fontPx);
    if (p.lines.length * p.lineH + (paras.length - 1) * p.paraGap <= avail) {
      chosen = p;
      break;
    }
    chosen = p;
  }

  const { lines, lineH, paraGap, capFontPx, fontPx } = chosen;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.letterSpacing = "0px";

  const firstBaseline = top + fontPx * 0.86;
  let y = firstBaseline;
  lines.forEach((ln) => {
    if (ln.paraStart) y += paraGap;
    const jx = (Math.random() - 0.5) * 1.4;
    const jy = (Math.random() - 0.5) * 1.2;
    ctx.globalAlpha = 0.9 + Math.random() * 0.1;
    ctx.fillStyle = ink;
    ctx.font = `400 ${fontPx}px ${family}`;
    const startX = x + ln.indent + jx;
    if (ln.justify) {
      drawJustifiedLine(ctx, ln.words, startX, y + jy, maxWidth - ln.indent);
    } else {
      ctx.fillText(ln.words.join(" "), startX, y + jy);
    }
    y += lineH;
  });
  ctx.globalAlpha = 1;

  // drop cap, drawn last so it sits cleanly over the reflowed first lines
  ctx.font = `700 ${capFontPx}px ${capFamily}`;
  ctx.fillStyle = GOLD_DEEP;
  ctx.fillText(paras[0].charAt(0), x, firstBaseline + lineH * 0.92);

  return y;
}

// Cover title lockup, shared by the color/metal/roughness passes so the emboss
// masks register perfectly. FOUNDER dominates; NOTE is a small tracked kicker.
function drawCoverTitle(
  ctx: CanvasRenderingContext2D,
  cinzel: string,
  W: number,
  mainY: number,
  mainFill: string | CanvasGradient,
  subFill: string | CanvasGradient
) {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.font = `700 ${92 * TEX_SCALE}px ${cinzel}`;
  ctx.letterSpacing = `${8 * TEX_SCALE}px`;
  ctx.fillStyle = mainFill;
  ctx.fillText("FOUNDER", W / 2 + 4 * TEX_SCALE, mainY);

  ctx.font = `500 ${28 * TEX_SCALE}px ${cinzel}`;
  ctx.letterSpacing = `${20 * TEX_SCALE}px`;
  ctx.fillStyle = subFill;
  ctx.fillText("NOTE", W / 2 + 10 * TEX_SCALE, mainY + 82 * TEX_SCALE);

  ctx.letterSpacing = "0px";
}

/* ----------------------------------------------------------------------- */
/* Procedural noise bump texture — shared by leather / paper materials     */
/* ----------------------------------------------------------------------- */

function buildGrainTexture(size: number, intensity: number, base: number) {
  const { canvas, ctx } = makeCanvas(size, size);
  ctx.fillStyle = `rgb(${base},${base},${base})`;
  ctx.fillRect(0, 0, size, size);

  const cells = size;
  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;
  for (let i = 0; i < cells * cells; i++) {
    const n = (Math.random() - 0.5) * intensity;
    const v = THREE.MathUtils.clamp(base + n, 0, 255);
    const idx = i * 4;
    data[idx] = v;
    data[idx + 1] = v;
    data[idx + 2] = v;
    data[idx + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 5);
  texture.colorSpace = THREE.NoColorSpace;
  return texture;
}

/* ----------------------------------------------------------------------- */
/* Cover outside face — leather + embossed gold-foil title                 */
/* ----------------------------------------------------------------------- */

function buildCoverTextures(cinzel: string) {
  const W = 960 * TEX_SCALE;
  const H = 1280 * TEX_SCALE;

  // ---- color map ---------------------------------------------------
  const { canvas, ctx } = makeCanvas(W, H);

  const vignette = ctx.createRadialGradient(
    W / 2,
    H / 2,
    H * 0.15,
    W / 2,
    H / 2,
    H * 0.72
  );
  vignette.addColorStop(0, "#241a11");
  vignette.addColorStop(0.6, LEATHER_DARK);
  vignette.addColorStop(1, "#0e0906");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);

  // faint leather color speckle
  for (let i = 0; i < 2400; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const shade = Math.random() > 0.5 ? 255 : 0;
    ctx.fillStyle = `rgba(${shade},${shade},${shade},${(Math.random() * 0.05).toFixed(3)})`;
    ctx.fillRect(x, y, 1.4 * TEX_SCALE, 1.4 * TEX_SCALE);
  }

  // a couple of soft worn scuff streaks
  ctx.save();
  ctx.globalAlpha = 0.08;
  for (let i = 0; i < 4; i++) {
    ctx.strokeStyle = "#f4e6c8";
    ctx.lineWidth = (10 + Math.random() * 16) * TEX_SCALE;
    ctx.beginPath();
    const sx = Math.random() * W;
    const sy = Math.random() * H;
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(
      sx + (Math.random() - 0.5) * 260 * TEX_SCALE,
      sy + (Math.random() - 0.5) * 260 * TEX_SCALE,
      sx + (Math.random() - 0.5) * 420 * TEX_SCALE,
      sy + (Math.random() - 0.5) * 420 * TEX_SCALE
    );
    ctx.stroke();
  }
  ctx.restore();

  // thin restrained frame line
  ctx.strokeStyle = "rgba(200,162,74,0.35)";
  ctx.lineWidth = 2 * TEX_SCALE;
  ctx.strokeRect(W * 0.08, H * 0.07, W * 0.84, H * 0.86);

  // ---- title (embossed foil) — FOUNDER dominant, NOTE as a kicker --------
  const titleY = H * 0.46;

  // recessed shadow
  ctx.save();
  ctx.filter = `blur(${2 * TEX_SCALE}px)`;
  ctx.translate(3 * TEX_SCALE, 4 * TEX_SCALE);
  drawCoverTitle(ctx, cinzel, W, titleY, "rgba(0,0,0,0.55)", "rgba(0,0,0,0.5)");
  ctx.restore();

  // raised highlight
  ctx.save();
  ctx.filter = `blur(${1 * TEX_SCALE}px)`;
  ctx.translate(-2 * TEX_SCALE, -3 * TEX_SCALE);
  drawCoverTitle(ctx, cinzel, W, titleY, "rgba(255,244,214,0.28)", "rgba(255,244,214,0.22)");
  ctx.restore();

  // gold foil fill
  const goldGrad = ctx.createLinearGradient(
    W / 2 - 320 * TEX_SCALE,
    titleY - 90 * TEX_SCALE,
    W / 2 + 320 * TEX_SCALE,
    titleY + 90 * TEX_SCALE
  );
  goldGrad.addColorStop(0, GOLD_DEEP);
  goldGrad.addColorStop(0.5, GOLD_LIGHT);
  goldGrad.addColorStop(1, GOLD_DEEP);
  drawCoverTitle(ctx, cinzel, W, titleY, goldGrad, GOLD);

  // hairline gold rules flanking the NOTE kicker
  ctx.strokeStyle = "rgba(200,162,74,0.55)";
  ctx.lineWidth = 1.4 * TEX_SCALE;
  const kickerY = titleY + 82 * TEX_SCALE;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 200 * TEX_SCALE, kickerY);
  ctx.lineTo(W / 2 - 120 * TEX_SCALE, kickerY);
  ctx.moveTo(W / 2 + 120 * TEX_SCALE, kickerY);
  ctx.lineTo(W / 2 + 200 * TEX_SCALE, kickerY);
  ctx.stroke();

  ctx.letterSpacing = "0px";

  const colorMap = new THREE.CanvasTexture(canvas);
  colorMap.colorSpace = THREE.SRGBColorSpace;

  // ---- metalness mask (letters = metal) -----------------------------
  const metal = makeCanvas(W, H);
  metal.ctx.fillStyle = "#000000";
  metal.ctx.fillRect(0, 0, W, H);
  metal.ctx.filter = "blur(0.6px)";
  drawCoverTitle(metal.ctx, cinzel, W, titleY, "#ffffff", "#dddddd");
  const metalMap = new THREE.CanvasTexture(metal.canvas);
  metalMap.colorSpace = THREE.NoColorSpace;

  // ---- roughness mask (letters = smooth, leather = rough) -----------
  const rough = makeCanvas(W, H);
  rough.ctx.fillStyle = "#c9c9c9";
  rough.ctx.fillRect(0, 0, W, H);
  rough.ctx.filter = "blur(0.6px)";
  drawCoverTitle(rough.ctx, cinzel, W, titleY, "#3a3a3a", "#454545");
  const roughMap = new THREE.CanvasTexture(rough.canvas);
  roughMap.colorSpace = THREE.NoColorSpace;

  return { colorMap, metalMap, roughMap };
}

/* ----------------------------------------------------------------------- */
/* Left page (inside front cover) — the founder's letter, set as editorial  */
/* ----------------------------------------------------------------------- */

function buildLeftPageTexture(cinzel: string, playfair: string, paras: string[]) {
  const W = 960 * TEX_SCALE;
  const H = 1280 * TEX_SCALE;
  const { canvas, ctx } = makeCanvas(W, H);

  // inside of the front cover → hinge at local x=0, so the box -Z face UV
  // maps the spine edge to the RIGHT of this canvas
  paintPaper(ctx, W, H, "right");

  const marginOuter = W * 0.14; // fore-edge (canvas left)
  const marginSpine = W * 0.17; // gutter (canvas right)
  const x0 = marginOuter;
  const maxWidth = W - marginOuter - marginSpine;

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  // eyebrow
  ctx.font = `500 ${15 * TEX_SCALE}px ${cinzel}`;
  ctx.letterSpacing = `${8 * TEX_SCALE}px`;
  ctx.fillStyle = "rgba(160,124,44,0.95)";
  ctx.fillText("A LETTER FROM THE", x0 + 2 * TEX_SCALE, H * 0.12);

  // FOUNDER — the dominant element
  ctx.letterSpacing = `${3 * TEX_SCALE}px`;
  ctx.font = `700 ${104 * TEX_SCALE}px ${cinzel}`;
  ctx.fillStyle = INK;
  const founderY = H * 0.205;
  ctx.fillText("FOUNDER", x0, founderY);

  // "Note" — a quiet secondary label beneath, with a hairline running out to
  // the gutter
  ctx.letterSpacing = "0px";
  ctx.font = `italic 400 ${46 * TEX_SCALE}px ${playfair}`;
  ctx.fillStyle = "#5c5342";
  const noteY = founderY + 54 * TEX_SCALE;
  ctx.fillText("Note", x0 + 2 * TEX_SCALE, noteY);
  const noteW = ctx.measureText("Note").width;
  hairlineRule(
    ctx,
    x0 + noteW + 28 * TEX_SCALE,
    W - marginSpine,
    noteY - 14 * TEX_SCALE,
    "rgba(160,124,44,0.5)",
    1.2 * TEX_SCALE
  );

  renderEditorialBody(ctx, {
    paras,
    family: playfair,
    capFamily: cinzel,
    x: x0,
    top: noteY + 62 * TEX_SCALE,
    bottom: H * 0.93,
    maxWidth,
    ink: INK,
  });

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  return map;
}

/* ----------------------------------------------------------------------- */
/* Right page — the founder feature: framed portrait plate + credit         */
/* ----------------------------------------------------------------------- */

function buildRightPageTexture(cinzel: string, playfair: string) {
  const W = 960 * TEX_SCALE;
  const H = 1280 * TEX_SCALE;
  const { canvas, ctx } = makeCanvas(W, H);

  // spine sits at the LEFT of this page's canvas
  paintPaper(ctx, W, H, "left");

  const mL = W * 0.15; // gutter side
  const mR = W * 0.13; // fore-edge side
  const frameX = mL;
  const frameW = W - mL - mR;
  const frameY = H * 0.1;
  const frameH = frameW * 1.24; // portrait plate, taller than wide
  const fcx = frameX + frameW / 2;

  // soft cast shadow behind the mounted plate
  ctx.save();
  ctx.shadowColor = "rgba(30,22,10,0.35)";
  ctx.shadowBlur = 34 * TEX_SCALE;
  ctx.shadowOffsetY = 16 * TEX_SCALE;
  ctx.fillStyle = "#efe6d0";
  ctx.fillRect(frameX, frameY, frameW, frameH);
  ctx.restore();

  // outer gold rule + cream mat
  ctx.strokeStyle = "rgba(160,124,44,0.85)";
  ctx.lineWidth = 2.4 * TEX_SCALE;
  ctx.strokeRect(frameX, frameY, frameW, frameH);

  const mat = 20 * TEX_SCALE;
  const photoX = frameX + mat;
  const photoY = frameY + mat;
  const photoW = frameW - mat * 2;
  const photoH = frameH - mat * 2;

  // ---- portrait plate placeholder: a warm studio backdrop, top-left key,
  // floor falloff and an engraved monogram. Reads as an intentional editorial
  // plate; drop a real portrait in by compositing over this area later. -----
  const bg = ctx.createLinearGradient(photoX, photoY, photoX, photoY + photoH);
  bg.addColorStop(0, "#4a3f31");
  bg.addColorStop(0.55, "#2e2519");
  bg.addColorStop(1, "#1d160e");
  ctx.fillStyle = bg;
  ctx.fillRect(photoX, photoY, photoW, photoH);

  const key = ctx.createRadialGradient(
    photoX + photoW * 0.42,
    photoY + photoH * 0.3,
    0,
    photoX + photoW * 0.42,
    photoY + photoH * 0.3,
    photoW * 0.95
  );
  key.addColorStop(0, "rgba(230,205,134,0.3)");
  key.addColorStop(0.5, "rgba(200,162,74,0.08)");
  key.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = key;
  ctx.fillRect(photoX, photoY, photoW, photoH);

  const floor = ctx.createLinearGradient(photoX, photoY + photoH * 0.5, photoX, photoY + photoH);
  floor.addColorStop(0, "rgba(0,0,0,0)");
  floor.addColorStop(1, "rgba(0,0,0,0.5)");
  ctx.fillStyle = floor;
  ctx.fillRect(photoX, photoY, photoW, photoH);

  // engraved monogram
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `600 ${photoW * 0.4}px ${cinzel}`;
  ctx.letterSpacing = `${photoW * 0.02}px`;
  ctx.fillStyle = "rgba(20,14,6,0.45)";
  ctx.fillText("SA", photoX + photoW / 2 + 3 * TEX_SCALE, photoY + photoH * 0.47 + 3 * TEX_SCALE);
  ctx.fillStyle = "rgba(230,205,134,0.16)";
  ctx.fillText("SA", photoX + photoW / 2, photoY + photoH * 0.47);
  ctx.letterSpacing = "0px";
  ctx.restore();

  // inner gold hairline hugging the photo
  ctx.strokeStyle = "rgba(200,162,74,0.55)";
  ctx.lineWidth = 1.2 * TEX_SCALE;
  ctx.strokeRect(photoX, photoY, photoW, photoH);

  // registration corner ticks
  const tick = 26 * TEX_SCALE;
  const inset = mat + 12 * TEX_SCALE;
  ctx.strokeStyle = "rgba(160,124,44,0.8)";
  ctx.lineWidth = 1.6 * TEX_SCALE;
  const corners: [number, number, number, number][] = [
    [frameX + inset, frameY + inset, 1, 1],
    [frameX + frameW - inset, frameY + inset, -1, 1],
    [frameX + inset, frameY + frameH - inset, 1, -1],
    [frameX + frameW - inset, frameY + frameH - inset, -1, -1],
  ];
  corners.forEach(([cx, cy, sx, sy]) => {
    ctx.beginPath();
    ctx.moveTo(cx + tick * sx, cy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx, cy + tick * sy);
    ctx.stroke();
  });

  // ---- credit block below the plate ----
  let cy = frameY + frameH + 78 * TEX_SCALE;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  // handwritten-style signature
  ctx.font = `italic 400 ${56 * TEX_SCALE}px ${playfair}`;
  ctx.fillStyle = "#3a3226";
  ctx.fillText(SIGNATURE, fcx, cy);

  hairlineRule(ctx, fcx - 70 * TEX_SCALE, fcx + 70 * TEX_SCALE, cy + 30 * TEX_SCALE, "rgba(160,124,44,0.6)", 1.2 * TEX_SCALE);

  // typeset name
  cy += 84 * TEX_SCALE;
  ctx.font = `600 ${34 * TEX_SCALE}px ${cinzel}`;
  ctx.letterSpacing = `${5 * TEX_SCALE}px`;
  ctx.fillStyle = INK;
  ctx.fillText(FOUNDER_NAME.toUpperCase(), fcx + 2.5 * TEX_SCALE, cy);

  // role
  cy += 42 * TEX_SCALE;
  ctx.font = `400 ${16 * TEX_SCALE}px ${cinzel}`;
  ctx.letterSpacing = `${4 * TEX_SCALE}px`;
  ctx.fillStyle = "rgba(120,108,86,1)";
  ctx.fillText(FOUNDER_ROLE.toUpperCase(), fcx + 2 * TEX_SCALE, cy);
  ctx.letterSpacing = "0px";

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  return map;
}

/* ----------------------------------------------------------------------- */
/* Feather (left page decoration)                                          */
/* ----------------------------------------------------------------------- */

function Feather() {
  const texture = useTexture("/images/Feather.png");
  texture.colorSpace = THREE.SRGBColorSpace;
  const aspect = useMemo(() => {
    const img = texture.image as HTMLImageElement | undefined;
    if (!img || !img.width) return 0.42;
    return img.width / img.height;
  }, [texture]);

  const featherH = PAGE_H * 0.52;
  const featherW = featherH * aspect;

  // Sits just past the fore-edge (canvas left → local +x). When the book is
  // closed only a slim tip peeks from behind the cover's right edge like a
  // bookmark; once open it runs softly down the letter's outer margin, clear
  // of the text column. Slightly knocked back in opacity so it reads as a
  // pressed accent rather than a sticker.
  return (
    <mesh
      position={[PAGE_W * 0.56, -PAGE_H * 0.08, -(COVER_T / 2 + 0.006)]}
      rotation={[0, 0, THREE.MathUtils.degToRad(-20)]}
    >
      <planeGeometry args={[featherW, featherH]} />
      <meshStandardMaterial
        map={texture}
        transparent
        opacity={0.7}
        alphaTest={0.03}
        roughness={0.85}
        metalness={0}
        side={THREE.FrontSide}
      />
    </mesh>
  );
}

/* ----------------------------------------------------------------------- */
/* Front cover — the hinged, bending part of the book                      */
/* ----------------------------------------------------------------------- */

function FrontCover({
  textures,
  bumpMap,
  smoothOpenRef,
}: {
  textures: {
    coverColorMap: THREE.CanvasTexture;
    coverMetalMap: THREE.CanvasTexture;
    coverRoughMap: THREE.CanvasTexture;
    leftPageMap: THREE.CanvasTexture;
    paperBumpMap: THREE.CanvasTexture;
  };
  bumpMap: THREE.CanvasTexture;
  smoothOpenRef: React.RefObject<number>;
}) {
  const pivotRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const basePositions = useRef<Float32Array | null>(null);

  const geometry = useMemo(
    () => new THREE.BoxGeometry(PAGE_W, PAGE_H, COVER_T, 24, 1, 1),
    []
  );

  useEffect(() => {
    basePositions.current = geometry.attributes.position.array.slice() as Float32Array;
    return () => geometry.dispose();
  }, [geometry]);

  const leatherEdge = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: LEATHER_EDGE,
        roughness: 0.75,
        metalness: 0.05,
        bumpMap,
        bumpScale: 0.6,
        // Worn-leather sheen: a faint waxy clearcoat plus a warm sheen
        // tint is what separates "leather" from "plastic" under IBL —
        // both are cheap here since this is one static, low-poly object.
        clearcoat: 0.18,
        clearcoatRoughness: 0.45,
        sheen: 0.25,
        sheenRoughness: 0.7,
        sheenColor: new THREE.Color(GOLD_DEEP),
      }),
    [bumpMap]
  );

  const outsideMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        map: textures.coverColorMap,
        metalnessMap: textures.coverMetalMap,
        roughnessMap: textures.coverRoughMap,
        metalness: 1,
        roughness: 1,
        bumpMap,
        bumpScale: 0.5,
        envMapIntensity: 1.2,
        clearcoat: 0.18,
        clearcoatRoughness: 0.45,
        sheen: 0.25,
        sheenRoughness: 0.7,
        sheenColor: new THREE.Color(GOLD_DEEP),
      }),
    [textures, bumpMap]
  );

  const insideMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: textures.leftPageMap,
        bumpMap: textures.paperBumpMap,
        bumpScale: 0.14,
        roughness: 0.9,
        metalness: 0,
        // a whisper of the warm environment so the stock reads as coated
        // paper catching room light rather than a flat printout
        envMapIntensity: 0.35,
      }),
    [textures]
  );

  const materials = useMemo(
    () => [leatherEdge, leatherEdge, leatherEdge, leatherEdge, outsideMat, insideMat],
    [leatherEdge, outsideMat, insideMat]
  );

  useFrame(() => {
    const openAmount = smoothOpenRef.current ?? 0;

    if (pivotRef.current) {
      pivotRef.current.rotation.y = -OPEN_ANGLE_MAX * openAmount;
    }

    // slight page bend — peaks mid-swing, settles to a faint residual curl
    const bendCurve =
      Math.sin(THREE.MathUtils.clamp(openAmount, 0, 1) * Math.PI) * 0.032 + 0.006;

    const geo = meshRef.current?.geometry as THREE.BufferGeometry | undefined;
    const base = basePositions.current;
    if (geo && base) {
      const pos = geo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const bx = base[i * 3];
        const bz = base[i * 3 + 2];
        const xFrac = THREE.MathUtils.clamp(bx / PAGE_W + 0.5, 0, 1);
        pos.array[i * 3 + 2] = bz + Math.sin(xFrac * Math.PI) * bendCurve;
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();
    }
  });

  return (
    <group
      ref={pivotRef}
      position={[0, 0, BLOCK_T / 2 + COVER_T / 2 + 0.012]}
    >
      <mesh
        ref={meshRef}
        geometry={geometry}
        material={materials}
        position={[PAGE_W / 2, 0, 0]}
        castShadow
        receiveShadow
      >
        <Feather />
      </mesh>
    </group>
  );
}

/* ----------------------------------------------------------------------- */
/* Static book parts — spine, page block, right page, back cover           */
/* ----------------------------------------------------------------------- */

function StaticBook({
  rightPageMap,
  paperBumpMap,
  bumpMap,
}: {
  rightPageMap: THREE.CanvasTexture;
  paperBumpMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
}) {
  const leatherMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: LEATHER_DARK,
        roughness: 0.7,
        metalness: 0.08,
        bumpMap,
        bumpScale: 0.6,
        clearcoat: 0.18,
        clearcoatRoughness: 0.45,
        sheen: 0.25,
        sheenRoughness: 0.7,
        sheenColor: new THREE.Color(GOLD_DEEP),
      }),
    [bumpMap]
  );

  const goldMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: GOLD,
        roughness: 0.28,
        metalness: 0.9,
        // No environment map previously meant a metalness:0.9 surface had
        // almost nothing to reflect and read as flat matte yellow instead
        // of gold — envMapIntensity here controls how strongly it picks up
        // the new procedural Environment below.
        envMapIntensity: 1.3,
      }),
    []
  );

  const creamMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: CREAM, roughness: 0.85 }),
    []
  );

  const blockMaterials = useMemo(
    () => [goldMat, leatherMat, goldMat, goldMat, creamMat, creamMat],
    [goldMat, leatherMat, creamMat]
  );

  const rightPageMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: rightPageMap,
        bumpMap: paperBumpMap,
        bumpScale: 0.14,
        roughness: 0.9,
        metalness: 0,
        envMapIntensity: 0.35,
      }),
    [rightPageMap, paperBumpMap]
  );

  return (
    <group>
      {/* rounded spine */}
      <mesh position={[0, 0, 0]} rotation={[0, 0, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[SPINE_R, SPINE_R, PAGE_H, 32, 1]} />
        <primitive object={leatherMat} attach="material" />
      </mesh>

      {/* back cover (mostly hidden, grounds the block) */}
      <mesh position={[PAGE_W / 2, 0, -BLOCK_T / 2 - 0.03]} receiveShadow>
        <boxGeometry args={[PAGE_W, PAGE_H * 0.99, COVER_T]} />
        <primitive object={leatherMat} attach="material" />
      </mesh>

      {/* page block with gilded edges */}
      <mesh
        position={[PAGE_W / 2, 0, 0]}
        material={blockMaterials}
        receiveShadow
        castShadow
      >
        <boxGeometry args={[PAGE_W, PAGE_H * 0.97, BLOCK_T]} />
      </mesh>

      {/* right page — the letter */}
      <mesh
        position={[PAGE_W / 2, 0, BLOCK_T / 2 + 0.006]}
        material={rightPageMat}
        receiveShadow
      >
        <planeGeometry args={[PAGE_W, PAGE_H * 0.97]} />
      </mesh>
    </group>
  );
}

/* ----------------------------------------------------------------------- */
/* Book rig — one damped "open" value drives the hinge, the book's gentle  */
/* re-centering settle, and (via CameraRig) the camera push-in. Keeping    */
/* the damping in a single place keeps all three in phase with each other */
/* instead of drifting out of sync with independently-damped copies.       */
/* ----------------------------------------------------------------------- */

function BookRig({
  targetOpenRef,
  smoothOpenRef,
  groupRef,
  reducedMotion,
}: {
  targetOpenRef: React.RefObject<number>;
  smoothOpenRef: React.RefObject<number>;
  groupRef: React.RefObject<THREE.Group | null>;
  reducedMotion: boolean;
}) {
  useFrame((state, delta) => {
    smoothOpenRef.current = THREE.MathUtils.damp(
      smoothOpenRef.current ?? 0,
      targetOpenRef.current ?? 0,
      2.6,
      delta
    );

    // closed book rests with its spine left-of-center (cover footprint
    // 0..W); once open the spine itself becomes the visual center — drift
    // the whole book toward that centered spine position as it settles.
    if (groupRef.current) {
      groupRef.current.position.x = THREE.MathUtils.lerp(
        -PAGE_W / 2,
        0,
        smoothOpenRef.current
      );

      // A faint idle sway so the book doesn't sit perfectly frozen once the
      // hinge animation settles — barely perceptible (~0.3°), just enough
      // to read as "alive" rather than a static product render.
      groupRef.current.rotation.y = reducedMotion
        ? 0
        : Math.sin(state.clock.elapsedTime * 0.4) * 0.006;
    }
  });

  return null;
}

/* ----------------------------------------------------------------------- */
/* Camera rig — aspect-fit framing with a tiny scroll push-in + parallax    */
/* ----------------------------------------------------------------------- */

// The open spread is ~2 pages wide, so on tall/narrow (mobile) viewports the
// desktop distance crops it. We fit the camera distance to the viewport so the
// full spread always sits inside the frame with a little breathing room, and
// never come closer than the desktop framing on wide screens.
const DESKTOP_Z = 4.1;
const SPREAD_HALF_W = 1.15; // world half-width the frame must contain (open spread + margin)
const HALF_FOV_TAN = Math.tan(THREE.MathUtils.degToRad(36) / 2);

function CameraRig({
  smoothOpenRef,
  reducedMotion,
}: {
  smoothOpenRef: React.RefObject<number>;
  reducedMotion: boolean;
}) {
  const { camera, pointer, size } = useThree();
  const base = useMemo(() => new THREE.Vector3(0, 0.06, DESKTOP_Z), []);
  const damped = useRef({ x: base.x, y: base.y, z: base.z });

  useFrame((_, delta) => {
    const open = smoothOpenRef.current ?? 0;
    const px = reducedMotion ? 0 : pointer.x;
    const py = reducedMotion ? 0 : pointer.y;

    // distance at which the spread's half-width just fits the horizontal FOV
    const aspect = size.width / Math.max(1, size.height);
    const fitZ = SPREAD_HALF_W / (HALF_FOV_TAN * aspect);
    const baseZ = Math.max(DESKTOP_Z, fitZ);
    // scale the scroll push-in with distance so it stays proportional on mobile
    const pushIn = open * 0.32 * (baseZ / DESKTOP_Z);

    const targetX = base.x + px * 0.05;
    const targetY = base.y + py * 0.035 + open * 0.03;
    const targetZ = baseZ - pushIn;

    damped.current.x = THREE.MathUtils.damp(damped.current.x, targetX, 2.2, delta);
    damped.current.y = THREE.MathUtils.damp(damped.current.y, targetY, 2.2, delta);
    damped.current.z = THREE.MathUtils.damp(damped.current.z, targetZ, 2.2, delta);

    camera.position.set(damped.current.x, damped.current.y, damped.current.z);
    camera.lookAt(px * 0.04, 0.02 + open * 0.02, 0);
  });

  return null;
}

/* ----------------------------------------------------------------------- */
/* Scene                                                                   */
/* ----------------------------------------------------------------------- */

/* -----------------------------------------------------------------------
   ShadowGovernor — a shadow map is a full extra render pass
   ─────────────────────────────────────────────────────────────────────
   three.js re-renders every casting light's depth map on every frame by
   default. For this scene that was a 2048x2048 pass, every frame, forever —
   for a book that is completely static except while it is being opened (and
   a ~0.3 degree idle sway whose effect on a soft shadow is not resolvable).

   So: turn autoUpdate off, and request exactly one refresh whenever the
   hinge has actually moved enough to matter. Opening the book still shows a
   live, correct shadow; sitting still costs nothing.
   ----------------------------------------------------------------------- */
function ShadowGovernor({ smoothOpenRef }: { smoothOpenRef: React.RefObject<number> }) {
  const gl = useThree((state) => state.gl);
  const lastRendered = useRef(-1);

  useEffect(() => {
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
    return () => {
      gl.shadowMap.autoUpdate = true;
    };
  }, [gl]);

  useFrame(() => {
    const open = smoothOpenRef.current ?? 0;
    if (Math.abs(open - lastRendered.current) < 0.004) return;
    lastRendered.current = open;
    gl.shadowMap.needsUpdate = true;
  });

  return null;
}

function Scene({
  openRef,
  reducedMotion,
  budget,
}: {
  openRef: React.RefObject<number>;
  reducedMotion: boolean;
  budget: DeviceBudget;
}) {
  const cinzel = useMemo(() => resolveFont("--font-cinzel", "serif"), []);
  const playfair = useMemo(() => resolveFont("--font-playfair", "serif"), []);

  const coverTextures = useMemo(() => buildCoverTextures(cinzel), [cinzel]);
  const leftPageMap = useMemo(
    () => buildLeftPageTexture(cinzel, playfair, FOUNDER_PARAGRAPHS),
    [cinzel, playfair]
  );
  const rightPageMap = useMemo(
    () => buildRightPageTexture(cinzel, playfair),
    [cinzel, playfair]
  );
  const leatherBump = useMemo(() => buildGrainTexture(256, 30, 90), []);
  const paperBump = useMemo(() => buildGrainTexture(256, 10, 200), []);

  const smoothOpenRef = useRef(0);
  const groupRef = useRef<THREE.Group>(null);

  return (
    <>
      <BookRig
        targetOpenRef={openRef}
        smoothOpenRef={smoothOpenRef}
        groupRef={groupRef}
        reducedMotion={reducedMotion}
      />
      <CameraRig smoothOpenRef={smoothOpenRef} reducedMotion={reducedMotion} />
      <AdaptiveResolution maxDpr={budget.maxDpr} />
      {budget.shadowMapSize > 0 && <ShadowGovernor smoothOpenRef={smoothOpenRef} />}

      {/* Procedural environment (baked once — Environment defaults to
          frames=1 — so this costs nothing per frame) instead of an HDRI
          file: gold at metalness:0.9 and the clearcoat leather above both
          derive most of their appearance from environment reflections, not
          direct light, so without this they'd read as flat/dull regardless
          of how the direct lights below are tuned. background stays false
          so the transparent canvas still shows the page behind it. */}
      <Environment resolution={budget.tier === "low" ? 128 : 256}>
        <Lightformer form="rect" intensity={1.2} color="#fff6e6" scale={[4, 4, 1]} position={[0, 3, 1]} rotation={[-Math.PI / 2, 0, 0]} />
        <Lightformer form="rect" intensity={2.4} color="#ffd9a0" scale={[2, 3, 1]} position={[2.4, 1.2, 2.4]} rotation={[0, -Math.PI / 4, 0]} />
        <Lightformer form="rect" intensity={1} color="#cfe0ee" scale={[2, 3, 1]} position={[-2.5, 0.5, 1.5]} rotation={[0, Math.PI / 3, 0]} />
      </Environment>

      <ambientLight intensity={0.55} color="#fff3e2" />
      <directionalLight
        position={[2.4, 3.2, 3.6]}
        intensity={1.15}
        color="#ffe3b0"
        // A low-tier GPU keeps the key light and drops only the real-time
        // depth pass; the ContactShadows below still seat the book on the
        // page, so the book never looks like it is floating.
        castShadow={budget.shadowMapSize > 0}
        shadow-mapSize={[budget.shadowMapSize || 512, budget.shadowMapSize || 512]}
        shadow-camera-left={-2.2}
        shadow-camera-right={2.2}
        shadow-camera-top={1.8}
        shadow-camera-bottom={-1.8}
        shadow-camera-near={0.5}
        shadow-camera-far={8}
      />
      <directionalLight position={[-2.5, 1.2, 2]} intensity={0.28} color="#dce7f2" />
      <pointLight position={[0, 0, 0.6]} intensity={0.4} color="#f3cf6e" distance={2.2} />
      {/* Rim/back light: separates the book's silhouette from the page
          background behind it, which the front-only key/fill/kiss lights
          above can't do on their own. */}
      <pointLight position={[0, 1.4, -2.2]} intensity={0.35} color="#eaf1fb" distance={5} />

      <group ref={groupRef} position={[-PAGE_W / 2, 0, 0]} scale={0.6}>
        <StaticBook
          rightPageMap={rightPageMap}
          paperBumpMap={paperBump}
          bumpMap={leatherBump}
        />
        <FrontCover
          textures={{
            coverColorMap: coverTextures.colorMap,
            coverMetalMap: coverTextures.metalMap,
            coverRoughMap: coverTextures.roughMap,
            leftPageMap,
            paperBumpMap: paperBump,
          }}
          bumpMap={leatherBump}
          smoothOpenRef={smoothOpenRef}
        />

        <ContactShadows
          position={[PAGE_W * 0.35, -PAGE_H / 2 - 0.03, 0]}
          opacity={0.4}
          blur={2.6}
          far={1.1}
          // Contact shadows re-render a depth pass plus two blur passes every
          // frame. At 512 that was the second-most expensive thing in the
          // scene; the shadow is soft and heavily blurred, so the drop to
          // 256/384 is not resolvable but is 2-4x cheaper per frame.
          resolution={budget.tier === "high" ? 384 : 256}
          scale={6}
          color="#1c130d"
        />
      </group>
    </>
  );
}

/* ----------------------------------------------------------------------- */
/* Public component                                                        */
/* ----------------------------------------------------------------------- */

export function FoundersNoteBook() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(0);
  const budget = useDeviceBudget();
  const [fontsReady, setFontsReady] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(
    () => typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = () => setReducedMotion(mql.matches);
    mql.addEventListener("change", handleChange);
    return () => mql.removeEventListener("change", handleChange);
  }, []);

  // Texture density is decided before the first bake, and the bake happens in
  // Scene's useMemo on the commit right after this flips true.
  useEffect(() => {
    let cancelled = false;
    applyTextureBudget(budget.textureScale);
    const ready = document.fonts?.ready ?? Promise.resolve();
    ready.then(() => {
      if (!cancelled) setFontsReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [budget.textureScale]);

  const active = useSceneActive(wrapperRef);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    // section is the enclosing <section> in FoundersNote.tsx — it also
    // contains the CTA copy that follows the book, so "leaving" means
    // scrolling past all of that, not just the pinned opening beat
    const section = el.closest("section") ?? el;

    // scroll is pinned here: the book opens 1:1 with scroll progress and
    // only releases once fully open, then normal scrolling resumes
    const openTrigger = ScrollTrigger.create({
      trigger: el,
      start: "top top",
      end: "+=100%",
      pin: true,
      scrub: true,
      onUpdate: (self) => {
        openRef.current = easeOutCubic(self.progress);
      },
    });

    // closes the book once the section is scrolled past in either
    // direction, so returning to it later starts from closed again
    const closeTrigger = ScrollTrigger.create({
      trigger: section,
      start: "top top",
      end: "bottom top",
      onLeave: () => {
        openRef.current = 0;
      },
      onLeaveBack: () => {
        openRef.current = 0;
      },
    });

    return () => {
      openTrigger.kill();
      closeTrigger.kill();
    };
  }, []);

  return (
    <div
      ref={wrapperRef}
      style={{
        height: "100vh",
        width: "100%",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {fontsReady && (
        <Canvas
          shadows={budget.shadowMapSize > 0}
          camera={{ position: [0, 0.06, 3.6], fov: 36, near: 0.1, far: 20 }}
          // Ceiling only — AdaptiveResolution walks the real ratio from here.
          dpr={[1, budget.maxDpr]}
          gl={{
            antialias: budget.antialias,
            alpha: true,
            powerPreference: budget.tier === "low" ? "default" : "high-performance",
            stencil: false,
          }}
          // The book used to render continuously from mount: a 2048^2 shadow
          // pass, a 512^2 contact-shadow pass and two blurs, every frame, for
          // a scene three viewports below the fold. It now renders only while
          // it is actually on screen in a foregrounded tab.
          frameloop={active ? "always" : "never"}
        >
          <Scene openRef={openRef} reducedMotion={reducedMotion} budget={budget} />
        </Canvas>
      )}
    </div>
  );
}

export default FoundersNoteBook;
