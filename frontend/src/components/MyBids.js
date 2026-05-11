import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import BidChatPanel from './BidChatPanel';
import BidClaimModal from './BidClaimModal';
import {
  Briefcase, MessageSquare, Search, Clock, Wallet,
  CheckCircle, XCircle, AlertCircle, RotateCcw, DollarSign
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const statusInfo = {
  pending:             { label: 'Pending',              icon: Clock,        color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  accepted:            { label: 'Accepted ✓',           icon: CheckCircle,  color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  rejected:            { label: 'Rejected',             icon: XCircle,      color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  countered:           { label: 'Counter Offer',        icon: AlertCircle,  color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  withdrawn:           { label: 'Withdrawn',            icon: RotateCcw,    color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  awaiting_freelancer: { label: '⏳ Confirm Required',  icon: AlertCircle,  color: 'bg-violet-500/20 text-violet-300 border-violet-500/30' },
  paid:                { label: 'Paid 💸',              icon: DollarSign,   color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
};

const MyBids = ({ currentUser }) => {
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedBid, setSelectedBid] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [claimBid, setClaimBid] = useState(null);

  const getAuthHeader = () => ({
    headers: { 'Authorization': `Bearer ${localStorage.getItem('firebase_token')}` }
  });

  const fetchBids = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API}/bids/my-bids`, getAuthHeader());
      setBids(res.data || []);
    } catch (err) {
      setError('Failed to load your bids. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBids(); }, []);

  const handleOpenChat = (bid) => { setSelectedBid(bid); setChatOpen(true); };

  const handleBidStatusChange = (bidId, newStatus) => {
    setBids(prev => prev.map(b => b.id === bidId ? { ...b, status: newStatus } : b));
  };

  const handlePaymentClaimed = (bidId) => {
    setBids(prev => prev.map(b => b.id === bidId ? { ...b, status: 'paid' } : b));
    setClaimBid(null);
  };

  const filteredBids = bids.filter(bid => {
    const matchesSearch =
      bid.project_title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bid.role_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterStatus === 'all' || bid.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const stats = {
    total:    bids.length,
    pending:  bids.filter(b => b.status === 'pending').length,
    accepted: bids.filter(b => b.status === 'accepted').length,
    countered:bids.filter(b => b.status === 'countered').length,
    awaiting: bids.filter(b => b.status === 'awaiting_freelancer').length,
    paid:     bids.filter(b => b.status === 'paid').length,
  };

  const FILTERS = ['all', 'pending', 'awaiting_freelancer', 'accepted', 'countered', 'rejected', 'paid'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">My Bids</h2>
          <p className="text-gray-400 text-sm mt-1">Track your bids and claim payments once deals are confirmed</p>
        </div>
        <Button onClick={fetchBids} variant="outline" size="sm" className="border-gray-600 text-gray-300 hover:bg-gray-800">
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total',           value: stats.total,    color: 'text-white',      bg: 'bg-gray-800/50' },
          { label: 'Pending',         value: stats.pending,  color: 'text-amber-400',  bg: 'bg-amber-500/5 border-amber-500/20' },
          { label: 'Accepted',        value: stats.accepted, color: 'text-green-400',  bg: 'bg-green-500/5 border-green-500/20' },
          { label: 'Counter Offers',  value: stats.countered,color: 'text-blue-400',   bg: 'bg-blue-500/5 border-blue-500/20' },
          { label: '⏳ Confirm',      value: stats.awaiting, color: 'text-violet-300', bg: 'bg-violet-500/5 border-violet-500/20' },
          { label: 'Paid 💸',         value: stats.paid,     color: 'text-emerald-400',bg: 'bg-emerald-500/5 border-emerald-500/20' },
        ].map((s, i) => (
          <div key={i} className={`p-4 rounded-xl border border-gray-700 ${s.bg}`}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-gray-500 text-xs mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search bids..."
            className="pl-10 bg-gray-800/50 border-gray-600 text-white placeholder-gray-500 focus:border-teal-500"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {FILTERS.map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
                filterStatus === status
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/50'
                  : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-500'
              }`}
            >
              {status === 'awaiting_freelancer' ? '⏳ confirm' : status}
            </button>
          ))}
        </div>
      </div>

      {/* Bids list */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-12 h-12 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-gray-400">Loading your bids…</p>
        </div>
      ) : error ? (
        <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-xl text-center">
          <p className="text-red-400">{error}</p>
          <Button onClick={fetchBids} className="mt-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30" size="sm">
            Try Again
          </Button>
        </div>
      ) : filteredBids.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-20 h-20 bg-gray-800/60 rounded-full flex items-center justify-center mb-4">
            <Briefcase className="w-9 h-9 text-gray-600" />
          </div>
          <p className="text-gray-300 font-medium">
            {bids.length === 0 ? 'No bids yet' : 'No bids match your filters'}
          </p>
          <p className="text-gray-500 text-sm mt-2">
            {bids.length === 0 ? 'Browse projects and place your first bid!' : 'Try clearing the filters'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredBids.map(bid => {
            const si = statusInfo[bid.status] || statusInfo.pending;
            const StatusIcon = si.icon;
            const claimableAmount = bid.final_amount || bid.agreed_amount || bid.counter_amount || bid.proposed_amount;
            const canClaim = bid.status === 'accepted';
            const isPaid   = bid.status === 'paid';

            return (
              <Card key={bid.id} className={`bg-gray-900/60 backdrop-blur-sm border-gray-700 hover:border-gray-600 transition-all ${
                canClaim ? 'border-green-500/30 bg-green-500/5' : ''
              } ${isPaid ? 'opacity-70' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    {/* Left */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="text-white font-medium truncate">{bid.project_title || 'Project'}</h3>
                        <Badge className={`text-xs shrink-0 ${si.color}`}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {si.label}
                        </Badge>
                      </div>

                      <p className="text-gray-400 text-sm">
                        Role: <span className="text-violet-300">{bid.role_name}</span>
                      </p>

                      {/* Amounts */}
                      <div className="flex items-center gap-4 mt-2 flex-wrap">
                        <div className="text-sm">
                          <span className="text-gray-500">Your bid: </span>
                          <span className="text-emerald-400 font-bold">Ξ{bid.proposed_amount}</span>
                        </div>
                        {bid.counter_amount && (
                          <div className="text-sm">
                            <span className="text-blue-400">Counter: </span>
                            <span className="text-blue-300 font-bold">Ξ{bid.counter_amount}</span>
                          </div>
                        )}
                        {bid.final_amount && (
                          <div className="text-sm">
                            <span className="text-green-400">Agreed: </span>
                            <span className="text-green-300 font-bold">Ξ{bid.final_amount}</span>
                          </div>
                        )}
                        {isPaid && bid.paid_to_wallet && (
                          <div className="text-xs text-emerald-400 font-mono truncate max-w-[160px]">
                            ✓ Paid to {bid.paid_to_wallet.slice(0, 10)}…
                          </div>
                        )}
                      </div>

                      {/* Claim nudge */}
                      {canClaim && (
                        <div className="mt-2 p-2 bg-green-500/10 border border-green-500/20 rounded-lg">
                          <p className="text-green-400 text-xs font-medium">
                            🎉 Deal confirmed! You can now claim Ξ{claimableAmount} ETH to your wallet.
                          </p>
                        </div>
                      )}

                      {bid.counter_message && (
                        <div className="mt-2 p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                          <p className="text-blue-300 text-xs">Client's note: {bid.counter_message}</p>
                        </div>
                      )}

                      <p className="text-gray-600 text-xs mt-2">
                        Submitted {new Date(bid.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    {/* Right — action buttons */}
                    <div className="flex flex-col gap-2 items-end shrink-0">
                      {/* Claim button — only for accepted bids */}
                      {canClaim && (
                        <Button
                          size="sm"
                          onClick={() => setClaimBid(bid)}
                          className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs gap-1"
                        >
                          <Wallet className="w-3 h-3" />
                          Claim Payment
                        </Button>
                      )}

                      {/* Chat button — not for paid/withdrawn/rejected */}
                      {!['paid', 'withdrawn', 'rejected'].includes(bid.status) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenChat(bid)}
                          className="border-gray-600 text-gray-300 hover:bg-gray-800 text-xs gap-1"
                        >
                          <MessageSquare className="w-3 h-3" />
                          Chat
                        </Button>
                      )}

                      {isPaid && (
                        <span className="text-xs text-emerald-400 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Paid
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Chat Panel */}
      {selectedBid && (
        <BidChatPanel
          bid={selectedBid}
          isOpen={chatOpen}
          onClose={() => { setChatOpen(false); setSelectedBid(null); }}
          currentUser={currentUser}
          isClientView={false}
          onBidStatusChange={handleBidStatusChange}
        />
      )}

      {/* Claim Payment Modal */}
      {claimBid && (
        <BidClaimModal
          isOpen={!!claimBid}
          onClose={() => setClaimBid(null)}
          bid={claimBid}
          onPaymentClaimed={handlePaymentClaimed}
        />
      )}
    </div>
  );
};

export default MyBids;
