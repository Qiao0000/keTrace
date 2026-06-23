import type { AppConfig, Workspace } from "./types";

export const DEFAULT_CONFIG: AppConfig = {
  pollIntervalSeconds: 30,
  collectorEnabled: true,
  launchAtLogin: false,
  trayEnabled: true,
  aiProvider: "none",
  deepseekKey: "",
  theme: "system",
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
  submissions: [],
  reviews: {},
};
