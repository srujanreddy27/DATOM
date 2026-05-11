import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Send, User, MessageCircle } from 'lucide-react';

const ChatWindow = ({ messages = [], currentUser, recipientName, onSendMessage }) => {
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    onSendMessage(newMessage);
    setNewMessage('');
  };

  if (!currentUser) return <div>Please log in to use chat.</div>;

  return (
    <div className="flex flex-col h-full w-full bg-gray-900 border-none rounded-r-xl">
      <div className="py-4 px-6 border-b border-gray-800 flex flex-row items-center gap-3">
        <Avatar className="w-10 h-10 border border-gray-700">
          <AvatarFallback className="bg-teal-500/20 text-teal-400">
            {recipientName ? recipientName.charAt(0).toUpperCase() : <User className="w-5 h-5"/>}
          </AvatarFallback>
        </Avatar>
        <div>
          <CardTitle className="text-lg text-white font-medium">{recipientName || 'Negotiation Chat'}</CardTitle>
          <CardDescription className="text-gray-400 text-sm flex items-center gap-2 mt-1">
            <span className="w-2 h-2 rounded-full bg-green-500"></span> Online
          </CardDescription>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 h-full flex items-center justify-center flex-col gap-2">
            <MessageCircle className="w-12 h-12 text-gray-700 mx-auto" />
            <p>No messages yet. Say hello!</p>
          </div>
        ) : (
          messages.map(msg => {
            const isMe = msg.sender_id === currentUser.id;
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div 
                  className={`max-w-[75%] px-4 py-3 rounded-2xl 
                    ${isMe 
                      ? 'bg-teal-600/90 text-white rounded-tr-sm shadow-sm' 
                      : 'bg-gray-800 text-gray-200 border border-gray-700/50 rounded-tl-sm shadow-sm'
                    }`}
                >
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                  <span className={`text-[10px] mt-2 block ${isMe ? 'text-teal-100/70 text-right' : 'text-gray-500'}`}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-gray-800 bg-gray-950/50 rounded-br-xl">
        <form onSubmit={handleSend} className="flex gap-3">
          <Input 
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-gray-900 border-gray-700 text-white focus-visible:ring-teal-500 rounded-lg p-3"
          />
          <Button 
            type="submit" 
            disabled={!newMessage.trim()} 
            className="bg-teal-600 hover:bg-teal-700 text-white rounded-lg px-6"
          >
            <Send className="w-5 h-5" />
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ChatWindow;
