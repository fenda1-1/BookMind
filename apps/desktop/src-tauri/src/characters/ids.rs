pub(super) fn stable_character_id(book_id: &str, name: &str) -> String {
    format!("character-{}", stable_hash(&format!("{book_id}:{name}")))
}

pub(super) fn stable_relation_id(
    book_id: &str,
    source_character_id: &str,
    target_character_id: &str,
    relation_type: &str,
) -> String {
    format!(
        "relation-{}",
        stable_hash(&format!(
            "{book_id}:{source_character_id}:{target_character_id}:{relation_type}"
        ))
    )
}

pub(super) fn stable_hash(value: &str) -> String {
    let mut hash: u64 = 0xcbf29ce484222325;
    for byte in value.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("{hash:016x}")
}

pub(super) fn relation_evidence_index(id: &str) -> usize {
    id.rsplit("-evidence-")
        .next()
        .and_then(|value| value.parse::<usize>().ok())
        .unwrap_or(usize::MAX)
}
