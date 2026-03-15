// pages/Students.tsx
// ─────────────────────────────────────────────────────────────────────────────
// UPDATED: Full Firestore integration
//
// DATA FLOW:
//   • Students are written to BOTH localStorage (for offline/quick reads) AND
//     Firestore (so ParentRegister can find them).
//   • On mount, students are loaded from Firestore first (source of truth),
//     with localStorage as fallback if Firestore is unreachable.
//   • Every add/delete is mirrored to Firestore with schoolId + schoolCode,
//     so parents can always find their child during registration.
//   • A one-time sync runs on mount to push any localStorage-only students
//     (added before this update) into Firestore.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Download, Upload, Plus, Pencil, Trash2,
  Eye, Lock, X, CheckCircle, AlertTriangle, FileText, ChevronDown,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../src/context/AuthContext';
import {
  collection, addDoc, deleteDoc, getDocs,
  doc, query, where, serverTimestamp, writeBatch,
} from 'firebase/firestore';
import { db } from '../src/firebase/firebaseConfig';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

interface Student {
  id:              string;   // Firestore doc id (or crypto.randomUUID for localStorage-only)
  name:            string;
  roll_no:         string;
  gender:          string;
  date_of_birth:   string;
  class_name:      string;
  parent_name?:    string;
  parent_contact?: string;
  parent_email?:   string;
  // Firestore fields (may be absent in old localStorage records)
  schoolId?:       string;
  schoolCode?:     string;
}

