// js/almacen-dashboard.js
import { supabase } from './supabase-config.js';
import { DashboardBase } from './dashboards.js';
import { auth } from './auth-system.js';
import { mostrarNotificacion, formatearMoneda } from './utils.js';

const dash = new DashboardBase(['superadmin','jefe_almacen']);

let repuestosCache = [];

(async () => {
    if (!await dash.inicializar()) return;
    await cargarDashboard();
    await cargarRepuestos();
    await cargarServicios();
    await cargarManoObra();
})();

async function cargarDashboard() {
    try {
        const { data: repuestos } = await supabase
            .from('repuestos')
            .select('*')
            .eq('activo', true);

        const total = repuestos?.length || 0;
        const stockBajo = repuestos?.filter(r => 
            r.stock_actual <= r.stock_minimo && r.stock_actual > 0).length || 0;
        const stockCritico = repuestos?.filter(r => r.stock_actual === 0).length || 0;
        
        // CALCULAR VALOR TOTAL DEL INVENTARIO
        const valorTotal = repuestos?.reduce((sum, r) => {
            const stock = parseFloat(r.stock_actual) || 0;
            const costo = parseFloat(r.costo_unitario) || 0;
            return sum + (stock * costo);
        }, 0) || 0;

        document.getElementById('totalRepuestos').textContent = total;
        document.getElementById('stockBajo').textContent = stockBajo;
        document.getElementById('stockCritico').textContent = stockCritico;
        document.getElementById('valorInventario').textContent = formatearMoneda(valorTotal);

        // Alertas de stock
        const alertas = repuestos?.filter(r => r.stock_actual <= r.stock_minimo) || [];
        const htmlAlertas = alertas.map(r => `
            <div class="card ${r.stock_actual === 0 ? 'stock-bajo' : 'stock-medio'}" 
                 style="margin-bottom:.5rem;padding:1rem;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <div>
                        <strong>${r.codigo} - ${r.nombre}</strong><br>
                        <small>Stock actual: ${r.stock_actual} | Mínimo: ${r.stock_minimo}</small><br>
                        <small>Valor: ${formatearMoneda((r.stock_actual || 0) * (r.costo_unitario || 0))}</small>
                    </div>
                    <button onclick="editarRepuesto(${r.id})" class="btn btn-warning">
                        📦 Reabastecer
                    </button>
                </div>
            </div>
        `).join('') || '<p style="color:var(--gray-700);">✅ Todo el inventario está en niveles normales</p>';

        document.getElementById('alertasStock').innerHTML = htmlAlertas;

    } catch (error) {
        console.error('Error:', error);
    }
}

async function cargarRepuestos() {
    const { data } = await supabase
        .from('repuestos')
        .select('*')
        .eq('activo', true)
        .order('codigo');

    repuestosCache = data || [];
    renderizarRepuestos(repuestosCache);
}

function renderizarRepuestos(repuestos) {
    dash.renderTabla('tablaRepuestos', [
        { key: 'codigo',        label: 'Código' },
        { key: 'nombre',        label: 'Nombre' },
        { key: 'categoria',     label: 'Categoría' },
        { key: 'costo_unitario', label: 'Costo', tipo: 'moneda' },
        { key: 'margen_ganancia', label: 'Margen',
          render: r => `${((r.margen_ganancia || 0) * 100).toFixed(1)}%` },
        { key: 'precio_venta',  label: 'P. Venta', tipo: 'moneda' },
        { key: 'stock_actual',  label: 'Stock',
          render: r => {
              const color = r.stock_actual === 0 ? 'danger' :
                           r.stock_actual <= r.stock_minimo ? 'orange' : 'green';
              return `<span class="badge badge-${color}">${r.stock_actual}</span>`;
          }},
        { key: 'aplica_iva', label: 'IVA',
          render: r => r.aplica_iva ? '✓' : '✗' }
    ], repuestos, [
        { label:'Editar', icono:'✏️', fn:'editarRepuesto', tipo:'primary' },
        { label:'Stock',  icono:'📦', fn:'ajustarStock',   tipo:'warning' }
    ]);
}



window.filtrarRepuestos = function() {
    const busq = document.getElementById('buscarRepuesto').value.toLowerCase();
    const cat  = document.getElementById('filtroCategoria').value;

    const filtrados = repuestosCache.filter(r =>
        (!busq || r.codigo?.toLowerCase().includes(busq) || r.nombre?.toLowerCase().includes(busq)) &&
        (!cat  || r.categoria === cat)
    );
    renderizarRepuestos(filtrados);
}

