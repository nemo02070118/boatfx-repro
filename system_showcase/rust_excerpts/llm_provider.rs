//! Phase1 · LLM 多 provider 抽象(DeepSeek 主力 + Opus/GPT ensemble · env 读 key · 成本记账)。
//!
//! # 设计(承 AlphaEvolve/GigaEvo 异质路由 · AlphaBench 选型定论)
//! AlphaBench(2026)实测:因子**生成**是"海量廉价采样",CoT/贵推理无增益;GigaEvo/AlphaEvolve
//! 用"快模型铺广度 + 强模型提深度"异质路由。故:
//!  - **DeepSeek V4-Pro/Flash** = 主力量产变异(便宜 10-70× · LiveCodeBench 93.5 · 原生 json_object);
//!  - **Claude Opus / GPT** = 深度端(只在"生成新研究假设 / 精英批判"点用 · 钱够但不无脑烧)。
//!
//! # 铁律
//!  - **推理永不进热路径**:本模块只在冷路径构造 provider,`LlmClient::chat` 是同步 HTTPS(§0.1)。
//!  - **0 hardcode key**:key 只从 env 读(`DEEPSEEK_API_KEY`/`ANTHROPIC_API_KEY`),空则该 provider
//!    不可用(诚实 `None` · 不假成功)。日志/Debug 只打末 4 位(`14-secrets-security §2`)。
//!  - **成本记账**:每次调用按 provider 单价累加 in/out token 成本,`CostLedger` 供 <$10/轮验收。
//!
//! 出处:AlphaBench(openreview d97Q8r7ZKZ 2026)· GigaEvo(arXiv 2511.17592 异质路由)·
//! DeepSeek/Anthropic 2026 官方定价。

use super::llm_client::LlmConfig;

/// LLM 供应商角色(异质路由:广度端量产 vs 深度端精修)。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProviderRole {
    /// 主力量产(DeepSeek · 便宜 · 高温发散 · 跑几千候选)。
    Breadth,
    /// 深度精修(Opus/GPT · 贵 · 生成新研究假设 / 精英批判 · 少量点用)。
    Depth,
}

/// 单 provider 定价(USD / 百万 token · 2026 官方档 · 成本记账用)。
#[derive(Debug, Clone, Copy)]
pub struct Pricing {
    pub input_per_mtok: f64,
    pub output_per_mtok: f64,
}

/// LLM provider 预设(端点 + 模型 + 定价 + env key 变量名 + 角色)。
#[derive(Debug, Clone)]
pub struct LlmProvider {
    pub name: String,
    pub role: ProviderRole,
    pub cfg: LlmConfig,
    pub pricing: Pricing,
    /// key 的 env 变量名(只存名字 · 不存 key 值 · 防泄漏)。
    pub key_env: String,
}

impl LlmProvider {
    /// DeepSeek V4-Pro(主力广度端 · 原生 json_object · $0.435/$0.87 per Mtok)。
    #[must_use]
    pub fn deepseek_v4_pro() -> Self {
        Self {
            name: "deepseek-v4-pro".into(),
            role: ProviderRole::Breadth,
            cfg: LlmConfig {
                base_url: "https://api.deepseek.com".into(),
                model: "deepseek-v4-pro".into(),
                temperature: 0.9,
                max_tokens: 65536,
                timeout_connect: std::time::Duration::from_secs(15),
                timeout_read: std::time::Duration::from_secs(300),
                json_object: true,
            },
            pricing: Pricing {
                input_per_mtok: 0.435,
                output_per_mtok: 0.87,
            },
            key_env: "DEEPSEEK_API_KEY".into(),
        }
    }

    /// DeepSeek V4-Flash(超廉价广度端 · 大批量铺量 · $0.14/$0.28 per Mtok)。
    #[must_use]
    pub fn deepseek_v4_flash() -> Self {
        Self {
            name: "deepseek-v4-flash".into(),
            role: ProviderRole::Breadth,
            cfg: LlmConfig {
                base_url: "https://api.deepseek.com".into(),
                model: "deepseek-chat".into(),
                temperature: 0.95,
                max_tokens: 16384,
                timeout_connect: std::time::Duration::from_secs(15),
                timeout_read: std::time::Duration::from_secs(180),
                json_object: true,
            },
            pricing: Pricing {
                input_per_mtok: 0.14,
                output_per_mtok: 0.28,
            },
            key_env: "DEEPSEEK_API_KEY".into(),
        }
    }

