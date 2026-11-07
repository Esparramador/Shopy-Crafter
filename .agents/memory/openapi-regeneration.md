---
name: OpenAPI regeneration across generator versions
description: Why generated API changes require shared-library checks, not only endpoint typechecks.
---

Regenerar OpenAPI puede cambiar también el código de operaciones ajenas cuando la versión instalada del generador difiere de la usada para los archivos anteriores.

**Why:** En 2026-11-05 la copia tenía Orval 8.35.0 instalado, mientras las cabeceras previas indicaban 8.5.3. La regeneración cambió tipos públicos y supuestos de las bibliotecas DOM; comprobar solo los archivos de la funcionalidad nueva no detectaba los errores del paquete compartido.

**How to apply:** Tras regenerar, comprobar las bibliotecas compartidas y ambos consumidores. No interpretar las diferencias de generación como cambios manuales de negocio ni corregir directamente los archivos generados; corregir configuración o las exportaciones estables.
