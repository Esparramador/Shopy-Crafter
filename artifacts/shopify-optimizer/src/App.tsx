import { useRef, useEffect, lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/AppLayout";
import { AuthProvider, useAuth, getLastRoute, saveLastRoute, clearLastRoute } from "@/contexts/AuthContext";
import { CmsProvider } from "@/contexts/CmsContext";
import { ClientPreviewProvider } from "@/pages/client/ClientPreviewContext";
import { Loader2 } from "lucide-react";
import SCCursor from "@/components/ui/SCCursor";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { initGlobalErrorHandlers } from "@/lib/global-error-handler";

const Home = lazy(() => import("@/pages/Home"));
const NewProject = lazy(() => import("@/pages/NewProject"));
const Landing = lazy(() => import("@/pages/Landing"));
const Tienda = lazy(() => import("@/pages/Tienda"));
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword"));
const OAuthSuccess = lazy(() => import("@/pages/OAuthSuccess"));
const LoginPage = lazy(() => import("@/pages/Login"));
const InviteSetupPage = lazy(() => import("@/pages/InviteSetup"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const HelpConnections = lazy(() => import("@/pages/HelpConnections"));
const NotFound = lazy(() => import("@/pages/not-found"));
const AdminClients = lazy(() => import("@/pages/AdminClients"));

const CMSEditor = lazy(() => import("@/pages/admin/CMSEditor"));
const Intelligence = lazy(() => import("@/pages/admin/Intelligence"));
const GeminiIntelligence = lazy(() => import("@/pages/admin/GeminiIntelligence"));
const Inventory = lazy(() => import("@/pages/admin/Inventory"));
const Achievements = lazy(() => import("@/pages/admin/Achievements"));
const Roadmap = lazy(() => import("@/pages/admin/Roadmap"));
const ApkManager = lazy(() => import("@/pages/admin/ApkManager"));
const Competitors = lazy(() => import("@/pages/admin/Competitors"));
const Revenue = lazy(() => import("@/pages/admin/Revenue"));
const Forecast = lazy(() => import("@/pages/admin/Forecast"));
const SystemHealth = lazy(() => import("@/pages/admin/SystemHealth"));
const ShopyBrain = lazy(() => import("@/pages/admin/ShopyBrain"));
const ShopyBrainMemories = lazy(() => import("@/pages/admin/ShopyBrainMemories"));
const ShopyBrainInsights = lazy(() => import("@/pages/admin/ShopyBrainInsights"));
const ShopyBrainStudy = lazy(() => import("@/pages/admin/ShopyBrainStudy"));
const MyPricing = lazy(() => import("@/pages/admin/MyPricing"));
const CommandCenter = lazy(() => import("@/pages/admin/CommandCenter"));
const Emails = lazy(() => import("@/pages/admin/Emails"));
const EmailTemplates = lazy(() => import("@/pages/admin/EmailTemplates"));
const ProjectVault = lazy(() => import("@/pages/admin/ProjectVault"));
const GlobalVault = lazy(() => import("@/pages/admin/GlobalVault"));
const UniversalSearch = lazy(() => import("@/pages/admin/UniversalSearch"));
const AdminSettings = lazy(() => import("@/pages/admin/AdminSettings"));
const AdminMessages = lazy(() => import("@/pages/admin/AdminMessages"));
const AdminProducts = lazy(() => import("@/pages/admin/AdminProducts"));
const AdminABTests = lazy(() => import("@/pages/admin/AdminABTests"));
const AdminAutomations = lazy(() => import("@/pages/admin/AdminAutomations"));
const TemplateStudio = lazy(() => import("@/pages/admin/TemplateStudio"));
const Billing = lazy(() => import("@/pages/admin/Billing"));
const BrainSync = lazy(() => import("@/pages/admin/BrainSync"));
const AdStudio = lazy(() => import("@/pages/projects/AdStudio"));
const AvatarStudio = lazy(() => import("@/pages/admin/AvatarStudio"));
const PromptLibrary = lazy(() => import("@/pages/admin/PromptLibrary"));

const SobreNosotros = lazy(() => import("@/pages/public/SobreNosotros"));
const CasosDeExito = lazy(() => import("@/pages/public/CasosDeExito"));
const ProgramaAfiliados = lazy(() => import("@/pages/public/ProgramaAfiliados"));
const FAQPage = lazy(() => import("@/pages/public/FAQ"));
const BlogPage = lazy(() => import("@/pages/public/Blog"));
const BlogPostPage = lazy(() => import("@/pages/public/BlogPost"));
const ChangelogPage = lazy(() => import("@/pages/public/Changelog"));
const ChangelogReleasePage = lazy(() => import("@/pages/public/ChangelogRelease"));
const CasoDeExitoDetailPage = lazy(() => import("@/pages/public/CasoDeExitoDetail"));
const PrivacidadPage = lazy(() => import("@/pages/public/Privacidad"));
const TerminosPage = lazy(() => import("@/pages/public/Terminos"));
const CookiesPage = lazy(() => import("@/pages/public/Cookies"));
const ContactoPage = lazy(() => import("@/pages/public/Contacto"));

const AuditPage = lazy(() => import("@/pages/projects/Audit"));
const RedesignPage = lazy(() => import("@/pages/projects/Redesign"));
const ImagesPage = lazy(() => import("@/pages/projects/Images"));
const ConsistencyPage = lazy(() => import("@/pages/projects/Consistency"));
const ABTestingPage = lazy(() => import("@/pages/projects/ABTesting"));
const PricingPage = lazy(() => import("@/pages/projects/Pricing"));
const SEOPage = lazy(() => import("@/pages/projects/SEO"));
const SettingsPage = lazy(() => import("@/pages/projects/Settings"));
const ExportCenter = lazy(() => import("@/pages/projects/ExportCenter"));
const UniversalGenerator = lazy(() => import("@/pages/projects/UniversalGenerator"));
const Suppliers = lazy(() => import("@/pages/projects/Suppliers"));
const WebLab = lazy(() => import("@/pages/projects/WebLab"));
const FusionStudio = lazy(() => import("@/pages/projects/FusionStudio"));
const FusionStudioPro = lazy(() => import("@/pages/projects/FusionStudioPro"));
const CardStudio = lazy(() => import("@/pages/projects/CardStudio"));
const CampaignKit = lazy(() => import("@/pages/projects/CampaignKit"));
const ExplodedViewStudio = lazy(() => import("@/pages/projects/ExplodedViewStudio"));
const Tripo3DStudio = lazy(() => import("@/pages/projects/Tripo3DStudio"));
const MeshyStudio = lazy(() => import("@/pages/projects/MeshyStudio"));
const WebDesigner = lazy(() => import("@/pages/admin/WebDesigner"));
const EffectsStudio = lazy(() => import("@/pages/admin/EffectsStudio"));
const MCPManager = lazy(() => import("@/pages/admin/MCPManager"));
const AMRStudio = lazy(() => import("@/pages/admin/AMRStudio"));
const SkillsLibrary = lazy(() => import("@/pages/admin/SkillsLibrary"));
const DesignSystems = lazy(() => import("@/pages/admin/DesignSystems"));
const PluginsCatalog = lazy(() => import("@/pages/admin/PluginsCatalog"));
const HyperFrames = lazy(() => import("@/pages/admin/HyperFrames"));
const DeckBuilder = lazy(() => import("@/pages/admin/DeckBuilder"));

const ClientDashboard = lazy(() => import("@/pages/client/ClientDashboard"));
const ClientApprovals = lazy(() => import("@/pages/client/ClientApprovals"));
const ClientMessages = lazy(() => import("@/pages/client/ClientMessages"));
const ClientProducts = lazy(() => import("@/pages/client/ClientProducts"));
const ClientReports = lazy(() => import("@/pages/client/ClientReports"));

const VoiceButton = lazy(() => import("@/components/VoiceButton").then(m => ({ default: m.VoiceButton })));
const CommandPalette = lazy(() => import("@/components/CommandPalette").then(m => ({ default: m.CommandPalette })));
const OnboardingWidget = lazy(() => import("@/components/OnboardingWidget").then(m => ({ default: m.OnboardingWidget })));
const CoachMarks = lazy(() => import("@/components/CoachMarks").then(m => ({ default: m.CoachMarks })));
const OmniChatbot = lazy(() => import("@/components/OmniChatbot"));
const LandingChatbot = lazy(() => import("@/components/LandingChatbot"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error instanceof Error && error.message.includes("401")) return false;
        return failureCount < 2;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
      retryDelay: 2000,
    },
  },
});

