import React, { useState } from 'react';
import axios from 'axios';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Briefcase, DollarSign, MessageSquare, CheckCircle } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const BidModal = ({ project, open, onClose, onSuccess }) => {
  const [selectedRole, setSelectedRole] = useState('');
  const [proposedAmount, setProposedAmount] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const openRoles = (project?.roles || []).filter(r => r.status === 'open');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!selectedRole) {
      setError('Please select a role to bid on.');
      return;
    }
    if (!proposedAmount || parseFloat(proposedAmount) <= 0) {
      setError('Please enter a valid bid amount.');
      return;
    }
    if (!message.trim()) {
      setError('Please write a cover message.');
      return;
    }

    setIsSubmitting(true);
    try {
      const firebaseToken = localStorage.getItem('firebase_token');
      await axios.post(`${API}/bids`, {
        project_id: project.id,
        role_name: selectedRole,
        proposed_amount: parseFloat(proposedAmount),
        message: message.trim(),
      }, {
        headers: { 'Authorization': `Bearer ${firebaseToken}` }
      });

      onSuccess && onSuccess();
      handleClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to place bid. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedRole('');
    setProposedAmount('');
    setMessage('');
    setError('');
    onClose();
  };

  const selectedRoleData = openRoles.find(r => r.role_name === selectedRole);

  if (!project) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl text-white">Place a Bid</DialogTitle>
              <DialogDescription className="text-gray-400">
                {project.title}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 mt-2">
          {/* Role Selection */}
          <div className="space-y-2">
            <Label className="text-white font-medium">Select Role *</Label>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger className="bg-gray-800/50 border-gray-600 text-white">
                <SelectValue placeholder="Choose a role to bid on..." />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-700 text-white">
                {openRoles.map((role, i) => (
                  <SelectItem key={i} value={role.role_name}>
                    <div className="flex items-center gap-2">
                      <Briefcase className="w-3 h-3 text-violet-400" />
                      <span>{role.role_name}</span>
                      <span className="text-teal-400 ml-auto">Ξ{role.budget_allocation}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Role details */}
            {selectedRoleData && (
              <div className="p-3 bg-gray-800/40 border border-gray-700 rounded-lg space-y-2">
                <p className="text-sm text-gray-300">{selectedRoleData.description}</p>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs text-emerald-400">Budget: Ξ{selectedRoleData.budget_allocation}</span>
                  {selectedRoleData.skills?.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {selectedRoleData.skills.map((skill, i) => (
                        <Badge key={i} className="bg-teal-500/10 text-teal-300 text-xs border-teal-500/20">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Proposed Amount */}
          <div className="space-y-2">
            <Label className="text-white font-medium">Your Bid Amount (ETH) *</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400 font-bold">Ξ</span>
              <Input
                type="number"
                value={proposedAmount}
                onChange={(e) => setProposedAmount(e.target.value)}
                placeholder="0.05"
                step="0.001"
                min="0"
                className="pl-8 bg-gray-800/50 border-gray-600 text-white placeholder-gray-500 focus:border-teal-500"
              />
            </div>
            {selectedRoleData && (
              <p className="text-xs text-gray-500">
                Role budget is Ξ{selectedRoleData.budget_allocation} — bid higher or lower as you see fit
              </p>
            )}
          </div>

          {/* Cover Message */}
          <div className="space-y-2">
            <Label className="text-white font-medium">
              <MessageSquare className="w-4 h-4 inline mr-2 text-teal-400" />
              Cover Message *
            </Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Introduce yourself, explain your experience with this type of work, and why you're a great fit for this role..."
              rows={4}
              className="bg-gray-800/50 border-gray-600 text-white placeholder-gray-500 focus:border-teal-500 resize-none"
            />
            <p className="text-xs text-gray-500">{message.length}/500 characters</p>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !selectedRole || !proposedAmount || !message.trim()}
              className="flex-1 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white disabled:bg-gray-700 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Submitting...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Submit Bid
                </div>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default BidModal;
