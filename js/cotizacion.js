// js/cotizacion.js
import { supabase } from './supabase-config.js';
import { DashboardBase } from './dashboards.js';
import { auth } from './auth-system.js';
import { 
    mostrarNotificacion, 
    formatearMoneda, 
    formatearFecha,
    calcularIVA,
    debounce,
    numeroALetras,
} from './utils.js';


const dash = new DashboardBase(['superadmin', 'jefe_taller', 'jefe_almacen']);

// ============================================
// VARIABLES GLOBALES
// ============================================

let clienteSeleccionado = null;
let vehiculoSeleccionado = null;
let itemsCotizacion = [];
let repuestosDisponibles = [];
let serviciosDisponibles = [];
let manoObraDisponible = [];
// ============================================
// FUNCIÓN DE REDONDEO HACIA ARRIBA
// ============================================

function redondearArriba(valor) {
    return Math.ceil(valor);
}

function formatearMonedaSinCentavos(valor) {
    const redondeado = redondearArriba(valor);
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(redondeado);
}
// ============================================
// INICIALIZACIÓN
// ============================================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarCotizacion);
} else {
    inicializarCotizacion();
}

async function inicializarCotizacion() {
    console.log('🚀 Inicializando cotización...');
    
    try {
        if (!await dash.inicializar()) {
            console.error('❌ Dashboard no inicializado');
            return;
        }
        
        console.log('✅ Dashboard inicializado');
        
        // Establecer fechas (HOY + 7 DÍAS)
        const hoy = new Date();
        const sieteDias = new Date();
        sieteDias.setDate(sieteDias.getDate() + 7);
        
        document.getElementById('fechaCotizacion').value = hoy.toISOString().split('T')[0];
        document.getElementById('validaHasta').value = sieteDias.toISOString().split('T')[0];
        
        // Cargar datos
        await Promise.all([
            cargarRepuestos(),
            cargarServicios(),
            cargarManoObra()
        ]);
        
        // Configurar eventos
        configurarEventos();
        
        console.log('✅ Cotización lista');
        
    } catch (error) {
        console.error('❌ Error:', error);
        mostrarNotificacion('Error inicializando: ' + error.message, 'error');
    }
}

// ============================================
// CONFIGURAR EVENTOS
// ============================================

function configurarEventos() {
    // Formulario: Agregar Repuesto
    document.getElementById('formAgregarRepuesto').addEventListener('submit', (e) => {
        e.preventDefault();
        agregarRepuesto();
    });
    
    // Formulario: Agregar Servicio
    document.getElementById('formAgregarServicio').addEventListener('submit', (e) => {
        e.preventDefault();
        agregarServicio();
    });
    
    // Formulario: Agregar Mano de Obra
    document.getElementById('formAgregarManoObra').addEventListener('submit', (e) => {
        e.preventDefault();
        agregarManoObra();
    });
    
    console.log('✅ Eventos configurados');
}

// ============================================
// BÚSQUEDA DE CLIENTE
// ============================================

window.buscarClienteInput = debounce(async function() {
    const input = document.getElementById('buscarCliente');
    const busqueda = input.value.trim();
    
    if (busqueda.length < 2) {
        document.getElementById('resultadosCliente').innerHTML = '';
        return;
    }
    
    // Mostrar indicador de carga
    document.getElementById('resultadosCliente').innerHTML = `
        <div style="padding:1rem;text-align:center;color:var(--gray-700);">
            <div style="display:inline-block;width:20px;height:20px;border:3px solid var(--gray-300);
                        border-top-color:var(--primary);border-radius:50%;animation:spin 1s linear infinite;">
            </div>
            <span style="margin-left:0.5rem;">Buscando...</span>
        </div>
    `;
    
    try {
        const { data, error } = await supabase
            .from('clientes')
            .select('id, razon_social, nit, telefono, email, margen_ganancia')
            .eq('activo', true)
            .or(`razon_social.ilike.%${busqueda}%,nit.ilike.%${busqueda}%,telefono.ilike.%${busqueda}%,email.ilike.%${busqueda}%`)
            .limit(10);

        if (error) throw error;

        mostrarResultadosCliente(data || []);

    } catch (error) {
        console.error('Error:', error);
        document.getElementById('resultadosCliente').innerHTML = `
            <p style="color:var(--danger);padding:0.5rem;">Error en la búsqueda</p>
        `;
    }
}, 300);

function mostrarResultadosCliente(clientes) {
    const container = document.getElementById('resultadosCliente');
    
    if (clientes.length === 0) {
        container.innerHTML = '<p style="color:var(--gray-700);padding:0.5rem;">No se encontraron clientes</p>';
        return;
    }
    
    const html = clientes.map(c => `
        <div class="search-result" onclick="seleccionarCliente(${c.id})">
            <strong>${c.razon_social}</strong>
            ${c.margen_ganancia ? `<span class="badge-margen">+${(c.margen_ganancia * 100).toFixed(0)}% Margen</span>` : ''}
            <br>
            <small>NIT: ${c.nit} | Tel: ${c.telefono || 'N/A'}</small>
        </div>
    `).join('');
    
    container.innerHTML = html;
}

window.seleccionarCliente = async function(clienteId) {
    try {
        const { data, error } = await supabase
            .from('clientes')
            .select('id, razon_social, nit, telefono, margen_ganancia')
            .eq('id', clienteId)
            .single();

        if (error) throw error;

        clienteSeleccionado = data;
        
        // Mostrar info del cliente
        document.getElementById('clienteIdSeleccionado').value = data.id;
        document.getElementById('clienteNombre').textContent = data.razon_social;
        document.getElementById('clienteNit').textContent = `NIT: ${data.nit}`;
        document.getElementById('clienteTelefono').textContent = `Tel: ${data.telefono || 'N/A'}`;
        
        // Mostrar margen si existe
        if (data.margen_ganancia && data.margen_ganancia > 0) {
            const margenBadge = document.getElementById('clienteMargen');
            margenBadge.textContent = `+${(data.margen_ganancia * 100).toFixed(0)}% Margen`;
            margenBadge.style.display = 'inline-block';
            document.getElementById('infoMargenAplicado').style.display = 'block';
        } else {
            document.getElementById('clienteMargen').style.display = 'none';
            document.getElementById('infoMargenAplicado').style.display = 'none';
        }
        
        document.getElementById('infoClienteSeleccionado').style.display = 'block';
        document.getElementById('buscarCliente').value = '';
        document.getElementById('resultadosCliente').innerHTML = '';
        
        // Habilitar y enfocar búsqueda de vehículo
        const buscarVehiculoInput = document.getElementById('buscarVehiculo');
        buscarVehiculoInput.disabled = false;
        buscarVehiculoInput.placeholder = '🔍 Buscar por placa, marca, línea...';
        
        // Auto-focus con un pequeño delay para mejor UX
        setTimeout(() => {
            buscarVehiculoInput.focus();
        }, 100);
        
        mostrarNotificacion('✅ Cliente seleccionado', 'success');

    } catch (error) {
        console.error('Error:', error);
        mostrarNotificacion('Error seleccionando cliente', 'error');
    }
}

