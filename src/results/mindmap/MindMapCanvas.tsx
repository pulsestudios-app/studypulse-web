import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent } from "react";

import { buildMindMapLayout, computeMindMapContentRect } from "../../shared/mindmap/buildMindMapLayout";
import { MIND_MAP_SCALE_MAX, MIND_MAP_SCALE_MIN, type MindMapLayout, type MindMapSunburstSlice } from "../../shared/mindmap/MindMapTab.types";
import { MAP_NODE_FILL, type MapLayoutStyle } from "../../shared/mindmap/resultsMapConstants";
import type { MindMapPayload } from "../../shared/mindMapTypes";
import { COPY } from "../copy";

export type MindMapPopup = { term: string; detail: string; color: string };

type Props = {
  mindMap: MindMapPayload;
  style: MapLayoutStyle;
  expanded: number[];
  onToggleBranch: (index: number) => void;
  onPopup: (popup: MindMapPopup | null) => void;
};

const LAYOUT_SCREEN_WIDTH = 1280;

/** Phone MindMapTab: edges in one SVG, nodes as absolutely positioned boxes; sunburst as SVG paths. */
export function MindMapCanvas({ mindMap, style, expanded, onToggleBranch, onPopup }: Props) {
  const layout = useMemo(
    () => buildMindMapLayout({ mindMap, mapLayoutStyle: style, expandedBranchIndices: expanded, screenWidth: LAYOUT_SCREEN_WIDTH }),
    [mindMap, style, expanded],
  );
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  // Phone applyMindMapFit: fit content into the viewport at 92%, then center it.
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) {
      return;
    }
    const rect = computeMindMapContentRect(layout, expanded.length ? expanded[expanded.length - 1] : null);
    const cw = Math.max(1, rect.maxX - rect.minX);
    const ch = Math.max(1, rect.maxY - rect.minY);
    const fit = Math.min(vp.clientWidth / cw, vp.clientHeight / ch) * 0.92;
    const next = Math.max(MIND_MAP_SCALE_MIN, Math.min(MIND_MAP_SCALE_MAX, fit));
    setScale(next);
    setOffset({
      x: vp.clientWidth / 2 - (rect.minX + cw / 2) * next,
      y: vp.clientHeight / 2 - (rect.minY + ch / 2) * next,
    });
    // Refit only when the layout style or map changes, not on every expand.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [style, mindMap]);

  const zoomBy = (delta: number, aroundX?: number, aroundY?: number) => {
    const vp = viewportRef.current;
    const next = Math.max(MIND_MAP_SCALE_MIN, Math.min(MIND_MAP_SCALE_MAX, scale + delta));
    if (next === scale) {
      return;
    }
    const ax = aroundX ?? (vp?.clientWidth ?? 0) / 2;
    const ay = aroundY ?? (vp?.clientHeight ?? 0) / 2;
    // Keep the point under the cursor fixed.
    setOffset({ x: ax - ((ax - offset.x) / scale) * next, y: ay - ((ay - offset.y) / scale) * next });
    setScale(next);
  };

  const onWheel = (e: WheelEvent<HTMLDivElement>) => {
    if (!e.ctrlKey && !e.metaKey) {
      return;
    }
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    zoomBy(e.deltaY < 0 ? 0.1 : -0.1, e.clientX - rect.left, e.clientY - rect.top);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) {
      return;
    }
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) {
      return;
    }
    setOffset({ x: drag.current.ox + (e.clientX - drag.current.x), y: drag.current.oy + (e.clientY - drag.current.y) });
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    drag.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <div className="mindmap-wrap">
      <div
        ref={viewportRef}
        className="mindmap-viewport"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          className="mindmap-canvas"
          style={{ width: layout.mapWidth, height: layout.mapSvgHeight, transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
        >
          {layout.sunburst ? (
            <Sunburst layout={layout} expanded={expanded} onToggleBranch={onToggleBranch} onPopup={onPopup} />
          ) : (
            <Nodes layout={layout} expanded={expanded} onToggleBranch={onToggleBranch} onPopup={onPopup} />
          )}
        </div>
      </div>
      <div className="mindmap-zoom">
        <button type="button" className="btn btn-small" onClick={() => zoomBy(-0.1)} aria-label={COPY.mindMap.zoomOut}>
          −
        </button>
        <span className="type-caption text-secondary">{Math.round(scale * 100)}%</span>
        <button type="button" className="btn btn-small" onClick={() => zoomBy(0.1)} aria-label={COPY.mindMap.zoomIn}>
          +
        </button>
      </div>
    </div>
  );
}

