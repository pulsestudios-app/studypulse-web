// Copied from pulsestudios-app/StudyPulse@e06fff9 (launch-ota): src/components/results/buildMindMapLayout.ts
// Keep in sync manually — no monorepo coupling. Changes vs source: react-native Dimensions import removed; screenWidth is required (source used Dimensions.get("window").width as the default).


import type { MindMapPayload } from "../mindMapTypes";
import { layoutSunburstRadial } from "./buildMindMapSunburst";
import type { MapLayoutStyle } from "./resultsMapConstants";
import {
  MIND_MAP_CANVAS_H,
  MIND_MAP_CANVAS_MIN_W,
  MIND_MAP_TREE_NODE_GAP,
  MIND_MAP_WIDTH_SCREEN_MULT,
  type MindMapLayout,
  type MindMapLayoutBranch,
  type MindMapLayoutSubBranch,
} from "./MindMapTab.types";

const MIND_MAP_EDGE_PADDING = 20;
const MIN_NODE_GAP = 28;

const RADIAL_BRANCH_R_MIN = 200;
const RADIAL_BRANCH_R_MAX = 480;
const RADIAL_SUB_OFFSET_MIN = 130;
const RADIAL_SUB_OFFSET_MAX = 220;

const BUBBLE_ROOT_D = 140;
const BUBBLE_BRANCH_D = 112;
const BUBBLE_SUB_D = 84;

const BRANCH_NODE_MAX_W = 220;
const BRANCH_NODE_MIN_W = 80;
const SUB_NODE_MAX_W = 200;
const SUB_NODE_MIN_W = 100;
const NODE_FONT_LINE_H = 16;
const NODE_PAD_H = 24;
const SUB_PAD_H = 20;

function mindMapEstimateWrappedLines(text: string, maxCharsPerLine: number): number {
  if (!text.length) {
    return 1;
  }
  return Math.max(1, Math.ceil(text.length / Math.max(1, maxCharsPerLine)));
}

export function estimateMindMapRootLayoutSize(term: string): { minW: number; minH: number } {
  const pad = 24;
  const lineH = 17;
  const maxContentW = 320;
  const approxCharW = 7.2;
  const cpl = Math.max(10, Math.floor(maxContentW / approxCharW));
  const lines = mindMapEstimateWrappedLines(term, cpl);
  const singleLineW = term.length * approxCharW + pad;
  const w =
    lines > 1
      ? maxContentW + pad
      : Math.min(maxContentW + pad, Math.max(96, Math.round(singleLineW)));
  const h = lines * lineH + pad;
  return { minW: Math.round(w), minH: Math.max(44, Math.round(h)) };
}

export function estimateMindMapBranchLayoutSize(
  term: string,
  subBranchCount = 0
): { bw: number; bh: number } {
  const pad = NODE_PAD_H;
  const lineH = NODE_FONT_LINE_H;
  const approxCharW = 7;
  const innerW = BRANCH_NODE_MAX_W - pad;
  const cpl = Math.max(8, Math.floor(innerW / approxCharW));
  const lines = Math.min(3, mindMapEstimateWrappedLines(term, cpl));
  const longestLine = Math.min(term.length, cpl);
  const contentW = Math.min(innerW, Math.max(longestLine * approxCharW, term.length * approxCharW * (lines > 1 ? 0.65 : 1)));
  const bw = Math.min(BRANCH_NODE_MAX_W, Math.max(BRANCH_NODE_MIN_W, Math.round(contentW + pad)));
  let h = lines * lineH + pad + 8;
  if (subBranchCount > 0) {
    h += 16;
  }
  return { bw, bh: Math.max(48, Math.round(h)) };
}

