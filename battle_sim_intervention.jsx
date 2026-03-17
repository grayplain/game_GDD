import { useState, useCallback } from "react";

// ── UNIT POOL ────────────────────────────────────────────────────
const BASE_ARMIES = {
  military: {
    label: "軍人（標準）",
    front: [
      { name: "槍兵",   hp: 14, atk: 3, morale: 6, armor: 0, upkeep: 0, traits: [] },
      { name: "盾兵",   hp: 22, atk: 1, morale: 7, armor: 2, upkeep: 0, traits: ["TANK"] },
      { name: "騎馬兵", hp: 14, atk: 5, morale: 5, armor: 0, upkeep: 0, traits: ["FIRST_STRIKE"] },
    ],
    rear: [
      { name: "弓兵",   hp: 10, atk: 4, morale: 5, armor: 0, upkeep: 0, traits: ["RANGED"] },
      { name: "司令官", hp: 12, atk: 2, morale: 10, armor: 0, upkeep: 0, traits: ["MORALE_REGEN_2"] },
    ],
  },
  merchant: {
    label: "商人（標準）",
    front: [
      { name: "槍傭兵",   hp: 12, atk: 3, morale: 3, armor: 0, upkeep: 1, traits: ["MERCENARY"] },
      { name: "重装傭兵", hp: 18, atk: 3, morale: 3, armor: 0, upkeep: 1, traits: ["MERCENARY"] },
      { name: "用心棒",   hp: 18, atk: 4, morale: 4, armor: 3, upkeep: 1, traits: ["MERCENARY"] },
    ],
    rear: [
      { name: "弓傭兵",   hp: 10, atk: 4, morale: 3, armor: 0, upkeep: 1, traits: ["MERCENARY","RANGED"] },
      { name: "交渉人",   hp: 10, atk: 1, morale: 5, armor: 0, upkeep: 1, traits: ["MERCENARY","MORALE_DRAIN_2"] },
    ],
  },
  clergy: {
    label: "宗教家（標準）",
    front: [
      { name: "狂信者",     hp: 6,  atk: 5, morale: 10, armor: 0, upkeep: 0, traits: ["BELIEVER","BERSERK"] },
      { name: "殉教者",     hp: 4,  atk: 3, morale: 10, armor: 0, upkeep: 0, traits: ["BELIEVER","MARTYR"] },
      { name: "護衛騎士団", hp: 18, atk: 4, morale: 8,  armor: 0, upkeep: 0, traits: ["SHIELD_REAR"] },
    ],
    rear: [
      { name: "修道士",   hp: 10, atk: 2, morale: 8, armor: 0, upkeep: 0, traits: ["BELIEVER","BUFF_BELIEVERS_2"] },
      { name: "一般信者", hp: 7,  atk: 2, morale: 7, armor: 0, upkeep: 0, traits: ["BELIEVER","ON_DEATH_ALLY_MORALE_1"] },
    ],
  },
};

