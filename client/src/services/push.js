// ============================================
// Push notification client - subscribe/unsubscribe helper
// ============================================
// Wraps the browser's Push API. Works for ANY logged-in user regardless of
// whether they have an email or phone number on file — permission is granted
// per-browser, not tied to an email/SMS identity. This is what lets
// phone-only patients get instant appointment/chat/call updates.

import API from './api';

// Convert the VAPID public key (base64url string from the server) into the
// Uint8Array format the Push API expects.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// True if this browser/context can support push notifications at all
// (older browsers, some in-app webviews, and non-HTTPS contexts can't).
export const isPushSupported = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

// Current permission state without prompting: 'default' | 'granted' | 'denied'
export const getPushPermission = () => (isPushSupported() ? Notification.permission : 'unsupported');

// Ask the browser for permission and, if granted, subscribe + save it on the backend.
// Returns true on success, false otherwise (never throws — notifications are
// an enhancement, not something that should break the app if it fails).
export const enablePushNotifications = async () => {
  try {
    if (!isPushSupported()) return false;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    const registration = await navigator.serviceWorker.ready;

    // Reuse an existing subscription if one's already active for this browser
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      const { data } = await API.get('/push/public-key');
      if (!data.publicKey) return false; // server not configured yet

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(data.publicKey)
      });
    }

    await API.post('/push/subscribe', {
      subscription: {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: arrayBufferToBase64Url(subscription.getKey('p256dh')),
          auth: arrayBufferToBase64Url(subscription.getKey('auth'))
        }
      }
    });

    return true;
  } catch (error) {
    console.error('enablePushNotifications failed:', error);
    return false;
  }
};

// Subscription keys come back as ArrayBuffers — encode to base64url for the backend.
function arrayBufferToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Turn off push for this browser (best-effort — used on logout/opt-out).
// authToken is optional — pass it explicitly when calling this during logout,
// since by the time the async service-worker lookups below resolve, the
// token may already have been cleared from localStorage (which the shared
// axios instance's interceptor reads from), and this request still needs it.
export const disablePushNotifications = async (authToken) => {
  try {
    if (!isPushSupported()) return;
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;

    const config = authToken ? { headers: { Authorization: `Bearer ${authToken}` } } : undefined;
    await API.post('/push/unsubscribe', { endpoint: subscription.endpoint }, config).catch(() => {});
    await subscription.unsubscribe();
  } catch (error) {
    console.error('disablePushNotifications failed:', error);
  }
};
