// js/cotizacion.js - VERSIÓN CON SERVICIOS ANCLADOS
import { supabase } from './supabase-config.js';
import { 
    formatearMoneda, 
    numeroALetras, 
    calcularIVA, 
    mostrarNotificacion,
    debounce 
} from './utils.js';

// ============================================
// VARIABLES GLOBALES
// ============================================
let clienteActual = null;
let vehiculoActual = null;
let serviciosAgregados = []; // Ahora incluye sus componentes anclados
let repuestosAgregados = [];
let manoObraAgregada = [];
let margenCliente = 0;

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Iniciando módulo de cotización...');
    inicializarBusquedas();
    verificarDatosIniciales();
});

async function verificarDatosIniciales() {
    try {
        const { data: clientes } = await supabase.from('clientes').select('count');
        const { data: servicios } = await supabase.from('v_servicios_completos').select('*');

        console.log('📊 Servicios disponibles:', servicios);
        
        if (!clientes?.[0]?.count) {
            mostrarNotificacion('⚠️ No hay clientes registrados. Crea uno primero.', 'warning');
        }
    } catch (error) {
        console.error('Error verificando datos:', error);
    }
}

// ============================================
// INICIALIZAR BÚSQUEDAS
// ============================================
function inicializarBusquedas() {
    const inputCliente = document.getElementById('buscarCliente');
    if (inputCliente) {
        inputCliente.addEventListener('input', debounce(buscarClientes, 300));
    }

    const inputVehiculo = document.getElementById('buscarVehiculo');
    if (inputVehiculo) {
        inputVehiculo.addEventListener('input', debounce(buscarVehiculos, 300));
    }

    const inputServicio = document.getElementById('buscarServicio');
    if (inputServicio) {
        inputServicio.addEventListener('input', debounce(buscarServicios, 300));
    }

    const inputRepuesto = document.getElementById('buscarRepuesto');
    if (inputRepuesto) {
        inputRepuesto.addEventListener('input', debounce(buscarRepuestos, 300));
    }

    const inputManoObra = document.getElementById('buscarManoObra');
    if (inputManoObra) {
        inputManoObra.addEventListener('input', debounce(buscarManoObraDirecta, 300));
    }

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-box')) {
            document.querySelectorAll('.search-results').forEach(el => {
                el.classList.remove('active');
            });
        }
    });
}

// ============================================
// BÚSQUEDA DE CLIENTES
// ============================================
async function buscarClientes() {
    const input = document.getElementById('buscarCliente');
    const resultados = document.getElementById('resultadosCliente');
    const termino = input.value.trim();

    if (termino.length < 2) {
        resultados.classList.remove('active');
        return;
    }

    try {
        const { data, error } = await supabase
            .from('clientes')
            .select('*')
            .or(`razon_social.ilike.%${termino}%,nit.ilike.%${termino}%,cuenta.ilike.%${termino}%`)
            .eq('activo', true)
            .limit(10);

        if (error) throw error;

        if (data.length === 0) {
            resultados.innerHTML = `
                <div class="search-item" style="color: var(--gray-700);">
                    No se encontraron clientes
                </div>
            `;
        } else {
            resultados.innerHTML = data.map(cliente => `
                <div class="search-item" onclick="seleccionarCliente(${cliente.id})">
                    <strong>${cliente.razon_social}</strong>
                    <span class="badge badge-orange">Margen: ${(cliente.margen * 100).toFixed(1)}%</span><br>
                    <small style="color: var(--gray-700);">
                        NIT: ${cliente.nit || 'N/A'} | Cuenta: ${cliente.cuenta}
                    </small>
                </div>
            `).join('');
        }

        resultados.classList.add('active');
    } catch (error) {
        console.error('Error buscando clientes:', error);
        mostrarNotificacion('Error al buscar clientes', 'error');
    }
}

// ============================================
// SELECCIONAR CLIENTE
// ============================================
window.seleccionarCliente = async function(clienteId) {
    try {
        const { data, error } = await supabase
            .from('clientes')
            .select('*')
            .eq('id', clienteId)
            .single();

        if (error) throw error;

        clienteActual = data;
        margenCliente = data.margen || 0;

        const contenedor = document.getElementById('clienteSeleccionado');
        contenedor.innerHTML = `
            <strong style="color: var(--primary);">${data.razon_social}</strong><br>
            <small style="color: var(--gray-700);">
                NIT: ${data.nit || 'N/A'} | Ciudad: ${data.ciudad || 'N/A'} | 
                <span style="color: var(--warning); font-weight: 600;">Margen Cliente: ${(margenCliente * 100).toFixed(1)}%</span>
            </small>
        `;

        document.getElementById('buscarCliente').value = '';
        document.getElementById('resultadosCliente').classList.remove('active');

        cargarVehiculosCliente(clienteId);
        recalcularTotales();

        mostrarNotificacion('✅ Cliente seleccionado - Precios ajustados con margen', 'success');
    } catch (error) {
        console.error('Error seleccionando cliente:', error);
        mostrarNotificacion('Error al seleccionar cliente', 'error');
    }
}

