use super::super::filters::is_non_character_candidate;
use super::fixtures::{
    character_test_book, extract_character_payload_for_test, payload_profile_names,
    unique_temp_library_dir,
};
use crate::characters::{extract_character_index_in, load_character_center_payload_in};
use crate::library::save_library_records;
use crate::models::{BookIndexManifest, TextChunkRecord};
use crate::paths::character_book_dir;
use crate::search::save_chunk_records;
use crate::tasks::save_index_manifest;
use std::fs;

#[test]
fn local_character_extraction_builds_profiles_mentions_and_evidence_from_indexed_chunks() {
    let dir = unique_temp_library_dir();
    let book = character_test_book("book-character-core", "人物核心", "sage");
    save_library_records(&dir, &[book.clone()]).expect("library should save");
    save_index_manifest(
        &dir,
        &[BookIndexManifest {
            book_id: book.id.clone(),
            book_title: book.display_title.clone(),
            content_hash: book.content_hash.clone(),
            status: "ready".to_string(),
            built_at: "1781100001000".to_string(),
            index_version: 1,
            chunk_strategy_version: 1,
            chapter_rule_version: 1,
            chunk_count: 2,
            fts_row_count: 2,
            ..BookIndexManifest::default()
        }],
    )
    .expect("text index manifest should save");
    save_chunk_records(
        &dir,
        &[
            TextChunkRecord {
                id: "character-chunk-1".to_string(),
                book_id: book.id.clone(),
                book_title: book.display_title.clone(),
                chapter: "第一章 夜幕".to_string(),
                ordinal: 0,
                text: "林七夜说道：“李医生，我看见赵空城了。”李医生看向林七夜，病房里一片安静。"
                    .to_string(),
                chapter_index: 0,
                chapter_title: "第一章 夜幕".to_string(),
                paragraph_start: 0,
                paragraph_end: 1,
                char_start: 0,
                char_end: 42,
                content_hash: "chunk-hash-1".to_string(),
                chunk_strategy_version: 1,
                created_at: "1781100002000".to_string(),
            },
            TextChunkRecord {
                id: "character-chunk-2".to_string(),
                book_id: book.id.clone(),
                book_title: book.display_title.clone(),
                chapter: "第二章 守夜人".to_string(),
                ordinal: 1,
                text: "赵空城低声说道，林七夜点了点头。李医生没有回答。".to_string(),
                chapter_index: 1,
                chapter_title: "第二章 守夜人".to_string(),
                paragraph_start: 2,
                paragraph_end: 3,
                char_start: 43,
                char_end: 70,
                content_hash: "chunk-hash-2".to_string(),
                chunk_strategy_version: 1,
                created_at: "1781100003000".to_string(),
            },
        ],
    )
    .expect("chunks should save");

    let payload = extract_character_index_in(&dir, &book.id)
        .expect("character index should build from indexed chunks");

    assert_eq!(payload.manifest.status, "ready");
    assert_eq!(payload.manifest.book_id, book.id);
    assert_eq!(payload.manifest.text_index_content_hash, book.content_hash);
    assert!(payload.profiles.len() >= 3);
    assert!(payload
        .profiles
        .iter()
        .any(|profile| profile.canonical_name == "林七夜" && profile.mention_count >= 2));
    assert!(payload
        .profiles
        .iter()
        .any(|profile| profile.canonical_name == "李医生"));
    assert!(payload
        .profiles
        .iter()
        .any(|profile| profile.canonical_name == "赵空城"));
    assert!(!payload
        .profiles
        .iter()
        .any(|profile| profile.canonical_name == "病房"));
    assert!(payload.mentions.iter().any(|mention| {
        mention.name == "林七夜"
            && mention.location.chunk_id == "character-chunk-1"
            && mention.location.source_chapter_index == 0
            && mention.location.paragraph_index == 0
            && mention.location.end_offset > mention.location.start_offset
    }));
    let first_lin_mention = payload
        .mentions
        .iter()
        .find(|mention| {
            mention.name == "林七夜" && mention.location.chunk_id == "character-chunk-1"
        })
        .expect("first chunk should include 林七夜 mention");
    assert_eq!(first_lin_mention.location.start_offset, 0);
    assert_eq!(first_lin_mention.location.end_offset, 3);
    let li_doctor_mention = payload
        .mentions
        .iter()
        .find(|mention| {
            mention.name == "李医生" && mention.location.chunk_id == "character-chunk-1"
        })
        .expect("first chunk should include 李医生 mention");
    assert_eq!(
        li_doctor_mention.location.start_offset,
        "林七夜说道：“".chars().count()
    );
    assert_eq!(
        li_doctor_mention.location.end_offset,
        "林七夜说道：“李医生".chars().count()
    );
    assert!(payload.evidence.len() >= payload.mentions.len());
    assert!(payload.manifest.relation_count >= 1);
    assert!(!payload.relations.is_empty());
    assert!(payload.evidence.iter().any(|evidence| {
        evidence.quote.contains("林七夜") && evidence.location.chunk_id == "character-chunk-1"
    }));

    let reloaded = load_character_center_payload_in(&dir, &book.id)
        .expect("saved character payload should reload");
    assert_eq!(reloaded.manifest.character_count, payload.profiles.len());
    assert_eq!(reloaded.profiles.len(), payload.profiles.len());
    assert_eq!(reloaded.mentions.len(), payload.mentions.len());
    assert_eq!(reloaded.evidence.len(), payload.evidence.len());
}

#[test]
fn character_extraction_filters_action_words_and_keeps_real_context_names() {
    let dir = unique_temp_library_dir();
    let book = character_test_book("book-character-quality", "人物识别质量", "sage");
    save_library_records(&dir, &[book.clone()]).expect("library should save");
    save_index_manifest(
        &dir,
        &[BookIndexManifest {
            book_id: book.id.clone(),
            book_title: book.display_title.clone(),
            content_hash: book.content_hash.clone(),
            status: "ready".to_string(),
            built_at: "1781100001000".to_string(),
            index_version: 1,
            chunk_strategy_version: 1,
            chapter_rule_version: 1,
            chunk_count: 2,
            fts_row_count: 2,
            ..BookIndexManifest::default()
        }],
    )
    .expect("text index manifest should save");
    save_chunk_records(
        &dir,
        &[
            TextChunkRecord {
                id: "quality-chunk-1".to_string(),
                book_id: book.id.clone(),
                book_title: book.display_title.clone(),
                chapter: "第一章 误识别".to_string(),
                ordinal: 0,
                text: concat!(
                    "林七夜转头说道：“李医生，我看见赵空城了。”",
                    "转头说道：“这里没有别人。”低头问道，回头看向病房。",
                    "林七夜点点头，赵空城摇摇头，李医生转过头说道。",
                    "左青点头，曹渊摇头。",
                    "林七夜犹豫片刻，还是开口。",
                    "系统提示任务完成，黑暗里一片安静。"
                )
                .to_string(),
                chapter_index: 0,
                chapter_title: "第一章 误识别".to_string(),
                paragraph_start: 0,
                paragraph_end: 1,
                char_start: 0,
                char_end: 80,
                content_hash: "quality-chunk-hash-1".to_string(),
                chunk_strategy_version: 1,
                created_at: "1781100002000".to_string(),
            },
            TextChunkRecord {
                id: "quality-chunk-2".to_string(),
                book_id: book.id.clone(),
                book_title: book.display_title.clone(),
                chapter: "第二章 真实人物".to_string(),
                ordinal: 1,
                text: concat!(
                    "李医生看向林七夜，赵空城低声说道。司小南回答，安卿鱼走来。",
                    "左青说道，曹渊问道，司小南点头，安卿鱼回答。"
                )
                .to_string(),
                chapter_index: 1,
                chapter_title: "第二章 真实人物".to_string(),
                paragraph_start: 2,
                paragraph_end: 3,
                char_start: 81,
                char_end: 118,
                content_hash: "quality-chunk-hash-2".to_string(),
                chunk_strategy_version: 1,
                created_at: "1781100003000".to_string(),
            },
        ],
    )
    .expect("chunks should save");

    let payload = extract_character_index_in(&dir, &book.id)
        .expect("character index should build with filtered candidates");
    let names: Vec<&str> = payload
        .profiles
        .iter()
        .map(|profile| profile.canonical_name.as_str())
        .collect();

    for expected in [
        "林七夜",
        "李医生",
        "赵空城",
        "左青",
        "曹渊",
        "司小南",
        "安卿鱼",
    ] {
        assert!(
            names.contains(&expected),
            "expected real character {expected}"
        );
    }
    for rejected in [
        "转头",
        "低头",
        "回头",
        "林七夜点",
        "左青点",
        "曹渊摇",
        "七夜转头",
        "病房",
        "系统",
        "任务",
        "还是",
        "这里",
        "别人",
        "黑暗",
        "安静",
    ] {
        assert!(
            !names.contains(&rejected),
            "non-character candidate {rejected} should be filtered"
        );
    }
}

