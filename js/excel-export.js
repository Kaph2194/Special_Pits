// js/excel-export.js
export async function exportarAExcel(datos, nombreArchivo, nombreHoja) {
    try {
        if (!window.XLSX) {
            console.error('❌ Librería XLSX no cargada');
            return false;
        }

        // Crear libro
        const wb = window.XLSX.utils.book_new();
        
        // Crear hoja
        const ws = window.XLSX.utils.json_to_sheet(datos);
        
        // Agregar hoja al libro
        window.XLSX.utils.book_append_sheet(wb, ws, nombreHoja);
        
        // Generar archivo
        window.XLSX.writeFile(wb, `${nombreArchivo}_${Date.now()}.xlsx`);
        
        return true;
    } catch (error) {
        console.error('Error exportando Excel:', error);
        return false;
    }
}

// Función helper para preparar datos de tabla
export function prepararDatosParaExcel(datos, columnas) {
    return datos.map(fila => {
        const obj = {};
        columnas.forEach(col => {
            if (col.render) {
                // Si tiene función render personalizada, usar el valor original
                obj[col.label] = fila[col.key];
            } else {
                obj[col.label] = fila[col.key];
            }
        });
        return obj;
    });
}