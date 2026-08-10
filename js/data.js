window.SmartTour = window.SmartTour || {};

window.SmartTour.DESTINATIONS = [
    { id: "pokhara", name: "Pokhara", country: "Nepal", lat: 28.2096, lon: 83.9856 },
    { id: "kathmandu", name: "Kathmandu", country: "Nepal", lat: 27.7172, lon: 85.3240 },
    { id: "chitwan", name: "Chitwan", country: "Nepal", lat: 27.5291, lon: 84.3544 },
    { id: "lumbini", name: "Lumbini", country: "Nepal", lat: 27.4798, lon: 83.2760 },
    { id: "mustang", name: "Mustang", country: "Nepal", lat: 28.7839, lon: 83.7300 },
    { id: "illam", name: "Ilam", country: "Nepal", lat: 26.9100, lon: 87.9260 },
];

window.SmartTour.PLACES = [
    // Pokhara
    { id: "p1", name: "Phewa Lake", category: "Attractions", icon: "🏛️", lat: 28.2096, lon: 83.9896, addr: "Pokhara, Nepal", rating: "4.8" },
    { id: "p2", name: "Mom's Kitchen", category: "Restaurants", icon: "🍴", lat: 28.2060, lon: 83.9820, addr: "Lakeside, Pokhara", rating: "4.6" },
    { id: "p3", name: "Lakeside Café", category: "Cafés", icon: "☕", lat: 28.2075, lon: 83.9800, addr: "Lakeside Road, Pokhara", rating: "4.5" },
    { id: "p4", name: "Hotel Lake View", category: "Hotels", icon: "🏨", lat: 28.2110, lon: 83.9880, addr: "Lakeside, Pokhara", rating: "4.4" },
    { id: "p5", name: "Nabil Bank", category: "Banks", icon: "🏦", lat: 28.2040, lon: 83.9780, addr: "Lakeside, Pokhara" },
    { id: "p6", name: "ATM (Machhapuchhre)", category: "ATMs", icon: "🏧", lat: 28.2055, lon: 83.9850, addr: "Lakeside, Pokhara" },
    { id: "p7", name: "Currency Exchange", category: "Currency Exchange", icon: "💱", lat: 28.2080, lon: 83.9840, addr: "Lakeside, Pokhara" },
    { id: "p8", name: "City Hospital", category: "Hospitals", icon: "🏥", lat: 28.2010, lon: 83.9760, addr: "Pokhara" },
    // Kathmandu
    { id: "k1", name: "Swayambhunath", category: "Attractions", icon: "🏛️", lat: 27.7150, lon: 85.2900, addr: "Kathmandu", rating: "4.7" },
    { id: "k2", name: "Thamel Restaurant", category: "Restaurants", icon: "🍴", lat: 27.7160, lon: 85.3120, addr: "Thamel, Kathmandu", rating: "4.4" },
    { id: "k3", name: "Thamel Café", category: "Cafés", icon: "☕", lat: 27.7155, lon: 85.3130, addr: "Thamel, Kathmandu" },
    { id: "k4", name: "Hotel Everest", category: "Hotels", icon: "🏨", lat: 27.7168, lon: 85.3140, addr: "Thamel, Kathmandu", rating: "4.3" },
// Chitwan
    { id: "c1", name: "Chitwan National Park", category: "Attractions", icon: "🏛️", lat: 27.5291, lon: 84.3544, addr: "Sauraha, Chitwan", rating: "4.8" },
    // Lumbini
    { id: "l1", name: "Maya Devi Temple", category: "Attractions", icon: "🏛️", lat: 27.4696, lon: 83.2756, addr: "Lumbini", rating: "4.7" },
    { id: "l2", name: "World Peace Pagoda", category: "Attractions", icon: "🏛️", lat: 27.4830, lon: 83.2870, addr: "Lumbini", rating: "4.6" },
    // Mustang
    { id: "m1", name: "Jomsom Market", category: "Restaurants", icon: "🍴", lat: 28.7839, lon: 83.7300, addr: "Jomsom, Mustang", rating: "4.4" },
    { id: "m2", name: "Muktinath Temple", category: "Attractions", icon: "🏛️", lat: 28.8170, lon: 83.8713, addr: "Mustang", rating: "4.8" },
    // Ilam
    { id: "i1", name: "Kanyam Tea Garden", category: "Attractions", icon: "🏛️", lat: 26.9100, lon: 87.9260, addr: "Ilam", rating: "4.7" },
    // Pokhara extras
    { id: "p9", name: "Sarangkot Viewpoint", category: "Attractions", icon: "🏛️", lat: 28.2560, lon: 83.9500, addr: "Pokhara", rating: "4.9" },
    { id: "p10", name: "Fewa Lake Cable Car", category: "Transportation", icon: "🚌", lat: 28.2100, lon: 83.9900, addr: "Pokhara" },
    // Kathmandu extras
    { id: "k5", name: "Boudhanath Stupa", category: "Attractions", icon: "🏛️", lat: 27.7215, lon: 85.3620, addr: "Kathmandu", rating: "4.8" },
    { id: "k6", name: "Patan Durbar Square", category: "Attractions", icon: "🏛️", lat: 27.6720, lon: 85.3260, addr: "Lalitpur, Kathmandu", rating: "4.7" },
];

window.SmartTour.CATEGORIES = [
    { category: "Attractions", icon: "🏛️", color: "#8b5cf6" },
    { category: "Restaurants", icon: "🍴", color: "#f59e0b" },
    { category: "Cafés", icon: "☕", color: "#b45309" },
    { category: "Hotels", icon: "🏨", color: "#3b82f6" },
    { category: "Banks", icon: "🏦", color: "#10b981" },
    { category: "ATMs", icon: "🏧", color: "#06b6d4" },
    { category: "Currency Exchange", icon: "💱", color: "#64748b" },
    { category: "Hospitals", icon: "🏥", color: "#ef4444" },
    { category: "Transportation", icon: "🚌", color: "#0ea5e9" },
];

