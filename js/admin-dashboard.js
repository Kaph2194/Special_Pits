// js/admin-dashboard.js
import { supabase } from './supabase-config.js';
import { DashboardBase } from './dashboards.js';
import { auth } from './auth-system.js';
import { mostrarNotificacion, formatearFecha, formatearFechaHora, formatearMoneda } from './utils.js';

const dash = new DashboardBase(['superadmin']);

let todosLosUsuarios = [];
let todosLosClientes = [];
let todosLosRepuestosStockBajo = [];
let permisosDisponibles = [];
let permisosDelRol = [];
let rolSeleccionado = null;


(async () => {
    if (!await dash.inicializar()) return;
    await cargarDashboard();
    await cargarUsuarios();
    await cargarClientes();
})();

// ============================================
// DASHBOARD PRINCIPAL
// ============================================

async function cargarDashboard() {
    try {
        // 1. MÉTRICAS PRINCIPALES
        const [
            { count: usuarios },
            { count: clientes },
            { count: vehiculos },
            { count: ots },
            { count: facturas },
            { count: repuestos },
            { count: proveedores }
        ] = await Promise.all([
            supabase.from('usuarios').select('*', {count:'exact',head:true}).eq('activo', true),
            supabase.from('clientes').select('*', {count:'exact',head:true}).eq('activo', true),
            supabase.from('vehiculos').select('*', {count:'exact',head:true}).eq('activo', true),
            supabase.from('ordenes_trabajo').select('*', {count:'exact',head:true}),
            supabase.from('facturas').select('*', {count:'exact',head:true}),
            supabase.from('repuestos').select('*', {count:'exact',head:true}).eq('activo', true),
            supabase.from('proveedores').select('*', {count:'exact',head:true}).eq('activo', true)
        ]);

        document.getElementById('totalUsuarios').textContent = usuarios ?? 0;
        document.getElementById('totalClientes').textContent = clientes ?? 0;
        document.getElementById('totalVehiculos').textContent = vehiculos ?? 0;
        document.getElementById('totalOTs').textContent = ots ?? 0;
        
        const elFacturas = document.getElementById('totalFacturas');
        if (elFacturas) elFacturas.textContent = facturas ?? 0;
        
        const elRepuestos = document.getElementById('totalRepuestos');
        if (elRepuestos) elRepuestos.textContent = repuestos ?? 0;
        
        const elProveedores = document.getElementById('totalProveedores');
        if (elProveedores) elProveedores.textContent = proveedores ?? 0;

        // 2. STOCK BAJO - CORRECCIÓN
        const { data: repuestosStockBajo } = await supabase
            .from('repuestos')
            .select('stock_actual, stock_minimo')
            .eq('activo', true);

        const stockBajo = repuestosStockBajo?.filter(r => 
            (r.stock_actual || 0) <= (r.stock_minimo || 0)
        ).length || 0;

        const elStockBajo = document.getElementById('stockBajo');
        if (elStockBajo) elStockBajo.textContent = stockBajo;

        // 3. ESTADO DE OTs
        const [
            { count: otsPendientes },
            { count: otsProceso },
            { count: solicitudesPendientes }
        ] = await Promise.all([
            supabase.from('ordenes_trabajo').select('*', {count:'exact',head:true}).eq('estado','pendiente'),
            supabase.from('ordenes_trabajo').select('*', {count:'exact',head:true}).eq('estado','en_proceso'),
            supabase.from('solicitudes_modificacion').select('*', {count:'exact',head:true}).eq('estado','pendiente')
        ]);

        const elOtsPend = document.getElementById('otsPendientesResumen');
        if (elOtsPend) elOtsPend.textContent = otsPendientes ?? 0;
        
        const elOtsProc = document.getElementById('otsProcesoResumen');
        if (elOtsProc) elOtsProc.textContent = otsProceso ?? 0;
        
        const elSolic = document.getElementById('solicitudesResumen');
        if (elSolic) elSolic.textContent = solicitudesPendientes ?? 0;

        // 4. ACTIVIDAD RECIENTE
        const { data: actividad } = await supabase
            .from('auditoria_acciones')
            .select('*, usuarios(nombre)')
            .order('created_at', { ascending: false })
            .limit(15);

        const htmlActividad = (actividad && actividad.length > 0) ? actividad.map(a => `
            <div style="padding:.75rem;border-bottom:1px solid var(--gray-200);display:flex;justify-content:space-between;align-items:start;">
                <div style="flex:1;">
                    <strong>${a.usuarios?.nombre || 'Sistema'}</strong>
                    <span style="color:var(--gray-700);"> realizó: </span>
                    <strong style="color:var(--primary);">${a.accion}</strong><br>
                    <small style="color:var(--gray-700);">
                        📁 ${a.modulo}
                        ${a.ip_address ? ` | 🌐 ${a.ip_address}` : ''}
                    </small>
                </div>
                <small style="color:var(--gray-700);white-space:nowrap;margin-left:1rem;">
                    ${formatearFechaHora(a.created_at)}
                </small>
            </div>
        `).join('') : `
            <div style="text-align:center;padding:3rem;color:var(--gray-700);">
                <div style="font-size:3rem;margin-bottom:1rem;">📭</div>
                <p>Sin actividad reciente registrada</p>
                <small>Las acciones del sistema aparecerán aquí</small>
            </div>
        `;

        const elActividad = document.getElementById('actividadReciente');
        if (elActividad) elActividad.innerHTML = htmlActividad;

        // 5. ÚLTIMOS USUARIOS
        const { data: ultimosUsuarios } = await supabase
            .from('usuarios')
            .select('id, nombre, email, rol, created_at')
            .order('created_at', { ascending: false })
            .limit(5);

        const htmlUsuarios = (ultimosUsuarios && ultimosUsuarios.length > 0) ? ultimosUsuarios.map(u => `
            <div style="padding:.75rem;border-bottom:1px solid var(--gray-200);">
                <div style="display:flex;justify-content:space-between;align-items:start;">
                    <div>
                        <strong>${u.nombre}</strong><br>
                        <small style="color:var(--gray-700);">${u.email}</small><br>
                        <span class="badge badge-primary" style="font-size:.75rem;margin-top:.25rem;">${u.rol}</span>
                    </div>
                    <small style="color:var(--gray-700);">
                        ${formatearFecha(u.created_at)}
                    </small>
                </div>
            </div>
        `).join('') : '<p style="color:var(--gray-700);padding:1rem;text-align:center;">Sin usuarios recientes</p>';

        const elUltimosUsuarios = document.getElementById('ultimosUsuarios');
        if (elUltimosUsuarios) elUltimosUsuarios.innerHTML = htmlUsuarios;

        // 6. ÚLTIMOS CLIENTES
        const { data: ultimosClientes } = await supabase
            .from('clientes')
            .select('id, razon_social, nit, telefono, created_at')
            .order('created_at', { ascending: false })
            .limit(5);

        const htmlClientes = (ultimosClientes && ultimosClientes.length > 0) ? ultimosClientes.map(c => `
            <div style="padding:.75rem;border-bottom:1px solid var(--gray-200);">
                <div style="display:flex;justify-content:space-between;align-items:start;">
                    <div>
                        <strong>${c.razon_social}</strong><br>
                        <small style="color:var(--gray-700);">
                            NIT: ${c.nit}
                            ${c.telefono ? ` | 📞 ${c.telefono}` : ''}
                        </small>
                    </div>
                    <small style="color:var(--gray-700);">
                        ${formatearFecha(c.created_at)}
                    </small>
                </div>
            </div>
        `).join('') : '<p style="color:var(--gray-700);padding:1rem;text-align:center;">Sin clientes recientes</p>';

        const elUltimosClientes = document.getElementById('ultimosClientes');
        if (elUltimosClientes) elUltimosClientes.innerHTML = htmlClientes;

    } catch (error) {
        console.error('Error cargando dashboard:', error);
        mostrarNotificacion('Error cargando datos del dashboard', 'error');
    }
}
// ============================================
// GESTIÓN DE USUARIOS
// ============================================

