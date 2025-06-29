import React, { useState } from 'react';
import IvCalculator from './components/IvCalculator';
import './App.css'; // App.cssも少しスタイルを追加します
import pokemonData from './data/pokemon.json';

// 新しい計算機の初期状態を生成する関数
const createNewCalculator = (id) => ({
  id,
  pokemonId: 1,
  level: 50,
  nature: 'がんばりや',
  abilityName: 'しんりょく',
  ivs: { hp: 31, attack: 31, defense: 31, spAttack: 31, spDefense: 31, speed: 31 },
  evs: { hp: 0, attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 },
  // statsはIvCalculatorコンポーネント内で計算されるので、ここでは不要
});

function App() {
  // 複数の計算機を管理するState
  const [calculators, setCalculators] = useState([createNewCalculator(1)]);
  // 新しい計算機にユニークなIDを付与するためのカウンター
  const [nextId, setNextId] = useState(2);

  // 計算機を追加する関数
  const addCalculator = () => {
    setCalculators([...calculators, createNewCalculator(nextId)]);
    setNextId(nextId + 1);
  };

  // 計算機を削除する関数
  const removeCalculator = (idToRemove) => {
    setCalculators(calculators.filter(calc => calc.id !== idToRemove));
  };

  // 特定の計算機のデータが変更されたときに呼ばれる関数
  const handleCalculatorChange = (id, updatedData) => {
    setCalculators(calculators.map(calc => {
      if (calc.id !== id) return calc;
      
      const newCalc = { ...calc, ...updatedData };
      
      // ポケモンが変更されたら、特性をそのポケモンの最初のものにリセットする
      if (updatedData.pokemonId) {
        const newPokemon = pokemonData.find(p => p.id === updatedData.pokemonId);
        if (newPokemon && newPokemon.abilities && newPokemon.abilities.length > 0) {
          newCalc.abilityName = newPokemon.abilities[0].name;
        }
      }
      return newCalc;
    }));
  };

  return (
    <div className="App">
      {/* calculators配列をmapでループして、各計算機コンポーネントを描画 */}
      {calculators.map((calcData) => (
        <IvCalculator
          key={calcData.id} // Reactがリストを効率的に管理するための必須のKey
          calculatorData={calcData}
          onDataChange={handleCalculatorChange}
          onRemove={removeCalculator}
        />
      ))}
      
      <div className="add-button-container">
        <button className="add-button" onClick={addCalculator}>
          ＋
        </button>
      </div>
    </div>
  );
}

export default App;