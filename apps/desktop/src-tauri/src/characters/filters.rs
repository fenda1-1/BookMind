use super::extraction::{
    CHARACTER_LEADING_PREDICATE_MODIFIERS, CHARACTER_TRAILING_ACTIONS,
    CHARACTER_TRAILING_AUXILIARY_SUFFIXES, CHARACTER_TRAILING_MANNER_SUFFIXES,
    CHARACTER_TRAILING_MODIFIERS, CHARACTER_TRAILING_STATE_SUFFIXES, NEGATIVE_FUNCTION_PREFIXES,
};
use super::name_rules::{
    is_generic_quantified_title_candidate, is_generic_role_title, looks_like_generic_role_phrase,
    looks_like_titled_character_name,
};
const STRICT_NON_PERSON_WORDS: &[&str] = &[
    "全部都",
    "莫非",
    "空间",
    "阎罗族",
    "罗刹族",
    "齐齐",
    "沙沙",
    "冷冰冰",
    "冷峭",
    "厉害",
    "越是",
    "符箓",
    "白衣谷",
    "冷冷的",
    "雷族",
    "雷电",
    "冷声的",
    "林中",
    "成功了",
    "石碑",
    "武魂",
    "龙鳞",
    "明白了",
    "冷峭的",
    "头食姑娘",
    "白苍星",
    "黄泉印",
    "全力",
    "厉害啊",
    "徐徐",
    "房间中",
    "明镜台",
    "明面上",
    "关切的",
    "山中",
    "谢谢",
    "徐徐的",
    "冷然的",
    "沙哑的",
    "冷沉的",
    "冷漠的",
    "向上",
    "封寒背上",
    "一事",
    "随口",
    "后脑勺",
    "使劲",
    "成交",
    "最后",
    "明白",
    "范围",
    "方式",
    "仍是",
    "仰头",
    "二楼",
    "马车内",
    "周国小队",
    "张了张嘴",
    "满意地",
    "湖水",
    "江水",
    "河水",
    "大街",
    "渡船",
    "敲门",
    "机缘",
    "棋局",
    "酒壶",
    "背影",
    "视线",
    "脑袋",
    "井底",
    "全场",
    "厉色",
    "住处",
    "山羊胡",
    "右手",
    "动作",
    "吩咐",
    "含蓄",
    "地点",
    "坟头",
    "大堂",
    "大步",
    "天下",
    "天魔",
    "军镇",
    "后殿",
    "后还",
    "侍女",
    "俏皮",
    "管家",
    "宗主",
    "修仙",
    "俯身",
    "匆忙",
    "半山腰",
    "地点",
    "全场",
];

pub(super) const STRICT_NON_PERSON_PREFIXES: &[&str] = &[
    "一事",
    "一些",
    "一件",
    "一把",
    "一尊",
    "一侧",
    "一具",
    "一句",
    "一处",
    "一大",
    "一定",
    "一幕",
    "一心",
    "一手",
    "一朝",
    "一样",
    "一步",
    "一点",
    "一直",
    "一看",
    "一脸",
    "一袭",
    "一起",
    "一身",
    "一闪",
    "一间",
    "一颗",
    "一堵",
    "一道",
    "一座",
    "一条",
    "一片",
    "一阵",
    "一股",
    "两位",
    "两名",
    "两幅",
    "三座",
    "三个",
    "五人",
    "二楼",
    "世人",
    "东边",
    "西边",
    "南边",
    "京城",
    "主位",
    "柜台",
    "学塾",
    "书斋",
    "书院",
    "红烛镇",
    "蛮荒天下",
    "浩然天下",
    "结果",
    "然后",
    "最后",
    "其实",
    "仍是",
    "转头",
    "才",
    "并肩",
    "居高",
    "打着",
    "红着",
    "满脸",
    "歪着",
    "起身",
    "迅速",
    "选择",
    "醉醺醺",
    "心声",
    "压低",
    "倒是",
    "又能",
    "甚至",
    "只要",
    "现在",
    "看似",
    "主要",
    "同样",
    "另外",
    "咱们",
    "死活",
    "绝不",
    "绝对",
    "需要",
    "贫道",
    "为何",
    "什么",
    "人便",
    "人和",
    "人对",
    "人已经",
    "人很快",
    "人悠然",
    "人无奈",
    "人是",
    "人朗声",
    "人登高",
    "人远远",
    "仿佛",
    "依旧",
    "先对",
    "先生不",
    "先生向",
    "再跟",
    "几次",
    "刚要",
    "别洲",
    "别狮子",
    "前辈",
    "只听",
    "只好",
    "只得",
    "只管",
    "吃的",
    "合适",
    "同时",
    "后撤",
    "后记得",
    "后门",
    "哪怕",
    "哪有",
    "嗑着",
    "嗓音",
    "四个",
    "四人",
    "土地庙",
    "地去",
    "埋河",
    "城头",
    "堂下",
    "复是",
    "夜幕",
    "大声",
    "大小",
    "大日",
    "大晚上",
    "大踏步",
    "大骊",
];

