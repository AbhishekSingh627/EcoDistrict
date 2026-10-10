// District Dashboard — administrative overview with sample data.
// Phase 1: sample data only.
// Phase 2: will pull from /api/analytics/summary and /api/locations.
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import {
  Trash2, Recycle, TrendingUp, MapPin, AlertTriangle,
  LayoutDashboard, CheckSquare,
} from 'lucide-react'
import StatCard from '../components/StatCard'
import DemoBanner from '../components/DemoBanner'
import { MapContainer, TileLayer, Marker, Popup, ZoomControl } from 'react-leaflet'
import { icon as LeafletIcon } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { SAMPLE_LOCATIONS, TYPE_COLORS } from '../data/sampleLocations'

// ── Sample district data — not real district data ─────────────────────────────

const MONTHLY_DISTRICT = [
  { month: 'Jan', collected: 4200, recycled: 2100 },
  { month: 'Feb', collected: 5800, recycled: 3200 },
  { month: 'Mar', collected: 5100, recycled: 2900 },
  { month: 'Apr', collected: 7200, recycled: 4400 },
  { month: 'May', collected: 6400, recycled: 3900 },
  { month: 'Jun', collected: 8100, recycled: 5200 },
]

const CATEGORY_DATA = [
  { name: 'Plastic',   value: 28, color: '#3b82f6' },
  { name: 'Organic',   value: 34, color: '#22c55e' },
  { name: 'Paper',     value: 18, color: '#f59e0b' },
  { name: 'Metal',     value: 8,  color: '#6b7280' },
  { name: 'Glass',     value: 7,  color: '#06b6d4' },
  { name: 'E-waste',   value: 3,  color: '#a855f7' },
  { name: 'Other',     value: 2,  color: '#ef4444' },
]

const ISSUES = [
  { id: 1, location: 'North Block, Zone 3', type: 'Overflow',      reported: '2025-06-18', status: 'Open' },
  { id: 2, location: 'Market Road, West',   type: 'Illegal Dump',  reported: '2025-06-16', status: 'In Progress' },
  { id: 3, location: 'Park East Entrance',  type: 'Missed Pickup', reported: '2025-06-14', status: 'Resolved' },
]

const STATUS_COLORS = {
  'Open':        'bg-red-100 text-red-700',
  'In Progress': 'bg-amber-100 text-amber-700',
  'Resolved':    'bg-green-100 text-green-700',
}

// Build SVG pin icons for map
function makeIcon(color) {
  const svg = encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 36">
      <path d="M14 0C6.27 0 0 6.27 0 14c0 9.75 14 22 14 22S28 23.75 28 14C28 6.27 21.73 0 14 0z"
        fill="${color}" stroke="white" stroke-width="2"/>
      <circle cx="14" cy="14" r="5" fill="white"/>
    </svg>
  `)
  return LeafletIcon({
    iconUrl: `data:image/svg+xml,${svg}`,
    iconSize: [22, 28],
    iconAnchor: [11, 28],
    popupAnchor: [0, -28],
  })
}
const ICONS = Object.fromEntries(
  Object.entries(TYPE_COLORS).map(([t, c]) => [t, makeIcon(c)])
)

const CENTER = [28.6139, 77.2090]

export default function DistrictDashboard() {
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <LayoutDashboard size={20} className="text-slate-400" />
        <h1 className="text-xl font-bold text-slate-800">District Dashboard</h1>
      </div>
      <p className="text-sm text-slate-500 mb-5">
        Administrative overview for waste management operations.
        <span className="ml-1.5 inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 font-medium">Preview Mode — sample data</span>
      </p>

      <DemoBanner message="All figures on this page are illustrative sample data. They do not represent a real district or real measurements. Live district analytics will replace these once the data-collection pipeline is connected in Phase 2." />

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Waste (Jun)"  value="8,100" unit="kg"  icon={Trash2}     color="slate" note="Sample value" />
        <StatCard label="Recycled (Jun)"     value="5,200" unit="kg"  icon={Recycle}    color="green" note="Sample value" />
        <StatCard label="Recycling Rate"     value="64.2"  unit="%"   icon={TrendingUp} color="blue"  note="Sample value" />
        <StatCard label="Segregation Rate"   value="78"    unit="%"   icon={CheckSquare} color="purple" note="Sample value" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Reported Issues"    value="3"     unit=""    icon={AlertTriangle} color="amber" note="Sample value" />
        <StatCard label="Recycling Points"   value="8"     unit=""    icon={MapPin}       color="green" note="Sample count" />
        <StatCard label="Total Records"      value="247"   unit=""    icon={Trash2}       color="slate" note="Sample value" />
        <StatCard label="Active Zones"       value="12"    unit=""    icon={LayoutDashboard} color="blue" note="Sample value" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        {/* Monthly trend */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-sm font-semibold text-slate-700 mb-4">Monthly Collection &amp; Recycling (kg) — Sample</p>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={MONTHLY_DISTRICT}>
              <defs>
                <linearGradient id="gradCollect" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#cbd5e1" stopOpacity={0.5}/>
                  <stop offset="95%" stopColor="#cbd5e1" stopOpacity={0.05}/>
                </linearGradient>
                <linearGradient id="gradRecycle" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0.05}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                formatter={(v) => [`${v.toLocaleString()} kg`]}
              />
              <Area type="monotone" dataKey="collected" stroke="#94a3b8" fill="url(#gradCollect)" strokeWidth={2} name="Collected" />
              <Area type="monotone" dataKey="recycled"  stroke="#22c55e" fill="url(#gradRecycle)" strokeWidth={2} name="Recycled" />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-300" /> Collected</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-500" /> Recycled</span>
          </div>
        </div>

        {/* Category pie */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-sm font-semibold text-slate-700 mb-4">Waste by Category (%) — Sample</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={CATEGORY_DATA} cx="50%" cy="50%" outerRadius={80} dataKey="value" paddingAngle={2}>
                {CATEGORY_DATA.map(e => <Cell key={e.name} fill={e.color} />)}
              </Pie>
              <Tooltip
                formatter={(v, name) => [`${v}%`, name]}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
              />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Map preview + Issues */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        {/* Map preview */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">Disposal Infrastructure Map</p>
            <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">Sample locations</span>
          </div>
          <div style={{ height: 280 }}>
            <MapContainer center={CENTER} zoom={12} zoomControl={false} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <ZoomControl position="bottomright" />
              {SAMPLE_LOCATIONS.map(loc => (
                <Marker key={loc.id} position={[loc.lat, loc.lng]} icon={ICONS[loc.type]}>
                  <Popup><b>{loc.name}</b><br />{loc.type}</Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </div>

        {/* Reported issues */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">Reported Waste Issues</p>
            <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">Sample data</span>
          </div>
          <div className="divide-y divide-slate-100">
            {ISSUES.map(issue => (
              <div key={issue.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{issue.type}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{issue.location}</p>
                    <p className="text-xs text-slate-400 mt-0.5">Reported: {issue.reported}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${STATUS_COLORS[issue.status]}`}>
                    {issue.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* District category bar chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <p className="text-sm font-semibold text-slate-700 mb-4">Waste Volume by Category (kg) — Sample</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            data={CATEGORY_DATA.map(d => ({ ...d, volume: Math.round(d.value * 81) }))}
            barCategoryGap="35%"
          >
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
              formatter={(v) => [`${v} kg`]}
            />
            <Bar dataKey="volume" radius={[4, 4, 0, 0]}>
              {CATEGORY_DATA.map(entry => <Cell key={entry.name} fill={entry.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