function estimateMindMapSubLayoutSize(term: string): { sw: number; sh: number } {
  const pad = SUB_PAD_H;
  const lineH = NODE_FONT_LINE_H;
  const approxCharW = 6.5;
  const innerW = SUB_NODE_MAX_W - pad;
  const cpl = Math.max(8, Math.floor(innerW / approxCharW));
  const lines = Math.min(3, mindMapEstimateWrappedLines(term, cpl));
  const longestLine = Math.min(term.length, cpl);
  const contentW = Math.min(innerW, Math.max(longestLine * approxCharW, term.length * approxCharW * (lines > 1 ? 0.65 : 1)));
  const sw = Math.min(SUB_NODE_MAX_W, Math.max(SUB_NODE_MIN_W, Math.round(contentW + pad)));
  const h = lines * lineH + pad;
  return { sw, sh: Math.max(40, Math.round(h)) };
}

function isBranchExpanded(expandedBranchIndices: number[], index: number): boolean {
  return expandedBranchIndices.includes(index);
}

function bubbleDiameter(term: string, base: number, cap: number): number {
  const lines = mindMapEstimateWrappedLines(term, Math.max(6, Math.floor(base / 7)));
  const extra = (lines - 1) * 10;
  return Math.min(cap, Math.max(base, base + extra));
}

type PlacedNode = { cx: number; cy: number; r: number; id: string };

const polarXY = (cx: number, cy: number, radius: number, angle: number) => ({
  x: cx + radius * Math.cos(angle),
  y: cy + radius * Math.sin(angle),
});

const nodeCenter = (left: number, top: number, width: number, height: number) => ({
  x: left + width / 2,
  y: top + height / 2,
});

const edgePointToward = (
  center: { x: number; y: number },
  radius: number,
  target: { x: number; y: number }
) => {
  const dx = target.x - center.x;
  const dy = target.y - center.y;
  const len = Math.hypot(dx, dy) || 1;
  return {
    x: center.x + (dx / len) * radius,
    y: center.y + (dy / len) * radius,
  };
};

/** Ring radius so branch circles are evenly spaced without overlapping. */
function branchRingRadius(branchCount: number, nodeDiameter: number): number {
  if (branchCount <= 1) {
    return RADIAL_BRANCH_R_MIN;
  }
  const chord = nodeDiameter + MIN_NODE_GAP;
  const fromGeometry = chord / (2 * Math.sin(Math.PI / branchCount));
  return Math.min(RADIAL_BRANCH_R_MAX, Math.max(RADIAL_BRANCH_R_MIN, fromGeometry));
}

function subRingOffset(branchCount: number, subDiameter: number, expandedCount: number): number {
  const sectorHalf = Math.PI / Math.max(1, branchCount);
  const arcRoom = sectorHalf * 0.82 * RADIAL_SUB_OFFSET_MAX;
  const minArc = (subDiameter + MIN_NODE_GAP) * Math.max(0, expandedCount - 1);
  const extra = minArc > 0 ? minArc * 0.35 : 0;
  return Math.min(RADIAL_SUB_OFFSET_MAX, Math.max(RADIAL_SUB_OFFSET_MIN, RADIAL_SUB_OFFSET_MIN + extra));
}

function sectorAngles(branchAngle: number, branchCount: number, subCount: number): number[] {
  if (subCount <= 0) {
    return [];
  }
  const sectorHalf = (Math.PI / Math.max(1, branchCount)) * 0.4;
  if (subCount === 1) {
    return [branchAngle];
  }
  const usable = sectorHalf * 1.85;
  return Array.from({ length: subCount }, (_, j) => {
    const t = j / (subCount - 1) - 0.5;
    return branchAngle + t * usable;
  });
}

