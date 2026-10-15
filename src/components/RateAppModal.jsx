import React, { useState } from 'react'
import { Star, X, Heart, Share2, Check, Smartphone } from 'lucide-react'

export function RateAppModal({ isOpen, onClose }) {
  const [rating, setRating] = useState(5)
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false)

  if (!isOpen) return null

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'KamalScan - 100% Client-Side HD Document Scanner & Study Viewer',
          text: 'Check out KamalScan! Scan, crop, OCR, and study documents completely offline with zero server uploads.',
          url: window.location.href,
        })
      } catch (err) {
        console.log('Share canceled or not supported', err)
      }
    } else {
      navigator.clipboard.writeText(window.location.href)
      alert('KamalScan link copied to clipboard!')
    }
  }

  const handleRatePlayStore = () => {
    // Open Google Play store link if available, or confirm rating
    setFeedbackSubmitted(true)
    setTimeout(() => {
      onClose()
    }, 1800)
  }

  return (
    <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-3xl w-full max-w-sm shadow-2xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col items-center text-center relative animate-slide-in">
        
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-xl cursor-pointer"
        >
          <X size={18} />
        </button>

        <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-500 border border-amber-200 dark:border-amber-800 flex items-center justify-center shadow-lg mb-3">
          <Heart size={28} className="fill-amber-400 text-amber-500 animate-pulse" />
        </div>

        <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-1">
          Enjoying KamalScan?
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 max-w-xs">
          Your support helps us reach students &amp; professionals worldwide with 100% private, offline document scanning.
        </p>

        {/* 5 Stars Selector */}
        <div className="flex items-center gap-1.5 mb-5">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setRating(star)}
              className="p-1 cursor-pointer transition-transform hover:scale-120"
              title={`${star} Star`}
            >
              <Star
                size={28}
                className={
                  star <= rating
                    ? 'text-amber-400 fill-amber-400 drop-shadow-sm'
                    : 'text-slate-300 dark:text-slate-700'
                }
              />
            </button>
          ))}
        </div>

        {feedbackSubmitted ? (
          <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 text-xs font-bold flex items-center gap-2">
            <Check size={16} /> Thank you so much for your 5-star support!
          </div>
        ) : (
          <div className="w-full space-y-2">
            <button
              onClick={handleRatePlayStore}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-98 cursor-pointer"
            >
              <Star size={15} className="fill-white" /> Submit 5-Star Rating
            </button>

            <button
              onClick={handleShare}
              className="w-full py-2 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Share2 size={14} /> Share KamalScan App
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
