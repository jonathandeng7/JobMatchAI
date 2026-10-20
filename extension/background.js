// A toolbar click opens the extension beside the job, without creating a tab.
chrome.action.onClicked.addListener(tab => {
  chrome.sidePanel.open({windowId:tab.windowId}).catch(error => console.error('Could not open JobMatch side panel:', error.message));
});
