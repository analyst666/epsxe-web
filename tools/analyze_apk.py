"""Analise estatica do ePSXe APK: manifest, preferencias, JNI, banco de jogos e gamepads."""
import json
import pathlib
import re
import subprocess
import zipfile

from androguard.core.apk import APK

ROOT = pathlib.Path(__file__).resolve().parent.parent
APK_FILE = ROOT / "analysis" / "epsxe.zip"
OUT = ROOT / "analysis" / "report"
OUT.mkdir(parents=True, exist_ok=True)

apk = APK(str(APK_FILE))
report = {
    "package": apk.get_package(),
    "version": apk.get_androidversion_name(),
    "min_sdk": apk.get_min_sdk_version(),
    "target_sdk": apk.get_target_sdk_version(),
    "permissions": sorted(apk.get_permissions()),
    "activities": apk.get_activities(),
    "services": apk.get_services(),
    "native_libs": [f for f in apk.get_files() if f.startswith("lib/arm64-v8a/")],
}

# Preferencias (res/xml/preferences.xml e preferences_tv.xml)
prefs = {}
for name in ("res/xml/preferences.xml", "res/xml/preferences_tv.xml"):
    try:
        xml = apk.get_android_resources()
        data = apk.get_file(name)
        from androguard.core.axml import AXMLPrinter
        text = AXMLPrinter(data).get_xml().decode("utf8", "ignore")
        (OUT / (pathlib.Path(name).stem + ".xml")).write_text(text, encoding="utf8")
        prefs[name] = re.findall(r'android:key="([^"]+)"', text)
    except Exception as e:  # noqa: BLE001
        prefs[name] = f"erro: {e}"
report["preference_keys"] = prefs

# Strings nativas legiveis do core (libepsxe.so arm64): opcoes, formatos, cheats
so = zipfile.ZipFile(APK_FILE).read("lib/arm64-v8a/libepsxe.so")
strs = sorted(set(m.decode() for m in re.findall(rb"[ -~]{6,}", so)))
(OUT / "libepsxe_strings.txt").write_text("\n".join(strs), encoding="utf8")
report["jni_exports"] = [s for s in strs if s.startswith("Java_")]
report["native_string_count"] = len(strs)

# Banco de jogos ginfo -> JSON (id;titulo;;jogadores;;;regiao;genero;publisher;idiomas;;;nota)
games = {}
raw = zipfile.ZipFile(APK_FILE).read("res/raw/ginfo").decode("utf8", "ignore")
for line in raw.splitlines():
    f = line.split(";")
    if len(f) < 10 or not f[0]:
        continue
    games[f[0].replace("-", "").replace("_", "").replace(".", "").upper()] = {
        "id": f[0], "title": f[1], "players": f[3], "region": f[6],
        "genre": f[7], "publisher": f[8], "languages": f[9],
    }
(OUT / "gamedb.json").write_text(json.dumps(games, ensure_ascii=False), encoding="utf8")
report["game_db_entries"] = len(games)

(OUT / "report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf8")
print(json.dumps({k: (v if not isinstance(v, (list, dict)) else f"[{len(v)}]") for k, v in report.items()}, indent=2))
