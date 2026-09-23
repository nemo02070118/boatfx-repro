//! LLM 因子生成框架 — Hubble/R&D-Agent(Q) 架构。
//!
//! 蓝图 §1.4.8 + Sprint 8 §3.3.15: LLM 因子框架骨架。
//! 参考: Hubble (arXiv 2604.09601) + R&D-Agent(Q) 2025 ICML。
//!
//! 三层架构:
//! 1. DSL — 白名单算子集合（防止任意代码执行）
//! 2. Sandbox — AST 验证（深度/节点数/窗口限制）
//! 3. Evaluation — RankIC 门禁（入池条件）

// P2-E3 · 多 Agent 辩论(6 角色日终市场观点 · 复用 llm_client + 防注入 · 推理不进热路径)。
pub mod agora;
pub mod ai_train;
pub mod causal_dag;
pub mod codegen;
pub mod consistency;
pub mod constitution;
pub mod dedup;
pub mod dimension;
pub mod dsl;
pub mod evaluation;
pub mod evolution;
pub mod factor_node;
// TD-E0-1 · DeepSeek schema / 白名单 lower / 解析(从 deepseek_client 拆出,降 400 行软线)。
pub mod factor_schema;
pub mod freeze;
pub mod gates;
pub mod interpreter;
// N12 · LLM 评委分校准(κ + Spearman 证评委分与样本外 IC 相关性 · 评委分降级为预筛不进硬指标)。
pub mod judge_calibration;
pub mod learning;
// P2-E0 · 通用 LlmClient 层(chat 抽象 + 错误分级 + 重试 + 防注入)。
// 因子生成 schema 降级为本层 consumer;E1 Copilot / E3 辩论后续共用。
pub mod llm_client;
// Phase1 · 多 provider 抽象(DeepSeek 主力 + Opus/GPT ensemble · env 读 key · 成本记账)。
pub mod llm_provider;
// Phase1 · LLM 因子并行生成器(防重复 6 层 + 多线并发 + SSoT 多样性 · 冷路径)。
pub mod llm_factor_gen;
// Phase3 · WASM 重型因子安全执行沙箱(feature="wasm_sandbox" · fuel+epoch+内存限 · deny-by-default)。
pub mod memory;
pub mod novelty;
#[cfg(feature = "wasm_sandbox")]
pub mod wasm_sandbox;
// N11 · 正交性导向准入(相似度惩罚 + ρ̄ 降才入池 + 负 RAG · 降组合相关是冲夏普唯一杠杆)。
pub mod orthogonal_admit;
pub mod pipeline;
pub mod reflection;
pub mod registry_fingerprint;
// M2 · 本地因子工厂常驻(可断点续跑 24/7 冷路径驱动 + 自动物化 · R13 §6)。
pub mod resident_factory;
pub mod sandbox;
// A1 · 语义去重(冻结 embedding + cosine 聚类 · 抓结构/数值去重漏掉的"换皮同源")。
pub mod semantic_dedup;
pub mod zoo;

// DeepSeek 客户端模块本身无条件可用(schema 解析 / 白名单 lower / sandbox 联动);
// 仅 HTTP 出站(`request_factors`)受 `feature = "deepseek"` 控制 · 见模块内 cfg。
pub mod deepseek_client;
