import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Users, Search, PlusCircle, UserPlus } from 'lucide-react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const TeamsPage = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [teams, setTeams] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Create Team form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamSkills, setNewTeamSkills] = useState('');

  const fetchTeams = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/teams`);
      setTeams(res.data);
    } catch (error) {
      console.error('Error fetching teams', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUser = async () => {
    try {
      const token = localStorage.getItem('firebase_token');
      if (token) {
        const res = await axios.post(`${BACKEND_URL}/api/auth/firebase/verify`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setCurrentUser(res.data.user);
      }
    } catch (error) {
      console.error('Error fetching user', error);
    }
  };

  useEffect(() => {
    fetchTeams();
    fetchUser();
  }, []);

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    if (!currentUser) return alert('Please login first');
    
    try {
      const token = localStorage.getItem('firebase_token');
      const skillsArray = newTeamSkills.split(',').map(s => s.trim()).filter(s => s);
      
      const res = await axios.post(`${BACKEND_URL}/api/teams`, {
        name: newTeamName,
        required_skills: skillsArray
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setTeams([...teams, res.data]);
      setShowCreateForm(false);
      setNewTeamName('');
      setNewTeamSkills('');
      alert('Team created successfully!');
    } catch (error) {
      console.error('Failed to create team', error);
      alert('Failed to create team');
    }
  };

  const handleJoinTeam = async (teamId) => {
    if (!currentUser) return alert('Please login first');
    // Implement API call to join team
    // For now we just mock an alert
    alert("Join request sent to the team leader! (This would trigger a notification in a full implementation.)");
  };

  const filteredTeams = teams.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.required_skills?.some(s => s.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-gray-950 pt-24 pb-12">
      <div className="container mx-auto px-6 max-w-6xl">
        <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2 flex items-center">
              <Users className="w-8 h-8 mr-3 text-teal-400" />
              Freelancer Teams
            </h1>
            <p className="text-gray-400">Find partners with complementary skills for large projects</p>
          </div>
          {currentUser?.user_type === 'freelancer' && (
            <Button 
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              {showCreateForm ? 'Cancel' : <><PlusCircle className="w-4 h-4 mr-2" /> Create Team</>}
            </Button>
          )}
        </div>

        {showCreateForm && (
          <Card className="bg-gray-900 border-teal-500/50 mb-8">
            <CardHeader>
              <CardTitle className="text-white">Create a New Team</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateTeam} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-gray-300">Team Name</Label>
                    <Input 
                      required
                      value={newTeamName}
                      onChange={e => setNewTeamName(e.target.value)}
                      placeholder="e.g. Pixel Pioneers"
                      className="bg-gray-950 border-gray-700 text-white focus:border-teal-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-300">Required Skills (comma separated)</Label>
                    <Input 
                      required
                      value={newTeamSkills}
                      onChange={e => setNewTeamSkills(e.target.value)}
                      placeholder="e.g. React, Node.js, UI/UX"
                      className="bg-gray-950 border-gray-700 text-white focus:border-teal-500"
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full bg-teal-600 hover:bg-teal-700 text-white">
                  Form Team
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="relative mb-8 max-w-xl">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <Input
            placeholder="Search teams by name or skills..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-gray-900 border-gray-800 text-white focus:border-teal-500"
          />
        </div>

        {isLoading ? (
          <div className="text-center text-gray-500 py-12">Loading teams...</div>
        ) : filteredTeams.length === 0 ? (
          <div className="text-center text-gray-500 py-12 bg-gray-900/50 rounded-xl border border-gray-800">
            No teams found matching your search.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTeams.map(team => (
              <Card key={team.id} className="bg-gray-900 border-gray-800 hover:border-gray-700 transition">
                <CardHeader className="pb-3 border-b border-gray-800">
                  <CardTitle className="text-white text-lg">{team.name}</CardTitle>
                  <CardDescription className="text-gray-400">
                    Leader: <span className="text-teal-400">{team.leader_name}</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  <div>
                    <h4 className="text-xs text-gray-500 uppercase font-semibold mb-2">Looking For Skills:</h4>
                    <div className="flex flex-wrap gap-2">
                      {team.required_skills?.map((skill, i) => (
                        <Badge key={i} variant="outline" className="bg-gray-800 border-gray-700 text-gray-300">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-sm text-gray-400">
                    <span className="flex items-center"><Users className="w-4 h-4 mr-1" /> {team.members?.length || 1} Members</span>
                  </div>
                  {currentUser?.user_type === 'freelancer' && team.leader_id !== currentUser.id && (
                    <Button 
                      onClick={() => handleJoinTeam(team.id)}
                      className="w-full bg-gray-800 hover:bg-gray-700 text-white border border-gray-700"
                    >
                      <UserPlus className="w-4 h-4 mr-2" /> Request to Join
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamsPage;