#[test]
fn character_extraction_filters_high_frequency_non_name_phrases() {
    let dir = unique_temp_library_dir();
    let book = character_test_book("book-character-phrase-quality", "短语误识别", "sage");
    save_library_records(&dir, &[book.clone()]).expect("library should save");
    save_index_manifest(
        &dir,
        &[BookIndexManifest {
            book_id: book.id.clone(),
            book_title: book.display_title.clone(),
            content_hash: book.content_hash.clone(),
            status: "ready".to_string(),
            built_at: "1781100001000".to_string(),
            index_version: 1,
            chunk_strategy_version: 1,
            chapter_rule_version: 1,
            chunk_count: 1,
            fts_row_count: 1,
            ..BookIndexManifest::default()
        }],
    )
    .expect("text index manifest should save");
    save_chunk_records(
        &dir,
        &[TextChunkRecord {
            id: "phrase-quality-chunk-1".to_string(),
            book_id: book.id.clone(),
            book_title: book.display_title.clone(),
            chapter: "第一章 高频短语".to_string(),
            ordinal: 0,
            text: concat!(
                "吴湘南说道：“也就是说……”红缨说道：“你是说……”",
                "林七夜正欲说些什么，赵空城忍不住问道。",
                "林七夜一边疑惑的开口，李医生无奈的摇摇头。",
                "莫莉诧异的看向林七夜，男人一字一顿的开口。",
                "顾教官听到这个问题，陷入沉默。",
                "他转头看向李毅飞，他抬头看向窗外，他猛地抬起头。",
                "林七夜看向某个方向。",
                "林七夜问问题，赵空城说法不一，李医生叫名字。",
                "袁罡皱眉看向韩少云，陈队长，不管怎么说，这次的事情都。",
                "吴湘南笑道。林七夜笑了笑，不管怎么说，新年第一战算赢。",
                "许久之后，曹渊才问道：“那我怎么办？”",
                "百里胖胖有些诧异的开口，林七夜反问道，林七夜大喊道。",
                "就在两人说话之际，林七夜转头看向安卿鱼。",
                "更别说后面的潜行，先不说这些，不要再说了。",
                "后者无奈的开口，这就说明，那就说明，有什么问题吗？",
                "甚至可以说是简陋，正准备开口，毫无疑问的是。",
                "曹渊不解的开口，纪念不解问道，冷轩没有回答。",
                "左青点了点头，哪吒不解的问道，林七夜又转头看向安卿鱼。",
                "众人同时抬头看去，有些担忧的开口，双眸紧盯着远方。",
                "百里胖胖看向声音传来的方向，红缨没好气的说道。",
                "焦急的开口，严格来说，换句话说，再度开口。",
                "沈青竹说道，顾青岚问道，陆云舟开口。",
                "莫莉说道，顾教官问道，李毅飞回答。",
                "袁罡点头，韩少云说道，陈队长开口，纪念回答，冷轩说道，左青回答，哪吒说道。",
                "沈青竹看向顾青岚，陆云舟答道。"
            )
            .to_string(),
            chapter_index: 0,
            chapter_title: "第一章 高频短语".to_string(),
            paragraph_start: 0,
            paragraph_end: 1,
            char_start: 0,
            char_end: 180,
            content_hash: "phrase-quality-hash-1".to_string(),
            chunk_strategy_version: 1,
            created_at: "1781100002000".to_string(),
        }],
    )
    .expect("chunks should save");

    let payload = extract_character_index_in(&dir, &book.id)
        .expect("character index should filter high-frequency non-name phrases");
    let names: Vec<&str> = payload
        .profiles
        .iter()
        .map(|profile| profile.canonical_name.as_str())
        .collect();
    for expected in [
        "吴湘南",
        "红缨",
        "林七夜",
        "赵空城",
        "李医生",
        "莫莉",
        "顾教官",
        "李毅飞",
        "袁罡",
        "韩少云",
        "陈队长",
        "吴湘南",
        "百里胖胖",
        "曹渊",
        "纪念",
        "冷轩",
        "左青",
        "哪吒",
        "安卿鱼",
        "沈青竹",
        "顾青岚",
        "陆云舟",
    ] {
        assert!(
            names.contains(&expected),
            "expected real character {expected}"
        );
    }
    for rejected in [
        "也就是",
        "你是",
        "正欲",
        "忍不住",
        "一边",
        "疑惑",
        "无奈",
        "诧异",
        "一字一顿",
        "听到这个",
        "陷入",
        "他转头",
        "他抬头",
        "他猛地",
        "某个方向",
        "某个方",
        "窗外",
        "不管怎么",
        "新年第一",
        "许久之后",
        "曹渊才",
        "里胖胖",
        "林七夜反",
        "林七夜大",
        "就在两人",
        "更别",
        "先不",
        "不要",
        "后者",
        "这就",
        "那就",
        "有什么",
        "甚至可以",
        "正准备",
        "毫无疑",
        "曹渊不解",
        "纪念不解",
        "冷轩没有",
        "左青点",
        "哪吒不解",
        "林七夜又",
        "众人同时",
        "有些担忧",
        "双眸紧",
        "声音传来",
        "没好气",
        "焦急",
        "严格来",
        "换句话",
        "再度",
    ] {
        assert!(
            !names.contains(&rejected),
            "non-character phrase {rejected} should be filtered"
        );
    }
}

