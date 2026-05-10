# ScriptDoc 🚀

**ScriptDoc** is a professional-grade Google Apps Script (GAS) add-on designed to automatically generate comprehensive, structured, and AI-enhanced documentation for your script projects directly within Google Docs.

![Language](https://img.shields.io/badge/Language-Bilingual_FR/EN-blue)
![AI](https://img.shields.io/badge/AI-Gemini_3_Flash-orange)
![UI](https://img.shields.io/badge/UI-Material_Design_3-green)

---

## ✨ Key Features

- **Automated Analysis**: Scans your entire GAS project including manifest, files, and JSDoc.
- **AI Retro-Documentation**: Integrates with **Gemini 3** to automatically explain what each function does, even if it lacks comments.
- **Visual Structure**: Generates a clear, tree-like diagram of your project architecture.
- **Bilingual Interface**: Automatically adapts to your Google account language (French or English).
- **Premium UI**: Sleek, modern sidebar built with Material Design 3 principles.
- **Template Selection**: Choose between *Standard*, *Technical Deep-dive*, or *API Reference* formats.

---

## 🛠️ Tech Stack

- **Backend**: Google Apps Script (V8 Runtime).
- **Frontend**: HTML5, CSS3 (Vanilla), JavaScript (ES6).
- **APIs**: 
  - Google Apps Script API (Content retrieval).
  - Google Drive API (Metadata).
  - Google Picker API (Project selection).
  - Gemini AI v1beta API (Retro-documentation).

---

## 🚀 Installation & Setup

### 1. Deploy the Script
1. Create a new Google Doc.
2. Go to **Extensions > Apps Script**.
3. Use [clasp](https://github.com/google/clasp) or copy the files from this repository into your project.

### 2. Enable APIs
1. **Google Apps Script API**: Must be turned **ON** in your [Apps Script Settings](https://script.google.com/home/usersettings).
2. **Google Cloud Project**: Link your script to a **Standard Google Cloud Project** in the Project Settings.
3. **Enable APIs in GCP**: In your Cloud Console, enable the **Google Apps Script API** and **Google Picker API**.

### 3. Usage
1. Refresh your Google Doc.
2. Open the **ScriptDoc** menu.
3. Select your project via the **Picker**.
4. (Optional) Provide your **Gemini API Key** for AI enhancement.
5. Click **Generate Documentation**.

---

## 📖 Templates

- **Standard**: The perfect balance for quick overviews.
- **Technical**: Includes manifest details, required scopes, and runtime environments.
- **API Reference**: Strips away private functions and focuses on your public API surface.

---

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

*Developed with ❤️ by [Fabrice Faucheux](https://github.com/FabriceFx)*
