const sp500Data = [84, 92, 80, 96, 103, 92, 98, 102, 118, 97, 68, 90, 107, 95, 96, 107, 135, 122, 140, 164, 167, 211, 242, 247, 277, 353, 417, 435, 466, 459, 615, 740, 970, 1229, 1469, 1320, 1148, 879, 1111, 1211, 1248, 1418, 1468, 903, 1115, 1257, 1257, 1426, 1848, 2058, 2043, 2238, 2673, 2506, 3230, 3756, 4766, 3839, 4769, 5200];
const marketData = [100.00];

for (let i = 1; i < sp500Data.length; i++) {
    const pctChange = (sp500Data[i] - sp500Data[i-1]) / sp500Data[i-1];
    let nextPrice = marketData[i-1] * (1 + 3 * pctChange);
    if (nextPrice <= 0) nextPrice = 0;
    marketData.push(nextPrice);
}

Chart.defaults.color = '#94a3b8';
Chart.defaults.borderColor = '#334155';

class MarketSimulator {
    constructor(initialCash) {
        this.currentYearIndex = 0;
        this.cash = initialCash;
        this.shares = 0;
        this.averageCost = 0;
        this.realizedGainLoss = 0;
        
        this.taxRate = 0.15;
        this.tradingFee = 10;

        this.savingsActive = false;
        this.savingsAmount = 0;

        this.autoDcaActive = false;
        this.autoDcaAmount = 0;
        
        this.isFailed = false; 

        this.history = [{
            year: 1,
            totalValue: initialCash,
            price: marketData[0]
        }];
    }

    getCurrentPrice() { return marketData[this.currentYearIndex]; }
    getTotalValue() { return this.cash + (this.shares * this.getCurrentPrice()); }
    getYearLabel() { return `Year ${this.currentYearIndex + 1}`; }

    setTaxRate(ratePercent) { this.taxRate = ratePercent / 100; }
    setTradingFee(fee) { this.tradingFee = fee; }

    buy(sharesToBuy) {
        if (this.isFailed) return false;

        const price = this.getCurrentPrice();
        const totalCost = (sharesToBuy * price) + this.tradingFee;

        if (this.cash >= totalCost && sharesToBuy > 0) {
            this.cash -= totalCost;
            const totalInvested = (this.shares * this.averageCost) + (sharesToBuy * price);
            this.shares += sharesToBuy;
            this.averageCost = totalInvested / this.shares;
            return true;
        }
        alert("Not enough cash.");
        return false;
    }

    sell(sharesToSell) {
        if (this.isFailed) return false;

        const price = this.getCurrentPrice();
        if (this.shares >= sharesToSell && sharesToSell > 0) {
            const proceedsBeforeFee = sharesToSell * price;
            const costBasis = sharesToSell * this.averageCost;
            let grossGain = proceedsBeforeFee - costBasis;
            
            let tax = 0;
            if (grossGain > 0) { tax = grossGain * this.taxRate; }

            const rawProceeds = proceedsBeforeFee - this.tradingFee - tax;
            const totalProceeds = Math.max(0, rawProceeds);
            
            this.cash += totalProceeds;
            this.shares -= sharesToSell;
            
            const netGainAfterFeeAndTax = totalProceeds - costBasis;
            this.realizedGainLoss += netGainAfterFeeAndTax;

            if (this.shares === 0) this.averageCost = 0;
            return true;
        }
        alert("Not enough shares.");
        return false;
    }

