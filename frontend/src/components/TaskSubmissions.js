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
  const [taskData, setTaskData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  useEffect(() => {
    if (taskId && currentUser) {
      fetchTaskData();
      fetchSubmissions();
    }
  }, [taskId, currentUser]);

  const fetchTaskData = async () => {
    try {
      const token = localStorage.getItem('firebase_token');
      if (!token) return;

      const response = await axios.get(`${BACKEND_URL}/api/tasks/${taskId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      setTaskData(response.data);
    } catch (error) {
      console.error('Error fetching task data:', error);
    }
  };

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

      console.log('Fetched submissions:', response.data);

      // Ensure files are properly structured
      const processedSubmissions = response.data.map(sub => {
        if (sub.files && Array.isArray(sub.files)) {
          sub.files = sub.files.map(file => {
            // Ensure each file has the required properties
            if (typeof file === 'string') {
              return {
                id: `file_${Date.now()}_${Math.random()}`,
                file_path: file,
                file_name: file.split('/').pop() || file,
                file_type: 'application/octet-stream',
                file_size: 0,
                status: 'pending'
              };
            }
            return {
              ...file,
              status: file.status || 'pending'
            };
          });
        }
        return sub;
      });

      setSubmissions(processedSubmissions);
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

  const approveIndividualFile = async (submissionId, fileIndex) => {
    setIsUpdatingStatus(true);

    try {
      const token = localStorage.getItem('firebase_token');
      if (!token) {
        setError('Please log in to approve files');
        return;
      }

      await axios.put(
        `${BACKEND_URL}/api/submissions/${submissionId}/files/index/${fileIndex}/approve`,
        {},
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      // Update local state
      setSubmissions(prev =>
        prev.map(sub => {
          if (sub.id === submissionId) {
            const updatedFiles = sub.files.map((file, index) => {
              if (index === fileIndex) {
                return typeof file === 'object'
                  ? { ...file, status: 'approved', approved_at: new Date().toISOString() }
                  : { file_path: file, status: 'approved', approved_at: new Date().toISOString() };
              }
              return file;
            });
            const approvedCount = updatedFiles.filter(f =>
              (typeof f === 'object' ? f.status : 'pending') === 'approved'
            ).length;

            return {
              ...sub,
              files: updatedFiles,
              approved_files_count: approvedCount,
              approval_percentage: (approvedCount / updatedFiles.length) * 100,
              payment_claimable: approvedCount > 0
            };
          }
          return sub;
        })
      );

      // Update selected submission if it's the same one
      if (selectedSubmission && selectedSubmission.id === submissionId) {
        const updatedFiles = selectedSubmission.files.map((file, index) => {
          if (index === fileIndex) {
            return typeof file === 'object'
              ? { ...file, status: 'approved', approved_at: new Date().toISOString() }
              : { file_path: file, status: 'approved', approved_at: new Date().toISOString() };
          }
          return file;
        });
        const approvedCount = updatedFiles.filter(f =>
          (typeof f === 'object' ? f.status : 'pending') === 'approved'
        ).length;

        setSelectedSubmission({
          ...selectedSubmission,
          files: updatedFiles,
          approved_files_count: approvedCount,
          approval_percentage: (approvedCount / updatedFiles.length) * 100,
          payment_claimable: approvedCount > 0
        });
      }

    } catch (error) {
      console.error('Error approving file:', error);
      console.error('Error details:', error.response?.data);
      if (error.response?.data?.detail) {
        setError(`Failed to approve file: ${error.response.data.detail}`);
      } else if (error.response?.status === 404) {
        setError('File not found. Please refresh the page and try again.');
      } else if (error.response?.status === 403) {
        setError('You do not have permission to approve this file.');
      } else {
        setError(`Failed to approve file: ${error.message || 'Unknown error'}`);
      }
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const rejectIndividualFile = async (submissionId, fileIndex) => {
    setIsUpdatingStatus(true);

    try {
      const token = localStorage.getItem('firebase_token');
      if (!token) {
        setError('Please log in to reject files');
        return;
      }

      const feedback = prompt('Please provide feedback for rejection (optional):');

      const formData = new FormData();
      formData.append('feedback', feedback || '');

      await axios.put(
        `${BACKEND_URL}/api/submissions/${submissionId}/files/index/${fileIndex}/reject`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      // Update local state
      setSubmissions(prev =>
        prev.map(sub => {
          if (sub.id === submissionId) {
            const updatedFiles = sub.files.map((file, index) => {
              if (index === fileIndex) {
                return typeof file === 'object'
                  ? { ...file, status: 'rejected', rejected_at: new Date().toISOString(), feedback: feedback || '' }
                  : { file_path: file, status: 'rejected', rejected_at: new Date().toISOString(), feedback: feedback || '' };
              }
              return file;
            });
            const approvedCount = updatedFiles.filter(f =>
              (typeof f === 'object' ? f.status : 'pending') === 'approved'
            ).length;

            return {
              ...sub,
              files: updatedFiles,
              approved_files_count: approvedCount,
              approval_percentage: (approvedCount / updatedFiles.length) * 100,
              payment_claimable: approvedCount > 0
            };
          }
          return sub;
        })
      );

      // Update selected submission if it's the same one
      if (selectedSubmission && selectedSubmission.id === submissionId) {
        const updatedFiles = selectedSubmission.files.map((file, index) => {
          if (index === fileIndex) {
            return typeof file === 'object'
              ? { ...file, status: 'rejected', rejected_at: new Date().toISOString(), feedback: feedback || '' }
              : { file_path: file, status: 'rejected', rejected_at: new Date().toISOString(), feedback: feedback || '' };
          }
          return file;
        });
        const approvedCount = updatedFiles.filter(f =>
          (typeof f === 'object' ? f.status : 'pending') === 'approved'
        ).length;

        setSelectedSubmission({
          ...selectedSubmission,
          files: updatedFiles,
          approved_files_count: approvedCount,
          approval_percentage: (approvedCount / updatedFiles.length) * 100,
          payment_claimable: approvedCount > 0
        });
      }

    } catch (error) {
      console.error('Error rejecting file:', error);
      console.error('Error details:', error.response?.data);
      if (error.response?.data?.detail) {
        setError(`Failed to reject file: ${error.response.data.detail}`);
      } else if (error.response?.status === 404) {
        setError('File not found. Please refresh the page and try again.');
      } else if (error.response?.status === 403) {
        setError('You do not have permission to reject this file.');
      } else {
        setError(`Failed to reject file: ${error.message || 'Unknown error'}`);
      }
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const approveAllFiles = async (submissionId) => {
    setIsUpdatingStatus(true);

    try {
      const token = localStorage.getItem('firebase_token');
      if (!token) {
        setError('Please log in to approve files');
        return;
      }

      // Get all pending file indices
      const submission = submissions.find(sub => sub.id === submissionId);
      if (!submission) {
        setError('Submission not found');
        return;
      }

      const pendingFileIndices = submission.files
        .map((file, index) => {
          const fileStatus = typeof file === 'object' ? file.status : 'pending';
          return fileStatus === 'pending' ? index : null;
        })
        .filter(index => index !== null);

      if (pendingFileIndices.length === 0) {
        setError('No pending files to approve');
        return;
      }

      // Approve all pending files
      for (const fileIndex of pendingFileIndices) {
        await axios.put(
          `${BACKEND_URL}/api/submissions/${submissionId}/files/index/${fileIndex}/approve`,
          {},
          {
            headers: { 'Authorization': `Bearer ${token}` }
          }
        );
      }

      // Refresh submissions to get updated data
      await fetchSubmissions();

      // Close modal after successful approval
      setSelectedSubmission(null);

      // Check if task should be completed (show notification)
      if (taskData && taskData.expected_files_count) {
        const totalApprovedFiles = submissions.reduce((total, sub) => {
          return total + (sub.approved_files_count || 0);
        }, 0) + pendingFileIndices.length; // Add the files we just approved

        if (totalApprovedFiles >= taskData.expected_files_count) {
          setError(`🎉 Task completed! All ${taskData.expected_files_count} expected files have been approved.`);
          setTimeout(() => setError(''), 5000); // Clear message after 5 seconds
        }
      }

    } catch (error) {
      console.error('Error approving all files:', error);
      console.error('Error details:', error.response?.data);
      if (error.response?.data?.detail) {
        setError(`Failed to approve all files: ${error.response.data.detail}`);
      } else {
        setError(`Failed to approve all files: ${error.message || 'Unknown error'}`);
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
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <Upload className="w-4 h-4 text-blue-400" />
                        <span className="text-sm font-medium text-white">
                          Submitted Files ({selectedSubmission.files.length})
                        </span>
                      </div>
                      <div className="flex items-center space-x-3">
                        {selectedSubmission.approved_files_count !== undefined && (
                          <div className="text-xs text-gray-400">
                            {selectedSubmission.approved_files_count} of {selectedSubmission.files.length} approved
                          </div>
                        )}
                        {currentUser && currentUser.user_type === 'client' && selectedSubmission.files && selectedSubmission.files.some(file => {
                          const fileStatus = typeof file === 'object' ? file.status : 'pending';
                          return fileStatus === 'pending';
                        }) && (
                            <Button
                              size="sm"
                              onClick={() => approveAllFiles(selectedSubmission.id)}
                              disabled={isUpdatingStatus}
                              className="bg-green-600 hover:bg-green-700 text-white text-xs"
                            >
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Approve All
                            </Button>
                          )}
                      </div>
                    </div>
                    <div className="space-y-3">
                      {selectedSubmission.files.map((file, index) => {
                        const isFileObject = typeof file === 'object' && file !== null;
                        const fileName = isFileObject ? file.file_name || file.name : (typeof file === 'string' && file) ? file.split('/').pop() || file : String(file || '');
                        const fileStatus = isFileObject ? file.status : 'pending';
                        const filePath = isFileObject ? file.file_path : file;
                        const token = localStorage.getItem('firebase_token');
                        const downloadUrl = `${BACKEND_URL}/api/download-file?file_path=${encodeURIComponent(filePath)}&token=${encodeURIComponent(token)}`;

                        const getFileStatusColor = (status) => {
                          switch (status) {
                            case 'approved':
                              return 'bg-green-500/20 text-green-400 border-green-500/30';
                            case 'rejected':
                              return 'bg-red-500/20 text-red-400 border-red-500/30';
                            default:
                              return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
                          }
                        };

                        const getFileStatusIcon = (status) => {
                          switch (status) {
                            case 'approved':
                              return <CheckCircle className="w-3 h-3" />;
                            case 'rejected':
                              return <XCircle className="w-3 h-3" />;
                            default:
                              return <Clock className="w-3 h-3" />;
                          }
                        };

                        return (
                          <div key={index} className="border border-gray-700 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <a
                                href={downloadUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center space-x-2 text-blue-400 hover:text-blue-300 flex-1"
                              >
                                <ExternalLink className="w-4 h-4 flex-shrink-0" />
                                <span className="truncate">{fileName}</span>
                                <Eye className="w-4 h-4 flex-shrink-0" />
                              </a>
                              <div className="flex items-center space-x-2">
                                {isFileObject && file.auto_approved && (
                                  <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-xs">
                                    🔐 Auto-Approved
                                  </Badge>
                                )}
                                <Badge className={`flex items-center space-x-1 ${getFileStatusColor(fileStatus)}`}>
                                  {getFileStatusIcon(fileStatus)}
                                  <span className="capitalize text-xs">{fileStatus}</span>
                                </Badge>
                              </div>
                            </div>

                            {/* ZKP Proof Information */}
                            {isFileObject && file.zkp_proof && (
                              <div className="mt-2 p-2 bg-purple-900/20 border border-purple-700/30 rounded text-xs">
                                <div className="flex items-center space-x-1 mb-1">
                                  <span className="text-purple-400 font-semibold">🔐 Cryptographic ZKP Verified</span>
                                </div>
                                <div className="text-gray-400 space-y-0.5">
                                  <div className="text-purple-300">
                                    ✓ File properties proven WITHOUT revealing content
                                  </div>
                                  {file.zkp_metrics && (
                                    <>
                                      {file.zkp_metrics.has_zkp_proof && (
                                        <div>Proofs generated: {file.zkp_metrics.proof_count || 0}</div>
                                      )}
                                      <div className="text-xs text-gray-500">
                                        Uses Pedersen Commitments & Schnorr Proofs
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Individual file approval buttons */}
                            {fileStatus === 'pending' && currentUser && currentUser.user_type === 'client' && (
                              <div className="flex space-x-2 mt-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => approveIndividualFile(selectedSubmission.id, index)}
                                  disabled={isUpdatingStatus}
                                  className="border-green-600 text-green-400 hover:bg-green-900/20 text-xs"
                                >
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => rejectIndividualFile(selectedSubmission.id, index)}
                                  disabled={isUpdatingStatus}
                                  className="border-red-600 text-red-400 hover:bg-red-900/20 text-xs"
                                >
                                  <XCircle className="w-3 h-3 mr-1" />
                                  Reject
                                </Button>
                              </div>
                            )}

                            {/* Show change status buttons for already approved/rejected files */}
                            {(fileStatus === 'approved' || fileStatus === 'rejected') && currentUser && currentUser.user_type === 'client' && (
                              <div className="flex space-x-2 mt-2">
                                {fileStatus === 'rejected' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => approveIndividualFile(selectedSubmission.id, index)}
                                    disabled={isUpdatingStatus}
                                    className="border-green-600 text-green-400 hover:bg-green-900/20 text-xs"
                                  >
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    Approve
                                  </Button>
                                )}
                                {fileStatus === 'approved' && (!isFileObject || !file.auto_approved) && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => rejectIndividualFile(selectedSubmission.id, index)}
                                    disabled={isUpdatingStatus}
                                    className="border-red-600 text-red-400 hover:bg-red-900/20 text-xs"
                                  >
                                    <XCircle className="w-3 h-3 mr-1" />
                                    Reject
                                  </Button>
                                )}
                              </div>
                            )}

                            {/* Show feedback if file is rejected */}
                            {isFileObject && file.feedback && (
                              <div className={`mb-4 p-3 rounded-lg text-sm ${file.feedback.includes('🎉')
                                ? 'bg-green-900/50 border border-green-700 text-green-300'
                                : 'bg-red-900/50 border border-red-700 text-red-300'
                                }`}>
                                <strong>Feedback:</strong> {file.feedback}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Approval Progress Summary */}
                {selectedSubmission.approved_files_count !== undefined && selectedSubmission.files && selectedSubmission.files.length > 0 && (
                  <div className="bg-gray-800/30 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-3">
                      <Award className="w-4 h-4 text-teal-400" />
                      <span className="text-sm font-medium text-white">Approval Progress</span>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-300">Files Submitted:</span>
                        <span className="text-sm font-semibold text-white">
                          {selectedSubmission.files.length}
                        </span>
                      </div>
                      {taskData && taskData.expected_files_count && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-300">Files Expected:</span>
                          <span className="text-sm font-semibold text-blue-400">
                            {taskData.expected_files_count}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-300">Files Approved:</span>
                        <span className="text-sm font-semibold text-green-400">
                          {selectedSubmission.approved_files_count}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-300">Payment Percentage:</span>
                        <span className="text-sm font-semibold text-teal-400">
                          {taskData && taskData.expected_files_count
                            ? Math.round((selectedSubmission.approved_files_count / taskData.expected_files_count) * 100)
                            : Math.round(selectedSubmission.approval_percentage || 0)
                          }%
                        </span>
                      </div>
                      {selectedSubmission.payment_claimable && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-300">Payment Status:</span>
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                            <span className="font-bold mr-1">ETH</span>
                            Claimable
                          </Badge>
                        </div>
                      )}
                      {selectedSubmission.payment_claimable && selectedSubmission.payment_amount > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-300">Claimable Amount:</span>
                          <span className="text-sm font-semibold text-teal-400">
                            {((selectedSubmission.payment_amount || 0) - (selectedSubmission.total_claimed_amount || 0)).toFixed(4)} ETH
                          </span>
                        </div>
                      )}
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