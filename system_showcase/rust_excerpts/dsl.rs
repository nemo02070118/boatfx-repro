//! 因子 DSL — 白名单算子集合。
//!
//! Hubble §3.1: 定义安全的因子表达式语言。
//! 所有因子必须用此 DSL 表达，防止任意代码执行。
//!
//! 支持的算子:
//! - 输入信号: MidPrice, BestBid, BestAsk, BidSize, AskSize, Volume, TradePrice, TradeSize
//! - 一元运算: Abs, Neg, Log, Sqrt, Sign, Rank
//! - 二元运算: Add, Sub, Mul, Div, Max, Min, Pow
//! - 滚动窗口: Mean, Std, Skew, Kurt, Min, Max, Sum, Zscore, Rank, Corr, Slope
//! - 条件: IfThenElse
//! - 常量: Const(f64)

/// 输入信号枚举（白名单）。
///
/// 前 9 项为价量盘口(所有宇宙通用);后续为**机制数据类型**(R13 §6 · 消"塞进 BidSize"),
/// 让 DSL 原生表达宏观/资金费率/基本面/期限结构,工厂据此理解机制语义而非盲组合价量。
/// 机制字段在无对应数据的宇宙取 NaN(interpreter 透传 NaN · 因子在该宇宙自然不激活)。
#[derive(Debug, Clone, PartialEq)]
pub enum InputSignal {
    MidPrice,
    BestBid,
    BestAsk,
    BidSize,
    AskSize,
    Volume,
    TradePrice,
    TradeSize,
    TradeSide,
    // ── 机制数据类型(R13 §4/§8:补真机制主料 · 各宇宙 loader 注入)──
    /// 宏观利率/收益率水平(FredMacro · 如短端利率、曲线 level)。
    MacroRate,
    /// 宏观 surprise(实际 − 预期 · 事件驱动)。
    MacroSurprise,
    /// 永续资金费率(Crypto · funding carry)。
    FundingRate,
    /// 未平仓合约名义(Crypto · OI 结构)。
    OpenInterest,
    /// 永续-现货基差(Crypto · basis carry)。
    PerpBasis,
    /// 期限结构 roll yield(Commodity · 近月-远月)。
    RollYield,
    /// 基本面价值分数(EquityR3k · 价值-质量-盈利合成 · PIT)。
    Fundamental,
    /// 持仓数据(COT 净持仓 · FredMacro/Fx)。
    Positioning,
}

/// G1 · 输入信号类型标签(STGP 强类型 GP · 治"变异不换叶子"根因)。
///
/// 变异算子按类型做叶子替换:同类型替换保语义(如 MidPrice↔TradePrice),跨类型替换拓搜索空间
/// (如 Price→Macro · 让价量父树后代能引入非价量叶子,破 ρ̄→1 共线)。类型也供 D1 异质数据轴
/// (VolTerm/Sentiment/Event)接入时挂载新叶子而不改算子逻辑。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SignalType {
    /// 价格类(MidPrice/BestBid/BestAsk/TradePrice)。
    Price,
    /// 量/流动性类(Volume/BidSize/AskSize/TradeSize/TradeSide)。
    Volume,
    /// 宏观类(MacroRate/MacroSurprise)。
    Macro,
    /// carry/期限结构类(FundingRate/OpenInterest/PerpBasis/RollYield)。
    Carry,
    /// 基本面类(Fundamental)。
    Fundamental,
    /// 持仓/头寸类(Positioning)。
    Positioning,
}

impl InputSignal {
    /// 该输入信号的类型标签(G1 类型化叶子)。
    #[must_use]
    pub fn signal_type(&self) -> SignalType {
        match self {
            InputSignal::MidPrice
            | InputSignal::BestBid
            | InputSignal::BestAsk
            | InputSignal::TradePrice => SignalType::Price,
            InputSignal::BidSize
            | InputSignal::AskSize
            | InputSignal::Volume
            | InputSignal::TradeSize
            | InputSignal::TradeSide => SignalType::Volume,
            InputSignal::MacroRate | InputSignal::MacroSurprise => SignalType::Macro,
            InputSignal::FundingRate
            | InputSignal::OpenInterest
            | InputSignal::PerpBasis
            | InputSignal::RollYield => SignalType::Carry,
            InputSignal::Fundamental => SignalType::Fundamental,
            InputSignal::Positioning => SignalType::Positioning,
        }
    }

