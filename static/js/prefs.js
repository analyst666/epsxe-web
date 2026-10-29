/* Preferências — espelham as categorias do ePSXe (BIOS, CPU, Tela, Vídeo, Som, Entrada, Memcards, UI, Misc)
   Cada item mapeia para: opção do core libretro (core), ajuste do player (host) ou do EmulatorJS (ejs).
   Opções do core desconhecidas são ignoradas pelo core; validar contra a lista real (probe.html). */

export const CORES = {
  pcsx: { id: "pcsx_rearmed", label: "PCSX ReARMed — rápido e compatível (renderer software)" },
  beetle: { id: "mednafen_psx_hw", label: "Beetle PSX HW — OpenGL, resolução interna até 16x, PGXP, widescreen" },
};

const T = (key, label, desc, def, extra = {}) => ({ key, label, desc, def, type: "toggle", ...extra });
const S = (key, label, desc, def, options, extra = {}) => ({ key, label, desc, def, type: "select", options, ...extra });
const R = (key, label, desc, def, min, max, step, extra = {}) => ({ key, label, desc, def, type: "range", min, max, step, ...extra });

export const SCHEMA = [
  { id: "bios", icon: "🧩", title: "BIOS", items: [
    S("biosMode", "BIOS", "Usar BIOS oficial (se enviada) ou a BIOS simulada (HLE) — compatibilidade limitada.", "auto",
      [["auto", "Oficial se disponível, senão HLE"], ["hle", "Forçar BIOS simulada (HLE)"]],
      { core: (v) => ({ pcsx_rearmed_bios: v === "hle" ? "HLE" : "auto" }) }),
    T("showLogo", "Mostrar logo PSX", "Exibe a animação de boot da BIOS.", false,
      { core: (v) => ({ pcsx_rearmed_show_bios_bootlogo: v ? "enabled" : "disabled", beetle_psx_hw_skip_bios: v ? "disabled" : "enabled" }) }),
    S("region", "Região", "Força NTSC (60 Hz) ou PAL (50 Hz). Auto detecta pelo disco.", "auto",
      [["auto", "Automática"], ["NTSC", "NTSC"], ["PAL", "PAL"]], { core: (v) => ({ pcsx_rearmed_region: v }) }),
  ]},
  { id: "cpu", icon: "⚙️", title: "CPU / Desempenho", items: [
    S("frameSkip", "Frame skip", "Acelera em máquinas lentas, reduzindo a taxa de quadros do vídeo.", "disabled",
      [["disabled", "Desativado"], ["auto", "Automático"], ["auto_threshold", "Automático (limiar)"]],
      { core: (v) => ({ pcsx_rearmed_frameskip_type: v }) }),
    T("showFps", "Mostrar FPS", "Contador de quadros por segundo sobre o jogo.", false, { host: true }),
    T("cdTurbo", "CD turbo", "Leitura de disco instantânea (reduz tempos de carregamento).", false,
      { core: (v) => ({ pcsx_rearmed_cd_turbo: v ? "enabled" : "disabled" }) }),
    T("nostalls", "Sem stalls de CPU", "Mais rápido, menos preciso.", false,
      { core: (v) => ({ pcsx_rearmed_nostalls: v ? "enabled" : "disabled" }) }),
    T("icache", "Emulação de I-Cache", "Mais preciso; desative só se precisar de velocidade.", true,
      { core: (v) => ({ pcsx_rearmed_icache_emulation: v ? "enabled" : "disabled" }) }),
    T("threads", "Multi-thread (WASM threads)", "Usa os núcleos extras do PC. Requer cross-origin isolation (o servidor já envia).", true, { host: true }),
    R("ffRatio", "Velocidade do turbo", "Multiplicador ao segurar o botão de avanço rápido (Tab / Select+R2).", 3, 1.5, 6, 0.5, { host: true }),
  ]},
  { id: "screen", icon: "🖥️", title: "Tela", items: [
    S("aspect", "Proporção de tela", "Stretch preenche a janela; 4:3 é o original; 16:9 estica (widescreen falso).", "4:3",
      [["stretch", "Esticar"], ["4:3", "4:3 (original)"], ["16:9", "16:9"]], { host: true }),
    T("rgb32", "Cores 32 bits", "Melhores cores em vídeos FMV (MDEC).", true,
      { core: (v) => ({ pcsx_rearmed_rgb32_output: v ? "enabled" : "disabled" }) }),
    S("overscan", "Remover/mostrar bandas pretas", "Controla as bandas superior/inferior.", "disabled",
      [["disabled", "Padrão"], ["auto", "Mostrar overscan (auto)"], ["hack", "Mostrar overscan (hack)"]],
      { core: (v) => ({ pcsx_rearmed_show_overscan: v }) }),
    R("scanlines", "Scanlines", "Linhas de varredura estilo TV de tubo (0 = desligado).", 0, 0, 0.6, 0.05, { host: true }),
    R("scanThickness", "Espessura das scanlines (px)", "", 3, 2, 6, 1, { host: true }),
    R("brightness", "Brilho", "Aumenta o brilho — útil em jogos escuros.", 1, 0.7, 1.6, 0.05, { host: true }),
  ]},
  { id: "video", icon: "🎮", title: "Vídeo", items: [
    S("renderer", "Renderizador", "PCSX = rápido (software). Beetle HW = OpenGL com upscale (equivalente aos plugins OGL2/Pete do ePSXe).", "pcsx",
      [["pcsx", CORES.pcsx.label], ["beetle", CORES.beetle.label]], { host: true }),
    S("internalRes", "Resolução interna (Beetle HW)", "x1 = fiel; x2+ deixa as polígonos mais nítidos.", "2x",
      [["1x(native)", "x1 (nativa)"], ["2x", "x2"], ["4x", "x4"], ["8x", "x8"], ["16x", "x16"]],
      { core: (v) => ({ beetle_psx_hw_internal_resolution: v }) }),
    S("filter", "Filtro de textura (Beetle HW)", "Suavização de texturas.", "nearest",
      [["nearest", "Nenhum (pixelado)"], ["bilinear", "Bilinear"], ["3-point", "3-point"], ["JINC2", "JINC2"], ["SABR", "SABR (2D)"], ["xBR", "xBR (2D)"]],
      { core: (v) => ({ beetle_psx_hw_filter: v }) }),
    S("pgxp", "PGXP (Beetle HW)", "Precisão de geometria: elimina o tremor dos polígonos.", "disabled",
      [["disabled", "Desligado"], ["memory only", "Somente memória"], ["memory + CPU", "Memória + CPU (mais compatível c/ ajustes)"]],
      { core: (v) => ({ beetle_psx_hw_pgxp_mode: v }) }),
    T("widescreen", "Hack widescreen (Beetle HW)", "Renderiza em 16:9 de verdade onde possível.", false,
      { core: (v) => ({ beetle_psx_hw_widescreen_hack: v ? "enabled" : "disabled" }) }),
    S("dither", "Dithering PSX", "Padrão de dithering do console.", "enabled",
      [["disabled", "Desligado"], ["enabled", "Ligado"], ["force", "Forçado"]], { core: (v) => ({ pcsx_rearmed_dithering: v }) }),
    S("shader", "Shader", "Filtros de pós-processamento (CRT, etc.).", "disabled",
      [["disabled", "Nenhum"], ["crt-easymode", "CRT Easymode"], ["crt-aperture", "CRT Aperture"], ["crt-geom", "CRT Geom"], ["sabr", "SABR"], ["bicubic", "Bicúbico"], ["mix-frames", "Mix frames"]],
      { ejs: (v) => ({ shader: v }) }),
  ]},
  { id: "sound", icon: "🔊", title: "Som", items: [
    R("volume", "Volume", "", 0.8, 0, 1, 0.05, { host: true }),
    T("reverb", "Reverb do SPU", "Efeito de reverberação do chip de som.", true, { core: (v) => ({ pcsx_rearmed_spu_reverb: v ? "enabled" : "disabled" }) }),
    S("interp", "Interpolação", "Qualidade da reamostragem do SPU.", "simple",
      [["off", "Desligada (rápida)"], ["simple", "Simples"], ["gaussian", "Gaussiana"], ["cubic", "Cúbica (melhor)"]],
      { core: (v) => ({ pcsx_rearmed_spu_interpolation: v }) }),
    T("cdda", "Áudio de CD (CDDA)", "Trilhas de música em áudio do disco.", true,
      { core: (v) => ({ pcsx_rearmed_nocdaudio: v ? "disabled" : "enabled" }) }),
    T("xa", "Áudio XA", "Vozes/música comprimidas (XA-ADPCM).", true,
      { core: (v) => ({ pcsx_rearmed_noxadecoding: v ? "disabled" : "enabled" }) }),
  ]},
  { id: "input", icon: "🕹️", title: "Entrada", items: [
    S("padType", "Tipo de controle PSX", "Digital ou DualShock/analógico (jogos antigos podem exigir digital).", "dualshock",
      [["digital", "Digital"], ["dualshock", "DualShock (analógico)"]], { host: true }),
    S("analogCombo", "Atalho p/ ligar o modo analógico", "Combinação que alterna analógico/digital no pad emulado.", "l1+r1+select",
      [["disabled", "Desativado"], ["l1+r1+select", "L1+R1+Select"], ["l1+r1+start", "L1+R1+Start"], ["l3+r3", "L3+R3"]],
      { core: (v) => ({ pcsx_rearmed_analog_combo: v }) }),
    S("analogShape", "Formato do analógico", "Círculo (mais fiel) ou quadrado.", "square",
      [["circle", "Círculo"], ["square", "Quadrado"]], { core: (v) => ({ pcsx_rearmed_analog_axis_modifier: v }) }),
    S("multitap", "Multitap (4 jogadores)", "Para jogos que suportam multitap.", "disabled",
      [["disabled", "Desligado"], ["port 1", "Porta 1"], ["ports 1 and 2", "Portas 1 e 2"]], { core: (v) => ({ pcsx_rearmed_multitap: v }) }),
    T("memcard2", "Memory card 2", "Habilita o segundo cartão de memória.", false, { core: (v) => ({ pcsx_rearmed_memcard2: v ? "enabled" : "disabled" }) }),
    T("vibration", "Vibração", "Rumble do controle quando o jogo pedir.", true, { core: (v) => ({ pcsx_rearmed_vibration: v ? "enabled" : "disabled" }) }),
  ]},
  { id: "ui", icon: "🧭", title: "Interface / Misc", items: [
    T("resumePrompt", "Perguntar se quer retomar", "Ao abrir um jogo com autosave, pergunta se deseja continuar.", true, { host: true }),
    T("autosave", "Autosave ao sair", "Salva o estado automaticamente ao sair do jogo.", true, { host: true }),
    T("confirmExit", "Confirmar saída", "Pede confirmação antes de sair.", false, { host: true }),
    T("profileMode", "Preferências globais sobrepõem o perfil do jogo", "Ao iniciar, ignora ajustes internos salvos pelo EmulatorJS para o jogo.", false, { host: true }),
  ]},
];

