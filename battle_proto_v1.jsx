import { useState, useEffect, useCallback, useRef } from "react";

// ── THEME ───────────────────────────────────────────────────────
const C = {
  bg:          "#0d0b08",
  panel:       "#141108",
  panelLight:  "#1c1810",
  border:      "#2a2416",
  borderLight: "#3d3422",
  gold:        "#c8a84a",
  goldDim:     "#7a6428",
  text:        "#d8c89a",
  textDim:     "#7a6e56",
  textMuted:   "#4a4234",
  red:         "#cc4422",
  redDim:      "#7a2810",
  green:       "#4a8840",
  greenDim:    "#28501a",
  blue:        "#3a6ea8",
  blueDim:     "#1a3a5a",
  warn:        "#c87a20",
  warnDim:     "#6a3c08",
  morale:      "#6ab0d8",
  hp:          "#e06040",
  ap:          "#a0c060",
};

// ── UNIT TEMPLATES ───────────────────────────────────────────────
const UNIT_TEMPLATES = {
  // 軍人
  spearman:  { name: "槍兵",   faction:"military", pos:"front", hp:14, atk:3, morale:6, armor:0, traits:[] },
  shieldman: { name: "盾兵",   faction:"military", pos:"front", hp:22, atk:1, morale:7, armor:2, traits:["TANK"] },
  heavy:     { name: "重装",   faction:"military", pos:"front", hp:20, atk:4, morale:6, armor:0, traits:[] },
  archer:    { name: "弓兵",   faction:"military", pos:"rear",  hp:10, atk:4, morale:5, armor:0, traits:["RANGED"] },
  commander: { name: "司令官", faction:"military", pos:"rear",  hp:12, atk:2, morale:9, armor:0, traits:["COMMANDER"] },
  // 商人
  sellsword: { name: "傭兵剣士", faction:"merchant", pos:"front", hp:12, atk:4, morale:4, armor:0, traits:["MERCENARY"] },
  bodyguard: { name: "用心棒",   faction:"merchant", pos:"front", hp:18, atk:3, morale:5, armor:1, traits:["MERCENARY"] },
  smuggler:  { name: "密輸業者", faction:"merchant", pos:"rear",  hp:8,  atk:5, morale:4, armor:0, traits:["MERCENARY","RANGED"] },
  trader:    { name: "交易商",   faction:"merchant", pos:"rear",  hp:6,  atk:0, morale:7, armor:0, traits:["SUPPORT"] },
};

// ── CARD DEFINITIONS ─────────────────────────────────────────────
const CARDS = {
  // === 軍人カード ===
  charge:      { id:"charge",      name:"突撃命令",   cost:2, faction:"military", type:"buff",   desc:"味方前衛全体のATK×2（このターン）",         effect:"atk_front_double" },
  inspire:     { id:"inspire",     name:"鼓舞の旗",   cost:1, faction:"military", type:"buff",   desc:"味方1体のATK+3・士気+2",                    effect:"buff_one" },
  warGod:      { id:"warGod",      name:"軍神の加護", cost:3, faction:"military", type:"buff",   desc:"全味方ATK+2・アーマー付与（このターン）",    effect:"atk_all_armor" },
  vanguard:    { id:"vanguard",    name:"先陣の誉れ", cost:1, faction:"military", type:"buff",   desc:"前衛1体が2回攻撃",                           effect:"double_strike" },
  rally:       { id:"rally",       name:"戦意高揚",   cost:2, faction:"military", type:"buff",   desc:"全味方士気+4・次ターンATK+1",                effect:"morale_all" },
  shield_wall: { id:"shield_wall", name:"盾の壁",     cost:1, faction:"military", type:"defend", desc:"味方前衛全体にアーマー付与",                  effect:"armor_front" },
  iron_wall:   { id:"iron_wall",   name:"鉄壁陣形",   cost:2, faction:"military", type:"defend", desc:"このターン全味方ダメージ半減",                effect:"half_dmg" },
  panic:       { id:"panic",       name:"恐慌の怒号", cost:2, faction:"military", type:"attack", desc:"敵前衛全体に恐慌（ATK半減・1ターン）",        effect:"panic_front" },
  focus_fire:  { id:"focus_fire",  name:"集中砲火",   cost:2, faction:"military", type:"attack", desc:"敵1体にダメージ×3（アーマー貫通）",           effect:"focus_3x" },
  surround:    { id:"surround",    name:"包囲陣形",   cost:3, faction:"military", type:"attack", desc:"敵全体にダメージ・後衛攻撃可（1ターン）",     effect:"surround" },
  // === 商人カード ===
  rumor:       { id:"rumor",       name:"流言飛語",   cost:2, faction:"merchant", type:"morale", desc:"敵全体の士気-2（傭兵は-4）",                 effect:"morale_enemy_all" },
  bribe:       { id:"bribe",       name:"買収工作",   cost:2, faction:"merchant", type:"morale", desc:"敵傭兵1体を離脱させる（士気0扱い）",          effect:"bribe_mercenary" },
  poison_sup:  { id:"poison_sup",  name:"兵站妨害",   cost:2, faction:"merchant", type:"debuff", desc:"敵全体のATK-2（補給線切断）",                 effect:"atk_enemy_down" },
  gold_rush:   { id:"gold_rush",   name:"金貨ばらまき",cost:1,faction:"merchant", type:"morale", desc:"敵1体の士気-3",                              effect:"morale_enemy_one" },
  double_pay:  { id:"double_pay",  name:"二重賃金",   cost:2, faction:"merchant", type:"buff",   desc:"味方傭兵全体のATK+2・士気+3",                effect:"buff_mercenary" },
};

// ── PRESET ARMIES ────────────────────────────────────────────────
function makeUnit(templateKey, id) {
  const t = UNIT_TEMPLATES[templateKey];
  return {
    ...t,
    id,
    currentHp: t.hp,
    currentMorale: t.morale,
    currentAtk: t.atk,
    currentArmor: t.armor,
    status: "active", // active | routed | dead
    effects: [], // 一時的なバフ/デバフ
  };
}

