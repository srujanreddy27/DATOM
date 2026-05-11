import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Wallet, CheckCircle, AlertCircle, DollarSign, Layers } from 'lucide-react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const BidClaimModal = ({ isOpen, onClose, bid, onPaymentClaimed }) => {
  const [walletAddress, setWalletAddress] = useState('');
  const [isClaiming, setIsClaiming] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [claimResult, setClaimResult] = useState(null);

  const validateWallet = (addr) => /^0x[a-fA-F0-9]{40}$/.test(addr);

  const getAuthHeader = () => ({
    'Authorization': `Bearer ${localStorage.getItem('firebase_token')}`,
  });

  const handleClaim = async (e) => {
    e.preventDefault();
    setError('');

    if (!walletAddress.trim()) {
      setError('Please enter your wallet address');
      return;
    }
    if (!validateWallet(walletAddress)) {
      setError('Please enter a valid Ethereum wallet address (0x followed by 40 hex characters)');
      return;
    }

    setIsClaiming(true);
    try {
      const formData = new FormData();
      formData.append('wallet_address', walletAddress.trim());

      const res = await axios.post(
        `${API}/bids/${bid.id}/claim-payment`,
        formData,
        {
          headers: {
            ...getAuthHeader(),
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      setClaimResult(res.data);
      setSuccess(true);
      onPaymentClaimed && onPaymentClaimed(bid.id, res.data.amount);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to claim payment. Please try again.');
    } finally {
      setIsClaiming(false);
    }
  };

  const handleClose = () => {
    if (isClaiming) return;
    setWalletAddress('');
    setError('');
    setSuccess(false);
    setClaimResult(null);
    onClose();
  };

  if (!bid) return null;

  const claimableAmount = (
    bid.final_amount
    || bid.agreed_amount
    || bid.counter_amount
    || bid.proposed_amount
    || 0
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-teal-400 flex items-center">
            <Wallet className="w-5 h-5 mr-2" />
            Claim Project Payment
          </DialogTitle>
          <DialogDescription className="text-gray-300">
            Claim your ETH earnings for the completed project role
          </DialogDescription>
        </DialogHeader>

        {success && claimResult ? (
          /* ── Success Screen ── */
          <div className="space-y-4 mt-4">
            <div className="bg-green-900/20 border border-green-700 rounded-lg p-4 text-center">
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-green-400 mb-2">Payment Sent!</h3>
              <p className="text-gray-300 text-sm mb-4">
                Your earnings have been transferred directly to your wallet.
              </p>

              <div className="space-y-2 text-left bg-gray-800/50 p-3 rounded">
                <div className="flex justify-between">
                  <span className="text-gray-400">Project:</span>
                  <span className="text-white text-sm">{bid.project_title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Role:</span>
                  <span className="text-violet-300 text-sm">{bid.role_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Amount:</span>
                  <span className="text-emerald-400 font-bold">Ξ{claimResult.amount} ETH</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">To Wallet:</span>
                  <span className="text-white text-xs font-mono">{claimResult.wallet_address}</span>
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-gray-400 shrink-0">Tx Hash:</span>
                  <a
                    href={`https://etherscan.io/tx/${claimResult.transaction_hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 text-xs font-mono hover:text-blue-300 ml-2 break-all text-right"
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
          /* ── Claim Form ── */
          <form onSubmit={handleClaim} className="space-y-4 mt-4">
            {/* Bid / Payment Summary */}
            <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
              <div className="flex items-center gap-2 mb-3">
                <Layers className="w-4 h-4 text-violet-400" />
                <h3 className="font-semibold text-white">{bid.project_title}</h3>
              </div>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Role:</span>
                  <span className="text-violet-300">{bid.role_name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Claimable Amount:</span>
                  <div className="flex items-center gap-1">
                    <DollarSign className="w-3 h-3 text-emerald-400" />
                    <span className="text-xl font-bold text-emerald-400">Ξ{claimableAmount}</span>
                  </div>
                </div>
                {bid.final_amount && (
                  <p className="text-xs text-gray-500">
                    Agreed amount from 2-way handshake
                  </p>
                )}
              </div>
            </div>

            {/* Wallet Address */}
            <div className="space-y-2">
              <Label htmlFor="wallet" className="text-white flex items-center gap-2">
                <Wallet className="w-4 h-4" />
                Your ETH Wallet Address *
              </Label>
              <Input
                id="wallet"
                type="text"
                placeholder="0x1234567890abcdef1234567890abcdef12345678"
                value={walletAddress}
                onChange={(e) => { setWalletAddress(e.target.value); setError(''); }}
                className="bg-gray-800 border-gray-600 text-white placeholder-gray-500 font-mono text-sm"
                disabled={isClaiming}
                autoComplete="off"
              />
              <p className="text-xs text-gray-500">
                Enter your Ethereum wallet address to receive the payment directly from escrow
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-900/50 border border-red-700 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
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
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Processing…
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <Wallet className="w-4 h-4" />
                    Claim Ξ{claimableAmount} ETH
                  </span>
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default BidClaimModal;
