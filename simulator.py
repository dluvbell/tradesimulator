import math

MARKET_DATA = [114, 133, 92, 59, 77, 97, 105, 117, 151, 202, 195, 232, 278, 247, 324, 348, 330, 381, 454, 373, 586, 676, 776, 751, 1052, 1291, 1570, 2192, 4069, 2470, 1950, 1335, 2003, 2178, 2205, 2415, 2652, 1577, 2269, 2652, 2605, 3019, 4176, 4736, 5007, 5383, 6903, 6635, 8972, 12888, 15644, 10466, 15011, 16000, 17500, 18200, 19500, 21000, 20500, 22500]

class MarketSimulator:
    def __init__(self, initial_cash):
        self.current_year_index = 0
        self.market_data = MARKET_DATA
        self.cash = initial_cash
        self.shares = 0
        self.average_cost = 0.0
        self.realized_gain_loss = 0.0
        
        self.auto_dca_active = False
        self.auto_dca_amount = 0.0
        
        self.savings_active = False
        self.savings_amount = 0.0
        self.history = [{"year": 1, "total_value": initial_cash}]

    def get_current_price(self):
        return self.market_data[self.current_year_index]

    def get_total_value(self):
        return self.cash + (self.shares * self.get_current_price())
        
    def set_dca(self, active, amount):
        self.auto_dca_active = active
        self.auto_dca_amount = amount

    def set_savings(self, active, amount):
        self.savings_active = active
        self.savings_amount = amount

    def buy(self, shares_to_buy):
        price = self.get_current_price()
        total_cost = (shares_to_buy * price) + 10 

        if self.cash >= total_cost and shares_to_buy > 0:
            self.cash -= total_cost
            total_invested = (self.shares * self.average_cost) + (shares_to_buy * price)
            self.shares += shares_to_buy
            self.average_cost = total_invested / self.shares
            return True
        return False

    def sell(self, shares_to_sell):
        price = self.get_current_price()
        
        if self.shares >= shares_to_sell and shares_to_sell > 0:
            proceeds_before_fee = shares_to_sell * price
            cost_basis = shares_to_sell * self.average_cost
            gross_gain = proceeds_before_fee - cost_basis
            
            tax = gross_gain * 0.15 if gross_gain > 0 else 0
                
            raw_proceeds = proceeds_before_fee - 10 - tax
            total_proceeds = max(0, raw_proceeds)
            
            self.cash += total_proceeds
            self.shares -= shares_to_sell
            
            net_gain_after_fee_and_tax = gross_gain - 10 - tax
            self.realized_gain_loss += net_gain_after_fee_and_tax
            
            if self.shares == 0:
                self.average_cost = 0.0
            return True
        return False

    def next_year(self):
        if self.current_year_index >= len(self.market_data) - 1:
            return False

        cash_before_savings = self.cash

        if self.savings_active:
            self.cash += self.savings_amount

        if self.auto_dca_active and self.auto_dca_amount > 10 and cash_before_savings > 10:
            price = self.get_current_price()
            available_to_invest = min(self.auto_dca_amount, cash_before_savings)
            shares_to_auto_buy = math.floor((available_to_invest - 10) / price)
            
            if shares_to_auto_buy > 0:
                self.buy(shares_to_auto_buy)

        self.current_year_index += 1
        self.history.append({
            "year": self.current_year_index + 1,
            "total_value": self.get_total_value()
        })
        return True