window.limpiarCliente = function() {
    clienteSeleccionado = null;
    document.getElementById('clienteIdSeleccionado').value = '';
    document.getElementById('infoClienteSeleccionado').style.display = 'none';
    document.getElementById('buscarCliente').value = '';
    document.getElementById('buscarCliente').focus();
    
    // Limpiar vehículo también
    limpiarVehiculo();
    const buscarVehiculoInput = document.getElementById('buscarVehiculo');
    buscarVehiculoInput.disabled = true;
    buscarVehiculoInput.placeholder = 'Primero seleccione un cliente';
    
    // Limpiar margen
    document.getElementById('infoMargenAplicado').style.display = 'none';
    
    // Recalcular totales sin margen
    itemsCotizacion = [];
    renderizarItems();
    actualizarTotales();
    
    mostrarNotificacion('Cliente eliminado', 'info');
}

// ============================================
// BÚSQUEDA DE VEHÍCULO
// ============================================

window.buscarVehiculoInput = debounce(async function() {
    if (!clienteSeleccionado) {
        mostrarNotificacion('Primero seleccione un cliente', 'warning');
        return;
    }
    
    const busqueda = document.getElementById('buscarVehiculo').value.trim();
    
    if (busqueda.length < 2) {
        document.getElementById('resultadosVehiculo').innerHTML = '';
        return;
    }
    
    // Mostrar indicador de carga
    document.getElementById('resultadosVehiculo').innerHTML = `
        <div style="padding:1rem;text-align:center;color:var(--gray-700);">
            <div style="display:inline-block;width:20px;height:20px;border:3px solid var(--gray-300);
                        border-top-color:var(--primary);border-radius:50%;animation:spin 1s linear infinite;">
            </div>
            <span style="margin-left:0.5rem;">Buscando...</span>
        </div>
    `;
    
    try {
        const { data, error } = await supabase
            .from('vehiculos')
            .select('id, placa, marca, linea, modelo, color')
            .eq('cliente_id', clienteSeleccionado.id)
            .eq('activo', true)
            .or(`placa.ilike.%${busqueda}%,marca.ilike.%${busqueda}%,linea.ilike.%${busqueda}%`)
            .limit(10);

        if (error) throw error;

        mostrarResultadosVehiculo(data || []);

    } catch (error) {
        console.error('Error:', error);
        document.getElementById('resultadosVehiculo').innerHTML = `
            <p style="color:var(--danger);padding:0.5rem;">Error en la búsqueda</p>
        `;
    }
}, 300);

function mostrarResultadosVehiculo(vehiculos) {
    const container = document.getElementById('resultadosVehiculo');
    
    if (vehiculos.length === 0) {
        container.innerHTML = '<p style="color:var(--gray-700);padding:0.5rem;">No se encontraron vehículos para este cliente</p>';
        return;
    }
    
    const html = vehiculos.map(v => `
        <div class="search-result" onclick="seleccionarVehiculo(${v.id})">
            <strong>${v.placa}</strong><br>
            <small>${v.marca || ''} ${v.linea || ''} ${v.modelo || ''} ${v.color || ''}</small>
        </div>
    `).join('');
    
    container.innerHTML = html;
}

window.seleccionarVehiculo = async function(vehiculoId) {
    try {
        const { data, error } = await supabase
            .from('vehiculos')
            .select('id, placa, marca, linea, modelo, color')
            .eq('id', vehiculoId)
            .single();

        if (error) throw error;

        vehiculoSeleccionado = data;
        
        // Mostrar info del vehículo
        document.getElementById('vehiculoIdSeleccionado').value = data.id;
        document.getElementById('vehiculoPlaca').textContent = data.placa;
        document.getElementById('vehiculoInfo').textContent = 
            `${data.marca || ''} ${data.linea || ''} ${data.modelo || ''} ${data.color || ''}`.trim();
        
        document.getElementById('infoVehiculoSeleccionado').style.display = 'block';
        document.getElementById('buscarVehiculo').value = '';
        document.getElementById('resultadosVehiculo').innerHTML = '';
        
        mostrarNotificacion('✅ Vehículo seleccionado', 'success');

    } catch (error) {
        console.error('Error:', error);
        mostrarNotificacion('Error seleccionando vehículo', 'error');
    }
}

window.limpiarVehiculo = function() {
    vehiculoSeleccionado = null;
    document.getElementById('vehiculoIdSeleccionado').value = '';
    document.getElementById('infoVehiculoSeleccionado').style.display = 'none';
    document.getElementById('buscarVehiculo').value = '';
    document.getElementById('resultadosVehiculo').innerHTML = '';
    mostrarNotificacion('Vehículo eliminado', 'info');
}

// ============================================
// CARGAR REPUESTOS
// ============================================

async function cargarRepuestos() {
    try {
        const { data } = await supabase
            .from('repuestos')
            .select('id, codigo, nombre, precio_venta, stock_actual, costo_unitario')
            .eq('activo', true)
            .gt('stock_actual', 0)
            .order('nombre');

        repuestosDisponibles = data || [];
        console.log('✅ Repuestos:', repuestosDisponibles.length);

    } catch (error) {
        console.error('Error repuestos:', error);
    }
}

// ============================================
// CARGAR SERVICIOS
// ============================================

async function cargarServicios() {
    try {
        const { data } = await supabase
            .from('servicios')
            .select('id, codigo, nombre, descripcion')
            .eq('activo', true)
            .order('nombre');

        serviciosDisponibles = data || [];
        console.log('✅ Servicios:', serviciosDisponibles.length);

    } catch (error) {
        console.error('Error servicios:', error);
    }
}

// ============================================
// CARGAR MANO DE OBRA
// ============================================

async function cargarManoObra() {
    try {
        const { data } = await supabase
            .from('mano_obra')
            .select('id, codigo, nombre, valor_unitario')
            .eq('activo', true)
            .order('nombre');

        manoObraDisponible = data || [];
        console.log('✅ Mano de obra:', manoObraDisponible.length);

    } catch (error) {
        console.error('Error mano obra:', error);
    }
}

