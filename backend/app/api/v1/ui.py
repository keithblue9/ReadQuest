from fastapi import APIRouter, Response

from app.api.deps import Db
from app.services import ui_config_service

router = APIRouter(tags=["ui"])


@router.get("/ui-config")
async def ui_config(db: Db, response: Response) -> dict:
    """Branding, background login, fitur aktif, dan teks UI. Publik: dipakai halaman login."""
    response.headers["Cache-Control"] = "public, max-age=30"
    return await ui_config_service.public_config(db)
