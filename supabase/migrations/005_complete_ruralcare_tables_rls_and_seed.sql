-- =============================================================================
-- RuralCare – Complete Idempotent Schema, RLS, Storage, Realtime & Seed (005)
-- Safe to run on an existing project (even if 004 was already applied).
-- Preserves all existing auth users, profiles, health_cards, and records.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- 1. Utility Trigger: Automatic updated_at timestamp
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

CREATE OR REPLACE FUNCTION public.is_admin(p_uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_uid
      AND p.role = 'admin'
  );
$$;

-- -----------------------------------------------------------------------------
-- 2. profiles (1:1 linked to auth.users.id) + missing-column upgrades
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'patient',
  health_id TEXT UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  date_of_birth DATE,
  age INTEGER,
  gender TEXT DEFAULT '',
  email TEXT UNIQUE NOT NULL DEFAULT '',
  mobile_number TEXT DEFAULT '',
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

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'patient';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS health_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS age INTEGER;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS mobile_number TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS village TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS district TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS state TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_address TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pin_code TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS blood_group TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS emergency_contact_number TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_path TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE public.profiles
SET role = 'patient'
WHERE role IS NULL OR TRIM(role) = '';

UPDATE public.profiles
SET health_id = 'RC-MIG-' || UPPER(SUBSTRING(REPLACE(id::text, '-', ''), 1, 8))
WHERE health_id IS NULL OR TRIM(health_id) = '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND conname = 'profiles_role_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_role_check CHECK (role IN ('patient', 'doctor', 'admin'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND conname = 'profiles_age_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_age_check CHECK (age IS NULL OR (age >= 0 AND age <= 125));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_health_id_unique ON public.profiles(health_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_mobile ON public.profiles(mobile_number);
CREATE INDEX IF NOT EXISTS idx_profiles_district ON public.profiles(district);

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.prevent_profile_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(auth.role(), '') = 'authenticated' AND NEW.role <> 'patient' THEN
      NEW.role := 'patient';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      IF COALESCE(auth.role(), '') NOT IN ('service_role', 'supabase_admin', 'postgres')
         AND NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Unauthorized: role cannot be changed by user';
      END IF;
    END IF;
    IF NEW.health_id IS DISTINCT FROM OLD.health_id AND OLD.health_id IS NOT NULL AND TRIM(OLD.health_id) <> '' THEN
      IF COALESCE(auth.role(), '') NOT IN ('service_role', 'supabase_admin', 'postgres')
         AND NOT public.is_admin(auth.uid()) THEN
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
-- 3. doctor_profiles
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

ALTER TABLE public.doctor_profiles ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.doctor_profiles ADD COLUMN IF NOT EXISTS doctor_code TEXT;
ALTER TABLE public.doctor_profiles ADD COLUMN IF NOT EXISTS registration_number TEXT;
ALTER TABLE public.doctor_profiles ADD COLUMN IF NOT EXISTS full_name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.doctor_profiles ADD COLUMN IF NOT EXISTS email TEXT NOT NULL DEFAULT '';
ALTER TABLE public.doctor_profiles ADD COLUMN IF NOT EXISTS mobile_number TEXT NOT NULL DEFAULT '';
ALTER TABLE public.doctor_profiles ADD COLUMN IF NOT EXISTS qualification TEXT NOT NULL DEFAULT '';
ALTER TABLE public.doctor_profiles ADD COLUMN IF NOT EXISTS specialization TEXT NOT NULL DEFAULT 'General Physician';
ALTER TABLE public.doctor_profiles ADD COLUMN IF NOT EXISTS experience_years INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.doctor_profiles ADD COLUMN IF NOT EXISTS hospital_name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.doctor_profiles ADD COLUMN IF NOT EXISTS hospital_address TEXT NOT NULL DEFAULT '';
ALTER TABLE public.doctor_profiles ADD COLUMN IF NOT EXISTS district TEXT NOT NULL DEFAULT '';
ALTER TABLE public.doctor_profiles ADD COLUMN IF NOT EXISTS location TEXT NOT NULL DEFAULT '';
ALTER TABLE public.doctor_profiles ADD COLUMN IF NOT EXISTS distance_km NUMERIC(6,2) DEFAULT 5.0;
ALTER TABLE public.doctor_profiles ADD COLUMN IF NOT EXISTS consultation_fee NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.doctor_profiles ADD COLUMN IF NOT EXISTS languages TEXT[] NOT NULL DEFAULT ARRAY['English', 'Kannada'];
ALTER TABLE public.doctor_profiles ADD COLUMN IF NOT EXISTS available_days TEXT[] NOT NULL DEFAULT ARRAY['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
ALTER TABLE public.doctor_profiles ADD COLUMN IF NOT EXISTS available_timings TEXT NOT NULL DEFAULT 'Mon–Sat · 09:00 AM – 02:00 PM';
ALTER TABLE public.doctor_profiles ADD COLUMN IF NOT EXISTS available_today BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.doctor_profiles ADD COLUMN IF NOT EXISTS photo_path TEXT;
ALTER TABLE public.doctor_profiles ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE public.doctor_profiles ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'Pending Verification';
ALTER TABLE public.doctor_profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.doctor_profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.doctor_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

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

CREATE OR REPLACE FUNCTION public.prevent_doctor_self_verification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(auth.role(), '') = 'authenticated' AND NOT public.is_admin(auth.uid()) THEN
    IF TG_OP = 'INSERT' THEN
      NEW.verification_status := 'Approved';
      NEW.is_active := true;
    ELSIF TG_OP = 'UPDATE' THEN
      IF NEW.verification_status IS DISTINCT FROM OLD.verification_status THEN
        NEW.verification_status := 'Approved';
      END IF;
      if NEW.is_active = false THEN
        NEW.is_active := true;
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
-- 4. doctor_registration_requests
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

ALTER TABLE public.doctor_registration_requests ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.doctor_registration_requests ADD COLUMN IF NOT EXISTS full_name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.doctor_registration_requests ADD COLUMN IF NOT EXISTS email TEXT NOT NULL DEFAULT '';
ALTER TABLE public.doctor_registration_requests ADD COLUMN IF NOT EXISTS mobile_number TEXT NOT NULL DEFAULT '';
ALTER TABLE public.doctor_registration_requests ADD COLUMN IF NOT EXISTS medical_registration_number TEXT;
ALTER TABLE public.doctor_registration_requests ADD COLUMN IF NOT EXISTS qualification TEXT NOT NULL DEFAULT '';
ALTER TABLE public.doctor_registration_requests ADD COLUMN IF NOT EXISTS specialization TEXT NOT NULL DEFAULT 'General Physician';
ALTER TABLE public.doctor_registration_requests ADD COLUMN IF NOT EXISTS experience_years INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.doctor_registration_requests ADD COLUMN IF NOT EXISTS hospital_name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.doctor_registration_requests ADD COLUMN IF NOT EXISTS hospital_address TEXT NOT NULL DEFAULT '';
ALTER TABLE public.doctor_registration_requests ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Pending Verification';
ALTER TABLE public.doctor_registration_requests ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id);
ALTER TABLE public.doctor_registration_requests ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE public.doctor_registration_requests ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.doctor_registration_requests ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.doctor_registration_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

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
  IF COALESCE(auth.role(), '') = 'authenticated' AND NOT public.is_admin(auth.uid()) THEN
    IF TG_OP = 'INSERT' THEN
      NEW.status := 'Approved';
      NEW.reviewed_by := NULL;
      NEW.reviewed_at := NULL;
    ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
      NEW.status := 'Approved';
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
-- 5. doctor_availability
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

CREATE INDEX IF NOT EXISTS idx_doctor_availability_doctor
  ON public.doctor_availability(doctor_id, status);

DROP TRIGGER IF EXISTS trg_doctor_availability_updated_at ON public.doctor_availability;
CREATE TRIGGER trg_doctor_availability_updated_at
  BEFORE UPDATE ON public.doctor_availability
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 6. health_cards
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

ALTER TABLE public.health_cards ADD COLUMN IF NOT EXISTS patient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.health_cards ADD COLUMN IF NOT EXISTS health_id TEXT;
ALTER TABLE public.health_cards ADD COLUMN IF NOT EXISTS qr_payload TEXT NOT NULL DEFAULT '';
ALTER TABLE public.health_cards ADD COLUMN IF NOT EXISTS issued_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.health_cards ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Active';
ALTER TABLE public.health_cards ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.health_cards ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS trg_health_cards_updated_at ON public.health_cards;
CREATE TRIGGER trg_health_cards_updated_at
  BEFORE UPDATE ON public.health_cards
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 7. patient_health_records
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

CREATE INDEX IF NOT EXISTS idx_patient_health_records_patient
  ON public.patient_health_records(patient_id, record_date DESC);

DROP TRIGGER IF EXISTS trg_patient_health_records_updated_at ON public.patient_health_records;
CREATE TRIGGER trg_patient_health_records_updated_at
  BEFORE UPDATE ON public.patient_health_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 8. patient_allergies
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

CREATE INDEX IF NOT EXISTS idx_patient_allergies_patient
  ON public.patient_allergies(patient_id);

DROP TRIGGER IF EXISTS trg_patient_allergies_updated_at ON public.patient_allergies;
CREATE TRIGGER trg_patient_allergies_updated_at
  BEFORE UPDATE ON public.patient_allergies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 9. diagnostic_reports
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

CREATE INDEX IF NOT EXISTS idx_diagnostic_reports_patient
  ON public.diagnostic_reports(patient_id, test_date DESC);

DROP TRIGGER IF EXISTS trg_diagnostic_reports_updated_at ON public.diagnostic_reports;
CREATE TRIGGER trg_diagnostic_reports_updated_at
  BEFORE UPDATE ON public.diagnostic_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 10. appointments
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_unique_active_slot
  ON public.appointments(doctor_id, appointment_date, appointment_time)
  WHERE status IN ('Pending', 'Accepted');

DROP TRIGGER IF EXISTS trg_appointments_updated_at ON public.appointments;
CREATE TRIGGER trg_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 11. doctor_patient_connections & consultation_messages
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

CREATE INDEX IF NOT EXISTS idx_consultation_messages_conn
  ON public.consultation_messages(connection_id, created_at ASC);

-- -----------------------------------------------------------------------------
-- 12–16. Healthcare Services & Directory Tables
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

CREATE INDEX IF NOT EXISTS idx_healthcare_services_category_active
  ON public.healthcare_services(category, is_active);

CREATE INDEX IF NOT EXISTS idx_hospitals_district_active
  ON public.hospitals(district, is_active);

CREATE INDEX IF NOT EXISTS idx_pharmacies_district_active
  ON public.pharmacies(district, is_active);

CREATE INDEX IF NOT EXISTS idx_laboratories_district_active
  ON public.laboratories(district, is_active);

CREATE INDEX IF NOT EXISTS idx_health_camps_date_active
  ON public.health_camps(camp_date, is_active);

DROP TRIGGER IF EXISTS trg_healthcare_services_updated_at ON public.healthcare_services;
CREATE TRIGGER trg_healthcare_services_updated_at
  BEFORE UPDATE ON public.healthcare_services
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_hospitals_updated_at ON public.hospitals;
CREATE TRIGGER trg_hospitals_updated_at
  BEFORE UPDATE ON public.hospitals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_pharmacies_updated_at ON public.pharmacies;
CREATE TRIGGER trg_pharmacies_updated_at
  BEFORE UPDATE ON public.pharmacies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_laboratories_updated_at ON public.laboratories;
CREATE TRIGGER trg_laboratories_updated_at
  BEFORE UPDATE ON public.laboratories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_health_camps_updated_at ON public.health_camps;
CREATE TRIGGER trg_health_camps_updated_at
  BEFORE UPDATE ON public.health_camps
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 17. emergency_alerts
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
-- 18. notifications
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

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS title_kn TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS message TEXT NOT NULL DEFAULT '';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS message_kn TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS notification_type TEXT NOT NULL DEFAULT 'general';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS domain_route TEXT NOT NULL DEFAULT '/dashboard';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications(user_id, is_read, created_at DESC);

-- =============================================================================
-- Trusted Auth Trigger & RPC Functions
-- =============================================================================

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
      COALESCE(NULLIF(TRIM(meta->>'medical_registration_number'), ''), 'DOC-' || SUBSTRING(NEW.id::text, 1, 8)),
      COALESCE(meta->>'qualification', ''),
      COALESCE(meta->>'specialization', 'General Physician'),
      COALESCE(NULLIF(meta->>'experience_years', '')::INTEGER, 0),
      COALESCE(meta->>'hospital_name', ''),
      COALESCE(meta->>'hospital_address', ''),
      'Approved'
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
      COALESCE(NULLIF(TRIM(meta->>'medical_registration_number'), ''), 'DOC-' || SUBSTRING(NEW.id::text, 1, 8)),
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
      'Approved',
      true
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

-- =============================================================================
-- Row Level Security (RLS) Helper Functions & Complete Policies (ALL 18 TABLES)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_verified_doctor(p_uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.doctor_profiles dp
    JOIN public.profiles p ON p.id = dp.user_id
    WHERE dp.user_id = p_uid
      AND p.role = 'doctor'
      AND dp.verification_status = 'Approved'
      AND dp.is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_patient_account(p_uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_uid
      AND p.role = 'patient'
      AND NOT EXISTS (SELECT 1 FROM public.doctor_profiles dp WHERE dp.user_id = p_uid)
      AND NOT EXISTS (SELECT 1 FROM public.doctor_registration_requests dr WHERE dr.user_id = p_uid)
  );
$$;

CREATE OR REPLACE FUNCTION public.doctor_can_access_patient(p_doc_uid UUID, p_patient_uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_verified_doctor(p_doc_uid) AND (
    EXISTS (
      SELECT 1
      FROM public.appointments a
      JOIN public.doctor_profiles dp ON dp.id = a.doctor_id
      WHERE dp.user_id = p_doc_uid
        AND a.patient_id = p_patient_uid
        AND a.status IN ('Pending', 'Accepted', 'Completed')
    )
    OR EXISTS (
      SELECT 1
      FROM public.doctor_patient_connections c
      JOIN public.doctor_profiles dp ON dp.id = c.doctor_id
      WHERE dp.user_id = p_doc_uid
        AND c.patient_id = p_patient_uid
        AND c.status IN ('Pending', 'Accepted', 'Completed')
    )
    OR EXISTS (
      SELECT 1
      FROM public.emergency_alerts ea
      WHERE ea.patient_id = p_patient_uid
        AND ea.emergency_status IN ('Logged', 'Acknowledged')
    )
  );
$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_registration_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_health_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_allergies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnostic_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_patient_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.healthcare_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.laboratories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_camps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 1. profiles
DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
CREATE POLICY "Users view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id
    OR public.doctor_can_access_patient(auth.uid(), id)
    OR public.is_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Users insert own profile as patient" ON public.profiles;
CREATE POLICY "Users insert own profile as patient"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK ((auth.uid() = id AND role = 'patient') OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id OR public.is_admin(auth.uid()))
  WITH CHECK (auth.uid() = id OR public.is_admin(auth.uid()));

-- 2. doctor_profiles
DROP POLICY IF EXISTS "Approved active doctors visible to authenticated users; own visible to self" ON public.doctor_profiles;
CREATE POLICY "Approved active doctors visible to authenticated users; own visible to self"
  ON public.doctor_profiles FOR SELECT
  TO authenticated
  USING (
    (verification_status = 'Approved' AND is_active = true)
    OR user_id = auth.uid()
    OR public.is_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Doctors create own pending profile" ON public.doctor_profiles;
CREATE POLICY "Doctors create own pending profile"
  ON public.doctor_profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      user_id = auth.uid()
      AND verification_status = 'Pending Verification'
      AND is_active = false
    )
    OR public.is_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Verified doctors update own profile fields" ON public.doctor_profiles;
CREATE POLICY "Doctors update own profile fields"
  ON public.doctor_profiles FOR UPDATE
  TO authenticated
  USING ((user_id = auth.uid() AND verification_status IN ('Pending Verification', 'Approved')) OR public.is_admin(auth.uid()))
  WITH CHECK ((user_id = auth.uid() AND verification_status IN ('Pending Verification', 'Approved')) OR public.is_admin(auth.uid()));

-- 3. doctor_registration_requests
DROP POLICY IF EXISTS "Users view own doctor registration request" ON public.doctor_registration_requests;
CREATE POLICY "Users view own doctor registration request"
  ON public.doctor_registration_requests FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users submit own pending doctor registration request" ON public.doctor_registration_requests;
CREATE POLICY "Users submit own pending doctor registration request"
  ON public.doctor_registration_requests FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'Pending Verification');

DROP POLICY IF EXISTS "Users update own pending doctor registration request" ON public.doctor_registration_requests;
CREATE POLICY "Users update own pending doctor registration request"
  ON public.doctor_registration_requests FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND status = 'Pending Verification')
  WITH CHECK (user_id = auth.uid() AND status = 'Pending Verification');

DROP POLICY IF EXISTS "Admins review doctor registration requests" ON public.doctor_registration_requests;
CREATE POLICY "Admins review doctor registration requests"
  ON public.doctor_registration_requests FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- 4. doctor_availability
DROP POLICY IF EXISTS "Authenticated users read approved doctor availability" ON public.doctor_availability;
CREATE POLICY "Authenticated users read approved doctor availability"
  ON public.doctor_availability FOR SELECT
  TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.doctor_profiles dp
      WHERE dp.id = doctor_id
        AND ((dp.verification_status = 'Approved' AND dp.is_active = true) OR dp.user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Verified doctors manage own availability" ON public.doctor_availability;
CREATE POLICY "Verified doctors manage own availability"
  ON public.doctor_availability FOR ALL
  TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.doctor_profiles dp
      WHERE dp.id = doctor_id AND dp.user_id = auth.uid() AND dp.verification_status = 'Approved'
    )
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.doctor_profiles dp
      WHERE dp.id = doctor_id AND dp.user_id = auth.uid() AND dp.verification_status = 'Approved'
    )
  );

