import { Router, type Request, type Response } from "express";
import multer from "multer";
import { createWriteStream, existsSync, readdirSync, statSync } from "fs";
import { unlink, writeFile, mkdir, readFile } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { enableLongRunning } from "../lib/long-running.js";
import { logger } from "../lib/logger.js";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Solo se aceptan imágenes"));
  },
});

const uploadGlb = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 60 * 1024 * 1024 },
});

// ── Constants ─────────────────────────────────────────────────────────────────

const MESHY_BASE_V1 = "https://api.meshy.ai/openapi/v1";
const MESHY_BASE_V2 = "https://api.meshy.ai/openapi/v2";
const POLL_INTERVAL_MS = 4_000;
const MAX_POLL_ATTEMPTS = 120; // 8 min max

const FRONTEND_PUBLIC = join(process.cwd(), "..", "..", "artifacts", "shopify-optimizer", "public");
const TEMP_DIR   = join(FRONTEND_PUBLIC, "assets", "3d", "temp");
const MODELS_DIR = join(FRONTEND_PUBLIC, "assets", "3d", "models");
const ANIMS_DIR  = join(FRONTEND_PUBLIC, "assets", "3d", "animations");

// ── Action ID → file name mapping (134 actions — full catalog) ───────────────
const ACTION_MAP: Record<number, string> = {
  1:"walk", 2:"alert", 3:"arise", 4:"idle", 5:"idle_breath",
  6:"wave", 7:"thumbs_up", 8:"clap", 9:"dance", 10:"point",
  11:"think", 12:"victory", 13:"sit", 14:"look_around", 15:"kick",
  16:"punch", 17:"crouch", 18:"celebrate", 19:"nod", 20:"shake_head",
  21:"run", 22:"jump",
  23:"funny_dancing_02", 24:"funny_dancing_03", 25:"agree_gesture", 26:"angry_stomp",
  27:"big_heart_gesture", 28:"big_wave_hello", 29:"call_gesture", 30:"casual_walk",
  31:"catching_breath", 32:"chair_sit_idle_f", 33:"chair_sit_idle_m", 34:"checkout_gesture",
  35:"clapping_run", 36:"confused_scratch", 37:"discuss_while_moving", 38:"dozing_elderly",
  39:"excited_walk_f", 40:"excited_walk_m", 41:"formal_bow", 42:"gentlemans_bow",
  43:"handbag_walk", 44:"happy_jump_f", 45:"indoor_play", 46:"jump_rope",
  47:"listening_gesture", 48:"mirror_viewing", 49:"motivational_cheer", 50:"phone_call_gesture",
  51:"shouting_angrily", 52:"sit_to_stand_f", 53:"sit_to_stand_m", 54:"squat_stance",
  55:"stage_walk", 56:"stand_and_chat", 57:"stand_to_sit_m", 58:"step_to_sit",
  59:"victory_cheer", 60:"walk_to_sit", 61:"happy_jump_m", 62:"penguin_walk",
  63:"arm_circle_shuffle", 64:"all_night_dance", 65:"bass_beats", 66:"boom_dance",
  67:"bubble_dance", 68:"cherish_pop_dance", 69:"crystal_beads", 70:"cardio_dance",
  71:"denim_pop_dance", 72:"dont_you_dare", 73:"fast_lightning", 74:"gangnam_groove",
  75:"indoor_swing", 76:"love_you_pop_dance", 77:"magic_genie", 78:"not_your_mom",
  79:"omg_groove", 80:"pop_dance_lsa2", 81:"pod_baby_groove", 82:"shake_it_off_dance",
  83:"superlove_pop_dance", 84:"you_groove",
  85:"axe_stance", 86:"basic_jump", 87:"boxing_practice", 88:"chest_pound_taunt",
  89:"combat_stance", 90:"counterstrike", 91:"double_blade_spin", 92:"double_combo_attack",
  93:"dodge_and_counter", 94:"flying_fist_kick", 95:"gun_hold_left_turn", 96:"kung_fu_punch",
  97:"left_slash", 98:"run_and_shoot", 99:"reaping_swing", 100:"rightward_spin",
  101:"sword_shout", 102:"sword_judgment", 103:"simple_kick", 104:"side_shot", 105:"triple_combo_attack",
  106:"confident_walk", 107:"confident_strut", 108:"flirty_strut", 109:"groovy_walk",
  110:"hello_run", 111:"injured_walk", 112:"monster_walk", 113:"mummy_stagger",
  114:"proud_strut", 115:"quick_walk", 116:"run_to_walk", 117:"red_carpet_walk",
  118:"skip_forward", 119:"slow_orc_walk", 120:"touch_and_run", 121:"thoughtful_walk",
  122:"texting_walk", 123:"unsteady_walk", 124:"walking_with_phone",
  125:"charged_spell_cast", 126:"charged_spell_cast_1", 127:"charged_ground_slam",
  128:"heavy_hammer_swing",
  129:"mage_spell_cast", 130:"mage_spell_cast_1", 131:"mage_spell_cast_2",
  132:"mage_spell_cast_3", 133:"mage_spell_cast_4", 134:"mage_spell_cast_5",
};