    /// 全部输入信号(叶子替换变异的取材全集 · 与枚举定义同序 · 确定性)。
    #[must_use]
    pub fn all() -> &'static [InputSignal] {
        &[
            InputSignal::MidPrice,
            InputSignal::BestBid,
            InputSignal::BestAsk,
            InputSignal::BidSize,
            InputSignal::AskSize,
            InputSignal::Volume,
            InputSignal::TradePrice,
            InputSignal::TradeSize,
            InputSignal::TradeSide,
            InputSignal::MacroRate,
            InputSignal::MacroSurprise,
            InputSignal::FundingRate,
            InputSignal::OpenInterest,
            InputSignal::PerpBasis,
            InputSignal::RollYield,
            InputSignal::Fundamental,
            InputSignal::Positioning,
        ]
    }

    /// 与 `self` 同类型的其他信号(同类型替换保语义 · 不含自身)。
    #[must_use]
    pub fn same_type_peers(&self) -> Vec<InputSignal> {
        let ty = self.signal_type();
        InputSignal::all()
            .iter()
            .filter(|s| s.signal_type() == ty && *s != self)
            .cloned()
            .collect()
    }
}

/// 一元运算符。
#[derive(Debug, Clone, PartialEq)]
pub enum UnaryOp {
    Abs,
    Neg,
    Log,
    Sqrt,
    Sign,
    Rank,
    Diff,
}

/// 二元运算符。
#[derive(Debug, Clone, PartialEq)]
pub enum BinaryOp {
    Add,
    Sub,
    Mul,
    Div,
    Max,
    Min,
    Pow,
    Gt,
    Lt,
}

/// 波 V5 · 横截面算子(某网格点上**全宇宙品种间**的变换 · 多空 alpha 核心 · Alpha101 收口)。
///
/// 与时序算子(Rolling/Unary)正交:时序算子在单品种时间轴上算,横截面算子在**同一 tick 的
/// 品种截面**上算。SOTA(Alpha101 大量 `rank(cross-sectional)`)因子最外层多为横截面收口
/// (rank/neutralize/scale)→ 产 dollar-neutral 多空腿。求值走面板级(见 `health::cross_eval`)。
#[derive(Debug, Clone, PartialEq)]
pub enum CrossOp {
    /// 截面秩归一化到 [-0.5, 0.5](与 rank-spread 权重同源 · 多空方向)。
    Rank,
    /// 截面去均值(dollar-neutral · Σ=0)。
    Demean,
    /// 截面标准化(z-score · 去均值除截面标准差 · 单位方差)。
    Scale,
}

/// 波 V6 · 跨资产算子(某品种 inner 序列相对**全宇宙市场因子**的时序回归 · beta/残差)。
///
/// 市场因子 = 各网格点的横截面均值序列(等权 market)。`Beta` = 品种 inner 对 market 的滚动/全窗
/// beta;`Residual` = `inner − beta·market`(市场中性化 · 剥系统性暴露留特质 alpha · Fama-MacBeth 思想)。
/// 与横截面算子(纯截面 · 无时间)不同,跨资产算子需**时间×截面**联合(时序回归),故走全面板求值。
#[derive(Debug, Clone, PartialEq)]
pub enum CrossAssetOp {
    /// 品种 inner 对等权市场因子的 beta(系统性暴露强度)。
    Beta,
    /// 市场中性化残差 `inner − beta·market`(剥系统性 · 留特质)。
    Residual,
    /// P30-S99 · **对"最相关同伴"的价差 z-score**(配对交易 / 协整的最小可表达形式)。
    ///
    /// # 补的能力缺口
    ///
    /// `Beta`/`Residual` 的对手方**固定为等权市场因子** —— 那是"对市场中性化",
    /// 不是"配对"。真正的配对交易需要:
    /// 1. 为每个品种找**它自己的**最相关同伴(不是全市场平均);
    /// 2. 算两者的价差;
    /// 3. 看价差偏离自身均值多少个标准差(均值回归信号)。
    ///
    /// 这三步在旧 DSL 里**一步都表达不了**,故配对/协整整类策略不可达。
    ///
    /// # 语义
    ///
    /// ```text
    /// partner(i) = argmax_{j≠i} |corr(inner_i, inner_j)|   // 在 lookback 窗内选
    /// spread_i[t] = inner_i[t] − β_ij · inner_j[t]          // β 由窗内 OLS 定
    /// out_i[t]    = (spread_i[t] − mean(spread_i)) / sd(spread_i)
    /// ```
    ///
    /// 携带的 `usize` 是**同伴选择与 β 估计的回看窗**。
    ///
    /// # 零未来
    ///
    /// 同伴与 β 都只用 `[t−w, t)` 的观测(右闭独占),z-score 的均值/标准差同窗。
    /// 这样第 `t` 期的输出不含任何 `≥ t` 的信息。
    PairSpreadZ(usize),
    /// P30-S99 · **对最相关同伴的滚动相关系数本身**(相关性崩塌检测)。
    ///
    /// 配对策略最大的风险是"相关性崩了"(协整关系断裂)。这个算子把**相关性水平**
    /// 本身变成可交易信号:相关高 → 配对可信;相关骤降 → 该退出。
    ///
    /// 旧 DSL 无法表达任何"两个品种之间"的量,故这类风险信号完全不可达。
    PairCorr(usize),
}

