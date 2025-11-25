"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Download, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { showSuccess, showError } from "@/utils/toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// Mock data structures (simplified for report generation)
interface ReportTransaction {
  date: string;
  description: string;
  amount: number;
  type: string; // e.g., "Ingreso", "Egreso", "Cargo", "Pago", "Abono"
  category?: string; // For cash transactions
  entity?: string; // For cards, debtors, creditors
}

// Mock data for demonstration
// NOTE: In a real application, this data would be fetched from a centralized state management
// (e.g., a global context, Redux, Zustand) or an API.
const mockCashTransactions: ReportTransaction[] = [
  { date: "2023-10-26", description: "Salario", amount: 1000, type: "Ingreso", category: "Salario" },
  { date: "2023-10-25", description: "Compras supermercado", amount: 250, type: "Egreso", category: "Comida" },
  { date: "2023-10-24", description: "Venta de artículo", amount: 500, type: "Ingreso", category: "Ventas" },
  { date: "2023-10-23", description: "Cena con amigos", amount: 150, type: "Egreso", category: "Entretenimiento" },
  { date: "2023-09-30", description: "Freelance project", amount: 2000, type: "Ingreso", category: "Ventas" },
  { date: "2023-09-28", description: "Alquiler", amount: 800, type: "Egreso", category: "Alquiler" },
  { date: "2023-09-15", description: "Inversión", amount: 300, type: "Ingreso", category: "Inversiones" },
];

const mockCardTransactions: ReportTransaction[] = [
  { date: "2023-10-20", description: "Compra en línea", amount: 500, type: "Cargo", entity: "Visa Principal" },
  { date: "2023-10-22", description: "Retiro en cajero", amount: 300, type: "Cargo", entity: "Débito Ahorro" },
  { date: "2023-10-26", description: "Restaurante", amount: 100, type: "Cargo", entity: "Amex Viajes" },
  { date: "2023-10-15", description: "Pago tarjeta", amount: 200, type: "Pago", entity: "Visa Principal" },
  { date: "2023-09-05", description: "Cargo suscripción", amount: 50, type: "Cargo", entity: "Amex Viajes" },
  { date: "2023-09-10", description: "Pago tarjeta", amount: 150, type: "Pago", entity: "Débito Ahorro" },
];

const mockDebtorPayments: ReportTransaction[] = [
  { date: "2023-10-20", description: "Abono de Juan Pérez", amount: 200, type: "Abono", entity: "Juan Pérez" },
  { date: "2023-09-10", description: "Abono de María García", amount: 100, type: "Abono", entity: "María García" },
];

const mockCreditorPayments: ReportTransaction[] = [
  { date: "2023-10-15", description: "Pago a Banco XYZ", amount: 500, type: "Pago", entity: "Banco XYZ" },
  { date: "2023-10-22", description: "Pago a Tienda de Electrónica", amount: 500, type: "Pago", entity: "Tienda de Electrónica" },
  { date: "2023-09-01", description: "Pago a Proveedor ABC", amount: 200, type: "Pago", entity: "Proveedor ABC" },
];