-- 5. health_cards
DROP POLICY IF EXISTS "Patient or authorized doctor reads health card" ON public.health_cards;
CREATE POLICY "Patient or authorized doctor reads health card"
  ON public.health_cards FOR SELECT
  TO authenticated
  USING (
    patient_id = auth.uid()
    OR public.doctor_can_access_patient(auth.uid(), patient_id)
  );

DROP POLICY IF EXISTS "Patient inserts own health card" ON public.health_cards;
CREATE POLICY "Patient inserts own health card"
  ON public.health_cards FOR INSERT
  TO authenticated
  WITH CHECK (patient_id = auth.uid() AND public.is_patient_account(auth.uid()));

DROP POLICY IF EXISTS "Patient updates own health card" ON public.health_cards;
CREATE POLICY "Patient updates own health card"
  ON public.health_cards FOR UPDATE
  TO authenticated
  USING (patient_id = auth.uid())
  WITH CHECK (patient_id = auth.uid());

-- 6. patient_health_records
DROP POLICY IF EXISTS "Patient or authorized doctor reads medical records" ON public.patient_health_records;
CREATE POLICY "Patient or authorized doctor reads medical records"
  ON public.patient_health_records FOR SELECT
  TO authenticated
  USING (
    patient_id = auth.uid()
    OR public.doctor_can_access_patient(auth.uid(), patient_id)
  );

