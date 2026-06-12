import type { ModelAnimation } from "@/components/ModelViewer3D";

export interface MeshyCharacter {
  id: string;
  name: string;
  emoji: string;
  category: "cartoon" | "realistic";
  description: string;
  tags: string[];
  glbPath: string;
  rigStatus: "rigged" | "pending";
  animations: ModelAnimation[];
}

// ── Animation definitions (20 action_ids) ─────────────────────────────────────

export interface AnimDef {
  action_id: number;
  id: string;
  name: string;
  label: string;
  label_short: string;
  category: string;
  visme_phase: "intro" | "idle" | "interact" | "success" | "transit" | "react" | "outro";
  looping: boolean;
  duration_ms: number;
  best_for: string[];
  prompt_hint: string;
  triggers: string[];
  file?: string; // relative path within /assets/3d/animations/{char}/
}

export const ALL_ANIMATIONS: AnimDef[] = [
  { action_id:  1, id:"walk",        name:"Walk",          label:"🚶 Caminar",        label_short:"Walk",     category:"locomotion",  visme_phase:"transit",  looping:true,  duration_ms:1200, best_for:["transición entre pasos","formulario multi-step","progreso visual"],     prompt_hint:"humanoid character in natural walking pose, arms slightly swinging, relaxed stride, full body visible",                               triggers:["on_step_change","on_scroll","on_transition"] },
  { action_id:  2, id:"alert",       name:"Alert",         label:"⚠️ Alerta",         label_short:"Alert",    category:"action",      visme_phase:"interact", looping:false, duration_ms:1500, best_for:["validación de error","campo requerido","advertencia"],                   prompt_hint:"humanoid character in alert standing pose, body slightly tense, head turned",                                                         triggers:["on_error","on_validation_fail","on_required_field"] },
  { action_id:  3, id:"arise",       name:"Arise",         label:"⬆️ Levantarse",     label_short:"Arise",    category:"entrance",    visme_phase:"intro",    looping:false, duration_ms:1200, best_for:["aparición inicial","hero section","primera impresión"],                  prompt_hint:"humanoid character rising from ground, arms lifting, triumphant entrance, A-pose ready",                                              triggers:["on_page_load","on_scroll_enter","on_section_visible"] },
  { action_id:  4, id:"idle",        name:"Idle",          label:"🧍 Reposo",         label_short:"Idle",     category:"waiting",     visme_phase:"idle",     looping:true,  duration_ms:3000, best_for:["estado por defecto","sin interacción","carga"],                          prompt_hint:"humanoid character in relaxed standing position, weight on one leg, neutral expression",                                               triggers:["on_idle","on_default","continuous_loop"] },
  { action_id:  5, id:"idle_breath", name:"Idle_Breathing",label:"💨 Respirar",       label_short:"Breath",   category:"waiting",     visme_phase:"idle",     looping:true,  duration_ms:4000, best_for:["espera natural","vida realista","formulario abierto"],                    prompt_hint:"humanoid character in natural standing pose, subtle chest movement, calm expression",                                                  triggers:["on_form_open","on_idle_long","continuous_subtle"] },
  { action_id:  6, id:"wave",        name:"Wave",          label:"👋 Saludar",        label_short:"Wave",     category:"entrance",    visme_phase:"intro",    looping:false, duration_ms:1800, best_for:["bienvenida","inicio de formulario","onboarding"],                         prompt_hint:"friendly humanoid character waving hand, welcoming gesture, smiling expression",                                                       triggers:["on_first_visit","on_form_start","on_welcome"] },
  { action_id:  7, id:"thumbs_up",   name:"Thumbs_Up",     label:"👍 Pulgar arriba",  label_short:"Thumbs",   category:"celebration", visme_phase:"success",  looping:false, duration_ms:1200, best_for:["confirmación de paso","campo correcto","validación exitosa"],             prompt_hint:"humanoid character giving thumbs up, confident posture, approving expression",                                                         triggers:["on_step_complete","on_field_valid","on_small_win"] },
  { action_id:  8, id:"clap",        name:"Clapping",      label:"👏 Aplaudir",       label_short:"Clap",     category:"celebration", visme_phase:"success",  looping:false, duration_ms:2500, best_for:["formulario completado","compra confirmada","meta alcanzada"],             prompt_hint:"humanoid character clapping hands, joyful expression, energetic applause movement",                                                    triggers:["on_form_submit","on_purchase_complete","on_goal_reached"] },
  { action_id:  9, id:"dance",       name:"Dance",         label:"💃 Bailar",         label_short:"Dance",    category:"celebration", visme_phase:"success",  looping:true,  duration_ms:4000, best_for:["celebración máxima","resultado excepcional","éxito viral"],              prompt_hint:"humanoid character in joyful dance pose, arms and legs in motion, dynamic movement",                                                   triggers:["on_big_win","on_exceptional_result","on_viral_share"] },
  { action_id: 10, id:"point",       name:"Point_Forward", label:"☝️ Señalar",        label_short:"Point",    category:"action",      visme_phase:"interact", looping:false, duration_ms:1500, best_for:["señalar CTA","indicar siguiente paso","guiar atención"],                  prompt_hint:"humanoid character pointing finger forward, directing gaze, confident stance",                                                         triggers:["on_cta_appear","on_next_step","on_attention_guide"] },
  { action_id: 11, id:"think",       name:"Thinking",      label:"🤔 Pensar",         label_short:"Think",    category:"waiting",     visme_phase:"idle",     looping:true,  duration_ms:5000, best_for:["procesando datos","cargando resultado","IA pensando"],                   prompt_hint:"humanoid character in thinking pose, hand on chin, tilted head, contemplative expression",                                             triggers:["on_loading","on_ai_processing","on_wait_long"] },
  { action_id: 12, id:"victory",     name:"Victory",       label:"🏆 Victoria",       label_short:"Victory",  category:"celebration", visme_phase:"success",  looping:false, duration_ms:2000, best_for:["conversión completada","pago realizado","suscripción activa"],            prompt_hint:"humanoid character in victory pose, arms raised triumphantly, powerful stance",                                                        triggers:["on_conversion","on_payment_success","on_subscription_active"] },
  { action_id: 13, id:"sit",         name:"Sit",           label:"🪑 Sentarse",       label_short:"Sit",      category:"waiting",     visme_phase:"idle",     looping:true,  duration_ms:0,    best_for:["lectura de contenido","revisión de datos","checkout largo"],              prompt_hint:"humanoid character sitting comfortably, relaxed posture, hands on lap",                                                                triggers:["on_content_read","on_long_form","on_checkout_review"] },
  { action_id: 14, id:"look_around", name:"Look_Around",   label:"👀 Mirar",          label_short:"Look",     category:"waiting",     visme_phase:"idle",     looping:true,  duration_ms:4000, best_for:["exploración del producto","navegación","browsing"],                       prompt_hint:"humanoid character curiously looking around, engaged expression, scanning movement",                                                    triggers:["on_page_browse","on_product_view","on_exploration"] },
  { action_id: 15, id:"kick",        name:"Kick",          label:"🦵 Patear",         label_short:"Kick",     category:"action",      visme_phase:"interact", looping:false, duration_ms:800,  best_for:["acción enérgica","botón de impacto","CTA agresivo"],                      prompt_hint:"humanoid character in dynamic kick pose, powerful leg movement, athletic stance",                                                      triggers:["on_power_cta","on_aggressive_action","on_impact_moment"] },
  { action_id: 16, id:"punch",       name:"Punch",         label:"👊 Golpear",        label_short:"Punch",    category:"action",      visme_phase:"interact", looping:false, duration_ms:700,  best_for:["acción de fuerza","superhéroe","impacto dramático"],                      prompt_hint:"humanoid character in punching pose, arm extended forward, powerful stance",                                                           triggers:["on_hero_action","on_super_cta","on_dramatic_moment"] },
  { action_id: 17, id:"crouch",      name:"Crouch",        label:"🦸 Agacharse",      label_short:"Crouch",   category:"entrance",    visme_phase:"intro",    looping:false, duration_ms:1000, best_for:["entrada dramática de superhéroe","landing de impacto","reveal épico"],    prompt_hint:"humanoid character in crouching hero landing pose, one knee down, dramatic entrance",                                                  triggers:["on_hero_reveal","on_dramatic_entrance","on_epic_intro"] },
  { action_id: 18, id:"celebrate",   name:"Celebrate_Arms",label:"🙌 Celebrar",       label_short:"Celeb",    category:"celebration", visme_phase:"success",  looping:false, duration_ms:2000, best_for:["éxito de formulario","lead capturado","email confirmado"],                prompt_hint:"humanoid character raising both arms in celebration, joyful expression, open arms wide",                                               triggers:["on_lead_captured","on_email_confirmed","on_form_success"] },
  { action_id: 19, id:"nod",         name:"Head_Nod",      label:"😌 Asentir",        label_short:"Nod",      category:"emotion",     visme_phase:"react",    looping:false, duration_ms:1000, best_for:["confirmación leve","acuerdo con términos","check positivo"],              prompt_hint:"humanoid character nodding head in agreement, pleasant expression, approving gesture",                                                 triggers:["on_terms_accept","on_minor_confirm","on_positive_feedback"] },
  { action_id: 20, id:"shake_head",  name:"Shake_Head",    label:"😤 Negar",          label_short:"Shake",    category:"emotion",     visme_phase:"react",    looping:false, duration_ms:1000, best_for:["error de formulario","campo inválido","límite superado"],                 prompt_hint:"humanoid character shaking head in disapproval, slightly frowning, negative gesture",                                                  triggers:["on_error","on_limit_exceeded","on_invalid_input"] },
];

