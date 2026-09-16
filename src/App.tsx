import { Navigate, Route, Routes } from "react-router";

import "./App.css";
import Layout from "./components/Layout";
import Cover from "./pages/Cover";
import Dashboard from "./pages/Dashboard";
import ResumeEditor from "./pages/ResumeEditor";
import SettingsPage from "./pages/Settings";

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/resume" element={<ResumeEditor />} />
        <Route path="/cover" element={<Cover />} />
        {/* The cover pages became tabs on /cover; keep their old links working. */}
        <Route path="/cover/*" element={<Navigate to="/cover" replace />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}

export default App;
