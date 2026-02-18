// js/cuentas-por-pagar.js
import { supabase } from './supabase-config.js';
import { DashboardBase } from './dashboards.js';
import { auth, protegerRuta } from './auth-system.js';
import { mostrarNotificacion, formatearMoneda, formatearFecha } from './utils.js';

const dash = new DashboardBase(['superadmin','jefe_almacen','cliente_financiero']);

let cxpCache = [];
let proveedores = [];
let archivoFactura = null;
let archivoComprobante = null;

(async () => {
    if (!await protegerRuta([
        { modulo: 'cuentas_por_pagar', accion: 'leer' }
    ])) return;

    await cargarProveedores();
    await cargarCXP();
    inicializarDragAndDrop();
})();

async function cargarProveedores() {
    const { data } = await supabase
        .from('proveedores')
        .select('id, razon_social, nit')
        .eq('activo', true)
        .order('razon_social');

    proveedores = data || [];

    // Llenar selects
    const selectProveedor = document.getElementById('cxpProveedor');
    const selectFiltro = document.getElementById('filtroProveedor');

    proveedores.forEach(p => {
        const opt1 = document.createElement('option');
        opt1.value = p.id;
        opt1.textContent = `${p.razon_social} (${p.nit})`;
        selectProveedor.appendChild(opt1);

        const opt2 = document.createElement('option');
        opt2.value = p.id;
        opt2.textContent = p.razon_social;
        selectFiltro.appendChild(opt2);
    });
}

async function cargarCXP() {
    try {
        const { data } = await supabase
            .from('v_cuentas_por_pagar_completas')
            .select('*')
            .order('fecha_vencimiento', { ascending: true });

        cxpCache = data || [];
        renderizarCXP(cxpCache);
        calcularResumen();

    } catch (error) {
        console.error('Error:', error);
        mostrarNotificacion('Error cargando cuentas por pagar', 'error');
    }
}

function calcularResumen() {
    const pendiente = cxpCache
        .filter(c => c.estado === 'pendiente' || c.estado === 'parcial')
        .reduce((s, c) => s + parseFloat(c.saldo_pendiente || 0), 0);

    const vencido = cxpCache
        .filter(c => c.estado === 'vencida')
        .reduce((s, c) => s + parseFloat(c.saldo_pendiente || 0), 0);

    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0,0,0,0);

    const pagadoMes = cxpCache
        .filter(c => c.estado === 'pagada' && new Date(c.updated_at) >= inicioMes)
        .reduce((s, c) => s + parseFloat(c.total || 0), 0);

    const activas = cxpCache.filter(c => c.estado !== 'pagada' && c.estado !== 'anulada').length;

    document.getElementById('totalPendiente').textContent = formatearMoneda(pendiente);
    document.getElementById('totalVencido').textContent = formatearMoneda(vencido);
    document.getElementById('totalPagado').textContent = formatearMoneda(pagadoMes);
    document.getElementById('totalFacturas').textContent = activas;
}

function renderizarCXP(cuentas) {
    dash.renderTabla('tablaCXP', [
        { key: 'numero_factura', label: 'No. Factura' },
        { key: 'proveedor_nombre', label: 'Proveedor' },
        { key: 'fecha_factura', label: 'Fecha', tipo: 'fecha' },
        { key: 'fecha_vencimiento', label: 'Vencimiento', 
          render: r => {
              const fecha = formatearFecha(r.fecha_vencimiento);
              const dias = r.dias_vencido;
              if (dias > 0) return `<span style="color:var(--danger);">${fecha} (${dias}d vencido)</span>`;
              return fecha;
          }},
        { key: 'total', label: 'Total', tipo: 'moneda' },
        { key: 'saldo_pendiente', label: 'Saldo', tipo: 'moneda' },
        { key: 'estado', label: 'Estado', tipo: 'badge',
          color: r => ({
              pendiente:'orange', parcial:'blue', 
              pagada:'green', vencida:'danger'
          })[r.estado] ?? 'gray' },
        { key: 'total_pagos', label: 'Pagos' }
    ], cuentas, [
        { label:'Ver', icono:'👁️', fn:'verDetalleCXP', tipo:'secondary' },
        { label:'Pagar', icono:'💳', fn:'abrirModalPagar', tipo:'success',
          visible: (r) => r.estado !== 'pagada' && r.estado !== 'anulada' },
        { label:'PDF', icono:'📄', fn:'descargarFactura', tipo:'primary',
          visible: (r) => !!r.archivo_factura_url }
    ]);
}

window.filtrarCXP = function() {
    const busq = document.getElementById('buscarCXP').value.toLowerCase();
    const estado = document.getElementById('filtroEstado').value;
    const provId = document.getElementById('filtroProveedor').value;

    const filtradas = cxpCache.filter(c =>
        (!busq || c.numero_factura?.toLowerCase().includes(busq) || 
                  c.proveedor_nombre?.toLowerCase().includes(busq)) &&
        (!estado || c.estado === estado) &&
        (!provId || String(c.proveedor_id) === provId)
    );
    renderizarCXP(filtradas);
}

