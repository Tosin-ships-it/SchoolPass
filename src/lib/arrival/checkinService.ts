import 'server-only';
import crypto from 'node:crypto';
import { prisma } from '@/lib/db';
import { logEvent } from '@/lib/logging';
import { sendCheckinCodeEmail } from '@/lib/auth/email';
import { generateQrSvg } from './qr';

export interface StoredCheckinCodeData {
  code: string;
  studentId: string;
  studentName: string;
  studentNumber: string;
  studentClass: string;
  parentId: string;
  parentEmail: string;
  parentName?: string;
  createdAt: string;
  expiresAt: string;
  dateStr: string;
  timeStr: string;
  expiresAtStr: string;
  used: boolean;
  usedAt: string | null;
}

export interface GenerateCheckinResult {
  success: boolean;
  code?: string;
  qrSvg?: string;
  expiresAt?: string;
  expiresInSeconds?: number;
  studentName?: string;
  studentNumber?: string;
  dateStr?: string;
  timeStr?: string;
  expiresAtStr?: string;
  error?: string;
}

export interface GateCheckinResult {
  success: boolean;
  student?: {
    id: string;
    name: string;
    studentNumber: string;
    className: string;
  };
  checkinTime?: string;
  checkinDate?: string;
  method?: 'MANUAL_CODE' | 'QR';
  message?: string;
  error?: string;
  isAlreadyConfirmed?: boolean;
}

/**
 * Formats a Date object in Africa/Lagos timezone.
 */
