export type Item = {
  source: "app_store" | "google_play";
  id: string;
  title?: string;
  body?: string;
  rating?: number | null;
  author?: string;
  created_at: string;
  url: string;
  version?: string;
  features?: string[];
  /** 症状・観点（収集側の分類。バックフィル前のデータには存在しない） */
  topics?: string[];
};
