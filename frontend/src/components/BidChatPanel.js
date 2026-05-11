import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Avatar, AvatarFallback } from './ui/avatar';
import {
  X, Send, CheckCircle, XCircle, ArrowLeftRight, Clock, User,
  ThumbsUp, ThumbsDown, Handshake
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const statusInfo = {
  pending:             { label: 'Pending Review',         color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  accepted:            { label: 'Accepted ✓',             color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  rejected:            { label: 'Rejected',               color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  countered:           { label: 'Counter Offered',        color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  withdrawn:           { label: 'Withdrawn',              color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  awaiting_freelancer: { label: '⏳ Awaiting Your Confirmation', color: 'bg-violet-500/20 text-violet-300 border-violet-500/30' },
  paid:                { label: 'Paid 💸',                color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
};

const BidChatPanel = ({ bid: initialBid, isOpen, onClose, currentUser, isClientView, onBidStatusChange }) => {
  const [bid, setBid] = useState(initialBid);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setSending] = useState(false);
  const [showCounter, setShowCounter] = useState(false);
  const [counterAmount, setCounterAmount] = useState('');
  const [counterMessage, setCounterMessage] = useState('');
  const [isActioning, setActioning] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);
  const pollingRef = useRef(null);

  const getAuthHeader = () => ({
    headers: { 'Authorization': `Bearer ${localStorage.getItem('firebase_token')}` }
  });

  const fetchBid = async () => {
    if (!bid?.id) return;
    try {
      const res = await axios.get(`${API}/bids/${bid.id}`, getAuthHeader());
      setBid(res.data);
      onBidStatusChange && onBidStatusChange(res.data.id, res.data.status);
    } catch { /* silent */ }
  };

  const fetchMessages = async () => {
    if (!bid?.id) return;
    try {
      const res = await axios.get(`${API}/bids/${bid.id}/messages`, getAuthHeader());
      setMessages(res.data || []);
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  };

  useEffect(() => {
    if (isOpen && bid?.id) {
      fetchMessages();
      fetchBid();
      pollingRef.current = setInterval(() => { fetchMessages(); fetchBid(); }, 3000);
    }
    return () => clearInterval(pollingRef.current);
  }, [isOpen, bid?.id]);

  useEffect(() => { setBid(initialBid); }, [initialBid]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || isSending) return;
    setSending(true);
    try {
      await axios.post(`${API}/bids/${bid.id}/messages`, { message: newMessage.trim() }, getAuthHeader());
      setNewMessage('');
      await fetchMessages();
    } catch (err) {
      setError('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleAccept = async () => {
    setActioning(true); setError('');
    try {
      const res = await axios.put(`${API}/bids/${bid.id}/accept`, {}, getAuthHeader());
      setBid(prev => ({ ...prev, status: 'awaiting_freelancer', final_amount: res.data.final_amount }));
      onBidStatusChange && onBidStatusChange(bid.id, 'awaiting_freelancer');
      await fetchMessages();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to accept bid');
    } finally {
      setActioning(false);
    }
  };

  const handleReject = async () => {
    setActioning(true); setError('');
    try {
      await axios.put(`${API}/bids/${bid.id}/reject`, {}, getAuthHeader());
      onBidStatusChange && onBidStatusChange(bid.id, 'rejected');
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to reject bid');
    } finally {
      setActioning(false);
    }
  };

  const handleCounter = async (e) => {
    e.preventDefault();
    if (!counterAmount || parseFloat(counterAmount) <= 0) {
      setError('Enter a valid counter amount'); return;
    }
    setActioning(true); setError('');
    try {
      await axios.put(`${API}/bids/${bid.id}/counter`, {
        counter_amount: parseFloat(counterAmount),
        counter_message: counterMessage,
      }, getAuthHeader());
      setShowCounter(false); setCounterAmount(''); setCounterMessage('');
      setBid(prev => ({ ...prev, status: 'countered', counter_amount: parseFloat(counterAmount) }));
      onBidStatusChange && onBidStatusChange(bid.id, 'countered');
      await fetchMessages();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to send counter offer');
    } finally {
      setActioning(false);
    }
  };

  const handleWithdraw = async () => {
    setActioning(true); setError('');
    try {
      await axios.put(`${API}/bids/${bid.id}/withdraw`, {}, getAuthHeader());
      onBidStatusChange && onBidStatusChange(bid.id, 'withdrawn');
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to withdraw bid');
    } finally {
      setActioning(false);
    }
  };

  // ── Freelancer 2-way handshake ──
  const handleFreelancerConfirm = async () => {
    setActioning(true); setError('');
    try {
      await axios.put(`${API}/bids/${bid.id}/confirm`, {}, getAuthHeader());
      setBid(prev => ({ ...prev, status: 'accepted' }));
      onBidStatusChange && onBidStatusChange(bid.id, 'accepted');
      await fetchMessages();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to confirm offer');
    } finally {
      setActioning(false);
    }
  };

  const handleFreelancerDecline = async () => {
    setActioning(true); setError('');
    try {
      await axios.put(`${API}/bids/${bid.id}/decline`, {}, getAuthHeader());
      setBid(prev => ({ ...prev, status: 'pending', final_amount: null }));
      onBidStatusChange && onBidStatusChange(bid.id, 'pending');
      await fetchMessages();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to decline offer');
    } finally {
      setActioning(false);
    }
  };

  if (!bid || !isOpen) return null;

  const currentStatus = bid.status;
  const canClientAct = isClientView && ['pending', 'countered'].includes(currentStatus);
  const canWithdraw = !isClientView && ['pending', 'countered'].includes(currentStatus);
  const freelancerMustConfirm = !isClientView && currentStatus === 'awaiting_freelancer';
  const finalAmount = bid.final_amount || bid.counter_amount || bid.proposed_amount;
  const si = statusInfo[currentStatus] || statusInfo.pending;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 w-full sm:w-[480px] h-full sm:h-[90vh] sm:max-h-[720px] sm:mr-4 sm:my-4 bg-gray-950 border border-gray-700 sm:rounded-2xl flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <Avatar className="w-9 h-9">
              <AvatarFallback className="bg-gradient-to-br from-teal-500 to-cyan-600 text-white text-sm">
                {bid.freelancer_name?.[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-white font-medium text-sm">{bid.freelancer_name}</p>
              <p className="text-gray-500 text-xs">{bid.role_name} · {bid.project_title}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={`text-xs ${si.color}`}>{si.label}</Badge>
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Bid Info Bar */}
        <div className="px-4 py-3 bg-gray-900/50 border-b border-gray-800 flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1 text-emerald-400">
            <span className="text-gray-400 text-xs">Bid:</span>
            <span className="font-bold">Ξ{bid.proposed_amount}</span>
          </div>
          {bid.counter_amount && (
            <div className="flex items-center gap-1 text-blue-400">
              <ArrowLeftRight className="w-3 h-3" />
              <span className="text-gray-400 text-xs">Counter:</span>
              <span className="font-bold">Ξ{bid.counter_amount}</span>
            </div>
          )}
          {bid.final_amount && (
            <div className="flex items-center gap-1 text-violet-300">
              <Handshake className="w-3 h-3" />
              <span className="text-gray-400 text-xs">Agreed:</span>
              <span className="font-bold">Ξ{bid.final_amount}</span>
            </div>
          )}
          <div className="flex items-center gap-1 text-gray-500 text-xs ml-auto">
            <Clock className="w-3 h-3" />
            {new Date(bid.created_at).toLocaleDateString()}
          </div>
        </div>

        {/* Cover message */}
        <div className="px-4 py-3 bg-gray-900/30 border-b border-gray-800">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Cover Message</p>
          <p className="text-gray-300 text-sm leading-relaxed">{bid.message}</p>
        </div>

        {/* ── 2-way Handshake Banner (Freelancer only) ── */}
        {freelancerMustConfirm && (
          <div className="px-4 py-4 bg-violet-500/10 border-b border-violet-500/30">
            <div className="flex items-start gap-3">
              <Handshake className="w-5 h-5 text-violet-400 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-violet-300 font-semibold text-sm">Client has approved your bid!</p>
                <p className="text-violet-400/80 text-xs mt-0.5">
                  Agreed amount: <span className="font-bold text-emerald-400">Ξ{finalAmount}</span>
                </p>
                <p className="text-gray-400 text-xs mt-1">
                  Please confirm to lock in the deal, or decline to return to negotiation.
                </p>
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    onClick={handleFreelancerConfirm}
                    disabled={isActioning}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  >
                    <ThumbsUp className="w-3 h-3 mr-1.5" />
                    {isActioning ? 'Confirming…' : 'Confirm & Accept'}
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleFreelancerDecline}
                    disabled={isActioning}
                    variant="outline"
                    className="flex-1 border-red-500/50 text-red-400 hover:bg-red-500/10"
                  >
                    <ThumbsDown className="w-3 h-3 mr-1.5" />
                    Decline
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Awaiting freelancer — client view */}
        {isClientView && currentStatus === 'awaiting_freelancer' && (
          <div className="px-4 py-3 bg-violet-500/10 border-b border-violet-500/30">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-violet-400" />
              <p className="text-violet-300 text-sm">
                Waiting for <span className="font-semibold">{bid.freelancer_name}</span> to confirm the offer at{' '}
                <span className="text-emerald-400 font-bold">Ξ{finalAmount}</span>
              </p>
            </div>
          </div>
        )}

        {/* Messages area */}
        <ScrollArea className="flex-1 p-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center mb-3">
                <Send className="w-5 h-5 text-gray-600" />
              </div>
              <p className="text-gray-500 text-sm">No messages yet</p>
              <p className="text-gray-600 text-xs mt-1">Start negotiating the terms</p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg, i) => {
                const isMe = msg.sender_id === currentUser?.id;
                const isSystem = msg.message.startsWith('✅') || msg.message.startsWith('🤝') || msg.message.startsWith('↩️');
                if (isSystem) {
                  return (
                    <div key={i} className="flex justify-center">
                      <div className="bg-gray-800/60 border border-gray-700 px-4 py-2 rounded-full text-xs text-gray-400 text-center max-w-[90%]">
                        {msg.message}
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] ${isMe ? 'order-2' : 'order-1'}`}>
                      {!isMe && (
                        <p className="text-xs text-gray-500 ml-1 mb-1">{msg.sender_name}</p>
                      )}
                      <div className={`px-4 py-2.5 rounded-2xl ${
                        isMe
                          ? 'bg-gradient-to-br from-teal-600 to-cyan-700 text-white rounded-tr-sm'
                          : msg.message.startsWith('💬 Counter')
                            ? 'bg-blue-500/20 border border-blue-500/30 text-blue-200 rounded-tl-sm'
                            : 'bg-gray-800 text-gray-200 rounded-tl-sm'
                      }`}>
                        <p className="text-sm leading-relaxed">{msg.message}</p>
                      </div>
                      <p className="text-xs text-gray-600 mt-1 mx-1">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
          )}
        </ScrollArea>

        {/* Error */}
        {error && (
          <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/20">
            <p className="text-red-400 text-xs">{error}</p>
          </div>
        )}

        {/* Counter Offer Form */}
        {showCounter && (
          <form onSubmit={handleCounter} className="p-4 bg-gray-900 border-t border-gray-700 space-y-3">
            <p className="text-sm text-blue-400 font-medium">Send Counter Offer</p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400 text-sm font-bold">Ξ</span>
                <Input
                  type="number"
                  value={counterAmount}
                  onChange={e => setCounterAmount(e.target.value)}
                  placeholder="0.05"
                  step="0.001"
                  min="0"
                  className="pl-8 bg-gray-800 border-gray-600 text-white text-sm h-9"
                />
              </div>
              <Input
                value={counterMessage}
                onChange={e => setCounterMessage(e.target.value)}
                placeholder="Note (optional)"
                className="flex-[2] bg-gray-800 border-gray-600 text-white text-sm h-9"
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowCounter(false)} className="text-gray-400">
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isActioning} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
                {isActioning ? 'Sending...' : 'Send Counter'}
              </Button>
            </div>
          </form>
        )}

        {/* Client Actions */}
        {canClientAct && !showCounter && (
          <div className="p-3 border-t border-gray-700 grid grid-cols-3 gap-2">
            <Button
              size="sm"
              onClick={handleAccept}
              disabled={isActioning}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <CheckCircle className="w-3 h-3 mr-1" /> Approve
            </Button>
            <Button
              size="sm"
              onClick={() => setShowCounter(true)}
              disabled={isActioning}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <ArrowLeftRight className="w-3 h-3 mr-1" /> Counter
            </Button>
            <Button
              size="sm"
              onClick={handleReject}
              disabled={isActioning}
              variant="outline"
              className="border-red-500/50 text-red-400 hover:bg-red-500/10"
            >
              <XCircle className="w-3 h-3 mr-1" /> Reject
            </Button>
          </div>
        )}

        {/* Freelancer withdraw */}
        {canWithdraw && (
          <div className="p-3 border-t border-gray-700">
            <Button
              size="sm"
              variant="outline"
              onClick={handleWithdraw}
              disabled={isActioning}
              className="w-full border-gray-600 text-gray-400 hover:bg-gray-800"
            >
              Withdraw Bid
            </Button>
          </div>
        )}

        {/* Message input — disabled once deal is locked */}
        {!['accepted', 'rejected', 'withdrawn', 'paid'].includes(currentStatus) && (
          <form onSubmit={sendMessage} className="p-3 border-t border-gray-700 flex gap-2">
            <Input
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-gray-800 border-gray-600 text-white placeholder-gray-500 focus:border-teal-500 text-sm"
              disabled={isSending}
            />
            <Button
              type="submit"
              size="sm"
              disabled={isSending || !newMessage.trim()}
              className="bg-teal-600 hover:bg-teal-700 text-white px-4"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        )}

        {/* Locked state footer */}
        {['accepted', 'paid'].includes(currentStatus) && (
          <div className="p-3 border-t border-gray-700 text-center">
            <p className="text-xs text-gray-500">
              {currentStatus === 'paid' ? '💸 Payment released. Project complete.' : '🤝 Deal locked — work in progress.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BidChatPanel;
