import React, { useState, useEffect } from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, useNavigate, useLocation, Link } from "react-router-dom";
import axios from "axios";

import LoadingSpinner from "./components/LoadingSpinner";
import TaskCard from "./components/TaskCard";
import SubmissionModal from "./components/SubmissionModal";
import MySubmissions from "./components/MySubmissions";
import TaskSubmissions from "./components/TaskSubmissions";
import { ethers } from "ethers";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { Badge } from "./components/ui/badge";
import { Progress } from "./components/ui/progress";
import { Input } from "./components/ui/input";
import { Textarea } from "./components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "./components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./components/ui/dialog";
import { Separator } from "./components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./components/ui/select";
import { Label } from "./components/ui/label";
import {
  Search,
  Plus,
  Shield,
  Zap,
  Users,
  DollarSign,
  Clock,
  Star,
  CheckCircle,
  TrendingUp,
  Code,
  Camera,
  Palette,
  FileText,
  Globe,
  Lock,
  Eye,
  Home,
  Menu,
  ArrowLeft,
  Calendar as CalendarIcon,
  Tag,
  Briefcase,
  X,
  User,
  Mail,
  Award
} from "lucide-react";
import { Calendar } from "./components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./components/ui/popover";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const ESCROW_ADDRESS = process.env.REACT_APP_ESCROW_ADDRESS;
const NETWORK_NAME = process.env.REACT_APP_NETWORK_NAME;
const RPC_URL = process.env.REACT_APP_RPC_URL;
const CHAIN_ID = process.env.REACT_APP_CHAIN_ID;
const CHAIN_ID_HEX = process.env.REACT_APP_CHAIN_ID_HEX;
const CURRENCY_SYMBOL = process.env.REACT_APP_CURRENCY_SYMBOL;

// Mock data
const mockTasks = [
  {
    id: "1",
    title: "ML Training Images - Sign Language Dataset",
    description: "Need 1000+ high-quality images of ASL signs for machine learning model training. Each image should be clear, well-lit, and properly labeled.",
    category: "AI/ML",
    budget: 500,
    deadline: "2024-02-15",
    client: "TechCorp AI",
    clientRating: 4.8,
    status: "open",
    submissions: 12,
    skills: ["Photography", "Data Collection", "AI/ML"],
    escrowStatus: "pending"
  },
  {
    id: "2",
    title: "Smart Contract Audit",
    description: "Comprehensive security audit of our DeFi lending protocol smart contracts. Need experienced Solidity developer.",
    category: "Blockchain",
    budget: 2500,
    deadline: "2024-02-20",
    client: "DeFi Solutions",
    clientRating: 4.9,
    status: "open",
    submissions: 8,
    skills: ["Solidity", "Security", "DeFi"],
    escrowStatus: "pending"
  },
  {
    id: "3",
    title: "UI/UX Design for Mobile App",
    description: "Modern, clean design for fintech mobile application. Need complete UI kit and interactive prototypes.",
    category: "Design",
    budget: 800,
    deadline: "2024-02-18",
    client: "StartupX",
    clientRating: 4.6,
    status: "in_progress",
    submissions: 15,
    skills: ["UI/UX", "Figma", "Mobile Design"],
    escrowStatus: "funded"
  },
  {
    id: "4",
    title: "React Component Library",
    description: "Build a comprehensive React component library with TypeScript support and Storybook documentation.",
    category: "Development",
    budget: 1200,
    deadline: "2024-02-25",
    client: "DevStudio",
    clientRating: 4.7,
    status: "open",
    submissions: 9,
    skills: ["React", "TypeScript", "Storybook"],
    escrowStatus: "pending"
  },
  {
    id: "5",
    title: "NFT Marketplace Smart Contract",
    description: "Develop a complete NFT marketplace with minting, trading, and royalty features on Ethereum.",
    category: "Blockchain",
    budget: 3500,
    deadline: "2024-03-01",
    client: "CryptoArt",
    clientRating: 4.9,
    status: "open",
    submissions: 6,
    skills: ["Solidity", "NFT", "Web3"],
    escrowStatus: "pending"
  },
  {
    id: "6",
    title: "Data Visualization Dashboard",
    description: "Create interactive charts and dashboards for financial data analysis using D3.js and React.",
    category: "Data Science",
    budget: 900,
    deadline: "2024-02-28",
    client: "FinTech Corp",
    clientRating: 4.5,
    status: "open",
    submissions: 14,
    skills: ["D3.js", "React", "Data Visualization"],
    escrowStatus: "pending"
  }
];

// Date helpers
const toStartOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const isDeadlineInFutureOrToday = (deadlineStr) => {
  if (!deadlineStr) return false;
  const today = toStartOfDay(new Date());
  const deadline = toStartOfDay(new Date(deadlineStr));
  return deadline >= today;
};

// Status helpers
const getStatusColor = (status) => {
  switch (status) {
    case 'open':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'in_progress':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'completed':
      return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    case 'cancelled':
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    default:
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  }
};

// ETH Symbol Component
const EthSymbol = () => <span className="font-bold">Ξ</span>;

// Map API task (snake_case) to UI task (camelCase fields expected by components)
const mapTaskFromApi = (apiTask) => ({
  id: apiTask.id,
  title: apiTask.title,
  description: apiTask.description,
  category: apiTask.category,
  budget: apiTask.budget,
  deadline: apiTask.deadline,
  client: apiTask.client,
  clientRating: apiTask.client_rating ?? 4.5,
  status: apiTask.status,
  submissions: apiTask.submissions ?? 0,
  skills: apiTask.skills ?? [],
  escrowStatus: apiTask.escrow_status ?? "pending",
});

const categories = [
  "AI/ML",
  "Blockchain",
  "Design",
  "Development",
  "Data Science",
  "Marketing",
  "Writing",
  "Translation",
  "Photography",
  "Video Editing"
];

