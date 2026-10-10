// Banner shown above any section that uses sample/mock data.
// Always visible so users know the data is not real.
export default function DemoBanner({ message }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm mb-4">
      <span className="text-amber-500 font-bold">⚠</span>
      <span>{message || 'Sample data — not real district data. Backend connection coming in Phase 2.'}</span>
    </div>
  )
}