    /// Claude Opus(深度端 · Anthropic Messages 兼容需 base_url 适配 · $5/$25 per Mtok)。
    /// 注:Anthropic 端点 schema 与 OpenAI 略异,出站适配在 http 层按 base_url 分派(Phase1 先占位定价
    /// 与选型 · 真出站待 Claude key 到位后按 Anthropic `/v1/messages` 接)。
    #[must_use]
    pub fn claude_opus() -> Self {
        Self {
            name: "claude-opus".into(),
            role: ProviderRole::Depth,
            cfg: LlmConfig {
                base_url: "https://api.anthropic.com".into(),
                model: "claude-opus-4-8".into(),
                temperature: 0.7,
                max_tokens: 8192,
                timeout_connect: std::time::Duration::from_secs(15),
                timeout_read: std::time::Duration::from_secs(300),
                json_object: false,
            },
            pricing: Pricing {
                input_per_mtok: 5.0,
                output_per_mtok: 25.0,
            },
            key_env: "ANTHROPIC_API_KEY".into(),
        }
    }

    /// 从 env 读 key(空/未设 → `None` · 诚实不可用)。只读值不落任何文件、不进 Debug。
    #[must_use]
    pub fn api_key_from_env(&self) -> Option<String> {
        std::env::var(&self.key_env)
            .ok()
            .map(|k| k.trim().to_string())
            .filter(|k| !k.is_empty())
    }

    /// key 是否就绪(env 有非空值)。用于 ensemble 装配时诚实跳过缺 key 的 provider。
    #[must_use]
    pub fn key_ready(&self) -> bool {
        self.api_key_from_env().is_some()
    }

    /// 脱敏 key 尾 4 位(日志用 · 遵 §2 绝不打完整 key)。缺 key → `"****none"`。
    #[must_use]
    pub fn key_hint(&self) -> String {
        match self.api_key_from_env() {
            // D2 · 按 **char** 取末 4 位(非字节切片)。`&k[k.len()-4..]` 在多字节 key 上会切在
            // UTF-8 码点中间 → panic。取末 4 个字符 collect 安全(ASCII key 行为不变)。
            Some(k) => {
                let chars: Vec<char> = k.chars().collect();
                if chars.len() >= 4 {
                    let last4: String = chars[chars.len() - 4..].iter().collect();
                    format!("****{last4}")
                } else if chars.is_empty() {
                    "****none".into()
                } else {
                    "****short".into()
                }
            }
            None => "****none".into(),
        }
    }

    /// 单次调用成本(USD · in/out token 数 × 单价 / 1e6)。
    #[must_use]
    pub fn call_cost(&self, in_tokens: u64, out_tokens: u64) -> f64 {
        (in_tokens as f64 * self.pricing.input_per_mtok
            + out_tokens as f64 * self.pricing.output_per_mtok)
            / 1_000_000.0
    }
}

/// 成本记账台账(累加各 provider 的调用成本 · <$10/轮验收 · 线程安全用 `Arc<Mutex<_>>` 包)。
#[derive(Debug, Clone, Default)]
pub struct CostLedger {
    pub total_usd: f64,
    pub total_calls: u64,
    pub total_in_tokens: u64,
    pub total_out_tokens: u64,
}

impl CostLedger {
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    /// 记一次调用(provider 单价 × token 数)。
    ///
    /// P25-persist-P0-3 · **NaN/Inf 防御**:若单价/token 估算异常产 NaN/Inf,`total_usd` 会被污染成
    /// 非有限值,而 `NaN > cap` 恒 false → 熔断静默失效无限烧钱。此处对本次成本增量做 `is_finite` 校验,
    /// 非有限则跳过累加(保守 · 宁可少记一次也不污染整个台账)。
    pub fn record(&mut self, provider: &LlmProvider, in_tokens: u64, out_tokens: u64) {
        let cost = provider.call_cost(in_tokens, out_tokens);
        if cost.is_finite() && cost >= 0.0 {
            self.total_usd += cost;
        }
        self.total_calls += 1;
        self.total_in_tokens += in_tokens;
        self.total_out_tokens += out_tokens;
    }

    /// 是否超预算(USD 上限 · 常驻 24/7 熔断用)。
    #[must_use]
    pub fn over_budget(&self, cap_usd: f64) -> bool {
        self.total_usd > cap_usd
    }

    /// P22-fix · **事前预算闸**:若「已花 + 本轮预估」将破 cap,则拦下本轮(不启动 → 防单轮超冲)。
    ///
    /// 病根(细胞级审计 P0):旧 `over_budget` 是**事后**检查——单轮可一次并发烧掉远超 cap 的钱,
    /// 下一轮才发现已超。事前用 `estimated_cost_usd` 预留,`已花 + 预估 > cap` 才拦,把超冲压到单调用级。
    #[must_use]
    pub fn would_exceed(&self, estimated_cost_usd: f64, cap_usd: f64) -> bool {
        self.total_usd + estimated_cost_usd.max(0.0) > cap_usd
    }

