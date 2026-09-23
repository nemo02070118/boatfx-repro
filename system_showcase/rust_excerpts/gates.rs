//! S5.2 四道前端防幻觉闸编排 — G1 去重 / G2 三一致 / G3 因果可纳 / G4 因子宪法。
//!
//! 主纲 §3 第 5 步 S5.2 · 研究笔记 19 §3.S5.2 + §5 避坑铁律。
//! 串在你的九层筛子**之前**,在求值前用确定性判据拦掉幻觉因子,节省下游昂贵的
//! CPCV/DSR/九层评估。每道闸都是**客观可机判内核**(真算法 + 论文锚 + 必测):
//!  - G1 AST 同构去重: `dedup::canonical_signature` + `novelty::evaluate_novelty`。
//!  - G2 假设-因子-代码三一致: `consistency::check_consistency`。
//!  - G3 因果可纳性(后门准则): `causal_dag::check_backdoor`(DAG 由 LLM 提供则裁决)。
//!  - G4 因子宪法逐条审查: `constitution::review_constitution`。
//!
//! LLM 主观批判(异质 Critic 按因子宪法反驳 · 研究笔记 19 §5「必须异质+客观裁判」)
//! 通过 `LlmSemanticJudge` trait 预留扩展点。本模块**不内置 HTTP 调用**(热路径零网络 +
//! 出站受 `feature="deepseek"` 控制),默认 judge 为 `NoopJudge`(透传 · 诚实声明未接)。

use super::causal_dag::{check_backdoor, CausalDag};
use super::consistency::check_consistency;
use super::constitution::{review_constitution, ConstitutionConfig};
use super::dedup::canonical_signature;
use super::dsl::FactorExpr;
use super::novelty::{evaluate_novelty, NoveltyConfig};
use std::collections::HashSet;

/// LLM 提供的因子因果假设(主观步 · 用于 G3 客观裁决的输入)。
#[derive(Debug, Clone)]
pub struct CausalHypothesis {
    pub dag: CausalDag,
    pub treatment: String,
    pub outcome: String,
    pub adjustment: Vec<String>,
}

/// 待审因子(假设 + 表达式 + 可选因果假设)。
#[derive(Debug, Clone)]
pub struct GateCandidate {
    pub name: String,
    pub rationale: String,
    pub expr: FactorExpr,
    /// LLM 给的因果 DAG(None = 未提供 · G3 标记为待补,不阻塞但不算通过)。
    pub causal: Option<CausalHypothesis>,
}

/// 单道闸的裁决。
#[derive(Debug, Clone, PartialEq)]
pub enum GateOutcome {
    Pass,
    Reject(String),
    /// 信息不足(如 G3 无 DAG)→ 不算通过也不算硬拒,交由策略决定。
    Inconclusive(String),
}

impl GateOutcome {
    #[must_use]
    pub fn is_pass(&self) -> bool {
        matches!(self, GateOutcome::Pass)
    }
    #[must_use]
    pub fn is_reject(&self) -> bool {
        matches!(self, GateOutcome::Reject(_))
    }
}

/// 四道闸的完整裁决。
#[derive(Debug, Clone, PartialEq)]
pub struct FrontGateReport {
    pub g1_dedup: GateOutcome,
    pub g2_consistency: GateOutcome,
    pub g3_causal: GateOutcome,
    pub g4_constitution: GateOutcome,
    pub llm_judge: GateOutcome,
    /// 是否被任一硬闸拒绝(G3 Inconclusive 不算拒)。
    pub admitted: bool,
}

/// LLM 主观语义批判接口(异质 Critic · 默认不接 HTTP)。
pub trait LlmSemanticJudge {
    /// 对因子做主观批判;返回 `GateOutcome`。
    fn judge(&self, cand: &GateCandidate) -> GateOutcome;
}

/// 默认透传 judge(诚实声明:未接入真 LLM · 见 deepseek_client feature)。
#[derive(Debug, Default, Clone, Copy)]
pub struct NoopJudge;

