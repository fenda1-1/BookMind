import { open } from '@tauri-apps/plugin-dialog';
import { importLibraryCoverImage } from '../../services/libraryService';
import type { Book, EditableBook } from '../../types';

type UseLibraryCoverActionsOptions = {
  selectedBook: EditableBook | undefined;
  editingBook: EditableBook | undefined;
  imageFileLabel: string;
  onUpdateBook: (book: Book) => void;
  onError: (message: string) => void;
  onCloseBookMenu: () => void;
};

export function useLibraryCoverActions({ selectedBook, editingBook, imageFileLabel, onUpdateBook, onError, onCloseBookMenu }: UseLibraryCoverActionsOptions) {
  async function selectCoverImagePath() {
    try {
      const result = await open({ multiple: false, directory: false, filters: [{ name: imageFileLabel, extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }] });
      const selected = Array.isArray(result) ? result[0] : result;
      return typeof selected === 'string' && selected.trim() ? selected : null;
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  async function chooseCustomCover() {
    if (!selectedBook || selectedBook.deleted) return;
    const selected = await selectCoverImagePath();
    if (!selected) return;
    try {
      onUpdateBook({ ...selectedBook, coverImagePath: await importLibraryCoverImage(selected) });
      onCloseBookMenu();
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
    }
  }

  async function chooseEditorCustomCover() {
    if (!editingBook || editingBook.deleted) return;
    const selected = await selectCoverImagePath();
    if (!selected) return;
    try {
      onUpdateBook({ ...editingBook, coverImagePath: await importLibraryCoverImage(selected) });
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
    }
  }

  function clearEditorCustomCover() {
    if (editingBook) onUpdateBook({ ...editingBook, coverImagePath: '' });
  }

  return { chooseCustomCover, chooseEditorCustomCover, clearEditorCustomCover };
}
