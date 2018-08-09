/*
Jabra Browser Integration
https://github.com/gnaudio/jabra-browser-integration

MIT License

Copyright (c) 2017 GN Audio A/S (Jabra)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

(function () {
  const prodExtensionId = "okpeabepajdgiepelmhkfhkjlhhmofma";

  // Make logLevel variable in sync with storage (updated by options page).
  var logLevel = 1;

  chrome.storage.local.get('logLevel', function(items) {
    logLevel = parseInt(items.logLevel || "1");  
    chrome.storage.onChanged.addListener(function(changes, areaName) {
      for (key in changes) {
        var storageChange = changes[key];
        if (key='logLevel' && areaName === 'local' ) {
          logLevel = storageChange.newValue;
        }
      }
    });
  });

  // Native messages port
  var port = null;

  // Message from native app
  function onNativeMessageReceived(message) {
    if (logLevel>=4) { // Log if Loglevel >= Trace
      console.log("Recived message from native chromehost process: " + JSON.stringify(message) );
    }
    if (message.message.startsWith("Event: Version ")) {
      // Supported versions: 0.5
      if (!(message.message === "Event: Version 0.5")) {
        sendErrorToContentScript("You need to upgrade the <a href='https://gnaudio.github.io/jabra-browser-integration/download'>Jabra Browser Integration Host</a> and reload this page");
        return;
      }
    }

    let msg = {
      message: message.message,
      requestId: message.requestId,
      apiClientId: message.apiClientId
    }

    sendMessageToContentScript(msg);
  }

  function ensureString(obj) {
    if (obj) {
      return (typeof obj === 'string' || obj instanceof String) ? obj : obj.toString();
    } else {
      return "";
    }
  }

  // Send message to native app
  function sendMessageToNativeApp(request) {
    // Make sure all entries are strings as expected by native app.
    let msg = {
      message: ensureString(request.message),
      requestId: ensureString(request.requestId),
      apiClientId: ensureString(request.apiClientId)
    }

    if (logLevel>=4) { // Log if Loglevel >= Trace
      console.log("Sending request to native chromehost process: " + JSON.stringify(msg));
    }
    port.postMessage(msg);
  }

  // Messages from the content-script
  window.chrome.runtime.onMessage.addListener((request) => {
    // Try to connect to the native app, if not already connected
    if (port == null) {
      var hostName = "com.jabra.nm";
      try {
        port = window.chrome.runtime.connectNative(hostName);
        port.onDisconnect.addListener(() => {
          var err = chrome.runtime.lastError ? chrome.runtime.lastError.message : null;
          if (err === "Specified native messaging host not found.") {
            sendErrorToContentScript("You need to install the <a href='https://gnaudio.github.io/jabra-browser-integration/download'>Jabra Browser Integration Host</a> and reload this page", request);
          } else if (err === "Access to the specified native messaging host is forbidden." && chrome.runtime.id !== prodExtensionId) {
            sendErrorToContentScript("You are running a beta/development version of the Jabra browser extension which lacks access rights to installed native messaging host. Please upgrade your host installation OR manually add this extension id '" + chrome.runtime.id + "' to allowed_origins (in com.jabra.nm.json)", request);
          } else {
            sendErrorToContentScript(err, request);
          }
          port = null;
        });
        port.onMessage.addListener(onNativeMessageReceived);
      }
      catch(err) {
        sendErrorToContentScript(err);
      }
    }

    if (logLevel>=4) { // Log if Loglevel >= Trace
      console.log("Received request from content script: " + JSON.stringify(request));
    }

    sendMessageToNativeApp(request);
  });

  function sendMessageToContentScript(request) {
    // Messages are always forwarded as they need to be handled (and not just logged).
    let msg = {
      message: request.message,
      requestId: request.requestId,
      apiClientId: request.apiClientId,
    };

    if (logLevel>=4) { // Log if Loglevel >= Trace
      console.log("Sending message to content script: " + JSON.stringify(msg) );
    }

    window.chrome.tabs.query({
    }, function (tabs) {
      tabs.forEach(function (tab) {
        window.chrome.tabs.sendMessage(tab.id, msg);
      });
    });
  }

  function sendErrorToContentScript(err, request = null) {
    // Errors always forwarded because api user may needs to handle - so no filtering here.
    let msg = {
      error: err,
      requestId: request ? request.requestId : null,
      apiClientId: request ? request.apiClientId : null,
    };

    if (logLevel>=1) { // Log if Loglevel >= Error
      console.log("Sending error to content script: " + JSON.stringify(msg) );
    }

    window.chrome.tabs.query({
    }, function (tabs) {
      tabs.forEach(function (tab) {
        window.chrome.tabs.sendMessage(tab.id, msg);
      });
    });
  }
})();