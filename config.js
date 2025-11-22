// Configuration de l'application - Gard Eau Arbres
// Modifiez ces valeurs selon vos besoins

const CONFIG = {
  // Backend
  BACKEND_ENABLED: false,
  BACKEND_URL: '/backend',
  
  // Performance
  DEBOUNCE_DELAY: 300, // ms pour la recherche
  IMAGE_LAZY_LOAD_MARGIN: '50px', // marge pour IntersectionObserver
  
  // Cache
  CACHE_VERSION: '1.0.0',
  CACHE_DURATION: 60 * 60 * 1000, // 1 heure en ms
  
  // Analytics (optionnel)
  ANALYTICS_ENABLED: false,
  ANALYTICS_ID: '', // Google Analytics ID ou autre
  
  // Features
  FEATURES: {
    AR_ENABLED: false,
    AUDIO_ENABLED: true,
    TOUR_ENABLED: true,
    QUEST_ENABLED: true,
    ISO3D_ENABLED: true,
    PRINT_ENABLED: true
  },
  
  // URLs
  NURSERY_URL: '#', // Lien vers la boutique/pépinière
  DONATE_URL: '#', // Lien vers les dons
  VOLUNTEER_URL: '#', // Lien vers le bénévolat
  WORKSHOP_URL: '#' // Lien vers les ateliers
  
};

// Export pour utilisation dans app.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}

