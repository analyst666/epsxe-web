/* ePSXe Web — Motor de Controles e Mapeamento Avançado
   Suporte completo a:
   - Jogador 1 e Jogador 2 independentes
   - Controles Bluetooth e USB (PS4, PS5 DualSense, Xbox Wireless, genéricos DirectInput/XInput)
   - Teclado customizável por jogador (WASD, Setas, Numpad)
   - Vibração háptica (dual-rumble) em controles Bluetooth
   - Mapeamento universal (captura teclado ou controle com 1 clique)
   - Visualização e teste de eixos analógicos em tempo real
*/

// Botões do PlayStation 1 mapeados para os índices do RetroPad / EmulatorJS
export const PS_BUTTONS = [
  { id: "cross", label: "✕ Cross", idx: 0, desc: "Ação / Confirmar", defaultKeyP1: "x", defaultKeyP2: "k" },
  { id: "circle", label: "○ Circle", idx: 8, desc: "Ação / Cancelar", defaultKeyP1: "c", defaultKeyP2: "l" },
  { id: "square", label: "□ Square", idx: 1, desc: "Ação / Ataque", defaultKeyP1: "z", defaultKeyP2: "j" },
  { id: "triangle", label: "△ Triangle", idx: 9, desc: "Ação / Menu", defaultKeyP1: "s", defaultKeyP2: "i" },
  { id: "l1", label: "L1", idx: 10, desc: "Ombro Esquerdo 1", defaultKeyP1: "q", defaultKeyP2: "u" },
  { id: "r1", label: "R1", idx: 11, desc: "Ombro Direito 1", defaultKeyP1: "e", defaultKeyP2: "o" },
  { id: "l2", label: "L2", idx: 12, desc: "Gatilho Esquerdo 2", defaultKeyP1: "1", defaultKeyP2: "7" },
  { id: "r2", label: "R2", idx: 13, desc: "Gatilho Direito 2", defaultKeyP1: "3", defaultKeyP2: "9" },
  { id: "l3", label: "L3", idx: 14, desc: "Analógico Esq. (Click)", defaultKeyP1: "f", defaultKeyP2: "h" },
  { id: "r3", label: "R3", idx: 15, desc: "Analógico Dir. (Click)", defaultKeyP1: "g", defaultKeyP2: "y" },
  { id: "select", label: "Select", idx: 2, desc: "Select", defaultKeyP1: "v", defaultKeyP2: "b" },
  { id: "start", label: "Start", idx: 3, desc: "Start / Pausa", defaultKeyP1: "enter", defaultKeyP2: "n" },
  { id: "up", label: "↑ Cima", idx: 4, desc: "D-Pad Cima", defaultKeyP1: "up arrow", defaultKeyP2: "w" },
  { id: "down", label: "↓ Baixo", idx: 5, desc: "D-Pad Baixo", defaultKeyP1: "down arrow", defaultKeyP2: "s" },
  { id: "left", label: "← Esquerda", idx: 6, desc: "D-Pad Esquerda", defaultKeyP1: "left arrow", defaultKeyP2: "a" },
  { id: "right", label: "→ Direita", idx: 7, desc: "D-Pad Direita", defaultKeyP1: "right arrow", defaultKeyP2: "d" },
];

// Layout padrão W3C Standard Gamepad (controles Bluetooth PS4/PS5/Xbox)
export const STANDARD_GAMEPAD_MAP = {
  cross: 0,
  circle: 1,
  square: 2,
  triangle: 3,
  l1: 4,
  r1: 5,
  l2: 6,
  r2: 7,
  select: 8,
  start: 9,
  l3: 10,
  r3: 11,
  up: 12,
  down: 13,
  left: 14,
  right: 15,
};

// Teclado Padrão Jogador 1 (Setas + ZXCS + QE + VR)
export const KEYBOARD_P1_DEFAULT = {
  cross: "x",
  circle: "c",
  square: "z",
  triangle: "s",
  l1: "q",
  r1: "e",
  l2: "1",
  r2: "3",
  l3: "f",
  r3: "g",
  select: "v",
  start: "enter",
  up: "up arrow",
  down: "down arrow",
  left: "left arrow",
  right: "right arrow",
};

