const i18n = {
    currentLanguage: 'en',
    translations: {},
    isInitialized: false,
    initPromise: null,

    async init() {
        if (this.isInitialized) return Promise.resolve();
        if (this.initPromise) return this.initPromise;

        this.initPromise = new Promise((resolve) => {
            chrome.storage.sync.get({ language: null }, async (items) => {
                let lang = items.language;

                if (!lang) {
                    // Detect browser language
                    const browserLang = navigator.language.split('-')[0];
                    const supported = await this.getSupportedLanguages();
                    lang = supported.find(l => l.code === browserLang) ? browserLang : 'en';
                }

                await this.loadLanguage(lang);
                this.isInitialized = true;
                this.initPromise = null;
                resolve();
            });
        });
        return this.initPromise;
    },

    async getSupportedLanguages() {
        const response = await fetch('i18n/languages.json');
        return await response.json();
    },

    async loadLanguage(lang) {
        try {
            const response = await fetch(`i18n/${lang}.json`);
            this.translations = await response.json();
            this.currentLanguage = lang;
            this.applyTranslations();
        } catch (e) {
            console.error(`Failed to load language: ${lang}`, e);
            if (lang !== 'en') await this.loadLanguage('en');
        }
    },

    applyTranslations() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const translation = this.t(key);
            if (translation) {
                if (el.tagName === 'INPUT' && (el.type === 'text' || el.type === 'search')) {
                    el.placeholder = translation;
                } else if (el.hasAttribute('title')) {
                    el.setAttribute('title', translation);
                } else {
                    el.textContent = translation;
                }
            }
        });

        // Handle Title specifically (only if not handled by data-i18n)
        const titleEl = document.querySelector('title');
        if (this.translations.app_title && titleEl && !titleEl.hasAttribute('data-i18n')) {
            // Only update if it doesn't look like a greeting (main.js handles that)
            if (!document.title.includes('Good')) {
                document.title = this.translations.app_title;
            }
        }
    },

    t(key) {
        return this.translations[key] || key;
    }
};
