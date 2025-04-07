"use client";
import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Send, Mic, MicOff, Volume2, Paperclip } from 'lucide-react';
import { cn } from "@/lib/utils";
import { addMessage } from '@/config';
import { useAuth } from '@/context/AuthContext';
// import { apiPostService } from "@/app/services/helpers";
interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  audioUrl?: string; // For audio messages
  isAudio?: boolean;
}
// interface AssistantResponse {
//   status: boolean;
//   message: string;
//   bot_response: any;
//   audio_response?: string;
//   transcribed_text?: string;
//   response_type: 'text' | 'voice';
// }
// Interfaces for TypeScript error fixes
interface ToolCall {
  function?: {
    name: string;
    arguments: string;
  };
}
interface FunctionMessage {
  tool_calls?: ToolCall[];
}
const WhatsAppChat = () => {
         const { user } = useAuth();
   
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Audio recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  // Get UID from localStorage
  const getUserId = () => {
    const id = localStorage.getItem('id');
    if (!id) {
      throw new Error('User ID not found in localStorage');
    }
    return id;
  };
  
 
  const handleSendMessage = async () => {
    if (inputMessage.trim() === '' || isProcessing) return;
    
    setIsProcessing(true);
    try {
      
      // Add user message to chat
      const userMessage: Message = {
        id: Date.now().toString(),
        text: inputMessage,
        isUser: true,
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, userMessage]);
      
    //   Send to text_assistant endpoint
      const response=await addMessage(inputMessage,user?.id)

      
    //   Extract the bot response text
    //   Extract the bot response text
      let botResponseText = '';
      if (response.bot_response) {
        // Check if bot_response is a simple string
        if (typeof response.bot_response === 'string') {
          botResponseText = response.bot_response;
        }
        // Check if bot_response has a response property
        else if (response.bot_response.response) {
          botResponseText = response.bot_response.response;
        } else {
          // Extract content from assistant_message if present
          // This is likely where your issue is occurring - when response.bot_response contains the entire JSON
          try {
            // Try to parse as JSON if it's a string representation of JSON
            const botResponse = typeof response.bot_response === 'string' 
              ? JSON.parse(response.bot_response)
              : response.bot_response;
              
            // Look for assistant_message type messages
            if (botResponse.messages && Array.isArray(botResponse.messages)) {
              for (const msg of botResponse.messages) {
                if (msg.message_type === 'assistant_message' && msg.content) {
                  botResponseText = msg.content;
                  break;
                }
              }
            }
            
            // If still no text found, use a default
            if (!botResponseText) {
              botResponseText = "I received your message but couldn't generate a proper response.";
            }
          } catch (e) {
            console.error('Error parsing bot response:', e);
            botResponseText = "Received a response but couldn't process it correctly.";
          }
        }
      }
      
      // Add bot response to chat
      const botResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: botResponseText || "I received your message but couldn't generate a response.",
        isUser: false,
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, botResponse]);
      setInputMessage('');
      
    } catch (error) {
      console.error('Error sending message:', error);
      // Add error message
      const errorMessage: Message = {
        id: Date.now().toString(),
        text: "Error sending message. Please try again.",
        isUser: false,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

    }
  };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  // useEffect(() => {
  //   messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  // }, [messages]);
  useEffect(() => {
    if (messages.length === 0) {
      const userName = localStorage.getItem('user_name') || 'there';
      
      const welcomeMessage: Message = {
        id: 'welcome',
        text: `Hi ${userName}, How can I help you today!`,
        isUser: false,
        timestamp: new Date(),
      };
      setMessages([welcomeMessage]);
    }
  }, []);
  return (
    <div className="flex flex-col min-h-[450px] max-h-[450px]">
      <CardHeader className="border-b pb-2c">
        <CardTitle className="text-xl font-semibold flex justify-center">
           WhatsApp
        </CardTitle>
      </CardHeader>
      
      <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50 "  >
        {messages.map((message) => (
          <div 
            key={message.id} 
            className={cn(
              "flex",
              message.isUser ? "justify-end" : "justify-start"
            )}
          >
            <div 
              className={cn(
                "max-w-[80%] rounded-lg p-2 shadow-sm text-sm",
                message.isUser 
                  ? "bg-green-500 text-white rounded-tr-none"
                  : "bg-white rounded-tl-none"
              )}
            >
              {message.isAudio ? (
                <div className="flex items-center gap-2">
                  <audio
                    controls
                    src={message.audioUrl}
                    className="max-w-full h-6"
                  />
                  <span className="text-xs">Audio message</span>
                </div>
              ) : (
                <div>{message.text}</div>
              )}
              <div className="text-xs mt-1 opacity-75 text-right">
                {message.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </div>
            </div>
            
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="p-3 border-t ">
        <div className="flex gap-1 items-center">
          {/* <Button 
            variant="ghost" 
            size="icon"
            className="flex-shrink-0 text-gray-500 h-8 w-8 p-1"
            disabled={isProcessing}
          >
            <Paperclip className="h-4 w-4" />
          </Button> */}
          
          <div className="flex-1 relative">
            <textarea
              className="w-full rounded-md border border-gray-300 shadow-sm focus:border-primary focus:ring-1 focus:ring-primary min-h-[36px] max-h-[100px] px-2 py-1 text-sm"
              placeholder={isRecording ? "Recording..." : (isProcessing ? "Processing..." : "Type a message...")}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={isRecording || isProcessing}
              style={{ resize: 'none' }}
            />
          </div>
          
          {/* {isRecording ? (
            <>
              <Button 
                variant="ghost" 
                size="icon"
                className="flex-shrink-0 text-red-500 h-8 w-8 p-1"
                onClick={toggleRecording}
                disabled={isProcessing}
              >
                <MicOff className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <> */}
              {/* <Button 
                variant="ghost" 
                size="icon"
                className="flex-shrink-0 text-gray-500 h-8 w-8 p-1"
                onClick={toggleRecording}
                disabled={isProcessing}
              >
                <Mic className="h-4 w-4" />
              </Button> */}
              
              <Button 
                variant="default" 
                size="icon"
                className="flex-shrink-0 rounded-full h-8 w-8 p-1"
                onClick={handleSendMessage}
                disabled={inputMessage.trim() === ''}
              >
                <Send className="h-4 w-4" />
              </Button>
            {/* </> */}
          {/* )} */}
        </div>
        
        {/* Recording/Processing indicator */}
        {(isRecording || isProcessing) && (
          <div className="mt-1 text-center text-xs text-red-500 animate-pulse">
            {isRecording ? "Recording audio..." : "Processing..."}
          </div>
        )}
      </div>
    </div>
  );
};
export default WhatsAppChat;