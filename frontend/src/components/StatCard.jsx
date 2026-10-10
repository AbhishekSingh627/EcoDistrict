// Reusable stat card used on dashboards.
export default function StatCard({ label, value, unit = '', icon: Icon, color = 'green', note }) {
  const colorMap = {
    green:  { bg: 'bg-green-50',  text: 'text-green-700',  icon: 'bg-green-100 text-green-600' },
    blue:   { bg: 'bg-blue-50',   text: 'text-blue-700',   icon: 'bg-blue-100 text-blue-600' },
    amber:  { bg: 'bg-amber-50',  text: 'text-amber-700',  icon: 'bg-amber-100 text-amber-600' },
    slate:  { bg: 'bg-slate-50',  text: 'text-slate-700',  icon: 'bg-slate-100 text-slate-600' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-700', icon: 'bg-purple-100 text-purple-600' },
  }
  const c = colorMap[color] || colorMap.green

  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-5`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
          <p className={`mt-1 text-2xl font-bold ${c.text}`}>
            {value}<span className="text-base font-medium ml-1 text-slate-500">{unit}</span>
          </p>
          {note && <p className="mt-1 text-xs text-slate-400">{note}</p>}
        </div>
        {Icon && (
          <div className={`p-2 rounded-lg ${c.icon}`}>
            <Icon size={20} />
          </div>
        )}
      </div>
    </div>
  )
}
