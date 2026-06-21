import type { ModelAnimation } from "@/components/ModelViewer3D";

export interface MeshyCharacter {
  id: string;
  name: string;
  emoji: string;
  category: "cartoon" | "realistic";
  description: string;
  tags: string[];
  glbPath: string;
  rigStatus: "rigged" | "pending" | "missing";
  animations: ModelAnimation[];
  rigTaskId?: string;
  regenPrompt?: { prompt: string; art_style: string };
}

// ── 22 animation definitions (all 20 action_ids + run + jump) ─────────────────

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
}

export const ALL_ANIMATIONS: AnimDef[] = [
  { action_id:  1, id:"walk",        name:"Walk",           label:"🚶 Caminar",        label_short:"Walk",    category:"locomotion",  visme_phase:"transit",  looping:true,  duration_ms:1200, best_for:["transición entre pasos","progreso visual"],             prompt_hint:"humanoid in natural walking pose, arms slightly swinging",                triggers:["on_step_change","on_scroll","on_transition"]   },
  { action_id:  2, id:"alert",       name:"Alert",          label:"⚠️ Alerta",          label_short:"Alert",   category:"action",      visme_phase:"interact", looping:false, duration_ms:1500, best_for:["validación de error","campo requerido"],                 prompt_hint:"humanoid in alert pose, body slightly tense, head turned",                triggers:["on_error","on_validation_fail","on_required"]  },
  { action_id:  3, id:"arise",       name:"Arise",          label:"⬆️ Levantarse",      label_short:"Arise",   category:"entrance",    visme_phase:"intro",    looping:false, duration_ms:1200, best_for:["aparición inicial","hero section"],                      prompt_hint:"humanoid rising from ground, arms lifting, A-pose ready",                 triggers:["on_page_load","on_scroll_enter"]               },
  { action_id:  4, id:"idle",        name:"Idle",           label:"🧍 Reposo",          label_short:"Idle",    category:"waiting",     visme_phase:"idle",     looping:true,  duration_ms:3000, best_for:["estado por defecto","sin interacción"],                  prompt_hint:"humanoid in relaxed standing, weight on one leg, neutral",                triggers:["on_idle","on_default","continuous_loop"]       },
  { action_id:  5, id:"idle_breath", name:"Idle_Breathing", label:"💨 Respirar",        label_short:"Breath",  category:"waiting",     visme_phase:"idle",     looping:true,  duration_ms:4000, best_for:["espera natural","vida realista","formulario abierto"],    prompt_hint:"humanoid in natural standing, subtle chest movement, calm",               triggers:["on_form_open","on_idle_long"]                  },
  { action_id:  6, id:"wave",        name:"Wave",           label:"👋 Saludar",         label_short:"Wave",    category:"entrance",    visme_phase:"intro",    looping:false, duration_ms:1800, best_for:["bienvenida","inicio de formulario","onboarding"],        prompt_hint:"friendly humanoid waving hand, welcoming gesture",                        triggers:["on_first_visit","on_form_start","on_welcome"]  },
  { action_id:  7, id:"thumbs_up",   name:"Thumbs_Up",      label:"👍 Pulgar arriba",   label_short:"Thumbs",  category:"celebration", visme_phase:"success",  looping:false, duration_ms:1200, best_for:["confirmación de paso","campo correcto"],                 prompt_hint:"humanoid giving thumbs up, confident posture",                            triggers:["on_step_complete","on_field_valid"]            },
  { action_id:  8, id:"clap",        name:"Clapping",       label:"👏 Aplaudir",        label_short:"Clap",    category:"celebration", visme_phase:"success",  looping:false, duration_ms:2500, best_for:["formulario completado","meta alcanzada"],                prompt_hint:"humanoid clapping hands, joyful expression",                              triggers:["on_form_submit","on_goal_reached"]             },
  { action_id:  9, id:"dance",       name:"Dance",          label:"💃 Bailar",          label_short:"Dance",   category:"celebration", visme_phase:"success",  looping:true,  duration_ms:4000, best_for:["celebración máxima","éxito viral"],                      prompt_hint:"humanoid in joyful dance, arms and legs in motion",                       triggers:["on_big_win","on_exceptional_result"]           },
  { action_id: 10, id:"point",       name:"Point_Forward",  label:"☝️ Señalar",         label_short:"Point",   category:"action",      visme_phase:"interact", looping:false, duration_ms:1500, best_for:["señalar CTA","guiar atención"],                          prompt_hint:"humanoid pointing finger forward, directing gaze",                        triggers:["on_cta_appear","on_next_step"]                 },
  { action_id: 11, id:"think",       name:"Thinking",       label:"🤔 Pensar",          label_short:"Think",   category:"waiting",     visme_phase:"idle",     looping:true,  duration_ms:5000, best_for:["procesando datos","IA pensando"],                        prompt_hint:"humanoid in thinking pose, hand on chin, contemplative",                  triggers:["on_loading","on_ai_processing"]                },
  { action_id: 12, id:"victory",     name:"Victory",        label:"🏆 Victoria",        label_short:"Victory", category:"celebration", visme_phase:"success",  looping:false, duration_ms:2000, best_for:["conversión completada","pago realizado"],                prompt_hint:"humanoid in victory pose, arms raised triumphantly",                      triggers:["on_conversion","on_payment_success"]           },
  { action_id: 13, id:"sit",         name:"Sit",            label:"🪑 Sentarse",        label_short:"Sit",     category:"waiting",     visme_phase:"idle",     looping:true,  duration_ms:0,    best_for:["lectura de contenido","checkout largo"],                 prompt_hint:"humanoid sitting comfortably, hands on lap",                              triggers:["on_content_read","on_long_form"]               },
  { action_id: 14, id:"look_around", name:"Look_Around",    label:"👀 Mirar",           label_short:"Look",    category:"waiting",     visme_phase:"idle",     looping:true,  duration_ms:4000, best_for:["exploración del producto","browsing"],                   prompt_hint:"humanoid looking around, curious expression, scanning",                   triggers:["on_page_browse","on_product_view"]             },
  { action_id: 15, id:"kick",        name:"Kick",           label:"🦵 Patear",          label_short:"Kick",    category:"action",      visme_phase:"interact", looping:false, duration_ms:800,  best_for:["acción enérgica","CTA agresivo"],                        prompt_hint:"humanoid in dynamic kick pose, powerful leg movement",                    triggers:["on_power_cta","on_impact_moment"]              },
  { action_id: 16, id:"punch",       name:"Punch",          label:"👊 Golpear",         label_short:"Punch",   category:"action",      visme_phase:"interact", looping:false, duration_ms:700,  best_for:["acción de fuerza","superhéroe"],                         prompt_hint:"humanoid in punching pose, arm extended forward",                         triggers:["on_hero_action","on_dramatic_moment"]          },
  { action_id: 17, id:"crouch",      name:"Crouch",         label:"🦸 Agacharse",       label_short:"Crouch",  category:"entrance",    visme_phase:"intro",    looping:false, duration_ms:1000, best_for:["entrada dramática","landing de impacto"],                prompt_hint:"humanoid crouching hero landing, one knee down",                          triggers:["on_hero_reveal","on_dramatic_entrance"]        },
  { action_id: 18, id:"celebrate",   name:"Celebrate_Arms", label:"🙌 Celebrar",        label_short:"Celeb",   category:"celebration", visme_phase:"success",  looping:false, duration_ms:2000, best_for:["éxito de formulario","lead capturado"],                  prompt_hint:"humanoid raising both arms in celebration, joyful",                       triggers:["on_lead_captured","on_form_success"]           },
  { action_id: 19, id:"nod",         name:"Head_Nod",       label:"😌 Asentir",         label_short:"Nod",     category:"emotion",     visme_phase:"react",    looping:false, duration_ms:1000, best_for:["confirmación leve","acuerdo con términos"],              prompt_hint:"humanoid nodding in agreement, pleasant expression",                      triggers:["on_terms_accept","on_minor_confirm"]           },
  { action_id: 20, id:"shake_head",  name:"Shake_Head",     label:"😤 Negar",           label_short:"Shake",   category:"emotion",     visme_phase:"react",    looping:false, duration_ms:1000, best_for:["error de formulario","campo inválido"],                  prompt_hint:"humanoid shaking head in disapproval, frowning",                          triggers:["on_error","on_invalid_input"]                  },
  // Extra (from Meshy basic rig outputs)
  { action_id: 21, id:"run",         name:"Run",            label:"🏃 Correr",          label_short:"Run",     category:"locomotion",  visme_phase:"transit",  looping:true,  duration_ms:800,  best_for:["transición rápida","urgencia","oferta flash"],           prompt_hint:"humanoid running at speed, athletic stride",                              triggers:["on_flash_sale","on_timer","on_urgency"]        },
  { action_id: 22, id:"jump",        name:"Jump",           label:"⬆ Saltar",          label_short:"Jump",    category:"entrance",    visme_phase:"intro",    looping:false, duration_ms:1000, best_for:["aparición dinámica","scroll reveal"],                    prompt_hint:"humanoid jumping, full body airborne, excited",                           triggers:["on_scroll_reveal","on_dynamic_entry"]          },
];

