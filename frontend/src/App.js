import React, { useState, useEffect } from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, useNavigate, Link } from "react-router-dom";
import axios from "axios";
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
  ArrowLeft
} from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

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

// Navigation Component
const Navigation = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
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
            <Button size="sm" className="bg-teal-600 hover:bg-teal-700">
              Post Task
            </Button>
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
              <Button size="sm" className="bg-teal-600 hover:bg-teal-700 self-start">
                Post Task
              </Button>
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

const TaskCard = ({ task }) => {
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
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <span className="text-xl font-bold text-emerald-400">${task.budget}</span>
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
            <div className={`w-2 h-2 rounded-full ${task.escrowStatus === 'funded' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <span className="text-xs text-gray-400">
              Escrow {task.escrowStatus === 'funded' ? 'Funded' : 'Pending'}
            </span>
          </div>
          <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white">
            Apply Now
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const StatsCard = ({ icon: Icon, title, value, subtitle, color = "teal" }) => {
  return (
    <Card className="stats-card bg-gray-900/50 backdrop-blur-sm border-gray-800 hover:border-teal-500/50 transition-all duration-300">
      <CardContent className="p-6 text-center">
        <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full bg-${color}-500/20 mb-4`}>
          <Icon className={`w-6 h-6 text-${color}-400`} />
        </div>
        <div className={`text-3xl font-bold text-${color}-400 mb-1`}>
          {value}
        </div>
        <div className="text-white font-medium mb-1">{title}</div>
        <div className="text-sm text-gray-400">{subtitle}</div>
      </CardContent>
    </Card>
  );
};

const Hero = () => {
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
            <Button size="lg" className="bg-teal-600 hover:bg-teal-700 text-white px-8 py-4 text-lg hover:scale-105 transition-transform">
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
              value={<AnimatedCounter target={mockStats.totalTasks} />}
              subtitle="And growing"
              color="teal"
            />
            <StatsCard 
              icon={Zap}
              title="Active Tasks"
              value={<AnimatedCounter target={mockStats.activeTasks} />}
              subtitle="Right now"
              color="emerald"
            />
            <StatsCard 
              icon={DollarSign}
              title="Total Paid"
              value={<AnimatedCounter target={mockStats.totalEarnings} prefix="$" />}
              subtitle="To freelancers"
              color="amber"
            />
            <StatsCard 
              icon={CheckCircle}
              title="Success Rate"
              value={<AnimatedCounter target={mockStats.successfulTransactions} suffix="%" />}
              subtitle="Completed tasks"
              color="green"
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
      color: "cyan"
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
  return (
    <div className="min-h-screen bg-gray-950">
      <Hero />
      <Features />
    </div>
  );
};

// Tasks Page Component  
const TasksPage = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const navigate = useNavigate();
  
  const filteredTasks = mockTasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         task.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || task.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = ["all", ...new Set(mockTasks.map(task => task.category))];
  
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
              {categories.map(category => (
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
            Showing <span className="text-teal-400 font-semibold">{filteredTasks.length}</span> tasks
            {selectedCategory !== "all" && (
              <span> in <span className="text-teal-400 font-semibold">{selectedCategory}</span></span>
            )}
            {searchTerm && (
              <span> matching "<span className="text-teal-400 font-semibold">{searchTerm}</span>"</span>
            )}
          </p>
        </div>
        
        {/* Task Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
        
        {filteredTasks.length === 0 && (
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

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Navigation />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/tasks" element={<TasksPage />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;