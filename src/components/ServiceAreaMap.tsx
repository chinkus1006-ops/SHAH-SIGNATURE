/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin, InfoWindow } from '@vis.gl/react-google-maps';
import { getGoogleMapsApiKey } from '../lib/mapsConfig';
import { MapPin, Navigation, Clock, Phone, ShieldCheck, Sparkles } from 'lucide-react';

interface HubMarker {
  id: string;
  title: string;
  category: 'HUB' | 'VALET_POST' | 'PARTNER_DEPOT';
  position: { lat: number; lng: number };
  address: string;
  timing: string;
  description: string;
}

const DELHI_110086_HUBS: HubMarker[] = [
  {
    id: 'hub_central',
    title: 'Shah Signature Central Studio & Artisan Pressing Facility',
    category: 'HUB',
    position: { lat: 28.6942, lng: 77.0655 },
    address: 'Central Zone, Sultanpuri / Rohini Sector Border, Delhi - 110086',
    timing: '7:00 AM – 10:00 PM (Everyday)',
    description: 'Flagship studio equipped with heavy Italian vacuum boilers, delicate silk steamer banks & certified garment masters.',
  },
  {
    id: 'post_sultanpuri_c',
    title: 'Sultanpuri Block C Doorstep Valet Post',
    category: 'VALET_POST',
    position: { lat: 28.6995, lng: 77.0720 },
    address: 'Block C, Sultanpuri, Delhi - 110086',
    timing: '8:00 AM – 9:00 PM',
    description: 'Rapid dispatch post for electric valet bikes servicing Sultanpuri residential avenues within 30 minutes.',
  },
  {
    id: 'post_aman_vihar',
    title: 'Aman Vihar Verified Partner Depot',
    category: 'PARTNER_DEPOT',
    position: { lat: 28.7020, lng: 77.0580 },
    address: 'Main Road, Aman Vihar, Delhi - 110086',
    timing: '8:30 AM – 8:30 PM',
    description: 'Screened & certified partner collection node with secure dust-proof garment wardrobes.',
  },
  {
    id: 'post_nangloi_border',
    title: 'Nangloi-Sultanpuri Border Dispatch Node',
    category: 'VALET_POST',
    position: { lat: 28.6860, lng: 77.0600 },
    address: 'Nangloi Border Access, Delhi - 110086',
    timing: '7:30 AM – 9:30 PM',
    description: 'Express transit corridor for South-West Delhi boundary deliveries.',
  },
];