// Navigation Component - Memoized for performance
const Navigation = React.memo(() => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [account, setAccount] = useState(null);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);


  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationMessage, setCelebrationMessage] = useState('');
  const [showLoginCelebration, setShowLoginCelebration] = useState(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isUserDropdownOpen && !event.target.closest('.user-dropdown-container')) {
        setIsUserDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isUserDropdownOpen]);

  // Listen for user type changes from other components
  useEffect(() => {
    const handleUserTypeChange = (event) => {
      if (event.key === 'user_type_changed') {
        // Refresh user data when user type changes (skip cache)
        checkAuthStatus(true);
      }
    };

    window.addEventListener('storage', handleUserTypeChange);
    return () => window.removeEventListener('storage', handleUserTypeChange);
  }, []);

  // Extract checkAuthStatus function so it can be reused
  const checkAuthStatus = async (skipCache = false) => {
    try {
      // Clean up old tokens first
      localStorage.removeItem('access_token');

      const firebaseToken = localStorage.getItem('firebase_token');
      if (firebaseToken) {
        // Check cache first for faster loading (unless explicitly skipping)
        if (!skipCache) {
          const cachedUser = localStorage.getItem('cached_user_data');
          const cacheTime = localStorage.getItem('user_cache_time');
          const now = Date.now();

          // Use cache if it's less than 5 minutes old
          if (cachedUser && cacheTime && (now - parseInt(cacheTime)) < 300000) {
            try {
              const userData = JSON.parse(cachedUser);
              setUser(userData);
              setIsLoading(false);
              return; // Skip API call
            } catch (e) {
              // Invalid cache, continue with API call
            }
          }
        }

        const response = await axios.post(`${BACKEND_URL}/api/auth/firebase/verify`, {}, {
          headers: { 'Authorization': `Bearer ${firebaseToken}` }
        });
        const userData = response.data.user;
        setUser(userData);

        // Cache user data for faster subsequent loads
        localStorage.setItem('cached_user_data', JSON.stringify(userData));
        localStorage.setItem('user_cache_time', Date.now().toString());

        // Auto-connect wallet when user is authenticated (optimized)
        if (window.ethereum && !account) {
          try {
            // First check if accounts are already connected (faster)
            const accounts = await window.ethereum.request({ method: "eth_accounts" });
            if (accounts.length > 0) {
              setAccount(accounts[0]);

              // Listen for account changes
              window.ethereum.on('accountsChanged', (accounts) => {
                if (accounts.length > 0) {
                  setAccount(accounts[0]);
                } else {
                  setAccount(null);
                }
              });

              // Listen for network changes
              window.ethereum.on('chainChanged', () => {
                window.location.reload();
              });
            }
          } catch (error) {
            console.log('Auto wallet connection failed:', error);
          }
        }

        // Show login celebration for new sessions (but only if explicitly requested)
        const showWelcome = localStorage.getItem('show_welcome_celebration');
        if (showWelcome === 'true') {
          setShowLoginCelebration(true);
          localStorage.removeItem('show_welcome_celebration');
          // Auto-hide login celebration after 3 seconds
          setTimeout(() => setShowLoginCelebration(false), 3000);
        }
      }
    } catch (error) {
      console.error('Authentication check failed:', error);
      // Token is invalid, remove all tokens
      localStorage.removeItem('firebase_token');
      localStorage.removeItem('access_token');
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Check authentication status on component mount (optimized)
  useEffect(() => {
    checkAuthStatus();

    // Cleanup function to remove event listeners
    return () => {
      if (window.ethereum) {
        try {
          window.ethereum.removeAllListeners('accountsChanged');
          window.ethereum.removeAllListeners('chainChanged');
        } catch (error) {
          console.log('Error removing wallet event listeners:', error);
        }
      }
    };
  }, []); // Empty dependency array for mount-only effect

  const logout = async () => {
    // Set flag to clear auth state on login page
    localStorage.setItem('force_clear_auth', 'true');

    // Clear all tokens
    localStorage.removeItem('firebase_token');
    localStorage.removeItem('access_token');
    localStorage.removeItem('last_login_time');
    localStorage.removeItem('cached_user_data');
    localStorage.removeItem('user_cache_time');

    // Sign out from Firebase
    try {
      // Import Firebase auth
      const { auth } = await import('./firebase');
      await auth.signOut();
    } catch (error) {
      console.error('Firebase signout error:', error);
    }

    setUser(null);
    // Redirect to login page with clear flag
    window.location.href = '/login.html?clear_auth=true';
  };

  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        alert("MetaMask not found. Please install it.");
        return;
      }
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: CHAIN_ID_HEX }],
        });
      } catch (switchError) {
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: CHAIN_ID_HEX,
              chainName: NETWORK_NAME,
              nativeCurrency: { name: CURRENCY_SYMBOL, symbol: CURRENCY_SYMBOL, decimals: 18 },
              rpcUrls: [RPC_URL],
              blockExplorerUrls: [], // No block explorer for local network
            }],
          });
        } else {
          throw switchError;
        }
      }
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      // Always connect to the first account automatically
      if (accounts.length > 0) {
        setAccount(accounts[0]);
      }
    } catch (err) {
      console.error("Wallet connection failed:", err);
      alert("Failed to connect wallet: " + err.message);
    }
  };



  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-950/95 backdrop-blur-lg border-b border-gray-800/50 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">

            {/* Logo Section */}
            <Link to="/" className="flex items-center space-x-3 group">
              <div className="w-9 h-9 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-teal-500/25 group-hover:scale-105 transition-all duration-300">
                <Shield className="w-5 h-5 text-white group-hover:rotate-12 transition-transform duration-300" />
              </div>
              <span className="text-xl font-bold text-white tracking-tight group-hover:text-teal-300 transition-colors duration-300">
                DecentraTask
              </span>
            </Link>

            {/* Main Navigation - Desktop */}
            <div className="hidden md:flex items-center space-x-1">
              <Link
                to="/"
                className="flex items-center px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-800/50 rounded-lg transition-all duration-200 font-medium"
              >
                <Home className="w-4 h-4 mr-2" />
                Home
              </Link>
              <Link
                to="/tasks"
                className="flex items-center px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-800/50 rounded-lg transition-all duration-200 font-medium"
              >
                <Search className="w-4 h-4 mr-2" />
                Browse Tasks
              </Link>
              {user && user.user_type === 'freelancer' && (
                <Link
                  to="/my-submissions"
                  className="flex items-center px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-800/50 rounded-lg transition-all duration-200 font-medium"
                >
                  <Briefcase className="w-4 h-4 mr-2" />
                  My Submissions
                </Link>
              )}
            </div>

            {/* Right Section - Desktop */}
            <div className="hidden md:flex items-center space-x-4">

              {/* Post Task Button - Always show when logged in */}
              {user && (
                <Link to="/post-task">
                  <Button size="sm" className="bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white shadow-lg hover:shadow-teal-500/25 transition-all duration-200">
                    <Plus className="w-4 h-4 mr-2" />
                    Post Task
                  </Button>
                </Link>
              )}

              {/* Get Started Button for non-authenticated users */}
              {!user && !isLoading && (
                <a href="/login.html">
                  <Button size="sm" className="bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white shadow-lg hover:shadow-teal-500/25 transition-all duration-200">
                    <Zap className="w-4 h-4" />
                    Get Started
                  </Button>
                </a>
              )}

              {/* Wallet Connection - Only show when logged in */}
              {user && (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-gray-600 text-gray-300 hover:bg-gray-800 hover:border-gray-500 transition-all duration-200"
                  onClick={connectWallet}
                >
                  {account ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span>{account.slice(0, 6)}...{account.slice(-4)}</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                      <span>Connect Wallet</span>
                    </div>
                  )}
                </Button>
              )}

              {/* User Section */}
              {isLoading ? (
                <div className="flex items-center space-x-2 px-3">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-teal-500"></div>
                  <span className="text-gray-400 text-sm">Loading...</span>
                </div>
              ) : user ? (
                <div className="relative user-dropdown-container">
                  <button
                    onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                    className={`flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-800/50 transition-all duration-200 group ${isUserDropdownOpen ? 'bg-gray-800/50' : ''}`}
                  >
                    <div className="w-8 h-8 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-full flex items-center justify-center shadow-lg">
                      <User className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="text-sm font-medium text-white group-hover:text-teal-300 transition-colors">
                        {user.username}
                      </span>
                      <span className="text-xs text-gray-400 capitalize">
                        {user.user_type}
                      </span>
                    </div>
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isUserDropdownOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* User Dropdown */}
                  {isUserDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-64 bg-gray-900/95 backdrop-blur-lg border border-gray-700/50 rounded-xl shadow-xl py-2 z-50 animate-in slide-in-from-top-2 duration-200">
                      <div className="px-4 py-3 border-b border-gray-700/50">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-full flex items-center justify-center flex-shrink-0">
                            <User className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{user.username}</p>
                            <p className="text-xs text-gray-400 truncate">{user.email}</p>
                            <p className="text-xs text-teal-400 capitalize">{user.user_type}</p>
                          </div>
                        </div>
                      </div>

                      <div className="py-1">
                        <Link
                          to="/profile"
                          className="flex items-center px-4 py-2 text-sm text-gray-300 hover:bg-gray-800/50 hover:text-white transition-colors"
                          onClick={() => setIsUserDropdownOpen(false)}
                        >
                          <User className="w-4 h-4 mr-3" />
                          Profile
                        </Link>
                        <button
                          onClick={() => {
                            logout();
                            setIsUserDropdownOpen(false);
                          }}
                          className="flex items-center w-full px-4 py-2 text-sm text-gray-300 hover:bg-gray-800/50 hover:text-white transition-colors"
                        >
                          <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          Logout
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="text-white hover:bg-gray-800 transition-all duration-200"
              >
                <Menu className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Mobile Menu */}
          {isMenuOpen && (
            <div className="md:hidden border-t border-gray-800/50 bg-gray-950/95 backdrop-blur-lg">
              <div className="px-4 py-6 space-y-4">

                {/* Navigation Links */}
                <div className="space-y-2">
                  <Link
                    to="/"
                    className="flex items-center px-4 py-3 text-gray-300 hover:text-white hover:bg-gray-800/50 rounded-lg transition-all duration-200 font-medium"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <Home className="w-4 h-4 mr-3" />
                    Home
                  </Link>
                  <Link
                    to="/tasks"
                    className="flex items-center px-4 py-3 text-gray-300 hover:text-white hover:bg-gray-800/50 rounded-lg transition-all duration-200 font-medium"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <Search className="w-4 h-4 mr-3" />
                    Browse Tasks
                  </Link>
                  {user && user.user_type === 'freelancer' && (
                    <Link
                      to="/my-submissions"
                      className="flex items-center px-4 py-3 text-gray-300 hover:text-white hover:bg-gray-800/50 rounded-lg transition-all duration-200 font-medium"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <Briefcase className="w-4 h-4 mr-3" />
                      My Submissions
                    </Link>
                  )}
                </div>

                {/* User Section */}
                {isLoading ? (
                  <div className="flex items-center space-x-2 px-4 py-3">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-teal-500"></div>
                    <span className="text-gray-400">Loading...</span>
                  </div>
                ) : user ? (
                  <div className="space-y-4 pt-4 border-t border-gray-800/50">

                    {/* User Info */}
                    <div className="flex items-center space-x-3 px-4 py-3 bg-gray-800/30 rounded-lg">
                      <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-full flex items-center justify-center flex-shrink-0">
                        <User className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="font-medium text-white truncate">{user.username}</span>
                        <span className="text-sm text-gray-400 truncate">{user.email}</span>
                        <span className="text-sm text-teal-400 capitalize">{user.user_type}</span>
                      </div>
                    </div>

                    {/* Primary Action - Always show Post Task */}
                    <Link to="/post-task" onClick={() => setIsMenuOpen(false)}>
                      <Button className="w-full bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white justify-start">
                        <Plus className="w-4 h-4 mr-2" />
                        Post Task
                      </Button>
                    </Link>

                    {/* Profile Link */}
                    <Link
                      to="/profile"
                      className="flex items-center px-4 py-3 text-gray-300 hover:text-white hover:bg-gray-800/50 rounded-lg transition-all duration-200"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <User className="w-4 h-4 mr-3" />
                      Profile
                    </Link>

                    {/* Logout */}
                    <button
                      onClick={() => {
                        logout();
                        setIsMenuOpen(false);
                      }}
                      className="flex items-center w-full px-4 py-3 text-gray-300 hover:text-white hover:bg-gray-800/50 rounded-lg transition-all duration-200"
                    >
                      <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Logout
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3 pt-4 border-t border-gray-800/50">
                    <a href="/login.html">
                      <Button className="w-full bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white justify-start">
                        <Zap className="w-4 h-4 mr-2" />
                        Get Started
                      </Button>
                    </a>
                  </div>
                )}

                {/* Wallet Connection - Only show when logged in */}
                {user && (
                  <div className="pt-4 border-t border-gray-800/50">
                    <Button
                      variant="outline"
                      className="w-full border-gray-600 text-gray-300 hover:bg-gray-800 hover:border-gray-500 justify-start"
                      onClick={connectWallet}
                    >
                      {account ? (
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span>{account.slice(0, 6)}...{account.slice(-4)}</span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                          </svg>
                          <span>Connect Wallet</span>
                        </div>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </nav>



      {/* Role Switch Celebration */}
      {showCelebration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/80 backdrop-blur-lg">
          <Card className="bg-gray-900/50 backdrop-blur-sm border-gray-800 max-w-lg w-full mx-4 shadow-2xl animate-in fade-in zoom-in duration-300">
            <CardHeader className="text-center pb-6">
              <div className="mx-auto mb-6 w-24 h-24 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-full flex items-center justify-center shadow-lg animate-bounce">
                <CheckCircle className="w-12 h-12 text-white" />
              </div>
              <CardTitle className="text-3xl font-bold text-white mb-4">
                🎉 Role Updated Successfully!
              </CardTitle>
              <CardDescription className="text-gray-300 text-lg leading-relaxed">
                {celebrationMessage}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 pb-8">
              <div className="flex justify-center">
                <Button
                  onClick={() => setShowCelebration(false)}
                  className="bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white px-8 py-3 text-lg font-semibold shadow-lg hover:shadow-teal-500/25 transition-all duration-200"
                >
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Continue
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Login Celebration with Confetti */}
      {showLoginCelebration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/80 backdrop-blur-lg">
          <Card className="bg-gray-900/50 backdrop-blur-sm border-gray-800 max-w-xl w-full mx-4 shadow-2xl animate-in fade-in zoom-in duration-300 relative overflow-hidden">
            <CardHeader className="text-center pb-6">
              <div className="mx-auto mb-6 w-28 h-28 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-full flex items-center justify-center shadow-lg animate-bounce">
                <Shield className="w-14 h-14 text-white" />
              </div>
              <CardTitle className="text-4xl font-bold text-white mb-4">
                🎊 Welcome Back, Champion! 🎊
              </CardTitle>
              <CardDescription className="text-gray-300 text-xl leading-relaxed px-4">
                You've successfully logged into <span className="text-teal-400 font-semibold">DecentraTask</span>. Ready to revolutionize the future of work? 🌟
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 pb-8">
              <div className="flex justify-center">
                <Button
                  onClick={() => setShowLoginCelebration(false)}
                  className="bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white px-10 py-4 text-xl font-semibold shadow-lg hover:shadow-teal-500/25 transition-all duration-200"
                >
                  <Zap className="w-6 h-6 mr-3" />
                  Let's Build Something Amazing!
                </Button>
              </div>
            </CardContent>
            
            {/* Subtle floating sparkles */}
            <div className="absolute top-6 left-6 text-2xl animate-bounce opacity-50 text-teal-400">⭐</div>
            <div className="absolute top-8 right-8 text-xl animate-bounce opacity-50 text-cyan-400" style={{ animationDelay: '0.5s' }}>✨</div>
            <div className="absolute bottom-8 left-8 text-xl animate-bounce opacity-50 text-teal-300" style={{ animationDelay: '1s' }}>💫</div>
            <div className="absolute bottom-6 right-6 text-2xl animate-bounce opacity-50 text-cyan-300" style={{ animationDelay: '1.5s' }}>🌟</div>
          </Card>
        </div>
      )}
    </>
  );
});

// Components
const AnimatedCounter = ({ target, prefix = "", suffix = "" }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const duration = 2000;
    const increment = target / (duration / 50);
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, 50);

    return () => clearInterval(timer);
  }, [target]);

  return <span>{prefix}{count.toLocaleString()}{suffix}</span>;
};

