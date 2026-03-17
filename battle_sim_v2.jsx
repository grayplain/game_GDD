import { useState, useCallback } from "react";

// ── FULL UNIT POOL (GDD v0.9) ────────────────────────────────────
const UNIT_POOL = {
  // 軍人
  mil_spearman:   { name: "槍兵",     faction: "military", pos: "front", hp: 14, atk: 3, morale: 6,  armor: 0, upkeep: 0, traits: [], note: "量産基本兵" },
  mil_shieldman:  { name: "盾兵",     faction: "military", pos: "front", hp: 22, atk: 1, morale: 7,  armor: 2, upkeep: 0, traits: ["TANK"], note: "アーマー2" },
  mil_heavy:      { name: "重装歩兵", faction: "military", pos: "front", hp: 20, atk: 4, morale: 6,  armor: 0, upkeep: 0, traits: ["ON_SUMMON_2"], note: "召喚時敵前衛-2ダメ" },
  mil_cavalry:    { name: "騎馬兵",   faction: "military", pos: "front", hp: 14, atk: 5, morale: 5,  armor: 0, upkeep: 0, traits: ["FIRST_STRIKE"], note: "先制攻撃" },
  mil_knight:     { name: "騎士",     faction: "military", pos: "front", hp: 22, atk: 5, morale: 8,  armor: 1, upkeep: 0, traits: ["ELITE"], note: "アーマー1・上限2体" },
  mil_archer:     { name: "弓兵",     faction: "military", pos: "rear",  hp: 10, atk: 4, morale: 5,  armor: 0, upkeep: 0, traits: ["RANGED"], note: "後衛・高ATK" },
  mil_crossbow:   { name: "弩兵",     faction: "military", pos: "rear",  hp: 10, atk: 5, morale: 4,  armor: 0, upkeep: 0, traits: ["RANGED","ARMOR_PIERCE"], note: "アーマー貫通" },
  mil_banner:     { name: "軍旗手",   faction: "military", pos: "rear",  hp: 10, atk: 1, morale: 9,  armor: 0, upkeep: 0, traits: ["BUFF_ADJ_1"], note: "隣接ATK+1" },
  mil_commander:  { name: "司令官",   faction: "military", pos: "rear",  hp: 12, atk: 2, morale: 10, armor: 0, upkeep: 0, traits: ["MORALE_REGEN_2"], note: "毎R全体士気+2" },
  // 商人固有
  mer_bodyguard:  { name: "用心棒",   faction: "merchant", pos: "front", hp: 18, atk: 4, morale: 4,  armor: 3, upkeep: 1, traits: ["MERCENARY","COND_ARMOR"], note: "開幕金1でアーマー3" },
  mer_bounty:     { name: "賞金稼ぎ", faction: "merchant", pos: "rear",  hp: 12, atk: 6, morale: 2,  armor: 0, upkeep: 2, traits: ["MERCENARY","GOLD_ON_KILL"], note: "撃破で金+1・士気極低" },
  mer_negotiator: { name: "交渉人",   faction: "merchant", pos: "rear",  hp: 10, atk: 1, morale: 5,  armor: 0, upkeep: 1, traits: ["MERCENARY","MORALE_DRAIN_2"], note: "毎R敵傭兵1体 士気-2" },
  // 宗教家固有
  cle_believer:   { name: "一般信者", faction: "clergy",   pos: "both",  hp:  7, atk: 2, morale: 7,  armor: 0, upkeep: 0, traits: ["BELIEVER","ON_DEATH_ALLY_MORALE_1"], note: "死亡で味方士気+1" },
  cle_monk:       { name: "修道士",   faction: "clergy",   pos: "rear",  hp: 10, atk: 2, morale: 8,  armor: 0, upkeep: 0, traits: ["BELIEVER","BUFF_BELIEVERS_2"], note: "隣接信者 士気+2" },
  cle_fanatic:    { name: "狂信者",   faction: "clergy",   pos: "front", hp:  6, atk: 5, morale: 10, armor: 0, upkeep: 0, traits: ["BELIEVER","BERSERK"], note: "HP半分でATK+2" },
  cle_martyr:     { name: "殉教者",   faction: "clergy",   pos: "front", hp:  4, atk: 3, morale: 10, armor: 0, upkeep: 0, traits: ["BELIEVER","ON_DEATH_ENEMY_FRONT_MORALE_4"], note: "死亡で敵前衛 士気-4" },
  cle_guard:      { name: "護衛騎士団",faction:"clergy",   pos: "front", hp: 18, atk: 4, morale: 8,  armor: 0, upkeep: 0, traits: ["SHIELD_REAR"], note: "後衛信者へのダメ肩代わり" },
  // 傭兵（共通）
  merc_spear:     { name: "槍傭兵",   faction: "common",   pos: "front", hp: 12, atk: 3, morale: 3,  armor: 0, upkeep: 1, traits: ["MERCENARY"], note: "共通傭兵" },
  merc_bow:       { name: "弓傭兵",   faction: "common",   pos: "rear",  hp: 10, atk: 4, morale: 3,  armor: 0, upkeep: 1, traits: ["MERCENARY","RANGED"], note: "共通傭兵・後衛" },
  merc_heavy:     { name: "重装傭兵", faction: "common",   pos: "front", hp: 18, atk: 3, morale: 3,  armor: 0, upkeep: 1, traits: ["MERCENARY"], note: "共通傭兵・タンク" },
  merc_cavalry:   { name: "傭兵騎馬", faction: "common",   pos: "front", hp: 12, atk: 4, morale: 2,  armor: 0, upkeep: 2, traits: ["MERCENARY"], note: "共通傭兵・士気極低" },
};

