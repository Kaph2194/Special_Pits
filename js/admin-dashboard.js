// js/admin-dashboard.js
import { supabase } from './supabase-config.js';
import { DashboardBase } from './dashboards.js';
import { auth } from './auth-system.js';
import { mostrarNotificacion, formatearMoneda, formatearFecha } from './utils.js';

const dash = new DashboardBase(['superadmin']);

// ============================================
// VARIABLES GLOBALES
// ============================================

let usuariosCache = [];
let clientesCache = [];
let proveedoresCache = [];

// ============================================
// FUNCIONES GLOBALES
// ============================================

window.cambiarSeccion = function(seccion, el) {
    console.log('🔀 Cambiando a sección:', seccion);
    
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    const sec = document.getElementById(seccion);
    if (sec) {
        sec.classList.add('active');
        console.log('✅ Sección activada:', seccion);
    } else {
        console.error('❌ Sección no encontrada:', seccion);
    }
    
    document.querySelectorAll('.sidebar nav a').forEach(a => a.classList.remove('active'));
    if (el) el.classList.add('active');

    if (seccion === 'dashboard') cargarDashboard();
    if (seccion === 'usuarios') cargarUsuarios();
    if (seccion === 'clientes') cargarClientes();
    if (seccion === 'proveedores') cargarProveedores();
    if (seccion === 'configuracion') cargarConfiguracion();
}

window.cerrarSesion = () => {
    console.log('🚪 Cerrando sesión...');
    auth.logout();
}

// ============================================
// FUNCIÓN EXPORTAR A EXCEL (INTEGRADA)
// ============================================

async function exportarAExcel(datos, nombreArchivo, nombreHoja = 'Hoja1') {
    try {
        if (typeof XLSX === 'undefined') {
            throw new Error('Librería de Excel no disponible');
        }

        if (!datos || datos.length === 0) {
            throw new Error('No hay datos para exportar');
        }

        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(datos);
        XLSX.utils.book_append_sheet(workbook, worksheet, nombreHoja);
        
        const timestamp = new Date().toISOString().split('T')[0];
        const nombreCompleto = `${nombreArchivo}_${timestamp}.xlsx`;
        
        XLSX.writeFile(workbook, nombreCompleto);
        return true;

    } catch (error) {
        console.error('Error exportando:', error);
        mostrarNotificacion('Error exportando: ' + error.message, 'error');
        return false;
    }
}

// ============================================
// INICIALIZACIÓN
// ============================================

(async () => {
    console.log('🚀 Inicializando admin dashboard...');
    
    if (!await dash.inicializar()) {
        console.error('❌ No se pudo inicializar dashboard');
        return;
    }
    
    console.log('✅ Dashboard inicializado');
    
    await cargarDashboard();
    await cargarUsuarios();
    await cargarClientes();
    await cargarProveedores();
    
    configurarEventos();
})();

function configurarEventos() {
    document.getElementById('formUsuario')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await guardarUsuario();
    });

    document.getElementById('formCliente')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await guardarCliente();
    });

    document.getElementById('formProveedor')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await guardarProveedor();
    });

    document.getElementById('formConfiguracion')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await guardarConfiguracion();
    });

    console.log('✅ Eventos configurados');
}

// ============================================
// DASHBOARD PRINCIPAL
// ============================================

async function cargarDashboard() {
    console.log('📊 Cargando dashboard...');
    
    try {
        const { count: usuarios } = await supabase
            .from('usuarios')
            .select('*', { count: 'exact', head: true })
            .eq('activo', true);

        const { count: clientes } = await supabase
            .from('clientes')
            .select('*', { count: 'exact', head: true })
            .eq('activo', true);

        const { count: proveedores } = await supabase
            .from('proveedores')
            .select('*', { count: 'exact', head: true })
            .eq('activo', true);

        document.getElementById('totalUsuarios').textContent = usuarios || 0;
        document.getElementById('totalClientes').textContent = clientes || 0;
        document.getElementById('totalProveedores').textContent = proveedores || 0;

        await cargarActividadReciente();

        console.log('✅ Dashboard cargado');

    } catch (error) {
        console.error('❌ Error cargando dashboard:', error);
        mostrarNotificacion('Error cargando dashboard', 'error');
    }
}

