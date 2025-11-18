import os
from pathlib import Path

import joblib
import pandas as pd
from dotenv import load_dotenv
from sklearn.metrics import classification_report, confusion_matrix

from train_model import BASE_DIR, MODEL_PATH, fetch_dataset


def load_model():
    if not Path(MODEL_PATH).exists():
        raise FileNotFoundError(
            f"Trained model not found at {MODEL_PATH}. Run train_model.py first."
        )
    return joblib.load(MODEL_PATH)


def bin_prices(series: pd.Series, num_bins: int = 4):
    """
    Convert continuous prices into categorical buckets using quantiles so we can
    build a confusion matrix. Returns the categorical labels, the bin edges, and the labels list.
    """
    if series.nunique() < num_bins:
        num_bins = int(series.nunique())
    if num_bins < 2:
        raise ValueError("Need at least two distinct price values to build bins.")

    binned, bin_edges = pd.qcut(
        series,
        q=num_bins,
        labels=[f"Q{i + 1}" for i in range(num_bins)],
        retbins=True,
        duplicates="drop",
    )
    return binned.astype(str), bin_edges, list(binned.cat.categories)


def main():
    load_dotenv(BASE_DIR / ".env")

    print("📦 Loading dataset from Supabase...")
    df = fetch_dataset()
    X = df[["scrap_type", "sub_category", "sub_sub_category"]]
    y_true = df["base_price"].astype(float)

    print("🤖 Loading trained model...")
    model = load_model()

    print("🔮 Generating predictions...")
    y_pred = pd.Series(model.predict(X), index=y_true.index)

    print("🧮 Building confusion matrix (price buckets via quantiles)...")
    y_true_cat, bin_edges, labels = bin_prices(y_true)
    y_pred_cat = pd.cut(
        y_pred,
        bins=bin_edges,
        labels=labels,
        include_lowest=True,
        duplicates="drop",
    ).astype(str)

    cm = confusion_matrix(y_true_cat, y_pred_cat, labels=labels)
    report = classification_report(y_true_cat, y_pred_cat, labels=labels, zero_division=0)

    cm_df = pd.DataFrame(cm, index=labels, columns=labels)
    output_dir = BASE_DIR / "model"
    output_dir.mkdir(exist_ok=True)

    cm_path = output_dir / "confusion_matrix.csv"
    cm_df.to_csv(cm_path, index=True)

    print("\nConfusion Matrix (rows = actual, cols = predicted):")
    print(cm_df)
    print("\nClassification report:")
    print(report)
    print(f"\n✅ Confusion matrix saved to {cm_path}")

    # Optional heatmap if matplotlib/seaborn are available
    try:
        import matplotlib.pyplot as plt
        import seaborn as sns

        plt.figure(figsize=(6, 5))
        sns.heatmap(cm_df, annot=True, fmt="d", cmap="Blues")
        plt.title("Confusion Matrix (Price Buckets)")
        plt.ylabel("Actual")
        plt.xlabel("Predicted")
        heatmap_path = output_dir / "confusion_matrix.png"
        plt.tight_layout()
        plt.savefig(heatmap_path, dpi=200)
        plt.close()
        print(f"🖼️ Confusion matrix heatmap saved to {heatmap_path}")
    except ModuleNotFoundError:
        print(
            "ℹ️ matplotlib or seaborn not installed. "
            "Install them to generate a heatmap."
        )


if __name__ == "__main__":
    main()

