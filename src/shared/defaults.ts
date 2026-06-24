import type { AppConfig, Workspace } from "./types";

export const MIN_POLL_INTERVAL_SECONDS = 120;
export const MAX_POLL_INTERVAL_SECONDS = 300;
export const DATA_SCHEMA_VERSION = 2;

export const DEFAULT_CONFIG: AppConfig = {
  pollIntervalSeconds: MIN_POLL_INTERVAL_SECONDS,
  collectorEnabled: true,
  launchAtLogin: false,
  trayEnabled: true,
  dockHidden: false,
  aiProvider: "doubao",
  arkKey: "",
  theme: "system",
  reportsDir: "",
};

export const DEFAULT_WORKSPACE: Workspace = {
  version: 1,
  tasks: [],
  projects: [],
  timeBlocks: [],
  thesis: {
    meta: { title: "" },
    chapters: [],
    milestones: [],
    logs: [],
  },
  theses: [],
  submissions: [],
  reviews: {},
};
