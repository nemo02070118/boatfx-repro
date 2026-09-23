//! Phase3 · WASM 重型因子安全执行沙箱(wasmtime · deny-by-default · CPU/内存/墙钟三限)。
//!
//! # 定位(与 AST 白名单沙箱互补 · 非替代)
//! `sandbox.rs` 是 **AST 静态白名单**(编译前拦过复杂/越权 DSL)。本模块是 **运行时执行隔离**:
//! 当因子逻辑重到无法用 DSL/NamedFactor 表达(需真裸计算),把它编译成 WASM,在 wasmtime 里
//! 带**硬资源上限**执行,恶意/失控代码也无法拖垮主进程。
//!
//! # 三道硬限(全网 SOTA · CodeEvolve/GigaEvo 沙箱执行范式)
//! 1. **fuel**(`Config::consume_fuel` + `Store::set_fuel`):确定性 CPU 指令预算,烧完 trap
//!    (可复现 · 防死循环)。
//! 2. **epoch_interruption**(`Config::epoch_interruption` + 后台线程 `increment_epoch`):墙钟熔断
//!    (低开销 ~10% · 兜底 fuel 估不准的场景)。
//! 3. **StoreLimits**(`limiter` · `memory_size` 上限):内存硬顶,超限 growth 失败(防内存爆炸)。
//!
//! # deny-by-default
//! - **无 WASI**:不 `add_to_linker` 任何 host 函数 → guest 无文件/网络/时钟/env 访问(纯计算)。
//! - 单一导出契约:guest 必须导出 `eval(ptr,len)->f64` + 线性内存 `memory`;host 只写输入、读返回。
//! - 任何 trap(fuel 尽/epoch 超/内存超/非法指令)→ 诚实返回 `SandboxError`,不 panic 主进程。
//!
//! 出处:Bytecode Alliance wasmtime 44 · Config::{consume_fuel,epoch_interruption} · StoreLimitsBuilder。

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use wasmtime::{Config, Engine, Linker, Module, Store, StoreLimits, StoreLimitsBuilder};

/// 沙箱资源预算(三限 · 默认保守 · 生产按因子重量调)。
#[derive(Debug, Clone)]
pub struct WasmBudget {
    /// CPU fuel(指令预算 · 烧完 trap · 确定性)。默认 100M(足够中等因子 · 拦死循环)。
    pub fuel: u64,
    /// 墙钟上限(epoch 熔断兜底)。默认 500ms。
    pub wall_clock: Duration,
    /// 线性内存上限(字节)。默认 16 MiB。
    pub max_memory_bytes: usize,
}

impl Default for WasmBudget {
    fn default() -> Self {
        Self {
            fuel: 100_000_000,
            wall_clock: Duration::from_millis(500),
            max_memory_bytes: 16 * 1024 * 1024,
        }
    }
}

/// 沙箱执行错误(全部诚实返回 · 绝不 panic 主进程)。
#[derive(Debug, thiserror::Error)]
pub enum SandboxError {
    #[error("wasm engine/config error: {0}")]
    Engine(String),
    #[error("wasm module compile rejected: {0}")]
    Compile(String),
    #[error("wasm instantiate failed: {0}")]
    Instantiate(String),
    #[error("missing required export: {0}")]
    MissingExport(String),
    #[error("wasm trap (fuel/epoch/memory/illegal): {0}")]
    Trap(String),
    #[error("io between host and guest failed: {0}")]
    Io(String),
}

/// Store 携带的宿主状态(仅资源 limiter · 无任何 WASI/host 能力 · deny-by-default)。
struct HostState {
    limits: StoreLimits,
}

/// 重型因子 WASM 沙箱(编译一次 · 可多次喂输入求值)。
pub struct WasmFactorSandbox {
    engine: Engine,
    module: Module,
    budget: WasmBudget,
    /// 后台 epoch 递增线程的停止信号。
    epoch_stop: Arc<AtomicBool>,
    epoch_handle: Option<std::thread::JoinHandle<()>>,
}