async function cargarActividadReciente() {
    try {
        const { data, error } = await supabase
            .from('auditoria')
            .select('id, accion, tabla_nombre, registro_id, usuario_id, created_at')
            .order('created_at', { ascending: false })
            .limit(10);

        if (error) {
            console.error('Error en auditoria:', error);
            document.getElementById('actividadReciente').innerHTML = 
                '<p style="color:var(--gray-700);padding:2rem;text-align:center;">📋 Tabla de auditoría no configurada</p>';
            return;
        }

        if (!data || data.length === 0) {
            document.getElementById('actividadReciente').innerHTML = 
                '<p style="color:var(--gray-700);padding:2rem;text-align:center;">No hay actividad reciente</p>';
            return;
        }

        const usuarioIds = [...new Set(data.map(a => a.usuario_id).filter(Boolean))];
        let usuarios = {};

        if (usuarioIds.length > 0) {
            const { data: usuariosData } = await supabase
                .from('usuarios')
                .select('id, nombre_completo')
                .in('id', usuarioIds);

            if (usuariosData) {
                usuarios = Object.fromEntries(usuariosData.map(u => [u.id, u.nombre_completo]));
            }
        }

        const html = data.map(a => `
            <div style="padding:0.75rem;border-bottom:1px solid var(--gray-200);">
                <div style="display:flex;justify-content:space-between;align-items:start;">
                    <div>
                        <strong>${usuarios[a.usuario_id] || 'Sistema'}</strong>
                        <span style="color:var(--gray-700);"> - ${a.accion}</span><br>
                        <small style="color:var(--gray-700);">${a.tabla_nombre || 'N/A'} ${a.registro_id ? `#${a.registro_id}` : ''}</small>
                    </div>
                    <small style="color:var(--gray-700);">${formatearFecha(a.created_at)}</small>
                </div>
            </div>
        `).join('');

        document.getElementById('actividadReciente').innerHTML = html;

    } catch (error) {
        console.error('Error cargando actividad:', error);
        document.getElementById('actividadReciente').innerHTML = 
            '<p style="color:var(--gray-700);padding:2rem;text-align:center;">⚠️ No se pudo cargar la actividad</p>';
    }
}

// ============================================
// GESTIÓN DE USUARIOS
// ============================================

async function cargarUsuarios() {
    console.log('👥 Cargando usuarios...');
    
    try {
        const { data, error } = await supabase
            .from('usuarios')
            .select('id, nombre_completo, email, rol, created_at, activo')
            .eq('activo', true)
            .order('nombre_completo');

        if (error) throw error;

        usuariosCache = data || [];
        console.log('✅ Usuarios cargados:', usuariosCache.length);

        const tablaElement = document.getElementById('tablaUsuarios');
        if (!tablaElement) {
            console.error('❌ Elemento #tablaUsuarios no encontrado');
            return;
        }

        if (usuariosCache.length === 0) {
            tablaElement.innerHTML = 
                '<p style="color:var(--gray-700);padding:2rem;text-align:center;">No hay usuarios registrados</p>';
            return;
        }

        filtrarUsuarios();

    } catch (error) {
        console.error('❌ Error cargando usuarios:', error);
        mostrarNotificacion('Error cargando usuarios: ' + error.message, 'error');
        
        const tablaElement = document.getElementById('tablaUsuarios');
        if (tablaElement) {
            tablaElement.innerHTML = 
                `<p style="color:var(--danger);padding:2rem;text-align:center;">Error: ${error.message}</p>`;
        }
    }
}

window.filtrarUsuarios = function() {
    const busqueda = document.getElementById('buscarUsuario')?.value.toLowerCase() || '';
    
    const filtrados = usuariosCache.filter(u => 
        u.nombre_completo.toLowerCase().includes(busqueda) ||
        u.email.toLowerCase().includes(busqueda)
    );

    dash.renderTabla('tablaUsuarios', [
        { key: 'nombre_completo', label: 'Nombre' },
        { key: 'email', label: 'Email' },
        { key: 'rol', label: 'Rol', render: r => {
            const roles = {
                'superadmin': 'Super Admin',
                'jefe_taller': 'Jefe de Taller',
                'mecanico': 'Mecánico',
                'jefe_almacen': 'Jefe de Almacén',
                'caja': 'Caja'
            };
            return roles[r.rol] || r.rol;
        }},
        { key: 'created_at', label: 'Fecha Registro', tipo: 'fecha' }
    ], filtrados, [
        { label: 'Editar', icono: '✏️', fn: 'editarUsuario', tipo: 'primary' },
        { label: 'Eliminar', icono: '🗑️', fn: 'eliminarUsuario', tipo: 'danger' }
    ]);
}

window.abrirModalUsuario = function(id = null) {
    const modal = document.getElementById('modalUsuario');
    const form = document.getElementById('formUsuario');
    const titulo = document.getElementById('tituloModalUsuario');
    const grupoPassword = document.getElementById('grupoPassword');

    if (!modal || !form || !titulo || !grupoPassword) {
        console.error('❌ Elementos del modal usuario no encontrados');
        return;
    }

    form.reset();
    document.getElementById('usuarioId').value = '';
    grupoPassword.style.display = 'block';
    document.getElementById('usuarioPassword').required = true;

    if (id) {
        const usuario = usuariosCache.find(u => u.id === id);
        if (usuario) {
            titulo.textContent = 'Editar Usuario';
            document.getElementById('usuarioId').value = usuario.id;
            document.getElementById('usuarioNombre').value = usuario.nombre_completo;
            document.getElementById('usuarioEmail').value = usuario.email;
            document.getElementById('usuarioRol').value = usuario.rol;
            grupoPassword.style.display = 'none';
            document.getElementById('usuarioPassword').required = false;
        }
    } else {
        titulo.textContent = 'Nuevo Usuario';
    }

    modal.classList.add('active');
}

window.editarUsuario = function(id) {
    abrirModalUsuario(id);
}

window.cerrarModalUsuario = function() {
    document.getElementById('modalUsuario')?.classList.remove('active');
}

async function guardarUsuario() {
    const id = document.getElementById('usuarioId').value;
    const nombre = document.getElementById('usuarioNombre').value;
    const email = document.getElementById('usuarioEmail').value;
    const rol = document.getElementById('usuarioRol').value;
    const password = document.getElementById('usuarioPassword').value;

    try {
        const datos = {
            nombre_completo: nombre,
            email: email,
            rol: rol
        };

        if (!id && password) {
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: email,
                password: password
            });

            if (authError) throw authError;

            datos.auth_id = authData.user.id;

            const { error } = await supabase.from('usuarios').insert(datos);
            if (error) throw error;

            mostrarNotificacion('✅ Usuario creado', 'success');
        } else if (id) {
            const { error } = await supabase
                .from('usuarios')
                .update(datos)
                .eq('id', id);

            if (error) throw error;

            mostrarNotificacion('✅ Usuario actualizado', 'success');
        }

        await auth.registrarAccion(id ? 'actualizar_usuario' : 'crear_usuario', 'usuarios', id);
        
        cerrarModalUsuario();
        await cargarUsuarios();
        await cargarDashboard();

    } catch (error) {
        console.error('Error:', error);
        mostrarNotificacion('❌ Error: ' + error.message, 'error');
    }
}

window.eliminarUsuario = async function(id) {
    if (!confirm('¿Está seguro de eliminar este usuario?')) return;

    try {
        const { error } = await supabase
            .from('usuarios')
            .update({ activo: false })
            .eq('id', id);

        if (error) throw error;

        await auth.registrarAccion('eliminar_usuario', 'usuarios', id);

        mostrarNotificacion('✅ Usuario eliminado', 'success');
        await cargarUsuarios();
        await cargarDashboard();

    } catch (error) {
        console.error('Error:', error);
        mostrarNotificacion('❌ Error: ' + error.message, 'error');
    }
}

window.exportarUsuarios = async function() {
    if (usuariosCache.length === 0) {
        mostrarNotificacion('⚠️ No hay datos para exportar', 'warning');
        return;
    }

    const datos = usuariosCache.map(u => ({
        'Nombre': u.nombre_completo,
        'Email': u.email,
        'Rol': u.rol,
        'Fecha Registro': formatearFecha(u.created_at)
    }));

    const exito = await exportarAExcel(datos, 'Usuarios', 'Usuarios');
    
    if (exito) {
        mostrarNotificacion('✅ Excel generado', 'success');
        await auth.registrarAccion('exportar_usuarios', 'usuarios');
    }
}

// ============================================
// GESTIÓN DE CLIENTES
// ============================================

async function cargarClientes() {
    console.log('🏢 Cargando clientes...');
    
    try {
        const { data, error } = await supabase
            .from('clientes')
            .select('*')
            .eq('activo', true)
            .order('razon_social');

        if (error) throw error;

        clientesCache = data || [];
        console.log('✅ Clientes cargados:', clientesCache.length);

        if (clientesCache.length === 0) {
            document.getElementById('tablaClientes').innerHTML = 
                '<p style="color:var(--gray-700);padding:2rem;text-align:center;">No hay clientes registrados</p>';
            return;
        }

        filtrarClientes();

    } catch (error) {
        console.error('❌ Error cargando clientes:', error);
        mostrarNotificacion('Error cargando clientes', 'error');
    }
}

window.filtrarClientes = function() {
    const busqueda = document.getElementById('buscarCliente')?.value.toLowerCase() || '';
    const tipoFiltro = document.getElementById('filtroTipoCliente')?.value || '';
    
    let filtrados = clientesCache.filter(c => 
        c.razon_social.toLowerCase().includes(busqueda) ||
        c.nit.toLowerCase().includes(busqueda) ||
        (c.telefono && c.telefono.toLowerCase().includes(busqueda))
    );

    if (tipoFiltro) {
        filtrados = filtrados.filter(c => c.tipo_persona === tipoFiltro);
    }

    dash.renderTabla('tablaClientes', [
        { key: 'razon_social', label: 'Razón Social' },
        { key: 'nit', label: 'NIT' },
        { key: 'tipo_persona', label: 'Tipo', render: c => 
            c.tipo_persona === 'natural' ? 'Natural' : 'Jurídica' },
        { key: 'telefono', label: 'Teléfono' },
        { key: 'margen_ganancia', label: 'Margen', render: c => 
            c.margen_ganancia ? `${(c.margen_ganancia * 100).toFixed(1)}%` : '-' }
    ], filtrados, [
        { label: 'Editar', icono: '✏️', fn: 'editarCliente', tipo: 'primary' },
        { label: 'Eliminar', icono: '🗑️', fn: 'eliminarCliente', tipo: 'danger' }
    ]);
}

window.abrirModalCliente = function(id = null) {
    const modal = document.getElementById('modalCliente');
    const form = document.getElementById('formCliente');
    const titulo = document.getElementById('tituloModalCliente');

    form.reset();
    document.getElementById('clienteId').value = '';

    if (id) {
        const cliente = clientesCache.find(c => c.id === id);
        if (cliente) {
            titulo.textContent = 'Editar Cliente';
            document.getElementById('clienteId').value = cliente.id;
            document.getElementById('clienteRazonSocial').value = cliente.razon_social;
            document.getElementById('clienteNit').value = cliente.nit;
            document.getElementById('clienteTipoPersona').value = cliente.tipo_persona;
            document.getElementById('clienteMargen').value = cliente.margen_ganancia ? (cliente.margen_ganancia * 100) : '';
            document.getElementById('clienteTelefono').value = cliente.telefono || '';
            document.getElementById('clienteEmail').value = cliente.email || '';
            document.getElementById('clienteDireccion').value = cliente.direccion || '';
        }
    } else {
        titulo.textContent = 'Nuevo Cliente';
    }

    modal.classList.add('active');
}

window.editarCliente = function(id) {
    abrirModalCliente(id);
}

window.cerrarModalCliente = function() {
    document.getElementById('modalCliente').classList.remove('active');
}

async function guardarCliente() {
    const id = document.getElementById('clienteId').value;
    const razonSocial = document.getElementById('clienteRazonSocial').value;
    const nit = document.getElementById('clienteNit').value;
    const tipoPersona = document.getElementById('clienteTipoPersona').value;
    const margen = parseFloat(document.getElementById('clienteMargen').value) || 0;
    const telefono = document.getElementById('clienteTelefono').value;
    const email = document.getElementById('clienteEmail').value;
    const direccion = document.getElementById('clienteDireccion').value;

    try {
        const datos = {
            razon_social: razonSocial,
            nit: nit,
            tipo_persona: tipoPersona,
            margen_ganancia: margen / 100,
            telefono: telefono || null,
            email: email || null,
            direccion: direccion || null
        };

        if (id) {
            const { error } = await supabase
                .from('clientes')
                .update(datos)
                .eq('id', id);

            if (error) throw error;

            mostrarNotificacion('✅ Cliente actualizado', 'success');
        } else {
            const { error } = await supabase.from('clientes').insert(datos);
            if (error) throw error;

            mostrarNotificacion('✅ Cliente creado', 'success');
        }

        await auth.registrarAccion(id ? 'actualizar_cliente' : 'crear_cliente', 'clientes', id);
        
        cerrarModalCliente();
        await cargarClientes();
        await cargarDashboard();

    } catch (error) {
        console.error('Error:', error);
        mostrarNotificacion('❌ Error: ' + error.message, 'error');
    }
}

window.eliminarCliente = async function(id) {
    if (!confirm('¿Está seguro de eliminar este cliente?')) return;

    try {
        const { error } = await supabase
            .from('clientes')
            .update({ activo: false })
            .eq('id', id);

        if (error) throw error;

        await auth.registrarAccion('eliminar_cliente', 'clientes', id);

        mostrarNotificacion('✅ Cliente eliminado', 'success');
        await cargarClientes();
        await cargarDashboard();

    } catch (error) {
        console.error('Error:', error);
        mostrarNotificacion('❌ Error: ' + error.message, 'error');
    }
}

window.exportarClientes = async function() {
    if (clientesCache.length === 0) {
        mostrarNotificacion('⚠️ No hay datos para exportar', 'warning');
        return;
    }

    const datos = clientesCache.map(c => ({
        'Razón Social': c.razon_social,
        'NIT': c.nit,
        'Tipo': c.tipo_persona === 'natural' ? 'Natural' : 'Jurídica',
        'Margen': c.margen_ganancia ? `${(c.margen_ganancia * 100).toFixed(1)}%` : '-',
        'Teléfono': c.telefono || 'N/A',
        'Email': c.email || 'N/A',
        'Dirección': c.direccion || 'N/A'
    }));

    const exito = await exportarAExcel(datos, 'Clientes', 'Clientes');
    
    if (exito) {
        mostrarNotificacion('✅ Excel generado', 'success');
        await auth.registrarAccion('exportar_clientes', 'clientes');
    }
}

// ============================================
// GESTIÓN DE PROVEEDORES
// ============================================

async function cargarProveedores() {
    console.log('🏭 Cargando proveedores...');
    
    try {
        const { data, error } = await supabase
            .from('proveedores')
            .select('*')
            .eq('activo', true)
            .order('razon_social');

        if (error) throw error;

        proveedoresCache = data || [];
        console.log('✅ Proveedores cargados:', proveedoresCache.length);

        if (proveedoresCache.length === 0) {
            document.getElementById('tablaProveedores').innerHTML = 
                '<p style="color:var(--gray-700);padding:2rem;text-align:center;">No hay proveedores registrados</p>';
            return;
        }

        filtrarProveedores();

    } catch (error) {
        console.error('❌ Error cargando proveedores:', error);
        mostrarNotificacion('Error cargando proveedores', 'error');
    }
}

window.filtrarProveedores = function() {
    const busqueda = document.getElementById('buscarProveedor')?.value.toLowerCase() || '';
    
    const filtrados = proveedoresCache.filter(p => 
        p.razon_social.toLowerCase().includes(busqueda) ||
        p.nit.toLowerCase().includes(busqueda)
    );

    dash.renderTabla('tablaProveedores', [
        { key: 'razon_social', label: 'Razón Social' },
        { key: 'nit', label: 'NIT' },
        { key: 'tipo_persona', label: 'Tipo', render: p => 
            p.tipo_persona === 'natural' ? 'Natural' : 'Jurídica' },
        { key: 'telefono', label: 'Teléfono' },
        { key: 'email', label: 'Email' }
    ], filtrados, [
        { label: 'Editar', icono: '✏️', fn: 'editarProveedor', tipo: 'primary' },
        { label: 'Eliminar', icono: '🗑️', fn: 'eliminarProveedor', tipo: 'danger' }
    ]);
}

window.abrirModalProveedor = function(id = null) {
    const modal = document.getElementById('modalProveedor');
    const form = document.getElementById('formProveedor');
    const titulo = document.getElementById('tituloModalProveedor');

    form.reset();
    document.getElementById('proveedorId').value = '';

    if (id) {
        const proveedor = proveedoresCache.find(p => p.id === id);
        if (proveedor) {
            titulo.textContent = 'Editar Proveedor';
            document.getElementById('proveedorId').value = proveedor.id;
            document.getElementById('proveedorRazonSocial').value = proveedor.razon_social;
            document.getElementById('proveedorNit').value = proveedor.nit;
            document.getElementById('proveedorTipoPersona').value = proveedor.tipo_persona;
            document.getElementById('proveedorTelefono').value = proveedor.telefono || '';
            document.getElementById('proveedorEmail').value = proveedor.email || '';
        }
    } else {
        titulo.textContent = 'Nuevo Proveedor';
    }

    modal.classList.add('active');
}

window.editarProveedor = function(id) {
    abrirModalProveedor(id);
}

window.cerrarModalProveedor = function() {
    document.getElementById('modalProveedor').classList.remove('active');
}

async function guardarProveedor() {
    const id = document.getElementById('proveedorId').value;
    const razonSocial = document.getElementById('proveedorRazonSocial').value;
    const nit = document.getElementById('proveedorNit').value;
    const tipoPersona = document.getElementById('proveedorTipoPersona').value;
    const telefono = document.getElementById('proveedorTelefono').value;
    const email = document.getElementById('proveedorEmail').value;

    try {
        const datos = {
            razon_social: razonSocial,
            nit: nit,
            tipo_persona: tipoPersona,
            telefono: telefono || null,
            email: email || null
        };

        if (id) {
            const { error } = await supabase
                .from('proveedores')
                .update(datos)
                .eq('id', id);

            if (error) throw error;

            mostrarNotificacion('✅ Proveedor actualizado', 'success');
        } else {
            const { error } = await supabase.from('proveedores').insert(datos);
            if (error) throw error;

            mostrarNotificacion('✅ Proveedor creado', 'success');
        }

        await auth.registrarAccion(id ? 'actualizar_proveedor' : 'crear_proveedor', 'proveedores', id);
        
        cerrarModalProveedor();
        await cargarProveedores();
        await cargarDashboard();

    } catch (error) {
        console.error('Error:', error);
        mostrarNotificacion('❌ Error: ' + error.message, 'error');
    }
}

window.eliminarProveedor = async function(id) {
    if (!confirm('¿Está seguro de eliminar este proveedor?')) return;

    try {
        const { error } = await supabase
            .from('proveedores')
            .update({ activo: false })
            .eq('id', id);

        if (error) throw error;

        await auth.registrarAccion('eliminar_proveedor', 'proveedores', id);

        mostrarNotificacion('✅ Proveedor eliminado', 'success');
        await cargarProveedores();
        await cargarDashboard();

    } catch (error) {
        console.error('Error:', error);
        mostrarNotificacion('❌ Error: ' + error.message, 'error');
    }
}

// ============================================
// CONFIGURACIÓN DEL SISTEMA
// ============================================

async function cargarConfiguracion() {
    console.log('⚙️ Cargando configuración...');
    
    try {
        const { data, error } = await supabase
            .from('configuracion_sistema')
            .select('*')
            .eq('id', 1)
            .single();

        if (error && error.code !== 'PGRST116') throw error;

        if (data) {
            document.getElementById('empresaNombre').value = data.empresa_nombre || '';
            document.getElementById('empresaNit').value = data.empresa_nit || '';
            document.getElementById('empresaTelefono').value = data.empresa_telefono || '';
            document.getElementById('empresaEmail').value = data.empresa_email || '';
            document.getElementById('empresaDireccion').value = data.empresa_direccion || '';
            document.getElementById('empresaCiudad').value = data.empresa_ciudad || '';
            document.getElementById('empresaPais').value = data.empresa_pais || '';
        }

        console.log('✅ Configuración cargada');

    } catch (error) {
        console.error('❌ Error cargando configuración:', error);
        mostrarNotificacion('Error cargando configuración', 'error');
    }
}

async function guardarConfiguracion() {
    try {
        const datos = {
            empresa_nombre: document.getElementById('empresaNombre').value,
            empresa_nit: document.getElementById('empresaNit').value,
            empresa_telefono: document.getElementById('empresaTelefono').value,
            empresa_email: document.getElementById('empresaEmail').value,
            empresa_direccion: document.getElementById('empresaDireccion').value,
            empresa_ciudad: document.getElementById('empresaCiudad').value,
            empresa_pais: document.getElementById('empresaPais').value
        };

        const { data: existing } = await supabase
            .from('configuracion_sistema')
            .select('id')
            .eq('id', 1)
            .single();

        if (existing) {
            const { error } = await supabase
                .from('configuracion_sistema')
                .update(datos)
                .eq('id', 1);

            if (error) throw error;
        } else {
            datos.id = 1;
            const { error } = await supabase
                .from('configuracion_sistema')
                .insert(datos);

            if (error) throw error;
        }

        await auth.registrarAccion('actualizar_configuracion', 'configuracion_sistema', 1);

        mostrarNotificacion('✅ Configuración guardada', 'success');

    } catch (error) {
        console.error('Error:', error);
        mostrarNotificacion('❌ Error: ' + error.message, 'error');
    }
}

console.log('✅ admin-dashboard.js cargado completamente');
