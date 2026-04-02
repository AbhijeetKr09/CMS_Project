import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/common/ProtectedRoute';

// Existing pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ArticleEditor from './pages/ArticleEditor';
import EditorDashboard from './pages/EditorDashboard';
import EditorReview from './pages/EditorReview';

// New admin / content management pages
import EventsManager           from './pages/EventsManager';
import SocialTrendsManager     from './pages/SocialTrendsManager';
import ExpertsManager          from './pages/ExpertsManager';
import MediaManager            from './pages/MediaManager';
import AnalyticalArticleManager from './pages/AnalyticalArticleManager';
import UserManager             from './pages/UserManager';
import AirlinesManager         from './pages/AirlinesManager';
import CommentsManager         from './pages/CommentsManager';

const PublicRoute = ({ children }) => {
  const { isAuthenticated, role } = useAuth();
  if (!isAuthenticated) return children;
  return <Navigate to={role === 'EDITOR' || role === 'ADMIN' ? '/editor-dashboard' : '/dashboard'} replace />;
};

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />

      {/* Journalist routes (+ Editor acting as journalist) */}
      <Route element={<ProtectedRoute allowedRoles={['JOURNALIST', 'EDITOR', 'ADMIN']} />}>
        <Route path="/dashboard"   element={<Dashboard />} />
        <Route path="/editor"      element={<ArticleEditor />} />
        <Route path="/editor/:id"  element={<ArticleEditor />} />
      </Route>

      {/* Editor + Admin routes (article workflow) */}
      <Route element={<ProtectedRoute allowedRoles={['EDITOR', 'ADMIN']} />}>
        <Route path="/editor-dashboard"   element={<EditorDashboard />} />
        <Route path="/editor-review/:id"  element={<EditorReview />} />
      </Route>

      {/* Admin content management routes (EDITOR + ADMIN) */}
      <Route element={<ProtectedRoute allowedRoles={['EDITOR', 'ADMIN']} />}>
        <Route path="/admin/events"               element={<EventsManager />} />
        <Route path="/admin/social-trends"        element={<SocialTrendsManager />} />
        <Route path="/admin/experts"              element={<ExpertsManager />} />
        <Route path="/admin/media"                element={<MediaManager />} />
        <Route path="/admin/analytical-articles"  element={<AnalyticalArticleManager />} />
        <Route path="/admin/users"                element={<UserManager />} />
        <Route path="/admin/airlines"             element={<AirlinesManager />} />
        <Route path="/admin/comments"             element={<CommentsManager />} />
      </Route>

      {/* Default — redirect to login */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}

export default App;