    nextYear() {
        if (this.currentYearIndex >= marketData.length - 1 || this.isFailed) {
            return false;
        }

        if (this.savingsActive && this.savingsAmount > 0) {
            this.cash += this.savingsAmount;
        }

        if (this.autoDcaActive && this.autoDcaAmount > 0) {
            const dcaCap = Math.min(this.autoDcaAmount, this.savingsAmount);
            const availableToInvest = Math.min(dcaCap, this.cash);
            
            if (availableToInvest > this.tradingFee && this.getCurrentPrice() > 0) {
                const sharesToAutoBuy = Math.floor((availableToInvest - this.tradingFee) / this.getCurrentPrice());
                if (sharesToAutoBuy > 0) { 
                    this.buy(sharesToAutoBuy); 
                }
            }
        }

        const nextPrice = marketData[this.currentYearIndex + 1];
        
        this.currentYearIndex++;
        this.history.push({
            year: this.currentYearIndex + 1,
            totalValue: this.getTotalValue(),
            price: nextPrice
        });

        if (nextPrice <= 0) {
            this.isFailed = true;
            return false;
        }

        return true;
    }
}

let sim = null;
let assetChart = null;
let priceChart = null;

const YEAR_DURATION_MS = 20000;
const TICK_INTERVAL_MS = 100;
let autoPlayActive = false;
let autoPlayTickInterval = null;
let autoPlayElapsed = 0;

const formatMoney = (num) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);

function updateUI() {
    document.getElementById('display-year').innerText = sim.getYearLabel();
    document.getElementById('display-price').innerText = formatMoney(sim.getCurrentPrice());
    document.getElementById('display-total').innerText = formatMoney(sim.getTotalValue());
    document.getElementById('display-cash').innerText = formatMoney(sim.cash);
    document.getElementById('display-shares').innerText = `${sim.shares}`;
    document.getElementById('display-avg-cost').innerText = formatMoney(sim.averageCost);
    
    const realizedEl = document.getElementById('display-realized');
    realizedEl.innerText = formatMoney(sim.realizedGainLoss);
    realizedEl.style.color = sim.realizedGainLoss >= 0 ? '#22c55e' : '#ef4444';

    let maxShares = 0;
    if (sim.getCurrentPrice() > 0) {
        maxShares = Math.max(0, Math.floor((sim.cash - sim.tradingFee) / sim.getCurrentPrice()));
    }
    document.getElementById('display-max-shares').innerText = maxShares;

    updateChart();
}

function initChart() {
    const ctxAsset = document.getElementById('assetChart').getContext('2d');
    assetChart = new Chart(ctxAsset, {
        type: 'line',
        data: {
            labels: sim.history.map(h => `Year ${h.year}`),
            datasets: [{
                label: 'Total Asset Value ($)',
                data: sim.history.map(h => h.totalValue),
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                fill: true,
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true } },
            animation: { duration: 300 }
        }
    });

    const ctxPrice = document.getElementById('priceChart').getContext('2d');
    priceChart = new Chart(ctxPrice, {
        type: 'line',
        data: {
            labels: sim.history.map(h => `Year ${h.year}`),
            datasets: [{
                label: 'Stock Price ($)',
                data: sim.history.map(h => h.price),
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                fill: true,
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: false } },
            animation: { duration: 300 }
        }
    });
}

function updateChart() {
    assetChart.data.labels = sim.history.map(h => `Year ${h.year}`);
    assetChart.data.datasets[0].data = sim.history.map(h => h.totalValue);
    assetChart.update();

    priceChart.data.labels = sim.history.map(h => `Year ${h.year}`);
    priceChart.data.datasets[0].data = sim.history.map(h => h.price);
    priceChart.update();
}

function startAutoPlay() {
    if (autoPlayActive) return;
    autoPlayActive = true;
    autoPlayElapsed = 0;

    const btn = document.getElementById('btn-auto-play');
    btn.textContent = '▶▶ Auto-Play Running... (No Pause)';
    btn.classList.add('active');
    btn.disabled = true; 
    
    document.getElementById('input-tax-rate').disabled = true;
    document.getElementById('input-trading-fee').disabled = true;
    
    const progressContainer = document.getElementById('progress-container');
    const progressTrack = document.querySelector('.progress-track');
    
    progressContainer.classList.remove('hidden');
    progressTrack.classList.remove('hidden');

    autoPlayTickInterval = setInterval(() => {
        autoPlayElapsed += TICK_INTERVAL_MS;

        const pct = Math.min((autoPlayElapsed / YEAR_DURATION_MS) * 100, 100);
        document.getElementById('progress-bar').style.width = pct + '%';

        const remaining = Math.max(0, Math.ceil((YEAR_DURATION_MS - autoPlayElapsed) / 1000));
        document.getElementById('progress-label').textContent = `${remaining} seconds until next year`;

        if (autoPlayElapsed >= YEAR_DURATION_MS) {
            autoPlayElapsed = 0;
            const advanced = sim.nextYear();
            updateUI();

            if (!advanced) {
                const isFinished = sim.currentYearIndex >= marketData.length - 1;
                stopAutoPlay(isFinished, sim.isFailed);
            }
        }
    }, TICK_INTERVAL_MS);
}

