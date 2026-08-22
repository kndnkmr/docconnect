import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import SEO from '../components/SEO';
import toast from 'react-hot-toast';

// Public site URL used for sharing + QR. Prefer the live origin at runtime so
// this works on any deployment, falling back to the canonical domain.
const SITE_URL = 'https://www.promedicoz.in';

// Ready-to-send share message (the copy the admin liked). Kept short and warm.
const SHARE_TEXT =
  '🏥 ProMedicoz is now live! Consult verified doctors online — video, phone, or in-person.\n\n' +
  '📲 Book in under 2 minutes 👉 ' + SITE_URL + '\n\n' +
  'No more waiting in line. Your health, our priority. ❤️';

function InstallApp() {
  // Android/Chrome fires beforeinstallprompt; we capture it so the user can
  // install with one tap. iOS/Safari never fires it — those users follow the
  // manual "Add to Home Screen" steps below (Apple allows no install button).
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setIsInstalled(true));
    // Already running as an installed app?
    if (window.matchMedia?.('(display-mode: standalone)').matches) setIsInstalled(true);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      toast.success('ProMedicoz installed!');
      setInstallPrompt(null);
      setIsInstalled(true);
    }
  };

  const handleShare = async () => {
    // Native share sheet on mobile (WhatsApp/SMS/etc.) — same API used
    // elsewhere for sharing prescriptions. Falls back to copying the link.
    if (navigator.share) {
      try {
        await navigator.share({ title: 'ProMedicoz', text: SHARE_TEXT, url: SITE_URL });
        return;
      } catch { /* user cancelled — do nothing */ }
    }
    handleCopyLink();
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(SITE_URL);
      toast.success('Link copied! Paste it anywhere to share.');
    } catch {
      // Clipboard blocked (permissions/older browser) — show it to copy manually
      window.prompt('Copy this link to share ProMedicoz:', SITE_URL);
    }
  };

  const whatsappShareUrl = `https://wa.me/?text=${encodeURIComponent(SHARE_TEXT)}`;

  return (
    <div>
      <SEO title="Get the App — Install & Share ProMedicoz" description="Install ProMedicoz on your phone for one-tap access, and share it with family and friends. Works on Android and iPhone." path="/install" />

      {/* Gradient header band — consistent with the rest of the app */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-800 text-white">
        <div className="container mx-auto px-4 pt-10 pb-16 text-center">
          <h1 className="text-2xl sm:text-3xl font-bold">📲 Get the ProMedicoz App</h1>
          <p className="text-primary-100 mt-2 text-sm sm:text-base max-w-xl mx-auto">
            Install it on your phone for one-tap access — and share it with family and friends who need a doctor.
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 pb-12 max-w-3xl">
        <div className="grid md:grid-cols-2 gap-6 -mt-8 relative z-10">
          {/* ---- Install ---- */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Install on your phone</h2>

            {isInstalled ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800 text-sm">
                ✅ ProMedicoz is already installed on this device. Open it from your home screen!
              </div>
            ) : (
              <>
                {/* Android / Chrome — one-tap install when available */}
                {installPrompt && (
                  <button
                    onClick={handleInstall}
                    className="w-full bg-green-500 text-white py-3 rounded-lg font-semibold hover:bg-green-600 transition-colors mb-4"
                  >
                    📲 Install now (1 tap)
                  </button>
                )}

                {/* Android steps (shown as guidance whether or not the prompt fired) */}
                <div className="mb-5">
                  <p className="font-medium text-gray-800 text-sm mb-1">📱 On Android (Chrome)</p>
                  <ol className="list-decimal ml-5 text-sm text-gray-600 space-y-1">
                    <li>Tap the <strong>Install</strong> button above, or</li>
                    <li>Open the browser menu (⋮) and tap <strong>“Install app”</strong> / <strong>“Add to Home screen”</strong>.</li>
                  </ol>
                </div>

                {/* iOS steps — Apple gives no install button, so this is the only way */}
                <div>
                  <p className="font-medium text-gray-800 text-sm mb-1">🍎 On iPhone (Safari)</p>
                  <ol className="list-decimal ml-5 text-sm text-gray-600 space-y-1">
                    <li>Open this site in <strong>Safari</strong>.</li>
                    <li>Tap the <strong>Share</strong> button (the square with an ↑ arrow).</li>
                    <li>Scroll down and tap <strong>“Add to Home Screen.”</strong></li>
                    <li>Tap <strong>Add</strong> — ProMedicoz now opens like an app.</li>
                  </ol>
                </div>

                <p className="text-xs text-gray-400 mt-4">
                  Installing adds an icon to your home screen and opens ProMedicoz full-screen — no app store needed, no storage worries.
                </p>
              </>
            )}
          </div>

          {/* ---- Share ---- */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Share with others</h2>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleShare}
                className="w-full bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
              >
                📤 Share ProMedicoz
              </button>
              <a
                href={whatsappShareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full text-center bg-green-500 text-white py-3 rounded-lg font-semibold hover:bg-green-600 transition-colors"
              >
                💬 Share on WhatsApp
              </a>
              <button
                onClick={handleCopyLink}
                className="w-full border border-gray-300 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                🔗 Copy link
              </button>
            </div>

            {/* QR code — someone can scan it from your phone to open the site */}
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600 mb-3">Or let someone scan this to open ProMedicoz:</p>
              <div className="inline-block bg-white p-3 rounded-lg border border-gray-200">
                <QRCodeSVG value={SITE_URL} size={160} level="M" includeMargin={false} />
              </div>
              <p className="text-xs text-gray-400 mt-2">{SITE_URL.replace('https://', '')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default InstallApp;
