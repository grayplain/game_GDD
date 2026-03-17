import { useState, useCallback } from "react";

// ── PALETTE ─────────────────────────────────────────────────────
const C = {
  bg: "#07090b", panel: "#0d1015", border: "#1a2028",
  text: "#c0c8d8", textDim: "#4a5568", textFaint: "#161c24",
  gold: "#d4a820", goldDim: "#7a6010", goldFaint: "#191408",
  green: "#38a860", warn: "#e8a020", danger: "#e04848", info: "#4890d8",
  merchant: "#38c8a0", random: "#9060d0", optimal: "#38c8a0",
};

// ── DEFAULT PARAMS ────────────────────────────────────────────────
const DEFAULT_PARAMS = {
  // 市況レンジ
  boomMin: 4, boomMax: 6,
  normalMin: 2, normalMax: 3,
  bustMin: 1, bustMax: 1,
  riskyMin: 6, riskyMax: 8,
  riskyRisk: 45,          // 危険HEX空振り率(%)
  // 市況分布（10HEX中の数）
  boomCount: 2,
  normalCount: 4,
  bustCount: 2,
  riskyCount: 2,
  // ユニット特性ボーナス
  // 遠隔地商人: 敵HEX×市況の組み合わせで変わる（条件付き）
  longBonusHigh: 3,       // 敵HEX × 好況/危険
  longBonusMid: 1,        // 敵HEX × 普通
  longBonusLow: 0,        // 敵HEX × 不況（敵地まで行く意味が薄い）
  brokerBonus: 2,         // 仲介商人: 同HEX同居+X
  smugglerRiskReduction: 25, // 密輸商人: 危険HEX空振り率(%)に軽減
  smugglerOwnPenalty: 1,  // 密輸商人: 自国HEX収入-X
  // 両替商: 市況ごとに最低保証が変わる（条件付き）
  exchangerBust: 3,       // 不況HEX → +3保証
  exchangerRisky: 2,      // 危険HEX → +2保証（空振り時も）
  exchangerNormal: 1,     // 普通HEX → +1保証
  exchangerBoom: 0,       // 好況HEX → 保証なし（そもそも高い）
  localBonus: 1,          // 在地商人: 普通/不況HEX+X
  // マップ構成
  ownCount: 3,
  enemyCount: 4,
  // 雇用タイムライン（何ターン目に各ユニットを雇うか、0=最初から）
  // UNIT順: 遠隔地商人, 仲介商人, 密輸商人, 両替商, 在地商人
  hireT: [1, 1, 1, 1, 1], // デフォルト: 全員T1から
  // シミュレーション
  trials: 500,
  turns: 25,
  targetGold: 60,
  // 部分情報公開
  revealCount: 2,   // 毎ターン公開するHEX数（0=全非公開、10=全公開）
};

const UNIT_META = [
  { id: "long",      name: "遠隔地商人", icon: "🧳", color: "#d4a820" },
  { id: "broker",    name: "仲介商人",   icon: "🤝", color: "#4890d8" },
  { id: "smuggler",  name: "密輸商人",   icon: "🗝",  color: "#c878d4" },
  { id: "exchanger", name: "両替商",     icon: "⚖️", color: "#78a8e8" },
  { id: "local",     name: "在地商人",   icon: "🏘",  color: "#a8c870" },
];

