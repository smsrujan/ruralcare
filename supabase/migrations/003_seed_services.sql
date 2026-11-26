-- =============================================================================
-- RuralCare – Healthcare Services & Directory Seed Data (003)
-- Populates the 8 service categories + hospitals, pharmacies, laboratories,
-- and health_camps in PostgreSQL so Services fetches real database records.
-- =============================================================================

INSERT INTO public.healthcare_services (
  category, title, title_kn, facility_name, facility_name_kn,
  distance, distance_kn, timings, timings_kn, contact,
  description, description_kn, highlights, highlights_kn, is_active
)
SELECT * FROM (VALUES
  (
    'Nearby Hospitals',
    'Sitapur Community Health Center (CHC)',
    'ಸೀತಾಪುರ ಸಮುದಾಯ ಆರೋಗ್ಯ ಕೇಂದ್ರ (CHC)',
    '24x7 Rural Emergency & General Wards',
    '24x7 ಗ್ರಾಮೀಣ ತುರ್ತು ಮತ್ತು ಸಾಮಾನ್ಯ ವಾರ್ಡ್‌ಗಳು',
    '4.2 km away',
    '4.2 ಕಿ.ಮೀ ದೂರ',
    'Open 24 Hours',
    '24 ಗಂಟೆಗಳು ತೆರೆದಿರುತ್ತದೆ',
    '05862-240112',
    '30-bed government community hospital with maternity ward, X-ray, and emergency stabilization unit.',
    'ಹೆರಿಗೆ ವಾರ್ಡ್, ಎಕ್ಸ್-ರೇ ಮತ್ತು ತುರ್ತು ಚಿಕಿತ್ಸಾ ಘಟಕವನ್ನು ಹೊಂದಿರುವ 30 ಹಾಸಿಗೆಗಳ ಸರ್ಕಾರಿ ಸಮುದಾಯ ಆಸ್ಪತ್ರೆ.',
    ARRAY['24/7 Casualty', 'Free Generic Medicines', 'Maternal Care'],
    ARRAY['24/7 ತುರ್ತು ಚಿಕಿತ್ಸೆ', 'ಉಚಿತ ಜನರಿಕ್ ಔಷಧಿಗಳು', 'ತಾಯಿ ಆರೈಕೆ'],
    true
  ),
  (
    'Pharmacy Services',
    'Jan Aushadhi Rural Kendra',
    'ಜನ ಔಷಧಿ ಗ್ರಾಮೀಣ ಕೇಂದ್ರ',
    'Affordable Generic Pharmacy',
    'ಕಡಿಮೆ ದರದ ಜನರಿಕ್ ಔಷಧಾಲಯ',
    '1.5 km away',
    '1.5 ಕಿ.ಮೀ ದೂರ',
    '08:00 AM – 09:00 PM',
    'ಬೆಳಿಗ್ಗೆ 08:00 – ರಾತ್ರಿ 09:00',
    '+91 94156 11203',
    'Subsidized essential medicines, ORS packets, insulin storage, and blood pressure strips.',
    'ರಿಯಾಯಿತಿ ದರದಲ್ಲಿ ಅಗತ್ಯ ಔಷಧಿಗಳು, ORS ಪ್ಯಾಕೆಟ್‌ಗಳು, ಇನ್ಸುಲಿನ್ ಮತ್ತು ರಕ್ತದೊತ್ತಡ ತಪಾಸಣಾ ಪಟ್ಟಿಗಳು ಲಭ್ಯ.',
    ARRAY['Up to 70% Lower Cost', 'Cold-Chain Insulin', 'Prescription Refills'],
    ARRAY['70% ವರೆಗೆ ಕಡಿಮೆ ದರ', 'ಇನ್ಸುಲಿನ್ ಲಭ್ಯ', 'ಔಷಧಿ ಮರುಪೂರಣ'],
    true
  ),
  (
    'Ambulance Services',
    '108 & 102 Rural Ambulance Network',
    '108 ಮತ್ತು 102 ಗ್ರಾಮೀಣ ಆಂಬ್ಯುಲೆನ್ಸ್ ಸೇವೆ',
    'Emergency & Maternal Transport',
    'ತುರ್ತು ಮತ್ತು ಹೆರಿಗೆ ಸಾರಿಗೆ ಸೇವೆ',
    'Average arrival: 14 mins',
    'ಸರಾಸರಿ ಆಗಮನ: 14 ನಿಮಿಷ',
    '24x7 Toll-Free Dispatch',
    '24x7 ಉಚಿತ ಸೇವೆ',
    '108 / 102',
    'Free GPS-dispatched ambulance equipped with oxygen support for trauma, cardiac, and pregnancy emergencies.',
    'ಅಪಘಾತ, ಹೃದಯ ಸಮಸ್ಯೆ ಮತ್ತು ಗರ್ಭಿಣಿಯರ ತುರ್ತು ಪರಿಸ್ಥಿತಿಗಳಿಗೆ ಆಮ್ಲಜನಕ ಸೌಲಭ್ಯವಿರುವ ಉಚಿತ ಆಂಬ್ಯುಲೆನ್ಸ್.',
    ARRAY['108 Emergency Trauma', '102 Mother & Infant', 'Oxygen Equipped'],
    ARRAY['108 ತುರ್ತು ಆಂಬ್ಯುಲೆನ್ಸ್', '102 ತಾಯಿ ಮತ್ತು ಶಿಶು', 'ಆಮ್ಲಜನಕ ಸೌಲಭ್ಯ'],
    true
  ),
  (
    'Laboratory Services',
    'Gramin Diagnostic & Pathology Center',
    'ಗ್ರಾಮೀಣ ರೋಗನಿರ್ಣಯ ಮತ್ತು ಪ್ರಯೋಗಾಲಯ ಕೇಂದ್ರ',
    'Blood, Urine & Malaria/Dengue Tests',
    'ರಕ್ತ, ಮೂತ್ರ ಮತ್ತು ಮಲೇರಿಯಾ/ಡೆಂಗ್ಯೂ ಪರೀಕ್ಷೆಗಳು',
    '3.8 km away',
    '3.8 ಕಿ.ಮೀ ದೂರ',
    '07:00 AM – 05:00 PM',
    'ಬೆಳಿಗ್ಗೆ 07:00 – ಸಂಜೆ 05:00',
    '+91 94158 44120',
    'Same-day reports for CBC, blood glucose, lipid profile, thyroid, and rapid fever panels.',
    'ರಕ್ತ ಪರೀಕ್ಷೆ, ಸಕ್ಕರೆ ಪ್ರಮಾಣ, ಥೈರಾಯ್ಡ್ ಮತ್ತು ಜ್ವರದ ಪರೀಕ್ಷೆಗಳ ವರದಿಗಳು ಅದೇ ದಿನ ಲಭ್ಯ.',
    ARRAY['Same-Day SMS Report', 'Free BPL Tests', 'Home Sample Option'],
    ARRAY['ಅದೇ ದಿನ SMS ವರದಿ', 'BPL ಉಚಿತ ಪರೀಕ್ಷೆ', 'ಮನೆ ಮಾದರಿ ಸಂಗ್ರಹ'],
    true
  ),
  (
    'Health Camps',
    'Monthly Panchayat Mobile Health Camp',
    'ಮಾಸಿಕ ಪಂಚಾಯತ್ ಸಂಚಾರಿ ಆರೋಗ್ಯ ಶಿಬಿರ',
    'Eye Screening, Dental & BP Checkup',
    'ಕಣ್ಣಿನ ತಪಾಸಣೆ, ದಂತ ಮತ್ತು ಬಿಪಿ ತಪಾಸಣೆ',
    'Chandrapur Panchayat Bhavan',
    'ಚಂದ್ರಾಪುರ ಪಂಚಾಯತ್ ಭವನ',
    '27 Nov 2026 · 09:00 AM – 03:00 PM',
    '27 ನವೆಂಬರ್ 2026 · ಬೆಳಿಗ್ಗೆ 09:00 – ಮಧ್ಯಾಹ್ನ 03:00',
    '+91 94150 22310',
    'Free doctor consultation, cataract screening, and spectacle distribution organized by District Health Office.',
    'ಜಿಲ್ಲಾ ಆರೋಗ್ಯ ಕಚೇರಿಯಿಂದ ಉಚಿತ ವೈದ್ಯರ ತಪಾಸಣೆ, ಕಣ್ಣಿನ ಪೊರೆ ಪರೀಕ್ಷೆ ಮತ್ತು ಕನ್ನಡಕ ವಿತರಣೆ.',
    ARRAY['Free Eye Checkup', 'Free Blood Sugar Test', 'On-Spot Referral'],
    ARRAY['ಉಚಿತ ಕಣ್ಣಿನ ತಪಾಸಣೆ', 'ಉಚಿತ ಸಕ್ಕರೆ ಪರೀಕ್ಷೆ', 'ತಕ್ಷಣದ ಶಿಫಾರಸು'],
    true
  ),
  (
    'Vaccination Information',
    'Mission Indradhanush Immunization Drive',
    'ಮಿಷನ್ ಇಂದ್ರಧನುಷ್ ಲಸಿಕಾ ಅಭಿಯಾನ',
    'Childhood & Maternal Vaccines',
    'ಮಕ್ಕಳು ಮತ್ತು ಗರ್ಭಿಣಿಯರ ಲಸಿಕಾ ಅಭಿಯಾನ',
    '1.8 km (Chandrapur Sub-Center)',
    '1.8 ಕಿ.ಮೀ (ಚಂದ್ರಾಪುರ ಉಪಕೇಂದ್ರ)',
    'Every Wednesday & Saturday · 09:00 AM – 01:00 PM',
    'ಪ್ರತಿ ಬುಧವಾರ ಮತ್ತು ಶನಿವಾರ · ಬೆಳಿಗ್ಗೆ 09:00 – 01:00',
    'ASHA: +91 98390 11245',
    'Free BCG, Polio, DPT, Measles-Rubella, Hepatitis-B, and Tetanus toxoid vaccinations.',
    'ಉಚಿತ ಬಿಸಿಜಿ, ಪೋಲಿಯೋ, ಡಿಪಿಟಿ, ದಡಾರ-ರುಬೆಲ್ಲಾ, ಹೆಪಟೈಟಿಸ್-ಬಿ ಮತ್ತು ಟಿಟಿ ಲಸಿಕೆಗಳು.',
    ARRAY['Free Immunization Card', 'Zero Cost', 'ASHA Follow-Up'],
    ARRAY['ಉಚಿತ ಲಸಿಕೆ ಕಾರ್ಡ್', 'ಸಂಪೂರ್ಣ ಉಚಿತ', 'ಆಶಾ ಕಾರ್ಯಕರ್ತರ ನೆರವು'],
    true
  ),
  (
    'Government Healthcare Schemes',
    'Ayushman Bharat (PM-JAY) Helpdesk',
    'ಆಯುಷ್ಮಾನ್ ಭಾರತ್ (PM-JAY) ಸಹಾಯ ಕೇಂದ್ರ',
    'Up to ₹5 Lakh Annual Cashless Coverage',
    'ವರ್ಷಕ್ಕೆ ₹5 ಲಕ್ಷದವರೆಗೆ ನಗದು ರಹಿತ ಚಿಕಿತ್ಸೆ',
    '4.2 km (CHC Helpdesk Counter 2)',
    '4.2 ಕಿ.ಮೀ (ಸಮುದಾಯ ಆರೋಗ್ಯ ಕೇಂದ್ರ)',
    'Mon–Sat · 10:00 AM – 04:00 PM',
    'ಸೋಮ–ಶನಿ · ಬೆಳಿಗ್ಗೆ 10:00 – ಸಂಜೆ 04:00',
    '14555 (Toll-Free)',
    'Check family eligibility, generate e-KYC golden card, and get cashless hospitalization support.',
    'ಕುಟುಂಬದ ಅರ್ಹತೆ ಪರಿಶೀಲಿಸಿ, ಆಯುಷ್ಮಾನ್ ಕಾರ್ಡ್ ಪಡೆಯಿರಿ ಮತ್ತು ನಗದು ರಹಿತ ಆಸ್ಪತ್ರೆ ಚಿಕಿತ್ಸೆ ಪಡೆಯಿರಿ.',
    ARRAY['₹5L Family Cover', 'Cashless Secondary Care', 'Zero Enrollment Fee'],
    ARRAY['₹5 ಲಕ್ಷ ಕುಟುಂಬ ವಿಮೆ', 'ನಗದು ರಹಿತ ಚಿಕಿತ್ಸೆ', 'ಉಚಿತ ನೋಂದಣಿ'],
    true
  ),
  (
    'Health Awareness',
    'Clean Water, Vector Control & Nutrition Guide',
    'ಶುದ್ಧ ನೀರು, ರೋಗ ನಿಯಂತ್ರಣ ಮತ್ತು ಪೌಷ್ಟಿಕ ಆಹಾರ ಮಾರ್ಗದರ್ಶಿ',
    'Rural Community Preventive Care',
    'ಗ್ರಾಮೀಣ ಸಮುದಾಯ ರೋಗ ತಡೆಗಟ್ಟುವ ಮಾಹಿತಿ',
    'Available Online & Village Center',
    'ಆನ್‌ಲೈನ್ ಮತ್ತು ಗ್ರಾಮ ಕೇಂದ್ರದಲ್ಲಿ ಲಭ್ಯ',
    'Updated Weekly',
    'ವಾರಕ್ಕೊಮ್ಮೆ ನವೀಕರಿಸಲಾಗುತ್ತದೆ',
    '104 Health Helpline',
    'Practical seasonal guidance on dengue prevention, safe drinking water chlorination, and iron-rich diets.',
    'ಡೆಂಗ್ಯೂ ತಡೆಗಟ್ಟುವಿಕೆ, ಶುದ್ಧ ಕುಡಿಯುವ ನೀರು ಮತ್ತು ಕಬ್ಬಿಣಾಂಶಯುಕ್ತ ಪೌಷ್ಟಿಕ ಆಹಾರದ ಕುರಿತು ಸರಳ ಮಾರ್ಗದರ್ಶನ.',
    ARRAY['Monsoon Fever Guide', 'ORS Preparation', 'Maternal Nutrition'],
    ARRAY['ಮಳೆಗಾಲದ ಜ್ವರ ಎಚ್ಚರಿಕೆ', 'ORS ತಯಾರಿಸುವ ವಿಧಾನ', 'ತಾಯಂದಿರ ಪೋಷಣೆ'],
    true
  )
) AS v(
  category, title, title_kn, facility_name, facility_name_kn,
  distance, distance_kn, timings, timings_kn, contact,
  description, description_kn, highlights, highlights_kn, is_active
)
WHERE NOT EXISTS (SELECT 1 FROM public.healthcare_services);

