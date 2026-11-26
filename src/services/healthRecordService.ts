import { requireSupabase } from '../lib/supabaseClient';
import {
  logSupabaseError,
  mapDiagnosticReportRow,
  mapMedicalRecordRow,
} from '../utils/supabaseMappers';
import type {
  AllergyItem,
  DiagnosticReportItem,
  MedicalRecordItem,
} from '../types/ruralcare';

export interface PatientHealthBundle {
  healthId: string | null;
  qrPayload: string | null;
  allergies: AllergyItem[];
  medicalRecords: MedicalRecordItem[];
  diagnosticReports: DiagnosticReportItem[];
}

export interface PatientHealthBundleResult {
  bundle: PatientHealthBundle;
  errors: string[];
}

export async function fetchPatientHealthBundleResilient(
  patientId: string
): Promise<PatientHealthBundleResult> {
  const supabase = requireSupabase();
  const errors: string[] = [];

  const [cardRes, allergiesRes, recordsRes, reportsRes] = await Promise.allSettled([
    supabase
      .from('health_cards')
      .select('health_id, qr_payload')
      .eq('patient_id', patientId)
      .maybeSingle(),
    supabase
      .from('patient_allergies')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false }),
    supabase
      .from('patient_health_records')
      .select('*')
      .eq('patient_id', patientId)
      .order('record_date', { ascending: false }),
    supabase
      .from('diagnostic_reports')
      .select('*')
      .eq('patient_id', patientId)
      .order('test_date', { ascending: false }),
  ]);

  let healthId: string | null = null;
  let qrPayload: string | null = null;
  if (cardRes.status === 'fulfilled') {
    if (cardRes.value.error) {
      errors.push(logSupabaseError('Load health_cards', cardRes.value.error, 'health_cards'));
    } else {
      healthId = cardRes.value.data?.health_id ? String(cardRes.value.data.health_id) : null;
      qrPayload = cardRes.value.data?.qr_payload ? String(cardRes.value.data.qr_payload) : null;
    }
  } else {
    errors.push(logSupabaseError('Load health_cards', cardRes.reason, 'health_cards'));
  }

  let allergies: AllergyItem[] = [];
  if (allergiesRes.status === 'fulfilled') {
    if (allergiesRes.value.error) {
      errors.push(
        logSupabaseError('Load patient_allergies', allergiesRes.value.error, 'patient_allergies')
      );
    } else {
      allergies = (allergiesRes.value.data ?? []).map((row) => ({
        id: String(row.id),
        name: String(row.allergy_name),
        category: row.category === 'Chronic Condition' ? 'Chronic Condition' : 'Allergy',
        severity: (row.severity as AllergyItem['severity']) ?? 'Moderate',
        notes: row.notes ? String(row.notes) : undefined,
      }));
    }
  } else {
    errors.push(
      logSupabaseError('Load patient_allergies', allergiesRes.reason, 'patient_allergies')
    );
  }

  let medicalRecords: MedicalRecordItem[] = [];
  if (recordsRes.status === 'fulfilled') {
    if (recordsRes.value.error) {
      errors.push(
        logSupabaseError(
          'Load patient_health_records',
          recordsRes.value.error,
          'patient_health_records'
        )
      );
    } else {
      medicalRecords = (recordsRes.value.data ?? []).map(mapMedicalRecordRow);
    }
  } else {
    errors.push(
      logSupabaseError('Load patient_health_records', recordsRes.reason, 'patient_health_records')
    );
  }

  let diagnosticReports: DiagnosticReportItem[] = [];
  if (reportsRes.status === 'fulfilled') {
    if (reportsRes.value.error) {
      errors.push(
        logSupabaseError(
          'Load diagnostic_reports',
          reportsRes.value.error,
          'diagnostic_reports'
        )
      );
    } else {
      diagnosticReports = (reportsRes.value.data ?? []).map(mapDiagnosticReportRow);
    }
  } else {
    errors.push(
      logSupabaseError('Load diagnostic_reports', reportsRes.reason, 'diagnostic_reports')
    );
  }

  return {
    bundle: {
      healthId,
      qrPayload,
      allergies,
      medicalRecords,
      diagnosticReports,
    },
    errors,
  };
}

export async function fetchPatientHealthBundle(
  patientId: string
): Promise<PatientHealthBundle> {
  const { bundle } = await fetchPatientHealthBundleResilient(patientId);
  return bundle;
}