const convertToCsv = (data: ReportTransaction[]): string => {
  if (data.length === 0) return "";

  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(","),
    ...data.map(row => headers.map(fieldName => {
      const value = (row as any)[fieldName];
      if (typeof value === 'string' && value.includes(',')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(','))
  ];
  return csvRows.join("\n");
};

const downloadCsv = (csvString: string, filename: string) => {
  const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } else {
    showError("Tu navegador no soporta la descarga de archivos directamente.");
  }
};

const Reports = () => {
  const [reportType, setReportType] = useState<string>("cash");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [previewData, setPreviewData] = useState<ReportTransaction[]>([]);
  const [currentFilename, setCurrentFilename] = useState<string>("reporte.csv");

  const getFilteredData = () => {
    let reportData: ReportTransaction[] = [];
    let filename = "reporte.csv";

    switch (reportType) {
      case "cash":
        reportData = mockCashTransactions;
        filename = "reporte_efectivo.csv";
        break;
      case "cards":
        reportData = mockCardTransactions;
        filename = "reporte_tarjetas.csv";
        break;
      case "debtors":
        reportData = mockDebtorPayments;
        filename = "reporte_deudores.csv";
        break;
      case "creditors":
        reportData = mockCreditorPayments;
        filename = "reporte_acreedores.csv";
        break;
      default:
        return { filteredData: [], filename: "reporte.csv" };
    }

    const filtered = reportData.filter(tx => {
      const txDate = new Date(tx.date);
      const fromDate = dateRange?.from ? new Date(dateRange.from) : null;
      const toDate = dateRange?.to ? new Date(dateRange.to) : null;

      let matches = true;
      if (fromDate) {
        fromDate.setHours(0, 0, 0, 0);
        matches = matches && txDate >= fromDate;
      }
      if (toDate) {
        toDate.setHours(23, 59, 59, 999);
        matches = matches && txDate <= toDate;
      }
      return matches;
    });

    return { filteredData: filtered, filename };
  };

  const handlePreviewReport = () => {
    if (!reportType) {
      showError("Por favor, selecciona un tipo de reporte.");
      return;
    }
    if (!dateRange?.from) {
      showError("Por favor, selecciona al menos una fecha de inicio para el reporte.");
      return;
    }

    const { filteredData, filename } = getFilteredData();
    if (filteredData.length === 0) {
      showError("No se encontraron datos para el rango de fechas y tipo de reporte seleccionados.");
      setPreviewData([]);
      return;
    }
    setPreviewData(filteredData);
    setCurrentFilename(filename);
    showSuccess("Vista previa del reporte generada.");
  };

  const handleExportReport = () => {
    if (!reportType) {
      showError("Por favor, selecciona un tipo de reporte.");
      return;
    }
    if (!dateRange?.from) {
      showError("Por favor, selecciona al menos una fecha de inicio para el reporte.");
      return;
    }

    const { filteredData, filename } = getFilteredData();
    if (filteredData.length === 0) {
      showError("No se encontraron datos para el rango de fechas y tipo de reporte seleccionados.");
      return;
    }

    const csvString = convertToCsv(filteredData);
    downloadCsv(csvString, filename);
    showSuccess(`Reporte de ${reportType} exportado exitosamente.`);
  };

  return (
    <div className="flex flex-col gap-6 p-4">
      <h1 className="text-3xl font-bold">Generar Reportes</h1>

      <Card>
        <CardHeader>
          <CardTitle>Opciones de Reporte</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 items-center gap-4">
            <Label htmlFor="reportType">Tipo de Reporte</Label>
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger id="reportType">
                <SelectValue placeholder="Selecciona un tipo de reporte" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Efectivo (Ingresos/Egresos)</SelectItem>
                <SelectItem value="cards">Tarjetas (Cargos/Pagos)</SelectItem>
                <SelectItem value="debtors">Deudores (Abonos)</SelectItem>
                <SelectItem value="creditors">Acreedores (Pagos)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 items-center gap-4">
            <Label htmlFor="dateRange">Rango de Fechas</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="dateRange"
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dateRange && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "dd/MM/yyyy", { locale: es })} -{" "}
                        {format(dateRange.to, "dd/MM/yyyy", { locale: es })}
                      </>
                    ) : (
                      format(dateRange.from, "dd/MM/yyyy", { locale: es })
                    )
                  ) : (
                    <span>Selecciona un rango de fechas</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                  locale={es}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 mt-4">
            <Button onClick={handlePreviewReport} className="w-full sm:w-auto">
              <Eye className="h-4 w-4 mr-2" />
              Ver Previa
            </Button>
            <Button onClick={handleExportReport} className="w-full sm:w-auto">
              <Download className="h-4 w-4 mr-2" />
              Exportar Reporte
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vista Previa del Reporte</CardTitle>
        </CardHeader>
        <CardContent>
          {previewData.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {Object.keys(previewData[0]).map((header) => (
                      <TableHead key={header}>{header.charAt(0).toUpperCase() + header.slice(1)}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.map((row, rowIndex) => (
                    <TableRow key={rowIndex}>
                      {Object.entries(row).map(([key, cell], cellIndex) => (
                        <TableCell key={cellIndex}>
                          {key === "date" ? format(new Date(cell as string), "dd/MM/yyyy", { locale: es }) : cell}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-muted-foreground">
              Selecciona un tipo de reporte y un rango de fechas, luego haz clic en "Ver Previa" para ver los datos aquí.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Reports;