// ── DEBUFF PRESETS ────────────────────────────────────────────────
// These represent "pre-battle intervention" card effects
const DEBUFF_PRESETS = [
  {
    id: "none",
    label: "フル状態",
    desc: "介入なし（ベースライン）",
    category: "baseline",
    mods: {},
  },
  // --- 士気系 ---
  {
    id: "morale_m2_all",
    label: "士気 全体-2",
    desc: "例：破門の脅し（権威2〜3）/ 流言飛語",
    category: "morale",
    mods: { moraleAll: -2 },
  },
  {
    id: "morale_m3_all",
    label: "士気 全体-3",
    desc: "例：破門の脅し（権威4）/ 怒号の説教",
    category: "morale",
    mods: { moraleAll: -3 },
  },
  {
    id: "morale_m4_all",
    label: "士気 全体-4",
    desc: "例：大規模工作カード",
    category: "morale",
    mods: { moraleAll: -4 },
  },
  {
    id: "morale_m2_front",
    label: "士気 前衛-3",
    desc: "例：前衛狙いの信仰扇動",
    category: "morale",
    mods: { moraleFront: -3 },
  },
  // --- HP系 ---
  {
    id: "hp_m20pct",
    label: "HP 全体-20%",
    desc: "例：兵站妨害（小）",
    category: "hp",
    mods: { hpPct: 0.80 },
  },
  {
    id: "hp_m30pct",
    label: "HP 全体-30%",
    desc: "例：兵站妨害（中）",
    category: "hp",
    mods: { hpPct: 0.70 },
  },
  {
    id: "hp_m50pct",
    label: "HP 全体-50%",
    desc: "例：兵站妨害（大）",
    category: "hp",
    mods: { hpPct: 0.50 },
  },
  // --- ATK系 ---
  {
    id: "atk_m1_all",
    label: "ATK 全体-1",
    desc: "例：補給線切断（小）",
    category: "atk",
    mods: { atkAll: -1 },
  },
  {
    id: "atk_m2_all",
    label: "ATK 全体-2",
    desc: "例：補給線切断（大）",
    category: "atk",
    mods: { atkAll: -2 },
  },
  // --- ユニット除去系 ---
  {
    id: "remove_front1",
    label: "前衛1体除去",
    desc: "例：傭兵買収（金4）/ 情報工作",
    category: "remove",
    mods: { removeFront: 1 },
  },
  {
    id: "remove_front2",
    label: "前衛2体除去",
    desc: "例：大規模買収（金8）",
    category: "remove",
    mods: { removeFront: 2 },
  },
  {
    id: "remove_rear1",
    label: "後衛1体除去",
    desc: "例：司令官狙いの暗殺工作",
    category: "remove",
    mods: { removeRear: 1 },
  },
  // --- 複合系 ---
  {
    id: "combo_morale2_atk1",
    label: "士気-2 ＋ ATK-1",
    desc: "例：中級介入カード2枚コンボ",
    category: "combo",
    mods: { moraleAll: -2, atkAll: -1 },
  },
  {
    id: "combo_morale3_hp20",
    label: "士気-3 ＋ HP-20%",
    desc: "例：宗教家の複合工作",
    category: "combo",
    mods: { moraleAll: -3, hpPct: 0.80 },
  },
  {
    id: "combo_remove1_morale2",
    label: "前衛1除去 ＋ 士気-2",
    desc: "例：買収＋流言飛語コンボ",
    category: "combo",
    mods: { removeFront: 1, moraleAll: -2 },
  },
];

const CATEGORY_LABELS = {
  baseline: "ベースライン",
  morale: "士気削り",
  hp: "HP削り",
  atk: "攻撃力削り",
  remove: "ユニット除去",
  combo: "複合介入",
};
const CATEGORY_COLORS = {
  baseline: "#7a6840",
  morale: "#4080c0",
  hp: "#c03030",
  atk: "#e0a020",
  remove: "#a040c0",
  combo: "#40b060",
};

// ── APPLY DEBUFFS ────────────────────────────────────────────────
function applyDebuffs(baseArmy, mods) {
  let front = baseArmy.front.map(u => ({ ...u }));
  let rear  = baseArmy.rear.map(u => ({ ...u }));

  if (mods.moraleAll) {
    [...front, ...rear].forEach(u => { u.morale = Math.max(1, u.morale + mods.moraleAll); });
  }
  if (mods.moraleFront) {
    front.forEach(u => { u.morale = Math.max(1, u.morale + mods.moraleFront); });
  }
  if (mods.hpPct) {
    [...front, ...rear].forEach(u => { u.hp = Math.max(1, Math.round(u.hp * mods.hpPct)); });
  }
  if (mods.atkAll) {
    [...front, ...rear].forEach(u => { u.atk = Math.max(0, u.atk + mods.atkAll); });
  }
  if (mods.removeFront) {
    front = front.slice(mods.removeFront);
  }
  if (mods.removeRear) {
    rear = rear.slice(mods.removeRear);
  }
  return { front, rear };
}

// ── SIMULATION CORE ──────────────────────────────────────────────
function cloneUnit(u) {
  return { ...u, currentHp: u.hp, currentMorale: u.morale, atkMod: 0, fled: false, dead: false };
}

