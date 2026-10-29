"""Servidor local aprimorado do ePSXe Web.

Recursos:
- Serve arquivos estáticos com suporte completo a SharedArrayBuffer (COOP/COEP/CORP).
- Suporte a HTTP Range Requests (RFC 7233) para streaming direto de jogos gigantes (.bin, .iso, .chd).
- Gerenciamento persistente da pasta local 'games/':
  - Detecção automática de jogos PS1 (.bin, .cue, .iso, .img, .chd, .pbp, .zip, .7z).
  - Reconhecimento automático de serial (SYSTEM.CNF ou nome de arquivo).
  - Associação com banco oficial de ~11.000 jogos do ePSXe (título, região, gênero).
- Upload direto e salvamento permanente de jogos no disco (/api/games/upload).
- Busca e cache automático de capas oficiais na web (/api/cover) via xlenore/psx-covers e libretro.
- Abertura da pasta de jogos no Windows Explorer (/api/games/open_folder).
- Suporte a BIOS em 'bios/' e Memory Cards em 'saves/'.
"""

import http.server
import json
import mimetypes
import os
import re
import socketserver
import subprocess
import sys
import urllib.parse
import urllib.request
import webbrowser

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
GAMES_DIR = os.path.join(BASE_DIR, "games")
COVERS_DIR = os.path.join(BASE_DIR, "covers")
BIOS_DIR = os.path.join(BASE_DIR, "bios")
SAVES_DIR = os.path.join(BASE_DIR, "saves")
GAMEDB_FILE = os.path.join(STATIC_DIR, "data", "gamedb.json")

for d in (GAMES_DIR, COVERS_DIR, BIOS_DIR, SAVES_DIR):
    os.makedirs(d, exist_ok=True)

PORT = 8765
for arg in sys.argv[1:]:
    if arg.isdigit():
        PORT = int(arg)
        break

# Tipos MIME essenciais
mimetypes.add_type("application/wasm", ".wasm")
mimetypes.add_type("text/javascript", ".js")
mimetypes.add_type("text/javascript", ".mjs")
mimetypes.add_type("application/json", ".json")
mimetypes.add_type("application/octet-stream", ".data")
mimetypes.add_type("application/octet-stream", ".bin")
mimetypes.add_type("application/octet-stream", ".iso")
mimetypes.add_type("application/octet-stream", ".img")
mimetypes.add_type("application/octet-stream", ".chd")
mimetypes.add_type("application/octet-stream", ".pbp")
mimetypes.add_type("text/plain", ".cue")
mimetypes.add_type("image/jpeg", ".jpg")
mimetypes.add_type("image/jpeg", ".jpeg")
mimetypes.add_type("image/png", ".png")
mimetypes.add_type("image/svg+xml", ".svg")

# Carrega banco de dados de jogos se presente
_GAMEDB = {}
if os.path.isfile(GAMEDB_FILE):
    try:
        with open(GAMEDB_FILE, "r", encoding="utf-8") as f:
            _GAMEDB = json.load(f)
    except Exception as e:
        print(f"[Aviso] Falha ao ler gamedb.json: {e}")

# Regex para serial
BOOT_RE = re.compile(rb"BOOT\s*=\s*cdrom:?[\\/]*([A-Za-z]{4})_?(\d{3})\.?(\d{2})", re.IGNORECASE)
ID_RE = re.compile(r"\b(S[CL][EUPK]S|SCED|SCUS|SLPM|SLPS|SLUS|SLES|SCPS|PAPX|PCPX|SIPS|SLKA|SCAJ|SLAJ|LSP|ESPM|PBPX)[-_ ]?(\d{3}\.?\d{2}|\d{5})\b", re.IGNORECASE)


def norm_serial(s):
    if not s:
        return ""
    return re.sub(r"[^A-Z0-9]", "", s.upper())


def pretty_serial(s):
    n = norm_serial(s)
    if len(n) >= 9:
        return f"{n[:4]}-{n[4:]}"
    return s or ""


