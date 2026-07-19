use crate::models::{BookRecord, TextChunkRecord};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) struct IndexChunkingOptions {
    pub(crate) target_chars: usize,
    pub(crate) overlap_chars: usize,
    pub(crate) strategy_version: u32,
}

impl IndexChunkingOptions {
    pub(crate) fn new(target_chars: usize, overlap_chars: usize, strategy_version: u32) -> Self {
        let target_chars = target_chars.clamp(200, 5000);
        let overlap_chars = overlap_chars.min(1000).min(target_chars.saturating_sub(1));
        Self {
            target_chars,
            overlap_chars,
            strategy_version: strategy_version.max(1),
        }
    }
}

impl Default for IndexChunkingOptions {
    fn default() -> Self {
        Self {
            target_chars: 700,
            overlap_chars: 0,
            strategy_version: 1,
        }
    }
}

#[cfg(test)]
pub(crate) fn split_text_into_chunks(book: &BookRecord, text: &str) -> Vec<TextChunkRecord> {
    split_text_into_chunks_with_cancel(book, text, || false)
        .expect("uncancellable chunk split should not be cancelled")
}

pub(crate) fn split_text_into_chunks_with_cancel(
    book: &BookRecord,
    text: &str,
    should_cancel: impl Fn() -> bool,
) -> Result<Vec<TextChunkRecord>, String> {
    split_text_into_chunks_with_options_and_cancel(
        book,
        text,
        IndexChunkingOptions::default(),
        should_cancel,
    )
}

pub(crate) fn split_text_into_chunks_with_options_and_cancel(
    book: &BookRecord,
    text: &str,
    options: IndexChunkingOptions,
    should_cancel: impl Fn() -> bool,
) -> Result<Vec<TextChunkRecord>, String> {
    split_text_into_chunks_with_options_cancel_and_progress(
        book,
        text,
        options,
        should_cancel,
        |_chunk_count, _processed_lines, _total_lines| {},
    )
}

