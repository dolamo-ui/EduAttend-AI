
import React from 'react';
import { LayoutDashboard, Users, UserRound, BookOpen, ClipboardCheck, ImageIcon, Settings, LogOut, X } from 'lucide-react';
import { Role } from '../types';

interface SidebarProps {
  role: Role;
  currentPath: string;
  onNavigate: (path: string) => void;
  isOpen?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ role, currentPath, onNavigate, isOpen }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'TEACHER', 'STUDENT'] },
    { id: 'attendance', label: 'Attendance', icon: ClipboardCheck, roles: ['ADMIN', 'TEACHER'] },
    { id: 'students', label: 'Students', icon: UserRound, roles: ['ADMIN', 'TEACHER'] },
    { id: 'teachers', label: 'Teachers', icon: Users, roles: ['ADMIN'] },
    { id: 'classes', label: 'Classes', icon: BookOpen, roles: ['ADMIN'] },
    { id: 'photo-lab', label: 'AI Photo Lab', icon: ImageIcon, roles: ['ADMIN', 'TEACHER'] },
    { id: 'settings', label: 'Settings', icon: Settings, roles: ['ADMIN'] },
  ].filter(item => item.roles.includes(role));

  return (
    <div className={`
      fixed lg:fixed left-0 top-0 h-screen bg-indigo-900 text-white flex flex-col z-50
      w-64 transition-transform duration-300 ease-in-out
      ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
    `}>
      <div className="p-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <span className="bg-indigo-500 p-1 rounded-lg">Edu</span>
          Attend AI
        </h1>
        {/* Only show close on mobile when open */}
        {isOpen && (
          <button 
            onClick={() => onNavigate(currentPath)} 
            className="lg:hidden p-1 hover:bg-indigo-800 rounded-lg text-indigo-300"
          >
            <X size={24} />
          </button>
        )}
      </div>

      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              currentPath === item.id 
                ? 'bg-indigo-700 text-white shadow-lg' 
                : 'text-indigo-200 hover:bg-indigo-800'
            }`}
          >
            <item.icon size={20} />
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-indigo-800">
        <button className="w-full flex items-center gap-3 px-4 py-3 text-indigo-300 hover:text-white transition-colors">
          <LogOut size={20} />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
