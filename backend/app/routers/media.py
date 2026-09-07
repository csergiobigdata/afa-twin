"""
Serve os arquivos enviados (fotos de aeronave, de perfil, de inspeção
fotográfica) guardados como dado binário no banco (models.MediaAsset) -
ver a nota em models.py sobre por que não usamos disco local.

Sem autenticação de propósito: tags <img src="..."> do navegador não enviam
o cabeçalho Authorization, então exigir login aqui quebraria a exibição das
fotos na interface. Mantém o mesmo nível de exposição que o mount estático
usado antes (arquivo acessível por quem souber/adivinhar a URL).

Cache HTTP (correção de performance - ver routers/aircraft.py::upload_photo):
uma troca de foto sempre cria um MediaAsset NOVO (novo `id`) e só apaga o
antigo depois - nunca sobrescreve os bytes de um `id` já existente enquanto
ele ainda está em uso -, então o par (id, conteúdo) é efetivamente imutável
sob uma mesma URL em uso. Sem nenhum cabeçalho de cache (como era antes), o
navegador baixava de novo, por inteiro, a foto de CADA aeronave da frota a
cada visita ao Painel/lista - o gargalo real por trás da lentidão relatada,
não o cálculo do painel em si (que é local e leve, ver routers/dashboard.py).
ETag por "{id}-{created_at}" cobre com segurança o único caso em que um `id`
poderia ser reaproveitado (exclusão de foto sem substituição, seguida de
outro upload que reutilize o mesmo rowid do SQLite) - a data de criação
muda junto, invalidando o ETag antigo automaticamente.
"""
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db

router = APIRouter(prefix="/api/media", tags=["mídia"])

_CACHE_CONTROL = "public, max-age=86400, must-revalidate"


@router.get("/{asset_id}")
def get_media(asset_id: int, request: Request, db: Session = Depends(get_db)):
    asset = db.get(models.MediaAsset, asset_id)
    if not asset:
        raise HTTPException(404, "Arquivo não encontrado")

    etag = f'"{asset.id}-{asset.created_at.timestamp()}"'
    headers = {"Cache-Control": _CACHE_CONTROL, "ETag": etag}
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers=headers)
    return Response(content=asset.data, media_type=asset.content_type, headers=headers)
