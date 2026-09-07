"""
Carrega fotos reais de aeronaves a partir dos arquivos de imagem em
`images/` (raiz do repositório) para o cadastro de aeronaves do banco local
- cria um MediaAsset para cada arquivo e associa a `Aircraft.photo_asset_id`
(estática: .png/.jpg/.jpeg) ou `Aircraft.photo_animated_asset_id` (animada:
.gif/.webp) da aeronave correspondente, por casamento de nome/tipo (ver
ALIASES abaixo) - os arquivos foram nomeados livremente (ex.: "Hercules
64.png", "tucano a-29.png"), não pela matrícula exata.

Roda uma vez, manualmente (ao contrário de seed.py, NÃO é chamado no
startup do servidor): fotos são conteúdo real, não dado de demonstração -
uma aeronave cadastrada depois não deve ganhar uma foto "adivinhada"
automaticamente sem revisão humana.

Uso (a partir da raiz do repositório):
    backend\\.venv\\Scripts\\python.exe tools\\load_aircraft_photos.py [--force]

--force substitui uma foto já cadastrada; por padrão, aeronaves que já têm
photo_asset_id/photo_animated_asset_id são preservadas (idempotente - seguro
rodar de novo depois de adicionar arquivos novos em images/).
"""
import argparse
import mimetypes
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
IMAGES_DIR = ROOT / "images"
sys.path.insert(0, str(ROOT / "backend"))

from app import models  # noqa: E402
from app.database import SessionLocal  # noqa: E402

STATIC_EXT = {".png", ".jpg", ".jpeg"}
ANIMATED_EXT = {".gif", ".webp"}

# alias (procurado no nome do arquivo, normalizado) -> trecho que deve
# aparecer no texto normalizado "fabricante + modelo + apelido" da aeronave
# para considerar o arquivo correspondente a ela. Adicione novas linhas
# aqui para reconhecer arquivos de outros modelos/apelidos no futuro.
ALIASES: dict[str, str] = {
    "hercules": "hercules",
    "c130": "c130h",
    "millennium": "millennium",
    "kc390": "kc390",
    "tucano": "supertucano",
    "a29": "a29",
    "gripen": "gripen",
    "f39": "f39e",
    "tigerii": "tigerii",
    "f5em": "f5em",
    "amx": "amx",
    "a1m": "a1m",
    "caracal": "caracal",
    "h36": "h36",
}


def _norm(text: str) -> str:
    """Minúsculas, só letras e dígitos - torna a comparação insensível a
    espaços, hífens, acentos residuais e maiúsculas/minúsculas."""
    return re.sub(r"[^a-z0-9]", "", text.lower())


def _match_aircraft(filename_stem: str, aircraft_list: list["models.Aircraft"]) -> "models.Aircraft | None":
    key = _norm(filename_stem)
    for alias, needle in ALIASES.items():
        if alias in key:
            for a in aircraft_list:
                haystack = _norm(f"{a.manufacturer} {a.model} {a.nickname or ''}")
                if needle in haystack:
                    return a
    return None


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--force", action="store_true", help="Substitui foto já cadastrada em vez de preservá-la")
    args = parser.parse_args()

    if not IMAGES_DIR.is_dir():
        print(f"Diretório não encontrado: {IMAGES_DIR}")
        return

    db = SessionLocal()
    try:
        aircraft_list = db.query(models.Aircraft).all()
        if not aircraft_list:
            print("Nenhuma aeronave cadastrada - nada a fazer.")
            return

        any_file = False
        for path in sorted(IMAGES_DIR.iterdir()):
            if not path.is_file():
                continue
            ext = path.suffix.lower()
            if ext not in STATIC_EXT and ext not in ANIMATED_EXT:
                continue
            any_file = True

            aircraft = _match_aircraft(path.stem, aircraft_list)
            if not aircraft:
                print(f"[ignorado] {path.name}: nenhuma aeronave correspondente encontrada")
                continue

            is_animated = ext in ANIMATED_EXT
            existing = aircraft.photo_animated_asset_id if is_animated else aircraft.photo_asset_id
            if existing and not args.force:
                kind = "animada" if is_animated else "estática"
                print(f"[mantido] {aircraft.tail_number} já tem foto {kind} - use --force para substituir")
                continue

            content_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
            data = path.read_bytes()
            asset = models.MediaAsset(content_type=content_type, data=data)
            db.add(asset)
            db.flush()

            old_id = existing
            if is_animated:
                aircraft.photo_animated_asset_id = asset.id
            else:
                aircraft.photo_asset_id = asset.id
            if old_id:
                old_asset = db.get(models.MediaAsset, old_id)
                if old_asset:
                    db.delete(old_asset)

            kind = "animada" if is_animated else "estática"
            print(f"[ok] {aircraft.tail_number} ({aircraft.model}) <- {path.name} (foto {kind})")

        if not any_file:
            print(f"Nenhum arquivo de imagem (.png/.jpg/.jpeg/.gif/.webp) encontrado em {IMAGES_DIR}")

        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    main()
