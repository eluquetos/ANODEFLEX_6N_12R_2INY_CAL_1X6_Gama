# ANODEFLEX 3 + 3 nodos · Gama

Aplicación web instalable para calibrar y regular doce ramas ANODEFLEX distribuidas en seis nodos.

## Mediciones de campo

- Lado A: fuente `VA` → `Rc1` → nodo 1 → `Rc2` → nodo 2 → `Rc3` → nodo 3. Ramas `R11`, `R12`, `R21`, `R22`, `R31` y `R32`.
- Lado B: fuente `VB` → `Rc4` → nodo 4 → `Rc5` → nodo 5 → `Rc6` → nodo 6. Ramas `R41`, `R42`, `R51`, `R52`, `R61` y `R62`.

Cada lado se calibra de forma independiente con sus seis corrientes y sus tensiones de fuente y de nodo medidas con los reóstatos en `0 Ω`, referidas al mismo punto. La app calcula cada Rc como la caída de tensión del tramo dividida por su corriente; calcula cada resistencia fija como la tensión de su nodo dividida por su corriente. Rechaza tensiones de nodo que aumentan aguas abajo. Una caída de cero produce una resistencia de cable de cero.

## Regulación

Una sola fuente `V` alimenta los seis nodos desde el nodo 1. La corriente pasa por `Rc1` a `Rc6` en secuencia, con dos ramas en paralelo en cada nodo. El modelo usa Rc4, obtenido durante la medición B entre su fuente y el nodo 4, como resistencia del tramo entre los nodos 3 y 4 durante la regulación; compruebe que corresponda al cable físico reconectado. `V` es una entrada independiente de `VA` y `VB`.

La app calcula la tensión mínima y los reóstatos a partir de las doce corrientes objetivo, dejando al menos un reóstato en 0 Ω. La tensión y los reóstatos también pueden editarse manualmente. Indica cuando el ajuste supera el reóstato máximo y muestra corrientes, caídas, potencias y balances. Permite exportar e importar casos JSON e imprimir un informe.

## Pruebas y publicación

Desde la raíz del proyecto, ejecute `node tests/model.test.js`, `node tests/static.test.js` y `node tests/app.test.js`. GitHub Pages sirve los archivos de `docs/`. Después de la primera carga, la app puede instalarse y usar los archivos esenciales sin conexión.

En regulación, ingrese una corriente común y pulse «Aplicar a las 12 ramas». Después puede cambiar cada objetivo individualmente. El ajuste asistido calcula la tensión mínima y reemplaza los valores de los reóstatos.

Al abrir la aplicación todas las ramas están instaladas. Marque «no instalada» para cada rama ausente y recalcule. La rama no aporta corriente ni potencia y queda fuera del ajuste. Si un tramo no conduce corriente durante su medición, no se puede determinar su resistencia y la aplicación muestra un aviso. Los casos exportados conservan la selección.
