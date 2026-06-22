import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Clock, BookOpen, Filter } from 'lucide-react';
import { courses, users } from '@/data/mockData';
import { Progress } from '@/components/ui/progress';

const categories = ['All', 'Design', 'Development', 'Animation', 'Research'];

export default function CoursesPage() {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState('All');

  const filtered = activeCategory === 'All'
    ? courses
    : courses.filter(c => c.category === activeCategory);

  const inProgress = courses.filter(c => c.progress > 0 && c.progress < 100);

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
        <h2 className="font-display text-3xl font-bold text-[#eeeeee] mb-1">Mini-Courses</h2>
        <p className="text-[#8b7e7e]">Bite-sized learning from the team.</p>
      </div>

      {/* Continue Learning Rail */}
      {inProgress.length > 0 && (
        <div className="bg-[#134f5c] rounded-2xl p-5 lounge-shadow">
          <h3 className="font-display font-semibold text-[#eeeeee] mb-4">Continue Learning</h3>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {inProgress.map(course => {
              const instructor = users.find(u => u.name === course.instructor);
              return (
                <div key={course.id} className="flex-shrink-0 w-64 bg-[#0c343d]/40 rounded-xl p-3">
                  <img src={course.cover} alt={course.title} className="w-full h-28 rounded-lg object-cover mb-2" />
                  <h4 className="text-sm font-medium text-[#eeeeee] truncate">{course.title}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    {instructor && <img src={instructor.avatar} alt={instructor.name} className="w-4 h-4 rounded-full" />}
                    <span className="text-xs text-[#8b7e7e]">{course.progress}% complete</span>
                  </div>
                  <Progress value={course.progress} className="h-1.5 mt-2 bg-[#0c343d]" />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-[#8b7e7e]" />
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
              activeCategory === cat
                ? 'bg-[#1a7a8d] text-[#eeeeee]'
                : 'bg-[#134f5c] text-[#8b7e7e] hover:text-[#eeeeee]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Course Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map(course => {
          const instructor = users.find(u => u.name === course.instructor);
          return (
            <div key={course.id} className="bg-[#134f5c] rounded-2xl overflow-hidden lounge-shadow hover-lift transition-all">
              <img src={course.cover} alt={course.title} className="w-full h-40 object-cover" />
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs bg-[#1a7a8d]/20 text-[#1a7a8d] px-2 py-0.5 rounded-full">{course.category}</span>
                </div>
                <h3 className="font-display font-semibold text-[#eeeeee] mb-1">{course.title}</h3>
                <div className="flex items-center gap-3 text-xs text-[#8b7e7e] mb-3">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {course.duration}</span>
                  <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" /> {course.lessons} lessons</span>
                </div>
                <div className="flex items-center gap-2">
                  {instructor && <img src={instructor.avatar} alt={instructor.name} className="w-5 h-5 rounded-full" />}
                  <span className="text-xs text-[#8b7e7e]">{course.instructor}</span>
                </div>
                {course.progress > 0 && (
                  <div className="mt-3">
                    <Progress value={course.progress} className="h-1.5 bg-[#0c343d]" />
                    <span className="text-[10px] text-[#8b7e7e] mt-1">{course.progress}% complete</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
