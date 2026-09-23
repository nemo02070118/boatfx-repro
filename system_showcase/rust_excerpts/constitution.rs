//! G4 因子宪法自我批判闸 — Constitutional AI 式原则逐条审查(可机判部分)。
//!
//! S5.2 G4(主纲 §3 第 5 步 · 研究笔记 19 §3.S5.2):把防过拟合纪律写成原则清单,
//! Critic 逐条审。本模块实现**可机判**的原则(不调 LLM):每条原则是一个确定性判据,
//! 逐条产出 PASS/FAIL + 理由。LLM 主观批判(如"机制叙事是否牵强")留给 gates.rs 的
//! `LlmSemanticJudge` trait。
//!
//! 取 Constitutional AI(Anthropic 2022)的 in-context 自我批判范式,**弃 RLAIF 微调**
//! (研究笔记 19 §3.S5.4:不把历史过拟合烙进权重)。
//!
//! 宪法原则(可机判子集):
//!  P1 经济逻辑非空(rationale 必须有实质内容)。
//!  P2 复杂度上界(自由参数 ≤ max_params · QuantaAlpha 消融:参数越少越抗过拟合)。
//!  P3 结构深度上界(AST 深度 ≤ max_depth)。
//!  P4 量纲合法(infer_dimension 无冲突)。
//!  P5 假设-代码一致(check_consistency 无脱节)。

use super::consistency::check_consistency;
use super::dimension::infer_dimension;
use super::dsl::{ast_depth, free_param_count, FactorExpr};

/// 宪法配置(原则阈值)。
#[derive(Debug, Clone)]
pub struct ConstitutionConfig {
    /// rationale 最小有效字符数(去空白后)。
    pub min_rationale_chars: usize,
    /// 最大自由参数数(P2)。
    pub max_free_params: usize,
    /// 最大 AST 深度(P3)。
    pub max_depth: usize,
}

impl Default for ConstitutionConfig {
    fn default() -> Self {
        Self {
            min_rationale_chars: 8,
            max_free_params: 6,
            max_depth: 10,
        }
    }
}

/// 单条原则审查结果。
#[derive(Debug, Clone, PartialEq)]
pub struct PrincipleVerdict {
    pub principle: &'static str,
    pub passed: bool,
    pub detail: String,
}

/// 宪法审查报告。
#[derive(Debug, Clone, PartialEq)]
pub struct ConstitutionReport {
    pub all_passed: bool,
    pub verdicts: Vec<PrincipleVerdict>,
}

impl ConstitutionReport {
    /// 未通过的原则名清单。
    #[must_use]
    pub fn failed_principles(&self) -> Vec<&'static str> {
        self.verdicts
            .iter()
            .filter(|v| !v.passed)
            .map(|v| v.principle)
            .collect()
    }
}

/// 逐条审查因子宪法(可机判原则)。
#[must_use]
pub fn review_constitution(
    rationale: &str,
    expr: &FactorExpr,
    cfg: &ConstitutionConfig,
) -> ConstitutionReport {
    let mut verdicts = Vec::new();

    // P1 经济逻辑非空。
    let rationale_len = rationale.trim().chars().count();
    verdicts.push(PrincipleVerdict {
        principle: "P1_economic_rationale",
        passed: rationale_len >= cfg.min_rationale_chars,
        detail: format!(
            "rationale_chars={rationale_len} (min={})",
            cfg.min_rationale_chars
        ),
    });

    // P2 复杂度上界。
    let pc = free_param_count(expr);
    verdicts.push(PrincipleVerdict {
        principle: "P2_complexity_params",
        passed: pc <= cfg.max_free_params,
        detail: format!("free_params={pc} (max={})", cfg.max_free_params),
    });

    // P3 结构深度上界。
    let depth = ast_depth(expr);
    verdicts.push(PrincipleVerdict {
        principle: "P3_structure_depth",
        passed: depth <= cfg.max_depth,
        detail: format!("depth={depth} (max={})", cfg.max_depth),
    });

    // P4 量纲合法。
    let dim = infer_dimension(expr);
    verdicts.push(PrincipleVerdict {
        principle: "P4_dimension_valid",
        passed: dim.is_consistent(),
        detail: if dim.is_consistent() {
            format!("dimension={:?}", dim.dimension)
        } else {
            dim.violations.join("; ")
        },
    });

    // P5 假设-代码一致。
    let cons = check_consistency(rationale, expr);
    verdicts.push(PrincipleVerdict {
        principle: "P5_hypothesis_code_consistency",
        passed: cons.consistent,
        detail: if cons.consistent {
            format!("matched={:?}", cons.matched_mechanisms)
        } else {
            cons.violations.join("; ")
        },
    });

    let all_passed = verdicts.iter().all(|v| v.passed);
    ConstitutionReport {
        all_passed,
        verdicts,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::llm_agent::dsl::{BinaryOp, FactorExpr, InputSignal::*};

    fn spread() -> FactorExpr {
        FactorExpr::Binary(
            BinaryOp::Sub,
            Box::new(FactorExpr::Input(BestAsk)),
            Box::new(FactorExpr::Input(BestBid)),
        )
    }

    #[test]
    fn clean_factor_passes_all() {
        let r = review_constitution(
            "Roll 1984 spread proxy 流动性",
            &spread(),
            &ConstitutionConfig::default(),
        );
        assert!(r.all_passed, "{:?}", r);
        assert_eq!(r.verdicts.len(), 5);
    }

    #[test]
    fn empty_rationale_fails_p1() {
        let r = review_constitution("", &spread(), &ConstitutionConfig::default());
        assert!(!r.all_passed);
        assert!(r.failed_principles().contains(&"P1_economic_rationale"));
    }

    #[test]
    fn too_many_params_fails_p2() {
        let cfg = ConstitutionConfig {
            max_free_params: 0,
            ..Default::default()
        };
        let expr = FactorExpr::Binary(
            BinaryOp::Add,
            Box::new(FactorExpr::Const(1.0)),
            Box::new(FactorExpr::Input(MidPrice)),
        );
        let r = review_constitution("有效经济机制描述", &expr, &cfg);
        assert!(r.failed_principles().contains(&"P2_complexity_params"));
    }

    #[test]
    fn dimension_conflict_fails_p4() {
        let expr = FactorExpr::Binary(
            BinaryOp::Add,
            Box::new(FactorExpr::Input(MidPrice)),
            Box::new(FactorExpr::Input(Volume)),
        );
        let r = review_constitution("某机制描述足够长", &expr, &ConstitutionConfig::default());
        assert!(r.failed_principles().contains(&"P4_dimension_valid"));
    }

    #[test]
    fn narrative_drift_fails_p5() {
        // P18-BUG1 · 真脱节:声称流动性但只用 MidPrice(无价差/无量/无成交)→ P5 脱节。
        // (Volume 已不算脱节:Amihud 非流动性用 Volume 合法。)
        let expr = FactorExpr::Input(MidPrice);
        let r = review_constitution(
            "liquidity spread 流动性因子",
            &expr,
            &ConstitutionConfig::default(),
        );
        assert!(r
            .failed_principles()
            .contains(&"P5_hypothesis_code_consistency"));
    }
}
