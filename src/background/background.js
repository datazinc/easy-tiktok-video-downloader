const AppStateETTVD = globalThis?.AppStateETTVD || { debug: { active: false } };
if (globalThis) globalThis.AppStateETTVD = AppStateETTVD;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "downloadBlobUrl") {
    const { blobUrl, filename, showFolderPicker } = message.payload;
    chrome.downloads.download(
      {
        url: blobUrl,
        filename,
        saveAs: showFolderPicker,
      },
      (downloadId) => {
        if (AppStateETTVD.debug.active)
          console.log("DOWNLOAD ID: ", {
            downloadId,
            blobUrl,
          });
        if (chrome.runtime.lastError) {
          if (AppStateETTVD.debug.active)
            console.warn("Download failed:", chrome.runtime.lastError.message);
          sendResponse({
            success: false,
            error: chrome.runtime.lastError.message,
          });
        } else {
          // Clean up blob after a slight delay to allow download to begin
          setTimeout(() => {
            try {
              URL.revokeObjectURL ? URL.revokeObjectURL(blobUrl) : null;
            } catch (e) {
              if (AppStateETTVD.debug.active)
                console.warn("Background: Failed to revoke blob URL:", e);
            }
          }, 2000); // 2 seconds is generally safe

          sendResponse({ success: true });
        }
      }
    );

    return true; // Keep sendResponse alive
  }
});
