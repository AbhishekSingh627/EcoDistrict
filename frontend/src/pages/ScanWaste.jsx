import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Upload, Camera, X, CheckCircle, Loader, AlertCircle, AlertTriangle, MapPin } from 'lucide-react'

// ── Disposal guidance per waste category ──────────────────────────────────────
// 6 of 10 model classes have specific guidance; the other 4 use the generic fallback.
const CATEGORY_INFO = {
  battery: {
    label: 'Battery',
    disposal_type: 'Hazardous Waste',
    explanation:
      'Do not dispose of batteries in general waste. Take them to a designated battery collection point or e-waste facility.',
    color: 'bg-red-50 border-red-200 text-red-900',
    badge: 'bg-red-100 text-red-700',
  },
  biological: {
    label: 'Biological / Organic',
    disposal_type: 'Wet Waste / Composting',
    explanation:
      'Place food scraps and organic matter in the wet waste or compost bin. Keep separate from dry recyclables.',
    color: 'bg-lime-50 border-lime-200 text-lime-900',
    badge: 'bg-lime-100 text-lime-700',
  },
  cardboard: {
    label: 'Cardboard',
    disposal_type: 'Paper Recycling',
    explanation:
      'Flatten clean cardboard and keep it dry. Remove excess tape or non-paper material before recycling.',
    color: 'bg-amber-50 border-amber-200 text-amber-900',
    badge: 'bg-amber-100 text-amber-700',
  },
  clothes: {
    label: 'Clothing / Textiles',
    disposal_type: 'Textile Donation or Recycling',
    explanation:
      'Wearable items can be donated. Worn-out textiles should go to a dedicated textile recycling point, not general waste.',
    color: 'bg-pink-50 border-pink-200 text-pink-900',
    badge: 'bg-pink-100 text-pink-700',
  },
  glass: {
    label: 'Glass',
    disposal_type: 'Glass Recycling',
    explanation:
      'Place clean glass in the designated glass recycling collection point. Handle broken glass carefully.',
    color: 'bg-cyan-50 border-cyan-200 text-cyan-900',
    badge: 'bg-cyan-100 text-cyan-700',
  },
  metal: {
    label: 'Metal',
    disposal_type: 'Metal Recycling',
    explanation:
      'Clean metal containers and place them in the appropriate dry recycling or metal collection stream.',
    color: 'bg-slate-50 border-slate-200 text-slate-900',
    badge: 'bg-slate-100 text-slate-700',
  },
  paper: {
    label: 'Paper',
    disposal_type: 'Paper Recycling',
    explanation:
      'Keep paper clean and dry and place it in the paper recycling stream. Heavily soiled paper may need to go in general waste.',
    color: 'bg-yellow-50 border-yellow-200 text-yellow-900',
    badge: 'bg-yellow-100 text-yellow-700',
  },
  plastic: {
    label: 'Plastic',
    disposal_type: 'Dry Recycling',
    explanation:
      'Rinse plastic packaging where possible and place it in the dry recycling stream. Remove food residue first.',
    color: 'bg-blue-50 border-blue-200 text-blue-900',
    badge: 'bg-blue-100 text-blue-700',
  },
  shoes: {
    label: 'Footwear',
    disposal_type: 'Textile Donation or Recycling',
    explanation:
      'Wearable shoes can be donated. Worn-out footwear should go to a textile or material recycling point.',
    color: 'bg-orange-50 border-orange-200 text-orange-900',
    badge: 'bg-orange-100 text-orange-700',
  },
  trash: {
    label: 'General Waste',
    disposal_type: 'General Waste',
    explanation:
      'This item does not appear to fit a specific recycling stream. Dispose of it according to your local general waste collection rules.',
    color: 'bg-stone-50 border-stone-200 text-stone-900',
    badge: 'bg-stone-100 text-stone-700',
  },
}

const VALID_CATEGORIES = new Set([
  'battery','biological','cardboard','clothes','glass',
  'metal','paper','plastic','shoes','trash',
])

