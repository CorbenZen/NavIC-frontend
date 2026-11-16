import { Mail, Pencil, Plus, Trash2, UserRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import { api } from '@services/api';
import { Avatar, Badge, Card, EmptyState, PageHeader } from '../../components/common';
import { Field, SearchInput } from '../../components/forms';
import { ConfirmDialog, Modal } from '../../components/modals';
import { ErrorBanner, LoadingBlock, useToast } from '../../components/feedback';
import { useFleet } from '@react/hooks/useFleet';

function emptyForm() {
  return { name: '', email: '', phone: '', license_number: '', active: true };
}

export function Drivers() {
  const { drivers, loading, error, refresh, refreshing } = useFleet();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return drivers.filter((driver) => {
      if (activeFilter === 'active' && !driver.active) return false;
      if (activeFilter === 'inactive' && driver.active) return false;
      if (activeFilter === 'assigned' && !driver.assigned_vehicles?.length) return false;
      if (!needle) return true;
      return [driver.name, driver.email, driver.phone, driver.license_number]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [drivers, query, activeFilter]);

  const openCreate = () => {
    setEditing({ id: null });
    setForm(emptyForm());
    setFormError('');
  };

  const openEdit = (driver) => {
    setEditing(driver);
    setForm({
      name: driver.name || '',
      email: driver.email || '',
      phone: driver.phone || '',
      license_number: driver.license_number || '',
      active: driver.active !== false,
    });
    setFormError('');
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    const payload = {
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || null,
      license_number: form.license_number.trim(),
      active: Boolean(form.active),
    };
    try {
      if (editing?.id) await api.updateDriver(editing.id, payload);
      else await api.createDriver(payload);
      toast.success(editing?.id ? 'Driver updated.' : 'Driver created.');
      setEditing(null);
      await refresh();
    } catch (saveError) {
      setFormError(saveError.message || 'Could not save the driver.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await api.deleteDriver(pendingDelete.id);
      toast.success('Driver deleted.');
      setPendingDelete(null);
      await refresh();
    } catch (deleteError) {
      toast.error(deleteError.message || 'Could not delete the driver.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Fleet management"
        title="Drivers"
        subtitle="Driver records used for vehicle assignment and reporting. Drivers assigned to vehicles cannot be deleted."
        actions={
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            <Plus /> Add driver
          </button>
        }
      />

      {error ? <ErrorBanner message={error} onRetry={refresh} /> : null}

      <Card actions={<span className="count">{filtered.length} of {drivers.length}</span>} flush>
        <div className="filter-bar">
          <SearchInput value={query} onChange={setQuery} placeholder="Search drivers…" ariaLabel="Search drivers" className="grow" />
          <select className="input" value={activeFilter} onChange={(event) => setActiveFilter(event.target.value)} aria-label="Filter drivers">
            <option value="all">All drivers</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
            <option value="assigned">Assigned to a vehicle</option>
          </select>
        </div>

        {loading && !drivers.length ? (
          <LoadingBlock label="Loading drivers…" />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Driver</th>
                  <th>Contact</th>
                  <th>Licence</th>
                  <th>Status</th>
                  <th>Assigned vehicles</th>
                  <th className="actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length ? (
                  filtered.map((driver) => (
                    <tr key={driver.id}>
                      <td>
                        <span className="row" style={{ gap: 9 }}>
                          <Avatar name={driver.name} className="driver-avatar" />
                          <span>
                            <span className="primary">{driver.name}</span>
                            <span className="secondary">Driver #{driver.id}</span>
                          </span>
                        </span>
                      </td>
                      <td>
                        <span className="primary" style={{ fontWeight: 500 }}>
                          <Mail size={12} style={{ verticalAlign: '-2px', marginRight: 4 }} />
                          {driver.email}
                        </span>
                        <span className="secondary">{driver.phone || 'No phone recorded'}</span>
                      </td>
                      <td className="mono">{driver.license_number}</td>
                      <td>{driver.active ? <Badge tone="success" dot>Active</Badge> : <Badge tone="neutral">Inactive</Badge>}</td>
                      <td>
                        {driver.assigned_vehicles?.length ? (
                          <span className="row wrap" style={{ gap: 4 }}>
                            {driver.assigned_vehicles.map((vehicle) => (
                              <Badge key={vehicle.id} tone="info">
                                {vehicle.registration_number}
                              </Badge>
                            ))}
                          </span>
                        ) : (
                          <Badge tone="neutral">None</Badge>
                        )}
                      </td>
                      <td className="actions">
                        <button type="button" className="btn btn-sm" onClick={() => openEdit(driver)}>
                          <Pencil /> Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          onClick={() => setPendingDelete(driver)}
                          disabled={Boolean(driver.assigned_vehicles?.length)}
                          title={driver.assigned_vehicles?.length ? 'Unassign this driver from all vehicles first' : 'Delete driver'}
                        >
                          <Trash2 />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState
                        icon={UserRound}
                        title={drivers.length ? 'No drivers match this filter' : 'No drivers registered'}
                        description={drivers.length ? 'Change the search or filter.' : 'Add a driver record before assigning it to a vehicle.'}
                        action={
                          !drivers.length ? (
                            <button type="button" className="btn btn-sm btn-primary" onClick={openCreate}>
                              <Plus /> Add driver
                            </button>
                          ) : null
                        }
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={Boolean(editing)}
        title={editing?.id ? 'Edit driver' : 'Add driver'}
        subtitle="The email address is the unique identifier for a driver account record."
        onClose={() => setEditing(null)}
        footer={
          <>
            <button type="button" className="btn" onClick={() => setEditing(null)} disabled={saving}>
              Cancel
            </button>
            <button type="submit" form="driver-form" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save driver'}
            </button>
          </>
        }
      >
        <form id="driver-form" className="form-grid" onSubmit={submit}>
          {formError ? <div className="form-error span-2">{formError}</div> : null}
          <Field label="Full name">
            <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </Field>
          <Field label="Email address" hint="Stored lowercase and must be unique.">
            <input type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </Field>
          <Field label="Phone number" hint="Optional. Shown to operators in vehicle views.">
            <input type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
          </Field>
          <Field label="Licence number">
            <input required value={form.license_number} onChange={(event) => setForm({ ...form, license_number: event.target.value })} />
          </Field>
          <label className="check span-2">
            <input type="checkbox" checked={Boolean(form.active)} onChange={(event) => setForm({ ...form, active: event.target.checked })} />
            Active driver — available for vehicle assignment and included in active-driver counts
          </label>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete driver?"
        message={pendingDelete ? `Delete ${pendingDelete.name}? This permanently removes the driver record. Drivers assigned to vehicles are blocked by the API.` : ''}
        busy={deleting}
        onCancel={() => setPendingDelete(null)}
        onConfirm={remove}
      />
    </>
  );
}
