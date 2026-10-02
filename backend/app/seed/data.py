"""Data awal (seed). Nilai di sini hanya default: setelah di-seed, Admin mengubahnya di
database, dan seed ulang tidak menimpa perubahan tersebut."""

PERMISSIONS: list[tuple[str, str, str]] = [
    # (code, group, description)
    ("session.create", "reading", "Memulai & menyelesaikan sesi baca"),
    ("post.create", "feed", "Membuat posting/catatan"),
    ("post.react", "feed", "Memberi reaksi"),
    ("comment.create", "feed", "Menulis komentar"),
    ("book.create", "books", "Menambah buku ke katalog"),
    ("leaderboard.view", "leaderboard", "Melihat leaderboard"),
    ("authenticity.view_self", "authenticity", "Melihat status Authenticity Index sendiri"),
    ("authenticity.view_team", "authenticity", "Melihat status anggota fungsi yang dipimpin"),
    ("authenticity.view_all", "authenticity", "Melihat status semua pengguna"),
    ("post.moderate", "moderation", "Menyembunyikan/memoderasi konten"),
    ("admin.dashboard.view", "admin", "Melihat dashboard admin"),
    ("admin.export", "admin", "Export laporan Excel/PDF"),
    ("config.functions.manage", "config", "Kelola fungsi/bagian"),
    ("config.roles.manage", "config", "Kelola role & permission"),
    ("config.points.manage", "config", "Kelola aturan poin & batas harian"),
    ("config.gamification.manage", "config", "Kelola badge, quest, level"),
    ("config.books.manage", "config", "Kelola katalog & kategori buku"),
    ("config.notifications.manage", "config", "Kelola jadwal & template notifikasi"),
    ("config.settings.manage", "config", "Kelola pengaturan aplikasi & threshold"),
    ("invites.manage", "config", "Kelola kode undangan"),
    ("audit.view", "admin", "Melihat audit log"),
]

_MEMBER = [
    "session.create",
    "post.create",
    "post.react",
    "comment.create",
    "book.create",
    "leaderboard.view",
    "authenticity.view_self",
]

ROLES: list[dict] = [
    {
        "code": "member",
        "name": "Member",
        "description": "Anggota tim pembaca",
        "permission_codes": _MEMBER,
    },
    {
        "code": "team_lead",
        "name": "Team Lead",
        "description": "Pemimpin fungsi/bagian",
        "permission_codes": [*_MEMBER, "authenticity.view_team"],
    },
    {
        "code": "admin",
        "name": "Admin",
        "description": "Akses penuh",
        "permission_codes": [code for code, _, _ in PERMISSIONS],
    },
]

# Nilai poin sesuai docs/SPEC.md §3.4. Batas harian adalah default awal anti-spam.
POINT_RULES: list[dict] = [
    {"code": "session_valid", "name": "Sesi baca valid", "points": 20, "daily_cap_count": 1},
    {"code": "chapter_story", "name": "Chapter Story", "points": 40, "daily_cap_count": 1},
    {"code": "book_finished", "name": "Buku selesai", "points": 150, "daily_cap_count": 1},
    {"code": "post_feed", "name": "Posting ke feed", "points": 10, "daily_cap_count": 3},
    {"code": "like_received", "name": "Like diterima", "points": 2, "daily_cap_count": 25},
    {
        "code": "meaningful_comment_received",
        "name": "Komentar bermakna diterima",
        "points": 5,
        "daily_cap_count": 10,
    },
    {
        "code": "meaningful_comment_given",
        "name": "Memberi komentar bermakna",
        "points": 3,
        "daily_cap_count": 10,
    },
    {"code": "progress_photo", "name": "Foto progres baca", "points": 5, "daily_cap_count": 1},
    {"code": "streak_7", "name": "Bonus streak 7 hari", "points": 50, "daily_cap_count": None},
    {"code": "streak_14", "name": "Bonus streak 14 hari", "points": 100, "daily_cap_count": None},
    {"code": "streak_30", "name": "Bonus streak 30 hari", "points": 250, "daily_cap_count": None},
    {
        "code": "streak_100",
        "name": "Bonus streak 100 hari",
        "points": 1000,
        "daily_cap_count": None,
    },
]

LEVELS: list[dict] = [
    {"level": 1, "title": "Pembaca Pemula", "min_points": 0},
    {"level": 2, "title": "Page Turner", "min_points": 200},
    {"level": 3, "title": "Bookworm", "min_points": 600},
    {"level": 4, "title": "Story Weaver", "min_points": 1500},
    {"level": 5, "title": "Literary Explorer", "min_points": 3000},
    {"level": 6, "title": "Reading Sage", "min_points": 6000},
]

BOOK_CATEGORIES: list[tuple[str, str, str]] = [
    # (code, name, icon)
    ("bisnis", "Bisnis & Manajemen", "💼"),
    ("pengembangan-diri", "Pengembangan Diri", "🌱"),
    ("teknologi", "Teknologi", "💻"),
    ("keuangan", "Keuangan", "💰"),
    ("psikologi", "Psikologi", "🧠"),
    ("kepemimpinan", "Kepemimpinan", "🧭"),
    ("fiksi", "Fiksi", "📖"),
    ("biografi", "Biografi", "👤"),
    ("sejarah", "Sejarah", "🏛️"),
    ("sains", "Sains", "🔬"),
    ("kesehatan", "Kesehatan", "🩺"),
    ("agama-spiritualitas", "Agama & Spiritualitas", "🕊️"),
    ("lainnya", "Lainnya", "📚"),
]

# Contoh fungsi awal; Admin menyesuaikan di Admin Config.
FUNCTIONS: list[tuple[str, str]] = [
    ("operasional", "Operasional"),
    ("keuangan", "Keuangan"),
    ("sdm", "SDM"),
    ("teknologi-informasi", "Teknologi Informasi"),
    ("pemasaran", "Pemasaran & Penjualan"),
    ("hukum", "Hukum & Kepatuhan"),
]

APP_SETTINGS: list[tuple[str, object, str]] = [
    ("session.min_minutes", 15, "Durasi minimal sesi baca (menit)"),
    (
        "session.idle_timeout_seconds",
        300,
        'Cek kehadiran "Masih membaca?" setelah tidak ada interaksi (detik)',
    ),
    (
        "session.heartbeat_max_gap_seconds",
        45,
        "Celah heartbeat maksimal yang masih dihitung sebagai waktu baca (detik)",
    ),
    (
        "note.min_words",
        {"quick_note": 30, "chapter_story": 80, "book_review": 200},
        "Jumlah kata minimal per jenis catatan",
    ),
    ("note.min_unique_word_ratio", 0.4, "Rasio kata unik minimal"),
    ("note.max_paste_ratio", 0.5, "Rasio maksimal teks hasil paste"),
    ("comment.meaningful_min_words", 8, "Kata minimal agar komentar dianggap bermakna"),
    (
        "authenticity.thresholds",
        {"active_reader": 0.5, "warming_up": 0.25, "observer": 0.0},
        "Ambang Contribution Ratio per status",
    ),
    ("upload.max_bytes", 1048576, "Ukuran maksimal foto (byte)"),
    ("onboarding.default_daily_target_minutes", 15, "Target harian default"),
]
