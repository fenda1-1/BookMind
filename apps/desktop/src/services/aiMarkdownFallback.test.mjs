import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const outDir = join(tmpdir(), `bookmind-ai-markdown-fallback-test-${process.pid}`);
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--ignoreConfig',
  '--target', 'ES2022',
  '--module', 'NodeNext',
  '--moduleResolution', 'NodeNext',
  '--outDir', outDir,
  '--skipLibCheck',
  'src/services/aiMarkdownFallback.ts',
  'src/services/aiResponseProtocol.ts',
], { cwd: process.cwd(), stdio: 'inherit' });

const { parseAiMarkdownFallback } = await import(pathToFileURL(join(outDir, 'aiMarkdownFallback.js')).href);
const { parseAiResponseProtocol, renderBlockPlainText } = await import(pathToFileURL(join(outDir, 'aiResponseProtocol.js')).href);

const chapterMarkdown = `# 第2章《月亮上的天使》总结

- **主要事件**：林七夜讲述月球上的炽天使。
- **角色状态**：李医生先怀疑再追问。

> 可回跳依据：第2章 第3段「月球上的炽天使」`;
const chapter = parseAiMarkdownFallback(chapterMarkdown);
assert.equal(chapter.schema, 'bookmind.ai.response.v2');
assert.ok(chapter.blocks.some((block) => block.type === 'heading' && block.content.includes('第2章')));
assert.ok(chapter.blocks.some((block) => block.type === 'bullet_list' && block.items.length === 2));
assert.ok(chapter.blocks.some((block) => block.type === 'citation_group' && block.status === 'pending_binding'));
assert.equal(chapter.rawText, chapterMarkdown, 'fallback parser must retain raw markdown for diagnostics');

const flashcardMarkdown = `- \`Q\`: 李医生为什么一开始怀疑林七夜？
  \`A\`: 因为林七夜说自己七岁时看见月球上的炽天使。
  \`标签\`: 李医生 / 炽天使 / 失明
  \`引用来源\`: 第2章《月亮上的天使》第3段`;
const flashcards = parseAiMarkdownFallback(flashcardMarkdown);
const flashcardsBlock = flashcards.blocks.find((block) => block.type === 'flashcards');
assert.ok(flashcardsBlock, 'Q/A markdown must become a flashcards block');
assert.equal(flashcardsBlock.cards[0].front, '李医生为什么一开始怀疑林七夜？');
assert.deepEqual(flashcardsBlock.cards[0].tags, ['李医生', '炽天使', '失明']);
assert.equal(flashcardsBlock.cards[0].citationSource, '第2章《月亮上的天使》第3段');
assert.ok(flashcardsBlock.cards[0].citationIds.length >= 1, 'flashcards should carry pending citation ids');

const v2 = parseAiResponseProtocol(JSON.stringify({
  schema: 'bookmind.ai.response.v2',
  blocks: [{ id: 'b1', type: 'paragraph', content: '有引用的事实', citationIds: ['c1'] }],
  citations: [{
    id: 'c1',
    type: 'range',
    bookId: 'book-1',
    chapterId: 'chapter-1',
    chapterIndex: 0,
    paragraphIndex: 2,
    startOffset: 4,
    endOffset: 8,
    snippet: '引用片段',
    sourceText: '引用片段',
  }],
}));
assert.equal(v2.schema, 'bookmind.ai.response.v2');

const wrappedStructuredResponse = parseAiResponseProtocol(JSON.stringify({
  raw: JSON.stringify({
    answer: JSON.stringify({
      version: 'bookmind.ai.response.v2',
      scope: 'selection',
      blocks: [{ type: 'paragraph', content: '嵌套结构化正文' }],
      citations: [],
    }),
  }),
}));
assert.equal(wrappedStructuredResponse.parseError, undefined, 'nested provider envelopes should still enter structured rendering');
assert.ok(wrappedStructuredResponse.blocks.some((block) => block.type === 'paragraph' && block.content === '嵌套结构化正文'), 'nested provider envelopes must render their answer blocks');
assert.equal(v2.citations[0].sourceChapterIndex, 0, 'chapterIndex should normalize to sourceChapterIndex for reader jumps');
assert.equal(v2.citations[0].quote, '引用片段', 'snippet/sourceText should normalize to quote for renderers');

