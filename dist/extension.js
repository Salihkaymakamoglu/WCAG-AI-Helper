"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode2 = __toESM(require("vscode"));

// src/rules.ts
var RULES = [
  {
    id: "R1_IMG_ALT",
    description: "Images must have non-empty, meaningful alt text.",
    wcagRef: "WCAG 2.2 - 1.1.1 Non-text Content"
  },
  {
    id: "R2_LABEL",
    description: "Form controls must have an accessible name (label or aria-label).",
    wcagRef: "WCAG 2.2 - 3.3.2, 4.1.2"
  },
  {
    id: "R3_BUTTON",
    description: "Buttons must have visible text or an accessible name.",
    wcagRef: "WCAG 2.2 - 4.1.2 Name, Role, Value"
  },
  {
    id: "R4_LINK",
    description: "Links should have descriptive text, not just \u201Cclick here\u201D or similar.",
    wcagRef: "WCAG 2.2 - 2.4.4 Link Purpose"
  },
  {
    id: "R5_H1",
    description: "Each document should contain exactly one <h1> element.",
    wcagRef: "WCAG 2.2 - 1.3.1 Info and Relationships"
  },
  {
    id: "R6_TABINDEX",
    description: "Avoid positive tabindex values; rely on natural focus order.",
    wcagRef: "WCAG 2.2 - 2.4.3 Focus Order"
  },
  {
    id: "R7_ROLE_BUTTON",
    description: 'Elements with role="button" must be keyboard operable.',
    wcagRef: "WCAG 2.2 - 2.1.1 Keyboard"
  }
];

