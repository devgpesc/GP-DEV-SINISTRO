#!/usr/bin/env python3
"""Gera PDF da documentacao tecnica a partir dos arquivos Markdown em docs/."""
from __future__ import annotations

import re
import textwrap
from pathlib import Path

try:
    from fpdf import FPDF
except ImportError:
    raise SystemExit("Instale: pip install fpdf2")

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
OUTPUT = DOCS / "DOCUMENTACAO-TECNICA-COMPLETA-EVENTSCAR.pdf"

FILES = [
    ("PROMPT SISTEMA COMPLETO (Cursor IDE)", "PROMPT-SISTEMA-COMPLETO-CURSOR.md"),
    ("API REST — Integracao", "API-INTEGRACAO.md"),
    ("Seguranca, Login e Permissoes", "SEGURANCA-E-PERMISSOES.md"),
    ("Anexos de Video (modulo)", "PROMPT-ANEXOS-VIDEO-CURSOR.md"),
]


def strip_md(text: str) -> str:
    text = re.sub(r"```[\s\S]*?```", lambda m: "\n" + m.group(0).replace("```", "") + "\n", text)
    text = re.sub(r"`([^`]+)`", r"\1", text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)
    text = re.sub(r"\*([^*]+)\*", r"\1", text)
    text = re.sub(r"^#+\s*", "", text, flags=re.M)
    text = re.sub(r"^\|", "  ", text, flags=re.M)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    return text


def sanitize(text: str) -> str:
    replacements = {
        "\u2014": "-", "\u2013": "-", "\u2192": "->", "\u2022": "*",
        "\u201c": '"', "\u201d": '"', "\u2018": "'", "\u2019": "'",
        "\u2026": "...", "\u2713": "[x]", "\u2717": "[ ]",
    }
    for k, v in replacements.items():
        text = text.replace(k, v)
    return text.encode("ascii", errors="replace").decode("ascii")


class DocPDF(FPDF):
    def header(self):
        self.set_font("Helvetica", "B", 9)
        self.set_text_color(100, 100, 100)
        self.cell(0, 8, sanitize("EventsCar - Documentacao Tecnica Completa"), align="R", new_x="LMARGIN", new_y="NEXT")
        self.ln(2)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(120, 120, 120)
        self.cell(0, 10, f"Pagina {self.page_no()}", align="C")


def main():
    pdf = DocPDF()
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 20)
    pdf.set_text_color(30, 64, 175)
    pdf.multi_cell(0, 12, sanitize("EventsCar / GP-DEV-SINISTRO\nDocumentacao Tecnica Completa"))
    pdf.ln(4)
    pdf.set_font("Helvetica", "", 11)
    pdf.set_text_color(50, 50, 50)
    pdf.multi_cell(
        0,
        6,
        "Gerado automaticamente a partir dos arquivos em docs/.\n"
        "Producao: https://eventos.escsistemas.com\n"
        "Repositorio: devgpesc/GP-DEV-SINISTRO",
    )
    pdf.ln(8)

    for title, filename in FILES:
        path = DOCS / filename
        if not path.exists():
            continue
        raw = path.read_text(encoding="utf-8")
        plain = sanitize(strip_md(raw))

        pdf.add_page()
        pdf.set_font("Helvetica", "B", 16)
        pdf.set_text_color(30, 64, 175)
        pdf.multi_cell(0, 10, sanitize(title))
        pdf.ln(3)
        pdf.set_font("Courier", "", 8)
        pdf.set_text_color(30, 30, 30)

        for line in plain.splitlines():
            line = line.rstrip()
            if not line:
                pdf.ln(3)
                continue
            if line.startswith("---") or line.strip().startswith("flowchart") or line.strip().startswith("subgraph"):
                continue
            wrapped = textwrap.wrap(line, width=90) or [""]
            for part in wrapped:
                if not part.strip():
                    continue
                pdf.set_x(pdf.l_margin)
                try:
                    pdf.multi_cell(pdf.epw, 4.5, sanitize(part))
                except Exception:
                    pass

    pdf.output(str(OUTPUT))
    print(f"PDF gerado: {OUTPUT}")


if __name__ == "__main__":
    main()
