// js/vehiculos.js
import { supabase } from './supabase-config.js';
import { DashboardBase } from './dashboards.js';
import { auth, protegerRuta } from './auth-system.js';
import { mostrarNotificacion, formatearFecha } from './utils.js';

const dash = new DashboardBase(['superadmin','jefe_taller','jefe_almacen']);

let vehiculos = [];
let clientes = [];

(async () => {
    if (!await protegerRuta([
        { modulo: 'vehiculos', accion: 'leer' }
    ])) return;

    await cargarClientes();
    await cargarVehiculos();
})();

async function cargarClientes() {
    const { data } = await supabase
        .from('clientes')
        .select('id, razon_social')
        .eq('activo', true)
        .order('razon_social');

    clientes = data || [];

    const select = document.getElementById('vehiculoCliente');
    const filtro = document.getElementById('filtroCliente');

    clientes.forEach(c => {
        const opt1 = document.createElement('option');
        opt1.value = c.id;
        opt1.textContent = c.razon_social;
        select.appendChild(opt1);

        const opt2 = document.createElement('option');
        opt2.value = c.id;
        opt2.textContent = c.razon_social;
        filtro.appendChild(opt2);
    });
}

async function cargarVehiculos() {
    const { data } = await supabase
        .from('vehiculos')
        .select('*, clientes(razon_social)')
        .order('placa');

    vehiculos = data || [];
    filtrarVehiculos();
}

window.filtrarVehiculos = function() {
    const busqueda = document.getElementById('buscarVehiculo').value.toLowerCase();
    const clienteId = document.getElementById('filtroCliente').value;

    let filtrados = vehiculos;

    if (busqueda) {
        filtrados = filtrados.filter(v =>
            v.placa?.toLowerCase().includes(busqueda) ||
            v.marca?.toLowerCase().includes(busqueda) ||
            v.linea?.toLowerCase().includes(busqueda) ||
            v.clientes?.razon_social?.toLowerCase().includes(busqueda)
        );
    }

    if (clienteId) {
        filtrados = filtrados.filter(v => v.cliente_id == clienteId);
    }

    dash.renderTabla('tablaVehiculos', [
        { key: 'placa', label: 'Placa' },
        { key: 'id', label: 'Cliente',
          render: r => r.clientes?.razon_social || 'N/A' },
        { key: 'marca', label: 'Marca' },
        { key: 'linea', label: 'Línea' },
        { key: 'modelo', label: 'Modelo' },
        { key: 'color', label: 'Color' },
        { key: 'tipo_vehiculo', label: 'Tipo' },
        { key: 'kilometraje', label: 'KM',
          render: r => r.kilometraje?.toLocaleString() || 'N/A' },
        { key: 'activo', label: 'Estado',
          render: r => `<span class="badge badge-${r.activo ? 'green' : 'danger'}">
              ${r.activo ? 'Activo' : 'Inactivo'}
          </span>` }
    ], filtrados, [
        { label: 'Editar', icono: '✏️', fn: 'editarVehiculo', tipo: 'primary' },
        { label: 'Historial', icono: '📋', fn: 'verHistorial', tipo: 'secondary' }
    ]);
}

window.abrirModalVehiculo = function(id = null) {
    document.getElementById('tituloModalVehiculo').textContent = id ? 'Editar Vehículo' : 'Nuevo Vehículo';
    document.getElementById('formVehiculo').reset();
    document.getElementById('vehiculoId').value = id || '';

    if (id) {
        const vehiculo = vehiculos.find(v => v.id === id);
        if (vehiculo) {
            document.getElementById('vehiculoCliente').value = vehiculo.cliente_id;
            document.getElementById('vehiculoPlaca').value = vehiculo.placa;
            document.getElementById('vehiculoTipo').value = vehiculo.tipo_vehiculo || 'automovil';
            document.getElementById('vehiculoMarca').value = vehiculo.marca || '';
            document.getElementById('vehiculoLinea').value = vehiculo.linea || '';
            document.getElementById('vehiculoModelo').value = vehiculo.modelo || '';
            document.getElementById('vehiculoColor').value = vehiculo.color || '';
            document.getElementById('vehiculoVin').value = vehiculo.vin || '';
            document.getElementById('vehiculoKilometraje').value = vehiculo.kilometraje || '';
            document.getElementById('vehiculoCombustible').value = vehiculo.tipo_combustible || '';
            document.getElementById('vehiculoObservaciones').value = vehiculo.observaciones || '';
        }
    }

    document.getElementById('modalVehiculo').classList.add('active');
}

window.editarVehiculo = abrirModalVehiculo;

window.verHistorial = (id) => {
    window.location.href = `historial-vehiculo.html?vehiculo_id=${id}`;
}

document.getElementById('formVehiculo').addEventListener('submit', async (e) => {
    e.preventDefault();

    const vehiculoId = document.getElementById('vehiculoId').value;
    const datos = {
        cliente_id: parseInt(document.getElementById('vehiculoCliente').value),
        placa: document.getElementById('vehiculoPlaca').value.trim().toUpperCase(),
        tipo_vehiculo: document.getElementById('vehiculoTipo').value,
        marca: document.getElementById('vehiculoMarca').value.trim() || null,
        linea: document.getElementById('vehiculoLinea').value.trim() || null,
        modelo: document.getElementById('vehiculoModelo').value || null,
        color: document.getElementById('vehiculoColor').value.trim() || null,
        vin: document.getElementById('vehiculoVin').value.trim() || null,
        kilometraje: document.getElementById('vehiculoKilometraje').value || null,
        tipo_combustible: document.getElementById('vehiculoCombustible').value || null,
        observaciones: document.getElementById('vehiculoObservaciones').value.trim() || null,
        activo: true
    };

    try {
        if (vehiculoId) {
            await supabase.from('vehiculos').update(datos).eq('id', vehiculoId);
            await auth.registrarAccion('actualizar_vehiculo', 'vehiculos', vehiculoId);
            mostrarNotificacion('✅ Vehículo actualizado', 'success');
        } else {
            await supabase.from('vehiculos').insert(datos);
            await auth.registrarAccion('crear_vehiculo', 'vehiculos');
            mostrarNotificacion('✅ Vehículo creado', 'success');
        }

        cerrarModalVehiculo();
        await cargarVehiculos();

    } catch (error) {
        console.error('Error:', error);
        mostrarNotificacion('Error: ' + error.message, 'error');
    }
});

window.cerrarModalVehiculo = () => document.getElementById('modalVehiculo').classList.remove('active');