use super::extraction::is_cjk_char;
use super::filters::is_non_character_candidate;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(super) enum CharacterCandidateKind {
    ProperName,
    TitledName,
    StableAlias,
}

pub(super) fn classify_character_candidate_name(name: &str) -> Option<CharacterCandidateKind> {
    if looks_like_specific_titled_character_name(name) {
        return Some(CharacterCandidateKind::TitledName);
    }
    if looks_like_stable_alias_character_name(name) {
        return Some(CharacterCandidateKind::StableAlias);
    }
    looks_like_proper_character_name(name).then_some(CharacterCandidateKind::ProperName)
}

pub(super) fn looks_like_titled_character_name(name: &str) -> bool {
    TITLE_NAME_SUFFIXES
        .iter()
        .any(|suffix| name.ends_with(suffix) && name.chars().count() > suffix.chars().count())
}

pub(super) fn looks_like_specific_titled_character_name(name: &str) -> bool {
    titled_name_prefix(name).is_some_and(is_specific_titled_name_prefix)
}

fn titled_name_prefix<'a>(name: &'a str) -> Option<&'a str> {
    TITLE_NAME_SUFFIXES
        .iter()
        .filter(|suffix| name.ends_with(**suffix))
        .max_by_key(|suffix| suffix.len())
        .and_then(|suffix| {
            let prefix = &name[..name.len() - suffix.len()];
            (!prefix.is_empty()).then_some(prefix)
        })
}

fn is_specific_titled_name_prefix(prefix: &str) -> bool {
    let char_count = prefix.chars().count();
    (1..=3).contains(&char_count)
        && !GENERIC_TITLED_NAME_PREFIXES.contains(&prefix)
        && !GENERIC_QUANTITY_TITLE_PREFIXES
            .iter()
            .any(|item| prefix.starts_with(item))
        && !is_non_character_candidate(prefix)
}

pub(super) fn looks_like_stable_alias_character_name(name: &str) -> bool {
    let char_count = name.chars().count();
    (2..=4).contains(&char_count)
        && name.chars().all(is_cjk_char)
        && STABLE_ALIAS_SUFFIXES
            .iter()
            .any(|suffix| name.ends_with(suffix) && name.chars().count() > suffix.chars().count())
        && !super::filters::STRICT_NON_PERSON_PREFIXES
            .iter()
            .any(|prefix| name.starts_with(prefix))
}

pub(super) fn looks_like_possible_proper_character_name(name: &str) -> bool {
    looks_like_proper_character_name(name)
}

fn looks_like_proper_character_name(name: &str) -> bool {
    let char_count = name.chars().count();
    (2..=4).contains(&char_count)
        && name.chars().all(is_cjk_char)
        && (is_exceptional_person_name(name) || starts_with_known_chinese_surname(name))
        && !looks_like_generic_role_phrase(name)
        && !super::filters::STRICT_NON_PERSON_PREFIXES
            .iter()
            .any(|prefix| name.starts_with(prefix))
        && !super::filters::STRICT_NON_PERSON_SUFFIXES
            .iter()
            .any(|suffix| name.ends_with(suffix))
}

fn starts_with_known_chinese_surname(name: &str) -> bool {
    COMPOUND_CHINESE_SURNAMES
        .iter()
        .any(|surname| name.starts_with(surname) && name.chars().count() > surname.chars().count())
        || name
            .chars()
            .next()
            .is_some_and(|ch| COMMON_CHINESE_SURNAMES.contains(&ch))
}

pub(super) fn is_known_chinese_surname_start(ch: char) -> bool {
    COMMON_CHINESE_SURNAMES.contains(&ch)
        || COMPOUND_CHINESE_SURNAMES
            .iter()
            .any(|surname| surname.starts_with(ch))
        || EXCEPTIONAL_PERSON_NAMES
            .iter()
            .any(|name| name.starts_with(ch))
}

pub(super) fn looks_like_generic_role_phrase(name: &str) -> bool {
    is_generic_role_title(name)
        || GENERIC_ROLE_MODIFIER_PREFIXES.iter().any(|prefix| {
            name.starts_with(prefix)
                && GENERIC_ROLE_SUFFIXES
                    .iter()
                    .any(|suffix| name.ends_with(suffix))
        })
}

