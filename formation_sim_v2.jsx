import { useState, useCallback } from "react";

// ═══════════════════════════════════════════════════════
// THEME
// ═══════════════════════════════════════════════════════
const C = {
  bg: "#0d0b08", panel: "#131108", panelBright: "#1a1810",
  border: "#2e2810", borderLight: "#4a3e20",
  text: "#d4c49a", textDim: "#7a6840", textFaint: "#3a3020",
  gold: "#e8b840", goldDim: "#a07820",
  red: "#d04040", green: "#40a060", blue: "#4080c0", orange: "#d07828",
};

// ═══════════════════════════════════════════════════════
// UNIT DEFINITIONS
// ═══════════════════════════════════════════════════════
const UNITS = {
  spearman:  { id:"spearman",  name:"槍兵",     pos:"front", hp:14, atk:3, morale:6,  armor:0, type:"spear",   icon:"🗡️" },
  shieldman: { id:"shieldman", name:"盾兵",     pos:"front", hp:22, atk:1, morale:7,  armor:2, type:"shield",  icon:"🛡️" },
  heavy:     { id:"heavy",     name:"重装歩兵", pos:"front", hp:20, atk:4, morale:6,  armor:0, type:"heavy",   icon:"⚔️" },
  cavalry:   { id:"cavalry",   name:"騎馬兵",   pos:"front", hp:14, atk:5, morale:5,  armor:0, type:"cavalry", icon:"🐴", firstStrike:true },
  knight:    { id:"knight",    name:"騎士",     pos:"front", hp:22, atk:5, morale:8,  armor:1, type:"cavalry", icon:"⚜️" },
  archer:    { id:"archer",    name:"弓兵",     pos:"rear",  hp:10, atk:4, morale:5,  armor:0, type:"bow",     icon:"🏹", ranged:true },
  crossbow:  { id:"crossbow",  name:"弩兵",     pos:"rear",  hp:10, atk:5, morale:4,  armor:0, type:"bow",     icon:"🎯", ranged:true, armorPierce:true },
  banner:    { id:"banner",    name:"軍旗手",   pos:"rear",  hp:10, atk:1, morale:9,  armor:0, type:"support", icon:"🚩", buffAdjAtk:1 },
  commander: { id:"commander", name:"司令官",   pos:"rear",  hp:12, atk:2, morale:10, armor:0, type:"support", icon:"👑", moraleRegen:2 },
};

// ═══════════════════════════════════════════════════════
// FORMATION BONUS DEFINITIONS
// ═══════════════════════════════════════════════════════
const FORMATIONS = {
  spear_wall: {
    id:"spear_wall", name:"槍衾", icon:"🗡️🗡️🗡️",
    desc:"全員アーマー+3・被ダメ半減", color:"#e8a040",
    bonusSummary:["全員 アーマー +3","全員 被ダメージ 半減"],
    check:(units)=>units.filter(u=>u.type==="spear").length>=3,
    apply:(units)=>units.map(u=>({...u, armor:u.armor+3, damageReduction:(u.damageReduction||0)+0.5})),
    hint:"槍兵×3以上で発動。どの相手にも有効な鉄壁の防御力。",
  },
  cavalry_charge: {
    id:"cavalry_charge", name:"騎兵突撃", icon:"🐴🐴🐴",
    desc:"騎馬ATK×2・士気+4", color:"#d06030",
    bonusSummary:["騎馬系ユニット ATK ×2","全員 士気 +4（崩れにくい）"],
    check:(units)=>units.filter(u=>u.type==="cavalry").length>=3,
    apply:(units)=>units.map(u=>({...u,
      atk: u.type==="cavalry" ? u.atk*2 : u.atk,
      morale: Math.min(u.morale+4,14),
      firstStrike: u.type==="cavalry" ? true : (u.firstStrike||false),
    })),
    hint:"騎馬系×3以上で発動。圧倒的な攻撃力と崩れない士気が武器。",
  },
  arrow_rain: {
    id:"arrow_rain", name:"弓兵集中", icon:"🏹🏹🏹",
    desc:"毎ラウンド貫通自動射撃+5", color:"#4090a0",
    bonusSummary:["毎ラウンド開幕 貫通自動射撃 5ダメ","弓兵 ATK +3"],
    check:(units)=>units.filter(u=>u.type==="bow").length>=3,
    apply:(units)=>units.map(u=>({...u,
      autoShot: u.type==="bow" ? (u.autoShot||0)+5 : (u.autoShot||0),
      atkMod: u.type==="bow" ? (u.atkMod||0)+3 : (u.atkMod||0),
      armorPierce: u.type==="bow" ? true : (u.armorPierce||false),
    })),
    hint:"弓・弩×3以上で発動。毎ラウンドの自動射撃が蓄積する持続ダメージ。",
  },
  heavy_wall: {
    id:"heavy_wall", name:"重装壁", icon:"⚔️🛡️⚔️",
    desc:"被ダメ半減・士気崩壊ライン低下", color:"#8060a0",
    bonusSummary:["全員 被ダメージ 半減","全員 士気 +2・崩壊ライン 5→1"],
    check:(units)=>{
      const h=units.filter(u=>u.type==="heavy").length;
      const s=units.filter(u=>u.type==="shield").length;
      return h>=2&&s>=1;
    },
    apply:(units)=>units.map(u=>({...u,
      damageReduction:(u.damageReduction||0)+0.5,
      moraleFleeThreshold:1,
      morale:Math.min(u.morale+2,14),
    })),
    hint:"重装×2＋盾兵×1で発動。ほぼ壊れない盾役として戦線を維持。",
  },
  mixed_elite: {
    id:"mixed_elite", name:"混成精鋭", icon:"⚜️🚩👑",
    desc:"全員ATK+2・士気+3", color:"#60a060",
    bonusSummary:["全員 ATK +2","全員 士気 +3"],
    check:(units)=>{
      const types=new Set(units.map(u=>u.type));
      return types.size>=4&&units.length>=4;
    },
    apply:(units)=>units.map(u=>({...u,
      atkMod:(u.atkMod||0)+2,
      morale:Math.min(u.morale+3,14),
    })),
    hint:"異なる兵種×4以上で発動。全員が底上げされる万能強化。",
  },
};