window.abrirModalCXP = function() {
    document.getElementById('formCXP').reset();
    document.getElementById('previewArea').innerHTML = '';
    archivoFactura = null;
    
    // Fecha actual
    document.getElementById('cxpFechaFactura').valueAsDate = new Date();
    
    // Fecha vencimiento (30 días después)
    const vencimiento = new Date();
    vencimiento.setDate(vencimiento.getDate() + 30);
    document.getElementById('cxpFechaVencimiento').valueAsDate = vencimiento;
    
    document.getElementById('modalCXP').classList.add('active');
}

window.calcularTotalCXP = function() {
    const subtotal = parseFloat(document.getElementById('cxpSubtotal').value) || 0;
    const iva = parseFloat(document.getElementById('cxpIVA').value) || 0;
    const retefuente = parseFloat(document.getElementById('cxpRetefuente').value) || 0;
    const reteica = parseFloat(document.getElementById('cxpReteica').value) || 0;

    const total = subtotal + iva - retefuente - reteica;
    document.getElementById('cxpTotal').value = total.toFixed(2);
}

// Calcular IVA automáticamente
document.getElementById('cxpSubtotal')?.addEventListener('input', function() {
    const subtotal = parseFloat(this.value) || 0;
    document.getElementById('cxpIVA').value = (subtotal * 0.19).toFixed(2);
    calcularTotalCXP();
});

document.getElementById('formCXP').addEventListener('submit', async (e) => {
    e.preventDefault();

    const btnGuardar = e.target.querySelector('button[type="submit"]');
    btnGuardar.disabled = true;
    btnGuardar.innerHTML = '<span class="loading"></span> Guardando...';

    try {
        // 1. Subir archivo si existe
        let archivoUrl = null;
        let archivoNombre = null;
        let archivoTipo = null;

        if (archivoFactura) {
            const nombreArchivo = `factura_${Date.now()}_${archivoFactura.name}`;
            
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('facturas-proveedores')
                .upload(nombreArchivo, archivoFactura);

            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage
                .from('facturas-proveedores')
                .getPublicUrl(nombreArchivo);

            archivoUrl = urlData.publicUrl;
            archivoNombre = archivoFactura.name;
            archivoTipo = archivoFactura.type;
        }

        // 2. Crear cuenta por pagar
        const total = parseFloat(document.getElementById('cxpTotal').value);

        const datos = {
            proveedor_id: parseInt(document.getElementById('cxpProveedor').value),
            numero_factura: document.getElementById('cxpNumFactura').value.trim(),
            fecha_factura: document.getElementById('cxpFechaFactura').value,
            fecha_vencimiento: document.getElementById('cxpFechaVencimiento').value,
            subtotal: parseFloat(document.getElementById('cxpSubtotal').value),
            iva: parseFloat(document.getElementById('cxpIVA').value) || 0,
            retefuente: parseFloat(document.getElementById('cxpRetefuente').value) || 0,
            reteica: parseFloat(document.getElementById('cxpReteica').value) || 0,
            total: total,
            saldo_pendiente: total,
            estado: 'pendiente',
            concepto: document.getElementById('cxpConcepto').value.trim() || null,
            observaciones: document.getElementById('cxpObservaciones').value.trim() || null,
            archivo_factura_url: archivoUrl,
            archivo_nombre: archivoNombre,
            archivo_tipo: archivoTipo,
            creado_por: auth.getUsuario().id
        };

        const { error } = await supabase
            .from('cuentas_por_pagar')
            .insert(datos);

        if (error) throw error;

        mostrarNotificacion('✅ Cuenta por pagar creada exitosamente', 'success');
        cerrarModalCXP();
        await cargarCXP();

    } catch (error) {
        console.error('Error:', error);
        mostrarNotificacion('Error: ' + error.message, 'error');
    } finally {
        btnGuardar.disabled = false;
        btnGuardar.innerHTML = '💾 Guardar Cuenta por Pagar';
    }
});

window.abrirModalPagar = async function(cxpId) {
    const cxp = cxpCache.find(c => c.id === cxpId);
    if (!cxp) return;

    document.getElementById('pagoFecha').valueAsDate = new Date();
    document.getElementById('pagoMonto').value = cxp.saldo_pendiente;
    document.getElementById('pagoMonto').max = cxp.saldo_pendiente;
    document.getElementById('pagoMetodo').value = cxp.metodo_pago_preferido || 'transferencia';
    document.getElementById('pagoObservaciones').value = '';
    document.getElementById('previewAreaPago').innerHTML = '';
    document.getElementById('pagoCXPId').value = cxpId;
    archivoComprobante = null;

    document.getElementById('infoCXP').innerHTML = `
        <strong>Factura:</strong> ${cxp.numero_factura}<br>
        <strong>Proveedor:</strong> ${cxp.proveedor_nombre}<br>
        <strong>Total Factura:</strong> ${formatearMoneda(cxp.total)}<br>
        <strong>Pagado:</strong> ${formatearMoneda(cxp.total_pagado)}<br>
        <strong>Saldo Pendiente:</strong> <span style="font-size:1.25rem;font-weight:700;color:var(--danger);">
            ${formatearMoneda(cxp.saldo_pendiente)}
        </span>
    `;

    document.getElementById('modalPagar').classList.add('active');
}