pub(super) const STRICT_NON_PERSON_SUFFIXES: &[&str] = &[
    "一事",
    "好剑",
    "神像",
    "墙壁",
    "契机",
    "言语",
    "嗓音",
    "脑袋",
    "后脑勺",
    "背影",
    "视线",
    "湖水",
    "江水",
    "河水",
    "大街",
    "渡船",
    "二楼",
    "敲门",
    "城头",
    "那边",
    "上空",
    "某处",
    "高楼",
    "门外",
    "山顶",
    "客栈",
    "铺子",
    "窑火",
    "路上",
    "西边",
    "屋内",
    "山外",
    "河对岸",
    "青山之巅",
    "青山",
    "踪迹",
    "人事",
    "法袍",
    "街道",
    "场景",
    "桌子",
    "首辅",
    "儒衫",
    "冷汗",
    "武胆",
    "弟子",
    "长辈",
    "心腹",
    "挂像",
    "骑卒",
    "剑修",
    "武夫",
    "神女",
    "郎中",
    "城隍",
    "狐妖",
    "圣贤",
    "画师",
    "白猿",
    "女儿",
    "本王",
    "娘亲",
    "住持",
    "主事人",
    "人氏",
    "回家",
    "期待",
    "王朝",
    "方",
    "雅言",
    "大门",
    "瓜子",
    "朋友",
    "来处",
    "水面",
    "以外",
    "高处",
    "阁方",
    "客人",
    "夫人",
    "降临",
    "北岳",
    "朝廷",
    "天空",
    "边境",
    "数国",
    "王朝",
    "神女",
    "境",
    "力士",
    "老蛟",
    "阴神",
    "道人",
    "老道",
    "树林",
    "大腿",
    "夜幕",
    "开口",
    "抱拳",
    "使劲",
    "随口",
    "仰头",
    "抬头",
    "低头",
    "转头",
    "好奇",
    "毫不",
    "最后",
    "淡然",
    "终于",
    "仍是",
    "嘿嘿",
    "哈哈",
    "呵呵",
    "嗤",
    "赶",
    "气",
    "没",
    "亲自",
    "正要",
    "刚要",
    "随即",
    "不会",
];

pub(super) fn is_stop_word(name: &str) -> bool {
    NON_CHARACTER_WORDS.contains(&name)
}

pub(super) fn is_non_character_candidate(name: &str) -> bool {
    if is_strict_non_person_candidate(name) {
        return true;
    }
    if is_learned_non_person_profile_name(name) {
        return true;
    }
    if is_stop_word(name) {
        return true;
    }
    if is_hard_rejected_character_candidate(name) {
        return true;
    }
    if CHARACTER_TRAILING_ACTIONS.contains(&name) {
        return true;
    }
    if CHARACTER_TRAILING_MODIFIERS.contains(&name) {
        return true;
    }
    if CHARACTER_TRAILING_STATE_SUFFIXES.contains(&name) {
        return true;
    }
    if CHARACTER_TRAILING_AUXILIARY_SUFFIXES.contains(&name) {
        return true;
    }
    if CHARACTER_TRAILING_MANNER_SUFFIXES.contains(&name) {
        return true;
    }
    if is_non_character_connector_phrase(name) {
        return true;
    }
    if is_pronoun_or_determiner_phrase(name) {
        return true;
    }
    if is_structural_non_character_phrase(name) {
        return true;
    }
    if has_generic_title_noise_prefix(name) {
        return true;
    }
    if is_generic_title_candidate(name) {
        return true;
    }
    if name
        .chars()
        .any(|ch| matches!(ch, '章' | '卷' | '节' | '页'))
    {
        return true;
    }
    false
}

fn is_hard_rejected_character_candidate(name: &str) -> bool {
    is_strict_non_person_candidate(name)
        || is_learned_non_person_profile_name(name)
        || is_negative_function_phrase(name)
        || is_generic_quantified_title_candidate(name)
        || has_manner_suffix_residue(name)
}

fn is_strict_non_person_candidate(name: &str) -> bool {
    if STRICT_NON_PERSON_WORDS.contains(&name)
        || is_generic_role_title(name)
        || looks_like_generic_role_phrase(name)
    {
        return true;
    }
    if STRICT_NON_PERSON_PREFIXES
        .iter()
        .any(|prefix| name.starts_with(prefix))
    {
        return true;
    }
    if STRICT_NON_PERSON_SUFFIXES
        .iter()
        .any(|suffix| name.ends_with(suffix))
    {
        return true;
    }
    false
}

fn is_learned_non_person_profile_name(name: &str) -> bool {
    if LEARNED_NON_PERSON_PROFILE_WORDS.contains(&name) {
        return true;
    }
    if is_learned_title_residue_phrase(name) {
        return true;
    }
    false
}

fn is_learned_title_residue_phrase(name: &str) -> bool {
    LEARNED_NON_PERSON_TITLE_PREFIXES.iter().any(|prefix| {
        name.starts_with(prefix)
            && name.chars().count() > prefix.chars().count()
            && LEARNED_NON_PERSON_TITLE_SUFFIXES
                .iter()
                .any(|suffix| name.ends_with(suffix))
    })
}

const LEARNED_NON_PERSON_PROFILE_WORDS: &[&str] = &[
    "安安静静",
    "巴巴",
    "毕恭毕敬",
    "别处",
    "别说",
    "方才",
    "方才瞧见",
    "封君",
    "封姨",
    "符箓于玄",
    "甘州",
    "高空",
    "高人",
    "公子",
    "宫主",
    "古怪",
    "关心",
    "桂花岛",
    "何必",
    "红衣剑",
    "胡乱",
    "花俏",
    "金丹地仙",
    "金丹修士",
    "金色小人",
    "空白楹联",
    "空中",
    "冷不丁",
    "明月",
    "明知故",
    "莫名其妙",
    "女先生",
    "漂亮姑娘",
    "山怪",
    "山脚一处",
    "山脚这边",
    "山门这边",
    "山青",
    "山上",
    "山上好友",
    "山神",
    "山下",
    "山主",
    "尚未",
    "师父",
    "师父师父",
    "师父要我",
    "师兄",
    "师兄师姐",
    "师兄左右",
    "师尊",
    "松脂",
    "温而",
    "温声",
    "文士",
    "闻声",
    "闻言",
    "闻言后",
    "乌江",
    "乌啼",
    "武将",
    "辛苦",
    "幸灾乐祸",
    "严格",
    "颜悦色",
    "杨家药铺",
    "元凶",
    "越来越",
    "祖山",
    "道长道长",
    "龙窑老师",
    "龙窑师傅",
];

