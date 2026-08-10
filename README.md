🌍 Tourez AI

### AI-Powered Smart Tourism Website

**SmartTour AI** is an AI-powered tourism website designed to help travelers **discover destinations, understand local culture, explore nearby places, check weather, manage currency, and create personalized travel plans** from one platform.

Instead of making travelers switch between multiple websites and services, SmartTour AI combines **interactive maps, real-world travel data, and AI-powered recommendations** into one intelligent travel companion.

> **Discover. Understand. Plan. Explore.**

---

## ✨ Features

### 🗺️ Interactive Destination Map

Explore destinations through an interactive map and discover nearby:

- 🏛️ Tourist attractions
- 🍴 Restaurants
- ☕ Cafés
- 🏨 Hotels
- 🏦 Banks
- 🏧 ATMs
- 💱 Currency exchange locations
- 🏥 Essential services

The final system will use **Google Maps Platform / Places API** for real-world location data.

---

### 🤖 AI Travel Assistant

Chat with **SmartTour AI** to learn more about your destination.

Ask questions such as:

- What should I visit here?
- Tell me about the local culture.
- What traditions should I know?
- What food should I try?
- What should tourists avoid?
- Where can I find an ATM?
- What can I do if it rains?
- Plan a trip for me.

The AI layer will be powered by **Groq API**.

---

### 🧳 Personalized AI Trip Planner

Provide the AI with:

- 📍 Destination
- 💰 Budget
- ⏱️ Trip duration
- 👥 Number of travelers
- ❤️ Interests

The AI can create a personalized itinerary based on the user's requirements and available real-world information.

Example:

> "I'm visiting Pokhara for 3 days with a budget of $300. I enjoy nature, local food, and culture."

SmartTour AI can turn those requirements into a practical travel plan.

---

### 🌦️ Weather-Aware Recommendations

The website will use a **Weather API** to obtain current weather and forecast information.

The weather information can then be provided to the AI to improve travel recommendations.

For example:

> If rain is expected tomorrow, SmartTour AI can recommend indoor attractions, cafés, museums, and cultural experiences instead of outdoor activities.

Users can also ask the AI to modify their itinerary when weather conditions change.

---

### 💱 Currency Converter

Convert currencies using real exchange-rate information from a **Currency Exchange API**.

Users can:

- Enter an amount
- Select currencies
- Swap currencies
- View the current conversion rate
- See the converted amount

---

### 🏛️ Culture & Traditions

Learn about a destination before visiting it.

SmartTour AI can provide information about:

- Local culture
- Traditions
- History
- Festivals
- Languages
- Local food
- Customs
- Etiquette
- Tourist do's and don'ts

---

### 🌐 Multilingual Support

The website is designed to support multiple languages using a **Translation API**.

This allows travelers to access destination information in a language they understand.

---

## 🧠 How SmartTour AI Works

The core idea is to combine **real-world data with AI reasoning**.

```text
                 🌍 USER
                    │
                    ▼
             React / Next.js
                    │
                    ▼
              Python FastAPI
                    │
       ┌────────────┼─────────────┐
       ▼            ▼             ▼
   🤖 Groq      🗺️ Google      🌦️ Weather
     AI          Places           API
       │
       ├──────────► 💱 Currency API
       │
       ├──────────► 🌐 Translation API
       │
       └──────────►  👛 Wallet
