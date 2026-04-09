const marketData = [114, 133, 92, 59, 77, 97, 105, 117, 151, 202, 195, 232, 278, 247, 324, 348, 330, 381, 454, 373, 586, 676, 776, 751, 1052, 1291, 1570, 2192, 4069, 2470, 1950, 1335, 2003, 2178, 2205, 2415, 2652, 1577, 2269, 2652, 2605, 3019, 4176, 4736, 5007, 5383, 6903, 6635, 8972, 12888, 15644, 10466, 15011, 16000, 17500, 18200, 19500, 21000, 20500, 22500];

// Chart.js Dark Mode Defaults
Chart.defaults.color = '#94a3b8';
Chart.defaults.borderColor = '#334155';

class MarketSimulator {
    constructor(initialCash) {
        this.currentYearIndex = 0;
        this.cash = initialCash;
        this.shares = 0;
        this.averageCost = 0;
        this.realizedGainLoss = 0;
        
        this.autoDcaActive = false;
        this.autoDcaAmount = 0;
        
        this.savingsActive = false;
        this.savingsAmount = 0;
        
        this.history = [{
            year: 1,
            totalValue: initialCash
        }];
    }

    getCurrentPrice() { return marketData[this.currentYearIndex]; }
    getTotalValue() { return this.cash + (this.shares * this.getCurrentPrice()); }
    getYearLabel() { return `Year ${this.currentYearIndex + 1}`; }

    buy(sharesToBuy) {
        const price = this.getCurrentPrice();
        const totalCost = (sharesToBuy * price) + 10;

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
        const price = this.getCurrentPrice();
        if (this.shares >= sharesToSell && sharesToSell > 0) {
            const proceedsBeforeFee = sharesToSell * price;
            const costBasis = sharesToSell * this.averageCost;
            let grossGain = proceedsBeforeFee - costBasis;
            
            let tax = 0;
            if (grossGain > 0) { tax = grossGain * 0.15; }

            const rawProceeds = proceedsBeforeFee - 10 - tax;
            const totalProceeds = Math.max(0, rawProceeds);
            
            this.cash += totalProceeds;
            this.shares -= sharesToSell;
            
            const netGainAfterFeeAndTax = grossGain - 10 - tax;
            this.realizedGainLoss += netGainAfterFeeAndTax;

            if (this.shares === 0) this.averageCost = 0;
            return true;
        }
        alert("Not enough shares.");
        return false;
    }

    nextYear() {
        if (this.currentYearIndex >= marketData.length - 1) {
            return false;
        }

        const cashBeforeSavings = this.cash;

        if (this.savingsActive && this.savingsAmount > 0) {
            this.cash += this.savingsAmount;
        }

        if (this.autoDcaActive && this.autoDcaAmount > 10 && cashBeforeSavings > 10) {
            const availableToInvest = Math.min(this.autoDcaAmount, cashBeforeSavings);
            const sharesToAutoBuy = Math.floor((availableToInvest - 10) / this.getCurrentPrice());
            if (sharesToAutoBuy > 0) { this.buy(sharesToAutoBuy); }
        }

        this.currentYearIndex++;
        this.history.push({
            year: this.currentYearIndex + 1,
            totalValue: this.getTotalValue()
        });
        return true;
    }
}

let sim = null;
let assetChart = null;

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

    updateChart();
}

function initChart() {
    const ctx = document.getElementById('assetChart').getContext('2d');
    assetChart = new Chart(ctx, {
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
            scales: { y: { beginAtZero: true } }
        }
    });
}

function updateChart() {
    assetChart.data.labels = sim.history.map(h => `Year ${h.year}`);
    assetChart.data.datasets[0].data = sim.history.map(h => h.totalValue);
    assetChart.update();
}

function startAutoPlay() {
    if (autoPlayActive) return;
    autoPlayActive = true;
    autoPlayElapsed = 0;

    document.getElementById('btn-auto-play').textContent = '⏸ Pause';
    document.getElementById('btn-auto-play').classList.add('active');
    
    const progressContainer = document.getElementById('progress-container');
    const progressTrack = document.querySelector('.progress-track');
    
    progressContainer.classList.remove('hidden');
    progressTrack.classList.remove('hidden'); // 다시 시작할 때 트랙 복구

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
                stopAutoPlay(true);
            }
        }
    }, TICK_INTERVAL_MS);
}

function stopAutoPlay(ended = false) {
    autoPlayActive = false;
    clearInterval(autoPlayTickInterval);
    autoPlayTickInterval = null;

    document.getElementById('btn-auto-play').textContent = '▶▶ Start Auto-Play';
    document.getElementById('btn-auto-play').classList.remove('active');
    document.getElementById('progress-bar').style.width = '0%';

    if (ended) {
        // 수정 2: 60년 도달 시 진행률 빈 막대(track)는 숨기고 텍스트만 표시
        document.querySelector('.progress-track').classList.add('hidden');
        document.getElementById('progress-label').textContent = 'Simulation Ended (Reached 60 Years)';
        document.getElementById('btn-auto-play').disabled = true;
    } else {
        document.getElementById('progress-container').classList.add('hidden');
    }
}

document.getElementById('btn-start').addEventListener('click', () => {
    const initialCash = parseFloat(document.getElementById('initial-cash').value);
    if (isNaN(initialCash) || initialCash <= 0) {
        alert("Please enter a valid initial capital.");
        return;
    }

    sim = new MarketSimulator(initialCash);
    
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
    if (autoPlayActive) {
        stopAutoPlay();
    } else {
        startAutoPlay();
    }
});

document.getElementById('toggle-dca').addEventListener('change', (e) => {
    const input = document.getElementById('input-dca-amount');
    input.disabled = !e.target.checked;
    sim.autoDcaActive = e.target.checked;
});

document.getElementById('input-dca-amount').addEventListener('input', (e) => {
    sim.autoDcaAmount = parseFloat(e.target.value) || 0;
});

document.getElementById('toggle-savings').addEventListener('change', (e) => {
    const input = document.getElementById('input-savings-amount');
    input.disabled = !e.target.checked;
    sim.savingsActive = e.target.checked;
});

document.getElementById('input-savings-amount').addEventListener('input', (e) => {
    sim.savingsAmount = parseFloat(e.target.value) || 0;
});