import type { UseMutationResult } from "@tanstack/react-query";

import type { ResultView } from "../resultParse";

export type TabContext = {
  view: ResultView;
  userId: string;
  /** Phone gate: getEffectivePlan(profile) === "free". */
  isFree: boolean;
  planTier: string;
  patch: (patch: Partial<ResultView>) => void;
  persist: UseMutationResult<void, Error, () => Promise<void>>;
};