function PageLoader() {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      height: "60vh", color: "var(--t3)", fontSize: 13,
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 24, marginBottom: 8, animation: "pulseGold 1.5s ease-in-out infinite" }}>⚡</div>
        <div>Cargando...</div>
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--ink)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Loader2 size={28} style={{ color: "var(--gold)", animation: "spin 0.6s linear infinite" }} />
    </div>
  );
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Redirect to="/" />;
  if (user.role !== "admin") return <Redirect to="/client" />;
  return <>{children}</>;
}

function RequireClient({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Redirect to="/" />;
  // Admin can access client panel in preview / impersonation mode
  return <>{children}</>;
}

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Suspense fallback={<PageLoader />}><Landing /></Suspense>;
  if (user.role === "client") return <Redirect to="/client" />;
  const saved = getLastRoute();
  if (saved && saved !== "/" && saved !== "/login") {
    clearLastRoute();
    return <Redirect to={saved} />;
  }
  return <Redirect to="/home" />;
}

function ImpersonationBanner() {
  const { user, refresh } = useAuth();
  const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

  if (!user?.impersonating) return null;

  const stopImpersonating = async () => {
    try {
      await fetch(`${API_BASE}/api/auth/stop-impersonate`, { method: "POST", credentials: "include" });
      await refresh();
      window.location.href = "/";
    } catch {}
  };

  return (
    <div style={{
      position: "fixed", top: 2, left: 0, right: 0, zIndex: 9000,
      background: "var(--crim)", color: "white", fontSize: 12,
      padding: "8px 16px",
      display: "flex", alignItems: "center", justifyContent: "space-between",
    }}>
      <span>👁 Viendo como cliente — modo impersonación</span>
      <button
        onClick={stopImpersonating}
        style={{ background: "none", border: "none", color: "white", cursor: "pointer", textDecoration: "underline", fontWeight: 600, fontSize: 12 }}
      >
        Salir y volver al admin
      </button>
    </div>
  );
}

