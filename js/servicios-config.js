// js/servicios-config.js
import { supabase } from './supabase-config.js';
import { auth, protegerRuta } from './auth-system.js';
import { mostrarNotificacion, formatearMoneda } from './utils.js';

let servicioActual = null;
let repuestos = [];
let manoObra = [];

(async () => {
    if (!await protegerRuta([
        { modulo: 'inventario', accion: 'actualizar' }
    ])) return;

    await cargarServicios();
    await cargarRepuestos();
    await cargarManoObra();
})();

async function cargarServicios() {
    const { data } = await supabase
        .from('servicios')
        .select('id, codigo, nombre')
        .eq('activo', true)
        .order('nombre');

    const select = document.getElementById('selectServicio');
    (data || []).forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = `${s.codigo} - ${s.nombre}`;
        select.appendChild(opt);
    });
}

async function cargarRepuestos() {
    const { data } = await supabase
        .from('repuestos')
        .select('id, codigo, nombre, precio_venta, stock_actual')
        .eq('activo', true)
        .order('nombre');

    repuestos = data || [];

    const select = document.getElementById('repuestoId');
    repuestos.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.id;
        opt.textContent = `${r.codigo} - ${r.nombre} (${formatearMoneda(r.precio_venta)}) - Stock: ${r.stock_actual}`;
        select.appendChild(opt);
    });
}

async function cargarManoObra() {
    const { data } = await supabase
        .from('mano_obra')
        .select('id, codigo, nombre, valor_unitario')
        .eq('activo', true)
        .order('nombre');

    manoObra = data || [];

    const select = document.getElementById('manoObraId');
    (manoObra || []).forEach(mo => {
        const opt = document.createElement('option');
        opt.value = mo.id;
        opt.textContent = `${mo.codigo} - ${mo.nombre} (${formatearMoneda(mo.valor_unitario)}/hora)`;
        select.appendChild(opt);
    });
}

window.cargarDetalleServicio = async function() {
    const servicioId = document.getElementById('selectServicio').value;
    if (!servicioId) {
        document.getElementById('detalleServicio').style.display = 'none';
        return;
    }

    const { data, error } = await supabase
        .from('v_servicios_detallados')
        .select('*')
        .eq('id', servicioId)
        .single();

    if (error) {
        console.error('Error:', error);
        return;
    }

    servicioActual = data;
    document.getElementById('detalleServicio').style.display = 'block';

    renderizarRepuestosAnclados();
    renderizarManoObraAnclada();
    calcularTotal();
}

function renderizarRepuestosAnclados() {
    const container = document.getElementById('listaRepuestosAnclados');
    const repuestosData = servicioActual.repuestos || [];

    if (repuestosData.length === 0) {
        container.innerHTML = '<p style="color:var(--gray-700);">Sin repuestos anclados</p>';
        return;
    }

    const html = repuestosData.map(r => `
        <div class="item-ancla">
            <div>
                <strong>${r.repuesto_nombre}</strong><br>
                <small style="color:var(--gray-700);">
                    Cantidad: ${r.cantidad_base} | ${formatearMoneda(r.precio_unitario)}
                    ${r.es_opcional ? ' | <span style="color:var(--warning);">Opcional</span>' : ''}
                </small>
            </div>
            <button onclick="desanclarRepuesto(${r.repuesto_id})" class="btn btn-danger" 
                    style="padding:.25rem .75rem;">✕</button>
        </div>
    `).join('');

    container.innerHTML = html;
}

function renderizarManoObraAnclada() {
    const container = document.getElementById('listaManoObraAnclada');
    const manoObraData = servicioActual.mano_obra || [];

    if (manoObraData.length === 0) {
        container.innerHTML = '<p style="color:var(--gray-700);">Sin mano de obra anclada</p>';
        return;
    }

    const html = manoObraData.map(mo => `
        <div class="item-ancla">
            <div>
                <strong>${mo.mano_obra_nombre}</strong><br>
                <small style="color:var(--gray-700);">
                    ${mo.horas_estimadas}h × ${formatearMoneda(mo.valor_hora)} = ${formatearMoneda(mo.horas_estimadas * mo.valor_hora)}
                    ${mo.es_opcional ? ' | <span style="color:var(--warning);">Opcional</span>' : ''}
                </small>
            </div>
            <button onclick="desanclarManoObra(${mo.mano_obra_id})" class="btn btn-danger" 
                    style="padding:.25rem .75rem;">✕</button>
        </div>
    `).join('');

    container.innerHTML = html;
}