pub(crate) fn split_text_into_chunks_with_options_cancel_and_visit(
    book: &BookRecord,
    text: &str,
    options: IndexChunkingOptions,
    should_cancel: impl Fn() -> bool,
    mut on_chunk: impl FnMut(TextChunkRecord) -> Result<(), String>,
    mut on_progress: impl FnMut(usize, usize, usize),
) -> Result<(), String> {
    let options = IndexChunkingOptions::new(
        options.target_chars,
        options.overlap_chars,
        options.strategy_version,
    );
    let mut chunk_count = 0usize;
    let mut chapter = "正文".to_string();
    let mut chapter_index = 0usize;
    let mut buffer = String::new();
    let mut buffer_char_count = 0usize;
    let mut buffer_segments: Vec<ChunkBufferSegment> = Vec::new();
    let mut paragraph_start = 0usize;
    let mut paragraph_end = 0usize;
    let mut current_paragraph = 0usize;
    let mut chunk_char_start = 0usize;
    let mut current_char = 0usize;
    let mut ordinal = 0usize;
    let total_lines = text.lines().count().max(1);
    let progress_interval = (total_lines / 100).max(25);
    let mut last_progress_line = 0usize;
    let mut last_stop_check_line = 0usize;

    if should_cancel() {
        return Err("用户取消任务".to_string());
    }

    for (line_index, line) in text.lines().enumerate() {
        let processed_lines = line_index + 1;
        if should_check_chunk_stop(processed_lines, last_stop_check_line, progress_interval)
            && should_cancel()
        {
            return Err("用户取消任务".to_string());
        }
        if processed_lines.saturating_sub(last_stop_check_line) >= progress_interval {
            last_stop_check_line = processed_lines;
        }
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        if is_chapter_heading(trimmed) && !buffer.is_empty() {
            on_chunk(build_chunk_record(
                book,
                &chapter,
                chapter_index,
                paragraph_start,
                paragraph_end,
                chunk_char_start,
                current_char,
                ordinal,
                &buffer,
                options.strategy_version,
            ))?;
            ordinal += 1;
            chunk_count += 1;
            emit_chunk_progress(
                &mut on_progress,
                chunk_count,
                processed_lines,
                total_lines,
                &mut last_progress_line,
                progress_interval,
                false,
            );
            buffer.clear();
            buffer_char_count = 0;
            buffer_segments.clear();
            chapter = trimmed.to_string();
            chapter_index += 1;
            paragraph_start = current_paragraph;
            paragraph_end = current_paragraph;
            chunk_char_start = current_char;
        } else if is_chapter_heading(trimmed) {
            chapter = trimmed.to_string();
        } else {
            if !buffer.is_empty() {
                buffer.push('\n');
            }
            let paragraph_char_start = current_char;
            buffer.push_str(trimmed);
            let paragraph_chars = trimmed.chars().count();
            let paragraph_char_end = paragraph_char_start + paragraph_chars;
            current_char = paragraph_char_end;
            buffer_char_count += paragraph_chars;
            paragraph_end = current_paragraph;
            buffer_segments.push(ChunkBufferSegment {
                text: trimmed.to_string(),
                paragraph_index: current_paragraph,
                char_start: paragraph_char_start,
                char_end: paragraph_char_end,
            });
            current_paragraph += 1;
            if processed_lines % progress_interval == 0 {
                emit_chunk_progress(
                    &mut on_progress,
                    chunk_count,
                    processed_lines,
                    total_lines,
                    &mut last_progress_line,
                    progress_interval,
                    false,
                );
            }
            if buffer_char_count >= options.target_chars {
                on_chunk(build_chunk_record(
                    book,
                    &chapter,
                    chapter_index,
                    paragraph_start,
                    paragraph_end,
                    chunk_char_start,
                    current_char,
                    ordinal,
                    &buffer,
                    options.strategy_version,
                ))?;
                ordinal += 1;
                chunk_count += 1;
                emit_chunk_progress(
                    &mut on_progress,
                    chunk_count,
                    processed_lines,
                    total_lines,
                    &mut last_progress_line,
                    progress_interval,
                    false,
                );
                let retained = retain_overlap_segments(&buffer_segments, options.overlap_chars);
                if retained.is_empty() {
                    buffer.clear();
                    buffer_char_count = 0;
                    buffer_segments.clear();
                    paragraph_start = current_paragraph;
                    paragraph_end = current_paragraph;
                    chunk_char_start = current_char;
                } else {
                    buffer = retained
                        .iter()
                        .map(|segment| segment.text.as_str())
                        .collect::<Vec<_>>()
                        .join("\n");
                    buffer_char_count = retained
                        .iter()
                        .map(|segment| segment.char_end.saturating_sub(segment.char_start))
                        .sum();
                    paragraph_start = retained
                        .first()
                        .map(|segment| segment.paragraph_index)
                        .unwrap_or(current_paragraph);
                    paragraph_end = retained
                        .last()
                        .map(|segment| segment.paragraph_index)
                        .unwrap_or(current_paragraph);
                    chunk_char_start = retained
                        .first()
                        .map(|segment| segment.char_start)
                        .unwrap_or(current_char);
                    buffer_segments = retained;
                }
            }
        }
    }

    if !buffer.is_empty() {
        if should_cancel() {
            return Err("用户取消任务".to_string());
        }
        on_chunk(build_chunk_record(
            book,
            &chapter,
            chapter_index,
            paragraph_start,
            paragraph_end,
            chunk_char_start,
            current_char,
            ordinal,
            &buffer,
            options.strategy_version,
        ))?;
        chunk_count += 1;
        emit_chunk_progress(
            &mut on_progress,
            chunk_count,
            total_lines,
            total_lines,
            &mut last_progress_line,
            progress_interval,
            true,
        );
    }
    Ok(())
}