export const ANIM_CATEGORIES = [
  { id: "locomotion",  label: "🚶 Locomoción",     phase: "transit"  },
  { id: "dance",       label: "💃 Baile",           phase: "success"  },
  { id: "combat",      label: "⚔️ Combate",         phase: "interact" },
  { id: "celebration", label: "🎉 Celebración",     phase: "success"  },
  { id: "gesture",     label: "👌 Gestos",          phase: "interact" },
  { id: "entrance",    label: "🎬 Entrada",         phase: "intro"    },
  { id: "waiting",     label: "🧍 Espera/Idle",     phase: "idle"     },
  { id: "emotion",     label: "😄 Emociones",       phase: "react"    },
  { id: "action",      label: "👆 Acción",           phase: "interact" },
  { id: "magic",       label: "🔮 Magia",           phase: "interact" },
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
    id: "shopify_lead", name: "🛍️ Lead Form Shopify",
    description: "Captura de lead: bienvenida → espera → señala CTA → celebra",
    stages: { intro: {action_id:6,id:"wave",label:"👋 Saluda"}, idle: {action_id:5,id:"idle_breath",label:"💨 Respira"}, interact: {action_id:10,id:"point",label:"☝️ Señala CTA"}, success: {action_id:18,id:"celebrate",label:"🙌 Lead capturado"} }
  },
  {
    id: "checkout", name: "🛒 Checkout / Compra",
    description: "Flujo de compra: aparece → piensa → aprueba → victoria",
    stages: { intro: {action_id:3,id:"arise",label:"⬆️ Aparece"}, idle: {action_id:11,id:"think",label:"🤔 Procesando"}, interact: {action_id:7,id:"thumbs_up",label:"👍 Confirma"}, success: {action_id:12,id:"victory",label:"🏆 Pago exitoso"} }
  },
  {
    id: "hero_landing", name: "🦸 Héroe Landing Page",
    description: "Entrada épica: aterrizaje → pose → acción → baile",
    stages: { intro: {action_id:17,id:"crouch",label:"🦸 Aterriza"}, idle: {action_id:4,id:"idle",label:"🧍 Pose heroica"}, interact: {action_id:16,id:"punch",label:"👊 Acción"}, success: {action_id:9,id:"dance",label:"💃 Celebra"} }
  },
  {
    id: "onboarding", name: "👋 Onboarding Amigable",
    description: "Guía al usuario: saluda → explora → avanza → asiente",
    stages: { intro: {action_id:6,id:"wave",label:"👋 Hola!"}, idle: {action_id:14,id:"look_around",label:"👀 Explora"}, interact: {action_id:1,id:"walk",label:"🚶 Avanza"}, success: {action_id:19,id:"nod",label:"😌 Confirma"} }
  },
  {
    id: "error_flow", name: "❌ Corrección de Errores",
    description: "Manejo de errores: alerta → revisa → niega → aplaude",
    stages: { intro: {action_id:2,id:"alert",label:"⚠️ Atención!"}, idle: {action_id:14,id:"look_around",label:"👀 Revisa"}, interact: {action_id:20,id:"shake_head",label:"😤 Incorrecto"}, success: {action_id:8,id:"clap",label:"👏 Corregido!"} }
  },
  {
    id: "social_proof", name: "⭐ Social Proof / Reviews",
    description: "Presenta reseñas: baila → reposo → señala → pulgar",
    stages: { intro: {action_id:9,id:"dance",label:"💃 Energía!"}, idle: {action_id:4,id:"idle",label:"🧍 Reposo"}, interact: {action_id:10,id:"point",label:"☝️ Mira esto"}, success: {action_id:7,id:"thumbs_up",label:"👍 Recomendado"} }
  },
];