// ============================================
// CARGAR VEHÍCULOS DEL CLIENTE
// ============================================
async function cargarVehiculosCliente(clienteId) {
    try {
        const { data, error } = await supabase
            .from('vehiculos')
            .select('*')
            .eq('cliente_id', clienteId)
            .eq('activo', true);

        if (error) throw error;

        if (data.length > 0) {
            mostrarNotificacion(`ℹ️ Este cliente tiene ${data.length} vehículo(s) registrado(s)`, 'info');
        }
    } catch (error) {
        console.error('Error cargando vehículos:', error);
    }
}

// ============================================
// BÚSQUEDA DE VEHÍCULOS
// ============================================
async function buscarVehiculos() {
    const input = document.getElementById('buscarVehiculo');
    const resultados = document.getElementById('resultadosVehiculo');
    const termino = input.value.trim().toUpperCase();

    if (termino.length < 2) {
        resultados.classList.remove('active');
        return;
    }

    try {
        let query = supabase
            .from('vehiculos')
            .select('*, clientes(razon_social)')
            .ilike('placa', `%${termino}%`)
            .eq('activo', true)
            .limit(10);

        if (clienteActual) {
            query = query.eq('cliente_id', clienteActual.id);
        }

        const { data, error } = await query;

        if (error) throw error;

        if (data.length === 0) {
            resultados.innerHTML = `
                <div class="search-item" style="color: var(--gray-700);">
                    No se encontraron vehículos
                </div>
            `;
        } else {
            resultados.innerHTML = data.map(vehiculo => `
                <div class="search-item" onclick="seleccionarVehiculo(${vehiculo.id})">
                    <strong>${vehiculo.placa}</strong> - ${vehiculo.marca || ''} ${vehiculo.linea || ''}<br>
                    <small style="color: var(--gray-700);">
                        Modelo: ${vehiculo.modelo || 'N/A'} | KM: ${vehiculo.kilometraje || '0'}
                    </small>
                </div>
            `).join('');
        }

        resultados.classList.add('active');
    } catch (error) {
        console.error('Error buscando vehículos:', error);
        mostrarNotificacion('Error al buscar vehículos', 'error');
    }
}

// ============================================
// SELECCIONAR VEHÍCULO
// ============================================
window.seleccionarVehiculo = async function(vehiculoId) {
    try {
        const { data, error } = await supabase
            .from('vehiculos')
            .select('*, clientes(razon_social)')
            .eq('id', vehiculoId)
            .single();

        if (error) throw error;

        vehiculoActual = data;

        const contenedor = document.getElementById('vehiculoSeleccionado');
        contenedor.innerHTML = `
            <strong style="color: var(--primary);">${data.placa}</strong> - 
            ${data.marca || ''} ${data.linea || ''}<br>
            <small style="color: var(--gray-700);">
                Modelo: ${data.modelo || 'N/A'} | KM: ${data.kilometraje || '0'}
            </small>
        `;

        document.getElementById('buscarVehiculo').value = '';
        document.getElementById('resultadosVehiculo').classList.remove('active');

        mostrarNotificacion('✅ Vehículo seleccionado', 'success');
    } catch (error) {
        console.error('Error seleccionando vehículo:', error);
        mostrarNotificacion('Error al seleccionar vehículo', 'error');
    }
}

// ============================================
// BÚSQUEDA DE SERVICIOS (CON COMPONENTES)
// ============================================
async function buscarServicios() {
    const input = document.getElementById('buscarServicio');
    const resultados = document.getElementById('resultadosServicio');
    const termino = input.value.trim();

    if (termino.length < 2) {
        resultados.classList.remove('active');
        return;
    }

    try {
        const { data, error } = await supabase
            .from('v_servicios_completos')
            .select('*')
            .or(`nombre.ilike.%${termino}%,codigo.ilike.%${termino}%`)
            .eq('activo', true)
            .limit(10);

        if (error) throw error;

        if (data.length === 0) {
            resultados.innerHTML = `
                <div class="search-item" style="color: var(--gray-700);">
                    No se encontraron servicios
                </div>
            `;
        } else {
            resultados.innerHTML = data.map(servicio => `
                <div class="search-item" onclick="agregarServicio(${servicio.id})">
                    <strong>${servicio.nombre}</strong>
                    <span class="badge badge-blue">${servicio.codigo}</span><br>
                    <small style="color: var(--gray-700);">
                        ${servicio.total_repuestos} repuesto(s) | 
                        ${servicio.total_mano_obra} MO | 
                        ${servicio.categoria || 'General'}
                    </small>
                </div>
            `).join('');
        }

        resultados.classList.add('active');
    } catch (error) {
        console.error('Error buscando servicios:', error);
        mostrarNotificacion('Error al buscar servicios', 'error');
    }
}