pub(crate) fn split_text_into_chunks_with_line_provider_cancel_and_visit(
    book: &BookRecord,
    options: IndexChunkingOptions,
    should_cancel: impl Fn() -> bool,
    total_units: usize,
    mut next_line: impl FnMut() -> Result<Option<(String, usize)>, String>,
    mut on_chunk: impl FnMut(TextChunkRecord) -> Result<(), String>,
    mut on_progress: impl FnMut(usize, usize, usize),
) -> Result<(), String> {
    let options = IndexChunkingOptions::new(
        options.target_chars,
        options.overlap_chars,
        options.strategy_version,
    );
    let total_units = total_units.max(1);
    let mut chunk_count = 0usize;
    let mut chapter = "正文".to_string();
    let mut chapter_index = 0usize;
    let mut buffer = String::new();
    let mut buffer_char_count = 0usize;
    let mut buffer_segments: Vec<ChunkBufferSegment> = Vec::new();
    let mut paragraph_start = 0usize;
    let mut paragraph_end = 0usize;
    let mut current_paragraph = 0usize;
    let mut chunk_char_start = 0usize;
    let mut current_char = 0usize;
    let mut ordinal = 0usize;
    let progress_interval = (total_units / 100).max(25);
    let mut last_progress_unit = 0usize;
    let mut last_stop_check_unit = 0usize;
    let mut processed_units = 0usize;

    if should_cancel() {
        return Err("用户取消任务".to_string());
    }

    while let Some((line, line_units)) = next_line()? {
        processed_units = processed_units.saturating_add(line_units.max(1));
        if processed_units == 1
            || processed_units.saturating_sub(last_stop_check_unit) >= progress_interval
        {
            last_stop_check_unit = processed_units;
            if should_cancel() {
                return Err("用户取消任务".to_string());
            }
        }
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        if is_chapter_heading(trimmed) && !buffer.is_empty() {
            on_chunk(build_chunk_record(
                book,
                &chapter,
                chapter_index,
                paragraph_start,
                paragraph_end,
                chunk_char_start,
                current_char,
                ordinal,
                &buffer,
                options.strategy_version,
            ))?;
            ordinal += 1;
            chunk_count += 1;
            emit_chunk_progress(
                &mut on_progress,
                chunk_count,
                processed_units.min(total_units),
                total_units,
                &mut last_progress_unit,
                progress_interval,
                false,
            );
            buffer.clear();
            buffer_char_count = 0;
            buffer_segments.clear();
            chapter = trimmed.to_string();
            chapter_index += 1;
            paragraph_start = current_paragraph;
            paragraph_end = current_paragraph;
            chunk_char_start = current_char;
        } else if is_chapter_heading(trimmed) {
            chapter = trimmed.to_string();
        } else {
            if !buffer.is_empty() {
                buffer.push('\n');
            }
            let paragraph_char_start = current_char;
            buffer.push_str(trimmed);
            let paragraph_chars = trimmed.chars().count();
            let paragraph_char_end = paragraph_char_start + paragraph_chars;
            current_char = paragraph_char_end;
            buffer_char_count += paragraph_chars;
            paragraph_end = current_paragraph;
            buffer_segments.push(ChunkBufferSegment {
                text: trimmed.to_string(),
                paragraph_index: current_paragraph,
                char_start: paragraph_char_start,
                char_end: paragraph_char_end,
            });
            current_paragraph += 1;
            if processed_units % progress_interval == 0 {
                emit_chunk_progress(
                    &mut on_progress,
                    chunk_count,
                    processed_units.min(total_units),
                    total_units,
                    &mut last_progress_unit,
                    progress_interval,
                    false,
                );
            }
            if buffer_char_count >= options.target_chars {
                on_chunk(build_chunk_record(
                    book,
                    &chapter,
                    chapter_index,
                    paragraph_start,
                    paragraph_end,
                    chunk_char_start,
                    current_char,
                    ordinal,
                    &buffer,
                    options.strategy_version,
                ))?;
                ordinal += 1;
                chunk_count += 1;
                emit_chunk_progress(
                    &mut on_progress,
                    chunk_count,
                    processed_units.min(total_units),
                    total_units,
                    &mut last_progress_unit,
                    progress_interval,
                    false,
                );
                let retained = retain_overlap_segments(&buffer_segments, options.overlap_chars);
                if retained.is_empty() {
                    buffer.clear();
                    buffer_char_count = 0;
                    buffer_segments.clear();
                    paragraph_start = current_paragraph;
                    paragraph_end = current_paragraph;
                    chunk_char_start = current_char;
                } else {
                    buffer = retained
                        .iter()
                        .map(|segment| segment.text.as_str())
                        .collect::<Vec<_>>()
                        .join("\n");
                    buffer_char_count = retained
                        .iter()
                        .map(|segment| segment.char_end.saturating_sub(segment.char_start))
                        .sum();
                    paragraph_start = retained
                        .first()
                        .map(|segment| segment.paragraph_index)
                        .unwrap_or(current_paragraph);
                    paragraph_end = retained
                        .last()
                        .map(|segment| segment.paragraph_index)
                        .unwrap_or(current_paragraph);
                    chunk_char_start = retained
                        .first()
                        .map(|segment| segment.char_start)
                        .unwrap_or(current_char);
                    buffer_segments = retained;
                }
            }
        }
    }

    if !buffer.is_empty() {
        if should_cancel() {
            return Err("用户取消任务".to_string());
        }
        on_chunk(build_chunk_record(
            book,
            &chapter,
            chapter_index,
            paragraph_start,
            paragraph_end,
            chunk_char_start,
            current_char,
            ordinal,
            &buffer,
            options.strategy_version,
        ))?;
        chunk_count += 1;
        emit_chunk_progress(
            &mut on_progress,
            chunk_count,
            total_units,
            total_units,
            &mut last_progress_unit,
            progress_interval,
            true,
        );
    }
    Ok(())
}

