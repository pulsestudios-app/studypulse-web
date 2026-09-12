// Copied from pulsestudios-app/StudyPulse@e06fff9 (launch-ota): src/components/results/buildMindMapSunburst.ts
// Keep in sync manually — no monorepo coupling. Changes vs source: import paths only.

import type { MindMapPayload } from "../mindMapTypes";
import type { MindMapLayout, MindMapSunburstLayout, MindMapSunburstSlice } from "./MindMapTab.types";

const ROOT_R = 80;
const INNER_R = 180;
const OUTER_R = 300;
const CANVAS_SIZE = 1000;
const MAX_CANVAS_SIZE = 1200;
const SLICE_GAP_RAD = 0.006;
const MIN_LABEL_W = 56;

type ArcPoint = {
  x: number;
  y: number;
};

function polarToCartesian(cx: number, cy: number, r: number, angle: number): ArcPoint {
  return {
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  };
}

function arcPath(cx: number, cy: number, innerR: number, outerR: number, start: number, end: number): string {
  const span = Math.max(0, end - start);
  if (span <= 0.0001) {
    return "";
  }

  const outerStart = polarToCartesian(cx, cy, outerR, start);
  const outerEnd = polarToCartesian(cx, cy, outerR, end);
  const innerEnd = polarToCartesian(cx, cy, innerR, end);
  const innerStart = polarToCartesian(cx, cy, innerR, start);
  const largeArc = span > Math.PI ? 1 : 0;

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ");
}

function labelMetrics(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  start: number,
  end: number
): { labelX: number; labelY: number; maxLabelWidth: number } {
  const mid = (start + end) / 2;
  const r = (innerR + outerR) / 2;
  const span = Math.max(0, end - start);
  const chordWidth = 2 * r * Math.sin(span / 2);

  return {
    labelX: cx + r * Math.cos(mid),
    labelY: cy + r * Math.sin(mid),
    maxLabelWidth: Math.max(MIN_LABEL_W, chordWidth * 0.85),
  };
}

function buildSlice(params: {
  cx: number;
  cy: number;
  key: string;
  id: string;
  kind: "branch" | "sub";
  branchIndex: number;
  subIndex?: number;
  term: string;
  detail: string;
  color: string;
  innerR: number;
  outerR: number;
  start: number;
  end: number;
  fillOpacity: number;
  stroke: string;
  strokeWidth: number;
  highlighted: boolean;
}): MindMapSunburstSlice | null {
  const path = arcPath(params.cx, params.cy, params.innerR, params.outerR, params.start, params.end);
  if (!path) {
    return null;
  }

  const label = params.term.trim();
  const metrics = labelMetrics(params.cx, params.cy, params.innerR, params.outerR, params.start, params.end);

  return {
    key: params.key,
    id: params.id,
    kind: params.kind,
    branchIndex: params.branchIndex,
    subIndex: params.subIndex,
    term: params.term,
    detail: params.detail,
    color: params.color,
    path,
    pathD: path,
    innerRadius: params.innerR,
    outerRadius: params.outerR,
    startAngle: params.start,
    endAngle: params.end,
    fillOpacity: params.fillOpacity,
    stroke: params.stroke,
    strokeWidth: params.strokeWidth,
    highlighted: params.highlighted,
    labelX: metrics.labelX,
    labelY: metrics.labelY,
    labelRotateDeg: 0,
    maxLabelWidth: metrics.maxLabelWidth,
    labelBoxW: metrics.maxLabelWidth,
    labelBoxH: 68,
    label,
    labelLines: [label],
    labelFontSize: 13,
  };
}

export function sunburstRootRadius(_rootTerm: string): number {
  return ROOT_R;
}

