// js/print-manager.js
import { formatearMoneda, formatearFecha, formatearFechaHora } from './utils.js';

export class PrintManager {
    
    // Imprimir Orden de Trabajo
    static imprimirOT(ot, repuestos = [], servicios = [], manoObra = []) {
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>OT ${ot.numero_ot}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                        font-family: Arial, sans-serif; 
                        font-size: 12px; 
                        padding: 20px;
                        color: #333;
                    }
                    .header {
                        text-align: center;
                        border-bottom: 3px solid #2563eb;
                        padding-bottom: 10px;
                        margin-bottom: 20px;
                    }
                    .header h1 { 
                        font-size: 24px; 
                        color: #2563eb;
                        margin-bottom: 5px;
                    }
                    .header p { 
                        font-size: 10px; 
                        color: #666; 
                    }
                    .info-grid {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 20px;
                        margin-bottom: 20px;
                    }
                    .info-box {
                        border: 1px solid #ddd;
                        padding: 10px;
                        border-radius: 5px;
                    }
                    .info-box h3 {
                        font-size: 14px;
                        color: #2563eb;
                        margin-bottom: 8px;
                        border-bottom: 1px solid #eee;
                        padding-bottom: 5px;
                    }
                    .info-box p {
                        margin: 5px 0;
                        font-size: 11px;
                    }
                    .info-box strong {
                        display: inline-block;
                        width: 120px;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 20px;
                    }
                    table th {
                        background: #2563eb;
                        color: white;
                        padding: 8px;
                        text-align: left;
                        font-size: 11px;
                    }
                    table td {
                        border: 1px solid #ddd;
                        padding: 6px;
                        font-size: 11px;
                    }
                    table tr:nth-child(even) {
                        background: #f9fafb;
                    }
                    .total-box {
                        text-align: right;
                        margin-top: 20px;
                        padding: 15px;
                        background: #f3f4f6;
                        border-radius: 5px;
                    }
                    .total-box .total {
                        font-size: 20px;
                        font-weight: bold;
                        color: #2563eb;
                    }
                    .observaciones {
                        margin-top: 20px;
                        padding: 10px;
                        background: #fef3c7;
                        border-left: 4px solid #f59e0b;
                        border-radius: 3px;
                    }
                    .firmas {
                        margin-top: 40px;
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 40px;
                    }
                    .firma {
                        border-top: 1px solid #000;
                        padding-top: 5px;
                        text-align: center;
                    }
                    @media print {
                        body { padding: 0; }
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🚗 SPECIAL CAR</h1>
                    <p>Servicio Automotriz Especializado</p>
                    <p>Tel: (601) 123-4567 | Email: info@specialcar.com</p>
                </div>

                <div style="text-align:center;margin-bottom:20px;">
                    <h2 style="font-size:18px;color:#2563eb;">ORDEN DE TRABAJO</h2>
                    <h3 style="font-size:16px;margin-top:5px;">${ot.numero_ot}</h3>
                </div>

                <div class="info-grid">
                    <div class="info-box">
                        <h3>📋 Información del Cliente</h3>
                        <p><strong>Cliente:</strong> ${ot.cliente_nombre || 'N/A'}</p>
                        <p><strong>NIT:</strong> ${ot.cliente_nit || 'N/A'}</p>
                        <p><strong>Teléfono:</strong> ${ot.cliente_telefono || 'N/A'}</p>
                        <p><strong>Email:</strong> ${ot.cliente_email || 'N/A'}</p>
                    </div>

                    <div class="info-box">
                        <h3>🚗 Información del Vehículo</h3>
                        <p><strong>Placa:</strong> ${ot.vehiculo_placa || 'N/A'}</p>
                        <p><strong>Marca:</strong> ${ot.vehiculo_marca || 'N/A'}</p>
                        <p><strong>Línea:</strong> ${ot.vehiculo_linea || 'N/A'}</p>
                        <p><strong>Modelo:</strong> ${ot.vehiculo_modelo || 'N/A'}</p>
                        <p><strong>Color:</strong> ${ot.vehiculo_color || 'N/A'}</p>
                    </div>
                </div>

                <div class="info-grid">
                    <div class="info-box">
                        <h3>📅 Fechas</h3>
                        <p><strong>Ingreso:</strong> ${formatearFecha(ot.fecha_ingreso)}</p>
                        ${ot.fecha_compromiso ? `<p><strong>Compromiso:</strong> ${formatearFecha(ot.fecha_compromiso)}</p>` : ''}
                        ${ot.fecha_finalizacion ? `<p><strong>Finalización:</strong> ${formatearFecha(ot.fecha_finalizacion)}</p>` : ''}
                    </div>

                    <div class="info-box">
                        <h3>👷 Información del Trabajo</h3>
                        <p><strong>Estado:</strong> ${ot.estado?.toUpperCase()}</p>
                        ${ot.mecanico_nombre ? `<p><strong>Mecánico:</strong> ${ot.mecanico_nombre}</p>` : ''}
                        <p><strong>KM Ingreso:</strong> ${ot.kilometraje_ingreso?.toLocaleString() || 'N/A'}</p>
                        ${ot.kilometraje_salida ? `<p><strong>KM Salida:</strong> ${ot.kilometraje_salida.toLocaleString()}</p>` : ''}
                    </div>
                </div>

                ${repuestos.length > 0 ? `
                    <h3 style="margin-top:20px;color:#2563eb;">🔩 Repuestos Utilizados</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>Código</th>
                                <th>Descripción</th>
                                <th>Cantidad</th>
                                <th>P. Unitario</th>
                                <th>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${repuestos.map(r => `
                                <tr>
                                    <td>${r.repuesto_codigo}</td>
                                    <td>${r.repuesto_nombre}</td>
                                    <td>${r.cantidad}</td>
                                    <td>${formatearMoneda(r.precio_unitario)}</td>
                                    <td>${formatearMoneda(r.total)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                ` : ''}

                ${servicios.length > 0 ? `
                    <h3 style="margin-top:20px;color:#2563eb;">⚙️ Servicios Realizados</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>Servicio</th>
                                <th>Descripción</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${servicios.map(s => `
                                <tr>
                                    <td>${s.servicio_nombre}</td>
                                    <td>${s.servicio_descripcion || '-'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                ` : ''}

                ${manoObra.length > 0 ? `
                    <h3 style="margin-top:20px;color:#2563eb;">👷 Mano de Obra</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>Concepto</th>
                                <th>Horas</th>
                                <th>Valor/Hora</th>
                                <th>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${manoObra.map(mo => `
                                <tr>
                                    <td>${mo.mo_nombre}</td>
                                    <td>${mo.horas}</td>
                                    <td>${formatearMoneda(mo.valor_hora)}</td>
                                    <td>${formatearMoneda(mo.total)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                ` : ''}

                ${ot.observaciones_ingreso ? `
                    <div class="observaciones">
                        <strong>Observaciones de Ingreso:</strong><br>
                        ${ot.observaciones_ingreso}
                    </div>
                ` : ''}

                ${ot.diagnostico ? `
                    <div class="observaciones" style="background:#dbeafe;border-color:#2563eb;margin-top:10px;">
                        <strong>🔍 Diagnóstico:</strong><br>
                        ${ot.diagnostico}
                    </div>
                ` : ''}

                ${ot.recomendaciones ? `
                    <div class="observaciones" style="background:#fef3c7;border-color:#f59e0b;margin-top:10px;">
                        <strong>💡 Recomendaciones:</strong><br>
                        ${ot.recomendaciones}
                    </div>
                ` : ''}

                <div class="total-box">
                    <p style="font-size:14px;margin-bottom:5px;">TOTAL A PAGAR</p>
                    <p class="total">${formatearMoneda(ot.total)}</p>
                </div>

                <div class="firmas">
                    <div class="firma">
                        <p><strong>Firma del Cliente</strong></p>
                        <p style="font-size:10px;margin-top:5px;">Nombre: _______________________</p>
                        <p style="font-size:10px;">CC: _______________________</p>
                    </div>
                    <div class="firma">
                        <p><strong>Firma del Mecánico</strong></p>
                        <p style="font-size:10px;margin-top:5px;">Nombre: ${ot.mecanico_nombre || '_______________________'}</p>
                    </div>
                </div>

                <div style="margin-top:30px;text-align:center;font-size:10px;color:#666;">
                    <p>Documento generado el ${formatearFechaHora(new Date())}</p>
                    <p>Este documento es válido sin firma ni sello</p>
                </div>

                <script>
                    window.onload = function() {
                        window.print();
                        // Cerrar ventana después de imprimir
                        setTimeout(() => window.close(), 1000);
                    }
                </script>
            </body>
            </html>
        `;

        this.abrirVentanaImpresion(html);
    }

    // Imprimir Factura
    static imprimirFactura(factura, items = []) {
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Factura ${factura.numero_factura}</title>
                <style>
                    /* Usar mismos estilos que OT pero adaptados */
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                        font-family: Arial, sans-serif; 
                        font-size: 12px; 
                        padding: 20px;
                    }
                    .header {
                        text-align: center;
                        border-bottom: 3px solid #10b981;
                        padding-bottom: 10px;
                        margin-bottom: 20px;
                    }
                    .header h1 { 
                        font-size: 24px; 
                        color: #10b981;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 20px;
                    }
                    table th {
                        background: #10b981;
                        color: white;
                        padding: 8px;
                        text-align: left;
                    }
                    table td {
                        border: 1px solid #ddd;
                        padding: 6px;
                    }
                    .total-box {
                        text-align: right;
                        margin-top: 20px;
                        padding: 15px;
                        background: #f0fdf4;
                        border-radius: 5px;
                    }
                    .total {
                        font-size: 24px;
                        font-weight: bold;
                        color: #10b981;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>💰 FACTURA DE VENTA</h1>
                    <p>Special Car - Servicio Automotriz</p>
                    <h2 style="margin-top:10px;">${factura.numero_factura}</h2>
                </div>

                <p><strong>Fecha:</strong> ${formatearFecha(factura.fecha_factura || factura.created_at)}</p>
                <p><strong>Cliente:</strong> ${factura.clientes?.razon_social || 'N/A'}</p>
                <p><strong>NIT:</strong> ${factura.clientes?.nit || 'N/A'}</p>

                <table style="margin-top:20px;">
                    <thead>
                        <tr>
                            <th>Descripción</th>
                            <th>Cantidad</th>
                            <th>Valor Unit.</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map(item => `
                            <tr>
                                <td>${item.descripcion}</td>
                                <td>${item.cantidad}</td>
                                <td>${formatearMoneda(item.precio_unitario)}</td>
                                <td>${formatearMoneda(item.total)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div class="total-box">
                    <p>Subtotal: ${formatearMoneda(factura.subtotal)}</p>
                    <p>IVA (19%): ${formatearMoneda(factura.iva)}</p>
                    <p class="total">TOTAL: ${formatearMoneda(factura.total)}</p>
                </div>

                <div style="margin-top:30px;text-align:center;font-size:10px;">
                    <p>Gracias por su preferencia</p>
                </div>

                <script>
                    window.onload = function() {
                        window.print();
                        setTimeout(() => window.close(), 1000);
                    }
                </script>
            </body>
            </html>
        `;

        this.abrirVentanaImpresion(html);
    }

    // Imprimir Lista de Inventario
    static imprimirInventario(repuestos) {
        const totalValor = repuestos.reduce((sum, r) => 
            sum + ((r.stock_actual || 0) * (r.costo_unitario || 0)), 0
        );

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Inventario de Repuestos</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                        font-family: Arial, sans-serif; 
                        font-size: 11px; 
                        padding: 20px;
                    }
                    .header {
                        text-align: center;
                        margin-bottom: 20px;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                    }
                    th {
                        background: #6366f1;
                        color: white;
                        padding: 6px;
                        text-align: left;
                        font-size: 10px;
                    }
                    td {
                        border: 1px solid #ddd;
                        padding: 4px;
                        font-size: 10px;
                    }
                    tr:nth-child(even) {
                        background: #f9fafb;
                    }
                    .stock-bajo {
                        background: #fef3c7 !important;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>📦 INVENTARIO DE REPUESTOS</h1>
                    <p>Fecha: ${formatearFecha(new Date())}</p>
                    <p>Total Items: ${repuestos.length} | Valor Total: ${formatearMoneda(totalValor)}</p>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Código</th>
                            <th>Nombre</th>
                            <th>Categoría</th>
                            <th>Stock</th>
                            <th>Mín</th>
                            <th>Costo</th>
                            <th>P.Venta</th>
                            <th>Valor</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${repuestos.map(r => `
                            <tr class="${(r.stock_actual <= r.stock_minimo) ? 'stock-bajo' : ''}">
                                <td>${r.codigo}</td>
                                <td>${r.nombre}</td>
                                <td>${r.categoria || '-'}</td>
                                <td>${r.stock_actual}</td>
                                <td>${r.stock_minimo}</td>
                                <td>${formatearMoneda(r.costo_unitario)}</td>
                                <td>${formatearMoneda(r.precio_venta)}</td>
                                <td>${formatearMoneda((r.stock_actual || 0) * (r.costo_unitario || 0))}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <script>
                    window.onload = function() {
                        window.print();
                        setTimeout(() => window.close(), 1000);
                    }
                </script>
            </body>
            </html>
        `;

        this.abrirVentanaImpresion(html);
    }

    // Método auxiliar para abrir ventana de impresión
    static abrirVentanaImpresion(html) {
        const ventana = window.open('', '_blank', 'width=800,height=600');
        if (ventana) {
            ventana.document.write(html);
            ventana.document.close();
        } else {
            alert('Por favor permita las ventanas emergentes para imprimir');
        }
    }
}

// Exportar funciones globales
window.PrintManager = PrintManager;