import React, { useState, useEffect, useCallback } from 'react';
import pokemonData from '../data/pokemon.json';
import natureData from '../data/natures.json';
import './IvCalculator.css'; // CSSも後で修正します

// ステータス名とラベルの対応
const STAT_KEYS = ['hp', 'attack', 'defense', 'spAttack', 'spDefense', 'speed'];
const STAT_LABELS = ['HP', 'こうげき', 'ぼうぎょ', 'とくこう', 'とくぼう', 'すばやさ'];

// --- 計算式 ---

// 実数値の計算（順算）
const calculateStat = (base, iv, ev, level, natureMod) => {
  if (base === undefined) return 0;
  return Math.floor(Math.floor(((base * 2 + iv + Math.floor(ev / 4)) * level) / 100 + 5) * natureMod);
};
const calculateHp = (base, iv, ev, level) => {
  if (base === undefined) return 0;
  return Math.floor(((base * 2 + iv + Math.floor(ev / 4)) * level) / 100) + level + 10;
};

// 努力値の計算（逆算）
const calculateEv = (statKey, actual, base, iv, level, natureMod) => {
    if (actual <= 0) return 0;
    let ev;
    if (statKey === 'hp') {
        ev = Math.ceil(( (actual - level - 10) * 100 / level ) - (base * 2) - iv) * 4;
    } else {
        ev = Math.ceil(( (Math.ceil(actual / natureMod) - 5) * 100 / level ) - (base * 2) - iv) * 4;
    }
    // 計算結果が有効な範囲かチェック
    if (ev < 0) return 0;
    if (ev > 252) return 252;
    return ev;
}
// 親からPropsを受け取るように変更
const IvCalculator = ({ calculatorData, onDataChange, onRemove }) => {
  // calculatorDataから値を取り出す
  const { id, pokemonId, level, nature, abilityName, ivs, evs } = calculatorData;

  // 実数値の計算結果を保持するStateは、このコンポーネント内に残す
  const [stats, setStats] = useState({ hp: 0, attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 });
  // --- 再計算ロジック ---
  // 依存配列からcalculatorDataの各要素を直接指定するように変更
  const recalculateStats = useCallback(() => {
    const selectedPokemon = pokemonData.find(p => p.id === pokemonId);
    const selectedNature = natureData.find(n => n.name === nature);
    const selectedAbility = selectedPokemon?.abilities?.find(a => a.name === abilityName);
    if (!selectedPokemon) return;

    const newStats = {};
    STAT_KEYS.forEach(key => {
        const base = selectedPokemon.baseStats[key];
        const iv = ivs[key];
        const ev = evs[key];
        if (key === 'hp') {
            newStats[key] = calculateHp(base, iv, ev, level);
        } else {
            let natureMod = 1.0;
            if (selectedNature.increased === key) natureMod = 1.1;
            if (selectedNature.decreased === key) natureMod = 0.9;
            newStats[key] = calculateStat(base, iv, ev, level, natureMod);
        }
    });
    setStats(newStats);
  }, [pokemonId, level, nature, ivs, evs]); // 依存配列を修正


  // --- 初期表示および親からのデータ変更時の再計算 ---
  useEffect(() => {
    recalculateStats();
  }, [recalculateStats]); // recalculateStatsが変更された時だけ実行
  

  // --- イベントハンドラ ---

  // 基本情報ハンドラ
  const handleBasicInfoChange = (field, value) => {
    onDataChange(id, { [field]: value });
  };
  const handleIvsChange = (newIvs) => {
    onDataChange(id, { ivs: newIvs });
  };

  const handleEvsChange = (newEvs) => {
    onDataChange(id, { evs: newEvs });
  };

  // 個体値・努力値の入力ハンドラ
  const handleIvInputChange = (e) => {
    const { name, value } = e.target;
    const newIvs = { ...ivs, [name]: Math.max(0, Math.min(31, parseInt(value) || 0)) };
    handleIvsChange(newIvs);
  };
  const handleEvInputChange = (e) => {
    const { name, value } = e.target;
    const newEvs = { ...evs, [name]: Math.max(0, Math.min(252, parseInt(value) || 0)) };
    handleEvsChange(newEvs);
  };

  // 実数値変更 → 努力値計算
  const handleStatChange = (e) => {
    const { name: key, value } = e.target;
    const actualStat = parseInt(value) || 0;
    
    // 見た目だけ先に更新
    setStats(prev => ({...prev, [key]: actualStat}));

    const selectedPokemon = pokemonData.find(p => p.id === pokemonId);
    const selectedNature = natureData.find(n => n.name === nature);
    if (!selectedPokemon) return;

    const base = selectedPokemon.baseStats[key];
    const iv = ivs[key];
    let natureMod = 1.0;
    if (key !== 'hp') {
        if (selectedNature.increased === key) natureMod = 1.1;
        if (selectedNature.decreased === key) natureMod = 0.9;
    }

    const newEv = calculateEv(key, actualStat, base, iv, level, natureMod);
    handleEvsChange({ ...evs, [key]: newEv });
  };

  // 賢い努力値増減
  const handleEvStep = (key, direction) => {
    const selectedPokemon = pokemonData.find(p => p.id === pokemonId);
    const selectedNature = natureData.find(n => n.name === nature);
    if (!selectedPokemon) return;

    const base = selectedPokemon.baseStats[key];
    const iv = ivs[key];
    const currentEv = evs[key];
    let newEv = currentEv;

    // 計算用の補助関数を定義
    let natureMod = 1.0;
    if (key !== 'hp') {
      if (selectedNature.increased === key) natureMod = 1.1;
      if (selectedNature.decreased === key) natureMod = 0.9;
    }
    const calcFunc = (evToCalc) => key === 'hp'
      ? calculateHp(base, iv, evToCalc, level)
      : calculateStat(base, iv, evToCalc, level, natureMod);


    if (direction === 'inc') {
      const currentStat = calcFunc(currentEv);
      // 現在の努力値から1ずつ増やし、実数値が上がる瞬間を探す
      for (let testEv = currentEv + 1; testEv <= 252; testEv++) {
        if (calcFunc(testEv) > currentStat) {
          // 実数値が上がった。この実数値になるための「最小」の努力値をセット
          newEv = calculateEv(key, calcFunc(testEv), base, iv, level, natureMod);
          break;
        }
        // ループの最後まで実数値が上がらなかった場合
        if (testEv === 252) {
          newEv = 252;
        }
      }
    } else { // dec
      const currentStat = calcFunc(currentEv);
      if (currentStat === calcFunc(0)) { // 既に最低値なら何もしない
        newEv = 0;
      } else {
        // 現在の努力値から1ずつ減らし、実数値が下がる瞬間を探す
        for (let testEv = currentEv - 1; testEv >= 0; testEv--) {
          if (calcFunc(testEv) < currentStat) {
            // 実数値が下がった。この実数値になるための「最小」の努力値をセット
            newEv = calculateEv(key, calcFunc(testEv), base, iv, level, natureMod);
            break;
          }
          // ループの最後まで実数値が下がらなかった場合
          if (testEv === 0) {
            newEv = 0;
          }
        }
      }
    }
    handleEvsChange({ ...evs, [key]: newEv });
  };
  // 選択中のポケモンの詳細データを取得
  const selectedPokemon = pokemonData.find(p => p.id === pokemonId);

  // 選択中の特性の詳細データを取得
  const selectedAbility = selectedPokemon?.abilities?.find(a => a.name === abilityName);

  // 選択中の性格データを取得
  const selectedNature = natureData.find(n => n.name === nature);

  // 特性変更ハンドラ
  const handleAbilityChange = (e) => {
    onDataChange(id, { abilityName: e.target.value });
  };

  // 「16n」「11n」ボタンがクリックされたときのハンドラを新規追加
  const handleNxButtonClick = (key, multiple) => {
    if (!selectedPokemon) return;

    const currentStat = stats[key];
    const base = selectedPokemon.baseStats[key];
    const iv = ivs[key];
    
    let natureMod = 1.0;
    if (key !== 'hp') {
        if (selectedNature?.increased === key) natureMod = 1.1;
        if (selectedNature?.decreased === key) natureMod = 0.9;
    }

    // 現在の実数値 "以上" で、最も近い倍数を探す
    let targetStat = Math.ceil(currentStat / multiple) * multiple;
    // もし計算結果が現在値と同じかそれ以下なら、次の倍数を目標にする
    if (targetStat <= currentStat) {
        targetStat += multiple;
    }

    // 目標の実数値になるための努力値を逆算
    const newEv = calculateEv(key, targetStat, base, iv, level, natureMod);
    
    // 努力値が252以下の場合のみ、Stateを更新
    if (newEv <= 252) {
        handleEvsChange({ ...evs, [key]: newEv });
    }
  };

  return (
    <div className="calculator-container">
      {/* 削除ボタンを追加 */}
      <button className="remove-button" onClick={() => onRemove(id)}>×</button>

      {/* h1はApp.jsに移動したので削除、代わりにポケモン名を表示 */}
      <h2 className="pokemon-name-header">{pokemonData.find(p => p.id === pokemonId)?.name || 'ポケモン'}</h2>
      
      <div className="basic-info">
        <div className="form-group">
          <label>ポケモン:</label>
          <select value={pokemonId} onChange={(e) => handleBasicInfoChange('pokemonId', parseInt(e.target.value))}>
            {pokemonData.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>レベル:</label>
          <input type="number" value={level} onChange={(e) => handleBasicInfoChange('level', Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))} min="1" max="100" />
        </div>
        <div className="form-group">
          <label>性格:</label>
          <select value={nature} onChange={(e) => handleBasicInfoChange('nature', e.target.value)}>
            {natureData.map(n => <option key={n.name} value={n.name}>{n.name}</option>)}
          </select>
        </div>
      </div>

      {selectedPokemon?.abilities && (
        <div className="ability-section">
          <div className="form-group">
            <label>特性:</label>
            <select value={abilityName} onChange={handleAbilityChange}>
              {selectedPokemon.abilities.map(ability => (
                <option key={ability.name} value={ability.name}>
                  {ability.name}
                </option>
              ))}
            </select>
          </div>
          <p className="ability-flavor-text">
            {selectedAbility?.flavor_text || '特性の説明'}
          </p>
        </div>
      )}

      <div className="stats-grid">
        <div className="grid-header"></div>
        <div className="grid-header">個体値</div>
        <div className="grid-header">努力値</div>
        <div className="grid-header">実数値</div>

        {STAT_KEYS.map((key, i) => {
          // ボタン表示と活性状態の判定ロジック
          let specialButton = null;
          const isNatureBoosted = selectedNature?.increased === key;

          // HPの場合、または性格で上昇補正がかかっている場合にボタン表示を検討
          if (selectedPokemon && (key === 'hp' || isNatureBoosted)) {
            const multiple = key === 'hp' ? 16 : 11;
            const currentStat = stats[key];

            let targetStat = Math.ceil(currentStat / multiple) * multiple;
            if (targetStat <= currentStat) {
              targetStat += multiple;
            }

            let natureMod = 1.0;
            if (isNatureBoosted) {
              natureMod = 1.1;
            }

            // 逆算して、ボタンを押した場合に必要となる努力値を計算
            const requiredEv = calculateEv(
              key,
              targetStat,
              selectedPokemon.baseStats[key],
              ivs[key],
              level,
              natureMod
            );

            const isDisabled = requiredEv > 252;
            const titleText = isDisabled
              ? `努力値が252を超えてしまうため設定できません (必要努力値: ${requiredEv})`
              : `実数値を${targetStat}にする (努力値: ${requiredEv})`;

            specialButton = (
              <button
                className="nx-button"
                onClick={() => handleNxButtonClick(key, multiple)}
                disabled={isDisabled}
                title={titleText}
              >
                {multiple}n
              </button>
            );
          } else {
            // 条件に合致しない場合、ダミーの要素を生成
            specialButton = <div className="nx-button-placeholder"></div>;
          }
          return (
            <React.Fragment key={key}>
              <div className="stat-label">{STAT_LABELS[i]}</div>
              {/* 個体値 */}
              <div><input type="number" name={key} value={ivs[key]} onChange={handleIvInputChange} min="0" max="31" /></div>
              {/* 努力値 */}
              <div className="ev-control">
                <button className="inc-dec-button" onClick={() => handleEvStep(key, 'dec')}>-</button>
                <input type="number" name={key} value={evs[key]} onChange={handleEvInputChange} min="0" max="252" />
                <button className="inc-dec-button" onClick={() => handleEvStep(key, 'inc')}>+</button>
                {/* 計算したボタンをここに追加 */}
                {specialButton}
              </div>
              {/* 実数値 */}
              <div><input type="number" name={key} value={stats[key]} onChange={handleStatChange} /></div>
            </React.Fragment>
          );
        })}
      </div>
       <div className="total-ev">
        合計努力値: {Object.values(evs).reduce((a, b) => a + b, 0)} / 510
      </div>
    </div>
  );
};

export default IvCalculator;