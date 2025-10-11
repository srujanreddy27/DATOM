import React, { useState, useEffect } from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, useNavigate, useLocation, Link } from "react-router-dom";
import axios from "axios";
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
  X
} from "lucide-react";
import { Calendar } from "./components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./components/ui/popover";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";
const API = `${BACKEND_URL}/api`;
const ESCROW_ADDRESS = process.env.REACT_APP_ESCROW_ADDRESS || "0x0000000000000000000000000000000000000000"; // TODO: set in frontend/.env
const ESCROW_RECEIVE = "0x2Ef18250a69D9Fa3492Ff7098604E7b7e62E3Fd4"; // Address where client funds are sent
const SEPOLIA_CHAIN_ID_HEX = "0xaa36a7"; // 11155111

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
    applicants: 12,
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
    applicants: 8,
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
    applicants: 15,
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
    applicants: 9,
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
    applicants: 6,
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
    applicants: 14,
    skills: ["D3.js", "React", "Data Visualization"],
    escrowStatus: "pending"
  }
];

const mockStats = {
  totalTasks: 1847,
  activeTasks: 542,
  totalEarnings: 2840000,
  successfulTransactions: 98.5
};

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
  applicants: apiTask.applicants ?? 0,
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

// Navigation Component
const Navigation = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [account, setAccount] = useState(null);

  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        alert("MetaMask not found. Please install it.");
        return;
      }
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: SEPOLIA_CHAIN_ID_HEX }],
        });
      } catch (switchError) {
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: SEPOLIA_CHAIN_ID_HEX,
              chainName: "Sepolia Test Network",
              nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
              rpcUrls: ["https://sepolia.infura.io/v3/"],
              blockExplorerUrls: ["https://sepolia.etherscan.io"],
            }],
          });
        } else {
          throw switchError;
        }
      }
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      setAccount(accounts[0]);
    } catch (err) {
      console.error("Wallet connection failed", err);
      alert("Failed to connect wallet: " + (err?.message || err));
    }
  };
  
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-950/80 backdrop-blur-md border-b border-gray-800">
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-teal-500 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">DecentraTask</span>
          </Link>
          
          <div className="hidden md:flex items-center space-x-8">
            <Link to="/" className="text-gray-300 hover:text-teal-400 transition-colors">
              Home
            </Link>
            <Link to="/tasks" className="text-gray-300 hover:text-teal-400 transition-colors">
              Browse Tasks
            </Link>
            <a href="/login.html" className="text-gray-300 hover:text-teal-400 transition-colors">
              Login
            </a>
            <Button size="sm" variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800" onClick={connectWallet}>
              {account ? `${account.slice(0,6)}...${account.slice(-4)}` : "Connect Wallet"}
            </Button>
            <Link to="/post-task">
              <Button size="sm" className="bg-teal-600 hover:bg-teal-700">
                Post Task
              </Button>
            </Link>
          </div>
          
          <div className="md:hidden">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-white"
            >
              <Menu className="w-5 h-5" />
            </Button>
          </div>
        </div>
        
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-800">
            <div className="flex flex-col space-y-4">
              <Link to="/" className="text-gray-300 hover:text-teal-400 transition-colors">
                Home
              </Link>
              <Link to="/tasks" className="text-gray-300 hover:text-teal-400 transition-colors">
                Browse Tasks
              </Link>
              <a href="/login.html" className="text-gray-300 hover:text-teal-400 transition-colors">
                Login
              </a>
              <Link to="/post-task">
                <Button size="sm" className="bg-teal-600 hover:bg-teal-700 self-start">
                  Post Task
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

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

const EthSymbol = () => <span className="text-emerald-400 mr-1">Ξ</span>;

