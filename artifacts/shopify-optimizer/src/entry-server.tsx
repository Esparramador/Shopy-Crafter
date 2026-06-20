import { renderToString } from "react-dom/server";
import type { ComponentType } from "react";
import { Router } from "wouter";
import Blog from "./pages/public/Blog";
import BlogPost from "./pages/public/BlogPost";
import CasosDeExito from "./pages/public/CasosDeExito";
import CasoDeExitoDetail from "./pages/public/CasoDeExitoDetail";
import Changelog from "./pages/public/Changelog";
import ChangelogRelease from "./pages/public/ChangelogRelease";
import Contacto from "./pages/public/Contacto";
import Cookies from "./pages/public/Cookies";
import FAQ from "./pages/public/FAQ";
import Privacidad from "./pages/public/Privacidad";
import ProgramaAfiliados from "./pages/public/ProgramaAfiliados";
import SobreNosotros from "./pages/public/SobreNosotros";
import Terminos from "./pages/public/Terminos";

const ROUTE_MAP: Record<string, ComponentType> = {
  "/sobre-nosotros": SobreNosotros,
  "/casos-de-exito": CasosDeExito,
  "/programa-de-afiliados": ProgramaAfiliados,
  "/faq": FAQ,
  "/blog": Blog,
  "/changelog": Changelog,
  "/privacidad": Privacidad,
  "/terminos": Terminos,
  "/cookies": Cookies,
  "/contacto": Contacto,
};

function resolveComponent(path: string): ComponentType | null {
  if (ROUTE_MAP[path]) return ROUTE_MAP[path];
  if (path.startsWith("/blog/")) return BlogPost;
  if (path.startsWith("/casos-de-exito/")) return CasoDeExitoDetail;
  if (path.startsWith("/changelog/")) return ChangelogRelease;
  return null;
}

export function render(path: string): string {
  const Component = resolveComponent(path);
  if (!Component) return "";

  return renderToString(
    <Router ssrPath={path}>
      <Component />
    </Router>
  );
}