// Teclado Padrão Jogador 2 (WASD + JKLI + UO + BN)
export const KEYBOARD_P2_DEFAULT = {
  cross: "k",
  circle: "l",
  square: "j",
  triangle: "i",
  l1: "u",
  r1: "o",
  l2: "7",
  r2: "9",
  l3: "h",
  r3: "y",
  select: "b",
  start: "n",
  up: "w",
  down: "s",
  left: "a",
  right: "d",
};

const CFG_KEY = "epsxe.input.v2";

export function loadInputCfg() {
  let c = {};
  try {
    c = JSON.parse(localStorage.getItem(CFG_KEY) || localStorage.getItem("epsxe.input.v1") || "{}");
  } catch {
    /* ignora */
  }

  const p1 = c.players?.[0] || {};
  const p2 = c.players?.[1] || {};

  return {
    players: [
      {
        inputType: p1.inputType || "auto",
        gamepadIndex: p1.gamepadIndex !== undefined ? p1.gamepadIndex : null,
        gamepadMap: { ...STANDARD_GAMEPAD_MAP, ...(p1.gamepadMap || p1.map || {}) },
        keyboardMap: { ...KEYBOARD_P1_DEFAULT, ...(p1.keyboardMap || c.keyboard || {}) },
        deadzoneL: p1.deadzoneL ?? 0.15,
        deadzoneR: p1.deadzoneR ?? 0.15,
        range: p1.range ?? 1.0,
        vibration: p1.vibration ?? true,
        swapSticks: p1.swapSticks ?? false,
        invertY: p1.invertY ?? false,
      },
      {
        inputType: p2.inputType || "auto",
        gamepadIndex: p2.gamepadIndex !== undefined ? p2.gamepadIndex : null,
        gamepadMap: { ...STANDARD_GAMEPAD_MAP, ...(p2.gamepadMap || {}) },
        keyboardMap: { ...KEYBOARD_P2_DEFAULT, ...(p2.keyboardMap || {}) },
        deadzoneL: p2.deadzoneL ?? 0.15,
        deadzoneR: p2.deadzoneR ?? 0.15,
        range: p2.range ?? 1.0,
        vibration: p2.vibration ?? true,
        swapSticks: p2.swapSticks ?? false,
        invertY: p2.invertY ?? false,
      },
    ],
  };
}

export function saveInputCfg(c) {
  try {
    localStorage.setItem(CFG_KEY, JSON.stringify(c));
  } catch (err) {
    console.warn("Falha ao salvar configuração de controles:", err);
  }
}

/** Constrói a configuração de controles padrão enviada para o EmulatorJS */
export function buildEjsControls(cfg) {
  const ctl = { 0: {}, 1: {}, 2: {}, 3: {} };

  // Mapeamento Jogador 1 (Teclado)
  const p1 = cfg.players?.[0] || {};
  const k1 = p1.keyboardMap || KEYBOARD_P1_DEFAULT;
  for (const b of PS_BUTTONS) {
    ctl[0][b.idx] = { value: k1[b.id] || "" };
  }
  // Analógicos do P1 no teclado: H/F/G/T e L/J/K/I
  ctl[0][16] = { value: "h" };
  ctl[0][17] = { value: "f" };
  ctl[0][18] = { value: "g" };
  ctl[0][19] = { value: "t" };
  ctl[0][27] = { value: "space" }; // Turbo / Avanço rápido

  // Mapeamento Jogador 2 (Teclado)
  const p2 = cfg.players?.[1] || {};
  const k2 = p2.keyboardMap || KEYBOARD_P2_DEFAULT;
  for (const b of PS_BUTTONS) {
    ctl[1][b.idx] = { value: k2[b.id] || "" };
  }

  return ctl;
}

export function keyCodeToName(e) {
  const map = {
    37: "left arrow",
    38: "up arrow",
    39: "right arrow",
    40: "down arrow",
    13: "enter",
    9: "tab",
    32: "space",
    16: "shift",
    17: "ctrl",
    18: "alt",
    8: "backspace",
    27: "escape",
  };
  if (map[e.keyCode]) return map[e.keyCode];
  if (e.key && e.key.length === 1) return e.key.toLowerCase();
  return (e.code || e.key || "").toLowerCase().replace(/^key|^digit/, "");
}

