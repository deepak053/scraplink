import os
import joblib
import pandas as pd
from dotenv import load_dotenv
from pathlib import Path
from supabase import create_client, Client
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline

BASE_DIR = Path(__file__).parent
load_dotenv(BASE_DIR / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

MODEL_DIR = BASE_DIR / "model"
MODEL_PATH = MODEL_DIR / "scrap_rf_model.pkl"


# ============================
# Fetch dataset
# ============================
def fetch_dataset() -> pd.DataFrame:
    try:
        if not SUPABASE_URL or not SUPABASE_KEY:
            raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.")

        client: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        resp = client.table("scrap_prices").select(
            "scrap_type, sub_category, sub_sub_category, base_price"
        ).execute()

        rows = resp.data or []
        if not rows:
            raise RuntimeError("No rows returned from table 'scrap_prices'.")
    except Exception as e:
        print(f"⚠️ Supabase fetch failed ({e}). Using local fallback data for training...")
        rows = [
            {"scrap_type": "metal", "sub_category": "Ferrous Metals", "sub_sub_category": "Iron", "base_price": 25.50},
            {"scrap_type": "metal", "sub_category": "Non-Ferrous Metals", "sub_sub_category": "Copper", "base_price": 720.00},
            {"scrap_type": "metal", "sub_category": "Non-Ferrous Metals", "sub_sub_category": "Aluminum", "base_price": 145.00},
            {"scrap_type": "e-waste", "sub_category": "Computing Devices", "sub_sub_category": "Laptop - Basic Laptop", "base_price": 1500.00},
            {"scrap_type": "e-waste", "sub_category": "Mobile Devices", "sub_sub_category": "Broken Phones", "base_price": 500.00},
            {"scrap_type": "paper", "sub_category": "Mixed & Office Paper", "sub_sub_category": "Old Newspaper (ONP)", "base_price": 12.00},
            {"scrap_type": "glass", "sub_category": "Container Glass", "sub_sub_category": "Bottles", "base_price": 8.00},
        ]

    df = pd.DataFrame(rows)
    for c in ["scrap_type", "sub_category", "sub_sub_category"]:
        df[c] = df[c].astype(str).str.strip()

    df["scrap_type"] = df["scrap_type"].str.lower().str.replace(" ", "-", regex=False)
    df["base_price"] = pd.to_numeric(df["base_price"], errors="coerce")

    df = df.dropna(subset=["scrap_type", "sub_category", "sub_sub_category", "base_price"])
    print(f"✅ Dataset loaded: {len(df)} rows")
    return df


# ============================
# Train, evaluate, save model
# ============================
def train_and_save_model():
    df = fetch_dataset()

    X = df[["scrap_type", "sub_category", "sub_sub_category"]]
    y = df["base_price"]

    preprocessor = ColumnTransformer(
        transformers=[
            (
                "cat",
                OneHotEncoder(handle_unknown="ignore"),
                ["scrap_type", "sub_category", "sub_sub_category"]
            )
        ]
    )

    model = Pipeline(
        [
            ("pre", preprocessor),
            ("rf", RandomForestRegressor(n_estimators=300, random_state=42, n_jobs=-1))
        ]
    )

    # Train-test split
    print("📊 Splitting dataset (80/20)...")
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    print("🎯 Training model...")
    model.fit(X_train, y_train)

    # Model evaluation
    y_pred = model.predict(X_test)
    mae = mean_absolute_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)

    print("📈 Evaluation:")
    print(f"   MAE = {mae:.2f}")
    print(f"   R²  = {r2:.4f}")

    # Retrain on full dataset for production
    print("🔁 Retraining model on full dataset...")
    model.fit(X, y)

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    tmp = MODEL_PATH.with_suffix(".tmp")
    joblib.dump(model, tmp)
    tmp.replace(MODEL_PATH)

    print(f"💾 Model saved at {MODEL_PATH}")


if __name__ == "__main__":
    train_and_save_model()
