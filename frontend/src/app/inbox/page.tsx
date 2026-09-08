'use client';

import { useState, useEffect, useCallback } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { format, isToday, isYesterday } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { useAuthStore } from '@/store/auth';
import { AuthGuard } from '@/components/auth-guard';
import { ComposeModal, Draft } from '@/components/compose';
import { Star } from 'lucide-react';
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
  { key: 'INBOX', label: 'Inbox', icon: 'inbox' },
  { key: 'Starred', label: 'Berbintang', icon: 'star' },
  { key: 'Sent', label: 'Sent', icon: 'send' },
  { key: 'Drafts', label: 'Drafts', icon: 'draft' },
  { key: 'Trash', label: 'Trash', icon: 'delete' },
];

const initials = (name: string | null) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

const avatarColor = (seed: string | null | undefined) => {
  const colors = [
    'bg-primary-container text-on-primary-container',
    'bg-tertiary-container text-on-tertiary-container',
    'bg-surface-variant text-on-surface-variant',
    'bg-secondary-container text-on-secondary-container',
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

  const listKey = `/email?folder=${encodeURIComponent(folder)}&limit=50${query ? `&q=${encodeURIComponent(query)}` : ''}`;
  const list = useSWR<{ data: Message[] }>(listKey, fetcher, { refreshInterval: 15000 });
  const folders = useSWR<{ data: { folder: string; total: number; unread: number }[] }>(
    '/email/folders', fetcher, { refreshInterval: 15000 }
  );
  const opened = useSWR<Message>(openUid ? `/email/${openUid}` : null, fetcher, {
    revalidateOnFocus: false,
    onSuccess: () => { folders.mutate(); list.mutate(); },
  });

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const refresh = useCallback(() => { list.mutate(); folders.mutate(); }, [list, folders]);

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
    <div className="h-screen flex flex-col bg-background">
      {/* Top Nav */}
      <header className="flex items-center justify-between px-md py-sm w-full h-16 border-b border-surface-variant bg-surface z-20 relative shrink-0">
        <div className="flex items-center gap-md flex-1">
          <button data-testid="menu-toggle" className="md:hidden p-sm text-on-surface-variant hover:bg-surface-variant/50 rounded-full transition-colors" onClick={() => setSidebar((s) => !s)}>
            <span className="material-symbols-outlined">menu</span>
          </button>
          <div className="flex items-center gap-sm">
            <span className="material-symbols-outlined text-primary text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>mail</span>
            <span className="text-page-title font-page-title text-on-surface font-bold hidden sm:block">MailPortal</span>
          </div>
        </div>

        <form
          className="flex-1 max-w-2xl mx-xl hidden md:flex"
          onSubmit={(e) => { e.preventDefault(); setQuery(search); setOpenUid(null); }}
        >
          <div className="relative w-full">
            <div className="absolute inset-y-0 left-0 pl-md flex items-center pointer-events-none">
              <span className="material-symbols-outlined text-outline">search</span>
            </div>
            <input
              data-testid="search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { setQuery(search); setOpenUid(null); } }}
              placeholder="Search mail"
              className="block w-full pl-xl pr-md py-sm rounded-full bg-surface-container-high border-none text-body-text text-on-surface focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest transition-colors placeholder:text-on-surface-variant"
            />
            <div className="absolute inset-y-0 right-0 pr-2 flex items-center">
              <button className="p-xs text-on-surface-variant hover:bg-surface-variant/50 rounded-full transition-colors">
                <span className="material-symbols-outlined text-[20px]">tune</span>
              </button>
            </div>
          </div>
        </form>

        <div className="flex items-center gap-sm ml-auto">
          <button data-testid="refresh" onClick={refresh} className="p-sm text-on-surface-variant hover:bg-surface-variant/50 rounded-full transition-colors hidden sm:flex" title="Refresh">
            <span className="material-symbols-outlined">refresh</span>
          </button>
          <button data-testid="nav-settings" onClick={() => router.push('/settings')} className="p-sm text-on-surface-variant hover:bg-surface-variant/50 rounded-full transition-colors hidden sm:flex" title="Settings">
            <span className="material-symbols-outlined">settings</span>
          </button>
          <button data-testid="logout" onClick={() => { logout(); router.replace('/login'); }} className="ml-sm h-8 w-8 rounded-full overflow-hidden hover:ring-2 hover:ring-primary transition-all flex items-center justify-center bg-surface-variant" title="Logout">
            <span className="material-symbols-outlined text-on-surface-variant text-[20px]">account_circle</span>
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile sidebar backdrop */}
        {sidebar && (
          <div data-testid="sidebar-backdrop" onClick={() => setSidebar(false)} className="md:hidden fixed inset-0 top-16 bg-black/40 z-10" />
        )}

        {/* Sidebar Navigation */}
        <aside
          data-testid="sidebar"
          className={`${sidebar ? 'block' : 'hidden'} md:flex w-sidebar-width flex-shrink-0 bg-background border-r border-surface-variant z-20 flex-col h-full absolute md:relative top-16 md:top-0`}
        >
          <div className="px-md mb-md">
            <button
              data-testid="compose-open"
              onClick={() => { setDraft({}); setSidebar(false); }}
              className="flex items-center gap-sm bg-secondary-container hover:bg-secondary-container/80 text-on-secondary-container px-lg py-md rounded-xl transition-all shadow-sm hover:shadow-md active:scale-95 w-full"
            >
              <span className="material-symbols-outlined fill text-[20px]">edit</span>
              <span className="font-label-button text-label-button">Compose</span>
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-sm">
            <ul className="flex flex-col gap-[2px]">
              {FOLDER_META.map((f) => {
                const meta = folders.data?.data?.find((x) => x.folder === f.key);
                const count = f.key === 'Starred' ? (meta?.total ?? 0) : (meta?.unread ?? 0);
                const isActive = folder === f.key;
                return (
                  <li key={f.key}>
                    <button
                      data-testid={`folder-${f.key}`}
                      onClick={() => { setFolder(f.key); setOpenUid(null); setQuery(''); setSearch(''); setSidebar(false); }}
                      className={`w-full flex items-center gap-md px-lg py-sm rounded-r-full text-label-button font-label-button transition-all active:scale-95 ${
                        isActive
                          ? 'bg-secondary-container text-on-secondary-container font-bold'
                          : 'text-on-surface-variant hover:bg-surface-variant/50'
                      }`}
                    >
                      <span className={`material-symbols-outlined text-[20px] ${isActive ? 'fill' : ''}`}>{f.icon}</span>
                      <span className="flex-1 text-left">{f.label}</span>
                      {count > 0 && (
                        <span data-testid={`unread-${f.key}`} className="text-xs rounded-full px-2 py-0.5 font-bold bg-primary text-on-primary">
                          {count}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>

        {/* Email List Panel */}
        <div className={`${openUid ? 'hidden lg:flex' : 'flex'} flex-col w-full md:w-[360px] lg:w-[420px] border-r border-surface-variant bg-surface overflow-hidden`}>
          <div className="px-md py-sm flex items-center justify-between border-b border-surface-variant bg-surface sticky top-0 z-10">
            <div className="flex items-center gap-xs">
              <button className="p-xs text-on-surface-variant hover:bg-surface-variant/50 rounded flex items-center transition-colors">
                <span className="material-symbols-outlined text-[20px]">check_box_outline_blank</span>
              </button>
              <button onClick={refresh} className="p-xs text-on-surface-variant hover:bg-surface-variant/50 rounded transition-colors">
                <span className="material-symbols-outlined text-[20px]">refresh</span>
              </button>
            </div>
            <div className="text-label-secondary text-on-surface-variant">
              {messages.length > 0 && <span>{messages.length} email</span>}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto" data-testid="message-list">
            {list.isLoading && (
              <div className="p-md text-sm text-on-surface-variant">Memuat email...</div>
            )}
            {!list.isLoading && messages.length === 0 && (
              <div data-testid="empty-state" className="p-10 text-center text-sm text-on-surface-variant">
                {query ? `Tidak ada hasil untuk "${query}"` : 'Folder ini kosong'}
              </div>
            )}
            {messages.map((m) => {
              const avatarClass = avatarColor(m.sender ?? m.recipients);
              const senderName = folder === 'Sent' ? m.recipients?.split(',')[0] : m.sender;
              const isActive = openUid === m.uid;
              return (
                <div
                  key={m.id}
                  data-testid="message-row"
                  role="button"
                  tabIndex={0}
                  onClick={() => setOpenUid(m.uid)}
                  onKeyDown={(e) => e.key === 'Enter' && setOpenUid(m.uid)}
                  className={`email-item flex items-center px-md py-sm border-b border-surface-variant cursor-pointer group relative transition-colors ${
                    isActive ? 'bg-secondary-fixed-dim/20' : m.isRead ? 'bg-surface' : 'bg-surface-container-low'
                  }`}
                >
                  {!m.isRead && (
                    <div className="pointer-events-none absolute left-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary" />
                  )}
                  <div className="flex items-center gap-md w-full">
                    <div className="flex items-center gap-sm flex-shrink-0">
                      <button
                        data-testid="row-star"
                        onClick={(e) => { e.stopPropagation(); toggleStar(m); }}
                        className="text-outline hover:text-primary transition-colors hidden sm:block"
                      >
                        <Star className={`w-5 h-5 ${m.isStarred ? 'fill-amber-400 text-amber-400' : 'text-outline'}`} />
                      </button>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${avatarClass}`}>
                        {initials(senderName)}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex justify-between items-baseline mb-0.5">
                        <h4 className={`font-email-subject text-email-subject text-on-surface truncate pr-2 ${m.isRead ? '' : 'font-bold'}`}>
                          {senderName ?? 'Unknown'}
                        </h4>
                        <span className={`email-date text-label-secondary text-label-secondary whitespace-nowrap transition-opacity ${m.isRead ? '' : 'text-primary font-bold'}`}>
                          {formatDate(m.receivedAt)}
                        </span>
                        <div className="email-actions absolute right-md top-1/2 -translate-y-1/2 flex items-center gap-xs bg-surface pl-2 opacity-0 transition-opacity shadow-[-8px_0_8px_-4px_rgba(242,243,253,1)]">
                          <button data-testid="row-unread" onClick={(e) => { e.stopPropagation(); markUnread(m); }} className="p-1.5 text-on-surface-variant hover:bg-surface-variant/80 rounded-full transition-colors bg-surface-variant/50" title="Mark unread">
                            <span className="material-symbols-outlined text-[20px]">mark_email_unread</span>
                          </button>
                          <button data-testid="row-delete" onClick={(e) => { e.stopPropagation(); remove(m); }} className="p-1.5 text-on-surface-variant hover:bg-surface-variant/80 rounded-full transition-colors bg-surface-variant/50" title="Delete">
                            <span className="material-symbols-outlined text-[20px]">delete</span>
                          </button>
                        </div>
                      </div>
                      <p className={`text-body-text text-body-text text-on-surface truncate mb-0.5 ${m.isRead ? '' : 'font-medium'}`}>
                        {m.subject || '(tanpa subjek)'}
                      </p>
                      <p className="text-body-text text-body-text text-on-surface-variant truncate text-sm">
                        {m.snippet}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Reading Pane */}
        {openUid ? (
          message ? (
            <article data-testid="message-view" className="flex flex-1 flex-col bg-surface overflow-hidden">
            <div className="px-lg py-sm flex items-center justify-between border-b border-surface-variant bg-surface z-10 sticky top-0">
              <div className="flex items-center gap-xs">
                <button data-testid="back" onClick={() => setOpenUid(null)} className="p-xs text-on-surface-variant hover:bg-surface-variant/50 rounded-full transition-colors" title="Back">
                  <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <button data-testid="msg-star" onClick={() => toggleStar(message)} className="p-xs text-on-surface-variant hover:bg-surface-variant/50 rounded-full transition-colors" title="Star">
                  <span className={`material-symbols-outlined text-[20px] ${message.isStarred ? 'fill text-amber-500' : ''}`}>
                    {message.isStarred ? 'star' : 'star_border'}
                  </span>
                </button>
                <button data-testid="msg-unread" onClick={() => markUnread(message)} className="p-xs text-on-surface-variant hover:bg-surface-variant/50 rounded-full transition-colors" title="Mark unread">
                  <span className="material-symbols-outlined">mark_email_unread</span>
                </button>
                <button data-testid="msg-delete" onClick={() => remove(message)} className="p-xs text-on-surface-variant hover:bg-surface-variant/50 rounded-full transition-colors" title="Delete">
                  <span className="material-symbols-outlined">delete</span>
                </button>
              </div>
              <div className="text-label-secondary text-on-surface-variant">
                {messages.length > 0 && <span>{messages.length} email</span>}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-xl">
              <div className="max-w-[800px] mx-auto">
                <div className="flex items-start justify-between mb-lg gap-md">
                  <h2 data-testid="msg-subject" className="text-[24px] leading-8 font-normal text-on-surface flex-1">
                    {message.subject || '(tanpa subjek)'}
                  </h2>
                  <div className="flex gap-2 flex-shrink-0 mt-1">
                    <span className="bg-surface-variant/50 text-on-surface-variant text-label-secondary px-2 py-1 rounded-md">{message.folder}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-xl">
                  <div className="flex items-center gap-md">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg shadow-sm ${avatarColor(message.sender)}`}>
                      {initials(message.sender)}
                    </div>
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span data-testid="msg-sender" className="font-bold text-on-surface text-body-text-lg">{message.sender}</span>
                      </div>
                      <div className="flex items-center gap-1 text-label-secondary text-on-surface-variant">
                        <span>to me</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-md text-label-secondary text-on-surface-variant">
                    <span>{format(new Date(message.receivedAt), 'd MMM yyyy, HH:mm', { locale: localeId })}</span>
                    <div className="flex gap-1">
                      <button
                        data-testid="reply"
                        onClick={() => setDraft({ to: message.sender ?? '', subject: `Re: ${message.subject ?? ''}`, body: `\n\n--- Pesan asli dari ${message.sender} ---\n${message.bodyText ?? ''}` })}
                        className="p-xs hover:bg-surface-variant/50 rounded-full transition-colors" title="Reply"
                      >
                        <span className="material-symbols-outlined text-[20px]">reply</span>
                      </button>
                      <button
                        data-testid="forward"
                        onClick={() => setDraft({ subject: `Fwd: ${message.subject ?? ''}`, body: `\n\n--- Diteruskan dari ${message.sender} ---\n${message.bodyText ?? ''}` })}
                        className="p-xs hover:bg-surface-variant/50 rounded-full transition-colors" title="Forward"
                      >
                        <span className="material-symbols-outlined text-[20px]">forward</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="text-body-text text-on-surface space-y-md leading-relaxed">
                  {message.bodyHtml ? (
                    <div data-testid="msg-body" dangerouslySetInnerHTML={{ __html: message.bodyHtml }} />
                  ) : (
                    <div data-testid="msg-body" className="whitespace-pre-wrap">{message.bodyText}</div>
                  )}
                </div>

                {!!message.attachments?.length && (
                  <div className="mt-xl pt-lg border-t border-surface-variant">
                    <h4 className="text-label-secondary text-on-surface-variant mb-md uppercase tracking-wider">
                      {message.attachments.length} Attachment
                    </h4>
                    <div className="flex flex-wrap gap-md">
                      {message.attachments.map((a) => (
                        <a
                          key={a.id}
                          data-testid="attachment"
                          href={`${api.defaults.baseURL}/email/attachment/${a.id}/download`}
                          className="flex items-center gap-md p-md border border-surface-variant rounded-lg hover:bg-surface-variant/20 cursor-pointer transition-colors max-w-[240px] group"
                        >
                          <div className="w-10 h-10 bg-error/10 text-error rounded flex items-center justify-center">
                            <span className="material-symbols-outlined">description</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-body-text text-on-surface truncate font-medium">{a.filename}</p>
                            <p className="text-label-secondary text-on-surface-variant">{(a.size / 1024).toFixed(1)} KB</p>
                          </div>
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="material-symbols-outlined text-outline text-[20px]">download</span>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-xl pt-lg flex gap-md">
                  <button
                    onClick={() => setDraft({ to: message.sender ?? '', subject: `Re: ${message.subject ?? ''}`, body: `\n\n--- Pesan asli dari ${message.sender} ---\n${message.bodyText ?? ''}` })}
                    className="bg-surface hover:bg-surface-variant/50 border border-outline px-lg py-sm rounded-full flex items-center gap-sm text-label-button text-on-surface transition-colors shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[20px]">reply</span> Reply
                  </button>
                  <button
                    onClick={() => setDraft({ subject: `Fwd: ${message.subject ?? ''}`, body: `\n\n--- Diteruskan dari ${message.sender} ---\n${message.bodyText ?? ''}` })}
                    className="bg-surface hover:bg-surface-variant/50 border border-outline px-lg py-sm rounded-full flex items-center gap-sm text-label-button text-on-surface transition-colors shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[20px]">forward</span> Forward
                  </button>
                </div>
              </div>
            </div>
          </article>
        ) : (
          <div className="flex flex-1 items-center justify-center bg-surface p-xl">
            <div className="text-center text-on-surface-variant text-sm flex items-center gap-2">
              <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
              <span>Memuat pesan...</span>
            </div>
          </div>
        )) : (
          <div className="hidden lg:flex flex-1 items-center justify-center bg-surface">
            <div className="text-center">
              <span className="material-symbols-outlined text-[64px] text-outline mb-4">mail</span>
              <p className="text-body-text text-on-surface-variant">Pilih email untuk dibaca</p>
            </div>
          </div>
        )}
      </div>

      {draft && (
        <ComposeModal
          draft={draft}
          onClose={() => setDraft(null)}
          onSent={() => { setDraft(null); setToast('Email terkirim'); refresh(); }}
        />
      )}

      {toast && (
        <div data-testid="toast" role="status" className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-on-surface text-surface-container-lowest text-sm px-4 py-2 rounded-lg shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
