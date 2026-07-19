import { BookMindIcon } from '../../components/BookMindIcon';
import { useI18n } from '../../i18n';
import { getPrivacyBookTitle, type ExtendedSettings } from '../../services/settingsCenterService';
import type { DirectoryImportScanResult } from '../../services/libraryService';
import type { EditableBook } from '../../types';
import { formatBytes } from './libraryCollectionModel';
import type { ShelfGroupEntry } from './libraryShelfGroups';

export type LibraryGroupNameModalState = { mode: 'create' | 'rename'; groupId: string | null; value: string } | null;

type LibraryPageModalsProps = {
  directoryImportPreview: DirectoryImportScanResult | null;
  directoryImportSelectedPaths: string[];
  directoryImportDisplayNames: Record<string, string>;
  importing: boolean;
  onCancelDirectoryImport: () => void;
  onSelectAllDirectoryImport: () => void;
  onClearDirectoryImportSelection: () => void;
  onToggleDirectoryImportFile: (path: string) => void;
  onUpdateDirectoryImportDisplayName: (path: string, value: string) => void;
  onConfirmDirectoryImport: () => void;
  groupNameModal: LibraryGroupNameModalState;
  onCloseGroupNameModal: () => void;
  onChangeGroupName: (value: string) => void;
  onSubmitGroupName: () => void;
  editingBook: EditableBook | undefined;
  draftTitle: string;
  draftAuthor: string;
  coverTones: EditableBook['coverTone'][];
  onCloseBookEditor: () => void;
  onDraftTitleChange: (value: string) => void;
  onDraftAuthorChange: (value: string) => void;
  onSetBookCoverTone: (tone: EditableBook['coverTone']) => void;
  onChooseEditorCustomCover: () => void;
  onClearEditorCustomCover: () => void;
  onSaveBookEditor: () => void;
  groupEditorBook: EditableBook | undefined;
  customShelfGroups: ShelfGroupEntry[];
  newShelfGroupName: string;
  privacySettings: ExtendedSettings;
  onCloseGroupEditor: () => void;
  onRemoveGroup: (groupName: string) => void;
  onAddGroup: (groupName: string) => void;
  onNewGroupNameChange: (value: string) => void;
  onSubmitNewGroup: () => void;
};

