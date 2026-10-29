/* ePSXe Web — Aplicação Principal
   Gerencia:
   - Biblioteca de jogos (IndexedDB)
   - Anexar arquivos de jogos (.bin, .cue, .iso, .chd, .pbp, .zip, etc.)
   - Agrupamento inteligente de .cue + múltiplos .bin
   - Reconhecimento automático do banco do ePSXe (~11.000 jogos)
   - Gerenciamento de BIOS (SCPH-1001, SCPH-7502, etc.)
   - Menus de Preferências (Áudio, Vídeo, CPU, Tela, Controle, Memcard)
   - HUD no jogo (Menu de Pausa, Savestates, Troca de Disco, Cheats, Reset)
   - Mapeamento e detecção de controles
*/

import { db, storageEstimate, persist } from "./db.js";
import { makeZip } from "./zip.js";
import { loadGameDb, detectSerialFromImage, serialFromName, cleanTitle, prettySerial, regionFlag } from "./gamedb.js";
import { SCHEMA, DEFAULTS, loadPrefs, savePrefs, loadProfile, saveProfile, resolve, CORES } from "./prefs.js";
import { PadEngine, loadInputCfg, saveInputCfg, buildEjsControls, PS_BUTTONS, STANDARD_GAMEPAD_MAP, KEYBOARD_P1_DEFAULT, KEYBOARD_P2_DEFAULT, keyCodeToName } from "./input.js";

// Estado global da aplicação
const state = {
  games: [],
  biosList: [],
  activeGame: null,
  activeSaveSlot: 1,
  gameDb: {},
  prefs: loadPrefs(),
  inputCfg: loadInputCfg(),
  filterRegion: "",
  searchQuery: "",
  sortBy: "recent",
  currentView: "library",
  padEngine: null,
  activeTabPrefs: "video",
  activeTabControls: 0,
  controlsSubTab: "gamepad",
  isPlaying: false,
};

// Elementos DOM
const dom = {
  views: {},
  navBtns: document.querySelectorAll(".nav-btn"),
  grid: document.getElementById("grid"),
  dropzone: document.getElementById("dropzone"),
  dzPick: document.getElementById("dzPick"),
  dzFolder: document.getElementById("dzFolder"),
  btnAdd: document.getElementById("btnAdd"),
  btnOpenFolder: document.getElementById("btnOpenFolder"),
  btnRefresh: document.getElementById("btnRefresh"),
  fileInput: document.getElementById("fileInput"),
  folderInput: document.getElementById("folderInput"),
  biosInput: document.getElementById("biosInput"),
  stateInput: document.getElementById("stateInput"),
  cheatInput: document.getElementById("cheatInput"),
  search: document.getElementById("search"),
  filterRegion: document.getElementById("filterRegion"),
  sortBy: document.getElementById("sortBy"),
  libCount: document.getElementById("libCount"),
  biosBadge: document.getElementById("biosBadge"),
  padStatus: document.getElementById("padStatus"),
  storageInfo: document.getElementById("storageInfo"),
  player: document.getElementById("player"),
  frame: document.getElementById("frame"),
  hudBtn: document.getElementById("hudBtn"),
  loadingVeil: document.getElementById("loadingVeil"),
  loadingText: document.getElementById("loadingText"),
  pause: document.getElementById("pause"),
  modalRoot: document.getElementById("modalRoot"),
  toasts: document.getElementById("toasts"),
};

// Coleta as views
document.querySelectorAll(".view").forEach((el) => {
  const id = el.id.replace("view-", "");
  dom.views[id] = el;
});

// Toast notification
export function toast(msg, type = "info", ms = 3500) {
  const t = document.createElement("div");
  t.className = `toast ${type === "ok" ? "ok" : type === "err" ? "err" : ""}`;
  t.textContent = msg;
  dom.toasts.appendChild(t);
  setTimeout(() => {
    t.style.opacity = "0";
    t.style.transform = "translateY(8px)";
    setTimeout(() => t.remove(), 250);
  }, ms);
}

// Modal helper
function showModal({ title, content, buttons = [] }) {
  const back = document.createElement("div");
  back.className = "back";
  const m = document.createElement("div");
  m.className = "modal";
  m.innerHTML = `<h3>${title}</h3><div class="mbody"></div><div class="acts"></div>`;
  if (typeof content === "string") {
    m.querySelector(".mbody").innerHTML = content;
  } else {
    m.querySelector(".mbody").appendChild(content);
  }
  const acts = m.querySelector(".acts");
  buttons.forEach((b) => {
    const btn = document.createElement("button");
    btn.className = `btn ${b.class || ""}`;
    btn.textContent = b.text;
    btn.onclick = () => {
      if (b.onClick && b.onClick() === false) return;
      back.remove();
    };
    acts.appendChild(btn);
  });
  back.appendChild(m);
  dom.modalRoot.appendChild(back);
  return {
    close: () => back.remove(),
    body: m.querySelector(".mbody"),
  };
}

// Paleta de gradiente para capas geradas
const COVER_GRADIENTS = [
  ["#8b5cf6", "#3b82f6"],
  ["#ec4899", "#8b5cf6"],
  ["#06b6d4", "#3b82f6"],
  ["#10b981", "#06b6d4"],
  ["#f59e0b", "#ef4444"],
  ["#6366f1", "#d946ef"],
];

function generateCoverSvg(title, serial) {
  let hash = 0;
  for (let i = 0; i < title.length; i++) hash = (hash * 31 + title.charCodeAt(i)) & 0xffffffff;
  const [c1, c2] = COVER_GRADIENTS[Math.abs(hash) % COVER_GRADIENTS.length];
  const shortTitle = title.length > 28 ? title.slice(0, 26) + "…" : title;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="100%" height="100%">
    <defs>
      <linearGradient id="g_${hash}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${c1}"/>
        <stop offset="100%" stop-color="${c2}"/>
      </linearGradient>
    </defs>
    <rect width="300" height="300" fill="url(#g_${hash})"/>
    <circle cx="150" cy="130" r="75" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="8"/>
    <circle cx="150" cy="130" r="28" fill="#07080d"/>
    <circle cx="150" cy="130" r="16" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="3"/>
    <path d="M 80,130 L 220,130" stroke="rgba(255,255,255,0.15)" stroke-dasharray="4,4"/>
    <text x="150" y="235" font-family="'Segoe UI',system-ui,sans-serif" font-weight="700" font-size="16" fill="#ffffff" text-anchor="middle">${escapeHtml(shortTitle)}</text>
    <text x="150" y="260" font-family="monospace" font-size="12" fill="rgba(255,255,255,0.7)" text-anchor="middle">${serial ? escapeHtml(serial) : "PLAYSTATION"}</text>
  </svg>`;
}

function escapeHtml(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatBytes(b) {
  if (b === 0) return "0 B";
  const k = 1024, sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return parseFloat((b / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatTime(s) {
  if (!s || s < 60) return "< 1 min";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m} min`;
}

// -------------------------------------------------------------
// INICIALIZAÇÃO
// -------------------------------------------------------------
async function init() {
  await persist();
  state.gameDb = await loadGameDb();
  await refreshGamesList();
  await refreshBiosList();
  await updateStorageInfo();

  // Inicia motor de gamepad
  state.padEngine = new PadEngine(state.inputCfg);
  state.padEngine.addEventListener("change", updatePadStatus);
  state.padEngine.addEventListener("menu", () => togglePauseMenu());
  state.padEngine.addEventListener("quicksave", () => quickSaveState());
  state.padEngine.addEventListener("quickload", () => quickLoadState());
  state.padEngine.addEventListener("turbo", (e) => toggleTurbo(e.detail));
  state.padEngine.start();
  updatePadStatus();

  // Listeners de UI
  setupNavigation();
  setupDropzone();
  setupLibraryControls();
  setupHud();

  // Mensagens do player iframe
  window.addEventListener("message", handleIframeMessage);

  // Tecla Esc abre menu HUD
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && state.isPlaying) {
      e.preventDefault();
      togglePauseMenu();
    }
  });

  renderView("library");
}

