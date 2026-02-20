// js/search-global.js
import { supabase } from './supabase-config.js';
import { formatearMoneda, formatearFecha } from './utils.js';

export class BusquedaGlobal {
    static async buscar(termino) {
        if (!termino || termino.length < 2) return [];

        const resultados = [];
        const busqueda = termino.toLowerCase();

        try {
            // Buscar en clientes
            const { data: clientes } = await supabase
                .from('clientes')
                .select('id, razon_social, nit, telefono')
                .or(`razon_social.ilike.%${busqueda}%,nit.ilike.%${busqueda}%`)
                .limit(5);

            if (clientes) {
                clientes.forEach(c => {
                    resultados.push({
                        tipo: 'cliente',
                        icono: '🏢',
                        titulo: c.razon_social,
                        subtitulo: `NIT: ${c.nit}`,
                        url: `admin-dashboard.html#cliente-${c.id}`
                    });
                });
            }

            // Buscar en vehículos
            const { data: vehiculos } = await supabase
                .from('vehiculos')
                .select('id, placa, marca, linea, clientes(razon_social)')
                .or(`placa.ilike.%${busqueda}%,marca.ilike.%${busqueda}%`)
                .limit(5);

            if (vehiculos) {
                vehiculos.forEach(v => {
                    resultados.push({
                        tipo: 'vehiculo',
                        icono: '🚗',
                        titulo: `${v.placa} - ${v.marca} ${v.linea}`,
                        subtitulo: v.clientes?.razon_social || 'Sin cliente',
                        url: `historial-vehiculo.html?vehiculo_id=${v.id}`
                    });
                });
            }

            // Buscar en OTs
            const { data: ots } = await supabase
                .from('ordenes_trabajo')
                .select('id, numero_ot, estado, total, vehiculos(placa)')
                .or(`numero_ot.ilike.%${busqueda}%`)
                .limit(5);

            if (ots) {
                ots.forEach(ot => {
                    resultados.push({
                        tipo: 'ot',
                        icono: '🔧',
                        titulo: ot.numero_ot,
                        subtitulo: `${ot.vehiculos?.placa} - ${ot.estado} - ${formatearMoneda(ot.total)}`,
                        url: `taller-dashboard.html#ot-${ot.id}`
                    });
                });
            }

            // Buscar en repuestos
            const { data: repuestos } = await supabase
                .from('repuestos')
                .select('id, codigo, nombre, stock_actual, precio_venta')
                .or(`codigo.ilike.%${busqueda}%,nombre.ilike.%${busqueda}%`)
                .eq('activo', true)
                .limit(5);

            if (repuestos) {
                repuestos.forEach(r => {
                    resultados.push({
                        tipo: 'repuesto',
                        icono: '🔩',
                        titulo: `${r.codigo} - ${r.nombre}`,
                        subtitulo: `Stock: ${r.stock_actual} - ${formatearMoneda(r.precio_venta)}`,
                        url: `almacen-dashboard.html#repuesto-${r.id}`
                    });
                });
            }

            return resultados;

        } catch (error) {
            console.error('Error en búsqueda:', error);
            return [];
        }
    }

