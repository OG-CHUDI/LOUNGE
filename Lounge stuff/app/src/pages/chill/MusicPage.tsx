import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, ExternalLink, Plus, Headphones } from 'lucide-react';
import { playlists, users } from '@/data/mockData';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function MusicPage() {
  const navigate = useNavigate();
  const [teamPlaylists, setTeamPlaylists] = useState(playlists);
  const [newUrl, setNewUrl] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [selectedPlaylist, setSelectedPlaylist] = useState(teamPlaylists[0]);

  const listeningNow = users.filter(u => u.currentTrack);

  const handleAddPlaylist = () => {
    if (!newUrl || !newTitle) return;
    const curator = users[Math.floor(Math.random() * users.length)];
    const playlist: typeof teamPlaylists[0] = {
      id: `pl-${Date.now()}`,
      title: newTitle,
      cover: '/images/playlists/lofi-focus.jpg',
      curatorId: curator.id,
      spotifyUrl: newUrl,
      trackCount: Math.floor(Math.random() * 50) + 10,
    };
    setTeamPlaylists([...teamPlaylists, playlist]);
    setNewUrl('');
    setNewTitle('');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <button
        onClick={() => navigate('/chill')}
        className="flex items-center gap-2 text-[#8b7e7e] hover:text-[#eeeeee] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm">Back to Chill Lounge</span>
      </button>

      <div>
        <h2 className="font-display text-3xl font-bold text-[#eeeeee] mb-1">Music</h2>
        <p className="text-[#8b7e7e]">Team playlists and what everyone is listening to.</p>
      </div>

      {/* Now Listening */}
      <div className="bg-[#134f5c] rounded-2xl p-5 lounge-shadow">
        <div className="flex items-center gap-2 mb-4">
          <Headphones className="w-5 h-5 text-[#1a7a8d]" />
          <h3 className="font-display font-semibold text-[#eeeeee]">Now listening across the team</h3>
        </div>
        <div className="flex flex-wrap gap-3">
          {listeningNow.map(user => (
            <div key={user.id} className="flex items-center gap-2.5 bg-[#0c343d]/50 rounded-xl px-3 py-2">
              <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full object-cover" />
              <div>
                <p className="text-xs font-medium text-[#eeeeee]">{user.name}</p>
                <p className="text-[11px] text-[#8b7e7e] truncate max-w-[160px]">{user.currentTrack}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Player */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-[#134f5c] rounded-2xl overflow-hidden lounge-shadow">
            <iframe
              src={selectedPlaylist.spotifyUrl}
              width="100%"
              height="380"
              frameBorder="0"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
              title={selectedPlaylist.title}
              className="bg-[#282828]"
            />
          </div>
        </div>

        {/* Team Playlists */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-semibold text-[#eeeeee]">Team Playlists</h3>
            <Dialog>
              <DialogTrigger asChild>
                <button className="p-2 rounded-lg bg-[#134f5c] text-[#8b7e7e] hover:text-[#eeeeee] transition-colors">
                  <Plus className="w-4 h-4" />
                </button>
              </DialogTrigger>
              <DialogContent className="bg-[#134f5c] border-[#8b7e7e]/20">
                <DialogHeader>
                  <DialogTitle className="text-[#eeeeee] font-display">Share a Playlist</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 mt-2">
                  <Input
                    placeholder="Playlist title"
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    className="bg-[#282828] border-[#8b7e7e]/20 text-[#eeeeee] placeholder:text-[#8b7e7e]"
                  />
                  <Input
                    placeholder="Paste Spotify embed URL..."
                    value={newUrl}
                    onChange={e => setNewUrl(e.target.value)}
                    className="bg-[#282828] border-[#8b7e7e]/20 text-[#eeeeee] placeholder:text-[#8b7e7e]"
                  />
                  <Button onClick={handleAddPlaylist} className="w-full bg-[#1a7a8d] hover:bg-[#1a7a8d]/80 text-[#eeeeee]">
                    Add Playlist
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-3">
            {teamPlaylists.map(pl => {
              const curator = users.find(u => u.id === pl.curatorId);
              return (
                <button
                  key={pl.id}
                  onClick={() => setSelectedPlaylist(pl)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${
                    selectedPlaylist.id === pl.id
                      ? 'bg-[#1a7a8d]/30 ring-1 ring-[#1a7a8d]'
                      : 'bg-[#134f5c]/60 hover:bg-[#134f5c]'
                  }`}
                >
                  <img src={pl.cover} alt={pl.title} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#eeeeee] truncate">{pl.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {curator && <img src={curator.avatar} alt={curator.name} className="w-4 h-4 rounded-full" />}
                      <span className="text-xs text-[#8b7e7e]">{pl.trackCount} tracks</span>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-[#8b7e7e] flex-shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
