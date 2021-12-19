let requestObjects = {};
let allDirectLinks = [];

(function () {

  var XHR = XMLHttpRequest.prototype;
  var open = XHR.open;
  var send = XHR.send;
  XHR.open = function (method, url) {
    this._method = method;
    this._url = url;
    return open.apply(this, arguments);
  };
  // Get initial page data :)
  pollNextData();
  // Listen to traffic
  XHR.send = function (postData) {
    this.addEventListener("load", function () {
      let data = {}
      try {
        data = JSON.parse(this.responseText);
      } catch (error) { }
      if (data.itemList) {
        let path = document.location.pathname;
        if (!requestObjects[path]) requestObjects[path] = [];
        requestObjects[path].push(data);
        displayFoundUrls(requestObjects[path]);
      }
    });
    return send.apply(this, arguments);
  };
})();

function displayFoundUrls(requests) {
  // reset all direct links
  allDirectLinks = [];
  const _id = "ttk-downloader-wrapper";
  if (requests?.length) document.getElementById(_id)?.remove();
  else return;
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
  creditsText.innerHTML = `&copy; ${new Date().getFullYear()} - Made by DataZinc💛`;
  copyAllLinksBtn.addEventListener("click", () =>
    copyAllLinks(allLinksTextArea, copyAllLinksBtn)
  );

  allLinksTextArea.addEventListener("click", () =>
    copyAllLinks(allLinksTextArea, copyAllLinksBtn)
  );
  wrapper.id = _id;
  let itemsList = document.createElement("ol");
  let idx = 1;
  requests.forEach((request) => {
    let items = request?.props?.pageProps?.items || request?.itemList || [];
    if (items.length) {
      items.forEach((media) => {
        let item = document.createElement("li");
        let anc = document.createElement("a");
        anc.className = "ettpd-a";
        anc.target = "_blank";
        anc.innerText = `Video ${idx}: ${media?.desc}`;
        anc.href = media?.video?.playAddr;
        allDirectLinks.push(anc.href);

        item.appendChild(anc);
        itemsList.appendChild(item);
        idx++;
      });
    }
  });
  copyAllLinksBtn.innerText = `Copy All ${allDirectLinks?.length || 0} Links: ${document.location?.pathname?.split("/")[1]
    }`;

  reportBugBtn.innerText = "Report Bugs";
  let reportBugBtnLink = document.createElement("a");
  reportBugBtnLink.target = "_blank";
  reportBugBtnLink.href = "https://forms.gle/Up1JaQJjxSBNYsZw5";
  reportBugBtnLink.appendChild(reportBugBtn);
  wrapper.appendChild(itemsList);

  document.body.appendChild(wrapper);
  allLinksTextArea.value = allDirectLinks.join(" \n");
  wrapper.prepend(reportBugBtnLink);
  wrapper.prepend(allLinksTextArea);
  wrapper.prepend(copyAllLinksBtn);
  wrapper.append(creditsText);
}

function pollNextData() {
  if (document.getElementById("__NEXT_DATA__")) {
    let path = document.location.pathname;
    if (!requestObjects[path]) requestObjects[path] = [];
    requestObjects[path].push(
      JSON.parse(document.getElementById("__NEXT_DATA__").innerText)
    );
  } else
    setTimeout(() => {
      pollNextData();
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

let currentPath = document.location.pathname;

setInterval(() => {
  if (currentPath != document.location.pathname) {
    currentPath = document.location.pathname;
    allDirectLinks = [];
    const _id = "ttk-downloader-wrapper";
    document.getElementById(_id)?.remove();
    displayFoundUrls(requestObjects[document.location.pathname]);
  }
}, 1000);