#[test]
fn character_extraction_rejects_real_book_single_mention_false_positive_phrases() {
    let dir = unique_temp_library_dir();
    let book = character_test_book("book-character-v9-negatives", "人物规则 v9 负例", "sage");
    save_library_records(&dir, &[book.clone()]).expect("library should save");
    save_index_manifest(
        &dir,
        &[BookIndexManifest {
            book_id: book.id.clone(),
            book_title: book.display_title.clone(),
            content_hash: book.content_hash.clone(),
            status: "ready".to_string(),
            built_at: "1781100001000".to_string(),
            index_version: 1,
            chunk_strategy_version: 1,
            chapter_rule_version: 1,
            chunk_count: 2,
            fts_row_count: 2,
            ..BookIndexManifest::default()
        }],
    )
    .expect("text index manifest should save");
    save_chunk_records(
        &dir,
        &[
            TextChunkRecord {
                id: "v9-negative-chunk-1".to_string(),
                book_id: book.id.clone(),
                book_title: book.display_title.clone(),
                chapter: "第一章 负例".to_string(),
                ordinal: 0,
                text: concat!(
                    "林七夜说道，李医生问道，赵空城答道。",
                    "在这个过程中，你们不能使用禁墟，不能主动攻击它们。",
                    "林七夜点头，李医生回答，赵空城看向远方。",
                    "小南则是太腼腆，不好意思开口说话。",
                    "不如你先回答我，西王母在哪？",
                    "我这是正当防卫，不算违背命令！",
                    "黑杀组的庇护，不需要交保护费。",
                    "作为队长说道，可是教官问道，一众教官看向远方。",
                    "三位女神说道，五位队长问道。"
                )
                .to_string(),
                chapter_index: 0,
                chapter_title: "第一章 负例".to_string(),
                paragraph_start: 0,
                paragraph_end: 1,
                char_start: 0,
                char_end: 180,
                content_hash: "v9-negative-hash-1".to_string(),
                chunk_strategy_version: 1,
                created_at: "1781100002000".to_string(),
            },
            TextChunkRecord {
                id: "v9-negative-chunk-2".to_string(),
                book_id: book.id.clone(),
                book_title: book.display_title.clone(),
                chapter: "第二章 尾巴".to_string(),
                ordinal: 1,
                text: concat!(
                    "乌泉当即摇头，乌泉幽幽开口。",
                    "红缨率先说道，纪念当即问道。",
                    "周平幽幽说道，苏哲幽幽开口。",
                    "红缨看向纪念，周平点头，苏哲回答。"
                )
                .to_string(),
                chapter_index: 1,
                chapter_title: "第二章 尾巴".to_string(),
                paragraph_start: 2,
                paragraph_end: 3,
                char_start: 181,
                char_end: 260,
                content_hash: "v9-negative-hash-2".to_string(),
                chunk_strategy_version: 1,
                created_at: "1781100003000".to_string(),
            },
        ],
    )
    .expect("chunks should save");

    let payload = extract_character_index_in(&dir, &book.id)
        .expect("character extraction should build v9 negative regression index");
    let names: Vec<&str> = payload
        .profiles
        .iter()
        .map(|profile| profile.canonical_name.as_str())
        .collect();

    for rejected in [
        "不能主动",
        "不好意思",
        "不如你先",
        "不算违背",
        "不需要交",
        "作为队长",
        "可是教官",
        "一众教官",
        "三位女神",
        "五位队长",
        "乌泉当即",
        "乌泉幽幽",
        "红缨率先",
        "纪念当即",
        "周平幽幽",
        "苏哲幽幽",
    ] {
        assert!(
            !names.contains(&rejected),
            "non-character candidate {rejected} must not be indexed"
        );
    }

    for expected in [
        "林七夜",
        "李医生",
        "赵空城",
        "乌泉",
        "红缨",
        "纪念",
        "周平",
        "苏哲",
    ] {
        assert!(
            names.contains(&expected),
            "real character {expected} should remain indexed"
        );
    }
}