export function layoutSunburstRadial(params: {
  mindMap: MindMapPayload;
  expandedBranchIndices: number[];
}): {
  sunburst: MindMapSunburstLayout;
  root: MindMapLayout["root"];
  mapWidth: number;
  mapSvgHeight: number;
} {
  const branches = params.mindMap.branches;
  const rootTerm = params.mindMap.root.trim() || "Mind Map";
  const size = Math.min(MAX_CANVAS_SIZE, CANVAS_SIZE);
  const cx = size / 2;
  const cy = size / 2;
  const branchCount = Math.max(1, branches.length);
  const sliceSpan = (Math.PI * 2) / branchCount;
  const expandedBranchIds = params.expandedBranchIndices.map((i) => `branch-${i}`);
  const expandedBranchIdSet = new Set(expandedBranchIds);
  const slices: MindMapSunburstSlice[] = [];

  for (let i = 0; i < branches.length; i++) {
    const branch = branches[i]!;
    const rawStart = -Math.PI / 2 + i * sliceSpan;
    const start = rawStart + SLICE_GAP_RAD;
    const end = rawStart + sliceSpan - SLICE_GAP_RAD;
    const id = `branch-${i}`;
    const highlighted = expandedBranchIdSet.has(id);
    const dimmed = expandedBranchIdSet.size > 0 && !highlighted;
    const slice = buildSlice({
      cx,
      cy,
      key: id,
      id,
      kind: "branch",
      branchIndex: i,
      term: branch.term,
      detail: "",
      color: branch.color,
      innerR: ROOT_R,
      outerR: INNER_R,
      start,
      end,
      fillOpacity: dimmed ? 0.45 : highlighted ? 1 : 0.9,
      stroke: highlighted ? "#FFFFFF" : "rgba(0,0,0,0.15)",
      strokeWidth: highlighted ? 2.5 : 0.75,
      highlighted,
    });
    if (slice) {
      slices.push(slice);
    }
  }

  for (const branchIndex of params.expandedBranchIndices) {
    const branch = branches[branchIndex];
    if (!branch || branch.subBranches.length === 0) {
      continue;
    }

    const rawBranchStart = -Math.PI / 2 + branchIndex * sliceSpan;
    const branchStart = rawBranchStart + SLICE_GAP_RAD;
    const branchEnd = rawBranchStart + sliceSpan - SLICE_GAP_RAD;
    const subSpan = (branchEnd - branchStart) / branch.subBranches.length;

    for (let j = 0; j < branch.subBranches.length; j++) {
      const sub = branch.subBranches[j]!;
      const start = branchStart + j * subSpan + SLICE_GAP_RAD;
      const end = branchStart + (j + 1) * subSpan - SLICE_GAP_RAD;
      const id = `sub-${branchIndex}-${j}`;
      const slice = buildSlice({
        cx,
        cy,
        key: id,
        id,
        kind: "sub",
        branchIndex,
        subIndex: j,
        term: sub.term,
        detail: sub.detail,
        color: branch.color,
        innerR: INNER_R,
        outerR: OUTER_R,
        start,
        end,
        fillOpacity: 1,
        stroke: "rgba(255,255,255,0.5)",
        strokeWidth: 1.5,
        highlighted: true,
      });
      if (slice) {
        slices.push(slice);
      }
    }
  }

  const root = {
    left: cx - ROOT_R,
    top: cy - ROOT_R,
    minW: ROOT_R * 2,
    minH: ROOT_R * 2,
    term: rootTerm,
    shape: "circle" as const,
  };

  return {
    sunburst: {
      cx,
      cy,
      size,
      rootRadius: ROOT_R,
      rootTerm,
      rootColor: "#58CC02",
      contentOuterRadius: OUTER_R,
      edgePadding: (size - OUTER_R * 2) / 2,
      rootLabelFontSize: 11,
      rootLabelMaxLines: 4,
      expandedBranchIndices: [...params.expandedBranchIndices],
      expandedBranchIds,
      slices,
    },
    root,
    mapWidth: size,
    mapSvgHeight: size,
  };
}
/** Use the drawn wedge geometry, not a small rectangular label hit target. */
export function findSunburstSlice(
  layout: MindMapSunburstLayout, x: number, y: number, slices = layout.slices
): MindMapSunburstSlice | undefined {
  const dx = x - layout.cx;
  const dy = y - layout.cy;
  const radius = Math.hypot(dx, dy);
  let angle = Math.atan2(dy, dx);
  if (angle < -Math.PI / 2) angle += Math.PI * 2;
  return slices.find(slice => radius >= slice.innerRadius && radius <= slice.outerRadius &&
    angle >= slice.startAngle && angle <= slice.endAngle);
}
