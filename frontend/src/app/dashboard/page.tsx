'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import Image from 'next/image';
import { api, User, Location, Review, ReviewsResponse } from '@/lib/api';
import ReviewCard from '@/components/ReviewCard';
import ReplyModal from '@/components/ReplyModal';

const PRESETS = [
  { id: '7d',   label: '7 jours',   start: () => subDays(new Date(), 7),   end: () => new Date() },
  { id: '30d',  label: '30 jours',  start: () => subDays(new Date(), 30),  end: () => new Date() },
  { id: 'mtd',  label: 'Ce mois',   start: () => startOfMonth(new Date()), end: () => endOfMonth(new Date()) },
  { id: '90d',  label: '3 mois',    start: () => subDays(new Date(), 90),  end: () => new Date() },
  { id: '365d', label: '12 mois',   start: () => subDays(new Date(), 365), end: () => new Date() },
];

type StarFilter  = 'all' | 1 | 2 | 3 | 4 | 5;
type ReplyFilter = 'all' | 'replied' | 'not_replied';

export default function DashboardPage() {
  const router = useRouter();

  const [user, setUser]               = useState<User | null>(null);
  const [locations, setLocations]     = useState<Location[]>([]);
  const [selectedLoc, setSelectedLoc] = useState<Location | null>(null);
  const [data, setData]               = useState<ReviewsResponse | null>(null);

  const [preset,    setPreset]    = useState('30d');
  const [startDate, setStartDate] = useState(() => format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate,   setEndDate]   = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [starFilter,  setStarFilter]  = useState<StarFilter>('all');
  const [replyFilter, setReplyFilter] = useState<ReplyFilter>('all');

  const [loadingReviews, setLoadingReviews] = useState(false);
  const [syncing,        setSyncing]        = useState(false);
  const [syncingLocs,    setSyncingLocs]    = useState(false);
  const [importing,      setImporting]      = useState(false);
  const [menuOpen,       setMenuOpen]       = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [toast,          setToast]          = useState('');
  const [replyTarget,    setReplyTarget]    = useState<Review | null>(null);
  const [showFilters,    setShowFilters]    = useState(false);

  // Auth
  useEffect(() => {
    if (!localStorage.getItem('happi_token')) { router.push('/'); return; }
    api.getMe().then(setUser).catch(() => { localStorage.removeItem('happi_token'); router.push('/'); });
  }, [router]);

  // Locations
  useEffect(() => {
    if (!user) return;
    api.getLocations().then((locs) => {
      setLocations(locs);
      if (locs.length > 0) setSelectedLoc(locs[0]);
    }).catch(console.error);
  }, [user]);

  // Reviews
  const loadReviews = useCallback(async () => {
    if (!selectedLoc) return;
    setLoadingReviews(true);
    try {
      const res = await api.getReviews(selectedLoc.id, {
        start_date: `${startDate}T00:00:00Z`,
        end_date:   `${endDate}T23:59:59Z`,
        star:       starFilter !== 'all' ? starFilter : undefined,
        has_reply:  replyFilter === 'replied' ? true : replyFilter === 'not_replied' ? false : undefined,
      });
      setData(res);
    } catch { /* silent */ }
    finally { setLoadingReviews(false); }
  }, [selectedLoc, startDate, endDate, starFilter, replyFilter]);

  useEffect(() => { loadReviews(); }, [loadReviews]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  const handleSync = async () => {
    if (!selectedLoc) return;
    setSyncing(true);
    try {
      const res = await api.syncReviews(selectedLoc.id, { start_date: `${startDate}T00:00:00Z`, end_date: `${endDate}T23:59:59Z` });
      await loadReviews();
      showToast(`${res.synced} nouveaux avis synchronisés`);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Erreur de synchronisation');
    } finally { setSyncing(false); }
  };

  const handleSyncLocs = async () => {
    setSyncingLocs(true);
    try {
      const locs = await api.syncLocations();
      setLocations(locs);
      if (locs.length > 0) setSelectedLoc(locs[0]);
      showToast(`${locs.length} établissement(s) synchronisé(s)`);
    } catch { showToast('Erreur sync établissements'); }
    finally { setSyncingLocs(false); }
  };

  const handleReply = async (reviewId: number, text: string) => {
    if (!selectedLoc) return;
    await api.postReply(selectedLoc.id, reviewId, text);
    await loadReviews();
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !selectedLoc) return;
    setImporting(true);
    try {
      const res = await api.importCsv(selectedLoc.id, file);
      await loadReviews();
      showToast(`${res.imported} avis importés${res.skipped ? `, ${res.skipped} ignorés` : ''}`);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Erreur import CSV');
    } finally {
      setImporting(false);
    }
  };

  const handleDeleteReply = async (review: Review) => {
    if (!selectedLoc || !confirm('Supprimer cette réponse ?')) return;
    try { await api.deleteReply(selectedLoc.id, review.id); await loadReviews(); }
    catch { showToast('Erreur suppression'); }
  };

  const applyPreset = (p: typeof PRESETS[0]) => {
    setPreset(p.id);
    setStartDate(format(p.start(), 'yyyy-MM-dd'));
    setEndDate(format(p.end(), 'yyyy-MM-dd'));
  };

  const stats = data?.stats;
  const unanswered = data?.reviews.filter(r => !r.reply_text).length ?? 0;
  const noLocations = locations.length === 0;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 px-4 py-3.5 flex items-center justify-between sticky top-0 z-40">
        <button onClick={() => setMenuOpen(!menuOpen)} className="p-1 text-gray-600">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>
          </svg>
        </button>
        <span className="font-bold text-gray-900">Happi Reviews</span>
        <div className="w-7 h-7">
          {user?.picture
            ? <Image src={user.picture} alt="" width={28} height={28} className="rounded-full" />
            : <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold">{user?.name?.charAt(0)}</div>
          }
        </div>
      </header>

      {/* ── Drawer menu ────────────────────────────────────────────── */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setMenuOpen(false)} />
          <div className="fixed top-0 left-0 h-full w-72 bg-white z-50 shadow-xl flex flex-col">
            <div className="p-5 border-b border-gray-100 flex items-center gap-3">
              {user?.picture
                ? <Image src={user.picture} alt="" width={40} height={40} className="rounded-full" />
                : <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold">{user?.name?.charAt(0)}</div>
              }
              <div>
                <p className="font-semibold text-gray-900 text-sm">{user?.name}</p>
                <p className="text-xs text-gray-500">{user?.email}</p>
              </div>
            </div>

            {/* Locations list */}
            <div className="p-4 flex-1 overflow-y-auto">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Établissements</p>
              {locations.length === 0
                ? <p className="text-sm text-gray-400">Aucun établissement</p>
                : locations.map(loc => (
                  <button key={loc.id} onClick={() => { setSelectedLoc(loc); setMenuOpen(false); }}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-sm mb-1 flex items-center gap-2.5 ${
                      selectedLoc?.id === loc.id ? 'bg-primary-light text-primary font-semibold' : 'text-gray-700 hover:bg-gray-100'
                    }`}>
                    <span className={`w-2 h-2 rounded-full shrink-0 ${selectedLoc?.id === loc.id ? 'bg-primary' : 'bg-gray-300'}`} />
                    {loc.business_name}
                  </button>
                ))
              }
              <button onClick={() => { handleSyncLocs(); setMenuOpen(false); }} disabled={syncingLocs}
                className="mt-3 w-full text-xs text-primary font-semibold py-2 border border-primary-border rounded-xl hover:bg-primary-light transition">
                {syncingLocs ? 'Synchronisation…' : '↻ Sync établissements'}
              </button>
            </div>

            <div className="p-4 border-t border-gray-100">
              <button onClick={() => { localStorage.removeItem('happi_token'); router.push('/'); }}
                className="w-full text-sm text-gray-500 hover:text-red-600 text-left px-3 py-2 rounded-xl hover:bg-red-50 transition">
                Déconnexion
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Toast ──────────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-xs font-medium px-4 py-2.5 rounded-full shadow-lg animate-slide-up">
          {toast}
        </div>
      )}

      {/* ── Main ───────────────────────────────────────────────────── */}
      <main className="flex-1 px-4 pb-24 pt-5 max-w-2xl mx-auto w-full space-y-4">

        {/* Welcome */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome, {user?.name?.split(' ')[0] ?? '…'}</h1>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleSync}
            disabled={syncing || !selectedLoc}
            className="flex-1 flex items-center justify-center gap-2 border border-gray-300 bg-white rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-700 shadow-card hover:bg-gray-50 disabled:opacity-50 transition"
          >
            <svg className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            {syncing ? 'Sync…' : 'Sync avis'}
          </button>

          {/* Import CSV */}
          <label className={`flex-1 flex items-center justify-center gap-2 border border-gray-300 bg-white rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-700 shadow-card hover:bg-gray-50 transition cursor-pointer ${(!selectedLoc || importing) ? 'opacity-50 pointer-events-none' : ''}`}>
            <input type="file" accept=".csv" className="hidden" onChange={handleImport} disabled={!selectedLoc || importing} />
            <svg className={`w-4 h-4 ${importing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4 4l4-4m0 0l4 4m-4-4V4"/>
            </svg>
            {importing ? 'Import…' : 'Import CSV'}
          </label>

          <button
            onClick={() => selectedLoc && api.exportCsv(selectedLoc.id, { start_date: `${startDate}T00:00:00Z`, end_date: `${endDate}T23:59:59Z` })}
            disabled={!selectedLoc || !data?.reviews.length}
            className="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-white rounded-xl px-3 py-2.5 text-sm font-semibold shadow-md disabled:opacity-50 transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
            Export CSV
          </button>
        </div>

        {/* ── No locations → Unlock card ────────────────────────────── */}
        {noLocations && (
          <>
            {/* Tip banner */}
            {!bannerDismissed && (
              <div className="bg-primary-light border border-primary-border rounded-2xl p-4 flex items-start gap-3 shadow-card">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">Synchronisez vos établissements</p>
                  <p className="text-xs text-gray-500 mt-0.5">Importez vos établissements Google Business Profile pour commencer.</p>
                  <button onClick={handleSyncLocs} disabled={syncingLocs}
                    className="text-primary font-semibold text-xs mt-1.5">
                    {syncingLocs ? 'Sync…' : 'Sync maintenant'}
                  </button>
                </div>
                <button onClick={() => setBannerDismissed(true)} className="text-gray-400 hover:text-gray-600 shrink-0 mt-0.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            )}

            {/* Unlock metrics card */}
            <div className="bg-primary-light border border-primary-border rounded-2xl p-6 text-center shadow-card">
              <div className="w-14 h-14 bg-primary-soft rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                    d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900">Let&apos;s unlock your metrics!</h2>
              <p className="text-gray-500 text-sm mt-2 leading-relaxed">
                Connect your Google Business profile with your Happi Reviews account to
              </p>
              <div className="mt-4 space-y-2.5 text-left max-w-xs mx-auto">
                {['Sync your Google reviews', 'Follow your business performance', 'Save time with auto-replies'].map(item => (
                  <div key={item} className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full bg-white border border-primary-border flex items-center justify-center shrink-0">
                      <svg className="w-3 h-3 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                      </svg>
                    </span>
                    <span className="text-sm text-gray-700">{item}</span>
                  </div>
                ))}
              </div>
              <div className="mt-5 space-y-2.5">
                <button
                  onClick={handleSyncLocs}
                  disabled={syncingLocs}
                  className="w-full flex items-center justify-center gap-2 border border-gray-300 bg-white rounded-xl px-5 py-3 text-sm font-semibold text-gray-800 shadow-card hover:bg-gray-50 transition"
                >
                  <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                  </svg>
                  {syncingLocs ? 'Sync…' : 'Access my products'}
                </button>
                <button
                  onClick={() => (window.location.href = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001/api'}/auth/login`)}
                  className="w-full flex items-center justify-center gap-2 border border-gray-300 bg-white rounded-xl px-5 py-3 text-sm font-semibold text-gray-800 shadow-card hover:bg-gray-50 transition"
                >
                  <GoogleIcon />
                  Connect to Google
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── Has locations → Filters + Reviews ─────────────────────── */}
        {!noLocations && (
          <>
            {/* Location selector */}
            {locations.length > 1 && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-card px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-sm font-semibold text-gray-900">{selectedLoc?.business_name}</span>
                </div>
                <select
                  value={selectedLoc?.id || ''}
                  onChange={e => setSelectedLoc(locations.find(l => l.id === Number(e.target.value)) || null)}
                  className="text-xs text-primary font-semibold bg-transparent focus:outline-none cursor-pointer"
                >
                  {locations.map(l => <option key={l.id} value={l.id}>{l.business_name}</option>)}
                </select>
              </div>
            )}

            {/* Metric cards */}
            <div className="grid grid-cols-2 gap-3">
              <MetricCard
                label="Note moyenne"
                value={stats ? stats.average_rating.toFixed(1) : '—'}
                sub="/ 5"
                color="text-gray-900"
                badge={<Stars rating={stats ? Math.round(stats.average_rating) : 0} />}
              />
              <MetricCard
                label="Total avis"
                value={stats?.total ?? '—'}
                sub="sur la période"
                color="text-gray-900"
              />
              <MetricCard
                label="Sans réponse"
                value={unanswered}
                sub={unanswered > 0 ? 'à traiter' : 'Tout bon !'}
                color={unanswered > 0 ? 'text-amber-500' : 'text-green-600'}
              />
              <MetricCard
                label="Taux réponse"
                value={stats && stats.total > 0 ? `${Math.round(((stats.total - unanswered) / stats.total) * 100)}%` : '—'}
                sub="des avis"
                color="text-primary"
              />
            </div>

            {/* Filters toggle */}
            <div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 text-sm font-semibold text-primary"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z"/>
                </svg>
                Filtres {showFilters ? '▲' : '▼'}
              </button>

              {showFilters && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-card p-4 mt-3 space-y-4 animate-slide-up">
                  {/* Presets */}
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Période</p>
                    <div className="flex flex-wrap gap-2">
                      {PRESETS.map(p => (
                        <button key={p.id} onClick={() => applyPreset(p)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                            preset === p.id
                              ? 'bg-primary text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}>
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom dates */}
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <p className="text-xs text-gray-400 mb-1">Du</p>
                      <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setPreset(''); }}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-400 mb-1">Au</p>
                      <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setPreset(''); }}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20" />
                    </div>
                  </div>

                  {/* Star + reply filters */}
                  <div className="flex gap-2">
                    <select value={starFilter}
                      onChange={e => setStarFilter(e.target.value === 'all' ? 'all' : Number(e.target.value) as StarFilter)}
                      className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary/20">
                      <option value="all">Toutes notes</option>
                      {[5,4,3,2,1].map(s => <option key={s} value={s}>{'★'.repeat(s)} {s}/5</option>)}
                    </select>
                    <select value={replyFilter} onChange={e => setReplyFilter(e.target.value as ReplyFilter)}
                      className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary/20">
                      <option value="all">Tous les avis</option>
                      <option value="not_replied">Sans réponse</option>
                      <option value="replied">Avec réponse</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Distribution */}
            {stats && stats.total > 0 && !loadingReviews && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-card p-5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Distribution</p>
                <div className="space-y-2">
                  {[5,4,3,2,1].map(star => {
                    const count = stats.distribution[star] || 0;
                    const pct = Math.round((count / stats.total) * 100);
                    return (
                      <div key={star} className="flex items-center gap-3">
                        <div className="flex items-center gap-1 w-8 shrink-0">
                          <span className="text-xs font-semibold text-gray-700">{star}</span>
                          <svg className="w-3 h-3 text-star" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                          </svg>
                        </div>
                        <div className="flex-1 bg-gray-100 rounded-full h-2">
                          <div className="h-full bg-star rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-gray-500 w-12 text-right shrink-0">{count} ({pct}%)</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Reviews */}
            {loadingReviews ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : data && data.reviews.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-card py-12 text-center">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
                  </svg>
                </div>
                <p className="font-semibold text-gray-700 text-sm">Aucun avis sur cette période</p>
                <p className="text-xs text-gray-400 mt-1">Synchronisez depuis Google ou ajustez les filtres</p>
                <button onClick={handleSync} disabled={syncing}
                  className="mt-4 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white text-sm font-semibold rounded-xl transition">
                  {syncing ? 'Sync…' : 'Sync depuis Google'}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {data?.reviews.length} avis ·{' '}
                  {format(new Date(startDate), 'd MMM', { locale: fr })} – {format(new Date(endDate), 'd MMM yyyy', { locale: fr })}
                </p>
                {data?.reviews.map(r => (
                  <ReviewCard key={r.id} review={r} onReply={setReplyTarget} onDeleteReply={handleDeleteReply} />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* Chat FAB */}
      <button className="fixed bottom-6 right-4 w-12 h-12 bg-primary hover:bg-primary-hover text-white rounded-full shadow-lg flex items-center justify-center transition z-30">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
        </svg>
      </button>

      <ReplyModal review={replyTarget} onClose={() => setReplyTarget(null)} onSubmit={handleReply} />
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, color, badge }: {
  label: string; value: string | number; sub: string; color: string; badge?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-card p-4">
      <p className="text-xs text-gray-400 font-medium mb-2">{label}</p>
      <p className={`text-3xl font-black ${color}`}>{value}</p>
      {badge && <div className="mt-1">{badge}</div>}
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(s => (
        <svg key={s} className={`w-3 h-3 ${s <= rating ? 'text-star' : 'text-gray-200'}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
        </svg>
      ))}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}