// ============================================
// AGREGAR SERVICIO (CON SUS COMPONENTES)
// ============================================
window.agregarServicio = async function(servicioId) {
    try {
        if (serviciosAgregados.find(s => s.id === servicioId)) {
            mostrarNotificacion('⚠️ Este servicio ya está agregado', 'warning');
            return;
        }

        // Obtener servicio
        const { data: servicio, error: errorServ } = await supabase
            .from('servicios')
            .select('*')
            .eq('id', servicioId)
            .single();

        if (errorServ) throw errorServ;

        // Obtener repuestos anclados
        const { data: repuestosAnclados, error: errorRep } = await supabase
            .from('servicios_repuestos')
            .select('*, repuestos(*)')
            .eq('servicio_id', servicioId);

        if (errorRep) throw errorRep;

        // Obtener mano de obra anclada
        const { data: manoObraAnclada, error: errorMO } = await supabase
            .from('servicios_mano_obra')
            .select('*, mano_obra(*)')
            .eq('servicio_id', servicioId);

        if (errorMO) throw errorMO;

        console.log('📦 Servicio completo:', {
            servicio,
            repuestos: repuestosAnclados,
            manoObra: manoObraAnclada
        });

        // Agregar servicio
        serviciosAgregados.push({
            ...servicio,
            cantidad: 1,
            repuestos_anclados: repuestosAnclados,
            mano_obra_anclada: manoObraAnclada
        });

        // Agregar automáticamente los repuestos anclados
        if (repuestosAnclados && repuestosAnclados.length > 0) {
            repuestosAnclados.forEach(ra => {
                const repuesto = ra.repuestos;
                
                // Calcular precio con margen del repuesto + margen del cliente
                const precioBase = calcularPrecioConMargen(
                    repuesto.costo_unitario, 
                    repuesto.margen_ganancia
                );
                const precioFinal = calcularPrecioConMargen(
                    precioBase,
                    margenCliente
                );

                const existente = repuestosAgregados.find(r => r.id === repuesto.id);
                if (existente) {
                    existente.cantidad += ra.cantidad_requerida;
                } else {
                    repuestosAgregados.push({
                        ...repuesto,
                        cantidad: ra.cantidad_requerida,
                        precio_unitario: precioFinal,
                        descuento: 0,
                        desde_servicio: servicio.nombre,
                        es_obligatorio: ra.es_obligatorio
                    });
                }
            });
        }

        // Agregar automáticamente la mano de obra anclada
        if (manoObraAnclada && manoObraAnclada.length > 0) {
            manoObraAnclada.forEach(ma => {
                const mo = ma.mano_obra;
                
                const precioBase = mo.tipo_cobro === 'Por hora' 
                    ? mo.valor_hora 
                    : mo.valor_unitario;
                
                // Aplicar margen del cliente
                const precioFinal = calcularPrecioConMargen(precioBase, margenCliente);

                const existente = manoObraAgregada.find(m => m.id === mo.id);
                if (existente) {
                    existente.cantidad += ma.horas_requeridas;
                } else {
                    manoObraAgregada.push({
                        ...mo,
                        cantidad: ma.horas_requeridas,
                        precio_unitario: precioFinal,
                        desde_servicio: servicio.nombre,
                        es_obligatorio: ma.es_obligatorio
                    });
                }
            });
        }

        actualizarListaServicios();
        actualizarListaRepuestos();
        actualizarListaManoObra();
        recalcularTotales();

        document.getElementById('buscarServicio').value = '';
        document.getElementById('resultadosServicio').classList.remove('active');

        mostrarNotificacion(
            `✅ Servicio "${servicio.nombre}" agregado con ${repuestosAnclados?.length || 0} repuesto(s) y ${manoObraAnclada?.length || 0} MO`, 
            'success'
        );
    } catch (error) {
        console.error('Error agregando servicio:', error);
        mostrarNotificacion('Error al agregar servicio: ' + error.message, 'error');
    }
}

// ============================================
// FUNCIÓN: CALCULAR PRECIO CON MARGEN
// ============================================
function calcularPrecioConMargen(costo, margen) {
    if (margen >= 1) margen = 0.5; // Máximo 50%
    if (margen <= 0) return costo;
    return Math.round(costo / (1 - margen));
}

