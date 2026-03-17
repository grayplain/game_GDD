import { useState, useCallback } from "react";

// ═══════════════════════════════════════════
// THEME
// ═══════════════════════════════════════════
const C = {
  bg: "#0d0b08", panel: "#131108", panelBright: "#1a1810",
  border: "#2e2810", borderLight: "#4a3e20",
  text: "#d4c49a", textDim: "#7a6840", textFaint: "#3a3020",
  gold: "#e8b840", goldDim: "#a07820",
  red: "#d04040", green: "#40a060", blue: "#4080c0", orange: "#d07828",
  purple: "#9060c0",
};

// ═══════════════════════════════════════════
// ボスユニット定義（モデルケース固定）
// ═══════════════════════════════════════════
const BOSS_UNITS_BASE = [
  { id:"b_spear",   name:"槍兵",     pos:"front", hp:14, atk:3, morale:6,  armor:0, icon:"🗡️" },
  { id:"b_heavy",   name:"重装歩兵", pos:"front", hp:20, atk:4, morale:6,  armor:0, icon:"⚔️", spawnDmg:2 },
  { id:"b_knight",  name:"騎士",     pos:"front", hp:22, atk:5, morale:8,  armor:1, icon:"⚜️" },
  { id:"b_cross1",  name:"弩兵A",   pos:"rear",  hp:10, atk:5, morale:4,  armor:0, icon:"🎯", armorPierce:true },
  { id:"b_cross2",  name:"弩兵B",   pos:"rear",  hp:10, atk:5, morale:4,  armor:0, icon:"🎯", armorPierce:true },
  { id:"b_cmd",     name:"司令官",   pos:"rear",  hp:12, atk:2, morale:10, armor:0, icon:"👑", moraleRegen:2 },
];

// プレイヤー軍団のプリセット（軍人・槍衾ベース）
const PLAYER_UNIT_POOL = {
  spearman:  { id:"spearman",  name:"槍兵",     pos:"front", hp:14, atk:3, morale:6,  armor:0, icon:"🗡️" },
  shieldman: { id:"shieldman", name:"盾兵",     pos:"front", hp:22, atk:1, morale:7,  armor:2, icon:"🛡️" },
  heavy:     { id:"heavy",     name:"重装歩兵", pos:"front", hp:20, atk:4, morale:6,  armor:0, icon:"⚔️" },
  cavalry:   { id:"cavalry",   name:"騎馬兵",   pos:"front", hp:14, atk:5, morale:5,  armor:0, icon:"🐴", firstStrike:true },
  knight:    { id:"knight",    name:"騎士",     pos:"front", hp:22, atk:5, morale:8,  armor:1, icon:"⚜️" },
  archer:    { id:"archer",    name:"弓兵",     pos:"rear",  hp:10, atk:4, morale:5,  armor:0, icon:"🏹", ranged:true },
  crossbow:  { id:"crossbow",  name:"弩兵",     pos:"rear",  hp:10, atk:5, morale:4,  armor:0, icon:"🎯", armorPierce:true },
  banner:    { id:"banner",    name:"軍旗手",   pos:"rear",  hp:10, atk:1, morale:9,  armor:0, icon:"🚩", buffAdjAtk:1 },
  commander: { id:"commander", name:"司令官",   pos:"rear",  hp:12, atk:2, morale:10, armor:0, icon:"👑", moraleRegen:2 },
};

// ═══════════════════════════════════════════
// FB定義（役ごとに専用構成＋調整可能な効果量）
// ═══════════════════════════════════════════

// 役ごとの基本軍団構成
const LEGION_BASES = {
  spear_wall: [
    { ...PLAYER_UNIT_POOL.spearman }, { ...PLAYER_UNIT_POOL.spearman },
    { ...PLAYER_UNIT_POOL.spearman }, { ...PLAYER_UNIT_POOL.shieldman },
    { ...PLAYER_UNIT_POOL.commander }, { ...PLAYER_UNIT_POOL.banner },
  ],
  cavalry_charge: [
    { ...PLAYER_UNIT_POOL.cavalry }, { ...PLAYER_UNIT_POOL.cavalry },
    { ...PLAYER_UNIT_POOL.cavalry }, { ...PLAYER_UNIT_POOL.knight },
    { ...PLAYER_UNIT_POOL.archer }, { ...PLAYER_UNIT_POOL.commander },
  ],
  arrow_rain: [
    { ...PLAYER_UNIT_POOL.crossbow }, { ...PLAYER_UNIT_POOL.crossbow },
    { ...PLAYER_UNIT_POOL.crossbow }, { ...PLAYER_UNIT_POOL.shieldman },
    { ...PLAYER_UNIT_POOL.shieldman }, { ...PLAYER_UNIT_POOL.commander },
  ],
  heavy_wall: [
    { ...PLAYER_UNIT_POOL.heavy }, { ...PLAYER_UNIT_POOL.heavy },
    { ...PLAYER_UNIT_POOL.shieldman }, { ...PLAYER_UNIT_POOL.shieldman },
    { ...PLAYER_UNIT_POOL.commander }, { ...PLAYER_UNIT_POOL.banner },
  ],
};

// FB効果適用（役×FB3/FB5×パラメータ）
function applyFBEffect(units, fbKey, fbRank, params) {
  return units.map(u => {
    let nu = { ...u };
    if (fbKey === "spear_wall") {
      // 槍衾：ATK+アーマー（確定値）
      const p = fbRank === "fb3" ? params.spear.fb3 : params.spear.fb5;
      nu.atk   = nu.atk + p.atk;
      nu.armor = nu.armor + p.armor;
      nu.morale = Math.min(nu.morale + (fbRank==="fb3"?1:3), 14);
    } else if (fbKey === "cavalry_charge") {
      // 騎兵突撃：ATK+先制（騎馬系のみ）
      const p = fbRank === "fb3" ? params.cavalry.fb3 : params.cavalry.fb5;
      const isCavalry = nu.id === "cavalry" || nu.id === "knight";
      if (isCavalry) nu.atk = nu.atk + p.atk;
      nu.firstStrike = isCavalry ? true : (nu.firstStrike||false);
      if (fbRank === "fb5") nu.morale = Math.min(nu.morale + p.moraleBonus, 14);
    } else if (fbKey === "arrow_rain") {
      // 弓兵集中：自動射撃ダメージ追加（弓・弩のみ）
      const p = fbRank === "fb3" ? params.arrow.fb3 : params.arrow.fb5;
      const isBow = nu.id === "archer" || nu.id === "crossbow";
      if (isBow) {
        nu.autoShot = (nu.autoShot||0) + p.autoShot;
        nu.atk = nu.atk + p.atk;
        nu.armorPierce = true; // 集中射撃は貫通
      }
      if (fbRank === "fb5" && nu.pos === "rear") nu.atk = nu.atk + 1;
    } else if (fbKey === "heavy_wall") {
      // 重装壁：被ダメ軽減＋アーマー
      const p = fbRank === "fb3" ? params.heavy.fb3 : params.heavy.fb5;
      nu.damageReduction = (nu.damageReduction||0) + p.reduction;
      nu.armor = nu.armor + p.armor;
      if (fbRank === "fb5") nu.moraleFleeThreshold = Math.max(1, (nu.moraleFleeThreshold||3) - p.moraleThresholdMinus);
    }
    return nu;
  });
}

