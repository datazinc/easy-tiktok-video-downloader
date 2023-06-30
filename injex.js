let postItems = {};
let allDirectLinks = [];
let isFirstTime = true;
let displayedItemsId = {};
let filterVideosState = "INIT";
let downloadedURLs = [];
let hasRated = localStorage.getItem("hasRated") == "true";

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
    try {
      return send.apply(this, arguments);
    } catch (error) {
      console.warn("Wrapper xhr error: ", error);
    }
  };
})();

function displayFoundUrls() {
  // reset all direct links
  allDirectLinks = [];
  let items = postItems[getCurrentPageUsername()];
  const _id = "ttk-downloader-wrapper";

  if (!items || !items?.length) items = [];
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
  allLinksTextArea.style.height = "100px";
  allLinksTextArea.className = "ettpd-ta";
  let currentVideoBtn = document.createElement("button");
  currentVideoBtn.classList = "ettpd-current-video-btn ettpd-btn";
  creditsText.innerHTML = `&copy; ${new Date().getFullYear()} - Made by DataZinc💛`;
  creditsText.onclick = hideDownloader;
  downloadAllLinksBtn.addEventListener("click", () =>
    downloadAllLinks(downloadAllLinksBtn)
  );

  allLinksTextArea.addEventListener("click", () => {
    allLinksTextArea.value = allDirectLinks.map((link) => link[0]).join("\n");
    allLinksTextArea.select();
    document.execCommand("copy");
    allLinksTextArea.setSelectionRange(0, 0);
    allLinksTextArea.select();
    alert("Links copied to clipboard! Make sure you are logged out!!! Copied links will not work in downloaders if you are logged in. Use the download button instead.");
    allLinksTextArea.value = "The copied links do not work in downloaders due to recent TikTok API changes. Use the download button instead.";
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

  downloadAllLinksBtn.innerText = allDirectLinks?.length ? `Download All ${allDirectLinks.length} Links: ${getCurrentPageUsername()}` : "Refresh Page";

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
  allLinksTextArea.value = allDirectLinks?.length ? "Please use this feature while logged out. Copying links will not work if you are logged in. Use the download button instead. (Click here to copy all links)": "No videos found. Refresh page to try again. FYP does not work instantly, please scroll down to get some downloadable content.";
  if (document.location.pathname.split("/").length == 4) {
    currentVideoBtn.innerText = "Download Current Page Video!";
    let currentVideo = postItems[getCurrentPageUsername()].find(
      (item) => item.id == document.location.pathname.split("/")[3]
    );

    let currentVideoLink = document.createElement("span");
    currentVideoLink.onclick = () => {
      downloadURLToDisk(currentVideo?.video?.playAddr, currentVideo?.desc?.replace(/ /g, `-`).slice(0, 20) + ".mp4");
      setTimeout(() => {
        showRateUsPopUp();
      }, 1000);
    }

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
  // reload page if allDirectLinks is empty
  if (!allDirectLinks?.length) {
    window.location.reload();
    return;
  }

  for (let index = 0; index < allDirectLinks?.length; index++) {
    if (downloadedURLs.includes(allDirectLinks?.at(index)?.at(0))) continue;
    downloadedURLs.push(allDirectLinks?.at(index)?.at(0));
    await downloadURLToDisk(allDirectLinks?.at(index)?.at(0), `${allDirectLinks?.at(index)?.at(2)}-video-${index + 1}-${allDirectLinks?.at(index)?.at(1).replace(/ /g, `-`).slice(0, 20)}.mp4`);
    mainBtn.innerHTML = `Downloading  ${index + 1} of ${allDirectLinks?.length || 0}`;
  }
  mainBtn.innerHTML = `Downloaded ${allDirectLinks?.length || 0} Videos!`;
  // redirect to chrome web store
  showRateUsPopUp();
}

function showRateUsPopUp() {
  if (hasRated) return;
  // show the rating popup
  const div = document.createElement("div");
  div.style.position = "fixed";
  div.style.top = "0";
  div.style.left = "0";
  div.style.width = "100%";
  div.style.height = "100%";
  div.style.zIndex = "999"
  div.style.backgroundColor = "rgba(0,0,0,0.5)";
  div.innerHTML = `<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 400px; height: 400px; background-color: white; border-radius: 10px; padding: 20px; box-sizing: border-box;">
      <p>Disable ad-blockers if download fails & refresh. <br/><br/></p><h3>Please give us 5 stars on chrome web store!</h3>
      <h style="margin-bottom: 20px">Check the downloaded videos in your device files and rate us. It will help us a lot!🥰<br/><br/></p>
      <p>The problem with IDM and similar downloaders occurs when you're logged in. So, use this extension while logged out. Link copying won't function if you're signed in; instead, use the download button.</p>
      <p>Thank you for using our extension!</p>
      <a href="https://chrome.google.com/webstore/detail/easy-tiktok-video-downloa/fclobfmgolhdcfcmpbjahiiifilhamcg" target="_blank" style="text-decoration: none; color: white; background-color: #1da1f2; padding: 10px; border-radius: 5px; border: none; cursor: pointer; width: 100%; text-align: center; display: block; margin-top: 30px">Rate Now</a>
      <span style="margin-top: 10px; display: block; color: red; text-decoration: underline; text-align: center; cursor: pointer;">Stop Seing This Notice</span>
      `;
  const span = div.querySelector("span");
  span.onclick = () => {
    hasRatedTrue();
  }
  document.body.appendChild(div);
  function hasRatedTrue() {
    localStorage.setItem("hasRated", true);
    hasRated = true;
  }
  div.onclick = () => {
    div.remove();
  }
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
  };
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
        getCurrentPageUsername() || getCurrentPageUsername().startsWith("/")
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
  const response = await browserFetch(...args).catch((err) => {
    console.warn("Wrapper fetch error: : ", err);
  });
  response?.clone()
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
  displayFoundUrls();

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
  let potentialUsername = document.location.pathname.split("/")[1].split("@");
  if (potentialUsername.length > 1) {
    return potentialUsername[1];
  }
  return `/${potentialUsername[0]}`;
}

function downloadURLToDisk(url, filename) {
  if (filename == '.mp4') {
    filename = getCurrentPageUsername() + '-video.mp4'
  }
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