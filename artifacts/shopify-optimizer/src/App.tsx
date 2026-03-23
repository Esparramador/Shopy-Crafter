import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/AppLayout";
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      {/* Project Routes wrapped in AppLayout */}
      <Route path="/projects/:id/audit">
        <AppLayout><AuditPage /></AppLayout>
      </Route>
      <Route path="/projects/:id/redesign">
        <AppLayout><RedesignPage /></AppLayout>
      </Route>
      <Route path="/projects/:id/images">
        <AppLayout><ImagesPage /></AppLayout>
      </Route>
      <Route path="/projects/:id/consistency">
        <AppLayout><ConsistencyPage /></AppLayout>
      </Route>
      <Route path="/projects/:id/ab-testing">
        <AppLayout><ABTestingPage /></AppLayout>
      </Route>
      <Route path="/projects/:id/pricing">
        <AppLayout><PricingPage /></AppLayout>
      </Route>
      <Route path="/projects/:id/seo">
        <AppLayout><SEOPage /></AppLayout>
      </Route>
      <Route path="/projects/:id/settings">
        <AppLayout><SettingsPage /></AppLayout>
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <div className="bg-background text-foreground min-h-screen">
            <Router />
          </div>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
