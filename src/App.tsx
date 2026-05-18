import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./components/AuthProvider";
import { useAuth } from "./lib/auth-context";
import { ROLE_HOME } from "./lib/types";
import LoginPage from "./pages/LoginPage";
import AppLayout from "./components/AppLayout";
import StagesDashboard from "./pages/stages/StagesDashboard";
import MonStage from "./pages/stages/MonStage";
import StageDetail from "./pages/stages/StageDetail";
import GrandOralDashboard from "./pages/grand-oral/GrandOralDashboard";
import MaFiche from "./pages/grand-oral/MaFiche";
import FicheDetail from "./pages/grand-oral/FicheDetail";
import AdminDashboard from "./pages/admin/AdminDashboard";
import ImportPage from "./pages/admin/ImportPage";
import ParametresPage from "./pages/admin/ParametresPage";
import CodesAccesPage from "./pages/admin/CodesAccesPage";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function DashboardRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={ROLE_HOME[user.role]} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardRedirect />} />
          <Route path="dashboard" element={<DashboardRedirect />} />
          <Route path="stages" element={<StagesDashboard />} />
          <Route path="stages/mon-stage" element={<MonStage />} />
          <Route path="stages/:eleveId" element={<StageDetail />} />
          <Route path="grand-oral" element={<GrandOralDashboard />} />
          <Route path="grand-oral/ma-fiche" element={<MaFiche />} />
          <Route path="grand-oral/:ficheId" element={<FicheDetail />} />
          <Route path="admin" element={<AdminDashboard />} />
          <Route path="admin/import" element={<ImportPage />} />
          <Route path="admin/codes-acces" element={<CodesAccesPage />} />
          <Route path="admin/parametres" element={<ParametresPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
