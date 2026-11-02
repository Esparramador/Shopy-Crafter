// Acciones del cerebro — Usuarios, mensajes, aprobaciones, automatizaciones, flujos de email y calendario.
// Extraídas tal cual del switch de POST /shopybrain/execute-action (routes/shopybrain.ts).
/* eslint-disable @typescript-eslint/no-explicit-any */

import { NOT_HANDLED, type BrainActionCtx, type BrainActionOutcome } from "./action-context.js";

export async function runAdminActions(ctx: BrainActionCtx): Promise<BrainActionOutcome> {
  const { req, res, action, params, resolveStripeAccountId } = ctx;
  let result: Record<string, unknown> = {};
      switch (action) {
        case "list_users": {
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/admin/users`, { headers: { cookie: req.headers.cookie ?? "" } });
            const users = await resp.json() as Array<Record<string, unknown>>;
            if (!resp.ok) { result = { error: true, message: "❌ Error al listar usuarios" }; break; }
            const summary = (users as Array<Record<string, unknown>>).map((u: Record<string, unknown>) =>
              `• ${u.name} (${u.email}) — rol: ${u.role}, activo: ${u.isActive ? "✅" : "❌"}, último login: ${u.lastLogin || "nunca"}`
            ).join("\n");
            result = { users, total: users.length, message: `👥 **${users.length} usuarios registrados**\n\n${summary}` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "create_user": {
          const email = params?.email;
          const name = params?.name || "Cliente";
          const password = params?.password;
          if (!email) { result = { error: true, message: "❌ Falta email del usuario" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/admin/users`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
              body: JSON.stringify({ email, name, role: "client", password }),
            });
            const data = await resp.json() as Record<string, unknown>;
            if (!resp.ok) { result = { error: true, message: `❌ ${data.error ?? "Error creando usuario"}` }; break; }
            result = { ...data, message: `✅ **Usuario creado**\n\n📧 Email: ${email}\n👤 Nombre: ${name}\n🔑 Rol: client` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "invite_client": {
          const projectId = params?.projectId;
          const email = params?.email;
          const name = params?.name || "Cliente";
          if (!projectId || !email) { result = { error: true, message: "❌ Falta projectId o email" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/admin/projects/${projectId}/invite`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
              body: JSON.stringify({ email, name }),
            });
            const data = await resp.json() as Record<string, unknown>;
            if (!resp.ok) { result = { error: true, message: `❌ ${data.error ?? "Error invitando cliente"}` }; break; }
            result = { ...data, message: `📨 **Cliente invitado**\n\n📧 ${email}\n👤 ${name}\n🔗 Link: ${data.inviteLink}\n📩 Email enviado: ${data.emailSent ? "Sí" : "No (envía el link manualmente)"}` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "deactivate_user": {
          const userId = params?.userId;
          if (!userId) { result = { error: true, message: "❌ Falta userId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/admin/users/${userId}/deactivate`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
            });
            if (!resp.ok) { result = { error: true, message: "❌ Error desactivando usuario" }; break; }
            result = { message: `🚫 **Usuario ${userId} desactivado** — ya no puede acceder a la plataforma.` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "activate_user": {
          const userId = params?.userId;
          if (!userId) { result = { error: true, message: "❌ Falta userId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/admin/users/${userId}/activate`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
            });
            if (!resp.ok) { result = { error: true, message: "❌ Error activando usuario" }; break; }
            result = { message: `✅ **Usuario ${userId} activado** — acceso restaurado.` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "reset_user_password": {
          const userId = params?.userId;
          const password = params?.password;
          if (!userId || !password) { result = { error: true, message: "❌ Falta userId o password" }; break; }
          // CRIT-5: prevenir self-password reset accidental por OmniChatbot.
          // Para cambiar la propia password el admin debe usar el flujo dedicado de "Mi cuenta".
          // Confirmación ESTRICTA: solo `true` o `"true"` cuentan como confirmación válida
          // (igual que el patrón de `requireConfirmation` para `confirmed`).
          const sessionUserId = (req.session as { userId?: string }).userId;
          const selfResetConfirmed =
            params?.confirmSelfReset === true || params?.confirmSelfReset === "true";
          if (sessionUserId && String(sessionUserId) === String(userId) && !selfResetConfirmed) {
            result = {
              error: true,
              message: "⚠️ **Bloqueado por seguridad:** estás intentando resetear tu propia contraseña desde el chat. Usa la página \"Mi cuenta\" o re-ejecuta esta acción con `confirmSelfReset: true` para confirmar.",
            };
            break;
          }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/admin/users/${userId}/reset-password`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
              body: JSON.stringify({ password }),
            });
            if (!resp.ok) { result = { error: true, message: "❌ Error reseteando contraseña" }; break; }
            result = { message: `🔑 **Contraseña reseteada** para usuario ${userId}` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "list_messages": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/admin/projects/${projectId}/messages`, { headers: { cookie: req.headers.cookie ?? "" } });
            const msgs = await resp.json() as Array<Record<string, unknown>>;
            if (!resp.ok) { result = { error: true, message: "❌ Error al listar mensajes" }; break; }
            const summary = (msgs as Array<Record<string, unknown>>).slice(-10).map((m: Record<string, unknown>) =>
              `[${m.fromRole}] ${m.fromName}: ${String(m.content).slice(0, 100)}`
            ).join("\n");
            result = { messages: msgs, total: msgs.length, message: `💬 **${msgs.length} mensajes** (últimos 10):\n\n${summary || "(sin mensajes)"}` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "send_message": {
          const projectId = params?.projectId;
          const content = params?.content;
          if (!projectId || !content) { result = { error: true, message: "❌ Falta projectId o content" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/admin/projects/${projectId}/messages`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
              body: JSON.stringify({ content }),
            });
            const data = await resp.json() as Record<string, unknown>;
            if (!resp.ok) { result = { error: true, message: "❌ Error enviando mensaje" }; break; }
            result = { ...data, message: `✅ **Mensaje enviado** al proyecto ${projectId}:\n\n"${String(content).slice(0, 200)}"` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "unread_messages": {
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/admin/unread-messages`, { headers: { cookie: req.headers.cookie ?? "" } });
            const data = await resp.json() as Record<string, unknown>;
            if (!resp.ok) { result = { error: true, message: "❌ Error al consultar mensajes" }; break; }
            result = { ...data, message: `📬 **${data.total} mensajes sin leer**` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "list_approvals": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/admin/projects/${projectId}/approvals`, { headers: { cookie: req.headers.cookie ?? "" } });
            const items = await resp.json() as Array<Record<string, unknown>>;
            if (!resp.ok) { result = { error: true, message: "❌ Error al listar aprobaciones" }; break; }
            const summary = (items as Array<Record<string, unknown>>).map((a: Record<string, unknown>) =>
              `• [${a.status}] ${a.title} — ${a.type}`
            ).join("\n");
            result = { approvals: items, total: items.length, message: `📋 **${items.length} aprobaciones**\n\n${summary || "(vacío)"}` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "create_approval": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/admin/projects/${projectId}/approvals`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
              body: JSON.stringify({
                type: params?.type || "change",
                title: params?.title || "Cambio pendiente",
                description: params?.description || "",
                beforeValue: params?.beforeValue,
                afterValue: params?.afterValue,
                reasoning: params?.reasoning,
                estimatedImpact: params?.estimatedImpact,
              }),
            });
            const data = await resp.json() as Record<string, unknown>;
            if (!resp.ok) { result = { error: true, message: "❌ Error creando aprobación" }; break; }
            result = { ...data, message: `📋 **Aprobación creada**: ${params?.title}` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "audit_log": {
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/admin/audit-log`, { headers: { cookie: req.headers.cookie ?? "" } });
            const logs = await resp.json() as Array<Record<string, unknown>>;
            if (!resp.ok) { result = { error: true, message: "❌ Error al consultar audit log" }; break; }
            const summary = (logs as Array<Record<string, unknown>>).slice(0, 15).map((l: Record<string, unknown>) =>
              `• ${l.createdAt} — ${l.action}: ${String(l.details).slice(0, 80)}`
            ).join("\n");
            result = { logs, total: logs.length, message: `📜 **Audit Log** (últimos 15 de ${logs.length}):\n\n${summary}` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "list_automations": {
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/automations/jobs`, { headers: { cookie: req.headers.cookie ?? "" } });
            const jobs = await resp.json() as Array<Record<string, unknown>>;
            if (!resp.ok) { result = { error: true, message: "❌ Error al listar automatizaciones" }; break; }
            const summary = (jobs as Array<Record<string, unknown>>).map((j: Record<string, unknown>) =>
              `• **${j.name}** [${j.status}] — ${j.description}\n  ⏰ Schedule: ${j.schedule} | Próx: ${j.nextRunTime || "?"} | Última: ${j.lastRunTime || "nunca"} (${j.lastRunResult || "-"})`
            ).join("\n");
            result = { jobs, total: jobs.length, message: `⚙️ **${jobs.length} automatizaciones**\n\n${summary}` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "run_automation": {
          const jobId = params?.jobId;
          if (!jobId) { result = { error: true, message: "❌ Falta jobId (ej: 'micro-learning', 'revenue-snapshots', 'inventory-sync')" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/automations/jobs/${jobId}/run`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
            });
            const data = await resp.json() as Record<string, unknown>;
            if (!resp.ok) { result = { error: true, message: `❌ ${data.error ?? "Error ejecutando automatización"}` }; break; }
            result = { ...data, message: `🚀 **Automatización "${jobId}" ejecutada manualmente** — ejecutándose en segundo plano.` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "list_email_flows": {
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const projectId = params?.projectId;
            const url = projectId ? `${baseUrl}/api/emails/flows?projectId=${projectId}` : `${baseUrl}/api/emails/flows`;
            const resp = await fetch(url, { headers: { cookie: req.headers.cookie ?? "" } });
            const flows = await resp.json() as Array<Record<string, unknown>>;
            if (!resp.ok) { result = { error: true, message: "❌ Error al listar flujos de email" }; break; }
            const summary = (flows as Array<Record<string, unknown>>).map((f: Record<string, unknown>) =>
              `• **${f.name}** — tipo: ${f.flow_type}, trigger: ${f.trigger_type}, estado: ${f.status || "draft"}`
            ).join("\n");
            result = { flows, total: flows.length, message: `📧 **${flows.length} flujos de email**\n\n${summary || "(sin flujos)"}` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "create_email_flow": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: true, message: "❌ Falta projectId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/emails/flows`, {
              method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie ?? "" },
              body: JSON.stringify({
                project_id: projectId,
                name: params?.name || "Nuevo flujo",
                flow_type: params?.flowType || "welcome",
                trigger_type: params?.triggerType || "signup",
                send_delay: params?.sendDelay || "1h",
                subject_a: params?.subjectA || "",
                subject_b: params?.subjectB || "",
                preview_text: params?.previewText || "",
                tone: params?.tone || "urgente",
                language: params?.language || "es",
              }),
            });
            const data = await resp.json() as Record<string, unknown>;
            if (!resp.ok) { result = { error: true, message: `❌ ${data.error ?? "Error creando flujo"}` }; break; }
            result = { ...data, message: `✅ **Flujo de email creado**: ${params?.name || "Nuevo flujo"} (${params?.flowType || "welcome"})` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "delete_email_flow": {
          const flowId = params?.flowId;
          if (!flowId) { result = { error: true, message: "❌ Falta flowId" }; break; }
          try {
            const baseUrl = `http://localhost:${process.env.PORT || 8080}`;
            const resp = await fetch(`${baseUrl}/api/emails/flows/${flowId}`, {
              method: "DELETE", headers: { cookie: req.headers.cookie ?? "" },
            });
            if (!resp.ok) { result = { error: true, message: "❌ Error eliminando flujo" }; break; }
            result = { message: `🗑️ **Flujo de email ${flowId} eliminado**` };
          } catch (err) { result = { error: true, message: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }; }
          break;
        }

        case "list_upcoming_appointments": {
          const calPort = process.env.PORT || 8080;
          const calRes = await fetch(`http://localhost:${calPort}/api/calendar/events`, { headers: { cookie: req.headers.cookie || "" } });
          const calData = await calRes.json() as any;
          const upcoming = (calData.appointments || []).filter((a: any) => new Date(a.meeting_date) >= new Date() && a.status !== "cancelled")
            .sort((a: any, b: any) => new Date(a.meeting_date).getTime() - new Date(b.meeting_date).getTime())
            .slice(0, 10);
          if (!upcoming.length) { result = { message: "No hay citas próximas en el calendario." }; break; }
          const lines = upcoming.map((a: any) => {
            const d = new Date(a.meeting_date);
            const dateStr = d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
            const timeStr = d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
            return `📅 **${a.client_name}**${a.company ? ` (${a.company})` : ""} — ${dateStr} a las ${timeStr} · ${a.duration_minutes}min · ${a.status}`;
          });
          result = { message: `Próximas ${upcoming.length} citas:\n\n${lines.join("\n")}` };
          break;
        }

        case "check_calendar_availability": {
          const calPort2 = process.env.PORT || 8080;
          const { date: checkDate, duration: checkDur = 60 } = params || {};
          if (!checkDate) { result = { message: "Indica una fecha (YYYY-MM-DD) para comprobar disponibilidad." }; break; }
          const slotsRes = await fetch(`http://localhost:${calPort2}/api/calendar/slots?date=${checkDate}&duration=${checkDur}`, { headers: { cookie: req.headers.cookie || "" } });
          const slotsData = await slotsRes.json() as any;
          const availableSlots = (slotsData.slots || []).filter((s: any) => s.available);
          if (!availableSlots.length) { result = { message: `No hay huecos disponibles el ${checkDate} para una reunión de ${checkDur}min.` }; break; }
          const slotLabels = availableSlots.map((s: any) => s.label).join(", ");
          result = { message: `El ${checkDate} hay ${availableSlots.length} huecos disponibles (${checkDur}min): **${slotLabels}**\n\n¿Quieres que cree una cita? Dime el nombre del cliente y la hora.` };
          break;
        }

        case "create_appointment": {
          const calPort3 = process.env.PORT || 8080;
          const { client_name: calName, company: calCompany, email: calEmail, phone: calPhone, meeting_date: calDate, meeting_time: calTime = "10:00", duration_minutes: calDur = 60, description: calDesc } = params || {};
          if (!calName || !calDate) { result = { message: "Necesito al menos el nombre del cliente y la fecha (YYYY-MM-DD). ¿Puedes darme esos datos?" }; break; }
          const meetingDateISO = new Date(`${calDate}T${calTime}:00`).toISOString();
          const createRes = await fetch(`http://localhost:${calPort3}/api/calendar/events`, {
            method: "POST", headers: { "Content-Type": "application/json", cookie: req.headers.cookie || "" },
            body: JSON.stringify({ client_name: calName, company: calCompany, email: calEmail, phone: calPhone, meeting_date: meetingDateISO, duration_minutes: calDur, description: calDesc }),
          });
          const createData = await createRes.json() as any;
          if (!createRes.ok) { result = { error: createData.error || "Error creando cita" }; break; }
          const calAppt = createData.appointment;
          const calD = new Date(calAppt.meeting_date);
          result = { message: `✅ **Cita creada** con ${calAppt.client_name}${calAppt.company ? ` (${calAppt.company})` : ""}\n📅 ${calD.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })} a las ${calD.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}\n⏱️ ${calAppt.duration_minutes}min\n${createData.syncedToGoogle ? "📅 Sincronizada con Google Calendar ✓" : "⚠️ Sin sincronizar con Google Calendar (conecta tu cuenta)"}`, appointment: calAppt };
          break;
        }

        case "get_calendar_stats": {
          const calPort4 = process.env.PORT || 8080;
          const statsRes = await fetch(`http://localhost:${calPort4}/api/calendar/stats`, { headers: { cookie: req.headers.cookie || "" } });
          const statsData = await statsRes.json() as any;
          result = { message: `📊 **Estadísticas de Calendario CRM:**\n• Próximas citas: ${statsData.upcoming}\n• Completadas: ${statsData.completed}\n• Pendientes: ${statsData.pending}\n• Total facturado: ${parseFloat(statsData.total_revenue || 0).toFixed(2)}€\n• Duración media: ${statsData.avg_duration ? Math.round(statsData.avg_duration) + "min" : "N/D"}`, stats: statsData };
          break;
        }

        default:
          return NOT_HANDLED;
      }
  return result;
}
