'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-provider';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';

interface Category { id: string; name: string; sortOrder: number; items: MenuItem[]; }
interface MenuItem { id: string; categoryId: string; name: string; description: string | null; price: number; imageUrl: string | null; isAvailable: boolean; nutritionInfo: any; }

export default function MenuPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [restaurant, setRestaurant] = useState<any>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCat, setActiveCat] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  // Category form
  const [showCatForm, setShowCatForm] = useState(false);
  const [catName, setCatName] = useState('');
  const [editingCat, setEditingCat] = useState<string | null>(null);

  // Item form
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemDesc, setItemDesc] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemCatId, setItemCatId] = useState('');
  const [itemAvailable, setItemAvailable] = useState(true);
  const [itemImage, setItemImage] = useState<File | null>(null);
  const [itemImagePreview, setItemImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    const r = await apiGet<any>('/api/restaurants/mine');
    if (r.success && r.data) {
      setRestaurant(r.data);
      const m = await apiGet<Category[]>(`/api/restaurants/${r.data.id}/menu`);
      if (m.success && m.data) setCategories(m.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => { if (!isLoading && !user) router.push('/login'); else if (user) load(); }, [user, isLoading]);

  // --- Category actions ---
  async function saveCategory() {
    if (!catName.trim() || !restaurant) return;
    if (editingCat) {
      await apiPatch(`/api/restaurants/${restaurant.id}/categories/${editingCat}`, { name: catName.trim() });
    } else {
      await apiPost(`/api/restaurants/${restaurant.id}/categories`, { name: catName.trim() });
    }
    setShowCatForm(false); setCatName(''); setEditingCat(null);
    load();
  }
  async function deleteCategory(catId: string) {
    if (!restaurant || !confirm('Delete this category and all its items?')) return;
    await apiDelete(`/api/restaurants/${restaurant.id}/categories/${catId}`);
    load();
  }
  function editCategory(cat: Category) {
    setEditingCat(cat.id); setCatName(cat.name); setShowCatForm(true);
  }

  // --- Item actions ---
  function openAddItem(catId?: string) {
    setEditingItem(null);
    setItemName(''); setItemDesc(''); setItemPrice('');
    setItemCatId(catId || (categories[0]?.id ?? ''));
    setItemAvailable(true);
    setItemImage(null); setItemImagePreview(null);
    setShowItemForm(true);
  }
  function openEditItem(item: MenuItem) {
    setEditingItem(item);
    setItemName(item.name); setItemDesc(item.description ?? ''); setItemPrice(String(item.price));
    setItemCatId(item.categoryId); setItemAvailable(item.isAvailable);
    setItemImage(null); setItemImagePreview(item.imageUrl);
    setShowItemForm(true);
  }
  async function saveItem() {
    if (!restaurant || !itemCatId || !itemName.trim() || !itemPrice) return;
    setUploading(true);

    let imageUrl = editingItem?.imageUrl ?? null;
    if (itemImage) {
      const { supabase } = await import('@/lib/supabase');
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) {
        const formData = new FormData();
        formData.append('file', itemImage);
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'}/api/upload/menu-image`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        const json = await res.json();
        if (json.success) imageUrl = json.data.imageUrl;
      }
    }

    const body: any = {
      categoryId: itemCatId,
      name: itemName.trim(),
      description: itemDesc.trim() || null,
      price: parseFloat(itemPrice),
      imageUrl,
    };
    if (editingItem) {
      await apiPatch(`/api/restaurants/${restaurant.id}/menu-items/${editingItem.id}`, body);
    } else {
      await apiPost(`/api/restaurants/${restaurant.id}/menu-items`, body);
    }
    setShowItemForm(false); setEditingItem(null);
    load();
  }
  async function toggleItem(item: MenuItem) {
    if (!restaurant) return;
    await apiPatch(`/api/restaurants/${restaurant.id}/menu-items/${item.id}/toggle`);
    load();
  }
  async function deleteItem(itemId: string) {
    if (!restaurant || !confirm('Delete this item?')) return;
    await apiDelete(`/api/restaurants/${restaurant.id}/menu-items/${itemId}`);
    load();
  }

  const filteredItems = activeCat === 'all'
    ? categories.flatMap(c => c.items.map(i => ({ ...i, categoryName: c.name })))
    : (categories.find(c => c.id === activeCat)?.items ?? []).map(i => ({ ...i, categoryName: '' }));

  if (isLoading || loading || !user) return null;

  return (
    <DashboardLayout variant="restaurant">
      <div>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Menu Management</h1>
          <button onClick={() => openAddItem()} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">
            + Add Item
          </button>
        </div>

        {/* Category tabs */}
        <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-2">
          <button onClick={() => setActiveCat('all')}
            className={`rounded-full px-4 py-1.5 text-sm font-medium whitespace-nowrap ${activeCat === 'all' ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            All
          </button>
          {categories.map(c => (
            <div key={c.id} className="group relative">
              <button onClick={() => setActiveCat(c.id)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium whitespace-nowrap ${activeCat === c.id ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {c.name}
              </button>
              <div className="absolute -top-1 -right-1 hidden group-hover:flex gap-0.5">
                <button onClick={() => editCategory(c)} className="rounded-full bg-white border p-0.5 text-xs" title="Edit">✏️</button>
                <button onClick={() => deleteCategory(c.id)} className="rounded-full bg-white border p-0.5 text-xs" title="Delete">🗑</button>
              </div>
            </div>
          ))}
          <button onClick={() => { setEditingCat(null); setCatName(''); setShowCatForm(true); }}
            className="rounded-full border-2 border-dashed border-gray-300 px-4 py-1.5 text-sm text-gray-400 hover:border-brand-400 hover:text-brand-500 whitespace-nowrap">
            + Category
          </button>
        </div>

        {/* Items grid */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.length === 0 ? (
            <div className="col-span-full rounded-xl border bg-card p-12 text-center text-muted-foreground">
              No items yet. Add a category first, then add items.
            </div>
          ) : filteredItems.map((item: any) => (
            <div key={item.id} className={`rounded-xl border bg-card p-4 shadow-sm ${!item.isAvailable ? 'opacity-50' : ''}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm truncate">{item.name}</h3>
                  {item.categoryName && <p className="text-xs text-muted-foreground">{item.categoryName}</p>}
                  {item.description && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{item.description}</p>}
                  <p className="mt-2 text-sm font-bold text-brand-600">NRS {item.price}</p>
                </div>
                <div className="flex flex-col items-end gap-1 ml-2">
                  <button onClick={() => openEditItem(item)} className="text-xs text-muted-foreground hover:text-brand-500">Edit</button>
                  <button onClick={() => deleteItem(item.id)} className="text-xs text-red-400 hover:text-red-600">Del</button>
                  <label className="mt-1 flex items-center gap-1 cursor-pointer">
                    <input type="checkbox" checked={item.isAvailable} onChange={() => toggleItem(item)} className="h-3.5 w-3.5 accent-brand-500" />
                    <span className="text-xs text-muted-foreground">{item.isAvailable ? 'In stock' : 'Out'}</span>
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Category Form Modal */}
      {showCatForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCatForm(false)}>
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold">{editingCat ? 'Edit Category' : 'New Category'}</h2>
            <input type="text" value={catName} onChange={e => setCatName(e.target.value)}
              placeholder="Category name" className="mt-3 w-full rounded-lg border px-3 py-2 text-sm" autoFocus />
            <div className="mt-4 flex gap-2 justify-end">
              <button onClick={() => setShowCatForm(false)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
              <button onClick={saveCategory} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Item Form Modal */}
      {showItemForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto" onClick={() => setShowItemForm(false)}>
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl m-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold">{editingItem ? 'Edit Item' : 'Add Item'}</h2>
            <div className="mt-3 space-y-3">
              <div>
                <label className="block text-xs font-medium">Name *</label>
                <input type="text" value={itemName} onChange={e => setItemName(e.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" placeholder="Item name" />
              </div>
              <div>
                <label className="block text-xs font-medium">Category *</label>
                <select value={itemCatId} onChange={e => setItemCatId(e.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm">
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium">Price (NRS) *</label>
                <input type="number" value={itemPrice} onChange={e => setItemPrice(e.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" placeholder="0" min="0" step="0.01" />
              </div>
              <div>
                <label className="block text-xs font-medium">Description</label>
                <textarea value={itemDesc} onChange={e => setItemDesc(e.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" rows={2} placeholder="Optional description" />
              </div>
              <div>
                <label className="block text-xs font-medium">Image</label>
                <div className="mt-1 flex items-center gap-3">
                  {(itemImagePreview || editingItem?.imageUrl) && (
                    <img src={itemImagePreview ?? editingItem?.imageUrl ?? ''} alt="Preview" className="h-16 w-16 rounded-lg object-cover" />
                  )}
                  <label className="cursor-pointer rounded-lg border-2 border-dashed px-3 py-2 text-xs text-muted-foreground hover:border-brand-400">
                    {itemImage ? itemImage.name : 'Choose file'}
                    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => {
                      const f = e.target.files?.[0]; if (f) { setItemImage(f); setItemImagePreview(URL.createObjectURL(f)); }
                    }} className="hidden" />
                  </label>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={itemAvailable} onChange={e => setItemAvailable(e.target.checked)} className="accent-brand-500" />
                In stock
              </label>
            </div>
            <div className="mt-4 flex gap-2 justify-end">
              <button onClick={() => setShowItemForm(false)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
              <button onClick={saveItem} disabled={uploading} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
                {uploading ? 'Uploading...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