const plainMarkdown = parseAiResponseProtocol(chapterMarkdown);
assert.equal(plainMarkdown.schema, 'bookmind.ai.response.v2', 'non-JSON answers should enter markdown fallback rendering');
assert.ok(plainMarkdown.blocks.some((block) => block.type === 'heading'));

const nestedV2Raw = `Markdown 兜底回答{"bookmind.ai.response.v2":{"scope":"chapter","chaptertitle":"第2章 月亮上的天使","summary":{"mainevents":["李医生复查林七夜的失明原因。","林七夜决定转入普通高中。"],"informationgain":["失明与月球炽天使经历绑定。"],"characterstatuschanges":[{"character":"林七夜","statuschange":"视力恢复但仍需遮光。"}],"references":[{"id":"r1","quote":"“那天，我与祂对视了一瞬间，然后……我就瞎了。”","uses":["失明与炽天使目击之间的直接关联"]},{"id":"r2","quote":"“我必须要和其他人站在同一个起跑线上。”","uses":["林七夜的目标与决心"]}]}}}`;
const nestedV2 = parseAiResponseProtocol(nestedV2Raw);
assert.equal(nestedV2.schema, 'bookmind.ai.response.v2', 'nested bookmind.ai.response.v2 object should parse as structured v2 instead of markdown fallback');
assert.equal(nestedV2.parseError, undefined, 'nested v2 JSON must not show structure parse failure');
assert.equal(nestedV2.title, '第2章 月亮上的天使');
assert.ok(nestedV2.blocks.some((block) => block.type === 'summary' && Array.isArray(block.bullets) && block.bullets.length >= 2), 'nested summary arrays should become a summary block');
assert.ok(nestedV2.blocks.some((block) => block.type === 'character_table' && Array.isArray(block.rows) && block.rows.length === 1), 'nested character status changes should become a character table');
assert.equal(nestedV2.citations.length, 2, 'nested references should become protocol citations');
assert.ok(nestedV2.blocks.some((block) => Array.isArray(block.citationIds) && block.citationIds.includes('r1')), 'summary claims should carry reference citation ids');
assert.ok(renderBlockPlainText(nestedV2.blocks.find((block) => block.title === '主要事件')).includes('李医生复查'), 'summary blocks must render useful plain text for fold sections');
assert.ok(renderBlockPlainText(nestedV2.blocks.find((block) => block.type === 'character_table')).includes('视力恢复'), 'character status rows must render useful plain text');

const productExampleRaw = `Markdown 兜底回答
{"version":"bookmind.ai.response.v2","chapterscope":"第2章 月亮上的天使","summary":{"主要事件":["李医生对林七夜进行复查，追问他童年时“看见月球上的炽天使”以及随后失明的经历。","复查结束后，李医生离开；林七夜回到家中。"],"信息增量":["林七夜失明的“官方病历”记载为“原因未知”。"],"角色状态变化":["林七夜：从复查中的沉静、克制，转为在家中显露出更明确的人际温度与生活意志。"]},"evidence":[{"claim":"李医生对林七夜进行复查，追问他童年时“看见月球上的炽天使”以及随后失明的经历。","references":[{"tool":"getparagraphwindow","quote":"李医生回过神来，“炽天使？”“对。”","locationhint":"复查对话段"}]}],"diagnostics":{"notes":["本章可直接确认的事实，均已附可回跳引用依据。"]}}`;
const productExample = parseAiResponseProtocol(productExampleRaw);
assert.equal(productExample.schema, 'bookmind.ai.response.v2', 'version field must be accepted as the v2 schema marker');
assert.equal(productExample.parseError, undefined, 'product example JSON must not fall back to raw markdown rendering');
assert.equal(productExample.title, '第2章 月亮上的天使');
assert.ok(productExample.blocks.some((block) => block.type === 'summary' && block.title === '主要事件' && renderBlockPlainText(block).includes('复查')), 'Chinese summary keys should become visible summary cards');
assert.ok(productExample.blocks.some((block) => block.type === 'summary' && block.title === '信息增量'), 'Chinese information gain key should become a visible block');
assert.ok(productExample.blocks.some((block) => block.type === 'character_table' && renderBlockPlainText(block).includes('林七夜')), 'Chinese character status strings should become a visible character status block');
assert.ok(productExample.blocks.some((block) => block.type === 'evidence_list' && Array.isArray(block.items) && block.items.length === 1), 'top-level evidence should become a visual evidence list block');
assert.ok(productExample.citations.some((citation) => citation.quote?.includes('炽天使')), 'evidence references should become citation cards');