const FloatingBlockchain = () => {
  return (
    <div className="floating-blockchain">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className={`blockchain-cube cube-${i + 1}`}
          style={{
            animationDelay: `${i * 0.5}s`
          }}
        />
      ))}
    </div>
  );
};

// Global helper functions
const getCategoryIcon = (category) => {
  switch (category) {
    case "AI/ML": return <Code className="w-4 h-4" />;
    case "Design": return <Palette className="w-4 h-4" />;
    case "Blockchain": return <Shield className="w-4 h-4" />;
    case "Development": return <Globe className="w-4 h-4" />;
    case "Data Science": return <TrendingUp className="w-4 h-4" />;
    default: return <FileText className="w-4 h-4" />;
  }
};

// TaskCard component moved to separate file

const StatsCard = ({ icon: Icon, title, value, subtitle, color = "teal" }) => {
  // Fix for success rate text color - ensure all text is white
  const getTextColor = (color) => {
    return "white"; // Force all text to be white regardless of color prop
  };

  return (
    <Card className="stats-card bg-gray-900/50 backdrop-blur-sm border-gray-800 hover:border-teal-500/50 transition-all duration-300">
      <CardContent className="p-6 text-center">
        <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full bg-${color}-500/20 mb-4`}>
          <Icon className={`w-6 h-6 text-${color}-400`} />
        </div>
        <div className={`text-3xl font-bold text-${color}-400 mb-1`}>
          {value}
        </div>
        <div className={`text-${getTextColor(color)} font-medium mb-1`}>{title}</div>
        <div className="text-sm text-gray-400">{subtitle}</div>
      </CardContent>
    </Card>
  );
};

const Hero = React.memo(({ totalTasks, liveTasks, totalPaidEth, isLoading, user }) => {
  const navigate = useNavigate();

  return (
    <section className="hero-section relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
      <FloatingBlockchain />

      <div className="container mx-auto px-6 text-center relative z-10">
        <div className="max-w-4xl mx-auto">
          <h1 className="hero-title text-6xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-teal-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
            Decentralized Task
            <br />
            <span className="text-white">Outsourcing</span>
          </h1>

          <p className="text-xl md:text-2xl text-gray-300 mb-8 leading-relaxed">
            Revolutionizing freelancing with smart contracts, zero-knowledge proofs,
            and automated escrow systems for instant, trustless payments.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            {/* Always show both buttons regardless of user type */}
            <Button
              size="lg"
              className="bg-teal-600 hover:bg-teal-700 text-white px-8 py-4 text-lg hover:scale-105 transition-transform"
              onClick={() => navigate('/post-task')}
            >
              <Plus className="w-5 h-5 mr-2" />
              Post a Task
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-teal-500 text-teal-400 hover:bg-teal-500 hover:text-white px-8 py-4 text-lg hover:scale-105 transition-transform"
              onClick={() => navigate('/tasks')}
            >
              <Search className="w-5 h-5 mr-2" />
              Find Tasks
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <StatsCard
              icon={TrendingUp}
              title="Total Tasks"
              value={isLoading ? <div className="animate-pulse text-gray-400">Loading...</div> : <AnimatedCounter target={totalTasks} />}
              subtitle="And growing"
              color="teal"
            />
            <StatsCard
              icon={Zap}
              title="Live Tasks"
              value={isLoading ? <div className="animate-pulse text-gray-400">Loading...</div> : <AnimatedCounter target={liveTasks} />}
              subtitle="Right now"
              color="emerald"
            />
            <StatsCard
              icon={DollarSign}
              title="Total Paid"
              value={
                isLoading
                  ? (<div className="animate-pulse text-gray-400">Loading...</div>)
                  : (<><EthSymbol />{Number(totalPaidEth).toLocaleString()}</>)
              }
              subtitle="To freelancers (×1e3)"
              color="amber"
            />
            <StatsCard
              icon={CheckCircle}
              title="Success Rate"
              value={<AnimatedCounter target={98.5} suffix="%" />}
              subtitle="Completed tasks"
              color="amber"
            />
          </div>
        </div>
      </div>

      <div className="hero-gradient absolute inset-0 pointer-events-none" />
    </section>
  );
});

const Features = () => {
  const features = [
    {
      icon: Shield,
      title: "Smart Contract Escrow",
      description: "Funds are automatically locked and released based on smart contract validation",
      color: "teal"
    },
    {
      icon: Eye,
      title: "Zero Knowledge Proofs",
      description: "Submit work confidentially while maintaining validation integrity",
      color: "emerald"
    },
    {
      icon: Zap,
      title: "Instant Payments",
      description: "No waiting periods - get paid immediately upon work validation",
      color: "amber"
    },
    {
      icon: Lock,
      title: "Trustless System",
      description: "No intermediaries needed - blockchain ensures fair transactions",
      color: "amber"
    }
  ];

  return (
    <section className="py-20 bg-gradient-to-b from-gray-950 to-gray-900">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-white mb-4">
            Why Choose <span className="text-teal-400">DecentraTask</span>?
          </h2>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            Experience the future of freelancing with blockchain-powered automation
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <Card key={index} className="feature-card bg-gray-900/30 backdrop-blur-sm border-gray-800 hover:border-teal-500/50 transition-all duration-500 hover:scale-105">
              <CardContent className="p-8 text-center">
                <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full bg-${feature.color}-500/20 mb-6 feature-icon`}>
                  <feature.icon className={`w-8 h-8 text-${feature.color}-400`} />
                </div>
                <h3 className="text-xl font-bold text-white mb-4">{feature.title}</h3>
                <p className="text-gray-400 leading-relaxed">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

// My Submissions Page Component
const MySubmissionsPage = () => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const firebaseToken = localStorage.getItem('firebase_token');
        if (!firebaseToken) {
          window.location.href = '/login.html';
          return;
        }

        const response = await axios.post(`${BACKEND_URL}/api/auth/firebase/verify`, {}, {
          headers: { 'Authorization': `Bearer ${firebaseToken}` }
        });

        const userData = response.data.user;
        setUser(userData);

        // Check if user is a freelancer
        if (userData.user_type !== 'freelancer') {
          navigate('/');
          return;
        }
      } catch (error) {
        console.error('Failed to fetch user:', error);
        localStorage.removeItem('firebase_token');
        window.location.href = '/login.html';
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 pt-16 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 pt-16">
      <div className="container mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="text-teal-400 hover:text-teal-300"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </div>

        <MySubmissions currentUser={user} />
      </div>
    </div>
  );
};