const LEARNED_NON_PERSON_TITLE_PREFIXES: &[&str] = &[
    "挨了",
    "按照",
    "搬出",
    "半个",
    "本",
    "毕竟",
    "别怪",
    "馋",
    "传道",
    "吹捧",
    "村塾",
    "答应",
    "待在",
    "担任",
    "当陈",
    "当初",
    "当",
    "当年",
    "当然",
    "当时",
    "当是",
    "当下",
    "道长",
    "得的",
    "得看",
    "得了",
    "得与",
    "都被",
    "都是",
    "儿",
    "反正",
    "废物",
    "风水",
    "服",
    "副",
    "敢问",
    "感谢",
    "估计",
    "果然",
    "还望",
    "喊裴",
    "喊",
    "何况",
    "后来",
    "后",
    "换成",
    "回禀",
    "会儿",
    "会去",
    "会在",
    "或是",
    "既然",
    "济过",
    "加上",
    "家塾",
    "假设",
    "教训",
    "静待",
    "觉得",
    "俊的",
    "看到",
    "看的",
    "看一",
    "看",
    "恳请",
    "口呼",
    "亏得",
    "来见",
    "来与",
    "劳烦",
    "劳驾",
    "离着",
    "埋怨",
    "么齐",
    "么阮",
    "么",
    "没了",
    "免得",
    "面对",
    "明天",
    "摸",
    "某位",
    "某些",
    "哪个",
    "哪家",
    "难怪",
    "能让",
    "能",
    "女",
    "怕陈",
    "怕齐",
    "怕",
    "拍",
    "跑来",
    "陪在",
    "陪着",
    "陪",
    "漂亮",
    "平时",
    "凭陈",
    "凭",
    "其余",
    "千金",
    "前你",
    "前齐",
    "前",
    "去与",
    "确定",
    "绕着",
    "认了",
    "如今",
    "若是",
    "色的",
    "上次",
    "上任",
    "少",
    "身为",
    "世的",
    "授业",
    "授予",
    "书",
    "说陈",
    "说你",
    "说齐",
    "说少爷",
    "说师父",
    "说师兄",
    "说她",
    "说我",
    "说先生",
    "说小",
    "说",
    "算陈",
    "算当",
    "算命",
    "算账",
    "算",
    "虽非",
    "同辈",
    "同门",
    "同",
    "唯愿",
    "为陈",
    "为此",
    "为大师姐",
    "为宁",
    "为是",
    "为先生",
    "为小",
    "为郑",
    "为",
    "惜孙",
    "惜",
    "下任",
    "下",
    "先前",
    "想起",
    "想说",
    "想",
    "谢过",
    "心爱",
    "心的",
    "行的",
    "希望",
    "许多",
    "学生",
    "学",
    "寻常",
    "询问",
    "窑工",
    "窑口",
    "要被",
    "要给",
    "要跟",
    "要喊",
    "要是",
    "要为",
    "要与",
    "一旦",
    "一对",
    "一声",
    "一种",
    "一州",
    "因为",
    "用孙",
    "用",
    "又是",
    "怨",
    "愿陈",
    "沾陈",
    "站在",
    "掌教",
    "掌门",
    "掌眼",
    "这位",
    "真是",
    "正副",
    "正职",
    "只等",
    "只看",
    "只有",
    "指",
    "至少",
    "至于",
    "自家",
    "走到",
    "做",
    "趁着",
    "未来",
];

const LEARNED_NON_PERSON_TITLE_SUFFIXES: &[&str] = &[
    "先生",
    "师父",
    "师傅",
    "师兄",
    "师姐",
    "大师姐",
    "大师兄",
    "少爷",
    "小姐",
    "姑娘",
    "陛下",
    "道长",
    "城主",
    "将军",
    "小姑娘",
    "小师兄",
    "老师",
    "老先生",
    "师尊",
];

fn is_negative_function_phrase(name: &str) -> bool {
    let char_count = name.chars().count();
    NEGATIVE_FUNCTION_PREFIXES.iter().any(|prefix| {
        name.starts_with(prefix)
            && char_count > prefix.chars().count()
            && !looks_like_titled_character_name(name)
    })
}

fn has_manner_suffix_residue(name: &str) -> bool {
    CHARACTER_TRAILING_MANNER_SUFFIXES
        .iter()
        .any(|suffix| name.ends_with(suffix) && name.chars().count() > suffix.chars().count() + 1)
}

pub(super) fn is_non_character_candidate_in_context(
    text: &str,
    start: usize,
    end: usize,
    name: &str,
) -> bool {
    if is_state_word_before_particle_action(text, end, name) {
        return true;
    }
    if !is_non_character_connector_phrase(name) {
        return false;
    }
    let Some(suffix) = text.get(end..) else {
        return false;
    };
    if !starts_with_speech_predicate(trim_context_gap(suffix)) {
        return false;
    }
    if NON_CHARACTER_CONNECTOR_PHRASES.contains(&name) {
        return true;
    }
    let Some(prefix) = text.get(..start) else {
        return true;
    };
    ends_with_clause_boundary(prefix) || has_recent_hesitation_context(prefix)
}

fn is_state_word_before_particle_action(text: &str, end: usize, name: &str) -> bool {
    if !CHARACTER_TRAILING_MODIFIERS.contains(&name) {
        return false;
    }
    let Some(suffix) = text.get(end..) else {
        return false;
    };
    suffix.starts_with('的') || suffix.starts_with('地')
}

pub(super) fn is_pronoun_or_determiner_phrase(name: &str) -> bool {
    let pronoun_prefixes = [
        "他", "她", "它", "祂", "我", "你", "您", "自己", "我们", "你们", "他们", "她们", "它们",
    ];
    if pronoun_prefixes
        .iter()
        .any(|prefix| name.starts_with(prefix))
    {
        return true;
    }
    let determiner_prefixes = [
        "这个",
        "那个",
        "这些",
        "那些",
        "这是",
        "这也",
        "这句",
        "这一路",
        "这里",
        "这一",
        "这只",
        "这样",
        "这座",
        "这种",
        "这能",
        "这对",
        "这根本",
        "这只能",
        "那岂",
        "某个",
        "这就",
        "那就",
        "那你",
        "那我",
        "那人",
        "那身影",
        "那声音",
        "那男人",
        "那少年",
        "那东西",
        "几个",
        "六个",
        "两个",
        "两人",
        "二人",
        "三个人",
        "每一个人",
        "第一个人",
        "下一个人",
        "有人",
        "所有人",
    ];
    determiner_prefixes
        .iter()
        .any(|prefix| name.starts_with(prefix))
}

