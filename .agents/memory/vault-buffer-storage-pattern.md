---
name: Vault asset durability
description: When a generated media file can be confirmed as safely saved in the project Vault
---

Una generación solo debe anunciarse como guardada cuando sus bytes estén en una ubicación duradera y accesible: contenido de base de datos u objeto persistido en App Storage. Una fila de metadatos o un respaldo temporal en el disco del servidor no basta para confirmar el guardado.

**Why:** el guardado del Vault puede dejar una fila sin contenido durable cuando falla el almacenamiento; un mensaje de éxito basado solo en el ID hace que el usuario crea que el vídeo sobrevivirá o podrá descargarse después.

**How to apply:** verifica que exista contenido durable antes de confirmar el éxito. Si no existe, conserva el `Buffer` generado para descargarlo en la respuesta inmediata y muestra claramente que no quedó guardado.

Para generaciones con proveedores asíncronos, registra el identificador externo antes de sondear el resultado y no vuelvas a lanzar automáticamente un trabajo interrumpido: puede generar un segundo cargo. Tras reiniciar, reconcilia primero los archivos del Vault con el ID del trabajo; solo marca el trabajo como completado cuando los bytes duraderos existen.

**Why:** el navegador puede perder la respuesta mientras el servidor sigue trabajando, y el proceso puede reiniciarse entre el guardado del MP4 y la actualización del estado.

**How to apply:** guarda progreso e IDs del proveedor en un registro duradero; al reabrir la pantalla, consulta ese registro y recupera el resultado guardado en lugar de repetir el POST de generación.
