import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ChatInterface from './pages/ChatInterface';
import SettingsPage from './pages/Settings';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col">        
        <div className="flex-grow">
          <Routes>
            <Route path="/" element={<ChatInterface />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}