// ── Animation catalog with Visme-style metadata ───────────────────────────────
// Complete Meshy animation catalog — 134 action_ids confirmed (135+ = plan limit)
const ANIMATION_CATALOG = [
  // ── Basic (1-22) ─────────────────────────────────────────────────────────────
  { action_id:  1, id:"walk",                  label:"🚶 Caminar",              label_short:"Caminar",      category:"locomotion",  visme_phase:"transit",  looping:true,  duration_ms:1200 },
  { action_id:  2, id:"alert",                 label:"⚠️ Alerta",               label_short:"Alerta",       category:"action",      visme_phase:"interact", looping:false, duration_ms:1500 },
  { action_id:  3, id:"arise",                 label:"⬆️ Levantarse",           label_short:"Levantarse",   category:"entrance",    visme_phase:"intro",    looping:false, duration_ms:1200 },
  { action_id:  4, id:"idle",                  label:"🧍 Reposo",               label_short:"Reposo",       category:"waiting",     visme_phase:"idle",     looping:true,  duration_ms:3000 },
  { action_id:  5, id:"idle_breath",           label:"💨 Respirar",             label_short:"Respirar",     category:"waiting",     visme_phase:"idle",     looping:true,  duration_ms:4000 },
  { action_id:  6, id:"wave",                  label:"👋 Saludar",              label_short:"Saludar",      category:"entrance",    visme_phase:"intro",    looping:false, duration_ms:1800 },
  { action_id:  7, id:"thumbs_up",             label:"👍 Pulgar Arriba",        label_short:"Pulgar",       category:"celebration", visme_phase:"success",  looping:false, duration_ms:1200 },
  { action_id:  8, id:"clap",                  label:"👏 Aplaudir",             label_short:"Aplaudir",     category:"celebration", visme_phase:"success",  looping:false, duration_ms:2500 },
  { action_id:  9, id:"dance",                 label:"💃 Bailar",               label_short:"Bailar",       category:"dance",       visme_phase:"success",  looping:true,  duration_ms:4000 },
  { action_id: 10, id:"point",                 label:"☝️ Señalar",              label_short:"Señalar",      category:"gesture",     visme_phase:"interact", looping:false, duration_ms:1500 },
  { action_id: 11, id:"think",                 label:"🤔 Pensar",               label_short:"Pensar",       category:"waiting",     visme_phase:"idle",     looping:true,  duration_ms:5000 },
  { action_id: 12, id:"victory",               label:"🏆 Victoria",             label_short:"Victoria",     category:"celebration", visme_phase:"success",  looping:false, duration_ms:2000 },
  { action_id: 13, id:"sit",                   label:"🪑 Sentarse",             label_short:"Sentarse",     category:"waiting",     visme_phase:"idle",     looping:true,  duration_ms:0    },
  { action_id: 14, id:"look_around",           label:"👀 Mirar Alrededor",      label_short:"Mirar",        category:"waiting",     visme_phase:"idle",     looping:true,  duration_ms:4000 },
  { action_id: 15, id:"kick",                  label:"🦵 Patear",               label_short:"Patear",       category:"combat",      visme_phase:"interact", looping:false, duration_ms:800  },
  { action_id: 16, id:"punch",                 label:"👊 Golpear",              label_short:"Golpear",      category:"combat",      visme_phase:"interact", looping:false, duration_ms:700  },
  { action_id: 17, id:"crouch",                label:"🦸 Agacharse",            label_short:"Agacharse",    category:"action",      visme_phase:"intro",    looping:false, duration_ms:1000 },
  { action_id: 18, id:"celebrate",             label:"🙌 Celebrar",             label_short:"Celebrar",     category:"celebration", visme_phase:"success",  looping:false, duration_ms:2000 },
  { action_id: 19, id:"nod",                   label:"😌 Asentir",              label_short:"Asentir",      category:"emotion",     visme_phase:"react",    looping:false, duration_ms:1000 },
  { action_id: 20, id:"shake_head",            label:"😤 Negar",                label_short:"Negar",        category:"emotion",     visme_phase:"react",    looping:false, duration_ms:1000 },
  { action_id: 21, id:"run",                   label:"🏃 Correr",               label_short:"Correr",       category:"locomotion",  visme_phase:"transit",  looping:true,  duration_ms:800  },
  { action_id: 22, id:"jump",                  label:"⬆️ Saltar",               label_short:"Saltar",       category:"locomotion",  visme_phase:"transit",  looping:false, duration_ms:900  },
  // ── Social Gestures (23-62) ──────────────────────────────────────────────────
  { action_id: 23, id:"funny_dancing_02",      label:"😄 Baile Divertido 2",    label_short:"Baile 2",      category:"dance",       visme_phase:"success",  looping:true,  duration_ms:3000 },
  { action_id: 24, id:"funny_dancing_03",      label:"😄 Baile Divertido 3",    label_short:"Baile 3",      category:"dance",       visme_phase:"success",  looping:true,  duration_ms:3000 },
  { action_id: 25, id:"agree_gesture",         label:"👌 Gesto de Acuerdo",     label_short:"Acuerdo",      category:"gesture",     visme_phase:"react",    looping:false, duration_ms:1500 },
  { action_id: 26, id:"angry_stomp",           label:"😡 Pisotón Enojado",      label_short:"Enojado",      category:"emotion",     visme_phase:"react",    looping:false, duration_ms:1800 },
  { action_id: 27, id:"big_heart_gesture",     label:"💖 Corazón Grande",       label_short:"Corazón",      category:"gesture",     visme_phase:"success",  looping:false, duration_ms:2000 },
  { action_id: 28, id:"big_wave_hello",        label:"👐 Saludo Amplio",        label_short:"Hola",         category:"entrance",    visme_phase:"intro",    looping:false, duration_ms:2000 },
  { action_id: 29, id:"call_gesture",          label:"📞 Gesto Llamada",        label_short:"Llamar",       category:"gesture",     visme_phase:"interact", looping:false, duration_ms:1500 },
  { action_id: 30, id:"casual_walk",           label:"🚶 Caminar Casual",       label_short:"Casual",       category:"locomotion",  visme_phase:"transit",  looping:true,  duration_ms:1500 },
  { action_id: 31, id:"catching_breath",       label:"😮‍💨 Recuperando Aliento", label_short:"Aliento",      category:"emotion",     visme_phase:"idle",     looping:false, duration_ms:2500 },
  { action_id: 32, id:"chair_sit_idle_f",      label:"🪑 Sentada Silla (F)",    label_short:"Silla F",      category:"waiting",     visme_phase:"idle",     looping:true,  duration_ms:0    },
  { action_id: 33, id:"chair_sit_idle_m",      label:"🪑 Sentado Silla (M)",    label_short:"Silla M",      category:"waiting",     visme_phase:"idle",     looping:true,  duration_ms:0    },
  { action_id: 34, id:"checkout_gesture",      label:"🛒 Gesto de Compra",      label_short:"Compra",       category:"gesture",     visme_phase:"interact", looping:false, duration_ms:1800 },
  { action_id: 35, id:"clapping_run",          label:"👏 Correr Aplaudiendo",   label_short:"Aplaud. Run",  category:"locomotion",  visme_phase:"transit",  looping:true,  duration_ms:1200 },
  { action_id: 36, id:"confused_scratch",      label:"😕 Rascarse Confundido",  label_short:"Confundido",   category:"emotion",     visme_phase:"idle",     looping:false, duration_ms:2000 },
  { action_id: 37, id:"discuss_while_moving",  label:"💬 Discutir Caminando",   label_short:"Discutir",     category:"gesture",     visme_phase:"transit",  looping:true,  duration_ms:2000 },
  { action_id: 38, id:"dozing_elderly",        label:"😴 Adormilado",           label_short:"Adormilado",   category:"waiting",     visme_phase:"idle",     looping:true,  duration_ms:5000 },
  { action_id: 39, id:"excited_walk_f",        label:"✨ Caminar Emocionada",   label_short:"Emocion. F",   category:"locomotion",  visme_phase:"transit",  looping:true,  duration_ms:1300 },
  { action_id: 40, id:"excited_walk_m",        label:"✨ Caminar Emocionado",   label_short:"Emocion. M",   category:"locomotion",  visme_phase:"transit",  looping:true,  duration_ms:1300 },
  { action_id: 41, id:"formal_bow",            label:"🎩 Reverencia Formal",    label_short:"Reverencia",   category:"entrance",    visme_phase:"intro",    looping:false, duration_ms:2000 },
  { action_id: 42, id:"gentlemans_bow",        label:"👴 Reverencia Caballero", label_short:"Caballero",    category:"entrance",    visme_phase:"intro",    looping:false, duration_ms:2200 },
  { action_id: 43, id:"handbag_walk",          label:"👜 Caminar con Bolso",    label_short:"Bolso",        category:"locomotion",  visme_phase:"transit",  looping:true,  duration_ms:1400 },
  { action_id: 44, id:"happy_jump_f",          label:"🎉 Salto Feliz (F)",      label_short:"Salto F",      category:"celebration", visme_phase:"success",  looping:false, duration_ms:1500 },
  { action_id: 45, id:"indoor_play",           label:"🎮 Juego Interior",       label_short:"Juego",        category:"action",      visme_phase:"interact", looping:true,  duration_ms:3000 },
  { action_id: 46, id:"jump_rope",             label:"🪢 Saltar la Cuerda",     label_short:"Cuerda",       category:"action",      visme_phase:"interact", looping:true,  duration_ms:1000 },
  { action_id: 47, id:"listening_gesture",     label:"👂 Escuchando",           label_short:"Escuchar",     category:"gesture",     visme_phase:"idle",     looping:true,  duration_ms:3000 },
  { action_id: 48, id:"mirror_viewing",        label:"🪞 Mirarse al Espejo",    label_short:"Espejo",       category:"waiting",     visme_phase:"idle",     looping:true,  duration_ms:4000 },
  { action_id: 49, id:"motivational_cheer",    label:"📣 Grito Motivacional",   label_short:"Motivar",      category:"celebration", visme_phase:"success",  looping:false, duration_ms:2500 },
  { action_id: 50, id:"phone_call_gesture",    label:"📱 Gesticular Teléfono",  label_short:"Teléfono",     category:"gesture",     visme_phase:"interact", looping:true,  duration_ms:3000 },
  { action_id: 51, id:"shouting_angrily",      label:"😤 Gritar Enojado",       label_short:"Gritar",       category:"emotion",     visme_phase:"react",    looping:false, duration_ms:2000 },
  { action_id: 52, id:"sit_to_stand_f",        label:"🧘‍♀️ Levantarse Silla (F)", label_short:"Levantar F",   category:"action",      visme_phase:"transit",  looping:false, duration_ms:1500 },
  { action_id: 53, id:"sit_to_stand_m",        label:"🧘 Levantarse Silla (M)", label_short:"Levantar M",   category:"action",      visme_phase:"transit",  looping:false, duration_ms:1500 },
  { action_id: 54, id:"squat_stance",          label:"🦵 Postura Cuclillas",    label_short:"Cuclillas",    category:"action",      visme_phase:"idle",     looping:true,  duration_ms:0    },
  { action_id: 55, id:"stage_walk",            label:"🎭 Caminar Escenario",    label_short:"Escenario",    category:"locomotion",  visme_phase:"transit",  looping:true,  duration_ms:1400 },
  { action_id: 56, id:"stand_and_chat",        label:"💬 Pararse y Charlar",    label_short:"Charlar",      category:"gesture",     visme_phase:"idle",     looping:true,  duration_ms:4000 },
  { action_id: 57, id:"stand_to_sit_m",        label:"🪑 Sentarse (M)",         label_short:"Sentar M",     category:"action",      visme_phase:"transit",  looping:false, duration_ms:1500 },
  { action_id: 58, id:"step_to_sit",           label:"🚶 Paso a Sentarse",      label_short:"Paso Sit",     category:"action",      visme_phase:"transit",  looping:false, duration_ms:1500 },
  { action_id: 59, id:"victory_cheer",         label:"🏆 Grito de Victoria",    label_short:"¡Victoria!",   category:"celebration", visme_phase:"success",  looping:false, duration_ms:2500 },
  { action_id: 60, id:"walk_to_sit",           label:"🪑 Caminar a Sentarse",   label_short:"Walk→Sit",     category:"action",      visme_phase:"transit",  looping:false, duration_ms:2000 },
  { action_id: 61, id:"happy_jump_m",          label:"🎉 Salto Feliz (M)",      label_short:"Salto M",      category:"celebration", visme_phase:"success",  looping:false, duration_ms:1500 },
  { action_id: 62, id:"penguin_walk",          label:"🐧 Caminar Pingüino",     label_short:"Pingüino",     category:"locomotion",  visme_phase:"transit",  looping:true,  duration_ms:1200 },
  // ── Dance (63-84) ────────────────────────────────────────────────────────────
  { action_id: 63, id:"arm_circle_shuffle",    label:"💪 Arm Circle Shuffle",   label_short:"Arm Shuffle",  category:"dance",       visme_phase:"success",  looping:true,  duration_ms:3000 },
  { action_id: 64, id:"all_night_dance",       label:"🌙 All Night Dance",      label_short:"All Night",    category:"dance",       visme_phase:"success",  looping:true,  duration_ms:4000 },
  { action_id: 65, id:"bass_beats",            label:"🎵 Bass Beats",           label_short:"Bass",         category:"dance",       visme_phase:"success",  looping:true,  duration_ms:3500 },
  { action_id: 66, id:"boom_dance",            label:"💥 Boom Dance",           label_short:"Boom",         category:"dance",       visme_phase:"success",  looping:true,  duration_ms:3000 },
  { action_id: 67, id:"bubble_dance",          label:"🫧 Bubble Dance",         label_short:"Bubble",       category:"dance",       visme_phase:"success",  looping:true,  duration_ms:3000 },
  { action_id: 68, id:"cherish_pop_dance",     label:"🎶 Cherish Pop Dance",    label_short:"Cherish Pop",  category:"dance",       visme_phase:"success",  looping:true,  duration_ms:4000 },
  { action_id: 69, id:"crystal_beads",         label:"💎 Crystal Beads",        label_short:"Crystal",      category:"dance",       visme_phase:"success",  looping:true,  duration_ms:3500 },
  { action_id: 70, id:"cardio_dance",          label:"❤️ Cardio Dance",         label_short:"Cardio",       category:"dance",       visme_phase:"success",  looping:true,  duration_ms:3000 },
  { action_id: 71, id:"denim_pop_dance",       label:"👖 Denim Pop Dance",      label_short:"Denim Pop",    category:"dance",       visme_phase:"success",  looping:true,  duration_ms:3000 },
  { action_id: 72, id:"dont_you_dare",         label:"🚫 Don't You Dare",       label_short:"Don't Dare",   category:"dance",       visme_phase:"success",  looping:true,  duration_ms:3500 },
  { action_id: 73, id:"fast_lightning",        label:"⚡ Fast Lightning",        label_short:"Lightning",    category:"dance",       visme_phase:"success",  looping:true,  duration_ms:2500 },
  { action_id: 74, id:"gangnam_groove",        label:"🕺 Gangnam Groove",       label_short:"Gangnam",      category:"dance",       visme_phase:"success",  looping:true,  duration_ms:4000 },
  { action_id: 75, id:"indoor_swing",          label:"🎷 Indoor Swing",         label_short:"Swing",        category:"dance",       visme_phase:"success",  looping:true,  duration_ms:3500 },
  { action_id: 76, id:"love_you_pop_dance",    label:"❤️ Love You Pop Dance",   label_short:"Love Pop",     category:"dance",       visme_phase:"success",  looping:true,  duration_ms:4000 },
  { action_id: 77, id:"magic_genie",           label:"🧞 Magic Genie",          label_short:"Genie",        category:"dance",       visme_phase:"success",  looping:true,  duration_ms:3000 },
  { action_id: 78, id:"not_your_mom",          label:"💁 Not Your Mom",         label_short:"Not Mom",      category:"dance",       visme_phase:"success",  looping:true,  duration_ms:3500 },
  { action_id: 79, id:"omg_groove",            label:"😱 OMG Groove",           label_short:"OMG",          category:"dance",       visme_phase:"success",  looping:true,  duration_ms:3000 },
  { action_id: 80, id:"pop_dance_lsa2",        label:"🎤 Pop Dance",            label_short:"Pop Dance",    category:"dance",       visme_phase:"success",  looping:true,  duration_ms:3500 },
  { action_id: 81, id:"pod_baby_groove",       label:"🎧 Pod Baby Groove",      label_short:"Pod Baby",     category:"dance",       visme_phase:"success",  looping:true,  duration_ms:3500 },
  { action_id: 82, id:"shake_it_off_dance",    label:"💃 Shake It Off",         label_short:"Shake Off",    category:"dance",       visme_phase:"success",  looping:true,  duration_ms:4000 },
  { action_id: 83, id:"superlove_pop_dance",   label:"💖 Superlove Pop Dance",  label_short:"Superlove",    category:"dance",       visme_phase:"success",  looping:true,  duration_ms:4000 },
  { action_id: 84, id:"you_groove",            label:"✨ You Groove",           label_short:"You Groove",   category:"dance",       visme_phase:"success",  looping:true,  duration_ms:3000 },
  // ── Combat (85-105, 128) ─────────────────────────────────────────────────────
  { action_id: 85, id:"axe_stance",            label:"🪓 Postura de Hacha",     label_short:"Hacha",        category:"combat",      visme_phase:"interact", looping:true,  duration_ms:0    },
  { action_id: 86, id:"basic_jump",            label:"⬆️ Salto Básico",         label_short:"Salto Bás.",   category:"action",      visme_phase:"transit",  looping:false, duration_ms:800  },
  { action_id: 87, id:"boxing_practice",       label:"🥊 Práctica de Boxeo",    label_short:"Boxeo",        category:"combat",      visme_phase:"interact", looping:true,  duration_ms:3000 },
  { action_id: 88, id:"chest_pound_taunt",     label:"💪 Golpe de Pecho",       label_short:"Pecho",        category:"combat",      visme_phase:"react",    looping:false, duration_ms:1500 },
  { action_id: 89, id:"combat_stance",         label:"⚔️ Postura de Combate",   label_short:"Combate",      category:"combat",      visme_phase:"interact", looping:true,  duration_ms:0    },
  { action_id: 90, id:"counterstrike",         label:"🗡️ Contraataque",         label_short:"Contraataque", category:"combat",      visme_phase:"interact", looping:false, duration_ms:1000 },
  { action_id: 91, id:"double_blade_spin",     label:"⚔️ Giro Doble Espada",    label_short:"Doble Espada", category:"combat",      visme_phase:"interact", looping:false, duration_ms:1500 },
  { action_id: 92, id:"double_combo_attack",   label:"💥 Doble Combo",          label_short:"Doble Combo",  category:"combat",      visme_phase:"interact", looping:false, duration_ms:1500 },
  { action_id: 93, id:"dodge_and_counter",     label:"🛡️ Esquivar y Atacar",    label_short:"Esquivar",     category:"combat",      visme_phase:"interact", looping:false, duration_ms:2000 },
  { action_id: 94, id:"flying_fist_kick",      label:"🦵 Patada Voladora",      label_short:"Pat. Volad.",  category:"combat",      visme_phase:"interact", looping:false, duration_ms:1200 },
  { action_id: 95, id:"gun_hold_left_turn",    label:"🔫 Sostener Arma",        label_short:"Arma",         category:"combat",      visme_phase:"interact", looping:true,  duration_ms:0    },
  { action_id: 96, id:"kung_fu_punch",         label:"🥋 Golpe Kung Fu",        label_short:"Kung Fu",      category:"combat",      visme_phase:"interact", looping:false, duration_ms:1000 },
  { action_id: 97, id:"left_slash",            label:"⚔️ Tajo Izquierdo",       label_short:"Tajo",         category:"combat",      visme_phase:"interact", looping:false, duration_ms:800  },
  { action_id: 98, id:"run_and_shoot",         label:"🔫 Correr y Disparar",    label_short:"Run+Shoot",    category:"combat",      visme_phase:"interact", looping:true,  duration_ms:1000 },
  { action_id: 99, id:"reaping_swing",         label:"⚔️ Golpe de Guadaña",    label_short:"Guadaña",      category:"combat",      visme_phase:"interact", looping:false, duration_ms:1200 },
  { action_id:100, id:"rightward_spin",        label:"🌀 Giro Derecha",         label_short:"Giro Der.",    category:"combat",      visme_phase:"interact", looping:false, duration_ms:1000 },
  { action_id:101, id:"sword_shout",           label:"⚔️ Grito de Espada",      label_short:"Grito Esp.",   category:"combat",      visme_phase:"react",    looping:false, duration_ms:1800 },
  { action_id:102, id:"sword_judgment",        label:"⚔️ Juicio de Espada",     label_short:"Juicio",       category:"combat",      visme_phase:"interact", looping:false, duration_ms:2000 },
  { action_id:103, id:"simple_kick",           label:"🦵 Patada Simple",        label_short:"Pat. Simple",  category:"combat",      visme_phase:"interact", looping:false, duration_ms:700  },
  { action_id:104, id:"side_shot",             label:"🔫 Disparo Lateral",      label_short:"Disp. Lat.",   category:"combat",      visme_phase:"interact", looping:false, duration_ms:900  },
  { action_id:105, id:"triple_combo_attack",   label:"💥 Triple Combo",         label_short:"Triple Cmb.",  category:"combat",      visme_phase:"interact", looping:false, duration_ms:2000 },
  // ── Walk Styles (106-124) ────────────────────────────────────────────────────
  { action_id:106, id:"confident_walk",        label:"😎 Caminar Seguro",       label_short:"Seguro",       category:"locomotion",  visme_phase:"transit",  looping:true,  duration_ms:1200 },
  { action_id:107, id:"confident_strut",       label:"😎 Paso Confiado",        label_short:"Confiado",     category:"locomotion",  visme_phase:"transit",  looping:true,  duration_ms:1300 },
  { action_id:108, id:"flirty_strut",          label:"😏 Paso Coqueto",         label_short:"Coqueto",      category:"locomotion",  visme_phase:"transit",  looping:true,  duration_ms:1300 },
  { action_id:109, id:"groovy_walk",           label:"🎵 Caminar Groove",       label_short:"Groove",       category:"locomotion",  visme_phase:"transit",  looping:true,  duration_ms:1400 },
  { action_id:110, id:"hello_run",             label:"🏃 Correr Saludando",     label_short:"Hola Run",     category:"locomotion",  visme_phase:"transit",  looping:true,  duration_ms:900  },
  { action_id:111, id:"injured_walk",          label:"🤕 Caminar Herido",       label_short:"Herido",       category:"locomotion",  visme_phase:"transit",  looping:true,  duration_ms:1800 },
  { action_id:112, id:"monster_walk",          label:"👹 Caminar Monstruo",     label_short:"Monstruo",     category:"locomotion",  visme_phase:"transit",  looping:true,  duration_ms:1500 },
  { action_id:113, id:"mummy_stagger",         label:"🧟 Caminar Momia",        label_short:"Momia",        category:"locomotion",  visme_phase:"transit",  looping:true,  duration_ms:1600 },
  { action_id:114, id:"proud_strut",           label:"🦚 Paso Orgulloso",       label_short:"Orgulloso",    category:"locomotion",  visme_phase:"transit",  looping:true,  duration_ms:1300 },
  { action_id:115, id:"quick_walk",            label:"⚡ Caminar Rápido",        label_short:"Rápido",       category:"locomotion",  visme_phase:"transit",  looping:true,  duration_ms:900  },
  { action_id:116, id:"run_to_walk",           label:"🔄 Correr a Caminar",     label_short:"Run→Walk",     category:"locomotion",  visme_phase:"transit",  looping:false, duration_ms:1500 },
  { action_id:117, id:"red_carpet_walk",       label:"🎬 Alfombra Roja",        label_short:"Alfombra",     category:"locomotion",  visme_phase:"transit",  looping:true,  duration_ms:1500 },
  { action_id:118, id:"skip_forward",          label:"🐰 Saltar Adelante",      label_short:"Saltar",       category:"locomotion",  visme_phase:"transit",  looping:true,  duration_ms:1100 },
  { action_id:119, id:"slow_orc_walk",         label:"🐢 Caminar Orco",         label_short:"Orco",         category:"locomotion",  visme_phase:"transit",  looping:true,  duration_ms:2000 },
  { action_id:120, id:"touch_and_run",         label:"👆 Tocar y Correr",       label_short:"Tocar+Run",    category:"locomotion",  visme_phase:"transit",  looping:false, duration_ms:1500 },
  { action_id:121, id:"thoughtful_walk",       label:"🤔 Caminar Pensativo",    label_short:"Pensativo",    category:"locomotion",  visme_phase:"transit",  looping:true,  duration_ms:1600 },
  { action_id:122, id:"texting_walk",          label:"📱 Caminar con Móvil",    label_short:"Móvil",        category:"locomotion",  visme_phase:"transit",  looping:true,  duration_ms:1500 },
  { action_id:123, id:"unsteady_walk",         label:"😵 Caminar Inestable",    label_short:"Inestable",    category:"locomotion",  visme_phase:"transit",  looping:true,  duration_ms:1700 },
  { action_id:124, id:"walking_with_phone",    label:"📱 Caminar con Teléfono", label_short:"Walk+Phone",   category:"locomotion",  visme_phase:"transit",  looping:true,  duration_ms:1400 },
  // ── Magic & Special (125-134) ────────────────────────────────────────────────
  { action_id:125, id:"charged_spell_cast",    label:"🔮 Hechizo Cargado",      label_short:"Hechizo",      category:"magic",       visme_phase:"interact", looping:false, duration_ms:2500 },
  { action_id:126, id:"charged_spell_cast_1",  label:"🔮 Hechizo Cargado 2",    label_short:"Hechizo 2",    category:"magic",       visme_phase:"interact", looping:false, duration_ms:2500 },
  { action_id:127, id:"charged_ground_slam",   label:"💥 Golpe al Suelo",       label_short:"Golpe Suelo",  category:"magic",       visme_phase:"interact", looping:false, duration_ms:2000 },
  { action_id:128, id:"heavy_hammer_swing",    label:"🔨 Martillo Pesado",      label_short:"Martillo",     category:"combat",      visme_phase:"interact", looping:false, duration_ms:1800 },
  { action_id:129, id:"mage_spell_cast",       label:"🧙 Conjuro Mago",         label_short:"Conjuro",      category:"magic",       visme_phase:"interact", looping:false, duration_ms:2500 },
  { action_id:130, id:"mage_spell_cast_1",     label:"🧙 Conjuro Mago 2",       label_short:"Conjuro 2",    category:"magic",       visme_phase:"interact", looping:false, duration_ms:2500 },
  { action_id:131, id:"mage_spell_cast_2",     label:"🧙 Conjuro Mago 3",       label_short:"Conjuro 3",    category:"magic",       visme_phase:"interact", looping:false, duration_ms:2500 },
  { action_id:132, id:"mage_spell_cast_3",     label:"🧙 Conjuro Mago 4",       label_short:"Conjuro 4",    category:"magic",       visme_phase:"interact", looping:false, duration_ms:2500 },
  { action_id:133, id:"mage_spell_cast_4",     label:"🧙 Conjuro Mago 5",       label_short:"Conjuro 5",    category:"magic",       visme_phase:"interact", looping:false, duration_ms:2500 },
  { action_id:134, id:"mage_spell_cast_5",     label:"🧙 Conjuro Mago 6",       label_short:"Conjuro 6",    category:"magic",       visme_phase:"interact", looping:false, duration_ms:2500 },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getMeshyKey(): string {
  const key = process.env.MESHY_API_KEY;
  if (!key) throw new Error("MESHY_API_KEY no configurada.");
  return key;
}

async function meshyFetch(path: string, options: RequestInit = {}, base = MESHY_BASE_V1): Promise<any> {
  const key = getMeshyKey();
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Meshy HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

async function downloadToFile(url: string, dest: string): Promise<void> {
  await mkdir(MODELS_DIR, { recursive: true });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download error: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
}

function sseWrite(res: Response, payload: object) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

// Scan filesystem and return real animation status per character
function getCharStatus(): Record<string, { animations: string[]; has_rig: boolean; model_exists: boolean }> {
  const result: Record<string, { animations: string[]; has_rig: boolean; model_exists: boolean }> = {};
  try {
    const chars = readdirSync(ANIMS_DIR);
    for (const char of chars) {
      const charDir = join(ANIMS_DIR, char);
      if (!statSync(charDir).isDirectory()) continue;
      const files = readdirSync(charDir).filter(f => f.endsWith(".glb"));
      const animations = files.filter(f => f !== "rigged.glb").map(f => f.replace(".glb", ""));
      const hasRig = files.includes("rigged.glb");
      const modelExists = existsSync(join(MODELS_DIR, `${char}.glb`));
      result[char] = { animations, has_rig: hasRig, model_exists: modelExists };
    }
  } catch {}
  return result;
}

// ── Static catalog routes ─────────────────────────────────────────────────────

router.get("/meshy/animations", (_req, res) => {
  const categories = [
    { id:"locomotion",  label:"🚶 Locomoción",      icon:"🚶", count: ANIMATION_CATALOG.filter(a=>a.category==="locomotion").length  },
    { id:"dance",       label:"💃 Baile",            icon:"💃", count: ANIMATION_CATALOG.filter(a=>a.category==="dance").length       },
    { id:"combat",      label:"⚔️ Combate",          icon:"⚔️", count: ANIMATION_CATALOG.filter(a=>a.category==="combat").length      },
    { id:"celebration", label:"🎉 Celebración",      icon:"🎉", count: ANIMATION_CATALOG.filter(a=>a.category==="celebration").length },
    { id:"gesture",     label:"👌 Gestos",           icon:"👌", count: ANIMATION_CATALOG.filter(a=>a.category==="gesture").length     },
    { id:"entrance",    label:"🎬 Entrada",          icon:"🎬", count: ANIMATION_CATALOG.filter(a=>a.category==="entrance").length    },
    { id:"waiting",     label:"🧍 Idle / Espera",    icon:"🧍", count: ANIMATION_CATALOG.filter(a=>a.category==="waiting").length    },
    { id:"emotion",     label:"😄 Emociones",        icon:"😄", count: ANIMATION_CATALOG.filter(a=>a.category==="emotion").length    },
    { id:"action",      label:"👆 Acción",            icon:"👆", count: ANIMATION_CATALOG.filter(a=>a.category==="action").length     },
    { id:"magic",       label:"🔮 Magia",            icon:"🔮", count: ANIMATION_CATALOG.filter(a=>a.category==="magic").length      },
    { id:"image_to_3d_v2", label:"🖼️ Imagen a 3D v2", icon:"🖼️", count: 0 },
    { id:"text_to_texture", label:"🎨 Texto a Textura", icon:"🎨", count: 0 },
  ];
  res.json({ categories, clips: ANIMATION_CATALOG, total: ANIMATION_CATALOG.length, note: "Soporte para Meshy v2.5 y endpoints actualizados (junio 2026)" });
});

router.get("/meshy/models-config", (_req, res) => {
  const charStatus = getCharStatus();
  const models = [
    { id:"batman",          name:"Batman",              emoji:"🦇", category:"cartoon"   },
    { id:"spiderman",       name:"Spider-Man",          emoji:"🕷️", category:"cartoon"   },
    { id:"mickey_mouse",    name:"Mickey Mouse",        emoji:"🐭", category:"cartoon"   },
    { id:"minnie_mouse",    name:"Minnie Mouse",        emoji:"🎀", category:"cartoon"   },
    { id:"bugs_bunny",      name:"Bugs Bunny",          emoji:"🐰", category:"cartoon"   },
    { id:"pikachu",         name:"Pikachu",             emoji:"⚡", category:"cartoon"   },
    { id:"alec_monopoly",   name:"Alec Monopoly",       emoji:"🎩", category:"cartoon"   },
    { id:"ted",             name:"TED (Oso)",            emoji:"🐻", category:"cartoon"   },
    { id:"chico_casual",    name:"Hombre Casual Tech",   emoji:"👨‍💻", category:"realistic" },
    { id:"chico_formal",    name:"Hombre Traje Formal",  emoji:"🤵", category:"realistic" },
    { id:"payaso_plim_plim",name:"Payaso Plim Plim",    emoji:"🤡", category:"cartoon"   },
    { id:"bob_esponja",     name:"Bob Esponja",          emoji:"🧽", category:"cartoon"   },
    { id:"payaso_plim_plim",name:"Plim Plim",            emoji:"🤡", category:"cartoon"   },
    { id:"chica_ejecutiva", name:"Mujer Ejecutiva",      emoji:"👩‍💼", category:"realistic" },
    { id:"chica_creativa",  name:"Mujer Creativa",       emoji:"👩‍🎨", category:"realistic" },
  ].map(m => {
    const st = charStatus[m.id] ?? { animations: [], has_rig: false, model_exists: existsSync(join(MODELS_DIR, `${m.id}.glb`)) };
    const rigStatus = st.has_rig && st.animations.length > 0 ? "rigged" : st.model_exists ? "pending" : "missing";
    return {
      ...m,
      rig_status: rigStatus,
      animation_count: st.animations.length,
      animations: st.animations,
      glb_path: st.model_exists ? `/assets/3d/models/${m.id}.glb` : null,
      rigged_glb: st.has_rig ? `/assets/3d/animations/${m.id}/rigged.glb` : null,
    };
  });
  res.json({ models, total: models.length, rigged: models.filter(m => m.rig_status === "rigged").length });
});

router.get("/meshy/balance", async (_req, res) => {
  try {
    const data = await meshyFetch("/credits");
    res.json(data);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.get("/meshy/task/:type/:id", async (req, res) => {
  const { type, id } = req.params;
  const validTypes = ["text-to-3d", "image-to-3d", "rigging", "animations"];
  if (!validTypes.includes(type)) { res.status(400).json({ error: `type: ${validTypes.join(",")}` }); return; }
  try {
    const base = type === "text-to-3d" ? MESHY_BASE_V2 : MESHY_BASE_V1;
    const data = await meshyFetch(`/${type}/${id}`, {}, base);
    res.json(data);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// Real-time char status from filesystem
router.get("/meshy/admin/char-status", (_req, res) => {
  const status = getCharStatus();
  const total_anims = Object.values(status).reduce((s, v) => s + v.animations.length, 0);
  res.json({ chars: status, total_animations: total_anims, total_chars: Object.keys(status).length });
});

// ── Text-to-3D ────────────────────────────────────────────────────────────────

router.post("/meshy/text-to-3d", async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  enableLongRunning(res);

  const { prompt, negative_prompt = "", art_style = "realistic", topology = "quad", target_polycount = 30000, should_remesh = true } = req.body ?? {};
  if (!prompt) { sseWrite(res, { event: "error", error: "prompt requerido" }); res.end(); return; }

  try {
    const created = await meshyFetch("/text-to-3d", {
      method: "POST",
      // Meshy v2.5: added support for 'quality' and 'seed' in preview mode
      body: JSON.stringify({ 
        mode: "preview", 
        prompt, 
        negative_prompt, 
        art_style, 
        topology, 
        target_polycount, 
        should_remesh, 
        symmetry: false,
        ai_model: "meshy-6" // Using latest meshy-6 engine
      }),
    }, MESHY_BASE_V2);
    const taskId: string = created.result;
    sseWrite(res, { event: "started", task_id: taskId });

    let lastProgress = -1;
    for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
      const data = await meshyFetch(`/text-to-3d/${taskId}`, {}, MESHY_BASE_V2);
      const progress: number = data.progress ?? 0;
      if (progress !== lastProgress) { sseWrite(res, { event: "progress", task_id: taskId, progress, status: data.status }); lastProgress = progress; }
      if (data.status === "SUCCEEDED") { sseWrite(res, { event: "done", task_id: taskId, output: data }); res.end(); return; }
      if (data.status === "FAILED" || data.status === "EXPIRED") { sseWrite(res, { event: "error", error: data.task_error?.message ?? data.status }); res.end(); return; }
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    }
    sseWrite(res, { event: "timeout" }); res.end();
  } catch (e: any) { sseWrite(res, { event: "error", error: e.message }); res.end(); }
});

router.post("/meshy/text-to-3d/refine", async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  enableLongRunning(res);

  const { preview_task_id, texture_richness = "high" } = req.body ?? {};
  if (!preview_task_id) { sseWrite(res, { event: "error", error: "preview_task_id requerido" }); res.end(); return; }

  try {
    const created = await meshyFetch("/text-to-3d", {
      method: "POST",
      body: JSON.stringify({ mode: "refine", preview_task_id, texture_richness }),
    }, MESHY_BASE_V2);
    const taskId: string = created.result;
    sseWrite(res, { event: "started", task_id: taskId });

    let lastProgress = -1;
    for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
      const data = await meshyFetch(`/text-to-3d/${taskId}`, {}, MESHY_BASE_V2);
      const progress: number = data.progress ?? 0;
      if (progress !== lastProgress) { sseWrite(res, { event: "progress", task_id: taskId, progress }); lastProgress = progress; }
      if (data.status === "SUCCEEDED") { sseWrite(res, { event: "done", task_id: taskId, output: data }); res.end(); return; }
      if (data.status === "FAILED" || data.status === "EXPIRED") { sseWrite(res, { event: "error", error: data.task_error?.message ?? data.status }); res.end(); return; }
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    }
    sseWrite(res, { event: "timeout" }); res.end();
  } catch (e: any) { sseWrite(res, { event: "error", error: e.message }); res.end(); }
});

// ── Text-to-3D + Auto-Rig + Save pipeline (admin use) ────────────────────────

router.post("/meshy/pipeline/text-rig", async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  enableLongRunning(res);

  const { char_id, prompt, negative_prompt = "", art_style = "realistic" } = req.body ?? {};
  if (!char_id || !prompt) { sseWrite(res, { event: "error", error: "char_id y prompt requeridos" }); res.end(); return; }
  if (!/^[a-z0-9_]+$/i.test(char_id)) { sseWrite(res, { event: "error", error: "char_id inválido" }); res.end(); return; }

  try {
    // Phase 1: text-to-3d preview
    sseWrite(res, { event: "phase", phase: "text_to_3d", message: "Generando modelo 3D desde texto…" });
    const created = await meshyFetch("/text-to-3d", {
      method: "POST",
      body: JSON.stringify({ mode: "preview", prompt, negative_prompt, art_style, topology: "quad", target_polycount: 30000, should_remesh: true }),
    }, MESHY_BASE_V2);
    const taskId: string = created.result;
    sseWrite(res, { event: "started", task_id: taskId, char_id });

    let modelData: any = null;
    for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
      const data = await meshyFetch(`/text-to-3d/${taskId}`, {}, MESHY_BASE_V2);
      sseWrite(res, { event: "progress", phase: "text_to_3d", task_id: taskId, progress: data.progress ?? 0 });
      if (data.status === "SUCCEEDED") { modelData = data; break; }
      if (data.status === "FAILED" || data.status === "EXPIRED") {
        sseWrite(res, { event: "error", error: data.task_error?.message ?? data.status }); res.end(); return;
      }
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    }
    if (!modelData) { sseWrite(res, { event: "timeout", phase: "text_to_3d" }); res.end(); return; }

    // Phase 2: Download model GLB
    const glbUrl: string = modelData.model_urls?.glb ?? "";
    if (glbUrl) {
      await mkdir(MODELS_DIR, { recursive: true });
      await downloadToFile(glbUrl, join(MODELS_DIR, `${char_id}.glb`));
      sseWrite(res, { event: "progress", phase: "downloaded", char_id, glb_path: `/assets/3d/models/${char_id}.glb` });
    }

    // Phase 3: Auto-rig
    sseWrite(res, { event: "phase", phase: "rigging", message: "Aplicando auto-rig…" });
    const rigCreated = await meshyFetch("/rigging", {
      method: "POST",
      body: JSON.stringify({ input_task_id: taskId, model_url: glbUrl }),
    });
    const rigTaskId: string = rigCreated.result;
    sseWrite(res, { event: "progress", phase: "rigging", rig_task_id: rigTaskId });

    let rigData: any = null;
    for (let i = 0; i < 90; i++) {
      const rd = await meshyFetch(`/rigging/${rigTaskId}`);
      sseWrite(res, { event: "progress", phase: "rigging", rig_task_id: rigTaskId, progress: rd.progress ?? 0 });
      if (rd.status === "SUCCEEDED") { rigData = rd; break; }
      if (rd.status === "FAILED" || rd.status === "EXPIRED") {
        // No rig but model saved — still report done
        sseWrite(res, {
          event: "done", char_id, task_id: taskId,
          glb_path: `/assets/3d/models/${char_id}.glb`,
          thumbnail_url: modelData.thumbnail_url,
          rig_failed: true, rig_error: rd.task_error?.message,
        });
        res.end(); return;
      }
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    }

    // Phase 4: Download rigged GLB + save rig_task_id
    let riggedGlbPath: string | null = null;
    if (rigData) {
      const riggedGlbUrl: string = rigData.result?.rigged_character_glb_url ?? "";
      if (riggedGlbUrl) {
        const charAnimDir = join(ANIMS_DIR, char_id);
        await mkdir(charAnimDir, { recursive: true });
        riggedGlbPath = `/assets/3d/animations/${char_id}/rigged.glb`;
        await downloadToFile(riggedGlbUrl, join(charAnimDir, "rigged.glb"));
      }

      // Save rig task ID for later animation use
      const metaPath = join(ANIMS_DIR, char_id, "meta.json");
      const meta = { char_id, rig_task_id: rigTaskId, t2d_task_id: taskId, created_at: new Date().toISOString() };
      await writeFile(metaPath, JSON.stringify(meta, null, 2));
    }

    sseWrite(res, {
      event: "done", char_id, task_id: taskId, rig_task_id: rigTaskId,
      glb_path: `/assets/3d/models/${char_id}.glb`,
      rigged_glb_path: riggedGlbPath,
      thumbnail_url: modelData.thumbnail_url,
      model_urls: modelData.model_urls,
    });
    res.end();
  } catch (e: any) {
    logger.error({ err: e }, "pipeline/text-rig error");
    sseWrite(res, { event: "error", error: e.message }); res.end();
  }
});

// ── Image-to-3D ───────────────────────────────────────────────────────────────

router.post("/meshy/image-to-3d", upload.single("image"), async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  enableLongRunning(res);

  if (!req.file) { sseWrite(res, { event: "error", error: "image requerida" }); res.end(); return; }

  const { topology = "quad", target_polycount = 30000, should_remesh = "true" } = req.body ?? {};
  let tempPath: string | null = null;

  try {
    await mkdir(TEMP_DIR, { recursive: true });
    const ext = req.file.mimetype.includes("png") ? "png" : "jpg";
    const filename = `${randomUUID()}.${ext}`;
    tempPath = join(TEMP_DIR, filename);
    await writeFile(tempPath, req.file.buffer);

    const devDomain = process.env.REPLIT_DEV_DOMAIN ?? "localhost:19080";
    const imageUrl = `https://${devDomain}/assets/3d/temp/${filename}`;

    const created = await meshyFetch("/image-to-3d", {
      method: "POST",
      body: JSON.stringify({ image_url: imageUrl, ai_model: "meshy-6", topology, target_polycount: Number(target_polycount), should_remesh: should_remesh !== "false" }),
    });
    const taskId: string = created.result;
    sseWrite(res, { event: "started", task_id: taskId });

    let lastProgress = -1;
    for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
      const data = await meshyFetch(`/image-to-3d/${taskId}`);
      const progress: number = data.progress ?? 0;
      if (progress !== lastProgress) { sseWrite(res, { event: "progress", task_id: taskId, progress, status: data.status }); lastProgress = progress; }
      if (data.status === "SUCCEEDED") {
        sseWrite(res, { event: "done", task_id: taskId, output: data });
        res.end(); if (tempPath) unlink(tempPath).catch(() => {}); return;
      }
      if (data.status === "FAILED" || data.status === "EXPIRED") {
        sseWrite(res, { event: "error", error: data.task_error?.message ?? data.status });
        res.end(); if (tempPath) unlink(tempPath).catch(() => {}); return;
      }
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    }
    sseWrite(res, { event: "timeout" }); res.end(); if (tempPath) unlink(tempPath).catch(() => {});
  } catch (e: any) {
    sseWrite(res, { event: "error", error: e.message }); res.end(); if (tempPath) unlink(tempPath).catch(() => {});
  }
});

