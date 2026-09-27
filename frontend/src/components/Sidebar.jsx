import React from 'react';
import { 
  LayoutDashboard, 
  GraduationCap, 
  MessageSquare, 
  Bot, 
  ShieldCheck, 
  Settings as SettingsIcon,
  Mic,
  MicOff,
  Sun,
  Moon,
  Volume2,
  Sparkles,
  Award
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useVoice } from '../context/VoiceContext';
import AudioWaveform from './AudioWaveform';

export default function Sidebar({ activeTab, setActiveTab }) {
  const { isDark, toggleTheme } = useTheme();
  const { isWakeWordActive, isListening, isSpeaking, toggleWakeWord } = useVoice();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, badge: null },
    { id: 'courses', label: 'Courses & Docs', icon: GraduationCap, badge: null },
    { id: 'study', label: 'Study Chat', icon: MessageSquare, badge: 'Grounded' },
    { id: 'agent', label: 'General Agent', icon: Bot, badge: 'Tools' },
    { id: 'evaluation', label: 'Pilot Evaluation', icon: Award, badge: 'KPRIT' },
    { id: 'tools', label: 'Tools & Permissions', icon: ShieldCheck, badge: null },
    { id: 'settings', label: 'Settings & Models', icon: SettingsIcon, badge: null }
  ];

  return (
    <aside className="w-76 h-screen shrink-0 bg-[#FFFFFF] dark:bg-[#2C2A27] border-r border-[#DDD9D0] dark:border-[#48453F] flex flex-col justify-between select-none transition-colors duration-200">
      {/* Top Header */}
      <div>
        <div className="p-6 border-b border-[#DDD9D0] dark:border-[#48453F]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-[#DA7756] flex items-center justify-center text-white font-serif-claude font-bold text-2xl shadow-sm">
                T
              </div>
              <div>
                <h1 className="font-serif-claude font-bold text-2xl md:text-3xl tracking-tight text-[#181716] dark:text-[#F8F6F2]">
                  TARA
                </h1>
                <p className="text-xs uppercase tracking-wider font-bold text-[#4A463F] dark:text-[#C8C3B8]">
                  Study & Productivity
                </p>
              </div>
            </div>
          </div>

          {/* Wake Word Status Capsule */}
          <div className="mt-5 p-3.5 rounded-2xl bg-[#F5F4EF] dark:bg-[#242321] border border-[#DDD9D0] dark:border-[#48453F] flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-3">
              <span className={`w-3 h-3 rounded-full ${
                isListening 
                  ? 'bg-[#DA7756] animate-ping' 
                  : isWakeWordActive 
                  ? 'bg-[#3D6B4A]' 
                  : 'bg-[#6B675F]'
              }`} />
              <div>
                <div className="text-sm font-bold text-[#181716] dark:text-[#F8F6F2]">
                  {isListening ? 'Listening...' : isWakeWordActive ? 'Wake Word Active' : 'Wake Word Paused'}
                </div>
                <div className="text-xs text-[#4A463F] dark:text-[#C8C3B8] font-mono mt-0.5">
                  "TARA" • /ˈtɑːrə/
                </div>
              </div>
            </div>
            <button
              onClick={toggleWakeWord}
              title={isWakeWordActive ? 'Pause wake-word detector' : 'Activate wake-word detector'}
              className={`p-2 rounded-xl transition-colors cursor-pointer ${
                isWakeWordActive
                  ? 'bg-[#DA7756] text-white shadow-xs'
                  : 'bg-[#EDEAE1] dark:bg-[#363430] text-[#4A463F] dark:text-[#C8C3B8] hover:text-[#181716] dark:hover:text-[#F8F6F2]'
              }`}
            >
              {isWakeWordActive ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-base font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#EDEAE1] dark:bg-[#363430] text-[#DA7756] font-bold shadow-xs'
                    : 'text-[#4A463F] dark:text-[#C8C3B8] hover:text-[#181716] dark:hover:text-[#F8F6F2] hover:bg-[#F5F4EF] dark:hover:bg-[#242321]'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <Icon className={`w-5 h-5 ${isActive ? 'text-[#DA7756]' : 'text-[#4A463F] dark:text-[#C8C3B8]'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                    isActive 
                      ? 'bg-[#DA7756]/20 text-[#DA7756]' 
                      : 'bg-[#EDEAE1] dark:bg-[#242321] text-[#4A463F] dark:text-[#C8C3B8]'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Area: Voice Activity & Theme */}
      <div className="p-5 border-t border-[#DDD9D0] dark:border-[#48453F] space-y-4">
        {(isListening || isSpeaking) && (
          <div className="p-3 rounded-2xl bg-[#EDEAE1]/80 dark:bg-[#363430]/80 border border-[#DDD9D0] dark:border-[#48453F]">
            <div className="flex items-center justify-between text-sm mb-2 px-1">
              <span className="font-bold text-[#DA7756] flex items-center gap-2">
                <Volume2 className="w-4 h-4" />
                {isSpeaking ? 'Speaking...' : 'Capturing speech...'}
              </span>
            </div>
            <AudioWaveform isActive={isListening} isSpeaking={isSpeaking} size="sm" />
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <div className="text-sm text-[#4A463F] dark:text-[#C8C3B8]">
            <span>Theme: </span>
            <span className="font-bold text-[#181716] dark:text-[#F8F6F2]">
              {isDark ? 'Dark Oat' : 'Warm Light'}
            </span>
          </div>
          <button
            onClick={toggleTheme}
            className="p-2.5 rounded-xl bg-[#EDEAE1] dark:bg-[#363430] text-[#181716] dark:text-[#F8F6F2] hover:bg-[#DDD9D0] dark:hover:bg-[#48453F] transition-colors cursor-pointer"
            title="Toggle Light/Dark Theme"
          >
            {isDark ? <Sun className="w-5 h-5 text-[#E0A64C]" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </aside>
  );
}