// ============================================
// CALCULAR PRECIO CON MARGEN CLIENTE
// ============================================

function calcularPrecioConMargen(precioBase) {
    if (!clienteSeleccionado || !clienteSeleccionado.margen_ganancia) {
        return precioBase;
    }
    
    const margen = clienteSeleccionado.margen_ganancia;
    return precioBase / (1 - margen);
}


// ============================================
// MODAL AGREGAR REPUESTO
// ============================================

window.abrirModalAgregarRepuesto = function() {
    if (!clienteSeleccionado) {
        mostrarNotificacion('⚠️ Primero seleccione un cliente', 'warning');
        return;
    }
    
    document.getElementById('formAgregarRepuesto').reset();
    document.getElementById('repuestoIdSeleccionado').value = '';
    document.getElementById('precioRepuesto').value = '';
    document.getElementById('infoPrecioRepuesto').innerHTML = '';
    filtrarRepuestosModal();
    document.getElementById('modalAgregarRepuesto').classList.add('active');
}

window.filtrarRepuestosModal = function() {
    const busqueda = document.getElementById('buscarRepuesto').value.toLowerCase();
    const container = document.getElementById('resultadosRepuestosModal');
    
    const filtrados = repuestosDisponibles.filter(r => 
        r.codigo.toLowerCase().includes(busqueda) ||
        r.nombre.toLowerCase().includes(busqueda)
    );
    
    if (filtrados.length === 0) {
        container.innerHTML = '<p style="color:var(--gray-700);padding:1rem;text-align:center;">No se encontraron repuestos</p>';
        return;
    }
    
    const html = filtrados.map(r => {
        const precioBase = r.precio_venta;
        const precioConMargen = calcularPrecioConMargen(precioBase);
        const tieneMargen = clienteSeleccionado && clienteSeleccionado.margen_ganancia > 0;
        
        return `
            <div class="search-result" onclick="seleccionarRepuestoModal(${r.id})">
                <div style="display:flex;justify-content:space-between;align-items:start;">
                    <div>
                        <strong>${r.codigo}</strong> - ${r.nombre}<br>
                        <small>Stock: ${r.stock_actual}</small>
                    </div>
                    <div style="text-align:right;">
                        ${tieneMargen ? `
                            <div style="font-size:.75rem;color:var(--gray-700);text-decoration:line-through;">
                                ${formatearMoneda(precioBase)}
                            </div>
                            <div style="font-size:1rem;font-weight:700;color:var(--primary);">
                                ${formatearMoneda(precioConMargen)}
                            </div>
                        ` : `
                            <div style="font-size:1rem;font-weight:700;color:var(--primary);">
                                ${formatearMoneda(precioBase)}
                            </div>
                        `}
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = html;
}

window.seleccionarRepuestoModal = function(repuestoId) {
    const repuesto = repuestosDisponibles.find(r => r.id === repuestoId);
    if (!repuesto) return;
    
    const precioBase = repuesto.precio_venta;
    const precioConMargen = calcularPrecioConMargen(precioBase);
    
    document.getElementById('repuestoIdSeleccionado').value = repuestoId;
    document.getElementById('precioRepuesto').value = Math.round(precioConMargen);
    
    // Quitar selección de otros
    document.querySelectorAll('#resultadosRepuestosModal .search-result').forEach(el => {
        el.classList.remove('selected');
    });
    
    // Marcar como seleccionado
    event.target.closest('.search-result').classList.add('selected');
    
    // Mostrar info de precio
    if (clienteSeleccionado && clienteSeleccionado.margen_ganancia > 0) {
        document.getElementById('infoPrecioRepuesto').innerHTML = `
            <div style="padding:0.75rem;background:var(--gray-50);border-radius:0.5rem;border:1px solid var(--gray-200);">
                <strong>Precio base:</strong> ${formatearMoneda(precioBase)}<br>
                <strong>Margen cliente (+${(clienteSeleccionado.margen_ganancia * 100).toFixed(0)}%):</strong> 
                ${formatearMoneda(precioConMargen - precioBase)}<br>
                <strong style="color:var(--primary);">Precio final:</strong> ${formatearMoneda(precioConMargen)}
            </div>
        `;
    } else {
        document.getElementById('infoPrecioRepuesto').innerHTML = '';
    }
    
    document.getElementById('cantidadRepuesto').focus();
}

window.cerrarModalRepuesto = function() {
    document.getElementById('modalAgregarRepuesto').classList.remove('active');
}

function agregarRepuesto() {
    const repuestoId = parseInt(document.getElementById('repuestoIdSeleccionado').value);
    const cantidad = parseInt(document.getElementById('cantidadRepuesto').value);
    const precio = parseFloat(document.getElementById('precioRepuesto').value);
    
    if (!repuestoId || !cantidad || !precio) {
        mostrarNotificacion('Complete todos los campos', 'warning');
        return;
    }
    
    const repuesto = repuestosDisponibles.find(r => r.id === repuestoId);
    if (!repuesto) return;
    
    if (cantidad > repuesto.stock_actual) {
        mostrarNotificacion(`Solo hay ${repuesto.stock_actual} unidades disponibles`, 'warning');
        return;
    }
    
    // REDONDEAR precio unitario y total
    const precioRedondeado = redondearArriba(precio);
    const totalRedondeado = redondearArriba(cantidad * precioRedondeado);
    
    const item = {
        id: Date.now(),
        tipo: 'repuesto',
        repuesto_id: repuestoId,
        nombre: `${repuesto.codigo} - ${repuesto.nombre}`,
        cantidad: cantidad,
        precio_unitario: precioRedondeado,
        precio_base: repuesto.precio_venta,
        total: totalRedondeado
    };
    
    itemsCotizacion.push(item);
    renderizarItems();
    actualizarTotales();
    cerrarModalRepuesto();
    mostrarNotificacion('✅ Repuesto agregado', 'success');
}

// ============================================
// MODAL AGREGAR SERVICIO
// ============================================


window.abrirModalAgregarServicio = function() {
    if (!clienteSeleccionado) {
        mostrarNotificacion('⚠️ Primero seleccione un cliente', 'warning');
        return;
    }
    
    const select = document.getElementById('selectServicio');
    select.innerHTML = '<option value="">Seleccionar servicio...</option>';
    
    serviciosDisponibles.forEach(s => {
        const option = document.createElement('option');
        option.value = s.id;
        option.textContent = `${s.codigo} - ${s.nombre}`;
        select.appendChild(option);
    });
    
    document.getElementById('formAgregarServicio').reset();
    
    // Agregar nota sobre margen si aplica
    if (clienteSeleccionado && clienteSeleccionado.margen_ganancia > 0) {
        const form = document.getElementById('formAgregarServicio');
        const note = document.createElement('div');
        note.id = 'notaMargenServicio';
        note.style.cssText = 'padding:0.75rem;background:#fff3cd;border-radius:0.5rem;margin-bottom:1rem;';
        note.innerHTML = `<strong>⚠️ Nota:</strong> Se aplicará un margen del ${(clienteSeleccionado.margen_ganancia * 100).toFixed(0)}% al precio ingresado.`;
        form.insertBefore(note, form.firstChild);
    }
    
    document.getElementById('modalAgregarServicio').classList.add('active');
}

window.cerrarModalServicio = function() {
    document.getElementById('notaMargenServicio')?.remove();
    document.getElementById('modalAgregarServicio').classList.remove('active');
}

function agregarServicio() {
    const servicioId = parseInt(document.getElementById('selectServicio').value);
    const precioBase = parseFloat(document.getElementById('precioServicio').value);
    
    if (!servicioId || !precioBase) {
        mostrarNotificacion('Complete todos los campos', 'warning');
        return;
    }
    
    const servicio = serviciosDisponibles.find(s => s.id === servicioId);
    if (!servicio) return;
    
    // APLICAR MARGEN Y REDONDEAR
    const precioConMargen = calcularPrecioConMargen(precioBase);
    const precioRedondeado = redondearArriba(precioConMargen);
    
    const item = {
        id: Date.now(),
        tipo: 'servicio',
        servicio_id: servicioId,
        nombre: `${servicio.codigo} - ${servicio.nombre}`,
        cantidad: 1,
        precio_unitario: precioRedondeado,
        precio_base: precioBase,
        total: precioRedondeado
    };
    
    itemsCotizacion.push(item);
    renderizarItems();
    actualizarTotales();
    cerrarModalServicio();
    mostrarNotificacion('✅ Servicio agregado' + (precioRedondeado !== precioBase ? ' (con margen)' : ''), 'success');
}
// ============================================
// MODAL AGREGAR MANO DE OBRA
// ============================================

window.abrirModalAgregarManoObra = function() {
    if (!clienteSeleccionado) {
        mostrarNotificacion('⚠️ Primero seleccione un cliente', 'warning');
        return;
    }
    
    const select = document.getElementById('selectManoObra');
    select.innerHTML = '<option value="">Seleccionar...</option>';
    
    manoObraDisponible.forEach(mo => {
        const precioBase = mo.valor_unitario;
        const precioConMargen = calcularPrecioConMargen(precioBase);
        
        const option = document.createElement('option');
        option.value = mo.id;
        option.textContent = `${mo.nombre} - ${formatearMoneda(precioConMargen)}/hora`;
        option.dataset.valor = precioConMargen;
        option.dataset.valorBase = precioBase;
        select.appendChild(option);
    });
    
    document.getElementById('formAgregarManoObra').reset();
    document.getElementById('valorManoObra').value = '';
    
    // Agregar nota sobre margen si aplica
    if (clienteSeleccionado && clienteSeleccionado.margen_ganancia > 0) {
        const form = document.getElementById('formAgregarManoObra');
        const note = document.createElement('div');
        note.id = 'notaMargenManoObra';
        note.style.cssText = 'padding:0.75rem;background:#fff3cd;border-radius:0.5rem;margin-bottom:1rem;';
        note.innerHTML = `<strong>⚠️ Nota:</strong> Los precios mostrados ya incluyen el margen del ${(clienteSeleccionado.margen_ganancia * 100).toFixed(0)}%.`;
        form.insertBefore(note, form.firstChild);
    }
    
    document.getElementById('modalAgregarManoObra').classList.add('active');
}

window.seleccionarManoObra = function() {
    const select = document.getElementById('selectManoObra');
    const option = select.options[select.selectedIndex];
    const valor = option.dataset.valor;
    
    if (valor) {
        document.getElementById('valorManoObra').value = valor;
    }
}

window.cerrarModalManoObra = function() {
    document.getElementById('notaMargenManoObra')?.remove();
    document.getElementById('modalAgregarManoObra').classList.remove('active');
}

function agregarManoObra() {
    const manoObraId = parseInt(document.getElementById('selectManoObra').value);
    const horas = parseFloat(document.getElementById('horasManoObra').value);
    const valorHora = parseFloat(document.getElementById('valorManoObra').value);
    
    if (!manoObraId || !horas || !valorHora) {
        mostrarNotificacion('Complete todos los campos', 'warning');
        return;
    }
    
    const mo = manoObraDisponible.find(m => m.id === manoObraId);
    if (!mo) return;
    
    const select = document.getElementById('selectManoObra');
    const option = select.options[select.selectedIndex];
    const valorBase = parseFloat(option.dataset.valorBase);
    
    // REDONDEAR
    const valorHoraRedondeado = redondearArriba(valorHora);
    const totalRedondeado = redondearArriba(horas * valorHoraRedondeado);
    
    const item = {
        id: Date.now(),
        tipo: 'mano_obra',
        mano_obra_id: manoObraId,
        nombre: `${mo.nombre} (${horas}h)`,
        cantidad: horas,
        precio_unitario: valorHoraRedondeado,
        precio_base: valorBase || mo.valor_unitario,
        total: totalRedondeado
    };
    
    itemsCotizacion.push(item);
    renderizarItems();
    actualizarTotales();
    cerrarModalManoObra();
    
    const tieneMargen = valorBase && valorHoraRedondeado !== valorBase;
    mostrarNotificacion('✅ Mano de obra agregada' + (tieneMargen ? ' (con margen)' : ''), 'success');
}

// ============================================
// RENDERIZAR ITEMS
// ============================================

function renderizarItems() {
    const container = document.getElementById('tablaItemsCotizacion');
    
    if (itemsCotizacion.length === 0) {
        container.innerHTML = '<p style="color:var(--gray-700);padding:2rem;text-align:center;">No hay items agregados.</p>';
        return;
    }
    
    const html = itemsCotizacion.map(item => {
        const tieneMargen = item.precio_base && item.precio_unitario !== item.precio_base;
        
        return `
            <div class="item-row">
                <div>
                    <strong>${item.nombre}</strong><br>
                    <small style="color:var(--gray-700);">${item.tipo.toUpperCase()}</small>
                    ${tieneMargen ? '<br><small style="color:var(--warning);"><strong>* Con margen cliente</strong></small>' : ''}
                </div>
                <div>
                    <small style="color:var(--gray-700);">Cantidad</small><br>
                    <strong>${item.cantidad}</strong>
                </div>
                <div>
                    <small style="color:var(--gray-700);">P. Unitario</small><br>
                    <strong>${formatearMonedaSinCentavos(item.precio_unitario)}</strong>
                </div>
                <div>
                    <small style="color:var(--gray-700);">Total</small><br>
                    <strong style="color:var(--primary);">${formatearMonedaSinCentavos(item.total)}</strong>
                </div>
                <div style="text-align:center;">
                    <button onclick="eliminarItem(${item.id})" class="btn btn-danger" 
                            style="padding:.5rem;width:100%;" title="Eliminar item">
                        ❌
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = html;
}

window.eliminarItem = function(itemId) {
    if (!confirm('¿Eliminar este item?')) return;
    
    itemsCotizacion = itemsCotizacion.filter(i => i.id !== itemId);
    renderizarItems();
    actualizarTotales();
    mostrarNotificacion('Item eliminado', 'info');
}

// ============================================
// CALCULAR TOTALES
// ============================================

function calcularSubtotalCotizacion() {
    const subtotal = itemsCotizacion.reduce((sum, item) => sum + item.total, 0);
    return redondearArriba(subtotal);
}

function calcularIVACotizacion() {
    const subtotal = calcularSubtotalCotizacion();
    const iva = subtotal * 0.19;
    return redondearArriba(iva);
}

function calcularTotalCotizacion() {
    return calcularSubtotalCotizacion() + calcularIVACotizacion();
}

function actualizarTotales() {
    const subtotal = calcularSubtotalCotizacion();
    const iva = calcularIVACotizacion();
    const total = calcularTotalCotizacion();

    document.getElementById('subtotalCotizacion').textContent = formatearMonedaSinCentavos(subtotal);
    document.getElementById('ivaCotizacion').textContent = formatearMonedaSinCentavos(iva);
    document.getElementById('totalCotizacion').textContent = formatearMonedaSinCentavos(total);
}
// ============================================
// GUARDAR COTIZACIÓN
// ============================================
window.guardarCotizacion = async function() {
    console.log('💾 Iniciando guardado de cotización...');
    
    // Validaciones
    if (!clienteSeleccionado) {
        mostrarNotificacion('⚠️ Seleccione un cliente', 'warning');
        return;
    }

    if (!vehiculoSeleccionado) {
        mostrarNotificacion('⚠️ Seleccione un vehículo', 'warning');
        return;
    }

    if (itemsCotizacion.length === 0) {
        mostrarNotificacion('⚠️ Agregue al menos un item', 'warning');
        return;
    }

    try {
        // Generar número de cotización
        const { count, error: countError } = await supabase
            .from('cotizaciones')
            .select('*', { count: 'exact', head: true });

        if (countError) {
            console.error('Error obteniendo count:', countError);
            throw countError;
        }

        const numeroCotizacion = `COT${String((count || 0) + 1).padStart(6, '0')}`;
        console.log('📋 Número de cotización:', numeroCotizacion);

        // Preparar datos de la cotización
        const subtotal = calcularSubtotalCotizacion();
        const iva = calcularIVACotizacion();
        const total = calcularTotalCotizacion();

        const datos = {
            folio: numeroCotizacion,
            cliente_id: parseInt(clienteSeleccionado.id),
            vehiculo_id: parseInt(vehiculoSeleccionado.id),
            fecha_cotizacion: document.getElementById('fechaCotizacion').value,
            valida_hasta: document.getElementById('validaHasta').value,
            observaciones: document.getElementById('observacionesCotizacion').value?.trim() || null,
            subtotal: parseFloat(subtotal.toFixed(2)),
            iva: parseFloat(iva.toFixed(2)),
            total: parseFloat(total.toFixed(2)),
            margen_cliente: parseFloat(clienteSeleccionado.margen_ganancia || 0),
            estado: 'pendiente'
        };

        console.log('📦 Datos a insertar:', datos);

        // Insertar cotización
        const { data: cotizacion, error: errorCotizacion } = await supabase
            .from('cotizaciones')
            .insert(datos)
            .select()
            .single();

        if (errorCotizacion) {
            console.error('❌ Error insertando cotización:', errorCotizacion);
            throw errorCotizacion;
        }

        console.log('✅ Cotización insertada:', cotizacion);

        // Preparar items
        const itemsParaInsertar = itemsCotizacion.map(item => {
            const itemData = {
                cotizacion_id: parseInt(cotizacion.id),
                repuesto_id: item.repuesto_id ? parseInt(item.repuesto_id) : null,
                servicio_id: item.servicio_id ? parseInt(item.servicio_id) : null,
                mano_obra_id: item.mano_obra_id ? parseInt(item.mano_obra_id) : null,
                cantidad: parseFloat(item.cantidad),
                precio_unitario: parseFloat(item.precio_unitario),
                total: parseFloat(item.total.toFixed(2))
            };
            
            console.log('📝 Item a insertar:', itemData);
            return itemData;
        });

        console.log('📦 Total de items a insertar:', itemsParaInsertar.length);

        // Insertar items
        const { data: itemsInsertados, error: errorItems } = await supabase
            .from('cotizacion_items')
            .insert(itemsParaInsertar)
            .select();

        if (errorItems) {
            console.error('❌ Error insertando items:', errorItems);
            throw errorItems;
        }

        console.log('✅ Items insertados:', itemsInsertados?.length);

        // Registrar en auditoría
        try {
            await auth.registrarAccion('crear_cotizacion', 'cotizaciones', cotizacion.id);
        } catch (auditError) {
            console.warn('⚠️ Error en auditoría (no crítico):', auditError);
        }
        
        mostrarNotificacion('✅ Cotización guardada: ' + numeroCotizacion, 'success');
        
        setTimeout(() => {
            window.location.href = 'almacen-dashboard.html';
        }, 2000);

    } catch (error) {
        console.error('❌ Error completo:', error);
        console.error('Detalles del error:', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code
        });
        
        let mensajeError = 'Error guardando cotización';
        
        if (error.code === '23505') {
            mensajeError = 'El número de cotización ya existe';
        } else if (error.code === '23503') {
            mensajeError = 'Error de referencia: Verifica que el cliente y vehículo existan';
        } else if (error.message) {
            mensajeError = error.message;
        }
        
        mostrarNotificacion('❌ ' + mensajeError, 'error');
    }
}
async function subirPDFASupabase(htmlContent, folio) {
    try {
        // Convertir HTML a Blob (simulación de PDF)
        const blob = new Blob([htmlContent], { type: 'text/html' });
        
        // Nombre del archivo
        const fileName = `${folio}_${Date.now()}.html`;
        const filePath = `cotizaciones/${fileName}`;

        // Subir a Supabase Storage
        const { data, error } = await supabase.storage
            .from('cotizaciones')
            .upload(filePath, blob, {
                contentType: 'text/html',
                upsert: false
            });

        if (error) throw error;

        // Obtener URL pública
        const { data: urlData } = supabase.storage
            .from('cotizaciones')
            .getPublicUrl(filePath);

        return {
            success: true,
            url: urlData.publicUrl,
            path: filePath
        };

    } catch (error) {
        console.error('Error subiendo PDF:', error);
        return {
            success: false,
            error: error.message
        };
    }
}
// ============================================
// GENERAR PDF
// ============================================
// ============================================
// GENERAR PDF DE COTIZACIÓN
// ============================================

async function generarHTMLCotizacion(cotizacionData) {
    const { 
        folio,
        cliente,
        vehiculo,
        fecha_cotizacion,
        valida_hasta,
        items,
        subtotal,
        iva,
        total,
        observaciones
    } = cotizacionData;

    // Configuración de la empresa
    let empresaNombre = 'SPECIAL PITS';
    let empresaNit = 'NIT: 901.252.081-6';
    let empresaTelefono = 'Tel: (301) 135-4863';
    let empresaEmail = 'almacenspecialcarpits@gmail.com';
    let empresaDireccion = 'Carrera 69 f # 19a -91';
    let empresaCiudad = 'Bogotá, Colombia';

    try {
        const { data: config } = await supabase
            .from('configuracion_sistema')
            .select('*')
            .eq('id', 1)
            .single();

        if (config) {
            empresaNombre = config.empresa_nombre || empresaNombre;
            empresaNit = config.empresa_nit || empresaNit;
            empresaTelefono = config.empresa_telefono || empresaTelefono;
            empresaEmail = config.empresa_email || empresaEmail;
            empresaDireccion = config.empresa_direccion || empresaDireccion;
            empresaCiudad = config.empresa_ciudad || empresaCiudad;
        }
    } catch (e) {
        console.warn('No se pudo cargar configuración:', e);
    }

const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Cotización ${folio}</title>
            <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            body {
                font-family: Arial, sans-serif;
                font-size: 9pt;
                color: #333;
                line-height: 1.3;
            }
            .page {
                width: 21cm;
                height: 29.7cm;
                padding: 1cm;
                background: white;
                margin: 0 auto;
            }
            
            .header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                border-bottom: 2px solid #2563eb;
                padding-bottom: 8px;
                margin-bottom: 12px;
            }
            .empresa-info {
                display: flex;
                flex-direction: column;
                gap: 4px;
                flex: 1;
                align-items: flex-start;
            }
            .logo {
                width: 180px;
                height: auto;
                object-fit: contain;
                display: block;
                margin: 0;
            }
            .empresa-datos {
                display: flex;
                flex-direction: column;
                gap: 1px;
                padding: 0;
                margin: 0;
            }
            .empresa-datos p {
                font-size: 8pt;
                color: #666;
                margin: 0;
                padding: 0;
                text-align: left;
            }
            .cotizacion-info {
                text-align: right;
                background: #f0f9ff;
                padding: 8px 12px;
                border-radius: 6px;
                border: 2px solid #2563eb;
                min-width: 200px;
            }
            .cotizacion-info h2 {
                color: #2563eb;
                font-size: 14pt;
                margin-bottom: 4px;
            }
            .cotizacion-info p {
                font-size: 8pt;
                margin: 2px 0;
            }
            
            .info-section {
                display: flex;
                gap: 10px;
                margin-bottom: 10px;
            }
            .info-box {
                flex: 1;
                border: 1px solid #e5e7eb;
                padding: 8px;
                border-radius: 4px;
                background: #f9fafb;
            }
            .info-box h3 {
                color: #2563eb;
                font-size: 9pt;
                margin-bottom: 4px;
                border-bottom: 1px solid #cbd5e1;
                padding-bottom: 2px;
            }
            .info-box p {
                font-size: 8pt;
                margin: 2px 0;
            }
            .info-box strong {
                color: #1f2937;
                display: inline-block;
                width: 70px;
            }
            
            table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 10px;
                font-size: 8pt;
            }
            thead {
                background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
                color: white;
            }
            thead th {
                padding: 6px 4px;
                text-align: left;
                font-weight: 600;
            }
            thead th:nth-child(4),
            thead th:nth-child(5) {
                text-align: right;
            }
            tbody tr {
                border-bottom: 1px solid #e5e7eb;
            }
            tbody tr:nth-child(even) {
                background: #f9fafb;
            }
            tbody td {
                padding: 5px 4px;
            }
            tbody td:nth-child(4),
            tbody td:nth-child(5) {
                text-align: right;
            }
            .item-desc {
                color: #6b7280;
                font-size: 7pt;
            }
            
            .totales {
                float: right;
                width: 35%;
                margin-top: 5px;
            }
            .total-row {
                display: flex;
                justify-content: space-between;
                padding: 5px 10px;
                border-bottom: 1px solid #e5e7eb;
                font-size: 8pt;
            }
            .total-row.subtotal {
                background: #f9fafb;
                font-weight: 600;
            }
            .total-row.iva {
                background: #f0f9ff;
            }
            .total-row.total {
                background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
                color: white;
                font-size: 10pt;
                font-weight: 700;
                border: none;
                margin-top: 3px;
            }
            
            .valor-letras {
                clear: both;
                margin-top: 50px;
                padding: 8px;
                background: #fef3c7;
                border-left: 3px solid #f59e0b;
                border-radius: 3px;
                margin-bottom: 10px;
                font-size: 8pt;
            }
            .valor-letras strong {
                color: #92400e;
            }
            
            .observaciones {
                margin-bottom: 10px;
                padding: 8px;
                background: #f0f9ff;
                border-left: 3px solid #3b82f6;
                border-radius: 3px;
            }
            .observaciones h4 {
                color: #1e40af;
                font-size: 9pt;
                margin-bottom: 4px;
            }
            .observaciones p {
                font-size: 8pt;
                color: #374151;
                line-height: 1.4;
                white-space: pre-wrap;
            }
            
            .condiciones {
                margin-top: 10px;
                padding: 8px;
                background: #f9fafb;
                border: 1px solid #e5e7eb;
                border-radius: 3px;
            }
            .condiciones h4 {
                color: #1f2937;
                font-size: 9pt;
                margin-bottom: 4px;
            }
            .condiciones ul {
                margin-left: 15px;
                font-size: 7pt;
                color: #4b5563;
            }
            .condiciones li {
                margin: 2px 0;
            }
            
            .firmas {
                display: flex;
                justify-content: space-around;
                margin-top: 30px;
            }
            .firma {
                text-align: center;
                width: 40%;
            }
            .firma-line {
                border-top: 1px solid #000;
                margin-bottom: 5px;
            }
            .firma p {
                font-size: 8pt;
                color: #4b5563;
            }
            
            .footer {
                margin-top: 20px;
                padding-top: 8px;
                border-top: 1px solid #e5e7eb;
                text-align: center;
                font-size: 7pt;
                color: #6b7280;
            }
            
            @media print {
                body { margin: 0; }
                .page { 
                    margin: 0; 
                    padding: 1cm;
                    page-break-after: avoid;
                }
                .no-print { display: none; }
            }
        </style>