// ═══════════════════════════════════════════════════════
// PRESETS
// ═══════════════════════════════════════════════════════
const PRESETS = {
  role_spear:   { name:"槍衾編成",      formation:"spear_wall",    units:[{...UNITS.spearman},{...UNITS.spearman},{...UNITS.spearman},{...UNITS.shieldman},{...UNITS.commander},{...UNITS.banner}] },
  role_cavalry: { name:"騎兵突撃編成",  formation:"cavalry_charge",units:[{...UNITS.cavalry},{...UNITS.cavalry},{...UNITS.knight},{...UNITS.archer},{...UNITS.banner},{...UNITS.commander}] },
  role_arrow:   { name:"弓兵集中編成",  formation:"arrow_rain",    units:[{...UNITS.archer},{...UNITS.archer},{...UNITS.crossbow},{...UNITS.shieldman},{...UNITS.shieldman},{...UNITS.commander}] },
  no_role:      { name:"役なし（バラバラ）",formation:null,         units:[{...UNITS.spearman},{...UNITS.cavalry},{...UNITS.heavy},{...UNITS.archer},{...UNITS.banner},{...UNITS.commander}] },
};

// ═══════════════════════════════════════════════════════
// SIMULATION ENGINE
// ═══════════════════════════════════════════════════════
function cloneUnit(u, idx) {
  return {
    ...u,
    uid:`${u.id||u.name}_${idx}`,
    currentHp:u.hp, currentMorale:u.morale,
    atkMod:u.atkMod||0, fled:false, dead:false,
    autoShot:u.autoShot||0, damageReduction:u.damageReduction||0,
    cavalryImmune:u.cavalryImmune||false,
    firstStrike:u.firstStrike||false,
    moraleRegen:u.moraleRegen||0,
    buffAdjAtk:u.buffAdjAtk||0,
    moraleFleeThreshold:u.moraleFleeThreshold,
  };
}

// 野営回復（HP+30%・士気全回復・離脱復帰・死亡永久消滅）
function campRecovery(prevFinal, formationId) {
  const formation = formationId ? FORMATIONS[formationId] : null;
  let recovered = prevFinal
    .filter(u => !u.dead)
    .map(u => {
      const baseHp  = UNITS[u.id]?.hp ?? u.hp;
      const baseMor = UNITS[u.id]?.morale ?? u.morale;
      const healed  = Math.min(baseHp, Math.floor(u.currentHp + baseHp * 0.3));
      return {
        ...u,
        currentHp:           healed,
        currentMorale:       baseMor,
        fled:                false,
        dead:                false,
        armor:               UNITS[u.id]?.armor        ?? 0,
        atkMod:              0,
        autoShot:            UNITS[u.id]?.autoShot     ?? 0,
        armorPierce:         UNITS[u.id]?.armorPierce  ?? false,
        damageReduction:     0,
        moraleFleeThreshold: undefined,
        firstStrike:         UNITS[u.id]?.firstStrike  ?? false,
      };
    });
  if (formation && recovered.length > 0) {
    recovered = formation.apply(recovered);
  }
  return recovered;
}

function alive(units) { return units.filter(u => !u.fled && !u.dead); }
function getFront(units) { return alive(units).filter(u => u.pos === "front"); }
function getRear(units)  { return alive(units).filter(u => u.pos === "rear"); }
function getTarget(units) {
  const f = getFront(units); if (f.length>0) return f[0];
  const r = getRear(units);  return r.length>0 ? r[0] : null;
}

