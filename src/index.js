// index.js
import "./modules/networking/networkInterceptor.js";
import {
  startPolling,
} from "./modules/polling/polling.js";
import AppState from "./modules/state/state.js";
import { displayFoundUrls } from "./modules/utils/utils.js";

setTimeout(() => {
  // Awful initial poll mechanism. Injecting on time seems to not be efficient.
  [1, 3, 5, 10, 15, 20, 30, 60, 180].forEach((sec) =>
    setTimeout(() => {
      if (
        Object.keys(AppState.allItemsEverSeen).length >
        AppState.allDirectLinks.length
      ) {
        console.log("SOFT_REFRESHER_ON", sec);
        // Soft refresh.
        displayFoundUrls();
      }
    }, sec * 1000)
  );
  startPolling();
  displayFoundUrls({ forced: true });
  if (AppState.debug.active) console.log("INDEX LOADED!!!!");
}, 1000);