</head>
<body>
    <div class="page">
        <div class="header">
            <div class="empresa-info">
                <img src="assets/logo.jpg" alt="Logo Special PITS" class="logo">
                <div class="empresa-datos">
                    <p><strong>${empresaNit}</strong></p>
                    <p>${empresaTelefono} | ${empresaEmail}</p>
                    <p>${empresaDireccion}</p>
                    <p>${empresaCiudad}</p>
                </div>
            </div>
            <div class="cotizacion-info">
                <h2>COTIZACIÓN</h2>
                <p><strong>${folio}</strong></p>
                <p>Fecha: ${formatearFecha(fecha_cotizacion)}</p>
                <p>Válida: ${formatearFecha(valida_hasta)}</p>
            </div>
        </div>

        <div class="info-section">
            <div class="info-box">
                <h3>📋 CLIENTE</h3>
                <p><strong>Nombre:</strong> ${cliente.razon_social}</p>
                <p><strong>NIT:</strong> ${cliente.nit}</p>
                <p><strong>Tel:</strong> ${cliente.telefono || 'N/A'}</p>
                <p><strong>Email:</strong> ${cliente.email || 'N/A'}</p>
            </div>
            <div class="info-box">
                <h3>🚗 VEHÍCULO</h3>
                <p><strong>Placa:</strong> ${vehiculo.placa}</p>
                <p><strong>Marca:</strong> ${vehiculo.marca || 'N/A'}</p>
                <p><strong>Línea:</strong> ${vehiculo.linea || 'N/A'}</p>
                <p><strong>Modelo:</strong> ${vehiculo.modelo || 'N/A'}</p>
            </div>
        </div>

        <table>
            <thead>
                <tr>
                    <th style="width:8%;">CANT.</th>
                    <th style="width:47%;">DESCRIPCIÓN</th>
                    <th style="width:15%;">TIPO</th>
                    <th style="width:15%;">P. UNIT.</th>
                    <th style="width:15%;">TOTAL</th>
                </tr>
            </thead>
            <tbody>
                ${items.map(item => `
                    <tr>
                        <td style="text-align:center;"><strong>${item.cantidad}</strong></td>
                        <td>
                            <strong>${item.nombre}</strong>
                            ${item.descripcion ? `<br><span class="item-desc">${item.descripcion}</span>` : ''}
                        </td>
                        <td style="text-align:center;">
                            <span style="padding:2px 6px;background:#e0f2fe;color:#0369a1;border-radius:2px;font-size:7pt;">
                                ${item.tipo.toUpperCase()}
                            </span>
                        </td>
                        <td>${formatearMonedaSinCentavos(item.precio_unitario)}</td>
                        <td><strong>${formatearMonedaSinCentavos(item.total)}</strong></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <div class="totales">
            <div class="total-row subtotal">
                <span>SUBTOTAL:</span>
                <span>${formatearMonedaSinCentavos(subtotal)}</span>
            </div>
            <div class="total-row iva">
                <span>IVA (19%):</span>
                <span>${formatearMonedaSinCentavos(iva)}</span>
            </div>
            <div class="total-row total">
                <span>TOTAL:</span>
                <span>${formatearMonedaSinCentavos(total)}</span>
            </div>
        </div>

        <div class="valor-letras">
            <strong>SON:</strong> ${numeroALetras(total)}
        </div>

        ${observaciones ? `
            <div class="observaciones">
                <h4>📝 OBSERVACIONES</h4>
                <p>${observaciones}</p>
            </div>
        ` : ''}

        <div class="condiciones">
            <h4>CONDICIONES:</h4>
            <ul>
                <li>Cotización válida por 7 días calendario.</li>
                <li>Precios sujetos a disponibilidad.</li>
                <li>Trabajos adicionales cotizados por separado.</li>
                <li>Garantía según fabricante.</li>
            </ul>
        </div>

        <div class="firmas">
            <div class="firma">
                <div class="firma-line"></div>
                <p><strong>Special Pits</strong></p>
                <p>Firma Autorizada</p>
            </div>
            <div class="firma">
                <div class="firma-line"></div>
                <p><strong>${cliente.razon_social}</strong></p>
                <p>Firma Cliente</p>
            </div>
        </div>

        <div class="footer">
            <p>Generado: ${formatearFecha(new Date())} | Special Pits - ${empresaTelefono}</p>
        </div>
    </div>
</body>
</html>
    `;

    return html;
}

function mostrarVistaPreviaModal(htmlContent, emailData) {
    const modal = `
        <div class="modal active" id="modalVistaPreviaPDF" style="display:flex;z-index:10000;">
            <div class="modal-content" style="max-width:95%;width:900px;max-height:95vh;padding:1rem;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;padding-bottom:1rem;border-bottom:2px solid var(--gray-200);">
                    <h2>📄 Vista Previa de Cotización</h2>
                    <button onclick="cerrarVistaPreviaPDF()" class="btn btn-secondary">✕</button>
                </div>

                <div style="display:flex;gap:1rem;margin-bottom:1rem;flex-wrap:wrap;">
                    <button onclick="imprimirPDF()" class="btn btn-primary" style="flex:1;min-width:150px;">
                        🖨️ Imprimir
                    </button>
                    <button onclick="descargarPDF()" class="btn btn-success" style="flex:1;min-width:150px;">
                        💾 Descargar PDF
                    </button>
                    <button onclick="abrirModalEnviarEmail()" class="btn btn-primary" style="flex:1;min-width:150px;">
                        📧 Enviar por Email
                    </button>
                </div>

                <div id="contenidoPDF" style="max-height:calc(90vh - 150px);overflow-y:auto;border:1px solid var(--gray-300);border-radius:0.5rem;background:white;box-shadow:0 4px 12px rgba(0,0,0,0.1);">
                    ${htmlContent}
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modal);

    // Guardar datos globalmente
    window.emailCotizacionData = emailData;
    window.htmlCotizacion = htmlContent;
}

window.cerrarVistaPreviaPDF = function() {
    document.getElementById('modalVistaPreviaPDF')?.remove();
    document.getElementById('modalEnviarEmail')?.remove();
}

window.imprimirPDF = function() {
    const contenido = document.getElementById('contenidoPDF').innerHTML;
    const ventana = window.open('', '_blank');
    ventana.document.write(contenido);
    ventana.document.close();
    setTimeout(() => {
        ventana.print();
    }, 250);
}

window.descargarPDF = function() {
    mostrarNotificacion('ℹ️ En el diálogo de impresión, selecciona "Guardar como PDF"', 'info');
    window.imprimirPDF();
}

window.abrirModalEnviarEmail = function() {
    const emailData = window.emailCotizacionData;
    
    const modalEmail = `
        <div class="modal active" id="modalEnviarEmail" style="display:flex;z-index:10001;">
            <div class="modal-content" style="max-width:600px;">
                <h2>📧 Enviar Cotización por Email</h2>
                
                <form id="formEnviarEmail">
                    <div class="form-group">
                        <label>Email del Cliente *</label>
                        <input type="email" id="emailDestino" class="form-control" 
                               value="${emailData.clienteEmail}" required>
                    </div>

                    <div class="form-group">
                        <label>Asunto</label>
                        <input type="text" id="emailAsunto" class="form-control" 
                               value="Cotización ${emailData.folio} - ${emailData.empresaNombre}" readonly>
                    </div>

                    <div class="form-group">
                        <label>Mensaje</label>
                        <textarea id="emailMensaje" class="form-control" rows="6">${`Estimado/a ${emailData.clienteNombre},

Adjunto encontrará la cotización ${emailData.folio} para su vehículo ${emailData.vehiculoPlaca}.

Esta cotización tiene una validez de 7 días calendario.

Para cualquier consulta, no dude en contactarnos.

Atentamente,
${emailData.empresaNombre}
${emailData.empresaTelefono}`}</textarea>
                    </div>

                    <div style="display:flex;gap:1rem;margin-top:1.5rem;">
                        <button type="submit" class="btn btn-primary" style="flex:1;">
                            📧 Enviar
                        </button>
                        <button type="button" onclick="document.getElementById('modalEnviarEmail').remove()" class="btn btn-secondary">
                            Cancelar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalEmail);

    document.getElementById('formEnviarEmail').addEventListener('submit', async (e) => {
        e.preventDefault();
        await enviarEmailCotizacion();
    });
}

