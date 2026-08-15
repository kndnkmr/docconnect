// ============================================
// Web Push Utility - send browser push notifications
// ============================================
// Uses VAPID (Voluntary Application Server Identification) — no third-party
// push provider account, no per-message cost, no SMS/email needed. Works for
// any user who has granted browser notification permission, regardless of
// whether they have an email or phone number on file. This is what lets
// phone-only patients get instant updates (appointment confirmed, new
// message, incoming call) even when the app isn't open.
//
// Setup: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT in .env
// (generate once with: node -e "console.log(require('web-push').generateVAPIDKeys())")

const webpush = require('web-push');
const User = require('../models/User');

let configured = false;
function ensureConfigured() {
  if (configured) return true;
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:support@promedicoz.in',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  configured = true;
  return true;
}

// Send a push notification to every subscribed device of a user.
// payload: { title, body, url, tag } — tag lets the browser replace/group
// notifications (e.g. repeated "incoming call" pings collapse into one).
// Silently no-ops if push isn't configured or the user has no subscriptions —
// never throws, never blocks the caller (same pattern as email sending).
const sendPushToUser = async (userId, payload) => {
  try {
    if (!ensureConfigured()) return;
    const user = await User.findById(userId).select('pushSubscriptions');
    if (!user || !user.pushSubscriptions || user.pushSubscriptions.length === 0) return;

    const data = JSON.stringify(payload);
    const staleEndpoints = [];

    await Promise.all(user.pushSubscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, data);
      } catch (error) {
        // 404/410 = subscription no longer valid (browser unsubscribed, site
        // data cleared, etc.) — clean it up so we stop retrying it forever.
        if (error.statusCode === 404 || error.statusCode === 410) {
          staleEndpoints.push(sub.endpoint);
        } else {
          console.error('Push send error:', error.message);
        }
      }
    }));

    if (staleEndpoints.length > 0) {
      await User.findByIdAndUpdate(userId, {
        $pull: { pushSubscriptions: { endpoint: { $in: staleEndpoints } } }
      });
    }
  } catch (error) {
    console.error('sendPushToUser error:', error.message);
  }
};

module.exports = { sendPushToUser };
