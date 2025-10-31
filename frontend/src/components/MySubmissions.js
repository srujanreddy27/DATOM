import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { 
  DollarSign, 
  Clock, 
  Calendar,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  Briefcase,
  ExternalLink,
  Upload,
  Wallet
} from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';
import PaymentClaimModal from './PaymentClaimModal';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const MySubmissions = ({ currentUser }) => {
  const [submissions, setSubmissions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [tasks, setTasks] = useState({});

  useEffect(() => {
    if (currentUser && currentUser.user_type === 'freelancer') {
      fetchMySubmissions();
    }
  }, [currentUser]);

  // Auto-refresh submissions every 30 seconds to show real-time updates
  useEffect(() => {
    if (currentUser && currentUser.user_type === 'freelancer') {
      const interval = setInterval(() => {
        fetchMySubmissions();
      }, 30000); // 30 seconds

      return () => clearInterval(interval);
    }
  }, [currentUser]);

  const fetchMySubmissions = async () => {
    setIsLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('firebase_token');
      if (!token) {
        setError('Please log in to view your submissions');
        return;
      }

      const response = await axios.get(`${BACKEND_URL}/api/submissions/my-submissions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      setSubmissions(response.data);
      
      // Fetch task details for each submission
      const taskIds = [...new Set(response.data.map(sub => sub.task_id))];
      const taskPromises = taskIds.map(async (taskId) => {
        try {
          const taskResponse = await axios.get(`${BACKEND_URL}/api/tasks/${taskId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          return { [taskId]: taskResponse.data };
        } catch (error) {
          console.error(`Error fetching task ${taskId}:`, error);
          return { [taskId]: null };
        }
      });
      
      const taskResults = await Promise.all(taskPromises);
      const tasksMap = taskResults.reduce((acc, taskObj) => ({ ...acc, ...taskObj }), {});
      setTasks(tasksMap);
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

  const filterSubmissionsByStatus = (status) => {
    if (status === 'approved') {
      // Include both fully approved and partially approved (payment claimable) submissions
      return submissions.filter(sub => sub.status === 'approved' || sub.payment_claimable);
    }
    return submissions.filter(sub => sub.status === status);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  const handleClaimPayment = (submission) => {
    const task = tasks[submission.task_id];
    if (task) {
      setSelectedSubmission(submission);
      setSelectedTask(task);
      setShowPaymentModal(true);
    }
  };

  const handlePaymentClaimed = (submissionId) => {
    // Update the submission status locally
    setSubmissions(prev => 
      prev.map(sub => 
        sub.id === submissionId 
          ? { ...sub, payment_claimed: true, payment_claimed_at: new Date().toISOString() }
          : sub
      )
    );
    setShowPaymentModal(false);
  };

  const SubmissionCard = ({ submission }) => (
    <Card className="bg-gray-800/50 border-gray-700 hover:bg-gray-800/70 transition-all duration-200">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-white text-lg font-semibold mb-2">
              Submission #{submission.id.slice(-8)}
            </CardTitle>
            <CardDescription className="text-gray-300 text-sm">
              Submitted on {formatDate(submission.created_at)}
              {submission.approved_at && (
                <span className="ml-2 text-green-400">
                  • Approved on {formatDate(submission.approved_at)}
                </span>
              )}
            </CardDescription>
          </div>
          <Badge className={`ml-3 flex items-center space-x-1 ${getStatusColor(submission.status)}`}>
            {getStatusIcon(submission.status)}
            <span className="capitalize">{submission.status}</span>
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        {/* Work Description */}
        <div className="mb-4">
          <div className="flex items-center space-x-2 mb-2">
            <FileText className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-white">Work Description</span>
          </div>
          <p className="text-sm text-gray-300 line-clamp-3 bg-gray-700/30 p-3 rounded-lg">
            {submission.description}
          </p>
        </div>

        {/* Files and Demo */}
        <div className="space-y-3">
          {/* Files */}
          {submission.files && submission.files.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <Upload className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-medium text-white">Files ({submission.files.length})</span>
                </div>
                {submission.approved_files_count !== undefined && (
                  <div className="text-xs text-gray-400">
                    {submission.approved_files_count} approved
                  </div>
                )}
              </div>
              <div className="space-y-2">
                {submission.files.map((file, index) => {
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
                    <div key={index} className="bg-gray-700/30 p-2 rounded">
                      <div className="flex items-center justify-between">
                        <a
                          href={downloadUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center space-x-2 text-xs text-blue-400 hover:text-blue-300 flex-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span className="truncate">{fileName}</span>
                        </a>
                        <div className="flex items-center space-x-1">
                          {isFileObject && file.auto_approved && (
                            <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-xs">
                              🔐 Auto
                            </Badge>
                          )}
                          <Badge className={`flex items-center space-x-1 ${getFileStatusColor(fileStatus)} text-xs`}>
                            {getFileStatusIcon(fileStatus)}
                            <span className="capitalize">{fileStatus}</span>
                          </Badge>
                        </div>
                      </div>
                      {isFileObject && file.zkp_proof && (
                        <div className="mt-1 text-xs text-purple-400">
                          🔐 ZKP Verified
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Approval Progress Summary */}
        {submission.approved_files_count !== undefined && submission.files && submission.files.length > 0 && (
          <div className="mt-4 bg-gray-700/20 rounded-lg p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-300">Approval Progress:</span>
              <span className="text-white font-semibold">
                {submission.approved_files_count} of {submission.files.length} files approved
              </span>
            </div>
            {submission.approval_percentage !== undefined && (
              <div className="mt-2">
                <div className="w-full bg-gray-600 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-teal-500 to-green-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(submission.approval_percentage || 0, 100)}%` }}
                  ></div>
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {Math.round(submission.approval_percentage || 0)}% of submitted files approved
                </div>
              </div>
            )}
          </div>
        )}

        {/* Payment Status and Action */}
        {(submission.status === 'approved' || submission.payment_claimable) && (
          <div className="mt-4 pt-3 border-t border-gray-700">
            {submission.payment_claimed ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-green-400">Payment Claimed</span>
                </div>
                <span className="text-xs text-gray-400">
                  {formatDate(submission.payment_claimed_at)}
                </span>
              </div>
            ) : submission.payment_claimable ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-teal-400">Payment Ready to Claim</span>
                  <Button
                    size="sm"
                    onClick={() => handleClaimPayment(submission)}
                    className="bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white"
                  >
                    <Wallet className="w-3 h-3 mr-1" />
                    Claim {submission.payment_amount ? `${submission.payment_amount.toFixed(4)} ETH` : `${(tasks[submission.task_id]?.budget || 0)} ETH`}
                  </Button>
                </div>
                {submission.approved_files_count !== undefined && submission.approved_files_count > 0 && (
                  <div className="text-xs text-gray-400">
                    Partial payment for {submission.approved_files_count} approved files
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-yellow-400" />
                <span className="text-sm text-yellow-400">Waiting for approval</span>
              </div>
            )}
          </div>
        )}

        {/* Task ID for reference */}
        <div className="text-xs text-gray-500 border-t border-gray-700 pt-2 mt-2">
          Task ID: {submission.task_id}
        </div>
      </CardContent>
    </Card>
  );

  if (!currentUser || currentUser.user_type !== 'freelancer') {
    return (
      <div className="text-center py-12">
        <Briefcase className="w-16 h-16 text-gray-600 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-white mb-2">Freelancer Access Only</h3>
        <p className="text-gray-400">Only freelancers can view submissions.</p>
      </div>
    );
  }

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
        <Button onClick={fetchMySubmissions} variant="outline">
          Try Again
        </Button>
      </div>
    );
  }

  const pendingSubs = filterSubmissionsByStatus('pending');
  const approvedSubs = filterSubmissionsByStatus('approved');
  const rejectedSubs = filterSubmissionsByStatus('rejected');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">My Submissions</h2>
          <p className="text-gray-400">Track your work submissions and their status</p>
        </div>
        <Button onClick={fetchMySubmissions} variant="outline" size="sm">
          Refresh
        </Button>
      </div>

      {submissions.length === 0 ? (
        <div className="text-center py-12">
          <Briefcase className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No Submissions Yet</h3>
          <p className="text-gray-400 mb-4">You haven't submitted work for any tasks yet.</p>
          <Button className="bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700">
            Browse Tasks
          </Button>
        </div>
      ) : (
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-gray-800 border-gray-700">
            <TabsTrigger value="all" className="data-[state=active]:bg-gray-700">
              All ({submissions.length})
            </TabsTrigger>
            <TabsTrigger value="pending" className="data-[state=active]:bg-gray-700">
              Pending ({pendingSubs.length})
            </TabsTrigger>
            <TabsTrigger value="approved" className="data-[state=active]:bg-gray-700">
              Approved ({approvedSubs.length})
            </TabsTrigger>
            <TabsTrigger value="rejected" className="data-[state=active]:bg-gray-700">
              Rejected ({rejectedSubs.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4 mt-6">
            {submissions.map((submission) => (
              <SubmissionCard key={submission.id} submission={submission} />
            ))}
          </TabsContent>

          <TabsContent value="pending" className="space-y-4 mt-6">
            {pendingSubs.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">No pending submissions</p>
              </div>
            ) : (
              pendingSubs.map((submission) => (
                <SubmissionCard key={submission.id} submission={submission} />
              ))
            )}
          </TabsContent>

          <TabsContent value="approved" className="space-y-4 mt-6">
            {approvedSubs.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">No approved submissions</p>
              </div>
            ) : (
              approvedSubs.map((submission) => (
                <SubmissionCard key={submission.id} submission={submission} />
              ))
            )}
          </TabsContent>

          <TabsContent value="rejected" className="space-y-4 mt-6">
            {rejectedSubs.length === 0 ? (
              <div className="text-center py-8">
                <XCircle className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">No rejected submissions</p>
              </div>
            ) : (
              rejectedSubs.map((submission) => (
                <SubmissionCard key={submission.id} submission={submission} />
              ))
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Payment Claim Modal */}
      <PaymentClaimModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        submission={selectedSubmission}
        task={selectedTask}
        onPaymentClaimed={handlePaymentClaimed}
      />
    </div>
  );
};

export default MySubmissions;