function alive(units) { return units.filter(u => !u.fled && !u.dead); }
function allAlive(army) { return [...alive(army.front), ...alive(army.rear)]; }

function runAttackPhase(atkArmy, defArmy) {
  const atkUnits = allAlive(atkArmy);
  const defFront = alive(defArmy.front);
  const defRear  = alive(defArmy.rear);

  atkUnits.forEach(u => {
    const pool = defFront.length > 0 ? defFront : defRear;
    if (pool.length === 0) return;
    const target = pool[Math.floor(Math.random() * pool.length)];

    let atkVal = u.atk + (u.atkMod || 0);
    if (u.traits?.includes("BERSERK") && u.currentHp <= u.hp / 2) atkVal += 2;
    const armor = u.traits?.includes("ARMOR_PIERCE") ? 0 : (target.armor || 0);
    const dmg = Math.max(1, atkVal - armor);

    target.currentHp -= dmg;
    target.currentMorale = Math.max(0, target.currentMorale - 1);

    if (target.currentHp <= 0) {
      target.dead = true;
      allAlive(defArmy).forEach(a => {
        if (a !== target) a.currentMorale = Math.max(0, a.currentMorale - 2);
      });
      // Martyr
      if (target.traits?.includes("MARTYR")) {
        alive(atkArmy.front).forEach(a => { a.currentMorale = Math.max(0, a.currentMorale - 4); });
      }
      // On death ally morale
      if (target.traits?.includes("ON_DEATH_ALLY_MORALE_1")) {
        allAlive(atkArmy).forEach(a => { a.currentMorale = Math.min(a.morale, a.currentMorale + 1); });
      }
    } else if (target.currentMorale <= 0) {
      target.fled = true;
    }
  });
}

function runPassives(armyA, armyB) {
  allAlive(armyA).forEach(u => {
    if (u.traits?.includes("MORALE_REGEN_2")) {
      allAlive(armyA).forEach(a => { a.currentMorale = Math.min(a.morale, a.currentMorale + 2); });
    }
    if (u.traits?.includes("MORALE_DRAIN_2")) {
      const mercs = allAlive(armyB).filter(x => x.traits?.includes("MERCENARY"));
      if (mercs.length > 0) {
        const t = mercs[Math.floor(Math.random() * mercs.length)];
        t.currentMorale = Math.max(0, t.currentMorale - 2);
        if (t.currentMorale <= 0) t.fled = true;
      }
    }
    if (u.traits?.includes("BUFF_BELIEVERS_2")) {
      allAlive(armyA).filter(x => x.traits?.includes("BELIEVER")).forEach(b => {
        b.currentMorale = Math.min(b.morale, b.currentMorale + 2);
      });
    }
  });
}

function simulate(milUnits, opponentUnits) {
  const armyA = { front: milUnits.front.map(cloneUnit), rear: milUnits.rear.map(cloneUnit) };
  const armyB = { front: opponentUnits.front.map(cloneUnit), rear: opponentUnits.rear.map(cloneUnit) };

  for (let r = 1; r <= 14; r++) {
    allAlive(armyA).forEach(u => { u.atkMod = 0; });
    allAlive(armyB).forEach(u => { u.atkMod = 0; });
    runPassives(armyA, armyB);
    runPassives(armyB, armyA);
    runAttackPhase(armyA, armyB);
    if (allAlive(armyB).length > 0) runAttackPhase(armyB, armyA);
    if (allAlive(armyA).length === 0 || allAlive(armyB).length === 0) break;
  }

  const aFinal = allAlive(armyA).length;
  const bFinal = allAlive(armyB).length;
  const aFled = [...armyA.front, ...armyA.rear].filter(u => u.fled).length;
  const bFled = [...armyB.front, ...armyB.rear].filter(u => u.fled).length;

  let winner = "draw";
  let winReason = "";
  if (bFinal === 0 && aFinal > 0) { winner = "A"; winReason = bFled > 0 ? "士気崩壊" : "殲滅"; }
  else if (aFinal === 0 && bFinal > 0) { winner = "B"; winReason = aFled > 0 ? "士気崩壊" : "殲滅"; }

  return { winner, winReason };
}