DROP POLICY IF EXISTS "Patient or authorized doctor inserts medical records" ON public.patient_health_records;
CREATE POLICY "Patient or authorized doctor inserts medical records"
  ON public.patient_health_records FOR INSERT
  TO authenticated
  WITH CHECK (
    patient_id = auth.uid()
    OR public.doctor_can_access_patient(auth.uid(), patient_id)
  );

DROP POLICY IF EXISTS "Patient or recording authorized doctor updates medical records" ON public.patient_health_records;
CREATE POLICY "Patient or recording authorized doctor updates medical records"
  ON public.patient_health_records FOR UPDATE
  TO authenticated
  USING (
    patient_id = auth.uid()
    OR (
      public.doctor_can_access_patient(auth.uid(), patient_id)
      AND recorded_by_doctor_id IN (SELECT id FROM public.doctor_profiles WHERE user_id = auth.uid())
    )
  )
  WITH CHECK (
    patient_id = auth.uid()
    OR public.doctor_can_access_patient(auth.uid(), patient_id)
  );

-- 7. patient_allergies
DROP POLICY IF EXISTS "Patient or authorized doctor reads allergies" ON public.patient_allergies;
CREATE POLICY "Patient or authorized doctor reads allergies"
  ON public.patient_allergies FOR SELECT
  TO authenticated
  USING (
    patient_id = auth.uid()
    OR public.doctor_can_access_patient(auth.uid(), patient_id)
  );

