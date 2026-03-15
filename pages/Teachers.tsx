
import React from 'react';
import { Plus, Mail, Book, MoreVertical } from 'lucide-react';
import { User, ClassRoom } from '../types';

interface TeachersProps {
  teachers: User[];
  classes: ClassRoom[];
}

const Teachers: React.FC<TeachersProps> = ({ teachers, classes }) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Teaching Staff</h1>
          <p className="text-slate-500">Manage teacher profiles and classroom assignments.</p>
        </div>
        <button className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all font-bold">
          <Plus size={18} /> Onboard Teacher
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {teachers.map(teacher => {
          const teacherClasses = classes.filter(c => c.teacherId === teacher.id);
          return (
            <div key={teacher.id} className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 flex flex-col items-center text-center group">
              <div className="relative mb-4">
                <img src={teacher.avatar} className="w-20 h-20 rounded-2xl border-2 border-indigo-50 object-cover" alt="" />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 border-4 border-white rounded-full"></div>
              </div>
              
              <h3 className="text-lg font-bold text-slate-900 mb-1">{teacher.name}</h3>
              <p className="text-sm font-medium text-slate-500 mb-4">{teacher.role}</p>

              <div className="w-full space-y-2 mb-6">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl text-xs">
                  <span className="flex items-center gap-2 text-slate-500 font-bold uppercase"><Mail size={14} /> Email</span>
                  <span className="text-slate-700 font-medium truncate ml-2">{teacher.email}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl text-xs">
                  <span className="flex items-center gap-2 text-slate-500 font-bold uppercase"><Book size={14} /> Assigned</span>
                  <div className="flex gap-1">
                    {teacherClasses.map(c => (
                      <span key={c.id} className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-md font-bold">{c.name}</span>
                    ))}
                    {teacherClasses.length === 0 && <span className="text-slate-400">None</span>}
                  </div>
                </div>
              </div>

              <div className="w-full grid grid-cols-2 gap-3">
                <button className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">Profile</button>
                <button className="px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all">Message</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Teachers;
