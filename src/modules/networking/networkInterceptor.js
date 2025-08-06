// networkInterceptor.js
import { handleFoundItems } from "../downloader/handlers.js";
import AppState from "../state/state.js";

export class NetworkInterceptor {
  constructor() {
    // stash the originals
    this._origXHROpen = XMLHttpRequest.prototype.open;
    this._origXHRSend = XMLHttpRequest.prototype.send;
    this._origFetch = window.fetch.bind(window);
    this._OrigRequest = window.Request;
    this._origBeacon =
      navigator.sendBeacon && navigator.sendBeacon.bind(navigator);
    this._origEventSource = window.EventSource;
    this._origWebSocket = window.WebSocket;

    this._init();
  }

  _init() {
      if (AppState.debug.active)
        console.log("NetworkInterceptor: installing hooks…");
    this._overrideXHR();
    this._overrideFetch();
      if (AppState.debug.active)
        console.log("NetworkInterceptor: all hooks installed ✅");
  }

  handleResponse(data) {
    try {
      if (Array.isArray(data.itemList)) {
        handleFoundItems(data.itemList.filter((item) => item.id));
      }
      if (Array.isArray(data.data)) {
        handleFoundItems(
          data.data.map((ent) => ent?.item).filter((item) => item?.id)
        );
      }

      if (data?.itemInfo?.itemStruct) {
        handleFoundItems([data.itemInfo.itemStruct]);
      }
    } catch (err) {
        if (AppState.debug.active)
          console.warn("NetworkInterceptor: response handler error", err);
    }
  }

  _overrideXHR() {
    const self = this;

    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
      this._ni_method = method;
      this._ni_url = url;
        if (AppState.debug.active)
          console.log("NetworkInterceptor ● XHR open", method, url);
      return self._origXHROpen.call(this, method, url, ...rest);
    };

    XMLHttpRequest.prototype.send = function (body) {
      this.addEventListener("loadend", () => {
          if (AppState.debug.active)
            console.log(
              "NetworkInterceptor ● XHR done",
              this._ni_method,
              this._ni_url,
              this.status
            );
        let data;
        // inside your loadend listener…
        try {
          const rt = this.responseType; // grab the responseType
          if (rt === "json") {
            data = this.response;
          }
          // only attempt responseText if rt is "" (default) or "text"
          else if (rt === "" || rt === "text") {
            const text = this.responseText;
            if (text && /^\s*[\{\[]/.test(text)) {
              data = JSON.parse(text);
            }
          }
          if (data !== undefined) {
              if (AppState.debug.active)
                console.log(
                  "NetworkInterceptor ● XHR JSON",
                  this._ni_url,
                  data
                );
            self.handleResponse(data);
          }
        } catch (err) {
            if (AppState.debug.active)
              console.warn("NetworkInterceptor ● XHR parse error", err);
        }
      });
      return self._origXHRSend.call(this, body);
    };
  }

  _overrideFetch() {
    const self = this;

    window.fetch = async function (input, init) {
      const isReq = input instanceof self._OrigRequest;
      const url = isReq ? input.url : input;
      const method = (init && init.method) || (isReq && input.method) || "GET";
      if (AppState.debug.active)
        console.log("NetworkInterceptor ● fetch", method, url);

      try {
        const response = await self._origFetch(input, init);
        if (AppState.debug.active)
          console.log(
            "NetworkInterceptor ● fetch response",
            response.status,
            response.url
          );

        // fire-and-forget JSON parsing
        response
          .clone()
          .json()
          .then((data) => {
            if (AppState.debug.active)
              console.log(
                "NetworkInterceptor ● fetch JSON",
                response.url,
                data
              );
            self.handleResponse(data);
          })
          .catch(() => {
            if (AppState.debug.active)
              console.warn("NetworkInterceptor ● fetch non-JSON", response.url);
          });

        return response;
      } catch (err) {
        if (err.name === "AbortError") {
          // this is usually a deliberate cancel; log at debug/info level
          if (AppState.debug.active)
            console.info("NetworkInterceptor ● fetch aborted", method, url);
        } else {
          if (AppState.debug.active)
            console.warn("NetworkInterceptor ● fetch failed", err);
        }
        // re-throw so calling code still sees the same behavior
        throw err;
      }
    };
    // also patch Request ctor so future new Request() usages get logged
    window.Request = function (input, init) {
      const req = new self._OrigRequest(input, init);
      if (AppState.debug.active)
        console.log("NetworkInterceptor ● Request ctor", req.method, req.url);
      return req;
    };
    window.Request.prototype = this._OrigRequest.prototype;
    window.Request.prototype.constructor = window.Request;
  }

 

}

// Usage: import and instantiate once, as early as possible.
new NetworkInterceptor();
