import React, { useState, useEffect, Component } from 'react';
import { 
  HashRouter as Router, 
  Routes, 
  Route, 
  Navigate, 
  Link, 
  useLocation,
  useNavigate,
  useSearchParams
} from 'react-router-dom';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  signInWithPopup,
  GoogleAuthProvider,
  User as FirebaseUser,
  sendEmailVerification,
  reload
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  query, 
  where, 
  onSnapshot,
  updateDoc,
  addDoc,
  serverTimestamp,
  orderBy,
  limit,
  getDocs,
  Timestamp,
  getDocFromServer,
  deleteDoc,
  writeBatch,
  increment
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  uploadString,
  getDownloadURL,
  deleteObject
} from 'firebase/storage';
import { auth, db, storage } from './firebase';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMessage = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: errMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  if (errMessage.includes('permission-denied') || errMessage.includes('Permissions')) {
    alert(`SECURITY ERROR [${operationType} on ${path}]: Access Denied. Check your admin role or session.`);
  } else {
    alert(`DATABASE ERROR [${operationType} on ${path}]: ${errMessage}`);
  }
  throw new Error(JSON.stringify(errInfo));
}

import { 
  Home, 
  TrendingUp, 
  Download, 
  Upload, 
  Users, 
  LayoutDashboard, 
  LogOut, 
  ChevronRight,
  Wallet,
  CheckCircle2,
  Clock,
  AlertCircle,
  Image as ImageIcon,
  Copy,
  Check,
  Coins,
  Bell,
  Mail,
  Info,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Shield,
  FileText,
  Globe,
  Send,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---
interface UserProfile {
  uid: string;
  email: string;
  balance: number;
  totalCommissionsEarned: number;
  referralCode: string;
  referredBy: string | null;
  role: 'admin' | 'user';
  status: 'active' | 'banned' | 'paused';
  isActiveInvestor?: boolean;
  knownDevices?: string[];
  createdAt: any;
}

interface Investment {
  id: string;
  userId: string;
  userEmail?: string;
  amount: number;
  planId: string;
  planName?: string;
  startDate: any;
  endDate: any;
  lastPayoutDate: any;
  status: 'pending' | 'active' | 'completed' | 'rejected';
}

interface Deposit {
  id: string;
  userId: string;
  userEmail?: string;
  amount: number;
  network?: 'BEP20' | 'TRC20';
  screenshotUrl: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: any;
}

interface Withdrawal {
  id: string;
  userId: string;
  userEmail?: string;
  amount: number;
  network?: 'BEP20' | 'TRC20';
  walletAddress: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: any;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  createdAt: any;
}

// --- Constants ---
const ADMIN_USERNAME = "Adminpixi25";
const ADMIN_PASSWORD = "ibaigini2025";
const ADMIN_EMAILS = ["admin@pixi.com", "pixistaking@gmail.com", "adminpixi25@gmail.com"];
const ADMIN_EMAIL = ADMIN_EMAILS[0];
const BEP20_ADDRESS = "0xa703cfc51c14d2f9eee34bb4cbcdfbf2c9a92ee5";
const TRC20_ADDRESS = "TQ9YQZkbnx5cszhVZvZd7wtBbwxYGNRGVV";

// --- Helper: Image Compression ---
const compressImage = (dataUrl: string, maxWidth = 1000, maxHeight = 1000, quality = 0.7): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = dataUrl;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context failed'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = (e) => reject(new Error('Image processing failed'));
  });
};

const STAKING_PLANS = [
  { id: 'starter', name: 'Starter Plan', min: 10, max: 10, duration: 5, dailyPayout: 0.1, oneTime: true },
  { id: 'basic', name: 'Basic Plan', min: 11, max: 1000, duration: 15, dailyPayout: 0.1, oneTime: false },
  { id: 'flexible', name: 'Flexible Plan', min: 2000, max: 10000, duration: 30, dailyPayout: 0.1, oneTime: false },
];

// --- Components ---

// --- Admin Dashboard Payout Logic ---
const AdminPayoutProcessor = ({ investments, onPayoutSuccess }: { investments: Investment[], onPayoutSuccess: () => void }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [showLog, setShowLog] = useState(false);
  const now = new Date();

  const activeInvestments = investments.filter(i => i.status === 'active');
  const dueInvestments = activeInvestments.filter(inv => {
    if (!inv.startDate || !inv.amount) return false;
    const lastPayout = inv.lastPayoutDate?.seconds 
      ? new Date(inv.lastPayoutDate.seconds * 1000) 
      : new Date(inv.startDate.seconds * 1000);
    
    const diffTime = now.getTime() - lastPayout.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 1;
  });

  const processPayouts = async () => {
    if (isProcessing || dueInvestments.length === 0) return;
    setIsProcessing(true);
    const triggerNow = new Date();
    setLog(prev => [...prev, `${triggerNow.toLocaleTimeString()}: Processing ${dueInvestments.length} investments...`]);

    try {
      // Use batches but check for concurrent updates by verifying against current state
      const batch = writeBatch(db);
      let count = 0;
      let capitalRefundCount = 0;
      const userPayoutTotals: Record<string, number> = {};

      for (const inv of dueInvestments) {
        const plan = STAKING_PLANS.find(p => p.id === inv.planId) || STAKING_PLANS[1];
        const lastPayout = inv.lastPayoutDate?.seconds 
          ? new Date(inv.lastPayoutDate.seconds * 1000) 
          : new Date(inv.startDate.seconds * 1000);
        
        const diffTime = triggerNow.getTime() - lastPayout.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays >= 1) {
          const payoutAmount = inv.amount * plan.dailyPayout * diffDays;
          userPayoutTotals[inv.userId] = (userPayoutTotals[inv.userId] || 0) + payoutAmount;

          const invRef = doc(db, "investments", inv.id);
          const newPayoutTime = new Date(lastPayout.getTime() + diffDays * 24 * 60 * 60 * 1000);
          batch.update(invRef, { lastPayoutDate: Timestamp.fromDate(newPayoutTime) });

          if (inv.endDate?.seconds) {
            const endDate = new Date(inv.endDate.seconds * 1000);
            if (triggerNow >= endDate) {
              batch.update(invRef, { status: "completed" });
              
              if (inv.planId === 'starter') {
                const refundAmount = inv.amount;
                userPayoutTotals[inv.userId] = (userPayoutTotals[inv.userId] || 0) + refundAmount;
                capitalRefundCount++;
                
                const notifRef = doc(collection(db, "notifications"));
                batch.set(notifRef, {
                  userId: inv.userId,
                  title: "Capital Refunded",
                  message: `Your initial investment of ${refundAmount.toFixed(2)} USDT (${inv.planName}) has been returned.`,
                  createdAt: serverTimestamp()
                });
              }
            }
          }
          count++;
        }
      }

      for (const [userId, total] of Object.entries(userPayoutTotals)) {
        batch.update(doc(db, "users", userId), { balance: increment(total) });
        
        const notifRef = doc(collection(db, "notifications"));
        batch.set(notifRef, {
          userId,
          title: "Staking Dividends",
          message: `You earned ${total.toFixed(2)} USDT in staking rewards!`,
          createdAt: serverTimestamp()
        });
      }

      if (count > 0) {
        await batch.commit();
        setLog(prev => [...prev, `Success: Credited rewards for ${count} stakes. Refunds: ${capitalRefundCount}.`]);
        onPayoutSuccess();
      } else {
        setLog(prev => [...prev, "No payouts were eligible at this time."]);
      }
    } catch (err: any) {
      console.error("Payout Processor Error:", err);
      setLog(prev => [...prev, `Critical Error: ${err.message}`]);
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    // Semi-auto trigger: Only if admin hasn't run it in this session yet
    if (dueInvestments.length > 0 && !isProcessing && log.length === 0) {
      const timer = setTimeout(processPayouts, 3000);
      return () => clearTimeout(timer);
    }
  }, [dueInvestments.length]);

  return (
    <div className="fixed top-20 right-4 z-[55] flex flex-col items-end space-y-2 group">
      {log.length > 0 && (
        <div className={`text-[10px] bg-black/80 text-white p-2 rounded-lg max-w-[200px] shadow-xl overflow-hidden transition-all duration-300 ${showLog ? 'opacity-100 max-h-48 overflow-y-auto' : 'opacity-0 max-h-0 pointer-events-none'}`}>
          {log.map((l, i) => <p key={i} className="border-b border-white/10 pb-1 mb-1">{l}</p>)}
        </div>
      )}
      <div className="flex space-x-2">
        {log.length > 0 && (
          <button 
            onClick={() => setShowLog(!showLog)}
            className="bg-white/90 backdrop-blur border border-gray-200 p-2 rounded-full shadow-lg text-gray-500 hover:text-amber-600 transition-colors"
          >
            <Clock className="w-5 h-5" />
          </button>
        )}
        <button 
          onClick={processPayouts}
          disabled={isProcessing || dueInvestments.length === 0}
          className={`px-4 py-2 rounded-full shadow-xl font-bold text-xs flex items-center space-x-2 transition-all active:scale-95 ${
            dueInvestments.length > 0 
              ? 'bg-amber-500 text-white animate-pulse' 
              : 'bg-white text-gray-400 border border-gray-100'
          }`}
        >
          {isProcessing ? (
            <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : <TrendingUp className="w-4 h-4" />}
          <span>{isProcessing ? 'Processing...' : (dueInvestments.length > 0 ? `Pay ${dueInvestments.length} Stakes` : 'Payouts Up-To-Date')}</span>
        </button>
      </div>
    </div>
  );
};

const PixiCoin = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) => {

  const [hasError, setHasError] = useState(false);
  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-16 h-16',
    lg: 'w-24 h-24'
  };
  
  if (hasError) {
    return (
      <div className={`${sizeClasses[size]} relative flex items-center justify-center overflow-hidden rounded-full shadow-lg bg-gradient-to-br from-amber-300 via-amber-500 to-amber-700`}>
        <div className="absolute inset-1.5 bg-gradient-to-tr from-amber-600 to-amber-400 rounded-full flex items-center justify-center">
          <span className={`${size === 'lg' ? 'text-2xl' : size === 'md' ? 'text-xl' : 'text-xs'} font-black text-white drop-shadow-md`}>P</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`${sizeClasses[size]} relative flex items-center justify-center overflow-hidden rounded-full shadow-lg`}>
      <img 
        src="https://lh3.googleusercontent.com/d/1SBsfbqOSjYTcHzisVqfn_uqOeoAq-T7f" 
        alt="PIXI COIN"
        className="w-full h-full object-cover"
        referrerPolicy="no-referrer"
        onError={() => setHasError(true)}
      />
    </div>
  );
};