INSERT INTO public.hospitals (name, name_kn, district, address, phone, emergency_24x7, beds_count, timings)
SELECT 'Sitapur Community Health Center (CHC)', 'ಸೀತಾಪುರ ಸಮುದಾಯ ಆರೋಗ್ಯ ಕೇಂದ್ರ', 'Sitapur', 'Block Road, Sitapur', '05862-240112', true, 30, 'Open 24 Hours'
WHERE NOT EXISTS (SELECT 1 FROM public.hospitals);

INSERT INTO public.pharmacies (name, name_kn, district, address, phone, is_jan_aushadhi, timings)
SELECT 'Jan Aushadhi Rural Kendra', 'ಜನ ಔಷಧಿ ಗ್ರಾಮೀಣ ಕೇಂದ್ರ', 'Sitapur', 'Chandrapur Main Market', '+91 94156 11203', true, '08:00 AM – 09:00 PM'
WHERE NOT EXISTS (SELECT 1 FROM public.pharmacies);

INSERT INTO public.laboratories (name, name_kn, district, address, phone, tests_offered, timings)
SELECT 'Gramin Diagnostic & Pathology Center', 'ಗ್ರಾಮೀಣ ಪ್ರಯೋಗಾಲಯ ಕೇಂದ್ರ', 'Sitapur', 'Station Road, Sitapur', '+91 94158 44120', ARRAY['CBC', 'Fasting Blood Sugar', 'Malaria/Dengue', 'Lipid Profile', 'Thyroid'], '07:00 AM – 05:00 PM'
WHERE NOT EXISTS (SELECT 1 FROM public.laboratories);

INSERT INTO public.health_camps (title, title_kn, location, district, camp_date, timings, organizer, contact, services_offered)
SELECT 'Monthly Panchayat Mobile Health Camp', 'ಮಾಸಿಕ ಪಂಚಾಯತ್ ಸಂಚಾರಿ ಆರೋಗ್ಯ ಶಿಬಿರ', 'Chandrapur Panchayat Bhavan', 'Sitapur', '2026-11-27', '09:00 AM – 03:00 PM', 'District Health Office', '+91 94150 22310', ARRAY['Eye Screening', 'BP & Sugar Checkup', 'Dental']
WHERE NOT EXISTS (SELECT 1 FROM public.health_camps);