const GENERIC_CATEGORY_INFO = {
  label: null,
  disposal_type: 'Check local waste guidelines',
  explanation: 'Dispose of this item according to your local waste collection rules.',
  color: 'bg-slate-50 border-slate-200 text-slate-900',
  badge: 'bg-slate-100 text-slate-700',
}

/**
 * Map a gemini_error code to a short, user-safe fallback message.
 * Never exposes raw error text, API names, or quota values.
 */
function fallbackMessage(geminiError) {
  switch (geminiError) {
    case 'rate_limited':
      return 'AI classifier quota reached for today. Showing local model result.'
    case 'timeout':
      return 'AI classifier timed out. Showing local model result.'
    case 'invalid_response':
      return 'AI classifier returned an unexpected response. Showing local model result.'
    case 'image_too_large':
      return 'Image too large for AI classifier. Showing local model result.'
    case 'api_error':
    default:
      return 'AI classifier temporarily unavailable. Showing local model result.'
  }
}

/**
 * Derive what the unified card should show from the /api/ai/scan response.
 *
 * primary_source === "gemini":
 *   Gemini returned is_waste=true and a valid category → use gemini.category.
 *
 * primary_source === "model":
 *   Gemini was absent, failed, or returned is_waste=false → use model_category.
 *   Show used_fallback notice only when Gemini WAS configured but failed
 *   (not when the key is simply absent — that is silent and expected).
 */
function deriveDisplayResult(data) {
  const gemini = data.gemini ?? null

  // ── Gemini-not-waste: valid response, image is not waste ──────────────────
  if (gemini !== null && !gemini.is_waste) {
    return {
      noWaste: true,
      label: null,
      disposal_type: null,
      explanation: null,
      color: 'bg-slate-50 border-slate-200 text-slate-700',
      badge: null,
      used_fallback: false,
      fallback_message: null,
    }
  }

  // ── Pick the category to display ──────────────────────────────────────────
  let displayCategory
  if (data.primary_source === 'gemini' && gemini?.category && VALID_CATEGORIES.has(gemini.category)) {
    displayCategory = gemini.category
  } else {
    displayCategory = data.model_category
  }

  const info = CATEGORY_INFO[displayCategory] ?? { ...GENERIC_CATEGORY_INFO, label: displayCategory }

  // Show a fallback notice only when Gemini was configured but failed
  // (not when the key was simply never set — that is silent and expected).
  const geminiWasConfiguredButFailed =
    data.gemini_error !== null &&
    data.gemini_error !== 'not_configured' &&
    data.primary_source === 'model'

  return {
    noWaste:         false,
    label:           info.label ?? displayCategory,
    disposal_type:   info.disposal_type,
    explanation:     info.explanation,
    color:           info.color,
    badge:           info.badge,
    used_fallback:   geminiWasConfiguredButFailed,
    fallback_message: geminiWasConfiguredButFailed ? fallbackMessage(data.gemini_error) : null,
  }
}

