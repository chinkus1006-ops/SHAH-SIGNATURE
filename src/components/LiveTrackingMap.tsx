/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin, InfoWindow } from '@vis.gl/react-google-maps';
import { getGoogleMapsApiKey } from '../lib/mapsConfig';
import { Order } from '../types';
import { Bike, MapPin, Building, Clock, ShieldCheck, Phone } from 'lucide-react';

interface LiveTrackingMapProps {
  order?: Order | null;
  valetName?: string;
  valetPhone?: string;
}

export const LiveTrackingMap: React.FC<LiveTrackingMapProps> = ({
  order,
  valetName = 'Rajesh Kumar (Verified Partner)',
  valetPhone = '9899229102',
}) => {
  const apiKey = getGoogleMapsApiKey();
  const [activeMarker, setActiveMarker] = useState<'customer' | 'valet' | 'studio' | null>('valet');
  const [mapLoadFailed, setMapLoadFailed] = useState(false);

  React.useEffect(() => {
    const onQuotaOrAuthFail = () => setMapLoadFailed(true);
    window.addEventListener('gmp-quota-exceeded', onQuotaOrAuthFail);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuotaOrAuthFail);
  }, []);

  // Realistic coordinates inside Delhi PIN 110086
  const studioCoords = { lat: 28.6942, lng: 77.0655 };
  const customerCoords = { lat: 28.6980, lng: 77.0690 };
  const valetCoords = { lat: 28.6961, lng: 77.0672 }; // Mid-transit

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden space-y-4">
      {/* Top Tracking Status */}
      <div className="p-4 bg-[#0B132B] text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[10px] text-[#F3E5AB] font-mono uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Live Valet Radar · Delhi PIN 110086</span>
          </div>
          <h4 className="text-base font-bold font-brand text-white mt-0.5">
            Doorstep Transit & Valet Tracking
          </h4>
          <p className="text-xs text-slate-300">
            {order ? `Order #${order.id} · ${order.status.replace(/_/g, ' ').toUpperCase()}` : 'Live Doorstep Pickup Corridor'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[10px] text-slate-400 uppercase">Estimated Arrival</div>
            <div className="text-base font-bold font-mono text-[#F3E5AB]">14 - 18 Mins</div>
          </div>
          <a
            href={`tel:${valetPhone}`}
            className="px-3 py-1.5 bg-[#D4AF37] hover:bg-[#c29d29] text-[#060B18] font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Phone className="w-3.5 h-3.5" />
            <span>Call Valet</span>
          </a>
        </div>
      </div>

      {/* Map View */}
      <div className="relative w-full h-[320px] bg-slate-100">
        {apiKey && !mapLoadFailed ? (
          <APIProvider
            apiKey={apiKey}
            language="en"
            region="IN"
            onError={() => setMapLoadFailed(true)}
          >
            <Map
              mapId="DEMO_MAP_ID"
              defaultCenter={valetCoords}
              defaultZoom={15}
              style={{ width: '100%', height: '100%' }}
              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
              disableDefaultUI={false}
              gestureHandling="cooperative"
            >
              {/* Studio Marker */}
              <AdvancedMarker
                position={studioCoords}
                title="Shah Signature Central Pressing Facility"
                onClick={() => setActiveMarker('studio')}
              >
                <Pin background="#0B132B" borderColor="#D4AF37" glyphColor="#F3E5AB" scale={1.1} />
              </AdvancedMarker>

              {/* Customer Marker */}
              <AdvancedMarker
                position={customerCoords}
                title="Customer Doorstep"
                onClick={() => setActiveMarker('customer')}
              >
                <Pin background="#2563EB" borderColor="#93C5FD" glyphColor="#FFFFFF" scale={1.1} />
              </AdvancedMarker>

              {/* Valet Marker */}
              <AdvancedMarker
                position={valetCoords}
                title={`Valet: ${valetName}`}
                onClick={() => setActiveMarker('valet')}
              >
                <Pin background="#D4AF37" borderColor="#0B132B" glyphColor="#060B18" scale={1.25} />
              </AdvancedMarker>

              {/* InfoWindows */}
              {activeMarker === 'valet' && (
                <InfoWindow position={valetCoords} onCloseClick={() => setActiveMarker(null)}>
                  <div className="p-1 max-w-xs text-slate-900 font-sans">
                    <div className="text-[10px] text-[#AA7C11] font-mono font-bold uppercase">Active Doorstep Valet</div>
                    <div className="text-xs font-bold text-[#0B132B]">{valetName}</div>
                    <div className="text-[11px] text-slate-600 mt-0.5">En route with verified dust-proof garment transport bags.</div>
                    <div className="text-[10px] text-emerald-700 font-semibold mt-1">● Speed: 24 km/h · 0.8 km away</div>
                  </div>
                </InfoWindow>
              )}

              {activeMarker === 'studio' && (
                <InfoWindow position={studioCoords} onCloseClick={() => setActiveMarker(null)}>
                  <div className="p-1 max-w-xs text-slate-900 font-sans">
                    <div className="text-[10px] text-[#8B6508] font-mono font-bold uppercase">Central Studio (110086)</div>
                    <div className="text-xs font-bold text-[#0B132B]">Shah Signature Processing Studio</div>
                    <div className="text-[11px] text-slate-600 mt-0.5">Vacuum boiler steam press & sanitization unit.</div>
                  </div>
                </InfoWindow>
              )}

              {activeMarker === 'customer' && (
                <InfoWindow position={customerCoords} onCloseClick={() => setActiveMarker(null)}>
                  <div className="p-1 max-w-xs text-slate-900 font-sans">
                    <div className="text-[10px] text-blue-600 font-mono font-bold uppercase">Customer Doorstep</div>
                    <div className="text-xs font-bold text-[#0B132B]">{order ? order.customerAddress : 'Verified Sultanpuri Residence'}</div>
                    <div className="text-[11px] text-slate-600 mt-0.5">PIN 110086, Delhi</div>
                  </div>
                </InfoWindow>
              )}
            </Map>
          </APIProvider>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-center p-6 space-y-2">
            <Bike className="w-9 h-9 text-[#D4AF37]" />
            <div className="text-sm font-bold text-[#0B132B]">
              Valet Assigned: {valetName}
            </div>
            <p className="text-xs text-slate-600 max-w-sm">
              Transit Corridor: Sultanpuri Central Studio → {order ? order.customerAddress : 'Customer Doorstep (PIN 110086)'}
            </p>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="px-4 pb-4 pt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>OTP verification required before valet hands over garments.</span>
        </div>
        <div className="flex items-center gap-1 text-[11px] font-mono text-slate-500">
          <Clock className="w-3.5 h-3.5 text-[#AA7C11]" />
          <span>Updated: Real-time GPS</span>
        </div>
      </div>
    </div>
  );
};
