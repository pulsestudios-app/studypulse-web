// Copied from pulsestudios-app/StudyPulse@e06fff9 (launch-ota): src/components/results/resultsMapConstants.ts
// Keep in sync manually — no monorepo coupling. Changes vs source: none.

export type MapLayoutStyle = "radial" | "tree" | "network" | "bubble";

export const MAP_STYLE_OPTIONS: { id: MapLayoutStyle; label: string }[] = [
  { id: "radial", label: "Radial" },
  { id: "tree", label: "Tree" },
  { id: "network", label: "Network" },
  { id: "bubble", label: "Bubble" },
];

export const MAP_NODE_FILL = "#141414";
export const MAP_STYLE_PILL_W = 88;
export const MAP_STYLE_PILL_GAP = 8;
export const MAP_STYLE_PILL_SLOT = MAP_STYLE_PILL_W + MAP_STYLE_PILL_GAP;