export type FlowStage = "intro" | "idle" | "interact" | "success";

export const FLOW_STAGE_LABELS: Record<FlowStage, { label: string; icon: string; color: string }> = {
  intro:    { label: "Entrada",     icon: "🎬", color: "#d4a843" },
  idle:     { label: "Espera",      icon: "🧍", color: "#60a5fa" },
  interact: { label: "Interacción", icon: "👆", color: "#a78bfa" },
  success:  { label: "Éxito",       icon: "🎉", color: "#34d399" },
};

// ── Helper to build ModelAnimation array from filesystem ─────────────────────

function anims(charId: string, names: string[]): ModelAnimation[] {
  return names.map(name => {
    const def = ALL_ANIMATIONS.find(a => a.id === name);
    return {
      name,
      label: def?.label ?? name,
      glbPath: `/assets/3d/animations/${charId}/${name}.glb`,
      looping: def?.looping ?? true,
    };
  });
}

// 134 animations — alec_monopoly (full catalog discovered via API probe)
const FULL_134 = [
  "walk","alert","arise","idle","idle_breath","wave","thumbs_up","clap","dance","point",
  "think","victory","sit","look_around","kick","punch","crouch","celebrate","nod","shake_head","run","jump",
  "funny_dancing_02","funny_dancing_03","agree_gesture","angry_stomp","big_heart_gesture","big_wave_hello","call_gesture","casual_walk",
  "catching_breath","chair_sit_idle_f","chair_sit_idle_m","checkout_gesture","clapping_run","confused_scratch","discuss_while_moving","dozing_elderly",
  "excited_walk_f","excited_walk_m","formal_bow","gentlemans_bow","handbag_walk","happy_jump_f","indoor_play","jump_rope",
  "listening_gesture","mirror_viewing","motivational_cheer","phone_call_gesture",
  "shouting_angrily","sit_to_stand_f","sit_to_stand_m","squat_stance","stage_walk","stand_and_chat","stand_to_sit_m","step_to_sit",
  "victory_cheer","walk_to_sit","happy_jump_m","penguin_walk",
  "arm_circle_shuffle","all_night_dance","bass_beats","boom_dance","bubble_dance","cherish_pop_dance","crystal_beads","cardio_dance",
  "denim_pop_dance","dont_you_dare","fast_lightning","gangnam_groove","indoor_swing","love_you_pop_dance","magic_genie","not_your_mom",
  "omg_groove","pop_dance_lsa2","pod_baby_groove","shake_it_off_dance","superlove_pop_dance","you_groove",
  "axe_stance","basic_jump","boxing_practice","chest_pound_taunt","combat_stance","counterstrike","double_blade_spin","double_combo_attack",
  "dodge_and_counter","flying_fist_kick","gun_hold_left_turn","kung_fu_punch","left_slash","run_and_shoot","reaping_swing","rightward_spin",
  "sword_shout","sword_judgment","simple_kick","side_shot","triple_combo_attack",
  "confident_walk","confident_strut","flirty_strut","groovy_walk","hello_run","injured_walk","monster_walk","mummy_stagger",
  "proud_strut","quick_walk","run_to_walk","red_carpet_walk","skip_forward","slow_orc_walk","touch_and_run","thoughtful_walk",
  "texting_walk","unsteady_walk","walking_with_phone",
  "charged_spell_cast","charged_spell_cast_1","charged_ground_slam","heavy_hammer_swing",
  "mage_spell_cast","mage_spell_cast_1","mage_spell_cast_2","mage_spell_cast_3","mage_spell_cast_4","mage_spell_cast_5",
];
// 22 animations (batman, chico_casual, chico_formal)
const FULL_22 = ["alert","arise","celebrate","clap","crouch","dance","idle","idle_breath","jump","kick","look_around","nod","point","punch","run","shake_head","sit","think","thumbs_up","victory","walk","wave"];
// 21 animations (plim_plim, chica_ejecutiva and others)
const FULL_21 = ["alert","arise","celebrate","clap","crouch","dance","idle","idle_breath","kick","look_around","nod","point","punch","run","shake_head","sit","think","thumbs_up","victory","walk","wave"];
// Basic 3 (TED — plan limit hit)
const BASIC_3 = ["jump","run","walk"];

