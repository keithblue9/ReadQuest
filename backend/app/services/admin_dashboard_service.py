"""Dashboard Admin: partisipasi, menit baca, heatmap per fungsi, Observer, buku teratas."""

from collections import defaultdict
from datetime import date, timedelta

from pymongo.asynchronous.database import AsyncDatabase

from app.core import clock
from app.repositories import catalog
from app.services import authenticity_service

WEEKDAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"]
NOTE_TYPES = ["quick_note", "chapter_story", "book_review"]


async def build(db: AsyncDatabase, days: int) -> dict:
    tz = str(await catalog.get_setting(db, "team.timezone", "Asia/Jakarta"))
    today = clock.local_date(clock.now(), tz)
    end = date.fromisoformat(today)
    start = end - timedelta(days=days - 1)
    dates = [(start + timedelta(days=i)).isoformat() for i in range(days)]
    since_dt = clock.now() - timedelta(days=days)

    users = await db["users"].find({"status": "active"}, {"name": 1, "function_id": 1}).to_list()
    functions = {f["_id"]: f["name"] async for f in db["functions"].find({"is_active": True})}
    members_by_fn: dict = defaultdict(int)
    for u in users:
        if u.get("function_id") in functions:
            members_by_fn[u["function_id"]] += 1

    sessions = (
        await db["reading_sessions"]
        .find(
            {"status": "completed", "local_date": {"$gte": dates[0], "$lte": dates[-1]}},
            {"user_id": 1, "local_date": 1, "active_seconds": 1},
        )
        .to_list()
    )
    user_fn = {u["_id"]: u.get("function_id") for u in users}

    daily = {d: {"date": d, "minutes": 0.0, "readers": set()} for d in dates}
    heat: dict = defaultdict(lambda: [0.0] * 7)
    readers: set = set()
    total_seconds = 0
    for s in sessions:
        if s["user_id"] not in user_fn:
            continue
        minutes = s["active_seconds"] / 60
        total_seconds += s["active_seconds"]
        readers.add(s["user_id"])
        day = daily[s["local_date"]]
        day["minutes"] += minutes
        day["readers"].add(s["user_id"])
        fn = user_fn[s["user_id"]]
        if fn in functions:
            heat[fn][date.fromisoformat(s["local_date"]).weekday()] += minutes

    weekday_occurrences = [0] * 7
    for d in dates:
        weekday_occurrences[date.fromisoformat(d).weekday()] += 1
    heatmap = [
        {
            "function_id": str(fn),
            "function": name,
            "members": members_by_fn.get(fn, 0),
            # Rata-rata menit per anggota per hari (untuk tiap hari dalam seminggu).
            "values": [
                round(heat[fn][i] / members_by_fn[fn] / weekday_occurrences[i], 1)
                if members_by_fn.get(fn) and weekday_occurrences[i]
                else 0
                for i in range(7)
            ],
        }
        for fn, name in sorted(functions.items(), key=lambda kv: kv[1])
    ]

    notes = await db["posts"].count_documents(
        {"type": {"$in": NOTE_TYPES}, "created_at": {"$gte": since_dt}, "deleted_at": None}
    )
    finished = await db["posts"].count_documents(
        {"is_book_finished": True, "created_at": {"$gte": since_dt}, "deleted_at": None}
    )
    top_books = await (
        await db["reading_sessions"].aggregate(
            [
                {"$match": {"status": "completed", "local_date": {"$gte": dates[0]}}},
                {
                    "$group": {
                        "_id": "$book_id",
                        "title": {"$first": "$book.title"},
                        "readers": {"$addToSet": "$user_id"},
                        "seconds": {"$sum": "$active_seconds"},
                    }
                },
                {
                    "$project": {
                        "title": 1,
                        "readers": {"$size": "$readers"},
                        "minutes": {"$round": [{"$divide": ["$seconds", 60]}, 0]},
                    }
                },
                {"$sort": {"readers": -1, "minutes": -1}},
                {"$limit": 5},
            ]
        )
    ).to_list()

    authenticity = await authenticity_service.compute(db, users)
    counts = {s: 0 for s in authenticity_service.LABELS}
    for a in authenticity:
        counts[a.status] += 1
    observers = sorted(
        (a for a in authenticity if a.status == "observer"), key=lambda a: a.contribution_ratio
    )

    members = len(users)
    return {
        "days": days,
        "start": dates[0],
        "end": dates[-1],
        "members": members,
        "active_readers": len(readers),
        "participation_rate": round(len(readers) / members, 3) if members else 0,
        "total_minutes": round(total_seconds / 60),
        "avg_minutes_per_reader": round(total_seconds / 60 / len(readers), 1) if readers else 0,
        "avg_daily_minutes_per_reader": round(total_seconds / 60 / len(readers) / days, 1)
        if readers
        else 0,
        "sessions": len(sessions),
        "notes": notes,
        "books_finished": finished,
        "daily": [
            {"date": d["date"], "minutes": round(d["minutes"]), "readers": len(d["readers"])}
            for d in daily.values()
        ],
        "weekdays": WEEKDAYS,
        "heatmap": heatmap,
        "authenticity_counts": counts,
        "observers": [
            {
                "user_id": str(o.user_id),
                "name": o.name,
                "function": functions.get(o.function_id),
                "own_notes": o.own_notes,
                "comments_given": o.comments_given,
                "likes_given": o.likes_given,
                "contribution_ratio": o.contribution_ratio,
            }
            for o in observers[:50]
        ],
        "top_books": [
            {
                "book_id": str(b["_id"]),
                "title": b["title"],
                "readers": b["readers"],
                "minutes": int(b["minutes"]),
            }
            for b in top_books
        ],
    }


async def user_rows(db: AsyncDatabase, days: int) -> list[dict]:
    """Rekap per pengguna untuk export."""
    since = clock.now() - timedelta(days=days)
    users = await db["users"].find({"status": "active"}).sort("name", 1).to_list()
    functions = {f["_id"]: f["name"] async for f in db["functions"].find()}
    authenticity = {a.user_id: a for a in await authenticity_service.compute(db, users)}
    rows = []
    for u in users:
        sessions = (
            await db["reading_sessions"]
            .find(
                {"user_id": u["_id"], "status": "completed", "ended_at": {"$gte": since}},
                {"active_seconds": 1},
            )
            .to_list()
        )
        points = await (
            await db["points_ledger"].aggregate(
                [
                    {"$match": {"user_id": u["_id"], "created_at": {"$gte": since}}},
                    {"$group": {"_id": None, "p": {"$sum": "$points"}}},
                ]
            )
        ).to_list()
        a = authenticity[u["_id"]]
        rows.append(
            {
                "name": u["name"],
                "phone": u.get("phone") or u.get("email") or "-",
                "function": functions.get(u.get("function_id"), "-"),
                "sessions": len(sessions),
                "minutes": round(sum(s["active_seconds"] for s in sessions) / 60),
                "notes": a.own_notes,
                "points": points[0]["p"] if points else 0,
                "status": a.status_label,
            }
        )
    return rows
