import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doctorAPI } from '../services/api';
import SEO from '../components/SEO';
import InitialsAvatar from '../components/InitialsAvatar';
import { Helmet } from 'react-helmet-async';

// Data for each specialization — SEO content, FAQs, conditions
const specializationData = {
  'gynaecologist': {
    title: 'Gynaecologist',
    subtitle: 'Women\'s Health Specialist',
    description: 'Gynaecologists specialize in women\'s reproductive health, pregnancy care, fertility treatments, and menstrual disorders.',
    conditions: ['Irregular periods', 'PCOD/PCOS', 'Pregnancy care', 'Infertility/IVF', 'Menopause', 'Endometriosis', 'Fibroids', 'Cervical screening'],
    icon: '🤰',
    faqs: [
      { q: 'When should I see a gynaecologist?', a: 'You should visit a gynaecologist for irregular periods, pregnancy planning, pelvic pain, unusual discharge, or routine screening after age 21.' },
      { q: 'How much does a gynaecologist consultation cost?', a: 'Online consultations on ProMedicoz typically range from ₹300 to ₹1000 depending on the doctor\'s experience.' },
      { q: 'Can I consult a gynaecologist online?', a: 'Yes, ProMedicoz offers video and phone consultations with experienced gynaecologists for non-emergency concerns.' },
    ]
  },
  'dermatologist': {
    title: 'Dermatologist',
    subtitle: 'Skin, Hair & Nail Specialist',
    description: 'Dermatologists diagnose and treat conditions affecting the skin, hair, and nails. From acne to hair loss, they provide expert care.',
    conditions: ['Acne & pimples', 'Hair loss', 'Skin rashes', 'Eczema', 'Psoriasis', 'Fungal infections', 'Pigmentation', 'Dandruff'],
    icon: '🧴',
    faqs: [
      { q: 'When should I see a dermatologist?', a: 'Visit a dermatologist for persistent acne, unexplained rashes, sudden hair loss, mole changes, or any skin condition lasting more than 2 weeks.' },
      { q: 'Can a dermatologist help with hair loss?', a: 'Yes, dermatologists diagnose the cause of hair loss (hormonal, nutritional, genetic) and provide treatments including medications and therapies.' },
      { q: 'Is online dermatology consultation effective?', a: 'Yes, many skin conditions can be diagnosed through photos and video consultations. The doctor may recommend tests if needed.' },
    ]
  },
  'cardiologist': {
    title: 'Cardiologist',
    subtitle: 'Heart & Cardiovascular Specialist',
    description: 'Cardiologists specialize in diagnosing and treating heart conditions, high blood pressure, cholesterol, and circulatory system disorders.',
    conditions: ['High blood pressure', 'Chest pain', 'High cholesterol', 'Heart palpitations', 'Shortness of breath', 'Heart failure', 'Arrhythmia', 'Blocked arteries'],
    icon: '❤️',
    faqs: [
      { q: 'When should I see a cardiologist?', a: 'See a cardiologist if you have chest pain, breathlessness, high BP readings (above 140/90), or a family history of heart disease.' },
      { q: 'What tests does a cardiologist recommend?', a: 'Common tests include ECG, echocardiogram, stress test, lipid profile, and in some cases angiography.' },
      { q: 'Can heart problems be managed online?', a: 'Follow-up consultations, medication reviews, and lifestyle advice can be done online. Initial evaluation may require in-person visit.' },
    ]
  },
  'neurologist': {
    title: 'Neurologist',
    subtitle: 'Brain & Nervous System Specialist',
    description: 'Neurologists treat disorders of the brain, spinal cord, and nerves including headaches, seizures, stroke, and neuropathy.',
    conditions: ['Migraine & headaches', 'Seizures/Epilepsy', 'Numbness/Tingling', 'Dizziness/Vertigo', 'Memory problems', 'Stroke', 'Parkinson\'s disease', 'Nerve pain'],
    icon: '🤕',
    faqs: [
      { q: 'When should I see a neurologist?', a: 'Visit a neurologist for frequent headaches/migraines, numbness, dizziness, memory issues, seizures, or unexplained pain.' },
      { q: 'What is the difference between a neurologist and psychiatrist?', a: 'Neurologists treat physical brain/nerve conditions (stroke, epilepsy). Psychiatrists treat mental health conditions (depression, anxiety).' },
      { q: 'Can I consult a neurologist online?', a: 'Yes, for follow-ups, medication management, and initial symptom evaluation. Some conditions may need physical examination.' },
    ]
  },
  'orthopedic': {
    title: 'Orthopedic',
    subtitle: 'Bone, Joint & Spine Specialist',
    description: 'Orthopedic doctors treat conditions affecting bones, joints, muscles, tendons, and the spine. From fractures to arthritis.',
    conditions: ['Back pain', 'Knee pain', 'Joint stiffness', 'Fractures', 'Arthritis', 'Slip disc', 'Sports injuries', 'Shoulder pain'],
    icon: '🦴',
    faqs: [
      { q: 'When should I see an orthopedic doctor?', a: 'See an orthopedic if you have persistent joint or back pain, limited mobility, swelling, or after any bone/muscle injury.' },
      { q: 'Do I need surgery for back pain?', a: 'Most back pain resolves with medication, physiotherapy, and lifestyle changes. Only 5-10% of cases need surgery.' },
      { q: 'Can orthopedic consultations be done online?', a: 'Yes, for initial assessment, medication review, and physiotherapy guidance. X-ray reports can be shared online.' },
    ]
  },
  'pediatrician': {
    title: 'Pediatrician',
    subtitle: 'Child Health Specialist',
    description: 'Pediatricians specialize in healthcare for infants, children, and adolescents — from vaccinations to childhood diseases.',
    conditions: ['Fever in children', 'Vaccinations', 'Growth concerns', 'Allergies', 'Cough & cold', 'Childhood infections', 'Nutrition advice', 'Developmental delays'],
    icon: '👶',
    faqs: [
      { q: 'When should I take my child to a pediatrician?', a: 'For routine vaccinations, persistent fever (>3 days), breathing difficulty, unusual rashes, weight loss, or behavioral concerns.' },
      { q: 'How often should children visit a pediatrician?', a: 'Monthly for the first year, every 3 months until age 3, then annually for routine check-ups and vaccinations.' },
      { q: 'Can I consult a pediatrician online for my child?', a: 'Yes, for non-emergency concerns like mild fever, rashes, feeding issues, and medication queries.' },
    ]
  },
  'psychiatrist': {
    title: 'Psychiatrist',
    subtitle: 'Mental Health Specialist',
    description: 'Psychiatrists diagnose and treat mental health conditions including depression, anxiety, OCD, PTSD, and sleep disorders.',
    conditions: ['Depression', 'Anxiety', 'Insomnia', 'Panic attacks', 'OCD', 'PTSD', 'Bipolar disorder', 'Stress management'],
    icon: '🧠',
    faqs: [
      { q: 'When should I see a psychiatrist?', a: 'If you experience persistent sadness, anxiety, sleep problems, panic attacks, or thoughts of self-harm lasting more than 2 weeks.' },
      { q: 'Is online psychiatry consultation effective?', a: 'Yes, mental health consultations are highly effective online. Studies show similar outcomes to in-person therapy for many conditions.' },
      { q: 'Will a psychiatrist prescribe medication immediately?', a: 'Not always. Many psychiatrists start with counseling and lifestyle changes. Medication is prescribed when clinically necessary.' },
    ]
  },
  'dentist': {
    title: 'Dentist',
    subtitle: 'Dental & Oral Health Specialist',
    description: 'Dentists provide comprehensive oral healthcare including cleanings, fillings, root canals, braces, and gum disease treatment.',
    conditions: ['Toothache', 'Cavities', 'Gum bleeding', 'Bad breath', 'Teeth whitening', 'Braces', 'Wisdom tooth pain', 'Root canal'],
    icon: '🦷',
    faqs: [
      { q: 'How often should I visit a dentist?', a: 'Every 6 months for routine check-ups and cleaning, or immediately if you have pain, swelling, or bleeding gums.' },
      { q: 'Can I consult a dentist online?', a: 'For initial assessment, medication for pain/infection, and treatment planning. Procedures require in-person visits.' },
      { q: 'How much does a dental consultation cost?', a: 'Online consultations range from ₹200-₹500. In-person procedures vary by treatment type.' },
    ]
  },
  'general-physician': {
    title: 'General Physician',
    subtitle: 'Primary Care Doctor',
    description: 'General physicians are your first point of contact for most health concerns. They diagnose, treat, and refer to specialists when needed.',
    conditions: ['Fever & flu', 'Cough & cold', 'Body pain', 'Weakness', 'Infections', 'Blood pressure check', 'Diabetes management', 'General check-up'],
    icon: '🤒',
    faqs: [
      { q: 'When should I see a general physician?', a: 'For any new health concern — fever, body aches, fatigue, infections, or when you\'re unsure which specialist to visit.' },
      { q: 'Can a general physician treat chronic conditions?', a: 'Yes, they manage diabetes, hypertension, thyroid, and other chronic conditions. They refer to specialists for complex cases.' },
      { q: 'Is online consultation with a GP effective?', a: 'Very effective for common conditions like fever, cold, infections, follow-ups, and prescription renewals.' },
    ]
  },
  'ent-specialist': {
    title: 'ENT Specialist',
    subtitle: 'Ear, Nose & Throat Doctor',
    description: 'ENT specialists treat conditions of the ear, nose, throat, head, and neck including hearing loss, sinusitis, and tonsillitis.',
    conditions: ['Ear pain', 'Hearing loss', 'Sinusitis', 'Tonsillitis', 'Snoring', 'Nasal congestion', 'Throat infection', 'Vertigo'],
    icon: '👂',
    faqs: [
      { q: 'When should I see an ENT specialist?', a: 'For persistent ear pain, hearing issues, chronic sinusitis, frequent throat infections, snoring, or voice changes.' },
      { q: 'Can ENT problems be treated online?', a: 'Medication for infections, allergy management, and follow-ups can be done online. Some conditions need physical examination.' },
      { q: 'What does an ENT consultation involve?', a: 'The doctor examines your ear, nose, and throat, reviews symptoms, and may recommend hearing tests or scans.' },
    ]
  },
};

