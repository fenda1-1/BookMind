import { zhCNLocale } from './messages/zhCN/locale';
import { zhCNApp } from './messages/zhCN/app';
import { zhCNCommon } from './messages/zhCN/common';
import { zhCNNav } from './messages/zhCN/nav';
import { zhCNPage } from './messages/zhCN/page';
import { zhCNTopbar } from './messages/zhCN/topbar';
import { zhCNDialog } from './messages/zhCN/dialog';
import { zhCNCommand } from './messages/zhCN/command';
import { zhCNCommandPalette } from './messages/zhCN/commandPalette';
import { zhCNSidebar } from './messages/zhCN/sidebar';
import { zhCNReader } from './messages/zhCN/reader';
import { zhCNAi } from './messages/zhCN/ai';
import { zhCNOverview } from './messages/zhCN/overview';
import { zhCNSettings } from './messages/zhCN/settings';
import { zhCNLibrary } from './messages/zhCN/library';
import { zhCNSearch } from './messages/zhCN/search';
import { zhCNTasks } from './messages/zhCN/tasks';
import { zhCNKnowledge } from './messages/zhCN/knowledge';
import { zhCNCharacters } from './messages/zhCN/characters';

export const zhCN = {
  ...zhCNLocale,
  ...zhCNApp,
  ...zhCNCommon,
  ...zhCNNav,
  ...zhCNPage,
  ...zhCNTopbar,
  ...zhCNDialog,
  ...zhCNCommand,
  ...zhCNCommandPalette,
  ...zhCNSidebar,
  ...zhCNReader,
  ...zhCNAi,
  ...zhCNOverview,
  ...zhCNSettings,
  ...zhCNLibrary,
  ...zhCNSearch,
  ...zhCNTasks,
  ...zhCNKnowledge,
  ...zhCNCharacters,
} as const;
export type TranslationKey = keyof typeof zhCN;
export type Messages = Record<TranslationKey, string>;