function runCombat(playerUnits, bossStats, maxRounds=20) {
  const FLEE_DEFAULT = 3;
  const log = [];
  let player = playerUnits.map((u,i) => cloneUnit(u,i));
  let boss = [{
    uid:"boss", name:bossStats.name, pos:"front",
    currentHp:bossStats.hp, currentMorale:bossStats.morale,
    atk:bossStats.atk, armor:bossStats.armor,
    atkMod:0, fled:false, dead:false,
    autoShot:0, damageReduction:0, cavalryImmune:false,
    firstStrike:false, moraleRegen:bossStats.moraleRegen||1,
  }];

  for (let round=1; round<=maxRounds; round++) {
    const rLog = { round, events:[] };

    // 1. 自動射撃（弓兵集中役）
    const archers = alive(player).filter(u=>u.autoShot>0);
    if (archers.length>0 && !boss[0].dead && !boss[0].fled) {
      const total = archers.reduce((s,a)=>s+a.autoShot,0);
      const pierce = archers.some(a=>a.armorPierce);
      const dmg = pierce ? total : Math.max(0, total-boss[0].armor);
      boss[0].currentHp -= dmg;
      rLog.events.push({type:"autoshot", text:`🏹 弓自動射撃${pierce?"(貫通)":""}: ボスに ${dmg} ダメージ`});
      if (boss[0].currentHp<=0) boss[0].dead=true;
    }
    if (alive(boss).length===0) { log.push(rLog); return {winner:"player",rounds:round,log,playerFinal:player,bossFinal:boss}; }

    // 2. 士気リジェネ（司令官）
    for (const u of alive(player)) {
      if (u.moraleRegen>0) alive(player).forEach(a=>{ a.currentMorale=Math.min(a.morale,a.currentMorale+u.moraleRegen); });
    }

    // 3. 先制攻撃（騎兵突撃役）
    for (const fs of alive(player).filter(u=>u.firstStrike)) {
      if (!boss[0].dead && !boss[0].fled) {
        const atk = fs.atk + (fs.atkMod||0);
        const dmg = Math.max(1, atk - boss[0].armor);
        boss[0].currentHp -= dmg;
        boss[0].currentMorale = Math.max(0, boss[0].currentMorale-1);
        rLog.events.push({type:"first_strike", text:`⚡ ${fs.name} 先制: ${dmg} ダメージ`});
        if (boss[0].currentHp<=0) { boss[0].dead=true; break; }
      }
    }
    if (alive(boss).length===0) { log.push(rLog); return {winner:"player",rounds:round,log,playerFinal:player,bossFinal:boss}; }

    // 4. プレイヤー通常攻撃 → ボス
    const adjBuff = alive(player).filter(u=>u.buffAdjAtk>0).reduce((s,u)=>s+u.buffAdjAtk,0);
    for (const pu of alive(player)) {
      if (boss[0].dead||boss[0].fled) break;
      const rawAtk = pu.atk + (pu.atkMod||0) + adjBuff;
      let dmg = Math.max(1, rawAtk - (pu.armorPierce?0:boss[0].armor));
      if (boss[0].damageReduction>0) dmg=Math.ceil(dmg*(1-boss[0].damageReduction));
      boss[0].currentHp -= dmg;
      boss[0].currentMorale = Math.max(0, boss[0].currentMorale-1);
      if (boss[0].currentHp<=0) { boss[0].dead=true; break; }
    }
    if (alive(boss).length===0) { log.push(rLog); return {winner:"player",rounds:round,log,playerFinal:player,bossFinal:boss}; }

    // 5. ボス士気リジェネ
    boss[0].currentMorale = Math.min(bossStats.morale, boss[0].currentMorale+boss[0].moraleRegen);

    // 6. ボス → プレイヤー攻撃
    const bt = getTarget(player);
    if (bt) {
      let bdmg = Math.max(1, boss[0].atk - (bt.armor||0));
      if (bt.damageReduction>0) bdmg=Math.ceil(bdmg*(1-bt.damageReduction));
      bt.currentHp -= bdmg;
      bt.currentMorale = Math.max(0, bt.currentMorale-1);
      rLog.events.push({type:"boss_atk", text:`👹 ボス → ${bt.name}: ${bdmg} ダメージ（HP残:${Math.max(0,bt.currentHp)}）`});
      if (bt.currentHp<=0) {
        bt.dead=true;
        rLog.events.push({type:"death", text:`💀 ${bt.name} 消滅`});
      } else {
        const thresh = bt.moraleFleeThreshold ?? FLEE_DEFAULT;
        if (bt.currentMorale<=thresh) {
          bt.fled=true;
          rLog.events.push({type:"flee", text:`🏳️ ${bt.name} 士気崩壊・離脱（士気:${bt.currentMorale}）`});
          alive(player).forEach(a=>{
            if (!a.fled&&!a.dead) {
              a.currentMorale=Math.max(0,a.currentMorale-2);
              if (a.currentMorale<=(a.moraleFleeThreshold??FLEE_DEFAULT)) a.fled=true;
            }
          });
        }
      }
    }
    if (alive(player).length===0) { log.push(rLog); return {winner:"boss",rounds:round,log,playerFinal:player,bossFinal:boss}; }

    log.push(rLog);
  }
  return {winner:"timeout",rounds:maxRounds,log,playerFinal:player,bossFinal:boss};
}

