import React, { useState } from 'react';
import Modal from '../../../components/common/Modal.jsx';
import {
  Upload,
  Download,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

export default function BulkImportModal({
  isOpen,
  onClose,
  onSuccess,
  courses = [],
  api,
  showToast,
}) {
  const [selectedCourseId, setSelectedCourseId] = useState(courses[0]?.id || '');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (selected) {
      if (!selected.name.endsWith('.csv')) {
        setError('Only .csv files are supported for bulk question import.');
        setFile(null);
        return;
      }
      setFile(selected);
      setError('');
      setResult(null);
    }
  };

  const handleDownloadTemplate = () => {
    const csvContent =
      'title,description,type,difficulty,marks,negativeMarks,topic,options,correctAnswers,explanation\n' +
      '"What is the worst-case time complexity of QuickSort?","Standard randomized vs deterministic","SINGLE_MCQ","MEDIUM",2,0.5,"Algorithms","O(n)|O(n log n)|O(n^2)|O(1)","O(n^2)","When the pivot chosen is always the extreme element."\n' +
      '"Which of the following are linear data structures?","Select all valid types","MULTIPLE_MCQ","EASY",2,0,"Data Structures","Array|Stack|Queue|Binary Tree","Array|Stack|Queue","Arrays, stacks, and queues are linear, trees are hierarchical."\n' +
      '"In a max-heap, the root node has the maximum key.","Heap property definition","TRUE_FALSE","EASY",1,0,"Heaps","True|False","True","By definition in a max-heap."\n' +
      '"Explain the ACID properties of relational databases.","Short answer evaluation","DESCRIPTIVE","HARD",5,0,"Databases","Atomicity, Consistency, Isolation, Durability","Atomicity, Consistency, Isolation, Durability","Graded on accuracy of each property explanation."';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'examsphere_questions_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Downloaded sample CSV template!', 'info');
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a CSV file to upload.');
      return;
    }
    if (!selectedCourseId) {
      setError('Please select a course for the imported questions.');
      return;
    }

    setUploading(true);
    setError('');
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('courseId', selectedCourseId);

    try {
      const res = await api.post('/questions/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setResult(res.data);
      showToast(`Successfully imported ${res.data?.createdCount || 0} questions!`, 'success');
      onSuccess();
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to import CSV file.';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Bulk Question Import"
      subtitle="Import multiple questions into your question bank using a CSV file"
      maxWidth="max-w-lg"
    >
      <div className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <p className="font-bold">Import Completed Successfully!</p>
              <p className="text-[11px] text-emerald-400/80">
                Created {result.createdCount} question{result.createdCount !== 1 ? 's' : ''} in this course.
              </p>
            </div>
          </div>
        )}

        {/* Step 1: Select Target Course */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-300 mb-1">
            Target Course Assignment *
          </label>
          <select
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id} className="bg-slate-900 text-slate-100">
                {c.code} – {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Template Download Card */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h5 className="text-xs font-semibold text-slate-200">CSV Template</h5>
              <p className="text-[11px] text-slate-400">Standard format for single/multi MCQ, T/F, descriptive</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            <span>Download</span>
          </button>
        </div>

        {/* File Dropzone */}
        <form onSubmit={handleUpload} className="space-y-4">
          <div className="relative border-2 border-dashed border-slate-700 hover:border-blue-500/60 rounded-2xl p-6 text-center transition bg-slate-950/40">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center justify-center space-y-2 pointer-events-none">
              <div className="p-3 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400">
                <Upload className="w-5 h-5" />
              </div>
              <p className="text-xs font-medium text-slate-200">
                {file ? file.name : 'Click or drag CSV file to upload'}
              </p>
              <p className="text-[10px] text-slate-500">
                Supported format: Comma-Separated Values (.csv), max 5MB
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold transition"
            >
              {result ? 'Done' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={uploading || !file}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-blue-600/30 transition flex items-center gap-1.5"
            >
              {uploading && (
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              <span>Upload & Import</span>
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
