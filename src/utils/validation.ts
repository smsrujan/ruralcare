export interface RegistrationFormInput {
  fullName: string;
  dateOfBirth: string;
  gender: string;
  mobileNumber: string;
  email: string;
  password: string;
  confirmPassword: string;
  village: string;
  district: string;
  state: string;
  fullAddress: string;
  pinCode: string;
  bloodGroup: string;
  emergencyContactName: string;
  emergencyContactNumber: string;
}

export type ValidationTranslator = (key: string) => string;

const DEFAULT_MESSAGES: Record<string, string> = {
  'validation.enterIdentifier': 'Please enter your registered email address or 10-digit mobile number.',
  'validation.invalidEmail': 'Please enter a valid email address (for example, name@ruralcare.in).',
  'validation.invalidIdentifier': 'Please enter a valid 10-digit mobile number or a valid email address.',
  'validation.passwordRequired': 'Password is required.',
  'validation.passwordMin': 'Password must be at least 8 characters long.',
  'validation.passwordUpper': 'Password must include at least one uppercase letter.',
  'validation.passwordLower': 'Password must include at least one lowercase letter.',
  'validation.passwordDigit': 'Password must include at least one number.',
  'validation.passwordSpecial': 'Password must include at least one special character (such as @, #, !).',
  'validation.fullNameInvalid': 'Please enter your full name (at least 2 characters).',
  'validation.dobRequired': 'Please select your date of birth.',
  'validation.dobInvalid': 'Please enter a valid date of birth (cannot be in the future).',
  'validation.genderRequired': 'Please select your gender.',
  'validation.mobileRequired': 'Please enter your mobile number.',
  'validation.mobileInvalid': 'Enter a valid 10-digit mobile number starting with 6–9.',
  'validation.emailRequired': 'Email address is required.',
  'validation.confirmPasswordRequired': 'Please confirm your password.',
  'validation.passwordsMismatch': 'Passwords do not match.',
  'validation.villageRequired': 'Village name is required.',
  'validation.districtRequired': 'District name is required.',
  'validation.stateRequired': 'State name is required.',
  'validation.addressRequired': 'Please enter your house/street or landmark address.',
  'validation.pinRequired': 'PIN code is required.',
  'validation.pinInvalid': 'Enter a valid 6-digit PIN code.',
  'validation.bloodGroupRequired': 'Please select your blood group.',
  'validation.emergencyNameRequired': 'Emergency contact name is required.',
  'validation.emergencyPhoneRequired': 'Emergency contact number is required.',
  'validation.emergencyPhoneInvalid': 'Enter a valid 10-digit emergency contact number.',
  'validation.ageInvalid': 'Age must be between 0 and 125.',
};

const defaultTranslate: ValidationTranslator = (key) => DEFAULT_MESSAGES[key] ?? key;

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const MOBILE_REGEX = /^[6-9]\d{9}$/;
export const PIN_CODE_REGEX = /^[1-9]\d{5}$/;

export function validateEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

export function normalizeMobile(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }
  return digits;
}

