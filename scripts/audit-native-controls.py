#!/usr/bin/env python3
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path('apps/miniprogram/src')
TAG_RE = re.compile(r'<(input|textarea)\b([^>]*)>', re.I | re.S)
CLASS_RE = re.compile(r'\bclass\s*=\s*["\']([^"\']+)["\']', re.I)

rows: list[tuple[str, str, str, int, str]] = []
for path in sorted(ROOT.rglob('*.vue')):
    text = path.read_text(encoding='utf-8')
    for match in TAG_RE.finditer(text):
        tag = match.group(1).lower()
        attrs = match.group(2)
        class_match = CLASS_RE.search(attrs)
        classes = class_match.group(1) if class_match else '(none)'
        line = text.count('\n', 0, match.start()) + 1
        compact = ' '.join(match.group(0).split())
        rows.append((str(path), tag, classes, line, compact))

print(f'Native controls found: {len(rows)}')
for path, tag, classes, line, compact in rows:
    print(f'{path}:{line}\t<{tag}>\tclass={classes}\t{compact}')

# Conservative risk scan: native input selectors with vertical padding but no explicit height/line-height.
print('\nPotential clipping risks:')
risk_count = 0
for path in sorted(ROOT.rglob('*.vue')):
    text = path.read_text(encoding='utf-8')
    classes = set()
    for match in TAG_RE.finditer(text):
        class_match = CLASS_RE.search(match.group(2))
        if class_match:
            classes.update(class_match.group(1).split())
    for class_name in sorted(classes):
        block_match = re.search(rf'\.{re.escape(class_name)}\s*\{{([^}}]*)\}}', text, re.S)
        if not block_match:
            continue
        block = block_match.group(1)
        has_vertical_padding = bool(re.search(r'padding\s*:\s*(?!0(?:\s|;))[^;]+;', block)) or 'padding-top:' in block or 'padding-bottom:' in block
        has_height = 'height:' in block or 'min-height:' in block
        has_line_height = 'line-height:' in block
        if has_vertical_padding and not (has_height and has_line_height):
            risk_count += 1
            print(f'{path}\t.{class_name}\tvertical padding without explicit height+line-height')
print(f'Potential risk count: {risk_count}')
