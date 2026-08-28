import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'

const Landing = lazy(() => import('./pages/Landing'))
const Auth = lazy(() => import('./pages/Auth'))
const Onboarding = lazy(() => import('./pages/Onboarding'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Investigate = lazy(() => import('./pages/Investigate'))
const InvestigationProgress = lazy(() => import('./pages/InvestigationProgress'))
const EvidenceGraph = lazy(() => import('./pages/EvidenceGraph'))
const InvestigationResult = lazy(() => import('./pages/InvestigationResult'))
const StudentMatch = lazy(() => import('./pages/StudentMatch'))
const Monitoring = lazy(() => import('./pages/Monitoring'))
const History = lazy(() => import('./pages/History'))
const Settings = lazy(() => import('./pages/Settings'))

function PageLoader() {
  return (
    <div className="min-h-screen bg-void flex items-center justify-center">
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-violet animate-progress-pulse" />
        <span className="font-mono text-xs text-dim tracking-wider">LOADING…</span>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
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
    </Suspense>
  )
}