export const ANIM_CATEGORIES = [
  { id: "entrance",    label: "🎬 Entrada",      phase: "intro"    },
  { id: "waiting",     label: "🧍 Espera/Idle",  phase: "idle"     },
  { id: "action",      label: "👆 Acción",        phase: "interact" },
  { id: "celebration", label: "🎉 Celebración",   phase: "success"  },
  { id: "locomotion",  label: "🚶 Locomoción",    phase: "transit"  },
  { id: "emotion",     label: "😄 Emociones",     phase: "react"    },
];

// Visme-style flow templates
export interface FlowTemplate {
  id: string;
  name: string;
  description: string;
  stages: {
    intro: { action_id: number; id: string; label: string };
    idle: { action_id: number; id: string; label: string };
    interact: { action_id: number; id: string; label: string };
    success: { action_id: number; id: string; label: string };
  };
}

export const FLOW_TEMPLATES: FlowTemplate[] = [
  {
    id: "shopify_lead",
    name: "🛍️ Lead Form Shopify",
    description: "Captura de lead: bienvenida → espera → señala CTA → celebra",
    stages: {
      intro:    { action_id:  6, id:"wave",       label:"👋 Saluda" },
      idle:     { action_id:  5, id:"idle_breath",label:"💨 Respira" },
      interact: { action_id: 10, id:"point",      label:"☝️ Señala CTA" },
      success:  { action_id: 18, id:"celebrate",  label:"🙌 Lead capturado" },
    }
  },
  {
    id: "checkout",
    name: "🛒 Checkout / Compra",
    description: "Flujo de compra: aparece → piensa → aprueba → victoria",
    stages: {
      intro:    { action_id:  3, id:"arise",      label:"⬆️ Aparece" },
      idle:     { action_id: 11, id:"think",      label:"🤔 Procesando" },
      interact: { action_id:  7, id:"thumbs_up",  label:"👍 Confirma" },
      success:  { action_id: 12, id:"victory",    label:"🏆 Pago exitoso" },
    }
  },
  {
    id: "hero_landing",
    name: "🦸 Héroe Landing Page",
    description: "Entrada épica: aterrizaje → pose → acción → baile",
    stages: {
      intro:    { action_id: 17, id:"crouch",     label:"🦸 Aterriza" },
      idle:     { action_id:  4, id:"idle",       label:"🧍 Pose heroica" },
      interact: { action_id: 16, id:"punch",      label:"👊 Acción" },
      success:  { action_id:  9, id:"dance",      label:"💃 Celebra" },
    }
  },
  {
    id: "onboarding",
    name: "👋 Onboarding Amigable",
    description: "Guía al usuario: saluda → explora → avanza → asiente",
    stages: {
      intro:    { action_id:  6, id:"wave",        label:"👋 Hola!" },
      idle:     { action_id: 14, id:"look_around", label:"👀 Explora" },
      interact: { action_id:  1, id:"walk",        label:"🚶 Avanza" },
      success:  { action_id: 19, id:"nod",         label:"😌 Confirma" },
    }
  },
  {
    id: "error_flow",
    name: "❌ Corrección de Errores",
    description: "Manejo de errores: alerta → revisa → niega → aplaude",
    stages: {
      intro:    { action_id:  2, id:"alert",       label:"⚠️ Atención!" },
      idle:     { action_id: 14, id:"look_around", label:"👀 Revisa" },
      interact: { action_id: 20, id:"shake_head",  label:"😤 Incorrecto" },
      success:  { action_id:  8, id:"clap",        label:"👏 Corregido!" },
    }
  },
  {
    id: "social_proof",
    name: "⭐ Social Proof / Reviews",
    description: "Presenta reseñas: baila → reposo → señala → pulgar",
    stages: {
      intro:    { action_id:  9, id:"dance",      label:"💃 Energía!" },
      idle:     { action_id:  4, id:"idle",       label:"🧍 Reposo" },
      interact: { action_id: 10, id:"point",      label:"☝️ Mira esto" },
      success:  { action_id:  7, id:"thumbs_up",  label:"👍 Recomendado" },
    }
  },
];

