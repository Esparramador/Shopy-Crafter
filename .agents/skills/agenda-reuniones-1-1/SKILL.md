---
name: agenda-reuniones-1-1
description: |
  Crea agendas personalizadas y estructuradas para reuniones 1:1 entre manager y colaborador, entre socios, o entre cliente y proveedor. Incluye objetivos claros, puntos de discusión, preguntas de check-in, seguimiento de acuerdos anteriores y tiempo estimado por bloque.
---

# Agenda Personalizada para Reuniones 1:1

Genera agendas detalladas y accionables para reuniones 1:1, adaptadas al contexto y relación entre los participantes.

## Tipos de Reuniones 1:1 Soportados

- **Manager → Colaborador**: desarrollo profesional, feedback, bloqueos, alineación
- **Socios / Co-fundadores**: estrategia, decisiones, conflictos, roadmap
- **Cliente → Proveedor / Agencia**: revisión de entregables, expectativas, resultados
- **Mentor → Mentee**: orientación, progreso, objetivos personales
- **Retrospectiva personal de equipo**: revisión quincenal/mensual de OKRs

## Estructura Estándar de la Agenda

### 1. Check-in (5 min)
Pregunta abierta para conectar antes de entrar en el trabajo.
*Ejemplo: "¿Cómo estás llegando hoy a esta reunión, en una escala del 1 al 10, y por qué?"*

### 2. Seguimiento de acuerdos anteriores (5-10 min)
Revisar los puntos de acción de la reunión anterior. ¿Qué se completó? ¿Qué quedó pendiente?

### 3. Agenda del colaborador — primero (10-15 min)
El espacio es del colaborador. ¿Qué necesita discutir, desbloquear o compartir?

### 4. Agenda del manager / anfitrión (10-15 min)
Actualizaciones del equipo, feedback, alineación estratégica, proyectos en curso.

### 5. Desarrollo y crecimiento (5-10 min)
Solo en reuniones quincenales o mensuales: objetivos, carrera, aprendizaje.

### 6. Compromisos y próximos pasos (5 min)
Definir acciones concretas con responsable y fecha límite.

### 7. Check-out (2 min)
Pregunta de cierre para evaluar la calidad de la reunión.

## Flujo de Trabajo

1. **Recibe** de el usuario:
   - Tipo de relación (manager/colaborador, socios, cliente/agencia, etc.)
   - Frecuencia (semanal, quincenal, mensual)
   - Duración disponible (30, 45, 60 min)
   - Contexto específico: proyectos en curso, temas urgentes, feedback pendiente, etc.
   - Tono deseado (formal, casual, de desarrollo, estratégico)

2. **Genera** la agenda completa con:
   - Bloques de tiempo asignados según la duración total
   - 3-5 preguntas concretas por bloque
   - Espacio para notas y acuerdos
   - Sección de seguimiento

3. **Entrega** en formato listo para copiar (puede ser texto, tabla, o Notion-ready Markdown).

## Formato de Salida

```markdown
## Reunión 1:1 — [Nombre A] ↔ [Nombre B]
📅 Fecha: [fecha] | ⏱ Duración: [X min] | 🔄 Frecuencia: [semanal/quincenal/mensual]

---
### ✅ Seguimiento sesión anterior (X min)
- [ ] [Acción pendiente 1] — [Responsable]
- [ ] [Acción pendiente 2] — [Responsable]

### 💬 Check-in (X min)
Pregunta: [Pregunta de apertura personalizada]

### 📋 Agenda de [Colaborador/Participante B] (X min)
1. [Tema libre — espacio para lo que necesiten]
2. [Bloqueos o necesidades de apoyo]
3. [Logros que quiere compartir]

### 📌 Agenda de [Manager/Participante A] (X min)
1. [Feedback sobre [proyecto específico]]
2. [Actualización estratégica]
3. [Alineación de prioridades]

### 🚀 Desarrollo profesional (X min) *(si aplica)*
- [Pregunta sobre objetivo trimestral]
- [Pregunta sobre aprendizaje reciente]

### 📝 Compromisos y próximos pasos
| Acción | Responsable | Fecha límite |
|--------|-------------|--------------|
| | | |

### 🔚 Check-out (2 min)
Pregunta: [Pregunta de cierre]
```

## Instrucciones Clave

- Si no conoces el contexto, haz 2-3 preguntas antes de generar la agenda.
- Adapta el lenguaje al tipo de relación (más formal con clientes, más directo entre socios).
- Incluye preguntas abiertas que fomenten la reflexión, no solo reportes de estado.
- Sugiere el formato de seguimiento (Notion, email, Google Doc) si el usuario lo solicita.
- Para reuniones de 30 min, reduce a 3 bloques principales y elimina el bloque de desarrollo.