const Navbar = ({ user, profile, onLogout, notificationCount = 0 }: { user: FirebaseUser | null, profile: UserProfile | null, onLogout: () => void, notificationCount?: number }) => {
  const location = useLocation();
  
  if (!user) return null;

  const navItems = [
    { path: '/', label: 'Home', icon: Home },
    { path: '/plans', label: 'Plans', icon: TrendingUp },
    { path: '/deposit', label: 'Deposit', icon: Download },
    { path: '/withdrawal', label: 'Withdraw', icon: Upload },
    { path: '/team', label: 'Team', icon: Users },
    { path: '/notifications', label: 'Updates', icon: Bell, badge: notificationCount },
  ];

  if (profile?.role === 'admin') {
    navItems.push({ path: '/admin', label: 'Admin', icon: LayoutDashboard });
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 z-50 md:top-0 md:bottom-auto md:border-b md:border-t-0 shadow-sm">
      <div className="max-w-7xl mx-auto flex justify-around md:justify-between items-center sm:px-6 lg:px-8">
        <div className="hidden md:flex items-center space-x-3 font-bold text-xl text-indigo-600">
          <PixiCoin size="sm" />
          <span className="tracking-tight">PIXI STAKING</span>
        </div>
        <div className="flex space-x-1 sm:space-x-4 md:space-x-8 overflow-x-auto no-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link 
                key={item.path} 
                to={item.path}
                className={`flex flex-col md:flex-row items-center space-y-1 md:space-y-0 md:space-x-2 p-2 rounded-lg transition-colors relative ${
                  isActive ? 'text-amber-600 bg-amber-50' : 'text-gray-500 hover:text-amber-600 hover:bg-gray-50'
                }`}
              >
                <div className="relative">
                  <Icon className="w-6 h-6" />
                  {item.badge && item.badge > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-black w-4 h-4 flex items-center justify-center rounded-full border-2 border-white animate-pulse">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </div>
                <span className="text-xs md:text-sm font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
        <button 
          onClick={onLogout}
          className="flex flex-col md:flex-row items-center space-y-1 md:space-y-0 md:space-x-2 p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <LogOut className="w-6 h-6" />
          <span className="text-xs md:text-sm font-medium">Logout</span>
        </button>
      </div>
    </nav>
  );
};

const LoginPage = ({ onLogin, onGoogleLogin, initiallySignup = false }: { 
  onLogin: (email: string, pass: string, isSignup: boolean, referralCode?: string) => Promise<void>,
  onGoogleLogin: (referralCode?: string) => Promise<void>,
  initiallySignup?: boolean
}) => {
  const [isSignup, setIsSignup] = useState(() => {
    // Initial state calculation to avoid flashing
    const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const searchParams = new URLSearchParams(window.location.search);
    const ref = hashParams.get('ref') || hashParams.get('referral') || searchParams.get('ref') || searchParams.get('referral');
    return initiallySignup || !!ref;
  });
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [referralCode, setReferralCode] = useState(() => {
    const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const searchParams = new URLSearchParams(window.location.search);
    return hashParams.get('ref') || hashParams.get('referral') || searchParams.get('ref') || searchParams.get('referral') || '';
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const hashRef = searchParams.get('ref') || searchParams.get('referral');
    const urlParams = new URLSearchParams(window.location.search);
    const topLevelRef = urlParams.get('ref') || urlParams.get('referral');
    
    const ref = hashRef || topLevelRef;
    
    if (ref) {
      setReferralCode(ref);
      setIsSignup(true);
    } else if (initiallySignup) {
      setIsSignup(true);
    }
  }, [searchParams, initiallySignup]);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      await onGoogleLogin(referralCode.trim() || undefined);
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') {
        // User just closed the popup, don't show a scary error
        return;
      }
      console.error("Google Auth error:", err);
      setError(err.message || 'Google authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const trimmedUsername = username.trim();
      const trimmedPassword = password.trim();
      
      if (!trimmedUsername || !trimmedPassword) {
        throw new Error('Username and password are required');
      }

      let email = trimmedUsername;
      if (trimmedUsername.toLowerCase() === ADMIN_USERNAME.toLowerCase()) {
        email = ADMIN_EMAIL;
      } else if (!trimmedUsername.includes('@')) {
        email = `${trimmedUsername.toLowerCase()}@pixistaking.com`;
      } else {
        email = email.toLowerCase();
      }
      
      // Basic email validation regex
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Error('Invalid email format. Please enter a valid username or email.');
      }

      await onLogin(email, trimmedPassword, isSignup, referralCode.trim());
    } catch (err: any) {
      console.error("Auth error details:", err);
      const errorCode = err.code || (err.message && err.message.includes('auth/') ? err.message.match(/auth\/[a-z0-9-]+/)?.[0] : null);
      let message = err.message || 'Authentication failed';
      
      // Handle Firebase specific error codes
      if (errorCode === 'auth/invalid-email') message = 'Invalid email format.';
      if (errorCode === 'auth/user-not-found') message = 'User not found. Please sign up if you don\'t have an account.';
      if (errorCode === 'auth/wrong-password') message = 'Incorrect password. Please try again.';
      if (errorCode === 'auth/too-many-requests') message = 'Too many failed attempts. Please try again later.';
      if (errorCode === 'auth/email-already-in-use') {
        message = 'This account already exists. Please login instead.';
        setIsSignup(false); // Auto-switch to login mode
      }
      if (errorCode === 'auth/invalid-credential') {
        message = 'Authentication failed. Please check your credentials. If you are an admin, ensure your password is correct.';
      }
      if (errorCode === 'auth/weak-password') message = 'Password should be at least 6 characters.';
      if (errorCode === 'auth/operation-not-allowed') {
        message = 'The requested authentication method (Email/Password) is not enabled in your Firebase project.';
      }
      if (errorCode === 'auth/network-request-failed') message = 'Network error. Please check your internet connection.';
      
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <PixiCoin size="lg" />
          </div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight uppercase">PIXI STAKING</h1>
          <p className="text-gray-500 mt-2 font-medium">
            {isSignup ? 'Join the future of staking' : 'Welcome back to your wallet'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username or Email</label>
            <input 
              type="text" 
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              placeholder="Enter your username"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              placeholder="Enter your password"
            />
          </div>
          {isSignup && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Referral Code (Optional)</label>
              <input 
                type="text" 
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                placeholder="Enter referral code"
              />
            </div>
          )}

          {error && (
            <div className="space-y-4">
              <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
              
              {(error.includes('Firebase Console') || error.includes('not enabled') || error.includes('authorized') || error.includes('Authentication failed')) && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="p-4 bg-blue-50 border border-blue-100 rounded-xl space-y-3"
                >
                  <h3 className="text-sm font-semibold text-blue-900 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-2" />
                    Critical Setup Required
                  </h3>
                  
                  <div className="space-y-3">
                    <div className="text-xs text-blue-800">
                      <p className="font-semibold mb-1">1. Enable Email/Password Provider:</p>
                      <p>Go to <strong>Authentication &gt; Sign-in method</strong>, click <strong>Add new provider</strong>, select <strong>Email/Password</strong> and enable it.</p>
                    </div>

                    <div className="text-xs text-blue-800">
                      <p className="font-semibold mb-1">2. Authorize this Domain:</p>
                      <p>Go to <strong>Authentication &gt; Settings &gt; Authorized domains</strong> and ensure this domain is added:</p>
                      <div className="flex items-center mt-1 space-x-2">
                        <code className="flex-1 p-1 bg-blue-100 rounded text-[10px] break-all">
                          {window.location.hostname}
                        </code>
                        <button 
                          onClick={() => navigator.clipboard.writeText(window.location.hostname)}
                          className="px-2 py-1 bg-blue-200 hover:bg-blue-300 rounded text-[10px] font-bold transition-colors"
                        >
                          Copy
                        </button>
                      </div>
                    </div>

                    <a 
                      href="https://console.firebase.google.com/project/gen-lang-client-0063657798/authentication/providers" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="block w-full text-center py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors"
                    >
                      Open Firebase Console
                    </a>
                  </div>
                </motion.div>
              )}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-amber-600 text-white py-2 rounded-lg font-semibold hover:bg-amber-700 transition-colors disabled:opacity-50 shadow-md shadow-amber-200"
          >
            {loading ? 'Processing...' : (isSignup ? 'Create Account' : 'Login')}
          </button>
        </form>

        <div className="mt-4">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or continue with</span>
            </div>
          </div>

          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="mt-4 w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Sign in with Google
          </button>
        </div>

        <div className="mt-6 text-center">
          <button 
            onClick={() => setIsSignup(!isSignup)}
            className="text-sm text-amber-600 hover:underline font-medium"
          >
            {isSignup ? 'Already have an account? Login' : "Don't have an account? Sign up"}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const HomePage = ({ profile, investments, deposits, withdrawals }: { profile: UserProfile | null, investments: Investment[], deposits: Deposit[], withdrawals: Withdrawal[] }) => {
  const activeInvestments = investments.filter(i => i.status === 'active');
  const totalInvested = activeInvestments.reduce((sum, i) => sum + i.amount, 0);

  const pendingDeposits = deposits.filter(d => d.status === 'pending');
  const pendingWithdrawals = withdrawals.filter(w => w.status === 'pending');
  const pendingCount = pendingDeposits.length + pendingWithdrawals.length;

  const allRecent = [
    ...deposits.map(d => ({ ...d, type: 'Deposit', date: d.createdAt })),
    ...withdrawals.map(w => ({ ...w, type: 'Withdrawal', date: w.createdAt })),
    ...investments.map(i => ({ ...i, type: 'Staking', amount: i.amount, date: i.startDate }))
  ].sort((a, b) => {
    const dateA = a.date?.seconds || 0;
    const dateB = b.date?.seconds || 0;
    return dateB - dateA;
  }).slice(0, 5);
  
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-amber-500 to-amber-700 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute -top-4 -right-4 opacity-10 rotate-12">
          <PixiCoin size="lg" />
        </div>
        <p className="text-amber-100 text-sm font-medium">Available Balance</p>
        <h2 className="text-4xl font-bold mt-1">${profile?.balance?.toFixed(2) || '0.00'} USDT</h2>
        <div className="flex space-x-4 mt-6">
          <Link to="/deposit" className="flex-1 bg-white/20 hover:bg-white/30 py-2 rounded-lg text-center font-medium transition-colors backdrop-blur-sm">
            Deposit
          </Link>
          <Link to="/withdrawal" className="flex-1 bg-white text-amber-700 hover:bg-amber-50 py-2 rounded-lg text-center font-medium transition-colors">
            Withdraw
          </Link>
        </div>
      </div>

      {pendingCount > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-100 p-2 rounded-full">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-blue-900">{pendingCount} Pending Operation{pendingCount > 1 ? 's' : ''}</p>
              <p className="text-xs text-blue-700">We are processing your requests.</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex items-start space-x-3">
        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800">
          <span className="font-bold">Important:</span> The minimum withdrawal amount is 10 USDT.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center">
          <div className="flex items-center space-x-2 text-gray-500 mb-2">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wider">PIXI STAKING Status</span>
          </div>
          <p className="text-2xl font-black text-gray-900">${totalInvested.toFixed(2)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center">
          <div className="flex items-center space-x-2 text-gray-500 mb-2">
            <Users className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wider">My Code</span>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-lg font-black text-amber-600">{profile?.referralCode}</p>
            <button 
              onClick={() => {
                navigator.clipboard.writeText(profile?.referralCode || '');
                alert('Copied!');
              }}
              className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center">
          <h3 className="font-bold text-gray-900">Active Investments</h3>
          <Link to="/plans" className="text-xs text-amber-600 font-medium">View All</Link>
        </div>
        <div className="divide-y divide-gray-50">
          {activeInvestments.length > 0 ? activeInvestments.map((inv) => (
            <div key={inv.id} className="p-4 flex justify-between items-center">
              <div>
                <p className="font-medium text-gray-900">${inv.amount} USDT</p>
                <p className="text-xs text-gray-500">{inv.planId.toUpperCase()} PLAN</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-green-600">+${(inv.amount * 0.1).toFixed(2)}/day</p>
                <p className="text-xs text-gray-400">Ends {new Date(inv.endDate?.seconds * 1000).toLocaleDateString()}</p>
              </div>
            </div>
          )) : (
            <div className="p-8 text-center text-gray-500">
              <TrendingUp className="w-12 h-12 mx-auto mb-2 opacity-20" />
              <p>No active investments</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">Recent Activity</h3>
        </div>
        <div className="divide-y divide-gray-50">
          {allRecent.length > 0 ? allRecent.map((item: any) => (
            <div key={item.id} className="p-4 flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${
                  item.type === 'Deposit' ? 'bg-green-50 text-green-600' : 
                  item.type === 'Withdrawal' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                }`}>
                  {item.type === 'Deposit' ? <ArrowDownLeft className="w-4 h-4" /> : 
                   item.type === 'Withdrawal' ? <ArrowUpRight className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                </div>
                <div>
                  <p className="font-bold text-sm text-gray-900">{item.type}</p>
                  <p className="text-[10px] text-gray-400 uppercase font-black">{item.status}</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`font-black text-sm ${item.type === 'Deposit' ? 'text-green-600' : 'text-gray-900'}`}>
                  {item.type === 'Deposit' ? '+' : '-'}${item.amount}
                </p>
                <p className="text-[10px] text-gray-400">
                  {item.createdAt ? new Date(item.createdAt.seconds * 1000).toLocaleDateString() : 'Pending'}
                </p>
              </div>
            </div>
          )) : (
            <div className="p-8 text-center text-gray-500">
              <p className="text-sm">No recent transactions</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const PlansPage = ({ profile, onInvest }: { profile: UserProfile | null, onInvest: (plan: any, amount: number) => Promise<void> }) => {
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<string | null>(null);

  const handleInvest = async (plan: any) => {
    const amount = parseFloat(amounts[plan.id] || '0');
    if (amount < plan.min || amount > plan.max) {
      alert(`Amount must be between ${plan.min} and ${plan.max} USDT`);
      return;
    }
    if (profile && profile.balance < amount) {
      alert('Insufficient balance');
      return;
    }

    setLoading(plan.id);
    try {
      await onInvest(plan, amount);
      // Success is handled by the parent component's showSuccessAndRedirect
    } catch (err: any) {
      let errorMessage = 'An error occurred during staking.';
      try {
        const parsed = JSON.parse(err.message);
        errorMessage = parsed.error || errorMessage;
      } catch {
        errorMessage = err.message || errorMessage;
      }
      alert(errorMessage);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Investment Plans</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {STAKING_PLANS.map((plan) => (
          <div key={plan.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 relative overflow-hidden">
            {plan.oneTime && (
              <div className="absolute top-0 right-0 bg-orange-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg uppercase">
                One Time Only
              </div>
            )}
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                <p className="text-sm text-gray-500">{plan.duration} Days Duration</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black text-amber-600">10%</p>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Daily Payout</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Min Deposit</span>
                <span className="font-bold text-gray-900">${plan.min} USDT</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Max Deposit</span>
                <span className="font-bold text-gray-900">${plan.max} USDT</span>
              </div>
              <div className="pt-4 flex flex-col space-y-3">
                <div className="relative">
                  <input 
                    type="number" 
                    placeholder="Enter amount"
                    value={amounts[plan.id] || ''}
                    onChange={(e) => setAmounts({ ...amounts, [plan.id]: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 bg-gray-50/50"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">USDT</span>
                </div>
                <button 
                  onClick={() => handleInvest(plan)}
                  disabled={loading === plan.id}
                  className="w-full bg-amber-600 text-white py-3 rounded-xl font-bold hover:bg-amber-700 transition-all active:scale-[0.98] disabled:opacity-50 shadow-md shadow-amber-100 flex items-center justify-center space-x-2"
                >
                  {loading === plan.id ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <TrendingUp className="w-4 h-4" />
                      <span>Stake Now</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const DepositPage = ({ profile, user, onSuccess }: { profile: UserProfile | null, user: FirebaseUser, onSuccess: () => void }) => {
  const [network, setNetwork] = useState<'BEP20' | 'TRC20'>('BEP20');
  const [amount, setAmount] = useState('');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [depositStatus, setDepositStatus] = useState<'idle' | 'processing' | 'submitted'>('idle');
  const [copied, setCopied] = useState(false);

  const selectedAddress = network === 'BEP20' ? BEP20_ADDRESS : TRC20_ADDRESS;

  const copyAddress = () => {
    navigator.clipboard.writeText(selectedAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert('File is too large. Max size allowed is 10MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setScreenshot(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const [depositSubStatus, setDepositSubStatus] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!amount || isNaN(numAmount) || numAmount <= 0 || !screenshot) {
      alert('Please enter a valid amount and upload a screenshot.');
      return;
    }
    
    setLoading(true);
    setDepositStatus('processing');
    setDepositSubStatus('Processing info...');

    try {
      let optimizedScreenshot = screenshot;
      try {
        // High compression for ultra-fast database sync
        optimizedScreenshot = await compressImage(screenshot, 450, 450, 0.4);
      } catch (compErr) {
        console.warn('Compression error:', compErr);
      }

      setDepositSubStatus('Syncing with admin...');
      
      const depositRef = doc(collection(db, 'deposits'));
      await setDoc(depositRef, {
        userId: user?.uid || 'unknown',
        userEmail: user?.email || 'no-email',
        amount: numAmount,
        network: network,
        screenshotUrl: optimizedScreenshot, // Use base64 directly for instantaneous submission
        status: 'pending',
        isInternalSeed: false,
        createdAt: serverTimestamp()
      });

      setDepositStatus('submitted');
      setTimeout(() => {
        setDepositStatus('idle');
        setLoading(false);
        onSuccess();
      }, 1500);

    } catch (err: any) {
      setDepositStatus('idle');
      setLoading(false);
      console.error('Deposit submission failed:', err);
      let errMsg = err.message || 'Unknown error';
      if (errMsg.includes('permission-denied')) {
        errMsg = "Verification error. Please refresh and try again.";
      }
      alert('Error: ' + errMsg);
      try {
        handleFirestoreError(err, OperationType.WRITE, 'deposits');
      } catch (e) {}
    }
  };

  return (
    <div className="relative space-y-6">
      <AnimatePresence>
        {depositStatus !== 'idle' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl relative"
            >
              <div className="flex justify-center mb-6">
                {depositStatus === 'processing' ? (
                  <div className="w-16 h-16 border-4 border-amber-100 border-t-amber-600 rounded-full animate-spin" />
                ) : (
                  <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-10 h-10 text-green-600" />
                  </div>
                )}
              </div>
              <h3 className="text-xl font-black text-gray-900 mb-2">
                {depositStatus === 'processing' ? 'Deposit Processing' : 'Deposit Successful'}
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                {depositStatus === 'processing' 
                  ? depositSubStatus 
                  : 'Your deposit request has been submitted and is pending proof verification.'}
              </p>
              {depositStatus === 'processing' && (
                <p className="mt-4 text-[10px] text-gray-400 uppercase tracking-widest font-bold">
                  Do not refresh this page
                </p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <h2 className="text-2xl font-bold text-gray-900">Deposit USDT</h2>
      
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex space-x-2 mb-4 p-1 bg-gray-100 rounded-xl">
          <button 
            onClick={() => setNetwork('BEP20')}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${network === 'BEP20' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            BEP20 (BNB Smart Chain)
          </button>
          <button 
            onClick={() => setNetwork('TRC20')}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${network === 'TRC20' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            TRC20 (TRON)
          </button>
        </div>

        <p className="text-sm text-gray-500 mb-4">Send {network} USDT to the address below:</p>
        <div className="bg-gray-50 p-4 rounded-xl flex items-center justify-between border border-gray-200">
          <code className="text-xs font-mono text-gray-600 break-all mr-2">{selectedAddress}</code>
          <button 
            onClick={copyAddress}
            className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors flex-shrink-0"
          >
            {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Deposit Amount (USDT)</label>
          <input 
            id="deposit-amount-input"
            type="number" 
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="0.00"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Proof of Payment (Screenshot)</label>
          <div className="relative border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-indigo-500 transition-colors group bg-gray-50/50">
            <input 
              id="deposit-screenshot-upload"
              type="file" 
              accept="image/*"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            {screenshot ? (
              <img src={screenshot} alt="Preview" className="max-h-48 mx-auto rounded-lg shadow-sm" />
            ) : (
              <div className="space-y-2">
                <ImageIcon className="w-12 h-12 text-gray-400 mx-auto" />
                <p className="text-sm text-gray-500">Click or drag to upload screenshot</p>
              </div>
            )}
          </div>
        </div>
        <button 
          id="submit-deposit-btn"
          type="submit" 
          disabled={loading || !amount || !screenshot}
          className="w-full bg-amber-600 text-white py-3 rounded-xl font-bold hover:bg-amber-700 transition-colors disabled:opacity-50 shadow-lg shadow-amber-200"
        >
          {loading ? 'Submitting...' : 'Submit Deposit'}
        </button>
      </form>
    </div>
  );
};

const WithdrawalPage = ({ profile, user, onSuccess }: { profile: UserProfile | null, user: FirebaseUser, onSuccess: () => void }) => {
  const [network, setNetwork] = useState<'BEP20' | 'TRC20'>('BEP20');
  const [amount, setAmount] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [withdrawalStatus, setWithdrawalStatus] = useState<'idle' | 'processing' | 'submitted'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    if (!profile || val > profile.balance) {
      alert(`Insufficient balance. Available: ${profile?.balance.toFixed(2)} USDT`);
      return;
    }
    if (val < 10) {
      alert('Minimum withdrawal is 10 USDT');
      return;
    }
    if (!address || address.length < 5) {
      alert('Please enter a valid wallet address');
      return;
    }

    setLoading(true);
    setWithdrawalStatus('processing');
    try {
      const batch = writeBatch(db);
      const withdrawalRef = doc(collection(db, 'withdrawals'));
      
      batch.set(withdrawalRef, {
        userId: user.uid,
        userEmail: user.email || 'no-email',
        amount: val,
        network,
        walletAddress: address,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      
      batch.update(doc(db, 'users', user.uid), {
        balance: increment(-val)
      });

      await batch.commit();

      setWithdrawalStatus('submitted');
      setTimeout(() => {
        setWithdrawalStatus('idle');
        if (onSuccess) onSuccess();
      }, 1500);
    } catch (err: any) {
      setWithdrawalStatus('idle');
      console.error("Withdrawal error:", err);
      let errMsg = err.message || 'Unknown error';
      if (errMsg.includes('permission-denied')) {
        errMsg = "Insufficient funds or access denied. Please check your balance.";
      }
      alert('Withdrawal Failed: ' + errMsg);
      try {
        handleFirestoreError(err, OperationType.WRITE, 'withdrawals');
      } catch (e) {}
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative space-y-6">
      <AnimatePresence>
        {withdrawalStatus !== 'idle' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl"
            >
              <div className="flex justify-center mb-6">
                {withdrawalStatus === 'processing' ? (
                  <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
                ) : (
                  <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-10 h-10 text-green-600" />
                  </div>
                )}
              </div>
              <h3 className="text-xl font-black text-gray-900 mb-2">
                {withdrawalStatus === 'processing' ? 'Withdrawal Processing' : 'Withdrawal Successful'}
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                {withdrawalStatus === 'processing' 
                  ? 'We are processing your withdrawal request. Please wait...' 
                  : 'Your withdrawal request has been submitted and is pending approval.'}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <h2 className="text-2xl font-bold text-gray-900">Withdraw USDT</h2>
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex justify-between items-center mb-6">
          <span className="text-gray-500 font-medium">Available Balance</span>
          <span className="text-xl font-bold text-indigo-600">${profile?.balance.toFixed(2)} USDT</span>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex space-x-2 p-1 bg-gray-100 rounded-xl">
            <button 
              type="button"
              onClick={() => setNetwork('BEP20')}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${network === 'BEP20' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              BEP20 (BSC)
            </button>
            <button 
              type="button"
              onClick={() => setNetwork('TRC20')}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${network === 'TRC20' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              TRC20 (TRON)
            </button>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount to Withdraw</label>
            <input 
              id="withdraw-amount-input"
              type="number" 
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Min. 10 USDT"
            />
            <p className="mt-1 text-xs text-indigo-600 font-medium flex items-center">
              <AlertCircle className="w-3 h-3 mr-1" />
              Minimum withdrawal is 10 USDT
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{network} Wallet Address</label>
            <input 
              id="withdraw-wallet-address-input"
              type="text" 
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder={network === 'BEP20' ? '0x...' : 'T...'}
            />
          </div>
          <button 
            id="submit-withdrawal-btn"
            type="submit" 
            disabled={loading || !amount || !address}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-lg shadow-indigo-200"
          >
            {loading ? 'Processing...' : 'Request Withdrawal'}
          </button>
        </form>
      </div>
    </div>
  );
};

interface Referral {
  id: string;
  referrerUid: string;
  referredUid: string;
  referredEmail: string;
  isActiveInvestor?: boolean;
  commissionEarned?: number;
  createdAt: any;
}

const TeamPage = ({ profile }: { profile: UserProfile | null }) => {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'registered' | 'active'>('registered');
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    if (!profile) return;
    const q = query(collection(db, 'referrals'), where('referrerUid', '==', profile.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setReferrals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'users_referrals');
    });
    return () => unsubscribe();
  }, [profile]);

  const registeredUsers = referrals; // All invited users are registered
  const activeInvestors = referrals.filter(r => r.isActiveInvestor);
  const totalCommissions = profile?.totalCommissionsEarned || 0;

  // Generate a robust referral link that works with the user's custom domain
  const getReferralLink = () => {
    return `https://pixistaking.uk/signup?ref=${profile?.referralCode || ''}`;
  };
  const referralLink = getReferralLink();

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">My Team</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 p-6 rounded-3xl shadow-xl shadow-indigo-100 text-white">
          <p className="text-indigo-100 text-xs font-bold uppercase tracking-wider mb-1">Total Team Size</p>
          <p className="text-4xl font-black mb-4">{referrals.length}</p>
          <div className="flex justify-between text-xs font-medium text-indigo-100 bg-white/10 p-3 rounded-xl">
            <span>Registered: {registeredUsers.length}</span>
            <span>Active: {activeInvestors.length}</span>
          </div>
        </div>
        <div className="bg-gradient-to-br from-green-600 to-green-700 p-6 rounded-3xl shadow-xl shadow-green-100 text-white">
          <p className="text-green-100 text-xs font-bold uppercase tracking-wider mb-1">Earned Commission Balance</p>
          <p className="text-4xl font-black mb-4">${totalCommissions.toFixed(2)}</p>
          <div className="flex items-center text-xs font-medium text-green-100 bg-white/10 p-3 rounded-xl">
            <CheckCircle2 className="w-3 h-3 mr-2" />
            <span>10% per first-time purchase</span>
          </div>
        </div>
      </div>

      {/* Referral Link Section */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex-1 text-left w-full">
          <div className="flex items-center space-x-2 mb-1">
            <Link className="w-3 h-3 text-indigo-600" />
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Your Referral Link</p>
          </div>
          <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100 text-indigo-600 text-[10px] sm:text-xs font-mono break-all">
            {referralLink}
          </div>
        </div>
        <button 
          onClick={() => {
            navigator.clipboard.writeText(referralLink);
            setLinkCopied(true);
            setTimeout(() => setLinkCopied(false), 2000);
          }}
          className={`flex items-center space-x-2 px-6 py-4 rounded-2xl font-bold transition-all w-full sm:w-auto justify-center ${linkCopied ? 'bg-green-500 text-white translate-y-[-2px]' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100'}`}
        >
          {linkCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          <span className="text-sm">{linkCopied ? 'Copied' : 'Copy Link'}</span>
        </button>
      </div>
      
      <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100 text-center">
        <p className="text-sm text-gray-500 mb-4 font-medium uppercase tracking-widest">My Referral Code</p>
        <div className="flex flex-col items-center space-y-5">
          <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-3 bg-amber-50 p-4 sm:p-2 sm:pl-6 rounded-2xl border border-amber-100 w-full max-w-sm justify-between">
            <span className="text-2xl font-black text-amber-600 tracking-widest">{profile?.referralCode}</span>
            <button 
              onClick={() => {
                if (profile?.referralCode) {
                  navigator.clipboard.writeText(profile.referralCode);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }
              }}
              className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-bold text-sm transition-all duration-300 w-full sm:w-auto justify-center ${copied ? 'bg-green-500 text-white scale-105' : 'bg-amber-600 text-white hover:bg-amber-700 shadow-xl shadow-amber-100'}`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>COPIED!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>COPY CODE</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex space-x-2 p-1 bg-gray-100 rounded-2xl w-full max-w-sm">
          <button 
            onClick={() => setActiveTab('registered')}
            className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all ${activeTab === 'registered' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Registered Users ({registeredUsers.length})
          </button>
          <button 
            onClick={() => setActiveTab('active')}
            className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all ${activeTab === 'active' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Active Investors ({activeInvestors.length})
          </button>
        </div>

        <div className="min-h-[200px]">
          {activeTab === 'registered' ? (
            <div className="space-y-3">
              {registeredUsers.length === 0 ? (
                <div className="py-20 text-center bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                  <p className="text-gray-400">No registered users yet.</p>
                </div>
              ) : (
                registeredUsers.map((ref) => (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={ref.id} 
                    className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 font-bold uppercase">
                        {ref.referredEmail.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">{ref.referredEmail}</p>
                        <p className="text-[10px] text-gray-400">Joined: {ref.createdAt?.toDate ? ref.createdAt.toDate().toLocaleDateString() : 'Recent'}</p>
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-gray-100 text-gray-400 text-[10px] rounded-full font-bold uppercase tracking-wider">Registered</span>
                  </motion.div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {activeInvestors.length === 0 ? (
                <div className="py-20 text-center bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                  <p className="text-gray-400">No active investors in your team.</p>
                </div>
              ) : (
                activeInvestors.map((ref) => (
                  <motion.div 
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={ref.id} 
                    className="bg-white p-4 rounded-2xl border border-indigo-100 shadow-sm flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center text-green-600 font-bold uppercase">
                        {ref.referredEmail.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">{ref.referredEmail}</p>
                        <p className="text-[10px] text-green-600 font-medium">Activated: {ref.processedAt?.toDate ? ref.processedAt.toDate().toLocaleDateString() : 'Recent'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="px-3 py-1 bg-green-100 text-green-600 text-[10px] rounded-full font-bold uppercase tracking-wider">Active</span>
                      {ref.commissionEarned && (
                        <p className="text-sm font-black text-green-600 mt-1">+${ref.commissionEarned.toFixed(2)}</p>
                      )}
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const NotificationsPage = ({ user }: { user: FirebaseUser | null }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    
    // Query for both user-specific notifications and global updates
    const q = query(
      collection(db, 'notifications'), 
      where('userId', 'in', [user.uid, 'all']),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'notifications');
    });
    return () => unsubscribe();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const renderMessage = (message: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = message.split(urlRegex);
    return parts.map((part, i) => {
      if (part.match(urlRegex)) {
        return (
          <a 
            key={i} 
            href={part} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-amber-600 font-bold hover:underline break-all"
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
          <Bell className="w-6 h-6 text-amber-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">System Updates</h2>
      </div>

      <div className="space-y-4">
        {notifications.length > 0 ? (
          notifications.map((notif) => (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={notif.id} 
              className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100"
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-gray-900">{notif.title}</h3>
                <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-bold">
                  {notif.createdAt?.seconds ? new Date(notif.createdAt.seconds * 1000).toLocaleDateString() : 'Just now'}
                </span>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">
                {renderMessage(notif.message)}
              </p>
            </motion.div>
          ))
        ) : (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
            <Bell className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-400 font-medium">No updates at the moment</p>
          </div>
        )}
      </div>
    </div>
  );
};

const AdminDashboard = ({ profile }: { profile: UserProfile | null }) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'deposits' | 'withdrawals' | 'investments' | 'notifications'>('users');
  const [userSearch, setUserSearch] = useState('');
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [newBalance, setNewBalance] = useState('');
  const [adminStatus, setAdminStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);

  // Notifications State
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMessage, setNotifMessage] = useState('');
  const [isPostingNotif, setIsPostingNotif] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  useEffect(() => {
    if (adminStatus) {
      const timer = setTimeout(() => setAdminStatus(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [adminStatus]);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshData = async () => {
    setIsRefreshing(true);
    console.log("[Admin] Manual refresh triggered");
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      setUsers(usersSnap.docs.map(d => ({ uid: d.id, ...d.data() } as any)));
      
      const depsSnap = await getDocs(collection(db, 'deposits'));
      setDeposits(depsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
      
      const withsSnap = await getDocs(collection(db, 'withdrawals'));
      setWithdrawals(withsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
      
      const invsSnap = await getDocs(collection(db, 'investments'));
      setInvestments(invsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any)));

      const notifsSnap = await getDocs(collection(db, 'notifications'));
      setNotifications(notifsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
      
      setAdminStatus({ type: 'success', message: 'Data refreshed' });
    } catch (err: any) {
      console.error("[Admin] Refresh error:", err);
      setAdminStatus({ type: 'error', message: 'Refresh failed' });
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    console.log("[Admin] Mounting AdminDashboard, setting up listeners...");

    const unsubUsers = onSnapshot(collection(db, 'users'), (s) => {
      // Sort in memory to avoid missing field issues with firestore query orderBy
      const sortedUsers = s.docs
        .map(d => ({ uid: d.id, ...d.data() } as any))
        .sort((a, b) => {
          const dateA = a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || 0;
          const dateB = b.createdAt?.toMillis?.() || b.createdAt?.seconds * 1000 || 0;
          return dateB - dateA;
        });
      console.log(`[Admin] Loaded ${sortedUsers.length} users`);
      setUsers(sortedUsers);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'admin_users');
    });
    const unsubDeps = onSnapshot(collection(db, 'deposits'), (s) => {
      console.log(`[Admin] onSnapshot received ${s.docs.length} raw docs from deposits`);
      const sortedDeps = s.docs
        .map(d => ({ id: d.id, ...d.data() } as any))
        .filter(d => !d.isInternalSeed) // Hide seed documents
        .sort((a, b) => {
          // Use Date.now() + far future for null/pending server timestamps so they stay at the top
          const nowPlusFuture = Date.now() + 1000000;
          const dateA = a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || nowPlusFuture;
          const dateB = b.createdAt?.toMillis?.() || b.createdAt?.seconds * 1000 || nowPlusFuture;
          return dateB - dateA;
        });
      console.log(`[Admin] Loaded ${sortedDeps.length} deposits`);
      setDeposits(sortedDeps);
      setLastSync(new Date());
    }, (err) => {
      console.error("[Admin] Deposits listener error:", err);
      handleFirestoreError(err, OperationType.LIST, 'admin_deposits');
    });

    // --- NEW: System Initialization Check ---
    const initSystem = async () => {
      try {
        const qD = query(collection(db, 'deposits'), limit(1));
        const sD = await getDocs(qD);
        if (sD.empty) {
          console.log("[Admin] Initializing 'deposits' collection...");
          await addDoc(collection(db, 'deposits'), {
            userId: 'system-init',
            userEmail: 'system@pixi.com',
            amount: 0,
            network: 'BEP20',
            screenshotUrl: 'https://placehold.co/600x400?text=System+Initialization',
            status: 'approved',
            isInternalSeed: true,
            createdAt: serverTimestamp()
          });
        }

        const qW = query(collection(db, 'withdrawals'), limit(1));
        const sW = await getDocs(qW);
        if (sW.empty) {
          console.log("[Admin] Initializing 'withdrawals' collection...");
          await addDoc(collection(db, 'withdrawals'), {
            userId: 'system-init',
            userEmail: 'system@pixi.com',
            amount: 0,
            network: 'BEP20',
            walletAddress: 'SYSTEM_INIT',
            status: 'approved',
            isInternalSeed: true,
            createdAt: serverTimestamp()
          });
        }
      } catch (e) {
        console.warn("[Admin] System initialization skip/fail:", e);
      }
    };
    initSystem();
    const unsubWiths = onSnapshot(collection(db, 'withdrawals'), (s) => {
      const sortedWiths = s.docs
        .map(d => ({ id: d.id, ...d.data() } as any))
        .filter(d => !d.isInternalSeed) // Hide seed documents
        .sort((a, b) => {
          const dateA = a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || Date.now();
          const dateB = b.createdAt?.toMillis?.() || b.createdAt?.seconds * 1000 || Date.now();
          return dateB - dateA;
        });
      setWithdrawals(sortedWiths);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'admin_withdrawals');
    });
    const unsubInvs = onSnapshot(collection(db, 'investments'), (s) => {
      const sortedInvs = s.docs
        .map(d => ({ id: d.id, ...d.data() } as any))
        .sort((a, b) => {
          const dateA = a.startDate?.toMillis?.() || a.startDate?.seconds * 1000 || Date.now();
          const dateB = b.startDate?.toMillis?.() || b.startDate?.seconds * 1000 || Date.now();
          return dateB - dateA;
        });
      setInvestments(sortedInvs);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'admin_investments');
    });
    const unsubNotifs = onSnapshot(collection(db, 'notifications'), (s) => {
      const sortedNotifs = s.docs
        .map(d => ({ id: d.id, ...d.data() } as any))
        .sort((a, b) => {
          const dateA = a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || Date.now();
          const dateB = b.createdAt?.toMillis?.() || b.createdAt?.seconds * 1000 || Date.now();
          return dateB - dateA;
        });
      setNotifications(sortedNotifs);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'admin_notifications');
    });
    return () => { unsubUsers(); unsubDeps(); unsubWiths(); unsubInvs(); unsubNotifs(); };
  }, []);

  const handlePostNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifTitle || !notifMessage) return;
    setIsPostingNotif(true);
    try {
      await addDoc(collection(db, 'notifications'), {
        userId: 'all',
        title: notifTitle,
        message: notifMessage,
        createdAt: serverTimestamp()
      });
      setNotifTitle('');
      setNotifMessage('');
      setAdminStatus({ type: 'success', message: 'Notification posted successfully' });
    } catch (err: any) {
      setAdminStatus({ type: 'error', message: 'Failed to post notification' });
    } finally {
      setIsPostingNotif(false);
    }
  };

  const handleDeleteNotification = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notifications', id));
      setAdminStatus({ type: 'success', message: 'Notification deleted' });
    } catch (err: any) {
      setAdminStatus({ type: 'error', message: 'Failed to delete notification' });
    }
  };

  const handleApproveDeposit = async (dep: Deposit) => {
    if (dep.status !== 'pending') {
      setAdminStatus({ type: 'error', message: 'Deposit is already processed' });
      return;
    }

    try {
      // Ensure we have a valid amount
      const amountToCredit = Number(dep.amount);
      if (isNaN(amountToCredit) || amountToCredit <= 0) {
        setAdminStatus({ type: 'error', message: 'Invalid deposit amount' });
        return;
      }

      // 1. Fetch user document to verify existence
      let userRef = doc(db, 'users', dep.userId);
      let userSnap = await getDoc(userRef);
      let resolvedUserId = dep.userId;

      if (!userSnap.exists()) {
        console.log(`[Admin] User doc not found by ID: ${dep.userId}. Checking fallbacks...`);
        const emailToSearch = dep.userEmail || (dep.userId.includes('@') ? dep.userId : null);
        if (emailToSearch) {
          const q = query(collection(db, 'users'), where('email', '==', emailToSearch.toLowerCase()));
          const querySnap = await getDocs(q);
          if (!querySnap.empty) {
            userRef = querySnap.docs[0].ref;
            userSnap = querySnap.docs[0];
            resolvedUserId = userRef.id;
            console.log(`[Admin] Resolved user doc by email fallback. New UID: ${resolvedUserId}`);
          }
        }
      }

      let isNewProfileCreated = false;
      let newProfileData: UserProfile | null = null;
      let myReferralCode = '';

      if (!userSnap.exists()) {
        console.log(`[Admin] User document not found for resolved UID: ${resolvedUserId}. Auto-generating profile...`);
        myReferralCode = await generateReferralCode();
        newProfileData = {
          uid: resolvedUserId,
          email: dep.userEmail?.toLowerCase() || `${resolvedUserId.slice(0, 8)}@pixistaking.com`,
          balance: amountToCredit,
          totalCommissionsEarned: 0,
          referralCode: myReferralCode,
          referredBy: null,
          role: 'user',
          status: 'active',
          knownDevices: [],
          createdAt: serverTimestamp()
        };
        isNewProfileCreated = true;
      }

      const batch = writeBatch(db);
      
      if (isNewProfileCreated && newProfileData) {
        batch.set(userRef, newProfileData);
        batch.set(doc(db, 'referralCodes', myReferralCode), { uid: resolvedUserId });
      } else {
        // Update user balance
        batch.update(userRef, { 
          balance: increment(amountToCredit) 
        });
      }

      // Update deposit status
      const depRef = doc(db, 'deposits', dep.id);
      batch.update(depRef, { 
        status: 'approved',
        processedAt: serverTimestamp()
      });

      // Send notification to user
      const notifRef = doc(collection(db, 'notifications'));
      batch.set(notifRef, {
        userId: resolvedUserId,
        title: 'Deposit Approved ✅',
        message: `Your deposit of ${amountToCredit} USDT has been approved and credited to your balance.`,
        createdAt: serverTimestamp()
      });

      await batch.commit();
      setAdminStatus({ 
        type: 'success', 
        message: isNewProfileCreated 
          ? 'Profile auto-created, deposit approved and credited!' 
          : 'Deposit approved and balance updated' 
      });
    } catch (err: any) { 
      console.error("Approve Deposit Error:", err);
      const errorMessage = err.message || 'Failed to approve deposit';
      setAdminStatus({ type: 'error', message: errorMessage });
      handleFirestoreError(err, OperationType.WRITE, `approve_deposit_${dep.id}`); 
    }
  };

  const handleRejectDeposit = async (dep: Deposit) => {
    if (dep.status !== 'pending') {
      setAdminStatus({ type: 'error', message: 'Deposit is already processed' });
      return;
    }
    try {
      let resolvedUserId = dep.userId;
      const userRef = doc(db, 'users', dep.userId);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        const emailToSearch = dep.userEmail || (dep.userId.includes('@') ? dep.userId : null);
        if (emailToSearch) {
          const q = query(collection(db, 'users'), where('email', '==', emailToSearch.toLowerCase()));
          const querySnap = await getDocs(q);
          if (!querySnap.empty) {
            resolvedUserId = querySnap.docs[0].id;
          }
        }
      }

      const batch = writeBatch(db);
      batch.update(doc(db, 'deposits', dep.id), { 
        status: 'rejected',
        processedAt: serverTimestamp()
      });

      // Send notification to user
      const notifRef = doc(collection(db, 'notifications'));
      batch.set(notifRef, {
        userId: resolvedUserId,
        title: 'Deposit Rejected ❌',
        message: `Your deposit of ${dep.amount} USDT was rejected. Please contact support or check your transaction details.`,
        createdAt: serverTimestamp()
      });

      await batch.commit();
      setAdminStatus({ type: 'success', message: 'Deposit rejected' });
    } catch (err: any) {
      setAdminStatus({ type: 'error', message: 'Failed to reject deposit' });
      handleFirestoreError(err, OperationType.WRITE, `reject_deposit_${dep.id}`);
    }
  };

  const handleApproveWithdrawal = async (withd: Withdrawal) => {
    if (withd.status !== 'pending') {
      setAdminStatus({ type: 'error', message: 'Withdrawal is already processed' });
      return;
    }
    try {
      let resolvedUserId = withd.userId;
      const userRef = doc(db, 'users', withd.userId);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        const emailToSearch = withd.userEmail || (withd.userId.includes('@') ? withd.userId : null);
        if (emailToSearch) {
          const q = query(collection(db, 'users'), where('email', '==', emailToSearch.toLowerCase()));
          const querySnap = await getDocs(q);
          if (!querySnap.empty) {
            resolvedUserId = querySnap.docs[0].id;
          }
        }
      }

      const batch = writeBatch(db);
      batch.update(doc(db, 'withdrawals', withd.id), { 
        status: 'approved',
        processedAt: serverTimestamp()
      });

      // Send notification to user
      const notifRef = doc(collection(db, 'notifications'));
      batch.set(notifRef, {
        userId: resolvedUserId,
        title: 'Withdrawal Approved ✅',
        message: `Your withdrawal of ${withd.amount} USDT has been approved and processed.`,
        createdAt: serverTimestamp()
      });

      await batch.commit();
      setAdminStatus({ type: 'success', message: 'Withdrawal approved' });
    } catch (err: any) {
      setAdminStatus({ type: 'error', message: 'Failed to approve withdrawal' });
      handleFirestoreError(err, OperationType.WRITE, `approve_withdrawal_${withd.id}`);
    }
  };

  const handleRejectWithdrawal = async (withd: Withdrawal) => {
    if (withd.status !== 'pending') {
      setAdminStatus({ type: 'error', message: 'Withdrawal is already processed' });
      return;
    }
    try {
      let userRef = doc(db, 'users', withd.userId);
      let userSnap = await getDoc(userRef);
      let resolvedUserId = withd.userId;

      if (!userSnap.exists()) {
        console.log(`[Admin] User doc not found by ID: ${withd.userId} for withdrawal refund. Checking fallbacks...`);
        const emailToSearch = withd.userEmail || (withd.userId.includes('@') ? withd.userId : null);
        if (emailToSearch) {
          const q = query(collection(db, 'users'), where('email', '==', emailToSearch.toLowerCase()));
          const querySnap = await getDocs(q);
          if (!querySnap.empty) {
            userRef = querySnap.docs[0].ref;
            userSnap = querySnap.docs[0];
            resolvedUserId = userRef.id;
            console.log(`[Admin] Resolved user doc for withdrawal refund via email: ${resolvedUserId}`);
          }
        }
      }

      if (!userSnap.exists()) {
        setAdminStatus({ type: 'error', message: 'User document not found. Cannot refund balance.' });
        return;
      }

      const batch = writeBatch(db);
      const refundAmount = Number(withd.amount);
      batch.update(userRef, { 
        balance: increment(refundAmount) 
      });
      batch.update(doc(db, 'withdrawals', withd.id), { 
        status: 'rejected',
        processedAt: serverTimestamp()
      });

      // Send notification to user
      const notifRef = doc(collection(db, 'notifications'));
      batch.set(notifRef, {
        userId: resolvedUserId,
        title: 'Withdrawal Rejected ❌',
        message: `Your withdrawal of ${withd.amount} USDT was rejected and funds were refunded to your balance.`,
        createdAt: serverTimestamp()
      });

      await batch.commit();
      setAdminStatus({ type: 'success', message: 'Withdrawal rejected and balance refunded' });
    } catch (err: any) {
      setAdminStatus({ type: 'error', message: 'Failed to reject withdrawal' });
      handleFirestoreError(err, OperationType.WRITE, `reject_withdrawal_${withd.id}`);
    }
  };

  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleUpdateUserStatus = async (userId: string, status: 'active' | 'banned' | 'paused') => {
    try {
      await updateDoc(doc(db, 'users', userId), { status });
      setAdminStatus({ type: 'success', message: `User status updated to ${status}` });
    } catch (err: any) {
      setAdminStatus({ type: 'error', message: 'Failed to update user status' });
      handleFirestoreError(err, OperationType.WRITE, `update_status_${userId}`);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!userId || isDeleting) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      // 1. Delete User Document
      await deleteDoc(doc(db, 'users', userId));
      
      // 2. Cleanup related data
      const collectionsToCleanup = ['investments', 'deposits', 'withdrawals', 'referrals'];
      
      for (const collName of collectionsToCleanup) {
        try {
          if (collName === 'referrals') {
            const q1 = query(collection(db, 'referrals'), where('referredUid', '==', userId));
            const q2 = query(collection(db, 'referrals'), where('referrerUid', '==', userId));
            const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
            
            const batch = writeBatch(db);
            snap1.docs.forEach(d => batch.delete(d.ref));
            snap2.docs.forEach(d => batch.delete(d.ref));
            if (!snap1.empty || !snap2.empty) await batch.commit();
          } else {
            const q = query(collection(db, collName), where('userId', '==', userId));
            const snap = await getDocs(q);
            if (!snap.empty) {
              const batch = writeBatch(db);
              snap.docs.forEach(d => batch.delete(d.ref));
              await batch.commit();
            }
          }
        } catch (cleanupErr) {
          console.error(`Cleanup failed for ${collName}:`, cleanupErr);
          // Continue with other cleanups even if one fails
        }
      }
      setDeletingUserId(null);
      setAdminStatus({ type: 'success', message: 'User and all associated data deleted successfully' });
    } catch (err: any) {
      setDeleteError(err.message || "Failed to delete user. Please check permissions.");
      handleFirestoreError(err, OperationType.DELETE, `users/${userId}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteInvestment = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'investments', id));
      setAdminStatus({ type: 'success', message: 'Investment deleted' });
    } catch (err: any) {
      setAdminStatus({ type: 'error', message: 'Failed to delete investment' });
      handleFirestoreError(err, OperationType.DELETE, `investments/${id}`);
    }
  };

  const handleUpdateBalance = async () => {
    if (!editingUser) return;
    try {
      await updateDoc(doc(db, 'users', editingUser.uid), { balance: parseFloat(newBalance) });
      setEditingUser(null);
      setAdminStatus({ type: 'success', message: 'Balance updated successfully' });
    } catch (err: any) { 
      setAdminStatus({ type: 'error', message: 'Failed to update balance' });
      handleFirestoreError(err, OperationType.WRITE, `update_balance_${editingUser.uid}`); 
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3 mb-1">
            <h2 className="text-3xl font-black text-gray-900 tracking-tight uppercase">Admin Console</h2>
            <div className="flex items-center space-x-1.5 px-2 py-0.5 bg-green-50 rounded-full border border-green-100">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-bold text-green-600 uppercase tracking-wider">
                Live: {deposits.length} Deposits {lastSync && `(Last Sync: ${lastSync.toLocaleTimeString()})`}
              </span>
            </div>
          </div>
          <p className="text-gray-500 font-medium">Monitoring PIXI Ecosystem in Real-time</p>
        </div>
        <button 
          onClick={refreshData}
          disabled={isRefreshing}
          className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-200 transition-all active:scale-[0.98] disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>{isRefreshing ? 'Refreshing...' : 'Refresh Data'}</span>
        </button>
      </div>

      <AnimatePresence>
        {adminStatus && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 right-4 z-[60] p-4 rounded-xl shadow-lg border flex items-center space-x-3 ${
              adminStatus.type === 'success' ? 'bg-green-50 border-green-100 text-green-600' : 'bg-red-50 border-red-100 text-red-600'
            }`}
          >
            {adminStatus.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span className="text-sm font-bold">{adminStatus.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
      
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 font-bold uppercase">Total Users</p>
          <p className="text-2xl font-black text-gray-900">{users.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 font-bold uppercase">Active Inv</p>
          <p className="text-2xl font-black text-green-600">{users.filter(u => u.isActiveInvestor).length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 font-bold uppercase">Pending Dep</p>
          <p className="text-2xl font-black text-orange-600">{deposits.filter(d => d.status === 'pending').length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 font-bold uppercase">Pending With</p>
          <p className="text-2xl font-black text-red-600">{withdrawals.filter(w => w.status === 'pending').length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 font-bold uppercase">Total Inv</p>
          <p className="text-2xl font-black text-purple-600">{investments.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-indigo-600 p-6 rounded-2xl shadow-xl text-white">
          <div className="flex items-center justify-between mb-4">
            <Download className="w-6 h-6 opacity-60" />
            <span className="text-[10px] font-bold uppercase tracking-widest bg-white/20 px-2 py-1 rounded">Total Deposits</span>
          </div>
          <p className="text-3xl font-black">
            ${deposits.filter(d => d.status === 'approved').reduce((acc, curr) => acc + curr.amount, 0).toFixed(2)}
          </p>
          <p className="text-[10px] mt-2 opacity-60 font-bold">Approved transaction volume</p>
        </div>
        
        <div className="bg-red-600 p-6 rounded-2xl shadow-xl text-white">
          <div className="flex items-center justify-between mb-4">
            <Upload className="w-6 h-6 opacity-60" />
            <span className="text-[10px] font-bold uppercase tracking-widest bg-white/20 px-2 py-1 rounded">Total Withdrawals</span>
          </div>
          <p className="text-3xl font-black">
            ${withdrawals.filter(w => w.status === 'approved').reduce((acc, curr) => acc + curr.amount, 0).toFixed(2)}
          </p>
          <p className="text-[10px] mt-2 opacity-60 font-bold">Processed withdrawals</p>
        </div>

        <div className="bg-amber-600 p-6 rounded-2xl shadow-xl text-white">
          <div className="flex items-center justify-between mb-4">
            <TrendingUp className="w-6 h-6 opacity-60" />
            <span className="text-[10px] font-bold uppercase tracking-widest bg-white/20 px-2 py-1 rounded">Invested Capital</span>
          </div>
          <p className="text-3xl font-black">
            ${investments.filter(i => i.status === 'active').reduce((acc, curr) => acc + curr.amount, 0).toFixed(2)}
          </p>
          <p className="text-[10px] mt-2 opacity-60 font-bold">Active staking volume</p>
        </div>
      </div>

      <div className="flex bg-gray-100 p-1 rounded-xl overflow-x-auto no-scrollbar">
        {(['users', 'deposits', 'withdrawals', 'investments', 'notifications'] as const).map((tab) => {
          let count = 0;
          if (tab === 'users') count = users.length;
          if (tab === 'deposits') count = deposits.filter(d => d.status === 'pending').length;
          if (tab === 'withdrawals') count = withdrawals.filter(w => w.status === 'pending').length;
          if (tab === 'investments') count = investments.filter(i => i.status === 'active').length;
          
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 min-w-[100px] py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center space-x-1 ${
                activeTab === tab ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-500'
              }`}
            >
              <span>{tab.charAt(0).toUpperCase() + tab.slice(1)}</span>
              {count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${activeTab === tab ? 'bg-amber-100' : 'bg-gray-200'}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {activeTab === 'users' && (
          <div className="divide-y divide-gray-50">
            <div className="p-4 bg-gray-50/50">
              <input 
                type="text" 
                placeholder="Search users by email or code..." 
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-amber-500 bg-white"
              />
            </div>
            {users.filter(u => {
              if (!u.email) return false;
              const search = userSearch.toLowerCase();
              return (
                u.email.toLowerCase().includes(search) || 
                (u.referralCode?.toLowerCase().includes(search))
              );
            }).map(u => (
              <div key={u.uid} className="p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-bold text-gray-900">{u.email}</p>
                    <p className="text-xs text-gray-500">Balance: ${u.balance.toFixed(2)}</p>
                    <div className="flex items-center mt-1 space-x-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        u.status === 'active' ? 'bg-green-100 text-green-600' : 
                        u.status === 'banned' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'
                      }`}>
                        {u.status || 'active'}
                      </span>
                      {u.isActiveInvestor && (
                        <span className="text-[10px] font-bold bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded uppercase flex items-center">
                          <CheckCircle2 className="w-2.5 h-2.5 mr-1" />
                          Investor
                        </span>
                      )}
                      {u.role === 'admin' && <span className="text-[10px] font-bold bg-purple-100 text-purple-600 px-2 py-0.5 rounded uppercase">Admin</span>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button 
                      onClick={() => { setEditingUser(u); setNewBalance(u.balance.toString()); }}
                      className="text-[10px] bg-amber-50 text-amber-600 px-3 py-1.5 rounded-lg font-bold border border-amber-100 hover:bg-amber-100 transition-colors"
                    >
                      Edit Balance
                    </button>
                    {u.role !== 'admin' && (
                      <>
                        <button 
                          onClick={() => handleUpdateUserStatus(u.uid, u.status === 'banned' ? 'active' : 'banned')}
                          className={`text-[10px] px-3 py-1.5 rounded-lg font-bold border transition-colors ${
                            u.status === 'banned' 
                              ? 'bg-green-50 text-green-600 border-green-100 hover:bg-green-100' 
                              : 'bg-orange-50 text-orange-600 border-orange-100 hover:bg-orange-100'
                          }`}
                        >
                          {u.status === 'banned' ? 'Unban User' : 'Ban User'}
                        </button>
                        <button 
                          onClick={() => handleUpdateUserStatus(u.uid, u.status === 'paused' ? 'active' : 'paused')}
                          className={`text-[10px] px-3 py-1.5 rounded-lg font-bold border transition-colors ${
                            u.status === 'paused' 
                              ? 'bg-green-50 text-green-600 border-green-100 hover:bg-green-100' 
                              : 'bg-gray-50 text-gray-600 border-gray-100 hover:bg-gray-100'
                          }`}
                        >
                          {u.status === 'paused' ? 'Resume' : 'Pause'}
                        </button>
                        <button 
                          onClick={() => setDeletingUserId(u.uid)}
                          className="text-[10px] bg-red-50 text-red-600 px-3 py-1.5 rounded-lg font-bold border border-red-100 hover:bg-red-100 transition-colors"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <AnimatePresence>
          {deletingUserId && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl"
              >
                <h3 className="text-lg font-bold text-gray-900 mb-2">Confirm Deletion</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Are you sure you want to permanently delete this user and all their associated data? This action cannot be undone.
                </p>
                
                {deleteError && (
                  <div className="mb-4 p-3 bg-red-50 text-red-600 text-xs rounded-lg flex items-start space-x-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{deleteError}</span>
                  </div>
                )}

                <div className="flex space-x-3">
                  <button 
                    onClick={() => { setDeletingUserId(null); setDeleteError(null); }}
                    disabled={isDeleting}
                    className="flex-1 py-2 bg-gray-100 text-gray-600 rounded-lg font-bold text-sm disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => handleDeleteUser(deletingUserId)}
                    disabled={isDeleting}
                    className="flex-1 py-2 bg-red-600 text-white rounded-lg font-bold text-sm disabled:opacity-50 flex items-center justify-center"
                  >
                    {isDeleting ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      'Delete'
                    )}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {activeTab === 'deposits' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center px-4 pt-2">
              <h3 className="text-sm font-bold text-gray-500 uppercase flex items-center">
                <Clock className="w-3 h-3 mr-2 text-orange-500" />
                Pending Review: {deposits.filter(d => d.status === 'pending').length}
              </h3>
              <button 
                onClick={refreshData}
                className="text-[10px] font-bold text-indigo-600 hover:underline flex items-center"
              >
                <RefreshCw className={`w-3 h-3 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
                Sync Now
              </button>
            </div>
            <div className="divide-y divide-gray-50">
              {deposits.length === 0 ? (
                <div className="p-12 text-center text-gray-400">
                  <Clock className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p className="font-bold">No deposits found</p>
                </div>
              ) : deposits.map(d => (
                <div key={d.id} className={`p-4 space-y-3 transition-all ${d.status === 'pending' ? 'bg-orange-50/30' : ''}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-bold text-gray-900">{d.userEmail}</p>
                      <div className="flex items-center space-x-2">
                        <p className="text-xl font-black text-amber-600">${d.amount} USDT</p>
                        {d.status === 'pending' && <span className="animate-pulse w-2 h-2 bg-orange-500 rounded-full" />}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {d.network && <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[10px] font-bold uppercase">{d.network}</span>}
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-[10px] font-mono">ID: {d.id}</span>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase border ${
                      d.status === 'pending' ? 'bg-orange-100 text-orange-600 border-orange-200' : 
                      d.status === 'approved' ? 'bg-green-100 text-green-600 border-green-200' : 'bg-red-100 text-red-600 border-red-200'
                    }`}>
                      {d.status}
                    </span>
                  </div>
                  {d.screenshotUrl ? (
                    <div className="relative group">
                      <img src={d.screenshotUrl} alt="Proof" className="w-full max-h-64 object-contain bg-gray-50 rounded-lg border border-gray-100 transition-transform cursor-pointer" 
                        onClick={() => setSelectedScreenshot(d.screenshotUrl)}
                      />
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                         <span className="bg-black/50 text-white text-[10px] px-2 py-1 rounded backdrop-blur-sm">Click to expand</span>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-32 bg-gray-50 rounded-lg flex items-center justify-center border border-dashed border-gray-200">
                      <p className="text-xs text-gray-400">No screenshot provided</p>
                    </div>
                  )}
                  {d.status === 'pending' && (
                    <div className="flex space-x-2 pt-2">
                      <button onClick={() => handleApproveDeposit(d)} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-bold text-sm shadow-sm transition-all active:scale-[0.98]">
                        Approve Deposit
                      </button>
                      <button onClick={() => handleRejectDeposit(d)} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-bold text-sm shadow-sm transition-all active:scale-[0.98]">
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'withdrawals' && (
          <div className="divide-y divide-gray-50">
            {withdrawals.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <Clock className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p className="font-bold">No withdrawals found</p>
              </div>
            ) : withdrawals.map(w => (
              <div key={w.id} className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-bold text-gray-900">{w.userEmail}</p>
                    <p className="text-lg font-black text-red-600">${w.amount} USDT</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase ${
                    w.status === 'pending' ? 'bg-orange-100 text-orange-600' : 
                    w.status === 'approved' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                  }`}>
                    {w.status}
                  </span>
                </div>
                <div className="bg-gray-50 p-2 rounded text-[10px] font-mono break-all border border-gray-100 flex items-center justify-between">
                  <div className="flex-1">
                    <span className="font-bold text-gray-400 mr-2 uppercase">{w.network || 'BEP20'}:</span>
                    {w.walletAddress}
                  </div>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(w.walletAddress);
                      setAdminStatus({ type: 'success', message: 'Address copied!' });
                    }}
                    className="ml-2 p-1 text-gray-400 hover:text-indigo-600 transition-colors"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
                {w.status === 'pending' && (
                  <div className="flex space-x-2">
                    <button onClick={() => handleApproveWithdrawal(w)} className="flex-1 bg-green-600 text-white py-2 rounded-lg font-bold text-sm">Approve</button>
                    <button onClick={() => handleRejectWithdrawal(w)} className="flex-1 bg-red-600 text-white py-2 rounded-lg font-bold text-sm">Reject</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'investments' && (
          <div className="divide-y divide-gray-50">
            {investments.map(inv => (
               <div key={inv.id} className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-bold text-gray-900">{inv.userEmail}</p>
                    <p className="text-xs text-gray-500">{inv.planName}</p>
                    <p className="text-lg font-black text-purple-600">${inv.amount} USDT</p>
                  </div>
                  <div className="flex flex-col items-end space-y-2">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase ${
                      inv.status === 'pending' ? 'bg-orange-100 text-orange-600' : 
                      inv.status === 'active' ? 'bg-green-100 text-green-600' : 
                      inv.status === 'completed' ? 'bg-blue-100 text-blue-600' : 'bg-red-100 text-red-600'
                    }`}>
                      {inv.status}
                    </span>
                    <button 
                      onClick={() => {
                        if (confirm('Are you sure you want to delete this investment?')) {
                          handleDeleteInvestment(inv.id);
                        }
                      }}
                      className="text-[10px] text-red-600 font-bold hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="p-4 space-y-6">
            <form onSubmit={handlePostNotification} className="space-y-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
              <h4 className="font-bold text-gray-900">Post New Update</h4>
              <input 
                type="text" 
                placeholder="Title" 
                required
                value={notifTitle}
                onChange={e => setNotifTitle(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-amber-500"
              />
              <textarea 
                placeholder="Message" 
                required
                value={notifMessage}
                onChange={e => setNotifMessage(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-amber-500 h-24 resize-none"
              />
              <button 
                type="submit" 
                disabled={isPostingNotif}
                className="w-full bg-amber-600 text-white py-2 rounded-lg font-bold hover:bg-amber-700 transition-colors disabled:opacity-50"
              >
                {isPostingNotif ? 'Posting...' : 'Post Update'}
              </button>
            </form>

            <div className="divide-y divide-gray-50">
              {notifications.map(n => (
                <div key={n.id} className="py-4 flex justify-between items-start">
                  <div className="max-w-[80%]">
                    <p className="font-bold text-gray-900">{n.title}</p>
                    <p className="text-xs text-gray-500 mt-1">{n.message}</p>
                  </div>
                  <button 
                    onClick={() => handleDeleteNotification(n.id)}
                    className="text-xs text-red-600 font-bold hover:underline"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-lg mb-4">Edit Balance</h3>
            <p className="text-sm text-gray-500 mb-4">{editingUser.email}</p>
            <input 
              type="number" 
              value={newBalance}
              onChange={(e) => setNewBalance(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4 outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex space-x-2">
              <button onClick={() => setEditingUser(null)} className="flex-1 py-2 font-bold text-gray-500">Cancel</button>
              <button onClick={handleUpdateBalance} className="flex-1 py-2 font-bold bg-amber-600 text-white rounded-lg shadow-md shadow-amber-200">Update</button>
            </div>
          </div>
        </div>
      )}

      {selectedScreenshot && (
        <div 
          className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-[70] cursor-zoom-out"
          onClick={() => setSelectedScreenshot(null)}
        >
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="max-w-4xl w-full max-h-[90vh] flex items-center justify-center"
          >
            <img 
              src={selectedScreenshot} 
              alt="Deposit Proof Full" 
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            />
          </motion.div>
          <button 
            onClick={() => setSelectedScreenshot(null)}
            className="absolute top-6 right-6 text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"
          >
            <CheckCircle2 className="w-8 h-8 rotate-45" /> {/* Using rotate-45 as a quick close icon mockup */}
          </button>
        </div>
      )}

    </div>
  );
};

// --- Main App ---

class ErrorBoundary extends Component<any, any> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Something went wrong.";
      try {
        const parsed = JSON.parse(this.state.error.message);
        if (parsed.error) errorMessage = parsed.error;
      } catch (e) {
        errorMessage = this.state.error.message || errorMessage;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Application Error</h1>
            <p className="text-gray-600 mb-6">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

export default function App() {
  return (
    <Router>
      <ErrorBoundary>
        <AppContent />
      </ErrorBoundary>
    </Router>
  );
}

const SuccessOverlay = ({ message, visible }: { message: string, visible: boolean }) => {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/80 backdrop-blur-xl p-4"
        >
          <motion.div 
            initial={{ scale: 0.8, opacity: 0, y: 40 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: -40 }}
            transition={{ type: 'spring', damping: 25, stiffness: 400 }}
            className="bg-white rounded-[3rem] p-12 max-w-sm w-full text-center shadow-[0_35px_70px_-15px_rgba(0,0,0,0.5)] border border-white/20"
          >
            <div className="relative mb-8">
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: 'spring', stiffness: 200, damping: 15 }}
                className="w-28 h-28 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center mx-auto shadow-2xl shadow-green-200"
              >
                <Check className="w-14 h-14 text-white stroke-[3px]" />
              </motion.div>
              <motion.div 
                animate={{ scale: [1, 1.2, 1], opacity: [0, 0.5, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 bg-green-400 rounded-full blur-2xl -z-10"
              />
            </div>
            
            <h3 className="text-4xl font-black text-gray-900 mb-4 tracking-tight leading-tight">
              {message}
            </h3>
            <p className="text-gray-500 font-bold text-base uppercase tracking-widest opacity-60">
              Processing...
            </p>
            
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              transition={{ duration: 1.5, ease: "easeInOut" }}
              className="h-1.5 bg-green-500 rounded-full mt-10 mx-auto max-w-[100px]"
            />
            
            <p className="mt-8 text-sm font-semibold text-gray-400">
              Returning to Dashboard
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// --- Utilities ---
const generateReferralCode = async () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  let unique = false;
  let attempts = 0;

  while (!unique && attempts < 10) {
    code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    // Check uniqueness in referralCodes collection
    const refDoc = await getDoc(doc(db, 'referralCodes', code));
    if (!refDoc.exists()) {
      unique = true;
    }
    attempts++;
  }
  return code;
};

const getDeviceId = () => {
  let id = localStorage.getItem('pixi_device_id');
  if (!id) {
    id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('pixi_device_id', id);
  }
  return id;
};

const EmailVerificationPage = ({ user, onLogout, onDeviceVerified }: { user: FirebaseUser, onLogout: () => void, onDeviceVerified?: () => void }) => {
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const handleResend = async () => {
    setSending(true);
    try {
      await sendEmailVerification(user);
      setMessage('Verification email sent! Please check your inbox.');
    } catch (err: any) {
      if (err.code === 'auth/too-many-requests') {
        setMessage('Too many requests. Please wait a moment.');
      } else {
        setMessage(err.message || 'Error sending email.');
      }
    } finally {
      setSending(false);
    }
  };

  const handleRefresh = async () => {
    try {
      await reload(user);
      if (user.emailVerified) {
        setMessage('Email verified! Authorizing your device...');
        setTimeout(() => {
          if (onDeviceVerified) onDeviceVerified();
        }, 1000);
      } else {
        setMessage('Email not verified yet. Please check your inbox.');
      }
    } catch (err: any) {
      setMessage(err.message || 'Error refreshing status.');
    }
  };

  const handleAuthorizeDevice = async () => {
    setIsVerifying(true);
    try {
      // Small simulated delay for security verification feel
      await new Promise(resolve => setTimeout(resolve, 800));
      if (onDeviceVerified) onDeviceVerified();
    } catch (err: any) {
      setMessage('Authorization failed. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl p-10 text-center ring-1 ring-gray-100"
      >
        <div className="w-24 h-24 bg-indigo-100 rounded-3xl flex items-center justify-center mx-auto mb-8 text-indigo-600 shadow-inner">
          <Mail className="w-12 h-12" />
        </div>

        {user.emailVerified ? (
          <>
            <h1 className="text-3xl font-black text-gray-900 mb-3 tracking-tight">New Device Detected</h1>
            <p className="text-gray-500 mb-8 font-medium leading-relaxed">
              We detected a login from a new device for <br/>
              <span className="text-indigo-600 font-bold">{user.email}</span>. <br/>
              Since your email is already verified, please confirm to continue.
            </p>
            
            <button 
              onClick={handleAuthorizeDevice}
              disabled={isVerifying}
              className="w-full bg-indigo-600 text-white rounded-2xl py-5 font-black text-lg shadow-[0_10px_20px_-5px_rgba(79,70,229,0.4)] hover:shadow-[0_15px_30px_-10px_rgba(79,70,229,0.5)] transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {isVerifying ? (
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <CheckCircle2 className="w-6 h-6" />
                  Authorize This Device
                </>
              )}
            </button>
            <p className="mt-6 text-gray-400 text-[10px] font-bold uppercase tracking-widest">
              Identity Confirmed via Google/Firebase
            </p>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-black text-gray-900 mb-3 tracking-tight">Verify Your Email</h1>
            <p className="text-gray-500 mb-8 font-medium leading-relaxed">
              We've sent a verification link to <br/>
              <span className="text-indigo-600 font-bold text-lg">{user.email}</span>. <br/>
              Please click it to activate your account.
            </p>
            
            <div className="mb-8 p-4 bg-amber-50 rounded-2xl border border-amber-100">
              <p className="text-amber-800 text-xs font-bold uppercase tracking-wider mb-1">Important</p>
              <p className="text-amber-700 text-sm font-medium">
                If you don't see the email, check your <span className="font-bold underline">Spam or Junk</span> folder.
              </p>
            </div>
            
            <div className="space-y-4">
              <button 
                onClick={handleRefresh}
                className="w-full bg-indigo-600 text-white rounded-2xl py-5 font-black text-lg shadow-[0_10px_20px_-5px_rgba(79,70,229,0.4)] hover:shadow-[0_15px_30px_-10px_rgba(79,70,229,0.5)] transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <span>Verify & Authorize</span>
                <CheckCircle2 className="w-5 h-5" />
              </button>

              <button 
                onClick={handleResend}
                disabled={sending}
                className="w-full bg-white text-indigo-600 border-2 border-indigo-50 rounded-2xl py-4 font-bold transition-all hover:bg-indigo-50/50 disabled:opacity-50"
              >
                {sending ? 'Sending...' : 'Resend Verification Link'}
              </button>
            </div>
          </>
        )}
        
        {message && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mt-6 p-4 rounded-2xl text-sm font-bold ${message.includes('Error') || message.includes('failed') || message.includes('not verified') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}
          >
            {message}
          </motion.div>
        )}

        <button 
          onClick={onLogout}
          className="mt-8 text-gray-400 hover:text-red-500 font-bold transition-colors flex items-center justify-center gap-2 mx-auto text-sm"
        >
          <LogOut className="w-4 h-4" />
          Logout & Try Another Account
        </button>
      </motion.div>
    </div>
  );
};

const ContactPage = () => {
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });
  const [isSent, setIsSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSent(true);
    setTimeout(() => {
      setIsSent(false);
      setFormData({ name: '', email: '', subject: '', message: '' });
    }, 3000);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-10 pb-16"
    >
      <div className="text-center space-y-4">
        <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
          <Mail className="w-8 h-8 text-amber-600" />
        </div>
        <h1 className="text-4xl font-black text-gray-900 tracking-tight uppercase">Contact Us</h1>
        <p className="text-gray-500 max-w-lg mx-auto leading-relaxed">
          Have questions about your stakes, commissions, or need technical assistance? Our dedicated support team is here to help you 24/7.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <a 
          href="mailto:support@pixistaking.uk" 
          className="flex flex-col items-center text-center p-6 bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-4">
            <Mail className="w-6 h-6" />
          </div>
          <span className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mb-1">Email Support</span>
          <span className="text-sm font-semibold text-gray-900 break-all">support@pixistaking.uk</span>
        </a>

        <a 
          href="https://t.me/pixistakingofficial" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex flex-col items-center text-center p-6 bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="w-12 h-12 bg-sky-50 text-sky-500 rounded-xl flex items-center justify-center mb-4">
            <Send className="w-6 h-6" />
          </div>
          <span className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mb-1">Telegram Community</span>
          <span className="text-sm font-semibold text-gray-900">@pixistakingofficial</span>
        </a>

        <a 
          href="https://pixistaking.uk" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex flex-col items-center text-center p-6 bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mb-4">
            <Globe className="w-6 h-6" />
          </div>
          <span className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mb-1">Official Website</span>
          <span className="text-sm font-semibold text-gray-900">pixistaking.uk</span>
        </a>
      </div>

      <div className="bg-white p-8 sm:p-10 rounded-[2.5rem] border border-gray-100 shadow-sm">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center font-sans tracking-tight">Send Us a Direct Message</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Your Name</label>
              <input 
                type="text" 
                required
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors bg-gray-50/50"
                placeholder="Enter your name"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Email Address</label>
              <input 
                type="email" 
                required
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors bg-gray-50/50"
                placeholder="you@email.com"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Subject</label>
            <input 
              type="text" 
              required
              value={formData.subject}
              onChange={e => setFormData({ ...formData, subject: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors bg-gray-50/50"
              placeholder="What is this regarding?"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Message</label>
            <textarea 
              rows={4}
              required
              value={formData.message}
              onChange={e => setFormData({ ...formData, message: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors bg-gray-50/50 resize-none"
              placeholder="Write your message here..."
            />
          </div>

          <button 
            type="submit"
            disabled={isSent}
            className={`w-full py-4 rounded-xl font-bold transition-all shadow-md flex items-center justify-center space-x-2 ${
              isSent 
                ? 'bg-green-500 text-white' 
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
          >
            {isSent ? (
              <>
                <Check className="w-5 h-5 animate-bounce" />
                <span>Message Sent Successfully!</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Send Message</span>
              </>
            )}
          </button>
        </form>
      </div>
    </motion.div>
  );
};

const PrivacyPage = () => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-10 pb-16"
    >
      <div className="text-center space-y-4">
        <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
          <Shield className="w-8 h-8 text-amber-600" />
        </div>
        <h1 className="text-4xl font-black text-gray-900 tracking-tight uppercase">Privacy Policy</h1>
        <p className="text-gray-500 max-w-lg mx-auto leading-relaxed">
          Learn how PIXI STAKING secures, processes, and protects your account details and digital transaction histories.
        </p>
      </div>

      <div className="bg-white p-8 sm:p-12 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-8 text-gray-600 leading-relaxed">
        <p className="border-b border-gray-100 pb-6 text-sm text-gray-400 font-semibold uppercase tracking-wider">
          Last Updated: June 2026
        </p>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <span className="w-1.5 h-6 bg-indigo-600 rounded-full" />
            1. Information We Collect
          </h2>
          <p className="text-sm">
            At PIXI STAKING, we value your privacy above all else. In order to provide reliable system access and secure staking rewards distributions, we collect the following types of information:
          </p>
          <ul className="list-disc pl-5 text-sm space-y-1">
            <li><strong>Account Profiles:</strong> Your email address, username, login authentication logs, and local account permissions.</li>
            <li><strong>Staking & Transaction Data:</strong> Records of deposits, choices of staking plan coefficients, calculations of earned commissions, and withdrawal configurations.</li>
            <li><strong>Device Security Metadata:</strong> Distinct secure device identifier hash keys to protect your account against multi-device bypasses.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <span className="w-1.5 h-6 bg-indigo-600 rounded-full" />
            2. How We Use Your Data
          </h2>
          <p className="text-sm">
            We operate strictly within user-centric parameters to execute your investment requests. The gathered information is processed solely to:
          </p>
          <ul className="list-disc pl-5 text-sm space-y-1">
            <li>Calculate active staking interest compound loops securely.</li>
            <li>Issue real-time in-app notifications and alerts about approvals.</li>
            <li>Affiliate tracking linking team code referrals to real earned commission multipliers.</li>
            <li>Verify devices securely using our cryptographically unique system hashes.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <span className="w-1.5 h-6 bg-indigo-600 rounded-full" />
            3. Data Retention and Safety Protocols
          </h2>
          <p className="text-sm">
            All user balances, staking contracts, and deposit receipts are verified and retained securely via Cloud Firestore with secure validation rules. Direct client accesses are authenticated via Google Firebase security infrastructure. Your system secrets and database records are double-guarded using high-grade end-to-end industry encryptions.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <span className="w-1.5 h-6 bg-indigo-600 rounded-full" />
            4. Third-Party Sharing Rules
          </h2>
          <p className="text-sm">
            PIXI STAKING does not rent, sell, or trade your personal analytical logs or storage identifiers to any third-party marketing entities. Information is shared only with our direct cloud service partners (such as Firebase Authentication & Storage engines) required strictly to execute active core app functions.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <span className="w-1.5 h-6 bg-indigo-600 rounded-full" />
            5. Cookies and Local Storage
          </h2>
          <p className="text-sm">
            We use browser <code className="bg-gray-100 text-xs text-indigo-600 px-1 py-0.5 rounded font-mono">localStorage</code> components strictly to maintain safe session identities, system device validations, and prevent annoying forced re-authentications during consistent app loops.
          </p>
        </section>
      </div>
    </motion.div>
  );
};

const TermsPage = () => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-10 pb-16"
    >
      <div className="text-center space-y-4">
        <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
          <FileText className="w-8 h-8 text-amber-600" />
        </div>
        <h1 className="text-4xl font-black text-gray-900 tracking-tight uppercase">Terms & Conditions</h1>
        <p className="text-gray-500 max-w-lg mx-auto leading-relaxed">
          Please read these guidelines thoroughly. They define the binding agreement for interacting with PIXI STAKING packages.
        </p>
      </div>

      <div className="bg-white p-8 sm:p-12 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-8 text-gray-600 leading-relaxed">
        <p className="border-b border-gray-100 pb-6 text-sm text-gray-400 font-semibold uppercase tracking-wider">
          Last Updated: June 2026
        </p>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <span className="w-1.5 h-6 bg-indigo-600 rounded-full" />
            1. User Agreement Acceptance
          </h2>
          <p className="text-sm">
            By creating an account, registering profiles, depositing funds, or initiating staking programs on PIXI STAKING (<a href="https://pixistaking.uk" target="_blank" rel="noopener noreferrer" className="text-indigo-600 font-bold hover:underline">pixistaking.uk</a>), you declare that you have read, understood, and agreed to be legally bound by these entire Terms. If you do not accept these codes, you must suspend your access immediately.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <span className="w-1.5 h-6 bg-indigo-600 rounded-full" />
            2. Staking Calculations & Interest Plans
          </h2>
          <p className="text-sm">
            Any capital locked inside PIXI STAKING compound products acts strictly on the specified plan coefficients:
          </p>
          <ul className="list-disc pl-5 text-sm space-y-1">
            <li>Deposited digital balances cannot be traded or withdrawn while locked in an active plan tenure.</li>
            <li>Accrued daily yields, payouts, and commissions are credited to your active wallet balance according to individual mathematical program constraints.</li>
            <li>All investment processes are governed by decentralised, non-reversible, immutable tracking hooks.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <span className="w-1.5 h-6 bg-indigo-600 rounded-full" />
            3. Account Verification & Device Limits
          </h2>
          <p className="text-sm">
            To combat multi-account sybil attacks and duplicate bonus farming exploits:
          </p>
          <ul className="list-disc pl-5 text-sm space-y-1">
            <li>Users are strictly permitted only ONE active profile. Multi-accounts linked to identical referrals will trigger automated security locking.</li>
            <li>Any access from unknown devices triggers a hardware protection validation layer. Logging in across unverified locations requires administrative approval.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <span className="w-1.5 h-6 bg-indigo-600 rounded-full" />
            4. Referral Commissions Policy
          </h2>
          <p className="text-sm">
            The platform offers referral bonuses to reward genuine network expansion. Commissions are only validated on real deposits made by new unique referrals who complete their profiles. Attempting self-referring tricks, false signups, or creating duplicate chains under one's own codes results in immediate forfeiture of all balances and permanent system bans.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <span className="w-1.5 h-6 bg-indigo-600 rounded-full" />
            5. Disclaimer of Digital Assets Risk
          </h2>
          <p className="text-sm font-bold text-amber-700 bg-amber-50 p-4 rounded-xl border border-amber-100 flex items-start gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            Staking digital currencies and participating in crypto projects carries high levels of market and security risks. You acknowledge that PIXI STAKING is not a centralized financial banking institution. Staking returns can fluctuate depending on global asset conditions, and you are entirely responsible for lockup choices. Only stake funds you can afford.
          </p>
        </section>
      </div>
    </motion.div>
  );
};

const Footer = () => {
  return (
    <footer className="mt-16 border-t border-gray-200 pt-8 pb-12 text-center">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-gray-500 max-w-5xl mx-auto px-4">
        <p className="font-medium text-gray-400">
          Copyright © {new Date().getFullYear()} <span className="font-bold text-indigo-600">PIXI STAKING</span>. All rights reserved.
        </p>
        <div className="flex flex-wrap justify-center gap-6 font-bold text-gray-600">
          <Link to="/contact" className="hover:text-amber-600 hover:underline transition-colors uppercase tracking-wider text-xs">Contact Us</Link>
          <Link to="/privacy" className="hover:text-amber-600 hover:underline transition-colors uppercase tracking-wider text-xs">Privacy Policy</Link>
          <Link to="/terms" className="hover:text-amber-600 hover:underline transition-colors uppercase tracking-wider text-xs">Terms & Conditions</Link>
        </div>
      </div>
    </footer>
  );
};

function AppContent() {
  const navigate = useNavigate();

  // Firestore Connection Sync Test
  useEffect(() => {
    const syncTest = async () => {
      try {
        // Essential test to ensure Firestore is reachable
        await getDocFromServer(doc(db, 'system', 'connection_health'));
      } catch (err: any) {
        if (err.message?.includes('the client is offline')) {
          console.error("Firebase Sync Error: Client is offline. Database connection interrupted.");
        } else {
          console.log("Firebase Database synchronized and live.");
        }
      }
    };
    syncTest();
  }, []);

  // Canonical router redirect for clean URLs on custom domain
  useEffect(() => {
    const pathname = window.location.pathname.replace(/\/$/, ''); // strip trailing slash
    const search = window.location.search;
    if (pathname === '/signup' || pathname === '/login') {
      window.location.replace(`/#${pathname}${search}`);
    }
  }, []);

  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [notifs, setNotifs] = useState<any[]>([]);
  const [allInvestments, setAllInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isNewDevice, setIsNewDevice] = useState(false);
  const [notification, setNotification] = useState<{ message: string, visible: boolean }>({ message: '', visible: false });

  const showSuccessAndRedirect = (message: string) => {
    setNotification({ message, visible: true });
    setTimeout(() => {
      setNotification({ message: '', visible: false });
      navigate('/');
    }, 1500);
  };

  const handleDeviceVerified = async () => {
    if (!user || !profile) return;
    const deviceId = getDeviceId();
    const userRef = doc(db, 'users', user.uid);
    const updatedKnownDevices = [...(profile.knownDevices || []), deviceId];
    try {
      await updateDoc(userRef, { knownDevices: updatedKnownDevices });
      setIsNewDevice(false);
    } catch (err) {
      console.error("Failed to register device:", err);
    }
  };

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        setProfile(null);
        setInvestments([]);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Data Listener
  useEffect(() => {
    if (!user) return;

    const userRef = doc(db, 'users', user.uid);
    const unsubProfile = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as UserProfile;
        const currentDeviceId = getDeviceId();
        const devices = data.knownDevices || [];
        
        // Strict: Any account (User or Admin) on a new device must verify
        if (!devices.includes(currentDeviceId)) {
          setIsNewDevice(true);
        } else {
          setIsNewDevice(false);
        }

        // Auto-generate referral code for legacy users if missing
        if (!data.referralCode) {
          generateReferralCode().then(code => {
            const batch = writeBatch(db);
            batch.update(userRef, { referralCode: code });
            batch.set(doc(db, 'referralCodes', code), { uid: user.uid });
            batch.commit().catch(console.error);
          });
        }

        // Auto-fix admin role for recognized ADMIN_EMAILS
        if (ADMIN_EMAILS.includes(user.email || '')) {
          if (data.role !== 'admin') {
             updateDoc(userRef, { role: 'admin' }).catch(console.error);
          }
          setProfile({ uid: user.uid, ...data, role: 'admin' } as UserProfile);
        } else {
          setProfile({ uid: user.uid, ...data } as UserProfile);
        }
      } else if (ADMIN_EMAILS.includes(user.email || '')) {
        // Create missing admin profile
        generateReferralCode().then(myReferralCode => {
          const profileData: UserProfile = {
            uid: user.uid,
            email: user.email || 'admin@pixi.com',
            balance: 0,
            totalCommissionsEarned: 0,
            referralCode: myReferralCode,
            referredBy: null,
            role: 'admin',
            status: 'active',
            knownDevices: [getDeviceId()],
            createdAt: serverTimestamp()
          };
          const batch = writeBatch(db);
          batch.set(userRef, profileData);
          batch.set(doc(db, 'referralCodes', myReferralCode), { uid: user.uid });
          batch.commit().catch(console.error);
          setProfile(profileData);
        });
      } else {
        // Create missing regular user profile
        generateReferralCode().then(myReferralCode => {
          const profileData: UserProfile = {
            uid: user.uid,
            email: user.email || `${user.uid.slice(0, 8)}@pixistaking.com`,
            balance: 0,
            totalCommissionsEarned: 0,
            referralCode: myReferralCode,
            referredBy: null,
            role: 'user',
            status: 'active',
            knownDevices: [getDeviceId()],
            createdAt: serverTimestamp()
          };
          const batch = writeBatch(db);
          batch.set(userRef, profileData);
          batch.set(doc(db, 'referralCodes', myReferralCode), { uid: user.uid });
          batch.commit().catch(console.error);
          setProfile(profileData);
        });
      }
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
    });

    const qInvs = query(collection(db, 'investments'), where('userId', '==', user.uid));
    const unsubInvestments = onSnapshot(qInvs, (snap) => {
      setInvestments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Investment)));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'investments');
    });

    const qDeps = query(collection(db, 'deposits'), where('userId', '==', user.uid));
    const unsubDeposits = onSnapshot(qDeps, (snap) => {
      setDeposits(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)).filter(d => !d.isInternalSeed));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'deposits');
    });

    const qWiths = query(collection(db, 'withdrawals'), where('userId', '==', user.uid));
    const unsubWithdrawals = onSnapshot(qWiths, (snap) => {
      setWithdrawals(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)).filter(d => !d.isInternalSeed));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'withdrawals');
    });

    const qNotifs = query(collection(db, 'notifications'), where('userId', 'in', [user.uid, 'all']));
    const unsubNotifs = onSnapshot(qNotifs, (snap) => {
      setNotifs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'notifications_listener');
    });

    let unsubAllInvestments = () => {};
    if (profile?.role === 'admin') {
      unsubAllInvestments = onSnapshot(query(collection(db, 'investments'), where('status', '==', 'active')), (snap) => {
        setAllInvestments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Investment)));
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, 'all_investments');
      });
    }

    return () => {
      unsubProfile();
      unsubInvestments();
      unsubDeposits();
      unsubWithdrawals();
      unsubNotifs();
      unsubAllInvestments();
    };
  }, [user, profile?.role]);

  const handleLogin = async (email: string, pass: string, isSignup: boolean, referralCode?: string) => {
    // Map custom admin username to admin email
    let targetEmail = email;
    if (email.toLowerCase() === ADMIN_USERNAME.toLowerCase()) {
      targetEmail = "adminpixi25@gmail.com";
    }

    try {
      const isAdmin = ADMIN_EMAILS.includes(targetEmail);

      if (isSignup) {
        if (referralCode) {
          // Verify referral code exists (Check dedicated collection first, then fallback to users collection for backward compatibility)
          let codeExists = false;
          const refDoc = await getDoc(doc(db, 'referralCodes', referralCode));
          if (refDoc.exists()) {
            codeExists = true;
          } else {
            // Fallback for codes generated before the dedicated collection was added
            const q = query(collection(db, 'users'), where('referralCode', '==', referralCode));
            const userSnap = await getDocs(q);
            codeExists = !userSnap.empty;
          }

          if (!codeExists && !isAdmin) {
            throw new Error('Invalid referral code. Please check and try again.');
          }
        }

        const { user: newUser } = await createUserWithEmailAndPassword(auth, targetEmail, pass);
        const myReferralCode = await generateReferralCode();
        
        const profileData: UserProfile = {
          uid: newUser.uid,
          email: targetEmail.toLowerCase(),
          balance: 0,
          totalCommissionsEarned: 0,
          referralCode: myReferralCode,
          referredBy: referralCode || null,
          role: ADMIN_EMAILS.includes(targetEmail.toLowerCase()) ? 'admin' : 'user',
          status: 'active',
          knownDevices: [getDeviceId()],
          createdAt: serverTimestamp()
        };
        
        try {
          const batch = writeBatch(db);
          batch.set(doc(db, 'users', newUser.uid), profileData);
          batch.set(doc(db, 'referralCodes', myReferralCode), { uid: newUser.uid });
          
          // Welcome notification
          batch.set(doc(collection(db, 'notifications')), {
            userId: newUser.uid,
            title: 'Welcome to PIXI STAKING!',
            message: 'Your account is ready. Start your journey by making your first deposit and staking in our plans.',
            createdAt: serverTimestamp()
          });
          
          // Create referral record if referred
          if (referralCode) {
            const q = query(collection(db, 'users'), where('referralCode', '==', referralCode));
            const referrerSnap = await getDocs(q);
            if (!referrerSnap.empty) {
              const referrerDoc = referrerSnap.docs[0];
              batch.set(doc(db, 'referrals', newUser.uid), {
                referrerUid: referrerDoc.id,
                referredUid: newUser.uid,
                referredEmail: targetEmail.toLowerCase(),
                isActiveInvestor: false,
                commissionEarned: 0,
                createdAt: serverTimestamp()
              });
            }
          }
          await batch.commit();
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `signup_batch_${newUser.uid}`);
        }
        setProfile(profileData);
      } else {
        try {
          await signInWithEmailAndPassword(auth, targetEmail, pass);
        } catch (err: any) {
          // If login fails and it matches our "inbuilt" admin credentials, try to restore
          const isRestorableAdmin = (ADMIN_EMAILS.includes(email) || email === ADMIN_USERNAME) && pass === ADMIN_PASSWORD;
          
          if (isRestorableAdmin && (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password')) {
            console.log("Admin account mismatch, attempting to restore/signup...");
            try {
              // Ensure we use the mapped targetEmail for creation
              await createUserWithEmailAndPassword(auth, targetEmail, pass);
              // Profile will be auto-created by the Data Listener useEffect
            } catch (signupErr: any) {
              // If signup fails because email is already in use, it means the user exists but password was wrong
              if (signupErr.code === 'auth/email-already-in-use') {
                throw err; // Throw original login error
              }
              
              if (email === ADMIN_USERNAME) {
                try {
                  await signInWithEmailAndPassword(auth, ADMIN_EMAIL, pass);
                  return;
                } catch (retryErr) {
                  throw err;
                }
              }
              throw err;
            }
          } else {
            throw err;
          }
        }
      }
    } catch (err: any) {
      console.error("Login error:", err);
      throw err;
    }
  };

  const handleGoogleLogin = async (referralCode?: string) => {
    try {
      const provider = new GoogleAuthProvider();
      const { user: googleUser } = await signInWithPopup(auth, provider);
      
      const userRef = doc(db, 'users', googleUser.uid);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        // New user! 
        const isAdmin = ADMIN_EMAILS.includes(googleUser.email || '');
        
        if (referralCode) {
          // Verify referral code exists (Check dedicated collection first, then fallback to users collection)
          let codeExists = false;
          const refDoc = await getDoc(doc(db, 'referralCodes', referralCode));
          if (refDoc.exists()) {
            codeExists = true;
          } else {
            const q = query(collection(db, 'users'), where('referralCode', '==', referralCode));
            const userSnap = await getDocs(q);
            codeExists = !userSnap.empty;
          }

          if (!codeExists && !isAdmin) {
            throw new Error('Invalid referral code. Please check and try again.');
          }
        }

        const userEmail = googleUser.email?.toLowerCase() || "";
        const myReferralCode = await generateReferralCode();
        const profileData: UserProfile = {
          uid: googleUser.uid,
          email: userEmail,
          balance: 0,
          totalCommissionsEarned: 0,
          referralCode: myReferralCode,
          referredBy: referralCode || null,
          role: ADMIN_EMAILS.includes(userEmail) ? 'admin' : 'user',
          status: 'active',
          knownDevices: [getDeviceId()],
          createdAt: serverTimestamp()
        };
        
        try {
          const batch = writeBatch(db);
          batch.set(userRef, profileData);
          batch.set(doc(db, 'referralCodes', myReferralCode), { uid: googleUser.uid });
          await batch.commit();

          // Create referral record if referred
          if (referralCode) {
            const q = query(collection(db, 'users'), where('referralCode', '==', referralCode));
            const referrerSnap = await getDocs(q);
            if (!referrerSnap.empty) {
              const referrerDoc = referrerSnap.docs[0];
              await setDoc(doc(db, 'referrals', googleUser.uid), {
                referrerUid: referrerDoc.id,
                referredUid: googleUser.uid,
                referredEmail: userEmail,
                isActiveInvestor: false,
                commissionEarned: 0,
                createdAt: serverTimestamp()
              });
            }
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${googleUser.uid}`);
        }
        setProfile(profileData);
      }
    } catch (err: any) {
      console.error("Google login error:", err);
      throw err;
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  const handleInvest = async (plan: any, amount: number) => {
    if (!user || !profile) return;

    // Security: Enforce min/max in backend logic
    if (amount < plan.min || amount > plan.max) {
      throw new Error(`Invalid amount. For ${plan.name}, amount must be between ${plan.min} and ${plan.max} USDT.`);
    }

    if (profile.balance < amount) {
      throw new Error('Insufficient balance to perform this operation.');
    }

    // Check if it's the first investment for referral commission
    const allInvQuery = query(collection(db, 'investments'), where('userId', '==', user.uid));
    const allInvSnap = await getDocs(allInvQuery);
    const isFirstInvestment = allInvSnap.empty;

    if (plan.oneTime) {
      const q = query(collection(db, 'investments'), where('userId', '==', user.uid), where('planId', '==', plan.id));
      const snap = await getDocs(q);
      if (!snap.empty) {
        throw new Error(`${plan.name} can only be purchased once.`);
      }
    }

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + plan.duration);

    const investmentData = {
      userId: user.uid,
      userEmail: user.email || 'no-email',
      amount: Number(amount),
      planId: plan.id,
      planName: plan.name || 'Standard Plan',
      startDate: serverTimestamp(),
      endDate: Timestamp.fromDate(endDate),
      lastPayoutDate: serverTimestamp(),
      status: 'active'
    };

    try {
      const batch = writeBatch(db);
      
      // 1. Create Investment
      const invRef = doc(collection(db, 'investments'));
      batch.set(invRef, investmentData);

      // 2. Update user state: Deduct balance AND mark as active investor
      batch.update(doc(db, 'users', user.uid), {
        balance: increment(-amount),
        isActiveInvestor: true
      });

      // 3. Handle Referral Commission (10%) - ONLY for the first investment
      if (isFirstInvestment && profile.referredBy) {
        // Find referrer by referral code
        const refQuery = query(collection(db, 'users'), where('referralCode', '==', profile.referredBy));
        const refSnap = await getDocs(refQuery);
        
        if (!refSnap.empty) {
          const referrerDoc = refSnap.docs[0];
          const commission = amount * 0.10;
          
          // Credit Referrer
          batch.update(referrerDoc.ref, {
            balance: increment(commission),
            totalCommissionsEarned: increment(commission)
          });

          // Mark specific referral record as active IF it exists
          const referralRef = doc(db, 'referrals', user.uid);
          const referralSnap = await getDoc(referralRef);
          if (referralSnap.exists()) {
            batch.update(referralRef, { 
              isActiveInvestor: true,
              commissionEarned: commission,
              processedAt: serverTimestamp()
            });
          }
        }
      }

      await batch.commit();
      showSuccessAndRedirect('Stake Successful');

    } catch (err) {
      console.error("Investment error:", err);
      handleFirestoreError(err, OperationType.WRITE, 'investments_transaction');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // Email Verification & Device Authorization Gate
  if (user && isNewDevice) {
    return <EmailVerificationPage user={user} onLogout={handleLogout} onDeviceVerified={handleDeviceVerified} />;
  }

  if (profile && profile.status && profile.status !== 'active') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <AlertCircle className={`w-16 h-16 mx-auto mb-4 ${profile.status === 'banned' ? 'text-red-600' : 'text-orange-600'}`} />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Account {profile.status === 'banned' ? 'Banned' : 'Paused'}
          </h1>
          <p className="text-gray-600 mb-6">
            {profile.status === 'banned' 
              ? "Your account has been permanently banned for violating our terms of service." 
              : "Your account is currently paused. Please contact support for more information."}
          </p>
          <button 
            onClick={handleLogout}
            className="w-full bg-gray-900 text-white py-2 rounded-lg font-semibold hover:bg-black transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <SuccessOverlay message={notification.message} visible={notification.visible} />
      
      {profile?.role === 'admin' && (
        <AdminPayoutProcessor investments={allInvestments} onPayoutSuccess={() => {}} />
      )}

      <div className="min-h-screen bg-gray-50 pb-20 md:pb-0 md:pt-20">
        <Navbar 
          user={user} 
          profile={profile} 
          onLogout={handleLogout} 
          notificationCount={notifs.length} 
        />
        
        <main className="max-w-5xl mx-auto px-4 py-8">
          <Routes>
            <Route path="/login" element={!user ? <LoginPage onLogin={handleLogin} onGoogleLogin={handleGoogleLogin} /> : <Navigate to="/" />} />
            <Route path="/signup" element={!user ? <LoginPage initiallySignup={true} onLogin={handleLogin} onGoogleLogin={handleGoogleLogin} /> : <Navigate to="/" />} />
            
            <Route path="/" element={user ? <HomePage profile={profile} investments={investments} deposits={deposits} withdrawals={withdrawals} /> : <Navigate to="/login" />} />
            <Route path="/plans" element={user ? <PlansPage profile={profile} onInvest={handleInvest} /> : <Navigate to="/login" />} />
            <Route path="/deposit" element={user ? <DepositPage profile={profile} user={user} onSuccess={() => showSuccessAndRedirect('Deposit Successful')} /> : <Navigate to="/login" />} />
            <Route path="/withdrawal" element={user ? <WithdrawalPage profile={profile} user={user} onSuccess={() => showSuccessAndRedirect('Withdrawal Successful')} /> : <Navigate to="/login" />} />
            <Route path="/notifications" element={user ? <NotificationsPage user={user} /> : <Navigate to="/login" />} />
            <Route path="/team" element={user ? <TeamPage profile={profile} /> : <Navigate to="/login" />} />
            
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />

            <Route path="/admin" element={profile?.role === 'admin' ? <AdminDashboard profile={profile} /> : <Navigate to="/" />} />
          </Routes>
          <Footer />
        </main>
      </div>
    </>
  );
}