function Nodes({ layout, expanded, onToggleBranch, onPopup }: Omit<Props, "mindMap" | "style"> & { layout: MindMapLayout }) {
  return (
    <>
      <svg className="mindmap-edges" width={layout.mapWidth} height={layout.mapSvgHeight} aria-hidden="true">
        {layout.paths.map((p) => (
          <path key={p.key} d={p.d} stroke={p.stroke} strokeWidth={p.strokeWidth} fill="none" />
        ))}
      </svg>
      <div
        className={`mm-node mm-root${layout.root.shape === "circle" ? " mm-circle" : ""}`}
        style={{ left: layout.root.left, top: layout.root.top, minWidth: layout.root.minW, minHeight: layout.root.minH, background: MAP_NODE_FILL }}
      >
        {layout.root.term}
      </div>
      {layout.branches.map((b) => {
        const isExpanded = expanded.includes(b.index);
        return (
          <div key={b.index}>
            <button
              type="button"
              className={`mm-node mm-branch${b.shape === "circle" ? " mm-circle" : ""}`}
              style={{
                left: b.bx,
                top: b.by,
                width: b.bw,
                height: b.bh,
                borderColor: b.branchColor,
                borderWidth: isExpanded ? 3 : 2,
                borderRadius: b.borderRadius,
                background: MAP_NODE_FILL,
              }}
              onClick={(e) => {
                e.stopPropagation();
                onToggleBranch(b.index);
              }}
            >
              <span>{b.term}</span>
              {b.subBranchCount > 0 ? (
                <span className="mm-hint" style={{ color: b.branchColor }}>
                  {isExpanded ? "▲ hide" : `▼ ${b.subBranchCount}`}
                </span>
              ) : null}
            </button>
            {b.subBranches.map((s) => (
              <button
                key={s.subIndex}
                type="button"
                className={`mm-node mm-sub${s.shape === "circle" ? " mm-circle" : ""}`}
                style={{
                  left: s.sx,
                  top: s.sy,
                  width: s.sw,
                  height: s.sh,
                  borderColor: `${s.branchColor}99`,
                  borderRadius: s.leafBorderRadius,
                  background: MAP_NODE_FILL,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onPopup({ term: s.term, detail: s.detail, color: s.branchColor });
                }}
              >
                {s.term}
              </button>
            ))}
          </div>
        );
      })}
    </>
  );
}

function Sunburst({ layout, expanded, onToggleBranch, onPopup }: Omit<Props, "mindMap" | "style"> & { layout: MindMapLayout }) {
  const sun = layout.sunburst!;
  const onSlice = (slice: MindMapSunburstSlice) => {
    if (slice.kind === "branch") {
      onToggleBranch(slice.branchIndex);
    } else {
      onPopup({ term: slice.term, detail: slice.detail, color: slice.color });
    }
  };
  return (
    <>
      <svg className="mindmap-edges" width={sun.size} height={sun.size} viewBox={`0 0 ${sun.size} ${sun.size}`}>
        {sun.slices.map((slice) => (
          <path
            key={slice.key}
            d={slice.pathD}
            fill={slice.color}
            fillOpacity={slice.fillOpacity}
            stroke={slice.stroke}
            strokeWidth={slice.strokeWidth}
            className="mm-slice"
            onClick={() => onSlice(slice)}
          >
            <title>{slice.term}</title>
          </path>
        ))}
        <circle cx={sun.cx} cy={sun.cy} r={sun.rootRadius} fill={sun.rootColor} stroke="rgba(0,0,0,0.15)" strokeWidth={1} />
      </svg>
      <div className="mm-sun-root" style={{ left: sun.cx, top: sun.cy, width: sun.rootRadius * 2 - 12, fontSize: sun.rootLabelFontSize }}>
        {sun.rootTerm}
      </div>
      {sun.slices.map((slice) => (
        <div
          key={`${slice.key}-label`}
          className={`mm-sun-label${slice.kind === "branch" && expanded.includes(slice.branchIndex) ? " is-expanded" : ""}`}
          style={{ left: slice.labelX, top: slice.labelY, maxWidth: slice.maxLabelWidth, fontSize: slice.labelFontSize }}
          onClick={() => onSlice(slice)}
          role="presentation"
        >
          {slice.label}
        </div>
      ))}
    </>
  );
}