fn is_generic_title_candidate(name: &str) -> bool {
    if matches!(
        name,
        "队长"
            | "副队长"
            | "小队队长"
            | "总队长"
            | "教官"
            | "总教官"
            | "医生"
            | "老师"
            | "先生"
            | "小姐"
            | "姑娘"
            | "小姑娘"
            | "男人"
            | "女人"
            | "少年"
            | "少女"
            | "老人"
            | "老者"
            | "青年"
            | "大叔"
            | "主神"
            | "妇人"
            | "汉子"
            | "书生"
            | "剑修"
            | "修士"
            | "道人"
            | "道士"
            | "阴神"
    ) {
        return true;
    }
    let generic_title_prefixes = [
        "众人", "众", "诸位", "各位", "几位", "几名", "一位", "两位", "三位", "其他", "所有",
        "一个", "两个", "三个", "那位", "这位", "中年",
    ];
    let title_suffixes = [
        "教官",
        "医生",
        "老师",
        "队长",
        "将军",
        "护工",
        "道人",
        "大叔",
        "姑娘",
        "男人",
        "女人",
        "男孩",
        "女孩",
        "少年",
        "少女",
        "老人",
        "老者",
        "青年",
        "年轻人",
        "先生",
        "道人",
        "道士",
        "书生",
        "剑修",
        "修士",
        "陛下",
        "殿下",
    ];
    generic_title_prefixes.iter().any(|prefix| {
        name.starts_with(prefix)
            && title_suffixes.iter().any(|suffix| {
                name.ends_with(suffix) && name.chars().count() > suffix.chars().count()
            })
    })
}

fn has_generic_title_noise_prefix(name: &str) -> bool {
    const GENERIC_TITLE_NOISE_PREFIXES: &[&str] = &[
        "成为", "代理", "单靠", "某", "每天", "谢谢", "所以", "听说", "时候", "当年", "当晚",
        "敢从", "干掉", "很像", "接近", "解剖", "镜的", "靠的", "没事", "拿了", "哪天", "哪有",
        "能是", "派遣", "抛下", "其实", "抢走", "算上", "随着", "正如", "周围", "抓住", "总之",
        "组织", "昨晚", "场", "点当", "人的", "人当", "人造", "许多", "一群", "这等", "这", "临时",
        "预备", "新任", "现在", "现", "小", "当", "复活", "加油", "叫我", "觉得", "要是", "信的",
        "一届", "增加", "尖的", "陌生", "悲催", "够了", "去见", "谁当", "愿为", "还请", "送",
    ];
    const GENERIC_TITLE_NOISE_SUFFIXES: &[&str] =
        &["教官", "队长", "老师", "城主", "院长", "大叔", "陛下"];
    GENERIC_TITLE_NOISE_PREFIXES.iter().any(|prefix| {
        name.starts_with(prefix)
            && GENERIC_TITLE_NOISE_SUFFIXES
                .iter()
                .any(|suffix| name.ends_with(suffix))
    })
}

fn is_structural_non_character_phrase(name: &str) -> bool {
    if is_structural_non_character_exact(name) {
        return true;
    }
    if name.starts_with("有些") || name.starts_with("一边") || name.starts_with("一面") {
        return true;
    }
    if STRUCTURAL_NON_CHARACTER_PREFIXES
        .iter()
        .any(|prefix| name.starts_with(prefix))
    {
        return true;
    }
    if STRUCTURAL_NON_CHARACTER_SUFFIXES
        .iter()
        .any(|suffix| name.ends_with(suffix))
    {
        return true;
    }
    if starts_with_generic_group_phrase(name) {
        return true;
    }
    if starts_with_non_character_object_action(name) {
        return true;
    }
    if BODY_OR_OBJECT_PREFIXES
        .iter()
        .any(|prefix| name.starts_with(prefix))
    {
        return true;
    }
    if SCENE_OR_DIRECTION_SUFFIXES
        .iter()
        .any(|suffix| name.ends_with(suffix))
    {
        return true;
    }
    if GENERIC_GROUP_PREFIXES
        .iter()
        .any(|prefix| name.starts_with(prefix))
        && (CHARACTER_TRAILING_STATE_SUFFIXES.contains(&name)
            || CHARACTER_TRAILING_AUXILIARY_SUFFIXES
                .iter()
                .any(|suffix| name.ends_with(suffix)))
    {
        return true;
    }
    false
}

fn starts_with_generic_group_phrase(name: &str) -> bool {
    GENERIC_GROUP_PREFIXES
        .iter()
        .filter(|prefix| prefix.chars().count() >= 2)
        .any(|prefix| name.starts_with(prefix))
}

fn starts_with_non_character_object_action(name: &str) -> bool {
    NON_CHARACTER_OBJECT_ACTION_PREFIXES.iter().any(|prefix| {
        name.starts_with(prefix)
            && NON_CHARACTER_OBJECT_ACTION_TARGETS
                .iter()
                .any(|target| name[prefix.len()..].starts_with(target))
    })
}

fn is_structural_non_character_exact(name: &str) -> bool {
    STRUCTURAL_NON_CHARACTER_WORDS.contains(&name)
}

const NON_CHARACTER_OBJECT_ACTION_PREFIXES: &[&str] =
    &["看到", "看见", "看着", "看向", "望向", "盯着"];

const NON_CHARACTER_OBJECT_ACTION_TARGETS: &[&str] = &[
    "他们", "她们", "它们", "自己", "远处", "一旁", "天边", "雨中", "快步",
];