// ── Character definitions ─────────────────────────────────────────────────────

export const MESHY_CHARACTERS: MeshyCharacter[] = [
  // ── Fully rigged with 22 animations ──
  {
    id: "alec_monopoly", name: "Alec Monopoly", emoji: "🎩", category: "cartoon",
    description: "El artista urbano más icónico. 134 animaciones — catálogo completo de Meshy.",
    tags: ["arte","urbano","cartoon","rigged","full","134-anims"],
    glbPath: "/assets/3d/models/alec_monopoly.glb", rigStatus: "rigged",
    rigTaskId: "019ebb36-4f0c-7d21-a268-2ff6198aca60",
    regenPrompt: { prompt: "Alec Monopoly street artist cartoon character, male figure wearing top hat and suit with money symbols, graffiti art style, full body A-pose arms at 45 degrees, humanoid proportions, bold colorful style, game-ready 3D model", art_style: "cartoon" },
    animations: anims("alec_monopoly", FULL_134),
  },
  {
    id: "batman", name: "Batman", emoji: "🦇", category: "cartoon",
    description: "El Caballero de la Noche. 22 animaciones completas.",
    tags: ["superhéroe","dc","acción","rigged","full"],
    glbPath: "/assets/3d/models/batman.glb", rigStatus: "rigged",
    rigTaskId: "019ebb36-4f15-7f7e-af4e-3148857adbfe",
    regenPrompt: { prompt: "Batman DC comics superhero, dark knight, full body A-pose arms at 45 degrees, black armored suit with bat symbol on chest, cowl with pointed ears, humanoid athletic proportions, detailed texture, game-ready 3D", art_style: "realistic" },
    animations: anims("batman", FULL_22),
  },
  {
    id: "spiderman", name: "Spider-Man", emoji: "🕷️", category: "cartoon",
    description: "El superhéroe arácnido de Marvel. 22 animaciones.",
    tags: ["marvel","superhéroe","acción","rigged","full"],
    glbPath: "/assets/3d/models/spiderman.glb", rigStatus: "rigged",
    regenPrompt: { prompt: "Spider-Man Marvel superhero, full body A-pose arms at 45 degrees, red and blue tight suit with web pattern, spider logo on chest, humanoid athletic build, full face mask, game-ready 3D model", art_style: "realistic" },
    animations: anims("spiderman", FULL_22),
  },
  {
    id: "chico_casual", name: "Hombre Casual Tech", emoji: "👨‍💻", category: "realistic",
    description: "Dev casual. 22 animaciones completas.",
    tags: ["humano","casual","tech","rigged","full"],
    glbPath: "/assets/3d/models/chico_casual.glb", rigStatus: "rigged",
    rigTaskId: "019ebb36-4f25-7f7f-b072-2ef66d123f7d",
    regenPrompt: { prompt: "Young professional male developer, casual tech style, jeans and hoodie, full body A-pose arms at 45 degrees, realistic human proportions, clean facial features, mid-20s appearance, game-ready character", art_style: "realistic" },
    animations: anims("chico_casual", FULL_22),
  },
  {
    id: "chico_formal", name: "Hombre Traje Formal", emoji: "🤵", category: "realistic",
    description: "Ejecutivo con traje. 22 animaciones completas.",
    tags: ["humano","formal","corporativo","rigged","full"],
    glbPath: "/assets/3d/models/chico_formal.glb", rigStatus: "rigged",
    rigTaskId: "019ebb36-4eef-728c-87b1-6f3f022a9a2e",
    regenPrompt: { prompt: "Professional businessman wearing formal dark suit and tie, full body A-pose arms at 45 degrees, realistic human proportions, clean professional appearance, mid-30s male, business executive look, game-ready 3D character", art_style: "realistic" },
    animations: anims("chico_formal", FULL_22),
  },
  // ── Newly generated and rigged ──
  {
    id: "mickey_mouse", name: "Mickey Mouse", emoji: "🐭", category: "cartoon",
    description: "El personaje más icónico de Disney. 21 animaciones.",
    tags: ["disney","cartoon","clásico","rigged"],
    glbPath: "/assets/3d/models/mickey_mouse.glb", rigStatus: "rigged",
    regenPrompt: { prompt: "Mickey Mouse Disney cartoon character, bipedal anthropomorphic mouse standing upright, full body A-pose arms at 45 degrees, round black ears, red shorts with white buttons, white gloves, yellow shoes, cheerful expression, humanoid proportions", art_style: "cartoon" },
    animations: anims("mickey_mouse", FULL_21),
  },
  {
    id: "minnie_mouse", name: "Minnie Mouse", emoji: "🎀", category: "cartoon",
    description: "La ratoncita elegante de Disney. 21 animaciones.",
    tags: ["disney","cartoon","clásico","rigged"],
    glbPath: "/assets/3d/models/minnie_mouse.glb", rigStatus: "rigged",
    regenPrompt: { prompt: "Minnie Mouse Disney cartoon character, bipedal anthropomorphic female mouse standing upright, full body A-pose arms at 45 degrees, round black ears with pink polka dot bow, pink polka dot dress, white gloves, red heels, humanoid proportions", art_style: "cartoon" },
    animations: anims("minnie_mouse", FULL_21),
  },
  {
    id: "bob_esponja", name: "Bob Esponja", emoji: "🧽", category: "cartoon",
    description: "La esponja de Fondo de Bikini. 21 animaciones.",
    tags: ["nickelodeon","cartoon","humor","rigged"],
    glbPath: "/assets/3d/models/bob_esponja.glb", rigStatus: "rigged",
    regenPrompt: { prompt: "SpongeBob SquarePants Nickelodeon cartoon character, bipedal yellow square sponge body, full body A-pose arms at 45 degrees, brown pants with a belt, white shirt, red tie, big blue eyes, buck teeth, humanoid proportions standing upright", art_style: "cartoon" },
    animations: anims("bob_esponja", FULL_21),
  },
  {
    id: "bugs_bunny", name: "Bugs Bunny", emoji: "🐰", category: "cartoon",
    description: "El conejo de Looney Tunes. 21 animaciones.",
    tags: ["warner","cartoon","clásico","rigged"],
    glbPath: "/assets/3d/models/bugs_bunny.glb", rigStatus: "rigged",
    regenPrompt: { prompt: "Bugs Bunny Looney Tunes cartoon character, bipedal grey rabbit standing upright, full body A-pose arms at 45 degrees, long ears pointing up, white face, big buck teeth, humanoid proportions, classic Looney Tunes cartoon style", art_style: "cartoon" },
    animations: anims("bugs_bunny", FULL_21),
  },
  {
    id: "payaso_plim_plim", name: "Plim Plim", emoji: "🤡", category: "cartoon",
    description: "El payaso mágico para niños. 21 animaciones.",
    tags: ["infantil","cartoon","latam","rigged"],
    glbPath: "/assets/3d/models/payaso_plim_plim.glb", rigStatus: "rigged",
    regenPrompt: { prompt: "Plim Plim magical clown character for children, colorful clown costume with ruffled collar, full body A-pose arms at 45 degrees, star-shaped makeup on face, vibrant colors, friendly child-safe clown, humanoid proportions, 3D cartoon style", art_style: "cartoon" },
    animations: anims("payaso_plim_plim", FULL_21),
  },
  {
    id: "chica_ejecutiva", name: "Mujer Ejecutiva", emoji: "👩‍💼", category: "realistic",
    description: "Profesional corporativa. 21 animaciones.",
    tags: ["humano","ejecutiva","corporativo","rigged"],
    glbPath: "/assets/3d/models/chica_ejecutiva.glb", rigStatus: "rigged",
    regenPrompt: { prompt: "Professional businesswoman wearing executive pantsuit, full body A-pose arms at 45 degrees, realistic human female proportions, mid-30s appearance, confident professional look, clean business attire, game-ready 3D character", art_style: "realistic" },
    animations: anims("chica_ejecutiva", FULL_21),
  },
  {
    id: "chica_creativa", name: "Mujer Creativa", emoji: "👩‍🎨", category: "realistic",
    description: "Diseñadora de agencia. Modelo 3D listo, rig pendiente.",
    tags: ["humano","creativa","agencia"],
    glbPath: "/assets/3d/models/chica_creativa.glb", rigStatus: "pending",
    regenPrompt: { prompt: "Creative young woman designer, casual artistic clothing, colorful accessories, full body A-pose arms at 45 degrees, realistic human female proportions, late-20s appearance, artistic bohemian style, game-ready 3D character", art_style: "realistic" },
    animations: [],
  },
  // ── Plan limit (TED only has basic 3) ──
  {
    id: "ted", name: "TED (Oso)", emoji: "🐻", category: "cartoon",
    description: "El osito más famoso. 3 animaciones básicas.",
    tags: ["oso","humor","cartoon","rigged"],
    glbPath: "/assets/3d/models/ted.glb", rigStatus: "rigged",
    rigTaskId: "019ebb36-4f56-728f-bb13-5654f37c1b41",
    regenPrompt: { prompt: "TED teddy bear movie character, bipedal plush stuffed teddy bear standing upright, full body A-pose arms at 45 degrees, brown fur texture, soft plush toy appearance, humanoid proportions, expressive cartoon face", art_style: "cartoon" },
    animations: anims("ted", BASIC_3),
  },
  // ── Missing (rig failed — pose estimation) ──
  {
    id: "pikachu", name: "Pikachu", emoji: "⚡", category: "cartoon",
    description: "El Pokémon eléctrico. Rig pendiente.",
    tags: ["pokemon","nintendo","cartoon"],
    glbPath: "/assets/3d/models/pikachu.glb", rigStatus: "pending",
    regenPrompt: { prompt: "Pikachu Pokemon character, yellow electric mouse standing bipedal upright, full body A-pose arms at 45 degrees, round chubby body, large pointy ears with black tips, red cheeks, lightning bolt tail, humanoid proportions, cute cartoon style", art_style: "cartoon" },
    animations: [],
  },
];

