import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/AppLayout";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

import Home from "@/pages/Home";
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

import ClientDashboard from "@/pages/client/ClientDashboard";
import ClientApprovals from "@/pages/client/ClientApprovals";
import ClientMessages from "@/pages/client/ClientMessages";
import ClientProducts from "@/pages/client/ClientProducts";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
  },
});

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-[#08080f] flex items-center justify-center"><Loader2 className="w-8 h-8 text-[#5b4eff] animate-spin" /></div>;
  if (!user) return <Redirect to="/login" />;
  if (user.role !== "admin") return <Redirect to="/client" />;
  return <>{children}</>;
}

function RequireClient({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-[#08080f] flex items-center justify-center"><Loader2 className="w-8 h-8 text-[#5b4eff] animate-spin" /></div>;
  if (!user) return <Redirect to="/login" />;
  if (user.role === "admin") return <Redirect to="/" />;
  return <>{children}</>;
}

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-[#08080f] flex items-center justify-center"><Loader2 className="w-8 h-8 text-[#5b4eff] animate-spin" /></div>;
  if (!user) return <Redirect to="/login" />;
  if (user.role === "client") return <Redirect to="/client" />;
  return <Home />;
}

function ImpersonationBanner() {
  const { user, refresh } = useAuth();
  const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

  if (!user?.impersonating) return null;

  const stopImpersonating = async () => {
    await fetch(`${API_BASE}/api/admin/stop-impersonate`, { method: "POST", credentials: "include" });
    await refresh();
    window.location.href = "/";
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-red-500 text-white text-sm py-2 px-4 flex items-center justify-between">
      <span>👁 Viendo como cliente — modo impersonación</span>
      <button onClick={stopImpersonating} className="underline hover:no-underline font-semibold">
        Salir y volver al admin
      </button>
    </div>
  );
}

function Router() {
  return (
    <>
      <ImpersonationBanner />
      <Switch>
        {/* Public */}
        <Route path="/login" component={LoginPage} />
        <Route path="/invite/:token" component={InviteSetupPage} />

        {/* Root — redirects by role */}
        <Route path="/">
          <HomeRedirect />
        </Route>

        {/* Admin routes */}
        <Route path="/admin/clients">
          <RequireAdmin><AdminClients /></RequireAdmin>
        </Route>

        <Route path="/projects/:id/audit">
          <RequireAdmin>
            <AppLayout><AuditPage /></AppLayout>
          </RequireAdmin>
        </Route>
        <Route path="/projects/:id/redesign">
          <RequireAdmin>
            <AppLayout><RedesignPage /></AppLayout>
          </RequireAdmin>
        </Route>
        <Route path="/projects/:id/images">
          <RequireAdmin>
            <AppLayout><ImagesPage /></AppLayout>
          </RequireAdmin>
        </Route>
        <Route path="/projects/:id/consistency">
          <RequireAdmin>
            <AppLayout><ConsistencyPage /></AppLayout>
          </RequireAdmin>
        </Route>
        <Route path="/projects/:id/ab-testing">
          <RequireAdmin>
            <AppLayout><ABTestingPage /></AppLayout>
          </RequireAdmin>
        </Route>
        <Route path="/projects/:id/pricing">
          <RequireAdmin>
            <AppLayout><PricingPage /></AppLayout>
          </RequireAdmin>
        </Route>
        <Route path="/projects/:id/seo">
          <RequireAdmin>
            <AppLayout><SEOPage /></AppLayout>
          </RequireAdmin>
        </Route>
        <Route path="/projects/:id/settings">
          <RequireAdmin>
            <AppLayout><SettingsPage /></AppLayout>
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
            <div className="bg-background text-foreground min-h-screen">
              <Router />
            </div>
          </WouterRouter>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