def detect_serial_from_file(filepath):
    """Lê os primeiros 6MB do arquivo procurando pelo SYSTEM.CNF ou serial na imagem."""
    ext = os.path.splitext(filepath)[1].lower()
    if ext in (".bin", ".iso", ".img", ".mdf"):
        try:
            with open(filepath, "rb") as f:
                header = f.read(min(os.path.getsize(filepath), 6 * 1024 * 1024))
            m = BOOT_RE.search(header)
            if m:
                p1 = m.group(1).decode("ascii", "ignore").upper()
                p2 = m.group(2).decode("ascii", "ignore")
                p3 = m.group(3).decode("ascii", "ignore")
                return f"{p1}-{p2}{p3}"
        except Exception:
            pass

    # Tenta serial pelo nome do arquivo
    basename = os.path.basename(filepath)
    m = ID_RE.search(basename)
    if m:
        p1 = m.group(1).upper()
        p2 = re.sub(r"[^0-9]", "", m.group(2))
        return f"{p1}-{p2}"
    return ""


def clean_title(filename):
    name = os.path.splitext(filename)[0]
    if "240ptestsuite" in name.lower():
        return "240p Test Suite"
    name = re.sub(r"\s*[\[(](?:disc|disk|cd)\s*\d+[\])]", "", name, flags=re.IGNORECASE)
    name = re.sub(r"\s*[\[(](?:USA|Europe|Japan|Brazil|En|Fr|De|Es|It|v\d[\d.]*|Rev \w+|SLUS[-_ ]?\d+|SLES[-_ ]?\d+|SCUS[-_ ]?\d+)[^\])]*[\])]", "", name, flags=re.IGNORECASE)
    name = re.sub(r"[_]+", " ", name).strip()
    return name or filename


def find_game_meta(serial, title):
    """Busca informações adicionais no banco gamedb.json do ePSXe."""
    if "240p" in title.lower() or "240ptestsuite" in (serial or "").lower():
        return {
            "title": "240p Test Suite",
            "region": "NTSC-U",
            "genre": "Calibração CRT / Homebrew",
            "publisher": "Artemio Urbina & Filip Aláč",
            "players": "1",
        }

    ns = norm_serial(serial)
    if ns and ns in _GAMEDB:
        return _GAMEDB[ns]

    # Busca por similaridade no título
    t_clean = re.sub(r"[^a-z0-9]", "", title.lower())
    if len(t_clean) >= 4:
        for k, v in _GAMEDB.items():
            vt = re.sub(r"[^a-z0-9]", "", v.get("title", "").lower())
            if vt == t_clean:
                return v
    return None