async function enviarEmailCotizacion() {
    const emailDestino = document.getElementById('emailDestino').value;
    const asunto = document.getElementById('emailAsunto').value;
    const mensaje = document.getElementById('emailMensaje').value;
    const emailData = window.emailCotizacionData;

    try {
        mostrarNotificacion('📧 Enviando email...', 'info');

        // Crear mensaje con URL del PDF si existe
        let mensajeFinal = mensaje;
        if (emailData.pdfUrl) {
            mensajeFinal += `\n\n📎 Ver cotización en línea: ${emailData.pdfUrl}`;
        }

        // Guardar registro de envío
        const { error } = await supabase
            .from('emails_enviados')
            .insert({
                tipo: 'cotizacion',
                destinatario: emailDestino,
                asunto: asunto,
                mensaje: mensajeFinal,
                cotizacion_id: emailData.cotizacionId,
                url_pdf: emailData.pdfUrl,
                estado: 'enviado',
                enviado_at: new Date().toISOString()
            });

        if (error) throw error;

        mostrarNotificacion('✅ Email registrado correctamente', 'success');
        document.getElementById('modalEnviarEmail').remove();
        
    } catch (error) {
        console.error('Error:', error);
        mostrarNotificacion('❌ Error: ' + error.message, 'error');
    }
}

