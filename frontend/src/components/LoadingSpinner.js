import React from 'react';

const LoadingSpinner = ({ message = "Loading..." }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/80 backdrop-blur-sm">
      <div className="text-center">
        {/* Animated spinner */}
        <div className="relative mb-4">
          <div className="w-16 h-16 border-4 border-teal-200 border-t-teal-500 rounded-full animate-spin mx-auto"></div>
          <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-r-cyan-400 rounded-full animate-spin mx-auto" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
        </div>
        
        {/* Loading text */}
        <p className="text-white text-lg font-medium">{message}</p>
        
        {/* Animated dots */}
        <div className="flex justify-center space-x-1 mt-2">
          <div className="w-2 h-2 bg-teal-400 rounded-full animate-bounce"></div>
          <div className="w-2 h-2 bg-teal-400 rounded-full animate-bounce delay-100"></div>
          <div className="w-2 h-2 bg-teal-400 rounded-full animate-bounce delay-200"></div>
        </div>
      </div>
    </div>
  );
};

export default LoadingSpinner;