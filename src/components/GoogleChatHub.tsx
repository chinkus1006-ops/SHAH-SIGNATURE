/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  initAuth, 
  googleSignIn, 
  googleSignOut, 
  getAccessToken 
} from '../lib/googleAuth';
import { 
  listChatSpaces, 
  sendChatMessage, 
  ChatSpace, 
  ChatMessage 
} from '../lib/googleChat';
import { 
  MessageSquare, 
  Send, 
  ExternalLink, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  ShieldAlert, 
  Info, 
  Sparkles, 
  UserCheck, 
  LogOut 
} from 'lucide-react';

export const GoogleChatHub: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [spaces, setSpaces] = useState<ChatSpace[]>([]);
  const [selectedSpace, setSelectedSpace] = useState<string>('');
  const [messageText, setMessageText] = useState('');
  const [isLoadingSpaces, setIsLoadingSpaces] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [chatAppNotConfigured, setChatAppNotConfigured] = useState(false);

  // Mandatory User Confirmation Modal State before Sending
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [pendingMessagePayload, setPendingMessagePayload] = useState<{ space: string; text: string } | null>(null);

  // Recent sent log
  const [sentHistory, setSentHistory] = useState<Array<{ space: string; text: string; time: string }>>([]);

  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, accessToken) => {
        setUser(currentUser);
        setToken(accessToken);
        fetchSpaces(accessToken);
      },
      () => {
        setUser(null);
        setToken(null);
        setSpaces([]);
      }
    );

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  const handleSignIn = async () => {
    setIsLoggingIn(true);
    setFeedback(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
        setFeedback({ type: 'success', message: `Authenticated as ${result.user.displayName || result.user.email}` });
        await fetchSpaces(result.accessToken);
      }
    } catch (err: any) {
      console.error('Google Sign-In failed:', err);
      setFeedback({ 
        type: 'error', 
        message: err.message || 'Google authentication failed or popup was closed.' 
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSignOut = async () => {
    await googleSignOut();
    setUser(null);
    setToken(null);
    setSpaces([]);
    setSelectedSpace('');
    setFeedback({ type: 'info', message: 'Signed out of Google Workspace.' });
  };

  const fetchSpaces = async (accessToken: string) => {
    setIsLoadingSpaces(true);
    setChatAppNotConfigured(false);
    const res = await listChatSpaces(accessToken);
    setIsLoadingSpaces(false);

    if (res.isNotConfigured) {
      setChatAppNotConfigured(true);
      setFeedback({
        type: 'error',
        message: 'Google Chat app configuration is required in Google Cloud Console before listing spaces.',
      });
      return;
    }

    if (res.success && res.data) {
      setSpaces(res.data);
      if (res.data.length > 0 && !selectedSpace) {
        setSelectedSpace(res.data[0].name);
      }
    } else {
      setFeedback({
        type: 'error',
        message: res.error || 'Unable to retrieve spaces from Google Chat API.',
      });
    }
  };

  const initiateSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSpace) {
      setFeedback({ type: 'error', message: 'Please select a Google Chat space.' });
      return;
    }
    if (!messageText.trim()) {
      setFeedback({ type: 'error', message: 'Message content cannot be empty.' });
      return;
    }

    // MANDATORY USER CONFIRMATION DIALOG (Never execute mutating API call without explicit confirmation)
    setPendingMessagePayload({
      space: selectedSpace,
      text: messageText.trim(),
    });
    setIsConfirmModalOpen(true);
  };

  const confirmAndSendMessage = async () => {
    if (!pendingMessagePayload) return;
    setIsConfirmModalOpen(false);

    const currentToken = token || (await getAccessToken());
    if (!currentToken) {
      setFeedback({ type: 'error', message: 'Authentication required. Please sign in with Google again.' });
      return;
    }

    setIsSending(true);
    setFeedback(null);

    const res = await sendChatMessage(
      currentToken,
      pendingMessagePayload.space,
      pendingMessagePayload.text
    );

    setIsSending(false);

    if (res.isNotConfigured) {
      setChatAppNotConfigured(true);
      setFeedback({
        type: 'error',
        message: 'Google Chat app configuration required in Cloud Console.',
      });
      return;
    }

    if (res.success) {
      setFeedback({
        type: 'success',
        message: 'Message delivered to Google Chat successfully.',
      });
      setSentHistory(prev => [
        {
          space: pendingMessagePayload.space,
          text: pendingMessagePayload.text,
          time: new Date().toLocaleTimeString(),
        },
        ...prev.slice(0, 9),
      ]);
      setMessageText('');
      setPendingMessagePayload(null);
    } else {
      setFeedback({
        type: 'error',
        message: res.error || 'Failed to dispatch message to Google Chat.',
      });
    }
  };

  const applyTemplate = (template: string) => {
    setMessageText(template);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#0B132B] text-[#D4AF37] flex items-center justify-center font-bold shadow-sm">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[#0B132B] flex items-center gap-2">
              Google Chat Concierge & Operations Dispatch Hub
              <span className="text-[10px] bg-[#D4AF37]/20 text-[#8B6508] px-2 py-0.5 rounded font-mono font-bold uppercase">
                Google Workspace
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              Broadcast verified doorstep dispatch notices, urgent garment updates, and courier alerts to Google Chat spaces.
            </p>
          </div>
        </div>

        {/* User Auth Controls */}
        <div className="flex items-center gap-2">
          {user ? (
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-xs">
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.displayName || 'User'} className="w-6 h-6 rounded-full" />
              ) : (
                <UserCheck className="w-4 h-4 text-emerald-600" />
              )}
              <div className="text-left">
                <div className="font-semibold text-slate-900 leading-tight">{user.displayName || 'Authorized User'}</div>
                <div className="text-[10px] text-slate-500">{user.email}</div>
              </div>
              <button
                onClick={handleSignOut}
                className="ml-2 text-slate-400 hover:text-rose-600 p-1 cursor-pointer transition-colors"
                title="Sign out of Google"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleSignIn}
              disabled={isLoggingIn}
              className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs rounded-lg border border-slate-300 shadow-xs flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              <span>{isLoggingIn ? 'Connecting...' : 'Sign in with Google'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Workspace & Console Notice Banner */}
      <div className="bg-[#FAF7F0] border border-[#D4AF37]/40 rounded-lg p-3.5 text-xs text-slate-700 space-y-1">
        <div className="flex items-center gap-1.5 font-bold text-[#0B132B]">
          <Info className="w-4 h-4 text-[#D4AF37]" />
          <span>Google Workspace Enterprise Requirements</span>
        </div>
        <p className="text-[11px] text-slate-600">
          Google Chat API requires a <strong>Google Workspace Business/Enterprise</strong> account. If your Chat App has not yet been registered in Google Cloud Console, spaces can be configured at:
        </p>
        <a
          href="https://console.cloud.google.com/apis/api/chat.googleapis.com/hangouts-chat?project=gen-lang-client-0123011776"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[#8B6508] font-semibold underline hover:text-[#5B4204]"
        >
          <span>Configure Chat App in Google Cloud Console (Project: gen-lang-client-0123011776)</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Feedback Alerts */}
      {feedback && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
              : feedback.type === 'error'
              ? 'bg-rose-50 text-rose-900 border border-rose-200'
              : 'bg-sky-50 text-sky-900 border border-sky-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600 font-bold ml-2">
            ×
          </button>
        </div>
      )}

      {/* Main Composer Section */}
      {user ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <form onSubmit={initiateSend} className="space-y-4">
              {/* Space Selection */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Select Target Google Chat Space
                  </label>
                  <button
                    type="button"
                    onClick={() => token && fetchSpaces(token)}
                    disabled={isLoadingSpaces}
                    className="text-xs text-[#8B6508] font-semibold flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${isLoadingSpaces ? 'animate-spin' : ''}`} />
                    <span>Refresh Spaces</span>
                  </button>
                </div>

                {spaces.length > 0 ? (
                  <select
                    value={selectedSpace}
                    onChange={e => setSelectedSpace(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent outline-none"
                  >
                    {spaces.map(sp => (
                      <option key={sp.name} value={sp.name}>
                        {sp.displayName || sp.name} ({sp.spaceType || sp.type || 'Space'})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 flex items-center justify-between">
                    <span>
                      {chatAppNotConfigured 
                        ? 'Google Chat app configuration is pending in Cloud Console.' 
                        : 'No active Google Chat spaces discovered.'}
                    </span>
                    <input
                      type="text"
                      placeholder="Or enter space path (e.g. spaces/AAAA)"
                      value={selectedSpace}
                      onChange={e => setSelectedSpace(e.target.value)}
                      className="bg-white border border-slate-300 px-2.5 py-1 rounded text-xs w-60"
                    />
                  </div>
                )}
              </div>

              {/* Message Composer */}
              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                  Message Content (Broadcast)
                </label>
                <textarea
                  rows={4}
                  value={messageText}
                  onChange={e => setMessageText(e.target.value)}
                  placeholder="Type message to broadcast to team or courier fleet..."
                  className="w-full bg-white border border-slate-300 rounded-lg p-3 text-xs text-slate-900 focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent outline-none"
                />
              </div>

              {/* Send Button */}
              <div className="flex items-center justify-between pt-2">
                <span className="text-[11px] text-slate-500">
                  Protected: Explicit user confirmation dialog required before dispatch.
                </span>
                <button
                  type="submit"
                  disabled={isSending || !messageText.trim()}
                  className="px-5 py-2.5 bg-[#0B132B] hover:bg-[#15224F] text-[#F3E5AB] font-bold text-xs rounded-lg shadow-sm flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>{isSending ? 'Sending...' : 'Review & Send Message'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Quick Dispatch Templates & History */}
          <div className="space-y-4">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>Concierge Dispatch Presets</span>
              </div>
              <p className="text-[11px] text-slate-500">Click to populate professional concierge messages:</p>

              <div className="space-y-1.5">
                {[
                  {
                    label: '🚨 Urgent VIP Steam Ironing (PIN 110086)',
                    text: '🚨 [URGENT VIP DISPATCH] High-priority artisan steam ironing booking placed in PIN 110086 (Delhi). Valet rider assigned. Express 4-hour SLA active.',
                  },
                  {
                    label: '🚴 Doorstep Valet Pickup Confirmation',
                    text: '🚴 [DOORSTEP VALET] Shah Signature doorstep valet has initiated pickup protocol in Sultanpuri / Rohini sector border. Customer verified via phone OTP.',
                  },
                  {
                    label: '✨ Quality Inspection Approved',
                    text: '✨ [QUALITY ASSURANCE] 100% Italian boiler steam press & sanitization verified for current batch. Ready for luxury hanger delivery in PIN 110086.',
                  },
                ].map((tpl, i) => (
                  <button
                    key={i}
                    onClick={() => applyTemplate(tpl.text)}
                    className="w-full text-left p-2 bg-white hover:bg-[#FAF7F0] border border-slate-200 hover:border-[#D4AF37]/50 rounded text-xs text-slate-800 font-medium transition-all cursor-pointer"
                  >
                    <div className="font-semibold text-slate-900">{tpl.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Sent Log */}
            {sentHistory.length > 0 && (
              <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
                <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Recent Dispatches</div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {sentHistory.map((item, idx) => (
                    <div key={idx} className="text-[11px] p-2 bg-slate-50 rounded border border-slate-100">
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>{item.space}</span>
                        <span>{item.time}</span>
                      </div>
                      <div className="text-slate-800 truncate mt-0.5">{item.text}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-12 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-300 space-y-3">
          <MessageSquare className="w-12 h-12 text-[#D4AF37] mx-auto opacity-75" />
          <h4 className="text-base font-bold text-[#0B132B]">Connect Google Chat with Permission</h4>
          <p className="text-xs text-slate-600 max-w-md mx-auto">
            Authorize your Google Workspace account with permission from the app's users to review and send operations messages directly to Google Chat spaces.
          </p>
          <div className="pt-2">
            <button
              onClick={handleSignIn}
              disabled={isLoggingIn}
              className="px-6 py-2.5 bg-[#0B132B] hover:bg-[#15224F] text-[#F3E5AB] font-bold text-xs rounded-lg shadow-sm inline-flex items-center gap-2 cursor-pointer transition-all"
            >
              <UserCheck className="w-4 h-4 text-[#D4AF37]" />
              <span>{isLoggingIn ? 'Connecting...' : 'Sign in with Google Workspace'}</span>
            </button>
          </div>
        </div>
      )}

      {/* MANDATORY USER CONFIRMATION DIALOG (Required by Google Workspace Integration Skill) */}
      {isConfirmModalOpen && pendingMessagePayload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-[#0B132B] text-white p-4 flex items-center gap-2 border-b border-[#D4AF37]/30">
              <ShieldAlert className="w-5 h-5 text-[#D4AF37]" />
              <h4 className="text-sm font-bold font-brand text-[#F3E5AB]">
                Confirm Google Chat Dispatch
              </h4>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-xs text-slate-600">
                You are about to post the following message on behalf of your Google Workspace account to space:
              </p>
              <div className="bg-slate-100 p-2.5 rounded font-mono text-xs text-slate-800 break-all font-semibold">
                {pendingMessagePayload.space}
              </div>

              <div className="bg-[#FAF7F0] p-3 rounded border border-[#D4AF37]/40 text-xs text-slate-900 italic">
                "{pendingMessagePayload.text}"
              </div>

              <p className="text-[11px] text-slate-500">
                This action is visible to all members of the Google Chat space and cannot be undone automatically.
              </p>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsConfirmModalOpen(false)}
                  className="px-3.5 py-1.5 rounded text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmAndSendMessage}
                  className="px-4 py-2 rounded text-xs font-bold bg-[#0B132B] hover:bg-[#15224F] text-[#F3E5AB] flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>Confirm & Send Message</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