function buildPlayerLegion(fbKey, fbRank, params) {
  const base = LEGION_BASES[fbKey] || LEGION_BASES.spear_wall;
  let units = base.map(u => ({ ...u }));
  if (fbRank !== "none") units = applyFBEffect(units, fbKey, fbRank, params);
  return units.map((u, i) => ({
    ...u, uid:`p_${u.id||u.name}_${i}`,
    currentHp: u.hp, currentMorale: u.morale,
    atkMod:0, fled:false, dead:false,
    damageReduction: u.damageReduction||0,
    firstStrike: u.firstStrike||false,
    moraleRegen: u.moraleRegen||0,
    buffAdjAtk: u.buffAdjAtk||0,
    autoShot: u.autoShot||0,
    armorPierce: u.armorPierce||false,
    moraleFleeThreshold: u.moraleFleeThreshold,
  }));
}

function cloneBossUnits(bossBonus) {
  return BOSS_UNITS_BASE.map((u, i) => {
    const baseMorale = bossBonus.moraleInfinite ? 99 : u.morale + (bossBonus.morale||0);
    return {
      ...u, uid:`boss_${u.id}_${i}`,
      currentHp: u.hp + (bossBonus.hp||0),
      morale: baseMorale,
      currentMorale: baseMorale,
      atk: u.atk + (bossBonus.atk||0),
      armor: u.armor + (bossBonus.armor||0),
      moraleRegen: u.moraleRegen||0,
      atkMod:0, fled:false, dead:false, damageReduction:0,
      firstStrike:false, buffAdjAtk:0, autoShot:0,
    };
  });
}

// ═══════════════════════════════════════════
// 戦闘エンジン（多数 vs 多数）
// ═══════════════════════════════════════════
const FLEE_THRESH = 3;

function aliveUnits(units) { return units.filter(u => !u.fled && !u.dead); }
function getFront(units) { return aliveUnits(units).filter(u => u.pos === "front"); }
function getRear(units)  { return aliveUnits(units).filter(u => u.pos === "rear"); }
function getTarget(units) {
  const f = getFront(units); if (f.length > 0) return f[0];
  const r = getRear(units);  return r.length > 0 ? r[0] : null;
}

function applyMoraleFlee(units, triggeredUnit) {
  // 仲間HP死亡時: 全員士気-2、閾値以下なら連鎖離脱
  for (const u of aliveUnits(units)) {
    u.currentMorale = Math.max(0, u.currentMorale - 2);
    if (u.currentMorale <= FLEE_THRESH) u.fled = true;
  }
}

function applyDebuf(units, debuf) {
  if (!debuf) return units;
  return units.map(u => {
    let nu = { ...u };
    if (debuf.highWall && nu.pos === "rear") {
      nu.atk = Math.max(1, Math.floor(nu.atk * 0.5));
      nu._debufNote = (nu._debufNote||"") + "🏰城壁ATK半減 ";
    }
    if (debuf.breastwork && nu.pos === "front") {
      nu.atk = Math.max(1, Math.floor(nu.atk * 0.5));
      nu._debufNote = (nu._debufNote||"") + "🪨胸壁ATK半減 ";
    }
    if (debuf.defenseNet) {
      nu.atk = Math.max(1, nu.atk - (debuf.defenseNetVal||1));
      nu._debufNote = (nu._debufNote||"") + `🕸️守備ATK-${debuf.defenseNetVal||1} `;
    }
    return nu;
  });
}

