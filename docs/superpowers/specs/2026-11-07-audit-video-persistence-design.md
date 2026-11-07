# Guardado fiable de anuncios

## What & Why
El botón «Vídeo anuncio» de Auditoría puede mostrar éxito aunque el vídeo no se haya guardado en el Vault del proyecto. El flujo cinematográfico continúa después de un error o un resultado vacío de `saveToVault`, y el modal acepta cualquier respuesta HTTP exitosa como un anuncio listo. El flujo rápido guarda el MP4, pero no devuelve el ID de Vault de forma uniforme. La base de desarrollo no muestra un anuncio reciente de esta generación.

El objetivo es que un anuncio solo se anuncie como guardado cuando exista una copia recuperable y accesible desde el proyecto. Si falla la persistencia, el modal debe explicar que no se guardó y mantener una vía para descargar o reintentar el guardado sin volver a generar el vídeo.

## Done looks like
- Los flujos rápido, cinematográfico y Try-On devuelven `success: true` únicamente después de confirmar que el MP4 tiene contenido o una ruta recuperable en el Vault.
- Las respuestas incluyen el ID del archivo de Vault y una URL estable de previsualización o descarga.
- El modal no muestra un estado verde de éxito cuando faltan el ID o el enlace de recuperación.
- Si falla el guardado después de generar el vídeo, el modal conserva una copia descargable y explica que no quedó guardada; no vuelve a llamar a los proveedores de generación.
- Las pruebas cubren guardado correcto, guardado nulo, registro sin bytes y recuperación de la copia en el cliente. La generación y el almacenamiento externos se simulan; no se escriben datos en Muscle Factory ni se generan vídeos reales.

## Out of scope
- Cambios en los productos, pedidos, precios o contenido de la tienda.
- Cambios de proveedor, prompt, modelo, voz o coste de generación.
- Reorganizar la biblioteca global o añadir una nueva tabla de base de datos, salvo que la recuperación existente no permita cumplir el objetivo.

## Steps
1. **Confirmar persistencia del MP4** — Usar el Vault existente y comprobar que el registro contiene bytes o una ruta de almacenamiento recuperable; un registro de metadatos vacío no cuenta como guardado.
2. **Corregir el contrato del API** — Devolver ID y URL de Vault en todos los flujos de anuncios; devolver un fallo explícito si la persistencia no se confirma.
3. **Preservar el resultado generado** — Si el guardado falla, devolver el MP4 al modal como archivo descargable y mostrar un estado de fallo de persistencia; no volver a generar ni a cobrar.
4. **Verificar ambos extremos** — Añadir pruebas aisladas de API y de la respuesta del modal para los escenarios de éxito, fallo de persistencia y reintento.

## Relevant files
- `artifacts/shopify-optimizer/src/pages/projects/Audit.tsx:1790-1810`
- `artifacts/shopify-optimizer/src/components/CreateAdModal.tsx:345-360,925-952`
- `artifacts/api-server/src/routes/product-ads.ts:101-285`
- `artifacts/api-server/src/routes/product-ads.ts:294-545`
- `artifacts/api-server/src/lib/vault.ts:181-390`
- `artifacts/api-server/src/routes/vault.ts:85-145`
