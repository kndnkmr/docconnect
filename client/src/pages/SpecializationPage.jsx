import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doctorAPI, getUploadUrl } from '../services/api';
import SEO from '../components/SEO';
import { Helmet } from 'react-helmet-async';

// City <-> URL slug helpers. Cities are free-text in doctor profiles, so we
// derive a URL-safe slug ("New Delhi" -> "new-delhi") and a display name back
// from it ("new-delhi" -> "New Delhi"). The backend city filter is a
// case-insensitive "contains" match, so minor casing differences between the
// deslugified name and the stored value still match correctly.
const cityToSlug = (city) => city.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
const slugToCityName = (slug) =>
  slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

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
  'microbiologist': {
    title: 'Microbiologist',
    subtitle: 'Laboratory & Infection Specialist',
    description: 'Microbiologists are laboratory specialists who identify the bacteria, viruses, fungi, and parasites behind infections, and advise on the right tests and antibiotics. They typically support diagnosis and treatment behind the scenes rather than seeing patients for everyday illnesses.',
    conditions: ['Infection diagnosis', 'Culture & sensitivity tests', 'Antibiotic guidance', 'Lab test interpretation', 'Hospital infection control', 'Resistant infections'],
    icon: '🔬',
    faqs: [
      { q: 'What does a microbiologist do?', a: 'They work in the laboratory to identify the exact organism causing an infection and advise which antibiotic will work — supporting your treating doctor rather than replacing them.' },
      { q: 'Should I see a microbiologist for a fever or cold?', a: 'Usually no. For everyday symptoms like fever, cough, or body pain, start with a General Physician. A microbiologist helps with lab diagnosis and antibiotic guidance, often on referral.' },
      { q: 'When is a microbiologist involved in my care?', a: 'Typically when a doctor orders cultures or specialised infection tests, or for complex or antibiotic-resistant infections.' },
    ]
  },
};