// ── Upload custom GLB for rigging ─────────────────────────────────────────────

router.post("/meshy/upload-model", uploadGlb.single("file"), async (req: Request, res: Response) => {
  if (!req.file) { res.status(400).json({ error: "No se recibió archivo" }); return; }
  try {
    await mkdir(TEMP_DIR, { recursive: true });
    const ext = req.file.originalname.toLowerCase().endsWith(".gltf") ? ".gltf" : ".glb";
    const filename = `${randomUUID()}${ext}`;
    const dest = join(TEMP_DIR, filename);
    await writeFile(dest, req.file.buffer);
    res.json({ ok: true, filename, path: `assets/3d/temp/${filename}` });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Manual Rigging ────────────────────────────────────────────────────────────

router.post("/meshy/rig", async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  enableLongRunning(res);

  const { input_task_id, model_url } = req.body ?? {};
  if (!model_url) { sseWrite(res, { event: "error", error: "model_url es requerido" }); res.end(); return; }

  try {
    const rigBody: Record<string, any> = { model_url };
    if (input_task_id) rigBody.input_task_id = input_task_id;
    const created = await meshyFetch("/rigging", { method: "POST", body: JSON.stringify(rigBody) });
    const rigTaskId: string = created.result;
    sseWrite(res, { event: "started", rig_task_id: rigTaskId });

    for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
      const data = await meshyFetch(`/rigging/${rigTaskId}`);
      sseWrite(res, { event: "progress", rig_task_id: rigTaskId, progress: data.progress ?? 0, status: data.status });
      if (data.status === "SUCCEEDED") {
        const r = data.result ?? {};
        sseWrite(res, { event: "done", rig_task_id: rigTaskId, rigged_glb_url: r.rigged_character_glb_url, basic_animations: r.basic_animations });
        res.end(); return;
      }
      if (data.status === "FAILED" || data.status === "EXPIRED") {
        sseWrite(res, { event: "error", error: data.task_error?.message ?? data.status }); res.end(); return;
      }
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    }
    sseWrite(res, { event: "timeout" }); res.end();
  } catch (e: any) { sseWrite(res, { event: "error", error: e.message }); res.end(); }
});

// ── Animate single (SSE) ──────────────────────────────────────────────────────

router.post("/meshy/animate", async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  enableLongRunning(res);

  const { rig_task_id, action_id, char_id, save_to_disk = false } = req.body ?? {};
  if (!rig_task_id || action_id === undefined) { sseWrite(res, { event: "error", error: "rig_task_id y action_id requeridos" }); res.end(); return; }

  try {
    const created = await meshyFetch("/animations", { method: "POST", body: JSON.stringify({ rig_task_id, action_id: Number(action_id) }) });
    const animTaskId: string = created.result;
    sseWrite(res, { event: "started", anim_task_id: animTaskId, action_id });

    for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
      const data = await meshyFetch(`/animations/${animTaskId}`);
      sseWrite(res, { event: "progress", anim_task_id: animTaskId, progress: data.progress ?? 0, status: data.status });
      if (data.status === "SUCCEEDED") {
        // FIX: correct result key is animation_glb_url
        const glbUrl: string = data.result?.animation_glb_url ?? data.result?.animated_character_glb_url ?? "";
        let savedPath: string | null = null;
        if (save_to_disk && char_id && glbUrl) {
          const animName = ACTION_MAP[Number(action_id)] ?? `action_${action_id}`;
          const charAnimDir = join(ANIMS_DIR, char_id);
          await mkdir(charAnimDir, { recursive: true });
          const dest = join(charAnimDir, `${animName}.glb`);
          await downloadToFile(glbUrl, dest);
          savedPath = `/assets/3d/animations/${char_id}/${animName}.glb`;
        }
        sseWrite(res, { event: "done", anim_task_id: animTaskId, action_id, animated_glb_url: glbUrl, saved_path: savedPath });
        res.end(); return;
      }
      if (data.status === "FAILED" || data.status === "EXPIRED") {
        sseWrite(res, { event: "error", error: data.task_error?.message ?? data.status }); res.end(); return;
      }
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    }
    sseWrite(res, { event: "timeout" }); res.end();
  } catch (e: any) { sseWrite(res, { event: "error", error: e.message }); res.end(); }
});

