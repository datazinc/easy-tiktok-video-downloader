// Constants
const STORAGE_KEYS = {
  HAS_RATED: "hasRated",
  IS_DOWNLOADER_CLOSED: "isDownloaderClosed",
};

const DOM_IDS = {
  DOWNLOADER_WRAPPER: "ttk-downloader-wrapper",
  SHOW_DOWNLOADER: "ettpd-show",
  NEXT_DATA: "__NEXT_DATA__",
};

const UI_ELEMENTS = {
  LIKED_TAB_SELECTOR: 'p[role="tab"]',
  VIDEO_WRAPPER_SELECTOR: 'div[id^="xgwrapper"]',
};

// State management using a single source of truth
const AppState = {
  isLoggedIn: false,
  postItems: new Map(),
  allDirectLinks: [],
  displayedState: {
    itemsHash: "",
    path: "",
  },
  filters: {
    currentProfile: false,
    likedVideos: false,
    favoriteVideos: false,
    state: "INIT",
  },
  downloadedURLs: [],
  likedVideos: {},
  downloading: {
    isActive: false,
    isDownloadingAll: false,
  },
  ui: {
    isDownloaderClosed:
      localStorage.getItem(STORAGE_KEYS.IS_DOWNLOADER_CLOSED) === "true",
    isRatePopupOpen: false,
    hasRated:
      localStorage.getItem(STORAGE_KEYS.HAS_RATED) === "true" &&
      Math.random() < 0.95, // 5% chance to show the popup again even if the user has rated
  },
};

// (function () {
//   var XHR = XMLHttpRequest.prototype;
//   var open = XHR.open;
//   var send = XHR.send;
//   XHR.open = function (method, url) {
//     this._method = method;
//     this._url = url;
//     return open.apply(this, arguments);
//   };
//   // Listen to traffic
//   XHR.send = function (postData) {
//     this.addEventListener("load", function () {
//       let data = {};
//       try {
//         if (this.responseType === "" || this.responseType === "text")
//           data = JSON.parse(this.responseText);

//         if (data.itemList) {
//           handleFoundItems(data.itemList?.filter((item) => item.id));
//         }
//         if (Array.isArray(data.data)) {
//           handleFoundItems(
//             data.data.map((entry) => entry?.item).filter((item) => item?.id)
//           );
//         }
//       } catch (error) {
//         console.warn("Low level error in XHR.send", error);
//       }
//     });
//     return send.apply(this, arguments);
//   };
// })();

class NetworkInterceptor {
  constructor() {
    window.AbortController.prototype.abort = () => {};
    this.originalXHR = XMLHttpRequest.prototype;
    this.originalFetch = window.fetch;
    this.init();
  }

  init() {
    this.overrideXHR();
    this.overrideFetch();
  }

  handleResponse(data) {
    try {
      if (data.itemList && data.itemList.length && data.itemList[0]?.id) {
        this.handleFoundItems(data.itemList.filter((item) => item.id));
      }

      if (Array.isArray(data.data)) {
        this.handleFoundItems(
          data.data.map((entry) => entry?.item).filter((item) => item?.id)
        );
      }
    } catch (error) {
      console.warn("Error while processing response data", error);
    }
  }

  handleFoundItems(newItems) {
    try {
      if (!newItems || !newItems.length || !newItems[0]) newItems = [];
      let defaultScope = window?.__$UNIVERSAL_DATA$__?.__DEFAULT_SCOPE__;
      let videoDetail = defaultScope
        ? defaultScope["webapp.video-detail"]
        : null;
      let structAuthorId = videoDetail?.itemInfo?.itemStruct?.author?.uniqueId;
      let videoItem = videoDetail?.itemInfo?.itemStruct;
      if (
        videoItem?.id &&
        AppState.postItems[structAuthorId].findIndex(
          (post) => post.id == videoItem.id
        ) < 0
      ) {
        console.log("videoItem: 1:", videoItem);
        AppState.postItems[structAuthorId].push(videoItem);
      }
    } catch (error) {
      console.warn("Error in adding itemStruct", error);
    }

    for (let i = 0; i < newItems.length; i++) {
      let item = newItems[i];
      let authorId = item?.author?.uniqueId;
      if (!authorId) continue;
      if (!AppState.postItems[authorId]) AppState.postItems[authorId] = [];
      if (
        AppState.postItems[authorId].findIndex((post) => post.id == item.id) < 0
      ) {
        console.log("videoItem: 2: ", item);

        AppState.postItems[authorId].push(item);
      }
      if (AppState.filters.likedVideos) {
        if (!likedVideos[getCurrentPageUsername()])
          likedVideos[getCurrentPageUsername()] = [];
        if (
          likedVideos[getCurrentPageUsername()].findIndex(
            (post) => post.id == item.id
          ) < 0
        ) {
          console.log("videoItem: 3", item);

          likedVideos[getCurrentPageUsername()].push(item);
        }
      }
    }

    displayFoundUrls();

    // if (!AppState.postItems[getCurrentPageUsername()])
    //   AppState.postItems[getCurrentPageUsername()] = [];
    // let nonDuplicateItems = generateNonDuplicateItems(
    //   AppState.postItems[getCurrentPageUsername()],
    //   newItems
    // );
    // if (nonDuplicateItems && nonDuplicateItems.length) {
    //   if (filterVideosState.startsWith("LIKES")) {
    //     nonDuplicateItems = nonDuplicateItems.filter(
    //       (post) =>
    //         post?.author != getCurrentPageUsername() &&
    //         post?.author?.uniqueId != getCurrentPageUsername()
    //     );
    //     AppState.postItems[getCurrentPageUsername()] = nonDuplicateItems;
    //   } else if (filterVideosState.startsWith("ALL")) {
    //     nonDuplicateItems = nonDuplicateItems.filter(
    //       (post) =>
    //         post?.author == getCurrentPageUsername() ||
    //         post?.author?.uniqueId == getCurrentPageUsername()
    //     );
    //     AppState.postItems[getCurrentPageUsername()] = nonDuplicateItems;
    //   }

    //   // fail safe
    //   if (nonDuplicateItems.length)
    //     AppState.postItems[getCurrentPageUsername()] = nonDuplicateItems;
    // }
    // if (nonDuplicateItems.length)
    //   AppState.postItems[getCurrentPageUsername()] = nonDuplicateItems;

    // // Should be done after updating the AppState.postItems
    // if (!filterVideosState.endsWith("UPDATED") && filterVideosState != "INIT") {
    //   displayFoundUrls();
    //   filterVideosState += "_UPDATED";
    // }
    // let currentPathContentId = document.location.pathname;

    // AppState.postItems[getCurrentPageUsername()].forEach(
    //   (item) => (currentPathContentId += item.id)
    // );
    // if (displayedItemsId[getCurrentPageUsername()] != currentPathContentId) {
    //   displayedItemsId[getCurrentPageUsername()] = currentPathContentId;
    //   displayFoundUrls();
    // }
  }