async function cargarUsuarios() {
    try {
        // Verificar que el elemento de la tabla existe
        if (!document.getElementById('tablaUsuarios')) {
            console.log('Tabla de usuarios no encontrada en el DOM');
            return;
        }

        const { data, error } = await supabase
            .from('usuarios')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error de Supabase:', error);
            throw error;
        }

        console.log('Usuarios cargados:', data?.length || 0);
        todosLosUsuarios = data || [];
        
        // Si hay datos, renderizar
        if (todosLosUsuarios.length > 0) {
            filtrarUsuarios();
        } else {
            // Mostrar mensaje si no hay usuarios
            const tablaEl = document.getElementById('tablaUsuarios');
            if (tablaEl) {
                tablaEl.innerHTML = '<p style="color:var(--gray-700);padding:2rem;text-align:center;">No hay usuarios registrados</p>';
            }
        }

    } catch (error) {
        console.error('Error cargando usuarios:', error);
        mostrarNotificacion('Error cargando usuarios: ' + error.message, 'error');
    }
}

window.filtrarUsuarios = function() {
    const busqueda = document.getElementById('buscarUsuario')?.value.toLowerCase() || '';
    const rol = document.getElementById('filtroRolUsuario')?.value || '';
    const activo = document.getElementById('filtroEstadoUsuario')?.value;

    let filtrados = todosLosUsuarios;

    if (busqueda) {
        filtrados = filtrados.filter(u => 
            u.nombre?.toLowerCase().includes(busqueda) ||
            u.email?.toLowerCase().includes(busqueda)
        );
    }

    if (rol) {
        filtrados = filtrados.filter(u => u.rol === rol);
    }

    if (activo !== '') {
        filtrados = filtrados.filter(u => u.activo === (activo === 'true'));
    }

    renderizarUsuarios(filtrados);
}