function resolveOverlaps(nodes: PlacedNode[], minSep: number, maxPasses = 12): void {
  for (let pass = 0; pass < maxPasses; pass++) {
    let moved = false;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]!;
        const b = nodes[j]!;
        const dx = b.cx - a.cx;
        const dy = b.cy - a.cy;
        const dist = Math.hypot(dx, dy) || 0.001;
        const need = a.r + b.r + minSep;
        if (dist >= need) {
          continue;
        }
        const push = (need - dist) / 2;
        const ux = dx / dist;
        const uy = dy / dist;
        a.cx -= ux * push;
        a.cy -= uy * push;
        b.cx += ux * push;
        b.cy += uy * push;
        moved = true;
      }
    }
    if (!moved) {
      break;
    }
  }
}

type BranchBoxes = {
  bx: number;
  by: number;
  bw: number;
  bh: number;
  subBranches: MindMapLayoutSubBranch[];
};

function padMindMapCanvas(
  root: { left: number; top: number; minW: number; minH: number; term: string },
  branches: BranchBoxes[],
  mapWidth: number,
  mapSvgHeight: number,
  pad = MIND_MAP_EDGE_PADDING
) {
  let minX = root.left;
  let minY = root.top;
  let maxX = root.left + root.minW;
  let maxY = root.top + root.minH;
  for (const b of branches) {
    minX = Math.min(minX, b.bx);
    minY = Math.min(minY, b.by);
    maxX = Math.max(maxX, b.bx + b.bw);
    maxY = Math.max(maxY, b.by + b.bh);
    for (const s of b.subBranches) {
      minX = Math.min(minX, s.sx);
      minY = Math.min(minY, s.sy);
      maxX = Math.max(maxX, s.sx + s.sw);
      maxY = Math.max(maxY, s.sy + s.sh);
    }
  }
  let dx = 0;
  let dy = 0;
  if (minX < pad) {
    dx = pad - minX;
  }
  if (minY < pad) {
    dy = pad - minY;
  }
  const root2 = { ...root, left: root.left + dx, top: root.top + dy };
  const branches2 = branches.map((b) => ({
    ...b,
    bx: b.bx + dx,
    by: b.by + dy,
    subBranches: b.subBranches.map((s) => ({
      ...s,
      sx: s.sx + dx,
      sy: s.sy + dy,
    })),
  }));
  return {
    root: root2,
    branches: branches2,
    mapWidth: Math.max(mapWidth, maxX + dx + pad),
    mapSvgHeight: Math.max(mapSvgHeight, maxY + dy + pad),
  };
}

const CONTENT_BOUNDS_PAD = 40;

function accumulateMindMapNodes(
  layout: MindMapLayout,
  focusBranchIndex: number | null | undefined
): { minX: number; minY: number; maxX: number; maxY: number } {
  if (layout.sunburst) {
    const sb = layout.sunburst;
    const r = sb.contentOuterRadius + 16;
    return {
      minX: sb.cx - r,
      minY: sb.cy - r,
      maxX: sb.cx + r,
      maxY: sb.cy + r,
    };
  }
  const { root, branches } = layout;
  let minX = root.left;
  let minY = root.top;
  let maxX = root.left + root.minW;
  let maxY = root.top + root.minH;

  const includeRoot = focusBranchIndex == null;
  if (!includeRoot && focusBranchIndex != null) {
    minX = Infinity;
    minY = Infinity;
    maxX = -Infinity;
    maxY = -Infinity;
  }

  const includeBranch = (b: (typeof branches)[number], withSubs: boolean) => {
    minX = Math.min(minX, b.bx);
    minY = Math.min(minY, b.by);
    maxX = Math.max(maxX, b.bx + b.bw);
    maxY = Math.max(maxY, b.by + b.bh);
    if (withSubs) {
      for (const s of b.subBranches) {
        minX = Math.min(minX, s.sx);
        minY = Math.min(minY, s.sy);
        maxX = Math.max(maxX, s.sx + s.sw);
        maxY = Math.max(maxY, s.sy + s.sh);
      }
    }
  };

  if (focusBranchIndex != null && branches[focusBranchIndex]) {
    includeBranch(branches[focusBranchIndex]!, true);
  } else {
    for (const b of branches) {
      includeBranch(b, true);
    }
  }

  if (!Number.isFinite(minX)) {
    minX = root.left;
    minY = root.top;
    maxX = root.left + root.minW;
    maxY = root.top + root.minH;
  }

  return { minX, minY, maxX, maxY };
}

