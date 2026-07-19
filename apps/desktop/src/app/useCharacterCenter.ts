import { useEffect, useRef, useCallback } from 'react';
import { loadCharacterCenterBooks, loadCharacterCenterPayload, loadCharacterOverviewSnapshot } from '../services/characterCenterService';
import type { AppState } from './AppStateContext';
import {
  buildCharacterBookCacheSignature,
  getCachedCharacterOverviewSnapshot,
  getCachedCharacterPayload,
  rememberCharacterOverviewSnapshot,
  rememberCharacterPayload,
  type CharacterOverviewSnapshotCacheEntry,
  type CharacterPayloadCacheEntry,
} from '../features/characters/characterCenterSession';

export function useCharacterCenter(appState: AppState) {
  const {
    activePage,
    characterBookId,
    characterBookSummaries,
    setCharacterPayload,
    setCharacterOverviewSnapshot,
    setCharacterOverviewSnapshotLoadingBookId,
    setCharacterBookSummariesFromBackend,
  } = appState;

  const characterBookIdRef = useRef<string | null>(null);
  const characterPayloadLoadingBookIdRef = useRef<string | null>(null);
  const characterOverviewSnapshotLoadingBookIdRef = useRef<string | null>(null);
  const characterPayloadCacheRef = useRef(new Map<string, CharacterPayloadCacheEntry>());
  const characterOverviewSnapshotCacheRef = useRef(new Map<string, CharacterOverviewSnapshotCacheEntry>());

  useEffect(() => { characterBookIdRef.current = characterBookId; }, [characterBookId]);

  const getBookSummary = useCallback((bookId: string | null | undefined) => {
    if (!bookId) return null;
    return characterBookSummaries.find((summary) => summary.id === bookId) ?? null;
  }, [characterBookSummaries]);

  const getBookSignature = useCallback((bookId: string | null | undefined) => {
    return buildCharacterBookCacheSignature(getBookSummary(bookId));
  }, [getBookSummary]);

  useEffect(() => {
    if (!characterBookId) {
      setCharacterPayload(null);
      setCharacterOverviewSnapshot(null);
      setCharacterOverviewSnapshotLoadingBookId(null);
      return;
    }
    const signature = getBookSignature(characterBookId);
    const cachedPayload = getCachedCharacterPayload(characterPayloadCacheRef.current, characterBookId, signature);
    const cachedOverviewSnapshot = getCachedCharacterOverviewSnapshot(characterOverviewSnapshotCacheRef.current, characterBookId, signature);
    setCharacterPayload((current) => {
      if (!current || current.book.id !== characterBookId) return cachedPayload;
      return buildCharacterBookCacheSignature(current.book) === signature ? current : cachedPayload;
    });
    setCharacterOverviewSnapshot(() => cachedOverviewSnapshot);
  }, [characterBookId, getBookSignature, setCharacterOverviewSnapshot, setCharacterOverviewSnapshotLoadingBookId, setCharacterPayload]);

  const refreshCharacterPayload = useCallback(async (bookId: string | null) => {
    if (!bookId) { setCharacterPayload(null); return; }
    if (characterPayloadLoadingBookIdRef.current === bookId) return;
    const requestedSignature = getBookSignature(bookId);
    const cachedPayload = getCachedCharacterPayload(characterPayloadCacheRef.current, bookId, requestedSignature);
    if (cachedPayload) {
      if (characterBookIdRef.current === bookId) setCharacterPayload(cachedPayload);
      return;
    }
    setCharacterPayload((current) => current && current.book.id === bookId && buildCharacterBookCacheSignature(current.book) === requestedSignature ? current : null);
    characterPayloadLoadingBookIdRef.current = bookId;
    try {
      const p = await loadCharacterCenterPayload(bookId);
      if (!p || p.book.id !== bookId) {
        if (characterBookIdRef.current === bookId) setCharacterPayload(null);
        return;
      }
      rememberCharacterPayload(characterPayloadCacheRef.current, p, buildCharacterBookCacheSignature(p.book));
      if (characterBookIdRef.current === bookId) setCharacterPayload(p);
    }
    catch { if (characterBookIdRef.current === bookId) setCharacterPayload(null); }
    finally { if (characterPayloadLoadingBookIdRef.current === bookId) characterPayloadLoadingBookIdRef.current = null; }
  }, [getBookSignature, setCharacterPayload]);

  const refreshCharacterOverviewSnapshot = useCallback(async (bookId: string | null) => {
    if (!bookId) { setCharacterOverviewSnapshot(null); return; }
    if (characterOverviewSnapshotLoadingBookIdRef.current === bookId) return;
    const requestedSignature = getBookSignature(bookId);
    const cachedSnapshot = getCachedCharacterOverviewSnapshot(characterOverviewSnapshotCacheRef.current, bookId, requestedSignature);
    if (cachedSnapshot) {
      if (characterBookIdRef.current === bookId) setCharacterOverviewSnapshot(cachedSnapshot);
      return;
    }
    setCharacterOverviewSnapshot((current) => current && current.bookId === bookId ? current : null);
    characterOverviewSnapshotLoadingBookIdRef.current = bookId;
    setCharacterOverviewSnapshotLoadingBookId(bookId);
    try {
      const s = await loadCharacterOverviewSnapshot(bookId);
      const signature = getBookSignature(bookId);
      if (s) rememberCharacterOverviewSnapshot(characterOverviewSnapshotCacheRef.current, s, signature);
      if (characterBookIdRef.current === bookId) setCharacterOverviewSnapshot(s);
    }
    catch { }
    finally { if (characterOverviewSnapshotLoadingBookIdRef.current === bookId) { characterOverviewSnapshotLoadingBookIdRef.current = null; setCharacterOverviewSnapshotLoadingBookId((c) => c === bookId ? null : c); } }
  }, [getBookSignature, setCharacterOverviewSnapshot, setCharacterOverviewSnapshotLoadingBookId]);

  const refreshCharacterBookSummaries = useCallback(async () => { try { const s = await loadCharacterCenterBooks(); setCharacterBookSummariesFromBackend(s); } catch { } }, [setCharacterBookSummariesFromBackend]);

  useEffect(() => { if (activePage === 'characters') void refreshCharacterBookSummaries(); }, [activePage, refreshCharacterBookSummaries]);

  return { refreshCharacterPayload, refreshCharacterOverviewSnapshot, refreshCharacterBookSummaries };
}
