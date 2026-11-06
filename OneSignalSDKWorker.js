// OneSignal Worker met PWA Service Worker integratie
try {
  importScripts("./sw.js");
} catch (e) {
  importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");
}
