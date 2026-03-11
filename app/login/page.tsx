'use client';

import {
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
} from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Loader2, LogIn } from 'lucide-react';

const getFirebaseAuthErrorMessage = (err: any) => {
  if (err?.code === 'auth/configuration-not-found') {
    return 'Google Sign-in is not enabled in your Firebase project. Please enable it in Firebase Console > Authentication > Sign-in method > Google.';
  }

  if (err?.code === 'auth/unauthorized-domain') {
    return "This domain is not authorized in your Firebase project. Add your app URL to Firebase Console > Authentication > Settings > Authorized domains.";
  }

  if (err?.code === 'auth/operation-not-allowed') {
    return 'Google sign-in is disabled for this Firebase project. Please enable it in Firebase Console.';
  }

  if (err?.code === 'auth/popup-blocked') {
    return 'Your browser blocked the Google sign-in popup. Please allow popups and try again.';
  }

  if (err?.code === 'auth/popup-closed-by-user') {
    return 'The Google sign-in popup was closed before login finished. Please try again.';
  }

  if (err?.code === 'auth/account-exists-with-different-credential') {
    return 'This email is already linked to another sign-in method in Firebase Auth.';
  }

  return `Login failed: ${err?.message || 'Unknown authentication error.'}`;
};

export default function LoginPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user && !loading) {
      router.push('/');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!auth) return;

    getRedirectResult(auth).catch((err: any) => {
      console.error('Redirect login failed', err);
      setError(getFirebaseAuthErrorMessage(err));
      setIsSubmitting(false);
    });
  }, []);

  const handleLogin = async () => {
    setError(null);
    if (!auth) {
      setError('Firebase is not configured. Please add your API keys in the Secrets panel.');
      return;
    }

    setIsSubmitting(true);

    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error('Popup login failed', err);

      if (
        err?.code === 'auth/popup-blocked' ||
        err?.code === 'auth/popup-closed-by-user' ||
        err?.code === 'auth/cancelled-popup-request'
      ) {
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectError: any) {
          console.error('Redirect fallback failed', redirectError);
          setError(getFirebaseAuthErrorMessage(redirectError));
        }
      } else {
        setError(getFirebaseAuthErrorMessage(err));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-stone-50">
      {!auth && (
        <div className="fixed top-0 left-0 right-0 bg-rose-50 border-b border-rose-100 p-4 text-center z-50">
          <p className="text-xs text-rose-600 font-medium">
            ⚠️ Firebase Configuration Required. Please add your API keys to the Secrets panel.
          </p>
        </div>
      )}
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm text-center space-y-8"
      >
        <div className="space-y-2">
          <h1 className="text-4xl font-light tracking-tight text-stone-900">ZenWealth</h1>
          <p className="text-stone-500 font-light">Minimalist personal wealth tracker.</p>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-5 bg-rose-50 border border-rose-100 rounded-3xl text-left space-y-3"
          >
            <p className="text-sm text-rose-700 font-semibold">
              Action Required in Firebase Console:
            </p>
            <ul className="text-xs text-rose-600 space-y-2 list-disc pl-4">
              <li>Go to <b>Authentication</b> section.</li>
              <li>Click the <b>Sign-in method</b> tab.</li>
              <li>Click <b>Add new provider</b> and select <b>Google</b>.</li>
              <li>Toggle <b>Enable</b>, set your support email, and click <b>Save</b>.</li>
              <li>Ensure your <b>Authorized Domains</b> includes this app&apos;s URL.</li>
            </ul>
            <p className="text-[10px] text-rose-400 pt-2 italic">
              Error: {error}
            </p>
          </motion.div>
        )}

        <button
          onClick={handleLogin}
          disabled={isSubmitting}
          className="w-full flex items-center justify-center gap-3 bg-white border border-stone-200 px-6 py-4 rounded-2xl shadow-sm hover:shadow-md transition-all active:scale-95 group disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <Loader2 className="w-5 h-5 text-stone-400 animate-spin" />
          ) : (
            <LogIn className="w-5 h-5 text-stone-400 group-hover:text-stone-900 transition-colors" />
          )}
          <span className="font-medium text-stone-700">
            {isSubmitting ? 'Signing in…' : 'Continue with Google'}
          </span>
        </button>

        <p className="text-xs text-stone-400 px-8 leading-relaxed">
          Your data is stored securely in your private cloud instance. We prioritize your privacy above all else.
        </p>
      </motion.div>
    </div>
  );
}
