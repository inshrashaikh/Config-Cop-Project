import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider, useApp } from './context/AppContext.jsx'
import { ToastContainer } from './components/ui/index.jsx'

// Layout
import DashboardLayout from './components/layout/DashboardLayout.jsx'

// Pages
import LandingPage from './pages/LandingPage.jsx'
import OverviewPage from './pages/OverviewPage.jsx'
import WorkloadsPage from './pages/WorkloadsPage.jsx'
import DriftAnalysisPage from './pages/DriftAnalysisPage.jsx'
import IncidentsPage from './pages/IncidentsPage.jsx'
import OperationsPage from './pages/OperationsPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'

function AppRoutes() {
  const { toasts, error } = useApp()

  return (
    <>
      {/* Global backend connection error notice */}
      {error && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            background: 'var(--danger-bg)',
            borderBottom: '1px solid var(--danger-border)',
            color: 'var(--danger)',
            padding: '8px 16px',
            fontSize: '12px',
            fontWeight: 600,
            textAlign: 'center',
            zIndex: 10001,
          }}
          role="alert"
        >
          {error} — ensure the FastAPI backend is running with <code>uvicorn app.main:app --port 8000</code>
        </div>
      )}

      {/* Global Floating Toast Container */}
      <ToastContainer toasts={toasts} />

      {/* Application Routing */}
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