function SpecializationPage() {
  const { slug } = useParams();
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);

  const data = specializationData[slug];
  const specName = data?.title || slug;

  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const response = await doctorAPI.getAll({ specialization: specName, limit: 6 });
        setDoctors(response.data.doctors);
      } catch (error) {
        console.error('Fetch doctors error:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchDoctors();
  }, [slug, specName]);

  if (!data) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-800">Specialization not found</h1>
        <Link to="/doctors" className="text-primary-600 hover:underline mt-4 inline-block">Browse all doctors →</Link>
      </div>
    );
  }

  // FAQ structured data for Google "People Also Ask"
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: data.faqs.map(faq => ({
      '@type': 'Question',
      name: faq.q,
      acceptedAnswer: { '@type': 'Answer', text: faq.a }
    }))
  };

  return (
    <div>
      <SEO
        title={`Best ${data.title} Doctors Online - Book Appointment`}
        description={`Consult top ${data.title.toLowerCase()} doctors online on ProMedicoz. ${data.description} Book video, phone or in-person consultation.`}
        path={`/specialization/${slug}`}
      />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
      </Helmet>

      {/* Hero section */}
      <section className="bg-gradient-to-r from-primary-600 to-primary-800 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-4 mb-4">
            <span className="text-5xl">{data.icon}</span>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold">{data.title}</h1>
              <p className="text-primary-200 text-lg">{data.subtitle}</p>
            </div>
          </div>
          <p className="text-primary-100 max-w-2xl text-lg">{data.description}</p>
          <Link
            to={`/doctors?specialization=${encodeURIComponent(specName)}`}
            className="inline-block mt-6 bg-white text-primary-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
          >
            Book {data.title} Consultation
          </Link>
        </div>
      </section>

      {/* Common conditions */}
      <section className="py-10 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Common Conditions Treated</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {data.conditions.map((condition, idx) => (
              <div key={idx} className="bg-gray-50 border border-gray-100 rounded-lg p-3 text-center">
                <p className="text-sm font-medium text-gray-700">{condition}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Doctors listing */}
      <section className="py-10 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Top {data.title} Doctors on ProMedicoz</h2>
          {loading ? (
            <p className="text-gray-500">Loading doctors...</p>
          ) : doctors.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center">
              <p className="text-gray-600 mb-4">No {data.title.toLowerCase()} doctors registered yet.</p>
              <Link to="/register?role=doctor" className="text-primary-600 font-medium hover:underline">
                Are you a {data.title.toLowerCase()}? Register now →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {doctors.map((doc) => (
                <Link key={doc._id} to={`/doctors/${doc._id}`} className="bg-white rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow block">
                  <div className="flex items-center gap-3 mb-2">
                    {doc.profilePhoto ? (
                      <img src={doc.profilePhoto} alt={doc.name} className="w-12 h-12 rounded-full object-cover" />
                    ) : (
                      <InitialsAvatar name={doc.name} className="w-12 h-12" textClass="text-base" />
                    )}
                    <div>
                      <h3 className="font-semibold text-gray-800">{doc.name}</h3>
                      <p className="text-sm text-gray-500">{doc.experience || 0} yrs exp</p>
                    </div>
                  </div>
                  {doc.consultationFee > 0 && <p className="text-sm text-gray-600">Consultation: ₹{doc.consultationFee}</p>}
                  <span className="text-primary-600 text-sm font-medium mt-2 inline-block">Book Appointment →</span>
                </Link>
              ))}
            </div>
          )}
          <div className="text-center mt-6">
            <Link to={`/doctors?specialization=${encodeURIComponent(specName)}`} className="text-primary-600 font-medium hover:underline">
              View all {data.title.toLowerCase()} doctors →
            </Link>
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className="py-10 bg-white">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {data.faqs.map((faq, idx) => (
              <div key={idx} className="border border-gray-200 rounded-xl p-5">
                <h3 className="font-semibold text-gray-800 mb-2">{faq.q}</h3>
                <p className="text-gray-600 text-sm">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-10 bg-primary-50">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-xl font-bold text-gray-800 mb-3">Need a {data.title} consultation?</h2>
          <p className="text-gray-600 mb-5">Book an appointment in under 2 minutes. Video, phone, or in-person.</p>
          <Link to={`/doctors?specialization=${encodeURIComponent(specName)}`} className="bg-primary-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors inline-block">
            Find {data.title} Doctors
          </Link>
        </div>
      </section>
    </div>
  );
}

export default SpecializationPage;
