import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { Toaster } from 'sonner'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Employees from './pages/Employees'
import Companies from './pages/Companies'
import Users from './pages/Users'
import Settings from './pages/Settings'
import AdminSettings from './pages/AdminSettings'
import Notifications from './pages/Notifications'
import AlertsPage from './pages/AlertsPage'
import Reports from './pages/Reports'
import ActivityLogs from './pages/ActivityLogs'
import ImportExport from './pages/ImportExport'
import AdvancedSearch from './pages/AdvancedSearch'
import SecurityManagement from './pages/SecurityManagement'
import PermissionsManagement from './pages/PermissionsManagement'
import GeneralSettings from './pages/GeneralSettings'
import EnhancedAlertsTestPage from './pages/EnhancedAlertsTestPage'
import CommercialRegTestPage from './pages/CommercialRegTestPage'
import './App.css'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/employees" element={<ProtectedRoute><Employees /></ProtectedRoute>} />
      <Route path="/companies" element={<ProtectedRoute><Companies /></ProtectedRoute>} />
      <Route path="/advanced-search" element={<ProtectedRoute><AdvancedSearch /></ProtectedRoute>} />
      <Route path="/users" element={<ProtectedRoute><Users /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="/admin-settings" element={<ProtectedRoute><AdminSettings /></ProtectedRoute>} />
      <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
      <Route path="/alerts" element={<ProtectedRoute><AlertsPage /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
      <Route path="/activity-logs" element={<ProtectedRoute><ActivityLogs /></ProtectedRoute>} />
      <Route path="/import-export" element={<ProtectedRoute><ImportExport /></ProtectedRoute>} />
      <Route path="/security-management" element={<ProtectedRoute><SecurityManagement /></ProtectedRoute>} />
      <Route path="/permissions-management" element={<ProtectedRoute><PermissionsManagement /></ProtectedRoute>} />
      <Route path="/general-settings" element={<ProtectedRoute><GeneralSettings /></ProtectedRoute>} />
      <Route path="/enhanced-alerts-test" element={<ProtectedRoute><EnhancedAlertsTestPage /></ProtectedRoute>} />
      <Route path="/commercial-reg-test" element={<ProtectedRoute><CommercialRegTestPage /></ProtectedRoute>} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-center" richColors />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
