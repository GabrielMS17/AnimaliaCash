import { useMemo, useState } from 'react';
import InsumoModal, { CATEGORY_OPTIONS, describePackage } from '../components/InsumoModal';
import { CATEGORY_DOT, SectionHeader, Segmented } from '../components/ui';
import { useData } from '../store/DataContext';
import { formatUnitCost, getCategoryLabel } from '../utils/costCalculations';

const FILTERS = [{ value: 'todos', label: 'Todos' }, ...CATEGORY_OPTIONS];

export default function Insumos() {
  const { insumos, procedures, saveInsumo, deleteInsumo } = useData();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('todos');
  const [editing, setEditing] = useState(null); // null = fechado, {} = novo, insumo = edição

  // Quantos procedimentos usam cada insumo
  const usageCount = useMemo(() => {
    const map = new Map();
    procedures.forEach((procedure) => {
      new Set(procedure.items.map((item) => item.insumoId)).forEach((id) => map.set(id, (map.get(id) || 0) + 1));
    });
    return map;
  }, [procedures]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return insumos
      .filter((insumo) => category === 'todos' || insumo.category === category)
      .filter((insumo) => !query || insumo.name.toLowerCase().includes(query) || (insumo.notes ?? '').toLowerCase().includes(query))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [insumos, search, category]);

  const handleDelete = (insumo) => {
    const count = usageCount.get(insumo.id) || 0;
    const message = count > 0
      ? `"${insumo.name}" é usado em ${count} procedimento(s). Deseja realmente excluí-lo?`
      : `Deseja excluir "${insumo.name}"?`;
    if (window.confirm(message)) deleteInsumo(insumo.id);
  };

  return (
    <>
      <SectionHeader
        title="Insumos"
        description="Materiais e medicamentos com custo unitário. Alterar um custo recalcula todos os procedimentos que o utilizam."
        action={<button type="button" className="btn btn-primary" onClick={() => setEditing({})}>+ Novo insumo</button>}
      />

      <div className="filters">
        <Segmented label="Filtrar por categoria" options={FILTERS} value={category} onChange={setCategory} />
        <input type="search" aria-label="Buscar insumo" placeholder="Buscar insumo" value={search} onChange={(event) => setSearch(event.target.value)} />
      </div>

      <p className="count">{filtered.length} de {insumos.length} insumos</p>

      <div className="list-card">
        {filtered.map((insumo) => {
          const count = usageCount.get(insumo.id) || 0;
          const pkg = describePackage(insumo);
          return (
            <div key={insumo.id} className="list-row">
              <div className="list-main">
                <strong>{insumo.name}</strong>
                {insumo.notes && <small>{insumo.notes}</small>}
                <small className="category-line">
                  <i className="dot" style={{ background: CATEGORY_DOT[insumo.category] }} />
                  {getCategoryLabel(insumo.category)} · {count === 0 ? 'não usado' : `usado em ${count} ${count === 1 ? 'procedimento' : 'procedimentos'}`}
                </small>
              </div>
              <div className="list-cost">
                <strong>{formatUnitCost(insumo.costPerUnit)}<span> / {insumo.unit}</span></strong>
                {pkg && <small>{pkg}</small>}
              </div>
              <div className="list-actions">
                <button type="button" className="btn btn-secondary btn-small" onClick={() => setEditing(insumo)}>Editar</button>
                <button type="button" className="btn btn-danger btn-small" onClick={() => handleDelete(insumo)}>Excluir</button>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <p className="empty-text">Nenhum insumo encontrado.</p>}
      </div>

      {editing && (
        <InsumoModal
          insumo={editing.id ? editing : null}
          onClose={() => setEditing(null)}
          onSave={(saved) => {
            saveInsumo(saved);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}