// ============================================
// ACTUALIZAR LISTA DE SERVICIOS
// ============================================
function actualizarListaServicios() {
    const contenedor = document.getElementById('serviciosAgregados');
    const lista = document.getElementById('listaServicios');

    if (serviciosAgregados.length === 0) {
        lista.style.display = 'none';
        return;
    }

    lista.style.display = 'block';
    contenedor.innerHTML = serviciosAgregados.map((servicio, index) => `
        <div class="item-card">
            <div class="item-info">
                <strong>${servicio.nombre}</strong>
                <span class="badge badge-blue">${servicio.codigo}</span><br>
                <small style="color: var(--gray-700);">
                    ${servicio.descripcion || ''}<br>
                    📦 ${servicio.repuestos_anclados?.length || 0} repuestos | 
                    👷 ${servicio.mano_obra_anclada?.length || 0} mano de obra
                </small>
            </div>
            <div class="item-actions">
                <label style="font-size: 0.875rem; margin-right: 0.5rem;">Cant:</label>
                <input type="number" value="${servicio.cantidad}" min="1" 
                       onchange="actualizarCantidadServicio(${index}, this.value)"
                       style="width: 60px;">
                <button onclick="eliminarServicio(${index})" class="btn btn-danger" 
                        style="padding: 0.5rem 1rem; margin-left: 0.5rem;">
                    🗑️
                </button>
            </div>
        </div>
    `).join('');
}

window.actualizarCantidadServicio = function(index, cantidad) {
    cantidad = parseInt(cantidad) || 1;
    if (cantidad < 1) cantidad = 1;
    
    serviciosAgregados[index].cantidad = cantidad;
    actualizarListaServicios();
    recalcularTotales();
}

window.eliminarServicio = function(index) {
    const servicio = serviciosAgregados[index];
    
    // Eliminar repuestos asociados
    repuestosAgregados = repuestosAgregados.filter(r => r.desde_servicio !== servicio.nombre);
    
    // Eliminar mano de obra asociada
    manoObraAgregada = manoObraAgregada.filter(m => m.desde_servicio !== servicio.nombre);
    
    serviciosAgregados.splice(index, 1);
    
    actualizarListaServicios();
    actualizarListaRepuestos();
    actualizarListaManoObra();
    recalcularTotales();
    
    mostrarNotificacion('Servicio y sus componentes eliminados', 'info');
}

// ============================================
// BÚSQUEDA DIRECTA DE REPUESTOS
// ============================================
async function buscarRepuestos() {
    const input = document.getElementById('buscarRepuesto');
    const resultados = document.getElementById('resultadosRepuesto');
    const termino = input.value.trim();

    if (termino.length < 2) {
        resultados.classList.remove('active');
        return;
    }

    try {
        const { data, error } = await supabase
            .from('repuestos')
            .select('*')
            .or(`nombre.ilike.%${termino}%,codigo.ilike.%${termino}%,referencia.ilike.%${termino}%`)
            .eq('activo', true)
            .limit(10);

        if (error) throw error;

        if (data.length === 0) {
            resultados.innerHTML = `
                <div class="search-item" style="color: var(--gray-700);">
                    No se encontraron repuestos
                </div>
            `;
        } else {
            resultados.innerHTML = data.map(repuesto => {
                // Precio base con margen del repuesto
                const precioBase = calcularPrecioConMargen(
                    repuesto.costo_unitario, 
                    repuesto.margen_ganancia
                );
                // Precio final con margen del cliente
                const precioFinal = calcularPrecioConMargen(precioBase, margenCliente);
                
                return `
                    <div class="search-item" onclick="agregarRepuesto(${repuesto.id})">
                        <strong>${repuesto.nombre}</strong>
                        <span class="badge badge-green">${formatearMoneda(precioFinal)}</span><br>
                        <small style="color: var(--gray-700);">
                            Código: ${repuesto.codigo} | Stock: ${repuesto.stock_actual || 0} | 
                            Margen: ${(repuesto.margen_ganancia * 100).toFixed(0)}%
                        </small>
                    </div>
                `;
            }).join('');
        }

        resultados.classList.add('active');
    } catch (error) {
        console.error('Error buscando repuestos:', error);
        mostrarNotificacion('Error al buscar repuestos', 'error');
    }
}

// ============================================
// AGREGAR REPUESTO MANUAL
// ============================================
window.agregarRepuesto = async function(repuestoId) {
    try {
        const { data, error } = await supabase
            .from('repuestos')
            .select('*')
            .eq('id', repuestoId)
            .single();

        if (error) throw error;

        // Calcular precios
        const precioBase = calcularPrecioConMargen(data.costo_unitario, data.margen_ganancia);
        const precioFinal = calcularPrecioConMargen(precioBase, margenCliente);

        const existente = repuestosAgregados.find(r => r.id === repuestoId && !r.desde_servicio);
        if (existente) {
            existente.cantidad += 1;
        } else {
            repuestosAgregados.push({
                ...data,
                cantidad: 1,
                precio_unitario: precioFinal,
                descuento: 0,
                desde_servicio: null,
                es_obligatorio: false
            });
        }

        actualizarListaRepuestos();
        recalcularTotales();

        document.getElementById('buscarRepuesto').value = '';
        document.getElementById('resultadosRepuesto').classList.remove('active');

        mostrarNotificacion('✅ Repuesto agregado', 'success');
    } catch (error) {
        console.error('Error agregando repuesto:', error);
        mostrarNotificacion('Error al agregar repuesto', 'error');
    }
}

