import type { Messages } from './zh-CN';

import { koKRLocale } from './messages/koKR/locale';
import { koKRApp } from './messages/koKR/app';
import { koKRCommon } from './messages/koKR/common';
import { koKRNav } from './messages/koKR/nav';
import { koKRPage } from './messages/koKR/page';
import { koKRTopbar } from './messages/koKR/topbar';
import { koKRDialog } from './messages/koKR/dialog';
import { koKRCommand } from './messages/koKR/command';
import { koKRCommandPalette } from './messages/koKR/commandPalette';
import { koKRSidebar } from './messages/koKR/sidebar';
import { koKRReader } from './messages/koKR/reader';
import { koKRAi } from './messages/koKR/ai';
import { koKROverview } from './messages/koKR/overview';
import { koKRSettings } from './messages/koKR/settings';
import { koKRLibrary } from './messages/koKR/library';
import { koKRSearch } from './messages/koKR/search';
import { koKRTasks } from './messages/koKR/tasks';
import { koKRKnowledge } from './messages/koKR/knowledge';
import { koKRCharacters } from './messages/koKR/characters';

export const koKR = {
  ...koKRApp,
  ...koKRCommon,
  ...koKRNav,
  ...koKRPage,
  ...koKRTopbar,
  ...koKRDialog,
  ...koKRCommand,
  ...koKRCommandPalette,
  ...koKRSidebar,
  ...koKRReader,
  ...koKRAi,
  ...koKROverview,
  ...koKRSettings,
  ...koKRLibrary,
  ...koKRSearch,
  ...koKRTasks,
  ...koKRKnowledge,
  ...koKRCharacters,
  ...koKRLocale,
} satisfies Messages;
