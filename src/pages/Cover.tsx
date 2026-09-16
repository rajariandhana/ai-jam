import { useState } from "react";

import { type CoverTab, CoverTabsContext } from "../lib/cover_tabs";
import CoverBuilder from "./CoverBuilder";
import NewLetter from "./NewLetter";
import PromptHeaderPage from "./PromptHeader";
import ReferencesPage from "./References";

/**
 * The cover letter pages as tabs, like `/resume`. Every panel stays mounted
 * and the inactive ones are only hidden, so each JSON file loads once and
 * unsaved edits survive switching tabs.
 */
function Cover() {
  const [tab, set_tab] = useState<CoverTab>("new");
  const [letter_id, set_letter_id] = useState<string | null>(null);

  function open_letter(id: string | null) {
    set_letter_id(id);
    set_tab("builder");
  }

  return (
    <CoverTabsContext.Provider value={{ tab, set_tab, letter_id, open_letter }}>
      <div hidden={tab !== "new"}>
        <NewLetter />
      </div>
      <div hidden={tab !== "builder"}>
        <CoverBuilder />
      </div>
      <div hidden={tab !== "prompt-header"}>
        <PromptHeaderPage />
      </div>
      <div hidden={tab !== "references"}>
        <ReferencesPage />
      </div>
    </CoverTabsContext.Provider>
  );
}

export default Cover;
