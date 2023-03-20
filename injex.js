let postItems = {};
let allDirectLinks = [];
let isFirstTime = true;
let displayedItemsId = {};
let filterVideosState = "INIT";
let downloadedURLs = [];
(function () {
  var XHR = XMLHttpRequest.prototype;
  var open = XHR.open;
  var send = XHR.send;
  XHR.open = function (method, url) {
    this._method = method;
    this._url = url;
    return open.apply(this, arguments);
  };
  // Listen to traffic
  XHR.send = function (postData) {
    this.addEventListener("load", function () {
      let data = {};
      try {
        if (this.responseType === "" || this.responseType === "text")
          data = JSON.parse(this.responseText);
      } catch (error) { }
      if (data.itemList) {
        handleFoundItems(data.itemList);
      }
    });
    return send.apply(this, arguments);
  };
})();

function displayFoundUrls() {
  // reset all direct links
  allDirectLinks = [];
  let items = postItems[getCurrentPageUsername()];
  const _id = "ttk-downloader-wrapper";

  if (!items || !items?.length) return;
  document.getElementById(_id)?.remove();
  let wrapper = document.createElement("div");
  wrapper.className = "ettpd-wrapper";
  let downloadAllLinksBtn = document.createElement("button");
  downloadAllLinksBtn.className = "ettpd-btn";
  let reportBugBtn = document.createElement("button");
  reportBugBtn.className = "ettpd-btn";
  let creditsText = document.createElement("span");
  creditsText.className = "ettpd-span";
  let allLinksTextArea = document.createElement("textarea");
  allLinksTextArea.className = "ettpd-ta";
  let currentVideoBtn = document.createElement("button");
  currentVideoBtn.classList = "ettpd-current-video-btn ettpd-btn";
  creditsText.innerHTML = `&copy; ${new Date().getFullYear()} - Made by DataZinc💛`;
  creditsText.onclick = hideDownloader;
  downloadAllLinksBtn.addEventListener("click", () =>
    downloadAllLinks(downloadAllLinksBtn)
  );

  allLinksTextArea.addEventListener("click", () => {
    allLinksTextArea.select();
    document.execCommand("copy");
    allLinksTextArea.setSelectionRange(0, 0);
    allLinksTextArea.select();
    alert("Copied to clipboard!");
  });

  wrapper.id = _id;
  let itemsList = document.createElement("ol");
  let idx = 1;
  items.forEach((media) => {
    let item = document.createElement("li");
    let anc = document.createElement("a");
    anc.className = "ettpd-a";
    anc.target = "_blank";
    anc.innerText = `Video ${idx}`;
    if (media?.desc) anc.innerText += ` : ${media?.desc}`;
    anc.href = media?.video?.playAddr;
    allDirectLinks.push([anc.href, media?.desc, getCurrentPageUsername()]);
    item.appendChild(anc);
    itemsList.appendChild(item);
    idx++;
  });

  downloadAllLinksBtn.innerText = `Download All ${allDirectLinks?.length || 0
    } Links: ${getCurrentPageUsername()}`;

  downloadAllLinksBtn.innerText += filterVideosState.startsWith("LIKES")
    ? " likes"
    : "";

  reportBugBtn.innerText = "Report Bugs (Refreshing fix most bugs :| )";
  let reportBugBtnLink = document.createElement("a");
  reportBugBtnLink.target = "_blank";
  reportBugBtnLink.href = "https://bit.ly/ettpd-issues";
  reportBugBtnLink.appendChild(reportBugBtn);

  let likedVideosOnlyBtn = document.createElement("button");
  likedVideosOnlyBtn.id = "ettpd-liked-only";
  likedVideosOnlyBtn.onclick = () =>
    toggleShowLikedVideosOnly(likedVideosOnlyBtn);
  likedVideosOnlyBtn.innerText = filterVideosState.startsWith("LIKES")
    ? "Showing Liked Videos (click to undo)"
    : "Filter Liked Videos (First click on liked videos)";

  wrapper.appendChild(itemsList);

  document.body.appendChild(wrapper);
  allLinksTextArea.value = allDirectLinks.map((link) => link[0]).join("\n");
  if (document.location.pathname.split("/").length == 4) {
    currentVideoBtn.innerText = "Download Current Page Video!";
    let currentVideo = postItems[getCurrentPageUsername()].find(
      (item) => item.id == document.location.pathname.split("/")[3]
    );

    let currentVideoLink = document.createElement("span");
    currentVideoLink.onclick = () => downloadURLToDisk(currentVideo?.video?.playAddr, currentVideo?.desc?.replace(/ /g, `-`) + ".mp4");
    currentVideoLink.appendChild(currentVideoBtn);
    if (currentVideo) wrapper.prepend(currentVideoLink);
  }
  // Only show the filter toggle if logged in user is the current page user
  if (
    window.SIGI_STATE.AppContext.appContext.user?.uniqueId ==
    getCurrentPageUsername()
  ) {
    wrapper.prepend(likedVideosOnlyBtn);
  }
  wrapper.prepend(reportBugBtnLink);
  wrapper.prepend(allLinksTextArea);
  wrapper.prepend(downloadAllLinksBtn);
  wrapper.append(creditsText);
  let closeButton = document.createElement("button");
  closeButton.id = "ettpd-close";
  closeButton.onclick = hideDownloader;
  closeButton.innerText = "X";
  wrapper.prepend(closeButton);
}