def scan_games_dir():
    """Varre a pasta 'games/' e agrupa .cue + .bin ou jogos únicos."""
    if not os.path.isdir(GAMES_DIR):
        return []

    files = [f for f in os.listdir(GAMES_DIR) if os.path.isfile(os.path.join(GAMES_DIR, f))]
    cues = [f for f in files if f.lower().endswith(".cue")]
    bins = [f for f in files if f.lower().endswith((".bin", ".img"))]
    singles = [f for f in files if f.lower().endswith((".iso", ".chd", ".pbp", ".zip", ".7z", ".ecm"))]

    groups = []
    used_bins = set()

    # Processa .cue
    for cue in cues:
        base = os.path.splitext(cue)[0].lower()
        cue_path = os.path.join(GAMES_DIR, cue)
        matched_bins = []
        for b in bins:
            if b.lower().startswith(base) or len(bins) == 1:
                matched_bins.append(b)
                used_bins.add(b)

        # Se não achou por nome, tenta ler dentro do .cue
        if not matched_bins:
            try:
                with open(cue_path, "r", encoding="latin1", errors="ignore") as cf:
                    cue_content = cf.read()
                for b in bins:
                    if b in cue_content:
                        matched_bins.append(b)
                        used_bins.add(b)
            except Exception:
                pass

        serial = ""
        for b in matched_bins:
            serial = detect_serial_from_file(os.path.join(GAMES_DIR, b))
            if serial:
                break
        if not serial:
            serial = detect_serial_from_file(cue_path)

        total_size = os.path.getsize(cue_path) + sum(os.path.getsize(os.path.join(GAMES_DIR, b)) for b in matched_bins)
        title = clean_title(cue)
        meta = find_game_meta(serial, title)
        if meta and meta.get("title"):
            title = meta["title"]

        groups.append({
            "id": "server_" + re.sub(r"[^a-zA-Z0-9_]", "_", cue),
            "mainFile": cue,
            "filename": cue,
            "type": "cue",
            "tracks": matched_bins,
            "title": title,
            "serial": serial or (meta.get("id") if meta else ""),
            "prettySerial": pretty_serial(serial or (meta.get("id") if meta else "")),
            "region": meta.get("region") if meta else "Desconhecida",
            "genre": meta.get("genre") if meta else "PlayStation",
            "publisher": meta.get("publisher") if meta else "",
            "languages": meta.get("languages") if meta else "",
            "players": meta.get("players") if meta else "1",
            "size": total_size,
            "size_str": f"{total_size / (1024*1024):.1f} MB",
            "coverUrl": f"/api/cover?serial={urllib.parse.quote(serial or '')}&title={urllib.parse.quote(title)}",
            "fileUrl": f"/api/games/file?name={urllib.parse.quote(cue)}",
            "isServer": True,
        })

    # Bins órfãos
    for b in bins:
        if b not in used_bins:
            p = os.path.join(GAMES_DIR, b)
            serial = detect_serial_from_file(p)
            title = clean_title(b)
            meta = find_game_meta(serial, title)
            if meta and meta.get("title"):
                title = meta["title"]
            sz = os.path.getsize(p)
            groups.append({
                "id": "server_" + re.sub(r"[^a-zA-Z0-9_]", "_", b),
                "mainFile": b,
                "filename": b,
                "type": "bin",
                "tracks": [],
                "title": title,
                "serial": serial or (meta.get("id") if meta else ""),
                "prettySerial": pretty_serial(serial or (meta.get("id") if meta else "")),
                "region": meta.get("region") if meta else "Desconhecida",
                "genre": meta.get("genre") if meta else "PlayStation",
                "publisher": meta.get("publisher") if meta else "",
                "languages": meta.get("languages") if meta else "",
                "players": meta.get("players") if meta else "1",
                "size": sz,
                "size_str": f"{sz / (1024*1024):.1f} MB",
                "coverUrl": f"/api/cover?serial={urllib.parse.quote(serial or '')}&title={urllib.parse.quote(title)}",
                "fileUrl": f"/api/games/file?name={urllib.parse.quote(b)}",
                "isServer": True,
            })

    # Formatos únicos (ISO, CHD, PBP, ZIP)
    for s in singles:
        p = os.path.join(GAMES_DIR, s)
        serial = detect_serial_from_file(p)
        title = clean_title(s)
        meta = find_game_meta(serial, title)
        if meta and meta.get("title"):
            title = meta["title"]
        sz = os.path.getsize(p)
        groups.append({
            "id": "server_" + re.sub(r"[^a-zA-Z0-9_]", "_", s),
            "mainFile": s,
            "filename": s,
            "type": "single",
            "tracks": [],
            "title": title,
            "serial": serial or (meta.get("id") if meta else ""),
            "prettySerial": pretty_serial(serial or (meta.get("id") if meta else "")),
            "region": meta.get("region") if meta else "Desconhecida",
            "genre": meta.get("genre") if meta else "PlayStation",
            "publisher": meta.get("publisher") if meta else "",
            "languages": meta.get("languages") if meta else "",
            "players": meta.get("players") if meta else "1",
            "size": sz,
            "size_str": f"{sz / (1024*1024):.1f} MB",
            "coverUrl": f"/api/cover?serial={urllib.parse.quote(serial or '')}&title={urllib.parse.quote(title)}",
            "fileUrl": f"/api/games/file?name={urllib.parse.quote(s)}",
            "isServer": True,
        })

    return groups