// ── HELPERS ──────────────────────────────────────────────────────
function rollRange(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function buildPool(p) {
  const entries = [
    ...Array(p.boomCount).fill({ id: "boom",   goldRange: [p.boomMin,   p.boomMax],   riskRate: 0 }),
    ...Array(p.normalCount).fill({ id: "normal", goldRange: [p.normalMin, p.normalMax], riskRate: 0 }),
    ...Array(p.bustCount).fill({ id: "bust",   goldRange: [p.bustMin,   p.bustMax],   riskRate: 0 }),
    ...Array(p.riskyCount).fill({ id: "risky",  goldRange: [p.riskyMin,  p.riskyMax],  riskRate: p.riskyRisk / 100 }),
  ];
  // 合計が10になるよう調整（余りはnormal）
  while (entries.length < 10) entries.push({ id: "normal", goldRange: [p.normalMin, p.normalMax], riskRate: 0 });
  return entries.slice(0, 10);
}

function generateHexes(p) {
  const neutralCount = Math.max(0, 10 - p.ownCount - p.enemyCount);
  const types = [
    ...Array(p.ownCount).fill("own"),
    ...Array(p.enemyCount).fill("enemy"),
    ...Array(neutralCount).fill("neutral"),
  ];
  const pool = buildPool(p).sort(() => Math.random() - 0.5);
  // 敵HEXは危険/好況市況が出やすい調整
  const hexes = types.map((type, i) => ({ type, ...pool[i] }));
  // 敵HEXに危険/好況を優先的に割り当て（簡易的に入れ替え）
  const enemyIdxs = hexes.map((h, i) => h.type === "enemy" ? i : -1).filter(i => i >= 0);
  const richIdxs  = hexes.map((h, i) => (h.id === "risky" || h.id === "boom") ? i : -1).filter(i => i >= 0);
  richIdxs.slice(0, enemyIdxs.length).forEach((ri, k) => {
    if (k < enemyIdxs.length) {
      const ei = enemyIdxs[k];
      if (hexes[ei].id !== "risky" && hexes[ei].id !== "boom") {
        [hexes[ri], hexes[ei]] = [hexes[ei], hexes[ri]];
      }
    }
  });
  return hexes;
}

// 同一HEXにいるユニットIDセットを返す（自分以外）
function companionsAt(myIdx, myUnitId, allAssignments) {
  return allAssignments
    .filter(a => a.hexIdx === myIdx && a.unitId !== myUnitId)
    .map(a => a.unitId);
}

function calcIncome(unitId, hex, allAssignments, myIdx, p) {
  const { goldRange, riskRate, id: marketId, type: hexType } = hex;

  const baseRoll = () => {
    if (riskRate > 0 && Math.random() < riskRate) return 0;
    return rollRange(goldRange[0], goldRange[1]);
  };

  const companions = companionsAt(myIdx, unitId, allAssignments);

  switch (unitId) {
    case "long": {
      const base = baseRoll();
      if (hexType !== "enemy") return base;
      const bonus = marketId === "boom" || marketId === "risky" ? p.longBonusHigh
                  : marketId === "normal" ? p.longBonusMid
                  : p.longBonusLow;
      return base + bonus;
    }
    case "broker": {
      const base = baseRoll();
      const hasCompanion = companions.length > 0;
      // 相互作用B：両替商と同居 → 仲介商人の同居ボーナス+1
      const synBonus = companions.includes("exchanger") ? 1 : 0;
      return base + (hasCompanion ? p.brokerBonus + synBonus : 0);
    }
    case "smuggler": {
      if (marketId === "risky") {
        const miss = Math.random() < p.smugglerRiskReduction / 100;
        if (miss) return 0;
        return rollRange(goldRange[0], goldRange[1]);
      }
      const base = baseRoll();
      return hexType === "own" ? Math.max(0, base - p.smugglerOwnPenalty) : base;
    }
    case "exchanger": {
      const base = baseRoll();
      const guarantee = marketId === "bust"   ? p.exchangerBust
                      : marketId === "risky"  ? p.exchangerRisky
                      : marketId === "normal" ? p.exchangerNormal
                      : p.exchangerBoom;
      // 相互作用B：仲介商人と同居 → 両替商の保証値+1
      // 相互作用C：在地商人と同居 → 両替商の保証値+1
      const synBonus = (companions.includes("broker") ? 1 : 0)
                     + (companions.includes("local")  ? 1 : 0);
      return Math.max(guarantee + synBonus, base);
    }
    case "local": {
      const base = baseRoll();
      const baseBonus = (marketId === "normal" || marketId === "bust") ? p.localBonus : 0;
      // 相互作用C：両替商と同居 → 在地商人のボーナス+1（普通/不況HEXで有効）
      const synBonus = companions.includes("exchanger") && (marketId === "normal" || marketId === "bust") ? 1 : 0;
      return base + baseBonus + synBonus;
    }
    default: return baseRoll();
  }
}

// 相互作用を考慮した期待値（同HEXに誰がいるかを渡す）
function expectedValue(hex, unitId, p, companions = []) {
  const { goldRange, riskRate, id: marketId, type: hexType } = hex;
  const baseMean = (goldRange[0] + goldRange[1]) / 2 * (1 - riskRate);
  switch (unitId) {
    case "long": {
      if (hexType !== "enemy") return baseMean;
      const bonus = marketId === "boom" || marketId === "risky" ? p.longBonusHigh
                  : marketId === "normal" ? p.longBonusMid
                  : p.longBonusLow;
      return baseMean + bonus;
    }
    case "broker": {
      const hasCompanion = companions.length > 0;
      const synBonus = companions.includes("exchanger") ? 1 : 0;
      return baseMean + (hasCompanion ? p.brokerBonus + synBonus : 0);
    }
    case "smuggler": return marketId === "risky"
      ? (goldRange[0] + goldRange[1]) / 2 * (1 - p.smugglerRiskReduction / 100)
      : baseMean - (hexType === "own" ? p.smugglerOwnPenalty * 0.5 : 0);
    case "exchanger": {
      const guarantee = marketId === "bust"   ? p.exchangerBust
                      : marketId === "risky"  ? p.exchangerRisky
                      : marketId === "normal" ? p.exchangerNormal
                      : p.exchangerBoom;
      const synBonus = (companions.includes("broker") ? 1 : 0)
                     + (companions.includes("local")  ? 1 : 0);
      return Math.max(guarantee + synBonus, baseMean);
    }
    case "local": {
      const baseBonus = (marketId === "normal" || marketId === "bust") ? p.localBonus : 0;
      const synBonus = companions.includes("exchanger") && (marketId === "normal" || marketId === "bust") ? 1 : 0;
      return baseMean + baseBonus + synBonus;
    }
    default: return baseMean;
  }
}

function optimalTarget(unitId, hexes, assignments, p) {
  // 現在の割り当てから各HEXの同居ユニットを取得するヘルパー
  const getCompanions = (hexIdx, excludeId) =>
    assignments.filter(a => a.hexIdx === hexIdx && a.unitId !== excludeId).map(a => a.unitId);

  switch (unitId) {
    case "long":
      return hexes.reduce((best, h, i) => {
        const ev = expectedValue(h, "long", p, getCompanions(i, "long"));
        return ev > expectedValue(hexes[hexes.indexOf(best)], "long", p, getCompanions(hexes.indexOf(best), "long")) ? h : best;
      });
    case "broker": {
      // 両替商がいるHEXを優先（相互作用B）、次に誰かがいるHEX
      const withExchanger = hexes.filter((h, i) => getCompanions(i, "broker").includes("exchanger"));
      const withAnyone    = hexes.filter((h, i) => getCompanions(i, "broker").length > 0);
      const pool = withExchanger.length > 0 ? withExchanger : withAnyone.length > 0 ? withAnyone : hexes;
      return pool.reduce((best, h, i) => {
        const hi = hexes.indexOf(h), bi = hexes.indexOf(best);
        return expectedValue(h, "broker", p, getCompanions(hi, "broker")) >
               expectedValue(best, "broker", p, getCompanions(bi, "broker")) ? h : best;
      });
    }
    case "smuggler": {
      const risky = hexes.filter(h => h.id === "risky");
      if (risky.length > 0) return risky[0];
      const nonOwn = hexes.filter(h => h.type !== "own");
      const pool = nonOwn.length > 0 ? nonOwn : hexes;
      return pool.reduce((best, h) => expectedValue(h, "smuggler", p) > expectedValue(best, "smuggler", p) ? h : best);
    }
    case "exchanger": {
      // 在地商人 or 仲介商人がいる不況/危険HEXを優先（相互作用B・C）
      return hexes.reduce((best, h, i) => {
        const hi = hexes.indexOf(h), bi = hexes.indexOf(best);
        return expectedValue(h, "exchanger", p, getCompanions(hi, "exchanger")) >
               expectedValue(best, "exchanger", p, getCompanions(bi, "exchanger")) ? h : best;
      });
    }
    case "local": {
      // 両替商がいる普通/不況HEXを優先（相互作用C）
      const withExchangerOnGood = hexes.filter((h, i) =>
        (h.id === "normal" || h.id === "bust") && getCompanions(i, "local").includes("exchanger")
      );
      if (withExchangerOnGood.length > 0) return withExchangerOnGood[0];
      const normal = hexes.filter(h => h.id === "normal");
      if (normal.length > 0) return normal[0];
      const bust = hexes.filter(h => h.id === "bust");
      return bust.length > 0 ? bust[0] : hexes[0];
    }
    default: return hexes[0];
  }
}

// ── 部分情報最適配置 ────────────────────────────────────────────
// 公開HEXは実際の市況で評価、非公開HEXは期待値（中央値）で評価
function partialOptimalTarget(unitId, hexes, assignments, p, revealedIdxs) {
  // 非公開HEXは「期待値用の仮市況」に差し替えたコピーを作る
  const visibleHexes = hexes.map((h, i) => {
    if (revealedIdxs.has(i)) return h; // 公開：実際の市況
    // 非公開：市況分布の期待値として"normal"を仮置き（中間的な値）
    return {
      ...h,
      id: "normal",
      goldRange: [p.normalMin, p.normalMax],
      riskRate: 0,
      _hidden: true,
    };
  });
  // visibleHexes上で最適なhexを特定し、元のhexes上の対応indexを返す
  const bestVisible = optimalTarget(unitId, visibleHexes, assignments, p);
  const visibleIdx = visibleHexes.indexOf(bestVisible);
  return hexes[visibleIdx];
}

// ── MONTE CARLO（3戦略比較） ──────────────────────────────────────
function runMonteCarlo(p) {
  const { trials, turns, revealCount } = p;
  const randomTotals = [], optimalTotals = [], partialTotals = [];
  const perTurnR = Array(turns).fill(0);
  const perTurnO = Array(turns).fill(0);
  const perTurnP = Array(turns).fill(0);

  for (let t = 0; t < trials; t++) {
    let gR = 0, gO = 0, gP = 0;
    for (let turn = 1; turn <= turns; turn++) {
      const activeUnits = UNIT_META.filter((_, i) => p.hireT[i] <= turn);
      const hexes = generateHexes(p);

      // 公開HEXをランダムに決定
      const allIdxs = Array.from({ length: hexes.length }, (_, i) => i);
      const shuffled = allIdxs.sort(() => Math.random() - 0.5);
      const revealedIdxs = new Set(shuffled.slice(0, Math.min(revealCount, hexes.length)));

      // ── ランダム戦略 ──
      let rInc = 0;
      const rAssign = activeUnits.map((u, i) => ({
        unitId: u.id, hexIdx: Math.floor(Math.random() * hexes.length)
      }));
      activeUnits.forEach((u, i) => {
        rInc += calcIncome(u.id, hexes[rAssign[i].hexIdx], rAssign, rAssign[i].hexIdx, p);
      });
      gR += rInc;
      perTurnR[turn - 1] += rInc;

      // ── 全情報最適戦略 ──
      let oInc = 0;
      const oAssign = [];
      const ordered = [...activeUnits].sort((a, b) => a.id === "broker" ? 1 : b.id === "broker" ? -1 : 0);
      ordered.forEach(u => {
        const hexIdx = hexes.indexOf(optimalTarget(u.id, hexes, oAssign, p));
        oAssign.push({ unitId: u.id, hexIdx });
      });
      activeUnits.forEach(u => {
        const a = oAssign.find(x => x.unitId === u.id);
        oInc += calcIncome(u.id, hexes[a?.hexIdx ?? 0], oAssign, a?.hexIdx ?? 0, p);
      });
      gO += oInc;
      perTurnO[turn - 1] += oInc;

      // ── 部分情報最適戦略 ──
      let pInc = 0;
      const pAssign = [];
      const orderedP = [...activeUnits].sort((a, b) => a.id === "broker" ? 1 : b.id === "broker" ? -1 : 0);
      orderedP.forEach(u => {
        const bestHex = partialOptimalTarget(u.id, hexes, pAssign, p, revealedIdxs);
        const hexIdx = hexes.indexOf(bestHex);
        pAssign.push({ unitId: u.id, hexIdx: hexIdx >= 0 ? hexIdx : 0 });
      });
      activeUnits.forEach(u => {
        const a = pAssign.find(x => x.unitId === u.id);
        pInc += calcIncome(u.id, hexes[a?.hexIdx ?? 0], pAssign, a?.hexIdx ?? 0, p);
      });
      gP += pInc;
      perTurnP[turn - 1] += pInc;
    }
    randomTotals.push(gR);
    optimalTotals.push(gO);
    partialTotals.push(gP);
  }

  const stats = arr => {
    const s = [...arr].sort((a, b) => a - b);
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    return {
      mean: Math.round(mean * 10) / 10,
      p10: s[Math.floor(s.length * .1)],
      p25: s[Math.floor(s.length * .25)],
      p50: s[Math.floor(s.length * .5)],
      p75: s[Math.floor(s.length * .75)],
      p90: s[Math.floor(s.length * .9)],
      min: s[0], max: s[s.length - 1],
    };
  };

  let cumR = 0, cumO = 0, cumP = 0;
  const cumulative = Array(turns).fill(0).map((_, i) => {
    cumR += perTurnR[i] / trials;
    cumO += perTurnO[i] / trials;
    cumP += perTurnP[i] / trials;
    return { turn: i + 1, random: Math.round(cumR), optimal: Math.round(cumO), partial: Math.round(cumP) };
  });

  const unitTimeline = Array(turns).fill(0).map((_, i) =>
    UNIT_META.filter((_, j) => p.hireT[j] <= i + 1).length
  );

  const rStats = stats(randomTotals);
  const oStats = stats(optimalTotals);
  const pStats = stats(partialTotals);

  const pctFull    = Math.round((oStats.mean - rStats.mean) / rStats.mean * 100);
  const pctPartial = Math.round((pStats.mean - rStats.mean) / rStats.mean * 100);
  const infoLoss   = Math.round((oStats.mean - pStats.mean) / oStats.mean * 100);

  return {
    random: rStats, optimal: oStats, partial: pStats,
    improvement: {
      full:    { diff: Math.round((oStats.mean - rStats.mean) * 10) / 10, pct: pctFull },
      partial: { diff: Math.round((pStats.mean - rStats.mean) * 10) / 10, pct: pctPartial },
      infoLoss,  // 情報不完全による損失率
    },
    cumulative, unitTimeline,
  };
}

// ── UI PARTS ──────────────────────────────────────────────────────
const panelS = { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 5, padding: 12, marginBottom: 10 };
const secL = { fontSize: 9, color: C.textDim, letterSpacing: ".2em", marginBottom: 8, borderBottom: `1px solid ${C.border}`, paddingBottom: 5 };

function Slider({ label, value, onChange, min, max, step = 1, unit = "", color = C.gold }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: 10, color: C.textDim }}>{label}</span>
        <span style={{ fontSize: 11, color, fontFamily: "monospace", minWidth: 36, textAlign: "right" }}>{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: color, cursor: "pointer", height: 3 }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, color: C.textFaint, marginTop: 1 }}>
        <span>{min}{unit}</span><span>{max}{unit}</span>
      </div>
    </div>
  );
}