function runBatch(milUnits, opponentUnits, n = 300) {
  let aWins = 0, bWins = 0, draws = 0, moraleWins = 0;
  for (let i = 0; i < n; i++) {
    const r = simulate(milUnits, opponentUnits);
    if (r.winner === "A") aWins++;
    else if (r.winner === "B") bWins++;
    else draws++;
    if (r.winReason === "士気崩壊") moraleWins++;
  }
  return {
    aWinRate: Math.round(aWins / n * 100),
    bWinRate: Math.round(bWins / n * 100),
    moraleRate: Math.round(moraleWins / n * 100),
    n,
  };
}

// ── COLORS ───────────────────────────────────────────────────────
const C = {
  bg: "#0c0a08", panel: "#111009", border: "#2a2010", borderLight: "#3a3020",
  text: "#c8b89a", textDim: "#7a6840", textFaint: "#2a2010",
  warn: "#e8a020", danger: "#e04040", ok: "#40b060", info: "#4080c0",
};

function balanceColor(milRate) {
  if (milRate >= 70) return { color: C.danger,  label: "軍人圧勝",   icon: "▲▲" };
  if (milRate >= 60) return { color: C.warn,    label: "軍人有利",   icon: "▲" };
  if (milRate >= 45) return { color: C.ok,      label: "均衡",       icon: "◆" };
  if (milRate >= 35) return { color: "#60b0e0", label: "相手有利",   icon: "▼" };
  return               { color: C.info,       label: "相手優勢",   icon: "▼▼" };
}

