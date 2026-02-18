// js/proveedores.js
import { supabase } from './supabase-config.js';
import { DashboardBase } from './dashboards.js';
import { auth, protegerRuta } from './auth-system.js';
import { mostrarNotificacion, formatearMoneda } from './utils.js';

const dash = new DashboardBase(['superadmin','jefe_almacen','cliente_financiero']);

let proveedoresCache = [];

(async () => {
    if (!await protegerRuta([
        { modulo: 'proveedores', accion: 'leer' }
    ])) return;

    await cargarProveedores();
})();

async function cargarProveedores() {
    try {
        const { data, error } = await supabase
            .from('v_resumen_proveedores')
            .select('*')
            .order('razon_social');

        if (error) throw error;

        proveedoresCache = data || [];
        renderizarProveedores(proveedoresCache);

    } catch (error) {
        console.error('Error:', error);
        mostrarNotificacion('Error cargando proveedores', 'error');
    }
}

function renderizarProveedores(proveedores) {
    dash.renderTabla('tablaProveedores', [
        { key: 'razon_social', label: 'Razón Social' },
        { key: 'nit', label: 'NIT' },
        { key: 'telefono', label: 'Teléfono' },
        { key: 'ciudad', label: 'Ciudad' },
        { key: 'dias_credito', label: 'Días Crédito' },
        { key: 'total_facturas', label: 'Facturas' },
        { key: 'deuda_pendiente', label: 'Deuda Pendiente', tipo: 'moneda' },
        { key: 'productos_activos', label: 'Productos' },
        { key: 'activo', label: 'Estado',
          render: r => `<span class="badge badge-${r.activo ? 'green' : 'danger'}">${r.activo ? 'Activo' : 'Inactivo'}</span>` }
    ], proveedores, [
        { label:'Editar', icono:'✏️', fn:'editarProveedor', tipo:'primary' },
        { label:'CxP', icono:'💰', fn:'verCuentasPorPagar', tipo:'warning' }
    ]);
}

window.filtrarProveedores = function() {
    const busq = document.getElementById('buscarProveedor').value.toLowerCase();
    const filtrados = proveedoresCache.filter(p =>
        p.razon_social?.toLowerCase().includes(busq) ||
        p.nit?.includes(busq)
    );
    renderizarProveedores(filtrados);
}

window.abrirModalProveedor = function(id = null) {
    document.getElementById('tituloModal').textContent = id ? 'Editar Proveedor' : 'Nuevo Proveedor';
    document.getElementById('formProveedor').reset();
    document.getElementById('proveedorId').value = id || '';

    if (id) {
        const prov = proveedoresCache.find(p => p.id === id);
        if (prov) {
            document.getElementById('razonSocial').value = prov.razon_social;
            document.getElementById('nit').value = prov.nit;
            document.getElementById('nombreComercial').value = prov.nombre_comercial || '';
            document.getElementById('tipoPersona').value = prov.tipo_persona || 'juridica';
            document.getElementById('telefono').value = prov.telefono || '';
            document.getElementById('email').value = prov.email || '';
            document.getElementById('direccion').value = prov.direccion || '';
            document.getElementById('ciudad').value = prov.ciudad || '';
            document.getElementById('sitioWeb').value = prov.sitio_web || '';
            document.getElementById('diasCredito').value = prov.dias_credito || 30;
            document.getElementById('metodoPago').value = prov.metodo_pago_preferido || 'transferencia';
            document.getElementById('banco').value = prov.banco || '';
            document.getElementById('tipoCuenta').value = prov.tipo_cuenta || '';
            document.getElementById('numeroCuenta').value = prov.numero_cuenta || '';
            document.getElementById('contactoNombre').value = prov.contacto_nombre || '';
            document.getElementById('contactoCargo').value = prov.contacto_cargo || '';
            document.getElementById('contactoTelefono').value = prov.contacto_telefono || '';
            document.getElementById('contactoEmail').value = prov.contacto_email || '';
            document.getElementById('notas').value = prov.notas || '';
        }
    }

    document.getElementById('modalProveedor').classList.add('active');
}

window.editarProveedor = abrirModalProveedor;

document.getElementById('formProveedor').addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = document.getElementById('proveedorId').value;
    const datos = {
        razon_social: document.getElementById('razonSocial').value.trim(),
        nit: document.getElementById('nit').value.trim(),
        nombre_comercial: document.getElementById('nombreComercial').value.trim() || null,
        tipo_persona: document.getElementById('tipoPersona').value,
        telefono: document.getElementById('telefono').value.trim() || null,
        email: document.getElementById('email').value.trim() || null,
        direccion: document.getElementById('direccion').value.trim() || null,
        ciudad: document.getElementById('ciudad').value.trim() || null,
        sitio_web: document.getElementById('sitioWeb').value.trim() || null,
        dias_credito: parseInt(document.getElementById('diasCredito').value) || 30,
        metodo_pago_preferido: document.getElementById('metodoPago').value,
        banco: document.getElementById('banco').value.trim() || null,
        tipo_cuenta: document.getElementById('tipoCuenta').value || null,
        numero_cuenta: document.getElementById('numeroCuenta').value.trim() || null,
        contacto_nombre: document.getElementById('contactoNombre').value.trim() || null,
        contacto_cargo: document.getElementById('contactoCargo').value.trim() || null,
        contacto_telefono: document.getElementById('contactoTelefono').value.trim() || null,
        contacto_email: document.getElementById('contactoEmail').value.trim() || null,
        notas: document.getElementById('notas').value.trim() || null,
        activo: true
    };

    try {
        if (id) {
            await supabase.from('proveedores').update(datos).eq('id', id);
            mostrarNotificacion('✅ Proveedor actualizado', 'success');
        } else {
            await supabase.from('proveedores').insert(datos);
            mostrarNotificacion('✅ Proveedor creado', 'success');
        }

        cerrarModal();
        await cargarProveedores();

    } catch (error) {
        console.error('Error:', error);
        mostrarNotificacion('Error: ' + error.message, 'error');
    }
});

window.verCuentasPorPagar = function(proveedorId) {
    window.location.href = `cuentas-por-pagar.html?proveedor_id=${proveedorId}`;
}

window.cerrarModal = () => document.getElementById('modalProveedor').classList.remove('active');