interface FormData {
  name:           string;
  roll_no:        string;
  gender:         string;
  date_of_birth:  string;
  class_name:     string;
  parent_name:    string;
  parent_contact: string;
  parent_email:   string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// localStorage helpers (still used as cache / offline fallback)
// ═══════════════════════════════════════════════════════════════════════════════

const STORAGE_KEY = 'students';

const local = {
  list(): Student[] {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'); }
    catch { return []; }
  },
  save(students: Student[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(students));
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// Firestore helpers
// ═══════════════════════════════════════════════════════════════════════════════

// Fetch all students for a school from Firestore (3 strategies, same as ParentRegister)
async function firestoreFetchStudents(schoolId: string, schoolCode: string): Promise<Student[]> {
  const dedup = (list: Student[]) => {
    const seen = new Set<string>();
    return list.filter(s => {
      const k = `${s.class_name}::${s.roll_no}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  };
  try {
    // Strategy 1: by schoolId
    const q1   = query(collection(db, 'students'), where('schoolId', '==', schoolId));
    const s1   = await getDocs(q1);
    if (!s1.empty) {
      return dedup(s1.docs.map(d => ({ id: d.id, ...d.data() } as Student)));
    }
    // Strategy 2: by schoolCode
    const q2   = query(collection(db, 'students'), where('schoolCode', '==', schoolCode));
    const s2   = await getDocs(q2);
    if (!s2.empty) {
      return dedup(s2.docs.map(d => ({ id: d.id, ...d.data() } as Student)));
    }
    // Strategy 3: all students (single-school fallback)
    const q3   = query(collection(db, 'students'));
    const s3   = await getDocs(q3);
    return dedup(s3.docs.map(d => ({ id: d.id, ...d.data() } as Student)));
  } catch {
    return [];
  }
}

// Write a single student to Firestore
async function firestoreAddStudent(
  data: FormData,
  schoolId: string,
  schoolCode: string,
): Promise<string> {
  const ref = await addDoc(collection(db, 'students'), {
    ...data,
    schoolId,
    schoolCode,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

// Delete a student from Firestore
async function firestoreDeleteStudent(id: string): Promise<void> {
  await deleteDoc(doc(db, 'students', id));
}

// Sync localStorage-only students (no schoolId) to Firestore in bulk
async function syncLocalToFirestore(
  localStudents: Student[],
  schoolId: string,
  schoolCode: string,
): Promise<Student[]> {
  // Find students that aren't in Firestore yet (no schoolId or schoolCode)
  const toSync = localStudents.filter(s => !s.schoolId && !s.schoolCode);
  if (toSync.length === 0) return localStudents;

  // Get existing Firestore keys to avoid duplicates
  let existingKeys = new Set<string>();
  try {
    const q    = query(collection(db, 'students'), where('schoolId', '==', schoolId));
    const snap = await getDocs(q);
    snap.docs.forEach(d => {
      const data = d.data();
      existingKeys.add(`${data.class_name}::${data.roll_no}`);
    });
  } catch { /* ignore, we'll just upsert */ }

  const updated = [...localStudents];

  await Promise.all(toSync.map(async (s, i) => {
    const key = `${s.class_name}::${s.roll_no}`;
    if (existingKeys.has(key)) return; // Already in Firestore
    try {
      const ref = await addDoc(collection(db, 'students'), {
        name:           s.name,
        roll_no:        s.roll_no,
        gender:         s.gender,
        date_of_birth:  s.date_of_birth,
        class_name:     s.class_name,
        parent_name:    s.parent_name    ?? '',
        parent_contact: s.parent_contact ?? '',
        parent_email:   s.parent_email   ?? '',
        schoolId,
        schoolCode,
        localId:        s.id, // Reference to old localStorage id
        createdAt:      serverTimestamp(),
      });
      // Update the record with the new Firestore id and schoolId
      const idx = updated.findIndex(x => x.id === s.id);
      if (idx !== -1) {
        updated[idx] = { ...updated[idx], id: ref.id, schoolId, schoolCode };
      }
    } catch (err) {
      console.warn('[Students] Failed to sync:', s.name, err);
    }
  }));

  return updated;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

function deduplicateStudents(students: Student[]): Student[] {
  const seen = new Set<string>();
  return students.filter(s => {
    const key = `${(s.class_name ?? '').trim().toLowerCase()}::${(s.roll_no ?? '').trim()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function nextRollNo(className: string, students: Student[]): string {
  if (!className.trim()) return '';
  const existing = students.filter(
    s => s.class_name.trim().toLowerCase() === className.trim().toLowerCase(),
  );
  const nums = existing
    .map(s => parseInt(s.roll_no.replace(/\D/g, ''), 10))
    .filter(n => !isNaN(n));
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return String(next).padStart(3, '0');
}

// Avatar palette
const PALETTES = [
  { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' },
  { bg: '#d1fae5', text: '#065f46', border: '#6ee7b7' },
  { bg: '#ede9fe', text: '#5b21b6', border: '#c4b5fd' },
  { bg: '#fce7f3', text: '#9d174d', border: '#f9a8d4' },
  { bg: '#ffedd5', text: '#9a3412', border: '#fdba74' },
  { bg: '#cffafe', text: '#155e75', border: '#67e8f9' },
  { bg: '#fef9c3', text: '#854d0e', border: '#fde047' },
  { bg: '#f0fdf4', text: '#166534', border: '#86efac' },
];

function StudentAvatar({ name, size = 36 }: { name: string; size?: number }) {
  const idx = (name ?? 'A').toUpperCase().charCodeAt(0) % PALETTES.length;
  const { bg, text, border } = PALETTES[idx];
  const parts    = (name ?? '').trim().split(/\s+/).filter(Boolean);
  const initials = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : (parts[0]?.[0] ?? '?').toUpperCase();
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', background:bg, border:`2px solid ${border}`, boxShadow:'0 0 0 2px #fff,0 1px 4px rgba(0,0,0,0.08)', color:text, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontWeight:800, fontSize:size<=32?11:size<=40?13:15, letterSpacing:'-0.02em', userSelect:'none' }}>
      {initials}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Primitive UI
// ═══════════════════════════════════════════════════════════════════════════════

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-xl border border-gray-200 shadow-sm ${className}`}>{children}</div>;
}

interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'solid'|'outline'|'ghost';
  size?: 'default'|'sm'|'icon';
}
function Btn({ variant='solid', size='default', className='', children, ...props }: BtnProps) {
  const v = { solid:'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm', outline:'border border-gray-300 text-gray-700 bg-white hover:bg-gray-50', ghost:'bg-transparent text-gray-600 hover:bg-gray-100' };
  const s = { default:'px-4 py-2 text-sm rounded-lg', sm:'px-3 py-1.5 text-xs rounded-lg', icon:'w-8 h-8 rounded-lg' };
  return <button className={`inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${v[variant]} ${s[size]} ${className}`} {...props}>{children}</button>;
}

function Inp({ className='', ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-100 ${className}`} {...props}/>;
}

function Badge({ children, className='' }: { children: React.ReactNode; className?: string }) {
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${className}`}>{children}</span>;
}

function SelectDropdown({ value, onValueChange, options, placeholder='Select...', id }: {
  value:string; onValueChange:(v:string)=>void; options:{value:string;label:string}[]; placeholder?:string; id?:string;
}) {
  const [open,setOpen]=useState(false);
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{ const h=(e:MouseEvent)=>{if(ref.current&&!ref.current.contains(e.target as Node))setOpen(false);}; document.addEventListener('mousedown',h); return()=>document.removeEventListener('mousedown',h); },[]);
  const selected=options.find(o=>o.value===value);
  return (
    <div ref={ref} className="relative">
      <button id={id} type="button" onClick={()=>setOpen(o=>!o)} className="w-full flex items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
        <span className={selected?'text-gray-900':'text-gray-400'}>{selected?selected.label:placeholder}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open?'rotate-180':''}`}/>
      </button>
      {open&&(
        <ul className="absolute z-30 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-xl max-h-52 overflow-auto py-1">
          {options.map(opt=>(
            <li key={opt.value} onClick={()=>{onValueChange(opt.value);setOpen(false);}} className={`flex items-center justify-between px-3 py-2 text-sm cursor-pointer transition-colors ${opt.value===value?'bg-indigo-50 text-indigo-700 font-semibold':'text-gray-900 hover:bg-gray-50'}`}>
              {opt.label}
              {opt.value===value&&<CheckCircle className="w-4 h-4 text-indigo-600 shrink-0"/>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CSV Upload Modal
// ═══════════════════════════════════════════════════════════════════════════════

interface CSVRow {
  name:string; roll_no:string; class_name:string; gender:string;
  date_of_birth:string; parent_name:string; parent_contact:string; parent_email:string;
  _rowNum:number; _error?:string;
}

function parseCSV(text: string): CSVRow[] {
  const lines = text.trim().split('\n').map(l=>l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h=>h.replace(/"/g,'').trim().toLowerCase().replace(/\s+/g,'_'));
  return lines.slice(1).map((line,idx)=>{
    const cols:string[]=[];
    let cur='',inQ=false;
    for(const ch of line){ if(ch==='"'){inQ=!inQ;}else if(ch===','&&!inQ){cols.push(cur.trim());cur='';}else{cur+=ch;} }
    cols.push(cur.trim());
    const get=(...keys:string[])=>{ for(const k of keys){const i=headers.indexOf(k);if(i!==-1&&cols[i])return cols[i].replace(/^"|"$/g,'').trim();}return ''; };
    const gRaw=get('gender','sex').toUpperCase();
    const gender=['MALE','FEMALE','OTHER'].includes(gRaw)?gRaw:'';
    const row:CSVRow={ _rowNum:idx+2, name:get('name','full_name','student_name','student'), roll_no:get('roll_no','roll','roll_number','rollno'), class_name:get('class_name','class','grade','classroom'), gender, date_of_birth:get('date_of_birth','dob','birth_date','birthdate'), parent_name:get('parent_name','guardian','parent','guardian_name'), parent_contact:get('parent_contact','contact','phone','mobile','parent_phone'), parent_email:get('parent_email','email','parent_email_address') };
    if(!row.name) row._error='Missing name'; else if(!row.roll_no) row._error='Missing roll number'; else if(!row.class_name) row._error='Missing class';
    return row;
  });
}

function CSVUploadModal({ open, onOpenChange, onImported, schoolId, schoolCode }: {
  open:boolean; onOpenChange:(o:boolean)=>void; onImported:(students:Student[])=>void;
  schoolId:string; schoolCode:string;
}) {
  const fileRef=useRef<HTMLInputElement>(null);
  const [rows,setRows]=useState<CSVRow[]>([]);
  const [dragging,setDragging]=useState(false);
  const [fileName,setFileName]=useState('');
  const [step,setStep]=useState<'upload'|'preview'|'done'>('upload');
  const [imported,setImported]=useState(0);
  const [saving,setSaving]=useState(false);

  const reset=()=>{setRows([]);setFileName('');setStep('upload');setImported(0);setSaving(false);};
  useEffect(()=>{if(!open)reset();},[open]);

  const processFile=(file:File)=>{
    if(!file.name.endsWith('.csv')){alert('Please upload a .csv file.');return;}
    setFileName(file.name);
    const reader=new FileReader();
    reader.onload=e=>{const parsed=parseCSV(e.target?.result as string);if(parsed.length===0){alert('No data rows found.');return;}setRows(parsed);setStep('preview');};
    reader.readAsText(file);
  };

  const handleDrop=useCallback((e:React.DragEvent)=>{e.preventDefault();setDragging(false);const file=e.dataTransfer.files[0];if(file)processFile(file);},[]);
  const validRows=rows.filter(r=>!r._error);
  const invalidRows=rows.filter(r=>r._error);

  const handleImport=async()=>{
    if(validRows.length===0)return;
    setSaving(true);
    const newStudents:Student[]=[];
    // Write each valid row to Firestore + localStorage
    for(const row of validRows){
      const {_rowNum,_error,...data}=row;
      try{
        const firestoreId=await firestoreAddStudent(data,schoolId,schoolCode);
        newStudents.push({...data,id:firestoreId,schoolId,schoolCode});
      }catch(err){
        console.warn('[CSV] Firestore write failed, using local id',err);
        const localId=crypto.randomUUID();
        newStudents.push({...data,id:localId});
      }
    }
    // Update localStorage
    const all=[...local.list(),...newStudents];
    local.save(deduplicateStudents(all));
    setImported(newStudents.length);
    setSaving(false);
    setStep('done');
    onImported(newStudents);
  };

  const downloadTemplate=()=>{
    const csv=['name,roll_no,class_name,gender,date_of_birth,parent_name,parent_contact,parent_email','Alice Mokoena,001,10-A,FEMALE,2009-03-12,Mrs Mokoena,+27 82 111 0001,mokoena@email.com','Brian Dlamini,002,10-A,MALE,2009-07-22,Mr Dlamini,+27 82 111 0002,dlamini@email.com'].join('\n');
    const blob=new Blob([csv],{type:'text/csv'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='students_template.csv';a.click();URL.revokeObjectURL(url);
  };

  if(!open)return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={()=>onOpenChange(false)}/>
      <div className="relative z-10 w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0">
          <div><h2 className="text-lg font-bold text-gray-900">CSV Bulk Upload</h2><p className="text-xs text-gray-400 mt-0.5">Import multiple students — saved to Firestore</p></div>
          <button onClick={()=>onOpenChange(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100"><X className="w-4 h-4"/></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step==='upload'&&(
            <div className="space-y-5">
              <div onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={handleDrop} onClick={()=>fileRef.current?.click()} className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${dragging?'border-indigo-400 bg-indigo-50':'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'}`}>
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4"><Upload className="w-7 h-7 text-indigo-500"/></div>
                <p className="text-sm font-semibold text-gray-700 mb-1">Drag & drop your CSV file here</p>
                <p className="text-xs text-gray-400">or click to browse — .csv files only</p>
                <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)processFile(f);e.target.value='';}}/>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-xs font-bold text-amber-800 uppercase tracking-wide mb-2">Required Columns</p>
                <div className="flex flex-wrap gap-2 mb-2">{['name','roll_no','class_name','gender','date_of_birth'].map(c=><code key={c} className="text-xs bg-amber-100 text-amber-900 px-2 py-1 rounded-md font-mono">{c}</code>)}</div>
                <p className="text-xs text-amber-700">Optional: <code className="font-mono">parent_name</code>, <code className="font-mono">parent_contact</code>, <code className="font-mono">parent_email</code></p>
              </div>
              <button onClick={downloadTemplate} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-gray-300 text-sm text-gray-500 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all font-medium"><FileText className="w-4 h-4"/>Download sample template CSV</button>
            </div>
          )}
          {step==='preview'&&(
            <div className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-xs font-semibold px-3 py-2 rounded-lg"><CheckCircle className="w-4 h-4"/>{validRows.length} valid row{validRows.length!==1?'s':''}</div>
                {invalidRows.length>0&&<div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold px-3 py-2 rounded-lg"><AlertTriangle className="w-4 h-4"/>{invalidRows.length} errors — will be skipped</div>}
                <span className="text-xs text-gray-400 ml-auto font-mono">{fileName}</span>
              </div>
              <div className="rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-50 border-b border-gray-200"><tr>{['Row','Name','Roll','Class','Gender','Status'].map(h=><th key={h} className="px-3 py-2.5 font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.map(row=>(
                      <tr key={row._rowNum} className={row._error?'bg-red-50':'hover:bg-gray-50'}>
                        <td className="px-3 py-2 text-gray-400">{row._rowNum}</td>
                        <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">{row.name||'—'}</td>
                        <td className="px-3 py-2 text-gray-600 font-mono">{row.roll_no||'—'}</td>
                        <td className="px-3 py-2 text-gray-600">{row.class_name||'—'}</td>
                        <td className="px-3 py-2 text-gray-600">{row.gender||'—'}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{row._error?<span className="flex items-center gap-1 text-red-600 font-semibold"><AlertTriangle className="w-3 h-3"/>{row._error}</span>:<span className="flex items-center gap-1 text-green-600 font-semibold"><CheckCircle className="w-3 h-3"/>Ready</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button onClick={reset} className="text-xs text-gray-400 hover:text-indigo-600 transition-colors underline">← Upload a different file</button>
            </div>
          )}
          {step==='done'&&(
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4"><CheckCircle className="w-8 h-8 text-green-500"/></div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">Import Complete!</h3>
              <p className="text-sm text-gray-500">Imported <strong className="text-gray-800">{imported}</strong> students to Firestore.</p>
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2 shrink-0">
          {step==='done'?<Btn variant="solid" onClick={()=>onOpenChange(false)}>Done</Btn>:step==='preview'?<>
            <Btn variant="outline" onClick={()=>onOpenChange(false)}>Cancel</Btn>
            <Btn variant="solid" onClick={handleImport} disabled={validRows.length===0||saving}>
              {saving?<><RefreshCw className="w-4 h-4 mr-2 animate-spin"/>Saving to Firestore…</>:<><Upload className="w-4 h-4 mr-2"/>Import {validRows.length} Students</>}
            </Btn>
          </>:<Btn variant="outline" onClick={()=>onOpenChange(false)}>Cancel</Btn>}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Add Student Dialog — writes to Firestore + localStorage
// ═══════════════════════════════════════════════════════════════════════════════

const GENDER_OPTIONS=[{value:'MALE',label:'Male'},{value:'FEMALE',label:'Female'},{value:'OTHER',label:'Other'}];
const emptyForm=():FormData=>({name:'',roll_no:'',gender:'',date_of_birth:'',class_name:'',parent_name:'',parent_contact:'',parent_email:''});

function AddStudentDialog({ open, onOpenChange, onSuccess, allStudents, schoolId, schoolCode }: {
  open:boolean; onOpenChange:(o:boolean)=>void; onSuccess:(s:Student)=>void;
  allStudents:Student[]; schoolId:string; schoolCode:string;
}) {
  const [form,setForm]=useState<FormData>(emptyForm());
  const [isSubmitting,setIsSubmitting]=useState(false);
  const [error,setError]=useState<string|null>(null);

  const set=(k:keyof FormData)=>(v:string)=>setForm(p=>({...p,[k]:v}));

  const handleClassChange=(className:string)=>{
    const roll=nextRollNo(className,allStudents);
    setForm(p=>({...p,class_name:className,roll_no:roll}));
  };

  useEffect(()=>{if(!open){setForm(emptyForm());setError(null);}},[open]);

  const handleSubmit=async(e:React.FormEvent)=>{
    e.preventDefault();
    if(!form.gender){setError('Please select a gender.');return;}
    if(!form.class_name){setError('Please enter a class name.');return;}
    setError(null);setIsSubmitting(true);
    try{
      // Duplicate check (local)
      const dup=allStudents.find(s=>s.roll_no.trim()===form.roll_no.trim()&&s.class_name.trim().toLowerCase()===form.class_name.trim().toLowerCase());
      if(dup){setError(`Roll number ${form.roll_no} already exists in class ${form.class_name}.`);setIsSubmitting(false);return;}

      let student:Student;
      try{
        // Primary: write to Firestore
        const firestoreId=await firestoreAddStudent(form,schoolId,schoolCode);
        student={...form,id:firestoreId,schoolId,schoolCode};
      }catch(firestoreErr){
        console.warn('[AddStudent] Firestore failed, saving locally only',firestoreErr);
        student={...form,id:crypto.randomUUID()};
      }

      // Always update localStorage too
      const updated=deduplicateStudents([...local.list(),student]);
      local.save(updated);

      onSuccess(student);
      onOpenChange(false);
    }catch(err){
      console.error(err);
      setError('Failed to add student. Please try again.');
    }finally{setIsSubmitting(false);}
  };

  if(!open)return null;
  return(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={()=>onOpenChange(false)}/>
      <div className="relative z-10 w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="px-6 py-5 border-b border-gray-100 shrink-0 flex items-center gap-4">
          <StudentAvatar name={form.name||'?'} size={44}/>
          <div><h2 className="text-lg font-bold text-gray-900">Add New Student</h2><p className="text-xs text-gray-400 mt-0.5">Saved to Firestore · roll number auto-generated</p></div>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="px-6 py-5 overflow-y-auto flex-1 space-y-5">
            {error&&<div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg"><AlertTriangle className="w-4 h-4 shrink-0"/>{error}</div>}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Student Information</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2"><label className="block text-sm font-semibold text-gray-700 mb-1">Full Name *</label><Inp value={form.name} onChange={e=>set('name')(e.target.value)} placeholder="e.g. Alice Mokoena" required/></div>
                <div><label className="block text-sm font-semibold text-gray-700 mb-1">Class *</label><Inp value={form.class_name} onChange={e=>handleClassChange(e.target.value)} placeholder="e.g. 10-A" required/></div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Roll Number *{form.class_name&&<span className="text-xs font-normal text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full ml-1">auto</span>}</label>
                  <Inp value={form.roll_no} onChange={e=>set('roll_no')(e.target.value)} placeholder={form.class_name?'':'Enter class first'} required/>
                </div>
                <div><label className="block text-sm font-semibold text-gray-700 mb-1">Gender *</label><SelectDropdown value={form.gender} onValueChange={set('gender')} options={GENDER_OPTIONS} placeholder="Select gender"/></div>
                <div><label className="block text-sm font-semibold text-gray-700 mb-1">Date of Birth</label><Inp type="date" value={form.date_of_birth} onChange={e=>set('date_of_birth')(e.target.value)}/></div>
              </div>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Parent / Guardian</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2"><label className="block text-sm font-semibold text-gray-700 mb-1">Full Name</label><Inp value={form.parent_name} onChange={e=>set('parent_name')(e.target.value)} placeholder="Parent or guardian name"/></div>
                <div><label className="block text-sm font-semibold text-gray-700 mb-1">Contact Number</label><Inp value={form.parent_contact} onChange={e=>set('parent_contact')(e.target.value)} placeholder="+27 123 456 789"/></div>
                <div><label className="block text-sm font-semibold text-gray-700 mb-1">Email Address</label><Inp type="email" value={form.parent_email} onChange={e=>set('parent_email')(e.target.value)} placeholder="parent@email.com"/></div>
              </div>
            </div>
          </div>
          <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2 shrink-0">
            <Btn type="button" variant="outline" onClick={()=>onOpenChange(false)} disabled={isSubmitting}>Cancel</Btn>
            <Btn type="submit" variant="solid" disabled={isSubmitting}>
              {isSubmitting?<><RefreshCw className="w-4 h-4 mr-2 animate-spin"/>Saving…</>:'Add Student'}
            </Btn>
          </div>
        </form>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Teacher read-only banner
// ═══════════════════════════════════════════════════════════════════════════════

function TeacherBanner({ className }: { className:string }) {
  return(
    <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
      <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0"><Eye className="w-4 h-4 text-blue-600"/></div>
      <div><p className="text-sm font-semibold text-blue-900">Viewing Class {className}</p><p className="text-xs text-blue-500">Read-only. Contact the principal to add or remove students.</p></div>
      <Lock className="w-4 h-4 text-blue-300 shrink-0 ml-auto"/>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Students Page
// ═══════════════════════════════════════════════════════════════════════════════

export default function Students(): React.ReactElement {
  const { user } = useAuth();
  const isPrincipal   = user?.role === 'PRINCIPAL';
  const assignedClass = user?.assignedClass ?? '';
  const schoolId      = user?.schoolId   ?? '';
  const schoolCode    = user?.schoolCode ?? '';

  const [allStudents,   setAllStudents]   = useState<Student[]>([]);
  const [searchTerm,    setSearchTerm]    = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showCSVModal,  setShowCSVModal]  = useState(false);
  const [deletingId,    setDeletingId]    = useState<string|null>(null);
  const [classFilter,   setClassFilter]   = useState('all');
  const [loadingData,   setLoadingData]   = useState(true);
  const [syncing,       setSyncing]       = useState(false);
  const syncedRef = useRef(false);

  // ── Load students: Firestore first, localStorage fallback ─────────────────
  useEffect(()=>{
    if(!schoolId) {
      // No schoolId yet — use localStorage only
      setAllStudents(deduplicateStudents(local.list()));
      setLoadingData(false);
      return;
    }
    (async()=>{
      setLoadingData(true);
      try{
        const fsStudents=await firestoreFetchStudents(schoolId,schoolCode);
        if(fsStudents.length>0){
          // Firestore is the source of truth
          setAllStudents(deduplicateStudents(fsStudents));
          local.save(deduplicateStudents(fsStudents)); // keep localStorage in sync
        } else {
          // Nothing in Firestore yet — use localStorage
          const localStudents=deduplicateStudents(local.list());
          setAllStudents(localStudents);
          // Trigger one-time sync of localStorage → Firestore
          if(!syncedRef.current&&localStudents.length>0&&schoolId){
            syncedRef.current=true;
            setSyncing(true);
            const synced=await syncLocalToFirestore(localStudents,schoolId,schoolCode);
            const deduped=deduplicateStudents(synced);
            setAllStudents(deduped);
            local.save(deduped);
            setSyncing(false);
          }
        }
      }catch(err){
        console.warn('[Students] Firestore load failed, using localStorage',err);
        setAllStudents(deduplicateStudents(local.list()));
      }finally{
        setLoadingData(false);
      }
    })();
  },[schoolId,schoolCode]);

  const classNames = Array.from(new Set(allStudents.map(s=>s.class_name).filter(Boolean))).sort();

  const scopedStudents = isPrincipal
    ? allStudents
    : allStudents.filter(s=>s.class_name.trim().toLowerCase()===assignedClass.trim().toLowerCase());

  const filteredStudents = scopedStudents.filter(s=>{
    const q=searchTerm.toLowerCase();
    const matchSearch=!q||s.name?.toLowerCase().includes(q)||s.roll_no?.toLowerCase().includes(q)||s.class_name?.toLowerCase().includes(q);
    const matchClass=!isPrincipal||classFilter==='all'||s.class_name===classFilter;
    return matchSearch&&matchClass;
  });

  const handleStudentAdded=(student:Student)=>{
    setAllStudents(prev=>deduplicateStudents([...prev,student]));
  };

  const handleBulkImported=(students:Student[])=>{
    setAllStudents(prev=>deduplicateStudents([...prev,...students]));
  };

  const handleDelete=async(id:string)=>{
    if(!window.confirm('Delete this student? This cannot be undone.'))return;
    setDeletingId(id);
    try{
      // Delete from Firestore
      await firestoreDeleteStudent(id).catch(err=>console.warn('[Delete] Firestore error:',err));
      // Delete from localStorage
      local.save(local.list().filter(s=>s.id!==id));
      setAllStudents(prev=>prev.filter(s=>s.id!==id));
    }finally{setDeletingId(null);}
  };

  const handleExport=()=>{
    const rows=[['Name','Roll No','Class','Gender','DOB','Parent Contact','Parent Email'],...filteredStudents.map(s=>[s.name,s.roll_no,s.class_name,s.gender,s.date_of_birth,s.parent_contact??'',s.parent_email??''])];
    const csv=rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob=new Blob([csv],{type:'text/csv'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='students.csv';a.click();URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,600;9..40,700;9..40,800&display=swap');`}</style>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            {isPrincipal?'Student Directory':`Class ${assignedClass} — Students`}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {loadingData?'Loading from Firestore…':syncing?'Syncing to Firestore…':`${filteredStudents.length} student${filteredStudents.length!==1?'s':''}${isPrincipal?' across all classes':' in your class'}`}
          </p>
        </div>
        {isPrincipal&&(
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Btn variant="outline" onClick={handleExport}><Download className="w-4 h-4 mr-2"/>Export CSV</Btn>
            <Btn variant="outline" onClick={()=>setShowCSVModal(true)}><Upload className="w-4 h-4 mr-2"/>CSV Upload</Btn>
            <Btn variant="solid" onClick={()=>setShowAddDialog(true)}><Plus className="w-4 h-4 mr-2"/>Add Student</Btn>
          </div>
        )}
      </div>

      {!isPrincipal&&<TeacherBanner className={assignedClass}/>}

      {/* Firestore status badge */}
      {isPrincipal&&(
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold w-fit ${syncing?'bg-amber-50 border border-amber-200 text-amber-700':loadingData?'bg-blue-50 border border-blue-200 text-blue-700':'bg-green-50 border border-green-200 text-green-700'}`}>
          {syncing||loadingData?<RefreshCw className="w-3 h-3 animate-spin"/>:<CheckCircle className="w-3 h-3"/>}
          {syncing?'Syncing localStorage → Firestore…':loadingData?'Loading from Firestore…':'Firestore connected · Students available to parents'}
        </div>
      )}

      <Card className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
          <input type="search" placeholder={isPrincipal?'Search by name, roll no or class…':'Search by name or roll number…'} value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className="block w-full sm:max-w-sm rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"/>
          {isPrincipal&&<select value={classFilter} onChange={e=>setClassFilter(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"><option value="all">All Classes</option>{classNames.map(c=><option key={c} value={c}>{c}</option>)}</select>}
        </div>

        <div className="rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Student</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Roll No</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Gender</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Date of Birth</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Class</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden xl:table-cell">Parent Contact</th>
                {isPrincipal&&<th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loadingData?(
                <tr><td colSpan={isPrincipal?7:6}>
                  <div className="flex items-center justify-center gap-3 py-16 text-gray-400">
                    <RefreshCw className="w-5 h-5 animate-spin text-indigo-400"/>
                    <span className="text-sm">Loading students from Firestore…</span>
                  </div>
                </td></tr>
              ):filteredStudents.length===0?(
                <tr><td colSpan={isPrincipal?7:6}>
                  <div className="flex flex-col items-center justify-center py-16">
                    <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                      <svg className="w-7 h-7 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                    </div>
                    <p className="text-sm text-gray-500 font-medium">{searchTerm?`No students matching "${searchTerm}"`:isPrincipal?'No students yet. Click "Add Student" to get started.':`No students found in class ${assignedClass}.`}</p>
                  </div>
                </td></tr>
              ):(
                filteredStudents.map(student=>(
                  <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <StudentAvatar name={student.name} size={36}/>
                        <div>
                          <div className="font-semibold text-gray-900 whitespace-nowrap">{student.name}</div>
                          {student.parent_name&&<div className="text-xs text-gray-400 whitespace-nowrap">{student.parent_name}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 font-mono whitespace-nowrap">{student.roll_no}</td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <Badge className={student.gender==='MALE'?'bg-blue-100 text-blue-700':student.gender==='FEMALE'?'bg-pink-100 text-pink-700':'bg-gray-100 text-gray-600'}>{student.gender||'—'}</Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden lg:table-cell whitespace-nowrap">{student.date_of_birth||'—'}</td>
                    <td className="px-4 py-3"><Badge className="bg-indigo-100 text-indigo-700 whitespace-nowrap">{student.class_name}</Badge></td>
                    <td className="px-4 py-3 hidden xl:table-cell">
                      <div className="text-sm font-medium text-gray-700 whitespace-nowrap">{student.parent_contact||'—'}</div>
                      <div className="text-xs text-gray-400 whitespace-nowrap">{student.parent_email||''}</div>
                    </td>
                    {isPrincipal&&(
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Btn variant="ghost" size="icon" title="Edit (coming soon)"><Pencil className="w-4 h-4 text-gray-400"/></Btn>
                          <Btn variant="ghost" size="icon" title="Delete student" disabled={deletingId===student.id} onClick={()=>handleDelete(student.id)}>
                            <Trash2 className={`w-4 h-4 ${deletingId===student.id?'text-gray-300':'text-red-400'}`}/>
                          </Btn>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {filteredStudents.length>0&&!loadingData&&(
          <p className="text-xs text-gray-400 mt-3 text-right">
            Showing <strong className="text-gray-700">{filteredStudents.length}</strong> student{filteredStudents.length!==1?'s':''}
            {isPrincipal&&classFilter!=='all'&&` in class ${classFilter}`}
            {' '}· {allStudents.filter(s=>s.schoolId).length} synced to Firestore
          </p>
        )}
      </Card>

      {isPrincipal&&(
        <>
          <AddStudentDialog open={showAddDialog} onOpenChange={setShowAddDialog} onSuccess={handleStudentAdded} allStudents={allStudents} schoolId={schoolId} schoolCode={schoolCode}/>
          <CSVUploadModal open={showCSVModal} onOpenChange={setShowCSVModal} onImported={handleBulkImported} schoolId={schoolId} schoolCode={schoolCode}/>
        </>
      )}
    </div>
  );
}