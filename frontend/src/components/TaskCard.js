import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { 
  DollarSign, 
  Clock, 
  Star, 
  Users, 
  Calendar,
  CheckCircle,
  AlertCircle,
  User
} from 'lucide-react';
import SubmissionModal from './SubmissionModal';
import TaskSubmissions from './TaskSubmissions';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const TaskCard = ({ task, onTaskUpdate, currentUser }) => {
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);
  const [showSubmissionsModal, setShowSubmissionsModal] = useState(false);
  const [canSubmit, setCanSubmit] = useState({ can_submit: false, reason: '' });
  const [isCheckingSubmission, setIsCheckingSubmission] = useState(false);
  const [existingSubmission, setExistingSubmission] = useState(null);

  // Check if user can submit work for this task (only for freelancers)
  useEffect(() => {
    const checkCanSubmit = async () => {
      if (!currentUser || !task || currentUser.user_type !== 'freelancer') return;
      
      setIsCheckingSubmission(true);
      try {
        const token = localStorage.getItem('firebase_token');
        if (!token) return;

        const response = await axios.get(`${BACKEND_URL}/api/tasks/${task.id}/can-submit`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        setCanSubmit(response.data);
        if (response.data.submission) {
          setExistingSubmission(response.data.submission);
        }
      } catch (error) {
        console.error('Error checking submission status:', error);
        setCanSubmit({ can_submit: false, reason: 'Error checking submission status' });
      } finally {
        setIsCheckingSubmission(false);
      }
    };

    checkCanSubmit();
  }, [currentUser, task]);

  const handleSubmissionSubmitted = () => {
    // Refresh the can submit status
    setCanSubmit({ can_submit: false, reason: 'You have already submitted work for this task' });
    
    // Update task submission count if callback provided
    if (onTaskUpdate) {
      onTaskUpdate({
        ...task,
        submissions: (task.submissions || 0) + 1
      });
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'open':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'in_progress':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'completed':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'cancelled':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'open':
        return <CheckCircle className="w-3 h-3" />;
      case 'in_progress':
        return <Clock className="w-3 h-3" />;
      case 'completed':
        return <CheckCircle className="w-3 h-3" />;
      case 'cancelled':
        return <AlertCircle className="w-3 h-3" />;
      default:
        return <Clock className="w-3 h-3" />;
    }
  };

  const isDeadlineSoon = () => {
    const deadline = new Date(task.deadline);
    const now = new Date();
    const daysUntilDeadline = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
    return daysUntilDeadline <= 3 && daysUntilDeadline >= 0;
  };

  const isDeadlinePassed = () => {
    const deadline = new Date(task.deadline);
    const now = new Date();
    return deadline < now;
  };

  const formatDeadline = () => {
    const deadline = new Date(task.deadline);
    const now = new Date();
    const daysUntilDeadline = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
    
    if (daysUntilDeadline < 0) {
      return `${Math.abs(daysUntilDeadline)} days overdue`;
    } else if (daysUntilDeadline === 0) {
      return 'Due today';
    } else if (daysUntilDeadline === 1) {
      return 'Due tomorrow';
    } else {
      return `${daysUntilDeadline} days left`;
    }
  };

  const renderActionButton = () => {
    if (!currentUser) {
      return (
        <Button 
          size="sm" 
          className="bg-gray-600 text-gray-300 cursor-not-allowed"
          disabled
        >
          Login Required
        </Button>
      );
    }

    // If user is the task owner (client), show "View Submissions" button
    if (currentUser.user_type === 'client' && task.client === currentUser.username) {
      if (task.status === 'completed') {
        return (
          <Button 
            size="sm" 
            onClick={() => setShowSubmissionsModal(true)}
            className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
          >
            View Results ({task.submissions || 0})
          </Button>
        );
      }
      return (
        <Button 
          size="sm" 
          onClick={() => setShowSubmissionsModal(true)}
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
        >
          View Submissions ({task.submissions || 0})
        </Button>
      );
    }

    // For freelancers, show submission-related buttons
    if (currentUser.user_type === 'freelancer') {
      // If task is completed, show appropriate message
      if (task.status === 'completed') {
        return (
          <Button 
            size="sm" 
            className="bg-gray-600 text-gray-300 cursor-not-allowed"
            disabled
          >
            Task Completed
          </Button>
        );
      }

      if (isCheckingSubmission) {
        return (
          <Button size="sm" disabled className="bg-gray-600">
            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
            Checking...
          </Button>
        );
      }

      if (existingSubmission) {
        const statusColors = {
          pending: 'bg-yellow-600 hover:bg-yellow-700',
          approved: 'bg-green-600 hover:bg-green-700',
          rejected: 'bg-red-600 hover:bg-red-700'
        };
        
        return (
          <Button 
            size="sm" 
            className={`${statusColors[existingSubmission.status] || 'bg-gray-600'} cursor-default`}
            disabled
          >
            Submitted ({existingSubmission.status})
          </Button>
        );
      }

      if (!canSubmit.can_submit) {
        return (
          <Button 
            size="sm" 
            className="bg-gray-600 text-gray-300 cursor-not-allowed"
            disabled
            title={canSubmit.reason}
          >
            {canSubmit.reason === 'This task already has an approved submission' ? 'Task Completed' : 'Cannot Submit'}
          </Button>
        );
      }

      return (
        <Button 
          size="sm" 
          onClick={() => setShowSubmissionModal(true)}
          className="bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white"
        >
          Submit Work
        </Button>
      );
    }

    // For clients viewing other people's tasks or users not logged in
    if (task.status === 'completed') {
      return (
        <Button 
          size="sm" 
          className="bg-gray-600 text-gray-300 cursor-not-allowed"
          disabled
        >
          Task Completed
        </Button>
      );
    }

    return (
      <Button 
        size="sm" 
        className="bg-gray-600 text-gray-300 cursor-not-allowed"
        disabled
      >
        {currentUser?.user_type === 'client' ? 'Not Your Task' : 'View Only'}
      </Button>
    );
  };

  return (
    <>
      <Card className="bg-gray-800/50 border-gray-700 hover:bg-gray-800/70 transition-all duration-200 hover:border-gray-600">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-white text-lg font-semibold mb-2 line-clamp-2">
                {task.title}
              </CardTitle>
              <CardDescription className="text-gray-300 text-sm line-clamp-3 mb-3">
                {task.description}
              </CardDescription>
            </div>
            <Badge className={`ml-3 flex items-center space-x-1 ${getStatusColor(task.status)}`}>
              {getStatusIcon(task.status)}
              <span className="capitalize">{task.status.replace('_', ' ')}</span>
            </Badge>
          </div>

          {/* Skills */}
          {task.skills && task.skills.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {task.skills.slice(0, 3).map((skill, index) => (
                <Badge 
                  key={index} 
                  variant="outline" 
                  className="text-xs border-gray-600 text-gray-300 bg-gray-700/50"
                >
                  {skill}
                </Badge>
              ))}
              {task.skills.length > 3 && (
                <Badge 
                  variant="outline" 
                  className="text-xs border-gray-600 text-gray-400 bg-gray-700/50"
                >
                  +{task.skills.length - 3} more
                </Badge>
              )}
            </div>
          )}
        </CardHeader>

        <CardContent className="pt-0">
          {/* Client Info */}
          <div className="flex items-center space-x-3 mb-4">
            <Avatar className="w-8 h-8">
              <AvatarFallback className="bg-gray-700 text-gray-300 text-xs">
                <User className="w-4 h-4" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="text-sm font-medium text-white">{task.client}</p>
              <div className="flex items-center space-x-1">
                <Star className="w-3 h-3 text-yellow-400 fill-current" />
                <span className="text-xs text-gray-400">{task.clientRating || task.client_rating || 4.5}</span>
              </div>
            </div>
          </div>

          {/* Task Details */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="flex items-center space-x-2">
              <DollarSign className="w-4 h-4 text-teal-400" />
              <span className="text-sm font-semibold text-white">${task.budget}</span>
            </div>
            <div className="flex items-center space-x-2">
              <Users className="w-4 h-4 text-blue-400" />
              <span className="text-sm text-gray-300">{task.submissions || 0} submissions</span>
            </div>
          </div>

          {/* Deadline */}
          <div className="flex items-center space-x-2 mb-4">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span className={`text-sm ${
              isDeadlinePassed() 
                ? 'text-red-400' 
                : isDeadlineSoon() 
                  ? 'text-yellow-400' 
                  : 'text-gray-300'
            }`}>
              {formatDeadline()}
            </span>
          </div>

          {/* Category */}
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="border-gray-600 text-gray-300 bg-gray-700/30">
              {task.category}
            </Badge>
            
            {/* Action Button */}
            {renderActionButton()}
          </div>
        </CardContent>
      </Card>

      {/* Submission Modal */}
      <SubmissionModal
        isOpen={showSubmissionModal}
        onClose={() => setShowSubmissionModal(false)}
        task={task}
        onSubmissionSubmitted={handleSubmissionSubmitted}
      />

      {/* Task Submissions Modal */}
      {showSubmissionsModal && (
        <Dialog open={showSubmissionsModal} onOpenChange={setShowSubmissionsModal}>
          <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-teal-400">
                Task Submissions
              </DialogTitle>
              <DialogDescription className="text-gray-300">
                Review submissions for "{task.title}"
              </DialogDescription>
            </DialogHeader>
            <TaskSubmissions 
              taskId={task.id} 
              currentUser={currentUser}
              onSubmissionStatusChange={(submissionId, status) => {
                if (status === 'approved' && onTaskUpdate) {
                  onTaskUpdate({
                    ...task,
                    status: 'completed'
                  });
                }
                setShowSubmissionsModal(false);
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default TaskCard;