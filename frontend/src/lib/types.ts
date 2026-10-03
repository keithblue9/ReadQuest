export type Me = {
  id: string;
  phone: string | null;
  email: string | null;
  name: string;
  avatar_url: string | null;
  role: { code: string; name: string };
  permissions: string[];
  function_id: string | null;
  interests: string[];
  daily_target_minutes: number;
  target_mode: TargetMode;
  weekly_target_minutes: number;
  headline: string;
  favorite_book_ids: string[];
  timezone: string;
  onboarding_completed: boolean;
  level: Level | null;
  stats: {
    points_total: number;
    books_finished: number;
    posts_count: number;
    current_streak: number;
  };
};

export type TargetMode = "daily" | "weekly";

export type TokenResponse = {
  access_token: string;
  token_type: "bearer";
  expires_in: number;
  user: Me;
};

export type OnboardingOptions = {
  functions: { id: string; name: string; code: string; parent_id: string | null }[];
  categories: { id: string; name: string; code: string; icon: string | null }[];
  daily_target_min_minutes: number;
  daily_target_default_minutes: number;
};

export type Category = { id: string; name: string; icon: string | null };

export type Book = {
  id: string;
  title: string;
  authors: string[];
  category: Category | null;
  publisher: string | null;
  year: number | null;
  total_pages: number | null;
  isbn: string | null;
  cover_url: string | null;
  stats: {
    readers_count: number;
    posts_count: number;
    avg_rating: number | null;
    finished_count: number;
  };
  created_at: string;
};

export type NoteType = "quick_note" | "chapter_story" | "book_review" | "takeaway";
export type TakeawayKind = "insight" | "action" | "quote";

export type Post = {
  id: string;
  type: NoteType | "progress_photo" | "discussion" | "quote";
  content: string;
  word_count: number;
  image_urls: string[];
  rating: number | null;
  page_progress: { current_page: number | null; total_pages: number | null } | null;
  is_book_finished: boolean;
  takeaway_kind: TakeawayKind | null;
  quote: { text: string; page: number | null } | null;
  topics: string[];
  author: { id: string; name: string; avatar_url: string | null; function_id: string | null };
  book: { id: string; title: string; authors: string[]; category_id: string | null };
  counts: PostCounts;
  mentions: UserMini[];
  viewer: { reaction: ReactionType | null; bookmarked: boolean };
  created_at: string;
};

export type ReactionType = "like" | "insightful" | "inspiring" | "want_to_read";

export type PostCounts = {
  like: number;
  insightful: number;
  inspiring: number;
  want_to_read: number;
  comments: number;
  bookmarks: number;
};

export type UserMini = { id: string; name: string; avatar_url: string | null };

export type Comment = {
  id: string;
  post_id: string;
  parent_id: string | null;
  root_id: string | null;
  author: UserMini;
  content: string;
  is_meaningful: boolean;
  deleted: boolean;
  mentions: UserMini[];
  created_at: string;
};

export type CommentCreated = {
  comment: Comment;
  points: { rule_code: string; name: string; points: number }[];
};

export type PostPage = { items: Post[]; next_cursor: string | null };

export type ReadingSession = {
  id: string;
  book: { id: string; title: string; authors: string[]; cover_url: string | null };
  status: "active" | "paused" | "completed" | "abandoned";
  mode: SessionMode;
  active_seconds: number;
  min_seconds: number;
  started_at: string;
  ended_at: string | null;
  local_date: string;
  is_full_points: boolean;
  post_id: string | null;
};

export type SessionMode = "standard" | "micro";

export type SessionConfig = {
  min_seconds: number;
  micro_min_seconds: number;
  idle_timeout_seconds: number;
  heartbeat_interval_seconds: number;
  note_min_words: Record<NoteType, number>;
  note_min_unique_ratio: number;
  note_max_paste_ratio: number;
};

export type Today = {
  local_date: string;
  full_points_done: boolean;
  active_session: ReadingSession | null;
  minutes_today: number;
  min_minutes: number;
};

export type Level = {
  level: number;
  title: string;
  min_points: number;
  next_min_points: number | null;
  next_title: string | null;
};

export type PointsResult = {
  awarded: { rule_code: string; name: string; points: number }[];
  total_awarded: number;
  points_total: number;
  level: Level | null;
  level_up: boolean;
  streak: { current: number; longest: number; milestone: number | null };
};

export type PointsSummary = {
  points_total: number;
  points_today: number;
  level: Level | null;
  streak: {
    current: number;
    longest: number;
    last_read_date: string | null;
    read_today: boolean;
    next_milestone: number | null;
    freezes_per_month: number;
    freezes_left: number;
  };
};

export type LedgerEntry = {
  id: string;
  rule_code: string;
  name: string;
  points: number;
  source_type: string;
  local_date: string;
  note: string | null;
  created_at: string;
};

export type LedgerPage = { items: LedgerEntry[]; next_cursor: string | null };

export type Badge = {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  earned: boolean;
  awarded_at: string | null;
  progress: number;
  target: number;
};

export type Quest = {
  id: string;
  code: string;
  title: string;
  description: string;
  goal_type: string;
  target: number;
  progress: number;
  completed: boolean;
  reward_points: number;
  period_key: string;
  ends_at: string | null;
};

