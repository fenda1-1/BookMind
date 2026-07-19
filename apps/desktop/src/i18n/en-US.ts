import type { Messages } from './zh-CN';

import { enUSLocale } from './messages/enUS/locale';
import { enUSApp } from './messages/enUS/app';
import { enUSCommon } from './messages/enUS/common';
import { enUSNav } from './messages/enUS/nav';
import { enUSPage } from './messages/enUS/page';
import { enUSTopbar } from './messages/enUS/topbar';
import { enUSDialog } from './messages/enUS/dialog';
import { enUSCommand } from './messages/enUS/command';
import { enUSCommandPalette } from './messages/enUS/commandPalette';
import { enUSSidebar } from './messages/enUS/sidebar';
import { enUSReader } from './messages/enUS/reader';
import { enUSAi } from './messages/enUS/ai';
import { enUSOverview } from './messages/enUS/overview';
import { enUSSettings } from './messages/enUS/settings';
import { enUSLibrary } from './messages/enUS/library';
import { enUSSearch } from './messages/enUS/search';
import { enUSTasks } from './messages/enUS/tasks';
import { enUSKnowledge } from './messages/enUS/knowledge';
import { enUSCharacters } from './messages/enUS/characters';

export const enUS = {
  ...enUSLocale,
  ...enUSApp,
  ...enUSCommon,
  ...enUSNav,
  ...enUSPage,
  ...enUSTopbar,
  ...enUSDialog,
  ...enUSCommand,
  ...enUSCommandPalette,
  ...enUSSidebar,
  ...enUSReader,
  ...enUSAi,
  ...enUSOverview,
  ...enUSSettings,
  ...enUSLibrary,
  ...enUSSearch,
  ...enUSTasks,
  ...enUSKnowledge,
  ...enUSCharacters,
} satisfies Messages;
