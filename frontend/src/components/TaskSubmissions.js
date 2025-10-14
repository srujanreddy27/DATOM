import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { 
  DollarSign, 
  Clock, 
  Calendar,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  User,
  Star,
  Award,
  ExternalLink,
  Upload,
  Eye
} from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const TaskSubmissions = ({ taskId, currentUser, onSubmissionStatusChange }) => {
  const [submissions, setSubmissions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  useEffect(() => {
    if (taskId && currentUser) {
      fetchSubmissions();
    }
  }, [taskId, currentUser]);

  const fetchSubmissions = async () => {
    setIsLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('firebase_token');
      if (!token) {
        setError('Please log in to view submissions');
        return;
      }

      const response = await axios.get(`${BACKEND_URL}/api/submissions/task/${taskId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      setSubmissions(response.data);
    } catch (error) {
      console.error('Error fetching submissions:', error);
      if (error.response?.data?.detail) {
        setError(error.response.data.detail);
      } else {
        setError('Failed to load submissions');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const approveSubmission = async (submissionId) => {
    setIsUpdatingStatus(true);

    try {
      const token = localStorage.getItem('firebase_token');
      if (!token) {
        setError('Please log in to approve submissions');
        return;
      }

      await axios.put(
        `${BACKEND_URL}/api/submissions/${submissionId}/approve`,
        {},
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      // Update local state
      setSubmissions(prev => 
        prev.map(sub => 
          sub.id === submissionId 
            ? { ...sub, status: 'approved', approved_at: new Date().toISOString() } 
            : sub.status === 'pending' 
              ? { ...sub, status: 'rejected' }  // Auto-reject other pending submissions
              : sub
        )
      );

      // Close modal
      setSelectedSubmission(null);

      // Notify parent component
      if (onSubmissionStatusChange) {
        onSubmissionStatusChange(submissionId, 'approved');
      }

    } catch (error) {
      console.error('Error approving submission:', error);
      if (error.response?.data?.detail) {
        setError(error.response.data.detail);
      } else {
        setError('Failed to approve submission');
      }
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const rejectSubmission = async (submissionId) => {
    setIsUpdatingStatus(true);

    try {
      const token = localStorage.getItem('firebase_token');
      if (!token) {
        setError('Please log in to reject submissions');
        return;
      }

      await axios.put(
        `${BACKEND_URL}/api/submissions/${submissionId}/reject`,
        {},
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      // Update local state
      setSubmissions(prev => 
        prev.map(sub => 
          sub.id === submissionId 
            ? { ...sub, status: 'rejected' } 
            : sub
        )
      );

      // Close modal
      setSelectedSubmission(null);

      // Notify parent component
      if (onSubmissionStatusChange) {
        onSubmissionStatusChange(submissionId, 'rejected');
      }

    } catch (error) {
      console.error('Error rejecting submission:', error);
      if (error.response?.data?.detail) {
        setError(error.response.data.detail);
      } else {
        setError('Failed to reject submission');
      }
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'approved':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'rejected':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-3 h-3" />;
      case 'approved':
        return <CheckCircle className="w-3 h-3" />;
      case 'rejected':
        return <XCircle className="w-3 h-3" />;
      default:
        return <AlertCircle className="w-3 h-3" />;
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  const SubmissionCard = ({ submission }) => (
    <Card className="bg-gray-800/50 border-gray-700 hover:bg-gray-800/70 transition-all duration-200 cursor-pointer"
          onClick={() => setSelectedSubmission(submission)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3 flex-1">
            <Avatar className="w-10 h-10">
              <AvatarFallback className="bg-gray-700 text-gray-300">
                <User className="w-5 h-5" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <CardTitle className="text-white text-lg font-semibold">
                {submission.freelancer_name}
              </CardTitle>
              <CardDescription className="text-gray-300 text-sm">
                Submitted on {formatDate(submission.created_at)}
              </CardDescription>
            </div>
          </div>
          <Badge className={`ml-3 flex items-center space-x-1 ${getStatusColor(submission.status)}`}>
            {getStatusIcon(submission.status)}
            <span className="capitalize">{submission.status}</span>
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        {/* Work Description Preview */}
        <div className="mb-4">
          <div className="flex items-center space-x-2 mb-2">
            <FileText className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-white">Work Description</span>
          </div>
          <p className="text-sm text-gray-300 line-clamp-2 bg-gray-700/30 p-3 rounded-lg">
            {submission.description}
          </p>
        </div>

        {/* Files Count */}
        <div className="flex items-center space-x-2">
          <Upload className="w-4 h-4 text-blue-400" />
          <div>
            <span className="text-sm font-semibold text-white">{submission.files?.length || 0}</span>
            <p className="text-xs text-gray-400">Files uploaded</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-white mb-2">Error Loading Submissions</h3>
        <p className="text-gray-400 mb-4">{error}</p>
        <Button onClick={fetchSubmissions} variant="outline">
          Try Again
        </Button>
      </div>
    );
  }

  const approvedSubmission = submissions.find(sub => sub.status === 'approved');

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-white">Work Submissions ({submissions.length})</h3>
            <p className="text-gray-400">Review and approve submitted work</p>
          </div>
          <Button onClick={fetchSubmissions} variant="outline" size="sm">
            Refresh
          </Button>
        </div>

        {approvedSubmission && (
          <div className="bg-green-900/20 border border-green-700 rounded-lg p-4 mb-6">
            <div className="flex items-center space-x-2 mb-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span className="text-green-400 font-semibold">Task Completed</span>
            </div>
            <p className="text-gray-300 text-sm">
              Work by <span className="font-semibold">{approvedSubmission.freelancer_name}</span> has been approved.
              Funds have been released from escrow.
            </p>
          </div>
        )}

        {submissions.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No Submissions Yet</h3>
            <p className="text-gray-400">No freelancers have submitted work for this task yet.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {submissions.map((submission) => (
              <SubmissionCard key={submission.id} submission={submission} />
            ))}
          </div>
        )}
      </div>

      {/* Submission Detail Modal */}
      <Dialog open={!!selectedSubmission} onOpenChange={() => setSelectedSubmission(null)}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedSubmission && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-teal-400">
                  Work Submission Review
                </DialogTitle>
                <DialogDescription className="text-gray-300">
                  Review this freelancer's completed work
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 mt-4">
                {/* Freelancer Info */}
                <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                  <div className="flex items-center space-x-3 mb-3">
                    <Avatar className="w-12 h-12">
                      <AvatarFallback className="bg-gray-700 text-gray-300">
                        <User className="w-6 h-6" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h4 className="font-semibold text-white">{selectedSubmission.freelancer_name}</h4>
                      <p className="text-sm text-gray-400">Freelancer ID: {selectedSubmission.freelancer_id}</p>
                    </div>
                    <Badge className={`flex items-center space-x-1 ${getStatusColor(selectedSubmission.status)}`}>
                      {getStatusIcon(selectedSubmission.status)}
                      <span className="capitalize">{selectedSubmission.status}</span>
                    </Badge>
                  </div>
                </div>

                {/* Work Description */}
                <div className="bg-gray-800/30 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-3">
                    <FileText className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-medium text-white">Work Description</span>
                  </div>
                  <p className="text-gray-300 whitespace-pre-wrap leading-relaxed">
                    {selectedSubmission.description}
                  </p>
                </div>

                {/* Files */}
                {selectedSubmission.files && selectedSubmission.files.length > 0 && (
                  <div className="bg-gray-800/30 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-3">
                      <Upload className="w-4 h-4 text-blue-400" />
                      <span className="text-sm font-medium text-white">
                        Submitted Files ({selectedSubmission.files.length})
                      </span>
                    </div>
                    <div className="space-y-2">
                      {selectedSubmission.files.map((file, index) => {
                        const fileName = file.split('/').pop() || file;
                        const token = localStorage.getItem('firebase_token');
                        const downloadUrl = `${BACKEND_URL}/api/download-file?file_path=${encodeURIComponent(file)}&token=${encodeURIComponent(token)}`;
                        
                        return (
                          <a
                            key={index}
                            href={downloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center space-x-3 p-3 bg-gray-700/50 rounded-lg hover:bg-gray-700/70 transition-colors"
                          >
                            <ExternalLink className="w-4 h-4 text-blue-400 flex-shrink-0" />
                            <span className="text-blue-400 hover:text-blue-300 truncate">{fileName}</span>
                            <Eye className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Submission Date */}
                <div className="text-xs text-gray-500 border-t border-gray-700 pt-4">
                  Submitted on {formatDate(selectedSubmission.created_at)} • 
                  Submission ID: {selectedSubmission.id}
                  {selectedSubmission.approved_at && (
                    <span className="ml-2 text-green-400">
                      • Approved on {formatDate(selectedSubmission.approved_at)}
                    </span>
                  )}
                </div>

                {/* Action Buttons */}
                {selectedSubmission.status === 'pending' && (
                  <div className="flex justify-end space-x-3 pt-4 border-t border-gray-700">
                    <Button
                      variant="outline"
                      onClick={() => rejectSubmission(selectedSubmission.id)}
                      disabled={isUpdatingStatus}
                      className="border-red-600 text-red-400 hover:bg-red-900/20"
                    >
                      {isUpdatingStatus ? (
                        <div className="flex items-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-400 mr-2"></div>
                          Rejecting...
                        </div>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4 mr-2" />
                          Reject
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => approveSubmission(selectedSubmission.id)}
                      disabled={isUpdatingStatus}
                      className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
                    >
                      {isUpdatingStatus ? (
                        <div className="flex items-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Approving...
                        </div>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Approve & Release Funds
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TaskSubmissions;