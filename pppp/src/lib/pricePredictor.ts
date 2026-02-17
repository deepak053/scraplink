// src/lib/pricePredictor.ts
export interface PricePrediction {
  predictedPrice: number;
  confidence: number;
  factors: {
    basePrice: number;
    weightMultiplier: number;
    marketTrend: number;
    qualityAdjustment: number;
  };
}

type RFResponse = {
  base_price: number;
  predicted_price: number;
  weight: number;
};

function normalizeScrapType(t: string): string {
  const s = (t || "").toLowerCase().trim().replace(/\s+/g, "-");
  if (["metal", "e-waste", "paper", "glass"].includes(s)) return s;
  // handle variants like "ewaste", "e waste"
  if (s === "ewaste") return "e-waste";
  return s;
}

class PricePredictionEngine {
  private endpoint =
    (import.meta as any).env?.VITE_RF_API_URL || "";

  /**
   * Check if backend is reachable
   */
  async checkHealth(): Promise<boolean> {
    try {
      const res = await fetch(`${this.endpoint}/health`, { method: "GET" });
      return res.ok;
    } catch (e) {
      return false;
    }
  }

  /**
   * Preferred: 3-level prediction (Category → Sub-category → Leaf)
   */
  async predictPrice3(
    scrapCategory: string,
    subCategory: string,
    subSubCategory: string,
    weight: number
  ): Promise<PricePrediction> {
    const body = {
      scrap_type: normalizeScrapType(scrapCategory),
      sub_category: subCategory,
      sub_sub_category: subSubCategory,
      weight,
    };

    const res = await fetch(`${this.endpoint}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || "ML Prediction failed");
    }

    const data = (await res.json()) as RFResponse;
    const basePrice = Number(data.base_price);
    const predicted = data.predicted_price ?? (basePrice * weight);

    return {
      predictedPrice: predicted,
      confidence: 0.95,
      factors: {
        basePrice,
        weightMultiplier: predicted / (basePrice * weight || 1),
        marketTrend: 1.0,
        qualityAdjustment: 1.0,
      },
    };
  }

  /**
   * Legacy 2-level support (maps to 3-level on backend)
   */
  async predictPrice(
    scrapCategory: string,
    subCategoryOrLeaf: string,
    weight: number
  ): Promise<PricePrediction> {
    return this.predictPrice3(scrapCategory, subCategoryOrLeaf, subCategoryOrLeaf, weight);
  }

  /**
   * Optional simple batch (sequential). If you add a /predict-batch,
   * you can optimize this to one request.
   */
  async predictBatch3(
    items: Array<{
      category: string;
      subCategory: string;
      subSubCategory: string;
      weight: number;
    }>
  ): Promise<PricePrediction[]> {
    const out: PricePrediction[] = [];
    for (const it of items) {
      out.push(
        await this.predictPrice3(it.category, it.subCategory, it.subSubCategory, it.weight)
      );
    }
    return out;
  }
}

export const pricePredictor = new PricePredictionEngine();