// Atualização de dados da biblioteca (Servidor local + IndexedDB)
async function refreshGamesList() {
  let serverGames = [];
  try {
    const res = await fetch("/api/games");
    if (res.ok) {
      const data = await res.json();
      serverGames = data.games || [];
    }
  } catch (err) {
    console.warn("Servidor local não respondeu, usando IndexedDB:", err);
  }

  const localList = await db.all("games");
  const localGames = localList.map((item) => ({ ...item.value, id: item.key }));

  // Mescla sem duplicar por nome de arquivo ou serial
  const merged = [...serverGames];
  const seenFiles = new Set(serverGames.map((g) => (g.filename || "").toLowerCase()));

  for (const lg of localGames) {
    const fn = (lg.filename || "").toLowerCase();
    if (!seenFiles.has(fn)) {
      merged.push(lg);
      seenFiles.add(fn);
    }
  }

  // Assegura propriedades essenciais e URL de capa para cada jogo
  merged.forEach((g) => {
    if (!g.coverUrl) {
      g.coverUrl = `/api/cover?serial=${encodeURIComponent(g.serial || "")}&title=${encodeURIComponent(g.title || "")}`;
    }
    if (!g.prettySerial && g.serial) {
      g.prettySerial = prettySerial(g.serial);
    }
  });

  state.games = merged;
  renderLibrary();
}

async function refreshBiosList() {
  const list = await db.all("bios");
  state.biosList = list.map((item) => ({ ...item.value, name: item.key }));
  const count = state.biosList.length;
  if (count > 0) {
    dom.biosBadge.className = "chip ok";
    dom.biosBadge.textContent = `BIOS: ${count} pronta${count > 1 ? "s" : ""}`;
  } else {
    dom.biosBadge.className = "chip warn";
    dom.biosBadge.textContent = "BIOS: HLE (Simulada)";
  }
}

async function updateStorageInfo() {
  const est = await storageEstimate();
  if (est.quota > 0) {
    dom.storageInfo.textContent = `Armazenamento: ${formatBytes(est.usage)} / ${formatBytes(est.quota)}`;
  }
}

function updatePadStatus() {
  const pads = state.padEngine.pads();
  if (pads.length === 0) {
    dom.padStatus.className = "chip";
    dom.padStatus.textContent = "🎮 Nenhum controle";
  } else {
    dom.padStatus.className = "chip ok";
    dom.padStatus.textContent = `🎮 ${pads.length} controle${pads.length > 1 ? "s" : ""} conectado${pads.length > 1 ? "s" : ""}`;
  }
  if (state.currentView === "controls") renderControlsView();
}

// -------------------------------------------------------------
// NAVEGAÇÃO ENTRE TELAS
// -------------------------------------------------------------
function setupNavigation() {
  dom.navBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const v = btn.dataset.view;
      switchView(v);
    });
  });
}

function switchView(viewName) {
  state.currentView = viewName;
  dom.navBtns.forEach((b) => b.classList.toggle("active", b.dataset.view === viewName));
  Object.keys(dom.views).forEach((k) => dom.views[k].classList.toggle("active", k === viewName));
  renderView(viewName);
}

function renderView(name) {
  switch (name) {
    case "library": renderLibrary(); break;
    case "bios": renderBiosView(); break;
    case "prefs": renderPrefsView(); break;
    case "controls": renderControlsView(); break;
    case "saves": renderSavesView(); break;
    case "cheats": renderCheatsView(); break;
    case "help": renderHelpView(); break;
  }
}

// -------------------------------------------------------------
// ANEXAR / PROCESSAR JOGOS
// -------------------------------------------------------------
function setupDropzone() {
  const dz = dom.dropzone;

  ["dragenter", "dragover"].forEach((evt) => {
    dz.addEventListener(evt, (e) => {
      e.preventDefault();
      dz.classList.add("over");
      document.body.classList.add("dragging");
    });
  });

  ["dragleave", "drop"].forEach((evt) => {
    dz.addEventListener(evt, (e) => {
      e.preventDefault();
      dz.classList.remove("over");
      document.body.classList.remove("dragging");
    });
  });

  dz.addEventListener("drop", (e) => {
    if (e.dataTransfer && e.dataTransfer.files.length > 0) {
      handleFilesSelected([...e.dataTransfer.files]);
    }
  });

  // Arrastar em qualquer lugar da tela
  window.addEventListener("dragover", (e) => e.preventDefault());
  window.addEventListener("drop", (e) => {
    e.preventDefault();
    document.body.classList.remove("dragging");
    if (e.dataTransfer && e.dataTransfer.files.length > 0) {
      handleFilesSelected([...e.dataTransfer.files]);
    }
  });

  dom.dzPick.addEventListener("click", (e) => {
    e.stopPropagation();
    dom.fileInput.click();
  });

  dom.dzFolder.addEventListener("click", (e) => {
    e.stopPropagation();
    dom.folderInput.click();
  });

  dom.btnAdd.addEventListener("click", () => dom.fileInput.click());

  dom.fileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) handleFilesSelected([...e.target.files]);
    dom.fileInput.value = "";
  });

  dom.folderInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) handleFilesSelected([...e.target.files]);
    dom.folderInput.value = "";
  });
}

/** Agrupa e processa os arquivos de entrada */
async function handleFilesSelected(files) {
  if (!files || files.length === 0) return;

  // Separa eventuais BIOS soltas (.bin de 512KB como scph1001.bin)
  const isBiosFile = (f) => f.size === 524288 && /scph|ps-?[123]|bios/i.test(f.name);
  const biosFiles = files.filter(isBiosFile);
  const gameFiles = files.filter((f) => !isBiosFile(f));

  if (biosFiles.length > 0) {
    for (const b of biosFiles) {
      await db.put("bios", b.name.toLowerCase(), { name: b.name.toLowerCase(), blob: b, size: b.size });
      toast(`BIOS salva: ${b.name}`, "ok");
    }
    await refreshBiosList();
  }

  if (gameFiles.length === 0) return;

  // Analisa grupos de ROMs
  const modal = showModal({
    title: "Processando Jogos",
    content: `<div class="dz-text">Analisando arquivos recebidos (${gameFiles.length})…</div><div class="progress"><i id="mProg"></i></div>`,
    buttons: [],
  });

  const prog = document.getElementById("mProg");
  const setProg = (pct) => { if (prog) prog.style.width = Math.round(pct * 100) + "%"; };

  try {
    const groups = groupGameFiles(gameFiles);
    let done = 0;

    for (const grp of groups) {
      setProg(done / groups.length);
      await importGameGroup(grp, (p) => setProg((done + p) / groups.length));
      done++;
    }

    setProg(1);
    toast(`${groups.length} jogo(s) adicionado(s) com sucesso!`, "ok");
    await refreshGamesList();
    await updateStorageInfo();
  } catch (err) {
    console.error(err);
    toast(`Erro ao processar: ${err.message}`, "err");
  } finally {
    modal.close();
  }
}

/**
 * Agrupa arquivos soltos em entidades lógicas de jogos:
 * Exemplo 1: "Crash.cue" + "Crash (Track 1).bin" + "Crash (Track 2).bin" => 1 grupo CUE
 * Exemplo 2: "Final Fantasy.chd" => 1 grupo simples
 * Exemplo 3: "Tekken.iso" => 1 grupo simples
 */
function groupGameFiles(files) {
  const cues = files.filter((f) => f.name.toLowerCase().endsWith(".cue"));
  const bins = files.filter((f) => f.name.toLowerCase().endsWith(".bin") || f.name.toLowerCase().endsWith(".img"));
  const singles = files.filter((f) => {
    const ext = f.name.split(".").pop().toLowerCase();
    return ["iso", "chd", "pbp", "zip", "7z", "rar", "ecm"].includes(ext);
  });

  const groups = [];
  const usedFiles = new Set();

  // Para cada CUE, descobre quais BINs pertencem a ele
  for (const cue of cues) {
    usedFiles.add(cue);
    const grp = { type: "cue_multi", mainName: cue.name, cueFile: cue, dataFiles: [] };
    const baseName = cue.name.replace(/\.cue$/i, "").toLowerCase();

    // Associa todos os bins que compartilham prefixo do cue
    for (const bin of bins) {
      if (bin.name.toLowerCase().startsWith(baseName) || bins.length === 1) {
        grp.dataFiles.push(bin);
        usedFiles.add(bin);
      }
    }

    // Se nenhum achado pelo nome exato, pega todos os bins que não foram associados ainda
    if (grp.dataFiles.length === 0) {
      bins.forEach((b) => { if (!usedFiles.has(b)) { grp.dataFiles.push(b); usedFiles.add(b); } });
    }

    groups.push(grp);
  }

  // Bins órfãos (sem arquivo .cue) viram jogos individuais
  for (const bin of bins) {
    if (!usedFiles.has(bin)) {
      groups.push({ type: "single", mainName: bin.name, file: bin });
    }
  }

  // Formatos únicos (ISO, CHD, PBP, ZIP)
  for (const s of singles) {
    groups.push({ type: "single", mainName: s.name, file: s });
  }

  return groups;
}

