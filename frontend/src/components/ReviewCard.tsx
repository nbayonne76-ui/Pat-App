'use client';

import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import Image from 'next/image';
import { useState } from 'react';
import { Review } from '@/lib/api';

interface Props {
  review: Review;
  onReply: (review: Review) => void;
  onDeleteReply: (review: Review) => void;
}

export default function ReviewCard({ review, onReply, onDeleteReply }: Props) {
  const [expanded, setExpanded] = useState(false);
  const isLong = (review.comment?.length || 0) > 160;
  const displayComment = isLong && !expanded ? review.comment!.slice(0, 160) + '…' : review.comment;

  const date = review.create_time
    ? format(new Date(review.create_time), 'd MMM yyyy', { locale: fr })
    : '';

  const initials = review.reviewer_name
    ?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-card p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start gap-3">
        {review.reviewer_photo ? (
          <Image src={review.reviewer_photo} alt={review.reviewer_name || ''} width={40} height={40} className="rounded-full shrink-0" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-primary-soft border border-primary-border flex items-center justify-center text-primary text-sm font-bold shrink-0">
            {initials}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="font-semibold text-gray-900 text-sm truncate">{review.reviewer_name || 'Anonyme'}</span>
            <span className="text-xs text-gray-400 shrink-0">{date}</span>
          </div>
          {/* Stars */}
          {review.star_rating && (
            <div className="flex gap-0.5 mt-1">
              {[1,2,3,4,5].map(s => (
                <svg key={s} className={`w-3.5 h-3.5 ${s <= review.star_rating! ? 'text-star' : 'text-gray-200'}`} fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                </svg>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Comment */}
      {review.comment ? (
        <p className="text-sm text-gray-600 leading-relaxed">
          {displayComment}
          {isLong && (
            <button onClick={() => setExpanded(!expanded)} className="text-primary font-semibold ml-1 text-xs hover:underline">
              {expanded ? 'Voir moins' : 'Voir plus'}
            </button>
          )}
        </p>
      ) : (
        <p className="text-sm text-gray-400 italic">Aucun commentaire</p>
      )}

      {/* Reply section */}
      {review.reply_text ? (
        <div className="bg-primary-light border border-primary-border rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1.5">
            {/* Google G badge */}
            <div className="flex items-center gap-1.5">
              <GoogleGIcon />
              <span className="text-xs font-semibold text-gray-700">Votre réponse</span>
            </div>
            {review.reply_time && (
              <span className="text-xs text-gray-400 ml-auto">
                {format(new Date(review.reply_time), 'd MMM', { locale: fr })}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-600 leading-relaxed">{review.reply_text}</p>
        </div>
      ) : (
        <div className="border border-dashed border-gray-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
          <span className="text-xs text-gray-400">Pas encore de réponse</span>
          <button onClick={() => onReply(review)}
            className="ml-auto text-xs font-semibold text-primary hover:underline shrink-0">
            Répondre →
          </button>
        </div>
      )}

      {/* Actions */}
      {review.reply_text && (
        <div className="flex items-center gap-2 border-t border-gray-100 pt-2.5">
          <button onClick={() => onReply(review)}
            className="flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary-light hover:bg-primary-soft rounded-lg px-3 py-1.5 transition">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
            Modifier
          </button>
          <button onClick={() => onDeleteReply(review)}
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg px-3 py-1.5 transition ml-auto">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
            Supprimer
          </button>
        </div>
      )}
    </div>
  );
}

function GoogleGIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}
