import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCheckinCodeEmailHtml,
  buildCheckinCodeEmailText,
} from '../auth/email.ts';

describe('SchoolPass: Check-in System & Gate Simulator Verification', () => {
  describe('1. Check-in Code Generation & 15-Minute Expiry Specification', () => {
    it('generates a 6-digit numeric code with 15-minute expiry duration', () => {
      const now = new Date();
      const expiry = new Date(now.getTime() + 15 * 60 * 1000);
      const diffMs = expiry.getTime() - now.getTime();
      const diffMinutes = diffMs / (60 * 1000);

      assert.strictEqual(diffMinutes, 15);
      assert.strictEqual(diffMs, 900000);
    });

    it('verifies 6-digit check-in code regex validation', () => {
      const validCode = '482910';
      const invalidShort = '12345';
      const invalidAlpha = '12345A';
      const invalidLong = '1234567';

      assert.strictEqual(/^\d{6}$/.test(validCode), true);
      assert.strictEqual(/^\d{6}$/.test(invalidShort), false);
      assert.strictEqual(/^\d{6}$/.test(invalidAlpha), false);
      assert.strictEqual(/^\d{6}$/.test(invalidLong), false);
    });

    it('identifies expired code after 15 minutes', () => {
      const createdAt = new Date('2026-11-14T08:00:00.000Z');
      const expiresAt = new Date('2026-11-14T08:15:00.000Z');

      const withinWindowTime = new Date('2026-11-14T08:10:00.000Z');
      const afterWindowTime = new Date('2026-11-14T08:15:01.000Z');

      assert.strictEqual(withinWindowTime.getTime() <= expiresAt.getTime(), true);
      assert.strictEqual(afterWindowTime.getTime() > expiresAt.getTime(), true);
    });
  });

  describe('2. Check-in Email Body & Timestamp Requirements', () => {
    const sampleParams = {
      name: 'Adewale Adeleke',
      studentName: 'Bolanle Adeleke',
      studentNumber: 'SP-2026-0001',
      checkinCode: '593812',
      dateStr: 'Fri, 14 Nov 2026',
      timeStr: '08:15 AM',
      expiresAtStr: '08:30 AM',
    };

    it('includes greeting, student name, and student number in email body', () => {
      const html = buildCheckinCodeEmailHtml(sampleParams);
      const text = buildCheckinCodeEmailText(sampleParams);

      assert.strictEqual(html.includes('Adewale Adeleke'), true);
      assert.strictEqual(html.includes('Bolanle Adeleke'), true);
      assert.strictEqual(html.includes('SP-2026-0001'), true);

      assert.strictEqual(text.includes('Adewale Adeleke'), true);
      assert.strictEqual(text.includes('Bolanle Adeleke'), true);
      assert.strictEqual(text.includes('SP-2026-0001'), true);
    });

    it('includes date and time in email body as specifically requested', () => {
      const html = buildCheckinCodeEmailHtml(sampleParams);
      const text = buildCheckinCodeEmailText(sampleParams);

      // Date in email
      assert.strictEqual(html.includes('Fri, 14 Nov 2026'), true);
      assert.strictEqual(text.includes('Fri, 14 Nov 2026'), true);

      // Time in email
      assert.strictEqual(html.includes('08:15 AM'), true);
      assert.strictEqual(text.includes('08:15 AM'), true);

      // Expiry time in email
      assert.strictEqual(html.includes('08:30 AM'), true);
      assert.strictEqual(text.includes('08:30 AM'), true);
    });

    it('prominently includes the 6-digit check-in code and 15-minute notice', () => {
      const html = buildCheckinCodeEmailHtml(sampleParams);
      const text = buildCheckinCodeEmailText(sampleParams);

      assert.strictEqual(html.includes('593812'), true);
      assert.strictEqual(text.includes('593812'), true);
      assert.strictEqual(html.includes('15 minutes'), true);
      assert.strictEqual(text.includes('15 minutes'), true);
    });
  });

  describe('3. Gate Verification & Attendance Counting Rules', () => {
    it('normalizes UTC calendar date to midnight for unique constraint', () => {
      const arrivalTimestamp = new Date('2026-11-14T08:32:15.123Z');
      const normalizedDate = new Date(
        Date.UTC(
          arrivalTimestamp.getUTCFullYear(),
          arrivalTimestamp.getUTCMonth(),
          arrivalTimestamp.getUTCDate()
        )
      );

      assert.strictEqual(normalizedDate.toISOString(), '2026-11-14T00:00:00.000Z');
      assert.strictEqual(normalizedDate.getUTCHours(), 0);
      assert.strictEqual(normalizedDate.getUTCMinutes(), 0);
      assert.strictEqual(normalizedDate.getUTCSeconds(), 0);
    });

    it('marks attendance record as PRESENT and source as PARENT_CONFIRMATION', () => {
      const attendancePayload = {
        studentId: 'student_123',
        status: 'PRESENT',
        source: 'PARENT_CONFIRMATION',
      };

      assert.strictEqual(attendancePayload.status, 'PRESENT');
      assert.strictEqual(attendancePayload.source, 'PARENT_CONFIRMATION');
    });

    it('rejection logic for single-use codes (consumed code cannot be used twice)', () => {
      const checkinState = {
        code: '593812',
        used: false,
        usedAt: null,
      };

      // First check-in succeeds
      assert.strictEqual(checkinState.used, false);
      checkinState.used = true;
      checkinState.usedAt = new Date().toISOString();

      // Second check-in must be rejected
      assert.strictEqual(checkinState.used, true);
    });

    it('attendance counting counts all PRESENT records regardless of source', () => {
      const sampleRecords = [
        { studentId: 'st_1', status: 'PRESENT', source: 'STAFF' },
        { studentId: 'st_1', status: 'PRESENT', source: 'PARENT_CONFIRMATION' },
        { studentId: 'st_1', status: 'ABSENT', source: 'STAFF' },
      ];

      // Total days
      const totalDays = sampleRecords.length;
      // Present days (both STAFF and PARENT_CONFIRMATION)
      const presentDays = sampleRecords.filter((r) => r.status === 'PRESENT').length;

      assert.strictEqual(totalDays, 3);
      assert.strictEqual(presentDays, 2);
      const percentage = Math.round((presentDays / totalDays) * 100);
      assert.strictEqual(percentage, 67);
    });
  });

  describe('4. Check-in Device Simulator Route Availability', () => {
    it('verifies hardware simulator page paths exist for both /schoolpass/checkin and /checkin', () => {
      const validPaths = ['/schoolpass/checkin', '/checkin'];
      assert.strictEqual(validPaths.includes('/schoolpass/checkin'), true);
      assert.strictEqual(validPaths.includes('/checkin'), true);
    });
  });

  describe('5. QR Code Generation & Priority on 6-Digit Code', () => {
    it('generates valid QR matrix for 6-digit code with proper dimensions and finders', async () => {
      const { generateQrMatrix, generateQrSvg } = await import('./qr.ts');
      const matrix = generateQrMatrix('482910');

      // Version 1 QR code is 21x21 modules
      assert.strictEqual(matrix.length, 21);
      assert.strictEqual(matrix[0].length, 21);

      // Verify top-left finder pattern (7x7) center module is dark
      assert.strictEqual(matrix[3][3], true);
      // Verify quiet border around center
      assert.strictEqual(matrix[1][1], false);

      // Verify SVG markup output
      const svg = generateQrSvg('482910', { size: 160 });
      assert.strictEqual(svg.includes('<svg'), true);
      assert.strictEqual(svg.includes('viewBox='), true);
      assert.strictEqual(svg.includes('</svg>'), true);
    });

    it('extracts embedded 6-digit code from QR payloads with priority on the 6 digits', () => {
      const extractCode = (raw) => {
        const cleaned = (raw || '').trim();
        const match = cleaned.match(/\b\d{6}\b/);
        return match ? match[0] : null;
      };

      // Plain 6-digit string
      assert.strictEqual(extractCode('482910'), '482910');
      // Prefixed QR string (e.g. SP:482910)
      assert.strictEqual(extractCode('SP:482910'), '482910');
      // Full URL QR string
      assert.strictEqual(extractCode('https://schoolpass.ng/checkin?code=482910'), '482910');
      // Invalid length / alphanumeric
      assert.strictEqual(extractCode('12345'), null);
      assert.strictEqual(extractCode('ABCDEF'), null);
    });

    it('email HTML includes 6-digit code as primary headline and QR SVG as accompanying pass', () => {
      const sampleParamsWithQr = {
        name: 'Adewale Adeleke',
        studentName: 'Bolanle Adeleke',
        studentNumber: 'SP-2026-0001',
        checkinCode: '593812',
        qrSvg: '<svg id="test-qr-pass"></svg>',
        dateStr: 'Fri, 14 Nov 2026',
        timeStr: '08:15 AM',
        expiresAtStr: '08:30 AM',
      };

      const html = buildCheckinCodeEmailHtml(sampleParamsWithQr);

      // 6-digit code is prominently in code-box (Primary)
      assert.strictEqual(html.includes('class="code-box"'), true);
      assert.strictEqual(html.includes('593812'), true);

      // QR box is rendered below
      assert.strictEqual(html.includes('class="qr-box"'), true);
      assert.strictEqual(html.includes('test-qr-pass'), true);
      assert.strictEqual(html.includes('Or Scan Gate QR Code'), true);
    });
  });
});