const schemaLessProductExample = parseAiResponseProtocol(JSON.stringify({
  major_events: ['李医生为林七夜复查，追问炽天使与失明原因。'],
  information_increment: ['新增核心设定：林七夜声称月球上存在一尊金色炽天使。'],
  character_state_changes: ['姨妈：从关心林七夜身体恢复，进一步转向为他的学业与未来做安排。'],
}));
assert.equal(schemaLessProductExample.schema, 'bookmind.ai.response.v2', 'schema-less product example shape should be recognized as a structured BookMind response');
assert.equal(schemaLessProductExample.parseError, undefined, 'schema-less product example shape must not render as raw JSON fallback');
assert.ok(schemaLessProductExample.blocks.some((block) => block.type === 'summary' && block.title === '主要事件' && renderBlockPlainText(block).includes('李医生为林七夜复查')), 'major_events should render as a visible summary card');
assert.ok(schemaLessProductExample.blocks.some((block) => block.type === 'summary' && block.title === '信息增量' && renderBlockPlainText(block).includes('新增核心设定')), 'information_increment should render as a visible summary card');
assert.ok(schemaLessProductExample.blocks.some((block) => block.type === 'character_table' && renderBlockPlainText(block).includes('姨妈')), 'character_state_changes should render as a visible character status card');

const objectStatusResponse = parseAiResponseProtocol(JSON.stringify({
  schema: 'bookmind.ai.response.v2',
  summary: {
    character_state_changes: [{
      character: '林七夜',
      statusChange: { text: '视力恢复但仍需遮光。' },
    }],
  },
}));
const objectStatusText = renderBlockPlainText(objectStatusResponse.blocks.find((block) => block.type === 'character_table'));
assert.ok(objectStatusText.includes('视力恢复'), 'object-valued statusChange should render readable text');
assert.doesNotMatch(objectStatusText, /\[object Object\]/, 'object-valued statusChange must never render as [object Object]');

const typedNestedIssueResponse = parseAiResponseProtocol(JSON.stringify({
  type: 'bookmind.ai.response.v2',
  scope: 'chapter',
  scope_label: '第24章 大雨',
  response: {
    summary: '就当前提供的章节内容看，没有明显“硬性逻辑漏洞”，更多是作者故意留下的悬念与信息遮蔽。',
    possible_issues: [{
      issue: '林七夜从蝙蝠那里得到的信息没有明说，导致他突然冲出去显得有点跳。',
      severity: 'minor',
      analysis: '逻辑链是存在的：蝙蝠可能告诉了他雨夜中的危机。但文本没有直接写出蝙蝠传达了什么。',
      citations: [
        '“星夜舞者给他带来的与夜行生物交流的能力还没用过，难得碰到一只蝙蝠，似乎可以试试……”',
        '“林七夜猛的回过头，双眸都在震颤！”',
      ],
      verdict: '更像悬念处理，不算硬漏洞。',
    }],
    overall_verdict: '当前章最大的问题不是逻辑漏洞，而是“关键信息延迟揭示”。',
  },
}));
assert.equal(typedNestedIssueResponse.schema, 'bookmind.ai.response.v2', 'top-level type marker should be accepted as a v2 schema marker');
assert.equal(typedNestedIssueResponse.parseError, undefined, 'top-level type response with nested response payload must not fall back to raw markdown');
assert.equal(typedNestedIssueResponse.title, '第24章 大雨');
assert.equal(typedNestedIssueResponse.summary, '就当前提供的章节内容看，没有明显“硬性逻辑漏洞”，更多是作者故意留下的悬念与信息遮蔽。');
assert.ok(typedNestedIssueResponse.blocks.some((block) => block.type === 'summary' && block.title === '摘要' && renderBlockPlainText(block).includes('硬性逻辑漏洞')), 'nested response.summary should become a visible summary block');
assert.ok(typedNestedIssueResponse.blocks.some((block) => block.type === 'foreshadowing_list' && JSON.stringify(block).includes('林七夜从蝙蝠')), 'nested possible_issues should become visible issue cards');
assert.ok(typedNestedIssueResponse.blocks.some((block) => block.type === 'summary' && block.title === '整体判断' && renderBlockPlainText(block).includes('信息延迟揭示')), 'nested overall_verdict should become a visible verdict block');
assert.ok(typedNestedIssueResponse.citations.some((citation) => citation.quote?.includes('星夜舞者')), 'possible issue citations should become pending citation cards');

