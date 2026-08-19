"use client";

import Papa from 'papaparse';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const exportToCsv = (filename: string, data: any[]) => {
  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
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
  doc.text(title, 14, 16);
  
  autoTable(doc, {
    head: [headers],
    body: data,
    startY: 20,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [79, 70, 229], // Indigo moderno
      textColor: 255,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });
  
  doc.save(filename);
};

export interface BankStatementPdfOptions {
  clientName: string;
  phone?: string | null;
  totalCharges: number;
  totalPayments: number;
  pendingBalance: number;
  transactions: {
    date: string;
    type: string;
    description: string;
    amount: string;
    balance: string;
  }[];
}

export const exportBankStatementPdf = (options: BankStatementPdfOptions) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Encabezado Banco / Oinkash
  doc.setFillColor(30, 27, 75); // Slate 950
  doc.rect(0, 0, pageWidth, 40, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('OINKASH FINANCIAL', 14, 18);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(199, 210, 254);
  doc.text('ESTADO DE CUENTA Y RESUMEN DE MOVIMIENTOS', 14, 25);
  doc.text(`Fecha de Emisión: ${new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}`, 14, 31);

  // Tarjeta de Datos del Cliente
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, 46, pageWidth - 28, 24, 3, 3, 'F');

  doc.setTextColor(71, 85, 105);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('TITULAR / CLIENTE:', 20, 54);
  doc.text('TELÉFONO / CONTACTO:', 120, 54);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.text(options.clientName, 20, 62);
  doc.text(options.phone || 'No registrado', 120, 62);

  // Tabla de Movimientos
  const headers = ['FECHA', 'TIPO', 'CONCEPTO / MOTIVO', 'MONTO', 'SALDO'];
  const rows = options.transactions.map(t => [
    t.date,
    t.type,
    t.description,
    t.amount,
    t.balance
  ]);

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 76,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 3,
      textColor: [30, 41, 59],
      valign: 'middle',
    },
    headStyles: {
      fillColor: [79, 70, 229],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 26, halign: 'center' },
      1: { cellWidth: 32, fontStyle: 'bold' },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
      4: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 10;

  // Cuadro de Resumen y Totales Finales
  if (finalY < 240) {
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(pageWidth - 95, finalY, 81, 38, 3, 3, 'F');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('Total Cargos:', pageWidth - 90, finalY + 8);
    doc.text('Total Abonos:', pageWidth - 90, finalY + 16);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(225, 29, 72); // Rose
    doc.text(`+$${options.totalCharges.toFixed(2)}`, pageWidth - 20, finalY + 8, { align: 'right' });

    doc.setTextColor(16, 185, 129); // Emerald
    doc.text(`-$${options.totalPayments.toFixed(2)}`, pageWidth - 20, finalY + 16, { align: 'right' });

    doc.setDrawColor(203, 213, 225);
    doc.line(pageWidth - 90, finalY + 22, pageWidth - 20, finalY + 22);

    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('SALDO PENDIENTE:', pageWidth - 90, finalY + 31);
    doc.setTextColor(79, 70, 229);
    doc.text(`$${options.pendingBalance.toFixed(2)}`, pageWidth - 20, finalY + 31, { align: 'right' });
  }

  // Guardar archivo
  doc.save(`Estado_de_Cuenta_${options.clientName.replace(/\s+/g, '_')}.pdf`);
};