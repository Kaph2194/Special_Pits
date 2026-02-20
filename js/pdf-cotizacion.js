// ============================================
// GENERAR PDF
// ============================================

window.generarPDFCotizacion = async function() {
    if (!clienteSeleccionado || !vehiculoSeleccionado || itemsCotizacion.length === 0) {
        mostrarNotificacion('⚠️ Complete todos los datos de la cotización primero', 'warning');
        return;
    }

    try {
        mostrarNotificacion('📄 Generando PDF...', 'info');

        // Importar módulo PDF
        const { generarPDFCotizacion, mostrarVistaPreviaModal } = await import('./pdf-cotizacion.js');

        // Preparar datos
        const cotizacionData = {
            folio: `COT-PREVIEW-${Date.now()}`,
            cliente: clienteSeleccionado,
            vehiculo: vehiculoSeleccionado,
            fecha_cotizacion: document.getElementById('fechaCotizacion').value,
            valida_hasta: document.getElementById('validaHasta').value,
            items: itemsCotizacion.map(item => ({
                cantidad: item.cantidad,
                nombre: item.nombre,
                descripcion: item.tipo === 'repuesto' ? `Código: ${item.nombre.split('-')[0]}` : '',
                tipo: item.tipo,
                precio_unitario: item.precio_unitario,
                total: item.total
            })),
            subtotal: calcularSubtotalCotizacion(),
            iva: calcularIVACotizacion(),
            total: calcularTotalCotizacion(),
            observaciones: document.getElementById('observacionesCotizacion').value?.trim() || null
        };

        // Datos para email
        const emailData = {
            cotizacionId: null, // Se asignará después de guardar
            folio: cotizacionData.folio,
            clienteEmail: clienteSeleccionado.email || '',
            clienteNombre: clienteSeleccionado.razon_social,
            vehiculoPlaca: vehiculoSeleccionado.placa,
            empresaNombre: 'Special PITS',
            empresaTelefono: '(301) 135-4863'
        };

        // Generar HTML
        const htmlPDF = await generarPDFCotizacion(cotizacionData);

        // Mostrar vista previa
        mostrarVistaPreviaModal(htmlPDF, emailData);

    } catch (error) {
        console.error('Error generando PDF:', error);
        mostrarNotificacion('❌ Error generando PDF: ' + error.message, 'error');
    }
}