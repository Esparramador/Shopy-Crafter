---
name: WooCommerce y tienda real
description: Contexto de negocio y límite de seguridad para validar la integración WooCommerce.
---

Muscle Factory es una tienda WooCommerce real, no un sandbox. Producción conserva su proyecto WooCommerce; la copia de desarrollo tiene un registro separado de conexión para pruebas de lectura. Ese registro usa referencias allowlisted a Secrets, no valores de claves ni ciphertext copiado de producción.

**Why:** Las bases de producción y desarrollo son entornos separados; la clave de cifrado persistente no está configurada en desarrollo y copiar el ciphertext de producción puede impedir descifrarlo o exponer secretos. El cliente solo acepta referencias de credenciales para el dominio exacto y en desarrollo.

**How to apply:** Mantener la conexión de desarrollo aislada y usar referencias a Secrets limitadas a esa tienda; nunca copiar valores ni ciphertext de credenciales desde producción. Usar lecturas no destructivas para conciliar cifras. Las pruebas con fixtures locales no sustituyen la conexión real. Antes de probar escrituras, acordar un recurso reversible claramente identificado; no modificar pedidos, cobros, reembolsos o productos comerciales como prueba. Para probar acciones de tienda de ShopyBrain, simular el conector en las pruebas y no llamar a APIs de tiendas conectadas. No guardar credenciales ni datos personales de clientes en memoria.

En pruebas autorizadas de borradores (2026-11-05), un `PUT` de descripción respondió 2xx, pero WordPress devolvió el texto normalizado como HTML; un `PUT` de SKU sí tuvo lectura posterior exacta. En ambas limpiezas `DELETE ?force=true` respondió HTTP 500, pero GET por ID devolvió 404 y la búsqueda por SKU no encontró los productos.

**Why:** La tienda puede normalizar contenido y una respuesta de error puede llegar después de que el recurso ya haya desaparecido; reintentar sin leer podría duplicar o afectar otra cosa.

**How to apply:** Tras cualquier escritura incierta, consultar el recurso exacto y su SKU antes de decidir; nunca deducir el resultado solo del código HTTP ni repetir a ciegas. Para verificar lecturas posteriores, preferir campos escalares con comparación exacta y normalizar HTML cuando se prueben descripciones. No se pudo confirmar el permiso de WordPress para subir medios.

El usuario indica que la API WooCommerce de Muscle Factory permite gestionar todo lo relativo a la tienda. Las credenciales sí permiten lecturas y escrituras de producto en `wc/v3`; en cambio, dos GET privados de la API `wp/v2` devolvieron 401. Producción contiene el proyecto WooCommerce Muscle Factory, mientras que la copia de trabajo no; su Shopify existente pertenece a otra tienda y no debe reutilizarse.

**Why:** La API respondió para recursos WooCommerce, pero WordPress no aceptó las mismas credenciales en endpoints privados y el proyecto local existente está asociado a otra integración.

**How to apply:** Mantener Muscle Factory en su proyecto WooCommerce existente en producción. Verificar cada endpoint requerido; no sustituir ni reasignar proyectos Shopify para reutilizar sus IDs. Antes de probar importaciones que creen medios, confirmar cómo limpiar los medios nuevos sin tocar los preexistentes.
