/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import firebaseConfig from '../../firebase-applet-config.json';

/**
 * Returns Google Maps Platform API key from Vite environment or provisioned project config.
 * Never hardcoded into public git repository.
 */
export function getGoogleMapsApiKey(): string {
  const envKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY;
  if (envKey && typeof envKey === 'string' && envKey.trim().length > 0) {
    return envKey.trim();
  }
  // Fall back to provisioned project API key from firebase-applet-config.json
  if (firebaseConfig && (firebaseConfig as any).apiKey) {
    return (firebaseConfig as any).apiKey;
  }
  return '';
}