  overrideXHR() {
    const open = this.originalXHR.open;
    const send = this.originalXHR.send;
    const self = this;

    this.originalXHR.open = function (method, url) {
      this._method = method;
      this._url = url;
      return open.apply(this, arguments);
    };

    this.originalXHR.send = function (postData) {
      this.addEventListener("load", function () {
        try {
          let data = {};
          if (this.responseType === "" || this.responseType === "text") {
            data = JSON.parse(this.responseText);
          }
          self.handleResponse(data);
        } catch (error) {
          console.log("Low-level error in XHR.send", this.responseText, error);
        }
      });

      return send.apply(this, arguments);
    };
  }

  overrideFetch() {
    const self = this;

    // Save and bind the original fetch
    this.originalFetch = window.fetch.bind(window);

    window.fetch = async (...args) => {
      const response = await self.originalFetch(...args);
      response
        .clone()
        .json()
        .then((data) => self.handleResponse(data))
        .catch((error) => {
          console.log("Low-level error in fetch", error);
        });

      return response;
    };
  }
}

// Initialize the interceptor

document.addEventListener("DOMContentLoaded", () => {
  new NetworkInterceptor();
});

function displayFoundUrls({ forced } = {}) {
  if (AppState.ui.isDownloaderClosed) return hideDownloader();
  if (AppState.downloading.isActive || AppState.downloading.isDownloadingAll) {
    return;
  }

  let items = [];

  if (AppState.filters.currentProfile) {
    items = AppState.postItems[getCurrentPageUsername()] || [];
  } else if (AppState.filters.likedVideos) {
    const searchText = `Videos liked by ${getCurrentPageUsername()} are currently hidden`;
    if (!document.body.innerText.includes(searchText)) {
      items = likedVideos[getCurrentPageUsername()] || [];
    }
  } else {
    for (const key in AppState.postItems) {
      items.push(...AppState.postItems[key]);
    }
  }
  if (
    AppState.displayedState.itemsHash == getPostsHash(items) &&
    !forced &&
    AppState.displayedState.path == document.location.pathname
  ) {
    return;
  }
  // reset all direct links

  AppState.allDirectLinks = [];
  const _id = "ttk-downloader-wrapper";
  document.getElementById(_id)?.remove();
  // Hash the displayed items
  AppState.displayedState.itemsHash = getPostsHash(items);
  AppState.displayedState.path = document.location.pathname;
  // Create the downloader
  let wrapper = document.createElement("div");
  wrapper.className = "ettpd-wrapper";
  let downloadAllLinksBtn = document.createElement("button");
  downloadAllLinksBtn.className = "ettpd-btn download-all-btn";
  let reportBugBtn = document.createElement("button");
  reportBugBtn.className = "ettpd-btn ettpd-report-bug";
  let creditsText = document.createElement("span");
  creditsText.className = "ettpd-span ettpd-copyright";
  let currentVideoBtn = document.createElement("button");
  currentVideoBtn.classList = "ettpd-current-video-btn ettpd-btn";
  creditsText.innerHTML = `&copy; ${new Date().getFullYear()} - Made by DataZinc💛`;
  creditsText.onclick = hideDownloader;
  downloadAllLinksBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    AppState.downloading.isDownloadingAll = true;
    downloadAllLinks(downloadAllLinksBtn);
  });

  wrapper.id = _id;
  let itemListContainer = document.createElement("div");
  itemListContainer.className = "ettpd-item-list-container";
  let itemsList = document.createElement("ol");
  itemsList.className = "ettpd-ol";
  items.forEach((media, idx) => {
    let item = document.createElement("li");
    let anc = document.createElement("a");
    let downloadBtn = document.createElement("button");

    // Anchor element
    anc.className = "ettpd-a";
    anc.target = "_blank";
    // anc.innerText = `Video ${idx + 1}`;
    let currentVideoId = document.location.pathname.split("/")[3];
    if (currentVideoId == media?.id) anc.innerText = `🔴 `;
    if (media?.author?.uniqueId)
      anc.innerText += `@${media?.author?.uniqueId} `;
    if (media?.desc) anc.innerText += media?.desc || "";
    anc.href = media?.video?.playAddr;

    // Download button
    downloadBtn.innerText = "Download";
    downloadBtn.style.marginLeft = "10px";
    downloadBtn.style.cursor = "pointer";
    downloadBtn.style.padding = "5px 10px";
    downloadBtn.style.border = "none";
    downloadBtn.style.borderRadius = "5px";
    downloadBtn.style.backgroundColor = "#1da1f2";
    downloadBtn.style.color = "white";
    downloadBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const filename = `tiktok-video-${media?.id}-${media?.author?.uniqueId}-${
        idx + 1
      }.mp4`;
      downloadURLToDisk(media?.video?.playAddr, filename).catch((error) => {
        console.warn("Error in downloading video", error);
      });
    });

    // Append elements
    item.appendChild(anc);
    item.appendChild(downloadBtn);
    itemsList.appendChild(item);

    // Push direct links to array
    AppState.allDirectLinks.push({
      url: anc.href,
      desc: media?.desc,
      videoId: media?.id,
      authorId: media?.author?.uniqueId,
      currentPageUsername: getCurrentPageUsername(),
    });
  });

  if (
    !AppState.allDirectLinks?.length &&
    Object.keys(AppState.postItems).length == 0
  ) {
    // hide the downloader
    hideDownloaderOnEmpty();
  }
  downloadAllLinksBtn.innerText = `Download All ${
    AppState.allDirectLinks?.length || 0
  } videos!`;
  let subText = document.createElement("span");
  subText.style.display = "block";
  subText.innerText = " (Click to download all)";

  if (AppState.filters.currentProfile)
    subText.innerText = ` (@${getCurrentPageUsername()})`;
  if (AppState.filters.likedVideos)
    subText.innerText = ` (Liked by ${getCurrentPageUsername()})`;
  downloadAllLinksBtn.appendChild(subText);

  if (AppState.downloading.isActive) {
    downloadAllLinksBtn.disabled = AppState.downloading.isActive;
  }

  // downloadAllLinksBtn.innerText += filterVideosState.startsWith("LIKES")
  //   ? " likes"
  //   : "";

  reportBugBtn.innerText = "Report Bugs (Quick fix: Refresh/Login/Logout😉)";
  let reportBugBtnLink = document.createElement("a");
  reportBugBtnLink.target = "_blank";
  reportBugBtnLink.href = "https://bit.ly/ettpd-issues";
  reportBugBtnLink.appendChild(reportBugBtn);

  itemListContainer.appendChild(itemsList);
  wrapper.appendChild(itemListContainer);
  document.body.appendChild(wrapper);
  if (document.location.pathname.split("/").length == 4) {
    currentVideoBtn.innerText = "Download Playing Video!";
    if (AppState.downloading.isActive) {
      currentVideoBtn.innerText = "Downloading Current Video...";
      currentVideoBtn.disabled = AppState.downloading.isActive;
    }
    let currentVideo = AppState.postItems[getCurrentPageUsername()]?.find(
      (item) => item.id == document.location.pathname.split("/")[3]
    );

    let currentVideoLink = document.createElement("span");
    currentVideoLink.onclick = () => {
      downloadURLToDisk(
        currentVideo?.video?.playAddr,
        `tiktok-video-${currentVideo.id}-${
          currentVideo?.desc?.replace(/ /g, `-`).slice(0, 20) || "x"
        }.mp4`
      ).catch((error) => {
        console.warn("Error in downloading current video", error);
      });
    };

    currentVideoLink.appendChild(currentVideoBtn);
    if (currentVideo) wrapper.prepend(currentVideoLink);
  }
  // Only show the filter toggle if logged in user is the current page user
  try {
    if (
      window?.__$UNIVERSAL_DATA$__?.__DEFAULT_SCOPE__ &&
      window?.__$UNIVERSAL_DATA$__?.__DEFAULT_SCOPE__["webapp.user-detail"] &&
      window?.__$UNIVERSAL_DATA$__?.__DEFAULT_SCOPE__["webapp.user-detail"]
        ?.userInfo?.user?.uniqueId == getCurrentPageUsername()
    ) {
      // wrapper.prepend(likedVideosOnlyBtn);
    }
  } catch (error) {
    console.warn("Error in showing filter button", error);
  }

  wrapper.prepend(downloadAllLinksBtn);
  // Filter options
  if (
    getCurrentPageUsername() != "😃" &&
    window.location.pathname.split("/").length == 2
  ) {
    let filterContainer = document.createElement("div");
    filterContainer.className = "ettpd-filter-container";
    // only by current profile
    let currentProfileOnlyContainer = document.createElement("div");
    currentProfileOnlyContainer.className = "ettpd-current-profile-container";
    let currentProfileOnly = document.createElement("input");
    currentProfileOnly.checked = AppState.filters.currentProfile;
    currentProfileOnly.type = "checkbox";
    currentProfileOnly.id = "ettpd-current-profile";
    currentProfileOnly.onclick = () => {
      AppState.filters.currentProfile = !AppState.filters.currentProfile;
      if (AppState.filters.currentProfile) AppState.filters.likedVideos = false;
      displayFoundUrls({ forced: true });
    };
    let currentProfileOnlyLabel = document.createElement("label");
    currentProfileOnlyLabel.htmlFor = "ettpd-current-profile";
    currentProfileOnlyLabel.innerText = `Only by @${getCurrentPageUsername()}`;
    currentProfileOnlyContainer.appendChild(currentProfileOnly);
    currentProfileOnlyContainer.appendChild(currentProfileOnlyLabel);
    filterContainer.appendChild(currentProfileOnlyContainer);
    // only liked videos
    let likedVideosOnlyContainer = document.createElement("div");
    likedVideosOnlyContainer.className = "ettpd-liked-only-container";
    let likedVideosOnly = document.createElement("input");
    likedVideosOnly.checked = AppState.filters.likedVideos;
    likedVideosOnly.type = "checkbox";
    likedVideosOnly.id = "ettpd-liked-only";
    likedVideosOnly.onclick = () => {
      displayFoundUrls({ forced: true });
      if (!AppState.filters.likedVideos) {
        startLikesPolling();
        AppState.filters.currentProfile = false;
      } else {
        AppState.filters.likedVideos = false;
      }
    };
    let likedVideosOnlyLabel = document.createElement("label");
    likedVideosOnlyLabel.htmlFor = "ettpd-liked-only";
    likedVideosOnlyLabel.innerText = "Only likes (beta)";
    likedVideosOnlyContainer.appendChild(likedVideosOnly);
    likedVideosOnlyContainer.appendChild(likedVideosOnlyLabel);
    filterContainer.appendChild(likedVideosOnlyContainer);

    // Add message
    let message = document.createElement("span");
    message.className = "ettpd-message";
    message.innerText = "✨Scroll down the page to load more videos✨";
    message.style.color = "black";
    wrapper.prepend(message);
    wrapper.prepend(filterContainer);
  }

  wrapper.append(reportBugBtnLink);
  wrapper.append(creditsText);
  let closeButton = document.createElement("button");
  closeButton.id = "ettpd-close";
  closeButton.onclick = () => {
    AppState.ui.isDownloaderClosed = true;
    localStorage.setItem(
      STORAGE_KEYS.IS_DOWNLOADER_CLOSED,
      AppState.ui.isDownloaderClosed
    );
    hideDownloader();
  };
  closeButton.innerText = "X";
  wrapper.prepend(closeButton);
}

