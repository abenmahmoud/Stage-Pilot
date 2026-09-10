import { lazy, Suspense, useEffect, useState } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "./components/AuthProvider";
import { EssufRadioProvider } from "./components/EssufRadioProvider";
import { PublicPortalWelcome } from "./components/PublicPortalWelcome";
import { useAuth } from "./lib/auth-context";
import { apiFetch } from "./lib/api";
import { ROLE_HOME } from "./lib/types";
import { isAgentRole } from "./lib/auth-policy";
import { servicePilotPasswordOnly } from "../shared/agent-pilot-access";
import {
  ADMINISTRATION_ROLES,
  CONTENT_MANAGER_ROLES,
  FLASH_PROPOSAL_ROLES,
  roleIsAllowed,
} from "../shared/role-access";
import type { LyceeGestRole } from "../shared/role-access";
import { isValidFlashValidationScreenAccessPayload } from "../shared/flash-payload-policy";
import {
  decideFlashValidationRoute,
  type FlashValidationScreenAccessState,
} from "../shared/flash-validation-route";

const LyceeConnectPrototype = lazy(() => import("./pages/prototype/LyceeConnectPrototype"));
const PublicContentPage = lazy(() => import("./pages/prototype/PublicContentPage"));
const ChromebookPage = lazy(() => import("./pages/prototype/ChromebookPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const MfaSecurityPage = lazy(() => import("./pages/MfaSecurityPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
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
const ServiceAccessPage = lazy(() => import("./pages/admin/ServiceAccessPage"));
const ParametresPage = lazy(() => import("./pages/admin/ParametresPage"));
const CodesAccesPage = lazy(() => import("./pages/admin/CodesAccesPage"));
const CodesProfsPage = lazy(() => import("./pages/admin/CodesProfsPage"));
const AffectationsClassesPage = lazy(() => import("./pages/admin/AffectationsClassesPage"));
const AffectationsElevesPage = lazy(() => import("./pages/admin/AffectationsElevesPage"));
const DocumentsClassesPage = lazy(() => import("./pages/admin/DocumentsClassesPage"));
const ContentManagerPage = lazy(() => import("./pages/admin/ContentManagerPage"));
const KnowledgeRegistryPage = lazy(() => import("./pages/admin/KnowledgeRegistryPage"));
const IdentityDirectoryPage = lazy(() => import("./pages/admin/IdentityDirectoryPage"));
const SupportOperationsPage = lazy(() => import("./pages/admin/SupportOperationsPage"));
const ScheduleImportPage = lazy(() => import("./pages/admin/ScheduleImportPage"));
const AgentApprovalsPage = lazy(() => import("./pages/admin/AgentApprovalsPage"));
const CommunicationsPage = lazy(() => import("./pages/admin/CommunicationsPage"));
const EnvoisNominatifsPage = lazy(() => import("./pages/admin/EnvoisNominatifsPage"));
const FlashProposalPage = lazy(() => import("./pages/admin/FlashProposalPage"));
const FlashValidationPage = lazy(() => import("./pages/admin/FlashValidationPage"));
const WeeklyBriefPage = lazy(() => import("./pages/admin/WeeklyBriefPage"));
const CoffreEntInactifPage = lazy(() => import("./pages/coffre/CoffreEntInactifPage"));

function PageFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50" aria-live="polite">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, assuranceLevel } = useAuth();
  const location = useLocation();
  if (loading)
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  if (!user) {
    const returnTo = `${location.pathname}${location.search}`;
    const mode = location.pathname.startsWith("/admin") ? "&mode=staff" : "";
    return (
      <Navigate
        to={`/login?returnTo=${encodeURIComponent(returnTo)}${mode}`}
        replace
      />
    );
  }
  if (
    isAgentRole(user.role) &&
    !servicePilotPasswordOnly(user.role, import.meta.env.VITE_AGENT_PILOT_PASSWORD_ONLY_UNTIL) &&
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
  if (!user) return <Navigate to="/login?returnTo=%2Fsecurity&mode=staff" replace />;
  return <>{children}</>;
}

function DashboardRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={ROLE_HOME[user.role]} replace />;
}

function RoleRoute({
  allowedRoles,
  children,
}: {
  allowedRoles: readonly LyceeGestRole[];
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login?mode=staff" replace />;
  if (!roleIsAllowed(user.role, allowedRoles)) {
    return <Navigate to={ROLE_HOME[user.role]} replace />;
  }
  return <>{children}</>;
}

// T071E (LOT 5 du plan de publication publique) : la porte de l'écran de
// validation des informations flash repose sur le service réellement
// accordé (`referent_numerique`/`ddfpt`, ou superadmin), jamais sur le rôle
// applicatif — même règle que la file et les décisions serveur
// (`assertFlashValidationQueueAccess`/`assertFlashValidationAccess`,
// api/_shared/flash-access.ts). Le serveur reste seul à décider
// (`GET /api/flash/validation/screen-access`) : cette route ne fait
// qu'attendre sa réponse et choisir quoi afficher pendant/après, via la
// fonction pure `decideFlashValidationRoute` (shared/flash-validation-route.ts).
// Une réponse invalide ou une erreur réseau ferme l'écran (échec fermé),
// elle ne l'ouvre jamais.
function FlashValidationRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [access, setAccess] = useState<FlashValidationScreenAccessState>({ status: "loading" });

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setAccess({ status: "loading" });
    apiFetch<unknown>("flash/validation/screen-access")
      .then((payload) => {
        if (cancelled) return;
        const allowed = isValidFlashValidationScreenAccessPayload(payload) && payload.allowed;
        setAccess({ status: "checked", allowed });
      })
      .catch(() => {
        if (!cancelled) setAccess({ status: "checked", allowed: false });
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const decision = decideFlashValidationRoute({
    user,
    authLoading: loading,
    access,
    roleHome: ROLE_HOME,
  });

  if (decision.kind === "wait") return <PageFallback />;
  if (decision.kind === "redirect") return <Navigate to={decision.to} replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <EssufRadioProvider>
      <Suspense fallback={<PageFallback />}>
        <Routes>
        <Route path="/" element={<LyceeConnectPrototype />} />
        <Route
          path="/prototype"
          element={
            <LyceeConnectPrototype />
          }
        />
        <Route path="/chromebook" element={<ChromebookPage />} />
        <Route path="/site/chromebook" element={<Navigate to="/chromebook" replace />} />
        <Route path="/site/:slug" element={<PublicContentPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route
          path="/security"
          element={
            <SignedInRoute>
              <MfaSecurityPage />
            </SignedInRoute>
          }
        />
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardRedirect />} />
        </Route>
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<DashboardRedirect />} />
          <Route path="stages" element={<StagesDashboard />} />
          <Route path="stages/mon-stage/livret" element={<LivretStage />} />
          <Route path="stages/mon-stage" element={<MonStage />} />
          <Route path="stages/:eleveId/livret" element={<LivretStage />} />
          <Route path="stages/:eleveId" element={<StageDetail />} />
          <Route path="grand-oral" element={<GrandOralDashboard />} />
          <Route path="grand-oral/ma-fiche" element={<MaFiche />} />
          <Route path="grand-oral/:ficheId" element={<FicheDetail />} />
          <Route
            path="coffre/ent-inactif"
            element={
              <RoleRoute allowedRoles={["eleve", "professeur"]}>
                <CoffreEntInactifPage />
              </RoleRoute>
            }
          />
          <Route
            path="admin"
            element={
              <RoleRoute allowedRoles={ADMINISTRATION_ROLES}>
                <AdminDashboard />
              </RoleRoute>
            }
          />
          <Route
            path="admin/import"
            element={
              <RoleRoute allowedRoles={ADMINISTRATION_ROLES}>
                <ImportPage />
              </RoleRoute>
            }
          />
          <Route
            path="admin/codes-acces"
            element={
              <RoleRoute allowedRoles={ADMINISTRATION_ROLES}>
                <CodesAccesPage />
              </RoleRoute>
            }
          />
          <Route
            path="admin/codes-profs"
            element={
              <RoleRoute allowedRoles={ADMINISTRATION_ROLES}>
                <CodesProfsPage />
              </RoleRoute>
            }
          />
          <Route
            path="admin/affectations-classes"
            element={
              <RoleRoute allowedRoles={ADMINISTRATION_ROLES}>
                <AffectationsClassesPage />
              </RoleRoute>
            }
          />
          <Route
            path="admin/affectations-eleves"
            element={
              <RoleRoute allowedRoles={ADMINISTRATION_ROLES}>
                <AffectationsElevesPage />
              </RoleRoute>
            }
          />
          <Route
            path="admin/documents-classes"
            element={
              <RoleRoute allowedRoles={ADMINISTRATION_ROLES}>
                <DocumentsClassesPage />
              </RoleRoute>
            }
          />
          <Route
            path="admin/contenus"
            element={
              <RoleRoute allowedRoles={CONTENT_MANAGER_ROLES}>
                <ContentManagerPage />
              </RoleRoute>
            }
          />
          <Route
            path="admin/hebdo"
            element={
              <RoleRoute allowedRoles={CONTENT_MANAGER_ROLES}>
                <WeeklyBriefPage />
              </RoleRoute>
            }
          />
          <Route
            path="admin/communications"
            element={
              <RoleRoute allowedRoles={CONTENT_MANAGER_ROLES}>
                <CommunicationsPage />
              </RoleRoute>
            }
          />
          <Route
            path="admin/envois-nominatifs"
            element={
              <RoleRoute allowedRoles={CONTENT_MANAGER_ROLES}>
                <EnvoisNominatifsPage />
              </RoleRoute>
            }
          />
          <Route
            path="admin/informations-flash/proposer"
            element={
              <RoleRoute allowedRoles={FLASH_PROPOSAL_ROLES}>
                <FlashProposalPage />
              </RoleRoute>
            }
          />
          <Route
            path="admin/informations-flash/valider"
            element={
              <FlashValidationRoute>
                <FlashValidationPage />
              </FlashValidationRoute>
            }
          />
          <Route
            path="admin/connaissances-agent"
            element={
              <RoleRoute allowedRoles={["superadmin", "proviseur"]}>
                <KnowledgeRegistryPage />
              </RoleRoute>
            }
          />
          <Route
            path="admin/repertoire-identites"
            element={
              <RoleRoute allowedRoles={["superadmin", "proviseur"]}>
                <IdentityDirectoryPage />
              </RoleRoute>
            }
          />
          <Route
            path="admin/sante-demandes"
            element={
              <RoleRoute allowedRoles={["superadmin", "proviseur"]}>
                <SupportOperationsPage />
              </RoleRoute>
            }
          />
          <Route
            path="admin/validations-agent"
            element={
              <RoleRoute allowedRoles={["superadmin", "proviseur", "administration", "agent"]}>
                <AgentApprovalsPage />
              </RoleRoute>
            }
          />
          <Route
            path="admin/emplois-du-temps"
            element={
              <RoleRoute allowedRoles={["superadmin", "proviseur"]}>
                <ScheduleImportPage />
              </RoleRoute>
            }
          />
          <Route path="admin/services" element={<RoleRoute allowedRoles={["superadmin", "proviseur"]}><ServiceAccessPage /></RoleRoute>} />
          <Route
            path="admin/parametres"
            element={
              <RoleRoute allowedRoles={CONTENT_MANAGER_ROLES}>
                <ParametresPage />
              </RoleRoute>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <PublicPortalWelcome />
      </EssufRadioProvider>
    </AuthProvider>
  );
}
