---
name: WooCommerce y tienda real
description: Contexto de negocio y límite de seguridad para validar la integración WooCommerce.
---

Muscle Factory es una tienda WooCommerce real conectada a la plataforma, no una tienda ficticia ni un sandbox.

**Why:** El usuario confirmó que la conexión y la clave son reales y pidió contrastar los datos y las acciones con esa tienda. Tratarla como un entorno de pruebas podría afectar al catálogo o a pedidos reales.

**How to apply:** Usar lecturas no destructivas para conciliar cifras. Antes de probar escrituras, acordar un recurso reversible claramente identificado; no modificar pedidos, cobros, reembolsos o productos comerciales como prueba. No guardar credenciales ni datos personales de clientes en memoria.