// ── Main page component ───────────────────────────────────────────────────────
export default function ScanWaste() {
  const [image, setImage]           = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [analyzing, setAnalyzing]   = useState(false)
  const [result, setResult]         = useState(null)
  const [error, setError]           = useState(null)
  const fileRef = useRef(null)

  function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      setError('Please select a valid image file.')
      return
    }
    setError(null)
    setResult(null)
    setImage({ url: URL.createObjectURL(file), file })
  }

  function handleDrop(e) {
    e.preventDefault()
    setIsDragging(false)
    handleFile(e.dataTransfer.files[0])
  }

  async function handleAnalyze() {
    if (!image?.file) return

    setAnalyzing(true)
    setResult(null)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', image.file)

      const response = await fetch('/api/ai/scan', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || 'Analysis failed. Please try again.')
      }

      setResult(deriveDisplayResult(data))
    } catch (err) {
      setError(err.message || 'Unable to connect to the classifier. Please try again.')
    } finally {
      setAnalyzing(false)
    }
  }

  function clearImage() {
    if (image?.url) URL.revokeObjectURL(image.url)
    setImage(null)
    setResult(null)
    setError(null)
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <h1 className="text-xl font-bold text-slate-800">Scan Waste</h1>
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
          Live — AI classifier
        </span>
      </div>
      <p className="text-sm text-slate-500 mb-5">
        Upload or photograph any waste item. Gemini AI identifies the category and tells you exactly how to dispose of it.
      </p>

      {/* ── Upload zone ─────────────────────────────────────────────────────── */}
      {!image ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`
            cursor-pointer rounded-xl border-2 border-dashed p-12 text-center transition-colors
            ${isDragging
              ? 'border-green-400 bg-green-50'
              : 'border-slate-300 bg-white hover:border-green-400 hover:bg-green-50'
            }
          `}
        >
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
              <Upload size={28} />
            </div>
            <div>
              <p className="font-medium text-slate-600">Drag &amp; drop an image here</p>
              <p className="text-sm mt-1">or click to browse your files</p>
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <Camera size={12} />
                Camera capture supported
              </span>
              <span>JPG, PNG, WEBP</span>
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handleFile(e.target.files[0])}
          />
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="relative">
            <img
              src={image.url}
              alt="Selected waste item"
              className="w-full max-h-72 object-contain bg-slate-100"
            />
            <button
              onClick={clearImage}
              aria-label="Remove image"
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
            >
              <X size={16} />
            </button>
          </div>
          <div className="p-5">
            <p className="text-sm text-slate-600 mb-4 truncate">
              File: <span className="font-medium">{image.file.name}</span>
            </p>
            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-semibold text-sm transition-colors"
            >
              {analyzing ? (
                <>
                  <Loader size={16} className="animate-spin" />
                  Analyzing…
                </>
              ) : (
                'Analyze Waste'
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Error ───────────────────────────────────────────────────────────── */}
      {error && (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 text-red-800 p-4 flex items-start gap-3">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm">Unable to analyse image</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* ── Unified result card ──────────────────────────────────────────────── */}
      {result && result.noWaste ? (
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5">
          <div className="flex items-center gap-2 mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <CheckCircle size={13} />
            Waste Analysis Result
          </div>
          <div className="flex items-center gap-3">
            <AlertCircle size={20} className="shrink-0 text-slate-400" />
            <h2 className="text-lg font-bold text-slate-700">No waste item detected</h2>
          </div>
          <p className="mt-3 text-sm text-slate-500 leading-relaxed">
            The image does not appear to contain a recognisable waste item.
            Please upload a clear photo of a single waste item.
          </p>
        </div>
      ) : result ? (
        <div className={`mt-6 rounded-xl border p-5 ${result.color}`}>

          {/* Header */}
          <div className="flex items-center gap-2 mb-4 text-xs font-semibold uppercase tracking-wide opacity-60">
            <CheckCircle size={13} />
            Waste Analysis Result
          </div>

          {/* Category */}
          <div className="flex items-center gap-3 mb-5">
            <CheckCircle size={20} className="shrink-0" />
            <h2 className="text-lg font-bold capitalize">{result.label}</h2>
          </div>

          {/* Fallback notice — only when AI was configured but failed */}
          {result.used_fallback && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5">
              <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 leading-relaxed">
                {result.fallback_message}
              </p>
            </div>
          )}

          {/* Disposal guidance */}
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide opacity-60 mb-1">
                Recommended Disposal
              </p>
              <p className="font-semibold">{result.disposal_type}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide opacity-60 mb-1">
                Guidance
              </p>
              <p className="leading-relaxed opacity-90">{result.explanation}</p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Find disposal point CTA — shown after any successful scan result */}
      {result && !result.noWaste && (
        <div className="mt-4 flex items-center gap-2 p-4 rounded-xl border border-slate-200 bg-white">
          <MapPin size={16} className="text-sky-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-700">Know where to take it?</p>
            <p className="text-xs text-slate-400">Find the nearest disposal point on the live map.</p>
          </div>
          <Link
            to="/map"
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold transition-colors"
          >
            Open Map
          </Link>
        </div>
      )}
    </div>
  )
}