pub(crate) fn split_text_into_chunks_with_options_cancel_and_progress(
    book: &BookRecord,
    text: &str,
    options: IndexChunkingOptions,
    should_cancel: impl Fn() -> bool,
    mut on_progress: impl FnMut(usize, usize, usize),
) -> Result<Vec<TextChunkRecord>, String> {
    let options = IndexChunkingOptions::new(
        options.target_chars,
        options.overlap_chars,
        options.strategy_version,
    );
    let mut chunks = Vec::new();
    let mut chapter = "正文".to_string();
    let mut chapter_index = 0usize;
    let mut buffer = String::new();
    let mut buffer_char_count = 0usize;
    let mut buffer_segments: Vec<ChunkBufferSegment> = Vec::new();
    let mut paragraph_start = 0usize;
    let mut paragraph_end = 0usize;
    let mut current_paragraph = 0usize;
    let mut chunk_char_start = 0usize;
    let mut current_char = 0usize;
    let mut ordinal = 0usize;
    let total_lines = text.lines().count().max(1);
    let progress_interval = (total_lines / 100).max(25);
    let mut last_progress_line = 0usize;
    let mut last_stop_check_line = 0usize;

    if should_cancel() {
        return Err("用户取消任务".to_string());
    }

    for (line_index, line) in text.lines().enumerate() {
        let processed_lines = line_index + 1;
        if should_check_chunk_stop(processed_lines, last_stop_check_line, progress_interval)
            && should_cancel()
        {
            return Err("用户取消任务".to_string());
        }
        if processed_lines.saturating_sub(last_stop_check_line) >= progress_interval {
            last_stop_check_line = processed_lines;
        }
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        if is_chapter_heading(trimmed) && !buffer.is_empty() {
            chunks.push(build_chunk_record(
                book,
                &chapter,
                chapter_index,
                paragraph_start,
                paragraph_end,
                chunk_char_start,
                current_char,
                ordinal,
                &buffer,
                options.strategy_version,
            ));
            ordinal += 1;
            emit_chunk_progress(
                &mut on_progress,
                chunks.len(),
                processed_lines,
                total_lines,
                &mut last_progress_line,
                progress_interval,
                false,
            );
            buffer.clear();
            buffer_char_count = 0;
            buffer_segments.clear();
            chapter = trimmed.to_string();
            chapter_index += 1;
            paragraph_start = current_paragraph;
            paragraph_end = current_paragraph;
            chunk_char_start = current_char;
        } else if is_chapter_heading(trimmed) {
            chapter = trimmed.to_string();
        } else {
            if !buffer.is_empty() {
                buffer.push('\n');
            }
            let paragraph_char_start = current_char;
            buffer.push_str(trimmed);
            let paragraph_chars = trimmed.chars().count();
            let paragraph_char_end = paragraph_char_start + paragraph_chars;
            current_char = paragraph_char_end;
            buffer_char_count += paragraph_chars;
            paragraph_end = current_paragraph;
            buffer_segments.push(ChunkBufferSegment {
                text: trimmed.to_string(),
                paragraph_index: current_paragraph,
                char_start: paragraph_char_start,
                char_end: paragraph_char_end,
            });
            current_paragraph += 1;
            if processed_lines % progress_interval == 0 {
                emit_chunk_progress(
                    &mut on_progress,
                    chunks.len(),
                    processed_lines,
                    total_lines,
                    &mut last_progress_line,
                    progress_interval,
                    false,
                );
            }
            if buffer_char_count >= options.target_chars {
                chunks.push(build_chunk_record(
                    book,
                    &chapter,
                    chapter_index,
                    paragraph_start,
                    paragraph_end,
                    chunk_char_start,
                    current_char,
                    ordinal,
                    &buffer,
                    options.strategy_version,
                ));
                ordinal += 1;
                emit_chunk_progress(
                    &mut on_progress,
                    chunks.len(),
                    processed_lines,
                    total_lines,
                    &mut last_progress_line,
                    progress_interval,
                    false,
                );
                let retained = retain_overlap_segments(&buffer_segments, options.overlap_chars);
                if retained.is_empty() {
                    buffer.clear();
                    buffer_char_count = 0;
                    buffer_segments.clear();
                    paragraph_start = current_paragraph;
                    paragraph_end = current_paragraph;
                    chunk_char_start = current_char;
                } else {
                    buffer = retained
                        .iter()
                        .map(|segment| segment.text.as_str())
                        .collect::<Vec<_>>()
                        .join("\n");
                    buffer_char_count = retained
                        .iter()
                        .map(|segment| segment.char_end.saturating_sub(segment.char_start))
                        .sum();
                    paragraph_start = retained
                        .first()
                        .map(|segment| segment.paragraph_index)
                        .unwrap_or(current_paragraph);
                    paragraph_end = retained
                        .last()
                        .map(|segment| segment.paragraph_index)
                        .unwrap_or(current_paragraph);
                    chunk_char_start = retained
                        .first()
                        .map(|segment| segment.char_start)
                        .unwrap_or(current_char);
                    buffer_segments = retained;
                }
            }
        }
    }

    if !buffer.is_empty() {
        if should_cancel() {
            return Err("用户取消任务".to_string());
        }
        chunks.push(build_chunk_record(
            book,
            &chapter,
            chapter_index,
            paragraph_start,
            paragraph_end,
            chunk_char_start,
            current_char,
            ordinal,
            &buffer,
            options.strategy_version,
        ));
        emit_chunk_progress(
            &mut on_progress,
            ordinal + 1,
            total_lines,
            total_lines,
            &mut last_progress_line,
            progress_interval,
            true,
        );
    }
    Ok(chunks)
}