function buildUnits(presetKey, formationId) {
  const preset = PRESETS[presetKey];
  const formation = formationId ? FORMATIONS[formationId] : null;
  let units = preset.units.map((u,i)=>cloneUnit(u,i));
  if (formation) units = formation.apply(units);
  return units;
}

// ═══════════════════════════════════════════════════════
// HELPER: 戦闘結果を連続シミュレート（全シナリオ共通）
// ═══════════════════════════════════════════════════════
function runTwoBattles(presetKey, formationId, boss1Stats, boss2Stats) {
  const units1 = buildUnits(presetKey, formationId);
  const r1 = runCombat(units1, boss1Stats);

  // 野営回復（HP+30%・士気全回復・離脱復帰・死亡消滅）
  const afterCamp = campRecovery(r1.playerFinal, formationId);
  const campLog = {
    deadCount:     r1.playerFinal.filter(u => u.dead).length,
    fledCount:     r1.playerFinal.filter(u => u.fled && !u.dead).length,
    survivedCount: afterCamp.length,
    unitSnapshots: afterCamp.map(u => ({ name:u.name, icon:u.icon||'⚔️', currentHp:u.currentHp, maxHp:u.hp })),
  };

  let r2;
  if (afterCamp.length === 0) {
    r2 = { winner:"boss", rounds:0, log:[], playerFinal:[], bossFinal:[{...boss2Stats, currentHp:boss2Stats.hp, currentMorale:boss2Stats.morale, dead:false, fled:false}] };
  } else {
    r2 = runCombat(afterCamp, boss2Stats);
  }
  return { r1, r2, campLog };
}

// ═══════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════
const S = {
  container: { minHeight:"100vh", background:C.bg, color:C.text, fontFamily:"'Georgia','Times New Roman',serif" },
  header: { background:`linear-gradient(180deg,#1a1608 0%,${C.bg} 100%)`, borderBottom:`1px solid ${C.border}`, padding:"18px 24px 14px", textAlign:"center" },
  title: { fontSize:"20px", fontWeight:"bold", color:C.gold, letterSpacing:"0.1em", margin:0 },
  subtitle: { fontSize:"11px", color:C.textDim, marginTop:"4px", letterSpacing:"0.07em" },
  body: { maxWidth:"1160px", margin:"0 auto", padding:"16px" },
  panel: { background:C.panel, border:`1px solid ${C.border}`, borderRadius:"4px", padding:"14px", marginBottom:"14px" },
  label: { fontSize:"11px", color:C.goldDim, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:"10px", borderBottom:`1px solid ${C.border}`, paddingBottom:"7px" },
  btn: (active) => ({
    background: active ? `linear-gradient(180deg,#3a2e10,#2a2008)` : `linear-gradient(180deg,#2a2010,#1a1408)`,
    border: `1px solid ${active ? C.gold : C.borderLight}`,
    color: active ? C.gold : C.text,
    padding:"7px 13px", borderRadius:"3px", cursor:"pointer",
    fontSize:"12px", fontFamily:"inherit",
  }),
  btnRun: { background:`linear-gradient(180deg,#4a3010,#2a1c08)`, border:`1px solid ${C.gold}`, color:C.gold, padding:"10px 28px", fontSize:"14px", fontWeight:"bold", letterSpacing:"0.1em", borderRadius:"3px", cursor:"pointer", fontFamily:"inherit" },
};

function SectionLabel({ children }) {
  return <div style={S.label}>{children}</div>;
}

