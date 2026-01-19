// Import specific React types and helpers only
import { ReactNode, Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { Toaster } from 'sonner'
import { queryClient } from './lib/queryClient'
import { logger } from './utils/logger'
import './App.css'

// Lazy load all pages for code splitting
const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Employees = lazy(() => import('./pages/Employees'))
const Companies = lazy(() => import('./pages/Companies'))
const Projects = lazy(() => import('./pages/Projects'))
const Users = lazy(() => import('./pages/Users'))
const Settings = lazy(() => import('./pages/Settings'))
const Notifications = lazy(() => import('./pages/Notifications'))
const Alerts = lazy(() => import('./pages/Alerts'))
const Reports = lazy(() => import('./pages/Reports'))
const ActivityLogs = lazy(() => import('./pages/ActivityLogs'))
const ImportExport = lazy(() => import('./pages/ImportExport'))
const AdvancedSearch = lazy(() => import('./pages/AdvancedSearch'))
const GeneralSettings = lazy(() => import('./pages/GeneralSettings'))
const CentralizedSettings = lazy(() => import('./pages/CentralizedSettings'))
const SystemCorrespondenceManagement = lazy(() => import('./pages/EmailManagement'))
const UserGuide = lazy(() => import('./pages/UserGuide'))
const AdminGuide = lazy(() => import('./pages/AdminGuide'))

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
    logger.debug('[ProtectedRoute] No session found, redirecting to login')
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
              <GeneralSettings />
            </Suspense>
          </ProtectedRoute>
        } />
        <Route path="/system-correspondence" element={
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <SystemCorrespondenceManagement />
            </Suspense>
          </ProtectedRoute>
        } />
        <Route path="/email-management" element={<Navigate to="/system-correspondence" replace />} />
        <Route path="/centralized-settings" element={
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <CentralizedSettings />
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
              <Navigate to="/admin-settings" replace />
            </Suspense>
          </ProtectedRoute>
        } />
        <Route path="/general-settings" element={
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <Navigate to="/admin-settings" replace />
            </Suspense>
          </ProtectedRoute>
        } />
        <Route path="/user-guide" element={
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <UserGuide />
            </Suspense>
          </ProtectedRoute>
        } />
        <Route path="/admin-guide" element={
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <AdminGuide />
            </Suspense>
          </ProtectedRoute>
        } />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
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
    </QueryClientProvider>
  )
}

export default App