DROP POLICY IF EXISTS "Patient manages own allergies" ON public.patient_allergies;
CREATE POLICY "Patient manages own allergies"
  ON public.patient_allergies FOR ALL
  TO authenticated
  USING (patient_id = auth.uid())
  WITH CHECK (patient_id = auth.uid());

-- 8. diagnostic_reports
DROP POLICY IF EXISTS "Patient or authorized doctor reads diagnostic reports" ON public.diagnostic_reports;
CREATE POLICY "Patient or authorized doctor reads diagnostic reports"
  ON public.diagnostic_reports FOR SELECT
  TO authenticated
  USING (
    patient_id = auth.uid()
    OR public.doctor_can_access_patient(auth.uid(), patient_id)
  );

DROP POLICY IF EXISTS "Patient or authorized doctor inserts diagnostic reports" ON public.diagnostic_reports;
CREATE POLICY "Patient or authorized doctor inserts diagnostic reports"
  ON public.diagnostic_reports FOR INSERT
  TO authenticated
  WITH CHECK (
    patient_id = auth.uid()
    OR public.doctor_can_access_patient(auth.uid(), patient_id)
  );

DROP POLICY IF EXISTS "Patient or uploader updates diagnostic reports" ON public.diagnostic_reports;
CREATE POLICY "Patient or uploader updates diagnostic reports"
  ON public.diagnostic_reports FOR UPDATE
  TO authenticated
  USING (
    patient_id = auth.uid()
    OR (uploaded_by = auth.uid() AND public.doctor_can_access_patient(auth.uid(), patient_id))
  )
  WITH CHECK (
    patient_id = auth.uid()
    OR (uploaded_by = auth.uid() AND public.doctor_can_access_patient(auth.uid(), patient_id))
  );

