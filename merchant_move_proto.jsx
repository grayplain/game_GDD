import { useState, useCallback } from "react";

// ── PALETTE ─────────────────────────────────────────────────────
const C = {
  bg: "#07090b", panel: "#0d1015", border: "#1a2028", borderLight: "#2a3040",
  text: "#c0c8d8", textDim: "#4a5568", textFaint: "#161c24",
  gold: "#d4a820", goldDim: "#7a6010", goldFaint: "#191408",
  green: "#38a860", greenDim: "#1a5030",
  warn: "#e8a020", danger: "#e04848", info: "#4890d8",
  merchant: "#38c8a0",
  boom:    "#38c890",  // 好況
  normal:  "#4890d8",  // 普通
  bust:    "#c87838",  // 不況
  risky:   "#c83868",  // 危険
};

// ── HEX MARKET TYPES ─────────────────────────────────────────────
const MARKET_TYPES = {
  boom: {
    id: "boom", label: "好況", icon: "📈",
    color: C.boom,
    goldRange: [4, 6],
    riskRate: 0,       // 空振り確率
    desc: "交易が活発。安定した高収入。",
    historicalNote: "豊作・航路開通・需要急増",
  },
  normal: {
    id: "normal", label: "普通", icon: "🏪",
    color: C.normal,
    goldRange: [2, 3],
    riskRate: 0,
    desc: "標準的な市場。安定しているが旨みも少ない。",
    historicalNote: "平時の定常交易",
  },
  bust: {
    id: "bust", label: "不況", icon: "📉",
    color: C.bust,
    goldRange: [1, 1],
    riskRate: 0,
    desc: "市況が悪い。動かしても稼ぎが少ない。",
    historicalNote: "凶作・競合増加・需要低迷",
  },
  risky: {
    id: "risky", label: "危険", icon: "⚠️",
    color: C.risky,
    goldRange: [6, 8],
    riskRate: 0.45,    // 45%で空振り
    desc: "大きく稼げるが、空振りのリスクがある。",
    historicalNote: "海賊・略奪・政変リスクを含む高利交易路",
  },
};

// HEXプール（10HEX。商人が動かせるのは自分の支配外も含む）
const ALL_HEX_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// ── MARKET GENERATION ────────────────────────────────────────────
function generateMarkets() {
  // 毎ターン完全ランダムで各HEXに市況を割り当て
  // 分布：好況2、普通4、不況2、危険2（バランス調整可）
  const pool = [
    "boom","boom",
    "normal","normal","normal","normal",
    "bust","bust",
    "risky","risky",
  ];
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const markets = {};
  ALL_HEX_IDS.forEach((id, i) => {
    markets[id] = MARKET_TYPES[shuffled[i]];
  });
  return markets;
}

// ── UNIT DEFINITIONS ─────────────────────────────────────────────
const UNIT_DEFS = [
  { id: "u1", name: "行商人",    icon: "🧳", color: "#d4a820" },
  { id: "u2", name: "交易商",    icon: "💼", color: "#38c8a0" },
  { id: "u3", name: "密売人",    icon: "🗝",  color: "#c878d4" },
  { id: "u4", name: "両替商",    icon: "⚖️", color: "#78a8e8" },
];

// ── HELPERS ──────────────────────────────────────────────────────
const panelS = {
  background: C.panel, border: `1px solid ${C.border}`,
  borderRadius: 6, padding: 14,
};
const secL = {
  fontSize: 9, color: C.textDim, letterSpacing: "0.25em",
  marginBottom: 10, borderBottom: `1px solid ${C.border}`,
  paddingBottom: 5, textTransform: "uppercase",
};