function runCombat(playerUnits, bossUnits, maxRounds=15, castleDebuf=null) {
  const log = [];
  let player = applyDebuf(playerUnits.map(u => ({ ...u })), castleDebuf);
  let boss   = bossUnits.map(u => ({ ...u }));

  for (let round = 1; round <= maxRounds; round++) {
    const rLog = { round, events:[] };

    // 1. 士気リジェネ（司令官）- プレイヤー側
    const pCmd = aliveUnits(player).find(u => u.moraleRegen > 0);
    if (pCmd) {
      for (const u of aliveUnits(player)) {
        u.currentMorale = Math.min(u.morale, u.currentMorale + pCmd.moraleRegen);
      }
    }
    // ボス側司令官
    const bCmd = aliveUnits(boss).find(u => u.moraleRegen > 0);
    if (bCmd) {
      for (const u of aliveUnits(boss)) {
        u.currentMorale = Math.min(u.morale, u.currentMorale + bCmd.moraleRegen);
      }
    }

    // 2. 自動射撃（弓兵集中FB）- 全生存ユニットに貫通ダメージ
    const autoShotUnits = aliveUnits(player).filter(u => u.autoShot > 0);
    if (autoShotUnits.length > 0) {
      const totalAutoShot = autoShotUnits.reduce((s,u) => s + u.autoShot, 0);
      const targets = aliveUnits(boss);
      if (targets.length > 0) {
        rLog.events.push({ type:"autoshot", text:`🏹 自動射撃(全体貫通) 総ダメ${totalAutoShot} → 全${targets.length}体へ` });
        for (const bt of targets) {
          bt.currentHp -= totalAutoShot;
          bt.currentMorale = Math.max(0, bt.currentMorale - 1);
          rLog.events.push({ type:"autoshot", text:`  └ ${bt.name}: ${totalAutoShot}ダメ(HP残${Math.max(0,bt.currentHp)})` });
          if (bt.currentHp <= 0) {
            bt.dead = true;
            rLog.events.push({ type:"death", text:`💀 ボス ${bt.name} 消滅` });
            applyMoraleFlee(aliveUnits(boss).filter(u=>u.uid!==bt.uid), bt);
          }
        }
      }
    }
    if (aliveUnits(boss).length === 0) { log.push(rLog); return { winner:"player", rounds:round, log, playerFinal:player, bossFinal:boss }; }

    // 3. プレイヤー先制（騎馬）
    for (const pu of aliveUnits(player).filter(u => u.firstStrike)) {
      const bt = getTarget(boss);
      if (!bt) break;
      const dmg = Math.max(1, (pu.atk + (pu.atkMod||0)) - bt.armor);
      bt.currentHp -= dmg;
      bt.currentMorale = Math.max(0, bt.currentMorale - 1);
      rLog.events.push({ type:"first_strike", text:`⚡ ${pu.name} 先制→${bt.name}: ${dmg}ダメ` });
      if (bt.currentHp <= 0) {
        bt.dead = true;
        rLog.events.push({ type:"death", text:`💀 ボス ${bt.name} 消滅` });
        applyMoraleFlee(aliveUnits(boss), bt);
      }
    }
    if (aliveUnits(boss).length === 0) { log.push(rLog); return { winner:"player", rounds:round, log, playerFinal:player, bossFinal:boss }; }

    // 3. プレイヤー通常攻撃 → ボス前衛/後衛
    const adjBuff = aliveUnits(player).filter(u => u.buffAdjAtk > 0).reduce((s,u) => s + u.buffAdjAtk, 0);
    for (const pu of aliveUnits(player)) {
      const bt = getTarget(boss);
      if (!bt) break;
      const rawAtk = pu.atk + (pu.atkMod||0) + adjBuff;
      const pierce = pu.armorPierce || false;
      let dmg = Math.max(1, rawAtk - (pierce ? 0 : bt.armor));
      if (bt.damageReduction > 0) dmg = Math.ceil(dmg * (1 - bt.damageReduction));
      bt.currentHp -= dmg;
      bt.currentMorale = Math.max(0, bt.currentMorale - 1);
      rLog.events.push({ type:"atk", text:`⚔️ ${pu.name}→${bt.name}: ${dmg}ダメ(HP残${Math.max(0,bt.currentHp)})` });
      if (bt.currentHp <= 0) {
        bt.dead = true;
        rLog.events.push({ type:"death", text:`💀 ボス ${bt.name} 消滅` });
        applyMoraleFlee(aliveUnits(boss).filter(u=>u.uid!==bt.uid), bt);
        if (aliveUnits(boss).length === 0) break;
      }
    }
    if (aliveUnits(boss).length === 0) { log.push(rLog); return { winner:"player", rounds:round, log, playerFinal:player, bossFinal:boss }; }

    // 4. ボス通常攻撃 → プレイヤー前衛/後衛
    for (const bu of aliveUnits(boss)) {
      const pt = getTarget(player);
      if (!pt) break;
      const pierce = bu.armorPierce || false;
      let dmg = Math.max(1, (bu.atk + (bu.atkMod||0)) - (pierce ? 0 : (pt.armor||0)));
      if (pt.damageReduction > 0) dmg = Math.ceil(dmg * (1 - pt.damageReduction));
      pt.currentHp -= dmg;
      pt.currentMorale = Math.max(0, pt.currentMorale - 1);
      rLog.events.push({ type:"boss_atk", text:`👹 ${bu.name}→${pt.name}: ${dmg}ダメ(HP残${Math.max(0,pt.currentHp)})` });
      if (pt.currentHp <= 0) {
        pt.dead = true;
        rLog.events.push({ type:"death", text:`💀 プレイヤー ${pt.name} 消滅` });
        applyMoraleFlee(aliveUnits(player).filter(u=>u.uid!==pt.uid), pt);
        if (aliveUnits(player).length === 0) break;
      } else if (pt.currentMorale <= FLEE_THRESH) {
        pt.fled = true;
        rLog.events.push({ type:"flee", text:`🏳️ ${pt.name} 士気崩壊(士気${pt.currentMorale})` });
        for (const a of aliveUnits(player)) {
          a.currentMorale = Math.max(0, a.currentMorale - 2);
          if (a.currentMorale <= FLEE_THRESH) a.fled = true;
        }
        if (aliveUnits(player).length === 0) break;
      }
    }
    if (aliveUnits(player).length === 0) { log.push(rLog); return { winner:"boss", rounds:round, log, playerFinal:player, bossFinal:boss }; }

    log.push(rLog);
  }
  return { winner:"timeout", rounds:maxRounds, log, playerFinal:player, bossFinal:boss };
}

// ─────────────────────────────────────────
// 戦闘間回復（防衛側のみ・離脱不復帰）
// ─────────────────────────────────────────
function bossInterBattleRecovery(bossFinal) {
  return bossFinal.map(u => {
    if (u.dead) return u; // HP0消滅はそのまま
    if (u.fled) return u; // 士気0離脱も復帰なし
    const baseHp  = BOSS_UNITS_BASE.find(b => b.id === u.id)?.hp ?? u.hp;
    const baseMor = BOSS_UNITS_BASE.find(b => b.id === u.id)?.morale ?? u.morale;
    return {
      ...u,
      currentHp:     Math.min(baseHp,  Math.floor(u.currentHp + baseHp  * 0.3)),
      currentMorale: Math.min(baseMor, Math.floor(u.currentMorale + baseMor * 0.3)),
      fled: false, // 士気回復で復帰はしない（fled=trueのまま = 離脱済）
    };
  }).filter(u => !u.fled); // 離脱ユニットは次戦に出てこない
}

// ─────────────────────────────────────────
// 5シナリオ連戦実行
// ─────────────────────────────────────────
function runAllScenarios(params, bossBonus, castleDebuf) {
  const fbKey = params.selectedFB;

  const scenarios = [
    { key:"s1", label:"圧勝ケース",    labelColor:C.green,   legionA:"fb5", legionB:"fb5" },
    { key:"s2", label:"圧勝ケース②",  labelColor:"#70c070", legionA:"fb5", legionB:"fb3" },
    { key:"s3", label:"モデルケース1", labelColor:C.gold,    legionA:"fb3", legionB:"fb3" },
    { key:"s4", label:"モデルケース2", labelColor:C.orange,  legionA:"fb5", legionB:"none" },
    { key:"s5", label:"辛勝/敗北",    labelColor:C.red,     legionA:"fb3", legionB:"none" },
    { key:"s6", label:"ほぼ負け",      labelColor:"#803030", legionA:"none",legionB:"none" },
  ];

  return scenarios.map(sc => {
    const bossUnitsA = cloneBossUnits(bossBonus);
    const legionA = buildPlayerLegion(fbKey, sc.legionA, params);
    const r1 = runCombat(legionA, bossUnitsA, 15, castleDebuf);

    const bossAfterRecovery = bossInterBattleRecovery(r1.bossFinal);

    const legionB = buildPlayerLegion(fbKey, sc.legionB, params);
    let r2;
    if (aliveUnits(bossAfterRecovery).length === 0) {
      r2 = { winner:"player", rounds:0, log:[], playerFinal:legionB, bossFinal:bossAfterRecovery };
    } else {
      r2 = runCombat(legionB, bossAfterRecovery, 15, castleDebuf);
    }

    // ボス残HP率（第1戦後・第2戦後）
    const bossMaxHp = BOSS_UNITS_BASE.reduce((s,u) => s+u.hp+(bossBonus.hp||0)*BOSS_UNITS_BASE.length/BOSS_UNITS_BASE.length,0);
    const bossHpAfterR1 = r1.bossFinal.reduce((s,u) => s+Math.max(0,u.currentHp),0);
    const bossHpAfterR2 = r2.bossFinal.reduce((s,u) => s+Math.max(0,u.currentHp),0);

    const overallWinner =
      aliveUnits(r2.bossFinal).length === 0 ? "player" :
      aliveUnits(r2.playerFinal).length === 0 && r1.winner !== "player" ? "boss" :
      r2.winner === "player" ? "player" : "boss";

    return { ...sc, r1, r2, fbKey, params,
      bossHpAfterR1, bossHpAfterR2, bossMaxHp,
      r1BossAlive: aliveUnits(r1.bossFinal).length,
      r2BossAlive: aliveUnits(r2.bossFinal).length,
      overallWinner,
      recoveredCount: bossAfterRecovery.length,
    };
  });
}

