"""Reading Room live: siapa yang sedang membaca, buku apa, dan sorakan (cheer) realtime.

State presence disimpan di memori proses (cukup untuk satu instance backend). Untuk beberapa
instance, ganti broadcast dengan Redis pub/sub (lihat ARCHITECTURE.md).
"""

import asyncio
import json
import time
from dataclasses import dataclass, field

from bson import ObjectId
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status

from app.core.db import get_db
from app.core.security import decode_access_token

router = APIRouter()

ALLOWED_CHEERS = {"👏", "🔥", "📚", "💪", "✨", "❤️"}
AUTH_TIMEOUT_SECONDS = 5.0
CHEER_MIN_INTERVAL = 2.0
MAX_MESSAGE_BYTES = 2048


@dataclass
class Member:
    user_id: str
    name: str
    avatar_url: str | None
    reading: bool = False
    book_title: str | None = None
    elapsed_seconds: int = 0
    joined_at: float = field(default_factory=time.time)
    last_cheer: float = 0.0

    def public(self) -> dict:
        return {
            "user_id": self.user_id,
            "name": self.name,
            "avatar_url": self.avatar_url,
            "reading": self.reading,
            "book_title": self.book_title,
            "elapsed_seconds": self.elapsed_seconds,
        }


class RoomManager:
    def __init__(self) -> None:
        self.rooms: dict[str, dict[WebSocket, Member]] = {}
        self.lock = asyncio.Lock()

    def members(self, room: str) -> list[dict]:
        seen: dict[str, dict] = {}
        for member in self.rooms.get(room, {}).values():
            # Satu user bisa membuka beberapa tab; tampilkan sekali (status membaca diutamakan).
            current = seen.get(member.user_id)
            if current is None or (member.reading and not current["reading"]):
                seen[member.user_id] = member.public()
        return sorted(seen.values(), key=lambda m: (not m["reading"], m["name"]))

    async def join(self, room: str, ws: WebSocket, member: Member) -> None:
        async with self.lock:
            self.rooms.setdefault(room, {})[ws] = member
        await self.broadcast_presence(room)

    async def leave(self, room: str, ws: WebSocket) -> None:
        async with self.lock:
            connections = self.rooms.get(room, {})
            connections.pop(ws, None)
            if not connections:
                self.rooms.pop(room, None)
        await self.broadcast_presence(room)

    async def broadcast(self, room: str, message: dict) -> None:
        for ws in list(self.rooms.get(room, {})):
            try:
                await ws.send_json(message)
            except Exception:  # noqa: BLE001 - koneksi putus dibersihkan saat leave
                pass

    async def broadcast_presence(self, room: str) -> None:
        await self.broadcast(room, {"type": "presence", "members": self.members(room)})


manager = RoomManager()


def _valid_room(room: str) -> bool:
    return room == "global" or ObjectId.is_valid(room)


async def _authenticate(websocket: WebSocket) -> dict | None:
    """Pesan pertama wajib `{"type": "auth", "token": "<access token>"}`.

    Token tidak dikirim lewat query string agar tidak tercatat di access log proxy/server.
    """
    try:
        raw = await asyncio.wait_for(websocket.receive_text(), AUTH_TIMEOUT_SECONDS)
        message = json.loads(raw)
    except (TimeoutError, ValueError, WebSocketDisconnect):
        return None
    if not isinstance(message, dict) or message.get("type") != "auth":
        return None
    payload = decode_access_token(str(message.get("token", "")))
    if payload is None or not ObjectId.is_valid(payload.get("sub", "")):
        return None
    return await get_db()["users"].find_one(
        {"_id": ObjectId(payload["sub"]), "status": "active"}, {"name": 1, "avatar_url": 1}
    )


@router.websocket("/ws/rooms/{room}")
async def reading_room(websocket: WebSocket, room: str) -> None:
    await websocket.accept()
    if not _valid_room(room):
        await websocket.close(code=4404)
        return
    user = await _authenticate(websocket)
    if user is None:
        await websocket.close(code=4401)
        return

    member = Member(user_id=str(user["_id"]), name=user["name"], avatar_url=user.get("avatar_url"))
    await manager.join(room, websocket, member)
    try:
        while True:
            raw = await websocket.receive_text()
            if len(raw.encode()) > MAX_MESSAGE_BYTES:
                continue
            try:
                message = json.loads(raw)
            except ValueError:
                continue
            kind = message.get("type")
            if kind == "status":
                member.reading = bool(message.get("reading"))
                title = message.get("book_title")
                member.book_title = str(title)[:120] if title else None
                elapsed = message.get("elapsed_seconds")
                member.elapsed_seconds = int(elapsed) if isinstance(elapsed, int | float) else 0
                await manager.broadcast_presence(room)
            elif kind == "cheer":
                emoji = message.get("emoji")
                now = time.monotonic()
                if emoji in ALLOWED_CHEERS and now - member.last_cheer >= CHEER_MIN_INTERVAL:
                    member.last_cheer = now
                    target = message.get("to")
                    await manager.broadcast(
                        room,
                        {
                            "type": "cheer",
                            "emoji": emoji,
                            "from": {"user_id": member.user_id, "name": member.name},
                            "to": str(target) if target else None,
                        },
                    )
            elif kind == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        pass
    finally:
        await manager.leave(room, websocket)
        if websocket.client_state.name != "DISCONNECTED":
            await websocket.close(code=status.WS_1000_NORMAL_CLOSURE)
