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
 * Homepage Trigger for Workspace Add-on (Side Panel).
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
  
  const sidebarOutput = html.evaluate()
    .setTitle('ScriptDoc')
    .setWidth(300);
  
  DocumentApp.getUi().showSidebar(sidebarOutput);
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
 * Retrieves the saved settings.
 */
function getSavedSettings() {
  const props = PropertiesService.getUserProperties().getProperties();
  return {
    key: props['GEMINI_API_KEY'] || '',
    template: props['LAST_TEMPLATE'] || 'standard'
  };
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
 * @param {object} settings Object containing scriptId, template, geminiKey, and locale.
 */
function generateDocumentation(settings) {
  const t = getI18n(settings.locale);
  const doc = DocumentApp.getActiveDocument();
  const body = doc.getBody();
  
  // Persist settings
  const userProps = PropertiesService.getUserProperties();
  if (settings.geminiKey) userProps.setProperty('GEMINI_API_KEY', settings.geminiKey);
  if (settings.template) userProps.setProperty('LAST_TEMPLATE', settings.template);

  let projectName = "Project";
  try {
    const fileMetadata = DriveApp.getFileById(settings.scriptId);
    projectName = fileMetadata.getName();
  } catch (e) {
    console.error("Drive Error:", e.message);
    throw new Error(t.errDrive); 
  }

  // Clear or prepare
  body.appendPageBreak();
  
  // Title Section
  body.appendParagraph(projectName).setHeading(DocumentApp.ParagraphHeading.TITLE);
  body.appendParagraph(`${t.docGenerated} ${new Date().toLocaleDateString()}`).setItalic(true);

  // Table of Contents Note
  const tocNote = body.appendParagraph(t.tocNote);
  tocNote.setItalic(true).setForegroundColor('#666666');

  // Fetch Script Content
  const scriptData = getScriptContent(settings.scriptId);
  const files = scriptData.files || [];

  // Section 1: Overview
  body.appendParagraph(t.docOverview).setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph(`${t.docProjId}: ${settings.scriptId}`);
  
  // Section 2: Structure
  body.appendParagraph(t.docStructure).setHeading(DocumentApp.ParagraphHeading.HEADING1);
  let structureStr = ".\n";
  files.forEach((file, index) => {
    const isLast = index === files.length - 1;
    const prefix = isLast ? "└── " : "├── ";
    const ext = file.type === 'html' ? 'html' : 'gs';
    structureStr += `  ${prefix}${file.name}.${ext}\n`;
  });
  body.appendParagraph(structureStr)
    .setFontFamily('Roboto Mono')
    .setBackgroundColor('#F1F3F4')
    .setIndentStart(20);

  // Section 3: Detailed Logic
  const logicTitle = (settings.template === 'api') ? t.docApiRef : t.docFunctions;
  body.appendParagraph(logicTitle).setHeading(DocumentApp.ParagraphHeading.HEADING1);

  files.forEach(file => {
    if (file.type === 'server_js' || file.type === 'gs') {
      const functions = parseFunctions(file.source);
      
      if (functions.length > 0) {
        body.appendParagraph(file.name).setHeading(DocumentApp.ParagraphHeading.HEADING2);
        
        // BATCH GEMINI CALL per file
        let aiExplanations = {};
        if (settings.geminiKey) {
          aiExplanations = askGeminiBatch(file.name, functions, file.source, settings.geminiKey, settings.locale.startsWith('fr'));
        }

        functions.forEach(func => {
          const funcPara = body.appendParagraph(`${func.name}()`);
          funcPara.setHeading(DocumentApp.ParagraphHeading.HEADING3)
                  .setFontFamily('Roboto Mono')
                  .setForegroundColor('#1a73e8');
          
          // Documentation text
          let docText = "";
          
          // JSDoc Description
          if (func.description) docText += `${func.description}\n`;
          
          // AI Explanation (from batch)
          if (aiExplanations[func.name]) {
            docText += `✨ ${aiExplanations[func.name]}\n`;
          }

          // Params & Returns (API Template)
          if (settings.template === 'api' && (func.params.length > 0 || func.returns)) {
            if (func.params.length > 0) {
              docText += `\nParameters:\n` + func.params.map(p => `• ${p.name}: ${p.description}`).join('\n') + `\n`;
            }
            if (func.returns) {
              docText += `\nReturns: ${func.returns}\n`;
            }
          }

          if (docText) {
            body.appendParagraph(docText.trim());
          } else {
            body.appendParagraph(t.docNoDesc).setItalic(true);
          }
        });
      }
    }
  });

  return { success: true, projectName: projectName };
}

/**
 * Calls Gemini AI to explain all functions in a file at once (Batching).
 * Prevents timeouts and ensures better context.
 */
function askGeminiBatch(fileName, functions, sourceCode, apiKey, isFr) {
  const models = ['gemini-3-flash', 'gemini-2.0-flash'];
  
  const functionList = functions.map(f => f.name).join(', ');
  const systemInstruction = isFr 
    ? "Tu es un expert Google Apps Script. Analyse le code source fourni et explique brièvement la logique métier de chaque fonction listée. Ta réponse doit être un objet JSON pur où chaque clé est le nom de la fonction et chaque valeur est son explication technique (1-2 phrases)."
    : "You are a Google Apps Script expert. Analyze the provided source code and briefly explain the business logic of each listed function. Your response must be a pure JSON object where each key is the function name and each value is its technical explanation (1-2 sentences).";

  const payload = {
    system_instruction: { parts: [{ text: systemInstruction }] },
    contents: [{
      parts: [{ text: `Fichier : ${fileName}\nFonctions à analyser : ${functionList}\n\nCode Source :\n${sourceCode}` }]
    }],
    generationConfig: {
      temperature: 0.1,
      response_mime_type: "application/json"
    }
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    try {
      const response = UrlFetchApp.fetch(url, options);
      if (response.getResponseCode() === 200) {
        const json = JSON.parse(response.getContentText());
        const resultText = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (resultText) return JSON.parse(resultText);
      }
    } catch (e) {
      console.error(`Batch Gemini Error (${model}):`, e.message);
    }
  }
  return {};
}

/**
 * Utility to parse Gemini response JSON
 */
function testGeminiKey(key) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`;
  const payload = { contents: [{ parts: [{ text: 'hi' }] }] };
  const options = { method: 'post', contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true };
  try {
    const response = UrlFetchApp.fetch(url, options);
    return response.getResponseCode() === 200;
  } catch (e) { return false; }
}

function parseGeminiResponse(responseText) {
  try {
    const json = JSON.parse(responseText);
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) {
      let cleaned = text.trim().replace(/^(La fonction|Cette fonction|This function) \w+ /i, '');
      return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }
  } catch (e) {}
  return null;
}

function parseFunctions(source) {
  const functions = [];
  // Regex covers: function name(), const name = () =>, name: function(), name() { in classes
  const funcRegex = /(?:\/\*\*([\s\S]*?)\*\/)?\s*(?:function\s+([\w$]+)|(?:const|let|var)\s+([\w$]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>|([\w$]+)\s*\([^)]*\)\s*\{)/g;
  
  let match;
  while ((match = funcRegex.exec(source)) !== null) {
    const jsDoc = match[1] || "";
    const name = match[2] || match[3] || match[4];
    
    if (name && !['if', 'for', 'while', 'switch', 'catch'].includes(name)) {
      // Parse JSDoc for @param and @return
      const description = jsDoc.replace(/\* @\w+[\s\S]*/g, '').replace(/\*|\n|\s+/g, ' ').trim();
      
      const params = [];
      const paramMatches = jsDoc.matchAll(/@param\s+\{([^}]+)\}\s+([\w$]+)\s*(.*)/g);
      for (const p of paramMatches) {
        params.push({ type: p[1], name: p[2], description: (p[3] || "").trim() });
      }
      
      const returnMatch = jsDoc.match(/@return\s+\{([^}]+)\}\s*(.*)/);
      const returns = returnMatch ? `${returnMatch[1]} - ${(returnMatch[2] || "").trim()}` : null;

      functions.push({
        name: name,
        description: description,
        params: params,
        returns: returns
      });
    }
  }
  return functions;
}
