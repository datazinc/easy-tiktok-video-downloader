// index.js
import {
  startPolling,
  startPollingPageChanges,
} from "./modules/polling/polling.js";
import AppState from "./modules/state/state.js";
import { displayFoundUrls } from "./modules/utils/utils.js";

startPolling();
startPollingPageChanges(); 
displayFoundUrls({ forced: true });
 
if (AppState.debug.active) console.log("INDEX LOADED!!!!");