export function LibraryPageModals({ directoryImportPreview, directoryImportSelectedPaths, directoryImportDisplayNames, importing, onCancelDirectoryImport, onSelectAllDirectoryImport, onClearDirectoryImportSelection, onToggleDirectoryImportFile, onUpdateDirectoryImportDisplayName, onConfirmDirectoryImport, groupNameModal, onCloseGroupNameModal, onChangeGroupName, onSubmitGroupName, editingBook, draftTitle, draftAuthor, coverTones, onCloseBookEditor, onDraftTitleChange, onDraftAuthorChange, onSetBookCoverTone, onChooseEditorCustomCover, onClearEditorCustomCover, onSaveBookEditor, groupEditorBook, customShelfGroups, newShelfGroupName, privacySettings, onCloseGroupEditor, onRemoveGroup, onAddGroup, onNewGroupNameChange, onSubmitNewGroup }: LibraryPageModalsProps) {
  const { t } = useI18n();
  return <>
    {groupNameModal ? <div className="modal-backdrop" role="presentation" onMouseDown={onCloseGroupNameModal}><section className="library-group-name-modal" role="dialog" aria-modal="true" aria-label={groupNameModal.mode === 'create' ? t('library.groups.menuCreate') : t('library.groups.menuRename')} onMouseDown={(event) => event.stopPropagation()}><p className="eyebrow">{t('library.groups.title')}</p><h2>{groupNameModal.mode === 'create' ? t('library.groups.menuCreate') : t('library.groups.menuRename')}</h2><label className="library-group-create-field"><span>{t('library.groups.newGroup')}</span><input value={groupNameModal.value} onChange={(event) => onChangeGroupName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') onSubmitGroupName(); }} placeholder={t('library.groups.newGroupPlaceholder')} autoFocus /></label><div className="action-row"><button className="ghost-btn" onClick={onCloseGroupNameModal}>{t('common.cancel')}</button><button className="primary-btn" onClick={onSubmitGroupName}>{t('common.save')}</button></div></section></div> : null}

    {directoryImportPreview ? <div className="modal-backdrop" role="presentation" onMouseDown={onCancelDirectoryImport}><section className="library-import-preview-modal" role="dialog" aria-modal="true" aria-label={t('library.importPreview.title')} onMouseDown={(event) => event.stopPropagation()}><header className="library-import-preview-head"><div><p className="eyebrow">{t('library.importPreview.eyebrow')}</p><h2>{t('library.importPreview.title')}</h2><span>{t('library.importPreview.summary', { count: directoryImportPreview.files.length, selected: directoryImportSelectedPaths.length, size: formatBytes(directoryImportPreview.totalBytes) })}</span></div><button className="detail-close-btn" type="button" onClick={onCancelDirectoryImport} aria-label={t('common.cancel')}>×</button></header><p className="library-import-preview-path">{directoryImportPreview.directory}</p><div className="library-import-preview-tools"><button className="ghost-btn small" type="button" onClick={onSelectAllDirectoryImport} disabled={directoryImportPreview.files.length === directoryImportSelectedPaths.length}>{t('library.importPreview.selectAll')}</button><button className="ghost-btn small" type="button" onClick={onClearDirectoryImportSelection} disabled={directoryImportSelectedPaths.length === 0}>{t('library.importPreview.clear')}</button></div><div className="library-import-preview-list" role="list" aria-label={t('library.importPreview.fileList')}>{directoryImportPreview.files.length === 0 ? <p>{t('library.importPreview.empty')}</p> : null}{directoryImportPreview.files.map((file) => <label className={directoryImportSelectedPaths.includes(file.path) ? 'library-import-preview-row selected' : 'library-import-preview-row'} key={file.path}><input type="checkbox" checked={directoryImportSelectedPaths.includes(file.path)} onChange={() => onToggleDirectoryImportFile(file.path)} /><BookMindIcon name={directoryImportSelectedPaths.includes(file.path) ? 'librarySelect' : 'librarySelectEmpty'} /><span><input className="library-import-preview-name" value={directoryImportDisplayNames[file.path] ?? file.displayName} onChange={(event) => onUpdateDirectoryImportDisplayName(file.path, event.target.value)} onClick={(event) => event.stopPropagation()} aria-label={t('library.importPreview.nameInput')} /><em>{file.relativePath}</em></span><i>{file.extension.toUpperCase()} · {formatBytes(file.sizeBytes)}</i></label>)}</div><div className="action-row"><button className="ghost-btn" type="button" onClick={onCancelDirectoryImport} disabled={importing}>{t('common.cancel')}</button><button className="primary-btn" type="button" onClick={onConfirmDirectoryImport} disabled={importing || directoryImportSelectedPaths.length === 0}>{importing ? t('library.importing') : t('library.importPreview.confirm', { count: directoryImportSelectedPaths.length })}</button></div></section></div> : null}

    {editingBook ? <div className="modal-backdrop" role="presentation" onMouseDown={onCloseBookEditor}><section className="edit-book-modal" role="dialog" aria-modal="true" aria-label={t('library.editTitle')} onMouseDown={(event) => event.stopPropagation()}><p className="eyebrow">{t('library.editEyebrow')}</p><h2>{t('library.editTitle')}</h2><label className="edit-field"><span>{t('library.bookTitle')}</span><input value={draftTitle} onChange={(event) => onDraftTitleChange(event.target.value)} autoFocus /></label><label className="edit-field"><span>{t('library.bookAuthor')}</span><input value={draftAuthor} onChange={(event) => onDraftAuthorChange(event.target.value)} /></label><div className="cover-picker">{coverTones.map((tone) => <button className={`cover-dot ${tone}`} key={tone} onClick={() => onSetBookCoverTone(tone)} aria-label={t('library.chooseCoverAria', { tone })} />)}<button type="button" className="cover-image-btn" onClick={onChooseEditorCustomCover}>{t('library.cover.custom')}</button>{editingBook.coverImagePath ? <button type="button" className="cover-image-btn muted" onClick={onClearEditorCustomCover}>{t('library.cover.clear')}</button> : null}</div><div className="action-row"><button className="ghost-btn" onClick={onCloseBookEditor}>{t('common.cancel')}</button><button className="primary-btn" onClick={onSaveBookEditor}>{t('common.save')}</button></div></section></div> : null}

    {groupEditorBook ? <div className="modal-backdrop" role="presentation" onMouseDown={onCloseGroupEditor}><section className="library-group-modal" role="dialog" aria-modal="true" aria-label={t('library.groups.manageTitle')} onMouseDown={(event) => event.stopPropagation()}><p className="eyebrow">{t('library.groups.title')}</p><h2>{getPrivacyBookTitle(groupEditorBook.displayTitle, privacySettings)}</h2><div className="library-group-current">{(groupEditorBook.shelfGroups ?? []).length ? (groupEditorBook.shelfGroups ?? []).map((group) => <button type="button" key={group} onClick={() => onRemoveGroup(group)} title={t('library.groups.removeFromGroup', { group })}>{group}<span>×</span></button>) : <em>{t('library.groups.noGroups')}</em>}</div><div className="library-group-options">{customShelfGroups.length ? customShelfGroups.map((group) => <button type="button" key={group.id} className={(groupEditorBook.shelfGroups ?? []).includes(group.label) ? 'active' : ''} onClick={() => onAddGroup(group.label)}><span>{group.label}</span><em>{group.count}</em></button>) : <p>{t('library.groups.noCustomGroups')}</p>}</div><label className="library-group-create-field"><span>{t('library.groups.newGroup')}</span><input value={newShelfGroupName} onChange={(event) => onNewGroupNameChange(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') onSubmitNewGroup(); }} placeholder={t('library.groups.newGroupPlaceholder')} autoFocus /></label><div className="action-row"><button className="ghost-btn" onClick={onCloseGroupEditor}>{t('common.done')}</button><button className="primary-btn" onClick={onSubmitNewGroup}>{t('library.groups.add')}</button></div></section></div> : null}
  </>;
}