const PRESET_PLAYER = [
  makeUnit("spearman",  "p1"),
  makeUnit("shieldman", "p2"),
  makeUnit("heavy",     "p3"),
  makeUnit("archer",    "p4"),
  makeUnit("commander", "p5"),
];

const PRESET_ENEMY = [
  makeUnit("sellsword", "e1"),
  makeUnit("bodyguard", "e2"),
  makeUnit("bodyguard", "e3"),
  makeUnit("smuggler",  "e4"),
  makeUnit("trader",    "e5"),
];

const PLAYER_DECK = [
  "charge","inspire","warGod","vanguard","rally",
  "shield_wall","iron_wall","panic","focus_fire","surround",
  "charge","inspire","rally","shield_wall","panic",
];

// ── GAME LOGIC ───────────────────────────────────────────────────
const MORALE_THRESHOLD = 3; // 閾値：これ以下で連鎖崩壊リスク

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function isAlive(u) { return u.status === "active"; }

function getFront(units) {
  return units.filter(u => isAlive(u) && u.pos === "front");
}
function getRear(units) {
  return units.filter(u => isAlive(u) && u.pos === "rear");
}
function getActive(units) {
  return units.filter(u => isAlive(u));
}

function checkMoraleCollapse(unit, allUnits, log) {
  if (unit.status !== "active") return unit;
  if (unit.currentMorale <= 0) {
    log.push({ text: `【士気崩壊】${unit.name} が離脱！`, type: "morale" });
    return { ...unit, status: "routed" };
  }
  // 閾値付近で連鎖リスク
  if (unit.currentMorale <= MORALE_THRESHOLD) {
    // 50%の確率で連鎖崩壊
    if (Math.random() < 0.4) {
      log.push({ text: `【連鎖崩壊】${unit.name} が閾値を下回り離脱！（士気${unit.currentMorale}）`, type: "morale" });
      return { ...unit, status: "routed" };
    }
  }
  return unit;
}

function applyMoraleDamage(unit, amount, log) {
  const newMorale = clamp(unit.currentMorale - amount, 0, 99);
  log.push({ text: `${unit.name} 士気-${amount}（→${newMorale}）`, type: "morale" });
  return { ...unit, currentMorale: newMorale };
}

function autoAttackPhase(attackers, defenders, log) {
  let defClone = defenders.map(u => ({ ...u }));
  let atkClone = attackers.map(u => ({ ...u }));

  // 攻撃側→防衛側
  const attackFront = getFront(atkClone);
  let targetIdx = 0;
  const defFront = defClone.filter(u => isAlive(u) && u.pos === "front");

  attackFront.forEach(atk => {
    if (targetIdx >= defFront.length) return;
    const tgt = defFront[targetIdx];
    const tgtGlobalIdx = defClone.findIndex(u => u.id === tgt.id);
    const dmg = Math.max(0, atk.currentAtk - defClone[tgtGlobalIdx].currentArmor);
    defClone[tgtGlobalIdx] = {
      ...defClone[tgtGlobalIdx],
      currentHp: defClone[tgtGlobalIdx].currentHp - dmg,
    };
    log.push({ text: `${atk.name} → ${tgt.name}（物理${dmg}ダメ）`, type: "attack" });

    // HP死亡
    if (defClone[tgtGlobalIdx].currentHp <= 0) {
      log.push({ text: `【戦死】${tgt.name} が永久消滅！`, type: "death" });
      defClone[tgtGlobalIdx] = { ...defClone[tgtGlobalIdx], status: "dead" };
      // 仲間の士気ダメ
      defClone = defClone.map(u => {
        if (u.id === tgt.id || !isAlive(u)) return u;
        return applyMoraleDamage(u, 2, log);
      });
      targetIdx++;
    }
    // 士気1固定ダメ（被攻撃）
    if (defClone[tgtGlobalIdx].status === "active") {
      defClone[tgtGlobalIdx] = applyMoraleDamage(defClone[tgtGlobalIdx], 1, log);
    }
  });

  // 後衛からも攻撃（RANGED）
  const atkRear = getRear(atkClone).filter(u => u.traits.includes("RANGED"));
  atkRear.forEach(atk => {
    const defActive = getActive(defClone);
    if (defActive.length === 0) return;
    const tgt = defActive[Math.floor(Math.random() * defActive.length)];
    const tgtGlobalIdx = defClone.findIndex(u => u.id === tgt.id);
    const dmg = Math.max(0, atk.currentAtk - defClone[tgtGlobalIdx].currentArmor);
    defClone[tgtGlobalIdx] = {
      ...defClone[tgtGlobalIdx],
      currentHp: defClone[tgtGlobalIdx].currentHp - dmg,
    };
    log.push({ text: `${atk.name}（遠射）→ ${tgt.name}（${dmg}ダメ）`, type: "attack" });
    if (defClone[tgtGlobalIdx].currentHp <= 0) {
      log.push({ text: `【戦死】${tgt.name} が永久消滅！`, type: "death" });
      defClone[tgtGlobalIdx] = { ...defClone[tgtGlobalIdx], status: "dead" };
      defClone = defClone.map(u => {
        if (u.id === tgt.id || !isAlive(u)) return u;
        return applyMoraleDamage(u, 2, log);
      });
    }
  });

  // 司令官の士気回復
  const hasCommander = atkClone.some(u => isAlive(u) && u.traits.includes("COMMANDER"));
  if (hasCommander) {
    atkClone = atkClone.map(u => {
      if (!isAlive(u)) return u;
      const recovered = clamp(u.currentMorale + 2, 0, u.morale);
      if (recovered > u.currentMorale) log.push({ text: `司令官：${u.name} 士気回復+2`, type: "buff" });
      return { ...u, currentMorale: recovered };
    });
  }

  // 士気崩壊チェック
  defClone = defClone.map(u => checkMoraleCollapse(u, defClone, log));
  atkClone = atkClone.map(u => checkMoraleCollapse(u, atkClone, log));

  return { newAttackers: atkClone, newDefenders: defClone };
}

