import type { SupabaseClient } from "@supabase/supabase-js";
import type { City } from "@/lib/cities";
import type { CityNewsConfig, SignalType } from "@/lib/news/cities-news";

export interface DetectArgs {
  city: City;
  cfg: CityNewsConfig;
  supabase: SupabaseClient;
  /** "Today" in the city's local timezone, ISO date (YYYY-MM-DD). */
  today: string;
}

export interface SignalCandidate {
  type: SignalType;
  /** Higher = more newsworthy. Used to pick the winner of the day. */
  score: number;
  /** Short headline seed the drafter can expand. */
  headline_seed: string;
  /** Structured data the drafter gets to cite. Stored on the article row. */
  metadata: Record<string, unknown>;
  /** Hint to the drafter for image_query fallback. */
  image_hint: string;
}

export type Detector = (args: DetectArgs) => Promise<SignalCandidate[]>;
