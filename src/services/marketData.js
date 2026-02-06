
import { supabase } from '../supabaseClient'; // Make sure this is imported

// 1. Fetch persistent market prices from Supabase
// 2. Fetch live prices from SSI iBoard API (fallback)
// 3. Update Supabase with new live prices
export const fetchMarketPrices = async (symbols) => {
    if (!symbols || symbols.length === 0) return {};

    const prices = {};

    // A. Load from Supabase 'market_prices' first (Cache)
    const { data: cachedPrices, error } = await supabase
        .from('market_prices')
        .select('*')
        .in('stock_symbol', symbols);

    if (!error && cachedPrices) {
        cachedPrices.forEach(p => {
            prices[p.stock_symbol] = Number(p.current_price);
        });
    }

    // B. Fetch from SSI iBoard API
    // SSI provides a public API endpoint for stock data
    const fetchPromises = symbols.map(async (sym) => {
        try {
            // Try SSI iBoard API first
            const ssiResponse = await fetch(`https://iboard-api.ssi.com.vn/statistics/charts/symbols/${sym}`, {
                headers: {
                    'Accept': 'application/json',
                }
            });

            if (ssiResponse.ok) {
                const ssiData = await ssiResponse.json();
                if (ssiData && ssiData.data && ssiData.data.length > 0) {
                    const latestData = ssiData.data[ssiData.data.length - 1];
                    const livePrice = latestData.closePrice || latestData.price;
                    if (livePrice) {
                        prices[sym] = livePrice;
                        savePriceToDb(sym, livePrice);
                        return;
                    }
                }
            }

            // Fallback to VNDirect API
            const vndResponse = await fetch(`https://finfo-api.vndirect.com.vn/v4/stock_prices?sort=date&q=code:${sym}~date:gte:${new Date().toISOString().split('T')[0]}&size=1`, {
                headers: {
                    'Accept': 'application/json',
                }
            });

            if (vndResponse.ok) {
                const vndData = await vndResponse.json();
                if (vndData && vndData.data && vndData.data.length > 0) {
                    const livePrice = vndData.data[0].close || vndData.data[0].adClose;
                    if (livePrice) {
                        prices[sym] = livePrice;
                        savePriceToDb(sym, livePrice);
                        return;
                    }
                }
            }

            // If both APIs fail, keep cached price or set to 0
            if (!prices[sym]) prices[sym] = 0;
        } catch (e) {
            console.error(`Error fetching price for ${sym}:`, e);
            // Silent fail on API, use cache or fallback
            if (!prices[sym]) prices[sym] = 0;
        }
    });

    // Wait for all API calls to complete
    await Promise.allSettled(fetchPromises);

    return prices;
};

// Helper: Save price to DB
export const savePriceToDb = async (symbol, price) => {
    // Upsert
    const { error } = await supabase
        .from('market_prices')
        .upsert({ stock_symbol: symbol, current_price: price, updated_at: new Date() }, { onConflict: 'stock_symbol' });

    if (error) console.error("Failed to save price", error);
};
