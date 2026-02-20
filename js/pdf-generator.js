// js/pdf-generator.js
import { supabase } from './supabase-config.js';
import { formatearMoneda, formatearFecha } from './utils.js';

// Usaremos jsPDF y jsPDF-AutoTable
// Cargar desde CDN en el HTML: 
// <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
// <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js"></script>

const { jsPDF } = window.jspdf;

function numeroALetras(numero) {
    const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
    const decenas = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
    const especiales = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
    const centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

    if (numero === 0) return 'CERO PESOS CON 00/100';
    if (numero === 100) return 'CIEN PESOS CON 00/100';

    const partes = numero.toFixed(2).split('.');
    const entero = parseInt(partes[0]);
    const decimal = parseInt(partes[1]);

    let letras = '';

    // Millones
    if (entero >= 1000000) {
        const millones = Math.floor(entero / 1000000);
        if (millones === 1) {
            letras += 'UN MILLÓN ';
        } else {
            letras += convertirGrupo(millones) + ' MILLONES ';
        }
    }

    // Miles
    const resto = entero % 1000000;
    if (resto >= 1000) {
        const miles = Math.floor(resto / 1000);
        if (miles === 1) {
            letras += 'MIL ';
        } else {
            letras += convertirGrupo(miles) + ' MIL ';
        }
    }

    // Centenas
    const ultimos = entero % 1000;
    if (ultimos > 0) {
        letras += convertirGrupo(ultimos);
    }

    letras = letras.trim() + ' PESOS CON ' + decimal.toString().padStart(2, '0') + '/100';

    return letras;

    function convertirGrupo(n) {
        if (n === 0) return '';
        
        let result = '';
        const c = Math.floor(n / 100);
        
        if (c > 0) {
            if (n === 100) return 'CIEN';
            result += centenas[c] + ' ';
        }
        
        const du = n % 100;
        if (du >= 10 && du < 20) {
            result += especiales[du - 10];
        } else {
            const d = Math.floor(du / 10);
            const u = du % 10;
            
            if (d > 0) {
                result += decenas[d];
                if (u > 0) result += ' Y ' + unidades[u];
            } else if (u > 0) {
                result += unidades[u];
            }
        }
        
        return result.trim();
    }
}

