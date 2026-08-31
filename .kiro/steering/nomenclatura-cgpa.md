---
inclusion: always
---

# Convención de nomenclatura: CGPA vs CPA

En este proyecto la sigla del Centro de Padres se muestra al usuario como
**CGPA**. Antiguamente se usaba "CPA" en el contenido visible; ese texto ya fue
migrado a "CGPA".

## Regla

- **Contenido visible al usuario → usar "CGPA".**
  Aplica a: títulos de pestaña (`<title>`), encabezados, párrafos, labels de
  menú, textos de botones, opciones de `<select>`, badges, mensajes de
  `alert`/`confirm`, atributos visibles (`alt`, `placeholder`, `aria-label`),
  asignaciones a `textContent`/`innerHTML` que se renderizan, glosas de pago que
  ve el usuario (p. ej. `'Cuota CGPA'`) y textos que aparecen en la pasarela de
  pago (título del ítem, `statement_descriptor`).

- **Identificadores de código → conservar "cpa" / "CPA".**
  NO renombrar: nombres de archivo y URLs (`pagos_cpa.html`,
  `estado_cpa_curso.html`), propiedades de datos y de BD (`cuota_cpa`,
  `cpa_pagado`), IDs de elementos (`estado-cuota-cpa`, `chk-cpa`,
  `edit-cuota-cpa`), variables y funciones JS (`cargarEstadoCPA`,
  `_puedeEditarCPA`, `tieneCuotaCpaPagada`, `esCompromisoCpa`), endpoints
  (`/api/actualizar_cuota_cpa`, `/api/estado_cpa_curso`) ni las claves de los
  mapas de glosas (`'cuota_cpa'`).

## Dependencia importante en pagos

La glosa visible está acoplada a la detección de pagos en `src/server.js`. Al
confirmar un pago se evalúa:

```js
cuota_cpa: result.subject === 'cuota_cpa'
  || result.subject === 'Cuota CPA'    // pagos históricos
  || result.subject === 'Cuota CGPA',  // pagos nuevos
```

Si se cambia la glosa visible (`subjectMap` / `glosaMap`), mantener también aquí
la comparación con el valor histórico `'Cuota CPA'` para no romper la detección
de pagos ya realizados.

## Pendiente / excepciones conocidas

- `src/server_example.js` (`subject: "Pago de Cuota CPA"`): archivo de ejemplo,
  no se usa en producción. Se dejó sin migrar.
- Comentarios de código, `console.log` y bloques comentados que mencionan "CPA"
  no se migran porque no son visibles al usuario.