export async function addPatientMedicalRecord(input: {
  patientId: string;
  recordedByDoctorId?: string | null;
  recordDate: string;
  title: string;
  doctorName: string;
  facilityName: string;
  summary: string;
  recordType?: string;
}): Promise<MedicalRecordItem> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('patient_health_records')
    .insert({
      patient_id: input.patientId,
      recorded_by_doctor_id: input.recordedByDoctorId ?? null,
      record_date: input.recordDate,
      title: input.title.trim(),
      doctor_name: input.doctorName.trim(),
      facility_name: input.facilityName.trim(),
      summary: input.summary.trim(),
      record_type: input.recordType ?? 'Medical Record',
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(
      logSupabaseError('Insert patient_health_records', error, 'patient_health_records')
    );
  }

  return mapMedicalRecordRow(data);
}

export async function updatePatientMedicalRecord(
  recordId: string,
  updates: {
    title?: string;
    summary?: string;
    facilityName?: string;
  }
): Promise<MedicalRecordItem> {
  const supabase = requireSupabase();
  const payload: Record<string, unknown> = {};
  if (updates.title !== undefined) payload.title = updates.title.trim();
  if (updates.summary !== undefined) payload.summary = updates.summary.trim();
  if (updates.facilityName !== undefined) payload.facility_name = updates.facilityName.trim();

  const { data, error } = await supabase
    .from('patient_health_records')
    .update(payload)
    .eq('id', recordId)
    .select('*')
    .single();

  if (error) {
    throw new Error(
      logSupabaseError('Update patient_health_records', error, 'patient_health_records')
    );
  }

  return mapMedicalRecordRow(data);
}

export async function addPatientAllergy(input: {
  patientId: string;
  name: string;
  category: 'Allergy' | 'Chronic Condition';
  severity: 'Mild' | 'Moderate' | 'Severe';
  notes?: string;
}): Promise<AllergyItem> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('patient_allergies')
    .insert({
      patient_id: input.patientId,
      allergy_name: input.name.trim(),
      category: input.category,
      severity: input.severity,
      notes: input.notes?.trim() || null,
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(logSupabaseError('Insert patient_allergies', error, 'patient_allergies'));
  }

  return {
    id: String(data.id),
    name: String(data.allergy_name),
    category: data.category === 'Chronic Condition' ? 'Chronic Condition' : 'Allergy',
    severity: (data.severity as AllergyItem['severity']) ?? 'Moderate',
    notes: data.notes ? String(data.notes) : undefined,
  };
}

export async function deletePatientAllergy(allergyId: string): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.from('patient_allergies').delete().eq('id', allergyId);
  if (error) {
    throw new Error(logSupabaseError('Delete patient_allergies', error, 'patient_allergies'));
  }
}

export async function uploadDiagnosticReport(input: {
  patientId: string;
  uploadedBy: string;
  laboratoryName: string;
  testName: string;
  testDate: string;
  reportDate?: string;
  reportStatus?: 'Pending' | 'Processing' | 'Ready' | 'Reviewed';
  notes?: string;
  file?: File | null;
}): Promise<DiagnosticReportItem> {
  const supabase = requireSupabase();
  let filePath: string | null = null;
  let fileName: string | null = null;

  if (input.file) {
    const safeName = input.file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    filePath = `${input.patientId}/${Date.now()}-${safeName}`;
    fileName = input.file.name;

    const { error: uploadErr } = await supabase.storage
      .from('diagnostic-reports')
      .upload(filePath, input.file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadErr) {
      throw new Error(
        logSupabaseError('Upload diagnostic report file', uploadErr, 'storage.objects')
      );
    }
  }

  const { data, error } = await supabase
    .from('diagnostic_reports')
    .insert({
      patient_id: input.patientId,
      uploaded_by: input.uploadedBy,
      laboratory_name: input.laboratoryName.trim(),
      test_name: input.testName.trim(),
      test_date: input.testDate,
      report_date: input.reportDate || input.testDate,
      report_file_path: filePath,
      file_name: fileName,
      report_status: input.reportStatus ?? 'Ready',
      notes: input.notes?.trim() || null,
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(logSupabaseError('Insert diagnostic_reports', error, 'diagnostic_reports'));
  }

  return mapDiagnosticReportRow(data);
}

export async function getDiagnosticReportSignedUrl(filePath: string): Promise<string> {
  const supabase = requireSupabase();
  const { data, error } = await supabase.storage
    .from('diagnostic-reports')
    .createSignedUrl(filePath, 120);

  if (error || !data?.signedUrl) {
    throw new Error(
      logSupabaseError(
        'Sign diagnostic report URL',
        error ?? new Error('Unable to generate authorized report download link'),
        'storage.objects'
      )
    );
  }

  return data.signedUrl;
}
