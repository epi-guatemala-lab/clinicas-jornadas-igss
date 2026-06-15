import { useApi } from '../../hooks/useApi';
import Field from './Field';

/**
 * Selects en cascada Departamento → Municipio (nomenclatura canónica GT).
 * Fuente: /api/catalogos/departamentos|municipios (22 deptos, ~340 municipios).
 *
 * props:
 *  - departamento, municipio: valores actuales
 *  - onChange(patch): recibe { departamento, municipio } parcial
 */
export default function GeoSelects({ departamento, municipio, onChange }) {
  const { data: deptos } = useApi('/api/catalogos/departamentos');
  const { data: munis } = useApi(
    '/api/catalogos/municipios',
    { departamento: departamento || '' },
    { enabled: !!departamento },
  );
  const deptoOpts = [['', '— Seleccione —'], ...((deptos?.items || []).map((d) => [d, d]))];
  const muniOpts = [
    ['', departamento ? '— Seleccione —' : '(elija departamento)'],
    ...((munis?.items || []).map((m) => [m, m])),
  ];
  return (
    <>
      <Field label="Departamento" type="select" value={departamento || ''}
             options={deptoOpts}
             onChange={(e) => onChange({ departamento: e.target.value, municipio: '' })} />
      <Field label="Municipio" type="select" value={municipio || ''}
             options={muniOpts}
             onChange={(e) => onChange({ municipio: e.target.value })} />
    </>
  );
}
