import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { Diagnosis } from '../db';

export const generateOutbreakPDF = (diagnoses: Diagnosis[], markers: any[]) => {
  const doc = new jsPDF();

  // Header
  doc.setFontSize(22);
  doc.setTextColor(37, 99, 235); // Blue-600
  doc.text('HealthAssist AI: Outbreak Analysis Report', 14, 22);

  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139); // Gray-500
  doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);

  // Summary Section
  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59); // Gray-800
  doc.text('Regional Summary', 14, 45);

  const summaryData = [
    ['Total Assessments', diagnoses.length.toString()],
    ['Active Risk Clusters', markers.length.toString()],
    ['High Risk Clusters', markers.filter(m => m.type === 'High').length.toString()],
    ['Medium Risk Clusters', markers.filter(m => m.type === 'Medium').length.toString()],
    ['Low Risk Clusters', markers.filter(m => m.type === 'Low').length.toString()],
  ];

  (doc as any).autoTable({
    startY: 50,
    head: [['Metric', 'Value']],
    body: summaryData,
    theme: 'striped',
    headStyles: { fillColor: [37, 99, 235] },
  });

  // Outbreak Clusters Section
  doc.setFontSize(16);
  doc.text('Active Outbreak Clusters', 14, (doc as any).lastAutoTable.finalY + 15);

  const clusterData = markers.map(m => [
    m.id.toString(),
    m.type,
    m.count.toString(),
    `${m.lat.toFixed(4)}, ${m.lng.toFixed(4)}`,
  ]);

  (doc as any).autoTable({
    startY: (doc as any).lastAutoTable.finalY + 20,
    head: [['Cluster ID', 'Risk Level', 'Case Count', 'Coordinates']],
    body: clusterData,
    theme: 'grid',
    headStyles: { fillColor: [249, 115, 22] }, // Orange-500
  });

  // Recent Diagnoses Section
  doc.setFontSize(16);
  doc.text('Recent Patient Assessments', 14, (doc as any).lastAutoTable.finalY + 15);

  const diagnosisData = diagnoses.slice(0, 20).map(d => [
    new Date(d.createdAt).toLocaleDateString(),
    d.prediction.conditions[0],
    d.prediction.riskLevel,
    d.symptoms.substring(0, 50) + '...',
  ]);

  (doc as any).autoTable({
    startY: (doc as any).lastAutoTable.finalY + 20,
    head: [['Date', 'Condition', 'Risk', 'Symptoms']],
    body: diagnosisData,
    theme: 'striped',
    headStyles: { fillColor: [30, 41, 59] }, // Gray-800
  });

  // Footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Page ${i} of ${pageCount} - HealthAssist AI Confidential`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  doc.save(`Outbreak_Analysis_${new Date().toISOString().split('T')[0]}.pdf`);
};
