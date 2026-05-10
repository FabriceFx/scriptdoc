/**
 * ScriptDoc - Documentation Generator for Google Apps Script
 * Server-side Logic
 */

/**
 * Creates the custom menu when the document opens.
 */
function onOpen(e) {
  DocumentApp.getUi()
    .createMenu('ScriptDoc')
    .addItem('Générer Documentation', 'showSidebar')
    .addToUi();
}

/**
 * Hook for Add-on installation.
 */
function onInstall(e) {
  onOpen(e);
}

/**
 * Homepage Trigger for Workspace Add-on.
 */
function onHomepage(e) {
  const card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('ScriptDoc'))
    .addSection(
      CardService.newCardSection()
        .addWidget(CardService.newTextParagraph().setText('Bienvenue dans ScriptDoc ! Utilisez ce bouton pour configurer votre documentation.'))
        .addWidget(
          CardService.newTextButton()
            .setText('Lancer l\'assistant')
            .setOnClickAction(CardService.newAction().setFunctionName('showSidebar'))
        )
    )
    .build();
  return [card];
}

/**
 * Displays the sidebar.
 */
function showSidebar() {
  const locale = Session.getActiveUserLocale();
  const html = HtmlService.createTemplateFromFile('Sidebar');
  html.locale = locale.startsWith('fr') ? 'fr' : 'en';
  
  const interface = html.evaluate()
    .setTitle('ScriptDoc')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  DocumentApp.getUi().showSidebar(interface);
}

/**
 * Gets the OAuth token for the client-side Picker.
 */
function getOAuthToken() {
  return ScriptApp.getOAuthToken();
}

/**
 * Persists the Gemini API Key.
 */
function saveGeminiKey(key) {
  PropertiesService.getUserProperties().setProperty('GEMINI_API_KEY', key);
}

/**
 * Retrieves the saved Gemini API Key.
 */
function getSavedGeminiKey() {
  return PropertiesService.getUserProperties().getProperty('GEMINI_API_KEY') || '';
}