const TaskCard = ({ task, onFund, finished = false }) => {
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

  const getStatusColor = (status) => {
    switch (status) {
      case "open": return "bg-emerald-500";
      case "in_progress": return "bg-amber-500";
      case "completed": return "bg-teal-500";
      default: return "bg-gray-500";
    }
  };

  return (
    <Card className="task-card group hover:scale-[1.02] transition-all duration-300 hover:shadow-2xl hover:shadow-teal-500/20 border-gray-800 bg-gray-900/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {getCategoryIcon(task.category)}
            <Badge variant="secondary" className="bg-teal-500/20 text-teal-300">
              {task.category}
            </Badge>
          </div>
          <div className={`w-3 h-3 rounded-full ${getStatusColor(task.status)} pulse-animation`} />
        </div>
        <CardTitle className="text-lg text-white group-hover:text-teal-300 transition-colors">
          {task.title}
        </CardTitle>
        <CardDescription className="text-gray-400 line-clamp-2">
          {task.description}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <EthSymbol />
            <span className="text-xl font-bold text-emerald-400">{task.budget} ETH</span>
          </div>
          <div className="flex items-center gap-1 text-sm text-gray-400">
            <Clock className="w-4 h-4" />
            <span>{task.deadline}</span>
          </div>
        </div>
        
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Avatar className="w-6 h-6">
              <AvatarFallback className="bg-teal-600 text-white text-xs">
                {task.client.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <span className="text-gray-300">{task.client}</span>
            <div className="flex items-center gap-1">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              <span className="text-amber-400">{task.clientRating}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 text-gray-400">
            <Users className="w-4 h-4" />
            <span>{task.applicants}</span>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-1">
          {task.skills.slice(0, 3).map((skill) => (
            <Badge key={skill} variant="outline" className="text-xs border-gray-700 text-gray-300">
              {skill}
            </Badge>
          ))}
        </div>
        
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${finished ? 'bg-amber-500' : (task.escrowStatus === 'funded' ? 'bg-emerald-500' : 'bg-amber-500')}`} />
            <span className="text-xs text-gray-400">
              Escrow {task.escrowStatus === 'funded' ? 'Paid' : 'Pending'}
            </span>
          </div>
          {task.escrowStatus === 'funded' ? (
            <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white">
              Apply Now
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="border-teal-600 text-teal-400 hover:bg-teal-600 hover:text-white" onClick={() => onFund?.(task)}>
              Fund Escrow
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

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

const Hero = ({ totalTasks, liveTasks, totalPaidEth, isLoading }) => {
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
              value={isLoading ? <AnimatedCounter target={mockStats.totalTasks} /> : <AnimatedCounter target={totalTasks} />}
              subtitle="And growing"
              color="teal"
            />
            <StatsCard 
              icon={Zap}
              title="Live Tasks"
              value={isLoading ? <AnimatedCounter target={mockStats.activeTasks} /> : <AnimatedCounter target={liveTasks} />}
              subtitle="Right now"
              color="emerald"
            />
            <StatsCard 
              icon={DollarSign}
              title="Total Paid"
              value={
                isLoading
                  ? (<><EthSymbol />{mockStats.totalEarnings.toLocaleString()}</>)
                  : (<><EthSymbol />{Number(totalPaidEth).toLocaleString()}</>)
              }
              subtitle="To freelancers"
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
};

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

// Home Page Component
const HomePage = () => {
  const [homeTasks, setHomeTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

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

    fetchTasks();
    // Refresh periodically for real-time-ish stats
    intervalId = setInterval(fetchTasks, 30000);

    return () => {
      isMounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  const totalTasks = homeTasks.length;
  const liveTasksCount = homeTasks.filter(t => isDeadlineInFutureOrToday(t.deadline)).length;
  const totalPaidEth = homeTasks
    .filter(t => t.escrowStatus === 'funded')
    .reduce((sum, t) => sum + (Number(t.budget) || 0), 0);

  return (
    <div className="min-h-screen bg-gray-950">
      <Hero totalTasks={totalTasks} liveTasks={liveTasksCount} totalPaidEth={totalPaidEth} isLoading={isLoading} />
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
  const navigate = useNavigate();
  const location = useLocation();
  const [flashMessage, setFlashMessage] = useState(location?.state?.flash || "");
  
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
          } catch {}
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
          } catch {}
          const merged = mockTasks.map(t => fundedIds.includes(t.id) ? { ...t, escrowStatus: 'funded' } : t);
          setTasks(merged);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    fetchTasks();
    return () => { isMounted = false; };
  }, []);

  // Consume one-time flash message from navigation state
  useEffect(() => {
    if (location?.state?.flash) {
      // Clear state so it doesn't persist on refresh/back
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);
  
  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         task.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || task.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const taskCategories = ["all", ...new Set(tasks.map(task => task.category))];

  // Auto re-validation ticker to move tasks when deadlines pass without reload
  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  const liveTasks = filteredTasks.filter(t => isDeadlineInFutureOrToday(t.deadline));
  const finishedTasks = filteredTasks.filter(t => !isDeadlineInFutureOrToday(t.deadline));
  
  const onFundTask = async (task) => {
    try {
      if (!window.ethereum) {
        alert("MetaMask not found.");
        return;
      }
      try {
        await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: SEPOLIA_CHAIN_ID_HEX }] });
      } catch (switchError) {
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: SEPOLIA_CHAIN_ID_HEX,
              chainName: "Sepolia Test Network",
              nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
              rpcUrls: ["https://sepolia.infura.io/v3/"],
              blockExplorerUrls: ["https://sepolia.etherscan.io"],
            }],
          });
        } else {
          throw switchError;
        }
      }
      if (!ESCROW_RECEIVE || ESCROW_RECEIVE === "0x0000000000000000000000000000000000000000") {
        alert("Escrow receive address not set.");
        return;
      }
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const valueWei = ethers.parseEther(String(task.budget));
      const tx = await signer.sendTransaction({ to: ESCROW_RECEIVE, value: valueWei });
      await tx.wait();

      // Local optimistic update: mark as funded and persist
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, escrowStatus: 'funded' } : t));
      try {
        const funded = JSON.parse(localStorage.getItem('fundedTaskIds') || '[]');
        if (!funded.includes(task.id)) {
          funded.push(task.id);
          localStorage.setItem('fundedTaskIds', JSON.stringify(funded));
        }
      } catch {}

      // Refresh tasks from backend in background (best-effort)
      axios.get(`${API}/tasks`).then(({ data }) => {
        setTasks(Array.isArray(data) ? data.map(mapTaskFromApi) : []);
      }).catch(() => {});
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
              <TaskCard key={task.id} task={task} onFund={onFundTask} />
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
              <TaskCard key={task.id} task={task} finished />
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
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    budget: "",
    deadline: "",
    skills: [],
    client: "Demo Client" // Mock client name
  });
  
  const [skillInput, setSkillInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

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
    today.setHours(0,0,0,0);
    const cmp = new Date(date);
    cmp.setHours(0,0,0,0);
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
      // Create on backend
      const { data: created } = await axios.post(`${API}/tasks`, payload);

      // Pay ETH to escrow on Sepolia
      if (!window.ethereum) {
        throw new Error("MetaMask not found. Install MetaMask to pay in ETH.");
      }
      try {
        await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: SEPOLIA_CHAIN_ID_HEX }] });
      } catch (switchError) {
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: SEPOLIA_CHAIN_ID_HEX,
              chainName: "Sepolia Test Network",
              nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
              rpcUrls: ["https://sepolia.infura.io/v3/"],
              blockExplorerUrls: ["https://sepolia.etherscan.io"],
            }],
          });
        } else {
          throw switchError;
        }
      }
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const valueWei = ethers.parseEther(String(payload.budget));
      if (!ESCROW_RECEIVE || ESCROW_RECEIVE === "0x0000000000000000000000000000000000000000") {
        throw new Error("Escrow receive address not set.");
      }
      const tx = await signer.sendTransaction({ to: ESCROW_RECEIVE, value: valueWei });
      await tx.wait();
      // Persist as funded locally for immediate UX
      try {
        const funded = JSON.parse(localStorage.getItem('fundedTaskIds') || '[]');
        if (created?.id && !funded.includes(created.id)) {
          funded.push(created.id);
          localStorage.setItem('fundedTaskIds', JSON.stringify(funded));
        }
      } catch {}
      // Redirect with success flash
      setFormData({
        title: "",
        description: "",
        category: "",
        budget: "",
        deadline: "",
        skills: [],
        client: "Demo Client"
      });
      navigate('/tasks', { state: { flash: 'Task posted successfully. Escrow paid.' } });
      
    } catch (error) {
      console.error("Error submitting task:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = formData.title && formData.description && formData.category && 
                     formData.budget && formData.deadline;

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
  return (
    <div className="App">
      <BrowserRouter>
        <Navigation />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/post-task" element={<PostTaskPage />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;