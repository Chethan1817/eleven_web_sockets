import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { fetchChatHistory } from '@/config';
import { useAuth } from '@/context/AuthContext';
// import { getHistoryId, getHistory } from '../app/services/users'; 
import moment from "moment"
interface SessionData {
  user: number;
  session_id: string;
  created_at: string;
}

interface Transcript {
  role: string;
  message: string;
}

interface ConversationData {
  transcript: Transcript[];
}
type Message = {
    role: string;
    content: string;
    timestamp: string;
    message_id: string;
    channel_message_id: string;
    in_reply_to: string | null;
  };
  
  type Conversation = {
    user_id: number; 
    conversation_id: number;
    channel_name: string;
    channel_id: string;
    started_at: string;
    messages: Message[];
  };
  

const ConversationHistory = () => {
      const { user, logout } = useAuth();
    
  
  const [expandedSession, setExpandedSession] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [chatHistory,setCharHistory]=useState<Conversation[]>([])
useEffect(()=>{
  (async()=>{
  try{
  const response:Conversation[]=await fetchChatHistory(user?.id)

 const data:Conversation[]=response.sort(
    (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
  );
setCharHistory(data)
setLoading(false)
  }catch(err){
    console.log(err)
    setError(err.message)
    setLoading(false)
  }})()

},[])

  const handleSessionClick = async (sessionId: number) => {
    if (expandedSession === sessionId) {
      setExpandedSession(null);
    } else {
      setExpandedSession(sessionId);
      
    }
  };



  if (loading) {
    return (
      <div className="flex justify-center items-center h-64 min-h-[400px]">
        <p className="text-gray-500">Loading conversations...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="w-full px-4 sm:px-6 max-h-[420px] overflow-y-auto  ">
      <h2 className="text-2xl font-semibold mb-6 ">Conversation History</h2>
      <div className="space-y-3">
        {
        chatHistory?.map((session) => (
          <div 
            key={session.conversation_id} 
            className="bg-white border rounded-lg overflow-hidden"
          >
            <button 
              className="w-full p-4 cursor-pointer flex justify-between items-center hover:bg-gray-50 text-left"
              onClick={() => handleSessionClick(session.conversation_id)}
            >
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <span>{moment(session?.started_at,).format("dddd, MMMM D, YYYY h:mm")}</span>
                {/* <span>{formatDateTime(session.conversation_id).formattedTime}</span> */}
              </div>
              {expandedSession === session.conversation_id ? 
                <ChevronUp className="h-5 w-5 text-gray-400 flex-shrink-0" /> : 
                <ChevronDown className="h-5 w-5 text-gray-400 flex-shrink-0" />
              }
            </button>
            
            {expandedSession === session.conversation_id && (
              <div className="border-t p-4 space-y-3">
               
              {session?.messages.map((val,idx)=> <div 
                        key={idx} 
                        className={`p-3 rounded-lg ${
                          val.role === 'sarah' 
                            ? 'bg-blue-50 text-blue-800' 
                            : 'bg-gray-50 text-gray-800'
                        }`}
                      >
                        {val.content}
                      </div>)}
               
              </div>
            )}
          </div>
        ))}
        
        {chatHistory.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No conversations found
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(ConversationHistory);