function WinRateBar({ aRate, bRate, height = 20 }) {
  return (
    <div style={{ position: "relative", height, borderRadius: 2, overflow: "hidden", background: "#1a1810" }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${aRate}%`, background: "#c03030", opacity: 0.85 }} />
      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: `${bRate}%`, background: "#3070c0", opacity: 0.85 }} />
      {/* center line */}
      <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "#3a3020" }} />
      <div style={{
        position: "absolute", inset: 0, display: "flex",
        alignItems: "center", justifyContent: "space-between",
        padding: "0 8px", fontSize: 11, fontWeight: "bold", color: "#fff",
      }}>
        <span>{aRate}%</span>
        <span>{bRate}%</span>
      </div>
    </div>
  );
}

// ── ARMY PREVIEW ─────────────────────────────────────────────────
function ArmyPreview({ army, label, color }) {
  const all = [...army.front, ...army.rear];
  return (
    <div style={{ background: C.panel, border: `1px solid ${color}30`, borderRadius: 3, padding: "10px 12px" }}>
      <div style={{ fontSize: 10, color, marginBottom: 8, letterSpacing: "0.1em" }}>{label}</div>
      {all.map((u, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.textDim, marginBottom: 2 }}>
          <span>{i < army.front.length ? "前" : "後"} {u.name}</span>
          <span>HP{u.hp} ATK{u.atk} 士{u.morale}{u.armor ? ` 防${u.armor}` : ""}</span>
        </div>
      ))}
      {all.length === 0 && <div style={{ fontSize: 10, color: C.textFaint }}>ユニットなし</div>}
    </div>
  );
}

// ── RESULT TABLE ROW ─────────────────────────────────────────────
function ResultRow({ preset, result, opponentLabel, isBaseline }) {
  const catColor = CATEGORY_COLORS[preset.category] || C.textDim;
  const bal = balanceColor(result.aWinRate);

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "180px 90px 1fr 80px 70px",
      gap: 10,
      alignItems: "center",
      padding: "8px 14px",
      background: isBaseline ? "#1a1508" : C.panel,
      border: `1px solid ${isBaseline ? "#5a4020" : C.border}`,
      borderRadius: 3,
      marginBottom: 4,
    }}>
      {/* Label */}
      <div>
        <div style={{ fontSize: 12, color: C.text, marginBottom: 2 }}>{preset.label}</div>
        <div style={{ fontSize: 9, color: C.textDim }}>{preset.desc}</div>
      </div>
      {/* Category badge */}
      <div style={{
        fontSize: 9, color: catColor, padding: "2px 6px",
        border: `1px solid ${catColor}40`, borderRadius: 2,
        textAlign: "center",
      }}>
        {CATEGORY_LABELS[preset.category]}
      </div>
      {/* Win rate bar */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: C.textDim, marginBottom: 2 }}>
          <span>軍人（デバフ後）</span>
          <span>{opponentLabel}</span>
        </div>
        <WinRateBar aRate={result.aWinRate} bRate={result.bWinRate} height={18} />
      </div>
      {/* Balance */}
      <div style={{ textAlign: "center" }}>
        <span style={{ fontSize: 11, color: bal.color, fontWeight: "bold" }}>{bal.icon}</span>
        <div style={{ fontSize: 9, color: bal.color }}>{bal.label}</div>
      </div>
      {/* Morale rate */}
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 13, color: C.warn, fontWeight: "bold" }}>{result.moraleRate}%</div>
        <div style={{ fontSize: 9, color: C.textDim }}>士気決着</div>
      </div>
    </div>
  );
}

// ── CUSTOM DEBUFF BUILDER ────────────────────────────────────────
function CustomDebuffBuilder({ customMods, onChange }) {
  const fields = [
    { key: "moraleAll", label: "士気 全体",  min: -9, max: 0, step: 1 },
    { key: "moraleFront", label: "士気 前衛", min: -9, max: 0, step: 1 },
    { key: "atkAll",   label: "ATK 全体",   min: -8, max: 0, step: 1 },
    { key: "hpPct",    label: "HP 残存率",  min: 0.1, max: 1.0, step: 0.1, format: v => `${Math.round(v*100)}%` },
    { key: "removeFront", label: "前衛除去", min: 0, max: 3, step: 1 },
    { key: "removeRear",  label: "後衛除去", min: 0, max: 3, step: 1 },
  ];
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.borderLight}`, borderRadius: 4, padding: 16 }}>
      <div style={{ fontSize: 11, color: C.textDim, marginBottom: 12, letterSpacing: "0.15em" }}>■ カスタム介入値</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {fields.map(f => {
          const val = customMods[f.key] ?? (f.key === "hpPct" ? 1.0 : 0);
          const display = f.format ? f.format(val) : val;
          return (
            <div key={f.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label style={{ fontSize: 10, color: C.textDim, minWidth: 72 }}>{f.label}</label>
              <input
                type="range"
                min={f.min} max={f.max} step={f.step}
                value={val}
                onChange={e => onChange({ ...customMods, [f.key]: Number(e.target.value) })}
                style={{ flex: 1, accentColor: C.warn }}
              />
              <span style={{ fontSize: 11, color: C.text, minWidth: 36, textAlign: "right" }}>{display}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── INSIGHT PANEL ────────────────────────────────────────────────
function InsightPanel({ results, opponentKey }) {
  if (!results || results.length === 0) return null;

  const baseline = results.find(r => r.preset.id === "none");
  if (!baseline) return null;

  // Find first preset where mil win rate drops below 55% (near balanced)
  const balanced = results.filter(r => r.preset.id !== "none" && r.result.aWinRate <= 55 && r.result.aWinRate >= 40);
  // Cheapest effective intervention
  const effectiveOnce = results.find(r => r.preset.id !== "none" && r.result.aWinRate <= 58);

  const items = [];

  items.push({
    level: "info",
    text: `ベースライン（介入なし）: 軍人 ${baseline.result.aWinRate}% 勝率。これが「戦闘前介入なし」の基準値。`,
  });

  if (balanced.length > 0) {
    const names = balanced.map(r => r.preset.label).join("、");
    items.push({
      level: "ok",
      text: `均衡帯（軍人40〜55%）に入るパターン: ${names}。これらが戦闘前介入カードの「適切な効果量」の目安。`,
    });
  } else {
    items.push({
      level: "warn",
      text: `均衡帯（軍人40〜55%）に入るパターンが見つかりませんでした。介入値をさらに大きくするか、相手側の構成を見直してください。`,
    });
  }

  if (effectiveOnce) {
    items.push({
      level: "ok",
      text: `最小有効介入: 「${effectiveOnce.preset.label}」で軍人勝率が${effectiveOnce.result.aWinRate}%に低下。コスト設計の下限参考値として使える。`,
    });
  }

  const moraleEffective = results
    .filter(r => r.preset.id !== "none" && r.preset.category === "morale")
    .sort((a, b) => a.result.aWinRate - b.result.aWinRate)[0];
  if (moraleEffective) {
    items.push({
      level: "info",
      text: `士気削りの最大効果: 「${moraleEffective.preset.label}」で軍人${moraleEffective.result.aWinRate}%。士気崩壊決着は${moraleEffective.result.moraleRate}%に達する。`,
    });
  }

  const levelStyle = {
    ok:   { border: `${C.ok}40`,   bg: `${C.ok}08`,   icon: "✓", color: C.ok },
    warn: { border: `${C.warn}40`, bg: `${C.warn}08`, icon: "△", color: C.warn },
    info: { border: `${C.info}40`, bg: `${C.info}08`, icon: "ℹ", color: C.info },
  };

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 11, color: C.textDim, marginBottom: 12, letterSpacing: "0.2em", borderBottom: `1px solid ${C.border}`, paddingBottom: 6 }}>
        ■ 設計示唆レポート
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {items.map((item, i) => {
          const s = levelStyle[item.level];
          return (
            <div key={i} style={{ display: "flex", gap: 10, padding: "8px 12px", background: s.bg, border: `1px solid ${s.border}`, borderRadius: 3 }}>
              <span style={{ color: s.color, fontWeight: "bold", fontSize: 12, minWidth: 14 }}>{s.icon}</span>
              <span style={{ fontSize: 11, color: "#a09070", lineHeight: 1.7 }}>{item.text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── MAIN ─────────────────────────────────────────────────────────
export default function App() {
  const [opponentKey, setOpponentKey] = useState("merchant");
  const [results, setResults] = useState(null);
  const [running, setRunning] = useState(false);
  const [customMods, setCustomMods] = useState({ moraleAll: 0, moraleFront: 0, atkAll: 0, hpPct: 1.0, removeFront: 0, removeRear: 0 });
  const [customResult, setCustomResult] = useState(null);
  const [activeCategory, setActiveCategory] = useState("all");

  const opponent = BASE_ARMIES[opponentKey];

  const runAll = useCallback(() => {
    setRunning(true);
    setTimeout(() => {
      const milBase = BASE_ARMIES.military;
      const opp = BASE_ARMIES[opponentKey];
      const res = DEBUFF_PRESETS.map(preset => {
        const milDebuffed = applyDebuffs(milBase, preset.mods);
        const result = runBatch(milDebuffed, opp, 300);
        return { preset, result };
      });
      setResults(res);
      setRunning(false);
    }, 50);
  }, [opponentKey]);

  const runCustom = useCallback(() => {
    const effectiveMods = {
      ...(customMods.moraleAll !== 0 ? { moraleAll: customMods.moraleAll } : {}),
      ...(customMods.moraleFront !== 0 ? { moraleFront: customMods.moraleFront } : {}),
      ...(customMods.atkAll !== 0 ? { atkAll: customMods.atkAll } : {}),
      ...(customMods.hpPct !== 1.0 ? { hpPct: customMods.hpPct } : {}),
      ...(customMods.removeFront > 0 ? { removeFront: customMods.removeFront } : {}),
      ...(customMods.removeRear > 0 ? { removeRear: customMods.removeRear } : {}),
    };
    const milDebuffed = applyDebuffs(BASE_ARMIES.military, effectiveMods);
    const result = runBatch(milDebuffed, BASE_ARMIES[opponentKey], 300);
    const milPreview = applyDebuffs(BASE_ARMIES.military, effectiveMods);
    setCustomResult({ result, milPreview });
  }, [customMods, opponentKey]);

  const filteredResults = results
    ? (activeCategory === "all" ? results : results.filter(r => r.preset.category === activeCategory))
    : [];

  const opponentBase = BASE_ARMIES[opponentKey];

  return (
    <div style={{
      minHeight: "100vh",
      background: C.bg,
      backgroundImage: `
        radial-gradient(ellipse at 20% 10%, rgba(139,26,26,0.06) 0%, transparent 40%),
        radial-gradient(ellipse at 80% 90%, rgba(26,60,100,0.06) 0%, transparent 40%),
        url("data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23c8b89a' fill-opacity='0.012'%3E%3Cpath d='M40 0L43 14H57L46 22L50 37L40 28L30 37L34 22L23 14H37Z'/%3E%3C/g%3E%3C/svg%3E")
      `,
      color: C.text,
      fontFamily: "'Georgia', 'Times New Roman', serif",
      padding: "20px 28px",
    }}>

      {/* HEADER */}
      <div style={{ textAlign: "center", marginBottom: 28, borderBottom: `1px solid ${C.border}`, paddingBottom: 18 }}>
        <div style={{ fontSize: 10, letterSpacing: "0.5em", color: C.textDim, marginBottom: 6, textTransform: "uppercase" }}>
          Pre-Battle Intervention Balance — GDD v0.9
        </div>
        <h1 style={{ fontSize: 20, fontWeight: "normal", margin: "0 0 6px", letterSpacing: "0.15em", color: "#d8c8a8" }}>
          ⚖️ 戦闘前介入バランス検証シミュレーター
        </h1>
        <div style={{ fontSize: 11, color: C.textDim }}>
          「軍人が何を削られると均衡するか」を一覧化し、介入カードの効果値設計に使う
        </div>
      </div>

      {/* SETUP ROW */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
        {/* Opponent selector */}
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 4, padding: 16 }}>
          <div style={{ fontSize: 11, color: C.textDim, marginBottom: 10, letterSpacing: "0.15em" }}>■ 対戦相手</div>
          {["merchant", "clergy"].map(key => (
            <button key={key} onClick={() => setOpponentKey(key)} style={{
              display: "block", width: "100%", textAlign: "left",
              padding: "8px 12px", marginBottom: 6,
              background: opponentKey === key ? "#2a2010" : "transparent",
              border: `1px solid ${opponentKey === key ? C.borderLight : C.border}`,
              color: opponentKey === key ? C.text : C.textDim,
              cursor: "pointer", fontFamily: "Georgia, serif", fontSize: 12, borderRadius: 2,
            }}>
              {key === "merchant" ? "💰 商人（標準5体）" : "✝️ 宗教家（標準5体）"}
            </button>
          ))}
        </div>

        {/* Military preview */}
        <ArmyPreview army={BASE_ARMIES.military} label="⚔️ 軍人（デバフ前）" color="#e05050" />

        {/* Opponent preview */}
        <ArmyPreview army={opponentBase} label={`${opponentKey === "merchant" ? "💰 商人" : "✝️ 宗教家"}（標準）`} color={opponentKey === "merchant" ? "#40c060" : "#4090d0"} />
      </div>

      {/* RUN BUTTON */}
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <button onClick={runAll} disabled={running} style={{
          background: running ? "transparent" : "#2a1a08",
          border: `1px solid ${running ? C.border : "#a06020"}`,
          color: running ? C.textDim : "#e0a040",
          padding: "10px 48px", cursor: running ? "not-allowed" : "pointer",
          fontFamily: "Georgia, serif", fontSize: 13, letterSpacing: "0.25em", borderRadius: 2,
        }}>
          {running ? "⚔ 演算中..." : "▶ 全パターン検証（300試行 × 各条件）"}
        </button>
        <div style={{ fontSize: 10, color: C.textFaint, marginTop: 6 }}>
          {DEBUFF_PRESETS.length}パターン × 300試行 を一括実行
        </div>
      </div>

      {results && !running && (
        <>
          {/* INSIGHT */}
          <InsightPanel results={results} opponentKey={opponentKey} />

          {/* CATEGORY FILTER */}
          <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
            {["all", ...Object.keys(CATEGORY_LABELS)].map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)} style={{
                background: activeCategory === cat ? "#2a2010" : "transparent",
                border: `1px solid ${activeCategory === cat ? C.borderLight : C.border}`,
                color: activeCategory === cat ? C.text : (cat === "all" ? C.textDim : CATEGORY_COLORS[cat] || C.textDim),
                padding: "4px 12px", cursor: "pointer",
                fontFamily: "Georgia, serif", fontSize: 10, borderRadius: 2,
              }}>
                {cat === "all" ? "全て" : CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>

          {/* HEADER ROW */}
          <div style={{ display: "grid", gridTemplateColumns: "180px 90px 1fr 80px 70px", gap: 10, padding: "4px 14px", marginBottom: 6 }}>
            {["介入パターン", "種別", `軍人 vs ${opponentKey === "merchant" ? "商人" : "宗教家"}（勝率バー）`, "バランス", "士気決着"].map((h, i) => (
              <div key={i} style={{ fontSize: 9, color: C.textDim, letterSpacing: "0.1em" }}>{h}</div>
            ))}
          </div>

          {/* RESULT ROWS */}
          {filteredResults.map(({ preset, result }) => (
            <ResultRow
              key={preset.id}
              preset={preset}
              result={result}
              opponentLabel={opponentKey === "merchant" ? "商人" : "宗教家"}
              isBaseline={preset.id === "none"}
            />
          ))}

          {/* CUSTOM SECTION */}
          <div style={{ marginTop: 32 }}>
            <div style={{ fontSize: 11, color: C.textDim, marginBottom: 14, letterSpacing: "0.2em", borderBottom: `1px solid ${C.border}`, paddingBottom: 6 }}>
              ■ カスタム介入値を試す
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 14 }}>
              <CustomDebuffBuilder customMods={customMods} onChange={setCustomMods} />
              <div>
                <div style={{ fontSize: 10, color: C.textDim, marginBottom: 8 }}>適用後の軍人構成プレビュー</div>
                {(() => {
                  const effectiveMods = {
                    ...(customMods.moraleAll !== 0 ? { moraleAll: customMods.moraleAll } : {}),
                    ...(customMods.moraleFront !== 0 ? { moraleFront: customMods.moraleFront } : {}),
                    ...(customMods.atkAll !== 0 ? { atkAll: customMods.atkAll } : {}),
                    ...(customMods.hpPct !== 1.0 ? { hpPct: customMods.hpPct } : {}),
                    ...(customMods.removeFront > 0 ? { removeFront: customMods.removeFront } : {}),
                    ...(customMods.removeRear > 0 ? { removeRear: customMods.removeRear } : {}),
                  };
                  const preview = applyDebuffs(BASE_ARMIES.military, effectiveMods);
                  return <ArmyPreview army={preview} label="⚔️ 軍人（デバフ後）" color="#e05050" />;
                })()}
                <button onClick={runCustom} style={{
                  marginTop: 10, width: "100%",
                  background: "#2a1a08", border: `1px solid #a06020`,
                  color: "#e0a040", padding: "8px", cursor: "pointer",
                  fontFamily: "Georgia, serif", fontSize: 12, letterSpacing: "0.15em", borderRadius: 2,
                }}>
                  ▶ この設定で検証（300試行）
                </button>
              </div>
            </div>

            {customResult && (
              <div style={{ background: C.panel, border: `1px solid ${C.borderLight}`, borderRadius: 4, padding: 16 }}>
                <div style={{ fontSize: 11, color: C.textDim, marginBottom: 10 }}>■ カスタム結果</div>
                <WinRateBar aRate={customResult.result.aWinRate} bRate={customResult.result.bWinRate} height={24} />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11, color: C.textDim }}>
                  <span>軍人（デバフ後）: <b style={{ color: "#e05050" }}>{customResult.result.aWinRate}%</b></span>
                  <span>士気決着: <b style={{ color: C.warn }}>{customResult.result.moraleRate}%</b></span>
                  <span>{opponentKey === "merchant" ? "商人" : "宗教家"}: <b style={{ color: "#4090d0" }}>{customResult.result.bWinRate}%</b></span>
                </div>
                <div style={{ textAlign: "center", marginTop: 10 }}>
                  {(() => { const bal = balanceColor(customResult.result.aWinRate); return <span style={{ fontSize: 14, color: bal.color, fontWeight: "bold" }}>{bal.icon} {bal.label}</span>; })()}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
