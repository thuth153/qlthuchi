
/**
 * Calculate portfolio statistics based on transaction history
 * Method: Weighted Average Cost (WAC)
 * 
 * Logic:
 * - Buy: Increase quantity, update average cost.
 * - Sell: Decrease quantity, realize profit/loss based on difference between Sell Price and Current Avg Cost.
 *   (Selling does NOT change the Average Cost of remaining shares).
 */
export const calculatePortfolio = (transactions, currentPrices = {}) => {
    const portfolio = {};
    // Structure: { [symbol]: { quantity: 0, avgPrice: 0, realizedPL: 0, totalBuy: 0, totalSell: 0, sellQuantity: 0 } }

    // Sort by date ascending to process legally
    // If dates are equal, process BUY before SELL to avoid negative balances in intraday trading
    const sortedTrans = [...transactions].sort((a, b) => {
        const dateA = new Date(a.transaction_date);
        const dateB = new Date(b.transaction_date);
        const diff = dateA - dateB;
        if (diff !== 0) return diff;

        // Same date: Priority BUY (-1) < SELL (1)
        if (a.type === 'BUY' && b.type !== 'BUY') return -1;
        if (a.type !== 'BUY' && b.type === 'BUY') return 1;
        return 0;
    });

    sortedTrans.forEach(t => {
        const symbol = t.stock_symbol;
        if (!portfolio[symbol]) {
            portfolio[symbol] = { quantity: 0, avgPrice: 0, realizedPL: 0, totalBuy: 0, totalSell: 0, sellQuantity: 0, history: [] };
        }

        const p = portfolio[symbol];
        const qty = Number(t.quantity);
        const price = Number(t.price);

        if (t.type === 'BUY') {
            // WAC Formula: NewAvg = ((OldQty * OldAvg) + (NewQty * BuyPrice)) / (OldQty + NewQty)
            const totalValueObj = (p.quantity * p.avgPrice) + (qty * price);
            const newQty = p.quantity + qty;

            if (newQty > 0) {
                p.avgPrice = totalValueObj / newQty;
            }
            p.quantity = newQty;
            p.totalBuy += (qty * price);
        }
        else if (t.type === 'SELL') {
            // Realized PL = (SellPrice - AvgPrice) * SellQty
            const profit = (price - p.avgPrice) * qty;
            p.realizedPL += profit;
            p.quantity -= qty;
            p.totalSell += (qty * price);
            p.sellQuantity += qty;

            // Annotate for display purposes
            t.calculatedPL = profit;
        }

        p.history.push(t);
    });

    // Calculate Unrealized PL and Totals
    let totalMarketValue = 0;
    let totalInvested = 0; // Cost basis of current holdings
    let totalRealizedPL = 0;
    let totalUnrealizedPL = 0;

    const holdings = Object.keys(portfolio).map(symbol => {
        const p = portfolio[symbol];
        const currentPrice = currentPrices[symbol] || 0;

        // Unrealized PL = (CurrentPrice - AvgPrice) * CurrentQty
        let unrealized = 0;
        let marketValue = 0;

        if (currentPrice > 0 && p.quantity > 0) {
            unrealized = (currentPrice - p.avgPrice) * p.quantity;
            marketValue = currentPrice * p.quantity;
        }

        // Only count active holdings for Portfolio Totals
        if (p.quantity > 0) {
            totalMarketValue += marketValue;
            totalInvested += (p.avgPrice * p.quantity);
            totalUnrealizedPL += unrealized;
        }
        totalRealizedPL += p.realizedPL;

        const avgSellPrice = p.sellQuantity > 0 ? p.totalSell / p.sellQuantity : 0;

        // Total P/L for the stock = Realized (from closed trades) + Unrealized (from open trades)
        const totalPL = p.realizedPL + unrealized;

        return {
            symbol,
            quantity: p.quantity,
            avgPrice: p.avgPrice, // This is Avg Buy Price
            avgSellPrice,         // New field
            currentPrice,
            marketValue,
            realizedPL: p.realizedPL,
            unrealizedPL: unrealized,
            totalPL: totalPL,
            allocation: 0
        };
    }).filter(h => h.quantity > 0 || h.realizedPL !== 0); // Keep if holding or has P/L history

    // Calculate Allocation % using Chart Value (Market Value or Cost Basis)
    let totalChartValue = 0;
    holdings.forEach(h => {
        h.chartValue = h.marketValue > 0 ? h.marketValue : (h.quantity * h.avgPrice);
        totalChartValue += h.chartValue;
    });

    holdings.forEach(h => {
        if (totalChartValue > 0) {
            h.allocation = (h.chartValue / totalChartValue) * 100;
        }
    });

    return {
        holdings,
        enrichedTransactions: sortedTrans, // Return annotated list
        summary: {
            totalInvested,
            totalMarketValue,
            totalRealizedPL,
            totalUnrealizedPL,
            totalPL: totalRealizedPL + totalUnrealizedPL,
            returnRate: totalInvested > 0 ? ((totalRealizedPL + totalUnrealizedPL) / totalInvested) * 100 : 0
        }
    };
};