function getScriptContent(scriptId) {
  const url = `https://script.googleapis.com/v1/projects/${scriptId}/content`;
  const options = {
    headers: { 'Authorization': 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true
  };
  
  const response = UrlFetchApp.fetch(url, options);
  if (response.getResponseCode() !== 200) {
    throw new Error(`API Error ${response.getResponseCode()}: ${response.getContentText()}`);
  }
  return JSON.parse(response.getContentText());
}

/**
 * Generates documentation and inserts it into the document.
 * @param {string} scriptId The ID of the script project.
 * @param {string} template The selected template name.
 * @param {string} geminiKey The optional Gemini API key.
 */
function generateDocumentation(scriptId, template, geminiKey) {
  const doc = DocumentApp.getActiveDocument();
  const body = doc.getBody();
  const locale = Session.getActiveUserLocale();
  const isFr = locale.startsWith('fr');
  
  // Translations
  const t = {
    overview: isFr ? '1. Aperçu du projet' : '1. Project Overview',
    structure: isFr ? '2. Diagramme de structure' : '2. Project Structure Diagram',
    config: isFr ? '3. Configuration & Paramètres' : '3. Configuration & Settings',
    functions: isFr ? (template === 'api' ? '1. Référence API' : (template === 'technical' ? '4. Fonctions & Méthodes' : '3. Fonctions & Méthodes')) : 'Functions & Methods',
    contains: isFr ? 'Ce projet Google Apps Script contient' : 'This Google Apps Script project contains',
    files: isFr ? 'fichiers' : 'files',
    noDesc: isFr ? 'Aucune description disponible.' : 'No description available.',
    scopes: isFr ? 'Autorisations requises' : 'Required Scopes',
    runtime: isFr ? 'Environnement d\'exécution' : 'Runtime Environment',
    aiGenerated: isFr ? '[Description générée par IA]' : '[AI Generated Description]'
  };

  // 1. Fetch content
  const content = getScriptContent(scriptId);
  const files = content.files;
  const manifest = JSON.parse(files.find(f => f.name === 'appsscript').source);
  
  // 2. Metadata retrieval
  let projectName = "Project";
  try {
    const fileMetadata = DriveApp.getFileById(scriptId);
    projectName = fileMetadata.getName();
  } catch (e) {}
  
  body.appendParagraph(projectName).setHeading(DocumentApp.ParagraphHeading.HEADING1);
  
  // Section 1: Overview
  if (template !== 'api') {
    body.appendParagraph(t.overview).setHeading(DocumentApp.ParagraphHeading.HEADING2);
    body.appendParagraph(`${t.contains} ${files.length} ${t.files}.`);
  }

  // Section 2: Structure
  if (template !== 'api') {
    body.appendParagraph(t.structure).setHeading(DocumentApp.ParagraphHeading.HEADING2);
    let structureStr = `${projectName}\n`;
    files.forEach((f, index) => {
      const isLast = index === files.length - 1;
      const prefix = isLast ? '└── ' : '├── ';
      const ext = f.type === 'SERVER_JS' ? 'gs' : (f.type === 'JSON' ? 'json' : 'html');
      structureStr += `  ${prefix}${f.name}.${ext}\n`;
    });
    body.appendParagraph(structureStr).setFontFamily('Courier New');
  }

  // Section 3: Technical Details
  if (template === 'technical') {
    body.appendParagraph(t.config).setHeading(DocumentApp.ParagraphHeading.HEADING2);
    body.appendParagraph(`${t.runtime}: ${manifest.runtimeVersion || 'V8'}`);
    if (manifest.oauthScopes) {
      body.appendParagraph(t.scopes).setHeading(DocumentApp.ParagraphHeading.HEADING3);
      manifest.oauthScopes.forEach(scope => {
        body.appendParagraph(`• ${scope}`).setGlyphType(DocumentApp.GlyphType.BULLET);
      });
    }
  }

  // Section 4: Functions
  body.appendParagraph(t.functions).setHeading(DocumentApp.ParagraphHeading.HEADING2);
  
  files.forEach((file) => {
    if (file.type === 'SERVER_JS') {
      let functions = parseFunctions(file.source);
      if (template === 'api') functions = functions.filter(f => !f.name.startsWith('_'));
      
      if (functions.length > 0) {
        body.appendParagraph(file.name).setHeading(DocumentApp.ParagraphHeading.HEADING3);
        functions.forEach(func => {
          body.appendParagraph(`${func.name}()`).setHeading(DocumentApp.ParagraphHeading.HEADING4);
          
          let description = func.description || t.noDesc;
          
          // AI Retro-documentation
          console.log(`Checking AI for ${func.name}. Key provided: ${!!geminiKey}, Description present: ${!!func.description}`);
          if (geminiKey && (!func.description || template === 'technical')) {
            console.log(`Calling Gemini for ${func.name}...`);
            const aiDesc = askGemini(func.name, file.source, geminiKey, isFr);
            if (aiDesc) {
              console.log(`Gemini returned success for ${func.name}`);
              description = aiDesc;
              const aiNote = isFr ? '✨ [Analyse par Gemini AI]' : '✨ [Gemini AI Analysis]';
              body.appendParagraph(aiNote).setItalic(true).setFontSize(8).setForegroundColor('#1a73e8');
            } else {
              console.warn(`Gemini returned null for ${func.name}`);
            }
          }
          
          body.appendParagraph(description).setItalic(false).setForegroundColor('#000000');
        });
      }
    }
  });

  return {
    success: true,
    projectName: projectName,
    template: template
  };
}

/**
 * Calls Gemini AI to explain a function.
 */
function askGemini(functionName, sourceCode, apiKey, isFr) {
  // We try Gemini 1.5 Flash first as it is the most stable and available in 2024-2026.
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  
  const prompt = isFr 
    ? `Tu es un expert Google Apps Script. Analyse le code source suivant et explique précisément le rôle et la logique métier de la fonction "${functionName}". 
       Réponds en 2-3 phrases maximum, de manière technique et concise. Ne réponds qu'avec l'explication.\n\nCode source :\n${sourceCode}`
    : `You are a Google Apps Script expert. Analyze the following source code and explain precisely the role and business logic of the function "${functionName}". 
       Reply in 2-3 sentences maximum, in a technical and concise manner. Reply only with the explanation.\n\nSource code:\n${sourceCode}`;

  const payload = {
    contents: [{
      parts: [{ text: prompt }]
    }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 250
    }
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const responseText = response.getContentText();
    const responseCode = response.getResponseCode();
    
    if (responseCode !== 200) {
      console.error('Gemini API Error:', responseText);
      return `[Erreur Gemini ${responseCode}]`;
    }
    
    const json = JSON.parse(responseText);
    if (json.candidates && json.candidates[0].content && json.candidates[0].content.parts[0].text) {
      let text = json.candidates[0].content.parts[0].text.trim();
      text = text.replace(/^(La fonction|Cette fonction|This function) \w+ /i, '');
      return text.charAt(0).toUpperCase() + text.slice(1);
    } else {
      console.warn('Gemini format error:', responseText);
      return null;
    }
  } catch (e) {
    console.error('Gemini Fetch Error:', e.message);
    return null;
  }
}

/**
 * Simple parser to extract function names and JSDoc from source.
 * @param {string} source The GS source code.
 * @return {Array} Array of function objects.
 */
function parseFunctions(source) {
  const functions = [];
  const regex = /\/\*\*([\s\S]*?)\*\/[\s\n]*function\s+(\w+)\s*\(/g;
  let match;
  
  while ((match = regex.exec(source)) !== null) {
    functions.push({
      name: match[2],
      description: match[1].replace(/\*/g, '').trim()
    });
  }
  
  // Also catch functions without JSDoc
  const simpleRegex = /function\s+(\w+)\s*\(/g;
  while ((match = simpleRegex.exec(source)) !== null) {
    if (!functions.find(f => f.name === match[1])) {
      functions.push({
        name: match[1],
        description: ''
      });
    }
  }
  
  return functions;
}
