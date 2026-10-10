// Home page — EcoDistrict landing/hub page.
import { Link } from 'react-router-dom'
import {
  ScanLine,
  Map,
  BarChart2,
  LayoutDashboard,
  Recycle,
  Camera,
  MapPin,
  TrendingUp,
  ChevronRight,
  Cpu,
  Globe,
  CheckCircle2,
} from 'lucide-react'

// ── How it works steps ────────────────────────────────────────────────────────
const HOW_IT_WORKS = [
  {
    step: '01',
    icon: Camera,
    title: 'Identify',
    description:
      'Photograph any waste item. Google Gemini classifies it into one of 10 waste categories — plastic, paper, e-waste, organic, and more — with a local TFLite model as an offline fallback.',
    accentIcon: 'bg-emerald-100 text-emerald-600',
    accentStep: 'text-emerald-200',
  },
  {
    step: '02',
    icon: MapPin,
    title: 'Dispose Correctly',
    description:
      'Get instant disposal guidance: which bin, which recycling stream, or which specialist facility. Then locate the nearest verified drop-off point on the live map.',
    accentIcon: 'bg-blue-100 text-blue-600',
    accentStep: 'text-blue-200',
  },
  {
    step: '03',
    icon: TrendingUp,
    title: 'Track Impact',
    description:
      'Log your disposals to build a personal recycling record. District-level dashboards aggregate this into waste-stream analytics that support responsible consumption goals.',
    accentIcon: 'bg-violet-100 text-violet-600',
    accentStep: 'text-violet-200',
  },
]

// ── Platform capability tiles ─────────────────────────────────────────────────
const CAPABILITIES = [
  {
    icon: Cpu,
    label: 'Gemini + TFLite',
    detail: '10-class waste classifier',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
  },
  {
    icon: Globe,
    label: 'OpenStreetMap',
    detail: 'Live disposal-point finder',
    color: 'text-sky-600',
    bg: 'bg-sky-50',
    border: 'border-sky-200',
  },
  {
    icon: BarChart2,
    label: 'Impact Tracking',
    detail: 'Personal recycling analytics',
    color: 'text-violet-600',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
  },
  {
    icon: Recycle,
    label: 'SDG 12 Aligned',
    detail: 'Responsible consumption',
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
  },
]

// ── Quick action cards ─────────────────────────────────────────────────────────
const ACTIONS = [
  {
    to: '/scan',
    icon: ScanLine,
    title: 'Identify & Dispose',
    description:
      'Photograph any waste item. Gemini AI classifies it into the correct category and tells you exactly which bin or facility to use.',
    accent: 'emerald',
    primary: true,
  },
  {
    to: '/map',
    icon: Map,
    title: 'Find Nearby Facilities',
    description:
      'Use your GPS location to find the nearest recycling centre, e-waste drop-off, composting point, or scrap dealer — powered by OpenStreetMap.',
    accent: 'sky',
    primary: false,
  },
  {
    to: '/impact',
    icon: BarChart2,
    title: 'My Impact',
    description:
      'Build a personal waste log from your scans. Track how much you recycle, which categories you produce most, and your improvement over time.',
    accent: 'violet',
    primary: false,
  },
  {
    to: '/district',
    icon: LayoutDashboard,
    title: 'District Overview',
    description:
      'Aggregate waste-stream analytics, category breakdowns, facility coverage, and issue tracking across the district.',
    accent: 'amber',
    primary: false,
  },
]

const ACCENT = {
  emerald: {
    iconBg: 'bg-emerald-100',
    iconText: 'text-emerald-600',
    border: 'border-emerald-200',
    hoverBg: 'hover:bg-emerald-50/60',
    link: 'text-emerald-700 group-hover:text-emerald-900',
    ring: 'focus-visible:ring-emerald-400',
    dot: 'bg-emerald-500',
  },
  sky: {
    iconBg: 'bg-sky-100',
    iconText: 'text-sky-600',
    border: 'border-sky-200',
    hoverBg: 'hover:bg-sky-50/60',
    link: 'text-sky-700 group-hover:text-sky-900',
    ring: 'focus-visible:ring-sky-400',
    dot: 'bg-sky-500',
  },
  violet: {
    iconBg: 'bg-violet-100',
    iconText: 'text-violet-600',
    border: 'border-violet-200',
    hoverBg: 'hover:bg-violet-50/60',
    link: 'text-violet-700 group-hover:text-violet-900',
    ring: 'focus-visible:ring-violet-400',
    dot: 'bg-violet-500',
  },
  amber: {
    iconBg: 'bg-amber-100',
    iconText: 'text-amber-600',
    border: 'border-amber-200',
    hoverBg: 'hover:bg-amber-50/60',
    link: 'text-amber-700 group-hover:text-amber-900',
    ring: 'focus-visible:ring-amber-400',
    dot: 'bg-amber-500',
  },
}

