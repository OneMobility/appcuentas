import Papa from 'papaparse';
import jsPDF from 'jspdf';
import 'jspdf-autotable'; // This extends jsPDF

export const exportToCsv = (filename: string, data: any[]) => {
  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) { // Feature detection for download attribute
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

export const exportToPdf = (filename: string, title: string, headers: string[], data: any[][]) => {
  const doc = new jsPDF();
  doc.text(title, 14, 16); // Title at top-left
  (doc as any).autoTable({
    head: [headers],
    body: data,
    startY: 20, // Start table below title
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [22, 163, 74], // A green color for headers
      textColor: 255,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [243, 244, 246], // Light gray for alternate rows
    },
  });
  doc.save(filename);
};