function calcularTotal() {
    const repuestosData = servicioActual.repuestos || [];
    const manoObraData = servicioActual.mano_obra || [];

    const costoRepuestos = repuestosData
        .filter(r => !r.es_opcional)
        .reduce((s, r) => s + (r.cantidad_base * r.precio_unitario), 0);

    const costoManoObra = manoObraData
        .filter(mo => !mo.es_opcional)
        .reduce((s, mo) => s + (mo.horas_estimadas * mo.valor_hora), 0);

    const total = costoRepuestos + costoManoObra;

    document.getElementById('costoRepuestos').textContent = formatearMoneda(costoRepuestos);
    document.getElementById('costoManoObra').textContent = formatearMoneda(costoManoObra);
    document.getElementById('totalEstimado').textContent = formatearMoneda(total);
}

window.abrirModalAnclarRepuesto = function() {
    document.getElementById('formAnclarRepuesto').reset();
    document.getElementById('servicioIdRepuesto').value = servicioActual.id;
    document.getElementById('modalAnclarRepuesto').classList.add('active');
}

window.abrirModalAnclarManoObra = function() {
    document.getElementById('formAnclarManoObra').reset();
    document.getElementById('servicioIdManoObra').value = servicioActual.id;
    document.getElementById('modalAnclarManoObra').classList.add('active');
}

document.getElementById('formAnclarRepuesto').addEventListener('submit', async (e) => {
    e.preventDefault();

    try {
        const datos = {
            servicio_id: servicioActual.id,
            repuesto_id: parseInt(document.getElementById('repuestoId').value),
            cantidad_base: parseFloat(document.getElementById('cantidadRepuesto').value),
            es_opcional: document.getElementById('opcionalRepuesto').checked,
            notas: document.getElementById('notasRepuesto').value.trim() || null
        };

        const { error } = await supabase
            .from('servicios_repuestos')
            .insert(datos);

        if (error) throw error;

        mostrarNotificacion('✅ Repuesto anclado', 'success');
        cerrarModalRepuesto();
        await cargarDetalleServicio();

    } catch (error) {
        console.error('Error:', error);
        mostrarNotificacion('Error: ' + error.message, 'error');
    }
});

document.getElementById('formAnclarManoObra').addEventListener('submit', async (e) => {
    e.preventDefault();

    try {
        const datos = {
            servicio_id: servicioActual.id,
            mano_obra_id: parseInt(document.getElementById('manoObraId').value),
            horas_estimadas: parseFloat(document.getElementById('horasManoObra').value),
            es_opcional: document.getElementById('opcionalManoObra').checked,
            notas: document.getElementById('notasManoObra').value.trim() || null
        };

        const { error } = await supabase
            .from('servicios_mano_obra')
            .insert(datos);

        if (error) throw error;

        mostrarNotificacion('✅ Mano de obra anclada', 'success');
        cerrarModalManoObra();
        await cargarDetalleServicio();

    } catch (error) {
        console.error('Error:', error);
        mostrarNotificacion('Error: ' + error.message, 'error');
    }
});

window.desanclarRepuesto = async function(repuestoId) {
    if (!confirm('¿Desanclar este repuesto?')) return;

    try {
        await supabase
            .from('servicios_repuestos')
            .delete()
            .eq('servicio_id', servicioActual.id)
            .eq('repuesto_id', repuestoId);

        mostrarNotificacion('✅ Repuesto desanclado', 'success');
        await cargarDetalleServicio();

    } catch (error) {
        mostrarNotificacion('Error: ' + error.message, 'error');
    }
}

window.desanclarManoObra = async function(manoObraId) {
    if (!confirm('¿Desanclar esta mano de obra?')) return;

    try {
        await supabase
            .from('servicios_mano_obra')
            .delete()
            .eq('servicio_id', servicioActual.id)
            .eq('mano_obra_id', manoObraId);

        mostrarNotificacion('✅ Mano de obra desanclada', 'success');
        await cargarDetalleServicio();

    } catch (error) {
        mostrarNotificacion('Error: ' + error.message, 'error');
    }
}

window.cerrarModalRepuesto = () => document.getElementById('modalAnclarRepuesto').classList.remove('active');
window.cerrarModalManoObra = () => document.getElementById('modalAnclarManoObra').classList.remove('active');