// ---- Hindi content for each specialization (patient-readable). Kept SEPARATE
// from the English specializationData above ON PURPOSE: the English text is
// what feeds the SEO <title>/<description> and FAQ structured data (Google's
// index), so it must never change. This block only affects what a Hindi user
// SEES on screen. Any slug missing here simply falls back to English.
const specializationHi = {
  'gynaecologist': {
    subtitle: 'महिला स्वास्थ्य विशेषज्ञ',
    description: 'स्त्री रोग विशेषज्ञ महिलाओं के प्रजनन स्वास्थ्य, गर्भावस्था देखभाल, प्रजनन उपचार और मासिक धर्म संबंधी समस्याओं में विशेषज्ञ होते हैं।',
    conditions: ['अनियमित मासिक धर्म', 'PCOD/PCOS', 'गर्भावस्था देखभाल', 'बांझपन/IVF', 'रजोनिवृत्ति', 'एंडोमेट्रियोसिस', 'फाइब्रॉएड', 'सर्वाइकल जांच'],
    faqs: [
      { q: 'मुझे स्त्री रोग विशेषज्ञ को कब दिखाना चाहिए?', a: 'अनियमित मासिक धर्म, गर्भावस्था की योजना, पेल्विक दर्द, असामान्य स्राव, या 21 वर्ष के बाद नियमित जांच के लिए स्त्री रोग विशेषज्ञ से मिलें।' },
      { q: 'स्त्री रोग विशेषज्ञ के परामर्श का खर्च कितना है?', a: 'ProMedicoz पर ऑनलाइन परामर्श आमतौर पर डॉक्टर के अनुभव के अनुसार ₹300 से ₹1000 तक होता है।' },
      { q: 'क्या मैं ऑनलाइन स्त्री रोग विशेषज्ञ से परामर्श कर सकती हूं?', a: 'हां, ProMedicoz गैर-आपातकालीन समस्याओं के लिए अनुभवी स्त्री रोग विशेषज्ञों के साथ वीडियो और फोन परामर्श प्रदान करता है।' },
    ]
  },
  'dermatologist': {
    subtitle: 'त्वचा, बाल और नाखून विशेषज्ञ',
    description: 'त्वचा विशेषज्ञ त्वचा, बाल और नाखूनों से जुड़ी समस्याओं की जांच और इलाज करते हैं। मुहांसों से लेकर बाल झड़ने तक, वे विशेषज्ञ देखभाल देते हैं।',
    conditions: ['मुहांसे', 'बाल झड़ना', 'त्वचा पर चकत्ते', 'एक्जिमा', 'सोरायसिस', 'फंगल संक्रमण', 'रंजकता', 'रूसी'],
    faqs: [
      { q: 'मुझे त्वचा विशेषज्ञ को कब दिखाना चाहिए?', a: 'लगातार मुहांसे, असामान्य तिल, अचानक बाल झड़ना, या ठीक न होने वाले चकत्तों के लिए त्वचा विशेषज्ञ से मिलें।' },
      { q: 'क्या त्वचा की समस्याओं का ऑनलाइन इलाज हो सकता है?', a: 'हां, कई त्वचा और बाल संबंधी समस्याओं का साफ़ फोटो के आधार पर ऑनलाइन आकलन और इलाज किया जा सकता है।' },
      { q: 'त्वचा विशेषज्ञ के परामर्श में क्या होता है?', a: 'डॉक्टर आपकी त्वचा/बालों की जांच करते हैं, लक्षण समझते हैं, और उपचार या ज़रूरत पड़ने पर जांच की सलाह देते हैं।' },
    ]
  },
  'cardiologist': {
    subtitle: 'हृदय एवं रक्त वाहिका विशेषज्ञ',
    description: 'हृदय रोग विशेषज्ञ हृदय की बीमारियों, उच्च रक्तचाप, कोलेस्ट्रॉल और रक्त संचार से जुड़ी समस्याओं की जांच और इलाज करते हैं।',
    conditions: ['उच्च रक्तचाप', 'छाती में दर्द', 'उच्च कोलेस्ट्रॉल', 'धड़कन तेज़ होना', 'सांस फूलना', 'हृदय की कमज़ोरी', 'अनियमित धड़कन', 'बंद धमनियां'],
    faqs: [
      { q: 'मुझे हृदय रोग विशेषज्ञ को कब दिखाना चाहिए?', a: 'छाती में दर्द, सांस फूलना, अनियमित धड़कन, उच्च रक्तचाप या हृदय रोग के पारिवारिक इतिहास पर हृदय रोग विशेषज्ञ से मिलें।' },
      { q: 'क्या हृदय संबंधी समस्याओं के लिए ऑनलाइन परामर्श ठीक है?', a: 'रिपोर्ट समीक्षा, दवा और फॉलो-अप के लिए ऑनलाइन परामर्श उपयोगी है, लेकिन आपातकाल में तुरंत नज़दीकी अस्पताल जाएं।' },
      { q: 'हृदय की जांच में क्या होता है?', a: 'डॉक्टर लक्षण और इतिहास देखते हैं और ज़रूरत पड़ने पर ECG, इको या रक्त जांच की सलाह देते हैं।' },
    ]
  },
  'neurologist': {
    subtitle: 'मस्तिष्क एवं तंत्रिका तंत्र विशेषज्ञ',
    description: 'न्यूरोलॉजिस्ट मस्तिष्क, रीढ़ की हड्डी और तंत्रिकाओं के विकारों का इलाज करते हैं, जैसे सिरदर्द, दौरे, स्ट्रोक और तंत्रिका दर्द।',
    conditions: ['माइग्रेन और सिरदर्द', 'दौरे/मिर्गी', 'सुन्नपन/झनझनाहट', 'चक्कर आना', 'याददाश्त की समस्या', 'स्ट्रोक', 'पार्किंसंस', 'तंत्रिका दर्द'],
    faqs: [
      { q: 'मुझे न्यूरोलॉजिस्ट को कब दिखाना चाहिए?', a: 'बार-बार तेज़ सिरदर्द, दौरे, सुन्नपन, चक्कर, या याददाश्त संबंधी समस्याओं के लिए न्यूरोलॉजिस्ट से मिलें।' },
      { q: 'क्या तंत्रिका संबंधी समस्याओं का ऑनलाइन इलाज हो सकता है?', a: 'परामर्श, दवा और फॉलो-अप ऑनलाइन हो सकते हैं; कुछ स्थितियों में शारीरिक जांच या स्कैन ज़रूरी होता है।' },
      { q: 'अचानक तेज़ "जीवन का सबसे बुरा" सिरदर्द होने पर क्या करें?', a: 'यह आपातकाल हो सकता है — इंतज़ार न करें, तुरंत नज़दीकी अस्पताल जाएं।' },
    ]
  },
  'orthopedic': {
    subtitle: 'हड्डी, जोड़ एवं रीढ़ विशेषज्ञ',
    description: 'हड्डी रोग विशेषज्ञ हड्डियों, जोड़ों, मांसपेशियों और रीढ़ से जुड़ी समस्याओं का इलाज करते हैं — फ्रैक्चर से लेकर गठिया तक।',
    conditions: ['कमर दर्द', 'घुटने का दर्द', 'जोड़ों में अकड़न', 'फ्रैक्चर', 'गठिया', 'स्लिप डिस्क', 'खेल चोटें', 'कंधे का दर्द'],
    faqs: [
      { q: 'मुझे हड्डी रोग विशेषज्ञ को कब दिखाना चाहिए?', a: 'लगातार या तेज़ कमर/जोड़ों का दर्द, चोट के बाद दर्द, सूजन, या हिलने-डुलने में कठिनाई पर हड्डी रोग विशेषज्ञ से मिलें।' },
      { q: 'क्या हड्डी/जोड़ की समस्या ऑनलाइन देखी जा सकती है?', a: 'कई समस्याओं का पहले ऑनलाइन आकलन किया जा सकता है ताकि तय हो सके कि X-ray या व्यक्तिगत जांच ज़रूरी है या नहीं।' },
      { q: 'क्या फिजियोथेरेपी मदद करती है?', a: 'कई मामलों में हां — डॉक्टर या फिजियोथेरेपिस्ट सही व्यायाम और इलाज की सलाह देते हैं।' },
    ]
  },
  'pediatrician': {
    subtitle: 'बाल स्वास्थ्य विशेषज्ञ',
    description: 'बाल रोग विशेषज्ञ शिशुओं, बच्चों और किशोरों के स्वास्थ्य की देखभाल करते हैं — टीकाकरण से लेकर बचपन की बीमारियों तक।',
    conditions: ['बच्चों में बुखार', 'टीकाकरण', 'विकास संबंधी चिंताएं', 'एलर्जी', 'खांसी-जुकाम', 'बचपन के संक्रमण', 'पोषण सलाह', 'विकास में देरी'],
    faqs: [
      { q: 'मुझे बाल रोग विशेषज्ञ को कब दिखाना चाहिए?', a: 'बच्चे में तेज़ या लगातार बुखार, खांसी-जुकाम, चकत्ते, कम खाना, या विकास संबंधी चिंता पर बाल रोग विशेषज्ञ से मिलें।' },
      { q: 'क्या बच्चों की समस्या ऑनलाइन देखी जा सकती है?', a: 'सामान्य समस्याओं और फॉलो-अप के लिए ऑनलाइन परामर्श उपयोगी है; गंभीर लक्षणों में तुरंत डॉक्टर को दिखाएं।' },
      { q: 'टीकाकरण कब कराना चाहिए?', a: 'डॉक्टर बच्चे की उम्र के अनुसार टीकाकरण का सही समय बताते हैं।' },
    ]
  },
  'psychiatrist': {
    subtitle: 'मानसिक स्वास्थ्य विशेषज्ञ',
    description: 'मनोचिकित्सक अवसाद, चिंता, OCD, PTSD और नींद संबंधी विकारों जैसी मानसिक स्वास्थ्य समस्याओं की जांच और इलाज करते हैं।',
    conditions: ['अवसाद', 'चिंता', 'अनिद्रा', 'पैनिक अटैक', 'OCD', 'PTSD', 'बाइपोलर विकार', 'तनाव प्रबंधन'],
    faqs: [
      { q: 'मुझे मनोचिकित्सक को कब दिखाना चाहिए?', a: 'यदि लंबे समय से उदासी, चिंता, नींद न आना, या रोज़मर्रा के काम प्रभावित हो रहे हों, तो मदद लेना समझदारी है।' },
      { q: 'क्या मानसिक स्वास्थ्य परामर्श ऑनलाइन हो सकता है?', a: 'हां — मानसिक स्वास्थ्य के लिए ऑनलाइन परामर्श बहुत सुविधाजनक और निजी है, आप घर से खुलकर बात कर सकते हैं।' },
      { q: 'अगर खुद को नुकसान पहुंचाने के विचार आएं तो?', a: 'इसे तुरंत गंभीरता से लें — किसी डॉक्टर या हेल्पलाइन से अभी संपर्क करें (भारत में टेली-मानस: 14416)।' },
    ]
  },
  'dentist': {
    subtitle: 'दंत एवं मुख स्वास्थ्य विशेषज्ञ',
    description: 'दंत चिकित्सक संपूर्ण मुख स्वास्थ्य देखभाल देते हैं — सफाई, फिलिंग, रूट कैनाल, ब्रेसेस और मसूड़ों के इलाज सहित।',
    conditions: ['दांत दर्द', 'कैविटी', 'मसूड़ों से खून', 'मुंह की दुर्गंध', 'दांत सफेद करना', 'ब्रेसेस', 'अक्ल दाढ़ का दर्द', 'रूट कैनाल'],
    faqs: [
      { q: 'मुझे दंत चिकित्सक को कब दिखाना चाहिए?', a: 'दांत दर्द, मसूड़ों से खून, मुंह की दुर्गंध, या कैविटी की आशंका पर देर होने से पहले दंत चिकित्सक से मिलें।' },
      { q: 'क्या दांत की समस्या ऑनलाइन देखी जा सकती है?', a: 'शुरुआती सलाह ऑनलाइन ली जा सकती है, पर अधिकतर दंत उपचार के लिए क्लिनिक जाना ज़रूरी होता है।' },
      { q: 'दांतों की जांच कितनी बार करानी चाहिए?', a: 'आमतौर पर हर 6 महीने में एक बार जांच कराना अच्छा रहता है।' },
    ]
  },
  'general-physician': {
    subtitle: 'प्राथमिक चिकित्सा डॉक्टर',
    description: 'जनरल फिज़ीशियन अधिकांश स्वास्थ्य समस्याओं के लिए आपका पहला संपर्क होते हैं। वे जांच करते हैं, इलाज करते हैं, और ज़रूरत पड़ने पर विशेषज्ञ के पास भेजते हैं।',
    conditions: ['बुखार और फ्लू', 'खांसी-जुकाम', 'शरीर में दर्द', 'कमज़ोरी', 'संक्रमण', 'रक्तचाप जांच', 'मधुमेह प्रबंधन', 'सामान्य जांच'],
    faqs: [
      { q: 'मुझे जनरल फिज़ीशियन को कब दिखाना चाहिए?', a: 'किसी भी नई स्वास्थ्य समस्या — बुखार, शरीर दर्द, थकान, संक्रमण — या जब समझ न आए कि किस विशेषज्ञ को दिखाएं, तब।' },
      { q: 'क्या जनरल फिज़ीशियन पुरानी बीमारियों का इलाज करते हैं?', a: 'हां, वे मधुमेह, रक्तचाप, थायरॉइड जैसी बीमारियों का प्रबंधन करते हैं और जटिल मामलों में विशेषज्ञ के पास भेजते हैं।' },
      { q: 'क्या GP के साथ ऑनलाइन परामर्श प्रभावी है?', a: 'बुखार, जुकाम, संक्रमण, फॉलो-अप और दवा नवीनीकरण जैसी सामान्य समस्याओं के लिए बहुत प्रभावी है।' },
    ]
  },
  'ent-specialist': {
    subtitle: 'कान, नाक एवं गला विशेषज्ञ',
    description: 'ENT विशेषज्ञ कान, नाक, गला, सिर और गर्दन की समस्याओं का इलाज करते हैं, जैसे सुनने में कमी, साइनस और टॉन्सिल।',
    conditions: ['कान दर्द', 'सुनने में कमी', 'साइनस', 'टॉन्सिल', 'खर्राटे', 'नाक बंद होना', 'गले का संक्रमण', 'चक्कर'],
    faqs: [
      { q: 'मुझे ENT विशेषज्ञ को कब दिखाना चाहिए?', a: 'लगातार कान दर्द, सुनने की समस्या, पुराना साइनस, बार-बार गले का संक्रमण, खर्राटे या आवाज़ में बदलाव पर।' },
      { q: 'क्या ENT समस्याओं का ऑनलाइन इलाज हो सकता है?', a: 'संक्रमण की दवा, एलर्जी प्रबंधन और फॉलो-अप ऑनलाइन हो सकते हैं; कुछ स्थितियों में जांच ज़रूरी है।' },
      { q: 'ENT परामर्श में क्या होता है?', a: 'डॉक्टर कान, नाक और गले की जांच करते हैं और ज़रूरत पड़ने पर सुनने की जांच या स्कैन की सलाह देते हैं।' },
    ]
  },
  'microbiologist': {
    subtitle: 'प्रयोगशाला एवं संक्रमण विशेषज्ञ',
    description: 'माइक्रोबायोलॉजिस्ट प्रयोगशाला विशेषज्ञ होते हैं जो संक्रमण के पीछे मौजूद बैक्टीरिया, वायरस और फंगस की पहचान करते हैं और सही जांच व एंटीबायोटिक की सलाह देते हैं। वे आमतौर पर रोज़मर्रा की बीमारियों के लिए मरीज़ नहीं देखते, बल्कि पर्दे के पीछे इलाज में मदद करते हैं।',
    conditions: ['संक्रमण की पहचान', 'कल्चर एवं सेंसिटिविटी जांच', 'एंटीबायोटिक सलाह', 'लैब रिपोर्ट व्याख्या', 'अस्पताल संक्रमण नियंत्रण', 'प्रतिरोधी संक्रमण'],
    faqs: [
      { q: 'माइक्रोबायोलॉजिस्ट क्या करते हैं?', a: 'वे प्रयोगशाला में संक्रमण पैदा करने वाले जीव की पहचान करते हैं और बताते हैं कि कौन-सी एंटीबायोटिक काम करेगी — आपके इलाज करने वाले डॉक्टर की मदद करते हैं, उनकी जगह नहीं लेते।' },
      { q: 'क्या बुखार या जुकाम के लिए माइक्रोबायोलॉजिस्ट को दिखाएं?', a: 'आमतौर पर नहीं। बुखार, खांसी या शरीर दर्द जैसी सामान्य समस्याओं के लिए पहले जनरल फिज़ीशियन को दिखाएं।' },
      { q: 'मेरे इलाज में माइक्रोबायोलॉजिस्ट कब शामिल होते हैं?', a: 'आमतौर पर जब डॉक्टर कल्चर या विशेष संक्रमण जांच कराते हैं, या जटिल/प्रतिरोधी संक्रमण में।' },
    ]
  },
};

