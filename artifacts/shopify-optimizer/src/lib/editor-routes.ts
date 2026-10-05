/**
 * Rutas de editores/estudios a pantalla completa. En ellas el compositor
 * (prompt + botón Generar) ocupa la esquina inferior derecha, así que los
 * botones flotantes globales se elevan y el widget de onboarding se oculta.
 */
const EDITOR_ROUTE_RE =
  /\/(web-designer|web-lab|effects-studio|fusion-studio-pro|fusion-studio|tripo3d|meshy|meshy-studio|template-studio|deck-builder|cards|ad-studio|avatar-studio|youtube-studio|hyperframes|amr-studio|campaign-kit|exploded-view|generator)(\/|$)/;

export const isEditorRoute = (location: string) => EDITOR_ROUTE_RE.test(location);

/** Distancia mínima al borde inferior para los flotantes en editores. */
export const EDITOR_FLOAT_MIN_BOTTOM = 240;
