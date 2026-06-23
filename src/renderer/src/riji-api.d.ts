import type { RijiAPI } from "../../preload/index";

declare global {
  interface Window {
    rijiAPI: RijiAPI;
  }
}