// ── Section heading helper ─────────────────────────────────────────────────────
function SectionHeading({ title, aside }) {
  return (
    <div className="flex items-center justify-between mb-5">
      <h2 className="text-lg font-bold text-slate-800 tracking-tight">{title}</h2>
      {aside && <span className="text-xs text-slate-400 font-medium">{aside}</span>}
    </div>
  )
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function Home() {
  return (
    <div className="min-h-full bg-slate-50">

      {/* ════════════════════════════════════════════════════════════════════════
          HERO
      ════════════════════════════════════════════════════════════════════════ */}
      <div
        className="relative overflow-hidden"
        style={{
          background:
            'linear-gradient(145deg, #031a0e 0%, #052e16 25%, #14532d 55%, #166534 80%, #197a3e 100%)',
        }}
      >
        {/* Decorative rings — aria-hidden so screen readers skip them */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          {/* Large radial glow — top-right */}
          <div
            className="absolute rounded-full"
            style={{
              width: 640,
              height: 640,
              background:
                'radial-gradient(circle at 60% 40%, rgba(74,222,128,0.13) 0%, transparent 70%)',
              top: -220,
              right: -160,
            }}
          />
          {/* Small accent glow — bottom-left */}
          <div
            className="absolute rounded-full"
            style={{
              width: 360,
              height: 360,
              background:
                'radial-gradient(circle, rgba(134,239,172,0.07) 0%, transparent 70%)',
              bottom: -80,
              left: -60,
            }}
          />
          {/* Fine grid overlay */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                'repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(255,255,255,1) 39px, rgba(255,255,255,1) 40px), repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(255,255,255,1) 39px, rgba(255,255,255,1) 40px)',
            }}
          />
        </div>

        <div className="relative px-6 pt-10 pb-12 max-w-5xl mx-auto">

          {/* ── SDG badge ───────────────────────────────────────────────────── */}
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1 text-xs font-semibold text-emerald-200 mb-7 backdrop-blur-sm">
            <Recycle size={12} aria-hidden="true" />
            SDG 12 · Responsible Consumption &amp; Production
          </div>

          {/* ── Two-column layout ───────────────────────────────────────────── */}
          <div className="flex flex-col lg:flex-row lg:items-start lg:gap-14">

            {/* Left — headline + description + CTAs */}
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl sm:text-[2.6rem] font-extrabold text-white leading-[1.15] tracking-tight mb-4">
                Build a Cleaner,{' '}
                <span className="text-emerald-300">More Circular</span>
                <br className="hidden sm:block" /> District.
              </h1>

              <p className="text-[0.925rem] leading-relaxed text-green-100/85 max-w-[480px] mb-7">
                EcoDistrict combines AI-powered waste classification, live disposal-point
                discovery, and district-level sustainability monitoring — giving communities
                actionable tools to close the recycling loop.
              </p>

              {/* Primary + secondary CTAs */}
              <div className="flex flex-wrap gap-3">
                <Link
                  to="/scan"
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-400 hover:bg-emerald-300 active:bg-emerald-500 text-emerald-950 font-bold px-5 py-2.5 text-sm transition-colors duration-150 shadow-lg shadow-black/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-300 motion-safe:hover:scale-[1.02] motion-safe:active:scale-[0.98]"
                >
                  <ScanLine size={16} aria-hidden="true" />
                  Scan Your Waste
                </Link>
                <Link
                  to="/map"
                  className="inline-flex items-center gap-2 rounded-lg border border-white/25 bg-white/10 hover:bg-white/18 active:bg-white/25 text-white font-semibold px-5 py-2.5 text-sm transition-colors duration-150 backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white/50"
                  style={{ '--tw-bg-opacity': 1 }}
                >
                  <Map size={16} aria-hidden="true" />
                  Explore Waste Map
                </Link>
              </div>
            </div>

            {/* Right — Scan → Sort → Recycle workflow panel */}
            <div className="mt-9 lg:mt-1 lg:w-60 shrink-0">
              <div
                className="rounded-2xl border border-white/12 p-5 space-y-1"
                style={{ background: 'rgba(255,255,255,0.075)' }}
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-300 mb-4">
                  How it works
                </p>
                {[
                  { label: 'Identify',  sub: 'Photograph the item',        icon: Camera  },
                  { label: 'Dispose',   sub: 'AI finds the right stream',   icon: Cpu     },
                  { label: 'Track',     sub: 'Log and measure impact',      icon: Recycle },
                ].map(({ label, sub, icon: Icon }, idx, arr) => (
                  <div key={label}>
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-emerald-300 ring-1 ring-white/10">
                        <Icon size={15} aria-hidden="true" />
                      </div>
                      <div>
                        <p className="text-[0.8125rem] font-semibold text-white leading-tight">{label}</p>
                        <p className="text-[11px] text-green-200/65 leading-tight mt-0.5">{sub}</p>
                      </div>
                    </div>
                    {idx < arr.length - 1 && (
                      <div className="ml-[15px] my-2 flex items-center gap-1" aria-hidden="true">
                        <div className="w-px h-5 bg-white/15" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          CAPABILITY TILES
      ════════════════════════════════════════════════════════════════════════ */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {CAPABILITIES.map(({ icon: Icon, label, detail, color, bg, border }) => (
              <div
                key={label}
                className={`flex items-center gap-3 rounded-xl border ${border} ${bg} px-4 py-3`}
              >
                <div className={`shrink-0 ${color}`} aria-hidden="true">
                  <Icon size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-700 truncate leading-tight">{label}</p>
                  <p className="text-[11px] text-slate-400 truncate leading-tight mt-0.5">{detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          BODY SECTIONS
      ════════════════════════════════════════════════════════════════════════ */}
      <div className="max-w-5xl mx-auto px-6 py-9 space-y-12">

        {/* ── Quick Actions ─────────────────────────────────────────────────── */}
        <section aria-labelledby="quick-actions-heading">
          <SectionHeading id="quick-actions-heading" title="Quick Actions" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {ACTIONS.map(({ to, icon: Icon, title, description, accent, primary }) => {
              const c = ACCENT[accent]
              return (
                <Link
                  key={to}
                  to={to}
                  className={[
                    'group relative flex flex-col rounded-2xl border bg-white p-6',
                    'motion-safe:transition-all motion-safe:duration-200',
                    'hover:shadow-lg motion-safe:hover:-translate-y-0.5',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                    c.ring,
                    c.hoverBg,
                    primary
                      ? 'border-emerald-300 shadow-sm shadow-emerald-100 ring-1 ring-emerald-200/60'
                      : c.border,
                  ].join(' ')}
                >
                  {/* Primary badge */}
                  {primary && (
                    <span className="absolute top-4 right-4 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-bold text-white tracking-wide uppercase">
                      <span className="w-1 h-1 rounded-full bg-emerald-200 inline-block" aria-hidden="true" />
                      Primary
                    </span>
                  )}

                  {/* Icon container */}
                  <div
                    className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl ${c.iconBg} ${c.iconText} shadow-sm`}
                    aria-hidden="true"
                  >
                    <Icon size={21} />
                  </div>

                  {/* Title */}
                  <h3 className="font-bold text-slate-800 text-[0.9375rem] mb-1.5 leading-snug">
                    {title}
                  </h3>

                  {/* Description */}
                  <p className="text-slate-500 text-[0.8125rem] leading-relaxed flex-1">
                    {description}
                  </p>

                  {/* CTA link row */}
                  <div className={`mt-5 flex items-center gap-1 text-xs font-bold ${c.link}`}>
                    Get started
                    <ChevronRight
                      size={13}
                      aria-hidden="true"
                      className="motion-safe:group-hover:translate-x-0.5 motion-safe:transition-transform"
                    />
                  </div>
                </Link>
              )
            })}
          </div>
        </section>

        {/* ── How EcoDistrict Works ─────────────────────────────────────────── */}
        <section aria-labelledby="how-it-works-heading">
          <SectionHeading
            id="how-it-works-heading"
            title="How EcoDistrict Works"
            aside="Implemented & live"
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {HOW_IT_WORKS.map(({ step, icon: Icon, title, description, accentIcon, accentStep }) => (
              <div
                key={step}
                className={`relative rounded-2xl border border-slate-200 bg-white p-6 flex flex-col gap-4 overflow-hidden`}
              >
                {/* Large step number watermark */}
                <span
                  className={`absolute top-3 right-4 text-[3.5rem] font-black leading-none select-none pointer-events-none ${accentStep}`}
                  aria-hidden="true"
                >
                  {step}
                </span>

                {/* Icon */}
                <div
                  className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${accentIcon}`}
                  aria-hidden="true"
                >
                  <Icon size={21} />
                </div>

                {/* Text */}
                <div>
                  <h3 className="font-bold text-slate-800 text-[0.9375rem] mb-2 leading-snug">{title}</h3>
                  <p className="text-[0.8125rem] text-slate-500 leading-relaxed">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Project Status ────────────────────────────────────────────────── */}
        <section aria-labelledby="project-status-heading">
          <div className="flex items-center justify-between mb-5">
            <h2 id="project-status-heading" className="text-lg font-bold text-slate-800 tracking-tight">
              Project Status
            </h2>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block motion-safe:animate-pulse" aria-hidden="true" />
              Phase 1 live
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                phase: 'Phase 1 · Active',
                title: 'Foundation',
                items: [
                  'Gemini AI waste classifier',
                  'TFLite local fallback model',
                  'OpenStreetMap disposal finder',
                  'React + FastAPI platform',
                ],
                status: 'active',
              },
              {
                phase: 'Phase 2 · Planned',
                title: 'Data & Accounts',
                items: [
                  'User authentication',
                  'Persistent waste records',
                  'Live district analytics',
                  'Location management API',
                ],
                status: 'planned',
              },
              {
                phase: 'Phase 3 · Future',
                title: 'Scale & Automation',
                items: [
                  'Custom model retraining pipeline',
                  'Vehicle route optimisation',
                  'Multi-district reports',
                  'Real-time sensor integration',
                ],
                status: 'future',
              },
            ].map(({ phase, title, items, status }) => {
              const isActive  = status === 'active'
              const isPlanned = status === 'planned'
              return (
                <div
                  key={phase}
                  className={[
                    'rounded-2xl border p-5',
                    isActive
                      ? 'border-emerald-300 bg-gradient-to-br from-emerald-50 to-emerald-50/40 shadow-sm shadow-emerald-100'
                      : isPlanned
                      ? 'border-blue-200 bg-blue-50/30'
                      : 'border-slate-200 bg-slate-50/60',
                  ].join(' ')}
                >
                  {/* Phase label */}
                  <span
                    className={`text-[10px] font-bold uppercase tracking-widest ${
                      isActive ? 'text-emerald-600' : isPlanned ? 'text-blue-500' : 'text-slate-400'
                    }`}
                  >
                    {phase}
                  </span>

                  {/* Card title */}
                  <p className="font-bold text-slate-800 text-[0.9375rem] mt-1.5 mb-4 leading-snug">{title}</p>

                  {/* Item list */}
                  <ul className="space-y-2">
                    {items.map(item => (
                      <li key={item} className="flex items-start gap-2.5 text-[0.8125rem] text-slate-600">
                        {isActive ? (
                          <CheckCircle2
                            size={14}
                            className="shrink-0 mt-0.5 text-emerald-500"
                            aria-hidden="true"
                          />
                        ) : (
                          <span
                            className={`mt-[5px] w-1.5 h-1.5 shrink-0 rounded-full ${
                              isPlanned ? 'bg-blue-300' : 'bg-slate-300'
                            }`}
                            aria-hidden="true"
                          />
                        )}
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>

          {/* Sample data disclosure — preserved exactly */}
          <p className="mt-4 text-[0.75rem] text-slate-400 leading-relaxed">
            Phase 2 &amp; 3 items are planned features, not yet implemented.
            All data shown in the District Dashboard is sample/demo data.
          </p>
        </section>

      </div>
    </div>
  )
}