function applyCard(cardId, playerUnits, enemyUnits, targetId, log) {
  const card = CARDS[cardId];
  if (!card) return { playerUnits, enemyUnits };

  let pU = playerUnits.map(u => ({ ...u }));
  let eU = enemyUnits.map(u => ({ ...u }));

  switch (card.effect) {
    case "atk_front_double":
      pU = pU.map(u => u.pos === "front" && isAlive(u) ? { ...u, currentAtk: u.currentAtk * 2 } : u);
      log.push({ text: "突撃命令！前衛ATK×2", type: "buff" });
      break;
    case "buff_one": {
      const tIdx = pU.findIndex(u => u.id === targetId);
      if (tIdx >= 0) {
        pU[tIdx] = { ...pU[tIdx], currentAtk: pU[tIdx].currentAtk + 3, currentMorale: clamp(pU[tIdx].currentMorale + 2, 0, pU[tIdx].morale) };
        log.push({ text: `${pU[tIdx].name} ATK+3・士気+2`, type: "buff" });
      }
      break;
    }
    case "atk_all_armor":
      pU = pU.map(u => isAlive(u) ? { ...u, currentAtk: u.currentAtk + 2, currentArmor: u.currentArmor + 1 } : u);
      log.push({ text: "軍神の加護！全味方ATK+2・アーマー+1", type: "buff" });
      break;
    case "double_strike": {
      const front = pU.find(u => u.pos === "front" && isAlive(u));
      if (front) {
        const tgt = getFront(eU)[0];
        if (tgt) {
          const tIdx = eU.findIndex(u => u.id === tgt.id);
          const dmg = Math.max(0, front.currentAtk - eU[tIdx].currentArmor);
          eU[tIdx] = { ...eU[tIdx], currentHp: eU[tIdx].currentHp - dmg };
          log.push({ text: `${front.name} 二連撃！ ${tgt.name}に追加${dmg}ダメ`, type: "attack" });
          if (eU[tIdx].currentHp <= 0) {
            eU[tIdx] = { ...eU[tIdx], status: "dead" };
            log.push({ text: `【戦死】${tgt.name} 消滅`, type: "death" });
          }
        }
      }
      break;
    }
    case "morale_all":
      pU = pU.map(u => isAlive(u) ? { ...u, currentMorale: clamp(u.currentMorale + 4, 0, u.morale) } : u);
      log.push({ text: "戦意高揚！全味方士気+4", type: "buff" });
      break;
    case "armor_front":
      pU = pU.map(u => u.pos === "front" && isAlive(u) ? { ...u, currentArmor: u.currentArmor + 2 } : u);
      log.push({ text: "盾の壁！前衛アーマー+2", type: "buff" });
      break;
    case "half_dmg":
      pU = pU.map(u => isAlive(u) ? { ...u, halfDmg: true } : u);
      log.push({ text: "鉄壁陣形！このターンダメージ半減", type: "buff" });
      break;
    case "panic_front":
      eU = eU.map(u => u.pos === "front" && isAlive(u) ? { ...u, currentAtk: Math.floor(u.currentAtk / 2) } : u);
      log.push({ text: "恐慌の怒号！敵前衛ATK半減", type: "attack" });
      break;
    case "focus_3x": {
      const etIdx = eU.findIndex(u => u.id === targetId && isAlive(u));
      if (etIdx >= 0) {
        const src = getFront(pU)[0] || getActive(pU)[0];
        if (src) {
          const dmg = src.currentAtk * 3;
          eU[etIdx] = { ...eU[etIdx], currentHp: eU[etIdx].currentHp - dmg };
          log.push({ text: `集中砲火！${eU[etIdx].name}に${dmg}ダメ（アーマー貫通）`, type: "attack" });
          if (eU[etIdx].currentHp <= 0) {
            eU[etIdx] = { ...eU[etIdx], status: "dead" };
            log.push({ text: `【戦死】${eU[etIdx].name} 消滅`, type: "death" });
            eU = eU.map(u => u.id !== eU[etIdx].id && isAlive(u) ? applyMoraleDamage(u, 2, log) : u);
          }
        }
      }
      break;
    }
    case "surround":
      eU = eU.map(u => {
        if (!isAlive(u)) return u;
        const src = getActive(pU)[0];
        const dmg = src ? Math.max(0, src.currentAtk - u.currentArmor) : 2;
        log.push({ text: `包囲！${u.name}に${dmg}ダメ`, type: "attack" });
        const updated = { ...u, currentHp: u.currentHp - dmg };
        if (updated.currentHp <= 0) {
          log.push({ text: `【戦死】${u.name} 消滅`, type: "death" });
          return { ...updated, status: "dead" };
        }
        return updated;
      });
      break;
    case "morale_enemy_all":
      eU = eU.map(u => {
        if (!isAlive(u)) return u;
        const amount = u.traits.includes("MERCENARY") ? 4 : 2;
        return applyMoraleDamage(u, amount, log);
      });
      log.push({ text: "流言飛語！敵全体士気-2（傭兵-4）", type: "morale" });
      break;
    case "bribe_mercenary": {
      const mercs = eU.filter(u => isAlive(u) && u.traits.includes("MERCENARY"));
      if (mercs.length > 0) {
        const tgt = mercs[Math.floor(Math.random() * mercs.length)];
        const tIdx = eU.findIndex(u => u.id === tgt.id);
        eU[tIdx] = { ...eU[tIdx], currentMorale: 0, status: "routed" };
        log.push({ text: `買収工作！${tgt.name} が離脱！`, type: "morale" });
      } else {
        log.push({ text: "買収対象の傭兵がいない", type: "warn" });
      }
      break;
    }
    case "atk_enemy_down":
      eU = eU.map(u => isAlive(u) ? { ...u, currentAtk: Math.max(0, u.currentAtk - 2) } : u);
      log.push({ text: "兵站妨害！敵全体ATK-2", type: "morale" });
      break;
    case "morale_enemy_one": {
      const etIdx2 = eU.findIndex(u => u.id === targetId && isAlive(u));
      if (etIdx2 >= 0) {
        eU[etIdx2] = applyMoraleDamage(eU[etIdx2], 3, log);
        log.push({ text: `金貨ばらまき！${eU[etIdx2].name} 士気-3`, type: "morale" });
      }
      break;
    }
    case "buff_mercenary":
      pU = pU.map(u => isAlive(u) && u.traits.includes("MERCENARY")
        ? { ...u, currentAtk: u.currentAtk + 2, currentMorale: clamp(u.currentMorale + 3, 0, u.morale) } : u);
      log.push({ text: "二重賃金！傭兵ATK+2・士気+3", type: "buff" });
      break;
    default:
      break;
  }

  // 士気崩壊チェック
  eU = eU.map(u => checkMoraleCollapse(u, eU, log));
  pU = pU.map(u => checkMoraleCollapse(u, pU, log));

  return { playerUnits: pU, enemyUnits: eU };
}

