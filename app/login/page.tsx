'use client';

import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { LogIn } from 'lucide-react';

export default function LoginPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user && !loading) {
      router.push('/');
    }
  }, [user, loading, router]);

  const handleLogin = async () => {
    setError(null);
    if (!auth) {
      setError("Firebase is not configured. Please add your API keys in the Secrets panel.");
      return;
    }
    try {
      await signInWithPopup(auth, googleProvider);
      router.push('/');
    } catch (err: any) {
      console.error("Login failed", err);
      if (err.code === 'auth/configuration-not-found') {
        setError("Google Sign-in is not enabled in your Firebase project. Please enable it in the Firebase Console: Authentication > Sign-in method > Add Google.");
      } else if (err.code === 'auth/unauthorized-domain') {
        setError("This domain is not authorized in your Firebase project. Please add the app URLs to the 'Authorized domains' list in the Firebase Console (Authentication > Sign-in method).");
      } else if (err.code === 'auth/operation-not-allowed') {
        setError("This operation is not allowed. Please check your Firebase Console settings.");
      } else {
        setError(`Login failed: ${err.message}`);
      }
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
          className="w-full flex items-center justify-center gap-3 bg-white border border-stone-200 px-6 py-4 rounded-2xl shadow-sm hover:shadow-md transition-all active:scale-95 group"
        >
          <LogIn className="w-5 h-5 text-stone-400 group-hover:text-stone-900 transition-colors" />
          <span className="font-medium text-stone-700">Continue with Google</span>
        </button>

        <p className="text-xs text-stone-400 px-8 leading-relaxed">
          Your data is stored securely in your private cloud instance. We prioritize your privacy above all else.
        </p>
      </motion.div>
    </div>
  );
}
