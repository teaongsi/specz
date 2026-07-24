function getStorage(key) {
  return new Promise(resolve => {
    chrome.storage.local.get([key], res => {
      resolve(res[key]);
    });
  });
}

function setStorage(key, value) {
  return new Promise(resolve => {
    chrome.storage.local.set({ [key]: value }, resolve);
  });
}