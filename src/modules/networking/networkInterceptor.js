// networkInterceptor.js
import { handleFoundItems } from "../downloader/handlers.js";
import { rememberShortDramaRequest } from "../utils/shortDrama.js";
import { rememberCollectionRequest } from "../utils/collection.js";
import { rememberAccountListResponse, isProgressiveListRequest } from "../utils/accountLists.js";
import {
  getPlaylistIdFromRequestUrl,
  rememberCurrentPlaylistItems,
  rememberPlaylistRequestUrl,
} from "../utils/utils.js";

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
    this._overrideXHR();
    this._overrideFetch();
  }

  handleResponse(data, sourceUrl = "") {
    try {
      rememberAccountListResponse(data, sourceUrl);
      if (isProgressiveListRequest(sourceUrl)) return;
      rememberShortDramaRequest(sourceUrl);
      rememberCollectionRequest(sourceUrl);
      const rememberedRequestUrl = rememberPlaylistRequestUrl(sourceUrl) || "";
      const playlistId = getPlaylistIdFromRequestUrl(
        rememberedRequestUrl || sourceUrl,
      );

      if (Array.isArray(data.itemList)) {
        rememberCurrentPlaylistItems(
          data.itemList,
          playlistId,
          rememberedRequestUrl || sourceUrl,
        );
        handleFoundItems(data.itemList.filter((item) => item.id));
      }
      if (Array.isArray(data.data)) {
        handleFoundItems(
          data.data.map((ent) => ent?.item).filter((item) => item?.id),
        );
      }

      if (data?.itemInfo?.itemStruct) {
        handleFoundItems([data.itemInfo.itemStruct]);
      }
    } catch (err) {
      console.warn("NetworkInterceptor: response handler error", err);
    }
  }

  _overrideXHR() {
    const self = this;

    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
      rememberShortDramaRequest(url);
      rememberCollectionRequest(url);
      this._ni_method = method;
      this._ni_url = url;
      return self._origXHROpen.call(this, method, url, ...rest);
    };

    XMLHttpRequest.prototype.send = function (body) {
      this.addEventListener("loadend", () => {
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
            self.handleResponse(data, this._ni_url);
          }
        } catch (err) {
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
      rememberShortDramaRequest(url);
      rememberCollectionRequest(url);
      const method = (init && init.method) || (isReq && input.method) || "GET";

      try {
        const response = await self._origFetch(input, init);

        const contentType = response.headers.get("content-type") || "";
        const responseUrl = response.url || url;
        let isApi = false;
        try { isApi = new URL(responseUrl, window.location.origin).pathname.startsWith("/api/"); } catch {}
        if (isProgressiveListRequest(responseUrl) || !contentType.includes("json") && !isApi) return response;

        // fire-and-forget JSON parsing
        response
          .clone()
          .json()
          .then((data) => {
            self.handleResponse(data, response.url || url);
          })
          .catch(() => {});

        return response;
      } catch (err) {
        if (err.name === "AbortError") {
          // this is usually a deliberate cancel; log at debug/info level
        } else {
          console.warn("NetworkInterceptor ● fetch failed", err);
        }
        // re-throw so calling code still sees the same behavior
        throw err;
      }
    };
    // also patch Request ctor so future new Request() usages get logged
    window.Request = function (input, init) {
      const req = new self._OrigRequest(input, init);
      return req;
    };
    window.Request.prototype = this._OrigRequest.prototype;
    window.Request.prototype.constructor = window.Request;
  }
}

new NetworkInterceptor();
