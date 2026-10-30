// ============================================
// Free health tools hub (/tools)
// ============================================
// One simple page listing every free tool, in English or Hindi. Gives search
// engines and social bios one place that links to all tools. The tool list
// (TOOLS) is shared with the prerender via ./toolsList.js.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import SEO from '../../components/SEO';
import LangToggle from '../../components/LangToggle';
import { trackEvent } from '../../components/Analytics';
import { TOOLS, HUB_COPY } from './toolsList';

function ToolsHub() {
  const [lang, setLang] = useState(() => {
    try {
      const saved = localStorage.getItem('promedicoz_lang');
      if (saved === 'en' || saved === 'hi') return saved;
    } catch { /* ignore */ }
    return 'en';
  });
  const t = HUB_COPY[lang] || HUB_COPY.en;

  return (
    <div className="flex-grow bg-gray-50">
      <SEO title={HUB_COPY.en.seoTitle} description={HUB_COPY.en.seoDesc} path="/tools" />

      <section className="bg-gradient-to-br from-primary-600 to-primary-800 text-white">
        <div className="container mx-auto px-4 pt-8 pb-16 max-w-2xl">
          <div className="flex justify-end">
            <LangToggle lang={lang} onChange={setLang} />
          </div>
          <h1 className="mt-4 text-2xl sm:text-3xl font-bold">{t.title}</h1>
          <p className="mt-1 text-primary-100 text-sm sm:text-base">{t.subtitle}</p>
        </div>
      </section>

      <div className="container mx-auto px-4 max-w-2xl -mt-10 pb-12">
        <ul className="grid gap-3">
          {TOOLS.map((tool) => (
            <li key={tool.path}>
              <Link
                to={lang === 'hi' ? `${tool.path}/hi` : tool.path}
                onClick={() => trackEvent('tool_hub_click', { tool: tool.id })}
                className={`flex items-center gap-4 rounded-2xl border p-5 shadow-sm hover:shadow-md transition ${tool.cls}`}
              >
                <span className="text-3xl" aria-hidden="true">{tool.emoji}</span>
                <span className="flex-1">
                  <span className="block font-bold">{tool.name[lang] || tool.name.en}</span>
                  <span className="block text-sm opacity-80">{tool.desc[lang] || tool.desc.en}</span>
                </span>
                <span className="font-semibold" aria-hidden="true">→</span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-xs text-gray-600 text-center leading-relaxed">🔒 {t.privacy}</p>
      </div>
    </div>
  );
}

export default ToolsHub;
