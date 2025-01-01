let postItems = {};
let allDirectLinks = [];
let isFirstTime = true;
let displayedItemsId = {};
let filterVideosState = "INIT";
let downloadedURLs = [];
// let hasRated = localStorage.getItem("hasRated") == "true";
let hasRated = false;
let isRateUsPopUpOpen = false;
// load value from local storage

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
    alert(
      "Copied to clipboard! Will not work in downloaders due to recent TikTok API changes."
    );
  });

  wrapper.id = _id;
  let itemsList = document.createElement("ol");
  itemsList.className = "ettpd-ol";
  let idx = 1;
  items.forEach((media, idx) => {
    let item = document.createElement("li");
    let anc = document.createElement("a");
    let downloadBtn = document.createElement("button");

    // Anchor element
    anc.className = "ettpd-a";
    anc.target = "_blank";
    anc.innerText = `Video ${idx + 1}`;
    if (media?.desc) anc.innerText += ` : ${media?.desc}`;
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
    downloadBtn.addEventListener("click", () => {
      const filename = `${getCurrentPageUsername()}-video-${idx + 1}.mp4`;
      downloadURLToDisk(media?.video?.playAddr, filename);
    });

    // Append elements
    item.appendChild(anc);
    item.appendChild(downloadBtn);
    itemsList.appendChild(item);

    // Push direct links to array
    allDirectLinks.push([anc.href, media?.desc, getCurrentPageUsername()]);
  });

  downloadAllLinksBtn.innerText = `Download All ${
    allDirectLinks?.length || 0
  } Links: ${getCurrentPageUsername()}`;

  downloadAllLinksBtn.innerText += filterVideosState.startsWith("LIKES")
    ? " likes"
    : "";

  reportBugBtn.innerText = "Report Bugs (Refreshing fix most bugs 😉)";
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
    currentVideoLink.onclick = () => {
      downloadURLToDisk(
        currentVideo?.video?.playAddr,
        currentVideo?.desc?.replace(/ /g, `-`).slice(0, 20) + ".mp4"
      );
    };

    currentVideoLink.appendChild(currentVideoBtn);
    if (currentVideo) wrapper.prepend(currentVideoLink);
  }
  // Only show the filter toggle if logged in user is the current page user
  if (
    window.SIGI_STATE &&
    window.SIGI_STATE?.AppContext.appContext.user?.uniqueId ==
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
    await downloadURLToDisk(
      allDirectLinks?.at(index)?.at(0),
      `${allDirectLinks?.at(index)?.at(2)}-video-${index + 1}-${allDirectLinks
        ?.at(index)
        ?.at(1)
        .replace(/ /g, `-`)
        .slice(0, 20)}.mp4`
    );
    mainBtn.innerHTML = `Downloading  ${index + 1} of ${
      allDirectLinks?.length || 0
    }`;
  }
  mainBtn.innerHTML = `Downloaded ${allDirectLinks?.length || 0} Videos!`;
  // redirect to chrome web store
  showRateUsPopUp();
}

function showRateUsPopUp() {
  if (hasRated) return;
  if (isRateUsPopUpOpen) return;
  isRateUsPopUpOpen = true;
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
    localStorage.setItem("hasRated", true);
    hasRated = true;
  }
  div.onclick = () => {
    div.remove();
  };
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
  if (
    !newItems ||
    !Array.isArray(newItems) ||
    !newItems.length ||
    !newItems[0]?.id
  ) {
    return [];
  }
  newItems.forEach((item) => {
    if (
      nonDuplicateItems.findIndex((nonDupItem) => nonDupItem?.id == item?.id) <
      0
    ) {
      if (
        getCurrentPageUsername() == item?.author ||
        getCurrentPageUsername() == item?.author?.uniqueId ||
        (window.SIGI_STATE &&
          window.SIGI_STATE?.AppContext.appContext.user?.uniqueId ==
            getCurrentPageUsername())
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
window.AbortController.prototype.abort = () => {};

const browserFetch = window.fetch;
window.fetch = async (...args) => {
  const response = await browserFetch(...args);
  response
    .clone()
    .json()
    .then((body) => {
      if (body.itemList && body.itemList.length && body.itemList[0]?.id) {
        handleFoundItems(body.itemList.filter((item) => item.id));
      }
    });
  return response;
};

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
  if (filename === ".mp4") {
    filename = getCurrentPageUsername() + "-video.mp4";
  }

  return new Promise((resolve, reject) => {
    fetch(url, { credentials: "include" }) // Ensure cookies are sent with the request
      .then((response) => {
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
        console.error("ETTPD Download failed:", error);
        alert(`Download failed`);
        reject(error);
      });
  });
}