/// 滚动窗口运算符。
#[derive(Debug, Clone, PartialEq)]
pub enum RollingOp {
    Mean,
    Std,
    Skew,
    Kurt,
    Min,
    Max,
    Sum,
    Zscore,
    Rank,
    Slope,
    /// 窗口内 lag-1 自相关(Cont 2001 stylized facts)。
    Corr,
    /// 分位数(Hyndman-Fan 1996 type-7 线性插值),携带 q ∈ [0,1]。
    Quantile(f64),
    /// 波 V6 · 可调 lag(取 k 期前的值 `x[t-k]` · 时序对齐/前视信号构造 · 零未来 k≥1)。
    Delay(usize),
    /// Phase2 · 指数移动平均(**有状态递推** · α=2/(w+1) · `s_t=α·x_t+(1−α)·s_{t-1}`)。
    /// 破 DSL"无状态窗口重算"天花板:EMA 是带记忆的时序递推(RiskMetrics 1996 · Roncalli)。
    /// 窗口 w 映射平滑系数;窗内自底向上递推(右闭 · 零未来)。
    Ema,
    /// Phase2 · 自适应 z-score(**状态依赖阈值** · 用 EMA 均值/EMA 方差做在线归一,而非等权窗)。
    /// `z_t=(x_t−ema_t)/sqrt(ema_var_t)`,阈值随波动状态自适应收放(Chan 2013 自适应 bands)。
    AdaptiveZscore,
}

/// 因子表达式 AST。
#[derive(Debug, Clone, PartialEq)]
pub enum FactorExpr {
    /// 输入信号。
    Input(InputSignal),
    /// 常量。
    Const(f64),
    /// 一元运算。
    Unary(UnaryOp, Box<FactorExpr>),
    /// 二元运算。
    Binary(BinaryOp, Box<FactorExpr>, Box<FactorExpr>),
    /// 滚动窗口运算 (op, inner_expr, window_size)。
    Rolling(RollingOp, Box<FactorExpr>, usize),
    /// 条件表达式 (condition, then, else)。
    IfThenElse(Box<FactorExpr>, Box<FactorExpr>, Box<FactorExpr>),
    /// R14X P6 · 具名高阶原语:调 `factor_ctor_registry` 里的 300 个真因子(Hurst/熵/前景理论…)
    /// 当叶子原语,让工厂 DSL 能进化"Zscore(Hurst(mid,64))""EntropyOf×Funding"类跨范式组合。
    /// `String`=构造器表因子名(如 `"sample_entropy"`);求值时经桥实例化真 FactorNode 在 tick 上跑。
    /// 语义上是**叶子**(不含子 AST · 深度/节点数=1 · 无量纲 · 无除零),但求值走真因子(非纯 DSL)。
    NamedFactor(String),
    /// 波 V5 · 横截面变换 (op, inner):对 inner 在每个网格点的**全宇宙品种截面**做 rank/demean/scale。
    /// 单品种解释器无法算截面 → 逐 tick 透传 inner(退化);真横截面求值在面板级
    /// [`crate::health::cross_eval`] 逐行施加(多空 alpha 收口)。
    CrossSectional(CrossOp, Box<FactorExpr>),
    /// 波 V6 · 跨资产变换 (op, inner):品种 inner 相对等权市场因子的 beta/残差(市场中性化)。
    /// 单品种解释器无市场因子 → 透传 inner(退化);真跨资产求值在面板级
    /// [`crate::health::cross_eval`](时序回归 · 时间×截面联合)。
    CrossAsset(CrossAssetOp, Box<FactorExpr>),
}