// ============================================
// GENERAR PDF DE COTIZACIÓN
// ============================================
export async function generarPDFCotizacion(cotizacionId) {
    try {
        // Cargar datos completos de la cotización
        const { data: cotizacion, error } = await supabase
            .from('v_cotizaciones_completas')
            .select('*')
            .eq('id', cotizacionId)
            .single();
        
        if (error) throw error;
        
        // Cargar servicios
        const { data: servicios } = await supabase
            .from('cotizacion_servicios')
            .select('*, servicios(*)')
            .eq('cotizacion_id', cotizacionId)
            .order('orden');
        
        // Cargar repuestos
        const { data: repuestos } = await supabase
            .from('cotizacion_repuestos')
            .select('*, repuestos(*)')
            .eq('cotizacion_id', cotizacionId)
            .order('orden');
        
        // Cargar mano de obra
        const { data: manoObra } = await supabase
            .from('cotizacion_mano_obra')
            .select('*, mano_obra(*)')
            .eq('cotizacion_id', cotizacionId)
            .order('orden');
        
        // Crear PDF
        const doc = new jsPDF();
        let yPos = 20;
        
        // ENCABEZADO
        doc.setFontSize(20);
        doc.setTextColor(37, 99, 235); // Primary color
        doc.text('SPECIAL CAR', 105, yPos, { align: 'center' });
        
        yPos += 10;
        doc.setFontSize(16);
        doc.text('COTIZACIÓN', 105, yPos, { align: 'center' });
        
        yPos += 15;
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        
        // Información de la empresa
        doc.text('NIT: 900.123.456-1', 20, yPos);
        doc.text('Dirección: Calle 123 #45-67', 20, yPos + 5);
        doc.text('Teléfono: (601) 123 4567', 20, yPos + 10);
        
        // Información de la cotización
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text(`COTIZACIÓN No. ${cotizacion.folio}`, 140, yPos);
        doc.setFont(undefined, 'normal');
        doc.setFontSize(10);
        doc.text(`Fecha: ${formatearFecha(cotizacion.fecha_cotizacion)}`, 140, yPos + 5);
        doc.text(`Estado: ${cotizacion.estado.toUpperCase()}`, 140, yPos + 10);
        
        yPos += 20;
        
        // INFORMACIÓN DEL CLIENTE
        doc.setFillColor(243, 244, 246);
        doc.rect(20, yPos, 170, 25, 'F');
        
        yPos += 5;
        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        doc.text('CLIENTE', 25, yPos);
        doc.setFont(undefined, 'normal');
        doc.setFontSize(9);
        yPos += 5;
        doc.text(`${cotizacion.cliente_nombre}`, 25, yPos);
        yPos += 4;
        doc.text(`NIT: ${cotizacion.cliente_nit || 'N/A'}`, 25, yPos);
        yPos += 4;
        doc.text(`Vehículo: ${cotizacion.vehiculo_placa} - ${cotizacion.vehiculo_marca || ''} ${cotizacion.vehiculo_linea || ''}`, 25, yPos);
        
        yPos += 10;
        
        // SERVICIOS
        if (servicios && servicios.length > 0) {
            doc.setFontSize(11);
            doc.setFont(undefined, 'bold');
            doc.text('SERVICIOS', 20, yPos);
            yPos += 5;
            
            const serviciosData = servicios.map(s => [
                s.servicios?.codigo || s.codigo || 'N/A',
                s.descripcion,
                s.cantidad,
                ''
            ]);
            
            doc.autoTable({
                startY: yPos,
                head: [['Código', 'Descripción', 'Cant', 'Observaciones']],
                body: serviciosData,
                theme: 'grid',
                styles: { fontSize: 9 },
                headStyles: { fillColor: [37, 99, 235] }
            });
            
            yPos = doc.lastAutoTable.finalY + 10;
        }
        
        // REPUESTOS
        if (repuestos && repuestos.length > 0) {
            if (yPos > 250) {
                doc.addPage();
                yPos = 20;
            }
            
            doc.setFontSize(11);
            doc.setFont(undefined, 'bold');
            doc.text('REPUESTOS', 20, yPos);
            yPos += 5;
            
            const repuestosData = repuestos.map(r => [
                r.repuestos?.codigo || 'N/A',
                r.repuestos?.nombre || 'N/A',
                r.cantidad,
                formatearMoneda(r.precio_unitario),
                r.descuento ? `${r.descuento}%` : '0%',
                formatearMoneda(r.total)
            ]);
            
            doc.autoTable({
                startY: yPos,
                head: [['Código', 'Descripción', 'Cant', 'P. Unit', 'Desc', 'Total']],
                body: repuestosData,
                theme: 'grid',
                styles: { fontSize: 9 },
                headStyles: { fillColor: [37, 99, 235] }
            });
            
            yPos = doc.lastAutoTable.finalY + 10;
        }
        
        // MANO DE OBRA
        if (manoObra && manoObra.length > 0) {
            if (yPos > 250) {
                doc.addPage();
                yPos = 20;
            }
            
            doc.setFontSize(11);
            doc.setFont(undefined, 'bold');
            doc.text('MANO DE OBRA', 20, yPos);
            yPos += 5;
            
            const manoObraData = manoObra.map(m => [
                m.mano_obra?.codigo || 'N/A',
                m.mano_obra?.nombre || 'N/A',
                m.cantidad,
                formatearMoneda(m.precio_unitario),
                formatearMoneda(m.total)
            ]);
            
            doc.autoTable({
                startY: yPos,
                head: [['Código', 'Descripción', 'Horas/Cant', 'P. Unit', 'Total']],
                body: manoObraData,
                theme: 'grid',
                styles: { fontSize: 9 },
                headStyles: { fillColor: [37, 99, 235] }
            });
            
            yPos = doc.lastAutoTable.finalY + 10;
        }
        
        // TOTALES
        if (yPos > 240) {
            doc.addPage();
            yPos = 20;
        }
        
        const totalesY = yPos;
        doc.setFillColor(243, 244, 246);
        doc.rect(110, totalesY, 80, 30, 'F');
        
        doc.setFontSize(10);
        doc.text('Subtotal:', 115, totalesY + 7);
        doc.text(formatearMoneda(cotizacion.subtotal), 175, totalesY + 7, { align: 'right' });
        
        doc.text('IVA (19%):', 115, totalesY + 14);
        doc.text(formatearMoneda(cotizacion.iva_total), 175, totalesY + 14, { align: 'right' });
        
        doc.setFont(undefined, 'bold');
        doc.setFontSize(12);
        doc.text('TOTAL:', 115, totalesY + 23);
        doc.text(formatearMoneda(cotizacion.total), 175, totalesY + 23, { align: 'right' });
        
        // Total en letras
        yPos = totalesY + 35;
        doc.setFont(undefined, 'normal');
        doc.setFontSize(9);
        doc.text(`SON: ${numeroALetras(cotizacion.total)}`, 20, yPos);
        
        // Validez
        yPos += 10;
        doc.text(`Cotización válida por 15 días a partir de la fecha de emisión.`, 20, yPos);
        
        // PIE DE PÁGINA
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(107, 114, 128);
            doc.text(
                `Página ${i} de ${pageCount}`,
                105,
                285,
                { align: 'center' }
            );
            doc.text(
                'Special Car - Sistema de Gestión de Taller',
                105,
                290,
                { align: 'center' }
            );
        }
        
        // Guardar PDF
        const pdfBlob = doc.output('blob');
        const nombreArchivo = `Cotizacion_${cotizacion.folio}_${new Date().getTime()}.pdf`;
        
        // Subir a Supabase Storage
        const { data: storageData, error: storageError } = await supabase.storage
            .from('documentos')
            .upload(nombreArchivo, pdfBlob, {
                contentType: 'application/pdf',
                cacheControl: '3600'
            });
        
        if (storageError) throw storageError;
        
        // Obtener URL pública
        const { data: urlData } = supabase.storage
            .from('documentos')
            .getPublicUrl(nombreArchivo);
        
        // Actualizar cotización con URL del PDF
        await supabase
            .from('cotizaciones')
            .update({ pdf_url: urlData.publicUrl })
            .eq('id', cotizacionId);
        
        return {
            url: urlData.publicUrl,
            blob: pdfBlob,
            nombreArchivo: nombreArchivo
        };
        
    } catch (error) {
        console.error('Error generando PDF:', error);
        throw error;
    }
}