// ============================================
// ACTUALIZAR LISTA DE REPUESTOS
// ============================================
function actualizarListaRepuestos() {
    const contenedor = document.getElementById('repuestosAgregados');
    const lista = document.getElementById('listaRepuestos');

    if (repuestosAgregados.length === 0) {
        lista.style.display = 'none';
        return;
    }

    lista.style.display = 'block';
    contenedor.innerHTML = repuestosAgregados.map((repuesto, index) => {
        const subtotal = repuesto.precio_unitario * repuesto.cantidad;
        const descuento = subtotal * (repuesto.descuento / 100);
        const iva = repuesto.aplica_iva ? calcularIVA(subtotal - descuento) : 0;
        const total = subtotal - descuento + iva;

        const origen = repuesto.desde_servicio 
            ? `🔗 Desde: ${repuesto.desde_servicio}` 
            : '✋ Agregado manualmente';
        
        const puedeEliminar = !repuesto.es_obligatorio;

        return `
            <div class="item-card" style="${repuesto.desde_servicio ? 'background: #f0f9ff;' : ''}">
                <div class="item-info">
                    <strong>${repuesto.nombre}</strong>
                    <span class="badge badge-green">${formatearMoneda(repuesto.precio_unitario)}</span>
                    ${repuesto.es_obligatorio ? '<span class="badge" style="background: #fef3c7; color: #92400e;">🔒 Obligatorio</span>' : ''}<br>
                    <small style="color: var(--gray-700);">
                        ${origen} | ${repuesto.aplica_iva ? 'Con IVA' : 'Sin IVA'}
                    </small><br>
                    <strong style="color: var(--primary);">Total: ${formatearMoneda(total)}</strong>
                </div>
                <div class="item-actions">
                    <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                        <div>
                            <label style="font-size: 0.75rem;">Cant:</label>
                            <input type="number" value="${repuesto.cantidad}" min="1" 
                                   onchange="actualizarCantidadRepuesto(${index}, this.value)"
                                   style="width: 60px;">
                        </div>
                        ${!repuesto.desde_servicio ? `
                        <div>
                            <label style="font-size: 0.75rem;">Desc %:</label>
                            <input type="number" value="${repuesto.descuento}" min="0" max="100" 
                                   onchange="actualizarDescuentoRepuesto(${index}, this.value)"
                                   style="width: 60px;">
                        </div>
                        ` : ''}
                    </div>
                    ${puedeEliminar ? `
                    <button onclick="eliminarRepuesto(${index})" class="btn btn-danger" 
                            style="padding: 0.5rem 1rem; margin-left: 0.5rem;">
                        🗑️
                    </button>
                    ` : `
                    <button disabled class="btn btn-secondary" 
                            style="padding: 0.5rem 1rem; margin-left: 0.5rem;" 
                            title="No se puede eliminar - Obligatorio del servicio">
                        🔒
                    </button>
                    `}
                </div>
            </div>
        `;
    }).join('');
}

window.actualizarCantidadRepuesto = function(index, cantidad) {
    cantidad = parseInt(cantidad) || 1;
    if (cantidad < 1) cantidad = 1;
    
    repuestosAgregados[index].cantidad = cantidad;
    actualizarListaRepuestos();
    recalcularTotales();
}

window.actualizarDescuentoRepuesto = function(index, descuento) {
    descuento = parseFloat(descuento) || 0;
    if (descuento < 0) descuento = 0;
    if (descuento > 100) descuento = 100;
    
    repuestosAgregados[index].descuento = descuento;
    actualizarListaRepuestos();
    recalcularTotales();
}

window.eliminarRepuesto = function(index) {
    const repuesto = repuestosAgregados[index];
    
    if (repuesto.es_obligatorio) {
        mostrarNotificacion('⚠️ No puedes eliminar un repuesto obligatorio del servicio', 'warning');
        return;
    }
    
    repuestosAgregados.splice(index, 1);
    actualizarListaRepuestos();
    recalcularTotales();
    mostrarNotificacion('Repuesto eliminado', 'info');
}

