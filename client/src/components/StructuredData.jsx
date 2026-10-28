import { Helmet } from 'react-helmet-async';
import { doctorJsonLd } from '../utils/doctorSeo';

// Structured Data component — adds JSON-LD Schema.org markup
// This helps Google understand what ProMedicoz is and show rich snippets

export function WebsiteSchema() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'MedicalBusiness',
    name: 'ProMedicoz',
    url: 'https://www.promedicoz.in',
    logo: 'https://www.promedicoz.in/icons/icon-512.png',
    description: 'Book doctor appointments online. Find specialists across 24+ departments, choose time slots, and consult via video, phone, or in-person.',
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'IN'
    },
    areaServed: 'India',
    serviceType: 'Online Doctor Consultation',
    availableChannel: {
      '@type': 'ServiceChannel',
      serviceUrl: 'https://www.promedicoz.in/doctors',
      availableLanguage: ['English', 'Hindi']
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: 'https://www.promedicoz.in/doctors?specialization={search_term_string}',
      'query-input': 'required name=search_term_string'
    }
  };

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(data)}</script>
    </Helmet>
  );
}

export function DoctorSchema({ doctor }) {
  if (!doctor) return null;

  // Identical to what the build bakes into the HTML (same @id, /dr/ URL,
  // city, hours, specialty) — one consistent doctor entity for Google.
  if (!doctor.slug) return null;
  const data = doctorJsonLd(doctor);

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(data)}</script>
    </Helmet>
  );
}
