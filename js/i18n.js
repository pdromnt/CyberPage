// Minimal i18n shim — English only
var i18n = {
  currentLanguage: 'en',
  translations: {
    greeting_morning: 'Good morning',
    greeting_afternoon: 'Good afternoon',
    greeting_evening: 'Good evening',
    greeting_night: 'Good night',
  },
  t: function (key) {
    return this.translations[key] || key;
  },
  init: function () {
    return Promise.resolve();
  }
};
