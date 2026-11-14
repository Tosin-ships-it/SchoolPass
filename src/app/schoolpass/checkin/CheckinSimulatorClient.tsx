'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

interface CheckinResultData {
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
}

interface CheckinHistoryItem {
  id: string;
  code: string;
  method: 'MANUAL_CODE' | 'QR';
  timestamp: string;
  success: boolean;
  studentName?: string;
  studentNumber?: string;
  statusText: string;
}

export function CheckinSimulatorClient() {
  const [entryMode, setEntryMode] = useState<'KEYPAD' | 'QR_SCAN'>('KEYPAD');
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [qrInput, setQrInput] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CheckinResultData | null>(null);
  const [recentScans, setRecentScans] = useState<CheckinHistoryItem[]>([]);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');
  const [terminalStatus, setTerminalStatus] = useState<'IDLE' | 'PROCESSING' | 'GRANTED' | 'DENIED'>('IDLE');
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Clock for digital terminal display
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-GB', {
          timeZone: 'Africa/Lagos',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
      setCurrentDate(
        now.toLocaleDateString('en-GB', {
          timeZone: 'Africa/Lagos',
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Read ?code=... from URL if available
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const prefillCode = params.get('code');
      if (prefillCode && /^\d{6}$/.test(prefillCode.trim())) {
        const splitDigits = prefillCode.trim().split('');
        setDigits(splitDigits);
        setQrInput(prefillCode.trim());
      }
    }
  }, []);

  // Web Audio feedback tone (safe fallback if disabled)
  const playBeep = (type: 'success' | 'error') => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'success') {
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.35);
      } else {
        osc.frequency.setValueAtTime(220, ctx.currentTime); // A3
        osc.frequency.setValueAtTime(164.81, ctx.currentTime + 0.12); // E3
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.4);
      }
    } catch {
      // Audio feedback is purely non-blocking enhancement
    }
  };

  const handleDigitChange = (index: number, val: string) => {
    const char = val.replace(/\D/g, '').slice(-1);
    const newDigits = [...digits];
    newDigits[index] = char;
    setDigits(newDigits);

    if (char && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      } else {
        const newDigits = [...digits];
        newDigits[index] = '';
        setDigits(newDigits);
      }
    } else if (e.key === 'Enter') {
      handleSubmit(digits.join(''), 'MANUAL_CODE');
    }
  };

  const handleKeypadPress = (val: string) => {
    if (val === 'CLEAR') {
      setDigits(['', '', '', '', '', '']);
      setResult(null);
      setTerminalStatus('IDLE');
      inputRefs.current[0]?.focus();
      return;
    }

    if (val === 'ENTER') {
      handleSubmit(digits.join(''), 'MANUAL_CODE');
      return;
    }

    // Append digit to next open slot
    const firstEmptyIndex = digits.findIndex((d) => d === '');
    if (firstEmptyIndex !== -1) {
      const newDigits = [...digits];
      newDigits[firstEmptyIndex] = val;
      setDigits(newDigits);
      if (firstEmptyIndex < 5) {
        inputRefs.current[firstEmptyIndex + 1]?.focus();
      }
    }
  };

  const handleSubmit = async (codeToSubmit: string, method: 'MANUAL_CODE' | 'QR' = 'MANUAL_CODE') => {
    let cleanCode = codeToSubmit.trim();
    const match = cleanCode.match(/\b\d{6}\b/);
    if (match) {
      cleanCode = match[0];
    }

    if (cleanCode.length !== 6 || !/^\d{6}$/.test(cleanCode)) {
      setTerminalStatus('DENIED');
      setResult({
        success: false,
        error:
          method === 'QR'
            ? 'QR Code could not be decoded. Please scan a valid 6-digit SchoolPass QR pass.'
            : 'Please enter a complete 6-digit numeric check-in code.',
      });
      playBeep('error');
      return;
    }

    setLoading(true);
    setTerminalStatus('PROCESSING');
    setResult(null);

    try {
      const res = await fetch('/api/arrival/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: cleanCode, method }),
      });

      const data: CheckinResultData = await res.json();
      setResult(data);

      const historyItem: CheckinHistoryItem = {
        id: `${Date.now()}-${Math.random()}`,
        code: cleanCode,
        method,
        timestamp: currentTime || new Date().toLocaleTimeString('en-GB'),
        success: data.success,
        studentName: data.student?.name,
        studentNumber: data.student?.studentNumber,
        statusText: data.success ? 'CONFIRMED' : data.error || 'FAILED',
      };
      setRecentScans((prev) => [historyItem, ...prev.slice(0, 9)]);

      if (data.success) {
        setTerminalStatus('GRANTED');
        playBeep('success');
      } else {
        setTerminalStatus('DENIED');
        playBeep('error');
      }
    } catch {
      const errRes: CheckinResultData = {
        success: false,
        error: 'Communication timeout. Check connection and retry.',
      };
      setResult(errRes);
      setTerminalStatus('DENIED');
      playBeep('error');
    } finally {
      setLoading(false);
    }
  };

  const codeString = digits.join('');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-8 px-4 sm:px-6 lg:px-8 font-sans">
      {/* Header Bar */}
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-slate-800 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold tracking-wider uppercase text-emerald-400">
              Hardware Device Simulator
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-1">
            School Gate Turnstile Terminal
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Supports 6-digit keypad entry (primary) and optical QR code scanner verification.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/ask"
            className="text-xs px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors border border-slate-700"
          >
            &larr; Parent Dashboard
          </Link>
          <Link
            href="/attendance"
            className="text-xs px-3 py-2 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 font-medium transition-colors border border-indigo-500/40"
          >
            Staff Dashboard &rarr;
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 mt-8">
        {/* PHYSICAL TERMINAL DEVICE (7 cols) */}
        <div className="lg:col-span-7 flex flex-col items-center">
          {/* Outer Hardware Chassis */}
          <div className="w-full max-w-md bg-gradient-to-b from-slate-900 to-slate-950 rounded-3xl p-6 sm:p-7 shadow-2xl border-4 border-slate-800 relative ring-1 ring-white/10">
            {/* Top Device Bezel & LEDs */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 mb-5">
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 rounded-full bg-slate-700 border border-slate-600 shadow-inner flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                </div>
                <span className="text-[11px] font-mono tracking-widest text-slate-400 uppercase">
                  GATE-TERMINAL #01 • SCANNER
                </span>
              </div>

              {/* Status Tri-color LED */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-full border border-slate-800">
                  <div
                    className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                      terminalStatus === 'GRANTED'
                        ? 'bg-emerald-400 shadow-[0_0_10px_#34d399]'
                        : terminalStatus === 'DENIED'
                        ? 'bg-rose-500 shadow-[0_0_10px_#f43f5e]'
                        : terminalStatus === 'PROCESSING'
                        ? 'bg-amber-400 animate-ping'
                        : 'bg-emerald-600/50'
                    }`}
                  />
                  <span className="text-[10px] font-mono font-medium text-slate-300">
                    {terminalStatus === 'GRANTED'
                      ? 'GRANTED'
                      : terminalStatus === 'DENIED'
                      ? 'ALERT'
                      : terminalStatus === 'PROCESSING'
                      ? 'SCANNING'
                      : 'ONLINE'}
                  </span>
                </div>
              </div>
            </div>

            {/* OLED Terminal Screen */}
            <div
              className={`rounded-2xl p-5 mb-5 border transition-all duration-300 ${
                terminalStatus === 'GRANTED'
                  ? 'bg-emerald-950/70 border-emerald-500/60 shadow-[0_0_25px_rgba(16,185,129,0.15)]'
                  : terminalStatus === 'DENIED'
                  ? 'bg-rose-950/70 border-rose-500/60 shadow-[0_0_25px_rgba(244,63,94,0.15)]'
                  : 'bg-slate-950 border-slate-800 shadow-inner'
              }`}
            >
              <div className="flex justify-between items-center text-[11px] font-mono text-slate-400 mb-2">
                <span>{currentDate || '---'}</span>
                <span className="font-bold text-slate-300">{currentTime || '--:--:--'}</span>
              </div>

              {/* Dynamic Screen Content */}
              {terminalStatus === 'IDLE' && (
                <div className="text-center py-4">
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-slate-900 border border-slate-700 text-slate-400 mb-2">
                    {entryMode === 'KEYPAD' ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                  </div>
                  <div className="text-sm font-semibold text-slate-200">
                    {entryMode === 'KEYPAD' ? 'ENTER 6-DIGIT CODE' : 'READY FOR QR CODE SCAN'}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {entryMode === 'KEYPAD'
                      ? 'Type the 6-digit code or switch to QR scanner'
                      : 'Hold QR code in front of the optical sensor'}
                  </div>
                </div>
              )}

              {terminalStatus === 'PROCESSING' && (
                <div className="text-center py-5">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400 mb-2" />
                  <div className="text-sm font-semibold text-amber-300">
                    VERIFYING ARRIVAL CODE...
                  </div>
                  <div className="text-xs text-slate-400 mt-1 font-mono">
                    Querying student security ledger &amp; expiry...
                  </div>
                </div>
              )}

              {terminalStatus === 'GRANTED' && result?.student && (
                <div className="text-center py-2 animate-fadeIn">
                  <div className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-mono font-bold uppercase tracking-wider mb-2 border border-emerald-500/40">
                    {result.method === 'QR' ? '✓ ACCESS GRANTED • QR PASS VERIFIED' : '✓ ACCESS GRANTED • 6-DIGIT CODE VERIFIED'}
                  </div>
                  <div className="text-xl font-bold text-white tracking-wide">
                    {result.student.name}
                  </div>
                  <div className="text-xs font-mono text-emerald-300 mt-0.5">
                    ID: {result.student.studentNumber} • Class: {result.student.className}
                  </div>
                  <div className="mt-3 pt-3 border-t border-emerald-800/40 flex justify-between items-center text-xs text-emerald-200/90 font-mono">
                    <span>STATUS: PRESENT (COUNTED)</span>
                    <span>{result.checkinTime}</span>
                  </div>
                </div>
              )}

              {terminalStatus === 'DENIED' && (
                <div className="text-center py-2 animate-fadeIn">
                  <div className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 text-xs font-mono font-bold uppercase tracking-wider mb-2 border border-rose-500/40">
                    ✕ ACCESS DENIED
                  </div>
                  <div className="text-sm font-semibold text-rose-200 px-2 mt-1">
                    {result?.error || 'Invalid or expired check-in code'}
                  </div>
                  <div className="text-xs text-rose-300/70 mt-2 font-mono">
                    Codes expire 15 minutes after generation
                  </div>
                </div>
              )}
            </div>

            {/* Mode Selector Tabs (6-Digit Keypad has Priority) */}
            <div className="flex items-center justify-center p-1 rounded-xl bg-slate-950 border border-slate-800 mb-5">
              <button
                type="button"
                onClick={() => setEntryMode('KEYPAD')}
                className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  entryMode === 'KEYPAD'
                    ? 'bg-slate-800 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
                <span>6-Digit Keypad (Primary)</span>
              </button>

              <button
                type="button"
                onClick={() => setEntryMode('QR_SCAN')}
                className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  entryMode === 'QR_SCAN'
                    ? 'bg-indigo-900/60 text-indigo-200 shadow border border-indigo-700/50'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
                <span>QR Scanner</span>
              </button>
            </div>

            {/* MODE 1: 6-DIGIT KEYPAD (PRIMARY) */}
            {entryMode === 'KEYPAD' && (
              <div>
                {/* 6-Digit Display Slots */}
                <div className="flex justify-center items-center gap-2 sm:gap-2.5 mb-5">
                  {digits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => {
                        inputRefs.current[idx] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleDigitChange(idx, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(idx, e)}
                      disabled={loading}
                      className={`w-11 h-14 sm:w-12 sm:h-16 text-center text-2xl sm:text-3xl font-mono font-bold rounded-xl border transition-all ${
                        digit
                          ? 'bg-slate-800 text-emerald-400 border-emerald-500/50 shadow-sm'
                          : 'bg-slate-950 text-slate-500 border-slate-700/80 focus:border-indigo-500'
                      } focus:outline-none focus:ring-2 focus:ring-indigo-500/50`}
                    />
                  ))}
                </div>

                {/* Physical Hardware Keypad */}
                <div className="grid grid-cols-3 gap-2 sm:gap-2.5 mb-5">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleKeypadPress(num)}
                      disabled={loading}
                      className="h-12 sm:h-13 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white font-mono text-xl font-semibold shadow border border-slate-700/60 transition-transform active:scale-95 disabled:opacity-50"
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleKeypadPress('CLEAR')}
                    disabled={loading}
                    className="h-12 sm:h-13 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 font-mono text-xs font-bold uppercase tracking-wider shadow border border-rose-800/50 transition-transform active:scale-95 disabled:opacity-50"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => handleKeypadPress('0')}
                    disabled={loading}
                    className="h-12 sm:h-13 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white font-mono text-xl font-semibold shadow border border-slate-700/60 transition-transform active:scale-95 disabled:opacity-50"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={() => handleKeypadPress('ENTER')}
                    disabled={loading || codeString.length !== 6}
                    className="h-12 sm:h-13 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-400 text-white font-mono text-xs font-bold uppercase tracking-wider shadow border border-emerald-500 transition-transform active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Enter
                  </button>
                </div>

                {/* Direct Submit Action Button */}
                <button
                  type="button"
                  onClick={() => handleSubmit(digits.join(''), 'MANUAL_CODE')}
                  disabled={loading || codeString.length !== 6}
                  className="w-full py-3 px-4 rounded-xl font-semibold text-sm tracking-wide bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-900/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Verifying 6-Digit Code...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Verify &amp; Confirm via 6-Digit Code</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* MODE 2: QR CODE OPTICAL SCANNER */}
            {entryMode === 'QR_SCAN' && (
              <div className="space-y-4">
                {/* Simulated Optical Viewport */}
                <div className="relative bg-slate-950 rounded-2xl p-6 border-2 border-dashed border-indigo-500/40 flex flex-col items-center justify-center min-h-[190px] overflow-hidden">
                  {/* Laser scan line animation */}
                  <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_8px_#34d399] animate-pulse" />

                  <div className="w-16 h-16 rounded-xl border-2 border-indigo-500/60 flex items-center justify-center text-indigo-300 mb-3 bg-indigo-950/30">
                    <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                    </svg>
                  </div>

                  <span className="text-xs font-semibold text-slate-200">
                    Optical Scanner Laser Active
                  </span>
                  <span className="text-[11px] text-slate-400 mt-1 text-center max-w-xs">
                    Hold parent QR Code pass up to scanner lens, or use gun reader
                  </span>
                </div>

                {/* Gun Reader / Optical Payload Input */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={qrInput}
                    onChange={(e) => setQrInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSubmit(qrInput, 'QR');
                      }
                    }}
                    placeholder="Scan QR payload or enter 6-digit pass..."
                    className="flex-1 bg-slate-950 text-slate-200 font-mono text-sm px-3 py-2.5 rounded-xl border border-slate-700 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleSubmit(qrInput, 'QR')}
                    disabled={loading || !qrInput.trim()}
                    className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs tracking-wider uppercase transition-colors disabled:opacity-40"
                  >
                    Scan
                  </button>
                </div>

                {/* Quick Simulation Trigger */}
                {codeString.length === 6 && (
                  <button
                    type="button"
                    onClick={() => handleSubmit(codeString, 'QR')}
                    disabled={loading}
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 font-medium text-xs border border-indigo-500/30 flex items-center justify-center gap-2"
                  >
                    <span>Simulate Optical Scan of Code:</span>
                    <strong className="font-mono text-white">{codeString}</strong>
                  </button>
                )}
              </div>
            )}

            {/* Terminal Footnote */}
            <div className="mt-4 pt-3 border-t border-slate-800/80 text-center">
              <span className="text-[11px] font-mono text-slate-500">
                SchoolPass Dual Gate Verification • 6-Digit Priority &amp; QR Optical Emulation
              </span>
            </div>
          </div>
        </div>

        {/* SIDE PANEL: HOW IT WORKS & RECENT SCANS (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Explanation Card */}
          <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-indigo-400" />
              Check-In Verification Rules
            </h3>
            <ol className="space-y-2.5 text-xs text-slate-300 list-decimal list-inside">
              <li>
                <strong className="text-slate-100">6-Digit Code Priority:</strong> The 6-digit code is the primary, universal method for gate arrival drop-offs.
              </li>
              <li>
                <strong className="text-slate-100">QR Code Capability:</strong> Parents can also show the accompanying QR Code for fast optical barcode scanning.
              </li>
              <li>
                <strong className="text-slate-100">15-Minute Expiry:</strong> All codes and QR passes expire exactly 15 minutes after generation.
              </li>
              <li>
                <strong className="text-slate-100">Attendance Counted:</strong> Either method records attendance as{' '}
                <span className="text-emerald-400 font-semibold">PRESENT</span>, incrementing the student's official attendance figures!
              </li>
            </ol>
          </div>

          {/* Recent Scans Ledger */}
          <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Live Terminal Audit Log
              </h3>
              <span className="text-[11px] font-mono text-slate-500">
                {recentScans.length} recent
              </span>
            </div>

            {recentScans.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-500 font-mono border border-dashed border-slate-800 rounded-xl">
                No check-in codes submitted yet.
                <br />
                Enter a 6-digit code or scan a QR code above.
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {recentScans.map((scan) => (
                  <div
                    key={scan.id}
                    className={`p-3 rounded-xl border text-xs flex items-center justify-between transition-colors ${
                      scan.success
                        ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-200'
                        : 'bg-rose-950/30 border-rose-800/40 text-rose-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-white tracking-widest">
                          {scan.code}
                        </span>
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold uppercase ${
                            scan.method === 'QR'
                              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                              : 'bg-slate-800 text-slate-300 border border-slate-700'
                          }`}
                        >
                          {scan.method === 'QR' ? 'QR' : '6-DIGIT'}
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold ${
                            scan.success
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-rose-500/20 text-rose-300'
                          }`}
                        >
                          {scan.success ? 'GRANTED' : 'DENIED'}
                        </span>
                      </div>
                      {scan.studentName && (
                        <div className="text-[11px] text-slate-300 mt-0.5 font-medium">
                          {scan.studentName} ({scan.studentNumber})
                        </div>
                      )}
                      {!scan.success && (
                        <div className="text-[10px] text-rose-400 mt-0.5 max-w-[220px] truncate">
                          {scan.statusText}
                        </div>
                      )}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 text-right">
                      {scan.timestamp}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
