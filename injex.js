let postItems = {};
let allDirectLinks = [];
let isFirstTime = true;
let displayedItemsId = {};
let filterVideosState = "INIT";
let downloadedURLs = [];
let filterCurrentProfile = false;
let filterLikedVideos = false;
let filterFavoriteVideos = false;
let hasRated = localStorage.getItem("hasRated") == "true";
let displayedItemsHash = "";
let displayedPath = "";
let likedVideos = {};
let isDownloading = false;
let isDownloadingAll = false;
let isDownloaderClosed = localStorage.getItem("isDownloaderClosed") == "true";
if (hasRated) {
  hasRated = Math.random() < 0.95; // 5% chance to show the popup again even if the user has rated
}
let isRateUsPopUpOpen = false;

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

        if (data.itemList) {
          handleFoundItems(data.itemList?.filter((item) => item.id));
        }
        if (Array.isArray(data.data)) {
          handleFoundItems(
            data.data.map((entry) => entry?.item).filter((item) => item?.id)
          );
        }
      } catch (error) {
        console.warn("Low level error in XHR.send", error);
      }
    });
    return send.apply(this, arguments);
  };
})();

function displayFoundUrls({ forced } = {}) {
  if (isDownloaderClosed) return hideDownloader();
  if (isDownloading || isDownloadingAll) {
    return;
  }

  let items = [];

  if (filterCurrentProfile) {
    items = postItems[getCurrentPageUsername()] || [];
  } else if (filterLikedVideos) {
    const searchText = `Videos liked by ${getCurrentPageUsername()} are currently hidden`;
    if (!document.body.innerText.includes(searchText)) {
      items = likedVideos[getCurrentPageUsername()] || [];
    }
  } else {
    for (const key in postItems) {
      items.push(...postItems[key]);
    }
  }
  if (
    displayedItemsHash == getPostsHash(items) &&
    !forced &&
    displayedPath == document.location.pathname
  ) {
    return;
  }
  // reset all direct links

  allDirectLinks = [];
  const _id = "ttk-downloader-wrapper";
  document.getElementById(_id)?.remove();
  // Hash the displayed items
  displayedItemsHash = getPostsHash(items);
  displayedPath = document.location.pathname;
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
    isDownloadingAll = true;
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
      downloadURLToDisk(media?.video?.playAddr, filename);
    });

    // Append elements
    item.appendChild(anc);
    item.appendChild(downloadBtn);
    itemsList.appendChild(item);

    // Push direct links to array
    allDirectLinks.push({
      url: anc.href,
      desc: media?.desc,
      videoId: media?.id,
      authorId: media?.author?.uniqueId,
      currentPageUsername: getCurrentPageUsername(),
    });
  });

  if (!allDirectLinks?.length && Object.keys(postItems).length == 0) {
    // hide the downloader
    hideDownloaderOnEmpty();
  }
  downloadAllLinksBtn.innerText = `Download All ${
    allDirectLinks?.length || 0
  } videos!`;
  let subText = document.createElement("span");
  subText.style.display = "block";
  subText.innerText = " (Click to download all)";

  if (filterCurrentProfile)
    subText.innerText = ` (@${getCurrentPageUsername()})`;
  if (filterLikedVideos)
    subText.innerText = ` (Liked by ${getCurrentPageUsername()})`;
  downloadAllLinksBtn.appendChild(subText);

  if (isDownloading) {
    downloadAllLinksBtn.disabled = isDownloading;
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
    if (isDownloading) {
      currentVideoBtn.innerText = "Downloading Current Video...";
      currentVideoBtn.disabled = isDownloading;
    }
    let currentVideo = postItems[getCurrentPageUsername()]?.find(
      (item) => item.id == document.location.pathname.split("/")[3]
    );

    let currentVideoLink = document.createElement("span");
    currentVideoLink.onclick = () => {
      downloadURLToDisk(
        currentVideo?.video?.playAddr,
        `tiktok-video-${currentVideo.id}-${
          currentVideo?.desc?.replace(/ /g, `-`).slice(0, 20) || "x"
        }.mp4`
      );
    };

    currentVideoLink.appendChild(currentVideoBtn);
    if (currentVideo) wrapper.prepend(currentVideoLink);
  }
  // Only show the filter toggle if logged in user is the current page user
  try {
    if (
      window.__$UNIVERSAL_DATA$__.__DEFAULT_SCOPE__["webapp.user-detail"]
        .userInfo.user.uniqueId == getCurrentPageUsername()
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
    currentProfileOnly.checked = filterCurrentProfile;
    currentProfileOnly.type = "checkbox";
    currentProfileOnly.id = "ettpd-current-profile";
    currentProfileOnly.onclick = () => {
      filterCurrentProfile = !filterCurrentProfile;
      if (filterCurrentProfile) filterLikedVideos = false;
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
    likedVideosOnly.checked = filterLikedVideos;
    likedVideosOnly.type = "checkbox";
    likedVideosOnly.id = "ettpd-liked-only";
    likedVideosOnly.onclick = () => {
      displayFoundUrls({ forced: true });
      if (!filterLikedVideos) {
        startLikesPolling();
        filterCurrentProfile = false;
      } else {
        filterLikedVideos = false;
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
    isDownloaderClosed = true;
    localStorage.setItem("isDownloaderClosed", isDownloaderClosed);
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
    if (!allDirectLinks?.length && Object.keys(postItems).length == 0) {
      alert(
        "Could not fetch any videos to download😔... Hover over the video you want to download and click on the download button to download it."
      );
      return;
    }
    localStorage.setItem("isDownloaderClosed", false);
    isDownloaderClosed = false;
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
  isDownloadingAll = true;
  try {
    if (!allDirectLinks?.length)
      alert(
        "Could not fetch any videos to download😔... Hover over the video you want to download and click on the download button to download it."
      );
    for (let index = 0; index < allDirectLinks?.length; index++) {
      if (downloadedURLs.includes(allDirectLinks?.at(index)?.url)) continue;
      downloadedURLs.push(allDirectLinks?.at(index)?.url);
      await downloadURLToDisk(
        allDirectLinks?.at(index)?.url,
        `tiktok-video-${allDirectLinks?.at(index)?.videoId}-${
          allDirectLinks?.at(index)?.authorId ||
          allDirectLinks?.at(index)?.currentPageUsername
        }-${index + 1}-${allDirectLinks
          ?.at(index)
          ?.desc?.replace(/ /g, `-`)
          .slice(0, 20)}.mp4`
      );
      mainBtn.innerHTML = `Downloading  ${index + 1} of ${
        allDirectLinks?.length || 0
      }`;
    }
    mainBtn.innerHTML = `Downloaded ${allDirectLinks?.length || 0} Videos!`;
  } catch (error) {
    console.warn("Error in downloading all links", error);
    mainBtn.innerHTML = `Failed to download all videos!`;
  }
  setTimeout(() => {
    isDownloadingAll = false;
  }, 3000);

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
  try {
    if (!newItems || !newItems.length || !newItems[0]) newItems = [];
    let videoDetail =
      window.__$UNIVERSAL_DATA$__.__DEFAULT_SCOPE__["webapp.video-detail"];
    let structAuthorId = videoDetail.itemInfo.itemStruct.author.uniqueId;
    let structItem = videoDetail.itemInfo.itemStruct;
    if (
      structItem?.id &&
      postItems[structAuthorId].findIndex((post) => post.id == structItem.id) <
        0
    ) {
      postItems[structAuthorId].push(structItem);
    }
  } catch (error) {
    console.warn("Error in adding itemStruct", error);
  }

  for (let i = 0; i < newItems.length; i++) {
    let item = newItems[i];
    let authorId = item?.author?.uniqueId;
    if (!authorId) continue;
    if (!postItems[authorId]) postItems[authorId] = [];
    if (postItems[authorId].findIndex((post) => post.id == item.id) < 0) {
      postItems[authorId].push(item);
    }
    if (filterLikedVideos) {
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

  // if (!postItems[getCurrentPageUsername()])
  //   postItems[getCurrentPageUsername()] = [];
  // let nonDuplicateItems = generateNonDuplicateItems(
  //   postItems[getCurrentPageUsername()],
  //   newItems
  // );
  // if (nonDuplicateItems && nonDuplicateItems.length) {
  //   if (filterVideosState.startsWith("LIKES")) {
  //     nonDuplicateItems = nonDuplicateItems.filter(
  //       (post) =>
  //         post?.author != getCurrentPageUsername() &&
  //         post?.author?.uniqueId != getCurrentPageUsername()
  //     );
  //     postItems[getCurrentPageUsername()] = nonDuplicateItems;
  //   } else if (filterVideosState.startsWith("ALL")) {
  //     nonDuplicateItems = nonDuplicateItems.filter(
  //       (post) =>
  //         post?.author == getCurrentPageUsername() ||
  //         post?.author?.uniqueId == getCurrentPageUsername()
  //     );
  //     postItems[getCurrentPageUsername()] = nonDuplicateItems;
  //   }

  //   // fail safe
  //   if (nonDuplicateItems.length)
  //     postItems[getCurrentPageUsername()] = nonDuplicateItems;
  // }
  // if (nonDuplicateItems.length)
  //   postItems[getCurrentPageUsername()] = nonDuplicateItems;

  // // Should be done after updating the postItems
  // if (!filterVideosState.endsWith("UPDATED") && filterVideosState != "INIT") {
  //   displayFoundUrls();
  //   filterVideosState += "_UPDATED";
  // }
  // let currentPathContentId = document.location.pathname;

  // postItems[getCurrentPageUsername()].forEach(
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
window.AbortController.prototype.abort = () => {};

const browserFetch = window.fetch;
window.fetch = async (...args) => {
  const response = await browserFetch(...args);
  response
    .clone()
    .json()
    .then((data) => {
      try {
        if (data.itemList && data.itemList.length && data.itemList[0]?.id) {
          handleFoundItems(data.itemList.filter((item) => item.id));
        }

        if (Array.isArray(data.data)) {
          handleFoundItems(
            data.data.map((entry) => entry?.item).filter((item) => item?.id)
          );
        }
      } catch (error) {
        console.warn("Low level error in fetch", error);
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
      try {
        currentPageUsername = getCurrentPageUsername();
        allDirectLinks = [];
        const _id = "ttk-downloader-wrapper";
        document.getElementById(_id)?.remove();
        let likedTab = getLikedTab();
        // If aria-selected="true" is present, the user is viewing liked videos
        if (
          likedTab &&
          likedTab.getAttribute("aria-selected") === "true" &&
          !filterLikedVideos
        ) {
          startLikesPolling();
        } else {
          filterLikedVideos = false;
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
  isDownloading = true;
  displayFoundUrls({ forced: true });
  // if (filename === ".mp4") {
  //   filename = getCurrentPageUsername() + "-video.mp4";
  // }

  return new Promise((resolve, reject) => {
    fetch(url, { credentials: "include" }) // Ensure cookies are sent with the request
      .then((response) => {
        isDownloading = false;
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
        isDownloading = false;
        displayFoundUrls({ forced: true });
        console.warn("ETTPD Download failed:", error);
        downloadURLToDiskOld(url, filename);
        reject(error);
      });
  });
}

function downloadURLToDiskOld(url, filename) {
  let anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.target = "_blank";
  anchor.click();
}

function getPostsHash(items) {
  return items?.map((item) => item.id).join("");
}

function getSrcById(id) {
  try {
    for (const key in postItems) {
      const item = postItems[key].find((item) => item.id == id);
      if (item) {
        return item.video.playAddr;
      }
    }
  } catch (error) {
    console.warn("Error in getting src by id", error);
  }
  try {
    let videoDetail =
      window.__$UNIVERSAL_DATA$__.__DEFAULT_SCOPE__["webapp.video-detail"]
        .itemInfo.itemStruct;
    if (videoDetail.id == id) {
      return videoDetail.video.playAddr;
    }
  } catch (error) {
    console.warn("Error in getting src by id", error);
  }
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
    filterLikedVideos = true;
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
    // If filterLikedVideos is true, the user is viewing liked videos
    if (filterLikedVideos) {
      alert(
        "Just scroll down to load more liked videos. The downloader will automatically fetch them for you! Clicking anywhere resets the filter."
      );
      filterLikedVideos = false;
    }
    removeDocumentClickListener();
  });
}

function removeDocumentClickListener() {
  document.removeEventListener("click", () => {});
}

setInterval(() => {
  // Find all divs where the ID starts with "xgwrapper"
  const videoWrappers = document.querySelectorAll('div[id^="xgwrapper"]');

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

          if (videoSrc)
            downloadURLToDisk(videoSrc, `tiktok-video-${videoId}.mp4`);
        }); 

        // First remove any existing download buttons
        const existingDownloadButtons = document.querySelectorAll(
          `div.download-btn-container`);
        existingDownloadButtons?.forEach((button) => button.remove());

        downloadButtonContainer.appendChild(downloadButton);
        let anchor = videoElement.parentElement; 
        while (anchor && anchor.tagName !== "A") {
          if(!anchor) break;
          anchor = anchor.parentElement; 
        }
        if (anchor && anchor.tagName === "A") {
          downloadButtonContainer.style.zIndex = "1";
          anchor.parentElement?.appendChild(downloadButtonContainer);
        } else {
          wrapper.appendChild(downloadButtonContainer);
          downloadButtonContainer.style.zIndex = "2";

        }
        
      }
    }
  });
}, 1000);