#[test]
fn character_extraction_rejects_real_book_name_action_and_scene_residue() {
    let dir = unique_temp_library_dir();
    let book = character_test_book("book-character-v10-residue", "人物规则 v10 残留", "sage");
    save_library_records(&dir, &[book.clone()]).expect("library should save");
    save_index_manifest(
        &dir,
        &[BookIndexManifest {
            book_id: book.id.clone(),
            book_title: book.display_title.clone(),
            content_hash: book.content_hash.clone(),
            status: "ready".to_string(),
            built_at: "1781100001000".to_string(),
            index_version: 1,
            chunk_strategy_version: 1,
            chapter_rule_version: 1,
            chunk_count: 2,
            fts_row_count: 2,
            ..BookIndexManifest::default()
        }],
    )
    .expect("text index manifest should save");
    save_chunk_records(
        &dir,
        &[
            TextChunkRecord {
                id: "v10-residue-chunk-1".to_string(),
                book_id: book.id.clone(),
                book_title: book.display_title.clone(),
                chapter: "第一章 姓名残留".to_string(),
                ordinal: 0,
                text: concat!(
                    "林七夜说道，李医生问道，赵空城答道，安卿鱼开口。",
                    "周平说道，曹渊问道，纪念答道，苏哲喊道，红缨叫道，乌泉低声道。",
                    "“这两年，大夏的变化可不少。”林七夜微笑道。",
                    "赵空城说道，安卿鱼点头，周平回答。",
                    "安卿鱼看到自己的训练计划，眼睛顿时亮了起来。周平继续说道：“安卿鱼。”",
                    "“不会是附近有什么大型神秘出现了吧？”曹渊有些担忧的说道。",
                    "窗外许久，还是开口道：“其实，我有很多问题想问你……”纪念悠悠开口。",
                    "“我知道你想问什么。”苏哲继续说道，红缨猛地抬头。"
                )
                .to_string(),
                chapter_index: 0,
                chapter_title: "第一章 姓名残留".to_string(),
                paragraph_start: 0,
                paragraph_end: 1,
                char_start: 0,
                char_end: 260,
                content_hash: "v10-residue-hash-1".to_string(),
                chunk_strategy_version: 1,
                created_at: "1781100002000".to_string(),
            },
            TextChunkRecord {
                id: "v10-residue-chunk-2".to_string(),
                book_id: book.id.clone(),
                book_title: book.display_title.clone(),
                chapter: "第二章 场景残留".to_string(),
                ordinal: 1,
                text: concat!(
                    "见林七夜点头，赵空城的心终于放了下来。",
                    "不过是李医生一个电话的事情，听到周平的回答，尚叔笑了。",
                    "为什么你们都这么相信那个李医生？吴老狗的病，都是由李医生直接负责的。",
                    "冷轩看向林七夜所在的方向，林七夜紧盯着夫子的眼睛。",
                    "出乎意料的，林七夜很干脆的点头，刚一坐下，林七夜就好奇的问道。",
                    "曹渊张开口，正欲说些什么，沈青竹却突然开口了。",
                    "他的目光扫过空城，犹豫片刻后，转头看向纪念与关在等人。",
                    "这个我不能说，苏哲正经的回答。",
                    "跟队长对练的时候，曹渊等人点头赞同。",
                    "但看到他们点头哈腰的样子，才微微点头，时不时的点点头。",
                    "对林七夜来说，这件事不难。红缨猛的抬头看向司小南。",
                    "兵士表情严肃的问道，左青表情凝重的抬头。",
                    "他盯着一个方向，安卿鱼转头望向快步走来的李铿锵。",
                    "林七夜站在深林中，转头看向古宅的方向。",
                    "林七夜猛地转头看向尸兽浪潮的后方。",
                    "乌泉脸色凝重的开口，红缨正色说道。",
                    "悠悠开口道，幽幽说道，率先开口，正色说道。",
                    "04号淡淡说道，05号继续开口，06号咬牙说道，07号微微点头。",
                    "这件事还不好说，还是老实一点，有一个人影从远处走来。",
                    "特邀教官说道，境的队长开口，除了队长以外，刚刚教官看向操场。",
                    "出了这个问题以后，倒不如直接说明，于他们而言并不困难。",
                    "自己的身体微微一颤，属于自己的力量正在苏醒，快步走来的身影停下。",
                    "比如队长说道，就是队长开口，看着城主远去。",
                    "洪教官说道，顾教官问道，黎队长开口，王面说道。",
                    "王面点头，冷轩回答，江洱说道，霍去病问道。",
                    "到洪教官说道，给顾教官问道，位黎队长开口，就陈队长开口。",
                    "三个人说道，每一个人问道，第一个人开口，两个主神说道，三位天尊问道。",
                    "自己的头说道，自己怀中问道，王面自己说道。",
                    "开门见山说道，轻微问道，作为开口，整个说道，征求意见问道。",
                    "救洪教官说道，连袁教官问道，有林队长开口，于洪教官说道。",
                    "袁教官说道，林队长问道，韩教官回答。",
                    "没有教官说道，不是队长问道，很多教官开口，这群教官看向远方。",
                    "当即警惕说道，当即就要问道，祂当即开口，才继续说道。",
                    "六个说道，两个硕大问道，慢悠悠开口，一道轻微说道。",
                    "别的教官说道，穿着教官制服的人开口，队长所谓的计划并不存在。",
                    "让众教官说道，些只是想开口，三位神碍问道，放心队长说道。",
                    "今天那个问道，既然那个开口，得到这个回答后，他沉默了。",
                    "成为队长说道，代理队长问道，单靠教官开口，某教官说道。",
                    "每天教官说道，谢谢教官问道，所以队长开口，听说队长说道。",
                    "半个人影说道，连个问道，来自己是开口，人率先说道，又没有问道。",
                    "所以你说道，甚至开始问道，当时看到开口，该由谁来说道。",
                    "每天说道，谢谢院长问道，谢谢大叔开口。",
                    "许多教官说道，一群教官问道，这教官开口，这等教官说道。",
                    "众代理人说道，这小姑娘问道，临时队长开口，其中队长说道。",
                    "悲催教官说道，各个避难问道，够了队长开口，去见老师说道。",
                    "让小姑娘说道，谁当队长问道。",
                    "现在队长说道，预备队长问道，新任队长开口，现队长说道，小队长问道。",
                    "找林队长说道，以韩教官问道。",
                    "当教官说道，当城主问道，复活队长开口，加油队长说道。",
                    "叫我教官说道，觉得队长问道，陌生教官开口。",
                    "信的教官说道，要是队长问道，一届教官开口，增加教官说道，尖的教官问道。",
                    "那岂不是说，未来你一定会回来？算了，当我没问。",
                    "精神问题？这不是问题，倒不是说曹渊有多强，因为他说的没错。",
                    "现在不是说这些时候了，片刻后，众人看向训练场。",
                    "你找到复活江洱的方法了？江洱默默点头。",
                    "霍去病缓缓向他走来，他缓缓向前走来，立刻有人开口。",
                    "那道身影立刻俯身问道，一位老人苦笑道，一些人类低语。",
                    "休淡淡说道，是否需要帮助？他紧盯着时间长河。",
                    "过了许久，才主动开口。精神焕发的说道，是精神类攻击。",
                    "有些不悦的开口，有人冷声开口，义愤填膺的开口。",
                    "义正严辞的说道，乐呵呵的说道，佯装镇定的说道。",
                    "看向倒地惊恐的呓语，找到入口了吗？兴致勃勃的说道。",
                    "他看向半空，即将到来的攻击，在原地沉默，双手叉腰问道。",
                    "各种各样的攻击，咬牙切齿的开口，咬着牙开口。",
                    "抬头看向夜空，猛地回头看向天边，目光看向大殿深处。",
                    "抬头看向头顶漆黑的夜空，两道长长的影子，愿为院长效劳。",
                    "还请陛下回宫，送院长！",
                    "冷轩镇定的说道，尽量镇定的开口，强行镇定开口。",
                    "江洱补充说道，江洱紧张地问道，严肃地开口。",
                    "满脸羡慕的说道，脸颊微红的开口，试探性地问道。",
                    "眼眸正死死地盯着黑色迷雾，灵媒小队下达命令。",
                    "正死死的盯着倪克斯，满脸兴奋的说道，改口说道。",
                    "远处漆黑的夜空，红缨叉腰问道，满脸不爽的开口。",
                    "满脸老实的说道，脸颊通红的开口。",
                    "护士帮忙搬动病床，病栋二楼响起警报，病房中一片安静。",
                    "众人毕恭毕敬的行礼，避开了你，避开它们，并同步记录。",
                    "最终还是失败了，最后只能离开，这也没什么，为什么叫做浩劫？",
                    "这是命令，还用问吗，这句话说完，才沙哑开口。",
                    "病栋二层传来脚步，这一路走来，这里来的人不少，这一切都说得通。",
                    "又没说送给你，正如你所说，正如梅林所说，还欲说些什么。",
                    "这只能说明，这对他来说，这根本说不通，很无奈的说道。",
                    "才沉声开口，又抬头看向远方，又疑惑的看向孔伤。",
                    "就好，就点了点头，就算说明来意，正直勾勾的盯着。",
                    "这只神秘，这样问，这座城市，这种情况，这能说明什么。",
                    "一双蛇眸，两具尸体，中年男人，主神开口，云上沉默。",
                    "人们散去，任何计划，估计更会失败，凭借这种手段。",
                    "他硬着头皮佯装镇定，少女决然开口，洪教官冷静开口。",
                    "他含泪开口，恍然大悟说道，恭恭敬敬开口。",
                    "他哆哆嗦嗦开口，怜巴巴说道，意味深长开口。",
                    "出路并不在屋外，暗中观察楼下。",
                    "她在保护下成长，又回头看去，变成自我意识。",
                    "各种问题接踵而至，忍不住讥讽，手舞足蹈喊道。",
                    "才有人开口，根本无法回应。",
                    "还用问吗？还用问吗？还用问吗？",
                    "又没说完，又没回答，又没继续。",
                    "正如你所说，正如你所说，正如你所说。",
                    "正如梅林所说，正如梅林所说，正如梅林所说。",
                    "还欲开口，还欲开口，还欲开口。",
                    "又抬头看去，又抬头看去，又抬头看去。",
                    "就好说道，就好说道，就好说道。",
                    "就点头，就点头，就点头。",
                    "就算开口，就算开口，就算开口。",
                    "一双蛇眸盯着他，一双蛇眸盯着他，一双蛇眸盯着他。",
                    "两具尸体倒在地上，两具尸体倒在地上，两具尸体倒在地上。",
                    "中年男人开口，中年男人问道，中年男人说道。",
                    "病栋二层传来脚步，病栋二层传来脚步，病栋二层传来脚步。"
                )
                .to_string(),
                chapter_index: 1,
                chapter_title: "第二章 场景残留".to_string(),
                paragraph_start: 2,
                paragraph_end: 3,
                char_start: 261,
                char_end: 420,
                content_hash: "v10-residue-hash-2".to_string(),
                chunk_strategy_version: 1,
                created_at: "1781100003000".to_string(),
            },
        ],
    )
    .expect("chunks should save");

    let payload = extract_character_index_in(&dir, &book.id)
        .expect("character extraction should build v10 residue regression index");
    let names: Vec<&str> = payload
        .profiles
        .iter()
        .map(|profile| profile.canonical_name.as_str())
        .collect();

    for expected in [
        "林七夜",
        "李医生",
        "赵空城",
        "安卿鱼",
        "周平",
        "曹渊",
        "纪念",
        "苏哲",
        "红缨",
        "乌泉",
        "洪教官",
        "顾教官",
        "黎队长",
        "袁教官",
        "林队长",
        "韩教官",
        "王面",
        "冷轩",
        "江洱",
        "霍去病",
    ] {
        assert!(
            names.contains(&expected),
            "real character {expected} should remain indexed"
        );
    }

    for rejected in [
        "林七夜微",
        "周平继续",
        "曹渊有些",
        "纪念悠悠",
        "苏哲继续",
        "红缨猛",
        "见林七夜",
        "是李医生",
        "听到周平",
        "个李医生",
        "由李医生",
        "林七夜所",
        "林七夜紧",
        "林七夜很",
        "林七夜就",
        "曹渊张",
        "沈青竹却",
        "纪念与关",
        "苏哲正经",
        "跟队长",
        "曹渊等人",
        "看到他们",
        "才微微",
        "时不时",
        "林七夜来",
        "红缨猛",
        "兵士表情",
        "左青表情",
        "一个方",
        "望向快步",
        "古宅的方",
        "尸兽浪潮",
        "乌泉脸色",
        "红缨正色",
        "悠悠",
        "幽幽",
        "率先",
        "正色",
        "号淡淡",
        "号继续",
        "号咬牙",
        "号微微",
        "还不好",
        "还是老实",
        "有一个",
        "特邀教官",
        "境的队长",
        "除了队长",
        "刚刚教官",
        "出了这个",
        "倒不如",
        "于他们",
        "自己的身",
        "属于自己",
        "快步",
        "比如队长",
        "就是队长",
        "看着城主",
        "到洪教官",
        "给顾教官",
        "位黎队长",
        "就陈队长",
        "三个人",
        "每一个人",
        "第一个人",
        "两个主神",
        "三位天尊",
        "自己的头",
        "自己怀中",
        "王面自己",
        "开门见山",
        "轻微",
        "作为",
        "整个",
        "征求意见",
        "救洪教官",
        "连袁教官",
        "有林队长",
        "于洪教官",
        "没有教官",
        "不是队长",
        "很多教官",
        "这群教官",
        "当即警惕",
        "当即就要",
        "祂当即",
        "才继续",
        "六个",
        "两个硕大",
        "慢悠悠",
        "一道轻微",
        "别的教官",
        "穿着教官",
        "队长所谓",
        "让众教官",
        "些只是想",
        "三位神碍",
        "放心队长",
        "今天那个",
        "既然那个",
        "得到这个",
        "成为队长",
        "代理队长",
        "单靠教官",
        "某教官",
        "每天教官",
        "谢谢教官",
        "所以队长",
        "听说队长",
        "半个人影",
        "连个",
        "来自己是",
        "人率先",
        "又没有",
        "所以你",
        "甚至开始",
        "当时看到",
        "该由谁来",
        "每天",
        "谢谢院长",
        "谢谢大叔",
        "许多教官",
        "一群教官",
        "这教官",
        "这等教官",
        "众代理人",
        "这小姑娘",
        "临时队长",
        "其中队长",
        "悲催教官",
        "各个避难",
        "够了队长",
        "去见老师",
        "让小姑娘",
        "谁当队长",
        "现在队长",
        "预备队长",
        "新任队长",
        "现队长",
        "小队长",
        "找林队长",
        "以韩教官",
        "当教官",
        "当城主",
        "复活队长",
        "加油队长",
        "叫我教官",
        "觉得队长",
        "陌生教官",
        "信的教官",
        "要是队长",
        "一届教官",
        "增加教官",
        "尖的教官",
        "岂不是",
        "当我没",
        "精神",
        "这不是",
        "倒不是",
        "因为他",
        "现在不是",
        "片刻后",
        "训练场",
        "复活江洱",
        "江洱默默",
        "缓缓向他",
        "缓缓向前",
        "立刻有人",
        "立刻俯身",
        "一位老人",
        "一些人类",
        "休淡淡",
        "否需要",
        "时间长河",
        "才主动",
        "精神焕发",
        "精神类",
        "些不悦",
        "人冷声",
        "义愤填膺",
        "义正严辞",
        "乐呵呵",
        "佯装镇定",
        "倒地",
        "入口",
        "兴致勃勃",
        "半空",
        "即将到来",
        "原地",
        "双手叉腰",
        "各种各样",
        "咬牙切齿",
        "咬着牙",
        "夜空",
        "天边",
        "大殿深处",
        "头顶漆黑",
        "两道长",
        "愿为院长",
        "还请陛下",
        "送院长",
        "冷轩镇定",
        "尽量镇定",
        "强行镇定",
        "江洱补充",
        "紧张地",
        "严肃地",
        "满脸羡慕",
        "脸颊微红",
        "试探性地",
        "正死死地",
        "小队下达",
        "正死死",
        "满脸兴奋",
        "满脸",
        "改口",
        "漆黑",
        "叉腰",
        "满脸不爽",
        "满脸老实",
        "脸颊通红",
        "帮忙",
        "病床",
        "病栋二楼",
        "病房中",
        "毕恭毕敬",
        "避开了你",
        "避开它们",
        "并同步",
        "最终",
        "最后",
        "这也",
        "为什么",
        "没什么",
        "这是",
        "还用",
        "这句话",
        "才沙哑",
        "病栋二层",
        "这一路",
        "这里来",
        "这一切",
        "又没",
        "正如你",
        "正如梅林",
        "还欲",
        "这只能",
        "这对他来",
        "这根本",
        "很无奈",
        "才沉声",
        "又抬头",
        "又疑惑",
        "就好",
        "就点",
        "就算",
        "正直勾勾",
        "这只",
        "这样",
        "这座城市",
        "这种情况",
        "这能",
        "一双蛇眸",
        "两具尸体",
        "中年男人",
        "主神",
        "云上",
        "人们",
        "任何",
        "估计更会",
        "凭借这种",
        "佯装",
        "决然",
        "冷静",
        "含泪",
        "恍然大悟",
        "恭恭敬敬",
        "哆哆嗦嗦",
        "怜巴巴",
        "意味深长",
        "出路",
        "屋外",
        "暗中",
        "楼下",
        "下成长",
        "又回头",
        "变成自我",
        "各种",
        "忍不住讥",
        "手舞足蹈",
        "才有人",
        "根本无法",
    ] {
        assert!(
            !names.contains(&rejected),
            "residue candidate {rejected} must not be indexed"
        );
    }
    assert!(
        is_non_character_candidate("病栋二层"),
        "location phrase 病栋二层 must be rejected before scoring"
    );
    for rejected in ["根本懒得", "任何人影", "根本", "还用你", "根本上来"] {
        assert!(
            is_non_character_candidate(rejected),
            "function phrase {rejected} must be rejected before scoring"
        );
    }
}

