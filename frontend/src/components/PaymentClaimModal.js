import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { DollarSign, Wallet, CheckCircle, AlertCircle } from 'lucide-react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const PaymentClaimModal = ({ isOpen, onClose, submission, task, onPaymentClaimed }) => {
  const [walletAddress, setWalletAddress] = useState('');
  const [isClaiming, setIsClaiming] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [claimResult, setClaimResult] = useState(null);

  const validateWalletAddress = (address) => {
    // Basic Ethereum address validation
    const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
    return ethAddressRegex.test(address);
  };

  const handleClaim = async (e) => {
    e.preventDefault();

    if (!walletAddress.trim()) {
      setError('Please enter your wallet address');
      return;
    }

    if (!validateWalletAddress(walletAddress)) {
      setError('Please enter a valid Ethereum wallet address (0x...)');
      return;
    }

    setIsClaiming(true);
    setError('');

    try {
      const token = localStorage.getItem('firebase_token');
      if (!token) {
        setError('Please log in to claim payment');
        return;
      }

      const formData = new FormData();
      formData.append('submission_id', submission.id);
      formData.append('wallet_address', walletAddress.trim());

      const response = await axios.post(`${BACKEND_URL}/api/payments/claim`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      setClaimResult(response.data);
      setSuccess(true);

      // Notify parent component
      if (onPaymentClaimed) {
        onPaymentClaimed(submission.id);
      }

    } catch (error) {
      console.error('Error claiming payment:', error);
      if (error.response?.data?.detail) {
        setError(error.response.data.detail);
      } else {
        setError('Failed to claim payment. Please try again.');
      }
    } finally {
      setIsClaiming(false);
    }
  };

  const handleClose = () => {
    if (!isClaiming) {
      setWalletAddress('');
      setError('');
      setSuccess(false);
      setClaimResult(null);
      onClose();
    }
  };

  if (!submission || !task) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-teal-400 flex items-center">
            <Wallet className="w-5 h-5 mr-2" />
            Claim Payment
          </DialogTitle>
          <DialogDescription className="text-gray-300">
            Claim your payment for the approved submission
          </DialogDescription>
        </DialogHeader>

        {success && claimResult ? (
          <div className="space-y-4 mt-4">
            <div className="bg-green-900/20 border border-green-700 rounded-lg p-4 text-center">
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-green-400 mb-2">Payment Claimed Successfully!</h3>
              <p className="text-gray-300 text-sm mb-4">
                Your payment has been processed and sent to your wallet.
              </p>

              <div className="space-y-2 text-left bg-gray-800/50 p-3 rounded">
                <div className="flex justify-between">
                  <span className="text-gray-400">Amount:</span>
                  <span className="text-white font-semibold">{claimResult.amount} ETH</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">To Wallet:</span>
                  <span className="text-white text-xs font-mono">{claimResult.wallet_address}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Transaction:</span>
                  <a 
                    href={`https://etherscan.io/tx/${claimResult.transaction_hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 text-xs font-mono hover:text-blue-300"
                  >
                    {claimResult.transaction_hash}
                  </a>
                </div>
                {claimResult.block_number && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Block:</span>
                    <span className="text-gray-300 text-xs">#{claimResult.block_number}</span>
                  </div>
                )}
                {claimResult.gas_used && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Gas Used:</span>
                    <span className="text-gray-300 text-xs">{claimResult.gas_used.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>

            <Button
              onClick={handleClose}
              className="w-full bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white"
            >
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={handleClaim} className="space-y-4 mt-4">
            {/* Task and Payment Info */}
            <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
              <h3 className="font-semibold text-white mb-2">{task.title}</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Payment Amount:</span>
                  <div className="flex items-center space-x-1">
                    <DollarSign className="w-4 h-4 text-teal-400" />
                    <span className="text-xl font-bold text-teal-400">
                      {submission.payment_amount ? `${submission.payment_amount.toFixed(4)} ETH` : `${task.budget} ETH`}
                    </span>
                  </div>
                </div>
                {submission.payment_amount && submission.payment_amount < task.budget && (
                  <div className="text-xs text-gray-400">
                    Partial payment based on {submission.approved_files_count} approved files
                  </div>
                )}
              </div>
            </div>

            {/* Wallet Address Input */}
            <div className="space-y-2">
              <Label htmlFor="wallet" className="text-white flex items-center">
                <Wallet className="w-4 h-4 mr-2" />
                Your Wallet Address *
              </Label>
              <Input
                id="wallet"
                type="text"
                placeholder="0x1234567890abcdef1234567890abcdef12345678"
                value={walletAddress}
                onChange={(e) => {
                  setWalletAddress(e.target.value);
                  setError('');
                }}
                className="bg-gray-800 border-gray-600 text-white placeholder-gray-400 font-mono text-sm"
                disabled={isClaiming}
              />
              <p className="text-xs text-gray-400">
                Enter your Ethereum wallet address to receive the payment
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-900/50 border border-red-700 rounded-lg p-3 flex items-center">
                <AlertCircle className="w-4 h-4 text-red-400 mr-2 flex-shrink-0" />
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-700">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isClaiming}
                className="border-gray-600 text-gray-300 hover:bg-gray-800"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isClaiming || !walletAddress.trim()}
                className="bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white"
              >
                {isClaiming ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Processing...
                  </div>
                ) : (
                  <>
                    <DollarSign className="w-4 h-4 mr-2" />
                    Claim {submission.payment_amount ? `${submission.payment_amount.toFixed(4)} ETH` : `${task.budget} ETH`}
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PaymentClaimModal;