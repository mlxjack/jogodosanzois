import React, { useState, useEffect, useRef } from 'react';
import './index.css';
import { db } from './firebase';
import { collection, query, where, getDocs, doc, setDoc, updateDoc } from 'firebase/firestore';

const TOTAL_QUESTIONS = 8;
const TIME_PER_QUESTION = 10;
const OPTIONS_COUNT = 4; // Since we only have 8 total, 4 options is perfect
const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

const hooksData = [
  { id: 1, name: "A1 Kisu", image: "/assets/A1 kisu.png" },
  { id: 2, name: "A4 Kisu", image: "/assets/A4 kisu.png" },
  { id: 3, name: "A5 Kisu", image: "/assets/A5 kisu.png" },
  { id: 4, name: "Akita Sode", image: "/assets/Akita Sode.png" },
  { id: 5, name: "Akita-Kitsune", image: "/assets/Akita-Kitsune.png" },
  { id: 6, name: "Atleta Kisu", image: "/assets/Atleta kisu.png" },
  { id: 7, name: "First Kisu", image: "/assets/First Kisu.png" },
  { id: 8, name: "Kisu Libero", image: "/assets/Kisu Libero.png" }
];

function App() {
  const [lures, setLures] = useState(hooksData);
  const [gameState, setGameState] = useState('login'); // loading, login, playing, gameover, leaderboard
  
  // Player Data
  const [playerName, setPlayerName] = useState('');
  const [playerEmail, setPlayerEmail] = useState('');
  const [playerPhone, setPlayerPhone] = useState('');
  
  // Game Play State
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIME_PER_QUESTION);
  const [selectedOption, setSelectedOption] = useState(null);
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);
  const [scoreAnimation, setScoreAnimation] = useState(null);
  
  // End Game State
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState([]);
  
  const timerRef = useRef(null);

  const startGame = (e) => {
    e.preventDefault();
    if (!playerName.trim() || !playerEmail.trim() || !playerPhone.trim()) return;
    
    // Pick all 8 lures for questions
    let shuffledLures = [...lures].sort(() => 0.5 - Math.random());
    
    // Generate options for each question
    let generatedQuestions = shuffledLures.map(correctLure => {
      let possibleWrongs = lures.filter(l => l.name !== correctLure.name);
      let wrongChoices = possibleWrongs.sort(() => 0.5 - Math.random()).slice(0, OPTIONS_COUNT - 1);
      let options = [correctLure, ...wrongChoices].sort(() => 0.5 - Math.random());
      
      return {
        correct: correctLure,
        options: options
      };
    });
    
    setQuestions(generatedQuestions);
    setCurrentIndex(0);
    setScore(0);
    setIsNewRecord(false);
    setIsFirstTime(false);
    setGameState('playing');
    startTimer();
  };

  const startTimer = () => {
    setTimeLeft(TIME_PER_QUESTION);
    setIsAnswerRevealed(false);
    setSelectedOption(null);
    if (timerRef.current) clearInterval(timerRef.current);
    
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleTimeOut();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleTimeOut = () => {
    setIsAnswerRevealed(true);
    setTimeout(() => {
      nextQuestion();
    }, 2000);
  };

  const handleOptionClick = (option) => {
    if (isAnswerRevealed) return;
    
    clearInterval(timerRef.current);
    setSelectedOption(option);
    setIsAnswerRevealed(true);
    
    const currentQ = questions[currentIndex];
    const isCorrect = option.name === currentQ.correct.name;
    
    if (isCorrect) {
      const basePoints = 100;
      const bonusPoints = timeLeft * 10;
      
      // Step 1: Base points animation
      setScoreAnimation({ step: 'base', amount: basePoints });
      setScore(prev => prev + basePoints);
      
      // Step 2: Time bonus animation after 900ms
      setTimeout(() => {
        if (bonusPoints > 0) {
          setScoreAnimation({ step: 'bonus', amount: bonusPoints });
          setScore(prev => prev + bonusPoints);
        } else {
          setScoreAnimation(null);
        }
      }, 900);
      
      // Step 3: Transition to next question after 1800ms
      setTimeout(() => {
        setScoreAnimation(null);
        nextQuestion();
      }, 1800);
    } else {
      setTimeout(() => {
        nextQuestion();
      }, 2000);
    }
  };

  const nextQuestion = () => {
    if (currentIndex + 1 >= TOTAL_QUESTIONS) {
      endGame();
    } else {
      setCurrentIndex(prev => prev + 1);
      startTimer();
    }
  };

  const endGame = async () => {
    setGameState('gameover');
    await saveScore(score);
  };

  const saveScore = async (finalScore) => {
    setIsSaving(true);
    const dateStr = new Date().toISOString();
    
    if (db) {
      try {
        const rankingRef = collection(db, "ranking_anzois_premium");
        const q = query(rankingRef, where("email", "==", playerEmail.toLowerCase()));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          setIsFirstTime(false);
          const userDoc = querySnapshot.docs[0];
          const userData = userDoc.data();
          const currentPlays = (userData.plays || 1) + 1;
          
          if (finalScore > userData.score) {
            await updateDoc(doc(db, "ranking_anzois_premium", userDoc.id), {
              score: finalScore,
              name: playerName,
              phone: playerPhone,
              date: dateStr,
              plays: currentPlays
            });
            setIsNewRecord(true);
          } else {
            await updateDoc(doc(db, "ranking_anzois_premium", userDoc.id), {
              plays: currentPlays
            });
            setIsNewRecord(false);
          }
        } else {
          setIsFirstTime(true);
          setIsNewRecord(false);
          await setDoc(doc(rankingRef), {
            name: playerName,
            email: playerEmail.toLowerCase(),
            phone: playerPhone,
            score: finalScore,
            date: dateStr,
            plays: 1
          });
        }
      } catch (error) {
        console.error("Erro ao salvar no Firebase: ", error);
        fallbackSaveLocal(finalScore);
      }
    } else {
      fallbackSaveLocal(finalScore);
    }
    setIsSaving(false);
  };

  const fallbackSaveLocal = (finalScore) => {
    const currentLeaderboard = JSON.parse(localStorage.getItem('ranking_anzois_premium_local') || '[]');
    const existingIndex = currentLeaderboard.findIndex(p => p.email.toLowerCase() === playerEmail.toLowerCase());
    
    if (existingIndex >= 0) {
      setIsFirstTime(false);
      const currentPlays = (currentLeaderboard[existingIndex].plays || 1) + 1;
      currentLeaderboard[existingIndex].plays = currentPlays;
      
      if (finalScore > currentLeaderboard[existingIndex].score) {
        currentLeaderboard[existingIndex].score = finalScore;
        currentLeaderboard[existingIndex].name = playerName;
        currentLeaderboard[existingIndex].phone = playerPhone;
        currentLeaderboard[existingIndex].date = new Date().toISOString();
        setIsNewRecord(true);
      } else {
        setIsNewRecord(false);
      }
    } else {
      setIsFirstTime(true);
      setIsNewRecord(false);
      currentLeaderboard.push({ 
        name: playerName, 
        email: playerEmail.toLowerCase(),
        phone: playerPhone,
        score: finalScore, 
        date: new Date().toISOString(),
        plays: 1
      });
    }
    
    currentLeaderboard.sort((a, b) => b.score - a.score);
    localStorage.setItem('ranking_anzois_premium_local', JSON.stringify(currentLeaderboard));
  };

  const loadLeaderboard = async () => {
    setGameState('leaderboard');
    if (db) {
      try {
        const rankingRef = collection(db, "ranking_anzois_premium");
        const querySnapshot = await getDocs(rankingRef);
        const lbData = [];
        querySnapshot.forEach((doc) => {
          lbData.push(doc.data());
        });
        lbData.sort((a, b) => b.score - a.score);
        setLeaderboardData(lbData.slice(0, 10)); // Top 10
      } catch (error) {
        console.error("Erro ao carregar ranking do Firebase", error);
        setLeaderboardData(JSON.parse(localStorage.getItem('ranking_anzois_premium_local') || '[]').slice(0, 10));
      }
    } else {
      setLeaderboardData(JSON.parse(localStorage.getItem('ranking_anzois_premium_local') || '[]').slice(0, 10));
    }
  };

  const renderLogin = () => (
    <div className="card">
      <img src="/assets/Kisu Libero.png" alt="Anzóis Premium" className="logo" style={{height: '100px'}} />
      <h2>Desafio Anzóis Premium</h2>
      <p style={{marginBottom: '2rem', color: '#a1a1aa', marginTop: '10px'}}>
        Mostre que você conhece todos os modelos premium da Chumbada Oficial.
      </p>
      
      {!db && (
        <div style={{background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#ef4444', padding: '10px', borderRadius: '8px', marginBottom: '15px', fontSize: '0.8rem'}}>
          <strong>Aviso de Configuração:</strong> O Firebase não está configurado. O ranking funcionará apenas localmente no seu computador atual.
        </div>
      )}

      <form onSubmit={startGame}>
        <div className="input-group">
          <label>Seu Nome Completo</label>
          <input 
            type="text" 
            placeholder="Ex: João da Silva" 
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            required
          />
        </div>
        <div className="input-group">
          <label>E-mail (Para contato do prêmio)</label>
          <input 
            type="email" 
            placeholder="Ex: joao@email.com" 
            value={playerEmail}
            onChange={(e) => setPlayerEmail(e.target.value)}
            required
          />
        </div>
        <div className="input-group">
          <label>WhatsApp / Telefone</label>
          <input 
            type="tel" 
            placeholder="(00) 00000-0000" 
            value={playerPhone}
            onChange={(e) => setPlayerPhone(e.target.value)}
            required
          />
        </div>
        <button type="submit" className="btn-primary">
          <span>Iniciar Desafio</span>
        </button>
      </form>
      <button 
        className="btn-secondary" 
        style={{marginTop: '1rem', background: 'transparent', borderColor: 'transparent', color: 'var(--gold)'}} 
        onClick={loadLeaderboard}
      >
        Ver Ranking Atual
      </button>
    </div>
  );

  const renderPlaying = () => {
    const currentQ = questions[currentIndex];
    if (!currentQ) return null;
    
    return (
      <div className="card">
        {scoreAnimation && (
          <div key={scoreAnimation.step} className={`score-animation-overlay ${scoreAnimation.step}`}>
            <div className="score-animation-amount">+{scoreAnimation.amount}</div>
            <div className="score-animation-label">{scoreAnimation.step === 'base' ? 'ACERTO!' : 'BÔNUS TEMPO!'}</div>
          </div>
        )}
        <div className="game-stats">
          <div>Anzol <span className="highlight">{currentIndex + 1}</span> / {TOTAL_QUESTIONS}</div>
          <div>Tempo: <span className="highlight" style={{color: timeLeft <= 3 ? '#ef4444' : 'var(--gold)'}}>{timeLeft}s</span></div>
          <div>Pontos: <span className="highlight">{score}</span></div>
        </div>
        
        <div className="lure-image-container">
          <img 
            src={currentQ.correct.image} 
            alt="Qual é o anzol?" 
            className="lure-image" 
          />
        </div>
        
        <div className="options-grid">
          {currentQ.options.map((opt, i) => {
            let btnClass = "option-btn";
            if (isAnswerRevealed) {
              if (opt.name === currentQ.correct.name) {
                btnClass += " correct";
              } else if (selectedOption && opt.name === selectedOption.name) {
                btnClass += " wrong";
              }
            }
            
            return (
              <button 
                key={i} 
                className={btnClass}
                onClick={() => handleOptionClick(opt)}
                disabled={isAnswerRevealed}
              >
                <div className="option-letter">{OPTION_LETTERS[i]}</div>
                {opt.name}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderGameOver = () => (
    <div className="card">
      <h2>Fim de Jogo!</h2>
      <div style={{margin: '2rem 0'}}>
        <p style={{fontSize: '1.2rem', color: '#a1a1aa'}}>Sua pontuação final:</p>
        <div style={{fontSize: '4rem', color: 'var(--gold)', fontFamily: 'Orbitron', fontWeight: 900, lineHeight: 1, margin: '10px 0'}}>
          {score}
        </div>
        
        {isSaving ? (
          <div style={{color: '#a1a1aa', fontSize: '0.9rem'}}>Salvando pontuação...</div>
        ) : isFirstTime ? (
          <div style={{color: '#10b981', fontWeight: 'bold', animation: 'fadeIn 0.5s'}}>🎉 Obrigado por participar! 🎉</div>
        ) : isNewRecord ? (
          <div style={{color: '#10b981', fontWeight: 'bold', animation: 'fadeIn 0.5s'}}>🎉 Novo Recorde Pessoal! 🎉</div>
        ) : (
          <div style={{color: '#ef4444', fontSize: '0.9rem'}}>Você não superou seu recorde anterior.</div>
        )}
      </div>
      
      <button className="btn-primary" onClick={loadLeaderboard} disabled={isSaving}>
        <span>Ver Ranking</span>
      </button>
      <button className="btn-secondary" onClick={() => setGameState('login')} disabled={isSaving}>
        Jogar Novamente
      </button>
    </div>
  );

  const renderLeaderboard = () => {
    return (
      <div className="card">
        <h2>Ranking Oficial</h2>
        
        <div className="prize-notice">
          🏆 O 1º colocado no ranking ganhará brindes premium!*
          <div style={{fontSize: '0.75rem', marginTop: '6px', color: '#94a3b8'}}>*Consulte o regulamento.</div>
        </div>
        
        {leaderboardData.length === 0 ? (
          <p style={{color: '#71717a', margin: '2rem 0'}}>Nenhum jogador registrado ainda. Seja o primeiro!</p>
        ) : (
          <ul className="leaderboard-list">
            {leaderboardData.map((item, i) => (
              <li key={i} className="leaderboard-item">
                <span className="rank">#{i + 1}</span>
                <div className="lb-player-info">
                  <span className="lb-name">{item.name}</span>
                  <span className="lb-plays">{item.plays || 1} { (item.plays || 1) === 1 ? 'tentativa' : 'tentativas' }</span>
                </div>
                <span className="lb-score">{item.score} pts</span>
              </li>
            ))}
          </ul>
        )}
        
        <button className="btn-primary" onClick={() => setGameState('login')}>
          <span>Voltar ao Início</span>
        </button>
      </div>
    );
  };

  return (
    <div className="app-container">
      {gameState === 'login' && renderLogin()}
      {gameState === 'playing' && renderPlaying()}
      {gameState === 'gameover' && renderGameOver()}
      {gameState === 'leaderboard' && renderLeaderboard()}

      <footer className="game-footer">
        v1.0.0 - Jogo dos Anzóis Premium
      </footer>
    </div>
  );
}

export default App;
