/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { ServicesShowcase } from './components/ServicesShowcase';
import { HowItWorks } from './components/HowItWorks';
import { CustomerDashboard } from './components/CustomerDashboard';
import { PartnerDashboard } from './components/PartnerDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { BookingModal } from './components/BookingModal';
import { ContactModal } from './components/ContactModal';
import { LegalModal } from './components/LegalModal';
import { AuthModal } from './components/AuthModal';
import { Footer } from './components/Footer';
import { ServiceAreaMap } from './components/ServiceAreaMap';
import { RetentionHub } from './components/RetentionHub';
import { AboutAndFaqSection } from './components/AboutAndFaqSection';

const MainLayout: React.FC = () => {
  const { role } = useApp();
  const [gmpQuotaExceeded, setGmpQuotaExceeded] = React.useState(false);

  React.useEffect(() => {
    const handleQuota = () => setGmpQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuota);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9FB] text-slate-900 selection:bg-[#D4AF37]/30 selection:text-[#0B132B]">
      {/* Google Maps Platform Quota Defense Banner */}
      {gmpQuotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {/* Top Navbar */}
      <Navbar />

      {/* Main Content Router based on active role */}
      <main className="flex-1">
        {role === 'customer' && (
          <>
            <Hero />
            <ServicesShowcase />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <ServiceAreaMap />
            </div>
            <HowItWorks />
            <CustomerDashboard />
            <RetentionHub />
            <AboutAndFaqSection />
          </>
        )}

        {role === 'partner' && (
          <div className="space-y-6">
            <PartnerDashboard />
          </div>
        )}

        {role === 'admin' && (
          <div className="space-y-6">
            <AdminDashboard />
          </div>
        )}
      </main>

      {/* Modals */}
      <BookingModal />
      <ContactModal />
      <LegalModal />
      <AuthModal />

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}