function hideDownloaderOnEmpty() {
  setTimeout(() => {
    hideDownloader();
  }, 0);
}

function hideDownloader() {
  document.getElementById("ttk-downloader-wrapper")?.remove();
  if (document.getElementById("ettpd-show")) return;
  let showDownloaderBtn = document.createElement("button");
  showDownloaderBtn.id = "ettpd-show";
  showDownloaderBtn.innerText = "Open Video Downloader";
  showDownloaderBtn.onclick = () => {
    if (
      !AppState.allDirectLinks?.length &&
      Object.keys(AppState.postItems).length == 0
    ) {
      alert(
        "Could not fetch any videos to download😔... Hover over the video you want to download and click on the download button to download it."
      );
      return;
    }
    localStorage.setItem(STORAGE_KEYS.IS_DOWNLOADER_CLOSED, false);
    AppState.ui.isDownloaderClosed = false;
    showDownloader();
  };
  document.body.appendChild(showDownloaderBtn);
}

function showDownloader() {
  displayFoundUrls({ forced: true });
  document.getElementById("ettpd-show")?.remove();
}

function pollInitialData() {
  const loggedInDataItems = getLoggedInInitialData();
  if (loggedInDataItems.length)
    handleFoundItems(loggedInDataItems?.filter((item) => item?.id));
  const loggedOutDataItems = getLoggedOutInitialData();
  if (loggedOutDataItems.length)
    handleFoundItems(loggedOutDataItems?.filter((item) => item?.id));
  setTimeout(() => {
    pollInitialData();
  }, 3000);
}

