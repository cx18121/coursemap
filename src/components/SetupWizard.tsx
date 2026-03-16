'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Account {
  role: string;
  email: string | null;
  connected: boolean;
}

interface SetupWizardProps {
  currentStep: number;
  user?: {
    name: string;
    email: string;
    canvasIcsUrl: string | null;
  };
  accounts?: Account[];
  error?: string;
}

export default function SetupWizard({
  currentStep,
  user,
  accounts = [],
  error,
}: SetupWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(currentStep);
  const [canvasUrl, setCanvasUrl] = useState(user?.canvasIcsUrl ?? '');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const schoolConnected = accounts.some((a) => a.role === 'school');

  const handleSkipSchool = () => setStep(3);

  const handleSaveCanvasUrl = async () => {
    if (!canvasUrl.trim()) return;
    setSaving(true);
    setSaveError(null);

    try {
      const res = await fetch('/api/auth/canvas-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canvasIcsUrl: canvasUrl }),
      });

      const result = await res.json();
      if (!res.ok) {
        setSaveError(result.error ?? 'Failed to save URL.');
        return;
      }

      router.push('/dashboard');
    } catch {
      setSaveError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full space-y-8">
      {/* Error banner */}
      {error === 'access_denied' && (
        <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300 text-xs">
          Something went wrong connecting your account. Please try again.
        </div>
      )}

      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`rounded-full transition-all duration-300 ${
              s === step
                ? 'w-6 h-2 bg-[--color-accent]'
                : s < step
                ? 'w-2 h-2 bg-[--color-accent]/50'
                : 'w-2 h-2 bg-white/10'
            }`}
          />
        ))}
      </div>

      {/* Step 1 — Personal Google */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="space-y-2 text-center">
            <p className="text-xs text-[--color-text-tertiary] uppercase tracking-widest">Step 1 of 3</p>
            <h2 className="text-xl font-semibold text-[--color-text-primary]">
              Sign in with Google
            </h2>
            <p className="text-sm text-[--color-text-secondary] leading-relaxed">
              Use your personal Google account — this is where your calendar events will be created.
            </p>
          </div>
          <a
            href="/login/google"
            className="flex items-center justify-center gap-3 w-full px-5 py-3 bg-[--color-accent] hover:bg-[--color-accent-hover] text-[#0c0a09] text-sm font-semibold rounded-xl transition-colors shadow-lg shadow-amber-500/10"
          >
            <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" opacity=".6"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" opacity=".8"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" opacity=".7"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" opacity=".9"/>
            </svg>
            Continue with Google
          </a>
        </div>
      )}

      {/* Step 2 — School Google (optional) */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="space-y-2 text-center">
            <p className="text-xs text-[--color-text-tertiary] uppercase tracking-widest">Step 2 of 3</p>
            <h2 className="text-xl font-semibold text-[--color-text-primary]">
              Link your school account
            </h2>
            <p className="text-sm text-[--color-text-secondary] leading-relaxed">
              Connect your school Google account to mirror your school calendar. You can skip this and add it later.
            </p>
          </div>

          {error === 'school_access_denied' && (
            <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300 text-xs">
              Your school may restrict third-party app access. Canvas ICS sync still works without it.
            </div>
          )}

          {schoolConnected ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-emerald-300 text-sm">School account linked successfully.</p>
              </div>
              <button
                onClick={() => setStep(3)}
                className="w-full px-5 py-3 bg-[--color-accent] hover:bg-[--color-accent-hover] text-[#0c0a09] text-sm font-semibold rounded-xl transition-colors shadow-lg shadow-amber-500/10"
              >
                Continue
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <a
                href="/link/school-google"
                className="flex items-center justify-center gap-3 w-full px-5 py-3 bg-[--color-accent] hover:bg-[--color-accent-hover] text-[#0c0a09] text-sm font-semibold rounded-xl transition-colors shadow-lg shadow-amber-500/10"
              >
                <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" opacity=".6"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" opacity=".8"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" opacity=".7"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" opacity=".9"/>
                </svg>
                {error === 'school_access_denied' ? 'Try Again' : 'Link School Account'}
              </a>
              <button
                onClick={handleSkipSchool}
                className="w-full px-5 py-3 border border-white/10 hover:border-white/20 hover:bg-white/[0.03] text-[--color-text-secondary] hover:text-[--color-text-primary] text-sm font-medium rounded-xl transition-colors"
              >
                Skip for now
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step 3 — Canvas ICS URL */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="space-y-2 text-center">
            <p className="text-xs text-[--color-text-tertiary] uppercase tracking-widest">Step 3 of 3</p>
            <h2 className="text-xl font-semibold text-[--color-text-primary]">
              Add your Canvas feed
            </h2>
            <p className="text-sm text-[--color-text-secondary] leading-relaxed">
              Paste your Canvas calendar feed URL to import assignments and due dates.
            </p>
          </div>
          <div className="space-y-3">
            <input
              type="url"
              placeholder="https://canvas.instructure.com/feeds/calendars/..."
              value={canvasUrl}
              onChange={(e) => setCanvasUrl(e.target.value)}
              className="w-full px-4 py-3 bg-white/[0.04] border border-white/10 focus:border-[--color-accent]/50 focus:bg-white/[0.06] rounded-xl text-sm text-[--color-text-primary] placeholder-[--color-text-tertiary] focus:outline-none focus:ring-1 focus:ring-[--color-accent]/20 transition-all"
            />
            {saveError && (
              <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300 text-xs">
                {saveError}
              </div>
            )}
            <button
              onClick={handleSaveCanvasUrl}
              disabled={saving || !canvasUrl.trim()}
              className="w-full px-5 py-3 bg-[--color-accent] hover:bg-[--color-accent-hover] disabled:opacity-40 disabled:cursor-not-allowed text-[#0c0a09] text-sm font-semibold rounded-xl transition-colors shadow-lg shadow-amber-500/10"
            >
              {saving ? 'Saving…' : 'Finish Setup'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