-- 9. appointments
DROP POLICY IF EXISTS "Patient or assigned doctor views appointments" ON public.appointments;
CREATE POLICY "Patient or assigned doctor views appointments"
  ON public.appointments FOR SELECT
  TO authenticated
  USING (
    patient_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.doctor_profiles dp
      WHERE dp.id = doctor_id AND dp.user_id = auth.uid() AND dp.verification_status = 'Approved'
    )
  );

DROP POLICY IF EXISTS "Patient creates own appointment" ON public.appointments;
CREATE POLICY "Patient creates own appointment"
  ON public.appointments FOR INSERT
  TO authenticated
  WITH CHECK (patient_id = auth.uid() AND status = 'Pending' AND public.is_patient_account(auth.uid()));

DROP POLICY IF EXISTS "Patient or assigned doctor updates appointment" ON public.appointments;
CREATE POLICY "Patient or assigned doctor updates appointment"
  ON public.appointments FOR UPDATE
  TO authenticated
  USING (
    patient_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.doctor_profiles dp
      WHERE dp.id = doctor_id AND dp.user_id = auth.uid() AND dp.verification_status = 'Approved'
    )
  )
  WITH CHECK (
    patient_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.doctor_profiles dp
      WHERE dp.id = doctor_id AND dp.user_id = auth.uid() AND dp.verification_status = 'Approved'
    )
  );

