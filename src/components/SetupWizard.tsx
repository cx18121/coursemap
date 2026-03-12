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

  const handleSkipSchool = () => {
    setStep(3);
  };

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
        setSaveError(result.error ?? 'Failed to save URL. Please try again.');
        return;
      }

      router.push('/dashboard');
    } catch {
      setSaveError('Network error. Please check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Global error banner (e.g. access_denied) */}
      {error === 'access_denied' && (
        <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200 text-sm">
          Something went wrong connecting your account. Please try again.
        </div>
      )}

      {/* Progress Bar */}
      <div className="space-y-2">
        <p className="text-white/50 text-sm text-center">Step {step} of 3</p>
        <div className="flex gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`flex-1 h-1.5 rounded-full transition-colors ${
                s <= step ? 'bg-indigo-500' : 'bg-white/10'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Step 1 — Connect Personal Google */}
      {step === 1 && (
        <div className="bg-white/10 p-6 rounded-2xl backdrop-blur-lg border border-white/20 shadow-xl space-y-4">
          <h2 className="text-xl font-medium text-white">
            1. Connect Your Google Account
          </h2>
          <p className="text-white/60 text-sm">
            Sign in with your personal Google account to sync your calendars.
          </p>
          <a
            href="/login/google"
            className="block w-full px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-colors shadow-lg shadow-indigo-500/30 text-center"
          >
            Sign in with Google
          </a>
        </div>
      )}

      {/* Step 2 — Link School Google (optional) */}
      {step === 2 && (
        <div className="bg-white/10 p-6 rounded-2xl backdrop-blur-lg border border-white/20 shadow-xl space-y-4">
          <h2 className="text-xl font-medium text-white">
            2. Link School Google Account
          </h2>
          <p className="text-white/60 text-sm">
            Connect your school Google account to mirror your school calendar.
            This is optional — you can add it later.
          </p>

          {error === 'school_access_denied' ? (
            <div className="space-y-4">
              <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200 text-sm">
                Your school may restrict third-party app access. Canvas ICS sync
                still works without your school account.
              </div>
              <div className="flex gap-3">
                <a
                  href="/link/school-google"
                  className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-colors text-center text-sm"
                >
                  Try Again
                </a>
                <button
                  onClick={handleSkipSchool}
                  className="flex-1 px-4 py-3 bg-white/10 hover:bg-white/20 text-white/70 font-medium rounded-xl transition-colors text-sm"
                >
                  Skip for Now
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-3">
              <a
                href="/link/school-google"
                className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-colors text-center"
              >
                Link School Account
              </a>
              <button
                onClick={handleSkipSchool}
                className="flex-1 px-4 py-3 bg-white/10 hover:bg-white/20 text-white/70 font-medium rounded-xl transition-colors"
              >
                Skip for now
              </button>
            </div>
          )}

          {schoolConnected && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
              <p className="text-emerald-200 text-sm">
                School account already linked. You can continue to the next step.
              </p>
              <button
                onClick={() => setStep(3)}
                className="mt-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-xl transition-colors"
              >
                Continue
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step 3 — Canvas ICS URL */}
      {step === 3 && (
        <div className="bg-white/10 p-6 rounded-2xl backdrop-blur-lg border border-white/20 shadow-xl space-y-4">
          <h2 className="text-xl font-medium text-white">
            3. Add Canvas Feed
          </h2>
          <p className="text-white/60 text-sm">
            Paste your Canvas calendar feed URL to import your assignments.
          </p>
          <input
            type="url"
            placeholder="https://canvas.instructure.com/feeds/calendars/..."
            value={canvasUrl}
            onChange={(e) => setCanvasUrl(e.target.value)}
            className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          />
          {saveError && (
            <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200 text-sm">
              {saveError}
            </div>
          )}
          <button
            onClick={handleSaveCanvasUrl}
            disabled={saving || !canvasUrl.trim()}
            className="w-full px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-xl transition-colors shadow-lg shadow-indigo-500/30"
          >
            {saving ? 'Saving...' : 'Save & Continue'}
          </button>
        </div>
      )}
    </div>
  );
}