export const RIGGED_CHARACTERS = MESHY_CHARACTERS.filter(c => c.rigStatus === "rigged");
export const PENDING_CHARACTERS = MESHY_CHARACTERS.filter(c => c.rigStatus === "pending");
export const FULL_ANIM_CHARACTERS = MESHY_CHARACTERS.filter(c => c.animations.length >= 20);

// ── Character generation prompts ──────────────────────────────────────────────

export const CHARACTER_PROMPTS = [
  {
    id: "humanoid_realistic",
    label: "👔 Humano Realista",
    subtitle: "Compatible con todas las animaciones (22/22)",
    base_prompt: "full body humanoid character, A-pose arms at 45 degrees from body, realistic proportions, clear facial features, professional look, symmetric body structure, game-ready 3D model, no floating accessories, clear joint separation at shoulders hips knees elbows",
    negative: "cartoon, deformed limbs, floating accessories, asymmetric, no neck, merged legs, T-pose",
    tip: "Usa A-pose (brazos a 45°) — mejor compatibilidad con auto-rig de Meshy",
    compatible_actions: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20],
    art_style: "realistic",
  },
  {
    id: "cartoon_humanoid",
    label: "🎨 Cartoon Humanoide",
    subtitle: "Compatible con rig (proporciones humanoides)",
    base_prompt: "full body cartoon character, bipedal humanoid proportions, A-pose arms at 45 degrees, oversized head small body acceptable, clear arm and leg separation, no extra limbs, simple clothing without complex accessories, clear neck visible, symmetric",
    negative: "quadruped, tentacles, floating parts, non-humanoid, merged limbs, complex hair blocking neck, T-pose",
    tip: "Los cartoon necesitan proporciones humanoides para el auto-rig. Describe el estilo cartoon en el prompt.",
    compatible_actions: [1,2,3,4,5,6,7,8,9,10,11,12,14,15,16,17,18,19,20],
    art_style: "realistic",
  },
  {
    id: "superhero",
    label: "🦸 Superhéroe",
    subtitle: "Optimizado para punch/crouch/victory",
    base_prompt: "full body superhero character, muscular humanoid build, A-pose arms at 45 degrees, tight fitting suit no loose elements, athletic proportions, clear joint definition at shoulders and hips, cape optional but tucked, symmetric, game-ready",
    negative: "loose flowing cape, bulky accessories blocking arms, non-humanoid, merged body parts, T-pose",
    tip: "Traje ajustado funciona mejor que capas sueltas para animaciones de acción",
    compatible_actions: [1,3,4,6,7,8,9,10,12,15,16,17,18,19],
    art_style: "realistic",
  },
  {
    id: "animal_bipedal",
    label: "🐻 Animal Bípedo",
    subtitle: "Estilo TED / Mickey — bípedo con proporciones humanoides",
    base_prompt: "full body bipedal animal cartoon character, humanoid standing pose, A-pose arms at 45 degrees, plush toy or cartoon aesthetic, round body with clear arm and leg separation, stubby humanoid limbs, no accessories blocking joints, symmetric",
    negative: "on all fours, quadruped pose, non-bipedal, merged legs, complex fur accessories, T-pose",
    tip: "Clave: pose bípeda + proporciones humanoides. Mickey y TED funcionan bien con este prompt.",
    compatible_actions: [1,3,4,6,7,8,9,10,12,14,18,19,20],
    art_style: "realistic",
  },
];