// ============================================
// GENERAR PDF DE INSPECCIÓN
// ============================================
export async function generarPDFInspeccion(inspeccionId) {
    try {
        const { data: inspeccion, error } = await supabase
            .from('v_inspecciones_completas')
            .select('*')
            .eq('id', inspeccionId)
            .single();
        
        if (error) throw error;
        
        // Cargar detalles
        const { data: detalles } = await supabase
            .from('inspecciones_detalles')
            .select('*')
            .eq('inspeccion_id', inspeccionId)
            .order('categoria, orden');
        
        // Cargar fotos
        const { data: fotos } = await supabase
            .from('inspecciones_multimedia')
            .select('*')
            .eq('inspeccion_id', inspeccionId)
            .eq('tipo', 'foto')
            .order('orden');
        
        const doc = new jsPDF();
        let yPos = 20;
        
        // ENCABEZADO
        doc.setFontSize(20);
        doc.setTextColor(37, 99, 235);
        doc.text('SPECIAL CAR', 105, yPos, { align: 'center' });
        
        yPos += 10;
        doc.setFontSize(16);
        doc.text(`INSPECCIÓN DE ${inspeccion.tipo.toUpperCase()}`, 105, yPos, { align: 'center' });
        
        yPos += 15;
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        
        // Información
        doc.setFillColor(243, 244, 246);
        doc.rect(20, yPos, 170, 40, 'F');
        
        yPos += 5;
        doc.setFont(undefined, 'bold');
        doc.text('DATOS DEL VEHÍCULO', 25, yPos);
        doc.setFont(undefined, 'normal');
        yPos += 5;
        doc.text(`Placa: ${inspeccion.placa}`, 25, yPos);
        yPos += 5;
        doc.text(`Marca/Línea: ${inspeccion.marca || ''} ${inspeccion.linea || ''}`, 25, yPos);
        yPos += 5;
        doc.text(`Kilometraje: ${inspeccion.kilometraje?.toLocaleString()} km`, 25, yPos);
        yPos += 5;
        doc.text(`Combustible: ${inspeccion.nivel_combustible}`, 25, yPos);
        yPos += 5;
        doc.text(`Fecha: ${formatearFecha(inspeccion.fecha_hora)}`, 25, yPos);
        yPos += 5;
        doc.text(`Inspector: ${inspeccion.inspector_nombre}`, 25, yPos);
        
        yPos += 10;
        
        // CHECKLIST
        if (detalles && detalles.length > 0) {
            doc.setFont(undefined, 'bold');
            doc.text('CHECKLIST DE INSPECCIÓN', 20, yPos);
            yPos += 5;
            
            const checklistData = detalles.map(d => [
                d.categoria,
                d.elemento,
                d.estado === 'bueno' ? '✓ Bueno' : d.estado === 'regular' ? '~ Regular' : '✗ Malo',
                d.observaciones || '-'
            ]);
            
            doc.autoTable({
                startY: yPos,
                head: [['Categoría', 'Elemento', 'Estado', 'Observaciones']],
                body: checklistData,
                theme: 'grid',
                styles: { fontSize: 8 },
                headStyles: { fillColor: [37, 99, 235] },
                columnStyles: {
                    0: { cellWidth: 30 },
                    1: { cellWidth: 50 },
                    2: { cellWidth: 25 },
                    3: { cellWidth: 85 }
                }
            });
            
            yPos = doc.lastAutoTable.finalY + 10;
        }
        
        // INVENTARIO
        if (yPos > 240) {
            doc.addPage();
            yPos = 20;
        }
        
        doc.setFont(undefined, 'bold');
        doc.text('INVENTARIO DEL VEHÍCULO', 20, yPos);
        yPos += 5;
        doc.setFont(undefined, 'normal');
        doc.setFontSize(9);
        
        const inventario = [
            { label: 'Gato', value: inspeccion.tiene_gato },
            { label: 'Llanta de repuesto', value: inspeccion.tiene_llanta_repuesto },
            { label: 'Herramientas', value: inspeccion.tiene_herramientas },
            { label: 'Triángulos', value: inspeccion.tiene_triangulos },
            { label: 'Botiquín', value: inspeccion.tiene_botiquin },
            { label: 'Extintor', value: inspeccion.tiene_extintor },
            { label: 'Documentos', value: inspeccion.tiene_documentos },
            { label: 'Radio', value: inspeccion.tiene_radio },
            { label: 'Antena', value: inspeccion.tiene_antena },
            { label: 'Tapetes', value: inspeccion.tiene_tapetes },
            { label: 'Emblemas', value: inspeccion.tiene_emblemas }
        ];
        
        let col1X = 25;
        let col2X = 105;
        
        inventario.forEach((item, index) => {
            const x = index < 6 ? col1X : col2X;
            const y = yPos + ((index % 6) * 5);
            const check = item.value ? '☑' : '☐';
            doc.text(`${check} ${item.label}`, x, y);
        });
        
        yPos += 35;
        
        // FOTOS (solo primeras 4)
        if (fotos && fotos.length > 0) {
            doc.addPage();
            yPos = 20;
            
            doc.setFontSize(11);
            doc.setFont(undefined, 'bold');
            doc.text('EVIDENCIAS FOTOGRÁFICAS', 20, yPos);
            yPos += 10;
            
            doc.setFontSize(9);
            doc.text('(Ver reporte digital completo para todas las fotos)', 20, yPos);
            yPos += 10;
            
            // Nota: Para agregar imágenes al PDF necesitarías convertirlas a base64
            // Por simplicidad, solo listamos las fotos disponibles
            fotos.slice(0, 6).forEach((foto, index) => {
                doc.text(`${index + 1}. ${foto.angulo}: ${foto.descripcion || 'Sin descripción'}`, 25, yPos);
                yPos += 5;
            });
        }
        
        // FIRMAS
        if (yPos > 200) {
            doc.addPage();
            yPos = 20;
        } else {
            yPos += 20;
        }
        
        doc.setFont(undefined, 'bold');
        doc.text('FIRMAS', 20, yPos);
        yPos += 10;
        
        // Conductor
        if (inspeccion.firma_conductor) {
            try {
                doc.addImage(inspeccion.firma_conductor, 'PNG', 20, yPos, 80, 30);
            } catch (e) {
                console.warn('No se pudo agregar firma del conductor');
            }
        }
        doc.setFont(undefined, 'normal');
        doc.setFontSize(8);
        doc.text('_______________________________', 20, yPos + 35);
        doc.text(`${inspeccion.conductor_nombre}`, 20, yPos + 40);
        doc.text('Firma del Conductor', 20, yPos + 45);
        
        // Inspector
        if (inspeccion.firma_inspector) {
            try {
                doc.addImage(inspeccion.firma_inspector, 'PNG', 110, yPos, 80, 30);
            } catch (e) {
                console.warn('No se pudo agregar firma del inspector');
            }
        }
        doc.text('_______________________________', 110, yPos + 35);
        doc.text(`${inspeccion.inspector_nombre}`, 110, yPos + 40);
        doc.text('Firma del Inspector', 110, yPos + 45);
        
        // PIE DE PÁGINA
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(107, 114, 128);
            doc.text(`Página ${i} de ${pageCount}`, 105, 285, { align: 'center' });
        }
        
        // Guardar
        const pdfBlob = doc.output('blob');
        const nombreArchivo = `Inspeccion_${inspeccion.tipo}_${inspeccion.placa}_${new Date().getTime()}.pdf`;
        
        const { data: storageData, error: storageError } = await supabase.storage
            .from('documentos')
            .upload(nombreArchivo, pdfBlob, {
                contentType: 'application/pdf',
                cacheControl: '3600'
            });
        
        if (storageError) throw storageError;
        
        const { data: urlData } = supabase.storage
            .from('documentos')
            .getPublicUrl(nombreArchivo);
        
        return {
            url: urlData.publicUrl,
            blob: pdfBlob,
            nombreArchivo: nombreArchivo
        };
        
    } catch (error) {
        console.error('Error generando PDF de inspección:', error);
        throw error;
    }
}