'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001/api';

const BUSINESS_TYPES = [
  {
    id: 'single',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 9.75L12 3l9 6.75V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.75z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 21V12h6v9" />
      </svg>
    ),
    label: 'Single Business',
    desc: 'I manage a single business location',
  },
  {
    id: 'multi',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-6 h-6">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
    label: 'Multiple Locations',
    desc: 'I manage multiple business locations',
  },
  {
    id: 'agency',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-6 h-6">
        <circle cx="12" cy="8" r="4" />
        <path strokeLinecap="round" d="M4 20c0-3.314 3.582-6 8-6s8 2.686 8 6" />
      </svg>
    ),
    label: 'Agency',
    desc: "I'm an agency managing businesses for clients",
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1); // 1 = business type, 2 = connect
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (localStorage.getItem('happi_token')) router.push('/dashboard');
  }, [router]);

  const totalSteps = 2;
  const progress = (step / totalSteps) * 100;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-5 py-4 flex items-center justify-center">
        <span className="font-bold text-gray-900 text-base">Happi Reviews</span>
      </header>

      {/* Progress bar */}
      <div className="h-1.5 bg-gray-200">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col px-4 pt-8 pb-28 max-w-lg mx-auto w-full">

        {step === 1 && (
          <div className="animate-slide-up space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 leading-tight">
                Tell us about your business
              </h1>
              <p className="text-gray-500 mt-1.5 text-sm">
                This helps us personalize your experience
              </p>
            </div>

            <div className="space-y-3">
              {BUSINESS_TYPES.map((bt) => (
                <button
                  key={bt.id}
                  onClick={() => setSelected(bt.id)}
                  className={`w-full flex items-center gap-4 bg-white rounded-2xl border px-5 py-4 text-left transition-all ${
                    selected === bt.id
                      ? 'border-primary shadow-md border-2'
                      : 'border-gray-200 shadow-card hover:border-gray-300'
                  }`}
                >
                  <span className={`shrink-0 ${selected === bt.id ? 'text-primary' : 'text-primary'}`}>
                    {bt.icon}
                  </span>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{bt.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{bt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="animate-slide-up space-y-6">
            {/* Unlock card */}
            <div className="bg-primary-light border border-primary-border rounded-2xl p-6 text-center shadow-card">
              <div className="w-14 h-14 bg-primary-soft rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                    d="M5 3l14 9-14 9V3z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900 leading-snug">
                Let&apos;s unlock your metrics!
              </h2>
              <p className="text-gray-500 text-sm mt-2 leading-relaxed">
                Connect your Google Business profile with your Happi Reviews account to
              </p>
              <div className="mt-4 space-y-2.5 text-left">
                {[
                  'Sync your Google reviews',
                  'Follow your business performance',
                  'Save time with auto-replies',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full bg-primary-soft border border-primary-border flex items-center justify-center shrink-0">
                      <svg className="w-3 h-3 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                    <span className="text-sm text-gray-700">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Connect button */}
            <button
              onClick={() => (window.location.href = `${API_URL}/auth/login`)}
              className="w-full flex items-center justify-center gap-3 bg-white border border-gray-200 rounded-2xl px-5 py-3.5 font-semibold text-gray-800 text-sm shadow-card hover:shadow-card-md transition-all"
            >
              <GoogleIcon />
              Connect to Google
            </button>
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-4 max-w-lg mx-auto">
        {step === 1 ? (
          <button
            onClick={() => selected && setStep(2)}
            disabled={!selected}
            className={`w-full py-3.5 rounded-2xl font-semibold text-sm transition-all ${
              selected
                ? 'bg-primary hover:bg-primary-hover text-white shadow-md'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            Continue
          </button>
        ) : (
          <button
            onClick={() => setStep(1)}
            className="w-full py-3.5 rounded-2xl font-semibold text-sm text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all"
          >
            ← Back
          </button>
        )}
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}
