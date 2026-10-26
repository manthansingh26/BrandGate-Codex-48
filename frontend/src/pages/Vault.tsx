import React, { useEffect, useState } from 'react';
import { Brand, GroupedVault, VaultItem } from '../types';
import { api } from '../api/client';
import { Plus, RefreshCw, Trash2, Edit2, Check, X, Palette, BookOpen } from 'lucide-react';

interface VaultProps {
  activeBrand: Brand | null;
}

export const Vault: React.FC<VaultProps> = ({ activeBrand }) => {
  const [vault, setVault] = useState<GroupedVault>({ fact: [], rule: [], terminology: [], palette: [] });
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New Item State
  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState<{
    item_id: string;
    kind: 'fact' | 'rule' | 'terminology' | 'palette';
    title: string;
    text: string;
  }>({
    item_id: '',
    kind: 'fact',
    title: '',
    text: '',
  });

  // Edit Item State
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const brandId = activeBrand?.id || '00000000-0000-0000-0000-000000000001';

  const fetchVault = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getVault(brandId);
      setVault(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load vault items');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVault();
  }, [brandId]);

  const handleResetDemo = async () => {
    if (!window.confirm('Reset demo vault back to Phase 1 defaults?')) return;
    setResetting(true);
    try {
      await api.resetDemoVault(brandId);
      await fetchVault();
    } catch (err: any) {
      setError(err.message || 'Failed to reset demo vault');
    } finally {
      setResetting(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.item_id.trim() || !newItem.title.trim() || !newItem.text.trim()) return;

    try {
      await api.createVaultItem(brandId, {
        ...newItem,
        status: 'active',
      });
      setIsAdding(false);
      setNewItem({ item_id: '', kind: 'fact', title: '', text: '' });
      await fetchVault();
    } catch (err: any) {
      setError(err.message || 'Failed to create vault item');
    }
  };

  const handleSaveEdit = async (itemId: string) => {
    try {
      await api.updateVaultItem(brandId, itemId, { text: editText });
      setEditingItemId(null);
      await fetchVault();
    } catch (err: any) {
      setError(err.message || 'Failed to update vault item');
    }
  };

  const handleDelete = async (itemId: string) => {
    if (!window.confirm(`Delete vault item ${itemId}?`)) return;
    try {
      await api.deleteVaultItem(brandId, itemId);
      await fetchVault();
    } catch (err: any) {
      setError(err.message || 'Failed to delete vault item');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-6 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-teal-400" />
            Brand Vault
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Ground-truth rules, facts, terminology, and palettes for{' '}
            <span className="text-white font-medium">{activeBrand?.name || 'Demo Brand (Seeded)'}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-black font-semibold text-sm transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Item
          </button>
          <button
            onClick={handleResetDemo}
            disabled={resetting}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 text-sm font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${resetting ? 'animate-spin' : ''}`} />
            Reset Demo Vault
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-3 rounded-lg bg-red-950/40 border border-red-900 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Add Item Form */}
      {isAdding && (
        <form onSubmit={handleCreate} className="mb-8 p-6 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4">
          <h3 className="text-lg font-bold text-white">Add New Vault Item</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Item ID</label>
              <input
                type="text"
                placeholder="e.g. F-15, R-10"
                value={newItem.item_id}
                onChange={(e) => setNewItem({ ...newItem, item_id: e.target.value })}
                className="w-full px-3 py-2 bg-black border border-zinc-700 rounded-lg text-white text-sm focus:border-teal-500 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Kind</label>
              <select
                value={newItem.kind}
                onChange={(e) => setNewItem({ ...newItem, kind: e.target.value as any })}
                className="w-full px-3 py-2 bg-black border border-zinc-700 rounded-lg text-white text-sm focus:border-teal-500 focus:outline-none"
              >
                <option value="fact">Fact</option>
                <option value="rule">Rule</option>
                <option value="terminology">Terminology</option>
                <option value="palette">Palette</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Title</label>
              <input
                type="text"
                placeholder="Brief summary"
                value={newItem.title}
                onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                className="w-full px-3 py-2 bg-black border border-zinc-700 rounded-lg text-white text-sm focus:border-teal-500 focus:outline-none"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Content Text</label>
            <textarea
              placeholder="Full rule, fact specification, or hex code"
              value={newItem.text}
              onChange={(e) => setNewItem({ ...newItem, text: e.target.value })}
              className="w-full px-3 py-2 bg-black border border-zinc-700 rounded-lg text-white text-sm focus:border-teal-500 focus:outline-none h-20"
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-sm hover:bg-zinc-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-teal-500 text-black font-semibold text-sm hover:bg-teal-400"
            >
              Save Item
            </button>
          </div>
        </form>
      )}

      {/* Vault Categories */}
      {loading ? (
        <div className="text-center py-20 text-zinc-500">Loading vault items...</div>
      ) : (
        <div className="space-y-12">
          {/* Facts Section */}
          <section>
            <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4 border-b border-zinc-800/60 pb-2">
              <span className="h-2 w-2 rounded-full bg-teal-400"></span>
              Approved Facts ({vault.fact.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {vault.fact.map((item) => (
                <VaultCard
                  key={item.item_id}
                  item={item}
                  editingItemId={editingItemId}
                  editText={editText}
                  setEditingItemId={setEditingItemId}
                  setEditText={setEditText}
                  onSave={handleSaveEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </section>

          {/* Rules Section */}
          <section>
            <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4 border-b border-zinc-800/60 pb-2">
              <span className="h-2 w-2 rounded-full bg-blue-400"></span>
              Governance Rules ({vault.rule.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {vault.rule.map((item) => (
                <VaultCard
                  key={item.item_id}
                  item={item}
                  editingItemId={editingItemId}
                  editText={editText}
                  setEditingItemId={setEditingItemId}
                  setEditText={setEditText}
                  onSave={handleSaveEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </section>

          {/* Terminology Section */}
          <section>
            <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4 border-b border-zinc-800/60 pb-2">
              <span className="h-2 w-2 rounded-full bg-amber-400"></span>
              Terminology & Claims ({vault.terminology.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {vault.terminology.map((item) => (
                <VaultCard
                  key={item.item_id}
                  item={item}
                  editingItemId={editingItemId}
                  editText={editText}
                  setEditingItemId={setEditingItemId}
                  setEditText={setEditText}
                  onSave={handleSaveEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </section>

          {/* Palette Section */}
          <section>
            <div className="flex items-center justify-between mb-4 border-b border-zinc-800/60 pb-2">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Palette className="h-5 w-5 text-purple-400" />
                Brand Color Palette ({vault.palette.length})
              </h2>
              <span className="text-xs text-zinc-500">Palette checking: Approximate</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {vault.palette.map((item) => {
                const hexMatch = item.text.match(/#[0-9A-Fa-f]{6}/);
                const hex = hexMatch ? hexMatch[0] : '#333333';
                return (
                  <div
                    key={item.item_id}
                    className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col justify-between"
                  >
                    <div>
                      <div className="h-16 w-full rounded-lg mb-3 shadow-inner border border-white/10" style={{ backgroundColor: hex }}></div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold text-teal-400">{item.item_id}</span>
                        <span className="text-xs font-mono text-zinc-400">{hex}</span>
                      </div>
                      <div className="text-sm font-semibold text-white mt-1">{item.title}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

interface VaultCardProps {
  item: VaultItem;
  editingItemId: string | null;
  editText: string;
  setEditingItemId: (id: string | null) => void;
  setEditText: (txt: string) => void;
  onSave: (id: string) => void;
  onDelete: (id: string) => void;
}

const VaultCard: React.FC<VaultCardProps> = ({
  item,
  editingItemId,
  editText,
  setEditingItemId,
  setEditText,
  onSave,
  onDelete,
}) => {
  const isEditing = editingItemId === item.item_id;

  return (
    <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 transition-all flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-teal-400 text-xs font-mono font-bold">
            {item.item_id}
          </span>
          <div className="flex items-center gap-1">
            {!isEditing ? (
              <>
                <button
                  onClick={() => {
                    setEditingItemId(item.item_id);
                    setEditText(item.text);
                  }}
                  className="p-1 text-zinc-400 hover:text-white"
                  title="Edit text"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => onDelete(item.item_id)}
                  className="p-1 text-zinc-500 hover:text-red-400"
                  title="Delete item"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => onSave(item.item_id)}
                  className="p-1 text-teal-400 hover:text-teal-300"
                  title="Save changes"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setEditingItemId(null)}
                  className="p-1 text-zinc-400 hover:text-white"
                  title="Cancel"
                >
                  <X className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </div>

        <h4 className="text-sm font-bold text-white mb-2">{item.title}</h4>

        {isEditing ? (
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="w-full p-2 bg-black border border-zinc-700 rounded text-xs text-white h-20 focus:outline-none focus:border-teal-500 font-sans"
          />
        ) : (
          <p className="text-xs text-zinc-400 leading-relaxed">{item.text}</p>
        )}
      </div>
    </div>
  );
};
