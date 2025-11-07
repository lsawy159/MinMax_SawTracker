import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { Toaster } from 'sonner'
import './App.css'

// Eager loading for Login (critical path)
import Login from './pages/Login'

// Lazy loading for all other pages
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Employees = lazy(() => import('./pages/Employees'))
const Companies = lazy(() => import('./pages/Companies'))
const Users = lazy(() => import('./pages/Users'))
const Settings = lazy(() => import('./pages/Settings'))
const AdminSettings = lazy(() => import('./pages/AdminSettings'))
const Notifications = lazy(() => import('./pages/Notifications'))
const AlertsPage = lazy(() => import('./pages/AlertsPage'))
const Reports = lazy(() => import('./pages/Reports'))
const ActivityLogs = lazy(() => import('./pages/ActivityLogs'))
const ImportExport = lazy(() => import('./pages/ImportExport'))
const AdvancedSearch = lazy(() => import('./pages/AdvancedSearch'))
const SecurityManagement = lazy(() => import('./pages/SecurityManagement'))
const PermissionsManagement = lazy(() => import('./pages/PermissionsManagement'))
const GeneralSettings = lazy(() => import('./pages/GeneralSettings'))
const EnhancedAlertsTestPage = lazy(() => import('./pages/EnhancedAlertsTestPage'))
const CommercialRegTestPage = lazy(() => import('./pages/CommercialRegTestPage'))

// Loading fallback component
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="text-gray-600 text-sm">جاري التحميل...</p>
      </div>
    </div>
  )
}

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
    <Suspense fallback={<PageLoader />}>
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
    </Suspense>
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
