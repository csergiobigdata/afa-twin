"""
Serve os arquivos enviados (fotos de aeronave, de perfil, de inspeção
fotográfica) guardados como dado binário no banco (models.MediaAsset) -
ver a nota em models.py sobre por que não usamos disco local.

Sem autenticação de propósito: tags <img src="..."> do navegador não enviam
o cabeçalho Authorization, então exigir login aqui quebraria a exibição das
fotos na interface. Mantém o mesmo nível de exposição que o mount estático
usado antes (arquivo acessível por quem souber/adivinhar a URL).
"""
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db

router = APIRouter(prefix="/api/media", tags=["mídia"])


@router.get("/{asset_id}")
def get_media(asset_id: int, db: Session = Depends(get_db)):
    asset = db.get(models.MediaAsset, asset_id)
    if not asset:
        raise HTTPException(404, "Arquivo não encontrado")
    return Response(content=asset.data, media_type=asset.content_type)
