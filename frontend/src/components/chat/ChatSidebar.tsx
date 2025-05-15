import { Plus, User, Settings, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type Chat = {
  id: number;
  title: string;
  active: boolean;
};

interface ChatSidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
  chats: Chat[];
  createNewChat: () => void;
  selectChat: (id: number) => void;
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({ isOpen, toggleSidebar, chats, createNewChat, selectChat }) => {
  const navigate = useNavigate();
  return (
    <>
      <div className={`bg-gray-900 text-white transition-all duration-300 ease-in-out flex flex-col h-full ${isOpen ? 'w-64' : 'w-0 overflow-hidden'}`}>
        <div className="flex flex-left items-center p-4 border-b border-gray-700">
          <h2 className="font-bold text-xl">Chats</h2>
          <button 
            onClick={createNewChat}
            className="p-1 rounded-md hover:bg-gray-700 ml-2 mt-1"
          >
            <Plus size={16} />
          </button>
        </div>
        
        <div className="overflow-y-auto flex-grow">
          {chats.map(chat => (
            <div 
              key={chat.id}
              onClick={() => selectChat(chat.id)}
              className={`px-4 py-3 cursor-pointer hover:bg-gray-800 ${chat.active ? 'bg-gray-800' : ''}`}
            >
              {chat.title}
            </div>
          ))}
        </div>
        
        <div className="mt-auto border-t border-gray-700 p-2 flex justify-around">
          <button className="p-2 rounded-md hover:bg-gray-800">
            <User size={20} />
          </button>
          <button className="p-2 rounded-md hover:bg-gray-800"
            onClick={() => navigate('/settings')}>
            <Settings size={20} />
          </button>
        </div>
      </div>

      <button 
        onClick={toggleSidebar}
        className={`absolute top-4 ${isOpen ? 'left-56 rounded-l-lg p-2' : 'left-0 rounded-r-lg p-1'} bg-gray-800 text-white z-10 transition-all duration-300 ease-in-out`}
      >
        {isOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </button>
    </>
  );
};

export default ChatSidebar;
