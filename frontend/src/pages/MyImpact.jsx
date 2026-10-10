// My Impact page — personal sustainability dashboard with Recharts charts.
// Phase 1: clearly-labelled sample/demo data.
// Phase 2: will pull real records from /api/waste/records.
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { Recycle, TrendingUp, Package, CheckSquare } from 'lucide-react'
import StatCard from '../components/StatCard'
import DemoBanner from '../components/DemoBanner'

// ── Sample data — clearly marked, not real user data ─────────────────────────

const MONTHLY_TREND = [
  { month: 'Jan', total: 14.2, recycled: 8.1 },
  { month: 'Feb', total: 18.5, recycled: 11.4 },
  { month: 'Mar', total: 12.0, recycled: 7.8 },
  { month: 'Apr', total: 22.3, recycled: 15.6 },
  { month: 'May', total: 19.7, recycled: 13.2 },
  { month: 'Jun', total: 25.1, recycled: 18.4 },
]

const CATEGORY_BREAKDOWN = [
  { name: 'Plastic',  value: 8.4,  color: '#3b82f6' },
  { name: 'Paper',    value: 5.2,  color: '#f59e0b' },
  { name: 'Organic',  value: 6.8,  color: '#22c55e' },
  { name: 'Metal',    value: 2.1,  color: '#6b7280' },
  { name: 'Glass',    value: 1.7,  color: '#06b6d4' },
  { name: 'E-waste',  value: 0.8,  color: '#a855f7' },
]

const RECENT_RECORDS = [
  { date: '2025-06-18', category: 'Plastic',  qty: '0.8 kg', method: 'Dry Recycling' },
  { date: '2025-06-15', category: 'Organic',  qty: '1.2 kg', method: 'Composting' },
  { date: '2025-06-12', category: 'Paper',    qty: '2.1 kg', method: 'Paper Recycling' },
  { date: '2025-06-10', category: 'E-waste',  qty: '0.5 kg', method: 'E-Waste Centre' },
  { date: '2025-06-07', category: 'Metal',    qty: '0.9 kg', method: 'Dry Recycling' },
]

const CATEGORY_COLORS = {
  Plastic: 'bg-blue-100 text-blue-700',
  Organic: 'bg-green-100 text-green-700',
  Paper:   'bg-amber-100 text-amber-700',
  Metal:   'bg-slate-100 text-slate-700',
  Glass:   'bg-cyan-100 text-cyan-700',
  'E-waste': 'bg-purple-100 text-purple-700',
}

export default function MyImpact() {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-xl font-bold text-slate-800 mb-1">My Impact</h1>
      <p className="text-sm text-slate-500 mb-5">
        Personal sustainability tracking — log the waste you scan and monitor your recycling trend over time.
        <span className="ml-1.5 inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 font-medium">Preview Mode — sample data</span>
      </p>

      <DemoBanner message="All figures shown here are illustrative sample data, not from a real user account. Your personal records will populate automatically once user accounts are added in Phase 2." />

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Waste Logged" value="111.8" unit="kg" icon={Package}  color="slate" note="Sample value" />
        <StatCard label="Waste Recycled"      value="74.5"  unit="kg" icon={Recycle}  color="green" note="Sample value" />
        <StatCard label="Recycling Rate"      value="66.6"  unit="%"  icon={TrendingUp} color="blue" note="Sample value" />
        <StatCard label="Correct Segregation" value="81"    unit="%"  icon={CheckSquare} color="purple" note="Sample value" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        {/* Monthly trend chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-sm font-semibold text-slate-700 mb-4">Monthly Waste Trend (kg) — Sample</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={MONTHLY_TREND} barCategoryGap="30%">
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                formatter={(v, name) => [`${v} kg`, name === 'total' ? 'Total' : 'Recycled']}
              />
              <Bar dataKey="total"    fill="#cbd5e1" radius={[4, 4, 0, 0]} name="total" />
              <Bar dataKey="recycled" fill="#22c55e" radius={[4, 4, 0, 0]} name="recycled" />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-300" /> Total</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-500" /> Recycled</span>
          </div>
        </div>

        {/* Category breakdown pie */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-sm font-semibold text-slate-700 mb-4">Waste by Category (kg) — Sample</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={CATEGORY_BREAKDOWN}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={3}
                dataKey="value"
              >
                {CATEGORY_BREAKDOWN.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v, name) => [`${v} kg`, name]}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
              />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent records table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700">Recent Records — Sample</p>
          <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Sample data</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-400 uppercase tracking-wide bg-slate-50">
                <th className="text-left px-5 py-3">Date</th>
                <th className="text-left px-5 py-3">Category</th>
                <th className="text-left px-5 py-3">Quantity</th>
                <th className="text-left px-5 py-3">Disposal Method</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {RECENT_RECORDS.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3 text-slate-500">{r.date}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[r.category] || 'bg-slate-100 text-slate-600'}`}>
                      {r.category}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-medium text-slate-700">{r.qty}</td>
                  <td className="px-5 py-3 text-slate-500">{r.method}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