def fetch_cover_bytes(serial, title):
    """Tenta obter a capa na pasta local ou baixa da web (xlenore/psx-covers / libretro)."""
    p_serial = pretty_serial(serial)
    clean_t = clean_title(title)

    # 1. Checa pasta local covers/
    candidates = [
        f"{p_serial}.jpg", f"{p_serial}.png",
        f"{norm_serial(serial)}.jpg", f"{norm_serial(serial)}.png",
        f"{clean_t}.jpg", f"{clean_t}.png",
        f"{title}.jpg", f"{title}.png"
    ]
    for c in candidates:
        if c:
            lp = os.path.join(COVERS_DIR, c)
            if os.path.isfile(lp) and os.path.getsize(lp) > 500:
                with open(lp, "rb") as f:
                    return f.read(), "image/png" if lp.endswith(".png") else "image/jpeg"

    # 2. Tenta baixar da web se serial existe
    web_urls = []
    if p_serial:
        web_urls.append((f"https://raw.githubusercontent.com/xlenore/psx-covers/main/covers/default/{p_serial}.jpg", "image/jpeg"))
        web_urls.append((f"https://raw.githubusercontent.com/xlenore/psx-covers/main/covers/3d/{p_serial}.png", "image/png"))
    if clean_t:
        q_title = urllib.parse.quote(f"{clean_t} (USA).png")
        web_urls.append((f"https://raw.githubusercontent.com/libretro-thumbnails/Sony_-_PlayStation/master/Named_Boxarts/{q_title}", "image/png"))
        q_title2 = urllib.parse.quote(f"{clean_t}.png")
        web_urls.append((f"https://raw.githubusercontent.com/libretro-thumbnails/Sony_-_PlayStation/master/Named_Boxarts/{q_title2}", "image/png"))

    for u, mime in web_urls:
        try:
            req = urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0 ePSXe-Web/2.0"})
            with urllib.request.urlopen(req, timeout=4) as resp:
                if resp.status == 200:
                    data = resp.read()
                    if len(data) > 1000:
                        # Salva em cache local
                        ext = ".png" if "png" in mime else ".jpg"
                        cache_name = p_serial if p_serial else re.sub(r"[^a-zA-Z0-9_-]", "_", clean_t)
                        save_path = os.path.join(COVERS_DIR, f"{cache_name}{ext}")
                        try:
                            with open(save_path, "wb") as f:
                                f.write(data)
                        except Exception:
                            pass
                        return data, mime
        except Exception:
            continue

    # 3. Fallback: imagem padrão se existir
    def_path = os.path.join(COVERS_DIR, "default.jpg")
    if os.path.isfile(def_path):
        with open(def_path, "rb") as f:
            return f.read(), "image/jpeg"

    return None, None


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".wasm": "application/wasm",
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".json": "application/json",
        ".data": "application/octet-stream",
        ".cue": "text/plain",
        ".bin": "application/octet-stream",
        ".iso": "application/octet-stream",
        ".img": "application/octet-stream",
        ".chd": "application/octet-stream",
        ".pbp": "application/octet-stream",
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=STATIC_DIR, **kwargs)

    def end_headers(self):
        # Cabeçalhos essenciais para suporte a Threads e WebAssembly multi-core
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        self.send_header("Cross-Origin-Resource-Policy", "cross-origin")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Range, Content-Type, Authorization")
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_HEAD(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        qs = urllib.parse.parse_qs(parsed.query)

        target_file = None
        if path == "/api/games/file":
            target_file = qs.get("name", [""])[0]
        elif path.startswith("/api/games/") and not any(path.startswith(x) for x in ("/api/games/upload", "/api/games/delete", "/api/games/open_folder")):
            target_file = path[len("/api/games/"):]
        elif path.startswith("/games/"):
            target_file = path[len("/games/"):]

        if target_file:
            clean_name = os.path.basename(urllib.parse.unquote(target_file))
            filepath = os.path.join(GAMES_DIR, clean_name)
            if os.path.isfile(filepath):
                file_size = os.path.getsize(filepath)
                mime_type, _ = mimetypes.guess_type(filepath)
                if not mime_type:
                    mime_type = "application/octet-stream"
                self.send_response(200)
                self.send_header("Content-Type", mime_type)
                self.send_header("Content-Length", str(file_size))
                self.send_header("Accept-Ranges", "bytes")
                self.end_headers()
                return
            else:
                self.send_error(404, "Arquivo não encontrado")
                return

        super().do_HEAD()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        qs = urllib.parse.parse_qs(parsed.query)

        # 1. API: Listar jogos locais da pasta games/
        if path == "/api/games":
            games = scan_games_dir()
            self.send_json({"games": games, "count": len(games), "gamesDir": GAMES_DIR})
            return

        # 2. API: Servir arquivo de jogo com suporte a Range requests (tanto por query quanto por caminho direto)
        target_game_file = None
        if path == "/api/games/file":
            target_game_file = qs.get("name", [""])[0]
        elif path.startswith("/api/games/") and not any(path.startswith(x) for x in ("/api/games/upload", "/api/games/delete", "/api/games/open_folder")):
            target_game_file = path[len("/api/games/"):]
        elif path.startswith("/games/"):
            target_game_file = path[len("/games/"):]

        if target_game_file:
            clean_name = os.path.basename(urllib.parse.unquote(target_game_file))
            filepath = os.path.join(GAMES_DIR, clean_name)
            if not os.path.isfile(filepath):
                self.send_error(404, f"Arquivo de jogo não encontrado: {clean_name}")
                return
            self.serve_file_with_range(filepath)
            return

        # 3. API: Obter capa do jogo
        if path == "/api/cover":
            serial = qs.get("serial", [""])[0]
            title = qs.get("title", [""])[0]
            cover_data, mime = fetch_cover_bytes(serial, title)
            if cover_data:
                self.send_response(200)
                self.send_header("Content-Type", mime)
                self.send_header("Content-Length", str(len(cover_data)))
                self.send_header("Cache-Control", "public, max-age=604800")
                self.end_headers()
                self.wfile.write(cover_data)
            else:
                self.send_error(404, "Capa não encontrada")
            return

        # 4. API: Abrir pasta de jogos no Windows Explorer
        if path == "/api/games/open_folder":
            try:
                subprocess.Popen(f'explorer.exe "{GAMES_DIR}"')
                self.send_json({"success": True, "path": GAMES_DIR})
            except Exception as e:
                self.send_json({"success": False, "error": str(e)}, status=500)
            return

        # 5. API: Status do servidor
        if path == "/api/status":
            self.send_json({
                "status": "online",
                "version": "ePSXe Web 2.0 Enhanced",
                "gamesDir": GAMES_DIR,
                "coversDir": COVERS_DIR,
                "gamesCount": len(scan_games_dir()),
            })
            return

        # Arquivos estáticos normais
        super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        qs = urllib.parse.parse_qs(parsed.query)

        # 1. API: Upload de jogo para a pasta games/
        if path == "/api/games/upload":
            raw_filename = qs.get("filename", [""])[0]
            if not raw_filename:
                # Tenta pegar do Content-Disposition
                cd = self.headers.get("Content-Disposition", "")
                m = re.search(r'filename="?([^"]+)"?', cd)
                raw_filename = m.group(1) if m else f"jogo_{int(time.time())}.bin"

            filename = os.path.basename(raw_filename)
            filepath = os.path.join(GAMES_DIR, filename)

            content_length = int(self.headers.get("Content-Length", 0))
            if content_length <= 0:
                self.send_json({"error": "Content-Length inválido ou nulo"}, status=400)
                return

            print(f"[Upload] Recebendo '{filename}' ({content_length / (1024*1024):.1f} MB)...")
            try:
                bytes_left = content_length
                chunk_size = 1024 * 1024  # 1MB chunks
                with open(filepath, "wb") as out_f:
                    while bytes_left > 0:
                        to_read = min(bytes_left, chunk_size)
                        chunk = self.rfile.read(to_read)
                        if not chunk:
                            break
                        out_f.write(chunk)
                        bytes_left -= len(chunk)

                print(f"[Upload] Jogo salvo com sucesso: '{filename}'")

                # Detecta serial e dispara busca de capa automática
                serial = detect_serial_from_file(filepath)
                title = clean_title(filename)
                meta = find_game_meta(serial, title)
                if meta and meta.get("title"):
                    title = meta["title"]
                
                # Baixa capa antecipadamente se possível
                fetch_cover_bytes(serial, title)

                self.send_json({
                    "success": True,
                    "filename": filename,
                    "serial": serial,
                    "title": title,
                    "size": os.path.getsize(filepath),
                })
            except Exception as e:
                print(f"[Erro no Upload] {e}")
                self.send_json({"error": str(e)}, status=500)
            return

        # 2. API: Upload de capa personalizada
        if path == "/api/cover/upload":
            serial = qs.get("serial", [""])[0]
            title = qs.get("title", [""])[0]
            content_length = int(self.headers.get("Content-Length", 0))
            if content_length <= 0:
                self.send_json({"error": "Arquivo vazio"}, status=400)
                return

            ext = ".png" if "png" in self.headers.get("Content-Type", "") else ".jpg"
            name = pretty_serial(serial) if serial else re.sub(r"[^a-zA-Z0-9_-]", "_", clean_title(title))
            target_path = os.path.join(COVERS_DIR, f"{name}{ext}")

            data = self.rfile.read(content_length)
            with open(target_path, "wb") as f:
                f.write(data)

            self.send_json({"success": True, "saved": os.path.basename(target_path)})
            return

        self.send_error(404, "Endpoint não encontrado")

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/games/delete":
            qs = urllib.parse.parse_qs(parsed.query)
            filename = qs.get("name", [""])[0]
            clean_name = os.path.basename(filename)
            filepath = os.path.join(GAMES_DIR, clean_name)
            if os.path.isfile(filepath):
                try:
                    os.remove(filepath)
                    self.send_json({"success": True, "deleted": clean_name})
                    return
                except Exception as e:
                    self.send_json({"success": False, "error": str(e)}, status=500)
                    return
            self.send_error(404, "Arquivo não encontrado")
            return
        self.send_error(404)

    def serve_file_with_range(self, filepath):
        """Serve arquivos com suporte estrito a Range Requests (RFC 7233)."""
        file_size = os.path.getsize(filepath)
        range_header = self.headers.get("Range")
        mime_type, _ = mimetypes.guess_type(filepath)
        if not mime_type:
            mime_type = "application/octet-stream"

        if not range_header:
            self.send_response(200)
            self.send_header("Content-Type", mime_type)
            self.send_header("Content-Length", str(file_size))
            self.send_header("Accept-Ranges", "bytes")
            self.end_headers()
            with open(filepath, "rb") as f:
                while True:
                    chunk = f.read(256 * 1024)
                    if not chunk:
                        break
                    try:
                        self.wfile.write(chunk)
                    except (BrokenPipeError, ConnectionResetError):
                        break
            return

        # Parsing de Range: bytes=start-end
        range_match = re.match(r"bytes=(\d*)-(\d*)", range_header)
        if not range_match:
            self.send_error(416, "Requested Range Not Satisfiable")
            return

        start_str, end_str = range_match.groups()
        start = int(start_str) if start_str else 0
        end = int(end_str) if end_str else file_size - 1

        if start >= file_size or end >= file_size or start > end:
            self.send_response(416)
            self.send_header("Content-Range", f"bytes */{file_size}")
            self.end_headers()
            return

        content_length = end - start + 1
        self.send_response(206)
        self.send_header("Content-Type", mime_type)
        self.send_header("Content-Range", f"bytes {start}-{end}/{file_size}")
        self.send_header("Content-Length", str(content_length))
        self.send_header("Accept-Ranges", "bytes")
        self.end_headers()

        with open(filepath, "rb") as f:
            f.seek(start)
            bytes_to_send = content_length
            while bytes_to_send > 0:
                chunk_len = min(bytes_to_send, 256 * 1024)
                chunk = f.read(chunk_len)
                if not chunk:
                    break
                try:
                    self.wfile.write(chunk)
                except (BrokenPipeError, ConnectionResetError):
                    break
                bytes_to_send -= len(chunk)

    def log_message(self, fmt, *args):
        # Apenas loga requisições de API relevantes
        first_arg = args[0] if args else ""
        if "/api/" in str(first_arg):
            sys.stderr.write(f"[API] {fmt % args}\n")


class ThreadedServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


if __name__ == "__main__":
    with ThreadedServer(("127.0.0.1", PORT), Handler) as srv:
        url = f"http://127.0.0.1:{PORT}/"
        print("=" * 60)
        print("       ePSXe Web — Servidor Aprimorado com Banco & Capas")
        print("=" * 60)
        print(f"Rodando em: {url}")
        print(f"Pasta de Jogos:  {GAMES_DIR}")
        print(f"Pasta de Capas:  {COVERS_DIR}")
        print(f"Jogos no disco:  {len(scan_games_dir())}")
        print("-" * 60)

        if "--no-browser" not in sys.argv:
            try:
                webbrowser.open(url)
            except Exception:
                pass

        try:
            srv.serve_forever()
        except KeyboardInterrupt:
            print("\nServidor encerrado.")
