# Contrato de gestión WooCommerce

Todas las rutas de Hub usan sesión admin y el prefijo `/api/admin/woo/project/:id`.
Nunca se admiten rutas arbitrarias ni credenciales en el navegador.

- `GET /overview`: `{revenue30d,gross30d,refunds30d,taxes30d,shipping30d,orders30d,aov,totalProducts,totalCustomers,currency,source,fetchedAt,period:{from,to,timezone},definition,complete:true,stockAlerts,recentOrders}`. Un fallo no devuelve ceros ni un snapshot como lectura actual.
- `GET /inventory`: `{outOfStock,lowStock,backorder,totalTracked,outOfStockCount,lowStockCount,backorderCount,currency,source,fetchedAt}`.
- `GET /resources/:resource?parentId=&page=1&per_page=20&search=&status=`: `{data:[],total,totalPages,page,hasMore,fetchedAt,source}`. Objetos en formato nativo WooCommerce. Resources: products, variations (parentId producto obligatorio), categories, attributes, terms (parentId atributo obligatorio), orders, customers, coupons. Un solo estado por filtro.
- `GET /resources/:resource/:entityId?parentId=`: `{result: objeto WooCommerce}`.
- `GET /schema/:resource?parentId=&entityId=`: `{fields: objeto args de OPTIONS, methods:[]}`. Son los campos del formulario que expone esta instalación, limitados a la lista editable del servidor. OPTIONS no acredita permiso de escritura; los 401/403 reales se muestran.
- `POST /resources/:resource`: `{data:objeto,operationId:UUID,confirmed:true,parentId?:number}` crea y verifica con GET. No crea pedidos ni clientes.
- `PUT /resources/:resource/:entityId`: mismo cuerpo. Devuelve `{state:"verified",entityId,verifiedAt,result}`. El operationId debe mantenerse en fallos/reintentos. Si la operación es incierta, no repetirla con otro id; revisar WooCommerce.
- Sin borrado, cobros ni reembolsos desde el Hub. Edición de estado de pedido puede disparar efectos comerciales en WC; requiere confirmación explícita. `refunded` no permitido.
- `POST /uploads`: JSON `{name,size,contentType}` → `{id,uploadURL}`; subir bytes con PUT directamente a uploadURL.
- `POST /imports/preview`: `{uploadId}` → `{id,entries:[{name,size,mime}],state:"preview"}`. Acepta imagen/PDF o ZIP de imágenes/PDF. No asigna por nombre automáticamente.
- `GET /imports/:importId`: estado y filas persistentes.
- `POST /imports/:importId/apply`: `{confirmed:true,publicFilesConfirmed:true,assignments:[{name,productId,variationId?:number,sku?:string,kind:"image"|"download"}]}` → estado `{id,state,entries,results:[{name,state,productId,variationId?,error?,mediaId?,url?}]}`.
  Solo las filas elegidas se importan. Cada fila necesita un ID explícito, un SKU opcional que se contrasta y un tipo. Imágenes se anexan; orden/eliminación de galería se edita desde producto. PDF requiere confirmar que será un enlace público permanente; no se usa URL firmada como enlace permanente. Ante fallo parcial se conserva el resultado y se puede reanudar; filas inciertas se bloquean para no duplicar.
  La asignación inicial queda inmutable y se devuelve en `assignments`; una reanudación reenvía esa asignación completa y salta filas verificadas/inciertas. Los previews llevan `previewUrl` efímera, generada al leer y no persistida. Las imágenes se copian a medios de WooCommerce por URL y solo se conserva como resultado la URL devuelta por WooCommerce. Los descargables necesitan un dominio de despliegue permanente: la copia de desarrollo los rechaza antes de escribir para no guardar enlaces temporales.

Las listas y detalles se recargan tras cambios y al volver a la pantalla. Toda cifra monetaria usa currency de la tienda o del pedido, nunca un euro implícito. Errores bloquean los listados vacíos y totales “confirmados”. El cliente usa el mismo cálculo en `/api/client/platform-data`.

## Inventario de endpoints externos

Autenticación: Basic por HTTPS con Consumer Key/Secret descifradas solamente en el servidor. No se envían a otro origen ni se siguen redirects. La pertenencia del cliente se resuelve desde sesión; la gestión del Hub exige admin. Una Consumer Key **no** acredita autenticación de medios WordPress.

