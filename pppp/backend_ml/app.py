import os
import joblib
import pandas as pd
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from pathlib import Path
from train_model import train_and_save_model, BASE_DIR, MODEL_PATH
from supabase import create_client, Client

# === Setup ===
load_dotenv(BASE_DIR / ".env")

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

PORT = int(os.getenv("PORT", "5001"))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


# === Safe model loader ===
def safe_load_model():
    if not Path(MODEL_PATH).exists():
        train_and_save_model()

    try:
        return joblib.load(MODEL_PATH)
    except Exception:
        if Path(MODEL_PATH).exists():
            Path(MODEL_PATH).unlink(missing_ok=True)
        train_and_save_model()
        return joblib.load(MODEL_PATH)


model = safe_load_model()


# === Health check ===
@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"}), 200


# === Prediction endpoint ===
@app.route("/predict", methods=["POST"])
def predict():
    data = request.get_json(force=True) or {}

    scrap_type = str(data.get("scrap_type", "")).strip().lower().replace(" ", "-")
    sub_category = str(data.get("sub_category", "")).strip()
    leaf = str(data.get("sub_sub_category", "")).strip()
    weight = float(data.get("weight", 0))

    if not scrap_type or not sub_category or weight <= 0:
        return (
            jsonify(
                {"error": "scrap_type, sub_category and positive weight are required"}
            ),
            400,
        )

    # Figure out what columns the model expects
    try:
        expected_cols = getattr(model, "feature_names_in_", [])
    except Exception:
        expected_cols = []

    if len(expected_cols) == 2:
        # trained only on 2 columns
        X = pd.DataFrame(
            [{"scrap_type": scrap_type, "sub_category": leaf or sub_category}]
        )
    else:
        X = pd.DataFrame(
            [
                {
                    "scrap_type": scrap_type,
                    "sub_category": sub_category or "N/A",
                    "sub_sub_category": leaf or sub_category,
                }
            ]
        )

    try:
        price_per_kg = float(model.predict(X)[0])
    except Exception as e:
        return jsonify({"error": f"Model prediction failed: {str(e)}"}), 500

    return (
        jsonify(
            {
                "base_price": round(price_per_kg, 2),
                "predicted_price": round(price_per_kg * weight, 2),
                "weight": weight,
            }
        ),
        200,
    )


# === Retrain endpoint ===
@app.route("/retrain", methods=["POST"])
def retrain():
    train_and_save_model()
    global model
    model = joblib.load(MODEL_PATH)
    return jsonify({"status": "retrained"}), 200


# === Auth Signup Endpoint (Bypass RLS) ===
@app.route("/auth/signup", methods=["POST"])
def auth_signup():
    data = request.get_json(force=True) or {}
    email = data.get("email")
    password = data.get("password")
    user_data = data.get("userData", {})

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    try:
        # Create User via Admin API (auto-confirm email)
        user_response = supabase.auth.admin.create_user({
            "email": email,
            "password": password,
            "user_metadata": {
                "name": user_data.get("name"),
                "role": user_data.get("role")
            },
            "email_confirm": True
        })
        
        user = user_response.user
        
        if not user:
             return jsonify({"error": "Failed to create user"}), 500

        # Insert Profile (Bypassing RLS because we use Service Role Key)
        profile = {
            "user_id": user.id,
            "name": user_data.get("name"),
            "email": email,
            "phone": user_data.get("phone"),
            "role": user_data.get("role"),
            "latitude": user_data.get("latitude"),
            "longitude": user_data.get("longitude")
        }
        
        supabase.table("users").insert(profile).execute()
        
        return jsonify({"message": "User created successfully", "user": {"id": user.id, "email": user.email}}), 200

    except Exception as e:
        msg = str(e)
        if "already registered" in msg or "User already registered" in msg:
             return jsonify({"error": "User already registered"}), 400
        return jsonify({"error": msg}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=PORT, debug=True, use_reloader=False)
