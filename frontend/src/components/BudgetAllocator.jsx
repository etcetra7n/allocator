import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

const COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
];

const BudgetAllocator = () => {
  const [totalBudget, setTotalBudget] = useState(10000);
  const [funds, setFunds] = useState([
    { id: 1, name: 'Savings', percentage: 40, color: COLORS[0] },
    { id: 2, name: 'Investment', percentage: 30, color: COLORS[1] },
    { id: 3, name: 'Emergency Fund', percentage: 30, color: COLORS[2] },
  ]);
  const [newFundName, setNewFundName] = useState('');
  const sliderRef = useRef(null);
  const [dragging, setDragging] = useState(null);

  // Load from localStorage on mount
  useEffect(() => {
    const savedData = localStorage.getItem('budgetAllocator');
    if (savedData) {
      const { totalBudget: saved, funds: savedFunds } = JSON.parse(savedData);
      setTotalBudget(saved);
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
      };
      
      setFunds([...adjustedFunds, newFund]);
    } else {
      const newFund = {
        id: Date.now(),
        name: newFundName,
        percentage: remainingPercentage,
        color: COLORS[funds.length % COLORS.length],
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

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <Card className="shadow-lg">
          <CardHeader className="border-b bg-white">
            <CardTitle className="text-3xl font-semibold text-gray-800">Budget Allocator</CardTitle>
            <p className="text-gray-600 mt-2">Allocate your budget across different funds</p>
          </CardHeader>
          <CardContent className="p-8">
            {/* Total Budget Input */}
            <div className="mb-12">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Total Budget Amount
              </label>
              <Input
                type="number"
                value={totalBudget}
                onChange={(e) => setTotalBudget(Number(e.target.value) || 0)}
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
                {funds.map((fund) => (
                  <div
                    key={fund.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: fund.color }}
                      />
                      <span className="font-medium text-gray-800">{fund.name}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-600">
                        {fund.percentage.toFixed(1)}% • ${((totalBudget * fund.percentage) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      {funds.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFund(fund.id)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
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
            <div className="mt-16">
              <h3 className="text-sm font-medium text-gray-700 mb-8">Allocation Slider</h3>
              <div className="relative" style={{ height: '150px', marginBottom: '40px' }}>
                {/* Labels above slider */}
                {funds.map((fund, idx) => {
                  let cumulativePercentage = 0;
                  for (let i = 0; i < idx; i++) {
                    cumulativePercentage += funds[i].percentage;
                  }
                  const position = cumulativePercentage + fund.percentage / 2;
                  
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
                  className="absolute w-full h-3 rounded-full overflow-hidden shadow-inner"
                  style={{ top: '90px', backgroundColor: '#e5e7eb' }}
                  ref={sliderRef}
                >
                  {funds.map((fund, idx) => {
                    let cumulativePercentage = 0;
                    for (let i = 0; i < idx; i++) {
                      cumulativePercentage += funds[i].percentage;
                    }
                    
                    return (
                      <div
                        key={fund.id}
                        className="absolute h-full transition-all duration-150 ease-out"
                        style={{
                          left: `${cumulativePercentage}%`,
                          width: `${fund.percentage}%`,
                          backgroundColor: fund.color,
                        }}
                      />
                    );
                  })}
                </div>

                {/* Handles */}
                {funds.map((fund, idx) => {
                  let cumulativePercentage = 0;
                  for (let i = 0; i <= idx; i++) {
                    cumulativePercentage += funds[i].percentage;
                  }
                  
                  if (idx === funds.length - 1) return null; // No handle after last fund
                  
                  return (
                    <div
                      key={`handle-${fund.id}`}
                      className="absolute transform -translate-x-1/2 cursor-ew-resize z-10 group"
                      style={{ left: `${cumulativePercentage}%`, top: '84px', touchAction: 'none' }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setDragging({ fundId: fund.id, idx });
                      }}
                      onTouchStart={(e) => {
                        e.preventDefault();
                        setDragging({ fundId: fund.id, idx });
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