const BODY_OR_OBJECT_PREFIXES: &[&str] = &[
    "声音",
    "目光",
    "眼神",
    "双眼",
    "双眸",
    "眉头",
    "嘴角",
    "脸色",
    "脸上",
    "身影",
    "身体",
    "手中",
    "心中",
    "脑海",
    "意识",
    "空气",
    "气息",
    "夜色",
    "黑暗",
    "光芒",
    "火光",
    "烟雾",
    "风声",
    "脚步",
    "脚步声",
    "头顶",
    "头部",
];

const SCENE_OR_DIRECTION_SUFFIXES: &[&str] = &[
    "传来",
    "响起",
    "落下",
    "出现",
    "方向",
    "远方",
    "前方",
    "后方",
    "周围",
    "四周",
    "身后",
    "眼前",
    "面前",
    "不远处",
];

const GENERIC_GROUP_PREFIXES: &[&str] = &[
    "众人",
    "众",
    "所有人",
    "所有",
    "几人",
    "几位",
    "几名",
    "其他人",
    "其他",
    "两人",
    "二人",
    "三人",
    "有人",
    "后者",
    "前者",
];

const STRUCTURAL_NON_CHARACTER_WORDS: &[&str] = &[
    "后者",
    "前者",
    "其他人",
    "其他几人",
    "其他三人",
    "几人",
    "三人",
    "四人",
    "众人",
    "众人顿时",
    "众人的提",
    "众人离去",
    "众人越",
    "众人齐声",
    "众人齐齐",
    "其中一人",
    "半个人影",
    "那人",
    "那你",
    "那我",
    "当他",
    "但他",
    "但她",
    "不管怎么",
    "更别",
    "先不",
    "不要",
    "这就",
    "那就",
    "有什么",
    "许久之后",
    "新年第一",
    "就在两人",
    "就在众人",
    "就在三人",
    "甚至可以",
    "正准备",
    "毫无疑",
    "但毫无疑",
    "却又什么",
    "只能",
    "一个",
    "任何",
    "人们",
    "各种",
    "仔细",
    "虽然",
    "犹豫",
    "还有一个",
    "这东西",
    "难道",
    "一道长",
    "开门见山",
    "征求意见",
    "岂不是",
    "当我没",
    "机会",
    "精神",
    "这不是",
    "倒不是",
    "因为他",
    "还用",
    "又没",
    "还欲",
    "又抬头",
    "就好",
    "就点",
    "就算",
    "现在不是",
    "现在最大",
    "现在应该",
    "天尊不是",
    "方向看去",
    "时间不会",
    "片刻后",
    "训练场",
    "时间长河",
    "否需要",
    "休淡淡",
    "刚刚",
    "四人",
    "整个人",
    "新兵们",
    "没听",
    "理论上来",
    "重新",
    "齐刷刷",
    "再怎么",
    "再者",
    "哈哈",
    "大夏的方",
    "当即",
    "缓步",
    "快步",
    "轻微",
    "话刚",
    "跟你",
    "那我换个",
    "默默",
    "默默地",
    "同时",
    "纷纷",
    "连连",
    "一直",
    "同样",
    "再度",
    "接连",
    "紧接",
    "随后",
    "然后",
    "准确",
    "短暂",
    "每天",
    "下意识",
    "二话不",
    "不好",
    "好像",
    "好自己",
    "换句话",
    "严格来",
    "简单来",
    "一般来",
    "所以",
    "所以你",
    "甚至开始",
    "当时看到",
    "该由谁来",
    "而是",
    "不是",
    "并没有",
    "丝毫没有",
    "没有多",
    "没有再",
    "没有回",
    "没有人",
    "没有再多",
    "只是点",
    "只是摇",
    "还是点",
    "还是摇",
    "便点",
    "又转头",
    "正缓缓",
    "号缓缓",
    "号没有",
    "号突然",
    "片刻之后",
    "也同时",
    "也没有",
    "却没有",
    "但他没有",
    "但他还是",
    "可你不是",
    "不是你",
    "所以我",
    "人都没有",
    "人率先",
    "来自己是",
    "连个",
    "又没有",
    "便开口",
    "有些",
    "作为",
    "整个",
    "云上",
    "根本",
    "出路",
    "屋外",
    "暗中",
    "楼下",
    "下成长",
    "又回头",
    "变成自我",
    "估计更会",
    "凭借这种",
    "忍不住讥",
    "才有人",
    "根本无法",
];

const STRUCTURAL_NON_CHARACTER_PREFIXES: &[&str] = &[
    "不管怎么",
    "听到这个",
    "就在",
    "更别",
    "先不",
    "不要",
    "这就",
    "那就",
    "有什么",
    "众",
    "别的",
    "穿着",
    "队长所谓",
    "让众",
    "些只是",
    "三位神",
    "放心",
    "今天那个",
    "既然那个",
    "得到这个",
    "出了这个",
    "倒不如",
    "于他们",
    "自己的身",
    "属于自己",
    "甚至可以",
    "比如",
    "正如",
    "就是",
    "看着",
    "没有",
    "不是",
    "很多",
    "这群",
    "小队",
    "这小姑娘",
    "其中",
    "各个避难",
    "让小姑娘",
    "当即",
    "才继续",
    "才主动",
    "径直",
    "立刻",
    "缓缓",
    "已经",
    "应该",
    "想要",
    "直接",
    "继续",
    "默默",
    "些",
    "人冷声",
    "倒地",
    "即将",
    "前方",
    "周围",
    "地方",
    "冰霜",
    "病栋",
    "窗外",
    "门外",
    "边",
    "人缓缓",
    "毫无疑",
    "但毫无疑",
    "却又什么",
    "还有一个",
    "有一个",
    "一个",
    "某一个",
    "一道",
    "一双",
    "两具",
    "特邀",
    "境的",
    "除了",
    "刚刚",
    "号",
    "理论上来",
    "那我换个",
    "还是",
    "退一万步",
    "也没有",
    "并没有",
    "没有再",
    "没有继续",
    "没有能够",
    "而是",
    "如果",
    "似乎",
    "也只是",
    "还没等",
    "不等",
    "不知该",
    "据他所",
    "能跟我",
    "至于你",
    "根本",
    "任何",
    "还用",
];

