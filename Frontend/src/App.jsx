import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ArticleEditor from './pages/ArticleEditor';
import EditorDashboard from './pages/EditorDashboard';
import EditorReview from './pages/EditorReview';

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

      {/* Journalist routes */}
      <Route element={<ProtectedRoute allowedRoles={['JOURNALIST', 'ADMIN']} />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/editor" element={<ArticleEditor />} />
        <Route path="/editor/:id" element={<ArticleEditor />} />
      </Route>

      {/* Editor routes */}
      <Route element={<ProtectedRoute allowedRoles={['EDITOR', 'ADMIN']} />}>
        <Route path="/editor-dashboard" element={<EditorDashboard />} />
        <Route path="/editor-review/:id" element={<EditorReview />} />
      </Route>

      {/* Default */}
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
