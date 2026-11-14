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
import { ErrorBoundary } from './components/ErrorBoundary';
import { ShieldCheck, Bike, Lock } from 'lucide-react';

const MainLayout: React.FC = () => {
  const { role, authSession, openAuthModal } = useApp();
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
              <ErrorBoundary
                fallback={
                  <div className="bg-[#0B132B] text-white rounded-2xl border border-[#D4AF37]/30 p-6 text-center text-xs">
                    SHAH SIGNATURE Valet Network Active in Delhi PIN 110086, 110085 & 110087.
                  </div>
                }
              >
                <ServiceAreaMap />
              </ErrorBoundary>
            </div>
            <HowItWorks />
            <CustomerDashboard />
            <RetentionHub />
            <AboutAndFaqSection />
          </>
        )}

        {role === 'partner' && (
          <div className="space-y-6">
            {authSession?.isAuthenticated && authSession.activeRole === 'SERVICE_PARTNER' && authSession.token ? (
              <PartnerDashboard />
            ) : (
              <section className="py-20 px-4">
                <div className="max-w-lg mx-auto bg-white border border-slate-200 rounded-2xl shadow-lg p-8 text-center space-y-4">
                  <div className="w-14 h-14 mx-auto rounded-full bg-[#0B132B] text-[#D4AF37] flex items-center justify-center">
                    <Bike className="w-7 h-7" />
                  </div>
                  <h2 className="text-2xl font-bold font-brand text-[#0B132B]">Service Partner Hub Locked</h2>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Access to the dispatch radar, assigned orders, evidence capture, and weekly commission ledger requires an authenticated Service Partner account.
                  </p>
                  <div className="flex items-center justify-center gap-3 pt-2">
                    <button
                      onClick={() => openAuthModal('partner', 'login')}
                      className="px-5 py-2.5 bg-[#0B132B] text-[#F3E5AB] text-xs font-bold rounded-lg hover:bg-slate-900 cursor-pointer"
                    >
                      Sign In as Partner
                    </button>
                    <button
                      onClick={() => openAuthModal('partner', 'register')}
                      className="px-5 py-2.5 bg-slate-100 text-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-200 cursor-pointer"
                    >
                      Apply as New Partner
                    </button>
                  </div>
                </div>
              </section>
            )}
          </div>
        )}

        {role === 'admin' && (
          <div className="space-y-6">
            {authSession?.isAuthenticated && authSession.activeRole === 'SUPER_ADMIN' && authSession.token ? (
              <AdminDashboard />
            ) : (
              <section className="py-20 px-4">
                <div className="max-w-lg mx-auto bg-[#060B18] text-white border border-[#D4AF37]/40 rounded-2xl shadow-2xl p-8 text-center space-y-4">
                  <div className="w-14 h-14 mx-auto rounded-full bg-[#D4AF37]/20 text-[#D4AF37] flex items-center justify-center border border-[#D4AF37]/40">
                    <Lock className="w-7 h-7" />
                  </div>
                  <div className="flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-widest text-[#F3E5AB]">
                    <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
                    <span>Super Admin Access Denied</span>
                  </div>
                  <h2 className="text-2xl font-bold font-brand text-white">Restricted Control Room</h2>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Only the authorized Super Admin verified by the backend authentication server can open platform controls, partner approvals, customer PII, or commission records.
                  </p>
                  <div className="pt-2">
                    <button
                      onClick={() => openAuthModal('admin', 'login')}
                      className="px-6 py-2.5 bg-gradient-to-r from-[#F3E5AB] via-[#D4AF37] to-[#C5A059] text-[#060B18] text-xs font-bold rounded-lg hover:brightness-105 cursor-pointer"
                    >
                      Authenticate Super Admin
                    </button>
                  </div>
                </div>
              </section>
            )}
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
    <ErrorBoundary fullPage>
      <AppProvider>
        <MainLayout />
      </AppProvider>
    </ErrorBoundary>
  );
}
