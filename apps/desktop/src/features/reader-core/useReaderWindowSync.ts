export type ReaderWindowConflictPolicy = 'last-write-wins' | 'field-merge' | 'version-compare' | 'user-choice';
export const defaultReaderWindowConflictPolicy: ReaderWindowConflictPolicy = 'version-compare';
