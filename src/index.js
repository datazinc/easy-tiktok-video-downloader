// index.js
import {
  startPolling,
  startPollingPageChanges,
} from "./modules/polling/polling.js";
import { displayFoundUrls } from "./modules/downloader/downloader.js";

// window.addEventListener("DOMContentLoaded", () => {
  startPolling();
  startPollingPageChanges();
  displayFoundUrls({ forced: true });
// });

console.log("ettvdebugger: INDEX LOADED...");