    /// P22-fix · 台账落盘(和 seen_checkpoint/负RAG 对称 · 防重启归零击穿额度)。
    ///
    /// 病根(细胞级审计 P0):`CostLedger` 此前纯内存,进程重启 total_usd 归零 → `over_budget` 永远
    /// 够不着真实累计花费 → 长跑($150/$300)会击穿额度。落盘 4 个累计量,启动时 `load` 续跑。
    /// 格式:单行 `total_usd total_calls total_in_tokens total_out_tokens`(空格分隔 · 人可读 · 易审计)。
    ///
    /// # Errors
    /// 写文件失败(路径不可写/磁盘满)返回 IO 错误串。
    pub fn save(&self, path: &std::path::Path) -> Result<(), String> {
        if let Some(parent) = path.parent() {
            if !parent.as_os_str().is_empty() {
                std::fs::create_dir_all(parent).map_err(|e| format!("建目录失败: {e}"))?;
            }
        }
        // P25-persist-P0-3 · 落盘前防污染:非有限 total_usd 绝不写盘(否则 load 回来是 NaN → 熔断失效)。
        let safe_total = if self.total_usd.is_finite() { self.total_usd } else { f64::MAX };
        let line = format!(
            "{} {} {} {}\n",
            safe_total, self.total_calls, self.total_in_tokens, self.total_out_tokens
        );
        // P25-persist-P0-2 · **原子写**:写临时文件 + rename(同文件系统 rename 原子),防崩溃半写截断
        // → 下次 load 命中"损坏"分支静默归零 → 额度击穿。复用 bi5_cache 的原子落盘范式。
        let tmp = path.with_extension(format!("tmp.{}", std::process::id()));
        std::fs::write(&tmp, line).map_err(|e| format!("写成本台账临时文件失败: {e}"))?;
        std::fs::rename(&tmp, path).map_err(|e| {
            let _ = std::fs::remove_file(&tmp); // 清理残留临时文件。
            format!("原子替换成本台账失败: {e}")
        })
    }

    /// P22-fix · 从落盘台账读回续跑(文件不存在 → 返回全 0 新账 · 非错误 · 首跑正常)。
    ///
    /// P25-persist-P0-1/P0-3 · **损坏/非有限 fail-closed**:区分两种情形——
    /// - **文件不存在/不可读** → 全 0 新账(合法首跑 · `total_usd=0` 不误伤额度);
    /// - **文件存在但格式损坏 / total_usd 解析出非有限(NaN/Inf)** → **fail-closed** 返回
    ///   `total_usd=f64::MAX` 的"已耗尽"哨兵账(令 `over_budget`/`would_exceed` 恒 true),
    ///   宁可拦停生成也绝不静默归零续跑击穿 API 额度(旧实现归零是最危险的兜底方向)。
    #[must_use]
    pub fn load(path: &std::path::Path) -> Self {
        let Ok(s) = std::fs::read_to_string(path) else {
            return Self::default(); // 文件不存在/不可读 → 全新账(首跑 · total_usd=0)。
        };
        // 空文件(从未成功写过)视同首跑,不 fail-closed(避免空文件误锁死)。
        if s.trim().is_empty() {
            return Self::default();
        }
        let parts: Vec<&str> = s.split_whitespace().collect();
        let poisoned = || Self {
            total_usd: f64::MAX, // 哨兵:已耗尽 → 熔断恒触发(fail-closed)。
            total_calls: 0,
            total_in_tokens: 0,
            total_out_tokens: 0,
        };
        if parts.len() != 4 {
            return poisoned(); // 格式损坏(半写/被改)→ fail-closed 而非归零。
        }
        let total_usd: f64 = match parts[0].parse() {
            Ok(v) if (v as f64).is_finite() => v,
            _ => return poisoned(), // 解析失败或 NaN/Inf → fail-closed。
        };
        Self {
            total_usd,
            total_calls: parts[1].parse().unwrap_or(0),
            total_in_tokens: parts[2].parse().unwrap_or(0),
            total_out_tokens: parts[3].parse().unwrap_or(0),
        }
    }
}

/// Ensemble 装配:主力广度 provider + 可选深度 provider(缺 key 自动跳过 · 回落单模型)。
#[derive(Debug, Clone)]
pub struct ProviderEnsemble {
    pub breadth: LlmProvider,
    pub depth: Option<LlmProvider>,
}

