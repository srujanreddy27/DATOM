import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const SubmitBidModal = ({ isOpen, onClose, task, currentUser, existingBid, onBidUpdate }) => {
  const [amount, setAmount] = useState('');
  const [timelineDays, setTimelineDays] = useState('');
  const [proposalText, setProposalText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (existingBid) {
      setAmount(existingBid.amount || '');
      setTimelineDays(existingBid.timeline_days || '');
      setProposalText(existingBid.proposal_text || '');
    } else {
      setAmount('');
      setTimelineDays('');
      setProposalText('');
    }
  }, [existingBid, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const token = localStorage.getItem('firebase_token');
      if (!token) throw new Error("Not authenticated");

      const bidData = {
        amount: parseFloat(amount),
        timeline_days: parseInt(timelineDays),
        proposal_text: proposalText
      };

      if (existingBid) {
        // Edit Bid
        const res = await axios.put(`${BACKEND_URL}/api/bids/${existingBid.id}`, bidData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        onBidUpdate && onBidUpdate({ ...existingBid, ...bidData });
      } else {
        // Create Bid
        const res = await axios.post(`${BACKEND_URL}/api/tasks/${task.id}/bids`, bidData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        onBidUpdate && onBidUpdate(res.data);
      }
      
      onClose();
    } catch (error) {
      console.error("Failed to submit bid", error);
      alert("Error submitting bid. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    if (!existingBid) return;
    if (!window.confirm("Are you sure you want to withdraw this bid?")) return;
    
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('firebase_token');
      await axios.delete(`${BACKEND_URL}/api/bids/${existingBid.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      onBidUpdate && onBidUpdate(null);
      onClose();
    } catch (error) {
      console.error("Failed to withdraw bid", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !task) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-teal-400">
            {existingBid ? 'Edit Your Bid' : 'Place a Bid'}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Submit your proposal for: <span className="text-white font-medium">{task.title}</span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-gray-300">Bid Amount (ETH)</Label>
              <Input
                type="number"
                step="0.001"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 0.5"
                className="bg-gray-950 border-gray-700 text-white focus:border-teal-500"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">Timeline (Days)</Label>
              <Input
                type="number"
                required
                min="1"
                value={timelineDays}
                onChange={(e) => setTimelineDays(e.target.value)}
                placeholder="e.g. 7"
                className="bg-gray-950 border-gray-700 text-white focus:border-teal-500"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-gray-300">Cover Letter / Proposal</Label>
            <Textarea
              required
              rows={4}
              value={proposalText}
              onChange={(e) => setProposalText(e.target.value)}
              placeholder="Explain why you are the best fit for this task..."
              className="bg-gray-950 border-gray-700 text-white focus:border-teal-500"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-800">
            {existingBid && (
              <Button
                type="button"
                variant="outline"
                onClick={handleWithdraw}
                disabled={isSubmitting}
                className="border-red-500/50 text-red-400 hover:bg-red-500 hover:text-white"
              >
                Withdraw Bid
              </Button>
            )}
            <div className="flex-1"></div>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="border-gray-700 text-gray-400 hover:text-white hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              {isSubmitting ? 'Saving...' : existingBid ? 'Update Bid' : 'Submit Bid'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default SubmitBidModal;
