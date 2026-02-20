// js/utils.js
export function formatearMoneda(valor) {
    if (valor === null || valor === undefined) return '$0';
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(valor);
}

export function formatearFecha(fecha) {
    if (!fecha) return 'N/A';
    try {
        return new Date(fecha).toLocaleDateString('es-CO', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    } catch {
        return 'N/A';
    }
}

export function formatearFechaHora(fecha) {
    if (!fecha) return 'N/A';
    try {
        return new Date(fecha).toLocaleString('es-CO', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return 'N/A';
    }
}

export function mostrarNotificacion(mensaje, tipo = 'info') {
    let container = document.getElementById('notificaciones-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notificaciones-container';
        container.style.cssText = `
            position: fixed;
            top: 70px;
            right: 20px;
            width: 350px;
            max-height: 80vh;
            overflow-y: auto;
            z-index: 9999;
            pointer-events: none;
        `;
        document.body.appendChild(container);
    }

    const colores = {
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
        info: '#3b82f6'
    };

    const iconos = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };

    const notif = document.createElement('div');
    notif.style.cssText = `
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        padding: 15px;
        margin-bottom: 10px;
        pointer-events: all;
        animation: slideIn 0.3s ease-out;
        border-left: 4px solid ${colores[tipo]};
        display: flex;
        align-items: center;
        gap: 10px;
    `;

    notif.innerHTML = `
        <span style="font-size: 20px;">${iconos[tipo]}</span>
        <span style="flex: 1; color: #1f2937; font-size: 14px;">${mensaje}</span>
        <button onclick="this.parentElement.remove()" 
                style="background: none; border: none; cursor: pointer; font-size: 18px; color: #9ca3af;">
            ×
        </button>
    `;

    container.insertBefore(notif, container.firstChild);

    setTimeout(() => {
        notif.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notif.remove(), 300);
    }, 5000);
}

if (!document.getElementById('notif-styles')) {
    const style = document.createElement('style');
    style.id = 'notif-styles';
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(400px);
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
                transform: translateX(400px);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
}

export function numeroALetras(numero) {
    const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
    const decenas = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
    const especiales = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
    const centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

    if (numero === 0) return 'CERO PESOS CON 00/100';
    if (numero === 100) return 'CIEN PESOS CON 00/100';

    const partes = numero.toFixed(2).split('.');
    const entero = parseInt(partes[0]);
    const decimal = parseInt(partes[1]);

    let letras = '';

    if (entero >= 1000000) {
        const millones = Math.floor(entero / 1000000);
        if (millones === 1) {
            letras += 'UN MILLÓN ';
        } else {
            letras += convertirGrupo(millones) + ' MILLONES ';
        }
    }

    const resto = entero % 1000000;
    if (resto >= 1000) {
        const miles = Math.floor(resto / 1000);
        if (miles === 1) {
            letras += 'MIL ';
        } else {
            letras += convertirGrupo(miles) + ' MIL ';
        }
    }

    const ultimos = entero % 1000;
    if (ultimos > 0) {
        letras += convertirGrupo(ultimos);
    }

    letras = letras.trim() + ' PESOS /COP ' ;

    return letras;

    function convertirGrupo(n) {
        if (n === 0) return '';
        
        let result = '';
        const c = Math.floor(n / 100);
        
        if (c > 0) {
            if (n === 100) return 'CIEN';
            result += centenas[c] + ' ';
        }
        
        const du = n % 100;
        if (du >= 10 && du < 20) {
            result += especiales[du - 10];
        } else {
            const d = Math.floor(du / 10);
            const u = du % 10;
            
            if (d > 0) {
                result += decenas[d];
                if (u > 0) result += ' Y ' + unidades[u];
            } else if (u > 0) {
                result += unidades[u];
            }
        }
        
        return result.trim();
    }
}

export function calcularIVA(valor, porcentaje = 19) {
    if (!valor || valor === 0) return 0;
    return valor * (porcentaje / 100);
}

export function calcularSubtotal(items) {
    if (!items || items.length === 0) return 0;
    return items.reduce((sum, item) => {
        const cantidad = parseFloat(item.cantidad) || 0;
        const precio = parseFloat(item.precio_unitario) || 0;
        return sum + (cantidad * precio);
    }, 0);
}

export function calcularTotal(subtotal, iva = 0) {
    return subtotal + iva;
}

export function calcularPrecioConIVA(precio, porcentaje = 19) {
    return precio * (1 + porcentaje / 100);
}

export function calcularPrecioSinIVA(precioConIVA, porcentaje = 19) {
    return precioConIVA / (1 + porcentaje / 100);
}

export function validarEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}

export function validarTelefono(telefono) {
    const regex = /^[0-9]{7,10}$/;
    return regex.test(telefono.replace(/\s/g, ''));
}

export function validarNIT(nit) {
    return nit && nit.length >= 5;
}

export function generarID() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

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