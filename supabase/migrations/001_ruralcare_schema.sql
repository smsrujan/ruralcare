-- =============================================================================
-- RuralCare – Complete PostgreSQL Schema Migration (001)
-- Covers all 17 core tables + consultation_messages, constraints, indexes,
-- triggers, and trusted atomic RPC functions.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- Utility Trigger: Automatic updated_at timestamp
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- 1. profiles (Patient & base user identity linked 1:1 to auth.users)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'patient' CHECK (role IN ('patient', 'doctor', 'admin')),
  health_id TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  date_of_birth DATE,
  age INTEGER CHECK (age IS NULL OR (age >= 0 AND age <= 125)),
  gender TEXT,
  email TEXT UNIQUE NOT NULL,
  mobile_number TEXT,
  village TEXT DEFAULT '',
  district TEXT DEFAULT '',
  state TEXT DEFAULT '',
  full_address TEXT DEFAULT '',
  pin_code TEXT DEFAULT '',
  blood_group TEXT DEFAULT '',
  emergency_contact_name TEXT DEFAULT '',
  emergency_contact_number TEXT DEFAULT '',
  avatar_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_mobile ON public.profiles(mobile_number);
CREATE INDEX IF NOT EXISTS idx_profiles_district ON public.profiles(district);

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Prevent users from escalating their own role via client API updates
CREATE OR REPLACE FUNCTION public.prevent_profile_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Browser inserts must always start as patient; doctor/admin are granted only by trusted SQL/admin
    IF COALESCE(auth.role(), '') = 'authenticated' AND NEW.role <> 'patient' THEN
      NEW.role := 'patient';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      IF COALESCE(auth.role(), '') NOT IN ('service_role', 'supabase_admin', 'postgres') THEN
        RAISE EXCEPTION 'Unauthorized: role cannot be changed by user';
      END IF;
    END IF;
    IF NEW.health_id IS DISTINCT FROM OLD.health_id THEN
      IF COALESCE(auth.role(), '') NOT IN ('service_role', 'supabase_admin', 'postgres') THEN
        NEW.health_id := OLD.health_id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_role_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_profile_role_escalation
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_role_escalation();