async function downloadAllLinks(mainBtn) {
  AppState.downloading.isDownloadingAll = true;
  try {
    if (!AppState.allDirectLinks?.length)
      alert(
        "Could not fetch any videos to download😔... Hover over the video you want to download and click on the download button to download it."
      );
    for (let index = 0; index < AppState.allDirectLinks?.length; index++) {
      if (
        AppState.downloadedURLs.includes(
          AppState.allDirectLinks?.at(index)?.url
        )
      )
        continue;
      AppState.downloadedURLs.push(AppState.allDirectLinks?.at(index)?.url);

      const item = AppState.allDirectLinks?.at(index);
      const username = item?.authorId || item?.currentPageUsername || "video";
      const rawVideoId =
        item?.videoId || item?.desc || Math.random().toString(36).slice(2, 10);
      const videoId = rawVideoId
        .toString()
        .replace(/[^a-zA-Z0-9_-]/g, "-")
        .slice(0, 50);

      const filename = `tiktok-${username}-${videoId}.mp4`;
      try {
        mainBtn.innerHTML = `Downloading ${index + 1} of ${
          AppState.allDirectLinks?.length || 0
        }`;
        await downloadURLToDisk(
          AppState.allDirectLinks?.at(index)?.url,
          filename
        );
      } catch (error) {
        console.warn(
          `Error in downloading video ${index + 1} of ${
            AppState.allDirectLinks?.length || 0
          }`,
          error
        );
        mainBtn.innerHTML = `Failed to download ${index + 1} of ${
          AppState.allDirectLinks?.length || 0
        }`;
        continue;
      }
      mainBtn.innerHTML = `Downloading  ${index + 1} of ${
        AppState.allDirectLinks?.length || 0
      }`;
    }
    mainBtn.innerHTML = `Downloaded ${
      AppState.allDirectLinks?.length || 0
    } Videos!`;
  } catch (error) {
    console.warn("Error in downloading all links", error);
    mainBtn.innerHTML = `Failed to download all videos!`;
  }
  setTimeout(() => {
    AppState.downloading.isDownloadingAll = false;
  }, 3000);

  // redirect to chrome web store
  showRateUsPopUp();
}

function showRateUsPopUp() {
  if (AppState.ui.hasRated) return;
  if (AppState.ui.isRatePopupOpen) return;
  AppState.ui.isRatePopupOpen = true;
  hideDownloader();
  // show the rating popup
  const div = document.createElement("div");
  div.style.position = "fixed";
  div.style.top = "0";
  div.style.left = "0";
  div.style.width = "100%";
  div.style.height = "100%";
  div.style.zIndex = "999";
  div.style.backgroundColor = "rgba(31, 26, 26, 0.5)";
  div.innerHTML = `
  <div style="
    position: absolute; 
    top: 50%; 
    left: 50%; 
    transform: translate(-50%, -50%); 
    width: 400px; 
    max-width: 90%; 
    background-color: #ffffff; 
    color: #333333; 
    border-radius: 12px; 
    padding: 20px; 
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); 
    font-family: Arial, sans-serif; 
    text-align: center;
  ">
    <h2 style="margin-bottom: 15px; font-size: 1.5em; color: #1da1f2;">Download Complete! 🎉</h2>
    <p style="margin-bottom: 20px; font-size: 1em; line-height: 1.5; color: #555555;">
      Your video has been successfully downloaded! 🎥<br>
      We'd love your support—rate us 5 ⭐ on the Chrome Web Store to help us grow! 🥰
    </p>
    <a 
      href="https://chrome.google.com/webstore/detail/easy-tiktok-video-downloa/fclobfmgolhdcfcmpbjahiiifilhamcg" 
      target="_blank" 
      style="
        display: inline-block; 
        background-color: #1da1f2; 
        color: white; 
        padding: 12px 20px; 
        font-size: 1em; 
        border-radius: 8px; 
        text-decoration: none; 
        font-weight: bold; 
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2); 
        transition: background-color 0.3s ease;
      "
      onmouseover="this.style.backgroundColor='#0a84d6';" 
      onmouseout="this.style.backgroundColor='#1da1f2';"
    >
      Rate Now
    </a>
  </div>
`;

  const anchor = div.querySelector("a");
  anchor.onclick = () => {
    hasRatedTrue();
  };
  document.body.appendChild(div);
  function hasRatedTrue() {
    localStorage.setItem(STORAGE_KEYS.HAS_RATED, true);
    AppState.ui.hasRated = true;
  }
  div.onclick = () => {
    div.remove();
  };
}

function handleFoundItems(newItems) {
  try {
    if (!newItems || !newItems.length || !newItems[0]) newItems = [];
    let defaultScope = window?.__$UNIVERSAL_DATA$__?.__DEFAULT_SCOPE__;
    let videoDetail = defaultScope ? defaultScope["webapp.video-detail"] : null;
    let structAuthorId = videoDetail?.itemInfo?.itemStruct?.author?.uniqueId;
    let videoItem = videoDetail?.itemInfo?.itemStruct;
    console.log(defaultScope, videoItem);
    if (
      videoItem?.id &&
      AppState.postItems[structAuthorId] &&
      AppState.postItems[structAuthorId].findIndex(
        (post) => post.id == videoItem.id
      ) < 0
    ) {
      console.log("videoItem: 4", videoItem);
      AppState.postItems[structAuthorId].push(videoItem);
    }
  } catch (error) {
    console.warn("Error in adding itemStruct", error);
  }

  for (let i = 0; i < newItems.length; i++) {
    let item = newItems[i];
    let authorId = item?.author?.uniqueId;
    if (!authorId) continue;
    if (!AppState.postItems[authorId]) AppState.postItems[authorId] = [];
    if (
      AppState.postItems[authorId].findIndex((post) => post.id == item.id) < 0
    ) {
      console.log("videoItem: 5", item);
      AppState.postItems[authorId].push(item);
    }
    if (AppState.filters.likedVideos) {
      if (!likedVideos[getCurrentPageUsername()])
        likedVideos[getCurrentPageUsername()] = [];
      if (
        likedVideos[getCurrentPageUsername()].findIndex(
          (post) => post.id == item.id
        ) < 0
      ) {
        likedVideos[getCurrentPageUsername()].push(item);
      }
    }
  }

  displayFoundUrls();

  // if (!AppState.postItems[getCurrentPageUsername()])
  //   AppState.postItems[getCurrentPageUsername()] = [];
  // let nonDuplicateItems = generateNonDuplicateItems(
  //   AppState.postItems[getCurrentPageUsername()],
  //   newItems
  // );
  // if (nonDuplicateItems && nonDuplicateItems.length) {
  //   if (filterVideosState.startsWith("LIKES")) {
  //     nonDuplicateItems = nonDuplicateItems.filter(
  //       (post) =>
  //         post?.author != getCurrentPageUsername() &&
  //         post?.author?.uniqueId != getCurrentPageUsername()
  //     );
  //     AppState.postItems[getCurrentPageUsername()] = nonDuplicateItems;
  //   } else if (filterVideosState.startsWith("ALL")) {
  //     nonDuplicateItems = nonDuplicateItems.filter(
  //       (post) =>
  //         post?.author == getCurrentPageUsername() ||
  //         post?.author?.uniqueId == getCurrentPageUsername()
  //     );
  //     AppState.postItems[getCurrentPageUsername()] = nonDuplicateItems;
  //   }

  //   // fail safe
  //   if (nonDuplicateItems.length)
  //     AppState.postItems[getCurrentPageUsername()] = nonDuplicateItems;
  // }
  // if (nonDuplicateItems.length)
  //   AppState.postItems[getCurrentPageUsername()] = nonDuplicateItems;

  // // Should be done after updating the AppState.postItems
  // if (!filterVideosState.endsWith("UPDATED") && filterVideosState != "INIT") {
  //   displayFoundUrls();
  //   filterVideosState += "_UPDATED";
  // }
  // let currentPathContentId = document.location.pathname;

  // AppState.postItems[getCurrentPageUsername()].forEach(
  //   (item) => (currentPathContentId += item.id)
  // );
  // if (displayedItemsId[getCurrentPageUsername()] != currentPathContentId) {
  //   displayedItemsId[getCurrentPageUsername()] = currentPathContentId;
  //   displayFoundUrls();
  // }
}