function stopAutoPlay(ended = false, failed = false) {
    autoPlayActive = false;
    clearInterval(autoPlayTickInterval);
    autoPlayTickInterval = null;

    const btn = document.getElementById('btn-auto-play');
    
    btn.textContent = '▶▶ Start Auto-Play (No Pause)';
    btn.classList.remove('active');
    btn.disabled = false;
    
    document.getElementById('progress-bar').style.width = '0%';

    if (failed) {
        btn.classList.add('hidden');
        document.querySelector('.progress-track').classList.add('hidden');
        document.getElementById('progress-label').textContent = 'Simulation Failed (Fund Wiped Out)';
        
        document.getElementById('btn-buy').disabled = true;
        document.getElementById('btn-sell').disabled = true;
        document.getElementById('fail-message').classList.remove('hidden');
        document.getElementById('btn-restart').classList.remove('hidden');
    } else if (ended) {
        btn.classList.add('hidden');
        document.querySelector('.progress-track').classList.add('hidden');
        document.getElementById('progress-label').textContent = 'Simulation Ended (Reached 60 Years)';
        
        document.getElementById('btn-buy').disabled = true;
        document.getElementById('btn-sell').disabled = true;
        document.getElementById('btn-restart').classList.remove('hidden');
    } else {
        document.getElementById('progress-container').classList.add('hidden');
    }
}

document.getElementById('btn-restart').addEventListener('click', () => {
    document.getElementById('dashboard-screen').classList.add('hidden');
    document.getElementById('setup-screen').classList.remove('hidden');
    document.getElementById('btn-restart').classList.add('hidden');
    document.getElementById('progress-container').classList.add('hidden');
    document.getElementById('fail-message').classList.add('hidden');
    
    const autoPlayBtn = document.getElementById('btn-auto-play');
    autoPlayBtn.classList.remove('hidden');
    
    document.getElementById('input-tax-rate').disabled = false;
    document.getElementById('input-trading-fee').disabled = false;
    document.getElementById('btn-buy').disabled = false;
    document.getElementById('btn-sell').disabled = false;
    document.getElementById('progress-bar').style.width = '0%';
    
    document.getElementById('toggle-savings').checked = false;
    document.getElementById('input-savings-amount').value = '';
    document.getElementById('input-savings-amount').disabled = true;
    
    const dcaToggle = document.getElementById('toggle-dca');
    dcaToggle.checked = false;
    dcaToggle.disabled = true; 
    document.getElementById('input-dca-amount').value = '';
    document.getElementById('input-dca-amount').disabled = true;

    document.getElementById('progress-label').textContent = '20 seconds until next year';

    if (assetChart) assetChart.destroy();
    if (priceChart) priceChart.destroy();
    sim = null;
});

document.getElementById('btn-start').addEventListener('click', () => {
    const initialCash = parseFloat(document.getElementById('initial-cash').value);
    if (isNaN(initialCash) || initialCash <= 0) {
        alert("Please enter a valid initial capital.");
        return;
    }

    const rawTax = parseFloat(document.getElementById('setup-tax-rate').value);
    const initialTax = isNaN(rawTax) ? 15 : Math.max(0, rawTax);

    const rawFee = parseFloat(document.getElementById('setup-trading-fee').value);
    const initialFee = isNaN(rawFee) ? 10 : Math.max(0, rawFee);

    sim = new MarketSimulator(initialCash);
    sim.setTaxRate(initialTax);
    sim.setTradingFee(initialFee);
    
    document.getElementById('input-tax-rate').value = initialTax;
    document.getElementById('input-trading-fee').value = initialFee;
    
    document.getElementById('setup-screen').classList.add('hidden');
    document.getElementById('dashboard-screen').classList.remove('hidden');
    
    initChart();
    updateUI();
});

