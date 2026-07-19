import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const messageList = readFileSync('src/features/ai-reader/AiConversationMessageList.tsx', 'utf8');
const structuredView = readFileSync('src/features/ai-reader/AiStructuredAnswerView.tsx', 'utf8');
const renderers = readFileSync('src/features/ai-reader/AiStructuredSectionRenderers.tsx', 'utf8');

assert.match(renderers, /export function InlineMarkdownText/u, 'Inline Markdown renderer should be reusable across live and historical AI messages');
assert.match(renderers, /export function RichMarkdownText/u, 'structured text answers should use a reusable block-level Markdown renderer');
assert.match(renderers, /buildMarkdownReaderDocument\(text\)\.blocks/u, 'rich AI text should reuse the reader Markdown block parser');
assert.match(renderers, /case 'list':[\s\S]*<Tag[\s\S]*block\.items\.map/u, 'rich AI text should render ordered, unordered, and task lists semantically');
assert.match(renderers, /case 'code':[\s\S]*ai-rich-code/u, 'rich AI text should render fenced code blocks');
assert.match(renderers, /case 'table':[\s\S]*ai-rich-table-wrap/u, 'rich AI text should render Markdown tables');
assert.match(renderers, /resolveSafeAiMarkdownLink[\s\S]*resolveSafeAiMarkdownImage/u, 'rich AI text must sanitize links and images instead of injecting arbitrary URLs');
assert.match(renderers, /markdownBlocks\.length \? markdownBlocks : \[\{ type: 'paragraph'/u, 'unrecognized rich text must retain a visible raw-text fallback');
assert.match(messageList, /<InlineMarkdownText text=\{answer \|\| \(bookReady/u, 'Live fallback assistant output should render Markdown while streaming');
assert.match(messageList, /<InlineMarkdownText text=\{messageContent \|\| \(bookReady/u, 'Historical fallback assistant output should render Markdown');
assert.match(structuredView, /AgentAnswerSummaryPreview summary=\{response\.summary\}[\s\S]*<InlineMarkdownText text=\{isLong \? `\$\{summary\.slice\(0, 180\)\}\.\.\.` : summary\} \/>/u, 'Structured response summary should render inline Markdown through its compact preview');
assert.match(renderers, /<InlineMarkdownText text=\{content\} \/>/u, 'Agent timeline event content should render inline Markdown');
assert.match(renderers, /<InlineMarkdownText text=\{item\} \/>/u, 'Structured fold section items should render inline Markdown');
assert.doesNotMatch(renderers, /block\.type === 'answer' \|\| block\.type === 'paragraph'/u, 'Summary fold should not duplicate final answer or paragraph blocks');
assert.doesNotMatch(renderers, /UnsupportedClaimWarnings/u, 'Normal answer paragraphs should not render noisy per-paragraph missing citation badges');

console.log('Verified AI reader Markdown rendering contract.');
