import { useCallback } from 'react';
import Papa from 'papaparse';
import { Upload } from 'lucide-react';

interface FileUploadProps {
  onUpload: (data: string[][], headers: string[]) => void;
}

export function FileUpload({ onUpload }: FileUploadProps) {
  const handleFile = useCallback((file: File) => {
    Papa.parse(file, {
      complete: (results) => {
        const data = results.data as string[][];
        if (data.length > 1) {
          const headers = data[0];
          const rows = data.slice(1).filter(row => row.some(cell => cell.trim()));
          onUpload(rows, headers);
        }
      },
      error: (error) => {
        console.error('Parse error:', error);
        alert('Failed to parse CSV file');
      }
    });
  }, [onUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) {
      handleFile(file);
    }
  }, [handleFile]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div className="max-w-xl mx-auto">
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-blue-500 transition-colors"
      >
        <Upload className="mx-auto h-12 w-12 text-gray-400" />
        <p className="mt-4 text-lg font-medium text-gray-900">
          Drop your CSV file here
        </p>
        <p className="mt-2 text-sm text-gray-500">or</p>
        <label className="mt-4 inline-block">
          <span className="px-4 py-2 bg-blue-600 text-white rounded-md cursor-pointer hover:bg-blue-700">
            Browse Files
          </span>
          <input
            type="file"
            accept=".csv"
            onChange={handleChange}
            className="hidden"
          />
        </label>
      </div>
    </div>
  );
}
