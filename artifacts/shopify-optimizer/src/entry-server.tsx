import { renderToString } from "react-dom/server";
import type { ComponentType } from "react";
import { Router } from "wouter";
import LandingSSR from "./pages/LandingSSR";
import Blog from "./pages/public/Blog";
import CasosDeExito from "./pages/public/CasosDeExito";
import Changelog from "./pages/public/Changelog";
import Contacto from "./pages/public/Contacto";
import Cookies from "./pages/public/Cookies";
import FAQ from "./pages/public/FAQ";
import Privacidad from "./pages/public/Privacidad";
import ProgramaAfiliados from "./pages/public/ProgramaAfiliados";
import SobreNosotros from "./pages/public/SobreNosotros";
import Terminos from "./pages/public/Terminos";

const ROUTE_MAP: Record<string, ComponentType> = {
  "/": LandingSSR,
  "/landing": LandingSSR,
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

export function render(path: string): string {
  const Component = ROUTE_MAP[path];
  if (!Component) return "";

  return renderToString(
    <Router ssrPath={path}>
      <Component />
    </Router>
  );
}