// ============================================
// BÚSQUEDA DIRECTA DE MANO DE OBRA
// ============================================
async function buscarManoObraDirecta() {
    const input = document.getElementById('buscarManoObra');
    const resultados = document.getElementById('resultadosManoObra');
    const termino = input.value.trim();

    if (termino.length < 2) {
        resultados.classList.remove('active');
        return;
    }

    try {
        const { data, error } = await supabase
            .from('mano_obra')
            .select('*')
            .or(`nombre.ilike.%${termino}%,codigo.ilike.%${termino}%`)
            .eq('activo', true)
            .limit(10);

        if (error) throw error;

        if (data.length === 0) {
            resultados.innerHTML = `
                <div class="search-item" style="color: var(--gray-700);">
                    No se encontró mano de obra
                </div>
            `;
        } else {
            resultados.innerHTML = data.map(mo => {
                const precioBase = mo.tipo_cobro === 'Por hora' ? mo.valor_hora : mo.valor_unitario;
                const precioFinal = calcularPrecioConMargen(precioBase, margenCliente);
                
                return `
                    <div class="search-item" onclick="agregarManoObraDirecta(${mo.id})">
                        <strong>${mo.nombre}</strong>
                        <span class="badge badge-orange">${formatearMoneda(precioFinal)}</span><br>
                        <small style="color: var(--gray-700);">
                            ${mo.tipo_cobro} | ${mo.categoria || 'General'}
                        </small>
                    </div>
                `;
            }).join('');
        }

        resultados.classList.add('active');
    } catch (error) {
        console.error('Error buscando mano de obra:', error);
        mostrarNotificacion('Error al buscar mano de obra', 'error');
    }
}

window.agregarManoObraDirecta = async function(moId) {
    try {
        const { data, error } = await supabase
            .from('mano_obra')
            .select('*')
            .eq('id', moId)
            .single();

        if (error) throw error;

        const precioBase = data.tipo_cobro === 'Por hora' ? data.valor_hora : data.valor_unitario;
        const precioFinal = calcularPrecioConMargen(precioBase, margenCliente);

        const existente = manoObraAgregada.find(m => m.id === moId && !m.desde_servicio);
        if (existente) {
            existente.cantidad += (data.tipo_cobro === 'Por hora' ? 1 : 1);
        } else {
            manoObraAgregada.push({
                ...data,
                cantidad: data.tipo_cobro === 'Por hora' ? data.horas_estimadas : 1,
                precio_unitario: precioFinal,
                desde_servicio: null,
                es_obligatorio: false
            });
        }

        actualizarListaManoObra();
        recalcularTotales();

        document.getElementById('buscarManoObra').value = '';
        document.getElementById('resultadosManoObra').classList.remove('active');

        mostrarNotificacion('✅ Mano de obra agregada', 'success');
    } catch (error) {
        console.error('Error agregando mano de obra:', error);
        mostrarNotificacion('Error al agregar mano de obra', 'error');
    }
}

// ============================================
// ACTUALIZAR LISTA DE MANO DE OBRA
// ============================================
function actualizarListaManoObra() {
    const contenedor = document.getElementById('manoObraAgregada');
    const lista = document.getElementById('listaManoObra');

    if (manoObraAgregada.length === 0) {
        lista.style.display = 'none';
        return;
    }

    lista.style.display = 'block';
    contenedor.innerHTML = manoObraAgregada.map((mo, index) => {
        const subtotal = mo.precio_unitario * mo.cantidad;
        const iva = mo.aplica_iva ? calcularIVA(subtotal) : 0;
        const total = subtotal + iva;
        const unidad = mo.tipo_cobro === 'Por hora' ? 'horas' : 'unidades';
        
        const origen = mo.desde_servicio 
            ? `🔗 Desde: ${mo.desde_servicio}` 
            : '✋ Agregado manualmente';
        
        const puedeEliminar = !mo.es_obligatorio;

        return `
            <div class="item-card" style="${mo.desde_servicio ? 'background: #fef3c7;' : ''}">
                <div class="item-info">
                    <strong>${mo.nombre}</strong>
                    <span class="badge badge-orange">${formatearMoneda(mo.precio_unitario)}</span>
                    ${mo.es_obligatorio ? '<span class="badge" style="background: #fee2e2; color: #991b1b;">🔒 Obligatorio</span>' : ''}<br>
                    <small style="color: var(--gray-700);">
                        ${origen} | ${mo.tipo_cobro} | ${mo.aplica_iva ? 'Con IVA' : 'Sin IVA'}
                    </small><br>
                    <strong style="color: var(--primary);">Total: ${formatearMoneda(total)}</strong>
                </div>
                <div class="item-actions">
                    <label style="font-size: 0.875rem; margin-right: 0.5rem;">${unidad}:</label>
                    <input type="number" value="${mo.cantidad}" min="0.5" step="0.5"
                           onchange="actualizarCantidadManoObra(${index}, this.value)"
                           style="width: 60px;">
                    ${puedeEliminar ? `
                    <button onclick="eliminarManoObra(${index})" class="btn btn-danger" 
                            style="padding: 0.5rem 1rem; margin-left: 0.5rem;">
                        🗑️
                    </button>
                    ` : `
                    <button disabled class="btn btn-secondary" 
                            style="padding: 0.5rem 1rem; margin-left: 0.5rem;"
                            title="No se puede eliminar - Obligatorio del servicio">
                        🔒
                    </button>
                    `}
                </div>
            </div>
        `;
    }).join('');
}