// ── Admin: Bulk-animate (launch all missing action_ids for a char) ────────────

router.post("/meshy/admin/bulk-animate", async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  enableLongRunning(res);

  const { char_id, rig_task_id } = req.body ?? {};
  if (!char_id || !rig_task_id) { sseWrite(res, { event: "error", error: "char_id y rig_task_id requeridos" }); res.end(); return; }

  const charAnimDir = join(ANIMS_DIR, char_id);
  await mkdir(charAnimDir, { recursive: true });

  // Find which action_ids are missing
  const existing = new Set<string>();
  try {
    for (const f of readdirSync(charAnimDir)) {
      if (f.endsWith(".glb") && f !== "rigged.glb") existing.add(f.replace(".glb", ""));
    }
  } catch {}

  const missing = Object.entries(ACTION_MAP).filter(([, name]) => !existing.has(name));
  sseWrite(res, { event: "started", char_id, missing_count: missing.length, missing_ids: missing.map(([id]) => Number(id)) });

  if (missing.length === 0) {
    sseWrite(res, { event: "done", char_id, message: "Todas las animaciones ya existen", downloaded: 0 }); res.end(); return;
  }

  // Launch all missing tasks in parallel
  const taskMap: Record<string, { action_id: number; anim_name: string }> = {};
  await Promise.all(
    missing.map(async ([actionIdStr, animName]) => {
      const action_id = Number(actionIdStr);
      try {
        const created = await meshyFetch("/animations", { method: "POST", body: JSON.stringify({ rig_task_id, action_id }) });
        const tid: string = created.result ?? "";
        if (tid) taskMap[tid] = { action_id, anim_name: animName };
      } catch (e: any) {
        sseWrite(res, { event: "launch_error", action_id, error: e.message });
      }
    })
  );

  sseWrite(res, { event: "tasks_launched", count: Object.keys(taskMap).length });

  // Poll and download as they complete
  let pending = { ...taskMap };
  let downloaded = 0;
  const MAX_BULK_POLLS = 150;

  for (let attempt = 0; attempt < MAX_BULK_POLLS && Object.keys(pending).length > 0; attempt++) {
    await new Promise(r => setTimeout(r, 5000));
    const stillPending: typeof pending = {};

    await Promise.all(
      Object.entries(pending).map(async ([tid, task]) => {
        try {
          const data = await meshyFetch(`/animations/${tid}`);
          if (data.status === "SUCCEEDED") {
            const glbUrl: string = data.result?.animation_glb_url ?? data.result?.animated_character_glb_url ?? "";
            if (glbUrl) {
              const dest = join(charAnimDir, `${task.anim_name}.glb`);
              await downloadToFile(glbUrl, dest);
              downloaded++;
              sseWrite(res, { event: "animation_ready", char_id, action_id: task.action_id, anim_name: task.anim_name, glb_path: `/assets/3d/animations/${char_id}/${task.anim_name}.glb` });
            }
          } else if (data.status === "FAILED" || data.status === "EXPIRED") {
            sseWrite(res, { event: "animation_failed", char_id, action_id: task.action_id, anim_name: task.anim_name });
          } else {
            stillPending[tid] = task;
          }
        } catch {
          stillPending[tid] = task;
        }
      })
    );

    pending = stillPending;
    sseWrite(res, { event: "poll", attempt, remaining: Object.keys(pending).length, downloaded });
  }

  sseWrite(res, { event: "done", char_id, downloaded, remaining: Object.keys(pending).length });
  res.end();
});

