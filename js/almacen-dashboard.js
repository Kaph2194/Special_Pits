// js/almacen-dashboard.js
import { supabase } from './supabase-config.js';
import { DashboardBase } from './dashboards.js';
import { auth } from './auth-system.js';
import { mostrarNotificacion, formatearMoneda, formatearFecha } from './utils.js';
import { exportarAExcel } from './excel-export.js';

const dash = new DashboardBase(['superadmin','jefe_almacen']);

let repuestosCache = [];
let serviciosCache = [];
let manoObraCache = [];

(async () => {
    if (!await dash.inicializar()) return;
    await cargarDashboard();
    await cargarRepuestos();
    await cargarServicios();
    await cargarManoObra();
})();

// ============================================
// DASHBOARD PRINCIPAL
// ============================================

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
        `).join('') || '<p style="color:var(--gray-700);padding:1rem;">✅ Todo el inventario está en niveles normales</p>';

        document.getElementById('alertasStock').innerHTML = htmlAlertas;

    } catch (error) {
        console.error('Error:', error);
        mostrarNotificacion('Error cargando dashboard', 'error');
    }
}

// ============================================
// GESTIÓN DE REPUESTOS
// ============================================

async function cargarRepuestos() {
    try {
        console.log('🔍 Iniciando carga de repuestos...');
        
        const { data, error } = await supabase
            .from('repuestos')
            .select('*, proveedores(razon_social)')
            .eq('activo', true)
            .order('codigo');

        if (error) {
            console.error('❌ Error en query:', error);
            throw error;
        }

        console.log('✅ Repuestos cargados:', data?.length || 0);
        console.log('📦 Datos:', data);

        repuestosCache = data || [];
        
        if (repuestosCache.length === 0) {
            document.getElementById('tablaRepuestos').innerHTML = 
                '<p style="color:var(--warning);padding:2rem;text-align:center;">⚠️ No hay repuestos en la base de datos. Crea el primero usando el botón "+ Nuevo Repuesto"</p>';
            return;
        }
        
        filtrarRepuestos();

    } catch (error) {
        console.error('❌ Error cargando repuestos:', error);
        mostrarNotificacion('Error cargando repuestos: ' + error.message, 'error');
        
        document.getElementById('tablaRepuestos').innerHTML = 
            `<p style="color:var(--danger);padding:2rem;text-align:center;">❌ Error: ${error.message}</p>`;
    }
}

window.filtrarRepuestos = function() {
    const busqueda = document.getElementById('buscarRepuesto')?.value.toLowerCase() || '';
    const categoria = document.getElementById('filtroCategoria')?.value || '';

    let filtrados = repuestosCache;

    if (busqueda) {
        filtrados = filtrados.filter(r =>
            r.codigo?.toLowerCase().includes(busqueda) ||
            r.nombre?.toLowerCase().includes(busqueda)
        );
    }

    if (categoria) {
        filtrados = filtrados.filter(r => r.categoria === categoria);
    }

    dash.renderTabla('tablaRepuestos', [
        { key: 'codigo', label: 'Código' },
        { key: 'nombre', label: 'Nombre' },
        { key: 'categoria', label: 'Categoría' },
        { key: 'stock_actual', label: 'Stock' },
        { key: 'stock_minimo', label: 'Mín' },
        { key: 'costo_unitario', label: 'Costo', tipo: 'moneda' },
        { key: 'precio_venta', label: 'P.Venta', tipo: 'moneda' },
        { key: 'id', label: 'Valor Stock',
          render: r => formatearMoneda((r.stock_actual || 0) * (r.costo_unitario || 0)) },
        { key: 'id', label: 'Proveedor',
          render: r => r.proveedores?.razon_social || 'N/A' }
    ], filtrados, [
        { label: 'Editar', icono: '✏️', fn: 'editarRepuesto', tipo: 'primary' },
        { label: 'Ajustar Stock', icono: '📦', fn: 'ajustarStock', tipo: 'warning' }
    ]);
}

window.abrirModalRepuesto = function(id = null) {
    document.getElementById('tituloModalRepuesto').textContent = id ? 'Editar Repuesto' : 'Nuevo Repuesto';
    document.getElementById('formRepuesto').reset();
    document.getElementById('repuestoId').value = id || '';

    if (id) {
        const repuesto = repuestosCache.find(r => r.id === id);
        if (repuesto) {
            document.getElementById('repuestoCodigo').value = repuesto.codigo;
            document.getElementById('repuestoNombre').value = repuesto.nombre;
            document.getElementById('repuestoCategoria').value = repuesto.categoria || 'general';
            document.getElementById('repuestoCosto').value = repuesto.costo_unitario;
            document.getElementById('repuestoMargen').value = (repuesto.margen_ganancia * 100).toFixed(1);
            document.getElementById('repuestoStock').value = repuesto.stock_actual;
            document.getElementById('repuestoStockMin').value = repuesto.stock_minimo;
            document.getElementById('repuestoIVA').checked = repuesto.aplica_iva;
        }
    }

    document.getElementById('modalRepuesto').classList.add('active');
}

window.editarRepuesto = abrirModalRepuesto;

window.ajustarStock = async function(id) {
    const repuesto = repuestosCache.find(r => r.id === id);
    if (!repuesto) return;

    const nuevoStock = prompt(
        `Ajustar stock de: ${repuesto.nombre}\n` +
        `Stock actual: ${repuesto.stock_actual}\n\n` +
        `Ingrese el nuevo stock:`
    );

    if (nuevoStock === null) return;

    const stock = parseInt(nuevoStock);
    if (isNaN(stock) || stock < 0) {
        mostrarNotificacion('⚠️ Stock inválido', 'warning');
        return;
    }

    try {
        await supabase
            .from('repuestos')
            .update({ stock_actual: stock })
            .eq('id', id);

        await auth.registrarAccion('ajustar_stock', 'repuestos', id);
        mostrarNotificacion('✅ Stock actualizado', 'success');
        await cargarRepuestos();
        await cargarDashboard();

    } catch (error) {
        console.error('Error:', error);
        mostrarNotificacion('Error: ' + error.message, 'error');
    }
}

document.getElementById('formRepuesto').addEventListener('submit', async (e) => {
    e.preventDefault();

    const repuestoId = document.getElementById('repuestoId').value;
    const margen = parseFloat(document.getElementById('repuestoMargen').value) / 100;
    const costo = parseFloat(document.getElementById('repuestoCosto').value);
    const precioVenta = costo * (1 + margen);

    const datos = {
        codigo: document.getElementById('repuestoCodigo').value.trim().toUpperCase(),
        nombre: document.getElementById('repuestoNombre').value.trim(),
        categoria: document.getElementById('repuestoCategoria').value,
        costo_unitario: costo,
        margen_ganancia: margen,
        precio_venta: precioVenta,
        stock_actual: parseInt(document.getElementById('repuestoStock').value),
        stock_minimo: parseInt(document.getElementById('repuestoStockMin').value),
        aplica_iva: document.getElementById('repuestoIVA').checked,
        activo: true
    };

    try {
        if (repuestoId) {
            await supabase.from('repuestos').update(datos).eq('id', repuestoId);
            await auth.registrarAccion('actualizar_repuesto', 'repuestos', repuestoId);
            mostrarNotificacion('✅ Repuesto actualizado', 'success');
        } else {
            await supabase.from('repuestos').insert(datos);
            await auth.registrarAccion('crear_repuesto', 'repuestos');
            mostrarNotificacion('✅ Repuesto creado', 'success');
        }

        cerrarModalRepuesto();
        await cargarRepuestos();
        await cargarDashboard();

    } catch (error) {
        console.error('Error:', error);
        mostrarNotificacion('Error: ' + error.message, 'error');
    }
});

// ============================================
// GESTIÓN DE SERVICIOS
// ============================================

async function cargarServicios() {
    try {
        console.log('🔍 Iniciando carga de servicios...');
        
        const { data, error } = await supabase
            .from('servicios')
            .select('*')
            .eq('activo', true)
            .order('nombre');

        if (error) {
            console.error('❌ Error en query:', error);
            throw error;
        }

        console.log('✅ Servicios cargados:', data?.length || 0);

        serviciosCache = data || [];

        if (serviciosCache.length === 0) {
            document.getElementById('tablaServicios').innerHTML = 
                '<p style="color:var(--warning);padding:2rem;text-align:center;">⚠️ No hay servicios registrados. Crea el primero usando el botón "+ Nuevo Servicio"</p>';
            return;
        }

        dash.renderTabla('tablaServicios', [
            { key: 'codigo', label: 'Código' },
            { key: 'nombre', label: 'Nombre' },
            { key: 'categoria', label: 'Categoría' },
            { key: 'descripcion', label: 'Descripción' }
        ], serviciosCache, [
            { label: 'Editar', icono: '✏️', fn: 'editarServicio', tipo: 'primary' }
        ]);

    } catch (error) {
        console.error('❌ Error cargando servicios:', error);
        mostrarNotificacion('Error cargando servicios: ' + error.message, 'error');
        
        document.getElementById('tablaServicios').innerHTML = 
            `<p style="color:var(--danger);padding:2rem;text-align:center;">❌ Error: ${error.message}</p>`;
    }
}

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
        (async () => {
            const servicio = serviciosCache.find(s => s.id === id);
            if (servicio) {
                document.getElementById('servicioCodigo').value = servicio.codigo;
                document.getElementById('servicioNombre').value = servicio.nombre;
                document.getElementById('servicioCategoria').value = servicio.categoria || 'mantenimiento';
                document.getElementById('servicioDescripcion').value = servicio.descripcion || '';
            }
        })();
    }

    document.getElementById('formServicio').addEventListener('submit', async (e) => {
        e.preventDefault();

        const servicioId = document.getElementById('servicioId').value;

        const datos = {
            codigo: document.getElementById('servicioCodigo').value.toUpperCase(),
            nombre: document.getElementById('servicioNombre').value,
            categoria: document.getElementById('servicioCategoria').value,
            descripcion: document.getElementById('servicioDescripcion').value.trim() || null,
            activo: true
        };

        try {
            if (servicioId) {
                await supabase.from('servicios').update(datos).eq('id', servicioId);
                await auth.registrarAccion('actualizar_servicio', 'servicios', servicioId);
                mostrarNotificacion('✅ Servicio actualizado', 'success');
            } else {
                await supabase.from('servicios').insert(datos);
                await auth.registrarAccion('crear_servicio', 'servicios');
                mostrarNotificacion('✅ Servicio creado', 'success');
            }

            cerrarModalServicio();
            await cargarServicios();

        } catch (error) {
            console.error('Error:', error);
            mostrarNotificacion('Error: ' + error.message, 'error');
        }
    });
}

window.editarServicio = abrirModalServicio;

window.cerrarModalServicio = () => {
    document.getElementById('modalServicio')?.remove();
}

// ============================================
// GESTIÓN DE MANO DE OBRA
// ============================================

async function cargarManoObra() {
    try {
        console.log('🔍 Iniciando carga de mano de obra...');
        
        const { data, error } = await supabase
            .from('mano_obra')
            .select('*')
            .eq('activo', true)
            .order('nombre');

        if (error) {
            console.error('❌ Error en query:', error);
            throw error;
        }

        console.log('✅ Mano de obra cargada:', data?.length || 0);

        manoObraCache = data || [];

        if (manoObraCache.length === 0) {
            document.getElementById('tablaManoObra').innerHTML = 
                '<p style="color:var(--warning);padding:2rem;text-align:center;">⚠️ No hay tarifas registradas. Crea la primera usando el botón "+ Nueva Tarifa"</p>';
            return;
        }

        dash.renderTabla('tablaManoObra', [
            { key: 'codigo', label: 'Código' },
            { key: 'nombre', label: 'Nombre' },
            { key: 'valor_unitario', label: 'Valor/Hora', tipo: 'moneda' },
            { key: 'aplica_iva', label: 'IVA',
              render: r => r.aplica_iva ? '✅ Sí' : '❌ No' },
            { key: 'descripcion', label: 'Descripción' }
        ], manoObraCache, [
            { label: 'Editar', icono: '✏️', fn: 'editarManoObra', tipo: 'primary' }
        ]);

    } catch (error) {
        console.error('❌ Error cargando mano de obra:', error);
        mostrarNotificacion('Error cargando mano de obra: ' + error.message, 'error');
        
        document.getElementById('tablaManoObra').innerHTML = 
            `<p style="color:var(--danger);padding:2rem;text-align:center;">❌ Error: ${error.message}</p>`;
    }
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
        (async () => {
            const mo = manoObraCache.find(m => m.id === id);
            if (mo) {
                document.getElementById('manoObraCodigo').value = mo.codigo;
                document.getElementById('manoObraNombre').value = mo.nombre;
                document.getElementById('manoObraValor').value = mo.valor_unitario;
                document.getElementById('manoObraDescripcion').value = mo.descripcion || '';
                document.getElementById('manoObraIVA').checked = mo.aplica_iva;
            }
        })();
    }

    document.getElementById('formManoObra').addEventListener('submit', async (e) => {
        e.preventDefault();

        const manoObraId = document.getElementById('manoObraId').value;

        const datos = {
            codigo: document.getElementById('manoObraCodigo').value.toUpperCase(),
            nombre: document.getElementById('manoObraNombre').value,
            descripcion: document.getElementById('manoObraDescripcion').value.trim() || null,
            valor_unitario: parseFloat(document.getElementById('manoObraValor').value),
            aplica_iva: document.getElementById('manoObraIVA').checked,
            activo: true
        };

        try {
            if (manoObraId) {
                await supabase.from('mano_obra').update(datos).eq('id', manoObraId);
                await auth.registrarAccion('actualizar_mano_obra', 'mano_obra', manoObraId);
                mostrarNotificacion('✅ Mano de obra actualizada', 'success');
            } else {
                await supabase.from('mano_obra').insert(datos);
                await auth.registrarAccion('crear_mano_obra', 'mano_obra');
                mostrarNotificacion('✅ Mano de obra creada', 'success');
            }

            cerrarModalManoObra();
            await cargarManoObra();

        } catch (error) {
            console.error('Error:', error);
            mostrarNotificacion('Error: ' + error.message, 'error');
        }
    });
}

window.editarManoObra = abrirModalManoObra;

window.cerrarModalManoObra = () => {
    document.getElementById('modalManoObra')?.remove();
}

// ============================================
// EXPORTAR A EXCEL
// ============================================

window.exportarRepuestos = async function() {
    if (!repuestosCache || repuestosCache.length === 0) {
        mostrarNotificacion('⚠️ No hay datos para exportar', 'warning');
        return;
    }

    const datos = repuestosCache.map(r => ({
        'Código': r.codigo,
        'Nombre': r.nombre,
        'Categoría': r.categoria || 'N/A',
        'Stock Actual': r.stock_actual,
        'Stock Mínimo': r.stock_minimo,
        'Costo Unitario': r.costo_unitario,
        'Precio Venta': r.precio_venta,
        'Valor Inventario': (r.stock_actual || 0) * (r.costo_unitario || 0),
        'Proveedor': r.proveedores?.razon_social || 'N/A',
        'Estado': r.activo ? 'Activo' : 'Inactivo'
    }));

    const exito = await exportarAExcel(datos, 'Inventario_Repuestos', 'Repuestos');
    
    if (exito) {
        mostrarNotificacion('✅ Archivo Excel generado exitosamente', 'success');
        await auth.registrarAccion('exportar_inventario', 'repuestos');
    } else {
        mostrarNotificacion('❌ Error generando archivo Excel', 'error');
    }
}

// ============================================
// FUNCIONES GLOBALES PARA HTML
// ============================================

window.cambiarSeccion = function(seccion, el) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    const sec = document.getElementById(seccion);
    if (sec) sec.classList.add('active');
    
    document.querySelectorAll('.sidebar nav a').forEach(a => a.classList.remove('active'));
    if (el) el.classList.add('active');

    if (seccion === 'dashboard') cargarDashboard();
    if (seccion === 'repuestos') cargarRepuestos();
    if (seccion === 'servicios') cargarServicios();
    if (seccion === 'mano_obra') cargarManoObra();
}

window.cerrarModalRepuesto = () => {
    document.getElementById('modalRepuesto').classList.remove('active');
}

window.cerrarSesion = () => auth.logout();