/// 计算 AST 深度。
pub fn ast_depth(expr: &FactorExpr) -> usize {
    match expr {
        FactorExpr::Input(_) | FactorExpr::Const(_) | FactorExpr::NamedFactor(_) => 1,
        FactorExpr::Unary(_, inner) => 1 + ast_depth(inner),
        FactorExpr::Binary(_, left, right) => 1 + ast_depth(left).max(ast_depth(right)),
        FactorExpr::Rolling(_, inner, _) => 1 + ast_depth(inner),
        FactorExpr::CrossSectional(_, inner) | FactorExpr::CrossAsset(_, inner) => {
            1 + ast_depth(inner)
        }
        FactorExpr::IfThenElse(cond, then, else_) => {
            1 + ast_depth(cond).max(ast_depth(then)).max(ast_depth(else_))
        }
    }
}

/// 计算 AST 节点数。
pub fn ast_node_count(expr: &FactorExpr) -> usize {
    match expr {
        FactorExpr::Input(_) | FactorExpr::Const(_) | FactorExpr::NamedFactor(_) => 1,
        FactorExpr::Unary(_, inner) => 1 + ast_node_count(inner),
        FactorExpr::Binary(_, left, right) => 1 + ast_node_count(left) + ast_node_count(right),
        FactorExpr::Rolling(_, inner, _) => 1 + ast_node_count(inner),
        FactorExpr::CrossSectional(_, inner) | FactorExpr::CrossAsset(_, inner) => {
            1 + ast_node_count(inner)
        }
        FactorExpr::IfThenElse(cond, then, else_) => {
            1 + ast_node_count(cond) + ast_node_count(then) + ast_node_count(else_)
        }
    }
}

/// 计算 AST 中最大滚动窗口大小。
pub fn max_window(expr: &FactorExpr) -> usize {
    match expr {
        FactorExpr::Input(_) | FactorExpr::Const(_) | FactorExpr::NamedFactor(_) => 0,
        FactorExpr::Unary(_, inner) => max_window(inner),
        FactorExpr::Binary(_, left, right) => max_window(left).max(max_window(right)),
        FactorExpr::Rolling(_, inner, window) => (*window).max(max_window(inner)),
        FactorExpr::CrossSectional(_, inner) | FactorExpr::CrossAsset(_, inner) => {
            max_window(inner)
        }
        FactorExpr::IfThenElse(cond, then, else_) => max_window(cond)
            .max(max_window(then))
            .max(max_window(else_)),
    }
}

/// P30-S78 · 收集 AST 用到的**全部输入信号**(去重 · 供通道活性静态闸)。
///
/// # 为什么需要它
///
/// 实测:8465 个 LLM 生成因子里 **3294 个(38.9%)零交易** —— 零毛收益、零 IC、零换手。
/// 根因是 16 个输入通道里 **8 个在日频面板上恒 NaN**
/// (`BidSize`/`AskSize`/`TradePrice`/`TradeSize`/`TradeSide`/`OpenInterest`/
/// `RollYield`/`Fundamental`/`Positioning` 视宇宙而定)。
///
/// 死亡率指纹(名字前缀 → 死亡率):`order` 99% / `vpin` 100% / `kyle` 95% /
/// `roll` 100% / `signed` 100% / `open` 100%。族层:`market microstructure` 死 **84%**。
///
/// prompt 里虽已声明死信号(`factor_schema.rs:499-510`),但**准入端零代码强制** ——
/// `admit_batch_with_desc` 只有三道门(canonical 签名 / novelty / 语义 embedding),
/// 没有任何通道活性检查。本函数是补这道闸的基础件。
#[must_use]
pub fn collect_input_signals(expr: &FactorExpr) -> Vec<InputSignal> {
    let mut out = Vec::new();
    walk_inputs(expr, &mut out);
    out.sort_by_key(|s| format!("{s:?}"));
    out.dedup();
    out
}