const looseCharactersRaw = `{"version":"bookmind.ai.response.v2","scope":"chapter","scope_label":"第2章 月亮上的天使","diagnostics":[{"type":"evidence_note","message":"当前上下文未按人物/阵营分段显式标注来源。"}],"characters":[{"name":"林七夜","relations":[{"target":"李医生","relation":"被复查/被诊断者","evidence":"李医生对其说法持怀疑。"}],"faction":"从异常者回到家庭中的普通生活成员","faction_evidence":"准备从特殊学校转入普通高中。"}],"relationships":[{"pair":["林七夜","李医生"],"type":"诊断-被诊断","details":"围绕炽天使和失明原因产生冲突性叙述","evidence":"原因未知"}],"faction_changes":[{"entity":"林七夜","from":"被特殊学校标签定义","to":"准备进入普通高中","evidence":"转进普通高中"}],"key_interactions":[{"interaction":"月球天使与失明原因的追问","participants":["林七夜","李医生"],"evidence":"连续追问并质疑"}],"potential_conflicts":[{"conflict":"经历是否真实","trigger":"月球上的炽天使","evidence":"医生怀疑","status":"隐性冲突"}]}`;
const looseCharacters = parseAiResponseProtocol(looseCharactersRaw);
assert.equal(looseCharacters.parseError, undefined, 'loose character command JSON must not fall back to raw JSON');
assert.ok(looseCharacters.blocks.some((block) => block.type === 'character_table' && Array.isArray(block.characters) && block.characters.length === 1), 'top-level characters should become a visible character table block');
assert.ok(looseCharacters.blocks.some((block) => block.type === 'character_table' && Array.isArray(block.relationships) && block.relationships.length >= 1), 'top-level relationships should render inside the character table block');
assert.ok(looseCharacters.blocks.some((block) => block.type === 'timeline' && Array.isArray(block.events) && renderBlockPlainText(block).includes('月球天使')), 'key_interactions should become visible timeline events');
assert.ok(looseCharacters.blocks.some((block) => block.type === 'foreshadowing_list' && Array.isArray(block.items) && block.items.length === 1), 'potential_conflicts should become visible conflict/foreshadowing items');

const looseFlashcardsRaw = `{"bookmind.ai.response.v2":{"scope":"第2章 月亮上的天使","flashcards":[{"question":"林七夜在月球上看见了什么？","answer":"他声称看见了一尊金色的炽天使。","tags":["剧情","炽天使"],"citation":"“金色的雕塑”"}]}}`;
const looseFlashcards = parseAiResponseProtocol(looseFlashcardsRaw);
assert.equal(looseFlashcards.parseError, undefined, 'loose flashcards command JSON must not fall back to raw JSON');
assert.ok(looseFlashcards.blocks.some((block) => block.type === 'flashcards' && block.cards?.[0]?.front === '林七夜在月球上看见了什么？'), 'top-level loose flashcards should become a visible flashcards block');
assert.ok(looseFlashcards.citations.some((citation) => citation.quote?.includes('金色')), 'flashcard citation strings should become citation cards');