export function computeMindMapContentBounds(layout: MindMapLayout): { cw: number; ch: number } {
  const { minX, minY, maxX, maxY } = accumulateMindMapNodes(layout, null);
  return {
    cw: Math.max(1, maxX - minX + CONTENT_BOUNDS_PAD * 2),
    ch: Math.max(1, maxY - minY + CONTENT_BOUNDS_PAD * 2),
  };
}

/** Pixel rect of visible nodes; optional branch index focuses on that branch + its sub-branches. */
export function computeMindMapContentRect(
  layout: MindMapLayout,
  focusBranchIndex?: number | null
): { minX: number; minY: number; maxX: number; maxY: number } {
  return accumulateMindMapNodes(layout, focusBranchIndex);
}

function layoutSubBranchesInSector(params: {
  branchIndex: number;
  branchCount: number;
  branchCx: number;
  branchCy: number;
  branchAngle: number;
  branchRadius: number;
  subs: Array<{ term: string; detail: string }>;
  branchColor: string;
  expanded: boolean;
  isBubble: boolean;
  subOffset: number;
}): MindMapLayoutSubBranch[] {
  if (!params.expanded || params.subs.length === 0) {
    return [];
  }

  const angles = sectorAngles(params.branchAngle, params.branchCount, params.subs.length);
  const placed: PlacedNode[] = [];
  const out: MindMapLayoutSubBranch[] = [];

  for (let j = 0; j < params.subs.length; j++) {
    const sub = params.subs[j]!;
    const angle = angles[j]!;
    let sw: number;
    let sh: number;
    if (params.isBubble) {
      const d = bubbleDiameter(sub.term, BUBBLE_SUB_D, BUBBLE_SUB_D + 16);
      sw = d;
      sh = d;
    } else {
      const est = estimateMindMapSubLayoutSize(sub.term);
      sw = est.sw;
      sh = est.sh;
    }
    const subR = Math.max(sw, sh) / 2;
    const dist = params.branchRadius + params.subOffset;
    let cx = params.branchCx + Math.cos(angle) * dist;
    let cy = params.branchCy + Math.sin(angle) * dist;
    placed.push({ cx, cy, r: subR, id: `s-${params.branchIndex}-${j}` });
    out.push({
      term: sub.term,
      detail: sub.detail,
      sx: cx - sw / 2,
      sy: cy - sh / 2,
      sw,
      sh,
      subIndex: j,
      branchColor: params.branchColor,
      branchIndex: params.branchIndex,
      leafBorderRadius: params.isBubble ? 999 : 10,
      shape: params.isBubble ? "circle" : "rect",
    });
  }

  resolveOverlaps(placed, MIN_NODE_GAP);
  for (let j = 0; j < out.length; j++) {
    const p = placed[j]!;
    const o = out[j]!;
    o.sx = p.cx - o.sw / 2;
    o.sy = p.cy - o.sh / 2;
  }

  return out;
}

