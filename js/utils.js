// js/utils.js

// ============================================
// FORMATEAR MONEDA (COP - Pesos Colombianos)
// ============================================
export function formatearMoneda(valor) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(valor || 0);
}

// ============================================
// FORMATEAR FECHA
// ============================================
export function formatearFecha(fecha) {
    if (!fecha) return '';
    const date = new Date(fecha);
    return date.toLocaleDateString('es-CO', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

export function formatearFechaHora(fecha) {
    if (!fecha) return '';
    const date = new Date(fecha);
    return date.toLocaleString('es-CO', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// ============================================
// CONVERTIR NÚMERO A LETRAS (Pesos Colombianos)
// ============================================
export function numeroALetras(numero) {
    const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
    const decenas = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
    const especiales = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
    const centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

    if (numero === 0) return 'CERO PESOS M/CTE';
    if (numero < 0) return 'NÚMERO NEGATIVO';

    let entero = Math.floor(numero);
    let resultado = '';

    // Millones
    if (entero >= 1000000) {
        let millones = Math.floor(entero / 1000000);
        if (millones === 1) {
            resultado += 'UN MILLÓN ';
        } else {
            resultado += convertirGrupo(millones) + ' MILLONES ';
        }
        entero = entero % 1000000;
    }

    // Miles
    if (entero >= 1000) {
        let miles = Math.floor(entero / 1000);
        if (miles === 1) {
            resultado += 'MIL ';
        } else {
            resultado += convertirGrupo(miles) + ' MIL ';
        }
        entero = entero % 1000;
    }

    // Centenas, decenas y unidades
    if (entero > 0) {
        resultado += convertirGrupo(entero);
    }

    return resultado.trim() + ' PESOS M/CTE';

    function convertirGrupo(num) {
        let texto = '';
        
        // Centenas
        let c = Math.floor(num / 100);
        if (c > 0) {
            if (num === 100) {
                texto += 'CIEN ';
            } else {
                texto += centenas[c] + ' ';
            }
            num = num % 100;
        }

        // Decenas y unidades
        if (num >= 10 && num < 20) {
            texto += especiales[num - 10] + ' ';
        } else {
            let d = Math.floor(num / 10);
            let u = num % 10;
            
            if (d > 0) {
                if (d === 2 && u > 0) {
                    texto += 'VEINTI' + unidades[u] + ' ';
                } else {
                    texto += decenas[d] + ' ';
                    if (u > 0) {
                        texto += 'Y ' + unidades[u] + ' ';
                    }
                }
            } else if (u > 0) {
                texto += unidades[u] + ' ';
            }
        }

        return texto.trim();
    }
}

// ============================================
// VALIDAR EMAIL
// ============================================
export function validarEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}

// ============================================
// VALIDAR NIT/CÉDULA
// ============================================
export function validarNIT(nit) {
    if (!nit) return false;
    // Remover puntos y guiones
    nit = nit.replace(/[.-]/g, '');
    return nit.length >= 6 && nit.length <= 15;
}

// ============================================
// GENERAR CÓDIGO ALEATORIO
// ============================================
export function generarCodigo(prefijo = '', longitud = 6) {
    const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let resultado = prefijo;
    for (let i = 0; i < longitud; i++) {
        resultado += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
    }
    return resultado;
}

// ============================================
// CALCULAR IVA
// ============================================
export function calcularIVA(valor, porcentaje = 0.19) {
    return valor * porcentaje;
}

// ============================================
// CALCULAR PRECIO CON MARGEN
// ============================================
export function calcularPrecioVenta(costo, margen) {
    if (margen >= 1) margen = 0.5; // Máximo 50%
    if (margen <= 0) return costo;
    return Math.round(costo / (1 - margen));
}

// ============================================
// MOSTRAR NOTIFICACIÓN
// ============================================
export function mostrarNotificacion(mensaje, tipo = 'info') {
    // Crear contenedor si no existe
    let contenedor = document.getElementById('notificaciones');
    if (!contenedor) {
        contenedor = document.createElement('div');
        contenedor.id = 'notificaciones';
        contenedor.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            max-width: 400px;
        `;
        document.body.appendChild(contenedor);
    }

    // Crear notificación
    const notif = document.createElement('div');
    notif.className = `alert alert-${tipo}`;
    notif.style.cssText = `
        margin-bottom: 10px;
        animation: slideIn 0.3s ease-out;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    `;
    notif.innerHTML = mensaje;

    contenedor.appendChild(notif);

    // Auto-eliminar después de 5 segundos
    setTimeout(() => {
        notif.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notif.remove(), 300);
    }, 5000);
}

// ============================================
// CONFIRMAR ACCIÓN
// ============================================
export function confirmar(mensaje) {
    return confirm(mensaje);
}

// ============================================
// DEBOUNCE (Para búsquedas)
// ============================================
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ============================================
// ESCAPAR HTML (Prevenir XSS)
// ============================================
export function escaparHTML(texto) {
    const div = document.createElement('div');
    div.textContent = texto;
    return div.innerHTML;
}

// ============================================
// AGREGAR ESTILOS DE ANIMACIÓN
// ============================================
const styles = document.createElement('style');
styles.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(styles);