# Contrato de fidelidad — propuesta Index Condo 2026

## Referencia autoritativa

- Archivo: `public/templates/propuesta-index-condo-2026.docx`
- SHA-256: `513f8a48c93b77ec57a6cead10e75001c1e9acc1fb47069c136a88c74ea1ef68`
- Render verificado: 6 páginas, sin recortes, solapamientos ni cambios de paginación.
- Paquete: 20 partes OOXML. La generación conserva todas las partes y relaciones; solo modifica `word/document.xml`.
- Evidencia: 2 secciones, ambas carta vertical. Sección 1 con márgenes 0.76/0.76/0.69/0.69 pulgadas; sección 2 con 0.76/0.76/0.79/0.81 pulgadas.

## Sistema visual y patrones

- Portada: logo Index Condo centrado, títulos azul marino, subtítulo y reglas naranja, bloque de cliente centrado.
- Páginas interiores: encabezado con logo a la derecha; títulos numerados naranja/azul; pie con dirección, teléfonos, correo y web.
- Referencias: tabla de 4 filas por 3 columnas, encabezado azul, nombres azules, unidades naranja.
- Propuesta económica: tabla de 9 filas por 2 columnas, precio sobre fondo naranja claro.
- Cierre: pasos en 4 columnas, firma y logos Index Condo / Index Elemec.
- Imágenes: cuatro instancias (dos en línea y dos flotantes). Los anclajes y relaciones se preservan sin edición.
- No hay campos de Word ni controles de contenido.

## Mapa de campos editables

| Campo | Localizador estable | Regla |
|---|---|---|
| Cliente en portada | `word/document.xml`, párrafo 6 visible | Sustituir texto, conservar propiedades del primer run |
| Cliente en carta | `word/document.xml`, párrafo 14 visible | Sustituir texto completo y corregir la duplicación heredada de “Residencial” |
| Fecha | Texto `29 de julio de 2026`, dos ocurrencias | Sustituir ambas con fecha larga en español |
| Honorarios | Tabla 3 visual, fila 8; texto numérico `36,000.00` | Sustituir solo el número; conservar `RD$` y `/ mes` |
| Referencias | Tabla 2 visual, filas 2–4; columnas Condominio, Ubicación y Unidades | Sustituir los nueve valores; deben ser exactamente tres referencias aprobadas |

## Contenido preservado

Se conservan sin cambios: textos institucionales, alcance, Condofácil, encabezados, pies, condiciones, vigencia, próximos pasos, firma, imágenes, estilos, numeración, tema, fuentes, geometría de tablas y todas las relaciones. El generador trabaja sobre una copia en memoria y nunca sobrescribe el archivo maestro.

## Puertas de fidelidad

1. El SHA-256 del maestro debe coincidir antes de generar.
2. El resultado debe conservar las mismas 20 partes OOXML.
3. Solo `word/document.xml` puede diferir.
4. Debe mantener 6 páginas después de sustituir valores de longitud representativa.
5. Se debe renderizar y revisar visualmente una propuesta generada antes de publicar una nueva versión del generador.