// ── Utility functions ─────────────────────────────────────────────────────────

export function getAnimsByPhase(charId: string, phase: string): ModelAnimation[] {
  const char = MESHY_CHARACTERS.find(c => c.id === charId);
  if (!char) return [];
  const phaseDefs = ALL_ANIMATIONS.filter(a => a.visme_phase === phase);
  const ids = phaseDefs.map(a => a.id);
  return char.animations.filter(a => ids.includes(a.name));
}

export function resolveAnimGlb(charId: string, actionId: number): string | null {
  const animDef = ALL_ANIMATIONS.find(a => a.action_id === actionId);
  if (!animDef) return null;
  const char = MESHY_CHARACTERS.find(c => c.id === charId);
  const anim = char?.animations.find(a => a.name === animDef.id);
  return anim?.glbPath ?? null;
}

export function getBestAnimForStage(charId: string, stage: FlowStage, template: FlowTemplate): ModelAnimation | null {
  const stageConfig = template.stages[stage];
  const glbPath = resolveAnimGlb(charId, stageConfig.action_id);
  if (!glbPath) return null;
  return { name: stageConfig.id, label: stageConfig.label, glbPath, looping: stage === "idle" };
}

export function getCharAnimCount(charId: string): number {
  return MESHY_CHARACTERS.find(c => c.id === charId)?.animations.length ?? 0;
}