export type FlowStage = "intro" | "idle" | "interact" | "success";

export const FLOW_STAGE_LABELS: Record<FlowStage, { label: string; icon: string; color: string }> = {
  intro:    { label: "Entrada",     icon: "🎬", color: "#d4a843" },
  idle:     { label: "Espera",      icon: "🧍", color: "#60a5fa" },
  interact: { label: "Interacción", icon: "👆", color: "#a78bfa" },
  success:  { label: "Éxito",       icon: "🎉", color: "#34d399" },
};

// Character prompts for generating riggable characters
export const CHARACTER_PROMPTS = [
  {
    id: "humanoid_realistic",
    label: "👔 Humano Realista",
    subtitle: "Compatible con todas las animaciones",
    base_prompt: "full body humanoid character, A-pose, realistic proportions, clear facial features, professional look, symmetric body structure, game-ready 3D model, no floating accessories, clear joint separation at shoulders hips knees",
    negative: "cartoon, deformed limbs, floating accessories, asymmetric, no neck, merged legs",
    tip: "Usa A-pose — mejor compatibilidad con auto-rig de Meshy",
    compatible_actions: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20],
  },
  {
    id: "cartoon_humanoid",
    label: "🎨 Cartoon Humanoide",
    subtitle: "Compatible con rig (proporciones humanoides)",
    base_prompt: "full body cartoon character, bipedal humanoid proportions, A-pose, oversized head small body acceptable, clear arm and leg separation, no extra limbs, simple clothing without complex accessories, clear neck visible",
    negative: "quadruped, tentacles, floating parts, non-humanoid, merged limbs, complex hair blocking neck",
    tip: "Los cartoon necesitan proporciones humanoides para el auto-rig",
    compatible_actions: [1,2,3,4,5,6,7,8,9,10,11,12,14,15,16,17,18,19,20],
  },
  {
    id: "superhero",
    label: "🦸 Superhéroe",
    subtitle: "Optimizado para punch/crouch/victory",
    base_prompt: "full body superhero character, muscular humanoid build, A-pose, tight fitting suit no loose elements, athletic proportions, clear joint definition at shoulders and hips, caped optional but tucked",
    negative: "loose flowing cape, bulky accessories blocking arms, non-humanoid, merged body parts",
    tip: "Traje ajustado funciona mejor que capas sueltas para animaciones de acción",
    compatible_actions: [1,3,4,6,7,8,9,10,12,15,16,17,18,19],
  },
  {
    id: "bear_humanoid",
    label: "🐻 Animal Humanoide",
    subtitle: "Estilo TED — bípedo con proporciones humanoides",
    base_prompt: "full body bipedal animal character, humanoid standing pose, A-pose, plush toy or cartoon aesthetic, round body with clear arm and leg separation, stubby humanoid limbs, no accessories blocking joints",
    negative: "on all fours, quadruped pose, non-bipedal, merged legs, complex fur accessories",
    tip: "TED funciona bien — pose bípeda + proporciones humanoides son clave",
    compatible_actions: [1,3,4,6,7,8,9,10,12,14,18,19,20],
  },
];