#[test]
fn character_extraction_rejects_jianlai_non_person_noise() {
    let noise_cases = [
        "一事",
        "随口",
        "后脑勺",
        "使劲",
        "最后",
        "仍是",
        "仰头",
        "二楼",
        "湖水",
        "江水",
        "大街",
        "渡船",
        "敲门",
        "一把好剑",
        "一尊神像",
        "听师父",
        "让先生",
        "拜见先生",
        "比起师兄",
        "白也闻言",
        "朱敛搓手",
        "裴钱只得",
        "宁姚心声",
    ];
    let mut text = concat!(
        "陈平安说道，宁姚问道，朱敛答道，裴钱开口。",
        "陈平安看向宁姚，朱敛点头，裴钱回答。"
    )
    .to_string();
    for noise in noise_cases {
        for _ in 0..4 {
            text.push_str(noise);
            text.push_str("说道，");
            text.push_str(noise);
            text.push_str("看向陈平安。");
        }
    }

    let payload = extract_character_payload_for_test(
        "book-character-v11-jianlai-noise",
        "人物规则 v11 噪声",
        text,
    );
    let names = payload_profile_names(&payload);

    for expected in ["陈平安", "宁姚", "朱敛", "裴钱"] {
        assert!(
            names.contains(expected),
            "real Jianlai character {expected} should remain indexed"
        );
    }
    for rejected in noise_cases {
        assert!(
            !names.contains(rejected),
            "Jianlai non-person noise {rejected} must not be indexed"
        );
    }
}

