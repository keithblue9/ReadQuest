from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status

from app.api.deps import CurrentUser, Db, require_permission
from app.repositories import sessions as sessions_repo
from app.schemas.common import PyObjectId
from app.schemas.sessions import (
    FinishIn,
    FinishOut,
    HeartbeatIn,
    SessionConfigOut,
    SessionOut,
    SessionStartIn,
    TodayOut,
)
from app.services import session_service

router = APIRouter(prefix="/sessions", tags=["sessions"])

Reader = Annotated[dict, Depends(require_permission("session.create"))]


@router.get("/config", response_model=SessionConfigOut)
async def session_config(db: Db, _: CurrentUser) -> SessionConfigOut:
    return session_service.config_out(await session_service.load_config(db))


@router.get("/today", response_model=TodayOut)
async def today(db: Db, user: CurrentUser) -> TodayOut:
    return await session_service.today(db, user)


@router.get("", response_model=list[SessionOut])
async def recent_sessions(
    db: Db, user: CurrentUser, limit: Annotated[int, Query(ge=1, le=50)] = 10
) -> list[SessionOut]:
    cfg = await session_service.load_config(db)
    rows = await sessions_repo.list_recent(db, user["_id"], limit)
    return [session_service.to_out(s, cfg) for s in rows]


@router.post("", response_model=SessionOut, status_code=status.HTTP_201_CREATED)
async def start_session(data: SessionStartIn, db: Db, user: Reader) -> SessionOut:
    cfg = await session_service.load_config(db)
    session = await session_service.start(db, user, data.book_id, data.mode)
    return session_service.to_out(session, cfg)


@router.post("/{session_id}/heartbeat", response_model=SessionOut)
async def heartbeat(session_id: PyObjectId, data: HeartbeatIn, db: Db, user: Reader) -> SessionOut:
    cfg = await session_service.load_config(db)
    session = await session_service.heartbeat(db, user, session_id, data.state)
    return session_service.to_out(session, cfg)


@router.post("/{session_id}/finish", response_model=FinishOut)
async def finish(
    session_id: PyObjectId,
    data: FinishIn,
    db: Db,
    user: Annotated[dict, Depends(require_permission("post.create"))],
) -> FinishOut:
    return await session_service.finish(db, user, session_id, data)


@router.post("/{session_id}/abandon", status_code=status.HTTP_204_NO_CONTENT)
async def abandon(session_id: PyObjectId, db: Db, user: Reader) -> Response:
    await session_service.abandon(db, user, session_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