export function calculateAgeFromDob(dobString: string, referenceDate: Date = new Date()): number | null {
  if (!dobString) return null;
  const parsed = new Date(`${dobString}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  if (parsed > referenceDate) return null;

  let age = referenceDate.getFullYear() - parsed.getFullYear();
  const monthDiff = referenceDate.getMonth() - parsed.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && referenceDate.getDate() < parsed.getDate())) {
    age -= 1;
  }
  if (age < 0 || age > 125) return null;
  return age;
}

export function validateLoginIdentifier(
  rawValue: string,
  t: ValidationTranslator = defaultTranslate
): string | null {
  const value = rawValue.trim();
  if (!value) {
    return t('validation.enterIdentifier');
  }
  if (value.includes('@')) {
    if (!EMAIL_REGEX.test(value)) {
      return t('validation.invalidEmail');
    }
    return null;
  }
  const normalized = normalizeMobile(value);
  if (!MOBILE_REGEX.test(normalized)) {
    return t('validation.invalidIdentifier');
  }
  return null;
}

export function validatePasswordStrength(
  password: string,
  t: ValidationTranslator = defaultTranslate
): string | null {
  if (!password) {
    return t('validation.passwordRequired');
  }
  if (password.length < 8) {
    return t('validation.passwordMin');
  }
  if (!/[A-Z]/.test(password)) {
    return t('validation.passwordUpper');
  }
  if (!/[a-z]/.test(password)) {
    return t('validation.passwordLower');
  }
  if (!/\d/.test(password)) {
    return t('validation.passwordDigit');
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return t('validation.passwordSpecial');
  }
  return null;
}

export function validateRegistrationForm(
  form: RegistrationFormInput,
  referenceDate: Date = new Date(),
  t: ValidationTranslator = defaultTranslate
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!form.fullName.trim() || form.fullName.trim().length < 2) {
    errors.fullName = t('validation.fullNameInvalid');
  }

  const age = calculateAgeFromDob(form.dateOfBirth, referenceDate);
  if (!form.dateOfBirth) {
    errors.dateOfBirth = t('validation.dobRequired');
  } else if (age === null) {
    errors.dateOfBirth = t('validation.dobInvalid');
  }

  if (!form.gender) {
    errors.gender = t('validation.genderRequired');
  }

  const normalizedMobile = normalizeMobile(form.mobileNumber);
  if (!form.mobileNumber.trim()) {
    errors.mobileNumber = t('validation.mobileRequired');
  } else if (!MOBILE_REGEX.test(normalizedMobile)) {
    errors.mobileNumber = t('validation.mobileInvalid');
  }

  if (!form.email.trim()) {
    errors.email = t('validation.emailRequired');
  } else if (!EMAIL_REGEX.test(form.email.trim())) {
    errors.email = t('validation.invalidEmail');
  }

  const passwordError = validatePasswordStrength(form.password, t);
  if (passwordError) {
    errors.password = passwordError;
  }

  if (!form.confirmPassword) {
    errors.confirmPassword = t('validation.confirmPasswordRequired');
  } else if (form.confirmPassword !== form.password) {
    errors.confirmPassword = t('validation.passwordsMismatch');
  }

  if (!form.village.trim()) {
    errors.village = t('validation.villageRequired');
  }

  if (!form.district.trim()) {
    errors.district = t('validation.districtRequired');
  }

  if (!form.state.trim()) {
    errors.state = t('validation.stateRequired');
  }

  if (!form.fullAddress.trim() || form.fullAddress.trim().length < 5) {
    errors.fullAddress = t('validation.addressRequired');
  }

  if (!form.pinCode.trim()) {
    errors.pinCode = t('validation.pinRequired');
  } else if (!PIN_CODE_REGEX.test(form.pinCode.trim())) {
    errors.pinCode = t('validation.pinInvalid');
  }

  if (!form.bloodGroup) {
    errors.bloodGroup = t('validation.bloodGroupRequired');
  }

  if (!form.emergencyContactName.trim()) {
    errors.emergencyContactName = t('validation.emergencyNameRequired');
  }

  const normalizedEmergency = normalizeMobile(form.emergencyContactNumber);
  if (!form.emergencyContactNumber.trim()) {
    errors.emergencyContactNumber = t('validation.emergencyPhoneRequired');
  } else if (!MOBILE_REGEX.test(normalizedEmergency)) {
    errors.emergencyContactNumber = t('validation.emergencyPhoneInvalid');
  }

  return errors;
}

export function validateProfileEdit(
  profile: {
    fullName: string;
    age: number;
    gender: string;
    mobileNumber: string;
    village: string;
    district: string;
    address: string;
    bloodGroup: string;
    emergencyContactName: string;
    emergencyContactNumber: string;
  },
  t: ValidationTranslator = defaultTranslate
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!profile.fullName.trim()) errors.fullName = t('validation.fullNameInvalid');
  if (!Number.isFinite(profile.age) || profile.age < 0 || profile.age > 125) {
    errors.age = t('validation.ageInvalid');
  }
  if (!profile.gender) errors.gender = t('validation.genderRequired');
  if (!MOBILE_REGEX.test(normalizeMobile(profile.mobileNumber))) {
    errors.mobileNumber = t('validation.mobileInvalid');
  }
  if (!profile.village.trim()) errors.village = t('validation.villageRequired');
  if (!profile.district.trim()) errors.district = t('validation.districtRequired');
  if (!profile.address.trim()) errors.address = t('validation.addressRequired');
  if (!profile.bloodGroup) errors.bloodGroup = t('validation.bloodGroupRequired');
  if (!profile.emergencyContactName.trim()) {
    errors.emergencyContactName = t('validation.emergencyNameRequired');
  }
  if (!MOBILE_REGEX.test(normalizeMobile(profile.emergencyContactNumber))) {
    errors.emergencyContactNumber = t('validation.emergencyPhoneInvalid');
  }
  return errors;
}

export interface DoctorRegistrationFormInput {
  fullName: string;
  email: string;
  mobileNumber: string;
  medicalRegistrationNumber: string;
  qualification: string;
  specialization: string;
  experienceYears: string;
  hospitalName: string;
  hospitalAddress: string;
  district: string;
  password: string;
  confirmPassword: string;
}

export function validateDoctorRegistrationForm(
  form: DoctorRegistrationFormInput,
  t: ValidationTranslator = defaultTranslate
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!form.fullName.trim() || form.fullName.trim().length < 2) {
    errors.fullName = t('validation.fullNameInvalid');
  }

  if (!form.email.trim()) {
    errors.email = t('validation.emailRequired');
  } else if (!EMAIL_REGEX.test(form.email.trim())) {
    errors.email = t('validation.invalidEmail');
  }

  const normalizedMobile = normalizeMobile(form.mobileNumber);
  if (!form.mobileNumber.trim()) {
    errors.mobileNumber = t('validation.mobileRequired');
  } else if (!MOBILE_REGEX.test(normalizedMobile)) {
    errors.mobileNumber = t('validation.mobileInvalid');
  }

  if (!form.medicalRegistrationNumber.trim() || form.medicalRegistrationNumber.trim().length < 4) {
    errors.medicalRegistrationNumber = t('doctorRegister.regNumberRequired');
  }

  if (!form.qualification.trim()) {
    errors.qualification = t('doctorRegister.qualificationRequired');
  }

  if (!form.specialization.trim()) {
    errors.specialization = t('doctorRegister.specializationRequired');
  }

  const exp = Number(form.experienceYears);
  if (form.experienceYears.trim() === '' || !Number.isFinite(exp) || exp < 0 || exp > 80) {
    errors.experienceYears = t('doctorRegister.experienceRequired');
  }

  if (!form.hospitalName.trim()) {
    errors.hospitalName = t('doctorRegister.hospitalRequired');
  }

  if (!form.hospitalAddress.trim()) {
    errors.hospitalAddress = t('doctorRegister.hospitalAddressRequired');
  }

  if (!form.district.trim()) {
    errors.district = t('validation.districtRequired');
  }

  const passwordError = validatePasswordStrength(form.password, t);
  if (passwordError) {
    errors.password = passwordError;
  }

  if (!form.confirmPassword) {
    errors.confirmPassword = t('validation.confirmPasswordRequired');
  } else if (form.confirmPassword !== form.password) {
    errors.confirmPassword = t('validation.passwordsMismatch');
  }

  return errors;
}

