// Import React wrapper to ensure React is initialized before any JSX is processed
// This prevents TDZ (Temporal Dead Zone) errors in production builds
import React, { ReactNode, Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { Toaster } from 'sonner'
import './App.css'

// Lazy load all pages for code splitting
const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Employees = lazy(() => import('./pages/Employees'))
const Companies = lazy(() => import('./pages/Companies'))
const Projects = lazy(() => import('./pages/Projects'))
const Users = lazy(() => import('./pages/Users'))
const Settings = lazy(() => import('./pages/Settings'))
const AdminSettings = lazy(() => import('./pages/AdminSettings'))
const Notifications = lazy(() => import('./pages/Notifications'))
const Alerts = lazy(() => import('./pages/Alerts'))
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
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="text-gray-600">جاري التحميل...</p>
      </div>
    </div>
  )
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()

  // الانتظار حتى يكتمل جلب session قبل اتخاذ قرار redirect
  // هذا يمنع redirect غير مرغوب عند refresh
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // التحقق من session فقط بعد انتهاء loading
  // إذا كان loading = false و session = null، فهذا يعني عدم وجود جلسة
  // في هذه الحالة فقط نقوم بـ redirect إلى login
  if (!session) {
    console.log('[ProtectedRoute] No session found, redirecting to login')
    return <Navigate to="/login" replace />
  }

  // إذا كان هناك session، نعرض المحتوى
  return <>{children}</>
}

function PublicRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // إذا كان المستخدم مسجل دخول بالفعل، احوله إلى Dashboard
  if (session) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
        <Route path="/login" element={
          <PublicRoute>
            <Suspense fallback={<PageLoader />}>
              <Login />
            </Suspense>
          </PublicRoute>
        } />
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <Dashboard />
            </Suspense>
          </ProtectedRoute>
        } />
        <Route path="/employees" element={
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <Employees />
            </Suspense>
          </ProtectedRoute>
        } />
        <Route path="/companies" element={
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <Companies />
            </Suspense>
          </ProtectedRoute>
        } />
        <Route path="/projects" element={
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <Projects />
            </Suspense>
          </ProtectedRoute>
        } />
        <Route path="/advanced-search" element={
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <AdvancedSearch />
            </Suspense>
          </ProtectedRoute>
        } />
        <Route path="/users" element={
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <Users />
            </Suspense>
          </ProtectedRoute>
        } />
        <Route path="/settings" element={
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <Settings />
            </Suspense>
          </ProtectedRoute>
        } />
        <Route path="/admin-settings" element={
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <AdminSettings />
            </Suspense>
          </ProtectedRoute>
        } />
        <Route path="/notifications" element={
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <Notifications />
            </Suspense>
          </ProtectedRoute>
        } />
        <Route path="/alerts" element={
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <Alerts />
            </Suspense>
          </ProtectedRoute>
        } />
        <Route path="/reports" element={
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <Reports />
            </Suspense>
          </ProtectedRoute>
        } />
        <Route path="/activity-logs" element={
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <ActivityLogs />
            </Suspense>
          </ProtectedRoute>
        } />
        <Route path="/import-export" element={
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <ImportExport />
            </Suspense>
          </ProtectedRoute>
        } />
        <Route path="/security-management" element={
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <SecurityManagement />
            </Suspense>
          </ProtectedRoute>
        } />
        <Route path="/permissions-management" element={
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <PermissionsManagement />
            </Suspense>
          </ProtectedRoute>
        } />
        <Route path="/general-settings" element={
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <GeneralSettings />
            </Suspense>
          </ProtectedRoute>
        } />
        <Route path="/enhanced-alerts-test" element={
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <EnhancedAlertsTestPage />
            </Suspense>
          </ProtectedRoute>
        } />
        <Route path="/commercial-reg-test" element={
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <CommercialRegTestPage />
            </Suspense>
          </ProtectedRoute>
        } />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
  )
}

function App() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true
      }}
    >
      <AuthProvider>
        <Toaster position="top-center" richColors />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
