import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "./components/AuthProvider";
import { useAuth } from "./lib/auth-context";
import { ROLE_HOME } from "./lib/types";
import { AGENT_MFA_ENFORCED, isAgentRole } from "./lib/auth-policy";

const LyceeConnectPrototype = lazy(() => import("./pages/prototype/LyceeConnectPrototype"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const MfaSecurityPage = lazy(() => import("./pages/MfaSecurityPage"));
const AppLayout = lazy(() => import("./components/AppLayout"));
const StagesDashboard = lazy(() => import("./pages/stages/StagesDashboard"));
const MonStage = lazy(() => import("./pages/stages/MonStage"));
const StageDetail = lazy(() => import("./pages/stages/StageDetail"));
const LivretStage = lazy(() => import("./pages/stages/LivretStage"));
const GrandOralDashboard = lazy(() => import("./pages/grand-oral/GrandOralDashboard"));
const MaFiche = lazy(() => import("./pages/grand-oral/MaFiche"));
const FicheDetail = lazy(() => import("./pages/grand-oral/FicheDetail"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const ImportPage = lazy(() => import("./pages/admin/ImportPage"));
const ParametresPage = lazy(() => import("./pages/admin/ParametresPage"));
const CodesAccesPage = lazy(() => import("./pages/admin/CodesAccesPage"));
const CodesProfsPage = lazy(() => import("./pages/admin/CodesProfsPage"));
const AffectationsClassesPage = lazy(() => import("./pages/admin/AffectationsClassesPage"));
const AffectationsElevesPage = lazy(() => import("./pages/admin/AffectationsElevesPage"));
const DocumentsClassesPage = lazy(() => import("./pages/admin/DocumentsClassesPage"));
const ContentManagerPage = lazy(() => import("./pages/admin/ContentManagerPage"));

function PageFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50" aria-live="polite">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, assuranceLevel, nextAssuranceLevel } = useAuth();
  const location = useLocation();
  if (loading)
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  if (
    isAgentRole(user.role) &&
    (AGENT_MFA_ENFORCED || nextAssuranceLevel === "aal2") &&
    assuranceLevel !== "aal2"
  ) {
    const returnTo = `${location.pathname}${location.search}`;
    return (
      <Navigate
        to={`/security?returnTo=${encodeURIComponent(returnTo)}`}
        replace
      />
    );
  }
  return <>{children}</>;
}

function SignedInRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <PageFallback />;
  if (!user) return <Navigate to="/login?returnTo=%2Fsecurity" replace />;
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
      <Suspense fallback={<PageFallback />}>
        <Routes>
        <Route
          path="/prototype"
          element={
            <LyceeConnectPrototype />
          }
        />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/security"
          element={
            <SignedInRoute>
              <MfaSecurityPage />
            </SignedInRoute>
          }
        />
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
          <Route path="stages/mon-stage/livret" element={<LivretStage />} />
          <Route path="stages/mon-stage" element={<MonStage />} />
          <Route path="stages/:eleveId/livret" element={<LivretStage />} />
          <Route path="stages/:eleveId" element={<StageDetail />} />
          <Route path="grand-oral" element={<GrandOralDashboard />} />
          <Route path="grand-oral/ma-fiche" element={<MaFiche />} />
          <Route path="grand-oral/:ficheId" element={<FicheDetail />} />
          <Route path="admin" element={<AdminDashboard />} />
          <Route path="admin/import" element={<ImportPage />} />
          <Route path="admin/codes-acces" element={<CodesAccesPage />} />
          <Route path="admin/codes-profs" element={<CodesProfsPage />} />
          <Route
            path="admin/affectations-classes"
            element={<AffectationsClassesPage />}
          />
          <Route
            path="admin/affectations-eleves"
            element={<AffectationsElevesPage />}
          />
          <Route
            path="admin/documents-classes"
            element={<DocumentsClassesPage />}
          />
          <Route path="admin/contenus" element={<ContentManagerPage />} />
          <Route path="admin/parametres" element={<ParametresPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}
