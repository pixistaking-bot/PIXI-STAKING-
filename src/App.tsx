import React, { useState, useEffect, Component } from 'react';
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Navigate, 
  Link, 
  useLocation,
  useNavigate
} from 'react-router-dom';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  signInWithPopup,
  GoogleAuthProvider,
  User as FirebaseUser
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
import { auth, db } from './firebase';

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
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
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
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. ");
    }
  }
}
testConnection();
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
  Bell
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
const ADMIN_EMAIL = "admin@pixi.com";
const BEP20_ADDRESS = "0xa703cfc51c14d2f9eee34bb4cbcdfbf2c9a92ee5";
const TRC20_ADDRESS = "TQ9YQZkbnx5cszhVZvZd7wtBbwxYGNRGVV";

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

  const activeInvestments = investments.filter(i => i.status === 'active');
  const now = new Date();

  const dueInvestments = activeInvestments.filter(inv => {
    const lastPayout = inv.lastPayoutDate?.seconds 
      ? new Date(inv.lastPayoutDate.seconds * 1000) 
      : new Date(inv.startDate?.seconds * 1000);
    const diffTime = now.getTime() - lastPayout.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24)) >= 1;
  });

  const processPayouts = async () => {
    if (isProcessing || dueInvestments.length === 0) return;
    setIsProcessing(true);
    setLog(["Starting payout batch..."]);

    try {
      const batch = writeBatch(db);
      let count = 0;

      for (const inv of dueInvestments) {
        const plan = STAKING_PLANS.find(p => p.id === inv.planId) || STAKING_PLANS[1];
        const lastPayout = inv.lastPayoutDate?.seconds 
          ? new Date(inv.lastPayoutDate.seconds * 1000) 
          : new Date(inv.startDate?.seconds * 1000);
        
        const diffTime = now.getTime() - lastPayout.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays >= 1) {
          const payoutAmount = inv.amount * plan.dailyPayout * diffDays;
          
          // Update user balance
          const uRef = doc(db, "users", inv.userId);
          batch.update(uRef, { 
            balance: increment(payoutAmount),
            // Note: In a real app, we'd also handle referral commissions here if they are daily
          });

          // Update investment last payout date
          const invRef = doc(db, "investments", inv.id);
          batch.update(invRef, { lastPayoutDate: serverTimestamp() });

          // Check if ended
          const endDate = new Date(inv.endDate?.seconds * 1000);
          if (now >= endDate) {
            batch.update(invRef, { status: "completed" });
          }

          count++;
        }
      }

      if (count > 0) {
        await batch.commit();
        setLog(prev => [...prev, `Successfully processed ${count} payouts.`]);
        onPayoutSuccess();
      } else {
        setLog(prev => [...prev, "No payouts were actually due."]);
      }
    } catch (err: any) {
      console.error("Payout error:", err);
      setLog(prev => [...prev, `Error: ${err.message}`]);
    } finally {
      setIsProcessing(false);
    }
  };

  if (dueInvestments.length === 0) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 mb-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-amber-900 font-bold flex items-center">
            <Coins className="w-5 h-5 mr-2" />
            Payouts Pending
          </h3>
          <p className="text-amber-700 text-sm">{dueInvestments.length} active investments are due for payout.</p>
        </div>
        <button 
          onClick={processPayouts}
          disabled={isProcessing}
          className="bg-amber-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-amber-700 transition-all shadow-md shadow-amber-200 disabled:opacity-50"
        >
          {isProcessing ? "Processing..." : "Process Now"}
        </button>
      </div>
      {log.length > 0 && (
        <div className="mt-4 p-3 bg-white/50 rounded-lg text-[10px] font-mono text-amber-800 max-h-24 overflow-y-auto">
          {log.map((line, i) => <div key={i}>{line}</div>)}
        </div>
      )}
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
        src="/pixi_logo.png" 
        alt="PIXI COIN"
        className="w-full h-full object-cover"
        referrerPolicy="no-referrer"
        onError={() => setHasError(true)}
      />
    </div>
  );
};