const STRUCTURAL_NON_CHARACTER_SUFFIXES: &[&str] = &[
    "之后",
    "之前",
    "以来",
    "起来",
    "下去",
    "这里",
    "那里",
    "问题",
    "事情",
    "这次",
    "一句话",
    "一个字",
    "一点",
    "一次",
    "一人",
    "几人",
    "三人",
    "四人",
    "众人",
    "新兵们",
    "自己",
    "队员",
    "方向",
    "的方",
    "一旁",
    "远处",
    "身影",
    "虚影",
    "声音",
    "目光",
    "眼眸",
    "表情",
    "神情",
    "脑海",
    "手中",
    "身前",
    "身旁",
    "上方",
    "边缘",
    "之外",
    "浪潮",
    "院落",
    "关隘",
    "另一侧",
    "另一边",
    "门后",
    "头顶",
    "深处",
    "夜空",
    "半空",
    "原地",
    "入口",
];

fn starts_with_speech_predicate(value: &str) -> bool {
    CONNECTOR_FOLLOWED_SPEECH_PREDICATES
        .iter()
        .any(|predicate| value.starts_with(predicate))
}

pub(super) fn trim_context_gap(value: &str) -> &str {
    value.trim_start_matches(|ch: char| {
        ch.is_whitespace() || matches!(ch, '“' | '”' | '‘' | '’' | '"' | '\'' | '，' | ',' | '、')
    })
}

pub(super) fn trim_leading_manner_context(mut value: &str) -> &str {
    loop {
        let trimmed = trim_context_particle_gap(trim_context_gap(value));
        let Some(suffix) = CHARACTER_TRAILING_MANNER_SUFFIXES
            .iter()
            .chain(CHARACTER_LEADING_PREDICATE_MODIFIERS.iter())
            .chain(CHARACTER_TRAILING_MODIFIERS.iter())
            .chain(CHARACTER_TRAILING_STATE_SUFFIXES.iter())
            .chain(CHARACTER_TRAILING_AUXILIARY_SUFFIXES.iter())
            .find(|suffix| trimmed.starts_with(**suffix))
        else {
            return trimmed;
        };
        value = &trimmed[suffix.len()..];
    }
}

pub(super) fn trim_leading_movement_target_context(value: &str) -> &str {
    for prefix in ["向他", "向她", "向它", "向祂", "向前", "向后", "向远处"] {
        if let Some(rest) = value.strip_prefix(prefix) {
            return rest;
        }
    }
    value
}

fn trim_context_particle_gap(value: &str) -> &str {
    value.trim_start_matches(|ch: char| matches!(ch, '的' | '地' | '得'))
}

fn ends_with_clause_boundary(value: &str) -> bool {
    value
        .chars()
        .rev()
        .find(|ch| !ch.is_whitespace())
        .is_some_and(|ch| {
            matches!(
                ch,
                '，' | '。' | '；' | '：' | '！' | '？' | ',' | ';' | ':' | '!' | '?'
            )
        })
}

fn has_recent_hesitation_context(value: &str) -> bool {
    let recent: String = value.chars().rev().take(12).collect();
    let recent: String = recent.chars().rev().collect();
    CHARACTER_HESITATION_MARKERS
        .iter()
        .any(|marker| recent.contains(marker))
}

pub(super) fn is_non_character_connector_phrase(name: &str) -> bool {
    if NON_CHARACTER_CONNECTOR_PHRASES.contains(&name) {
        return true;
    }
    let char_count = name.chars().count();
    char_count <= 4
        && NON_CHARACTER_CONNECTOR_SUFFIXES
            .iter()
            .chain(CHARACTER_TRAILING_MODIFIERS.iter())
            .chain(CHARACTER_TRAILING_STATE_SUFFIXES.iter())
            .any(|suffix| name.ends_with(suffix) && starts_with_connector_prefix(name, suffix))
}

fn starts_with_connector_prefix(name: &str, suffix: &str) -> bool {
    let Some(prefix) = name.strip_suffix(suffix) else {
        return false;
    };
    !prefix.is_empty() && NON_CHARACTER_CONNECTOR_PREFIXES.contains(&prefix)
}

const NON_CHARACTER_CONNECTOR_PHRASES: &[&str] = &[
    "还是",
    "也就是",
    "也就",
    "就是",
    "你是",
    "我是",
    "他是",
    "她是",
    "只是",
    "仍然",
    "依旧",
    "终于",
    "于是",
    "然后",
    "接着",
    "随后",
    "当即",
    "不过",
    "但是",
    "可是",
    "然而",
    "甚至",
    "几乎",
    "似乎",
    "仿佛",
    "也许",
    "或许",
    "必须",
    "只能",
    "只好",
    "再次",
    "再度",
    "直接",
    "立刻",
    "马上",
    "按理",
    "或者",
    "如果",
    "不是",
    "而是",
    "所以",
    "这么",
    "怎么",
    "换句话",
    "严格来",
    "简单来",
    "没有多",
    "别的不",
    "并没有",
    "没有人",
    "没有再多",
    "而是直接",
    "那岂不是",
    "最终还是",
    "还是如实",
    "还是老实",
    "还不好",
    "可以",
    "应该",
    "主动",
    "听到这个",
    "一般来",
    "缓缓",
    "慢慢",
    "轻轻",
    "却还是",
    "又还是",
    "可还是",
    "但还是",
    "却终于",
    "才终于",
    "这才",
    "便又",
    "也就",
];