// UI labels for the page chrome (headings, buttons). English + Hindi.
const UI = {
  en: {
    conditionsTitle: 'Common Conditions Treated',
    topDoctors: (s, city) => city ? `Top ${s} Doctors in ${city}` : `Top ${s} Doctors on ProMedicoz`,
    loadingDoctors: 'Loading doctors...',
    noneCity: (s, city) => `No ${s} doctors in ${city} yet.`,
    noneAll: (s) => `No ${s} doctors registered yet.`,
    areYou: (s) => `Are you a ${s}? Register now →`,
    yrsExp: 'yrs exp', consultation: 'Consultation', bookAppointment: 'Book Appointment →',
    viewAll: (s) => `View all ${s} doctors →`,
    findByCity: (s) => `Find ${s} Doctors by City`,
    inCity: (s, city) => `${s} in ${city}`,
    allDoctors: (s) => `← All ${s} doctors`,
    bookConsult: (s) => `Book ${s} Consultation`,
    faqTitle: 'Frequently Asked Questions',
    ctaTitle: (s) => `Need a ${s} consultation?`,
    ctaText: 'Book an appointment in under 2 minutes. Video, phone, or in-person.',
    ctaBtn: (s) => `Find ${s} Doctors`,
  },
  hi: {
    conditionsTitle: 'आमतौर पर इलाज की जाने वाली समस्याएं',
    topDoctors: (s, city) => city ? `${city} में शीर्ष ${s} डॉक्टर` : `ProMedicoz पर शीर्ष ${s} डॉक्टर`,
    loadingDoctors: 'डॉक्टर लोड हो रहे हैं...',
    noneCity: (s, city) => `${city} में अभी कोई ${s} डॉक्टर नहीं है।`,
    noneAll: (s) => `अभी कोई ${s} डॉक्टर पंजीकृत नहीं है।`,
    areYou: (s) => `क्या आप ${s} हैं? अभी पंजीकरण करें →`,
    yrsExp: 'वर्ष अनुभव', consultation: 'परामर्श', bookAppointment: 'अपॉइंटमेंट बुक करें →',
    viewAll: (s) => `सभी ${s} डॉक्टर देखें →`,
    findByCity: (s) => `शहर के अनुसार ${s} डॉक्टर खोजें`,
    inCity: (s, city) => `${city} में ${s}`,
    allDoctors: (s) => `← सभी ${s} डॉक्टर`,
    bookConsult: (s) => `${s} परामर्श बुक करें`,
    faqTitle: 'अक्सर पूछे जाने वाले प्रश्न',
    ctaTitle: (s) => `${s} परामर्श चाहिए?`,
    ctaText: '2 मिनट से भी कम में अपॉइंटमेंट बुक करें। वीडियो, फोन या क्लिनिक पर।',
    ctaBtn: (s) => `${s} डॉक्टर खोजें`,
  },
};

