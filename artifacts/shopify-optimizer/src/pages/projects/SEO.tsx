import { useRoute } from "wouter";
import { GlassCard } from "@/components/ui/GlassCard";
import { Search, Globe, FileCode2, Zap, Link as LinkIcon, Edit3 } from "lucide-react";
import { motion } from "framer-motion";

export default function SEOPage() {
  const [, params] = useRoute("/projects/:id/seo");
  const projectId = parseInt(params?.id || "0");

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">SEO Técnico & Contenido</h1>
          <p className="text-muted-foreground mt-1">Schemas, metas, web vitals y estrategia de blog automatizada.</p>
        </div>
        <button className="bg-primary text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 hover:bg-primary/90 transition-all shadow-[0_0_15px_rgba(91,78,255,0.3)]">
          <Search className="w-5 h-5" />
          Auditoría SEO
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <GlassCard className="p-6 col-span-1 md:col-span-2">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-foreground">One-Click Fixes</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button className="bg-white/5 border border-white/10 p-4 rounded-xl text-left hover:bg-white/10 transition-all group">
              <FileCode2 className="w-6 h-6 text-blue-400 mb-3" />
              <h3 className="font-bold text-foreground mb-1 group-hover:text-blue-400 transition-colors">Generar JSON-LD Schemas</h3>
              <p className="text-xs text-muted-foreground">Product, Organization, Breadcrumbs (Rich Results)</p>
            </button>
            <button className="bg-white/5 border border-white/10 p-4 rounded-xl text-left hover:bg-white/10 transition-all group">
              <Globe className="w-6 h-6 text-green-400 mb-3" />
              <h3 className="font-bold text-foreground mb-1 group-hover:text-green-400 transition-colors">Meta Tags Masivos</h3>
              <p className="text-xs text-muted-foreground">Title y Description optimizados con keywords</p>
            </button>
            <button className="bg-white/5 border border-white/10 p-4 rounded-xl text-left hover:bg-white/10 transition-all group">
              <LinkIcon className="w-6 h-6 text-orange-400 mb-3" />
              <h3 className="font-bold text-foreground mb-1 group-hover:text-orange-400 transition-colors">Limpieza de URLs</h3>
              <p className="text-xs text-muted-foreground">Handles cortos, 301 redirects automáticos</p>
            </button>
            <button className="bg-white/5 border border-white/10 p-4 rounded-xl text-left hover:bg-white/10 transition-all group">
              <Zap className="w-6 h-6 text-yellow-400 mb-3" />
              <h3 className="font-bold text-foreground mb-1 group-hover:text-yellow-400 transition-colors">Sitemap XML</h3>
              <p className="text-xs text-muted-foreground">Sitemap de imágenes + Ping a Google</p>
            </button>
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <div className="text-center">
            <div className="w-24 h-24 rounded-full border-4 border-[#00d68f] flex items-center justify-center mx-auto mb-4 relative">
              <span className="text-3xl font-bold text-[#00d68f]">A</span>
              <div className="absolute inset-0 rounded-full border-4 border-[#00d68f] opacity-20 blur-sm"></div>
            </div>
            <h3 className="text-lg font-bold text-foreground mb-1">Score SEO Global</h3>
            <p className="text-sm text-muted-foreground">94/100 puntos</p>
          </div>
          
          <div className="mt-6 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Metas Faltantes</span>
              <span className="text-red-400 font-bold">12 prods</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Imágenes sin Alt</span>
              <span className="text-orange-400 font-bold">45 imgs</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Core Web Vitals</span>
              <span className="text-green-400 font-bold">Pasa</span>
            </div>
          </div>
        </GlassCard>
      </div>

      <GlassCard className="p-8 border-primary/30">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
            <Edit3 className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">Estrategia de Contenido (Blog)</h2>
            <p className="text-muted-foreground">Generación automática de artículos pillar y clusters en Shopify.</p>
          </div>
        </div>

        <div className="bg-black/20 rounded-xl p-6 border border-white/5">
          <h3 className="text-primary font-bold mb-4 uppercase text-xs tracking-wider">Pillar Page Recomendada</h3>
          <div className="flex justify-between items-center">
            <div>
              <p className="text-lg font-medium text-foreground mb-1">Guía Definitiva de Moda Urbana 2025</p>
              <p className="text-sm text-muted-foreground">Target: 3,000 palabras • Dificultad: Media</p>
            </div>
            <button className="bg-white/10 text-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary hover:text-white transition-colors">
              Generar Artículo
            </button>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
