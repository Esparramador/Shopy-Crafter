---
name: Master Prompt Library
description: How to read, update, and inject into master-prompt-library.json safely
---

## Current State (June 2026)
- File: artifacts/api-server/src/lib/master-prompt-library.json
- Size: ~6.3MB (after minification) / ~8.5MB (pretty-printed)
- Templates: 6,677 across 38 libraries
- Version: v4.0.0

## Libraries (38 total)
Old (32): stitch_bulk_v2/v3/effects/design_system, typegpu_*, visme_templates, 3d_mining (3414!), 21st_dev_*, desktop_commander, external_ui_libs, neuform_design_systems, design_catalog, effects_catalog, card/ad/cinematic templates, tripo3d_animations, claude_code_agents, shadcn_components, cult_ui_effects, anthropic_skills, web_security_workflows

New (6 added June 2026):
- trail_of_bits_security: 27 (CC-BY-SA-4.0, real GitHub content)
- claude_code_agents_ecc: 64 (MIT, affaan-m/everything-claude-code)
- dev_workflow_skills: 19 (MIT, real skill content)
- animate_css_library: 97 (animate-css/animate.css real effects)
- hover_css_library: 80 (IanLunn/Hover real effects)
- awesome_claude_code: 30 (curated resources list)

## How to inject new library (Python)
```python
import json, os

lib_path = 'artifacts/api-server/src/lib/master-prompt-library.json'
file_size = os.path.getsize(lib_path)
inject_offset = file_size - 8  # before "\n    }\n}" (8 bytes)

# Build new library block as string
new_block = ',\n        "my_lib": { "name": "...", "templates": [...] }'

with open(lib_path, 'rb') as f:
    original = f.read(inject_offset)
closing = b'\n    }\n}'
with open(lib_path, 'wb') as f:
    f.write(original)
    f.write(new_block.encode('utf-8'))
    f.write(closing)
```

## _meta auto-rebuild
getMasterLib() in fs-pro.ts now rebuilds _meta.libraries dynamically from the `libraries` dict — no need to manually update _meta when adding libraries.

**Why:** File is 6MB+ — never read fully in code. Always use Python + tail-inject. The _meta rebuild means new libraries are auto-discovered.

## NEVER
- Never read the whole file in Python/JS (111k+ lines, 7MB+ pretty-printed)
- Never write it with json.dump on every edit (too slow, uses tons of memory)
