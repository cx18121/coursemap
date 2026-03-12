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
    <div className="w-full space-y-6">
      {/* Error banner */}
      {error === 'access_denied' && (
        <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300 text-xs">
          Something went wrong connecting your account. Please try again.
        </div>
      )}

      {/* Progress indicator */}
      <div className="space-y-3">
        <div className="flex gap-1.5">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`flex-1 h-0.5 rounded-full transition-colors duration-300 ${
                s <= step ? 'bg-[--color-accent]' : 'bg-white/[0.06]'
              }`}
            />
          ))}
        </div>
        <p className="text-[--color-text-tertiary] text-[11px] text-center uppercase tracking-[0.15em]">
          Step {step} of 3
        </p>
      </div>

      {/* Step 1 — Personal Google */}
      {step === 1 && (
        <div className="bg-[--color-surface] border border-[--color-border] rounded-xl p-6 space-y-5">
          <div className="space-y-2">
            <h2 className="text-base font-medium text-[--color-text-primary]">
              Connect Google Account
            </h2>
            <p className="text-xs text-[--color-text-secondary] leading-relaxed">
              Sign in with your personal Google account to sync calendars.
            </p>
          </div>
          <a
            href="/login/google"
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-[--color-accent] hover:bg-[--color-accent-hover] text-[#0c0a09] text-sm font-medium rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" opacity=".6"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" opacity=".8"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" opacity=".7"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" opacity=".9"/>
            </svg>
            Sign in with Google
          </a>
        </div>
      )}

      {/* Step 2 — School Google (optional) */}
      {step === 2 && (
        <div className="bg-[--color-surface] border border-[--color-border] rounded-xl p-6 space-y-5">
          <div className="space-y-2">
            <h2 className="text-base font-medium text-[--color-text-primary]">
              Link School Account
            </h2>
            <p className="text-xs text-[--color-text-secondary] leading-relaxed">
              Connect your school Google account to mirror your school calendar. Optional.
            </p>
          </div>

          {error === 'school_access_denied' ? (
            <div className="space-y-4">
              <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300 text-xs">
                Your school may restrict third-party app access. Canvas ICS sync still works without it.
              </div>
              <div className="flex gap-2">
                <a
                  href="/link/school-google"
                  className="flex-1 px-4 py-2.5 bg-[--color-accent] hover:bg-[--color-accent-hover] text-[#0c0a09] text-sm font-medium rounded-lg transition-colors text-center"
                >
                  Try Again
                </a>
                <button
                  onClick={handleSkipSchool}
                  className="flex-1 px-4 py-2.5 border border-[--color-border-hover] text-[--color-text-secondary] hover:text-[--color-text-primary] hover:bg-white/[0.03] text-sm rounded-lg transition-colors"
                >
                  Skip
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <a
                href="/link/school-google"
                className="flex-1 px-4 py-2.5 bg-[--color-accent] hover:bg-[--color-accent-hover] text-[#0c0a09] text-sm font-medium rounded-lg transition-colors text-center"
              >
                Link School Account
              </a>
              <button
                onClick={handleSkipSchool}
                className="flex-1 px-4 py-2.5 border border-[--color-border-hover] text-[--color-text-secondary] hover:text-[--color-text-primary] hover:bg-white/[0.03] text-sm rounded-lg transition-colors"
              >
                Skip for now
              </button>
            </div>
          )}

          {schoolConnected && (
            <div className="px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
              <p className="text-emerald-300 text-xs">School account linked.</p>
              <button
                onClick={() => setStep(3)}
                className="mt-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-md transition-colors"
              >
                Continue
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step 3 — Canvas ICS URL */}
      {step === 3 && (
        <div className="bg-[--color-surface] border border-[--color-border] rounded-xl p-6 space-y-5">
          <div className="space-y-2">
            <h2 className="text-base font-medium text-[--color-text-primary]">
              Add Canvas Feed
            </h2>
            <p className="text-xs text-[--color-text-secondary] leading-relaxed">
              Paste your Canvas calendar feed URL to import assignments.
            </p>
          </div>
          <input
            type="url"
            placeholder="https://canvas.instructure.com/feeds/calendars/..."
            value={canvasUrl}
            onChange={(e) => setCanvasUrl(e.target.value)}
            className="w-full px-3 py-2.5 bg-black/30 border border-[--color-border] rounded-lg text-sm text-[--color-text-primary] placeholder-[--color-text-tertiary] focus:outline-none focus:border-[--color-accent]/50 focus:ring-1 focus:ring-[--color-accent]/20 transition-all"
          />
          {saveError && (
            <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300 text-xs">
              {saveError}
            </div>
          )}
          <button
            onClick={handleSaveCanvasUrl}
            disabled={saving || !canvasUrl.trim()}
            className="w-full px-4 py-2.5 bg-[--color-accent] hover:bg-[--color-accent-hover] disabled:opacity-40 disabled:cursor-not-allowed text-[#0c0a09] text-sm font-medium rounded-lg transition-colors"
          >
            {saving ? 'Saving\u2026' : 'Save & Continue'}
          </button>
        </div>
      )}
    </div>
  );
}
