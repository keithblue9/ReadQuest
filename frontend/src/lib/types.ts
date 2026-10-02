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
  counts: { like: number; insightful: number; inspiring: number; comments: number; bookmarks: number };
  created_at: string;
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

export type FinishResult = { session: ReadingSession; post: Post };

export type UploadedPhoto = { key: string; url: string; width: number; height: number };