pub(super) const CONNECTOR_FOLLOWED_SPEECH_PREDICATES: &[&str] = &[
    "低声说道",
    "轻声说道",
    "沉声说道",
    "冷声说道",
    "低声道",
    "轻声道",
    "沉声道",
    "冷声道",
    "喃喃道",
    "反问道",
    "说道",
    "问道",
    "答道",
    "笑道",
    "喊道",
    "叫道",
    "开口",
    "低语",
    "说",
    "问",
    "答",
    "喊",
    "叫",
];

pub(super) const CHARACTER_HESITATION_MARKERS: &[&str] = &[
    "犹豫", "迟疑", "沉默", "思索", "思考", "愣了", "怔了", "停顿", "片刻", "半晌", "良久",
];

const NON_CHARACTER_CONNECTOR_SUFFIXES: &[&str] = &[
    "还是", "终于", "仍然", "依旧", "只是", "直接", "再次", "再度", "立刻", "马上", "缓缓", "慢慢",
    "轻轻",
];

const NON_CHARACTER_CONNECTOR_PREFIXES: &[&str] = &[
    "却", "又", "可", "但", "才", "还", "仍", "也", "便", "就", "再", "很", "正", "尽量", "强行",
];

const NON_CHARACTER_WORDS: &[&str] = &[
    "第一章",
    "第二章",
    "第三章",
    "第四章",
    "第五章",
    "序章",
    "正文",
    "番外",
    "章节",
    "本章",
    "上章",
    "下章",
    "病房",
    "学校",
    "医院",
    "房间",
    "走廊",
    "门口",
    "窗边",
    "窗外",
    "床边",
    "楼道",
    "大厅",
    "宿舍",
    "教室",
    "城市",
    "小镇",
    "街道",
    "黑暗",
    "夜色",
    "天空",
    "地面",
    "任务",
    "系统",
    "能力",
    "禁墟",
    "神墟",
    "正文",
    "索引",
    "全文",
    "当前",
    "人物",
    "关系",
    "证据",
    "这里",
    "那里",
    "哪里",
    "身后",
    "眼前",
    "面前",
    "旁边",
    "附近",
    "远处",
    "远方",
    "方向",
    "不远处",
    "某处",
    "四周",
    "战场",
    "大殿",
    "屏幕",
    "答案",
    "入口",
    "夜空",
    "天边",
    "半空",
    "原地",
    "头顶",
    "头部",
    "上空",
    "嗓子眼",
    "哈巴狗",
    "一片",
    "安静",
    "低声",
    "轻声",
    "沉声",
    "冷声",
    "没有",
    "别人",
    "众人",
    "大家",
    "自己",
    "他们",
    "她们",
    "我们",
    "你们",
    "这些",
    "那些",
    "这个",
    "那个",
    "什么",
    "东西",
    "事情",
    "声音",
    "目光",
    "眼神",
    "双眼",
    "双眸",
    "眉头",
    "嘴角",
    "脸色",
    "脸上",
    "身影",
    "身体",
    "手中",
    "心中",
    "脑海",
    "空气",
    "气息",
    "表情",
    "时间",
    "时候",
    "现在",
    "刚才",
    "突然",
    "已经",
    "开始",
    "继续",
    "发现",
    "感觉",
    "知道",
    "说道",
    "问道",
    "回答",
    "沉默",
    "点头",
    "摇头",
    "转头",
    "低头",
    "回头",
    "抬头",
    "看向",
    "望向",
    "走来",
    "改口",
    "叉腰",
    "冷笑",
    "提示",
    "完成",
    "少年",
    "少女",
    "男人",
    "女人",
    "男子",
    "女子",
    "老人",
    "老者",
    "孩子",
    "青年",
    "对方",
    "前方",
    "后方",
    "周围",
    "房门",
    "电话",
    "手机",
    "漆黑",
    "机会",
    "精神",
    "精神焕发",
    "精神类",
    "训练场",
    "时间长河",
    "各种各样",
];

#[cfg(test)]
mod tests {
    use super::is_non_character_candidate;