function populatePostItems(nonDuplicateItems, newItems) {
  if (!Array.isArray(nonDuplicateItems))
    throw Error("nonDuplicateItems must be an array");
  if (
    !newItems ||
    !Array.isArray(newItems) ||
    !newItems.length ||
    !newItems[0]
  ) {
    return [];
  }
  newItems.forEach((item) => {
    if (
      nonDuplicateItems.findIndex((nonDupItem) => nonDupItem?.id == item?.id) <
      0
    ) {
      nonDuplicateItems.push(item);
    }
  });
  return nonDuplicateItems;
}

// function toggleShowLikedVideosOnly(btnElement) {
//   // tricky tricks - set it to LIKES if it's set on ALL or INIT, set to to ALL, if it's set on LIKES
//   filterVideosState =
//     filterVideosState != "INIT"
//       ? filterVideosState.startsWith("LIKES")
//         ? "ALL"
//         : "LIKES"
//       : "LIKES";

//   btnElement.innerText = filterVideosState.startsWith("LIKES")
//     ? "Showing Liked Videos (click to undo)"
//     : "Filter Liked Videos(First click on liked videos)";
//   // Refresh to show valid data;
//   if (filterVideosState == "ALL") window.location.href = window.location.href;
// }

// TODO: Know why the website is aborting request instead of overwriting the abort method with a dummy function.

// const browserFetch = window.fetch;
// window.fetch = async (...args) => {
//   const response = await browserFetch(...args);
//   response
//     .clone()
//     .json()
//     .then((data) => {
//       try {
//         if (data.itemList && data.itemList.length && data.itemList[0]?.id) {
//           handleFoundItems(data.itemList.filter((item) => item.id));
//         }

//         if (Array.isArray(data.data)) {
//           handleFoundItems(
//             data.data.map((entry) => entry?.item).filter((item) => item?.id)
//           );
//         }
//       } catch (error) {
//         console.warn("Low level error in fetch", error);
//       }
//     });
//   return response;
// };

function getLoggedInInitialData() {
  // List of {id, url}
  let orderedItems = [];
  try {
    let preLoadedList =
      window.SIGI_STATE?.ItemList["user-post"]?.preloadList || [];
    // meta data
    let preLoadedListMetadata = window.SIGI_STATE?.ItemModule;

    preLoadedList.forEach((item) => {
      orderedItems.push(preLoadedListMetadata[item.id]);
    });
  } catch (error) {}
  try {
    let singleVideoId = window.SIGI_STATE?.ItemList.video.list[0];
    let singleVideoMetadata = window.SIGI_STATE?.ItemModule[singleVideoId];
    orderedItems.push(singleVideoMetadata);
  } catch (error) {}
  return orderedItems;
}

function getLoggedOutInitialData() {
  let items = [];
  if (document.getElementById("__NEXT_DATA__")) {
    let initialData = JSON.parse(
      document.getElementById("__NEXT_DATA__").innerText
    );

    items = initialData?.props?.pageProps?.items || [];
  }
  return items;
}

// Launch global polls
// Initial Data Poll
window.onload = () => {
  pollInitialData();

  // Page change poll
  let currentPageUsername = getCurrentPageUsername();

  setInterval(() => {
    if (currentPageUsername != getCurrentPageUsername()) {
      try {
        currentPageUsername = getCurrentPageUsername();
        AppState.allDirectLinks = [];
        const _id = "ttk-downloader-wrapper";
        document.getElementById(_id)?.remove();
        let likedTab = getLikedTab();
        // If aria-selected="true" is present, the user is viewing liked videos
        if (
          likedTab &&
          likedTab.getAttribute("aria-selected") === "true" &&
          !AppState.filters.likedVideos
        ) {
          startLikesPolling();
        } else {
          AppState.filters.likedVideos = false;
          removeDocumentClickListener();
        }
        showDownloader();
      } catch (error) {
        console.warn("Error in page change poll", error);
      }
    }
  }, 1000);
};

function getCurrentPageUsername() {
  return document.location.pathname.split("/")[1].split("@")[1] || "😃";
}
function downloadURLToDisk(url, filename) {
  AppState.downloading.isActive = true;
  displayFoundUrls({ forced: true });
  // if (filename === ".mp4") {
  //   filename = getCurrentPageUsername() + "-video.mp4";
  // }

  return new Promise((resolve, reject) => {
    fetch(url, { credentials: "include" }) // Ensure cookies are sent with the request
      .then((response) => {
        AppState.downloading.isActive = false;
        displayFoundUrls({ forced: true });

        if (!response.ok) {
          throw new Error(`Failed to fetch the file: ${response.statusText}`);
        }
        return response.blob(); // Get the file as a Blob
      })
      .then((blob) => {
        if (blob.size === 0) {
          throw new Error("The downloaded file is empty.");
        }

        // Create a temporary object URL for the Blob
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = filename;
        document.body.appendChild(a);

        // Trigger the download
        a.click();

        // Clean up the object URL and the link element
        window.URL.revokeObjectURL(downloadUrl);
        document.body.removeChild(a);
        showRateUsPopUp();
        resolve();
      })
      .catch((error) => {
        console.warn("ETTPD downloadURLToDiskiFrameMethod failed:", error);
        AppState.downloading.isActive = false;
        displayFoundUrls({ forced: true });
        downloadURLToDiskiFrameMethod(url, filename)
          .then(() => {
            resolve();
          })
          .catch((iframeError) => {
            console.warn(
              "ETTPD downloadURLToDiskiFrameMethod failed:",
              iframeError
            );
            downloadURLToDiskAnchorMethod(url, filename);
            resolve();
          });
        // Fallback to iframe method if fetch fails
        reject(error);
      });
  });
}

