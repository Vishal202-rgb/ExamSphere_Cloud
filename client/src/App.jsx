// ==============================================================================
// ExamSphere – Client Application Entry & Route Configuration
// Dynamic Code-Splitting via React.lazy & Suspense for High-Performance Delivery
// ==============================================================================

import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { logout as logoutAction } from './store/slices/authSlice.js';
import { Loader2 } from 'lucide-react';

// Protected Route wrapper
import ProtectedRoute from './components/common/ProtectedRoute.jsx';

// Layouts (Eagerly loaded for shell structure)
import AdminLayout from './layouts/AdminLayout.jsx';
import FacultyLayout from './layouts/FacultyLayout.jsx';
import StudentLayout from './layouts/StudentLayout.jsx';

// ------------------------------------------------------------------------------
// Lazy-Loaded Route Components (Code-Split on Demand)
// ------------------------------------------------------------------------------

// Auth
const LoginPage = lazy(() => import('./pages/auth/LoginPage.jsx'));

// Admin Pages
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage.jsx'));
const AdminAnalyticsDashboard = lazy(() => import('./pages/admin/AdminAnalyticsDashboard.jsx'));
const DepartmentsPage = lazy(() => import('./pages/admin/DepartmentsPage.jsx'));
const CoursesPage = lazy(() => import('./pages/admin/CoursesPage.jsx'));
const FacultyPage = lazy(() => import('./pages/admin/FacultyPage.jsx'));
const StudentsPage = lazy(() => import('./pages/admin/StudentsPage.jsx'));

// Faculty Pages
const FacultyDashboardPage = lazy(() => import('./pages/faculty/FacultyDashboardPage.jsx'));
const FacultyAnalyticsPage = lazy(() => import('./pages/faculty/FacultyAnalyticsPage.jsx'));
const CodingQuestionEditor = lazy(() => import('./pages/faculty/CodingQuestionEditor.jsx'));
const QuestionBankPage = lazy(() => import('./pages/faculty/QuestionBankPage.jsx'));
const ExamsListPage = lazy(() => import('./pages/faculty/ExamsListPage.jsx'));
const CreateExamWizard = lazy(() => import('./pages/faculty/CreateExamWizard.jsx'));
const ExamSubmissionsPage = lazy(() => import('./pages/faculty/ExamSubmissionsPage.jsx'));
const AttemptEvaluationPage = lazy(() => import('./pages/faculty/AttemptEvaluationPage.jsx'));
const LiveExamMonitoringPage = lazy(() => import('./pages/faculty/LiveExamMonitoringPage.jsx'));

// Student Pages
const StudentDashboardPage = lazy(() => import('./pages/student/StudentDashboardPage.jsx'));
const StudentAnalyticsPage = lazy(() => import('./pages/student/StudentAnalyticsPage.jsx'));
const ExamTakePage = lazy(() => import('./pages/student/ExamTakePage.jsx'));
const StudentResultsPage = lazy(() => import('./pages/student/StudentResultsPage.jsx'));
const StudentResultDetailPage = lazy(() => import('./pages/student/StudentResultDetailPage.jsx'));

// Common Pages
const NotificationsPage = lazy(() => import('./pages/common/NotificationsPage.jsx'));

// Sleek Loading Fallback Spinner
function PageLoader() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 space-y-4">
      <div className="relative flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-2 border-blue-500/20 border-t-blue-500 animate-spin" />
        <Loader2 className="w-5 h-5 text-blue-400 animate-pulse absolute" />
      </div>
      <p className="text-xs font-mono text-slate-400 tracking-wider uppercase animate-pulse">
        Loading ExamSphere Module...
      </p>
    </div>
  );
}

// Home / Root redirector based on authentication and role
function RootRedirect() {
  const { isAuthenticated, role, token } = useSelector((state) => state.auth);

  if (!isAuthenticated || !token) {
    return <Navigate to="/login" replace />;
  }

  if (role === 'ADMIN' || role === 'SUPER_ADMIN') return <Navigate to="/admin" replace />;
  if (role === 'FACULTY') return <Navigate to="/faculty" replace />;
  if (role === 'STUDENT') return <Navigate to="/student" replace />;

  return <Navigate to="/login" replace />;
}