function SpecializationPage() {
  const { slug, city: citySlug } = useParams();
  const cityName = citySlug ? slugToCityName(citySlug) : '';
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  // Cities that actually have doctors of this specialization — only fetched
  // on the base (non-city) page, to build the "Find X in your city" links.
  const [cities, setCities] = useState([]);

  const [lang] = useState(() => localStorage.getItem('promedicoz_lang') || 'en');
  const ui = UI[lang] || UI.en;

  const data = specializationData[slug];
  const specName = data?.title || slug;
  // Hindi overlay for the VISIBLE content (title stays English — it's a proper
  // noun / the canonical specialty label and also what we search doctors by).
  // Falls back to English fields when a Hindi entry is missing.
  const hi = (lang === 'hi' && specializationHi[slug]) || null;
  const view = data ? {
    title: data.title,
    subtitle: hi?.subtitle || data.subtitle,
    description: hi?.description || data.description,
    conditions: hi?.conditions || data.conditions,
    faqs: hi?.faqs || data.faqs,
    icon: data.icon,
  } : null;

  useEffect(() => {
    const fetchDoctors = async () => {
      setLoading(true);
      try {
        const params = { specialization: specName, limit: 6 };
        if (cityName) params.city = cityName;
        const response = await doctorAPI.getAll(params);
        setDoctors(response.data.doctors);
      } catch (error) {
        console.error('Fetch doctors error:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchDoctors();
  }, [slug, specName, cityName]);

  useEffect(() => {
    // Only need the city cross-links on the base specialization page.
    if (citySlug) { setCities([]); return; }
    doctorAPI.getCities({ specialization: specName })
      .then((res) => setCities(res.data.cities || []))
      .catch(() => setCities([]));
  }, [slug, specName, citySlug]);

  if (!data) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-800">{lang === 'hi' ? 'विशेषज्ञता नहीं मिली' : 'Specialization not found'}</h1>
        <Link to="/doctors" className="text-primary-600 hover:underline mt-4 inline-block">{lang === 'hi' ? 'सभी डॉक्टर देखें →' : 'Browse all doctors →'}</Link>
      </div>
    );
  }

  // FAQ structured data for Google "People Also Ask" — ALWAYS English (this
  // feeds Google's index; the visible FAQs may be shown in Hindi via `view`).
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: data.faqs.map(faq => ({
      '@type': 'Question',
      name: faq.q,
      acceptedAnswer: { '@type': 'Answer', text: faq.a }
    }))
  };

  // Breadcrumb structured data — helps search engines understand the
  // Home > Specialization > City hierarchy on the city pages.
  const breadcrumbSchema = cityName ? {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.promedicoz.in/' },
      { '@type': 'ListItem', position: 2, name: data.title, item: `https://www.promedicoz.in/specialization/${slug}` },
      { '@type': 'ListItem', position: 3, name: `${data.title} in ${cityName}`, item: `https://www.promedicoz.in/specialization/${slug}/${citySlug}` },
    ]
  } : null;

  return (
    <div>
      <SEO
        title={cityName
          ? `Best ${data.title} Doctors in ${cityName} - Book Appointment`
          : `Best ${data.title} Doctors Online - Book Appointment`}
        description={cityName
          ? `Consult the best ${data.title.toLowerCase()} doctors in ${cityName} on ProMedicoz. Book video, phone or in-person appointments. ${data.description}`
          : `Consult top ${data.title.toLowerCase()} doctors online on ProMedicoz. ${data.description} Book video, phone or in-person consultation.`}
        path={cityName ? `/specialization/${slug}/${citySlug}` : `/specialization/${slug}`}
      />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
        {breadcrumbSchema && <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>}
      </Helmet>

      {/* Hero section */}
      <section className="bg-gradient-to-r from-primary-600 to-primary-800 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-4 mb-4">
            <span className="text-5xl">{view.icon}</span>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold">
                {cityName ? `${view.title} — ${cityName}` : view.title}
              </h1>
              <p className="text-primary-200 text-lg">{view.subtitle}</p>
            </div>
          </div>
          {cityName && (
            <p className="text-primary-100 text-sm mb-2">
              <Link to={`/specialization/${slug}`} className="underline hover:text-white">{ui.allDoctors(view.title)}</Link>
            </p>
          )}
          <p className="text-primary-100 max-w-2xl text-lg">{view.description}</p>
          <Link
            to={`/doctors?specialization=${encodeURIComponent(specName)}`}
            className="inline-block mt-6 bg-white text-primary-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
          >
            {ui.bookConsult(view.title)}
          </Link>
        </div>
      </section>

      {/* Common conditions */}
      <section className="py-10 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">{ui.conditionsTitle}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {view.conditions.map((condition, idx) => (
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
          <h2 className="text-2xl font-bold text-gray-800 mb-6">
            {ui.topDoctors(view.title, cityName)}
          </h2>
          {loading ? (
            <p className="text-gray-500">{ui.loadingDoctors}</p>
          ) : doctors.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center">
              <p className="text-gray-600 mb-4">
                {cityName ? ui.noneCity(view.title, cityName) : ui.noneAll(view.title)}
              </p>
              <Link to="/register?role=doctor" className="text-primary-600 font-medium hover:underline">
                {ui.areYou(view.title)}
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {doctors.map((doc) => (
                <Link key={doc._id} to={`/doctors/${doc._id}`} className="bg-white rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow block">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center text-xl">
                      {doc.profilePhoto ? <img src={getUploadUrl(doc.profilePhoto, { width: 120 })} alt={doc.name} className="w-12 h-12 rounded-full object-cover" /> : '🧑‍⚕️'}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800">{doc.name}</h3>
                      <p className="text-sm text-gray-500">{doc.experience || 0} {ui.yrsExp}</p>
                    </div>
                  </div>
                  {doc.consultationFee > 0 && <p className="text-sm text-gray-600">{ui.consultation}: ₹{doc.consultationFee}</p>}
                  <span className="text-primary-600 text-sm font-medium mt-2 inline-block">{ui.bookAppointment}</span>
                </Link>
              ))}
            </div>
          )}
          <div className="text-center mt-6">
            <Link to={`/doctors?specialization=${encodeURIComponent(specName)}`} className="text-primary-600 font-medium hover:underline">
              {ui.viewAll(view.title)}
            </Link>
          </div>
        </div>
      </section>

      {/* Find by city — only on the base page, and only cities that actually
          have doctors of this specialization (data-driven, no empty pages).
          These internal links are how search engines discover the city
          landing pages. */}
      {!citySlug && cities.length > 0 && (
        <section className="py-10 bg-white">
          <div className="container mx-auto px-4">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">{ui.findByCity(view.title)}</h2>
            <div className="flex flex-wrap gap-3">
              {cities.map((c) => (
                <Link
                  key={c.city}
                  to={`/specialization/${slug}/${cityToSlug(c.city)}`}
                  className="px-4 py-2 bg-primary-50 border border-primary-100 text-primary-700 rounded-lg text-sm font-medium hover:bg-primary-100 transition-colors"
                >
                  {ui.inCity(view.title, c.city)}
                  <span className="text-primary-400 ml-1">({c.count})</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQs */}
      <section className="py-10 bg-white">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">{ui.faqTitle}</h2>
          <div className="space-y-4">
            {view.faqs.map((faq, idx) => (
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
          <h2 className="text-xl font-bold text-gray-800 mb-3">{ui.ctaTitle(view.title)}</h2>
          <p className="text-gray-600 mb-5">{ui.ctaText}</p>
          <Link to={`/doctors?specialization=${encodeURIComponent(specName)}`} className="bg-primary-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors inline-block">
            {ui.ctaBtn(view.title)}
          </Link>
        </div>
      </section>
    </div>
  );
}

export default SpecializationPage;
