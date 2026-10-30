import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import SEO from '../../components/SEO';
import { Helmet } from 'react-helmet-async';
import toast from 'react-hot-toast';
import { useLang } from '../../context/LangContext';
import { noteProgress, isSaved, toggleSaved } from '../../utils/blogReading';

// Each article file (generated into ./articles/ from blogData.js by
// scripts/gen-blog-meta.mjs) carries EVERYTHING this page needs: its own
// title/date/specialty, the English + Hinglish body and 3 related links. So
// opening an article downloads only that one small file — not the metadata of
// all 373 articles (that used to be a 45 KB extra download before any text).
// Vite turns each into its own chunk.
const ARTICLE_BODIES = import.meta.glob('./articles/*.js');
const ZOOM_KEY = 'pmz_blog_zoom';
const ZOOMS = [0.9, 1, 1.15, 1.3];

// Plain sentences for "Listen": strip **bold** markers, split into chunks of
// ~200 characters (some phone voices stop on long text).
function speechChunks(blocks) {
  const out = [];
  const add = (t) => {
    const clean = String(t || '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
    if (!clean) return;
    let buf = '';
    for (const s of clean.split(/(?<=[.!?।])\s+/)) {
      if ((buf + ' ' + s).length > 200 && buf) { out.push(buf); buf = s; } else buf = buf ? `${buf} ${s}` : s;
    }
    if (buf) out.push(buf);
  };
  for (const b of blocks || []) {
    if (b.type === 'table') continue; // tables don't read well aloud
    add(b.title); add(b.text);
    (b.items || []).forEach(add);
  }
  return out;
}
const loadArticleBody = (slug) => {
  const load = ARTICLE_BODIES[`./articles/${slug}.js`];
  return load ? load().then((m) => m.default) : Promise.resolve(null);
};
import { blogViewAPI } from '../../services/api';
import { INTERNAL_LINKS } from './linkMap';
import { trackEvent } from '../../components/Analytics';
import { PREGNANCY_ARTICLE_SLUGS, dueDatePath, CYCLE_ARTICLE_SLUGS, ovulationPath, BABY_ARTICLE_SLUGS, vaccinePath, REPORT_ARTICLE_SLUGS, reportPath } from '../tools/toolLinks';

// ---- Internal auto-linking ----
// Turn key topic phrases in the body into links to their article (big SEO win
// + keeps readers moving between articles). See linkMap.js for the rationale
// and the curated phrase→slug map.
//
// We precompile the phrase list once: sorted LONGEST-first so a specific phrase
// ("high blood pressure") wins over a shorter overlapping one, and escaped for
// safe use in a regex. Matching is whole-word and case-insensitive.
const LINK_PHRASES = Object.keys(INTERNAL_LINKS).sort((a, b) => b.length - a.length);
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// One combined regex with word boundaries; \b keeps us from linking inside a
// larger word (e.g. "stroke" inside "strokes" still matches on the word, but
// not inside unrelated letters).
const LINK_REGEX = LINK_PHRASES.length
  ? new RegExp(`\\b(${LINK_PHRASES.map(escapeRegex).join('|')})\\b`, 'gi')
  : null;

// Turn a plain string into an array of text + <Link> nodes. `ctx` carries the
// current article slug (so we never self-link) and a shared `used` Set (so each
// target article is linked at most once per article — no spammy repeats).
function linkifyText(text, ctx, keyPrefix) {
  if (!text || !LINK_REGEX || !ctx) return text;

  const out = [];
  let lastIndex = 0;
  let match;
  let n = 0;
  LINK_REGEX.lastIndex = 0;

  while ((match = LINK_REGEX.exec(text)) !== null) {
    const phrase = match[0];
    const slug = INTERNAL_LINKS[phrase.toLowerCase()];

    // Skip if: no mapping, it's the current article, or we've already linked
    // this target once in this article.
    if (!slug || slug === ctx.currentSlug || ctx.used.has(slug)) {
      continue;
    }

    ctx.used.add(slug);

    // Push the text before the match, then the link.
    if (match.index > lastIndex) out.push(text.slice(lastIndex, match.index));
    out.push(
      <Link
        key={`${keyPrefix}-lnk-${n++}`}
        to={`/blog/${slug}`}
        className="text-primary-600 underline decoration-primary-300 underline-offset-2 hover:text-primary-700"
      >
        {phrase}
      </Link>
    );
    lastIndex = match.index + phrase.length;
  }

  if (lastIndex === 0) return text; // no links added — return original string
  if (lastIndex < text.length) out.push(text.slice(lastIndex));
  return out;
}

// Parse simple **bold** markers inside a text string into React nodes, so
// writers can emphasise key phrases without any HTML. Everything else stays
// plain text (safe — no dangerouslySetInnerHTML).
//
// `ctx` (optional) enables internal auto-linking of the non-bold segments.
// Bold segments are left as-is (not linked) to keep emphasis clean.
function renderInline(text, ctx) {
  if (!text) return null;
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-gray-800">{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{ctx ? linkifyText(part, ctx, `i${i}`) : part}</span>;
  });
}

// Callout box styling by variant — a colored, icon-led box that makes tips,
// warnings, and takeaways pop out of the page.
const CALLOUT_STYLES = {
  tip: { box: 'bg-blue-50 border-blue-200', icon: '💡', label: 'text-blue-800' },
  warning: { box: 'bg-red-50 border-red-200', icon: '⚠️', label: 'text-red-800' },
  success: { box: 'bg-green-50 border-green-200', icon: '✅', label: 'text-green-800' },
  info: { box: 'bg-primary-50 border-primary-200', icon: 'ℹ️', label: 'text-primary-800' },
};

