-- =============================================================================
-- RuralCare – Row Level Security (RLS), Private Storage Buckets & Realtime (002)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Security Helper Functions (used inside RLS policies)
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- Enable Row Level Security on ALL 17+ tables
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 1. profiles Policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
CREATE POLICY "Users view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id
    OR public.doctor_can_access_patient(auth.uid(), id)
  );

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

-- -----------------------------------------------------------------------------
-- 2. doctor_profiles Policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Approved active doctors visible to authenticated users; own visible to self" ON public.doctor_profiles;
CREATE POLICY "Approved active doctors visible to authenticated users; own visible to self"
  ON public.doctor_profiles FOR SELECT
  TO authenticated
  USING (
    (verification_status = 'Approved' AND is_active = true)
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Doctors create own pending profile" ON public.doctor_profiles;
CREATE POLICY "Doctors create own pending profile"
  ON public.doctor_profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND verification_status = 'Pending Verification'
    AND is_active = false
  );

DROP POLICY IF EXISTS "Verified doctors update own profile fields" ON public.doctor_profiles;
CREATE POLICY "Verified doctors update own profile fields"
  ON public.doctor_profiles FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND verification_status = 'Approved')
  WITH CHECK (user_id = auth.uid() AND verification_status = 'Approved');

-- -----------------------------------------------------------------------------
-- 3. doctor_registration_requests Policies
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 4. doctor_availability Policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users read approved doctor availability" ON public.doctor_availability;
CREATE POLICY "Authenticated users read approved doctor availability"
  ON public.doctor_availability FOR SELECT
  TO authenticated
  USING (
    EXISTS (
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
    EXISTS (
      SELECT 1 FROM public.doctor_profiles dp
      WHERE dp.id = doctor_id AND dp.user_id = auth.uid() AND dp.verification_status = 'Approved'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.doctor_profiles dp
      WHERE dp.id = doctor_id AND dp.user_id = auth.uid() AND dp.verification_status = 'Approved'
    )
  );

-- -----------------------------------------------------------------------------
-- 5. health_cards Policies
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 6. patient_health_records Policies
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 7. patient_allergies Policies
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 8. diagnostic_reports Policies
-- -----------------------------------------------------------------------------
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
  );

-- -----------------------------------------------------------------------------
-- 9. appointments Policies
-- -----------------------------------------------------------------------------
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
  );

-- -----------------------------------------------------------------------------
-- 10. doctor_patient_connections & consultation_messages Policies
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 11–15. Healthcare Services Directory Policies (read-only for authenticated; admin writes)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated read healthcare_services" ON public.healthcare_services;
CREATE POLICY "Authenticated read healthcare_services"
  ON public.healthcare_services FOR SELECT
  TO authenticated USING (is_active = true);

DROP POLICY IF EXISTS "Authenticated read hospitals" ON public.hospitals;
CREATE POLICY "Authenticated read hospitals"
  ON public.hospitals FOR SELECT
  TO authenticated USING (is_active = true);

DROP POLICY IF EXISTS "Authenticated read pharmacies" ON public.pharmacies;
CREATE POLICY "Authenticated read pharmacies"
  ON public.pharmacies FOR SELECT
  TO authenticated USING (is_active = true);

DROP POLICY IF EXISTS "Authenticated read laboratories" ON public.laboratories;
CREATE POLICY "Authenticated read laboratories"
  ON public.laboratories FOR SELECT
  TO authenticated USING (is_active = true);

DROP POLICY IF EXISTS "Authenticated read health_camps" ON public.health_camps;
CREATE POLICY "Authenticated read health_camps"
  ON public.health_camps FOR SELECT
  TO authenticated USING (is_active = true);

-- -----------------------------------------------------------------------------
-- 16. emergency_alerts Policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Patient or verified doctor views emergency alerts" ON public.emergency_alerts;
CREATE POLICY "Patient or verified doctor views emergency alerts"
  ON public.emergency_alerts FOR SELECT
  TO authenticated
  USING (
    patient_id = auth.uid()
    OR public.is_verified_doctor(auth.uid())
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
  USING (public.is_verified_doctor(auth.uid()))
  WITH CHECK (public.is_verified_doctor(auth.uid()));

-- -----------------------------------------------------------------------------
-- 17. notifications Policies
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- Private Supabase Storage Buckets & Policies (NO public access to medical files)
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('patient-avatars', 'patient-avatars', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('diagnostic-reports', 'diagnostic-reports', false, 10485760, ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = false;

-- Patient avatars: owner or authorized doctor can read; owner can upload/update/delete under {uid}/...
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

-- Diagnostic reports: strictly private; owner or authorized doctor (appointment/connection) can read; owner or authorized doctor can upload under {patient_uid}/...
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

-- -----------------------------------------------------------------------------
-- Enable Supabase Realtime on live tables
-- -----------------------------------------------------------------------------
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