const FACTION_LABELS = { military: "軍人", merchant: "商人", clergy: "宗教家", common: "傭兵（共通）" };
const FACTION_COLORS = {
  military: { accent: "#e05050", light: "#ffaa88", bg: "#180a0a", border: "#8B1A1A" },
  merchant: { accent: "#40c060", light: "#88ffaa", bg: "#0a180a", border: "#1A5A1A" },
  clergy:   { accent: "#4090d0", light: "#88ccff", bg: "#0a0f1a", border: "#1A2A5A" },
  common:   { accent: "#a09060", light: "#d4c5a9", bg: "#141410", border: "#4a4030" },
};

const C = {
  bg: "#0c0a08", panel: "#111009", border: "#2a2010", borderLight: "#3a3020",
  text: "#c8b89a", textDim: "#7a6840", textFaint: "#3a3020",
  warn: "#e8a020", danger: "#e04040", ok: "#40b060", info: "#4080c0",
};

const MAX_UNITS = 6;
const SLOT_COUNT = 6; // 前衛最大3 + 後衛最大3 = 各3スロット

// ── UNIT EDITOR ──────────────────────────────────────────────────
const EDITABLE_FIELDS = [
  { key: "name",   label: "名前",   type: "text" },
  { key: "hp",     label: "HP",     type: "number", min: 1, max: 99 },
  { key: "atk",    label: "ATK",    type: "number", min: 0, max: 20 },
  { key: "morale", label: "士気",   type: "number", min: 1, max: 10 },
  { key: "armor",  label: "防具",   type: "number", min: 0, max: 5 },
  { key: "upkeep", label: "維持費", type: "number", min: 0, max: 3 },
];

function emptySlot() { return null; }

function defaultArmy(side) {
  if (side === "A") return {
    front: [{ ...UNIT_POOL.mil_spearman }, { ...UNIT_POOL.mil_shieldman }, { ...UNIT_POOL.mil_cavalry }],
    rear:  [{ ...UNIT_POOL.mil_archer }, { ...UNIT_POOL.mil_commander }],
  };
  return {
    front: [{ ...UNIT_POOL.merc_spear }, { ...UNIT_POOL.merc_heavy }, { ...UNIT_POOL.mer_bodyguard }],
    rear:  [{ ...UNIT_POOL.merc_bow }, { ...UNIT_POOL.mer_negotiator }],
  };
}

// ── SIMULATION CORE ──────────────────────────────────────────────
function cloneUnit(u) {
  return {
    ...u,
    currentHp: u.hp, currentMorale: u.morale,
    atkMod: 0, fled: false, dead: false,
  };
}
function alive(units) { return units.filter(u => !u.fled && !u.dead); }
function allAlive(army) { return [...alive(army.front), ...alive(army.rear)]; }

function runAttackPhase(atkArmy, defArmy) {
  const events = [];
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

    const died = target.currentHp <= 0;
    if (died) {
      target.dead = true;
      // Cascade morale
      allAlive(defArmy).forEach(a => { if (a !== target) a.currentMorale = Math.max(0, a.currentMorale - 2); });
      // On-death effects
      if (target.traits?.includes("ON_DEATH_ALLY_MORALE_1")) {
        allAlive(atkArmy).forEach(a => { a.currentMorale = Math.min(a.morale, a.currentMorale + 1); });
        events.push({ type: "special", text: `${target.name} 死亡 → 味方全体 士気+1（信者特性）`, side: "def" });
      }
      if (target.traits?.includes("ON_DEATH_ENEMY_FRONT_MORALE_4")) {
        alive(atkArmy.front).forEach(a => { a.currentMorale = Math.max(0, a.currentMorale - 4); });
        events.push({ type: "cascade", text: `${target.name}（殉教者）死亡 → 攻撃側前衛 士気-4！` });
      }
      events.push({ type: "cascade", text: `${target.name} 死亡 → 防衛側全体 士気-2（崩壊連鎖）` });
    } else if (target.currentMorale <= 0) {
      target.fled = true;
    }
    events.push({ type: died ? "kill" : target.fled ? "fled" : "hit", attacker: u.name, target: target.name, dmg, targetHp: Math.max(0, target.currentHp), targetMorale: Math.max(0, target.currentMorale) });
  });
  return events;
}

