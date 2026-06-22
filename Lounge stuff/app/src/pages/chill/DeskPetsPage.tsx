import { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  ArrowLeft,
  Sparkles,
  ChevronUp,
  Palette,
  Crown,
  Glasses,
  Wand2,
  Leaf,
  BookOpen,
  GraduationCap,
  Star,
} from 'lucide-react';
import { deskPets, currentUser, getUserPet, users } from '@/data/mockData';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

const stageIcons: Record<string, React.ElementType> = {
  egg: Sparkles,
  baby: Sparkles,
  teen: ChevronUp,
  adult: Crown,
  sage: Star,
};

const hatOptions = [
  { id: 'none', name: 'None', icon: null },
  { id: 'wizard', name: 'Wizard', icon: Wand2 },
  { id: 'crown', name: 'Crown', icon: Crown },
  { id: 'grad-cap', name: 'Grad Cap', icon: GraduationCap },
  { id: 'star', name: 'Star', icon: Star },
];

const accessoryOptions = [
  { id: 'none', name: 'None', icon: null },
  { id: 'glasses', name: 'Glasses', icon: Glasses },
  { id: 'bowtie', name: 'Bowtie', icon: Sparkles },
  { id: 'leaf', name: 'Leaf', icon: Leaf },
  { id: 'book', name: 'Book', icon: BookOpen },
  { id: 'wand', name: 'Wand', icon: Wand2 },
];

