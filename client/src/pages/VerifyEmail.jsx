import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import API from '../services/api';
import SEO from '../components/SEO';
import { useLang } from '../context/LangContext';

// Fixed text on this page (follows the app-wide language). The server's
// message is shown as it comes.
const VERIFY_TXT = {
  en: {
    verifying: 'Verifying your email...',
    wait: 'Please wait a moment.',
    verified: 'Email Verified!',
    failedTitle: 'Verification Failed',
    failed: 'Verification failed. The link may be expired.',
    goLogin: 'Go to Login',
  },
  hi: {
    verifying: 'आपका ईमेल जाँच रहे हैं...',
    wait: 'कृपया थोड़ा रुकें।',
    verified: 'ईमेल पक्का हो गया!',
    failedTitle: 'ईमेल पक्का नहीं हो पाया',
    failed: 'ईमेल पक्का नहीं हो पाया। हो सकता है लिंक पुराना हो गया हो।',
    goLogin: 'लॉग इन पर जाएं',
  },
};

function VerifyEmail() {
  const { token } = useParams();
  const { lang } = useLang(); // app-wide (top-bar switch)
  const T = VERIFY_TXT[lang] || VERIFY_TXT.en;
  const [status, setStatus] = useState('verifying'); // verifying, success, error
  const [message, setMessage] = useState('');

  useEffect(() => {
    const verify = async () => {
      try {
        const response = await API.get(`/auth/verify-email/${token}`);
        setStatus('success');
        setMessage(response.data.message);
      } catch (error) {
        setStatus('error');
        // Empty → the page shows its own (translated) fallback text below.
        setMessage(error.response?.data?.message || '');
      }
    };
    verify();
  }, [token]);

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <SEO title="Verify Email" description="Verify your ProMedicoz account email." path="/verify-email" noindex />
      <div className="max-w-md w-full text-center">
        {status === 'verifying' && (
          <>
            <div className="text-5xl mb-4">⏳</div>
            <h1 className="text-2xl font-bold text-gray-800">{T.verifying}</h1>
            <p className="text-gray-500 mt-2">{T.wait}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="text-5xl mb-4">✅</div>
            <h1 className="text-2xl font-bold text-gray-800">{T.verified}</h1>
            <p className="text-gray-600 mt-2">{message}</p>
            <Link to="/login" className="inline-block mt-6 bg-primary-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors">
              {T.goLogin}
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="text-5xl mb-4">❌</div>
            <h1 className="text-2xl font-bold text-gray-800">{T.failedTitle}</h1>
            <p className="text-gray-600 mt-2">{message || T.failed}</p>
            <Link to="/login" className="inline-block mt-6 bg-primary-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors">
              {T.goLogin}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default VerifyEmail;
