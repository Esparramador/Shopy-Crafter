# Cursor estable y chats separados

## Objetivo

Corregir el movimiento errático del cursor personalizado y reparar los fallos reproducibles de los dos chats de Shopy Crafter, manteniéndolos separados por audiencia y permisos. El resultado debe comportarse de forma coherente en desarrollo y producción, responder bien en pantallas pequeñas y mostrar los errores reales sin fingir éxito.

## Comportamiento actual

- `SCCursor` dibuja un punto y un anillo globales. El anillo suaviza su movimiento desde coordenadas iniciales `(0, 0)`, y el componente no resetea su estado al salir el puntero del documento.
- La portada añade un halo independiente que también sigue el ratón. Las dos capas activas a la vez pueden dar una sensación de movimiento duplicado.
- `LandingChatbot` es el asesor público. Envía mensajes a las rutas públicas de chat con streaming y una ruta JSON alternativa; no debe ejecutar acciones de administración o de tiendas.
- `OmniChatbot`/ShopyBrain aparece en la zona admin. Sus acciones pasan por rutas protegidas con `requireAdmin`, y las operaciones sensibles disponen de una barrera de confirmación.

## Enfoque elegido

### Cursor

- Mantener la identidad visual SC, pero dejar una sola capa que siga el puntero; el halo de la portada no competirá con el punto y el anillo.
- Al primer evento real de ratón o lápiz, colocar punto y anillo directamente en la coordenada recibida para evitar el recorrido desde la esquina.
- Ocultar el cursor personalizado al salir de la ventana, perder foco o recibir interacción táctil. Respetar movimiento reducido y devolver el cursor nativo cuando el personalizado no esté activo.
- Mantener las capas decorativas sin capturar clics ni bloquear controles.

### Chats

- Mantener el asesor público de la portada y ShopyBrain como experiencias distintas. La portada no recibe acciones administrativas ni credenciales de tienda.
- Para el asesor público, verificar el parseo SSE, los mensajes parciales, la alternativa JSON, el estado de carga y los errores; cuando ambas rutas fallen, ofrecer un estado recuperable y no una respuesta vacía.
- Para ShopyBrain, verificar el ciclo de selección/ejecución/confirmación/resultado de acciones existentes y que el usuario vea el fallo real cuando una acción no se completa.
- Mantener el acceso a acciones reales limitado a la sesión admin autenticada. Las operaciones destructivas, financieras o externas requieren confirmación; no se añade control de ordenadores remotos ni ejecución arbitraria.
- Revisar el uso móvil del chat público y los estados básicos del asistente admin sin ampliar el alcance a un rediseño.

## Flujos

1. Visitante → `LandingChatbot` → rutas públicas de chat → proveedor de IA → respuesta de asesoría. Este flujo no ejecuta cambios en tiendas ni en el sistema.
2. Admin autenticado → `OmniChatbot`/ShopyBrain → ruta admin protegida → acción permitida → resultado o confirmación explícita. El servidor sigue siendo responsable de verificar rol y parámetros.

## Errores y seguridad

- Errores del proveedor o del streaming deben producir un mensaje claro y recuperable, sin exponer trazas internas.
- El cliente público y los usuarios no admin no pueden ejecutar acciones de ShopyBrain; la API debe mantener la autorización aunque se invoque sin la interfaz.
- Una operación protegida solo se considera completada cuando el servidor devuelve su resultado de éxito. Las respuestas ambiguas no se presentan como éxito.
- Las pruebas de operaciones de tienda usarán mocks o fixtures. No se crearán, editarán ni borrarán datos de Muscle Factory.

## Verificación

- Probar el primer movimiento, seguimiento, entrada/salida de controles, pérdida de foco, cambio a táctil y limpieza del cursor; comparar el comportamiento de la vista de desarrollo con la compilación de producción.
- Probar streaming completo, streaming parcial con error, respuesta vacía y fallback del asesor público, sin llamadas reales al proveedor.
- Probar en móvil que el asesor público permanece visible y utilizable, que el campo de texto y el envío funcionan y que los errores se pueden recuperar.
- Probar que las rutas administrativas rechazan usuarios no admin y que las acciones sensibles presentan confirmación antes de mutar; usar implementaciones simuladas, no la tienda real.
- Ejecutar pruebas relevantes, comprobaciones TypeScript y build del frontend; revisar logs de los workflows afectados.

## Fuera de alcance

- Dar herramientas administrativas o de tienda al chat público.
- Eliminar confirmaciones de acciones destructivas, financieras o externas.
- Controlar ordenadores remotos desde el navegador.
- Garantizar disponibilidad absoluta de proveedores externos o prometer que no habrá nunca fallos.
- Publicar la aplicación o modificar datos reales de tiendas conectadas.

## Archivos relevantes

- `artifacts/shopify-optimizer/src/components/ui/SCCursor.tsx`
- `artifacts/shopify-optimizer/src/components/ui/SCCursor.test.ts`
- `artifacts/shopify-optimizer/src/design-system.css`
- `artifacts/shopify-optimizer/src/pages/Landing.tsx`
- `artifacts/shopify-optimizer/src/pages/landing-2026.css`
- `artifacts/shopify-optimizer/src/components/LandingChatbot.tsx`
- `artifacts/shopify-optimizer/src/components/OmniChatbot.tsx`
- `artifacts/shopify-optimizer/src/App.tsx`
- `artifacts/api-server/src/routes/public-chat.ts`
- `artifacts/api-server/src/routes/shopybrain.ts`
