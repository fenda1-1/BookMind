import type { Messages } from './zh-CN';

import { esESLocale } from './messages/esES/locale';
import { esESApp } from './messages/esES/app';
import { esESCommon } from './messages/esES/common';
import { esESNav } from './messages/esES/nav';
import { esESPage } from './messages/esES/page';
import { esESTopbar } from './messages/esES/topbar';
import { esESDialog } from './messages/esES/dialog';
import { esESCommand } from './messages/esES/command';
import { esESCommandPalette } from './messages/esES/commandPalette';
import { esESSidebar } from './messages/esES/sidebar';
import { esESReader } from './messages/esES/reader';
import { esESAi } from './messages/esES/ai';
import { esESOverview } from './messages/esES/overview';
import { esESSettings } from './messages/esES/settings';
import { esESLibrary } from './messages/esES/library';
import { esESSearch } from './messages/esES/search';
import { esESTasks } from './messages/esES/tasks';
import { esESKnowledge } from './messages/esES/knowledge';
import { esESCharacters } from './messages/esES/characters';

export const esES = {
  ...esESApp,
  ...esESCommon,
  ...esESNav,
  ...esESPage,
  ...esESTopbar,
  ...esESDialog,
  ...esESCommand,
  ...esESCommandPalette,
  ...esESSidebar,
  ...esESReader,
  ...esESAi,
  ...esESOverview,
  ...esESSettings,
  ...esESLibrary,
  ...esESSearch,
  ...esESTasks,
  ...esESKnowledge,
  ...esESCharacters,
  ...esESLocale,
} satisfies Messages;
