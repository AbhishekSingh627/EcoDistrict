// App.jsx — top-level route configuration for EcoDistrict.
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import ScanWaste from './pages/ScanWaste'
import WasteMap from './pages/WasteMap'
import MyImpact from './pages/MyImpact'
import DistrictDashboard from './pages/DistrictDashboard'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="scan"     element={<ScanWaste />} />
          <Route path="map"      element={<WasteMap />} />
          <Route path="impact"   element={<MyImpact />} />
          <Route path="district" element={<DistrictDashboard />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
