import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import SEO from '../components/SEO';
import toast from 'react-hot-toast';

// Public site URL used for sharing + QR.
const SITE_URL = 'https://www.promedicoz.in';

// Patient-facing page → bilingual (English / हिंदी), same lightweight pattern
// as Home/BookAppointment/HowItWorks: a per-page dictionary keyed by language,
// using the shared localStorage 'promedicoz_lang' choice so the patient's
// selection carries across the site. This page especially needs Hindi — the
// people who most need install help are the ones who can't follow English
// steps. Only fixed UI labels are translated; Hindi copy should be proofread
// by a native speaker before being treated as final.
const TXT = {
  en: {
    heroTitle: '📲 Get the ProMedicoz App',
    heroSubtitle: 'Install it on your phone for one-tap access — and share it with family and friends who need a doctor.',
    installHeading: 'Install on your phone',
    alreadyInstalled: '✅ ProMedicoz is already installed on this device. Open it from your home screen!',
    installNow: '📲 Install now (1 tap)',
    androidTitle: '📱 On Android (Chrome)',
    androidSteps: [
      <>Tap the <strong>Install</strong> button above, or</>,
      <>Open the browser menu (⋮) and tap <strong>“Install app”</strong> / <strong>“Add to Home screen”</strong>.</>,
    ],
    iosTitle: '🍎 On iPhone (Safari)',
    iosSteps: [
      <>Open this site in <strong>Safari</strong>.</>,
      <>Tap the <strong>Share</strong> button (the square with an ↑ arrow).</>,
      <>Scroll down and tap <strong>“Add to Home Screen.”</strong></>,
      <>Tap <strong>Add</strong> — ProMedicoz now opens like an app.</>,
    ],
    installNote: 'Installing adds an icon to your home screen and opens ProMedicoz full-screen — no app store needed, no storage worries.',
    shareHeading: 'Share with others',
    shareBtn: '📤 Share ProMedicoz',
    whatsappBtn: '💬 Share on WhatsApp',
    copyBtn: '🔗 Copy link',
    qrPrompt: 'Or let someone scan this to open ProMedicoz:',
    copied: 'Link copied! Paste it anywhere to share.',
    copyManual: 'Copy this link to share ProMedicoz:',
    installedToast: 'ProMedicoz installed!',
    shareText:
      '🏥 ProMedicoz is now live! Consult verified doctors online — video, phone, or in-person.\n\n' +
      '📲 Book in under 2 minutes 👉 ' + SITE_URL + '\n\n' +
      'No more waiting in line. Your health, our priority. ❤️',
  },
  hi: {
    heroTitle: '📲 ProMedicoz ऐप पाएं',
    heroSubtitle: 'इसे अपने फ़ोन पर इंस्टॉल करें ताकि एक टैप में खुले — और जिन्हें डॉक्टर की ज़रूरत है उन परिवारजनों व दोस्तों के साथ साझा करें।',
    installHeading: 'अपने फ़ोन पर इंस्टॉल करें',
    alreadyInstalled: '✅ ProMedicoz इस डिवाइस पर पहले से इंस्टॉल है। इसे अपनी होम स्क्रीन से खोलें!',
    installNow: '📲 अभी इंस्टॉल करें (1 टैप)',
    androidTitle: '📱 Android पर (Chrome)',
    androidSteps: [
      <>ऊपर दिए <strong>Install</strong> बटन पर टैप करें, या</>,
      <>ब्राउज़र मेनू (⋮) खोलें और <strong>“Install app”</strong> / <strong>“Add to Home screen”</strong> पर टैप करें।</>,
    ],
    iosTitle: '🍎 iPhone पर (Safari)',
    iosSteps: [
      <>इस साइट को <strong>Safari</strong> में खोलें।</>,
      <><strong>Share</strong> बटन पर टैप करें (ऊपर तीर ↑ वाला चौकोर आइकन)।</>,
      <>नीचे स्क्रॉल करें और <strong>“Add to Home Screen”</strong> पर टैप करें।</>,
      <><strong>Add</strong> पर टैप करें — अब ProMedicoz एक ऐप की तरह खुलेगा।</>,
    ],
    installNote: 'इंस्टॉल करने पर आपकी होम स्क्रीन पर एक आइकन जुड़ जाता है और ProMedicoz पूरी स्क्रीन पर खुलता है — किसी ऐप स्टोर की ज़रूरत नहीं, स्टोरेज की चिंता नहीं।',
    shareHeading: 'दूसरों के साथ साझा करें',
    shareBtn: '📤 ProMedicoz साझा करें',
    whatsappBtn: '💬 WhatsApp पर साझा करें',
    copyBtn: '🔗 लिंक कॉपी करें',
    qrPrompt: 'या किसी को ProMedicoz खोलने के लिए इसे स्कैन करने दें:',
    copied: 'लिंक कॉपी हो गया! साझा करने के लिए कहीं भी पेस्ट करें।',
    copyManual: 'ProMedicoz साझा करने के लिए यह लिंक कॉपी करें:',
    installedToast: 'ProMedicoz इंस्टॉल हो गया!',
    shareText:
      '🏥 ProMedicoz अब उपलब्ध है! सत्यापित डॉक्टरों से ऑनलाइन परामर्श करें — वीडियो, फ़ोन या क्लिनिक पर।\n\n' +
      '📲 2 मिनट से भी कम में बुक करें 👉 ' + SITE_URL + '\n\n' +
      'अब लाइन में इंतज़ार नहीं। आपका स्वास्थ्य, हमारी प्राथमिकता। ❤️',
  },
};