fn should_check_chunk_stop(
    processed_lines: usize,
    last_stop_check_line: usize,
    progress_interval: usize,
) -> bool {
    processed_lines == 1
        || processed_lines.saturating_sub(last_stop_check_line) >= progress_interval
}

fn emit_chunk_progress(
    on_progress: &mut impl FnMut(usize, usize, usize),
    chunk_count: usize,
    processed_lines: usize,
    total_lines: usize,
    last_progress_line: &mut usize,
    progress_interval: usize,
    force: bool,
) {
    if !force && processed_lines.saturating_sub(*last_progress_line) < progress_interval {
        return;
    }
    *last_progress_line = processed_lines;
    on_progress(chunk_count, processed_lines, total_lines);
}

#[derive(Clone, Debug)]
struct ChunkBufferSegment {
    text: String,
    paragraph_index: usize,
    char_start: usize,
    char_end: usize,
}

fn retain_overlap_segments(
    segments: &[ChunkBufferSegment],
    overlap_chars: usize,
) -> Vec<ChunkBufferSegment> {
    if overlap_chars == 0 || segments.is_empty() {
        return Vec::new();
    }
    let mut retained = Vec::new();
    let mut retained_chars = 0usize;
    for segment in segments.iter().rev() {
        let segment_chars = segment.char_end.saturating_sub(segment.char_start);
        if !retained.is_empty() && retained_chars + segment_chars > overlap_chars {
            break;
        }
        retained_chars += segment_chars;
        retained.push(segment.clone());
        if retained_chars >= overlap_chars {
            break;
        }
    }
    retained.reverse();
    retained
}

fn is_chapter_heading(line: &str) -> bool {
    let trimmed = line.trim();
    if !trimmed.starts_with("第") || trimmed.chars().count() > 48 {
        return false;
    }
    if trimmed.contains('。')
        || trimmed.contains('！')
        || trimmed.contains('？')
        || trimmed.contains('，')
        || trimmed.contains('；')
        || trimmed.contains('：')
        || trimmed.contains('“')
        || trimmed.contains('”')
        || trimmed.contains('、')
    {
        return false;
    }
    trimmed.contains('章') || trimmed.contains('节') || trimmed.contains('卷')
}

fn build_chunk_record(
    book: &BookRecord,
    chapter: &str,
    chapter_index: usize,
    paragraph_start: usize,
    paragraph_end: usize,
    char_start: usize,
    char_end: usize,
    ordinal: usize,
    text: &str,
    chunk_strategy_version: u32,
) -> TextChunkRecord {
    TextChunkRecord {
        id: format!(
            "{book_id}:c{chapter_index}:p{paragraph_start}-{paragraph_end}:k{ordinal}",
            book_id = book.id
        ),
        book_id: book.id.clone(),
        book_title: book.display_title.clone(),
        chapter: chapter.to_string(),
        ordinal,
        text: text.to_string(),
        chapter_index,
        chapter_title: chapter.to_string(),
        paragraph_start,
        paragraph_end,
        char_start,
        char_end,
        content_hash: book.content_hash.clone(),
        chunk_strategy_version,
        created_at: crate::tasks::now_millis_string_for_records(),
    }
}