impl LlmSemanticJudge for NoopJudge {
    fn judge(&self, _cand: &GateCandidate) -> GateOutcome {
        GateOutcome::Inconclusive("LLM judge 未接入(feature=deepseek 离线档)".into())
    }
}

/// 前端四闸配置。
#[derive(Debug, Clone, Default)]
pub struct FrontGatesConfig {
    pub novelty: NoveltyConfig,
    pub constitution: ConstitutionConfig,
    /// G3 无 DAG 时是否硬拒(true=必须给 DAG · false=Inconclusive 放行下游)。
    pub require_causal_dag: bool,
}

/// 前端四闸编排器。
pub struct FrontGates<J: LlmSemanticJudge = NoopJudge> {
    cfg: FrontGatesConfig,
    judge: J,
    /// 已通过因子的 canonical 签名(G1 跨候选去重)。
    seen_signatures: HashSet<u64>,
    /// 已通过因子的 AST(G1 novelty 比对池)。
    zoo: Vec<FactorExpr>,
    /// 已知因子名黑名单(小写归一 · G1 精确防重名 · 灌生产因子库 800 名字)。
    seen_names: HashSet<String>,
}

impl Default for FrontGates<NoopJudge> {
    fn default() -> Self {
        Self::new(FrontGatesConfig::default(), NoopJudge)
    }
}

impl<J: LlmSemanticJudge> FrontGates<J> {
    #[must_use]
    pub fn new(cfg: FrontGatesConfig, judge: J) -> Self {
        Self {
            cfg,
            judge,
            seen_signatures: HashSet::new(),
            zoo: Vec::new(),
            seen_names: HashSet::new(),
        }
    }

    /// 用初始 alpha-zoo 预热 novelty 池(已有因子结构)。
    pub fn seed_zoo(&mut self, zoo: &[FactorExpr]) {
        for z in zoo {
            self.zoo.push(z.clone());
            self.seen_signatures.insert(canonical_signature(z));
        }
    }

    /// 灌入已知因子名黑名单(小写归一 · G1 精确防重名)。
    ///
    /// 配合 `factor_registry::build_full_registry().all()` 的 800+ 因子名,使 LLM
    /// 生成的因子若**撞已有因子名**当场被 G1 拒(防"换皮重造"既有因子)。与 AST
    /// novelty 门正交:名字层精确、AST 层抓结构同质。
    pub fn seed_names(&mut self, names: &[String]) {
        for n in names {
            self.seen_names.insert(n.trim().to_lowercase());
        }
    }

    /// G1: 名字精确去重 + AST 同构去重(精确签名 + novelty 结构相似度)。
    fn gate1(&self, name: &str, expr: &FactorExpr) -> GateOutcome {
        if self.seen_names.contains(&name.trim().to_lowercase()) {
            return GateOutcome::Reject(format!("G1: 名字撞已有因子库({name})"));
        }
        let sig = canonical_signature(expr);
        if self.seen_signatures.contains(&sig) {
            return GateOutcome::Reject("G1: 精确同构(canonical 签名重复)".into());
        }
        let nov = evaluate_novelty(expr, &self.zoo, &self.cfg.novelty);
        if !nov.is_novel {
            return GateOutcome::Reject(format!(
                "G1: 结构同质 similarity={:.3} > {:.3}",
                nov.similarity, self.cfg.novelty.max_similarity
            ));
        }
        GateOutcome::Pass
    }

    /// G2: 假设-因子-代码三一致。
    fn gate2(cand: &GateCandidate) -> GateOutcome {
        let r = check_consistency(&cand.rationale, &cand.expr);
        if r.consistent {
            GateOutcome::Pass
        } else {
            GateOutcome::Reject(format!("G2: {}", r.violations.join("; ")))
        }
    }