function rollIncome(market) {
  const [min, max] = market.goldRange;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ── HEX CARD ─────────────────────────────────────────────────────
function HexCard({ hexId, market, assignedUnits, onAssign, onRemove, phase, result }) {
  const isRevealed = phase === "result";
  const hasUnits = assignedUnits.length > 0;

  return (
    <div style={{
      ...panelS,
      border: `1px solid ${hasUnits ? market.color + "80" : C.border}`,
      background: hasUnits ? `${market.color}08` : C.panel,
      position: "relative",
      transition: "border-color 0.2s",
    }}>
      {/* HEX番号 + 市況 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div style={{
          width: 28, height: 28, borderRadius: "50%",
          background: C.textFaint, border: `1px solid ${C.border}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, color: C.textDim, fontFamily: "monospace", flexShrink: 0,
        }}>
          {hexId}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 14 }}>{market.icon}</span>
            <span style={{ fontSize: 12, color: market.color }}>{market.label}</span>
          </div>
          <div style={{ fontSize: 9, color: C.textDim, marginTop: 1 }}>{market.desc}</div>
        </div>
        {/* リターン表示（あいまい） */}
        <div style={{
          padding: "3px 8px", borderRadius: 3,
          background: `${market.color}18`, border: `1px solid ${market.color}40`,
          fontSize: 10, color: market.color, textAlign: "center", flexShrink: 0,
        }}>
          {market.id === "risky"
            ? `金${market.goldRange[0]}〜${market.goldRange[1]} or 0`
            : `金${market.goldRange[0]}〜${market.goldRange[1]}`}
        </div>
      </div>

      {/* 配置済みユニット */}
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", minHeight: 28, marginBottom: 6 }}>
        {assignedUnits.map(unit => (
          <div key={unit.id} style={{
            display: "flex", alignItems: "center", gap: 4,
            padding: "3px 8px", borderRadius: 3,
            background: `${unit.color}18`, border: `1px solid ${unit.color}50`,
            fontSize: 10, color: unit.color, cursor: phase === "assign" ? "pointer" : "default",
          }}
            onClick={() => phase === "assign" && onRemove(unit.id, hexId)}
            title={phase === "assign" ? "クリックで取り消し" : ""}
          >
            {unit.icon} {unit.name}
            {phase === "assign" && <span style={{ fontSize: 8, color: C.textDim }}>✕</span>}
          </div>
        ))}
        {assignedUnits.length === 0 && phase === "assign" && (
          <div style={{ fontSize: 9, color: C.textFaint, padding: "4px 0" }}>
            ← ユニットを配置
          </div>
        )}
      </div>

      {/* 結果表示 */}
      {isRevealed && result && result.map((r, i) => (
        <div key={i} style={{
          padding: "5px 8px", borderRadius: 3, marginBottom: 4,
          background: r.income > 0 ? `${C.green}12` : `${C.danger}12`,
          border: `1px solid ${r.income > 0 ? C.green : C.danger}40`,
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <span style={{ fontSize: 11 }}>{r.unit.icon}</span>
          <span style={{ fontSize: 10, color: C.textDim, flex: 1 }}>{r.unit.name}</span>
          {r.income > 0
            ? <span style={{ fontSize: 12, color: C.gold, fontFamily: "monospace" }}>+{r.income} 金</span>
            : <span style={{ fontSize: 11, color: C.danger }}>空振り</span>}
        </div>
      ))}

      {/* 史実メモ（小さく） */}
      <div style={{ fontSize: 8, color: C.textFaint, marginTop: 2 }}>
        📜 {market.historicalNote}
      </div>
    </div>
  );
}

// ── UNIT POOL PANEL ───────────────────────────────────────────────
function UnitPool({ units, assignments, onAssign, phase }) {
  return (
    <div style={panelS}>
      <div style={secL}>内政ユニット（配置先を選択）</div>
      <div style={{ fontSize: 9, color: C.textFaint, marginBottom: 10, lineHeight: 1.6 }}>
        各ユニットを儲かりそうなHEXに配置する。<br />
        配置しないユニットは今ターン収入なし。
      </div>
      {units.map(unit => {
        const assigned = Object.entries(assignments).find(([, us]) => us.some(u => u.id === unit.id));
        const assignedHex = assigned ? assigned[0] : null;
        return (
          <div key={unit.id} style={{
            display: "flex", alignItems: "center", gap: 8, marginBottom: 8,
            padding: "8px 10px", borderRadius: 4,
            background: assignedHex ? `${unit.color}10` : C.goldFaint,
            border: `1px solid ${assignedHex ? unit.color + "50" : C.border}`,
          }}>
            <span style={{ fontSize: 18 }}>{unit.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: unit.color }}>{unit.name}</div>
              <div style={{ fontSize: 9, color: C.textDim, marginTop: 1 }}>
                {assignedHex
                  ? `→ HEX${assignedHex} 配置済み`
                  : "未配置（収入なし）"}
              </div>
            </div>
            {phase === "assign" && (
              <select
                value={assignedHex || ""}
                onChange={e => onAssign(unit, e.target.value ? parseInt(e.target.value) : null, assignedHex ? parseInt(assignedHex) : null)}
                style={{
                  background: C.panel, border: `1px solid ${C.border}`,
                  color: C.text, fontSize: 10, padding: "4px 6px", borderRadius: 3,
                  cursor: "pointer",
                }}
              >
                <option value="">配置しない</option>
                {ALL_HEX_IDS.map(id => (
                  <option key={id} value={id}>HEX {id}</option>
                ))}
              </select>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────────
export default function MerchantMoveProto() {
  const [turn, setTurn] = useState(1);
  const [gold, setGold] = useState(8);
  const [markets, setMarkets] = useState(() => generateMarkets());
  const [assignments, setAssignments] = useState({}); // { hexId: [unit, ...] }
  const [phase, setPhase] = useState("assign"); // assign | result
  const [turnResults, setTurnResults] = useState([]); // [{hexId, unit, income, market}]
  const [log, setLog] = useState([]);
  const [units] = useState(UNIT_DEFS.slice(0, 4)); // 4体

  // ユニット配置
  const handleAssign = useCallback((unit, newHexId, oldHexId) => {
    setAssignments(prev => {
      const next = { ...prev };
      // 旧HEXから削除
      if (oldHexId !== null) {
        next[oldHexId] = (next[oldHexId] || []).filter(u => u.id !== unit.id);
        if (next[oldHexId].length === 0) delete next[oldHexId];
      }
      // 新HEXへ追加
      if (newHexId !== null) {
        next[newHexId] = [...(next[newHexId] || []), unit];
      }
      return next;
    });
  }, []);

  const handleRemove = useCallback((unitId, hexId) => {
    setAssignments(prev => {
      const next = { ...prev };
      next[hexId] = (next[hexId] || []).filter(u => u.id !== unitId);
      if (next[hexId].length === 0) delete next[hexId];
      return next;
    });
  }, []);

  // 結果確定
  const resolve = useCallback(() => {
    const results = [];
    let totalIncome = 0;

    Object.entries(assignments).forEach(([hexId, units]) => {
      const market = markets[parseInt(hexId)];
      units.forEach(unit => {
        const isEmpty = market.riskRate > 0 && Math.random() < market.riskRate;
        const income = isEmpty ? 0 : rollIncome(market);
        results.push({ hexId: parseInt(hexId), unit, income, market, isEmpty });
        totalIncome += income;
      });
    });

    setTurnResults(results);
    setGold(g => g + totalIncome);
    setLog(prev => [{
      turn,
      results,
      totalIncome,
      assignedCount: Object.values(assignments).flat().length,
      unassignedCount: units.length - Object.values(assignments).flat().length,
    }, ...prev.slice(0, 9)]);
    setPhase("result");
  }, [assignments, markets, turn, units]);

  // 次のターン
  const nextTurn = useCallback(() => {
    setTurn(t => t + 1);
    setMarkets(generateMarkets());
    setAssignments({});
    setTurnResults([]);
    setPhase("assign");
  }, []);

  // HEXごとの結果をまとめる
  const resultsByHex = {};
  turnResults.forEach(r => {
    if (!resultsByHex[r.hexId]) resultsByHex[r.hexId] = [];
    resultsByHex[r.hexId].push(r);
  });

  const turnTotal = turnResults.reduce((s, r) => s + r.income, 0);
  const assignedCount = Object.values(assignments).flat().length;
  const unassigned = units.filter(u => !Object.values(assignments).flat().some(a => a.id === u.id));

  return (
    <div style={{
      minHeight: "100vh", background: C.bg, color: C.text,
      fontFamily: "'Georgia','Times New Roman',serif", padding: "20px 24px",
      backgroundImage: "radial-gradient(ellipse at 10% 20%, rgba(56,200,160,0.04) 0%, transparent 50%), radial-gradient(ellipse at 90% 80%, rgba(212,168,32,0.04) 0%, transparent 50%)",
    }}>

      {/* HEADER */}
      <div style={{ textAlign: "center", marginBottom: 20, borderBottom: `1px solid ${C.border}`, paddingBottom: 14 }}>
        <div style={{ fontSize: 9, letterSpacing: "0.6em", color: C.textDim, marginBottom: 4 }}>MERCHANT MOVEMENT PROTOTYPE — GDD v1.18</div>
        <h1 style={{ fontSize: 17, fontWeight: "normal", margin: "0 0 4px", letterSpacing: "0.1em", color: "#b8d8d0" }}>
          💰 商人　内政ユニット移動システム
        </h1>
        <div style={{ fontSize: 10, color: C.textDim }}>
          毎ターン市況が変わる。ユニットを儲かるHEXに配置して稼ぐ。都市収入は廃止。
        </div>
      </div>

      {/* STATUS BAR */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
        <div style={{ ...panelS, padding: "8px 16px", display: "flex", gap: 20, alignItems: "center", flex: 1 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 9, color: C.textDim }}>ターン</div>
            <div style={{ fontSize: 22, color: C.text, fontFamily: "monospace" }}>{turn} <span style={{ fontSize: 11, color: C.textDim }}>/ 25</span></div>
          </div>
          <div style={{ width: 1, height: 36, background: C.border }} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 9, color: C.textDim }}>所持金</div>
            <div style={{ fontSize: 22, color: C.gold, fontFamily: "monospace" }}>{gold}</div>
          </div>
          <div style={{ width: 1, height: 36, background: C.border }} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 9, color: C.textDim }}>配置済</div>
            <div style={{ fontSize: 22, color: C.merchant, fontFamily: "monospace" }}>{assignedCount} <span style={{ fontSize: 11, color: C.textDim }}>/ {units.length}</span></div>
          </div>
          {unassigned.length > 0 && phase === "assign" && (
            <>
              <div style={{ width: 1, height: 36, background: C.border }} />
              <div style={{ fontSize: 10, color: C.warn }}>
                ⚠ 未配置: {unassigned.map(u => u.icon + u.name).join("・")}
              </div>
            </>
          )}
          {phase === "result" && (
            <>
              <div style={{ width: 1, height: 36, background: C.border }} />
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 9, color: C.textDim }}>今ターン収入</div>
                <div style={{ fontSize: 22, color: turnTotal > 0 ? C.gold : C.danger, fontFamily: "monospace" }}>
                  {turnTotal > 0 ? `+${turnTotal}` : turnTotal}
                </div>
              </div>
            </>
          )}
        </div>

        {/* アクションボタン */}
        {phase === "assign" && (
          <button onClick={resolve} style={{
            padding: "12px 24px", cursor: "pointer", borderRadius: 4,
            background: "#0e2018", border: `1px solid ${C.merchant}`,
            color: C.merchant, fontFamily: "Georgia,serif", fontSize: 12, letterSpacing: "0.15em",
            flexShrink: 0,
          }}>
            ▶ 収入確定
          </button>
        )}
        {phase === "result" && (
          <button onClick={nextTurn} style={{
            padding: "12px 24px", cursor: "pointer", borderRadius: 4,
            background: "#0a0e1a", border: `1px solid ${C.info}`,
            color: C.info, fontFamily: "Georgia,serif", fontSize: 12, letterSpacing: "0.15em",
            flexShrink: 0,
          }}>
            ▶ 次のターンへ
          </button>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr 200px", gap: 16 }}>

        {/* LEFT: ユニットプール */}
        <div>
          <UnitPool
            units={units}
            assignments={assignments}
            onAssign={handleAssign}
            phase={phase}
          />

          {/* 市況凡例 */}
          <div style={{ ...panelS, marginTop: 10 }}>
            <div style={secL}>市況の種類</div>
            {Object.values(MARKET_TYPES).map(m => (
              <div key={m.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 14, flexShrink: 0 }}>{m.icon}</span>
                <div>
                  <div style={{ fontSize: 11, color: m.color }}>{m.label}</div>
                  <div style={{ fontSize: 9, color: C.textDim, lineHeight: 1.5 }}>
                    {m.id === "risky"
                      ? `金${m.goldRange[0]}〜${m.goldRange[1]}（空振り${m.riskRate * 100}%）`
                      : `金${m.goldRange[0]}〜${m.goldRange[1]}`}
                  </div>
                </div>
              </div>
            ))}
            <div style={{ fontSize: 9, color: C.textFaint, marginTop: 6, lineHeight: 1.6, borderTop: `1px solid ${C.border}`, paddingTop: 6 }}>
              市況は毎ターン完全ランダムで変わる。<br />
              配置しないユニットの収入は0。
            </div>
          </div>
        </div>

        {/* CENTER: HEXグリッド */}
        <div>
          <div style={{ fontSize: 10, color: C.textDim, marginBottom: 10, letterSpacing: "0.1em" }}>
            ■ 今ターンの市況マップ — ユニットを配置するHEXを選択
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {ALL_HEX_IDS.map(hexId => (
              <HexCard
                key={hexId}
                hexId={hexId}
                market={markets[hexId]}
                assignedUnits={assignments[hexId] || []}
                onAssign={handleAssign}
                onRemove={handleRemove}
                phase={phase}
                result={resultsByHex[hexId] || null}
              />
            ))}
          </div>
        </div>

        {/* RIGHT: ログ */}
        <div>
          <div style={panelS}>
            <div style={secL}>収入ログ</div>
            {log.length === 0 && (
              <div style={{ fontSize: 10, color: C.textFaint, textAlign: "center", padding: "20px 0" }}>まだなし</div>
            )}
            {log.map((entry, i) => {
              const hits = entry.results.filter(r => r.income > 0).length;
              const misses = entry.results.filter(r => r.income === 0 && r.isEmpty).length;
              return (
                <div key={i} style={{
                  padding: "8px 10px", marginBottom: 6,
                  background: C.goldFaint, border: `1px solid ${C.border}`, borderRadius: 4,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: C.textDim }}>T{entry.turn}</span>
                    <span style={{ fontSize: 13, color: C.gold, fontFamily: "monospace" }}>+{entry.totalIncome} 金</span>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {entry.results.map((r, j) => (
                      <div key={j} style={{
                        fontSize: 9, padding: "2px 5px", borderRadius: 2,
                        background: r.income > 0 ? `${r.market.color}18` : `${C.danger}18`,
                        border: `1px solid ${r.income > 0 ? r.market.color : C.danger}40`,
                        color: r.income > 0 ? r.market.color : C.danger,
                      }}>
                        {r.unit.icon} {r.income > 0 ? `+${r.income}` : "空振り"}
                      </div>
                    ))}
                    {entry.unassignedCount > 0 && (
                      <div style={{ fontSize: 9, color: C.textFaint }}>
                        {entry.unassignedCount}体未配置
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 設計検証ポイント */}
          <div style={{ ...panelS, marginTop: 10 }}>
            <div style={secL}>検証ポイント</div>
            <div style={{ fontSize: 9, color: C.textDim, lineHeight: 1.8 }}>
              <div style={{ marginBottom: 6, color: C.merchant }}>✓ 意思決定の感触</div>
              <div style={{ marginBottom: 8 }}>危険HEXに賭けるか安全HEXに分散するか、判断に迷うか？</div>
              <div style={{ marginBottom: 6, color: C.warn }}>△ 収入レンジのバランス</div>
              <div style={{ marginBottom: 8 }}>好況/危険と普通/不況の差が大きすぎないか？</div>
              <div style={{ marginBottom: 6, color: C.info }}>ℹ 未配置ペナルティ</div>
              <div>配置しないと収入ゼロ。「動かす強制力」は十分か？</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
