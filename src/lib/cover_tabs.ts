import { createContext, useContext } from "react";

export type CoverTab = "new" | "builder" | "prompt-header" | "references";

interface CoverTabs {
  tab: CoverTab;
  set_tab: (tab: CoverTab) => void;
  /** The letter open in the builder, or null for the list of letters. */
  letter_id: string | null;
  /** Switch to the builder with this letter open, or back to the list. */
  open_letter: (id: string | null) => void;
}

export const CoverTabsContext = createContext<CoverTabs | null>(null);

/** The tab state `/cover` shares with its panels. */
export function useCoverTabs() {
  const tabs = useContext(CoverTabsContext);

  if (!tabs) {
    throw new Error("useCoverTabs must be used inside the /cover page.");
  }

  return tabs;
}