    static mostrarBuscador() {
        const buscadorHTML = `
            <div class="modal" style="display:flex;" id="modalBusquedaGlobal" onclick="if(event.target===this) cerrarBusquedaGlobal()">
                <div class="modal-content" style="max-width:700px;margin-top:50px;">
                    <div style="position:sticky;top:0;background:white;padding-bottom:1rem;border-bottom:2px solid var(--gray-200);">
                        <h2 style="margin-bottom:1rem;">🔍 Búsqueda Global</h2>
                        <input type="text" 
                               id="inputBusquedaGlobal" 
                               class="form-control" 
                               placeholder="Buscar clientes, vehículos, OTs, repuestos..."
                               autofocus
                               style="font-size:1.1rem;padding:1rem;">
                        <small style="color:var(--gray-700);margin-top:.5rem;display:block;">
                            Presione ESC para cerrar | Enter para ir al primer resultado
                        </small>
                    </div>
                    
                    <div id="resultadosBusqueda" style="margin-top:1rem;max-height:500px;overflow-y:auto;">
                        <p style="text-align:center;color:var(--gray-700);padding:3rem;">
                            Ingrese al menos 2 caracteres para buscar...
                        </p>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', buscadorHTML);

        const input = document.getElementById('inputBusquedaGlobal');
        let timeoutBusqueda;

        input.addEventListener('input', (e) => {
            clearTimeout(timeoutBusqueda);
            const termino = e.target.value.trim();

            if (termino.length < 2) {
                document.getElementById('resultadosBusqueda').innerHTML = `
                    <p style="text-align:center;color:var(--gray-700);padding:3rem;">
                        Ingrese al menos 2 caracteres para buscar...
                    </p>
                `;
                return;
            }

            // Mostrar loading
            document.getElementById('resultadosBusqueda').innerHTML = `
                <div style="text-align:center;padding:3rem;">
                    <div style="font-size:3rem;margin-bottom:1rem;">⏳</div>
                    <p style="color:var(--gray-700);">Buscando...</p>
                </div>
            `;

            // Buscar con delay
            timeoutBusqueda = setTimeout(async () => {
                const resultados = await BusquedaGlobal.buscar(termino);
                BusquedaGlobal.renderizarResultados(resultados);
            }, 300);
        });

        // Atajos de teclado
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                cerrarBusquedaGlobal();
            } else if (e.key === 'Enter') {
                const primerLink = document.querySelector('#resultadosBusqueda a');
                if (primerLink) {
                    window.location.href = primerLink.href;
                }
            }
        });
    }

    static renderizarResultados(resultados) {
        const container = document.getElementById('resultadosBusqueda');

        if (resultados.length === 0) {
            container.innerHTML = `
                <div style="text-align:center;padding:3rem;">
                    <div style="font-size:3rem;margin-bottom:1rem;">🔍</div>
                    <p style="color:var(--gray-700);">No se encontraron resultados</p>
                </div>
            `;
            return;
        }

        // Agrupar por tipo
        const agrupados = {};
        resultados.forEach(r => {
            if (!agrupados[r.tipo]) agrupados[r.tipo] = [];
            agrupados[r.tipo].push(r);
        });

        const tiposLabel = {
            cliente: 'Clientes',
            vehiculo: 'Vehículos',
            ot: 'Órdenes de Trabajo',
            repuesto: 'Repuestos'
        };

        const html = Object.entries(agrupados).map(([tipo, items]) => `
            <div style="margin-bottom:1.5rem;">
                <h3 style="color:var(--primary);margin-bottom:.75rem;">${tiposLabel[tipo] || tipo}</h3>
                ${items.map(item => `
                    <a href="${item.url}" 
                       style="display:flex;align-items:center;gap:1rem;padding:1rem;
                              background:white;border:1px solid var(--gray-200);
                              border-radius:.5rem;margin-bottom:.5rem;text-decoration:none;
                              transition:all .2s;"
                       onmouseover="this.style.background='var(--gray-50)';this.style.borderColor='var(--primary)';"
                       onmouseout="this.style.background='white';this.style.borderColor='var(--gray-200)';">
                        <div style="font-size:2rem;">${item.icono}</div>
                        <div style="flex:1;">
                            <strong style="color:var(--gray-900);display:block;margin-bottom:.25rem;">
                                ${item.titulo}
                            </strong>
                            <small style="color:var(--gray-700);">${item.subtitulo}</small>
                        </div>
                        <div style="color:var(--primary);">→</div>
                    </a>
                `).join('')}
            </div>
        `).join('');

        container.innerHTML = html;
    }
}

window.abrirBusquedaGlobal = () => BusquedaGlobal.mostrarBuscador();

window.cerrarBusquedaGlobal = () => {
    document.getElementById('modalBusquedaGlobal')?.remove();
}

// Atajo global: Ctrl/Cmd + K para abrir búsqueda
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        BusquedaGlobal.mostrarBuscador();
    }
});