// ═══════════════════════════════════════════
// UI COMPONENTS
// ═══════════════════════════════════════════
const S = {
  container: { minHeight:"100vh", background:C.bg, color:C.text, fontFamily:"'Georgia','Times New Roman',serif", fontSize:"13px" },
  header: { background:`linear-gradient(180deg,#1a1608,${C.bg})`, borderBottom:`1px solid ${C.border}`, padding:"16px 24px 12px", textAlign:"center" },
  title: { fontSize:"18px", fontWeight:"bold", color:C.gold, letterSpacing:"0.1em", margin:0 },
  sub: { fontSize:"10px", color:C.textDim, marginTop:"3px" },
  body: { maxWidth:"1200px", margin:"0 auto", padding:"12px 16px" },
  panel: { background:C.panel, border:`1px solid ${C.border}`, borderRadius:"4px", padding:"12px", marginBottom:"10px" },
  label: { fontSize:"10px", color:C.goldDim, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:"8px", borderBottom:`1px solid ${C.border}`, paddingBottom:"5px" },
  btn: (active) => ({
    background: active ? `linear-gradient(180deg,#3a2e10,#2a2008)` : `linear-gradient(180deg,#2a2010,#1a1408)`,
    border:`1px solid ${active ? C.gold : C.borderLight}`,
    color: active ? C.gold : C.text, padding:"5px 10px", borderRadius:"3px",
    cursor:"pointer", fontSize:"11px", fontFamily:"inherit",
  }),
  btnRun: { background:`linear-gradient(180deg,#4a3010,#2a1c08)`, border:`1px solid ${C.gold}`, color:C.gold, padding:"9px 28px", fontSize:"13px", fontWeight:"bold", letterSpacing:"0.08em", borderRadius:"3px", cursor:"pointer", fontFamily:"inherit" },
};

function Label({ children }) { return <div style={S.label}>{children}</div>; }