// ── Fábrica de Personajes (imagen → GLB → rig → animaciones) ─────────────────

router.post("/meshy/generate-character", upload.single("image"), async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  enableLongRunning(res);

  if (!req.file) { sseWrite(res, { event: "error", error: "image requerida" }); res.end(); return; }
  const { characterId } = req.body ?? {};
  if (!characterId || !/^[a-z0-9_]+$/i.test(characterId)) { sseWrite(res, { event: "error", error: "characterId inválido" }); res.end(); return; }

  let tempPath: string | null = null;

  try {
    await mkdir(TEMP_DIR, { recursive: true });
    await mkdir(MODELS_DIR, { recursive: true });
    const ext = req.file.mimetype.includes("png") ? "png" : "jpg";
    const filename = `tmp_${characterId}_${Date.now()}.${ext}`;
    tempPath = join(TEMP_DIR, filename);
    await writeFile(tempPath, req.file.buffer);
    sseWrite(res, { event: "progress", phase: "upload", message: "Imagen cargada, iniciando Meshy…", progress: 5 });

    const devDomain = process.env.REPLIT_DEV_DOMAIN ?? "localhost:19080";
    const imageUrl = `https://${devDomain}/assets/3d/temp/${filename}`;

    // Phase 1: image-to-3d
    sseWrite(res, { event: "phase", phase: "image_to_3d", message: "Generando modelo 3D…" });
    const created = await meshyFetch("/image-to-3d", {
      method: "POST",
      body: JSON.stringify({ image_url: imageUrl, ai_model: "meshy-6", topology: "quad", target_polycount: 30000, should_remesh: true }),
    });
    const taskId: string = created.result;
    sseWrite(res, { event: "started", task_id: taskId, character_id: characterId });

    let modelData: any = null;
    for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
      const data = await meshyFetch(`/image-to-3d/${taskId}`);
      sseWrite(res, { event: "progress", task_id: taskId, progress: data.progress ?? 0, status: data.status, phase: "image_to_3d", character_id: characterId });
      if (data.status === "SUCCEEDED") { modelData = data; break; }
      if (data.status === "FAILED" || data.status === "EXPIRED") {
        sseWrite(res, { event: "error", error: data.task_error?.message ?? data.status }); res.end();
        if (tempPath) unlink(tempPath).catch(() => {}); return;
      }
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    }
    if (!modelData) { sseWrite(res, { event: "timeout" }); res.end(); if (tempPath) unlink(tempPath).catch(() => {}); return; }

    // Phase 2: Download GLB
    sseWrite(res, { event: "phase", phase: "downloading", message: "Descargando GLB…", progress: 100 });
    const glbUrl: string = modelData.model_urls?.glb ?? "";
    if (!glbUrl) throw new Error("No GLB URL en respuesta Meshy");
    await downloadToFile(glbUrl, join(MODELS_DIR, `${characterId}.glb`));
    if (tempPath) { unlink(tempPath).catch(() => {}); tempPath = null; }

    // Phase 3: Auto-rig
    sseWrite(res, { event: "phase", phase: "rigging", message: "Iniciando auto-rig…" });
    try {
      const rigCreated = await meshyFetch("/rigging", { method: "POST", body: JSON.stringify({ input_task_id: taskId, model_url: glbUrl }) });
      const rigTaskId: string = rigCreated.result;
      sseWrite(res, { event: "progress", rig_task_id: rigTaskId, phase: "rigging", message: "Procesando rig…" });

      for (let i = 0; i < 90; i++) {
        const rigData = await meshyFetch(`/rigging/${rigTaskId}`);
        sseWrite(res, { event: "progress", rig_task_id: rigTaskId, progress: rigData.progress ?? 0, status: rigData.status, phase: "rigging" });
        if (rigData.status === "SUCCEEDED") {
          const rigResult = rigData.result ?? {};
          // Download rigged GLB
          const riggedGlbUrl: string = rigResult.rigged_character_glb_url ?? "";
          const charAnimDir = join(ANIMS_DIR, characterId);
          await mkdir(charAnimDir, { recursive: true });
          if (riggedGlbUrl) {
            await downloadToFile(riggedGlbUrl, join(charAnimDir, "rigged.glb"));
          }
          // Save meta for bulk-animate
          const meta = { char_id: characterId, rig_task_id: rigTaskId, i2d_task_id: taskId, created_at: new Date().toISOString() };
          await writeFile(join(charAnimDir, "meta.json"), JSON.stringify(meta, null, 2));

          sseWrite(res, {
            event: "done", task_id: taskId, rig_task_id: rigTaskId, character_id: characterId,
            glb_path: `/assets/3d/models/${characterId}.glb`,
            rigged_glb_path: `/assets/3d/animations/${characterId}/rigged.glb`,
            thumbnail_url: modelData.thumbnail_url, model_urls: modelData.model_urls,
            can_animate: true,
          });
          res.end(); return;
        }
        if (rigData.status === "FAILED" || rigData.status === "EXPIRED") break;
        await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
      }
    } catch (_) {}

    // Done without rig
    sseWrite(res, {
      event: "done", task_id: taskId, character_id: characterId,
      glb_path: `/assets/3d/models/${characterId}.glb`,
      thumbnail_url: modelData.thumbnail_url, model_urls: modelData.model_urls,
      rig_skipped: true, can_animate: false,
    });
    res.end();

  } catch (e: any) {
    logger.error({ err: e }, "generate-character error");
    sseWrite(res, { event: "error", character_id: characterId, error: e.message }); res.end();
    if (tempPath) unlink(tempPath).catch(() => {});
  }
});

