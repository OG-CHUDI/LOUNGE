import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, MessageCircle, Calendar, ChevronRight, Send } from 'lucide-react';
import { amaSessions, users } from '@/data/mockData';
import { Input } from '@/components/ui/input';

export default function AMAPage() {
  const navigate = useNavigate();
  const [question, setQuestion] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const currentAMA = amaSessions.find(a => !a.archived);
  const archive = amaSessions.filter(a => a.archived);
  const spotlightUser = currentAMA ? users.find(u => u.id === currentAMA.memberId) : null;

  const handleAsk = () => {
    if (!question.trim()) return;
    // TODO: Submit question to backend
    setSubmitted(true);
    setQuestion('');
    setTimeout(() => setSubmitted(false), 3000);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <button
        onClick={() => navigate('/learn')}
        className="flex items-center gap-2 text-[#8b7e7e] hover:text-[#eeeeee] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm">Back to Learning Lounge</span>
      </button>

      <div>
        <h2 className="font-display text-3xl font-bold text-[#eeeeee] mb-1">AMA Archive</h2>
        <p className="text-[#8b7e7e]">Ask the team anything. No question is too small.</p>
      </div>

      {/* Current Spotlight */}
      {currentAMA && spotlightUser && (
        <div className="bg-[#134f5c] rounded-2xl overflow-hidden lounge-shadow">
          <div className="relative h-48">
            <img
              src="/images/ama/spotlight.jpg"
              alt="AMA Spotlight"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#134f5c] via-[#134f5c]/40 to-transparent" />
            <div className="absolute bottom-4 left-6 flex items-center gap-4">
              <img
                src={spotlightUser.avatar}
                alt={spotlightUser.name}
                className="w-16 h-16 rounded-2xl border-3 border-[#134f5c] object-cover lounge-shadow-lg"
              />
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-rose-400 uppercase tracking-wider bg-rose-400/10 px-2 py-0.5 rounded-full">Today&apos;s Spotlight</span>
                </div>
                <h3 className="font-display text-2xl font-bold text-[#eeeeee]">{spotlightUser.name}</h3>
                <p className="text-sm text-[#8b7e7e]">{spotlightUser.role}</p>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="mb-5">
              <h4 className="text-sm font-medium text-[#8b7e7e] mb-3 uppercase tracking-wider">Teased Questions</h4>
              <div className="space-y-2">
                {currentAMA.teaserQuestions.map((q, i) => (
                  <div key={i} className="flex items-start gap-3 bg-[#0c343d]/40 rounded-xl p-3">
                    <MessageCircle className="w-4 h-4 text-[#1a7a8d] mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-[#eeeeee]">&ldquo;{q}&rdquo;</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Ask a question */}
            <div className="flex gap-2">
              <Input
                value={question}
                onChange={e => setQuestion(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAsk()}
                placeholder={`Ask ${spotlightUser.name} a question...`}
                className="bg-[#282828] border-[#8b7e7e]/20 text-[#eeeeee] placeholder:text-[#8b7e7e]"
              />
              <button
                onClick={handleAsk}
                className="px-4 py-2 rounded-xl bg-[#1a7a8d] text-[#eeeeee] hover:bg-[#1a7a8d]/80 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            {submitted && (
              <p className="text-sm text-emerald-400 mt-2 animate-fade-in">Question submitted!</p>
            )}
          </div>
        </div>
      )}

      {/* Archive Grid */}
      <div>
        <h3 className="font-display font-semibold text-[#eeeeee] mb-4">Past AMAs</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {archive.map(ama => {
            const member = users.find(u => u.id === ama.memberId);
            return (
              <div key={ama.id} className="bg-[#134f5c] rounded-2xl p-5 lounge-shadow hover-lift transition-all group cursor-pointer">
                <div className="flex items-center gap-3 mb-3">
                  <img
                    src={member?.avatar}
                    alt={member?.name}
                    className="w-12 h-12 rounded-xl object-cover"
                  />
                  <div>
                    <h4 className="font-display font-semibold text-[#eeeeee]">{member?.name}</h4>
                    <p className="text-xs text-[#8b7e7e]">{member?.role}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-[#8b7e7e] mb-3">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{new Date(ama.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>
                <div className="space-y-1.5">
                  {ama.teaserQuestions.slice(0, 2).map((q, i) => (
                    <p key={i} className="text-sm text-[#eeeeee]/70 truncate">&ldquo;{q}&rdquo;</p>
                  ))}
                </div>
                <div className="flex items-center gap-1 mt-3 text-[#1a7a8d] group-hover:text-[#22a0b8] transition-colors">
                  <span className="text-xs font-medium">View session</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
