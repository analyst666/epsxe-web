"""Baixa o runtime EmulatorJS (libretro/WASM) para rodar 100% offline.

Cores PS1 usados:
  - pcsx_rearmed  (rapido, compativel, renderer software/NEON-like)
  - mednafen_psx_hw (preciso, renderer OpenGL com upscale interno)
"""
import concurrent.futures as cf
import pathlib
import urllib.request

BASE = "https://cdn.emulatorjs.org/stable/data/"
OUT = pathlib.Path(__file__).resolve().parent.parent / "static" / "engine"

FILES = [
    "loader.js", "emulator.min.js", "emulator.min.css", "version.json",
    "compression/extract7z.js", "compression/extractzip.js",
    "compression/libunrar.js", "compression/libunrar.wasm",
    "localization/en-US.json", "localization/pt-BR.json",
    "localization/es-ES.json", "localization/retroarch.json",
]
for core in ("pcsx_rearmed", "mednafen_psx_hw"):
    for variant in ("wasm", "legacy-wasm", "thread-wasm", "thread-legacy-wasm"):
        FILES.append(f"cores/{core}-{variant}.data")


def fetch(rel: str) -> str:
    dest = OUT / rel
    if dest.exists() and dest.stat().st_size > 0:
        return f"skip  {rel}"
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(BASE + rel, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            dest.write_bytes(r.read())
        return f"ok    {rel} ({dest.stat().st_size // 1024} KB)"
    except Exception as e:  # noqa: BLE001
        return f"FAIL  {rel}: {e}"


if __name__ == "__main__":
    with cf.ThreadPoolExecutor(6) as ex:
        for line in ex.map(fetch, FILES):
            print(line)
