/**
 * sampleLocations.js — Demo waste disposal and recycling locations.
 *
 * WARNING: These coordinates are centred around Delhi (28.61°N 77.21°E).
 * They are FAKE locations used only for UI testing purposes.
 * They do NOT represent verified Ahmedabad infrastructure.
 *
 * Real Ahmedabad locations are registered via POST /api/locations/
 * and appear in the "Registered" tab of the Waste Map.
 */

export const SAMPLE_LOCATIONS = [
  {
    id: 1,
    name: 'Central Recycling Hub',
    type: 'Recycling Point',
    lat: 28.6139,
    lng: 77.2090,
    accepted: ['Plastic', 'Paper', 'Glass', 'Metal'],
    address: 'Near central market — demo location',
  },
  {
    id: 2,
    name: 'East District Waste Depot',
    type: 'Waste Disposal',
    lat: 28.6200,
    lng: 77.2250,
    accepted: ['Mixed Waste', 'Bulk Items'],
    address: 'Industrial zone east — demo location',
  },
  {
    id: 3,
    name: 'Green Park Organic Bin',
    type: 'Organic Waste',
    lat: 28.6080,
    lng: 77.2050,
    accepted: ['Organic', 'Food Waste', 'Garden Waste'],
    address: 'Green Park entrance — demo location',
  },
  {
    id: 4,
    name: 'TechRecycle E-Waste Point',
    type: 'E-Waste',
    lat: 28.6165,
    lng: 77.2120,
    accepted: ['Batteries', 'Electronics', 'Cables', 'Bulbs'],
    address: 'Near electronics market — demo location',
  },
  {
    id: 5,
    name: 'North Sector Collection Point',
    type: 'Collection Point',
    lat: 28.6250,
    lng: 77.2080,
    accepted: ['Plastic', 'Paper', 'Mixed Recyclables'],
    address: 'North residential block — demo location',
  },
  {
    id: 6,
    name: 'West Zone Recycling Drop-off',
    type: 'Recycling Point',
    lat: 28.6100,
    lng: 77.1980,
    accepted: ['Glass', 'Metal', 'Cardboard'],
    address: 'West market complex — demo location',
  },
  {
    id: 7,
    name: 'South Campus Organic Composter',
    type: 'Organic Waste',
    lat: 28.6050,
    lng: 77.2130,
    accepted: ['Food Scraps', 'Organic', 'Biodegradable'],
    address: 'South zone campus — demo location',
  },
  {
    id: 8,
    name: 'District E-Waste Centre',
    type: 'E-Waste',
    lat: 28.6190,
    lng: 77.1950,
    accepted: ['Computers', 'Phones', 'Batteries', 'Appliances'],
    address: 'Civic centre road — demo location',
  },
]

export const LOCATION_TYPES = [
  'Recycling Point',
  'Waste Disposal',
  'Organic Waste',
  'E-Waste',
  'Collection Point',
]

// Colour coding per category (matches map markers)
export const TYPE_COLORS = {
  'Recycling Point':  '#16a34a',
  'Waste Disposal':   '#dc2626',
  'Organic Waste':    '#65a30d',
  'E-Waste':          '#7c3aed',
  'Collection Point': '#2563eb',
}