/** Envia um arquivo para ser salvo permanentemente na pasta games/ do disco */
async function uploadFileToServer(file, onProgress) {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/games/upload?filename=${encodeURIComponent(file.name)}`, true);
    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(e.loaded / e.total);
      };
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); } catch { resolve({ success: true }); }
      } else {
        resolve(null);
      }
    };
    xhr.onerror = () => resolve(null);
    xhr.send(file);
  });
}

/** Importa um grupo (armazenando permanentemente no disco e no IndexedDB) */
async function importGameGroup(grp, onProgress) {
  let mainBlob = null;
  let detectedSerial = null;
  let title = cleanTitle(grp.mainName);
  let totalSize = 0;
  let serverSaved = false;

  // 1. Tenta salvar permanentemente no servidor local (pasta games/ do computador)
  try {
    if (grp.type === "cue_multi") {
      const cueRes = await uploadFileToServer(grp.cueFile);
      if (cueRes) {
        serverSaved = true;
        for (const b of grp.dataFiles) {
          await uploadFileToServer(b);
        }
      }
    } else if (grp.type === "single" && grp.file) {
      const sRes = await uploadFileToServer(grp.file, onProgress);
      if (sRes) serverSaved = true;
    }
  } catch (err) {
    console.warn("Erro ao salvar no disco local:", err);
  }

  // Se salvou no servidor, ele já estará salvo no disco e aparecerá na lista
  if (serverSaved) {
    return;
  }

  // 2. Fallback: salva no IndexedDB do navegador se o servidor local estiver inacessível
  if (grp.type === "cue_multi") {
    const filesToPack = [{ name: grp.cueFile.name, blob: grp.cueFile }];
    for (const b of grp.dataFiles) filesToPack.push({ name: b.name, blob: b });
    totalSize = filesToPack.reduce((acc, f) => acc + f.blob.size, 0);

    if (grp.dataFiles[0]) {
      detectedSerial = await detectSerialFromImage(grp.dataFiles[0]);
    }
    if (!detectedSerial) detectedSerial = serialFromName(grp.mainName);

    mainBlob = await makeZip(filesToPack, onProgress);
  } else {
    mainBlob = grp.file;
    totalSize = grp.file.size;
    detectedSerial = await detectSerialFromImage(grp.file) || serialFromName(grp.file.name);
  }

  let meta = null;
  if (detectedSerial && state.gameDb[detectedSerial]) {
    meta = state.gameDb[detectedSerial];
    title = meta.title || title;
  }

  const pSerial = detectedSerial ? prettySerial(detectedSerial) : "";
  const gameId = "game_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
  const record = {
    title,
    serial: detectedSerial || "",
    prettySerial: pSerial,
    region: meta ? meta.region : "Desconhecida",
    genre: meta ? meta.genre : "PlayStation",
    publisher: meta ? meta.publisher : "",
    languages: meta ? meta.languages : "",
    players: meta ? meta.players : "1",
    filename: grp.mainName,
    size: totalSize,
    blob: mainBlob,
    addedAt: Date.now(),
    lastPlayed: 0,
    playTime: 0,
    coverUrl: `/api/cover?serial=${encodeURIComponent(detectedSerial || "")}&title=${encodeURIComponent(title)}`,
  };

  await db.put("games", gameId, record);
}

// -------------------------------------------------------------
// RENDERIZAÇÃO DA BIBLIOTECA
// -------------------------------------------------------------
function setupLibraryControls() {
  dom.search.addEventListener("input", (e) => {
    state.searchQuery = e.target.value.toLowerCase().trim();
    renderLibrary();
  });
  dom.filterRegion.addEventListener("change", (e) => {
    state.filterRegion = e.target.value;
    renderLibrary();
  });
  dom.sortBy.addEventListener("change", (e) => {
    state.sortBy = e.target.value;
    renderLibrary();
  });

  if (dom.btnOpenFolder) {
    dom.btnOpenFolder.addEventListener("click", async () => {
      try {
        await fetch("/api/games/open_folder");
        toast("Pasta de jogos aberta no Windows Explorer!", "ok");
      } catch (err) {
        toast("Erro ao abrir pasta: " + err.message, "err");
      }
    });
  }

  if (dom.btnRefresh) {
    dom.btnRefresh.addEventListener("click", async () => {
      toast("Atualizando biblioteca e capas...", "info");
      await refreshGamesList();
      toast("Biblioteca atualizada com sucesso!", "ok");
    });
  }
}

function renderLibrary() {
  let list = [...state.games];

  // Filtro de busca
  if (state.searchQuery) {
    list = list.filter((g) =>
      g.title.toLowerCase().includes(state.searchQuery) ||
      (g.serial && g.serial.toLowerCase().includes(state.searchQuery)) ||
      (g.genre && g.genre.toLowerCase().includes(state.searchQuery))
    );
  }

  // Filtro de região
  if (state.filterRegion) {
    list = list.filter((g) => g.region === state.filterRegion);
  }

  // Ordenação
  list.sort((a, b) => {
    if (state.sortBy === "title") return a.title.localeCompare(b.title);
    if (state.sortBy === "added") return (b.addedAt || 0) - (a.addedAt || 0);
    if (state.sortBy === "time") return (b.playTime || 0) - (a.playTime || 0);
    return (b.lastPlayed || 0) - (a.lastPlayed || 0); // "recent"
  });

  dom.libCount.textContent = `${list.length} jogo${list.length !== 1 ? "s" : ""}`;
  dom.grid.innerHTML = "";

  if (list.length === 0) {
    dom.grid.innerHTML = `
      <div class="empty">
        <div style="font-size:48px;margin-bottom:12px">💿</div>
        <b>Nenhum jogo encontrado</b>
        <p class="muted">Arraste seus jogos baixados (.bin, .cue, .iso, .chd, .pbp, .zip) acima ou clique em "📁 Pasta no Disco" para salvar jogos!</p>
      </div>`;
    return;
  }

  list.forEach((game) => {
    const card = document.createElement("div");
    card.className = "card";
    const coverSvg = generateCoverSvg(game.title, game.prettySerial);
    const coverUrl = game.coverUrl || `/api/cover?serial=${encodeURIComponent(game.serial || "")}&title=${encodeURIComponent(game.title || "")}`;

    card.innerHTML = `
      <div class="cover">
        <img class="cover-art" src="${coverUrl}" alt="${escapeHtml(game.title)}" loading="lazy"
             onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='block';">
        <div class="cover-fallback" style="display:none;width:100%;height:100%">${coverSvg}</div>
        <div class="play">▶</div>
        ${game.region ? `<span class="tag">${regionFlag(game.region)} ${game.region}</span>` : ""}
        <span class="disc">${game.size_str || formatBytes(game.size)}</span>
        ${game.isServer ? `<span class="tag server-tag" title="Salvo permanentemente no disco">💾 Disco</span>` : ""}
      </div>
      <div class="meta">
        <b title="${escapeHtml(game.title)}">${escapeHtml(game.title)}</b>
        <small>${game.prettySerial || "PlayStation"} · ${formatTime(game.playTime)}</small>
      </div>
      <div class="menu">
        <button class="icon-btn btn-opts" title="Configurar / Capa">⚙️</button>
        <button class="icon-btn btn-del" title="Excluir">🗑️</button>
      </div>
    `;

    card.querySelector(".cover").onclick = () => launchGame(game);
    card.querySelector(".meta").onclick = () => launchGame(game);

    card.querySelector(".btn-opts").onclick = (e) => {
      e.stopPropagation();
      openGameDetailsModal(game);
    };

    card.querySelector(".btn-del").onclick = (e) => {
      e.stopPropagation();
      confirmDeleteGame(game);
    };

    dom.grid.appendChild(card);
  });
}

function openGameDetailsModal(game) {
  const profile = loadProfile(game.id) || {};
  const coverUrl = game.coverUrl || `/api/cover?serial=${encodeURIComponent(game.serial || "")}&title=${encodeURIComponent(game.title || "")}`;
  const content = document.createElement("div");
  content.innerHTML = `
    <div style="display:flex;gap:18px;margin-bottom:16px;align-items:flex-start">
      <div style="width:130px;height:130px;flex:none;position:relative;border-radius:12px;overflow:hidden;background:#090a14;box-shadow:0 8px 24px rgba(0,0,0,.5);border:1px solid var(--line)">
        <img id="detailCoverImg" src="${coverUrl}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
        <div style="display:none;width:100%;height:100%">${generateCoverSvg(game.title, game.prettySerial)}</div>
      </div>
      <div style="flex:1">
        <h4 style="margin:0 0 6px">${escapeHtml(game.title)}</h4>
        <div class="muted small">Serial: <b>${game.prettySerial || "N/A"}</b></div>
        <div class="muted small">Região: <b>${game.region}</b> · Jogadores: <b>${game.players}</b></div>
        <div class="muted small">Gênero: <b>${game.genre || "N/A"}</b></div>
        <div class="muted small">Arquivo: <b>${escapeHtml(game.filename)}</b></div>
        <div class="muted small">Tamanho: <b>${game.size_str || formatBytes(game.size)}</b></div>
        <div style="margin-top:10px;display:flex;gap:8px">
          <button class="btn sm" id="btnUploadCover">🖼️ Trocar Capa</button>
          <input type="file" id="coverFileInput" accept="image/*" hidden>
        </div>
      </div>
    </div>
    <div class="panel">
      <b>Renderizador para este jogo:</b>
      <select id="pRenderer" style="width:100%;margin-top:8px;padding:8px">
        <option value="">(Usar preferência global)</option>
        <option value="pcsx" ${profile.renderer === "pcsx" ? "selected" : ""}>PCSX ReARMed (Software / Rápido)</option>
        <option value="beetle" ${profile.renderer === "beetle" ? "selected" : ""}>Beetle PSX HW (OpenGL / Alta resolução)</option>
      </select>
    </div>
    <div class="panel">
      <b>Tipo de controle padrão:</b>
      <select id="pPadType" style="width:100%;margin-top:8px;padding:8px">
        <option value="">(Usar preferência global)</option>
        <option value="dualshock" ${profile.padType === "dualshock" ? "selected" : ""}>DualShock (Analógico)</option>
        <option value="digital" ${profile.padType === "digital" ? "selected" : ""}>Digital (Apenas D-Pad)</option>
      </select>
    </div>
  `;

  const coverInput = content.querySelector("#coverFileInput");
  const btnUploadCover = content.querySelector("#btnUploadCover");
  if (btnUploadCover && coverInput) {
    btnUploadCover.onclick = () => coverInput.click();
    coverInput.onchange = async (e) => {
      if (e.target.files.length > 0) {
        const imgFile = e.target.files[0];
        try {
          const url = `/api/cover/upload?serial=${encodeURIComponent(game.serial || "")}&title=${encodeURIComponent(game.title || "")}`;
          const upRes = await fetch(url, { method: "POST", body: imgFile });
          if (upRes.ok) {
            toast("Capa personalizada salva com sucesso!", "ok");
            const imgEl = content.querySelector("#detailCoverImg");
            if (imgEl) {
              imgEl.src = URL.createObjectURL(imgFile);
              imgEl.style.display = "block";
            }
            await refreshGamesList();
          }
        } catch (err) {
          toast("Erro ao salvar capa: " + err.message, "err");
        }
      }
    };
  }

  showModal({
    title: "Detalhes do Jogo",
    content,
    buttons: [
      {
        text: "Iniciar Jogo",
        class: "primary",
        onClick: () => { launchGame(game); },
      },
      {
        text: "Salvar Perfil",
        onClick: () => {
          const r = content.querySelector("#pRenderer").value;
          const p = content.querySelector("#pPadType").value;
          const prof = {};
          if (r) prof.renderer = r;
          if (p) prof.padType = p;
          saveProfile(game.id, prof);
          toast("Perfil do jogo salvo!", "ok");
        },
      },
      { text: "Fechar" },
    ],
  });
}

function confirmDeleteGame(game) {
  showModal({
    title: "Excluir Jogo",
    content: `<p>Tem certeza de que deseja remover <b>${escapeHtml(game.title)}</b>?</p><p class="muted small">${game.isServer ? "O arquivo será excluído da pasta de jogos no disco." : "O jogo será removido da biblioteca do navegador."}</p>`,
    buttons: [
      {
        text: "Excluir",
        class: "danger",
        onClick: async () => {
          if (game.isServer && game.filename) {
            try {
              await fetch(`/api/games/delete?name=${encodeURIComponent(game.filename)}`, { method: "DELETE" });
            } catch (err) {
              console.warn("Erro ao deletar do servidor:", err);
            }
          }
          await db.del("games", game.id);
          toast("Jogo removido.", "ok");
          await refreshGamesList();
          await updateStorageInfo();
        },
      },
      { text: "Cancelar" },
    ],
  });
}

// -------------------------------------------------------------
// EXECUÇÃO DO EMULADOR (LAUNCHER)
// -------------------------------------------------------------
let playSessionStart = 0;

async function launchGame(game) {
  state.activeGame = game;
  playSessionStart = Date.now();

  dom.loadingText.textContent = `Carregando ${game.title}…`;
  dom.loadingVeil.classList.remove("gone");
  dom.player.hidden = false;
  state.isPlaying = true;

  // Atualiza lastPlayed no banco se local
  game.lastPlayed = Date.now();
  if (!game.isServer) {
    await db.put("games", game.id, game);
  }

  // Combina preferências globais com perfil do jogo
  const profile = loadProfile(game.id) || {};
  const effectivePrefs = { ...state.prefs, ...profile };
  const res = resolve(effectivePrefs);

  // Seleção do Core
  const coreChoice = effectivePrefs.renderer === "beetle" ? CORES.beetle.id : CORES.pcsx.id;
  res.core.retroarch_core = coreChoice;

  // Busca BIOS se disponível
  let biosUrl = null;
  if (state.biosList.length > 0 && effectivePrefs.biosMode !== "hle") {
    const prefBios = state.biosList.find((b) => /scph1001|scph7502|scph5500/i.test(b.name)) || state.biosList[0];
    if (prefBios && prefBios.blob) {
      biosUrl = URL.createObjectURL(prefBios.blob);
    }
  }

  // Prepara URL do arquivo do jogo (streaming do servidor via Range requests ou Blob local)
  let gameBlobUrl = null;
  if (game.isServer && game.fileUrl) {
    gameBlobUrl = game.fileUrl;
  } else if (game.blob) {
    gameBlobUrl = URL.createObjectURL(game.blob);
  }

  // Prepara Controles para o EmulatorJS
  const controls = buildEjsControls(state.inputCfg);

  // Configuração passada ao iframe
  window.__epsxeLaunch = {
    gameUrl: gameBlobUrl,
    gameName: game.title,
    gameId: game.id,
    biosUrl,
    aspect: effectivePrefs.aspect,
    brightness: effectivePrefs.brightness,
    scanlines: effectivePrefs.scanlines,
    scanThickness: effectivePrefs.scanThickness,
    showFps: effectivePrefs.showFps,
    threads: effectivePrefs.threads,
    volume: effectivePrefs.volume,
    lang: "pt-BR",
    defaultOptions: res.core,
    controls,
    buttons: {
      playPause: true,
      restart: true,
      mute: true,
      volume: true,
      saveState: true,
      loadState: true,
      fullscreen: true,
      settings: true,
      contextMenu: false,
    },
  };

  // Conecta o motor de gamepads ao EmulatorJS dentro do iframe
  dom.frame.src = "player.html";
}

function handleIframeMessage(e) {
  if (!e.data || typeof e.data !== "object") return;
  const { type } = e.data;

  if (type === "ejs-ready") {
    // Conecta motor de controle ao GameManager
    try {
      const em = dom.frame.contentWindow.EJS_emulator;
      if (em && em.gameManager) {
        state.padEngine.attach(em.gameManager);
      }
    } catch (err) {
      console.warn("Não foi possível conectar o motor de gamepad diretamente:", err);
    }
  }

  if (type === "ejs-start") {
    dom.loadingVeil.classList.add("gone");
    toast(`Emulando ${state.activeGame?.title || "jogo"}`, "ok");
  }

  if (type === "ejs-error") {
    dom.loadingVeil.classList.add("gone");
    toast(`Erro no emulador: ${e.data.message}`, "err", 6000);
  }
}

// -------------------------------------------------------------
// MENU HUD (PAUSA DENTRO DO JOGO)
// -------------------------------------------------------------
function setupHud() {
  dom.hudBtn.addEventListener("click", () => togglePauseMenu());
}

function togglePauseMenu(forceOpen = null) {
  const willOpen = forceOpen !== null ? forceOpen : dom.pause.hidden;
  if (willOpen) {
    pauseEmulator();
    renderPauseMenu();
    dom.pause.hidden = false;
  } else {
    dom.pause.hidden = true;
    resumeEmulator();
  }
}

function pauseEmulator() {
  try {
    const em = dom.frame.contentWindow?.EJS_emulator;
    if (em && !em.paused) em.togglePlaying(true);
  } catch { /* ignore */ }
}

function resumeEmulator() {
  try {
    const em = dom.frame.contentWindow?.EJS_emulator;
    if (em && em.paused) em.togglePlaying(false);
  } catch { /* ignore */ }
}

function renderPauseMenu() {
  const g = state.activeGame;
  dom.pause.innerHTML = `
    <div class="pbox">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <h3 style="margin:0">${escapeHtml(g?.title || "Menu do Emulador")}</h3>
        <button class="btn sm" id="pResume">✕ Continuar (Esc)</button>
      </div>

      <div class="pgrid">
        <button class="btn" id="pSave">💾 Salvar Estado (Slot ${state.activeSaveSlot})</button>
        <button class="btn" id="pLoad">📂 Carregar Estado (Slot ${state.activeSaveSlot})</button>
        <button class="btn" id="pDisc">💿 Trocar Disco</button>
        <button class="btn" id="pReset">🔄 Resetar Jogo</button>
        <button class="btn" id="pCheats">✨ Cheats (GameShark)</button>
        <button class="btn" id="pPrefs">⚙️ Ajustes Rápidos</button>
        <button class="btn danger" id="pQuit">🚪 Sair do Jogo</button>
      </div>

      <div style="margin-top:16px">
        <div class="muted small" style="margin-bottom:8px">Slots de Salvamento Rápido:</div>
        <div class="slots" id="pSlots">
          ${[1, 2, 3, 4, 5].map((slot) => `
            <div class="slot ${state.activeSaveSlot === slot ? "active" : ""}" data-slot="${slot}" style="cursor:pointer;padding:8px">
              <div style="font-size:20px;margin-bottom:4px">💾 Slot ${slot}</div>
              <small class="muted">${state.activeSaveSlot === slot ? "● Selecionado" : "Clique p/ selecionar"}</small>
            </div>
          `).join("")}
        </div>
      </div>
    </div>
  `;

  dom.pause.querySelector("#pResume").onclick = () => togglePauseMenu(false);
  dom.pause.querySelector("#pSave").onclick = () => { quickSaveState(); togglePauseMenu(false); };
  dom.pause.querySelector("#pLoad").onclick = () => { quickLoadState(); togglePauseMenu(false); };
  dom.pause.querySelector("#pDisc").onclick = () => promptChangeDisc();
  dom.pause.querySelector("#pReset").onclick = () => resetGame();
  dom.pause.querySelector("#pCheats").onclick = () => openInGameCheats();
  dom.pause.querySelector("#pPrefs").onclick = () => openQuickPrefsModal();
  dom.pause.querySelector("#pQuit").onclick = () => exitGame();

  dom.pause.querySelectorAll(".slot").forEach((el) => {
    el.onclick = () => {
      state.activeSaveSlot = parseInt(el.dataset.slot);
      renderPauseMenu();
      toast(`Slot ${state.activeSaveSlot} selecionado`, "info");
    };
  });
}

function quickSaveState() {
  try {
    const em = dom.frame.contentWindow?.EJS_emulator;
    if (em && em.gameManager) {
      const ok = em.gameManager.quickSave(state.activeSaveSlot);
      if (ok) toast(`Estado salvo no Slot ${state.activeSaveSlot}!`, "ok");
      else toast("Erro ao salvar estado.", "err");
    }
  } catch (err) {
    toast(`Erro: ${err.message}`, "err");
  }
}

function quickLoadState() {
  try {
    const em = dom.frame.contentWindow?.EJS_emulator;
    if (em && em.gameManager) {
      em.gameManager.quickLoad(state.activeSaveSlot);
      toast(`Estado carregado do Slot ${state.activeSaveSlot}!`, "ok");
    }
  } catch (err) {
    toast(`Erro: ${err.message}`, "err");
  }
}

function toggleTurbo(active) {
  try {
    const em = dom.frame.contentWindow?.EJS_emulator;
    if (em && em.gameManager && em.gameManager.functions) {
      em.gameManager.functions.toggleFastForward(active ? 1 : 0);
    }
  } catch { /* ignore */ }
}

function resetGame() {
  try {
    const em = dom.frame.contentWindow?.EJS_emulator;
    if (em && em.gameManager && em.gameManager.functions) {
      em.gameManager.functions.restart();
      togglePauseMenu(false);
      toast("Jogo reiniciado.", "info");
    }
  } catch (err) {
    toast(`Erro ao reiniciar: ${err.message}`, "err");
  }
}

function promptChangeDisc() {
  showModal({
    title: "Trocar de Disco",
    content: `
      <p>Selecione o arquivo da imagem do próximo disco (.cue, .iso, .bin, .chd):</p>
      <input type="file" id="mDiscFile" accept=".cue,.bin,.iso,.img,.chd">
    `,
    buttons: [
      {
        text: "Trocar",
        class: "primary",
        onClick: () => {
          const f = document.getElementById("mDiscFile").files[0];
          if (!f) { toast("Nenhum arquivo selecionado", "warn"); return false; }
          try {
            const em = dom.frame.contentWindow?.EJS_emulator;
            if (em && em.gameManager) {
              const url = URL.createObjectURL(f);
              // EmulatorJS disk swap
              em.downloadGameFile(url, "rom", "Trocando disco...", "Descompactando...").then(() => {
                toast(`Disco trocado para ${f.name}!`, "ok");
                togglePauseMenu(false);
              });
            }
          } catch (err) {
            toast(`Erro: ${err.message}`, "err");
          }
        },
      },
      { text: "Cancelar" },
    ],
  });
}

function openInGameCheats() {
  showModal({
    title: "Cheats GameShark",
    content: `
      <p class="small muted">Cole ou edite códigos GameShark para este jogo:</p>
      <textarea id="mCheatCodes" class="code" placeholder="#Vidas Infinitas&#10;8009A120 0003"></textarea>
    `,
    buttons: [
      {
        text: "Aplicar Cheats",
        class: "primary",
        onClick: () => {
          const txt = document.getElementById("mCheatCodes").value;
          applyCheatCodes(txt);
          toast("Cheats aplicados!", "ok");
        },
      },
      { text: "Fechar" },
    ],
  });
}

function applyCheatCodes(txt) {
  try {
    const em = dom.frame.contentWindow?.EJS_emulator;
    if (em && em.gameManager) {
      em.gameManager.resetCheat();
      const lines = txt.split("\n");
      let idx = 0;
      for (const line of lines) {
        const tr = line.trim();
        if (tr && !tr.startsWith("#")) {
          em.gameManager.setCheat(idx++, tr, true);
        }
      }
    }
  } catch (err) {
    console.warn("Erro ao aplicar cheats:", err);
  }
}

function openQuickPrefsModal() {
  showModal({
    title: "Ajustes Rápidos de Vídeo e Som",
    content: `
      <div class="panel">
        <label>Proporção de Tela:</label>
        <select id="mAspect" style="width:100%;padding:8px;margin-top:6px">
          <option value="4:3">4:3 (Original PSX)</option>
          <option value="16:9">16:9 (Widescreen)</option>
          <option value="stretch">Esticar Total</option>
        </select>
      </div>
      <div class="panel">
        <label>Volume do Jogo:</label>
        <input type="range" id="mVol" min="0" max="1" step="0.05" value="${state.prefs.volume}" style="width:100%">
      </div>
    `,
    buttons: [
      {
        text: "Aplicar",
        class: "primary",
        onClick: () => {
          const asp = document.getElementById("mAspect").value;
          const vol = parseFloat(document.getElementById("mVol").value);
          state.prefs.aspect = asp;
          state.prefs.volume = vol;
          savePrefs(state.prefs);

          // Ajusta no player
          try {
            const frameDoc = dom.frame.contentWindow?.document;
            const pFrame = frameDoc?.getElementById("frame");
            if (pFrame) {
              if (asp === "4:3") pFrame.style.aspectRatio = "4 / 3";
              else if (asp === "16:9") pFrame.style.aspectRatio = "16 / 9";
              else pFrame.style.aspectRatio = "auto";
            }
            const em = dom.frame.contentWindow?.EJS_emulator;
            if (em) em.setVolume(vol);
          } catch { /* ignore */ }

          toast("Ajustes aplicados!", "ok");
        },
      },
      { text: "Fechar" },
    ],
  });
}

async function exitGame() {
  if (state.activeGame && playSessionStart > 0) {
    const elapsed = Math.round((Date.now() - playSessionStart) / 1000);
    state.activeGame.playTime = (state.activeGame.playTime || 0) + elapsed;
    await db.put("games", state.activeGame.id, state.activeGame);
  }

  // Tenta salvar SRAM/Memcard antes de descarregar
  try {
    const em = dom.frame.contentWindow?.EJS_emulator;
    if (em && em.gameManager) em.gameManager.saveSaveFiles();
  } catch { /* ignore */ }

  state.padEngine.detach();
  dom.frame.src = "about:blank";
  dom.player.hidden = true;
  dom.pause.hidden = true;
  state.isPlaying = false;
  state.activeGame = null;

  await refreshGamesList();
  toast("Jogo encerrado.", "info");
}

// -------------------------------------------------------------
// TELAS DE CONFIGURAÇÃO (BIOS, PREFS, CONTROLES, SAVES, CHEATS, AJUDA)
// -------------------------------------------------------------

// 1. BIOS
function renderBiosView() {
  const v = dom.views.bios;
  v.innerHTML = `
    <h2>Gerenciador de BIOS PSX</h2>
    <p class="sub">O emulador inclui uma BIOS HLE simulada de alta compatibilidade. Se preferir a autenticidade máxima de boot e memcards, envie uma BIOS oficial (.bin).</p>

    <div class="panel">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <b>BIOS Instaladas (${state.biosList.length})</b>
        <button class="btn primary sm" id="bAdd">＋ Enviar BIOS (.bin)</button>
      </div>
      <div class="list" id="bList">
        ${state.biosList.length === 0 ? `<div class="empty">Nenhuma BIOS enviada. O emulador usará o modo HLE automático.</div>` : ""}
      </div>
    </div>

    <div class="panel">
      <h3>BIOS Recomendadas:</h3>
      <table class="table">
        <tr><th>Arquivo</th><th>Região</th><th>Uso Principal</th></tr>
        <tr><td><code>scph1001.bin</code></td><td>NTSC-U (América)</td><td>Maior compatibilidade geral</td></tr>
        <tr><td><code>scph7502.bin</code></td><td>PAL (Europa)</td><td>Jogos europeus</td></tr>
        <tr><td><code>scph5500.bin</code></td><td>NTSC-J (Japão)</td><td>Jogos japoneses</td></tr>
      </table>
    </div>
  `;

  const bl = v.querySelector("#bList");
  state.biosList.forEach((b) => {
    const item = document.createElement("div");
    item.className = "item";
    item.innerHTML = `
      <div style="font-size:28px">🧩</div>
      <div class="grow">
        <b>${escapeHtml(b.name)}</b>
        <small class="muted">${formatBytes(b.size)}</small>
      </div>
      <button class="btn danger sm bDel">Excluir</button>
    `;
    item.querySelector(".bDel").onclick = async () => {
      await db.del("bios", b.name);
      toast("BIOS removida.", "ok");
      await refreshBiosList();
      renderBiosView();
    };
    bl.appendChild(item);
  });

  v.querySelector("#bAdd").onclick = () => dom.biosInput.click();
  dom.biosInput.onchange = async (e) => {
    if (e.target.files.length > 0) {
      for (const f of e.target.files) {
        await db.put("bios", f.name.toLowerCase(), { name: f.name.toLowerCase(), blob: f, size: f.size });
        toast(`BIOS ${f.name} adicionada!`, "ok");
      }
      await refreshBiosList();
      renderBiosView();
    }
    dom.biosInput.value = "";
  };
}

// 2. PREFERÊNCIAS (ESPELHO DO ePSXe)
function renderPrefsView() {
  const v = dom.views.prefs;
  v.innerHTML = `
    <h2>Preferências do ePSXe</h2>
    <p class="sub">Ajuste todos os parâmetros de hardware emulado (BIOS, CPU, Vídeo, Som, Tela e Sistema).</p>
    <div class="tabs" id="pTabs">
      ${SCHEMA.map((g) => `<button class="tab ${state.activeTabPrefs === g.id ? "active" : ""}" data-tab="${g.id}">${g.icon} ${g.title}</button>`).join("")}
    </div>
    <div class="panel" id="pFields"></div>
  `;

  v.querySelectorAll(".tab").forEach((btn) => {
    btn.onclick = () => {
      state.activeTabPrefs = btn.dataset.tab;
      renderPrefsView();
    };
  });

  const pf = v.querySelector("#pFields");
  const grp = SCHEMA.find((g) => g.id === state.activeTabPrefs) || SCHEMA[0];

  grp.items.forEach((it) => {
    const row = document.createElement("div");
    row.className = "row";
    const val = state.prefs[it.key] ?? it.def;

    let controlHtml = "";
    if (it.type === "toggle") {
      controlHtml = `
        <label class="switch">
          <input type="checkbox" id="cfg_${it.key}" ${val ? "checked" : ""}>
          <i></i>
        </label>`;
    } else if (it.type === "select") {
      controlHtml = `
        <select id="cfg_${it.key}">
          ${it.options.map(([optVal, optLabel]) => `<option value="${optVal}" ${optVal === val ? "selected" : ""}>${optLabel}</option>`).join("")}
        </select>`;
    } else if (it.type === "range") {
      controlHtml = `
        <div style="display:flex;align-items:center;gap:10px">
          <input type="range" id="cfg_${it.key}" min="${it.min}" max="${it.max}" step="${it.step}" value="${val}">
          <span class="rangeval" id="val_${it.key}">${val}</span>
        </div>`;
    }

    row.innerHTML = `
      <div class="lbl">
        <b>${it.label}</b>
        <span>${it.desc || ""}</span>
      </div>
      ${controlHtml}
    `;

    pf.appendChild(row);

    // Bind change
    const el = row.querySelector(`#cfg_${it.key}`);
    if (it.type === "toggle") {
      el.onchange = () => {
        state.prefs[it.key] = el.checked;
        savePrefs(state.prefs);
      };
    } else if (it.type === "select") {
      el.onchange = () => {
        state.prefs[it.key] = el.value;
        savePrefs(state.prefs);
      };
    } else if (it.type === "range") {
      const sp = row.querySelector(`#val_${it.key}`);
      el.oninput = () => {
        sp.textContent = el.value;
        state.prefs[it.key] = parseFloat(el.value);
        savePrefs(state.prefs);
      };
    }
  });
}

