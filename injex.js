let postItems = {};
let allDirectLinks = [];
let isFirstTime = true;
let displayedItemsId = {};

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
      } catch (error) {}
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
  let copyAllLinksBtn = document.createElement("button");
  copyAllLinksBtn.className = "ettpd-btn";
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
  copyAllLinksBtn.addEventListener("click", () =>
    copyAllLinks(allLinksTextArea, copyAllLinksBtn)
  );

  allLinksTextArea.addEventListener("click", () =>
    copyAllLinks(allLinksTextArea, copyAllLinksBtn)
  );
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
    allDirectLinks.push(anc.href);

    item.appendChild(anc);
    itemsList.appendChild(item);
    idx++;
  });

  copyAllLinksBtn.innerText = `Copy All ${
    allDirectLinks?.length || 0
  } Links: ${getCurrentPageUsername()}`;

  reportBugBtn.innerText = "Report Bugs";
  let reportBugBtnLink = document.createElement("a");
  reportBugBtnLink.target = "_blank";
  reportBugBtnLink.href = "https://bit.ly/ettpd-issues";
  reportBugBtnLink.appendChild(reportBugBtn);
  wrapper.appendChild(itemsList);

  document.body.appendChild(wrapper);
  allLinksTextArea.value = allDirectLinks.join(" \n");
  if (document.location.pathname.split("/").length == 4) {
    currentVideoBtn.innerText = "Download Current Page Video!";
    let currentVideo = postItems[getCurrentPageUsername()].find(
      (item) => item.id == document.location.pathname.split("/")[3]
    );

    let currentVideoLink = document.createElement("a");
    currentVideoLink.target = "_blank";
    currentVideoLink.href = currentVideo?.video?.playAddr;
    currentVideoLink.download =
      getCurrentPageUsername() + currentVideo?.id + ".mp4";
    currentVideoLink.appendChild(currentVideoBtn);
    if (currentVideo) wrapper.prepend(currentVideoLink);
  }
  wrapper.prepend(reportBugBtnLink);
  wrapper.prepend(allLinksTextArea);
  wrapper.prepend(copyAllLinksBtn);
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

function copyAllLinks(inputElement, mainBtn) {
  inputElement.select();
  document.execCommand("copy");
  inputElement.setSelectionRange(0, 0);
  inputElement.select();
  mainBtn.innerText = "All Links Copied!";
  setTimeout(() => {
    mainBtn.innerText = "Copy All Links";
  }, 3000);
}

function handleFoundItems(newItems) {
  if (!postItems[getCurrentPageUsername()])
    postItems[getCurrentPageUsername()] = [];
  let nonDuplicateItems = generateNonDuplicateItems(
    postItems[getCurrentPageUsername()],
    newItems
  );
  if (nonDuplicateItems.length)
    postItems[`/@${nonDuplicateItems[0].author}`] = nonDuplicateItems;

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
        getCurrentPageUsername() == item?.author?.uniqueId
      ) {
        nonDuplicateItems.push(item);
      }
    }
  });
  return nonDuplicateItems;
}

// TODO: Know why the website is aborting request instead of overwriting the abort method with a dummy function.
window.AbortController.prototype.abort = () => {};

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
  } catch (error) {}
  try {
    let singleVideoId = window.SIGI_STATE.ItemList.video.list[0];
    let singleVideoMetadata = window.SIGI_STATE.ItemModule[singleVideoId];
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
      currentPageUsername = getCurrentPageUsername();
      allDirectLinks = [];
      const _id = "ttk-downloader-wrapper";
      document.getElementById(_id)?.remove();
      displayFoundUrls();
    }
  }, 1000);
};

function getCurrentPageUsername() {
  return document.location.pathname.split("/")[1].split("@")[1];
}