// Real GLB files per character (from actual downloaded files)
const CHAR_ANIMATIONS: Record<string, ModelAnimation[]> = {
  alec_monopoly: [
    { name:"walk",        label:"🚶 Caminar",   glbPath:"/assets/3d/animations/alec_monopoly/walk.glb",        looping:true  },
    { name:"run",         label:"🏃 Correr",    glbPath:"/assets/3d/animations/alec_monopoly/run.glb",         looping:true  },
    { name:"jump",        label:"⬆ Saltar",    glbPath:"/assets/3d/animations/alec_monopoly/jump.glb",        looping:false },
    { name:"wave",        label:"👋 Saludar",   glbPath:"/assets/3d/animations/alec_monopoly/wave.glb",        looping:false },
    { name:"idle",        label:"🧍 Reposo",    glbPath:"/assets/3d/animations/alec_monopoly/idle.glb",        looping:true  },
    { name:"idle_breath", label:"💨 Respirar",  glbPath:"/assets/3d/animations/alec_monopoly/idle_breath.glb", looping:true  },
    { name:"dance",       label:"💃 Bailar",    glbPath:"/assets/3d/animations/alec_monopoly/dance.glb",       looping:true  },
    { name:"victory",     label:"🏆 Victoria",  glbPath:"/assets/3d/animations/alec_monopoly/victory.glb",     looping:false },
    { name:"clap",        label:"👏 Aplaudir",  glbPath:"/assets/3d/animations/alec_monopoly/clap.glb",        looping:false },
    { name:"thumbs_up",   label:"👍 Pulgar",    glbPath:"/assets/3d/animations/alec_monopoly/thumbs_up.glb",   looping:false },
    { name:"point",       label:"☝️ Señalar",   glbPath:"/assets/3d/animations/alec_monopoly/point.glb",       looping:false },
    { name:"think",       label:"🤔 Pensar",    glbPath:"/assets/3d/animations/alec_monopoly/think.glb",       looping:true  },
    { name:"look_around", label:"👀 Mirar",     glbPath:"/assets/3d/animations/alec_monopoly/look_around.glb", looping:true  },
    { name:"sit",         label:"🪑 Sentarse",  glbPath:"/assets/3d/animations/alec_monopoly/sit.glb",         looping:true  },
    { name:"alert",       label:"⚠️ Alerta",    glbPath:"/assets/3d/animations/alec_monopoly/alert.glb",       looping:false },
    { name:"arise",       label:"⬆️ Levantarse",glbPath:"/assets/3d/animations/alec_monopoly/arise.glb",       looping:false },
    { name:"kick",        label:"🦵 Patear",    glbPath:"/assets/3d/animations/alec_monopoly/kick.glb",        looping:false },
    { name:"punch",       label:"👊 Golpear",   glbPath:"/assets/3d/animations/alec_monopoly/punch.glb",       looping:false },
  ],
  batman: [
    { name:"walk",  label:"🚶 Caminar",  glbPath:"/assets/3d/animations/batman/walk.glb",  looping:true  },
    { name:"run",   label:"🏃 Correr",   glbPath:"/assets/3d/animations/batman/run.glb",   looping:true  },
    { name:"jump",  label:"⬆ Saltar",   glbPath:"/assets/3d/animations/batman/jump.glb",  looping:false },
  ],
  chico_casual: [
    { name:"walk",       label:"🚶 Caminar",    glbPath:"/assets/3d/animations/chico_casual/walk.glb",        looping:true  },
    { name:"run",        label:"🏃 Correr",     glbPath:"/assets/3d/animations/chico_casual/run.glb",         looping:true  },
    { name:"jump",       label:"⬆ Saltar",     glbPath:"/assets/3d/animations/chico_casual/jump.glb",        looping:false },
    { name:"wave",       label:"👋 Saludar",    glbPath:"/assets/3d/animations/chico_casual/wave.glb",        looping:false },
    { name:"idle_breath",label:"💨 Respirar",   glbPath:"/assets/3d/animations/chico_casual/idle_breath.glb", looping:true  },
    { name:"dance",      label:"💃 Bailar",     glbPath:"/assets/3d/animations/chico_casual/dance.glb",       looping:true  },
    { name:"victory",    label:"🏆 Victoria",   glbPath:"/assets/3d/animations/chico_casual/victory.glb",     looping:false },
    { name:"clap",       label:"👏 Aplaudir",   glbPath:"/assets/3d/animations/chico_casual/clap.glb",        looping:false },
    { name:"thumbs_up",  label:"👍 Pulgar",     glbPath:"/assets/3d/animations/chico_casual/thumbs_up.glb",   looping:false },
    { name:"point",      label:"☝️ Señalar",    glbPath:"/assets/3d/animations/chico_casual/point.glb",       looping:false },
    { name:"alert",      label:"⚠️ Alerta",     glbPath:"/assets/3d/animations/chico_casual/alert.glb",       looping:false },
    { name:"celebrate",  label:"🙌 Celebrar",   glbPath:"/assets/3d/animations/chico_casual/celebrate.glb",   looping:false },
    { name:"kick",       label:"🦵 Patear",     glbPath:"/assets/3d/animations/chico_casual/kick.glb",        looping:false },
    { name:"crouch",     label:"🦸 Agacharse",  glbPath:"/assets/3d/animations/chico_casual/crouch.glb",      looping:false },
    { name:"nod",        label:"😌 Asentir",    glbPath:"/assets/3d/animations/chico_casual/nod.glb",         looping:false },
    { name:"shake_head", label:"😤 Negar",      glbPath:"/assets/3d/animations/chico_casual/shake_head.glb",  looping:false },
  ],
  chico_formal: [
    { name:"walk",    label:"🚶 Caminar",    glbPath:"/assets/3d/animations/chico_formal/walk.glb",     looping:true  },
    { name:"run",     label:"🏃 Correr",     glbPath:"/assets/3d/animations/chico_formal/run.glb",      looping:true  },
    { name:"jump",    label:"⬆ Saltar",     glbPath:"/assets/3d/animations/chico_formal/jump.glb",     looping:false },
    { name:"dance",   label:"💃 Bailar",     glbPath:"/assets/3d/animations/chico_formal/dance.glb",    looping:true  },
    { name:"victory", label:"🏆 Victoria",   glbPath:"/assets/3d/animations/chico_formal/victory.glb",  looping:false },
    { name:"kick",    label:"🦵 Patear",     glbPath:"/assets/3d/animations/chico_formal/kick.glb",     looping:false },
    { name:"punch",   label:"👊 Golpear",    glbPath:"/assets/3d/animations/chico_formal/punch.glb",    looping:false },
    { name:"crouch",  label:"🦸 Agacharse",  glbPath:"/assets/3d/animations/chico_formal/crouch.glb",   looping:false },
    { name:"celebrate",label:"🙌 Celebrar",  glbPath:"/assets/3d/animations/chico_formal/celebrate.glb",looping:false },
    { name:"look_around",label:"👀 Mirar",   glbPath:"/assets/3d/animations/chico_formal/look_around.glb",looping:true },
  ],
  ted: [
    { name:"walk",  label:"🚶 Caminar",  glbPath:"/assets/3d/animations/ted/walk.glb",  looping:true  },
    { name:"run",   label:"🏃 Correr",   glbPath:"/assets/3d/animations/ted/run.glb",   looping:true  },
    { name:"jump",  label:"⬆ Saltar",   glbPath:"/assets/3d/animations/ted/jump.glb",  looping:false },
  ],
};

