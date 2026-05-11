import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Avatar, AvatarFallback } from './ui/avatar';
import { ScrollArea } from './ui/scroll-area';
import { Send, MessageSquare, ArrowLeft, Crown } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const MessagesPage = () => {
  const { username: activeUsername } = useParams();
  const navigate = useNavigate();
  
  const [currentUser, setCurrentUser] = useState(null);
  const [inbox, setInbox] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoadingInbox, setIsLoadingInbox] = useState(true);
  
  const bottomRef = useRef(null);
  const pollingRef = useRef(null);

  const getAuthHeader = () => ({
    headers: { 'Authorization': `Bearer ${localStorage.getItem('firebase_token')}` }
  });

  // Fetch Inbox
  const fetchInbox = async () => {
    try {
      const res = await axios.get(`${API}/chat/inbox`, getAuthHeader());
      setInbox(res.data);
    } catch (err) {
      console.error('Failed to load inbox:', err);
    } finally {
      setIsLoadingInbox(false);
    }
  };

  // Fetch Current User
  const fetchCurrentUser = async () => {
    try {
      const res = await axios.get(`${API}/auth/me`, getAuthHeader());
      setCurrentUser(res.data);
    } catch (err) {
      console.error('Failed to load current user:', err);
    }
  };

  // Fetch Message Thread
  const fetchMessages = async () => {
    if (!activeUsername) return;
    try {
      const res = await axios.get(`${API}/chat/messages/${activeUsername}`, getAuthHeader());
      setMessages(res.data || []);
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
    fetchInbox();
    if (activeUsername) {
      fetchMessages();
      pollingRef.current = setInterval(() => {
        fetchMessages();
        fetchInbox();
      }, 3000);
    }
    return () => clearInterval(pollingRef.current);
  }, [activeUsername]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || isSending || !activeUsername) return;
    
    setIsSending(true);
    try {
      await axios.post(`${API}/chat/messages`, {
        receiver_username: activeUsername,
        content: newMessage.trim()
      }, getAuthHeader());
      setNewMessage('');
      await fetchMessages();
      await fetchInbox();
    } catch (err) {
      alert('Failed to send message: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsSending(false);
    }
  };

  if (!currentUser && !isLoadingInbox) {
    return (
      <div className="min-h-screen bg-gray-950 pt-20 flex items-center justify-center">
        <p className="text-gray-400">Please log in to view messages.</p>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-80px)] bg-gray-950 pt-20 pb-0 flex flex-col md:flex-row max-w-7xl mx-auto h-screen overflow-hidden">
      
      {/* Sidebar - Inbox */}
      <div className={`w-full md:w-80 lg:w-96 border-r border-gray-800 bg-gray-900/40 flex flex-col h-full bg-clip-padding shrink-0 ${activeUsername ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center">
            <MessageSquare className="w-5 h-5 mr-2 text-teal-400" />
            Messages
          </h2>
        </div>
        
        <ScrollArea className="flex-1">
          {isLoadingInbox ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-teal-400 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : inbox.length === 0 ? (
            <div className="text-center py-12 px-4">
              <MessageSquare className="w-10 h-10 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-400 font-medium">No messages yet</p>
              <p className="text-gray-600 text-sm mt-1">Start a conversation from the task board or suggestions.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800/60">
              {inbox.map((chat) => (
                <div
                  key={chat.contact_id}
                  onClick={() => navigate(`/messages/${chat.contact_username}`)}
                  className={`p-4 cursor-pointer transition-colors flex items-start gap-3 hover:bg-gray-800/60 ${
                    activeUsername === chat.contact_username ? 'bg-gray-800/80 border-l-2 border-teal-500' : 'border-l-2 border-transparent'
                  }`}
                >
                  <Avatar className="w-10 h-10 mt-0.5 shrink-0 border border-gray-700">
                    <AvatarFallback className={chat.is_premium ? 'bg-gradient-to-br from-amber-400 to-yellow-600 text-gray-900 font-bold' : 'bg-gray-700 text-white font-medium'}>
                      {chat.contact_username.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 pr-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className={`text-sm font-semibold truncate flex items-center gap-1 ${chat.is_premium ? 'text-amber-400' : 'text-gray-200'}`}>
                        {chat.contact_username}
                        {chat.is_premium && <Crown className="w-3 h-3 text-amber-500 fill-amber-500" />}
                      </h4>
                      <span className="text-[10px] text-gray-500 whitespace-nowrap">
                        {new Date(chat.last_timestamp).toLocaleDateString() === new Date().toLocaleDateString() 
                          ? new Date(chat.last_timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : new Date(chat.last_timestamp).toLocaleDateString([], { month: 'short', day: 'numeric'})}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 truncate pr-2">{chat.last_message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className={`flex-1 flex flex-col h-full bg-gray-950 ${!activeUsername ? 'hidden md:flex' : 'flex'}`}>
        {!activeUsername ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 bg-gray-900 rounded-full flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8 text-gray-700" />
            </div>
            <h3 className="text-xl font-semibold text-gray-300 mb-2">Your Messages</h3>
            <p className="text-gray-500 max-w-sm">Select a conversation from the sidebar to view your message history or start a new chat.</p>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="h-16 px-4 border-b border-gray-800 bg-gray-900/20 flex items-center shrink-0">
              <Button variant="ghost" size="icon" onClick={() => navigate('/messages')} className="md:hidden mr-2 text-gray-400 hover:text-white">
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-3">
                <Avatar className="w-9 h-9 border border-gray-700">
                  <AvatarFallback className="bg-gray-700 text-white font-medium">
                    {activeUsername.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold text-white">{activeUsername}</h3>
                </div>
              </div>
            </div>

            {/* Messages List */}
            <ScrollArea className="flex-1 p-4 bg-gray-950/80">
              <div className="space-y-4 max-w-3xl mx-auto flex flex-col justify-end min-h-full">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center my-12 text-center">
                    <p className="text-gray-500 text-sm">No messages yet</p>
                    <p className="text-gray-600 text-xs mt-1">Send a message to start negotiating with {activeUsername}</p>
                  </div>
                ) : (
                  messages.map((msg, i) => {
                    const isMe = msg.sender_id === currentUser?.id;
                    const msgContent = msg.content || msg.message;
                    return (
                      <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] md:max-w-[65%] ${isMe ? 'order-2' : 'order-1'}`}>
                          <div className={`px-4 py-2.5 rounded-2xl ${
                            isMe
                              ? 'bg-gradient-to-br from-teal-600 to-cyan-700 text-white rounded-tr-none shadow-md shadow-teal-900/20'
                              : 'bg-gray-800/80 border border-gray-700 text-gray-200 rounded-tl-none'
                          }`}>
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{msgContent}</p>
                          </div>
                          <p className={`text-[10px] text-gray-600 mt-1 mx-1 ${isMe ? 'text-right' : 'text-left'}`}>
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={bottomRef} />
              </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="p-4 bg-gray-900/40 border-t border-gray-800 shrink-0">
              <form onSubmit={sendMessage} className="max-w-3xl mx-auto flex items-end gap-2">
                <Input
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  placeholder={`Message ${activeUsername}...`}
                  className="flex-1 bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-teal-500 h-11 pb-2 shadow-inner"
                  disabled={isSending}
                  autoComplete="off"
                />
                <Button
                  type="submit"
                  disabled={isSending || !newMessage.trim()}
                  className="bg-teal-600 hover:bg-teal-700 text-white h-11 px-6 px-4 shadow-lg shadow-teal-900/40"
                >
                  <Send className="w-4 h-4 md:mr-2" />
                  <span className="hidden md:inline">Send</span>
                </Button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default MessagesPage;