// CPU AI（Slay the Spire方式：事前予告）
function planCpuAction(enemyUnits, playerUnits, round) {
  const active = getActive(enemyUnits);
  if (active.length === 0) return { type: "none", desc: "（行動不能）" };
  // ラウンドごとに行動パターンを固定
  const patterns = ["attack", "attack", "morale", "attack", "defend"];
  const pattern = patterns[round % patterns.length];
  if (pattern === "defend") return { type: "defend", desc: "陣形強化中…（防御準備）" };
  if (pattern === "morale") return { type: "morale", desc: "士気を鼓舞中…（士気+3）" };
  const front = getFront(playerUnits);
  const target = front[0] || getActive(playerUnits)[0];
  const attacker = getFront(enemyUnits)[0] || getActive(enemyUnits)[0];
  const dmg = attacker ? Math.max(0, attacker.currentAtk - (target?.currentArmor || 0)) : 0;
  return {
    type: "attack",
    desc: `${attacker?.name || "敵"} → ${target?.name || "自軍"} に攻撃（推定${dmg}ダメ）`,
  };
}

function executeCpuAction(action, enemyUnits, playerUnits, log) {
  let pU = playerUnits.map(u => ({ ...u }));
  let eU = enemyUnits.map(u => ({ ...u }));

  if (action.type === "defend") {
    eU = eU.map(u => isAlive(u) ? { ...u, currentArmor: u.currentArmor + 1 } : u);
    log.push({ text: "敵：陣形強化（アーマー+1）", type: "cpu" });
  } else if (action.type === "morale") {
    eU = eU.map(u => isAlive(u) ? { ...u, currentMorale: clamp(u.currentMorale + 3, 0, u.morale) } : u);
    log.push({ text: "敵：士気鼓舞（全体士気+3）", type: "cpu" });
  } else {
    // attack → 通常攻撃は自動攻撃フェーズに任せる
    log.push({ text: "敵：攻撃準備完了", type: "cpu" });
  }

  pU = pU.map(u => checkMoraleCollapse(u, pU, log));

  return { playerUnits: pU, enemyUnits: eU };
}

function drawCards(deck, hand, count) {
  const newDeck = [...deck];
  const newHand = [...hand];
  for (let i = 0; i < count && newDeck.length > 0; i++) {
    const idx = Math.floor(Math.random() * newDeck.length);
    newHand.push(newDeck.splice(idx, 1)[0]);
  }
  return { deck: newDeck, hand: newHand };
}

function checkBattleEnd(playerUnits, enemyUnits) {
  const pActive = getActive(playerUnits).length;
  const eActive = getActive(enemyUnits).length;
  if (pActive === 0 && eActive === 0) return "draw";
  if (pActive === 0) return "defeat";
  if (eActive === 0) return "victory";
  return null;
}

// ── INITIAL STATE ─────────────────────────────────────────────────
function createInitialState() {
  const shuffled = [...PLAYER_DECK].sort(() => Math.random() - 0.5);
  const { deck, hand } = drawCards(shuffled, [], 5);
  const round = 1;
  const cpuPlan = planCpuAction(PRESET_ENEMY, PRESET_PLAYER, round);
  return {
    phase: "player",       // player | auto | cpu | end
    round,
    ap: 3,
    maxAp: 4,
    playerUnits: PRESET_PLAYER.map(u => ({ ...u })),
    enemyUnits:  PRESET_ENEMY.map(u => ({ ...u })),
    deck,
    hand,
    discard: [],
    log: [
      { text: "─── 戦闘開始 ─── 攻撃側先攻", type: "system" },
      { text: `ラウンド1 開始 — 行動ポイント: 3`, type: "system" },
    ],
    cpuPlan,
    selectedCard: null,
    targetMode: null,       // null | "player" | "enemy"
    selectedTarget: null,
    result: null,           // null | "victory" | "defeat" | "draw"
    showMalliganModal: true,
    malliganDone: false,
    nextRoundAtk: 0,        // 戦意高揚の効果
  };
}

// ── COMPONENTS ────────────────────────────────────────────────────

function MoraleBar({ current, max, name }) {
  const pct = Math.max(0, current / max);
  const color = pct < 0.35 ? C.red : pct < 0.6 ? C.warn : C.morale;
  const isLow = current <= MORALE_THRESHOLD;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
      <span style={{ fontSize: 9, color: C.textDim, width: 26, textAlign: "right" }}>士気</span>
      <div style={{ flex: 1, height: 5, background: "#1a1610", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${pct * 100}%`, height: "100%", background: color, borderRadius: 2,
          boxShadow: isLow ? `0 0 6px ${C.red}80` : "none",
          transition: "width 0.4s ease" }} />
      </div>
      <span style={{ fontSize: 9, color: isLow ? C.red : C.textDim, minWidth: 18, fontWeight: isLow ? "bold" : "normal" }}>
        {current}/{max}
      </span>
      {isLow && <span style={{ fontSize: 8, color: C.red }}>⚠</span>}
    </div>
  );
}

function HpBar({ current, max }) {
  const pct = Math.max(0, current / max);
  const color = pct < 0.3 ? C.red : pct < 0.6 ? C.warn : C.hp;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
      <span style={{ fontSize: 9, color: C.textDim, width: 26, textAlign: "right" }}>HP</span>
      <div style={{ flex: 1, height: 5, background: "#1a1610", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${pct * 100}%`, height: "100%", background: color, borderRadius: 2, transition: "width 0.4s ease" }} />
      </div>
      <span style={{ fontSize: 9, color: C.textDim, minWidth: 18 }}>{current}/{max}</span>
    </div>
  );
}

