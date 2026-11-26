import type { Appointment, AppointmentStatus, Doctor } from '../types/ruralcare';

export function generateDemoHealthId(
  fullName: string,
  district: string,
  numericSuffix?: number
): string {
  const cleanName = fullName.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 2) || 'RC';
  const cleanDist = district.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 2) || 'IN';
  const suffix =
    numericSuffix !== undefined
      ? String(numericSuffix).padStart(4, '0').slice(0, 4)
      : String(Math.floor(1000 + Math.random() * 9000));
  return `RC-${cleanDist}${cleanName}-${suffix}`;
}

export function filterDoctors(
  doctors: Doctor[],
  searchQuery: string,
  specialization: string,
  maxDistanceKm: number | null = null
): Doctor[] {
  const q = searchQuery.trim().toLowerCase();
  return doctors.filter((doc) => {
    const matchesQuery =
      !q ||
      doc.name.toLowerCase().includes(q) ||
      doc.specialization.toLowerCase().includes(q) ||
      doc.hospital.toLowerCase().includes(q) ||
      doc.location.toLowerCase().includes(q);
    const matchesSpec =
      !specialization ||
      specialization === 'All' ||
      doc.specialization === specialization;
    const matchesDist =
      maxDistanceKm === null || doc.distanceKm <= maxDistanceKm;
    return matchesQuery && matchesSpec && matchesDist;
  });
}

export function updateAppointmentStatusList(
  appointments: Appointment[],
  appointmentId: string,
  nextStatus: AppointmentStatus
): Appointment[] {
  return appointments.map((apt) =>
    apt.id === appointmentId ? { ...apt, status: nextStatus } : apt
  );
}

/**
 * Generates a deterministic 21x21 QR-style boolean grid for a given string payload
 * with authentic 7x7 finder patterns in top-left, top-right, and bottom-left corners.
 */
export function generateQrMatrix(payload: string): boolean[][] {
  const size = 21;
  const grid: boolean[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false)
  );

  const placeFinder = (startRow: number, startCol: number) => {
    for (let r = 0; r < 7; r += 1) {
      for (let c = 0; c < 7; c += 1) {
        const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
        const isCenter = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        grid[startRow + r][startCol + c] = isBorder || isCenter;
      }
    }
  };

  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  // Timing patterns on row 6 and col 6
  for (let i = 8; i < size - 8; i += 1) {
    grid[6][i] = i % 2 === 0;
    grid[i][6] = i % 2 === 0;
  }

  // Deterministic PRNG seeded by payload
  let hash = 2166136261;
  for (let i = 0; i < payload.length; i += 1) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  const isReserved = (r: number, c: number): boolean => {
    if (r < 8 && c < 8) return true;
    if (r < 8 && c >= size - 8) return true;
    if (r >= size - 8 && c < 8) return true;
    if (r === 6 || c === 6) return true;
    return false;
  };

  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (isReserved(r, c)) continue;
      hash ^= (r * 31 + c * 17) & 0xff;
      hash = Math.imul(hash, 16777619);
      grid[r][c] = ((hash >>> 16) & 1) === 1;
    }
  }

  return grid;
}