function layoutRadialFamily(params: {
  mindMap: MindMapPayload;
  mapLayoutStyle: MapLayoutStyle;
  expandedBranchIndices: number[];
  mapWidth: number;
  canvasHeight: number;
}): { root: MindMapLayout["root"]; branches: MindMapLayoutBranch[]; centerX: number; centerY: number } {
  const isBubble = params.mapLayoutStyle === "bubble";
  const branchesData = params.mindMap.branches;
  const branchCount = Math.max(branchesData.length, 1);
  const rootTerm = params.mindMap.root.trim() || "Mind Map";
  const centerX = params.mapWidth / 2;
  const centerY = params.canvasHeight / 2;

  let rootW: number;
  let rootH: number;
  let rootShape: "circle" | "rect" = "rect";
  if (isBubble) {
    const d = bubbleDiameter(rootTerm, BUBBLE_ROOT_D, BUBBLE_ROOT_D + 36);
    rootW = d;
    rootH = d;
    rootShape = "circle";
  } else {
    const rootEst = estimateMindMapRootLayoutSize(rootTerm);
    rootW = rootEst.minW;
    rootH = rootEst.minH;
  }

  const rootRadius = Math.max(rootW, rootH) / 2;
  const sampleBranch = branchesData[0]?.term ?? "Topic";
  const sampleEst = estimateMindMapBranchLayoutSize(sampleBranch);
  const branchNodeD = isBubble
    ? BUBBLE_BRANCH_D
    : Math.max(sampleEst.bw, sampleEst.bh);

  const ringR = branchRingRadius(branchCount, branchNodeD);
  const maxSubCount = branchesData.reduce((max, b) => Math.max(max, b.subBranches.length), 0);
  const subOffset = subRingOffset(branchCount, isBubble ? BUBBLE_SUB_D : 48, maxSubCount);

  const angleStep = (2 * Math.PI) / branchCount;
  const root = {
    left: centerX - rootW / 2,
    top: centerY - rootH / 2,
    minW: rootW,
    minH: rootH,
    term: rootTerm,
    shape: rootShape,
  };

  const branches: MindMapLayoutBranch[] = branchesData.map((b, i) => {
    const branchAngle = -Math.PI / 2 + i * angleStep;
    const center = polarXY(centerX, centerY, ringR, branchAngle);
    let bw: number;
    let bh: number;
    if (isBubble) {
      const d = bubbleDiameter(b.term, BUBBLE_BRANCH_D, BUBBLE_BRANCH_D + 28);
      bw = d;
      bh = d;
    } else {
      const est = estimateMindMapBranchLayoutSize(b.term, b.subBranches.length);
      bw = est.bw;
      bh = est.bh;
    }
    const branchRadius = Math.max(bw, bh) / 2;
    const expanded = isBranchExpanded(params.expandedBranchIndices, i);
    const subBranches = layoutSubBranchesInSector({
      branchIndex: i,
      branchCount,
      branchCx: center.x,
      branchCy: center.y,
      branchAngle,
      branchRadius,
      subs: b.subBranches,
      branchColor: b.color,
      expanded,
      isBubble,
      subOffset,
    });

    return {
      term: b.term,
      index: i,
      branchColor: b.color,
      bx: center.x - bw / 2,
      by: center.y - bh / 2,
      bw,
      bh,
      borderRadius: isBubble ? 999 : 10,
      shape: isBubble ? "circle" : "rect",
      subBranchCount: b.subBranches.length,
      subBranches,
    };
  });

  const globalSubs: PlacedNode[] = [];
  for (const b of branches) {
    for (const s of b.subBranches) {
      globalSubs.push({
        cx: s.sx + s.sw / 2,
        cy: s.sy + s.sh / 2,
        r: Math.max(s.sw, s.sh) / 2,
        id: `g-${s.branchIndex}-${s.subIndex}`,
      });
    }
  }
  if (globalSubs.length > 1) {
    resolveOverlaps(globalSubs, MIN_NODE_GAP, 16);
    for (const b of branches) {
      for (const s of b.subBranches) {
        const p = globalSubs.find((n) => n.id === `g-${s.branchIndex}-${s.subIndex}`);
        if (p) {
          s.sx = p.cx - s.sw / 2;
          s.sy = p.cy - s.sh / 2;
        }
      }
    }
  }

  return { root, branches, centerX, centerY };
}

