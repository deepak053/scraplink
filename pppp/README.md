# ♻️ Scrap-Link

**Scrap-Link** is a digital marketplace platform designed to bridge the gap between **sellers** (individuals or businesses with recyclable scrap) and **recyclers**. The platform automates and streamlines the scrap disposal process using AI-driven price estimation and location-based discovery.

## ✨ Key Features

*   **🤖 AI Price Prediction**: Uses a Random Forest machine learning model to predict fair market value based on scrap type, category, and weight.
*   **📍 Geospatial Discovery**: Integrated Leaflet maps allow recyclers to find nearby scrap listings in real-time.
*   **📅 Pickup Management**: A structured workflow for scheduling pickups with real-time recycler notifications.
*   **📊 Admin Dashboard**: Dedicated oversight for dataset management and ML model retraining.
*   **🛡️ Secure Auth**: Robust authentication and user role management (Seller vs. Recycler vs. Admin) powered by Supabase.

## 🛠️ Technical Stack

- **Frontend**: React (Vite), Tailwind CSS, Lucide Icons, React Leaflet.
- **Backend**: Python Flask (dedicated for ML API and specialized backend logic).
- **ML Engine**: Scikit-Learn (Random Forest Regressor).
- **Database/Auth**: Supabase (PostgreSQL with Real-time capabilities).

## 🚀 Getting Started

### 1. Prerequisites
- Node.js (v18+)
- Python (3.9+)

### 2. Environment Setup
Create a `.env` file in the root with the following (sample):
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_RF_API_URL=http://localhost:5001
```

### 3. Installation & Run
```bash
# Install frontend deps
npm install

# Setup Python backend
cd backend_ml
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Run both concurrently
cd ..
npm run dev:all
```

## 📂 Project Structure
- `/src`: React frontend source code.
- `/backend_ml`: Python backend, model training scripts, and Flask API.
- `/supabase`: Database migrations and configuration.