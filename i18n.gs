/**
 * ScriptDoc - Internationalization (i18n)
 * Single source of truth for all translations.
 */

const I18N = {
  fr: {
    // UI - Sidebar
    title: "Nouvelle Documentation",
    subtitle: "Configuration & Sélection",
    step1: "1. Choisir un modèle",
    labelTemplate: "Modèle",
    optStandard: "Documentation Standard",
    optTechnical: "Analyse Technique",
    optApi: "Référence API",
    infoTemplate: "Couverture équilibrée de tous les aspects",
    step2: "2. Sélectionner un projet",
    btnPick: "Choisir un script sur Drive",
    noFile: "Aucun fichier sélectionné",
    stepAI: "3. Amélioration IA (Optionnel)",
    labelGemini: "Clé API Gemini",
    infoGemini: "Utilise Gemini 3 pour expliquer vos fonctions.",
    btnCancel: "Annuler",
    btnGenerate: "Générer la Documentation",
    loading: "Analyse du projet en cours...",

    // UI - Results
    resTitle: "Documentation Générée !",
    resSubtitle: "Votre documentation a été insérée dans le document.",
    resProject: "Projet :",
    resTemplate: "Modèle :",
    btnClose: "Fermer",

    // Document Content
    docOverview: "1. Aperçu du projet",
    docStructure: "2. Diagramme de structure",
    docConfig: "3. Configuration & Paramètres",
    docFunctions: "4. Fonctions & Méthodes",
    docApiRef: "1. Référence API",
    docContains: "Ce projet Google Apps Script contient",
    docFiles: "fichiers",
    docNoDesc: "Aucune description disponible.",
    docScopes: "Autorisations requises",
    docRuntime: "Environnement d'exécution",
    docAiNote: "✨ [Analyse par Gemini AI]",
    docGenerated: "Généré le",
    docProjId: "Identifiant du projet",
    tocNote: "💡 Conseil : Insérez un sommaire via le menu 'Insertion > Sommaire' pour naviguer facilement.",
    errDrive: "Impossible d'accéder au fichier Drive. Vérifiez les permissions."
  },
  en: {
    // UI - Sidebar
    title: "New Documentation",
    subtitle: "Configure & Select",
    step1: "1. Choose a template",
    labelTemplate: "Template",
    optStandard: "Standard Documentation",
    optTechnical: "Technical Deep-dive",
    optApi: "API Reference",
    infoTemplate: "Balanced coverage of all aspects",
    step2: "2. Select a script project",
    btnPick: "Pick Script from Drive",
    noFile: "No file selected",
    stepAI: "3. AI Enhancement (Optional)",
    labelGemini: "Gemini API Key",
    infoGemini: "Uses Gemini 3 to explain your functions.",
    btnCancel: "Cancel",
    btnGenerate: "Generate Documentation",
    loading: "Analyzing project...",

    // UI - Results
    resTitle: "Documentation Generated!",
    resSubtitle: "Your documentation has been created and inserted into the document.",
    resProject: "Project:",
    resTemplate: "Template:",
    btnClose: "Close",

    // Document Content
    docOverview: "1. Project Overview",
    docStructure: "2. Project Structure Diagram",
    docConfig: "3. Configuration & Settings",
    docFunctions: "4. Functions & Methods",
    docApiRef: "1. API Reference",
    docContains: "This Google Apps Script project contains",
    docFiles: "files",
    docNoDesc: "No description available.",
    docScopes: "Required Scopes",
    docRuntime: "Runtime Environment",
    docAiNote: "✨ [Gemini AI Analysis]",
    docGenerated: "Generated on",
    docProjId: "Project ID",
    tocNote: "💡 Tip: Insert a Table of Contents via 'Insert > Table of contents' to navigate easily.",
    errDrive: "Unable to access Drive file. Check permissions."
  }
};

/**
 * Returns the translations for a given locale.
 */
function getI18n(locale) {
  const lang = (locale && locale.startsWith('fr')) ? 'fr' : 'en';
  return I18N[lang];
}
