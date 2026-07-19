import type { Messages } from './zh-CN';

import { frFRLocale } from './messages/frFR/locale';
import { frFRApp } from './messages/frFR/app';
import { frFRCommon } from './messages/frFR/common';
import { frFRNav } from './messages/frFR/nav';
import { frFRPage } from './messages/frFR/page';
import { frFRTopbar } from './messages/frFR/topbar';
import { frFRDialog } from './messages/frFR/dialog';
import { frFRCommand } from './messages/frFR/command';
import { frFRCommandPalette } from './messages/frFR/commandPalette';
import { frFRSidebar } from './messages/frFR/sidebar';
import { frFRReader } from './messages/frFR/reader';
import { frFRAi } from './messages/frFR/ai';
import { frFROverview } from './messages/frFR/overview';
import { frFRSettings } from './messages/frFR/settings';
import { frFRLibrary } from './messages/frFR/library';
import { frFRSearch } from './messages/frFR/search';
import { frFRTasks } from './messages/frFR/tasks';
import { frFRKnowledge } from './messages/frFR/knowledge';
import { frFRCharacters } from './messages/frFR/characters';

export const frFR = {
  ...frFRApp,
  ...frFRCommon,
  ...frFRNav,
  ...frFRPage,
  ...frFRTopbar,
  ...frFRDialog,
  ...frFRCommand,
  ...frFRCommandPalette,
  ...frFRSidebar,
  ...frFRReader,
  ...frFRAi,
  ...frFROverview,
  ...frFRSettings,
  ...frFRLibrary,
  ...frFRSearch,
  ...frFRTasks,
  ...frFRKnowledge,
  ...frFRCharacters,
  ...frFRLocale,
} satisfies Messages;
