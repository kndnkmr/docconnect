import { Helmet } from 'react-helmet-async';

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

  const data = {
    '@context': 'https://schema.org',
    '@type': 'Physician',
    name: doctor.name,
    medicalSpecialty: doctor.specialization || 'General Practice',
    description: doctor.bio || `${doctor.name} - ${doctor.specialization || 'Doctor'} on ProMedicoz`,
    url: `https://www.promedicoz.in/doctors/${doctor._id}`,
    image: doctor.profilePhoto || 'https://www.promedicoz.in/icons/icon-512.png',
    address: doctor.clinicAddress ? {
      '@type': 'PostalAddress',
      streetAddress: doctor.clinicAddress,
      addressCountry: 'IN'
    } : undefined,
    priceRange: doctor.consultationFee ? `INR ${doctor.consultationFee}` : undefined
  };

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(data)}</script>
    </Helmet>
  );
}