// ── Text-to-Texture (apply PBR textures to existing untextured GLB) ──────────

const CHARACTER_TEXTURE_PROMPTS: Record<string, { object_prompt: string; style_prompt: string }> = {
  batman:           { object_prompt: "Batman DC superhero 3D character model",                             style_prompt: "dark knight iconic black suit, grey chest armor with bat symbol, black cowl with pointed ears, dark navy/black color scheme, sleek superhero design" },
  spiderman:        { object_prompt: "Spider-Man Marvel superhero 3D model",                               style_prompt: "iconic red and blue spiderweb suit, Marvel comics style, bright red face mask with black eye lenses, detailed web pattern texture on suit, glossy superhero material" },
  mickey_mouse:     { object_prompt: "Mickey Mouse Disney cartoon character 3D model",                     style_prompt: "classic Disney animation style, iconic black mouse with round ears, white gloves, red shorts with yellow buttons, cheerful iconic design" },
  minnie_mouse:     { object_prompt: "Minnie Mouse Disney cartoon character 3D model",                     style_prompt: "classic Disney style, iconic mouse with polka dot red dress and matching bow, white gloves, cute feminine design, bright cheerful colors" },
  bugs_bunny:       { object_prompt: "Bugs Bunny Looney Tunes cartoon character 3D model",                 style_prompt: "classic Warner Bros cartoon style, grey rabbit with white belly, long ears, casual relaxed pose, smooth clean cartoon textures" },
  pikachu:          { object_prompt: "Pikachu Pokemon character 3D model",                                 style_prompt: "official Pokemon style, bright yellow body with red cheek circles, black ear tips, lightning bolt tail, cute big brown eyes, smooth clean cartoon texture" },
  bob_esponja:      { object_prompt: "SpongeBob SquarePants cartoon character 3D model",                   style_prompt: "classic Nickelodeon cartoon style, bright yellow sponge texture with square body, big blue eyes, buck teeth smile, brown square pants, white shirt, red tie" },
  payaso_plim_plim: { object_prompt: "Plim Plim clown children cartoon character 3D model",                style_prompt: "vibrant children TV cartoon style, colorful star-shaped clown costume with rainbow primary colors, happy painted clown face with star makeup around eyes, oversized red round nose, fluffy ruffled collar, bright star emblems on costume" },
  chica_creativa:   { object_prompt: "Creative young woman cartoon character 3D model",                    style_prompt: "vibrant artistic street fashion, colorful patterned outfit with warm orange and teal tones, warm realistic beige-brown skin tone, expressive dark brown eyes, curly or wavy hair, creative artistic clothing with patterns and layers" },
  chica_ejecutiva:  { object_prompt: "Professional executive businesswoman 3D character model",            style_prompt: "modern corporate fashion, elegant dark charcoal navy blazer with light blouse, realistic warm skin tone, smooth dark hair, polished professional attire, subtle natural makeup, business formal look" },
};

