'use client';

import { useState, useEffect } from 'react';
import { Review } from '@/lib/api';

interface Props {
  review: Review | null;
  onClose: () => void;
  onSubmit: (reviewId: number, replyText: string) => Promise<void>;
}

export default function ReplyModal({ review, onClose, onSubmit }: Props) {
  const [text, setText]       = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => {
    if (review) { setText(review.reply_text || ''); setError(''); }
  }, [review]);

  if (!review) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setLoading(true);
    setError('');
    try {
      await onSubmit(review.id, text.trim());
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'envoi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Sheet */}
      <div className="relative bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-3xl shadow-modal flex flex-col max-h-[90vh]">
        {/* Handle bar (mobile) */}
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-1 sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">
              {review.reply_text ? 'Modifier la réponse' : 'Répondre à l\'avis'}
            </h2>
            <div className="flex gap-0.5 mt-1">
              {[1,2,3,4,5].map(s => (
                <svg key={s} className={`w-3 h-3 ${s <= (review.star_rating ?? 0) ? 'text-star' : 'text-gray-200'}`} fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                </svg>
              ))}
              <span className="text-xs text-gray-400 ml-1">{review.reviewer_name}</span>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Avis original */}
        {review.comment && (
          <div className="mx-5 mt-4 bg-gray-50 rounded-xl p-3.5">
            <p className="text-sm text-gray-600 leading-relaxed line-clamp-3">{review.comment}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 flex-1 overflow-y-auto">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Votre réponse
            </label>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={5}
              placeholder="Merci pour votre avis ! Nous sommes ravis de…"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/40 resize-none transition"
              required
            />
            <div className="flex justify-between mt-1">
              <span className={`text-xs ${text.length > 3800 ? 'text-red-500' : 'text-gray-400'}`}>{text.length}/4096</span>
              {text.length > 0 && (
                <button type="button" onClick={() => setText('')} className="text-xs text-gray-400 hover:text-gray-600">
                  Effacer
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-600">{error}</div>
          )}

          {/* Buttons */}
          <div className="flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">
              Annuler
            </button>
            <button type="submit" disabled={loading || !text.trim()}
              className="flex-1 py-3 bg-primary hover:bg-primary-hover disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition">
              {loading ? 'Publication…' : 'Publier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