function UnitCard({ unit, selected, onClick, dimmed, showTarget }) {
  const isDead    = unit.status === "dead";
  const isRouted  = unit.status === "routed";
  const isLowMorale = unit.currentMorale <= MORALE_THRESHOLD && !isDead && !isRouted;

  const borderColor = selected ? C.gold :
    showTarget ? C.red :
    isDead ? "#2a1a10" :
    isRouted ? "#2a2010" :
    isLowMorale ? C.redDim :
    C.border;

  const bgColor = selected ? "#1c1808" :
    showTarget ? "#1c0808" :
    isDead ? "#0f0a08" :
    isRouted ? "#141008" :
    C.panel;

  return (
    <div
      onClick={!isDead && !isRouted && onClick ? onClick : undefined}
      style={{
        background: bgColor,
        border: `1px solid ${borderColor}`,
        borderRadius: 4,
        padding: "8px 10px",
        cursor: isDead || isRouted ? "default" : onClick ? "pointer" : "default",
        opacity: isDead ? 0.4 : isRouted ? 0.6 : dimmed ? 0.5 : 1,
        transition: "all 0.2s",
        position: "relative",
        minWidth: 110,
      }}
    >
      {/* 状態バッジ */}
      {(isDead || isRouted) && (
        <div style={{
          position: "absolute", top: 4, right: 4,
          fontSize: 8, padding: "1px 4px",
          background: isDead ? C.redDim : "#2a2010",
          color: isDead ? C.red : C.warn,
          borderRadius: 2,
        }}>
          {isDead ? "戦死" : "離脱"}
        </div>
      )}
      {isLowMorale && !isDead && !isRouted && (
        <div style={{
          position: "absolute", top: 4, right: 4,
          fontSize: 8, padding: "1px 4px",
          background: C.redDim, color: C.red, borderRadius: 2,
          animation: "pulse 1s ease-in-out infinite",
        }}>⚠ 士気危険</div>
      )}

      {/* 名前 */}
      <div style={{ fontSize: 12, color: isDead || isRouted ? C.textDim : C.text, marginBottom: 4, fontFamily: "serif" }}>
        {unit.name}
        <span style={{ fontSize: 9, color: C.textMuted, marginLeft: 6 }}>
          {unit.pos === "front" ? "前衛" : "後衛"}
        </span>
      </div>

      {/* バー */}
      {!isDead && <HpBar current={unit.currentHp} max={unit.hp} />}
      {!isDead && <MoraleBar current={unit.currentMorale} max={unit.morale} />}

      {/* ステータス */}
      {!isDead && !isRouted && (
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <span style={{ fontSize: 10, color: C.gold }}>ATK {unit.currentAtk}</span>
          {unit.currentArmor > 0 && <span style={{ fontSize: 10, color: C.blue }}>防具 {unit.currentArmor}</span>}
          {unit.traits.map(t => (
            <span key={t} style={{ fontSize: 8, color: C.textDim, border: `1px solid ${C.border}`, padding: "0 3px", borderRadius: 2 }}>
              {t === "COMMANDER" ? "司令官" : t === "MERCENARY" ? "傭兵" : t === "RANGED" ? "遠射" : t === "TANK" ? "重装" : t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function CardWidget({ card, selected, onClick, disabled, tooExpensive }) {
  const typeColor = {
    buff: C.green, defend: C.blue, attack: C.red, morale: C.warn, debuff: C.warn,
  }[card.type] || C.textDim;

  return (
    <div
      onClick={!disabled && onClick ? onClick : undefined}
      style={{
        background: selected ? "#1c1808" : C.panel,
        border: `1.5px solid ${selected ? C.gold : tooExpensive ? C.border : typeColor + "60"}`,
        borderRadius: 5,
        padding: "10px 12px",
        cursor: disabled ? "default" : "pointer",
        opacity: tooExpensive ? 0.4 : disabled ? 0.5 : 1,
        width: 140,
        flexShrink: 0,
        transition: "all 0.15s",
        position: "relative",
      }}
    >
      {/* コストバッジ */}
      <div style={{
        position: "absolute", top: -8, right: 8,
        width: 20, height: 20, borderRadius: "50%",
        background: tooExpensive ? C.textMuted : C.gold,
        color: C.bg, fontSize: 11, fontWeight: "bold",
        display: "flex", alignItems: "center", justifyContent: "center",
        border: `1px solid ${C.bg}`,
      }}>
        {card.cost}
      </div>

      {/* タイプ */}
      <div style={{ fontSize: 8, color: typeColor, letterSpacing: "0.2em", marginBottom: 3, textTransform: "uppercase" }}>
        {{ buff: "強化", defend: "防御", attack: "攻撃", morale: "士気", debuff: "妨害" }[card.type] || card.type}
      </div>

      {/* 名前 */}
      <div style={{ fontSize: 12, color: C.text, marginBottom: 5, fontFamily: "serif" }}>{card.name}</div>

      {/* 説明 */}
      <div style={{ fontSize: 9, color: C.textDim, lineHeight: 1.4 }}>{card.desc}</div>

      {selected && (
        <div style={{ marginTop: 6, fontSize: 9, color: C.gold, textAlign: "center" }}>
          ↑ 対象を選択してください
        </div>
      )}
    </div>
  );
}

function LogEntry({ entry }) {
  const colorMap = {
    system: C.textDim, attack: C.red, morale: C.morale, buff: C.green,
    death: "#ff6040", cpu: C.warn, warn: C.warn,
  };
  const color = colorMap[entry.type] || C.text;
  return (
    <div style={{ fontSize: 10, color, padding: "2px 0", borderBottom: `1px solid ${C.border}`, lineHeight: 1.5 }}>
      {entry.text}
    </div>
  );
}

function APBar({ current, max }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize: 10, color: C.textDim }}>行動ポイント</span>
      {Array.from({ length: max }).map((_, i) => (
        <div key={i} style={{
          width: 16, height: 16, borderRadius: 3,
          background: i < current ? C.ap : "#1a1810",
          border: `1px solid ${i < current ? C.ap : C.border}`,
          transition: "all 0.2s",
        }} />
      ))}
      <span style={{ fontSize: 11, color: C.ap, fontWeight: "bold" }}>{current}/{max}</span>
    </div>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────
export default function BattleProto() {
  const [state, setState] = useState(createInitialState);
  const logRef = useRef(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [state.log]);

  const addLog = useCallback((entries, prevState) => ({
    ...prevState,
    log: [...prevState.log, ...(Array.isArray(entries) ? entries : [entries])],
  }), []);

  // カード選択
  const handleSelectCard = useCallback((cardId) => {
    setState(prev => {
      if (prev.phase !== "player" || prev.result) return prev;
      const card = CARDS[cardId];
      if (!card || card.cost > prev.ap) return prev;

      const needsTarget = ["buff_one", "focus_3x", "morale_enemy_one"].includes(card.effect);
      const needsEnemy  = ["focus_3x", "morale_enemy_one"].includes(card.effect);
      const needsPlayer = ["buff_one"].includes(card.effect);

      if (prev.selectedCard === cardId) {
        return { ...prev, selectedCard: null, targetMode: null, selectedTarget: null };
      }

      return {
        ...prev,
        selectedCard: cardId,
        targetMode: needsTarget ? (needsEnemy ? "enemy" : "player") : null,
        selectedTarget: null,
      };
    });
  }, []);

  // カードプレイ実行
  const handlePlayCard = useCallback((targetId = null) => {
    setState(prev => {
      if (!prev.selectedCard || prev.phase !== "player") return prev;
      const card = CARDS[prev.selectedCard];
      if (!card || card.cost > prev.ap) return prev;

      const log = [];
      log.push({ text: `【プレイ】${card.name}（コスト${card.cost}）`, type: "buff" });

      const { playerUnits, enemyUnits } = applyCard(
        prev.selectedCard, prev.playerUnits, prev.enemyUnits, targetId, log
      );

      const result = checkBattleEnd(playerUnits, enemyUnits);

      const newDiscard = [...prev.discard, prev.selectedCard];
      const newHand = prev.hand.filter(id => id !== prev.selectedCard);
      const newAp = prev.ap - card.cost;

      return {
        ...prev,
        playerUnits,
        enemyUnits,
        hand: newHand,
        discard: newDiscard,
        ap: newAp,
        selectedCard: null,
        targetMode: null,
        selectedTarget: null,
        log: [...prev.log, ...log],
        result: result || prev.result,
      };
    });
  }, []);

  // 対象選択
  const handleSelectTarget = useCallback((unitId) => {
    setState(prev => {
      if (!prev.selectedCard || !prev.targetMode) return prev;
      return { ...prev, selectedTarget: unitId };
    });
    // 自動プレイ
    setTimeout(() => handlePlayCard(unitId), 50);
  }, [handlePlayCard]);

  // ターン終了
  const handleEndTurn = useCallback(() => {
    setState(prev => {
      if (prev.phase !== "player" || prev.result) return prev;
      const log = [];
      log.push({ text: "── ターン終了 → 自動攻撃フェーズ ──", type: "system" });

      // 自動攻撃
      const { newAttackers: pAfterAttack, newDefenders: eAfterAttack } =
        autoAttackPhase(prev.playerUnits, prev.enemyUnits, log);
      log.push({ text: "── 反撃フェーズ ──", type: "system" });
      const { newAttackers: eAfterCounter, newDefenders: pAfterCounter } =
        autoAttackPhase(eAfterAttack, pAfterAttack, log);

      const result = checkBattleEnd(pAfterCounter, eAfterCounter);

      if (result) {
        log.push({ text: `─── 戦闘終了：${result === "victory" ? "🏆 勝利！" : result === "defeat" ? "💀 敗北…" : "引き分け"} ───`, type: "system" });
        return {
          ...prev,
          playerUnits: pAfterCounter,
          enemyUnits: eAfterCounter,
          log: [...prev.log, ...log],
          result,
          phase: "end",
        };
      }

      // 次ラウンド
      const nextRound = prev.round + 1;
      const nextAp = clamp(prev.ap + 1, 0, prev.maxAp); // 残ったAP+1（上限4）
      const drawn = drawCards(prev.deck, prev.hand, 1);
      const cpuPlan = planCpuAction(eAfterCounter, pAfterCounter, nextRound);

      log.push({ text: `── ラウンド ${nextRound} 開始 — 行動ポイント: ${nextAp} ──`, type: "system" });
      log.push({ text: `【CPU予告】${cpuPlan.desc}`, type: "cpu" });

      // 戦意高揚ボーナス適用
      let finalPlayer = pAfterCounter;
      if (prev.nextRoundAtk > 0) {
        finalPlayer = finalPlayer.map(u => isAlive(u) ? { ...u, currentAtk: u.currentAtk + prev.nextRoundAtk } : u);
        log.push({ text: `戦意高揚効果：全味方ATK+${prev.nextRoundAtk}`, type: "buff" });
      }

      return {
        ...prev,
        playerUnits: finalPlayer,
        enemyUnits: eAfterCounter,
        phase: "player",
        round: nextRound,
        ap: nextAp,
        deck: drawn.deck,
        hand: drawn.hand,
        log: [...prev.log, ...log],
        cpuPlan,
        selectedCard: null,
        targetMode: null,
        selectedTarget: null,
        nextRoundAtk: 0,
      };
    });
  }, []);

  // 撤退
  const handleRetreat = useCallback(() => {
    setState(prev => {
      if (prev.phase !== "player" || prev.result) return prev;
      const log = [
        { text: "【撤退】戦場を離脱！士気-3・権威-1", type: "warn" },
        { text: "─── 戦闘終了：撤退 ───", type: "system" },
      ];
      return {
        ...prev,
        log: [...prev.log, ...log],
        result: "retreat",
        phase: "end",
      };
    });
  }, []);

  // マリガン
  const handleMalligan = useCallback((keepIds) => {
    setState(prev => {
      const discard = prev.hand.filter(id => !keepIds.includes(id));
      const keptHand = prev.hand.filter(id => keepIds.includes(id));
      const drawn = drawCards(prev.deck, keptHand, 5 - keptHand.length);
      const cpuPlan = planCpuAction(prev.enemyUnits, prev.playerUnits, prev.round);
      const log = [
        { text: `マリガン完了（${discard.length}枚交換）`, type: "system" },
        { text: `【CPU予告】${cpuPlan.desc}`, type: "cpu" },
      ];
      return {
        ...prev,
        deck: drawn.deck,
        hand: drawn.hand,
        discard: [...prev.discard, ...discard],
        showMalliganModal: false,
        malliganDone: true,
        log: [...prev.log, ...log],
        cpuPlan,
      };
    });
  }, []);

  const s = state;

  return (
    <div style={{
      minHeight: "100vh",
      background: C.bg,
      color: C.text,
      fontFamily: "'Georgia', 'Times New Roman', serif",
      padding: "16px 20px",
      position: "relative",
    }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: ${C.bg}; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 2px; }
      `}</style>

      {/* ── マリガンモーダル ── */}
      {s.showMalliganModal && (
        <MalliganModal hand={s.hand} ap={s.ap} onConfirm={handleMalligan} />
      )}

      {/* ── 結果オーバーレイ ── */}
      {s.result && (
        <ResultOverlay result={s.result} onRestart={() => setState(createInitialState())} />
      )}

      {/* HEADER */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, borderBottom: `1px solid ${C.border}`, paddingBottom: 12 }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: "0.4em", color: C.textDim }}>BATTLE PROTOTYPE v1.0</div>
          <div style={{ fontSize: 16, color: C.gold, letterSpacing: "0.1em" }}>⚔ 戦闘フェーズ — ラウンド {s.round}</div>
        </div>
        <APBar current={s.ap} max={s.maxAp} />
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={handleRetreat} disabled={!!s.result || s.phase !== "player"} style={{
            background: "transparent", border: `1px solid ${C.redDim}`, color: C.red,
            padding: "6px 14px", cursor: "pointer", fontFamily: "serif", fontSize: 11, borderRadius: 3,
            opacity: s.phase !== "player" || s.result ? 0.4 : 1,
          }}>
            撤退
          </button>
          <button onClick={handleEndTurn} disabled={!!s.result || s.phase !== "player"} style={{
            background: s.phase === "player" && !s.result ? "#1c1808" : "transparent",
            border: `1px solid ${s.phase === "player" && !s.result ? C.gold : C.border}`,
            color: s.phase === "player" && !s.result ? C.gold : C.textDim,
            padding: "6px 18px", cursor: "pointer", fontFamily: "serif", fontSize: 12, borderRadius: 3,
          }}>
            ターン終了 →
          </button>
        </div>
      </div>

      {/* CPU予告 */}
      {s.cpuPlan && s.phase === "player" && (
        <div style={{
          background: "#110e06", border: `1px solid ${C.warnDim}`, borderRadius: 4,
          padding: "6px 14px", marginBottom: 12, fontSize: 11, color: C.warn,
        }}>
          🔮 CPU行動予告：{s.cpuPlan.desc}
        </div>
      )}

      {/* メインレイアウト */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 220px", gap: 16, marginBottom: 16 }}>

        {/* 左：戦場 */}
        <div>
          {/* 自軍 */}
          <SidePanel
            label="自軍（プレイヤー）"
            units={s.playerUnits}
            color={C.blue}
            targetMode={s.targetMode === "player" ? "player" : null}
            selectedTarget={s.selectedTarget}
            onSelectTarget={s.targetMode === "player" ? handleSelectTarget : null}
            onCardPlay={s.selectedCard && !s.targetMode ? handlePlayCard : null}
          />

          <div style={{ height: 8 }} />

          {/* 敵軍 */}
          <SidePanel
            label="敵軍（CPU：商人勢力）"
            units={s.enemyUnits}
            color={C.red}
            targetMode={s.targetMode === "enemy" ? "enemy" : null}
            selectedTarget={s.selectedTarget}
            onSelectTarget={s.targetMode === "enemy" ? handleSelectTarget : null}
          />
        </div>

        {/* 右：ログ */}
        <div style={{
          background: C.panel, border: `1px solid ${C.border}`, borderRadius: 4,
          padding: 10, display: "flex", flexDirection: "column",
        }}>
          <div style={{ fontSize: 9, color: C.textDim, letterSpacing: "0.2em", marginBottom: 6 }}>■ 戦闘ログ</div>
          <div ref={logRef} style={{ flex: 1, overflowY: "auto", maxHeight: 320 }}>
            {s.log.map((entry, i) => <LogEntry key={i} entry={entry} />)}
          </div>
        </div>
      </div>

      {/* 手札 */}
      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
        <div style={{ fontSize: 9, color: C.textDim, letterSpacing: "0.2em", marginBottom: 10 }}>
          ■ 手札（{s.hand.length}枚） — デッキ残{s.deck.length}枚
          {s.selectedCard && (
            <span style={{ marginLeft: 12, color: C.gold }}>
              {s.targetMode
                ? `→ ${s.targetMode === "enemy" ? "敵" : "味方"}ユニットをクリックして対象選択`
                : "→ もう一度クリックでプレイ、別カードで切り替え"}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 8 }}>
          {s.hand.length === 0 ? (
            <div style={{ color: C.textDim, fontSize: 11 }}>手札なし（ターン終了でドロー）</div>
          ) : (
            s.hand.map(cardId => {
              const card = CARDS[cardId];
              if (!card) return null;
              const tooExpensive = card.cost > s.ap;
              const isSelected   = s.selectedCard === cardId;
              return (
                <CardWidget
                  key={cardId + Math.random()}
                  card={card}
                  selected={isSelected}
                  disabled={tooExpensive || s.phase !== "player" || !!s.result}
                  tooExpensive={tooExpensive}
                  onClick={() => {
                    if (isSelected && !s.targetMode) {
                      handlePlayCard(null);
                    } else {
                      handleSelectCard(cardId);
                    }
                  }}
                />
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ── SIDE PANEL ────────────────────────────────────────────────────
function SidePanel({ label, units, color, targetMode, selectedTarget, onSelectTarget, onCardPlay }) {
  const front = units.filter(u => u.pos === "front");
  const rear  = units.filter(u => u.pos === "rear");

  return (
    <div style={{ background: C.panel, border: `1px solid ${color}30`, borderRadius: 4, padding: 12 }}>
      <div style={{ fontSize: 10, color, letterSpacing: "0.2em", marginBottom: 10 }}>■ {label}</div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        <span style={{ fontSize: 9, color: C.textDim, alignSelf: "center", minWidth: 30 }}>前衛</span>
        {front.map(u => (
          <UnitCard
            key={u.id}
            unit={u}
            selected={selectedTarget === u.id}
            showTarget={!!targetMode && u.status === "active"}
            onClick={targetMode && u.status === "active"
              ? () => onSelectTarget(u.id)
              : onCardPlay && u.status === "active"
              ? () => onCardPlay(u.id)
              : null}
            dimmed={!!targetMode && u.status !== "active"}
          />
        ))}
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <span style={{ fontSize: 9, color: C.textDim, alignSelf: "center", minWidth: 30 }}>後衛</span>
        {rear.map(u => (
          <UnitCard
            key={u.id}
            unit={u}
            selected={selectedTarget === u.id}
            showTarget={!!targetMode && u.status === "active"}
            onClick={targetMode && u.status === "active"
              ? () => onSelectTarget(u.id)
              : onCardPlay && u.status === "active"
              ? () => onCardPlay(u.id)
              : null}
            dimmed={!!targetMode && u.status !== "active"}
          />
        ))}
      </div>
    </div>
  );
}

// ── MALLIGAN MODAL ────────────────────────────────────────────────
function MalliganModal({ hand, ap, onConfirm }) {
  const [kept, setKept] = useState(hand);

  const toggle = (id) => {
    setKept(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "#000000c0", zIndex: 100,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: C.panelLight, border: `1px solid ${C.goldDim}`, borderRadius: 8,
        padding: 28, maxWidth: 720, width: "90%",
        animation: "fadeIn 0.3s ease",
      }}>
        <div style={{ fontSize: 11, color: C.textDim, letterSpacing: "0.3em", marginBottom: 4 }}>OPENING HAND</div>
        <div style={{ fontSize: 18, color: C.gold, marginBottom: 6 }}>マリガン</div>
        <div style={{ fontSize: 11, color: C.textDim, marginBottom: 18 }}>
          残したいカードをクリックして選択（グレー＝交換、ハイライト＝残す）
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
          {hand.map(cardId => {
            const card = CARDS[cardId];
            if (!card) return null;
            const isKept = kept.includes(cardId);
            return (
              <div key={cardId} onClick={() => toggle(cardId)} style={{
                background: isKept ? "#1c1808" : C.panel,
                border: `1.5px solid ${isKept ? C.gold : C.border}`,
                borderRadius: 5, padding: "10px 12px", cursor: "pointer",
                width: 130, transition: "all 0.15s",
              }}>
                <div style={{ fontSize: 8, color: isKept ? C.gold : C.textDim, marginBottom: 2 }}>
                  {isKept ? "✓ キープ" : "交換"}
                </div>
                <div style={{ fontSize: 13, color: C.text, marginBottom: 4 }}>{card.name}</div>
                <div style={{ fontSize: 9, color: C.textDim }}>{card.desc}</div>
                <div style={{ marginTop: 6, fontSize: 10, color: C.gold }}>コスト {card.cost}</div>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 10, color: C.textDim }}>
            キープ: {kept.length}枚 / 交換: {hand.length - kept.length}枚
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => onConfirm([])} style={{
              background: "transparent", border: `1px solid ${C.border}`,
              color: C.textDim, padding: "7px 16px", cursor: "pointer",
              fontFamily: "serif", fontSize: 11, borderRadius: 3,
            }}>全部交換</button>
            <button onClick={() => onConfirm(kept)} style={{
              background: "#1c1808", border: `1px solid ${C.gold}`,
              color: C.gold, padding: "7px 20px", cursor: "pointer",
              fontFamily: "serif", fontSize: 12, borderRadius: 3,
            }}>決定</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── RESULT OVERLAY ────────────────────────────────────────────────
function ResultOverlay({ result, onRestart }) {
  const config = {
    victory: { label: "🏆 勝利！", color: C.gold,  desc: "敵勢力を撃退した。権威+1" },
    defeat:  { label: "💀 敗北…", color: C.red,   desc: "全軍壊滅。次の策を練れ。" },
    retreat: { label: "🚩 撤退",  color: C.warn,  desc: "損切りに成功。権威-1・士気-3" },
    draw:    { label: "⚖ 引き分け", color: C.blue, desc: "双方消耗。戦線は膠着した。" },
  }[result] || { label: result, color: C.text, desc: "" };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "#000000a0", zIndex: 90,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: C.panelLight, border: `2px solid ${config.color}60`,
        borderRadius: 8, padding: "36px 48px", textAlign: "center",
        animation: "fadeIn 0.4s ease",
      }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>{config.label}</div>
        <div style={{ fontSize: 13, color: C.textDim, marginBottom: 24 }}>{config.desc}</div>
        <button onClick={onRestart} style={{
          background: "#1c1808", border: `1px solid ${C.gold}`,
          color: C.gold, padding: "10px 28px", cursor: "pointer",
          fontFamily: "serif", fontSize: 13, borderRadius: 4,
        }}>
          最初からやり直す
        </button>
      </div>
    </div>
  );
}