function downloadURLToDiskiFrameMethod(url, filename) {
  console.warn("downloadURLToDiskiFrameMethod");

  // If URL starts with blob alert
  if (url.startsWith("blob:")) {
    alert(
      "Blob URLs cannot be downloaded directly. Please use the download button on the video."
    );
    return Promise.reject(
      new Error("Blob URLs cannot be downloaded directly.")
    );
  }

  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = url;

    // Append iframe
    document.body.appendChild(iframe);

    let didResolve = false;

    // Success handler
    iframe.onload = () => {
      if (didResolve) return;
      didResolve = true;
      clearTimeout(timeout);
      document.body.removeChild(iframe);
      console.log("Iframe load succeeded (possibly downloaded)");
      resolve();
    };

    // Timeout fallback for silent failures (like CSP)
    const timeout = setTimeout(() => {
      if (didResolve) return;
      didResolve = true;
      try {
        document.body.removeChild(iframe);
      } catch (e) {}
      reject(
        new Error("Iframe download attempt failed — likely CSP blocked it.")
      );
    }, 3000);
  });
}

function downloadURLToDiskAnchorMethod(url, filename) {
  console.warn("downloadURLToDiskAnchorMethod");

  const a = document.createElement("a");
  a.href = url;
  a.setAttribute("download", filename || "download");
  document.body.appendChild(a);
  if (
    confirm("This download method may change the page. Do you want to proceed?")
  ) {
    a.click();
  } else {
    // Fallback to open in new tab
    downloadURLToDiskOpenNewTabMethod(url, filename);
  }
  document.body.removeChild(a);
  showRateUsPopUp();
}
function downloadURLToDiskOpenNewTabMethod(url, filename = "photo.jpg") {
  console.warn("downloadURLToDiskOpenNewTabMethod");
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank"; // fallback to open if blocked
  a.download = filename;
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function getPostsHash(items) {
  return items?.map((item) => item.id).join("");
}

function getSrcById(id) {
  try {
    for (const key in AppState.postItems) {
      const item = AppState.postItems[key].find((item) => item.id == id);
      if (
        item &&
        item.video &&
        item.video.playAddr &&
        item.video.playAddr.startsWith("http")
      ) {
        return item.video.playAddr;
      }
    }
  } catch (error) {
    console.warn("Error in getting src by id (AppState)", error);
  }

  try {
    const defaultScope = window?.__$UNIVERSAL_DATA$__?.__DEFAULT_SCOPE__;
    const videoDetail = defaultScope?.["webapp.video-detail"];
    const videoItem = videoDetail?.itemInfo?.itemStruct;
    if (videoItem?.id == id) {
      return videoItem.video.playAddr;
    }
  } catch (error) {
    console.warn("Error in getting src by id (UNIVERSAL_DATA)", error);
  }

  try {
    const video = window?.MultiMediaPreloader?.preloader?.video;
    const offsetParent = video?.offsetParent;
    if (offsetParent) {
      const fiberKey = Object.keys(offsetParent).find((k) =>
        k.startsWith("__reactFiber$")
      );
      const fiberNode = offsetParent[fiberKey];
      const fiberItem = fiberNode?.child?.pendingProps;
      console.log("Fiber Item:", fiberItem?.id, id);
      // Check if the fiber

      if (fiberItem?.id == id && fiberItem && fiberItem.url) {
        return fiberItem.url;
      } else {
        console.warn(
          "reactFiber No valid video source found in fiber item",
          fiberItem.id,
          id,
          fiberItem,
          fiberItem.url
        );
      }
    }
  } catch (error) {
    console.warn("reactFiber Error in getting src by id (React Fiber)", error);
  }
  console.warn("reactFiber No valid video source found for ID:", id);
  return null;
}

function getLikedTab() {
  // Find the "Liked" tab by searching for its text content
  const tabs = document.querySelectorAll('p[role="tab"]'); // Select all tab elements
  let likedTab = null;

  tabs.forEach((tab) => {
    if (tab.textContent.trim() === "Liked") {
      likedTab = tab;
    }
  });

  return likedTab;
}

function startLikesPolling() {
  addDocumentClickListener();
  setTimeout(() => {
    AppState.filters.likedVideos = true;
  }, 100);

  // Find the "Liked" tab by searching for its text content
  const tabs = document.querySelectorAll('p[role="tab"]'); // Select all tab elements
  let likedTab = getLikedTab();

  if (likedTab) {
    likedTab.click(); // Trigger a click on the "Liked" tab
  }
}

function addDocumentClickListener() {
  document.addEventListener("click", (e) => {
    // if e is from the liked tab, do nothing
    if (e.target.textContent.trim() === "Liked") {
      return;
    }
    // if e is from the download button, do nothing
    if (e.target.classList.contains("download-all-btn")) {
      return;
    }
    // If AppState.filters.likedVideos is true, the user is viewing liked videos
    if (AppState.filters.likedVideos) {
      alert(
        "Just scroll down to load more liked videos. The downloader will automatically fetch them for you! Clicking anywhere resets the filter."
      );
      AppState.filters.likedVideos = false;
    }
    removeDocumentClickListener();
  });
}

function removeDocumentClickListener() {
  document.removeEventListener("click", () => {});
}

setInterval(() => {
  try {
    AppState.isLoggedIn =
      !!window.__$UNIVERSAL_DATA$__?.__DEFAULT_SCOPE__?.["webapp.app-context"]
        .user.uniqueId;
  } catch (error) {
    console.warn("Is logged in: ", AppState.isLoggedIn);
  }
  // Find all divs where the ID starts with "xgwrapper"
  const videoWrappers = document.querySelectorAll('div[id^="xgwrapper"]');
  // Strategy 1: FYP
  // Iterate through each wrapper to process the video elements
  videoWrappers.forEach((wrapper, idx) => {
    // Check if the download button already exists
    if (
      document.querySelector(
        `button.download-btn[data-wrapper-id="${wrapper.id}"]`
      )
    ) {
      return; // Skip if the button is already present
    }

    // Extract the video ID from the wrapper's ID
    const wrapperId = wrapper.id;
    const videoIdMatch = wrapperId.match(/xgwrapper-\d+-(\d+)/);
    const videoId = videoIdMatch ? videoIdMatch[1] : null;

    if (videoId) {
      // Locate the video element inside the wrapper
      const videoElement = wrapper.querySelector("video");

      if (videoElement) {
        // Create a download button
        const downloadButtonContainer = document.createElement("div");
        // clean up the container before adding a new one
        cleansOutDownloadBtnContainers();
        downloadButtonContainer.className = "download-btn-container";
        const downloadButton = document.createElement("button");
        downloadButton.textContent = "Download Video";
        downloadButton.className = "download-btn";
        downloadButton.dataset.wrapperId = wrapper.id;

        // Attach click event for downloading the video
        downloadButton.addEventListener("click", (e) => {
          e.stopPropagation();
          const videoSrc =
            getSrcById(videoId) ||
            videoElement.querySelector("source")?.src ||
            videoElement.src;

          if (videoSrc && videoSrc.startsWith("http")) {
            downloadURLToDisk(
              videoSrc,
              `tiktok-${
                getAuthorUsernameFrom(videoElement) || "username"
              }-${videoId}.mp4`
            ).catch((error) => {
              console.warn("Catch downloadURLToDisk video:", error);
              alert("Failed to download the video. Please try again.");
            });
          } else {
            console.warn("No valid video source found for download.");
            alert("No valid video source found for download.", videoId);
          }
        });
        // Attach download video button.

        // MAIN LOGIC
        console.log("ttkdebugger: Start locating currently playing article...");
        const playingArticle = getCurrentPlayingArticle();
        if (!playingArticle || !playingArticle.contains(wrapper)) {
          console.warn("ttkdebugger: No playing video detected. Exiting.");
          return;
        }

        console.log("ttkdebugger: Found playing article:", playingArticle);

        const videoElement =
          playingArticle.querySelector("video") ||
          playingArticle.querySelector("canvas") ||
          playingArticle.querySelector(".xgplayer-container");

        if (!videoElement) {
          console.warn(
            "ttkdebugger: No video/canvas/container found inside article."
          );
          return;
        }

        console.log("ttkdebugger: Found video element:", videoElement);

        // Remove any existing download buttons
        document
          .querySelectorAll("div.download-btn-container")
          .forEach((btn) => {
            console.log("ttkdebugger: Removing existing download button:", btn);
            btn.remove();
          });

        // Append your download button (assume it's already defined)
        console.log("ttkdebugger: Appending new download button...");
        downloadButtonContainer.appendChild(downloadButton);

        // Traverse upward to find anchor or section
        let currentElement = videoElement;
        let anchor = videoElement;
        let section = null;

        // console.log("ttkdebugger: Searching upward for <a> tag...");
        // while (currentElement) {
        //   if (currentElement.tagName === "A") {
        //     anchor = currentElement;
        //     console.log("ttkdebugger: Found <a> tag:", anchor);
        //     break;
        //   }
        //   currentElement = currentElement.parentElement;
        // }

        // // Reset and search for <section>
        // currentElement = videoElement;
        // console.log("ttkdebugger: Searching upward for <section> tag...");
        // while (currentElement) {
        //   if (currentElement.tagName === "SECTION") {
        //     section = currentElement;
        //     console.log("ttkdebugger: Found <section> tag:", section);
        //     break;
        //   }
        //   currentElement = currentElement.parentElement;
        // }

        // Attach button based on context
        if (anchor) {
          console.log("ttkdebugger: Attaching to anchor's parent");
          downloadButtonContainer.style.zIndex = "1000";
          anchor.parentElement?.appendChild(downloadButtonContainer);
        } else if (section) {
          console.log("ttkdebugger: Attaching to section's parent");
          downloadButtonContainer.style.zIndex = "10";
          section.parentElement?.appendChild(downloadButtonContainer);
        } else {
          console.log("ttkdebugger: Attaching to article fallback");
          downloadButtonContainer.style.zIndex = "20";
          playingArticle.appendChild(downloadButtonContainer);
        }
      }
    }
  });

  document
    .querySelectorAll('div[data-e2e="explore-item"]')
    .forEach((exploreItem) => {
      const playingVideo = exploreItem.querySelector('video[src^="blob:"]');
      if (!playingVideo) return;

      const xgWrapper = playingVideo.closest(".xgplayer-container");
      if (!xgWrapper) return;

      const anchor = exploreItem.querySelector("a[href*='/video/']");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      const match = href.match(/\/video\/(\d+)/);
      const videoId = match ? match[1] : null;
      if (!videoId) return;

      const wrapperId = `explore-${videoId}`;
      if (
        document.querySelector(
          `button.download-btn[data-wrapper-id="${wrapperId}"]`
        )
      ) {
        return; // Button already added
      }

      const username =
        exploreItem
          .closest("#column-item-video-container")
          ?.querySelector('[data-e2e="explore-card-user-unique-id"]')
          ?.textContent?.trim() || "user";

      const downloadButtonContainer = document.createElement("div");
      downloadButtonContainer.className = "download-btn-container";
      downloadButtonContainer.style.position = "absolute";
      downloadButtonContainer.style.bottom = "10px";
      downloadButtonContainer.style.right = "10px";
      downloadButtonContainer.style.zIndex = "1000";

      const downloadButton = document.createElement("button");
      downloadButton.textContent = "Download Video";
      downloadButton.className = "download-btn";
      downloadButton.dataset.wrapperId = wrapperId;

      downloadButton.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const videoSrc =
          getSrcById(videoId) ||
          playingVideo.querySelector("source")?.src ||
          playingVideo.src;

        if (videoSrc && videoSrc.startsWith("http")) {
          downloadURLToDisk(
            videoSrc,
            `tiktok-${username}-${videoId}.mp4`
          ).catch((error) => {
            console.warn("Explore download error:", error);
            alert("Failed to download video.");
          });
        } else {
          console.warn("No valid video source found.");
          alert("No valid video source found for download.");
        }
      });

      downloadButtonContainer.appendChild(downloadButton);
      xgWrapper.appendChild(downloadButtonContainer); // Attach closest to <video>
    });
}, 1000);
// ——— Utilities ———

