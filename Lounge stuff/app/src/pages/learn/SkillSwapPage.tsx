import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Plus, Tag, ArrowRight } from 'lucide-react';
import { skillSwaps as initialSwaps, users } from '@/data/mockData';
import type { SkillSwap } from '@/data/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

const allTags = ['Design', 'Development', 'Figma', 'React', 'TypeScript', 'Leadership', 'Strategy', 'Feedback', 'Performance'];

export default function SkillSwapPage() {
  const navigate = useNavigate();
  const [swaps, setSwaps] = useState<SkillSwap[]>(initialSwaps);
  const [activeTag, setActiveTag] = useState('All');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newSkill, setNewSkill] = useState('');
  const [newBlurb, setNewBlurb] = useState('');
  const [newType, setNewType] = useState<'offering' | 'seeking'>('offering');
  const [newTags, setNewTags] = useState('');

  const offerings = swaps.filter(s => s.type === 'offering');
  const seekings = swaps.filter(s => s.type === 'seeking');

  const filterByTag = (items: SkillSwap[]) => {
    if (activeTag === 'All') return items;
    return items.filter(s => s.tags.includes(activeTag));
  };

  const handlePost = () => {
    if (!newSkill || !newBlurb) return;
    const swap: SkillSwap = {
      id: `s-${Date.now()}`,
      type: newType,
      userId: 'u1', // current user
      skill: newSkill,
      blurb: newBlurb,
      tags: newTags.split(',').map(t => t.trim()).filter(Boolean),
      timestamp: new Date().toISOString(),
    };
    setSwaps([...swaps, swap]);
    setNewSkill('');
    setNewBlurb('');
    setNewTags('');
    setDialogOpen(false);
  };

  const SwapCard = ({ swap }: { swap: SkillSwap }) => {
    const user = users.find(u => u.id === swap.userId);
    return (
      <div className="bg-[#134f5c] rounded-xl p-4 lounge-shadow-sm hover-lift transition-all">
        <div className="flex items-center gap-2 mb-2">
          {user && <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full object-cover" />}
          <div>
            <p className="text-sm font-medium text-[#eeeeee]">{user?.name}</p>
            <p className="text-xs text-[#8b7e7e]">{user?.role}</p>
          </div>
        </div>
        <h4 className="font-display font-semibold text-[#eeeeee] mb-1">{swap.skill}</h4>
        <p className="text-sm text-[#8b7e7e] mb-3">{swap.blurb}</p>
        <div className="flex items-center gap-1.5 flex-wrap">
          {swap.tags.map(tag => (
            <span key={tag} className="text-xs bg-[#0c343d]/50 text-[#8b7e7e] px-2 py-0.5 rounded-full">{tag}</span>
          ))}
        </div>
        <button className="mt-3 text-xs text-[#1a7a8d] hover:text-[#22a0b8] transition-colors font-medium flex items-center gap-1">
          Set up a swap <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/learn')}
          className="flex items-center gap-2 text-[#8b7e7e] hover:text-[#eeeeee] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back to Learning Lounge</span>
        </button>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1a7a8d] text-[#eeeeee] font-medium text-sm hover:bg-[#1a7a8d]/80 transition-colors">
              <Plus className="w-4 h-4" /> Post a skill
            </button>
          </DialogTrigger>
          <DialogContent className="bg-[#134f5c] border-[#8b7e7e]/20">
            <DialogHeader>
              <DialogTitle className="text-[#eeeeee] font-display">Post a Skill</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <div className="flex gap-2">
                <button
                  onClick={() => setNewType('offering')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    newType === 'offering' ? 'bg-[#1a7a8d] text-[#eeeeee]' : 'bg-[#0c343d] text-[#8b7e7e]'
                  }`}
                >
                  Offering
                </button>
                <button
                  onClick={() => setNewType('seeking')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    newType === 'seeking' ? 'bg-[#1a7a8d] text-[#eeeeee]' : 'bg-[#0c343d] text-[#8b7e7e]'
                  }`}
                >
                  Seeking
                </button>
              </div>
              <Input
                placeholder="Skill name (e.g., Figma Prototyping)"
                value={newSkill}
                onChange={e => setNewSkill(e.target.value)}
                className="bg-[#282828] border-[#8b7e7e]/20 text-[#eeeeee] placeholder:text-[#8b7e7e]"
              />
              <Textarea
                placeholder="Describe what you are offering or seeking..."
                value={newBlurb}
                onChange={e => setNewBlurb(e.target.value)}
                className="bg-[#282828] border-[#8b7e7e]/20 text-[#eeeeee] placeholder:text-[#8b7e7e]"
              />
              <Input
                placeholder="Tags (comma separated)"
                value={newTags}
                onChange={e => setNewTags(e.target.value)}
                className="bg-[#282828] border-[#8b7e7e]/20 text-[#eeeeee] placeholder:text-[#8b7e7e]"
              />
              <Button onClick={handlePost} className="w-full bg-[#1a7a8d] hover:bg-[#1a7a8d]/80 text-[#eeeeee]">
                Post
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div>
        <h2 className="font-display text-3xl font-bold text-[#eeeeee] mb-1">Skill Swap Board</h2>
        <p className="text-[#8b7e7e]">Teach what you know. Learn what you don&apos;t.</p>
      </div>

      {/* Tag Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Tag className="w-4 h-4 text-[#8b7e7e]" />
        <button
          onClick={() => setActiveTag('All')}
          className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
            activeTag === 'All' ? 'bg-[#1a7a8d] text-[#eeeeee]' : 'bg-[#134f5c] text-[#8b7e7e] hover:text-[#eeeeee]'
          }`}
        >
          All
        </button>
        {allTags.map(tag => (
          <button
            key={tag}
            onClick={() => setActiveTag(tag)}
            className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
              activeTag === tag ? 'bg-[#1a7a8d] text-[#eeeeee]' : 'bg-[#134f5c] text-[#8b7e7e] hover:text-[#eeeeee]'
            }`}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Two Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Offering */}
        <div>
          <h3 className="font-display font-semibold text-[#eeeeee] mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            Offering ({filterByTag(offerings).length})
          </h3>
          <div className="space-y-3">
            {filterByTag(offerings).map(swap => (
              <SwapCard key={swap.id} swap={swap} />
            ))}
            {filterByTag(offerings).length === 0 && (
              <p className="text-sm text-[#8b7e7e] py-4 text-center">No offerings match this filter.</p>
            )}
          </div>
        </div>

        {/* Seeking */}
        <div>
          <h3 className="font-display font-semibold text-[#eeeeee] mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            Seeking ({filterByTag(seekings).length})
          </h3>
          <div className="space-y-3">
            {filterByTag(seekings).map(swap => (
              <SwapCard key={swap.id} swap={swap} />
            ))}
            {filterByTag(seekings).length === 0 && (
              <p className="text-sm text-[#8b7e7e] py-4 text-center">No requests match this filter.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
