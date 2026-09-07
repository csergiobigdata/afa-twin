"""
Leitura de um documento .pdf de "Configurações Autorizadas" (ex.: docs/
CONFIGURAÇÕES AUTORIZADAS.pdf - uma Ordem Técnica/OTFN da aeronave) para
atualizar em lote o status_disp do cadastro de Configurações Autorizadas.

Validação de autenticidade: o texto do documento precisa conter a sigla
"OTFN" (idealmente um código completo como "OTFN 1A-29 A/B-1") - sem essa
marca, o documento é rejeitado como inválido/não autorizado para a carga.

Extração: localiza a página cujo texto contém o título "CONFIGURAÇÕES
AUTORIZADAS" junto com o cabeçalho da tabela de símbolos ("SÍMBOLOS") - a
página de legenda dos ícones, distinta de outras páginas do mesmo manual
que repetem o mesmo título de seção mas trazem tabelas de uso por estação
de cada configuração numerada, não a legenda. NÃO faz reconhecimento de
imagem/OCR: usa a camada de texto real já embutida no PDF (via pypdf) e
localiza cada item do cadastro atual por correspondência de texto,
normalizando variações de hífen/travessão e espaçamento comuns em PDFs
gerados por CAD - mais confiável que reconhecer texto em pixels, já que o
texto do documento já vem pronto no próprio arquivo. Itens do cadastro
encontrados no texto dessa página viram "A" (Ativo); os demais, "I"
(Inativo) - mesma convenção da carga anterior por imagem.
"""
from __future__ import annotations

import io
import logging
import re

from pypdf import PdfReader

# Avisos de fonte (CFF/fontTools ausente) que o pypdf emite via logging ao
# extrair texto de PDFs gerados por CAD/DGN como o de referência - não
# afetam a extração de texto em si, só a métrica exata de largura de glifo.
logging.getLogger("pypdf").setLevel(logging.ERROR)

_OTFN_PATTERN = re.compile(r"OTFN", re.IGNORECASE)
_TITLE_PATTERN = re.compile(r"CONFIGURA[ÇC][ÕO]ES\s+AUTORIZADAS", re.IGNORECASE)
_LEGEND_MARK_PATTERN = re.compile(r"S[ÍI]MBOLOS", re.IGNORECASE)
_HYPHEN_VARIANTS = re.compile(r"[‐‑‒–—−]")


class ConfigPdfError(ValueError):
    """PDF inválido, não autorizado, ou sem a página de legenda esperada -
    vira HTTP 400 no router."""


def _normalize(text: str) -> str:
    text = text.upper()
    text = _HYPHEN_VARIANTS.sub("-", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _base_name(equipment: str) -> str:
    """Remove um qualificador final entre parênteses acrescentado só no
    nosso cadastro (ex.: "PILONES EXTERNOS (E)" -> "PILONES EXTERNOS"),
    ausente no texto original do manual."""
    return re.sub(r"\s*\([^)]*\)\s*$", "", equipment).strip()


def extract_marks(pdf_bytes: bytes, catalog_equipment: list[str]) -> tuple[list[bool], str]:
    """Retorna (uma marca Ativo/Inativo por item de `catalog_equipment`, na
    mesma ordem da lista recebida; nota de transparência sobre a página
    usada). Levanta ConfigPdfError se o documento não for um PDF legível,
    não contiver "OTFN", ou não tiver a página de legenda esperada."""
    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))
        if reader.is_encrypted:
            try:
                reader.decrypt("")
            except Exception:
                pass
        page_texts = [page.extract_text() or "" for page in reader.pages]
    except Exception as exc:
        raise ConfigPdfError("Não foi possível ler o arquivo como PDF.") from exc

    full_text = "\n".join(page_texts)
    if not _OTFN_PATTERN.search(full_text):
        raise ConfigPdfError(
            "Documento inválido / não autorizado para carga de atualização "
            '(não foi encontrado o código "OTFN" no conteúdo do PDF).'
        )

    legend_page_text = None
    legend_page_number = None
    for i, text in enumerate(page_texts):
        if _TITLE_PATTERN.search(text) and _LEGEND_MARK_PATTERN.search(text):
            legend_page_text = text
            legend_page_number = i + 1
            break

    if legend_page_text is None:
        raise ConfigPdfError(
            'Documento inválido / não autorizado para carga de atualização (não foi encontrada, no PDF, '
            'uma página com o título "Configurações Autorizadas" contendo a tabela de símbolos).'
        )

    page_norm = _normalize(legend_page_text)
    marks = [_normalize(_base_name(name)) in page_norm for name in catalog_equipment]

    note = (
        f'Documento validado (contém "OTFN"). Tabela de símbolos localizada na página {legend_page_number} '
        f'("Configurações Autorizadas"). {sum(marks)} de {len(marks)} item(ns) do cadastro encontrados no '
        "texto dessa página."
    )
    return marks, note