// 3. CONTROLES (MAPEAMENTO E TESTE DE GAMEPAD E TECLADO P1 E P2)
let _activePadListener = null;

function renderControlsView() {
  const v = dom.views.controls;
  const p = state.activeTabControls || 0; // 0 = Player 1, 1 = Player 2
  const pCfg = state.inputCfg.players[p] || state.inputCfg.players[0];
  const connectedPads = state.padEngine.pads();
  const assignedPad = state.padEngine.padFor(p);
  const subTab = state.controlsSubTab || "gamepad";

  v.innerHTML = `
    <h2>Configuração de Controles (Player 1 e Player 2)</h2>
    <p class="sub">Suporte completo e independente para Player 1 e Player 2. Configure controles Bluetooth / USB (PS4, PS5, Xbox) e Teclado com remapeamento em tempo real.</p>

    <!-- Seletor de Jogador: Player 1 e Player 2 -->
    <div class="tabs" style="margin-bottom:16px">
      <button class="tab ${p === 0 ? "active" : ""}" data-player="0">🎮 Jogador 1 (Player 1)</button>
      <button class="tab ${p === 1 ? "active" : ""}" data-player="1">🎮 Jogador 2 (Player 2)</button>
    </div>

    <!-- Status de Conexão e Atribuição do Dispositivo -->
    <div class="panel">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:14px">
        <div>
          <b>Dispositivo Conectado ao Jogador ${p + 1}:</b>
          <div style="margin-top:6px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span class="chip ${assignedPad ? "ok" : "warn"}">
              ${assignedPad ? `🟢 Controle Bluetooth / USB: ${escapeHtml(assignedPad.id)} (Índice ${assignedPad.index})` : "⌨️ Teclado Ativo (Nenhum controle Bluetooth conectado neste slot)"}
            </span>
            ${assignedPad?.vibrationActuator ? `<span class="chip ok" title="Vibração háptica disponível">📳 Vibração Pronta</span>` : ""}
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${assignedPad ? `<button class="btn sm" id="btnTestVibration">📳 Testar Vibração</button>` : ""}
          <button class="btn sm" id="btnResetCurrentPad">↺ Restaurar Padrão</button>
        </div>
      </div>

      <div class="row">
        <div class="lbl">
          <b>Vincular Controle Bluetooth / USB:</b>
          <span>Escolha qual controle físico controla o Jogador ${p + 1}</span>
        </div>
        <select id="selPadAssignment">
          <option value="auto" ${pCfg.gamepadIndex === null ? "selected" : ""}>Automático (Ordem de conexão: Controle ${p + 1})</option>
          ${connectedPads.map((gp) => `<option value="${gp.index}" ${pCfg.gamepadIndex === gp.index ? "selected" : ""}>Controle ${gp.index + 1}: ${escapeHtml(gp.id)}</option>`).join("")}
          <option value="none" ${pCfg.gamepadIndex === -1 ? "selected" : ""}>Desativar Gamepad (Apenas Teclado)</option>
        </select>
      </div>

      <div class="row">
        <div class="lbl">
          <b>Vibração Háptica no Controle:</b>
          <span>Ativa vibração de impacto nos controles Bluetooth compatíveis (PS4, PS5 DualSense, Xbox)</span>
        </div>
        <label class="switch">
          <input type="checkbox" id="chkVibration" ${pCfg.vibration ? "checked" : ""}>
          <i></i>
        </label>
      </div>
    </div>

    <!-- Sub-abas: Controle Bluetooth vs Teclado -->
    <div class="subtabs">
      <button class="subtab ${subTab === "gamepad" ? "active" : ""}" data-sub="gamepad">🎮 Mapeamento do Controle Bluetooth / USB</button>
      <button class="subtab ${subTab === "keyboard" ? "active" : ""}" data-sub="keyboard">⌨️ Mapeamento do Teclado (Jogador ${p + 1})</button>
    </div>

    ${subTab === "gamepad" ? `
      <!-- Mapeamento Gamepad Bluetooth -->
      <div class="panel">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
          <div>
            <b>Mapeamento dos Botões PlayStation (Jogador ${p + 1}):</b>
            <div class="muted small">Clique em qualquer botão e aperte o botão correspondente no seu controle Bluetooth para remapear</div>
          </div>
          <div style="display:flex;gap:6px">
            <button class="btn sm" id="btnPresetPS">Preset PS4/PS5</button>
            <button class="btn sm" id="btnPresetXbox">Preset Xbox</button>
          </div>
        </div>

        <div class="mapgrid" id="mGamepadGrid"></div>

        <div style="margin-top:20px">
          <b>Calibração Analógica dos Joysticks (L / R):</b>
          <div class="row">
            <div class="lbl"><b>Zona Morta (Deadzone)</b><span>Reduz movimentação fantasma dos analógicos</span></div>
            <input type="range" id="cDz" min="0" max="0.4" step="0.02" value="${pCfg.deadzoneL}">
            <span class="rangeval" id="cDzVal">${Math.round(pCfg.deadzoneL * 100)}%</span>
          </div>
          <div class="row">
            <div class="lbl"><b>Inverter Eixo Y (Vertical)</b><span>Inverte cima e baixo no analógico direito</span></div>
            <label class="switch">
              <input type="checkbox" id="chkInvertY" ${pCfg.invertY ? "checked" : ""}>
              <i></i>
            </label>
          </div>
        </div>

        <!-- Indicador de eixos em tempo real -->
        <div style="margin-top:16px;padding:12px;border-radius:12px;background:var(--bg2);border:1px solid var(--line)">
          <div class="muted small" style="margin-bottom:6px">Monitor de Analógicos ao Vivo (Mova os analógicos para testar):</div>
          <div style="display:flex;gap:24px;font-family:monospace;font-size:12px">
            <div>Analógico Esquerdo (LX, LY): <b id="liveStickL" style="color:var(--acc2)">0.00, 0.00</b></div>
            <div>Analógico Direito (RX, RY): <b id="liveStickR" style="color:var(--acc2)">0.00, 0.00</b></div>
          </div>
        </div>
      </div>
    ` : `
      <!-- Mapeamento Teclado -->
      <div class="panel">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
          <div>
            <b>Teclas do Jogador ${p + 1}:</b>
            <div class="muted small">Clique no botão e pressione qualquer tecla do teclado para vincular</div>
          </div>
          <div style="display:flex;gap:6px">
            ${p === 0 ? `
              <button class="btn sm" id="btnPresetKbdArrows">Preset Setas + ZXCS (Clássico)</button>
              <button class="btn sm" id="btnPresetKbdWasd">Preset WASD + JKL</button>
            ` : `
              <button class="btn sm" id="btnPresetKbdWasdP2">Preset WASD + JKUI (Padrão 2P)</button>
              <button class="btn sm" id="btnPresetKbdNumpad">Preset Teclado Numérico</button>
            `}
          </div>
        </div>

        <div class="mapgrid" id="mKeyboardGrid"></div>
      </div>
    `}
  `;

  // 1. Troca de Jogador (Player 1 e Player 2)
  v.querySelectorAll(".tabs button[data-player]").forEach((btn) => {
    btn.onclick = () => {
      state.activeTabControls = parseInt(btn.dataset.player);
      renderControlsView();
    };
  });

  // 2. Troca de Sub-aba (Controle Bluetooth vs Teclado)
  v.querySelectorAll(".subtabs button[data-sub]").forEach((btn) => {
    btn.onclick = () => {
      state.controlsSubTab = btn.dataset.sub;
      renderControlsView();
    };
  });

  // 3. Atribuição de Dispositivo
  const selAssignment = v.querySelector("#selPadAssignment");
  if (selAssignment) {
    selAssignment.onchange = (e) => {
      const val = e.target.value;
      if (val === "auto") pCfg.gamepadIndex = null;
      else if (val === "none") pCfg.gamepadIndex = -1;
      else pCfg.gamepadIndex = parseInt(val);
      saveInputCfg(state.inputCfg);
      renderControlsView();
      toast(`Controle do Jogador ${p + 1} atualizado!`, "ok");
    };
  }

  // 4. Vibração Háptica
  const chkVibe = v.querySelector("#chkVibration");
  if (chkVibe) {
    chkVibe.onchange = (e) => {
      pCfg.vibration = e.target.checked;
      saveInputCfg(state.inputCfg);
    };
  }

  const btnTestVibe = v.querySelector("#btnTestVibration");
  if (btnTestVibe) {
    btnTestVibe.onclick = async () => {
      const ok = await state.padEngine.vibrate(p, 0.8, 0.8, 400);
      if (ok) toast("Vibração disparada no controle!", "ok");
      else toast("Controle não respondeu ou não suporta vibração pelo navegador.", "warn");
    };
  }

  // 5. Mapeamento Gamepad
  if (subTab === "gamepad") {
    const mg = v.querySelector("#mGamepadGrid");
    PS_BUTTONS.forEach((b) => {
      const curVal = pCfg.gamepadMap[b.id];
      const btn = document.createElement("button");
      btn.className = "mapbtn";
      btn.dataset.buttonId = b.id;

      let labelText = "—";
      if (curVal != null) {
        if (typeof curVal === "string") labelText = `Eixo ${curVal}`;
        else labelText = `Botão ${curVal}`;
      }

      btn.innerHTML = `<b>${b.label}</b><small>${labelText}</small>`;

      btn.onclick = () => {
        btn.classList.add("listen");
        btn.querySelector("small").textContent = "Pressione no controle…";
        state.padEngine.listen(p, (hit) => {
          pCfg.gamepadMap[b.id] = hit.value;
          saveInputCfg(state.inputCfg);
          renderControlsView();
          toast(`${b.label} mapeado!`, "ok");
        });
      };

      mg.appendChild(btn);
    });

    // Zona Morta
    const cDz = v.querySelector("#cDz");
    if (cDz) {
      cDz.oninput = (e) => {
        const val = parseFloat(e.target.value);
        pCfg.deadzoneL = val;
        pCfg.deadzoneR = val;
        v.querySelector("#cDzVal").textContent = Math.round(val * 100) + "%";
        saveInputCfg(state.inputCfg);
      };
    }

    // Inverter Eixo Y
    const chkInv = v.querySelector("#chkInvertY");
    if (chkInv) {
      chkInv.onchange = (e) => {
        pCfg.invertY = e.target.checked;
        saveInputCfg(state.inputCfg);
      };
    }

    // Presets Gamepad
    const btnPS = v.querySelector("#btnPresetPS");
    if (btnPS) {
      btnPS.onclick = () => {
        pCfg.gamepadMap = { ...STANDARD_GAMEPAD_MAP };
        saveInputCfg(state.inputCfg);
        renderControlsView();
        toast("Preset PlayStation 4 / 5 aplicado!", "ok");
      };
    }
    const btnXbox = v.querySelector("#btnPresetXbox");
    if (btnXbox) {
      btnXbox.onclick = () => {
        pCfg.gamepadMap = { ...STANDARD_GAMEPAD_MAP };
        saveInputCfg(state.inputCfg);
        renderControlsView();
        toast("Preset Xbox Wireless aplicado!", "ok");
      };
    }
  }

  // 6. Mapeamento Teclado
  if (subTab === "keyboard") {
    const kGrid = v.querySelector("#mKeyboardGrid");
    PS_BUTTONS.forEach((b) => {
      const curKey = pCfg.keyboardMap[b.id] || "—";
      const btn = document.createElement("button");
      btn.className = "mapbtn";
      btn.innerHTML = `<b>${b.label}</b><small><kbd>${curKey.toUpperCase()}</kbd></small>`;

      btn.onclick = () => {
        btn.classList.add("listen");
        btn.querySelector("small").innerHTML = "<span style='color:var(--acc2)'>Pressione tecla…</span>";

        const onKeyDown = (e) => {
          e.preventDefault();
          e.stopPropagation();
          window.removeEventListener("keydown", onKeyDown, true);
          const keyName = keyCodeToName(e);
          pCfg.keyboardMap[b.id] = keyName;
          saveInputCfg(state.inputCfg);
          renderControlsView();
          toast(`${b.label} mapeado para a tecla "${keyName.toUpperCase()}"!`, "ok");
        };

        window.addEventListener("keydown", onKeyDown, { capture: true, once: true });
      };

      kGrid.appendChild(btn);
    });

    // Presets de Teclado Jogador 1
    const btnArrows = v.querySelector("#btnPresetKbdArrows");
    if (btnArrows) {
      btnArrows.onclick = () => {
        pCfg.keyboardMap = { ...KEYBOARD_P1_DEFAULT };
        saveInputCfg(state.inputCfg);
        renderControlsView();
        toast("Preset Setas + ZXCS restaurado para o Jogador 1!", "ok");
      };
    }
    const btnWasd1 = v.querySelector("#btnPresetKbdWasd");
    if (btnWasd1) {
      btnWasd1.onclick = () => {
        pCfg.keyboardMap = {
          up: "w", down: "s", left: "a", right: "d",
          cross: "k", circle: "l", square: "j", triangle: "i",
          l1: "u", r1: "o", l2: "1", r2: "3",
          l3: "f", r3: "g", select: "v", start: "enter",
        };
        saveInputCfg(state.inputCfg);
        renderControlsView();
        toast("Preset WASD + JKL aplicado para o Jogador 1!", "ok");
      };
    }

    // Presets de Teclado Jogador 2
    const btnWasd2 = v.querySelector("#btnPresetKbdWasdP2");
    if (btnWasd2) {
      btnWasd2.onclick = () => {
        pCfg.keyboardMap = { ...KEYBOARD_P2_DEFAULT };
        saveInputCfg(state.inputCfg);
        renderControlsView();
        toast("Preset WASD + JKUI aplicado para o Jogador 2!", "ok");
      };
    }
    const btnNumpad = v.querySelector("#btnPresetKbdNumpad");
    if (btnNumpad) {
      btnNumpad.onclick = () => {
        pCfg.keyboardMap = {
          up: "numpad 8", down: "numpad 2", left: "numpad 4", right: "numpad 6",
          cross: "numpad 1", circle: "numpad 3", square: "numpad 7", triangle: "numpad 9",
          l1: "numpad /", r1: "numpad *", l2: "numpad -", r2: "numpad +",
          l3: "numpad 5", r3: "numpad 0", select: "delete", start: "numpad enter",
        };
        saveInputCfg(state.inputCfg);
        renderControlsView();
        toast("Preset Teclado Numérico aplicado para o Jogador 2!", "ok");
      };
    }
  }

  // 7. Restaurar Padrão Geral do Jogador
  const btnReset = v.querySelector("#btnResetCurrentPad");
  if (btnReset) {
    btnReset.onclick = () => {
      pCfg.gamepadMap = { ...STANDARD_GAMEPAD_MAP };
      pCfg.keyboardMap = p === 0 ? { ...KEYBOARD_P1_DEFAULT } : { ...KEYBOARD_P2_DEFAULT };
      pCfg.deadzoneL = 0.15;
      pCfg.deadzoneR = 0.15;
      pCfg.invertY = false;
      pCfg.vibration = true;
      saveInputCfg(state.inputCfg);
      renderControlsView();
      toast(`Configurações do Jogador ${p + 1} restauradas para o padrão!`, "info");
    };
  }

  // 8. Monitor ao Vivo de Eixos
  if (!_activePadListener) {
    _activePadListener = (e) => {
      if (state.currentView !== "controls") return;
      const snap = e.detail;
      const pIdx = state.activeTabControls || 0;
      const curSnap = snap?.[pIdx];
      if (curSnap) {
        const lxEl = document.getElementById("liveStickL");
        const rxEl = document.getElementById("liveStickR");
        if (lxEl) lxEl.textContent = `${curSnap.axes.lx.toFixed(2)}, ${curSnap.axes.ly.toFixed(2)}`;
        if (rxEl) rxEl.textContent = `${curSnap.axes.rx.toFixed(2)}, ${curSnap.axes.ry.toFixed(2)}`;

        // Destaca botões pressionados em tempo real na interface
        document.querySelectorAll("#mGamepadGrid .mapbtn").forEach((el) => {
          const bId = el.dataset.buttonId;
          if (bId && curSnap.buttons[bId]) {
            el.classList.add("active-press");
          } else {
            el.classList.remove("active-press");
          }
        });
      }
    };
    state.padEngine.addEventListener("frame", _activePadListener);
  }
}

