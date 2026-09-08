'use client';

import { useState, useEffect, useCallback } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { format, isToday, isYesterday } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { useAuthStore } from '@/store/auth';
import { AuthGuard } from '@/components/auth-guard';
import { ComposeModal, Draft } from '@/components/compose';
import { AppLauncher } from '@/components/app-launcher';
import {
  Star,
  Mail,
  Send,
  Inbox,
  FileText,
  Trash2,
  Paperclip,
  Search,
  Menu,
  X,
  ArrowLeft,
  Reply,
  Forward,
  Download,
  RefreshCw,
  Settings,
  LogOut,
  MailCheck,
  MailQuestion,
  ShieldCheck,
  ChevronDown,
  HardDrive,
  Loader2,
  Ticket,
} from 'lucide-react';
import api, { fetcher, errMsg } from '@/lib/api';

interface Message {
  id: string;
  uid: string;
  folder: string;
  subject: string | null;
  sender: string | null;
  recipients: string;
  snippet: string | null;
  bodyText?: string | null;
  bodyHtml?: string | null;
  isRead: boolean;
  isStarred: boolean;
  receivedAt: string;
  attachments?: { id: string; filename: string; size: number }[];
}

const FOLDER_META = [
  { key: 'INBOX', label: 'Kotak Masuk', icon: Inbox },
  { key: 'Starred', label: 'Berbintang', icon: Star },
  { key: 'Sent', label: 'Terkirim', icon: Send },
  { key: 'Drafts', label: 'Draf', icon: FileText },
  { key: 'Trash', label: 'Sampah', icon: Trash2 },
];

const initials = (name: string | null) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

const avatarColor = (seed: string | null | undefined) => {
  const colors = [
    'bg-primary/10 text-primary border border-primary/20',
    'bg-blue-50 text-blue-700 border border-blue-200',
    'bg-emerald-50 text-emerald-700 border border-emerald-200',
    'bg-purple-50 text-purple-700 border border-purple-200',
    'bg-amber-50 text-amber-700 border border-amber-200',
  ];
  if (!seed) return colors[0];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  return colors[Math.abs(h) % colors.length];
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return 'Kemarin';
  return format(d, 'd MMM', { locale: localeId });
};

export default function InboxPage() {
  return (
    <AuthGuard type="customer">
      <Inbox_ />
    </AuthGuard>
  );
}