function renderizarUsuarios(usuarios) {
    dash.renderTabla('tablaUsuarios', [
        { key: 'nombre', label: 'Nombre' },
        { key: 'email', label: 'Email' },
        { key: 'rol', label: 'Rol', 
          render: r => `<span class="badge badge-primary">${r.rol}</span>` },
        { key: 'telefono', label: 'Teléfono' },
        { key: 'created_at', label: 'Registro', tipo: 'fecha' },
        { key: 'activo', label: 'Estado',
          render: r => `<span class="badge badge-${r.activo ? 'green' : 'danger'}">
              ${r.activo ? 'Activo' : 'Inactivo'}
          </span>` }
    ], usuarios, [
        { label: 'Editar', icono: '✏️', fn: 'editarUsuario', tipo: 'primary' },
        { label: 'Ver Detalle', icono: '👁️', fn: 'verDetalleUsuario', tipo: 'secondary' },
        { label: 'Cambiar Estado', icono: '🔄', fn: 'toggleEstadoUsuario', tipo: 'warning' }
    ]);
}

window.abrirModalUsuario = function(id = null) {
    document.getElementById('tituloModalUsuario').textContent = id ? 'Editar Usuario' : 'Nuevo Usuario';
    document.getElementById('formUsuario').reset();
    document.getElementById('usuarioId').value = id || '';

    const passwordGroup = document.getElementById('passwordGroup');
    if (id) {
        passwordGroup.style.display = 'none';
        document.getElementById('usuarioPassword').removeAttribute('required');
    } else {
        passwordGroup.style.display = 'block';
        document.getElementById('usuarioPassword').setAttribute('required', 'required');
    }

    if (id) {
        const usuario = todosLosUsuarios.find(u => u.id === id);
        if (usuario) {
            document.getElementById('usuarioNombre').value = usuario.nombre;
            document.getElementById('usuarioEmail').value = usuario.email;
            document.getElementById('usuarioTelefono').value = usuario.telefono || '';
            document.getElementById('usuarioDocTipo').value = usuario.documento_tipo || 'CC';
            document.getElementById('usuarioDocNumero').value = usuario.documento_numero || '';
            document.getElementById('usuarioRol').value = usuario.rol;
            document.getElementById('usuarioCiudad').value = usuario.ciudad || '';
            document.getElementById('usuarioNotas').value = usuario.notas || '';
        }
    }

    document.getElementById('modalUsuario').classList.add('active');
}

