window.addEventListener("message", (event) => {
  if (!event.data) return;

  if (event.data.type === "BLOB_DOWNLOAD_REQUEST") {
    try {
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
    } catch (error) {
      console.warn("SOME MAJOR LEAGUE ERROR:  ", error);
      try {
        const response = { success: false, error: error };
        window.postMessage(
            {
              type: "BLOB_DOWNLOAD_RESPONSE",
              success: response?.success || false,
              error: response?.error || null,
            },
            "*"
          );
      } catch (err) {
      console.warn("SOME MAJOR LEAGUE ERROR sending back:  ", error);
        
      }
    }
  }
});