function InstallApp() {
  const [lang, setLang] = useState(() => localStorage.getItem('promedicoz_lang') || 'en');
  const t = TXT[lang];
  const changeLang = (l) => { setLang(l); localStorage.setItem('promedicoz_lang', l); };

  // Android/Chrome fires beforeinstallprompt; we capture it so the user can
  // install with one tap. iOS/Safari never fires it — those users follow the
  // manual "Add to Home Screen" steps below (Apple allows no install button).
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setIsInstalled(true));
    if (window.matchMedia?.('(display-mode: standalone)').matches) setIsInstalled(true);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      toast.success(t.installedToast);
      setInstallPrompt(null);
      setIsInstalled(true);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'ProMedicoz', text: t.shareText, url: SITE_URL });
        return;
      } catch { /* user cancelled — do nothing */ }
    }
    handleCopyLink();
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(SITE_URL);
      toast.success(t.copied);
    } catch {
      window.prompt(t.copyManual, SITE_URL);
    }
  };

  const whatsappShareUrl = `https://wa.me/?text=${encodeURIComponent(t.shareText)}`;

  return (
    <div>
      <SEO title="Get the App — Install & Share ProMedicoz" description="Install ProMedicoz on your phone for one-tap access, and share it with family and friends. Works on Android and iPhone." path="/install" />

      {/* Gradient header band + language toggle */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-800 text-white">
        <div className="container mx-auto px-4 pt-8 pb-16 text-center">
          <div className="flex justify-center mb-5">
            <div className="inline-flex items-center bg-white/15 rounded-full p-1 text-sm">
              <button
                onClick={() => changeLang('en')}
                className={`px-4 py-1.5 rounded-full font-medium transition-colors ${lang === 'en' ? 'bg-white text-primary-700' : 'text-white hover:bg-white/10'}`}
              >
                English
              </button>
              <button
                onClick={() => changeLang('hi')}
                className={`px-4 py-1.5 rounded-full font-medium transition-colors ${lang === 'hi' ? 'bg-white text-primary-700' : 'text-white hover:bg-white/10'}`}
              >
                हिंदी
              </button>
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold">{t.heroTitle}</h1>
          <p className="text-primary-100 mt-2 text-sm sm:text-base max-w-xl mx-auto">{t.heroSubtitle}</p>
        </div>
      </div>

      <div className="container mx-auto px-4 pb-12 max-w-3xl">
        <div className="grid md:grid-cols-2 gap-6 -mt-8 relative z-10">
          {/* ---- Install ---- */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">{t.installHeading}</h2>

            {isInstalled ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800 text-sm">
                {t.alreadyInstalled}
              </div>
            ) : (
              <>
                {installPrompt && (
                  <button
                    onClick={handleInstall}
                    className="w-full bg-green-500 text-white py-3 rounded-lg font-semibold hover:bg-green-600 transition-colors mb-4"
                  >
                    {t.installNow}
                  </button>
                )}

                <div className="mb-5">
                  <p className="font-medium text-gray-800 text-sm mb-1">{t.androidTitle}</p>
                  <ol className="list-decimal ml-5 text-sm text-gray-600 space-y-1">
                    {t.androidSteps.map((step, i) => <li key={i}>{step}</li>)}
                  </ol>
                </div>

                <div>
                  <p className="font-medium text-gray-800 text-sm mb-1">{t.iosTitle}</p>
                  <ol className="list-decimal ml-5 text-sm text-gray-600 space-y-1">
                    {t.iosSteps.map((step, i) => <li key={i}>{step}</li>)}
                  </ol>
                </div>

                <p className="text-xs text-gray-400 mt-4">{t.installNote}</p>
              </>
            )}
          </div>

          {/* ---- Share ---- */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">{t.shareHeading}</h2>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleShare}
                className="w-full bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
              >
                {t.shareBtn}
              </button>
              <a
                href={whatsappShareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full text-center bg-green-500 text-white py-3 rounded-lg font-semibold hover:bg-green-600 transition-colors"
              >
                {t.whatsappBtn}
              </a>
              <button
                onClick={handleCopyLink}
                className="w-full border border-gray-300 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                {t.copyBtn}
              </button>
            </div>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600 mb-3">{t.qrPrompt}</p>
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