#[test]
fn character_extraction_rejects_single_mention_profiles_but_keeps_repeated_real_characters() {
    let payload = extract_character_payload_for_test(
        "book-character-v12-single-mention",
        "人物规则 v12 单次出现",
        concat!(
            "陈平安说道，宁姚问道，朱敛答道，裴钱开口。",
            "陈平安看向宁姚，朱敛说道，裴钱笑道。",
            "林七夜说道，赵空城问道，白也闻言说道，听师父说道。",
            "白也闻言问道，听师父答道，朱敛搓手说道，朱敛搓手问道。"
        )
        .to_string(),
    );
    let names = payload_profile_names(&payload);

    for expected in ["陈平安", "宁姚", "朱敛", "裴钱"] {
        assert!(
            names.contains(expected),
            "repeated real character {expected} should remain indexed"
        );
    }
    for rejected in ["林七夜", "赵空城", "白也闻言", "听师父", "朱敛搓手"] {
        assert!(
            !names.contains(rejected),
            "single mention or definite noise profile {rejected} must not be indexed"
        );
    }
}

#[test]
fn character_extraction_rejects_generic_roles_and_titles() {
    let generic_cases = [
        "妇人",
        "汉子",
        "书生",
        "老先生",
        "账房先生",
        "说书先生",
        "教书先生",
        "老道人",
        "皇帝陛下",
        "太子殿下",
    ];
    let mut text = concat!(
        "陈平安说道，崔东山问道，魏檗答道，齐景龙开口。",
        "陈平安点头，崔东山回答，魏檗看向齐景龙。"
    )
    .to_string();
    for generic in generic_cases {
        for _ in 0..4 {
            text.push_str(generic);
            text.push_str("说道，");
            text.push_str(generic);
            text.push_str("看向崔东山。");
        }
    }

    let payload = extract_character_payload_for_test(
        "book-character-v11-generic-roles",
        "人物规则 v11 泛称谓",
        text,
    );
    let names = payload_profile_names(&payload);

    for expected in ["陈平安", "崔东山", "魏檗", "齐景龙"] {
        assert!(
            names.contains(expected),
            "real Jianlai character {expected} should remain indexed"
        );
    }
    for rejected in generic_cases {
        assert!(
            !names.contains(rejected),
            "generic role or title {rejected} must not be indexed"
        );
    }
}

#[test]
fn character_extraction_keeps_jianlai_core_names_under_strict_gate() {
    let text = concat!(
        "陈平安说道，朱敛问道，崔瀺答道，裴钱开口。",
        "崔东山低声说道，魏檗轻声道，齐景龙沉声说道，李柳问道。",
        "顾璨看向陈平安，杨老头说道，火龙真人开口，宁姚答道。",
        "郑大风问道，李二说道，阿良开口，齐静春答道。",
        "李槐问道，李宝瓶说道，李希圣开口，阮邛答道。",
        "陆台说道，钟魁问道，姜尚真开口，宋集薪答道。",
        "朱敛点头，崔瀺问道，裴钱回答，崔东山开口。",
        "魏檗说道，齐景龙点头，李柳问道，顾璨回答。",
        "杨老头说道，火龙真人问道，宁姚回答，郑大风开口。",
        "李二点头，阿良说道，齐静春问道，李槐回答。",
        "李宝瓶开口，李希圣说道，阮邛问道，陆台回答。",
        "钟魁说道，姜尚真问道，宋集薪回答。"
    );

    let payload = extract_character_payload_for_test(
        "book-character-v11-core-names",
        "人物规则 v11 核心人物",
        text.to_string(),
    );
    let names = payload_profile_names(&payload);

    for expected in [
        "陈平安",
        "朱敛",
        "崔瀺",
        "裴钱",
        "崔东山",
        "魏檗",
        "齐景龙",
        "李柳",
        "顾璨",
        "杨老头",
        "火龙真人",
        "宁姚",
        "郑大风",
        "李二",
        "阿良",
        "齐静春",
        "李槐",
        "李宝瓶",
        "李希圣",
        "阮邛",
        "陆台",
        "钟魁",
        "姜尚真",
        "宋集薪",
    ] {
        assert!(
            names.contains(expected),
            "core Jianlai character {expected} should remain indexed"
        );
    }
}

#[test]
fn character_extraction_keeps_specific_titled_names() {
    let text = concat!(
        "陈先生说道，齐先生问道，宁姑娘答道，阮师傅开口。",
        "孙道长低声道，马将军沉声说道，阮姑娘轻声说道。",
        "郑先生看向陈先生，崔先生问道。",
        "齐先生点头，宁姑娘回答，阮师傅说道，孙道长问道。",
        "马将军开口，阮姑娘点头，郑先生说道，崔先生回答。"
    );

    let payload = extract_character_payload_for_test(
        "book-character-v11-specific-titles",
        "人物规则 v11 实名称谓",
        text.to_string(),
    );
    let names = payload_profile_names(&payload);

    for expected in [
        "陈先生",
        "齐先生",
        "宁姑娘",
        "阮师傅",
        "孙道长",
        "马将军",
        "阮姑娘",
        "郑先生",
        "崔先生",
    ] {
        assert!(
            names.contains(expected),
            "specific titled name {expected} should remain indexed"
        );
    }
}

