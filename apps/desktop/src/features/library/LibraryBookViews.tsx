import { convertFileSrc } from '@tauri-apps/api/core';
import { useI18n } from '../../i18n';
import { getPrivacyBookTitle, getPrivacyFileName, getPrivacyFilePath, type ExtendedSettings } from '../../services/settingsCenterService';
import type { Book, BookIndexManifest } from '../../types';
import { deriveLibraryBookStatus, formatTimestamp, indexStatusLabel, readingStatusLabel, trashRemaining, trashRemainingMillis } from './libraryCollectionModel';

const DAY_MILLIS = 24 * 60 * 60 * 1000;

export function LibraryBookCover({ book, className }: { book: Book; className: string }) {
  if (book.coverImagePath) return <span className={`${className} image-cover`}><img src={toLocalAssetUrl(book.coverImagePath)} alt="" loading="lazy" draggable={false} /></span>;
  return <span className={className}>{book.coverLabel}</span>;
}

export function BookDetailPanel({ book, privacySettings, indexManifest, onOpen, onOpenCharacters, onClose, onTrash }: { book: Book; privacySettings: ExtendedSettings; indexManifest: BookIndexManifest | null; onOpen: (bookId: string) => void; onOpenCharacters: (bookId: string) => void; onClose: () => void; onTrash: (book: Book) => void }) {
  const { locale, t } = useI18n();
  const status = deriveLibraryBookStatus(book, indexManifest);
  return <aside className="book-detail-panel"><div className="detail-panel-header"><h3>{t('library.detail.title')}</h3><button className="detail-close-btn" onClick={onClose} aria-label={t('library.detail.close')}>×</button></div><LibraryBookCover book={book} className={`large-cover ${book.coverTone}`} /><h2>{getPrivacyBookTitle(book.displayTitle, privacySettings)}</h2><dl><dt>{t('library.detail.author')}</dt><dd>{book.author}</dd><dt>{t('library.detail.file')}</dt><dd>{getPrivacyFileName(book.fileName, privacySettings)}</dd><dt>{t('library.detail.path')}</dt><dd>{getPrivacyFilePath(book.filePath, privacySettings)}</dd><dt>{t('library.detail.importedAt')}</dt><dd>{formatTimestamp(book.importedAt, locale)}</dd><dt>{t('library.detail.progress')}</dt><dd>{book.progress}%</dd><dt>{t('library.detail.status')}</dt><dd>{readingStatusLabel(status, t)}</dd><dt>{t('library.detail.indexStatus')}</dt><dd>{indexStatusLabel(status, t)}</dd><dt>{t('library.detail.chunks')}</dt><dd>{status.chunkCount}</dd><dt>FTS</dt><dd>{indexManifest?.ftsRowCount ?? 0}</dd></dl><div className="action-row"><button className="primary-btn" onClick={() => onOpen(book.id)}>{t('library.detail.open')}</button><button className="ghost-btn" onClick={() => onOpenCharacters(book.id)}>{t('library.detail.characters')}</button><button className="ghost-btn danger-btn" onClick={() => onTrash(book)}>{t('library.detail.trash')}</button></div></aside>;
}

export function BookStatusLine({ book, indexManifest }: { book: Book; indexManifest?: BookIndexManifest | null }) {
  const { t } = useI18n();
  const status = deriveLibraryBookStatus(book, indexManifest);
  return <em className="library-status-line"><span>{readingStatusLabel(status, t)}</span><span>{indexStatusLabel(status, t)}</span><span>{book.progress}%</span><span>{status.chunkCount} {t('library.detail.chunks')}</span></em>;
}

export function TrashBookRow({ book, privacySettings, now, retentionDays, autoCleanupEnabled, protectReadingProgress, busy, onRestore, onDelete }: { book: Book; privacySettings: ExtendedSettings; now: number; retentionDays: number; autoCleanupEnabled: boolean; protectReadingProgress: boolean; busy: boolean; onRestore: () => void; onDelete: () => void }) {
  const { t } = useI18n();
  const remaining = autoCleanupEnabled ? trashRemaining(book, now, retentionDays, t) : null;
  const progressProtected = protectReadingProgress && book.progress > 0;
  const expiringSoon = autoCleanupEnabled && trashRemainingMillis(book, now, retentionDays) <= DAY_MILLIS && !progressProtected;
  return <article className={`trash-book-row${expiringSoon ? ' expiring-soon' : ''}`}><LibraryBookCover book={book} className={`large-cover ${book.coverTone}`} /><div className="trash-book-copy"><h3>{getPrivacyBookTitle(book.displayTitle, privacySettings)}</h3><p>{getPrivacyFileName(book.fileName, privacySettings)}</p>{!progressProtected && remaining ? <em>{t('library.trash.deleteIn', { time: remaining })}</em> : null}{progressProtected ? <em>{t('library.trash.readingProgressProtected')} · {t('library.trash.autoCleanupProtectedHint')}</em> : null}{expiringSoon ? <strong>{t('library.trash.expiryWarning')}</strong> : null}</div><div className="trash-actions"><button className="ghost-btn small" onClick={onRestore} disabled={busy}>{t('library.trash.restore')}</button><button className="ghost-btn small danger-btn" onClick={onDelete} disabled={busy}>{t('library.trash.deleteNow')}</button></div></article>;
}

function toLocalAssetUrl(path: string) {
  try { return convertFileSrc(path); } catch { return path; }
}