    #[test]
    fn filters_learned_non_person_profile_names() {
        const NON_PERSON_NAMES: &[&str] = &[
            "挨了先生",
            "安安静静",
            "按照少爷",
            "按照师父",
            "按照先生",
            "巴巴",
            "搬出先生",
            "半个城主",
            "半个师父",
            "半个师兄",
            "半个先生",
            "本姑娘",
            "毕恭毕敬",
            "毕竟师父",
            "别处",
            "别怪先生",
            "别说",
            "馋大师姐",
            "趁着师父",
            "趁着先生",
            "传道先生",
            "吹捧先生",
            "村塾先生",
            "答应先生",
            "待在师父",
            "担任城主",
            "当陈先生",
            "当初师父",
            "当大师姐",
            "当大师兄",
            "当年师父",
            "当年师兄",
            "当年先生",
            "当然师父",
            "当师父",
            "当师傅",
            "当师兄",
            "当时师父",
            "当时先生",
            "当是师兄",
            "当下师父",
            "当先生",
            "当小姑娘",
            "当小师兄",
            "道长道长",
            "得的师兄",
            "得看先生",
            "得了师父",
            "得了先生",
            "得与陛下",
            "都被先生",
            "都是师父",
            "都是师兄",
            "儿大师姐",
            "反正师父",
            "反正师兄",
            "反正先生",
            "方才",
            "方才瞧见",
            "废物师父",
            "风水先生",
            "封君",
            "封姨",
            "服先生",
            "符箓于玄",
            "副城主",
            "甘州",
            "敢问道长",
            "敢问姑娘",
            "敢问师兄",
            "敢问先生",
            "感谢道长",
            "感谢少爷",
            "感谢先生",
            "高空",
            "高人",
            "公子",
            "宫主",
            "估计先生",
            "古怪",
            "关心",
            "桂花岛",
            "果然先生",
            "还望先生",
            "喊裴师姐",
            "喊师兄",
            "喊先生",
            "喊小师兄",
            "何必",
            "何况师父",
            "红衣剑",
            "后来师父",
            "后来先生",
            "后师父",
            "后先生",
            "胡乱",
            "花俏",
            "换成师父",
            "换成师兄",
            "回禀陛下",
            "回禀少爷",
            "会儿师父",
            "会去将军",
            "会在姑娘",
            "或是师父",
            "既然陛下",
            "既然师父",
            "既然先生",
            "济过少爷",
            "加上师父",
            "加上先生",
            "家塾先生",
            "假设师父",
            "教训先生",
            "金丹地仙",
            "金丹修士",
            "金色小人",
            "静待师父",
            "觉得师父",
            "觉得先生",
            "俊的姑娘",
            "看到师父",
            "看的姑娘",
            "看姑娘",
            "看先生",
            "看一姑娘",
            "恳请道长",
            "恳请少爷",
            "恳请师父",
            "恳请先生",
            "空白楹联",
            "空中",
            "口呼陛下",
            "亏得师父",
            "来见先生",
            "来与师父",
            "劳烦姑娘",
            "劳烦先生",
            "劳驾师兄",
            "冷不丁",
            "离着师父",
            "离着师兄",
            "龙窑老师",
            "龙窑师傅",
            "埋怨师父",
            "么齐先生",
            "么阮师傅",
            "么师父",
            "么先生",
            "没了师父",
            "免得先生",
            "面对先生",
            "明天师父",
            "明月",
            "明知故",
            "摸小姑娘",
            "莫名其妙",
            "某位姑娘",
            "某位师兄",
            "某些师兄",
            "哪个姑娘",
            "哪个先生",
            "哪家姑娘",
            "难怪师父",
            "难怪先生",
            "能让师父",
            "能让先生",
            "能师父",
            "女先生",
            "怕陈先生",
            "怕齐先生",
            "怕先生",
            "拍老先生",
            "拍小姑娘",
            "跑来先生",
            "陪先生",
            "陪在师父",
            "陪着师父",
            "陪着先生",
            "漂亮姑娘",
            "平时师父",
            "凭陈先生",
            "凭老先生",
            "其余城主",
            "其余师兄",
            "千金小姐",
            "前你先生",
            "前齐先生",
            "前师兄",
            "去与陛下",
            "确定师父",
            "绕着师父",
            "认了师父",
            "认了师兄",
            "认了先生",
            "如今陛下",
            "如今少爷",
            "如今师父",
            "如今先生",
            "若是姑娘",
            "若是少爷",
            "若是师父",
            "若是先生",
            "色的师父",
            "山怪",
            "山脚一处",
            "山脚这边",
            "山门这边",
            "山青",
            "山上",
            "山上好友",
            "山神",
            "山下",
            "山主",
            "上次城主",
            "上任城主",
            "尚未",
            "少城主",
            "身为城主",
            "身为师兄",
            "身为先生",
            "师父",
            "师父师父",
            "师父要我",
            "师兄",
            "师兄师姐",
            "师兄左右",
            "师尊",
            "世的先生",
            "授业先生",
            "授予城主",
            "书先生",
            "说陈先生",
            "说你师父",
            "说齐先生",
            "说少爷",
            "说师父",
            "说师兄",
            "说她师父",
            "说我师父",
            "说先生",
            "说小姑娘",
            "松脂",
            "算陈先生",
            "算当先生",
            "算道长",
            "算命先生",
            "算师父",
            "算账先生",
            "虽非师父",
            "同辈师姐",
            "同门师姐",
            "同门师兄",
            "同师父",
            "唯愿先生",
            "为陈先生",
            "为此师父",
            "为大师姐",
            "为宁姑娘",
            "为是师父",
            "为先生",
            "为小姑娘",
            "为郑先生",
            "未来城主",
            "未来师父",
            "温而",
            "温声",
            "文士",
            "闻声",
            "闻言",
            "闻言后",
            "乌江",
            "乌啼",
            "武将",
            "希望师兄",
            "希望先生",
            "惜大师姐",
            "惜大师兄",
            "惜孙道长",
            "惜先生",
            "惜小姑娘",
            "下任城主",
            "下小姑娘",
            "先前师父",
            "先前先生",
            "想起师父",
            "想起师兄",
            "想师父",
            "想说陛下",
            "谢过师父",
            "谢过先生",
            "心爱姑娘",
            "心爱师姐",
            "心的姑娘",
            "辛苦",
            "行的师父",
            "幸灾乐祸",
            "许多姑娘",
            "学生先生",
            "学师父",
            "学先生",
            "寻常师父",
            "询问先生",
            "严格",
            "颜悦色",
            "杨家药铺",
            "窑工师傅",
            "窑口师傅",
            "要被先生",
            "要给师父",
            "要给先生",
            "要跟师兄",
            "要跟小姐",
            "要喊师父",
            "要是师父",
            "要为先生",
            "要与师父",
            "要与先生",
            "一旦先生",
            "一对师兄",
            "一声师父",
            "一种先生",
            "一州将军",
            "因为师父",
            "因为师兄",
            "因为先生",
            "用师父",
            "用孙道长",
            "又是先生",
            "元凶",
            "怨先生",
            "愿陈先生",
            "越来越",
            "沾陈先生",
            "站在师父",
            "掌教师兄",
            "掌门师父",
            "掌门师兄",
            "掌眼师傅",
            "这位道长",
            "这位师父",
            "这位师姐",
            "这位师兄",
            "这位小姐",
            "真是师父",
            "正副城主",
            "正职城主",
            "只等少爷",
            "只等先生",
            "只看姑娘",
            "只有师父",
            "只有先生",
            "指小姑娘",
            "至少师兄",
            "至于师父",
            "至于先生",
            "自家城主",
            "自家姑娘",
            "自家少爷",
            "自家师父",
            "自家师兄",
            "自家先生",
            "自家小姐",
            "走到师父",
            "祖山",
            "做师父",
            "做师兄",
        ];

        for name in NON_PERSON_NAMES {
            assert!(
                is_non_character_candidate(name),
                "{name} should be filtered"
            );
        }
    }
}
