import type { HTMLAttributes } from "react";
import { useModalLock } from "@/hooks/use-modal-lock";

/**
 * Overlay estándar para modales del panel admin.
 *
 * - Aplica la clase `.modal-overlay` de design-system.css (position fixed,
 *   inset 0, z-index 1000, fondo oscuro, flex centrado, padding 16px).
 * - Llama a useModalLock() mientras está montado, lo que pone
 *   `data-modal-open` en <body> y oculta los widgets flotantes
 *   (.floating-widget: panel Setup, botón de voz, FAB del asistente) que
 *   tienen z-index superior y si no taparían el modal.
 *
 * Acepta cualquier prop de <div>; `style` sirve para ajustar el layout
 * (p. ej. `alignItems: "stretch", padding: 0` en paneles laterales).
 */
export function ModalOverlay({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  useModalLock();
  const cls = className ? `modal-overlay ${className}` : "modal-overlay";
  return (
    <div {...rest} className={cls}>
      {children}
    </div>
  );
}
