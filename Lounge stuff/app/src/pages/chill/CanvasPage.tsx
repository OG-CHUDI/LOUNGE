import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, User, UserX } from 'lucide-react';
import { Tldraw } from 'tldraw';
import 'tldraw/tldraw.css';
import { users } from '@/data/mockData';
import { Switch } from '@/components/ui/switch';

export default function CanvasPage() {
  const navigate = useNavigate();
  const [anonymous, setAnonymous] = useState(false);

  // Mock presence avatars
  const presenceUsers = users.slice(1, 4);

  return (
    <div className="space-y-4 animate-fade-in h-[calc(100vh-100px)] flex flex-col">
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/chill')}
            className="flex items-center gap-2 text-[#8b7e7e] hover:text-[#eeeeee] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back to Chill Lounge</span>
          </button>
        </div>

        <div className="flex items-center gap-4">
          {/* Presence avatars */}
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {presenceUsers.map(u => (
                <img
                  key={u.id}
                  src={u.avatar}
                  alt={u.name}
                  className="w-8 h-8 rounded-full border-2 border-[#0c343d] object-cover"
                  title={u.name}
                />
              ))}
            </div>
            <span className="text-xs text-[#8b7e7e] ml-1">{presenceUsers.length} drawing</span>
          </div>

          {/* Anonymous toggle */}
          <div className="flex items-center gap-2 bg-[#134f5c] rounded-xl px-3 py-2">
            {anonymous ? <UserX className="w-4 h-4 text-[#8b7e7e]" /> : <User className="w-4 h-4 text-[#1a7a8d]" />}
            <span className="text-xs text-[#8b7e7e]">Anonymous</span>
            <Switch checked={anonymous} onCheckedChange={setAnonymous} />
          </div>
        </div>
      </div>

      <div className="flex-1 bg-[#0c343d] rounded-2xl overflow-hidden lounge-shadow relative min-h-0">
        <Tldraw className="tl-container" />
      </div>
    </div>
  );
}
