#!/usr/bin/env python3
"""
env-file-protection.py  —  Claude Code PreToolUse hook (matcher: Bash)
Impide la EXFILTRACIÓN del contenido de ficheros .env (cat/type/curl/scp/nc...).
Leer .env con la herramienta Read está permitido para depurar localmente; lo que
se bloquea es volcarlo o enviarlo a un destino externo.
exit 2 = bloqueado. exit 0 = permitido.
"""
import sys
import json
import re

# Comando que toca un .env Y a la vez lo imprime/envía/copia fuera
_EXFIL = re.compile(
    r"(?i)\b(cat|type|more|less|head|tail|curl|wget|scp|nc|netcat|rsync|"
    r"invoke-webrequest|iwr|get-content)\b[^\n|]*\.env\b"
)
# Pipe del contenido de .env a una petición de red
_PIPE_NET = re.compile(r"(?i)\.env\b[^\n]*\|\s*(curl|wget|nc|netcat|scp)\b")


def main():
    try:
        payload = json.load(sys.stdin)
    except Exception:
        sys.exit(0)

    ti = payload.get("tool_input", {}) or {}
    cmd = ti.get("command", "") or ""
    if not cmd:
        sys.exit(0)

    if _EXFIL.search(cmd) or _PIPE_NET.search(cmd):
        print(
            "🛑 ENV-PROTECTION: bloqueado el volcado/envío de un fichero .env.\n"
            f"Comando: {cmd[:200]}\n"
            "Los .env contienen claves reales. No los imprimas ni los envíes a destinos externos.",
            file=sys.stderr,
        )
        sys.exit(2)

    sys.exit(0)


if __name__ == "__main__":
    main()
