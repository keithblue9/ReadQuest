"""Dashboard tim untuk semua anggota: statistik agregat + posisi pribadi.

Hanya data agregat dan aktivitas yang memang sudah publik di feed. Status Authenticity Index
individu tidak ditampilkan (tetap privat, lihat SPEC §3.7).
"""

from collections import defaultdict
from datetime import date, timedelta

from bson import ObjectId
from pymongo.asynchronous.database import AsyncDatabase

from app.core import clock, media
from app.repositories import catalog
from app.repositories.posts import VISIBLE
from app.repositories.sessions import OPEN_STATUSES

NOTE_TYPES = ["quick_note", "chapter_story", "book_review"]
DAYS = 14  # panjang grafik harian
WEEK = 7
TOP_READERS = 5
TOP_BOOKS = 5
RECENT_POSTS = 6


def _minutes(seconds: float) -> int:
    return round(seconds / 60)


async def build(db: AsyncDatabase, user: dict) -> dict:
    tz = str(await catalog.get_setting(db, "team.timezone", "Asia/Jakarta"))
    now = clock.now()
    today = date.fromisoformat(clock.local_date(now, tz))
    dates = [(today - timedelta(days=DAYS - 1 - i)).isoformat() for i in range(DAYS)]
    week_dates = set(dates[-WEEK:])
    today_s = dates[-1]

    users = (
        await db["users"]
        .find({"status": "active"}, {"name": 1, "function_id": 1, "created_at": 1, "avatar_url": 1})
        .to_list()
    )
    by_id = {u["_id"]: u for u in users}
    functions = {
        f["_id"]: f["name"] async for f in db["functions"].find({"is_active": True}, {"name": 1})
    }

    sessions = (
        await db["reading_sessions"]
        .find(
            {"status": "completed", "local_date": {"$gte": dates[0], "$lte": today_s}},
            {"user_id": 1, "local_date": 1, "active_seconds": 1},
        )
        .to_list()
    )

    daily = {d: {"seconds": 0, "readers": set()} for d in dates}
    week_seconds: dict[ObjectId, int] = defaultdict(int)
    for s in sessions:
        if s["user_id"] not in by_id:
            continue
        day = daily[s["local_date"]]
        day["seconds"] += s["active_seconds"]
        day["readers"].add(s["user_id"])
        if s["local_date"] in week_dates:
            week_seconds[s["user_id"]] += s["active_seconds"]

    readers_week = set(week_seconds)
    members = len(users)

    # Partisipasi per fungsi (7 hari): anggota yang membaca minimal sekali.
    fn_members: dict[ObjectId, int] = defaultdict(int)
    fn_readers: dict[ObjectId, int] = defaultdict(int)
    for u in users:
        fn = u.get("function_id")
        if fn in functions:
            fn_members[fn] += 1
            if u["_id"] in readers_week:
                fn_readers[fn] += 1
    by_function = sorted(
        (
            {
                "function": functions[fn],
                "members": count,
                "readers": fn_readers[fn],
                "rate": round(fn_readers[fn] / count, 3),
            }
            for fn, count in fn_members.items()
        ),
        key=lambda r: (-r["rate"], -r["readers"], r["function"]),
    )

    ranking = sorted(week_seconds.items(), key=lambda kv: (-kv[1], by_id[kv[0]]["name"]))
    top_readers = [
        {
            "user_id": str(uid),
            "name": by_id[uid]["name"],
            "avatar_url": by_id[uid].get("avatar_url"),
            "function": functions.get(by_id[uid].get("function_id")),
            "minutes": _minutes(seconds),
        }
        for uid, seconds in ranking[:TOP_READERS]
    ]
    my_rank = next((i + 1 for i, (uid, _) in enumerate(ranking) if uid == user["_id"]), None)

    popular = await (
        await db["reading_sessions"].aggregate(
            [
                {"$match": {"status": "completed", "local_date": {"$gte": dates[0]}}},
                {
                    "$group": {
                        "_id": "$book_id",
                        "title": {"$first": "$book.title"},
                        "authors": {"$first": "$book.authors"},
                        "readers": {"$addToSet": "$user_id"},
                        "seconds": {"$sum": "$active_seconds"},
                    }
                },
                {
                    "$project": {
                        "title": 1,
                        "authors": 1,
                        "readers": {"$size": "$readers"},
                        "seconds": 1,
                    }
                },
                {"$sort": {"readers": -1, "seconds": -1}},
                {"$limit": TOP_BOOKS},
            ]
        )
    ).to_list()
    covers = {
        b["_id"]: b.get("cover_image_key")
        async for b in db["books"].find(
            {"_id": {"$in": [p["_id"] for p in popular]}}, {"cover_image_key": 1}
        )
    }

    week_start = now - timedelta(days=WEEK)
    recent = (
        await db["posts"]
        .find(
            VISIBLE,
            {"author": 1, "author_id": 1, "book": 1, "book_id": 1, "type": 1, "created_at": 1},
        )
        .sort([("created_at", -1), ("_id", -1)])
        .limit(RECENT_POSTS)
        .to_list()
    )
    notes_week = await db["posts"].count_documents(
        {**VISIBLE, "type": {"$in": NOTE_TYPES}, "created_at": {"$gte": week_start}}
    )
    finished_week = await db["posts"].count_documents(
        {**VISIBLE, "is_book_finished": True, "created_at": {"$gte": week_start}}
    )
    reading_now = len(
        await db["reading_sessions"].distinct(
            "user_id",
            {
                "status": {"$in": OPEN_STATUSES},
                "last_heartbeat_at": {"$gte": now - timedelta(minutes=10)},
            },
        )
    )

    my_daily = defaultdict(int)
    for s in sessions:
        if s["user_id"] == user["_id"]:
            my_daily[s["local_date"]] += s["active_seconds"]

    return {
        "today": today_s,
        "team": {
            "members": members,
            "new_members_week": sum(
                1 for u in users if u.get("created_at") and u["created_at"] >= week_start
            ),
            "reading_now": reading_now,
            "readers_today": len(daily[today_s]["readers"]),
            "minutes_today": _minutes(daily[today_s]["seconds"]),
            "readers_week": len(readers_week),
            "minutes_week": _minutes(sum(week_seconds.values())),
            "participation_week": round(len(readers_week) / members, 3) if members else 0,
            "notes_week": notes_week,
            "books_finished_week": finished_week,
        },
        "daily": [
            {
                "date": d,
                "minutes": _minutes(daily[d]["seconds"]),
                "readers": len(daily[d]["readers"]),
            }
            for d in dates
        ],
        "by_function": by_function,
        "top_readers": top_readers,
        "popular_books": [
            {
                "book_id": str(p["_id"]),
                "title": p["title"],
                "authors": p.get("authors") or [],
                "cover_url": media.signed_url(covers[p["_id"]]) if covers.get(p["_id"]) else None,
                "readers": p["readers"],
                "minutes": _minutes(p["seconds"]),
            }
            for p in popular
        ],
        "recent_posts": [
            {
                "post_id": str(p["_id"]),
                "author": p["author"]["name"],
                "type": p["type"],
                "book_title": (p.get("book") or {}).get("title"),
                "created_at": p["created_at"],
            }
            for p in recent
        ],
        "me": {
            "rank_week": my_rank,
            "readers_week": len(ranking),
            "minutes_week": _minutes(week_seconds.get(user["_id"], 0)),
            "daily": [{"date": d, "minutes": _minutes(my_daily[d])} for d in dates[-WEEK:]],
        },
    }
