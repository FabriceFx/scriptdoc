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
 * @param {string} scriptId The ID of the script project.
 * @param {string} template The selected template name.
 * @param {string} geminiKey The optional Gemini API key.
 */
function generateDocumentation(scriptId, template, geminiKey) {
  const doc = DocumentApp.getActiveDocument();
  const body = doc.getBody();
  const locale = Session.getActiveUserLocale();
  const isFr = locale.startsWith('fr');
  const t = getI18n(locale);
  
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
  
  // 0. Metadata & Manual TOC Instruction
  body.appendParagraph(projectName).setHeading(DocumentApp.ParagraphHeading.HEADING1);
  const tocNote = isFr 
    ? "💡 Conseil : Insérez un sommaire via le menu 'Insertion > Sommaire' pour naviguer facilement."
    : "💡 Tip: Insert a Table of Contents via 'Insert > Table of contents' to navigate easily.";
  body.appendParagraph(tocNote).setItalic(true).setForegroundColor('#666666');
  body.appendPageBreak();
  
  // Section 1: Overview
  if (template !== 'api') {
    body.appendParagraph(t.docOverview).setHeading(DocumentApp.ParagraphHeading.HEADING2);
    body.appendParagraph(`${t.docContains} ${files.length} ${t.docFiles}.`);
  }

  // Section 2: Structure
  if (template !== 'api') {
    body.appendParagraph(t.docStructure).setHeading(DocumentApp.ParagraphHeading.HEADING2);
    let structureStr = `${projectName}\n`;
    files.forEach((f, index) => {
      const isLast = index === files.length - 1;
      const prefix = isLast ? '└── ' : '├── ';
      const ext = f.type === 'SERVER_JS' ? 'gs' : (f.type === 'JSON' ? 'json' : 'html');
      structureStr += `  ${prefix}${f.name}.${ext}\n`;
    });
    const structurePara = body.appendParagraph(structureStr);
    structurePara.setFontFamily('Roboto Mono').setBackgroundColor('#F1F3F4').setIndentStart(20);
  }

  // Section 3: Technical Details
  if (template === 'technical') {
    body.appendParagraph(t.docConfig).setHeading(DocumentApp.ParagraphHeading.HEADING2);
    body.appendParagraph(`${t.docRuntime}: ${manifest.runtimeVersion || 'V8'}`);
    if (manifest.oauthScopes) {
      body.appendParagraph(t.docScopes).setHeading(DocumentApp.ParagraphHeading.HEADING3);
      manifest.oauthScopes.forEach(scope => {
        body.appendParagraph(`• ${scope}`).setGlyphType(DocumentApp.GlyphType.BULLET);
      });
    }
  }

  // Section 4: Functions
  const funcTitle = template === 'api' ? t.docApiRef : (template === 'technical' ? t.docFunctions : t.docFunctions);
  body.appendParagraph(funcTitle).setHeading(DocumentApp.ParagraphHeading.HEADING2);
  
  files.forEach((file) => {
    if (file.type === 'SERVER_JS') {
      let functions = parseFunctions(file.source);
      if (template === 'api') functions = functions.filter(f => !f.name.startsWith('_'));
      
      if (functions.length > 0) {
        body.appendParagraph(file.name).setHeading(DocumentApp.ParagraphHeading.HEADING3);
        functions.forEach(func => {
          body.appendParagraph(`${func.name}()`)
            .setHeading(DocumentApp.ParagraphHeading.HEADING4)
            .setFontFamily('Roboto Mono')
            .setForegroundColor('#1a73e8');
          
          let description = func.description || t.docNoDesc;
          
          // AI Retro-documentation
          if (geminiKey && (!func.description || template === 'technical')) {
            const aiDesc = askGemini(func.name, file.source, geminiKey, locale.startsWith('fr'));
            if (aiDesc) {
              description = aiDesc;
              body.appendParagraph(t.docAiNote).setItalic(true).setFontSize(8).setForegroundColor('#1a73e8');
            }
          }
          
          body.appendParagraph(description).setItalic(false).setForegroundColor('#000000');
        });
      }
    }
  });

  // Save template & key for next time
  PropertiesService.getUserProperties().setProperties({
    'GEMINI_API_KEY': geminiKey || '',
    'LAST_TEMPLATE': template
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
  const models = ['gemini-3-flash', 'gemini-2.0-flash'];
  
  const systemInstruction = isFr 
    ? "Tu es un expert Google Apps Script. Analyse le code fourni et explique la logique métier de la fonction demandée de manière technique et concise (2 phrases max)."
    : "You are a Google Apps Script expert. Analyze the provided code and explain the business logic of the requested function in a technical and concise manner (2 sentences max).";

  const payload = {
    system_instruction: {
      parts: [{ text: systemInstruction }]
    },
    contents: [{
      parts: [{ text: `Explique la fonction : ${functionName}\n\nCode :\n${sourceCode}` }]
    }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 512
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
      const responseCode = response.getResponseCode();
      
      if (responseCode === 200) {
        return parseGeminiResponse(response.getContentText());
      } else if (responseCode !== 404) {
        // Stop if error is not 404 (e.g. 401, 429)
        return `[IA Error ${responseCode}]`;
      }
    } catch (e) {
      console.error(`Gemini ${model} Fetch Error:`, e.message);
    }
  }
  
  return "[IA Error]";
}

/**
 * Simple test for Gemini Key
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
  const json = JSON.parse(responseText);
  if (json.candidates && json.candidates[0].content && json.candidates[0].content.parts[0].text) {
    let text = json.candidates[0].content.parts[0].text.trim();
    text = text.replace(/^(La fonction|Cette fonction|This function) \w+ /i, '');
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
  return null;
}

/**
 * Simple parser to extract function names and JSDoc from source.
 * @param {string} source The GS source code.
 * @return {Array} Array of function objects.
 */
function parseFunctions(source) {
  const functions = [];
  
  // 1. Detect JSDoc blocks + functions (classic & arrow)
  const jsDocRegex = /\/\*\*([\s\S]*?)\*\/[\s\n]*(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:function|\([^)]*\)\s*=>))/g;
  let match;
  
  while ((match = jsDocRegex.exec(source)) !== null) {
    const name = match[2] || match[3];
    if (name) {
      functions.push({
        name: name,
        description: match[1].replace(/\*/g, '').trim()
      });
    }
  }
  
  // 2. Also catch functions without JSDoc (classic & arrow)
  const simpleRegex = /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:function|\([^)]*\)\s*=>))/g;
  while ((match = simpleRegex.exec(source)) !== null) {
    const name = match[1] || match[2];
    if (name && !functions.find(f => f.name === name)) {
      functions.push({
        name: name,
        description: ''
      });
    }
  }
  
  return functions;
}
