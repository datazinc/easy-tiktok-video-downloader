chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "downloadBlobUrl") {
      const { blobUrl, filename, showFolderPicker } = message.payload;
      console.log("Received blob URL for download:", blobUrl, filename, showFolderPicker);

    chrome.downloads.download(
      {
        url: blobUrl,
        filename,
        saveAs: showFolderPicker,
      },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          console.error("Download failed:", chrome.runtime.lastError.message);
          sendResponse({
            success: false,
            error: chrome.runtime.lastError.message,
          });
        } else {
          console.log("Download started:", downloadId);

          // Clean up blob after a slight delay to allow download to begin
          setTimeout(() => {
            try {
              URL.revokeObjectURL(blobUrl);
              console.log("Blob URL revoked:", blobUrl);
            } catch (e) {
              console.warn("Failed to revoke blob URL:", e);
            }
          }, 2000); // 2 seconds is generally safe

          sendResponse({ success: true });
        }
      }
    );

    return true; // Keep sendResponse alive
  }
});
