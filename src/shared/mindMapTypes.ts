// Copied from pulsestudios-app/StudyPulse@e06fff9 (launch-ota): src/features/processing/mindMapTypes.ts
// Keep in sync manually — no monorepo coupling. Changes vs source: none.

export type MindMapSubBranch = {
  term: string;
  detail: string;
};

export type MindMapBranch = {
  term: string;
  color: string;
  subBranches: MindMapSubBranch[];
};

export type MindMapPayload = {
  root: string;
  branches: MindMapBranch[];
};

export type MindMapBranchCount = 6 | 8 | 10 | 12;

export const MIND_MAP_BRANCH_COUNT_OPTIONS: MindMapBranchCount[] = [6, 8, 10, 12];

export const MIND_MAP_DEFAULT_BRANCH_COUNT: MindMapBranchCount = 8;

export const MIND_MAP_MAX_BRANCHES = 12;

export const MIND_MAP_BRANCH_COLORS = [
  "#1CB0F6",
  "#58CC02",
  "#FF6F61",
  "#FFC800",
  "#9B8CFF",
  "#53D7C2",
  "#FF9F43",
  "#A855F7",
  "#22D3EE",
  "#F472B6",
  "#84CC16",
  "#FB7185",
];

export function parseMindMapBranchCount(value: unknown): MindMapBranchCount {
  const n = typeof value === "number" ? value : Number(value);
  if (n === 6 || n === 8 || n === 10 || n === 12) {
    return n;
  }
  return MIND_MAP_DEFAULT_BRANCH_COUNT;
}

export function emptyMindMap(root = "Mind Map"): MindMapPayload {
  return { root: root.trim() || "Mind Map", branches: [] };
}

export function normalizeMindMapPayload(raw: unknown, fallbackRoot = "Mind Map"): MindMapPayload {
  if (!raw || typeof raw !== "object") {
    return emptyMindMap(fallbackRoot);
  }
  const o = raw as Record<string, unknown>;
  const root =
    typeof o.root === "string" && o.root.trim() ? o.root.trim().slice(0, 200) : fallbackRoot;
  const branchesRaw = Array.isArray(o.branches) ? o.branches : [];
  const branches = branchesRaw.slice(0, MIND_MAP_MAX_BRANCHES).map((b, i) => {
    const row = b && typeof b === "object" ? (b as Record<string, unknown>) : {};
    const term =
      typeof row.term === "string" && row.term.trim()
        ? row.term.trim().slice(0, 80)
        : `Topic ${i + 1}`;
    const colorRaw = typeof row.color === "string" ? row.color.trim() : "";
    const color = /^#[0-9A-Fa-f]{6}$/.test(colorRaw)
      ? colorRaw
      : MIND_MAP_BRANCH_COLORS[i % MIND_MAP_BRANCH_COLORS.length]!;
    const subsRaw = Array.isArray(row.subBranches)
      ? row.subBranches
      : Array.isArray((row as { sub_branches?: unknown }).sub_branches)
        ? (row as { sub_branches: unknown[] }).sub_branches
        : [];
    const subBranches = subsRaw.slice(0, 4).map((s, j) => {
      const sub = s && typeof s === "object" ? (s as Record<string, unknown>) : {};
      const subTerm =
        typeof sub.term === "string" && sub.term.trim()
          ? sub.term.trim().slice(0, 80)
          : `${term} — ${j + 1}`;
      const detail =
        typeof sub.detail === "string" && sub.detail.trim()
          ? sub.detail.trim().slice(0, 400)
          : "See transcript for more context.";
      return { term: subTerm, detail };
    });
    return { term, color, subBranches };
  });
  return { root, branches };
}

export function hasMindMapContent(mindMap: MindMapPayload | null | undefined): boolean {
  return Boolean(mindMap?.branches?.length);
}