function TurnSlider({ label, value, onChange, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
      <span style={{ fontSize: 11 }}>{color === "#d4a820" ? "🧳" : color === "#4890d8" ? "🤝" : color === "#c878d4" ? "🗝" : color === "#78a8e8" ? "⚖️" : "🏘"}</span>
      <span style={{ fontSize: 10, color, flex: 1, minWidth: 64 }}>{label}</span>
      <input type="range" min={1} max={25} step={1} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ flex: 2, accentColor: color, cursor: "pointer", height: 3 }}
      />
      <span style={{ fontSize: 11, color, fontFamily: "monospace", minWidth: 24, textAlign: "right" }}>T{value}</span>
    </div>
  );
}

function CumulativeChart({ data, unitTimeline, targetGold }) {
  if (!data?.length) return null;
  const maxG = Math.max(...data.map(d => d.optimal), targetGold) * 1.08;
  const W = 500, H = 160, pad = { l: 36, r: 24, t: 16, b: 24 };
  const iW = W - pad.l - pad.r, iH = H - pad.t - pad.b;
  const xs = t => pad.l + (t - 1) / (data.length - 1) * iW;
  const ys = v => pad.t + iH - (v / maxG) * iH;
  const pathFor = k => data.map((d, i) => `${i === 0 ? "M" : "L"}${xs(d.turn).toFixed(1)},${ys(d[k]).toFixed(1)}`).join(" ");
  const tY = ys(targetGold);
  const changePoints = unitTimeline.reduce((acc, n, i) => {
    if (i === 0 || n !== unitTimeline[i - 1]) acc.push({ turn: i + 1, count: n });
    return acc;
  }, []);
  return (
    <svg width={W} height={H} style={{ overflow: "visible" }}>
      {[0, .25, .5, .75, 1].map(f => {
        const y = pad.t + iH * (1 - f);
        return <g key={f}>
          <line x1={pad.l} y1={y} x2={W - pad.r} y2={y} stroke={C.border} strokeWidth={0.5} />
          <text x={pad.l - 4} y={y + 4} fontSize={8} fill={C.textDim} textAnchor="end">{Math.round(maxG * f)}</text>
        </g>;
      })}
      {changePoints.map(({ turn, count }) => (
        <g key={turn}>
          <line x1={xs(turn)} y1={pad.t} x2={xs(turn)} y2={pad.t + iH} stroke={C.merchant} strokeWidth={0.8} strokeDasharray="3,3" opacity={0.3} />
          <text x={xs(turn)} y={pad.t - 2} fontSize={7} fill={C.merchant} textAnchor="middle" opacity={0.6}>{count}体</text>
        </g>
      ))}
      <line x1={pad.l} y1={tY} x2={W - pad.r} y2={tY} stroke={C.danger} strokeWidth={1} strokeDasharray="4,3" opacity={0.7} />
      <text x={W - pad.r + 2} y={tY + 4} fontSize={8} fill={C.danger}>目標</text>
      {[1, 5, 10, 15, 20, 25].map(t => {
        const d = data[t - 1]; if (!d) return null;
        return <text key={t} x={xs(t)} y={H - 4} fontSize={8} fill={C.textDim} textAnchor="middle">T{t}</text>;
      })}
      <path d={pathFor("random")} fill="none" stroke={C.random} strokeWidth={1.5} opacity={0.6} />
      <path d={pathFor("partial")} fill="none" stroke="#e8a020" strokeWidth={2} strokeDasharray="6,3" />
      <path d={pathFor("optimal")} fill="none" stroke={C.optimal} strokeWidth={2} />
      <rect x={pad.l + 4} y={pad.t + 2} width={8} height={3} fill={C.optimal} />
      <text x={pad.l + 14} y={pad.t + 8} fontSize={9} fill={C.optimal}>全情報</text>
      <rect x={pad.l + 52} y={pad.t + 2} width={8} height={3} fill="#e8a020" />
      <text x={pad.l + 62} y={pad.t + 8} fontSize={9} fill="#e8a020">部分情報</text>
      <rect x={pad.l + 112} y={pad.t + 2} width={8} height={3} fill={C.random} opacity={0.6} />
      <text x={pad.l + 122} y={pad.t + 8} fontSize={9} fill={C.random} opacity={0.8}>ランダム</text>
    </svg>
  );
}