fn walk_inputs(expr: &FactorExpr, out: &mut Vec<InputSignal>) {
    match expr {
        FactorExpr::Input(s) => out.push(s.clone()),
        FactorExpr::Const(_) | FactorExpr::NamedFactor(_) => {}
        FactorExpr::Unary(_, inner)
        | FactorExpr::Rolling(_, inner, _)
        | FactorExpr::CrossSectional(_, inner)
        | FactorExpr::CrossAsset(_, inner) => walk_inputs(inner, out),
        FactorExpr::Binary(_, left, right) => {
            walk_inputs(left, out);
            walk_inputs(right, out);
        }
        FactorExpr::IfThenElse(cond, then, else_) => {
            walk_inputs(cond, out);
            walk_inputs(then, out);
            walk_inputs(else_, out);
        }
    }
}

/// P30-S78 · 该 AST 是否**只用活通道**(给定活通道白名单)。
///
/// `live` 为空 → 恒 `true`(未提供活性信息时不拦 · 零回归)。
/// 否则:AST 里任一输入不在白名单 → `false`(该因子必然零交易,不该占生成/评估预算)。
///
/// 注:`NamedFactor` 叶子不受此闸约束 —— 它桥到真算法因子,输入依赖在其内部。
#[must_use]
pub fn uses_only_live_signals(expr: &FactorExpr, live: &[InputSignal]) -> bool {
    if live.is_empty() {
        return true;
    }
    collect_input_signals(expr)
        .iter()
        .all(|s| live.contains(s))
}

/// 统计 AST 自由参数个数(PC · parameter count)。
///
/// S5.1 复杂度正则核心(研究笔记 19 §4.3 · QuantaAlpha 消融):自由参数越少,
/// 记忆再多也越难过拟合。
///
/// # P30-S4 · 改为 **distinct 计数**(治误拒 1188 个合规因子)
///
/// ## 病根
///
/// 旧实现按**出现次数**累加:`Rolling` 每层都 `1 + extra`、每个 `Const`/`NamedFactor` 各 +1。
/// 于是 `Zscore(mid, 20) − Zscore(vol, 20)` 被算成 **2** 个自由参数。
///
/// 但**自由参数的定义是"可独立调节的旋钮数"**。上式里"20"只被选择了一次,
/// 两处引用的是**同一个**旋钮 —— 过拟合风险与只用一次完全相同。按出现次数计
/// 等于把"复用"误判成"新增自由度",系统性惩罚了结构对称的因子。
///
/// ## 实测影响
///
/// 8493 个真实因子在 `max_free_params = 6`(`sandbox.rs:37`)下:
///
/// | 口径 | 超限因子数 |
/// |---|---|
/// | 按出现次数(旧) | **1406 (16.6%)** |
/// | 按 distinct(新) | **218 (2.6%)** |
///
/// → **释放 1188 个(14%)本就合规的因子**,零成本扩大候选池。
///
/// ## 什么算"同一个旋钮"
///
/// - 相同窗长 `w` → 同一旋钮(不论出现几次、在哪个 `RollingOp` 下)
/// - 相同 `Quantile(q)` 的 `q` → 同一旋钮
/// - 相同 `Delay(k)` 的 `k` → 同一旋钮
/// - 相同 `Const` 数值(按 `to_bits` 判等)→ 同一旋钮
/// - 相同 `NamedFactor` 名字 → 同一旋钮
///
/// **跨类别不合并**:窗长 20 与常数 20.0 是两个独立旋钮(前者是整数窗、后者是实数系数,
/// 调节空间与语义都不同)。故各类别用独立集合计数。
#[must_use]
pub fn free_param_count(expr: &FactorExpr) -> usize {
    let mut knobs = FreeParamKnobs::default();
    collect_free_params(expr, &mut knobs);
    knobs.total()
}

