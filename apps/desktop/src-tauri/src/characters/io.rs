use std::{
    fs,
    io::{BufRead, BufReader, Read},
    path::Path,
};

pub(super) fn write_json_file<T: serde::Serialize + ?Sized>(
    path: &Path,
    value: &T,
) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("无法创建人物中心目录 {}: {error}", parent.display()))?;
    }
    let raw = serde_json::to_string_pretty(value)
        .map_err(|error| format!("无法序列化人物中心数据: {error}"))?;
    let temp_path = path.with_extension("json.tmp");
    fs::write(&temp_path, raw)
        .map_err(|error| format!("无法写入人物中心临时文件 {}: {error}", temp_path.display()))?;
    fs::rename(&temp_path, path)
        .map_err(|error| format!("无法替换人物中心文件 {}: {error}", path.display()))
}

pub(super) fn write_jsonl_file<T: serde::Serialize>(
    path: &Path,
    items: &[T],
) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("无法创建人物中心目录 {}: {error}", parent.display()))?;
    }
    let mut raw = String::new();
    for item in items {
        raw.push_str(
            &serde_json::to_string(item)
                .map_err(|error| format!("无法序列化人物中心 JSONL: {error}"))?,
        );
        raw.push('\n');
    }
    let temp_path = path.with_extension("jsonl.tmp");
    fs::write(&temp_path, raw)
        .map_err(|error| format!("无法写入人物中心临时文件 {}: {error}", temp_path.display()))?;
    fs::rename(&temp_path, path)
        .map_err(|error| format!("无法替换人物中心文件 {}: {error}", path.display()))
}

pub(super) fn read_json_file<T: serde::de::DeserializeOwned>(path: &Path) -> Result<T, String> {
    let raw = fs::read_to_string(path)
        .map_err(|error| format!("无法读取人物中心文件 {}: {error}", path.display()))?;
    serde_json::from_str(&raw)
        .map_err(|error| format!("无法解析人物中心文件 {}: {error}", path.display()))
}

pub(super) fn read_limited_json_array_file<T: serde::de::DeserializeOwned>(
    path: &Path,
    limit: usize,
    max_item_bytes: usize,
    item_label: &str,
) -> Result<Vec<T>, String> {
    if !path.exists() {
        return Ok(Vec::new());
    }
    let file = fs::File::open(path)
        .map_err(|error| format!("无法读取人物中心文件 {}: {error}", path.display()))?;
    let mut reader = BufReader::new(file);
    let mut items = Vec::new();
    let mut byte = [0u8; 1];
    read_until_json_array_start(path, &mut reader, &mut byte)?;
    while items.len() < limit {
        let Some(next_byte) = read_next_json_array_value_start(path, &mut reader, &mut byte)?
        else {
            break;
        };
        let raw_item = read_json_object_bytes(
            path,
            &mut reader,
            &mut byte,
            next_byte,
            max_item_bytes,
            item_label,
        )?;
        items.push(
            serde_json::from_slice(&raw_item)
                .map_err(|error| format!("无法解析人物中心文件 {}: {error}", path.display()))?,
        );
    }
    Ok(items)
}

fn read_until_json_array_start<R: Read>(
    path: &Path,
    reader: &mut R,
    byte: &mut [u8; 1],
) -> Result<(), String> {
    loop {
        match reader.read(byte) {
            Ok(0) => {
                return Err(format!(
                    "无法解析人物中心文件 {}: 缺少 JSON 数组起始符",
                    path.display()
                ));
            }
            Ok(_) if byte[0].is_ascii_whitespace() => continue,
            Ok(_) if byte[0] == b'[' => return Ok(()),
            Ok(_) => {
                return Err(format!(
                    "无法解析人物中心文件 {}: 预期 JSON 数组",
                    path.display()
                ));
            }
            Err(error) => {
                return Err(format!("无法读取人物中心文件 {}: {error}", path.display()));
            }
        }
    }
}

fn read_next_json_array_value_start<R: Read>(
    path: &Path,
    reader: &mut R,
    byte: &mut [u8; 1],
) -> Result<Option<u8>, String> {
    loop {
        match reader.read(byte) {
            Ok(0) => {
                return Err(format!(
                    "无法解析人物中心文件 {}: JSON 数组未闭合",
                    path.display()
                ));
            }
            Ok(_) if byte[0].is_ascii_whitespace() || byte[0] == b',' => continue,
            Ok(_) if byte[0] == b']' => return Ok(None),
            Ok(_) if byte[0] == b'{' => return Ok(Some(byte[0])),
            Ok(_) => {
                return Err(format!(
                    "无法解析人物中心文件 {}: 预期 JSON 对象",
                    path.display()
                ));
            }
            Err(error) => {
                return Err(format!("无法读取人物中心文件 {}: {error}", path.display()));
            }
        }
    }
}

fn read_json_object_bytes<R: Read>(
    path: &Path,
    reader: &mut R,
    byte: &mut [u8; 1],
    first_byte: u8,
    max_bytes: usize,
    item_label: &str,
) -> Result<Vec<u8>, String> {
    let mut raw_item = vec![first_byte];
    let mut depth = 1usize;
    let mut in_string = false;
    let mut escaped = false;
    while depth > 0 {
        match reader.read(byte) {
            Ok(0) => {
                return Err(format!(
                    "无法解析人物中心文件 {}: JSON 对象未闭合",
                    path.display()
                ));
            }
            Ok(_) => {
                let current = byte[0];
                raw_item.push(current);
                if raw_item.len() > max_bytes {
                    return Err(format!(
                        "无法解析人物中心文件 {}: {}超过安全读取上限",
                        path.display(),
                        item_label
                    ));
                }
                if in_string {
                    if escaped {
                        escaped = false;
                    } else if current == b'\\' {
                        escaped = true;
                    } else if current == b'"' {
                        in_string = false;
                    }
                    continue;
                }
                if current == b'"' {
                    in_string = true;
                } else if current == b'{' {
                    depth += 1;
                } else if current == b'}' {
                    depth = depth.saturating_sub(1);
                }
            }
            Err(error) => {
                return Err(format!("无法读取人物中心文件 {}: {error}", path.display()));
            }
        }
    }
    Ok(raw_item)
}

pub(super) fn read_limited_jsonl_file<T: serde::de::DeserializeOwned>(
    path: &Path,
    limit: usize,
) -> Result<Vec<T>, String> {
    if !path.exists() {
        return Ok(Vec::new());
    }
    let file = fs::File::open(path)
        .map_err(|error| format!("无法读取人物中心 JSONL {}: {error}", path.display()))?;
    let mut items = Vec::new();
    for line in BufReader::new(file).lines() {
        if items.len() >= limit {
            break;
        }
        let line =
            line.map_err(|error| format!("无法读取人物中心 JSONL {}: {error}", path.display()))?;
        if line.trim().is_empty() {
            continue;
        }
        items.push(
            serde_json::from_str(&line)
                .map_err(|error| format!("无法解析人物中心 JSONL {}: {error}", path.display()))?,
        );
    }
    Ok(items)
}