// Find the nearest ancestor matching a predicate
function findAncestor(el, testFn) {
  while (el) {
    if (testFn(el)) return el;
    el = el.parentElement;
  }
  return null;
}

// Remove any existing download‑button overlays
function clearDownloadContainers() {
  console.log("clearing download containers");
  document
    .querySelectorAll(".photo-download-btn-container")
    .forEach((el) => el.remove());
  document
    .querySelectorAll(".download-btn-container")
    .forEach((el) => el.remove());
}

// Create and style a container for one or more buttons
function createOverlay() {
  const overlay = document.createElement("div");
  overlay.className = "photo-download-btn-container";
  Object.assign(overlay.style, {
    position: "absolute",
    top: "0",
    left: "0",
    width: "100%",
    zIndex: "9999",
    display: "flex",
    justifyContent: "center",
    gap: "8px",
    pointerEvents: "auto",
  });
  return overlay;
}

// Ensure the parent can host an absolute overlay
function ensureRelative(el) {
  const pos = window.getComputedStyle(el).position;
  if (pos === "static") el.style.position = "relative";
}

// Build a button and wire up its click
function makeButton(text, onClick) {
  const btn = document.createElement("button");
  btn.className = "download-btn";
  btn.textContent = text;
  btn.addEventListener("click", onClick);
  return btn;
}

// ——— Handlers ———