window.abrirModalRepuesto = function(id = null) {
    document.getElementById('tituloModalRepuesto').textContent = id ? 'Editar Repuesto' : 'Nuevo Repuesto';
    document.getElementById('formRepuesto').reset();
    document.getElementById('repuestoId').value = id || '';

    if (id) {
        const rep = repuestosCache.find(r => r.id === id);
        if (rep) {
            document.getElementById('repuestoCodigo').value    = rep.codigo;
            document.getElementById('repuestoNombre').value    = rep.nombre;
            document.getElementById('repuestoCategoria').value = rep.categoria || 'lubricantes';
            document.getElementById('repuestoCosto').value     = rep.costo_unitario;
            document.getElementById('repuestoMargen').value    = (rep.margen_ganancia || 0) * 100;
            document.getElementById('repuestoStock').value     = rep.stock_actual;
            document.getElementById('repuestoStockMin').value  = rep.stock_minimo;
            document.getElementById('repuestoIVA').checked     = rep.aplica_iva;
        }
    }

    document.getElementById('modalRepuesto').classList.add('active');
}

window.editarRepuesto = abrirModalRepuesto;

document.getElementById('formRepuesto').addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = document.getElementById('repuestoId').value;
    const margenPct = parseFloat(document.getElementById('repuestoMargen').value);
    const margenDecimal = margenPct / 100; // Convertir 30% a 0.30

    const datos = {
        codigo:          document.getElementById('repuestoCodigo').value.toUpperCase(),
        nombre:          document.getElementById('repuestoNombre').value,
        categoria:       document.getElementById('repuestoCategoria').value,
        costo_unitario:  parseFloat(document.getElementById('repuestoCosto').value),
        margen_ganancia: margenDecimal,
        stock_actual:    parseInt(document.getElementById('repuestoStock').value),
        stock_minimo:    parseInt(document.getElementById('repuestoStockMin').value),
        aplica_iva:      document.getElementById('repuestoIVA').checked,
        activo:          true
    };

    try {
        if (id) {
            await supabase.from('repuestos').update(datos).eq('id', id);
            mostrarNotificacion('✅ Repuesto actualizado', 'success');
        } else {
            await supabase.from('repuestos').insert(datos);
            mostrarNotificacion('✅ Repuesto creado', 'success');
        }

        cerrarModal('modalRepuesto');
        await cargarRepuestos();
        await cargarDashboard();
    } catch (error) {
        mostrarNotificacion('Error: ' + error.message, 'error');
    }
});
// AGREGAR FUNCIONES PARA SERVICIOS Y MANO DE OBRA

window.abrirModalServicio = function(id = null) {
    const modal = `
        <div class="modal active" id="modalServicio">
            <div class="modal-content">
                <h2>${id ? 'Editar' : 'Nuevo'} Servicio</h2>
                <form id="formServicio">
                    <input type="hidden" id="servicioId" value="${id || ''}">
                    
                    <div class="form-grid">
                        <div class="form-group">
                            <label>Código *</label>
                            <input type="text" id="servicioCodigo" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label>Categoría</label>
                            <select id="servicioCategoria" class="form-control">
                                <option value="mantenimiento">Mantenimiento</option>
                                <option value="reparacion">Reparación</option>
                                <option value="diagnostico">Diagnóstico</option>
                                <option value="limpieza">Limpieza</option>
                            </select>
                        </div>
                    </div>

                    <div class="form-group">
                        <label>Nombre *</label>
                        <input type="text" id="servicioNombre" class="form-control" required>
                    </div>

                    <div class="form-group">
                        <label>Descripción</label>
                        <textarea id="servicioDescripcion" class="form-control" rows="3"></textarea>
                    </div>

                    <div style="display:flex;gap:1rem;margin-top:1.5rem;">
                        <button type="submit" class="btn btn-primary" style="flex:1;">💾 Guardar</button>
                        <button type="button" onclick="cerrarModalServicio()" class="btn btn-secondary">
                            Cancelar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modal);

    if (id) {
        // TODO: Cargar datos del servicio para editar
    }

    document.getElementById('formServicio').addEventListener('submit', async (e) => {
        e.preventDefault();

        const datos = {
            codigo: document.getElementById('servicioCodigo').value.toUpperCase(),
            nombre: document.getElementById('servicioNombre').value,
            categoria: document.getElementById('servicioCategoria').value,
            descripcion: document.getElementById('servicioDescripcion').value.trim() || null,
            activo: true
        };

        try {
            const servicioId = document.getElementById('servicioId').value;
            
            if (servicioId) {
                await supabase.from('servicios').update(datos).eq('id', servicioId);
                mostrarNotificacion('✅ Servicio actualizado', 'success');
            } else {
                await supabase.from('servicios').insert(datos);
                mostrarNotificacion('✅ Servicio creado', 'success');
            }

            cerrarModalServicio();
            await cargarServicios();

        } catch (error) {
            mostrarNotificacion('Error: ' + error.message, 'error');
        }
    });
}

window.cerrarModalServicio = () => {
    document.getElementById('modalServicio')?.remove();
}

window.abrirModalManoObra = function(id = null) {
    const modal = `
        <div class="modal active" id="modalManoObra">
            <div class="modal-content">
                <h2>${id ? 'Editar' : 'Nueva'} Mano de Obra</h2>
                <form id="formManoObra">
                    <input type="hidden" id="manoObraId" value="${id || ''}">
                    
                    <div class="form-grid">
                        <div class="form-group">
                            <label>Código *</label>
                            <input type="text" id="manoObraCodigo" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label>Valor por Hora *</label>
                            <input type="number" id="manoObraValor" class="form-control" 
                                   required min="0" step="100">
                        </div>
                    </div>

                    <div class="form-group">
                        <label>Nombre *</label>
                        <input type="text" id="manoObraNombre" class="form-control" required>
                    </div>

                    <div class="form-group">
                        <label>Descripción</label>
                        <textarea id="manoObraDescripcion" class="form-control" rows="2"></textarea>
                    </div>

                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="manoObraIVA" checked>
                            Aplica IVA
                        </label>
                    </div>

                    <div style="display:flex;gap:1rem;margin-top:1.5rem;">
                        <button type="submit" class="btn btn-primary" style="flex:1;">💾 Guardar</button>
                        <button type="button" onclick="cerrarModalManoObra()" class="btn btn-secondary">
                            Cancelar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modal);

    if (id) {
        // TODO: Cargar datos de mano de obra para editar
    }

    document.getElementById('formManoObra').addEventListener('submit', async (e) => {
        e.preventDefault();

        const datos = {
            codigo: document.getElementById('manoObraCodigo').value.toUpperCase(),
            nombre: document.getElementById('manoObraNombre').value,
            descripcion: document.getElementById('manoObraDescripcion').value.trim() || null,
            valor_unitario: parseFloat(document.getElementById('manoObraValor').value),
            aplica_iva: document.getElementById('manoObraIVA').checked,
            activo: true
        };

        try {
            const manoObraId = document.getElementById('manoObraId').value;
            
            if (manoObraId) {
                await supabase.from('mano_obra').update(datos).eq('id', manoObraId);
                mostrarNotificacion('✅ Mano de obra actualizada', 'success');
            } else {
                await supabase.from('mano_obra').insert(datos);
                mostrarNotificacion('✅ Mano de obra creada', 'success');
            }

            cerrarModalManoObra();
            await cargarManoObra();

        } catch (error) {
            mostrarNotificacion('Error: ' + error.message, 'error');
        }
    });
}

