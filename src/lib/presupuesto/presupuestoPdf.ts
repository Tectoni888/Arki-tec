/** PDF del presupuesto, en A4 vertical. */
import jsPDF from 'jspdf';
import { cantidadTexto, euros, importe, totales, type DatosEmpresa, type Presupuesto } from './presupuesto';

export function pdfPresupuesto(p: Presupuesto, empresa: DatosEmpresa): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const M = 15, W = 210 - 2 * M, PIE = 282;
  // Columnas: descripción | ud | cantidad | precio | importe (bordes derechos).
  const X = { desc: M, ud: M + 112, cant: M + 136, precio: M + 158, imp: M + W };
  let y = 18;
  const salto = (alto: number) => { if (y + alto > PIE) { doc.addPage(); y = 18; } };
  const gris = () => doc.setTextColor(100, 116, 139), negro = () => doc.setTextColor(30, 41, 59);

  // Cabecera: empresa a la izquierda, datos del presupuesto a la derecha.
  negro(); doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
  doc.text(empresa.nombre || 'Presupuesto', M, y);
  doc.setFontSize(11); doc.text('PRESUPUESTO', M + W, y, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); gris();
  const datosEmpresa = [empresa.nif && `NIF ${empresa.nif}`, empresa.direccion, [empresa.telefono, empresa.email].filter(Boolean).join(' · ')].filter(Boolean) as string[];
  datosEmpresa.forEach((linea, i) => doc.text(linea, M, y + 6 + i * 4.5));
  [p.numero && `N.º ${p.numero}`, `Fecha: ${p.fecha}`].filter(Boolean).forEach((linea, i) => doc.text(linea as string, M + W, y + 6 + i * 4.5, { align: 'right' }));
  y += 8 + Math.max(datosEmpresa.length, 2) * 4.5;
  doc.setDrawColor(14, 165, 233); doc.setLineWidth(0.6); doc.line(M, y, M + W, y); y += 7;

  negro(); doc.setFontSize(10);
  if (p.cliente) { doc.setFont('helvetica', 'bold'); doc.text('Cliente: ', M, y); doc.setFont('helvetica', 'normal'); doc.text(p.cliente, M + 17, y); y += 5.5; }
  if (p.obra) { doc.setFont('helvetica', 'bold'); doc.text('Obra: ', M, y); doc.setFont('helvetica', 'normal'); doc.text(doc.splitTextToSize(p.obra, W - 17), M + 17, y); y += 5.5; }
  y += 3;

  const t = totales(p);
  t.capitulos.forEach((cap, i) => {
    salto(20);
    doc.setFillColor(241, 245, 249); doc.rect(M, y - 4.5, W, 7, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); negro();
    doc.text(`${i + 1}. ${cap.capitulo}`, M + 2, y);
    doc.text(euros(cap.subtotal), X.imp - 2, y, { align: 'right' });
    y += 6;
    doc.setFontSize(7.5); gris(); doc.setFont('helvetica', 'normal');
    doc.text('Descripción', X.desc + 2, y); doc.text('Ud', X.ud, y, { align: 'right' }); doc.text('Cantidad', X.cant, y, { align: 'right' });
    doc.text('Precio', X.precio, y, { align: 'right' }); doc.text('Importe', X.imp - 2, y, { align: 'right' });
    y += 4.5;
    doc.setFontSize(9); negro();
    for (const l of cap.lineas) {
      const texto = doc.splitTextToSize(l.estancia ? `${l.descripcion} (${l.estancia})` : l.descripcion || '—', X.ud - X.desc - 14);
      const alto = texto.length * 4.2 + 1.8;
      salto(alto);
      doc.text(texto, X.desc + 2, y);
      doc.text(l.unidad.replace('²', '2'), X.ud, y, { align: 'right' }); doc.text(cantidadTexto(l.cantidad), X.cant, y, { align: 'right' });
      doc.text(euros(l.precio), X.precio, y, { align: 'right' }); doc.text(euros(importe(l)), X.imp - 2, y, { align: 'right' });
      y += alto;
    }
    y += 3;
  });

  salto(30);
  doc.setDrawColor(203, 213, 225); doc.setLineWidth(0.3); doc.line(M + W - 80, y, M + W, y); y += 6;
  doc.setFontSize(10); doc.setFont('helvetica', 'normal');
  doc.text('Base imponible', M + W - 80, y); doc.text(euros(t.base), X.imp - 2, y, { align: 'right' }); y += 5.5;
  doc.text(`IVA ${cantidadTexto(p.ivaPct)} %`, M + W - 80, y); doc.text(euros(t.iva), X.imp - 2, y, { align: 'right' }); y += 6.5;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
  doc.text('TOTAL', M + W - 80, y); doc.text(euros(t.total), X.imp - 2, y, { align: 'right' }); y += 10;

  if (empresa.condiciones.trim()) {
    const texto = doc.splitTextToSize(empresa.condiciones.trim(), W);
    salto(8 + texto.length * 4);
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.text('Condiciones', M, y); y += 4.5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); gris(); doc.text(texto, M, y);
  }
  const paginas = doc.getNumberOfPages();
  for (let n = 1; n <= paginas; n++) { doc.setPage(n); doc.setFontSize(7.5); gris(); doc.text(`Página ${n} de ${paginas}`, M + W, 290, { align: 'right' }); }
  return doc;
}
