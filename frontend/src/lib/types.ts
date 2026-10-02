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