#[test]
fn character_extraction_rejects_jianlai_low_frequency_sentence_residue() {
    let text = concat!(
        "陈平安劝说道，陈平安追问道，陈清都气笑道，魏羡没说话。",
        "丁婴哈哈笑道，范大澈赶忙问道，裴钱呵呵笑道。",
        "宁姚刚要开口，朱敛随即说道，魏檗气笑道。",
        "陈清都说道，丁婴问道，范大澈回答，裴钱开口。",
        "宁姚点头，朱敛回答，魏檗说道。",
        "书生哈哈笑道，结果那人摇头道，老人终于开口，胖子嘿嘿笑道。",
        "礼圣没点头，两位长辈说道，书斋内沉默许久，主事人点头道。",
        "一件法袍看向陈平安，一侧街道望向宁姚，一幕场景说道。"
    );

    let payload = extract_character_payload_for_test(
        "book-character-v11-low-frequency-residue",
        "人物规则 v11 低频残片",
        text.to_string(),
    );
    let names = payload_profile_names(&payload);

    for expected in [
        "陈平安",
        "陈清都",
        "丁婴",
        "范大澈",
        "裴钱",
        "宁姚",
        "朱敛",
        "魏檗",
    ] {
        assert!(
            names.contains(expected),
            "cleaned real character {expected} should remain indexed"
        );
    }
    for rejected in [
        "陈平安劝",
        "陈平安追",
        "陈清都气",
        "魏羡没",
        "丁婴哈哈",
        "范大澈赶",
        "裴钱呵呵",
        "宁姚刚要",
        "朱敛随即",
        "魏檗气",
        "书生哈哈",
        "结果那人",
        "老人终于",
        "胖子嘿嘿",
        "礼圣没",
        "两位长辈",
        "书斋内",
        "主事人",
        "一件法袍",
        "一侧街道",
        "一幕场景",
    ] {
        assert!(
            !names.contains(rejected),
            "low-frequency sentence residue {rejected} must not be indexed"
        );
    }
}

#[test]
fn character_extraction_keeps_real_names_that_share_action_suffix_chars() {
    let dir = unique_temp_library_dir();
    let book = character_test_book("book-character-nickname", "人物昵称", "sage");
    save_library_records(&dir, &[book.clone()]).expect("library should save");
    save_index_manifest(
        &dir,
        &[BookIndexManifest {
            book_id: book.id.clone(),
            book_title: book.display_title.clone(),
            content_hash: book.content_hash.clone(),
            status: "ready".to_string(),
            built_at: "1781100001000".to_string(),
            index_version: 1,
            chunk_strategy_version: 1,
            chapter_rule_version: 1,
            chunk_count: 1,
            fts_row_count: 1,
            ..BookIndexManifest::default()
        }],
    )
    .expect("text index manifest should save");
    save_chunk_records(
        &dir,
        &[TextChunkRecord {
            id: "nickname-chunk-1".to_string(),
            book_id: book.id.clone(),
            book_title: book.display_title.clone(),
            chapter: "第一章 昵称".to_string(),
            ordinal: 0,
            text: concat!(
                "石头说道：“我叫石头。”木头问道：“石头，你看见林七夜了吗？”",
                "柳依旧说道。柳轻轻问道。石头回答，木头看向林七夜，柳依旧点头，柳轻轻回答。"
            )
            .to_string(),
            chapter_index: 0,
            chapter_title: "第一章 昵称".to_string(),
            paragraph_start: 0,
            paragraph_end: 1,
            char_start: 0,
            char_end: 40,
            content_hash: "nickname-chunk-hash-1".to_string(),
            chunk_strategy_version: 1,
            created_at: "1781100002000".to_string(),
        }],
    )
    .expect("chunks should save");

    let payload = extract_character_index_in(&dir, &book.id)
        .expect("character index should keep nickname candidates");
    let names: Vec<&str> = payload
        .profiles
        .iter()
        .map(|profile| profile.canonical_name.as_str())
        .collect();

    for expected in ["石头", "木头", "林七夜", "柳依旧", "柳轻轻"] {
        assert!(names.contains(&expected), "expected nickname {expected}");
    }
}

#[test]
fn character_extraction_recovers_subject_before_adverbial_speech_predicate() {
    let dir = unique_temp_library_dir();
    let book = character_test_book("book-character-adverbial-speech", "副词说话主语", "sage");
    save_library_records(&dir, &[book.clone()]).expect("library should save");
    save_index_manifest(
        &dir,
        &[BookIndexManifest {
            book_id: book.id.clone(),
            book_title: book.display_title.clone(),
            content_hash: book.content_hash.clone(),
            status: "ready".to_string(),
            built_at: "1781100001000".to_string(),
            index_version: 1,
            chunk_strategy_version: 1,
            chapter_rule_version: 1,
            chunk_count: 1,
            fts_row_count: 1,
            ..BookIndexManifest::default()
        }],
    )
    .expect("text index manifest should save");
    save_chunk_records(
        &dir,
        &[TextChunkRecord {
            id: "adverbial-speech-chunk-1".to_string(),
            book_id: book.id.clone(),
            book_title: book.display_title.clone(),
            chapter: "第一章 犹豫".to_string(),
            ordinal: 0,
            text: concat!(
                "林七夜犹豫片刻，还是开口。",
                "沈明远犹豫了片刻，还是说道。",
                "顾青岚沉默半晌，终于问道。",
                "陆云舟停顿一下，这才答道。",
                "苏晚宁思索片刻，却还是开口。",
                "林七夜说道，沈明远问道，顾青岚回答。",
                "陆云舟说道，苏晚宁点头。"
            )
            .to_string(),
            chapter_index: 0,
            chapter_title: "第一章 犹豫".to_string(),
            paragraph_start: 0,
            paragraph_end: 1,
            char_start: 0,
            char_end: 32,
            content_hash: "adverbial-speech-hash-1".to_string(),
            chunk_strategy_version: 1,
            created_at: "1781100002000".to_string(),
        }],
    )
    .expect("chunks should save");

    let payload = extract_character_index_in(&dir, &book.id)
        .expect("character index should recover adverbial speech subjects");
    let names: Vec<&str> = payload
        .profiles
        .iter()
        .map(|profile| profile.canonical_name.as_str())
        .collect();

    for expected in ["林七夜", "沈明远", "顾青岚", "陆云舟", "苏晚宁"] {
        assert!(
            names.contains(&expected),
            "expected subject before adverbial speech {expected}"
        );
    }
    for rejected in ["还是", "终于", "这才", "却还是"] {
        assert!(
            !names.contains(&rejected),
            "adverbial connector {rejected} must not become a character"
        );
    }
}

