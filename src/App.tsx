// Import specific React types and helpers only
import { ReactNode, Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { Toaster } from 'sonner'
import { queryClient } from './lib/queryClient'
import AuthLoading from './components/AuthLoading'
import { useThemeMode } from './hooks/useUiPreferences'
import './App.css'

// Lazy load all pages for code splitting
const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Employees = lazy(() => import('./pages/Employees'))
const Companies = lazy(() => import('./pages/Companies'))
const Projects = lazy(() => import('./pages/Projects'))
const TransferProcedures = lazy(() => import('./pages/TransferProcedures'))
const Users = lazy(() => import('./pages/Users'))
const Settings = lazy(() => import('./pages/Settings'))
const Notifications = lazy(() => import('./pages/Notifications'))
const Alerts = lazy(() => import('./pages/Alerts'))
const Reports = lazy(() => import('./pages/Reports'))
const PayrollDeductions = lazy(() => import('./pages/PayrollDeductions'))
const ActivityLogs = lazy(() => import('./pages/ActivityLogs'))
const ImportExport = lazy(() => import('./pages/ImportExport'))
const DesignSystem = lazy(() => import('./pages/DesignSystem'))
const AdvancedSearch = lazy(() => import('./pages/AdvancedSearch'))
const GeneralSettings = lazy(() => import('./pages/GeneralSettings'))
const AlertSettings = lazy(() => import('./pages/AlertSettings'))
const BackupSettingsManagement = lazy(() => import('./pages/BackupSettings'))

// Loading fallback component
function PageLoader({
  title = 'جاري تجهيز التطبيق',
  description = 'نقوم الآن بالتحقق من الجلسة وتحميل البيانات الأساسية.'
}: {
  title?: string
  description?: string
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50/80 px-4 dark:bg-slate-950">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white/95 p-8 text-center shadow-xl dark:border-white/10 dark:bg-slate-900/90">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
        <h2 className="mb-2 text-xl font-bold text-slate-900 dark:text-white">{title}</h2>
        <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p>
      </div>
    </div>
  )
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session } = useAuth()

  return (
    <AuthLoading
      showError={false}
      maxWaitTime={12000}
      fallback={(
        <PageLoader
          title="جاري فتح حسابك"
          description="نستعيد الجلسة ونجهز بيانات الصفحة بشكل آمن."
        />
      )}
    >
      {session ? <>{children}</> : <Navigate to="/login" replace />}
    </AuthLoading>
  )
}

function PublicRoute({ children }: { children: ReactNode }) {
  const { session } = useAuth()

  return (
    <AuthLoading
      showError={false}
      maxWaitTime={8000}
      fallback={(
        <PageLoader
          title="جاري فتح صفحة الدخول"
          description="نتحقق من حالة الجلسة قبل عرض الصفحة المناسبة لك."
        />
      )}
    >
      {session ? <Navigate to="/dashboard" replace /> : <>{children}</>}
    </AuthLoading>
  )
}

function AppRoutes() {
  const location = useLocation()
  return (
    <div key={location.pathname} className="page-enter">
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
        <Route path="/transfer-procedures" element={
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <TransferProcedures />
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
        <Route path="/backup-settings" element={
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <BackupSettingsManagement />
            </Suspense>
          </ProtectedRoute>
        } />
        <Route path="/email-management" element={<Navigate to="/backup-settings" replace />} />
        <Route path="/system-correspondence" element={<Navigate to="/backup-settings" replace />} />
        <Route path="/alert-settings" element={
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <AlertSettings />
            </Suspense>
          </ProtectedRoute>
        } />
        <Route path="/centralized-settings" element={<Navigate to="/alert-settings" replace />} />
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
        <Route path="/payroll-deductions" element={
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <PayrollDeductions />
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
        <Route path="/design-system" element={
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <DesignSystem />
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
        <Route path="/permissions" element={
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <Navigate to="/admin-settings?tab=permissions" replace />
            </Suspense>
          </ProtectedRoute>
        } />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </div>
  )
}

function App() {
  useThemeMode()

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