function SliderRow({ label, value, min, max, step=1, onChange, color=C.gold }) {
  return (
    <div style={{ marginBottom:"9px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"2px" }}>
        <span style={{ fontSize:"11px", color:C.textDim }}>{label}</span>
        <span style={{ fontSize:"12px", color, fontWeight:"bold" }}>{value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(Number(e.target.value))} style={{ width:"100%", accentColor:color }} />
    </div>
  );
}

function FormationBadge({ fid }) {
  if (!fid) return <span style={{ fontSize:"10px", color:C.textDim, border:`1px solid ${C.border}`, borderRadius:"2px", padding:"1px 6px" }}>役なし</span>;
  const f = FORMATIONS[fid];
  return <span style={{ fontSize:"10px", color:f.color, border:`1px solid ${f.color}44`, borderRadius:"2px", padding:"1px 6px", background:f.color+"11" }}>{f.icon} {f.name}</span>;
}

function WinBadge({ winner }) {
  const map = { player:["🏆 勝利", C.green], boss:["💀 敗北", C.red], timeout:["⏱️ 時間切れ", C.orange] };
  const [label, color] = map[winner] || ["—", C.textDim];
  return <span style={{ color, fontWeight:"bold", fontSize:"15px" }}>{label}</span>;
}

function BattleResultBlock({ result, label, formationId, bossMaxHp }) {
  if (!result) return null;
  const { winner, rounds, playerFinal, bossFinal } = result;
  const survived = playerFinal.filter(u=>!u.dead&&!u.fled).length;
  const bossHpLeft = Math.max(0, bossFinal[0]?.currentHp||0);
  const bossHpPct = bossMaxHp > 0 ? bossHpLeft/bossMaxHp : 0;
  const hpBarColor = bossHpPct>0.5 ? C.red : bossHpPct>0.2 ? C.orange : C.green;

  return (
    <div style={{
      background: winner==="player" ? "#0a180a" : winner==="boss" ? "#180a0a" : "#181408",
      border:`1px solid ${winner==="player"?C.green:winner==="boss"?C.red:C.orange}33`,
      borderRadius:"4px", padding:"12px",
    }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"8px" }}>
        <span style={{ fontSize:"10px", color:C.textDim }}>{label}</span>
        <FormationBadge fid={formationId} />
      </div>
      <div style={{ textAlign:"center", marginBottom:"10px" }}><WinBadge winner={winner} /></div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"6px", textAlign:"center", marginBottom:"8px" }}>
        <div>
          <div style={{ fontSize:"20px", fontWeight:"bold", color:C.gold }}>{rounds}</div>
          <div style={{ fontSize:"9px", color:C.textDim }}>ラウンド</div>
        </div>
        <div>
          <div style={{ fontSize:"20px", fontWeight:"bold", color:survived>0?C.green:C.red }}>{survived}/{playerFinal.length}</div>
          <div style={{ fontSize:"9px", color:C.textDim }}>生存</div>
        </div>
        <div>
          <div style={{ fontSize:"20px", fontWeight:"bold", color:bossHpPct>0.3?C.red:bossHpPct>0?C.orange:C.green }}>{bossHpLeft}</div>
          <div style={{ fontSize:"9px", color:C.textDim }}>ボス残HP</div>
        </div>
      </div>
      <div style={{ height:"5px", background:C.border, borderRadius:"3px", overflow:"hidden" }}>
        <div style={{ width:`${bossHpPct*100}%`, height:"100%", background:hpBarColor, transition:"width 0.4s" }} />
      </div>
    </div>
  );
}

