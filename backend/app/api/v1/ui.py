from fastapi import APIRouter, Response

from app.api.deps import CurrentUser, Db
from app.services import team_dashboard_service, ui_config_service

router = APIRouter(tags=["ui"])


@router.get("/ui-config")
async def ui_config(db: Db, response: Response) -> dict:
    """Branding, background login, fitur aktif, dan teks UI. Publik: dipakai halaman login."""
    response.headers["Cache-Control"] = "public, max-age=30"
    return await ui_config_service.public_config(db)


@router.get("/dashboard")
async def team_dashboard(db: Db, user: CurrentUser) -> dict:
    """Dashboard infografis untuk semua anggota: statistik tim agregat + posisi pribadi."""
    return await team_dashboard_service.build(db, user)