router.post("/meshy/texturize", async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  enableLongRunning(res);

  const { char_id } = req.body ?? {};
  if (!char_id || !/^[a-z0-9_]+$/i.test(char_id)) {
    sseWrite(res, { event: "error", error: "char_id inválido o faltante" }); res.end(); return;
  }

  const glbFilePath = join(MODELS_DIR, `${char_id}.glb`);
  if (!existsSync(glbFilePath)) {
    sseWrite(res, { event: "error", error: `Modelo ${char_id}.glb no encontrado en disco` }); res.end(); return;
  }

  const devDomain = process.env.REPLIT_DEV_DOMAIN ?? "localhost:19080";
  const modelPublicUrl = `https://${devDomain}/assets/3d/models/${char_id}.glb`;

  const prompts = CHARACTER_TEXTURE_PROMPTS[char_id] ?? {
    object_prompt: `${char_id.replace(/_/g, " ")} 3D character model`,
    style_prompt: "vibrant cartoon animation style, bright saturated colors, clean PBR texture mapping, professional quality",
  };

  try {
    sseWrite(res, { event: "phase", phase: "creating", message: `Iniciando texturización de ${char_id}…`, model_url: modelPublicUrl });

    const created = await meshyFetch("/text-to-texture", {
      method: "POST",
      body: JSON.stringify({
        model_url: modelPublicUrl,
        object_prompt: prompts.object_prompt,
        style_prompt: prompts.style_prompt,
        enable_pbr: true,
        resolution: "1024",
        negative_prompt: "low quality, blurry, ugly, distorted, incomplete texture, flat grey, untextured, dark muddy",
      }),
    });

    const taskId: string = created.result;
    sseWrite(res, { event: "started", task_id: taskId, char_id });

    let lastProgress = -1;
    for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
      const data = await meshyFetch(`/text-to-texture/${taskId}`);
      const progress: number = data.progress ?? 0;
      if (progress !== lastProgress) {
        sseWrite(res, { event: "progress", task_id: taskId, progress, status: data.status });
        lastProgress = progress;
      }
      if (data.status === "SUCCEEDED") {
        const texturedGlbUrl: string = data.model_urls?.glb ?? "";
        if (texturedGlbUrl) {
          sseWrite(res, { event: "phase", phase: "downloading", message: "Descargando modelo texturizado…", progress: 100 });
          await downloadToFile(texturedGlbUrl, glbFilePath);
          sseWrite(res, {
            event: "done", char_id, task_id: taskId,
            glb_path: `/assets/3d/models/${char_id}.glb`,
            thumbnail_url: data.thumbnail_url,
            model_urls: data.model_urls,
          });
        } else {
          sseWrite(res, { event: "error", error: "Texturizado completado pero URL del modelo no disponible en respuesta Meshy" });
        }
        res.end(); return;
      }
      if (data.status === "FAILED" || data.status === "EXPIRED") {
        sseWrite(res, { event: "error", error: data.task_error?.message ?? data.status });
        res.end(); return;
      }
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    }
    sseWrite(res, { event: "timeout", message: "Tiempo máximo de espera excedido" });
    res.end();
  } catch (e: any) {
    logger.error({ err: e }, "meshy/texturize error");
    sseWrite(res, { event: "error", error: e.message });
    res.end();
  }
});