pub(super) fn is_generic_role_title(name: &str) -> bool {
    GENERIC_ROLE_TITLES.contains(&name)
}

pub(super) fn is_generic_quantified_title_candidate(name: &str) -> bool {
    GENERIC_QUANTITY_TITLE_PREFIXES.iter().any(|prefix| {
        name.starts_with(prefix)
            && GENERIC_PERSON_TITLE_SUFFIXES
                .iter()
                .any(|suffix| name.ends_with(suffix))
    })
}

const TITLE_NAME_SUFFIXES: &[&str] = &[
    "医生", "先生", "小姐", "队长", "教官", "老师", "道长", "城主", "院长", "将军", "师兄", "师姐",
    "师父", "师傅", "殿下", "陛下", "少爷", "姑娘", "大叔",
];

const GENERIC_QUANTITY_TITLE_PREFIXES: &[&str] = &[
    "一众",
    "众",
    "全体",
    "诸位",
    "各位",
    "几位",
    "几名",
    "一位",
    "两位",
    "两道",
    "三位",
    "四位",
    "五位",
    "六位",
    "七位",
    "八位",
    "九位",
    "十位",
    "一个",
    "一些",
    "两个",
    "三个",
    "四个",
    "五个",
    "每个",
    "每一个",
    "数位",
    "多位",
    "所有",
];

const GENERIC_PERSON_TITLE_SUFFIXES: &[&str] = &[
    "教官", "医生", "老师", "队长", "女神", "英灵", "将军", "先生", "院长", "大叔", "姑娘", "少年",
    "少女", "老人", "老者", "人类", "道长", "狱警", "骑士", "主神", "天尊",
];

const GENERIC_TITLED_NAME_PREFIXES: &[&str] = &[
    "老", "大", "小", "账房", "说书", "教书", "读书", "掌柜", "年轻", "中年", "白发", "黑衣",
    "青衫", "皇帝", "太子", "王爷", "国师", "城主", "夫子", "先生", "姑娘", "妇人", "汉子", "书生",
    "剑修", "修士", "道人", "道士", "老道", "老僧", "和尚", "少年", "少女", "老人", "老者", "男子",
    "女子",
];

const GENERIC_ROLE_TITLES: &[&str] = &[
    "太师父",
    "神子殿下",
    "天女殿下",
    "圣女殿下",
    "郡主殿下",
    "师叔",
    "师妹",
    "二师兄",
    "三师兄",
    "四师兄",
    "师祖",
    "王后",
    "妇人",
    "汉子",
    "书生",
    "剑修",
    "修士",
    "道人",
    "道士",
    "老先生",
    "老道人",
    "老修士",
    "老掌柜",
    "老将军",
    "中年人",
    "中年男子",
    "中年汉子",
    "中年剑师",
    "年轻人",
    "年轻剑仙",
    "年轻贤人",
    "年轻骑卒",
    "主事人",
    "老儒士",
    "老真人",
    "老侍郎",
    "老幕僚",
    "少年道士",
    "白衣女子",
    "圆脸女子",
    "黑袍老者",
    "灰衣老人",
    "大将军",
    "大师姐",
    "账房先生",
    "说书先生",
    "教书先生",
    "皇帝陛下",
    "太子殿下",
];

const GENERIC_ROLE_SUFFIXES: &[&str] = &[
    "道人",
    "道士",
    "道姑",
    "书生",
    "汉子",
    "老人",
    "老者",
    "男子",
    "女子",
    "少年",
    "少女",
    "僧人",
    "伙计",
    "掌柜",
    "女冠",
    "女修",
    "骑卒",
    "剑客",
    "剑仙",
    "文士",
    "儒士",
    "武夫",
    "修士",
    "武将",
    "神人",
    "童子",
    "女童",
    "小童",
    "小姑娘",
];

const GENERIC_ROLE_MODIFIER_PREFIXES: &[&str] = &[
    "年轻", "中年", "白衣", "黑衣", "青衫", "青袍", "抱剑", "隋姓", "崔姓", "楚姓", "魏姓", "赵姓",
    "高大", "矮小", "宫装", "儒衫", "灰衣", "衮服", "草鞋", "幂篱", "高冠", "佝偻", "英俊", "顶楼",
    "黑袍", "光脚", "俊美", "儒雅", "元婴", "兵家", "外乡", "别洲", "圆脸", "漂亮", "冷峻", "斗笠",
    "大髯", "青衣", "粉裙", "金甲", "白发",
];