window.actualizarCantidadManoObra = function(index, cantidad) {
    cantidad = parseFloat(cantidad) || 0.5;
    if (cantidad < 0.5) cantidad = 0.5;
    
    manoObraAgregada[index].cantidad = cantidad;
    actualizarListaManoObra();
    recalcularTotales();
}

window.eliminarManoObra = function(index) {
    const mo = manoObraAgregada[index];
    
    if (mo.es_obligatorio) {
        mostrarNotificacion('⚠️ No puedes eliminar mano de obra obligatoria del servicio', 'warning');
        return;
    }
    
    manoObraAgregada.splice(index, 1);
    actualizarListaManoObra();
    recalcularTotales();
    mostrarNotificacion('Mano de obra eliminada', 'info');
}

// ============================================
// RECALCULAR TOTALES
// ============================================
function recalcularTotales() {
    let subtotal = 0;
    let ivaTotal = 0;

    repuestosAgregados.forEach(repuesto => {
        const subtotalItem = repuesto.precio_unitario * repuesto.cantidad;
        const descuento = subtotalItem * (repuesto.descuento / 100);
        const subtotalConDescuento = subtotalItem - descuento;
        
        subtotal += subtotalConDescuento;
        
        if (repuesto.aplica_iva) {
            ivaTotal += calcularIVA(subtotalConDescuento);
        }
    });

    manoObraAgregada.forEach(mo => {
        const subtotalItem = mo.precio_unitario * mo.cantidad;
        subtotal += subtotalItem;
        
        if (mo.aplica_iva) {
            ivaTotal += calcularIVA(subtotalItem);
        }
    });

    const total = subtotal + ivaTotal;

    document.getElementById('subtotal').textContent = formatearMoneda(subtotal);
    document.getElementById('iva').textContent = formatearMoneda(ivaTotal);
    document.getElementById('total').textContent = formatearMoneda(total);
    document.getElementById('totalLetras').textContent = numeroALetras(total);

    const hayItems = repuestosAgregados.length > 0 || manoObraAgregada.length > 0 || serviciosAgregados.length > 0;
    document.getElementById('btnGuardar').disabled = !hayItems || !clienteActual;
}