window.cerrarModalManoObra = () => {
    document.getElementById('modalManoObra')?.remove();
}

window.editarServicio = abrirModalServicio;
window.editarManoObra = abrirModalManoObra;

window.ajustarStock = async function(id) {
    const rep = repuestosCache.find(r => r.id === id);
    if (!rep) return;

    const nuevoStock = prompt(
        `Stock actual: ${rep.stock_actual}\nNuevo stock:`,
        rep.stock_actual
    );

    if (nuevoStock === null) return;

    try {
        await supabase
            .from('repuestos')
            .update({ stock_actual: parseInt(nuevoStock) })
            .eq('id', id);

        mostrarNotificacion('✅ Stock actualizado', 'success');
        await cargarRepuestos();
        await cargarDashboard();
    } catch (error) {
        mostrarNotificacion('Error: ' + error.message, 'error');
    }
}

async function cargarServicios() {
    const { data } = await supabase
        .from('v_servicios_completos')
        .select('*')
        .order('codigo');

    dash.renderTabla('tablaServicios', [
        { key: 'codigo',      label: 'Código' },
        { key: 'nombre',      label: 'Nombre' },
        { key: 'categoria',   label: 'Categoría' },
        { key: 'descripcion', label: 'Descripción' },
        { key: 'total_repuestos', label: 'Repuestos Anclados' },
        { key: 'total_mano_obra', label: 'MO Anclada' }
    ], data || [], [
        { label:'Editar', icono:'✏️', fn:'editarServicio', tipo:'primary' }
    ]);
}

async function cargarManoObra() {
    const { data } = await supabase
        .from('mano_obra')
        .select('*')
        .eq('activo', true)
        .order('codigo');

    dash.renderTabla('tablaManoObra', [
        { key: 'codigo',         label: 'Código' },
        { key: 'nombre',         label: 'Nombre' },
        { key: 'descripcion',    label: 'Descripción' },
        { key: 'valor_unitario', label: 'Valor/Hora', tipo: 'moneda' },
        { key: 'aplica_iva', label: 'IVA',
          render: r => r.aplica_iva ? '✓' : '✗' }
    ], data || [], [
        { label:'Editar', icono:'✏️', fn:'editarManoObra', tipo:'primary' }
    ]);
}

window.abrirModalServicio = () => mostrarNotificacion('Modal servicio - Por implementar', 'info');
window.editarServicio = () => mostrarNotificacion('Editar servicio - Por implementar', 'info');
window.abrirModalManoObra = () => mostrarNotificacion('Modal mano obra - Por implementar', 'info');
window.editarManoObra = () => mostrarNotificacion('Editar MO - Por implementar', 'info');

window.cambiarSeccion = function(seccion, el) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(seccion).classList.add('active');
    document.querySelectorAll('.sidebar nav a').forEach(a => a.classList.remove('active'));
    if (el) el.classList.add('active');
}

window.cerrarModal = (id) => document.getElementById(id).classList.remove('active');
window.cerrarSesion = () => auth.logout();