const nestedCharacterCommandRaw = `{"bookmind.ai.response.v2":{"scope":"chapter","scope_label":"第2章 月亮上的天使","diagnostics":[],"characters":[{"name":"林七夜","relations":[{"target":"李医生","type":"患者-医生/复查关系","evidence":"李医生对林七夜进行复查。"}],"factions":[{"name":"家庭/支持阵营","status":"核心成员","evidence":"共同组成一个家。"}],"key_interactions":[{"summary":"李医生复查林七夜失明原因，围绕“月球上的炽天使”展开对话。","evidence":"李医生追问炽天使。"}],"potential_conflicts":[{"issue":"林七夜的经历与医学判断冲突","evidence":"李医生认为像妄想。"}]}]}}`;
const nestedCharacterCommand = parseAiResponseProtocol(nestedCharacterCommandRaw);
const nestedCharacterBlock = nestedCharacterCommand.blocks.find((block) => block.type === 'character_table');
assert.ok(nestedCharacterBlock, 'nested character command should render a character table block');
assert.ok(JSON.stringify(nestedCharacterBlock).includes('李医生'), 'nested character relations should be included in the character table');
assert.ok(JSON.stringify(nestedCharacterBlock).includes('家庭/支持阵营'), 'nested character factions should be included in the character table');
assert.ok(nestedCharacterCommand.blocks.some((block) => block.type === 'timeline' && renderBlockPlainText(block).includes('炽天使')), 'nested key_interactions should become timeline events');
assert.ok(nestedCharacterCommand.blocks.some((block) => block.type === 'foreshadowing_list' && JSON.stringify(block).includes('医学判断冲突')), 'nested potential_conflicts should become visible conflict items');

const analysisCharactersRaw = `{"bookmind.ai.response.v2":{"analysis":{"chapter":"第31章 祈墨","characters_identified":[{"name":"林七夜","evidence":"“林七夜慌了。”、“七夜弟弟，放心...”"},{"name":"陈牧野","evidence":"“陈牧野就像是想起了什么，郑重提醒道...”"},{"name":"红缨","evidence":"“一直偷偷躲在门后面的红缨探出脑袋，小声的说道...”"},{"name":"温祈墨","evidence":"“温祈墨瞪大了眼睛。”、“就在这时，温祈墨微笑着走了过来...”"},{"name":"吴湘南","evidence":"“转头又瞪了吴湘南一眼。吴湘南：……”"}]},"diagnostics":{"missing_references":[]}}}`;
const analysisCharacters = parseAiResponseProtocol(analysisCharactersRaw);
const analysisCharacterBlock = analysisCharacters.blocks.find((block) => block.type === 'character_table');
assert.equal(analysisCharacters.parseError, undefined, 'analysis.characters_identified payload must not fall back to raw JSON');
assert.equal(analysisCharacters.title, '第31章 祈墨', 'analysis.chapter should become the response title');
assert.ok(analysisCharacterBlock, 'analysis.characters_identified should render a visible character table block');
assert.ok(JSON.stringify(analysisCharacterBlock).includes('温祈墨'), 'identified character names should be visible');
assert.ok(renderBlockPlainText(analysisCharacterBlock).includes('林七夜慌了'), 'identified character evidence should be included in rendered plain text');
assert.ok(analysisCharacters.citations.some((citation) => citation.quote?.includes('林七夜慌了')), 'identified character evidence should become protocol citations');
assert.ok(analysisCharacters.citations.some((citation) => citation.id === 'analysis_char_1' && citation.sourceText === '林七夜慌了。'), 'identified character citations should expose a short exact sourceText for reader jump search');
assert.ok(Array.isArray(analysisCharacterBlock.rows) && analysisCharacterBlock.rows.every((row) => Array.isArray(row.citationIds) && row.citationIds.length === 1), 'identified character rows should render clickable citation markers');

const analysisExtractedCharactersRaw = `{"bookmind.ai.response.v2":{"analysis":{"chapter":"第31章 祈墨","characters_extracted":[{"name":"林七夜","evidence":["林七夜慌了。","林七夜如蒙大赦，跟着温祈墨走出门"]},{"name":"温祈墨","evidence":["温祈墨瞪大了眼睛。","就在这时，温祈墨微笑着走了过来"]}]}}}`;
const analysisExtractedCharacters = parseAiResponseProtocol(analysisExtractedCharactersRaw);
const analysisExtractedCharacterBlock = analysisExtractedCharacters.blocks.find((block) => block.type === 'character_table');
assert.equal(analysisExtractedCharacters.parseError, undefined, 'analysis.characters_extracted payload must not fall back to raw JSON');
assert.ok(analysisExtractedCharacterBlock, 'analysis.characters_extracted should render a visible character table block');
assert.ok(renderBlockPlainText(analysisExtractedCharacterBlock).includes('林七夜如蒙大赦'), 'array evidence should render as readable text');
assert.ok(analysisExtractedCharacters.citations.some((citation) => citation.id === 'analysis_char_1_2' && citation.sourceText === '林七夜如蒙大赦，跟着温祈墨走出门'), 'array evidence items should each become a searchable citation');
assert.ok(Array.isArray(analysisExtractedCharacterBlock.rows) && analysisExtractedCharacterBlock.rows[0].citationIds.length === 2, 'character rows should bind every evidence citation from the array');

