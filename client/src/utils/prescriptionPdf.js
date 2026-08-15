// ============================================
// Prescription PDF generator (client-side)
// ============================================
// Builds a formatted PDF from a prescription record. Runs entirely in the
// browser (no backend load). Includes the doctor's medical registration
// number, as required on prescriptions per NMC guidelines.

// jsPDF is loaded lazily (dynamic import) — it bundles some heavy plugins we
// don't use (html2canvas, DOMPurify), so importing it at the top would bloat
// EVERY page's bundle. Loading it only when a user actually downloads/shares
// a prescription keeps the rest of the site fast.

const formatDate = (dateString) =>
  dateString
    ? new Date(dateString).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })
    : '';

// Builds the PDF document (jsPDF instance) for a prescription.
function buildPrescriptionDoc(jsPDF, rx) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 48;
  let y = 56;

  // ---- Header ----
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(37, 99, 235); // primary blue
  doc.text('ProMedicoz', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  doc.text('Online Doctor Consultation Platform', margin, y + 14);

  doc.setDrawColor(220, 220, 220);
  y += 26;
  doc.line(margin, y, pageWidth - margin, y);
  y += 24;

  // ---- Doctor info ----
  doc.setTextColor(30, 30, 30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(`Dr. ${rx.doctor?.name || ''}`, margin, y);
  y += 16;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(90, 90, 90);
  const credentialsLine = [rx.doctor?.qualification, rx.doctor?.specialization].filter(Boolean).join(' | ');
  if (credentialsLine) { doc.text(credentialsLine, margin, y); y += 13; }
  if (rx.doctor?.medicalRegistrationNo) {
    doc.text(`Medical Registration No: ${rx.doctor.medicalRegistrationNo}`, margin, y);
    y += 13;
  }

  // ---- Patient + date (right aligned) ----
  const rightX = pageWidth - margin;
  let ry = y - (credentialsLine ? 29 : 16) + 16;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 30, 30);
  doc.text(`Patient: ${rx.patient?.name || ''}`, rightX, ry, { align: 'right' });
  ry += 13;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(90, 90, 90);
  doc.text(`Date: ${formatDate(rx.createdAt)}`, rightX, ry, { align: 'right' });
  if (rx.appointment?.date) {
    ry += 13;
    doc.text(`Consultation: ${formatDate(rx.appointment.date)} ${rx.appointment.timeSlot || ''}`, rightX, ry, { align: 'right' });
  }

  y += 16;
  doc.setDrawColor(230, 230, 230);
  doc.line(margin, y, pageWidth - margin, y);
  y += 26;

  const sectionTitle = (title) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(37, 99, 235);
    doc.text(title, margin, y);
    y += 16;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(40, 40, 40);
  };

  const wrapText = (text, maxWidth) => doc.splitTextToSize(text, maxWidth);

  // ---- Diagnosis ----
  if (rx.diagnosis) {
    sectionTitle('Diagnosis');
    const lines = wrapText(rx.diagnosis, pageWidth - margin * 2);
    doc.text(lines, margin, y);
    y += lines.length * 13 + 14;
  }

  // ---- Medicines ----
  if (rx.medicines && rx.medicines.length > 0) {
    sectionTitle('Medicines');
    rx.medicines.forEach((med, idx) => {
      const parts = [med.name];
      if (med.dosage) parts.push(med.dosage);
      if (med.frequency) parts.push(med.frequency);
      if (med.duration) parts.push(med.duration);
      let line = `${idx + 1}. ${parts.join(' — ')}`;
      const lines = wrapText(line, pageWidth - margin * 2 - 10);
      doc.text(lines, margin + 10, y);
      y += lines.length * 13;
      if (med.instructions) {
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(110, 110, 110);
        const instrLines = wrapText(`(${med.instructions})`, pageWidth - margin * 2 - 20);
        doc.text(instrLines, margin + 20, y);
        y += instrLines.length * 12;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(40, 40, 40);
      }
      y += 4;
    });
    y += 10;
  }

  // ---- Tests recommended ----
  if (rx.testsRecommended && rx.testsRecommended.length > 0) {
    sectionTitle('Tests Recommended');
    rx.testsRecommended.forEach((test) => {
      doc.text(`• ${test}`, margin + 10, y);
      y += 14;
    });
    y += 10;
  }

  // ---- Notes ----
  if (rx.notes) {
    sectionTitle('Notes');
    const lines = wrapText(rx.notes, pageWidth - margin * 2);
    doc.text(lines, margin, y);
    y += lines.length * 13 + 14;
  }

  // ---- Follow-up ----
  if (rx.followUpDate) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(37, 99, 235);
    doc.text(`Follow-up Date: ${formatDate(rx.followUpDate)}`, margin, y);
    y += 20;
  }

  // ---- Footer / disclaimer ----
  const footerY = doc.internal.pageSize.getHeight() - 50;
  doc.setDrawColor(230, 230, 230);
  doc.line(margin, footerY - 12, pageWidth - margin, footerY - 12);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(140, 140, 140);
  const disclaimer = wrapText(
    'This is a digitally generated prescription issued via ProMedicoz teleconsultation, in accordance with the Telemedicine Practice Guidelines (India). It is valid without a physical signature.',
    pageWidth - margin * 2
  );
  doc.text(disclaimer, margin, footerY);

  return doc;
}

// Trigger a download of the prescription PDF.
export async function downloadPrescriptionPdf(rx) {
  const { jsPDF } = await import('jspdf');
  const doc = buildPrescriptionDoc(jsPDF, rx);
  const fileName = `Prescription_${(rx.doctor?.name || 'Doctor').replace(/\s+/g, '_')}_${formatDate(rx.createdAt).replace(/\s+/g, '_')}.pdf`;
  doc.save(fileName);
}

// Get the prescription PDF as a File object (for sharing via the Web Share API).
export async function getPrescriptionPdfFile(rx) {
  const { jsPDF } = await import('jspdf');
  const doc = buildPrescriptionDoc(jsPDF, rx);
  const blob = doc.output('blob');
  const fileName = `Prescription_${(rx.doctor?.name || 'Doctor').replace(/\s+/g, '_')}.pdf`;
  return new File([blob], fileName, { type: 'application/pdf' });
}