window.editarUsuario = abrirModalUsuario;

window.verDetalleUsuario = async function(usuarioId) {
    const usuario = todosLosUsuarios.find(u => u.id === usuarioId);
    if (!usuario) return;

    const { data: acciones } = await supabase
        .from('auditoria_acciones')
        .select('*')
        .eq('usuario_id', usuarioId)
        .order('created_at', { ascending: false })
        .limit(50);

    const modal = `
        <div class="modal" style="display:flex;" onclick="if(event.target===this) this.remove()">
            <div class="modal-content" style="max-width:900px;">
                <h2>👤 Detalle de Usuario</h2>
                
                <div class="card" style="margin-bottom:1rem;">
                    <h3>${usuario.nombre}</h3>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
                        <div>
                            <strong>Email:</strong> ${usuario.email}<br>
                            <strong>Rol:</strong> <span class="badge badge-primary">${usuario.rol}</span><br>
                            <strong>Teléfono:</strong> ${usuario.telefono || 'N/A'}<br>
                            <strong>Documento:</strong> ${usuario.documento_tipo || ''} ${usuario.documento_numero || 'N/A'}
                        </div>
                        <div>
                            <strong>Estado:</strong> <span class="badge badge-${usuario.activo ? 'green' : 'danger'}">
                                ${usuario.activo ? 'Activo' : 'Inactivo'}
                            </span><br>
                            <strong>Registro:</strong> ${formatearFecha(usuario.created_at)}<br>
                            <strong>Ciudad:</strong> ${usuario.ciudad || 'N/A'}
                        </div>
                    </div>
                </div>

                <div class="card">
                    <h3>📋 Historial de Actividad</h3>
                    <div style="max-height:400px;overflow-y:auto;">
                        ${(acciones || []).map(a => `
                            <div style="padding:.75rem;border-bottom:1px solid var(--gray-200);">
                                <strong>${a.accion}</strong> en ${a.modulo}<br>
                                <small style="color:var(--gray-700);">
                                    ${formatearFechaHora(a.created_at)}
                                </small>
                            </div>
                        `).join('') || '<p style="padding:1rem;">Sin actividad</p>'}
                    </div>
                </div>

                <button onclick="this.closest('.modal').remove()" class="btn btn-secondary" style="width:100%;margin-top:1rem;">
                    Cerrar
                </button>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modal);
}

window.toggleEstadoUsuario = async function(usuarioId) {
    const usuario = todosLosUsuarios.find(u => u.id === usuarioId);
    if (!usuario) return;

    const nuevoEstado = !usuario.activo;
    if (!confirm(`¿${nuevoEstado ? 'Activar' : 'Desactivar'} este usuario?`)) return;

    try {
        await supabase.from('usuarios').update({ activo: nuevoEstado }).eq('id', usuarioId);
        mostrarNotificacion('✅ Usuario actualizado', 'success');
        await cargarUsuarios();
    } catch (error) {
        mostrarNotificacion('Error: ' + error.message, 'error');
    }
}

document.getElementById('formUsuario').addEventListener('submit', async (e) => {
    e.preventDefault();

    const usuarioId = document.getElementById('usuarioId').value;
    const esNuevo = !usuarioId;

    const datos = {
        nombre: document.getElementById('usuarioNombre').value.trim(),
        email: document.getElementById('usuarioEmail').value.trim().toLowerCase(),
        documento_tipo: document.getElementById('usuarioDocTipo').value,
        documento_numero: document.getElementById('usuarioDocNumero').value.trim(),
        telefono: document.getElementById('usuarioTelefono').value.trim(),
        rol: document.getElementById('usuarioRol').value,
        ciudad: document.getElementById('usuarioCiudad').value.trim() || null,
        notas: document.getElementById('usuarioNotas').value.trim() || null,
        activo: true
    };

    try {
        if (esNuevo) {
            const password = document.getElementById('usuarioPassword').value;
            if (!password || password.length < 6) {
                throw new Error('La contraseña debe tener al menos 6 caracteres');
            }
            await supabase.from('usuarios').insert(datos);
            mostrarNotificacion('✅ Usuario creado', 'success');
        } else {
            await supabase.from('usuarios').update(datos).eq('id', usuarioId);
            mostrarNotificacion('✅ Usuario actualizado', 'success');
        }

        cerrarModal();
        await cargarUsuarios();
    } catch (error) {
        mostrarNotificacion('Error: ' + error.message, 'error');
    }
});

// ============================================
// GESTIÓN DE CLIENTES
// ============================================

async function cargarClientes() {
    try {
        // Verificar que el elemento de la tabla existe
        if (!document.getElementById('tablaClientes')) {
            console.log('Tabla de clientes no encontrada en el DOM');
            return;
        }

        const { data, error } = await supabase
            .from('clientes')
            .select('*')
            .order('razon_social');

        if (error) {
            console.error('Error de Supabase:', error);
            throw error;
        }

        console.log('Clientes cargados:', data?.length || 0);
        todosLosClientes = data || [];
        
        // Si hay datos, renderizar
        if (todosLosClientes.length > 0) {
            filtrarClientes();
        } else {
            // Mostrar mensaje si no hay clientes
            const tablaEl = document.getElementById('tablaClientes');
            if (tablaEl) {
                tablaEl.innerHTML = '<p style="color:var(--gray-700);padding:2rem;text-align:center;">No hay clientes registrados</p>';
            }
        }

    } catch (error) {
        console.error('Error cargando clientes:', error);
        mostrarNotificacion('Error cargando clientes: ' + error.message, 'error');
    }
}

window.filtrarClientes = function() {
    const busqueda = document.getElementById('buscarCliente')?.value.toLowerCase() || '';
    let filtrados = todosLosClientes;

    if (busqueda) {
        filtrados = filtrados.filter(c => 
            c.razon_social?.toLowerCase().includes(busqueda) ||
            c.nit?.includes(busqueda)
        );
    }

    dash.renderTabla('tablaClientes', [
        { key: 'razon_social', label: 'Razón Social' },
        { key: 'nit', label: 'NIT' },
        { key: 'telefono', label: 'Teléfono' },
        { key: 'email', label: 'Email' },
        { key: 'ciudad', label: 'Ciudad' }
    ], filtrados, [
        { label: 'Editar', icono: '✏️', fn: 'editarCliente', tipo: 'primary' }
    ]);
}

window.abrirModalCliente = function(id = null) {
    document.getElementById('tituloModalCliente').textContent = id ? 'Editar Cliente' : 'Nuevo Cliente';
    document.getElementById('formCliente').reset();
    document.getElementById('clienteId').value = id || '';

    if (id) {
        const cliente = todosLosClientes.find(c => c.id === id);
        if (cliente) {
            document.getElementById('clienteRazonSocial').value = cliente.razon_social;
            document.getElementById('clienteNit').value = cliente.nit;
            document.getElementById('clienteTipoPersona').value = cliente.tipo_persona || 'juridica';
            document.getElementById('clienteTelefono').value = cliente.telefono || '';
            document.getElementById('clienteEmail').value = cliente.email || '';
            document.getElementById('clienteDireccion').value = cliente.direccion || '';
            document.getElementById('clienteCiudad').value = cliente.ciudad || '';
            document.getElementById('clienteSitioWeb').value = cliente.sitio_web || '';
        }
    }

    document.getElementById('modalCliente').classList.add('active');
}

window.editarCliente = abrirModalCliente;

document.getElementById('formCliente').addEventListener('submit', async (e) => {
    e.preventDefault();

    const clienteId = document.getElementById('clienteId').value;
    const datos = {
        razon_social: document.getElementById('clienteRazonSocial').value.trim(),
        nit: document.getElementById('clienteNit').value.trim(),
        tipo_persona: document.getElementById('clienteTipoPersona').value,
        telefono: document.getElementById('clienteTelefono').value.trim() || null,
        email: document.getElementById('clienteEmail').value.trim() || null,
        direccion: document.getElementById('clienteDireccion').value.trim() || null,
        ciudad: document.getElementById('clienteCiudad').value.trim() || null,
        sitio_web: document.getElementById('clienteSitioWeb').value.trim() || null,
        activo: true
    };

    try {
        if (clienteId) {
            await supabase.from('clientes').update(datos).eq('id', clienteId);
        } else {
            await supabase.from('clientes').insert(datos);
        }
        mostrarNotificacion('✅ Cliente guardado', 'success');
        cerrarModalCliente();
        await cargarClientes();
    } catch (error) {
        mostrarNotificacion('Error: ' + error.message, 'error');
    }
});

// ============================================
// PERMISOS Y AUDITORÍA
// ============================================

(async () => {
    const { data } = await supabase.from('permisos').select('*').order('modulo');
    permisosDisponibles = data || [];
})();

window.cargarPermisos = async function() {
    const rol = document.getElementById('filtroRolPermisos')?.value;
    const tablaEl = document.getElementById('tablaPermisos');
    const btnAgregar = document.getElementById('btnAgregarPermiso');
    
    if (!rol) {
        if (tablaEl) {
            tablaEl.innerHTML = '<p style="color:var(--gray-700);padding:2rem;text-align:center;">Seleccione un rol para ver sus permisos</p>';
        }
        if (btnAgregar) btnAgregar.style.display = 'none';
        return;
    }

    rolSeleccionado = rol;
    if (btnAgregar) btnAgregar.style.display = 'block';

    try {
        const { data, error } = await supabase
            .from('rol_permisos')
            .select('*, permisos(*)')
            .eq('rol', rol)
            .order('permisos(modulo)');

        if (error) throw error;

        permisosDelRol = data || [];

        // Agrupar por módulo
        const permisosAgrupados = {};
        permisosDelRol.forEach(rp => {
            const modulo = rp.permisos.modulo;
            if (!permisosAgrupados[modulo]) {
                permisosAgrupados[modulo] = [];
            }
            permisosAgrupados[modulo].push(rp);
        });

        const html = Object.entries(permisosAgrupados).map(([modulo, permisos]) => `
            <div class="card" style="margin-bottom:1rem;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
                    <h3 style="margin:0;">${modulo}</h3>
                    <span style="color:var(--gray-700);font-size:.875rem;">
                        ${permisos.length} permiso(s)
                    </span>
                </div>
                <div style="display:flex;gap:.5rem;flex-wrap:wrap;">
                    ${permisos.map(p => `
                        <div style="display:flex;align-items:center;gap:.5rem;padding:.5rem 1rem;
                                    background:var(--gray-50);border-radius:.5rem;border:1px solid var(--gray-200);">
                            <span class="badge badge-primary">${p.permisos.accion}</span>
                            <button onclick="eliminarPermiso(${p.id}, '${modulo}', '${p.permisos.accion}')" 
                                    class="btn btn-danger" 
                                    style="padding:.25rem .5rem;font-size:.75rem;margin-left:.5rem;">
                                ✕
                            </button>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');

        if (tablaEl) {
            tablaEl.innerHTML = html || '<p style="color:var(--gray-700);padding:2rem;text-align:center;">Este rol no tiene permisos asignados</p>';
        }

    } catch (error) {
        console.error('Error:', error);
        mostrarNotificacion('Error cargando permisos', 'error');
    }
}

window.eliminarPermiso = async function(rolPermisoId, modulo, accion) {
    if (!confirm(`¿Eliminar permiso "${accion}" del módulo "${modulo}"?`)) return;

    try {
        const { error } = await supabase
            .from('rol_permisos')
            .delete()
            .eq('id', rolPermisoId);

        if (error) throw error;

        await auth.registrarAccion('eliminar_permiso', 'permisos', rolPermisoId);
        mostrarNotificacion('✅ Permiso eliminado', 'success');
        await cargarPermisos();

    } catch (error) {
        console.error('Error:', error);
        mostrarNotificacion('❌ Error eliminando permiso: ' + error.message, 'error');
    }
}

window.abrirModalAgregarPermiso = function() {
    if (!rolSeleccionado) {
        mostrarNotificacion('⚠️ Seleccione un rol primero', 'warning');
        return;
    }

    // Obtener IDs de permisos ya asignados
    const permisosAsignadosIds = permisosDelRol.map(rp => rp.permiso_id);

    // Filtrar permisos disponibles (los que NO están asignados)
    const permisosNoAsignados = permisosDisponibles.filter(p => 
        !permisosAsignadosIds.includes(p.id)
    );

    if (permisosNoAsignados.length === 0) {
        mostrarNotificacion('ℹ️ Este rol ya tiene todos los permisos disponibles', 'info');
        return;
    }

    // Agrupar permisos no asignados por módulo
    const porModulo = {};
    permisosNoAsignados.forEach(p => {
        if (!porModulo[p.modulo]) porModulo[p.modulo] = [];
        porModulo[p.modulo].push(p);
    });

    const modal = `
        <div class="modal" style="display:flex;" id="modalAgregarPermiso">
            <div class="modal-content" style="max-width:700px;">
                <h2>➕ Agregar Permisos a: ${rolSeleccionado}</h2>
                
                <form id="formAgregarPermisos">
                    <p style="color:var(--gray-700);margin-bottom:1.5rem;">
                        Seleccione los permisos que desea agregar a este rol:
                    </p>

                    <div style="max-height:500px;overflow-y:auto;">
                        ${Object.entries(porModulo).map(([modulo, permisos]) => `
                            <div class="card" style="margin-bottom:1rem;">
                                <h3 style="margin:0 0 1rem;">${modulo}</h3>
                                <div style="display:flex;flex-direction:column;gap:.5rem;">
                                    ${permisos.map(p => `
                                        <label style="display:flex;align-items:center;padding:.5rem;
                                                      background:var(--gray-50);border-radius:.5rem;cursor:pointer;">
                                            <input type="checkbox" name="permisos" value="${p.id}" 
                                                   style="margin-right:.75rem;">
                                            <div style="flex:1;">
                                                <strong>${p.accion}</strong>
                                                ${p.descripcion ? `<br><small style="color:var(--gray-700);">${p.descripcion}</small>` : ''}
                                            </div>
                                        </label>
                                    `).join('')}
                                </div>
                            </div>
                        `).join('')}
                    </div>

                    <div style="display:flex;gap:1rem;margin-top:1.5rem;">
                        <button type="submit" class="btn btn-primary" style="flex:1;">
                            ✓ Agregar Permisos Seleccionados
                        </button>
                        <button type="button" onclick="cerrarModalAgregarPermiso()" class="btn btn-secondary">
                            Cancelar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modal);

    // Manejar envío del formulario
    document.getElementById('formAgregarPermisos').addEventListener('submit', async (e) => {
        e.preventDefault();

        const checkboxes = document.querySelectorAll('input[name="permisos"]:checked');
        const permisosIds = Array.from(checkboxes).map(cb => parseInt(cb.value));

        if (permisosIds.length === 0) {
            mostrarNotificacion('⚠️ Seleccione al menos un permiso', 'warning');
            return;
        }

        try {
            // Insertar múltiples permisos
            const insertData = permisosIds.map(permisoId => ({
                rol: rolSeleccionado,
                permiso_id: permisoId
            }));

            const { error } = await supabase
                .from('rol_permisos')
                .insert(insertData);

            if (error) throw error;

            await auth.registrarAccion('agregar_permisos', 'permisos');
            mostrarNotificacion(`✅ ${permisosIds.length} permiso(s) agregado(s)`, 'success');
            
            cerrarModalAgregarPermiso();
            await cargarPermisos();

        } catch (error) {
            console.error('Error:', error);
            mostrarNotificacion('❌ Error agregando permisos: ' + error.message, 'error');
        }
    });
}

window.cerrarModalAgregarPermiso = function() {
    const modal = document.getElementById('modalAgregarPermiso');
    if (modal) modal.remove();
}
// ============================================
// NAVEGACIÓN
// ============================================

window.cambiarSeccion = function(seccion, el) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    const sec = document.getElementById(seccion);
    if (sec) sec.classList.add('active');
    
    document.querySelectorAll('.sidebar nav a').forEach(a => a.classList.remove('active'));
    if (el) el.classList.add('active');

    // Cargar datos según la sección
    if (seccion === 'dashboard') {
        cargarDashboard();
    } else if (seccion === 'usuarios') {
        cargarUsuarios();
    } else if (seccion === 'clientes') {
        cargarClientes();
    } else if (seccion === 'permisos') {
        // Resetear permisos al cambiar de sección
        const filtro = document.getElementById('filtroRolPermisos');
        if (filtro) filtro.value = '';
        const tabla = document.getElementById('tablaPermisos');
        if (tabla) tabla.innerHTML = '<p style="color:var(--gray-700);padding:2rem;text-align:center;">Seleccione un rol para ver sus permisos</p>';
        const btnAgregar = document.getElementById('btnAgregarPermiso');
        if (btnAgregar) btnAgregar.style.display = 'none';
    } else if (seccion === 'auditoria') {
        // Cargar módulos para auditoría si es necesario
        cargarModulosAuditoria();
    }
}
async function cargarModulosAuditoria() {
    const select = document.getElementById('auditoriaModulo');
    if (!select || select.options.length > 1) return; // Ya cargado

    const { data } = await supabase
        .from('permisos')
        .select('modulo')
        .order('modulo');

    const modulos = [...new Set(data?.map(p => p.modulo))];
    modulos.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        select.appendChild(opt);
    });
}

window.filtrarAuditoria = async function() {
    const desde = document.getElementById('auditoriaDesde')?.value;
    const hasta = document.getElementById('auditoriaHasta')?.value;
    const modulo = document.getElementById('auditoriaModulo')?.value;

    let query = supabase
        .from('auditoria_acciones')
        .select('*, usuarios(nombre)')
        .order('created_at', { ascending: false })
        .limit(100);

    if (desde) query = query.gte('created_at', desde + 'T00:00:00');
    if (hasta) query = query.lte('created_at', hasta + 'T23:59:59');
    if (modulo) query = query.eq('modulo', modulo);

    const { data } = await query;

    dash.renderTabla('tablaAuditoria', [
        { key: 'id', label: 'Usuario',
          render: r => r.usuarios?.nombre || 'Sistema' },
        { key: 'accion', label: 'Acción' },
        { key: 'modulo', label: 'Módulo' },
        { key: 'ip_address', label: 'IP' },
        { key: 'created_at', label: 'Fecha', tipo: 'fechahora' }
    ], data || []);
}

window.cerrarModal = () => document.getElementById('modalUsuario').classList.remove('active');
window.cerrarModalCliente = () => document.getElementById('modalCliente').classList.remove('active');
window.cerrarSesion = () => auth.logout();