export default function DeskPetsPage() {
  const navigate = useNavigate();
  const myPet = getUserPet(currentUser.id);
  const [activeTab, setActiveTab] = useState('my-pet');
  const [selectedHat, setSelectedHat] = useState(myPet?.customizations.hat || 'none');
  const [selectedAccessory, setSelectedAccessory] = useState(myPet?.customizations.accessory || 'none');
  const [petXp, setPetXp] = useState(myPet?.xp || 0);

  if (!myPet) {
    return (
      <div className="space-y-6 animate-fade-in">
        <button onClick={() => navigate('/chill')} className="flex items-center gap-2 text-[#8b7e7e] hover:text-[#eeeeee]">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back</span>
        </button>
        <div className="text-center py-20 text-[#8b7e7e]">No pet found. Adopt one to get started!</div>
      </div>
    );
  }

  const StageIcon = stageIcons[myPet.stage] || Sparkles;
  const canLevelUp = petXp >= myPet.maxXp;

  const handleFeed = () => {
    setPetXp(prev => Math.min(prev + 50, myPet.maxXp + 200));
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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-[#134f5c]">
          <TabsTrigger value="my-pet" className="data-[state=active]:bg-[#1a7a8d]">My Pet</TabsTrigger>
          <TabsTrigger value="menagerie" className="data-[state=active]:bg-[#1a7a8d]">Team Menagerie</TabsTrigger>
        </TabsList>

        <TabsContent value="my-pet" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pet Display */}
            <div className="bg-[#134f5c] rounded-2xl p-8 lounge-shadow flex flex-col items-center">
              <div className="relative">
                <div className="w-48 h-48 rounded-3xl overflow-hidden border-4 border-[#1a7a8d] lounge-shadow-lg">
                  <img src={myPet.image} alt={myPet.name} className="w-full h-full object-cover" />
                </div>
                <div className="absolute -top-3 -right-3 bg-[#0c343d] rounded-full p-2 border-2 border-[#1a7a8d]">
                  <StageIcon className="w-5 h-5 text-amber-400" />
                </div>
                {/* Equipped items overlay */}
                {selectedHat !== 'none' && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#0c343d]/80 rounded-full px-2 py-0.5">
                    <span className="text-xs text-[#eeeeee] capitalize">{selectedHat}</span>
                  </div>
                )}
                {selectedAccessory !== 'none' && (
                  <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-[#0c343d]/80 rounded-full px-2 py-0.5">
                    <span className="text-xs text-[#eeeeee] capitalize">{selectedAccessory}</span>
                  </div>
                )}
              </div>

              <h3 className="font-display text-2xl font-bold text-[#eeeeee] mt-5">{myPet.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-[#8b7e7e] capitalize">{myPet.stage} stage</span>
                <span className="text-[#8b7e7e]">-</span>
                <span className="text-sm text-teal-300">Day 12 streak</span>
              </div>

              {/* XP Bar */}
              <div className="w-full mt-5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-[#8b7e7e]">XP Progress</span>
                  <span className="text-xs text-[#eeeeee]">{petXp} / {myPet.maxXp}</span>
                </div>
                <Progress value={Math.min((petXp / myPet.maxXp) * 100, 100)} className="h-3 bg-[#0c343d]" />
                {canLevelUp && (
                  <button
                    onClick={handleFeed}
                    className="mt-3 w-full py-2.5 rounded-xl bg-amber-500/20 text-amber-300 font-medium text-sm hover:bg-amber-500/30 transition-colors flex items-center justify-center gap-2"
                  >
                    <ChevronUp className="w-4 h-4" /> Level Up!
                  </button>
                )}
              </div>

              {/* Quick Actions */}
              <button
                onClick={handleFeed}
                className="mt-4 w-full py-2.5 rounded-xl bg-[#1a7a8d] text-[#eeeeee] font-medium text-sm hover:bg-[#1a7a8d]/80 transition-colors"
              >
                Feed Pet (+50 XP)
              </button>
            </div>

            {/* Customization */}
            <div className="space-y-4">
              <div className="bg-[#134f5c] rounded-2xl p-5 lounge-shadow">
                <div className="flex items-center gap-2 mb-4">
                  <Palette className="w-5 h-5 text-[#1a7a8d]" />
                  <h3 className="font-display font-semibold text-[#eeeeee]">Customisation</h3>
                </div>

                {/* Hats */}
                <div className="mb-4">
                  <p className="text-sm text-[#8b7e7e] mb-2">Hat</p>
                  <div className="flex flex-wrap gap-2">
                    {hatOptions.map(hat => (
                      <button
                        key={hat.id}
                        onClick={() => setSelectedHat(hat.id)}
                        className={`px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-1.5 ${
                          selectedHat === hat.id
                            ? 'bg-[#1a7a8d] text-[#eeeeee]'
                            : 'bg-[#0c343d]/50 text-[#8b7e7e] hover:bg-[#0c343d]'
                        }`}
                      >
                        {hat.icon && <hat.icon className="w-3.5 h-3.5" />}
                        {hat.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Accessories */}
                <div>
                  <p className="text-sm text-[#8b7e7e] mb-2">Accessory</p>
                  <div className="flex flex-wrap gap-2">
                    {accessoryOptions.map(acc => (
                      <button
                        key={acc.id}
                        onClick={() => setSelectedAccessory(acc.id)}
                        className={`px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-1.5 ${
                          selectedAccessory === acc.id
                            ? 'bg-[#1a7a8d] text-[#eeeeee]'
                            : 'bg-[#0c343d]/50 text-[#8b7e7e] hover:bg-[#0c343d]'
                        }`}
                      >
                        {acc.icon && <acc.icon className="w-3.5 h-3.5" />}
                        {acc.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Stats Card */}
              <div className="bg-[#134f5c] rounded-2xl p-5 lounge-shadow">
                <h3 className="font-display font-semibold text-[#eeeeee] mb-3">Stats</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#0c343d]/40 rounded-xl p-3 text-center">
                    <p className="text-2xl font-display font-bold text-[#eeeeee]">12</p>
                    <p className="text-xs text-[#8b7e7e]">Day Streak</p>
                  </div>
                  <div className="bg-[#0c343d]/40 rounded-xl p-3 text-center">
                    <p className="text-2xl font-display font-bold text-[#eeeeee]">{petXp}</p>
                    <p className="text-xs text-[#8b7e7e]">Total XP</p>
                  </div>
                  <div className="bg-[#0c343d]/40 rounded-xl p-3 text-center">
                    <p className="text-2xl font-display font-bold text-teal-300 capitalize">{myPet.stage}</p>
                    <p className="text-xs text-[#8b7e7e]">Growth Stage</p>
                  </div>
                  <div className="bg-[#0c343d]/40 rounded-xl p-3 text-center">
                    <p className="text-2xl font-display font-bold text-amber-400">#3</p>
                    <p className="text-xs text-[#8b7e7e]">Team Rank</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="menagerie" className="mt-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {deskPets.map(pet => {
              const owner = users.find(u => u.id === pet.ownerId);
              const PetStageIcon = stageIcons[pet.stage] || Sparkles;
              return (
                <div key={pet.id} className="bg-[#134f5c] rounded-2xl p-4 lounge-shadow hover-lift transition-all">
                  <div className="relative">
                    <img src={pet.image} alt={pet.name} className="w-full aspect-square rounded-xl object-cover" />
                    <div className="absolute top-2 right-2 bg-[#0c343d]/80 rounded-full p-1">
                      <PetStageIcon className="w-3.5 h-3.5 text-amber-400" />
                    </div>
                  </div>
                  <h4 className="font-display font-semibold text-[#eeeeee] mt-3">{pet.name}</h4>
                  <div className="flex items-center gap-1.5 mt-1">
                    {owner && <img src={owner.avatar} alt={owner.name} className="w-4 h-4 rounded-full" />}
                    <span className="text-xs text-[#8b7e7e]">{owner?.name}</span>
                  </div>
                  <div className="mt-2">
                    <Progress value={(pet.xp / pet.maxXp) * 100} className="h-1.5 bg-[#0c343d]" />
                  </div>
                  <p className="text-[10px] text-[#8b7e7e] mt-1 capitalize">{pet.stage} - {pet.xp} XP</p>
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
