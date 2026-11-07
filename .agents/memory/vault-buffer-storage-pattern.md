---
name: Vault asset durability
description: When a generated media file can be confirmed as safely saved in the project Vault
---

Una generación solo debe anunciarse como guardada cuando sus bytes estén en una ubicación duradera y accesible: contenido de base de datos u objeto persistido en App Storage. Una fila de metadatos o un respaldo temporal en el disco del servidor no basta para confirmar el guardado.

**Why:** el guardado del Vault puede dejar una fila sin contenido durable cuando falla el almacenamiento; un mensaje de éxito basado solo en el ID hace que el usuario crea que el vídeo sobrevivirá o podrá descargarse después.

**How to apply:** verifica que exista contenido durable antes de confirmar el éxito. Si no existe, conserva el `Buffer` generado para descargarlo en la respuesta inmediata y muestra claramente que no quedó guardado.