const COMMON_CHINESE_SURNAMES: &[char] = &[
    '赵', '钱', '孙', '李', '周', '吴', '郑', '王', '冯', '陈', '蒋', '沈', '韩', '杨', '朱', '秦',
    '许', '何', '吕', '张', '孔', '曹', '严', '华', '金', '魏', '陶', '姜', '谢', '邹', '章', '苏',
    '潘', '范', '彭', '郎', '鲁', '韦', '马', '苗', '花', '方', '俞', '任', '袁', '柳', '史', '唐',
    '岑', '薛', '雷', '贺', '倪', '汤', '罗', '毕', '郝', '邬', '安', '常', '乐', '于', '傅', '齐',
    '康', '余', '元', '卜', '顾', '孟', '黄', '萧', '尹', '姚', '邵', '祁', '毛', '狄', '米', '贝',
    '明', '伏', '成', '戴', '谈', '宋', '茅', '庞', '熊', '纪', '舒', '屈', '项', '祝', '董', '梁',
    '杜', '阮', '蓝', '季', '麻', '贾', '路', '江', '童', '颜', '郭', '梅', '盛', '林', '钟', '徐',
    '骆', '高', '夏', '蔡', '田', '胡', '凌', '霍', '虞', '万', '支', '柯', '管', '卢', '莫', '房',
    '解', '应', '宗', '丁', '宣', '邓', '郁', '单', '杭', '洪', '包', '左', '石', '崔', '吉', '龚',
    '程', '邢', '裴', '陆', '荣', '翁', '荀', '惠', '曲', '封', '靳', '松', '井', '段', '巫', '乌',
    '焦', '巴', '牧', '山', '谷', '车', '侯', '全', '班', '秋', '伊', '宫', '宁', '仇', '栾', '甘',
    '厉', '祖', '武', '符', '刘', '景', '詹', '束', '龙', '叶', '幸', '司', '黎', '薄', '宿', '白',
    '蒲', '从', '赖', '卓', '蔺', '蒙', '池', '乔', '闻', '党', '翟', '谭', '劳', '申', '冉', '宰',
    '郦', '雍', '桑', '桂', '濮', '边', '燕', '尚', '温', '别', '庄', '晏', '柴', '阎', '慕', '连',
    '艾', '鱼', '向', '古', '易', '廖', '耿', '满', '匡', '文', '寇', '阙', '东', '欧', '蔚', '越',
    '师', '巩', '聂', '晁', '敖', '融', '冷', '辛', '简', '饶', '空', '曾', '沙', '鞠', '丰', '巢',
    '关', '查', '荆', '红', '游', '竺', '权', '盖', '益', '桓', '公', '苻', '墨',
];

const COMPOUND_CHINESE_SURNAMES: &[&str] = &[
    "欧阳", "上官", "司马", "东方", "独孤", "南宫", "夏侯", "诸葛", "尉迟", "皇甫", "公孙", "慕容",
    "长孙", "宇文", "司徒", "司空", "轩辕", "令狐", "百里", "呼延", "西门", "纳兰",
];

const EXCEPTIONAL_PERSON_NAMES: &[&str] = &[
    "哪吒",
    "稚圭",
    "叠嶂",
    "白首",
    "老秀",
    "左右",
    "阿良",
    "石头",
    "木头",
    "小黑",
    "血绝",
    "般若",
    "木灵希",
    "月神",
    "荒天",
    "商子烆",
    "无月",
    "商天",
    "明王大尊",
    "洛虚",
    "商弘",
    "洛水寒",
    "罗恸罗",
    "洛姬",
    "薛常进",
    "商月",
    "桓铁血王",
    "白尊",
    "轩辕太真",
    "商夏",
    "孟凰妳",
    "慕容不惑",
    "柯罗",
    "周乞鬼帝",
    "黄礼",
    "赵涵儿",
    "方默峰",
    "林奉先",
    "易天君",
    "司命神女",
    "薛童龄",
    "石北崖",
    "龙主极望",
];

pub(super) fn is_exceptional_person_name(name: &str) -> bool {
    EXCEPTIONAL_PERSON_NAMES.contains(&name)
}

const STABLE_ALIAS_SUFFIXES: &[&str] = &["老头", "真人"];
