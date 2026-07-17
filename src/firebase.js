// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Configuração do Firebase do Jogo das Chumbadas
const firebaseConfig = {
  apiKey: "AIzaSyDZZgm_eNnQPFSqCRvQo0AW2dCDyIDbeBE",
  authDomain: "jogo-das-iscas.firebaseapp.com",
  projectId: "jogo-das-iscas",
  storageBucket: "jogo-das-iscas.firebasestorage.app",
  messagingSenderId: "469375054365",
  appId: "1:469375054365:web:d77fe77c620cf0fdb3ccf4"
};

let db = null;

try {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
} catch (error) {
  console.error("Erro ao inicializar Firebase:", error);
}

export { db };