function PageErrorBoundary({ children }: { children: React.ReactNode }) {
  return <ErrorBoundary fallbackRoute="/home">{children}</ErrorBoundary>;
}

function AdminWrapper({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return (
    <>
      <PageErrorBoundary>{children}</PageErrorBoundary>
      {user?.role === "admin" && (
        <Suspense fallback={null}>
          <VoiceButton />
          <OnboardingWidget />
          <CoachMarks />
        </Suspense>
      )}
    </>
  );
}

function AdminOnlyExtras() {
  const { user } = useAuth();
  if (!user || user.role !== "admin") return null;
  return <Suspense fallback={null}><CommandPalette /></Suspense>;
}

function RoutePersistence() {
  const [location] = useLocation();
  const { user } = useAuth();
  const lastSaved = useRef("");
  useEffect(() => {
    if (user && location !== lastSaved.current) {
      lastSaved.current = location;
      saveLastRoute(location);
    }
  }, [location, user]);
  return null;
}

function S({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>;
}

function Router() {
  return (
    <>
      <RoutePersistence />
      <ImpersonationBanner />
      <AdminOnlyExtras />
      <Switch>
        {/* Public */}
        <Route path="/login">{() => <S><LoginPage /></S>}</Route>
        <Route path="/forgot-password">{() => <S><ForgotPassword /></S>}</Route>
        <Route path="/reset-password">{() => <S><ResetPassword /></S>}</Route>
        <Route path="/invite/:token">{() => <S><InviteSetupPage /></S>}</Route>
        <Route path="/tienda">{() => <S><Tienda /></S>}</Route>
        <Route path="/oauth-success">{() => <S><OAuthSuccess /></S>}</Route>

        {/* Landing */}
        <Route path="/landing">{() => <S><Landing /></S>}</Route>

        {/* Public pages */}
        <Route path="/sobre-nosotros">{() => <S><SobreNosotros /></S>}</Route>
        <Route path="/casos-de-exito">{() => <S><CasosDeExito /></S>}</Route>
        <Route path="/casos-de-exito/:slug">{() => <S><CasoDeExitoDetailPage /></S>}</Route>
        <Route path="/programa-de-afiliados">{() => <S><ProgramaAfiliados /></S>}</Route>
        <Route path="/faq">{() => <S><FAQPage /></S>}</Route>
        <Route path="/blog">{() => <S><BlogPage /></S>}</Route>
        <Route path="/blog/:slug">{() => <S><BlogPostPage /></S>}</Route>
        <Route path="/changelog">{() => <S><ChangelogPage /></S>}</Route>
        <Route path="/changelog/:version">{() => <S><ChangelogReleasePage /></S>}</Route>
        <Route path="/privacidad">{() => <S><PrivacidadPage /></S>}</Route>
        <Route path="/terminos">{() => <S><TerminosPage /></S>}</Route>
        <Route path="/cookies">{() => <S><CookiesPage /></S>}</Route>
        <Route path="/contacto">{() => <S><ContactoPage /></S>}</Route>

        {/* Root — redirects by role */}
        <Route path="/">
          <HomeRedirect />
        </Route>

        {/* Admin home */}
        <Route path="/home">
          <RequireAdmin><AppLayout><S><Home /></S></AppLayout></RequireAdmin>
        </Route>

        {/* Admin base redirects */}
        <Route path="/admin">
          <RequireAdmin><Redirect to="/admin/clients" /></RequireAdmin>
        </Route>
        <Route path="/admin/projects">
          <RequireAdmin><Redirect to="/home" /></RequireAdmin>
        </Route>
        <Route path="/dashboard">
          <RequireAdmin><Redirect to="/admin/clients" /></RequireAdmin>
        </Route>

        {/* Admin routes */}
        <Route path="/new-project">
          <RequireAdmin><AdminWrapper><AppLayout><S><NewProject /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/help/connections">
          <RequireAdmin><AdminWrapper><AppLayout><S><HelpConnections /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/admin/clients">
          <RequireAdmin><AdminWrapper><AppLayout><S><AdminClients /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/admin/messages">
          <RequireAdmin><AdminWrapper><S><AdminMessages /></S></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/admin/cms">
          <RequireAdmin><S><CMSEditor /></S></RequireAdmin>
        </Route>
        <Route path="/admin/intelligence">
          <RequireAdmin><AdminWrapper><AppLayout><S><Intelligence /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/admin/gemini-intel">
          <RequireAdmin><AppLayout><S><GeminiIntelligence /></S></AppLayout></RequireAdmin>
        </Route>
        <Route path="/admin/inventory">
          <RequireAdmin><AdminWrapper><AppLayout><S><Inventory /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/admin/achievements">
          <RequireAdmin><AdminWrapper><AppLayout><S><Achievements /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/admin/roadmap">
          <RequireAdmin><AdminWrapper><AppLayout><S><Roadmap /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/admin/command-center">
          <RequireAdmin><AdminWrapper><AppLayout><S><CommandCenter /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/admin/apk">
          <RequireAdmin><AdminWrapper><AppLayout><S><ApkManager /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/admin/competitors">
          <RequireAdmin><AdminWrapper><AppLayout><S><Competitors /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/admin/revenue">
          <RequireAdmin><AdminWrapper><AppLayout><S><Revenue /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/admin/forecast">
          <RequireAdmin><AdminWrapper><AppLayout><S><Forecast /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/admin/system">
          <RequireAdmin><AdminWrapper><AppLayout><S><SystemHealth /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/admin/mcp-manager">
          <RequireAdmin><AdminWrapper><AppLayout><S><MCPManager /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/admin/vault">
          <RequireAdmin><AdminWrapper><AppLayout><S><GlobalVault /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/admin/search">
          <RequireAdmin><AdminWrapper><AppLayout><S><UniversalSearch /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/admin/template-studio">
          <RequireAdmin><AdminWrapper><AppLayout><S><TemplateStudio /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/admin/avatar-studio">
          <RequireAdmin><AdminWrapper><AppLayout><S><AvatarStudio /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/admin/meshy-studio">
          <RequireAdmin><AdminWrapper><AppLayout><S><MeshyStudio /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/admin/prompt-library">
          <RequireAdmin><AdminWrapper><AppLayout><S><PromptLibrary /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/admin/shopybrain/memories">
          <RequireAdmin><AdminWrapper><AppLayout><S><ShopyBrainMemories /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/admin/shopybrain/insights">
          <RequireAdmin><AdminWrapper><AppLayout><S><ShopyBrainInsights /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/admin/shopybrain/study">
          <RequireAdmin><AdminWrapper><AppLayout><S><ShopyBrainStudy /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/admin/shopybrain">
          <RequireAdmin><AdminWrapper><AppLayout><S><ShopyBrain /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/admin/my-pricing">
          <RequireAdmin><AdminWrapper><AppLayout><S><MyPricing /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/admin/emails">
          <RequireAdmin><AdminWrapper><AppLayout><S><EmailTemplates /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/admin/email-flows">
          <RequireAdmin><AdminWrapper><AppLayout><S><Emails /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/admin/settings">
          <RequireAdmin><AdminWrapper><AppLayout><S><AdminSettings /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/admin/billing">
          <RequireAdmin><AdminWrapper><AppLayout><S><Billing /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/admin/brain-sync">
          <RequireAdmin><AdminWrapper><AppLayout><S><BrainSync /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/admin/products">
          <RequireAdmin><AdminWrapper><AppLayout><S><AdminProducts /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/admin/abtests">
          <RequireAdmin><AdminWrapper><AppLayout><S><AdminABTests /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/admin/automations">
          <RequireAdmin><AdminWrapper><AppLayout><S><AdminAutomations /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>

        {/* Base project route → audit */}
        <Route path="/project/:id">
          {(params) => <Redirect to={`/projects/${params.id}/audit`} />}
        </Route>
        <Route path="/projects/:id">
          {(params) => <Redirect to={`/projects/${params.id}/audit`} />}
        </Route>

        <Route path="/projects/:id/audit">
          <RequireAdmin><AdminWrapper><AppLayout><S><AuditPage /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/projects/:id/redesign">
          <RequireAdmin><AdminWrapper><AppLayout><S><RedesignPage /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/projects/:id/images">
          <RequireAdmin><AdminWrapper><AppLayout><S><ImagesPage /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/projects/:id/consistency">
          <RequireAdmin><AdminWrapper><AppLayout><S><ConsistencyPage /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/projects/:id/ab-testing">
          <RequireAdmin><AdminWrapper><AppLayout><S><ABTestingPage /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/projects/:id/pricing">
          <RequireAdmin><AdminWrapper><AppLayout><S><PricingPage /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/projects/:id/seo">
          <RequireAdmin><AdminWrapper><AppLayout><S><SEOPage /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/projects/:id/settings">
          <RequireAdmin><AdminWrapper><AppLayout><S><SettingsPage /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>

        <Route path="/projects/:id/vault">
          <RequireAdmin><AdminWrapper><AppLayout><S><ProjectVault /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>

        <Route path="/projects/:id/exports">
          {(params: { id: string }) => (
            <RequireAdmin>
              <AdminWrapper>
                <AppLayout><S><ExportCenter projectId={parseInt(params.id)} /></S></AppLayout>
              </AdminWrapper>
            </RequireAdmin>
          )}
        </Route>

        <Route path="/projects/:id/generator">
          <RequireAdmin><AdminWrapper><AppLayout><S><UniversalGenerator /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>

        <Route path="/projects/:id/suppliers">
          <RequireAdmin><AdminWrapper><AppLayout><S><Suppliers /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>

        <Route path="/projects/:id/web-lab">
          <RequireAdmin><AdminWrapper><AppLayout><S><WebLab /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/projects/:id/fusion-studio">
          <RequireAdmin><AdminWrapper><AppLayout><S><FusionStudio /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/projects/:id/fusion-studio-pro">
          <RequireAdmin><AdminWrapper><AppLayout><S><FusionStudioPro /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/projects/:id/ad-studio">
          <RequireAdmin><AdminWrapper><AppLayout><S><AdStudio /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/projects/:id/cards">
          <RequireAdmin><AdminWrapper><AppLayout><S><CardStudio /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/projects/:id/campaign-kit">
          <RequireAdmin><AdminWrapper><AppLayout><S><CampaignKit /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/projects/:id/exploded-view">
          <RequireAdmin><AdminWrapper><AppLayout><S><ExplodedViewStudio /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/projects/:id/tripo3d">
          <RequireAdmin><AdminWrapper><AppLayout><S><Tripo3DStudio /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/projects/:id/meshy">
          <RequireAdmin><AdminWrapper><AppLayout><S><MeshyStudio /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/projects/:id/web-designer">
          <RequireAdmin><AdminWrapper><AppLayout><S><WebDesigner /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/web-designer">
          <RequireAdmin><AdminWrapper><AppLayout><S><WebDesigner /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/projects/:id/effects-studio">
          <RequireAdmin><AdminWrapper><AppLayout><S><EffectsStudio /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/effects-studio">
          <RequireAdmin><AdminWrapper><AppLayout><S><EffectsStudio /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        {/* Standalone module routes (sin proyecto) */}
        <Route path="/audit">
          <RequireAdmin><AdminWrapper><AppLayout><S><AuditPage /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/redesign">
          <RequireAdmin><AdminWrapper><AppLayout><S><RedesignPage /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/images">
          <RequireAdmin><AdminWrapper><AppLayout><S><ImagesPage /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/consistency">
          <RequireAdmin><AdminWrapper><AppLayout><S><ConsistencyPage /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/ab-testing">
          <RequireAdmin><AdminWrapper><AppLayout><S><ABTestingPage /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/pricing">
          <RequireAdmin><AdminWrapper><AppLayout><S><PricingPage /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/seo">
          <RequireAdmin><AdminWrapper><AppLayout><S><SEOPage /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/vault">
          <RequireAdmin><AdminWrapper><AppLayout><S><ProjectVault /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/exports">
          <RequireAdmin><AdminWrapper><AppLayout><S><ExportCenter projectId={0} /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/generator">
          <RequireAdmin><AdminWrapper><AppLayout><S><UniversalGenerator /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/suppliers">
          <RequireAdmin><AdminWrapper><AppLayout><S><Suppliers /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/web-lab">
          <RequireAdmin><AdminWrapper><AppLayout><S><WebLab /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/fusion-studio">
          <RequireAdmin><AdminWrapper><AppLayout><S><FusionStudio /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/fusion-studio-pro">
          <RequireAdmin><AdminWrapper><AppLayout><S><FusionStudioPro /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/cards">
          <RequireAdmin><AdminWrapper><AppLayout><S><CardStudio /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/campaign-kit">
          <RequireAdmin><AdminWrapper><AppLayout><S><CampaignKit /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/exploded-view">
          <RequireAdmin><AdminWrapper><AppLayout><S><ExplodedViewStudio /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/ad-studio">
          <RequireAdmin><AdminWrapper><AppLayout><S><AdStudio /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>

        {/* Studio IA routes */}
        <Route path="/admin/amr-studio">
          <RequireAdmin><AdminWrapper><AppLayout><S><AMRStudio /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/admin/skills-library">
          <RequireAdmin><AdminWrapper><AppLayout><S><SkillsLibrary /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/admin/design-systems">
          <RequireAdmin><AdminWrapper><AppLayout><S><DesignSystems /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/admin/plugins-catalog">
          <RequireAdmin><AdminWrapper><AppLayout><S><PluginsCatalog /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/admin/hyperframes">
          <RequireAdmin><AdminWrapper><AppLayout><S><HyperFrames /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>
        <Route path="/admin/deck-builder">
          <RequireAdmin><AdminWrapper><AppLayout><S><DeckBuilder /></S></AppLayout></AdminWrapper></RequireAdmin>
        </Route>

        {/* Client routes */}
        <ClientPreviewProvider>
          <Route path="/client">
            <RequireClient><S><ClientDashboard /></S></RequireClient>
          </Route>
          <Route path="/client/products">
            <RequireClient><S><ClientProducts /></S></RequireClient>
          </Route>
          <Route path="/client/approvals">
            <RequireClient><S><ClientApprovals /></S></RequireClient>
          </Route>
          <Route path="/client/messages">
            <RequireClient><S><ClientMessages /></S></RequireClient>
          </Route>
          <Route path="/client/reports">
            <RequireClient><S><ClientReports /></S></RequireClient>
          </Route>
        </ClientPreviewProvider>

        <Route>{() => <S><NotFound /></S>}</Route>
      </Switch>
    </>
  );
}

initGlobalErrorHandlers();

function PublicChatbotSlot() {
  const { user, loading } = useAuth();
  if (loading || user) return null;
  return (
    <Suspense fallback={null}>
      <LandingChatbot />
    </Suspense>
  );
}

function AdminOmniChatbotSlot() {
  const { user, loading } = useAuth();
  if (loading || user?.role !== "admin") return null;
  return (
    <Suspense fallback={null}>
      <OmniChatbot />
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <CmsProvider>
            <AuthProvider>
              <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                <Router />
                <AdminOmniChatbotSlot />
                <PublicChatbotSlot />
              </WouterRouter>
            </AuthProvider>
          </CmsProvider>
          <SCCursor />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
