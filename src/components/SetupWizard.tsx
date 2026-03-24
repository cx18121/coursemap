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

const CANVAS_STEPS = [
  'In Canvas, click your Account avatar (top-left corner)',
  'Go to Settings',
  'Scroll to the right sidebar — find "Calendar Feed"',
  'Click it to copy the feed URL',
];

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
  const [howToOpen, setHowToOpen] = useState(false);

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

  // Gentle URL format hint — shown only after user has typed something
  const urlLooksOff =
    canvasUrl.length > 8 &&
    !canvasUrl.startsWith('webcal://') &&
    !canvasUrl.startsWith('https://') &&
    !canvasUrl.startsWith('http://');

  return (
    <div className="w-full space-y-8">
      {/* Error banner */}
      {error === 'access_denied' && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
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
                ? 'w-2 h-2 bg-[--color-accent]/40'
                : 'w-2 h-2 bg-[--color-border]'
            }`}
          />
        ))}
      </div>

      {/* Step content — keyed so it re-mounts and animates on step change */}
      <div key={step} className="animate-fade-slide-up">

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
              className="flex items-center justify-center gap-3 w-full px-5 py-3 bg-[--color-accent] hover:bg-[--color-accent-hover] text-[--color-text-primary] text-sm font-semibold rounded-lg transition-colors shadow-sm"
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
                Imports your school Google Calendar alongside Canvas assignments. Skip this if you only use Canvas.
              </p>
            </div>

            {error === 'school_access_denied' && (
              <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
                Your school may have blocked this connection. Canvas assignments will still sync without it.
              </div>
            )}

            {schoolConnected ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="text-emerald-700 text-sm">School account linked successfully.</p>
                </div>
                <button
                  onClick={() => setStep(3)}
                  className="w-full px-5 py-3 bg-[--color-accent] hover:bg-[--color-accent-hover] text-[--color-text-primary] text-sm font-semibold rounded-lg transition-colors shadow-sm"
                >
                  Continue
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <a
                  href="/link/school-google"
                  className="flex items-center justify-center gap-3 w-full px-5 py-3 bg-[--color-accent] hover:bg-[--color-accent-hover] text-[--color-text-primary] text-sm font-semibold rounded-lg transition-colors shadow-sm"
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
                  className="w-full px-5 py-3 border border-[--color-border] hover:border-[--color-border-hover] hover:bg-[--color-surface-raised] text-[--color-text-secondary] hover:text-[--color-text-primary] text-sm font-medium rounded-lg transition-colors"
                >
                  Skip for now
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 3 — Canvas ICS URL */}
        {step === 3 && (
          <div className="space-y-5">
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
                placeholder="webcal://canvas.instructure.com/feeds/calendars/..."
                value={canvasUrl}
                onChange={(e) => setCanvasUrl(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-[--color-border] focus:border-[--color-accent] rounded-lg text-sm text-[--color-text-primary] placeholder-[--color-text-tertiary] focus:outline-none focus:ring-2 focus:ring-[--color-accent]/15 transition-all"
              />

              {/* Gentle format hint */}
              {urlLooksOff && (
                <p className="text-xs text-amber-600 px-1">
                  Canvas feed URLs typically start with <span className="font-mono">webcal://</span> or <span className="font-mono">https://</span>
                </p>
              )}

              {saveError && (
                <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
                  {saveError}
                </div>
              )}

              {/* How to find this — collapsible */}
              <div className="rounded-lg border border-[--color-border] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setHowToOpen((v) => !v)}
                  className="flex items-center justify-between w-full px-4 py-3 text-left hover:bg-[--color-surface-raised] transition-colors"
                >
                  <span className="text-xs font-medium text-[--color-text-secondary]">
                    Where do I find this URL?
                  </span>
                  <svg
                    className={`w-3.5 h-3.5 text-[--color-text-tertiary] transition-transform duration-200 ${howToOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                <div
                  className="grid [transition:grid-template-rows_200ms_cubic-bezier(0.22,1,0.36,1)]"
                  style={{ gridTemplateRows: howToOpen ? '1fr' : '0fr' }}
                >
                  <div className="overflow-hidden">
                    <div className="px-4 pb-4 pt-3 border-t border-[--color-border] space-y-3">
                      <ol className="space-y-2.5">
                        {CANVAS_STEPS.map((text, i) => (
                          <li key={i} className="flex items-start gap-3 text-xs text-[--color-text-secondary]">
                            <span className="flex-shrink-0 w-4 h-4 rounded-full bg-[--color-surface-raised] border border-[--color-border] text-[--color-text-tertiary] text-[10px] flex items-center justify-center font-semibold mt-px">
                              {i + 1}
                            </span>
                            {text}
                          </li>
                        ))}
                      </ol>
                      <p className="text-xs text-[--color-text-tertiary] pt-0.5">
                        The URL begins with{' '}
                        <code className="font-mono bg-[--color-surface-raised] border border-[--color-border] px-1 py-px rounded text-[11px]">webcal://</code>
                        {' '}or{' '}
                        <code className="font-mono bg-[--color-surface-raised] border border-[--color-border] px-1 py-px rounded text-[11px]">https://</code>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={handleSaveCanvasUrl}
                disabled={saving || !canvasUrl.trim()}
                className="w-full px-5 py-3 bg-[--color-accent] hover:bg-[--color-accent-hover] disabled:opacity-40 disabled:cursor-not-allowed text-[--color-text-primary] text-sm font-semibold rounded-lg transition-colors shadow-sm"
              >
                {saving ? 'Saving…' : 'Finish Setup'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