function StatBar({ stats, color, label, target }) {
  const maxV = stats.max * 1.05;
  const sc = v => Math.min(100, v / maxV * 100);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: 10, color }}>{label}</span>
        <span style={{ fontSize: 12, color, fontFamily: "monospace" }}>平均 {Math.round(stats.mean)}</span>
      </div>
      <div style={{ position: "relative", height: 16, background: C.goldFaint, borderRadius: 2 }}>
        <div style={{ position: "absolute", top: 2, height: 12, left: `${sc(stats.min)}%`, width: `${Math.max(1, sc(stats.max) - sc(stats.min))}%`, background: `${color}20`, borderRadius: 1 }} />
        <div style={{ position: "absolute", top: 0, height: 16, left: `${sc(stats.p25)}%`, width: `${Math.max(1, sc(stats.p75) - sc(stats.p25))}%`, background: `${color}55`, borderRadius: 1 }} />
        <div style={{ position: "absolute", top: -1, width: 2, height: 18, left: `${sc(stats.mean)}%`, background: color, borderRadius: 1 }} />
        <div style={{ position: "absolute", top: -2, width: 1, height: 20, left: `${sc(target)}%`, background: C.danger, opacity: 0.7 }} />
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 2 }}>
        {[["p10", "10%"], ["p25", "25%"], ["p50", "中央"], ["p75", "75%"], ["p90", "90%"]].map(([k, l]) => (
          <div key={k} style={{ fontSize: 9, color: C.textDim }}>{l}:<span style={{ color: stats[k] >= target ? color : C.warn, fontFamily: "monospace", marginLeft: 2 }}>{stats[k]}</span></div>
        ))}
      </div>
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────────
export default function MerchantUnitSimV2() {
  const [p, setP] = useState(DEFAULT_PARAMS);
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [activeTab, setActiveTab] = useState("market");

  const set = (key, val) => setP(prev => ({ ...prev, [key]: val }));
  const setHireT = (idx, val) => setP(prev => {
    const next = [...prev.hireT];
    next[idx] = val;
    return { ...prev, hireT: next };
  });

  const run = useCallback(() => {
    setRunning(true);
    setTimeout(() => {
      setResult(runMonteCarlo(p));
      setRunning(false);
    }, 80);
  }, [p]);

  const pctPartialColor = result
    ? result.improvement.partial.pct >= 20 ? C.green
    : result.improvement.partial.pct >= 10 ? C.warn
    : C.danger
    : C.textDim;

  // 雇用タイムライン表示
  const hireSummary = UNIT_META.map((u, i) => ({ ...u, hireT: p.hireT[i] })).sort((a, b) => a.hireT - b.hireT);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Georgia','Times New Roman',serif", padding: "20px 24px" }}>
      <div style={{ textAlign: "center", marginBottom: 18, borderBottom: `1px solid ${C.border}`, paddingBottom: 12 }}>
        <div style={{ fontSize: 9, letterSpacing: ".6em", color: C.textDim, marginBottom: 3 }}>MERCHANT UNIT PLACEMENT v6 — PARTIAL INFO</div>
        <h1 style={{ fontSize: 16, fontWeight: "normal", margin: "0 0 3px", color: "#b8d8d0", letterSpacing: ".1em" }}>💰 内政ユニット配置シミュレーター v6</h1>
        <div style={{ fontSize: 9, color: C.textDim }}>部分情報公開（N個だけ公開）＋ 3戦略比較：ランダム / 部分情報最適 / 全情報最適</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "230px 1fr", gap: 16 }}>

        {/* LEFT: CONTROLS */}
        <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 120px)" }}>

          {/* タブ */}
          <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
            {[["market", "市況"], ["units", "ユニット"], ["hire", "雇用"], ["sim", "実行"]].map(([k, l]) => (
              <button key={k} onClick={() => setActiveTab(k)} style={{
                flex: 1, padding: "5px 0", cursor: "pointer", borderRadius: 3, fontSize: 10,
                background: activeTab === k ? C.goldFaint : "transparent",
                border: `1px solid ${activeTab === k ? C.goldDim : C.border}`,
                color: activeTab === k ? C.gold : C.textDim,
                fontFamily: "Georgia,serif",
              }}>{l}</button>
            ))}
          </div>

          {/* 市況設定 */}
          {activeTab === "market" && (
            <div style={panelS}>
              <div style={secL}>市況レンジ・リスク</div>
              <div style={{ fontSize: 9, color: C.textDim, marginBottom: 8 }}>好況📈</div>
              <Slider label="最小収入" value={p.boomMin} onChange={v => set("boomMin", Math.min(v, p.boomMax))} min={1} max={8} color="#38a860" />
              <Slider label="最大収入" value={p.boomMax} onChange={v => set("boomMax", Math.max(v, p.boomMin))} min={1} max={12} color="#38a860" />
              <div style={{ fontSize: 9, color: C.textDim, marginBottom: 8, marginTop: 8 }}>普通🏪</div>
              <Slider label="最小" value={p.normalMin} onChange={v => set("normalMin", Math.min(v, p.normalMax))} min={1} max={6} color={C.info} />
              <Slider label="最大" value={p.normalMax} onChange={v => set("normalMax", Math.max(v, p.normalMin))} min={1} max={8} color={C.info} />
              <div style={{ fontSize: 9, color: C.textDim, marginBottom: 8, marginTop: 8 }}>不況📉</div>
              <Slider label="最小" value={p.bustMin} onChange={v => set("bustMin", Math.min(v, p.bustMax))} min={0} max={3} color={C.warn} />
              <Slider label="最大" value={p.bustMax} onChange={v => set("bustMax", Math.max(v, p.bustMin))} min={0} max={4} color={C.warn} />
              <div style={{ fontSize: 9, color: C.textDim, marginBottom: 8, marginTop: 8 }}>危険⚠️</div>
              <Slider label="最小収入" value={p.riskyMin} onChange={v => set("riskyMin", Math.min(v, p.riskyMax))} min={2} max={10} color={C.danger} />
              <Slider label="最大収入" value={p.riskyMax} onChange={v => set("riskyMax", Math.max(v, p.riskyMin))} min={2} max={14} color={C.danger} />
              <Slider label="空振り率" value={p.riskyRisk} onChange={v => set("riskyRisk", v)} min={5} max={80} step={5} unit="%" color={C.danger} />
              <div style={{ fontSize: 9, color: C.textDim, marginBottom: 8, marginTop: 10 }}>市況分布（合計10HEX）</div>
              {[["好況", "boomCount", "#38a860"], ["普通", "normalCount", C.info], ["不況", "bustCount", C.warn], ["危険", "riskyCount", C.danger]].map(([l, k, col]) => (
                <Slider key={k} label={l} value={p[k]} onChange={v => set(k, v)} min={0} max={6} color={col} />
              ))}
              <div style={{ fontSize: 9, color: p.boomCount + p.normalCount + p.bustCount + p.riskyCount === 10 ? C.green : C.warn, marginTop: 4 }}>
                合計: {p.boomCount + p.normalCount + p.bustCount + p.riskyCount} / 10
                {p.boomCount + p.normalCount + p.bustCount + p.riskyCount !== 10 && " ⚠ 10にしてください"}
              </div>
              <div style={{ fontSize: 9, color: C.textDim, marginTop: 8 }}>マップ構成</div>
              <Slider label="自国HEX数" value={p.ownCount} onChange={v => set("ownCount", v)} min={1} max={7} color={C.merchant} />
              <Slider label="敵国HEX数" value={p.enemyCount} onChange={v => set("enemyCount", v)} min={1} max={7} color={C.danger} />
              <div style={{ fontSize: 9, color: C.textDim, marginTop: 3 }}>中立: {Math.max(0, 10 - p.ownCount - p.enemyCount)} HEX</div>

              {/* 部分情報公開 */}
              <div style={{ marginTop: 12, padding: "8px 10px", background: `${C.warn}0a`, border: `1px solid ${C.warn}30`, borderRadius: 3 }}>
                <div style={{ fontSize: 9, color: C.warn, marginBottom: 6 }}>👁 部分情報公開（核心設定）</div>
                <Slider label="公開HEX数 / ターン" value={p.revealCount} onChange={v => set("revealCount", v)} min={0} max={10} color={C.warn} />
                <div style={{ fontSize: 9, color: C.textDim, lineHeight: 1.7, marginTop: 4 }}>
                  {p.revealCount === 0 && "0 = 全HEXの市況が不明。完全ブラインドで配置する。"}
                  {p.revealCount > 0 && p.revealCount < 10 && `${p.revealCount} = 毎ターンランダムに${p.revealCount}個だけ市況が公開。残り${10 - p.revealCount}個は不明。`}
                  {p.revealCount === 10 && "10 = 全HEXの市況が完全公開。理論上の全情報最適と同じ。"}
                </div>
                <div style={{ fontSize: 8, color: C.textFaint, marginTop: 4, lineHeight: 1.5 }}>
                  部分情報最適 ≈ ランダム → 差がない（情報が少なすぎる）<br />
                  部分情報最適 ≈ 全情報最適 → プレイヤー判断の余地が減る<br />
                  目標：部分情報最適がランダムより+20〜35%上回る公開数を探す
                </div>
              </div>
            </div>
          )}

          {/* ユニット特性 */}
          {activeTab === "units" && (
            <div style={panelS}>
              <div style={secL}>ユニット特性ボーナス</div>

              <div style={{ fontSize: 9, color: "#d4a820", marginBottom: 4 }}>🧳 遠隔地商人（条件付き）</div>
              <div style={{ fontSize: 8, color: C.textFaint, marginBottom: 6, lineHeight: 1.5 }}>
                敵HEX × 市況の組み合わせでボーナスが変わる
              </div>
              <Slider label="敵HEX × 好況/危険 +X" value={p.longBonusHigh} onChange={v => set("longBonusHigh", v)} min={0} max={6} color="#d4a820" />
              <Slider label="敵HEX × 普通 +X" value={p.longBonusMid} onChange={v => set("longBonusMid", v)} min={0} max={4} color="#d4a820" />
              <Slider label="敵HEX × 不況 +X" value={p.longBonusLow} onChange={v => set("longBonusLow", v)} min={0} max={3} color="#d4a820" />

              <div style={{ fontSize: 9, color: "#4890d8", marginBottom: 4, marginTop: 10 }}>🤝 仲介商人</div>
              <Slider label="同居ボーナス +X" value={p.brokerBonus} onChange={v => set("brokerBonus", v)} min={0} max={6} color="#4890d8" />

              <div style={{ fontSize: 9, color: "#c878d4", marginBottom: 4, marginTop: 10 }}>🗝 密輸商人</div>
              <Slider label="危険HEX空振り率を%に軽減" value={p.smugglerRiskReduction} onChange={v => set("smugglerRiskReduction", v)} min={0} max={44} step={5} unit="%" color="#c878d4" />
              <Slider label="自国HEXペナルティ -X" value={p.smugglerOwnPenalty} onChange={v => set("smugglerOwnPenalty", v)} min={0} max={4} color="#c878d4" />

              <div style={{ fontSize: 9, color: "#78a8e8", marginBottom: 4, marginTop: 10 }}>⚖️ 両替商（条件付き）</div>
              <div style={{ fontSize: 8, color: C.textFaint, marginBottom: 6, lineHeight: 1.5 }}>
                市況ごとに最低保証値が変わる
              </div>
              <Slider label="不況HEX 最低保証 +X" value={p.exchangerBust} onChange={v => set("exchangerBust", v)} min={0} max={6} color="#78a8e8" />
              <Slider label="危険HEX 最低保証 +X" value={p.exchangerRisky} onChange={v => set("exchangerRisky", v)} min={0} max={5} color="#78a8e8" />
              <Slider label="普通HEX 最低保証 +X" value={p.exchangerNormal} onChange={v => set("exchangerNormal", v)} min={0} max={4} color="#78a8e8" />
              <Slider label="好況HEX 最低保証 +X" value={p.exchangerBoom} onChange={v => set("exchangerBoom", v)} min={0} max={3} color="#78a8e8" />

              <div style={{ fontSize: 9, color: "#a8c870", marginBottom: 4, marginTop: 10 }}>🏘 在地商人</div>
              <Slider label="普通/不況HEXボーナス +X" value={p.localBonus} onChange={v => set("localBonus", v)} min={0} max={4} color="#a8c870" />

              {/* 相互作用の説明 */}
              <div style={{ marginTop: 12, padding: "8px 10px", background: `${C.merchant}0a`, border: `1px solid ${C.merchant}30`, borderRadius: 3 }}>
                <div style={{ fontSize: 9, color: C.merchant, marginBottom: 5 }}>⚡ 同HEX相互作用（v4新設）</div>
                <div style={{ fontSize: 9, color: C.textDim, lineHeight: 1.8 }}>
                  <span style={{ color: "#78a8e8" }}>⚖️</span>＋<span style={{ color: "#4890d8" }}>🤝</span>
                  　両替商＋仲介商人：互いに+1（金融×仲介の相乗）<br />
                  <span style={{ color: "#a8c870" }}>🏘</span>＋<span style={{ color: "#78a8e8" }}>⚖️</span>
                  　在地商人＋両替商：在地+1・両替+1（資金効率化）<br />
                  <span style={{ fontSize: 8, color: C.textFaint }}>→「誰と誰を同じHEXに送るか」が毎ターン変わる</span>
                </div>
              </div>
            </div>
          )}

          {/* 雇用タイムライン */}
          {activeTab === "hire" && (
            <div style={panelS}>
              <div style={secL}>雇用タイムライン</div>
              <div style={{ fontSize: 9, color: C.textDim, marginBottom: 10, lineHeight: 1.6 }}>
                各ユニットを何ターン目から使用可能にするか。<br />
                T1 = ゲーム開始時から保有
              </div>
              {UNIT_META.map((u, i) => (
                <TurnSlider key={u.id} label={u.name} value={p.hireT[i]} onChange={v => setHireT(i, v)} color={u.color} />
              ))}
              <div style={{ marginTop: 12, fontSize: 9, color: C.textDim, marginBottom: 6 }}>雇用スケジュール</div>
              {hireSummary.map(u => (
                <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, padding: "4px 6px", background: `${u.color}0a`, border: `1px solid ${u.color}25`, borderRadius: 3 }}>
                  <span style={{ fontSize: 11 }}>{u.icon}</span>
                  <span style={{ fontSize: 10, color: u.color, flex: 1 }}>{u.name}</span>
                  <span style={{ fontSize: 10, color: C.textDim, fontFamily: "monospace" }}>T{u.hireT}〜</span>
                </div>
              ))}
              <div style={{ marginTop: 10, padding: "6px 8px", background: C.goldFaint, border: `1px solid ${C.border}`, borderRadius: 3, fontSize: 9, color: C.textDim, lineHeight: 1.6 }}>
                現実的なケース例：<br />
                T1 遠隔地商人（基本カードで即時雇用）<br />
                T3〜5 在地商人・両替商（序盤の安定確保）<br />
                T8〜12 密輸商人・仲介商人（中盤以降の火力）
              </div>
            </div>
          )}

          {/* 実行設定 */}
          {activeTab === "sim" && (
            <div style={panelS}>
              <div style={secL}>シミュレーション設定</div>
              <Slider label="試行回数" value={p.trials} onChange={v => set("trials", v)} min={100} max={2000} step={100} />
              <Slider label="ターン数" value={p.turns} onChange={v => set("turns", v)} min={10} max={25} step={5} />
              <Slider label="最終目標（金）" value={p.targetGold} onChange={v => set("targetGold", v)} min={20} max={150} step={5} color={C.danger} />
            </div>
          )}

          <button onClick={run} disabled={running} style={{
            width: "100%", padding: "11px 0", cursor: running ? "not-allowed" : "pointer", borderRadius: 3,
            background: running ? "transparent" : "#0e2018",
            border: `1px solid ${running ? C.border : C.merchant}`,
            color: running ? C.textDim : C.merchant,
            fontFamily: "Georgia,serif", fontSize: 12, letterSpacing: ".2em",
          }}>
            {running ? "⚙ 演算中..." : `▶ 実行（${p.trials}試行×${p.turns}T）`}
          </button>
        </div>

        {/* RIGHT: RESULTS */}
        <div>
          {!result && !running && (
            <div style={{ ...panelS, textAlign: "center", padding: "60px 20px", color: C.textDim }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
              <div style={{ fontSize: 13 }}>左のパラメータを調整して実行</div>
              <div style={{ fontSize: 10, color: C.textFaint, marginTop: 8 }}>
                目標：判断の価値 +20〜35%<br />
                最適中央値≥目標 かつ ランダム中央値 &lt; 目標
              </div>
            </div>
          )}
          {running && (
            <div style={{ ...panelS, textAlign: "center", padding: "60px 20px", color: C.textDim }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>⚙</div>
              <div>モンテカルロ演算中...</div>
            </div>
          )}

          {result && !running && (
            <>
              {/* KPI：4指標 */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
                {[
                  { label: "🎯 全情報最適 平均", value: Math.round(result.optimal.mean), color: C.optimal, sub: "理論上限" },
                  { label: `👁 部分情報（${p.revealCount}公開）平均`, value: Math.round(result.partial.mean), color: "#e8a020", sub: "実際のプレイヤー" },
                  { label: "🎲 ランダム 平均", value: Math.round(result.random.mean), color: C.random, sub: "下限" },
                  { label: "判断の価値（部分情報）", value: `+${result.improvement.partial.pct}%`, color: pctPartialColor, sub: "vs ランダム" },
                ].map(({ label, value, color, sub }) => (
                  <div key={label} style={{ ...panelS, marginBottom: 0, textAlign: "center", border: `1px solid ${color}40` }}>
                    <div style={{ fontSize: 8, color: C.textDim, marginBottom: 3 }}>{label}</div>
                    <div style={{ fontSize: 20, color, fontFamily: "monospace" }}>{value}</div>
                    <div style={{ fontSize: 8, color: C.textFaint, marginTop: 2 }}>{sub}</div>
                  </div>
                ))}
              </div>

              {/* 情報損失バー */}
              <div style={{ ...panelS, marginBottom: 12 }}>
                <div style={secL}>📊 情報公開数 {p.revealCount}/10 の影響</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: 9, color: C.textDim, width: 80 }}>情報損失率</span>
                  <div style={{ flex: 1, height: 10, background: C.goldFaint, borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${result.improvement.infoLoss}%`, background: C.warn, borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: 11, color: C.warn, fontFamily: "monospace", width: 32 }}>{result.improvement.infoLoss}%</span>
                </div>
                <div style={{ fontSize: 9, color: C.textDim, lineHeight: 1.8 }}>
                  全情報最適との差：<span style={{ color: C.warn, fontFamily: "monospace" }}>
                    {Math.round(result.optimal.mean - result.partial.mean)}金
                  </span>
                  　部分情報 vs ランダム：<span style={{ color: pctPartialColor, fontFamily: "monospace" }}>
                    +{result.improvement.partial.pct}%
                  </span>
                  　全情報 vs ランダム：<span style={{ color: C.optimal, fontFamily: "monospace" }}>
                    +{result.improvement.full.pct}%
                  </span>
                </div>
              </div>

              {/* 設計示唆 */}
              <div style={{ ...panelS, marginBottom: 12 }}>
                <div style={secL}>■ 設計示唆</div>
                {(() => {
                  const pctP = result.improvement.partial.pct;
                  const pctF = result.improvement.full.pct;
                  const infoLoss = result.improvement.infoLoss;
                  const pP50 = result.partial.p50, rP50 = result.random.p50;
                  const items = [];

                  if (pctP > 40) items.push({ l:"warn", t:`部分情報でも+${pctP}%は高すぎます。公開数${p.revealCount}個でもプレイヤーが最適手を見つけやすい状態です。公開数を減らすか、市況の種類を増やすことを検討してください。` });
                  else if (pctP >= 20) items.push({ l:"ok", t:`部分情報最適 +${pctP}%。理想帯（+20〜35%）に収まっています。公開数${p.revealCount}個が適切な情報量の目安になります。` });
                  else if (pctP >= 10) items.push({ l:"warn", t:`部分情報最適 +${pctP}%はやや低め。公開数${p.revealCount}個では情報が少なすぎて判断しにくいかもしれません。公開数を増やすことを検討してください。` });
                  else items.push({ l:"warn", t:`部分情報最適 +${pctP}%は低すぎます。ランダムとほぼ差がなく「考えても意味がない」状態です。公開数を${Math.min(10, p.revealCount + 2)}〜${Math.min(10, p.revealCount + 4)}に増やしてください。` });

                  if (infoLoss < 10) items.push({ l:"ok", t:`情報損失率${infoLoss}%は低く、部分情報でも全情報に近い判断ができています。プレイヤーが情報を活用できている状態です。` });
                  else if (infoLoss > 25) items.push({ l:"warn", t:`情報損失率${infoLoss}%。公開情報${p.revealCount}個では重要なHEXが見えないターンが多く、運の要素が大きすぎます。公開数を増やすことを推奨。` });

                  if (pP50 >= p.targetGold && rP50 < p.targetGold) items.push({ l:"ok", t:`部分情報中央値（${pP50}）≥目標（${p.targetGold}）かつランダム中央値（${rP50}）<目標。「情報を活かすとクリアできる、無視するとキツい」という設計バランスに合っています。` });

                  const sc = { ok:{ bg:`${C.green}08`, bd:`${C.green}35`, ic:"✓", cl:C.green }, warn:{ bg:`${C.warn}08`, bd:`${C.warn}35`, ic:"△", cl:C.warn } };
                  return items.map((item, i) => {
                    const s = sc[item.l];
                    return <div key={i} style={{ display:"flex", gap:7, padding:"6px 9px", marginBottom:5, background:s.bg, border:`1px solid ${s.bd}`, borderRadius:3 }}>
                      <span style={{ color:s.cl, fontSize:10, flexShrink:0 }}>{s.ic}</span>
                      <span style={{ fontSize:9, color:C.text, lineHeight:1.6 }}>{item.t}</span>
                    </div>;
                  });
                })()}
              </div>

              {/* チャート */}
              <div style={panelS}>
                <div style={secL}>📈 累積収入推移（3戦略比較 / 縦破線 = ユニット雇用タイミング）</div>
                <CumulativeChart data={result.cumulative} unitTimeline={result.unitTimeline} targetGold={p.targetGold} />
              </div>

              {/* 分布 */}
              <div style={panelS}>
                <div style={secL}>📊 {p.turns}T累積収入の分布</div>
                <StatBar stats={result.optimal} color={C.optimal} label={`全情報最適（理論上限）`} target={p.targetGold} />
                <StatBar stats={result.partial} color="#e8a020" label={`部分情報最適（${p.revealCount}個公開）`} target={p.targetGold} />
                <StatBar stats={result.random} color={C.random} label="ランダム戦略" target={p.targetGold} />
                <div style={{ fontSize: 9, color: C.textDim, marginTop: 4 }}>
                  バー = p25〜p75（中央50%）　細バー = min〜max　縦線 = 平均
                  <span style={{ color: C.danger, marginLeft: 8 }}>│ = 目標{p.targetGold}金</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
