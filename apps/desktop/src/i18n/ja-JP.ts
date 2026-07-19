import type { Messages } from './zh-CN';

import { jaJPLocale } from './messages/jaJP/locale';
import { jaJPApp } from './messages/jaJP/app';
import { jaJPCommon } from './messages/jaJP/common';
import { jaJPNav } from './messages/jaJP/nav';
import { jaJPPage } from './messages/jaJP/page';
import { jaJPTopbar } from './messages/jaJP/topbar';
import { jaJPDialog } from './messages/jaJP/dialog';
import { jaJPCommand } from './messages/jaJP/command';
import { jaJPCommandPalette } from './messages/jaJP/commandPalette';
import { jaJPSidebar } from './messages/jaJP/sidebar';
import { jaJPReader } from './messages/jaJP/reader';
import { jaJPAi } from './messages/jaJP/ai';
import { jaJPOverview } from './messages/jaJP/overview';
import { jaJPSettings } from './messages/jaJP/settings';
import { jaJPLibrary } from './messages/jaJP/library';
import { jaJPSearch } from './messages/jaJP/search';
import { jaJPTasks } from './messages/jaJP/tasks';
import { jaJPKnowledge } from './messages/jaJP/knowledge';
import { jaJPCharacters } from './messages/jaJP/characters';

export const jaJP = {
  ...jaJPApp,
  ...jaJPCommon,
  ...jaJPNav,
  ...jaJPPage,
  ...jaJPTopbar,
  ...jaJPDialog,
  ...jaJPCommand,
  ...jaJPCommandPalette,
  ...jaJPSidebar,
  ...jaJPReader,
  ...jaJPAi,
  ...jaJPOverview,
  ...jaJPSettings,
  ...jaJPLibrary,
  ...jaJPSearch,
  ...jaJPTasks,
  ...jaJPKnowledge,
  ...jaJPCharacters,
  ...jaJPLocale,
} satisfies Messages;
