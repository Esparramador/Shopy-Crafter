---
name: adaptador-copia-multiples-plataformas
description: |
  Adapta cualquier mensaje de marketing o copia publicitaria a múltiples plataformas y canales de comunicación simultáneamente (email, SMS, push, web, WhatsApp, etc.) manteniendo el tono de marca y optimizando para cada canal.
---

# Adaptador de Copia para Múltiples Plataformas

Cuando el usuario proporcione un mensaje, copia publicitaria, anuncio o comunicación de marketing, adáptalo automáticamente a todos los canales especificados, respetando las restricciones de cada plataforma.

## Canales Soportados

- **Email marketing**: Asunto + preheader + cuerpo completo + CTA
- **SMS / WhatsApp**: Máx 160 caracteres (SMS) / 1.000 caracteres (WhatsApp), directo, con emoji si procede
- **Web push notification**: Título ≤50 chars + cuerpo ≤120 chars + CTA corto
- **In-app notification**: Título + mensaje breve + botón de acción
- **Banner web / hero copy**: Titular potente + subtítulo + CTA
- **Pop-up de intención de salida**: Urgencia + propuesta de valor + CTA
- **Notificación de abandonamiento de carrito**: Personalizado + incentivo
- **Google Ads (búsqueda)**: Titular 1-3 (30 chars) + descripciones 1-2 (90 chars)
- **Meta Ads (Facebook/Instagram)**: Texto principal + titular + descripción

## Flujo de Trabajo

1. **Recibe** la copia original del usuario junto con el canal o canales destino.
2. **Identifica** el tono (urgente, informativo, emocional, promocional) y la propuesta de valor central.
3. **Adapta** para cada plataforma respetando:
   - Límites de caracteres
   - Comportamiento típico del usuario en esa plataforma
   - Formato esperado (asunto, titular, CTA, etc.)
4. **Entrega** las versiones en formato estructurado, listas para copiar y pegar.
5. **Explica** brevemente las decisiones de adaptación para cada canal si el usuario lo solicita.

## Formato de Salida

Para cada canal, presenta:
```
### [NOMBRE DEL CANAL]
[Versión adaptada, con etiquetas claras para cada campo]
```

## Instrucciones Clave

- Mantén siempre la propuesta de valor y el CTA principal.
- Ajusta el tono según la intimidad del canal (SMS es más directo que email).
- Nunca truncues información crítica; redistribuye si el canal es corto.
- Si falta información sobre el tono de marca, pregunta antes de generar.
- Incluye variantes A/B cuando el canal lo permita (ej: 2 asuntos de email).
- Si el usuario no especifica canales, genera para todos los canales principales.