impl WasmFactorSandbox {
    /// 从 WASM 字节码编译沙箱(deny-by-default · 三限已配)。
    ///
    /// `wasm_bytes` 是已编译的 `.wasm`(guest 必须导出 `eval(i32,i32)->f64` + `memory`)。
    /// 编译失败(非法/超限模块)→ `SandboxError::Compile`,不 panic。
    pub fn compile(wasm_bytes: &[u8], budget: WasmBudget) -> Result<Self, SandboxError> {
        let mut config = Config::new();
        config.consume_fuel(true);
        config.epoch_interruption(true);
        // deny-by-default 由"空 Linker(不加任何 host 函数)"保证 · guest 无外部能力。
        let engine = Engine::new(&config).map_err(|e| SandboxError::Engine(e.to_string()))?;
        let module =
            Module::new(&engine, wasm_bytes).map_err(|e| SandboxError::Compile(e.to_string()))?;

        // 后台线程按墙钟周期递增 epoch(达 deadline → guest trap · 兜底 fuel)。
        let epoch_stop = Arc::new(AtomicBool::new(false));
        let engine_bg = engine.clone();
        let stop_bg = Arc::clone(&epoch_stop);
        let tick = budget.wall_clock;
        let epoch_handle = std::thread::spawn(move || {
            while !stop_bg.load(Ordering::Relaxed) {
                std::thread::sleep(tick);
                engine_bg.increment_epoch();
            }
        });

        Ok(Self {
            engine,
            module,
            budget,
            epoch_stop,
            epoch_handle: Some(epoch_handle),
        })
    }

    /// 在沙箱内对输入向量求值(host 写输入→调 guest `eval`→读 f64 · 任何越限诚实 Err)。
    ///
    /// 契约:guest 导出 `eval(ptr:i32,len:i32)->f64` 与线性内存 `memory` + `alloc(len)->ptr`。
    /// host 用 guest 的 `alloc` 拿缓冲写 `f64` 输入,再调 `eval`。fuel/epoch/内存任一超限 → Trap。
    pub fn eval(&mut self, inputs: &[f64]) -> Result<f64, SandboxError> {
        let limits = StoreLimitsBuilder::new()
            .memory_size(self.budget.max_memory_bytes)
            .build();
        let mut store = Store::new(&self.engine, HostState { limits });
        store.limiter(|s| &mut s.limits);
        store
            .set_fuel(self.budget.fuel)
            .map_err(|e| SandboxError::Engine(e.to_string()))?;
        // epoch:1 tick 后到 deadline(后台线程递增触发 trap)。
        store.set_epoch_deadline(1);
        store.epoch_deadline_trap();

        // deny-by-default:空 linker(不加任何 host 函数 · guest 无外部能力)。
        let linker: Linker<HostState> = Linker::new(&self.engine);
        let instance = linker
            .instantiate(&mut store, &self.module)
            .map_err(|e| SandboxError::Instantiate(e.to_string()))?;

        let memory = instance
            .get_memory(&mut store, "memory")
            .ok_or_else(|| SandboxError::MissingExport("memory".into()))?;
        let alloc = instance
            .get_typed_func::<i32, i32>(&mut store, "alloc")
            .map_err(|_| SandboxError::MissingExport("alloc(i32)->i32".into()))?;
        let eval = instance
            .get_typed_func::<(i32, i32), f64>(&mut store, "eval")
            .map_err(|_| SandboxError::MissingExport("eval(i32,i32)->f64".into()))?;

        // D2 · 输入规模守卫:byte_len / len 传给 guest 用 i32,过大截断成负值 → guest 越界/OOB。
        // 预算内存上限已 ≤16MiB,输入不该超过 i32::MAX;超则诚实拒绝(非静默 wrap)。
        let byte_len = std::mem::size_of_val(inputs);
        if byte_len > i32::MAX as usize || inputs.len() > i32::MAX as usize {
            return Err(SandboxError::Io(format!(
                "输入过大 byte_len={byte_len} len={} 超 i32",
                inputs.len()
            )));
        }
        let ptr = alloc
            .call(&mut store, byte_len as i32)
            .map_err(|e| SandboxError::Trap(e.to_string()))?;
        // D2 · guest alloc 返回校验:ptr<0(错误/越界)或 ptr+byte_len 超线性内存 → 拒绝写入。
        if ptr < 0 {
            return Err(SandboxError::Trap(format!("alloc 返回非法指针 {ptr}")));
        }
        let mem_size = memory.data_size(&store);
        if (ptr as usize).saturating_add(byte_len) > mem_size {
            return Err(SandboxError::Io(format!(
                "写入越界:ptr={ptr}+{byte_len} > mem {mem_size}"
            )));
        }
        // 写输入(小端 f64)到 guest 线性内存。
        let mut bytes = Vec::with_capacity(byte_len);
        for &x in inputs {
            bytes.extend_from_slice(&x.to_le_bytes());
        }
        memory
            .write(&mut store, ptr as usize, &bytes)
            .map_err(|e| SandboxError::Io(e.to_string()))?;

        let out = eval
            .call(&mut store, (ptr, inputs.len() as i32))
            .map_err(|e| SandboxError::Trap(e.to_string()))?;
        if out.is_finite() {
            Ok(out)
        } else {
            Ok(0.0)
        }
    }
}