/** Motor avançado de polling e integração de gamepads Bluetooth/USB */
export class PadEngine extends EventTarget {
  constructor(cfg) {
    super();
    this.cfg = cfg;
    this.target = null; // GameManager do EmulatorJS
    this.sent = new Map(); // "player:idx" -> valor atual
    this.raf = 0;
    this.listening = null; // modo de captura
    this.snapshot = [null, null];
    this.hotkey = { menu: false, ff: false };

    window.addEventListener("gamepadconnected", (e) => {
      console.log(`[Gamepad] Conectado: ${e.gamepad.id} (Índice ${e.gamepad.index})`);
      this.dispatchEvent(new CustomEvent("connected", { detail: e.gamepad }));
      this.dispatchEvent(new Event("change"));
    });

    window.addEventListener("gamepaddisconnected", (e) => {
      console.log(`[Gamepad] Desconectado: ${e.gamepad.id} (Índice ${e.gamepad.index})`);
      this.dispatchEvent(new CustomEvent("disconnected", { detail: e.gamepad }));
      this.dispatchEvent(new Event("change"));
    });
  }

  pads() {
    return [...(navigator.getGamepads?.() || [])].filter(Boolean);
  }

  /** Retorna a gamepad física atribuída ao jogador (p = 0 ou 1) */
  padFor(p) {
    const list = this.pads();
    if (list.length === 0) return null;

    const pCfg = this.cfg.players?.[p];
    if (!pCfg) return null;

    // Atribuição manual específica
    if (pCfg.gamepadIndex !== null && pCfg.gamepadIndex !== undefined) {
      return list.find((g) => g.index === pCfg.gamepadIndex) || null;
    }

    // Atribuição automática:
    // Pega as atribuídas manualmente para outros jogadores para não conflitar
    const manualIndices = new Set(
      this.cfg.players
        .filter((_, idx) => idx !== p && _.gamepadIndex !== null)
        .map((_) => _.gamepadIndex)
    );
    const available = list.filter((g) => !manualIndices.has(g.index));
    return available[p] || null;
  }

