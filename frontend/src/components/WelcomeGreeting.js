import React, { useState, useEffect } from 'react';

const WelcomeGreeting = ({ user, onComplete }) => {
  const [visible, setVisible] = useState(true);
  const [stage, setStage] = useState('entering'); // entering, greeting, leaving

  useEffect(() => {
    const timer1 = setTimeout(() => setStage('greeting'), 500);
    const timer2 = setTimeout(() => setStage('leaving'), 3000);
    const timer3 = setTimeout(() => {
      setVisible(false);
      onComplete && onComplete();
    }, 3500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [onComplete]);

  if (!visible) return null;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-500 ${
      stage === 'entering' ? 'opacity-0 scale-95' : 
      stage === 'leaving' ? 'opacity-0 scale-105' : 'opacity-100 scale-100'
    }`}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900/95 via-gray-800/95 to-gray-900/95 backdrop-blur-sm" />
      
      {/* Content */}
      <div className={`relative z-10 text-center transform transition-all duration-700 ${
        stage === 'greeting' ? 'translate-y-0' : 'translate-y-8'
      }`}>
        {/* Animated circles */}
        <div className="absolute -top-20 -left-20 w-40 h-40 bg-teal-500/20 rounded-full animate-pulse" />
        <div className="absolute -bottom-16 -right-16 w-32 h-32 bg-cyan-500/20 rounded-full animate-pulse delay-300" />
        
        {/* Main greeting */}
        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-12 border border-white/20 shadow-2xl">
          <div className="mb-6">
            {/* Cute emoji animation */}
            <div className={`text-6xl mb-4 transform transition-all duration-1000 ${
              stage === 'greeting' ? 'rotate-0 scale-100' : 'rotate-12 scale-110'
            }`}>
              👋
            </div>
            
            {/* Greeting text */}
            <h1 className="text-4xl font-bold text-white mb-2">
              {getGreeting()}!
            </h1>
            <p className="text-xl text-teal-300 mb-4">
              Welcome back, <span className="font-semibold">{user?.username || 'there'}</span>
            </p>
          </div>
          
          {/* Animated dots */}
          <div className="flex justify-center space-x-2">
            <div className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" />
            <div className="w-2 h-2 bg-teal-400 rounded-full animate-bounce delay-100" />
            <div className="w-2 h-2 bg-teal-400 rounded-full animate-bounce delay-200" />
          </div>
          
          {/* User type badge */}
          {user?.user_type && (
            <div className="mt-6">
              <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${
                user.user_type === 'client' 
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' 
                  : 'bg-green-500/20 text-green-300 border border-green-500/30'
              }`}>
                {user.user_type === 'client' ? '👔 Client' : '💼 Freelancer'}
              </span>
            </div>
          )}
        </div>
        
        {/* Floating particles */}
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className={`absolute w-1 h-1 bg-teal-400 rounded-full animate-ping`}
              style={{
                left: `${20 + i * 15}%`,
                top: `${30 + (i % 2) * 40}%`,
                animationDelay: `${i * 200}ms`,
                animationDuration: '2s'
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default WelcomeGreeting;