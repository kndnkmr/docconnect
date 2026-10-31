import { Helmet } from 'react-helmet-async';
import { seoTitle, seoDescription, SITE_NAME, DEFAULT_TITLE } from '../utils/seoText';

// Reusable SEO component — sets unique title, description, and Open Graph tags per page
function SEO({ title, description, path = '/', type = 'website', noindex = false }) {
  const siteName = SITE_NAME;
  const baseUrl = 'https://www.promedicoz.in';
  // Search title: brand only if it still fits (utils/seoText.js — the
  // prerender uses the same rule). Share previews keep the full brand.
  const searchTitle = seoTitle(title);
  const fullTitle = title ? `${title} | ${siteName}` : DEFAULT_TITLE;
  const desc = description || 'Book doctor appointments online. Find specialists, choose time slots, video or in-person consultations across India.';
  const url = `${baseUrl}${path}`;

  return (
    <Helmet>
      <title>{searchTitle}</title>
      <meta name="description" content={seoDescription(desc)} />
      {/* Keep utility pages (login, register, dashboards) out of search results
          so they don't compete with or dilute the brand's real content pages. */}
      {noindex && <meta name="robots" content="noindex, follow" />}
      <link rel="canonical" href={url} />

      {/* Open Graph — for WhatsApp, Facebook, LinkedIn sharing */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={siteName} />
      <meta property="og:image" content={`${baseUrl}/og-image.png`} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />

      {/* Twitter Card — large image for a proper banner preview */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={desc} />
      <meta name="twitter:image" content={`${baseUrl}/og-image.png`} />
    </Helmet>
  );
}

export default SEO;