impl Drop for WasmFactorSandbox {
    fn drop(&mut self) {
        self.epoch_stop.store(true, Ordering::Relaxed);
        // 递增一次让后台线程尽快醒来退出。
        self.engine.increment_epoch();
        if let Some(h) = self.epoch_handle.take() {
            let _ = h.join();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 一个最小的合法 guest(WAT · 导出 memory/alloc/eval):eval 返回输入首元素 ×2。
    /// alloc 用一个固定 bump 指针(测试足够 · 单次调用)。
    const GUEST_DOUBLE_FIRST: &str = r#"
        (module
          (memory (export "memory") 1)
          (global $bump (mut i32) (i32.const 1024))
          (func (export "alloc") (param $len i32) (result i32)
            (local $p i32)
            global.get $bump
            local.set $p
            global.get $bump
            local.get $len
            i32.add
            global.set $bump
            local.get $p)
          (func (export "eval") (param $ptr i32) (param $len i32) (result f64)
            local.get $ptr
            f64.load
            f64.const 2.0
            f64.mul))
    "#;

    /// 死循环 guest(测 fuel/epoch 熔断 · 不能挂死主进程)。
    const GUEST_INFINITE_LOOP: &str = r#"
        (module
          (memory (export "memory") 1)
          (func (export "alloc") (param i32) (result i32) i32.const 1024)
          (func (export "eval") (param i32) (param i32) (result f64)
            (loop $l (br $l))
            f64.const 0.0))
    "#;

    fn wat_to_wasm(wat: &str) -> Vec<u8> {
        wat::parse_str(wat).expect("test WAT 应能编译")
    }

    #[test]
    fn sandbox_runs_valid_guest_and_returns_scalar() {
        let wasm = wat_to_wasm(GUEST_DOUBLE_FIRST);
        let mut sb = WasmFactorSandbox::compile(&wasm, WasmBudget::default()).unwrap();
        let out = sb.eval(&[3.5, 1.0, 2.0]).unwrap();
        assert!((out - 7.0).abs() < 1e-12, "eval 应=首元素×2, got {out}");
    }

    #[test]
    fn sandbox_traps_infinite_loop_via_fuel() {
        let wasm = wat_to_wasm(GUEST_INFINITE_LOOP);
        // 给极少 fuel → 死循环烧尽即 trap(不挂死)。
        let budget = WasmBudget {
            fuel: 100_000,
            ..WasmBudget::default()
        };
        let mut sb = WasmFactorSandbox::compile(&wasm, budget).unwrap();
        let r = sb.eval(&[1.0]);
        assert!(
            matches!(r, Err(SandboxError::Trap(_))),
            "死循环应被 fuel trap 拦截, got {r:?}"
        );
    }

    #[test]
    fn sandbox_rejects_missing_export() {
        // 无 eval 导出 → MissingExport。
        let wat = r#"(module (memory (export "memory") 1)
            (func (export "alloc") (param i32) (result i32) i32.const 0))"#;
        let wasm = wat_to_wasm(wat);
        let mut sb = WasmFactorSandbox::compile(&wasm, WasmBudget::default()).unwrap();
        let r = sb.eval(&[1.0]);
        assert!(
            matches!(r, Err(SandboxError::MissingExport(_))),
            "缺 eval 应报 MissingExport, got {r:?}"
        );
    }
}