function Inbox_() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const [folder, setFolder] = useState('INBOX');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [openUid, setOpenUid] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [sidebar, setSidebar] = useState(false);
  const [toast, setToast] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Prevent browser default file drop behavior (which attempts navigation to file:///)
  useEffect(() => {
    const prevent = (e: DragEvent) => {
      e.preventDefault();
    };
    window.addEventListener('dragover', prevent);
    window.addEventListener('drop', prevent);
    return () => {
      window.removeEventListener('dragover', prevent);
      window.removeEventListener('drop', prevent);
    };
  }, []);

  const handleDownloadAttachment = async (e: React.MouseEvent, a: { id: string; filename: string }) => {
    e.preventDefault();
    setDownloadingId(a.id);
    try {
      const res = await api.get(`/email/attachment/${a.id}/download`, {
        responseType: 'blob',
      });
      const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', a.filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      setToast(errMsg(err, 'Gagal mengunduh berkas'));
    } finally {
      setDownloadingId(null);
    }
  };

  const listKey = `/email?folder=${encodeURIComponent(folder)}&limit=50${query ? `&q=${encodeURIComponent(query)}` : ''}`;
  const list = useSWR<{ data: Message[] }>(listKey, fetcher, { refreshInterval: 15000 });
  const folders = useSWR<{ data: { folder: string; total: number; unread: number }[] }>(
    '/email/folders',
    fetcher,
    { refreshInterval: 15000 }
  );
  const opened = useSWR<Message>(openUid ? `/email/${openUid}` : null, fetcher, {
    revalidateOnFocus: false,
    onSuccess: () => {
      folders.mutate();
      list.mutate();
    },
  });

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const refresh = useCallback(() => {
    list.mutate();
    folders.mutate();
  }, [list, folders]);

  const act = async (fn: () => Promise<unknown>, message: string) => {
    try {
      await fn();
      setToast(message);
      refresh();
    } catch (e) {
      setToast(errMsg(e));
    }
  };

  const toggleStar = (m: Message) =>
    act(() => api.post(`/email/${m.uid}/star`, { isStarred: !m.isStarred }), 'Bintang diperbarui');

  const markUnread = (m: Message) =>
    act(async () => {
      await api.post(`/email/${m.uid}/read`, { isRead: false });
      setOpenUid(null);
    }, 'Ditandai belum dibaca');

  const remove = (m: Message) =>
    act(async () => {
      await api.delete(`/email/${m.uid}`);
      setOpenUid(null);
    }, folder === 'Trash' ? 'Dihapus permanen' : 'Dipindah ke Sampah');

  const message = opened.data;
  const messages = list.data?.data ?? [];

  return (
    <div className="h-screen flex flex-col bg-[#f8f9fa] overflow-hidden">
      {/* Top Header */}
      <header className="flex items-center justify-between px-4 sm:px-6 w-full h-16 border-b border-slate-200/90 bg-white z-30 shrink-0 select-none">
        {/* Left Brand */}
        <div className="flex items-center gap-3 w-64 shrink-0">
          <button
            type="button"
            aria-label="Menu"
            data-testid="menu-toggle"
            className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            onClick={() => setSidebar((s) => !s)}
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary-container flex items-center justify-center shadow-sm shadow-primary/20">
              <Mail className="w-5 h-5 text-white" strokeWidth={2.2} />
            </div>
            <div>
              <span className="text-base font-bold text-slate-900 tracking-tight block leading-tight">
                MailPortal
              </span>
              <span className="text-[10px] text-slate-500 font-medium hidden sm:block">
                clienteasylegal.co.id
              </span>
            </div>
          </div>
        </div>

        {/* Center Search Bar */}
        <form
          className="flex-1 max-w-xl mx-4 hidden md:flex"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(search);
            setOpenUid(null);
          }}
        >
          <div className="relative w-full">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              data-testid="search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setQuery(search);
                  setOpenUid(null);
                }
              }}
              placeholder="Cari subjek, pengirim, atau isi pesan..."
              className="block w-full pl-10 pr-9 py-2 rounded-xl bg-slate-100/80 hover:bg-slate-100 focus:bg-white border border-transparent focus:border-primary/40 focus:ring-2 focus:ring-primary/10 text-xs sm:text-sm text-slate-900 transition-all placeholder:text-slate-400 focus:outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setQuery('');
                }}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </form>

        {/* Right User Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 ml-auto shrink-0">
          <button
            data-testid="refresh"
            onClick={refresh}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors hidden sm:flex items-center justify-center"
            title="Muat Ulang"
          >
            <RefreshCw className={`w-4 h-4 ${list.isValidating ? 'animate-spin text-primary' : ''}`} />
          </button>

          <button
            data-testid="nav-settings"
            onClick={() => router.push('/settings')}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors hidden sm:flex items-center justify-center"
            title="Pengaturan Akun"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Google-style 9-dots App Launcher */}
          <AppLauncher currentApp="mail" />

          {/* User Pill */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200/80">
            <div className="flex flex-col text-right hidden sm:block">
              <span className="text-xs font-semibold text-slate-800 leading-tight">
                {user?.name || 'Customer'}
              </span>
              <span className="text-[10px] text-slate-500 truncate max-w-[140px]">
                {user?.email || ''}
              </span>
            </div>

            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center ring-2 ring-primary/20">
              {initials(user?.name || user?.email || 'CU')}
            </div>

            <button
              data-testid="logout"
              onClick={() => {
                logout();
                router.replace('/login');
              }}
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-0.5"
              title="Keluar"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile Backdrop */}
        {sidebar && (
          <div
            data-testid="sidebar-backdrop"
            onClick={() => setSidebar(false)}
            className="md:hidden fixed inset-0 top-16 bg-slate-900/40 backdrop-blur-[1px] z-40 transition-opacity"
          />
        )}

        {/* Sidebar Navigation */}
        <aside
          data-testid="sidebar"
          className={`${
            sidebar ? 'flex' : 'hidden md:flex'
          } w-64 flex-shrink-0 bg-white md:bg-transparent border-r border-slate-200/90 z-50 md:z-10 flex-col h-full absolute md:relative top-0 shadow-lg md:shadow-none`}
        >
          {/* Compose Button */}
          <div className="p-4 pb-3">
            <button
              data-testid="compose-open"
              onClick={() => {
                setDraft({});
                setSidebar(false);
              }}
              className="w-full bg-gradient-to-r from-primary to-primary-container text-white py-2.5 px-4 rounded-2xl flex items-center justify-center gap-2 font-semibold text-xs shadow-md shadow-primary/20 hover:opacity-95 active:scale-[0.98] transition-all"
            >
              <Mail className="w-4 h-4" />
              <span>Tulis Email</span>
            </button>
          </div>

          {/* Folder List */}
          <nav className="flex-1 overflow-y-auto px-3 py-1">
            <ul className="flex flex-col gap-1">
              {FOLDER_META.map((f) => {
                const meta = folders.data?.data?.find((x) => x.folder === f.key);
                const count = f.key === 'Starred' ? meta?.total ?? 0 : meta?.unread ?? 0;
                const isActive = folder === f.key;
                const IconComponent = f.icon;
                return (
                  <li key={f.key}>
                    <button
                      data-testid={`folder-${f.key}`}
                      onClick={() => {
                        setFolder(f.key);
                        setOpenUid(null);
                        setQuery('');
                        setSearch('');
                        setSidebar(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-primary/10 text-primary font-semibold shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                      }`}
                    >
                      <IconComponent
                        className={`w-4 h-4 shrink-0 ${
                          isActive
                            ? f.key === 'Starred'
                              ? 'fill-amber-400 text-amber-400'
                              : 'text-primary'
                            : 'text-slate-500'
                        }`}
                      />
                      <span className="flex-1 text-left">{f.label}</span>
                      {count > 0 && (
                        <span
                          data-testid={`unread-${f.key}`}
                          className={`text-[11px] rounded-full px-2 py-0.5 font-bold transition-transform ${
                            isActive
                              ? 'bg-primary text-white'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {count}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* Quick Cross-App Navigation */}
            <div className="pt-3 mt-3 border-t border-slate-200/80">
              <div className="px-3.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Aplikasi EasyLegal
              </div>
              <ul className="flex flex-col gap-0.5">
                <li>
                  <button
                    type="button"
                    data-testid="nav-sidebar-documents"
                    onClick={() => {
                      setSidebar(false);
                      router.push('/documents');
                    }}
                    className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 transition-all group"
                  >
                    <FileText className="w-4 h-4 text-slate-500 group-hover:text-blue-600 transition-colors shrink-0" />
                    <span className="flex-1 text-left">Legal Documents</span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    data-testid="nav-sidebar-support"
                    onClick={() => {
                      setSidebar(false);
                      router.push('/support');
                    }}
                    className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 transition-all group"
                  >
                    <Ticket className="w-4 h-4 text-slate-500 group-hover:text-emerald-600 transition-colors shrink-0" />
                    <span className="flex-1 text-left">Support Desk</span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    data-testid="nav-sidebar-settings"
                    onClick={() => {
                      setSidebar(false);
                      router.push('/settings');
                    }}
                    className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 transition-all group"
                  >
                    <Settings className="w-4 h-4 text-slate-500 group-hover:text-slate-900 transition-colors shrink-0" />
                    <span className="flex-1 text-left">Pengaturan Akun</span>
                  </button>
                </li>
              </ul>
            </div>
          </nav>

          {/* Sidebar Footer: Hostinger Storage Status */}
          <div className="p-3.5 m-3 rounded-2xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600">
            <div className="flex items-center justify-between mb-1.5 font-semibold text-slate-700">
              <div className="flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-primary" />
                <span>Penyimpanan</span>
              </div>
              <span className="font-mono text-[10px] text-emerald-600 font-bold">0% Terpakai</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-1.5 mb-2 overflow-hidden">
              <div className="bg-primary h-1.5 rounded-full" style={{ width: '1%' }} />
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-500">
              <span>21 KB / 1.00 GB</span>
              <span className="text-emerald-600 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Titan Mail Ready
              </span>
            </div>
          </div>
        </aside>

        {/* Middle: Email List Pane */}
        <div
          className={`${
            openUid ? 'hidden lg:flex' : 'flex'
          } flex-col w-full md:w-[380px] lg:w-[440px] border-r border-slate-200/90 bg-white overflow-hidden shrink-0`}
        >
          {/* List Toolbar */}
          <div className="px-4 py-2.5 flex items-center justify-between border-b border-slate-100 bg-white sticky top-0 z-10">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-800">
                {FOLDER_META.find((f) => f.key === folder)?.label || folder}
              </span>
              {query && (
                <span className="text-[11px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                  &quot;{query}&quot;
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-500 font-medium">
              {messages.length > 0 && <span>{messages.length} email</span>}
            </div>
          </div>

          {/* List Messages */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100" data-testid="message-list">
            {list.isLoading && (
              <div className="p-8 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-primary" />
                <span>Memuat daftar email...</span>
              </div>
            )}

            {!list.isLoading && messages.length === 0 && (
              <div data-testid="empty-state" className="p-12 text-center flex flex-col items-center gap-2.5">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                  <MailQuestion className="w-6 h-6" />
                </div>
                <p className="text-xs font-semibold text-slate-700">
                  {query ? `Tidak ada hasil untuk "${query}"` : 'Folder ini kosong'}
                </p>
                <p className="text-[11px] text-slate-500 max-w-[200px]">
                  {query ? 'Coba gunakan kata kunci lain' : 'Belum ada email yang tersimpan di sini'}
                </p>
              </div>
            )}

            {messages.map((m) => {
              const avatarClass = avatarColor(m.sender ?? m.recipients);
              const senderName = folder === 'Sent' ? m.recipients?.split(',')[0] : m.sender;
              const isActive = openUid === m.uid;
              const hasAttachment = m.attachments && m.attachments.length > 0;

              return (
                <div
                  key={m.id}
                  data-testid="message-row"
                  role="button"
                  tabIndex={0}
                  onClick={() => setOpenUid(m.uid)}
                  onKeyDown={(e) => e.key === 'Enter' && setOpenUid(m.uid)}
                  className={`flex items-start gap-3 px-4 py-3 cursor-pointer group relative transition-colors ${
                    isActive
                      ? 'bg-primary/5 border-l-4 border-l-primary'
                      : m.isRead
                      ? 'bg-white hover:bg-slate-50'
                      : 'bg-red-50/20 hover:bg-red-50/30'
                  }`}
                >
                  {/* Unread indicator dot */}
                  {!m.isRead && (
                    <div className="pointer-events-none absolute left-1.5 top-5 w-2 h-2 rounded-full bg-primary ring-2 ring-white" />
                  )}

                  {/* Star Toggle */}
                  <button
                    data-testid="row-star"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleStar(m);
                    }}
                    className="mt-1 text-slate-300 hover:text-amber-400 transition-colors shrink-0"
                    title={m.isStarred ? 'Hapus bintang' : 'Beri bintang'}
                  >
                    <Star
                      className={`w-4 h-4 transition-transform active:scale-125 ${
                        m.isStarred ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
                      }`}
                    />
                  </button>

                  {/* Sender Avatar */}
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${avatarClass}`}
                  >
                    {initials(senderName)}
                  </div>

                  {/* Content snippet */}
                  <div className="flex-1 min-w-0 pr-1">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <h4
                        className={`text-xs truncate pr-2 ${
                          m.isRead ? 'font-medium text-slate-700' : 'font-bold text-slate-900'
                        }`}
                      >
                        {senderName ?? 'Unknown'}
                      </h4>
                      <span
                        className={`text-[10px] whitespace-nowrap shrink-0 ${
                          m.isRead ? 'text-slate-400' : 'text-primary font-bold'
                        }`}
                      >
                        {formatDate(m.receivedAt)}
                      </span>
                    </div>

                    <p
                      className={`text-xs truncate mb-1 ${
                        m.isRead ? 'text-slate-800' : 'font-semibold text-slate-950'
                      }`}
                    >
                      {m.subject || '(tanpa subjek)'}
                    </p>

                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] text-slate-500 truncate flex-1">
                        {m.snippet || ''}
                      </p>
                      {hasAttachment && (
                        <Paperclip className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Reading Pane */}
        {openUid ? (
          message ? (
            <article data-testid="message-view" className="flex flex-1 flex-col bg-[#f8f9fa] overflow-hidden">
              {/* Reading Action Toolbar */}
              <div className="px-5 py-2.5 flex items-center justify-between border-b border-slate-200/90 bg-white z-10 sticky top-0 shrink-0">
                <div className="flex items-center gap-1.5">
                  <button
                    data-testid="back"
                    onClick={() => setOpenUid(null)}
                    className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1 text-xs font-medium"
                    title="Kembali ke Daftar"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span className="hidden sm:inline">Kembali</span>
                  </button>

                  <div className="h-4 w-px bg-slate-200 mx-1" />

                  <button
                    data-testid="msg-star"
                    onClick={() => toggleStar(message)}
                    className="p-1.5 text-slate-600 hover:text-amber-500 hover:bg-slate-100 rounded-lg transition-colors"
                    title={message.isStarred ? 'Hapus bintang' : 'Beri bintang'}
                  >
                    <Star
                      className={`w-4 h-4 ${
                        message.isStarred ? 'fill-amber-400 text-amber-400' : 'text-slate-500'
                      }`}
                    />
                  </button>

                  <button
                    data-testid="msg-unread"
                    onClick={() => markUnread(message)}
                    className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                    title="Tandai Belum Dibaca"
                  >
                    <MailCheck className="w-4 h-4" />
                  </button>

                  <button
                    data-testid="msg-delete"
                    onClick={() => remove(message)}
                    className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title={folder === 'Trash' ? 'Hapus Permanen' : 'Hapus ke Sampah'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    data-testid="reply"
                    onClick={() =>
                      setDraft({
                        to: message.sender ?? '',
                        subject: `Re: ${message.subject ?? ''}`,
                        body: `\n\n--- Pesan asli dari ${message.sender} ---\n${message.bodyText ?? ''}`,
                      })
                    }
                    className="flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-primary hover:bg-slate-100 px-2.5 py-1.5 rounded-lg transition-colors"
                  >
                    <Reply className="w-3.5 h-3.5" />
                    <span>Balas</span>
                  </button>

                  <button
                    data-testid="forward"
                    onClick={() =>
                      setDraft({
                        subject: `Fwd: ${message.subject ?? ''}`,
                        body: `\n\n--- Diteruskan dari ${message.sender} ---\n${message.bodyText ?? ''}`,
                      })
                    }
                    className="flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-primary hover:bg-slate-100 px-2.5 py-1.5 rounded-lg transition-colors"
                  >
                    <Forward className="w-3.5 h-3.5" />
                    <span>Teruskan</span>
                  </button>
                </div>
              </div>

              {/* Message Content Container */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
                <div className="max-w-3xl mx-auto bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 sm:p-8">
                  {/* Subject Title */}
                  <div className="border-b border-slate-100 pb-5 mb-6">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                        {message.folder}
                      </span>
                      {message.isStarred && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          Penting
                        </span>
                      )}
                    </div>
                    <h2 data-testid="msg-subject" className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight leading-snug">
                      {message.subject || '(tanpa subjek)'}
                    </h2>
                  </div>

                  {/* Sender Details */}
                  <div className="flex items-start justify-between gap-4 mb-6 pb-6 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm shadow-xs ${avatarColor(
                          message.sender
                        )}`}
                      >
                        {initials(message.sender)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span data-testid="msg-sender" className="font-bold text-slate-900 text-sm">
                            {message.sender}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Kepada: <span className="text-slate-700 font-medium">saya</span>
                        </div>
                      </div>
                    </div>

                    <span className="text-xs text-slate-500 font-medium shrink-0">
                      {format(new Date(message.receivedAt), 'd MMMM yyyy, HH:mm', { locale: localeId })}
                    </span>
                  </div>

                  {/* Email Body Rendering */}
                  <div className="text-sm text-slate-800 leading-relaxed font-normal min-h-[140px]">
                    {message.bodyHtml ? (
                      <div
                        data-testid="msg-body"
                        className="prose prose-sm max-w-none text-slate-800"
                        dangerouslySetInnerHTML={{ __html: message.bodyHtml }}
                      />
                    ) : (
                      <div data-testid="msg-body" className="whitespace-pre-wrap">
                        {message.bodyText}
                      </div>
                    )}
                  </div>

                  {/* Attachments Section */}
                  {!!message.attachments?.length && (
                    <div className="mt-8 pt-6 border-t border-slate-100">
                      <div className="flex items-center gap-1.5 mb-3">
                        <Paperclip className="w-4 h-4 text-slate-500" />
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Lampiran Berkas ({message.attachments.length})
                        </h4>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {message.attachments.map((a) => (
                          <a
                            key={a.id}
                            data-testid="attachment"
                            href={`${api.defaults.baseURL}/email/attachment/${a.id}/download`}
                            onClick={(e) => handleDownloadAttachment(e, a)}
                            className="flex items-center justify-between p-3 rounded-xl border border-slate-200/80 hover:border-primary/40 bg-slate-50/60 hover:bg-white transition-all group shadow-xs cursor-pointer"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-9 h-9 rounded-lg bg-red-50 text-primary border border-red-100 flex items-center justify-center shrink-0">
                                {downloadingId === a.id ? (
                                  <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                  <FileText className="w-5 h-5" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-slate-800 truncate group-hover:text-primary transition-colors">
                                  {a.filename}
                                </p>
                                <p className="text-[10px] text-slate-400 font-mono">
                                  {(a.size / 1024).toFixed(1)} KB
                                </p>
                              </div>
                            </div>
                            <div className="p-1.5 text-slate-400 group-hover:text-primary group-hover:bg-red-50 rounded-lg transition-colors shrink-0">
                              {downloadingId === a.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Download className="w-4 h-4" />
                              )}
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Bottom Quick Reply Trigger */}
                  <div className="mt-8 pt-6 border-t border-slate-100 flex items-center gap-3">
                    <button
                      onClick={() =>
                        setDraft({
                          to: message.sender ?? '',
                          subject: `Re: ${message.subject ?? ''}`,
                          body: `\n\n--- Pesan asli dari ${message.sender} ---\n${message.bodyText ?? ''}`,
                        })
                      }
                      className="bg-primary/10 hover:bg-primary/20 text-primary px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors"
                    >
                      <Reply className="w-3.5 h-3.5" />
                      <span>Balas Email Ini</span>
                    </button>
                    <button
                      onClick={() =>
                        setDraft({
                          subject: `Fwd: ${message.subject ?? ''}`,
                          body: `\n\n--- Diteruskan dari ${message.sender} ---\n${message.bodyText ?? ''}`,
                        })
                      }
                      className="bg-slate-100 hover:bg-slate-200/80 text-slate-700 px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors"
                    >
                      <Forward className="w-3.5 h-3.5" />
                      <span>Teruskan</span>
                    </button>
                  </div>
                </div>
              </div>
            </article>
          ) : (
            <div className="flex flex-1 items-center justify-center bg-[#f8f9fa] p-8">
              <div className="text-center text-slate-400 text-xs flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                <span>Memuat detail pesan...</span>
              </div>
            </div>
          )
        ) : (
          <div className="hidden lg:flex flex-1 items-center justify-center bg-[#f8f9fa] p-8">
            <div className="text-center max-w-sm">
              <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-center mx-auto mb-4 text-slate-300">
                <Mail className="w-8 h-8" />
              </div>
              <h3 className="text-sm font-bold text-slate-800 mb-1">Pilih email untuk dibaca</h3>
              <p className="text-xs text-slate-500">
                Klik salah satu email di panel kiri untuk membuka isi pesan lengkap dan lampiran.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Compose Modal */}
      {draft && (
        <ComposeModal
          draft={draft}
          onClose={() => setDraft(null)}
          onSent={() => {
            setDraft(null);
            setToast('Email terkirim');
            refresh();
          }}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <div
          data-testid="toast"
          role="status"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs font-medium px-4 py-2.5 rounded-xl shadow-xl z-50 animate-in fade-in slide-in-from-bottom-2 duration-150 flex items-center gap-2"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}