// 4. SAVES / MEMORY CARDS
async function renderSavesView() {
  const v = dom.views.saves;
  const saves = await db.all("autosaves");

  v.innerHTML = `
    <h2>Cartões de Memória e Saves</h2>
    <p class="sub">Os saves originais de Memory Card (.mcr / .srm) e Save States ficam salvos localmente no seu navegador.</p>

    <div class="panel">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <b>Saves Armazenados (${saves.length})</b>
        <div>
          <button class="btn sm" id="btnExportSaves">Exportar Todos</button>
        </div>
      </div>
      <div class="list">
        ${saves.length === 0 ? `<div class="empty">Nenhum save de Memory Card gravado ainda. Jogue e salve no ponto de salvamento dos seus jogos!</div>` : ""}
      </div>
    </div>
  `;
}

// 5. CHEATS
function renderCheatsView() {
  const v = dom.views.cheats;
  v.innerHTML = `
    <h2>Banco de Cheats (GameShark)</h2>
    <p class="sub">O ePSXe suporta códigos de trapaça GameShark no formato padrão <code>XXXXXXXX YYYY</code>.</p>
    <div class="panel">
      <b>Exemplo de Código GameShark:</b>
      <pre style="background:var(--bg2);padding:14px;border-radius:10px;margin-top:8px"># Gran Turismo - Créditos Máximos
80045B28 FFFF
80045B2A 00FF

# Resident Evil 3 - Munição Infinita
800C3BE8 0063</pre>
      <p class="muted small">Você pode ativar ou digitar novos cheats diretamente no Menu de Pausa (Esc) durante o jogo.</p>
    </div>
  `;
}

