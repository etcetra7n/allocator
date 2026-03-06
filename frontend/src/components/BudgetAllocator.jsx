import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, GripVertical, Eye, EyeOff } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';

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

const BudgetAllocator = () => {
  const [totalBudget, setTotalBudget] = useState(10000);
  const [budgetInput, setBudgetInput] = useState('10000');
  const [funds, setFunds] = useState([
    { id: 1, name: 'Expense', percentage: 40, color: COLORS[0], hidden: false },
    { id: 2, name: 'Invest', percentage: 20, color: COLORS[1], hidden: false },
    { id: 3, name: 'Credit', percentage: 10, color: COLORS[2], hidden: false },
    { id: 4, name: 'Projects', percentage: 20, color: COLORS[3], hidden: false },
    { id: 5, name: 'Proc', percentage: 10, color: COLORS[4], hidden: false },
  ]);
  const [newFundName, setNewFundName] = useState('');
  const sliderRef = useRef(null);
  const [dragging, setDragging] = useState(null);
  const [draggedFund, setDraggedFund] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [touchDragState, setTouchDragState] = useState(null);
  const [editingFundId, setEditingFundId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [colorPickerOpen, setColorPickerOpen] = useState(null);

  // Load from localStorage on mount
  useEffect(() => {
    const savedData = localStorage.getItem('budgetAllocator');
    if (savedData) {
      const { totalBudget: saved, funds: savedFunds } = JSON.parse(savedData);
      setTotalBudget(saved);
      setBudgetInput(String(saved));
      setFunds(savedFunds);
    }
  }, []);

  // Handle mouse and touch drag
  useEffect(() => {
    if (!dragging) return;

    const handleMove = (clientX) => {
      if (!sliderRef.current) return;

      const rect = sliderRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));

      // Calculate which fund boundary this represents
      const { idx } = dragging;
      
      // Get cumulative percentage up to this fund
      let minPercentage = 0;
      for (let i = 0; i < idx; i++) {
        minPercentage += funds[i].percentage;
      }
      
      // Get cumulative percentage after this fund
      let maxPercentage = 100;
      for (let i = idx + 2; i < funds.length; i++) {
        maxPercentage -= funds[i].percentage;
      }

      // Clamp the percentage
      const clampedPercentage = Math.max(minPercentage + 1, Math.min(maxPercentage - 1, percentage));

      // Calculate new percentages for the two adjacent funds
      const leftFundPercentage = clampedPercentage - minPercentage;
      const rightFundPercentage = maxPercentage - clampedPercentage;

      // Update funds
      const newFunds = [...funds];
      newFunds[idx] = { ...newFunds[idx], percentage: leftFundPercentage };
      newFunds[idx + 1] = { ...newFunds[idx + 1], percentage: rightFundPercentage };
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
    localStorage.setItem('budgetAllocator', JSON.stringify({ totalBudget, funds }));
  }, [totalBudget, funds]);

  const addFund = () => {
    if (!newFundName.trim()) return;
    
    const existingPercentage = funds.reduce((sum, f) => sum + f.percentage, 0);
    let remainingPercentage = Math.max(0, 100 - existingPercentage);
    
    // If no remaining percentage, redistribute by taking equally from all existing funds
    if (remainingPercentage === 0) {
      const redistributionAmount = 10; // Take 10% for new fund
      const takeFromEach = redistributionAmount / funds.length;
      
      const adjustedFunds = funds.map(f => ({
        ...f,
        percentage: Math.max(5, f.percentage - takeFromEach) // Don't go below 5%
      }));
      
      // Calculate actual amount taken
      const actualTaken = funds.reduce((sum, f, idx) => 
        sum + (f.percentage - adjustedFunds[idx].percentage), 0);
      
      remainingPercentage = actualTaken;
      
      const newFund = {
        id: Date.now(),
        name: newFundName,
        percentage: remainingPercentage,
        color: COLORS[funds.length % COLORS.length],
        hidden: false,
      };
      
      setFunds([...adjustedFunds, newFund]);
    } else {
      const newFund = {
        id: Date.now(),
        name: newFundName,
        percentage: remainingPercentage,
        color: COLORS[funds.length % COLORS.length],
        hidden: false,
      };
      
      setFunds([...funds, newFund]);
    }
    
    setNewFundName('');
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
    setFunds(funds.map(f => 
      f.id === id ? { ...f, hidden: !f.hidden } : f
    ));
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

  // Get visible funds for slider display
  const visibleFunds = funds.filter(f => !f.hidden);
  const visibleTotal = visibleFunds.reduce((sum, f) => sum + f.percentage, 0);

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

  const getPosition = (percentage) => {
    return percentage;
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
    <div className="min-h-screen bg-gray-50 py-4 md:py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <Card className="shadow-lg">
          <CardHeader className="border-b bg-white">
            <CardTitle className="text-2xl md:text-3xl font-semibold text-gray-800">Budget Allocator</CardTitle>
            <p className="text-sm md:text-base text-gray-600 mt-2">Allocate your budget across different funds</p>
          </CardHeader>
          <CardContent className="p-4 md:p-8">
            {/* Total Budget Input */}
            <div className="mb-12">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Total Budget Amount
              </label>
              <Input
                type="number"
                value={budgetInput}
                onChange={(e) => {
                  const value = e.target.value;
                  setBudgetInput(value);
                  
                  // Update actual budget for calculations
                  const numValue = Number(value);
                  if (!isNaN(numValue) && value !== '') {
                    setTotalBudget(numValue);
                  } else if (value === '') {
                    setTotalBudget(0);
                  }
                }}
                onBlur={() => {
                  // On blur, if empty, set to 0
                  if (budgetInput === '' || budgetInput === '-') {
                    setBudgetInput('0');
                    setTotalBudget(0);
                  }
                }}
                className="text-2xl font-semibold h-14"
                placeholder="Enter total budget"
              />
            </div>

            {/* Add Fund Section */}
            <div className="mb-12">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Add New Fund
              </label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={newFundName}
                  onChange={(e) => setNewFundName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addFund()}
                  placeholder="Fund name (e.g., Entertainment, Bills)"
                  className="flex-1"
                />
                <Button onClick={addFund} className="px-6">
                  <Plus className="w-4 h-4 mr-2" />
                  Add
                </Button>
              </div>
            </div>

            {/* Funds List */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-700">Your Funds</h3>
                <div className="text-sm">
                  <span className="text-gray-600">Total: </span>
                  <span className={`font-semibold ${
                    Math.abs(funds.reduce((sum, f) => sum + f.percentage, 0) - 100) < 0.1 
                      ? 'text-green-600' 
                      : 'text-amber-600'
                  }`}>
                    {funds.reduce((sum, f) => sum + f.percentage, 0).toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                {funds.map((fund, index) => (
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
                    className={`flex items-center justify-between p-3 bg-gray-50 rounded-lg border-2 transition-all ${
                      draggedFund === fund.id 
                        ? 'opacity-50 border-gray-400 scale-105' 
                        : dragOverIndex === index 
                          ? 'border-blue-400 bg-blue-50' 
                          : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <GripVertical className={`w-5 h-5 cursor-grab active:cursor-grabbing touch-none ${fund.hidden ? 'text-gray-300' : 'text-gray-400'}`} />
                      <Popover open={colorPickerOpen === fund.id} onOpenChange={(open) => setColorPickerOpen(open ? fund.id : null)}>
                        <PopoverTrigger asChild>
                          <button
                            className={`w-5 h-5 rounded cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-gray-400 transition-all ${fund.hidden ? 'opacity-40' : ''}`}
                            style={{ backgroundColor: fund.color }}
                            title="Click to change color"
                          />
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-3" align="start">
                          <div className="grid grid-cols-5 gap-2">
                            {COLORS.map((color) => (
                              <button
                                key={color}
                                className={`w-6 h-6 rounded cursor-pointer hover:scale-110 transition-transform ${color === fund.color ? 'ring-2 ring-offset-1 ring-gray-600' : ''}`}
                                style={{ backgroundColor: color }}
                                onClick={() => changeColor(fund.id, color)}
                              />
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
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
                          className="h-7 w-32 text-sm font-medium"
                        />
                      ) : (
                        <span
                          className={`font-medium cursor-pointer hover:underline ${fund.hidden ? 'text-gray-400 line-through' : 'text-gray-800'}`}
                          onClick={() => startRename(fund)}
                          title="Click to rename"
                        >
                          {fund.name}
                        </span>
                      )}
                      {fund.hidden && <span className="text-xs text-gray-400 bg-gray-200 px-2 py-0.5 rounded">Hidden</span>}
                    </div>
                    <div className="flex items-center gap-2 md:gap-4">
                      <span className={`text-xs md:text-sm ${fund.hidden ? 'text-gray-400' : 'text-gray-600'}`}>
                        {fund.percentage.toFixed(1)}% • ${((totalBudget * fund.percentage) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleHide(fund.id)}
                        className={`p-2 ${fund.hidden ? 'text-gray-400 hover:text-gray-600' : 'text-gray-500 hover:text-gray-700'}`}
                        title={fund.hidden ? 'Show fund' : 'Hide fund'}
                      >
                        {fund.hidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                      {funds.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFund(fund.id)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Multi-handle Slider */}
            <div className="mt-8 md:mt-16">
              <h3 className="text-sm font-medium text-gray-700 mb-8">Allocation Slider</h3>
              <div className="relative overflow-x-auto" style={{ height: '150px', marginBottom: '40px' }}>
                {/* Labels above slider */}
                {visibleFunds.map((fund, idx) => {
                  let cumulativePercentage = 0;
                  for (let i = 0; i < idx; i++) {
                    cumulativePercentage += (visibleFunds[i].percentage / visibleTotal) * 100;
                  }
                  const scaledPercentage = (fund.percentage / visibleTotal) * 100;
                  const position = cumulativePercentage + scaledPercentage / 2;
                  
                  return (
                    <div
                      key={fund.id}
                      className="absolute transform -translate-x-1/2 text-center transition-all duration-150"
                      style={{ left: `${position}%`, top: '0px' }}
                    >
                      <div className="text-xs font-medium text-gray-600 mb-1 whitespace-nowrap">{fund.name}</div>
                      <div className="text-lg font-semibold transition-colors" style={{ color: fund.color }}>
                        {fund.percentage.toFixed(1)}%
                      </div>
                      <div className="text-xs text-gray-500 whitespace-nowrap">
                        ${((totalBudget * fund.percentage) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  );
                })}

                {/* Slider track */}
                <div
                  className="absolute w-full h-4 md:h-3 rounded-full overflow-hidden shadow-inner"
                  style={{ top: '90px', backgroundColor: '#e5e7eb', touchAction: 'none' }}
                  ref={sliderRef}
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
                      />
                    );
                  })}
                </div>

                {/* Handles */}
                {visibleFunds.map((fund, idx) => {
                  let cumulativePercentage = 0;
                  for (let i = 0; i <= idx; i++) {
                    cumulativePercentage += (visibleFunds[i].percentage / visibleTotal) * 100;
                  }
                  
                  if (idx === visibleFunds.length - 1) return null; // No handle after last fund
                  
                  // Find the actual index in the full funds array for dragging
                  const actualIdx = funds.findIndex(f => f.id === fund.id);
                  
                  return (
                    <div
                      key={`handle-${fund.id}`}
                      className="absolute transform -translate-x-1/2 cursor-ew-resize z-10 group"
                      style={{ left: `${cumulativePercentage}%`, top: '84px', touchAction: 'none' }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setDragging({ fundId: fund.id, idx: actualIdx });
                      }}
                      onTouchStart={(e) => {
                        e.preventDefault();
                        setDragging({ fundId: fund.id, idx: actualIdx });
                      }}
                    >
                      <div 
                        className="w-8 h-8 md:w-6 md:h-6 bg-white rounded-full border-2 shadow-md group-hover:scale-110 group-hover:shadow-lg transition-all duration-200"
                        style={{ 
                          borderColor: fund.color,
                          cursor: dragging ? 'grabbing' : 'grab'
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BudgetAllocator;