    /// G3: 因果可纳性(后门准则)。
    fn gate3(&self, cand: &GateCandidate) -> GateOutcome {
        match &cand.causal {
            None => {
                if self.cfg.require_causal_dag {
                    GateOutcome::Reject("G3: 未提供因果 DAG(require_causal_dag=true)".into())
                } else {
                    GateOutcome::Inconclusive("G3: 未提供因果 DAG".into())
                }
            }
            Some(h) => {
                let adj: Vec<&str> = h.adjustment.iter().map(String::as_str).collect();
                match check_backdoor(&h.dag, &h.treatment, &h.outcome, &adj) {
                    Ok(rep) if rep.admissible => GateOutcome::Pass,
                    Ok(rep) => {
                        let mut why = rep.violations;
                        for p in rep.open_backdoor_paths {
                            why.push(format!("开放后门路径 {}", p.join("->")));
                        }
                        GateOutcome::Reject(format!("G3: {}", why.join("; ")))
                    }
                    Err(e) => GateOutcome::Reject(format!("G3: DAG 错误 {e}")),
                }
            }
        }
    }

    /// G4: 因子宪法逐条审查。
    fn gate4(&self, cand: &GateCandidate) -> GateOutcome {
        let rep = review_constitution(&cand.rationale, &cand.expr, &self.cfg.constitution);
        if rep.all_passed {
            GateOutcome::Pass
        } else {
            GateOutcome::Reject(format!("G4: 违反 {:?}", rep.failed_principles()))
        }
    }