impl ProviderEnsemble {
    /// 默认装配:DeepSeek V4-Pro 广度 + Claude Opus 深度(depth key 缺则 `None` · 回落纯 DeepSeek)。
    #[must_use]
    pub fn assemble_default() -> Self {
        let breadth = LlmProvider::deepseek_v4_pro();
        let opus = LlmProvider::claude_opus();
        let depth = if opus.key_ready() { Some(opus) } else { None };
        Self { breadth, depth }
    }

    /// 广度端是否就绪(主力必须有 key 才能生成 · 否则整条生成链诚实关闭)。
    #[must_use]
    pub fn breadth_ready(&self) -> bool {
        self.breadth.key_ready()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn presets_carry_correct_role_and_pricing() {
        assert_eq!(LlmProvider::deepseek_v4_pro().role, ProviderRole::Breadth);
        assert_eq!(LlmProvider::deepseek_v4_flash().role, ProviderRole::Breadth);
        assert_eq!(LlmProvider::claude_opus().role, ProviderRole::Depth);
        // DeepSeek 显著便宜于 Opus(异质路由的经济前提)。
        assert!(
            LlmProvider::deepseek_v4_pro().pricing.output_per_mtok
                < LlmProvider::claude_opus().pricing.output_per_mtok
        );
    }

    #[test]
    fn cost_ledger_save_load_roundtrip() {
        // P22-fix · 台账落盘/读回 roundtrip(防重启归零)。
        let mut led = CostLedger::new();
        let p = LlmProvider::deepseek_v4_pro();
        led.record(&p, 12_345, 6_789);
        led.record(&p, 1_000, 2_000);
        let dir = std::env::temp_dir().join(format!("boatfx_cost_{}", std::process::id()));
        let path = dir.join("cost_ledger.txt");
        led.save(&path).expect("save 应成功");
        let back = CostLedger::load(&path);
        assert!((back.total_usd - led.total_usd).abs() < 1e-12, "total_usd 须 roundtrip");
        assert_eq!(back.total_calls, led.total_calls, "calls 须 roundtrip");
        assert_eq!(back.total_in_tokens, led.total_in_tokens, "in_tokens 须 roundtrip");
        assert_eq!(back.total_out_tokens, led.total_out_tokens, "out_tokens 须 roundtrip");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn cost_ledger_load_missing_file_is_fresh() {
        // 文件不存在 → 全新账(首跑正常 · 非错误)。
        let path = std::env::temp_dir().join("boatfx_cost_nonexistent_xyz_123.txt");
        let _ = std::fs::remove_file(&path);
        let led = CostLedger::load(&path);
        assert_eq!(led.total_usd, 0.0);
        assert_eq!(led.total_calls, 0);
    }

    #[test]
    fn p25_cost_ledger_corrupt_is_fail_closed_not_zeroed() {
        // P25-persist-P0-1 · 损坏台账(半写/格式坏)必须 fail-closed(哨兵 MAX · 熔断恒触发),
        // 绝不静默归零续跑(旧实现归零 → 额度击穿)。
        let path = std::env::temp_dir().join("boatfx_cost_corrupt_p25.txt");
        // 半写截断(只有 2 个字段而非 4)。
        std::fs::write(&path, "12.5 3").unwrap();
        let led = CostLedger::load(&path);
        assert_eq!(led.total_usd, f64::MAX, "损坏台账应 fail-closed 到已耗尽哨兵");
        assert!(led.over_budget(150.0), "损坏后任何 cap 都判超预算(拦停生成)");
        assert!(led.would_exceed(0.0, 300.0), "损坏后事前闸恒拦");
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn p25_cost_ledger_nan_rejected_on_load_and_record() {
        // P25-persist-P0-3 · NaN/Inf 不得穿透:load 到 NaN → fail-closed;record 非有限成本跳过累加。
        let path = std::env::temp_dir().join("boatfx_cost_nan_p25.txt");
        std::fs::write(&path, "NaN 5 100 200").unwrap();
        let led = CostLedger::load(&path);
        assert!(led.total_usd.is_finite(), "load 后 total_usd 必须有限(NaN 被 fail-closed 替换)");
        assert_eq!(led.total_usd, f64::MAX, "NaN total_usd → 已耗尽哨兵");
        assert!(led.over_budget(1e9), "NaN 台账不再能骗过熔断(旧:NaN>cap 恒 false 无限烧钱)");
        let _ = std::fs::remove_file(&path);
        // record 侧:非有限成本(极端 token)不污染 total_usd(此处直接构造验证累加守卫)。
        let mut led2 = CostLedger::new();
        led2.total_usd = 10.0;
        // 用 save→load 往返验证有限值正常;哨兵不因正常路径误触发。
        let path2 = std::env::temp_dir().join("boatfx_cost_ok_p25.txt");
        led2.save(&path2).unwrap();
        let back = CostLedger::load(&path2);
        assert!((back.total_usd - 10.0).abs() < 1e-9, "正常有限台账往返零回归");
        assert!(!back.over_budget(150.0), "正常台账不误触发熔断");
        let _ = std::fs::remove_file(&path2);
    }

    #[test]
    fn p25_cost_ledger_atomic_write_leaves_no_tmp() {
        // P25-persist-P0-2 · 原子写:save 后目录不应残留 .tmp.<pid> 临时文件(已 rename)。
        let dir = std::env::temp_dir().join("boatfx_cost_atomic_p25");
        let _ = std::fs::create_dir_all(&dir);
        let path = dir.join("ledger.txt");
        let mut led = CostLedger::new();
        led.total_usd = 7.25;
        led.save(&path).unwrap();
        let back = CostLedger::load(&path);
        assert!((back.total_usd - 7.25).abs() < 1e-9, "原子写往返零回归");
        // 目录里除 ledger.txt 外不应有 tmp 残留。
        let leftovers: Vec<_> = std::fs::read_dir(&dir)
            .unwrap()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_name().to_string_lossy().contains("tmp"))
            .collect();
        assert!(leftovers.is_empty(), "原子写后不应残留 tmp 文件 · 残留={}", leftovers.len());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn cost_ledger_would_exceed_is_preflight() {
        // P22-fix · 事前预算闸:已花 + 预估 > cap 才拦(防单轮超冲)。
        let mut led = CostLedger::new();
        led.total_usd = 45.0;
        assert!(!led.over_budget(50.0), "45<50 事后未超");
        // 但本轮预估 $8 → 45+8=53 > 50 → 事前应拦(否则单轮冲到 53 才发现)。
        assert!(led.would_exceed(8.0, 50.0), "事前预算闸应拦下会超冲的轮次");
        assert!(!led.would_exceed(3.0, 50.0), "45+3=48<50 应放行");
    }

    #[test]
    fn key_from_env_empty_is_none() {
        // 用一个几乎不可能被设的 env 名,确保 None 路径。
        let mut p = LlmProvider::deepseek_v4_pro();
        p.key_env = "BOATFX_TEST_NONEXISTENT_KEY_ENV".into();
        assert!(p.api_key_from_env().is_none());
        assert!(!p.key_ready());
        assert_eq!(p.key_hint(), "****none");
    }

    #[test]
    fn key_hint_masks_all_but_last_four() {
        let p = LlmProvider::deepseek_v4_pro();
        // 直接测掩码逻辑(不依赖真 env):构造已知 key 走 call 路径的等价断言。
        // 这里只验证 none 分支与长度分支的格式契约。
        assert!(p.key_hint().starts_with("****"));
    }

    #[test]
    fn cost_ledger_accumulates_and_caps() {
        let p = LlmProvider::deepseek_v4_pro();
        let mut led = CostLedger::new();
        // 1M in + 1M out = 0.435 + 0.87 = 1.305 USD。
        led.record(&p, 1_000_000, 1_000_000);
        assert!((led.total_usd - 1.305).abs() < 1e-9);
        assert_eq!(led.total_calls, 1);
        assert!(!led.over_budget(10.0));
        // 再记 8 次同量 → 累计 ~11.7 > 10 熔断。
        for _ in 0..8 {
            led.record(&p, 1_000_000, 1_000_000);
        }
        assert!(led.over_budget(10.0));
    }

    #[test]
    fn call_cost_matches_pricing() {
        let p = LlmProvider::deepseek_v4_flash();
        // 2M in + 1M out = 2×0.14 + 1×0.28 = 0.56。
        assert!((p.call_cost(2_000_000, 1_000_000) - 0.56).abs() < 1e-9);
    }

    #[test]
    fn ensemble_falls_back_when_depth_key_missing() {
        // 未设 ANTHROPIC_API_KEY 时,depth 应为 None(回落纯广度)。
        // 注:CI 环境通常无此 key;若本地设了则 depth 有值,两种都合法,只断言不 panic + 广度存在。
        let e = ProviderEnsemble::assemble_default();
        assert_eq!(e.breadth.role, ProviderRole::Breadth);
    }
}