function hideDownloader() {
  document.getElementById("ttk-downloader-wrapper")?.remove();
  let showDownloaderBtn = document.createElement("button");
  showDownloaderBtn.id = "ettpd-show";
  showDownloaderBtn.innerText = "Show Download Links";
  showDownloaderBtn.onclick = showDownloader;
  document.body.appendChild(showDownloaderBtn);
}

function showDownloader() {
  displayFoundUrls();
  document.getElementById("ettpd-show")?.remove();
}

function pollInitialData() {
  const loggedInDataItems = getLoggedInInitialData();
  if (loggedInDataItems.length) handleFoundItems(loggedInDataItems);
  const loggedOutDataItems = getLoggedOutInitialData();
  if (loggedOutDataItems.length) handleFoundItems(loggedOutDataItems);
  setTimeout(() => {
    pollInitialData();
  }, 3000);
}

async function downloadAllLinks(mainBtn) {
  for (let index = 0; index < allDirectLinks?.length; index++) {
    if (downloadedURLs.includes(allDirectLinks?.at(index)?.at(0))) continue;
    downloadedURLs.push(allDirectLinks?.at(index)?.at(0));
    await downloadURLToDisk(allDirectLinks?.at(index)?.at(0), `${allDirectLinks?.at(index)?.at(2)}-video-${index + 1}-${allDirectLinks?.at(index)?.at(1).replace(/ /g, `-`)}.mp4`);
    mainBtn.innerHTML = `Downloading  ${index + 1} of ${allDirectLinks?.length || 0}`;
  }
  mainBtn.innerHTML = `Downloaded ${allDirectLinks?.length || 0} Videos!`;
}

