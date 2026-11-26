-- =============================================================================
-- RuralCare / SmartCare – Idempotent Patient Registration & Profiles Migration (004)
-- Safely upgrades an existing partial `public.profiles` table by adding any
-- missing columns (`role`, `health_id`, `age`, `village`, `district`, `state`,
-- `full_address`, `pin_code`, `blood_group`, `emergency_contact_name`,
-- `emergency_contact_number`, `avatar_path`, `updated_at`), ensures supporting
-- registration tables/triggers/RLS policies exist, and reloads PostgREST cache.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- 1. Utility trigger function for updated_at
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
-- 2. Ensure public.profiles exists and has ALL required columns
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

-- Add any missing columns on pre-existing `public.profiles` tables
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

-- Backfill NULL health_id or role values on any legacy rows before adding constraints/indexes
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
      IF COALESCE(auth.role(), '') NOT IN ('service_role', 'supabase_admin', 'postgres') THEN
        RAISE EXCEPTION 'Unauthorized: role cannot be changed by user';
      END IF;
    END IF;
    IF NEW.health_id IS DISTINCT FROM OLD.health_id AND OLD.health_id IS NOT NULL AND TRIM(OLD.health_id) <> '' THEN
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
-- 3. Ensure companion tables used during registration & auth exist
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

-- -----------------------------------------------------------------------------
-- 4. Auth signup trigger: safely creates profiles + health_cards on auth.users insert
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 5. Mobile lookup helper for patient login
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 6. Minimum RLS Policies for Registration & Self-Service Profile Access
-- (If you also run 002_rls_and_storage.sql, it safely replaces these with full
--  doctor-patient authorization and storage policies.)
-- -----------------------------------------------------------------------------
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

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_registration_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
CREATE POLICY "Users view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users insert own profile as patient" ON public.profiles;
CREATE POLICY "Users insert own profile as patient"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id AND role = 'patient');

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Patient or authorized doctor reads health card" ON public.health_cards;
CREATE POLICY "Patient or authorized doctor reads health card"
  ON public.health_cards FOR SELECT
  TO authenticated
  USING (patient_id = auth.uid());

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

DROP POLICY IF EXISTS "Approved active doctors visible to authenticated users; own visible to self" ON public.doctor_profiles;
CREATE POLICY "Approved active doctors visible to authenticated users; own visible to self"
  ON public.doctor_profiles FOR SELECT
  TO authenticated
  USING ((verification_status = 'Approved' AND is_active = true) OR user_id = auth.uid());

DROP POLICY IF EXISTS "Doctors create own pending profile" ON public.doctor_profiles;
CREATE POLICY "Doctors create own pending profile"
  ON public.doctor_profiles FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND verification_status = 'Pending Verification' AND is_active = false);

DROP POLICY IF EXISTS "Users view own doctor registration request" ON public.doctor_registration_requests;
CREATE POLICY "Users view own doctor registration request"
  ON public.doctor_registration_requests FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users submit own pending doctor registration request" ON public.doctor_registration_requests;
CREATE POLICY "Users submit own pending doctor registration request"
  ON public.doctor_registration_requests FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'Pending Verification');

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

-- Refresh PostgREST schema cache immediately
NOTIFY pgrst, 'reload schema';
