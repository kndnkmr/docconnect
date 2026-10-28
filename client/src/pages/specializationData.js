// Specialty landing-page data (EN + HI). Plain JS so the build
// (scripts/prerender.mjs) can import it too.

// Data for each specialization — SEO content, FAQs, conditions.
// NOTE: the same title/description for these slugs is mirrored in
// scripts/prerender.mjs (SPECIALIZATIONS) so the build can bake per-page meta
// into static HTML. If you change a title/description here, update it there too.
export const specializationData = {
  'gynaecologist': {
    title: 'Gynaecologist',
    subtitle: 'Women\'s Health Specialist',
    description: 'Gynaecologists specialize in women\'s reproductive health, pregnancy care, fertility treatments, and menstrual disorders.',
    conditions: ['Irregular periods', 'PCOD/PCOS', 'Pregnancy care', 'Infertility/IVF', 'Menopause', 'Endometriosis', 'Fibroids', 'Cervical screening'],
    icon: '🤰',
    faqs: [
      { q: 'When should I see a gynaecologist?', a: 'You should visit a gynaecologist for irregular periods, pregnancy planning, pelvic pain, unusual discharge, or routine screening after age 21.' },
      { q: 'How much does a gynaecologist consultation cost?', a: 'Online consultations on ProMedicoz typically range from Rs. 300 to Rs. 1000 depending on the doctor\'s experience.' },
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
      { q: 'How much does a dental consultation cost?', a: 'Online consultations range from Rs. 200-Rs. 500. In-person procedures vary by treatment type.' },
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
  'gastroenterologist': {
    title: 'Gastroenterologist',
    subtitle: 'Stomach, Liver & Digestion Specialist',
    description: 'Gastroenterologists diagnose and treat problems of the stomach, intestines, liver, and digestive system — from acidity and constipation to liver disease.',
    conditions: ['Acidity & heartburn', 'Constipation', 'Diarrhoea', 'Bloating & gas', 'Stomach pain', 'Fatty liver', 'IBS', 'Piles'],
    icon: '🍎',
    faqs: [
      { q: 'When should I see a gastroenterologist?', a: 'See a gastroenterologist for acidity or stomach pain that keeps coming back, constipation or loose motions lasting more than 2 weeks, blood in stool, or unexplained weight loss.' },
      { q: 'Can stomach problems be treated online?', a: 'Many digestive problems such as acidity, bloating, and constipation can be assessed online first. The doctor may recommend tests or an in-person visit if needed.' },
      { q: 'When is stomach pain an emergency?', a: 'Severe sudden stomach pain, vomiting blood, black stools, or pain with high fever needs urgent care — go to the nearest hospital.' },
    ]
  },
  'pulmonologist': {
    title: 'Pulmonologist',
    subtitle: 'Lung & Breathing Specialist',
    description: 'Pulmonologists diagnose and treat conditions of the lungs and airways, including asthma, chronic cough, breathlessness, COPD, and tuberculosis.',
    conditions: ['Asthma', 'Chronic cough', 'Breathlessness', 'COPD', 'Tuberculosis', 'Pneumonia', 'Allergic bronchitis', 'Sleep apnoea'],
    icon: '🫁',
    faqs: [
      { q: 'When should I see a pulmonologist?', a: 'See a pulmonologist for a cough lasting more than 3 weeks, wheezing, breathlessness during daily activities, or frequent chest infections.' },
      { q: 'Can asthma be managed online?', a: 'Yes, follow-ups, inhaler technique, and medication reviews work well online. Lung function tests may need a clinic visit.' },
      { q: 'When is breathlessness an emergency?', a: 'Sudden severe breathlessness, bluish lips, or chest pain with breathlessness needs urgent care — go to the nearest hospital.' },
    ]
  },
  'endocrinologist': {
    title: 'Endocrinologist',
    subtitle: 'Diabetes, Thyroid & Hormone Specialist',
    description: 'Endocrinologists treat hormone-related conditions such as diabetes, thyroid disorders, PCOS hormone problems, and obesity.',
    conditions: ['Diabetes', 'Thyroid problems', 'PCOS hormones', 'Obesity', 'Vitamin D deficiency', 'Growth problems', 'Osteoporosis', 'Adrenal disorders'],
    icon: '🩸',
    faqs: [
      { q: 'When should I see an endocrinologist?', a: 'See an endocrinologist if your diabetes is hard to control, you have a thyroid problem, or you have symptoms of a hormone imbalance such as unexplained weight change or tiredness.' },
      { q: 'Can diabetes be managed through online consultations?', a: 'Yes, reviewing sugar readings, adjusting medicines, and diet advice work well online. Regular blood tests are still needed.' },
      { q: 'Should a thyroid problem be treated by an endocrinologist?', a: 'Simple thyroid problems are often managed by a General Physician. An endocrinologist helps when it is hard to control or unusual.' },
    ]
  },
  'ophthalmologist': {
    title: 'Ophthalmologist',
    subtitle: 'Eye & Vision Specialist',
    description: 'Ophthalmologists diagnose and treat eye conditions — from blurry vision and eye infections to cataract and glaucoma.',
    conditions: ['Blurry vision', 'Eye infection', 'Red or itchy eyes', 'Cataract', 'Glaucoma', 'Dry eyes', 'Diabetic eye checks', 'Eye strain'],
    icon: '👁️',
    faqs: [
      { q: 'When should I see an ophthalmologist?', a: 'See an eye specialist for blurry or reduced vision, eye pain, redness that does not settle, flashes or floaters, or a yearly check if you have diabetes.' },
      { q: 'Can eye problems be checked online?', a: 'Infections, allergies, and dry eyes can often be assessed online. Vision tests and eye pressure checks need a clinic visit.' },
      { q: 'When is an eye problem an emergency?', a: 'Sudden loss of vision, a chemical splash, or an eye injury needs urgent care — go to the nearest hospital.' },
    ]
  },
  'urologist': {
    title: 'Urologist',
    subtitle: 'Kidney, Urinary & Prostate Specialist',
    description: 'Urologists treat conditions of the urinary tract, kidneys, bladder, and prostate, including kidney stones and urinary infections.',
    conditions: ['Kidney stones', 'Urinary infection (UTI)', 'Burning urination', 'Frequent urination', 'Prostate problems', 'Blood in urine', 'Urine leakage', 'Male sexual health'],
    icon: '💧',
    faqs: [
      { q: 'When should I see a urologist?', a: 'See a urologist for kidney stone pain, repeated urinary infections, blood in urine, difficulty passing urine, or prostate problems.' },
      { q: 'Can urinary problems be discussed online?', a: 'Yes, many urinary problems can be assessed online first, privately. The doctor may recommend urine tests or an ultrasound.' },
      { q: 'When is a urinary problem an emergency?', a: 'Being unable to pass urine, severe kidney pain with fever, or heavy blood in urine needs urgent care.' },
    ]
  },
  'nephrologist': {
    title: 'Nephrologist',
    subtitle: 'Kidney Specialist',
    description: 'Nephrologists treat kidney diseases, including chronic kidney disease, kidney problems from diabetes and high blood pressure, and dialysis care.',
    conditions: ['Chronic kidney disease', 'High creatinine', 'Kidney problems from diabetes', 'Kidney problems from high BP', 'Swelling in legs', 'Protein in urine', 'Dialysis care', 'Kidney transplant care'],
    icon: '🫘',
    faqs: [
      { q: 'What is the difference between a nephrologist and a urologist?', a: 'A nephrologist treats how the kidneys work (kidney disease, high creatinine). A urologist treats structural problems such as kidney stones and prostate issues, including surgery.' },
      { q: 'When should I see a nephrologist?', a: 'See a nephrologist if blood tests show high creatinine or reduced kidney function, if you have protein in urine, or if diabetes or high BP is affecting your kidneys.' },
      { q: 'Can kidney disease be managed online?', a: 'Report reviews, medicine adjustment, and follow-ups work well online. Regular blood tests are still needed.' },
    ]
  },
  'physiotherapist': {
    title: 'Physiotherapist',
    subtitle: 'Movement, Pain & Recovery Specialist',
    description: 'Physiotherapists help you recover movement and reduce pain through exercise, posture correction, and therapy — for back pain, injuries, and after surgery.',
    conditions: ['Back pain', 'Neck pain', 'Knee pain', 'Sports injuries', 'Recovery after surgery', 'Frozen shoulder', 'Stroke rehabilitation', 'Posture problems'],
    icon: '🏃',
    faqs: [
      { q: 'When should I see a physiotherapist?', a: 'See a physiotherapist for ongoing back, neck, or joint pain, stiffness, recovery after an injury or surgery, or posture problems.' },
      { q: 'Does online physiotherapy work?', a: 'Yes, many exercise programmes and posture corrections can be taught and checked by video. Some treatments need in-person sessions.' },
      { q: 'Do I need a doctor before physiotherapy?', a: 'For a new injury or severe pain, it is best to see a doctor first to rule out fractures or other causes.' },
    ]
  },
};

// ---- Hindi content for each specialization (patient-readable). Kept SEPARATE
// from the English specializationData above ON PURPOSE: the English text is
// what feeds the SEO <title>/<description> and FAQ structured data (Google's
// index), so it must never change. This block only affects what a Hindi user
// SEES on screen. Any slug missing here simply falls back to English.
export const specializationHi = {
  'gynaecologist': {
    subtitle: 'महिला स्वास्थ्य विशेषज्ञ',
    description: 'स्त्री रोग विशेषज्ञ महिलाओं के प्रजनन स्वास्थ्य, गर्भावस्था देखभाल, प्रजनन उपचार और मासिक धर्म संबंधी समस्याओं में विशेषज्ञ होते हैं।',
    conditions: ['अनियमित मासिक धर्म', 'PCOD/PCOS', 'गर्भावस्था देखभाल', 'बांझपन/IVF', 'रजोनिवृत्ति', 'एंडोमेट्रियोसिस', 'फाइब्रॉएड', 'सर्वाइकल जांच'],
    faqs: [
      { q: 'मुझे स्त्री रोग विशेषज्ञ को कब दिखाना चाहिए?', a: 'अनियमित मासिक धर्म, गर्भावस्था की योजना, पेल्विक दर्द, असामान्य स्राव, या 21 वर्ष के बाद नियमित जांच के लिए स्त्री रोग विशेषज्ञ से मिलें।' },
      { q: 'स्त्री रोग विशेषज्ञ के परामर्श का खर्च कितना है?', a: 'ProMedicoz पर ऑनलाइन परामर्श आमतौर पर डॉक्टर के अनुभव के अनुसार Rs. 300 से Rs. 1000 तक होता है।' },
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
  'gastroenterologist': {
    subtitle: 'पेट, लिवर एवं पाचन विशेषज्ञ',
    description: 'गैस्ट्रोएंटेरोलॉजिस्ट पेट, आंतों, लिवर और पाचन तंत्र की समस्याओं की जांच और इलाज करते हैं — एसिडिटी और कब्ज से लेकर लिवर की बीमारी तक।',
    conditions: ['एसिडिटी और सीने में जलन', 'कब्ज', 'दस्त', 'पेट फूलना और गैस', 'पेट दर्द', 'फैटी लिवर', 'IBS', 'बवासीर'],
    faqs: [
      { q: 'मुझे गैस्ट्रोएंटेरोलॉजिस्ट को कब दिखाना चाहिए?', a: 'बार-बार होने वाली एसिडिटी या पेट दर्द, 2 हफ्ते से ज़्यादा कब्ज या दस्त, मल में खून, या बिना कारण वज़न घटने पर।' },
      { q: 'क्या पेट की समस्याओं का ऑनलाइन इलाज हो सकता है?', a: 'एसिडिटी, गैस और कब्ज जैसी कई समस्याओं का पहले ऑनलाइन आकलन हो सकता है। ज़रूरत पड़ने पर डॉक्टर जांच या क्लिनिक आने की सलाह देंगे।' },
      { q: 'पेट दर्द कब आपातकाल होता है?', a: 'अचानक तेज़ पेट दर्द, खून की उल्टी, काला मल, या तेज़ बुखार के साथ दर्द पर तुरंत नज़दीकी अस्पताल जाएं।' },
    ]
  },
  'pulmonologist': {
    subtitle: 'फेफड़े एवं सांस विशेषज्ञ',
    description: 'पल्मोनोलॉजिस्ट फेफड़ों और सांस की नलियों की समस्याओं का इलाज करते हैं, जैसे दमा, पुरानी खांसी, सांस फूलना, COPD और टीबी।',
    conditions: ['दमा (अस्थमा)', 'पुरानी खांसी', 'सांस फूलना', 'COPD', 'टीबी', 'निमोनिया', 'एलर्जिक ब्रोंकाइटिस', 'नींद में सांस रुकना'],
    faqs: [
      { q: 'मुझे पल्मोनोलॉजिस्ट को कब दिखाना चाहिए?', a: '3 हफ्ते से ज़्यादा खांसी, घरघराहट, रोज़ के कामों में सांस फूलना, या बार-बार छाती के संक्रमण पर।' },
      { q: 'क्या दमा का इलाज ऑनलाइन हो सकता है?', a: 'हां, फॉलो-अप, इनहेलर लेने का सही तरीका और दवा की समीक्षा ऑनलाइन अच्छे से हो जाती है। फेफड़ों की जांच के लिए क्लिनिक जाना पड़ सकता है।' },
      { q: 'सांस फूलना कब आपातकाल है?', a: 'अचानक तेज़ सांस फूलना, होंठ नीले पड़ना, या सांस के साथ छाती में दर्द होने पर तुरंत नज़दीकी अस्पताल जाएं।' },
    ]
  },
  'endocrinologist': {
    subtitle: 'मधुमेह, थायराइड एवं हार्मोन विशेषज्ञ',
    description: 'एंडोक्रिनोलॉजिस्ट हार्मोन से जुड़ी समस्याओं का इलाज करते हैं, जैसे मधुमेह, थायराइड, PCOS से जुड़ी हार्मोन समस्याएं और मोटापा।',
    conditions: ['मधुमेह (शुगर)', 'थायराइड', 'PCOS हार्मोन', 'मोटापा', 'विटामिन D की कमी', 'विकास संबंधी समस्याएं', 'हड्डियों की कमज़ोरी', 'एड्रिनल विकार'],
    faqs: [
      { q: 'मुझे एंडोक्रिनोलॉजिस्ट को कब दिखाना चाहिए?', a: 'जब शुगर कंट्रोल न हो रही हो, थायराइड की समस्या हो, या हार्मोन असंतुलन के लक्षण हों जैसे बिना कारण वज़न बदलना या थकान।' },
      { q: 'क्या मधुमेह का इलाज ऑनलाइन परामर्श से हो सकता है?', a: 'हां, शुगर रीडिंग देखना, दवा बदलना और खान-पान की सलाह ऑनलाइन अच्छे से हो जाती है। नियमित ब्लड टेस्ट फिर भी ज़रूरी हैं।' },
      { q: 'क्या थायराइड के लिए एंडोक्रिनोलॉजिस्ट ज़रूरी है?', a: 'सामान्य थायराइड अक्सर जनरल फिज़ीशियन संभाल लेते हैं। कंट्रोल मुश्किल हो या असामान्य हो, तब एंडोक्रिनोलॉजिस्ट मदद करते हैं।' },
    ]
  },
  'ophthalmologist': {
    subtitle: 'आंख एवं दृष्टि विशेषज्ञ',
    description: 'नेत्र रोग विशेषज्ञ आंखों की समस्याओं की जांच और इलाज करते हैं — धुंधला दिखने और संक्रमण से लेकर मोतियाबिंद और ग्लूकोमा तक।',
    conditions: ['धुंधला दिखना', 'आंख का संक्रमण', 'आंखें लाल या खुजली', 'मोतियाबिंद', 'ग्लूकोमा', 'सूखी आंखें', 'शुगर में आंखों की जांच', 'आंखों में थकान'],
    faqs: [
      { q: 'मुझे नेत्र रोग विशेषज्ञ को कब दिखाना चाहिए?', a: 'धुंधला या कम दिखना, आंख में दर्द, ठीक न होने वाली लालिमा, चमक या धब्बे दिखना, या शुगर हो तो सालाना जांच के लिए।' },
      { q: 'क्या आंखों की समस्या ऑनलाइन देखी जा सकती है?', a: 'संक्रमण, एलर्जी और सूखी आंखों का अक्सर ऑनलाइन आकलन हो सकता है। नज़र और आंख के दबाव की जांच के लिए क्लिनिक जाना ज़रूरी है।' },
      { q: 'आंख की समस्या कब आपातकाल है?', a: 'अचानक दिखना बंद होना, आंख में केमिकल जाना, या आंख में चोट लगने पर तुरंत नज़दीकी अस्पताल जाएं।' },
    ]
  },
  'urologist': {
    subtitle: 'किडनी, मूत्र एवं प्रोस्टेट विशेषज्ञ',
    description: 'यूरोलॉजिस्ट मूत्र मार्ग, किडनी, मूत्राशय और प्रोस्टेट की समस्याओं का इलाज करते हैं, जैसे पथरी और पेशाब का संक्रमण।',
    conditions: ['किडनी की पथरी', 'पेशाब का संक्रमण (UTI)', 'पेशाब में जलन', 'बार-बार पेशाब', 'प्रोस्टेट की समस्या', 'पेशाब में खून', 'पेशाब रिसना', 'पुरुष यौन स्वास्थ्य'],
    faqs: [
      { q: 'मुझे यूरोलॉजिस्ट को कब दिखाना चाहिए?', a: 'पथरी का दर्द, बार-बार पेशाब का संक्रमण, पेशाब में खून, पेशाब करने में दिक्कत, या प्रोस्टेट की समस्या पर।' },
      { q: 'क्या पेशाब की समस्या ऑनलाइन बताई जा सकती है?', a: 'हां, कई समस्याओं का पहले ऑनलाइन और निजी तौर पर आकलन हो सकता है। डॉक्टर यूरिन टेस्ट या अल्ट्रासाउंड की सलाह दे सकते हैं।' },
      { q: 'पेशाब की समस्या कब आपातकाल है?', a: 'पेशाब बिल्कुल न आना, बुखार के साथ किडनी में तेज़ दर्द, या पेशाब में बहुत खून आने पर तुरंत इलाज ज़रूरी है।' },
    ]
  },
  'nephrologist': {
    subtitle: 'किडनी रोग विशेषज्ञ',
    description: 'नेफ्रोलॉजिस्ट किडनी की बीमारियों का इलाज करते हैं, जैसे क्रॉनिक किडनी रोग, शुगर और हाई BP से किडनी पर असर, और डायलिसिस देखभाल।',
    conditions: ['क्रॉनिक किडनी रोग', 'क्रिएटिनिन बढ़ना', 'शुगर से किडनी पर असर', 'हाई BP से किडनी पर असर', 'पैरों में सूजन', 'पेशाब में प्रोटीन', 'डायलिसिस देखभाल', 'किडनी ट्रांसप्लांट देखभाल'],
    faqs: [
      { q: 'नेफ्रोलॉजिस्ट और यूरोलॉजिस्ट में क्या फ़र्क है?', a: 'नेफ्रोलॉजिस्ट किडनी के काम करने की समस्या (किडनी रोग, क्रिएटिनिन) का इलाज करते हैं। यूरोलॉजिस्ट पथरी और प्रोस्टेट जैसी समस्याओं का इलाज करते हैं, जिसमें सर्जरी भी शामिल है।' },
      { q: 'मुझे नेफ्रोलॉजिस्ट को कब दिखाना चाहिए?', a: 'जब ब्लड टेस्ट में क्रिएटिनिन ज़्यादा हो या किडनी कमज़ोर दिखे, पेशाब में प्रोटीन हो, या शुगर/BP का किडनी पर असर हो।' },
      { q: 'क्या किडनी रोग का इलाज ऑनलाइन हो सकता है?', a: 'रिपोर्ट देखना, दवा बदलना और फॉलो-अप ऑनलाइन अच्छे से हो जाते हैं। नियमित ब्लड टेस्ट फिर भी ज़रूरी हैं।' },
    ]
  },
  'physiotherapist': {
    subtitle: 'मूवमेंट, दर्द एवं रिकवरी विशेषज्ञ',
    description: 'फिज़ियोथेरेपिस्ट व्यायाम, पोस्चर सुधार और थेरेपी से दर्द कम करने और चलने-फिरने में मदद करते हैं — कमर दर्द, चोट और सर्जरी के बाद।',
    conditions: ['कमर दर्द', 'गर्दन दर्द', 'घुटने का दर्द', 'खेल की चोटें', 'सर्जरी के बाद रिकवरी', 'फ्रोज़न शोल्डर', 'स्ट्रोक के बाद रिकवरी', 'पोस्चर की समस्या'],
    faqs: [
      { q: 'मुझे फिज़ियोथेरेपिस्ट को कब दिखाना चाहिए?', a: 'लगातार कमर, गर्दन या जोड़ों का दर्द, अकड़न, चोट या सर्जरी के बाद रिकवरी, या पोस्चर की समस्या पर।' },
      { q: 'क्या ऑनलाइन फिज़ियोथेरेपी काम करती है?', a: 'हां, कई व्यायाम और पोस्चर सुधार वीडियो पर सिखाए और जांचे जा सकते हैं। कुछ इलाज के लिए क्लिनिक जाना पड़ता है।' },
      { q: 'क्या फिज़ियोथेरेपी से पहले डॉक्टर को दिखाना ज़रूरी है?', a: 'नई चोट या तेज़ दर्द में पहले डॉक्टर को दिखाना बेहतर है ताकि फ्रैक्चर या अन्य कारणों की जांच हो सके।' },
    ]
  },
};

