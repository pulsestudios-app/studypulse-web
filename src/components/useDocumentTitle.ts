import { useEffect } from "react";

/** Generic page titles only — never user content (titles can end up in browser history and telemetry). */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = title ? `${title} · StudyPulse` : "StudyPulse";
  }, [title]);
}