function layoutMindMapTree(params: {
  mindMap: MindMapPayload;
  rootTerm: string;
  expandedBranchIndices: number[];
}): {
  root: MindMapLayout["root"];
  branches: MindMapLayoutBranch[];
  mapWidth: number;
  mapSvgHeight: number;
} {
  const { mindMap, rootTerm, expandedBranchIndices } = params;
  const expandedSet = new Set(expandedBranchIndices);
  const branchesData = mindMap.branches;
  const rootEst = estimateMindMapRootLayoutSize(rootTerm);
  const rootW = rootEst.minW;
  const rootH = rootEst.minH;
  const branchSizes = branchesData.map((b) =>
    estimateMindMapBranchLayoutSize(b.term, b.subBranches.length)
  );
  const maxBranchW = branchSizes.reduce((m, s) => Math.max(m, s.bw), BRANCH_NODE_MIN_W);
  const maxSubW = SUB_NODE_MAX_W;
  const branchGapX = 88;
  const subGapX = 56;
  const subStackGap = 56;

  const blockHeight = (i: number) => {
    const b = branchesData[i]!;
    const { bh } = branchSizes[i]!;
    let h = bh;
    if (expandedSet.has(i) && b.subBranches.length > 0) {
      for (const sub of b.subBranches) {
        h += estimateMindMapSubLayoutSize(sub.term).sh + subStackGap;
      }
      h = Math.max(h, bh);
    }
    return h;
  };

  const mid = Math.ceil(branchesData.length / 2);
  const rightIndices = branchesData.map((_, i) => i).filter((i) => i < mid);
  const leftIndices = branchesData.map((_, i) => i).filter((i) => i >= mid);

  const stackHeight = (indices: number[]) =>
    indices.reduce((sum, i, idx) => sum + blockHeight(i) + (idx > 0 ? MIND_MAP_TREE_NODE_GAP : 0), 0);

  const rightH = stackHeight(rightIndices);
  const leftH = stackHeight(leftIndices);
  const contentH = Math.max(rootH, rightH, leftH);
  const sideSpan = maxBranchW + subGapX + maxSubW;
  const canvasW = rootW + branchGapX * 2 + sideSpan * 2 + MIND_MAP_EDGE_PADDING * 2;
  const canvasH = Math.max(480, contentH + MIND_MAP_EDGE_PADDING * 2);
  const centerX = canvasW / 2;
  const centerY = canvasH / 2;

  const root = {
    left: centerX - rootW / 2,
    top: centerY - rootH / 2,
    minW: rootW,
    minH: rootH,
    term: rootTerm,
    shape: "rect" as const,
  };

  const rightX = centerX + rootW / 2 + branchGapX;
  const leftX = centerX - rootW / 2 - branchGapX - maxBranchW;

  const branches: MindMapLayoutBranch[] = [];

  const placeSide = (indices: number[], branchX: number, subsOnRight: boolean) => {
    const totalH = stackHeight(indices);
    let y = centerY - totalH / 2;
    for (const i of indices) {
      const b = branchesData[i]!;
      const { bw, bh } = branchSizes[i]!;
      const by = y;
      y += blockHeight(i) + MIND_MAP_TREE_NODE_GAP;
      const subBranches: MindMapLayoutSubBranch[] = [];
      if (expandedSet.has(i) && b.subBranches.length > 0) {
        let subY = by;
        for (let j = 0; j < b.subBranches.length; j++) {
          const sub = b.subBranches[j]!;
          const est = estimateMindMapSubLayoutSize(sub.term);
          const sx = subsOnRight ? branchX + bw + subGapX : branchX - subGapX - est.sw;
          subBranches.push({
            term: sub.term,
            detail: sub.detail,
            sx,
            sy: subY,
            sw: est.sw,
            sh: est.sh,
            subIndex: j,
            branchColor: b.color,
            branchIndex: i,
            leafBorderRadius: 10,
            shape: "rect",
          });
          subY += est.sh + subStackGap;
        }
      }
      branches.push({
        term: b.term,
        index: i,
        branchColor: b.color,
        bx: branchX,
        by,
        bw,
        bh,
        borderRadius: 10,
        shape: "rect",
        subBranchCount: b.subBranches.length,
        subBranches,
      });
    }
  };

  placeSide(rightIndices, rightX, true);
  placeSide(leftIndices, leftX, false);

  return { root, branches, mapWidth: canvasW, mapSvgHeight: canvasH };
}