document.getElementById('btn-buy').addEventListener('click', () => {
    const qty = parseInt(document.getElementById('trade-qty').value);
    if (isNaN(qty) || qty <= 0) {
        alert("Please enter a valid quantity.");
        return;
    }
    if (sim.buy(qty)) updateUI();
});

document.getElementById('btn-sell').addEventListener('click', () => {
    const qty = parseInt(document.getElementById('trade-qty').value);
    if (isNaN(qty) || qty <= 0) {
        alert("Please enter a valid quantity.");
        return;
    }
    if (sim.sell(qty)) updateUI();
});

document.getElementById('btn-auto-play').addEventListener('click', () => {
    if (!autoPlayActive) {
        startAutoPlay();
    }
});

document.getElementById('toggle-savings').addEventListener('change', (e) => {
    const isActive = e.target.checked;
    const savingsInput = document.getElementById('input-savings-amount');
    savingsInput.disabled = !isActive;
    if (sim) sim.savingsActive = isActive;
    
    const dcaToggle = document.getElementById('toggle-dca');
    const dcaInput = document.getElementById('input-dca-amount');
    
    if (!isActive) {
        dcaToggle.checked = false;
        dcaToggle.disabled = true;
        dcaInput.value = '';
        dcaInput.disabled = true;
        if (sim) {
            sim.autoDcaActive = false;
            sim.autoDcaAmount = 0;
        }
    } else {
        dcaToggle.disabled = false; 
    }
});

document.getElementById('input-savings-amount').addEventListener('input', (e) => {
    let val = parseFloat(e.target.value) || 0;
    if (sim) {
        sim.savingsAmount = val;
        if (sim.autoDcaAmount > val) {
            sim.autoDcaAmount = val;
            // 0일 경우 빈칸으로 표시하여 UX 통일
            document.getElementById('input-dca-amount').value = val === 0 ? '' : val;
        }

        // 최종 반영: Savings가 0(또는 빈칸)이 되었을 때 DCA 켜져있으면 강제 종료 및 UI 리셋
        if (val === 0 && sim.autoDcaActive) {
            document.getElementById('toggle-dca').checked = false;
            document.getElementById('input-dca-amount').disabled = true;
            document.getElementById('input-dca-amount').value = '';
            sim.autoDcaActive = false;
            sim.autoDcaAmount = 0;
        }
    }
});

document.getElementById('toggle-dca').addEventListener('change', (e) => {
    const input = document.getElementById('input-dca-amount');
    input.disabled = !e.target.checked;
    if (sim) sim.autoDcaActive = e.target.checked;
});

document.getElementById('input-dca-amount').addEventListener('input', (e) => {
    let val = parseFloat(e.target.value) || 0;
    if (sim) {
        const capped = Math.min(val, sim.savingsAmount);
        sim.autoDcaAmount = capped;
        if (val !== capped) {
            e.target.value = capped; 
        }
    }
});

document.getElementById('input-tax-rate').addEventListener('input', (e) => {
    if (sim && !autoPlayActive) {
        const parsed = parseFloat(e.target.value);
        sim.setTaxRate(isNaN(parsed) ? 15 : Math.max(0, parsed));
        updateUI(); 
    }
});

document.getElementById('input-trading-fee').addEventListener('input', (e) => {
    if (sim && !autoPlayActive) {
        const parsed = parseFloat(e.target.value);
        sim.setTradingFee(isNaN(parsed) ? 10 : Math.max(0, parsed));
        updateUI(); 
    }
});