    /// 评估单候选过四闸;通过(无硬拒)则纳入 zoo/签名池(在线去重)。
    pub fn evaluate(&mut self, cand: &GateCandidate) -> FrontGateReport {
        let g1 = self.gate1(&cand.name, &cand.expr);
        let g2 = Self::gate2(cand);
        let g3 = self.gate3(cand);
        let g4 = self.gate4(cand);
        let llm = self.judge.judge(cand);

        // 硬拒: G1/G2/G4 任一 Reject,或 G3 Reject(有 DAG 但不可纳)。
        // G3/LLM 的 Inconclusive 不阻塞(诚实:信息不足非证据不足)。
        let admitted = !(g1.is_reject()
            || g2.is_reject()
            || g3.is_reject()
            || g4.is_reject()
            || llm.is_reject());

        if admitted {
            self.seen_signatures.insert(canonical_signature(&cand.expr));
            self.zoo.push(cand.expr.clone());
            self.seen_names.insert(cand.name.trim().to_lowercase());
        }

        FrontGateReport {
            g1_dedup: g1,
            g2_consistency: g2,
            g3_causal: g3,
            g4_constitution: g4,
            llm_judge: llm,
            admitted,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::llm_agent::dsl::{BinaryOp, FactorExpr, InputSignal::*, RollingOp};

    fn spread() -> FactorExpr {
        FactorExpr::Binary(
            BinaryOp::Sub,
            Box::new(FactorExpr::Input(BestAsk)),
            Box::new(FactorExpr::Input(BestBid)),
        )
    }

    fn cand(name: &str, rationale: &str, expr: FactorExpr) -> GateCandidate {
        GateCandidate {
            name: name.into(),
            rationale: rationale.into(),
            expr,
            causal: None,
        }
    }

    #[test]
    fn clean_factor_admitted() {
        let mut gates = FrontGates::default();
        let r = gates.evaluate(&cand("spread", "Roll 1984 spread 流动性", spread()));
        assert!(r.admitted, "{:?}", r);
        assert!(r.g1_dedup.is_pass());
        assert!(r.g2_consistency.is_pass());
        assert!(r.g4_constitution.is_pass());
        // G3 无 DAG → Inconclusive 不阻塞。
        assert!(matches!(r.g3_causal, GateOutcome::Inconclusive(_)));
    }

    #[test]
    fn duplicate_rejected_by_g1() {
        let mut gates = FrontGates::default();
        gates.evaluate(&cand("a", "Roll 1984 spread 流动性", spread()));
        let r = gates.evaluate(&cand("a_dup", "Roll 1984 spread 流动性", spread()));
        assert!(!r.admitted);
        assert!(r.g1_dedup.is_reject());
    }

    #[test]
    fn seeded_name_rejected_by_g1() {
        // 名字黑名单:撞已有因子名(大小写归一)当场被 G1 拒,即使 AST 全新。
        let mut gates = FrontGates::default();
        gates.seed_names(&["disposition_effect".to_string(), "connors_rsi".to_string()]);
        let novel_expr =
            FactorExpr::Rolling(RollingOp::Skew, Box::new(FactorExpr::Input(BidSize)), 17);
        let r = gates.evaluate(&cand(
            "Disposition_Effect",
            "behavioral 处置效应",
            novel_expr,
        ));
        assert!(!r.admitted, "重名应被拒:{r:?}");
        assert!(r.g1_dedup.is_reject());
    }

    #[test]
    fn narrative_drift_rejected_by_g2_and_g4() {
        let mut gates = FrontGates::default();
        // P18-BUG1 · 真脱节:声称流动性但只用 MidPrice(无价差/无量/无成交)。
        // (旧例用 Volume 已不算脱节——Amihud 流动性用 Volume 合法;改用纯 MidPrice 才是真挂羊头。)
        let expr = FactorExpr::Rolling(RollingOp::Mean, Box::new(FactorExpr::Input(MidPrice)), 20);
        let r = gates.evaluate(&cand("fake_liq", "liquidity spread 流动性", expr));
        assert!(!r.admitted);
        assert!(r.g2_consistency.is_reject());
        assert!(r.g4_constitution.is_reject());
    }

    #[test]
    fn dimension_conflict_rejected_by_g4() {
        let mut gates = FrontGates::default();
        let expr = FactorExpr::Binary(
            BinaryOp::Add,
            Box::new(FactorExpr::Input(MidPrice)),
            Box::new(FactorExpr::Input(Volume)),
        );
        let r = gates.evaluate(&cand("bad_dim", "某足够长的机制描述", expr));
        assert!(!r.admitted);
        assert!(r.g4_constitution.is_reject());
    }

    #[test]
    fn g3_open_backdoor_rejected() {
        let mut gates = FrontGates::default();
        let mut dag = CausalDag::new(&["X", "Y", "Z"]);
        dag.add_edge("Z", "X").unwrap();
        dag.add_edge("Z", "Y").unwrap();
        dag.add_edge("X", "Y").unwrap();
        let mut c = cand("conf", "Roll 1984 spread 流动性", spread());
        c.causal = Some(CausalHypothesis {
            dag,
            treatment: "X".into(),
            outcome: "Y".into(),
            adjustment: vec![], // 未调整混淆 → 开放后门。
        });
        let r = gates.evaluate(&c);
        assert!(!r.admitted);
        assert!(r.g3_causal.is_reject());
    }

    #[test]
    fn g3_adjusted_confounder_admitted() {
        let mut gates = FrontGates::default();
        let mut dag = CausalDag::new(&["X", "Y", "Z"]);
        dag.add_edge("Z", "X").unwrap();
        dag.add_edge("Z", "Y").unwrap();
        dag.add_edge("X", "Y").unwrap();
        let mut c = cand("conf_ok", "Roll 1984 spread 流动性", spread());
        c.causal = Some(CausalHypothesis {
            dag,
            treatment: "X".into(),
            outcome: "Y".into(),
            adjustment: vec!["Z".into()],
        });
        let r = gates.evaluate(&c);
        assert!(r.admitted, "{:?}", r);
        assert!(r.g3_causal.is_pass());
    }

    #[test]
    fn seed_zoo_blocks_known_structure() {
        let mut gates = FrontGates::default();
        gates.seed_zoo(&[spread()]);
        let r = gates.evaluate(&cand("dup", "Roll 1984 spread 流动性", spread()));
        assert!(!r.admitted);
        assert!(r.g1_dedup.is_reject());
    }
}