-- 10–11. doctor_patient_connections & consultation_messages
DROP POLICY IF EXISTS "Participants view connections" ON public.doctor_patient_connections;
CREATE POLICY "Participants view connections"
  ON public.doctor_patient_connections FOR SELECT
  TO authenticated
  USING (
    patient_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.doctor_profiles dp
      WHERE dp.id = doctor_id AND dp.user_id = auth.uid() AND dp.verification_status = 'Approved'
    )
  );

DROP POLICY IF EXISTS "Patient creates connection request" ON public.doctor_patient_connections;
CREATE POLICY "Patient creates connection request"
  ON public.doctor_patient_connections FOR INSERT
  TO authenticated
  WITH CHECK (
    patient_id = auth.uid()
    AND public.is_patient_account(auth.uid())
    AND status = 'Pending'
    AND EXISTS (
      SELECT 1 FROM public.doctor_profiles dp
      WHERE dp.id = doctor_id AND dp.verification_status = 'Approved' AND dp.is_active = true
    )
  );

DROP POLICY IF EXISTS "Participants update connection status" ON public.doctor_patient_connections;
CREATE POLICY "Participants update connection status"
  ON public.doctor_patient_connections FOR UPDATE
  TO authenticated
  USING (
    patient_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.doctor_profiles dp
      WHERE dp.id = doctor_id AND dp.user_id = auth.uid() AND dp.verification_status = 'Approved'
    )
  )
  WITH CHECK (
    patient_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.doctor_profiles dp
      WHERE dp.id = doctor_id AND dp.user_id = auth.uid() AND dp.verification_status = 'Approved'
    )
  );