// Profile Page Component
const ProfilePage = () => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userTasks, setUserTasks] = useState([]);
  const [isUpdatingUserType, setIsUpdatingUserType] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationMessage, setCelebrationMessage] = useState('');
  const navigate = useNavigate();

  // Function to update client spending based on funded tasks
  const updateClientSpending = async (userId) => {
    try {
      const firebaseToken = localStorage.getItem('firebase_token');
      const tasksResponse = await axios.get(`${API}/tasks/my-tasks`, {
        headers: { 'Authorization': `Bearer ${firebaseToken}` }
      });
      const myTasks = Array.isArray(tasksResponse.data) ? tasksResponse.data.map(mapTaskFromApi) : [];

      // Calculate total spending from funded tasks
      const totalSpent = myTasks
        .filter(task => task.escrowStatus === 'funded')
        .reduce((sum, task) => sum + (Number(task.budget) || 0), 0);

      if (totalSpent > 0) {
        // Update user's total earnings (which represents spending for clients)
        await axios.put(`${API}/users/${userId}/payment`,
          { amount: totalSpent },
          {
            headers: { 'Authorization': `Bearer ${firebaseToken}` }
          }
        );
      }
    } catch (error) {
      console.error('Failed to update client spending:', error);
    }
  };

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        // Clean up old tokens
        localStorage.removeItem('access_token');

        const firebaseToken = localStorage.getItem('firebase_token');
        if (!firebaseToken) {
          navigate('/login.html');
          return;
        }

        const response = await axios.post(`${BACKEND_URL}/api/auth/firebase/verify`, {}, {
          headers: { 'Authorization': `Bearer ${firebaseToken}` }
        });
        setUser(response.data.user);

        // Update user's total spending if they are a client and have funded tasks
        if (response.data.user.user_type === 'client') {
          await updateClientSpending(response.data.user.id);
        }

        // Fetch user's tasks (if client) or applications (if freelancer)
        try {
          if (response.data.user.user_type === 'client') {
            // Use the dedicated my-tasks endpoint for clients
            const firebaseToken = localStorage.getItem('firebase_token');
            const myTasksResponse = await axios.get(`${API}/tasks/my-tasks`, {
              headers: { 'Authorization': `Bearer ${firebaseToken}` }
            });
            const myTasks = Array.isArray(myTasksResponse.data) ? myTasksResponse.data.map(mapTaskFromApi) : [];
            setUserTasks(myTasks);
          } else {
            // For freelancers, we'd need to implement applications endpoint
            // For now, just show empty array
            setUserTasks([]);
          }
        } catch (error) {
          console.error('Failed to fetch user tasks:', error);
          setUserTasks([]);
        }
      } catch (error) {
        console.error('Failed to fetch user data:', error);
        localStorage.removeItem('firebase_token');
        localStorage.removeItem('access_token');
        navigate('/login.html');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();

    // Set up periodic refresh to update payment data
    const interval = setInterval(() => {
      fetchUserData();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 pt-20 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const getUserTypeColor = (userType) => {
    return userType === 'client' ? 'text-blue-400' : 'text-green-400';
  };

  const getUserTypeBadge = (userType) => {
    return userType === 'client' ? 'bg-blue-500/20 text-blue-300' : 'bg-green-500/20 text-green-300';
  };

  const handleUserTypeChange = async (newUserType) => {
    if (newUserType === user.user_type) return;

    setIsUpdatingUserType(true);
    try {
      const firebaseToken = localStorage.getItem('firebase_token');
      const response = await axios.put(
        `${BACKEND_URL}/api/auth/me/user-type?user_type=${newUserType}`,
        {},
        {
          headers: { 'Authorization': `Bearer ${firebaseToken}` }
        }
      );

      // Update local user state immediately for instant UI update
      const updatedUser = { ...user, user_type: newUserType };
      setUser(updatedUser);

      // Clear user cache and notify other components about user type change
      localStorage.removeItem('cached_user_data');
      localStorage.removeItem('user_cache_time');
      localStorage.setItem('user_type_changed', Date.now().toString());
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'user_type_changed',
        newValue: Date.now().toString()
      }));

      // Clear user tasks since they'll be different for the new user type
      setUserTasks([]);

      // Refresh user tasks for the new user type
      try {
        if (newUserType === 'client') {
          const myTasksResponse = await axios.get(`${API}/tasks/my-tasks`, {
            headers: { 'Authorization': `Bearer ${firebaseToken}` }
          });
          const myTasks = Array.isArray(myTasksResponse.data) ? myTasksResponse.data.map(mapTaskFromApi) : [];
          setUserTasks(myTasks);
        } else {
          // For freelancers, we would fetch their applications here
          // This is a placeholder for when that functionality is implemented
          setUserTasks([]);
        }
      } catch (taskError) {
        console.error('Failed to fetch updated tasks:', taskError);
        // Don't show error to user, just leave tasks empty
      }

      // Show celebration popup with faster timing
      const roleText = newUserType === 'client' ? 'Client' : 'Freelancer';
      setCelebrationMessage(`Congratulations! You've successfully switched to ${roleText} mode. ${newUserType === 'client' ? 'You can now post tasks and hire talented freelancers!' : 'You can now browse and apply to exciting projects!'}`);
      setShowCelebration(true);

      // Auto-hide celebration after 3 seconds (faster)
      setTimeout(() => {
        setShowCelebration(false);
      }, 3000);

    } catch (error) {
      console.error('Failed to update user type:', error);
      alert('Failed to update account type. Please try again.');
    } finally {
      setIsUpdatingUserType(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 pt-20">
      <div className="container mx-auto px-6 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="text-gray-400 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </div>

          {/* Profile Card */}
          <Card className="bg-gray-900/50 backdrop-blur-sm border-gray-800 mb-8">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <Avatar className="w-20 h-20">
                    <AvatarFallback className="bg-teal-600 text-white text-2xl">
                      {user.username.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-2xl text-white mb-2">{user.username}</CardTitle>
                    <div className="flex items-center gap-3 mb-2">
                      <Badge className={getUserTypeBadge(user.user_type)}>
                        {user.user_type === 'client' ? 'Client' : 'Freelancer'}
                      </Badge>
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                        <span className="text-amber-400">{user.rating}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-gray-400">
                      <Mail className="w-4 h-4" />
                      <span>{user.email}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-teal-400 mb-1">
                    {user.completed_tasks}
                  </div>
                  <div className="text-sm text-gray-400">Completed Tasks</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-emerald-400 mb-1">
                    <EthSymbol />{user.total_earnings}
                  </div>
                  <div className="text-sm text-gray-400">
                    {user.user_type === 'client' ? 'Total Spent' : 'Total Earned'}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-amber-400 mb-1">
                    {user.reputation_score}
                  </div>
                  <div className="text-sm text-gray-400">Reputation Score</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Account Type Settings */}
          <Card className="bg-gray-900/50 backdrop-blur-sm border-gray-800 mb-8">
            <CardHeader>
              <CardTitle className="text-white">Account Settings</CardTitle>
              <CardDescription className="text-gray-400">
                Change your account type to switch between posting tasks and finding work
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label className="text-white font-medium mb-3 block">Account Type</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card
                      className={`cursor-pointer transition-all duration-200 ${user.user_type === 'client'
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-gray-700 bg-gray-800/50 hover:border-blue-400'
                        }`}
                      onClick={() => handleUserTypeChange('client')}
                    >
                      <CardContent className="p-4 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                            <Briefcase className="w-6 h-6 text-blue-400" />
                          </div>
                          <h3 className="font-semibold text-white">Client</h3>
                          <p className="text-sm text-gray-400">Post tasks and hire freelancers</p>
                          {user.user_type === 'client' && (
                            <Badge className="bg-blue-500/20 text-blue-300">Current</Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    <Card
                      className={`cursor-pointer transition-all duration-200 ${user.user_type === 'freelancer'
                        ? 'border-green-500 bg-green-500/10'
                        : 'border-gray-700 bg-gray-800/50 hover:border-green-400'
                        }`}
                      onClick={() => handleUserTypeChange('freelancer')}
                    >
                      <CardContent className="p-4 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                            <Search className="w-6 h-6 text-green-400" />
                          </div>
                          <h3 className="font-semibold text-white">Freelancer</h3>
                          <p className="text-sm text-gray-400">Find tasks and earn money</p>
                          {user.user_type === 'freelancer' && (
                            <Badge className="bg-green-500/20 text-green-300">Current</Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {isUpdatingUserType && (
                  <div className="flex items-center justify-center py-4">
                    <div className="flex items-center gap-2 text-teal-400">
                      <div className="w-4 h-4 border-2 border-teal-400 border-t-transparent rounded-full animate-spin"></div>
                      <span>Updating account type...</span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* User Tasks/Applications */}
          <Card className="bg-gray-900/50 backdrop-blur-sm border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">
                {user.user_type === 'client' ? 'My Posted Tasks' : 'My Applications'}
              </CardTitle>
              <CardDescription className="text-gray-400">
                {user.user_type === 'client'
                  ? 'Tasks you have posted on the platform'
                  : 'Tasks you have applied to'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {userTasks.length > 0 ? (
                <div className="grid gap-4">
                  {userTasks.map((task) => (
                    <Card key={task.id} className="bg-gray-800/50 border-gray-700">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-semibold text-white">{task.title}</h3>
                          <Badge variant="outline" className={`${getStatusColor(task.status)} text-white`}>
                            {task.status}
                          </Badge>
                        </div>
                        <p className="text-gray-400 text-sm mb-3 line-clamp-2">{task.description}</p>
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-4">
                            <span className="text-emerald-400">
                              <EthSymbol />{task.budget}
                            </span>
                            <span className="text-gray-400">
                              <Clock className="w-4 h-4 inline mr-1" />
                              {task.deadline}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-gray-400">
                            <Users className="w-4 h-4" />
                            <span>{task.submissions || 0} submissions</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-gray-400 mb-4">
                    {user.user_type === 'client'
                      ? 'You haven\'t posted any tasks yet.'
                      : 'You haven\'t applied to any tasks yet.'
                    }
                  </div>
                  <Button
                    onClick={() => navigate(user.user_type === 'client' ? '/post-task' : '/tasks')}
                    className="bg-teal-600 hover:bg-teal-700"
                  >
                    {user.user_type === 'client' ? 'Post Your First Task' : 'Browse Tasks'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Role Switch Celebration */}
      {showCelebration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/80 backdrop-blur-lg">
          <Card className="bg-gray-900/50 backdrop-blur-sm border-gray-800 max-w-lg w-full mx-4 shadow-2xl animate-in fade-in zoom-in duration-300">
            <CardHeader className="text-center pb-6">
              <div className="mx-auto mb-6 w-24 h-24 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-full flex items-center justify-center shadow-lg animate-bounce">
                <CheckCircle className="w-12 h-12 text-white" />
              </div>
              <CardTitle className="text-3xl font-bold text-white mb-4">
                🎉 Role Updated Successfully!
              </CardTitle>
              <CardDescription className="text-gray-300 text-lg leading-relaxed">
                {celebrationMessage}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 pb-8">
              <div className="flex justify-center">
                <Button
                  onClick={() => setShowCelebration(false)}
                  className="bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white px-8 py-3 text-lg font-semibold shadow-lg hover:shadow-teal-500/25 transition-all duration-200"
                >
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Continue
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

// Home Page Component
const HomePage = () => {
  const [homeTasks, setHomeTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    let isMounted = true;
    let intervalId;

    const fetchTasks = async () => {
      try {
        const { data } = await axios.get(`${API}/tasks`);
        if (isMounted) setHomeTasks(Array.isArray(data) ? data.map(mapTaskFromApi) : []);
      } catch {
        if (isMounted) setHomeTasks(mockTasks);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    const checkUser = async () => {
      try {
        // Clean up old tokens first
        localStorage.removeItem('access_token');

        const firebaseToken = localStorage.getItem('firebase_token');
        if (firebaseToken) {
          const response = await axios.post(`${BACKEND_URL}/api/auth/firebase/verify`, {}, {
            headers: { 'Authorization': `Bearer ${firebaseToken}` }
          });
          if (isMounted) setUser(response.data.user);
        }
      } catch (error) {
        console.error('Failed to get user:', error);
        // Token is invalid, remove all tokens
        localStorage.removeItem('firebase_token');
        localStorage.removeItem('access_token');
      }
    };

    fetchTasks();
    checkUser();
    // Refresh periodically for real-time-ish stats (reduced frequency for better performance)
    intervalId = setInterval(fetchTasks, 60000); // Changed from 30s to 60s

    return () => {
      isMounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  // Show ALL tasks for real-time statistics (cumulative data from all users)
  const totalTasks = homeTasks.length;
  const liveTasksCount = homeTasks.filter(t => t.status !== "completed" && isDeadlineInFutureOrToday(t.deadline)).length;
  const totalPaidEth = homeTasks
    .filter(t => t.escrowStatus === 'funded')
    .reduce((sum, t) => sum + (Number(t.budget) || 0), 0) * 1000; // Convert 0.001 ETH to 1 ETH (multiply by 1e3)

  return (
    <div className="min-h-screen bg-gray-950">
      <Hero totalTasks={totalTasks} liveTasks={liveTasksCount} totalPaidEth={totalPaidEth} isLoading={isLoading} user={user} />
      <Features />
    </div>
  );
};

// Tasks Page Component  
const TasksPage = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [flashMessage, setFlashMessage] = useState(location?.state?.flash || "");

  // Function to handle client rating
  const handleRateClient = async (clientUsername, rating) => {
    try {
      const firebaseToken = localStorage.getItem('firebase_token');
      if (!firebaseToken) {
        alert('Please log in to rate clients');
        return;
      }

      // Find the client user by username to get their ID
      // For now, we'll use the username as ID (this should be improved in production)
      await axios.put(`${API}/users/${clientUsername}/rating`,
        { rating: rating },
        {
          headers: { 'Authorization': `Bearer ${firebaseToken}` }
        }
      );

      alert(`Successfully rated ${clientUsername} with ${rating} stars!`);

      // Refresh tasks to show updated rating
      const response = await axios.get(`${API}/tasks`);
      setTasks(Array.isArray(response.data) ? response.data.map(mapTaskFromApi) : []);
    } catch (error) {
      console.error('Failed to rate client:', error);
      alert('Failed to submit rating. Please try again.');
    }
  };

  useEffect(() => {
    let isMounted = true;
    const fetchTasks = async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const { data } = await axios.get(`${API}/tasks`);
        if (isMounted) {
          const mapped = Array.isArray(data) ? data.map(mapTaskFromApi) : [];
          // Restore locally marked funded tasks
          let fundedIds = [];
          try {
            fundedIds = JSON.parse(localStorage.getItem('fundedTaskIds') || '[]');
          } catch { }
          const merged = mapped.map(t => fundedIds.includes(t.id) ? { ...t, escrowStatus: 'funded' } : t);
          setTasks(merged);
        }
      } catch (err) {
        // Fallback to mock data so UI still works
        if (isMounted) {
          setLoadError("Failed to load from backend. Showing demo data.");
          // Apply fundedIds to mock too
          let fundedIds = [];
          try {
            fundedIds = JSON.parse(localStorage.getItem('fundedTaskIds') || '[]');
          } catch { }
          const merged = mockTasks.map(t => fundedIds.includes(t.id) ? { ...t, escrowStatus: 'funded' } : t);
          setTasks(merged);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    const checkUser = async () => {
      try {
        const firebaseToken = localStorage.getItem('firebase_token');
        if (firebaseToken) {
          const response = await axios.post(`${BACKEND_URL}/api/auth/firebase/verify`, {}, {
            headers: { 'Authorization': `Bearer ${firebaseToken}` }
          });
          if (isMounted) setUser(response.data.user);
        }
      } catch (error) {
        console.error('Failed to get user:', error);
      }
    };

    fetchTasks();
    checkUser();
    return () => { isMounted = false; };
  }, []);

  // Consume one-time flash message from navigation state
  useEffect(() => {
    if (location?.state?.flash) {
      // If there's a specific task to highlight for funding, we could add that logic here
      if (location?.state?.showFundEscrow && location?.state?.taskId) {
        // Could highlight the specific task that needs funding
        console.log('Task needs funding:', location.state.taskId);
      }
      // Clear state so it doesn't persist on refresh/back
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || task.category === selectedCategory;
    // Show all tasks for browsing - users can see all available tasks
    return matchesSearch && matchesCategory;
  });

  const taskCategories = ["all", ...new Set(tasks.map(task => task.category))];

  // Auto re-validation ticker to move tasks when deadlines pass without reload
  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  const liveTasks = filteredTasks.filter(t => t.status !== "completed" && isDeadlineInFutureOrToday(t.deadline));
  const finishedTasks = filteredTasks.filter(t => t.status === "completed" || !isDeadlineInFutureOrToday(t.deadline));

  const onFundTask = async (task) => {
    try {
      if (!window.ethereum) {
        alert("MetaMask not found. Install MetaMask to fund tasks.");
        return;
      }

      // Ensure user has connected wallet and selected an account
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      if (accounts.length === 0) {
        alert("Please connect your wallet first.");
        return;
      }

      // If multiple accounts available, let user select
      let selectedAccount = accounts[0]; // Default to first account

      // Switch to the correct network
      try {
        await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_ID_HEX }] });
      } catch (switchError) {
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: CHAIN_ID_HEX,
              chainName: NETWORK_NAME,
              nativeCurrency: { name: CURRENCY_SYMBOL, symbol: CURRENCY_SYMBOL, decimals: 18 },
              rpcUrls: [RPC_URL],
              blockExplorerUrls: [],
            }],
          });
        } else {
          throw switchError;
        }
      }

      // Using selected source address and fixed escrow destination: 0x2Ef18250a69D9Fa3492Ff7098604E7b7e62E3Fd4
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner(selectedAccount);
      const valueWei = ethers.parseEther(String(task.budget));
      const tx = await signer.sendTransaction({
        from: selectedAccount,
        to: ESCROW_ADDRESS,
        value: valueWei
      });
      await tx.wait();

      // Local optimistic update: mark as funded and persist
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, escrowStatus: 'funded' } : t));
      try {
        const funded = JSON.parse(localStorage.getItem('fundedTaskIds') || '[]');
        if (!funded.includes(task.id)) {
          funded.push(task.id);
          localStorage.setItem('fundedTaskIds', JSON.stringify(funded));
        }
      } catch { }

      // Update escrow status in backend
      try {
        const firebaseToken = localStorage.getItem('firebase_token');
        await axios.put(`${API}/tasks/${task.id}/escrow-status?escrow_status=funded`, {}, {
          headers: { 'Authorization': `Bearer ${firebaseToken}` }
        });
      } catch (error) {
        console.error('Failed to update escrow status in backend:', error);
      }

      // Update client's total spending
      if (user && user.user_type === 'client') {
        try {
          const firebaseToken = localStorage.getItem('firebase_token');
          await axios.put(`${API}/users/${user.id}/payment`,
            { amount: task.budget },
            {
              headers: { 'Authorization': `Bearer ${firebaseToken}` }
            }
          );
        } catch (error) {
          console.error('Failed to update client spending:', error);
        }
      }

      // Refresh tasks from backend in background (best-effort)
      axios.get(`${API}/tasks`).then(({ data }) => {
        setTasks(Array.isArray(data) ? data.map(mapTaskFromApi) : []);
      }).catch(() => { });
      alert("Escrow funded successfully.");
    } catch (err) {
      console.error(err);
      alert("Funding failed: " + (err?.message || err));
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 pt-16">
      <div className="container mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-6">
            <Button
              variant="ghost"
              onClick={() => navigate('/')}
              className="text-teal-400 hover:text-teal-300 mr-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </div>

          <h1 className="text-5xl font-bold text-white mb-4">
            Discover <span className="text-teal-400">Tasks</span>
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Browse available tasks with automatic escrow and instant payments
          </p>
        </div>

        {/* Flash success message */}
        {flashMessage && (
          <div className="mb-8">
            <div className="flex items-center justify-between bg-emerald-900/40 border border-emerald-700 text-emerald-300 rounded-md px-4 py-3">
              <span>{flashMessage}</span>
              <Button size="sm" variant="ghost" className="text-emerald-300 hover:text-white" onClick={() => setFlashMessage("")}>Dismiss</Button>
            </div>
          </div>
        )}

        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              placeholder="Search tasks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-gray-900/50 border-gray-700 text-white placeholder-gray-400 focus:border-teal-500 h-12"
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-full md:w-48 bg-gray-900/50 border-gray-700 text-white h-12">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-700 text-white">
              {taskCategories.map(category => (
                <SelectItem key={category} value={category}>
                  {category === "all" ? "All Categories" : category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Results Summary */}
        <div className="mb-8">
          <p className="text-gray-400">
            {isLoading ? (
              <span>Loading tasks…</span>
            ) : (
              <>
                Showing <span className="text-teal-400 font-semibold">{filteredTasks.length}</span> tasks
              </>
            )}
            {selectedCategory !== "all" && (
              <span> in <span className="text-teal-400 font-semibold">{selectedCategory}</span></span>
            )}
            {searchTerm && (
              <span> matching "<span className="text-teal-400 font-semibold">{searchTerm}</span>"</span>
            )}
          </p>
          {loadError && (
            <p className="text-amber-400 text-sm mt-2">{loadError}</p>
          )}
        </div>

        {/* Live Tasks */}
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-white mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Live Tasks
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {liveTasks.map((task) => (
              <TaskCard 
                key={task.id} 
                task={task} 
                onTaskUpdate={(updatedTask) => {
                  setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
                }}
                currentUser={user}
                onFundTask={onFundTask}
              />
            ))}
          </div>
          {!isLoading && liveTasks.length === 0 && (
            <p className="text-gray-500 mt-3">No live tasks.</p>
          )}
        </div>

        {/* Finished Tasks */}
        <div>
          <h2 className="text-2xl font-semibold text-white mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Finished Tasks
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {finishedTasks.map((task) => (
              <TaskCard 
                key={task.id} 
                task={task} 
                onTaskUpdate={(updatedTask) => {
                  setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
                }}
                currentUser={user}
                onFundTask={onFundTask}
              />
            ))}
          </div>
          {!isLoading && finishedTasks.length === 0 && (
            <p className="text-gray-500 mt-3">No finished tasks.</p>
          )}
        </div>

        {!isLoading && filteredTasks.length === 0 && (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-gray-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-400 mb-2">No tasks found</h3>
            <p className="text-gray-500 mb-6">Try adjusting your search or filters</p>
            <Button
              variant="outline"
              onClick={() => {
                setSearchTerm("");
                setSelectedCategory("all");
              }}
              className="border-gray-700 text-gray-400 hover:bg-gray-800"
            >
              Clear Filters
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

// Post Task Page Component
const PostTaskPage = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    budget: "",
    deadline: "",
    skills: [],
    client: ""
  });

  const [skillInput, setSkillInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Fetch current user on component mount
  useEffect(() => {
    const fetchUser = async () => {
      try {
        // Clean up old tokens first
        localStorage.removeItem('access_token');

        const firebaseToken = localStorage.getItem('firebase_token');
        if (!firebaseToken) {
          // Use window.location.href for proper redirect to login page
          window.location.href = '/login.html';
          return;
        }

        const response = await axios.post(`${BACKEND_URL}/api/auth/firebase/verify`, {}, {
          headers: { 'Authorization': `Bearer ${firebaseToken}` }
        });

        const userData = response.data.user;
        setUser(userData);

        // Check if user is a client
        if (userData.user_type !== 'client') {
          alert('Only clients can post tasks. Please switch to a client account.');
          navigate('/');
          return;
        }

        // Set client name in form data
        setFormData(prev => ({
          ...prev,
          client: userData.username
        }));
      } catch (error) {
        console.error('Failed to fetch user:', error);
        // Token is invalid, remove all tokens
        localStorage.removeItem('firebase_token');
        localStorage.removeItem('access_token');
        // Use window.location.href for proper redirect to login page
        window.location.href = '/login.html';
      } finally {
        setIsLoadingUser(false);
      }
    };

    fetchUser();
  }, [navigate]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const addSkill = () => {
    if (skillInput.trim() && !formData.skills.includes(skillInput.trim())) {
      setFormData(prev => ({
        ...prev,
        skills: [...prev.skills, skillInput.trim()]
      }));
      setSkillInput("");
    }
  };

  const formatDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const isDateDisabled = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cmp = new Date(date);
    cmp.setHours(0, 0, 0, 0);
    return cmp < today; // disable past dates
  };

  const removeSkill = (skillToRemove) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.filter(skill => skill !== skillToRemove)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    let createdTask = null;
    
    try {
      const payload = {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        budget: Number(formData.budget),
        deadline: formData.deadline,
        client: formData.client,
        skills: formData.skills,
      };
      
      // Create task on backend first
      const { data: created } = await axios.post(`${API}/tasks`, payload);
      createdTask = created;

      // Try to pay ETH to escrow
      if (!window.ethereum) {
        // Task created but payment failed - redirect to fund escrow
        navigate('/tasks', { 
          state: { 
            flash: 'Task created successfully! Please fund the escrow to activate it.',
            showFundEscrow: true,
            taskId: created.id
          } 
        });
        return;
      }

      // Use connected wallet automatically
      const accounts = await window.ethereum.request({ method: "eth_accounts" });
      if (accounts.length === 0) {
        // Try to connect wallet if not connected
        try {
          const newAccounts = await window.ethereum.request({ method: "eth_requestAccounts" });
          if (newAccounts.length === 0) {
            // Task created but wallet not connected - redirect to fund escrow
            navigate('/tasks', { 
              state: { 
                flash: 'Task created successfully! Please connect your wallet and fund the escrow to activate it.',
                showFundEscrow: true,
                taskId: created.id
              } 
            });
            return;
          }
        } catch (walletError) {
          // Task created but wallet connection failed - redirect to fund escrow
          navigate('/tasks', { 
            state: { 
              flash: 'Task created successfully! Please connect your wallet and fund the escrow to activate it.',
              showFundEscrow: true,
              taskId: created.id
            } 
          });
          return;
        }
      }

      // Always use the first connected account
      const selectedAccount = accounts.length > 0 ? accounts[0] : (await window.ethereum.request({ method: "eth_requestAccounts" }))[0];

      try {
        await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_ID_HEX }] });
      } catch (switchError) {
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: CHAIN_ID_HEX,
              chainName: NETWORK_NAME,
              nativeCurrency: { name: CURRENCY_SYMBOL, symbol: CURRENCY_SYMBOL, decimals: 18 },
              rpcUrls: [RPC_URL],
              blockExplorerUrls: [],
            }],
          });
        } else {
          // Network switch failed - redirect to fund escrow
          navigate('/tasks', { 
            state: { 
              flash: 'Task created successfully! Please switch to the correct network and fund the escrow to activate it.',
              showFundEscrow: true,
              taskId: created.id
            } 
          });
          return;
        }
      }

      // Try to send payment transaction
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner(selectedAccount);
        const valueWei = ethers.parseEther(String(payload.budget));
        const tx = await signer.sendTransaction({
          from: selectedAccount,
          to: ESCROW_ADDRESS,
          value: valueWei
        });
        await tx.wait();
        
        // Payment successful - mark as funded locally
        try {
          const funded = JSON.parse(localStorage.getItem('fundedTaskIds') || '[]');
          if (created?.id && !funded.includes(created.id)) {
            funded.push(created.id);
            localStorage.setItem('fundedTaskIds', JSON.stringify(funded));
          }
        } catch { }

        // Update escrow status in backend
        try {
          const firebaseToken = localStorage.getItem('firebase_token');
          await axios.put(`${API}/tasks/${created.id}/escrow-status?escrow_status=funded`, {}, {
            headers: { 'Authorization': `Bearer ${firebaseToken}` }
          });
        } catch (error) {
          console.error('Failed to update escrow status in backend:', error);
        }

        // Update client's total spending
        try {
          const firebaseToken = localStorage.getItem('firebase_token');
          await axios.put(`${API}/users/${user.id}/payment`,
            { amount: payload.budget },
            {
              headers: { 'Authorization': `Bearer ${firebaseToken}` }
            }
          );
        } catch (error) {
          console.error('Failed to update client spending:', error);
        }
        
        // Payment successful - redirect with success message
        setFormData({
          title: "",
          description: "",
          category: "",
          budget: "",
          deadline: "",
          skills: [],
          client: user?.username || ""
        });
        navigate('/tasks', { state: { flash: 'Task posted and funded successfully!' } });
        
      } catch (paymentError) {
        console.error("Payment failed:", paymentError);
        // Task created but payment failed - redirect to fund escrow
        navigate('/tasks', { 
          state: { 
            flash: 'Task created successfully! Payment failed - please fund the escrow to activate it.',
            showFundEscrow: true,
            taskId: created.id
          } 
        });
      }

    } catch (error) {
      console.error("Error creating task:", error);
      alert(`Failed to create task: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = formData.title && formData.description && formData.category &&
    formData.budget && formData.deadline;

  if (isLoadingUser) {
    return (
      <div className="min-h-screen bg-gray-950 pt-16 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500 mx-auto mb-4"></div>
          <div className="text-white text-lg">Loading...</div>
          <div className="text-gray-400 text-sm mt-2">Verifying authentication...</div>
        </div>
      </div>
    );
  }

  if (submitSuccess) {
    return (
      <div className="min-h-screen bg-gray-950 pt-16 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-teal-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
            <CheckCircle className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">Task Posted Successfully!</h2>
          <p className="text-gray-400 mb-6">Your task has been submitted and will be visible to freelancers shortly.</p>
          <p className="text-sm text-gray-500">Redirecting to task marketplace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 pt-16">
      <div className="container mx-auto px-6 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center mb-6">
              <Button
                variant="ghost"
                onClick={() => navigate('/')}
                className="text-teal-400 hover:text-teal-300 mr-4"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </div>

            <h1 className="text-5xl font-bold text-white mb-4">
              Post a <span className="text-teal-400">Task</span>
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Create a new task with automatic escrow and blockchain validation
            </p>
          </div>

          {/* Form */}
          <Card className="bg-gray-900/50 backdrop-blur-sm border-gray-800">
            <CardHeader>
              <CardTitle className="text-2xl text-white flex items-center">
                <Briefcase className="w-6 h-6 mr-2 text-teal-400" />
                Task Details
              </CardTitle>
              <CardDescription className="text-gray-400">
                Provide clear and detailed information about your task
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Title */}
                <div className="space-y-2">
                  <Label htmlFor="title" className="text-white font-medium">
                    Task Title *
                  </Label>
                  <Input
                    id="title"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    placeholder="e.g., ML Training Images - Sign Language Dataset"
                    className="bg-gray-800/50 border-gray-700 text-white placeholder-gray-400 focus:border-teal-500"
                    required
                  />
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description" className="text-white font-medium">
                    Description *
                  </Label>
                  <Textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="Provide a detailed description of what you need..."
                    rows={4}
                    className="bg-gray-800/50 border-gray-700 text-white placeholder-gray-400 focus:border-teal-500"
                    required
                  />
                </div>

                {/* Category and Budget Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="category" className="text-white font-medium">
                      Category *
                    </Label>
                    <Select value={formData.category} onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}>
                      <SelectTrigger className="bg-gray-800/50 border-gray-700 text-white">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-900 border-gray-700 text-white">
                        {categories.map(category => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="budget" className="text-white font-medium">
                      Budget (ETH) *
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400">Ξ</span>
                      <Input
                        id="budget"
                        name="budget"
                        type="number"
                        value={formData.budget}
                        onChange={handleInputChange}
                        placeholder="0.1"
                        step="0.0001"
                        min="0"
                        className="pl-8 bg-gray-800/50 border-gray-700 text-white placeholder-gray-400 focus:border-teal-500"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Deadline */}
                <div className="space-y-2">
                  <Label htmlFor="deadline" className="text-white font-medium">
                    Deadline *
                  </Label>
                  <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-start text-left font-normal bg-gray-800/50 border-gray-700 text-white"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 text-gray-400" />
                        {formData.deadline ? formData.deadline : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-gray-900 border-gray-800 text-white" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.deadline ? new Date(formData.deadline) : undefined}
                        onSelect={(date) => {
                          if (!date || isDateDisabled(date)) return;
                          const val = formatDate(date);
                          setFormData(prev => ({ ...prev, deadline: val }));
                          setIsCalendarOpen(false);
                        }}
                        disabled={isDateDisabled}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Skills */}
                <div className="space-y-2">
                  <Label className="text-white font-medium">
                    Required Skills
                  </Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        value={skillInput}
                        onChange={(e) => setSkillInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
                        placeholder="e.g., React, Python, Machine Learning"
                        className="pl-10 bg-gray-800/50 border-gray-700 text-white placeholder-gray-400 focus:border-teal-500"
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={addSkill}
                      variant="outline"
                      className="border-teal-500 text-teal-400 hover:bg-teal-500 hover:text-white"
                    >
                      Add
                    </Button>
                  </div>

                  {formData.skills.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {formData.skills.map((skill, index) => (
                        <Badge
                          key={index}
                          variant="secondary"
                          className="bg-teal-500/20 text-teal-300 border-teal-500/30 flex items-center gap-1"
                        >
                          {skill}
                          <X
                            className="w-3 h-3 cursor-pointer hover:text-red-400"
                            onClick={() => removeSkill(skill)}
                          />
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Submit Button */}
                <div className="pt-6 border-t border-gray-800">
                  <div className="flex flex-col sm:flex-row gap-4 justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => navigate('/')}
                      className="border-gray-700 text-gray-400 hover:bg-gray-800"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={!isFormValid || isSubmitting}
                      className="bg-teal-600 hover:bg-teal-700 text-white px-8 disabled:bg-gray-700 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                          Posting Task...
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4 mr-2" />
                          Post Task
                        </>
                      )}
                    </Button>
                  </div>

                  {!isFormValid && (
                    <p className="text-red-400 text-sm mt-2 text-right">
                      Please fill in all required fields
                    </p>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

function App() {
  useEffect(() => {
    // Hide initial loader when React app starts
    if (window.hideInitialLoader) {
      window.hideInitialLoader();
    }

    // Global wallet auto-reconnection on app load
    const autoConnectWallet = async () => {
      if (window.ethereum) {
        try {
          // Check if user is logged in
          const firebaseToken = localStorage.getItem('firebase_token');
          if (firebaseToken) {
            // Check if accounts are already connected
            const accounts = await window.ethereum.request({ method: "eth_accounts" });
            if (accounts.length > 0) {
              // Wallet is already connected, no need to do anything
              console.log('Wallet auto-reconnected:', accounts[0]);
            }
          }
        } catch (error) {
          console.log('Wallet auto-reconnection failed:', error);
        }
      }
    };

    autoConnectWallet();
  }, []);

  return (
    <div className="App">
      <BrowserRouter>
        <Navigation />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/post-task" element={<PostTaskPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/my-submissions" element={<MySubmissionsPage />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;