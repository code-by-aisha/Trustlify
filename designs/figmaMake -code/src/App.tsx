import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Investigate from "./pages/Investigate";
import InvestigationProgress from "./pages/InvestigationProgress";
import EvidenceGraph from "./pages/EvidenceGraph";
import InvestigationResult from "./pages/InvestigationResult";
import StudentMatch from "./pages/StudentMatch";
import Monitoring from "./pages/Monitoring";
import History from "./pages/History";
import Settings from "./pages/Settings";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Marketing */}
        <Route path="/" element={<Landing />} />

        {/* Auth */}
        <Route path="/auth" element={<Auth />} />

        {/* Student onboarding */}
        <Route path="/student/onboarding" element={<Onboarding />} />

        {/* App */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/investigate" element={<Investigate />} />

        {/* Investigation flow */}
        <Route path="/investigation/:id/progress" element={<InvestigationProgress />} />
        <Route path="/investigation/:id/evidence" element={<EvidenceGraph />} />
        <Route path="/investigation/:id/match" element={<StudentMatch />} />
        <Route path="/investigation/:id" element={<InvestigationResult />} />

        {/* Other app screens */}
        <Route path="/monitoring" element={<Monitoring />} />
        <Route path="/history" element={<History />} />
        <Route path="/settings" element={<Settings />} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
