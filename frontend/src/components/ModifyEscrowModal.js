import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const ModifyEscrowModal = ({ isOpen, onClose, task, onEscrowModified }) => {
  const [budget, setBudget] = useState('');
  const [deadline, setDeadline] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (task) {
      setBudget(task.budget || '');
      // Format deadline to YYYY-MM-DD for input type="date"
      let formattedDate = '';
      try {
        if (task.deadline) {
          const d = new Date(task.deadline);
          formattedDate = d.toISOString().split('T')[0];
        }
      } catch (e) { }
      setDeadline(formattedDate);
    }
  }, [task, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!task) return;
    setIsSubmitting(true);
    
    try {
      const token = localStorage.getItem('firebase_token');
      if (!token) throw new Error("Not authenticated");

      const modData = {
        budget: parseFloat(budget),
        deadline: deadline
      };

      const res = await axios.put(`${BACKEND_URL}/api/tasks/${task.id}/modify-escrow`, modData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      alert("Escrow terms modified successfully. (In a real app, this would trigger a smart contract update too)");
      onEscrowModified && onEscrowModified({ ...task, budget: modData.budget, deadline: modData.deadline });
      onClose();
    } catch (error) {
      console.error("Failed to modify escrow", error);
      alert("Error modifying escrow. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !task) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-teal-400">
            Modify Escrow Terms
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Increase budget or extend the timeline for the task.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label className="text-gray-300">New Budget (ETH)</Label>
            <Input
              type="number"
              step="0.001"
              required
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              min={task.budget}
              className="bg-gray-950 border-gray-700 text-white focus:border-teal-500"
            />
            <p className="text-xs text-gray-500">Current: {task.budget} ETH (Can only increase)</p>
          </div>
          <div className="space-y-2">
            <Label className="text-gray-300">New Deadline</Label>
            <Input
              type="date"
              required
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="bg-gray-950 border-gray-700 text-white focus:border-teal-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
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
              {isSubmitting ? 'Saving...' : 'Update Terms'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ModifyEscrowModal;
