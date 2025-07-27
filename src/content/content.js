window.addEventListener("message", (event) => {
  if (!event.data) return;

  if (event.data.type === "BLOB_DOWNLOAD_REQUEST") {
    chrome.runtime.sendMessage(
      {
        action: "downloadBlobUrl",
        payload: event.data.payload,
      },
      (response) => {
        // Send result back to page
        window.postMessage(
          {
            type: "BLOB_DOWNLOAD_RESPONSE",
            success: response?.success || false,
            error: response?.error || null,
          },
          "*"
        );
      }
    );
  }
});