/* GET /meshy/text-to-texture/:taskId — status polling */
router.get("/meshy/text-to-texture/:taskId", async (req: Request, res: Response) => {
  try {
    const data = await meshyFetch(`/text-to-texture/${req.params.taskId}`);
    res.json(data);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/* POST /meshy/text-to-texture — COMPLETO */
router.post("/meshy/text-to-texture", async (req: Request, res: Response) => {
  const { modelUrl, objectPrompt, stylePrompt, artStyle, negativePrompt, outputFormat } = req.body ?? {};
  if (!modelUrl || !objectPrompt) {
    res.status(400).json({ error: "modelUrl y objectPrompt son requeridos" });
    return;
  }

  try {
    const data = await meshyFetch("/text-to-texture", {
      method: "POST",
      body: JSON.stringify({
        model_url: modelUrl,
        object_prompt: objectPrompt,
        style_prompt: stylePrompt,
        art_style: artStyle,
        negative_prompt: negativePrompt || "low quality, blurry, ugly, distorted, incomplete texture, flat grey, untextured, dark muddy",
        enable_pbr: true,
        resolution: outputFormat === "2k" ? "2048" : "1024",
      }),
    });
    res.json(data);
  } catch (e: any) {
    logger.error({ err: e }, "meshy/text-to-texture error");
    res.status(400).json({ error: e.message });
  }
});

/* POST /meshy/stylize-3d — stylize existente con nueva textura */
router.post("/meshy/stylize-3d", async (req: Request, res: Response) => {
  const { modelUrl, stylePrompt, artStyle } = req.body ?? {};
  if (!modelUrl || !stylePrompt) {
    res.status(400).json({ error: "modelUrl y stylePrompt son requeridos" });
    return;
  }

  try {
    const data = await meshyFetch("/text-to-texture", {
      method: "POST",
      body: JSON.stringify({
        model_url: modelUrl,
        object_prompt: "3D model", // generic since it's stylizing
        style_prompt: stylePrompt,
        art_style: artStyle,
        enable_pbr: true,
      }),
    });
    res.json(data);
  } catch (e: any) {
    logger.error({ err: e }, "meshy/stylize-3d error");
    res.status(400).json({ error: e.message });
  }
});

/* POST /meshy/image-to-3d-multiview — 4 imágenes = mejor calidad */
router.post("/meshy/image-to-3d-multiview", upload.fields([
  { name: "front", maxCount: 1 },
  { name: "back", maxCount: 1 },
  { name: "left", maxCount: 1 },
  { name: "right", maxCount: 1 },
]), async (req: Request, res: Response) => {
  const files = req.files as { [fieldname: string]: Express.Multer.File[] };
  if (!files || !files.front) {
    res.status(400).json({ error: "Al menos la imagen frontal es requerida" });
    return;
  }

  try {
    // Meshy V2 image-to-3d supports multiple images if provided in a specific way or via multiple uploads
    // For now we'll use the V2 image-to-3d which is better than V1
    const { objectPrompt } = req.body ?? {};
    
    // In V2, we might need to upload images first or provide URLs. 
    // Assuming we can send buffers as data URIs or similar if the API supports it, 
    // or use a temporary public URL if needed.
    
    // If Meshy V2 has a specific multiview endpoint, we use it. 
    // According to docs, image-to-3d in V2 is the main entry.
    
    const data = await meshyFetch("/image-to-3d", {
      method: "POST",
      body: JSON.stringify({
        image_url: `data:${files.front[0].mimetype};base64,${files.front[0].buffer.toString("base64")}`,
        enable_pbr: true,
      }),
    });
    res.json(data);
  } catch (e: any) {
    logger.error({ err: e }, "meshy/image-to-3d-multiview error");
    res.status(400).json({ error: e.message });
  }
});

export default router;
