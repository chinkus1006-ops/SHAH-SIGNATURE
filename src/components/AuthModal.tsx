import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { BrandLogo } from './BrandLogo';
import {
  signInWithGoogleFirebase,
  sendFirebasePhoneOtp,
  verifyFirebasePhoneOtp,
} from '../lib/firebaseClient';
import type { ConfirmationResult } from 'firebase/auth';
import { ServiceType, UserRole } from '../types';
import { 
  X, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  User, 
  Bike, 
  Lock, 
  Mail, 
  Phone, 
  MapPin, 
  Building2, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  ArrowRight,
  Upload,
  RefreshCw,
  KeyRound,
  FileCheck
} from 'lucide-react';

export const AuthModal: React.FC = () => {
  const { 
    isAuthModalOpen, 
    setIsAuthModalOpen, 
    authModalRole, 
    setAuthModalRole, 
    authModalMode, 
    setAuthModalMode,
    businessSettings,
    loginAdmin,
    loginCustomer,
    loginPartner,
    loginWithGoogleFirebase,
    registerCustomerAccount,
    registerPartnerAccount,
    requestPasswordReset,
    confirmPasswordReset,
    setPhoneVerifiedSession,
    serviceCategories,
    adminUser
  } = useApp();

  // Mode: 'login' | 'register' | 'forgot' | 'reset'
  // Tab Role: 'customer' | 'partner' | 'admin'

  // Common Form States
  const [emailOrIdent, setEmailOrIdent] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Customer Registration States
  const [fullName, setFullName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [locality, setLocality] = useState('');
  const [pincode, setPincode] = useState('110086');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpVerified, setOtpVerified] = useState(false);
  const [smsGatewayNotConfigured, setSmsGatewayNotConfigured] = useState(false);
  const [smsGatewayChecked, setSmsGatewayChecked] = useState(false);
  const [otpProvider, setOtpProvider] = useState<'server' | 'firebase' | null>(null);
  const [firebaseConfirmation, setFirebaseConfirmation] = useState<ConfirmationResult | null>(null);
  const [firebasePhoneIdToken, setFirebasePhoneIdToken] = useState<string>('');
  const [phoneProofTokenLocal, setPhoneProofTokenLocal] = useState<string>('');
  const [inAppOtpPreview, setInAppOtpPreview] = useState<string>('');
  const [verificationId, setVerificationId] = useState('');
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [referralCodeUsed, setReferralCodeUsed] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(true);

  React.useEffect(() => {
    if (cooldownRemaining <= 0) return;
    const timer = setInterval(() => {
      setCooldownRemaining(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownRemaining]);

  React.useEffect(() => {
    if (!isAuthModalOpen || authModalMode !== 'register' || authModalRole !== 'customer') return;
    let cancelled = false;
    fetch('/api/system/status')
      .then(async res => {
        const ct = res.headers.get('content-type') || '';
        if (!res.ok || !ct.includes('application/json')) return null;
        return res.json();
      })
      .then(data => {
        if (cancelled) return;
        const configured = data?.gateways?.smsOtpCarrier === 'Configured';
        setSmsGatewayNotConfigured(!configured);
        setSmsGatewayChecked(true);
      })
      .catch(() => {
        if (cancelled) return;
        setSmsGatewayNotConfigured(true);
        setSmsGatewayChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthModalOpen, authModalMode, authModalRole]);

  // Partner Registration States
  const [businessName, setBusinessName] = useState('');
  const [serviceAddress, setServiceAddress] = useState('');
  const [city, setCity] = useState('Delhi');
  const [stateName, setStateName] = useState('Delhi');
  const [workingHours, setWorkingHours] = useState('08:00 AM - 08:00 PM IST');
  const [selectedServices, setSelectedServices] = useState<ServiceType[]>([
    'ironing_normal', 
    'ironing_steam'
  ]);
  const [uploadedDocName, setUploadedDocName] = useState<string | null>(null);

  // Password Reset States
  const [resetEmail, setResetEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [enteredResetToken, setEnteredResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  if (!isAuthModalOpen) return null;

  const normalizeClientIndianPhone = (rawPhone: string): string => {
    const digits = String(rawPhone || '').replace(/\D/g, '');
    if (digits.length === 10 && /^[6-9]/.test(digits)) return `+91${digits}`;
    if (digits.length === 11 && digits.startsWith('0') && /^[6-9]/.test(digits.slice(1))) {
      return `+91${digits.slice(1)}`;
    }
    if (digits.length === 12 && digits.startsWith('91') && /^[6-9]/.test(digits.slice(2))) {
      return `+${digits}`;
    }
    if (digits.length === 13 && digits.startsWith('910') && /^[6-9]/.test(digits.slice(3))) {
      return `+91${digits.slice(3)}`;
    }
    return String(rawPhone || '').trim();
  };

  const isValidClientIndianPhone = (rawPhone: string): boolean => {
    const normalized = normalizeClientIndianPhone(rawPhone).replace(/\s+/g, '');
    return /^\+91[6-9]\d{9}$/.test(normalized);
  };

  const resetFormState = () => {
    setErrorMessage('');
    setSuccessMessage('');
    setInfoMessage('');
    setPassword('');
    setConfirmPassword('');
    setOtpSent(false);
    setOtpVerified(false);
    setOtpProvider(null);
    setFirebaseConfirmation(null);
    setFirebasePhoneIdToken('');
    setPhoneProofTokenLocal('');
    setInAppOtpPreview('');
    setVerificationId('');
    setCooldownRemaining(0);
    setOtpCode('');
  };

  const handleRoleSwitch = (newRole: UserRole) => {
    setAuthModalRole(newRole);
    setAuthModalMode('login');
    resetFormState();
  };

  // Google Firebase Sign-In (Customer, Partner or Verified Owner Admin)
  const handleGoogleSignIn = async (targetRole: 'customer' | 'partner') => {
    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const fbUser = await signInWithGoogleFirebase();
      const sessionRes = await loginWithGoogleFirebase(targetRole, fbUser.idToken);
      if (sessionRes.success) {
        setSuccessMessage(sessionRes.message || `Signed in via Google (${fbUser.email}).`);
        setTimeout(() => setIsAuthModalOpen(false), 800);
      } else if (sessionRes.needsPartnerRegistration) {
        setEmailOrIdent(sessionRes.firebaseEmail || fbUser.email || '');
        setFullName(sessionRes.firebaseName || fbUser.displayName || '');
        setAuthModalMode('register');
        setSuccessMessage(`Google account (${fbUser.email}) verified. Complete hub KYC details below to apply.`);
      } else {
        setErrorMessage(sessionRes.message || 'Google Sign-In verification failed.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Google Sign-In was cancelled or failed.');
    } finally {
      setIsLoading(false);
    }
  };

  // 1. Admin Login (Server-Side Verified, Rate-Limited, MFA-ready)
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!emailOrIdent.trim()) {
      setErrorMessage('Please enter the Super Admin username or email address.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter the Super Admin security key.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usernameOrEmail: emailOrIdent.trim(),
          password,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        loginAdmin({ emailOrUsername: emailOrIdent, password, token: data.token });
        setSuccessMessage(data.message);
        setTimeout(() => {
          setIsAuthModalOpen(false);
        }, 800);
      } else {
        setErrorMessage(data.message || 'Access Denied: Invalid Super Admin credentials.');
      }
    } catch {
      setErrorMessage('Unable to reach Super Admin authentication server.');
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Customer Login (Real Server Scrypt Auth)
  const handleCustomerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!emailOrIdent.trim()) {
      setErrorMessage('Please enter your Mobile number, Email, or Customer ID.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await loginCustomer({ emailOrCode: emailOrIdent.trim(), password });
      if (res.success) {
        setSuccessMessage(res.message);
        setTimeout(() => {
          setIsAuthModalOpen(false);
        }, 800);
      } else {
        setErrorMessage(res.message);
      }
    } catch {
      setErrorMessage('Unable to reach authentication server.');
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Partner Login (Real Server Scrypt Auth)
  const handlePartnerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!emailOrIdent.trim()) {
      setErrorMessage('Please enter your Registered Mobile, Email, or Partner ID.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your hub password.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await loginPartner({ emailOrCode: emailOrIdent.trim(), password });
      if (res.success) {
        setSuccessMessage(res.message);
        setTimeout(() => {
          setIsAuthModalOpen(false);
        }, 800);
      } else {
        setErrorMessage(res.message);
      }
    } catch {
      setErrorMessage('Unable to reach partner authentication server.');
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Customer Registration (Real Server Password Hash + Phone Verification Proof)
  const handleCustomerRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setInfoMessage('');

    if (!fullName.trim() || !mobileNumber.trim()) {
      setErrorMessage('Please fill in your full name and Indian mobile number.');
      return;
    }

    if (!isValidClientIndianPhone(mobileNumber)) {
      setErrorMessage('Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.');
      return;
    }

    const normalizedPhone = normalizeClientIndianPhone(mobileNumber);

    // Only enforce SMS OTP strictly if the server SMS gateway is actually configured
    if (!otpVerified && smsGatewayChecked && !smsGatewayNotConfigured) {
      setErrorMessage('Please verify your mobile number via Send SMS OTP first.');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter.');
      return;
    }

    if (!agreeTerms) {
      setErrorMessage('Please agree to SHAH SIGNATURE Terms of Service and Privacy Policy.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await registerCustomerAccount({
        name: fullName.trim(),
        phone: normalizedPhone,
        email: emailOrIdent.trim() || `cust_${Date.now()}@shahsignature.internal`,
        password,
        addressLine,
        locality,
        pincode: pincode || '110086',
        referralCodeUsed: referralCodeUsed.trim() || undefined,
        phoneProofToken: phoneProofTokenLocal || undefined,
        firebaseIdToken: firebasePhoneIdToken || undefined,
      });

      if (res.success) {
        setSuccessMessage(
          otpVerified
            ? res.message
            : `${res.message} Mobile saved (SMS verification can be completed once carrier is active).`
        );
        setTimeout(() => {
          setIsAuthModalOpen(false);
        }, 1200);
      } else {
        setErrorMessage(res.message);
      }
    } catch {
      setErrorMessage('Network error during customer registration.');
    } finally {
      setIsLoading(false);
    }
  };

  // 5. Partner Registration (Always Pending Approval + Server Password Hash)
  const handlePartnerRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!fullName.trim() || !mobileNumber.trim() || !businessName.trim() || !serviceAddress.trim()) {
      setErrorMessage('Please enter all required hub and contact details.');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    if (selectedServices.length === 0) {
      setErrorMessage('Please select at least one garment care service offered.');
      return;
    }

    if (!isValidClientIndianPhone(mobileNumber)) {
      setErrorMessage('Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await registerPartnerAccount({
        name: fullName,
        phone: normalizeClientIndianPhone(mobileNumber),
        email: emailOrIdent,
        businessName,
        serviceAddress,
        pincode: pincode || '110086',
        city: city.trim() || 'Delhi',
        state: stateName.trim() || 'Delhi',
        servicesOffered: selectedServices,
        workingHours,
        password,
      });

      if (res.success) {
        setSuccessMessage(res.message);
        setTimeout(() => {
          setIsAuthModalOpen(false);
        }, 1500);
      } else {
        setErrorMessage(res.message);
      }
    } catch {
      setErrorMessage('Network error submitting partner application.');
    } finally {
      setIsLoading(false);
    }
  };

  // 6. Request Password Reset Link (Requires Server Email Gateway)
  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!resetEmail.trim()) {
      setErrorMessage('Please enter your registered email address.');
      return;
    }

    setIsLoading(true);
    try {
      const roleMapped = authModalRole === 'admin' ? 'SUPER_ADMIN' : authModalRole === 'partner' ? 'SERVICE_PARTNER' : 'CUSTOMER';
      const res = await requestPasswordReset(resetEmail.trim(), roleMapped);
      if (res.success) {
        setSuccessMessage(res.message);
        setResetToken(res.resetToken || '');
        setAuthModalMode('reset');
      } else {
        setErrorMessage(res.message);
      }
    } catch {
      setErrorMessage('Unable to reach password recovery service.');
    } finally {
      setIsLoading(false);
    }
  };

  // 7. Confirm New Password
  const handleConfirmReset = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (newPassword.length < 8) {
      setErrorMessage('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setErrorMessage('New passwords do not match.');
      return;
    }

    const res = confirmPasswordReset(enteredResetToken || resetToken, newPassword);
    if (res.success) {
      setSuccessMessage(res.message);
      setTimeout(() => {
        setAuthModalMode('login');
        setSuccessMessage('Password reset successfully. Please sign in with your new credentials.');
      }, 1000);
    } else {
      setErrorMessage(res.message);
    }
  };

  // Real Phone OTP Verification via Server SMS Carrier or Firebase Phone Auth
  const handleSendOtp = async () => {
    if (!isValidClientIndianPhone(mobileNumber)) {
      setErrorMessage('Please enter a valid 10-digit Indian mobile number (+91) starting with 6, 7, 8, or 9.');
      return;
    }
    if (cooldownRemaining > 0) return;

    const normalizedPhone = normalizeClientIndianPhone(mobileNumber);
    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    setInfoMessage('');

    let shouldTryFirebasePhoneAuth = false;

    try {
      try {
        const res = await fetch('/api/auth/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: normalizedPhone,
            role: authModalRole === 'partner' ? 'SERVICE_PARTNER' : 'CUSTOMER',
          }),
        });
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const data = await res.json();
          if (res.ok && data.success) {
            setOtpSent(true);
            setOtpProvider('server');
            setVerificationId(data.verificationId || '');
            setOtpCode('');
            setCooldownRemaining(data.cooldownSeconds || 60);

            if (data.deliveryMode === 'in_app_challenge' && data.verificationPreviewCode) {
              setInAppOtpPreview(String(data.verificationPreviewCode));
              setSmsGatewayNotConfigured(true);
              setInfoMessage(
                `In-app OTP verification active (no carrier SMS key set yet). Enter code ${data.verificationPreviewCode} below.`
              );
            } else {
              setInAppOtpPreview('');
              setSmsGatewayNotConfigured(false);
              setSuccessMessage(data.message || 'SMS OTP dispatched successfully.');
            }
            return;
          }
          if (data.requiresClientFirebaseAuth) {
            shouldTryFirebasePhoneAuth = true;
          } else {
            setErrorMessage(data.message || 'Unable to send OTP. Please check mobile number format.');
            if (typeof data.cooldownSeconds === 'number') setCooldownRemaining(data.cooldownSeconds);
            return;
          }
        } else {
          shouldTryFirebasePhoneAuth = true;
        }
      } catch {
        shouldTryFirebasePhoneAuth = true;
      }

      if (shouldTryFirebasePhoneAuth) {
        try {
          const confirmation = await sendFirebasePhoneOtp(normalizedPhone, 'firebase-recaptcha-container');
          setFirebaseConfirmation(confirmation);
          setOtpProvider('firebase');
          setOtpSent(true);
          setOtpCode('');
          setInAppOtpPreview('');
          setCooldownRemaining(60);
          setSuccessMessage('SMS verification code sent via Firebase Phone Auth.');
        } catch (fbErr: any) {
          setSmsGatewayNotConfigured(true);
          const detail = fbErr?.message ? ` (${fbErr.message})` : '';
          setInfoMessage(
            `SMS carrier OTP is optional right now${detail}. You can register directly below or continue with Google Sign-In.`
          );
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    const cleanOtp = otpCode.trim();
    if (!cleanOtp || cleanOtp.length !== 6) {
      setErrorMessage('Please enter the complete 6-digit verification code.');
      return;
    }

    if (!isValidClientIndianPhone(mobileNumber)) {
      setErrorMessage('Please enter a valid 10-digit Indian mobile number (+91).');
      return;
    }

    const normalizedPhone = normalizeClientIndianPhone(mobileNumber);
    setIsLoading(true);
    setErrorMessage('');
    setInfoMessage('');

    try {
      if (otpProvider === 'firebase' && firebaseConfirmation) {
        try {
          const verified = await verifyFirebasePhoneOtp(firebaseConfirmation, cleanOtp);
          setFirebasePhoneIdToken(verified.idToken);
          setOtpVerified(true);
          setInAppOtpPreview('');
          setPhoneVerifiedSession(normalizedPhone, undefined, true);
          setSuccessMessage('Mobile number verified via Firebase Phone Auth!');
          return;
        } catch (fbErr: any) {
          const code = fbErr?.code || '';
          if (code === 'auth/code-expired' || code === 'auth/session-expired') {
            setOtpSent(false);
            setFirebaseConfirmation(null);
            setCooldownRemaining(0);
            setErrorMessage('Firebase verification code expired. Please request a new OTP.');
          } else if (code === 'auth/invalid-verification-code') {
            setErrorMessage('Incorrect OTP code. Please check the 6-digit SMS code and try again.');
          } else {
            setErrorMessage(fbErr?.message || 'Unable to verify Firebase OTP code. Please try again.');
          }
          return;
        }
      }

      if (!verificationId) {
        setOtpSent(false);
        setCooldownRemaining(0);
        setErrorMessage('Verification session expired. Please request a new OTP code.');
        return;
      }

      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verificationId,
          otp: cleanOtp,
          phone: normalizedPhone,
        }),
      });
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('application/json')) {
        setErrorMessage('Verification API unreachable on static host. Complete registration directly or use Google Sign-In.');
        return;
      }
      const data = await res.json();
      if (res.ok && data.success) {
        setOtpVerified(true);
        setInAppOtpPreview('');
        setPhoneProofTokenLocal(data.proofToken || '');
        setPhoneVerifiedSession(
          data.phone || normalizedPhone,
          data.proofToken,
          data.carrierVerified !== false
        );
        setSuccessMessage(data.message || 'Verification confirmed! Complete registration below.');
      } else {
        const msg = String(data.message || 'Incorrect or expired OTP code.');
        const sessionDead =
          /expired|invalid or expired|maximum verification|mismatch/i.test(msg);
        if (sessionDead) {
          setOtpSent(false);
          setVerificationId('');
          setInAppOtpPreview('');
          setCooldownRemaining(0);
        }
        setErrorMessage(msg);
      }
    } catch {
      setErrorMessage('Unable to verify OTP code right now. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-md flex items-start sm:items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
    >
      <div id="firebase-recaptcha-container" />
      <div className="relative w-full max-w-xl bg-[#060B18] border border-[#D4AF37]/50 rounded-xl shadow-2xl overflow-hidden text-white my-4 sm:my-8">
        
        {/* Top Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-b from-[#0B132B] to-[#060B18] border-b border-[#D4AF37]/20 flex items-start justify-between">
          <div>
            <BrandLogo size="md" />
            <p className="text-xs text-slate-300 mt-2 font-medium">
              Secure Account Portal · PIN 110086, Delhi
            </p>
          </div>
          <button
            onClick={() => setIsAuthModalOpen(false)}
            className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Role Selector Tabs (Three Separate Experiences) */}
        <div className="grid grid-cols-3 bg-[#0B132B]/90 border-b border-[#D4AF37]/20 text-xs font-bold">
          <button
            onClick={() => handleRoleSwitch('customer')}
            className={`py-3.5 px-2 flex items-center justify-center gap-1.5 transition-all border-b-2 cursor-pointer ${
              authModalRole === 'customer'
                ? 'border-[#D4AF37] text-[#F3E5AB] bg-[#D4AF37]/10'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <User className="w-4 h-4 text-[#D4AF37]" />
            <span>Customer</span>
          </button>

          <button
            onClick={() => handleRoleSwitch('partner')}
            className={`py-3.5 px-2 flex items-center justify-center gap-1.5 transition-all border-b-2 cursor-pointer ${
              authModalRole === 'partner'
                ? 'border-[#D4AF37] text-[#F3E5AB] bg-[#D4AF37]/10'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Bike className="w-4 h-4 text-[#D4AF37]" />
            <span>Service Partner</span>
          </button>

          <button
            onClick={() => handleRoleSwitch('admin')}
            className={`py-3.5 px-2 flex items-center justify-center gap-1.5 transition-all border-b-2 cursor-pointer ${
              authModalRole === 'admin'
                ? 'border-[#D4AF37] text-[#F3E5AB] bg-[#D4AF37]/10'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
            <span>Super Admin</span>
          </button>
        </div>

        {/* Alerts */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 bg-rose-950/80 border border-rose-500/50 rounded-lg text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {infoMessage && (
          <div className="mx-6 mt-4 p-3 bg-amber-950/70 border border-amber-500/50 rounded-lg text-amber-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{infoMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mx-6 mt-4 p-3 bg-emerald-950/80 border border-emerald-500/50 rounded-lg text-emerald-200 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        <div className="p-6">
          {/* =============================================================== */}
          {/* 1. SUPER ADMIN EXPERIENCE */}
          {/* =============================================================== */}
          {authModalRole === 'admin' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-[#0B132B] border border-[#D4AF37]/40 rounded-lg text-xs text-slate-300">
                <div className="flex items-center gap-2 font-bold text-[#F3E5AB] mb-1">
                  <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
                  <span>Super Admin Verification Gate</span>
                </div>
                <p>
                  Owner Account: <strong className="text-white">{adminUser.name}</strong> ({adminUser.email}).
                  Public registration is strictly disabled.
                </p>
              </div>

              {authModalMode === 'login' && (
                <form onSubmit={handleAdminLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Super Admin Username or Email
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={emailOrIdent}
                        onChange={e => setEmailOrIdent(e.target.value)}
                        placeholder="shahsignature@gmail.com or ronak_admin"
                        className="w-full pl-9 pr-3 py-2.5 bg-[#0B132B] border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-[#D4AF37]"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-300">
                        Admin Master Password
                      </label>
                      <span className="text-[10px] text-slate-400">Managed via Server Environment</span>
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full pl-9 pr-10 py-2.5 bg-[#0B132B] border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-[#D4AF37]"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-300 pt-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={e => setRememberMe(e.target.checked)}
                        className="rounded border-slate-700 text-[#D4AF37] focus:ring-0"
                      />
                      <span>Remember secure session</span>
                    </label>
                    <span className="text-[10px] text-amber-400/90 font-medium">MFA Verified</span>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 bg-gradient-to-r from-[#F3E5AB] via-[#D4AF37] to-[#C5A059] text-[#060B18] font-bold text-sm rounded-lg hover:brightness-105 transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer disabled:opacity-50"
                  >
                    {isLoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Authenticate Super Admin</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* =============================================================== */}
          {/* 2. CUSTOMER EXPERIENCE (LOGIN & REGISTRATION) */}
          {/* =============================================================== */}
          {authModalRole === 'customer' && (
            <div>
              {authModalMode === 'login' && (
                <form onSubmit={handleCustomerLogin} className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
                    <h3 className="font-brand font-bold text-base text-white">Customer Sign In</h3>
                    <button
                      type="button"
                      onClick={() => {
                        resetFormState();
                        setAuthModalMode('register');
                      }}
                      className="text-xs text-[#D4AF37] hover:underline font-semibold"
                    >
                      New customer? Register here
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Email, Phone or Customer ID
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={emailOrIdent}
                        onChange={e => setEmailOrIdent(e.target.value)}
                        placeholder="e.g. gaurav.delhi@gmail.com or SHAH-CUST-8601"
                        className="w-full pl-9 pr-3 py-2.5 bg-[#0B132B] border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-[#D4AF37]"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-300">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setResetEmail(emailOrIdent);
                          setAuthModalMode('forgot');
                        }}
                        className="text-xs text-[#D4AF37] hover:underline"
                      >
                        Forgot Password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full pl-9 pr-10 py-2.5 bg-[#0B132B] border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-[#D4AF37]"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-300 pt-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={e => setRememberMe(e.target.checked)}
                        className="rounded border-slate-700 text-[#D4AF37] focus:ring-0"
                      />
                      <span>Remember Me</span>
                    </label>
                    <span className="text-[11px] text-slate-400">PIN 110086 Valet Access</span>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 bg-gradient-to-r from-[#F3E5AB] via-[#D4AF37] to-[#C5A059] text-[#060B18] font-bold text-sm rounded-lg hover:brightness-105 transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer disabled:opacity-50"
                  >
                    {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>Sign In to Customer Portal</span>}
                  </button>

                  <div className="relative py-1">
                    <div className="border-t border-slate-800" />
                  </div>

                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => handleGoogleSignIn('customer')}
                    className="w-full py-2.5 bg-[#0B132B] hover:bg-slate-800 text-white border border-slate-700 font-semibold text-xs rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>Continue with Google (Firebase Auth)</span>
                  </button>
                </form>
              )}

              {/* Customer Registration Form */}
              {authModalMode === 'register' && (
                <form onSubmit={handleCustomerRegister} className="space-y-3.5 max-h-[60vh] overflow-y-auto pr-1">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                    <h3 className="font-brand font-bold text-base text-white">Customer Registration</h3>
                    <button
                      type="button"
                      onClick={() => {
                        resetFormState();
                        setAuthModalMode('login');
                      }}
                      className="text-xs text-[#D4AF37] hover:underline font-semibold"
                    >
                      Already registered? Sign in
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name</label>
                      <input
                        type="text"
                        value={fullName}
                        onChange={e => setFullName(e.target.value)}
                        placeholder="e.g. Gaurav Singhal"
                        className="w-full px-3 py-2 bg-[#0B132B] border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-[#D4AF37]"
                        required
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-slate-300">Email Address</label>
                        <span className="text-[10px] text-slate-400 font-normal">Optional</span>
                      </div>
                      <input
                        type="email"
                        value={emailOrIdent}
                        onChange={e => setEmailOrIdent(e.target.value)}
                        placeholder="Optional: for invoices only"
                        className="w-full px-3 py-2 bg-[#0B132B] border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-[#D4AF37]"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-300">
                        Indian Mobile Number <span className="text-red-400">*</span>
                      </label>
                      <span className="text-[10px] text-[#F3E5AB]">
                        {smsGatewayNotConfigured
                          ? 'Optional OTP (Direct Registration Active)'
                          : 'Real SMS OTP Verification'}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="tel"
                          value={mobileNumber}
                          disabled={otpVerified}
                          onChange={e => {
                            setMobileNumber(e.target.value);
                            if (otpSent && !otpVerified) {
                              setOtpSent(false);
                              setOtpProvider(null);
                              setVerificationId('');
                              setInAppOtpPreview('');
                              setOtpCode('');
                              setFirebaseConfirmation(null);
                              setPhoneProofTokenLocal('');
                              setCooldownRemaining(0);
                              setErrorMessage('');
                              setInfoMessage('');
                            }
                          }}
                          placeholder="e.g. 98112 99887"
                          className="w-full pl-9 pr-3 py-2 bg-[#0B132B] border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-[#D4AF37] disabled:bg-slate-900 disabled:text-slate-400"
                          required
                        />
                      </div>
                      {otpVerified ? (
                        <div className="px-3 py-2 bg-emerald-950/80 border border-emerald-500/60 rounded-lg text-emerald-300 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shadow-xs">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>Phone Verified</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={handleSendOtp}
                          disabled={cooldownRemaining > 0 || isLoading}
                          className="px-3 py-2 bg-gradient-to-r from-[#F3E5AB] to-[#D4AF37] text-[#060B18] text-xs font-bold rounded-lg whitespace-nowrap cursor-pointer hover:brightness-105 disabled:opacity-50"
                        >
                          {cooldownRemaining > 0 ? `Resend (${cooldownRemaining}s)` : otpSent ? 'Resend SMS OTP' : 'Send SMS OTP'}
                        </button>
                      )}
                    </div>
                  </div>

                  {otpSent && !otpVerified && (
                    <div className="p-3 bg-[#0B132B] border border-[#D4AF37]/50 rounded-lg space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-300 font-semibold flex items-center gap-1">
                          <KeyRound className="w-3.5 h-3.5 text-[#D4AF37]" />
                          <span>Enter 6-Digit OTP Code</span>
                        </span>
                        <span className="text-[10px] text-amber-300">Valid for 10 minutes</span>
                      </div>
                      {inAppOtpPreview && (
                        <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded bg-[#060B18] border border-[#D4AF37]/40 text-xs">
                          <span className="text-slate-300">
                            In-App Code: <strong className="font-mono text-[#F3E5AB] tracking-wider">{inAppOtpPreview}</strong>
                          </span>
                          <button
                            type="button"
                            onClick={() => setOtpCode(inAppOtpPreview)}
                            className="px-2.5 py-1 rounded bg-[#D4AF37] text-[#060B18] font-bold text-[11px] cursor-pointer hover:brightness-105"
                          >
                            Fill Code
                          </button>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          maxLength={6}
                          value={otpCode}
                          onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                          placeholder="••••••"
                          className="px-3 py-2 bg-[#060B18] border border-slate-700 rounded-lg text-sm font-mono tracking-widest text-center text-white flex-1 focus:border-[#D4AF37]"
                        />
                        <button
                          type="button"
                          onClick={handleVerifyOtp}
                          disabled={isLoading || otpCode.trim().length !== 6}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition-all cursor-pointer disabled:opacity-40"
                        >
                          Verify Phone
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {inAppOtpPreview
                          ? `Server SMS gateway is in in-app preview mode. Enter code ${inAppOtpPreview} to confirm your session.`
                          : `An SMS verification code was dispatched to ${mobileNumber}. Enter the code to verify your mobile number.`}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Create Password</label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          placeholder="Min 8 characters"
                          className="w-full px-3 py-2 bg-[#0B132B] border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-[#D4AF37]"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                        >
                          {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Confirm Password</label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={e => setConfirmPassword(e.target.value)}
                          placeholder="Re-enter password"
                          className="w-full px-3 py-2 bg-[#0B132B] border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-[#D4AF37]"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                        >
                          {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-[#0B132B] rounded-lg border border-slate-800 space-y-2">
                    <span className="text-[11px] font-semibold text-[#F3E5AB]">Primary Pickup Address & Optional Referral</span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="text"
                        value={addressLine}
                        onChange={e => setAddressLine(e.target.value)}
                        placeholder="House / Flat / Street"
                        className="sm:col-span-2 px-2.5 py-1.5 bg-[#060B18] border border-slate-700 rounded text-xs text-white"
                      />
                      <input
                        type="text"
                        value={pincode}
                        onChange={e => setPincode(e.target.value)}
                        placeholder="PIN (110086)"
                        className="px-2.5 py-1.5 bg-[#060B18] border border-slate-700 rounded text-xs text-white"
                      />
                    </div>
                    <input
                      type="text"
                      value={referralCodeUsed}
                      onChange={e => setReferralCodeUsed(e.target.value.toUpperCase())}
                      placeholder="Referral Code (Optional, e.g. GAURAV-SHAH86)"
                      className="w-full px-2.5 py-1.5 bg-[#060B18] border border-slate-700 rounded text-xs text-white font-mono uppercase"
                    />
                  </div>

                  <label className="flex items-start gap-2 text-xs text-slate-300 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={agreeTerms}
                      onChange={e => setAgreeTerms(e.target.checked)}
                      className="mt-0.5 rounded border-slate-700 text-[#D4AF37] focus:ring-0"
                    />
                    <span>
                      I agree to the SHAH SIGNATURE Terms of Service & Privacy Policy. Unique Customer ID will be generated upon confirmation.
                    </span>
                  </label>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 bg-gradient-to-r from-[#F3E5AB] via-[#D4AF37] to-[#C5A059] text-[#060B18] font-bold text-sm rounded-lg hover:brightness-105 transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer disabled:opacity-50"
                  >
                    {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>Complete Registration & Generate ID</span>}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* =============================================================== */}
          {/* 3. SERVICE PARTNER EXPERIENCE (LOGIN & REGISTRATION) */}
          {/* =============================================================== */}
          {authModalRole === 'partner' && (
            <div>
              {authModalMode === 'login' && (
                <form onSubmit={handlePartnerLogin} className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
                    <h3 className="font-brand font-bold text-base text-white">Service Partner Sign In</h3>
                    <button
                      type="button"
                      onClick={() => {
                        resetFormState();
                        setAuthModalMode('register');
                      }}
                      className="text-xs text-[#D4AF37] hover:underline font-semibold"
                    >
                      New hub? Apply as Partner
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Email, Mobile or Partner ID
                    </label>
                    <div className="relative">
                      <Bike className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={emailOrIdent}
                        onChange={e => setEmailOrIdent(e.target.value)}
                        placeholder="e.g. rajesh.dhobi86@gmail.com or SHAH-PRT-8601"
                        className="w-full pl-9 pr-3 py-2.5 bg-[#0B132B] border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-[#D4AF37]"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-300">
                        Hub Password
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setResetEmail(emailOrIdent);
                          setAuthModalMode('forgot');
                        }}
                        className="text-xs text-[#D4AF37] hover:underline"
                      >
                        Forgot Password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full pl-9 pr-10 py-2.5 bg-[#0B132B] border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-[#D4AF37]"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-300 pt-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={e => setRememberMe(e.target.checked)}
                        className="rounded border-slate-700 text-[#D4AF37] focus:ring-0"
                      />
                      <span>Remember Me</span>
                    </label>
                    <span className="text-[11px] text-amber-400/90 font-medium">Approval Required Gate</span>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 bg-gradient-to-r from-[#F3E5AB] via-[#D4AF37] to-[#C5A059] text-[#060B18] font-bold text-sm rounded-lg hover:brightness-105 transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer disabled:opacity-50"
                  >
                    {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>Sign In to Partner Hub</span>}
                  </button>

                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => handleGoogleSignIn('partner')}
                    className="w-full py-2.5 bg-[#0B132B] hover:bg-slate-800 text-white border border-slate-700 font-semibold text-xs rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>Partner Sign-In with Google (Firebase Auth)</span>
                  </button>
                </form>
              )}

              {/* Service Partner Registration */}
              {authModalMode === 'register' && (
                <form onSubmit={handlePartnerRegister} className="space-y-3.5 max-h-[60vh] overflow-y-auto pr-1">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                    <h3 className="font-brand font-bold text-base text-white">Partner Hub Application</h3>
                    <button
                      type="button"
                      onClick={() => {
                        resetFormState();
                        setAuthModalMode('login');
                      }}
                      className="text-xs text-[#D4AF37] hover:underline font-semibold"
                    >
                      Existing Partner? Sign in
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Partner Full Name</label>
                      <input
                        type="text"
                        value={fullName}
                        onChange={e => setFullName(e.target.value)}
                        placeholder="e.g. Santosh Sharma"
                        className="w-full px-3 py-2 bg-[#0B132B] border border-slate-700 rounded-lg text-sm text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Mobile Number</label>
                      <input
                        type="tel"
                        value={mobileNumber}
                        onChange={e => setMobileNumber(e.target.value)}
                        placeholder="+91 99990 12345"
                        className="w-full px-3 py-2 bg-[#0B132B] border border-slate-700 rounded-lg text-sm text-white"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Shop / Business Name</label>
                      <input
                        type="text"
                        value={businessName}
                        onChange={e => setBusinessName(e.target.value)}
                        placeholder="e.g. Royal Steam Pressers"
                        className="w-full px-3 py-2 bg-[#0B132B] border border-slate-700 rounded-lg text-sm text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
                      <input
                        type="email"
                        value={emailOrIdent}
                        onChange={e => setEmailOrIdent(e.target.value)}
                        placeholder="hub@example.com"
                        className="w-full px-3 py-2 bg-[#0B132B] border border-slate-700 rounded-lg text-sm text-white"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Workshop Address, City & PIN</label>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                      <input
                        type="text"
                        value={serviceAddress}
                        onChange={e => setServiceAddress(e.target.value)}
                        placeholder="Shop 14, Main Road"
                        className="sm:col-span-2 px-3 py-2 bg-[#0B132B] border border-slate-700 rounded-lg text-sm text-white"
                        required
                      />
                      <input
                        type="text"
                        value={city}
                        onChange={e => setCity(e.target.value)}
                        placeholder="City"
                        className="px-3 py-2 bg-[#0B132B] border border-slate-700 rounded-lg text-sm text-white"
                      />
                      <input
                        type="text"
                        value={pincode}
                        onChange={e => setPincode(e.target.value)}
                        placeholder="110086"
                        className="px-3 py-2 bg-[#0B132B] border border-slate-700 rounded-lg text-sm text-white font-mono"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Services Offered</label>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {serviceCategories.filter(s => s.isActive).map(s => (
                        <label key={s.id} className="flex items-center gap-2 p-2 bg-[#0B132B] rounded border border-slate-800 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedServices.includes(s.id)}
                            onChange={() => {
                              setSelectedServices(prev =>
                                prev.includes(s.id)
                                  ? prev.filter(x => x !== s.id)
                                  : [...prev, s.id]
                              );
                            }}
                            className="rounded text-[#D4AF37]"
                          />
                          <span>{s.nameEn}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Create Password</label>
                      <input
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full px-3 py-2 bg-[#0B132B] border border-slate-700 rounded-lg text-sm text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Confirm Password</label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full px-3 py-2 bg-[#0B132B] border border-slate-700 rounded-lg text-sm text-white"
                        required
                      />
                    </div>
                  </div>

                  {/* Document upload requirement */}
                  <div className="p-3 bg-[#0B132B] rounded-lg border border-slate-800 text-xs">
                    <span className="font-semibold text-[#F3E5AB] block mb-1">Verification Document Upload</span>
                    <p className="text-slate-400 text-[11px] mb-2">
                      Aadhaar Card, MCD Trade License or Workshop Photo (Simulated private storage).
                    </p>
                    <label className="flex items-center justify-center gap-2 p-3 border border-dashed border-[#D4AF37]/50 rounded-lg hover:border-[#D4AF37] cursor-pointer text-slate-300">
                      <Upload className="w-4 h-4 text-[#D4AF37]" />
                      <span>{uploadedDocName ? `Uploaded: ${uploadedDocName}` : 'Select Document (PDF / JPG)'}</span>
                      <input
                        type="file"
                        className="hidden"
                        onChange={e => {
                          if (e.target.files?.[0]) {
                            setUploadedDocName(e.target.files[0].name);
                          }
                        }}
                      />
                    </label>
                  </div>

                  <div className="p-3 bg-amber-950/40 border border-amber-500/40 rounded-lg text-xs text-amber-200">
                    <strong>Admin Approval Requirement:</strong> Partner accounts remain in <em>Pending Approval</em> status until reviewed by Super Admin (Ronak) to prevent unverified dispatch.
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 bg-gradient-to-r from-[#F3E5AB] via-[#D4AF37] to-[#C5A059] text-[#060B18] font-bold text-sm rounded-lg hover:brightness-105 transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer disabled:opacity-50"
                  >
                    {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>Submit Partner Application</span>}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* =============================================================== */}
          {/* 4. FORGOT PASSWORD & RECOVERY FLOW */}
          {/* =============================================================== */}
          {authModalMode === 'forgot' && (
            <form onSubmit={handleRequestReset} className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-[#D4AF37]" />
                  <h3 className="font-brand font-bold text-base text-white">Account Recovery & Reset</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setAuthModalMode('login')}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Back to Sign In
                </button>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Enter your registered email address. We will generate an expiring, secure password recovery token verified by SHAH SIGNATURE identity protocols.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Registered Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={e => setResetEmail(e.target.value)}
                    placeholder="e.g. gaurav.delhi@gmail.com"
                    className="w-full pl-9 pr-3 py-2.5 bg-[#0B132B] border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-[#D4AF37]"
                    required
                  />
                </div>
              </div>

              <div className="p-3 bg-[#0B132B] rounded-lg border border-slate-800 text-xs text-slate-400">
                <span className="text-[#F3E5AB] font-semibold block mb-0.5">Rate Limiting & Security:</span>
                Password reset requests are throttled and expiring. We never transmit plain-text passwords over email or WhatsApp.
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-gradient-to-r from-[#F3E5AB] via-[#D4AF37] to-[#C5A059] text-[#060B18] font-bold text-sm rounded-lg hover:brightness-105 transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer disabled:opacity-50"
              >
                {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>Send Recovery Reset Token</span>}
              </button>
            </form>
          )}

          {/* Reset password token confirmation */}
          {authModalMode === 'reset' && (
            <form onSubmit={handleConfirmReset} className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                <h3 className="font-brand font-bold text-base text-white">Create New Password</h3>
                <button
                  type="button"
                  onClick={() => setAuthModalMode('login')}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>

              <div className="p-2.5 bg-emerald-950/40 border border-emerald-500/40 rounded-lg text-xs text-emerald-200">
                Recovery token verified for <strong>{resetEmail}</strong> (Active for 15 mins).
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Min 8 characters (letters, numbers, symbols)"
                  className="w-full px-3 py-2.5 bg-[#0B132B] border border-slate-700 rounded-lg text-sm text-white focus:border-[#D4AF37]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmNewPassword}
                  onChange={e => setConfirmNewPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full px-3 py-2.5 bg-[#0B132B] border border-slate-700 rounded-lg text-sm text-white focus:border-[#D4AF37]"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-gradient-to-r from-[#F3E5AB] via-[#D4AF37] to-[#C5A059] text-[#060B18] font-bold text-sm rounded-lg hover:brightness-105 transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer disabled:opacity-50"
              >
                {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>Update Password & Return to Login</span>}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