// Handles any swiper instance (incl. activeSwiper)
// Handles any swiper instance (incl. activeSwiper)
function handleSwiper(swiper) {
  // find its top‑level <section>
  let section =
    findAncestor(swiper, (el) => el.tagName === "SECTION") ||
    swiper.querySelector("div.swiper-slide.swiper-slide-active");

  console.log("section found-->: ", section);

  if (!section) return;

  // detect “photo” posts:
  // — either the link URL has “/photo/”
  // — or it’s a feed-video block (data-e2e="feed-video")
  const link = section.querySelector("a");
  const isPhotoLink = link?.href.includes("/photo/");
  const isFeedVideo = section.getAttribute("data-e2e") === "feed-video";
  if (!isPhotoLink && !isFeedVideo && section.tagName === "SECTION") return;

  // skip if already done
  if (section.querySelector(".photo-download-btn-container")) return;

  const overlay = createOverlay();
  overlay.appendChild(
    makeButton("Download Active Image", () => {
      const activeImg = swiper.querySelector(".swiper-slide-active img");
      if (activeImg?.src) downloadImage(activeImg.src);
    })
  );

  ensureRelative(section);
  section.appendChild(overlay);
}

// Handles single‑image posts
function handleSingleImage(picture) {
  const img = picture.querySelector("img");
  if (!img?.src) return;

  // find its data‑e2e="user-post-item" wrapper
  const wrapper = findAncestor(
    picture,
    (el) => el.getAttribute("data-e2e") === "user-post-item"
  );
  if (!wrapper) return;

  const link = wrapper.querySelector("a");
  if (!link?.href.includes("/photo/")) return;
  if (wrapper.querySelector(".photo-download-btn-container")) return;

  const overlay = createOverlay();
  overlay.appendChild(
    makeButton("Download Image", () => {
      downloadImage(img.src);
    })
  );

  ensureRelative(wrapper);
  wrapper.appendChild(overlay);
}

// ——— Main Loop ———
// 1) your scan routine
function scanAndInject() {
  // clear any old buttons

  // handle swipers (including activeSwiper)
  const swipers = Array.from(document.querySelectorAll("div.swiper"));
  const activeSwiper = document.querySelector("div.swiper.swiper-initialized");
  if (
    /^\/@[^\/]+\/(photo|video)\/[A-Za-z0-9]+$/.test(window.location.pathname) &&
    activeSwiper
  ) {
    console.log("activeSwiper---> Cleaning out download button containers");
    clearDownloadContainers();
    // if the path is a photo or video detail page, clear the swipers array
    // clear the swipers array and replace it with the activeSwiper
    swipers.length = 0;
    swipers.push(activeSwiper);
  }
  console.log("swipers: ", swipers);
  swipers.forEach(handleSwiper);

  // handle single images
  if (!activeSwiper)
    document.querySelectorAll("picture").forEach(handleSingleImage);
}

// 2) patch history to emit a 'locationchange' event
(function () {
  const _push = history.pushState;
  const _replace = history.replaceState;

  history.pushState = function () {
    _push.apply(this, arguments);
    window.dispatchEvent(new Event("locationchange"));
  };
  history.replaceState = function () {
    _replace.apply(this, arguments);
    window.dispatchEvent(new Event("locationchange"));
  };

  // fire on back/forward
  window.addEventListener("popstate", () => {
    window.dispatchEvent(new Event("locationchange"));
  });
})();

// 3) when the path changes, rerun your scan
window.addEventListener("locationchange", () => {
  scanAndInject();
});

// 4) still run once on load (and you can keep the interval if you want fallback)
scanAndInject();
setInterval(scanAndInject, 1000);

async function downloadImage(url, filename = "photo.jpg") {
  const attempts = [
    async function downloadURLToDiskAttempt() {
      await downloadURLToDisk(url, filename);
    },
    // function downloadURLToDiskAnchorMethodAttempt() {
    //   downloadURLToDiskAnchorMethod(url, filename);
    // },
    // async function downloadURLToDiskiFrameMethodAttempt() {
    //   await downloadURLToDiskiFrameMethod(url, filename);
    // },
    function downloadURLToDiskOpenNewTabMethodAttempt() {
      alert(
        "The image will open in a new tab. Right click and save the image."
      );
      downloadURLToDiskOpenNewTabMethod(url, filename);
    },
  ];

  for (let attempt of attempts) {
    try {
      console.log(`Attempting download using: ${attempt.name}`);
      await attempt();
      console.log(`Success with: ${attempt.name}`);
      break;
    } catch (error) {
      console.warn(`Failed (${attempt.name}): ${error?.message || error}`);
    }
  }
}

function cleansOutDownloadBtnContainers() {
  console.log("Cleaning out download button containers");
  const path = window.location.pathname;
  // Match only TikTok photo or video detail pages:
  //   /@username/photo/<id>
  //   /@username/video/<id>
  if (!/^\/@[^\/]+\/(photo|video)\/[A-Za-z0-9]+$/.test(path)) {
    console.log("Not a photo or video detail page. Skipping cleanup.");
    return;
  }
  // 1) REMOVE any existing download‐button containers
  document
    .querySelectorAll(".photo-download-btn-container, .download-btn-container")
    .forEach((el) => el.remove());
  console.log("Removed old download button containers");
}

function getAuthorUsernameFrom(startElement) {
  function deepFindAnchorWithUsername(el) {
    if (
      el.tagName === "A" &&
      el.className.includes("StyledAuthorAnchor") &&
      el.getAttribute("href")?.startsWith("/@")
    ) {
      const match = el.getAttribute("href").match(/^\/@([\w.-]+)$/);
      return match ? match[1] : null;
    }

    for (const child of el.children) {
      const result = deepFindAnchorWithUsername(child);
      if (result) return result;
    }

    return null;
  }

  let current = startElement;
  while (current) {
    const found = deepFindAnchorWithUsername(current);
    if (found) return found;
    current = current.parentElement;
  }

  return null;
}

function getCurrentPlayingArticle() {
  console.log("ttkdebugger: Looking for video with non-zero progress...");
  const progressBar = document.querySelector(
    'div[role="slider"][aria-valuenow]:not([aria-valuenow="0"])'
  );
  if (progressBar) {
    console.log("ttkdebugger: Found progressBar with value > 0");
    return progressBar.closest("article");
  }

  console.log("ttkdebugger: Trying to find active <video> element...");
  const playingVideo = document.querySelector('video[src^="blob:"]');
  if (playingVideo) {
    console.log("ttkdebugger: Found <video> with blob src");
    return playingVideo.closest("article");
  }

  console.log("ttkdebugger: Checking for unmuted video sound button...");
  const unmuted = document.querySelector(
    'div[data-e2e="video-sound"][aria-pressed="true"]'
  );
  if (unmuted) {
    console.log("ttkdebugger: Found unmuted video (aria-pressed=true)");
    return unmuted.closest("article");
  }

  console.warn("ttkdebugger: No playing article found");
  return null;
}
