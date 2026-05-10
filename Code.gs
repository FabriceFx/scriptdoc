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
  
  let lastError;
  for (let i = 0; i < 3; i++) { // 3 attempts
    try {
      const response = UrlFetchApp.fetch(url, options);
      if (response.getResponseCode() === 200) {
        return JSON.parse(response.getContentText());
      }
      lastError = `API Error ${response.getResponseCode()}: ${response.getContentText()}`;
    } catch (e) {
      lastError = e.message;
    }
    if (i < 2) Utilities.sleep(Math.pow(2, i) * 1000); // Exponential backoff
  }
  throw new Error(`Failed to fetch script content after 3 attempts: ${lastError}`);
}

/**
 * Generates documentation and inserts it into the document.
 * @param {object} settings Object containing scriptId, template, geminiKey, and locale.
 */
function startGeneration(settings) {
  const t = getI18n(settings.locale);
  const body = DocumentApp.getActiveDocument().getBody();
  saveSettings(settings);

  const projectName = getProjectName(settings.scriptId, t);
  
  if (settings.overwrite) {
    const startMarker = "[SCRIPTDOC_START]";
    const endMarker = "[SCRIPTDOC_END]";
    findMarkerRange(body, startMarker, endMarker);
  }

  body.appendParagraph("[SCRIPTDOC_START]").setAttributes({[DocumentApp.Attribute.FONT_SIZE]: 1});
  renderHeader(body, projectName, t, settings.scriptId);

  const scriptData = getScriptContent(settings.scriptId);
  const files = scriptData.files.filter(f => f.type === 'server_js' || f.type === 'gs');

  renderStructure(body, scriptData.files, t);
  body.appendParagraph(t.docFunctions).setHeading(DocumentApp.ParagraphHeading.HEADING1);

  return { projectName, files, total: files.length };
}

function processFileJob(file, settings) {
  const t = getI18n(settings.locale);
  const body = DocumentApp.getActiveDocument().getBody();
  processFile(body, file, settings, t);
  return { success: true };
}

function finalizeGeneration(settings) {
  const body = DocumentApp.getActiveDocument().getBody();
  body.appendParagraph("[SCRIPTDOC_END]").setAttributes({[DocumentApp.Attribute.FONT_SIZE]: 1});
  return { success: true };
}

/**
 * Finds the range between two markers
 */
function findMarkerRange(body, start, end) {
  const startElement = body.findText(start);
  const endElement = body.findText(end);
  if (startElement && endElement) {
    const startRange = startElement.getElement().getParent();
    const endRange = endElement.getElement().getParent();
    // This is a simplified removal. In a real doc, we'd need to iterate between elements.
    // For now, let's just remove the paragraphs containing the markers and everything in between if possible.
    // A robust way in GAS is to track indices.
    const startIdx = body.getChildIndex(startRange);
    const endIdx = body.getChildIndex(endRange);
    for (let i = endIdx; i >= startIdx; i--) {
      body.removeChild(body.getChild(i));
    }
  }
  return null;
}

/**
 * Generates a Markdown version of the documentation and saves it to Drive.
 */
function exportToMarkdown(scriptId, locale) {
  const t = getI18n(locale);
  const scriptData = getScriptContent(scriptId);
  const files = scriptData.files || [];
  
  let md = `# ${scriptId}\n\n`;
  md += `> ${t.docGenerated} ${new Date().toLocaleDateString()}\n\n`;
  
  md += `## ${t.docStructure}\n\n\`\`\`\n.\n`;
  files.forEach((file, index) => {
    const isLast = index === files.length - 1;
    const prefix = isLast ? "└── " : "├── ";
    md += `  ${prefix}${file.name}.${file.type === 'html' ? 'html' : 'gs'}\n`;
  });
  md += `\`\`\`\n\n`;

  files.forEach(file => {
    if (file.type === 'server_js' || file.type === 'gs') {
      const functions = parseFunctions(file.source);
      if (functions.length > 0) {
        md += `## ${file.name}\n\n`;
        functions.forEach(func => {
          md += `### \`${func.name}()\`\n\n`;
          if (func.description) md += `${func.description}\n\n`;
          if (func.params.length > 0) {
            md += `**Parameters:**\n`;
            func.params.forEach(p => md += `- \`${p.name}\` (${p.type}): ${p.description}\n`);
            md += `\n`;
          }
          if (func.returns) md += `**Returns:** ${func.returns}\n\n`;
          md += `---\n\n`;
        });
      }
    }
  });

  // Get parent folder using Advanced Service
  const fileMeta = Drive.Files.get(scriptId, {fields: 'parents'});
  const parentId = fileMeta.parents ? fileMeta.parents[0] : 'root';
  
  const file = DriveApp.getFolderById(parentId).createFile(`${scriptId}_doc.md`, md, MimeType.PLAIN_TEXT);
  return file.getUrl();
}

/**
 * Persists settings to UserProperties
 */
function saveSettings(settings) {
  const userProps = PropertiesService.getUserProperties();
  if (settings.geminiKey) userProps.setProperty('GEMINI_API_KEY', settings.geminiKey);
  if (settings.template) userProps.setProperty('LAST_TEMPLATE', settings.template);
}

/**
 * Safely retrieves project name from Drive
 */
function getProjectName(scriptId, t) {
  try {
    // Using Advanced Drive Service (v3) for better compatibility with script files
    const fileMetadata = Drive.Files.get(scriptId);
    return fileMetadata.name;
  } catch (e) {
    console.error("Drive Error:", e.message);
    throw new Error(t.errDrive);
  }
}

/**
 * Renders the document header
 */
function renderHeader(body, projectName, t, scriptId) {
  body.appendParagraph(projectName).setHeading(DocumentApp.ParagraphHeading.TITLE);
  body.appendParagraph(`${t.docGenerated} ${new Date().toLocaleDateString()}`).setItalic(true);
  
  const tocNote = body.appendParagraph(t.tocNote);
  tocNote.setItalic(true).setForegroundColor('#666666');
  
  body.appendParagraph(t.docOverview).setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph(`${t.docProjId}: ${scriptId}`);
}

/**
 * Renders the file structure diagram
 */
function renderStructure(body, files, t) {
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
}

/**
 * Processes a single script file and appends its documentation
 */
function processFile(body, file, settings, t) {
  const functions = parseFunctions(file.source);
  if (functions.length === 0) return;

  body.appendParagraph(file.name).setHeading(DocumentApp.ParagraphHeading.HEADING2);
  
  let aiExplanations = {};
  if (settings.geminiKey) {
    aiExplanations = askGeminiBatch(file.name, functions, file.source, settings.geminiKey, settings.locale.startsWith('fr'));
  }

  functions.forEach(func => {
    renderFunction(body, func, aiExplanations[func.name], settings, t);
  });
}

/**
 * Renders documentation for a single function
 */
function renderFunction(body, func, aiExpl, settings, t) {
  const funcPara = body.appendParagraph(`${func.name}()`);
  funcPara.setHeading(DocumentApp.ParagraphHeading.HEADING3)
          .setFontFamily('Roboto Mono')
          .setForegroundColor('#1a73e8');
  
  let docText = "";
  if (func.description) docText += `${func.description}\n`;
  if (aiExpl) docText += `✨ ${aiExpl}\n`;

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
  // Also captures JSDoc (/** */) or regular multi-line comments (/* */)
  const funcRegex = /(?:\/\*\*?([\s\S]*?)\*\/)?\s*(?:(?:async\s+)?function\s+([\w$]+)|(?:const|let|var)\s+([\w$]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>|([\w$]+)\s*\([^)]*\)\s*\{)/g;
  
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