/// P30-S4 · 自由参数的**去重收集器**(按类别分开 · 见 [`free_param_count`] 文档)。
#[derive(Debug, Default)]
struct FreeParamKnobs {
    /// 滚动窗长(所有 `RollingOp` 共享同一空间 —— 窗长 20 就是窗长 20)。
    windows: std::collections::BTreeSet<usize>,
    /// `Quantile(q)` 的分位点(按 `to_bits` 判等)。
    quantiles: std::collections::BTreeSet<u64>,
    /// `Delay(k)` 的滞后步数。
    delays: std::collections::BTreeSet<usize>,
    /// `Const` 数值(按 `to_bits` 判等)。
    consts: std::collections::BTreeSet<u64>,
    /// `NamedFactor` 名字。
    named: std::collections::BTreeSet<String>,
}

impl FreeParamKnobs {
    fn total(&self) -> usize {
        self.windows.len()
            + self.quantiles.len()
            + self.delays.len()
            + self.consts.len()
            + self.named.len()
    }
}

/// P30-S4 · 递归收集去重后的自由参数旋钮。
fn collect_free_params(expr: &FactorExpr, out: &mut FreeParamKnobs) {
    match expr {
        FactorExpr::Input(_) => {}
        FactorExpr::Const(v) => {
            out.consts.insert(v.to_bits());
        }
        FactorExpr::NamedFactor(name) => {
            out.named.insert(name.clone());
        }
        FactorExpr::Unary(_, inner) => collect_free_params(inner, out),
        FactorExpr::Binary(_, left, right) => {
            collect_free_params(left, out);
            collect_free_params(right, out);
        }
        FactorExpr::Rolling(op, inner, w) => {
            out.windows.insert(*w);
            match op {
                RollingOp::Quantile(q) => {
                    out.quantiles.insert(q.to_bits());
                }
                RollingOp::Delay(k) => {
                    out.delays.insert(*k);
                }
                _ => {}
            }
            collect_free_params(inner, out);
        }
        // 横截面/跨资产算子无自由参数(结构算子 · 只选变换类型)。
        FactorExpr::CrossSectional(_, inner) | FactorExpr::CrossAsset(_, inner) => {
            collect_free_params(inner, out);
        }
        FactorExpr::IfThenElse(cond, then_, else_) => {
            collect_free_params(cond, out);
            collect_free_params(then_, out);
            collect_free_params(else_, out);
        }
    }
}

