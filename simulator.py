import math

RANDOM_DATA = [114, 133, 92, 59, 77, 97, 105, 117, 151, 202, 195, 232, 278, 247, 324, 348, 330, 381, 454, 373, 586, 676, 776, 751, 1052, 1291, 1570, 2192, 4069, 2470, 1950, 1335, 2003, 2175, 2205, 2415, 2652, 1577, 2269, 2652, 2605, 3019, 4176, 4736, 5007, 5383, 6903, 6635, 8972, 12888, 15644, 10466, 15011, 16512, 18163, 19979, 21977, 24174, 26591, 29250, 32175]
MARKET_DATA = [100.0]

for i in range(1, len(RANDOM_DATA)):
    pct_change = (RANDOM_DATA[i] - RANDOM_DATA[i-1]) / RANDOM_DATA[i-1]
    next_price = MARKET_DATA[-1] * (1 + pct_change)
    if next_price <= 0:
        next_price = 0.0
    MARKET_DATA.append(next_price)

class MarketSimulator:
    def __init__(self, initial_cash):
        self.current_year_index = 0
        self.market_data = MARKET_DATA
        self.cash = initial_cash
        self.shares = 0
        self.average_cost = 0.0
        self.realized_gain_loss = 0.0
        
        self.tax_rate = 0.15
        self.trading_fee = 10.0
        
        self.savings_active = False
        self.savings_amount = 0.0

        self.auto_dca_active = False
        self.auto_dca_amount = 0.0
        
        self.is_failed = False 
        
        self.history = [{"year": 1, "total_value": initial_cash, "price": MARKET_DATA[0]}]

    def get_current_price(self):
        return self.market_data[self.current_year_index]

    def get_total_value(self):
        return self.cash + (self.shares * self.get_current_price())
        
    def set_tax_rate(self, rate_percent):
        self.tax_rate = rate_percent / 100.0
        
    def set_trading_fee(self, fee):
        self.trading_fee = float(fee)

    def set_savings(self, active, amount):
        self.savings_active = active
        self.savings_amount = amount

    def set_dca(self, active, amount):
        self.auto_dca_active = active
        self.auto_dca_amount = amount

    def buy(self, shares_to_buy):
        if self.is_failed:
            return False

        price = self.get_current_price()
        total_cost = (shares_to_buy * price) + self.trading_fee 

        if self.cash >= total_cost and shares_to_buy > 0:
            self.cash -= total_cost
            total_invested = (self.shares * self.averageCost) + (shares_to_buy * price)
            self.shares += shares_to_buy
            self.averageCost = total_invested / self.shares
            return True
        return False

    def sell(self, shares_to_sell):
        if self.is_failed:
            return False

        price = self.get_current_price()
        
        if self.shares >= shares_to_sell and shares_to_sell > 0:
            proceeds_before_fee = shares_to_sell * price
            cost_basis = shares_to_sell * self.average_cost
            gross_gain = proceeds_before_fee - cost_basis
            
            tax = gross_gain * self.tax_rate if gross_gain > 0 else 0
                
            raw_proceeds = proceeds_before_fee - self.trading_fee - tax
            total_proceeds = max(0, raw_proceeds)
            
            self.cash += total_proceeds
            self.shares -= shares_to_sell
            
            net_gain_after_fee_and_tax = total_proceeds - cost_basis
            self.realized_gain_loss += net_gain_after_fee_and_tax
            
            if self.shares == 0:
                self.average_cost = 0.0
            return True
        return False

    def next_year(self):
        if self.current_year_index >= len(self.market_data) - 1 or self.is_failed:
            return False

        if self.savings_active and self.savings_amount > 0:
            self.cash += self.savings_amount

        if self.auto_dca_active and self.auto_dca_amount > 0:
            dca_cap = min(self.auto_dca_amount, self.savings_amount)
            available_to_invest = min(dca_cap, self.cash)
            
            if available_to_invest > self.trading_fee and self.get_current_price() > 0:
                price = self.get_current_price()
                shares_to_auto_buy = math.floor((available_to_invest - self.trading_fee) / price)
                if shares_to_auto_buy > 0:
                    self.buy(shares_to_auto_buy)

        next_price = self.market_data[self.current_year_index + 1]
        
        self.current_year_index += 1
        self.history.append({
            "year": self.current_year_index + 1,
            "total_value": self.get_total_value(),
            "price": next_price
        })

        if next_price <= 0:
            self.is_failed = True
            return False

        return True