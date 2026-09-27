import React, { useState } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { VoiceProvider } from './context/VoiceContext';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import Courses from './pages/Courses';
import StudyChat from './pages/StudyChat';
import AgentChat from './pages/AgentChat';
import ToolsPermissions from './pages/ToolsPermissions';
import Settings from './pages/Settings';
import PilotEvaluation from './pages/PilotEvaluation';
import ParentalPortal from './pages/ParentalPortal';
import LaptopNotes from './pages/LaptopNotes';

function MainApp() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedCourseId, setSelectedCourseId] = useState(null);

  const getPageInfo = () => {
    switch (activeTab) {
      case 'dashboard':
        return { title: 'Dashboard', subtitle: 'Overview of grounding indexes, voice status, and recent agent actions' };
      case 'courses':
        return { title: 'Course Vector Knowledge Bases', subtitle: 'Isolated FAISS vector indexes and document chunking manager' };
      case 'study':
        return { title: 'Course Grounded Study Chat', subtitle: 'Voice-first question answering strictly derived from your course PDFs' };
      case 'notes':
        return { title: 'Laptop Study Scratchpad & Notes', subtitle: 'PC-optimized Markdown editor, formula scratchpad, and AI note explanation' };
      case 'agent':
        return { title: 'General Productivity Agent', subtitle: 'Autonomous conversational assistant with OS & browser automation tools' };
      case 'parental':
        return { title: 'Parental Oversight & Safety Portal', subtitle: 'Supervise daily study hours, focus timer sessions, and monitored web searches' };
      case 'evaluation':
        return { title: 'Pilot Evaluation & Feedback Analytics', subtitle: '4th Year Major Project rubric • KPRIT student feedback & RAG grounding verification' };
      case 'tools':
        return { title: 'Tools & Permission Governance', subtitle: 'Configure human-in-the-loop permission policies and audit execution logs' };
      case 'settings':
        return { title: 'Settings & Providers', subtitle: 'Configure multi-provider LLM keys, voice synthesis, and wake-word phonetics' };
      default:
        return { title: 'TARA', subtitle: 'AI Study & Productivity Agent' };
    }
  };

  const { title, subtitle } = getPageInfo();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F5F4EF] dark:bg-[#242321] text-[#181716] dark:text-[#F8F6F2] transition-colors duration-200">
      {/* Sidebar Navigation */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Navbar activeTitle={title} subtitle={subtitle} />

        <main className="flex-1 overflow-y-auto">
          {activeTab === 'dashboard' && (
            <Dashboard 
              setActiveTab={setActiveTab} 
              setSelectedCourseId={setSelectedCourseId} 
            />
          )}
          {activeTab === 'courses' && (
            <Courses 
              selectedCourseId={selectedCourseId} 
              setSelectedCourseId={setSelectedCourseId} 
              setActiveTab={setActiveTab} 
            />
          )}
          {activeTab === 'study' && (
            <StudyChat 
              selectedCourseId={selectedCourseId} 
              setSelectedCourseId={setSelectedCourseId} 
              setActiveTab={setActiveTab} 
            />
          )}
          {activeTab === 'notes' && (
            <LaptopNotes 
              selectedCourseId={selectedCourseId} 
            />
          )}
          {activeTab === 'agent' && (
            <AgentChat />
          )}
          {activeTab === 'parental' && (
            <ParentalPortal setActiveTab={setActiveTab} />
          )}
          {activeTab === 'evaluation' && (
            <PilotEvaluation 
              selectedCourseId={selectedCourseId} 
              setSelectedCourseId={setSelectedCourseId} 
            />
          )}
          {activeTab === 'tools' && (
            <ToolsPermissions />
          )}
          {activeTab === 'settings' && (
            <Settings />
          )}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <VoiceProvider>
        <MainApp />
      </VoiceProvider>
    </ThemeProvider>
  );
}