| Recurso WC v3 | Uso y métodos | Permiso requerido | Filtros/paginación | Pruebas |
|---|---|---|---|---|
| `/orders`, `/orders/:id` | Cohorte, listado, detalle GET; estado/nota PUT | Leer pedidos; escribir pedidos para editar | GET paginado; `after`, `before`, `dates_are_gmt=true`, `status=any` para cohorte; un estado en búsqueda. Se contrasta con OPTIONS | Cohorte pagada, impuestos, portes, devoluciones, multimoneda, filtro multivalor rechazado; validación de formulario pendiente en instalación real |
| `/products`, `/products/:id` | Catálogo GET, POST, PUT; no DELETE | Leer/escribir productos | `page`, `per_page`, búsqueda/estado según OPTIONS; hasta 50 páginas para totales o error explícito | Páginas múltiples, total cambiante, lectura posterior, idempotencia, fallo incierto |
| `/products/:id/variations`, `/:vid` | Inventario y editor GET/POST/PUT | Leer/escribir productos | Paginación completa; nunca limitar a primera página sin aviso | Paginación de cliente; conciliación de variaciones pendiente en instalación real |
| `/products/categories`, `/:id` | Categorías GET/POST/PUT | Leer/escribir productos/términos | Paginado, búsqueda según OPTIONS; `hide_empty=false` si se expone | Validación de esquema y campos; permiso efectivo pendiente |
| `/products/attributes`, `/:id` | Atributos GET/POST/PUT | Leer/escribir productos/términos | Core expone lista completa sin filtros de paginación; en tal caso máximo explícito 5.000 y paginación/búsqueda local | Adaptación condicionada a OPTIONS; instalación real pendiente |
| `/products/attributes/:id/terms`, `/:tid` | Términos GET/POST/PUT | Leer/escribir productos/términos | Paginado, búsqueda, `hide_empty=false` si se expone | Validación contra esquema, instalación real pendiente |
| `/customers`, `/customers/:id` | Cuentas registradas y contactos GET/PUT; sin alta/borrado desde Hub | Leer clientes; escribir clientes para editar | Total real por cabeceras, paginación/búsqueda según OPTIONS. No se inventan pedidos/gasto del cliente | Admin/cliente/anónimo; sin fallback entre tiendas |
| `/coupons`, `/coupons/:id` | Cupones GET/POST/PUT; sin borrado | Leer/escribir cupones | Paginación/búsqueda según OPTIONS | Importes y campos permitidos; lectura posterior, permiso real pendiente |
| `/settings/general` | Moneda actual GET | Leer ajustes WC | Lista completa de ajustes generales; no filtros inventados | Se rechaza ausencia de moneda. No fallback EUR |
| `OPTIONS` sobre recursos anteriores | Esquema y métodos de instalación | La autenticación que exija la instalación | No se interpreta como prueba de permiso efectivo de escritura | Campos/enum/tipos y propiedades anidadas no editables se rechazan |
| `GET /system_status`, `/reports/products/totals` | Conector existente: comprobar conexión/productos | Permisos WC de lectura administrativa | Sin paginación | No se usan para construir ingresos del Hub nuevo |
| `/wp/v2/media` | **No se llama** | Requeriría autorización WordPress válida e independiente | Sin supuestos sobre equivalencia de claves | Se usa importación de imágenes por `src` de WC; no se ha acreditado permiso de subir medios WP |

Todas las llamadas tienen límite de 20 segundos y no reintentan escrituras. Las lecturas completas tienen límite de páginas y tiempo; un fallo invalida el total. Las cifras se calculan en céntimos; tax/portes son componentes brutos informativos, no contabilidad fiscal ni netos de impuestos tras devoluciones. El periodo es una cohorte UTC de creación, no caja por fecha de pago. Las devoluciones de pedidos anteriores al periodo no se atribuyen como devoluciones del periodo. No se suman monedas distintas.

## Fuentes oficiales contrastadas

- https://developer.woocommerce.com/docs/apis/rest-api/
- https://developer.woocommerce.com/docs/apis/rest-api/v3/orders/
- https://developer.woocommerce.com/docs/apis/rest-api/v3/products/
- https://developer.woocommerce.com/docs/apis/rest-api/v3/product-variations/
- https://developer.woocommerce.com/docs/apis/rest-api/v3/product-categories/
- https://developer.woocommerce.com/docs/apis/rest-api/v3/product-attributes/
- https://developer.woocommerce.com/docs/apis/rest-api/v3/product-attribute-terms/
- https://developer.woocommerce.com/docs/apis/rest-api/v3/customers/
- https://developer.woocommerce.com/docs/apis/rest-api/v3/coupons/
- https://developer.wordpress.org/rest-api/reference/media/

## Evidencia y límite actual