-- -----------------------------------------------------------------------------
-- 2. doctor_profiles (Verified & registered doctors)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.doctor_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  doctor_code TEXT UNIQUE NOT NULL,
  registration_number TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  mobile_number TEXT NOT NULL,
  qualification TEXT NOT NULL,
  specialization TEXT NOT NULL,
  experience_years INTEGER NOT NULL DEFAULT 0 CHECK (experience_years >= 0 AND experience_years <= 80),
  hospital_name TEXT NOT NULL,
  hospital_address TEXT NOT NULL DEFAULT '',
  district TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  distance_km NUMERIC(6,2) DEFAULT 5.0,
  consultation_fee NUMERIC(10,2) DEFAULT 0,
  languages TEXT[] NOT NULL DEFAULT ARRAY['English', 'Kannada'],
  available_days TEXT[] NOT NULL DEFAULT ARRAY['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  available_timings TEXT NOT NULL DEFAULT 'Mon–Sat · 09:00 AM – 02:00 PM',
  available_today BOOLEAN NOT NULL DEFAULT true,
  photo_path TEXT,
  photo_url TEXT,
  verification_status TEXT NOT NULL DEFAULT 'Pending Verification'
    CHECK (verification_status IN ('Pending Verification', 'Approved', 'Rejected', 'Suspended')),
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doctor_profiles_verified_active
  ON public.doctor_profiles(verification_status, is_active);
CREATE INDEX IF NOT EXISTS idx_doctor_profiles_specialization
  ON public.doctor_profiles(specialization);
CREATE INDEX IF NOT EXISTS idx_doctor_profiles_district
  ON public.doctor_profiles(district);

DROP TRIGGER IF EXISTS trg_doctor_profiles_updated_at ON public.doctor_profiles;
CREATE TRIGGER trg_doctor_profiles_updated_at
  BEFORE UPDATE ON public.doctor_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Prevent doctors from self-approving verification_status or is_active
CREATE OR REPLACE FUNCTION public.prevent_doctor_self_verification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(auth.role(), '') = 'authenticated' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.verification_status := 'Pending Verification';
      NEW.is_active := false;
    ELSIF TG_OP = 'UPDATE' THEN
      IF NEW.verification_status IS DISTINCT FROM OLD.verification_status THEN
        RAISE EXCEPTION 'Unauthorized: doctor verification status can only be changed by an administrator';
      END IF;
      IF OLD.verification_status <> 'Approved' AND NEW.is_active = true THEN
        NEW.is_active := false;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_doctor_self_verification ON public.doctor_profiles;
CREATE TRIGGER trg_prevent_doctor_self_verification
  BEFORE INSERT OR UPDATE ON public.doctor_profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_doctor_self_verification();

-- -----------------------------------------------------------------------------
-- 3. doctor_registration_requests
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.doctor_registration_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  mobile_number TEXT NOT NULL,
  medical_registration_number TEXT UNIQUE NOT NULL,
  qualification TEXT NOT NULL,
  specialization TEXT NOT NULL,
  experience_years INTEGER NOT NULL DEFAULT 0 CHECK (experience_years >= 0),
  hospital_name TEXT NOT NULL,
  hospital_address TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending Verification'
    CHECK (status IN ('Pending Verification', 'Approved', 'Rejected')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_doctor_reg_req_updated_at ON public.doctor_registration_requests;
CREATE TRIGGER trg_doctor_reg_req_updated_at
  BEFORE UPDATE ON public.doctor_registration_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.enforce_pending_doctor_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(auth.role(), '') = 'authenticated' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.status := 'Pending Verification';
      NEW.reviewed_by := NULL;
      NEW.reviewed_at := NULL;
    ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Unauthorized: registration approval requires admin action';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_pending_doctor_request ON public.doctor_registration_requests;
CREATE TRIGGER trg_enforce_pending_doctor_request
  BEFORE INSERT OR UPDATE ON public.doctor_registration_requests
  FOR EACH ROW EXECUTE FUNCTION public.enforce_pending_doctor_request();

-- -----------------------------------------------------------------------------
-- 4. doctor_availability
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.doctor_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES public.doctor_profiles(id) ON DELETE CASCADE,
  available_date DATE,
  available_day TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  slot_label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Available' CHECK (status IN ('Available', 'Unavailable')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_doctor_availability_time CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_doctor_availability_doctor ON public.doctor_availability(doctor_id, status);

DROP TRIGGER IF EXISTS trg_doctor_availability_updated_at ON public.doctor_availability;
CREATE TRIGGER trg_doctor_availability_updated_at
  BEFORE UPDATE ON public.doctor_availability
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 5. health_cards
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.health_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  health_id TEXT UNIQUE NOT NULL,
  qr_payload TEXT NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_health_cards_updated_at ON public.health_cards;
CREATE TRIGGER trg_health_cards_updated_at
  BEFORE UPDATE ON public.health_cards
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 6. patient_health_records
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.patient_health_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recorded_by_doctor_id UUID REFERENCES public.doctor_profiles(id) ON DELETE SET NULL,
  record_date DATE NOT NULL DEFAULT CURRENT_DATE,
  title TEXT NOT NULL,
  title_kn TEXT,
  doctor_name TEXT NOT NULL,
  facility_name TEXT NOT NULL,
  summary TEXT NOT NULL,
  summary_kn TEXT,
  record_type TEXT NOT NULL DEFAULT 'Medical Record',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_health_records_patient ON public.patient_health_records(patient_id, record_date DESC);

DROP TRIGGER IF EXISTS trg_patient_health_records_updated_at ON public.patient_health_records;
CREATE TRIGGER trg_patient_health_records_updated_at
  BEFORE UPDATE ON public.patient_health_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 7. patient_allergies
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.patient_allergies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  allergy_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Allergy' CHECK (category IN ('Allergy', 'Chronic Condition')),
  severity TEXT NOT NULL DEFAULT 'Moderate' CHECK (severity IN ('Mild', 'Moderate', 'Severe')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_allergies_patient ON public.patient_allergies(patient_id);

DROP TRIGGER IF EXISTS trg_patient_allergies_updated_at ON public.patient_allergies;
CREATE TRIGGER trg_patient_allergies_updated_at
  BEFORE UPDATE ON public.patient_allergies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 8. diagnostic_reports
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.diagnostic_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  laboratory_name TEXT NOT NULL,
  test_name TEXT NOT NULL,
  test_date DATE NOT NULL DEFAULT CURRENT_DATE,
  report_date DATE,
  report_file_path TEXT,
  file_name TEXT,
  report_status TEXT NOT NULL DEFAULT 'Ready' CHECK (report_status IN ('Pending', 'Processing', 'Ready', 'Reviewed')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_diagnostic_reports_patient ON public.diagnostic_reports(patient_id, test_date DESC);

DROP TRIGGER IF EXISTS trg_diagnostic_reports_updated_at ON public.diagnostic_reports;
CREATE TRIGGER trg_diagnostic_reports_updated_at
  BEFORE UPDATE ON public.diagnostic_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 9. appointments (with unique active slot constraint to prevent double-booking)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES public.doctor_profiles(id) ON DELETE CASCADE,
  appointment_date DATE NOT NULL,
  appointment_time TEXT NOT NULL,
  consultation_type TEXT NOT NULL DEFAULT 'In-Person' CHECK (consultation_type IN ('In-Person', 'Teleconsultation')),
  patient_message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Accepted', 'Rejected', 'Cancelled', 'Completed')),
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointments_patient ON public.appointments(patient_id, appointment_date DESC);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON public.appointments(doctor_id, appointment_date DESC);

-- Prevent double-booking of active appointments on the same doctor, date, and time slot
CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_unique_active_slot
  ON public.appointments(doctor_id, appointment_date, appointment_time)
  WHERE status IN ('Pending', 'Accepted');

DROP TRIGGER IF EXISTS trg_appointments_updated_at ON public.appointments;
CREATE TRIGGER trg_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 10. doctor_patient_connections & consultation_messages (Realtime Chat)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.doctor_patient_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES public.doctor_profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Accepted', 'Rejected', 'Cancelled', 'Completed')),
  request_note TEXT,
  last_message_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (patient_id, doctor_id)
);

CREATE INDEX IF NOT EXISTS idx_connections_patient ON public.doctor_patient_connections(patient_id);
CREATE INDEX IF NOT EXISTS idx_connections_doctor ON public.doctor_patient_connections(doctor_id);

DROP TRIGGER IF EXISTS trg_connections_updated_at ON public.doctor_patient_connections;
CREATE TRIGGER trg_connections_updated_at
  BEFORE UPDATE ON public.doctor_patient_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.consultation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES public.doctor_patient_connections(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('patient', 'doctor')),
  message_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_consultation_messages_conn ON public.consultation_messages(connection_id, created_at ASC);

-- -----------------------------------------------------------------------------
-- 11–15. Healthcare Services Directory Tables
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.healthcare_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK (category IN (
    'Nearby Hospitals',
    'Pharmacy Services',
    'Ambulance Services',
    'Laboratory Services',
    'Health Camps',
    'Vaccination Information',
    'Government Healthcare Schemes',
    'Health Awareness'
  )),
  title TEXT NOT NULL,
  title_kn TEXT,
  facility_name TEXT NOT NULL,
  facility_name_kn TEXT,
  distance TEXT NOT NULL DEFAULT '',
  distance_kn TEXT,
  timings TEXT NOT NULL DEFAULT '',
  timings_kn TEXT,
  contact TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  description_kn TEXT,
  highlights TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  highlights_kn TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hospitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_kn TEXT,
  district TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  emergency_24x7 BOOLEAN NOT NULL DEFAULT true,
  beds_count INTEGER DEFAULT 0,
  timings TEXT NOT NULL DEFAULT 'Open 24 Hours',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pharmacies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_kn TEXT,
  district TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  is_jan_aushadhi BOOLEAN NOT NULL DEFAULT true,
  timings TEXT NOT NULL DEFAULT '08:00 AM – 09:00 PM',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.laboratories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_kn TEXT,
  district TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  tests_offered TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  timings TEXT NOT NULL DEFAULT '07:00 AM – 05:00 PM',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.health_camps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  title_kn TEXT,
  location TEXT NOT NULL DEFAULT '',
  district TEXT NOT NULL DEFAULT '',
  camp_date DATE,
  timings TEXT NOT NULL DEFAULT '',
  organizer TEXT NOT NULL DEFAULT '',
  contact TEXT NOT NULL DEFAULT '',
  services_offered TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 16. emergency_alerts
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.emergency_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emergency_contact_name TEXT NOT NULL,
  emergency_contact_number TEXT NOT NULL,
  emergency_description TEXT NOT NULL,
  location_label TEXT DEFAULT '',
  gps_latitude DOUBLE PRECISION,
  gps_longitude DOUBLE PRECISION,
  location_sharing_status TEXT NOT NULL CHECK (location_sharing_status IN ('Shared', 'Unavailable')),
  alert_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  emergency_status TEXT NOT NULL DEFAULT 'Logged' CHECK (emergency_status IN ('Logged', 'Acknowledged', 'Resolved')),
  acknowledged_by_doctor_id UUID REFERENCES public.doctor_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_emergency_alerts_patient ON public.emergency_alerts(patient_id, alert_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_emergency_alerts_status ON public.emergency_alerts(emergency_status, alert_timestamp DESC);

DROP TRIGGER IF EXISTS trg_emergency_alerts_updated_at ON public.emergency_alerts;
CREATE TRIGGER trg_emergency_alerts_updated_at
  BEFORE UPDATE ON public.emergency_alerts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 17. notifications
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  title_kn TEXT,
  message TEXT NOT NULL,
  message_kn TEXT,
  notification_type TEXT NOT NULL DEFAULT 'general',
  domain_route TEXT NOT NULL DEFAULT '/dashboard',
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, is_read, created_at DESC);

-- =============================================================================
-- Trusted Database Triggers & RPC Functions
-- =============================================================================

-- Automatically provision patient profile + health card OR pending doctor request
-- when a new user signs up via supabase.auth.signUp() (works even if email confirmation is enabled)
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta JSONB := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  signup_intent TEXT := COALESCE(meta->>'signup_intent', 'patient');
  v_full_name TEXT := COALESCE(NULLIF(TRIM(meta->>'full_name'), ''), split_part(COALESCE(NEW.email, 'User'), '@', 1));
  v_district TEXT := COALESCE(meta->>'district', '');
  v_health_id TEXT;
  v_age INTEGER := NULL;
BEGIN
  IF NULLIF(meta->>'age', '') IS NOT NULL THEN
    v_age := (meta->>'age')::INTEGER;
  END IF;

  v_health_id := COALESCE(
    NULLIF(TRIM(meta->>'health_id'), ''),
    'RC-' || UPPER(SUBSTRING(REGEXP_REPLACE(COALESCE(v_district, 'IN'), '[^A-Za-z]', '', 'g') || 'IN', 1, 2))
      || UPPER(SUBSTRING(REGEXP_REPLACE(v_full_name, '[^A-Za-z]', '', 'g') || 'RC', 1, 2))
      || '-' || LPAD(((abs(hashtext(NEW.id::text)) % 9000) + 1000)::text, 4, '0')
  );

  -- Doctor signups receive role = 'doctor' (Pending Verification, is_active = false) and NO patient privileges or health card
  INSERT INTO public.profiles (
    id, role, health_id, full_name, date_of_birth, age, gender, email,
    mobile_number, village, district, state, full_address, pin_code,
    blood_group, emergency_contact_name, emergency_contact_number
  )
  VALUES (
    NEW.id,
    CASE WHEN signup_intent = 'doctor' THEN 'doctor' ELSE 'patient' END,
    CASE WHEN signup_intent = 'doctor' THEN 'DOC-PENDING-' || UPPER(SUBSTRING(REPLACE(NEW.id::text, '-', ''), 1, 8)) ELSE v_health_id END,
    v_full_name,
    NULLIF(meta->>'date_of_birth', '')::DATE,
    v_age,
    COALESCE(meta->>'gender', ''),
    LOWER(COALESCE(NEW.email, '')),
    COALESCE(meta->>'mobile_number', ''),
    COALESCE(meta->>'village', ''),
    v_district,
    COALESCE(meta->>'state', ''),
    COALESCE(meta->>'full_address', ''),
    COALESCE(meta->>'pin_code', ''),
    COALESCE(meta->>'blood_group', ''),
    COALESCE(meta->>'emergency_contact_name', ''),
    COALESCE(meta->>'emergency_contact_number', '')
  )
  ON CONFLICT (id) DO NOTHING;

  IF signup_intent = 'doctor' THEN
    INSERT INTO public.doctor_registration_requests (
      user_id, full_name, email, mobile_number, medical_registration_number,
      qualification, specialization, experience_years, hospital_name, hospital_address, status
    )
    VALUES (
      NEW.id,
      v_full_name,
      LOWER(COALESCE(NEW.email, '')),
      COALESCE(meta->>'mobile_number', ''),
      COALESCE(NULLIF(TRIM(meta->>'medical_registration_number'), ''), 'PENDING-' || SUBSTRING(NEW.id::text, 1, 8)),
      COALESCE(meta->>'qualification', ''),
      COALESCE(meta->>'specialization', 'General Physician'),
      COALESCE(NULLIF(meta->>'experience_years', '')::INTEGER, 0),
      COALESCE(meta->>'hospital_name', ''),
      COALESCE(meta->>'hospital_address', ''),
      'Pending Verification'
    )
    ON CONFLICT (user_id) DO NOTHING;

    INSERT INTO public.doctor_profiles (
      user_id, doctor_code, registration_number, full_name, email, mobile_number,
      qualification, specialization, experience_years, hospital_name, hospital_address,
      district, location, verification_status, is_active
    )
    VALUES (
      NEW.id,
      'RC-DOC-' || UPPER(SUBSTRING(REPLACE(NEW.id::text, '-', ''), 1, 6)),
      COALESCE(NULLIF(TRIM(meta->>'medical_registration_number'), ''), 'PENDING-' || SUBSTRING(NEW.id::text, 1, 8)),
      v_full_name,
      LOWER(COALESCE(NEW.email, '')),
      COALESCE(meta->>'mobile_number', ''),
      COALESCE(meta->>'qualification', ''),
      COALESCE(meta->>'specialization', 'General Physician'),
      COALESCE(NULLIF(meta->>'experience_years', '')::INTEGER, 0),
      COALESCE(meta->>'hospital_name', ''),
      COALESCE(meta->>'hospital_address', ''),
      v_district,
      COALESCE(meta->>'hospital_address', ''),
      'Pending Verification',
      false
    )
    ON CONFLICT (user_id) DO NOTHING;
  ELSE
    INSERT INTO public.health_cards (patient_id, health_id, qr_payload, status)
    VALUES (
      NEW.id,
      v_health_id,
      v_health_id || '|' || v_full_name || '|' || COALESCE(meta->>'blood_group', '') || '|' || COALESCE(meta->>'village', '') || ',' || v_district,
      'Active'
    )
    ON CONFLICT (patient_id) DO NOTHING;

    INSERT INTO public.notifications (user_id, title, title_kn, message, message_kn, notification_type, domain_route)
    VALUES (
      NEW.id,
      'Digital Health Card Ready',
      'ಡಿಜಿಟಲ್ ಆರೋಗ್ಯ ಕಾರ್ಡ್ ಸಿದ್ಧವಾಗಿದೆ',
      'Welcome ' || v_full_name || '. Your Health ID ' || v_health_id || ' is now active.',
      'ಸ್ವಾಗತ ' || v_full_name || '. ನಿಮ್ಮ ಆರೋಗ್ಯ ಗುರುತಿನ ಸಂಖ್ಯೆ ' || v_health_id || ' ಈಗ ಸಕ್ರಿಯವಾಗಿದೆ.',
      'health_card',
      '/health-card'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- Resolve patient email from 10-digit mobile for patient login convenience
CREATE OR REPLACE FUNCTION public.resolve_login_email_by_mobile(p_mobile TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean TEXT := regexp_replace(COALESCE(p_mobile, ''), '\D', '', 'g');
  v_email TEXT;
BEGIN
  IF length(v_clean) = 12 AND left(v_clean, 2) = '91' THEN
    v_clean := substring(v_clean FROM 3);
  ELSIF length(v_clean) = 11 AND left(v_clean, 1) = '0' THEN
    v_clean := substring(v_clean FROM 2);
  END IF;

  IF length(v_clean) <> 10 THEN
    RETURN NULL;
  END IF;

  SELECT email INTO v_email
  FROM public.profiles
  WHERE mobile_number = v_clean AND role = 'patient'
  LIMIT 1;

  RETURN v_email;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_login_email_by_mobile(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_login_email_by_mobile(TEXT) TO anon, authenticated;

-- Trusted atomic appointment booking (prevents double booking & checks doctor verification/availability)
CREATE OR REPLACE FUNCTION public.book_appointment_atomic(
  p_doctor_id UUID,
  p_appointment_date DATE,
  p_appointment_time TEXT,
  p_consultation_type TEXT DEFAULT 'In-Person',
  p_patient_message TEXT DEFAULT ''
)
RETURNS public.appointments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_id UUID := auth.uid();
  v_patient_name TEXT;
  v_doc public.doctor_profiles%ROWTYPE;
  v_unavailable_exists BOOLEAN;
  v_inserted public.appointments%ROWTYPE;
BEGIN
  IF v_patient_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to book an appointment';
  END IF;

  IF p_appointment_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'Appointment date cannot be in the past';
  END IF;

  IF TRIM(COALESCE(p_patient_message, '')) = '' THEN
    RAISE EXCEPTION 'Please enter a reason for the appointment';
  END IF;

  SELECT full_name INTO v_patient_name FROM public.profiles WHERE id = v_patient_id AND role = 'patient';
  IF v_patient_name IS NULL THEN
    RAISE EXCEPTION 'Patient profile not found';
  END IF;

  SELECT * INTO v_doc
  FROM public.doctor_profiles
  WHERE id = p_doctor_id AND verification_status = 'Approved' AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Selected doctor is not verified or not active';
  END IF;

  -- Check if doctor explicitly marked this slot/date Unavailable in doctor_availability
  SELECT EXISTS (
    SELECT 1 FROM public.doctor_availability da
    WHERE da.doctor_id = p_doctor_id
      AND da.status = 'Unavailable'
      AND (da.available_date = p_appointment_date OR da.available_date IS NULL)
      AND da.slot_label = p_appointment_time
  ) INTO v_unavailable_exists;

  IF v_unavailable_exists THEN
    RAISE EXCEPTION 'Appointment slot is no longer available';
  END IF;

  INSERT INTO public.appointments (
    patient_id, doctor_id, appointment_date, appointment_time,
    consultation_type, patient_message, status
  )
  VALUES (
    v_patient_id, p_doctor_id, p_appointment_date, p_appointment_time,
    COALESCE(NULLIF(p_consultation_type, ''), 'In-Person'),
    TRIM(p_patient_message),
    'Pending'
  )
  RETURNING * INTO v_inserted;

  -- Notify patient
  INSERT INTO public.notifications (user_id, title, title_kn, message, message_kn, notification_type, domain_route)
  VALUES (
    v_patient_id,
    'Appointment Request Submitted',
    'ಅಪಾಯಿಂಟ್ಮೆಂಟ್ ವಿನಂತಿ ಸಲ್ಲಿಸಲಾಗಿದೆ',
    v_doc.full_name || ' · ' || p_appointment_date::text || ' (' || p_appointment_time || ')',
    v_doc.full_name || ' · ' || p_appointment_date::text || ' (' || p_appointment_time || ')',
    'appointment',
    '/appointments'
  );

  -- Notify doctor if linked to an auth user
  IF v_doc.user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, title_kn, message, message_kn, notification_type, domain_route)
    VALUES (
      v_doc.user_id,
      'New Appointment Request',
      'ಹೊಸ ಅಪಾಯಿಂಟ್ಮೆಂಟ್ ವಿನಂತಿ',
      v_patient_name || ' · ' || p_appointment_date::text || ' (' || p_appointment_time || ')',
      v_patient_name || ' · ' || p_appointment_date::text || ' (' || p_appointment_time || ')',
      'appointment',
      '/appointments'
    );
  END IF;

  RETURN v_inserted;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Appointment slot is no longer available';
END;
$$;

REVOKE ALL ON FUNCTION public.book_appointment_atomic(UUID, DATE, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.book_appointment_atomic(UUID, DATE, TEXT, TEXT, TEXT) TO authenticated;

-- Trusted status transitions + synchronized notifications
CREATE OR REPLACE FUNCTION public.update_appointment_status_secure(
  p_appointment_id UUID,
  p_next_status TEXT,
  p_rejection_reason TEXT DEFAULT NULL
)
RETURNS public.appointments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_apt public.appointments%ROWTYPE;
  v_doc public.doctor_profiles%ROWTYPE;
  v_patient_name TEXT;
  v_updated public.appointments%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_apt FROM public.appointments WHERE id = p_appointment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment not found';
  END IF;

  SELECT * INTO v_doc FROM public.doctor_profiles WHERE id = v_apt.doctor_id;
  SELECT full_name INTO v_patient_name FROM public.profiles WHERE id = v_apt.patient_id;

  IF p_next_status = 'Cancelled' THEN
    IF v_apt.patient_id <> v_uid THEN
      RAISE EXCEPTION 'Access denied: only the patient can cancel this appointment';
    END IF;
    IF v_apt.status NOT IN ('Pending', 'Accepted') THEN
      RAISE EXCEPTION 'Only Pending or Accepted appointments can be cancelled';
    END IF;
  ELSIF p_next_status IN ('Accepted', 'Rejected', 'Completed') THEN
    IF v_doc.user_id IS DISTINCT FROM v_uid OR v_doc.verification_status <> 'Approved' OR v_doc.is_active = false THEN
      RAISE EXCEPTION 'Access denied: only the assigned verified doctor can update this appointment';
    END IF;
  ELSE
    RAISE EXCEPTION 'Invalid appointment status transition';
  END IF;

  UPDATE public.appointments
  SET
    status = p_next_status,
    rejection_reason = CASE WHEN p_next_status = 'Rejected' THEN NULLIF(TRIM(p_rejection_reason), '') ELSE rejection_reason END,
    updated_at = now()
  WHERE id = p_appointment_id
  RETURNING * INTO v_updated;

  -- Synchronize notifications
  IF p_next_status IN ('Accepted', 'Rejected', 'Completed') THEN
    INSERT INTO public.notifications (user_id, title, title_kn, message, message_kn, notification_type, domain_route)
    VALUES (
      v_apt.patient_id,
      'Appointment ' || p_next_status,
      'ಅಪಾಯಿಂಟ್ಮೆಂಟ್ ಸ್ಥಿತಿ: ' || p_next_status,
      v_doc.full_name || ' (' || v_apt.appointment_date::text || ' · ' || v_apt.appointment_time || ')' ||
        CASE WHEN p_next_status = 'Rejected' AND NULLIF(TRIM(p_rejection_reason), '') IS NOT NULL THEN ' — ' || TRIM(p_rejection_reason) ELSE '' END,
      v_doc.full_name || ' (' || v_apt.appointment_date::text || ' · ' || v_apt.appointment_time || ')',
      'appointment',
      '/appointments'
    );
  ELSIF p_next_status = 'Cancelled' AND v_doc.user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, title_kn, message, message_kn, notification_type, domain_route)
    VALUES (
      v_doc.user_id,
      'Appointment Cancelled',
      'ಅಪಾಯಿಂಟ್ಮೆಂಟ್ ರದ್ದುಮಾಡಲಾಗಿದೆ',
      COALESCE(v_patient_name, 'Patient') || ' cancelled the slot on ' || v_apt.appointment_date::text || ' (' || v_apt.appointment_time || ')',
      COALESCE(v_patient_name, 'Patient') || ' · ' || v_apt.appointment_date::text || ' (' || v_apt.appointment_time || ')',
      'appointment',
      '/appointments'
    );
  END IF;

  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.update_appointment_status_secure(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_appointment_status_secure(UUID, TEXT, TEXT) TO authenticated;

-- Trusted admin-only doctor approval function (NOT callable by browser users)
CREATE OR REPLACE FUNCTION public.approve_doctor_registration(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET role = 'doctor', updated_at = now()
  WHERE id = p_user_id;

  UPDATE public.doctor_profiles
  SET verification_status = 'Approved', is_active = true, updated_at = now()
  WHERE user_id = p_user_id;

  UPDATE public.doctor_registration_requests
  SET status = 'Approved', reviewed_at = now(), updated_at = now()
  WHERE user_id = p_user_id;

  INSERT INTO public.notifications (user_id, title, title_kn, message, message_kn, notification_type, domain_route)
  VALUES (
    p_user_id,
    'Doctor Account Verified',
    'ವೈದ್ಯರ ಖಾತೆ ಪರಿಶೀಲಿಸಲಾಗಿದೆ',
    'Your RuralCare doctor registration has been approved. You can now access the Doctor Dashboard.',
    'ನಿಮ್ಮ RuralCare ವೈದ್ಯರ ನೋಂದಣಿ ಅನುಮೋದಿಸಲಾಗಿದೆ. ನೀವು ಈಗ ವೈದ್ಯರ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್ ಬಳಸಬಹುದು.',
    'verification',
    '/doctor-dashboard'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.approve_doctor_registration(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_doctor_registration(UUID) FROM anon, authenticated;