DROP POLICY IF EXISTS "Connection participants read messages" ON public.consultation_messages;
CREATE POLICY "Connection participants read messages"
  ON public.consultation_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.doctor_patient_connections c
      LEFT JOIN public.doctor_profiles dp ON dp.id = c.doctor_id
      WHERE c.id = connection_id
        AND (
          c.patient_id = auth.uid()
          OR (dp.user_id = auth.uid() AND dp.verification_status = 'Approved')
        )
    )
  );

DROP POLICY IF EXISTS "Connection participants send messages" ON public.consultation_messages;
CREATE POLICY "Connection participants send messages"
  ON public.consultation_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.doctor_patient_connections c
      LEFT JOIN public.doctor_profiles dp ON dp.id = c.doctor_id
      WHERE c.id = connection_id
        AND c.status IN ('Pending', 'Accepted')
        AND (
          (sender_role = 'patient' AND c.patient_id = auth.uid())
          OR (sender_role = 'doctor' AND dp.user_id = auth.uid() AND dp.verification_status = 'Approved')
        )
    )
  );

-- 12–16. Healthcare Services Directory Policies
DROP POLICY IF EXISTS "Authenticated read healthcare_services" ON public.healthcare_services;
CREATE POLICY "Authenticated read healthcare_services"
  ON public.healthcare_services FOR SELECT
  TO authenticated USING (is_active = true OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins manage healthcare_services" ON public.healthcare_services;
CREATE POLICY "Admins manage healthcare_services"
  ON public.healthcare_services FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated read hospitals" ON public.hospitals;
CREATE POLICY "Authenticated read hospitals"
  ON public.hospitals FOR SELECT
  TO authenticated USING (is_active = true OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins manage hospitals" ON public.hospitals;
CREATE POLICY "Admins manage hospitals"
  ON public.hospitals FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated read pharmacies" ON public.pharmacies;
CREATE POLICY "Authenticated read pharmacies"
  ON public.pharmacies FOR SELECT
  TO authenticated USING (is_active = true OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins manage pharmacies" ON public.pharmacies;
CREATE POLICY "Admins manage pharmacies"
  ON public.pharmacies FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated read laboratories" ON public.laboratories;
CREATE POLICY "Authenticated read laboratories"
  ON public.laboratories FOR SELECT
  TO authenticated USING (is_active = true OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins manage laboratories" ON public.laboratories;
CREATE POLICY "Admins manage laboratories"
  ON public.laboratories FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated read health_camps" ON public.health_camps;
CREATE POLICY "Authenticated read health_camps"
  ON public.health_camps FOR SELECT
  TO authenticated USING (is_active = true OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins manage health_camps" ON public.health_camps;
CREATE POLICY "Admins manage health_camps"
  ON public.health_camps FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- 17. emergency_alerts
DROP POLICY IF EXISTS "Patient or verified doctor views emergency alerts" ON public.emergency_alerts;
CREATE POLICY "Patient or verified doctor views emergency alerts"
  ON public.emergency_alerts FOR SELECT
  TO authenticated
  USING (
    patient_id = auth.uid()
    OR public.is_verified_doctor(auth.uid())
    OR public.is_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Patient creates own emergency alert" ON public.emergency_alerts;
CREATE POLICY "Patient creates own emergency alert"
  ON public.emergency_alerts FOR INSERT
  TO authenticated
  WITH CHECK (patient_id = auth.uid() AND emergency_status = 'Logged' AND public.is_patient_account(auth.uid()));

DROP POLICY IF EXISTS "Verified doctor updates emergency status" ON public.emergency_alerts;
CREATE POLICY "Verified doctor updates emergency status"
  ON public.emergency_alerts FOR UPDATE
  TO authenticated
  USING (public.is_verified_doctor(auth.uid()) OR public.is_admin(auth.uid()))
  WITH CHECK (public.is_verified_doctor(auth.uid()) OR public.is_admin(auth.uid()));

-- 18. notifications
DROP POLICY IF EXISTS "Users read own notifications" ON public.notifications;
CREATE POLICY "Users read own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;
CREATE POLICY "Users update own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users delete own notifications" ON public.notifications;
CREATE POLICY "Users delete own notifications"
  ON public.notifications FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Authenticated users insert own or authorized notifications" ON public.notifications;
CREATE POLICY "Authenticated users insert own or authorized notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR public.is_verified_doctor(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.doctor_profiles dp
      WHERE dp.user_id = notifications.user_id AND dp.verification_status = 'Approved'
    )
  );

-- =============================================================================
-- Private Storage Buckets & Policies
-- =============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('patient-avatars', 'patient-avatars', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('diagnostic-reports', 'diagnostic-reports', false, 10485760, ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Patient avatars read policy" ON storage.objects;
CREATE POLICY "Patient avatars read policy"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'patient-avatars'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR (
        (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND public.doctor_can_access_patient(auth.uid(), ((storage.foldername(name))[1])::uuid)
      )
    )
  );

DROP POLICY IF EXISTS "Patient avatars write policy" ON storage.objects;
CREATE POLICY "Patient avatars write policy"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'patient-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Patient avatars update policy" ON storage.objects;
CREATE POLICY "Patient avatars update policy"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'patient-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Patient avatars delete policy" ON storage.objects;
CREATE POLICY "Patient avatars delete policy"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'patient-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Diagnostic reports read policy" ON storage.objects;
CREATE POLICY "Diagnostic reports read policy"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'diagnostic-reports'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR (
        (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND public.doctor_can_access_patient(auth.uid(), ((storage.foldername(name))[1])::uuid)
      )
    )
  );

DROP POLICY IF EXISTS "Diagnostic reports upload policy" ON storage.objects;
CREATE POLICY "Diagnostic reports upload policy"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'diagnostic-reports'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR (
        (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND public.doctor_can_access_patient(auth.uid(), ((storage.foldername(name))[1])::uuid)
      )
    )
  );

DROP POLICY IF EXISTS "Diagnostic reports delete policy" ON storage.objects;
CREATE POLICY "Diagnostic reports delete policy"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'diagnostic-reports'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- =============================================================================
-- Realtime Publication Additions (Idempotent)
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'appointments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'doctor_patient_connections'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.doctor_patient_connections;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'consultation_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.consultation_messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'emergency_alerts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.emergency_alerts;
  END IF;
END $$;

-- =============================================================================
-- Seed Healthcare Services & Directory Tables (only when empty)
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

-- Reload PostgREST schema cache so new tables & FKs are immediately exposed
NOTIFY pgrst, 'reload schema';
