import { Navigate, Route, Routes } from "react-router";

import "./App.css";
import Layout from "./components/Layout";
import Cover from "./pages/Cover";
import CoverBuilder from "./pages/CoverBuilder";
import Dashboard from "./pages/Dashboard";
import PromptHeaderPage from "./pages/PromptHeader";
import ReferencesPage from "./pages/References";
import ResumeEditor from "./pages/ResumeEditor";
import SettingsPage from "./pages/Settings";

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/resume" element={<ResumeEditor />} />
        <Route path="/cover" element={<Cover />} />
        <Route path="/cover/builder" element={<CoverBuilder />} />
        <Route path="/cover/builder/:letter_id" element={<CoverBuilder />} />
        <Route path="/cover/prompt-header" element={<PromptHeaderPage />} />
        <Route path="/cover/references" element={<ReferencesPage />} />
        {/* The old edit page became the builder; keep its link working. */}
        <Route
          path="/cover/edit"
          element={<Navigate to="/cover/builder" replace />}
        />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}

export default App;