El 5 de noviembre de 2026 se hizo una lectura real de Muscle Factory con credenciales guardadas como secretos, sin imprimirlas. La copia de desarrollo tiene ahora un proyecto WooCommerce local (id 10) que guarda solo referencias restringidas a esos secretos, no sus valores; el servidor resuelve esas referencias únicamente en desarrollo y solo para `musclefactorybcn.com`. La fila local no activa automatizaciones y no modifica la base de producción. WooCommerce devolvió HTTP 200 al leer productos, pedidos, clientes, categorías, atributos, términos, cupones, ajustes generales y variaciones; los listados paginados incluyeron cabeceras de total. OPTIONS confirmó los filtros de colección: productos (page, per_page, search, status); categorías (page, per_page, search, hide_empty); atributos sin argumentos de paginación/búsqueda; pedidos (page, per_page, search, status, after, before, dates_are_gmt); clientes (page, per_page, search); cupones (page, per_page, search, after, before, dates_are_gmt). El filtro real de fechas y estados del resumen también se ejecutó correctamente. OPTIONS anuncia métodos de escritura, pero no acredita que estas claves tengan permiso efectivo para usarlos.

La misma función `wooOverview` alimenta Hub y `/api/client/platform-data`. Ejecutada contra la tienda sin crear un proyecto local ni guardar credenciales, devolvió una lectura completa en EUR: 141 productos, 269 cuentas registradas y 1 pedido pagado en la cohorte UTC de 30 días; bruto/neto 167,99 €, devoluciones 0 €, impuestos 15,27 € y portes 0 €. Inventario: 77 estados `outofstock`, 0 bajo stock, 0 bajo pedido y 0 unidades con gestión de cantidad. Estos datos son una lectura puntual, no un histórico contable.

El endpoint público WordPress `/wp/v2/media` respondió a una lectura sin autenticación y anunció 833 elementos. Al usar las Consumer Keys de WooCommerce contra `/wp/v2/users/me?context=edit` y `/wp/v2/media?context=edit`, ambos devolvieron 401. Por tanto esas claves no acreditan autenticación privada en la API de WordPress ni permiso para subir medios. La instalación WooCommerce sí expone `images` y `downloads` en el esquema del producto; el producto de prueba confirmó escritura/readback del SKU, pero no se realizó una importación de imagen por URL.

Con autorización explícita se probaron productos temporales en borrador, con nombre y SKU únicos, y se eliminaron solo los creados por las pruebas. La primera creación y su lectura se confirmaron; el `PUT` de descripción respondió 2xx, pero el texto se normalizó como HTML y no coincidió byte por byte. En una segunda prueba, `POST` y lectura inicial se confirmaron, `PUT` cambió el SKU y GET confirmó el valor exacto. En ambas limpiezas, `DELETE` con `force=true` respondió 500, pero GET por ID dio 404 y las búsquedas por SKU devolvieron cero resultados. No quedan productos de prueba y no se modificaron recursos comerciales preexistentes ni medios. El error HTTP de borrado sigue siendo una anomalía de la instalación, aunque la ausencia quedó verificada.

La base de producción contiene un proyecto WooCommerce Muscle Factory (id 5); el proyecto local id 10 es una conexión separada de desarrollo, no una copia de la fila cifrada de producción. El endpoint real `wooOverview` ejecutado con el proyecto local devolvió `complete: true`, EUR, 141 productos, 269 clientes, 1 pedido en los últimos 30 días y 167,99 € de ingresos. Ambos paneles usan ese mismo cálculo. El Hub admin puede abrirse en `/projects/10/woo-hub`. El proyecto Shopify de Hanakaze no se modificó. La importación real de imágenes/ZIP en la biblioteca de medios de WordPress sigue sin probarse: las credenciales WooCommerce reciben 401 en endpoints privados `wp/v2`, y no se hizo una escritura que pudiera dejar un medio sin limpiar. El ZIP se validó con pruebas locales; para acreditar la escritura real de medios hace falta un método de limpieza con permisos WordPress o un entorno de pruebas de la tienda.

### Decisión sobre snapshots heredados

En WooCommerce, la vista nueva lee directamente el mismo modelo desde ambos paneles y no reconcilia sumando snapshots locales. Esos snapshots heredados no acreditan conjuntamente periodo, moneda y origen; utilizarlos como fallback daría una certeza falsa. No se migran ni se modifican sus datos ni los webhooks de otras plataformas. Queda por verificar con la tienda si se necesita además un histórico conciliado persistente; no se presenta este cambio como una sincronización de los snapshots heredados.