export function buildMindMapLayout(params: {
  mindMap: MindMapPayload;
  mapLayoutStyle: MapLayoutStyle;
  expandedBranchIndices: number[];
  screenWidth: number;
}): MindMapLayout {
  const sw = params.screenWidth;
  let mapWidth = Math.max(MIND_MAP_CANVAS_MIN_W, sw * MIND_MAP_WIDTH_SCREEN_MULT);
  const H = MIND_MAP_CANVAS_H;
  const branchesData = params.mindMap.branches;
  const rootTerm = params.mindMap.root.trim() || "Mind Map";

  type PathSeg = { key: string; d: string; stroke: string; strokeWidth: number };
  const paths: PathSeg[] = [];

  let root: MindMapLayout["root"];
  let branches: MindMapLayoutBranch[] = [];

  let sunburst: MindMapLayout["sunburst"];

  if (params.mapLayoutStyle === "tree") {
    const tree = layoutMindMapTree({
      mindMap: params.mindMap,
      rootTerm,
      expandedBranchIndices: params.expandedBranchIndices,
    });
    root = tree.root;
    branches = tree.branches;
    mapWidth = tree.mapWidth;
  } else if (params.mapLayoutStyle === "radial") {
    const sun = layoutSunburstRadial({
      mindMap: params.mindMap,
      expandedBranchIndices: params.expandedBranchIndices,
    });
    sunburst = sun.sunburst;
    root = sun.root;
    branches = [];
    mapWidth = sun.mapWidth;
  } else {
    const radial = layoutRadialFamily({
      mindMap: params.mindMap,
      mapLayoutStyle: params.mapLayoutStyle,
      expandedBranchIndices: params.expandedBranchIndices,
      mapWidth,
      canvasHeight: H,
    });
    root = radial.root;
    branches = radial.branches;
  }

  let mapSvgHeight = H;
  if (params.mapLayoutStyle === "radial") {
    mapSvgHeight = mapWidth;
  } else if (params.mapLayoutStyle === "tree") {
    mapSvgHeight = Math.max(
      480,
      branches.reduce((m, b) => Math.max(m, b.by + b.bh), root.top + root.minH) + MIND_MAP_EDGE_PADDING
    );
  } else {
    const padded = padMindMapCanvas(root, branches, mapWidth, H);
    root = { ...padded.root, shape: root.shape };
    branches = padded.branches as MindMapLayoutBranch[];
    mapWidth = padded.mapWidth;
    mapSvgHeight = padded.mapSvgHeight;
  }

  if (params.mapLayoutStyle !== "tree" && params.mapLayoutStyle !== "radial") {
    const padded = padMindMapCanvas(root, branches, mapWidth, mapSvgHeight);
    root = { ...padded.root, shape: root.shape };
    branches = padded.branches as MindMapLayoutBranch[];
    mapWidth = padded.mapWidth;
    mapSvgHeight = padded.mapSvgHeight;
  }

  if (params.mapLayoutStyle === "tree") {
    const rootC = nodeCenter(root.left, root.top, root.minW, root.minH);
    for (let i = 0; i < branches.length; i++) {
      const b = branches[i]!;
      const branchC = nodeCenter(b.bx, b.by, b.bw, b.bh);
      const branchOnRight = branchC.x >= rootC.x;
      const start = branchOnRight
        ? { x: rootC.x + root.minW / 2, y: rootC.y }
        : { x: rootC.x - root.minW / 2, y: rootC.y };
      const end = branchOnRight
        ? { x: branchC.x - b.bw / 2, y: branchC.y }
        : { x: branchC.x + b.bw / 2, y: branchC.y };
      const midX1 = start.x + (end.x - start.x) * 0.45;
      const midX2 = start.x + (end.x - start.x) * 0.8;
      paths.push({
        key: `t-${i}`,
        d: `M ${start.x} ${start.y} C ${midX1} ${start.y}, ${midX2} ${end.y}, ${end.x} ${end.y}`,
        stroke: b.branchColor,
        strokeWidth: 3,
      });
      if (isBranchExpanded(params.expandedBranchIndices, i)) {
        for (const s of b.subBranches) {
          const subC = nodeCenter(s.sx, s.sy, s.sw, s.sh);
          paths.push({
            key: `ts-${i}-${s.subIndex}`,
            d: branchOnRight
              ? `M ${branchC.x + b.bw / 2} ${branchC.y} L ${subC.x - s.sw / 2} ${subC.y}`
              : `M ${branchC.x - b.bw / 2} ${branchC.y} L ${subC.x + s.sw / 2} ${subC.y}`,
            stroke: `${b.branchColor}cc`,
            strokeWidth: 2,
          });
        }
      }
    }
  } else if (params.mapLayoutStyle !== "radial") {
    const rootC = nodeCenter(root.left, root.top, root.minW, root.minH);
    const rootRadius = Math.max(root.minW, root.minH) / 2;

    for (let i = 0; i < branches.length; i++) {
      const b = branches[i]!;
      const branchC = nodeCenter(b.bx, b.by, b.bw, b.bh);
      const branchRadius = Math.min(b.bw, b.bh) / 2;
      const start = edgePointToward(rootC, rootRadius, branchC);
      const end = edgePointToward(branchC, branchRadius, rootC);
      const mx = start.x + (end.x - start.x) * 0.5;
      const my = start.y + (end.y - start.y) * 0.5;
      paths.push({
        key: `r-${i}`,
        d: `M ${start.x} ${start.y} Q ${mx} ${my} ${end.x} ${end.y}`,
        stroke: b.branchColor,
        strokeWidth: 3,
      });
      if (isBranchExpanded(params.expandedBranchIndices, i)) {
        for (const s of b.subBranches) {
          const subC = nodeCenter(s.sx, s.sy, s.sw, s.sh);
          const subRadius = Math.min(s.sw, s.sh) / 2;
          const p1 = edgePointToward(branchC, branchRadius, subC);
          const p2 = edgePointToward(subC, subRadius, branchC);
          const mx2 = p1.x + (p2.x - p1.x) * 0.5;
          const my2 = p1.y + (p2.y - p1.y) * 0.5;
          paths.push({
            key: `rs-${i}-${s.subIndex}`,
            d: `M ${p1.x} ${p1.y} Q ${mx2} ${my2} ${p2.x} ${p2.y}`,
            stroke: `${b.branchColor}cc`,
            strokeWidth: 2,
          });
        }
      }
    }

    if (params.mapLayoutStyle === "network") {
      for (let i = 0; i < branches.length; i++) {
        const b1 = branches[i]!;
        const b2 = branches[(i + 1) % branches.length]!;
        const c1 = nodeCenter(b1.bx, b1.by, b1.bw, b1.bh);
        const c2 = nodeCenter(b2.bx, b2.by, b2.bw, b2.bh);
        const r1 = Math.min(b1.bw, b1.bh) / 2;
        const r2 = Math.min(b2.bw, b2.bh) / 2;
        const p1 = edgePointToward(c1, r1, c2);
        const p2 = edgePointToward(c2, r2, c1);
        paths.push({
          key: `n-${i}`,
          d: `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`,
          stroke: `${b1.branchColor}88`,
          strokeWidth: 2,
        });
      }
    }

  }

  return {
    mapWidth,
    mapSvgHeight,
    sunburst,
    root,
    branches,
    paths,
  };
}