export const DEFAULTS = Object.fromEntries(SCHEMA.flatMap((g) => g.items.map((i) => [i.key, i.def])));
const GKEY = "epsxe.prefs.v1";
const PKEY = (id) => `epsxe.profile.${id}`;

export const loadPrefs = () => {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(GKEY) || "{}") }; } catch { return { ...DEFAULTS }; }
};
export const savePrefs = (p) => localStorage.setItem(GKEY, JSON.stringify(p));
export const loadProfile = (gameId) => { try { return JSON.parse(localStorage.getItem(PKEY(gameId)) || "null"); } catch { return null; } };
export const saveProfile = (gameId, p) => localStorage.setItem(PKEY(gameId), JSON.stringify(p));
export const clearProfile = (gameId) => localStorage.removeItem(PKEY(gameId));

/** Prefs efetivas = globais + perfil do jogo. Gera opções do core, EJS e host. */
export function resolve(prefs) {
  const core = {}, ejs = {}, host = {};
  for (const g of SCHEMA) for (const it of g.items) {
    const v = prefs[it.key] ?? it.def;
    if (it.core) Object.assign(core, it.core(v));
    if (it.ejs) Object.assign(ejs, it.ejs(v));
    if (it.host) host[it.key] = v;
  }
  return { core, ejs, host };
}