export const MESHY_CHARACTERS: MeshyCharacter[] = [
  { id:"batman",          name:"Batman",              emoji:"🦇", category:"cartoon",   description:"El Caballero de la Noche. 3 animaciones.",                   tags:["superhéroe","dc","acción","rigged"],             glbPath:"/assets/3d/models/batman.glb",          rigStatus:"rigged",  animations: CHAR_ANIMATIONS.batman         },
  { id:"alec_monopoly",   name:"Alec Monopoly",       emoji:"🎩", category:"cartoon",   description:"El artista urbano. 18 animaciones completas.",               tags:["arte","urbano","cartoon","rigged"],              glbPath:"/assets/3d/models/alec_monopoly.glb",   rigStatus:"rigged",  animations: CHAR_ANIMATIONS.alec_monopoly  },
  { id:"ted",             name:"TED (Oso)",            emoji:"🐻", category:"cartoon",   description:"El osito más famoso. 3 animaciones.",                        tags:["oso","humor","cartoon","rigged"],                glbPath:"/assets/3d/models/ted.glb",             rigStatus:"rigged",  animations: CHAR_ANIMATIONS.ted            },
  { id:"chico_casual",    name:"Hombre Casual Tech",   emoji:"👨‍💻", category:"realistic", description:"Dev casual. 16 animaciones completas.",                     tags:["humano","casual","tech","rigged"],               glbPath:"/assets/3d/models/chico_casual.glb",    rigStatus:"rigged",  animations: CHAR_ANIMATIONS.chico_casual   },
  { id:"chico_formal",    name:"Hombre Traje Formal",  emoji:"🤵", category:"realistic", description:"Ejecutivo con traje. 10 animaciones.",                       tags:["humano","formal","corporativo","rigged"],        glbPath:"/assets/3d/models/chico_formal.glb",    rigStatus:"rigged",  animations: CHAR_ANIMATIONS.chico_formal   },
  { id:"spiderman",       name:"Spider-Man",           emoji:"🕷️", category:"cartoon",   description:"El Hombre Araña. Modelo 3D (rig pendiente).",                tags:["marvel","superhéroe","acción"],                  glbPath:"/assets/3d/models/spiderman.glb",       rigStatus:"pending", animations:[] },
  { id:"bob_esponja",     name:"Bob Esponja",          emoji:"🧽", category:"cartoon",   description:"La esponja de Fondo de Bikini.",                             tags:["nickelodeon","cartoon","humor"],                 glbPath:"/assets/3d/models/bob_esponja.glb",     rigStatus:"pending", animations:[] },
  { id:"mickey_mouse",    name:"Mickey Mouse",         emoji:"🐭", category:"cartoon",   description:"El personaje más icónico de Disney.",                        tags:["disney","cartoon","clásico"],                   glbPath:"/assets/3d/models/mickey_mouse.glb",    rigStatus:"pending", animations:[] },
  { id:"payaso_plim_plim",name:"Plim Plim",            emoji:"🤡", category:"cartoon",   description:"El payaso mágico para niños.",                               tags:["infantil","cartoon","latam"],                   glbPath:"/assets/3d/models/payaso_plim_plim.glb",rigStatus:"pending", animations:[] },
  { id:"minnie_mouse",    name:"Minnie Mouse",         emoji:"🎀", category:"cartoon",   description:"La ratoncita elegante de Disney.",                           tags:["disney","cartoon","clásico"],                   glbPath:"/assets/3d/models/minnie_mouse.glb",    rigStatus:"pending", animations:[] },
  { id:"bugs_bunny",      name:"Bugs Bunny",           emoji:"🐰", category:"cartoon",   description:"El conejo de Looney Tunes.",                                 tags:["warner","cartoon","clásico"],                   glbPath:"/assets/3d/models/bugs_bunny.glb",      rigStatus:"pending", animations:[] },
  { id:"pikachu",         name:"Pikachu",              emoji:"⚡", category:"cartoon",   description:"El Pokémon eléctrico más amado.",                            tags:["pokemon","nintendo","cartoon"],                 glbPath:"/assets/3d/models/pikachu.glb",         rigStatus:"pending", animations:[] },
  { id:"chica_ejecutiva", name:"Mujer Ejecutiva",      emoji:"👩‍💼", category:"realistic", description:"Profesional corporativa.",                                   tags:["humano","ejecutiva","corporativo"],              glbPath:"/assets/3d/models/chica_ejecutiva.glb", rigStatus:"pending", animations:[] },
  { id:"chica_creativa",  name:"Mujer Creativa",       emoji:"👩‍🎨", category:"realistic", description:"Diseñadora de agencia.",                                     tags:["humano","creativa","agencia"],                  glbPath:"/assets/3d/models/chica_creativa.glb",  rigStatus:"pending", animations:[] },
];