// 6. AJUDA
function renderHelpView() {
  const v = dom.views.help;
  v.innerHTML = `
    <h2>Guia de Uso — ePSXe Web</h2>
    <p class="sub">Tudo o que você precisa saber para a melhor experiência de emulação no navegador.</p>

    <div class="panel">
      <h3>1. Como carregar seus jogos:</h3>
      <p>Basta arrastar seus arquivos de imagem de disco para a tela <b>Biblioteca</b>. Formatos suportados:</p>
      <ul>
        <li><b>.CUE + .BIN:</b> Selecione o arquivo .cue junto com todos os .bin ao mesmo tempo. O ePSXe Web une os arquivos automaticamente!</li>
        <li><b>.ISO / .IMG / .CHD / .PBP:</b> Selecione diretamente o arquivo único.</li>
        <li><b>.ZIP / .7Z:</b> Descompactado automaticamente na memória pelo emulador.</li>
      </ul>
    </div>

    <div class="panel">
      <h3>2. Controles:</h3>
      <p>Conecte qualquer controle via USB ou Bluetooth (DualShock 4, DualSense, Xbox One/Series, controles genéricos). Eles são detectados automaticamente!</p>
      <p>No teclado, use as setas para mover, <b>X</b> (Cross), <b>C</b> (Circle), <b>Z</b> (Square), <b>S</b> (Triangle), <b>Enter</b> (Start) e <b>V</b> (Select).</p>
      <p>Pressione <b>Esc</b> ou o botão <b>Guide/Home</b> do controle para pausar e abrir o menu de savestates e opções.</p>
    </div>
  `;
}

// Executa inicialização
init();
