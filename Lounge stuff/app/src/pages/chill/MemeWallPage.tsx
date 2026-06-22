import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Plus, ImageIcon, Smile, Frown, Flame, Heart } from 'lucide-react';
import { memePins as initialMemes, currentUser, users } from '@/data/mockData';
import type { MemePin } from '@/data/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const reactionEmojis = [
  { key: 'laugh', icon: Smile, label: 'Laugh' },
  { key: 'sad', icon: Frown, label: 'Sad' },
  { key: 'fire', icon: Flame, label: 'Fire' },
  { key: 'heart', icon: Heart, label: 'Love' },
];

export default function MemeWallPage() {
  const navigate = useNavigate();
  const [memes, setMemes] = useState<MemePin[]>(initialMemes);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newCaption, setNewCaption] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleAddPin = () => {
    if (!newImageUrl || !newCaption) return;
    const newPin: MemePin = {
      id: `m-${Date.now()}`,
      imageUrl: newImageUrl,
      caption: newCaption,
      posterId: currentUser.id,
      reactions: {},
      timestamp: new Date().toISOString(),
    };
    setMemes([newPin, ...memes]);
    setNewImageUrl('');
    setNewCaption('');
    setDialogOpen(false);
  };

  const handleReaction = (memeId: string, reactionKey: string) => {
    setMemes(prev => prev.map(m => {
      if (m.id !== memeId) return m;
      const current = m.reactions[reactionKey] || 0;
      return { ...m, reactions: { ...m.reactions, [reactionKey]: current + 1 } };
    }));
  };

  // Simple masonry: alternate between 2 column spans
  const getSpan = (index: number) => {
    return index % 3 === 0 ? 'md:col-span-2' : '';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/chill')}
          className="flex items-center gap-2 text-[#8b7e7e] hover:text-[#eeeeee] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back to Chill Lounge</span>
        </button>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1a7a8d] text-[#eeeeee] font-medium text-sm hover:bg-[#1a7a8d]/80 transition-colors">
              <Plus className="w-4 h-4" /> Add a pin
            </button>
          </DialogTrigger>
          <DialogContent className="bg-[#134f5c] border-[#8b7e7e]/20">
            <DialogHeader>
              <DialogTitle className="text-[#eeeeee] font-display">Pin a Meme</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <div className="border-2 border-dashed border-[#8b7e7e]/30 rounded-xl p-8 text-center">
                <ImageIcon className="w-8 h-8 text-[#8b7e7e] mx-auto mb-2" />
                <p className="text-sm text-[#8b7e7e]">Paste an image URL below</p>
              </div>
              <Input
                placeholder="https://example.com/meme.jpg"
                value={newImageUrl}
                onChange={e => setNewImageUrl(e.target.value)}
                className="bg-[#282828] border-[#8b7e7e]/20 text-[#eeeeee] placeholder:text-[#8b7e7e]"
              />
              <Input
                placeholder="Add a caption..."
                value={newCaption}
                onChange={e => setNewCaption(e.target.value)}
                className="bg-[#282828] border-[#8b7e7e]/20 text-[#eeeeee] placeholder:text-[#8b7e7e]"
              />
              <Button onClick={handleAddPin} className="w-full bg-[#1a7a8d] hover:bg-[#1a7a8d]/80 text-[#eeeeee]">
                Pin it!
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div>
        <h2 className="font-display text-3xl font-bold text-[#eeeeee] mb-1">Meme Wall</h2>
        <p className="text-[#8b7e7e]">The team&apos;s collective sense of humour. Work-safe only!</p>
      </div>

      {memes.length === 0 ? (
        <div className="text-center py-20">
          <ImageIcon className="w-12 h-12 text-[#8b7e7e] mx-auto mb-4" />
          <p className="text-[#eeeeee] font-medium">No pins yet</p>
          <p className="text-sm text-[#8b7e7e] mt-1">Be the first to add a meme!</p>
        </div>
      ) : (
        <div className="columns-1 md:columns-2 lg:columns-3 gap-4 space-y-4">
          {memes.map((meme, index) => {
            const poster = users.find(u => u.id === meme.posterId);
            return (
              <div
                key={meme.id}
                className={`break-inside-avoid bg-[#134f5c] rounded-2xl overflow-hidden lounge-shadow hover-lift transition-all ${getSpan(index)}`}
              >
                <img
                  src={meme.imageUrl}
                  alt={meme.caption}
                  className="w-full object-cover"
                  onError={e => {
                    (e.target as HTMLImageElement).src = '/images/memes/meme-1.jpg';
                  }}
                />
                <div className="p-4">
                  <p className="text-sm text-[#eeeeee] mb-3">{meme.caption}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {poster && (
                        <>
                          <img src={poster.avatar} alt={poster.name} className="w-6 h-6 rounded-full object-cover" />
                          <span className="text-xs text-[#8b7e7e]">{poster.name}</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {reactionEmojis.map(({ key, icon: Icon }) => {
                        const count = meme.reactions[key] || 0;
                        return (
                          <button
                            key={key}
                            onClick={() => handleReaction(meme.id, key)}
                            className="flex items-center gap-1 px-2 py-1 rounded-full bg-[#0c343d]/50 hover:bg-[#0c343d] transition-colors"
                          >
                            <Icon className="w-3.5 h-3.5 text-[#8b7e7e]" />
                            {count > 0 && <span className="text-[11px] text-[#eeeeee]">{count}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