const spacedJsonFenceRaw = "``` json\n{\"bookmind.ai.response.v2\":{\"analysis\":{\"chapter\":\"第31章 祈墨\",\"characters_extracted\":[{\"name\":\"林七夜\",\"evidence\":[\"林七夜慌了。\"]}]}}}\n```";
const spacedJsonFence = parseAiResponseProtocol(spacedJsonFenceRaw);
assert.equal(spacedJsonFence.parseError, undefined, 'json fences with whitespace after backticks should parse as structured JSON');
assert.ok(spacedJsonFence.blocks.some((block) => block.type === 'character_table'), 'spaced json fence should render structured character output');

const truncatedSchemaEnvelopeRaw = `{"bookmind.ai.response.v2":{"scope":"chapter","scope_label":"第2章 月亮上的天使","diagnostics":[],"characters":[{"name":"林七夜","relations":[{"target":"李医生","type":"患者-医生/复查关系","evidence":"李医生对林七夜进行复查，并询问失明原因。"},{"target":"姨妈","type":"外甥-养育照顾关系","evidence":"姨妈多次叮嘱他注意眼睛。"}],"factions":[{"name":"家庭/支持阵营","status":"核心成员","evidence":"姨妈、杨晋和小黑癞对他表现出保护、关心与接纳。"},{"name":"学校/社会融入阵营","status":"准备加入","evidence":"林七夜决定从特殊学校转入普通高中。"}],"key_interactions":[{"summary":"李医生复查林七夜失明原因。","evidence":"李医生追问炽天使。"}],"potential_conflicts":[{"issue":"林七夜的经历与医学判断冲突","evidence":"李医生认为这些说法像精神病人的妄想。"}]}]}`;
const truncatedSchemaEnvelope = parseAiResponseProtocol(truncatedSchemaEnvelopeRaw);
const truncatedCharacterBlock = truncatedSchemaEnvelope.blocks.find((block) => block.type === 'character_table');
assert.equal(truncatedSchemaEnvelope.parseError, undefined, 'one-missing-brace schema envelope should still parse as structured JSON');
assert.ok(truncatedCharacterBlock, 'truncated schema envelope should not degrade to an inner object and lose the character table');
assert.ok(JSON.stringify(truncatedCharacterBlock).includes('学校/社会融入阵营'), 'truncated schema envelope should preserve nested faction rows');
assert.ok(renderBlockPlainText(truncatedCharacterBlock).includes('李医生'), 'character relation tables should produce useful plain text for fold summaries');
assert.ok(truncatedSchemaEnvelope.blocks.some((block) => block.type === 'timeline' && renderBlockPlainText(block).includes('复查')), 'truncated schema envelope should preserve nested key interactions');

const missingCharacterArrayCloserRaw = `{"bookmind.ai.response.v2":{"scope":"chapter","scope_label":"第2章 月亮上的天使","diagnostics":[],"characters":[{"name":"林七夜","relations":[{"target":"李医生","type":"患者-医生/复查关系","evidence":"李医生对林七夜进行复查。"}],"factions":[{"name":"家庭/支持阵营","status":"核心成员","evidence":"共同组成一个家。"}],"key_interactions":[{"summary":"李医生复查林七夜失明原因。","evidence":"追问。"}],"potential_conflicts":[{"issue":"林七夜的经历与医学判断冲突","evidence":"李医生认为像妄想。"}]}}`;
const missingCharacterArrayCloser = parseAiResponseProtocol(missingCharacterArrayCloserRaw);
const repairedCharacterBlock = missingCharacterArrayCloser.blocks.find((block) => block.type === 'character_table');
assert.equal(missingCharacterArrayCloser.parseError, undefined, 'schema JSON with one missing array closer should be repaired before markdown fallback');
assert.ok(repairedCharacterBlock, 'schema JSON with one missing characters array closer should keep the character table');
assert.ok(JSON.stringify(repairedCharacterBlock).includes('家庭/支持阵营'), 'repaired schema JSON should keep nested faction data');