const Navbar = ({ user, profile, onLogout }: { user: FirebaseUser | null, profile: UserProfile | null, onLogout: () => void }) => {
  const location = useLocation();
  
  if (!user) return null;

  const navItems = [
    { path: '/', label: 'Home', icon: Home },
    { path: '/plans', label: 'Plans', icon: TrendingUp },
    { path: '/deposit', label: 'Deposit', icon: Download },
    { path: '/withdrawal', label: 'Withdraw', icon: Upload },
    { path: '/team', label: 'Team', icon: Users },
    { path: '/notifications', label: 'Updates', icon: Bell },
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
                className={`flex flex-col md:flex-row items-center space-y-1 md:space-y-0 md:space-x-2 p-2 rounded-lg transition-colors ${
                  isActive ? 'text-amber-600 bg-amber-50' : 'text-gray-500 hover:text-amber-600 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-6 h-6" />
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

const LoginPage = ({ onLogin, onGoogleLogin }: { 
  onLogin: (email: string, pass: string, isSignup: boolean, referralCode?: string) => Promise<void>,
  onGoogleLogin: (referralCode?: string) => Promise<void>
}) => {
  const [isSignup, setIsSignup] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      await onGoogleLogin(isSignup ? referralCode.trim() : undefined);
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
      let message = err.message || 'Authentication failed';
      
      // Handle Firebase specific error codes
      if (err.code === 'auth/invalid-email') message = 'Invalid email format.';
      if (err.code === 'auth/user-not-found') message = 'User not found. Please sign up if you don\'t have an account.';
      if (err.code === 'auth/wrong-password') message = 'Incorrect password. Please try again.';
      if (err.code === 'auth/invalid-credential') {
        message = 'Authentication failed. This usually means the Email/Password provider is not enabled in your Firebase Console, or the credentials/domain are incorrect.';
      }
      if (err.code === 'auth/email-already-in-use') message = 'This account already exists. Please login instead.';
      if (err.code === 'auth/weak-password') message = 'Password should be at least 6 characters.';
      if (err.code === 'auth/operation-not-allowed') {
        message = 'The requested authentication method (Email/Password) is not enabled in your Firebase project.';
      }
      if (err.code === 'auth/too-many-requests') message = 'Too many failed attempts. Please try again later.';
      if (err.code === 'auth/network-request-failed') message = 'Network error. Please check your internet connection.';
      if (err.code === 'auth/unauthorized-domain') {
        message = 'This domain is not authorized for Firebase Authentication. Please add it to the authorized domains list in the Firebase Console.';
      }
      
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

const HomePage = ({ profile, investments }: { profile: UserProfile | null, investments: Investment[] }) => {
  const activeInvestments = investments.filter(i => i.status === 'active');
  const pendingInvestments = investments.filter(i => i.status === 'pending');
  const totalInvested = activeInvestments.reduce((sum, i) => sum + i.amount, 0);
  
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
    } catch (err: any) {
      alert(err.message);
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

const DepositPage = ({ profile, onSuccess }: { profile: UserProfile | null, onSuccess: () => void }) => {
  const [network, setNetwork] = useState<'BEP20' | 'TRC20'>('BEP20');
  const [amount, setAmount] = useState('');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
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
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.src = reader.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Max dimensions for compression
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          // Compress to JPEG with 0.7 quality
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
          setScreenshot(compressedDataUrl);
        };
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !screenshot) return;
    
    setLoading(true);
    try {
      await addDoc(collection(db, 'deposits'), {
        userId: profile?.uid,
        userEmail: profile?.email,
        amount: parseFloat(amount),
        screenshotUrl: screenshot,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      onSuccess();
      setAmount('');
      setScreenshot(null);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, 'deposits');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
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
        <div className="mt-4 p-3 bg-amber-50 rounded-lg flex items-start space-x-3 border border-amber-100">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">
            Only send {network} USDT. Using the wrong network will result in permanent loss of funds.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Deposit Amount (USDT)</label>
          <input 
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

const WithdrawalPage = ({ profile, onSuccess }: { profile: UserProfile | null, onSuccess: () => void }) => {
  const [network, setNetwork] = useState<'BEP20' | 'TRC20'>('BEP20');
  const [amount, setAmount] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(amount);
    if (!profile || val > profile.balance) {
      alert('Insufficient balance');
      return;
    }
    if (val < 10) {
      alert('Minimum withdrawal is 10 USDT');
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, 'withdrawals'), {
        userId: profile.uid,
        userEmail: profile.email,
        amount: val,
        network,
        walletAddress: address,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      
      await updateDoc(doc(db, 'users', profile.uid), {
        balance: increment(-val)
      });

      onSuccess();
      setAmount('');
      setAddress('');
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, 'withdrawals');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
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
              type="text" 
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder={network === 'BEP20' ? '0x...' : 'T...'}
            />
          </div>
          <button 
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
  createdAt: any;
}

const TeamPage = ({ profile }: { profile: UserProfile | null }) => {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);

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

  const registeredCount = referrals.length;
  const activeInvestorCount = referrals.filter(r => r.isActiveInvestor).length;
  const totalCommissions = profile?.totalCommissionsEarned || 0;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">My Team</h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-xs text-gray-400 font-bold uppercase mb-1 tracking-wider">Registered Users</p>
          <p className="text-3xl font-black text-indigo-600">{registeredCount}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-xs text-gray-400 font-bold uppercase mb-1 tracking-wider">Active Investors</p>
          <p className="text-3xl font-black text-green-600">{activeInvestorCount}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-xs text-gray-400 font-bold uppercase mb-1 tracking-wider">Commissions Earned</p>
          <p className="text-3xl font-black text-purple-600">${totalCommissions.toFixed(2)}</p>
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-center">
        <p className="text-sm text-gray-500 mb-2">My PIXI STAKING Referral Code</p>
        <div className="inline-flex items-center space-x-3 bg-amber-50 px-6 py-3 rounded-xl border border-amber-100">
          <span className="text-2xl font-black text-amber-600 tracking-widest">{profile?.referralCode}</span>
          <button onClick={() => {
            navigator.clipboard.writeText(profile?.referralCode || '');
            alert('Copied!');
          }} className="p-2 text-amber-600 hover:bg-amber-100 rounded-lg transition-colors">
            <Copy className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-4">Earn 10% commission on every PIXI STAKING purchase from your referrals!</p>
      </div>
    </div>
  );
};

const NotificationsPage = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'notifications');
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

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
              <p className="text-sm text-gray-600 leading-relaxed">{notif.message}</p>
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

const AdminDashboard = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'deposits' | 'withdrawals' | 'investments' | 'notifications'>('users');
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [newBalance, setNewBalance] = useState('');
  const [adminStatus, setAdminStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  // Notifications State
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMessage, setNotifMessage] = useState('');
  const [isPostingNotif, setIsPostingNotif] = useState(false);

  useEffect(() => {
    if (adminStatus) {
      const timer = setTimeout(() => setAdminStatus(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [adminStatus]);

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, 'users'), (s) => {
      setUsers(s.docs.map(d => ({ uid: d.id, ...d.data() } as any)));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'admin_users');
    });
    const unsubDeps = onSnapshot(query(collection(db, 'deposits'), orderBy('createdAt', 'desc')), (s) => {
      setDeposits(s.docs.map(d => ({ id: d.id, ...d.data() } as any)));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'admin_deposits');
    });
    const unsubWiths = onSnapshot(query(collection(db, 'withdrawals'), orderBy('createdAt', 'desc')), (s) => {
      setWithdrawals(s.docs.map(d => ({ id: d.id, ...d.data() } as any)));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'admin_withdrawals');
    });
    const unsubInvs = onSnapshot(query(collection(db, 'investments'), orderBy('startDate', 'desc')), (s) => {
      setInvestments(s.docs.map(d => ({ id: d.id, ...d.data() } as any)));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'admin_investments');
    });
    const unsubNotifs = onSnapshot(query(collection(db, 'notifications'), orderBy('createdAt', 'desc')), (s) => {
      setNotifications(s.docs.map(d => ({ id: d.id, ...d.data() } as any)));
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
    try {
      const userRef = doc(db, 'users', dep.userId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        await updateDoc(userRef, { balance: increment(dep.amount) });
        await updateDoc(doc(db, 'deposits', dep.id), { status: 'approved' });
        setAdminStatus({ type: 'success', message: 'Deposit approved and balance updated' });
      }
    } catch (err: any) { 
      setAdminStatus({ type: 'error', message: 'Failed to approve deposit' });
      handleFirestoreError(err, OperationType.WRITE, `approve_deposit_${dep.id}`); 
    }
  };

  const handleRejectDeposit = async (id: string) => {
    try {
      await updateDoc(doc(db, 'deposits', id), { status: 'rejected' });
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, `reject_deposit_${id}`);
    }
  };

  const handleApproveWithdrawal = async (withd: Withdrawal) => {
    try {
      await updateDoc(doc(db, 'withdrawals', withd.id), { status: 'approved' });
      setAdminStatus({ type: 'success', message: 'Withdrawal approved' });
    } catch (err: any) {
      setAdminStatus({ type: 'error', message: 'Failed to approve withdrawal' });
      handleFirestoreError(err, OperationType.WRITE, `approve_withdrawal_${withd.id}`);
    }
  };

  const handleRejectWithdrawal = async (withd: Withdrawal) => {
    try {
      const userRef = doc(db, 'users', withd.userId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        await updateDoc(userRef, { balance: increment(withd.amount) });
        await updateDoc(doc(db, 'withdrawals', withd.id), { status: 'rejected' });
        setAdminStatus({ type: 'success', message: 'Withdrawal rejected and balance refunded' });
      }
    } catch (err: any) {
      setAdminStatus({ type: 'error', message: 'Failed to reject withdrawal' });
      handleFirestoreError(err, OperationType.WRITE, `reject_withdrawal_${withd.id}`);
    }
  };

  const handleApproveInvestment = async (inv: Investment) => {
    try {
      // 1. Set investment to active
      await updateDoc(doc(db, 'investments', inv.id), { status: 'active' });

      // 2. Handle Referral Commission (10%)
      const userRef = doc(db, 'users', inv.userId);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const userData = userSnap.data() as UserProfile;
        
        // 3. Update Referral record to active investor
        const refQuery = query(collection(db, 'referrals'), where('referredUid', '==', inv.userId));
        const refSnap = await getDocs(refQuery);
        if (!refSnap.empty) {
          await updateDoc(doc(db, 'referrals', refSnap.docs[0].id), { isActiveInvestor: true });
        }

        if (userData.referredBy) {
          const q = query(collection(db, 'users'), where('referralCode', '==', userData.referredBy));
          const referrerSnap = await getDocs(q);
          
          if (!referrerSnap.empty) {
            const referrerDoc = referrerSnap.docs[0];
            const commission = inv.amount * 0.10;
            await updateDoc(doc(db, 'users', referrerDoc.id), {
              balance: increment(commission),
              totalCommissionsEarned: increment(commission)
            });
          }
        }
      }
      setAdminStatus({ type: 'success', message: 'Investment approved and referral commission processed' });
    } catch (err: any) {
      setAdminStatus({ type: 'error', message: 'Failed to approve investment' });
      handleFirestoreError(err, OperationType.WRITE, `approve_investment_${inv.id}`);
    }
  };

  const handleRejectInvestment = async (inv: Investment) => {
    try {
      const userRef = doc(db, 'users', inv.userId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        await updateDoc(userRef, { balance: increment(inv.amount) });
        await updateDoc(doc(db, 'investments', inv.id), { status: 'rejected' });
        setAdminStatus({ type: 'success', message: 'Investment rejected and balance refunded' });
      }
    } catch (err: any) {
      setAdminStatus({ type: 'error', message: 'Failed to reject investment' });
      handleFirestoreError(err, OperationType.WRITE, `reject_investment_${inv.id}`);
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
      <h2 className="text-2xl font-bold text-gray-900">Admin Dashboard</h2>

      <AdminPayoutProcessor investments={investments} onPayoutSuccess={() => {}} />

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
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 font-bold uppercase">Total Users</p>
          <p className="text-2xl font-black text-gray-900">{users.length}</p>
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

      <div className="flex bg-gray-100 p-1 rounded-xl overflow-x-auto no-scrollbar">
        {(['users', 'deposits', 'withdrawals', 'investments', 'notifications'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 min-w-[80px] py-2 text-sm font-bold rounded-lg transition-all ${
              activeTab === tab ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-500'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {activeTab === 'users' && (
          <div className="divide-y divide-gray-50">
            {users.map(u => (
              <div key={u.uid} className="p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-bold text-gray-900">{u.email}</p>
                    <p className="text-xs text-gray-500">Balance: ${u.balance.toFixed(2)}</p>
                    <div className="flex items-center mt-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        u.status === 'active' ? 'bg-green-100 text-green-600' : 
                        u.status === 'banned' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'
                      }`}>
                        {u.status || 'active'}
                      </span>
                      {u.role === 'admin' && <span className="ml-2 text-[10px] font-bold bg-purple-100 text-purple-600 px-2 py-0.5 rounded uppercase">Admin</span>}
                    </div>
                  </div>
                  <button 
                    onClick={() => { setEditingUser(u); setNewBalance(u.balance.toString()); }}
                    className="text-xs bg-amber-50 text-amber-600 px-3 py-1 rounded-lg font-bold"
                  >
                    Edit Balance
                  </button>
                </div>
                
                {u.role !== 'admin' && (
                  <div className="flex space-x-2">
                    {u.status !== 'active' && (
                      <button 
                        onClick={() => handleUpdateUserStatus(u.uid, 'active')}
                        className="flex-1 py-1.5 text-[10px] font-bold bg-green-50 text-green-600 rounded border border-green-100"
                      >
                        Activate
                      </button>
                    )}
                    {u.status !== 'paused' && (
                      <button 
                        onClick={() => handleUpdateUserStatus(u.uid, 'paused')}
                        className="flex-1 py-1.5 text-[10px] font-bold bg-orange-50 text-orange-600 rounded border border-orange-100"
                      >
                        Pause
                      </button>
                    )}
                    {u.status !== 'banned' && (
                      <button 
                        onClick={() => handleUpdateUserStatus(u.uid, 'banned')}
                        className="flex-1 py-1.5 text-[10px] font-bold bg-red-50 text-red-600 rounded border border-red-100"
                      >
                        Ban
                      </button>
                    )}
                    <button 
                      onClick={() => setDeletingUserId(u.uid)}
                      className="flex-1 py-1.5 text-[10px] font-bold bg-gray-50 text-gray-600 rounded border border-gray-100"
                    >
                      Delete
                    </button>
                  </div>
                )}
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
          <div className="divide-y divide-gray-50">
            {deposits.map(d => (
              <div key={d.id} className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-bold text-gray-900">{d.userEmail}</p>
                    <p className="text-lg font-black text-amber-600">${d.amount} USDT</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase ${
                    d.status === 'pending' ? 'bg-orange-100 text-orange-600' : 
                    d.status === 'approved' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                  }`}>
                    {d.status}
                  </span>
                </div>
                <img src={d.screenshotUrl} alt="Proof" className="w-full max-h-64 object-contain bg-gray-50 rounded-lg border border-gray-100" />
                {d.status === 'pending' && (
                  <div className="flex space-x-2">
                    <button onClick={() => handleApproveDeposit(d)} className="flex-1 bg-green-600 text-white py-2 rounded-lg font-bold text-sm">Approve</button>
                    <button onClick={() => handleRejectDeposit(d.id)} className="flex-1 bg-red-600 text-white py-2 rounded-lg font-bold text-sm">Reject</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'withdrawals' && (
          <div className="divide-y divide-gray-50">
            {withdrawals.map(w => (
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
                <div className="bg-gray-50 p-2 rounded text-[10px] font-mono break-all border border-gray-100">
                  <span className="font-bold text-gray-400 mr-2 uppercase">{w.network || 'BEP20'}:</span>
                  {w.walletAddress}
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
                  <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase ${
                    inv.status === 'pending' ? 'bg-orange-100 text-orange-600' : 
                    inv.status === 'active' ? 'bg-green-100 text-green-600' : 
                    inv.status === 'completed' ? 'bg-blue-100 text-blue-600' : 'bg-red-100 text-red-600'
                  }`}>
                    {inv.status}
                  </span>
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
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        >
          <motion.div 
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl"
          >
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="w-10 h-10 text-green-600" />
            </div>
            <h3 className="text-2xl font-black text-gray-900 mb-2">{message}</h3>
            <p className="text-gray-500">Redirecting you to home...</p>
            <div className="mt-8 flex justify-center">
              <div className="flex space-x-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                    className="w-2 h-2 bg-green-500 rounded-full"
                  />
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

function AppContent() {
  const navigate = useNavigate();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<{ message: string, visible: boolean }>({ message: '', visible: false });

  const showSuccessAndRedirect = (message: string) => {
    setNotification({ message, visible: true });
    setTimeout(() => {
      setNotification({ message: '', visible: false });
      navigate('/');
    }, 3000);
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
        setProfile({ uid: user.uid, ...snap.data() } as UserProfile);
      }
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
    });

    const q = query(collection(db, 'investments'), where('userId', '==', user.uid));
    const unsubInvestments = onSnapshot(q, (snap) => {
      setInvestments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Investment)));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'investments');
    });

    return () => {
      unsubProfile();
      unsubInvestments();
    };
  }, [user]);

  // Daily Payout Logic
  useEffect(() => {
    if (!user || investments.length === 0) return;

    const checkPayouts = async () => {
      const now = new Date();
      const activeInvs = investments.filter(i => i.status === 'active');
      
      for (const inv of activeInvs) {
        if (!inv.startDate || !inv.amount) continue;
        
        const lastPayout = inv.lastPayoutDate?.seconds 
          ? new Date(inv.lastPayoutDate.seconds * 1000) 
          : new Date(inv.startDate.seconds * 1000);
        
        const diffDays = Math.floor((now.getTime() - lastPayout.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffDays >= 1) {
          try {
            const payoutAmount = inv.amount * 0.1 * diffDays;
            const uRef = doc(db, 'users', user.uid);
            const invRef = doc(db, 'investments', inv.id);
            
            const batch = writeBatch(db);
            batch.update(uRef, { balance: increment(payoutAmount) });
            batch.update(invRef, { lastPayoutDate: serverTimestamp() });
            
            if (inv.endDate?.seconds) {
              const endDate = new Date(inv.endDate.seconds * 1000);
              if (now >= endDate) {
                batch.update(invRef, { status: 'completed' });
              }
            }
            
            await batch.commit();
          } catch (err) {
            handleFirestoreError(err, OperationType.WRITE, 'daily_payout');
          }
        }
      }
    };

    const interval = setInterval(checkPayouts, 60000);
    checkPayouts();
    return () => clearInterval(interval);
  }, [user, investments]);

  const handleLogin = async (email: string, pass: string, isSignup: boolean, referralCode?: string) => {
    try {
      if (isSignup) {
        const { user: newUser } = await createUserWithEmailAndPassword(auth, email, pass);
        const myReferralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        
        const profileData: UserProfile = {
          uid: newUser.uid,
          email: newUser.email!,
          balance: 0,
          totalCommissionsEarned: 0,
          referralCode: myReferralCode,
          referredBy: referralCode || null,
          role: email === ADMIN_EMAIL ? 'admin' : 'user',
          status: 'active',
          createdAt: serverTimestamp()
        };
        
        try {
          await setDoc(doc(db, 'users', newUser.uid), profileData);
          
          // Create referral record if referred
          if (referralCode) {
            const q = query(collection(db, 'users'), where('referralCode', '==', referralCode));
            const referrerSnap = await getDocs(q);
            if (!referrerSnap.empty) {
              const referrerDoc = referrerSnap.docs[0];
              await addDoc(collection(db, 'referrals'), {
                referrerUid: referrerDoc.id,
                referredUid: newUser.uid,
                referredEmail: newUser.email,
                createdAt: serverTimestamp()
              });
            }
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${newUser.uid}`);
        }
        setProfile(profileData);
      } else {
        await signInWithEmailAndPassword(auth, email, pass);
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
        const myReferralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        const profileData: UserProfile = {
          uid: googleUser.uid,
          email: googleUser.email!,
          balance: 0,
          totalCommissionsEarned: 0,
          referralCode: myReferralCode,
          referredBy: referralCode || null,
          role: googleUser.email === ADMIN_EMAIL ? 'admin' : 'user',
          status: 'active',
          createdAt: serverTimestamp()
        };
        
        try {
          await setDoc(userRef, profileData);

          // Create referral record if referred
          if (referralCode) {
            const q = query(collection(db, 'users'), where('referralCode', '==', referralCode));
            const referrerSnap = await getDocs(q);
            if (!referrerSnap.empty) {
              const referrerDoc = referrerSnap.docs[0];
              await addDoc(collection(db, 'referrals'), {
                referrerUid: referrerDoc.id,
                referredUid: googleUser.uid,
                referredEmail: googleUser.email,
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

    if (plan.oneTime) {
      const q = query(collection(db, 'investments'), where('userId', '==', user.uid), where('planId', '==', plan.id));
      let snap;
      try {
        snap = await getDocs(q);
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'investments_one_time_check');
      }
      if (snap && !snap.empty) {
        throw new Error('Starter plan can only be purchased once.');
      }
    }

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + plan.duration);

    const investmentData = {
      userId: user.uid,
      userEmail: user.email,
      amount,
      planId: plan.id,
      planName: plan.name,
      startDate: serverTimestamp(),
      endDate: Timestamp.fromDate(endDate),
      lastPayoutDate: serverTimestamp(),
      status: 'active'
    };

    try {
      await addDoc(collection(db, 'investments'), investmentData);
      
      // Show success message
      showSuccessAndRedirect('Stake Successful');

      // Update balance
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          balance: increment(-amount)
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
      }

      // Handle Referral Commission (10%)
      if (profile.referredBy) {
        try {
          // Update Referral record to active investor
          const refQuery = query(collection(db, 'referrals'), where('referredUid', '==', user.uid));
          const refSnap = await getDocs(refQuery);
          if (!refSnap.empty) {
            await updateDoc(doc(db, 'referrals', refSnap.docs[0].id), { isActiveInvestor: true });
          }

          const q = query(collection(db, 'users'), where('referralCode', '==', profile.referredBy));
          const referrerSnap = await getDocs(q);
          
          if (!referrerSnap.empty) {
            const referrerDoc = referrerSnap.docs[0];
            const commission = amount * 0.10;
            await updateDoc(doc(db, 'users', referrerDoc.id), {
              balance: increment(commission),
              totalCommissionsEarned: increment(commission)
            });
          }
        } catch (err) {
          console.error("Commission processing error:", err);
          // Don't fail the whole investment if commission fails, but log it
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'investments');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
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
      <div className="min-h-screen bg-gray-50 pb-20 md:pb-0 md:pt-20">
        <Navbar user={user} profile={profile} onLogout={handleLogout} />
        
        <main className="max-w-5xl mx-auto px-4 py-8">
          <Routes>
            <Route path="/login" element={!user ? <LoginPage onLogin={handleLogin} onGoogleLogin={handleGoogleLogin} /> : <Navigate to="/" />} />
            
            <Route path="/" element={user ? <HomePage profile={profile} investments={investments} /> : <Navigate to="/login" />} />
            <Route path="/plans" element={user ? <PlansPage profile={profile} onInvest={handleInvest} /> : <Navigate to="/login" />} />
            <Route path="/deposit" element={user ? <DepositPage profile={profile} onSuccess={() => showSuccessAndRedirect('Deposit Processing')} /> : <Navigate to="/login" />} />
            <Route path="/withdrawal" element={user ? <WithdrawalPage profile={profile} onSuccess={() => showSuccessAndRedirect('Withdrawal Successful')} /> : <Navigate to="/login" />} />
            <Route path="/notifications" element={user ? <NotificationsPage /> : <Navigate to="/login" />} />
            <Route path="/team" element={user ? <TeamPage profile={profile} /> : <Navigate to="/login" />} />
            
            <Route path="/admin" element={profile?.role === 'admin' ? <AdminDashboard /> : <Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </>
  );
}