  start() {
    if (!this.raf) this.raf = requestAnimationFrame(this.loop);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  attach(gameManager) {
    this.target = gameManager;
    this.sent.clear();
  }

  detach() {
    this.target = null;
    this.sent.clear();
  }

  send(playerIdx, btnIdx, val) {
    const k = `${playerIdx}:${btnIdx}`;
    if (this.sent.get(k) === val) return;
    this.sent.set(k, val);
    try {
      this.target?.simulateInput(playerIdx, btnIdx, val);
    } catch {
      /* emulador iniciando */
    }
  }

  loop = (time) => {
    this.raf = requestAnimationFrame(this.loop);
    const out = [];

    for (let p = 0; p < 2; p++) {
      const g = this.padFor(p);
      const pCfg = this.cfg.players?.[p];
      if (!g || !pCfg) {
        out.push(null);
        continue;
      }

      const st = this.readPad(g, pCfg, time);
      out.push({ id: g.id, index: g.index, player: p, ...st });

      // Modo de captura de entrada (remapeamento)
      if (this.listening && this.listening.player === p) {
        const hit = this.detectInput(g);
        if (hit !== null) {
          this.listening.done({ type: "gamepad", value: hit });
          this.listening = null;
        }
      }

      if (!this.target) continue;

      // Envia botões digitais para o RetroPad (0 a 15)
      for (const b of PS_BUTTONS) {
        this.send(p, b.idx, st.buttons[b.id] ? 1 : 0);
      }

      // Envia eixos analógicos:
      // lx+: 16, lx-: 17, ly+: 18, ly-: 19, rx+: 20, rx-: 21, ry+: 22, ry-: 23
      const a = st.axes;
      this.send(p, 16, Math.round(Math.max(0, a.lx) * 32767));
      this.send(p, 17, Math.round(Math.max(0, -a.lx) * 32767));
      this.send(p, 18, Math.round(Math.max(0, a.ly) * 32767));
      this.send(p, 19, Math.round(Math.max(0, -a.ly) * 32767));
      this.send(p, 20, Math.round(Math.max(0, a.rx) * 32767));
      this.send(p, 21, Math.round(Math.max(0, -a.rx) * 32767));
      this.send(p, 22, Math.round(Math.max(0, a.ry) * 32767));
      this.send(p, 23, Math.round(Math.max(0, -a.ry) * 32767));

      if (p === 0) this.checkHotkeys(g, st);
    }

    this.snapshot = out;
    this.dispatchEvent(new CustomEvent("frame", { detail: out }));
  };

  radial(x, y, dz, range) {
    const m = Math.hypot(x, y);
    if (m < dz) return [0, 0];
    const s = Math.min(1, ((m - dz) / (1 - dz)) * range) / (m || 1);
    return [x * s, y * s];
  }

  readPad(g, pCfg, time) {
    const btn = (i) => {
      if (i == null || i < 0) return { pressed: false, value: 0 };
      return g.buttons[i] || { pressed: false, value: 0 };
    };
    const ax = (i) => g.axes[i] ?? 0;
    const buttons = {};
    const map = pCfg.gamepadMap || STANDARD_GAMEPAD_MAP;

    for (const b of PS_BUTTONS) {
      const src = map[b.id];
      let on = false;
      if (typeof src === "string" && src.startsWith("a")) {
        // Mapeado a um eixo analógico (ex: "a2+" ou "a2-")
        const axisIdx = parseInt(src.slice(1));
        const val = ax(axisIdx) * (src.endsWith("-") ? -1 : 1);
        on = val > 0.5;
      } else {
        const bt = btn(src);
        on = bt.pressed || bt.value > 0.5;
      }
      buttons[b.id] = on;
    }

    let lx = ax(0),
      ly = ax(1),
      rx = ax(2),
      ry = ax(3);
    if (pCfg.swapSticks) [lx, ly, rx, ry] = [rx, ry, lx, ly];
    if (pCfg.invertY) {
      ly = -ly;
      ry = -ry;
    }

    [lx, ly] = this.radial(lx, ly, pCfg.deadzoneL, pCfg.range);
    [rx, ry] = this.radial(rx, ry, pCfg.deadzoneR, pCfg.range);

    return {
      buttons,
      axes: { lx, ly, rx, ry },
      raw: { axes: [...g.axes], buttons: g.buttons.map((b) => b.value) },
    };
  }

  /** Detecta botão ou eixo recém pressionado no controle */
  detectInput(g) {
    if (!this._base || this._baseId !== g.index) {
      this._baseId = g.index;
      this._base = { axes: [...g.axes], buttons: g.buttons.map((b) => b.pressed) };
      return null;
    }

    for (let i = 0; i < g.buttons.length; i++) {
      if (g.buttons[i].pressed && !this._base.buttons[i]) {
        this._base = null;
        return i;
      }
    }

    for (let i = 0; i < g.axes.length; i++) {
      const d = g.axes[i] - this._base.axes[i];
      if (Math.abs(d) > 0.65) {
        this._base = null;
        return "a" + i + (d > 0 ? "+" : "-");
      }
    }

    return null;
  }

  listen(player, done) {
    this._base = null;
    this.listening = { player, done };
  }

  cancelListen() {
    this.listening = null;
    this._base = null;
  }

  /** Vibração háptica para controles Bluetooth (PS4/PS5/Xbox) */
  async vibrate(playerIdx = 0, weak = 0.5, strong = 0.5, duration = 300) {
    const pad = this.padFor(playerIdx);
    if (!pad) return false;

    // API W3C Gamepad Vibration Actuator
    if (pad.vibrationActuator && typeof pad.vibrationActuator.playEffect === "function") {
      try {
        await pad.vibrationActuator.playEffect("dual-rumble", {
          startDelay: 0,
          duration,
          weakMagnitude: weak,
          strongMagnitude: strong,
        });
        return true;
      } catch (e) {
        console.warn("Vibração não suportada pelo driver Bluetooth:", e);
      }
    } else if (pad.hapticActuators && pad.hapticActuators[0]) {
      try {
        pad.hapticActuators[0].pulse(strong, duration);
        return true;
      } catch {
        /* ignore */
      }
    }
    return false;
  }

  checkHotkeys(g, st) {
    const guide = !!g.buttons[16]?.pressed;
    if (guide && !this.hotkey.menu) this.dispatchEvent(new Event("menu"));
    this.hotkey.menu = guide;

    const sel = st.buttons.select;
    const edge = (name, on) => {
      if (on && !this.hotkey[name]) this.dispatchEvent(new Event(name));
      this.hotkey[name] = on;
    };
    edge("quicksave", sel && st.buttons.r1);
    edge("quickload", sel && st.buttons.l1);

    const ff = sel && st.buttons.r2;
    if (ff !== !!this.hotkey.ff) {
      this.hotkey.ff = ff;
      this.dispatchEvent(new CustomEvent("turbo", { detail: ff }));
    }
  }
}
