import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Star, Clock, User, MessageCircle } from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const BidComparisonView = ({ taskId, onAcceptBid }) => {
  const [bids, setBids] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchBids = async () => {
      try {
        const token = localStorage.getItem('firebase_token');
        if (!token) return;

        const response = await axios.get(`${BACKEND_URL}/api/tasks/${taskId}/bids`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        // Sort bids by amount (lowest first) as a reasonable default
        const sortedBids = response.data.sort((a, b) => a.amount - b.amount);
        setBids(sortedBids);
      } catch (error) {
        console.error('Failed to fetch bids:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (taskId) {
      fetchBids();
    }
  }, [taskId]);

  if (isLoading) {
    return <div className="text-gray-400 py-4 text-center">Loading bids...</div>;
  }

  if (bids.length === 0) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="py-8 text-center text-gray-400">
          No bids received yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold text-white mb-4">Compare Bids ({bids.length})</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {bids.map((bid) => (
          <Card key={bid.id} className="bg-gray-800/50 border-gray-700 hover:border-teal-500/50 transition-all duration-200">
            <CardHeader className="pb-3 border-b border-gray-700/50">
              <div className="flex justify-between items-start">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-full bg-teal-500/20 flex items-center justify-center">
                    <User className="w-4 h-4 text-teal-400" />
                  </div>
                  <div>
                    <CardTitle className="text-white text-md">{bid.freelancer_name}</CardTitle>
                    <div className="flex items-center text-xs text-gray-400 mt-1">
                      <Star className="w-3 h-3 text-yellow-400 mr-1 fill-current" />
                      4.9 {/* Mock rating since we need a GET /users endpoint for realtime, but hardcoded for UI */}
                    </div>
                  </div>
                </div>
                <Badge variant={bid.status === 'accepted' ? 'success' : 'outline'} className={bid.status === 'accepted' ? 'bg-green-500/20 text-green-400' : 'border-gray-600 text-gray-300 capitalize'}>
                  {bid.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-gray-950 p-2 rounded border border-gray-800">
                  <div className="text-gray-500 text-xs mb-1">Bid Amount</div>
                  <div className="text-teal-400 font-semibold">{bid.amount} ETH</div>
                </div>
                <div className="bg-gray-950 p-2 rounded border border-gray-800">
                  <div className="text-gray-500 text-xs mb-1">Timeline</div>
                  <div className="text-gray-300 flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    {bid.timeline_days} days
                  </div>
                </div>
              </div>
              
              <div>
                <div className="text-gray-500 text-xs mb-1">Proposal</div>
                <p className="text-gray-300 text-sm line-clamp-3 bg-gray-900/50 p-3 rounded-md border border-gray-800">
                  {bid.proposal_text}
                </p>
              </div>

              <div className="pt-2 flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1 border-gray-600 text-gray-300 hover:text-white hover:bg-gray-700"
                  onClick={() => navigate(`/messages?task=${taskId}&freelancer=${bid.freelancer_id}&name=${encodeURIComponent(bid.freelancer_name)}`)}
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Chat
                </Button>
                {bid.status !== 'accepted' && (
                  <Button 
                    className="flex-1 bg-teal-600 hover:bg-teal-700 text-white"
                    onClick={() => onAcceptBid && onAcceptBid(bid)}
                  >
                    Accept Bid
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default BidComparisonView;
