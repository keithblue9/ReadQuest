export type Me = {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  role: { code: string; name: string };
  permissions: string[];
  function_id: string | null;
  interests: string[];
  daily_target_minutes: number;
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

export type NoteType = "quick_note" | "chapter_story" | "book_review";

export type Post = {
  id: string;
  type: NoteType | "progress_photo" | "discussion";
  content: string;
  word_count: number;
  image_urls: string[];
  rating: number | null;
  page_progress: { current_page: number | null; total_pages: number | null } | null;
  is_book_finished: boolean;
  topics: string[];
  author: { id: string; name: string; avatar_url: string | null; function_id: string | null };
  book: { id: string; title: string; authors: string[]; category_id: string | null };
  counts: PostCounts;
  mentions: UserMini[];
  viewer: { reaction: ReactionType | null; bookmarked: boolean };
  created_at: string;
};

export type ReactionType = "like" | "insightful" | "inspiring";

export type PostCounts = {
  like: number;
  insightful: number;
  inspiring: number;
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
  active_seconds: number;
  min_seconds: number;
  started_at: string;
  ended_at: string | null;
  local_date: string;
  is_full_points: boolean;
  post_id: string | null;
};

export type SessionConfig = {
  min_seconds: number;
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

export type FinishResult = { session: ReadingSession; post: Post; points: PointsResult };

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