// Renders one content block. Supported types (all backward-compatible — the
// original intro/heading/paragraph still work exactly as before):
//   intro      — lead paragraph (accent bar)
//   heading    — section title
//   paragraph  — body text (supports **bold**, and \n line breaks)
//   list       — { items: [] } styled bullet list (supports **bold**)
//   callout    — { variant:'tip|warning|success|info', title?, text? , items?[] }
//   table      — { headers: [], rows: [[]] } comparison table
//   steps      — { items: [] } numbered visual step flow
// `ctx` = { currentSlug, used } enables internal auto-linking. We link the body
// prose (paragraph, list, callout text/items) but deliberately NOT headings,
// the intro, tables, or step labels — those read best clean.
function renderBlock(block, idx, ctx) {
  switch (block.type) {
    case 'intro':
      return <p key={idx} className="text-gray-700 text-lg leading-relaxed mb-6 border-l-4 border-primary-400 pl-4 italic">{renderInline(block.text)}</p>;

    case 'heading':
      return <h2 key={idx} id={`sec-${idx}`} className="scroll-mt-24 text-2xl font-bold text-gray-800 mt-10 mb-4">{renderInline(block.text)}</h2>;

    case 'paragraph':
      return <p key={idx} className="text-gray-700 leading-relaxed mb-5 whitespace-pre-line text-[1.05rem]">{renderInline(block.text, ctx)}</p>;

    case 'list':
      return (
        <ul key={idx} className="mb-6 space-y-2">
          {(block.items || []).map((item, i) => (
            <li key={i} className="flex gap-3 text-gray-700 leading-relaxed">
              <span className="text-primary-500 flex-shrink-0 leading-relaxed select-none" aria-hidden="true">•</span>
              <span className="flex-1">{renderInline(item, ctx)}</span>
            </li>
          ))}
        </ul>
      );

    case 'callout': {
      const s = CALLOUT_STYLES[block.variant] || CALLOUT_STYLES.info;
      return (
        <div key={idx} id={`box-${idx}`} className={`scroll-mt-24 my-6 rounded-xl border p-4 sm:p-5 ${s.box}`}>
          <div className="flex items-start gap-3">
            <span className="text-xl flex-shrink-0">{s.icon}</span>
            <div className="flex-1">
              {block.title && <p className={`font-semibold mb-1 ${s.label}`}>{renderInline(block.title)}</p>}
              {block.text && <p className="text-gray-700 leading-relaxed whitespace-pre-line">{renderInline(block.text, ctx)}</p>}
              {block.items && (
                <ul className="space-y-1.5 mt-1">
                  {block.items.map((item, i) => (
                    <li key={i} className="flex gap-2 text-gray-700 leading-relaxed">
                      <span className="flex-shrink-0 leading-relaxed select-none" aria-hidden="true">•</span>
                      <span className="flex-1">{renderInline(item, ctx)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      );
    }

    case 'table':
      return (
        <div key={idx} className="my-6 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-primary-50">
                {(block.headers || []).map((h, i) => (
                  <th key={i} className="text-left font-semibold text-gray-800 p-3 border border-gray-200">{renderInline(h)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(block.rows || []).map((row, r) => (
                <tr key={r} className={r % 2 ? 'bg-gray-50' : 'bg-white'}>
                  {row.map((cell, c) => (
                    <td key={c} className={`p-3 border border-gray-200 text-gray-700 align-top ${c === 0 ? 'font-medium text-gray-800' : ''}`}>{renderInline(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case 'steps':
      return (
        <ol key={idx} className="my-6 space-y-3">
          {(block.items || []).map((item, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary-600 text-white text-sm font-bold flex items-center justify-center">{i + 1}</span>
              <span className="text-gray-700 leading-relaxed pt-0.5">{renderInline(item)}</span>
            </li>
          ))}
        </ol>
      );

    default:
      return null;
  }
}

// `defaultLang` is 'en' for the normal /blog/:slug route (unchanged behaviour)
// and 'hi' for the /blog/:slug/hi route, which opens the Hinglish version
// directly so it can be indexed for Hindi searches.
function BlogArticle({ defaultLang = 'en' }) {
  const { slug } = useParams();
  // Does this article exist? Checked against the list of generated files, so
  // no other blog data has to be downloaded first.
  const meta = Boolean(ARTICLE_BODIES[`./articles/${slug}.js`]);

  // Load this article's body. `loaded` remembers which slug it belongs to, so
  // switching articles never shows the previous article's text.
  const [loaded, setLoaded] = useState({ slug: null, body: null, failed: false });
  useEffect(() => {
    if (!meta) return undefined;
    let cancelled = false;
    loadArticleBody(slug)
      .then((body) => { if (!cancelled) setLoaded({ slug, body, failed: !body }); })
      .catch(() => { if (!cancelled) setLoaded({ slug, body: null, failed: true }); });
    return () => { cancelled = true; };
  }, [slug, meta]);
  const body = loaded.slug === slug ? loaded.body : null;
  const bodyFailed = loaded.slug === slug && loaded.failed;
  // meta + content + contentHi + related, all from the one file. Null until
  // it has loaded.
  const article = meta && body ? { slug, ...body } : null;

  // ---- Language (English | Hinglish) ----
  // Follows the app-wide English/हिंदी switch in the header, so a reader who
  // chose हिंदी once gets the Hinglish version of every article. The /hi route
  // always opens in Hinglish. Articles without contentHi stay English.
  const app = useLang();
  const hasHindi = Array.isArray(article?.contentHi) && article.contentHi.length > 0;
  const [lang, setLangLocal] = useState(defaultLang === 'hi' ? 'hi' : app.lang);
  const appLangRef = useRef(app.lang);
  useEffect(() => { setLangLocal(defaultLang === 'hi' ? 'hi' : appLangRef.current); }, [slug, defaultLang]);
  // Header switch flipped while reading → follow it.
  useEffect(() => {
    if (appLangRef.current !== app.lang) { appLangRef.current = app.lang; setLangLocal(app.lang); }
  }, [app.lang]);
  // The toggle on the article also flips the whole app.
  const setLang = (l) => { setLangLocal(l); app.setLang(l); };
  // The /hi route is a separate, indexable page only when a Hinglish version
  // exists. Its canonical must point at itself (not the English page), or
  // Google would treat it as a duplicate and drop it.
  const isHindiPage = defaultLang === 'hi' && hasHindi;
  const activeContent = (lang === 'hi' && hasHindi) ? article.contentHi : article?.content;
  const hiUi = lang === 'hi' && hasHindi;

  // Rendered body, memoised so the reading tools below (progress, size,
  // listen) never re-run the auto-linker over the whole article.
  const renderedBody = useMemo(() => {
    if (!activeContent) return null;
    const linkCtx = { currentSlug: slug, used: new Set() };
    return activeContent.map((block, idx) => renderBlock(block, idx, linkCtx));
  }, [activeContent, slug]);

  // "In this article" chips (only worth it with 3+ sections) and the first
  // warning box, which gets its own red chip at the top.
  const sections = useMemo(() => (activeContent || [])
    .map((b, idx) => (b.type === 'heading' ? { id: `sec-${idx}`, text: String(b.text || '').replace(/\*\*/g, '') } : null))
    .filter(Boolean), [activeContent]);
  const warnId = useMemo(() => {
    const i = (activeContent || []).findIndex((b) => b.type === 'callout' && b.variant === 'warning');
    return i >= 0 ? `box-${i}` : null;
  }, [activeContent]);
  const jumpTo = (id, what) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    trackEvent('article_jump', { article_slug: slug, to: what });
  };

  // ---- A− / A+ text size (remembered on this phone) ----
  const [zoom, setZoom] = useState(() => {
    try { const z = Number(localStorage.getItem(ZOOM_KEY)); return ZOOMS.includes(z) ? z : 1; } catch { return 1; }
  });
  const changeZoom = (dir) => {
    const next = ZOOMS[Math.min(ZOOMS.length - 1, Math.max(0, ZOOMS.indexOf(zoom) + dir))];
    setZoom(next);
    try { localStorage.setItem(ZOOM_KEY, String(next)); } catch { /* ignore */ }
  };

  // ---- ⭐ Save for later ----
  const [saved, setSaved] = useState(false);
  useEffect(() => { setSaved(isSaved(slug)); }, [slug]);
  const onSave = () => {
    if (!article) return;
    const on = toggleSaved({ slug, title: hiUi && article.titleHi ? article.titleHi : article.title, image: article.image });
    setSaved(on);
    toast.success(on ? (hiUi ? 'Save ho gaya — Blog page par "Saved" me milega' : 'Saved — find it under "Saved" on the blog page') : (hiUi ? 'Saved se hata diya' : 'Removed from saved'));
    trackEvent('article_save', { article_slug: slug, on });
  };

  // ---- Reading progress bar, sticky "Talk to a doctor" bar, Continue reading ----
  // The bar's width is set directly on the element (no React re-render per
  // scroll frame). Only the sticky bar's show/hide goes through state.
  const bodyRef = useRef(null);
  const barRef = useRef(null);
  const endCtaRef = useRef(null);
  const [showSticky, setShowSticky] = useState(false);
  useEffect(() => {
    if (!article) return undefined;
    let raf = 0;
    let lastNote = 0;
    const measure = () => {
      raf = 0;
      const el = bodyRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const total = Math.max(1, r.height - window.innerHeight * 0.6);
      const pct = Math.min(1, Math.max(0, -r.top / total));
      if (barRef.current) barRef.current.style.transform = `scaleX(${pct})`;
      // Hide once the big "consultation" card at the end is on screen.
      const endCard = endCtaRef.current?.getBoundingClientRect();
      const endVisible = endCard ? endCard.top < window.innerHeight : false;
      setShowSticky(pct > 0.12 && !endVisible);
      const now = Date.now();
      if (now - lastNote > 2000 || pct >= 0.9) {
        lastNote = now;
        noteProgress({ slug, title: hiUi && article.titleHi ? article.titleHi : article.title, image: article.image, hi: hiUi }, pct);
      }
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(measure); };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    measure();
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [article, slug, hiUi]);

  // ---- 🔊 Listen (the phone reads the article aloud; free, works offline) ----
  // Pause = stop and remember the sentence, so it resumes reliably even on
  // phones where speechSynthesis.pause() is broken.
  const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';
  const [speech, setSpeech] = useState('idle'); // idle | playing | paused
  const speakAt = useRef(0);
  const speakToken = useRef(0);
  const chunks = useMemo(() => speechChunks(activeContent), [activeContent]);
  const stopSpeech = (reset = true) => {
    speakToken.current += 1;
    try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
    if (reset) { speakAt.current = 0; setSpeech('idle'); }
  };
  const playFrom = (start) => {
    const synth = window.speechSynthesis;
    const token = ++speakToken.current;
    synth.cancel();
    const voices = synth.getVoices();
    // An Indian-English voice reads both English and Hinglish (Roman script)
    // naturally; if the phone has none, the default voice with lang en-IN.
    const voice = voices.find((v) => /en[-_]IN/i.test(v.lang)) || null;
    const say = (i) => {
      if (token !== speakToken.current) return;
      if (i >= chunks.length) { speakAt.current = 0; setSpeech('idle'); return; }
      speakAt.current = i;
      const u = new window.SpeechSynthesisUtterance(chunks[i]);
      u.lang = 'en-IN';
      if (voice) u.voice = voice;
      u.rate = 0.95;
      u.onend = () => say(i + 1);
      u.onerror = () => { if (token === speakToken.current) setSpeech('idle'); };
      synth.speak(u);
    };
    setSpeech('playing');
    say(start);
  };
  const onListen = () => {
    if (speech === 'playing') { stopSpeech(false); setSpeech('paused'); return; }
    if (speech === 'idle') trackEvent('article_listen', { article_slug: slug, lang: hiUi ? 'hinglish' : 'en' });
    playFrom(speech === 'paused' ? speakAt.current : 0);
  };
  // New article, language switch or leaving the page → stop talking.
  useEffect(() => () => { if (canSpeak) stopSpeech(); }, [slug, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- ❤️ Like ----
  // A friendly heart "like" backed by our DB (no dislike — deliberately, on a
  // health blog). This browser remembers whether IT has liked the article, so
  // the reader can toggle their own like on/off; the visible number is the
  // aggregate like count across everyone. Powers the "Most Loved" section too.
  const likedKey = `blog_liked_${slug}`;
  const [liked, setLiked] = useState(() => {
    try { return localStorage.getItem(likedKey) === '1'; } catch { return false; }
  });
  const [likeCount, setLikeCount] = useState(null);

  const toggleLike = async () => {
    const next = !liked;
    // Optimistic update so the heart feels instant.
    setLiked(next);
    setLikeCount((c) => Math.max(0, (c ?? 0) + (next ? 1 : -1)));
    try { localStorage.setItem(likedKey, next ? '1' : '0'); } catch { /* ignore */ }
    try {
      const { data } = await blogViewAPI.setLike(slug, next);
      if (data && typeof data.likes === 'number') setLikeCount(data.likes);
    } catch {
      // Roll back the optimistic change if the server call failed.
      setLiked(!next);
      setLikeCount((c) => Math.max(0, (c ?? 0) + (next ? -1 : 1)));
      toast.error('Could not save your like. Please try again.');
    }
  };

  // ---- Public "reads" counter (our own numbers, stored in our DB) ----
  // Shows how many times this article has been read, as light social proof.
  // Behaviour:
  //   - On open, fetch the current count to display.
  //   - Record ONE view per browser per article at most once every few hours
  //     (throttled via localStorage) so a refresh or quick re-open doesn't
  //     inflate the number. The increment endpoint returns the fresh count,
  //     which we then show (so the reader sees their own view included).
  //   - Fully non-blocking: if the API is unreachable, we just don't show a
  //     number — the article renders exactly as before.
  const [views, setViews] = useState(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    const VIEW_THROTTLE_MS = 4 * 60 * 60 * 1000; // 4 hours per browser per article
    const throttleKey = `blog_viewed_${slug}`;

    const shouldCount = () => {
      try {
        const last = Number(localStorage.getItem(throttleKey) || 0);
        return !last || Date.now() - last > VIEW_THROTTLE_MS;
      } catch {
        return true;
      }
    };

    const run = async () => {
      try {
        if (shouldCount()) {
          // Record a view and use the returned fresh counts.
          const { data } = await blogViewAPI.increment(slug);
          if (!cancelled && data) {
            setViews(data.count);
            if (typeof data.likes === 'number') setLikeCount(data.likes);
          }
          try { localStorage.setItem(throttleKey, String(Date.now())); } catch { /* ignore */ }
        } else {
          // Already counted recently — just read the current counts to display.
          const { data } = await blogViewAPI.get(slug);
          if (!cancelled && data) {
            setViews(data.count);
            if (typeof data.likes === 'number') setLikeCount(data.likes);
          }
        }
      } catch {
        // Silent: counter is a nice-to-have, never block the article.
      }
    };

    run();
    return () => { cancelled = true; };
  }, [slug]);

  // Format a count compactly: 1240 -> "1.2k", 980 -> "980".
  const formatViews = (n) => {
    if (n == null) return null;
    if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
    return String(n);
  };

  // Share the article (grows reach via word of mouth — the safe alternative
  // to a public comment section on a health blog).
  const articleUrl = `https://www.promedicoz.in/blog/${slug}`;
  // Hindi-reading users (Hinglish mode) get a warm Hinglish caption so a
  // WhatsApp-status share reads naturally in their language. The article TITLE
  // stays English because the blog has no Hindi title (its Hindi version is
  // Hinglish body text with English headings) — so a Hinglish caption + the
  // English title is the honest, natural message.
  const inHindi = lang === 'hi' && hasHindi;
  const shareText = article
    ? (inHindi
        ? `${article.title}\n\nYeh health jaankari apne parivaar aur doston ke saath share karein 🙏\n${articleUrl}`
        : `${article.title} — ProMedicoz\n${articleUrl}`)
    : articleUrl;
  const copyLink = async () => {
    trackEvent('share_article', { article_slug: slug, method: 'copy_link' });
    try { await navigator.clipboard.writeText(articleUrl); toast.success(inHindi ? 'Link copy ho gaya!' : 'Link copied!'); }
    catch { window.prompt(inHindi ? 'Yeh link copy karein:' : 'Copy this link:', articleUrl); }
  };
  const nativeShare = async () => {
    trackEvent('share_article', { article_slug: slug, method: 'native_share' });
    if (navigator.share) {
      try { await navigator.share({ title: article?.title, text: shareText, url: articleUrl }); return; } catch { /* cancelled */ }
    }
    copyLink();
  };
  // Instagram gives websites NO way to post a link directly (its API forbids
  // it). The closest real path: on a phone, the native share sheet lets the
  // user "Share to Instagram Story"; on desktop there's no such option, so we
  // copy the link and tell them to paste it into their bio / Story. This keeps
  // the promise honest instead of pretending a direct post is possible.
  const shareInstagram = async () => {
    trackEvent('share_article', { article_slug: slug, method: 'instagram' });
    if (navigator.share) {
      try { await navigator.share({ title: article?.title, text: shareText, url: articleUrl }); return; } catch { /* cancelled */ }
    }
    try { await navigator.clipboard.writeText(articleUrl); }
    catch { window.prompt(inHindi ? 'Yeh link copy karein:' : 'Copy this link:', articleUrl); }
    toast(inHindi
      ? 'Link copy ho gaya — Instagram kholein aur apni Story ya bio me paste karein 📸'
      : 'Link copied — open Instagram and paste it in your Story or bio 📸', { icon: '📸' });
  };

  // Known article whose body is still downloading: show the same loading
  // placeholder the app uses for lazy pages (never a misleading "not found").
  if (meta && !article && !bodyFailed) {
    return (
      <div className="flex-grow flex items-center justify-center py-20 text-gray-500">Loading…</div>
    );
  }

  // Known article, but its body couldn't be fetched (e.g. the connection
  // dropped) — offer a retry rather than claiming it doesn't exist.
  if (meta && bodyFailed) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-800">Couldn't load this article</h1>
        <p className="text-gray-600 mt-2">Please check your connection and try again.</p>
        <button onClick={() => window.location.reload()} className="text-primary-600 hover:underline mt-4 inline-block">Try again</button>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-800">Article not found</h1>
        <Link to="/blog" className="text-primary-600 hover:underline mt-4 inline-block">← Back to blog</Link>
      </div>
    );
  }

  // Related articles: same specialty first (most relevant to what the reader
  // is already interested in), then fill up to 3 with other recent articles.
  // (Worked out at build time by gen-blog-meta.mjs and shipped in this
  // article's own file.)
  const relatedArticles = Array.isArray(article.related) ? article.related : [];

  // Article structured data for Google. Richer fields (image, dateModified,
  // mainEntityOfPage) improve eligibility for article rich results. We reuse
  // the site's OG image since articles use an emoji, not a photo.
  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.description,
    image: 'https://www.promedicoz.in/og-image.png',
    datePublished: article.publishedDate,
    dateModified: article.publishedDate,
    mainEntityOfPage: { '@type': 'WebPage', '@id': articleUrl },
    author: { '@type': 'Organization', name: 'ProMedicoz', url: 'https://www.promedicoz.in' },
    publisher: { '@type': 'Organization', name: 'ProMedicoz', logo: { '@type': 'ImageObject', url: 'https://www.promedicoz.in/icons/icon-512.png' } }
  };

  const toolBtn = 'inline-flex items-center gap-1.5 h-9 px-3 rounded-full border text-sm font-medium transition-colors';
  const doctorsLink = `/doctors?specialization=${encodeURIComponent(article.specialization)}`;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Reading progress — a thin bar at the very top of the screen. */}
      <div className="fixed top-0 left-0 right-0 h-1 z-[60] pointer-events-none" aria-hidden="true">
        <div ref={barRef} className="h-full bg-primary-600 origin-left" style={{ transform: 'scaleX(0)' }} />
      </div>
      <SEO
        title={isHindiPage ? (article.titleHi || `${article.title} (Hindi mein)`) : article.title}
        description={article.description}
        path={isHindiPage ? `/blog/${slug}/hi` : `/blog/${slug}`}
        type="article"
      />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(articleSchema)}</script>
      </Helmet>

      <div className="max-w-3xl mx-auto">
        <Link to="/blog" className="text-primary-600 hover:underline text-sm mb-6 inline-block">← Back to all articles</Link>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="px-2 py-0.5 bg-primary-50 text-primary-700 rounded text-xs font-medium">{article.specialization}</span>
            <span className="text-xs text-gray-400">{article.readTime} read</span>
            <span className="text-xs text-gray-400">•</span>
            <span className="text-xs text-gray-400">{new Date(article.publishedDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            {/* Public read counter — only shown once we have a number, so the
                header doesn't flash an empty element while it loads. */}
            {views != null && (
              <>
                <span className="text-xs text-gray-400">•</span>
                <span className="text-xs text-gray-400">👁 {formatViews(views)} {views === 1 ? 'read' : 'reads'}</span>
              </>
            )}
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-4 break-words">{hiUi && article.titleHi ? article.titleHi : article.title}</h1>
          <p className="text-lg text-gray-600">{article.description}</p>
        </div>

        {/* Reading tools: listen, text size, save. */}
        <div className="mb-4 flex flex-wrap items-center gap-2" role="toolbar" aria-label={hiUi ? 'Padhne ke tools' : 'Reading tools'}>
          {canSpeak && chunks.length > 0 && (
            <>
              <button
                type="button"
                onClick={onListen}
                aria-pressed={speech === 'playing'}
                className={`${toolBtn} ${speech === 'playing' ? 'bg-primary-600 border-primary-600 text-white' : 'bg-white border-primary-200 text-primary-700 hover:bg-primary-50'}`}
              >
                <span aria-hidden="true">{speech === 'playing' ? '⏸' : '🔊'}</span>
                {speech === 'playing' ? (hiUi ? 'Roken' : 'Pause') : speech === 'paused' ? (hiUi ? 'Aage sunein' : 'Resume') : (hiUi ? 'Sunein' : 'Listen')}
              </button>
              {speech !== 'idle' && (
                <button type="button" onClick={() => stopSpeech()} className={`${toolBtn} bg-white border-gray-300 text-gray-700 hover:bg-gray-50`} aria-label={hiUi ? 'Sunna band karein' : 'Stop listening'}>
                  <span aria-hidden="true">⏹</span>{hiUi ? 'Band' : 'Stop'}
                </button>
              )}
            </>
          )}
          <div className="inline-flex rounded-full border border-gray-300 bg-white overflow-hidden" role="group" aria-label={hiUi ? 'Akshar ka size' : 'Text size'}>
            <button type="button" onClick={() => changeZoom(-1)} disabled={zoom === ZOOMS[0]} className="h-9 px-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40" aria-label={hiUi ? 'Chhote akshar' : 'Smaller text'}>A−</button>
            <button type="button" onClick={() => changeZoom(1)} disabled={zoom === ZOOMS[ZOOMS.length - 1]} className="h-9 px-3 text-base font-bold text-gray-700 hover:bg-gray-50 border-l border-gray-300 disabled:opacity-40" aria-label={hiUi ? 'Bade akshar' : 'Bigger text'}>A+</button>
          </div>
          <button
            type="button"
            onClick={onSave}
            aria-pressed={saved}
            className={`${toolBtn} ${saved ? 'bg-amber-50 border-amber-300 text-amber-800' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            <span aria-hidden="true">{saved ? '⭐' : '☆'}</span>
            {saved ? 'Saved' : (hiUi ? 'Baad me padhein' : 'Save')}
          </button>
        </div>

        {/* Jump chips: warning signs first (red), then the article's sections. */}
        {(warnId || sections.length >= 3) && (
          <nav className="mb-6" aria-label={hiUi ? 'Is article me' : 'In this article'}>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">{hiUi ? 'Is article me' : 'In this article'}</p>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x" style={{ scrollbarWidth: 'none' }}>
              {warnId && (
                <button type="button" onClick={() => jumpTo(warnId, 'warning')} className="snap-start flex-shrink-0 h-9 px-3 rounded-full bg-red-50 border border-red-200 text-red-700 text-sm font-semibold hover:bg-red-100">
                  ⚠️ {hiUi ? 'Khatre ke sanket' : 'Warning signs'}
                </button>
              )}
              {sections.length >= 3 && sections.map((s) => (
                <button key={s.id} type="button" onClick={() => jumpTo(s.id, 'section')} className="snap-start flex-shrink-0 max-w-[16rem] truncate h-9 px-3 rounded-full bg-gray-50 border border-gray-200 text-gray-700 text-sm hover:bg-primary-50 hover:border-primary-200">
                  {s.text}
                </button>
              ))}
            </div>
          </nav>
        )}

        {/* Pregnancy articles only: point readers to the free due-date tool
            near the top, where they will actually see it. */}
        {PREGNANCY_ARTICLE_SLUGS.has(slug) && (
          <Link
            to={dueDatePath(lang === 'hi' && hasHindi ? 'hi' : 'en')}
            onClick={() => trackEvent('tool_due_date_entry', { source: 'article_card', article_slug: slug })}
            className="mb-6 flex items-center gap-3 rounded-lg border border-pink-200 bg-pink-50 px-4 py-3 hover:bg-pink-100 transition-colors"
          >
            <span className="text-2xl" aria-hidden="true">🤰</span>
            <span className="flex-1">
              <span className="block text-sm font-semibold text-pink-800">
                {lang === 'hi' && hasHindi ? 'Pregnant hain? Due date jaanein' : 'Pregnant? Find your due date'}
              </span>
              <span className="block text-xs text-pink-700">
                {lang === 'hi' && hasHindi ? 'Kitne hafte · kaun si timaahi · free' : 'How many weeks · which trimester · free'}
              </span>
            </span>
            <span className="text-pink-700 font-semibold" aria-hidden="true">→</span>
          </Link>
        )}

        {/* Period / fertility articles: point to the ovulation calculator. */}
        {CYCLE_ARTICLE_SLUGS.has(slug) && (
          <Link
            to={ovulationPath(lang === 'hi' && hasHindi ? 'hi' : 'en')}
            onClick={() => trackEvent('tool_ovulation_entry', { source: 'article_card', article_slug: slug })}
            className="mb-6 flex items-center gap-3 rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 hover:bg-violet-100 transition-colors"
          >
            <span className="text-2xl" aria-hidden="true">🌷</span>
            <span className="flex-1">
              <span className="block text-sm font-semibold text-violet-800">
                {lang === 'hi' && hasHindi ? 'Agla period aur fertile days jaanein' : 'Find your next period & fertile days'}
              </span>
              <span className="block text-xs text-violet-700">
                {lang === 'hi' && hasHindi ? 'Free ovulation calculator · kuch bhi save nahi hota' : 'Free ovulation calculator · nothing is saved'}
              </span>
            </span>
            <span className="text-violet-700 font-semibold" aria-hidden="true">→</span>
          </Link>
        )}

        {/* Lab-test articles: point to Report Samjhao. */}
        {REPORT_ARTICLE_SLUGS.has(slug) && (
          <Link
            to={reportPath(lang === 'hi' && hasHindi ? 'hi' : 'en')}
            onClick={() => trackEvent('tool_report_entry', { source: 'article_card', article_slug: slug })}
            className="mb-6 flex items-center gap-3 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 hover:bg-indigo-100 transition-colors"
          >
            <span className="text-2xl" aria-hidden="true">🧪</span>
            <span className="flex-1">
              <span className="block text-sm font-semibold text-indigo-800">
                {lang === 'hi' && hasHindi ? 'Apni blood report samjhein' : 'Understand your blood report'}
              </span>
              <span className="block text-xs text-indigo-700">
                {lang === 'hi' && hasHindi ? 'Photo lein ya values daalein · kuch upload nahi hota' : 'Take a photo or type values · nothing is uploaded'}
              </span>
            </span>
            <span className="text-indigo-700 font-semibold" aria-hidden="true">→</span>
          </Link>
        )}

        {/* Baby / child-health articles: point to the vaccination schedule. */}
        {BABY_ARTICLE_SLUGS.has(slug) && (
          <Link
            to={vaccinePath(lang === 'hi' && hasHindi ? 'hi' : 'en')}
            onClick={() => trackEvent('tool_vaccine_entry', { source: 'article_card', article_slug: slug })}
            className="mb-6 flex items-center gap-3 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 hover:bg-teal-100 transition-colors"
          >
            <span className="text-2xl" aria-hidden="true">💉</span>
            <span className="flex-1">
              <span className="block text-sm font-semibold text-teal-800">
                {lang === 'hi' && hasHindi ? 'Baby ko teeka kab lagega?' : "Your baby's vaccine dates"}
              </span>
              <span className="block text-xs text-teal-700">
                {lang === 'hi' && hasHindi ? 'Janm tithi daalein · sarkari schedule · free' : 'Enter date of birth · govt. schedule · free'}
              </span>
            </span>
            <span className="text-teal-700 font-semibold" aria-hidden="true">→</span>
          </Link>
        )}

        {/* Language toggle — only shown for articles that have a Hinglish
            version. Lets readers who find English hard switch to Hinglish
            (Hindi in Roman letters). Defaults to English. */}
        {hasHindi && (
          <div className="mb-6 rounded-lg border border-primary-200 bg-primary-50 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className="text-lg">🇮🇳</span>
              {/* When reading English, actively invite Hindi readers to switch —
                  this is the discoverability nudge so they notice the option.
                  When already in Hinglish, show a neutral label. */}
              <span className="text-sm font-medium text-gray-700">
                {lang === 'en'
                  ? 'यह लेख हिंदी में भी उपलब्ध है — पढ़ने के लिए चुनें 👉'
                  : 'भाषा / Language:'}
              </span>
            </div>
            <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden bg-white flex-shrink-0">
              <button
                type="button"
                onClick={() => setLang('en')}
                aria-pressed={lang === 'en'}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${lang === 'en' ? 'bg-primary-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
              >English</button>
              <button
                type="button"
                onClick={() => { setLang('hi'); trackEvent('language_toggle', { article_slug: slug, to_language: 'hinglish' }); }}
                aria-pressed={lang === 'hi'}
                className={`px-3 py-1.5 text-sm font-medium transition-colors border-l border-gray-300 ${lang === 'hi' ? 'bg-primary-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
              >हिंदी (Hinglish)</button>
            </div>
          </div>
        )}

        {/* Top CTA — a compact, inline nudge for readers who are ready to act
            immediately, so conversion does not depend on scrolling to the very
            bottom. Bilingual (follows the language toggle) and tracked. The
            fuller CTA card remains at the end of the article. */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary-200 bg-primary-50 px-4 py-3">
          <span className="text-sm text-gray-700">
            {lang === 'hi' && hasHindi
              ? `${article.specialization} se baat karni hai? ProMedicoz par online ya in-person consult karein.`
              : `Want to consult a ${article.specialization.toLowerCase()}? Talk to a verified one on ProMedicoz — online or in person.`}
          </span>
          <Link
            to={`/doctors?specialization=${encodeURIComponent(article.specialization)}`}
            onClick={() => trackEvent('find_doctor_click', { article_slug: slug, specialization: article.specialization, cta_position: 'top' })}
            className="btn btn-primary flex-shrink-0 px-4"
          >
            {lang === 'hi' && hasHindi ? `${article.specialization} dhoondhein` : `Find a ${article.specialization}`}
          </Link>
        </div>

        {/* Content — `linkCtx` is created fresh per render so internal
            auto-links are deduped across the whole article (each target linked
            once) and never link back to this same article. Renders either the
            English content or, when the reader picks it, the Hinglish version. */}
        <div ref={bodyRef} className="max-w-none" style={zoom !== 1 ? { zoom } : undefined}>
          {renderedBody}
        </div>

        {/* CTA — bilingual (follows the language toggle) and tracked, so we can
            measure which articles actually drive readers to find a doctor. */}
        <div ref={endCtaRef} className="mt-10 p-6 bg-primary-50 border border-primary-200 rounded-xl text-center">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">
            {lang === 'hi' && hasHindi
              ? `${article.specialization} consultation chahiye?`
              : `Need a ${article.specialization} consultation?`}
          </h3>
          <p className="text-gray-600 text-sm mb-4">
            {lang === 'hi' && hasHindi
              ? `ProMedicoz par ek verified ${article.specialization.toLowerCase()} se appointment book karein. Video, phone, ya in-person.`
              : `Book an appointment with a verified ${article.specialization.toLowerCase()} on ProMedicoz. Video, phone, or in-person.`}
          </p>
          <Link
            to={`/doctors?specialization=${encodeURIComponent(article.specialization)}`}
            onClick={() => trackEvent('find_doctor_click', { article_slug: slug, specialization: article.specialization, cta_position: 'bottom' })}
            className="btn btn-primary"
          >
            {lang === 'hi' && hasHindi ? `${article.specialization} Doctors Dhoondhein` : `Find ${article.specialization} Doctors`}
          </Link>
        </div>

        {/* Share this article — safe engagement that grows reach (vs a public
            comment section, which we deliberately avoid on a health blog).
            A warm, human message invites sharing rather than just demanding it.
            When the reader has switched the article to Hinglish, the message
            follows suit so the whole page speaks one language. */}
        <div className="mt-8 p-5 bg-primary-50 border border-primary-100 rounded-xl">
          <p className="text-base font-semibold text-gray-800">
            {lang === 'hi' && hasHindi
              ? 'Yeh sach mein helpful laga? ❤️'
              : 'Found this genuinely helpful? ❤️'}
          </p>
          <p className="mt-1 text-sm text-gray-600">
            {lang === 'hi' && hasHindi
              ? 'Achhi health jaankari aage pahunchane layak hoti hai. Agar isse aapko madad mili, to ise apne parivaar aur doston ke saath share karein — ho sakta hai yeh theek wahi ho jiski aapke kisi apne ko aaj zaroorat hai.'
              : 'Good health information is worth passing on. If this helped you, share it with your family and friends — it might be exactly what someone you love needs today.'}
          </p>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-gray-700">
            {lang === 'hi' && hasHindi ? 'Is article ko share karein:' : 'Share this article:'}
          </span>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
            onClick={() => trackEvent('share_article', { article_slug: slug, method: 'whatsapp' })}
            target="_blank" rel="noopener noreferrer"
            className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600"
          >💬 WhatsApp</a>
          <a
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(articleUrl)}`}
            onClick={() => trackEvent('share_article', { article_slug: slug, method: 'facebook' })}
            target="_blank" rel="noopener noreferrer"
            className="px-4 py-2 bg-[#1877F2] text-white rounded-lg text-sm font-medium hover:bg-[#0d65d9]"
          >📘 Facebook</a>
          <button
            onClick={shareInstagram}
            className="px-4 py-2 text-white rounded-lg text-sm font-medium bg-gradient-to-r from-[#f58529] via-[#dd2a7b] to-[#8134af] hover:opacity-90"
          >📸 Instagram</button>
          <a
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(article?.title ? `${article.title} — ProMedicoz` : 'ProMedicoz')}&url=${encodeURIComponent(articleUrl)}`}
            onClick={() => trackEvent('share_article', { article_slug: slug, method: 'twitter' })}
            target="_blank" rel="noopener noreferrer"
            className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800"
          >𝕏 Twitter</a>
          <button onClick={nativeShare} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700">📤 Share</button>
          <button onClick={copyLink} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">🔗 Copy link</button>
        </div>

        {/* ❤️ Like — a friendly heart backed by our DB, with a visible count.
            Toggles this browser's own like on/off; the number is the total
            across all readers. Feeds the "Most Loved" section on the blog list. */}
        <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700">{liked ? 'Glad you loved it!' : 'Enjoyed this article?'}</span>
          <button
            onClick={toggleLike}
            aria-pressed={liked}
            aria-label={liked ? 'Unlike this article' : 'Like this article'}
            className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              liked
                ? 'bg-red-50 border-red-200 text-red-600'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-red-50 hover:border-red-200 hover:text-red-600'
            }`}
          >
            <span className={`text-lg leading-none ${liked ? '' : 'grayscale'}`}>{liked ? '❤️' : '🤍'}</span>
            <span>{liked ? 'Liked' : 'Like'}</span>
            {likeCount != null && likeCount > 0 && (
              <span className={`ml-1 ${liked ? 'text-red-600' : 'text-gray-500'}`}>{formatViews(likeCount)}</span>
            )}
          </button>
        </div>

        {/* Related articles — prefer the SAME specialty first (so a reader on
            "cholesterol" is offered "high BP", "belly fat", etc.), then fill
            with other recent articles. This keeps people reading instead of
            bouncing after one article. */}
        <div className="mt-10">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">{hiUi ? 'Aur padhein' : 'More to read'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {relatedArticles.map(a => (
              <Link key={a.slug} to={hiUi && a.titleHi ? `/blog/${a.slug}/hi` : `/blog/${a.slug}`} className="p-4 bg-white border border-gray-100 rounded-lg hover:shadow-md transition-shadow">
                <span className="text-2xl">{a.image}</span>
                <span className="block text-xs text-primary-600 font-medium mt-2">{a.specialization}</span>
                <h4 className="font-medium text-gray-800 mt-1 text-sm line-clamp-2">{hiUi && a.titleHi ? a.titleHi : a.title}</h4>
                <span className="text-primary-600 text-xs mt-2 inline-block">{hiUi ? 'Padhein →' : 'Read →'}</span>
              </Link>
            ))}
          </div>
          <div className="mt-5 text-center">
            <Link to="/blog" className="text-primary-600 hover:underline text-sm font-medium">{hiUi ? 'Saare health articles dekhein →' : 'Browse all health articles →'}</Link>
          </div>
        </div>
      </div>

      {/* Sticky "Talk to a doctor" bar — appears once the reader is into the
          article, sits above the mobile bottom tabs and leaves room on the
          right for the WhatsApp button. Hidden near the end, where the big
          CTA card already is. */}
      <div
        className={`fixed z-40 left-3 right-[4.5rem] md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-[36rem] bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:bottom-4 transition-all duration-300 ${showSticky ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'}`}
        aria-hidden={!showSticky}
      >
        <div className="flex items-center gap-2 rounded-2xl bg-white border border-primary-200 shadow-lg pl-3 pr-1.5 py-1.5">
          <span className="text-xl" aria-hidden="true">🩺</span>
          <span className="flex-1 min-w-0 leading-tight">
            <span className="block text-[11px] text-gray-500">{hiUi ? 'Online baat karein' : 'Talk to a'}</span>
            <span className="block text-sm font-semibold text-gray-800 truncate">{article.specialization}</span>
          </span>
          <Link
            to={doctorsLink}
            tabIndex={showSticky ? 0 : -1}
            onClick={() => trackEvent('find_doctor_click', { article_slug: slug, specialization: article.specialization, cta_position: 'sticky' })}
            className="flex-shrink-0 rounded-xl bg-primary-600 text-white text-sm font-semibold px-3 py-2 hover:bg-primary-700"
          >
            {hiUi ? 'Doctor dekhein' : 'See doctors'}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default BlogArticle;