#[test]
fn character_extraction_builds_cooccurrence_relations_with_evidence() {
    let dir = unique_temp_library_dir();
    let book = character_test_book("book-character-relations", "人物关系", "sage");
    save_library_records(&dir, &[book.clone()]).expect("library should save");
    save_index_manifest(
        &dir,
        &[BookIndexManifest {
            book_id: book.id.clone(),
            book_title: book.display_title.clone(),
            content_hash: book.content_hash.clone(),
            status: "ready".to_string(),
            built_at: "1781100001000".to_string(),
            index_version: 1,
            chunk_strategy_version: 1,
            chapter_rule_version: 1,
            chunk_count: 1,
            fts_row_count: 1,
            ..BookIndexManifest::default()
        }],
    )
    .expect("text index manifest should save");
    save_chunk_records(
        &dir,
        &[TextChunkRecord {
            id: "relation-chunk-1".to_string(),
            book_id: book.id.clone(),
            book_title: book.display_title.clone(),
            chapter: "第一章 共现".to_string(),
            ordinal: 0,
            text: concat!(
                "林七夜说道：“李医生，我看见赵空城了。”李医生看向林七夜。",
                "赵空城说道：“林七夜，你跟上。”"
            )
            .to_string(),
            chapter_index: 0,
            chapter_title: "第一章 共现".to_string(),
            paragraph_start: 0,
            paragraph_end: 1,
            char_start: 0,
            char_end: 40,
            content_hash: "relation-chunk-hash-1".to_string(),
            chunk_strategy_version: 1,
            created_at: "1781100002000".to_string(),
        }],
    )
    .expect("chunks should save");

    let payload = extract_character_index_in(&dir, &book.id)
        .expect("character index should build relations from co-occurrence");
    let lin_id = payload
        .profiles
        .iter()
        .find(|profile| profile.canonical_name == "林七夜")
        .expect("林七夜 should be profiled")
        .id
        .clone();
    let zhao_id = payload
        .profiles
        .iter()
        .find(|profile| profile.canonical_name == "赵空城")
        .expect("赵空城 should be profiled")
        .id
        .clone();
    let relations: Vec<serde_json::Value> = payload
        .relations
        .iter()
        .map(|relation| serde_json::to_value(relation).expect("relation should serialize"))
        .collect();
    let relation = relations
        .iter()
        .find(|relation| {
            relation.get("relationType").and_then(|item| item.as_str()) == Some("co-occurrence")
                && relation.get("direction").and_then(|item| item.as_str()) == Some("undirected")
                && relation
                    .get("sourceCharacterId")
                    .and_then(|item| item.as_str())
                    .is_some_and(|id| id == lin_id || id == zhao_id)
                && relation
                    .get("targetCharacterId")
                    .and_then(|item| item.as_str())
                    .is_some_and(|id| id == lin_id || id == zhao_id)
        })
        .expect("林七夜 and 赵空城 should have a co-occurrence relation");
    let relation_id = relation
        .get("id")
        .and_then(|item| item.as_str())
        .expect("relation should have id");
    let evidence_ids = relation
        .get("evidenceIds")
        .and_then(|item| item.as_array())
        .expect("relation should have evidence ids");
    assert!(!evidence_ids.is_empty());
    let evidence_id = evidence_ids[0]
        .as_str()
        .expect("relation evidence id should be a string");
    let relation_evidence = payload
        .evidence
        .iter()
        .find(|item| item.id == evidence_id)
        .expect("relation evidence should be returned in payload");
    assert_eq!(relation_evidence.target_type, "relation");
    assert_eq!(relation_evidence.target_id, relation_id);
    assert!(relation_evidence.quote.contains("林七夜"));
    assert!(relation_evidence.quote.contains("赵空城"));
    assert!(payload.manifest.relation_count >= 1);
    assert!(payload
        .profiles
        .iter()
        .any(|profile| profile.canonical_name == "林七夜" && profile.relation_count >= 1));

    let relations_path = character_book_dir(&dir, &book.id).join("relations.json");
    let raw_relations: Vec<serde_json::Value> =
        serde_json::from_str(&fs::read_to_string(relations_path).expect("relations file"))
            .expect("relations json should parse");
    assert_eq!(raw_relations.len(), payload.relations.len());
}

#[test]
fn character_extraction_builds_typed_directional_relations_from_explicit_text() {
    let dir = unique_temp_library_dir();
    let book = character_test_book("book-character-explicit-relations", "显式关系", "sage");
    save_library_records(&dir, &[book.clone()]).expect("library should save");
    save_index_manifest(
        &dir,
        &[BookIndexManifest {
            book_id: book.id.clone(),
            book_title: book.display_title.clone(),
            content_hash: book.content_hash.clone(),
            status: "ready".to_string(),
            built_at: "1781100001000".to_string(),
            index_version: 1,
            chunk_strategy_version: 1,
            chapter_rule_version: 1,
            chunk_count: 1,
            fts_row_count: 1,
            ..BookIndexManifest::default()
        }],
    )
    .expect("text index manifest should save");
    save_chunk_records(
        &dir,
        &[TextChunkRecord {
            id: "explicit-relation-chunk-1".to_string(),
            book_id: book.id.clone(),
            book_title: book.display_title.clone(),
            chapter: "第一章 显式关系".to_string(),
            ordinal: 0,
            text: concat!(
                "赵空城保护林七夜，林七夜询问李医生。",
                "李医生是林七夜的医生，王老师命令赵空城。",
                "王老师说道，赵空城看向林七夜。"
            )
            .to_string(),
            chapter_index: 0,
            chapter_title: "第一章 显式关系".to_string(),
            paragraph_start: 0,
            paragraph_end: 1,
            char_start: 0,
            char_end: 48,
            content_hash: "explicit-relation-hash-1".to_string(),
            chunk_strategy_version: 1,
            created_at: "1781100002000".to_string(),
        }],
    )
    .expect("chunks should save");

    let payload = extract_character_index_in(&dir, &book.id)
        .expect("character index should build typed directional relations");
    let id_for = |name: &str| {
        payload
            .profiles
            .iter()
            .find(|profile| profile.canonical_name == name)
            .unwrap_or_else(|| panic!("{name} should be profiled"))
            .id
            .clone()
    };
    let zhao_id = id_for("赵空城");
    let lin_id = id_for("林七夜");
    let li_id = id_for("李医生");
    let wang_id = id_for("王老师");

    for (source_id, target_id, relation_type, label, status, min_confidence) in [
        (&zhao_id, &lin_id, "protects", "保护", "valid", 0.78),
        (&lin_id, &li_id, "asks", "询问", "valid", 0.78),
        (&li_id, &lin_id, "doctor", "医生", "suspected", 0.72),
        (&wang_id, &zhao_id, "commands", "命令", "valid", 0.78),
    ] {
        let relation = payload
            .relations
            .iter()
            .find(|relation| {
                relation.source_character_id == *source_id
                    && relation.target_character_id == *target_id
                    && relation.relation_type == relation_type
            })
            .unwrap_or_else(|| panic!("expected {label} relation"));
        assert_eq!(relation.direction, "directed");
        assert_eq!(relation.label, label);
        assert_eq!(relation.status, status);
        assert!(relation.confidence >= min_confidence);
        let evidence_id = relation
            .evidence_ids
            .first()
            .expect("typed relation should have evidence");
        let evidence = payload
            .evidence
            .iter()
            .find(|item| item.id == *evidence_id)
            .expect("typed relation evidence should be returned");
        assert_eq!(evidence.target_type, "relation");
        assert_eq!(evidence.target_id, relation.id);
        assert!(evidence.quote.contains(label));
    }
}