export const RIGGED_CHARACTERS = MESHY_CHARACTERS.filter(c => c.rigStatus === "rigged");
export const PENDING_CHARACTERS = MESHY_CHARACTERS.filter(c => c.rigStatus === "pending");

// Get animations for a character filtered by visme phase
export function getAnimsByPhase(charId: string, phase: string): ModelAnimation[] {
  const char = MESHY_CHARACTERS.find(c => c.id === charId);
  if (!char) return [];
  const phaseDefs = ALL_ANIMATIONS.filter(a => a.visme_phase === phase);
  const ids = phaseDefs.map(a => a.id);
  return char.animations.filter(a => ids.includes(a.name));
}

// Resolve animation GLB path for a character + action_id
export function resolveAnimGlb(charId: string, actionId: number): string | null {
  const animDef = ALL_ANIMATIONS.find(a => a.action_id === actionId);
  if (!animDef) return null;
  const char = MESHY_CHARACTERS.find(c => c.id === charId);
  const anim = char?.animations.find(a => a.name === animDef.id);
  return anim?.glbPath ?? null;
}

// Get best animation available for a flow stage
export function getBestAnimForStage(charId: string, stage: FlowStage, template: FlowTemplate): ModelAnimation | null {
  const stageConfig = template.stages[stage];
  const glbPath = resolveAnimGlb(charId, stageConfig.action_id);
  if (!glbPath) return null;
  return { name: stageConfig.id, label: stageConfig.label, glbPath, looping: stage === "idle" };
}