// ============================================
// GUARDAR COTIZACIÓN
// ============================================
window.guardarCotizacion = async function() {
    if (!clienteActual) {
        mostrarNotificacion('⚠️ Debes seleccionar un cliente', 'warning');
        return;
    }

    if (!vehiculoActual) {
        mostrarNotificacion('⚠️ Debes seleccionar un vehículo', 'warning');
        return;
    }

    const hayItems = serviciosAgregados.length > 0 || repuestosAgregados.length > 0 || manoObraAgregada.length > 0;

    if (!hayItems) {
        mostrarNotificacion('⚠️ Debes agregar al menos un item', 'warning');
        return;
    }

    const btnGuardar = document.getElementById('btnGuardar');
    btnGuardar.disabled = true;
    btnGuardar.innerHTML = '<span class="loading"></span> Guardando...';

    try {
        let subtotal = 0;
        let ivaTotal = 0;

        repuestosAgregados.forEach(r => {
            const sub = r.precio_unitario * r.cantidad;
            const desc = sub * (r.descuento / 100);
            subtotal += (sub - desc);
            if (r.aplica_iva) ivaTotal += calcularIVA(sub - desc);
        });

        manoObraAgregada.forEach(m => {
            const sub = m.precio_unitario * m.cantidad;
            subtotal += sub;
            if (m.aplica_iva) ivaTotal += calcularIVA(sub);
        });

        const total = subtotal + ivaTotal;

        const { data: configData } = await supabase
            .from('configuracion')
            .select('valor')
            .eq('clave', 'numero_cotizacion')
            .single();

        const numeroActual = parseInt(configData?.valor || '1');
        const folio = 'COT-' + numeroActual.toString().padStart(7, '0');

        const { data: cotizacion, error: errorCot } = await supabase
            .from('cotizaciones')
            .insert({
                folio: folio,
                cliente_id: clienteActual.id,
                vehiculo_id: vehiculoActual.id,
                subtotal: subtotal,
                iva_total: ivaTotal,
                total: total,
                estado: 'pendiente',
                usuario_creador_id: 1
            })
            .select()
            .single();

        if (errorCot) throw errorCot;

        if (serviciosAgregados.length > 0) {
            const serviciosData = serviciosAgregados.map((s, idx) => ({
                cotizacion_id: cotizacion.id,
                servicio_id: s.id,
                cantidad: s.cantidad,
                descripcion: s.nombre,
                orden: idx
            }));

            await supabase.from('cotizacion_servicios').insert(serviciosData);
        }

        if (repuestosAgregados.length > 0) {
            const repuestosData = repuestosAgregados.map((r, idx) => {
                const sub = r.precio_unitario * r.cantidad;
                const desc = sub * (r.descuento / 100);
                const iva = r.aplica_iva ? calcularIVA(sub - desc) : 0;
                
                return {
                    cotizacion_id: cotizacion.id,
                    repuesto_id: r.id,
                    cantidad: r.cantidad,
                    precio_unitario: r.precio_unitario,
                    descuento: r.descuento,
                    subtotal: sub - desc,
                    iva: iva,
                    total: (sub - desc) + iva,
                    orden: idx
                };
            });

            await supabase.from('cotizacion_repuestos').insert(repuestosData);
        }

        if (manoObraAgregada.length > 0) {
            const manoObraData = manoObraAgregada.map((m, idx) => {
                const sub = m.precio_unitario * m.cantidad;
                const iva = m.aplica_iva ? calcularIVA(sub) : 0;
                
                return {
                    cotizacion_id: cotizacion.id,
                    mano_obra_id: m.id,
                    cantidad: m.cantidad,
                    precio_unitario: m.precio_unitario,
                    subtotal: sub,
                    iva: iva,
                    total: sub + iva,
                    orden: idx
                };
            });

            await supabase.from('cotizacion_mano_obra').insert(manoObraData);
        }

        await supabase
            .from('configuracion')
            .update({ valor: (numeroActual + 1).toString() })
            .eq('clave', 'numero_cotizacion');

        mostrarNotificacion(`✅ Cotización ${folio} guardada exitosamente`, 'success');

        document.getElementById('btnPDF').disabled = false;
        document.getElementById('btnPDF').setAttribute('data-cotizacion-id', cotizacion.id);

        setTimeout(() => {
            if (confirm('¿Deseas ir al dashboard?')) {
                window.location.href = 'index.html';
            }
        }, 2000);

    } catch (error) {
        console.error('Error guardando cotización:', error);
        mostrarNotificacion('❌ Error al guardar: ' + error.message, 'error');
    } finally {
        btnGuardar.disabled = false;
        btnGuardar.innerHTML = '💾 Guardar Cotización';
    }
}

window.generarPDF = function() {
    mostrarNotificacion('ℹ️ Generación de PDF - Por implementar', 'info');
}

window.mostrarModalNuevoCliente = function() {
    mostrarNotificacion('ℹ️ Modal nuevo cliente - Por implementar', 'info');
}

window.mostrarModalNuevoVehiculo = function() {
    mostrarNotificacion('ℹ️ Modal nuevo vehículo - Por implementar', 'info');
}
import { generarPDFCotizacion } from './pdf-generator.js';
import { prepararEmailCotizacion } from './email-service.js';

// Actualizar la función generarPDF
window.generarPDF = async function() {
    const cotizacionId = document.getElementById('btnPDF').getAttribute('data-cotizacion-id');
    
    if (!cotizacionId) {
        mostrarNotificacion('⚠️ Primero debes guardar la cotización', 'warning');
        return;
    }
    
    const btnPDF = document.getElementById('btnPDF');
    btnPDF.disabled = true;
    btnPDF.innerHTML = '<span class="loading"></span> Generando PDF...';
    
    try {
        // Generar PDF
        const pdfData = await generarPDFCotizacion(cotizacionId);
        
        mostrarNotificacion('✅ PDF generado exitosamente', 'success');
        
        // Preguntar si desea enviar por email
        if (confirm('¿Deseas enviar el PDF por correo electrónico al cliente?')) {
            btnPDF.innerHTML = '<span class="loading"></span> Enviando email...';
            
            await prepararEmailCotizacion(
                cotizacionId,
                pdfData.url,
                pdfData.nombreArchivo
            );
            
            mostrarNotificacion('📧 Email enviado correctamente', 'success');
        }
        
        // Descargar PDF
        const link = document.createElement('a');
        link.href = URL.createObjectURL(pdfData.blob);
        link.download = pdfData.nombreArchivo;
        link.click();
        
    } catch (error) {
        console.error('Error:', error);
        mostrarNotificacion('❌ Error al generar PDF: ' + error.message, 'error');
    } finally {
        btnPDF.disabled = false;
        btnPDF.innerHTML = '📄 Generar PDF';
    }
}