function handleFoundItems(newItems) {
  if (!postItems[getCurrentPageUsername()])
    postItems[getCurrentPageUsername()] = [];
  let nonDuplicateItems = generateNonDuplicateItems(
    postItems[getCurrentPageUsername()],
    newItems
  );
  if (nonDuplicateItems && nonDuplicateItems.length) {
    if (filterVideosState.startsWith("LIKES")) {
      nonDuplicateItems = nonDuplicateItems.filter(
        (post) =>
          post?.author != getCurrentPageUsername() &&
          post?.author?.uniqueId != getCurrentPageUsername()
      );
      postItems[getCurrentPageUsername()] = nonDuplicateItems;
    } else if (filterVideosState.startsWith("ALL")) {
      nonDuplicateItems = nonDuplicateItems.filter(
        (post) =>
          post?.author == getCurrentPageUsername() ||
          post?.author?.uniqueId == getCurrentPageUsername()
      );
      postItems[getCurrentPageUsername()] = nonDuplicateItems;
    }

    // fail safe
    if (nonDuplicateItems.length)
      postItems[getCurrentPageUsername()] = nonDuplicateItems;
  }
  if (nonDuplicateItems.length)
    postItems[getCurrentPageUsername()] = nonDuplicateItems;

  // Should be done after updating the postItems
  if (!filterVideosState.endsWith("UPDATED") && filterVideosState != "INIT") {
    displayFoundUrls();
    filterVideosState += "_UPDATED";
  }
  let currentPathContentId = document.location.pathname;

  postItems[getCurrentPageUsername()].forEach(
    (item) => (currentPathContentId += item.id)
  );
  if (displayedItemsId[getCurrentPageUsername()] != currentPathContentId) {
    displayedItemsId[getCurrentPageUsername()] = currentPathContentId;
    displayFoundUrls();
  }
}

function generateNonDuplicateItems(nonDuplicateItems, newItems) {
  if (!Array.isArray(nonDuplicateItems))
    throw Error("nonDuplicateItems must be an array");
  if (!newItems || !newItems.length) {
    return [];
  }
  newItems.forEach((item) => {
    if (
      nonDuplicateItems.findIndex((nonDupItem) => nonDupItem.id == item.id) < 0
    ) {
      if (
        getCurrentPageUsername() == item?.author ||
        getCurrentPageUsername() == item?.author?.uniqueId ||
        window.SIGI_STATE.AppContext.appContext.user?.uniqueId ==
        getCurrentPageUsername()
      ) {
        nonDuplicateItems.push(item);
      }
    }
  });
  return nonDuplicateItems;
}

function toggleShowLikedVideosOnly(btnElement) {
  // tricky tricks - set it to LIKES if it's set on ALL or INIT, set to to ALL, if it's set on LIKES
  filterVideosState =
    filterVideosState != "INIT"
      ? filterVideosState.startsWith("LIKES")
        ? "ALL"
        : "LIKES"
      : "LIKES";

  btnElement.innerText = filterVideosState.startsWith("LIKES")
    ? "Showing Liked Videos (click to undo)"
    : "Filter Liked Videos(First click on liked videos)";
  // Refresh to show valid data;
  if (filterVideosState == "ALL") window.location.href = window.location.href;
}

// TODO: Know why the website is aborting request instead of overwriting the abort method with a dummy function.
window.AbortController.prototype.abort = () => { };

const browserFetch = window.fetch;
window.fetch = async (...args) => {
  const response = await browserFetch(...args);
  response
    .clone()
    .json()
    .then((body) => {
      if (body.itemList) {
        handleFoundItems(body.itemList);
      }
    });
  return response;
};

function getLoggedInInitialData() {
  // List of {id, url}
  let orderedItems = [];
  try {
    let preLoadedList =
      window.SIGI_STATE.ItemList["user-post"]?.preloadList || [];
    // meta data
    let preLoadedListMetadata = window.SIGI_STATE.ItemModule;

    preLoadedList.forEach((item) => {
      orderedItems.push(preLoadedListMetadata[item.id]);
    });
  } catch (error) { }
  try {
    let singleVideoId = window.SIGI_STATE.ItemList.video.list[0];
    let singleVideoMetadata = window.SIGI_STATE.ItemModule[singleVideoId];
    orderedItems.push(singleVideoMetadata);
  } catch (error) { }

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
      currentPageUsername = getCurrentPageUsername();
      allDirectLinks = [];
      const _id = "ttk-downloader-wrapper";
      document.getElementById(_id)?.remove();
      displayFoundUrls();
    }
  }, 1000);
};

function getCurrentPageUsername() {
  return document.location.pathname.split("/")[1].split("@")[1] || "😃";
}

function downloadURLToDisk(url, filename) {
  return new Promise((resolve, reject) => {
    fetch(url)
      .then(response => response.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        resolve();
      });
  });
}