import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  addDoc, 
  deleteDoc 
} from 'firebase/firestore';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { 
  Palmtree, 
  Home, 
  PlusCircle, 
  Download, 
  Printer, 
  Trash2, 
  Search, 
  DollarSign, 
  PieChart, 
  TrendingUp, 
  AlertTriangle,
  Wallet,
  Calendar,
  Tag,
  CheckCircle,
  BarChart3,
  Share2,
  Bell,
  Smartphone,
  Copy,
  Check,
  ShieldCheck,
  Wifi,
  WifiOff
} from 'lucide-react';

// Categorias predefinidas
const CATEGORIES = {
  vacation: [
    'Hospedagem',
    'Gasolina',
    'Pedágio',
    'Café da Manhã',
    'Almoço',
    'Jantar',
    'Day Use',
    'Parques',
    'Tarifas',
    'Compras Extras',
    'Gastos Extras',
    'Mercado',
    'Vestuário'
  ],
  renovation: [
    'Mão de Obra',
    'Materiais de Construção',
    'Decoração',
    'Móveis',
    'Iluminação',
    'Ferramentas',
    'Imprevistos / Outros'
  ]
};

const PAYMENT_METHODS = ['Dinheiro', 'Cartão de Crédito', 'Cartão de Débito', 'PIX', 'Outro'];

// Configuração padrão de fallback para Firebase (se não injetado)
const firebaseConfig = typeof __firebase_config !== 'undefined'
  ? JSON.parse(__firebase_config)
  : {
      apiKey: "demo-api-key",
      authDomain: "demo-app.firebaseapp.com",
      projectId: "demo-app",
      storageBucket: "demo-app.appspot.com",
      messagingSenderId: "123456789",
      appId: "1:123456789:web:demo"
    };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'ferias-reformas-app';