window.generarPDFCotizacion = async function() {
    if (!clienteSeleccionado || !vehiculoSeleccionado || itemsCotizacion.length === 0) {
        mostrarNotificacion('⚠️ Complete todos los datos de la cotización primero', 'warning');
        return;
    }

    try {
        mostrarNotificacion('📄 Generando PDF...', 'info');

        // Generar folio temporal o usar el guardado
        const folio = `COT-${Date.now()}`;

        // Preparar datos
        const cotizacionData = {
            folio: folio,
            cliente: clienteSeleccionado,
            vehiculo: vehiculoSeleccionado,
            fecha_cotizacion: document.getElementById('fechaCotizacion').value,
            valida_hasta: document.getElementById('validaHasta').value,
            items: itemsCotizacion.map(item => ({
                cantidad: item.cantidad,
                nombre: item.nombre,
                descripcion: item.tipo === 'repuesto' ? `Cód: ${item.nombre.split(' - ')[0]}` : '',
                tipo: item.tipo,
                precio_unitario: item.precio_unitario,
                total: item.total
            })),
            subtotal: calcularSubtotalCotizacion(),
            iva: calcularIVACotizacion(),
            total: calcularTotalCotizacion(),
            observaciones: document.getElementById('observacionesCotizacion').value?.trim() || null
        };

        // Generar HTML
        const htmlPDF = await generarHTMLCotizacion(cotizacionData);

        // Subir a Supabase
        mostrarNotificacion('☁️ Subiendo a la nube...', 'info');
        const resultado = await subirPDFASupabase(htmlPDF, folio);

        if (!resultado.success) {
            console.warn('No se pudo subir a Supabase:', resultado.error);
            mostrarNotificacion('⚠️ PDF generado pero no se pudo guardar en la nube', 'warning');
        } else {
            console.log('✅ PDF guardado en:', resultado.url);
        }

        // Datos para email
        const emailData = {
            cotizacionId: null,
            folio: folio,
            clienteEmail: clienteSeleccionado.email || '',
            clienteNombre: clienteSeleccionado.razon_social,
            vehiculoPlaca: vehiculoSeleccionado.placa,
            empresaNombre: 'Special Pits',
            empresaTelefono: '(301) 135-4863',
            pdfUrl: resultado.success ? resultado.url : null
        };

        // Mostrar vista previa
        mostrarVistaPreviaModal(htmlPDF, emailData);
        
        if (resultado.success) {
            mostrarNotificacion('✅ PDF generado y guardado', 'success');
        }

    } catch (error) {
        console.error('Error generando PDF:', error);
        mostrarNotificacion('❌ Error: ' + error.message, 'error');
    }
}

console.log('✅ cotizacion.js cargado completamente');