export const ServiceAreaMap: React.FC = () => {
  const apiKey = getGoogleMapsApiKey();
  const [selectedHub, setSelectedHub] = useState<HubMarker | null>(DELHI_110086_HUBS[0]);
  const [activeCategory, setActiveCategory] = useState<string>('ALL');

  const filteredHubs = activeCategory === 'ALL' 
    ? DELHI_110086_HUBS 
    : DELHI_110086_HUBS.filter(h => h.category === activeCategory);

  return (
    <div className="bg-[#0B132B] text-white rounded-2xl border border-[#D4AF37]/30 shadow-2xl overflow-hidden">
      {/* Top Banner */}
      <div className="p-6 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#F3E5AB] tracking-widest uppercase">
            <MapPin className="w-4 h-4 text-[#D4AF37]" />
            <span>Official Hyperlocal Service Coverage</span>
            <span aria-hidden="true">·</span>
            <span>Delhi PIN Code 110086</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-bold font-brand text-white mt-1">
            Doorstep Logistics & Studio Network
          </h3>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl">
            Live interactive satellite and road tracking for Shah Signature valet units operating in Sultanpuri, Aman Vihar, and Rohini borders (PIN 110086).
          </p>
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'ALL', label: 'All Locations' },
            { id: 'HUB', label: 'Flagship Studio' },
            { id: 'VALET_POST', label: 'Valet Posts' },
            { id: 'PARTNER_DEPOT', label: 'Partner Depots' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setActiveCategory(f.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                activeCategory === f.id
                  ? 'bg-[#D4AF37] text-[#0B132B] shadow-sm font-bold'
                  : 'bg-slate-800/80 text-slate-300 hover:text-white border border-slate-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Map Container */}
      <div className="grid grid-cols-1 lg:grid-cols-3 min-h-[480px]">
        {/* Left Side: Hub List */}
        <div className="p-4 lg:p-6 bg-[#060B18]/80 border-b lg:border-b-0 lg:border-r border-slate-800 space-y-3 overflow-y-auto max-h-[480px]">
          <div className="text-xs font-bold text-[#F3E5AB] uppercase tracking-wider flex items-center justify-between">
            <span>Operating Nodes in 110086</span>
            <span className="text-[10px] text-slate-400 font-mono">({filteredHubs.length} Active)</span>
          </div>

          <div className="space-y-2">
            {filteredHubs.map(hub => {
              const isSelected = selectedHub?.id === hub.id;
              return (
                <div
                  key={hub.id}
                  onClick={() => setSelectedHub(hub)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer text-left ${
                    isSelected
                      ? 'bg-[#15224F] border-[#D4AF37] shadow-md'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-xs font-bold text-white line-clamp-1">{hub.title}</h4>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-mono uppercase font-bold shrink-0 ${
                        hub.category === 'HUB'
                          ? 'bg-[#D4AF37]/20 text-[#F3E5AB] border border-[#D4AF37]/40'
                          : hub.category === 'VALET_POST'
                          ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      }`}
                    >
                      {hub.category.replace('_', ' ')}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-300 mt-1 line-clamp-2">{hub.description}</p>

                  <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[#D4AF37]" />
                      <span>{hub.timing}</span>
                    </span>
                    <span className="text-[#F3E5AB] font-semibold">Focus Map →</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-2 text-[11px] text-slate-400 border-t border-slate-800 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#D4AF37] shrink-0" />
            <span>Guaranteed doorstep valet arrival within 30 minutes in PIN 110086.</span>
          </div>
        </div>

        {/* Right Side: Google Map */}
        <div className="lg:col-span-2 relative min-h-[360px] lg:min-h-[480px] bg-slate-950">
          {apiKey ? (
            <APIProvider apiKey={apiKey} language="en" region="IN">
              <div className="w-full h-full min-h-[360px] lg:min-h-[480px]">
                <Map
                  mapId="DEMO_MAP_ID"
                  defaultCenter={{ lat: 28.6942, lng: 77.0655 }}
                  defaultZoom={14}
                  style={{ width: '100%', height: '100%', minHeight: '360px' }}
                  internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                  disableDefaultUI={false}
                  gestureHandling="cooperative"
                >
                  {filteredHubs.map(hub => (
                    <AdvancedMarker
                      key={hub.id}
                      position={hub.position}
                      title={hub.title}
                      onClick={() => setSelectedHub(hub)}
                    >
                      <Pin
                        background={hub.category === 'HUB' ? '#D4AF37' : hub.category === 'VALET_POST' ? '#0B132B' : '#047857'}
                        borderColor="#F3E5AB"
                        glyphColor={hub.category === 'HUB' ? '#0B132B' : '#F3E5AB'}
                        scale={hub.category === 'HUB' ? 1.3 : 1.0}
                      />
                    </AdvancedMarker>
                  ))}

                  {selectedHub && (
                    <InfoWindow
                      position={selectedHub.position}
                      onCloseClick={() => setSelectedHub(null)}
                    >
                      <div className="p-1 max-w-xs text-slate-900 font-sans">
                        <div className="text-[10px] text-[#8B6508] font-mono font-bold uppercase tracking-wider">
                          SHAH SIGNATURE · PIN 110086
                        </div>
                        <div className="text-xs font-bold text-[#0B132B] mt-0.5">{selectedHub.title}</div>
                        <div className="text-[11px] text-slate-600 mt-1">{selectedHub.address}</div>
                        <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-[#AA7C11]" />
                          <span>{selectedHub.timing}</span>
                        </div>
                        <div className="mt-2 pt-1 border-t border-slate-200 flex items-center justify-between">
                          <span className="text-[10px] font-bold text-emerald-700">● Live Valet Active</span>
                          <a
                            href="tel:9899229102"
                            className="text-[10px] bg-[#0B132B] text-[#F3E5AB] px-2 py-0.5 rounded font-semibold flex items-center gap-1"
                          >
                            <Phone className="w-2.5 h-2.5" />
                            <span>Call Studio</span>
                          </a>
                        </div>
                      </div>
                    </InfoWindow>
                  )}
                </Map>
              </div>
            </APIProvider>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-3">
              <MapPin className="w-12 h-12 text-[#D4AF37] opacity-60" />
              <p className="text-sm font-semibold text-slate-200">Google Maps Platform Initializing...</p>
              <p className="text-xs text-slate-400 max-w-xs">
                Maps API key is being loaded for Delhi PIN Code 110086 logistics perimeter.
              </p>
            </div>
          )}

          {/* Floating Zone Pill */}
          <div className="absolute top-4 left-4 z-10 bg-[#060B18]/90 backdrop-blur-md border border-[#D4AF37]/50 px-3 py-1.5 rounded-full text-xs font-semibold text-white flex items-center gap-2 shadow-lg">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[#F3E5AB]">Active Coverage:</span>
            <span className="font-mono">PIN 110086 (Delhi)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
