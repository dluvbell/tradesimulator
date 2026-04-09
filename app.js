const marketData = [114, 133, 92, 59, 77, 97, 105, 117, 151, 202, 195, 232, 278, 247, 324, 348, 330, 381, 454, 373, 586, 676, 776, 751, 1052, 1291, 1570, 2192, 4069, 2470, 1950, 1335, 2003, 2178, 2205, 2415, 2652, 1577, 2269, 2652, 2605, 3019, 4176, 4736, 5007, 5383, 6903, 6635, 8972, 12888, 15644, 10466, 15011, 16000, 17500, 18200, 19500, 21000, 20500, 22500];

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
        alert("현금이 부족합니다.");
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
        alert("보유 주식이 부족합니다.");
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

// --- UI 제어 로직 ---
let sim = null;
let assetChart = null;

// --- 자동 진행 관련 변수 ---
const YEAR_DURATION_MS = 20000;   // 1년 = 20초
const TICK_INTERVAL_MS = 100;     // 프로그레스바 업데이트 주기
let autoPlayActive = false;
let autoPlayTickInterval = null;  // 프로그레스바용 tick 타이머
let autoPlayElapsed = 0;          // 현재 연도에서 경과한 ms

const formatMoney = (num) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);

function updateUI() {
    document.getElementById('display-year').innerText = sim.getYearLabel();
    document.getElementById('display-price').innerText = formatMoney(sim.getCurrentPrice());
    document.getElementById('display-total').innerText = formatMoney(sim.getTotalValue());
    document.getElementById('display-cash').innerText = formatMoney(sim.cash);
    document.getElementById('display-shares').innerText = `${sim.shares} 주`;
    document.getElementById('display-avg-cost').innerText = formatMoney(sim.averageCost);
    
    const realizedEl = document.getElementById('display-realized');
    realizedEl.innerText = formatMoney(sim.realizedGainLoss);
    realizedEl.style.color = sim.realizedGainLoss >= 0 ? 'green' : 'red';

    updateChart();
}

function initChart() {
    const ctx = document.getElementById('assetChart').getContext('2d');
    assetChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: sim.history.map(h => `Year ${h.year}`),
            datasets: [{
                label: '총 자산 가치 ($)',
                data: sim.history.map(h => h.totalValue),
                borderColor: '#2563eb',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
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

// --- 자동 진행 함수 ---
function startAutoPlay() {
    if (autoPlayActive) return;
    autoPlayActive = true;
    autoPlayElapsed = 0;

    document.getElementById('btn-auto-play').textContent = '⏸ 일시정지';
    document.getElementById('btn-auto-play').classList.add('active');
    document.getElementById('progress-container').classList.remove('hidden');

    autoPlayTickInterval = setInterval(() => {
        autoPlayElapsed += TICK_INTERVAL_MS;

        // 프로그레스바 업데이트
        const pct = Math.min((autoPlayElapsed / YEAR_DURATION_MS) * 100, 100);
        document.getElementById('progress-bar').style.width = pct + '%';

        // 남은 시간 표시
        const remaining = Math.max(0, Math.ceil((YEAR_DURATION_MS - autoPlayElapsed) / 1000));
        document.getElementById('progress-label').textContent =
            `다음 연도까지 ${remaining}초`;

        // 20초 경과 → 연도 진행
        if (autoPlayElapsed >= YEAR_DURATION_MS) {
            autoPlayElapsed = 0;
            const advanced = sim.nextYear();
            updateUI();

            if (!advanced) {
                // 60년 도달 → 자동 종료
                stopAutoPlay(true);
            }
        }
    }, TICK_INTERVAL_MS);
}

function stopAutoPlay(ended = false) {
    autoPlayActive = false;
    clearInterval(autoPlayTickInterval);
    autoPlayTickInterval = null;

    document.getElementById('btn-auto-play').textContent = '▶▶ 자동 진행 시작';
    document.getElementById('btn-auto-play').classList.remove('active');
    document.getElementById('progress-bar').style.width = '0%';

    if (ended) {
        document.getElementById('progress-label').textContent = '시뮬레이션 종료 (60년 도달)';
        document.getElementById('btn-auto-play').disabled = true;
        document.getElementById('btn-next-year').disabled = true;
    } else {
        document.getElementById('progress-container').classList.add('hidden');
    }
}

function resetAutoPlayTimer() {
    // 수동 Next Year 클릭 시 타이머 리셋
    if (autoPlayActive) {
        autoPlayElapsed = 0;
    }
}

// --- 이벤트 리스너 ---
document.getElementById('btn-start').addEventListener('click', () => {
    const initialCash = parseFloat(document.getElementById('initial-cash').value);
    if (isNaN(initialCash) || initialCash <= 0) {
        alert("올바른 초기 자본금을 입력하세요.");
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
        alert("올바른 수량을 입력하세요.");
        return;
    }
    if (sim.buy(qty)) updateUI();
});

document.getElementById('btn-sell').addEventListener('click', () => {
    const qty = parseInt(document.getElementById('trade-qty').value);
    if (isNaN(qty) || qty <= 0) {
        alert("올바른 수량을 입력하세요.");
        return;
    }
    if (sim.sell(qty)) updateUI();
});

document.getElementById('btn-next-year').addEventListener('click', () => {
    resetAutoPlayTimer();
    const advanced = sim.nextYear();
    if (advanced) {
        updateUI();
    } else {
        stopAutoPlay(true);
        alert("시뮬레이션이 종료되었습니다 (60년 도달).");
    }
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