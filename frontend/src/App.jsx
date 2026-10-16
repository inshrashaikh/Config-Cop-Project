import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AlertCircle, Server } from 'lucide-react'
import { AppProvider, useApp } from './context/AppContext.jsx'
import { ToastContainer, Skeleton } from './components/ui/index.jsx'

// Layout
import DashboardLayout from './components/layout/DashboardLayout.jsx'

// Lazy-loaded Pages for Zero Layout Shift & High Performance
const LandingPage = lazy(() => import('./pages/LandingPage.jsx'))
const OverviewPage = lazy(() => import('./pages/OverviewPage.jsx'))
const WorkloadsPage = lazy(() => import('./pages/WorkloadsPage.jsx'))
const DriftAnalysisPage = lazy(() => import('./pages/DriftAnalysisPage.jsx'))
const IncidentsPage = lazy(() => import('./pages/IncidentsPage.jsx'))
const OperationsPage = lazy(() => import('./pages/OperationsPage.jsx'))
const SettingsPage = lazy(() => import('./pages/SettingsPage.jsx'))

function PageFallback() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '12px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '40%' }}>
          <Skeleton height="32px" width="70%" />
          <Skeleton height="16px" width="100%" />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Skeleton height="36px" width="110px" />
          <Skeleton height="36px" width="110px" />
        </div>
      </div>
      <div className="stats-grid">
        {[1, 2, 3, 4, 5].map(i => (
          <Skeleton key={i} height="104px" width="100%" style={{ borderRadius: 'var(--radius-lg)' }} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
        <Skeleton height="280px" width="100%" style={{ borderRadius: 'var(--radius-lg)' }} />
        <Skeleton height="280px" width="100%" style={{ borderRadius: 'var(--radius-lg)' }} />
      </div>
    </div>
  )
}

function AppRoutes() {
  const { toasts, error } = useApp()

  return (
    <>
      {/* Global backend connection notice */}
      {error && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            background: 'var(--danger-bg)',
            borderBottom: '1px solid var(--danger-border)',
            color: 'var(--danger-text)',
            padding: '10px 16px',
            fontSize: 'var(--text-caption)',
            fontWeight: 600,
            textAlign: 'center',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            boxShadow: 'var(--elev-2)',
          }}
          role="alert"
        >
          <AlertCircle size={15} color="var(--danger-solid)" />
          <span>
            {error} — ensure the FastAPI backend is running with <code>uvicorn app.main:app --port 8000</code>
          </span>
        </div>
      )}

      {/* Global Floating Toast Container */}
      <ToastContainer toasts={toasts} />

      {/* Application Routing with Suspense Fallback */}
      <Suspense fallback={<PageFallback />}>
        <Routes>
          {/* Landing Page */}
          <Route path="/" element={<LandingPage />} />

          {/* Dashboard Shell Routes */}
          <Route
            path="/dashboard"
            element={
              <DashboardLayout>
                <OverviewPage />
              </DashboardLayout>
            }
          />
          <Route
            path="/dashboard/workloads"
            element={
              <DashboardLayout>
                <WorkloadsPage />
              </DashboardLayout>
            }
          />
          <Route
            path="/dashboard/drift"
            element={
              <DashboardLayout>
                <DriftAnalysisPage />
              </DashboardLayout>
            }
          />
          <Route
            path="/dashboard/incidents"
            element={
              <DashboardLayout>
                <IncidentsPage />
              </DashboardLayout>
            }
          />
          <Route
            path="/dashboard/operations"
            element={
              <DashboardLayout>
                <OperationsPage />
              </DashboardLayout>
            }
          />
          <Route
            path="/dashboard/settings"
            element={
              <DashboardLayout>
                <SettingsPage />
              </DashboardLayout>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <AppRoutes />
      </AppProvider>
    </BrowserRouter>
  )
}
