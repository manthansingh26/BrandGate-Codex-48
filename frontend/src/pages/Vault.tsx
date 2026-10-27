import React, { useEffect, useState } from 'react';
import { Brand, GroupedVault, VaultItem } from '../types';
import { api } from '../api/client';
import { Plus, RefreshCw, Trash2, Edit2, Check, X, Palette, BookOpen, Search, Copy, CheckCircle2, Info } from 'lucide-react';

interface VaultProps {
  activeBrand: Brand | null;
  currentUserEmail?: string | null;
}

export const Vault: React.FC<VaultProps> = ({ activeBrand, currentUserEmail }) => {
  const isGuest = !currentUserEmail;
  const [vault, setVault] = useState<GroupedVault>({ fact: [], rule: [], terminology: [], palette: [] });
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'fact' | 'rule' | 'terminology' | 'palette'>('all');
  const [copiedHex, setCopiedHex] = useState<string | null>(null);

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

  const handleCopyHex = (hex: string) => {
    navigator.clipboard.writeText(hex);
    setCopiedHex(hex);
    setTimeout(() => setCopiedHex(null), 2000);
  };

  const filterList = (items: VaultItem[]) => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(
      (item) =>
        item.item_id.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q) ||
        item.text.toLowerCase().includes(q)
    );
  };

  const filteredFacts = filterList(vault.fact);
  const filteredRules = filterList(vault.rule);
  const filteredTerminology = filterList(vault.terminology);
  const filteredPalette = filterList(vault.palette);
  const totalCount = vault.fact.length + vault.rule.length + vault.terminology.length + vault.palette.length;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-900 border border-zinc-800 text-teal-400">
              Ground-Truth Store
            </span>
            <span className="text-xs text-zinc-500 font-mono">
              PostgreSQL Active Records
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-teal-400" />
            Brand Vault
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Ground-truth rules, facts, terminology, and palettes for{' '}
            <span className="text-white font-medium">{activeBrand?.name || 'Demo Brand (Seeded)'}</span>
          </p>
        </div>

        {isGuest ? (
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-400">
            <Info className="h-4 w-4 text-teal-400 flex-shrink-0" />
            <span>Guest demo: vault is read-only. Sign in to manage a brand vault.</span>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsAdding(!isAdding)}
              className="btn-primary-micro inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-teal-400 hover:bg-teal-300 text-black font-bold text-sm shadow-md shadow-teal-500/20"
            >
              <Plus className="h-4 w-4" />
              Add Item
            </button>
            <button
              onClick={handleResetDemo}
              disabled={resetting}
              className="btn-secondary-micro inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 text-sm font-semibold disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${resetting ? 'animate-spin' : ''}`} />
              Reset Demo Vault
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-900 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Category Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-zinc-950/80 rounded-xl border border-zinc-800">
          {[
            { id: 'all', label: 'All Items', count: totalCount },
            { id: 'fact', label: 'Facts', count: vault.fact.length },
            { id: 'rule', label: 'Rules', count: vault.rule.length },
            { id: 'terminology', label: 'Terminology', count: vault.terminology.length },
            { id: 'palette', label: 'Palette', count: vault.palette.length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedCategory(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:outline-none ${
                selectedCategory === tab.id
                  ? 'bg-teal-500 text-black shadow-sm font-bold'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  selectedCategory === tab.id ? 'bg-black/20 text-black' : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Quick Search */}
        <div className="relative min-w-[240px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search vault rules or IDs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-black border border-zinc-800 rounded-xl text-white text-xs placeholder:text-zinc-500 focus:border-teal-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Add Item Form Modal */}
      {!isGuest && isAdding && (
        <form onSubmit={handleCreate} className="glass-card p-6 sm:p-7 rounded-2xl border border-teal-500/30 space-y-4 shadow-2xl">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Plus className="h-4 w-4 text-teal-400" />
              Add New Vault Item
            </h3>
            <span className="text-xs text-zinc-400">Strictly validated against brand schema</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Item ID</label>
              <input
                type="text"
                placeholder="e.g. F-15, R-10, T-05"
                value={newItem.item_id}
                onChange={(e) => setNewItem({ ...newItem, item_id: e.target.value })}
                className="w-full px-3 py-2 bg-black border border-zinc-700 rounded-xl text-white text-sm focus:border-teal-500 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Kind</label>
              <select
                value={newItem.kind}
                onChange={(e) => setNewItem({ ...newItem, kind: e.target.value as any })}
                className="w-full px-3 py-2 bg-black border border-zinc-700 rounded-xl text-white text-sm focus:border-teal-500 focus:outline-none"
              >
                <option value="fact">Fact</option>
                <option value="rule">Rule</option>
                <option value="terminology">Terminology</option>
                <option value="palette">Palette</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Title</label>
              <input
                type="text"
                placeholder="Descriptive title"
                value={newItem.title}
                onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                className="w-full px-3 py-2 bg-black border border-zinc-700 rounded-xl text-white text-sm focus:border-teal-500 focus:outline-none"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">Content / Specification</label>
            <textarea
              placeholder="Full rule statement, pricing claim, or hex token..."
              value={newItem.text}
              onChange={(e) => setNewItem({ ...newItem, text: e.target.value })}
              className="w-full px-3 py-2.5 bg-black border border-zinc-700 rounded-xl text-white text-sm focus:border-teal-500 focus:outline-none h-24 leading-relaxed"
              required
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="btn-secondary-micro px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-semibold hover:bg-zinc-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary-micro px-5 py-2 rounded-xl bg-teal-400 text-black font-extrabold text-xs shadow-md shadow-teal-500/20 hover:bg-teal-300"
            >
              Save Vault Item
            </button>
          </div>
        </form>
      )}

      {/* Vault Categories Grid */}
      {loading ? (
        <div className="text-center py-20 text-zinc-500 flex items-center justify-center gap-2">
          <RefreshCw className="h-5 w-5 animate-spin text-teal-400" />
          <span>Loading active brand vault...</span>
        </div>
      ) : (
        <div className="space-y-10">
          {/* Facts Section */}
          {(selectedCategory === 'all' || selectedCategory === 'fact') && filteredFacts.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-zinc-800/80">
                <span className="h-2.5 w-2.5 rounded-full bg-teal-400"></span>
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Approved Facts ({filteredFacts.length})
                </h2>
                <span className="text-xs text-zinc-500 font-mono">Pricing & Ground-Truth Constants</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredFacts.map((item) => (
                  <VaultCard
                    key={item.item_id}
                    item={item}
                    badgeColor="teal"
                    editingItemId={editingItemId}
                    editText={editText}
                    setEditingItemId={setEditingItemId}
                    setEditText={setEditText}
                    onSave={handleSaveEdit}
                    onDelete={handleDelete}
                    isGuest={isGuest}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Rules Section */}
          {(selectedCategory === 'all' || selectedCategory === 'rule') && filteredRules.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-zinc-800/80">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-400"></span>
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Governance Rules ({filteredRules.length})
                </h2>
                <span className="text-xs text-zinc-500 font-mono">Superlatives, Logos & Alt-Text Checks</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredRules.map((item) => (
                  <VaultCard
                    key={item.item_id}
                    item={item}
                    badgeColor="blue"
                    editingItemId={editingItemId}
                    editText={editText}
                    setEditingItemId={setEditingItemId}
                    setEditText={setEditText}
                    onSave={handleSaveEdit}
                    onDelete={handleDelete}
                    isGuest={isGuest}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Terminology Section */}
          {(selectedCategory === 'all' || selectedCategory === 'terminology') && filteredTerminology.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-zinc-800/80">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400"></span>
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Restricted & Approved Terminology ({filteredTerminology.length})
                </h2>
                <span className="text-xs text-zinc-500 font-mono">Phrase Mappings & Evidence Gating</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredTerminology.map((item) => (
                  <VaultCard
                    key={item.item_id}
                    item={item}
                    badgeColor="amber"
                    editingItemId={editingItemId}
                    editText={editText}
                    setEditingItemId={setEditingItemId}
                    setEditText={setEditText}
                    onSave={handleSaveEdit}
                    onDelete={handleDelete}
                    isGuest={isGuest}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Palette Section */}
          {(selectedCategory === 'all' || selectedCategory === 'palette') && filteredPalette.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80">
                <div className="flex items-center gap-2">
                  <Palette className="h-5 w-5 text-purple-400" />
                  <h2 className="text-lg font-bold text-white tracking-tight">
                    Brand Color Palette ({filteredPalette.length})
                  </h2>
                </div>
                <span className="text-xs text-zinc-500 font-mono">Sampling: Approximate</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {filteredPalette.map((item) => {
                  const hexMatch = item.text.match(/#[0-9A-Fa-f]{6}/);
                  const hex = hexMatch ? hexMatch[0] : '#1E3A8A';
                  const isCopied = copiedHex === hex;
                  return (
                    <div
                      key={item.item_id}
                      className="glass-card row-hover-micro p-4 rounded-2xl border border-white/[0.08] flex flex-col justify-between"
                    >
                      <div>
                        <div
                          className="h-20 w-full rounded-xl mb-3 shadow-inner border border-white/10 relative group cursor-pointer overflow-hidden"
                          style={{ backgroundColor: hex }}
                          onClick={() => handleCopyHex(hex)}
                          title="Click to copy Hex"
                        >
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-xs font-semibold text-white gap-1">
                            {isCopied ? <CheckCircle2 className="h-4 w-4 text-teal-400" /> : <Copy className="h-4 w-4" />}
                            {isCopied ? 'Copied!' : 'Copy Hex'}
                          </div>
                        </div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-mono font-bold">
                            {item.item_id}
                          </span>
                          <span className="text-xs font-mono text-zinc-400">{hex}</span>
                        </div>
                        <div className="text-sm font-bold text-white mt-1">{item.title}</div>
                        <p className="text-xs text-zinc-400 mt-1 leading-relaxed line-clamp-2">{item.text}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
};

interface VaultCardProps {
  item: VaultItem;
  badgeColor?: 'teal' | 'blue' | 'amber' | 'purple';
  editingItemId: string | null;
  editText: string;
  setEditingItemId: (id: string | null) => void;
  setEditText: (txt: string) => void;
  onSave: (id: string) => void;
  onDelete: (id: string) => void;
  isGuest?: boolean;
}

const VaultCard: React.FC<VaultCardProps> = ({
  item,
  badgeColor = 'teal',
  editingItemId,
  editText,
  setEditingItemId,
  setEditText,
  onSave,
  onDelete,
  isGuest,
}) => {
  const isEditing = editingItemId === item.item_id;

  const colorStyles = {
    teal: 'bg-teal-500/10 border-teal-500/20 text-teal-300',
    blue: 'bg-blue-500/10 border-blue-500/20 text-blue-300',
    amber: 'bg-amber-500/10 border-amber-500/20 text-amber-300',
    purple: 'bg-purple-500/10 border-purple-500/20 text-purple-300',
  }[badgeColor];

  return (
    <div className="glass-card row-hover-micro p-5 rounded-2xl border border-white/[0.08] flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded-md border text-xs font-mono font-bold ${colorStyles}`}>
              {item.item_id}
            </span>
            <span className="text-[10px] uppercase font-semibold text-emerald-400 tracking-wider">
              {item.status}
            </span>
          </div>
          {!isGuest && (
            <div className="flex items-center gap-1">
              {!isEditing ? (
                <>
                  <button
                    onClick={() => {
                      setEditingItemId(item.item_id);
                      setEditText(item.text);
                    }}
                    className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
                    title="Edit vault item"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => onDelete(item.item_id)}
                    className="p-1.5 text-zinc-400 hover:text-red-400 rounded-lg hover:bg-zinc-800 transition-colors"
                    title="Delete vault item"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => onSave(item.item_id)}
                    className="p-1.5 text-emerald-400 hover:text-emerald-300 rounded-lg hover:bg-zinc-800 transition-colors"
                    title="Save edit"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setEditingItemId(null)}
                    className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
                    title="Cancel edit"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <h3 className="text-base font-bold text-white tracking-tight">{item.title}</h3>

        {!isEditing ? (
          <p className="text-xs sm:text-sm text-zinc-300 mt-2 leading-relaxed bg-black/40 p-3 rounded-xl border border-zinc-800/80 font-mono">
            {item.text}
          </p>
        ) : (
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="w-full mt-2 p-2.5 bg-black border border-teal-500 rounded-xl text-white text-xs sm:text-sm focus:outline-none font-mono"
            rows={3}
          />
        )}
      </div>
    </div>
  );
};