export default function App() {
  const [activeTab, setActiveTab] = useState('vacation'); // 'vacation' | 'renovation'
  const [user, setUser] = useState(null);
  
  // Código do Grupo/Família para sincronização em nuvem
  const [syncCode, setSyncCode] = useState(() => {
    return localStorage.getItem('fin_sync_code') || 'FAMILIA-01';
  });
  const [tempSyncCode, setTempSyncCode] = useState(syncCode);
  const [isCopied, setIsCopied] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Instalação PWA
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [canInstallPWA, setCanInstallPWA] = useState(false);

  // Permissão de Notificações
  const [notificationPermission, setNotificationPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [toastMessage, setToastMessage] = useState(null);

  // Orçamentos e Limites
  const [budgets, setBudgets] = useState(() => {
    const saved = localStorage.getItem('fin_budgets');
    return saved ? JSON.parse(saved) : { vacation: 5000, renovation: 8000 };
  });

  const [categoryLimits, setCategoryLimits] = useState(() => {
    const saved = localStorage.getItem('fin_cat_limits');
    return saved ? JSON.parse(saved) : { vacation: {}, renovation: {} };
  });

  // Lista de lançamentos
  const [expenses, setExpenses] = useState(() => {
    const saved = localStorage.getItem('fin_expenses');
    return saved ? JSON.parse(saved) : [];
  });

  // Formulário
  const [form, setForm] = useState({
    description: '',
    amount: '',
    category: CATEGORIES.vacation[0],
    date: new Date().toISOString().split('T')[0],
    paymentMethod: 'PIX'
  });

  // Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');

  // Monitorar estado online/offline
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Evento PWA Install
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstallPWA(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Auth Firebase
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.warn('Executando em modo offline / fallback local:', err);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // Sincronização Firestore Real-Time
  useEffect(() => {
    if (!user || !syncCode) return;

    // Listener para Despesas públicas da sala
    const expensesRef = collection(db, 'artifacts', appId, 'public', 'data', `expenses_${syncCode}`);
    const unsubExpenses = onSnapshot(
      expensesRef,
      (snapshot) => {
        const loadedExpenses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (loadedExpenses.length > 0) {
          setExpenses(loadedExpenses);
          localStorage.setItem('fin_expenses', JSON.stringify(loadedExpenses));
        }
      },
      (error) => console.log('Firestore offline mode / erro de permissão:', error)
    );

    // Listener para Configurações de Orçamento
    const settingsDoc = doc(db, 'artifacts', appId, 'public', 'data', `settings_${syncCode}`, 'budget_config');
    const unsubSettings = onSnapshot(
      settingsDoc,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.budgets) {
            setBudgets(data.budgets);
            localStorage.setItem('fin_budgets', JSON.stringify(data.budgets));
          }
          if (data.categoryLimits) {
            setCategoryLimits(data.categoryLimits);
            localStorage.setItem('fin_cat_limits', JSON.stringify(data.categoryLimits));
          }
        }
      },
      (error) => console.log('Settings error:', error)
    );

    return () => {
      unsubExpenses();
      unsubSettings();
    };
  }, [user, syncCode]);

  // Atualiza default do formulário ao trocar tab
  useEffect(() => {
    setForm(prev => ({
      ...prev,
      category: CATEGORIES[activeTab][0]
    }));
    setFilterCategory('ALL');
  }, [activeTab]);

  // Salvar no LocalStorage (fallback)
  useEffect(() => {
    localStorage.setItem('fin_budgets', JSON.stringify(budgets));
    localStorage.setItem('fin_cat_limits', JSON.stringify(categoryLimits));
    localStorage.setItem('fin_expenses', JSON.stringify(expenses));
    localStorage.setItem('fin_sync_code', syncCode);
  }, [budgets, categoryLimits, expenses, syncCode]);

  // Solicitar Permissão de Notificação
  const requestNotificationPermission = async () => {
    if (typeof Notification !== 'undefined') {
      const perm = await Notification.requestPermission();
      setNotificationPermission(perm);
      if (perm === 'granted') {
        showToast('Notificações ativadas! Alertas de limite serão enviados ao seu celular/PC.');
      }
    }
  };

  const triggerNativeNotification = (title, body) => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: 'https://cdn-icons-png.flaticon.com/512/2936/2936886.png'
      });
    }
  };

  const showToast = (msg, type = 'info') => {
    setToastMessage({ msg, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Métricas
  const currentExpenses = useMemo(() => {
    return expenses.filter(e => e.module === activeTab);
  }, [expenses, activeTab]);

  const totalSpent = useMemo(() => {
    return currentExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
  }, [currentExpenses]);

  const currentBudget = budgets[activeTab] || 0;
  const remainingBudget = currentBudget - totalSpent;
  const budgetUsagePercent = currentBudget > 0 ? (totalSpent / currentBudget) * 100 : 0;

  // Gastos por categoria
  const categoryTotals = useMemo(() => {
    const totals = {};
    CATEGORIES[activeTab].forEach(cat => { totals[cat] = 0; });
    currentExpenses.forEach(e => {
      totals[e.category] = (totals[e.category] || 0) + Number(e.amount);
    });
    return totals;
  }, [currentExpenses, activeTab]);

  // Verificação de alertas para novo gasto
  const checkAlertsOnAdd = (newExpenseAmount, newCategory) => {
    const newTotal = totalSpent + newExpenseAmount;
    const newUsagePercent = currentBudget > 0 ? (newTotal / currentBudget) * 100 : 0;
    
    // Alerta Orçamento Geral
    if (newUsagePercent >= 100) {
      const msg = `⚠️ ATENÇÃO: Seu gasto estourou o orçamento de ${activeTab === 'vacation' ? 'Férias' : 'Reforma'}!`;
      showToast(msg, 'danger');
      triggerNativeNotification('Orçamento Estourado!', msg);
    } else if (newUsagePercent >= 90) {
      const msg = `⚠️ ALERTA: Você já usou 90% do orçamento total!`;
      showToast(msg, 'warning');
      triggerNativeNotification('Aviso de Orçamento', msg);
    } else if (newUsagePercent >= 80) {
      const msg = `🔔 AVISO: 80% do orçamento total consumido.`;
      showToast(msg, 'warning');
    }

    // Alerta por Categoria
    const catSpent = (categoryTotals[newCategory] || 0) + newExpenseAmount;
    const catLimit = categoryLimits[activeTab]?.[newCategory] || 0;
    if (catLimit > 0) {
      const catPercent = (catSpent / catLimit) * 100;
      if (catPercent >= 100) {
        const msg = `🚨 Categoria [${newCategory}] ultrapassou o teto definido de ${formatCurrency(catLimit)}!`;
        showToast(msg, 'danger');
        triggerNativeNotification(`Limite da Categoria Excedido!`, msg);
      } else if (catPercent >= 80) {
        showToast(`⚠️ Categoria [${newCategory}] atingiu ${catPercent.toFixed(0)}% do teto!`, 'warning');
      }
    }
  };

  // Adicionar Gasto
  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!form.description.trim() || !form.amount || Number(form.amount) <= 0) return;

    const amountNum = parseFloat(form.amount);
    checkAlertsOnAdd(amountNum, form.category);

    const newExpense = {
      module: activeTab,
      description: form.description,
      amount: amountNum,
      category: form.category,
      date: form.date,
      paymentMethod: form.paymentMethod,
      createdAt: new Date().toISOString()
    };

    // Atualiza localmente
    const localItem = { id: Date.now().toString(), ...newExpense };
    setExpenses(prev => [localItem, ...prev]);

    // Tenta sincronizar com Nuvem Firebase
    if (user && syncCode) {
      try {
        const expensesRef = collection(db, 'artifacts', appId, 'public', 'data', `expenses_${syncCode}`);
        await addDoc(expensesRef, newExpense);
      } catch (err) {
        console.warn('Erro ao salvar no Firebase, armazenado localmente:', err);
      }
    }

    setForm(prev => ({ ...prev, description: '', amount: '' }));
  };

  // Deletar Gasto
  const handleDeleteExpense = async (id) => {
    setExpenses(prev => prev.filter(e => e.id !== id));
    if (user && syncCode) {
      try {
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', `expenses_${syncCode}`, id);
        await deleteDoc(docRef);
      } catch (err) {
        console.warn('Erro ao deletar no Firebase:', err);
      }
    }
  };

  // Alterar Orçamento e Sincronizar
  const handleBudgetChange = async (value) => {
    const num = parseFloat(value) || 0;
    const updatedBudgets = { ...budgets, [activeTab]: num };
    setBudgets(updatedBudgets);

    if (user && syncCode) {
      try {
        const settingsDoc = doc(db, 'artifacts', appId, 'public', 'data', `settings_${syncCode}`, 'budget_config');
        await setDoc(settingsDoc, { budgets: updatedBudgets, categoryLimits }, { merge: true });
      } catch (err) {
        console.warn('Erro ao salvar settings no Firebase:', err);
      }
    }
  };

  // Alterar Limite de Categoria e Sincronizar
  const handleCategoryLimitChange = async (cat, value) => {
    const num = parseFloat(value) || 0;
    const updatedLimits = {
      ...categoryLimits,
      [activeTab]: {
        ...(categoryLimits[activeTab] || {}),
        [cat]: num
      }
    };
    setCategoryLimits(updatedLimits);

    if (user && syncCode) {
      try {
        const settingsDoc = doc(db, 'artifacts', appId, 'public', 'data', `settings_${syncCode}`, 'budget_config');
        await setDoc(settingsDoc, { budgets, categoryLimits: updatedLimits }, { merge: true });
      } catch (err) {
        console.warn('Erro ao salvar limits no Firebase:', err);
      }
    }
  };

  // Alterar Código da Sala de Sincronização
  const applySyncCode = () => {
    if (tempSyncCode.trim()) {
      setSyncCode(tempSyncCode.trim().toUpperCase());
      showToast(`Conectado ao código da família: ${tempSyncCode.trim().toUpperCase()}`, 'info');
    }
  };

  const copySyncCode = () => {
    navigator.clipboard.writeText(syncCode);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Instalar PWA
  const handleInstallPWA = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setCanInstallPWA(false);
      }
      setDeferredPrompt(null);
    }
  };

  // Exportar CSV
  const exportToCSV = () => {
    const headers = ['Data', 'Modulo', 'Categoria', 'Descrição', 'Forma de Pagamento', 'Valor (R$)'];
    const rows = expenses.map(e => [
      e.date,
      e.module === 'vacation' ? 'Ferias' : 'Reforma',
      `"${e.category}"`,
      `"${e.description.replace(/"/g, '""')}"`,
      e.paymentMethod,
      e.amount.toFixed(2)
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + 
      [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `controle_financeiro_${activeTab}_${syncCode}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  };

  const getProgressColor = (percent) => {
    if (percent >= 100) return 'bg-red-500';
    if (percent >= 80) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  const getProgressTextColor = (percent) => {
    if (percent >= 100) return 'text-red-600 dark:text-red-400';
    if (percent >= 80) return 'text-amber-600 dark:text-amber-400';
    return 'text-emerald-600 dark:text-emerald-400';
  };

  const filteredExpenses = useMemo(() => {
    return currentExpenses.filter(e => {
      const matchesSearch = e.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            e.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCat = filterCategory === 'ALL' || e.category === filterCategory;
      return matchesSearch && matchesCat;
    });
  }, [currentExpenses, searchQuery, filterCategory]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-sans transition-colors duration-200 print:bg-white print:text-black">
      
      {/* Toast Notification Float */}
      {toastMessage && (
        <div className={`fixed bottom-5 right-5 z-50 max-w-sm p-4 rounded-xl shadow-2xl border text-white flex items-center gap-3 transition-all duration-300 ${
          toastMessage.type === 'danger' ? 'bg-red-600 border-red-700' :
          toastMessage.type === 'warning' ? 'bg-amber-600 border-amber-700' : 'bg-indigo-600 border-indigo-700'
        }`}>
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span className="text-xs font-semibold">{toastMessage.msg}</span>
        </div>
      )}

      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-30 shadow-sm print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-md">
                <Wallet className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-lg font-bold bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 to-violet-400 bg-clip-text text-transparent">
                  Gestor Duo Nuvem
                </h1>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    {isOnline ? <Wifi className="w-3 h-3 text-emerald-500" /> : <WifiOff className="w-3 h-3 text-amber-500" />}
                    {isOnline ? 'Nuvem Conectada' : 'Modo Offline'}
                  </span>
                </div>
              </div>
            </div>

            {/* Ações Topo */}
            <div className="flex items-center gap-2">
              {/* Botão Notificação */}
              {notificationPermission !== 'granted' && (
                <button
                  onClick={requestNotificationPermission}
                  className="flex items-center gap-1 px-3 py-1.5 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 text-xs font-semibold rounded-lg border border-amber-500/30 transition"
                  title="Ativar Notificações no Celular/PC"
                >
                  <Bell className="w-4 h-4" />
                  <span className="hidden sm:inline">Alertas Celular</span>
                </button>
              )}

              {/* Botão PWA Install */}
              {canInstallPWA && (
                <button
                  onClick={handleInstallPWA}
                  className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-semibold rounded-lg shadow-sm transition"
                >
                  <Smartphone className="w-4 h-4" />
                  <span className="hidden sm:inline">Baixar App</span>
                </button>
              )}

              <button
                onClick={exportToCSV}
                className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">CSV</span>
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition"
              >
                <Printer className="w-4 h-4" />
                <span className="hidden sm:inline">PDF</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* Banner de Sincronização de Grupo/Família */}
        <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-4 rounded-2xl shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/20 rounded-xl border border-indigo-400/30">
              <Share2 className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm">Chave de Sincronização Família/Grupo</h3>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30 font-mono">
                  Multi-Dispositivo
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Digite este código em qualquer celular/PC para usar o **mesmo orçamento** em tempo real.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center bg-slate-800/80 rounded-xl border border-slate-700 p-1 w-full sm:w-auto">
              <input
                type="text"
                value={tempSyncCode}
                onChange={(e) => setTempSyncCode(e.target.value)}
                placeholder="Ex: VIAGEM2026"
                className="bg-transparent px-3 py-1 text-xs font-mono font-bold text-indigo-300 focus:outline-none w-32 uppercase"
              />
              <button
                onClick={applySyncCode}
                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition"
              >
                Conectar
              </button>
            </div>

            <button
              onClick={copySyncCode}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition"
              title="Copiar código"
            >
              {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Alerta Banner de Limite Estourado */}
        {budgetUsagePercent >= 80 && (
          <div className={`p-4 rounded-2xl border flex items-center gap-3 text-sm font-semibold print:hidden ${
            budgetUsagePercent >= 100 
              ? 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400' 
              : 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
          }`}>
            <AlertTriangle className="w-5 h-5 flex-shrink-0 animate-bounce" />
            <div>
              {budgetUsagePercent >= 100 
                ? `Alerta Crítico: Seu orçamento de ${activeTab === 'vacation' ? 'Férias' : 'Reforma'} ultrapassou o teto de ${formatCurrency(currentBudget)}!`
                : `Atenção: Você atingiu ${budgetUsagePercent.toFixed(1)}% do total planejado para ${activeTab === 'vacation' ? 'Férias' : 'Reforma'}.`}
            </div>
          </div>
        )}

        {/* Navegação entre Módulos (Tabs) */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-800 p-2 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 print:hidden">
          <div className="flex w-full sm:w-auto bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('vacation')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeTab === 'vacation'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Palmtree className="w-4 h-4" />
              Férias & Viagens
            </button>
            <button
              onClick={() => setActiveTab('renovation')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeTab === 'renovation'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Home className="w-4 h-4" />
              Reformas & Decoração
            </button>
          </div>

          {/* Input Orçamento Geral */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end px-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
              Orçamento Teto:
            </label>
            <div className="relative rounded-md shadow-sm w-36">
              <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400 text-xs">
                R$
              </div>
              <input
                type="number"
                value={budgets[activeTab] || ''}
                onChange={(e) => handleBudgetChange(e.target.value)}
                placeholder="0.00"
                className="w-full pl-8 pr-3 py-1.5 text-sm font-bold bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Cards Resumo Financeiro */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Orçado</span>
              <div className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
              {formatCurrency(currentBudget)}
            </div>
            <span className="text-xs text-slate-400 mt-1">Definido no módulo atual</span>
          </div>

          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Gasto</span>
              <div className="p-2 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
              {formatCurrency(totalSpent)}
            </div>
            <div className="flex items-center gap-1 mt-1 text-xs">
              <span className={`font-bold ${getProgressTextColor(budgetUsagePercent)}`}>
                {budgetUsagePercent.toFixed(1)}%
              </span>
              <span className="text-slate-400">do orçamento consumido</span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Saldo Restante</span>
              <div className={`p-2 rounded-lg ${remainingBudget >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600' : 'bg-red-50 dark:bg-red-900/30 text-red-600'}`}>
                {remainingBudget >= 0 ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
              </div>
            </div>
            <div className={`text-2xl font-extrabold ${remainingBudget >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
              {formatCurrency(remainingBudget)}
            </div>
            <span className="text-xs text-slate-400 mt-1">
              {remainingBudget >= 0 ? 'Dentro do orçamento' : 'Atenção: Limite ultrapassado!'}
            </span>
          </div>
        </div>

        {/* Barra de Progresso Geral */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 space-y-2">
          <div className="flex justify-between items-center text-sm font-semibold">
            <span className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-500" />
              Consumo do Orçamento Geral
            </span>
            <span className={getProgressTextColor(budgetUsagePercent)}>
              {budgetUsagePercent.toFixed(1)}% Usado
            </span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-3.5 overflow-hidden p-0.5">
            <div
              className={`h-full rounded-full transition-all duration-500 ${getProgressColor(budgetUsagePercent)}`}
              style={{ width: `${Math.min(budgetUsagePercent, 100)}%` }}
            ></div>
          </div>
        </div>

        {/* Grid Principal */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 print:block print:space-y-6">
          
          {/* Form */}
          <div className="lg:col-span-1 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 print:hidden">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-900 dark:text-white">
              <PlusCircle className="w-5 h-5 text-indigo-600" />
              Novo Lançamento
            </h2>

            <form onSubmit={handleAddExpense} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Descrição</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Gasolina Posto, Tinta, Hotel..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Valor (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0,00"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Data</label>
                  <input
                    type="date"
                    required
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Categoria</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  {CATEGORIES[activeTab].map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Pagamento</label>
                <select
                  value={form.paymentMethod}
                  onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  {PAYMENT_METHODS.map(pm => (
                    <option key={pm} value={pm}>{pm}</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl transition duration-200 shadow-md flex items-center justify-center gap-2 mt-2"
              >
                <PlusCircle className="w-4 h-4" />
                Lançar no Aplicativo
              </button>
            </form>
          </div>

          {/* Categorias + Limites */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                <PieChart className="w-5 h-5 text-indigo-600" />
                Alertas & Tetos por Categoria
              </h2>
              <span className="text-xs text-slate-400">Limites em tempo real</span>
            </div>

            <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
              {CATEGORIES[activeTab].map(cat => {
                const spent = categoryTotals[cat] || 0;
                const limit = categoryLimits[activeTab]?.[cat] || 0;
                const percent = limit > 0 ? (spent / limit) * 100 : 0;

                return (
                  <div key={cat} className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <Tag className="w-3.5 h-3.5 text-indigo-500" />
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{cat}</span>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                          {formatCurrency(spent)}
                        </span>
                        
                        <div className="flex items-center gap-1 text-xs text-slate-400 print:hidden">
                          <span>/ Teto:</span>
                          <input
                            type="number"
                            placeholder="Definir"
                            value={categoryLimits[activeTab]?.[cat] || ''}
                            onChange={(e) => handleCategoryLimitChange(cat, e.target.value)}
                            className="w-20 px-2 py-0.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                    </div>

                    {limit > 0 && (
                      <div className="space-y-1">
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${getProgressColor(percent)}`}
                            style={{ width: `${Math.min(percent, 100)}%` }}
                          ></div>
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-400">
                          <span>{percent.toFixed(0)}% do limite definido</span>
                          {spent > limit && (
                            <span className="text-red-500 font-bold">
                              Excedido em {formatCurrency(spent - limit)}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Tabela de Lançamentos */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-600" />
              Lançamentos do Grupo [{syncCode}]
            </h2>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full sm:w-auto px-3 py-1.5 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="ALL">Todas Categorias</option>
                {CATEGORIES[activeTab].map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-900/80 text-xs font-semibold uppercase text-slate-500 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-6 py-3">Data</th>
                  <th className="px-6 py-3">Descrição</th>
                  <th className="px-6 py-3">Categoria</th>
                  <th className="px-6 py-3">Pagamento</th>
                  <th className="px-6 py-3 text-right">Valor</th>
                  <th className="px-6 py-3 text-center print:hidden">Excluir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {filteredExpenses.length > 0 ? (
                  filteredExpenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition">
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500">
                        {new Date(exp.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                        {exp.description}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                          {exp.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500">
                        {exp.paymentMethod}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-slate-900 dark:text-white">
                        {formatCurrency(exp.amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center print:hidden">
                        <button
                          onClick={() => handleDeleteExpense(exp.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="px-6 py-8 text-center text-slate-400 text-sm">
                      Nenhum lançamento encontrado neste grupo.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <footer className="mt-12 border-t border-slate-200 dark:border-slate-800 py-6 text-center text-xs text-slate-400 print:hidden">
        <p>Gestor Financeiro Duo — Sincronização Nuvem e Alertas em Tempo Real</p>
      </footer>
    </div>
  );
}