function SliderRow({ label, value, min, max, step=1, onChange, color=C.gold, unit="" }) {
  return (
    <div style={{ marginBottom:"8px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"2px" }}>
        <span style={{ fontSize:"11px", color:C.textDim }}>{label}</span>
        <span style={{ fontSize:"12px", color, fontWeight:"bold" }}>{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width:"100%", accentColor:color }} />
    </div>
  );
}

function MiniHpBar({ current, max, color }) {
  const pct = max > 0 ? Math.min(1, Math.max(0, current/max)) : 0;
  return (
    <div style={{ height:"4px", background:C.border, borderRadius:"2px", overflow:"hidden", marginTop:"2px" }}>
      <div style={{ width:`${pct*100}%`, height:"100%", background:color }} />
    </div>
  );
}

function FBBadge({ rank, fbKey }) {
  const FB_NAMES = { spear_wall:"槍衾", cavalry_charge:"騎兵突撃", arrow_rain:"弓兵集中", heavy_wall:"重装壁" };
  const color = rank==="fb5" ? C.gold : rank==="fb3" ? C.blue : C.textDim;
  const label = rank==="none" ? "FBなし" : `${rank.toUpperCase()} ${FB_NAMES[fbKey]||""}`;
  return <span style={{ fontSize:"10px", color, border:`1px solid ${color}44`, borderRadius:"2px", padding:"1px 6px", background:color+"11" }}>{label}</span>;
}

function WinBadge({ winner }) {
  const m = { player:["🏆 勝利", C.green], boss:["💀 敗北", C.red], timeout:["⏱️ 時間切れ", C.orange] };
  const [lbl, col] = m[winner] || ["—", C.textDim];
  return <span style={{ color:col, fontWeight:"bold", fontSize:"13px" }}>{lbl}</span>;
}

function BossUnitRow({ unit }) {
  const base = BOSS_UNITS_BASE.find(b => b.id === unit.id);
  const maxHp = base?.hp ?? unit.hp;
  const hpPct = maxHp > 0 ? unit.currentHp / maxHp : 0;
  const hpColor = hpPct > 0.5 ? C.green : hpPct > 0.2 ? C.orange : C.red;
  const isDead = unit.dead;
  const isFled = unit.fled && !unit.dead;
  return (
    <div style={{ opacity: isDead||isFled ? 0.4:1, marginBottom:"3px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:"10px" }}>
        <span>{unit.icon} {unit.name}</span>
        <span style={{ color: isDead?C.red : isFled?"#8070a0" : hpColor }}>
          {isDead ? "消滅" : isFled ? "離脱" : `HP${Math.max(0,unit.currentHp)} 士気${unit.currentMorale}`}
        </span>
      </div>
      {!isDead && !isFled && <MiniHpBar current={unit.currentHp} max={maxHp} color={hpColor} />}
    </div>
  );
}

function ScenarioCard({ sc }) {
  const [showLog1, setShowLog1] = useState(false);
  const [showLog2, setShowLog2] = useState(false);
  const { r1, r2, labelColor, label, fbKey, legionA, legionB,
    bossHpAfterR1, bossHpAfterR2, bossMaxHp, overallWinner, recoveredCount } = sc;

  const bossR1Hp = r1.bossFinal.reduce((s,u)=>s+Math.max(0,u.currentHp),0);
  const bossR2Hp = r2.bossFinal.reduce((s,u)=>s+Math.max(0,u.currentHp),0);
  const r1Survived = r1.playerFinal.filter(u=>!u.dead&&!u.fled).length;
  const r2Survived = r2.playerFinal.filter(u=>!u.dead&&!u.fled).length;

  return (
    <div style={{ border:`1px solid ${labelColor}44`, borderRadius:"4px", padding:"10px 12px", marginBottom:"8px", background:labelColor+"08" }}>
      {/* ヘッダー */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"10px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
          <span style={{ color:labelColor, fontWeight:"bold", fontSize:"13px" }}>{label}</span>
          <FBBadge rank={legionA} fbKey={fbKey} />
          <span style={{ fontSize:"10px", color:C.textDim }}>＋</span>
          <FBBadge rank={legionB} fbKey={fbKey} />
        </div>
        <WinBadge winner={overallWinner} />
      </div>

      {/* 2戦グリッド */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 80px 1fr", gap:"8px", alignItems:"start" }}>

        {/* 第1戦 */}
        <div style={{ background:r1.winner==="player"?"#0a180a":"#180a0a", border:`1px solid ${r1.winner==="player"?C.green:C.red}33`, borderRadius:"3px", padding:"8px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"6px" }}>
            <span style={{ fontSize:"10px", color:C.textDim }}>軍団A（第1戦）</span>
            <FBBadge rank={legionA} fbKey={fbKey} />
          </div>
          <div style={{ display:"flex", justifyContent:"space-around", textAlign:"center", marginBottom:"6px" }}>
            <div>
              <div style={{ fontSize:"16px", fontWeight:"bold", color:r1.winner==="player"?C.green:C.red }}>{r1.rounds}</div>
              <div style={{ fontSize:"9px", color:C.textDim }}>ラウンド</div>
            </div>
            <div>
              <div style={{ fontSize:"16px", fontWeight:"bold", color:r1Survived>2?C.green:r1Survived>0?C.orange:C.red }}>{r1Survived}/6</div>
              <div style={{ fontSize:"9px", color:C.textDim }}>生存</div>
            </div>
            <div>
              <div style={{ fontSize:"16px", fontWeight:"bold", color:C.red }}>{bossR1Hp}</div>
              <div style={{ fontSize:"9px", color:C.textDim }}>ボス残HP</div>
            </div>
          </div>
          <button onClick={()=>setShowLog1(v=>!v)} style={{ ...S.btn(showLog1), width:"100%", fontSize:"10px" }}>
            {showLog1?"▲ ログ非表示":"▼ ログ表示"}
          </button>
          {showLog1 && (
            <div style={{ marginTop:"6px", maxHeight:"160px", overflowY:"auto", fontSize:"10px", color:C.textDim }}>
              {r1.log.map(rnd => (
                <div key={rnd.round} style={{ marginBottom:"3px" }}>
                  <span style={{ color:C.gold }}>R{rnd.round}</span>{" "}
                  {rnd.events.map((e,i)=><span key={i} style={{ marginRight:"4px" }}>{e.text}</span>)}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 中間：ボス回復 */}
        <div style={{ textAlign:"center", padding:"6px 0" }}>
          <div style={{ fontSize:"9px", color:C.textDim, marginBottom:"4px" }}>防衛側</div>
          <div style={{ fontSize:"9px", color:C.textDim, marginBottom:"4px" }}>3割回復</div>
          <div style={{ fontSize:"16px" }}>⚕️</div>
          <div style={{ fontSize:"9px", color:C.textDim, marginTop:"4px" }}>{recoveredCount}体</div>
          <div style={{ fontSize:"9px", color:C.textDim }}>残存</div>
          <div style={{ marginTop:"6px" }}>
            {r1.bossFinal.map((u,i) => (
              <div key={i} title={u.name} style={{ fontSize:"13px", opacity:u.dead||u.fled?0.3:1 }}>{u.icon}</div>
            ))}
          </div>
        </div>

        {/* 第2戦 */}
        <div style={{ background:r2.winner==="player"?"#0a180a":"#180a0a", border:`1px solid ${r2.winner==="player"?C.green:C.red}33`, borderRadius:"3px", padding:"8px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"6px" }}>
            <span style={{ fontSize:"10px", color:C.textDim }}>軍団B（第2戦）</span>
            <FBBadge rank={legionB} fbKey={fbKey} />
          </div>
          <div style={{ display:"flex", justifyContent:"space-around", textAlign:"center", marginBottom:"6px" }}>
            <div>
              <div style={{ fontSize:"16px", fontWeight:"bold", color:r2.winner==="player"?C.green:C.red }}>{r2.rounds}</div>
              <div style={{ fontSize:"9px", color:C.textDim }}>ラウンド</div>
            </div>
            <div>
              <div style={{ fontSize:"16px", fontWeight:"bold", color:r2Survived>2?C.green:r2Survived>0?C.orange:C.red }}>{r2Survived}/6</div>
              <div style={{ fontSize:"9px", color:C.textDim }}>生存</div>
            </div>
            <div>
              <div style={{ fontSize:"16px", fontWeight:"bold", color:bossR2Hp===0?C.green:C.red }}>{bossR2Hp}</div>
              <div style={{ fontSize:"9px", color:C.textDim }}>ボス残HP</div>
            </div>
          </div>
          <button onClick={()=>setShowLog2(v=>!v)} style={{ ...S.btn(showLog2), width:"100%", fontSize:"10px" }}>
            {showLog2?"▲ ログ非表示":"▼ ログ表示"}
          </button>
          {showLog2 && (
            <div style={{ marginTop:"6px", maxHeight:"160px", overflowY:"auto", fontSize:"10px", color:C.textDim }}>
              {r2.log.map(rnd => (
                <div key={rnd.round} style={{ marginBottom:"3px" }}>
                  <span style={{ color:C.gold }}>R{rnd.round}</span>{" "}
                  {rnd.events.map((e,i)=><span key={i} style={{ marginRight:"4px" }}>{e.text}</span>)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════
export default function App() {
  // FB選択
  const [selectedFB, setSelectedFB] = useState("spear_wall");

  // 各役のFBパラメータ（確定値 or 検討値）
  const [spearFb3, setSpearFb3] = useState({ atk:2, armor:1 });
  const [spearFb5, setSpearFb5] = useState({ atk:4, armor:3 });
  const [cavFb3,   setCavFb3]   = useState({ atk:3, moraleBonus:0 });
  const [cavFb5,   setCavFb5]   = useState({ atk:5, moraleBonus:2 });
  const [arrowFb3, setArrowFb3] = useState({ autoShot:4, atk:1 });
  const [arrowFb5, setArrowFb5] = useState({ autoShot:7, atk:2 });
  const [heavyFb3, setHeavyFb3] = useState({ reduction:0.25, armor:2, moraleThresholdMinus:0 });
  const [heavyFb5, setHeavyFb5] = useState({ reduction:0.50, armor:3, moraleThresholdMinus:2 });

  // ボスボーナス（城塞ボーナス）
  const [bossHpBonus,      setBossHpBonus]      = useState(0);
  const [bossAtkBonus,     setBossAtkBonus]      = useState(0);
  const [bossArmorBonus,   setBossArmorBonus]    = useState(0);
  const [bossMoraleBonus,  setBossMoraleBonus]   = useState(0);
  const [bossMoraleInfinite, setBossMoraleInfinite] = useState(false);

  // 城塞デバフ（プレイヤー側への制約）
  const [debufHighWall,     setDebufHighWall]     = useState(false);
  const [debufBreastwork,   setDebufBreastwork]   = useState(false);
  const [debufDefenseNet,   setDebufDefenseNet]   = useState(false);
  const [debufDefenseNetVal,setDebufDefenseNetVal]= useState(1);

  const [results, setResults] = useState(null);
  const [hasRun, setHasRun] = useState(false);

  const run = useCallback(() => {
    const params = {
      selectedFB,
      spear:   { fb3: spearFb3, fb5: spearFb5 },
      cavalry: { fb3: cavFb3,   fb5: cavFb5   },
      arrow:   { fb3: arrowFb3, fb5: arrowFb5 },
      heavy:   { fb3: heavyFb3, fb5: heavyFb5 },
    };
    const bossBonus = { hp: bossHpBonus, atk: bossAtkBonus, armor: bossArmorBonus, morale: bossMoraleBonus, moraleInfinite: bossMoraleInfinite };
    const castleDebuf = { highWall: debufHighWall, breastwork: debufBreastwork, defenseNet: debufDefenseNet, defenseNetVal: debufDefenseNetVal };
    const r = runAllScenarios(params, bossBonus, castleDebuf);
    setResults(r);
    setHasRun(true);
  }, [selectedFB, spearFb3, spearFb5, cavFb3, cavFb5, arrowFb3, arrowFb5, heavyFb3, heavyFb5,
      bossHpBonus, bossAtkBonus, bossArmorBonus, bossMoraleBonus, bossMoraleInfinite,
      debufHighWall, debufBreastwork, debufDefenseNet, debufDefenseNetVal]);

  // ボスベースHP合計
  const bossBaseHpTotal = BOSS_UNITS_BASE.reduce((s,u)=>s+u.hp,0);
  const bossBonusHpTotal = BOSS_UNITS_BASE.length * bossHpBonus;

  return (
    <div style={S.container}>
      <div style={S.header}>
        <div style={S.title}>⚔️ 最終ボス連戦シミュレーター</div>
        <div style={S.sub}>軍団A → 防衛側3割回復 → 軍団B　の連戦バランス検証</div>
      </div>

      <div style={S.body}>
        <div style={{ display:"grid", gridTemplateColumns:"280px 1fr", gap:"12px" }}>

          {/* 左パネル：パラメータ */}
          <div>
            {/* ボス構成 */}
            <div style={S.panel}>
              <Label>ボス構成（固定）</Label>
              {BOSS_UNITS_BASE.map((u,i) => (
                <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:"11px", marginBottom:"3px", color:C.textDim }}>
                  <span>{u.icon} {u.name}</span>
                  <span>HP{u.hp} ATK{u.atk} 士気{u.morale}{u.armor?` A${u.armor}`:""}{u.moraleRegen?` 再生${u.moraleRegen}`:""}</span>
                </div>
              ))}
              <div style={{ marginTop:"8px", borderTop:`1px solid ${C.border}`, paddingTop:"6px", fontSize:"11px", color:C.textDim }}>
                ベース合計HP：{bossBaseHpTotal}
                {bossHpBonus > 0 && <span style={{ color:C.orange }}> + {bossBonusHpTotal} = {bossBaseHpTotal+bossBonusHpTotal}</span>}
              </div>
            </div>

            {/* 城塞ボーナス */}
            <div style={S.panel}>
              <Label>城塞ボーナス（ボス強化）</Label>
              <div style={{ fontSize:"10px", color:C.textDim, marginBottom:"6px" }}>全ユニットに一律適用</div>
              <SliderRow label="全ユニット HP+" value={bossHpBonus} min={0} max={20} onChange={setBossHpBonus} color={C.red} unit="" />
              <SliderRow label="全ユニット ATK+" value={bossAtkBonus} min={0} max={5} onChange={setBossAtkBonus} color={C.red} />
              <SliderRow label="全ユニット アーマー+" value={bossArmorBonus} min={0} max={4} onChange={setBossArmorBonus} color={C.red} />
              {/* 士気ボーナス */}
              <div style={{ marginTop:"8px", borderTop:`1px solid ${C.border}`, paddingTop:"8px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"6px" }}>
                  <span style={{ fontSize:"11px", color:C.textDim }}>全ユニット 士気設定</span>
                  <div style={{ display:"flex", gap:"6px" }}>
                    <button
                      onClick={()=>setBossMoraleInfinite(false)}
                      style={{ ...S.btn(!bossMoraleInfinite), fontSize:"10px", padding:"3px 8px" }}>
                      士気+
                    </button>
                    <button
                      onClick={()=>setBossMoraleInfinite(true)}
                      style={{ ...S.btn(bossMoraleInfinite), fontSize:"10px", padding:"3px 8px", color: bossMoraleInfinite ? C.red : C.text, borderColor: bossMoraleInfinite ? C.red : C.borderLight }}>
                      士気99（無限）
                    </button>
                  </div>
                </div>
                {!bossMoraleInfinite ? (
                  <SliderRow label="全ユニット 士気+" value={bossMoraleBonus} min={0} max={10} onChange={setBossMoraleBonus} color={C.purple} />
                ) : (
                  <div style={{ fontSize:"10px", color:C.red, background:"#300a0a", border:`1px solid ${C.red}33`, borderRadius:"3px", padding:"6px 8px" }}>
                    ⚠️ 全ユニット士気99固定。士気崩壊は実質発生しない。<br/>
                    <span style={{ color:C.textDim }}>HP削り切りのみで決着する設計になります。</span>
                  </div>
                )}
                {/* 士気設定後の各ユニット士気プレビュー */}
                {!bossMoraleInfinite && bossMoraleBonus > 0 && (
                  <div style={{ marginTop:"6px" }}>
                    {BOSS_UNITS_BASE.map((u,i) => (
                      <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:"10px", color:C.textDim, marginBottom:"1px" }}>
                        <span>{u.icon} {u.name}</span>
                        <span>{u.morale} <span style={{ color:C.purple }}>→ {Math.min(99, u.morale + bossMoraleBonus)}</span></span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* FBパネル */}
            <div style={S.panel}>
              <Label>フォーメーションボーナス</Label>

              {/* 役選択 */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"5px", marginBottom:"10px" }}>
                {[
                  { key:"spear_wall",      icon:"🗡️", name:"槍衾",     confirmed:true  },
                  { key:"cavalry_charge",  icon:"🐴", name:"騎兵突撃", confirmed:false },
                  { key:"arrow_rain",      icon:"🏹", name:"弓兵集中", confirmed:false },
                  { key:"heavy_wall",      icon:"⚔️", name:"重装壁",   confirmed:false },
                ].map(fb => (
                  <button key={fb.key} onClick={()=>setSelectedFB(fb.key)}
                    style={{ ...S.btn(selectedFB===fb.key), position:"relative", textAlign:"left", padding:"6px 8px" }}>
                    <div style={{ fontSize:"11px" }}>{fb.icon} {fb.name}</div>
                    {fb.confirmed && <div style={{ fontSize:"9px", color:C.green }}>✓ 確定済み</div>}
                    {!fb.confirmed && <div style={{ fontSize:"9px", color:C.orange }}>🔧 検討中</div>}
                  </button>
                ))}
              </div>

              {/* 槍衾パラメータ（確定表示） */}
              {selectedFB === "spear_wall" && (
                <div style={{ padding:"8px", borderRadius:"3px", background:"#0a1208", border:`1px solid ${C.green}44` }}>
                  <div style={{ fontSize:"10px", color:C.green, marginBottom:"6px" }}>✓ 確定値（変更不可）</div>
                  {[["FB3 ATK+", spearFb3.atk],["FB3 アーマー+", spearFb3.armor],["FB5 ATK+", spearFb5.atk],["FB5 アーマー+", spearFb5.armor]].map(([l,v])=>(
                    <div key={l} style={{ display:"flex", justifyContent:"space-between", fontSize:"11px", color:C.textDim, marginBottom:"2px" }}>
                      <span>{l}</span><span style={{ color:C.green, fontWeight:"bold" }}>+{v}</span>
                    </div>
                  ))}
                  <div style={{ fontSize:"9px", color:C.textDim, marginTop:"4px" }}>FB3: 士気+1 / FB5: 士気+3</div>
                </div>
              )}

              {/* 騎兵突撃パラメータ */}
              {selectedFB === "cavalry_charge" && (
                <div style={{ padding:"8px", borderRadius:"3px", background:"#1a0e08", border:`1px solid ${C.orange}44` }}>
                  <div style={{ fontSize:"10px", color:C.orange, marginBottom:"6px" }}>🔧 検討中（騎馬系にATK適用・全員先制）</div>
                  <div style={{ fontSize:"10px", color:C.blue, marginBottom:"4px" }}>FB3</div>
                  <SliderRow label="騎馬ATK+" value={cavFb3.atk} min={0} max={8} onChange={v=>setCavFb3(p=>({...p,atk:v}))} color={C.blue} />
                  <div style={{ fontSize:"10px", color:C.gold, marginBottom:"4px", marginTop:"6px" }}>FB5</div>
                  <SliderRow label="騎馬ATK+" value={cavFb5.atk} min={0} max={10} onChange={v=>setCavFb5(p=>({...p,atk:v}))} color={C.gold} />
                  <SliderRow label="全体士気+" value={cavFb5.moraleBonus} min={0} max={6} onChange={v=>setCavFb5(p=>({...p,moraleBonus:v}))} color={C.gold} />
                  <div style={{ fontSize:"9px", color:C.textDim, marginTop:"4px" }}>先制攻撃は全騎馬に固定付与</div>
                </div>
              )}

              {/* 弓兵集中パラメータ */}
              {selectedFB === "arrow_rain" && (
                <div style={{ padding:"8px", borderRadius:"3px", background:"#080e18", border:`1px solid ${C.blue}44` }}>
                  <div style={{ fontSize:"10px", color:C.blue, marginBottom:"6px" }}>🔧 検討中（弓・弩に自動射撃＋ATK・貫通固定）</div>
                  <div style={{ fontSize:"10px", color:C.blue, marginBottom:"4px" }}>FB3</div>
                  <SliderRow label="自動射撃ダメージ+" value={arrowFb3.autoShot} min={0} max={12} onChange={v=>setArrowFb3(p=>({...p,autoShot:v}))} color={C.blue} />
                  <SliderRow label="ATK+" value={arrowFb3.atk} min={0} max={4} onChange={v=>setArrowFb3(p=>({...p,atk:v}))} color={C.blue} />
                  <div style={{ fontSize:"10px", color:C.gold, marginBottom:"4px", marginTop:"6px" }}>FB5</div>
                  <SliderRow label="自動射撃ダメージ+" value={arrowFb5.autoShot} min={0} max={16} onChange={v=>setArrowFb5(p=>({...p,autoShot:v}))} color={C.gold} />
                  <SliderRow label="ATK+" value={arrowFb5.atk} min={0} max={6} onChange={v=>setArrowFb5(p=>({...p,atk:v}))} color={C.gold} />
                  <div style={{ fontSize:"9px", color:C.textDim, marginTop:"4px" }}>自動射撃はアーマー貫通・FB5は後衛ATK+1追加</div>
                </div>
              )}

              {/* 重装壁パラメータ */}
              {selectedFB === "heavy_wall" && (
                <div style={{ padding:"8px", borderRadius:"3px", background:"#120a18", border:`1px solid ${C.purple}44` }}>
                  <div style={{ fontSize:"10px", color:C.purple, marginBottom:"6px" }}>🔧 検討中（被ダメ軽減＋アーマー）</div>
                  <div style={{ fontSize:"10px", color:C.blue, marginBottom:"4px" }}>FB3</div>
                  <SliderRow label="被ダメ軽減%" value={Math.round(heavyFb3.reduction*100)} min={0} max={50} step={5} onChange={v=>setHeavyFb3(p=>({...p,reduction:v/100}))} color={C.blue} unit="%" />
                  <SliderRow label="アーマー+" value={heavyFb3.armor} min={0} max={6} onChange={v=>setHeavyFb3(p=>({...p,armor:v}))} color={C.blue} />
                  <div style={{ fontSize:"10px", color:C.gold, marginBottom:"4px", marginTop:"6px" }}>FB5</div>
                  <SliderRow label="被ダメ軽減%" value={Math.round(heavyFb5.reduction*100)} min={0} max={75} step={5} onChange={v=>setHeavyFb5(p=>({...p,reduction:v/100}))} color={C.gold} unit="%" />
                  <SliderRow label="アーマー+" value={heavyFb5.armor} min={0} max={8} onChange={v=>setHeavyFb5(p=>({...p,armor:v}))} color={C.gold} />
                  <SliderRow label="士気崩壊ライン-" value={heavyFb5.moraleThresholdMinus} min={0} max={3} onChange={v=>setHeavyFb5(p=>({...p,moraleThresholdMinus:v}))} color={C.gold} />
                </div>
              )}
            </div>

            {/* 城塞デバフ */}
            <div style={S.panel}>
              <Label>城塞デバフ（プレイヤー側制約）</Label>
              <div style={{ fontSize:"10px", color:C.textDim, marginBottom:"8px" }}>本拠地の地形・防備がプレイヤー軍に与える制約</div>

              {/* 高城壁 */}
              <div style={{ marginBottom:"8px", padding:"7px 8px", borderRadius:"3px", background: debufHighWall ? "#1a0e08" : "transparent", border:`1px solid ${debufHighWall ? C.orange : C.border}` }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div>
                    <span style={{ fontSize:"11px", color: debufHighWall ? C.orange : C.textDim }}>🏰 高城壁</span>
                    <div style={{ fontSize:"10px", color:C.textFaint, marginTop:"2px" }}>後衛ユニットATK半減（弩兵・弓兵が壁に阻まれる）</div>
                  </div>
                  <button onClick={()=>setDebufHighWall(v=>!v)} style={{ ...S.btn(debufHighWall), borderColor: debufHighWall ? C.orange : C.borderLight, color: debufHighWall ? C.orange : C.text }}>
                    {debufHighWall ? "ON" : "OFF"}
                  </button>
                </div>
              </div>

              {/* 胸壁 */}
              <div style={{ marginBottom:"8px", padding:"7px 8px", borderRadius:"3px", background: debufBreastwork ? "#0e0e1a" : "transparent", border:`1px solid ${debufBreastwork ? C.purple : C.border}` }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div>
                    <span style={{ fontSize:"11px", color: debufBreastwork ? C.purple : C.textDim }}>🪨 胸壁</span>
                    <div style={{ fontSize:"10px", color:C.textFaint, marginTop:"2px" }}>前衛ユニットATK半減（槍兵が城壁に阻まれ刺せない）</div>
                  </div>
                  <button onClick={()=>setDebufBreastwork(v=>!v)} style={{ ...S.btn(debufBreastwork), borderColor: debufBreastwork ? C.purple : C.borderLight, color: debufBreastwork ? C.purple : C.text }}>
                    {debufBreastwork ? "ON" : "OFF"}
                  </button>
                </div>
              </div>

              {/* 守備網 */}
              <div style={{ padding:"7px 8px", borderRadius:"3px", background: debufDefenseNet ? "#0e1a0e" : "transparent", border:`1px solid ${debufDefenseNet ? C.green : C.border}` }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: debufDefenseNet ? "6px" : 0 }}>
                  <div>
                    <span style={{ fontSize:"11px", color: debufDefenseNet ? C.green : C.textDim }}>🕸️ 守備網</span>
                    <div style={{ fontSize:"10px", color:C.textFaint, marginTop:"2px" }}>全ユニットATKを一律減少（障害物・守備隊の妨害）</div>
                  </div>
                  <button onClick={()=>setDebufDefenseNet(v=>!v)} style={{ ...S.btn(debufDefenseNet), borderColor: debufDefenseNet ? C.green : C.borderLight, color: debufDefenseNet ? C.green : C.text }}>
                    {debufDefenseNet ? "ON" : "OFF"}
                  </button>
                </div>
                {debufDefenseNet && (
                  <SliderRow label="ATK減少量" value={debufDefenseNetVal} min={1} max={3} onChange={setDebufDefenseNetVal} color={C.green} />
                )}
              </div>
            </div>

            {/* 軍団構成凡例 */}
            <div style={S.panel}>
              <Label>軍団構成（選択中の役）</Label>
              {(LEGION_BASES[selectedFB] || LEGION_BASES.spear_wall).map((u,i) => (
                <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:"11px", marginBottom:"3px", color:C.textDim }}>
                  <span>{u.icon||"⚔️"} {u.name}</span>
                  <span>HP{u.hp} ATK{u.atk} 士気{u.morale}{u.armor?` A${u.armor}`:""}</span>
                </div>
              ))}
            </div>

            <div style={{ textAlign:"center", marginTop:"4px" }}>
              <button onClick={run} style={S.btnRun}>▶ シミュレーション実行</button>
            </div>
          </div>

          {/* 右パネル：結果 */}
          <div>
            {!hasRun && (
              <div style={{ ...S.panel, textAlign:"center", padding:"40px", color:C.textDim }}>
                パラメータを設定して「シミュレーション実行」を押してください
              </div>
            )}
            {results && (
              <>
                <div style={S.panel}>
                  <Label>シナリオ別結果（軍団A × 軍団B の連戦）</Label>
                  {/* 凡例 */}
                  <div style={{ display:"flex", gap:"16px", fontSize:"10px", color:C.textDim, marginBottom:"10px" }}>
                    <span><span style={{ color:C.green }}>🏆 勝利</span> = 軍団B撃破成功</span>
                    <span><span style={{ color:C.red }}>💀 敗北</span> = ボス生存</span>
                    <span>⚕️ = 防衛側3割回復（攻撃側回復なし）</span>
                  </div>
                  {results.map(sc => <ScenarioCard key={sc.key} sc={sc} />)}
                </div>

                {/* サマリテーブル */}
                <div style={S.panel}>
                  <Label>バランス判定サマリ</Label>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"11px" }}>
                    <thead>
                      <tr style={{ borderBottom:`1px solid ${C.border}` }}>
                        {["シナリオ","軍団A","軍団B","第1戦","第2戦","総合"].map(h=>(
                          <th key={h} style={{ padding:"4px 8px", textAlign:"left", color:C.goldDim, fontWeight:"normal" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {results.map(sc => (
                        <tr key={sc.key} style={{ borderBottom:`1px solid ${C.border}22` }}>
                          <td style={{ padding:"4px 8px", color:sc.labelColor }}>{sc.label}</td>
                          <td style={{ padding:"4px 8px" }}><FBBadge rank={sc.legionA} fbKey={sc.fbKey} /></td>
                          <td style={{ padding:"4px 8px" }}><FBBadge rank={sc.legionB} fbKey={sc.fbKey} /></td>
                          <td style={{ padding:"4px 8px", color:sc.r1.winner==="player"?C.green:C.red }}>
                            {sc.r1.winner==="player"?"✓":"✗"} {sc.r1.rounds}R
                          </td>
                          <td style={{ padding:"4px 8px", color:sc.r2.winner==="player"?C.green:C.red }}>
                            {sc.r2.winner==="player"?"✓":"✗"} {sc.r2.rounds}R
                          </td>
                          <td style={{ padding:"4px 8px", fontWeight:"bold", color:sc.overallWinner==="player"?C.green:C.red }}>
                            {sc.overallWinner==="player"?"🏆 突破":"💀 敗北"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
