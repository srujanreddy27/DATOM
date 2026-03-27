import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Users, Clock, DollarSign, Briefcase, ChevronRight, Layers } from 'lucide-react';

const statusColors = {
  open: 'bg-green-500/20 text-green-400 border-green-500/30',
  in_progress: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  completed: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const ProjectCard = ({ project, onViewProject, onPlaceBid, currentUser }) => {
  const openRoles = (project.roles || []).filter(r => r.status === 'open');
  const filledRoles = (project.roles || []).filter(r => r.status === 'filled');
  const isOwnProject = currentUser && project.client_id === currentUser.id;

  return (
    <Card className="bg-gray-900/60 backdrop-blur-sm border-gray-700 hover:border-teal-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-teal-500/10 group">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-white text-lg group-hover:text-teal-300 transition-colors line-clamp-1">
              {project.title}
            </CardTitle>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-gray-400 text-sm">by {project.client_name}</span>
              <span className="text-gray-600">·</span>
              <Badge variant="outline" className={`text-xs ${statusColors[project.status] || 'bg-gray-500/20 text-gray-400'}`}>
                {project.status?.replace('_', ' ')}
              </Badge>
            </div>
          </div>
          <Badge className="bg-teal-500/20 text-teal-300 border-teal-500/30 shrink-0">
            {project.category}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Description */}
        <p className="text-gray-400 text-sm line-clamp-2">{project.description}</p>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="flex flex-col items-center p-2 bg-gray-800/50 rounded-lg">
            <span className="text-emerald-400 font-bold text-base">Ξ{project.total_budget}</span>
            <span className="text-gray-500 text-xs">Budget</span>
          </div>
          <div className="flex flex-col items-center p-2 bg-gray-800/50 rounded-lg">
            <span className="text-blue-400 font-bold text-base">{openRoles.length}</span>
            <span className="text-gray-500 text-xs">Open Roles</span>
          </div>
          <div className="flex flex-col items-center p-2 bg-gray-800/50 rounded-lg">
            <span className="text-amber-400 font-bold text-base">{project.bids_count || 0}</span>
            <span className="text-gray-500 text-xs">Bids</span>
          </div>
        </div>

        {/* Roles preview */}
        {project.roles && project.roles.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Roles</p>
            <div className="flex flex-wrap gap-2">
              {project.roles.slice(0, 3).map((role, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className={`text-xs ${role.status === 'filled'
                    ? 'bg-gray-700/50 text-gray-500 border-gray-600 line-through'
                    : 'bg-violet-500/10 text-violet-300 border-violet-500/30'
                  }`}
                >
                  {role.role_name}
                  {role.status === 'filled' && ' ✓'}
                </Badge>
              ))}
              {project.roles.length > 3 && (
                <Badge variant="outline" className="text-xs bg-gray-700/30 text-gray-400 border-gray-600">
                  +{project.roles.length - 3} more
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Skills */}
        {project.skills_required && project.skills_required.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {project.skills_required.slice(0, 4).map((skill, i) => (
              <Badge key={i} variant="secondary" className="bg-teal-500/10 text-teal-300 border-teal-500/20 text-xs">
                {skill}
              </Badge>
            ))}
            {project.skills_required.length > 4 && (
              <Badge variant="secondary" className="bg-gray-700/30 text-gray-400 text-xs">
                +{project.skills_required.length - 4}
              </Badge>
            )}
          </div>
        )}

        {/* Deadline */}
        <div className="flex items-center gap-1 text-gray-500 text-xs">
          <Clock className="w-3 h-3" />
          <span>Deadline: {project.deadline}</span>
          {project.collaboration_type && (
            <>
              <span className="mx-1">·</span>
              <Layers className="w-3 h-3" />
              <span className="capitalize">{project.collaboration_type}</span>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-800"
            onClick={() => onViewProject && onViewProject(project)}
          >
            View Details
            <ChevronRight className="w-3 h-3 ml-1" />
          </Button>
          {!isOwnProject && currentUser?.user_type === 'freelancer' && project.status === 'open' && openRoles.length > 0 && (
            <Button
              size="sm"
              className="flex-1 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white"
              onClick={() => onPlaceBid && onPlaceBid(project)}
            >
              <Briefcase className="w-3 h-3 mr-1" />
              Place Bid
            </Button>
          )}
          {isOwnProject && (
            <Button
              size="sm"
              variant="outline"
              className="flex-1 border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
              onClick={() => onViewProject && onViewProject(project)}
            >
              <Users className="w-3 h-3 mr-1" />
              View Bids
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ProjectCard;