/// 将 DSL 表达式转为人类可读字符串。
pub fn expr_to_string(expr: &FactorExpr) -> String {
    match expr {
        FactorExpr::Input(sig) => format!("{sig:?}"),
        FactorExpr::Const(v) => format!("{v}"),
        FactorExpr::NamedFactor(name) => format!("Named({name})"),
        FactorExpr::Unary(op, inner) => format!("{op:?}({})", expr_to_string(inner)),
        FactorExpr::Binary(op, left, right) => {
            format!(
                "({} {op:?} {})",
                expr_to_string(left),
                expr_to_string(right)
            )
        }
        FactorExpr::Rolling(op, inner, window) => {
            format!("{op:?}({}, {window})", expr_to_string(inner))
        }
        FactorExpr::CrossSectional(op, inner) => {
            format!("CS_{op:?}({})", expr_to_string(inner))
        }
        FactorExpr::CrossAsset(op, inner) => {
            format!("XA_{op:?}({})", expr_to_string(inner))
        }
        FactorExpr::IfThenElse(cond, then, else_) => {
            format!(
                "if {} then {} else {}",
                expr_to_string(cond),
                expr_to_string(then),
                expr_to_string(else_)
            )
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// P30-S4 · **去重铁证**:复用同一窗长只算 1 个自由参数。
    ///
    /// 病根:旧实现按**出现次数**累加,`Zscore(a,20) − Zscore(b,20)` 被算成 2。
    /// 但"20"只被选择了一次,两处引用同一个旋钮 —— 过拟合风险与用一次相同。
    /// 实测按出现次数超限 1406 个(16.6%),按 distinct 只 218 个(2.6%)→ 释放 1188 个。
    #[test]
    fn p30_s4_free_params_dedupe_shared_windows() {
        let mk = |sig: InputSignal, w: usize| {
            FactorExpr::Rolling(RollingOp::Zscore, Box::new(FactorExpr::Input(sig)), w)
        };

        // ① 同窗复用 → 1 个自由参数(旧实现给 2)。
        let same_w = FactorExpr::Binary(
            BinaryOp::Sub,
            Box::new(mk(InputSignal::MidPrice, 20)),
            Box::new(mk(InputSignal::Volume, 20)),
        );
        assert_eq!(
            free_param_count(&same_w),
            1,
            "复用窗长 20 只该算 1 个旋钮(旧实现按出现次数给 2)"
        );

        // ② 不同窗 → 2 个(真的有两个独立旋钮)。
        let diff_w = FactorExpr::Binary(
            BinaryOp::Sub,
            Box::new(mk(InputSignal::MidPrice, 20)),
            Box::new(mk(InputSignal::Volume, 60)),
        );
        assert_eq!(free_param_count(&diff_w), 2, "两个不同窗长是两个独立旋钮");

        // ③ 三层嵌套同窗 → 仍是 1。
        let nested = FactorExpr::Rolling(
            RollingOp::Mean,
            Box::new(FactorExpr::Rolling(
                RollingOp::Std,
                Box::new(mk(InputSignal::MidPrice, 20)),
                20,
            )),
            20,
        );
        assert_eq!(free_param_count(&nested), 1, "三层嵌套同窗仍只 1 个旋钮");

        // ④ 反向判别力:确保测试构造真的能区分两种口径。
        //    旧口径下 ① 会是 2、③ 会是 3;新口径都是 1。
        assert!(
            free_param_count(&same_w) < 2 && free_param_count(&nested) < 3,
            "本测必须能区分 distinct 与出现次数两种口径"
        );
    }

    /// P30-S4 · 跨类别**不合并**:窗长 20 与常数 20.0 是两个独立旋钮。
    ///
    /// 前者是整数窗(调节空间 1..=512)、后者是实数系数(连续),语义与调节空间都不同,
    /// 合并会低估复杂度。
    #[test]
    fn p30_s4_free_params_do_not_merge_across_categories() {
        let expr = FactorExpr::Binary(
            BinaryOp::Mul,
            Box::new(FactorExpr::Rolling(
                RollingOp::Mean,
                Box::new(FactorExpr::Input(InputSignal::MidPrice)),
                20,
            )),
            Box::new(FactorExpr::Const(20.0)),
        );
        assert_eq!(
            free_param_count(&expr),
            2,
            "窗长 20 与常数 20.0 必须各算 1 个(跨类别不合并)"
        );

        // Quantile 的 q 与 Delay 的 k 各占独立类别。
        let q_expr = FactorExpr::Rolling(
            RollingOp::Quantile(0.9),
            Box::new(FactorExpr::Input(InputSignal::MidPrice)),
            30,
        );
        assert_eq!(free_param_count(&q_expr), 2, "窗长 30 + 分位 0.9 = 2 个旋钮");

        // 同 q 复用 → q 只算一次。
        let q_twice = FactorExpr::Binary(
            BinaryOp::Sub,
            Box::new(FactorExpr::Rolling(
                RollingOp::Quantile(0.9),
                Box::new(FactorExpr::Input(InputSignal::MidPrice)),
                30,
            )),
            Box::new(FactorExpr::Rolling(
                RollingOp::Quantile(0.9),
                Box::new(FactorExpr::Input(InputSignal::Volume)),
                30,
            )),
        );
        assert_eq!(
            free_param_count(&q_twice),
            2,
            "同窗同分位复用仍是 2 个旋钮(窗 30 + q 0.9)"
        );
    }

    /// P30-S4 · `NamedFactor` 与 `Const` 的去重语义。
    #[test]
    fn p30_s4_free_params_dedupe_named_and_consts() {
        // 同名 NamedFactor 复用 → 1。
        let same_named = FactorExpr::Binary(
            BinaryOp::Add,
            Box::new(FactorExpr::NamedFactor("hurst_exponent".into())),
            Box::new(FactorExpr::NamedFactor("hurst_exponent".into())),
        );
        assert_eq!(free_param_count(&same_named), 1, "同名具名原语算 1 个");

        // 不同名 → 2。
        let diff_named = FactorExpr::Binary(
            BinaryOp::Add,
            Box::new(FactorExpr::NamedFactor("hurst_exponent".into())),
            Box::new(FactorExpr::NamedFactor("sample_entropy".into())),
        );
        assert_eq!(free_param_count(&diff_named), 2, "不同名是两个旋钮");

        // 同值常数复用 → 1;不同值 → 2。
        let same_c = FactorExpr::Binary(
            BinaryOp::Add,
            Box::new(FactorExpr::Const(1.5)),
            Box::new(FactorExpr::Const(1.5)),
        );
        assert_eq!(free_param_count(&same_c), 1, "同值常数算 1 个");
        let diff_c = FactorExpr::Binary(
            BinaryOp::Add,
            Box::new(FactorExpr::Const(1.5)),
            Box::new(FactorExpr::Const(2.5)),
        );
        assert_eq!(free_param_count(&diff_c), 2, "不同值常数是两个旋钮");

        // Input 不计参数(零回归)。
        assert_eq!(
            free_param_count(&FactorExpr::Input(InputSignal::MidPrice)),
            0,
            "纯输入信号无自由参数"
        );
    }

    #[test]
    fn simple_spread() {
        let expr = FactorExpr::Binary(
            BinaryOp::Sub,
            Box::new(FactorExpr::Input(InputSignal::BestAsk)),
            Box::new(FactorExpr::Input(InputSignal::BestBid)),
        );
        assert_eq!(ast_depth(&expr), 2);
        assert_eq!(ast_node_count(&expr), 3);
    }

    #[test]
    fn rolling_zscore() {
        let spread = FactorExpr::Binary(
            BinaryOp::Sub,
            Box::new(FactorExpr::Input(InputSignal::BestAsk)),
            Box::new(FactorExpr::Input(InputSignal::BestBid)),
        );
        let expr = FactorExpr::Rolling(RollingOp::Zscore, Box::new(spread), 20);
        assert_eq!(ast_depth(&expr), 3);
        assert_eq!(ast_node_count(&expr), 4);
    }

    #[test]
    fn conditional_expr() {
        let cond = FactorExpr::Binary(
            BinaryOp::Gt,
            Box::new(FactorExpr::Input(InputSignal::Volume)),
            Box::new(FactorExpr::Const(1000.0)),
        );
        let then = FactorExpr::Input(InputSignal::MidPrice);
        let else_ = FactorExpr::Const(0.0);
        let expr = FactorExpr::IfThenElse(Box::new(cond), Box::new(then), Box::new(else_));
        // IfThenElse(1) + Binary(1)+Input(1)+Const(1) + Input(1) + Const(1) = 6
        assert_eq!(ast_depth(&expr), 3);
        assert_eq!(ast_node_count(&expr), 6);
    }

    #[test]
    fn expr_to_string_readable() {
        let expr = FactorExpr::Rolling(
            RollingOp::Mean,
            Box::new(FactorExpr::Input(InputSignal::MidPrice)),
            50,
        );
        let s = expr_to_string(&expr);
        assert!(s.contains("Mean"));
        assert!(s.contains("50"));
    }

    #[test]
    fn free_params_counted() {
        // Rolling(Quantile(0.9), Const(1.0)+Const(2.0), w=20):
        // Rolling 窗口(1) + Quantile q(1) + 两个 Const(2) = 4。
        let inner = FactorExpr::Binary(
            BinaryOp::Add,
            Box::new(FactorExpr::Const(1.0)),
            Box::new(FactorExpr::Const(2.0)),
        );
        let expr = FactorExpr::Rolling(RollingOp::Quantile(0.9), Box::new(inner), 20);
        assert_eq!(free_param_count(&expr), 4);
    }

    #[test]
    fn pure_signal_has_no_free_params() {
        let expr = FactorExpr::Binary(
            BinaryOp::Sub,
            Box::new(FactorExpr::Input(InputSignal::BestAsk)),
            Box::new(FactorExpr::Input(InputSignal::BestBid)),
        );
        assert_eq!(free_param_count(&expr), 0);
    }

    #[test]
    fn nested_depth() {
        let mut expr = FactorExpr::Input(InputSignal::MidPrice);
        for _ in 0..5 {
            expr = FactorExpr::Unary(UnaryOp::Abs, Box::new(expr));
        }
        assert_eq!(ast_depth(&expr), 6);
        assert_eq!(ast_node_count(&expr), 6);
    }
}
