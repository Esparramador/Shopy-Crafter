import { ReactNode } from "react";
import { Link, useRoute } from "wouter";
import { 
  LayoutDashboard, 
  Wand2, 
  Image as ImageIcon, 
  Palette, 
  SplitSquareHorizontal, 
  DollarSign, 
  Search,
  Settings,
  Plus,
  Store,
  ChevronRight,
  LogOut
} from "lucide-react";
import { useListProjects } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { data: projects, isLoading } = useListProjects();
  const [match, params] = useRoute("/projects/:id/*");
  const activeProjectId = match ? parseInt(params.id) : null;
  const activeProject = projects?.find(p => p.id === activeProjectId);

  const navItems = [
    { id: "audit", label: "Auditoría", icon: LayoutDashboard },
    { id: "redesign", label: "Rediseño IA", icon: Wand2 },
    { id: "images", label: "Imágenes", icon: ImageIcon },
    { id: "consistency", label: "Consistencia", icon: Palette },
    { id: "ab-testing", label: "A/B Testing", icon: SplitSquareHorizontal },
    { id: "pricing", label: "Pricing", icon: DollarSign },
    { id: "seo", label: "SEO Engine", icon: Search },
  ];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Sidebar */}
      <div className="w-72 flex-shrink-0 border-r border-white/5 bg-sidebar flex flex-col z-20 shadow-2xl relative">
        <div className="p-6 flex items-center gap-3 border-b border-white/5">
          <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
            <Wand2 className="w-4 h-4 text-primary" />
          </div>
          <span className="font-display font-bold text-lg text-foreground tracking-wide">AI Optimizer</span>
        </div>

        <div className="p-4 flex-1 overflow-y-auto">
          <div className="flex items-center justify-between mb-4 px-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tus Tiendas</span>
            <Link href="/" className="text-muted-foreground hover:text-primary transition-colors">
              <Plus className="w-4 h-4" />
            </Link>
          </div>

          <div className="space-y-1">
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <div key={i} className="h-10 bg-white/5 rounded-lg animate-pulse" />)}
              </div>
            ) : projects?.map((project) => (
              <Link 
                key={project.id} 
                href={`/projects/${project.id}/audit`}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-200 group",
                  activeProjectId === project.id 
                    ? "bg-primary/10 text-primary font-medium" 
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-3 truncate">
                  <Store className={cn("w-4 h-4", activeProjectId === project.id ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                  <span className="truncate">{project.name}</span>
                </div>
                {activeProjectId === project.id && (
                  <ChevronRight className="w-4 h-4" />
                )}
              </Link>
            ))}
            
            {projects?.length === 0 && !isLoading && (
              <div className="text-center p-4 rounded-xl border border-dashed border-white/10">
                <p className="text-sm text-muted-foreground mb-3">No hay proyectos</p>
                <Link href="/" className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors inline-block">
                  Crear Tienda
                </Link>
              </div>
            )}
          </div>
        </div>

        {activeProject && (
          <div className="p-4 border-t border-white/5">
            <div className="flex items-center gap-3 mb-4 px-2">
              <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(0,214,143,0.8)] animate-pulse" />
              <div className="text-xs text-muted-foreground">Token Activo</div>
            </div>
            <Link 
              href={`/projects/${activeProject.id}/settings`}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground px-2 py-2 rounded-md hover:bg-white/5 transition-colors"
            >
              <Settings className="w-4 h-4" />
              <span>Configuración</span>
            </Link>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-[url('/images/hero-bg.png')] bg-cover bg-center bg-no-repeat relative">
        <div className="absolute inset-0 bg-background/80 backdrop-blur-[100px] z-0" />
        
        {activeProject ? (
          <>
            {/* Top Navigation */}
            <div className="h-16 flex-shrink-0 border-b border-white/5 bg-background/40 backdrop-blur-md z-10 px-8 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{activeProject.name}</span>
                <span className="text-muted-foreground">/</span>
                <span className="font-medium text-foreground capitalize">{params['*']}</span>
              </div>
            </div>

            <div className="px-8 pt-6 z-10 flex gap-2 overflow-x-auto no-scrollbar border-b border-white/5">
              {navItems.map((item) => {
                const isActive = params['*'] === item.id;
                return (
                  <Link
                    key={item.id}
                    href={`/projects/${activeProjectId}/${item.id}`}
                    className={cn(
                      "flex items-center gap-2 px-4 py-3 rounded-t-xl text-sm font-medium transition-all relative",
                      isActive 
                        ? "text-primary bg-primary/10" 
                        : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                    )}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                    {isActive && (
                      <motion.div 
                        layoutId="activeTab" 
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                    )}
                  </Link>
                );
              })}
            </div>

            {/* Scrollable Page Content */}
            <div className="flex-1 overflow-y-auto p-8 z-10">
              {children}
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-y-auto z-10 flex items-center justify-center p-8">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