// 1シナリオ行（役あり or 役なし × 2戦）
function ScenarioRow({ label, color, presetKey, formationId, results, boss1Hp, boss2Hp }) {
  if (!results) return null;
  const { r1, r2, campLog } = results;
  const overallWin  = r1.winner==="player" && r2.winner==="player";
  const overallFail = r1.winner!=="player";

  return (
    <div style={{ border:`1px solid ${color}33`, borderRadius:"4px", padding:"12px", background:color+"06", marginBottom:"10px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"10px" }}>
        <span style={{ color, fontWeight:"bold", fontSize:"13px" }}>{label}</span>
        <div style={{ display:"flex", gap:"6px", alignItems:"center" }}>
          <FormationBadge fid={formationId} />
          <span style={{ fontSize:"11px", color: overallWin ? C.green : overallFail ? C.red : C.orange, marginLeft:"6px" }}>
            {overallWin ? "✓ 2戦突破" : overallFail ? "✗ 1戦目敗北" : "△ 2戦目敗北"}
          </span>
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr auto 1fr", gap:"8px", alignItems:"center" }}>
        <BattleResultBlock result={r1} label="第1戦" formationId={formationId} bossMaxHp={boss1Hp} />

        {/* 野営フェーズ */}
        <div style={{ textAlign:"center", minWidth:"80px" }}>
          <div style={{ fontSize:"16px", marginBottom:"2px" }}>🏕️</div>
          <div style={{ fontSize:"9px", color:C.textDim, marginBottom:"4px" }}>野営回復</div>
          {campLog.deadCount > 0 && (
            <div style={{ fontSize:"10px", color:C.red, marginBottom:"2px" }}>💀 ×{campLog.deadCount} 消滅</div>
          )}
          {campLog.fledCount > 0 && (
            <div style={{ fontSize:"10px", color:C.orange, marginBottom:"2px" }}>🏳️ ×{campLog.fledCount} 復帰</div>
          )}
          <div style={{ color:campLog.survivedCount>0?C.green:C.red, fontSize:"18px", fontWeight:"bold" }}>
            {campLog.survivedCount}
          </div>
          <div style={{ fontSize:"9px", color:C.textDim }}>出陣→</div>
          {/* 野営後HP一覧 */}
          {campLog.unitSnapshots && campLog.unitSnapshots.length > 0 && (
            <div style={{ marginTop:"6px" }}>
              {campLog.unitSnapshots.map((u,i) => {
                const pct = u.maxHp > 0 ? u.currentHp/u.maxHp : 0;
                const barColor = pct > 0.7 ? C.green : pct > 0.4 ? C.orange : C.red;
                return (
                  <div key={i} style={{ marginBottom:"3px" }}>
                    <div style={{ fontSize:"9px", color:C.textDim, textAlign:"left" }}>{u.icon} {u.name}</div>
                    <div style={{ display:"flex", alignItems:"center", gap:"3px" }}>
                      <div style={{ flex:1, height:"3px", background:C.border, borderRadius:"2px", overflow:"hidden" }}>
                        <div style={{ width:`${pct*100}%`, height:"100%", background:barColor }} />
                      </div>
                      <span style={{ fontSize:"9px", color:barColor }}>{u.currentHp}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <BattleResultBlock result={r2} label="第2戦" formationId={formationId} bossMaxHp={boss2Hp} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════
export default function FormationSimV2() {
  // 役あり編成選択
  const [preset1, setPreset1] = useState("role_spear");
  const [preset2, setPreset2] = useState("role_cavalry");

  // 第1戦ボス
  const [b1hp,  setB1hp]  = useState(40);
  const [b1atk, setB1atk] = useState(6);
  const [b1mor, setB1mor] = useState(10);
  const [b1arm, setB1arm] = useState(1);

  // 第2戦ボス
  const [b2hp,  setB2hp]  = useState(80);
  const [b2atk, setB2atk] = useState(10);
  const [b2mor, setB2mor] = useState(14);
  const [b2arm, setB2arm] = useState(3);

  const [results, setResults] = useState(null);
  const [showLog, setShowLog] = useState(null); // "roleA"|"roleB"|"noRole"

  const boss1 = { name:"第1戦ボス", hp:b1hp, atk:b1atk, morale:b1mor, armor:b1arm, moraleRegen:1 };
  const boss2 = { name:"第2戦ボス", hp:b2hp, atk:b2atk, morale:b2mor, armor:b2arm, moraleRegen:1 };

  const runSim = useCallback(() => {
    const f1 = PRESETS[preset1].formation;
    const f2 = PRESETS[preset2].formation;

    const roleA  = runTwoBattles(preset1, f1, boss1, boss2);
    const roleB  = runTwoBattles(preset2, f2, boss1, boss2);
    const noRole = runTwoBattles("no_role", null, boss1, boss2);

    setResults({ roleA, roleB, noRole, f1, f2 });
  }, [preset1, preset2, b1hp, b1atk, b1mor, b1arm, b2hp, b2atk, b2mor, b2arm]);

  const roleKeys = Object.keys(PRESETS).filter(k=>k!=="no_role");

  return (
    <div style={S.container}>
      <div style={S.header}>
        <h1 style={S.title}>⚔ 2戦連続シミュレーター（HP持ち越し）</h1>
        <p style={S.subtitle}>難易度カーブ検証：1戦目消耗 → 2戦目で役ありと役なしの差を確認する</p>
      </div>

      <div style={S.body}>
        <div style={{ display:"grid", gridTemplateColumns:"340px 1fr", gap:"16px" }}>

          {/* ── 設定列 ── */}
          <div>
            {/* 役あり編成A */}
            <div style={S.panel}>
              <SectionLabel>役あり編成 A</SectionLabel>
              {roleKeys.map(k=>{
                const f = FORMATIONS[PRESETS[k].formation];
                return (
                  <button key={k} onClick={()=>setPreset1(k)} style={{ ...S.btn(preset1===k), display:"block", width:"100%", textAlign:"left", marginBottom:"5px", padding:"8px 12px" }}>
                    <div style={{ display:"flex", justifyContent:"space-between" }}>
                      <span>{PRESETS[k].name}</span>
                      <span style={{ color:f?.color, fontSize:"12px" }}>{f?.icon}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* 役あり編成B */}
            <div style={S.panel}>
              <SectionLabel>役あり編成 B</SectionLabel>
              {roleKeys.map(k=>{
                const f = FORMATIONS[PRESETS[k].formation];
                return (
                  <button key={k} onClick={()=>setPreset2(k)} style={{ ...S.btn(preset2===k), display:"block", width:"100%", textAlign:"left", marginBottom:"5px", padding:"8px 12px" }}>
                    <div style={{ display:"flex", justifyContent:"space-between" }}>
                      <span>{PRESETS[k].name}</span>
                      <span style={{ color:f?.color, fontSize:"12px" }}>{f?.icon}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* 第1戦ボス設定 */}
            <div style={S.panel}>
              <SectionLabel>👹 第1戦ボス（序〜中盤）</SectionLabel>
              <SliderRow label="HP"      value={b1hp}  min={20} max={150} step={5}  onChange={setB1hp}  color={C.red} />
              <SliderRow label="攻撃力"  value={b1atk} min={2}  max={18}  step={1}  onChange={setB1atk} color={C.orange} />
              <SliderRow label="士気"    value={b1mor} min={5}  max={20}  step={1}  onChange={setB1mor} color={C.blue} />
              <SliderRow label="アーマー" value={b1arm} min={0} max={6}   step={1}  onChange={setB1arm} color={C.textDim} />
            </div>

            {/* 第2戦ボス設定 */}
            <div style={S.panel}>
              <SectionLabel>💀 第2戦ボス（中〜終盤）</SectionLabel>
              <SliderRow label="HP"      value={b2hp}  min={20} max={200} step={5}  onChange={setB2hp}  color={C.red} />
              <SliderRow label="攻撃力"  value={b2atk} min={2}  max={20}  step={1}  onChange={setB2atk} color={C.orange} />
              <SliderRow label="士気"    value={b2mor} min={5}  max={20}  step={1}  onChange={setB2mor} color={C.blue} />
              <SliderRow label="アーマー" value={b2arm} min={0} max={6}   step={1}  onChange={setB2arm} color={C.textDim} />
            </div>

            {/* 目標設定の目安 */}
            <div style={{ ...S.panel, fontSize:"11px", color:C.textDim, lineHeight:"1.7" }}>
              <SectionLabel>📋 目標バランスの目安</SectionLabel>
              <div>第1戦: 役なし辛勝 / 役あり余裕勝ち</div>
              <div>第2戦: 役なし敗北 / 役あり1つで勝利</div>
              <div style={{ marginTop:"6px", color:C.gold }}>→ この条件が揃えば難易度カーブOK</div>
            </div>

            <div style={{ textAlign:"center" }}>
              <button onClick={runSim} style={S.btnRun}>▶ 2戦シミュレーション実行</button>
            </div>
          </div>

          {/* ── 結果列 ── */}
          <div>
            {results ? (
              <>
                {/* 総合評価 */}
                <div style={S.panel}>
                  <SectionLabel>総合評価</SectionLabel>
                  {(() => {
                    const nr = results.noRole;
                    const rA = results.roleA;
                    const rB = results.roleB;
                    const noPass = nr.r1.winner==="player" && nr.r2.winner==="player";
                    const aPass  = rA.r1.winner==="player" && rA.r2.winner==="player";
                    const bPass  = rB.r1.winner==="player" && rB.r2.winner==="player";

                    const checks = [
                      { label:"役なし: 1戦目突破",      ok: nr.r1.winner==="player" },
                      { label:"役なし: 2戦目敗北",      ok: nr.r2.winner!=="player" },
                      { label:"役あり(A): 2戦突破",     ok: aPass },
                      { label:"役あり(B): 2戦突破",     ok: bPass },
                      { label:"役なし: 2戦はNG",         ok: !noPass },
                    ];
                    const passCount = checks.filter(c=>c.ok).length;

                    return (
                      <div>
                        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"8px", marginBottom:"12px", textAlign:"center" }}>
                          {[
                            { label:"役なし", ok: nr.r1.winner==="player" && nr.r2.winner!=="player", ng: nr.r1.winner!=="player", sub: nr.r1.winner==="player" ? (nr.r2.winner!=="player"?"1戦OK/2戦NG ✓":"2戦も突破 △") : "1戦目敗北" },
                            { label:`役あり A`, ok: aPass, ng: !aPass, sub: aPass?"2戦突破 ✓":"2戦目敗北" },
                            { label:`役あり B`, ok: bPass, ng: !bPass, sub: bPass?"2戦突破 ✓":"2戦目敗北" },
                          ].map((item,i)=>(
                            <div key={i} style={{ background: item.ok ? C.green+"11" : item.ng ? C.red+"11" : C.orange+"11", border:`1px solid ${item.ok?C.green:item.ng?C.red:C.orange}33`, borderRadius:"3px", padding:"8px" }}>
                              <div style={{ fontSize:"11px", color:C.textDim }}>{item.label}</div>
                              <div style={{ fontSize:"12px", color: item.ok?C.green:item.ng?C.red:C.orange, marginTop:"3px" }}>{item.sub}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{ background:C.panelBright, borderRadius:"3px", padding:"10px", fontSize:"11px" }}>
                          <div style={{ color:C.gold, marginBottom:"6px" }}>チェック {passCount}/{checks.length}</div>
                          {checks.map((c,i)=>(
                            <div key={i} style={{ color: c.ok?C.green:C.red, marginBottom:"2px" }}>
                              {c.ok?"✓":"✗"} {c.label}
                            </div>
                          ))}
                          {passCount===checks.length && (
                            <div style={{ color:C.gold, marginTop:"8px", fontWeight:"bold" }}>🎯 理想的な難易度カーブです！</div>
                          )}
                          {passCount<3 && (
                            <div style={{ color:C.orange, marginTop:"8px" }}>
                              {nr.r1.winner!=="player" ? "第1戦ボスのHPを下げましょう" :
                               noPass ? "第2戦ボスのHPを上げましょう" :
                               !aPass && !bPass ? "役ボーナスが弱すぎ or 第2戦ボスが強すぎます" : "あと少し調整してみましょう"}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* 各シナリオ詳細 */}
                <div style={S.panel}>
                  <SectionLabel>シナリオ別詳細</SectionLabel>
                  <ScenarioRow label="役なし（バラバラ）" color={C.textDim} presetKey="no_role" formationId={null} results={results.noRole} boss1Hp={b1hp} boss2Hp={b2hp} />
                  <ScenarioRow label={`役あり A: ${PRESETS[preset1].name}`} color={results.f1 ? FORMATIONS[results.f1].color : C.gold} presetKey={preset1} formationId={results.f1} results={results.roleA} boss1Hp={b1hp} boss2Hp={b2hp} />
                  <ScenarioRow label={`役あり B: ${PRESETS[preset2].name}`} color={results.f2 ? FORMATIONS[results.f2].color : C.gold} presetKey={preset2} formationId={results.f2} results={results.roleB} boss1Hp={b1hp} boss2Hp={b2hp} />
                </div>

                {/* ログ */}
                <div style={S.panel}>
                  <SectionLabel>戦闘ログ</SectionLabel>
                  <div style={{ display:"flex", gap:"6px", marginBottom:"8px" }}>
                    {[["roleA","役あり A"], ["roleB","役あり B"], ["noRole","役なし"]].map(([key,lbl])=>(
                      <button key={key} onClick={()=>setShowLog(showLog===key?null:key)} style={{ ...S.btn(showLog===key), fontSize:"10px", padding:"4px 10px" }}>
                        {lbl}
                      </button>
                    ))}
                  </div>
                  {showLog && (() => {
                    const target = results[showLog];
                    return ["r1","r2"].map(rk=>(
                      <div key={rk} style={{ marginBottom:"10px" }}>
                        <div style={{ fontSize:"10px", color:C.goldDim, marginBottom:"4px" }}>{rk==="r1"?"第1戦":"第2戦"}</div>
                        <div style={{ maxHeight:"160px", overflowY:"auto", background:C.bg, border:`1px solid ${C.border}`, borderRadius:"3px", padding:"8px", fontSize:"10px", lineHeight:"1.7" }}>
                          {target[rk].log.map((rl,i)=>(
                            <div key={i}>
                              <div style={{ color:C.goldDim, borderBottom:`1px solid ${C.border}`, marginBottom:"3px", paddingBottom:"2px", marginTop:i>0?"6px":0 }}>Round {rl.round}</div>
                              {rl.events.length===0
                                ? <div style={{ color:C.textFaint }}>（通常攻撃のみ）</div>
                                : rl.events.map((ev,j)=>(
                                    <div key={j} style={{ color:ev.type==="death"?C.red:ev.type==="flee"?C.orange:ev.type==="autoshot"?C.blue:ev.type==="first_strike"?C.orange:C.textDim }}>{ev.text}</div>
                                  ))
                              }
                            </div>
                          ))}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </>
            ) : (
              <div style={{ ...S.panel, textAlign:"center", padding:"60px 20px", color:C.textDim }}>
                <div style={{ fontSize:"36px", marginBottom:"14px" }}>⚔️⚔️</div>
                <div style={{ fontSize:"13px", marginBottom:"6px" }}>役あり編成A・Bを選択し</div>
                <div style={{ fontSize:"13px", marginBottom:"6px" }}>第1戦・第2戦のボスを設定して</div>
                <div style={{ color:C.gold, fontSize:"14px" }}>「2戦シミュレーション実行」を押してください</div>
                <div style={{ marginTop:"16px", fontSize:"11px", color:C.textFaint }}>
                  目安: 第1戦HP 30〜50 / 第2戦HP 70〜100
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
