use encoding_rs::{GB18030, UTF_16BE, UTF_16LE, UTF_8};
use std::path::Path;
use std::{
    fs,
    io::{BufReader, Read},
};

pub(crate) fn read_book_content(path: &Path) -> Result<String, String> {
    read_book_content_with_mode(path, "auto")
}

pub(super) fn read_book_content_with_mode(path: &Path, mode: &str) -> Result<String, String> {
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    let text = match extension.as_str() {
        "txt" | "md" | "markdown" => {
            let mut stream = TxtLineStream::new(path, mode)?;
            let mut text = String::new();
            let mut first = true;
            while let Some((line, _units)) = stream.next_line()? {
                if !first {
                    text.push('\n');
                }
                first = false;
                text.push_str(&line);
            }
            text
        }
        "epub" => super::decode_epub_file(path)?,
        "mobi" => super::decode_mobi_file(path)?,
        "pdf" => super::decode_pdf_file(path)?,
        _ => return Err(format!("不支持的阅读格式：{}", path.display())),
    };
    if text.trim().is_empty() {
        return Err(format!("无法解码书籍文件：{} 解码结果为空", path.display()));
    }
    Ok(text)
}

pub(crate) fn decode_txt_bytes(bytes: &[u8]) -> Result<String, String> {
    decode_txt_bytes_with_mode(bytes, "auto")
}

pub(crate) fn read_book_lines_with_mode(
    path: &Path,
    mode: &str,
    mut on_line: impl FnMut(&str) -> Result<(), String>,
) -> Result<usize, String> {
    let mut stream = BookLineStream::new(path, mode)?;
    let mut count = 0usize;
    while let Some((line, _units)) = stream.next_line()? {
        on_line(&line)?;
        count += 1;
    }
    Ok(count)
}

pub(crate) fn read_book_lines(
    path: &Path,
    on_line: impl FnMut(&str) -> Result<(), String>,
) -> Result<usize, String> {
    read_book_lines_with_mode(path, "auto", on_line)
}

pub(crate) struct BookLineStream {
    lines: Vec<String>,
    index: usize,
}

impl BookLineStream {
    pub(crate) fn new(path: &Path, mode: &str) -> Result<Self, String> {
        let text = read_book_content_with_mode(path, mode)?;
        let lines = text
            .replace("\r\n", "\n")
            .replace('\r', "\n")
            .split('\n')
            .map(|line| line.to_string())
            .collect::<Vec<_>>();
        Ok(Self { lines, index: 0 })
    }

    pub(crate) fn next_line(&mut self) -> Result<Option<(String, usize)>, String> {
        if self.index >= self.lines.len() {
            return Ok(None);
        }
        let line = self.lines[self.index].clone();
        self.index += 1;
        let units = line.chars().count().max(1);
        Ok(Some((line, units)))
    }
}