// 404 Not Found Page
function NotFoundPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center">
      <div className="glass-panel p-8 rounded-2xl border border-slate-800 max-w-md w-full space-y-4">
        <div className="text-5xl font-black text-blue-500 font-mono">404</div>
        <h1 className="text-xl font-bold text-white">Page Not Found</h1>
        <p className="text-xs text-slate-400">
          The requested route does not exist or you do not have permission to access it.
        </p>
        <div className="pt-2">
          <RootRedirect />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const dispatch = useDispatch();

  React.useEffect(() => {
    const handleAuthExpired = () => {
      dispatch(logoutAction());
    };
    window.addEventListener('auth:expired', handleAuthExpired);
    return () => window.removeEventListener('auth:expired', handleAuthExpired);
  }, [dispatch]);

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Root redirect */}
        <Route path="/" element={<RootRedirect />} />

        {/* Public Login Route */}
        <Route path="/login" element={<LoginPage />} />

        {/* Admin Portal Protected Routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route
            index
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}>
                <AdminDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route path="analytics" element={<AdminAnalyticsDashboard />} />
          <Route path="departments" element={<DepartmentsPage />} />
          <Route path="courses" element={<CoursesPage />} />
          <Route path="faculty" element={<FacultyPage />} />
          <Route path="students" element={<StudentsPage />} />
        </Route>

        {/* Faculty Portal Protected Routes */}
        <Route
          path="/faculty"
          element={
            <ProtectedRoute allowedRoles={['FACULTY']}>
              <FacultyLayout />
            </ProtectedRoute>
          }
        >
          <Route
            index
            element={
              <ProtectedRoute allowedRoles={['FACULTY']}>
                <FacultyDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route path="analytics" element={<FacultyAnalyticsPage />} />
          <Route path="questions" element={<QuestionBankPage />} />
          <Route path="questions/coding/create" element={<CodingQuestionEditor />} />
          <Route path="questions/coding/:questionId/edit" element={<CodingQuestionEditor />} />
          <Route path="exams" element={<ExamsListPage />} />
          <Route path="exams/create" element={<CreateExamWizard />} />
          <Route path="exams/:examId/submissions" element={<ExamSubmissionsPage />} />
          <Route path="exams/:examId/monitoring" element={<LiveExamMonitoringPage />} />
          <Route path="attempts/:attemptId/evaluate" element={<AttemptEvaluationPage />} />
        </Route>

        {/* Student Portal Protected Routes */}
        <Route
          path="/student"
          element={
            <ProtectedRoute allowedRoles={['STUDENT']}>
              <StudentLayout />
            </ProtectedRoute>
          }
        >
          <Route
            index
            element={
              <ProtectedRoute allowedRoles={['STUDENT']}>
                <StudentDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route path="analytics" element={<StudentAnalyticsPage />} />
          <Route path="results" element={<StudentResultsPage />} />
          <Route path="exams/:examId/result" element={<StudentResultDetailPage />} />
        </Route>

        {/* Common Notifications Page */}
        <Route
          path="/notifications"
          element={
            <ProtectedRoute allowedRoles={['STUDENT', 'FACULTY', 'ADMIN', 'SUPER_ADMIN']}>
              <NotificationsPage />
            </ProtectedRoute>
          }
        />

        {/* Fullscreen Distraction-Free Examination Session Interface */}
        <Route
          path="/student/exams/:examId/take"
          element={
            <ProtectedRoute allowedRoles={['STUDENT']}>
              <ExamTakePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/student/attempts/:attemptId"
          element={
            <ProtectedRoute allowedRoles={['STUDENT']}>
              <ExamTakePage />
            </ProtectedRoute>
          }
        />

        {/* Fallback 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