document.getElementById('formPago').addEventListener('submit', async (e) => {
    e.preventDefault();

    const btnGuardar = e.target.querySelector('button[type="submit"]');
    btnGuardar.disabled = true;
    btnGuardar.innerHTML = '<span class="loading"></span> Registrando...';

    try {
        const cxpId = parseInt(document.getElementById('pagoCXPId').value);
        const cxp = cxpCache.find(c => c.id === cxpId);

        // 1. Subir comprobante si existe
        let comprobanteUrl = null;
        let comprobanteNombre = null;

        if (archivoComprobante) {
            const nombreArchivo = `comprobante_${Date.now()}_${archivoComprobante.name}`;
            
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('facturas-proveedores')
                .upload(nombreArchivo, archivoComprobante);

            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage
                .from('facturas-proveedores')
                .getPublicUrl(nombreArchivo);

            comprobanteUrl = urlData.publicUrl;
            comprobanteNombre = archivoComprobante.name;
        }

        // 2. Registrar pago
        const datosPago = {
            cuenta_por_pagar_id: cxpId,
            proveedor_id: cxp.proveedor_id,
            fecha_pago: document.getElementById('pagoFecha').value,
            monto: parseFloat(document.getElementById('pagoMonto').value),
            metodo_pago: document.getElementById('pagoMetodo').value,
            banco_origen: document.getElementById('pagoBancoOrigen').value.trim() || null,
            numero_referencia: document.getElementById('pagoReferencia').value.trim() || null,
            comprobante_url: comprobanteUrl,
            comprobante_nombre: comprobanteNombre,
            observaciones: document.getElementById('pagoObservaciones').value.trim() || null,
            registrado_por: auth.getUsuario().id
        };

        const { error } = await supabase
            .from('pagos_proveedores')
            .insert(datosPago);

        if (error) throw error;

        mostrarNotificacion('✅ Pago registrado exitosamente', 'success');
        cerrarModalPagar();
        await cargarCXP();

    } catch (error) {
        console.error('Error:', error);
        mostrarNotificacion('Error: ' + error.message, 'error');
    } finally {
        btnGuardar.disabled = false;
        btnGuardar.innerHTML = '💳 Registrar Pago';
    }
});

window.previsualizarArchivo = function(input) {
    const file = input.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
        mostrarNotificacion('⚠️ Archivo demasiado grande (máx 10MB)', 'warning');
        input.value = '';
        return;
    }

    archivoFactura = file;

    const preview = document.getElementById('previewArea');
    if (file.type === 'application/pdf') {
        preview.innerHTML = `<p>📄 ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)</p>`;
    } else {
        const reader = new FileReader();
        reader.onload = (e) => {
            preview.innerHTML = `<img src="${e.target.result}" class="file-preview">`;
        };
        reader.readAsDataURL(file);
    }
}

window.previsualizarComprobante = function(input) {
    const file = input.files[0];
    if (!file) return;

    archivoComprobante = file;

    const preview = document.getElementById('previewAreaPago');
    if (file.type === 'application/pdf') {
        preview.innerHTML = `<p>📄 ${file.name}</p>`;
    } else {
        const reader = new FileReader();
        reader.onload = (e) => {
            preview.innerHTML = `<img src="${e.target.result}" class="file-preview">`;
        };
        reader.readAsDataURL(file);
    }
}

function inicializarDragAndDrop() {
    const uploadArea = document.getElementById('uploadArea');
    const uploadAreaPago = document.getElementById('uploadAreaPago');
    const inputFactura = document.getElementById('archivoFactura');
    const inputComprobante = document.getElementById('archivoComprobante');

    // Factura
    uploadArea?.addEventListener('click', () => inputFactura.click());
    uploadArea?.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragging');
    });
    uploadArea?.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragging');
    });
    uploadArea?.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragging');
        inputFactura.files = e.dataTransfer.files;
        previsualizarArchivo(inputFactura);
    });

    // Comprobante
    uploadAreaPago?.addEventListener('click', () => inputComprobante.click());
    uploadAreaPago?.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadAreaPago.classList.add('dragging');
    });
    uploadAreaPago?.addEventListener('dragleave', () => {
        uploadAreaPago.classList.remove('dragging');
    });
    uploadAreaPago?.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadAreaPago.classList.remove('dragging');
        inputComprobante.files = e.dataTransfer.files;
        previsualizarComprobante(inputComprobante);
    });
}

window.verDetalleCXP = (id) => mostrarNotificacion('Detalle de CxP - Por implementar', 'info');
window.descargarFactura = (id) => {
    const cxp = cxpCache.find(c => c.id === id);
    if (cxp?.archivo_factura_url) {
        window.open(cxp.archivo_factura_url, '_blank');
    }
}

window.cerrarModalCXP = () => document.getElementById('modalCXP').classList.remove('active');
window.cerrarModalPagar = () => document.getElementById('modalPagar').classList.remove('active');