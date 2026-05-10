# ScriptDoc 📜✨

**Générateur de documentation automatique pour Google Apps Script.**

ScriptDoc est un add-on Google Docs qui permet de générer instantanément une documentation technique complète pour vos projets Google Apps Script à partir de leur identifiant. Il utilise l'IA Gemini pour analyser votre code et fournir des explications claires sur la logique métier.

## 🚀 Fonctionnalités

- **Extraction automatique** : Récupère tous les fichiers d'un projet script via l'API Google.
- **Analyse intelligente** : Utilise Gemini AI (3 Flash / 2.0) pour expliquer chaque fonction.
- **Support JSDoc** : Extrait les descriptions, paramètres (`@param`) et retours (`@return`).
- **Templates personnalisables** : Documentation Standard, Analyse Technique ou Référence API.
- **Interface Premium** : Design Material 3 bilingue (FR/EN) intégré à Google Docs.
- **Diagramme de structure** : Génère une vue arborescente de votre projet.

## ⚙️ Installation & Configuration

1. Ouvrez un Google Docs.
2. Allez dans `Extensions > ScriptDoc > Générer Documentation`.
3. Saisissez l'ID de votre projet Script (trouvable dans les paramètres du projet GAS).
4. (Optionnel) Ajoutez votre **Clé API Gemini** (obtenue sur [Google AI Studio](https://aistudio.google.com/)).

## 🔒 Sécurité et Confidentialité

*   **Clé API Gemini** : La clé API est stockée de manière sécurisée dans les `UserProperties` de votre compte Google. Elle n'est accessible que par vous.
*   **Données** : Seul le code source du projet sélectionné est envoyé à l'API Gemini pour analyse. Aucune donnée n'est stockée sur des serveurs tiers en dehors de l'infrastructure Google.
*   **Scopes restreints** : L'add-on respecte le principe du moindre privilège pour garantir la sécurité de votre Drive.

## ✨ "Diamond Version" - Excellence Technique

Cette version finale intègre des optimisations avancées :
- **Batching** : Les appels IA sont regroupés par fichier pour éviter les timeouts (limite de 6 min de GAS).
- **Retry Logic** : Gestion des erreurs réseau avec retentatives automatiques.
- **Advanced Parser** : Support des syntaxes JS modernes (Classes, Async, Arrow functions).
- **MD3 UI** : Système de notifications (Toasts) non-intrusif.

---
<> par Fabrice Faucheux
