from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, Response

from app.api.deps import Db, require_permission
from app.core.errors import AppError
from app.services import audit_service, reports_service

router = APIRouter(prefix="/reports", tags=["reports"])

Viewer = Annotated[dict, Depends(require_permission("reports.view"))]
Weeks = Annotated[int, Query(ge=4, le=52)]


@router.get("/participation")
async def participation(db: Db, _: Viewer, weeks: Weeks = 12) -> dict:
    return await reports_service.participation(db, weeks)


@router.get("/participation.{fmt}")
async def participation_export(
    fmt: str, db: Db, actor: Viewer, request: Request, weeks: Weeks = 12
) -> Response:
    if fmt not in {"csv", "xlsx"}:
        raise AppError(404, "unknown_format", "Format harus csv atau xlsx")
    report = await reports_service.participation(db, weeks)
    if fmt == "csv":
        content, media = reports_service.to_csv(report), "text/csv; charset=utf-8"
    else:
        content = reports_service.to_xlsx(report)
        media = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    await audit_service.log(
        db,
        actor=actor,
        action=f"report.participation.{fmt}",
        entity_type="report",
        entity_id=None,
        after={"weeks": weeks},
        ip=request.client.host if request.client else "",
        user_agent=request.headers.get("user-agent", ""),
    )
    stamp = datetime.now(UTC).strftime("%Y%m%d")
    return Response(
        content=content,
        media_type=media,
        headers={"Content-Disposition": f'attachment; filename="partisipasi-divisi-{stamp}.{fmt}"'},
    )