export type FinishResult = {
  session: ReadingSession;
  post: Post;
  points: PointsResult;
  badges: Badge[];
  quests_completed: Quest[];
};

export type AuthenticityStatus = "active_reader" | "warming_up" | "observer" | "silent";

export type Authenticity = {
  user_id: string;
  name: string;
  function_id: string | null;
  window_days: number;
  own_notes: number;
  comments_given: number;
  likes_given: number;
  contribution_ratio: number;
  status: AuthenticityStatus;
  status_label: string;
  computed_at: string;
};

export type AuthenticityTeam = {
  counts: Record<AuthenticityStatus, number>;
  members: Authenticity[];
};

export type BookOfMonth = {
  month: string;
  auto: boolean;
  book: Book | null;
  readers_this_month: number;
};

export type Buddies = {
  buddy: {
    pair_id: string;
    user: UserMini;
    read_today: boolean;
    streak: number;
    since: string | null;
  } | null;
  incoming: { pair_id: string; user: UserMini; created_at: string }[];
  outgoing: { pair_id: string; user: UserMini; created_at: string }[];
};

export type RoomMember = {
  user_id: string;
  name: string;
  avatar_url: string | null;
  reading: boolean;
  book_title: string | null;
  elapsed_seconds: number;
};

export type UploadedPhoto = { key: string; url: string; width: number; height: number };

export type LeaderboardCategory =
  | "top_storyteller"
  | "streak_master"
  | "book_finisher"
  | "most_inspiring"
  | "function_battle";

export type LeaderboardPeriod = "weekly" | "monthly" | "all_time";

export type LeaderboardEntry = {
  rank: number;
  score: number;
  user: UserMini | null;
  function: { id: string; name: string } | null;
  detail: Record<string, number>;
};

export type Leaderboard = {
  category: LeaderboardCategory;
  period: LeaderboardPeriod;
  period_key: string;
  label: string;
  is_final: boolean;
  prev_key: string | null;
  next_key: string | null;
  entries: LeaderboardEntry[];
  me: { rank: number; score: number; total_participants: number } | null;
  computed_at: string;
};

export type LeaderboardSummaryItem = {
  category: LeaderboardCategory;
  rank: number | null;
  score: number;
  total_participants: number;
};

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  url: string | null;
  actor_count: number;
  read: boolean;
  created_at: string;
  updated_at: string;
};

export type NotificationPage = {
  items: AppNotification[];
  unread_count: number;
  next_cursor: string | null;
};

export type ChannelPrefs = { push: boolean; in_app: boolean };

export type NotificationPreferences = {
  types: Record<string, ChannelPrefs>;
  quiet_hours: { enabled: boolean; start: string; end: string };
  reminder_time: string;
  smart_reminder: boolean;
  smart_reminder_time: string | null;
  digest_time: string;
  frequency: "realtime" | "batched" | "daily_digest";
};

export type TeamDashboard = {
  today: string;
  team: {
    members: number;
    new_members_week: number;
    reading_now: number;
    readers_today: number;
    minutes_today: number;
    readers_week: number;
    minutes_week: number;
    participation_week: number;
    notes_week: number;
    books_finished_week: number;
  };
  daily: { date: string; minutes: number; readers: number }[];
  by_function: { function: string; members: number; readers: number; rate: number }[];
  top_readers: { user_id: string; name: string; avatar_url: string | null; function: string | null; minutes: number }[];
  popular_books: {
    book_id: string;
    title: string;
    authors: string[];
    cover_url: string | null;
    readers: number;
    minutes: number;
  }[];
  recent_posts: { post_id: string; author: string; type: string; book_title: string | null; created_at: string }[];
  me: { rank_week: number | null; readers_week: number; minutes_week: number; daily: { date: string; minutes: number }[] };
};

export type Progress = {
  target_mode: TargetMode;
  daily_target_minutes: number;
  weekly_target_minutes: number;
  today: string;
  today_minutes: number;
  week_minutes: number;
  week_start: string;
  week_end: string;
  daily_met: boolean;
  weekly_met: boolean;
  days: { date: string; minutes: number }[];
};

export type ShelfStatus = "reading" | "want" | "finished";
export type ShelfBook = { id: string; title: string; authors: string[]; cover_url: string | null };
export type Shelf = {
  items: { book: ShelfBook; status: ShelfStatus; updated_at: string }[];
  counts: Record<ShelfStatus, number>;
};

export type PublicProfile = {
  id: string;
  name: string;
  avatar_url: string | null;
  headline: string;
  function: string | null;
  role: string | null;
  joined_at: string | null;
  level: Level | null;
  stats: {
    points_total: number;
    books_finished: number;
    posts_count: number;
    current_streak: number;
    longest_streak: number;
    reading_minutes: number;
  };
  badges: { id: string; name: string; icon: string; description: string; awarded_at: string }[];
  favorite_books: ShelfBook[];
  currently_reading: ShelfBook[];
  shelf_counts: Record<ShelfStatus, number>;
  is_me: boolean;
};

export type ParticipationPoint = {
  week: string;
  members: number;
  readers: number;
  rate: number;
  minutes: number;
  avg_minutes_per_member: number;
};

export type ParticipationReport = {
  weeks: string[];
  start: string;
  end: string;
  min_group_size: number;
  functions: { function: string; members: number; series: ParticipationPoint[] }[];
  overall: ParticipationPoint[];
};