// src/analyzer.ts
function analyzeDocument(doc) {
  const text = doc.getText();
  const lines = text.split(/\r?\n/);
  const issues = [];
  function hasNearbyLabel(lines2, index) {
    for (let i = index - 1; i >= 0 && index - i <= 2; i--) {
      const line = lines2[i].trim();
      if (line.length === 0) continue;
      if (/<label\b/i.test(line)) return true;
      break;
    }
    return false;
  }
  const imgRule = RULES.find((r) => r.id === "R1_IMG_ALT") ?? {
    id: "R1_IMG_ALT",
    description: "Images must have non-empty, meaningful alt text.",
    wcagRef: "WCAG 2.2 - 1.1.1 Non-text Content"
  };
  const imgTagRegex = /<img\b[^>]*>/g;
  const altAttrRegex = /\balt\s*=\s*(['"])(.*?)\1/;
  lines.forEach((lineText, lineIndex) => {
    let match2;
    while ((match2 = imgTagRegex.exec(lineText)) !== null) {
      const imgTag = match2[0];
      const hasAlt = altAttrRegex.test(imgTag);
      const altValueMatch = imgTag.match(altAttrRegex);
      const altValue = altValueMatch?.[2]?.trim();
      const isAriaHidden = /\baria-hidden\s*=\s*["']true["']/i.test(imgTag);
      const isPresentationalRole = /\brole\s*=\s*["']presentation["']/i.test(
        imgTag
      );
      const isDecorative = isAriaHidden || isPresentationalRole;
      if (!hasAlt && !isDecorative) {
        issues.push({
          ruleId: imgRule.id,
          message: imgRule.description,
          wcagRef: imgRule.wcagRef,
          line: lineIndex,
          column: match2.index
        });
      } else if (hasAlt && !altValue && !isDecorative) {
        issues.push({
          ruleId: imgRule.id,
          message: imgRule.description,
          wcagRef: imgRule.wcagRef,
          line: lineIndex,
          column: match2.index
        });
      }
    }
  });
  const labelRule = RULES.find((r) => r.id === "R2_LABEL") ?? {
    id: "R2_LABEL",
    description: "Form controls must have an accessible name (via <label>, aria-label, aria-labelledby, placeholder, or title).",
    wcagRef: "WCAG 2.2 - 3.3.2, 4.1.2"
  };
  const labelForIds = /* @__PURE__ */ new Set();
  const formControls = [];
  lines.forEach((lineText, lineIndex) => {
    const labelRegex = /<label\b[^>]*for\s*=\s*["']([^"']+)["'][^>]*>/gi;
    let labelMatch;
    while ((labelMatch = labelRegex.exec(lineText)) !== null) {
      const forId = labelMatch[1].trim();
      if (forId) {
        labelForIds.add(forId);
      }
    }
    const controlRegex = /<(input|textarea|select)\b([^>]*)>/gi;
    let controlMatch;
    while ((controlMatch = controlRegex.exec(lineText)) !== null) {
      const tagName = controlMatch[1].toLowerCase();
      const attrs = controlMatch[2] ?? "";
      const idMatch = /id\s*=\s*["']([^"']+)["']/i.exec(attrs);
      const id = idMatch ? idMatch[1].trim() : null;
      formControls.push({
        line: lineIndex,
        column: controlMatch.index,
        tagName,
        attrs,
        id
      });
    }
  });
  formControls.forEach((ctrl) => {
    const attrs = ctrl.attrs;
    const isHiddenInput = ctrl.tagName === "input" && /\btype\s*=\s*["']hidden["']/i.test(attrs);
    if (isHiddenInput) {
      return;
    }
    const hasAriaLabel = /\baria-label\s*=\s*["'][^"']+["']/i.test(attrs);
    const hasAriaLabelledBy = /\baria-labelledby\s*=\s*["'][^"']+["']/i.test(
      attrs
    );
    const hasAssociatedLabel = ctrl.id !== null && labelForIds.has(ctrl.id) || hasNearbyLabel(lines, ctrl.line);
    const hasAccessibleName = hasAriaLabel || hasAriaLabelledBy || hasAssociatedLabel;
    if (!hasAccessibleName) {
      issues.push({
        ruleId: labelRule.id,
        message: labelRule.description,
        wcagRef: labelRule.wcagRef,
        line: ctrl.line,
        column: ctrl.column
      });
    }
  });
  const buttonRule = RULES.find((r) => r.id === "R3_BUTTON") ?? {
    id: "R3_BUTTON",
    description: "Buttons must have visible text or an accessible name.",
    wcagRef: "WCAG 2.2 - 4.1.2 Name, Role, Value"
  };
  const buttonTagRegex = /<button\b([^>]*)>(.*?)<\/button>/gi;
  lines.forEach((lineText, lineIndex) => {
    let match2;
    while ((match2 = buttonTagRegex.exec(lineText)) !== null) {
      const attrs = match2[1] ?? "";
      const innerContent = match2[2]?.trim() ?? "";
      const hasTextContent = innerContent.length > 0;
      const hasAriaLabel = /\baria-label\s*=\s*["'][^"']+["']/i.test(attrs);
      const hasAriaLabelledBy = /\baria-labelledby\s*=\s*["'][^"']+["']/i.test(
        attrs
      );
      const hasTitle = /\btitle\s*=\s*["'][^"']+["']/i.test(attrs);
      const hasAccessibleName = hasTextContent || hasAriaLabel || hasAriaLabelledBy || hasTitle;
      if (!hasAccessibleName) {
        issues.push({
          ruleId: buttonRule.id,
          message: buttonRule.description,
          wcagRef: buttonRule.wcagRef,
          line: lineIndex,
          column: match2.index
        });
      }
    }
  });
  const linkRule = RULES.find((r) => r.id === "R4_LINK") ?? {
    id: "R4_LINK",
    description: 'Links should have descriptive text, not just "click here" or similar.',
    wcagRef: "WCAG 2.2 - 2.4.4 Link Purpose (In Context)"
  };
  const linkTagRegex = /<a\b[^>]*>(.*?)<\/a>/gi;
  const badTexts = [
    "click here",
    "click",
    "here",
    "more",
    "read more",
    "learn more",
    "more info"
  ];
  lines.forEach((lineText, lineIndex) => {
    let match2;
    while ((match2 = linkTagRegex.exec(lineText)) !== null) {
      const innerHtml = match2[1] ?? "";
      const innerText = innerHtml.replace(/<[^>]+>/g, "").trim();
      const lower = innerText.toLowerCase();
      const isEmpty = innerText.length === 0;
      const isGeneric = badTexts.includes(lower);
      const isUrl = /^https?:\/\//i.test(innerText);
      const isTooShort = innerText.length > 0 && innerText.length <= 2;
      if (isEmpty || isGeneric || isUrl || isTooShort) {
        issues.push({
          ruleId: linkRule.id,
          message: linkRule.description,
          wcagRef: linkRule.wcagRef,
          line: lineIndex,
          column: match2.index
        });
      }
    }
  });
  const h1Rule = RULES.find((r) => r.id === "R5_H1") ?? {
    id: "R5_H1",
    description: "Each document should contain exactly one <h1> element.",
    wcagRef: "WCAG 2.2 - 1.3.1 Info and Relationships"
  };
  let h1Count = 0;
  const h1Locations = [];
  const h1TagRegex = /<h1\b[^>]*>/g;
  lines.forEach((lineText, lineIndex) => {
    let match2;
    while ((match2 = h1TagRegex.exec(lineText)) !== null) {
      h1Count++;
      h1Locations.push({ line: lineIndex, column: match2.index });
    }
  });
  if (h1Count === 0) {
    issues.push({
      ruleId: h1Rule.id,
      message: `${h1Rule.description} (Found none.)`,
      wcagRef: h1Rule.wcagRef,
      line: 0,
      column: 0
    });
  } else if (h1Count > 1) {
    h1Locations.slice(1).forEach((loc) => {
      issues.push({
        ruleId: h1Rule.id,
        message: `${h1Rule.description} (Found ${h1Count} <h1> elements.)`,
        wcagRef: h1Rule.wcagRef,
        line: loc.line,
        column: loc.column
      });
    });
  }
  const tabindexRule = RULES.find((r) => r.id === "R6_TABINDEX") ?? {
    id: "R6_TABINDEX",
    description: "Avoid positive tabindex values; rely on natural focus order.",
    wcagRef: "WCAG 2.2 - 2.4.3 Focus Order"
  };
  const tabindexRegex = /\btabindex\s*=\s*["'](\d+)["']/gi;
  lines.forEach((lineText, lineIndex) => {
    let match2;
    while ((match2 = tabindexRegex.exec(lineText)) !== null) {
      const value = parseInt(match2[1], 10);
      if (value > 0) {
        issues.push({
          ruleId: tabindexRule.id,
          message: tabindexRule.description,
          wcagRef: tabindexRule.wcagRef,
          line: lineIndex,
          column: match2.index
        });
      }
    }
  });
  const roleButtonRule = RULES.find((r) => r.id === "R7_ROLE_BUTTON") ?? {
    id: "R7_ROLE_BUTTON",
    description: 'Elements with role="button" must be keyboard operable.',
    wcagRef: "WCAG 2.2 - 2.1.1 Keyboard; 4.1.2"
  };
  const roleButtonRegex = /<([a-zA-Z0-9]+)\b[^>]*role\s*=\s*["']button["'][^>]*>/gis;
  let match;
  while ((match = roleButtonRegex.exec(text)) !== null) {
    const tagName = match[1].toLowerCase();
    const tag = match[0];
    if (tagName === "button") continue;
    const hasTabindex = /\btabindex\s*=\s*["']0["']/i.test(tag);
    const hasKeyboardHandler = /\bonkey(down|up|press)\s*=/i.test(tag);
    const hasOnClick = /\bonclick\s*=/i.test(tag);
    if (hasOnClick && (!hasTabindex || !hasKeyboardHandler)) {
      const before = text.slice(0, match.index);
      const line = before.split(/\r?\n/).length - 1;
      const column = before.lastIndexOf("\n") === -1 ? match.index : match.index - before.lastIndexOf("\n") - 1;
      issues.push({
        ruleId: roleButtonRule.id,
        message: roleButtonRule.description,
        wcagRef: roleButtonRule.wcagRef,
        line,
        column
      });
    }
  }
  return issues;
}

// src/aiClient.ts
var vscode = __toESM(require("vscode"));
async function getAiSuggestion(params) {
  const config = vscode.workspace.getConfiguration();
  const apiKey = config.get("wcag-ai-helper.apiKey");
  if (!apiKey) {
    throw new Error(
      "No API key configured. Set 'wcag-ai-helper.apiKey' in VS Code settings."
    );
  }
  const prompt = buildPrompt(params);
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: "You are an assistant that edits source code to fix accessibility issues according to WCAG 2.2.\n\nYou are always given:\n- The language of the code snippet.\n- A rule ID, rule description, and WCAG reference.\n- A small code snippet that violates that rule.\n\nYour job:\n- Apply a minimal targeted fix to resolve the WCAG issue.\n- Preserve the original structure and framework (HTML stays HTML, JSX stays JSX).\n- Do not introduce unrelated changes.\n- Do not add comments, explanations, or Markdown.\n- Return ONLY the corrected code snippet."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.1
    })
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `AI API request failed: ${response.status} ${response.statusText} - ${text}`
    );
  }
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? "";
  const fixedCode = content.trim();
  if (!fixedCode) {
    throw new Error("AI did not return any code.");
  }
  return fixedCode;
}
function buildPrompt(params) {
  return `Language: ${params.languageId}

Rule:
- ID: ${params.ruleId}
- Description: ${params.ruleDescription}
- WCAG reference: ${params.wcagRef}

Task:
- Identify how this snippet violates the rule above.
- Fix ONLY that violation with the smallest possible change.
- Do not modify unaffected parts of the snippet.
- Do not introduce <script> tags or javascript: URLs.
- Do not add comments or explanations.
- Return ONLY the updated snippet, as plain code.

Original snippet:
${params.codeSnippet}`;
}

// src/extension.ts
var diagnosticCollection;
function isSafeReplacement(originalSnippet, suggestedSnippet) {
  const original = originalSnippet.trim();
  const suggested = suggestedSnippet.trim();
  if (!suggested) {
    return { safe: false, reason: "AI returned an empty suggestion." };
  }
  if (original.length > 0) {
    const ratio = suggested.length / original.length;
    if (ratio < 0.25 || ratio > 4) {
      return {
        safe: false,
        reason: "The AI suggestion is dramatically shorter or longer than the original snippet."
      };
    }
  }
  const looksHtmlOriginal = /<\w+/.test(original);
  const looksHtmlSuggested = /<\w+/.test(suggested);
  if (looksHtmlOriginal && !looksHtmlSuggested) {
    return {
      safe: false,
      reason: "The AI suggestion no longer looks like valid HTML markup."
    };
  }
  const hadScript = /<\s*script\b/i.test(original);
  const hasScriptNow = /<\s*script\b/i.test(suggested);
  if (!hadScript && hasScriptNow) {
    return {
      safe: false,
      reason: "The AI suggestion introduces a <script> tag that was not present before."
    };
  }
  const hadJsUrl = /javascript:/i.test(original);
  const hasJsUrlNow = /javascript:/i.test(suggested);
  if (!hadJsUrl && hasJsUrlNow) {
    return {
      safe: false,
      reason: 'The AI suggestion introduces a "javascript:" URL that was not present before.'
    };
  }
  return { safe: true };
}
function buildRuleExplanation(ruleId, rule) {
  switch (ruleId) {
    case "R1_IMG_ALT":
      return `# ${rule.id} - Images must have meaningful alt text

**WCAG reference:** ${rule.wcagRef}

${rule.description}

## Why this matters

Screen reader users rely on \`alt\` text to understand the purpose of images. If the alt text is missing or empty for meaningful images, important information is lost.

## Problematic example

\`\`\`html
<img src="hero.jpg">
\`\`\`

## Improved example

\`\`\`html
<img src="hero.jpg" alt="Hero banner showing our main product">
\`\`\``;
    case "R2_LABEL":
      return `# ${rule.id} - Form controls must have an accessible name

**WCAG reference:** ${rule.wcagRef}

${rule.description}

## Why this matters

Without an accessible name, screen reader users will hear generic labels like "edit text" instead of meaningful names like "Username" or "Email". This makes forms hard or impossible to complete.

## Problematic example

\`\`\`html
<input id="username" type="text">
\`\`\`

## Improved examples

Using a label:

\`\`\`html
<label for="username">Username</label>
<input id="username" type="text">
\`\`\`

Using aria-label:

\`\`\`html
<input id="username" type="text" aria-label="Username">
\`\`\``;
    case "R3_BUTTON":
      return `# ${rule.id} - Buttons need visible or accessible text

**WCAG reference:** ${rule.wcagRef}

${rule.description}

## Why this matters

Buttons without a clear name are announced as "button" with no context. Users cannot tell what action will occur.

## Problematic example

\`\`\`html
<button></button>
\`\`\`

## Improved examples

\`\`\`html
<button>Submit</button>
\`\`\`

Icon-only button with aria-label:

\`\`\`html
<button aria-label="Close dialog">
  <svg aria-hidden="true">...</svg>
</button>
\`\`\``;
    case "R4_LINK":
      return `# ${rule.id} - Links should have descriptive text

**WCAG reference:** ${rule.wcagRef}

${rule.description}

## Why this matters

When link text is vague (e.g., "click here"), screen reader users cannot understand where the link goes, especially when navigating a list of links.

## Problematic example

\`\`\`html
<a href="/details">click here</a>
\`\`\`

## Improved example

\`\`\`html
<a href="/details">View product details</a>
\`\`\``;
    case "R5_H1":
      return `# ${rule.id} - Use a clear main heading structure

**WCAG reference:** ${rule.wcagRef}

${rule.description}

## Why this matters

Headings define the outline of a page. A clear main heading helps screen reader users understand page structure and quickly determine what the page is about.

## Problematic example (multiple competing main headings)

\`\`\`html
<h1>Products</h1>
<h1>Support</h1>
\`\`\`

## Improved example

\`\`\`html
<h1>Products</h1>
<h2>Support</h2>
\`\`\``;
    case "R6_TABINDEX":
      return `# ${rule.id} - Avoid positive tabindex values

**WCAG reference:** ${rule.wcagRef}

${rule.description}

## Why this matters

Positive tabindex values create a custom focus order that can become confusing and fragile. They often cause keyboard users to jump around the page in unexpected ways.

## Problematic example

\`\`\`html
<a href="#content" tabindex="3">Skip to content</a>
\`\`\`

## Improved example

\`\`\`html
<a href="#content">Skip to content</a>
\`\`\``;
    case "R7_ROLE_BUTTON":
      return `# ${rule.id} - Custom buttons must be keyboard accessible

**WCAG reference:** ${rule.wcagRef}

${rule.description}

## Why this matters

When using \`role="button"\` on non-button elements, you must manually provide keyboard support. Otherwise, keyboard and screen reader users may not be able to activate the control.

## Problematic example

\`\`\`html
<div role="button" onclick="openDialog()">Open dialog</div>
\`\`\`

## Improved example

\`\`\`html
<div
  role="button"
  tabindex="0"
  onclick="openDialog()"
  onkeydown="if (event.key === 'Enter' || event.key === ' ') openDialog()"
>
  Open dialog
</div>
\`\`\``;
    default:
      return `# ${rule.id}

**WCAG reference:** ${rule.wcagRef}

${rule.description}

This rule currently has no extended explanation configured.`;
  }
}
var A11yCodeActionProvider = class {
  static providedCodeActionKinds = [
    vscode2.CodeActionKind.QuickFix
  ];
  provideCodeActions(document, range, context) {
    const a11yDiagnostic = context.diagnostics.find(
      (d) => d.source === "wcag-ai-helper"
    );
    if (!a11yDiagnostic) {
      return;
    }
    const actions = [];
    const aiAction = new vscode2.CodeAction(
      "Ask WCAG AI Helper (suggest fix)",
      vscode2.CodeActionKind.QuickFix
    );
    aiAction.command = {
      title: "Ask WCAG AI Helper",
      command: "wcag-ai-helper.askAiSuggestion",
      arguments: [a11yDiagnostic]
    };
    actions.push(aiAction);
    const explainAction = new vscode2.CodeAction(
      "Explain this accessibility rule (WCAG)",
      vscode2.CodeActionKind.QuickFix
    );
    explainAction.command = {
      title: "Explain this accessibility rule",
      command: "wcag-ai-helper.explainRule",
      arguments: [a11yDiagnostic]
    };
    actions.push(explainAction);
    return actions;
  }
};
function activate(context) {
  console.log('Extension "wcag-ai-helper" is now active.');
  diagnosticCollection = vscode2.languages.createDiagnosticCollection("wcag-ai-helper");
  context.subscriptions.push(diagnosticCollection);
  const scanCmd = vscode2.commands.registerCommand(
    "wcag-ai-helper.scanFile",
    () => {
      const editor = vscode2.window.activeTextEditor;
      if (!editor) {
        vscode2.window.showInformationMessage("No active editor to analyze.");
        return;
      }
      runAnalysis(editor.document);
    }
  );
  context.subscriptions.push(scanCmd);
  const explainRuleCmd = vscode2.commands.registerCommand(
    "wcag-ai-helper.explainRule",
    async (diagnosticFromCodeAction) => {
      const editor = vscode2.window.activeTextEditor;
      if (!editor) {
        vscode2.window.showInformationMessage("No active editor.");
        return;
      }
      const doc = editor.document;
      if (!diagnosticCollection) {
        vscode2.window.showInformationMessage("No diagnostics available.");
        return;
      }
      let targetDiagnostic;
      if (diagnosticFromCodeAction) {
        targetDiagnostic = diagnosticFromCodeAction;
      } else {
        const position = editor.selection.active;
        const diagnostics = diagnosticCollection.get(doc.uri) ?? [];
        targetDiagnostic = diagnostics.find(
          (d) => d.source === "wcag-ai-helper" && d.range.contains(position)
        );
      }
      if (!targetDiagnostic) {
        vscode2.window.showInformationMessage(
          "No accessibility issue found to explain."
        );
        return;
      }
      const ruleId = targetDiagnostic.code?.toString() ?? "";
      const rule = RULES.find((r) => r.id === ruleId) ?? {
        id: ruleId || "Unknown rule",
        description: "No description available.",
        wcagRef: "N/A"
      };
      const markdown = buildRuleExplanation(ruleId || rule.id, rule);
      const explanationDoc = await vscode2.workspace.openTextDocument({
        language: "markdown",
        content: markdown
      });
      await vscode2.window.showTextDocument(explanationDoc, {
        preview: true
      });
    }
  );
  context.subscriptions.push(explainRuleCmd);
  const aiCmd = vscode2.commands.registerCommand(
    "wcag-ai-helper.askAiSuggestion",
    async (diagnosticFromCodeAction) => {
      const editor = vscode2.window.activeTextEditor;
      if (!editor) {
        vscode2.window.showInformationMessage("No active editor.");
        return;
      }
      const doc = editor.document;
      if (!diagnosticCollection) {
        vscode2.window.showInformationMessage("No diagnostics available.");
        return;
      }
      let targetDiagnostic;
      if (diagnosticFromCodeAction) {
        targetDiagnostic = diagnosticFromCodeAction;
      } else {
        const position = editor.selection.active;
        const diagnostics = diagnosticCollection.get(doc.uri) ?? [];
        targetDiagnostic = diagnostics.find(
          (d) => d.source === "wcag-ai-helper" && d.range.contains(position)
        );
      }
      if (!targetDiagnostic) {
        vscode2.window.showInformationMessage(
          "No accessibility issue found to ask AI about."
        );
        return;
      }
      const ruleId = targetDiagnostic.code?.toString() ?? "";
      const rule = RULES.find((r) => r.id === ruleId);
      if (!rule) {
        vscode2.window.showInformationMessage(
          "Could not identify rule for this diagnostic."
        );
        return;
      }
      const diagLine = targetDiagnostic.range.start.line;
      const startLine = Math.max(diagLine - 2, 0);
      const endLine = Math.min(diagLine + 2, doc.lineCount - 1);
      const snippetRange = new vscode2.Range(
        new vscode2.Position(startLine, 0),
        new vscode2.Position(endLine, doc.lineAt(endLine).text.length)
      );
      const codeSnippet = doc.getText(snippetRange);
      try {
        vscode2.window.showInformationMessage(
          "Asking AI for accessibility suggestion\u2026"
        );
        const fixedCode = await getAiSuggestion({
          ruleId: rule.id,
          ruleDescription: rule.description,
          wcagRef: rule.wcagRef,
          codeSnippet,
          languageId: doc.languageId
        });
        const choice = await vscode2.window.showInformationMessage(
          "AI generated a suggested fix for this snippet.",
          "Apply fix",
          "View suggestion",
          "Cancel"
        );
        if (choice === "Apply fix") {
          const safety = isSafeReplacement(codeSnippet, fixedCode);
          if (!safety.safe) {
            vscode2.window.showWarningMessage(
              `AI suggestion was not applied automatically: ${safety.reason ?? "failed safety checks."} You can choose 'View suggestion' to inspect and edit it manually.`
            );
            return;
          }
          const edit = new vscode2.WorkspaceEdit();
          edit.replace(doc.uri, snippetRange, fixedCode);
          const success = await vscode2.workspace.applyEdit(edit);
          if (success) {
            await doc.save();
            vscode2.window.showInformationMessage("AI fix applied.");
            runAnalysis(doc);
          } else {
            vscode2.window.showErrorMessage("Failed to apply AI fix.");
          }
          return;
        }
        if (choice === "View suggestion") {
          const suggestionDoc = await vscode2.workspace.openTextDocument({
            language: "markdown",
            content: `# AI Accessibility Suggestion

WCAG: ${rule.wcagRef}

Rule: ${rule.description}

## Suggested fixed code

\`\`\`${doc.languageId}
` + fixedCode + "\n```"
          });
          await vscode2.window.showTextDocument(suggestionDoc, {
            preview: true
          });
          const applyChoice = await vscode2.window.showInformationMessage(
            "Apply this AI suggestion to the original file?",
            "Apply fix",
            "Close"
          );
          if (applyChoice === "Apply fix") {
            const safety = isSafeReplacement(codeSnippet, fixedCode);
            if (!safety.safe) {
              vscode2.window.showWarningMessage(
                `AI suggestion was not applied automatically: ${safety.reason ?? "failed safety checks."} Please review and copy any useful parts manually from the suggestion document.`
              );
              return;
            }
            const edit = new vscode2.WorkspaceEdit();
            edit.replace(doc.uri, snippetRange, fixedCode);
            const success = await vscode2.workspace.applyEdit(edit);
            if (success) {
              await doc.save();
              vscode2.window.showInformationMessage("AI fix applied.");
              runAnalysis(doc);
            } else {
              vscode2.window.showErrorMessage("Failed to apply AI fix.");
            }
          }
          return;
        }
      } catch (err) {
        vscode2.window.showErrorMessage(
          `AI suggestion failed: ${err.message ?? String(err)}`
        );
      }
    }
  );
  context.subscriptions.push(aiCmd);
  const codeActionProvider = vscode2.languages.registerCodeActionsProvider(
    ["html", "javascriptreact", "typescriptreact", "razor", "aspnetcorerazor"],
    new A11yCodeActionProvider(),
    {
      providedCodeActionKinds: A11yCodeActionProvider.providedCodeActionKinds
    }
  );
  context.subscriptions.push(codeActionProvider);
  context.subscriptions.push(
    vscode2.workspace.onDidSaveTextDocument((doc) => {
      runAnalysis(doc);
    })
  );
  context.subscriptions.push(
    vscode2.workspace.onDidChangeTextDocument((event) => {
      const doc = event.document;
      const supportedLanguages = [
        "html",
        "javascriptreact",
        "typescriptreact",
        "razor",
        "aspnetcorerazor"
      ];
      if (supportedLanguages.includes(doc.languageId)) {
        runAnalysis(doc);
      }
    })
  );
}
function runAnalysis(doc) {
  if (!diagnosticCollection) {
    return;
  }
  const supportedLanguages = [
    "html",
    "javascriptreact",
    "typescriptreact",
    "razor",
    "aspnetcorerazor"
  ];
  if (!supportedLanguages.includes(doc.languageId)) {
    diagnosticCollection.delete(doc.uri);
    return;
  }
  const issues = analyzeDocument(doc);
  const diagnostics = issues.map((issue) => {
    const start = new vscode2.Position(issue.line, issue.column);
    const end = new vscode2.Position(issue.line, issue.column + 1);
    const range = new vscode2.Range(start, end);
    const diagnostic = new vscode2.Diagnostic(
      range,
      `${issue.message} [${issue.ruleId}]`,
      vscode2.DiagnosticSeverity.Warning
    );
    diagnostic.source = "wcag-ai-helper";
    diagnostic.code = issue.ruleId;
    return diagnostic;
  });
  diagnosticCollection.set(doc.uri, diagnostics);
  vscode2.window.setStatusBarMessage(
    `WCAG scan: found ${diagnostics.length} issue(s).`,
    4e3
  );
}
function deactivate() {
  if (diagnosticCollection) {
    diagnosticCollection.dispose();
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
//# sourceMappingURL=extension.js.map
