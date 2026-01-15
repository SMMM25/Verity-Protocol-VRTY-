/**
 * Authentication Modal Component
 * Handles XUMM wallet sign-in and email registration
 * 
 * Verity Protocol - P2-02 User Signup/Login Flow
 * 
 * Features:
 * - XUMM wallet connection via QR code
 * - Email-based authentication (optional)
 * - Session management
 * - Real-time sign-in status polling
 */

import { useState, useEffect, useCallback } from 'react';
import {
  X,
  Wallet,
  Mail,
  Smartphone,
  Loader2,
  CheckCircle,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';

// Auth API client
const authApi = {
  initiateXummSignIn: async () => {
    const response = await fetch('/api/v1/auth/xumm/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error('Failed to initiate sign-in');
    return response.json();
  },
  verifyXummSignIn: async (uuid: string) => {
    const response = await fetch(`/api/v1/auth/xumm/verify/${uuid}`);
    if (!response.ok) throw new Error('Failed to verify sign-in');
    return response.json();
  },
  getAuthStatus: async () => {
    const response = await fetch('/api/v1/auth/status');
    if (!response.ok) throw new Error('Failed to get auth status');
    return response.json();
  },
};

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (wallet: string) => void;
}

type AuthStep = 'select' | 'xumm-qr' | 'xumm-pending' | 'email' | 'success' | 'error';

export default function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [step, setStep] = useState<AuthStep>('select');
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [deepLink, setDeepLink] = useState<string>('');
  const [payloadUuid, setPayloadUuid] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [xummConfigured, setXummConfigured] = useState<boolean | null>(null);

  // Check if XUMM is configured
  useEffect(() => {
    if (isOpen) {
      authApi.getAuthStatus()
        .then(res => setXummConfigured(res.data?.xummConfigured ?? false))
        .catch(() => setXummConfigured(false));
    }
  }, [isOpen]);

  // Initiate XUMM sign-in
  const initiateXummSignIn = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');
    
    try {
      const response = await authApi.initiateXummSignIn();
      
      if (response.success) {
        setQrCodeUrl(response.data.qrCodeUrl);
        setDeepLink(response.data.deepLink);
        setPayloadUuid(response.data.payloadUuid);
        setStep('xumm-qr');
      } else {
        throw new Error(response.error?.message || 'Failed to initiate sign-in');
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to connect to authentication service');
      setStep('error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Poll for XUMM sign-in status
  useEffect(() => {
    if (step !== 'xumm-qr' || !payloadUuid) return;

    let pollCount = 0;
    const maxPolls = 60; // 60 polls * 2 seconds = 2 minutes timeout
    
    const pollInterval = setInterval(async () => {
      try {
        const response = await authApi.verifyXummSignIn(payloadUuid);
        
        if (response.data?.status === 'authenticated') {
          clearInterval(pollInterval);
          setWalletAddress(response.data.user.wallet);
          setStep('success');
          
          // Auto-close and trigger success after a moment
          setTimeout(() => {
            onSuccess(response.data.user.wallet);
          }, 1500);
        }
        
        pollCount++;
        if (pollCount >= maxPolls) {
          clearInterval(pollInterval);
          setErrorMessage('Sign-in timed out. Please try again.');
          setStep('error');
        }
      } catch (error) {
        // Silently continue polling on error
        pollCount++;
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [step, payloadUuid, onSuccess]);

  // Handle email sign-in (development mode)
  const handleEmailSignIn = useCallback(async () => {
    if (!email.trim()) {
      setErrorMessage('Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    
    // In development mode, use email as identifier
    // In production, this would create/lookup user account
    const mockWallet = `r${email.replace(/[^a-zA-Z0-9]/g, '').substring(0, 20)}Demo`;
    
    setTimeout(() => {
      setWalletAddress(mockWallet);
      setStep('success');
      setTimeout(() => {
        onSuccess(mockWallet);
      }, 1500);
    }, 1000);
  }, [email, onSuccess]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setStep('select');
        setQrCodeUrl('');
        setDeepLink('');
        setPayloadUuid('');
        setErrorMessage('');
        setEmail('');
        setWalletAddress('');
        setIsLoading(false);
      }, 300);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">
            {step === 'select' && 'Sign In'}
            {step === 'xumm-qr' && 'Scan with XUMM'}
            {step === 'xumm-pending' && 'Waiting...'}
            {step === 'email' && 'Email Sign In'}
            {step === 'success' && 'Success!'}
            {step === 'error' && 'Error'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Select Method */}
          {step === 'select' && (
            <div className="space-y-4">
              <p className="text-gray-600 text-sm mb-6">
                Choose how you'd like to sign in to Verity Protocol.
              </p>

              {/* XUMM Wallet Option */}
              <button
                onClick={initiateXummSignIn}
                disabled={isLoading || xummConfigured === false}
                className="w-full flex items-center gap-4 p-4 border-2 border-gray-200 hover:border-indigo-500 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <Wallet className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="font-semibold text-gray-900">XUMM Wallet</h3>
                  <p className="text-sm text-gray-500">
                    {xummConfigured === false 
                      ? 'Not configured (dev mode)'
                      : 'Recommended - Secure wallet sign-in'}
                  </p>
                </div>
                {isLoading ? (
                  <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                ) : (
                  <ArrowRight className="w-5 h-5 text-gray-400" />
                )}
              </button>

              {/* Email Option (for demo/development) */}
              <button
                onClick={() => setStep('email')}
                className="w-full flex items-center gap-4 p-4 border-2 border-gray-200 hover:border-indigo-500 rounded-xl transition-colors"
              >
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
                  <Mail className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="font-semibold text-gray-900">Email</h3>
                  <p className="text-sm text-gray-500">Demo mode - Quick access</p>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400" />
              </button>

              <p className="text-xs text-gray-400 text-center mt-6">
                By signing in, you agree to our Terms of Service and Privacy Policy.
              </p>
            </div>
          )}

          {/* XUMM QR Code */}
          {step === 'xumm-qr' && (
            <div className="text-center space-y-6">
              {/* QR Code */}
              <div className="bg-gray-50 p-6 rounded-xl inline-block">
                {qrCodeUrl ? (
                  <img 
                    src={qrCodeUrl} 
                    alt="XUMM QR Code" 
                    className="w-48 h-48 mx-auto"
                  />
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <p className="text-gray-600">
                  Scan this QR code with your XUMM app to sign in.
                </p>

                {/* Mobile Deep Link */}
                {deepLink && (
                  <a
                    href={deepLink}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                  >
                    <Smartphone className="w-4 h-4" />
                    Open in XUMM App
                  </a>
                )}

                {/* Status Indicator */}
                <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Waiting for sign-in...
                </div>
              </div>

              <button
                onClick={() => setStep('select')}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                ← Back to options
              </button>
            </div>
          )}

          {/* Email Sign In */}
          {step === 'email' && (
            <div className="space-y-6">
              <p className="text-gray-600 text-sm">
                Enter your email to access the demo platform.
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                  autoFocus
                />
              </div>

              {errorMessage && (
                <p className="text-sm text-red-500">{errorMessage}</p>
              )}

              <button
                onClick={handleEmailSignIn}
                disabled={isLoading || !email.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white rounded-lg transition-colors"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Continue
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>

              <button
                onClick={() => setStep('select')}
                className="w-full text-sm text-gray-500 hover:text-gray-700"
              >
                ← Back to options
              </button>
            </div>
          )}

          {/* Success */}
          {step === 'success' && (
            <div className="text-center space-y-6 py-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Successfully Signed In!
                </h3>
                <p className="text-gray-600 mt-2">
                  Welcome to Verity Protocol
                </p>
                {walletAddress && (
                  <p className="text-sm text-gray-500 mt-2 font-mono">
                    {walletAddress.substring(0, 12)}...{walletAddress.substring(walletAddress.length - 6)}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Error */}
          {step === 'error' && (
            <div className="text-center space-y-6 py-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Sign In Failed
                </h3>
                <p className="text-gray-600 mt-2">
                  {errorMessage || 'An error occurred. Please try again.'}
                </p>
              </div>
              <button
                onClick={() => setStep('select')}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