function runPassives(armyA, armyB) {
  const events = [];
  // MORALE_REGEN_2 (commander)
  allAlive(armyA).forEach(u => {
    if (u.traits?.includes("MORALE_REGEN_2")) {
      allAlive(armyA).forEach(a => { a.currentMorale = Math.min(a.morale, a.currentMorale + 2); });
      events.push({ type: "regen", text: `${u.name}（司令官効果）: 味方全体 士気+2`, side: "A" });
    }
    if (u.traits?.includes("MORALE_DRAIN_2")) {
      const mercs = allAlive(armyB).filter(x => x.traits?.includes("MERCENARY"));
      if (mercs.length > 0) {
        const t = mercs[Math.floor(Math.random() * mercs.length)];
        t.currentMorale = Math.max(0, t.currentMorale - 2);
        if (t.currentMorale <= 0) t.fled = true;
        events.push({ type: "drain", text: `${u.name}（交渉人）: ${t.name} 士気-2${t.fled ? " → 離脱" : ""}`, side: "A" });
      }
    }
    if (u.traits?.includes("BUFF_BELIEVERS_2")) {
      allAlive(armyA).filter(x => x.traits?.includes("BELIEVER")).forEach(b => {
        b.currentMorale = Math.min(b.morale, b.currentMorale + 2);
      });
    }
  });
  return events;
}

function simulate(compA, compB) {
  let armyA = { front: compA.front.map(cloneUnit), rear: compA.rear.map(cloneUnit) };
  let armyB = { front: compB.front.map(cloneUnit), rear: compB.rear.map(cloneUnit) };
  const rounds = [];

  for (let r = 1; r <= 12; r++) {
    const events = [];
    allAlive(armyA).forEach(u => { u.atkMod = 0; });
    allAlive(armyB).forEach(u => { u.atkMod = 0; });

    const passA = runPassives(armyA, armyB);
    const passB = runPassives(armyB, armyA);
    events.push(...passA, ...passB);

    const atkEvents = runAttackPhase(armyA, armyB);
    events.push(...atkEvents.map(e => ({ ...e, side: "A" })));
    if (allAlive(armyB).length > 0) {
      const defEvents = runAttackPhase(armyB, armyA);
      events.push(...defEvents.map(e => ({ ...e, side: "B" })));
    }

    const milAlive = allAlive(armyA).length;
    const merAlive = allAlive(armyB).length;
    rounds.push({
      round: r,
      snapA: snapshotArmy(armyA),
      snapB: snapshotArmy(armyB),
      events,
      aAlive: milAlive, bAlive: merAlive,
      aFled: [...armyA.front,...armyA.rear].filter(u=>u.fled).length,
      bFled: [...armyB.front,...armyB.rear].filter(u=>u.fled).length,
      aDead: [...armyA.front,...armyA.rear].filter(u=>u.dead).length,
      bDead: [...armyB.front,...armyB.rear].filter(u=>u.dead).length,
    });
    if (milAlive === 0 || merAlive === 0) break;
  }

  const aFinal = allAlive(armyA).length;
  const bFinal = allAlive(armyB).length;
  const aFled = [...armyA.front,...armyA.rear].filter(u=>u.fled).length;
  const bFled = [...armyB.front,...armyB.rear].filter(u=>u.fled).length;

  let winner = "引き分け", winReason = "";
  if (bFinal === 0 && aFinal > 0) { winner = "A"; winReason = bFled > 0 ? "士気崩壊" : "殲滅"; }
  else if (aFinal === 0 && bFinal > 0) { winner = "B"; winReason = aFled > 0 ? "士気崩壊" : "殲滅"; }

  return { rounds, winner, winReason, totalRounds: rounds.length };
}

function runMultiple(compA, compB, n = 200) {
  const results = Array.from({ length: n }, () => simulate(compA, compB));
  const aWins = results.filter(r => r.winner === "A").length;
  const bWins = results.filter(r => r.winner === "B").length;
  const moraleWins = results.filter(r => r.winReason === "士気崩壊").length;
  const avgRounds = results.reduce((s, r) => s + r.totalRounds, 0) / n;
  return {
    aWinRate: Math.round(aWins / n * 100),
    bWinRate: Math.round(bWins / n * 100),
    moraleRate: Math.round(moraleWins / n * 100),
    avgRounds: avgRounds.toFixed(1),
    n,
  };
}

function snapshotArmy(army) {
  const snap = u => ({ ...u, currentHp: Math.max(0, u.currentHp), currentMorale: Math.max(0, u.currentMorale) });
  return { front: army.front.map(snap), rear: army.rear.map(snap) };
}

