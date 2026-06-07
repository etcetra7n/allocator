import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowRight,
  Banknote,
  Eye,
  EyeOff,
  GripVertical,
  Landmark,
  Layers3,
  Moon,
  Plus,
  Sun,
  Trash2,
  WalletCards,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

const COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#3d4451', // slate
  '#4b5563', // gray-600
  '#7c3aed', // purple-600
  '#db2777', // pink-600
  '#0ea5e9', // cyan-600
];

const formatCurrency = (value) =>
  value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const clampPercentage = (value) => Math.max(0, Math.min(100, value));

const DEFAULT_BANKS = [
  { id: 'jpmorgan', name: 'JPMorgan' },
  { id: 'chase', name: 'Chase' },
];

const DEFAULT_BANK_ID = DEFAULT_BANKS[0].id;

const getDefaultBankIdForFund = (fundName) =>
  fundName.toLowerCase().includes('invest') ? 'chase' : DEFAULT_BANK_ID;

const BudgetAllocator = () => {
  const [totalBudget, setTotalBudget] = useState(10000);
  const [budgetInput, setBudgetInput] = useState('10000');
  const [funds, setFunds] = useState([
    { id: 1, name: 'Expense', percentage: 40, color: COLORS[0], hidden: false, bankId: 'jpmorgan' },
    { id: 2, name: 'Invest', percentage: 20, color: COLORS[1], hidden: false, bankId: 'chase' },
    { id: 3, name: 'Credit', percentage: 10, color: COLORS[2], hidden: false, bankId: 'jpmorgan' },
    { id: 4, name: 'Projects', percentage: 20, color: COLORS[3], hidden: false, bankId: 'jpmorgan' },
    { id: 5, name: 'Proc', percentage: 10, color: COLORS[4], hidden: false, bankId: 'jpmorgan' },
  ]);
  const [newFundName, setNewFundName] = useState('');
  const [banks, setBanks] = useState(DEFAULT_BANKS);
  const [newBankName, setNewBankName] = useState('');
  const [hasLoadedData, setHasLoadedData] = useState(false);
  const sliderRef = useRef(null);
  const [dragging, setDragging] = useState(null);
  const [draggedFund, setDraggedFund] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [touchDragState, setTouchDragState] = useState(null);
  const [editingFundId, setEditingFundId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [colorPickerOpen, setColorPickerOpen] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(() =>
    localStorage.getItem('budgetAllocatorTheme') === 'dark'
  );

  const addAmountEqually = (fundsList, recipientIds, amount) => {
    if (!amount || recipientIds.length === 0) return fundsList;
    const share = amount / recipientIds.length;
    const recipientSet = new Set(recipientIds);

    return fundsList.map((fund) =>
      recipientSet.has(fund.id)
        ? { ...fund, percentage: fund.percentage + share }
        : fund
    );
  };

  const subtractAmountEqually = (fundsList, recipientIds, amount) => {
    if (!amount || recipientIds.length === 0) {
      return { funds: fundsList, actualTaken: 0 };
    }

    let remaining = amount;
    let updatedFunds = fundsList.map((fund) => ({ ...fund }));
    let adjustableIds = recipientIds.slice();
    const epsilon = 0.000001;

    // Remove equally without letting any fund go negative.
    while (remaining > epsilon && adjustableIds.length > 0) {
      const share = remaining / adjustableIds.length;
      const adjustableSet = new Set(adjustableIds);
      const nextAdjustable = [];

      updatedFunds = updatedFunds.map((fund) => {
        if (!adjustableSet.has(fund.id)) return fund;

        const take = Math.min(fund.percentage, share);
        const nextPercentage = fund.percentage - take;
        remaining -= take;

        if (nextPercentage > epsilon) {
          nextAdjustable.push(fund.id);
        }

        return { ...fund, percentage: nextPercentage };
      });

      adjustableIds = nextAdjustable;
    }

    return { funds: updatedFunds, actualTaken: amount - remaining };
  };

  const normalizeHiddenFunds = (fundsList) => {
    const visibleIds = fundsList.filter((fund) => !fund.hidden).map((fund) => fund.id);
    if (visibleIds.length === 0) return fundsList;

    let updatedFunds = fundsList.map((fund) => ({ ...fund }));

    updatedFunds.forEach((fund) => {
      if (!fund.hidden) return;
      if (fund.percentage <= 0) return;

      const stashed =
        typeof fund.stashedPercentage === 'number' && fund.stashedPercentage > 0
          ? fund.stashedPercentage
          : fund.percentage;

      updatedFunds = updatedFunds.map((item) =>
        item.id === fund.id
          ? { ...item, stashedPercentage: stashed, percentage: 0 }
          : item
      );

      updatedFunds = addAmountEqually(updatedFunds, visibleIds, stashed);
    });

    return updatedFunds;
  };

  const getFallbackBankId = (bankList = banks) => bankList[0]?.id || DEFAULT_BANK_ID;

  const normalizeBankList = (savedBanks) => {
    if (!Array.isArray(savedBanks)) return DEFAULT_BANKS;

    const normalizedBanks = savedBanks
      .map((bank, index) => {
        if (typeof bank === 'string') {
          const bankName = bank.trim();
          if (!bankName) return null;
          return { id: `bank-${index}-${bankName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, name: bankName };
        }

        if (!bank || typeof bank.name !== 'string') return null;

        const bankName = bank.name.trim();
        if (!bankName) return null;

        return {
          id: String(bank.id || `bank-${index}-${bankName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`),
          name: bankName,
        };
      })
      .filter(Boolean);

    const seen = new Set();
    const uniqueBanks = normalizedBanks.filter((bank) => {
      const key = bank.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return uniqueBanks.length > 0 ? uniqueBanks : DEFAULT_BANKS;
  };

  const normalizeFundBanks = (fundsList, bankList) => {
    const fallbackBankId = getFallbackBankId(bankList);
    const validBankIds = new Set(bankList.map((bank) => bank.id));

    return fundsList.map((fund) => {
      if (validBankIds.has(fund.bankId)) return fund;

      const defaultBankId = getDefaultBankIdForFund(fund.name || '');
      return {
        ...fund,
        bankId: validBankIds.has(defaultBankId) ? defaultBankId : fallbackBankId,
      };
    });
  };

  // Load from localStorage on mount
  useEffect(() => {
    const savedData = localStorage.getItem('budgetAllocator');

    if (savedData) {
      try {
        const { totalBudget: saved, funds: savedFunds, banks: savedBanks } = JSON.parse(savedData);
        const normalizedBanks = normalizeBankList(savedBanks);

        setBanks(normalizedBanks);

        if (typeof saved === 'number' && Number.isFinite(saved)) {
          setTotalBudget(saved);
          setBudgetInput(String(saved));
        }

        if (Array.isArray(savedFunds)) {
          setFunds(normalizeFundBanks(normalizeHiddenFunds(savedFunds), normalizedBanks));
        }
      } catch (error) {
        console.warn('Unable to load saved budget allocator data', error);
      }
    }
    setHasLoadedData(true);
  }, []);

  useEffect(() => {
    localStorage.setItem('budgetAllocatorTheme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // Handle mouse and touch drag
  useEffect(() => {
    if (!dragging) return;

    const handleMove = (clientX) => {
      if (!sliderRef.current) return;

      const rect = sliderRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));

      const { leftId, rightId } = dragging;
      const leftIndex = funds.findIndex((fund) => fund.id === leftId);
      const rightIndex = funds.findIndex((fund) => fund.id === rightId);

      if (leftIndex === -1 || rightIndex === -1 || leftIndex >= rightIndex) return;

      let minPercentage = 0;
      for (let i = 0; i < leftIndex; i++) {
        minPercentage += funds[i].percentage;
      }

      let maxPercentage = 100;
      for (let i = rightIndex + 1; i < funds.length; i++) {
        maxPercentage -= funds[i].percentage;
      }

      let betweenTotal = 0;
      for (let i = leftIndex + 1; i < rightIndex; i++) {
        betweenTotal += funds[i].percentage;
      }

      const minPosition = minPercentage + betweenTotal + 1;
      const maxPosition = maxPercentage - 1;
      if (minPosition >= maxPosition) return;

      const clampedPercentage = Math.max(minPosition, Math.min(maxPosition, percentage));

      const leftFundPercentage = clampedPercentage - minPercentage - betweenTotal;
      const rightFundPercentage = maxPercentage - clampedPercentage;

      const newFunds = [...funds];
      newFunds[leftIndex] = { ...newFunds[leftIndex], percentage: leftFundPercentage };
      newFunds[rightIndex] = { ...newFunds[rightIndex], percentage: rightFundPercentage };
      setFunds(newFunds);
    };

    const handleMouseMove = (e) => {
      e.preventDefault();
      handleMove(e.clientX);
    };

    const handleTouchMove = (e) => {
      e.preventDefault();
      if (e.touches.length > 0) {
        handleMove(e.touches[0].clientX);
      }
    };

    const handleEnd = () => {
      setDragging(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleEnd);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleEnd);
    };
  }, [dragging, funds]);

  // Save to localStorage whenever data changes
  useEffect(() => {
    if (!hasLoadedData) return;

    localStorage.setItem('budgetAllocator', JSON.stringify({ totalBudget, funds, banks }));
  }, [totalBudget, funds, banks, hasLoadedData]);

  const addFund = () => {
    const trimmedFundName = newFundName.trim();
    if (!trimmedFundName) return;
    
    const existingPercentage = funds.reduce((sum, f) => sum + f.percentage, 0);
    let remainingPercentage = Math.max(0, 100 - existingPercentage);
    const fallbackBankId = getFallbackBankId();
    
    // If no remaining percentage, redistribute by taking equally from all existing funds
    if (remainingPercentage === 0) {
      const redistributionAmount = 10; // Take 10% for new fund
      const visibleFundsList = funds.filter((f) => !f.hidden);
      if (visibleFundsList.length === 0) return;
      const takeFromEach = redistributionAmount / visibleFundsList.length;
      
      const adjustedFunds = funds.map(f => (
        f.hidden
          ? f
          : {
              ...f,
              percentage: Math.max(5, f.percentage - takeFromEach) // Don't go below 5%
            }
      ));
      
      // Calculate actual amount taken
      const actualTaken = funds.reduce((sum, f, idx) => 
        sum + (f.percentage - adjustedFunds[idx].percentage), 0);
      
      remainingPercentage = actualTaken;
      
      const newFund = {
        id: Date.now(),
        name: trimmedFundName,
        percentage: remainingPercentage,
        color: COLORS[funds.length % COLORS.length],
        hidden: false,
        bankId: fallbackBankId,
      };
      
      setFunds([...adjustedFunds, newFund]);
    } else {
      const newFund = {
        id: Date.now(),
        name: trimmedFundName,
        percentage: remainingPercentage,
        color: COLORS[funds.length % COLORS.length],
        hidden: false,
        bankId: fallbackBankId,
      };
      
      setFunds([...funds, newFund]);
    }
    
    setNewFundName('');
  };

  const addBank = () => {
    const bankName = newBankName.trim();
    if (!bankName) return;

    const existingBank = banks.some((bank) => bank.name.toLowerCase() === bankName.toLowerCase());
    if (existingBank) {
      setNewBankName('');
      return;
    }

    setBanks([...banks, { id: `bank-${Date.now()}`, name: bankName }]);
    setNewBankName('');
  };

  const removeBank = (bankId) => {
    if (banks.length <= 1) return;

    const remainingBanks = banks.filter((bank) => bank.id !== bankId);
    const fallbackBankId = getFallbackBankId(remainingBanks);

    setBanks(remainingBanks);
    setFunds(funds.map((fund) =>
      fund.bankId === bankId ? { ...fund, bankId: fallbackBankId } : fund
    ));
  };

  const removeFund = (id) => {
    if (funds.length <= 1) return;
    const newFunds = funds.filter(f => f.id !== id);
    // Redistribute the percentage proportionally
    redistributePercentages(newFunds);
  };

  const redistributePercentages = (fundsList) => {
    const total = fundsList.reduce((sum, f) => sum + f.percentage, 0);
    if (total === 0 || fundsList.length === 0) {
      const equalPercentage = 100 / fundsList.length;
      setFunds(fundsList.map(f => ({ ...f, percentage: equalPercentage })));
      return;
    }
    
    const adjustedFunds = fundsList.map(f => ({
      ...f,
      percentage: (f.percentage / total) * 100
    }));
    setFunds(adjustedFunds);
  };

  const toggleHide = (id) => {
    setFunds((prevFunds) => {
      const target = prevFunds.find((fund) => fund.id === id);
      if (!target) return prevFunds;

      if (!target.hidden) {
        const hiddenAmount = target.percentage;
        const recipientIds = prevFunds
          .filter((fund) => !fund.hidden && fund.id !== id)
          .map((fund) => fund.id);

        let updatedFunds = prevFunds.map((fund) =>
          fund.id === id
            ? {
                ...fund,
                hidden: true,
                stashedPercentage: hiddenAmount,
                percentage: 0,
              }
            : fund
        );

        if (hiddenAmount > 0 && recipientIds.length > 0) {
          updatedFunds = addAmountEqually(updatedFunds, recipientIds, hiddenAmount);
        }

        return updatedFunds;
      }

      const restoreAmount = target.stashedPercentage ?? 0;
      const recipientIds = prevFunds
        .filter((fund) => !fund.hidden && fund.id !== id)
        .map((fund) => fund.id);

      let updatedFunds = prevFunds.map((fund) =>
        fund.id === id
          ? { ...fund, hidden: false }
          : fund
      );

      if (restoreAmount > 0 && recipientIds.length > 0) {
        const { funds: reducedFunds, actualTaken } = subtractAmountEqually(
          updatedFunds,
          recipientIds,
          restoreAmount
        );

        updatedFunds = reducedFunds.map((fund) =>
          fund.id === id
            ? {
                ...fund,
                percentage: actualTaken,
                stashedPercentage: undefined,
              }
            : fund
        );

        return updatedFunds;
      }

      return updatedFunds.map((fund) =>
        fund.id === id
          ? {
              ...fund,
              percentage: restoreAmount,
              stashedPercentage: undefined,
            }
          : fund
      );
    });
  };

  const startRename = (fund) => {
    setEditingFundId(fund.id);
    setEditingName(fund.name);
  };

  const saveRename = () => {
    if (editingFundId && editingName.trim()) {
      setFunds(funds.map(f => 
        f.id === editingFundId ? { ...f, name: editingName.trim() } : f
      ));
    }
    setEditingFundId(null);
    setEditingName('');
  };

  const cancelRename = () => {
    setEditingFundId(null);
    setEditingName('');
  };

  const changeColor = (fundId, color) => {
    setFunds(funds.map(f => 
      f.id === fundId ? { ...f, color } : f
    ));
    setColorPickerOpen(null);
  };

  const changeBank = (fundId, bankId) => {
    if (!banks.some((bank) => bank.id === bankId)) return;

    setFunds(funds.map(f =>
      f.id === fundId ? { ...f, bankId } : f
    ));
  };

  // Get visible funds for slider display
  const visibleFunds = funds.filter(f => !f.hidden);
  const visibleTotal = visibleFunds.reduce((sum, f) => sum + f.percentage, 0);
  const allocationTotal = funds.reduce((sum, f) => sum + f.percentage, 0);
  const activeFundsCount = visibleFunds.length;
  const hiddenFundsCount = funds.length - activeFundsCount;
  const bankTransferTotals = banks.map((bank) => {
    const linkedFunds = funds.filter((fund) => fund.bankId === bank.id);
    const percentage = linkedFunds.reduce((sum, fund) => sum + fund.percentage, 0);

    return {
      ...bank,
      percentage,
      amount: (totalBudget * percentage) / 100,
      linkedFunds,
    };
  });
  const totalTransferAmount = bankTransferTotals.reduce((sum, bank) => sum + bank.amount, 0);
  const topBank = bankTransferTotals.reduce(
    (largest, bank) => (bank.amount > largest.amount ? bank : largest),
    { name: 'None', amount: 0, percentage: 0 }
  );

  const handleSliderChange = (fundId, newPercentage) => {
    const fundIndex = funds.findIndex(f => f.id === fundId);
    if (fundIndex === -1) return;

    const oldPercentage = funds[fundIndex].percentage;
    const diff = newPercentage - oldPercentage;

    // Calculate total of other funds
    const otherFunds = funds.filter(f => f.id !== fundId);
    const otherTotal = otherFunds.reduce((sum, f) => sum + f.percentage, 0);

    if (otherTotal === 0) {
      // If all other funds are 0, can't adjust
      return;
    }

    // Adjust other funds proportionally
    const adjustedFunds = funds.map((fund, idx) => {
      if (fund.id === fundId) {
        return { ...fund, percentage: newPercentage };
      } else {
        const ratio = fund.percentage / otherTotal;
        const adjustment = diff * ratio;
        return { ...fund, percentage: Math.max(0, fund.percentage - adjustment) };
      }
    });

    setFunds(adjustedFunds);
  };

  const handleDragStart = (e, fundId) => {
    setDraggedFund(fundId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedFund(null);
    setDragOverIndex(null);
  };

  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    
    if (draggedFund === null) return;
    
    const draggedIndex = funds.findIndex(f => f.id === draggedFund);
    if (draggedIndex === -1 || draggedIndex === targetIndex) {
      setDraggedFund(null);
      setDragOverIndex(null);
      return;
    }
    
    const newFunds = [...funds];
    const [removed] = newFunds.splice(draggedIndex, 1);
    newFunds.splice(targetIndex, 0, removed);
    
    setFunds(newFunds);
    setDraggedFund(null);
    setDragOverIndex(null);
  };

  const handleTouchStart = (e, fundId, index) => {
    const touch = e.touches[0];
    setTouchDragState({
      fundId,
      startIndex: index,
      startY: touch.clientY,
      currentY: touch.clientY,
    });
    setDraggedFund(fundId);
  };

  const handleTouchMove = (e, funds) => {
    if (!touchDragState) return;
    
    const touch = e.touches[0];
    const currentY = touch.clientY;
    
    // Find which fund is under the touch
    const element = document.elementFromPoint(touch.clientX, currentY);
    if (element) {
      const fundElement = element.closest('[data-fund-index]');
      if (fundElement) {
        const targetIndex = parseInt(fundElement.getAttribute('data-fund-index'));
        setDragOverIndex(targetIndex);
      }
    }
    
    setTouchDragState({
      ...touchDragState,
      currentY,
    });
  };

  const handleTouchEnd = () => {
    if (!touchDragState || dragOverIndex === null) {
      setTouchDragState(null);
      setDraggedFund(null);
      setDragOverIndex(null);
      return;
    }
    
    const draggedIndex = funds.findIndex(f => f.id === touchDragState.fundId);
    if (draggedIndex !== -1 && draggedIndex !== dragOverIndex) {
      const newFunds = [...funds];
      const [removed] = newFunds.splice(draggedIndex, 1);
      newFunds.splice(dragOverIndex, 0, removed);
      setFunds(newFunds);
    }
    
    setTouchDragState(null);
    setDraggedFund(null);
    setDragOverIndex(null);
  };

  return (
    <div className={`${isDarkMode ? 'dark bg-[#1e1e1e] text-[#cccccc]' : 'bg-[#f5f7fb] text-slate-950'} min-h-screen transition-colors`}>
      <div className="border-b border-slate-200 bg-white/90 transition-colors dark:border-[#3c3c3c] dark:bg-[#252526]">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-6 md:px-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
              <WalletCards className="h-3.5 w-3.5" />
              Allocation workspace
            </div>
            <div className="flex items-center justify-between gap-3">
              <h1 className="min-w-0 text-3xl font-semibold tracking-normal text-slate-950 md:text-4xl dark:text-[#f3f3f3]">
                Budget Allocator
              </h1>
              <Button
                type="button"
                variant="flat"
                size="icon"
                onClick={() => setIsDarkMode((current) => !current)}
                className="flex h-10 w-10 shrink-0 items-center justify-center bg-white p-0 text-slate-700 lg:hidden dark:bg-transparent dark:text-[#cccccc] [&_svg]:block [&_svg]:h-4 [&_svg]:w-4"
                aria-label={isDarkMode ? 'Switch to light theme' : 'Switch to dark theme'}
                title={isDarkMode ? 'Switch to light theme' : 'Switch to dark theme'}
              >
                {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 md:text-base dark:text-[#a8a8a8]">
              Shape each fund, route it to a bank, and see the transfer plan update as you work.
            </p>
          </div>

          <div className="flex w-full items-center gap-3 lg:w-auto lg:min-w-[25rem]">
            <Button
              type="button"
              variant="flat"
              size="icon"
              onClick={() => setIsDarkMode((current) => !current)}
              className="hidden h-10 w-10 shrink-0 items-center justify-center self-center bg-white p-0 text-slate-700 lg:flex dark:bg-transparent dark:text-[#cccccc] [&_svg]:block [&_svg]:h-4 [&_svg]:w-4"
              aria-label={isDarkMode ? 'Switch to light theme' : 'Switch to dark theme'}
              title={isDarkMode ? 'Switch to light theme' : 'Switch to dark theme'}
            >
              {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            <div className="grid flex-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 transition-colors dark:border-[#3c3c3c] dark:bg-[#2d2d30]">
              <div className="flex items-center gap-2 text-xs font-medium uppercase text-slate-500 dark:text-[#a8a8a8]">
                <Banknote className="h-4 w-4 text-emerald-600" />
                Budget
              </div>
              <div className="mt-2 text-2xl font-semibold text-slate-950 dark:text-[#f3f3f3]">
                ${formatCurrency(totalBudget)}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 transition-colors dark:border-[#3c3c3c] dark:bg-[#2d2d30]">
              <div className="flex items-center gap-2 text-xs font-medium uppercase text-slate-500 dark:text-[#a8a8a8]">
                <Layers3 className="h-4 w-4 text-sky-600" />
                Funds
              </div>
              <div className="mt-2 text-2xl font-semibold text-slate-950 dark:text-[#f3f3f3]">
                {activeFundsCount}
                <span className="ml-1 text-sm font-medium text-slate-500 dark:text-[#a8a8a8]">active</span>
              </div>
            </div>
          </div>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-6 md:px-6">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-colors md:p-6 dark:border-[#3c3c3c] dark:bg-[#252526]">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Allocation mix</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-[#a8a8a8]">
                Drag handles for broad changes or type an exact percentage in a fund row.
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-500 dark:text-[#a8a8a8]">Total</span>
              <span
                className={`rounded-full px-2.5 py-1 font-semibold ${
                  Math.abs(allocationTotal - 100) < 0.1
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                    : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
                }`}
              >
                {allocationTotal.toFixed(1)}%
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 transition-colors dark:border-[#3c3c3c] dark:bg-[#1e1e1e]">
            {visibleFunds.length > 0 && visibleTotal > 0 ? (
              <>
                <div className="relative min-h-28 pb-16">
                  <div
                    className="relative h-10 overflow-hidden rounded-md bg-slate-200 shadow-inner dark:bg-[#3c3c3c]"
                    ref={sliderRef}
                    style={{ touchAction: 'none' }}
                  >
                    {visibleFunds.map((fund, idx) => {
                      let cumulativePercentage = 0;
                      for (let i = 0; i < idx; i++) {
                        cumulativePercentage += (visibleFunds[i].percentage / visibleTotal) * 100;
                      }
                      const scaledPercentage = (fund.percentage / visibleTotal) * 100;

                      return (
                        <div
                          key={fund.id}
                          className="absolute h-full transition-all duration-150 ease-out"
                          style={{
                            left: `${cumulativePercentage}%`,
                            width: `${scaledPercentage}%`,
                            backgroundColor: fund.color,
                          }}
                          title={`${fund.name}: ${fund.percentage.toFixed(1)}%`}
                        />
                      );
                    })}

                    {visibleFunds.map((fund, idx) => {
                      let cumulativePercentage = 0;
                      for (let i = 0; i <= idx; i++) {
                        cumulativePercentage += (visibleFunds[i].percentage / visibleTotal) * 100;
                      }

                      if (idx === visibleFunds.length - 1) return null;

                      const leftFund = fund;
                      const rightFund = visibleFunds[idx + 1];

                      return (
                        <div
                          key={`handle-${fund.id}`}
                          className="absolute top-1/2 z-10 h-10 w-6 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize"
                          style={{ left: `${cumulativePercentage}%`, touchAction: 'none' }}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setDragging({ leftId: leftFund.id, rightId: rightFund.id });
                          }}
                          onTouchStart={(e) => {
                            e.preventDefault();
                            setDragging({ leftId: leftFund.id, rightId: rightFund.id });
                          }}
                          title={`Resize ${leftFund.name} and ${rightFund.name}`}
                        >
                          <div className="mx-auto h-full w-1.5 rounded-full border border-white/70 bg-white shadow-md dark:border-[#1e1e1e] dark:bg-[#cccccc]" />
                        </div>
                      );
                    })}
                  </div>

                  {visibleFunds.map((fund, idx) => {
                    let cumulativePercentage = 0;
                    for (let i = 0; i < idx; i++) {
                      cumulativePercentage += (visibleFunds[i].percentage / visibleTotal) * 100;
                    }
                    const scaledPercentage = (fund.percentage / visibleTotal) * 100;
                    const centerPosition = cumulativePercentage + scaledPercentage / 2;
                    const fundAmount = (totalBudget * fund.percentage) / 100;

                    return (
                      <div
                        key={`allocation-label-${fund.id}`}
                        className="absolute top-14 w-28 -translate-x-1/2 text-center text-xs"
                        style={{ left: `${centerPosition}%` }}
                      >
                        <div className="mx-auto mb-1 h-2 w-2 rounded-full" style={{ backgroundColor: fund.color }} />
                        <div className="truncate font-semibold text-slate-800 dark:text-[#f3f3f3]" title={fund.name}>
                          {fund.name}
                        </div>
                        <div className="mt-0.5 font-semibold text-slate-600 dark:text-[#cccccc]">
                          {fund.percentage.toFixed(1)}%
                        </div>
                        <div className="mt-0.5 text-slate-500 dark:text-[#a8a8a8]">
                          ${formatCurrency(fundAmount)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="flex min-h-28 items-center justify-center rounded-md border border-dashed border-slate-300 bg-white text-sm text-slate-500 dark:border-[#3c3c3c] dark:bg-[#252526] dark:text-[#a8a8a8]">
                Show at least one fund to rebuild the allocation.
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <section className="space-y-6">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-colors md:p-5 dark:border-[#3c3c3c] dark:bg-[#252526]">
            <div className="grid gap-4 lg:grid-cols-[minmax(15rem,22rem)_1fr_1fr]">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-800 dark:text-[#cccccc]">
                  Total budget
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xl font-semibold text-slate-400 dark:text-[#858585]">
                    $
                  </span>
                  <Input
                    type="number"
                    value={budgetInput}
                    onChange={(e) => {
                      const value = e.target.value;
                      setBudgetInput(value);

                      const numValue = Number(value);
                      if (!isNaN(numValue) && value !== '') {
                        setTotalBudget(numValue);
                      } else if (value === '') {
                        setTotalBudget(0);
                      }
                    }}
                    onBlur={() => {
                      if (budgetInput === '' || budgetInput === '-') {
                        setBudgetInput('0');
                        setTotalBudget(0);
                      }
                    }}
                    className="h-12 border-slate-300 bg-white pl-8 text-xl font-semibold dark:border-[#3c3c3c] dark:bg-[#1e1e1e] dark:text-[#f3f3f3]"
                    placeholder="Enter total budget"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-800 dark:text-[#cccccc]">
                  Add fund
                </label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={newFundName}
                    onChange={(e) => setNewFundName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addFund()}
                    placeholder="Fund name"
                    className="h-12 border-slate-300 bg-white dark:border-[#3c3c3c] dark:bg-[#1e1e1e] dark:text-[#f3f3f3]"
                  />
                  <Button onClick={addFund} className="h-12 bg-slate-950 px-4 text-white hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500">
                    <Plus className="h-4 w-4" />
                    Add
                  </Button>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-800 dark:text-[#cccccc]">
                  Add bank
                </label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={newBankName}
                    onChange={(e) => setNewBankName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addBank()}
                    placeholder="Bank name"
                    className="h-12 border-slate-300 bg-white dark:border-[#3c3c3c] dark:bg-[#1e1e1e] dark:text-[#f3f3f3]"
                  />
                  <Button onClick={addBank} variant="outline" className="h-12 border-slate-300 px-4 dark:border-[#3c3c3c] dark:bg-[#2d2d30] dark:text-[#cccccc] dark:hover:bg-[#3c3c3c]">
                    <Landmark className="h-4 w-4" />
                    Add
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-colors md:p-6 dark:border-[#3c3c3c] dark:bg-[#252526]">
            <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-950 dark:text-[#f3f3f3]">Funds</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-[#a8a8a8]">
                  Rename, recolor, reorder, hide, or route funds without leaving the list.
                </p>
              </div>
              {hiddenFundsCount > 0 && (
                <span className="text-sm font-medium text-slate-500 dark:text-[#a8a8a8]">
                  {hiddenFundsCount} hidden
                </span>
              )}
            </div>

            <div className="space-y-3">
              {funds.map((fund, index) => {
                const selectedBankId = banks.some((bank) => bank.id === fund.bankId)
                  ? fund.bankId
                  : getFallbackBankId();
                const fundAmount = (totalBudget * fund.percentage) / 100;

                return (
                  <div
                    key={fund.id}
                    data-fund-index={index}
                    draggable
                    onDragStart={(e) => handleDragStart(e, fund.id)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    onDrop={(e) => handleDrop(e, index)}
                    onTouchStart={(e) => handleTouchStart(e, fund.id, index)}
                    onTouchMove={(e) => handleTouchMove(e, funds)}
                    onTouchEnd={handleTouchEnd}
                    className={`rounded-lg border bg-white p-3 transition-all dark:bg-[#1e1e1e] ${
                      draggedFund === fund.id
                        ? 'scale-[1.01] border-slate-400 opacity-60 shadow-md dark:border-[#858585]'
                        : dragOverIndex === index
                          ? 'border-sky-400 bg-sky-50 dark:border-sky-500 dark:bg-sky-500/10'
                          : 'border-slate-200 hover:border-slate-300 hover:shadow-sm dark:border-[#3c3c3c] dark:hover:border-[#858585]'
                    } ${fund.hidden ? 'bg-slate-50 opacity-75 dark:bg-[#252526]' : ''}`}
                  >
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1fr)_17.5rem_auto] md:items-center">
                      <div className="flex min-w-0 items-center gap-3">
                        <GripVertical className={`h-5 w-5 shrink-0 cursor-grab touch-none ${fund.hidden ? 'text-slate-300 dark:text-[#5f5f5f]' : 'text-slate-400 dark:text-[#858585]'}`} />
                        <Popover open={colorPickerOpen === fund.id} onOpenChange={(open) => setColorPickerOpen(open ? fund.id : null)}>
                          <PopoverTrigger asChild>
                            <button
                              className={`h-7 w-7 shrink-0 rounded-md border border-white shadow-sm transition-all hover:ring-2 hover:ring-slate-300 ${fund.hidden ? 'opacity-40' : ''}`}
                              style={{ backgroundColor: fund.color }}
                              title="Change color"
                            />
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-3" align="start">
                            <div className="grid grid-cols-5 gap-2">
                              {COLORS.map((color) => (
                                <button
                                  key={color}
                                  className={`h-7 w-7 rounded-md transition-transform hover:scale-110 ${color === fund.color ? 'ring-2 ring-slate-700 ring-offset-2' : ''}`}
                                  style={{ backgroundColor: color }}
                                  onClick={() => changeColor(fund.id, color)}
                                  title={`Use ${color}`}
                                />
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>

                        <div className="min-w-0">
                          {editingFundId === fund.id ? (
                            <Input
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onBlur={saveRename}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveRename();
                                if (e.key === 'Escape') cancelRename();
                              }}
                              autoFocus
                              className="h-9 max-w-52 border-slate-300 bg-white text-sm font-semibold dark:border-[#3c3c3c] dark:bg-[#2d2d30] dark:text-[#f3f3f3]"
                            />
                          ) : (
                            <button
                              className={`block max-w-full truncate text-left text-sm font-semibold hover:underline ${fund.hidden ? 'text-slate-400 line-through dark:text-[#6a6a6a]' : 'text-slate-900 dark:text-[#f3f3f3]'}`}
                              onClick={() => startRename(fund)}
                              title="Rename fund"
                            >
                              {fund.name}
                            </button>
                          )}
                          <div className={`mt-1 text-xs ${fund.hidden ? 'text-slate-400 dark:text-[#6a6a6a]' : 'text-slate-500 dark:text-[#a8a8a8]'}`}>
                            ${formatCurrency(fundAmount)}
                            {fund.hidden ? ' hidden from current allocation' : ' allocated'}
                          </div>
                        </div>
                      </div>

                      <div className="flex min-w-0 flex-wrap items-center gap-3 sm:justify-end lg:justify-start">
                        <label className="flex shrink-0 items-center gap-1.5">
              
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            disabled={fund.hidden}
                            value={Number(fund.percentage.toFixed(1))}
                            onChange={(e) => handleSliderChange(fund.id, clampPercentage(Number(e.target.value) || 0))}
                            className="h-8 w-20 rounded-md border-slate-200 bg-slate-50 px-2 text-right text-sm font-semibold shadow-none transition-colors focus-visible:bg-white disabled:bg-slate-100 dark:border-[#3c3c3c] dark:bg-[#2d2d30] dark:text-[#f3f3f3] dark:focus-visible:bg-[#1e1e1e] dark:disabled:bg-[#252526]"
                            aria-label={`${fund.name} percentage`}
                          />
                          <span className="text-xs font-semibold text-slate-500 dark:text-[#a8a8a8]">%</span>
                        </label>

                        <div className="flex min-w-0 shrink-0 items-center gap-1.5">
                          <Landmark className={`h-3.5 w-3.5 shrink-0 ${fund.hidden ? 'text-slate-300 dark:text-[#5f5f5f]' : 'text-slate-400 dark:text-[#858585]'}`} />
                          <Select value={selectedBankId} onValueChange={(bankId) => changeBank(fund.id, bankId)}>
                            <SelectTrigger
                              aria-label={`Bank account for ${fund.name}`}
                              className={`h-8 w-32 rounded-md border-slate-200 bg-slate-50 px-2 text-xs font-medium shadow-none transition-colors hover:bg-white focus:ring-1 focus:ring-emerald-700 sm:w-36 lg:w-32 dark:border-[#3c3c3c] dark:bg-[#2d2d30] dark:hover:bg-[#1e1e1e] ${fund.hidden ? 'text-slate-400 dark:text-[#6a6a6a]' : 'text-slate-700 dark:text-[#cccccc]'}`}
                            >
                              <SelectValue placeholder="Select bank" />
                            </SelectTrigger>
                            <SelectContent>
                              {banks.map((bank) => (
                                <SelectItem key={bank.id} value={bank.id}>
                                  {bank.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleHide(fund.id)}
                          className={`h-9 w-9 ${fund.hidden ? 'text-slate-400 hover:text-slate-700 dark:text-[#6a6a6a] dark:hover:text-[#cccccc]' : 'text-slate-500 hover:text-slate-800 dark:text-[#a8a8a8] dark:hover:text-[#f3f3f3]'}`}
                          title={fund.hidden ? 'Show fund' : 'Hide fund'}
                        >
                          {fund.hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        {funds.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeFund(fund.id)}
                            className="h-9 w-9 text-rose-500 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-500/10 dark:hover:text-rose-300"
                            title="Delete fund"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-lg border border-slate-200 bg-white p-5 text-slate-950 shadow-sm transition-colors dark:border-[#3c3c3c] dark:bg-[#252526] dark:text-[#cccccc]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Transfer plan</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-[#a8a8a8]">Bank totals from your current routing.</p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                <ArrowRight className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-6">
              <div className="text-sm text-slate-500 dark:text-[#a8a8a8]">Total to move</div>
              <div className="mt-1 text-3xl font-semibold">${formatCurrency(totalTransferAmount)}</div>
            </div>
            <div className="mt-5 rounded-lg border border-emerald-100 bg-emerald-50/60 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/10">
              <div className="text-xs font-medium uppercase text-emerald-700 dark:text-emerald-300">Largest destination</div>
              <div className="mt-2 flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-base font-semibold">{topBank.name}</div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-[#a8a8a8]">{topBank.percentage.toFixed(1)}% allocated</div>
                </div>
                <div className="shrink-0 text-right text-lg font-semibold">
                  ${formatCurrency(topBank.amount)}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition-colors dark:border-[#3c3c3c] dark:bg-[#252526]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-950 dark:text-[#f3f3f3]">Banks</h2>
              <span className="text-sm font-medium text-slate-500 dark:text-[#a8a8a8]">{banks.length} total</span>
            </div>
            <div className="space-y-3">
              {bankTransferTotals.map((bank) => (
                <div key={bank.id} className="rounded-lg border border-slate-200 p-4 dark:border-[#3c3c3c] dark:bg-[#1e1e1e]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-[#f3f3f3]">
                        <Landmark className="h-4 w-4 text-slate-500 dark:text-[#a8a8a8]" />
                        <span className="truncate">{bank.name}</span>
                        {banks.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeBank(bank.id)}
                            className="ml-1 h-7 w-7 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:text-[#858585] dark:hover:bg-rose-500/10 dark:hover:text-rose-300"
                            title={`Remove ${bank.name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                      <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-[#a8a8a8]">
                        {bank.linkedFunds.length > 0
                          ? bank.linkedFunds.map((fund) => fund.name).join(', ')
                          : 'No linked funds'}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-semibold text-slate-950 dark:text-[#f3f3f3]">${formatCurrency(bank.amount)}</div>
                      <div className="text-xs text-slate-500 dark:text-[#a8a8a8]">{bank.percentage.toFixed(1)}%</div>
                    </div>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-[#3c3c3c]">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${Math.min(100, bank.percentage)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
          </aside>
        </div>
      </main>
    </div>
  );
};

export default BudgetAllocator;
