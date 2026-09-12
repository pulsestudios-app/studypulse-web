// Copied from pulsestudios-app/StudyPulse@e06fff9 (launch-ota): src/components/results/MindMapTab.types.ts
// Keep in sync manually — no monorepo coupling. Changes vs source: none.

/** Mind map canvas zoom/canvas — shared with results screen pinch logic. */
export const MIND_MAP_SCALE_MIN = 0.2;
export const MIND_MAP_SCALE_MAX = 2;
export const MIND_MAP_DEFAULT_SCALE = 0.5;
export const MIND_MAP_CANVAS_MIN_W = 1400;
export const MIND_MAP_CANVAS_H = 1400;
export const MIND_MAP_WIDTH_SCREEN_MULT = 5;

export type MindMapNodeShape = "circle" | "rect";

export type MindMapSunburstSlice = {
  key: string;
  id: string;
  kind: "branch" | "sub";
  branchIndex: number;
  subIndex?: number;
  term: string;
  detail: string;
  color: string;
  path: string;
  pathD: string;
  innerRadius: number;
  outerRadius: number;
  startAngle: number;
  endAngle: number;
  fillOpacity: number;
  stroke: string;
  strokeWidth: number;
  highlighted: boolean;
  labelX: number;
  labelY: number;
  labelRotateDeg: number;
  maxLabelWidth: number;
  labelBoxW: number;
  labelBoxH: number;
  label: string;
  labelLines: string[];
  labelFontSize: number;
};

export type MindMapSunburstLayout = {
  cx: number;
  cy: number;
  size: number;
  rootRadius: number;
  rootTerm: string;
  rootColor: string;
  contentOuterRadius: number;
  edgePadding: number;
  rootLabelFontSize: number;
  rootLabelMaxLines: number;
  expandedBranchIndices: number[];
  expandedBranchIds: string[];
  slices: MindMapSunburstSlice[];
};

export type MindMapLayoutSubBranch = {
  term: string;
  detail: string;
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  subIndex: number;
  branchIndex: number;
  branchColor: string;
  leafBorderRadius: number;
  shape: MindMapNodeShape;
};

export type MindMapLayoutBranch = {
  term: string;
  index: number;
  bx: number;
  by: number;
  bw: number;
  bh: number;
  branchColor: string;
  borderRadius: number;
  shape: MindMapNodeShape;
  /** Total sub-branches (for UI hint when collapsed). */
  subBranchCount: number;
  subBranches: MindMapLayoutSubBranch[];
};

export const MIND_MAP_RADIAL_R = 280;
export const MIND_MAP_RADIAL_R2_BUBBLE = 400;
export const MIND_MAP_RADIAL_R2_DEFAULT = 440;
export const MIND_MAP_TREE_NODE_GAP = 100;

export type MindMapLayout = {
  mapWidth: number;
  mapSvgHeight: number;
  /** Sunburst pie layout (Radial style only). */
  sunburst?: MindMapSunburstLayout;
  paths: { key: string; d: string; stroke: string; strokeWidth: number }[];
  root: {
    left: number;
    top: number;
    minW: number;
    minH: number;
    term: string;
    shape: MindMapNodeShape;
  };
  branches: MindMapLayoutBranch[];
};