// ── COMPONENTS ───────────────────────────────────────────────────
function Bar({ value, max, color, h = 5 }) {
  const pct = Math.min(100, Math.round((value / Math.max(1, max)) * 100));
  return (
    <div style={{ height: h, background: "#1a1810", borderRadius: 2, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${pct}%`, background: pct < 30 ? C.danger : color, borderRadius: 2, transition: "width 0.3s" }} />
    </div>
  );
}

function UnitCardSim({ unit, side }) {
  if (unit.dead) return <div style={{ fontSize: 10, color: "#3a3020", padding: "4px 8px", textDecoration: "line-through" }}>{unit.name} ✕</div>;
  if (unit.fled) return <div style={{ fontSize: 10, color: "#5a5030", padding: "4px 8px", fontStyle: "italic" }}>{unit.name} ↪離脱</div>;
  const sc = FACTION_COLORS[unit.faction] || FACTION_COLORS.common;
  return (
    <div style={{ padding: "6px 10px", border: `1px solid ${sc.border}50`, borderLeft: `3px solid ${sc.accent}`, borderRadius: 3, background: sc.bg, marginBottom: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: sc.light }}>{unit.name}</span>
        <span style={{ fontSize: 10, color: C.textDim }}>HP{Math.max(0,unit.currentHp)}/{unit.hp} 士{Math.max(0,unit.currentMorale)}/{unit.morale}</span>
      </div>
      <Bar value={unit.currentHp} max={unit.hp} color="#c03030" h={3} />
      <div style={{ height: 2 }} />
      <Bar value={unit.currentMorale} max={unit.morale} color="#3060c0" h={3} />
    </div>
  );
}

function EventLine({ ev }) {
  const sideLabel = ev.side === "A" ? "A" : ev.side === "B" ? "B" : "";
  const sideColor = ev.side === "A" ? "#e05050" : "#40c060";
  if (ev.type === "kill")    return <div style={{ fontSize: 11, padding: "2px 0", color: "#a08060" }}><span style={{ color: sideColor, fontWeight: "bold", marginRight: 6 }}>{sideLabel}</span><span style={{ color: C.danger }}>✕</span> {ev.attacker} → <b style={{ color: C.danger }}>{ev.target}</b> -{ev.dmg} （死亡）</div>;
  if (ev.type === "fled")    return <div style={{ fontSize: 11, padding: "2px 0", color: "#a08060" }}><span style={{ color: sideColor, fontWeight: "bold", marginRight: 6 }}>{sideLabel}</span><span style={{ color: C.warn }}>↪</span> {ev.attacker} → <b style={{ color: C.warn }}>{ev.target}</b> -{ev.dmg} （士気崩壊・離脱）</div>;
  if (ev.type === "cascade") return <div style={{ fontSize: 11, padding: "2px 0", color: C.danger }}><span style={{ marginRight: 30 }} />⚡ {ev.text}</div>;
  if (ev.type === "special") return <div style={{ fontSize: 11, padding: "2px 0", color: C.info }}><span style={{ marginRight: 30 }} />✦ {ev.text}</div>;
  if (ev.type === "regen")   return <div style={{ fontSize: 11, padding: "2px 0", color: "#4080c0" }}><span style={{ color: sideColor, fontWeight: "bold", marginRight: 6 }}>{sideLabel}</span>↑ {ev.text}</div>;
  if (ev.type === "drain")   return <div style={{ fontSize: 11, padding: "2px 0", color: C.warn }}><span style={{ color: sideColor, fontWeight: "bold", marginRight: 6 }}>{sideLabel}</span>↓ {ev.text}</div>;
  if (ev.type === "hit")     return <div style={{ fontSize: 10, padding: "1px 0", color: "#5a5030" }}><span style={{ color: sideColor, marginRight: 6 }}>{sideLabel}</span>▸ {ev.attacker}→{ev.target} -{ev.dmg} (HP:{ev.targetHp} 士:{ev.targetMorale})</div>;
  return null;
}

// ── ARMY BUILDER ─────────────────────────────────────────────────
const UNIT_OPTIONS = Object.entries(UNIT_POOL).map(([id, u]) => ({ id, ...u }));

function UnitSlot({ unit, pos, index, onAdd, onRemove, onEdit, side }) {
  const sc = unit ? (FACTION_COLORS[unit.faction] || FACTION_COLORS.common) : null;
  const [showPicker, setShowPicker] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [filterFaction, setFilterFaction] = useState("all");
  const [filterPos, setFilterPos] = useState("all");

  const filtered = UNIT_OPTIONS.filter(u => {
    const factionOk = filterFaction === "all" || u.faction === filterFaction;
    const posOk = filterPos === "all" || u.pos === filterPos || u.pos === "both";
    return factionOk && posOk;
  });

  if (!unit) {
    return (
      <div style={{ position: "relative" }}>
        <button
          onClick={() => setShowPicker(!showPicker)}
          style={{
            width: "100%", padding: "10px", border: `1px dashed ${C.border}`,
            background: "transparent", color: C.textDim, cursor: "pointer",
            fontSize: 11, letterSpacing: "0.1em", borderRadius: 3,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>＋</span> ユニット追加
        </button>
        {showPicker && (
          <div style={{
            position: "absolute", zIndex: 100, top: "110%", left: 0, right: 0,
            background: "#161410", border: `1px solid ${C.borderLight}`,
            borderRadius: 4, padding: 12, minWidth: 260,
            boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
          }}>
            <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
              {["all","military","merchant","clergy","common"].map(f => (
                <button key={f} onClick={() => setFilterFaction(f)} style={{
                  fontSize: 9, padding: "2px 6px",
                  background: filterFaction === f ? "#2a2010" : "transparent",
                  border: `1px solid ${filterFaction === f ? C.borderLight : C.border}`,
                  color: filterFaction === f ? C.text : C.textDim,
                  cursor: "pointer", borderRadius: 2,
                }}>
                  {f === "all" ? "全て" : FACTION_LABELS[f]}
                </button>
              ))}
            </div>
            <div style={{ maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
              {filtered.map(u => (
                <button key={u.id} onClick={() => { onAdd(u); setShowPicker(false); }} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "5px 8px", background: "transparent",
                  border: `1px solid ${(FACTION_COLORS[u.faction]||FACTION_COLORS.common).border}30`,
                  borderRadius: 2, cursor: "pointer", width: "100%",
                  transition: "background 0.15s",
                }}
                  onMouseOver={e => e.currentTarget.style.background = "#2a2010"}
                  onMouseOut={e => e.currentTarget.style.background = "transparent"}
                >
                  <span style={{ fontSize: 11, color: (FACTION_COLORS[u.faction]||FACTION_COLORS.common).light }}>{u.name}</span>
                  <span style={{ fontSize: 9, color: C.textDim }}>HP{u.hp} ATK{u.atk} 士{u.morale}{u.armor ? ` 防${u.armor}` : ""}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <div style={{
        padding: "8px 10px",
        border: `1px solid ${sc.border}60`,
        borderLeft: `3px solid ${sc.accent}`,
        borderRadius: 3, background: sc.bg,
        position: "relative",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <span style={{ fontSize: 12, color: sc.light, fontWeight: "bold" }}>{unit.name}</span>
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={() => setShowEdit(!showEdit)} style={{ background: "none", border: "none", color: C.textDim, cursor: "pointer", fontSize: 11, padding: "0 3px" }} title="編集">✎</button>
            <button onClick={onRemove} style={{ background: "none", border: "none", color: "#5a2020", cursor: "pointer", fontSize: 11, padding: "0 3px" }} title="削除">✕</button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, fontSize: 10, color: C.textDim, marginBottom: 4, flexWrap: "wrap" }}>
          <span style={{ color: "#e06060" }}>HP {unit.hp}</span>
          <span>ATK {unit.atk}</span>
          <span style={{ color: "#6090e0" }}>士気 {unit.morale}</span>
          {unit.armor > 0 && <span style={{ color: "#a0c080" }}>防具 {unit.armor}</span>}
          {unit.upkeep > 0 && <span style={{ color: C.warn }}>維持 {unit.upkeep}</span>}
        </div>
        {unit.note && <div style={{ fontSize: 9, color: "#5a5030" }}>{unit.note}</div>}
      </div>

      {/* Inline editor */}
      {showEdit && (
        <div style={{
          position: "absolute", zIndex: 100, top: "110%", left: 0, right: 0,
          background: "#161410", border: `1px solid ${C.borderLight}`,
          borderRadius: 4, padding: 12,
          boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
        }}>
          <div style={{ fontSize: 10, color: C.textDim, marginBottom: 8, letterSpacing: "0.15em" }}>■ 数値編集</div>
          {EDITABLE_FIELDS.map(f => (
            <div key={f.key} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
              <label style={{ fontSize: 10, color: C.textDim, minWidth: 36 }}>{f.label}</label>
              <input
                type={f.type}
                value={unit[f.key]}
                min={f.min} max={f.max}
                onChange={e => onEdit({ ...unit, [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value })}
                style={{
                  background: "#1a1810", border: `1px solid ${C.border}`, color: C.text,
                  padding: "3px 6px", fontSize: 11, width: f.type === "text" ? "120px" : "60px",
                  borderRadius: 2, fontFamily: "Georgia, serif",
                }}
              />
            </div>
          ))}
          <button onClick={() => setShowEdit(false)} style={{
            marginTop: 4, background: "transparent", border: `1px solid ${C.border}`,
            color: C.textDim, padding: "3px 12px", cursor: "pointer", fontSize: 10,
            fontFamily: "Georgia, serif", borderRadius: 2,
          }}>閉じる</button>
        </div>
      )}
    </div>
  );
}

function ArmyBuilder({ label, comp, onChange, colorKey }) {
  const sc = FACTION_COLORS[colorKey] || FACTION_COLORS.common;

  const addUnit = (pos, unit) => {
    const arr = comp[pos];
    if (arr.length >= 3) return;
    onChange({ ...comp, [pos]: [...arr, { ...unit }] });
  };
  const removeUnit = (pos, idx) => {
    const arr = comp[pos].filter((_, i) => i !== idx);
    onChange({ ...comp, [pos]: arr });
  };
  const editUnit = (pos, idx, updated) => {
    const arr = comp[pos].map((u, i) => i === idx ? updated : u);
    onChange({ ...comp, [pos]: arr });
  };

  return (
    <div style={{ background: C.panel, border: `1px solid ${sc.border}40`, borderRadius: 4, padding: 16 }}>
      <div style={{ fontSize: 13, color: sc.accent, marginBottom: 14, letterSpacing: "0.2em", borderBottom: `1px solid ${sc.border}40`, paddingBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>{label}</span>
        <span style={{ fontSize: 10, color: C.textDim }}>{comp.front.length + comp.rear.length} / 6体</span>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: C.textDim, marginBottom: 6, letterSpacing: "0.1em" }}>前衛（最大3体）</div>
        {comp.front.map((u, i) => (
          <div key={i} style={{ marginBottom: 5 }}>
            <UnitSlot unit={u} pos="front" index={i} side={colorKey}
              onAdd={u2 => addUnit("front", u2)}
              onRemove={() => removeUnit("front", i)}
              onEdit={updated => editUnit("front", i, updated)} />
          </div>
        ))}
        {comp.front.length < 3 && (
          <UnitSlot unit={null} pos="front" side={colorKey}
            onAdd={u => addUnit("front", u)} />
        )}
      </div>

      <div>
        <div style={{ fontSize: 10, color: C.textDim, marginBottom: 6, letterSpacing: "0.1em" }}>後衛（最大3体）</div>
        {comp.rear.map((u, i) => (
          <div key={i} style={{ marginBottom: 5 }}>
            <UnitSlot unit={u} pos="rear" index={i} side={colorKey}
              onAdd={u2 => addUnit("rear", u2)}
              onRemove={() => removeUnit("rear", i)}
              onEdit={updated => editUnit("rear", i, updated)} />
          </div>
        ))}
        {comp.rear.length < 3 && (
          <UnitSlot unit={null} pos="rear" side={colorKey}
            onAdd={u => addUnit("rear", u)} />
        )}
      </div>
    </div>
  );
}

// ── SURVIVAL CHART ───────────────────────────────────────────────
function SurvivalChart({ rounds, labelA, labelB }) {
  if (!rounds || rounds.length === 0) return null;
  const w = 500, h = 100, padL = 28, padR = 12, padT = 8, padB = 24;
  const iW = w - padL - padR, iH = h - padT - padB;
  const maxU = 6;
  const xs = i => padL + (i / Math.max(1, rounds.length - 1)) * iW;
  const ys = v => padT + iH - (v / maxU) * iH;
  const ptA = rounds.map((r, i) => `${xs(i)},${ys(r.aAlive)}`).join(" ");
  const ptB = rounds.map((r, i) => `${xs(i)},${ys(r.bAlive)}`).join(" ");

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 10, color: C.textDim, marginBottom: 4, letterSpacing: "0.15em" }}>■ 生存ユニット推移</div>
      <svg width="100%" viewBox={`0 0 ${w} ${h}`}>
        {[0,2,4,6].map(v => <line key={v} x1={padL} x2={w-padR} y1={ys(v)} y2={ys(v)} stroke="#1a1810" strokeWidth="1" />)}
        {[0,2,4,6].map(v => <text key={v} x={padL-4} y={ys(v)+3} textAnchor="end" fontSize="8" fill="#3a3020">{v}</text>)}
        {rounds.map((r, i) => <text key={i} x={xs(i)} y={h-4} textAnchor="middle" fontSize="8" fill="#3a3020">R{r.round}</text>)}
        <polyline points={ptA} fill="none" stroke="#e05050" strokeWidth="2" />
        <polyline points={ptB} fill="none" stroke="#40c060" strokeWidth="2" />
        {rounds.map((r, i) => <g key={i}><circle cx={xs(i)} cy={ys(r.aAlive)} r={3} fill="#e05050" /><circle cx={xs(i)} cy={ys(r.bAlive)} r={3} fill="#40c060" /></g>)}
        <rect x={padL} y={padT} width={7} height={7} fill="#e05050" />
        <text x={padL+10} y={padT+7} fontSize="8" fill="#ffaa88">{labelA}</text>
        <rect x={padL+60} y={padT} width={7} height={7} fill="#40c060" />
        <text x={padL+70} y={padT+7} fontSize="8" fill="#88ffaa">{labelB}</text>
      </svg>
    </div>
  );
}

// ── MAIN ─────────────────────────────────────────────────────────
export default function App() {
  const [compA, setCompA] = useState(defaultArmy("A"));
  const [compB, setCompB] = useState(defaultArmy("B"));
  const [labelA, setLabelA] = useState("軍勢 A（攻撃側）");
  const [labelB, setLabelB] = useState("軍勢 B（防衛側）");
  const [colorA, setColorA] = useState("military");
  const [colorB, setColorB] = useState("merchant");
  const [simResult, setSimResult] = useState(null);
  const [aggResult, setAggResult] = useState(null);
  const [activeRound, setActiveRound] = useState(0);
  const [tab, setTab] = useState("builder"); // builder | sim
  const [simN, setSimN] = useState(200);

  const canSim = compA.front.length + compA.rear.length > 0 && compB.front.length + compB.rear.length > 0;

  const runSim = useCallback(() => {
    if (!canSim) return;
    const s = simulate(compA, compB);
    const a = runMultiple(compA, compB, simN);
    setSimResult(s);
    setAggResult(a);
    setActiveRound(0);
    setTab("sim");
  }, [compA, compB, simN, canSim]);

  const rd = simResult?.rounds[activeRound];

  return (
    <div style={{
      minHeight: "100vh",
      background: C.bg,
      backgroundImage: `
        radial-gradient(ellipse at 15% 15%, rgba(139,26,26,0.05) 0%, transparent 50%),
        radial-gradient(ellipse at 85% 85%, rgba(26,90,26,0.05) 0%, transparent 50%),
        url("data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23c8b89a' fill-opacity='0.012'%3E%3Cpath d='M40 0L43 14H57L46 22L50 37L40 28L30 37L34 22L23 14H37Z'/%3E%3C/g%3E%3C/svg%3E")
      `,
      color: C.text,
      fontFamily: "'Georgia', 'Times New Roman', serif",
      padding: "20px 24px",
    }}>

      {/* HEADER */}
      <div style={{ textAlign: "center", marginBottom: 24, borderBottom: `1px solid ${C.border}`, paddingBottom: 16 }}>
        <div style={{ fontSize: 10, letterSpacing: "0.5em", color: C.textDim, marginBottom: 4, textTransform: "uppercase" }}>Battle System Verification — GDD v0.9</div>
        <h1 style={{ fontSize: 20, fontWeight: "normal", margin: 0, letterSpacing: "0.15em", color: "#d8c8a8" }}>⚔️ 戦闘シミュレーター　カスタム編成版</h1>
        <div style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}>ユニット選択 / 数値編集 → シミュレーション実行</div>
      </div>

      {/* TAB BAR */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, alignItems: "center" }}>
        {[["builder","⚔ 編成設定"],["sim","▶ シミュレーション結果"]].map(([v,l]) => (
          <button key={v} onClick={() => setTab(v)} style={{
            background: tab === v ? "#2a2010" : "transparent",
            border: `1px solid ${tab === v ? C.borderLight : C.border}`,
            color: tab === v ? C.text : C.textDim,
            padding: "7px 20px", cursor: "pointer",
            fontFamily: "Georgia, serif", fontSize: 11, letterSpacing: "0.15em", borderRadius: 2,
          }}>{l}</button>
        ))}
        {tab === "builder" && (
          <button
            onClick={runSim}
            disabled={!canSim}
            style={{
              marginLeft: "auto",
              background: canSim ? "#2a1a08" : "transparent",
              border: `1px solid ${canSim ? "#a06020" : C.border}`,
              color: canSim ? "#e0a040" : C.textDim,
              padding: "7px 28px", cursor: canSim ? "pointer" : "not-allowed",
              fontFamily: "Georgia, serif", fontSize: 12, letterSpacing: "0.2em", borderRadius: 2,
            }}
          >
            ▶ シミュレーション実行（{simN}試行）
          </button>
        )}
        {tab === "sim" && simResult && (
          <button onClick={runSim} style={{
            marginLeft: "auto",
            background: "transparent", border: `1px solid ${C.border}`,
            color: C.textDim, padding: "7px 20px", cursor: "pointer",
            fontFamily: "Georgia, serif", fontSize: 11, letterSpacing: "0.15em", borderRadius: 2,
          }}>↺ 再試行</button>
        )}
      </div>

      {tab === "builder" && (
        <>
          {/* Army name / color pickers */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            {[
              { label: labelA, setLabel: setLabelA, color: colorA, setColor: setColorA, side: "A" },
              { label: labelB, setLabel: setLabelB, color: colorB, setColor: setColorB, side: "B" },
            ].map(({ label, setLabel, color, setColor, side }) => (
              <div key={side} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  value={label}
                  onChange={e => setLabel(e.target.value)}
                  style={{
                    flex: 1, background: "#1a1810", border: `1px solid ${C.border}`,
                    color: C.text, padding: "5px 10px", fontFamily: "Georgia, serif",
                    fontSize: 12, borderRadius: 2,
                  }}
                />
                <select value={color} onChange={e => setColor(e.target.value)} style={{
                  background: "#1a1810", border: `1px solid ${C.border}`,
                  color: C.text, padding: "5px 8px", fontFamily: "Georgia, serif",
                  fontSize: 11, borderRadius: 2, cursor: "pointer",
                }}>
                  {Object.entries(FACTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <ArmyBuilder label={labelA} comp={compA} onChange={setCompA} colorKey={colorA} />
            <ArmyBuilder label={labelB} comp={compB} onChange={setCompB} colorKey={colorB} />
          </div>
          <div style={{ marginTop: 16, textAlign: "right", display: "flex", justifyContent: "flex-end", gap: 12, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: C.textDim }}>試行回数</span>
            <select value={simN} onChange={e => setSimN(Number(e.target.value))} style={{
              background: "#1a1810", border: `1px solid ${C.border}`, color: C.text,
              padding: "4px 8px", fontFamily: "Georgia, serif", fontSize: 11, borderRadius: 2,
            }}>
              {[50, 100, 200, 500].map(n => <option key={n} value={n}>{n}試行</option>)}
            </select>
            <button onClick={runSim} disabled={!canSim} style={{
              background: canSim ? "#2a1a08" : "transparent",
              border: `1px solid ${canSim ? "#a06020" : C.border}`,
              color: canSim ? "#e0a040" : C.textDim,
              padding: "8px 32px", cursor: canSim ? "pointer" : "not-allowed",
              fontFamily: "Georgia, serif", fontSize: 13, letterSpacing: "0.2em", borderRadius: 2,
            }}>▶ 実行</button>
          </div>
        </>
      )}

      {tab === "sim" && simResult && aggResult && (
        <>
          {/* Stats strip */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
            {[
              { l: `${labelA} 勝率`, v: `${aggResult.aWinRate}%`, c: "#e05050" },
              { l: `${labelB} 勝率`, v: `${aggResult.bWinRate}%`, c: "#40c060" },
              { l: "平均ラウンド", v: `${aggResult.avgRounds} R`, c: C.text },
              { l: "士気崩壊決着", v: `${aggResult.moraleRate}%`, c: C.warn },
            ].map((s, i) => (
              <div key={i} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 3, padding: "12px", textAlign: "center" }}>
                <div style={{ fontSize: 10, color: C.textDim, marginBottom: 3 }}>{s.l}</div>
                <div style={{ fontSize: 20, color: s.c, fontWeight: "bold" }}>{s.v}</div>
                <div style={{ fontSize: 9, color: C.textFaint }}>n={aggResult.n}</div>
              </div>
            ))}
          </div>

          {/* Round selector */}
          <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
            {simResult.rounds.map((r, i) => {
              const hasKill = r.events.some(e => e.type === "kill");
              const hasFled = r.events.some(e => e.type === "fled");
              const dot = hasKill ? C.danger : hasFled ? C.warn : C.textFaint;
              return (
                <button key={i} onClick={() => setActiveRound(i)} style={{
                  background: activeRound === i ? "#2a2010" : "transparent",
                  border: `1px solid ${activeRound === i ? C.borderLight : C.border}`,
                  color: activeRound === i ? C.text : C.textDim,
                  padding: "5px 13px", cursor: "pointer",
                  fontFamily: "Georgia, serif", fontSize: 11, borderRadius: 2,
                }}>
                  R{r.round} <span style={{ color: dot, fontSize: 8 }}>●</span>
                </button>
              );
            })}
            <div style={{ marginLeft: "auto", fontSize: 11, color: C.textDim }}>
              結果：<b style={{ color: simResult.winner === "A" ? "#e05050" : "#40c060" }}>
                {simResult.winner === "A" ? labelA : simResult.winner === "B" ? labelB : "引き分け"}
              </b>
              {simResult.winReason && <span> （{simResult.winReason}）</span>}
              　{simResult.totalRounds}R
            </div>
          </div>

          {/* Round detail */}
          {rd && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr 1fr", gap: 16 }}>
              {/* Army A */}
              <div>
                <div style={{ fontSize: 11, color: "#e05050", marginBottom: 8, letterSpacing: "0.1em" }}>{labelA}</div>
                <div style={{ fontSize: 10, color: C.textDim, marginBottom: 4 }}>前衛</div>
                {rd.snapA.front.map((u, i) => <UnitCardSim key={i} unit={u} side="A" />)}
                <div style={{ fontSize: 10, color: C.textDim, margin: "8px 0 4px" }}>後衛</div>
                {rd.snapA.rear.map((u, i) => <UnitCardSim key={i} unit={u} side="A" />)}
                <div style={{ fontSize: 10, color: C.textDim, marginTop: 8 }}>
                  生存 <b style={{ color: "#e05050" }}>{rd.aAlive}</b> / 離脱 {rd.aFled} / 消滅 {rd.aDead}
                </div>
              </div>

              {/* Events */}
              <div>
                <div style={{ fontSize: 11, color: C.textDim, marginBottom: 8, letterSpacing: "0.15em", borderBottom: `1px solid ${C.border}`, paddingBottom: 5 }}>
                  ■ R{rd.round} イベントログ
                </div>
                <div style={{ maxHeight: 380, overflowY: "auto", display: "flex", flexDirection: "column", gap: 1 }}>
                  {rd.events.map((ev, i) => <EventLine key={i} ev={ev} />)}
                  {rd.events.length === 0 && <div style={{ color: C.textFaint, fontSize: 11 }}>イベントなし</div>}
                </div>
                <SurvivalChart rounds={simResult.rounds} labelA={labelA} labelB={labelB} />
              </div>

              {/* Army B */}
              <div>
                <div style={{ fontSize: 11, color: "#40c060", marginBottom: 8, letterSpacing: "0.1em" }}>{labelB}</div>
                <div style={{ fontSize: 10, color: C.textDim, marginBottom: 4 }}>前衛</div>
                {rd.snapB.front.map((u, i) => <UnitCardSim key={i} unit={u} side="B" />)}
                <div style={{ fontSize: 10, color: C.textDim, margin: "8px 0 4px" }}>後衛</div>
                {rd.snapB.rear.map((u, i) => <UnitCardSim key={i} unit={u} side="B" />)}
                <div style={{ fontSize: 10, color: C.textDim, marginTop: 8 }}>
                  生存 <b style={{ color: "#40c060" }}>{rd.bAlive}</b> / 離脱 {rd.bFled} / 消滅 {rd.bDead}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {tab === "sim" && !simResult && (
        <div style={{ textAlign: "center", padding: 60, color: C.textDim, fontSize: 13 }}>
          ← 「編成設定」タブでユニットを設定してシミュレーションを実行してください
        </div>
      )}
    </div>
  );
}
