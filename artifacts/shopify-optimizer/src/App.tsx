import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/AppLayout";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

import Home from "@/pages/Home";
import NewProject from "@/pages/NewProject";
import Landing from "@/pages/Landing";
import CMSEditor from "@/pages/admin/CMSEditor";
import Intelligence from "@/pages/admin/Intelligence";
import GeminiIntelligence from "@/pages/admin/GeminiIntelligence";
import Inventory from "@/pages/admin/Inventory";
import Achievements from "@/pages/admin/Achievements";
import Roadmap from "@/pages/admin/Roadmap";
import ApkManager from "@/pages/admin/ApkManager";
import Competitors from "@/pages/admin/Competitors";
import Revenue from "@/pages/admin/Revenue";
import Tienda from "@/pages/Tienda";
import Forecast from "@/pages/admin/Forecast";
import SystemHealth from "@/pages/admin/SystemHealth";
import ShopyBrain from "@/pages/admin/ShopyBrain";
import ShopyBrainMemories from "@/pages/admin/ShopyBrainMemories";
import ShopyBrainInsights from "@/pages/admin/ShopyBrainInsights";
import ShopyBrainStudy from "@/pages/admin/ShopyBrainStudy";
import MyPricing from "@/pages/admin/MyPricing";
import Emails from "@/pages/admin/Emails";
import ProjectVault from "@/pages/admin/ProjectVault";
import ForgotPassword from "@/pages/ForgotPassword";
import OAuthSuccess from "@/pages/OAuthSuccess";
import AuditPage from "@/pages/projects/Audit";
import RedesignPage from "@/pages/projects/Redesign";
import ImagesPage from "@/pages/projects/Images";
import ConsistencyPage from "@/pages/projects/Consistency";
import ABTestingPage from "@/pages/projects/ABTesting";
import PricingPage from "@/pages/projects/Pricing";
import SEOPage from "@/pages/projects/SEO";
import SettingsPage from "@/pages/projects/Settings";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/Login";
import InviteSetupPage from "@/pages/InviteSetup";
import AdminClients from "@/pages/AdminClients";
import AdminSettings from "@/pages/admin/AdminSettings";

import ClientDashboard from "@/pages/client/ClientDashboard";
import ClientApprovals from "@/pages/client/ClientApprovals";
import ClientMessages from "@/pages/client/ClientMessages";
import ClientProducts from "@/pages/client/ClientProducts";

import { VoiceButton } from "@/components/VoiceButton";
import { CommandPalette } from "@/components/CommandPalette";
import { OnboardingWidget } from "@/components/OnboardingWidget";
import OmniChatbot from "@/components/OmniChatbot";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
  },
});

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
  if (user.role === "admin") return <Redirect to="/" />;
  return <>{children}</>;
}

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Landing />;
  if (user.role === "client") return <Redirect to="/client" />;
  return <Redirect to="/admin/clients" />;
}