pub(super) fn decode_txt_bytes_with_mode(bytes: &[u8], mode: &str) -> Result<String, String> {
    let candidates = if bytes.starts_with(&[0xEF, 0xBB, 0xBF]) {
        vec![("UTF-8 BOM", UTF_8, 3usize)]
    } else if bytes.starts_with(&[0xFF, 0xFE]) {
        vec![("UTF-16LE BOM", UTF_16LE, 2usize)]
    } else if bytes.starts_with(&[0xFE, 0xFF]) {
        vec![("UTF-16BE BOM", UTF_16BE, 2usize)]
    } else if mode == "utf-8" {
        vec![("UTF-8", UTF_8, 0usize)]
    } else if mode == "gb18030" {
        vec![("GB18030", GB18030, 0usize)]
    } else {
        vec![("UTF-8", UTF_8, 0usize), ("GB18030", GB18030, 0usize)]
    };

    let mut best: Option<(String, usize, &'static str)> = None;

    for (name, encoding, offset) in candidates {
        let input = bytes.get(offset..).unwrap_or_default();
        let (decoded, _, had_errors) = encoding.decode(input);
        let text = decoded.into_owned();
        let replacement_count = text.matches('\u{FFFD}').count();
        let mojibake_score = count_mojibake_markers(&text);
        let score = replacement_count * 20 + mojibake_score + if had_errors { 10_000 } else { 0 };

        if best
            .as_ref()
            .map_or(true, |(_, best_score, _)| score < *best_score)
        {
            best = Some((text, score, name));
        }
    }

    let (text, score, encoding_name) =
        best.ok_or_else(|| "无法解码 TXT 文件：没有可用编码候选".to_string())?;
    if text.trim().is_empty() {
        return Err(format!("无法解码 TXT 文件：{encoding_name} 解码结果为空"));
    }
    if score >= 10_000 {
        return Err(format!(
            "无法可靠解码 TXT 文件：{encoding_name} 出现不可恢复编码错误"
        ));
    }

    Ok(text)
}

const TXT_ENCODING_SAMPLE_BYTES: usize = 64 * 1024;

fn detect_txt_encoding_choice(
    sample: &[u8],
    mode: &str,
) -> Result<(&'static encoding_rs::Encoding, usize), String> {
    let candidates = if sample.starts_with(&[0xEF, 0xBB, 0xBF]) {
        vec![("UTF-8 BOM", UTF_8, 3usize)]
    } else if sample.starts_with(&[0xFF, 0xFE]) {
        vec![("UTF-16LE BOM", UTF_16LE, 2usize)]
    } else if sample.starts_with(&[0xFE, 0xFF]) {
        vec![("UTF-16BE BOM", UTF_16BE, 2usize)]
    } else if mode == "utf-8" {
        vec![("UTF-8", UTF_8, 0usize)]
    } else if mode == "gb18030" {
        vec![("GB18030", GB18030, 0usize)]
    } else {
        vec![("UTF-8", UTF_8, 0usize), ("GB18030", GB18030, 0usize)]
    };

    let mut best: Option<(usize, &'static encoding_rs::Encoding, usize)> = None;
    for (_, encoding, offset) in candidates {
        let input = sample.get(offset..).unwrap_or_default();
        let (decoded, _, had_errors) = encoding.decode(input);
        let text = decoded.into_owned();
        let replacement_count = text.matches('\u{FFFD}').count();
        let mojibake_score = count_mojibake_markers(&text);
        let score = replacement_count * 20 + mojibake_score + if had_errors { 10_000 } else { 0 };
        if best
            .as_ref()
            .map_or(true, |(best_score, _, _)| score < *best_score)
        {
            best = Some((score, encoding, offset));
        }
    }
    let (_, encoding, offset) =
        best.ok_or_else(|| "无法解码 TXT 文件：没有可用编码候选".to_string())?;
    Ok((encoding, offset))
}

fn count_mojibake_markers(text: &str) -> usize {
    text.chars()
        .filter(|ch| matches!(ch, '\u{FFFD}' | '锟' | '斤' | '拷'))
        .count()
}

pub(crate) struct TxtLineStream {
    reader: BufReader<fs::File>,
    path_display: String,
    decoder: encoding_rs::Decoder,
    buffer: [u8; 8192],
    pending: String,
    pending_cursor: usize,
    decoded: String,
    finished: bool,
}

impl TxtLineStream {
    pub(crate) fn new(path: &Path, mode: &str) -> Result<Self, String> {
        let file = fs::File::open(path)
            .map_err(|error| format!("无法读取书籍 {}: {error}", path.display()))?;
        let mut reader = BufReader::with_capacity(64 * 1024, file);
        let mut sample = vec![0u8; TXT_ENCODING_SAMPLE_BYTES];
        let read = reader
            .read(&mut sample)
            .map_err(|error| format!("无法读取书籍 {}: {error}", path.display()))?;
        sample.truncate(read);
        if sample.is_empty() {
            return Err(format!("无法解码 TXT 文件：{} 为空", path.display()));
        }
        let (encoding, offset) = detect_txt_encoding_choice(&sample, mode)?;
        let mut pending = String::new();
        let mut decoder = encoding.new_decoder_without_bom_handling();
        if offset < sample.len() {
            pending.reserve(
                decoder
                    .max_utf8_buffer_length_without_replacement(sample.len() - offset)
                    .unwrap_or(sample.len() - offset),
            );
            let _ = decoder.decode_to_string(&sample[offset..], &mut pending, false);
        }
        Ok(Self {
            reader,
            path_display: path.display().to_string(),
            decoder,
            buffer: [0u8; 8192],
            pending,
            pending_cursor: 0,
            decoded: String::new(),
            finished: false,
        })
    }

    pub(crate) fn next_line(&mut self) -> Result<Option<(String, usize)>, String> {
        loop {
            if let Some(line_end) = self.pending[self.pending_cursor..].find('\n') {
                let line_end = self.pending_cursor + line_end;
                let mut line = self.pending[self.pending_cursor..line_end].to_string();
                self.pending_cursor = line_end + 1;
                if line.ends_with('\r') {
                    line.pop();
                }
                if self.pending_cursor > 32 * 1024 && self.pending_cursor >= self.pending.len() / 2
                {
                    self.pending.drain(..self.pending_cursor);
                    self.pending_cursor = 0;
                }
                let units = line.chars().count().max(1);
                return Ok(Some((line, units)));
            }
            if self.finished {
                if self.pending_cursor >= self.pending.len() {
                    return Ok(None);
                }
                let mut line = self.pending[self.pending_cursor..].to_string();
                self.pending.clear();
                self.pending_cursor = 0;
                if line.ends_with('\r') {
                    line.pop();
                }
                let units = line.chars().count().max(1);
                return Ok(Some((line, units)));
            }

            let read = self
                .reader
                .read(&mut self.buffer)
                .map_err(|error| format!("无法读取书籍 {}: {error}", self.path_display))?;
            if read == 0 {
                self.decoded.clear();
                let reserve = self
                    .decoder
                    .max_utf8_buffer_length_without_replacement(0)
                    .unwrap_or(0)
                    .max(8);
                self.decoded.reserve(reserve);
                let _ = self.decoder.decode_to_string(&[], &mut self.decoded, true);
                self.pending.push_str(&self.decoded);
                self.finished = true;
                continue;
            }
            self.decoded.clear();
            let reserve = self
                .decoder
                .max_utf8_buffer_length_without_replacement(read)
                .unwrap_or(read)
                .max(8);
            self.decoded.reserve(reserve);
            let _ = self
                .decoder
                .decode_to_string(&self.buffer[..read], &mut self.decoded, false);
            self.pending.push_str(&self.decoded);
        }
    }
}
