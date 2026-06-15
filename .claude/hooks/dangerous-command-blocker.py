#!/usr/bin/env python3
"""
dangerous-command-blocker.py  —  Claude Code PreToolUse hook (matcher: Bash)
Bloquea comandos destructivos irreversibles antes de ejecutarse.
exit 2 = bloqueado (motivo va a stderr y se le pasa al modelo). exit 0 = permitido.
"""
import sys
import json
import re

# Patrón -> explicación. Cada uno se prueba contra el comando completo.
DANGEROUS = [
    (re.compile(r"\brm\s+(-[a-zA-Z]*r[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*r)\s+(/|~|\$HOME|\.\s*$|\*)"),
     "rm -rf sobre raíz / home / todo"),
    (re.compile(r"\bRemove-Item\b.*-Recurse.*-Force.*(?:C:\\|/|\$HOME|~)"),
     "Remove-Item -Recurse -Force sobre raíz"),
    (re.compile(r"\bgit\s+push\s+.*--force(?:-with-lease)?\b.*\b(main|master|production)\b"),
     "git push --force a main/master/production"),
    (re.compile(r"\bgit\s+reset\s+--hard\b.*\borigin/(main|master|production)\b"),
     "git reset --hard contra rama protegida remota"),
    (re.compile(r"(?i)\bDROP\s+(DATABASE|SCHEMA|TABLE)\b"),
     "DROP DATABASE/SCHEMA/TABLE en SQL"),
    (re.compile(r"(?i)\bTRUNCATE\s+TABLE\b"),
     "TRUNCATE TABLE"),
    (re.compile(r"(?i)\bDELETE\s+FROM\s+\w+\s*;?\s*$"),
     "DELETE FROM sin cláusula WHERE"),
    (re.compile(r"\bmkfs\.\w+\b"),
     "formateo de sistema de ficheros (mkfs)"),
    (re.compile(r"\bdd\s+.*\bof=/dev/(sd|nvme|disk)"),
     "dd escribiendo sobre un disco físico"),
    (re.compile(r":\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:"),
     "fork bomb"),
    (re.compile(r"\bchmod\s+-R\s+0?777\s+(/|~|\$HOME)"),
     "chmod -R 777 sobre raíz / home"),
    (re.compile(r"(?i)\b(curl|wget|iwr|invoke-webrequest)\b.*\|\s*(sh|bash|python|powershell|pwsh)\b"),
     "descargar y ejecutar script remoto sin revisar (pipe a shell)"),
    (re.compile(r">\s*/dev/sd[a-z]"),
     "redirección a un dispositivo de bloque"),
]


def main():
    try:
        payload = json.load(sys.stdin)
    except Exception:
        sys.exit(0)

    ti = payload.get("tool_input", {}) or {}
    cmd = ti.get("command", "") or ""
    if not cmd:
        sys.exit(0)

    for rx, why in DANGEROUS:
        if rx.search(cmd):
            print(
                f"🛑 COMMAND-BLOCKER: comando BLOQUEADO — {why}.\n"
                f"Comando: {cmd[:200]}\n"
                "Si es intencionado, ejecútalo manualmente fuera de Claude o reformúlalo de forma acotada.",
                file=sys.stderr,
            )
            sys.exit(2)

    sys.exit(0)


if __name__ == "__main__":
    main()
