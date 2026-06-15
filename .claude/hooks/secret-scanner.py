#!/usr/bin/env python3
"""
secret-scanner.py  —  Claude Code PreToolUse hook
Bloquea la escritura de SECRETS hardcodeados en el código fuente.
Cubre 30+ proveedores (Anthropic, OpenAI, AWS, Stripe, Google, GitHub, etc.).

Protocolo Claude Code:
  - Lee el payload JSON del hook por stdin.
  - Inspecciona el contenido que se va a escribir (Write/Edit/MultiEdit).
  - Si detecta un secret -> escribe el motivo en stderr y sale con exit code 2
    (Claude Code bloquea la herramienta y le pasa el mensaje al modelo).
  - Si no detecta nada -> exit 0 (la herramienta continúa).

NUNCA bloquea ficheros .env / .env.* (ahí los secrets son legítimos).
Reutilizable por _agency_os_engine.py vía la función scan_text().
"""
import sys
import os
import re
import json

# ─────────────────────────────────────────────────────────────────────────────
# Patrones de secrets por proveedor (clave = etiqueta legible)
# ─────────────────────────────────────────────────────────────────────────────
SECRET_PATTERNS = {
    "Anthropic API key":      re.compile(r"sk-ant-[a-zA-Z0-9_\-]{20,}"),
    "OpenAI API key":         re.compile(r"sk-(?:proj-)?[a-zA-Z0-9]{20,}"),
    "AWS access key id":      re.compile(r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b"),
    "AWS secret access key":  re.compile(r"(?i)aws.{0,20}secret.{0,20}['\"][0-9a-zA-Z/+]{40}['\"]"),
    "Stripe secret key":      re.compile(r"\b(?:sk|rk)_live_[0-9a-zA-Z]{20,}\b"),
    "Google API key":         re.compile(r"\bAIza[0-9A-Za-z_\-]{35}\b"),
    "GitHub token":           re.compile(r"\b(?:ghp|gho|ghu|ghs|ghr)_[0-9a-zA-Z]{36}\b"),
    "GitHub fine-grained PAT": re.compile(r"\bgithub_pat_[0-9a-zA-Z_]{82}\b"),
    "GitLab PAT":             re.compile(r"\bglpat-[0-9a-zA-Z_\-]{20}\b"),
    "Slack token":            re.compile(r"\bxox[baprs]-[0-9a-zA-Z\-]{10,}\b"),
    "SendGrid API key":       re.compile(r"\bSG\.[\w\-]{22}\.[\w\-]{43}\b"),
    "Twilio API/SID key":     re.compile(r"\b(?:SK|AC)[0-9a-fA-F]{32}\b"),
    "Hugging Face token":     re.compile(r"\bhf_[a-zA-Z0-9]{34}\b"),
    "Replicate token":        re.compile(r"\br8_[a-zA-Z0-9]{37}\b"),
    "Groq API key":           re.compile(r"\bgsk_[a-zA-Z0-9]{50,}\b"),
    "Databricks token":       re.compile(r"\bdapi[a-h0-9]{32}\b"),
    "DigitalOcean token":     re.compile(r"\bdop_v1_[a-f0-9]{64}\b"),
    "npm token":              re.compile(r"\bnpm_[A-Za-z0-9]{36}\b"),
    "PyPI token":             re.compile(r"\bpypi-AgEIcHlwaS[A-Za-z0-9_\-]{50,}\b"),
    "Tavily API key":         re.compile(r"\btvly-[a-zA-Z0-9]{32}\b"),
    "Private key block":      re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----"),
    "JWT token":              re.compile(r"\beyJ[A-Za-z0-9_\-]{10,}\.eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\b"),
    "DB URL with password":   re.compile(r"\b(?:postgres|postgresql|mysql|mongodb)(?:\+\w+)?://[^\s:@/]+:[^\s@/]+@"),
    "Hardcoded password":     re.compile(r"(?i)(?:password|passwd|pwd|secret|token|api[_\-]?key)\s*[:=]\s*['\"][^'\"\s]{8,}['\"]"),
}

# Placeholders típicos que NO son secrets reales -> se ignoran
_PLACEHOLDER = re.compile(
    r"(?i)(your[_\-]?|example|placeholder|xxxx|dummy|test[_\-]?key|sk-ant-xxx|"
    r"changeme|<[^>]+>|\$\{[^}]+\}|os\.environ|getenv|process\.env)"
)


def _is_env_file(path: str) -> bool:
    base = os.path.basename(path or "").lower()
    return base == ".env" or base.startswith(".env.") or base.endswith(".env")


def scan_text(text: str) -> list:
    """Devuelve [(proveedor, fragmento), ...] de secrets reales detectados."""
    if not text:
        return []
    findings = []
    for label, rx in SECRET_PATTERNS.items():
        for m in rx.finditer(text):
            frag = m.group(0)
            # Contexto alrededor del match para filtrar placeholders
            start = max(0, m.start() - 30)
            ctx = text[start:m.end() + 10]
            if _PLACEHOLDER.search(ctx):
                continue
            redacted = frag[:6] + "…" + frag[-4:] if len(frag) > 14 else frag[:4] + "…"
            findings.append((label, redacted))
    # Dedup conservando orden
    seen, out = set(), []
    for f in findings:
        if f not in seen:
            seen.add(f)
            out.append(f)
    return out


def _extract_content(tool_input: dict) -> str:
    """Junta todo el texto que se va a escribir según el tipo de herramienta."""
    parts = []
    for key in ("content", "new_string", "new_str"):
        v = tool_input.get(key)
        if isinstance(v, str):
            parts.append(v)
    for edit in tool_input.get("edits", []) or []:
        if isinstance(edit, dict):
            v = edit.get("new_string") or edit.get("new_str")
            if isinstance(v, str):
                parts.append(v)
    return "\n".join(parts)


def main():
    try:
        payload = json.load(sys.stdin)
    except Exception:
        sys.exit(0)  # sin payload válido, no bloqueamos

    tool_input = payload.get("tool_input", {}) or {}
    file_path = tool_input.get("file_path", "") or tool_input.get("path", "")

    # Nunca bloqueamos los .env (ahí los secrets son legítimos y están gitignored)
    if _is_env_file(file_path):
        sys.exit(0)

    content = _extract_content(tool_input)
    findings = scan_text(content)

    if findings:
        lines = "\n".join(f"  • {label}: {frag}" for label, frag in findings)
        msg = (
            "🛑 SECRET-SCANNER: escritura BLOQUEADA — secret hardcodeado detectado en "
            f"{file_path or 'el contenido'}:\n{lines}\n\n"
            "Política del proyecto: NUNCA hardcodear claves. Usa os.environ.get(\"NOMBRE\") "
            "y añade la clave al fichero .env (gitignored)."
        )
        print(msg, file=sys.stderr)
        sys.exit(2)

    sys.exit(0)


if __name__ == "__main__":
    main()
