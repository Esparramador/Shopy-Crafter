import { useEffect } from "react";

/**
 * Marca en <body> que hay un modal abierto (data-modal-open) mientras el
 * componente que lo llama esté montado. design-system.css usa ese atributo para
 * ocultar los widgets flotantes (.floating-widget: panel Setup, botón de voz,
 * FAB del asistente), que tienen z-index superiores al overlay y si no taparían
 * el modal. Soporta varios modales a la vez mediante un contador.
 */
let openModals = 0;

export const MODAL_OPEN_ATTR = "data-modal-open";

export function useModalLock(active: boolean = true): void {
  useEffect(() => {
    if (!active || typeof document === "undefined") return;
    openModals += 1;
    document.body.setAttribute(MODAL_OPEN_ATTR, "true");
    return () => {
      openModals = Math.max(0, openModals - 1);
      if (openModals === 0) document.body.removeAttribute(MODAL_OPEN_ATTR);
    };
  }, [active]);
}