function ImpersonationBanner() {
  const { user, refresh } = useAuth();
  const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

  if (!user?.impersonating) return null;

  const stopImpersonating = async () => {
    await fetch(`${API_BASE}/api/auth/stop-impersonate`, { method: "POST", credentials: "include" });
    await refresh();
    window.location.href = "/";
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

function AdminWrapper({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return (
    <>
      {children}
      {user?.role === "admin" && (
        <>
          <VoiceButton />
          <OnboardingWidget />
        </>
      )}
    </>
  );
}

function AdminOnlyExtras() {
  const { user } = useAuth();
  if (!user || user.role !== "admin") return null;
  return <CommandPalette />;
}

function Router() {
  return (
    <>
      <ImpersonationBanner />
      <AdminOnlyExtras />
      <Switch>
        {/* Public */}
        <Route path="/login" component={LoginPage} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/invite/:token" component={InviteSetupPage} />
        <Route path="/tienda" component={Tienda} />
        <Route path="/oauth-success" component={OAuthSuccess} />

        {/* Root — redirects by role */}
        <Route path="/">
          <HomeRedirect />
        </Route>

        {/* Admin home — projects dashboard */}
        <Route path="/home">
          <RequireAdmin><AppLayout><Home /></AppLayout></RequireAdmin>
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
          <RequireAdmin>
            <AdminWrapper>
              <AppLayout><NewProject /></AppLayout>
            </AdminWrapper>
          </RequireAdmin>
        </Route>

        <Route path="/admin/clients">
          <RequireAdmin>
            <AdminWrapper>
              <AppLayout><AdminClients /></AppLayout>
            </AdminWrapper>
          </RequireAdmin>
        </Route>
        <Route path="/admin/cms">
          <RequireAdmin><CMSEditor /></RequireAdmin>
        </Route>
        <Route path="/admin/intelligence">
          <RequireAdmin>
            <AdminWrapper>
              <AppLayout><Intelligence /></AppLayout>
            </AdminWrapper>
          </RequireAdmin>
        </Route>
        <Route path="/admin/gemini-intel">
          <RequireAdmin><AppLayout><GeminiIntelligence /></AppLayout></RequireAdmin>
        </Route>
        <Route path="/admin/inventory">
          <RequireAdmin>
            <AdminWrapper>
              <AppLayout><Inventory /></AppLayout>
            </AdminWrapper>
          </RequireAdmin>
        </Route>
        <Route path="/admin/achievements">
          <RequireAdmin>
            <AdminWrapper>
              <AppLayout><Achievements /></AppLayout>
            </AdminWrapper>
          </RequireAdmin>
        </Route>
        <Route path="/admin/roadmap">
          <RequireAdmin>
            <AdminWrapper>
              <AppLayout><Roadmap /></AppLayout>
            </AdminWrapper>
          </RequireAdmin>
        </Route>
        <Route path="/admin/apk">
          <RequireAdmin>
            <AdminWrapper>
              <AppLayout><ApkManager /></AppLayout>
            </AdminWrapper>
          </RequireAdmin>
        </Route>
        <Route path="/admin/competitors">
          <RequireAdmin>
            <AdminWrapper>
              <AppLayout><Competitors /></AppLayout>
            </AdminWrapper>
          </RequireAdmin>
        </Route>
        <Route path="/admin/revenue">
          <RequireAdmin>
            <AdminWrapper>
              <AppLayout><Revenue /></AppLayout>
            </AdminWrapper>
          </RequireAdmin>
        </Route>
        <Route path="/admin/forecast">
          <RequireAdmin>
            <AdminWrapper>
              <AppLayout><Forecast /></AppLayout>
            </AdminWrapper>
          </RequireAdmin>
        </Route>
        <Route path="/admin/system">
          <RequireAdmin>
            <AdminWrapper>
              <AppLayout><SystemHealth /></AppLayout>
            </AdminWrapper>
          </RequireAdmin>
        </Route>
        <Route path="/admin/shopybrain/memories">
          <RequireAdmin>
            <AdminWrapper>
              <AppLayout><ShopyBrainMemories /></AppLayout>
            </AdminWrapper>
          </RequireAdmin>
        </Route>
        <Route path="/admin/shopybrain/insights">
          <RequireAdmin>
            <AdminWrapper>
              <AppLayout><ShopyBrainInsights /></AppLayout>
            </AdminWrapper>
          </RequireAdmin>
        </Route>
        <Route path="/admin/shopybrain/study">
          <RequireAdmin>
            <AdminWrapper>
              <AppLayout><ShopyBrainStudy /></AppLayout>
            </AdminWrapper>
          </RequireAdmin>
        </Route>
        <Route path="/admin/shopybrain">
          <RequireAdmin>
            <AdminWrapper>
              <AppLayout><ShopyBrain /></AppLayout>
            </AdminWrapper>
          </RequireAdmin>
        </Route>
        <Route path="/admin/my-pricing">
          <RequireAdmin>
            <AdminWrapper>
              <AppLayout><MyPricing /></AppLayout>
            </AdminWrapper>
          </RequireAdmin>
        </Route>
        <Route path="/admin/emails">
          <RequireAdmin>
            <AdminWrapper>
              <AppLayout><Emails /></AppLayout>
            </AdminWrapper>
          </RequireAdmin>
        </Route>
        <Route path="/admin/settings">
          <RequireAdmin>
            <AdminWrapper>
              <AppLayout><AdminSettings /></AppLayout>
            </AdminWrapper>
          </RequireAdmin>
        </Route>

        {/* Base project route → audit */}
        <Route path="/project/:id">
          {(params) => <Redirect to={`/projects/${params.id}/audit`} />}
        </Route>
        <Route path="/projects/:id">
          {(params) => <Redirect to={`/projects/${params.id}/audit`} />}
        </Route>

        <Route path="/projects/:id/audit">
          <RequireAdmin>
            <AdminWrapper>
              <AppLayout><AuditPage /></AppLayout>
            </AdminWrapper>
          </RequireAdmin>
        </Route>
        <Route path="/projects/:id/redesign">
          <RequireAdmin>
            <AdminWrapper>
              <AppLayout><RedesignPage /></AppLayout>
            </AdminWrapper>
          </RequireAdmin>
        </Route>
        <Route path="/projects/:id/images">
          <RequireAdmin>
            <AdminWrapper>
              <AppLayout><ImagesPage /></AppLayout>
            </AdminWrapper>
          </RequireAdmin>
        </Route>
        <Route path="/projects/:id/consistency">
          <RequireAdmin>
            <AdminWrapper>
              <AppLayout><ConsistencyPage /></AppLayout>
            </AdminWrapper>
          </RequireAdmin>
        </Route>
        <Route path="/projects/:id/ab-testing">
          <RequireAdmin>
            <AdminWrapper>
              <AppLayout><ABTestingPage /></AppLayout>
            </AdminWrapper>
          </RequireAdmin>
        </Route>
        <Route path="/projects/:id/pricing">
          <RequireAdmin>
            <AdminWrapper>
              <AppLayout><PricingPage /></AppLayout>
            </AdminWrapper>
          </RequireAdmin>
        </Route>
        <Route path="/projects/:id/seo">
          <RequireAdmin>
            <AdminWrapper>
              <AppLayout><SEOPage /></AppLayout>
            </AdminWrapper>
          </RequireAdmin>
        </Route>
        <Route path="/projects/:id/settings">
          <RequireAdmin>
            <AdminWrapper>
              <AppLayout><SettingsPage /></AppLayout>
            </AdminWrapper>
          </RequireAdmin>
        </Route>

        <Route path="/projects/:id/vault">
          <RequireAdmin>
            <AdminWrapper>
              <AppLayout><ProjectVault /></AppLayout>
            </AdminWrapper>
          </RequireAdmin>
        </Route>

        {/* Client routes */}
        <Route path="/client">
          <RequireClient><ClientDashboard /></RequireClient>
        </Route>
        <Route path="/client/products">
          <RequireClient><ClientProducts /></RequireClient>
        </Route>
        <Route path="/client/approvals">
          <RequireClient><ClientApprovals /></RequireClient>
        </Route>
        <Route path="/client/messages">
          <RequireClient><ClientMessages /></RequireClient>
        </Route>

        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
            <OmniChatbot />
          </WouterRouter>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