function formatLagosDateTime(date: Date): { dateStr: string; timeStr: string; expiresAtStr: string } {
  const dateStr = date.toLocaleDateString('en-GB', {
    timeZone: 'Africa/Lagos',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const timeStr = date.toLocaleTimeString('en-GB', {
    timeZone: 'Africa/Lagos',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const expiryDate = new Date(date.getTime() + 15 * 60 * 1000);
  const expiresAtStr = expiryDate.toLocaleTimeString('en-GB', {
    timeZone: 'Africa/Lagos',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  return { dateStr, timeStr, expiresAtStr };
}

/**
 * Generates a 6-digit numeric check-in code with a 15-minute validity window
 * and dispatches it to the parent's email address.
 */
export async function generateParentCheckinCode(params: {
  parentId: string;
  studentId: string;
  parentEmail: string;
  parentName?: string;
}): Promise<GenerateCheckinResult> {
  const { parentId, studentId, parentEmail, parentName } = params;

  // 1. Verify ParentStudent authorization link
  const link = await prisma.parentStudent.findUnique({
    where: {
      parentId_studentId: {
        parentId,
        studentId,
      },
    },
    include: {
      student: {
        select: {
          id: true,
          name: true,
          studentNumber: true,
          className: true,
          leftAt: true,
        },
      },
    },
  });

  if (!link || link.student.leftAt !== null) {
    return {
      success: false,
      error: 'You are not authorized to generate a check-in code for this student.',
    };
  }

  const student = link.student;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // Exactly 15 minutes
  const { dateStr, timeStr, expiresAtStr } = formatLagosDateTime(now);

  // 2. Generate random 6-digit numeric code
  const code = crypto.randomInt(100000, 1000000).toString();

  const codeData: StoredCheckinCodeData = {
    code,
    studentId: student.id,
    studentName: student.name,
    studentNumber: student.studentNumber,
    studentClass: student.className,
    parentId,
    parentEmail,
    parentName,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    dateStr,
    timeStr,
    expiresAtStr,
    used: false,
    usedAt: null,
  };

  const codeKey = `checkin_code:${code}`;
  const studentActiveKey = `student_active_checkin:${student.id}`;
  const payloadStr = JSON.stringify(codeData);

  // 3. Persist code in SchoolSetting
  await Promise.all([
    prisma.schoolSetting.upsert({
      where: { key: codeKey },
      update: { value: payloadStr },
      create: { key: codeKey, value: payloadStr },
    }),
    prisma.schoolSetting.upsert({
      where: { key: studentActiveKey },
      update: { value: payloadStr },
      create: { key: studentActiveKey, value: payloadStr },
    }),
  ]);

  // 4. Generate QR code SVG (accompanies the 6-digit code with priority on the 6-digit code)
  const qrSvg = generateQrSvg(code, { size: 160 });

  // 5. Send email to parent
  try {
    await sendCheckinCodeEmail({
      to: parentEmail,
      name: parentName,
      studentName: student.name,
      studentNumber: student.studentNumber,
      checkinCode: code,
      qrSvg,
      dateStr,
      timeStr,
      expiresAtStr,
      userId: parentId,
    });
  } catch {
    // Email transmission error does not prevent code usage
  }

  logEvent({
    level: 'info',
    event: 'checkin_code_generated',
    actorType: 'parent',
    actorId: parentId,
    entityType: 'Student',
    entityId: student.id,
    outcome: 'success',
  });

  return {
    success: true,
    code,
    qrSvg,
    expiresAt: expiresAt.toISOString(),
    expiresInSeconds: 15 * 60,
    studentName: student.name,
    studentNumber: student.studentNumber,
    dateStr,
    timeStr,
    expiresAtStr,
  };
}

/**
 * Retrieves the currently active, unexpired check-in code for a student if one exists.
 */
export async function getActiveCheckinCode(
  studentId: string,
  parentId: string
): Promise<StoredCheckinCodeData | null> {
  const studentActiveKey = `student_active_checkin:${studentId}`;
  const record = await prisma.schoolSetting.findUnique({
    where: { key: studentActiveKey },
  });

  if (!record) return null;

  try {
    const data: StoredCheckinCodeData = JSON.parse(record.value);
    if (data.parentId !== parentId) return null;
    if (data.used) return null;

    const expiresAt = new Date(data.expiresAt);
    if (expiresAt.getTime() <= Date.now()) {
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

/**
 * Validates and processes a check-in code presented at the gate terminal simulator
 * via either manual 6-digit keypad entry (primary) or QR code optical scan.
 * When successful:
 * 1. Creates/updates the ArrivalConfirmation record with method (MANUAL_CODE or QR).
 * 2. Creates/updates the AttendanceRecord with status PRESENT and source PARENT_CONFIRMATION.
 * 3. Marks the check-in code as consumed so it cannot be re-used.
 */
export async function processGateCheckin(
  input: string | { code: string; method?: 'MANUAL_CODE' | 'QR' }
): Promise<GateCheckinResult> {
  const rawCode = typeof input === 'string' ? input : input.code;
  const method: 'MANUAL_CODE' | 'QR' =
    typeof input === 'object' && input.method === 'QR' ? 'QR' : 'MANUAL_CODE';

  let cleanedCode = (rawCode || '').trim();
  // Extract 6-digit numeric pattern if embedded in formatted QR payload (e.g. SP:123456 or URL)
  const numericMatch = cleanedCode.match(/\b\d{6}\b/);
  if (numericMatch) {
    cleanedCode = numericMatch[0];
  }

  if (!cleanedCode || !/^\d{6}$/.test(cleanedCode)) {
    return {
      success: false,
      error: 'Please provide a valid 6-digit numeric check-in code or QR pass.',
    };
  }

  const codeKey = `checkin_code:${cleanedCode}`;
  const setting = await prisma.schoolSetting.findUnique({
    where: { key: codeKey },
  });

  if (!setting) {
    logEvent({
      level: 'warn',
      event: 'gate_checkin_failed',
      actorType: 'system',
      outcome: 'failure',
      details: { reason: 'Code not found', method },
    });
    return {
      success: false,
      error: 'Code not recognized. Please check the 6-digit code or QR code and try again.',
    };
  }

  let data: StoredCheckinCodeData;
  try {
    data = JSON.parse(setting.value);
  } catch {
    return {
      success: false,
      error: 'Malformed check-in record. Please generate a new code.',
    };
  }

  // Check if code was already used
  if (data.used) {
    return {
      success: false,
      error: `This check-in code has already been used on ${data.usedAt ? new Date(data.usedAt).toLocaleTimeString('en-GB') : 'today'}.`,
    };
  }

  // Check 15-minute expiry
  const now = new Date();
  const expiresAt = new Date(data.expiresAt);
  if (now.getTime() > expiresAt.getTime()) {
    return {
      success: false,
      error: `Check-in code expired at ${data.expiresAtStr}. Check-in codes are valid for 15 minutes only. Please generate a fresh code on your dashboard.`,
    };
  }

  // Normalise calendar date (UTC midnight for consistent unique constraint)
  const dateOnly = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  // Ensure default School record exists
  let school = await prisma.school.findFirst();
  if (!school) {
    school = await prisma.school.create({
      data: {
        name: 'SchoolPass Academy',
      },
    });
  }

  // 1. Record / Update ArrivalConfirmation with accurate method (MANUAL_CODE or QR)
  const arrival = await prisma.arrivalConfirmation.upsert({
    where: {
      studentId_date: {
        studentId: data.studentId,
        date: dateOnly,
      },
    },
    update: {
      time: now,
      method,
      status: 'CONFIRMED',
    },
    create: {
      studentId: data.studentId,
      parentId: data.parentId,
      schoolId: school.id,
      date: dateOnly,
      time: now,
      method,
      status: 'CONFIRMED',
    },
  });

  // 2. Record / Update AttendanceRecord as PRESENT so it is counted in official attendance
  const existingAttendance = await prisma.attendanceRecord.findUnique({
    where: {
      studentId_date: {
        studentId: data.studentId,
        date: dateOnly,
      },
    },
  });

  if (!existingAttendance) {
    await prisma.attendanceRecord.create({
      data: {
        studentId: data.studentId,
        date: dateOnly,
        time: now,
        status: 'PRESENT',
        source: 'PARENT_CONFIRMATION',
      },
    });
  } else if (existingAttendance.source === 'PARENT_CONFIRMATION') {
    await prisma.attendanceRecord.update({
      where: { id: existingAttendance.id },
      data: {
        time: now,
        status: 'PRESENT',
      },
    });
  }

  // 3. Mark code as consumed
  data.used = true;
  data.usedAt = now.toISOString();

  await Promise.all([
    prisma.schoolSetting.update({
      where: { key: codeKey },
      data: { value: JSON.stringify(data) },
    }),
    prisma.schoolSetting.update({
      where: { key: `student_active_checkin:${data.studentId}` },
      data: { value: JSON.stringify(data) },
    }),
  ]);

  logEvent({
    level: 'info',
    event: 'gate_checkin_success',
    actorType: 'system',
    actorId: data.parentId,
    entityType: 'ArrivalConfirmation',
    entityId: arrival.id,
    outcome: 'success',
    details: { method },
  });

  const checkinTimeFormatted = now.toLocaleTimeString('en-GB', {
    timeZone: 'Africa/Lagos',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  const checkinDateFormatted = now.toLocaleDateString('en-GB', {
    timeZone: 'Africa/Lagos',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const verificationModeLabel = method === 'QR' ? 'QR Code Scan' : '6-Digit Manual Code';

  return {
    success: true,
    method,
    student: {
      id: data.studentId,
      name: data.studentName,
      studentNumber: data.studentNumber,
      className: data.studentClass,
    },
    checkinTime: checkinTimeFormatted,
    checkinDate: checkinDateFormatted,
    message: `Check-in confirmed via ${verificationModeLabel}. Student attendance recorded as PRESENT.`,
  };
}
